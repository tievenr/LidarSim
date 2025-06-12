import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import Scene from '../../../components/Scene';
import UIControls from '../../../components/UIControls';
import { LidarConfigProvider } from '../context/LidarConfigContext';

/**
 * Main LiDAR simulation component
 */
const LidarSimulation = () =>
{
    return (
        <LidarConfigProvider>
            <div style={{ width: '100vw', height: '100vh' }}>
                <Canvas camera={{ position: [ 0, 5, 15 ], fov: 50 }}>
                    <Scene />
                    <OrbitControls
                        enableDamping={false}
                        dampingFactor={0}
                        enablePan={true}
                        enableZoom={true}
                        enableRotate={true}
                        maxPolarAngle={Math.PI}
                        minDistance={1}
                        maxDistance={100}
                    />
                    <Stats />
                </Canvas>
                <UIControls />
            </div>
        </LidarConfigProvider>
    );
};

export default LidarSimulation;