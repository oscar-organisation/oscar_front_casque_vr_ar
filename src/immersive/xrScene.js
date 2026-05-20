/**
 * Immersive scene — activated on demand when the user presses "ENTER VR".
 *
 * Off (default): the <video id="video-feed"> element is shown full-screen
 * directly (original flat HTML experience, no 3D overhead).
 *
 * On (VR session active): the WebGL canvas renders the same <video> as a
 * VideoTexture on either:
 *   • a curved cinema screen in front of the viewer (flat feed), or
 *   • an inverted sphere wrapping the viewer (equirectangular 360° feed).
 *
 * Mode is chosen from the LiveKit publisher metadata.
 */

import * as THREE from 'three';
import { PROJECTION } from '../capture/streamProjection.js';

const CONTAINER_ID = 'xr-container';

let renderer = null;
let scene = null;
let camera = null;
let videoEl = null;
let videoTexture = null;
let container = null;

let displayMesh = null;
let currentMode = null;
let vrSupported = false;
let lastLiveKitState = null;

const listeners = new Set();

/* ═══════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════ */

/** Bootstraps the scene (but does NOT start a session — user opts in). */
export async function initXRScene(sourceVideoEl) {
  videoEl = sourceVideoEl;
  container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.error('[XR] #xr-container not found');
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  videoTexture = new THREE.VideoTexture(videoEl);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  // Default projection, will be refreshed on stream updates
  buildForMode(PROJECTION.FLAT);

  // Re-run detection whenever the <video> first reports its dimensions —
  // LiveKit's track dimensions property is often 0 during initial subscribe.
  videoEl.addEventListener('loadedmetadata', () => {
    console.info(`[XR] video loadedmetadata: ${videoEl.videoWidth}×${videoEl.videoHeight}`);
    if (lastLiveKitState) {
      const mode = detectModeFromState(lastLiveKitState);
      if (mode !== currentMode) buildForMode(mode);
    }
  });
  videoEl.addEventListener('resize', () => {
    if (lastLiveKitState) {
      const mode = detectModeFromState(lastLiveKitState);
      if (mode !== currentMode) buildForMode(mode);
    }
  });

  window.addEventListener('resize', onResize);

  renderer.xr.addEventListener('sessionstart', () => {
    container.classList.add('xr-active');
    document.body.classList.add('xr-active');
    notify({ presenting: true });
  });
  renderer.xr.addEventListener('sessionend', () => {
    container.classList.remove('xr-active');
    document.body.classList.remove('xr-active');
    notify({ presenting: false });
  });

  renderer.setAnimationLoop(() => {
    if (renderer.xr.isPresenting) renderer.render(scene, camera);
  });

  // Feature detection — some browsers lack navigator.xr entirely
  if (navigator.xr?.isSessionSupported) {
    try {
      vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    } catch (_) {
      vrSupported = false;
    }
  }
  notify({ supported: vrSupported, presenting: false });
}

/** React to LiveKit state changes — swaps mesh if projection mode changes. */
export function onStreamUpdate(liveKitState) {
  if (!scene) return;
  lastLiveKitState = liveKitState;
  const mode = detectModeFromState(liveKitState);
  if (mode !== currentMode) buildForMode(mode);
}

/** Called by the HUD button. */
export async function enterVR() {
  if (!vrSupported) {
    alert('Votre navigateur ne supporte pas WebXR. Ouvrez ce site sur un casque compatible (Meta Quest, Pico).');
    return;
  }
  if (renderer.xr.isPresenting) return;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor'],
    });
    await renderer.xr.setSession(session);
  } catch (err) {
    console.error('[XR] enterVR failed:', err);
    alert("Impossible d'activer la VR : " + (err?.message || err));
  }
}

/** Subscribe to XR availability / presenting changes. */
export function onXRStateChange(cb) {
  listeners.add(cb);
  cb({ supported: vrSupported, presenting: !!renderer?.xr?.isPresenting });
  return () => listeners.delete(cb);
}

export function getProjectionMode() {
  return currentMode;
}

/* ═══════════════════════════════════════════════════════════════
   Internals
   ═══════════════════════════════════════════════════════════════ */

function notify(partial) {
  const snap = {
    supported: vrSupported,
    presenting: !!renderer?.xr?.isPresenting,
    ...partial,
  };
  for (const cb of listeners) cb(snap);
}

function detectModeFromState(liveKitState) {
  // Priority 1 — explicit publisher metadata
  const { activePublisherMetadata, activeTrackName } = liveKitState;
  if (activePublisherMetadata) {
    try {
      const parsed = JSON.parse(activePublisherMetadata);
      if (parsed?.projection === PROJECTION.EQUIRECT) {
        console.info('[XR] projection=equirect from metadata');
        return PROJECTION.EQUIRECT;
      }
      if (parsed?.projection === PROJECTION.FLAT) {
        console.info('[XR] projection=flat from metadata');
        return PROJECTION.FLAT;
      }
    } catch (e) {
      console.warn('[XR] metadata JSON parse failed:', activePublisherMetadata);
    }
  }

  // Priority 2 — track name hint
  if (activeTrackName && /360|equirect|pano/i.test(activeTrackName)) {
    console.info('[XR] projection=equirect from track name');
    return PROJECTION.EQUIRECT;
  }

  // Priority 3 — aspect ratio heuristic. Prefer the live <video> dimensions
  // since LiveKit's publication dims can be stale or 0 at first notify.
  let width  = liveKitState.videoWidth  || videoEl?.videoWidth  || 0;
  let height = liveKitState.videoHeight || videoEl?.videoHeight || 0;
  if (width && height) {
    const ratio = width / height;
    console.info(`[XR] ratio detection: ${width}×${height} = ${ratio.toFixed(3)}`);
    if (ratio >= 1.85 && ratio <= 2.15) return PROJECTION.EQUIRECT;
  }

  console.info('[XR] falling back to flat (no metadata, no matching ratio)');
  return PROJECTION.FLAT;
}

function buildForMode(mode) {
  removeCurrentMesh();
  currentMode = mode;
  displayMesh = mode === PROJECTION.EQUIRECT ? buildSphere() : buildCinemaScreen();
  scene.add(displayMesh);
  console.info(`[XR] projection → ${mode}`);
}

function removeCurrentMesh() {
  if (!displayMesh) return;
  scene.remove(displayMesh);
  displayMesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  displayMesh = null;
}

function buildSphere() {
  const geometry = new THREE.SphereGeometry(50, 64, 40);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 1.6, 0);
  return mesh;
}

function buildCinemaScreen() {
  const group = new THREE.Group();

  const SCREEN_WIDTH = 5.0;
  const SCREEN_HEIGHT = SCREEN_WIDTH * (9 / 16);
  const DISTANCE = 3.2;
  const CURVE_SEGMENTS = 48;
  const CURVE_RADIUS = 4.5;
  const ARC = SCREEN_WIDTH / CURVE_RADIUS;

  const geometry = new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT, CURVE_SEGMENTS, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const angle = (x / SCREEN_WIDTH) * ARC;
    positions.setX(i, Math.sin(angle) * CURVE_RADIUS);
    positions.setZ(i, -CURVE_RADIUS * Math.cos(angle) + CURVE_RADIUS);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const screen = new THREE.Mesh(geometry, material);
  screen.position.set(0, 1.6, -DISTANCE);
  group.add(screen);

  const backdropGeo = new THREE.PlaneGeometry(SCREEN_WIDTH * 3, SCREEN_HEIGHT * 3);
  const backdropMat = new THREE.MeshBasicMaterial({
    color: 0x0a1218,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
  backdrop.position.set(0, 1.6, -DISTANCE - 0.8);
  group.add(backdrop);

  return group;
}

function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
