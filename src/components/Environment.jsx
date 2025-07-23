import React from 'react';
import StaticInstances from './StaticInstances';
import DynamicInstances from './DynamicInstances';
import Lighting from './Lighting';

const Environment = React.memo( () => (
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

        {/* Static and dynamic instances */}
        <StaticInstances />
        <DynamicInstances />

        {/* Lighting */}
        <Lighting />
    </>
) );

export default Environment;