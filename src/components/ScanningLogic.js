import * as THREE from "three";

/**
 * Initialize vertical angles for LiDAR beams
 */
export function initializeVerticalAngles(numChannels, verticalFOV) {
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
 * Clear previous debug ray visualizations
 */
export function clearDebugRays(rayLines) {
  rayLines.forEach((line) => {
    if (line && line.parent) {
      line.parent.remove(line);
    }
  });
  return [];
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
 * Create debug ray visualization
 */
export function createDebugRay(origin, endpoint, intensity, scene) {
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    origin,
    endpoint,
  ]);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(intensity, intensity, intensity),
  });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(line);
  return line;
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
      line: channelIndex, // Use channel index as line value (0-39)
    };
  }

  return null;
}

/**
 * Cast multiple rays and collect points
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

  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    // Generate somewhat random scanning pattern
    const horizontalOffset = ((Math.random() - 0.5) * Math.PI) / 36; // Small random offset
    const currentHAngle = scanState.horizontalAngle + horizontalOffset;

    // Pick a random vertical channel
    const channelIndex = Math.floor(Math.random() * lidarConfig.numChannels);
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
