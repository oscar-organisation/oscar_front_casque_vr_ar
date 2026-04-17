/** Connection metrics — bitrate / fps / resolution / latency from LiveKit. */

import { onStateChange, ConnectionState, ConnectionQuality } from '../capture/livekitStream.js';

const els = () => ({
  state: document.getElementById('metrics-state'),
  quality: document.getElementById('metrics-quality'),
  resolution: document.getElementById('metrics-resolution'),
  fps: document.getElementById('metrics-fps'),
  bitrate: document.getElementById('metrics-bitrate'),
  participants: document.getElementById('metrics-participants'),
  room: document.getElementById('metrics-room'),
  identity: document.getElementById('metrics-identity'),
  publisher: document.getElementById('metrics-publisher'),
});

const STATE_LABEL = {
  [ConnectionState.Disconnected]: 'OFFLINE',
  [ConnectionState.Connecting]: 'CONNEXION',
  [ConnectionState.Connected]: 'CONNECTÉ',
  [ConnectionState.Reconnecting]: 'RECONNEXION',
  [ConnectionState.SignalReconnecting]: 'SIGNAL',
};

const QUALITY_LABEL = {
  [ConnectionQuality.Excellent]: 'EXCELLENT',
  [ConnectionQuality.Good]: 'BON',
  [ConnectionQuality.Poor]: 'FAIBLE',
  [ConnectionQuality.Lost]: 'PERDU',
  [ConnectionQuality.Unknown]: '—',
};

function formatBitrate(bps) {
  if (!bps || bps < 1000) return '0 kbps';
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(0)} kbps`;
  return `${(bps / 1_000_000).toFixed(2)} Mbps`;
}

function render(state) {
  const e = els();
  if (!e.state) return;

  const lbl = STATE_LABEL[state.connectionState] ?? state.connectionState ?? '—';
  e.state.textContent = lbl;
  e.state.dataset.connState = state.connectionState;

  e.quality.textContent = QUALITY_LABEL[state.connectionQuality] ?? '—';
  e.quality.dataset.quality = state.connectionQuality;

  e.resolution.textContent =
    state.videoWidth && state.videoHeight ? `${state.videoWidth}×${state.videoHeight}` : '—';
  e.fps.textContent = state.fps ? `${Math.round(state.fps)} fps` : '—';
  e.bitrate.textContent = formatBitrate(state.bitrateBps);

  e.participants.textContent = state.participantsCount ?? 0;
  e.room.textContent = state.roomName ?? '—';
  e.identity.textContent = state.participantIdentity ?? '—';
  if (e.publisher) {
    e.publisher.textContent = state.activePublisher
      ? shortenPublisher(state.activePublisher)
      : '—';
  }
}

function shortenPublisher(id) {
  if (id.startsWith('simulateur-robot-')) return id.replace('simulateur-robot-', 'ROBOT · ').toUpperCase();
  if (id.includes('media-simulator')) return 'MP4 (FALLBACK)';
  return id.toUpperCase();
}

export function startConnectionMetrics() {
  onStateChange(render);
}
