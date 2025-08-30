import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere } from '@react-three/drei';
import
{
    initializeVerticalAngles,
    updateScanAngle,
    getSensorPosition,
    castRaysForFrame,
} from '../logic/ScanningLogic';
import { LidarFrameManager } from '../utils/ExportLogic';
import { createLidarConfig } from '../config/LidarConfig';
import { useLidarConfig } from '../context/LidarConfigContext';
import { CircularPointBuffer } from '../utils/CircularPointBuffer';
import { SlamManager } from '../slam/core/SlamManager';
import { TransformUtils } from '../slam/utils/TransformUtils';

const MAX_POINTS = 10000;

// (removed top-level color mapper) - use an adaptive mapper inside the component
const LidarSensor = ( {
    position = [ 0, 2, 0 ],
    config = {},
    targetMesh = null,
    offset = [ 0, 0, 0 ],
    enableSlam = true,
    autoStart = false,
    slamOptions = {}
} ) =>
{
    const sensorRef = useRef();
    const pointsRef = useRef();
    const { scene } = useThree();
    const startTime = useRef( Date.now() );
    const frameCounter = useRef( 0 );

    const { config: contextConfig } = useLidarConfig();
    const frameManager = useRef( null );
    const slamManager = useRef( null );
    const transformUtils = useRef( new TransformUtils() );
    const [ isCapturing, setIsCapturing ] = useState( false );
    const [ isSlamActive, setIsSlamActive ] = useState( enableSlam );
    const [ slamStats, setSlamStats ] = useState( null );

    const lidarConfig = useMemo( () =>
    {
        return createLidarConfig( {
            ...contextConfig,
            ...config
        } );
    }, [ contextConfig, config ] );

    const pointBuffer = useRef( new CircularPointBuffer( MAX_POINTS, 4 ) );
    // Track observed intensity range to normalize colors
    const intensityMin = useRef( Infinity );
    const intensityMax = useRef( -Infinity );

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
        patternOffset: Math.random() * 1000
    } );

    useEffect( () =>
    {
        scanState.current.verticalAngles = initializeVerticalAngles(
            lidarConfig.numChannels,
            lidarConfig.verticalFOV,
            lidarConfig.verticalFOVMin,
            lidarConfig.verticalFOVMax );
    }, [ lidarConfig.numChannels, lidarConfig.verticalFOV, lidarConfig.verticalFOVMin, lidarConfig.verticalFOVMax ] );

    const raycaster = useMemo( () => new THREE.Raycaster(), [] );

    const { pointCloudGeometry, pointCloudMaterial } = useMemo( () =>
    {
        const geometry = new THREE.BufferGeometry();

        const positionAttribute = new THREE.BufferAttribute(
            new Float32Array( MAX_POINTS * 3 ),
            3
        );
        positionAttribute.setUsage( THREE.DynamicDrawUsage );
        geometry.setAttribute( 'position', positionAttribute );

        const colorAttribute = new THREE.BufferAttribute(
            new Float32Array( MAX_POINTS * 3 ),
            3
        );
        colorAttribute.setUsage( THREE.DynamicDrawUsage );
        geometry.setAttribute( 'color', colorAttribute );

        const material = new THREE.PointsMaterial( {
            size: 0.075,
            vertexColors: true,
            sizeAttenuation: true,
            alphaTest: 0.1,
            transparent: false
        } );

        return {
            pointCloudGeometry: geometry,
            pointCloudMaterial: material
        };
    }, [] );

    // Unified visualization update function
    const updateVisualization = useCallback( () =>
    {
        if ( !pointCloudGeometry ) return;

        const { newPoints, hasWraparound, updateInfo } = pointBuffer.current.getUpdateInfo();

        if ( newPoints.length === 0 ) return;

        const positionAttribute = pointCloudGeometry.attributes.position;
        const colorAttribute = pointCloudGeometry.attributes.color;

        // Transform 4-component buffer data to separate 3-component position and color arrays
        const numPoints = newPoints.length / pointBuffer.current.componentsPerPoint;
        const newPositions = new Float32Array( numPoints * 3 );
        const newColors = new Float32Array( numPoints * 3 );

        for ( let i = 0; i < numPoints; i++ )
        {
            const sourceIndex = i * 4;
            const destIndex = i * 3;

            // Copy position (x, y, z)
            newPositions[ destIndex ] = newPoints[ sourceIndex ];
            newPositions[ destIndex + 1 ] = newPoints[ sourceIndex + 1 ];
            newPositions[ destIndex + 2 ] = newPoints[ sourceIndex + 2 ];

            // Map intensity to color (adaptive)
            const intensity = newPoints[ sourceIndex + 3 ];

            // Update running min/max
            if ( intensity < intensityMin.current ) intensityMin.current = intensity;
            if ( intensity > intensityMax.current ) intensityMax.current = intensity;

            // Normalize to [0,1] safely
            const minI = intensityMin.current === Infinity ? 0 : intensityMin.current;
            const maxI = intensityMax.current === -Infinity ? 1 : intensityMax.current;
            const norm = maxI > minI ? ( intensity - minI ) / ( maxI - minI ) : 0.5;

            // Perceptual ramp: blue -> yellow -> red
            // 0.0 -> blue (#3b83bd), 0.5 -> yellow (#f1c40f), 1.0 -> red (#e74c3c)
            function ramp ( t )
            {
                if ( t < 0.5 )
                {
                    // interpolate blue -> yellow
                    const u = t / 0.5;
                    const r = ( 0xf1 - 0x3b ) * u + 0x3b;
                    const g = ( 0xc4 - 0x83 ) * u + 0x83;
                    const b = ( 0x0f - 0xbd ) * u + 0xbd;
                    return [ r / 255, g / 255, b / 255 ];
                }
                else
                {
                    // interpolate yellow -> red
                    const u = ( t - 0.5 ) / 0.5;
                    const r = ( 0xe7 - 0xf1 ) * u + 0xf1;
                    const g = ( 0x4c - 0xc4 ) * u + 0xc4;
                    const b = ( 0x3c - 0x0f ) * u + 0x0f;
                    return [ r / 255, g / 255, b / 255 ];
                }
            }

            // Boost contrast for low-intensity values so they don't all appear blue
            const clamped = Math.max( 0, Math.min( 1, norm ) );
            const enhanced = Math.sqrt( clamped ); // sqrt increases small values
            const color = ramp( enhanced );
            newColors[ destIndex ] = color[ 0 ];
            newColors[ destIndex + 1 ] = color[ 1 ];
            newColors[ destIndex + 2 ] = color[ 2 ];
        }

        if ( !hasWraparound )
        {
            // Linear update case
            const startPointIndex = updateInfo.offset / pointBuffer.current.componentsPerPoint;
            const componentOffset = startPointIndex * 3;

            positionAttribute.array.set( newPositions, componentOffset );
            colorAttribute.array.set( newColors, componentOffset );

            positionAttribute.updateRange = { offset: componentOffset, count: newPositions.length };
            colorAttribute.updateRange = { offset: componentOffset, count: newColors.length };

            pointCloudGeometry.setDrawRange( 0, pointBuffer.current.size );
        } else
        {
            // Wraparound update case - split into two segments
            const firstSegmentPointCount = ( pointBuffer.current.bufferLength - updateInfo.offset ) / pointBuffer.current.componentsPerPoint;
            const secondSegmentPointCount = numPoints - firstSegmentPointCount;

            const firstSegmentComponentLength = firstSegmentPointCount * 3;
            const secondSegmentComponentLength = secondSegmentPointCount * 3;

            const firstSegmentComponentOffset = ( updateInfo.offset / pointBuffer.current.componentsPerPoint ) * 3;
            const secondSegmentComponentOffset = 0;

            // Copy first segment to end of geometry array
            positionAttribute.array.set( newPositions.subarray( 0, firstSegmentComponentLength ), firstSegmentComponentOffset );
            colorAttribute.array.set( newColors.subarray( 0, firstSegmentComponentLength ), firstSegmentComponentOffset );

            // Copy second segment to beginning of geometry array
            positionAttribute.array.set( newPositions.subarray( firstSegmentComponentLength ), secondSegmentComponentOffset );
            colorAttribute.array.set( newColors.subarray( firstSegmentComponentLength ), secondSegmentComponentOffset );

            positionAttribute.updateRange = { offset: firstSegmentComponentOffset, count: firstSegmentComponentLength + secondSegmentComponentLength };
            colorAttribute.updateRange = { offset: firstSegmentComponentOffset, count: firstSegmentComponentLength + secondSegmentComponentLength };

            pointCloudGeometry.setDrawRange( 0, MAX_POINTS );
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        pointCloudGeometry.computeBoundingSphere();

    }, [ pointCloudGeometry, pointBuffer ] );

    useEffect( () =>
    {
        const frameRate = lidarConfig.scanRate / ( 2 * Math.PI );
        frameManager.current = new LidarFrameManager( frameRate );
        window.lidarFrameManager = frameManager.current;

        // Initialize SLAM manager if feature enabled. Do NOT auto-start unless autoStart is true.
        if ( enableSlam )
        {
            slamManager.current = new SlamManager( {
                voxelSize: 0.1,
                maxPointsPerVoxel: 50,
                maxGlobalPoints: 1000000,
                scanMatchingEnabled: true,
                odometryEnabled: true,
                exportEnabled: true,
                ...slamOptions
            } );

            console.log( 'SLAM system initialized' );

            // Start only if explicitly requested via autoStart
            if ( autoStart )
            {
                slamManager.current.start();
                console.log( 'SLAM auto-started' );
            }
        }

        return () =>
        {
            delete window.lidarFrameManager;
            if ( slamManager.current && slamManager.current.isRunning )
            {
                slamManager.current.stop();
            }
        };
        // Note: not including `slamOptions` here because callers often pass an inline
        // object (e.g. the default `{}`) which creates a new reference every render.
        // That makes the effect re-run and the cleanup stop() the SLAM manager
        // immediately after it was started. Keep dependencies stable instead.
    }, [ lidarConfig.scanRate, enableSlam ] );

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
                frameManager.current.clearFrames();;
            }
        };

        // SLAM control functions
        window.startSlam = () =>
        {
            if ( slamManager.current )
            {
                slamManager.current.start();
                setIsSlamActive( true );
                console.log( 'SLAM started' );
            }
        };

        window.stopSlam = () =>
        {
            if ( slamManager.current && slamManager.current.isRunning )
            {
                slamManager.current.stop();
                setIsSlamActive( false );
                console.log( 'SLAM stopped' );
            }
        };

        window.exportSlamMap = async () =>
        {
            if ( slamManager.current )
            {
                try
                {
                    const result = await slamManager.current.exportMap();
                    console.log( 'SLAM map exported:', result );
                    return result;
                } catch ( error )
                {
                    console.error( 'SLAM export failed:', error );
                }
            }
        };

        window.exportSlamSession = async () =>
        {
            if ( slamManager.current )
            {
                try
                {
                    const result = await slamManager.current.exportSession();
                    console.log( 'SLAM session exported:', result );
                    return result;
                } catch ( error )
                {
                    console.error( 'SLAM session export failed:', error );
                }
            }
        };

        window.getSlamStats = () =>
        {
            if ( slamManager.current )
            {
                return slamManager.current.getStatistics();
            }
            return null;
        };

        window.resetSlam = () =>
        {
            if ( slamManager.current )
            {
                const wasRunning = slamManager.current.isRunning;
                slamManager.current.reset();
                setIsSlamActive( false );
                console.log( 'SLAM reset' );
            }
        };

        window.exportPoseGraph = () =>
        {
            if ( slamManager.current )
            {
                try
                {
                    slamManager.current.exportPoseGraph();
                    console.log( 'Pose graph exported' );
                } catch ( error )
                {
                    console.error( 'Pose graph export failed:', error );
                }
            }
        };

        return () =>
        {
            delete window.startLidarCapture;
            delete window.stopLidarCapture;
            delete window.exportLidarFrames;
            delete window.clearLidarFrames;
            delete window.startSlam;
            delete window.stopSlam;
            delete window.exportSlamMap;
            delete window.exportSlamSession;
            delete window.getSlamStats;
            delete window.resetSlam;
            delete window.exportPoseGraph;
        };
    }, [] );

    const lastUpdateTime = useRef( 0 );
    const lastSlamUpdate = useRef( 0 );
    const slamUpdateInterval = 100; // Update SLAM every 100ms for performance

    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Update sensor position to follow target mesh
        if ( targetMesh && targetMesh.position )
        {
            const targetPos = targetMesh.position;
            sensorRef.current.position.set(
                targetPos.x + offset[ 0 ],
                targetPos.y + offset[ 1 ],
                targetPos.z + offset[ 2 ]
            );
        }

        const now = state.clock.elapsedTime;
        if ( now - lastUpdateTime.current < ( 1 / 30 ) ) return;
        lastUpdateTime.current = now;

        updateScanAngle( delta, scanState.current, lidarConfig.scanRate );
        const sensorPosition = getSensorPosition( sensorRef );

        const currentTime = Date.now() - startTime.current;

        const scanResult = castRaysForFrame(
            sensorPosition,
            scene,
            scanState.current,
            raycaster,
            lidarConfig,
            currentTime,
            sensorRef,
            true
        );

        const newPoints = scanResult.points;
        pointBuffer.current.addBatch( newPoints );

        updateVisualization();

        // Regular frame capture
        if ( isCapturing && frameManager.current )
        {
            frameManager.current.addPointsToFrame( newPoints );
        }

        // SLAM processing
        if ( isSlamActive && slamManager.current && slamManager.current.isRunning &&
            ( currentTime - lastSlamUpdate.current ) >= slamUpdateInterval )
        {
            try
            {
                // Get current vehicle pose from target mesh
                let vehiclePose = transformUtils.current.createIdentityPose();

                if ( targetMesh && targetMesh.position && targetMesh.rotation )
                {
                    vehiclePose = {
                        x: targetMesh.position.x,
                        y: targetMesh.position.y,
                        z: targetMesh.position.z,
                        roll: targetMesh.rotation.x,
                        pitch: targetMesh.rotation.y,
                        yaw: targetMesh.rotation.z
                    };
                } else
                {
                    console.log( 'LidarSensor: No valid target mesh for pose' );
                }

                // Process scan with SLAM
                console.log( `LidarSensor: Processing SLAM scan with ${ newPoints.length / 4 } points at time ${ currentTime }, SLAM running: ${ slamManager.current.isRunning }` );
                if ( newPoints.length === 0 )
                {
                    console.log( 'LidarSensor: No points to process' );
                    return;
                }

                const slamResult = slamManager.current.processScan(
                    newPoints,
                    vehiclePose,
                    currentTime
                );

                // Update SLAM statistics for UI
                setSlamStats( slamManager.current.getStatistics() );

                lastSlamUpdate.current = currentTime;
            } catch ( error )
            {
                console.warn( 'SLAM processing error:', error );
            }
        }

        frameCounter.current++;
    } );

    return (
        <>
            <Sphere ref={sensorRef} position={targetMesh ? [ 0, 0, 0 ] : position} args={[ 0.2, 16, 16 ]}>
                <meshStandardMaterial
                    color={
                        isSlamActive ?
                            ( isCapturing ? "lightgreen" : "blue" ) :
                            ( isCapturing ? "green" : "red" )
                    }
                />
            </Sphere>

            <points ref={pointsRef} geometry={pointCloudGeometry} material={pointCloudMaterial} />

            {/* SLAM status indicator */}
            {isSlamActive && slamStats && (
                <mesh position={[
                    ( sensorRef.current?.position.x || position[ 0 ] ) + 1,
                    ( sensorRef.current?.position.y || position[ 1 ] ) + 1,
                    ( sensorRef.current?.position.z || position[ 2 ] ) + 0.5
                ]}>
                    <sphereGeometry args={[ 0.1, 8, 8 ]} />
                    <meshStandardMaterial
                        color={slamStats.isActive ? "cyan" : "orange"}
                        emissive={slamStats.isActive ? "cyan" : "orange"}
                        emissiveIntensity={0.3}
                    />
                </mesh>
            )}
        </>
    );
};

export default LidarSensor;