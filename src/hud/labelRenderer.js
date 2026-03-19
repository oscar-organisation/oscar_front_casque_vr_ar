/** Renders 2D detection labels as DOM elements positioned over bounding boxes */

const container = document.getElementById('labels');
const activeLabels = new Map();

/**
 * Creates or updates a label for a detection.
 * Positioned at the top-left corner of the bounding box.
 * @param {Object} detection - { id, type, box: { x, y, w, h }, label, confidence }
 */
export function setLabel(detection) {
  let el = activeLabels.get(detection.id);

  if (!el) {
    el = createLabelElement(detection);
    container.appendChild(el);
    activeLabels.set(detection.id, el);
  }

  // Position above the bounding box
  el.style.left = `${detection.box.x}px`;
  el.style.top = `${detection.box.y - 22}px`;

  // Update content
  const nameEl = el.querySelector('.detection-label__name');
  const confEl = el.querySelector('.detection-label__confidence');
  nameEl.textContent = detection.label;
  confEl.textContent = `${Math.round(detection.confidence * 100)}%`;
}

/** Removes a specific label */
export function removeLabel(id) {
  const el = activeLabels.get(id);
  if (el) {
    el.remove();
    activeLabels.delete(id);
  }
}

/** Removes all active labels */
export function clearLabels() {
  for (const el of activeLabels.values()) {
    el.remove();
  }
  activeLabels.clear();
}

/** Updates the detection count in the top bar */
export function updateDetectionCount(count) {
  const el = document.getElementById('detection-count');
  el.textContent = count === 0 ? 'aucune détection' : `${count} détection${count > 1 ? 's' : ''}`;
}

function createLabelElement(detection) {
  const label = document.createElement('div');
  label.className = 'detection-label';

  const tag = document.createElement('div');
  tag.className = `detection-label__tag detection-label__tag--${detection.type}`;

  const name = document.createElement('span');
  name.className = 'detection-label__name';

  const conf = document.createElement('span');
  conf.className = 'detection-label__confidence';

  tag.appendChild(name);
  tag.appendChild(conf);
  label.appendChild(tag);

  return label;
}
