/**
 * Mock detection service — simulates MimicX API responses.
 * Uses semi-stable positions to mimic real tracking behavior
 * (small drift per cycle instead of full randomization).
 */

const PRODUCT_CATEGORIES = [
  'Riz', 'Tomate', 'Déodorant spray', 'Lait', 'Pâtes',
  'Céréales', 'Savon', 'Jus d\'orange', 'Huile d\'olive', 'Biscuits',
];

const FACE_LABELS = [
  'Client inconnu', 'Client fréquent', 'Employé',
];

/** Persistent mock detections — positions drift slightly each cycle */
let trackedDetections = [];
let initialized = false;

/**
 * Generates semi-stable mock detections.
 * First call creates random positions, subsequent calls add small drift.
 * @param {number} faceCount
 * @param {number} productCount
 * @returns {Array<Detection>}
 */
export function generateMockDetections(faceCount = 1, productCount = 2) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!initialized) {
    trackedDetections = [];

    for (let i = 0; i < faceCount; i++) {
      trackedDetections.push({
        id: `face-${i}`,
        type: 'face',
        box: {
          x: randomInRange(vw * 0.2, vw * 0.5),
          y: randomInRange(vh * 0.05, vh * 0.25),
          w: randomInRange(120, 160),
          h: randomInRange(140, 180),
        },
        label: FACE_LABELS[Math.floor(Math.random() * FACE_LABELS.length)],
        confidence: randomFloat(0.78, 0.97),
        meta: {
          'Statut': 'Identifié',
          'Visites': `${randomInRange(1, 24)}`,
        },
      });
    }

    for (let i = 0; i < productCount; i++) {
      trackedDetections.push({
        id: `product-${i}`,
        type: 'product',
        box: {
          x: randomInRange(vw * 0.1, vw * 0.6),
          y: randomInRange(vh * 0.35, vh * 0.65),
          w: randomInRange(90, 130),
          h: randomInRange(100, 150),
        },
        label: PRODUCT_CATEGORIES[Math.floor(Math.random() * PRODUCT_CATEGORIES.length)],
        confidence: randomFloat(0.62, 0.93),
        meta: {
          'Rayon': `Allée ${randomInRange(1, 12)}`,
          'Stock': randomInRange(0, 50) > 40 ? 'Faible' : 'OK',
        },
      });
    }

    initialized = true;
  }

  // Apply small drift to simulate tracking jitter
  trackedDetections.forEach((d) => {
    d.box.x += randomInRange(-6, 6);
    d.box.y += randomInRange(-4, 4);
    // Slight confidence variation
    d.confidence = clamp(d.confidence + randomFloat(-0.02, 0.02), 0.5, 0.99);
  });

  return trackedDetections;
}

/** Resets tracked detections — forces new random positions next cycle */
export function resetMockDetections() {
  initialized = false;
  trackedDetections = [];
}

function randomInRange(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function randomFloat(min, max) {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
