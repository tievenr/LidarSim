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

/**
 * LidarSensor component simulates a LiDAR scanner in a Three.js scene
 * Stores data in PCD format with x, y, z, intensity, time, tag, and line fields
 */
const LidarSensor = ( { position = [ 0, 2, 0 ], showDebugRays = true } ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();
    const rayLines = useRef( [] );
    const startTime = useRef( Date.now() );

    // ===== CONFIGURATION =====

    // LiDAR specifications
    const lidarConfig = useMemo( () => ( {
        horizontalFOV: 360, // degrees
        verticalFOV: 59, // degrees
        numChannels: 40, // Livox Mid-360 has 40 beams
        maxRange: 200, // meters
        minRange: 0.1, // meters
        scanRate: 0.1, // Adjust to control speed of scan (lower = faster)
        pointsPerFrame: 10, // How many rays to cast per frame
    } ), [] );

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

    // Export point cloud data in PCD format
    function exportPointCloudPCD ()
    {
        // Generate PCD header
        const pointCount = scanState.current.pointCloudData.length;
        let pcdHeader = `VERSION .7
FIELDS x y z intensity time tag line
SIZE 4 4 4 4 4 1 1
TYPE F F F F F U U
COUNT 1 1 1 1 1 1 1
WIDTH ${ pointCount }
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${ pointCount }
DATA ascii
`;

        // Generate PCD data
        let pcdData = scanState.current.pointCloudData.map( point =>
            `${ point.x.toFixed( 6 ) } ${ point.y.toFixed( 6 ) } ${ point.z.toFixed( 6 ) } ${ point.intensity.toFixed( 6 ) } ${ ( point.time / 1000 ).toFixed( 6 ) } ${ point.tag } ${ point.line }`
        ).join( '\n' );

        // Combine header and data
        const pcdContent = pcdHeader + pcdData;

        // Create downloadable file
        const blob = new Blob( [ pcdContent ], { type: 'text/plain' } );
        const url = URL.createObjectURL( blob );
        const a = document.createElement( 'a' );
        a.href = url;
        a.download = 'lidar_point_cloud.pcd';
        a.click();
    }

    // Export point cloud data in JSON format
    function exportPointCloudJSON ()
    {
        const data = scanState.current.pointCloudData;
        const blob = new Blob( [ JSON.stringify( data ) ], { type: 'application/json' } );
        const url = URL.createObjectURL( blob );
        const a = document.createElement( 'a' );
        a.href = url;
        a.download = 'lidar_point_cloud.json';
        a.click();
    }

    // Make export functions available globally for the UI buttons
    useEffect( () =>
    {
        // Keep original export function for backward compatibility
        window.exportLidarPointCloud = exportPointCloudPCD;

        // Add new export functions
        window.exportLidarPointCloudPCD = exportPointCloudPCD;
        window.exportLidarPointCloudJSON = exportPointCloudJSON;

        return () =>
        {
            delete window.exportLidarPointCloud;
            delete window.exportLidarPointCloudPCD;
            delete window.exportLidarPointCloudJSON;
        };
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