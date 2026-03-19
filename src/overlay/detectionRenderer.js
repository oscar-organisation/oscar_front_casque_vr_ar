/** Maps detection API results to 3D overlays + 2D HUD labels */

import { createBoundingBox, removeBoundingBox, clearOverlays } from './overlayEngine.js';
import { setLabel, clearLabels, updateDetectionCount } from '../hud/labelRenderer.js';
import { OVERLAY } from '../config/constants.js';

/**
 * Processes a batch of detections: renders bounding boxes and positioned labels.
 * Clears previous frame before rendering.
 * @param {Array<Detection>} detections
 */
export function renderDetections(detections) {
  clearOverlays();
  clearLabels();

  detections.forEach((detection) => {
    const color = detection.type === 'face' ? OVERLAY.FACE_COLOR : OVERLAY.PRODUCT_COLOR;

    createBoundingBox(
      detection.id,
      detection.box.x,
      detection.box.y,
      detection.box.w,
      detection.box.h,
      detection.label,
      color
    );

    setLabel(detection);
  });

  updateDetectionCount(detections.length);
}

/** Renders a single detection without clearing others */
export function renderSingleDetection(detection) {
  const color = detection.type === 'face' ? OVERLAY.FACE_COLOR : OVERLAY.PRODUCT_COLOR;

  createBoundingBox(
    detection.id,
    detection.box.x,
    detection.box.y,
    detection.box.w,
    detection.box.h,
    detection.label,
    color
  );

  setLabel(detection);
}

export function removeDetection(id) {
  removeBoundingBox(id);
}
