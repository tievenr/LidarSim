import * as THREE from "three";
import { IntensityCalculator } from "../utils/IntensityCalculator";
import { DistanceBasedCulling } from "../utils/DistanceBasedCulling";

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
  if (scanState.horizontalAngle >= Math.PI * 2) {
    scanState.horizontalAngle -= Math.PI * 2;
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

// PRIVATE FUNCTIONS (removed export) - only used internally
function collectIntersectableMeshes(
  scene,
  sensorRef,
  sensorPosition = null,
  enableCulling = false
) {
  if (sensorPosition && enableCulling) {
    const result = collectIntersectableMeshesWithCulling(
      scene,
      sensorPosition,
      enableCulling
    );
    return result.meshes.filter((mesh) => mesh !== sensorRef.current);
  }

  return scene.children.filter((child) => {
    return child.type === "Mesh" && child !== sensorRef.current;
  });
}

function collectIntersectableMeshesWithCulling(
  scene,
  sensorPosition,
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
    if (child.isMesh && child.visible) {
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

// PRIVATE FUNCTION (removed export) - only used internally
function castRaysForFrame(
  sensorPosition,
  meshesToIntersect,
  scanState,
  raycaster,
  lidarConfig,
  scene,
  currentTime
) {
  const newPoints = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < lidarConfig.pointsPerFrame; i++) {
    const baseIndex =
      scanState.frameCount * lidarConfig.pointsPerFrame +
      i +
      scanState.patternOffset;
    const normalizedIndex = (baseIndex % 1000) / 1000;

    const hAngleRad =
      (scanState.horizontalAngle +
        normalizedIndex * Math.PI * 2 +
        goldenAngle * baseIndex) %
      (Math.PI * 2);

    const hash =
      Math.sin(baseIndex * 0.1) * 10000 + Math.cos(baseIndex * 0.7) * 10000;
    const verticalPos = Math.abs((hash % 1000) / 1000);
    const verticalPosAdjusted = Math.pow(verticalPos, 0.8);

    const verticalRange =
      lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin;
    const verticalAngle =
      lidarConfig.verticalFOVMin + verticalPosAdjusted * verticalRange;
    const vAngleRad = THREE.MathUtils.degToRad(verticalAngle);

    const direction = calculateRayDirection(hAngleRad, vAngleRad);
    const channelIndex = Math.floor(
      ((verticalAngle - lidarConfig.verticalFOVMin) / verticalRange) *
        (lidarConfig.numChannels - 1)
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
      newPoints.push(point);
    }
  }

  return newPoints;
}

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
