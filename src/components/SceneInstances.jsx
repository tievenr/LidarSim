import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { InstancedMesh2 } from '@three.ez/instanced-mesh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

const STATIC_BUILDINGS_COUNT = 20;
const STATIC_TREES_COUNT = 30;
const STATIC_STREETLIGHTS_COUNT = 30;
const FIXED_CARS_COUNT = 30;
const DYNAMIC_CARS_COUNT = 3;
const ANIMATION_DISTANCE = 400;

const SceneInstances = () =>
{
    const { camera } = useThree();
    const [ buildingMesh, setBuildingMesh ] = useState( null );
    const [ carMesh, setCarMesh ] = useState( null );
    const [ treeMesh, setTreeMesh ] = useState( null );
    const [ streetlightMesh, setStreetlightMesh ] = useState( null );

    const {
        buildingGeometry,
        buildingMaterial,
        carGeometry,
        carMaterial,
        treeGeometry,
        treeMaterial,
        streetlightGeometry,
        streetlightMaterial
    } = useMemo( () =>
    {
        // Building assets
        const buildingGeo = new THREE.BoxGeometry( 10, 30, 10 );
        const buildingMat = new THREE.MeshStandardMaterial( {
            color: '#000000',
            roughness: 0.7,
            metalness: 0.1
        } );

        // Car assets
        const carGeo = new THREE.BoxGeometry( 1.8, 0.8, 4 );
        const carMat = new THREE.MeshStandardMaterial( {
            color: '#a39696',
            roughness: 0.5,
            metalness: 0.2
        } );

        // Tree assets
        const treeTrunkGeo = new THREE.CylinderGeometry( 0.5, 0.5, 5, 8 );
        const treeFoliageGeo = new THREE.ConeGeometry( 3, 8, 8 );
        const treeGeo = mergeGeometries( [ treeTrunkGeo, treeFoliageGeo.translate( 0, 6.5, 0 ) ] );
        treeGeo.computeBoundingBox();
        const treeMat = new THREE.MeshStandardMaterial( {
            color: '#3d5537',
            roughness: 0.8,
            metalness: 0.1
        } );

        // Streetlight assets
        const lightPoleGeo = new THREE.CylinderGeometry( 0.2, 0.2, 10, 8 );
        const lightFixtureGeo = new THREE.BoxGeometry( 1, 0.5, 1.5 );
        const streetlightGeo = mergeGeometries( [ lightPoleGeo, lightFixtureGeo.translate( 0, 5, 0 ) ] );
        streetlightGeo.computeBoundingBox();
        const streetlightMat = new THREE.MeshStandardMaterial( {
            color: '#444444',
            roughness: 0.7,
            metalness: 0.8
        } );

        return {
            buildingGeometry: buildingGeo,
            buildingMaterial: buildingMat,
            carGeometry: carGeo,
            carMaterial: carMat,
            treeGeometry: treeGeo,
            treeMaterial: treeMat,
            streetlightGeometry: streetlightGeo,
            streetlightMaterial: streetlightMat
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
                // The library automatically enables per-instance frustum culling
                // when a BVH is computed.
                // You can explicitly set it to true, but it's not strictly necessary.
                perObjectFrustumCulled: true
            }
        );

        instancedMesh.addInstances( STATIC_BUILDINGS_COUNT, ( object, i ) =>
        {
            const streetWidth = 40;
            const buildingSpacing = 50;
            const streetIndex = Math.floor( i / ( STATIC_BUILDINGS_COUNT / 2 ) );
            const x = streetIndex === 0 ? -streetWidth : streetWidth;
            const z = ( i % ( STATIC_BUILDINGS_COUNT / 2 ) ) * buildingSpacing - ( STATIC_BUILDINGS_COUNT / 2 ) * buildingSpacing / 2;
            const y = buildingGeometry.parameters.height / 2;

            object.position.set( x, y, z );
            object.updateMatrix();
        } );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;

        // This call computes the BVH, which is essential for fast frustum culling.
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setBuildingMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh ) instancedMesh.dispose();
        };
    }, [ buildingGeometry, buildingMaterial ] );

    // Create car instances
    useEffect( () =>
    {
        const totalCars = FIXED_CARS_COUNT + DYNAMIC_CARS_COUNT;
        const instancedMesh = new InstancedMesh2(
            carGeometry,
            carMaterial,
            {
                capacity: totalCars,
                createEntities: true,
                perObjectFrustumCulled: true
            }
        );

        const initialPositionsData = [];
        instancedMesh.addInstances( totalCars, ( object, i ) =>
        {
            if ( i < FIXED_CARS_COUNT )
            {
                const x = ( i % 2 === 0 ) ? -10 : 10;
                const z = -250 + i * 150;
                object.position.set( x, carGeometry.parameters.height / 2 + 0.1, z );
            } else
            {
                const z = -200 + ( i - FIXED_CARS_COUNT ) * ( 800 / DYNAMIC_CARS_COUNT );
                const x = ( Math.random() > 0.5 ? 4 : -4 );
                object.position.set( x, carGeometry.parameters.height / 2 + 0.1, z );
            }
            initialPositionsData.push( new THREE.Vector3().copy( object.position ) );
            object.updateMatrix();
        } );

        instancedMesh.userData.initialPositions = initialPositionsData;
        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;

        // Compute the initial BVH for the cars.
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setCarMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh ) instancedMesh.dispose();
        };
    }, [ carGeometry, carMaterial ] );

    // Create tree instances
    useEffect( () =>
    {
        const instancedMesh = new InstancedMesh2(
            treeGeometry,
            treeMaterial,
            {
                capacity: STATIC_TREES_COUNT,
                createEntities: true,
                perObjectFrustumCulled: true
            }
        );

        instancedMesh.addInstances( STATIC_TREES_COUNT, ( object, i ) =>
        {
            const streetWidth = 20;
            const treeSpacing = 20;
            const streetIndex = Math.floor( i / ( STATIC_TREES_COUNT / 2 ) );
            const x = streetIndex === 0 ? -streetWidth : streetWidth;
            const z = ( i % ( STATIC_TREES_COUNT / 2 ) ) * treeSpacing - ( STATIC_TREES_COUNT / 2 ) * treeSpacing / 2;
            const y = -treeGeometry.boundingBox.min.y;
            object.position.set( x, y, z );
            object.updateMatrix();
        } );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setTreeMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh ) instancedMesh.dispose();
        };
    }, [ treeGeometry, treeMaterial ] );

    // Create streetlight instances
    useEffect( () =>
    {
        const instancedMesh = new InstancedMesh2(
            streetlightGeometry,
            streetlightMaterial,
            {
                capacity: STATIC_STREETLIGHTS_COUNT,
                createEntities: true,
                perObjectFrustumCulled: true
            }
        );

        instancedMesh.addInstances( STATIC_STREETLIGHTS_COUNT, ( object, i ) =>
        {
            const streetWidth = 15;
            const lightSpacing = 40;
            const streetIndex = Math.floor( i / ( STATIC_STREETLIGHTS_COUNT / 2 ) );
            const x = streetIndex === 0 ? -streetWidth : streetWidth;
            const z = ( i % ( STATIC_STREETLIGHTS_COUNT / 2 ) ) * lightSpacing - ( STATIC_STREETLIGHTS_COUNT / 2 ) * lightSpacing / 2;
            const y = -streetlightGeometry.boundingBox.min.y;
            object.position.set( x, y, z );
            object.updateMatrix();
        } );

        instancedMesh.instanceMatrix.needsUpdate = true;
        if ( instancedMesh.instanceColor ) instancedMesh.instanceColor.needsUpdate = true;
        instancedMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );

        setStreetlightMesh( instancedMesh );

        return () =>
        {
            if ( instancedMesh ) instancedMesh.dispose();
        };
    }, [ streetlightGeometry, streetlightMaterial ] );

    // Optimized animation for cars with virtual position tracking
    useFrame( ( { clock } ) =>
    {
        if ( !carMesh ) return;

        const initialPositions = carMesh.userData.initialPositions;
        const cameraPosition = camera.position;
        let anyCarMoved = false;
        const tempPosition = new THREE.Vector3();

        for ( let i = FIXED_CARS_COUNT; i < FIXED_CARS_COUNT + DYNAMIC_CARS_COUNT; i++ )
        {
            const object = carMesh.instances[ i ];
            const initialPos = initialPositions[ i ];

            const speed = 5 + ( i * 0.5 );
            const newZ = ( initialPos.z + clock.elapsedTime * speed ) % 400;
            tempPosition.set( initialPos.x, initialPos.y, newZ > 200 ? newZ - 800 : newZ );

            const distanceToCamera = tempPosition.distanceTo( cameraPosition );

            if ( distanceToCamera < ANIMATION_DISTANCE )
            {
                if ( !object.position.equals( tempPosition ) )
                {
                    object.position.copy( tempPosition );
                    object.updateMatrixPosition();
                    anyCarMoved = true;
                }
            } else
            {
                if ( !object.position.equals( tempPosition ) )
                {
                    object.position.copy( tempPosition );
                }
            }
        }

        if ( anyCarMoved )
        {
            carMesh.instanceMatrix.needsUpdate = true;

            // Recompute the BVH for the cars. Note: This can be a performance hit if done every frame.
            // Consider optimizing this by only updating the BVH for instances that actually moved.
            // The library supports this with partial updates, but it's a more advanced topic.
            // For now, this is a correct way to ensure frustum culling works with moving objects.
            carMesh.computeBVH( { getBBoxFromBSphere: true, margin: 1 } );
        }
    } );

    return (
        <>
            {buildingMesh && <primitive object={buildingMesh} />}
            {carMesh && <primitive object={carMesh} />}
            {treeMesh && <primitive object={treeMesh} />}
            {streetlightMesh && <primitive object={streetlightMesh} />}
        </>
    );
};

export default SceneInstances;