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

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Handle GPU context loss gracefully
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[Overlay] WebGL context lost — pausing render');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    console.info('[Overlay] WebGL context restored');
  });

  window.addEventListener('resize', handleResize);

  return { scene, camera, renderer };
}

/** Returns the Three.js renderer (needed for XR session binding) */
export function getRenderer() {
  return renderer;
}

/**
 * Creates or updates a bounding box overlay at screen coordinates.
 * Converts screen-space (origin top-left) to Three.js world-space (origin center).
 */
export function createBoundingBox(id, x, y, width, height, label = '', color = OVERLAY.DEFAULT_COLOR) {
  removeBoundingBox(id);

  const group = new THREE.Group();

  const geometry = new THREE.PlaneGeometry(width, height);

  const halfW = width / 2;
  const halfH = height / 2;

  // Un trait = un quadrilatere. LineBasicMaterial plafonne a 1 px sur presque
  // tous les navigateurs, ce qui rendait les boites illisibles sur sol clair.
  const trait = (w, h, x, y, opacity) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(1, w), Math.max(1, h)),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    );
    mesh.position.set(x, y, 0.5);
    group.add(mesh);
  };

  // Contour complet : on voit toute l'emprise de l'objet, pas seulement ses angles.
  const t = OVERLAY.BORDER_WIDTH;
  trait(width, t, 0, halfH - t / 2, OVERLAY.BORDER_OPACITY);
  trait(width, t, 0, -halfH + t / 2, OVERLAY.BORDER_OPACITY);
  trait(t, height, -halfW + t / 2, 0, OVERLAY.BORDER_OPACITY);
  trait(t, height, halfW - t / 2, 0, OVERLAY.BORDER_OPACITY);

  // Accents d'angle plus epais : ils accrochent l'oeil meme sur une petite boite.
  const tc = OVERLAY.CORNER_WIDTH;
  const lx = Math.min(34, Math.max(12, width * 0.22));
  const ly = Math.min(34, Math.max(12, height * 0.22));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      trait(lx, tc, sx * (halfW - lx / 2), sy * (halfH - tc / 2), 1);
      trait(tc, ly, sx * (halfW - tc / 2), sy * (halfH - ly / 2), 1);
    }
  }

  // Remplissage
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
  if (!renderer || renderer.getContext().isContextLost()) return;
  renderer.render(scene, camera);
}

/**
 * Starts the XR render loop.
 * Uses renderer.setAnimationLoop which is required for WebXR.
 * @param {Function} onFrame - callback called each XR frame
 */
export function startXRRenderLoop(onFrame) {
  renderer.setAnimationLoop((timestamp, xrFrame) => {
    if (onFrame) onFrame(timestamp, xrFrame);
    renderer.render(scene, camera);
  });
}

/** Stops the XR render loop */
export function stopXRRenderLoop() {
  renderer.setAnimationLoop(null);
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
