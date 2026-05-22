# Architecture

## Vue d'ensemble

Le système suit un pipeline temps réel en 3 couches superposées dans le viewport :

```
z-index 1 : Video Feed      ← flux robot LiveKit
z-index 1/4 : XR Scene       ← écran cinéma ou sphère 360 en VR
z-index 2 : Three.js Canvas  ← bounding boxes 3D (WebGL)
z-index 3 : HUD DOM          ← labels, status bar (HTML/CSS)
```

## Structure des modules

```
src/
├── main.js                  # Point d'entrée
├── core/
│   └── app.js               # Init, boucle de rendu, cycle de détection
├── capture/
│   ├── captureSource.js     # Source active du flux robot
│   └── livekitStream.js     # Connexion LiveKit audio/vidéo/data
├── immersive/
│   └── xrScene.js           # Scène WebXR, projection flat/360
├── overlay/
│   ├── overlayEngine.js      # Scène Three.js, caméra orthographique, bounding boxes
│   └── detectionRenderer.js  # Mapping détections → overlays 3D + labels DOM
├── hud/
│   ├── statusManager.js      # Barre de statut (état système)
│   └── labelRenderer.js      # Labels 2D positionnés sur les détections
├── teleoperation/
│   └── xrInputPublisher.js   # Casque/contrôleurs WebXR → LiveKit Data
├── services/
│   ├── mimicxClient.js       # Client API MimicX (Biometrix, Darwin)
│   └── mockDetection.js      # Détections simulées (développement local)
├── utils/
│   ├── throttle.js           # Limitation de fréquence d'appels
│   └── coordinates.js        # Transformations écran ↔ vidéo ↔ Three.js
└── config/
    └── constants.js          # Constantes applicatives
```

## Pipeline de détection

```
Flux robot LiveKit → <video> → HUD/overlay/XR
Session WebXR → casque + contrôleurs → LiveKit Data topic `oscar.xr.input` → bridge ROS

Caméra / frame vidéo → captureFrame() → base64 → MimicX API → détections[]
                                                      │
                                    ┌─────────────────┤
                                    ▼                  ▼
                            overlayEngine        labelRenderer
                          (bounding boxes)     (labels DOM 2D)
```

### Cycle de rendu

1. `requestAnimationFrame` boucle à ~60fps
2. `processDetections()` est throttlé à 1 appel / 2s (limite API)
3. Chaque cycle efface les overlays précédents et re-render
4. `render()` dessine la scène Three.js

## Choix techniques

### Pourquoi vanilla JS (pas de React/Next.js)

- Pas de routing, pas de SSR, pas de SEO
- Le virtual DOM ajouterait du overhead sans bénéfice pour du rendu 60fps
- Contrôle direct sur le WebGL et le DOM
- Chaque milliseconde compte sur un navigateur de casque

### Pourquoi les labels sont en DOM (pas en Three.js)

- Le texte DOM est plus net que le texte rendu en WebGL
- Plus performant pour des éléments 2D simples
- CSS transitions natives pour les animations
- Pas besoin de gérer les textures de police

### Pourquoi une caméra orthographique

- Les overlays AR sont des éléments plats (pas de profondeur)
- Pas de distorsion de perspective sur les bounding boxes
- Mapping direct entre coordonnées écran et coordonnées 3D
