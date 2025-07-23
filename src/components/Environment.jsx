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
    const sphereRef = useRef();
    const groundRef = useRef();

    useEffect( () =>
    {
        if ( groundRef.current )
        {
            groundRef.current.geometry.computeBoundsTree();
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


            {/* Static and dynamic instances */}
            <StaticInstances />
            <DynamicInstances />

            {/* Lighting */}
            <Lighting />
        </>
    );
} );

export default Environment;