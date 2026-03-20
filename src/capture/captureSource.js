/**
 * Capture source abstraction — unified interface for webcam and WebXR passthrough.
 * WebXR immersive-ar requires a user gesture to start.
 */

import { CAMERA } from '../config/constants.js';

/** @typedef {'webcam'|'webxr'} CaptureMode */

let activeMode = null;
let xrSession = null;

/**
 * Detects the best available capture mode.
 * @returns {Promise<CaptureMode>}
 */
export async function detectCaptureMode() {
  if (navigator.xr) {
    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
    if (supported) return 'webxr';
  }
  return 'webcam';
}

/**
 * Initializes the capture source.
 * If WebXR is available, starts webcam as preview and shows AR entry button.
 * The actual XR session is started via startXRSession() on user click.
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<{mode: CaptureMode, video: HTMLVideoElement|null}>}
 */
export async function initCaptureSource(videoEl) {
  const mode = await detectCaptureMode();
  activeMode = mode;

  // Always start webcam first (as preview or main source)
  const video = await initWebcam(videoEl);

  if (mode === 'webxr') {
    // Show the AR button — actual XR session needs user gesture
    const arButton = document.getElementById('enter-ar');
    if (arButton) arButton.style.display = 'block';
    console.info('[Capture] WebXR available — AR button shown');
  }

  return { mode, video };
}

/** Returns the current capture mode */
export function getCaptureMode() {
  return activeMode;
}

/**
 * Starts the WebXR immersive-ar session.
 * MUST be called from a user gesture (click handler).
 * @param {THREE.WebGLRenderer} renderer - Three.js renderer to bind XR session to
 * @returns {Promise<XRSession|null>}
 */
export async function startXRSession(renderer) {
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['camera-access'],
    });

    // Bind XR session to Three.js renderer
    renderer.xr.enabled = true;
    await renderer.xr.setSession(xrSession);

    // Hide the video feed — passthrough replaces it
    const videoEl = document.getElementById('video-feed');
    if (videoEl) {
      // Stop webcam stream
      const stream = videoEl.srcObject;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      videoEl.style.display = 'none';
    }

    // Hide AR button
    const arButton = document.getElementById('enter-ar');
    if (arButton) arButton.style.display = 'none';

    activeMode = 'webxr';

    xrSession.addEventListener('end', () => {
      console.info('[Capture] XR session ended');
      xrSession = null;
      activeMode = 'webcam';
      renderer.xr.enabled = false;
    });

    console.info('[Capture] WebXR immersive-ar session started');
    return xrSession;
  } catch (error) {
    console.error('[Capture] WebXR session failed:', error);
    return null;
  }
}

async function initWebcam(videoEl) {
  const configs = [
    {
      video: {
        width: { ideal: CAMERA.WIDTH },
        height: { ideal: CAMERA.HEIGHT },
        facingMode: CAMERA.FACING_MODE,
      },
      audio: false,
    },
    {
      video: {
        width: { ideal: CAMERA.WIDTH },
        height: { ideal: CAMERA.HEIGHT },
        facingMode: 'user',
      },
      audio: false,
    },
    { video: true, audio: false },
  ];

  for (const config of configs) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(config);
      videoEl.srcObject = stream;
      videoEl.muted = true;
      await videoEl.play();
      console.info('[Capture] Webcam started with config:', JSON.stringify(config.video));
      return videoEl;
    } catch (error) {
      console.warn('[Capture] Config failed, trying next:', error.message);
    }
  }

  console.error('[Capture] All webcam configs failed');
  return null;
}

/** Returns the active XR session (null if webcam mode) */
export function getXRSession() {
  return xrSession;
}
