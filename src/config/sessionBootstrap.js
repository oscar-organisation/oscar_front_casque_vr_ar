const SESSION_KEYS = ['token', 'url', 'room', 'publisher'];
const STORAGE_PREFIX = 'oscar.livekit.';

/**
 * Imports a short-lived LiveKit session from the admin console.
 *
 * The console sends credentials in the URL fragment so they are never sent to
 * Vercel as part of the HTTP request. Values are moved to sessionStorage and
 * immediately removed from the visible URL.
 */
export function bootstrapLiveKitSession(browser = globalThis.window) {
  if (!browser?.location) return {};

  const query = new URLSearchParams(browser.location.search || '');
  const rawHash = String(browser.location.hash || '').replace(/^#\??/, '');
  const fragment = new URLSearchParams(rawHash);
  const values = {};
  let receivedCredentials = false;

  for (const key of SESSION_KEYS) {
    const incoming = fragment.get(key) || query.get(key);
    if (incoming) {
      values[key] = incoming;
      receivedCredentials = true;
      writeSessionValue(browser.sessionStorage, key, incoming);
      continue;
    }
    values[key] = readSessionValue(browser.sessionStorage, key);
  }

  if (values.token && isJwtExpired(values.token)) {
    for (const key of SESSION_KEYS) {
      removeSessionValue(browser.sessionStorage, key);
      values[key] = '';
    }
  }

  if (receivedCredentials) scrubCredentialsFromUrl(browser, query, fragment);
  return values;
}

export function decodeJwtClaims(token) {
  if (!token || typeof globalThis.atob !== 'function') return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
  } catch (_) {
    return null;
  }
}

export function isJwtExpired(token) {
  const claims = decodeJwtClaims(token);
  return Number.isFinite(claims?.exp) && claims.exp * 1000 <= Date.now() + 30_000;
}

function scrubCredentialsFromUrl(browser, query, fragment) {
  for (const key of SESSION_KEYS) {
    query.delete(key);
    fragment.delete(key);
  }

  const search = query.toString();
  const hash = fragment.toString();
  const cleanUrl = `${browser.location.pathname || '/'}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
  browser.history?.replaceState?.(null, '', cleanUrl);
}

function readSessionValue(storage, key) {
  try {
    return storage?.getItem(`${STORAGE_PREFIX}${key}`) || '';
  } catch (_) {
    return '';
  }
}

function writeSessionValue(storage, key, value) {
  try {
    storage?.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch (_) {
    // Private browsing may reject storage; the in-memory value still works.
  }
}

function removeSessionValue(storage, key) {
  try {
    storage?.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (_) {
    // Nothing else to clean up.
  }
}
