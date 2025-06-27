import * as THREE from "three";
import { RangeCalculator } from "./RangeCalculator.js";

export class IntensityCalculator {
  constructor(lidarConfig) {
    this.lidarConfig = lidarConfig;
    this.atmosphereAttenuationRate = 0.1;
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

    // Distance-based attenuation
    const attenuationFactor = Math.exp(
      -this.atmosphereAttenuationRate * distance
    );
    intensity *= attenuationFactor;

    // Angle of incidence
    if (intersection.face) {
      const normal = intersection.face.normal;
      const incidenceAngle = Math.abs(normal.dot(direction));
      intensity *= incidenceAngle;
    }

    // Material reflectivity
    intensity *= materialReflectivity;

    // Channel-specific intensity
    const channelIntensity =
      0.5 + (channelIndex / this.lidarConfig.numChannels) * 0.5;
    intensity *= channelIntensity;

    return Math.max(0, Math.min(1, intensity));
  }

  setAtmosphereAttenuationRate(rate) {
    this.atmosphereAttenuationRate = rate;
  }
}
