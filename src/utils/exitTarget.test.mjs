import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cibleDeSortie } from './exitTarget.js';

const CONSOLE = 'https://admin-console.oscar-bot.com';

test('revient en arriere quand la console a ouvert le cockpit', () => {
  assert.equal(cibleDeSortie(`${CONSOLE}/operations/cockpit`, CONSOLE, 3), 'retour');
});

test('ne renvoie jamais vers une origine etrangere', () => {
  // Un lien recu par message ou par mail amenerait sinon l'operateur ailleurs
  // que dans la plateforme, sur simple clic sur « Quitter ».
  assert.equal(cibleDeSortie('https://exemple.test/quelque-part', CONSOLE, 3), 'racine');
});

test('retombe sur la racine sans historique', () => {
  assert.equal(cibleDeSortie(`${CONSOLE}/operations/cockpit`, CONSOLE, 1), 'racine');
});

test('retombe sur la racine sans provenance connue', () => {
  // Cockpit ouvert directement, ou provenance masquee par la politique de
  // referrer : la racine est servie par la console elle-meme.
  assert.equal(cibleDeSortie('', CONSOLE, 5), 'racine');
});

test('une provenance illisible ne fait pas echouer la sortie', () => {
  assert.equal(cibleDeSortie('pas-une-url', CONSOLE, 5), 'racine');
});
