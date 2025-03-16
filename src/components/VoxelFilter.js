/**
 * VoxelFilter.js - Implements voxel grid filtering for point cloud data
 *
 * This module provides functions to filter point cloud data using a voxel grid approach,
 * which helps reduce redundancy while maintaining the overall structure of the data.
 */
import * as THREE from "three";

/**
 * Apply voxel grid filtering to point cloud data
 *
 * @param {Array} pointCloudData - Array of points with x, y, z, intensity, time, tag, line properties
 * @param {Number} voxelSize - Size of voxel cube in meters
 * @param {String} method - Method to use for representative point selection ('centroid', 'random', 'first')
 * @returns {Array} - Filtered array of points
 */
export function applyVoxelFilter(
  pointCloudData,
  voxelSize = 0.1,
  method = "centroid"
) {
  if (!pointCloudData || pointCloudData.length === 0) {
    return [];
  }

  // Map to store voxels with points
  const voxelMap = new Map();

  // Assign each point to a voxel
  pointCloudData.forEach((point) => {
    // Calculate voxel index based on point coordinates
    const voxelX = Math.floor(point.x / voxelSize);
    const voxelY = Math.floor(point.y / voxelSize);
    const voxelZ = Math.floor(point.z / voxelSize);

    // Generate a unique key for this voxel
    const voxelKey = `${voxelX},${voxelY},${voxelZ}`;

    // Add point to the appropriate voxel
    if (!voxelMap.has(voxelKey)) {
      voxelMap.set(voxelKey, []);
    }
    voxelMap.get(voxelKey).push(point);
  });

  // Generate representative points for each voxel
  const filteredPoints = [];
  voxelMap.forEach((pointsInVoxel) => {
    if (pointsInVoxel.length > 0) {
      let representativePoint;

      switch (method) {
        case "random":
          // Select a random point from the voxel
          representativePoint =
            pointsInVoxel[Math.floor(Math.random() * pointsInVoxel.length)];
          break;

        case "first":
          // Select the first point in the voxel
          representativePoint = pointsInVoxel[0];
          break;

        case "centroid":
        default:
          // Calculate the centroid of all points in the voxel
          representativePoint = calculateCentroid(pointsInVoxel);
          break;
      }

      filteredPoints.push(representativePoint);
    }
  });

  return filteredPoints;
}

/**
 * Calculate the centroid (average) point from a collection of points
 *
 * @param {Array} points - Array of points with x, y, z properties
 * @returns {Object} - Centroid point with averaged properties
 */
function calculateCentroid(points) {
  // Initialize accumulators
  let sumX = 0,
    sumY = 0,
    sumZ = 0;
  let sumIntensity = 0;
  let sumTime = 0;
  let tags = [];
  let lines = [];

  // Sum all values
  points.forEach((point) => {
    sumX += point.x;
    sumY += point.y;
    sumZ += point.z;
    sumIntensity += point.intensity;
    sumTime += point.time;
    tags.push(point.tag);
    lines.push(point.line);
  });

  // Calculate averages
  const numPoints = points.length;

  // Find most common tag and line
  const mostCommonTag = findMostCommon(tags);
  const mostCommonLine = findMostCommon(lines);

  // Return centroid point
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

/**
 * Find the most common value in an array
 *
 * @param {Array} array - Array of values
 * @returns {*} - Most common value
 */
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
