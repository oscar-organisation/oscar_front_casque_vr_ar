/**
 * Ou renvoyer l'operateur qui quitte le cockpit.
 *
 * La console ouvre le cockpit par `location.assign`, dans le meme onglet :
 * l'historique porte donc la page d'ou l'on vient. On ne l'emprunte que si
 * elle est de la meme origine, pour ne pas renvoyer l'operateur sur un site
 * tiers d'un simple clic sur « Quitter ». Sinon la racine fait l'affaire : le
 * cockpit est servi par la console elle-meme, sous /xr/.
 */
export function cibleDeSortie(referrer, origine, longueurHistorique) {
  let memeOrigine = false;
  try {
    memeOrigine = Boolean(referrer) && new URL(referrer).origin === origine;
  } catch (_) {
    memeOrigine = false;
  }
  return memeOrigine && longueurHistorique > 1 ? 'retour' : 'racine';
}
