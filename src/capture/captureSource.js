/**
 * Capture source abstraction — unified interface for webcam and WebXR passthrough.
 * Allows swapping the video source without changing the rest of the pipeline.
 */

import { CAMERA } from '../config/constants.js';

/** @typedef {'webcam'|'webxr'} CaptureMode */

let activeMode = null;
let xrSession = null;

/**
 * Detects the best available capture mode.
 * Prefers WebXR passthrough if supported, falls back to webcam.
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
 * Initializes the capture source based on detected mode.
 * @param {HTMLVideoElement} videoEl
 * @returns {Promise<{mode: CaptureMode, video: HTMLVideoElement|null}>}
 */
export async function initCaptureSource(videoEl) {
  const mode = await detectCaptureMode();
  activeMode = mode;

  if (mode === 'webxr') {
    return { mode, video: await initWebXR(videoEl) };
  }

  return { mode, video: await initWebcam(videoEl) };
}

/** Returns the current capture mode */
export function getCaptureMode() {
  return activeMode;
}

async function initWebcam(videoEl) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CAMERA.WIDTH },
        height: { ideal: CAMERA.HEIGHT },
        facingMode: CAMERA.FACING_MODE,
      },
      audio: false,
    });
    videoEl.srcObject = stream;
    return videoEl;
  } catch (error) {
    console.error('[Capture] Webcam access failed:', error);
    return null;
  }
}

/**
 * WebXR passthrough initialization.
 * Requests an immersive-ar session with camera-access feature.
 * The Three.js renderer will bind to this session in the overlay engine.
 */
async function initWebXR(videoEl) {
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['camera-access'],
    });

    console.info('[Capture] WebXR passthrough session started');
    return videoEl;
  } catch (error) {
    console.warn('[Capture] WebXR failed, falling back to webcam:', error);
    activeMode = 'webcam';
    return initWebcam(videoEl);
  }
}

/** Returns the active XR session (null if webcam mode) */
export function getXRSession() {
  return xrSession;
}
