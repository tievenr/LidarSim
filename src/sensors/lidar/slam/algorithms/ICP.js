import * as THREE from "three";

/**
 * Iterative Closest Point (ICP) algorithm implementation
 * Provides robust point cloud registration for SLAM
 */
export class ICP {
  constructor(options = {}) {
    this.options = {
      maxIterations: 50,
      tolerance: 1e-6,
      maxCorrespondenceDistance: 1.0,
      minPointsForAlignment: 50,
      useNormalConstraints: false,
      enableOutlierRejection: true,
      outlierRejectionRatio: 0.8,
      convergenceRotationThreshold: 0.001, // radians
      convergenceTranslationThreshold: 0.01, // meters
      ...options,
    };

    this.statistics = {
      totalAlignments: 0,
      successfulAlignments: 0,
      averageIterations: 0,
      averageError: 0,
    };

    console.log("ICP initialized with options:", this.options);
  }

  /**
   * Register two point clouds using ICP
   * @param {Array<THREE.Vector3>} sourcePoints - Points to transform
   * @param {Array<THREE.Vector3>} targetPoints - Fixed reference points
   * @param {THREE.Matrix4} initialTransform - Initial transformation guess
   * @returns {Object} Registration result
   */
  register(sourcePoints, targetPoints, initialTransform = null) {
    this.statistics.totalAlignments++;

    if (!this.validateInputs(sourcePoints, targetPoints)) {
      return this.createFailureResult("Invalid input points");
    }

    try {
      const result = this.performRegistration(
        sourcePoints,
        targetPoints,
        initialTransform
      );

      if (result.success) {
        this.statistics.successfulAlignments++;
        this.updateStatistics(result);
      }

      return result;
    } catch (error) {
      console.error("ICP registration failed:", error);
      return this.createFailureResult(error.message);
    }
  }

  /**
   * Validate input point clouds
   */
  validateInputs(sourcePoints, targetPoints) {
    return (
      sourcePoints &&
      targetPoints &&
      sourcePoints.length >= this.options.minPointsForAlignment &&
      targetPoints.length >= this.options.minPointsForAlignment &&
      Array.isArray(sourcePoints) &&
      Array.isArray(targetPoints)
    );
  }

  /**
   * Perform the ICP registration process
   */
  performRegistration(sourcePoints, targetPoints, initialTransform) {
    // Initialize transformation
    let transformation = initialTransform
      ? initialTransform.clone()
      : new THREE.Matrix4().identity();
    let transformedPoints = this.transformPoints(sourcePoints, transformation);

    let previousError = Infinity;
    let iteration = 0;
    const convergenceHistory = [];

    while (iteration < this.options.maxIterations) {
      // Step 1: Find correspondences
      const correspondences = this.findCorrespondences(
        transformedPoints,
        targetPoints
      );

      if (correspondences.length < this.options.minPointsForAlignment / 2) {
        return this.createFailureResult("Insufficient correspondences found");
      }

      // Step 2: Reject outliers
      const filteredCorrespondences = this.options.enableOutlierRejection
        ? this.rejectOutliers(correspondences)
        : correspondences;

      if (filteredCorrespondences.length < 10) {
        return this.createFailureResult(
          "Too few correspondences after outlier rejection"
        );
      }

      // Step 3: Estimate transformation
      const deltaTransformation = this.estimateTransformation(
        filteredCorrespondences
      );

      if (!deltaTransformation) {
        return this.createFailureResult("Failed to estimate transformation");
      }

      // Step 4: Apply transformation
      transformation = transformation.multiply(deltaTransformation);
      transformedPoints = this.transformPoints(sourcePoints, transformation);

      // Step 5: Calculate error and check convergence
      const currentError = this.calculateMeanSquaredError(
        filteredCorrespondences
      );
      const deltaError = Math.abs(previousError - currentError);

      convergenceHistory.push({
        iteration,
        error: currentError,
        deltaError,
        correspondences: filteredCorrespondences.length,
      });

      // Check convergence
      if (this.checkConvergence(deltaTransformation, deltaError)) {
        return this.createSuccessResult(
          transformation,
          currentError,
          iteration + 1,
          convergenceHistory
        );
      }

      previousError = currentError;
      iteration++;
    }

    // Max iterations reached
    return this.createSuccessResult(
      transformation,
      previousError,
      iteration,
      convergenceHistory,
      false
    );
  }

  /**
   * Find nearest neighbor correspondences
   */
  findCorrespondences(sourcePoints, targetPoints) {
    const correspondences = [];
    const maxDistSq =
      this.options.maxCorrespondenceDistance *
      this.options.maxCorrespondenceDistance;

    for (let i = 0; i < sourcePoints.length; i++) {
      const sourcePoint = sourcePoints[i];
      let bestDistance = Infinity;
      let bestTargetIndex = -1;

      // Find closest target point
      for (let j = 0; j < targetPoints.length; j++) {
        const distSq = sourcePoint.distanceToSquared(targetPoints[j]);
        if (distSq < bestDistance && distSq < maxDistSq) {
          bestDistance = distSq;
          bestTargetIndex = j;
        }
      }

      if (bestTargetIndex !== -1) {
        correspondences.push({
          sourceIndex: i,
          targetIndex: bestTargetIndex,
          sourcePoint: sourcePoint,
          targetPoint: targetPoints[bestTargetIndex],
          distance: Math.sqrt(bestDistance),
        });
      }
    }

    return correspondences;
  }

  /**
   * Reject outlier correspondences using statistical methods
   */
  rejectOutliers(correspondences) {
    if (correspondences.length < 10) return correspondences;

    // Sort by distance
    const sortedCorrespondences = correspondences
      .slice()
      .sort((a, b) => a.distance - b.distance);

    // Keep only the best correspondences
    const keepCount = Math.floor(
      correspondences.length * this.options.outlierRejectionRatio
    );
    return sortedCorrespondences.slice(0, keepCount);
  }

  /**
   * Estimate transformation using Horn's method (closed-form solution)
   */
  estimateTransformation(correspondences) {
    if (correspondences.length < 3) return null;

    // Calculate centroids
    const sourceCentroid = new THREE.Vector3();
    const targetCentroid = new THREE.Vector3();

    for (const corr of correspondences) {
      sourceCentroid.add(corr.sourcePoint);
      targetCentroid.add(corr.targetPoint);
    }

    sourceCentroid.divideScalar(correspondences.length);
    targetCentroid.divideScalar(correspondences.length);

    // Calculate centered point sets
    const centeredSource = correspondences.map((c) =>
      c.sourcePoint.clone().sub(sourceCentroid)
    );
    const centeredTarget = correspondences.map((c) =>
      c.targetPoint.clone().sub(targetCentroid)
    );

    // Calculate cross-covariance matrix H = Σ(pi * qi^T)
    const H = new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);

    for (let i = 0; i < correspondences.length; i++) {
      const p = centeredSource[i];
      const q = centeredTarget[i];

      // Add outer product p * q^T to H
      H.elements[0] += p.x * q.x;
      H.elements[1] += p.x * q.y;
      H.elements[2] += p.x * q.z;
      H.elements[3] += p.y * q.x;
      H.elements[4] += p.y * q.y;
      H.elements[5] += p.y * q.z;
      H.elements[6] += p.z * q.x;
      H.elements[7] += p.z * q.y;
      H.elements[8] += p.z * q.z;
    }

    // For 2D LIDAR data, we primarily care about rotation around Z-axis
    // Simplified rotation estimation for Z-axis rotation
    const rotation = this.estimateZRotation(centeredSource, centeredTarget);

    // Calculate translation
    const rotatedCentroid = sourceCentroid
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
    const translation = targetCentroid.clone().sub(rotatedCentroid);

    // Create transformation matrix
    const transformation = new THREE.Matrix4();
    transformation.makeRotationZ(rotation);
    transformation.setPosition(translation);

    return transformation;
  }

  /**
   * Estimate rotation around Z-axis for 2D LIDAR data
   */
  estimateZRotation(sourcePoints, targetPoints) {
    let sumSin = 0;
    let sumCos = 0;

    for (let i = 0; i < sourcePoints.length; i++) {
      const p = sourcePoints[i];
      const q = targetPoints[i];

      // Calculate angle between vectors from origin
      const angleP = Math.atan2(p.y, p.x);
      const angleQ = Math.atan2(q.y, q.x);
      const deltaAngle = angleQ - angleP;

      sumSin += Math.sin(deltaAngle);
      sumCos += Math.cos(deltaAngle);
    }

    return Math.atan2(sumSin, sumCos);
  }

  /**
   * Transform points using transformation matrix
   */
  transformPoints(points, transformation) {
    return points.map((point) => point.clone().applyMatrix4(transformation));
  }

  /**
   * Calculate mean squared error between correspondences
   */
  calculateMeanSquaredError(correspondences) {
    if (correspondences.length === 0) return Infinity;

    let totalError = 0;
    for (const corr of correspondences) {
      totalError += corr.distance * corr.distance;
    }

    return Math.sqrt(totalError / correspondences.length);
  }

  /**
   * Check if algorithm has converged
   */
  checkConvergence(deltaTransformation, deltaError) {
    // Extract translation and rotation from delta transformation
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    deltaTransformation.decompose(position, quaternion, scale);

    const translationMagnitude = position.length();
    const rotationMagnitude = Math.abs(quaternion.w - 1.0) * 2; // Approximate rotation magnitude

    return (
      translationMagnitude < this.options.convergenceTranslationThreshold &&
      rotationMagnitude < this.options.convergenceRotationThreshold &&
      deltaError < this.options.tolerance
    );
  }

  /**
   * Create success result object
   */
  createSuccessResult(
    transformation,
    error,
    iterations,
    history,
    converged = true
  ) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    transformation.decompose(position, quaternion, scale);

    const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");

    return {
      success: true,
      converged,
      transformation,
      translation: { x: position.x, y: position.y, z: position.z },
      rotation: { x: euler.x, y: euler.y, z: euler.z },
      error,
      iterations,
      convergenceHistory: history,
      timestamp: Date.now(),
    };
  }

  /**
   * Create failure result object
   */
  createFailureResult(reason) {
    return {
      success: false,
      converged: false,
      transformation: new THREE.Matrix4().identity(),
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      error: Infinity,
      iterations: 0,
      reason,
      timestamp: Date.now(),
    };
  }

  /**
   * Update internal statistics
   */
  updateStatistics(result) {
    const currentAvgIterations = this.statistics.averageIterations;
    const currentAvgError = this.statistics.averageError;
    const successCount = this.statistics.successfulAlignments;

    this.statistics.averageIterations =
      (currentAvgIterations * (successCount - 1) + result.iterations) /
      successCount;

    this.statistics.averageError =
      (currentAvgError * (successCount - 1) + result.error) / successCount;
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      successRate:
        this.statistics.totalAlignments > 0
          ? this.statistics.successfulAlignments /
            this.statistics.totalAlignments
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      totalAlignments: 0,
      successfulAlignments: 0,
      averageIterations: 0,
      averageError: 0,
    };
  }

  /**
   * Configure algorithm parameters
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    console.log("ICP options updated:", this.options);
  }

  /**
   * Quick quality assessment of registration result
   */
  assessRegistrationQuality(result) {
    if (!result.success) return "failed";

    const { error, iterations, converged } = result;
    const maxError = this.options.maxCorrespondenceDistance;

    if (
      error < maxError * 0.1 &&
      converged &&
      iterations < this.options.maxIterations * 0.5
    ) {
      return "excellent";
    } else if (error < maxError * 0.3 && converged) {
      return "good";
    } else if (error < maxError * 0.6) {
      return "acceptable";
    } else {
      return "poor";
    }
  }
}
