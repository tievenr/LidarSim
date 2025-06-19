import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere } from '@react-three/drei';
import
{
    initializeVerticalAngles,
    updateScanAngle,
    getSensorPosition,
    collectIntersectableMeshes,
    castRaysForFrame,
} from '../logic/ScanningLogic';
import
{
    visualizeScanPattern,
    clearScanPattern
} from '../logic/VisualizationLogic';
import { LidarFrameManager } from '../utils/ExportLogic';
import { createLidarConfig } from '../config/LidarConfig';
import { useLidarConfig } from '../context/LidarConfigContext';
import { CircularPointBuffer } from '../utils/CircularPointBuffer'; // <--- Correct import for your buffer

// Maximum number of points to store in the circular buffer for visualization.
// Adjust this value based on desired performance vs. visual density.
const MAX_POINTS = 100000; // Increased to provide a denser visualization history

/**
 * LidarSensor component with frame-based point cloud capture
 * Uses typed arrays and fixed memory allocation for visualization
 * Captures and exports frames as individual PCD files in a ZIP
 */
const LidarSensor = ( {
    position = [ 0, 2, 0 ],
    config = {}
} ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();
    const startTime = useRef( Date.now() );
    const frameCounter = useRef( 0 ); // For tracking frame updates for stats

    // Get configuration from context
    const { config: contextConfig } = useLidarConfig();

    // Frame manager for capturing and exporting frames
    const frameManager = useRef( null );
    const [ isCapturing, setIsCapturing ] = useState( false );
    const [ frameStats, setFrameStats ] = useState( { frameCount: 0 } );
    const [ showPattern, setShowPattern ] = useState( false );

    const lidarConfig = useMemo( () =>
    {
        return createLidarConfig( {
            ...contextConfig,
            ...config
        } );
    }, [ contextConfig, config ] );

    // High-performance circular buffer for visualization point data
    // This will hold x,y,z,intensity for each point
    const pointBuffer = useRef( new CircularPointBuffer( MAX_POINTS, 4 ) ); // 4 components: x,y,z,intensity

    // Scanning state
    const scanState = useRef( {
        horizontalAngle: 0,
        verticalAngles: initializeVerticalAngles(
            lidarConfig.numChannels,
            lidarConfig.verticalFOV,
            lidarConfig.verticalFOVMin,
            lidarConfig.verticalFOVMax
        ),
        scanPhase: 0,
        frameCount: 0,
        patternOffset: Math.random() * 1000 // Add randomness to starting pattern
    } );

    // Update scan state when configuration changes
    useEffect( () =>
    {
        scanState.current.verticalAngles = initializeVerticalAngles(
            lidarConfig.numChannels,
            lidarConfig.verticalFOV,
            lidarConfig.verticalFOVMin,
            lidarConfig.verticalFOVMax );
    }, [ lidarConfig.numChannels, lidarConfig.verticalFOV, lidarConfig.verticalFOVMin, lidarConfig.verticalFOVMax ] );

    const raycaster = useMemo( () => new THREE.Raycaster(), [] );

    // Create point cloud geometry and material once with our fixed buffer size
    const { pointCloudGeometry, pointCloudMaterial } = useMemo( () =>
    {
        // Create buffer geometry with preallocated buffers.
        // These will be the actual buffers Three.js uses for rendering.
        const geometry = new THREE.BufferGeometry();

        // Position attribute: MAX_POINTS * 3 components (x, y, z)
        const positionAttribute = new THREE.BufferAttribute(
            new Float32Array( MAX_POINTS * 3 ),
            3
        );
        positionAttribute.setUsage( THREE.DynamicDrawUsage ); // Indicates data will change frequently
        geometry.setAttribute( 'position', positionAttribute );

        // Color attribute: MAX_POINTS * 3 components (r, g, b)
        const colorAttribute = new THREE.BufferAttribute(
            new Float32Array( MAX_POINTS * 3 ),
            3
        );
        colorAttribute.setUsage( THREE.DynamicDrawUsage ); // Indicates data will change frequently
        geometry.setAttribute( 'color', colorAttribute );

        // Create material for points
        const material = new THREE.PointsMaterial( {
            size: 0.075,
            vertexColors: true,
            sizeAttenuation: true, // Points get smaller with distance
            alphaTest: 0.1, // Points with alpha below this value are not rendered
            transparent: false // Set to true if you need alpha blending
        } );

        return {
            pointCloudGeometry: geometry,
            pointCloudMaterial: material
        };
    }, [] ); // Empty dependency array means this runs once on mount

    // Copies data from the custom CircularPointBuffer to the Three.js geometry attributes
    // for rendering. This is the bridge between our data structure and the visualization.
    const updateVisualization = useCallback( () =>
    {
        if ( !pointCloudGeometry ) return;

        const buffer = pointBuffer.current;
        const pointCount = buffer.getCurrentSize();

        if ( pointCount === 0 )
        {
            // If no points, set draw range to 0 to clear visualization
            pointCloudGeometry.setDrawRange( 0, 0 );
            return;
        }

        // Get the raw, interleaved data from our CircularPointBuffer.
        // This array contains points in logical order (oldest to newest), handling wraparound.
        const sourceData = buffer.getPointsAsTypedArray();

        // Get the destination buffers (attributes) from the Three.js geometry
        const positionAttribute = pointCloudGeometry.attributes.position;
        const colorAttribute = pointCloudGeometry.attributes.color;

        // De-interleave the data from our source (x,y,z,intensity) into Three.js's separate
        // position (x,y,z) and color (r,g,b) attributes.
        for ( let i = 0; i < pointCount; i++ )
        {
            const sourceIndex = i * 4; // 4 components per point in sourceData (x,y,z,intensity)
            const destIndex = i * 3;   // 3 components for position/color attributes in Three.js

            // Copy position (x, y, z)
            positionAttribute.array[ destIndex ] = sourceData[ sourceIndex ];
            positionAttribute.array[ destIndex + 1 ] = sourceData[ sourceIndex + 1 ];
            positionAttribute.array[ destIndex + 2 ] = sourceData[ sourceIndex + 2 ];

            // Copy intensity to color (r, g, b) - assuming intensity is normalized [0, 1]
            const intensity = sourceData[ sourceIndex + 3 ];
            colorAttribute.array[ destIndex ] = intensity;
            colorAttribute.array[ destIndex + 1 ] = intensity;
            colorAttribute.array[ destIndex + 2 ] = intensity;
        }

        // Tell Three.js to re-upload the modified buffer data to the GPU
        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;

        // Update the bounding sphere/box for proper frustum culling.
        // This is crucial to prevent points from disappearing when camera moves.
        pointCloudGeometry.computeBoundingSphere();
        // pointCloudGeometry.computeBoundingBox(); // Optional, computeBoundingSphere is usually enough for points

        // Important: only draw the number of points we currently have data for.
        // This hides any unused pre-allocated space.
        pointCloudGeometry.setDrawRange( 0, pointCount );
    }, [ pointCloudGeometry ] ); // Dependency: pointCloudGeometry is stable from useMemo([])

    // Initialize the frame manager on component mount
    useEffect( () =>
    {
        // Create frame manager with the LiDAR frame rate (derived from scan rate)
        // For 10Hz rotation rate, we want 10 frames per second
        const frameRate = lidarConfig.scanRate / ( 2 * Math.PI );
        frameManager.current = new LidarFrameManager( frameRate );

        // Expose frame manager to window for debugging/external control
        window.lidarFrameManager = frameManager.current;

        // Cleanup on unmount
        return () =>
        {
            delete window.lidarFrameManager;
        };
    }, [ lidarConfig.scanRate ] ); // Re-run if scanRate changes

    // Frame capture controls (exposed via window object for external UI)
    useEffect( () =>
    {
        window.startLidarCapture = () =>
        {
            if ( frameManager.current )
            {
                frameManager.current.startCapture();
                setIsCapturing( true );
            }
        };

        window.stopLidarCapture = () =>
        {
            if ( frameManager.current )
            {
                frameManager.current.stopCapture();
                setIsCapturing( false );
                setFrameStats( frameManager.current.getFrameStatistics() );
            }
        };

        window.exportLidarFrames = async () =>
        {
            if ( frameManager.current )
            {
                await frameManager.current.exportFramesAsZip();
            }
        };

        window.clearLidarFrames = () =>
        {
            if ( frameManager.current )
            {
                frameManager.current.clearFrames();
                setFrameStats( { frameCount: 0 } );
            }
        };

        // Cleanup on unmount
        return () =>
        {
            delete window.startLidarCapture;
            delete window.stopLidarCapture;
            delete window.exportLidarFrames;
            delete window.clearLidarFrames;
        };
    }, [] ); // Empty dependency array means this runs once on mount

    // Core scanning logic with optimized throttling
    const lastUpdateTime = useRef( 0 );
    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Throttle updates to 120 FPS max for better performance and consistent behavior
        const now = state.clock.elapsedTime;
        if ( now - lastUpdateTime.current < ( 1 / 120 ) ) return;
        lastUpdateTime.current = now;

        // Update horizontal angle for rotation
        updateScanAngle( delta, scanState.current, lidarConfig.scanRate );

        // Get sensor position in world space
        const sensorPosition = getSensorPosition( sensorRef );

        // Get all meshes in the scene that can be intersected by rays
        const meshesToIntersect = collectIntersectableMeshes( scene, sensorRef );

        // Cast rays for this frame to generate new points
        const currentTime = Date.now() - startTime.current; // Time in ms since component mount
        const newPoints = castRaysForFrame(
            sensorPosition,
            meshesToIntersect,
            scanState.current,
            raycaster,
            lidarConfig,
            scene,
            currentTime
        );

        // Add new points to our high-performance circular buffer for visualization
        for ( const point of newPoints )
        {
            // The CircularPointBuffer's add method can handle point objects {x,y,z,intensity}
            pointBuffer.current.add( point );
        }

        // Update the Three.js visualization geometry from the buffer
        updateVisualization();

        // Add points to frame manager if we're actively capturing
        if ( isCapturing && frameManager.current )
        {
            // LidarFrameManager.addPointsToFrame expects an array of point objects, which newPoints already is
            frameManager.current.addPointsToFrame( newPoints );

            // Update stats periodically during capture (e.g., every 60 frames for ~1 second update)
            if ( frameCounter.current % 60 === 0 )
            {
                setFrameStats( frameManager.current.getFrameStatistics() );
            }
        }

        // Update scan pattern visualization if enabled
        if ( showPattern )
        {
            visualizeScanPattern( scene, lidarConfig, scanState.current );
        } else
        {
            clearScanPattern( scene ); // Ensure pattern is cleared if disabled
        }

        frameCounter.current++; // Increment frame counter for stats updates
    } );

    return (
        <>
            {/* LiDAR sensor representation in the scene */}
            <Sphere ref={sensorRef} position={position} args={[ 0.2, 16, 16 ]}>
                {/* Material color changes based on capture status */}
                <meshStandardMaterial color={isCapturing ? "green" : "red"} />
            </Sphere>

            {/* Point cloud visualization using BufferGeometry and PointsMaterial */}
            <points ref={pointsRef} geometry={pointCloudGeometry} material={pointCloudMaterial} />

            {/* Debug controls (simple clickable box to toggle scan pattern) */}
            {/* In a real application, these would likely be proper UI buttons outside the 3D scene */}
            <group position={[ 0, 3, 0 ]}>
                <mesh onClick={() =>
                {
                    // Toggle showPattern state
                    setShowPattern( prev => !prev );
                    // clearScanPattern is now handled in the useFrame hook based on showPattern state
                }}>
                    <boxGeometry args={[ 0.2, 0.2, 0.2 ]} />
                    {/* Visual indicator for scan pattern status */}
                    <meshBasicMaterial color={showPattern ? 0x00ff00 : 0xff0000} />
                </mesh>
            </group>
        </>
    );
};

export default LidarSensor;
