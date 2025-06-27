import * as THREE from "three";

export class DistanceBasedCulling {
  constructor(maxRange = 70, bufferDistance = 10, minRange = 0.2) {
    this.maxRange = maxRange;
    this.minRange = minRange;
    this.bufferDistance = bufferDistance;
    this.cullDistance = maxRange + bufferDistance; // 80m total
    this.sensorPosition = new THREE.Vector3();
    this.tempVector = new THREE.Vector3();
    this.tempSphere = new THREE.Sphere();

    // Performance tracking
    this.stats = {
      totalMeshes: 0,
      visibleMeshes: 0,
      culledMeshes: 0,
      tooCloseMeshes: 0,
      tooFarMeshes: 0,
      processingTime: 0,
      minDistance: Infinity,
      maxDistance: 0,
    };

    console.log(
      `DistanceBasedCulling initialized: minRange=${minRange}m, maxRange=${maxRange}m, cullDistance=${this.cullDistance}m`
    );
  }

  updateSensorPosition(position) {
    if (position instanceof THREE.Vector3) {
      this.sensorPosition.copy(position);
    } else if (Array.isArray(position)) {
      this.sensorPosition.set(position[0], position[1], position[2]);
    } else {
      console.warn("Invalid position type passed to updateSensorPosition");
    }
  }

  shouldCullMesh(mesh) {
    if (!mesh || !mesh.geometry) {
      return false;
    }

    // Ensure bounding sphere is computed
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }

    // Clone the bounding sphere to avoid modifying the original
    this.tempSphere.copy(mesh.geometry.boundingSphere);

    // Transform bounding sphere center to world coordinates
    this.tempSphere.center.applyMatrix4(mesh.matrixWorld);

    // Calculate distance between sensor and mesh's bounding sphere center
    const distance = this.sensorPosition.distanceTo(this.tempSphere.center);

    // Update min/max distance tracking
    this.stats.minDistance = Math.min(this.stats.minDistance, distance);
    this.stats.maxDistance = Math.max(this.stats.maxDistance, distance);

    // Check if mesh is too close (within minimum range)
    const tooClose = distance + this.tempSphere.radius < this.minRange;

    // Check if mesh is too far (beyond maximum range + buffer)
    const tooFar = distance - this.tempSphere.radius > this.cullDistance;

    // Cull if either too close or too far
    return tooClose || tooFar;
  }

  updateStats(total, visible, processingTime, tooClose = 0, tooFar = 0) {
    this.stats.totalMeshes = total;
    this.stats.visibleMeshes = visible;
    this.stats.culledMeshes = total - visible;
    this.stats.tooCloseMeshes = tooClose;
    this.stats.tooFarMeshes = tooFar;
    this.stats.processingTime = processingTime;
  }

  getStats() {
    return {
      totalMeshes: this.stats.totalMeshes,
      visibleMeshes: this.stats.visibleMeshes,
      culledMeshes: this.stats.culledMeshes,
      tooCloseMeshes: this.stats.tooCloseMeshes,
      tooFarMeshes: this.stats.tooFarMeshes,
      processingTime: this.stats.processingTime,
      cullRate:
        this.stats.totalMeshes > 0
          ? (this.stats.culledMeshes / this.stats.totalMeshes) * 100
          : 0,
      minDistance:
        this.stats.minDistance === Infinity ? 0 : this.stats.minDistance,
      maxDistance: this.stats.maxDistance,
      effectiveRange: `${this.minRange}m - ${this.maxRange}m`,
    };
  }

  resetDistanceTracking() {
    this.stats.minDistance = Infinity;
    this.stats.maxDistance = 0;
    this.stats.tooCloseMeshes = 0;
    this.stats.tooFarMeshes = 0;
  }

  updateMaxRange(newMaxRange) {
    this.maxRange = newMaxRange;
    this.cullDistance = newMaxRange + this.bufferDistance;
    console.log(
      `DistanceBasedCulling range updated: minRange=${this.minRange}m, maxRange=${newMaxRange}m, cullDistance=${this.cullDistance}m`
    );
  }

  updateMinRange(newMinRange) {
    this.minRange = newMinRange;
    console.log(
      `DistanceBasedCulling min range updated: minRange=${newMinRange}m`
    );
  }
}
