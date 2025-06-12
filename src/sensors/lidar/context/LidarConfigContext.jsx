import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEFAULT_LIDAR_CONFIG } from '../config/LidarConfig';

/**
 * Context for managing LiDAR configuration across components
 */
const LidarConfigContext = createContext();

/**
 * Hook to use LiDAR configuration context
 */
export const useLidarConfig = () =>
{
    const context = useContext( LidarConfigContext );
    if ( !context )
    {
        throw new Error( 'useLidarConfig must be used within a LidarConfigProvider' );
    }
    return context;
};

/**
 * Provider component for LiDAR configuration
 */
export const LidarConfigProvider = ( { children } ) =>
{
    const [ config, setConfig ] = useState( DEFAULT_LIDAR_CONFIG );    // Update a specific configuration parameter
    const updateConfig = useCallback( ( key, value ) =>
    {
        setConfig( prevConfig => ( {
            ...prevConfig,
            [ key ]: value
        } ) );
    }, [] );

    // Update multiple configuration parameters
    const updateMultipleConfig = useCallback( ( updates ) =>
    {
        setConfig( prevConfig => ( {
            ...prevConfig,
            ...updates
        } ) );
    }, [] );

    // Reset configuration to defaults
    const resetConfig = useCallback( () =>
    {
        setConfig( DEFAULT_LIDAR_CONFIG );
    }, [] );

    const value = {
        config,
        updateConfig,
        updateMultipleConfig,
        resetConfig
    };

    return (
        <LidarConfigContext.Provider value={value}>
            {children}
        </LidarConfigContext.Provider>
    );
};

export default LidarConfigContext;
