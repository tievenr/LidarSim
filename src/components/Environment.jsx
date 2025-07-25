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
                <planeGeometry args={[ 200, 200 ]} />
                <meshStandardMaterial color="#b6e3b6" roughness={0.7} metalness={0.08} />
            </mesh>

            {/* Road as a box geometry */}
            <mesh
                ref={roadRef}
                name="road"
                position={[ 0, 0.06, 0 ]} // slightly above ground
                receiveShadow
                castShadow
            >
                {/* width, height (thickness), depth */}
                <boxGeometry args={[ 15, 0.12, 200 ]} />
                <meshStandardMaterial
                    color="#444"
                    roughness={0.5}
                    metalness={0.3}
                    opacity={0.98}
                    transparent
                />
                {/* Lane lines */}
                <mesh position={[ 0, 0.07, 0 ]}>
                    <boxGeometry args={[ 0.3, 0.01, 200 ]} />
                    <meshStandardMaterial color="#fff" roughness={0.3} metalness={0.1} opacity={0.7} transparent />
                </mesh>
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
                    color="#4fd1ff"
                    roughness={0.2}
                    metalness={0.5}
                    transparent
                    opacity={0.18}
                    side={THREE.BackSide}
                    emissive="#4fd1ff"
                    emissiveIntensity={0.12}
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