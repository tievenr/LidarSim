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

    //Incremental visualization - process only new points
    const updateVisualizationIncremental = useCallback( ( frameInfo ) =>
    {
        if ( !pointCloudGeometry ) return;

        // Extract only new points since last read
        const newPointsData = pointBuffer.current.getNewPointsTypedArray();
        const newPointCount = newPointsData.length / 4;

        if ( newPointCount === 0 ) return;

        const positionAttribute = pointCloudGeometry.attributes.position;
        const colorAttribute = pointCloudGeometry.attributes.color;

        // SCENARIO BRANCHING: Check if the buffer has wrapped around
        if ( !frameInfo.hasWraparound ) 
        {
            const buffer = pointBuffer.current;
            const currentTotalPoints = buffer.getCurrentSize();
            const appendStartIndex = currentTotalPoints - newPointCount;

            // Debug logging every 100 frames
            if ( frameCounter.current % 100 === 0 )
            {
                console.log( `Frame ${ frameCounter.current }: Simple append - ${ currentTotalPoints } total points, adding ${ newPointCount }` );
            }

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
            positionAttribute.updateRange = {
                offset: appendStartIndex * 3,
                count: newPointCount * 3
            };
            positionAttribute.needsUpdate = true;

            colorAttribute.updateRange = {
                offset: appendStartIndex * 3,
                count: newPointCount * 3
            };
            colorAttribute.needsUpdate = true;

            // Update geometry metadata
            pointCloudGeometry.setDrawRange( 0, currentTotalPoints );
        }
        else // Complex wraparound case
        {
            // Debug logging to understand what's happening
            console.log( "Wraparound detected! Need to handle dual updates." );
            console.log( "frameInfo:", frameInfo );
            console.log( "newPointCount:", newPointCount );
            console.log( "buffer size:", pointBuffer.current.getCurrentSize() );
            console.log( "max points:", pointBuffer.current.getMaxSize() );
            const totalMaxPoints = pointBuffer.current.getMaxSize();
            const overwrittenCount = frameInfo.overwrittenRange.count; // Number of points overwritten at buffer start

            // --- PART A: Update the overwritten segment at the BEGINNING of the GPU buffer ---
            // These points are the first 'overwrittenCount' points in the 'newPointsData' array.
            for ( let i = 0; i < overwrittenCount; i++ )
            {
                const sourceIndex = i * 4; // Source index in newPointsData (x,y,z,intensity)
                const gpuIndex = ( frameInfo.overwrittenRange.start + i ) * 3; // GPU index (x,y,z or r,g,b).

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

            // Apply updateRange for the overwritten segment
            // This tells Three.js to re-upload only this specific part of the buffer.
            positionAttribute.updateRange = {
                offset: frameInfo.overwrittenRange.start * 3, // Start at GPU component index 0
                count: overwrittenCount * 3
            };
            positionAttribute.needsUpdate = true;

            colorAttribute.updateRange = {
                offset: frameInfo.overwrittenRange.start * 3, // Start at GPU component index 0
                count: overwrittenCount * 3
            };
            colorAttribute.needsUpdate = true;



            // --- PART B: Update the appended segment at the END of the GPU buffer ---
            // These points are the REMAINDER of 'newPointsData' after the overwritten points.
            // They fill the "gap" from the lastReadIndex up to MAX_POINTS.
            const totalPointsInNewData = newPointCount; // Total points received from getNewPointsTypedArray()
            const appendedCount = totalPointsInNewData - overwrittenCount; // Points that were truly appended to the end of the buffer
            const appendedStartIndexGPU = frameInfo.totalPointsSinceLastRead - appendedCount;

            // --- DEBUG LOGS TO VERIFY DUAL SEGMENT LOGIC ---
            console.log( `  Points overwritten (Part A): ${ overwrittenCount }` );
            console.log( `  Points appended (Part B): ${ appendedCount }` );
            console.log( `  Total (A+B) = ${ overwrittenCount + appendedCount }, should match newPointCount = ${ newPointCount }` );
            // --- END DEBUG LOGS ---

            const appendedSegmentSourceStartIndex = overwrittenCount; // Where this segment starts in newPointsData
            const appendedSegmentGPUStartIndex = totalMaxPoints - appendedCount; // Where this segment starts in the GPU array

            for ( let i = 0; i < appendedCount; i++ )
            {
                const sourceIndex = ( appendedSegmentSourceStartIndex + i ) * 4;
                const gpuIndex = ( appendedSegmentGPUStartIndex + i ) * 3;

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

            // Apply updateRange for the appended segment
            positionAttribute.updateRange = {
                offset: appendedSegmentGPUStartIndex * 3,
                count: appendedCount * 3
            };
            positionAttribute.needsUpdate = true;

            colorAttribute.updateRange = {
                offset: appendedSegmentGPUStartIndex * 3,
                count: appendedCount * 3
            };
            colorAttribute.needsUpdate = true;

            pointCloudGeometry.setDrawRange( 0, totalMaxPoints );


        }

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
        if ( frameInfo.totalPointsSinceLastRead > 0 || frameInfo.hasWraparound ) // Trigger update if new points OR a wraparound occurred
        {
            updateVisualizationIncremental( frameInfo );
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
