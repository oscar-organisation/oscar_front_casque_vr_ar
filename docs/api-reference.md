# API Reference

## Contrat d'overlay de vision

La perception ne s'exécute pas dans le navigateur. Un worker séparé souscrit à la
piste vidéo du robot, exécute l'inférence, et publie ses résultats sur le canal de
données LiveKit. Le cockpit ne fait que valider et dessiner.

| Élément | Valeur |
|:--|:--|
| Topic LiveKit | `oscar.vision.overlay` |
| Version de schéma | `oscar.vision.overlay.v1` |
| Fiabilité | non fiable : un paquet en retard est perdu, jamais mis en file |
| Péremption côté cockpit | 1200 ms (`VISION.STALE_AFTER_MS`) |
| Taille maximale | 1200 octets, pour tenir dans un MTU |

**Paquet reçu :**

```json
{
  "schema": "oscar.vision.overlay.v1",
  "robot_id": "...",
  "room": "...",
  "frame_timestamp_us": 1789145728000000,
  "frame_width": 640,
  "frame_height": 480,
  "model_id": "...",
  "model_name": "empty_shelf",
  "model_version": "1.0.0",
  "task": "detect",
  "detections": [
    {
      "detection_id": "a1b2c3",
      "label": "empty_shelf",
      "class_id": 0,
      "confidence": 0.87,
      "x": 0.12, "y": 0.08, "width": 0.15, "height": 0.20
    }
  ],
  "detections_total": 7
}
```

Les coordonnées sont normalisées entre 0 et 1 et validées des deux côtés : le
worker refuse une boîte qui sort de l'image, le cockpit borne les valeurs reçues.
`parseVisionPacket()` convertit ensuite en pixels écran via `videoToScreen()`,
qui compense le recadrage `object-fit: cover`.

Quand le nombre de détections dépasse la taille d'un paquet, le worker conserve
les plus confiantes et renseigne `detections_total`. Un `detections_total`
supérieur au nombre de boîtes reçues signifie donc que certaines ont été écartées
au transport, pas qu'elles n'ont pas été détectées.

### Périmètre exclu

La reconnaissance faciale, l'identification de personnes et l'inférence
d'émotions sont **hors périmètre d'OSCAR**. Aucune donnée biométrique n'est
produite ni conservée. Les modèles activables portent sur l'état du magasin et
des produits.

Les versions antérieures de ce document décrivaient une API de prédiction côté
navigateur avec des modèles `biometrix` et `emoticore`. Ce chemin n'existe plus :
`src/services/mimicxClient.js` subsiste dans l'arborescence mais n'est importé
par aucun module.

## Modules internes

### capture/videoStream

| Fonction | Paramètres | Retour | Description |
|:---------|:-----------|:-------|:------------|
| `initVideoStream()` | — | `Promise<HTMLVideoElement \| null>` | Initialise le flux caméra |
| `captureFrame(video, canvas)` | video, offscreen canvas | `ImageData \| null` | Capture une frame |
| `frameToBase64(canvas, quality?)` | canvas, quality 0-1 | `string` | Encode en JPEG base64 |

### overlay/overlayEngine

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `initOverlayEngine()` | — | Initialise la scène Three.js |
| `createBoundingBox(id, x, y, w, h, label, color)` | coords écran, hex color | Crée un overlay |
| `removeBoundingBox(id)` | string | Supprime et dispose un overlay |
| `clearOverlays()` | — | Efface tous les overlays |
| `render()` | — | Rendu de la frame courante |
| `getOverlayCount()` | — | Nombre d'overlays actifs |

### overlay/detectionRenderer

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `renderDetections(detections[])` | tableau de détections | Efface et re-render tout |
| `renderSingleDetection(detection)` | une détection | Ajout incrémental |
| `removeDetection(id)` | string | Supprime une détection |

### hud/labelRenderer

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `setLabel(detection)` | objet detection | Crée ou met à jour un label DOM |
| `removeLabel(id)` | string | Supprime un label |
| `clearLabels()` | — | Efface tous les labels |
| `updateDetectionCount(count)` | number | Met à jour le compteur top bar |

### hud/statusManager

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `setStatus(key)` | clé STATUS | Met à jour le statut et le dot |
| `setCustomStatus(message)` | string | Message libre |
| `flashStatus(key, duration?)` | clé, ms | Statut temporaire |

### overlay/visionPacket

| Fonction | Paramètres | Retour | Description |
|:---------|:-----------|:-------|:------------|
| `parseVisionPacket(raw, viewport?)` | charge utile LiveKit, dimensions | `detection[]` | Valide le schéma, borne les coordonnées et convertit en pixels écran |

Rejette toute charge utile dont `schema` n'est pas `oscar.vision.overlay.v1`.
Câblé dans `core/app.js` sur le canal de données LiveKit.

### services/mimicxClient — hérité, non utilisé

Le fichier subsiste mais n'est importé par aucun module. La perception passe
désormais par le worker et le contrat d'overlay décrit plus haut.

### utils/throttle

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `throttle(fn, interval)` | function, ms | Limite la fréquence d'exécution |

### utils/coordinates

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `normalizedToScreen(box, screenW, screenH)` | coords 0-1 | Convertit en pixels |
| `videoToScreen(box, videoW, videoH, screenW, screenH)` | coords vidéo | Compense le object-fit: cover |
