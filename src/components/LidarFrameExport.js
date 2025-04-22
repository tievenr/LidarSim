import * as THREE from 'three';
import JSZip from "jszip";

/**
 * Frame-based LiDAR point cloud management
 * Handles collecting points into frames and exporting them as a ZIP file
 */
export class LidarFrameManager {
  constructor(frameRate = 10) {
    // Frame rate in Hz (10Hz = frame every 100ms)
    this.frameRate = frameRate;
    this.frameInterval = 1000 / frameRate; // Convert to milliseconds
    this.frames = [];
    this.isCapturing = false;
    this.frameStartTime = null;
    this.lastFrameTime = null;
    this.currentFrame = {
      points: [],
      startTime: 0,
      frameNumber: 0
    };
  }

  /**
   * Start capturing frames
   */
  startCapture() {
    this.isCapturing = true;
    const now = Date.now();
    this.frameStartTime = now;
    this.lastFrameTime = now;
    this.frames = [];
    this.currentFrame = {
      points: [],
      startTime: now,
      frameNumber: 0
    };
  }

  /**
   * Stop capturing frames
   */
  stopCapture() {
    this.isCapturing = false;
    // Add the last frame if it has points
    if (this.currentFrame.points.length > 0) {
      this.frames.push(this.currentFrame);
    }
  }

  /**
   * Add new points to the current frame
   * @param {Array} points - Array of point objects from ray casting
   */
  addPointsToFrame(points) {
    if (!this.isCapturing || !points || points.length === 0) return;

    const currentTime = Date.now();
    const timeSinceLastFrame = currentTime - this.lastFrameTime;

    // If we've exceeded the frame interval, start a new frame
    if (timeSinceLastFrame >= this.frameInterval) {
      // Save current frame if it has points
      if (this.currentFrame.points.length > 0) {
        this.frames.push(this.currentFrame);
      }

      // Start a new frame
      this.lastFrameTime = currentTime;
      this.currentFrame = {
        points: [],
        startTime: currentTime,
        frameNumber: this.frames.length
      };

      // Debug log
      console.log(`New frame started: ${this.frames.length}, Interval: ${timeSinceLastFrame}ms`);
    }

    // Add points to current frame
    this.currentFrame.points.push(...points);
  }

  /**
   * Clear all stored frames
   */
  clearFrames() {
    this.frames = [];
    this.currentFrame = {
      points: [],
      startTime: 0,
      frameNumber: 0
    };
    this.lastFrameTime = null;
  }

  /**
   * Generate a PCD file content for a frame
   * @param {Object} frame - Frame object containing points
   * @returns {String} - PCD file content
   */
  generatePCDContent(frame) {
    // Generate PCD header
    const pointCount = frame.points.length;
    let pcdHeader = `VERSION .7
FIELDS x y z intensity time tag line
SIZE 4 4 4 4 4 1 1
TYPE F F F F F U U
COUNT 1 1 1 1 1 1 1
WIDTH ${pointCount}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${pointCount}
DATA ascii
`;

    // Generate PCD data
    let pcdData = frame.points
      .map(
        (point) =>
          `${point.x.toFixed(6)} ${point.y.toFixed(6)} ${point.z.toFixed(
            6
          )} ${point.intensity.toFixed(6)} ${(point.time / 1000).toFixed(6)} ${
            point.tag
          } ${point.line}`
      )
      .join("\n");

    // Combine header and data
    return pcdHeader + pcdData;
  }

  /**
   * Format a date for filenames (YYYY-MM-DD_HH-MM-SS-MS)
   * @param {Number} timestamp - JavaScript timestamp
   * @returns {String} - Formatted date string
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().replace(/:/g, "-").replace(/\..+/, "");
  }

  /**
   * Generate frame filename
   * @param {Object} frame - Frame object
   * @returns {String} - Filename
   */
  generateFrameFilename(frame) {
    const formattedTime = this.formatTimestamp(frame.startTime);
    const paddedNumber = String(frame.frameNumber).padStart(4, "0");
    return `frame_${paddedNumber}_${formattedTime}.pcd`;
  }

  /**
   * Export all frames as a ZIP file and trigger download
   */
  async exportFramesAsZip() {
    if (this.frames.length === 0) {
      console.warn("No frames to export");
      return;
    }

    const zip = new JSZip();
    
    // Create a folder for the frames
    const framesFolder = zip.folder("frames");
    
    // Export each frame as a PCD file
    this.frames.forEach((frame, index) => {
      const pcdContent = this.generatePCD(frame.points);
      framesFolder.file(`frame_${index.toString().padStart(6, '0')}.pcd`, pcdContent);
    });

    // Generate and download the zip file
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lidar_frames_${new Date().toISOString()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  generatePCD(points) {
    // PCD header
    let header = `# .PCD v0.7 - Point Cloud Data file format\n`;
    header += `VERSION 0.7\n`;
    header += `FIELDS x y z intensity\n`;
    header += `SIZE 4 4 4 4\n`;
    header += `TYPE F F F F\n`;
    header += `COUNT 1 1 1 1\n`;
    header += `WIDTH ${points.length}\n`;
    header += `HEIGHT 1\n`;
    header += `VIEWPOINT 0 0 0 1 0 0 0\n`;
    header += `POINTS ${points.length}\n`;
    header += `DATA ascii\n`;

    // PCD data
    const data = points.map(point => 
      `${point.x} ${point.y} ${point.z} ${point.intensity}`
    ).join('\n');

    return header + data;
  }

  /**
   * Get statistics about captured frames
   * @returns {Object} - Statistics about frames
   */
  getFrameStatistics() {
    return {
      frameCount: this.frames.length,
      totalPoints: this.frames.reduce((sum, frame) => sum + frame.points.length, 0),
      averagePointsPerFrame: this.frames.length > 0 
        ? this.frames.reduce((sum, frame) => sum + frame.points.length, 0) / this.frames.length 
        : 0
    };
  }
}
