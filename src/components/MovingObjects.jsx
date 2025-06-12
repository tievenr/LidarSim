import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Sphere } from '@react-three/drei';

const MovingObjects = () => {
    const movingBoxRef = useRef();
    const movingSphereRef = useRef();

    useFrame((state) => {
        const time = state.clock.getElapsedTime();
        
        // Moving box - back and forth along Z axis
        if (movingBoxRef.current) {
            movingBoxRef.current.position.z = -20 + Math.sin(time * 0.5) * 15;
        }
        
        // Moving sphere - circular motion in XZ plane
        if (movingSphereRef.current) {
            const radius = 12;
            movingSphereRef.current.position.x = Math.cos(time * 0.8) * radius;
            movingSphereRef.current.position.z = Math.sin(time * 0.8) * radius - 10;
        }
    });

    return (
        <>
            {/* Moving Box - back and forth */}
            <Box
                ref={movingBoxRef}
                position={[5, 2, -20]}
                args={[3, 4, 2]}
                castShadow
                userData={{ type: 'moving-object', id: 'moving-box' }}
            >
                <meshStandardMaterial color="#FF6B6B" />
            </Box>

            {/* Moving Sphere - circular motion */}
            <Sphere
                ref={movingSphereRef}
                position={[12, 1.5, -10]}
                args={[1.5]}
                castShadow
                userData={{ type: 'moving-object', id: 'moving-sphere' }}
            >
                <meshStandardMaterial color="#4ECDC4" />
            </Sphere>

            {/* Static reference object for comparison */}
            <Box
                position={[-8, 1, -25]}
                args={[2, 2, 2]}
                castShadow
                userData={{ type: 'reference-object', id: 'static-reference' }}
            >
                <meshStandardMaterial color="#FFE66D" />
            </Box>
        </>
    );
};

export default MovingObjects;
