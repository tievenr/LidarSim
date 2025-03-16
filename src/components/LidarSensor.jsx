import React, { useRef, useMemo, useState, useEffect } from 'react';
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
    } from './ScanningLogic';
import
    {
        clearDebugRays,
    } from './VisualizationLogic';
import
    {
        registerExportFunctions
    } from './ExportLogic';
import
    {
        createLidarConfig
    } from './LidarConfig';

// Maximum number of points to store in the circular buffer
const MAX_POINTS = 200000;

/**
 * LidarSensor component with optimized point cloud handling using circular buffer
 * Uses typed arrays and fixed memory allocation to prevent memory growth
 */
const LidarSensor = ( {
    position = [ 0, 2, 0 ],
    showDebugRays = false,
    config = {}
} ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();
    const rayLines = useRef( [] );
    const startTime = useRef( Date.now() );

    // ===== CONFIGURATION =====
    const lidarConfig = useMemo( () => createLidarConfig( config ), [ config ] );

    // ===== CIRCULAR BUFFER STATE =====
    // We'll use a ref to store our circular buffer state to avoid re-renders
    const circularBuffer = useRef( {
        // Point cloud data as typed arrays for x, y, z, intensity, time, tag, line
        positions: new Float32Array( MAX_POINTS * 3 ), // x, y, z
        intensities: new Float32Array( MAX_POINTS ),   // intensity
        times: new Float32Array( MAX_POINTS ),         // time
        tags: new Uint8Array( MAX_POINTS ),            // tag
        lines: new Uint8Array( MAX_POINTS ),           // line
        colors: new Float32Array( MAX_POINTS * 3 ),    // rgb colors for visualization

        // Current write position in the circular buffer
        writeIndex: 0,

        // Total number of points currently in buffer (capped at MAX_POINTS)
        pointCount: 0,

        // Whether the buffer has wrapped around
        hasWrapped: false
    } );

    // ===== SCANNING STATE =====
    const scanState = useRef( {
        horizontalAngle: 0,
        verticalAngles: initializeVerticalAngles(
            lidarConfig.numChannels,
            lidarConfig.verticalFOV,
            lidarConfig.verticalFOVMin,
            lidarConfig.verticalFOVMax
        )
    } );

    // ===== VISUALIZATION COMPONENTS =====
    const raycaster = useMemo( () => new THREE.Raycaster(), [] );

    // Create point cloud geometry and material once with our fixed buffer size
    const { pointCloudGeometry, pointCloudMaterial } = useMemo( () =>
    {
        // Create buffer geometry with preallocated buffers
        const geometry = new THREE.BufferGeometry();

        // Create position attribute buffer with allocated memory
        const positionAttribute = new THREE.BufferAttribute(
            circularBuffer.current.positions,
            3
        );
        positionAttribute.setUsage( THREE.DynamicDrawUsage );
        geometry.setAttribute( 'position', positionAttribute );

        // Create color attribute buffer with allocated memory
        const colorAttribute = new THREE.BufferAttribute(
            circularBuffer.current.colors,
            3
        );
        colorAttribute.setUsage( THREE.DynamicDrawUsage );
        geometry.setAttribute( 'color', colorAttribute );

        // Create material for points
        const material = new THREE.PointsMaterial( {
            size: 0.1,
            vertexColors: true,
        } );

        return {
            pointCloudGeometry: geometry,
            pointCloudMaterial: material
        };
    }, [] );

    // ===== BUFFER MANAGEMENT FUNCTIONS =====

    /**
     * Add new points to the circular buffer
     * @param {Array} newPoints - Array of point objects from ray casting
     */
    const addPointsToCircularBuffer = ( newPoints ) =>
    {
        if ( !newPoints || newPoints.length === 0 ) return;

        const buffer = circularBuffer.current;

        for ( let i = 0; i < newPoints.length; i++ )
        {
            const point = newPoints[ i ];

            // Calculate the actual index in our arrays
            const idx = buffer.writeIndex;

            // Store position (x, y, z)
            buffer.positions[ idx * 3 ] = point.x;
            buffer.positions[ idx * 3 + 1 ] = point.y;
            buffer.positions[ idx * 3 + 2 ] = point.z;

            // Store intensity
            buffer.intensities[ idx ] = point.intensity;

            // Store color (grayscale based on intensity)
            buffer.colors[ idx * 3 ] = point.intensity;
            buffer.colors[ idx * 3 + 1 ] = point.intensity;
            buffer.colors[ idx * 3 + 2 ] = point.intensity;

            // Store metadata
            buffer.times[ idx ] = point.time;
            buffer.tags[ idx ] = point.tag;
            buffer.lines[ idx ] = point.line;

            // Increment write index and wrap around if needed
            buffer.writeIndex = ( buffer.writeIndex + 1 ) % MAX_POINTS;

            // Update point count and wrapped flag
            if ( buffer.pointCount < MAX_POINTS )
            {
                buffer.pointCount++;
            } else
            {
                buffer.hasWrapped = true;
            }
        }

        // Mark buffer attributes for update
        updateBufferAttributes();
    };

    /**
     * Mark position and color attributes for update in Three.js
     */
    const updateBufferAttributes = () =>
    {
        if ( !pointCloudGeometry ) return;

        // Mark only the portion of the buffer that contains valid data
        const posAttr = pointCloudGeometry.attributes.position;
        const colorAttr = pointCloudGeometry.attributes.color;

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;

        // Set the draw range to only render the filled portion of the buffer
        pointCloudGeometry.setDrawRange( 0, circularBuffer.current.pointCount );
    };

    /**
     * Convert the circular buffer to an array of point objects for export
     * @returns {Array} Array of point objects in the format expected by export functions
     */
    const getPointCloudDataForExport = () =>
    {
        const buffer = circularBuffer.current;
        const points = [];

        // Handle the case where buffer has wrapped around
        const startIdx = buffer.hasWrapped ? buffer.writeIndex : 0;
        const numPoints = buffer.pointCount;

        for ( let i = 0; i < numPoints; i++ )
        {
            // Calculate index with wrap-around
            const idx = ( startIdx + i ) % MAX_POINTS;

            points.push( {
                x: buffer.positions[ idx * 3 ],
                y: buffer.positions[ idx * 3 + 1 ],
                z: buffer.positions[ idx * 3 + 2 ],
                intensity: buffer.intensities[ idx ],
                time: buffer.times[ idx ],
                tag: buffer.tags[ idx ],
                line: buffer.lines[ idx ]
            } );
        }

        return points;
    };

    // ===== CORE SCANNING LOGIC =====
    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Update horizontal angle for rotation
        updateScanAngle( delta, scanState.current, lidarConfig.scanRate );

        // Get sensor position in world space
        const sensorPosition = getSensorPosition( sensorRef );

        // Clear previous debug rays
        if ( showDebugRays )
        {
            rayLines.current = clearDebugRays( rayLines.current );
        }

        // Get all meshes in the scene that can be intersected
        const meshesToIntersect = collectIntersectableMeshes( scene, sensorRef );

        // Cast rays for this frame
        const currentTime = Date.now() - startTime.current; // Time in ms since start
        const newPoints = castRaysForFrame(
            sensorPosition,
            meshesToIntersect,
            scanState.current,
            raycaster,
            lidarConfig,
            scene,
            rayLines.current,
            showDebugRays,
            currentTime
        );

        // Add new points to our circular buffer
        addPointsToCircularBuffer( newPoints );
    } );

    // ===== EXPORT FUNCTIONALITY =====
    useEffect( () =>
    {
        // Function to get the current point cloud data for export
        const getPointCloudData = getPointCloudDataForExport;

        // Register export functions and get cleanup function
        const cleanup = registerExportFunctions( getPointCloudData );

        // Return cleanup function for component unmount
        return cleanup;
    }, [] );

    // ===== RENDER =====
    return (
        <>
            {/* LiDAR sensor representation */}
            <Sphere ref={sensorRef} position={position} args={[ 0.2, 16, 16 ]}>
                <meshStandardMaterial color="red" />
            </Sphere>

            {/* Point cloud visualization */}
            <points ref={pointsRef} geometry={pointCloudGeometry} material={pointCloudMaterial} />
        </>
    );
};

export default LidarSensor;