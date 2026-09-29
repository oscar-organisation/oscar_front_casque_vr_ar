/**
 * Bouton de sortie du cockpit.
 *
 * Le cockpit n'avait aucune issue. Une fois ouvert, on y restait : ni retour
 * vers la console, ni sortie de la session immersive. Le seul recours etait la
 * fleche du navigateur, ou le menu systeme du casque.
 *
 * Un seul bouton pour les deux, parce que l'intention est la meme : remonter
 * d'un cran. En immersion il ferme la session et rend la page plate ; hors
 * immersion il quitte le cockpit et revient a la console.
 */

import { exitVR, onXRStateChange } from '../immersive/xrScene.js';
import { cibleDeSortie } from '../utils/exitTarget.js';

const LIBELLES = {
  immersion: { texte: 'QUITTER LA VR', aide: 'Fermer la session immersive' },
  cockpit: { texte: 'QUITTER', aide: 'Revenir a la console' },
};

function quitterLeCockpit() {
  const cible = cibleDeSortie(document.referrer, window.location.origin, window.history.length);
  if (cible === 'retour') {
    window.history.back();
    return;
  }
  window.location.assign('/');
}

export function initExitButton() {
  const btn = document.getElementById('exit-button');
  const lbl = document.getElementById('exit-button-label');
  if (!btn) return;

  let enImmersion = false;

  btn.addEventListener('click', async () => {
    if (enImmersion) {
      await exitVR();
      return;
    }
    quitterLeCockpit();
  });

  onXRStateChange(({ presenting }) => {
    enImmersion = Boolean(presenting);
    const libelle = enImmersion ? LIBELLES.immersion : LIBELLES.cockpit;
    if (lbl) lbl.textContent = libelle.texte;
    btn.setAttribute('aria-label', libelle.aide);
    btn.title = libelle.aide;
  });
}
