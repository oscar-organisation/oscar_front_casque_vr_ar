# Guide de développement

## Installation

```bash
git clone https://github.com/jael99/OSCAR.git
cd OSCAR
npm install
```

## Variables d'environnement

Créer un fichier `.env` à la racine :

```
VITE_MIMICX_API_KEY=mx_test_...
```

> Vite expose uniquement les variables préfixées `VITE_` au code client.

## Commandes

| Commande | Description |
|:---------|:------------|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Preview du build de production |
| `npm run docs:api` | Génère la documentation JSDoc dans `docs/api/` |
| `npm run docs:serve` | Lance le serveur Docsify local (port 3000) |

## Conventions

### Git

- Branches : `main` (stable), `frontend`, `backend`
- Commits : conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- Pas de force push sur `main`

### Code

- ES6 modules, pas de CommonJS
- JSDoc sur toutes les fonctions exportées
- Constantes dans `config/constants.js`
- Un module = une responsabilité

### CSS

- Custom properties dans `:root` pour les tokens
- Nommage BEM pour les classes HUD (`detection-label__tag--face`)
- Z-index : video (1), three.js (2), hud (3)

## Mode mock

Par défaut, l'application utilise `services/mockDetection.js` qui génère des détections aléatoires toutes les 2 secondes. Pour connecter l'API réelle, remplacer l'import dans `core/app.js` :

```js
// Remplacer :
import { generateMockDetections } from '../services/mockDetection.js';

// Par l'intégration API réelle via mimicxClient.js
```

## Génération de documentation

### JSDoc (référence code)

```bash
npm run docs:api
```

Génère un site statique dans `docs/api/` à partir des commentaires `/** */`.

### Docsify (documentation projet)

```bash
npm run docs:serve
```

Sert les fichiers markdown de `docs/` comme un site navigable.
