import React, { useState, useEffect } from 'react';
import { useLidarConfig } from '../sensors/lidar/context/LidarConfigContext';

const UIControls = () =>
{
    const { config, updateConfig } = useLidarConfig();
    const [ captureStatus, setCaptureStatus ] = useState( 'idle' );
    const [ frameStats, setFrameStats ] = useState( { frameCount: 0, totalPoints: 0 } );

    useEffect( () =>
    {
        // This useEffect fetches frame statistics from the global lidarFrameManager
        // which is exposed by the LidarSensor component.
        // It runs an interval to update stats only when capturing.
        if ( captureStatus === 'capturing' && window.lidarFrameManager )
        {
            const interval = setInterval( () =>
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }, 500 ); // Update every 500ms
            return () => clearInterval( interval ); // Clear interval on unmount or status change
        }
    }, [ captureStatus ] );

    // Function to toggle capture status (start/stop)
    const toggleCapture = () =>
    {
        if ( captureStatus === 'idle' || captureStatus === 'stopped' )
        {
            window.startLidarCapture?.(); // Call global start function
            setCaptureStatus( 'capturing' );
        } else
        {
            window.stopLidarCapture?.(); // Call global stop function
            setCaptureStatus( 'stopped' );
            // Immediately update stats after stopping to show final numbers
            if ( window.lidarFrameManager )
            {
                const stats = window.lidarFrameManager.getFrameStatistics();
                setFrameStats( stats );
            }
        }
    };

    return (
        // Main container for the control panel
        <div className="
            absolute top-5 right-5 w-80
            bg-gradient-to-br from-gray-800/95 to-gray-700/95
            backdrop-blur-md border border-gray-700
            rounded-xl text-white font-sans text-sm
            shadow-2xl overflow-hidden
        ">
            {/* Header section */}
            <div className="p-4 border-b border-gray-700">
                <h3 className="
                    m-0 text-lg font-semibold
                    bg-gradient-to-r from-blue-400 to-blue-500
                    text-transparent bg-clip-text
                ">
                    LiDAR Control Panel
                </h3>
            </div>

            {/* LiDAR Configuration section */}
            <div className="p-4">
                <h4 className="mb-3 text-gray-200 text-sm">
                    Configuration
                </h4>

                <div className="grid gap-3">
                    {/* Points/Frame Slider */}
                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Points/Frame:</label>
                        <input
                            type="range"
                            min="100"
                            max="2000"
                            step="100"
                            value={config.pointsPerFrame}
                            onChange={( e ) => updateConfig( 'pointsPerFrame', parseInt( e.target.value ) )}
                            className="w-32 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {config.pointsPerFrame}
                        </span>
                    </div>

                    {/* Scan Rate (Hz) Slider */}
                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Scan Rate (Hz):</label>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={Math.round( config.scanRate / ( 2 * Math.PI ) )} // Display Hz
                            onChange={( e ) => updateConfig( 'scanRate', parseInt( e.target.value ) * 2 * Math.PI )}
                            className="w-32 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {Math.round( config.scanRate / ( 2 * Math.PI ) )}
                        </span>
                    </div>

                    {/* Max Range (m) Slider */}
                    <div className="flex items-center justify-between">
                        <label className="text-gray-400 text-xs">Max Range (m):</label>
                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={config.maxRange}
                            onChange={( e ) => updateConfig( 'maxRange', parseInt( e.target.value ) )}
                            className="w-32 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500"
                        />
                        <span className="text-blue-400 text-xs w-10 text-right">
                            {config.maxRange}
                        </span>
                    </div>
                </div>

                {/* Range effectiveness indicator */}
                <div className="
                    mt-2 p-2
                    bg-green-700/10 border border-green-700/20
                    rounded-md
                ">
                    <div className="text-green-500 text-xs font-bold mb-1">
                        Effective Detection Range:
                    </div>
                    <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-200">
                            🟦 Dark objects: {Math.round( config.maxRange * 0.57 )}m
                        </span>
                        <span className="text-gray-200">
                            ⬜ Bright objects: {config.maxRange}m
                        </span>
                    </div>
                    <div className="text-gray-400 text-xs mt-1 leading-tight">
                        Test objects placed at 20-300m with different materials to visualize range effects
                    </div>
                </div>
            </div>

            {/* Frame Capture section */}
            <div className="p-4 border-t border-gray-700">
                <h4 className="mb-3 text-gray-200 text-sm">Frame Capture</h4>

                {/* Capture Button */}
                <button
                    onClick={toggleCapture}
                    className={`
                        w-full py-3 mb-3 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out
                        hover:scale-[1.01] active:scale-95
                        ${ captureStatus === 'capturing'
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/20'
                            : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-500/20'
                        }
                    `}
                >
                    {captureStatus === 'capturing' ? '🔴 Stop Capture' : '🟢 Start Capture'}
                </button>

                {/* Stats Display */}
                {frameStats.frameCount > 0 && (
                    <div className="
                        p-3 mb-3 rounded-lg
                        bg-gray-800/50 border border-blue-400/20
                    ">
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

                {/* Export Controls */}
                <div className="flex gap-2">
                    <button
                        onClick={() => window.exportLidarFrames?.()}
                        disabled={frameStats.frameCount === 0}
                        className={`
                            flex-1 py-2 px-3 rounded-md text-xs
                            transition-all duration-200 ease-in-out
                            ${ frameStats.frameCount > 0
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:scale-[1.01] active:scale-95'
                                : 'bg-gray-800/30 text-gray-500 cursor-not-allowed'
                            }
                        `}
                    >
                        📦 Export ZIP
                    </button>

                    <button
                        onClick={() =>
                        {
                            window.clearLidarFrames?.();
                            setFrameStats( { frameCount: 0, totalPoints: 0 } ); // Reset stats immediately
                            setCaptureStatus( 'idle' ); // Ensure capture status is reset
                        }}
                        disabled={frameStats.frameCount === 0}
                        className={`
                            py-2 px-3 rounded-md text-xs
                            transition-all duration-200 ease-in-out
                            ${ frameStats.frameCount > 0
                                ? 'bg-gray-800/30 text-gray-300 border border-gray-700 hover:scale-[1.01] active:scale-95'
                                : 'bg-gray-800/10 text-gray-500 border border-gray-800 cursor-not-allowed'
                            }
                        `}
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UIControls;
