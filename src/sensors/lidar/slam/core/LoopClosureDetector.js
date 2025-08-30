import * as THREE from "three";

/**
 * Loop closure detection for SLAM
 * Detects when the robot returns to previously visited locations
 */
export class LoopClosureDetector {
  constructor(options = {}) {
    this.options = {
      minLoopClosureDistance: 3.0, // Minimum distance for loop closure
      maxLoopClosureDistance: 20.0, // Maximum distance for loop closure
      minTimeBetweenClosures: 10000, // Minimum time between closures (ms)
      similarityThreshold: 0.7, // Minimum similarity score
      maxCandidates: 10, // Maximum candidates to consider
      featureExtractionRadius: 5.0, // Radius for feature extraction
      ...options,
    };

    // Store keyframe data for loop closure
    this.keyframes = [];
    this.loopClosures = [];
    this.lastClosureTime = 0;

    console.log("LoopClosureDetector initialized with options:", this.options);
  }

  /**
   * Add a new keyframe for loop closure detection
   * @param {Object} keyframe - Keyframe data
   */
  addKeyframe(keyframe) {
    const { pose, points, timestamp, scanId } = keyframe;

    // Extract features from the point cloud
    const features = this.extractFeatures(points, pose);

    const keyframeData = {
      id: scanId,
      pose: { ...pose },
      features: features,
      timestamp: timestamp,
      pointCount: points.length / 4, // Assuming [x,y,z,intensity] format
      boundingBox: this.computeBoundingBox(points),
    };

    this.keyframes.push(keyframeData);

    // Limit keyframes to prevent memory issues
    if (this.keyframes.length > 1000) {
      this.keyframes.shift(); // Remove oldest keyframe
    }

    // Check for potential loop closures
    return this.detectLoopClosure(keyframeData);
  }

  /**
   * Extract geometric features from point cloud
   * @param {Float32Array} points - Point cloud data
   * @param {Object} pose - Sensor pose
   * @returns {Array} Feature descriptors
   */
  extractFeatures(points, pose) {
    if (!points || points.length === 0) {
      console.warn("No points data provided for feature extraction");
      return [];
    }

    const features = [];
    const pointCount = points.length / 4;

    // Simple feature extraction: compute local surface normals and curvatures
    const kdtree = this.buildKDTree(points);

    for (let i = 0; i < Math.min(pointCount, 1000); i += 10) {
      // Sample every 10th point
      const point = this.getPoint(points, i);
      const neighbors = this.findNeighbors(
        kdtree,
        point,
        this.options.featureExtractionRadius
      );

      if (neighbors.length >= 10) {
        const normal = this.computeNormal(neighbors);
        const curvature = this.computeCurvature(neighbors, normal);

        features.push({
          position: point,
          normal: normal,
          curvature: curvature,
          density: neighbors.length,
        });
      }
    }

    return features;
  }

  /**
   * Build KD-tree for efficient neighbor search
   * @param {Float32Array} points - Point cloud data
   * @returns {Object} KD-tree structure
   */
  buildKDTree(points) {
    const pointCount = points.length / 4;
    const nodes = [];

    // Simple implementation - in production, use a proper KD-tree library
    for (let i = 0; i < pointCount; i++) {
      nodes.push({
        point: this.getPoint(points, i),
        index: i,
      });
    }

    return { nodes };
  }

  /**
   * Find neighboring points within radius
   * @param {Object} kdtree - KD-tree
   * @param {THREE.Vector3} point - Query point
   * @param {number} radius - Search radius
   * @returns {Array} Neighboring points
   */
  findNeighbors(kdtree, point, radius) {
    const neighbors = [];
    const radiusSq = radius * radius;

    for (const node of kdtree.nodes) {
      if (point.distanceToSquared(node.point) <= radiusSq) {
        neighbors.push(node.point);
      }
    }

    return neighbors;
  }

  /**
   * Compute surface normal from neighboring points
   * @param {Array} neighbors - Neighboring points
   * @returns {THREE.Vector3} Surface normal
   */
  computeNormal(neighbors) {
    if (neighbors.length < 3) return new THREE.Vector3(0, 0, 1);

    // Compute covariance matrix
    const centroid = new THREE.Vector3();
    for (const neighbor of neighbors) {
      centroid.add(neighbor);
    }
    centroid.divideScalar(neighbors.length);

    const covariance = new THREE.Matrix3();
    for (const neighbor of neighbors) {
      const diff = neighbor.clone().sub(centroid);
      covariance.elements[0] += diff.x * diff.x;
      covariance.elements[1] += diff.x * diff.y;
      covariance.elements[2] += diff.x * diff.z;
      covariance.elements[3] += diff.y * diff.x;
      covariance.elements[4] += diff.y * diff.y;
      covariance.elements[5] += diff.y * diff.z;
      covariance.elements[6] += diff.z * diff.x;
      covariance.elements[7] += diff.z * diff.y;
      covariance.elements[8] += diff.z * diff.z;
    }

    // Find eigenvector with smallest eigenvalue (normal direction)
    // Simplified: use cross product of first two vectors
    if (neighbors.length >= 2) {
      const v1 = neighbors[1].clone().sub(neighbors[0]);
      const v2 = neighbors[2]
        ? neighbors[2].clone().sub(neighbors[0])
        : new THREE.Vector3(0, 0, 1);
      const normal = v1.cross(v2).normalize();
      return normal;
    }

    return new THREE.Vector3(0, 0, 1);
  }

  /**
   * Compute surface curvature
   * @param {Array} neighbors - Neighboring points
   * @param {THREE.Vector3} normal - Surface normal
   * @returns {number} Curvature value
   */
  computeCurvature(neighbors, normal) {
    if (neighbors.length < 5) return 0;

    // Simplified curvature estimation
    let totalCurvature = 0;
    const centroid = new THREE.Vector3();

    for (const neighbor of neighbors) {
      centroid.add(neighbor);
    }
    centroid.divideScalar(neighbors.length);

    for (const neighbor of neighbors) {
      const diff = neighbor.clone().sub(centroid);
      const projection = diff.dot(normal);
      totalCurvature += Math.abs(projection);
    }

    return totalCurvature / neighbors.length;
  }

  /**
   * Get point from Float32Array
   * @param {Float32Array} points - Point cloud data
   * @param {number} index - Point index
   * @returns {THREE.Vector3} Point
   */
  getPoint(points, index) {
    const offset = index * 4;
    return new THREE.Vector3(
      points[offset],
      points[offset + 1],
      points[offset + 2]
    );
  }

  /**
   * Compute bounding box of point cloud
   * @param {Float32Array} points - Point cloud data
   * @returns {Object} Bounding box
   */
  computeBoundingBox(points) {
    const pointCount = points.length / 4;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    for (let i = 0; i < pointCount; i++) {
      const point = this.getPoint(points, i);
      min.min(point);
      max.max(point);
    }

    return { min, max };
  }

  /**
   * Detect potential loop closures
   * @param {Object} currentKeyframe - Current keyframe
   * @returns {Array} Detected loop closures
   */
  detectLoopClosure(currentKeyframe) {
    const candidates = this.findLoopClosureCandidates(currentKeyframe);
    const closures = [];

    for (const candidate of candidates) {
      const similarity = this.computeSimilarity(currentKeyframe, candidate);

      if (similarity >= this.options.similarityThreshold) {
        const closure = {
          fromKeyframe: candidate.id,
          toKeyframe: currentKeyframe.id,
          similarity: similarity,
          relativePose: this.computeRelativePose(
            candidate.pose,
            currentKeyframe.pose
          ),
          timestamp: currentKeyframe.timestamp,
        };

        closures.push(closure);
        this.loopClosures.push(closure);
      }
    }

    return closures;
  }

  /**
   * Find potential loop closure candidates
   * @param {Object} currentKeyframe - Current keyframe
   * @returns {Array} Candidate keyframes
   */
  findLoopClosureCandidates(currentKeyframe) {
    const candidates = [];
    const currentTime = currentKeyframe.timestamp;

    for (const keyframe of this.keyframes.slice(0, -1)) {
      // Exclude current keyframe
      // Check time constraint
      if (
        currentTime - keyframe.timestamp <
        this.options.minTimeBetweenClosures
      ) {
        continue;
      }

      // Check distance constraint
      const distance = this.computePoseDistance(
        currentKeyframe.pose,
        keyframe.pose
      );
      if (
        distance >= this.options.minLoopClosureDistance &&
        distance <= this.options.maxLoopClosureDistance
      ) {
        candidates.push(keyframe);
      }

      // Limit candidates
      if (candidates.length >= this.options.maxCandidates) {
        break;
      }
    }

    return candidates;
  }

  /**
   * Compute distance between two poses
   * @param {Object} pose1 - First pose
   * @param {Object} pose2 - Second pose
   * @returns {number} Distance
   */
  computePoseDistance(pose1, pose2) {
    const dx = pose1.x - pose2.x;
    const dy = pose1.y - pose2.y;
    const dz = pose1.z - pose2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Compute similarity between two keyframes
   * @param {Object} keyframe1 - First keyframe
   * @param {Object} keyframe2 - Second keyframe
   * @returns {number} Similarity score [0, 1]
   */
  computeSimilarity(keyframe1, keyframe2) {
    // Feature-based similarity
    const features1 = keyframe1.features;
    const features2 = keyframe2.features;

    if (features1.length === 0 || features2.length === 0) {
      return 0;
    }

    // Simple feature matching
    let totalSimilarity = 0;
    let matchCount = 0;

    for (const feature1 of features1) {
      let bestMatch = 0;

      for (const feature2 of features2) {
        const distance = feature1.position.distanceTo(feature2.position);
        if (distance < 1.0) {
          // Feature correspondence threshold
          const normalSimilarity = Math.abs(
            feature1.normal.dot(feature2.normal)
          );
          const curvatureSimilarity =
            1 - Math.abs(feature1.curvature - feature2.curvature);
          const similarity = (normalSimilarity + curvatureSimilarity) / 2;
          bestMatch = Math.max(bestMatch, similarity);
        }
      }

      totalSimilarity += bestMatch;
      matchCount++;
    }

    return matchCount > 0 ? totalSimilarity / matchCount : 0;
  }

  /**
   * Compute relative pose between two keyframes
   * @param {Object} fromPose - Source pose
   * @param {Object} toPose - Target pose
   * @returns {Object} Relative pose
   */
  computeRelativePose(fromPose, toPose) {
    return {
      x: toPose.x - fromPose.x,
      y: toPose.y - fromPose.y,
      z: toPose.z - fromPose.z,
      roll: toPose.roll - fromPose.roll,
      pitch: toPose.pitch - fromPose.pitch,
      yaw: toPose.yaw - fromPose.yaw,
    };
  }

  /**
   * Get all detected loop closures
   * @returns {Array} Loop closures
   */
  getLoopClosures() {
    return [...this.loopClosures];
  }

  /**
   * Get keyframes
   * @returns {Array} Keyframes
   */
  getKeyframes() {
    return [...this.keyframes];
  }

  /**
   * Reset loop closure detector
   */
  reset() {
    this.keyframes = [];
    this.loopClosures = [];
    this.lastClosureTime = 0;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      totalKeyframes: this.keyframes.length,
      totalLoopClosures: this.loopClosures.length,
      lastLoopClosureTime: this.lastClosureTime,
      averageConfidence:
        this.loopClosures.length > 0
          ? this.loopClosures.reduce((sum, lc) => sum + lc.similarity, 0) /
            this.loopClosures.length
          : 0,
    };
  }

  /**
   * Export loop closure data for debugging
   * @returns {Object} Loop closure data
   */
  exportData() {
    return {
      keyframes: this.keyframes.map((kf) => ({
        id: kf.id,
        pose: kf.pose,
        timestamp: kf.timestamp,
        pointCount: kf.pointCount,
        featureCount: kf.features.length,
      })),
      loopClosures: this.loopClosures,
      options: this.options,
      statistics: this.getStatistics(),
    };
  }
}
