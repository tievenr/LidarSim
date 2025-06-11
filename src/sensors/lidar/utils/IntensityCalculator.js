import * as THREE from 'three';
import { RangeCalculator } from "./RangeCalculator.js";

/**
 * Class to handle LiDAR intensity calculations
 * Implements realistic intensity calculations based on multiple factors
 */
export class IntensityCalculator {
  constructor(lidarConfig) {
    this.lidarConfig = lidarConfig;
    // Default attenuation coefficient for 905nm wavelength in clear air
    this.atmosphereAttenuationRate = 0.1;  // per meter
  }

  /**
   * Calculate intensity for a LiDAR point based on multiple factors
   * @param {THREE.Vector3} origin - Origin point of the ray
   * @param {THREE.Vector3} point - Intersection point
   * @param {THREE.Vector3} direction - Ray direction
   * @param {Object} intersection - Ray intersection data
   * @param {number} channelIndex - Channel index of the laser
   * @returns {number|null} - Calculated intensity value in range [0, 1], or null if point is out of range
   */
  calculateIntensity(origin, point, direction, intersection, channelIndex) {
    // Calculate distance in meters
    const distance = point.distanceTo(origin);

    // Calculate material reflectivity
    const materialReflectivity = RangeCalculator.calculateMaterialReflectivity(
      intersection.object.material
    );

    // Check if point is within detectable range
    if (!RangeCalculator.isInRange(distance, materialReflectivity)) {
      return null;
    }

    // Calculate base intensity
    let intensity = 1.0;

    // 1. Distance-based attenuation using exponential decay formula: I/I₀ = e^(-a·d)
    const attenuationFactor = Math.exp(-this.atmosphereAttenuationRate * distance);
    intensity *= attenuationFactor;

    // 2. Angle of incidence (cosine law)
    if (intersection.face) {
      const normal = intersection.face.normal;
      const incidenceAngle = Math.abs(normal.dot(direction));
      intensity *= incidenceAngle;
    }

    // 3. Apply material reflectivity
    intensity *= materialReflectivity;

    // 4. Channel-specific intensity (higher channels typically have more power)
    const channelIntensity = 0.5 + (channelIndex / this.lidarConfig.numChannels) * 0.5;
    intensity *= channelIntensity;

    // Normalize intensity to [0, 1] range
    return Math.max(0, Math.min(1, intensity));
  }

  /**
   * Set the atmosphere attenuation rate
   * @param {number} rate - Attenuation coefficient (per meter)
   */
  setAtmosphereAttenuationRate(rate) {
    this.atmosphereAttenuationRate = rate;
  }
} 