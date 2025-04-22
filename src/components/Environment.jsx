import React from 'react';
import { Box, Plane, Cylinder } from '@react-three/drei';

/**
 * Environment component - Contains all the 3D objects in the scene
 */
const Environment = () => {
    return (
        <>
            {/* Ground plane */}
            <Plane
                args={[100, 100]}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.01, 0]}
                receiveShadow
            >
                <meshStandardMaterial color="#4a7c3a" />
            </Plane>
            
            {/* Road system */}
            <RoadSystem />
            
            {/* All scannable objects */}
            <ScannableObjects />
            
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 15, 5]} intensity={1} castShadow />
        </>
    );
};

/**
 * RoadSystem component - Road network with lane markings
 */
const RoadSystem = () => {
    // Road dimensions
    const roadWidth = 10.5; // 3 lanes x 3.5m each
    const roadLength = 100;
    const laneWidth = 3.5;
    
    return (
        <>
            {/* Main Road */}
            <Plane
                args={[roadWidth, roadLength]}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.1, 0]}
                receiveShadow
            >
                <meshStandardMaterial color="#555555" roughness={0.8} />
            </Plane>
            
            {/* Lane markings */}
            <Plane
                args={[0.15, roadLength]}
                position={[-laneWidth/2, 0.11, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <meshStandardMaterial color="white" />
            </Plane>
            
            <Plane
                args={[0.15, roadLength]}
                position={[laneWidth/2, 0.11, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <meshStandardMaterial color="white" />
            </Plane>
            
            {/* Dashed center line */}
            {Array.from({ length: 20 }).map((_, index) => (
                <Plane
                    key={`centerline-${index}`}
                    args={[0.15, 3]}
                    position={[0, 0.11, -roadLength/2 + 5 + index * 5]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <meshStandardMaterial color="yellow" />
                </Plane>
            ))}
        </>
    );
};

/**
 * ScannableObjects component - ALL objects are now scannable
 */
const ScannableObjects = () => {
    // Tree positions for reuse
    const treePositions = [
        [-15, -20], [-18, -10], [-12, 0], [-16, 10], // Left side
        [15, -25], [18, -15], [12, -5], [16, 5],     // Right side
    ];
    
    // Vehicle positions for reuse
    const vehiclePositions = [
        { pos: [3.5, -10], color: "blue" },
        { pos: [-3.5, 5], color: "red" }
    ];
    
    return (
        <>
            {/* Trees as textured rectangular blocks - based on the image */}
            {treePositions.map((pos, index) => (
                <React.Fragment key={`tree-${index}`}>
                    {/* Tree as a single tall block with texture effect */}
                    <Box 
                        position={[pos[0], 3, pos[1]]} 
                        args={[2.5, 6, 2.5]} 
                        castShadow
                        userData={{ type: 'tree', id: `tree-${index}` }}
                    >
                        <meshStandardMaterial 
                            color="#2D5F3C" 
                            roughness={0.9}
                            userData={{ 
                                noise: true, // Flag for shader to add noise
                                noiseScale: 0.1, // Scale of the noise
                                noiseStrength: 0.2 // Strength of the noise effect
                            }}
                        >
                            {/* Custom shader to create textured appearance */}
                            <primitive object={
                                {
                                    onBeforeCompile: (shader) => {
                                        shader.uniforms.time = { value: 0 };
                                        shader.vertexShader = `
                                            varying vec3 vPosition;
                                            ${shader.vertexShader}
                                        `.replace(
                                            '#include <begin_vertex>',
                                            `
                                            #include <begin_vertex>
                                            vPosition = position;
                                            `
                                        );
                                        shader.fragmentShader = `
                                            varying vec3 vPosition;
                                            float random(vec3 scale, float seed) {
                                                return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
                                            }
                                            ${shader.fragmentShader}
                                        `.replace(
                                            '#include <dithering_fragment>',
                                            `
                                            #include <dithering_fragment>
                                            float noise = random(vec3(vPosition * 0.1), 0.0);
                                            gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * (1.0 - noise * 0.2), 0.8);
                                            `
                                        );
                                    }
                                }
                            } />
                        </meshStandardMaterial>
                    </Box>
                </React.Fragment>
            ))}
            
            {/* Vehicles with scannable wheels and bodies */}
            {vehiclePositions.map((vehicle, index) => {
                const x = vehicle.pos[0];
                const z = vehicle.pos[1];
                
                return (
                    <React.Fragment key={`vehicle-${index}`}>
                        {/* Vehicle body - scannable */}
                        <Box 
                            position={[x, 0.9, z]} 
                            args={[1.8, 1.8, 4.5]} 
                            castShadow
                            userData={{ type: 'vehicle-body', id: `vehicle-${index}`}}
                        >
                            <meshStandardMaterial 
                                color={vehicle.color} 
                                metalness={0.5} 
                                roughness={0.5} 
                            />
                        </Box>
                        
                        {/* Vehicle wheels - now scannable with userData */}
                        {/* Front left wheel */}
                        <Cylinder 
                            position={[x + 0.9, 0.3, z + 1.3]} 
                            rotation={[Math.PI / 2, 0, 0]} 
                            args={[0.4, 0.4, 0.3, 16]} 
                            castShadow
                            userData={{ type: 'wheel', id: `wheel-${index}-fl`, vehicleId: `vehicle-${index}` }}
                        >
                            <meshStandardMaterial color="black" />
                        </Cylinder>
                        
                        {/* Front right wheel */}
                        <Cylinder 
                            position={[x - 0.9, 0.3, z + 1.3]} 
                            rotation={[Math.PI / 2, 0, 0]} 
                            args={[0.4, 0.4, 0.3, 16]} 
                            castShadow
                            userData={{ type: 'wheel', id: `wheel-${index}-fr`, vehicleId: `vehicle-${index}` }}
                        >
                            <meshStandardMaterial color="black" />
                        </Cylinder>
                        
                        {/* Rear left wheel */}
                        <Cylinder 
                            position={[x + 0.9, 0.3, z - 1.3]} 
                            rotation={[Math.PI / 2, 0, 0]} 
                            args={[0.4, 0.4, 0.3, 16]} 
                            castShadow
                            userData={{ type: 'wheel', id: `wheel-${index}-rl`, vehicleId: `vehicle-${index}` }}
                        >
                            <meshStandardMaterial color="black" />
                        </Cylinder>
                        
                        {/* Rear right wheel */}
                        <Cylinder 
                            position={[x - 0.9, 0.3, z - 1.3]} 
                            rotation={[Math.PI / 2, 0, 0]} 
                            args={[0.4, 0.4, 0.3, 16]} 
                            castShadow
                            userData={{ type: 'wheel', id: `wheel-${index}-rr`, vehicleId: `vehicle-${index}` }}
                        >
                            <meshStandardMaterial color="black" />
                        </Cylinder>
                    </React.Fragment>
                );
            })}
            
            {/* Traffic signs - scannable */}
            <Cylinder 
                position={[-7, 1.5, 10]} 
                args={[0.1, 0.1, 3, 8]} 
                castShadow
                userData={{ type: 'sign-post', id: 'sign-1' }}
            >
                <meshStandardMaterial color="#888888" />
            </Cylinder>
            
            <Box 
                position={[-7, 2.8, 10]} 
                args={[1, 1, 0.1]} 
                castShadow
                userData={{ type: 'sign', id: 'sign-face-1' }}
            >
                <meshStandardMaterial color="red" />
            </Box>
            
            <Cylinder 
                position={[7, 1.5, -10]} 
                args={[0.1, 0.1, 3, 8]} 
                castShadow
                userData={{ type: 'sign-post', id: 'sign-2' }}
            >
                <meshStandardMaterial color="#888888" />
            </Cylinder>
            
            <Box 
                position={[7, 2.8, -10]} 
                args={[1, 1, 0.1]} 
                castShadow
                userData={{ type: 'sign', id: 'sign-face-2' }}
            >
                <meshStandardMaterial color="blue" />
            </Box>
        </>
    );
};

export { Environment, RoadSystem, ScannableObjects };