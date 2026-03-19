/** HUD status bar — controls the bottom status indicator and dot state */

const statusEl = document.getElementById('status');
const dotEl = document.getElementById('status-dot');

const STATUS = {
  INIT: 'initialisation...',
  CAMERA_ACTIVE: 'flux caméra actif',
  SCANNING: 'analyse en cours...',
  DETECTED: 'détection active',
  ERROR_CAMERA: 'erreur : accès caméra refusé',
  ERROR_API: 'erreur : connexion API perdue',
  DISCONNECTED: 'déconnecté',
};

const ERROR_STATES = ['ERROR_CAMERA', 'ERROR_API', 'DISCONNECTED'];
const SCANNING_STATES = ['SCANNING', 'INIT'];

let fadeTimer = null;

/** Updates the status bar text and dot state */
export function setStatus(key) {
  if (!STATUS[key]) return;

  statusEl.textContent = STATUS[key];

  // Dot reflects system health
  dotEl.classList.toggle('error', ERROR_STATES.includes(key));
  dotEl.classList.toggle('scanning', SCANNING_STATES.includes(key));
}

/** Sets a custom status message */
export function setCustomStatus(message) {
  statusEl.textContent = message;
}

/** Temporarily shows a status then reverts */
export function flashStatus(key, duration = 2000) {
  const previous = statusEl.textContent;
  setStatus(key);

  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    statusEl.textContent = previous;
  }, duration);
}

export { STATUS };
