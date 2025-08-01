import * as THREE from "three";
import { RangeCalculator } from "./RangeCalculator.js";

export class IntensityCalculator {
  constructor(lidarConfig) {
    this.lidarConfig = lidarConfig;
    this.atmosphereAttenuationRate = 0.1;
    this.channelWeighting = 0.5; // New configurable parameter
  }

  calculateIntensity(origin, point, direction, intersection, channelIndex) {
    const distance = point.distanceTo(origin);
    const materialReflectivity = RangeCalculator.calculateMaterialReflectivity(
      intersection.object.material
    );

    if (
      !RangeCalculator.isInRange(
        distance,
        materialReflectivity,
        this.lidarConfig.maxRange
      )
    ) {
      return null;
    }

    let intensity = 1.0;

    // Distance-based attenuation (Exponential Decay) ---
    // This simulates atmospheric light attenuation as per CARLA's model.
    const attenuationFactor = Math.exp(
      -this.atmosphereAttenuationRate * distance
    );
    intensity *= attenuationFactor;

    // Angle of incidence (using dot product) ---
    // This models how the angle of the surface affects the measured intensity.
    if (intersection.face) {
      const normal = intersection.face.normal;
      const incidenceAngle = Math.abs(normal.dot(direction));
      intensity *= incidenceAngle;
    }

    // Material reflectivity ---
    // This is a direct physical property and is kept as-is.
    intensity *= materialReflectivity;

    // Configurable Channel-specific intensity ---
    // Livox-like behavior but makes the impact configurable.
    const normalizedChannel = channelIndex / this.lidarConfig.numChannels;
    const channelIntensity = 1.0 - normalizedChannel * this.channelWeighting;
    intensity *= channelIntensity;

    // Normalization and Scaling ---
    // A scaling factor is applied to ensure the final intensity values are visually appealing
    const scalingFactor = 0.5;
    intensity *= scalingFactor;

    return Math.max(0, Math.min(1, intensity));
  }

  setAtmosphereAttenuationRate(rate) {
    this.atmosphereAttenuationRate = rate;
  }
}
