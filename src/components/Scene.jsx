import React from 'react';
import { Environment } from './Environment';
import LidarSensor from '../sensors/lidar/components/LidarSensor';

/**
 * Scene component - Contains environment and LiDAR sensor
 */
const Scene = ({ showDebugRays }) => {
    return (
        <>
            <Environment />
            {/* LiDAR sensor */}
            <LidarSensor position={[0, 2, 0]} showDebugRays={showDebugRays} />
        </>
    );
};

export default Scene; 