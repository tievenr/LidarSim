export const DEFAULT_LIDAR_CONFIG = {
  horizontalFOV: 360,
  verticalFOVMin: -7,
  verticalFOVMax: 52,
  numChannels: 40,
  maxRange: 70,
  minRange: 0.1,
  scanRate: 2 * Math.PI * 10,
  pointsPerFrame: 15000,
  pointRate: 200000,
};

export function createLidarConfig(overrides = {}) {
  return {
    ...DEFAULT_LIDAR_CONFIG,
    ...overrides,
  };
}
