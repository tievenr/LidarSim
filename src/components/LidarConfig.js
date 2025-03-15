/**
 * Default LiDAR configuration
 */
export const DEFAULT_LIDAR_CONFIG = {
  horizontalFOV: 360, // degrees
  verticalFOV: 59, // degrees
  numChannels: 40, // Livox Mid-360 has 40 beams
  maxRange: 200, // meters
  minRange: 0.1, // meters
  scanRate: 0.1, // Adjust to control speed of scan (lower = faster)
  pointsPerFrame: 10, // How many rays to cast per frame
};

/**
 * Creates a custom LiDAR configuration by merging with defaults
 * @param {Object} customConfig - Custom configuration parameters
 * @returns {Object} - Complete LiDAR configuration
 */
export function createLidarConfig(customConfig = {}) {
  return {
    ...DEFAULT_LIDAR_CONFIG,
    ...customConfig,
  };
}
