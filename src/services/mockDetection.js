/**
 * Mock detection service — simulates MimicX API responses for local development.
 * Generates randomized face and product detections within viewport bounds.
 * Replace with real API integration when WebSocket/backend is ready.
 */

let nextId = 0;

const PRODUCT_CATEGORIES = [
  'Riz', 'Tomate', 'Déodorant spray', 'Lait', 'Pâtes',
  'Céréales', 'Savon', 'Jus d\'orange', 'Huile d\'olive', 'Biscuits',
];

const FACE_LABELS = [
  'Client inconnu', 'Client fréquent', 'Employé',
];

/**
 * Generates a set of mock detections.
 * @param {number} faceCount
 * @param {number} productCount
 * @returns {Array<Detection>}
 */
export function generateMockDetections(faceCount = 1, productCount = 2) {
  const detections = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (let i = 0; i < faceCount; i++) {
    detections.push({
      id: `face-${nextId++}`,
      type: 'face',
      box: {
        x: randomInRange(vw * 0.1, vw * 0.6),
        y: randomInRange(vh * 0.05, vh * 0.3),
        w: randomInRange(100, 180),
        h: randomInRange(120, 200),
      },
      label: FACE_LABELS[Math.floor(Math.random() * FACE_LABELS.length)],
      confidence: randomInRange(0.7, 0.99),
    });
  }

  for (let i = 0; i < productCount; i++) {
    detections.push({
      id: `product-${nextId++}`,
      type: 'product',
      box: {
        x: randomInRange(vw * 0.05, vw * 0.7),
        y: randomInRange(vh * 0.3, vh * 0.7),
        w: randomInRange(80, 150),
        h: randomInRange(80, 160),
      },
      label: PRODUCT_CATEGORIES[Math.floor(Math.random() * PRODUCT_CATEGORIES.length)],
      confidence: randomInRange(0.6, 0.95),
    });
  }

  return detections;
}

function randomInRange(min, max) {
  return Math.round(min + Math.random() * (max - min));
}
