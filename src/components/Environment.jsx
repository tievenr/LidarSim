import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Object configurations
const DISTANCE_MARKERS = [
    { name: "distance-10m", pos: [ 0, 1, 10 ], size: [ 1.5, 2, 1.5 ], color: "#ffaaaa" },
    { name: "distance-20m", pos: [ 5, 1.5, 20 ], size: [ 2, 3, 2 ], color: "#ffccaa" },
    { name: "distance-30m", pos: [ -5, 1, 30 ], size: [ 2, 2, 2 ], color: "#ffddaa" },
    { name: "distance-40m", pos: [ 8, 2, 40 ], size: [ 1.8, 4, 1.8 ], color: "#ffffaa" },
    { name: "distance-50m", pos: [ -10, 1.5, 50 ], size: [ 2.5, 3, 2.5 ], color: "#ddffaa" },
    { name: "distance-60m", pos: [ 12, 1, 60 ], size: [ 2, 2, 2 ], color: "#ccffaa" },
    { name: "distance-70m", pos: [ -15, 2.5, 70 ], size: [ 3, 5, 3 ], color: "#aaffaa" },
];

const OFF_ROAD_OBJECTS = [
    // Close range (5-15m)
    { name: "close-tree-1", pos: [ -8, 2, 8 ], type: "cylinder", args: [ 0.5, 0.8, 4 ], color: "#b8ccaa" },
    { name: "close-rock-1", pos: [ 12, 0.5, 12 ], type: "sphere", args: [ 1 ], color: "#cccccc" },
    { name: "close-building-1", pos: [ -15, 3, 15 ], type: "box", args: [ 4, 6, 3 ], color: "#e0d6c4" },

    // Medium range (20-40m)
    { name: "medium-tree-cluster", pos: [ 25, 3, 25 ], type: "cylinder", args: [ 1, 1.5, 6 ], color: "#a8c498" },
    { name: "medium-container-1", pos: [ -20, 1.5, 35 ], type: "box", args: [ 6, 3, 2.5 ], color: "#ffcc99" },
    { name: "medium-tower", pos: [ 30, 5, 30 ], type: "cylinder", args: [ 0.8, 1.2, 10 ], color: "#bbbbbb" },
    { name: "medium-shed", pos: [ -25, 2, 25 ], type: "box", args: [ 5, 4, 4 ], color: "#d4b896" },

    // Far range (45-70m)
    { name: "far-warehouse", pos: [ 35, 4, 50 ], type: "box", args: [ 12, 8, 8 ], color: "#b8b8b8" },
    { name: "far-silo", pos: [ -30, 6, 55 ], type: "cylinder", args: [ 2, 2, 12 ], color: "#d0d0d0" },
    { name: "far-forest-edge", pos: [ 40, 4, 60 ], type: "box", args: [ 8, 8, 4 ], color: "#9cb89c" },
    { name: "far-hill", pos: [ -35, 3, 65 ], type: "sphere", args: [ 5, 8, 6 ], color: "#bcd4bc" },
];

const TEST_OBJECTS = [
    // Very close (0.5-5m)
    { name: "very-close-post-1", pos: [ 2, 1, 2 ], type: "cylinder", args: [ 0.1, 0.1, 2 ], color: "#ffddaa" },
    { name: "very-close-post-2", pos: [ -3, 1, 3 ], type: "cylinder", args: [ 0.1, 0.1, 2 ], color: "#ffddaa" },
    { name: "very-close-barrier", pos: [ 4, 0.5, 4 ], type: "box", args: [ 0.2, 1, 2 ], color: "#ffccaa" },

    // Very close (under 0.1m) - Should be culled
    { name: "very-close-1", pos: [ 0.05, 2.02, 0.02 ], type: "box", args: [ 0.02, 0.02, 0.02 ], color: "#ff00ff" },
    { name: "very-close-2", pos: [ -0.03, 1.98, 0.04 ], type: "sphere", args: [ 0.01 ], color: "#ff00ff" },
    { name: "very-close-3", pos: [ 0.02, 2.05, -0.03 ], type: "cylinder", args: [ 0.005, 0.005, 0.02 ], color: "#ff00ff" },

    // Extreme close (0.1-0.2m) - Should be culled
    { name: "extreme-close-1", pos: [ 0.15, 0.1, 0.1 ], type: "box", args: [ 0.05, 0.2, 0.05 ], color: "#ff0000" },
    { name: "extreme-close-2", pos: [ -0.1, 0.1, 0.15 ], type: "sphere", args: [ 0.03 ], color: "#ff0000" },
    { name: "extreme-close-3", pos: [ 0.2, 0.05, -0.1 ], type: "cylinder", args: [ 0.02, 0.02, 0.1 ], color: "#ff0000" },

    // Beyond range (80m+) - Should be culled
    { name: "beyond-range-1", pos: [ 0, 5, 85 ], type: "box", args: [ 10, 10, 10 ], color: "#ffccff" },
    { name: "beyond-range-2", pos: [ 50, 3, 90 ], type: "box", args: [ 5, 6, 5 ], color: "#ffccff" },
    { name: "beyond-range-3", pos: [ -60, 4, 95 ], type: "box", args: [ 8, 8, 8 ], color: "#ffccff" },
    { name: "beyond-range-4", pos: [ 100, 2, 100 ], type: "box", args: [ 5, 4, 5 ], color: "#ffccff" },
    { name: "beyond-range-5", pos: [ -80, 3, -80 ], type: "box", args: [ 6, 6, 6 ], color: "#ffccff" },
];

const BUILDINGS = [
    { name: "office-building", pos: [ -25, 15, -25 ], size: [ 20, 30, 15 ], color: "#e0d6c4" },
    { name: "house", pos: [ 30, 8, 35 ], size: [ 12, 8, 10 ], color: "#ddbaa6" },
];

// Geometry component helper
const GeometryByType = ( { type, args } ) =>
{
    switch ( type )
    {
        case 'cylinder': return <cylinderGeometry args={args} />;
        case 'sphere': return <sphereGeometry args={args} />;
        case 'box': return <boxGeometry args={args} />;
        default: return <boxGeometry args={args} />;
    }
};

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
            {/* Ground system */}
            <mesh name="ground" rotation={[ -Math.PI / 2, 0, 0 ]} receiveShadow>
                <planeGeometry args={[ 800, 800 ]} />
                <meshLambertMaterial color="#d4f0d4" />
            </mesh>

            <mesh name="road" position={[ 0, 0.01, 0 ]} rotation={[ -Math.PI / 2, 0, 0 ]} receiveShadow>
                <planeGeometry args={[ 32, 400 ]} />
                <meshLambertMaterial color="#c0c0c0" />
            </mesh>

            <mesh name="center-line" position={[ 0, 0.02, 0 ]} rotation={[ -Math.PI / 2, 0, 0 ]}>
                <planeGeometry args={[ 0.8, 400 ]} />
                <meshLambertMaterial color="#ffff80" />
            </mesh>

            {/* Distance markers */}
            {DISTANCE_MARKERS.map( marker => (
                <mesh key={marker.name} name={marker.name} position={marker.pos} castShadow receiveShadow>
                    <boxGeometry args={marker.size} />
                    <meshLambertMaterial color={marker.color} />
                </mesh>
            ) )}

            {/* Off-road objects */}
            {OFF_ROAD_OBJECTS.map( obj => (
                <mesh key={obj.name} name={obj.name} position={obj.pos} castShadow receiveShadow>
                    <GeometryByType type={obj.type} args={obj.args} />
                    <meshLambertMaterial color={obj.color} />
                </mesh>
            ) )}

            {/* Test objects */}
            {TEST_OBJECTS.map( obj => (
                <mesh key={obj.name} name={obj.name} position={obj.pos} castShadow receiveShadow>
                    <GeometryByType type={obj.type} args={obj.args} />
                    <meshLambertMaterial color={obj.color} />
                </mesh>
            ) )}

            {/* Buildings */}
            {BUILDINGS.map( building => (
                <mesh key={building.name} name={building.name} position={building.pos} castShadow receiveShadow>
                    <boxGeometry args={building.size} />
                    <meshLambertMaterial color={building.color} />
                </mesh>
            ) )}

            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[ 50, 50, 25 ]} intensity={1} castShadow />
        </>
    );
};

export default Environment;