# OSCAR WebXR Cockpit

Client opérateur 2D et WebXR pour la supervision et la téléopération des robots
OSCAR. Il reçoit les médias LiveKit, projette les formats caméra adaptés au
casque et publie les commandes opérateur sur le data channel temps réel.

## Responsabilités

- connexion à une session courte fournie par le Control Plane ;
- rendu vidéo plat, fisheye, VR180 et equirectangulaire ;
- acquisition manette, clavier et contrôleurs WebXR ;
- publication des commandes sur `oscar.xr.input` ;
- métriques de transport et affichage opérateur.

La création de jetons, les scripts Isaac Sim et le runtime physique ne vivent
pas dans ce dépôt. Ils sont maintenus respectivement dans le Control Plane, le
simulateur et le gateway de l'organisation OSCAR.

## Développement

```bash
npm ci
npm run dev
npm run build
```

Le cockpit attend une URL de session générée par la plateforme. Aucun jeton
LiveKit ne doit être ajouté à `.env`, au code source ou au bundle versionné.
