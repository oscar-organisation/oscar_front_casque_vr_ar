/** Info panel component — contextual details displayed next to detections */

const container = document.getElementById('labels');
const activePanels = new Map();

/**
 * Creates or updates an info panel for a detection.
 * Positioned to the right of the bounding box, or left if near screen edge.
 * @param {Object} detection - { id, type, box, label, confidence, meta? }
 */
export function setInfoPanel(detection) {
  let el = activePanels.get(detection.id);

  if (!el) {
    el = buildPanel(detection);
    container.appendChild(el);
    activePanels.set(detection.id, el);
    // Trigger fade-in
    requestAnimationFrame(() => el.classList.add('info-panel--visible'));
  }

  updatePosition(el, detection);
  updateContent(el, detection);
}

/** Removes a specific panel */
export function removeInfoPanel(id) {
  const el = activePanels.get(id);
  if (el) {
    el.remove();
    activePanels.delete(id);
  }
}

/** Removes all panels */
export function clearInfoPanels() {
  for (const el of activePanels.values()) {
    el.remove();
  }
  activePanels.clear();
}

function updatePosition(el, detection) {
  const { x, y, w, h } = detection.box;
  const panelWidth = 160;
  const margin = 8;

  // Place right of the box, flip left if near screen edge
  const placeRight = (x + w + panelWidth + margin) < window.innerWidth;
  const left = placeRight ? x + w + margin : x - panelWidth - margin;
  const top = y;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function updateContent(el, detection) {
  el.querySelector('.info-panel__label').textContent = detection.label;
  el.querySelector('.info-panel__confidence').textContent =
    `${Math.round(detection.confidence * 100)}%`;
  el.querySelector('.info-panel__type').textContent =
    detection.type === 'face' ? 'Visage' : 'Produit';

  // Optional metadata rows
  const metaContainer = el.querySelector('.info-panel__meta');
  metaContainer.innerHTML = '';

  if (detection.meta) {
    for (const [key, value] of Object.entries(detection.meta)) {
      const row = document.createElement('div');
      row.className = 'info-panel__row';
      row.innerHTML = `<span class="info-panel__key">${key}</span><span class="info-panel__value">${value}</span>`;
      metaContainer.appendChild(row);
    }
  }
}

function buildPanel(detection) {
  const panel = document.createElement('div');
  const typeClass = detection.type === 'face' ? 'info-panel--face' : 'info-panel--product';
  panel.className = `info-panel ${typeClass}`;

  panel.innerHTML = `
    <div class="info-panel__header">
      <span class="info-panel__type"></span>
      <span class="info-panel__confidence"></span>
    </div>
    <div class="info-panel__label"></div>
    <div class="info-panel__meta"></div>
  `;

  return panel;
}
