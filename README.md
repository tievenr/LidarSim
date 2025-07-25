# Autonomous Vehicle Simulation with Livotech MID 360 LiDAR

This project simulates a **360° LiDAR environment** for digital twin and autonomous vehicle research. Built with **React**, **Three.js**, and **@react-three/fiber**, it provides a performant, extensible platform for generating and visualizing LiDAR point clouds in real time.

---

## Features

### LiDAR Simulation
- **Realistic Scan Pattern:** Simulates a rotating multi-channel LiDAR with configurable vertical and horizontal FOV, scan rate, and channel count.
- **Raycasting-Based Sensing:** Uses Three.js raycasting to simulate laser beams and compute hit points, distances, and intensities.
- **Circular Buffer System:** Efficiently manages large point clouds (50,000+ points) using a circular buffer to avoid memory bloat.
- **Frame-Based Capture:** Supports frame-by-frame point cloud capture for time-series analysis and dataset creation.

### Data Handling & Export
- **PCD Export:** Exports point cloud frames in the industry-standard PCD format, compatible with tools like CloudCompare and PCL.
- **ZIP Archive Export:** Bundles multiple frames and metadata into a single ZIP file for easy download.
- **Voxel Filtering:** Reduces redundant points using a voxel grid filter for efficient storage and visualization.

### Visualization & Controls
- **Real-Time Point Cloud Rendering:** Visualizes LiDAR returns as a dynamic point cloud using Three.js Points.
- **Interactive Scene Navigation:** Orbit, pan, and zoom controls for exploring the simulated environment.
- **Configurable Parameters:** UI controls for scan rate, points per frame, max range, and more.
- **Capture Controls:** Start/stop recording and export data directly from the UI.

---

## Data Flow Overview

1. **Scene Setup**
   - The environment is constructed using Three.js meshes (ground, road, static/dynamic objects).
   - BVH acceleration structures are computed for all static meshes to optimize raycasting.

2. **LiDAR Sensor Simulation**
   - The `LidarSensor` component manages the virtual LiDAR, updating scan angles and firing rays each frame.
   - For each scan, rays are cast from the sensor position in directions determined by the scan pattern and channel configuration.

3. **Raycasting & Point Generation**
   - Each ray uses Three.js's accelerated raycasting (with BVH) to find intersections with scene objects.
   - For each intersection, the hit point, intensity (based on material and angle), and timestamp are recorded.

4. **Point Buffering**
   - Points are stored in a high-performance circular buffer, supporting efficient incremental updates and visualization.
   - The buffer is updated every frame, and old points are overwritten as new data arrives.

5. **Visualization**
   - The point buffer is mapped to a Three.js `BufferGeometry` and rendered as a point cloud.
   - Only new or changed points are updated on the GPU each frame for maximum efficiency.

6. **Export & Filtering**
   - Captured frames can be exported as PCD files or zipped archives.
   - Optional voxel filtering reduces point cloud density for storage or downstream processing.

---

## Performance Optimizations

- **BVH Acceleration:** All static meshes use [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) for fast raycasting, enabling real-time simulation even with complex geometry.
- **Circular Buffer:** Point cloud data is managed in a circular buffer to minimize memory allocations and garbage collection.
- **Incremental GPU Updates:** Only new or changed points are sent to the GPU each frame, reducing WebGL overhead.
- **Distance-Based Culling:** Meshes outside the LiDAR's effective range are excluded from raycasting to further improve performance.
- **Frame Throttling:** LiDAR updates are throttled to a target FPS to balance accuracy and browser responsiveness.
- **Voxel Filtering:** Optional downsampling of point clouds using a voxel grid to reduce redundancy.

---

## Project Structure

```
src/
  components/
    Environment.jsx         // Scene setup and static objects
    StaticInstances.jsx     // Placeholder for instanced static objects
    DynamicInstances.jsx    // Placeholder for moving objects
    Lighting.jsx            // Lighting setup
    Scene.jsx               // Combines environment and LiDAR sensor
    UIControls.jsx          // User interface controls
  sensors/
    lidar/
      components/
        LidarSensor.jsx     // Main LiDAR simulation logic
        LidarSimulation.jsx // Top-level simulation wrapper
      config/
        LidarConfig.js      // Default and custom LiDAR configs
      context/
        LidarConfigContext.jsx // React context for config sharing
      logic/
        ScanningLogic.js    // Raycasting, scan pattern, and point generation
        VisualizationLogic.js // Point cloud visualization helpers
      utils/
        CircularPointBuffer.js // Efficient point buffer implementation
        DistanceBasedCulling.js // Mesh culling for performance
        ExportLogic.js      // Frame capture and export
        IntensityCalculator.js // Intensity computation
        RangeCalculator.js  // Range and reflectivity logic
        VoxelFilter.js      // Voxel grid downsampling
```

---

## Setup

1. **Clone the repository:**
   ```sh
   git clone https://github.com/tievenr/LidarSim.git
   cd LidarSim
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Start the development server:**
   ```sh
   npm run dev
   ```
4. **Open your browser and start scanning!**

---

## Current Development Focus

- **Performance Optimization:** Exploring Web Workers for parallel raycasting.
- **Higher Fidelity:** Improving scan pattern realism to better match actual Livox MID-360 behavior.
- **Memory Management:** Further reducing garbage collection and memory churn during intensive scans.
- **Motion Blur Handling:** Addressing issues with moving LiDAR sensors.

---

## Future Plans

- **Multiple Sensor Support:** Integrate additional sensor types (camera, radar, ultrasonic).
- **Scene Complexity:** Add more realistic environments and materials.
- **Data Pipeline Integration:** Support for autonomous vehicle simulation frameworks.
- **Real-Time Streaming:** Enable WebSocket support for live data feeds.

---

## Notes

- This project is intended for research, prototyping, and educational use. It is not suitable for safety-critical applications.
- Always validate simulation results with real sensor data for production or