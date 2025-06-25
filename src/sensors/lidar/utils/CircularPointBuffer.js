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

    // Single Float32Array for all point data (x,y,z,intensity interleaved)
    this.buffer = new Float32Array(this.bufferLength);

    this.headIndex = 0;
    this.size = 0;
  }

  /**
   * Add point to buffer - accepts both {x,y,z,intensity} objects and [x,y,z,intensity] arrays
   */
  add(point) {
    let pointComponents;

    // Handle both {x,y,z,intensity} objects and [x,y,z,intensity] arrays
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

    // Write components to buffer
    for (let i = 0; i < this.componentsPerPoint; i++) {
      this.buffer[this.headIndex + i] = pointComponents[i];
    }

    // Move head index with wraparound
    this.headIndex = this.headIndex + this.componentsPerPoint;
    if (this.headIndex >= this.bufferLength) {
      this.headIndex = 0;
    }

    // Update size
    if (this.size < this.maxPoints) {
      this.size++;
    }
  }

  /**
   * Get points as Float32Array (for performance), ordered from oldest to newest.
   */
  getPointsAsTypedArray() {
    if (this.size === 0) {
      return new Float32Array(0);
    }

    const resultBuffer = new Float32Array(this.size * this.componentsPerPoint);

    if (this.size < this.maxPoints) {
      // Buffer is not yet full, data is contiguous from index 0 up to headIndex.
      resultBuffer.set(this.buffer.subarray(0, this.headIndex));
    } else {
      // Buffer is full (this.size === this.maxPoints).
      // The "tail" (oldest point) is at this.headIndex.
      const tailIndex = this.headIndex;

      // Copy the segment from tailIndex to the end of the buffer.
      const firstSegment = this.buffer.subarray(tailIndex);
      resultBuffer.set(firstSegment, 0);

      // Copy the segment from the beginning of the buffer up to the tailIndex.
      const secondSegment = this.buffer.subarray(0, tailIndex);
      resultBuffer.set(secondSegment, firstSegment.length);
    }

    return resultBuffer;
  }

  /**
   * Get points as objects (for backward compatibility)
   */
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
