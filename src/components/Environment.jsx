import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

const Environment = () =>
{
    const { scene } = useThree();

    useEffect( () =>
    {
        const computeBoundingSpheres = () =>
        {
            console.time( 'Bounding Sphere Computation' );

            scene.traverse( ( child ) =>
            {
                if ( child.isMesh && child.geometry )
                {
                    child.geometry.computeBoundingSphere();
                    console.log( `Processed: ${ child.name || 'unnamed mesh' }` );
                }
            } );

            console.timeEnd( 'Bounding Sphere Computation' );
        };

        const timer = setTimeout( computeBoundingSpheres, 100 );
        return () => clearTimeout( timer );
    }, [ scene ] );

    return (
        <>
            {/* Ground plane - Much lighter green */}
            <mesh name="ground" rotation={[ -Math.PI / 2, 0, 0 ]} receiveShadow>
                <planeGeometry args={[ 800, 800 ]} />
                <meshLambertMaterial color="#d4f0d4" />
            </mesh>

            {/* Road system - Light gray instead of dark */}
            <mesh name="road" position={[ 0, 0.01, 0 ]} rotation={[ -Math.PI / 2, 0, 0 ]} receiveShadow>
                <planeGeometry args={[ 32, 400 ]} />
                <meshLambertMaterial color="#c0c0c0" />
            </mesh>

            <mesh name="center-line" position={[ 0, 0.02, 0 ]} rotation={[ -Math.PI / 2, 0, 0 ]}>
                <planeGeometry args={[ 0.8, 400 ]} />
                <meshLambertMaterial color="#ffff80" />
            </mesh>

            {/* Distance markers on road - Lighter, more pastel colors */}
            <mesh name="distance-10m" position={[ 0, 1, 10 ]} castShadow receiveShadow>
                <boxGeometry args={[ 1.5, 2, 1.5 ]} />
                <meshLambertMaterial color="#ffaaaa" />
            </mesh>

            <mesh name="distance-20m" position={[ 5, 1.5, 20 ]} castShadow receiveShadow>
                <boxGeometry args={[ 2, 3, 2 ]} />
                <meshLambertMaterial color="#ffccaa" />
            </mesh>

            <mesh name="distance-30m" position={[ -5, 1, 30 ]} castShadow receiveShadow>
                <boxGeometry args={[ 2, 2, 2 ]} />
                <meshLambertMaterial color="#ffddaa" />
            </mesh>

            <mesh name="distance-40m" position={[ 8, 2, 40 ]} castShadow receiveShadow>
                <boxGeometry args={[ 1.8, 4, 1.8 ]} />
                <meshLambertMaterial color="#ffffaa" />
            </mesh>

            <mesh name="distance-50m" position={[ -10, 1.5, 50 ]} castShadow receiveShadow>
                <boxGeometry args={[ 2.5, 3, 2.5 ]} />
                <meshLambertMaterial color="#ddffaa" />
            </mesh>

            <mesh name="distance-60m" position={[ 12, 1, 60 ]} castShadow receiveShadow>
                <boxGeometry args={[ 2, 2, 2 ]} />
                <meshLambertMaterial color="#ccffaa" />
            </mesh>

            <mesh name="distance-70m" position={[ -15, 2.5, 70 ]} castShadow receiveShadow>
                <boxGeometry args={[ 3, 5, 3 ]} />
                <meshLambertMaterial color="#aaffaa" />
            </mesh>

            {/* OFF-ROAD OBJECTS - Much lighter colors */}

            {/* Close range off-road objects (5-15m) */}
            <mesh name="close-tree-1" position={[ -8, 2, 8 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.5, 0.8, 4 ]} />
                <meshLambertMaterial color="#b8ccaa" />
            </mesh>

            <mesh name="close-rock-1" position={[ 12, 0.5, 12 ]} castShadow receiveShadow>
                <sphereGeometry args={[ 1 ]} />
                <meshLambertMaterial color="#cccccc" />
            </mesh>

            <mesh name="close-building-1" position={[ -15, 3, 15 ]} castShadow receiveShadow>
                <boxGeometry args={[ 4, 6, 3 ]} />
                <meshLambertMaterial color="#e0d6c4" />
            </mesh>

            {/* Medium range off-road objects (20-40m) */}
            <mesh name="medium-tree-cluster" position={[ 25, 3, 25 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 1, 1.5, 6 ]} />
                <meshLambertMaterial color="#a8c498" />
            </mesh>

            <mesh name="medium-container-1" position={[ -20, 1.5, 35 ]} castShadow receiveShadow>
                <boxGeometry args={[ 6, 3, 2.5 ]} />
                <meshLambertMaterial color="#ffcc99" />
            </mesh>

            <mesh name="medium-tower" position={[ 30, 5, 30 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.8, 1.2, 10 ]} />
                <meshLambertMaterial color="#bbbbbb" />
            </mesh>

            <mesh name="medium-shed" position={[ -25, 2, 25 ]} castShadow receiveShadow>
                <boxGeometry args={[ 5, 4, 4 ]} />
                <meshLambertMaterial color="#d4b896" />
            </mesh>

            {/* Far range off-road objects (45-70m) */}
            <mesh name="far-warehouse" position={[ 35, 4, 50 ]} castShadow receiveShadow>
                <boxGeometry args={[ 12, 8, 8 ]} />
                <meshLambertMaterial color="#b8b8b8" />
            </mesh>

            <mesh name="far-silo" position={[ -30, 6, 55 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 2, 2, 12 ]} />
                <meshLambertMaterial color="#d0d0d0" />
            </mesh>

            <mesh name="far-forest-edge" position={[ 40, 4, 60 ]} castShadow receiveShadow>
                <boxGeometry args={[ 8, 8, 4 ]} />
                <meshLambertMaterial color="#9cb89c" />
            </mesh>

            <mesh name="far-hill" position={[ -35, 3, 65 ]} castShadow receiveShadow>
                <sphereGeometry args={[ 5, 8, 6 ]} />
                <meshLambertMaterial color="#bcd4bc" />
            </mesh>

            {/* Very close objects (0.5-5m) - Test minimum distance culling */}
            <mesh name="very-close-post-1" position={[ 2, 1, 2 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.1, 0.1, 2 ]} />
                <meshLambertMaterial color="#ffddaa" />
            </mesh>

            <mesh name="very-close-post-2" position={[ -3, 1, 3 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.1, 0.1, 2 ]} />
                <meshLambertMaterial color="#ffddaa" />
            </mesh>

            <mesh name="very-close-barrier" position={[ 4, 0.5, 4 ]} castShadow receiveShadow>
                <boxGeometry args={[ 0.2, 1, 2 ]} />
                <meshLambertMaterial color="#ffccaa" />
            </mesh>

            {/* VERY CLOSE objects (under 0.1m from sensor at [0,2,0]) - Should be culled by minimum distance */}
            <mesh name="very-close-1" position={[ 0.05, 2.02, 0.02 ]} castShadow receiveShadow>
                <boxGeometry args={[ 0.02, 0.02, 0.02 ]} />
                <meshLambertMaterial color="#ff00ff" />
            </mesh>

            <mesh name="very-close-2" position={[ -0.03, 1.98, 0.04 ]} castShadow receiveShadow>
                <sphereGeometry args={[ 0.01 ]} />
                <meshLambertMaterial color="#ff00ff" />
            </mesh>

            <mesh name="very-close-3" position={[ 0.02, 2.05, -0.03 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.005, 0.005, 0.02 ]} />
                <meshLambertMaterial color="#ff00ff" />
            </mesh>

            {/* EXTREME CLOSE objects (0.1-0.2m) - Should be culled by minimum distance */}
            <mesh name="extreme-close-1" position={[ 0.15, 0.1, 0.1 ]} castShadow receiveShadow>
                <boxGeometry args={[ 0.05, 0.2, 0.05 ]} />
                <meshLambertMaterial color="#ff0000" />
            </mesh>

            <mesh name="extreme-close-2" position={[ -0.1, 0.1, 0.15 ]} castShadow receiveShadow>
                <sphereGeometry args={[ 0.03 ]} />
                <meshLambertMaterial color="#ff0000" />
            </mesh>

            <mesh name="extreme-close-3" position={[ 0.2, 0.05, -0.1 ]} castShadow receiveShadow>
                <cylinderGeometry args={[ 0.02, 0.02, 0.1 ]} />
                <meshLambertMaterial color="#ff0000" />
            </mesh>

            {/* Objects beyond culling range (80m+) - Should be culled by maximum distance */}
            <mesh name="beyond-range-1" position={[ 0, 5, 85 ]} castShadow receiveShadow>
                <boxGeometry args={[ 10, 10, 10 ]} />
                <meshLambertMaterial color="#ffccff" />
            </mesh>

            <mesh name="beyond-range-2" position={[ 50, 3, 90 ]} castShadow receiveShadow>
                <boxGeometry args={[ 5, 6, 5 ]} />
                <meshLambertMaterial color="#ffccff" />
            </mesh>

            <mesh name="beyond-range-3" position={[ -60, 4, 95 ]} castShadow receiveShadow>
                <boxGeometry args={[ 8, 8, 8 ]} />
                <meshLambertMaterial color="#ffccff" />
            </mesh>

            <mesh name="beyond-range-4" position={[ 100, 2, 100 ]} castShadow receiveShadow>
                <boxGeometry args={[ 5, 4, 5 ]} />
                <meshLambertMaterial color="#ffccff" />
            </mesh>

            <mesh name="beyond-range-5" position={[ -80, 3, -80 ]} castShadow receiveShadow>
                <boxGeometry args={[ 6, 6, 6 ]} />
                <meshLambertMaterial color="#ffccff" />
            </mesh>

            {/* Original buildings - Much lighter */}
            <mesh name="office-building" position={[ -25, 15, -25 ]} castShadow receiveShadow>
                <boxGeometry args={[ 20, 30, 15 ]} />
                <meshLambertMaterial color="#e0d6c4" />
            </mesh>

            <mesh name="house" position={[ 30, 8, 35 ]} castShadow receiveShadow>
                <boxGeometry args={[ 12, 8, 10 ]} />
                <meshLambertMaterial color="#ddbaa6" />
            </mesh>

            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[ 50, 50, 25 ]} intensity={1} castShadow />
        </>
    );
};

export default Environment;