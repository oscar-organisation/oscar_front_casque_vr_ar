import { VISION } from '../config/constants.js';
import { videoToScreen } from '../utils/coordinates.js';

const decoder = new TextDecoder();

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value)));
}

function detectionType(label, task) {
  if (/person|human|visage|face/i.test(`${label} ${task}`)) return 'person';
  if (/incident|dirty|floor|obstacle|danger|anomal/i.test(`${label} ${task}`)) return 'incident';
  return 'product';
}

export function parseVisionPacket(raw, viewport = {}) {
  const text = typeof raw === 'string' ? raw : decoder.decode(raw);
  const packet = JSON.parse(text);
  if (packet.schema !== VISION.SCHEMA || !Array.isArray(packet.detections)) {
    throw new TypeError('Contrat overlay OSCAR non reconnu');
  }

  const frameW = Math.max(1, Number(packet.frame_width) || 1);
  const frameH = Math.max(1, Number(packet.frame_height) || 1);
  const screenW = Math.max(1, Number(viewport.width) || window.innerWidth);
  const screenH = Math.max(1, Number(viewport.height) || window.innerHeight);

  return packet.detections.map((item, index) => {
    const normalizedBox = {
      x: clamp(item.x),
      y: clamp(item.y),
      w: clamp(item.width),
      h: clamp(item.height),
    };
    const sourceBox = {
      x: normalizedBox.x * frameW,
      y: normalizedBox.y * frameH,
      w: normalizedBox.w * frameW,
      h: normalizedBox.h * frameH,
    };
    return {
      id: item.detection_id || `${packet.model_id}-${index}`,
      type: detectionType(item.label, packet.task || ''),
      label: String(item.label || 'Détection'),
      confidence: clamp(item.confidence),
      box: videoToScreen(sourceBox, frameW, frameH, screenW, screenH),
      normalizedBox,
      meta: {
        model: packet.model_name,
        version: packet.model_version,
        frameTimestampUs: packet.frame_timestamp_us,
      },
    };
  });
}
