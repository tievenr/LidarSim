export class CircularPointBuffer {
  constructor(maxPoints = 200000, componentsPerPoint = 4) {
    if (maxPoints <= 0 || !Number.isInteger(maxPoints)) {
      throw new Error("maxPoints must be a positive integer.");
    }
    if (componentsPerPoint <= 0 || !Number.isInteger(componentsPerPoint)) {
      throw new Error("componentsPerPoint must be a positive integer.");
    }

    this.maxPoints = maxPoints;
    this.componentsPerPoint = componentsPerPoint;
    this.bufferLength = maxPoints * componentsPerPoint;
    this.buffer = new Float32Array(this.bufferLength);
    this.headIndex = 0;
    this.size = 0;
  }

  add(point) {
    let pointComponents;

    if (Array.isArray(point)) {
      pointComponents = point;
    } else {
      pointComponents = [point.x, point.y, point.z, point.intensity];
    }

    if (pointComponents.length !== this.componentsPerPoint) {
      console.warn(
        `Point has ${pointComponents.length} components, expected ${this.componentsPerPoint}. Skipping.`
      );
      return;
    }

    for (let i = 0; i < this.componentsPerPoint; i++) {
      this.buffer[this.headIndex + i] = pointComponents[i];
    }

    this.headIndex = this.headIndex + this.componentsPerPoint;
    if (this.headIndex >= this.bufferLength) {
      this.headIndex = 0;
    }

    if (this.size < this.maxPoints) {
      this.size++;
    }
  }

  getPointsAsTypedArray() {
    if (this.size === 0) {
      return new Float32Array(0);
    }

    const resultBuffer = new Float32Array(this.size * this.componentsPerPoint);

    if (this.size < this.maxPoints) {
      resultBuffer.set(this.buffer.subarray(0, this.headIndex));
    } else {
      const tailIndex = this.headIndex;
      const firstSegment = this.buffer.subarray(tailIndex);
      resultBuffer.set(firstSegment, 0);
      const secondSegment = this.buffer.subarray(0, tailIndex);
      resultBuffer.set(secondSegment, firstSegment.length);
    }

    return resultBuffer;
  }

  getPoints() {
    const typedArray = this.getPointsAsTypedArray();
    const points = [];

    for (let i = 0; i < this.size; i++) {
      const baseIndex = i * this.componentsPerPoint;
      points.push({
        x: typedArray[baseIndex],
        y: typedArray[baseIndex + 1],
        z: typedArray[baseIndex + 2],
        intensity: typedArray[baseIndex + 3],
      });
    }

    return points;
  }

  clear() {
    this.headIndex = 0;
    this.size = 0;
  }

  getCurrentSize() {
    return this.size;
  }

  getMaxSize() {
    return this.maxPoints;
  }
}
