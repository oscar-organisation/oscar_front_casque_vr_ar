/**
 * Capture source — single entry point for the live video feed.
 * The feed comes from the robot via LiveKit (the headset is consume-only
 * for Lot 1; no local camera is used).
 */

import { initLiveKit } from './livekitStream.js';

let activeMode = null;

/**
 * Initializes the LiveKit subscription and binds the remote video track
 * to the given <video> element.
 * @param {HTMLVideoElement} videoEl
 * @param {HTMLAudioElement} [audioEl]
 * @returns {Promise<{mode: string, video: HTMLVideoElement|null}>}
 */
export async function initCaptureSource(videoEl, audioEl = null) {
  activeMode = 'livekit';
  const video = await initLiveKit(videoEl, audioEl);
  return { mode: activeMode, video };
}

export function getCaptureMode() {
  return activeMode;
}
