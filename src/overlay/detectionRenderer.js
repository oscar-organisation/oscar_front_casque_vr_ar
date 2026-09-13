/** Maps detection API results to 3D overlays + 2D HUD labels + info panels */

import { createBoundingBox, removeBoundingBox, clearOverlays } from './overlayEngine.js';
import { setLabel, clearLabels, updateDetectionCount } from '../hud/labelRenderer.js';
import { setInfoPanel, clearInfoPanels } from '../hud/infoPanel.js';
import { OVERLAY, VISION } from '../config/constants.js';
import { renderXRDetections, clearXRDetections } from '../immersive/xrScene.js';

function detectionColor(type) {
  if (type === 'incident') return OVERLAY.INCIDENT_COLOR;
  if (type === 'person' || type === 'face') return OVERLAY.PERSON_COLOR;
  if (type === 'product') return OVERLAY.PRODUCT_COLOR;
  return OVERLAY.DEFAULT_COLOR;
}

/**
 * Processes a batch of detections: bounding boxes, labels, and info panels.
 * Clears previous frame before rendering.
 * @param {Array<Detection>} detections
 */
export function renderDetections(detections) {
  clearOverlays();
  clearLabels();
  clearInfoPanels();

  const avecEtiquettes = detections.length <= VISION.MAX_LABELS;

  detections.forEach((detection) => {
    const color = detectionColor(detection.type);

    createBoundingBox(
      detection.id,
      detection.box.x,
      detection.box.y,
      detection.box.w,
      detection.box.h,
      detection.label,
      color
    );

    if (avecEtiquettes) setLabel(detection);
    if (detection.meta?.showPanel) setInfoPanel(detection);
  });

  renderXRDetections(detections);
  updateDetectionCount(detections.length);
}

/** Renders a single detection without clearing others */
export function renderSingleDetection(detection) {
  const color = detectionColor(detection.type);

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
  if (detection.meta?.showPanel) setInfoPanel(detection);
  renderXRDetections([detection]);
}

export function removeDetection(id) {
  removeBoundingBox(id);
  clearXRDetections();
}
