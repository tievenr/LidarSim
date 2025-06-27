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
        castRaysForFrameWithCulling,
    } from '../logic/ScanningLogic';
import
{
    visualizeScanPattern,
    clearScanPattern
} from '../logic/VisualizationLogic';
import { LidarFrameManager } from '../utils/ExportLogic';
import { createLidarConfig } from '../config/LidarConfig';
import { useLidarConfig } from '../context/LidarConfigContext';
import { CircularPointBuffer } from '../utils/CircularPointBuffer';

const MAX_POINTS = 100000;

/**
 * LidarSensor component with frame-based point cloud capture
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
    const frameCounter = useRef( 0 );

    // Get configuration from context
    const { config: contextConfig } = useLidarConfig();

    // Frame manager for capturing and exporting frames
    const frameManager = useRef( null );
    const [ isCapturing, setIsCapturing ] = useState( false );
    const [ frameStats, setFrameStats ] = useState( { frameCount: 0 } );
    const [ showPattern, setShowPattern ] = useState( false );
    const [ enableCulling, setEnableCulling ] = useState( true );
    const [ cullingStats, setCullingStats ] = useState( null );
    const [ performanceStats, setPerformanceStats ] = useState( {
        lastFrameTime: 0,
        avgFrameTime: 0,
        pointsPerSecond: 0
    } );

    const lidarConfig = useMemo( () =>
    {
        return createLidarConfig( {
            ...contextConfig,
            ...config
        } );
    }, [ contextConfig, config ] );

    const pointBuffer = useRef( new CircularPointBuffer( MAX_POINTS, 4 ) );

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
        patternOffset: Math.random() * 1000
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

    const updateVisualization = useCallback( () =>
    {
        if ( !pointCloudGeometry ) return;

        const buffer = pointBuffer.current;
        const pointCount = buffer.getCurrentSize();

        if ( pointCount === 0 )
        {
            pointCloudGeometry.setDrawRange( 0, 0 );
            return;
        }

        const sourceData = buffer.getPointsAsTypedArray();
        const positionAttribute = pointCloudGeometry.attributes.position;
        const colorAttribute = pointCloudGeometry.attributes.color;

        for ( let i = 0; i < pointCount; i++ )
        {
            const sourceIndex = i * 4;
            const destIndex = i * 3;

            // Copy position (x, y, z)
            positionAttribute.array[ destIndex ] = sourceData[ sourceIndex ];
            positionAttribute.array[ destIndex + 1 ] = sourceData[ sourceIndex + 1 ];
            positionAttribute.array[ destIndex + 2 ] = sourceData[ sourceIndex + 2 ];

            // Copy intensity to color (r, g, b)
            const intensity = sourceData[ sourceIndex + 3 ];
            colorAttribute.array[ destIndex ] = intensity;
            colorAttribute.array[ destIndex + 1 ] = intensity;
            colorAttribute.array[ destIndex + 2 ] = intensity;
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
        pointCloudGeometry.computeBoundingSphere();
        pointCloudGeometry.setDrawRange( 0, pointCount );
    }, [ pointCloudGeometry ] );

    useEffect( () =>
    {
        const frameRate = lidarConfig.scanRate / ( 2 * Math.PI );
        frameManager.current = new LidarFrameManager( frameRate );
        window.lidarFrameManager = frameManager.current;

        return () =>
        {
            delete window.lidarFrameManager;
        };
    }, [ lidarConfig.scanRate ] );

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

        return () =>
        {
            delete window.startLidarCapture;
            delete window.stopLidarCapture;
            delete window.exportLidarFrames;
            delete window.clearLidarFrames;
        };
    }, [] );

    const lastUpdateTime = useRef( 0 );
    useFrame( ( state, delta ) =>
    {
        if ( !sensorRef.current ) return;

        // Throttle updates to 90 FPS max
        const now = state.clock.elapsedTime;
        if ( now - lastUpdateTime.current < ( 1 / 30 ) ) return;
        lastUpdateTime.current = now;

        updateScanAngle( delta, scanState.current, lidarConfig.scanRate );
        const sensorPosition = getSensorPosition( sensorRef );

        const currentTime = Date.now() - startTime.current;

        // Use the new culling-aware scanning function
        const scanResult = castRaysForFrameWithCulling(
            sensorPosition,
            scene,
            scanState.current,
            raycaster,
            lidarConfig,
            currentTime,
            sensorRef,
            enableCulling
        );

        const newPoints = scanResult.points;

        // Update statistics
        setCullingStats( scanResult.cullingStats );
        setPerformanceStats( prev => ( {
            lastFrameTime: scanResult.frameStats.processingTime,
            avgFrameTime: ( prev.avgFrameTime * 0.9 ) + ( scanResult.frameStats.processingTime * 0.1 ),
            pointsPerSecond: newPoints.length / ( scanResult.frameStats.processingTime / 1000 )
        } ) );

        // Add new points to buffer
        for ( const point of newPoints )
        {
            pointBuffer.current.add( point );
        }

        updateVisualization();

        // Add points to frame manager if capturing
        if ( isCapturing && frameManager.current )
        {
            frameManager.current.addPointsToFrame( newPoints );

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
            clearScanPattern( scene );
        }

        frameCounter.current++;
    } );

    return (
        <>
            <Sphere ref={sensorRef} position={position} args={[ 0.2, 16, 16 ]}>
                <meshStandardMaterial color={isCapturing ? "green" : "red"} />
            </Sphere>

            <points ref={pointsRef} geometry={pointCloudGeometry} material={pointCloudMaterial} />

            <group position={[ 0, 3, 0 ]}>
                {/* Pattern toggle control */}
                <mesh position={[ -0.5, 0, 0 ]} onClick={() =>
                {
                    setShowPattern( prev => !prev );
                }}>
                    <boxGeometry args={[ 0.2, 0.2, 0.2 ]} />
                    <meshBasicMaterial color={showPattern ? 0x00ff00 : 0xff0000} />
                </mesh>

                {/* Culling toggle control */}
                <mesh position={[ 0.5, 0, 0 ]} onClick={() =>
                {
                    setEnableCulling( prev => !prev );
                    console.log( `🎛️ Distance-based culling ${ !enableCulling ? 'ENABLED' : 'DISABLED' }` );
                }}>
                    <boxGeometry args={[ 0.2, 0.2, 0.2 ]} />
                    <meshBasicMaterial color={enableCulling ? 0x0080ff : 0x808080} />
                </mesh>
            </group>

            {/* Statistics display (invisible mesh with onClick for console output) */}
            <group position={[ 0, 4, 0 ]}>
                <mesh onClick={() =>
                {
                    console.log( '🔍 LiDAR Performance Statistics:' );
                    console.log( `   Last Frame Time: ${ performanceStats.lastFrameTime.toFixed( 2 ) }ms` );
                    console.log( `   Avg Frame Time: ${ performanceStats.avgFrameTime.toFixed( 2 ) }ms` );
                    console.log( `   Points/Second: ${ performanceStats.pointsPerSecond.toFixed( 0 ) }` );

                    if ( cullingStats )
                    {
                        console.log( '🎯 Culling Statistics:' );
                        console.log( `   Total Meshes: ${ cullingStats.totalMeshes }` );
                        console.log( `   Visible: ${ cullingStats.visibleMeshes }` );
                        console.log( `   Culled: ${ cullingStats.culledMeshes } (${ cullingStats.tooClose } close, ${ cullingStats.tooFar } far)` );
                        console.log( `   Efficiency: ${ ( ( cullingStats.culledMeshes / cullingStats.totalMeshes ) * 100 ).toFixed( 1 ) }% reduction` );
                        console.log( `   Processing Time: ${ cullingStats.processingTime.toFixed( 2 ) }ms` );
                    }
                }}>
                    <boxGeometry args={[ 0.15, 0.15, 0.15 ]} />
                    <meshBasicMaterial color={0xffff00} transparent opacity={0.7} />
                </mesh>
            </group>
        </>
    );
};

export default LidarSensor;
