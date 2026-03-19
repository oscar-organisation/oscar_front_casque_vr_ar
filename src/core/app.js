/** Application core — initialization and render loop */

import { initVideoStream } from '../capture/videoStream.js';
import { initOverlayEngine, render } from '../overlay/overlayEngine.js';
import { renderDetections } from '../overlay/detectionRenderer.js';
import { generateMockDetections } from '../services/mockDetection.js';
import { setStatus } from '../hud/statusManager.js';
import { throttle } from '../utils/throttle.js';

let video = null;
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

  video = await initVideoStream();
  if (!video) {
    setStatus('ERROR_CAMERA');
    return;
  }

  initOverlayEngine();
  setStatus('SCANNING');

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
