import * as THREE from "three";

/**
 * Scan matching algorithms for SLAM
 * Provides frame-to-frame alignment using ICP and other techniques
 */
export class ScanMatching {
  constructor(options = {}) {
    this.options = {
      maxIterations: 20,
      tolerance: 1e-6,
      maxCorrespondenceDistance: 2.0,
      minPointsForMatching: 100,
      downsampleFactor: 2, // Use every Nth point for speed
      useNormalConstraints: false,
      outlierRejectionEnabled: true,
      outlierThreshold: 1.5,
      ...options,
    };

    console.log("ScanMatching initialized with options:", this.options);
  }

  /**
   * Align two point scans using ICP
   * @param {Float32Array} sourcePoints - Current scan points [x,y,z,intensity,...]
   * @param {Float32Array} targetPoints - Reference scan points [x,y,z,intensity,...]
   * @param {Object} initialGuess - Initial pose estimate {x,y,z,roll,pitch,yaw}
   * @returns {Object|null} Transformation result or null if failed
   */
  alignScans(sourcePoints, targetPoints, initialGuess = null) {
    if (
      !sourcePoints ||
      !targetPoints ||
      sourcePoints.length < this.options.minPointsForMatching * 4 ||
      targetPoints.length < this.options.minPointsForMatching * 4
    ) {
      return null;
    }

    try {
      // Downsample points for performance
      const sourceSample = this.downsamplePoints(sourcePoints);
      const targetSample = this.downsamplePoints(targetPoints);

      // Convert to Vector3 arrays
      const sourceVectors = this.pointsToVectors(sourceSample);
      const targetVectors = this.pointsToVectors(targetSample);

      // Perform ICP alignment
      const result = this.performICP(
        sourceVectors,
        targetVectors,
        initialGuess
      );

      return result;
    } catch (error) {
      console.warn("Scan matching failed:", error);
      return null;
    }
  }

  /**
   * Downsample points for faster processing
   */
  downsamplePoints(points) {
    const factor = this.options.downsampleFactor;
    if (factor <= 1) return points;

    const numPoints = points.length / 4;
    const downsampledSize = Math.floor(numPoints / factor) * 4;
    const downsampled = new Float32Array(downsampledSize);

    let outputIndex = 0;
    for (let i = 0; i < numPoints; i += factor) {
      const inputIndex = i * 4;
      downsampled[outputIndex] = points[inputIndex]; // x
      downsampled[outputIndex + 1] = points[inputIndex + 1]; // y
      downsampled[outputIndex + 2] = points[inputIndex + 2]; // z
      downsampled[outputIndex + 3] = points[inputIndex + 3]; // intensity
      outputIndex += 4;
    }

    return downsampled;
  }

  /**
   * Convert Float32Array to Vector3 array
   */
  pointsToVectors(points) {
    const vectors = [];
    for (let i = 0; i < points.length; i += 4) {
      vectors.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
    }
    return vectors;
  }

  /**
   * Perform Iterative Closest Point (ICP) algorithm
   */
  performICP(sourcePoints, targetPoints, initialGuess) {
    // Initialize transformation matrix
    let transformation = this.createInitialTransformation(initialGuess);
    let transformedSource = this.transformPoints(sourcePoints, transformation);

    let lastError = Infinity;
    let iteration = 0;

    while (iteration < this.options.maxIterations) {
      // Find correspondences
      const correspondences = this.findCorrespondences(
        transformedSource,
        targetPoints
      );

      if (correspondences.length < this.options.minPointsForMatching / 2) {
        console.warn("Too few correspondences found for ICP");
        break;
      }

      // Calculate transformation
      const deltaTransformation = this.calculateTransformation(correspondences);

      if (!deltaTransformation) {
        break;
      }

      // Apply transformation
      transformation = transformation.multiply(deltaTransformation);
      transformedSource = this.transformPoints(sourcePoints, transformation);

      // Calculate alignment error
      const currentError = this.calculateAlignmentError(correspondences);

      // Check for convergence
      if (Math.abs(lastError - currentError) < this.options.tolerance) {
        break;
      }

      lastError = currentError;
      iteration++;
    }

    // Extract pose from transformation matrix
    const pose = this.extractPoseFromMatrix(transformation);

    return {
      transformation: transformation,
      translation: { x: pose.x, y: pose.y, z: pose.z },
      rotation: { x: pose.roll, y: pose.pitch, z: pose.yaw },
      error: lastError,
      iterations: iteration,
      success: lastError < this.options.maxCorrespondenceDistance,
    };
  }

  /**
   * Create initial transformation matrix
   */
  createInitialTransformation(initialGuess) {
    if (!initialGuess) {
      return new THREE.Matrix4().identity();
    }

    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Euler(
      initialGuess.roll || 0,
      initialGuess.pitch || 0,
      initialGuess.yaw || 0,
      "XYZ"
    );

    matrix.makeRotationFromEuler(rotation);
    matrix.setPosition(
      initialGuess.x || 0,
      initialGuess.y || 0,
      initialGuess.z || 0
    );

    return matrix;
  }

  /**
   * Transform points using transformation matrix
   */
  transformPoints(points, transformation) {
    return points.map((point) => point.clone().applyMatrix4(transformation));
  }

  /**
   * Find correspondences between source and target points
   */
  findCorrespondences(sourcePoints, targetPoints) {
    const correspondences = [];
    const maxDistSq =
      this.options.maxCorrespondenceDistance *
      this.options.maxCorrespondenceDistance;

    for (const sourcePoint of sourcePoints) {
      let bestDistance = Infinity;
      let bestTarget = null;

      // Find closest target point
      for (const targetPoint of targetPoints) {
        const distSq = sourcePoint.distanceToSquared(targetPoint);
        if (distSq < bestDistance && distSq < maxDistSq) {
          bestDistance = distSq;
          bestTarget = targetPoint;
        }
      }

      if (bestTarget) {
        correspondences.push({
          source: sourcePoint,
          target: bestTarget,
          distance: Math.sqrt(bestDistance),
        });
      }
    }

    // Outlier rejection
    if (this.options.outlierRejectionEnabled) {
      return this.rejectOutliers(correspondences);
    }

    return correspondences;
  }

  /**
   * Reject outlier correspondences
   */
  rejectOutliers(correspondences) {
    if (correspondences.length < 10) return correspondences;

    // Calculate median distance
    const distances = correspondences
      .map((c) => c.distance)
      .sort((a, b) => a - b);
    const median = distances[Math.floor(distances.length / 2)];
    const threshold = median * this.options.outlierThreshold;

    return correspondences.filter((c) => c.distance <= threshold);
  }

  /**
   * Calculate transformation from correspondences using least squares
   */
  calculateTransformation(correspondences) {
    if (correspondences.length < 3) return null;

    // Calculate centroids
    const sourceCentroid = new THREE.Vector3();
    const targetCentroid = new THREE.Vector3();

    for (const corr of correspondences) {
      sourceCentroid.add(corr.source);
      targetCentroid.add(corr.target);
    }

    sourceCentroid.divideScalar(correspondences.length);
    targetCentroid.divideScalar(correspondences.length);

    // Calculate centered points
    const centeredSource = correspondences.map((c) =>
      c.source.clone().sub(sourceCentroid)
    );
    const centeredTarget = correspondences.map((c) =>
      c.target.clone().sub(targetCentroid)
    );

    // Calculate cross-covariance matrix
    const H = new THREE.Matrix3();
    for (let i = 0; i < correspondences.length; i++) {
      const s = centeredSource[i];
      const t = centeredTarget[i];

      // H += s * t^T (outer product)
      H.elements[0] += s.x * t.x;
      H.elements[1] += s.x * t.y;
      H.elements[2] += s.x * t.z;
      H.elements[3] += s.y * t.x;
      H.elements[4] += s.y * t.y;
      H.elements[5] += s.y * t.z;
      H.elements[6] += s.z * t.x;
      H.elements[7] += s.z * t.y;
      H.elements[8] += s.z * t.z;
    }

    // For simplicity, use a basic rotation estimation
    // In a full implementation, you would use SVD to find optimal rotation
    const translation = targetCentroid.clone().sub(sourceCentroid);

    // Create transformation matrix
    const transformation = new THREE.Matrix4();
    transformation.makeTranslation(translation.x, translation.y, translation.z);

    return transformation;
  }

  /**
   * Calculate alignment error from correspondences
   */
  calculateAlignmentError(correspondences) {
    if (correspondences.length === 0) return Infinity;

    let totalError = 0;
    for (const corr of correspondences) {
      totalError += corr.distance * corr.distance;
    }

    return Math.sqrt(totalError / correspondences.length);
  }

  /**
   * Extract pose from transformation matrix
   */
  extractPoseFromMatrix(matrix) {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    matrix.decompose(position, quaternion, scale);

    const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");

    return {
      x: position.x,
      y: position.y,
      z: position.z,
      roll: euler.x,
      pitch: euler.y,
      yaw: euler.z,
    };
  }

  /**
   * Estimate odometry between consecutive scans
   */
  estimateOdometry(currentScan, previousScan) {
    const result = this.alignScans(currentScan, previousScan);

    if (result && result.success) {
      return {
        deltaX: result.translation.x,
        deltaY: result.translation.y,
        deltaZ: result.translation.z,
        deltaRoll: result.rotation.x,
        deltaPitch: result.rotation.y,
        deltaYaw: result.rotation.z,
        confidence: Math.max(
          0,
          1 - result.error / this.options.maxCorrespondenceDistance
        ),
      };
    }

    return null;
  }

  /**
   * Quick correspondence check for scan matching viability
   */
  checkScanCompatibility(scan1, scan2) {
    if (!scan1 || !scan2 || scan1.length < 400 || scan2.length < 400) {
      return false;
    }

    // Quick overlap check by comparing point distributions
    const sample1 = this.downsamplePoints(
      scan1.slice(0, Math.min(400, scan1.length))
    );
    const sample2 = this.downsamplePoints(
      scan2.slice(0, Math.min(400, scan2.length))
    );

    const vectors1 = this.pointsToVectors(sample1);
    const vectors2 = this.pointsToVectors(sample2);

    // Check if scans have reasonable overlap
    let closePoints = 0;
    const sampleSize = Math.min(vectors1.length, vectors2.length, 50);

    for (let i = 0; i < sampleSize; i++) {
      const point1 = vectors1[i];
      let foundClose = false;

      for (let j = 0; j < Math.min(vectors2.length, 20); j++) {
        if (
          point1.distanceTo(vectors2[j]) <
          this.options.maxCorrespondenceDistance * 2
        ) {
          foundClose = true;
          break;
        }
      }

      if (foundClose) closePoints++;
    }

    return closePoints / sampleSize > 0.3; // At least 30% overlap
  }
}
