import assert from 'node:assert/strict';
import test from 'node:test';

import { bootstrapLiveKitSession } from './sessionBootstrap.js';

function browserFor(url) {
  const parsed = new URL(url);
  const values = new Map();
  let replacedWith = null;
  return {
    location: parsed,
    sessionStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    history: { replaceState: (_state, _title, value) => { replacedWith = value; } },
    get replacedWith() { return replacedWith; },
  };
}

test('imports fragment credentials and removes them from the URL', () => {
  const browser = browserFor('https://oscar-bot.vercel.app/#token=jwt&url=wss%3A%2F%2Flivekit&room=oscar-02&force360=1');
  const session = bootstrapLiveKitSession(browser);

  assert.deepEqual(session, {
    token: 'jwt',
    url: 'wss://livekit',
    room: 'oscar-02',
    publisher: '',
  });
  assert.equal(browser.replacedWith, '/#force360=1');
});

test('reuses the imported session in the same browser tab', () => {
  const browser = browserFor('https://oscar-bot.vercel.app/#token=jwt&room=oscar-02');
  bootstrapLiveKitSession(browser);
  browser.location = new URL('https://oscar-bot.vercel.app/');

  const session = bootstrapLiveKitSession(browser);
  assert.equal(session.token, 'jwt');
  assert.equal(session.room, 'oscar-02');
});

test('clears the complete stored session when its token is expired', () => {
  const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url');
  const browser = browserFor(`https://oscar-bot.vercel.app/#token=x.${payload}.x&url=wss%3A%2F%2Fold&room=old-room`);

  const session = bootstrapLiveKitSession(browser);
  assert.deepEqual(session, { token: '', url: '', room: '', publisher: '' });
});
