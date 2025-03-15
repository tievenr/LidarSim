import * as THREE from "three";

/**
 * Update visualization of point cloud
 */
export function updatePointCloudVisualization(
  pointsRef,
  pointCloudGeometry,
  pointCloudData
) {
  if (pointsRef.current && pointCloudData.length > 0) {
    const positions = [];
    const colors = [];

    pointCloudData.forEach((point) => {
      positions.push(point.x, point.y, point.z);
      const intensity = point.intensity;
      colors.push(intensity, intensity, intensity);
    });

    pointCloudGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    pointCloudGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    pointCloudGeometry.computeBoundingSphere();
  }
}

/**
 * Create debug ray visualization
 */
export function createDebugRay(origin, endpoint, intensity, scene) {
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    origin,
    endpoint,
  ]);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(intensity, intensity, intensity),
  });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(line);
  return line;
}

/**
 * Clear previous debug ray visualizations
 */
export function clearDebugRays(rayLines) {
  rayLines.forEach((line) => {
    if (line && line.parent) {
      line.parent.remove(line);
    }
  });
  return [];
}

/**
 * Create and initialize point cloud visualization components
 */
export function createPointCloudComponents() {
  const pointCloudGeometry = new THREE.BufferGeometry();
  const pointCloudMaterial = new THREE.PointsMaterial({
    size: 0.1,
    vertexColors: true,
  });

  return {
    pointCloudGeometry,
    pointCloudMaterial,
  };
}
