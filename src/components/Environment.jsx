import React from 'react';
import { Box, Sphere, Plane } from '@react-three/drei';

/**
 * Environment component - Contains all the 3D objects in the scene
 */
const Environment = () => {
    return (
        <>
            {/* Ground plane */}
            <Plane
                args={[50, 50]}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -2, 0]}
            >
                <meshStandardMaterial color="#555555" />
            </Plane>

            {/* Room walls */}
            <RoomWalls />

            {/* Sample objects for scanning */}
            <ScanningObjects />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
        </>
    );
};

/**
 * Room walls component
 */
const RoomWalls = () => {
    // Wall dimensions and properties
    const wallHeight = 10;
    const roomSize = 30;
    const wallThickness = 0.5;
    const wallColor = "#888888";

    return (
        <>
            {/* North wall */}
            <Box
                position={[0, 3, -roomSize / 2]}
                args={[roomSize, wallHeight, wallThickness]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* West wall */}
            <Box
                position={[-roomSize / 2, 3, 0]}
                args={[wallThickness, wallHeight, roomSize]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* East wall */}
            <Box
                position={[roomSize / 2, 3, 0]}
                args={[wallThickness, wallHeight, roomSize]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>

            {/* South wall */}
            <Box
                position={[0, 3, roomSize / 2]}
                args={[roomSize, wallHeight, wallThickness]}
            >
                <meshStandardMaterial color={wallColor} />
            </Box>
        </>
    );
};

/**
 * Sample objects for LiDAR to scan
 */
const ScanningObjects = () => {
    return (
        <>
            {/* Orange box */}
            <Box position={[-5, 0, -5]} args={[2, 4, 2]}>
                <meshStandardMaterial color="orange" />
            </Box>

            {/* Blue box */}
            <Box position={[5, 0, 3]} args={[3, 1, 3]}>
                <meshStandardMaterial color="blue" />
            </Box>

            {/* Green sphere */}
            <Sphere position={[0, 0, -8]} args={[1.5, 32, 32]}>
                <meshStandardMaterial color="green" />
            </Sphere>
        </>
    );
};

export { Environment, RoomWalls, ScanningObjects }; 