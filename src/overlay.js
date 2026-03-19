// Three.js overlay system
// Renders a transparent 3D layer on top of the video feed
// Used for bounding boxes, info cards, and status indicators

import * as THREE from 'three';

let scene, camera, renderer;
const overlays = new Map();

export function initOverlaySystem() {
  const container = document.getElementById('three-container');

  scene = new THREE.Scene();

  // Orthographic camera — no perspective distortion, ideal for flat UI overlays
  camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
    0.1,
    1000
  );
  camera.position.z = 500;

  // alpha: true keeps the background transparent so video shows through
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onResize);

  return { scene, camera, renderer };
}

// Creates a bounding box at given screen coordinates
export function createBoundingBox(id, x, y, width, height, label = '', color = 0x00ff88) {
  removeBoundingBox(id);

  const group = new THREE.Group();

  // Border lines
  const boxGeometry = new THREE.PlaneGeometry(width, height);
  const edges = new THREE.EdgesGeometry(boxGeometry);
  const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
  group.add(border);

  // Semi-transparent fill
  const fill = new THREE.Mesh(boxGeometry, new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08
  }));
  fill.position.z = -1;
  group.add(fill);

  // Screen coords (origin top-left) to Three.js coords (origin center)
  group.position.set(
    x - window.innerWidth / 2 + width / 2,
    -(y - window.innerHeight / 2 + height / 2),
    0
  );

  scene.add(group);
  overlays.set(id, group);
  return group;
}

export function removeBoundingBox(id) {
  if (overlays.has(id)) {
    const group = overlays.get(id);
    scene.remove(group);
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    overlays.delete(id);
  }
}

export function renderOverlays() {
  renderer.render(scene, camera);
}

function onResize() {
  camera.left = -window.innerWidth / 2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = -window.innerHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
