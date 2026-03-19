/**
 * Coordinate mapping utilities for screen ↔ Three.js ↔ video transformations.
 */

/**
 * Maps normalized detection coordinates (0-1) to screen pixels.
 * Most detection APIs return normalized coordinates.
 * @param {{ x, y, w, h }} normalized - values between 0 and 1
 * @param {number} screenW
 * @param {number} screenH
 * @returns {{ x, y, w, h }} pixel coordinates
 */
export function normalizedToScreen(normalized, screenW, screenH) {
  return {
    x: normalized.x * screenW,
    y: normalized.y * screenH,
    w: normalized.w * screenW,
    h: normalized.h * screenH,
  };
}

/**
 * Maps video-space coordinates to screen-space, accounting for object-fit: cover.
 * The video may be cropped to fill the viewport — detections need to match.
 */
export function videoToScreen(box, videoW, videoH, screenW, screenH) {
  const videoRatio = videoW / videoH;
  const screenRatio = screenW / screenH;

  let scale, offsetX, offsetY;

  if (videoRatio > screenRatio) {
    scale = screenH / videoH;
    offsetX = (screenW - videoW * scale) / 2;
    offsetY = 0;
  } else {
    scale = screenW / videoW;
    offsetX = 0;
    offsetY = (screenH - videoH * scale) / 2;
  }

  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    w: box.w * scale,
    h: box.h * scale,
  };
}
