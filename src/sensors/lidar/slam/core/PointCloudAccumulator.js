import * as THREE from "three";

/**
 * Accumulates point cloud data into a global map using voxel-based storage
 * Manages memory efficiently and provides map export functionality
 */
export class PointCloudAccumulator {
  constructor(options = {}) {
    this.options = {
      voxelSize: 0.1, // 10cm voxels
      maxPoints:
        options.maxPoints ||
        options.maxMapPoints ||
        options.maxGlobalPoints ||
        1000000, // Handle different option names
      maxPointsPerVoxel: 50, // Maximum points per voxel
      memoryOptimization: true, // Enable memory optimization
      useIntensityWeighting: true, // Weight points by intensity
      ...options,
    };

    this.reset();
    console.log(
      "PointCloudAccumulator initialized with voxel size:",
      this.options.voxelSize
    );
  }

  /**
   * Reset the accumulator
   */
  reset() {
    // Voxel grid storage: Map<voxelKey, VoxelData>
    this.voxelGrid = new Map();
    this.totalPoints = 0;
    this.bounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    };
    this.lastCleanupTime = performance.now();
    this.cleanupInterval = 10000; // Cleanup every 10 seconds
  }

  /**
   * Get total number of points in the accumulator
   */
  getTotalPoints() {
    return this.totalPoints;
  }

  /**
   * Add a LIDAR scan to the global map
   * @param {Float32Array} pointsData - Array of [x, y, z, intensity] points in sensor frame
   * @param {Object} sensorPose - Sensor pose {x, y, z, roll, pitch, yaw}
   * @param {number} timestamp - Scan timestamp
   * @returns {number} Number of points actually added to the map
   */
  addScanToMap(pointsData, sensorPose, timestamp = performance.now()) {
    if (!pointsData || pointsData.length === 0) {
      return 0;
    }

    const numPoints = pointsData.length / 4; // 4 components per point
    const transformMatrix = this.createTransformMatrix(sensorPose);
    let addedPoints = 0;

    // Transform points from sensor frame to global frame and add to voxel grid
    for (let i = 0; i < numPoints; i++) {
      const baseIndex = i * 4;

      // Get point in sensor frame
      const sensorPoint = new THREE.Vector3(
        pointsData[baseIndex],
        pointsData[baseIndex + 1],
        pointsData[baseIndex + 2]
      );
      const intensity = pointsData[baseIndex + 3];

      // Transform to global frame
      const globalPoint = sensorPoint.clone().applyMatrix4(transformMatrix);

      // Add to voxel grid
      if (this.addPointToVoxelGrid(globalPoint, intensity, timestamp)) {
        addedPoints++;
      }
    }

    // Periodic cleanup to manage memory
    if (performance.now() - this.lastCleanupTime > this.cleanupInterval) {
      this.performCleanup();
      this.lastCleanupTime = performance.now();
    }

    return addedPoints;
  }

  /**
   * Create transformation matrix from sensor pose
   */
  createTransformMatrix(pose) {
    const matrix = new THREE.Matrix4();

    // Create rotation matrix from Euler angles
    const rotation = new THREE.Euler(pose.roll, pose.pitch, pose.yaw, "XYZ");
    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);

    // Create translation matrix
    const translation = new THREE.Matrix4().makeTranslation(
      pose.x,
      pose.y,
      pose.z
    );

    // Combine translation and rotation
    matrix.multiplyMatrices(translation, rotationMatrix);

    return matrix;
  }

  /**
   * Add a point to the voxel grid
   */
  addPointToVoxelGrid(globalPoint, intensity, timestamp) {
    // Check if we've exceeded maximum points
    if (this.totalPoints >= this.options.maxPoints) {
      return false;
    }

    // Check if point coordinates are valid
    if (
      !isFinite(globalPoint.x) ||
      !isFinite(globalPoint.y) ||
      !isFinite(globalPoint.z)
    ) {
      return false;
    }

    // Calculate voxel key
    const voxelKey = this.getVoxelKey(globalPoint);

    // Get or create voxel
    let voxel = this.voxelGrid.get(voxelKey);
    if (!voxel) {
      voxel = this.createVoxel(globalPoint);
      this.voxelGrid.set(voxelKey, voxel);
    }

    // Add point to voxel if there's space
    if (voxel.points.length < this.options.maxPointsPerVoxel) {
      voxel.points.push({
        x: globalPoint.x,
        y: globalPoint.y,
        z: globalPoint.z,
        intensity: intensity,
        timestamp: timestamp,
      });

      // Update voxel statistics
      this.updateVoxelStatistics(voxel, globalPoint, intensity, timestamp);

      // Update global bounds
      this.updateBounds(globalPoint);

      this.totalPoints++;
      return true;
    } else if (this.options.useIntensityWeighting) {
      // Replace point with lowest intensity if new point has higher intensity
      return this.replaceWeakestPoint(voxel, globalPoint, intensity, timestamp);
    }

    return false;
  }

  /**
   * Get voxel key for a point
   */
  getVoxelKey(point) {
    const voxelX = Math.floor(point.x / this.options.voxelSize);
    const voxelY = Math.floor(point.y / this.options.voxelSize);
    const voxelZ = Math.floor(point.z / this.options.voxelSize);
    return `${voxelX},${voxelY},${voxelZ}`;
  }

  /**
   * Create a new voxel
   */
  createVoxel(centerPoint) {
    return {
      points: [],
      center: {
        x: centerPoint.x,
        y: centerPoint.y,
        z: centerPoint.z,
      },
      averageIntensity: 0,
      lastUpdateTime: performance.now(),
      confidence: 1.0,
    };
  }

  /**
   * Update voxel statistics
   */
  updateVoxelStatistics(voxel, point, intensity, timestamp) {
    const numPoints = voxel.points.length;

    // Update average intensity
    voxel.averageIntensity =
      (voxel.averageIntensity * (numPoints - 1) + intensity) / numPoints;

    // Update center (running average)
    voxel.center.x = (voxel.center.x * (numPoints - 1) + point.x) / numPoints;
    voxel.center.y = (voxel.center.y * (numPoints - 1) + point.y) / numPoints;
    voxel.center.z = (voxel.center.z * (numPoints - 1) + point.z) / numPoints;

    // Update timestamp
    voxel.lastUpdateTime = timestamp;

    // Increase confidence with more observations
    voxel.confidence = Math.min(1.0, voxel.confidence + 0.1);
  }

  /**
   * Replace weakest point in voxel if new point is stronger
   */
  replaceWeakestPoint(voxel, point, intensity, timestamp) {
    let weakestIndex = 0;
    let weakestIntensity = voxel.points[0].intensity;

    // Find point with lowest intensity
    for (let i = 1; i < voxel.points.length; i++) {
      if (voxel.points[i].intensity < weakestIntensity) {
        weakestIntensity = voxel.points[i].intensity;
        weakestIndex = i;
      }
    }

    // Replace if new point is stronger
    if (intensity > weakestIntensity) {
      voxel.points[weakestIndex] = {
        x: point.x,
        y: point.y,
        z: point.z,
        intensity: intensity,
        timestamp: timestamp,
      };

      this.updateVoxelStatistics(voxel, point, intensity, timestamp);
      return true;
    }

    return false;
  }

  /**
   * Update global bounds
   */
  updateBounds(point) {
    this.bounds.min.x = Math.min(this.bounds.min.x, point.x);
    this.bounds.min.y = Math.min(this.bounds.min.y, point.y);
    this.bounds.min.z = Math.min(this.bounds.min.z, point.z);

    this.bounds.max.x = Math.max(this.bounds.max.x, point.x);
    this.bounds.max.y = Math.max(this.bounds.max.y, point.y);
    this.bounds.max.z = Math.max(this.bounds.max.z, point.z);
  }

  /**
   * Perform periodic cleanup to manage memory
   */
  performCleanup() {
    const currentTime = performance.now();
    const maxAge = 300000; // 5 minutes
    let removedVoxels = 0;

    // Remove old voxels with low confidence
    for (const [key, voxel] of this.voxelGrid.entries()) {
      const age = currentTime - voxel.lastUpdateTime;
      if (age > maxAge && voxel.confidence < 0.3) {
        this.totalPoints -= voxel.points.length;
        this.voxelGrid.delete(key);
        removedVoxels++;
      }
    }

    if (removedVoxels > 0) {
      console.log(`Cleaned up ${removedVoxels} old voxels from map`);
    }
  }

  /**
   * Get accumulated map as Float32Array for export
   * @returns {Object} Map data with points array and metadata
   */
  getAccumulatedMap() {
    console.log(
      `PointCloudAccumulator: Getting accumulated map. Voxels: ${this.voxelGrid.size}, Total points: ${this.totalPoints}`
    );

    const allPoints = [];

    // Collect all points from all voxels
    for (const voxel of this.voxelGrid.values()) {
      for (const point of voxel.points) {
        allPoints.push(point.x, point.y, point.z, point.intensity);
      }
    }

    console.log(
      `PointCloudAccumulator: Collected ${allPoints.length / 4} points from ${
        this.voxelGrid.size
      } voxels`
    );

    return {
      points: new Float32Array(allPoints),
      pointCount: allPoints.length / 4,
      bounds: { ...this.bounds },
      voxelCount: this.voxelGrid.size,
      voxelSize: this.options.voxelSize,
      totalPoints: this.totalPoints,
    };
  }

  /**
   * Get map data optimized for visualization
   * @returns {Object} Visualization data with reduced point density
   */
  getVisualizationMap(maxPoints = 100000) {
    const allPoints = [];
    const step = Math.max(1, Math.floor(this.totalPoints / maxPoints));
    let pointIndex = 0;

    // Collect points with downsampling for visualization
    for (const voxel of this.voxelGrid.values()) {
      for (const point of voxel.points) {
        if (pointIndex % step === 0) {
          allPoints.push(point.x, point.y, point.z, point.intensity);
        }
        pointIndex++;
      }
    }

    return {
      points: new Float32Array(allPoints),
      pointCount: allPoints.length / 4,
      downsamplingFactor: step,
    };
  }

  /**
   * Get points within a specific region
   */
  getPointsInRegion(minBounds, maxBounds) {
    const regionPoints = [];

    for (const voxel of this.voxelGrid.values()) {
      // Quick voxel center check
      if (
        voxel.center.x >= minBounds.x &&
        voxel.center.x <= maxBounds.x &&
        voxel.center.y >= minBounds.y &&
        voxel.center.y <= maxBounds.y &&
        voxel.center.z >= minBounds.z &&
        voxel.center.z <= maxBounds.z
      ) {
        // Check individual points
        for (const point of voxel.points) {
          if (
            point.x >= minBounds.x &&
            point.x <= maxBounds.x &&
            point.y >= minBounds.y &&
            point.y <= maxBounds.y &&
            point.z >= minBounds.z &&
            point.z <= maxBounds.z
          ) {
            regionPoints.push(point);
          }
        }
      }
    }

    return regionPoints;
  }

  /**
   * Get current point count
   */
  getPointCount() {
    return this.totalPoints;
  }

  /**
   * Get voxel count
   */
  getVoxelCount() {
    return this.voxelGrid.size;
  }

  /**
   * Get map bounds
   */
  getBounds() {
    return { ...this.bounds };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    return {
      totalPoints: this.totalPoints,
      voxelCount: this.voxelGrid.size,
      estimatedMemoryMB: (this.totalPoints * 4 * 4) / (1024 * 1024), // 4 floats per point
      averagePointsPerVoxel: this.totalPoints / this.voxelGrid.size,
      voxelSize: this.options.voxelSize,
    };
  }

  /**
   * Finalize the map (prepare for export)
   */
  finalize() {
    // Perform final cleanup
    this.performCleanup();

    // Could add final optimization steps here
    console.log("Map finalized:", this.getMemoryStats());
  }
}
