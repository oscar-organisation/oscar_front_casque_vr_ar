/**
 * XR teleoperation input publisher.
 *
 * Samples headset pose and controller inputs from WebXR frames, then publishes
 * compact lossy packets through LiveKit for robot/ROS consumers.
 */

import { TELEOPERATION } from '../config/constants.js';
import { publishDataPacket } from '../capture/livekitStream.js';

const MS_PER_SAMPLE = 1000 / TELEOPERATION.XR_INPUT_PUBLISH_HZ;

let lastPublishAt = 0;
let sequence = 0;
let latestSnapshot = null;
const listeners = new Set();

export function onXRInputPacket(listener) {
  listeners.add(listener);
  if (latestSnapshot) listener(latestSnapshot);
  return () => listeners.delete(listener);
}

export function getLatestXRInputSnapshot() {
  return latestSnapshot;
}

/**
 * Samples the current WebXR frame and publishes a teleoperation packet.
 * @param {number} timestamp - WebXR animation timestamp.
 * @param {XRFrame} frame
 * @param {XRReferenceSpace} referenceSpace
 * @returns {boolean} true when a packet was queued for publishing.
 */
export function publishXRInputFrame(timestamp, frame, referenceSpace) {
  if (!frame || !referenceSpace) return false;
  if (timestamp - lastPublishAt < MS_PER_SAMPLE) return false;

  lastPublishAt = timestamp;

  const payload = buildXRInputPayload(timestamp, frame, referenceSpace);
  if (!payload) return false;

  return publishInputPayload(payload);
}

/**
 * Builds the packet consumed by the ROS bridge.
 * Short keys keep packets small for low-latency lossy delivery.
 */
export function buildXRInputPayload(timestamp, frame, referenceSpace) {
  const viewerPose = frame.getViewerPose(referenceSpace);

  return {
    v: 1,
    type: 'xr-input',
    source: 'webxr',
    seq: sequence++,
    t: round(timestamp),
    sentAtMs: Date.now(),
    head: viewerPose ? transformToPacket(viewerPose.transform) : null,
    controllers: readControllers(frame, referenceSpace),
  };
}

/**
 * Publishes keyboard/gamepad controllers using the same wire contract as WebXR.
 * Keeping one packet shape lets Isaac retain a single safety and mapping path.
 */
export function publishDesktopInput(controllers, source, timestamp = performance.now()) {
  return publishInputPayload({
    v: 1,
    type: 'xr-input',
    source,
    seq: sequence++,
    t: round(timestamp),
    sentAtMs: Date.now(),
    head: null,
    controllers,
  });
}

function publishInputPayload(payload) {
  const published = publishDataPacket(TELEOPERATION.XR_INPUT_TOPIC, payload, {
    reliable: false,
  });
  emitSnapshot(payload, published);
  return published;
}

function readControllers(frame, referenceSpace) {
  const controllers = [];

  for (const input of frame.session.inputSources) {
    const gamepad = input.gamepad;
    const targetPose = input.targetRaySpace
      ? frame.getPose(input.targetRaySpace, referenceSpace)
      : null;
    const gripPose = input.gripSpace
      ? frame.getPose(input.gripSpace, referenceSpace)
      : null;

    controllers.push({
      hand: input.handedness || 'none',
      mode: input.targetRayMode || 'unknown',
      axes: gamepad ? Array.from(gamepad.axes, round) : [],
      buttons: gamepad ? gamepad.buttons.map(buttonToPacket) : [],
      target: targetPose ? transformToPacket(targetPose.transform) : null,
      grip: gripPose ? transformToPacket(gripPose.transform) : null,
    });
  }

  return controllers;
}

function buttonToPacket(button) {
  return {
    p: !!button.pressed,
    t: !!button.touched,
    v: round(button.value || 0),
  };
}

function transformToPacket(transform) {
  return {
    p: [
      round(transform.position.x),
      round(transform.position.y),
      round(transform.position.z),
    ],
    q: [
      round(transform.orientation.x),
      round(transform.orientation.y),
      round(transform.orientation.z),
      round(transform.orientation.w),
    ],
  };
}

function emitSnapshot(payload, published) {
  latestSnapshot = {
    at: Date.now(),
    topic: TELEOPERATION.XR_INPUT_TOPIC,
    reliable: false,
    publishHz: TELEOPERATION.XR_INPUT_PUBLISH_HZ,
    published,
    payload,
    summary: summarizePayload(payload),
  };

  for (const listener of listeners) listener(latestSnapshot);
}

function summarizePayload(payload) {
  return {
    source: payload.source || 'webxr',
    seq: payload.seq,
    time: payload.t,
    head: summarizeTransform(payload.head),
    controllers: payload.controllers.map((controller) => ({
      hand: controller.hand,
      mode: controller.mode,
      axes: controller.axes,
      buttons: controller.buttons.map((button, index) => ({
        index,
        pressed: button.p,
        touched: button.t,
        value: button.v,
      })),
      target: summarizeTransform(controller.target),
      grip: summarizeTransform(controller.grip),
    })),
  };
}

function summarizeTransform(transform) {
  if (!transform) return null;
  return {
    position: transform.p,
    quaternion: transform.q,
    rotationDeg: quaternionToEulerDeg(transform.q),
  };
}

function quaternionToEulerDeg(quaternion) {
  const [x, y, z, w] = quaternion;
  const sinrCosp = 2 * (w * x + y * z);
  const cosrCosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1
    ? Math.sign(sinp) * Math.PI / 2
    : Math.asin(sinp);

  const sinyCosp = 2 * (w * z + x * y);
  const cosyCosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return [roll, pitch, yaw].map((value) => round(value * 180 / Math.PI));
}

function round(value) {
  const factor = 10 ** TELEOPERATION.XR_INPUT_DECIMALS;
  return Math.round(Number(value || 0) * factor) / factor;
}
