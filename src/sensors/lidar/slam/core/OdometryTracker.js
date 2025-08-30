import * as THREE from "three";

/**
 * Tracks vehicle odometry and pose estimation over time
 * Maintains pose history and provides trajectory information
 */
export class OdometryTracker {
  constructor() {
    this.reset();
  }

  /**
   * Reset the odometry tracker
   */
  reset() {
    this.currentPose = {
      x: 0,
      y: 0,
      z: 0,
      roll: 0,
      pitch: 0,
      yaw: 0,
    };
    this.previousPose = { ...this.currentPose };
    this.poseHistory = [];
    this.velocity = {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 },
    };
    this.totalDistance = 0;
    this.lastUpdateTime = 0;

    // Add initial pose to history
    this.poseHistory.push({
      ...this.currentPose,
      timestamp: performance.now(),
      confidence: 1.0,
    });
  }

  /**
   * Update current pose with new measurement
   * @param {Object} newPose - New pose {x, y, z, roll, pitch, yaw}
   * @param {number} timestamp - Measurement timestamp
   */
  updatePose(newPose, timestamp = performance.now()) {
    // Store previous pose
    this.previousPose = { ...this.currentPose };
    const previousTime = this.lastUpdateTime;

    // Update current pose
    this.currentPose = { ...newPose };
    this.lastUpdateTime = timestamp;

    // Calculate velocity if we have a previous measurement
    if (previousTime > 0) {
      const deltaTime = (timestamp - previousTime) / 1000; // Convert to seconds
      if (deltaTime > 0) {
        this.updateVelocity(deltaTime);
        this.updateDistance();
      }
    }

    // Add to pose history
    this.poseHistory.push({
      ...this.currentPose,
      timestamp: timestamp,
      confidence: 1.0, // Default confidence, can be updated by scan matching
    });

    // Limit history size to prevent memory issues
    if (this.poseHistory.length > 10000) {
      this.poseHistory.shift();
    }
  }

  /**
   * Correct the current pose based on scan matching results
   * @param {Object} correctedPose - Corrected pose
   * @param {number} timestamp - Correction timestamp
   * @param {number} confidence - Confidence in the correction (0-1)
   */
  correctPose(correctedPose, timestamp = performance.now(), confidence = 0.8) {
    // Update current pose with correction
    this.currentPose = { ...correctedPose };

    // Update the most recent pose in history with corrected values
    if (this.poseHistory.length > 0) {
      const lastPose = this.poseHistory[this.poseHistory.length - 1];
      lastPose.x = correctedPose.x;
      lastPose.y = correctedPose.y;
      lastPose.z = correctedPose.z;
      lastPose.roll = correctedPose.roll;
      lastPose.pitch = correctedPose.pitch;
      lastPose.yaw = correctedPose.yaw;
      lastPose.confidence = confidence;
      lastPose.corrected = true;
    }
  }

  /**
   * Calculate velocity based on pose change
   */
  updateVelocity(deltaTime) {
    // Linear velocity
    this.velocity.linear.x =
      (this.currentPose.x - this.previousPose.x) / deltaTime;
    this.velocity.linear.y =
      (this.currentPose.y - this.previousPose.y) / deltaTime;
    this.velocity.linear.z =
      (this.currentPose.z - this.previousPose.z) / deltaTime;

    // Angular velocity (handle angle wrapping)
    this.velocity.angular.x =
      this.normalizeAngleDifference(
        this.currentPose.roll - this.previousPose.roll
      ) / deltaTime;
    this.velocity.angular.y =
      this.normalizeAngleDifference(
        this.currentPose.pitch - this.previousPose.pitch
      ) / deltaTime;
    this.velocity.angular.z =
      this.normalizeAngleDifference(
        this.currentPose.yaw - this.previousPose.yaw
      ) / deltaTime;
  }

  /**
   * Update total distance traveled
   */
  updateDistance() {
    const dx = this.currentPose.x - this.previousPose.x;
    const dy = this.currentPose.y - this.previousPose.y;
    const dz = this.currentPose.z - this.previousPose.z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.totalDistance += distance;
  }

  /**
   * Normalize angle difference to [-π, π]
   */
  normalizeAngleDifference(angleDiff) {
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    return angleDiff;
  }

  /**
   * Get current pose
   */
  getCurrentPose() {
    return { ...this.currentPose };
  }

  /**
   * Get previous pose
   */
  getPreviousPose() {
    return { ...this.previousPose };
  }

  /**
   * Get current velocity
   */
  getVelocity() {
    return { ...this.velocity };
  }

  /**
   * Get total distance traveled
   */
  getTotalDistance() {
    return this.totalDistance;
  }

  /**
   * Get complete pose history
   */
  getPoseHistory() {
    return [...this.poseHistory];
  }

  /**
   * Update the entire pose history (used after pose graph optimization)
   * @param {Array} newTrajectory - New pose history
   */
  updateTrajectory(newTrajectory) {
    this.poseHistory = [...newTrajectory];

    // Update current pose to the last pose in the trajectory
    if (this.poseHistory.length > 0) {
      this.currentPose = { ...this.poseHistory[this.poseHistory.length - 1] };
    }

    // Recalculate total distance
    this.recalculateTotalDistance();

    console.log(`Trajectory updated with ${newTrajectory.length} poses`);
  }

  /**
   * Recalculate total distance traveled from pose history
   */
  recalculateTotalDistance() {
    this.totalDistance = 0;

    for (let i = 1; i < this.poseHistory.length; i++) {
      const prevPose = this.poseHistory[i - 1];
      const currentPose = this.poseHistory[i];

      const dx = currentPose.x - prevPose.x;
      const dy = currentPose.y - prevPose.y;
      const dz = currentPose.z - prevPose.z;

      this.totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }

  /**
   * Get pose at specific timestamp (interpolated if necessary)
   * @param {number} timestamp - Target timestamp
   */
  getPoseAtTime(timestamp) {
    if (this.poseHistory.length === 0) {
      return null;
    }

    // Find the two poses that bracket the target timestamp
    let beforeIndex = -1;
    let afterIndex = -1;

    for (let i = 0; i < this.poseHistory.length; i++) {
      if (this.poseHistory[i].timestamp <= timestamp) {
        beforeIndex = i;
      } else {
        afterIndex = i;
        break;
      }
    }

    // If timestamp is before all poses, return first pose
    if (beforeIndex === -1) {
      return { ...this.poseHistory[0] };
    }

    // If timestamp is after all poses, return last pose
    if (afterIndex === -1) {
      return { ...this.poseHistory[this.poseHistory.length - 1] };
    }

    // If we have exact match, return it
    if (this.poseHistory[beforeIndex].timestamp === timestamp) {
      return { ...this.poseHistory[beforeIndex] };
    }

    // Interpolate between the two poses
    const beforePose = this.poseHistory[beforeIndex];
    const afterPose = this.poseHistory[afterIndex];

    const timeDiff = afterPose.timestamp - beforePose.timestamp;
    const targetOffset = timestamp - beforePose.timestamp;
    const alpha = targetOffset / timeDiff;

    return {
      x: this.lerp(beforePose.x, afterPose.x, alpha),
      y: this.lerp(beforePose.y, afterPose.y, alpha),
      z: this.lerp(beforePose.z, afterPose.z, alpha),
      roll: this.lerpAngle(beforePose.roll, afterPose.roll, alpha),
      pitch: this.lerpAngle(beforePose.pitch, afterPose.pitch, alpha),
      yaw: this.lerpAngle(beforePose.yaw, afterPose.yaw, alpha),
      timestamp: timestamp,
      confidence: Math.min(beforePose.confidence, afterPose.confidence),
      interpolated: true,
    };
  }

  /**
   * Linear interpolation
   */
  lerp(a, b, alpha) {
    return a + (b - a) * alpha;
  }

  /**
   * Angle interpolation (handles wrapping)
   */
  lerpAngle(a, b, alpha) {
    const diff = this.normalizeAngleDifference(b - a);
    return a + diff * alpha;
  }

  /**
   * Get trajectory as array of 3D points for visualization
   */
  getTrajectoryPoints() {
    return this.poseHistory.map((pose) => ({
      x: pose.x,
      y: pose.y,
      z: pose.z,
      timestamp: pose.timestamp,
      confidence: pose.confidence,
    }));
  }

  /**
   * Get trajectory statistics
   */
  getTrajectoryStatistics() {
    if (this.poseHistory.length < 2) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        duration: 0,
        pointCount: this.poseHistory.length,
      };
    }

    const startTime = this.poseHistory[0].timestamp;
    const endTime = this.poseHistory[this.poseHistory.length - 1].timestamp;
    const duration = (endTime - startTime) / 1000; // seconds

    // Calculate speeds between consecutive poses
    const speeds = [];
    for (let i = 1; i < this.poseHistory.length; i++) {
      const prev = this.poseHistory[i - 1];
      const curr = this.poseHistory[i];

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dz = curr.z - prev.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const dt = (curr.timestamp - prev.timestamp) / 1000;
      if (dt > 0) {
        speeds.push(distance / dt);
      }
    }

    const averageSpeed =
      speeds.length > 0
        ? speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length
        : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    return {
      totalDistance: this.totalDistance,
      averageSpeed: averageSpeed,
      maxSpeed: maxSpeed,
      duration: duration,
      pointCount: this.poseHistory.length,
    };
  }
}
