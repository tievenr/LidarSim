import React, { createContext, useContext, useState, useCallback } from 'react';
import { DEFAULT_LIDAR_CONFIG } from '../config/LidarConfig';

const LidarConfigContext = createContext();

export const useLidarConfig = () =>
{
    const context = useContext( LidarConfigContext );
    if ( !context )
    {
        throw new Error( 'useLidarConfig must be used within a LidarConfigProvider' );
    }
    return context;
};

export const LidarConfigProvider = ( { children } ) =>
{
    const [ config, setConfig ] = useState( DEFAULT_LIDAR_CONFIG );

    const updateConfig = useCallback( ( key, value ) =>
    {
        setConfig( prevConfig => ( {
            ...prevConfig,
            [ key ]: value
        } ) );
    }, [] );

    const updateMultipleConfig = useCallback( ( updates ) =>
    {
        setConfig( prevConfig => ( {
            ...prevConfig,
            ...updates
        } ) );
    }, [] );

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
