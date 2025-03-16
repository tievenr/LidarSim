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

    // Storage for all frames
    this.frames = [];

    // Current frame being collected
    this.currentFrame = {
      points: [],
      startTime: Date.now(),
      frameNumber: 1,
    };

    // Settings
    this.maxFrames = 300; // Limit number of frames (30 seconds at 10Hz)
    this.isCapturing = false;
    this.frameStartTime = Date.now();
  }

  /**
   * Start capturing frames
   */
  startCapture() {
    this.isCapturing = true;
    this.frameStartTime = Date.now();
    this.currentFrame = {
      points: [],
      startTime: this.frameStartTime,
      frameNumber: this.frames.length + 1,
    };
    console.log("Frame capture started");
  }

  /**
   * Stop capturing frames
   */
  stopCapture() {
    this.isCapturing = false;
    // Save the last frame if it has any points
    if (this.currentFrame.points.length > 0) {
      this.saveCurrentFrame();
    }
    console.log(`Frame capture stopped. Total frames: ${this.frames.length}`);
  }

  /**
   * Add new points to the current frame
   * @param {Array} newPoints - Array of point objects from ray casting
   */
  addPointsToFrame(newPoints) {
    if (!this.isCapturing || !newPoints || newPoints.length === 0) return;

    // Add points to current frame
    this.currentFrame.points.push(...newPoints);

    // Check if frame is complete based on time
    const currentTime = Date.now();
    const frameElapsed = currentTime - this.frameStartTime;

    if (frameElapsed >= this.frameInterval) {
      this.saveCurrentFrame();

      // Start a new frame
      this.frameStartTime = currentTime;
      this.currentFrame = {
        points: [],
        startTime: currentTime,
        frameNumber: this.frames.length + 1,
      };
    }
  }

  /**
   * Save the current frame to our frames array
   */
  saveCurrentFrame() {
    // Only save frames with points
    if (this.currentFrame.points.length > 0) {
      // Add frame to our collection
      this.frames.push({
        ...this.currentFrame,
        endTime: Date.now(),
      });

      // Enforce maximum frame limit to prevent memory issues
      if (this.frames.length > this.maxFrames) {
        this.frames.shift(); // Remove oldest frame
      }

      console.log(
        `Frame ${this.currentFrame.frameNumber} saved with ${this.currentFrame.points.length} points`
      );
    }
  }

  /**
   * Clear all stored frames
   */
  clearFrames() {
    this.frames = [];
    console.log("All frames cleared");
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

    try {
      // Create new ZIP file
      const zip = new JSZip();

      // Add each frame as a PCD file
      this.frames.forEach((frame) => {
        const filename = this.generateFrameFilename(frame);
        const pcdContent = this.generatePCDContent(frame);
        zip.file(filename, pcdContent);
      });

      // Generate the ZIP file
      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Create a timestamp for the ZIP filename
      const timestamp = this.formatTimestamp(Date.now());
      const zipFilename = `lidar_frames_${timestamp}.zip`;

      // Trigger download
      this.downloadBlob(content, zipFilename);

      console.log(`ZIP export complete with ${this.frames.length} frames`);
    } catch (error) {
      console.error("Error exporting frames:", error);
    }
  }

  /**
   * Helper function to download a Blob as a file
   * @param {Blob} blob - The Blob to download
   * @param {String} filename - The filename to use
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up
  }

  /**
   * Get statistics about captured frames
   * @returns {Object} - Statistics about frames
   */
  getFrameStatistics() {
    if (this.frames.length === 0) {
      return { frameCount: 0, totalPoints: 0, avgPointsPerFrame: 0 };
    }

    const totalPoints = this.frames.reduce(
      (sum, frame) => sum + frame.points.length,
      0
    );

    return {
      frameCount: this.frames.length,
      totalPoints: totalPoints,
      avgPointsPerFrame: Math.round(totalPoints / this.frames.length),
      firstFrameTime: new Date(this.frames[0].startTime).toISOString(),
      lastFrameTime: new Date(
        this.frames[this.frames.length - 1].endTime
      ).toISOString(),
      totalDuration:
        (this.frames[this.frames.length - 1].endTime -
          this.frames[0].startTime) /
        1000,
    };
  }
}
