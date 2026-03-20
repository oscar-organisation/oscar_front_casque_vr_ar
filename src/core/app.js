/** Application core — initialization and render loop */

import { initCaptureSource, getCaptureMode, startXRSession } from '../capture/captureSource.js';
import { initOverlayEngine, getRenderer, render, startXRRenderLoop } from '../overlay/overlayEngine.js';
import { renderDetections } from '../overlay/detectionRenderer.js';
import { generateMockDetections } from '../services/mockDetection.js';
import { setStatus, setCustomStatus } from '../hud/statusManager.js';
import { throttle } from '../utils/throttle.js';

let isRunning = false;

/** Throttled detection cycle — limits processing frequency */
const processDetections = throttle(() => {
  const detections = generateMockDetections(1, 2);
  renderDetections(detections);
  setStatus('DETECTED');
}, 2000);

/** Initializes all subsystems and starts the render loop */
export async function startApp() {
  setStatus('INIT');

  const videoEl = document.getElementById('video-feed');
  const { mode, video } = await initCaptureSource(videoEl);

  if (!video) {
    setStatus('ERROR_CAMERA');
    return;
  }

  setCustomStatus(`source :: ${mode === 'webxr' ? 'webcam (AR disponible)' : 'webcam'}`);
  const { renderer } = initOverlayEngine();

  // Wire up the AR button if WebXR is available
  const arButton = document.getElementById('enter-ar');
  if (arButton && mode === 'webxr') {
    arButton.addEventListener('click', async () => {
      arButton.textContent = 'Lancement...';
      arButton.disabled = true;

      const session = await startXRSession(renderer);
      if (session) {
        setCustomStatus('source :: passthrough AR');

        // Switch to XR render loop
        isRunning = false;
        startXRRenderLoop((timestamp, xrFrame) => {
          processDetections();
        });

        session.addEventListener('end', () => {
          setCustomStatus('source :: webcam');
          isRunning = true;
          requestAnimationFrame(loop);
        });
      } else {
        arButton.textContent = 'Entrer en AR';
        arButton.disabled = false;
        setCustomStatus('source :: webcam (AR échoué)');
      }
    });
  }

  // Brief source indicator, then switch to scanning
  setTimeout(() => setStatus('SCANNING'), 1500);

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
