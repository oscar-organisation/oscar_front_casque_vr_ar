/** HUD status bar — controls the bottom status indicator and dot state */

const statusEl = document.getElementById('status');
const dotEl = document.getElementById('status-dot');

const STATUS = {
  INIT: 'initialisation...',
  CONNECTING: 'connexion au robot...',
  WAITING_FOR_STREAM: 'en attente du flux robot...',
  STREAMING: 'flux robot actif',
  SCANNING: 'analyse de la scène...',
  DETECTED: 'détection active',
  RECONNECTING: 'reconnexion en cours...',
  ERROR_CONNECTION: 'erreur : connexion perdue',
  ERROR_API: 'erreur : connexion API perdue',
  ERROR_NON_IMMERSIVE: 'flux non immersif : vidéo 360 requise',
  DISCONNECTED: 'déconnecté du robot',
};

const ERROR_STATES = ['ERROR_CONNECTION', 'ERROR_API', 'ERROR_NON_IMMERSIVE', 'DISCONNECTED'];
const SCANNING_STATES = ['SCANNING', 'INIT', 'CONNECTING', 'WAITING_FOR_STREAM', 'RECONNECTING'];

let fadeTimer = null;

/** Updates the status bar text and dot state */
export function setStatus(key) {
  if (!STATUS[key]) return;

  statusEl.textContent = STATUS[key];

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
