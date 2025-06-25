import React from 'react';
import { Box, Plane } from '@react-three/drei';

const Environment = () =>
{
    return (
        <>            {/* Ground plane */}
            <Plane
                args={[ 800, 800 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
                position={[ 0, -0.01, 0 ]}
                receiveShadow
            >
                <meshStandardMaterial color="#6db85a" />
            </Plane>

            {/* Simple road */}
            <Plane
                args={[ 32, 400 ]}
                rotation={[ -Math.PI / 2, 0, 0 ]}
                position={[ 0, 0, 0 ]}
                receiveShadow
            >
                <meshStandardMaterial color="#555555" />
            </Plane>

            {/* Center line */}
            <Plane
                args={[ 0.8, 400 ]}
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

            {/* Distance test objects - 10m intervals from 10m to 120m */}
            {/* 10m - Close range */}
            <Box
                position={[ 0, 1, -10 ]}
                args={[ 1.5, 2, 1.5 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-10m' }}
            >
                <meshStandardMaterial color="#ff0000" />
            </Box>

            {/* 20m */}
            <Box
                position={[ 5, 1.5, -20 ]}
                args={[ 2, 3, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-20m' }}
            >
                <meshStandardMaterial color="#ff4500" />
            </Box>

            {/* 30m */}
            <Box
                position={[ -3, 1, -30 ]}
                args={[ 2, 2, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-30m' }}
            >
                <meshStandardMaterial color="#ffa500" />
            </Box>

            {/* 40m */}
            <Box
                position={[ 8, 2, -40 ]}
                args={[ 1.8, 4, 1.8 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-40m' }}
            >
                <meshStandardMaterial color="#ffff00" />
            </Box>

            {/* 50m */}
            <Box
                position={[ -6, 1.5, -50 ]}
                args={[ 2.5, 3, 2.5 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-50m' }}
            >
                <meshStandardMaterial color="#9aff9a" />
            </Box>

            {/* 60m */}
            <Box
                position={[ 4, 1, -60 ]}
                args={[ 2, 2, 2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-60m' }}
            >
                <meshStandardMaterial color="#00ff00" />
            </Box>

            {/* 70m */}
            <Box
                position={[ -8, 2.5, -70 ]}
                args={[ 3, 5, 3 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-70m' }}
            >
                <meshStandardMaterial color="#00ff80" />
            </Box>

            {/* 80m */}
            <Box
                position={[ 7, 1.5, -80 ]}
                args={[ 2.2, 3, 2.2 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-80m' }}
            >
                <meshStandardMaterial color="#00ffff" />
            </Box>

            {/* 90m */}
            <Box
                position={[ -5, 1, -90 ]}
                args={[ 2.5, 2, 2.5 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-90m' }}
            >
                <meshStandardMaterial color="#0080ff" />
            </Box>

            {/* 100m */}
            <Box
                position={[ 9, 3, -100 ]}
                args={[ 2.8, 6, 2.8 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-100m' }}
            >
                <meshStandardMaterial color="#0000ff" />
            </Box>

            {/* 110m */}
            <Box
                position={[ -7, 1.5, -110 ]}
                args={[ 3, 3, 3 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-110m' }}
            >
                <meshStandardMaterial color="#8000ff" />
            </Box>

            {/* 120m - Furthest object */}
            <Box
                position={[ 0, 2, -120 ]}
                args={[ 3.5, 4, 3.5 ]}
                castShadow
                userData={{ type: 'test-object', id: 'range-120m' }}
            >
                <meshStandardMaterial color="#ff00ff" />
            </Box>

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[ 10, 15, 5 ]} intensity={1} castShadow />
        </>
    );
};

export default Environment;
