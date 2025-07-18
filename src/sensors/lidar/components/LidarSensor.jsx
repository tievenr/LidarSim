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

    //Incremental visualization - process only new points
    const updateVisualizationIncremental = useCallback( () =>
    {
        if ( !pointCloudGeometry ) return;

        // Extract only new points since last read
        const newPointsData = pointBuffer.current.getNewPointsTypedArray();
        const newPointCount = newPointsData.length / 4;

        if ( newPointCount === 0 ) return;

        const buffer = pointBuffer.current;
        const currentTotalPoints = buffer.getCurrentSize();
        const appendStartIndex = currentTotalPoints - newPointCount;

        console.log( `Incremental update: ${ newPointCount } new points, appending at index ${ appendStartIndex }` );

        const positionAttribute = pointCloudGeometry.attributes.position;
        const colorAttribute = pointCloudGeometry.attributes.color;

        // Process only new points and append to GPU buffers
        for ( let i = 0; i < newPointCount; i++ )
        {
            const sourceIndex = i * 4;
            const gpuIndex = ( appendStartIndex + i ) * 3;

            // Copy position (x, y, z)
            positionAttribute.array[ gpuIndex ] = newPointsData[ sourceIndex ];
            positionAttribute.array[ gpuIndex + 1 ] = newPointsData[ sourceIndex + 1 ];
            positionAttribute.array[ gpuIndex + 2 ] = newPointsData[ sourceIndex + 2 ];

            // Copy intensity to color (r, g, b)
            const intensity = newPointsData[ sourceIndex + 3 ];
            colorAttribute.array[ gpuIndex ] = intensity;
            colorAttribute.array[ gpuIndex + 1 ] = intensity;
            colorAttribute.array[ gpuIndex + 2 ] = intensity;
        }

        // Surgical GPU buffer updates - only upload new data
        const updateStartByte = appendStartIndex * 3;
        const updateByteLength = newPointCount * 3;

        positionAttribute.updateRange = {
            offset: updateStartByte,
            count: updateByteLength
        };
        positionAttribute.needsUpdate = true;

        colorAttribute.updateRange = {
            offset: updateStartByte,
            count: updateByteLength
        };
        colorAttribute.needsUpdate = true;

        // Update geometry metadata
        pointCloudGeometry.setDrawRange( 0, currentTotalPoints );
        pointCloudGeometry.computeBoundingSphere();

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

        //Start new LiDAR scanning frame
        pointBuffer.current.startFrame();

        // Use the new culling-aware scanning function
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

        // Add new points to buffer
        for ( const point of newPoints )
        {
            pointBuffer.current.add( point );
        }

        //End scanning frame and conditionally update visualization
        const frameInfo = pointBuffer.current.endFrame();
        if ( frameInfo.totalPointsSinceLastRead > 0 )
        {
            updateVisualizationIncremental();
            pointBuffer.current.markVisualizationRead();
        }

        // Add points to frame manager if capturing
        if ( isCapturing && frameManager.current )
        {
            frameManager.current.addPointsToFrame( newPoints );

            if ( frameCounter.current % 60 === 0 )
            {
                setFrameStats( frameManager.current.getFrameStatistics() );
            }
        }

        frameCounter.current++;
    } );

    return (
        <>
            <Sphere ref={sensorRef} position={position} args={[ 0.2, 16, 16 ]}>
                <meshStandardMaterial color={isCapturing ? "green" : "red"} />
            </Sphere>

            <points ref={pointsRef} geometry={pointCloudGeometry} material={pointCloudMaterial} />
        </>
    );
};

export default LidarSensor;
