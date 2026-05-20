/** Application core — initialization and render loop */

import { initCaptureSource } from '../capture/captureSource.js';
import { onStateChange, ConnectionState } from '../capture/livekitStream.js';
import { initOverlayEngine, render as renderOverlay } from '../overlay/overlayEngine.js';
import { renderDetections } from '../overlay/detectionRenderer.js';
import { generateMockDetections } from '../services/mockDetection.js';
import { setStatus } from '../hud/statusManager.js';
import { startClock } from '../hud/clockModule.js';
import { startRobotTelemetry } from '../hud/robotTelemetry.js';
import { startConnectionMetrics } from '../hud/connectionMetrics.js';
import { initMicButton } from '../hud/micButton.js';
import { initVRButton } from '../hud/vrButton.js';
import { initXRScene, onStreamUpdate, getProjectionMode } from '../immersive/xrScene.js';
import { throttle } from '../utils/throttle.js';

let isRunning = false;
let detectionsActive = false;

const processDetections = throttle(() => {
  if (!detectionsActive) return;
  const detections = generateMockDetections(1, 2);
  renderDetections(detections);
}, 2000);

export async function startApp() {
  setStatus('INIT');
  startClock();
  startRobotTelemetry();
  startConnectionMetrics();
  initMicButton();

  initOverlayEngine();

  const videoEl = document.getElementById('video-feed');
  const audioEl = document.getElementById('audio-feed');

  // The immersive scene owns the 3D rendering (cinema plane / 360 sphere).
  // It uses videoEl as the texture source, so LiveKit keeps driving it.
  await initXRScene(videoEl);
  initVRButton();

  setStatus('CONNECTING');
  const { video } = await initCaptureSource(videoEl, audioEl);

  if (!video) {
    setStatus('ERROR_CONNECTION');
    return;
  }

  onStateChange((state) => {
    // Let the immersive scene react to projection-mode changes
    onStreamUpdate(state);

    if (state.connectionState === ConnectionState.Connected) {
      if (state.hasVideo) {
        if (!detectionsActive) {
          detectionsActive = true;
          setTimeout(() => setStatus('SCANNING'), 1500);
        }
        setStatus('STREAMING');
      } else {
        detectionsActive = false;
        setStatus('WAITING_FOR_STREAM');
      }
      reflectProjectionInHud();
    } else if (state.connectionState === ConnectionState.Connecting) {
      setStatus('CONNECTING');
    } else if (state.connectionState === ConnectionState.Reconnecting) {
      setStatus('RECONNECTING');
    } else if (state.connectionState === ConnectionState.Disconnected) {
      detectionsActive = false;
      setStatus('DISCONNECTED');
    }
  });

  isRunning = true;
  requestAnimationFrame(loop);
}

function reflectProjectionInHud() {
  const el = document.getElementById('metrics-projection');
  if (!el) return;
  const mode = getProjectionMode();
  el.textContent = mode === 'equirect' ? 'IMMERSIF 360°' : 'ÉCRAN CINÉMA';
}

function loop() {
  if (!isRunning) return;
  processDetections();
  renderOverlay();
  requestAnimationFrame(loop);
}

export function stopApp() {
  isRunning = false;
}
