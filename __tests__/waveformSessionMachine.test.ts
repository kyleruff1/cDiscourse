/**
 * VOICE-004 (issue 662) - reducer scenario matrix + runtime invariants.
 *
 * Covers the 8-state x 8-event transition table (64 cells) with named
 * scenarios plus a blanket IGNORE matrix over every cell not covered
 * above (asserts nextState is byte-identical AND producedArtifact is
 * null). Runtime invariants B1..B16 are asserted here; type-level
 * invariants live in voiceWaveformArtifact.test.ts.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import {
  initialWaveformSessionState,
  reduceWaveformSession,
  MAX_AMPLITUDE_BUCKETS,
  SILENCE_THRESHOLD,
  MIN_SAMPLES_FOR_FINALIZED,
  VOICE_WAVEFORM_MACHINE_VERSION,
  type WaveformEvent,
  type WaveformCapabilitySnapshot,
  type WaveformSessionMachineState,
  type WaveformSessionState,
} from '../src/features/voice/waveform/waveformSessionMachine';
import type { WaveformStreamErrorCode } from '../src/features/voice/waveform/voiceWaveformArtifact.types';

// ---------- Fixtures --------------------------------------------------------

const CAP_OK: WaveformCapabilitySnapshot = Object.freeze({
  waveformOfferable: true,
  meteringSupported: true,
});

const CAP_NOT_OFFERABLE: WaveformCapabilitySnapshot = Object.freeze({
  waveformOfferable: false,
  meteringSupported: true,
});

const CAP_NO_METERING: WaveformCapabilitySnapshot = Object.freeze({
  waveformOfferable: true,
  meteringSupported: false,
});

const START_ISO = '2026-08-01T00:00:00.000Z';

const START_EVT: WaveformEvent = Object.freeze({
  type: 'USER_START',
  sessionId: 'sess-A',
  waveformId: 'wf-A',
  capability: CAP_OK,
  audioSource: 'metering_only',
  nowIso: START_ISO,
});

// Apply a sequence of events and return per-step results plus the final state.
function drive(events: WaveformEvent[]): {
  finalState: WaveformSessionMachineState;
  lastArtifact: ReturnType<typeof reduceWaveformSession>['producedArtifact'];
  perStep: ReturnType<typeof reduceWaveformSession>[];
} {
  let state = initialWaveformSessionState();
  let last: ReturnType<typeof reduceWaveformSession> = {
    nextState: state,
    producedArtifact: null,
  };
  const perStep: ReturnType<typeof reduceWaveformSession>[] = [];
  for (const ev of events) {
    last = reduceWaveformSession(state, ev);
    state = last.nextState;
    perStep.push(last);
  }
  return { finalState: state, lastArtifact: last.producedArtifact, perStep };
}

// Reach specific active/terminal states deterministically.
function reachAccumulating(): WaveformSessionMachineState {
  return drive([START_EVT]).finalState;
}
function reachFinalizing(): WaveformSessionMachineState {
  // Construct a finalizing state directly - the reducer routes
  // accumulating+stream_end straight to a terminal, so finalizing is
  // reachable only via test construction. Copy an accumulating state
  // and override .state.
  const accum = reachAccumulating();
  return { ...accum, state: 'finalizing' };
}
function reachFinalized(): WaveformSessionMachineState {
  return drive([
    START_EVT,
    { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 0 },
    { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 10 },
    { type: 'level_sample', normalizedLevel: 0.6, sourceTimestampMs: 20 },
    { type: 'stream_end' },
  ]).finalState;
}
function reachAborted(): WaveformSessionMachineState {
  return drive([
    START_EVT,
    { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
    { type: 'USER_ABORT' },
  ]).finalState;
}
function reachNoSignal(): WaveformSessionMachineState {
  return drive([START_EVT, { type: 'stream_end' }]).finalState;
}
function reachError(): WaveformSessionMachineState {
  return drive([
    START_EVT,
    { type: 'stream_error', code: 'metering_lost' },
  ]).finalState;
}
function reachUnavailable(): WaveformSessionMachineState {
  return drive([START_EVT, { type: 'AVAILABILITY_LOST', reason: 'permission_revoked' }])
    .finalState;
}

const ALL_STATES: readonly WaveformSessionState[] = Object.freeze([
  'idle',
  'accumulating',
  'finalizing',
  'finalized',
  'aborted',
  'no_signal',
  'error',
  'unavailable',
]);

const ALL_EVENT_TYPES: readonly WaveformEvent['type'][] = Object.freeze([
  'USER_START',
  'USER_ABORT',
  'USER_RESET',
  'AVAILABILITY_LOST',
  'stream_start',
  'level_sample',
  'stream_end',
  'stream_error',
]);

const ALL_ERROR_CODES: readonly WaveformStreamErrorCode[] = Object.freeze([
  'metering_lost',
  'permission_revoked',
  'audio_route_lost',
  'native_error',
]);

// Build a canonical event for each event type. Payload-carrying events
// use safe placeholder values.
function eventOfType(t: WaveformEvent['type']): WaveformEvent {
  switch (t) {
    case 'USER_START':
      return START_EVT;
    case 'USER_ABORT':
      return { type: 'USER_ABORT' };
    case 'USER_RESET':
      return { type: 'USER_RESET' };
    case 'AVAILABILITY_LOST':
      return { type: 'AVAILABILITY_LOST', reason: 'permission_revoked' };
    case 'stream_start':
      return { type: 'stream_start' };
    case 'level_sample':
      return { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 0 };
    case 'stream_end':
      return { type: 'stream_end' };
    case 'stream_error':
      return { type: 'stream_error', code: 'native_error' };
  }
}

function stateReacher(s: WaveformSessionState): WaveformSessionMachineState {
  switch (s) {
    case 'idle':
      return initialWaveformSessionState();
    case 'accumulating':
      return reachAccumulating();
    case 'finalizing':
      return reachFinalizing();
    case 'finalized':
      return reachFinalized();
    case 'aborted':
      return reachAborted();
    case 'no_signal':
      return reachNoSignal();
    case 'error':
      return reachError();
    case 'unavailable':
      return reachUnavailable();
  }
}

// ---------- Named scenarios -------------------------------------------------

describe('VOICE-004 - reduceWaveformSession named scenarios', () => {
  test('#1 happy path: 5 samples then stream_end', () => {
    const events: WaveformEvent[] = [
      START_EVT,
      { type: 'stream_start' },
      { type: 'level_sample', normalizedLevel: 0.2, sourceTimestampMs: 50 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 100 },
      { type: 'level_sample', normalizedLevel: 0.6, sourceTimestampMs: 150 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 200 },
      { type: 'level_sample', normalizedLevel: 0.2, sourceTimestampMs: 250 },
      { type: 'stream_end' },
    ];
    const { finalState, perStep } = drive(events);
    expect(finalState.state).toBe('finalized');
    const yielded = perStep.filter((r) => r.producedArtifact !== null);
    expect(yielded).toHaveLength(1);
    const art = yielded[0].producedArtifact;
    expect(art).not.toBeNull();
    if (art === null) return;
    expect(art.terminalState).toBe('finalized');
    expect(art.amplitudeBuckets).toHaveLength(5);
    expect(art.peakLevel).toBe(0.6);
    expect(art.meanLevel).toBeCloseTo(0.36, 6);
    expect(art.sampleCount).toBe(5);
    expect(art.durationMs).toBe(200);
    expect(art.audioSource).toBe('metering_only');
    expect(art.rawAudioPersisted).toBe(false);
    expect(art.audioUri).toBeNull();
    expect(Object.isFrozen(art)).toBe(true);
    expect(Object.isFrozen(art.amplitudeBuckets)).toBe(true);
  });

  test('#2 zero-sample happy path -> no_signal', () => {
    const { finalState, lastArtifact } = drive([START_EVT, { type: 'stream_end' }]);
    expect(finalState.state).toBe('no_signal');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('no_signal');
    expect(lastArtifact.amplitudeBuckets).toEqual([]);
    expect(lastArtifact.peakLevel).toBe(0);
    expect(lastArtifact.meanLevel).toBe(0);
    expect(lastArtifact.sampleCount).toBe(0);
    expect(lastArtifact.durationMs).toBe(0);
    expect(lastArtifact.activeDurationMs).toBe(0);
  });

  test('#3 below-threshold: 2 samples -> no_signal', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 10 },
      { type: 'stream_end' },
    ]);
    expect(finalState.state).toBe('no_signal');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('no_signal');
    expect(lastArtifact.amplitudeBuckets).toHaveLength(2);
    expect(lastArtifact.sampleCount).toBe(2);
  });

  test('#4 exactly threshold: 3 samples -> finalized', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.2, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 5 },
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 10 },
      { type: 'stream_end' },
    ]);
    expect(finalState.state).toBe('finalized');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('finalized');
    expect(lastArtifact.amplitudeBuckets).toHaveLength(3);
  });

  test('#5 single-sample USER_ABORT -> aborted with 1 bucket', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 0 },
      { type: 'USER_ABORT' },
    ]);
    expect(finalState.state).toBe('aborted');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('aborted');
    expect(lastArtifact.amplitudeBuckets).toHaveLength(1);
    // Quantized 0.5 -> Math.round(0.5 * 255) / 255 = 128 / 255.
    expect(lastArtifact.amplitudeBuckets[0]).toBeCloseTo(128 / 255, 12);
    expect(lastArtifact.peakLevel).toBe(0.5);
    expect(lastArtifact.sampleCount).toBe(1);
    expect(lastArtifact.durationMs).toBe(0);
  });

  test('#6 above-1 level clamped', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 1.5, sourceTimestampMs: 0 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toEqual([1]);
    expect(lastArtifact.peakLevel).toBe(1);
  });

  test('#7 NaN treated as 0', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: Number.NaN, sourceTimestampMs: 0 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toEqual([0]);
    expect(lastArtifact.peakLevel).toBe(0);
  });

  test('#8 +Infinity treated as 0 (not clamped to 1)', () => {
    const { lastArtifact } = drive([
      START_EVT,
      {
        type: 'level_sample',
        normalizedLevel: Number.POSITIVE_INFINITY,
        sourceTimestampMs: 0,
      },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toEqual([0]);
    expect(lastArtifact.peakLevel).toBe(0);
  });

  test('#9 negative level clamped to 0', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: -0.7, sourceTimestampMs: 0 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toEqual([0]);
    expect(lastArtifact.peakLevel).toBe(0);
  });

  test('#10 dBFS-shaped negative -6 clamped (adapter bug defense)', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: -6, sourceTimestampMs: 0 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toEqual([0]);
  });

  test('#11 identity fold at N=256 - no halving', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 256; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: i / 256,
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { finalState, lastArtifact } = drive(events);
    expect(finalState.state).toBe('finalized');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toHaveLength(256);
    // Each bucket receives one sample - equals the quantized input.
    for (let i = 0; i < 256; i += 1) {
      const expected = Math.round((i / 256) * 255) / 255;
      expect(lastArtifact.amplitudeBuckets[i]).toBeCloseTo(expected, 12);
    }
  });

  test('#12 N=257 triggers first halving - resulting length 129', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 257; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: 0.5,
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    // 256 halved to 128, plus a new bucket 129 for sample 257.
    expect(lastArtifact.amplitudeBuckets).toHaveLength(129);
  });

  test('#13 N=512 - exactly one halving completes, length 256', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 512; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: 0.5,
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets).toHaveLength(256);
    // Every bucket is max of two 0.5 samples = 0.5, quantized.
    const q = Math.round(0.5 * 255) / 255;
    for (const b of lastArtifact.amplitudeBuckets) {
      expect(b).toBeCloseTo(q, 12);
    }
  });

  test('#14 rate-invariance - identical buckets at 10 Hz vs 100 Hz vs 1000 Hz', () => {
    const levels: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      levels.push((i % 10) / 10);
    }
    function run(stepMs: number): ReturnType<typeof reduceWaveformSession>['producedArtifact'] {
      const events: WaveformEvent[] = [START_EVT];
      for (let i = 0; i < levels.length; i += 1) {
        events.push({
          type: 'level_sample',
          normalizedLevel: levels[i],
          sourceTimestampMs: i * stepMs,
        });
      }
      events.push({ type: 'stream_end' });
      return drive(events).lastArtifact;
    }
    const a = run(100); // 10 Hz
    const b = run(10); // 100 Hz
    const c = run(1); // 1000 Hz
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    if (a === null || b === null || c === null) return;
    expect(JSON.stringify(a.amplitudeBuckets)).toBe(JSON.stringify(b.amplitudeBuckets));
    expect(JSON.stringify(a.amplitudeBuckets)).toBe(JSON.stringify(c.amplitudeBuckets));
    expect(a.peakLevel).toBe(b.peakLevel);
    expect(a.peakLevel).toBe(c.peakLevel);
    expect(a.meanLevel).toBe(b.meanLevel);
    expect(a.meanLevel).toBe(c.meanLevel);
    // Only durationMs differs by design.
    expect(a.durationMs).toBe(99 * 100);
    expect(b.durationMs).toBe(99 * 10);
    expect(c.durationMs).toBe(99 * 1);
  });

  test('#15 halving-fold determinism - chunked vs single-shot yield equal artifacts', () => {
    const N = 5000;
    const levels: number[] = [];
    for (let i = 0; i < N; i += 1) {
      levels.push(((i * 37) % 101) / 100);
    }
    function runChunked(chunkSize: number): ReturnType<typeof reduceWaveformSession>['producedArtifact'] {
      let state = initialWaveformSessionState();
      let last: ReturnType<typeof reduceWaveformSession> = {
        nextState: state,
        producedArtifact: null,
      };
      const startResult = reduceWaveformSession(state, START_EVT);
      state = startResult.nextState;
      let i = 0;
      while (i < N) {
        const bound = Math.min(i + chunkSize, N);
        for (let j = i; j < bound; j += 1) {
          const step = reduceWaveformSession(state, {
            type: 'level_sample',
            normalizedLevel: levels[j],
            sourceTimestampMs: j,
          });
          state = step.nextState;
        }
        i = bound;
      }
      last = reduceWaveformSession(state, { type: 'stream_end' });
      return last.producedArtifact;
    }
    const baseline = runChunked(1);
    expect(baseline).not.toBeNull();
    if (baseline === null) return;
    for (const k of [2, 5, 7, 13, 100, 1000]) {
      const other = runChunked(k);
      expect(other).not.toBeNull();
      if (other === null) continue;
      expect(other.amplitudeBuckets).toEqual(baseline.amplitudeBuckets);
      expect(other.peakLevel).toBe(baseline.peakLevel);
      expect(other.meanLevel).toBe(baseline.meanLevel);
      expect(other.sampleCount).toBe(baseline.sampleCount);
      expect(other.durationMs).toBe(baseline.durationMs);
    }
  });

  test('#16 determinism across three runs with identical inputs', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 1000; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: ((i * 41) % 97) / 96,
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const a = drive(events).lastArtifact;
    const b = drive(events).lastArtifact;
    const c = drive(events).lastArtifact;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(c));
  });

  test('#17 peak-fold associativity within a bucket', () => {
    // 4 samples fold into 4 buckets (bucketWidth=1) via identity.
    const events: WaveformEvent[] = [
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.1, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.9, sourceTimestampMs: 1 },
      { type: 'level_sample', normalizedLevel: 0.2, sourceTimestampMs: 2 },
      { type: 'level_sample', normalizedLevel: 0.8, sourceTimestampMs: 3 },
      { type: 'stream_end' },
    ];
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    // With bucketWidth 1 the buckets store each sample. Quantized.
    expect(lastArtifact.amplitudeBuckets[0]).toBeCloseTo(Math.round(0.1 * 255) / 255, 12);
    expect(lastArtifact.amplitudeBuckets[1]).toBeCloseTo(Math.round(0.9 * 255) / 255, 12);
    expect(lastArtifact.amplitudeBuckets[2]).toBeCloseTo(Math.round(0.2 * 255) / 255, 12);
    expect(lastArtifact.amplitudeBuckets[3]).toBeCloseTo(Math.round(0.8 * 255) / 255, 12);
  });

  test('#18 meanLevel bit-exact pinned fixture (INV-B13)', () => {
    // Seeded 10,000-sample fixture. seed = 12345 linear congruential.
    let seed = 12345;
    function next(): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 65537) / 65537;
    }
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 10000; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: next(),
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    // meanLevel is the integer-scaled accumulator / count / 65535. This
    // pinned value is what the pure formula produces under the seeded
    // sequence. Any refactor that breaks bit-exactness fails this test.
    // Value is computed once via the seeded formula and pinned.
    // Since it is derived deterministically we assert equality to the
    // re-derived reference below to keep the test resilient to seed
    // changes if the fixture ever moves.
    let refSeed = 12345;
    let sumScaled = 0;
    for (let i = 0; i < 10000; i += 1) {
      refSeed = (refSeed * 1103515245 + 12345) & 0x7fffffff;
      const level = (refSeed % 65537) / 65537;
      const clamped = level > 1 ? 1 : level < 0 ? 0 : level;
      sumScaled += Math.round(clamped * 65535);
    }
    const referenceMean = sumScaled / 10000 / 65535;
    expect(lastArtifact.meanLevel).toBe(referenceMean);
  });

  test('#19 silence threshold - samples below 0.02 excluded from activeDurationMs', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 50; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: 0.01,
        sourceTimestampMs: i * 10,
      });
    }
    for (let i = 0; i < 50; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: 0.5,
        sourceTimestampMs: 500 + i * 10,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    // 50 active out of 100 total across duration ~990ms.
    // durationMs = 990 (last ts = 990 - first ts 0)
    expect(lastArtifact.durationMs).toBe(990);
    expect(lastArtifact.activeDurationMs).toBe(Math.round((50 / 100) * 990));
  });

  test('#20 level_sample in finalizing IGNORED (INV-B9)', () => {
    const st = reachFinalizing();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'level_sample',
      normalizedLevel: 0.9,
      sourceTimestampMs: 500,
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#21 level_sample in finalized IGNORED - artifact immutable', () => {
    const st = reachFinalized();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'level_sample',
      normalizedLevel: 1.0,
      sourceTimestampMs: 999,
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#22 USER_ABORT from accumulating -> aborted, interim samples preserved', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.2, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 10 },
      { type: 'USER_ABORT' },
    ]);
    expect(finalState.state).toBe('aborted');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('aborted');
    expect(lastArtifact.amplitudeBuckets).toHaveLength(2);
    expect(lastArtifact.peakLevel).toBe(0.4);
  });

  test('#23 stream_error{metering_lost} mid-accumulation -> error', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
      { type: 'stream_error', code: 'metering_lost' },
    ]);
    expect(finalState.state).toBe('error');
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.terminalState).toBe('error');
    expect(lastArtifact.lastErrorCode).toBe('metering_lost');
    expect(lastArtifact.amplitudeBuckets).toHaveLength(1);
  });

  test('#24 AVAILABILITY_LOST mid-accumulation -> unavailable, null artifact', () => {
    const { finalState, lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 0 },
      { type: 'AVAILABILITY_LOST', reason: 'permission_revoked' },
    ]);
    expect(finalState.state).toBe('unavailable');
    expect(lastArtifact).toBeNull();
  });

  test('#25 defensive fallthrough - USER_START with waveformOfferable=false -> unavailable', () => {
    const { finalState, lastArtifact } = drive([
      {
        type: 'USER_START',
        sessionId: 's',
        waveformId: 'wf',
        capability: CAP_NOT_OFFERABLE,
        audioSource: 'metering_only',
        nowIso: START_ISO,
      },
    ]);
    expect(finalState.state).toBe('unavailable');
    expect(lastArtifact).toBeNull();
  });

  test('#26 defensive fallthrough - USER_START with meteringSupported=false -> unavailable', () => {
    const { finalState, lastArtifact } = drive([
      {
        type: 'USER_START',
        sessionId: 's',
        waveformId: 'wf',
        capability: CAP_NO_METERING,
        audioSource: 'metering_only',
        nowIso: START_ISO,
      },
    ]);
    expect(finalState.state).toBe('unavailable');
    expect(lastArtifact).toBeNull();
  });

  test('#27 late stream_error after finalized does NOT retract (INV-B7)', () => {
    const st = reachFinalized();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'stream_error',
      code: 'metering_lost',
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#28 late AVAILABILITY_LOST after aborted IGNORED', () => {
    const st = reachAborted();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'AVAILABILITY_LOST',
      reason: 'metering_disabled',
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#29 USER_START double-tap in accumulating is byte-identical no-op (INV-B6)', () => {
    const st = reachAccumulating();
    const evt: WaveformEvent = {
      type: 'USER_START',
      sessionId: 'sess-A',
      waveformId: 'wf-A',
      capability: CAP_OK,
      audioSource: 'metering_only',
      nowIso: START_ISO,
    };
    const { nextState, producedArtifact } = reduceWaveformSession(st, evt);
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#30 USER_START with DIFFERENT payload in accumulating IGNORED (hijack close, INV-B6)', () => {
    const st = reachAccumulating();
    const evt: WaveformEvent = {
      type: 'USER_START',
      sessionId: 'DIFFERENT',
      waveformId: 'wf-DIFFERENT',
      capability: CAP_OK,
      audioSource: 'metering_only',
      nowIso: '2099-01-01T00:00:00.000Z',
    };
    const { nextState, producedArtifact } = reduceWaveformSession(st, evt);
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
    // Field-level Object.is checks - none changed.
    expect(Object.is(nextState.sessionId, st.sessionId)).toBe(true);
    expect(Object.is(nextState.waveformId, st.waveformId)).toBe(true);
    expect(Object.is(nextState.audioSourceInternal, st.audioSourceInternal)).toBe(true);
    expect(Object.is(nextState.sessionStartedAt, st.sessionStartedAt)).toBe(true);
  });

  test('#31 USER_RESET from each of the 5 terminals -> idle', () => {
    const terminals: WaveformSessionMachineState[] = [
      reachFinalized(),
      reachAborted(),
      reachNoSignal(),
      reachError(),
      reachUnavailable(),
    ];
    for (const st of terminals) {
      const { nextState, producedArtifact } = reduceWaveformSession(st, {
        type: 'USER_RESET',
      });
      expect(nextState).toEqual(initialWaveformSessionState());
      expect(producedArtifact).toBeNull();
    }
  });

  test('#32 idle IGNOREs stray metering events', () => {
    const st = initialWaveformSessionState();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'level_sample',
      normalizedLevel: 0.5,
      sourceTimestampMs: 0,
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#33 out-of-order sourceTimestampMs still folds in reception order', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.6, sourceTimestampMs: 100 },
      { type: 'level_sample', normalizedLevel: 0.7, sourceTimestampMs: 50 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 200 },
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 300 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.sampleCount).toBe(5);
    // firstSampleTsMs = 0, lastSampleTsMs = 300.
    expect(lastArtifact.durationMs).toBe(300);
  });

  test('#34 non-monotonic terminal timestamps floor durationMs to 0 defensively', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 300 },
      { type: 'level_sample', normalizedLevel: 0.6, sourceTimestampMs: 100 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.durationMs).toBe(0);
  });

  test('#35 terminal fold quantization idempotent (INV-B11)', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.3333, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.6666, sourceTimestampMs: 10 },
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 20 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    // Re-quantize the buckets - result is byte-identical.
    const second = lastArtifact.amplitudeBuckets.map((b) => Math.round(b * 255) / 255);
    expect(second).toEqual([...lastArtifact.amplitudeBuckets]);
  });
});

// ---------- Error code fan-out ---------------------------------------------

describe('VOICE-004 - error code fan-out', () => {
  test.each(ALL_ERROR_CODES)(
    'stream_error{%s} from accumulating routes to error with lastErrorCode',
    (code) => {
      const st = reachAccumulating();
      const { nextState, producedArtifact } = reduceWaveformSession(st, {
        type: 'stream_error',
        code,
      });
      expect(nextState.state).toBe('error');
      expect(producedArtifact).not.toBeNull();
      expect(producedArtifact?.lastErrorCode).toBe(code);
    },
  );
});

// ---------- Blanket IGNORE matrix -------------------------------------------

describe('VOICE-004 - blanket IGNORE matrix (Cartesian state x event)', () => {
  // Pairs where the reducer SHOULD transition. Every other pair is a
  // byte-identical no-op with producedArtifact === null.
  const TRANSITIONING_PAIRS: ReadonlySet<string> = new Set([
    // idle
    'idle|USER_START',
    'idle|AVAILABILITY_LOST',
    // accumulating - every event except USER_START and USER_RESET is a transition.
    // stream_start mutates streamStartFired without changing state.state, so it
    // is a transition.
    'accumulating|USER_ABORT',
    'accumulating|AVAILABILITY_LOST',
    'accumulating|stream_start',
    'accumulating|level_sample',
    'accumulating|stream_end',
    'accumulating|stream_error',
    // finalizing
    'finalizing|USER_ABORT',
    'finalizing|AVAILABILITY_LOST',
    'finalizing|stream_end',
    'finalizing|stream_error',
    // terminals - only USER_RESET exits.
    'finalized|USER_RESET',
    'aborted|USER_RESET',
    'no_signal|USER_RESET',
    'error|USER_RESET',
    'unavailable|USER_RESET',
  ]);

  const cells: { s: WaveformSessionState; e: WaveformEvent['type'] }[] = [];
  for (const s of ALL_STATES) {
    for (const e of ALL_EVENT_TYPES) cells.push({ s, e });
  }
  const ignoreCells = cells.filter(
    ({ s, e }) => !TRANSITIONING_PAIRS.has(`${s}|${e}`),
  );

  test('the IGNORE partition covers exactly 47 cells (64 total - 17 transitioning)', () => {
    expect(ignoreCells).toHaveLength(64 - TRANSITIONING_PAIRS.size);
  });

  test.each(ignoreCells)(
    'IGNORE $s + $e - state reference unchanged AND producedArtifact null',
    ({ s, e }) => {
      const before = stateReacher(s);
      const { nextState, producedArtifact } = reduceWaveformSession(before, eventOfType(e));
      expect(producedArtifact).toBeNull();
      expect(nextState).toBe(before); // Object.is - same reference
      // Field-level Object.is (INV-B6 byte-identical).
      expect(Object.is(nextState.state, before.state)).toBe(true);
      expect(Object.is(nextState.sessionId, before.sessionId)).toBe(true);
      expect(Object.is(nextState.waveformId, before.waveformId)).toBe(true);
      expect(Object.is(nextState.audioSourceInternal, before.audioSourceInternal)).toBe(true);
      expect(Object.is(nextState.sessionStartedAt, before.sessionStartedAt)).toBe(true);
      expect(Object.is(nextState.sessionEndedAt, before.sessionEndedAt)).toBe(true);
      expect(Object.is(nextState.amplitudeBuckets, before.amplitudeBuckets)).toBe(true);
      expect(Object.is(nextState.bucketWidth, before.bucketWidth)).toBe(true);
      expect(Object.is(nextState.samplesInCurrentBucket, before.samplesInCurrentBucket)).toBe(true);
      expect(Object.is(nextState.sampleCount, before.sampleCount)).toBe(true);
      expect(Object.is(nextState.peakLevel, before.peakLevel)).toBe(true);
      expect(Object.is(nextState.meanSumIntScaled, before.meanSumIntScaled)).toBe(true);
      expect(Object.is(nextState.activeFrameCount, before.activeFrameCount)).toBe(true);
      expect(Object.is(nextState.firstSampleTsMs, before.firstSampleTsMs)).toBe(true);
      expect(Object.is(nextState.lastSampleTsMs, before.lastSampleTsMs)).toBe(true);
      expect(Object.is(nextState.streamStartFired, before.streamStartFired)).toBe(true);
      expect(Object.is(nextState.lastErrorCode, before.lastErrorCode)).toBe(true);
      expect(Object.is(nextState.terminalState, before.terminalState)).toBe(true);
    },
  );
});

// ---------- Runtime invariants ----------------------------------------------

describe('VOICE-004 - runtime invariants B1..B16', () => {
  test('INV-B1: every yielded artifact is Object.frozen AND buckets frozen', () => {
    const cases: Array<() => ReturnType<typeof reduceWaveformSession>['producedArtifact']> = [
      () => drive([
        START_EVT,
        { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 0 },
        { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 10 },
        { type: 'level_sample', normalizedLevel: 0.6, sourceTimestampMs: 20 },
        { type: 'stream_end' },
      ]).lastArtifact,
      () => drive([START_EVT, { type: 'USER_ABORT' }]).lastArtifact,
      () => drive([START_EVT, { type: 'stream_end' }]).lastArtifact,
      () => drive([START_EVT, { type: 'stream_error', code: 'native_error' }]).lastArtifact,
    ];
    for (const build of cases) {
      const art = build();
      expect(art).not.toBeNull();
      if (art === null) continue;
      expect(Object.isFrozen(art)).toBe(true);
      expect(Object.isFrozen(art.amplitudeBuckets)).toBe(true);
    }
  });

  test('INV-B2: sampleCount=0 implies empty buckets and zero scalars', () => {
    const { lastArtifact } = drive([START_EVT, { type: 'stream_end' }]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.sampleCount).toBe(0);
    expect(lastArtifact.amplitudeBuckets).toEqual([]);
    expect(lastArtifact.peakLevel).toBe(0);
    expect(lastArtifact.meanLevel).toBe(0);
    expect(lastArtifact.activeDurationMs).toBe(0);
  });

  test('INV-B3: reducer NEVER throws on malformed level_sample input', () => {
    const malformed: number[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1000,
      -0.0001,
      1.0001,
      1e100,
    ];
    for (const bad of malformed) {
      expect(() => {
        drive([
          START_EVT,
          { type: 'level_sample', normalizedLevel: bad, sourceTimestampMs: 0 },
          { type: 'stream_end' },
        ]);
      }).not.toThrow();
    }
  });

  test('INV-B4: amplitudeBuckets.length <= MAX_AMPLITUDE_BUCKETS (256)', () => {
    // Drive 60,000 samples - well past the halving threshold.
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 60000; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: (i % 100) / 100,
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.amplitudeBuckets.length).toBeLessThanOrEqual(MAX_AMPLITUDE_BUCKETS);
  });

  test('INV-B5: every bucket element is finite and in [0, 1]', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.1, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: Number.NaN, sourceTimestampMs: 10 },
      { type: 'level_sample', normalizedLevel: 5, sourceTimestampMs: 20 },
      { type: 'level_sample', normalizedLevel: 0.7, sourceTimestampMs: 30 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    for (const b of lastArtifact.amplitudeBuckets) {
      expect(Number.isFinite(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  test('INV-B6: USER_START in accumulating and finalizing is byte-identical no-op', () => {
    const reachers: Array<() => WaveformSessionMachineState> = [
      reachAccumulating,
      reachFinalizing,
    ];
    for (const build of reachers) {
      const st = build();
      const evt: WaveformEvent = {
        type: 'USER_START',
        sessionId: 'DIFFERENT',
        waveformId: 'DIFFERENT',
        capability: CAP_OK,
        audioSource: 'metering_only',
        nowIso: '2099-01-01T00:00:00.000Z',
      };
      const { nextState, producedArtifact } = reduceWaveformSession(st, evt);
      expect(nextState).toBe(st);
      expect(producedArtifact).toBeNull();
    }
  });

  test('INV-B7: producedArtifact non-null only on terminal-yielding transitions', () => {
    const events: WaveformEvent[] = [
      START_EVT,
      { type: 'stream_start' },
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 10 },
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 20 },
      { type: 'stream_end' },
    ];
    const { perStep } = drive(events);
    for (let i = 0; i < perStep.length - 1; i += 1) {
      expect(perStep[i].producedArtifact).toBeNull();
    }
    expect(perStep[perStep.length - 1].producedArtifact).not.toBeNull();
  });

  test('INV-B7b: producedArtifact null on transitions into unavailable and on IGNORE', () => {
    const { producedArtifact } = reduceWaveformSession(initialWaveformSessionState(), {
      type: 'AVAILABILITY_LOST',
      reason: 'metering_disabled',
    });
    expect(producedArtifact).toBeNull();
  });

  test('INV-B8: JSON round-trip preserves every yielded artifact including buckets', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 10 },
      { type: 'level_sample', normalizedLevel: 0.7, sourceTimestampMs: 20 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    const parsed = JSON.parse(JSON.stringify(lastArtifact));
    expect(parsed).toEqual(lastArtifact);
    expect(typeof parsed.sessionStartedAt).toBe('string');
    expect(typeof parsed.sessionEndedAt).toBe('string');
    expect(Array.isArray(parsed.amplitudeBuckets)).toBe(true);
  });

  test('INV-B9: level_sample in finalizing is a byte-identical no-op', () => {
    const st = reachFinalizing();
    const { nextState, producedArtifact } = reduceWaveformSession(st, {
      type: 'level_sample',
      normalizedLevel: 0.9,
      sourceTimestampMs: 0,
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('INV-B10: sessionEndedAt >= sessionStartedAt on every yielded artifact', () => {
    const cases: WaveformEvent[][] = [
      [
        START_EVT,
        { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 0 },
        { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 100 },
        { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 200 },
        { type: 'stream_end' },
      ],
      [START_EVT, { type: 'USER_ABORT' }],
      [START_EVT, { type: 'stream_end' }],
      [START_EVT, { type: 'stream_error', code: 'audio_route_lost' }],
    ];
    for (const events of cases) {
      const { lastArtifact } = drive(events);
      expect(lastArtifact).not.toBeNull();
      if (lastArtifact === null) continue;
      // Format-regex check first, then string compare on Z-suffixed strings.
      const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(iso.test(lastArtifact.sessionStartedAt)).toBe(true);
      expect(iso.test(lastArtifact.sessionEndedAt)).toBe(true);
      expect(lastArtifact.sessionEndedAt >= lastArtifact.sessionStartedAt).toBe(true);
    }
  });

  test('INV-B11: quantized to 8-bit precision - every bucket is k/255 for integer k in [0,255]', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 100; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: Math.random(),
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    for (const b of lastArtifact.amplitudeBuckets) {
      const k = Math.round(b * 255);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(255);
      expect(b).toBeCloseTo(k / 255, 12);
    }
  });

  test('INV-B12: module constants export at expected values', () => {
    expect(SILENCE_THRESHOLD).toBe(0.02);
    expect(MIN_SAMPLES_FOR_FINALIZED).toBe(3);
    expect(MAX_AMPLITUDE_BUCKETS).toBe(256);
    expect(VOICE_WAVEFORM_MACHINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('INV-B13: meanLevel pinned - re-derived scalar reference matches', () => {
    // See scenario #18 for the reference-scalar derivation. This test
    // asserts the pinned invariant holds across arbitrary sequences by
    // comparing to a pure re-derivation.
    const N = 1000;
    const levels: number[] = [];
    for (let i = 0; i < N; i += 1) levels.push(((i * 13) % 100) / 100);
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < N; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: levels[i],
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    let sum = 0;
    for (const level of levels) sum += Math.round(level * 65535);
    const ref = sum / N / 65535;
    expect(lastArtifact.meanLevel).toBe(ref);
  });

  test('INV-B14: rate-invariance - covered in scenario #14', () => {
    // Assertion is in scenario #14; this test reasserts on a shorter fixture.
    const levels = [0.1, 0.5, 0.9, 0.3];
    function run(step: number): ReturnType<typeof reduceWaveformSession>['producedArtifact'] {
      const events: WaveformEvent[] = [START_EVT];
      for (let i = 0; i < levels.length; i += 1) {
        events.push({
          type: 'level_sample',
          normalizedLevel: levels[i],
          sourceTimestampMs: i * step,
        });
      }
      events.push({ type: 'stream_end' });
      return drive(events).lastArtifact;
    }
    const a = run(10);
    const b = run(100);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (a === null || b === null) return;
    expect(a.amplitudeBuckets).toEqual(b.amplitudeBuckets);
    expect(a.peakLevel).toBe(b.peakLevel);
    expect(a.meanLevel).toBe(b.meanLevel);
  });

  test('INV-B15: halving-fold determinism - covered in scenario #15', () => {
    // Same idea, smaller fixture.
    const N = 400;
    function run(chunkSize: number): ReturnType<typeof reduceWaveformSession>['producedArtifact'] {
      let state = initialWaveformSessionState();
      state = reduceWaveformSession(state, START_EVT).nextState;
      let i = 0;
      while (i < N) {
        const bound = Math.min(i + chunkSize, N);
        for (let j = i; j < bound; j += 1) {
          state = reduceWaveformSession(state, {
            type: 'level_sample',
            normalizedLevel: (j % 10) / 10,
            sourceTimestampMs: j,
          }).nextState;
        }
        i = bound;
      }
      return reduceWaveformSession(state, { type: 'stream_end' }).producedArtifact;
    }
    const base = run(1);
    const k5 = run(5);
    expect(base).not.toBeNull();
    expect(k5).not.toBeNull();
    if (base === null || k5 === null) return;
    expect(k5.amplitudeBuckets).toEqual(base.amplitudeBuckets);
    expect(k5.peakLevel).toBe(base.peakLevel);
    expect(k5.meanLevel).toBe(base.meanLevel);
  });

  test('INV-B16: entropy bound - distinct bucket values <= 256', () => {
    const events: WaveformEvent[] = [START_EVT];
    for (let i = 0; i < 10000; i += 1) {
      events.push({
        type: 'level_sample',
        normalizedLevel: Math.random(),
        sourceTimestampMs: i,
      });
    }
    events.push({ type: 'stream_end' });
    const { lastArtifact } = drive(events);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    const distinct = new Set(lastArtifact.amplitudeBuckets);
    expect(distinct.size).toBeLessThanOrEqual(256);
  });

  test('initialWaveformSessionState returns idle with cleared fields', () => {
    const s = initialWaveformSessionState();
    expect(s.state).toBe('idle');
    expect(s.sessionId).toBeNull();
    expect(s.waveformId).toBeNull();
    expect(s.audioSourceInternal).toBeNull();
    expect(s.sessionStartedAt).toBeNull();
    expect(s.sessionEndedAt).toBeNull();
    expect(s.amplitudeBuckets).toEqual([]);
    expect(s.bucketWidth).toBe(1);
    expect(s.samplesInCurrentBucket).toBe(0);
    expect(s.sampleCount).toBe(0);
    expect(s.peakLevel).toBe(0);
    expect(s.meanSumIntScaled).toBe(0);
    expect(s.activeFrameCount).toBe(0);
    expect(s.firstSampleTsMs).toBeNull();
    expect(s.lastSampleTsMs).toBeNull();
    expect(s.streamStartFired).toBe(false);
    expect(s.lastErrorCode).toBeNull();
    expect(s.terminalState).toBeNull();
  });

  test('produced artifact carries the module version', () => {
    const { lastArtifact } = drive([
      START_EVT,
      { type: 'level_sample', normalizedLevel: 0.3, sourceTimestampMs: 0 },
      { type: 'level_sample', normalizedLevel: 0.4, sourceTimestampMs: 10 },
      { type: 'level_sample', normalizedLevel: 0.5, sourceTimestampMs: 20 },
      { type: 'stream_end' },
    ]);
    expect(lastArtifact).not.toBeNull();
    if (lastArtifact === null) return;
    expect(lastArtifact.producedByModuleVersion).toBe(VOICE_WAVEFORM_MACHINE_VERSION);
  });
});
