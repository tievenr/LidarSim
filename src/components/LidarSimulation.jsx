// src/components/LidarSimulation.jsx
import React, { useState, useEffect } from 'react';
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
 * UI Controls component for LiDAR simulation
 * Adds controls for frame-based capture and export
 */
const UIControls = () =>
{
    const [ captureStatus, setCaptureStatus ] = useState( 'idle' );
    const [ frameStats, setFrameStats ] = useState( { frameCount: 0, totalPoints: 0 } );

    // Update stats periodically when capturing
    useEffect( () =>
    {
        if ( captureStatus === 'capturing' && window.lidarFrameManager )
        {
            const interval = setInterval( () =>
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }, 500 );

            return () => clearInterval( interval );
        }
    }, [ captureStatus ] );

    // Handle capture start/stop
    const toggleCapture = () =>
    {
        if ( captureStatus === 'idle' || captureStatus === 'stopped' )
        {
            window.startLidarCapture?.();
            setCaptureStatus( 'capturing' );
        } else
        {
            window.stopLidarCapture?.();
            setCaptureStatus( 'stopped' );

            // Update stats one final time
            if ( window.lidarFrameManager )
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }
        }
    };

    // Handle export
    const exportFrames = () =>
    {
        window.exportLidarFrames?.();
    };

    // Handle clear
    const clearFrames = () =>
    {
        window.clearLidarFrames?.();
        setFrameStats( { frameCount: 0, totalPoints: 0 } );
        setCaptureStatus( 'idle' );
    };

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
            gap: '5px',
            minWidth: '250px'
        }}>
            <div style={{ marginBottom: '10px' }}>
                <h3 style={{ margin: '0 0 5px 0' }}>Frame Capture</h3>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={toggleCapture}
                        style={{
                            flex: '1',
                            backgroundColor: captureStatus === 'capturing' ? '#f44336' : '#4CAF50',
                            color: 'white',
                            border: 'none',
                            padding: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {captureStatus === 'capturing' ? 'Stop Capture' : 'Start Capture'}
                    </button>
                </div>
            </div>

            <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                marginBottom: '10px',
                display: frameStats.frameCount > 0 ? 'block' : 'none'
            }}>
                <div>Frames: <strong>{frameStats.frameCount}</strong></div>
                <div>Total Points: <strong>{frameStats.totalPoints?.toLocaleString()}</strong></div>
                {frameStats.avgPointsPerFrame && (
                    <div>Avg Points/Frame: <strong>{frameStats.avgPointsPerFrame?.toLocaleString()}</strong></div>
                )}
                {frameStats.totalDuration && (
                    <div>Duration: <strong>{frameStats.totalDuration?.toFixed( 1 )}s</strong></div>
                )}
            </div>

            <div style={{
                display: 'flex',
                gap: '5px',
                opacity: frameStats.frameCount > 0 ? 1 : 0.5,
                pointerEvents: frameStats.frameCount > 0 ? 'auto' : 'none'
            }}>
                <button
                    onClick={exportFrames}
                    style={{
                        flex: '1',
                        backgroundColor: '#2196F3',
                        color: 'white',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    disabled={frameStats.frameCount === 0}
                >
                    Export ZIP ({frameStats.frameCount} frames)
                </button>

                <button
                    onClick={clearFrames}
                    style={{
                        backgroundColor: '#607D8B',
                        color: 'white',
                        border: 'none',
                        padding: '8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                    disabled={frameStats.frameCount === 0}
                >
                    Clear
                </button>
            </div>

            <div style={{ marginTop: '10px' }}>
                <button onClick={() => window.exportLidarPointCloudPCD?.()} style={{ width: '100%' }}>
                    Export Legacy PCD (All Points)
                </button>
            </div>
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