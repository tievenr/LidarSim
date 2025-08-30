import * as THREE from "three";

/**
 * Pose graph optimization for SLAM
 * Optimizes the entire trajectory using loop closure constraints
 */
export class PoseGraphOptimizer {
  constructor(options = {}) {
    this.options = {
      maxIterations: 100,
      convergenceThreshold: 1e-6,
      dampingFactor: 0.1,
      huberLossThreshold: 1.0,
      ...options,
    };

    // Pose graph structure
    this.nodes = new Map(); // nodeId -> pose
    this.edges = []; // {from, to, measurement, information}

    // Optimization state
    this.isOptimized = false;
    this.lastError = 0;
    this.iterations = 0;

    console.log("PoseGraphOptimizer initialized with options:", this.options);
  }

  /**
   * Add a pose node to the graph
   * @param {string} nodeId - Unique node identifier
   * @param {Object} pose - Initial pose estimate
   */
  addNode(nodeId, pose) {
    this.nodes.set(nodeId, {
      id: nodeId,
      pose: { ...pose },
      fixed: false, // Can be optimized
    });
    this.isOptimized = false;
  }

  /**
   * Add a constraint edge between two nodes
   * @param {string} fromNodeId - Source node
   * @param {string} toNodeId - Target node
   * @param {Object} measurement - Measured relative pose
   * @param {THREE.Matrix3} information - Information matrix (inverse covariance)
   */
  addEdge(fromNodeId, toNodeId, measurement, information = null) {
    if (!this.nodes.has(fromNodeId) || !this.nodes.has(toNodeId)) {
      console.warn("Cannot add edge: nodes not found");
      return;
    }

    // Default information matrix (identity with some uncertainty)
    if (!information) {
      information = new THREE.Matrix3();
      information.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    }

    this.edges.push({
      from: fromNodeId,
      to: toNodeId,
      measurement: { ...measurement },
      information: information.clone(),
      type: "odometry", // or 'loop_closure'
    });

    this.isOptimized = false;
  }

  /**
   * Add a loop closure constraint
   * @param {string} fromNodeId - Source node
   * @param {string} toNodeId - Target node
   * @param {Object} measurement - Measured relative pose
   * @param {number} confidence - Confidence in the measurement [0, 1]
   */
  addLoopClosure(fromNodeId, toNodeId, measurement, confidence = 0.8) {
    // Higher information for loop closures
    const information = new THREE.Matrix3();
    const scale = confidence * 10; // Scale information by confidence
    information.set(scale, 0, 0, 0, scale, 0, 0, 0, scale);

    const edge = {
      from: fromNodeId,
      to: toNodeId,
      measurement: { ...measurement },
      information: information,
      type: "loop_closure",
    };

    this.edges.push(edge);
    this.isOptimized = false;

    console.log(`Added loop closure: ${fromNodeId} -> ${toNodeId}`);
  }

  /**
   * Fix a node's pose (make it non-optimizable)
   * @param {string} nodeId - Node to fix
   */
  fixNode(nodeId) {
    if (this.nodes.has(nodeId)) {
      this.nodes.get(nodeId).fixed = true;
    }
  }

  /**
   * Optimize the pose graph
   * @returns {Object} Optimization result
   */
  optimize() {
    if (this.nodes.size < 2) {
      return { success: true, error: 0, iterations: 0 };
    }

    console.log(
      `Optimizing pose graph with ${this.nodes.size} nodes and ${this.edges.size} edges`
    );

    this.iterations = 0;
    this.lastError = Infinity;

    // Levenberg-Marquardt optimization
    for (let iter = 0; iter < this.options.maxIterations; iter++) {
      const result = this.optimizeStep();

      if (!result.success) {
        console.warn("Optimization step failed");
        break;
      }

      this.iterations = iter + 1;

      // Check convergence
      if (
        Math.abs(this.lastError - result.error) <
        this.options.convergenceThreshold
      ) {
        console.log(
          `Optimization converged after ${this.iterations} iterations`
        );
        break;
      }

      this.lastError = result.error;
    }

    this.isOptimized = true;
    return {
      success: true,
      error: this.lastError,
      iterations: this.iterations,
    };
  }

  /**
   * Perform one optimization step
   * @returns {Object} Step result
   */
  optimizeStep() {
    // Build the linear system: H * delta = b
    const H = this.buildHessian();
    const b = this.buildGradientVector();

    if (!H || !b) {
      return { success: false, error: Infinity };
    }

    // Add damping (Levenberg-Marquardt)
    const damping = this.options.dampingFactor;
    H.elements[0] += damping;
    H.elements[4] += damping;
    H.elements[8] += damping;

    // Solve H * delta = b
    const delta = this.solveLinearSystem(H, b);

    if (!delta) {
      return { success: false, error: Infinity };
    }

    // Update poses
    this.updatePoses(delta);

    // Compute new error
    const error = this.computeTotalError();

    return { success: true, error: error };
  }

  /**
   * Build the Hessian matrix
   * @returns {THREE.Matrix3} Hessian matrix
   */
  buildHessian() {
    const H = new THREE.Matrix3();
    H.set(0, 0, 0, 0, 0, 0, 0, 0, 0);

    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (fromNode.fixed && toNode.fixed) continue;

      // Compute error and Jacobian
      const error = this.computeEdgeError(edge);
      const jacobian = this.computeJacobian(edge);

      // Add to Hessian: J^T * Ω * J
      const JT = jacobian.clone().transpose();
      const temp = JT.clone().multiply(edge.information);
      const contribution = temp.clone().multiply(jacobian);

      H.add(contribution);
    }

    return H;
  }

  /**
   * Build the gradient vector
   * @returns {THREE.Vector3} Gradient vector
   */
  buildGradientVector() {
    const b = new THREE.Vector3();

    for (const edge of this.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (fromNode.fixed && toNode.fixed) continue;

      const error = this.computeEdgeError(edge);
      const jacobian = this.computeJacobian(edge);

      // b += J^T * Ω * error
      const JT = jacobian.clone().transpose();
      const temp = JT.clone().multiply(edge.information);
      const contribution = temp.clone().multiplyVector(error);

      b.add(contribution);
    }

    return b;
  }

  /**
   * Compute error for an edge
   * @param {Object} edge - Edge to compute error for
   * @returns {THREE.Vector3} Error vector
   */
  computeEdgeError(edge) {
    const fromNode = this.nodes.get(edge.from);
    const toNode = this.nodes.get(edge.to);

    // Predicted relative pose
    const predicted = this.computeRelativePose(fromNode.pose, toNode.pose);

    // Measured relative pose
    const measured = edge.measurement;

    // Error = predicted - measured
    return new THREE.Vector3(
      predicted.x - measured.x,
      predicted.y - measured.y,
      predicted.z - measured.z
    );
  }

  /**
   * Compute Jacobian matrix for an edge
   * @param {Object} edge - Edge to compute Jacobian for
   * @returns {THREE.Matrix3} Jacobian matrix
   */
  computeJacobian(edge) {
    // Simplified Jacobian - in practice this would be more complex
    // For now, use identity matrix as approximation
    const J = new THREE.Matrix3();
    J.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
    return J;
  }

  /**
   * Compute relative pose between two poses
   * @param {Object} fromPose - Source pose
   * @param {Object} toPose - Target pose
   * @returns {Object} Relative pose
   */
  computeRelativePose(fromPose, toPose) {
    return {
      x: toPose.x - fromPose.x,
      y: toPose.y - fromPose.y,
      z: toPose.z - fromPose.z,
    };
  }

  /**
   * Solve linear system H * delta = b
   * @param {THREE.Matrix3} H - Hessian matrix
   * @param {THREE.Vector3} b - Gradient vector
   * @returns {THREE.Vector3} Solution delta
   */
  solveLinearSystem(H, b) {
    // For 3x3 system, we can use direct inversion
    const H_inv = H.clone().invert();

    if (!H_inv) {
      console.warn("Hessian is singular");
      return null;
    }

    return b.clone().applyMatrix3(H_inv);
  }

  /**
   * Update poses using computed delta
   * @param {THREE.Vector3} delta - Pose updates
   */
  updatePoses(delta) {
    // Simplified: apply same delta to all non-fixed nodes
    // In practice, this would be more sophisticated
    for (const node of this.nodes.values()) {
      if (!node.fixed) {
        node.pose.x += delta.x * 0.1; // Small step
        node.pose.y += delta.y * 0.1;
        node.pose.z += delta.z * 0.1;
      }
    }
  }

  /**
   * Compute total error of the graph
   * @returns {number} Total error
   */
  computeTotalError() {
    let totalError = 0;

    for (const edge of this.edges) {
      const error = this.computeEdgeError(edge);
      totalError += error.lengthSq();
    }

    return totalError;
  }

  /**
   * Get optimized pose for a node
   * @param {string} nodeId - Node identifier
   * @returns {Object} Optimized pose
   */
  getOptimizedPose(nodeId) {
    const node = this.nodes.get(nodeId);
    return node ? { ...node.pose } : null;
  }

  /**
   * Get all optimized poses
   * @returns {Map} All optimized poses
   */
  getAllOptimizedPoses() {
    const poses = new Map();
    for (const [id, node] of this.nodes) {
      poses.set(id, { ...node.pose });
    }
    return poses;
  }

  /**
   * Reset the optimizer
   */
  reset() {
    this.nodes.clear();
    this.edges.length = 0;
    this.isOptimized = false;
    this.lastError = 0;
    this.iterations = 0;
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      nodes: this.nodes.size,
      edges: this.edges.length,
      loopClosures: this.edges.filter((e) => e.type === "loop_closure").length,
      isOptimized: this.isOptimized,
      finalError: this.lastError,
      iterations: this.iterations,
    };
  }

  /**
   * Export pose graph for debugging
   * @returns {Object} Graph data
   */
  exportGraph() {
    return {
      nodes: Array.from(this.nodes.values()).map((node) => ({
        id: node.id,
        pose: node.pose,
        fixed: node.fixed,
      })),
      edges: this.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        measurement: edge.measurement,
        type: edge.type,
      })),
      statistics: this.getStatistics(),
    };
  }
}
