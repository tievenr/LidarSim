import * as THREE from "three";

export class DistanceBasedCulling {
  constructor(maxRange = 70, bufferDistance = 10, minRange = 0.2) {
    this.maxRange = maxRange;
    this.minRange = minRange;
    this.bufferDistance = bufferDistance;
    this.cullDistance = maxRange + bufferDistance;
    this.sensorPosition = new THREE.Vector3();
    this.tempVector = new THREE.Vector3(); // Reused temp vector
    this.tempSphere = new THREE.Sphere(); // Reused temp sphere

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

  // Optimized to return culling status and distance/reason
  _getCullingStatus(mesh) {
    if (!mesh || !mesh.geometry) {
      return { culled: false, distance: 0, tooClose: false, tooFar: false };
    }

    // Ensure boundingSphere is computed. This call can be expensive if not already done.
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }

    this.tempSphere.copy(mesh.geometry.boundingSphere);
    this.tempSphere.center.applyMatrix4(mesh.matrixWorld);
    const distance = this.sensorPosition.distanceTo(this.tempSphere.center);

    const tooClose = distance + this.tempSphere.radius < this.minRange;
    const tooFar = distance - this.tempSphere.radius > this.cullDistance;

    return {
      culled: tooClose || tooFar,
      distance: distance,
      tooClose: tooClose,
      tooFar: tooFar,
      radius: this.tempSphere.radius, // Include radius for comprehensive info
    };
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
  }

  updateMinRange(newMinRange) {
    this.minRange = newMinRange;
  }

  cullMeshes(meshes, sensorPosition) {
    const startTime = performance.now();
    this.updateSensorPosition(sensorPosition);
    this.resetDistanceTracking();

    const visibleMeshes = [];
    let tooCloseCount = 0;
    let tooFarCount = 0;

    for (const mesh of meshes) {
      // Get all culling status info in one call
      const status = this._getCullingStatus(mesh);

      // Update overall min/max distance stats
      this.stats.minDistance = Math.min(
        this.stats.minDistance,
        status.distance
      );
      this.stats.maxDistance = Math.max(
        this.stats.maxDistance,
        status.distance
      );

      if (status.culled) {
        if (status.tooClose) {
          tooCloseCount++;
        } else if (status.tooFar) {
          tooFarCount++;
        }
      } else {
        visibleMeshes.push(mesh);
      }
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    this.updateStats(
      meshes.length,
      visibleMeshes.length,
      processingTime,
      tooCloseCount,
      tooFarCount
    );

    return {
      visibleMeshes: visibleMeshes,
      statistics: {
        total: meshes.length,
        visible: visibleMeshes.length,
        culled: meshes.length - visibleMeshes.length,
        tooClose: tooCloseCount,
        tooFar: tooFarCount,
        processingTime: processingTime,
      },
    };
  }
}
