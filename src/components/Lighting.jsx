import React from 'react';

const Lighting = React.memo( () => (
    <>
        <ambientLight intensity={0.6} />
        <directionalLight position={[ 50, 50, 25 ]} intensity={1} castShadow />
    </>
) );

export default Lighting;