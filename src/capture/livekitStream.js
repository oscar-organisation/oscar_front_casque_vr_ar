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
  jitterBufferMs: 0,
  jitterBufferTargetMs: 0,
  processingDelayMs: 0,
  roundTripTimeMs: 0,
  framesDropped: 0,
  nackCount: 0,
  pliCount: 0,
  availableIncomingBitrateBps: 0,
  transportProtocol: null,
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
function publisherPriority(identity, metadata, trackName) {
  if (!identity) return 0;
  if (identity === LIVEKIT.PREFERRED_PUBLISHER) return 1000; // physical ROSMASTER, or URL override
  const source = parseMetadata(metadata)?.source || '';
  if (/rosmaster|physical/i.test(source)) return 950;        // physical fleet robot
  if (/camera-front/i.test(trackName || '')) return 900;     // canonical physical camera track
  if (identity === LIVEKIT.ROOM_PUBLISHER) return 800;       // room-associated simulator/robot
  if (identity.startsWith('simulateur-robot-')) return 700;  // legacy Isaac identity
  if (identity.startsWith('robot-')) return 500;             // another fleet robot
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
      const trackName = pub.trackName ?? pub.track?.name ?? '';
      const score = publisherPriority(participant.identity, participant.metadata, trackName);
      if (score > bestScore) {
        bestScore = score;
        best = { publication: pub, participant };
      }
    }
  }
  return best;
}

function parseMetadata(metadata) {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch (_) {
    return null;
  }
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
  configureLowLatencyPlayout(pick.publication.track);
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

function configureLowLatencyPlayout(track) {
  try {
    // LiveKit maps this to RTCRtpReceiver.playoutDelayHint where supported.
    // Zero asks the browser not to add an artificial playout delay.
    track.setPlayoutDelay?.(0);
    const receiver = track.receiver;
    if (receiver && 'jitterBufferTarget' in receiver) {
      receiver.jitterBufferTarget = 0;
    }
  } catch (err) {
    console.debug('[LiveKit] low-latency playout hint unavailable', err);
  }
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
let metricsTicks = 0;
function startMetricsLoop() {
  clearInterval(metricsTimer);
  metricsTimer = setInterval(async () => {
    if (!room || room.state !== ConnectionState.Connected) return;

    try {
      let totalBitrate = 0;
      let fps = 0;
      let packetsLost = 0;
      let jitterBufferMs = 0;
      let jitterBufferTargetMs = 0;
      let processingDelayMs = 0;
      let roundTripTimeMs = 0;
      let framesDropped = 0;
      let nackCount = 0;
      let pliCount = 0;
      let availableIncomingBitrateBps = 0;
      let transportProtocol = null;

      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          if (!pub.track || pub.kind !== Track.Kind.Video) continue;
          if (pub.trackSid !== ATTACHED.videoTrackSid) continue;
          const stats = await pub.track.getRTCStatsReport?.();
          if (!stats) continue;
          let selectedPair = null;
          let transport = null;
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
              framesDropped = report.framesDropped ?? 0;
              nackCount = report.nackCount ?? 0;
              pliCount = report.pliCount ?? 0;
              if (report.jitterBufferEmittedCount > 0) {
                jitterBufferMs = 1000 * report.jitterBufferDelay / report.jitterBufferEmittedCount;
                jitterBufferTargetMs = 1000
                  * (report.jitterBufferTargetDelay ?? 0)
                  / report.jitterBufferEmittedCount;
              }
              if (report.framesDecoded > 0) {
                processingDelayMs = 1000
                  * (report.totalProcessingDelay ?? 0)
                  / report.framesDecoded;
              }
            }
            if (report.type === 'transport' && report.selectedCandidatePairId) transport = report;
          });

          if (transport) selectedPair = stats.get(transport.selectedCandidatePairId);
          if (!selectedPair) {
            stats.forEach((report) => {
              if (
                report.type === 'candidate-pair'
                && report.state === 'succeeded'
                && (report.selected || report.nominated)
              ) selectedPair = report;
            });
          }
          if (selectedPair) {
            roundTripTimeMs = 1000 * (selectedPair.currentRoundTripTime ?? 0);
            availableIncomingBitrateBps = selectedPair.availableIncomingBitrate ?? 0;
            const local = stats.get(selectedPair.localCandidateId);
            const remote = stats.get(selectedPair.remoteCandidateId);
            const protocol = local?.protocol || remote?.protocol || null;
            transportProtocol = protocol
              ? `${protocol}/${local?.candidateType || remote?.candidateType || 'unknown'}`
              : null;
          }
        }
      }

      state.bitrateBps = totalBitrate;
      state.fps = fps;
      state.packetsLost = packetsLost;
      state.jitterBufferMs = jitterBufferMs;
      state.jitterBufferTargetMs = jitterBufferTargetMs;
      state.processingDelayMs = processingDelayMs;
      state.roundTripTimeMs = roundTripTimeMs;
      state.framesDropped = framesDropped;
      state.nackCount = nackCount;
      state.pliCount = pliCount;
      state.availableIncomingBitrateBps = availableIncomingBitrateBps;
      state.transportProtocol = transportProtocol;
      state.participantsCount = room.numParticipants;
      notify();

      metricsTicks += 1;
      if (metricsTicks % 5 === 0 && state.hasVideo) {
        console.info('[LiveKit][latency]', {
          publisher: state.activePublisher,
          fps: Number(fps.toFixed(1)),
          bitrateKbps: Math.round(totalBitrate / 1000),
          jitterBufferMs: Number(jitterBufferMs.toFixed(1)),
          processingDelayMs: Number(processingDelayMs.toFixed(1)),
          rttMs: Number(roundTripTimeMs.toFixed(1)),
          packetsLost,
          framesDropped,
          transport: transportProtocol,
        });
      }
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
