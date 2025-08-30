import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Simple fallback car mesh for better performance
const FallbackCar = ( { scale = 0.25, position = [ 0, 0, 0 ], rotation = [ 0, 0, 0 ] } ) =>
{
    return (
        <group position={position} rotation={rotation} scale={scale}>
            {/* Car body */}
            <mesh position={[ 0, 0.5, 0 ]} castShadow receiveShadow>
                <boxGeometry args={[ 4, 1, 8 ]} />
                <meshStandardMaterial color="#0066cc" />
            </mesh>

            {/* Car roof */}
            <mesh position={[ 0, 1.2, -1 ]} castShadow receiveShadow>
                <boxGeometry args={[ 3, 0.8, 4 ]} />
                <meshStandardMaterial color="#004499" />
            </mesh>

            {/* Wheels */}
            <mesh position={[ -1.5, 0, 2.5 ]} castShadow>
                <cylinderGeometry args={[ 0.6, 0.6, 0.3, 8 ]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[ 1.5, 0, 2.5 ]} castShadow>
                <cylinderGeometry args={[ 0.6, 0.6, 0.3, 8 ]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[ -1.5, 0, -2.5 ]} castShadow>
                <cylinderGeometry args={[ 0.6, 0.6, 0.3, 8 ]} />
                <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[ 1.5, 0, -2.5 ]} castShadow>
                <cylinderGeometry args={[ 0.6, 0.6, 0.3, 8 ]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
};

// Optimized GLB Car component
const GLBCar = ( { scale, position, rotation, onLoad, onError } ) =>
{
    const carRef = useRef();

    try
    {
        const { scene: gltfScene } = useGLTF( '/models/car.glb' );

        useEffect( () =>
        {
            if ( gltfScene && carRef.current )
            {
                const carMesh = gltfScene.clone();

                // Optimize the model
                carMesh.traverse( ( child ) =>
                {
                    if ( child.isMesh )
                    {
                        // Reduce geometry complexity for performance
                        if ( child.geometry )
                        {
                            child.geometry.deleteAttribute( 'uv2' );
                            child.geometry.deleteAttribute( 'tangent' );
                        }

                        // Optimize materials
                        if ( child.material )
                        {
                            child.material.flatShading = true;
                            child.material.needsUpdate = true;
                        }

                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                } );

                carMesh.scale.setScalar( scale );
                carMesh.position.set( ...position );
                carMesh.rotation.set( ...rotation );

                carRef.current.clear();
                carRef.current.add( carMesh );

                onLoad?.( carRef.current );
            }
        }, [ gltfScene, scale, position, rotation ] ); // Removed onLoad from dependencies

        return <group ref={carRef} />;
    } catch ( error )
    {
        onError?.( error );
        return null;
    }
};

const Car = ( {
    position = [ 0, 0, 0 ],
    rotation = [ 0, 0, 0 ],
    scale = 0.25,
    onCarReady = null,
    enablePhysics = false,
    physicsWorld = null,
    useSimpleCar = false // Option to use simple car for better performance
} ) =>
{
    const carRef = useRef();
    const [ carLoaded, setCarLoaded ] = useState( false );
    const [ useGLB, setUseGLB ] = useState( !useSimpleCar );
    const [ physicsBody, setPhysicsBody ] = useState( null );

    // Stable car object to prevent re-renders
    const stableCar = useRef( { mesh: null, input: null } );

    // Input handling for car controls
    const input = useRef( { forward: 0, turn: 0, brake: 0 } );

    // Initialize keyboard controls
    useEffect( () =>
    {
        const handleKeyDown = ( event ) =>
        {
            switch ( event.code )
            {
                case 'KeyW':
                case 'ArrowUp':
                    input.current.forward = 1;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    input.current.forward = -1;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    input.current.turn = -1;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    input.current.turn = 1;
                    break;
                case 'Space':
                    input.current.brake = 1;
                    event.preventDefault();
                    break;
            }
        };

        const handleKeyUp = ( event ) =>
        {
            switch ( event.code )
            {
                case 'KeyW':
                case 'ArrowUp':
                case 'KeyS':
                case 'ArrowDown':
                    input.current.forward = 0;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                case 'KeyD':
                case 'ArrowRight':
                    input.current.turn = 0;
                    break;
                case 'Space':
                    input.current.brake = 0;
                    event.preventDefault();
                    break;
            }
        };

        window.addEventListener( 'keydown', handleKeyDown );
        window.addEventListener( 'keyup', handleKeyUp );

        return () =>
        {
            window.removeEventListener( 'keydown', handleKeyDown );
            window.removeEventListener( 'keyup', handleKeyUp );
        };
    }, [] );

    // Handle GLB model loading success
    const handleGLBLoad = useCallback( ( carMesh ) =>
    {
        setCarLoaded( true );
        carRef.current = carMesh;

        // Update stable car object
        stableCar.current.mesh = carMesh;
        stableCar.current.input = input.current;

        if ( onCarReady )
        {
            onCarReady( stableCar.current );
        }

        console.log( 'GLB Car loaded successfully' );
    }, [ onCarReady ] );

    // Handle GLB model loading error
    const handleGLBError = useCallback( ( error ) =>
    {
        console.warn( 'GLB Car loading failed, using simple car:', error );
        setUseGLB( false );
        setCarLoaded( true );
    }, [] );

    // Handle simple car setup
    useEffect( () =>
    {
        if ( !useGLB && carRef.current )
        {
            setCarLoaded( true );

            // Update stable car object
            stableCar.current.mesh = carRef.current;
            stableCar.current.input = input.current;

            if ( onCarReady )
            {
                onCarReady( stableCar.current );
            }

            console.log( 'Simple car loaded successfully' );
        }
    }, [ useGLB ] ); // Removed onCarReady from dependencies

    // Simple movement logic (non-physics based)
    useFrame( ( state, delta ) =>
    {
        if ( carRef.current && carLoaded && !enablePhysics )
        {
            const speed = 8;
            const turnSpeed = 3;

            // Apply forward/backward movement
            if ( input.current.forward !== 0 )
            {
                carRef.current.translateZ( -input.current.forward * speed * delta );
            }

            // Apply turning
            if ( input.current.turn !== 0 )
            {
                carRef.current.rotateY( -input.current.turn * turnSpeed * delta );
            }
        }
    } );

    return (
        <group ref={!useGLB ? carRef : undefined} name="car-container">
            {useGLB ? (
                <Suspense fallback={<FallbackCar scale={scale} position={position} rotation={rotation} />}>
                    <GLBCar
                        scale={scale}
                        position={position}
                        rotation={rotation}
                        onLoad={handleGLBLoad}
                        onError={handleGLBError}
                    />
                </Suspense>
            ) : (
                <FallbackCar scale={scale} position={position} rotation={rotation} />
            )}
        </group>
    );
};

// Only preload if we're going to use it
// useGLTF.preload('/models/car.glb');

export default Car;
