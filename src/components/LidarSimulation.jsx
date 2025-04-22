// src/components/LidarSimulation.jsx
import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import Scene from './Scene';
import UIControls from './UIControls';

/**
 * Main LiDAR simulation component
 */
const LidarSimulation = () => {
    const [showDebugRays, setShowDebugRays] = useState(false);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas camera={{ position: [0, 5, 15], fov: 50 }}>
                <Scene showDebugRays={showDebugRays} />
                <OrbitControls />
                <Stats />
            </Canvas>
            <UIControls />
        </div>
    );
};

export default LidarSimulation;