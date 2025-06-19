import * as THREE from "three";

/**
 * Constants for the Livox MID-360 LiDAR specifications
 */
export const LIDAR_SPECS = {
  BLIND_ZONE: 0.1, // 10cm minimum range
  MAX_RANGE_LOW_REFLECTIVITY: 40, // 40m @ 10% reflectivity
  MAX_RANGE_HIGH_REFLECTIVITY: 70, // 70m @ 80% reflectivity
  LOW_REFLECTIVITY: 0.1, // 10%
  HIGH_REFLECTIVITY: 0.8, // 80%
  WAVELENGTH: 905, // 905nm laser wavelength
};

/**
 * Class to handle LiDAR range calculations and validations
 */
export class RangeCalculator {
  /**
   * Calculate the maximum detection range based on material reflectivity
   * @param {number} materialReflectivity - Material reflectivity value [0-1]
   * @param {number} configMaxRange - Maximum range from configuration (optional)
   * @returns {number} Maximum detection range in meters
   */
  static calculateMaxRange(materialReflectivity, configMaxRange = null) {
    // Use configured max range if provided, otherwise use default specs
    const maxRangeHigh =
      configMaxRange || LIDAR_SPECS.MAX_RANGE_HIGH_REFLECTIVITY;
    const maxRangeLow = Math.min(
      LIDAR_SPECS.MAX_RANGE_LOW_REFLECTIVITY,
      maxRangeHigh
    );

    if (materialReflectivity <= LIDAR_SPECS.LOW_REFLECTIVITY) {
      return maxRangeLow;
    }

    if (materialReflectivity >= LIDAR_SPECS.HIGH_REFLECTIVITY) {
      return maxRangeHigh;
    }

    // Linear interpolation between low and high reflectivity ranges
    const rangeDiff = maxRangeHigh - maxRangeLow;
    const reflectivityFactor =
      (materialReflectivity - LIDAR_SPECS.LOW_REFLECTIVITY) /
      (LIDAR_SPECS.HIGH_REFLECTIVITY - LIDAR_SPECS.LOW_REFLECTIVITY);
    return maxRangeLow + rangeDiff * reflectivityFactor;
  }

  /**
   * Calculate material reflectivity from object properties
   * @param {Object} material - Three.js material object
   * @returns {number} Reflectivity value [0-1]
   */
  static calculateMaterialReflectivity(material) {
    if (!material || !material.color) {
      return 0.5; // Default 50% reflectivity
    }

    // Use material color as a proxy for reflectivity
    return (material.color.r + material.color.g + material.color.b) / 3;
  }

  /**
   * Validate if a point is within detectable range
   * @param {number} distance - Distance to point in meters
   * @param {number} materialReflectivity - Material reflectivity value [0-1]
   * @param {number} configMaxRange - Maximum range from configuration (optional)
   * @returns {boolean} Whether the point is within detectable range
   */
  static isInRange(distance, materialReflectivity, configMaxRange = null) {
    // Check blind zone
    if (distance < LIDAR_SPECS.BLIND_ZONE) {
      return false;
    }

    // Check maximum range based on reflectivity and configuration
    const maxRange = this.calculateMaxRange(
      materialReflectivity,
      configMaxRange
    );
    return distance <= maxRange;
  }

  /**
   * Convert distance between Three.js units and meters
   * @param {number} distance - Distance value to convert
   * @param {number} scaleFactor - Scale factor (1 by default, assuming 1 unit = 1 meter)
   * @param {boolean} toMeters - True to convert to meters, false to convert to Three.js units
   * @returns {number} Converted distance
   */
  static convertDistance(distance, scaleFactor = 1, toMeters = true) {
    return toMeters ? distance * scaleFactor : distance / scaleFactor;
  }
}
