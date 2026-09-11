/** Desktop keyboard/gamepad input published through the WebXR command contract. */

import { TELEOPERATION } from '../config/constants.js';
import { publishDesktopInput } from './xrInputPublisher.js';
import { buildControllers, readGamepadInput, readKeyboardInput } from './desktopInputMapping.mjs';

const CONTROL_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
  'Space', 'ShiftLeft', 'ShiftRight', 'Escape',
]);
const keysDown = new Set();

let timer = null;
let publishing = false;
let presentingXR = false;

export function initDesktopInputPublisher() {
  if (timer !== null) return;

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  window.addEventListener('gamepadconnected', onGamepadConnected);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

  const periodMs = 1000 / TELEOPERATION.XR_INPUT_PUBLISH_HZ;
  timer = window.setInterval(sampleAndPublish, periodMs);
}

export function setDesktopInputSuspended(suspended) {
  presentingXR = !!suspended;
  if (presentingXR) releaseAll();
}

export function stopDesktopInputPublisher() {
  releaseAll();
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', releaseAll);
  window.removeEventListener('pagehide', releaseAll);
  window.removeEventListener('gamepadconnected', onGamepadConnected);
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
}

function onKeyDown(event) {
  if (!CONTROL_KEYS.has(event.code) || isEditableTarget(event.target)) return;
  event.preventDefault();
  if (event.code === 'Escape') {
    releaseAll();
    return;
  }
  keysDown.add(event.code);
  sampleAndPublish();
}

function onKeyUp(event) {
  if (!CONTROL_KEYS.has(event.code) || isEditableTarget(event.target)) return;
  event.preventDefault();
  keysDown.delete(event.code);
  sampleAndPublish();
}

function releaseAll() {
  keysDown.clear();
  if (!publishing) return;
  publishDesktopInput(buildControllers(0, 0, 0, false), 'desktop-release');
  publishing = false;
}

function sampleAndPublish() {
  if (presentingXR || document.body.classList.contains('xr-active')) {
    releaseAll();
    return;
  }

  const gamepad = readGamepadInput(navigator.getGamepads?.() || []);
  const keyboard = readKeyboardInput(keysDown);
  const input = gamepad?.deadman ? gamepad : keyboard;

  if (input.deadman) {
    publishDesktopInput(
      buildControllers(input.leftX, input.leftY, input.rightX, true, input.gamepad),
      input.source,
    );
    publishing = true;
    return;
  }

  if (publishing) releaseAll();
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  return target.matches('input, textarea, select, button, [contenteditable="true"]');
}

export { buildControllers, readGamepadInput, readKeyboardInput };

function onGamepadConnected(event) {
  console.info(`[Teleop] Gamepad connected: ${event.gamepad.id}`);
}

function onGamepadDisconnected(event) {
  console.info(`[Teleop] Gamepad disconnected: ${event.gamepad.id}`);
  releaseAll();
}
