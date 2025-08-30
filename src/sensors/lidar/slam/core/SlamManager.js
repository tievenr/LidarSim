import { OdometryTracker } from "./OdometryTracker.js";
import { PointCloudAccumulator } from "./PointCloudAccumulator.js";
import { ScanMatching } from "../algorithms/ScanMatching.js";
import { SlamExporter } from "../utils/SlamExporter.js";
import { LoopClosureDetector } from "./LoopClosureDetector.js";
import { PoseGraphOptimizer } from "../algorithms/PoseGraphOptimizer.js";
import * as THREE from "three";

/**
 * Main SLAM coordinator that orchestrates the entire SLAM pipeline
 * Handles scan processing, pose estimation, and map building
 */
export class SlamManager {
  constructor(options = {}) {
    this.options = {
      voxelSize: 0.1, // 10cm voxels for map storage
      maxMapPoints: 1000000, // Maximum points in global map
      scanMatchingEnabled: true, // Enable scan-to-scan matching
      loopClosureEnabled: true, // Enable loop closure detection
      poseGraphOptimizationEnabled: true, // Enable pose graph optimization
      submapSize: 5000, // Points per submap
      maxSubmaps: 50, // Maximum number of submaps
      ...options,
    };

    // Core SLAM components
    this.odometryTracker = new OdometryTracker();
    this.pointCloudAccumulator = new PointCloudAccumulator(this.options);
    this.scanMatcher = new ScanMatching();

    // Advanced SLAM components
    this.loopClosureDetector = new LoopClosureDetector({
      minKeyframeDistance: 2.0, // Minimum distance between keyframes
      maxKeyframeDistance: 10.0, // Maximum distance for loop closure
      similarityThreshold: 0.7, // Similarity threshold for loop closure
      minLoopClosureDistance: 5.0, // Minimum distance for loop closure
    });

    this.poseGraphOptimizer = new PoseGraphOptimizer({
      maxIterations: 50,
      convergenceThreshold: 1e-4,
      dampingFactor: 0.01,
    });

    // SLAM state
    this.isRunning = false;
    this.scanCount = 0;
    this.lastScanTime = 0;
    this.processingStats = {
      totalScansProcessed: 0,
      totalPointsAccumulated: 0,
      averageProcessingTime: 0,
      trajectoryLength: 0,
      mapSizeMB: 0,
    };

    // Store recent scans for scan matching
    this.recentScans = [];
    this.maxRecentScans = 5;

    console.log("SlamManager initialized with options:", this.options);
  }

  /**
   * Start SLAM processing
   */
  start() {
    if (this.isRunning) {
      console.warn("SLAM is already running");
      return;
    }

    this.isRunning = true;
    this.scanCount = 0;
    this.lastScanTime = performance.now();

    // Reset components but preserve accumulated map if it exists
    this.odometryTracker.reset();
    // Only reset point cloud accumulator if it's truly empty (no voxels)
    if (this.pointCloudAccumulator.getVoxelCount() === 0) {
      this.pointCloudAccumulator.reset();
    }
    this.loopClosureDetector.reset();
    this.poseGraphOptimizer.reset();
    this.recentScans = [];

    // Reset statistics but preserve point count if we have actual points
    const existingPoints = this.pointCloudAccumulator.getTotalPoints();
    this.processingStats = {
      totalScansProcessed: 0,
      totalPointsAccumulated: existingPoints, // Use actual point count from accumulator
      averageProcessingTime: 0,
      trajectoryLength: 0,
      mapSizeMB: 0,
    };

    console.log(
      "SLAM started",
      existingPoints > 0 ? `(preserving ${existingPoints} existing points)` : ""
    );
    return true;
  }

  /**
   * Stop SLAM processing
   */
  stop() {
    if (!this.isRunning) {
      console.warn("SLAM is not running");
      return;
    }

    this.isRunning = false;

    // Finalize the mapping session
    this.pointCloudAccumulator.finalize();

    console.log("SLAM stopped. Final stats:", this.getStatistics());
    return true;
  }

  /**
   * Process a new LIDAR scan
   * @param {Float32Array} pointsData - Array of [x, y, z, intensity] points
   * @param {Object} sensorPose - Current sensor pose {x, y, z, roll, pitch, yaw}
   * @param {number} timestamp - Scan timestamp
   */
  processScan(pointsData, sensorPose, timestamp = performance.now()) {
    if (!this.isRunning) return;

    const processingStartTime = performance.now();

    try {
      // 1. Update odometry with current pose
      this.odometryTracker.updatePose(sensorPose, timestamp);

      // 2. Perform scan matching if enabled and we have previous scans
      let correctedPose = { ...sensorPose };
      if (this.options.scanMatchingEnabled && this.recentScans.length > 0) {
        const lastScan = this.recentScans[this.recentScans.length - 1];
        const poseCorrection = this.scanMatcher.alignScans(
          pointsData,
          lastScan.points,
          sensorPose
        );

        if (poseCorrection) {
          correctedPose = this.applyCorrectionToPose(
            sensorPose,
            poseCorrection
          );
          this.odometryTracker.correctPose(correctedPose, timestamp);
        }
      }

      // 3. Add points to global map with corrected pose
      const addedPoints = this.pointCloudAccumulator.addScanToMap(
        pointsData,
        correctedPose,
        timestamp
      );

      // 4. Store recent scan for future scan matching
      this.storeRecentScan(pointsData, correctedPose, timestamp);

      // 5. Check for loop closures if enabled
      if (this.options.loopClosureEnabled && this.scanCount % 10 === 0) {
        // Check every 10 scans
        this.checkForLoopClosures(pointsData, correctedPose, timestamp);
      }

      // 6. Update statistics
      this.updateStatistics(pointsData, processingStartTime, addedPoints);

      this.scanCount++;
    } catch (error) {
      console.error("Error processing SLAM scan:", error);
    }
  }

  /**
   * Apply pose correction from scan matching
   */
  applyCorrectionToPose(originalPose, correction) {
    return {
      x: originalPose.x + correction.translation.x,
      y: originalPose.y + correction.translation.y,
      z: originalPose.z + correction.translation.z,
      roll: originalPose.roll + correction.rotation.x,
      pitch: originalPose.pitch + correction.rotation.y,
      yaw: originalPose.yaw + correction.rotation.z,
    };
  }

  /**
   * Store recent scan for scan matching
   */
  storeRecentScan(pointsData, pose, timestamp) {
    const scanData = {
      points: new Float32Array(pointsData),
      pose: { ...pose },
      timestamp: timestamp,
    };

    this.recentScans.push(scanData);

    // Keep only recent scans to limit memory usage
    if (this.recentScans.length > this.maxRecentScans) {
      this.recentScans.shift();
    }
  }

  /**
   * Update processing statistics
   */
  updateStatistics(pointsData, processingStartTime, addedPoints) {
    const processingTime = performance.now() - processingStartTime;
    const numPoints = pointsData.length / 4; // 4 components per point

    this.processingStats.totalScansProcessed++;
    this.processingStats.totalPointsAccumulated += addedPoints;

    // Update average processing time
    const alpha = 0.1; // Exponential moving average factor
    this.processingStats.averageProcessingTime =
      alpha * processingTime +
      (1 - alpha) * this.processingStats.averageProcessingTime;

    // Update trajectory length
    this.processingStats.trajectoryLength =
      this.odometryTracker.getTotalDistance();

    // Estimate map size in MB
    this.processingStats.mapSizeMB =
      (this.processingStats.totalPointsAccumulated * 4 * 4) / (1024 * 1024); // 4 floats per point
  }

  /**
   * Get current SLAM statistics
   */
  getStatistics() {
    const loopClosureStats = this.loopClosureDetector.getStatistics();
    const poseGraphStats = this.poseGraphOptimizer.getStatistics();

    return {
      ...this.processingStats,
      isRunning: this.isRunning,
      currentPose: this.odometryTracker.getCurrentPose(),
      scanCount: this.scanCount,
      recentScansCount: this.recentScans.length,
      loopClosures: {
        totalDetected: loopClosureStats.totalLoopClosures,
        lastDetectionTime: loopClosureStats.lastLoopClosureTime,
        averageConfidence: loopClosureStats.averageConfidence,
      },
      poseGraph: {
        nodes: poseGraphStats.nodes,
        edges: poseGraphStats.edges,
        loopClosureEdges: poseGraphStats.loopClosures,
        isOptimized: poseGraphStats.isOptimized,
        finalError: poseGraphStats.finalError,
        iterations: poseGraphStats.iterations,
      },
    };
  }

  /**
   * Get current trajectory
   */
  getTrajectory() {
    return this.odometryTracker.getPoseHistory();
  }

  /**
   * Get accumulated point cloud data
   */
  getAccumulatedMap() {
    return this.pointCloudAccumulator.getAccumulatedMap();
  }

  /**
   * Export accumulated map as PCD file
   */
  async exportMap(filename = "slam_map.pcd") {
    const mapData = this.getAccumulatedMap();
    const trajectory = this.getTrajectory();
    const metadata = {
      slamOptions: this.options,
      statistics: this.getStatistics(),
      exportTime: new Date().toISOString(),
    };

    return await SlamExporter.exportAccumulatedPCD(
      mapData,
      trajectory,
      metadata,
      filename
    );
  }

  /**
   * Export complete SLAM session
   */
  async exportSession(filename = "slam_session.zip") {
    const mapData = this.getAccumulatedMap();
    const trajectory = this.getTrajectory();
    const statistics = this.getStatistics();

    return await SlamExporter.exportSlamSession(
      {
        pointCloud: mapData,
        trajectory: trajectory,
        statistics: statistics,
        options: this.options,
      },
      filename
    );
  }

  /**
   * Reset SLAM system
   */
  reset() {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.scanCount = 0;
    this.recentScans = [];
    this.odometryTracker.reset();
    this.pointCloudAccumulator.reset();
    this.loopClosureDetector.reset();
    this.poseGraphOptimizer.reset();

    console.log("SLAM system reset");

    if (wasRunning) {
      this.start();
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage() {
    return {
      mapPointsCount: this.pointCloudAccumulator.getPointCount(),
      mapSizeMB: this.processingStats.mapSizeMB,
      recentScansCount: this.recentScans.length,
      trajectoryPointsCount: this.odometryTracker.getPoseHistory().length,
    };
  }

  /**
   * Check for loop closures and optimize pose graph if found
   */
  checkForLoopClosures(pointsData, currentPose, timestamp) {
    try {
      // Add current scan as potential keyframe
      const keyframeId = `keyframe_${this.scanCount}`;
      const loopClosures = this.loopClosureDetector.addKeyframe({
        scanId: keyframeId,
        points: pointsData,
        pose: currentPose,
        timestamp: timestamp,
      });

      if (loopClosures.length > 0) {
        console.log(`Found ${loopClosures.length} loop closure(s)`);

        // Add loop closures to pose graph optimizer
        for (const loopClosure of loopClosures) {
          this.poseGraphOptimizer.addLoopClosure(
            loopClosure.fromKeyframe,
            loopClosure.toKeyframe,
            loopClosure.relativePose,
            loopClosure.confidence
          );
        }

        // Optimize pose graph if enabled
        if (this.options.poseGraphOptimizationEnabled) {
          this.optimizePoseGraph();
        }
      }
    } catch (error) {
      console.error("Error in loop closure detection:", error);
    }
  }

  /**
   * Optimize the pose graph using detected loop closures
   */
  optimizePoseGraph() {
    try {
      console.log("Starting pose graph optimization...");

      // Add all current poses to the optimizer
      const trajectory = this.odometryTracker.getPoseHistory();
      for (let i = 0; i < trajectory.length; i++) {
        const pose = trajectory[i];
        const nodeId = `pose_${i}`;
        this.poseGraphOptimizer.addNode(nodeId, pose);

        // Add odometry constraints between consecutive poses
        if (i > 0) {
          const prevPose = trajectory[i - 1];
          const relativePose = {
            x: pose.x - prevPose.x,
            y: pose.y - prevPose.y,
            z: pose.z - prevPose.z,
          };

          this.poseGraphOptimizer.addEdge(
            `pose_${i - 1}`,
            nodeId,
            relativePose
          );
        }
      }

      // Fix the first pose
      if (trajectory.length > 0) {
        this.poseGraphOptimizer.fixNode("pose_0");
      }

      // Optimize
      const result = this.poseGraphOptimizer.optimize();

      if (result.success) {
        console.log(
          `Pose graph optimization completed: ${
            result.iterations
          } iterations, error: ${result.error.toFixed(6)}`
        );

        // Update trajectory with optimized poses
        this.updateTrajectoryWithOptimizedPoses();

        // Update point cloud with corrected poses
        this.updateMapWithCorrectedTrajectory();
      } else {
        console.warn("Pose graph optimization failed");
      }
    } catch (error) {
      console.error("Error in pose graph optimization:", error);
    }
  }

  /**
   * Update trajectory with optimized poses
   */
  updateTrajectoryWithOptimizedPoses() {
    const optimizedPoses = this.poseGraphOptimizer.getAllOptimizedPoses();
    const trajectory = this.odometryTracker.getPoseHistory();

    for (let i = 0; i < trajectory.length; i++) {
      const nodeId = `pose_${i}`;
      const optimizedPose = optimizedPoses.get(nodeId);

      if (optimizedPose) {
        trajectory[i] = { ...optimizedPose };
      }
    }

    // Update odometry tracker with corrected trajectory
    this.odometryTracker.updateTrajectory(trajectory);
  }

  /**
   * Update point cloud map with corrected trajectory
   */
  updateMapWithCorrectedTrajectory() {
    // This would require re-accumulating the point cloud with corrected poses
    // For now, we'll mark the map as needing update
    console.log("Map update needed after pose graph optimization");
    // Future: implement incremental map update
  }

  /**
   * Export pose graph for debugging
   */
  exportPoseGraph(filename = "pose_graph.json") {
    const graphData = this.poseGraphOptimizer.exportGraph();
    const loopClosureData = this.loopClosureDetector.exportData();

    const exportData = {
      poseGraph: graphData,
      loopClosures: loopClosureData,
      trajectory: this.getTrajectory(),
      statistics: this.getStatistics(),
    };

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Pose graph exported to ${filename}`);
    return true;
  }
}
