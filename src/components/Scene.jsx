import React from 'react';
import Environment from './Environment';
import LidarSensor from '../sensors/lidar/components/LidarSensor';

const Scene = () =>
{
    return (
        <>
            <Environment />
            <LidarSensor position={[ 0, 2, 0 ]} />
        </>
    );
};

export default Scene; 