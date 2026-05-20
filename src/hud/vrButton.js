/** VR button — mirrors the glass-style toggle of the mic. */

import { enterVR, onXRStateChange } from '../immersive/xrScene.js';

export function initVRButton() {
  const btn = document.getElementById('vr-button');
  const lbl = document.getElementById('vr-button-label');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await enterVR();
    } finally {
      btn.disabled = false;
    }
  });

  onXRStateChange(({ supported, presenting }) => {
    btn.hidden = !supported;
    btn.dataset.active = presenting ? 'on' : 'off';
    if (lbl) lbl.textContent = presenting ? 'EN VR' : 'ENTER VR';
  });
}
