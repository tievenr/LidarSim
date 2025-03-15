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
        updatePointCloudData
    } from './ScanningLogic';
import
    {
        updatePointCloudVisualization,
        clearDebugRays,
        createPointCloudComponents
    } from './VisualizationLogic';
import
    {
        registerExportFunctions
    } from './ExportLogic';
import
    {
        createLidarConfig
    } from './LidarConfig';

/**
 * LidarSensor component simulates a LiDAR scanner in a Three.js scene
 * Stores data in PCD format with x, y, z, intensity, time, tag, and line fields
 */
const LidarSensor = ( {
    position = [ 0, 2, 0 ],
    showDebugRays = true,
    config = {}
} ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();
    const rayLines = useRef( [] );
    const startTime = useRef( Date.now() );

    // ===== CONFIGURATION =====

    // LiDAR specifications with custom config merged with defaults
    const lidarConfig = useMemo( () => createLidarConfig( config ), [ config ] );

    // ===== STATE MANAGEMENT =====

    // State for storing generated point cloud
    const [ pointCloud, setPointCloud ] = useState( [] );

    // Current scanning state (changes over time to simulate scanning)
    const scanState = useRef( {
        horizontalAngle: 0,
        verticalAngles: initializeVerticalAngles( lidarConfig.numChannels, lidarConfig.verticalFOV ),
        pointCloudData: []
    } );

    // ===== VISUALIZATION COMPONENTS =====

    // Create raycaster once
    const raycaster = useMemo( () => new THREE.Raycaster(), [] );

    // Point cloud visualization components
    const { pointCloudGeometry, pointCloudMaterial } = useMemo( () =>
        createPointCloudComponents(), [] );

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

        // Update point cloud data
        scanState.current.pointCloudData = updatePointCloudData(
            newPoints,
            scanState.current.pointCloudData
        );

        // Update state for rendering
        setPointCloud( scanState.current.pointCloudData );

        // Update visualization
        updatePointCloudVisualization(
            pointsRef,
            pointCloudGeometry,
            scanState.current.pointCloudData
        );
    } );

    // ===== EXPORT FUNCTIONALITY =====

    // Register export functions to window object
    useEffect( () =>
    {
        // Function to get the current point cloud data
        const getPointCloudData = () => scanState.current.pointCloudData;

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