/** Three.js overlay rendering engine — manages 3D layer on top of video feed */

import * as THREE from 'three';
import { OVERLAY } from '../config/constants.js';

let scene, camera, renderer;
const overlays = new Map();

/**
 * Initializes the Three.js scene with orthographic camera.
 * Orthographic projection prevents perspective distortion on flat UI overlays.
 */
export function initOverlayEngine() {
  const container = document.getElementById('three-container');

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
    0.1,
    1000
  );
  camera.position.z = OVERLAY.Z_DEPTH;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer };
}

/**
 * Creates or updates a bounding box overlay at screen coordinates.
 * Converts screen-space (origin top-left) to Three.js world-space (origin center).
 */
export function createBoundingBox(id, x, y, width, height, label = '', color = OVERLAY.DEFAULT_COLOR) {
  removeBoundingBox(id);

  const group = new THREE.Group();

  const geometry = new THREE.PlaneGeometry(width, height);

  // Border
  const edges = new THREE.EdgesGeometry(geometry);
  const border = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, linewidth: OVERLAY.BORDER_WIDTH })
  );
  group.add(border);

  // Semi-transparent fill
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: OVERLAY.FILL_OPACITY })
  );
  fill.position.z = -1;
  group.add(fill);

  // Screen-to-world coordinate mapping
  group.position.set(
    x - window.innerWidth / 2 + width / 2,
    -(y - window.innerHeight / 2 + height / 2),
    0
  );

  scene.add(group);
  overlays.set(id, group);
  return group;
}

/** Removes and disposes a bounding box by its ID */
export function removeBoundingBox(id) {
  if (!overlays.has(id)) return;

  const group = overlays.get(id);
  scene.remove(group);
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  overlays.delete(id);
}

/** Clears all active overlays */
export function clearOverlays() {
  for (const id of overlays.keys()) {
    removeBoundingBox(id);
  }
}

/** Renders the current frame */
export function render() {
  renderer.render(scene, camera);
}

/** Returns the current overlay count (useful for HUD stats) */
export function getOverlayCount() {
  return overlays.size;
}

function handleResize() {
  camera.left = -window.innerWidth / 2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = -window.innerHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
