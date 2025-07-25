// src/components/SceneInstances.jsx
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { InstancedMesh2 } from '@three.ez/instanced-mesh';

const STATIC_BUILDINGS_COUNT = 500;
const DYNAMIC_CARS_COUNT = 5;

const SceneInstances = () =>
{
    console.log( 'SceneInstances: Component Rendered' );
    const { scene } = useThree();
    console.log( 'SceneInstances: useThree() scene object:', scene );

    const staticBuildingsInstancedMeshRef = useRef();
    const dynamicCarsInstancedMeshRef = useRef();

    const { buildingGeometry, buildingMaterial, carGeometry, carMaterial } = useMemo( () =>
    {
        console.log( 'SceneInstances: useMemo for geometries and materials.' );
        const buildingGeo = new THREE.BoxGeometry( 10, 30, 10 );
        const buildingMat = new THREE.MeshStandardMaterial( { color: '#777777', roughness: 0.7, metalness: 0.1, vertexColors: true } );

        const carGeo = new THREE.BoxGeometry( 1.8, 0.8, 4 );
        const carMat = new THREE.MeshStandardMaterial( { color: '#FF0000', roughness: 0.5, metalness: 0.2, vertexColors: true } );

        return { buildingGeometry: buildingGeo, buildingMaterial: buildingMat, carGeometry: carGeo, carMaterial: carMat };
    }, [] );

    // --- Setup for Static Instances (Buildings) ---
    useEffect( () =>
    {
        console.log( 'SceneInstances: useEffect for Static Buildings setup triggered.' );
        const instancedMesh = new InstancedMesh2(
            buildingGeometry,
            buildingMaterial,
            {
                capacity: STATIC_BUILDINGS_COUNT,
                createEntities: true,
            }
        );
        staticBuildingsInstancedMeshRef.current = instancedMesh;
        console.log( 'SceneInstances: Static Buildings InstancedMesh2 created:', instancedMesh );

        const tempPosition = new THREE.Vector3();
        instancedMesh.addInstances( STATIC_BUILDINGS_COUNT, ( object, i ) =>
        {
            const x = ( Math.random() - 0.5 ) * 700;
            const z = ( Math.random() - 0.5 ) * 700;
            const y = buildingGeometry.parameters.height / 2;

            if ( x > -7.5 && x < 7.5 && z > -400 && z < 400 )
            {
                const shiftX = x < 0 ? -10 : 10;
                tempPosition.set( x + shiftX, y, z );
            } else
            {
                tempPosition.set( x, y, z );
            }
            object.position.copy( tempPosition );

            // --- MODIFIED COLOR FOR BUILDINGS (brighter, less random for base color) ---
            // Ensuring brightness for visibility
            const r = 0.5 + Math.random() * 0.4; // Min 0.5, max 0.9
            const g = 0.5 + Math.random() * 0.4;
            const b = 0.5 + Math.random() * 0.4;
            instancedMesh.setColorAt( i, new THREE.Color( r, g, b ) );
            // --- END MODIFIED COLOR ---

            object.updateMatrix();
        } );
        console.log( 'SceneInstances: Static Buildings populated using addInstances.' );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;

        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );
        console.log( 'SceneInstances: Static Buildings BVH computed.' );

        return () =>
        {
            console.log( 'SceneInstances: Static Buildings cleanup triggered.' );
            if ( instancedMesh )
            {
                instancedMesh.dispose();
            }
        };
    }, [ buildingGeometry, buildingMaterial ] );


    // --- Setup for Dynamic Instances (Cars) ---
    useEffect( () =>
    {
        console.log( 'SceneInstances: useEffect for Dynamic Cars setup triggered.' );
        const instancedMesh = new InstancedMesh2(
            carGeometry,
            carMaterial,
            {
                capacity: DYNAMIC_CARS_COUNT,
                createEntities: true,
            }
        );
        dynamicCarsInstancedMeshRef.current = instancedMesh;
        console.log( 'SceneInstances: Dynamic Cars InstancedMesh2 created:', instancedMesh );

        const initialPositionsData = [];
        instancedMesh.addInstances( DYNAMIC_CARS_COUNT, ( object, i ) =>
        {
            const z = -200 + i * ( 800 / DYNAMIC_CARS_COUNT );
            const x = ( Math.random() > 0.5 ? 4 : -4 );
            object.position.set( x, carGeometry.parameters.height / 2 + 0.1, z );

            // --- MODIFIED COLOR FOR CARS (using HSL for vibrant, random colors) ---
            const hue = Math.random(); // 0 to 1 for hue
            const saturation = 0.8 + Math.random() * 0.2; // High saturation
            const lightness = 0.5 + Math.random() * 0.2; // Good lightness
            instancedMesh.setColorAt( i, new THREE.Color().setHSL( hue, saturation, lightness ) );
            // --- END MODIFIED COLOR ---

            initialPositionsData.push( new THREE.Vector3().copy( object.position ) );
            object.updateMatrix();
        } );
        instancedMesh.userData.initialPositions = initialPositionsData;
        console.log( 'SceneInstances: Dynamic Cars populated using addInstances.' );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;

        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );
        console.log( 'SceneInstances: Dynamic Cars BVH computed for initial state.' );

        return () =>
        {
            console.log( 'SceneInstances: Dynamic Cars cleanup triggered.' );
            if ( instancedMesh )
            {
                instancedMesh.dispose();
            }
        };
    }, [ carGeometry, carMaterial ] );

    // --- Animation for Dynamic Instances ---
    useFrame( ( { clock } ) =>
    {
        const instancedMesh = dynamicCarsInstancedMeshRef.current;
        if ( !instancedMesh ) return;

        const initialPositions = instancedMesh.userData.initialPositions;

        let needsBVHUpdate = false;
        for ( let i = 0; i < DYNAMIC_CARS_COUNT; i++ )
        {
            const object = instancedMesh.instances[ i ];
            const initialPos = initialPositions[ i ];
            const speed = 5 + ( i * 0.5 );
            const newZ = ( initialPos.z + clock.elapsedTime * speed ) % 400;
            const newPosition = new THREE.Vector3( initialPos.x, initialPos.y, newZ > 200 ? newZ - 800 : newZ );

            if ( !object.position.equals( newPosition ) )
            {
                object.position.copy( newPosition );
                object.updateMatrix();
                needsBVHUpdate = true;
            }
        }

        if ( needsBVHUpdate )
        {
            instancedMesh.instanceMatrix.needsUpdate = true;
            instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );
        }
    } );

    return (
        <>
            {staticBuildingsInstancedMeshRef.current && (
                <primitive object={staticBuildingsInstancedMeshRef.current} />
            )}
            {dynamicCarsInstancedMeshRef.current && (
                <primitive object={dynamicCarsInstancedMeshRef.current} />
            )}
        </>
    );
};

export default SceneInstances;

