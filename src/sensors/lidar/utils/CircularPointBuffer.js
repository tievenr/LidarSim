import * as THREE from "three";

class CircularPointBuffer {
  constructor(maxPoints, componentsPerPoint) {
    this.maxPoints = maxPoints;
    this.componentsPerPoint = componentsPerPoint;
    this.bufferLength = this.maxPoints * this.componentsPerPoint;
    this.buffer = new Float32Array(this.bufferLength);
    this.headIndex = 0;
    this.size = 0;
    this.lastReadIndex = 0;
  }

  addBatch(newPointsData) {
    if (!newPointsData || newPointsData.length === 0) {
      return;
    }

    // Warn but do not fail on malformed data. The consumer should handle this.
    if (newPointsData.length % this.componentsPerPoint !== 0) {
      console.warn(
        "addBatch received data with a length that is not a multiple of componentsPerPoint."
      );
    }

    const numComponentsToAdd = newPointsData.length;
    const numPointsToAdd = numComponentsToAdd / this.componentsPerPoint;
    const spaceToEnd = this.bufferLength - this.headIndex;

    if (numComponentsToAdd <= spaceToEnd) {
      // Linear append
      this.buffer.set(newPointsData, this.headIndex);
      this.headIndex += numComponentsToAdd;
    } else {
      // Wraparound
      const firstSegmentLength = spaceToEnd;
      const secondSegmentLength = numComponentsToAdd - firstSegmentLength;
      this.buffer.set(
        newPointsData.subarray(0, firstSegmentLength),
        this.headIndex
      );
      this.buffer.set(
        newPointsData.subarray(firstSegmentLength, numComponentsToAdd),
        0
      );
      this.headIndex = secondSegmentLength;
    }

    this.size = Math.min(this.size + numPointsToAdd, this.maxPoints);

    if (this.headIndex >= this.bufferLength) {
      this.headIndex = 0;
    }
  }

  getUpdateInfo() {
    const numPointsSinceLastRead =
      this.headIndex >= this.lastReadIndex
        ? (this.headIndex - this.lastReadIndex) / this.componentsPerPoint
        : (this.bufferLength - this.lastReadIndex + this.headIndex) /
          this.componentsPerPoint;

    if (numPointsSinceLastRead === 0) {
      return {
        newPoints: new Float32Array(0),
        hasWraparound: false,
        updateInfo: null,
      };
    }

    const newPoints = new Float32Array(
      numPointsSinceLastRead * this.componentsPerPoint
    );
    const hasWraparound = this.headIndex < this.lastReadIndex;

    if (!hasWraparound) {
      // Linear copy
      newPoints.set(this.buffer.subarray(this.lastReadIndex, this.headIndex));
    } else {
      // Wraparound copy
      const firstSegment = this.buffer.subarray(this.lastReadIndex);
      newPoints.set(firstSegment, 0);
      newPoints.set(
        this.buffer.subarray(0, this.headIndex),
        firstSegment.length
      );
    }

    const updateInfo = {
      offset: this.lastReadIndex,
      count: numPointsSinceLastRead * this.componentsPerPoint,
    };

    // Atomically update the last read index
    this.lastReadIndex = this.headIndex;

    return { newPoints, hasWraparound, updateInfo };
  }
}
export { CircularPointBuffer };