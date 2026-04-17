/** Application core — initialization and render loop */

import { initCaptureSource } from '../capture/captureSource.js';
import { onStateChange, ConnectionState } from '../capture/livekitStream.js';
import { initOverlayEngine, render } from '../overlay/overlayEngine.js';
import { renderDetections } from '../overlay/detectionRenderer.js';
import { generateMockDetections } from '../services/mockDetection.js';
import { setStatus } from '../hud/statusManager.js';
import { startClock } from '../hud/clockModule.js';
import { startRobotTelemetry } from '../hud/robotTelemetry.js';
import { startConnectionMetrics } from '../hud/connectionMetrics.js';
import { initMicButton } from '../hud/micButton.js';
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

  setStatus('CONNECTING');
  const { mode, video } = await initCaptureSource(videoEl, audioEl);

  if (!video) {
    setStatus('ERROR_CONNECTION');
    return;
  }

  onStateChange((state) => {
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

function loop() {
  if (!isRunning) return;
  processDetections();
  render();
  requestAnimationFrame(loop);
}

export function stopApp() {
  isRunning = false;
}
