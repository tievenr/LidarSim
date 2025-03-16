/**
 * Default LiDAR configuration for Livox Mid-360
 * Updated with correct scan rate and points per frame calculations
 */
export const DEFAULT_LIDAR_CONFIG = {
  horizontalFOV: 360, // degrees - full 360° horizontal FOV
  verticalFOVMin: -7, // degrees - lower bound of vertical FOV
  verticalFOVMax: 52, // degrees - upper bound of vertical FOV
  numChannels: 40, // Livox Mid-360 has multiple beams
  maxRange: 70, // meters (based on 80% reflectivity spec)
  minRange: 0.1, // meters (close proximity blind zone is 0.1m)
  scanRate: 2 * Math.PI * 10, // 2π * 10 Hz for 10 rotations per second
  pointsPerFrame: 500, // Approx. 20,000 points/rotation ÷ 60 frames/sec
  pointRate: 200000, // points/s - used for time calculations
};

/**
 * Creates a custom LiDAR configuration by merging with defaults
 * @param {Object} customConfig - Custom configuration parameters
 * @returns {Object} - Complete LiDAR configuration
 */
export function createLidarConfig(customConfig = {}) {
  const config = {
    ...DEFAULT_LIDAR_CONFIG,
    ...customConfig,
  };

  // Calculate total vertical FOV for compatibility with existing code
  if (
    !config.verticalFOV &&
    config.verticalFOVMin !== undefined &&
    config.verticalFOVMax !== undefined
  ) {
    config.verticalFOV = config.verticalFOVMax - config.verticalFOVMin;
  }

  return config;
}
