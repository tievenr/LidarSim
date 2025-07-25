import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import StaticInstances from './StaticInstances';
import DynamicInstances from './DynamicInstances';
import Lighting from './Lighting';


const Environment = React.memo( () =>
{
    const groundRef = useRef();
    const roadRef = useRef();
    const sphereRef = useRef();

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
        if ( sphereRef.current )
        {
            sphereRef.current.geometry.computeBoundsTree();
        }
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
            {/* Huge hollow test sphere centered at the lidar, with BVH */}
            <mesh
                ref={sphereRef}
                name="hollow-sphere"
                position={[ 0, 2, 0 ]}
                receiveShadow
                castShadow
            >
                <sphereGeometry args={[ 40, 64, 64 ]} />
                <meshStandardMaterial
                    color="#ff8888"
                    roughness={0.4}
                    metalness={0.2}
                    transparent
                    opacity={0.3}
                    side={THREE.BackSide}
                />
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