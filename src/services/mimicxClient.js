/**
 * MimicX API client — handles communication with Biometrix and Darwin endpoints.
 * Currently a scaffold; will be connected when backend WebSocket is available.
 */

import { API } from '../config/constants.js';

/**
 * Sends a frame to MimicX prediction endpoint.
 * @param {string} base64Frame - JPEG frame encoded as base64
 * @param {string} model - 'biometrix' | 'object_signature' | 'emoticore'
 * @returns {Promise<Object>} API response with detections
 */
export async function predict(base64Frame, model = 'biometrix') {
  const response = await fetch(API.MIMICX_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      image: base64Frame,
    }),
  });

  if (!response.ok) {
    throw new Error(`[MimicX] API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Retrieves the API key from environment.
 * Vite exposes env vars prefixed with VITE_ at build time.
 */
function getApiKey() {
  return import.meta.env.VITE_MIMICX_API_KEY || '';
}
