// src/components/LidarSimulation.jsx
import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Box, Sphere, Plane } from '@react-three/drei';
import LidarSensor from './LidarSensor';

// Main scene component
const Scene = () =>
{
    return (
        <>
            {/* Ground plane */}
            <Plane
                args={[ 50, 50 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
                position={[ 0, -2, 0 ]}
            >
                <meshStandardMaterial color="#555555" />
            </Plane>

            {/* Sample environment for scanning */}
            <Box position={[ -5, 0, -5 ]} args={[ 2, 4, 2 ]}>
                <meshStandardMaterial color="orange" />
            </Box>

            <Box position={[ 5, 0, 3 ]} args={[ 3, 1, 3 ]}>
                <meshStandardMaterial color="blue" />
            </Box>

            <Sphere position={[ 0, 0, -8 ]} args={[ 1.5, 32, 32 ]}>
                <meshStandardMaterial color="green" />
            </Sphere>

            {/* Add some walls to simulate a room */}
            <Box position={[ 0, 3, -15 ]} args={[ 30, 10, 0.5 ]}>
                <meshStandardMaterial color="#888888" />
            </Box>

            <Box position={[ -15, 3, 0 ]} args={[ 0.5, 10, 30 ]}>
                <meshStandardMaterial color="#888888" />
            </Box>

            <Box position={[ 15, 3, 0 ]} args={[ 0.5, 10, 30 ]}>
                <meshStandardMaterial color="#888888" />
            </Box>

            <Box position={[ 0, 3, 15 ]} args={[ 30, 10, 0.5 ]}>
                <meshStandardMaterial color="#888888" />
            </Box>

            {/* LiDAR sensor */}
            <LidarSensor position={[ 0, 2, 0 ]} showDebugRays={true} />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[ 10, 10, 5 ]} intensity={1} />
        </>
    );
};

// Main component
const LidarSimulation = () =>
{
    // Add UI controls for LiDAR parameters if needed
    const [ debugMode, setDebugMode ] = useState( true );

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <Canvas camera={{ position: [ 10, 10, 10 ], fov: 50 }}>
                <Scene />
                <OrbitControls />
                <Stats />
            </Canvas>

            {/* Optional UI controls */}
            <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px'
            }}>
                <button onClick={() => window.exportLidarPointCloud?.()}>
                    Export Point Cloud
                </button>
            </div>
        </div>
    );
};

export default LidarSimulation;