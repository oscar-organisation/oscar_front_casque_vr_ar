/** Application-wide constants and configuration */

export const APP = {
  NAME: 'O.S.C.A.R.',
  VERSION: '0.1.0',
};

export const CAMERA = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FACING_MODE: 'environment',
};

export const OVERLAY = {
  DEFAULT_COLOR: 0x00ff88,
  FACE_COLOR: 0x00aaff,
  PRODUCT_COLOR: 0xffaa00,
  FILL_OPACITY: 0.08,
  BORDER_WIDTH: 2,
  Z_DEPTH: 500,
};

export const HUD = {
  FADE_DURATION: 300,
  STATUS_TIMEOUT: 3000,
};

export const API = {
  MIMICX_ENDPOINT: 'https://model.mimicx.ai/api/v1/predict',
  WS_RECONNECT_DELAY: 2000,
  WS_MAX_RETRIES: 5,
};
