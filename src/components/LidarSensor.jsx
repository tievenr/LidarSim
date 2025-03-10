// src/components/LidarSensor.jsx
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere } from '@react-three/drei';

const LidarSensor = ( { position = [ 0, 2, 0 ], showDebugRays = true } ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();

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

    // State for storing generated point cloud
    const [ pointCloud, setPointCloud ] = useState( [] );

    // Create raycaster once
    const raycaster = useMemo( () => new THREE.Raycaster(), [] );

    // Initialize visualization elements
    const rayLines = useRef( [] );
    const pointCloudGeometry = useMemo( () => new THREE.BufferGeometry(), [] );
    const pointCloudMaterial = useMemo( () => new THREE.PointsMaterial( {
        size: 0.1,
        vertexColors: true
    } ), [] );

    // Current angle state (changes over time to simulate scanning)
    const scanState = useRef( {
        horizontalAngle: 0,
        verticalAngles: Array( lidarConfig.numChannels ).fill( 0 ).map( ( _, i ) =>
            -lidarConfig.verticalFOV / 2 + ( i * lidarConfig.verticalFOV / ( lidarConfig.numChannels - 1 ) )
        ),
        pointCloudData: []
    } );

    // Cast rays and collect point cloud data
    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Update horizontal angle for rotation
        scanState.current.horizontalAngle += delta / lidarConfig.scanRate;
        if ( scanState.current.horizontalAngle >= Math.PI * 2 )
        {
            scanState.current.horizontalAngle = 0;
        }

        const sensorPosition = new THREE.Vector3().setFromMatrixPosition( sensorRef.current.matrixWorld );
        const newPoints = [];

        // Clear previous debug rays
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

        // Get all meshes in the scene that can be intersected
        const meshesToIntersect = [];
        scene.traverse( ( object ) =>
        {
            // Only include meshes and exclude the sensor itself to avoid self-intersections
            if ( object.isMesh && object !== sensorRef.current )
            {
                meshesToIntersect.push( object );
            }
        } );

        // Cast rays for this frame
        for ( let i = 0; i < lidarConfig.pointsPerFrame; i++ )
        {
            // Generate a somewhat random horizontal angle for this ray
            // This simulates the non-repetitive scanning pattern of Livox sensors
            const horizontalOffset = ( Math.random() - 0.5 ) * Math.PI / 36; // Small random offset
            const currentHAngle = scanState.current.horizontalAngle + horizontalOffset;

            // Pick a random vertical channel for this ray
            const channelIndex = Math.floor( Math.random() * lidarConfig.numChannels );
            const verticalAngle = scanState.current.verticalAngles[ channelIndex ];

            // Convert to radians
            const hAngleRad = currentHAngle;
            const vAngleRad = THREE.MathUtils.degToRad( verticalAngle );

            // Calculate direction vector
            const direction = new THREE.Vector3(
                Math.sin( hAngleRad ) * Math.cos( vAngleRad ),
                Math.sin( vAngleRad ),
                Math.cos( hAngleRad ) * Math.cos( vAngleRad )
            );

            // Set raycaster origin and direction
            raycaster.set( sensorPosition, direction );

            // Find intersections with explicitly collected meshes
            const intersects = raycaster.intersectObjects( meshesToIntersect, false );

            // If we hit something within range
            if ( intersects.length > 0 &&
                intersects[ 0 ].distance >= lidarConfig.minRange &&
                intersects[ 0 ].distance <= lidarConfig.maxRange )
            {

                const point = intersects[ 0 ].point;

                // Calculate intensity based on distance and angle (simplified model)
                const distance = intersects[ 0 ].distance;
                const normalizedDistance = Math.min( distance / lidarConfig.maxRange, 1 );
                const intensity = 1 - normalizedDistance;

                // Add point to our collection with position and intensity
                newPoints.push( {
                    position: [ point.x, point.y, point.z ],
                    intensity: intensity
                } );

                // Visualization of ray for debugging
                if ( showDebugRays )
                {
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints( [
                        sensorPosition,
                        point
                    ] );
                    const lineMaterial = new THREE.LineBasicMaterial( {
                        color: new THREE.Color( intensity, intensity, intensity )
                    } );
                    const line = new THREE.Line( lineGeometry, lineMaterial );
                    scene.add( line );
                    rayLines.current.push( line );
                }
            }
        }

        // Add new points to our point cloud data
        scanState.current.pointCloudData = [ ...scanState.current.pointCloudData, ...newPoints ];

        // Limit point cloud size to avoid performance issues
        if ( scanState.current.pointCloudData.length > 10000 )
        {
            scanState.current.pointCloudData = scanState.current.pointCloudData.slice( -10000 );
        }

        // Update state for rendering
        setPointCloud( scanState.current.pointCloudData );

        // Update point cloud visualization
        if ( pointsRef.current && scanState.current.pointCloudData.length > 0 )
        {
            const positions = [];
            const colors = [];

            scanState.current.pointCloudData.forEach( point =>
            {
                positions.push( ...point.position );
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
    } );

    // Export point cloud data
    const exportPointCloud = () =>
    {
        const data = scanState.current.pointCloudData.map( point => ( {
            x: point.position[ 0 ],
            y: point.position[ 1 ],
            z: point.position[ 2 ],
            intensity: point.intensity
        } ) );

        const blob = new Blob( [ JSON.stringify( data ) ], { type: 'application/json' } );
        const url = URL.createObjectURL( blob );
        const a = document.createElement( 'a' );
        a.href = url;
        a.download = 'lidar_point_cloud.json';
        a.click();
    };

    // Make export function available globally for debugging
    useEffect( () =>
    {
        window.exportLidarPointCloud = exportPointCloud;
        return () =>
        {
            delete window.exportLidarPointCloud;
        };
    }, [] );

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