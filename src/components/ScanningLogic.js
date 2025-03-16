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
 * Fixed by multiplying by scanRate instead of dividing
 */
export function updateScanAngle(delta, scanState, scanRate) {
  // delta is in seconds, scanRate is in radians per second
  scanState.horizontalAngle += delta * scanRate;

  // Wrap around instead of reset for smoother animation
  if (scanState.horizontalAngle >= Math.PI * 2) {
    scanState.horizontalAngle -= Math.PI * 2;
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
 * Completely rewritten to fix point distribution issues
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

  // Improved ray distribution for more realistic scanning pattern
  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    // Generate horizontal angle with more uniform distribution
    // Divide the 360° into segments for more even coverage
    const angleStep = (2 * Math.PI) / lidarConfig.pointsPerFrame;
    const randomOffset = Math.random() * angleStep * 0.5; // Reduced randomness for more even distribution
    const currentHAngle =
      scanState.horizontalAngle + i * angleStep + randomOffset;

    // Better weighting for vertical angle selection
    // Calculate proper weighting based on the vertical FOV distribution
    const verticalFOVRange = Math.abs(
      lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin
    );
    const upperRange = Math.abs(lidarConfig.verticalFOVMax);
    const lowerRange = Math.abs(lidarConfig.verticalFOVMin);

    // Weight distribution based on the ratio of upper to lower FOV
    const upperWeight = upperRange / verticalFOVRange;

    // Select channel based on weighted probability
    let channelIndex;
    if (Math.random() < upperWeight) {
      // Sample from upper FOV range (more points due to larger range)
      const upperChannelCount = Math.round(
        lidarConfig.numChannels * upperWeight
      );
      const lowerBound = lidarConfig.numChannels - upperChannelCount;
      channelIndex = lowerBound + Math.floor(Math.random() * upperChannelCount);
    } else {
      // Sample from lower FOV range (fewer points due to smaller range)
      const lowerChannelCount = Math.round(
        lidarConfig.numChannels * (1 - upperWeight)
      );
      channelIndex = Math.floor(Math.random() * lowerChannelCount);
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
 * Lowered maxPoints default value for better performance
 */
export function updatePointCloudData(
  newPoints,
  pointCloudData,
  maxPoints = 100000 // Reduced from 200000 for better performance
) {
  // Add new points to our point cloud data
  let updatedData = [...pointCloudData, ...newPoints];

  // Limit point cloud size to avoid performance issues
  if (updatedData.length > maxPoints) {
    updatedData = updatedData.slice(-maxPoints);
  }

  return updatedData;
}
