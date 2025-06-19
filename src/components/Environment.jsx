import React from 'react';
import { Box, Plane } from '@react-three/drei';

const Environment = () =>
{
    return (
        <>            {/* Ground plane */}
            <Plane
                args={[ 200, 200 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
                position={[ 0, -0.01, 0 ]}
                receiveShadow
            >
                <meshStandardMaterial color="#6db85a" />
            </Plane>

            {/* Simple road */}
            <Plane
                args={[ 8, 100 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
                position={[ 0, 0, 0 ]}
                receiveShadow
            >
                <meshStandardMaterial color="#555555" />
            </Plane>

            {/* Center line */}
            <Plane
                args={[ 0.2, 100 ]}
                position={[ 0, 0.01, 0 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
            >
                <meshStandardMaterial color="yellow" />
            </Plane>

            {/* Building 1 - Office building */}
            <Box
                position={[ -15, 5, -20 ]}
                args={[ 8, 10, 12 ]}
                castShadow
                userData={{ type: 'building', id: 'office' }}
            >
                <meshStandardMaterial color="#D2B48C" />
            </Box>

            {/* Building 2 - House */}
            <Box
                position={[ 18, 3, 10 ]}
                args={[ 6, 6, 8 ]}
                castShadow
                userData={{ type: 'building', id: 'house' }}
            >
                <meshStandardMaterial color="#DEB887" />
            </Box>

            {/* Range test objects */}
            <Box
                position={[ 0, 1, -30 ]}
                args={[ 2, 2, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-30m' }}
            >
                <meshStandardMaterial color="white" />
            </Box>

            <Box
                position={[ 0, 1, -60 ]}
                args={[ 2, 2, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-60m' }}
            >
                <meshStandardMaterial color="gray" />
            </Box>

            <Box
                position={[ 0, 1, -100 ]}
                args={[ 2, 2, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-100m' }}
            >
                <meshStandardMaterial color="black" />
            </Box>

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[ 10, 15, 5 ]} intensity={1} castShadow />
        </>
    );
};

export default Environment;
