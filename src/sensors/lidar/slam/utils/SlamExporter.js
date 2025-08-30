import JSZip from "jszip";

/**
 * SLAM Data Exporter
 * Handles export of accumulated point clouds, trajectories, and SLAM data
 */
export class SlamExporter {
  constructor() {
    this.exportHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Export accumulated point cloud as PCD file
   * @param {Object} pointCloudData - Accumulated point cloud from PointCloudAccumulator
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PCD file blob
   */
  async exportPointCloudAsPCD(pointCloudData, options = {}) {
    const config = {
      filename: `slam_map_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.pcd`,
      includeIntensity: true,
      includeColors: false,
      coordinateSystem: "global", // 'global' or 'sensor'
      compression: false,
      ...options,
    };

    try {
      const pcdContent = this.generatePCDContent(pointCloudData, config);
      const blob = new Blob([pcdContent], { type: "text/plain" });

      this.recordExport("pcd", config.filename, blob.size);
      return blob;
    } catch (error) {
      console.error("PCD export failed:", error);
      throw error;
    }
  }

  /**
   * Generate PCD file content from point cloud data
   */
  generatePCDContent(pointCloudData, config) {
    let totalPoints = 0;
    let pointData = "";

    // (using separate r g b fields, helper removed)

    // Perceptual ramp: blue -> yellow -> red
    function intensityToRGB(norm) {
      // norm in [0,1]
      const clamp = Math.max(0, Math.min(1, norm));
      // Colors: blue (#3b83bd) -> yellow (#f1c40f) -> red (#e74c3c)
      if (clamp < 0.5) {
        const u = clamp / 0.5;
        const r = Math.round((0xf1 - 0x3b) * u + 0x3b);
        const g = Math.round((0xc4 - 0x83) * u + 0x83);
        const b = Math.round((0x0f - 0xbd) * u + 0xbd);
        return [r, g, b];
      } else {
        const u = (clamp - 0.5) / 0.5;
        const r = Math.round((0xe7 - 0xf1) * u + 0xf1);
        const g = Math.round((0x4c - 0xc4) * u + 0xc4);
        const b = Math.round((0x3c - 0x0f) * u + 0x0f);
        return [r, g, b];
      }
    }

    // Handle different data formats
    if (pointCloudData.globalMap) {
      // Original format with voxel grid
      const { globalMap, statistics } = pointCloudData;

      // Count total points
      for (const voxel of globalMap.values()) {
        totalPoints += voxel.points.length;
      }

      if (totalPoints === 0) {
        throw new Error("No points to export");
      }

      // Compute intensity range if colors requested
      let minI = Infinity;
      let maxI = -Infinity;
      if (config.includeColors) {
        for (const voxel of globalMap.values()) {
          for (const point of voxel.points) {
            if (point.intensity != null) {
              if (point.intensity < minI) minI = point.intensity;
              if (point.intensity > maxI) maxI = point.intensity;
            }
          }
        }
        if (minI === Infinity) {
          minI = 0;
          maxI = 1;
        }
      }

      // Build point data
      for (const [voxelKey, voxel] of globalMap) {
        for (const point of voxel.points) {
          const x = point.x;
          const y = point.y;
          const z = point.z;
          const intensity = point.intensity != null ? point.intensity : 0;

          if (config.includeColors) {
            const norm = maxI > minI ? (intensity - minI) / (maxI - minI) : 0.5;
            const [r, g, b] = intensityToRGB(norm);

            if (config.includeIntensity) {
              pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
                6
              )} ${intensity.toFixed(3)} ${r} ${g} ${b}\n`;
            } else {
              pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
                6
              )} ${r} ${g} ${b}\n`;
            }
          } else {
            if (config.includeIntensity) {
              pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
                6
              )} ${intensity.toFixed(3)}\n`;
            } else {
              pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
            }
          }
        }
      }
    } else if (pointCloudData.points) {
      // New format with Float32Array
      const { points, pointCount } = pointCloudData;
      totalPoints = pointCount;

      if (totalPoints === 0) {
        throw new Error("No points to export");
      }

      // Compute intensity range if colors requested
      let minI = Infinity;
      let maxI = -Infinity;
      if (config.includeColors) {
        for (let i = 0; i < totalPoints; i++) {
          const baseIndex = i * 4;
          const intensity = points[baseIndex + 3];
          if (intensity < minI) minI = intensity;
          if (intensity > maxI) maxI = intensity;
        }
        if (minI === Infinity) {
          minI = 0;
          maxI = 1;
        }
      }

      // Build point data from Float32Array
      for (let i = 0; i < totalPoints; i++) {
        const baseIndex = i * 4;
        const x = points[baseIndex];
        const y = points[baseIndex + 1];
        const z = points[baseIndex + 2];
        const intensity = points[baseIndex + 3];

        if (config.includeColors) {
          const norm = maxI > minI ? (intensity - minI) / (maxI - minI) : 0.5;
          const [r, g, b] = intensityToRGB(norm);

          if (config.includeIntensity) {
            pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
              6
            )} ${intensity.toFixed(3)} ${r} ${g} ${b}\n`;
          } else {
            pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
              6
            )} ${r} ${g} ${b}\n`;
          }
        } else {
          if (config.includeIntensity) {
            pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(
              6
            )} ${intensity.toFixed(3)}\n`;
          } else {
            pointData += `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
          }
        }
      }
    } else {
      throw new Error("Unsupported point cloud data format");
    }

    // Build PCD header
    let header = this.buildPCDHeader(totalPoints, config);

    return header + pointData;
  }

  /**
   * Build PCD file header
   */
  buildPCDHeader(pointCount, config) {
    const timestamp = new Date().toISOString();

    let fields = "x y z";
    let size = "4 4 4";
    let type = "F F F";
    let count = "1 1 1";

    if (config.includeIntensity) {
      fields += " intensity";
      size += " 4";
      type += " F";
      count += " 1";
    }

    if (config.includeColors) {
      // Use separate r g b uchar fields for compatibility with viewers
      fields += " r g b";
      size += " 1 1 1";
      type += " U U U";
      count += " 1 1 1";
    }

    return `# .PCD v0.7 - Point Cloud Data file format
# Generated by LidarSim SLAM system
# Timestamp: ${timestamp}
# Coordinate System: ${config.coordinateSystem}
VERSION 0.7
FIELDS ${fields}
SIZE ${size}
TYPE ${type}
COUNT ${count}
WIDTH ${pointCount}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${pointCount}
DATA ascii
`;
  }

  /**
   * Export vehicle trajectory as CSV
   * @param {Array} trajectory - Array of pose objects with timestamps
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} CSV file blob
   */
  async exportTrajectoryAsCSV(trajectory, options = {}) {
    const config = {
      filename: `slam_trajectory_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.csv`,
      includeVelocity: true,
      includeAcceleration: false,
      ...options,
    };

    try {
      const csvContent = this.generateTrajectoryCSV(trajectory, config);
      const blob = new Blob([csvContent], { type: "text/csv" });

      this.recordExport("csv", config.filename, blob.size);
      return blob;
    } catch (error) {
      console.error("Trajectory CSV export failed:", error);
      throw error;
    }
  }

  /**
   * Generate CSV content for trajectory data
   */
  generateTrajectoryCSV(trajectory, config) {
    if (!trajectory || trajectory.length === 0) {
      throw new Error("No trajectory data to export");
    }

    // Build header
    let header = "timestamp,x,y,z,roll,pitch,yaw";

    if (config.includeVelocity) {
      header += ",vel_x,vel_y,vel_z,vel_roll,vel_pitch,vel_yaw";
    }

    if (config.includeAcceleration) {
      header += ",accel_x,accel_y,accel_z,accel_roll,accel_pitch,accel_yaw";
    }

    header += "\n";

    // Build data rows
    let data = "";
    for (let i = 0; i < trajectory.length; i++) {
      const pose = trajectory[i];

      let row = `${pose.timestamp},${pose.x.toFixed(6)},${pose.y.toFixed(
        6
      )},${pose.z.toFixed(6)},${pose.roll.toFixed(6)},${pose.pitch.toFixed(
        6
      )},${pose.yaw.toFixed(6)}`;

      if (config.includeVelocity && pose.velocity) {
        const vel = pose.velocity;
        row += `,${vel.linear.x.toFixed(6)},${vel.linear.y.toFixed(
          6
        )},${vel.linear.z.toFixed(6)},${vel.angular.x.toFixed(
          6
        )},${vel.angular.y.toFixed(6)},${vel.angular.z.toFixed(6)}`;
      } else if (config.includeVelocity) {
        row += ",0,0,0,0,0,0";
      }

      if (config.includeAcceleration && pose.acceleration) {
        const acc = pose.acceleration;
        row += `,${acc.linear.x.toFixed(6)},${acc.linear.y.toFixed(
          6
        )},${acc.linear.z.toFixed(6)},${acc.angular.x.toFixed(
          6
        )},${acc.angular.y.toFixed(6)},${acc.angular.z.toFixed(6)}`;
      } else if (config.includeAcceleration) {
        row += ",0,0,0,0,0,0";
      }

      data += row + "\n";
    }

    return header + data;
  }

  /**
   * Export trajectory as CSV file
   * @param {Array} trajectory - Trajectory data
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} CSV file blob
   */
  async exportTrajectoryAsCSV(trajectory, options = {}) {
    const config = {
      filename: `trajectory_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.csv`,
      includeVelocity: false,
      includeAcceleration: false,
      ...options,
    };

    try {
      const csvContent = this.generateTrajectoryCSV(trajectory, config);
      const blob = new Blob([csvContent], { type: "text/csv" });

      this.recordExport("csv", config.filename, blob.size);
      return blob;
    } catch (error) {
      console.error("Trajectory CSV export failed:", error);
      throw error;
    }
  }
  async exportSlamMetadata(slamData, options = {}) {
    const config = {
      filename: `slam_metadata_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`,
      prettify: true,
      ...options,
    };

    try {
      const metadata = this.buildSlamMetadata(slamData);
      const jsonContent = config.prettify
        ? JSON.stringify(metadata, null, 2)
        : JSON.stringify(metadata);

      const blob = new Blob([jsonContent], { type: "application/json" });

      this.recordExport("json", config.filename, blob.size);
      return blob;
    } catch (error) {
      console.error("Metadata export failed:", error);
      throw error;
    }
  }

  /**
   * Build comprehensive SLAM metadata
   */
  buildSlamMetadata(slamData) {
    const timestamp = new Date().toISOString();

    return {
      exportInfo: {
        timestamp,
        version: "1.0.0",
        software: "LidarSim SLAM",
        format: "SLAM Session Data",
      },
      sessionSummary: {
        duration: slamData.sessionDuration || 0,
        totalFrames: slamData.totalFrames || 0,
        totalPoints: slamData.totalPoints || 0,
        trajectoryLength: slamData.trajectoryLength || 0,
        mapSize: slamData.mapSize || { x: 0, y: 0, z: 0 },
      },
      sensorConfiguration: slamData.sensorConfig || {},
      slamStatistics: slamData.slamStats || {},
      processingStatistics: slamData.processingStats || {},
      qualityMetrics: slamData.qualityMetrics || {},
      exportHistory: this.exportHistory.slice(-10), // Last 10 exports
    };
  }

  /**
   * Create complete SLAM export package as ZIP
   * @param {Object} slamData - Complete SLAM session data
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} ZIP file blob
   */
  async exportCompleteSession(slamData, options = {}) {
    const config = {
      filename: `slam_session_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.zip`,
      includePointCloud: true,
      includeTrajectory: true,
      includeMetadata: true,
      includeRawScans: false,
      pointCloudFormat: "pcd",
      ...options,
    };

    try {
      const zip = new JSZip();

      // Add point cloud if requested
      if (config.includePointCloud && slamData.pointCloud) {
        const pcdBlob = await this.exportPointCloudAsPCD(slamData.pointCloud, {
          filename: "accumulated_map.pcd",
        });
        const pcdArrayBuffer = await pcdBlob.arrayBuffer();
        zip.file("accumulated_map.pcd", pcdArrayBuffer);
      }

      // Add trajectory if requested
      if (config.includeTrajectory && slamData.trajectory) {
        const csvBlob = await this.exportTrajectoryAsCSV(slamData.trajectory, {
          filename: "vehicle_trajectory.csv",
        });
        const csvArrayBuffer = await csvBlob.arrayBuffer();
        zip.file("vehicle_trajectory.csv", csvArrayBuffer);
      }

      // Add metadata if requested
      if (config.includeMetadata) {
        const metadataBlob = await this.exportSlamMetadata(slamData, {
          filename: "session_metadata.json",
        });
        const metadataArrayBuffer = await metadataBlob.arrayBuffer();
        zip.file("session_metadata.json", metadataArrayBuffer);
      }

      // Add raw scan data if requested
      if (config.includeRawScans && slamData.rawScans) {
        const scansFolder = zip.folder("raw_scans");
        for (let i = 0; i < slamData.rawScans.length; i++) {
          const scan = slamData.rawScans[i];
          const scanPCD = this.generateRawScanPCD(scan, i);
          scansFolder.file(
            `scan_${i.toString().padStart(6, "0")}.pcd`,
            scanPCD
          );
        }
      }

      // Generate ZIP
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      this.recordExport("zip", config.filename, zipBlob.size);
      return zipBlob;
    } catch (error) {
      console.error("Complete session export failed:", error);
      throw error;
    }
  }

  /**
   * Generate PCD content for a single raw scan
   */
  generateRawScanPCD(scanData, scanIndex) {
    const { points, timestamp, pose } = scanData;
    const pointCount = points.length / 4; // Assuming [x,y,z,intensity] format

    let header = `# .PCD v0.7 - Point Cloud Data file format
# Raw LIDAR scan ${scanIndex}
# Timestamp: ${new Date(timestamp).toISOString()}
# Sensor pose: x=${pose.x.toFixed(3)} y=${pose.y.toFixed(3)} z=${pose.z.toFixed(
      3
    )} yaw=${pose.yaw.toFixed(3)}
VERSION 0.7
FIELDS x y z intensity
SIZE 4 4 4 4
TYPE F F F F
COUNT 1 1 1 1
WIDTH ${pointCount}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${pointCount}
DATA ascii
`;

    let pointData = "";
    for (let i = 0; i < pointCount; i++) {
      const offset = i * 4;
      pointData += `${points[offset].toFixed(6)} ${points[offset + 1].toFixed(
        6
      )} ${points[offset + 2].toFixed(6)} ${points[offset + 3].toFixed(3)}\n`;
    }

    return header + pointData;
  }

  /**
   * Export SLAM map as PLY format (alternative to PCD)
   * @param {Object} pointCloudData - Accumulated point cloud
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PLY file blob
   */
  async exportPointCloudAsPLY(pointCloudData, options = {}) {
    const config = {
      filename: `slam_map_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.ply`,
      includeNormals: false,
      includeColors: false,
      binaryFormat: false,
      ...options,
    };

    try {
      const plyContent = this.generatePLYContent(pointCloudData, config);
      const blob = new Blob([plyContent], { type: "text/plain" });

      this.recordExport("ply", config.filename, blob.size);
      return blob;
    } catch (error) {
      console.error("PLY export failed:", error);
      throw error;
    }
  }

  /**
   * Generate PLY file content
   */
  generatePLYContent(pointCloudData, config) {
    const { globalMap } = pointCloudData;

    // Count total points
    let totalPoints = 0;
    for (const voxel of globalMap.values()) {
      totalPoints += voxel.points.length;
    }

    if (totalPoints === 0) {
      throw new Error("No points to export");
    }

    // Build PLY header
    let header = `ply
format ascii 1.0
comment Generated by LidarSim SLAM system
comment Timestamp: ${new Date().toISOString()}
element vertex ${totalPoints}
property float x
property float y
property float z
property float intensity
`;

    if (config.includeNormals) {
      header += `property float nx
property float ny
property float nz
`;
    }

    if (config.includeColors) {
      header += `property uchar red
property uchar green
property uchar blue
`;
    }

    header += `end_header
`;

    // Build point data
    let pointData = "";
    for (const [voxelKey, voxel] of globalMap) {
      for (const point of voxel.points) {
        let line = `${point.x.toFixed(6)} ${point.y.toFixed(
          6
        )} ${point.z.toFixed(6)} ${point.intensity.toFixed(3)}`;

        if (config.includeNormals) {
          line += ` 0 0 1`; // Default normal
        }

        if (config.includeColors) {
          // Generate color based on intensity
          const intensity = Math.max(0, Math.min(1, point.intensity));
          const red = Math.floor(intensity * 255);
          const green = Math.floor((1 - intensity) * 255);
          const blue = 128;
          line += ` ${red} ${green} ${blue}`;
        }

        pointData += line + "\n";
      }
    }

    return header + pointData;
  }

  /**
   * Download blob as file
   * @param {Blob} blob - File blob
   * @param {string} filename - Download filename
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Record export operation for history tracking
   */
  recordExport(type, filename, size) {
    const exportRecord = {
      type,
      filename,
      size,
      timestamp: Date.now(),
      sizeFormatted: this.formatFileSize(size),
    };

    this.exportHistory.push(exportRecord);

    // Limit history size
    if (this.exportHistory.length > this.maxHistorySize) {
      this.exportHistory.shift();
    }

    console.log(
      `Export completed: ${filename} (${exportRecord.sizeFormatted})`
    );
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Get export history
   * @returns {Array} Export history records
   */
  getExportHistory() {
    return [...this.exportHistory];
  }

  /**
   * Clear export history
   */
  clearExportHistory() {
    this.exportHistory = [];
  }

  /**
   * Get export statistics
   * @returns {Object} Export statistics
   */
  getExportStatistics() {
    const total = this.exportHistory.length;
    const byType = {};
    let totalSize = 0;

    for (const record of this.exportHistory) {
      byType[record.type] = (byType[record.type] || 0) + 1;
      totalSize += record.size;
    }

    return {
      totalExports: total,
      exportsByType: byType,
      totalSizeBytes: totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize),
      averageSizeBytes: total > 0 ? totalSize / total : 0,
    };
  }

  /**
   * Static method to export accumulated PCD
   * @param {Object} mapData - Map data
   * @param {Array} trajectory - Trajectory data
   * @param {Object} metadata - Metadata
   * @param {string} filename - Filename
   * @returns {Promise} Export result
   */
  static async exportAccumulatedPCD(mapData, trajectory, metadata, filename) {
    const exporter = new SlamExporter();
    const pcdBlob = await exporter.exportPointCloudAsPCD(mapData, { filename });

    // Create download link
    const url = URL.createObjectURL(pcdBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`SLAM map exported as ${filename}`);
    return { success: true, filename, size: pcdBlob.size };
  }

  /**
   * Static method to export complete SLAM session
   * @param {Object} sessionData - Session data
   * @param {string} filename - Filename
   * @returns {Promise} Export result
   */
  static async exportSlamSession(sessionData, filename) {
    const exporter = new SlamExporter();
    const zipBlob = await exporter.exportCompleteSession(sessionData, {
      filename,
    });

    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`SLAM session exported as ${filename}`);
    return { success: true, filename, size: zipBlob.size };
  }
}
