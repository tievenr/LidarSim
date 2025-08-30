import * as THREE from "three";

/**
 * Transform utilities for SLAM operations
 * Provides coordinate transformations, pose interpolation, and geometric operations
 */
export class TransformUtils {
  constructor() {
    // Temporary objects for performance optimization
    this.tempVector3 = new THREE.Vector3();
    this.tempMatrix4 = new THREE.Matrix4();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempEuler = new THREE.Euler();
  }

  /**
   * Convert pose object to transformation matrix
   * @param {Object} pose - {x, y, z, roll, pitch, yaw}
   * @returns {THREE.Matrix4} Transformation matrix
   */
  poseToMatrix(pose) {
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Euler(
      pose.roll || 0,
      pose.pitch || 0,
      pose.yaw || 0,
      "XYZ"
    );

    matrix.makeRotationFromEuler(rotation);
    matrix.setPosition(pose.x || 0, pose.y || 0, pose.z || 0);

    return matrix;
  }

  /**
   * Convert transformation matrix to pose object
   * @param {THREE.Matrix4} matrix - Transformation matrix
   * @returns {Object} Pose {x, y, z, roll, pitch, yaw}
   */
  matrixToPose(matrix) {
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
   * Compose two transformations (T2 * T1)
   * @param {Object} pose1 - First pose
   * @param {Object} pose2 - Second pose
   * @returns {Object} Composed pose
   */
  composePoses(pose1, pose2) {
    const matrix1 = this.poseToMatrix(pose1);
    const matrix2 = this.poseToMatrix(pose2);

    const result = matrix2.multiply(matrix1);
    return this.matrixToPose(result);
  }

  /**
   * Get inverse of a pose transformation
   * @param {Object} pose - Input pose
   * @returns {Object} Inverse pose
   */
  inversePose(pose) {
    const matrix = this.poseToMatrix(pose);
    matrix.invert();
    return this.matrixToPose(matrix);
  }

  /**
   * Transform a point from one coordinate frame to another
   * @param {THREE.Vector3} point - Point to transform
   * @param {Object} pose - Transformation pose
   * @returns {THREE.Vector3} Transformed point
   */
  transformPoint(point, pose) {
    const matrix = this.poseToMatrix(pose);
    return point.clone().applyMatrix4(matrix);
  }

  /**
   * Transform multiple points efficiently
   * @param {Array<THREE.Vector3>} points - Points to transform
   * @param {Object} pose - Transformation pose
   * @returns {Array<THREE.Vector3>} Transformed points
   */
  transformPoints(points, pose) {
    const matrix = this.poseToMatrix(pose);
    return points.map((point) => point.clone().applyMatrix4(matrix));
  }

  /**
   * Transform a Float32Array of points [x,y,z,intensity,...]
   * @param {Float32Array} pointsArray - Points array
   * @param {Object} pose - Transformation pose
   * @returns {Float32Array} Transformed points array
   */
  transformPointsArray(pointsArray, pose) {
    const matrix = this.poseToMatrix(pose);
    const numPoints = pointsArray.length / 4;
    const transformed = new Float32Array(pointsArray.length);

    for (let i = 0; i < numPoints; i++) {
      const offset = i * 4;

      // Set temporary vector
      this.tempVector3.set(
        pointsArray[offset],
        pointsArray[offset + 1],
        pointsArray[offset + 2]
      );

      // Transform
      this.tempVector3.applyMatrix4(matrix);

      // Store result
      transformed[offset] = this.tempVector3.x;
      transformed[offset + 1] = this.tempVector3.y;
      transformed[offset + 2] = this.tempVector3.z;
      transformed[offset + 3] = pointsArray[offset + 3]; // Keep intensity
    }

    return transformed;
  }

  /**
   * Interpolate between two poses using SLERP for rotation
   * @param {Object} pose1 - Start pose
   * @param {Object} pose2 - End pose
   * @param {number} t - Interpolation factor [0, 1]
   * @returns {Object} Interpolated pose
   */
  interpolatePoses(pose1, pose2, t) {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // Linear interpolation for position
    const position = {
      x: pose1.x + t * (pose2.x - pose1.x),
      y: pose1.y + t * (pose2.y - pose1.y),
      z: pose1.z + t * (pose2.z - pose1.z),
    };

    // SLERP for rotation (convert to quaternions)
    const q1 = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pose1.roll, pose1.pitch, pose1.yaw, "XYZ")
    );
    const q2 = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pose2.roll, pose2.pitch, pose2.yaw, "XYZ")
    );

    const qInterp = q1.slerp(q2, t);
    const eulerInterp = new THREE.Euler().setFromQuaternion(qInterp, "XYZ");

    return {
      ...position,
      roll: eulerInterp.x,
      pitch: eulerInterp.y,
      yaw: eulerInterp.z,
    };
  }

  /**
   * Calculate distance between two poses
   * @param {Object} pose1 - First pose
   * @param {Object} pose2 - Second pose
   * @returns {Object} Distance metrics
   */
  poseDifference(pose1, pose2) {
    const translationDistance = Math.sqrt(
      Math.pow(pose2.x - pose1.x, 2) +
        Math.pow(pose2.y - pose1.y, 2) +
        Math.pow(pose2.z - pose1.z, 2)
    );

    // Calculate angular difference
    const rollDiff = this.normalizeAngle(pose2.roll - pose1.roll);
    const pitchDiff = this.normalizeAngle(pose2.pitch - pose1.pitch);
    const yawDiff = this.normalizeAngle(pose2.yaw - pose1.yaw);

    const rotationDistance = Math.sqrt(
      rollDiff * rollDiff + pitchDiff * pitchDiff + yawDiff * yawDiff
    );

    return {
      translation: translationDistance,
      rotation: rotationDistance,
      deltaX: pose2.x - pose1.x,
      deltaY: pose2.y - pose1.y,
      deltaZ: pose2.z - pose1.z,
      deltaRoll: rollDiff,
      deltaPitch: pitchDiff,
      deltaYaw: yawDiff,
    };
  }

  /**
   * Normalize angle to [-π, π] range
   * @param {number} angle - Angle in radians
   * @returns {number} Normalized angle
   */
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Convert degrees to radians
   * @param {number} degrees - Angle in degrees
   * @returns {number} Angle in radians
   */
  degToRad(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   * @param {number} radians - Angle in radians
   * @returns {number} Angle in degrees
   */
  radToDeg(radians) {
    return (radians * 180) / Math.PI;
  }

  /**
   * Create a pose from position and orientation
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {number} roll - Roll angle (radians)
   * @param {number} pitch - Pitch angle (radians)
   * @param {number} yaw - Yaw angle (radians)
   * @returns {Object} Pose object
   */
  createPose(x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0) {
    return { x, y, z, roll, pitch, yaw };
  }

  /**
   * Create identity pose (origin with no rotation)
   * @returns {Object} Identity pose
   */
  createIdentityPose() {
    return this.createPose(0, 0, 0, 0, 0, 0);
  }

  /**
   * Check if two poses are approximately equal
   * @param {Object} pose1 - First pose
   * @param {Object} pose2 - Second pose
   * @param {Object} tolerances - Tolerance values
   * @returns {boolean} True if poses are approximately equal
   */
  posesEqual(pose1, pose2, tolerances = {}) {
    const tol = {
      translation: 0.01, // 1cm
      rotation: 0.01, // ~0.57 degrees
      ...tolerances,
    };

    const diff = this.poseDifference(pose1, pose2);

    return diff.translation < tol.translation && diff.rotation < tol.rotation;
  }

  /**
   * Calculate relative pose between two poses (pose2 relative to pose1)
   * @param {Object} pose1 - Reference pose
   * @param {Object} pose2 - Target pose
   * @returns {Object} Relative pose
   */
  relativePose(pose1, pose2) {
    const invPose1 = this.inversePose(pose1);
    return this.composePoses(invPose1, pose2);
  }

  /**
   * Convert 2D pose (x, y, yaw) to 3D pose
   * @param {Object} pose2D - {x, y, yaw}
   * @param {number} z - Z position (default: 0)
   * @returns {Object} 3D pose
   */
  pose2DTo3D(pose2D, z = 0) {
    return {
      x: pose2D.x || 0,
      y: pose2D.y || 0,
      z: z,
      roll: 0,
      pitch: 0,
      yaw: pose2D.yaw || 0,
    };
  }

  /**
   * Convert 3D pose to 2D pose (project to XY plane)
   * @param {Object} pose3D - 3D pose
   * @returns {Object} 2D pose {x, y, yaw}
   */
  pose3DTo2D(pose3D) {
    return {
      x: pose3D.x || 0,
      y: pose3D.y || 0,
      yaw: pose3D.yaw || 0,
    };
  }

  /**
   * Create transformation matrix from translation and rotation vectors
   * @param {THREE.Vector3} translation - Translation vector
   * @param {THREE.Vector3} rotation - Rotation vector (Euler angles)
   * @returns {THREE.Matrix4} Transformation matrix
   */
  createTransformMatrix(translation, rotation) {
    const matrix = new THREE.Matrix4();
    const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, "XYZ");

    matrix.makeRotationFromEuler(euler);
    matrix.setPosition(translation);

    return matrix;
  }

  /**
   * Calculate transformation chain (T1 * T2 * ... * Tn)
   * @param {Array<Object>} poses - Array of poses to compose
   * @returns {Object} Final composed pose
   */
  composeTransformChain(poses) {
    if (poses.length === 0) return this.createIdentityPose();
    if (poses.length === 1) return { ...poses[0] };

    let result = poses[0];
    for (let i = 1; i < poses.length; i++) {
      result = this.composePoses(result, poses[i]);
    }

    return result;
  }

  /**
   * Transform a bounding box using a pose
   * @param {Object} bbox - {min: {x,y,z}, max: {x,y,z}}
   * @param {Object} pose - Transformation pose
   * @returns {Object} Transformed bounding box
   */
  transformBoundingBox(bbox, pose) {
    const corners = [
      new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
      new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
      new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
      new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
      new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
      new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
      new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
      new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
    ];

    const transformedCorners = this.transformPoints(corners, pose);

    // Find new bounding box
    const newMin = new THREE.Vector3(Infinity, Infinity, Infinity);
    const newMax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    for (const corner of transformedCorners) {
      newMin.min(corner);
      newMax.max(corner);
    }

    return {
      min: { x: newMin.x, y: newMin.y, z: newMin.z },
      max: { x: newMax.x, y: newMax.y, z: newMax.z },
    };
  }

  /**
   * Calculate velocity between two poses given time difference
   * @param {Object} pose1 - Initial pose
   * @param {Object} pose2 - Final pose
   * @param {number} deltaTime - Time difference in seconds
   * @returns {Object} Velocity {linear: {x,y,z}, angular: {x,y,z}}
   */
  calculateVelocity(pose1, pose2, deltaTime) {
    if (deltaTime <= 0) {
      return {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      };
    }

    const diff = this.poseDifference(pose1, pose2);

    return {
      linear: {
        x: diff.deltaX / deltaTime,
        y: diff.deltaY / deltaTime,
        z: diff.deltaZ / deltaTime,
      },
      angular: {
        x: diff.deltaRoll / deltaTime,
        y: diff.deltaPitch / deltaTime,
        z: diff.deltaYaw / deltaTime,
      },
    };
  }
}
