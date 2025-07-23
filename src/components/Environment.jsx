import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import StaticInstances from './StaticInstances';
import DynamicInstances from './DynamicInstances';
import Lighting from './Lighting';

// Patch Three.js raycast once (safe to call multiple times)
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const Environment = React.memo( () =>
{
    const groundRef = useRef();
    const roadRef = useRef();

    useEffect( () =>
    {
        if ( groundRef.current )
        {
            groundRef.current.geometry.computeBoundsTree();
        }
        if ( roadRef.current )
        {
            roadRef.current.geometry.computeBoundsTree();
        }
        // Add more refs here for other static meshes if needed
    }, [] );

    return (
        <>
            {/* Ground system */}
            <mesh
                ref={groundRef}
                name="ground"
                rotation={[ -Math.PI / 2, 0, 0 ]}
                receiveShadow
            >
                <planeGeometry args={[ 800, 800 ]} />
                <meshStandardMaterial color="#d4f0d4" roughness={0.8} metalness={0.1} />
            </mesh>

            {/* Road as a box geometry */}
            <mesh
                ref={roadRef}
                name="road"
                position={[ 0, 0.05, 0 ]} // slightly above ground
                receiveShadow
                castShadow
            >
                {/* width, height (thickness), depth */}
                <boxGeometry args={[ 32, 0.1, 800 ]} />
                <meshStandardMaterial color="#c0c0c0" roughness={0.7} metalness={0.2} />
            </mesh>

            {/* Static and dynamic instances */}
            <StaticInstances />
            <DynamicInstances />

            {/* Lighting */}
            <Lighting />
        </>
    );
} );

export default Environment;