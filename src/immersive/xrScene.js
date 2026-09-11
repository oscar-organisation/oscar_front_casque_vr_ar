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
import {
  detectProjectionDetails,
  PROJECTION,
  LAYOUT,
  shouldForceEquirect,
  shouldRequireEquirectInVR,
} from '../capture/streamProjection.js';

const EYE_LAYER_LEFT = 1;
const EYE_LAYER_RIGHT = 2;
import { onXRInputPacket, publishXRInputFrame } from '../teleoperation/xrInputPublisher.js';
import { setStatus } from '../hud/statusManager.js';
import { FEATURES } from '../config/constants.js';

const CONTAINER_ID = 'xr-container';
const VIEWER_HEIGHT = 1.6;
const VIDEO_SPHERE_RADIUS = 50;
const XR_HUD_RADIUS = VIDEO_SPHERE_RADIUS - 0.85;
const XR_HUD_PANEL_WIDTH = 7.2;
const XR_HUD_PANEL_HEIGHT = 3.6;
const XR_INPUT_PANEL_WIDTH = 1.7;
const XR_INPUT_PANEL_HEIGHT = 1.06;

let renderer = null;
let scene = null;
let camera = null;
let videoEl = null;
let videoTexture = null;
let container = null;

let displayMesh = null;
let detectionGroup = null;
const detectionMeshes = new Map();
let xrInputPanel = null;
let xrInputPanelCanvas = null;
let xrInputPanelCtx = null;
let xrInputPanelTexture = null;
let lastXRInputPanelDraw = 0;
let currentMode = null;
let currentLayout = LAYOUT.MONO;
let currentProjection = null;
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
  camera.position.set(0, VIEWER_HEIGHT, 0);
  scene.add(camera);
  if (FEATURES.DIAGNOSTIC_OVERLAYS) {
    initXRInputDebugPanel();
    onXRInputPacket(updateXRInputDebugPanel);
  }

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  videoTexture = new THREE.VideoTexture(videoEl);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  // Default projection, will be refreshed on stream updates.
  // During headset tests, ?force360=1 starts directly inside the sphere.
  buildForMode(shouldForceEquirect() ? PROJECTION.EQUIRECT : PROJECTION.FLAT);

  // Re-run detection whenever the <video> first reports its dimensions —
  // LiveKit's track dimensions property is often 0 during initial subscribe.
  videoEl.addEventListener('loadedmetadata', () => {
    console.info(`[XR] video loadedmetadata: ${videoEl.videoWidth}×${videoEl.videoHeight}`);
    if (lastLiveKitState) {
      const detected = detectModeFromState(lastLiveKitState);
      currentLayout = detected.layout;
      buildForMode(detected.mode);
    }
  });
  videoEl.addEventListener('resize', () => {
    if (lastLiveKitState) {
      const detected = detectModeFromState(lastLiveKitState);
      currentLayout = detected.layout;
      buildForMode(detected.mode);
    }
  });

  window.addEventListener('resize', onResize);

  renderer.xr.addEventListener('sessionstart', () => {
    container.classList.add('xr-active');
    document.body.classList.add('xr-active');
    enablePerEyeLayers();
    // Rebuild because stereo uses a dedicated per-eye geometry in WebXR.
    // The publisher metadata remains authoritative: a mono flat camera must
    // stay on a cinema screen instead of being stretched over a 360° sphere.
    buildForMode(currentMode);
    showXRDetections(true);
    showXRInputDebugPanel(FEATURES.DIAGNOSTIC_OVERLAYS);
    notify({ presenting: true });
  });
  renderer.xr.addEventListener('sessionend', () => {
    container.classList.remove('xr-active');
    document.body.classList.remove('xr-active');
    showXRDetections(false);
    showXRInputDebugPanel(false);
    notify({ presenting: false });
  });

  renderer.setAnimationLoop((timestamp, frame) => {
    if (!renderer.xr.isPresenting) return;

    const referenceSpace = renderer.xr.getReferenceSpace();
    if (frame && referenceSpace) {
      publishXRInputFrame(timestamp, frame, referenceSpace);
    }

    renderer.render(scene, camera);
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

/** React to LiveKit state changes — swaps mesh if projection or layout changes. */
export function onStreamUpdate(liveKitState) {
  if (!scene) return;
  lastLiveKitState = liveKitState;
  const detected = detectModeFromState(liveKitState);
  const mode = detected.mode;
  if (mode !== currentMode || detected.layout !== currentLayout) {
    currentLayout = detected.layout;
    buildForMode(mode);
  }
}

/** Called by the HUD button. */
export async function enterVR() {
  if (!vrSupported) {
    alert('Votre navigateur ne supporte pas WebXR. Ouvrez ce site sur un casque compatible (Meta Quest, Pico).');
    return;
  }
  if (renderer.xr.isPresenting) return;
  // Stereo flat is an acceptable immersive mode — only block when the user
  // explicitly opts into the strict 360 contract AND the feed is mono flat.
  if (shouldRequireEquirectInVR() && currentMode !== PROJECTION.EQUIRECT && currentLayout === LAYOUT.MONO) {
    setStatus('ERROR_NON_IMMERSIVE');
    const reason = currentProjection?.reason || 'flux non déclaré comme 360';
    alert(`Flux non immersif : vidéo 360 requise.\n\nRaison : ${reason}`);
    return;
  }
  try {
    buildForMode(currentMode);
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

export function getProjectionInfo() {
  return currentProjection ? { ...currentProjection } : null;
}

export function renderXRDetections(detections) {
  const group = getOrCreateDetectionGroup();
  clearXRDetections();

  detections.forEach((detection) => {
    const mesh = createDetectionPanel(detection);
    const anchor = screenDetectionToSphereAnchor(detection);
    mesh.position.copy(anchor);
    mesh.lookAt(0, VIEWER_HEIGHT, 0);
    mesh.rotateY(Math.PI);
    group.add(mesh);
    detectionMeshes.set(detection.id, mesh);
  });
}

export function clearXRDetections() {
  for (const mesh of detectionMeshes.values()) {
    detectionGroup?.remove(mesh);
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material?.map) child.material.map.dispose();
      if (child.material) child.material.dispose();
    });
  }
  detectionMeshes.clear();
}

/* ═══════════════════════════════════════════════════════════════
   Internals
   ═══════════════════════════════════════════════════════════════ */

function notify(partial) {
  const snap = {
    supported: vrSupported,
    presenting: !!renderer?.xr?.isPresenting,
    projection: currentProjection,
    ...partial,
  };
  for (const cb of listeners) cb(snap);
}

function detectModeFromState(liveKitState) {
  const projection = detectProjectionDetails({
    metadata: liveKitState.activePublisherMetadata,
    trackName: liveKitState.activeTrackName,
    width: liveKitState.videoWidth || videoEl?.videoWidth || 0,
    height: liveKitState.videoHeight || videoEl?.videoHeight || 0,
  });

  console.info(
    `[XR] projection detected → ${projection.mode} / ${projection.layout} (${projection.source}: ${projection.reason})`
  );
  currentProjection = projection;
  notify({ projection });
  return projection;
}

function buildForMode(mode) {
  removeCurrentMesh();
  currentMode = mode;
  if (!currentProjection || currentProjection.mode !== mode) {
    currentProjection = {
      mode,
      layout: currentLayout,
      source: shouldForceEquirect() ? 'forced' : 'initial',
      reason: shouldForceEquirect() ? 'forced by test override' : 'initial render mode before stream metadata',
      confidence: shouldForceEquirect() ? 'explicit' : 'fallback',
    };
  }

  // Stereo content in immersive mode: render a WORLD-LOCKED forward window.
  // The robot has 2 fixed forward cameras — there is no 360 data to wrap on a
  // sphere, and gluing the image to the head (head-lock) drags the whole world
  // when you move. Instead we anchor the stereo image in space in front of the
  // viewer: turning/lifting the head lets you look around it, the image stays
  // put. This is the honest model for "looking through the robot's eyes".
  const isStereo = currentLayout === LAYOUT.STEREO_LEFT_RIGHT
                || currentLayout === LAYOUT.STEREO_TOP_BOTTOM;
  if (isStereo && renderer?.xr?.isPresenting) {
    // Fisheye (VR180-style) → per-eye spherical cap: head rotation samples the
    // wide captured field. Pinhole → angular-exact flat window.
    displayMesh = mode === PROJECTION.FISHEYE
      ? buildStereoFisheyeDome(currentLayout, currentProjection?.fovDeg || 160)
      : buildStereoWorldWindow(currentLayout);
    displayMesh.userData.projection = mode;
    displayMesh.userData.layout = currentLayout;
    scene.add(displayMesh);   // world-locked, NOT parented to the camera
    console.info(`[XR] projection → stereo ${mode === PROJECTION.FISHEYE ? 'fisheye dome' : 'world-locked window'} (${currentLayout})`);
    notify({ projection: currentProjection });
    return;
  }

  displayMesh = mode === PROJECTION.EQUIRECT
    ? (currentLayout === LAYOUT.MONO ? buildSphere() : buildStereoSphere(currentLayout))
    : (currentLayout === LAYOUT.MONO ? buildCinemaScreen() : buildStereoCinemaScreen(currentLayout));
  displayMesh.userData.projection = mode;
  displayMesh.userData.layout = currentLayout;
  scene.add(displayMesh);
  console.info(`[XR] projection → ${mode} / ${currentLayout}`);
  notify({ projection: currentProjection });
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

/**
 * Stereo world-locked window — two co-located curved surfaces fixed in the
 * virtual world in front of the viewer, each visible to one eye via WebXR
 * layers. Head movement looks AROUND the window (it stays anchored), instead
 * of dragging the image. This is the right model for fixed robot cameras:
 * a forward "porthole" anchored in space, not a 360 sphere (no data for the
 * sides) and not head-locked goggles (drags the world).
 */
function buildStereoWorldWindow(layout) {
  const group = new THREE.Group();
  group.add(buildWorldWindowEye(layout, /*isLeft*/ true,  EYE_LAYER_LEFT));
  group.add(buildWorldWindowEye(layout, /*isLeft*/ false, EYE_LAYER_RIGHT));
  return group;
}

/**
 * Stereo fisheye dome (VR180 pattern) — one spherical cap per eye, both
 * co-located and world-locked. The equidistant fisheye model maps an image
 * point at normalized radius r (0..1) to a ray at angle θ = r·θmax from the
 * camera axis; we invert that per vertex: a dome vertex at angle θ, azimuth φ
 * samples the texture at (0.5 + 0.5·(θ/θmax)·cosφ, 0.5 + 0.5·(θ/θmax)·sinφ)
 * inside its eye's half of the packed frame. Head rotation then reveals
 * already-captured content — the NimbRo/VR180 telepresence design.
 */
function buildStereoFisheyeDome(layout, fovDeg) {
  const group = new THREE.Group();
  group.add(buildFisheyeDomeEye(layout, /*isLeft*/ true,  EYE_LAYER_LEFT,  fovDeg));
  group.add(buildFisheyeDomeEye(layout, /*isLeft*/ false, EYE_LAYER_RIGHT, fovDeg));
  group.position.set(0, VIEWER_HEIGHT, 0);
  return group;
}

function buildFisheyeDomeEye(layout, isLeft, layer, fovDeg) {
  const RADIUS = 20;
  const thetaMax = THREE.MathUtils.degToRad(fovDeg / 2);
  const SEG_T = 48;   // rings from centre to rim
  const SEG_P = 96;   // segments around

  const positions = [];
  const uvs = [];
  const indices = [];
  const isLR = layout === LAYOUT.STEREO_LEFT_RIGHT;

  for (let it = 0; it <= SEG_T; it++) {
    const theta = (thetaMax * it) / SEG_T;
    const rn = it / SEG_T; // normalized image radius (equidistant: rn = θ/θmax)
    for (let ip = 0; ip <= SEG_P; ip++) {
      const phi = (2 * Math.PI * ip) / SEG_P;
      // Forward is -Z; x right, y up.
      const st = Math.sin(theta);
      positions.push(
        RADIUS * st * Math.cos(phi),
        RADIUS * st * Math.sin(phi),
        -RADIUS * Math.cos(theta)
      );
      let u = 0.5 + 0.5 * rn * Math.cos(phi);
      let v = 0.5 + 0.5 * rn * Math.sin(phi);
      if (isLR) {
        u = (isLeft ? 0.0 : 0.5) + u * 0.5;
      } else {
        v = (isLeft ? 0.5 : 0.0) + v * 0.5;
      }
      uvs.push(u, v);
    }
  }
  const row = SEG_P + 1;
  for (let it = 0; it < SEG_T; it++) {
    for (let ip = 0; ip < SEG_P; ip++) {
      const a = it * row + ip;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.layers.set(layer);
  return mesh;
}

/**
 * Robot camera intrinsics — must match the publisher rig (focal 2.0 mm,
 * aperture 5.71 mm, 1280×720 per eye). The publisher may override via
 * metadata.frame.hfovDeg / vfovDeg without redeploying the front.
 */
const CAPTURE_FALLBACK = { hfovDeg: 110, vfovDeg: 77.6 };

function captureFovDeg() {
  try {
    const meta = lastLiveKitState?.activePublisherMetadata;
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    const frame = parsed?.frame;
    if (frame?.hfovDeg && frame?.vfovDeg) {
      return { hfovDeg: frame.hfovDeg, vfovDeg: frame.vfovDeg };
    }
  } catch (_) { /* fall through */ }
  return CAPTURE_FALLBACK;
}

function buildWorldWindowEye(layout, isLeft, layer) {
  // Angular-exact pinhole reprojection: a pinhole image maps geometrically
  // onto a FLAT plane subtending exactly the capture frustum from the eye.
  // Every pixel is then seen at the same angle it was captured — correct
  // scale, straight lines stay straight, true robot-POV feel. (A curved
  // screen bends straight lines and breaks the angular match; see NimbRo
  // ANA Avatar XPRIZE telepresence papers for the same design rule.)
  const DISTANCE = 1.5;
  const { hfovDeg, vfovDeg } = captureFovDeg();
  const WIDTH = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(hfovDeg / 2));
  const HEIGHT = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(vfovDeg / 2));

  const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);

  // Split the packed frame: left eye samples one half, right eye the other.
  const uvs = geometry.attributes.uv;
  const isLR = layout === LAYOUT.STEREO_LEFT_RIGHT;
  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);
    if (isLR) {
      uvs.setX(i, (isLeft ? 0.0 : 0.5) + u * 0.5);
    } else {
      uvs.setY(i, (isLeft ? 0.5 : 0.0) + v * 0.5);
    }
  }
  uvs.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, VIEWER_HEIGHT, -DISTANCE);
  mesh.layers.set(layer);
  return mesh;
}

function buildSphere() {
  const geometry = new THREE.SphereGeometry(VIDEO_SPHERE_RADIUS, 64, 40);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, VIEWER_HEIGHT, 0);
  mesh.rotation.y = Math.PI;
  return mesh;
}

/**
 * Stereo cinema screen — two curved planes co-located in space, one visible
 * to the left eye, the other to the right. Each plane has its own UV
 * mapping so it samples a different half of the side-by-side video frame.
 * Single VideoTexture, single decode — the magic happens via WebXR layers.
 */
function buildStereoCinemaScreen(layout) {
  const group = new THREE.Group();
  group.add(buildCurvedEye(layout, /*isLeft*/ true,  EYE_LAYER_LEFT));
  group.add(buildCurvedEye(layout, /*isLeft*/ false, EYE_LAYER_RIGHT));
  // Backdrop visible to both eyes (no layer override).
  group.add(buildCinemaBackdrop());
  return group;
}

function buildCurvedEye(layout, isLeft, layer) {
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

  // Remap UVs so each eye samples the correct half of the packed frame.
  const uvs = geometry.attributes.uv;
  const isLR = layout === LAYOUT.STEREO_LEFT_RIGHT;
  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);
    if (isLR) {
      uvs.setX(i, (isLeft ? 0.0 : 0.5) + u * 0.5);
    } else {
      // STEREO_TOP_BOTTOM — left eye = top half, right eye = bottom half.
      uvs.setY(i, (isLeft ? 0.5 : 0.0) + v * 0.5);
    }
  }
  uvs.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(geometry, material);
  screen.position.set(0, 1.6, -DISTANCE);
  screen.layers.set(layer);
  return screen;
}

function buildCinemaBackdrop() {
  const SCREEN_WIDTH = 5.0;
  const SCREEN_HEIGHT = SCREEN_WIDTH * (9 / 16);
  const DISTANCE = 3.2;
  const backdropGeo = new THREE.PlaneGeometry(SCREEN_WIDTH * 3, SCREEN_HEIGHT * 3);
  const backdropMat = new THREE.MeshBasicMaterial({
    color: 0x0a1218,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
  backdrop.position.set(0, 1.6, -DISTANCE - 0.8);
  return backdrop;
}

/**
 * Stereo equirect sphere — two co-located inverted spheres, each sampling
 * its half of the packed equirect frame.
 */
function buildStereoSphere(layout) {
  const group = new THREE.Group();
  group.add(buildSphereEye(layout, /*isLeft*/ true,  EYE_LAYER_LEFT));
  group.add(buildSphereEye(layout, /*isLeft*/ false, EYE_LAYER_RIGHT));
  group.position.set(0, VIEWER_HEIGHT, 0);
  group.rotation.y = Math.PI;
  return group;
}

function buildSphereEye(layout, isLeft, layer) {
  const geometry = new THREE.SphereGeometry(VIDEO_SPHERE_RADIUS, 64, 40);
  geometry.scale(-1, 1, 1);
  const uvs = geometry.attributes.uv;
  const isLR = layout === LAYOUT.STEREO_LEFT_RIGHT;
  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);
    if (isLR) {
      uvs.setX(i, (isLeft ? 0.0 : 0.5) + u * 0.5);
    } else {
      uvs.setY(i, (isLeft ? 0.5 : 0.0) + v * 0.5);
    }
  }
  uvs.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.layers.set(layer);
  return mesh;
}

/**
 * In immersive mode, Three.js exposes a per-eye ArrayCamera. Enabling layers
 * 1 (left) and 2 (right) on the right sub-cameras is what makes stereo work
 * via the layer-per-mesh trick used in buildStereoCinemaScreen.
 */
function enablePerEyeLayers() {
  const xrCamera = renderer.xr.getCamera?.();
  if (!xrCamera?.cameras?.length) return;
  // Enable mono content (layer 0) on both eyes — keeps HUD panels visible.
  xrCamera.layers.enable(EYE_LAYER_LEFT);
  xrCamera.layers.enable(EYE_LAYER_RIGHT);
  if (xrCamera.cameras[0]) xrCamera.cameras[0].layers.enable(EYE_LAYER_LEFT);
  if (xrCamera.cameras[1]) xrCamera.cameras[1].layers.enable(EYE_LAYER_RIGHT);
}

function buildCinemaScreen() {
  const group = new THREE.Group();

  const SCREEN_WIDTH = 5.0;
  const videoAspect = videoEl?.videoWidth && videoEl?.videoHeight
    ? videoEl.videoWidth / videoEl.videoHeight
    : 16 / 9;
  const SCREEN_HEIGHT = SCREEN_WIDTH / Math.max(1, Math.min(2.4, videoAspect));
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

function showXRDetections(visible) {
  if (detectionGroup) detectionGroup.visible = visible;
}

function getOrCreateDetectionGroup() {
  if (detectionGroup) return detectionGroup;
  detectionGroup = new THREE.Group();
  detectionGroup.visible = false;
  scene.add(detectionGroup);
  return detectionGroup;
}

function initXRInputDebugPanel() {
  xrInputPanelCanvas = document.createElement('canvas');
  xrInputPanelCanvas.width = 1024;
  xrInputPanelCanvas.height = 640;
  xrInputPanelCtx = xrInputPanelCanvas.getContext('2d');

  xrInputPanelTexture = new THREE.CanvasTexture(xrInputPanelCanvas);
  xrInputPanelTexture.colorSpace = THREE.SRGBColorSpace;
  xrInputPanelTexture.minFilter = THREE.LinearFilter;
  xrInputPanelTexture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: xrInputPanelTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  xrInputPanel = new THREE.Mesh(new THREE.PlaneGeometry(XR_INPUT_PANEL_WIDTH, XR_INPUT_PANEL_HEIGHT), material);
  xrInputPanel.position.set(0.25, -0.18, -2.65);
  xrInputPanel.rotation.set(THREE.MathUtils.degToRad(-3), THREE.MathUtils.degToRad(-8), 0);
  xrInputPanel.renderOrder = 2500;
  xrInputPanel.visible = false;
  camera.add(xrInputPanel);

  drawXRInputDebugPanel(null);
}

function showXRInputDebugPanel(visible) {
  if (xrInputPanel) xrInputPanel.visible = visible;
}

function updateXRInputDebugPanel(snapshot) {
  const now = performance.now();
  if (now - lastXRInputPanelDraw < 110) return;
  lastXRInputPanelDraw = now;
  drawXRInputDebugPanel(snapshot);
}

function drawXRInputDebugPanel(snapshot) {
  if (!xrInputPanelCtx || !xrInputPanelTexture) return;
  const ctx = xrInputPanelCtx;
  const w = xrInputPanelCanvas.width;
  const h = xrInputPanelCanvas.height;
  const summary = snapshot?.summary;
  const left = summary ? findXRController(summary.controllers, 'left') : null;
  const right = summary ? findXRController(summary.controllers, 'right') : null;

  ctx.clearRect(0, 0, w, h);
  drawXRRoundRect(ctx, 0, 0, w, h, 34);
  ctx.fillStyle = 'rgba(3, 8, 13, 0.78)';
  ctx.fill();
  ctx.strokeStyle = snapshot?.published ? 'rgba(74, 222, 128, 0.95)' : 'rgba(251, 191, 36, 0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = snapshot?.published ? '#86efac' : '#fbbf24';
  ctx.fillRect(38, 38, 10, 72);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = '700 40px Rajdhani, Arial, sans-serif';
  ctx.fillText('TX CASQUE > LIVEKIT', 66, 70);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
  ctx.font = '700 22px JetBrains Mono, monospace';
  ctx.fillText(snapshot?.topic || 'oscar.xr.input', 66, 108);

  ctx.fillStyle = snapshot?.published ? '#86efac' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(snapshot?.published ? 'TRANSMIS' : 'EN ATTENTE ROOM', w - 42, 72);
  ctx.textAlign = 'left';

  drawXRMetric(ctx, 66, 160, 'SEQ', summary ? `#${summary.seq}` : '--');
  drawXRMetric(ctx, 260, 160, 'CADENCE', snapshot ? `${snapshot.publishHz} Hz` : '--');
  drawXRMetric(ctx, 510, 160, 'MODE', snapshot ? 'LOW LATENCY' : '--');

  drawXRSection(ctx, 66, 236, 'TÊTE', [
    ['pos', formatXRVector(summary?.head?.position, 'm')],
    ['rot', formatXRRotation(summary?.head?.rotationDeg)],
  ]);

  drawXRSection(ctx, 66, 370, 'MAIN GAUCHE', [
    ['axes', formatXRAxes(left?.axes)],
    ['btns', formatXRButtons(left?.buttons)],
    ['grip', formatXRVector(left?.grip?.position, 'm')],
  ]);

  drawXRSection(ctx, 544, 370, 'MAIN DROITE', [
    ['axes', formatXRAxes(right?.axes)],
    ['btns', formatXRButtons(right?.buttons)],
    ['grip', formatXRVector(right?.grip?.position, 'm')],
  ]);

  xrInputPanelTexture.needsUpdate = true;
}

function drawXRMetric(ctx, x, y, label, value) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.font = '700 20px JetBrains Mono, monospace';
  ctx.fillText(label, x, y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = '700 30px JetBrains Mono, monospace';
  ctx.fillText(value, x, y + 38);
}

function drawXRSection(ctx, x, y, title, rows) {
  ctx.fillStyle = 'rgba(147, 197, 253, 0.92)';
  ctx.font = '700 24px Rajdhani, Arial, sans-serif';
  ctx.fillText(title, x, y);

  let cursorY = y + 38;
  rows.forEach(([key, value]) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.font = '700 18px JetBrains Mono, monospace';
    ctx.fillText(key.toUpperCase(), x, cursorY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '500 21px JetBrains Mono, monospace';
    fitText(ctx, value, x + 82, cursorY, 360);
    cursorY += 38;
  });
}

function findXRController(controllers, hand) {
  return controllers.find((controller) => controller.hand === hand)
    || controllers.find((controller) => controller.hand === 'none')
    || null;
}

function formatXRVector(vector, suffix = '') {
  if (!vector) return '--';
  return `x ${formatXRNumber(vector[0])}${suffix}  y ${formatXRNumber(vector[1])}${suffix}  z ${formatXRNumber(vector[2])}${suffix}`;
}

function formatXRRotation(rotation) {
  if (!rotation) return '--';
  return `r ${formatXRNumber(rotation[0])}°  p ${formatXRNumber(rotation[1])}°  y ${formatXRNumber(rotation[2])}°`;
}

function formatXRAxes(axes) {
  if (!axes?.length) return '--';
  return axes.map((axis, index) => `a${index}:${formatXRNumber(axis)}`).join(' ');
}

function formatXRButtons(buttons) {
  if (!buttons?.length) return '--';
  const active = buttons.filter((button) => button.pressed || button.touched || button.value > 0.02);
  if (!active.length) return 'repos';
  return active.map((button) => `b${button.index}:${button.pressed ? 'P' : button.touched ? 'T' : formatXRNumber(button.value)}`).join(' ');
}

function formatXRNumber(value) {
  return Number(value || 0).toFixed(2);
}

function screenDetectionToSphereAnchor(detection) {
  const { x, y, w, h } = detection.box;
  const normalized = detection.normalizedBox;
  const centerX = normalized
    ? THREE.MathUtils.clamp(normalized.x + normalized.w / 2, 0, 1)
    : THREE.MathUtils.clamp((x + w / 2) / window.innerWidth, 0, 1);
  const centerY = normalized
    ? THREE.MathUtils.clamp(normalized.y + normalized.h / 2, 0, 1)
    : THREE.MathUtils.clamp((y + h / 2) / window.innerHeight, 0, 1);
  const yaw = (centerX - 0.5) * Math.PI * 2;
  const pitch = THREE.MathUtils.clamp((0.5 - centerY) * Math.PI, -1.35, 1.35);

  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch) * XR_HUD_RADIUS,
    VIEWER_HEIGHT + Math.sin(pitch) * XR_HUD_RADIUS,
    -Math.cos(yaw) * Math.cos(pitch) * XR_HUD_RADIUS
  );
}

function createDetectionPanel(detection) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const isProduct = detection.type === 'product';
  const accent = detection.type === 'incident' ? '#d98072' : isProduct ? '#d85810' : '#9bb8a4';
  const typeLabel = String(detection.type || 'détection').toUpperCase();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  roundRect(ctx, 8, 8, 496, 240, 24);
  ctx.fillStyle = 'rgba(18, 20, 22, 0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = accent;
  roundRect(ctx, 28, 38, 8, 54, 4);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.font = '700 24px JetBrains Mono, monospace';
  ctx.fillText(typeLabel, 52, 58);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = '700 38px Rajdhani, Arial, sans-serif';
  fitText(ctx, detection.label, 52, 108, 390);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
  ctx.font = '500 23px JetBrains Mono, monospace';
  ctx.fillText(`CONF ${Math.round(detection.confidence * 100)}%`, 52, 154);

  let y = 194;
  if (detection.meta) {
    ctx.font = '500 20px JetBrains Mono, monospace';
    for (const [key, value] of Object.entries(detection.meta).slice(0, 2)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.fillText(String(key).toUpperCase(), 52, y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fillText(String(value), 232, y);
      y += 30;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(XR_HUD_PANEL_WIDTH, XR_HUD_PANEL_HEIGHT), material);
  mesh.renderOrder = 20;
  return mesh;
}

function fitText(ctx, text, x, y, maxWidth) {
  const value = String(text);
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }
  let trimmed = value;
  while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  ctx.fillText(`${trimmed}...`, x, y);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawXRRoundRect(ctx, x, y, width, height, radius) {
  roundRect(ctx, x + 2, y + 2, width - 4, height - 4, radius);
}
