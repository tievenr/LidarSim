// src/components/SceneInstances.jsx
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InstancedMesh2 } from '@three.ez/instanced-mesh';

const STATIC_BUILDINGS_COUNT = 100;
const DYNAMIC_CARS_COUNT = 5;

const SceneInstances = () =>
{
    const [ buildingMesh, setBuildingMesh ] = useState( null );
    const [ carMesh, setCarMesh ] = useState( null );

    const { buildingGeometry, buildingMaterial, carGeometry, carMaterial } = useMemo( () =>
    {
        const buildingGeo = new THREE.BoxGeometry( 10, 30, 10 );
        const buildingMat = new THREE.MeshStandardMaterial( {
            color: '#777777',
            roughness: 0.7,
            metalness: 0.1
        } );

        const carGeo = new THREE.BoxGeometry( 1.8, 0.8, 4 );
        const carMat = new THREE.MeshStandardMaterial( {
            color: '#FF0000',
            roughness: 0.5,
            metalness: 0.2
        } );

        return {
            buildingGeometry: buildingGeo,
            buildingMaterial: buildingMat,
            carGeometry: carGeo,
            carMaterial: carMat
        };
    }, [] );

    // Create building instances
    useEffect( () =>
    {
        const instancedMesh = new InstancedMesh2(
            buildingGeometry,
            buildingMaterial,
            {
                capacity: STATIC_BUILDINGS_COUNT,
                createEntities: true,
            }
        );

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
            instancedMesh.setColorAt( i, new THREE.Color( 0x00ff00 ) );
            object.updateMatrix();
        } );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setBuildingMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh )
            {
                instancedMesh.dispose();
            }
        };
    }, [ buildingGeometry, buildingMaterial ] );

    // Create car instances
    useEffect( () =>
    {
        const instancedMesh = new InstancedMesh2(
            carGeometry,
            carMaterial,
            {
                capacity: DYNAMIC_CARS_COUNT,
                createEntities: true,
            }
        );

        const initialPositionsData = [];
        instancedMesh.addInstances( DYNAMIC_CARS_COUNT, ( object, i ) =>
        {
            const z = -200 + i * ( 800 / DYNAMIC_CARS_COUNT );
            const x = ( Math.random() > 0.5 ? 4 : -4 );
            object.position.set( x, carGeometry.parameters.height / 2 + 0.1, z );
            instancedMesh.setColorAt( i, new THREE.Color( 0xff0000 ) );
            initialPositionsData.push( new THREE.Vector3().copy( object.position ) );
            object.updateMatrix();
        } );

        instancedMesh.userData.initialPositions = initialPositionsData;
        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setCarMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh )
            {
                instancedMesh.dispose();
            }
        };
    }, [ carGeometry, carMaterial ] );

    // Animation for cars
    useFrame( ( { clock } ) =>
    {
        if ( !carMesh ) return;

        const initialPositions = carMesh.userData.initialPositions;
        let needsBVHUpdate = false;

        for ( let i = 0; i < DYNAMIC_CARS_COUNT; i++ )
        {
            const object = carMesh.instances[ i ];
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
            carMesh.instanceMatrix.needsUpdate = true;
            carMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );
        }
    } );

    return (
        <>
            {buildingMesh && <primitive object={buildingMesh} />}
            {carMesh && <primitive object={carMesh} />}
        </>
    );
};

export default SceneInstances;