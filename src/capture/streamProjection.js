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

const PROJECTION = Object.freeze({
  FLAT:     'flat',
  EQUIRECT: 'equirect',
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
  // 1. Metadata is the source of truth
  if (metadata) {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      if (parsed?.projection === PROJECTION.EQUIRECT) return PROJECTION.EQUIRECT;
      if (parsed?.projection === PROJECTION.FLAT)     return PROJECTION.FLAT;
    } catch (_) {
      // Ignore malformed JSON, fall through to heuristics
    }
  }

  // 2. Track name convention
  if (trackName && /360|equirect|pano/i.test(trackName)) {
    return PROJECTION.EQUIRECT;
  }

  // 3. Aspect-ratio heuristic — equirect frames are 2:1 by definition
  if (width && height) {
    const ratio = width / height;
    if (ratio >= 1.85 && ratio <= 2.15) return PROJECTION.EQUIRECT;
  }

  return PROJECTION.FLAT;
}

export { PROJECTION };
