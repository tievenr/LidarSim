import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLidarConfig } from '../sensors/lidar/context/LidarConfigContext';
import { PlayIcon, PauseIcon, TrashIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

const UIControls = () =>
{
    const { config, updateConfig } = useLidarConfig();
    const [ captureStatus, setCaptureStatus ] = useState( 'idle' );
    const [ frameStats, setFrameStats ] = useState( {
        frameCount: 0,
        totalPoints: 0,
        avgPointsPerFrame: 0,
        avgFrameRate: 0,
        pointsPerSecond: 0,
    } );
    const intervalRef = useRef( null );

    useEffect( () =>
    {
        if ( captureStatus === 'capturing' && window.lidarFrameManager )
        {
            if ( intervalRef.current ) clearInterval( intervalRef.current );
            intervalRef.current = setInterval( () =>
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }, 500 );
        } else
        {
            if ( intervalRef.current )
            {
                clearInterval( intervalRef.current );
                intervalRef.current = null;
            }
        }
        return () =>
        {
            if ( intervalRef.current )
            {
                clearInterval( intervalRef.current );
                intervalRef.current = null;
            }
        };
    }, [ captureStatus ] );

    const toggleCapture = useCallback( () =>
    {
        if ( captureStatus === 'idle' || captureStatus === 'stopped' )
        {
            window.startLidarCapture?.();
            setCaptureStatus( 'capturing' );
        } else
        {
            window.stopLidarCapture?.();
            setCaptureStatus( 'stopped' );
            if ( window.lidarFrameManager )
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }
        }
    }, [ captureStatus ] );

    const handlePointsPerFrameChange = useCallback( e =>
    {
        updateConfig( 'pointsPerFrame', parseInt( e.target.value, 10 ) );
    }, [ updateConfig ] );

    const handleScanRateChange = useCallback( e =>
    {
        updateConfig( 'scanRate', parseInt( e.target.value, 10 ) * 2 * Math.PI );
    }, [ updateConfig ] );

    const handleMaxRangeChange = useCallback( e =>
    {
        updateConfig( 'maxRange', parseInt( e.target.value, 10 ) );
    }, [ updateConfig ] );

    const handleClearLidarFrames = useCallback( () =>
    {
        window.clearLidarFrames?.();
        setFrameStats( {
            frameCount: 0,
            totalPoints: 0,
            avgPointsPerFrame: 0,
            avgFrameRate: 0,
            pointsPerSecond: 0,
        } );
        setCaptureStatus( 'idle' );
    }, [] );

    const handleExportLidarFrames = useCallback( () =>
    {
        window.exportLidarFrames?.();
    }, [] );

    const captureButtonIcon = captureStatus === 'capturing' ? <PauseIcon className="w-5 h-5 mr-2" /> : <PlayIcon className="w-5 h-5 mr-2" />;
    const exportButtonIcon = <DocumentArrowDownIcon className="w-4 h-4 mr-2" />;
    const clearButtonIcon = <TrashIcon className="w-4 h-4" />;

    return (
        <div className="absolute top-6 right-6 w-80 bg-gray-900 bg-opacity-90 backdrop-blur-sm border border-gray-800 rounded-lg shadow-lg text-white text-sm overflow-hidden">
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                <h3 className="m-0 text-lg font-semibold text-indigo-400 tracking-tight">
                    LiDAR Controller
                </h3>
                <p className="text-gray-500 text-xs mt-1">Real-time sensor management</p>
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <h4 className="mb-2 font-semibold text-gray-300 text-xs uppercase tracking-wider">
                        Sensor Configuration
                    </h4>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor="points-per-frame" className="block text-gray-400 text-xs font-medium">Points/Frame</label>
                            <div className="flex items-center space-x-2">
                                <span className="text-indigo-400 text-xs font-semibold">{config.pointsPerFrame}</span>
                                <input
                                    id="points-per-frame"
                                    type="range"
                                    min="100"
                                    max="20000"
                                    step="50"
                                    value={config.pointsPerFrame}
                                    onChange={handlePointsPerFrameChange}
                                    className="w-32 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label htmlFor="scan-rate" className="block text-gray-400 text-xs font-medium">Scan Rate (Hz)</label>
                            <div className="flex items-center space-x-2">
                                <span className="text-indigo-400 text-xs font-semibold">{Math.round( config.scanRate / ( 2 * Math.PI ) )}</span>
                                <input
                                    id="scan-rate"
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={Math.round( config.scanRate / ( 2 * Math.PI ) )}
                                    onChange={handleScanRateChange}
                                    className="w-32 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label htmlFor="max-range" className="block text-gray-400 text-xs font-medium">Max Range (m)</label>
                            <div className="flex items-center space-x-2">
                                <span className="text-indigo-400 text-xs font-semibold">{config.maxRange}</span>
                                <input
                                    id="max-range"
                                    type="range"
                                    min="50"
                                    max="500"
                                    step="10"
                                    value={config.maxRange}
                                    onChange={handleMaxRangeChange}
                                    className="w-32 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer dark:bg-gray-700 accent-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="mb-2 font-semibold text-gray-300 text-xs uppercase tracking-wider">
                        Capture Control
                    </h4>
                    <button
                        onClick={toggleCapture}
                        className={`w-full flex items-center justify-center py-2.5 rounded-md text-sm font-semibold transition-colors ${ captureStatus === 'capturing'
                            ? 'bg-red-700 hover:bg-red-800 text-white'
                            : 'bg-green-700 hover:bg-green-800 text-white'
                            }`}
                    >
                        {captureButtonIcon}
                        {captureStatus === 'capturing' ? 'Stop' : 'Start'} Capture
                    </button>
                </div>

                {frameStats.frameCount > 0 && (
                    <div className="rounded-md bg-gray-800 bg-opacity-50 border border-gray-700 p-3">
                        <h5 className="text-gray-400 font-semibold text-xs mb-2 uppercase tracking-wider">Statistics</h5>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <span className="text-gray-500">Frames:</span>
                            <span className="text-indigo-300 font-semibold">{frameStats.frameCount}</span>

                            <span className="text-gray-500">Total Points:</span>
                            <span className="text-indigo-300 font-semibold">{frameStats.totalPoints?.toLocaleString()}</span>
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleExportLidarFrames}
                        disabled={frameStats.frameCount === 0}
                        className={`flex-1 flex items-center justify-center py-2 rounded-md text-xs font-semibold transition-colors ${ frameStats.frameCount > 0
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {exportButtonIcon}
                        Export
                    </button>
                    <button
                        onClick={handleClearLidarFrames}
                        disabled={frameStats.frameCount === 0}
                        className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors ${ frameStats.frameCount > 0
                            ? 'bg-gray-700 hover:bg-gray-800 text-gray-300'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        {clearButtonIcon}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UIControls;