/**
 * Default LiDAR configuration for Livox Mid-360
 */
export const DEFAULT_LIDAR_CONFIG = {
  horizontalFOV: 360, // degrees - full 360° horizontal FOV
  verticalFOVMin: -7, // degrees - lower bound of vertical FOV
  verticalFOVMax: 52, // degrees - upper bound of vertical FOV
  numChannels: 40, // Livox Mid-360 has multiple beams
  maxRange: 70, // meters (based on 80% reflectivity spec)
  minRange: 0.1, // meters (close proximity blind zone is 0.1m)
  scanRate: 0.1, // Adjust to control speed of scan (lower = faster)
  pointsPerFrame: 10, // How many rays to cast per frame
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
