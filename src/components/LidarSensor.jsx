import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere } from '@react-three/drei';

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
    const pointCloudGeometry = useMemo( () => new THREE.BufferGeometry(), [] );
    const pointCloudMaterial = useMemo( () => new THREE.PointsMaterial( {
        size: 0.1,
        vertexColors: true
    } ), [] );

    // ===== CORE SCANNING LOGIC =====

    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Update horizontal angle for rotation
        updateScanAngle( delta );

        // Get sensor position in world space
        const sensorPosition = getSensorPosition();

        // Clear previous debug rays
        clearDebugRays();

        // Get all meshes in the scene that can be intersected
        const meshesToIntersect = collectIntersectableMeshes();

        // Cast rays for this frame
        const newPoints = castRaysForFrame( sensorPosition, meshesToIntersect );

        // Update point cloud data
        updatePointCloudData( newPoints );

        // Update visualization
        updatePointCloudVisualization();
    } );

    // ===== HELPER FUNCTIONS =====

    // Initialize vertical angles for LiDAR beams
    function initializeVerticalAngles ( numChannels, verticalFOV )
    {
        return Array( numChannels ).fill( 0 ).map( ( _, i ) =>
            -verticalFOV / 2 + ( i * verticalFOV / ( numChannels - 1 ) )
        );
    }

    // Update the scan angle based on time
    function updateScanAngle ( delta )
    {
        scanState.current.horizontalAngle += delta / lidarConfig.scanRate;
        if ( scanState.current.horizontalAngle >= Math.PI * 2 )
        {
            scanState.current.horizontalAngle = 0;
        }
    }

    // Get current sensor position from the 3D world
    function getSensorPosition ()
    {
        return new THREE.Vector3().setFromMatrixPosition( sensorRef.current.matrixWorld );
    }

    // Clear previous debug ray visualizations
    function clearDebugRays ()
    {
        if ( showDebugRays )
        {
            rayLines.current.forEach( line =>
            {
                if ( line && line.parent )
                {
                    line.parent.remove( line );
                }
            } );
            rayLines.current = [];
        }
    }

    // Collect all meshes in the scene that can be intersected by the LiDAR
    function collectIntersectableMeshes ()
    {
        const meshes = [];
        scene.traverse( ( object ) =>
        {
            if ( object.isMesh && object !== sensorRef.current )
            {
                meshes.push( object );
            }
        } );
        return meshes;
    }

    // Cast multiple rays and collect points
    function castRaysForFrame ( sensorPosition, meshesToIntersect )
    {
        const newPoints = [];
        const currentTime = Date.now() - startTime.current; // Time in ms since start

        for ( let i = 0; i < lidarConfig.pointsPerFrame; i++ )
        {
            // Generate somewhat random scanning pattern
            const horizontalOffset = ( Math.random() - 0.5 ) * Math.PI / 36; // Small random offset
            const currentHAngle = scanState.current.horizontalAngle + horizontalOffset;

            // Pick a random vertical channel
            const channelIndex = Math.floor( Math.random() * lidarConfig.numChannels );
            const verticalAngle = scanState.current.verticalAngles[ channelIndex ];

            // Convert angles to radians
            const hAngleRad = currentHAngle;
            const vAngleRad = THREE.MathUtils.degToRad( verticalAngle );

            // Get direction vector
            const direction = calculateRayDirection( hAngleRad, vAngleRad );

            // Cast ray and process results
            const point = castSingleRay(
                sensorPosition,
                direction,
                meshesToIntersect,
                channelIndex,
                currentTime * 1000 // Convert to microseconds
            );

            if ( point )
            {
                newPoints.push( point );
            }
        }

        return newPoints;
    }

    // Calculate ray direction based on angles
    function calculateRayDirection ( hAngleRad, vAngleRad )
    {
        return new THREE.Vector3(
            Math.sin( hAngleRad ) * Math.cos( vAngleRad ),
            Math.sin( vAngleRad ),
            Math.cos( hAngleRad ) * Math.cos( vAngleRad )
        );
    }

    // Cast a single ray and return point data if hit
    function castSingleRay ( origin, direction, meshesToIntersect, channelIndex, timestamp )
    {
        // Set raycaster origin and direction
        raycaster.set( origin, direction );

        // Find intersections
        const intersects = raycaster.intersectObjects( meshesToIntersect, false );

        // If we hit something within range
        if ( intersects.length > 0 &&
            intersects[ 0 ].distance >= lidarConfig.minRange &&
            intersects[ 0 ].distance <= lidarConfig.maxRange )
        {

            const hitPoint = intersects[ 0 ].point;
            const distance = intersects[ 0 ].distance;

            // Calculate intensity based on distance (0-1 range)
            const normalizedDistance = Math.min( distance / lidarConfig.maxRange, 1 );
            const intensity = 1 - normalizedDistance;

            // Create debug ray visualization if enabled
            if ( showDebugRays )
            {
                createDebugRay( origin, hitPoint, intensity );
            }

            // Return point data in PCD format
            return {
                x: hitPoint.x,
                y: hitPoint.y,
                z: hitPoint.z,
                intensity: intensity,
                time: timestamp,
                tag: Math.floor( Math.random() * 256 ), // Simulate tag value (0-255)
                line: channelIndex // Use channel index as line value (0-39)
            };
        }

        return null;
    }

    // Create debug ray visualization
    function createDebugRay ( origin, endpoint, intensity )
    {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints( [ origin, endpoint ] );
        const lineMaterial = new THREE.LineBasicMaterial( {
            color: new THREE.Color( intensity, intensity, intensity )
        } );
        const line = new THREE.Line( lineGeometry, lineMaterial );
        scene.add( line );
        rayLines.current.push( line );
    }

    // Update point cloud data with new points
    function updatePointCloudData ( newPoints )
    {
        // Add new points to our point cloud data
        scanState.current.pointCloudData = [ ...scanState.current.pointCloudData, ...newPoints ];

        // Limit point cloud size to avoid performance issues
        if ( scanState.current.pointCloudData.length > 10000 )
        {
            scanState.current.pointCloudData = scanState.current.pointCloudData.slice( -10000 );
        }

        // Update state for rendering
        setPointCloud( scanState.current.pointCloudData );
    }

    // Update visualization of point cloud
    function updatePointCloudVisualization ()
    {
        if ( pointsRef.current && scanState.current.pointCloudData.length > 0 )
        {
            const positions = [];
            const colors = [];

            scanState.current.pointCloudData.forEach( point =>
            {
                positions.push( point.x, point.y, point.z );
                const intensity = point.intensity;
                colors.push( intensity, intensity, intensity );
            } );

            pointCloudGeometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute( positions, 3 )
            );
            pointCloudGeometry.setAttribute(
                'color',
                new THREE.Float32BufferAttribute( colors, 3 )
            );

            pointCloudGeometry.computeBoundingSphere();
        }
    }

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
        window.exportLidarPointCloudPCD = exportPointCloudPCD;
        window.exportLidarPointCloudJSON = exportPointCloudJSON;
        return () =>
        {
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