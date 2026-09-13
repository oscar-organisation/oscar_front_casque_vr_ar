/** Application-wide constants and configuration */

import { bootstrapLiveKitSession, decodeJwtClaims, isJwtExpired } from './sessionBootstrap.js';

const ENV = import.meta.env || {};

export const APP = {
  NAME: 'OSCAR',
  FULL_NAME: 'O.S.C.A.R.',
  VERSION: '0.2.0',
  CODENAME: 'RETAIL-BOT',
};

export const OVERLAY = {
  DEFAULT_COLOR: 0xe7e3dc,
  PERSON_COLOR: 0x9bb8a4,
  FACE_COLOR: 0x9bb8a4,
  PRODUCT_COLOR: 0xd85810,
  INCIDENT_COLOR: 0xd98072,
  // Sur un sol clair, un remplissage a 3,5 % et un trait de 1 px disparaissaient.
  FILL_OPACITY: 0.14,
  // Epaisseurs en pixels ecran. WebGL ignore `linewidth` : les traits sont donc
  // construits en quadrilateres, seule facon d'obtenir une vraie epaisseur.
  BORDER_WIDTH: 3,
  CORNER_WIDTH: 6,
  BORDER_OPACITY: 0.92,
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
  MOCK_OVERLAYS: ENV.VITE_ENABLE_MOCK_OVERLAYS === 'true',
  // Connection/input diagnostics obscure the operator view, especially in VR.
  DIAGNOSTIC_OVERLAYS: ENV.VITE_ENABLE_DIAGNOSTIC_OVERLAYS === 'true',
  // Real model results received from the perception worker.
  VISION_OVERLAYS: ENV.VITE_ENABLE_VISION_OVERLAYS !== 'false',
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

const bakedToken = ENV.VITE_LIVEKIT_TOKEN || '';
const livekitToken = session.token || (isJwtExpired(bakedToken) ? '' : bakedToken);
const livekitRoom = session.room
  || roomFromToken(livekitToken)
  || ENV.VITE_LIVEKIT_ROOM
  || 'oscar-lot1-room';

export const LIVEKIT = {
  URL: session.url || ENV.VITE_LIVEKIT_URL || '',
  ROOM: livekitRoom,
  TOKEN: livekitToken,
  PREFERRED_PUBLISHER: session.publisher
    || ENV.VITE_LIVEKIT_PREFERRED_PUBLISHER
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

export const VISION = {
  OVERLAY_TOPIC: 'oscar.vision.overlay',
  SCHEMA: 'oscar.vision.overlay.v1',
  // Duree de maintien d'une detection sans nouveau paquet du meme modele. A
  // 1200 ms, une boite restait affichee plus d'une seconde apres que la camera
  // eut quitte l'objet. 600 ms couvre trois cycles d'inference a 5 images/s.
  STALE_AFTER_MS: 600,
};

export const IMMERSIVE_VIDEO = {
  FORCE_EQUIRECT: ENV.VITE_FORCE_IMMERSIVE_360 === 'true',
  REQUIRE_EQUIRECT_IN_VR: ENV.VITE_REQUIRE_IMMERSIVE_360 === 'true',
};
