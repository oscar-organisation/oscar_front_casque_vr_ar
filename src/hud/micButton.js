/** Microphone toggle — publishes the operator's voice to the robot. */

import { toggleMicrophone, onStateChange } from '../capture/livekitStream.js';

const btn = () => document.getElementById('mic-button');
const lbl = () => document.getElementById('mic-button-label');

export function initMicButton() {
  const b = btn();
  if (!b) return;

  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const enabled = await toggleMicrophone();
      console.info(`[Mic] ${enabled ? 'publishing' : 'stopped'}`);
    } catch (err) {
      console.error('[Mic] toggle failed', err);
      alert('Impossible d\'activer le micro. Vérifiez l\'autorisation du navigateur.');
    } finally {
      b.disabled = false;
    }
  });

  onStateChange((s) => {
    b.dataset.active = s.micPublishing ? 'on' : 'off';
    if (lbl()) lbl().textContent = s.micPublishing ? 'MIC ACTIF' : 'MIC';
  });
}
