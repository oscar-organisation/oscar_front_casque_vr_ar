/** Video stream capture — webcam or headset passthrough */

import { CAMERA } from '../config/constants.js';

/**
 * Initializes the camera feed on the given video element.
 * Uses back camera by default for AR headset compatibility.
 * @returns {Promise<HTMLVideoElement|null>}
 */
export async function initVideoStream() {
  const video = document.getElementById('video-feed');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: CAMERA.WIDTH },
        height: { ideal: CAMERA.HEIGHT },
        facingMode: CAMERA.FACING_MODE,
      },
      audio: false,
    });

    video.srcObject = stream;
    return video;
  } catch (error) {
    console.error('[Capture] Camera access failed:', error);
    return null;
  }
}

/**
 * Captures a single frame from the video element as ImageData.
 * Used for sending frames to detection APIs.
 * @param {HTMLVideoElement} video
 * @param {HTMLCanvasElement} canvas - offscreen canvas for frame extraction
 * @returns {ImageData|null}
 */
export function captureFrame(video, canvas) {
  if (!video || video.readyState < video.HAVE_CURRENT_DATA) return null;

  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Converts a canvas frame to a base64 JPEG for API transmission.
 * @param {HTMLCanvasElement} canvas
 * @param {number} quality - JPEG quality 0-1
 * @returns {string} base64-encoded JPEG
 */
export function frameToBase64(canvas, quality = 0.7) {
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}
