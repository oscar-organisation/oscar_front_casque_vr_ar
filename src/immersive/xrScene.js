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
  shouldForceEquirect,
  shouldRequireEquirectInVR,
} from '../capture/streamProjection.js';
import { onXRInputPacket, publishXRInputFrame } from '../teleoperation/xrInputPublisher.js';
import { setStatus } from '../hud/statusManager.js';

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
  initXRInputDebugPanel();
  onXRInputPacket(updateXRInputDebugPanel);

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
    forceSphereForImmersiveSession();
    showXRDetections(true);
    showXRInputDebugPanel(true);
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

/** React to LiveKit state changes — swaps mesh if projection mode changes. */
export function onStreamUpdate(liveKitState) {
  if (!scene) return;
  lastLiveKitState = liveKitState;
  const mode = renderer?.xr?.isPresenting ? PROJECTION.EQUIRECT : detectModeFromState(liveKitState);
  if (mode !== currentMode) buildForMode(mode);
}

/** Called by the HUD button. */
export async function enterVR() {
  if (!vrSupported) {
    alert('Votre navigateur ne supporte pas WebXR. Ouvrez ce site sur un casque compatible (Meta Quest, Pico).');
    return;
  }
  if (renderer.xr.isPresenting) return;
  if (shouldRequireEquirectInVR() && currentMode !== PROJECTION.EQUIRECT) {
    setStatus('ERROR_NON_IMMERSIVE');
    const reason = currentProjection?.reason || 'flux non déclaré comme 360';
    alert(`Flux non immersif : vidéo 360 requise.\n\nRaison : ${reason}`);
    return;
  }
  try {
    forceSphereForImmersiveSession();
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

  console.info(`[XR] projection detected → ${projection.mode} (${projection.source}: ${projection.reason})`);
  currentProjection = projection;
  notify({ projection });
  return projection.mode;
}

function buildForMode(mode) {
  removeCurrentMesh();
  currentMode = mode;
  if (!currentProjection || currentProjection.mode !== mode) {
    currentProjection = {
      mode,
      source: shouldForceEquirect() ? 'forced' : 'initial',
      reason: shouldForceEquirect() ? 'forced by test override' : 'initial render mode before stream metadata',
      confidence: shouldForceEquirect() ? 'explicit' : 'fallback',
    };
  }
  displayMesh = mode === PROJECTION.EQUIRECT ? buildSphere() : buildCinemaScreen();
  displayMesh.userData.projection = mode;
  scene.add(displayMesh);
  console.info(`[XR] projection → ${mode}`);
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

function forceSphereForImmersiveSession() {
  if (currentMode === PROJECTION.EQUIRECT && displayMesh?.userData?.projection === PROJECTION.EQUIRECT) return;
  currentProjection = {
    mode: PROJECTION.EQUIRECT,
    source: 'forced',
    reason: 'immersive VR sessions always use spherical wrap',
    confidence: 'explicit',
  };
  buildForMode(PROJECTION.EQUIRECT);
}

function showXRDetections(visible) {
  const group = getOrCreateDetectionGroup();
  group.visible = visible;
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
  const centerX = THREE.MathUtils.clamp((x + w / 2) / window.innerWidth, 0, 1);
  const centerY = THREE.MathUtils.clamp((y + h / 2) / window.innerHeight, 0, 1);
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
  const accent = isProduct ? '#fdba74' : '#93c5fd';
  const typeLabel = isProduct ? 'PRODUIT' : 'VISAGE';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  roundRect(ctx, 8, 8, 496, 240, 24);
  ctx.fillStyle = 'rgba(4, 9, 14, 0.84)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.fillRect(28, 32, 8, 64);

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
