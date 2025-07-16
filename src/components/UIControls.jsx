import React, { useState, useEffect } from 'react';
import { useLidarConfig } from '../sensors/lidar/context/LidarConfigContext';

const UIControls = () =>
{
    const { config, updateConfig } = useLidarConfig();
    const [ captureStatus, setCaptureStatus ] = useState( 'idle' );
    const [ frameStats, setFrameStats ] = useState( { frameCount: 0, totalPoints: 0 } );

    useEffect( () =>
    {
        if ( captureStatus === 'capturing' && window.lidarFrameManager )
        {
            const interval = setInterval( () =>
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }, 500 );
            return () => clearInterval( interval );
        }
    }, [ captureStatus ] );

    const toggleCapture = () =>
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
    };

    return (
        <div className="absolute top-5 right-5 w-80 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-xl text-white text-sm shadow-2xl">
            <div className="p-4 border-b border-gray-700">
                <h3 className="m-0 text-lg font-semibold text-blue-400">
                    LiDAR Control Panel
                </h3>
            </div>

            <div className="p-4">
                <h4 className="mb-3 text-gray-200 text-sm">Configuration</h4>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Points/Frame:</label>
                        <input
                            type="range"
                            min="100"
                            max="20000"
                            step="100"
                            value={config.pointsPerFrame}
                            onChange={( e ) => updateConfig( 'pointsPerFrame', parseInt( e.target.value ) )}
                            className="w-32 accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {config.pointsPerFrame}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Scan Rate (Hz):</label>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={Math.round( config.scanRate / ( 2 * Math.PI ) )}
                            onChange={( e ) => updateConfig( 'scanRate', parseInt( e.target.value ) * 2 * Math.PI )}
                            className="w-32 accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {Math.round( config.scanRate / ( 2 * Math.PI ) )}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Max Range (m):</label>
                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={config.maxRange}
                            onChange={( e ) => updateConfig( 'maxRange', parseInt( e.target.value ) )}
                            className="w-32 accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {config.maxRange}
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-700">
                <h4 className="mb-3 text-gray-200 text-sm">Frame Capture</h4>

                <button
                    onClick={toggleCapture}
                    className={`w-full py-3 mb-3 rounded-lg text-sm font-semibold transition-all ${ captureStatus === 'capturing'
                            ? 'bg-red-600 text-white'
                            : 'bg-green-600 text-white'
                        }`}
                >
                    {captureStatus === 'capturing' ? '🔴 Stop Capture' : '🟢 Start Capture'}
                </button>

                {frameStats.frameCount > 0 && (
                    <div className="p-3 mb-3 rounded-lg bg-gray-800/50 border border-blue-400/20">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="text-gray-400">Frames:</div>
                            <div className="text-blue-400 font-semibold">{frameStats.frameCount}</div>

                            <div className="text-gray-400">Total Points:</div>
                            <div className="text-blue-400 font-semibold">{frameStats.totalPoints?.toLocaleString()}</div>

                            {frameStats.avgPointsPerFrame && (
                                <>
                                    <div className="text-gray-400">Avg/Frame:</div>
                                    <div className="text-blue-400 font-semibold">{frameStats.avgPointsPerFrame?.toLocaleString()}</div>
                                </>
                            )}
                            {frameStats.avgFrameRate && (
                                <>
                                    <div className="text-gray-400">Avg FPS:</div>
                                    <div className="text-blue-400 font-semibold">{frameStats.avgFrameRate}</div>
                                </>
                            )}
                            {frameStats.pointsPerSecond && (
                                <>
                                    <div className="text-gray-400">Pnts/Sec:</div>
                                    <div className="text-blue-400 font-semibold">{frameStats.pointsPerSecond.toLocaleString()}</div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={() => window.exportLidarFrames?.()}
                        disabled={frameStats.frameCount === 0}
                        className={`flex-1 py-2 px-3 rounded-md text-xs transition-all ${ frameStats.frameCount > 0
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        📦 Export ZIP
                    </button>

                    <button
                        onClick={() =>
                        {
                            window.clearLidarFrames?.();
                            setFrameStats( { frameCount: 0, totalPoints: 0 } );
                            setCaptureStatus( 'idle' );
                        }}
                        disabled={frameStats.frameCount === 0}
                        className={`py-2 px-3 rounded-md text-xs transition-all ${ frameStats.frameCount > 0
                                ? 'bg-gray-600 text-gray-300 border border-gray-700 hover:bg-gray-700'
                                : 'bg-gray-800/10 text-gray-500 border border-gray-800 cursor-not-allowed'
                            }`}
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UIControls;
