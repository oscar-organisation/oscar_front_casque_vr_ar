import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVisionPacket } from './visionPacket.js';

test('maps normalized worker boxes to a covered video viewport', () => {
  const packet = new TextEncoder().encode(JSON.stringify({
    schema: 'oscar.vision.overlay.v1',
    model_id: 'm1', model_name: 'Retail', model_version: '1.0',
    frame_width: 640, frame_height: 480, frame_timestamp_us: 10,
    detections: [{ detection_id: 'd1', label: 'produit', class_id: 0, confidence: 0.9, x: 0.1, y: 0.2, width: 0.3, height: 0.4 }],
  }));
  const [detection] = parseVisionPacket(packet, { width: 640, height: 480 });
  assert.deepEqual(detection.box, { x: 64, y: 96, w: 192, h: 192 });
  assert.deepEqual(detection.normalizedBox, { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
});

test('rejects unknown packet schemas', () => {
  assert.throws(() => parseVisionPacket(JSON.stringify({ schema: 'other', detections: [] }), { width: 1, height: 1 }));
});
