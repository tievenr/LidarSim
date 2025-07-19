import * as THREE from "three";
import JSZip from "jszip";

/**
 * Frame-based LiDAR point cloud management.
 * This class collects points over time, organizes them into frames based on a specified
 * frame rate, and provides utilities to export these frames as a ZIP archive of PCD files.
 * It is optimized to store finalized frames using Float32Arrays to minimize memory usage.
 */
export class LidarFrameManager {
  constructor(frameRate = 10) {
    // Frame rate in Hz (10Hz = frame every 100ms)
    this.frameRate = frameRate;
    this.frameInterval = 1000 / frameRate; // Convert to milliseconds
    this.frames = [];
    this.isCapturing = false;
    this.lastFrameTime = null;

    // The current frame being built.
    // Instead of point objects, we will now store Float32Array segments directly.
    this.currentFrame = {
      pointBuffers: [], // Array to store Float32Array segments
      pointCountAccumulated: 0, // Total points accumulated in current frame
      startTime: 0,
      frameNumber: 0,
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
    this.frames = []; // Clear existing frames on new capture
    this.currentFrame = {
      pointBuffers: [],
      pointCountAccumulated: 0,
      startTime: now,
      frameNumber: 0,
    };
  }

  /**
   * Stop capturing frames
   */
  stopCapture() {
    this.isCapturing = false;
    // Finalize and save the last frame if it has points
    this._finalizeCurrentFrame();
  }

  /**
   * Add new points to the current frame
   * @param {Float32Array} newPointsData - Float32Array of point components (x, y, z, intensity)
   */
  addPointsToFrame(newPointsData) {
    if (!this.isCapturing || !newPointsData || newPointsData.length === 0)
      return;

    const currentTime = Date.now();

    // Store the new Float32Array segment and accumulate its point count
    this.currentFrame.pointBuffers.push(newPointsData);
    this.currentFrame.pointCountAccumulated += newPointsData.length / 4; // Assuming 4 components per point

    const timeSinceLastFrame = currentTime - this.lastFrameTime;

    // If we've exceeded the frame interval, finalize the current frame and start a new one
    if (timeSinceLastFrame >= this.frameInterval) {
      this._finalizeCurrentFrame();

      // Start a new frame
      this.lastFrameTime = currentTime;
      this.currentFrame = {
        pointBuffers: [],
        pointCountAccumulated: 0,
        startTime: currentTime,
        frameNumber: this.frames.length, // Frame number based on how many frames are finalized
      };
    }
  }

  /**
   * Converts the points collected in `currentFrame` into a memory-efficient Float32Array
   * and adds the finalized frame to the `frames` array.
   * @private
   */
  _finalizeCurrentFrame() {
    const totalPointsInFrame = this.currentFrame.pointCountAccumulated;
    if (totalPointsInFrame === 0) {
      return; // Don't save empty frames
    }

    // Combine all Float32Array segments into a single, contiguous Float32Array
    const finalPointsData = new Float32Array(totalPointsInFrame * 4); // 4 components: x, y, z, intensity
    let offset = 0;
    for (const bufferSegment of this.currentFrame.pointBuffers) {
      finalPointsData.set(bufferSegment, offset);
      offset += bufferSegment.length;
    }

    // Create the final frame object with the typed array and metadata
    const finalFrame = {
      pointsData: finalPointsData, // This is now the combined Float32Array
      pointCount: totalPointsInFrame,
      startTime: this.currentFrame.startTime,
      frameNumber: this.currentFrame.frameNumber,
    };

    this.frames.push(finalFrame);

    // Reset current frame buffer for the next collection
    this.currentFrame.pointBuffers = [];
    this.currentFrame.pointCountAccumulated = 0;
  }

  /**
   * Clear all stored frames
   */
  clearFrames() {
    this.frames = [];
    this.currentFrame = {
      pointBuffers: [],
      pointCountAccumulated: 0,
      startTime: 0,
      frameNumber: 0,
    };
    this.lastFrameTime = null;
  }

  /**
   * Generate a PCD file content for a frame from its typed array data.
   * @param {Object} frame - Frame object containing pointsData and pointCount.
   * @returns {String} - PCD file content.
   */
  generatePCDForFrame(frame) {
    const { pointsData, pointCount } = frame;

    // PCD header
    const header =
      [
        `# .PCD v0.7 - Point Cloud Data file format`,
        `VERSION 0.7`,
        `FIELDS x y z intensity`,
        `SIZE 4 4 4 4`,
        `TYPE F F F F`,
        `COUNT 1 1 1 1`,
        `WIDTH ${pointCount}`,
        `HEIGHT 1`,
        `VIEWPOINT 0 0 0 1 0 0 0`,
        `POINTS ${pointCount}`,
        `DATA ascii`,
      ].join("\n") + "\n";

    // PCD data lines
    const lines = [];
    for (let i = 0; i < pointCount; i++) {
      const offset = i * 4;
      lines.push(
        `${pointsData[offset]} ${pointsData[offset + 1]} ${
          pointsData[offset + 2]
        } ${pointsData[offset + 3]}`
      );
    }

    return header + lines.join("\n");
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
    const framesFolder = zip.folder("frames");

    // Export each frame as a PCD file
    this.frames.forEach((frame) => {
      const pcdContent = this.generatePCDForFrame(frame);
      const filename = this.generateFrameFilename(frame);
      framesFolder.file(filename, pcdContent);
    });

    // Generate and download the zip file
    const content = await zip.generateAsync({
      type: "blob",
    });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lidar_frames_${new Date().toISOString()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get statistics about captured frames
   * @returns {Object} - Statistics about frames
   */
  getFrameStatistics() {
    const totalPoints = this.frames.reduce(
      (sum, frame) => sum + frame.pointCount,
      0
    );
    return {
      frameCount: this.frames.length,
      totalPoints,
      averagePointsPerFrame:
        this.frames.length > 0 ? totalPoints / this.frames.length : 0,
    };
  }
}
