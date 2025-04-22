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
  pointsPerFrame: 20000, // 200,000 points/sec ÷ 10 Hz = 20,000 points/frame
  pointRate: 200000, // points/s - matches Livox Mid-360 spec
};

/**
 * Create a LiDAR configuration with optional overrides
 */
export function createLidarConfig(overrides = {}) {
  return {
    ...DEFAULT_LIDAR_CONFIG,
    ...overrides,
  };
}
