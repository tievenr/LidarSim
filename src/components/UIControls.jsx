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
        <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '320px',
            background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(50, 50, 50, 0.95))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: 'white',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '600',
                    background: 'linear-gradient(45deg, #64B5F6, #42A5F5)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    LiDAR Control Panel
                </h3>
                
                {/* Motion Artifacts Warning */}
                <div style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: 'rgba(255, 152, 0, 0.1)',
                    border: '1px solid rgba(255, 152, 0, 0.3)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#FFA726'
                }}>
                    ⚠️ Motion Artifacts Demo: Watch for ghost trails from moving objects
                </div>
            </div>            {/* LiDAR Configuration */}
            <div style={{ padding: '16px 20px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#E0E0E0', fontSize: '14px' }}>
                    Configuration
                </h4>

                <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ color: '#B0B0B0', fontSize: '12px' }}>Points/Frame:</label>                        <input
                            type="range"
                            min="100"
                            max="2000"
                            step="100"
                            value={config.pointsPerFrame}
                            onChange={( e ) => updateConfig( 'pointsPerFrame', parseInt( e.target.value ) )}
                            style={{ width: '120px' }}
                        />
                        <span style={{ color: '#64B5F6', fontSize: '12px', minWidth: '40px' }}>
                            {config.pointsPerFrame}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ color: '#B0B0B0', fontSize: '12px' }}>Scan Rate (Hz):</label>                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={config.scanRate / ( 2 * Math.PI )}
                            onChange={( e ) => updateConfig( 'scanRate', parseInt( e.target.value ) * 2 * Math.PI )}
                            style={{ width: '120px' }}
                        />
                        <span style={{ color: '#64B5F6', fontSize: '12px', minWidth: '40px' }}>
                            {Math.round( config.scanRate / ( 2 * Math.PI ) )}
                        </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ color: '#B0B0B0', fontSize: '12px' }}>Max Range (m):</label>                        <input
                            type="range"
                            min="50"
                            max="500"
                            step="10"
                            value={config.maxRange}
                            onChange={( e ) => updateConfig( 'maxRange', parseInt( e.target.value ) )}
                            style={{ width: '120px' }}
                        />                        <span style={{ color: '#64B5F6', fontSize: '12px', minWidth: '40px' }}>
                            {config.maxRange}
                        </span>
                    </div>
                </div>                {/* Range effectiveness indicator */}
                <div style={{
                    marginTop: '6px',
                    padding: '6px 8px',
                    background: 'rgba(76, 175, 80, 0.1)',
                    borderRadius: '4px',
                    border: '1px solid rgba(76, 175, 80, 0.2)'
                }}>
                    <div style={{ fontSize: '10px', marginBottom: '4px', color: '#4CAF50', fontWeight: 'bold' }}>
                        Effective Detection Range:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span style={{ color: '#E0E0E0' }}>
                            🟦 Dark objects: {Math.round( config.maxRange * 0.57 )}m
                        </span>
                        <span style={{ color: '#E0E0E0' }}>
                            ⬜ Bright objects: {config.maxRange}m
                        </span>
                    </div>                    <div style={{ fontSize: '9px', color: '#B0B0B0', marginTop: '4px', lineHeight: '1.2' }}>
                        Test objects placed at 20-300m with different materials to visualize range effects
                    </div>
                </div>
            </div>

            {/* Frame Capture */}
            <div style={{
                padding: '16px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                <h4 style={{ margin: '0 0 12px', color: '#E0E0E0', fontSize: '14px' }}>Frame Capture</h4>

                <button
                    onClick={toggleCapture}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: captureStatus === 'capturing'
                            ? 'linear-gradient(45deg, #f44336, #d32f2f)'
                            : 'linear-gradient(45deg, #4CAF50, #388E3C)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        marginBottom: '12px'
                    }}
                    onMouseOver={( e ) => e.target.style.transform = 'translateY(-1px)'}
                    onMouseOut={( e ) => e.target.style.transform = 'translateY(0)'}
                >
                    {captureStatus === 'capturing' ? '🔴 Stop Capture' : '🟢 Start Capture'}
                </button>

                {/* Stats Display */}
                {frameStats.frameCount > 0 && (
                    <div style={{
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        border: '1px solid rgba(100, 181, 246, 0.2)'
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            <div style={{ color: '#B0B0B0' }}>Frames:</div>
                            <div style={{ color: '#64B5F6', fontWeight: '600' }}>{frameStats.frameCount}</div>

                            <div style={{ color: '#B0B0B0' }}>Total Points:</div>
                            <div style={{ color: '#64B5F6', fontWeight: '600' }}>{frameStats.totalPoints?.toLocaleString()}</div>

                            {frameStats.avgPointsPerFrame && (
                                <>
                                    <div style={{ color: '#B0B0B0' }}>Avg/Frame:</div>
                                    <div style={{ color: '#64B5F6', fontWeight: '600' }}>{frameStats.avgPointsPerFrame?.toLocaleString()}</div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Export Controls */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => window.exportLidarFrames?.()}
                        disabled={frameStats.frameCount === 0}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: frameStats.frameCount > 0
                                ? 'linear-gradient(45deg, #2196F3, #1976D2)'
                                : 'rgba(255, 255, 255, 0.1)',
                            color: frameStats.frameCount > 0 ? 'white' : '#666',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: frameStats.frameCount > 0 ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s ease'
                        }}
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
                        style={{
                            padding: '10px 12px',
                            background: frameStats.frameCount > 0
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(255, 255, 255, 0.05)',
                            color: frameStats.frameCount > 0 ? '#E0E0E0' : '#666',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: frameStats.frameCount > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UIControls;