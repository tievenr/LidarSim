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

const MAX_POINTS = 20000;

// Color mapping function to convert intensity to RGB
const mapIntensityToColor = ( intensity ) =>
{
    
    const hue = 1 - intensity * 0.9;
    const color = new THREE.Color();
    color.setHSL( hue, 1.0, 0.5 );
    return [ color.r, color.g, color.b ];
};
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

    const { config: contextConfig } = useLidarConfig();
    const frameManager = useRef( null );
    const [ isCapturing, setIsCapturing ] = useState( false );

    const lidarConfig = useMemo( () =>
    {
        return createLidarConfig( {
            ...contextConfig,
            ...config
        } );
    }, [ contextConfig, config ] );

    const pointBuffer = useRef( new CircularPointBuffer( MAX_POINTS, 4 ) );

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

            // Map intensity to color
            const intensity = newPoints[ sourceIndex + 3 ];
            const color = mapIntensityToColor( intensity );
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

        if ( isCapturing && frameManager.current )
        {
            frameManager.current.addPointsToFrame( newPoints );
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