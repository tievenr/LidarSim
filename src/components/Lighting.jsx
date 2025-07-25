import React from 'react';


const Lighting = React.memo( () => (
    <>
        {/* Soft ambient light for base illumination */}
        <ambientLight intensity={0.45} color={0xffffff} />

        {/* Sunlight directional with warm tint and soft shadows */}
        <directionalLight
            position={[ 60, 80, 40 ]}
            intensity={1.15}
            color={0xfff3e0}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0005}
            shadow-radius={6}
        />

        {/* Subtle fill light from the side for depth */}
        <directionalLight
            position={[ -40, 30, -60 ]}
            intensity={0.25}
            color={0xbfdfff}
        />
    </>
) );

export default Lighting;