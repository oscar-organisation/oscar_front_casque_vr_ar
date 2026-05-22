/** Application-wide constants and configuration */

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

export const API = {
  MIMICX_ENDPOINT: 'https://model.mimicx.ai/api/v1/predict',
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RETRIES: 5,
};

export const LIVEKIT = {
  URL: import.meta.env.VITE_LIVEKIT_URL || '',
  ROOM: import.meta.env.VITE_LIVEKIT_ROOM || 'oscar-lot1-room',
  TOKEN: import.meta.env.VITE_LIVEKIT_TOKEN || '',
  AUTO_SUBSCRIBE: true,
  ADAPTIVE_STREAM: true,
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
