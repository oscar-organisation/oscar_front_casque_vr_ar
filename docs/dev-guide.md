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
VITE_LIVEKIT_URL=wss://votre-serveur-livekit.example.com
VITE_LIVEKIT_ROOM=oscar-lot1-room
VITE_LIVEKIT_TOKEN=token_livekit_operateur
VITE_FORCE_IMMERSIVE_360=false
VITE_REQUIRE_IMMERSIVE_360=false
```

> Vite expose uniquement les variables préfixées `VITE_` au code client.
> Le token LiveKit doit autoriser la publication de données (`canPublishData`) pour transmettre les commandes XR.
> Pour tester une vidéo LiveKit préchargée comme sphère 360, lancer l'app avec `?force360=1` ou `VITE_FORCE_IMMERSIVE_360=true`.
> Pour refuser l'entrée VR si le flux n'est pas déclaré 360, utiliser `?require360=1` ou `VITE_REQUIRE_IMMERSIVE_360=true`.

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

## Téléopération XR vers LiveKit

Lorsque l'utilisateur entre en VR, le front lit les données WebXR du casque et des contrôleurs puis les publie dans la room LiveKit.

| Élément | Valeur |
|:--------|:-------|
| Topic LiveKit | `oscar.xr.input` |
| Fréquence | 30 Hz |
| Mode | `reliable: false` |
| Source | casque + contrôleurs WebXR |

Format du paquet :

```json
{
  "v": 1,
  "type": "xr-input",
  "seq": 42,
  "t": 123456.7,
  "head": {
    "p": [0.01, 1.62, -0.04],
    "q": [0, 0.12, 0, 0.99]
  },
  "controllers": [
    {
      "hand": "left",
      "mode": "tracked-pointer",
      "axes": [0, 0, -0.1, 0.8],
      "buttons": [{ "p": false, "t": false, "v": 0 }],
      "target": { "p": [0, 1.4, -0.3], "q": [0, 0, 0, 1] },
      "grip": { "p": [-0.2, 1.2, -0.2], "q": [0, 0, 0, 1] }
    }
  ]
}
```

Le bridge ROS doit se connecter comme participant LiveKit à la même room, écouter `DataReceived`, filtrer le topic `oscar.xr.input`, puis convertir les champs `head`, `axes`, `buttons`, `target` et `grip` en messages ROS.

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
