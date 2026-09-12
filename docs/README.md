# O.S.C.A.R.

**Operating System & Control Architecture for Robotics**

Système de réalité augmentée intelligent pour le retail, développé en partenariat avec MimicX AI.

## Aperçu

OSCAR est un système AR qui, à travers un casque VR/AR, permet de :

- **Reconnaître les visages** des clients (identification, sentiment)
- **Identifier les produits** en rayon par catégorie
- **Afficher des informations contextuelles** en superposition sur le flux vidéo
- **Assister l'employé** via Darwin (LLM conversationnel)

## Stack technique

| Couche | Technologies |
|:-------|:-------------|
| Capture | WebRTC `getUserMedia`, piste vidéo LiveKit du robot |
| Intelligence | Worker de perception externe, Ultralytics, contrat `oscar.vision.overlay.v1` |
| Rendu | Three.js, WebGL, DOM HUD |
| Build | Vite |
| Déploiement | distribute.app |

## Démarrage rapide

```bash
npm install
npm run dev
```

L'application s'ouvre sur `http://localhost:5173` et demande l'accès caméra.
