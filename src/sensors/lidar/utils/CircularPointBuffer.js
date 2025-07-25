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

    this.lastReadIndex = 0; // Last position read by visualization
    this.addedSinceLastRead = 0; // Points added since last visualization read
    this.frameAdditionCount = 0; // Points added in current frame
    this.totalFrames = 0; // Total frames processed
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

    this.addedSinceLastRead++; // Track total points added since last visualization read
    this.frameAdditionCount++; // Track points added in current scanning frame
  }

  addBatch(newPointsData) {
    if (!newPointsData || newPointsData.length === 0) {
      return;
    }

    // Validate input data completeness
    if (newPointsData.length % this.componentsPerPoint !== 0) {
      console.warn(
        `addBatch received data with length ${newPointsData.length} which is not a multiple of ${this.componentsPerPoint}. Some points may be incomplete.`
      );
    }

    const numComponentsToAdd = newPointsData.length;
    const numPointsToAdd = numComponentsToAdd / this.componentsPerPoint;


    // Update tracking before buffer modification
    this.addedSinceLastRead += numPointsToAdd;
    this.frameAdditionCount += numPointsToAdd;

    // Calculate space from head to buffer end
    const spaceToEnd = this.bufferLength - this.headIndex;

    if (numComponentsToAdd <= spaceToEnd) {
      // Linear append - entire batch fits
      this.buffer.set(newPointsData, this.headIndex);
      this.headIndex += numComponentsToAdd;
    } else {
      // Wraparound - split batch into two segments
      const firstSegmentLength = spaceToEnd;
      this.buffer.set(
        newPointsData.subarray(0, firstSegmentLength),
        this.headIndex
      );

      const secondSegmentLength = numComponentsToAdd - firstSegmentLength;
      this.buffer.set(
        newPointsData.subarray(firstSegmentLength, numComponentsToAdd),
        0
      );

      this.headIndex = secondSegmentLength;
    }

    // Update buffer size with cap
    this.size = Math.min(this.size + numPointsToAdd, this.maxPoints);

    // Handle head wraparound
    if (this.headIndex >= this.bufferLength) {
      this.headIndex = 0;
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
  startFrame() {
    this.frameAdditionCount = 0; // Reset point counter for new scanning frame
    this.totalFrames++; // Increment total frame counter
  }

  endFrame() {
    const overwriteInfo = this.getOverwrittenPositions();

    return {
      pointsInFrame: this.frameAdditionCount,
      totalPointsSinceLastRead: this.addedSinceLastRead,
      frameNumber: this.totalFrames,
      hasWraparound: overwriteInfo.hasOverwrites,
      overwrittenRange: overwriteInfo.hasOverwrites
        ? {
            start: overwriteInfo.startIndex,
            count: overwriteInfo.count,
          }
        : null,
    };
  }

  getNewPointsTypedArray() {
    // Early return if no new points to extract
    if (this.addedSinceLastRead === 0) {
      return new Float32Array(0);
    }

    // Calculate total data size needed
    const newPointsCount = this.addedSinceLastRead;
    const totalComponents = newPointsCount * this.componentsPerPoint;
    const resultBuffer = new Float32Array(totalComponents);

    // Handle two scenarios based on buffer state
    if (this.size < this.maxPoints) {
      // SCENARIO 1: Buffer not full yet - simple linear extraction
      const startIndex = this.lastReadIndex;
      const endIndex = this.headIndex;
      const sourceData = this.buffer.subarray(startIndex, endIndex);
      resultBuffer.set(sourceData, 0);
    } else {
      // SCENARIO 2: Buffer is full - handle circular wraparound
      const readStartIndex = this.lastReadIndex;
      const currentHeadIndex = this.headIndex;

      if (readStartIndex <= currentHeadIndex) {
        // Case 2A: No wraparound - new points are linear
        const sourceData = this.buffer.subarray(
          readStartIndex,
          currentHeadIndex
        );
        resultBuffer.set(sourceData, 0);
      } else {
        // Case 2B: Wraparound occurred - new points are in two segments
        // First segment: from readStartIndex to end of buffer
        const firstSegment = this.buffer.subarray(readStartIndex);
        resultBuffer.set(firstSegment, 0);

        // Second segment: from start of buffer to currentHeadIndex
        const secondSegment = this.buffer.subarray(0, currentHeadIndex);
        resultBuffer.set(secondSegment, firstSegment.length);
      }
    }

    return resultBuffer;
  }

  markVisualizationRead() {
    this.lastReadIndex = this.headIndex; // Update last read position to current buffer head
    this.addedSinceLastRead = 0; // Reset counter - visualization is now up-to-date
  }

  hasWrappedSinceLastRead() {
    return this.size >= this.maxPoints && this.headIndex <= this.lastReadIndex;
    //returns true if the buffer has wrapped around since the last read
  }

  getOverwrittenPositions() {
    if (!this.hasWrappedSinceLastRead()) {
      return { hasOverwrites: false };
    }

    // When wraparound occurs, new data overwrites from index 0
    const overwriteStart = 0;
    const overwriteCount = this.headIndex / this.componentsPerPoint;

    return {
      hasOverwrites: true,
      startIndex: overwriteStart,
      count: overwriteCount, // Points from 0 to current headIndex
    };
  }
}
