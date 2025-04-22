import * as THREE from "three";
import { calculateRayDirection } from './ScanningLogic';

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

/**
 * Visualizes the current scan pattern in the scene
 * @param {THREE.Scene} scene - The Three.js scene
 * @param {Object} lidarConfig - LiDAR configuration
 * @param {Object} scanState - Current scan state
 */
export function visualizeScanPattern(scene, lidarConfig, scanState) {
    // Clear previous visualization
    const oldPoints = scene.children.filter(child => child.name === "scanPatternPoint");
    oldPoints.forEach(point => scene.remove(point));
    
    // Create points for visualization
    for (let i = 0; i < 500; i++) {
        // Calculate pattern based on our new algorithm
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const angleIncrement = Math.PI * 2 * goldenRatio;
        const normalizedIndex = i / 500;
        
        const currentHAngle = scanState.horizontalAngle + angleIncrement * i;
        const verticalPosition = Math.pow(normalizedIndex, 0.5);
        const verticalRange = lidarConfig.verticalFOVMax - lidarConfig.verticalFOVMin;
        const verticalAngle = lidarConfig.verticalFOVMin + verticalPosition * verticalRange;
        
        const hAngleRad = currentHAngle % (Math.PI * 2);
        const vAngleRad = THREE.MathUtils.degToRad(verticalAngle);
        
        // Create direction vector and point at unit distance
        const direction = calculateRayDirection(hAngleRad, vAngleRad);
        
        // Create a visual point
        const geometry = new THREE.SphereGeometry(0.02, 4, 4);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const point = new THREE.Mesh(geometry, material);
        
        // Position at unit distance from sensor
        point.position.copy(direction);
        point.name = "scanPatternPoint";
        scene.add(point);
    }
}

/**
 * Clears the scan pattern visualization
 * @param {THREE.Scene} scene - The Three.js scene
 */
export function clearScanPattern(scene) {
    const oldPoints = scene.children.filter(child => child.name === "scanPatternPoint");
    oldPoints.forEach(point => scene.remove(point));
}
