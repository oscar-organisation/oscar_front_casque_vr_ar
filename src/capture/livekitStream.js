/**
 * LiveKit stream capture — subscribes to a remote room and attaches the
 * preferred remote video (and audio) track to local <video> / <audio> elements.
 *
 * Multiple publishers may coexist in the room (e.g. the always-on MP4
 * media-simulator on the VPS, plus a live operator running the Python
 * robot-simulator script). When several video tracks are available, we prefer
 * the one published by an identity matching `simulateur-robot-*` (live operator)
 * over the static MP4 simulator. This means: if a teammate launches the Python
 * script, you instantly see their webcam; otherwise you keep the MP4 fallback —
 * with zero server-side coordination.
 */

import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  ConnectionQuality,
  createLocalAudioTrack,
} from 'livekit-client';
import { LIVEKIT } from '../config/constants.js';

let room = null;
let videoElRef = null;
let audioElRef = null;
const dataEncoder = new TextEncoder();

const listeners = new Set();
const ATTACHED = { videoTrackSid: null, videoIdentity: null, audioTrackSid: null };

const state = {
  connectionState: ConnectionState.Disconnected,
  connectionQuality: ConnectionQuality.Unknown,
  participantsCount: 0,
  hasVideo: false,
  hasAudio: false,
  videoWidth: 0,
  videoHeight: 0,
  bitrateBps: 0,
  fps: 0,
  packetsLost: 0,
  roomName: LIVEKIT.ROOM,
  serverUrl: LIVEKIT.URL,
  participantIdentity: null,
  joinedAt: null,
  activePublisher: null,
  activePublisherMetadata: null,
  activeTrackName: null,
  micPublishing: false,
};

export function onStateChange(cb) {
  listeners.add(cb);
  cb(getState());
  return () => listeners.delete(cb);
}

export function getState() {
  return { ...state };
}

function notify() {
  const snap = getState();
  for (const cb of listeners) cb(snap);
}

/* ════════════════════════════════════════════════════════════
   Publisher selection
   ════════════════════════════════════════════════════════════ */

/** Higher score = preferred for display. */
function publisherPriority(identity) {
  if (!identity) return 0;
  if (identity.startsWith('simulateur-robot-')) return 100; // live operator script
  if (identity.startsWith('robot-')) return 50;             // generic robot
  if (identity.includes('media-simulator')) return 10;      // VPS MP4 fallback
  return 30;
}

/** Picks the best available remote video publication across the room. */
function pickPreferredVideo() {
  if (!room) return null;
  let best = null;
  let bestScore = -1;
  for (const participant of room.remoteParticipants.values()) {
    for (const pub of participant.trackPublications.values()) {
      if (pub.kind !== Track.Kind.Video || !pub.track) continue;
      const score = publisherPriority(participant.identity);
      if (score > bestScore) {
        bestScore = score;
        best = { publication: pub, participant };
      }
    }
  }
  return best;
}

function pickAnyAudio() {
  if (!room) return null;
  for (const participant of room.remoteParticipants.values()) {
    for (const pub of participant.trackPublications.values()) {
      if (pub.kind === Track.Kind.Audio && pub.track) {
        return { publication: pub, participant };
      }
    }
  }
  return null;
}

function attachBestVideo() {
  const pick = pickPreferredVideo();
  if (!pick) {
    if (state.hasVideo) {
      state.hasVideo = false;
      state.activePublisher = null;
      ATTACHED.videoTrackSid = null;
      ATTACHED.videoIdentity = null;
      notify();
    }
    return;
  }

  if (ATTACHED.videoTrackSid === pick.publication.trackSid) return;

  // Detach previous if any
  if (ATTACHED.videoTrackSid) {
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.trackSid === ATTACHED.videoTrackSid && pub.track) {
          pub.track.detach(videoElRef);
        }
      }
    }
  }

  pick.publication.track.attach(videoElRef);
  ATTACHED.videoTrackSid = pick.publication.trackSid;
  ATTACHED.videoIdentity = pick.participant.identity;

  state.hasVideo = true;
  state.activePublisher = pick.participant.identity;
  state.activePublisherMetadata = pick.participant.metadata ?? null;
  state.activeTrackName = pick.publication.trackName ?? pick.publication.track.name ?? null;
  const dim = pick.publication.track.dimensions;
  if (dim) {
    state.videoWidth = dim.width;
    state.videoHeight = dim.height;
  }
  console.info(
    `[LiveKit] attached track from ${pick.participant.identity} — metadata=${pick.participant.metadata || '(none)'} track=${state.activeTrackName} dims=${state.videoWidth}×${state.videoHeight}`
  );
  notify();
}

function attachAudioIfAny() {
  if (!audioElRef) return;
  const pick = pickAnyAudio();
  if (!pick) {
    if (state.hasAudio) {
      state.hasAudio = false;
      ATTACHED.audioTrackSid = null;
      notify();
    }
    return;
  }
  if (ATTACHED.audioTrackSid === pick.publication.trackSid) return;
  pick.publication.track.attach(audioElRef);
  ATTACHED.audioTrackSid = pick.publication.trackSid;
  state.hasAudio = true;
  notify();
}

/* ════════════════════════════════════════════════════════════
   Connection lifecycle
   ════════════════════════════════════════════════════════════ */

export async function initLiveKit(videoEl, audioEl = null) {
  if (!LIVEKIT.URL || !LIVEKIT.TOKEN) {
    console.error('[LiveKit] VITE_LIVEKIT_URL or VITE_LIVEKIT_TOKEN missing in .env');
    return null;
  }

  videoElRef = videoEl;
  audioElRef = audioEl;

  room = new Room({
    adaptiveStream: LIVEKIT.ADAPTIVE_STREAM,
    dynacast: LIVEKIT.DYNACAST,
  });

  attachRoomEvents();

  try {
    state.connectionState = ConnectionState.Connecting;
    notify();

    await room.connect(LIVEKIT.URL, LIVEKIT.TOKEN, {
      autoSubscribe: LIVEKIT.AUTO_SUBSCRIBE,
    });

    state.connectionState = room.state;
    state.participantIdentity = room.localParticipant?.identity ?? null;
    state.joinedAt = Date.now();
    state.participantsCount = room.numParticipants;

    attachBestVideo();
    attachAudioIfAny();
    startMetricsLoop();
    notify();

    console.info(`[LiveKit] Connected as ${state.participantIdentity} → room=${LIVEKIT.ROOM}`);
    return videoEl;
  } catch (err) {
    console.error('[LiveKit] Connection failed:', err);
    state.connectionState = ConnectionState.Disconnected;
    notify();
    return null;
  }
}

function attachRoomEvents() {
  room
    .on(RoomEvent.ConnectionStateChanged, (s) => {
      state.connectionState = s;
      notify();
    })
    .on(RoomEvent.ConnectionQualityChanged, (q, p) => {
      if (p?.isLocal) {
        state.connectionQuality = q;
        notify();
      }
    })
    .on(RoomEvent.ParticipantConnected, () => {
      state.participantsCount = room.numParticipants;
      notify();
    })
    .on(RoomEvent.ParticipantMetadataChanged, (_, participant) => {
      if (participant?.identity === state.activePublisher) {
        state.activePublisherMetadata = participant.metadata ?? null;
        notify();
      }
    })
    .on(RoomEvent.ParticipantDisconnected, () => {
      state.participantsCount = room.numParticipants;
      // The disappearing participant might be the one we display
      attachBestVideo();
      attachAudioIfAny();
      notify();
    })
    .on(RoomEvent.TrackSubscribed, () => {
      attachBestVideo();
      attachAudioIfAny();
    })
    .on(RoomEvent.TrackUnsubscribed, (track) => {
      try { track.detach(); } catch (_) {}
      if (track.sid === ATTACHED.videoTrackSid) ATTACHED.videoTrackSid = null;
      if (track.sid === ATTACHED.audioTrackSid) ATTACHED.audioTrackSid = null;
      attachBestVideo();
      attachAudioIfAny();
    })
    .on(RoomEvent.Disconnected, () => {
      state.hasVideo = false;
      state.hasAudio = false;
      state.activePublisher = null;
      state.connectionState = ConnectionState.Disconnected;
      notify();
    });
}

/* ════════════════════════════════════════════════════════════
   Local microphone publishing (operator → robot)
   ════════════════════════════════════════════════════════════ */

let localMicTrack = null;

export async function enableMicrophone() {
  if (!room || room.state !== ConnectionState.Connected) {
    throw new Error('Not connected to a room');
  }
  if (localMicTrack) return true;

  localMicTrack = await createLocalAudioTrack({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
  await room.localParticipant.publishTrack(localMicTrack, {
    name: 'operator-mic',
    source: Track.Source.Microphone,
  });
  state.micPublishing = true;
  notify();
  return true;
}

export async function disableMicrophone() {
  if (!localMicTrack) return;
  try {
    await room.localParticipant.unpublishTrack(localMicTrack, true);
  } catch (_) {}
  try { localMicTrack.stop(); } catch (_) {}
  localMicTrack = null;
  state.micPublishing = false;
  notify();
}

export async function toggleMicrophone() {
  if (state.micPublishing) {
    await disableMicrophone();
    return false;
  }
  await enableMicrophone();
  return true;
}

/* ════════════════════════════════════════════════════════════
   LiveKit data publishing (XR teleoperation, telemetry, commands)
   ════════════════════════════════════════════════════════════ */

/**
 * Publishes a small data packet to the LiveKit room.
 * Use reliable=false for continuous controls so stale packets are dropped.
 *
 * @param {string} topic
 * @param {Object|Uint8Array|string} payload
 * @param {{ reliable?: boolean, destinationIdentities?: string[] }} [options]
 * @returns {boolean} true when the packet was accepted for publishing.
 */
export function publishDataPacket(topic, payload, options = {}) {
  if (!room || room.state !== ConnectionState.Connected) return false;

  const { reliable = false, destinationIdentities } = options;
  const data = encodePayload(payload);

  try {
    const publishResult = room.localParticipant.publishData(data, {
      reliable,
      topic,
      destinationIdentities,
    });

    if (publishResult?.catch) {
      publishResult.catch((err) => {
        console.warn(`[LiveKit] data publish failed on topic "${topic}"`, err);
      });
    }

    return true;
  } catch (err) {
    console.warn(`[LiveKit] data publish failed on topic "${topic}"`, err);
    return false;
  }
}

function encodePayload(payload) {
  if (payload instanceof Uint8Array) return payload;
  if (typeof payload === 'string') return dataEncoder.encode(payload);
  return dataEncoder.encode(JSON.stringify(payload));
}

/* ════════════════════════════════════════════════════════════
   Stats loop
   ════════════════════════════════════════════════════════════ */

let metricsTimer = null;
function startMetricsLoop() {
  clearInterval(metricsTimer);
  metricsTimer = setInterval(async () => {
    if (!room || room.state !== ConnectionState.Connected) return;

    try {
      let totalBitrate = 0;
      let fps = 0;
      let packetsLost = 0;

      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (!pub.track || pub.kind !== Track.Kind.Video) continue;
          if (pub.trackSid !== ATTACHED.videoTrackSid) continue;
          const stats = await pub.track.getRTCStatsReport?.();
          if (!stats) continue;
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (report.bytesReceived && pub.track._lastBytes) {
                const dt = (report.timestamp - pub.track._lastTs) / 1000;
                const db = report.bytesReceived - pub.track._lastBytes;
                if (dt > 0) totalBitrate += (db * 8) / dt;
              }
              pub.track._lastBytes = report.bytesReceived;
              pub.track._lastTs = report.timestamp;
              if (report.framesPerSecond) fps = report.framesPerSecond;
              if (report.packetsLost != null) packetsLost = report.packetsLost;
            }
          });
        }
      }

      state.bitrateBps = totalBitrate;
      state.fps = fps;
      state.packetsLost = packetsLost;
      state.participantsCount = room.numParticipants;
      notify();
    } catch (e) {
      // best effort
    }
  }, 1000);
}

export async function disconnectLiveKit() {
  clearInterval(metricsTimer);
  metricsTimer = null;
  await disableMicrophone().catch(() => {});
  if (room) {
    await room.disconnect();
    room = null;
  }
  state.hasVideo = false;
  state.hasAudio = false;
  state.connectionState = ConnectionState.Disconnected;
  notify();
}

export { ConnectionState, ConnectionQuality };
