import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// BVH acceleration setup
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';

// Patch Three.js for BVH acceleration
THREE.BufferGeometry.prototype.computeBoundsTree = function ()
{
  this.boundsTree = new MeshBVH( this );
};
THREE.Mesh.prototype.raycast = acceleratedRaycast;

createRoot( document.getElementById( 'root' ) ).render(
  <StrictMode>
    <App />
  </StrictMode>,
)