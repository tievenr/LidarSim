import * as THREE from "three";
import { IntensityCalculator } from "../utils/IntensityCalculator";
import { DistanceBasedCulling } from "../utils/DistanceBasedCulling";

// TRULY CONSTANT VALUES 
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;

// LIDAR CONFIG-DEPENDENT CONSTANTS (if lidarConfig.verticalFOVMin/Max/numChannels are static)
const STATIC_VERTICAL_FOV_MIN_DEG = -7; 
const STATIC_VERTICAL_FOV_MAX_DEG = 52; 
const STATIC_NUM_CHANNELS = 40; 
const STATIC_VERTICAL_RANGE =
  STATIC_VERTICAL_FOV_MAX_DEG - STATIC_VERTICAL_FOV_MIN_DEG;
const STATIC_VERTICAL_RANGE_RAD = THREE.MathUtils.degToRad(
  STATIC_VERTICAL_RANGE
);
const STATIC_VERTICAL_FOV_MIN_RAD = THREE.MathUtils.degToRad(
  STATIC_VERTICAL_FOV_MIN_DEG
);
const STATIC_NUM_CHANNELS_MINUS_ONE = STATIC_NUM_CHANNELS - 1;
const STATIC_INV_VERTICAL_RANGE = 1.0 / STATIC_VERTICAL_RANGE;


export function initializeVerticalAngles(
  numChannels,
  verticalFOV,
  verticalFOVMin,
  verticalFOVMax
) {
  if (verticalFOVMin !== undefined && verticalFOVMax !== undefined) {
    return Array(numChannels)
      .fill(0)
      .map(
        (_, i) =>
          verticalFOVMin +
          (i * (verticalFOVMax - verticalFOVMin)) / (numChannels - 1)
      );
  }

  return Array(numChannels)
    .fill(0)
    .map((_, i) => -verticalFOV / 2 + (i * verticalFOV) / (numChannels - 1));
}

export function calculateRayDirection(hAngleRad, vAngleRad) {
  return new THREE.Vector3(
    Math.sin(hAngleRad) * Math.cos(vAngleRad),
    Math.sin(vAngleRad),
    Math.cos(hAngleRad) * Math.cos(vAngleRad)
  );
}

export function updateScanAngle(delta, scanState, scanRate) {
  scanState.horizontalAngle += delta * scanRate;
  if (scanState.horizontalAngle >= TWO_PI) {
    scanState.horizontalAngle -= TWO_PI;
  }

  scanState.scanPhase += delta * 0.5;
  if (scanState.scanPhase > 1) {
    scanState.scanPhase = 0;
  }

  scanState.frameCount++;
}

export function getSensorPosition(sensorRef) {
  return sensorRef.current.position.clone();
}

function collectIntersectableMeshes(
  scene,
  sensorPosition,
  sensorRef,
  enableCulling = true,
  cullingOptions = {}
) {
  const startTime = performance.now();

  const culling = new DistanceBasedCulling(
    cullingOptions.maxRange || 70,
    cullingOptions.bufferDistance || 10,
    cullingOptions.minRange || 0.2
  );

  const allMeshes = [];
  scene.traverse((child) => {
    if (
      child.isMesh &&
      child.isMesh &&
      child.visible &&
      child !== sensorRef.current
    ) {
      allMeshes.push(child);
    }
  });

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
    const cullingResult = culling.cullMeshes(allMeshes, sensorPosition);
    visibleMeshes = cullingResult.visibleMeshes;

    cullingStats = {
      ...cullingStats,
      visibleMeshes: cullingResult.statistics.visible,
      culledMeshes: cullingResult.statistics.culled,
      tooClose: cullingResult.statistics.tooClose,
      tooFar: cullingResult.statistics.tooFar,
    };
  }

  const endTime = performance.now();
  cullingStats.processingTime = endTime - startTime;

  return {
    meshes: visibleMeshes,
    statistics: cullingStats,
  };
}

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
    const intensityCalculator = new IntensityCalculator(lidarConfig);
    const intensity = intensityCalculator.calculateIntensity(
      origin,
      point,
      direction,
      intersects[0],
      channelIndex
    );

    // Validate all components are finite numbers
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      !Number.isFinite(point.z) ||
      !Number.isFinite(intensity)
    ) {
      return null; // Discard invalid point
    }

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

// PRIVATE FUNCTION - Ray casting engine
function castRaysInternal(
  sensorPosition,
  meshesToIntersect,
  scanState,
  raycaster,
  lidarConfig, 
  scene,
  currentTime
) {
  const componentsPerPoint = 4; // X, Y, Z, Intensity
  const bufferSize = lidarConfig.pointsPerFrame * componentsPerPoint;
  const newPointsBuffer = new Float32Array(bufferSize);
  let pointsAddedCount = 0; // Track actual number of valid points added

  // PER-FRAME DEPENDENT CONSTANTS (only frameBaseIndex changes per frame)
  const frameBaseIndex = scanState.frameCount * lidarConfig.pointsPerFrame;

  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    const baseIndex = frameBaseIndex + i + scanState.patternOffset;
    const normalizedIndex = (baseIndex % 1000) * 0.001;

    const hAngleRad =
      (scanState.horizontalAngle +
        normalizedIndex * TWO_PI + 
        GOLDEN_ANGLE * baseIndex) % 
      TWO_PI; 

    const simpleHash = ((baseIndex * 1664525 + 1013904223) >>> 0) / 4294967296;
    const verticalPos = simpleHash;
    const verticalPosAdjusted = verticalPos * Math.sqrt(Math.sqrt(verticalPos));

    const verticalAngle =
      STATIC_VERTICAL_FOV_MIN_DEG + verticalPosAdjusted * STATIC_VERTICAL_RANGE;
    const vAngleRad = THREE.MathUtils.degToRad(verticalAngle); 

    const cosV = Math.cos(vAngleRad);
    const sinV = Math.sin(vAngleRad);
    const cosH = Math.cos(hAngleRad);
    const sinH = Math.sin(hAngleRad);
    const direction = new THREE.Vector3(sinH * cosV, sinV, cosH * cosV);

    const channelIndex = Math.floor(
      (vAngleRad - STATIC_VERTICAL_FOV_MIN_RAD) *
        STATIC_INV_VERTICAL_RANGE *
        STATIC_NUM_CHANNELS_MINUS_ONE
    );

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
      const bufferWriteIndex = pointsAddedCount * componentsPerPoint;
      newPointsBuffer[bufferWriteIndex] = point.x;
      newPointsBuffer[bufferWriteIndex + 1] = point.y;
      newPointsBuffer[bufferWriteIndex + 2] = point.z;
      newPointsBuffer[bufferWriteIndex + 3] = point.intensity;
      pointsAddedCount++;
    }
  }
  return newPointsBuffer.subarray(0, pointsAddedCount * componentsPerPoint);
}

export function castRaysForFrame(
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

  const meshCollection = collectIntersectableMeshes(
    scene,
    sensorPosition,
    sensorRef,
    enableCulling,
    {
      minRange: lidarConfig.minRange || 0.2,
      maxRange: lidarConfig.maxRange || 70,
      bufferDistance: 10,
    }
  );

  const newPoints = castRaysInternal(
    sensorPosition,
    meshCollection.meshes,
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
    cullingStats: meshCollection.statistics,
    frameStats: {
      processingTime: frameProcessingTime,
      pointsGenerated: newPoints.length / 4,
      meshesProcessed: meshCollection.meshes.length,
    },
  };
}
