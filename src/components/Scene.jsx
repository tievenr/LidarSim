import React, { useState } from 'react';
import Environment from './Environment';
import LidarSensor from '../sensors/lidar/components/LidarSensor';
import Car from '../Car/Car';

const Scene = () =>
{
    const [ car, setCar ] = useState( null );

    const handleCarReady = ( carData ) =>
    {
        setCar( carData );
        console.log( 'Car is ready in scene:', carData );
    };

    return (
        <>
            <Environment />

            {/* Car with simple geometry for better performance */}
            <Car
                position={[ 0, 0, 0 ]}
                rotation={[ 0, 0, 0 ]}
                scale={0.25}
                onCarReady={handleCarReady}
                enablePhysics={false}
                useSimpleCar={true}
            />

            {/* LIDAR sensor that follows the car */}
            {car && (
                <LidarSensor
                    targetMesh={car.mesh}
                    offset={[ 0, 1, 0 ]} // 1 unit above car
                />
            )}
        </>
    );
};

export default Scene; 