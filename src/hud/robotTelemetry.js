/**
 * Robot telemetry — simulates live battery / signal / temperature / mode
 * coming from the OSCAR robot. Real values will arrive via LiveKit DataChannel
 * once Lot 1.1 (ROS bridge) is wired.
 */

const els = () => ({
  battery: document.getElementById('telemetry-battery'),
  batteryBar: document.getElementById('telemetry-battery-bar'),
  signal: document.getElementById('telemetry-signal'),
  temp: document.getElementById('telemetry-temp'),
  mode: document.getElementById('telemetry-mode'),
  location: document.getElementById('telemetry-location'),
});

const state = {
  battery: 87,
  signal: 4,
  temp: 38.2,
  mode: 'TÉLÉOPÉRATION',
  location: 'Allée 4 · Rayon Frais',
};

const LOCATIONS = [
  'Allée 4 · Rayon Frais',
  'Allée 7 · Petit Déjeuner',
  'Allée 2 · Hygiène',
  'Caisse principale',
  'Réserve · Quai 3',
];

let timer = null;
let locationTimer = null;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function render() {
  const e = els();
  if (!e.battery) return;

  e.battery.textContent = `${state.battery.toFixed(0)}%`;
  e.batteryBar.style.width = `${state.battery}%`;
  e.batteryBar.classList.toggle('low', state.battery < 20);
  e.batteryBar.classList.toggle('warn', state.battery < 40 && state.battery >= 20);

  e.signal.dataset.bars = state.signal;
  e.temp.textContent = `${state.temp.toFixed(1)}°C`;
  e.mode.textContent = state.mode;
  e.location.textContent = state.location;
}

function tick() {
  // Battery slowly drains (0.05% per tick → ~16h to empty, realistic feel)
  state.battery = clamp(state.battery - 0.05 + (Math.random() - 0.5) * 0.02, 0, 100);
  // Temp drifts within plausible range
  state.temp = clamp(state.temp + (Math.random() - 0.5) * 0.4, 32, 55);
  // Signal flicker
  if (Math.random() < 0.06) state.signal = clamp(state.signal + (Math.random() < 0.5 ? -1 : 1), 1, 5);
  render();
}

export function startRobotTelemetry() {
  render();
  clearInterval(timer);
  clearInterval(locationTimer);
  timer = setInterval(tick, 1000);
  locationTimer = setInterval(() => {
    state.location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    render();
  }, 12000);
}

export function setRobotMode(mode) {
  state.mode = mode;
  render();
}

export function stopRobotTelemetry() {
  clearInterval(timer);
  clearInterval(locationTimer);
  timer = null;
  locationTimer = null;
}
