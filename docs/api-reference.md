# API Reference

## MimicX Endpoints

### Prediction

```
POST https://model.mimicx.ai/api/v1/predict
Authorization: Bearer mx_live_...
Content-Type: application/json
```

**Request body :**

```json
{
  "model": "biometrix",
  "image": "<base64_jpeg>"
}
```

**Models disponibles :**

| Model | Usage |
|:------|:------|
| `biometrix` | Reconnaissance faciale, liveness |
| `emoticore` | Analyse de sentiment |
| `object_signature` | Reconnaissance de produits |

**Response attendue :**

```json
{
  "detections": [
    {
      "id": "face-0",
      "type": "face",
      "box": { "x": 0.12, "y": 0.08, "w": 0.15, "h": 0.20 },
      "label": "Client fréquent",
      "confidence": 0.92
    }
  ]
}
```

> Les coordonnées `box` sont normalisées (0-1). Utiliser `normalizedToScreen()` dans `utils/coordinates.js` pour convertir en pixels écran.

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

### services/mimicxClient

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `predict(base64Frame, model?)` | base64, model name | Appel API MimicX |

### utils/throttle

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `throttle(fn, interval)` | function, ms | Limite la fréquence d'exécution |

### utils/coordinates

| Fonction | Paramètres | Description |
|:---------|:-----------|:------------|
| `normalizedToScreen(box, screenW, screenH)` | coords 0-1 | Convertit en pixels |
| `videoToScreen(box, videoW, videoH, screenW, screenH)` | coords vidéo | Compense le object-fit: cover |
