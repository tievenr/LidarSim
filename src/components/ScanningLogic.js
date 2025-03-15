import * as THREE from "three";
import { createDebugRay } from "./VisualizationLogic";

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
 * Update the scan angle based on time
 */
export function updateScanAngle(delta, scanState, scanRate) {
  scanState.horizontalAngle += delta / scanRate;
  if (scanState.horizontalAngle >= Math.PI * 2) {
    scanState.horizontalAngle = 0;
  }
}

/**
 * Get current sensor position from the 3D world
 */
export function getSensorPosition(sensorRef) {
  return new THREE.Vector3().setFromMatrixPosition(
    sensorRef.current.matrixWorld
  );
}

/**
 * Collect all meshes in the scene that can be intersected by the LiDAR
 */
export function collectIntersectableMeshes(scene, sensorRef) {
  const meshes = [];
  scene.traverse((object) => {
    if (object.isMesh && object !== sensorRef.current) {
      meshes.push(object);
    }
  });
  return meshes;
}

/**
 * Cast a single ray and return point data if hit
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
  // Set raycaster origin and direction
  raycaster.set(origin, direction);

  // Find intersections
  const intersects = raycaster.intersectObjects(meshesToIntersect, false);

  // If we hit something within range
  if (
    intersects.length > 0 &&
    intersects[0].distance >= lidarConfig.minRange &&
    intersects[0].distance <= lidarConfig.maxRange
  ) {
    const hitPoint = intersects[0].point;
    const distance = intersects[0].distance;

    // Calculate intensity based on distance (0-1 range)
    const normalizedDistance = Math.min(distance / lidarConfig.maxRange, 1);
    const intensity = 1 - normalizedDistance;

    // Create debug ray visualization if enabled
    if (showDebugRays) {
      const line = createDebugRay(origin, hitPoint, intensity, scene);
      rayLines.push(line);
    }

    // Return point data in PCD format
    return {
      x: hitPoint.x,
      y: hitPoint.y,
      z: hitPoint.z,
      intensity: intensity,
      time: timestamp,
      tag: Math.floor(Math.random() * 256), // Simulate tag value (0-255)
      line: channelIndex, // Use channel index as line value
    };
  }

  return null;
}

/**
 * Cast multiple rays and collect points with improved density distribution
 * to better simulate Livox Mid-360 scanning pattern
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

  // Livox Mid-360 has a non-uniform scanning pattern
  // We'll implement a more even density distribution

  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    // Generate horizontal angle with density weighting
    // Ensure more even coverage across the full 360°
    const horizontalOffset = ((Math.random() - 0.5) * Math.PI) / 36; // Small random offset
    const currentHAngle = scanState.horizontalAngle + horizontalOffset;

    // Strategic vertical channel selection for more even distribution
    // Use weighted sampling to compensate for the asymmetric vertical FOV
    let channelIndex;

    // For asymmetric FOV, use weighted sampling to ensure even density
    // The larger upper FOV range (52°) vs lower (-7°) means we need more points in the upper range
    const verticalRange =
      lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin;
    const upperWeight = Math.abs(lidarConfig.verticalFOVMax) / verticalRange;
    const lowerWeight = Math.abs(lidarConfig.verticalFOVMin) / verticalRange;

    // Weighted random selection based on FOV distribution
    if (Math.random() < upperWeight) {
      // Sample upper half with higher probability
      channelIndex = Math.floor(
        lidarConfig.numChannels / 2 +
          Math.random() * (lidarConfig.numChannels / 2)
      );
    } else {
      // Sample lower half with lower probability
      channelIndex = Math.floor(Math.random() * (lidarConfig.numChannels / 2));
    }

    // Ensure channel index is within bounds
    channelIndex = Math.min(
      Math.max(channelIndex, 0),
      lidarConfig.numChannels - 1
    );

    const verticalAngle = scanState.verticalAngles[channelIndex];

    // Convert angles to radians
    const hAngleRad = currentHAngle;
    const vAngleRad = THREE.MathUtils.degToRad(verticalAngle);

    // Get direction vector
    const direction = calculateRayDirection(hAngleRad, vAngleRad);

    // Cast ray and process results
    const point = castSingleRay(
      sensorPosition,
      direction,
      meshesToIntersect,
      channelIndex,
      currentTime * 1000, // Convert to microseconds
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
  maxPoints = 200000
) {
  // Add new points to our point cloud data
  let updatedData = [...pointCloudData, ...newPoints];

  // Limit point cloud size to avoid performance issues
  if (updatedData.length > maxPoints) {
    updatedData = updatedData.slice(-maxPoints);
  }

  return updatedData;
}
