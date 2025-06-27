import * as THREE from "three";

export function applyVoxelFilter(
  pointCloudData,
  voxelSize = 0.1,
  method = "centroid"
) {
  if (!pointCloudData || pointCloudData.length === 0) {
    return [];
  }

  const voxelMap = new Map();

  pointCloudData.forEach((point) => {
    const voxelX = Math.floor(point.x / voxelSize);
    const voxelY = Math.floor(point.y / voxelSize);
    const voxelZ = Math.floor(point.z / voxelSize);
    const voxelKey = `${voxelX},${voxelY},${voxelZ}`;

    if (!voxelMap.has(voxelKey)) {
      voxelMap.set(voxelKey, []);
    }
    voxelMap.get(voxelKey).push(point);
  });

  const filteredPoints = [];
  voxelMap.forEach((pointsInVoxel) => {
    if (pointsInVoxel.length > 0) {
      let representativePoint;

      switch (method) {
        case "random":
          representativePoint =
            pointsInVoxel[Math.floor(Math.random() * pointsInVoxel.length)];
          break;
        case "first":
          representativePoint = pointsInVoxel[0];
          break;
        case "centroid":
        default:
          representativePoint = calculateCentroid(pointsInVoxel);
          break;
      }

      filteredPoints.push(representativePoint);
    }
  });

  return filteredPoints;
}

function calculateCentroid(points) {
  let sumX = 0,
    sumY = 0,
    sumZ = 0;
  let sumIntensity = 0,
    sumTime = 0;
  let tags = [],
    lines = [];

  points.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumZ += point.z;
    sumIntensity += point.intensity;
    sumTime += point.time;
    tags.push(point.tag);
    lines.push(point.line);
  });

  const numPoints = points.length;
  const mostCommonTag = findMostCommon(tags);
  const mostCommonLine = findMostCommon(lines);

  return {
    x: sumX / numPoints,
    y: sumY / numPoints,
    z: sumZ / numPoints,
    intensity: sumIntensity / numPoints,
    time: sumTime / numPoints,
    tag: mostCommonTag,
    line: mostCommonLine,
  };
}

function findMostCommon(array) {
  const counts = {};
  let maxCount = 0;
  let maxValue = array[0];

  for (const value of array) {
    counts[value] = (counts[value] || 0) + 1;
    if (counts[value] > maxCount) {
      maxCount = counts[value];
      maxValue = value;
    }
  }

  return maxValue;
}
