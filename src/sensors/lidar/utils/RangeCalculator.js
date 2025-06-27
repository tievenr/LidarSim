import * as THREE from "three";

export const LIDAR_SPECS = {
  BLIND_ZONE: 0.1,
  MAX_RANGE_LOW_REFLECTIVITY: 40,
  MAX_RANGE_HIGH_REFLECTIVITY: 70,
  LOW_REFLECTIVITY: 0.1,
  HIGH_REFLECTIVITY: 0.8,
  WAVELENGTH: 905,
};

export class RangeCalculator {
  static calculateMaxRange(materialReflectivity, configMaxRange = null) {
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

    const rangeDiff = maxRangeHigh - maxRangeLow;
    const reflectivityFactor =
      (materialReflectivity - LIDAR_SPECS.LOW_REFLECTIVITY) /
      (LIDAR_SPECS.HIGH_REFLECTIVITY - LIDAR_SPECS.LOW_REFLECTIVITY);
    return maxRangeLow + rangeDiff * reflectivityFactor;
  }

  static calculateMaterialReflectivity(material) {
    if (!material || !material.color) {
      return 0.5;
    }
    return (material.color.r + material.color.g + material.color.b) / 3;
  }

  static isInRange(distance, materialReflectivity, configMaxRange = null) {
    if (distance < LIDAR_SPECS.BLIND_ZONE) {
      return false;
    }
    const maxRange = this.calculateMaxRange(
      materialReflectivity,
      configMaxRange
    );
    return distance <= maxRange;
  }

  static convertDistance(distance, scaleFactor = 1, toMeters = true) {
    return toMeters ? distance * scaleFactor : distance / scaleFactor;
  }
}
