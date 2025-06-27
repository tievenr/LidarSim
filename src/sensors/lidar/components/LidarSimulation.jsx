import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import Scene from '../../../components/Scene';
import UIControls from '../../../components/UIControls';
import { LidarConfigProvider } from '../context/LidarConfigContext';
import * as THREE from 'three';

const LidarSimulation = () =>
{
    return (
        <LidarConfigProvider>
            <div style={{ width: '100vw', height: '100vh' }}>
                <Canvas camera={{ position: [ 0, 5, 15 ], fov: 50 }}>
                    <Scene />
                    <OrbitControls
                        // Smooth movement
                        enableDamping={true}
                        dampingFactor={0.05}
                        enablePan={true}
                        enableZoom={true}
                        enableRotate={true}

                        // Pan settings
                        panSpeed={1.0}
                        screenSpacePanning={false}  
                        zoomSpeed={1.0}
                        minDistance={1}
                        maxDistance={100}
                        maxPolarAngle={Math.PI}

                        // Explicit mouse button mapping
                        mouseButtons={{
                            LEFT: THREE.MOUSE.ROTATE,
                            MIDDLE: THREE.MOUSE.DOLLY,
                            RIGHT: THREE.MOUSE.PAN
                        }}

                    />
                    <Stats />
                </Canvas>
                <UIControls />
            </div>
        </LidarConfigProvider>
    );
};

export default LidarSimulation;