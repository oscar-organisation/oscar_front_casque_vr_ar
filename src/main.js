// App entry point
// Initializes video stream, overlay system, and starts render loop

import { initVideoStream } from './video.js';
import { initOverlaySystem, renderOverlays, createBoundingBox } from './overlay.js';

const status = document.getElementById('status');

async function init() {
  status.textContent = 'Initialisation...';

  const video = await initVideoStream();
  if (!video) return;

  initOverlaySystem();

  // Demo bounding box — will be replaced by real detection data
  createBoundingBox(
    'demo-box',
    window.innerWidth / 2 - 100,
    window.innerHeight / 2 - 75,
    200,
    150,
    'Detection test',
    0x00ff88
  );

  status.textContent = 'Flux camera actif';
  animate();
}

// Render loop — redraws at ~60fps
function animate() {
  requestAnimationFrame(animate);
  renderOverlays();
}

init();
