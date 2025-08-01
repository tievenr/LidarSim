// src/components/Environment.jsx
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import SceneInstances from './SceneInstances';
import Lighting from './Lighting';

const Environment = React.memo( () =>
{
    const groundRef = useRef();
    const roadRef = useRef();

    useEffect( () =>
    {
        // Compute BVH for the static environment meshes
        if ( groundRef.current )
        {
            groundRef.current.geometry.computeBoundsTree();
        }
        if ( roadRef.current )
        {
            roadRef.current.geometry.computeBoundsTree();
        }
    }, [] );

    return (
        <>
            {/* Lighting FIRST - instances need light to render properly */}
            <Lighting />

            {/* Ground system */}
            <mesh
                ref={groundRef}
                name="ground"
                rotation={[ -Math.PI / 2, 0, 0 ]}
                receiveShadow
            >
                <planeGeometry args={[ 800, 800 ]} />
                <meshStandardMaterial
                    color="#18181b"
                    roughness={0.7}
                    metalness={0.08}
                />
            </mesh>

            {/* Road as a box geometry */}
            <mesh
                ref={roadRef}
                name="road"
                position={[ 0, 0.05, 0 ]}
                receiveShadow
                castShadow
            >
                <boxGeometry args={[ 15, 0.1, 800 ]} />
                <meshStandardMaterial
                    color="#444"
                    roughness={0.5}
                    metalness={0.3}
                    opacity={0.98}
                    transparent
                />

                {/* Lane lines */}
                <mesh position={[ 0, 0.07, 0 ]}>
                    <boxGeometry args={[ 0.3, 0.01, 800 ]} />
                    <meshStandardMaterial
                        color="#fff"
                        roughness={0.3}
                        metalness={0.1}
                        opacity={0.7}
                        transparent
                    />
                </mesh>
            </mesh>

            {/* Combined Static and Dynamic Instances */}
            /*<SceneInstances />*/
        </>
    );
} );

export default Environment;