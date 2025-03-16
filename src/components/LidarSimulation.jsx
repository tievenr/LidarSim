// src/components/LidarSimulation.jsx
import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Box, Sphere, Plane } from '@react-three/drei';
import LidarSensor from './LidarSensor';

/**
 * Environment component - Contains all the 3D objects in the scene
 */
const Environment = () =>
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

            {/* Room walls */}
            <RoomWalls />

            {/* Sample objects for scanning */}
            <ScanningObjects />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[ 10, 10, 5 ]} intensity={1} />
        </>
    );
};

/**
 * Room walls component
 */
const RoomWalls = () =>
{
    // Wall dimensions and properties
    const wallHeight = 10;
    const roomSize = 30;
    const wallThickness = 0.5;
    const wallColor = "#888888";

    return (
        <>
            {/* North wall */}
            <Box
                position={[ 0, 3, -roomSize / 2 ]}
                args={[ roomSize, wallHeight, wallThickness ]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* West wall */}
            <Box
                position={[ -roomSize / 2, 3, 0 ]}
                args={[ wallThickness, wallHeight, roomSize ]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* East wall */}
            <Box
                position={[ roomSize / 2, 3, 0 ]}
                args={[ wallThickness, wallHeight, roomSize ]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* South wall */}
            <Box
                position={[ 0, 3, roomSize / 2 ]}
                args={[ roomSize, wallHeight, wallThickness ]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>
        </>
    );
};

/**
 * Sample objects for LiDAR to scan
 */
const ScanningObjects = () =>
{
    return (
        <>
            {/* Orange box */}
            <Box position={[ -5, 0, -5 ]} args={[ 2, 4, 2 ]}>
                <meshStandardMaterial color="orange" />
            </Box>

            {/* Blue box */}
            <Box position={[ 5, 0, 3 ]} args={[ 3, 1, 3 ]}>
                <meshStandardMaterial color="blue" />
            </Box>

            {/* Green sphere */}
            <Sphere position={[ 0, 0, -8 ]} args={[ 1.5, 32, 32 ]}>
                <meshStandardMaterial color="green" />
            </Sphere>
        </>
    );
};

/**
 * Scene component - Contains environment and LiDAR sensor
 */
const Scene = ( { showDebugRays } ) =>
{
    return (
        <>
            <Environment />

            {/* LiDAR sensor */}
            <LidarSensor position={[ 0, 2, 0 ]} showDebugRays={showDebugRays} />
        </>
    );
};

/**
 * UI Controls component
 */
const UIControls = () =>
{
    return (
        <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
        }}>
            <button onClick={() => window.exportLidarPointCloudPCD?.()}>
                Export as PCD
            </button>
        
        </div>
    );
};
/**
 * Main LidarSimulation component
 */
const LidarSimulation = () =>
{
    const [ debugMode, setDebugMode ] = useState( false ); // Default to false for better performance

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <Canvas camera={{ position: [ 10, 10, 10 ], fov: 50 }}>
                <Scene showDebugRays={debugMode} />
                <OrbitControls />
                <Stats />
            </Canvas>

            <UIControls />
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px'
            }}>
                <label>
                    <input
                        type="checkbox"
                        checked={debugMode}
                        onChange={() => setDebugMode( !debugMode )}
                    />
                    Show Debug Rays
                </label>
            </div>
        </div>
    );
};

export default LidarSimulation;