/**
 * Stream projection detector — tells the immersive scene whether the incoming
 * video track is a flat 2D feed (webcam) or an equirectangular 360° feed
 * (stroboscopic camera on the production robot).
 *
 * Detection priority:
 *   1. LiveKit participant metadata JSON: { "projection": "equirect" | "flat" }
 *   2. Track name convention: "camera-360" → equirect
 *   3. Aspect ratio heuristic (≈2:1 → equirect) as last resort
 *
 * The switch happens live: if the active publisher changes (e.g. operator
 * webcam → 360 robot), the projection mode updates on the fly.
 */

import { IMMERSIVE_VIDEO } from '../config/constants.js';

const PROJECTION = Object.freeze({
  FLAT:     'flat',
  EQUIRECT: 'equirect',
});

const PROJECTION_SOURCE = Object.freeze({
  FORCED: 'forced',
  METADATA: 'metadata',
  TRACK_NAME: 'track-name',
  ASPECT_RATIO: 'aspect-ratio',
  FALLBACK: 'fallback',
});

/**
 * Resolves the projection mode for a given LiveKit remote participant + its
 * active video publication.
 *
 * @param {Object} opts
 * @param {string} [opts.metadata]     raw JSON string from participant.metadata
 * @param {string} [opts.trackName]    name of the video track
 * @param {number} [opts.width]        video width in pixels
 * @param {number} [opts.height]       video height in pixels
 * @returns {'flat'|'equirect'}
 */
export function detectProjection({ metadata, trackName, width, height } = {}) {
  return detectProjectionDetails({ metadata, trackName, width, height }).mode;
}

/**
 * Resolves projection with source/reason details for UI and debugging.
 * @param {Object} opts
 * @returns {{ mode: 'flat'|'equirect', source: string, reason: string, confidence: 'explicit'|'inferred'|'fallback' }}
 */
export function detectProjectionDetails({ metadata, trackName, width, height } = {}) {
  // Debug/test override for headset validation with prerecorded LiveKit videos.
  if (shouldForceEquirect()) {
    return {
      mode: PROJECTION.EQUIRECT,
      source: PROJECTION_SOURCE.FORCED,
      reason: 'forced by ?force360=1 or VITE_FORCE_IMMERSIVE_360=true',
      confidence: 'explicit',
    };
  }

  // 1. Metadata is the source of truth
  if (metadata) {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      if (parsed?.projection === PROJECTION.EQUIRECT) {
        return {
          mode: PROJECTION.EQUIRECT,
          source: PROJECTION_SOURCE.METADATA,
          reason: 'participant metadata projection=equirect',
          confidence: 'explicit',
        };
      }
      if (parsed?.projection === PROJECTION.FLAT) {
        return {
          mode: PROJECTION.FLAT,
          source: PROJECTION_SOURCE.METADATA,
          reason: 'participant metadata projection=flat',
          confidence: 'explicit',
        };
      }
    } catch (_) {
      // Ignore malformed JSON, fall through to heuristics
    }
  }

  // 2. Track name convention
  if (trackName && /360|equirect|pano/i.test(trackName)) {
    return {
      mode: PROJECTION.EQUIRECT,
      source: PROJECTION_SOURCE.TRACK_NAME,
      reason: `track name "${trackName}" indicates 360 video`,
      confidence: 'inferred',
    };
  }

  // 3. Aspect-ratio heuristic — equirect frames are 2:1 by definition
  if (width && height) {
    const ratio = width / height;
    if (ratio >= 1.85 && ratio <= 2.15) {
      return {
        mode: PROJECTION.EQUIRECT,
        source: PROJECTION_SOURCE.ASPECT_RATIO,
        reason: `video ratio ${ratio.toFixed(3)} is close to 2:1`,
        confidence: 'inferred',
      };
    }
  }

  return {
    mode: PROJECTION.FLAT,
    source: PROJECTION_SOURCE.FALLBACK,
    reason: 'no equirect metadata, track hint, or 2:1 ratio',
    confidence: 'fallback',
  };
}

export function shouldForceEquirect() {
  if (typeof window === 'undefined') return IMMERSIVE_VIDEO.FORCE_EQUIRECT;
  const params = new URLSearchParams(window.location.search);
  return IMMERSIVE_VIDEO.FORCE_EQUIRECT || params.get('force360') === '1';
}

export function shouldRequireEquirectInVR() {
  if (typeof window === 'undefined') return IMMERSIVE_VIDEO.REQUIRE_EQUIRECT_IN_VR;
  const params = new URLSearchParams(window.location.search);
  return IMMERSIVE_VIDEO.REQUIRE_EQUIRECT_IN_VR || params.get('require360') === '1';
}

export { PROJECTION, PROJECTION_SOURCE };
