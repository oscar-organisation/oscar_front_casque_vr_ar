import { onXRInputPacket } from '../teleoperation/xrInputPublisher.js';

const ids = {
  state: 'xr-input-state',
  topic: 'xr-input-topic',
  seq: 'xr-input-seq',
  rate: 'xr-input-rate',
  headPos: 'xr-input-head-pos',
  headRot: 'xr-input-head-rot',
  leftAxes: 'xr-input-left-axes',
  leftButtons: 'xr-input-left-buttons',
  rightAxes: 'xr-input-right-axes',
  rightButtons: 'xr-input-right-buttons',
};

const els = {};

export function initXRInputMonitor() {
  for (const [key, id] of Object.entries(ids)) {
    els[key] = document.getElementById(id);
  }

  renderWaitingState();
  onXRInputPacket(renderSnapshot);
}

function renderWaitingState() {
  setText('state', 'EN ATTENTE VR');
  setText('topic', '—');
  setText('seq', '—');
  setText('rate', '—');
  setText('headPos', '—');
  setText('headRot', '—');
  setText('leftAxes', '—');
  setText('leftButtons', '—');
  setText('rightAxes', '—');
  setText('rightButtons', '—');
}

function renderSnapshot(snapshot) {
  const { summary } = snapshot;
  const left = findController(summary.controllers, 'left');
  const right = findController(summary.controllers, 'right');

  const source = formatSource(summary.source);
  setText('state', snapshot.published ? `TRANSMIS · ${source}` : 'NON CONNECTÉ');
  els.state?.setAttribute('data-xr-published', snapshot.published ? '1' : '0');
  setText('topic', snapshot.topic);
  setText('seq', `#${summary.seq}`);
  setText('rate', `${snapshot.publishHz} Hz · ${snapshot.reliable ? 'fiable' : 'low latency'}`);
  setText('headPos', formatVector(summary.head?.position, 'm'));
  setText('headRot', formatRotation(summary.head?.rotationDeg));
  setText('leftAxes', formatAxes(left?.axes));
  setText('leftButtons', formatButtons(left?.buttons));
  setText('rightAxes', formatAxes(right?.axes));
  setText('rightButtons', formatButtons(right?.buttons));
}

function formatSource(source) {
  if (source === 'desktop-gamepad') return 'MANETTE';
  if (source === 'desktop-keyboard') return 'CLAVIER';
  if (source === 'desktop-release') return 'ARRÊT';
  return 'CASQUE';
}

function findController(controllers, hand) {
  return controllers.find((controller) => controller.hand === hand)
    || controllers.find((controller) => controller.hand === 'none')
    || null;
}

function formatVector(vector, suffix = '') {
  if (!vector) return '—';
  return `x ${formatNumber(vector[0])}${suffix} · y ${formatNumber(vector[1])}${suffix} · z ${formatNumber(vector[2])}${suffix}`;
}

function formatRotation(rotation) {
  if (!rotation) return '—';
  return `roll ${formatNumber(rotation[0])}° · pitch ${formatNumber(rotation[1])}° · yaw ${formatNumber(rotation[2])}°`;
}

function formatAxes(axes) {
  if (!axes?.length) return '—';
  return axes.map((axis, index) => `a${index}:${formatNumber(axis)}`).join(' ');
}

function formatButtons(buttons) {
  if (!buttons?.length) return '—';
  const active = buttons.filter((button) => button.pressed || button.touched || button.value > 0.02);
  if (!active.length) return 'repos';
  return active.map((button) => `b${button.index}:${button.pressed ? 'P' : button.touched ? 'T' : formatNumber(button.value)}`).join(' ');
}

function formatNumber(value) {
  return Number(value || 0).toFixed(3);
}

function setText(key, value) {
  if (els[key]) els[key].textContent = value;
}
