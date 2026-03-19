/** Maps detection API results to 3D overlays + 2D HUD labels + info panels */

import { createBoundingBox, removeBoundingBox, clearOverlays } from './overlayEngine.js';
import { setLabel, clearLabels, updateDetectionCount } from '../hud/labelRenderer.js';
import { setInfoPanel, clearInfoPanels } from '../hud/infoPanel.js';
import { OVERLAY } from '../config/constants.js';

/**
 * Processes a batch of detections: bounding boxes, labels, and info panels.
 * Clears previous frame before rendering.
 * @param {Array<Detection>} detections
 */
export function renderDetections(detections) {
  clearOverlays();
  clearLabels();
  clearInfoPanels();

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
    setInfoPanel(detection);
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
  setInfoPanel(detection);
}

export function removeDetection(id) {
  removeBoundingBox(id);
}
