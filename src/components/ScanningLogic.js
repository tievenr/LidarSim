import * as THREE from "three";
import { createDebugRay } from "./VisualizationLogic";
import { applyVoxelFilter } from "./VoxelFilter";

/**
 * Initialize vertical angles for LiDAR beams with asymmetric distribution
 * for Livox Mid-360 (-7° to 52°)
 */
export function initializeVerticalAngles(
  numChannels,
  verticalFOV,
  verticalFOVMin,
  verticalFOVMax
) {
  // If min and max FOV are provided, use those for asymmetric distribution
  if (verticalFOVMin !== undefined && verticalFOVMax !== undefined) {
    return Array(numChannels)
      .fill(0)
      .map(
        (_, i) =>
          verticalFOVMin +
          (i * (verticalFOVMax - verticalFOVMin)) / (numChannels - 1)
      );
  }

  // Fallback to symmetric distribution around zero
  return Array(numChannels)
    .fill(0)
    .map((_, i) => -verticalFOV / 2 + (i * verticalFOV) / (numChannels - 1));
}

/**
 * Calculate ray direction based on angles
 */
export function calculateRayDirection(hAngleRad, vAngleRad) {
  return new THREE.Vector3(
    Math.sin(hAngleRad) * Math.cos(vAngleRad),
    Math.sin(vAngleRad),
    Math.cos(hAngleRad) * Math.cos(vAngleRad)
  );
}

/**
 * Update the scan angle and phase based on time
 * Ensures we maintain the proper rotation rate and pattern variation
 */
export function updateScanAngle(delta, scanState, scanRate) {
  // Update base rotation
  scanState.horizontalAngle += delta * scanRate;
  if (scanState.horizontalAngle >= Math.PI * 2) {
    scanState.horizontalAngle -= Math.PI * 2;
  }
  
  // Update phase for pattern variation
  scanState.scanPhase += delta * 0.5;
  if (scanState.scanPhase > 1) {
    scanState.scanPhase = 0;
  }
  
  // Increment frame counter
  scanState.frameCount++;
}

/**
 * Get the sensor position in world space
 */
export function getSensorPosition(sensorRef) {
  return sensorRef.current.position.clone();
}

/**
 * Collect all meshes in the scene that can be intersected
 */
export function collectIntersectableMeshes(scene, sensorRef) {
  return scene.children.filter(child => {
    return child.type === "Mesh" && child !== sensorRef.current;
  });
}

/**
 * Cast a single ray and return intersection point if found
 */
export function castSingleRay(
  origin,
  direction,
  meshesToIntersect,
  channelIndex,
  timestamp,
  raycaster,
  lidarConfig,
  scene,
  rayLines,
  showDebugRays
) {
  raycaster.set(origin, direction);
  const intersects = raycaster.intersectObjects(meshesToIntersect, true);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    
    // Create debug visualization if enabled
    if (showDebugRays) {
      const rayLine = createDebugRay(
        origin,
        point,
        channelIndex / lidarConfig.numChannels,
        scene
      );
      rayLines.push(rayLine);
    }

    return {
      x: point.x,
      y: point.y,
      z: point.z,
      intensity: channelIndex / lidarConfig.numChannels,
      timestamp: timestamp
    };
  }

  return null;
}

/**
 * Cast rays for a complete frame using improved pattern distribution
 */
export function castRaysForFrame(
  sensorPosition,
  meshesToIntersect,
  scanState,
  raycaster,
  lidarConfig,
  scene,
  rayLines,
  showDebugRays,
  currentTime
) {
  const newPoints = [];
  
  // Using the golden angle (137.5°) for optimal point distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  
  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    // Calculate angle based on golden spiral pattern
    // Combine frame count, pattern offset and current base angle
    const baseIndex = scanState.frameCount * lidarConfig.pointsPerFrame + i + scanState.patternOffset;
    const normalizedIndex = ((baseIndex % 1000) / 1000);
    
    // Calculate horizontal angle using golden ratio for spiral pattern
    const hAngleRad = (scanState.horizontalAngle + normalizedIndex * Math.PI * 2 + 
                    goldenAngle * baseIndex) % (Math.PI * 2);
    
    // Calculate vertical angle using blue noise distribution
    // We'll use a simple hash function to get pseudo-random but consistent distribution
    const hash = Math.sin(baseIndex * 0.1) * 10000 + Math.cos(baseIndex * 0.7) * 10000;
    const verticalPos = Math.abs((hash % 1000) / 1000);
    
    // Apply non-linear mapping for better coverage of important areas
    const verticalPosAdjusted = Math.pow(verticalPos, 0.8);
    
    // Map to vertical FOV range with emphasis on the central region
    const verticalRange = lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin;
    const verticalAngle = lidarConfig.verticalFOVMin + verticalPosAdjusted * verticalRange;
    const vAngleRad = THREE.MathUtils.degToRad(verticalAngle);
    
    // Get direction vector
    const direction = calculateRayDirection(hAngleRad, vAngleRad);
    
    // Calculate channel index based on vertical angle
    const channelIndex = Math.floor(
      ((verticalAngle - lidarConfig.verticalFOVMin) / verticalRange) * 
      (lidarConfig.numChannels - 1)
    );
    
    // Cast ray and process results
    const point = castSingleRay(
      sensorPosition,
      direction,
      meshesToIntersect,
      channelIndex,
      currentTime * 1000,
      raycaster,
      lidarConfig,
      scene,
      rayLines,
      showDebugRays
    );
    
    if (point) {
      newPoints.push(point);
    }
  }
  
  return newPoints;
}

/**
 * Update point cloud data with new points
 */
export function updatePointCloudData(
  newPoints,
  pointCloudData,
  maxPoints = 100000,
  applyFilter = true,
  voxelSize = 0.1
) {
  // Add new points
  pointCloudData.push(...newPoints);

  // Apply voxel filtering if enabled
  if (applyFilter) {
    pointCloudData = applyVoxelFilter(pointCloudData, voxelSize);
  }

  // Limit total number of points
  if (pointCloudData.length > maxPoints) {
    pointCloudData = pointCloudData.slice(-maxPoints);
  }

  return pointCloudData;
}
