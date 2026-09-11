/** Application-wide constants and configuration */

import { bootstrapLiveKitSession, decodeJwtClaims, isJwtExpired } from './sessionBootstrap.js';

export const APP = {
  NAME: 'OSCAR',
  FULL_NAME: 'O.S.C.A.R.',
  VERSION: '0.2.0',
  CODENAME: 'RETAIL-BOT',
};

export const OVERLAY = {
  DEFAULT_COLOR: 0x00f0ff,
  FACE_COLOR: 0x4a9eff,
  PRODUCT_COLOR: 0xffaa00,
  FILL_OPACITY: 0.08,
  BORDER_WIDTH: 2,
  Z_DEPTH: 500,
};

export const HUD = {
  FADE_DURATION: 300,
  STATUS_TIMEOUT: 3000,
  TELEMETRY_REFRESH_MS: 1000,
  METRICS_REFRESH_MS: 1000,
};

export const FEATURES = {
  // Demo detections and simulated telemetry must be explicitly enabled.
  MOCK_OVERLAYS: import.meta.env.VITE_ENABLE_MOCK_OVERLAYS === 'true',
  // Connection/input diagnostics obscure the operator view, especially in VR.
  DIAGNOSTIC_OVERLAYS: import.meta.env.VITE_ENABLE_DIAGNOSTIC_OVERLAYS === 'true',
};

export const API = {
  MIMICX_ENDPOINT: 'https://model.mimicx.ai/api/v1/predict',
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RETRIES: 5,
};

/**
 * Session-link overrides (option A — dynamic tokens from the Session Service).
 * The backend issues short-lived per-operator tokens; the operator opens
 * https://oscar-bot.vercel.app/#token=<JWT>&url=<wss>&room=<name>
 * The fragment is imported into sessionStorage and scrubbed immediately. It
 * takes precedence over the baked development token.
 */
const session = bootstrapLiveKitSession();

function inferPublisherIdentity(room) {
  const match = String(room || '').match(/^oscar-(oscar-\d+)(?:-|$)/);
  return match ? `robot-${match[1]}` : '';
}

function roomFromToken(token) {
  return decodeJwtClaims(token)?.video?.room || '';
}

const bakedToken = import.meta.env.VITE_LIVEKIT_TOKEN || '';
const livekitToken = session.token || (isJwtExpired(bakedToken) ? '' : bakedToken);
const livekitRoom = session.room
  || roomFromToken(livekitToken)
  || import.meta.env.VITE_LIVEKIT_ROOM
  || 'oscar-lot1-room';

export const LIVEKIT = {
  URL: session.url || import.meta.env.VITE_LIVEKIT_URL || '',
  ROOM: livekitRoom,
  TOKEN: livekitToken,
  PREFERRED_PUBLISHER: session.publisher
    || import.meta.env.VITE_LIVEKIT_PREFERRED_PUBLISHER
    || '',
  ROOM_PUBLISHER: inferPublisherIdentity(livekitRoom),
  AUTO_SUBSCRIBE: true,
  // The subscribed video element is hidden and sampled as a WebGL texture.
  // Adaptive stream would interpret its DOM size as zero and pause binding.
  ADAPTIVE_STREAM: false,
  DYNACAST: true,
};

export const TELEOPERATION = {
  XR_INPUT_TOPIC: 'oscar.xr.input',
  XR_INPUT_PUBLISH_HZ: 30,
  XR_INPUT_DECIMALS: 4,
};

export const IMMERSIVE_VIDEO = {
  FORCE_EQUIRECT: import.meta.env.VITE_FORCE_IMMERSIVE_360 === 'true',
  REQUIRE_EQUIRECT_IN_VR: import.meta.env.VITE_REQUIRE_IMMERSIVE_360 === 'true',
};
