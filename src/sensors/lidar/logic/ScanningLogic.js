import * as THREE from "three";
import { applyVoxelFilter } from "../utils/VoxelFilter";
import { IntensityCalculator } from "../utils/IntensityCalculator";
import { DistanceBasedCulling } from "../utils/DistanceBasedCulling";

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
 * Collects all intersectable meshes in the scene
 * @param {THREE.Scene} scene - The three.js scene
 * @param {THREE.Object3D} sensorRef - Reference to the sensor object (for exclusion)
 * @param {THREE.Vector3} sensorPosition - Position of the LiDAR sensor (optional, for culling)
 * @param {boolean} enableCulling - Whether to enable distance-based culling
 * @returns {THREE.Mesh[]} Array of meshes that can be intersected
 */
export function collectIntersectableMeshes(
  scene,
  sensorRef,
  sensorPosition = null,
  enableCulling = false
) {
  if (sensorPosition && enableCulling) {
    // Use the new culling-aware function and return just the meshes
    const result = collectIntersectableMeshesWithCulling(
      scene,
      sensorPosition,
      enableCulling
    );
    // Filter out the sensor itself
    return result.meshes.filter((mesh) => mesh !== sensorRef.current);
  }

  // Fallback to simple mesh collection
  return scene.children.filter((child) => {
    return child.type === "Mesh" && child !== sensorRef.current;
  });
}

/**
 * Collects all intersectable meshes in the scene using distance-based culling
 * @param {THREE.Scene} scene - The three.js scene
 * @param {THREE.Vector3} sensorPosition - Position of the LiDAR sensor
 * @param {boolean} enableCulling - Whether to enable distance-based culling
 * @param {object} cullingOptions - Culling configuration options
 * @returns {object} Object containing visible meshes and culling statistics
 */
export function collectIntersectableMeshesWithCulling(
  scene,
  sensorPosition,
  enableCulling = true,
  cullingOptions = {}
) {
  const startTime = performance.now();

  // Initialize culling system
  const culling = new DistanceBasedCulling(
    cullingOptions.maxRange || 70,
    cullingOptions.bufferDistance || 10,
    cullingOptions.minRange || 0.2
  );

  // Collect all meshes from scene
  const allMeshes = [];
  scene.traverse((child) => {
    if (child.isMesh && child.visible) {
      allMeshes.push(child);
    }
  });

  // Optional debug: console.log(`📊 Culling Analysis - Total meshes found: ${allMeshes.length}`);

  let visibleMeshes = allMeshes;
  let cullingStats = {
    totalMeshes: allMeshes.length,
    visibleMeshes: allMeshes.length,
    culledMeshes: 0,
    tooClose: 0,
    tooFar: 0,
    cullingEnabled: enableCulling,
    processingTime: 0,
  };

  if (enableCulling && allMeshes.length > 0) {
    // Apply distance-based culling
    const cullingResult = culling.cullMeshes(allMeshes, sensorPosition);
    visibleMeshes = cullingResult.visibleMeshes;

    // Update statistics
    cullingStats = {
      ...cullingStats,
      visibleMeshes: cullingResult.statistics.visible,
      culledMeshes: cullingResult.statistics.culled,
      tooClose: cullingResult.statistics.tooClose,
      tooFar: cullingResult.statistics.tooFar,
    };

    // Optional detailed logging
    // console.log(`🎯 Culling Results:`);
    // console.log(`   Visible: ${cullingStats.visibleMeshes}/${cullingStats.totalMeshes}`);
    // console.log(`   Culled: ${cullingStats.culledMeshes} (${cullingStats.tooClose} too close, ${cullingStats.tooFar} too far)`);
    // console.log(`   Performance: ${(cullingStats.culledMeshes / cullingStats.totalMeshes) * 100}% reduction`);
  }

  const endTime = performance.now();
  cullingStats.processingTime = endTime - startTime;

  return {
    meshes: visibleMeshes,
    statistics: cullingStats,
  };
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
  scene
) {
  raycaster.set(origin, direction);
  const intersects = raycaster.intersectObjects(meshesToIntersect, true);

  if (intersects.length > 0) {
    const point = intersects[0].point;

    // Calculate intensity using the IntensityCalculator
    const intensityCalculator = new IntensityCalculator(lidarConfig);
    const intensity = intensityCalculator.calculateIntensity(
      origin,
      point,
      direction,
      intersects[0],
      channelIndex
    );

    return {
      x: point.x,
      y: point.y,
      z: point.z,
      intensity: intensity,
      timestamp: timestamp,
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
  currentTime
) {
  const newPoints = [];

  // Using the golden angle (137.5°) for optimal point distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    // Calculate angle based on golden spiral pattern
    // Combine frame count, pattern offset and current base angle
    const baseIndex =
      scanState.frameCount * lidarConfig.pointsPerFrame +
      i +
      scanState.patternOffset;
    const normalizedIndex = (baseIndex % 1000) / 1000;

    // Calculate horizontal angle using golden ratio for spiral pattern
    const hAngleRad =
      (scanState.horizontalAngle +
        normalizedIndex * Math.PI * 2 +
        goldenAngle * baseIndex) %
      (Math.PI * 2);

    // Calculate vertical angle using blue noise distribution
    // We'll use a simple hash function to get pseudo-random but consistent distribution
    const hash =
      Math.sin(baseIndex * 0.1) * 10000 + Math.cos(baseIndex * 0.7) * 10000;
    const verticalPos = Math.abs((hash % 1000) / 1000);

    // Apply non-linear mapping for better coverage of important areas
    const verticalPosAdjusted = Math.pow(verticalPos, 0.8);

    // Map to vertical FOV range with emphasis on the central region
    const verticalRange =
      lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin;
    const verticalAngle =
      lidarConfig.verticalFOVMin + verticalPosAdjusted * verticalRange;
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
      scene
    );

    if (point) {
      newPoints.push(point);
    }
  }

  return newPoints;
}

/**
 * Cast rays for a complete frame with distance-based culling support
 * Returns both points and culling statistics
 */
export function castRaysForFrameWithCulling(
  sensorPosition,
  scene,
  scanState,
  raycaster,
  lidarConfig,
  currentTime,
  sensorRef,
  enableCulling = true
) {
  const frameStartTime = performance.now();

  // Collect meshes with or without culling
  let meshesToIntersect;
  let cullingStats = null;

  if (enableCulling) {
    const meshCollection = collectIntersectableMeshesWithCulling(
      scene,
      sensorPosition,
      true,
      {
        minRange: lidarConfig.minRange || 0.2,
        maxRange: lidarConfig.maxRange || 70,
        bufferDistance: 10,
      }
    );
    meshesToIntersect = meshCollection.meshes.filter(
      (mesh) => mesh !== sensorRef.current
    );
    cullingStats = meshCollection.statistics;
  } else {
    meshesToIntersect = collectIntersectableMeshes(
      scene,
      sensorRef,
      null,
      false
    );
  }

  // Cast rays using the filtered mesh list
  const newPoints = castRaysForFrame(
    sensorPosition,
    meshesToIntersect,
    scanState,
    raycaster,
    lidarConfig,
    scene,
    currentTime
  );

  const frameEndTime = performance.now();
  const frameProcessingTime = frameEndTime - frameStartTime;

  return {
    points: newPoints,
    cullingStats: cullingStats,
    frameStats: {
      processingTime: frameProcessingTime,
      pointsGenerated: newPoints.length,
      meshesProcessed: meshesToIntersect.length,
    },
  };
}
