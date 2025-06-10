# Autonomous Vehicle Simulation with Livotech MID 360 LiDAR

This project simulates a **360° LiDAR environment** for my personal **Digital Twin** applications. Built with **React, Three.js, and @react-three/fiber**, it uses a placeholder **Livotech MID 360 LiDAR**(currently low fidelity) to scan and generate simulated point clouds of the environment.


### **LiDAR Simulation Features**
- **Circular Buffer System**: Handles 50K+ points without melting your browser
- **Real-time Visualization**: Watch those points get generated in real-time

### **Export & Data Handling**
- **PCD Format Export**: Industry standard format (works with CloudCompare, PCL, etc.)
- **ZIP Archive Export**: Multiple frames bundled with metadata
- **Frame-by-Frame Capture**: Perfect for creating datasets or time-series analysis
- **Voxel Filtering**: Because nobody wants 50 million duplicate points

### **Interactive Controls**
- **Debug Ray Visualization**: See exactly where your rays are going (pretty cool to watch)
- **Capture Controls**: Start/stop recording like a dashcam
- **Scene Navigation**: Fly around and see your LiDAR from different angles

## **Setup**
1. Clone the repository:
   ```sh
   git clone https://github.com/tievenr/LidarSim.git
   cd LidarSim
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Start the development server:
   ```sh
   npm run dev
   ```
4. Open your browser and start scanning! 

## **How It Works**

The simulation uses **Three.js raycasting** to simulate laser beams hitting objects in the 3D scene. Each ray calculates:
- **Distance** to the hit point
- **Intensity** based on material properties and distance
- **Channel ID** based on the vertical angle
- **Timestamp** for temporal analysis


### **Currently Working On**
- **Performance Optimization**: Implementing Web Workers for parallel ray casting 
- **Higher Fidelity**: Better approximation of actual Livox MID-360 scan patterns
- **Memory Improvements**: Reducing garbage collection during intensive scanning
-**Fixing Motion Blure for Moving Lidar**: Erm it doesn't work as of now.

### **Future Plans**
- **Multiple Sensor Support**: Add camera, radar, and ultrasonic sensors
- **Scene Complexity**: More realistic environments and materials
- **Data Pipeline**: Integration with autonomous vehicle simulation frameworks
- **Real-time Streaming**: WebSocket support for live data feeds

The LiDAR simulation runs entirely in the browser - no server required! Perfect for prototyping, education, or just having fun with 3D point clouds.

---

**Note**: This is a personal project for digital twin applications. While it simulates LiDAR behavior, it's not intended for safety-critical applications. Always validate with real sensor data! 🙏💀