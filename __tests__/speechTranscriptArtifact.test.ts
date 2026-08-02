/**
 * VOICE-003 (issue 661) - SpeechTranscriptArtifact type-level and
 * runtime-invariant coverage (T-A1..T-A12).
 *
 * The type-level assertions use a manual Equals conditional-type helper
 * because the repo does not depend on expectTypeOf or tsd. A build-time
 * error at the AssertTrue line is the desired failure mode.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import {
  initialSpeechSessionState,
  reduceSpeechSession,
  type RecognizerEvent,
  type SpeechCapabilitySnapshot,
} from '../src/features/voice/speech/speechSessionMachine';
import type {
  FreshSpeechTranscriptArtifact,
  SpeechTranscriptArtifact,
  TerminalStateForArtifact,
} from '../src/features/voice/speech/speechTranscriptArtifact.types';

// ---------- TypeEqual helper -----------------------------------------------

// Standard exact-type-equality trick using function contravariance so
// { readonly x: number } is not falsely equal to { x: number }.
type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// Consumed by the _T_* type aliases below.
type AssertTrue<T extends true> = T;

// ---------- T-A1: audioUri is literal null ---------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A1 = AssertTrue<Equals<SpeechTranscriptArtifact['audioUri'], null>>;

// ---------- T-A2: reducer produced-artifact is Fresh-narrowed --------------

// The reducer return type says producedArtifact is FreshSpeechTranscriptArtifact | null.
// Narrowed audioPersistence is exactly the literal 'none' (not the wider union).
type ProducedArtifactOrNull = ReturnType<typeof reduceSpeechSession>['producedArtifact'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A2 = AssertTrue<Equals<ProducedArtifactOrNull, FreshSpeechTranscriptArtifact | null>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A2b = AssertTrue<Equals<FreshSpeechTranscriptArtifact['audioPersistence'], 'none'>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A2c = AssertTrue<Equals<FreshSpeechTranscriptArtifact['wasEdited'], false>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A2d = AssertTrue<Equals<FreshSpeechTranscriptArtifact['editDistance'], 0>>;

// ---------- T-A3: terminalState union excludes unavailable ----------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A3 = AssertTrue<
  Equals<
    SpeechTranscriptArtifact['terminalState'],
    'final' | 'interrupted' | 'timeout_no_speech' | 'error'
  >
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A3b = AssertTrue<
  Equals<TerminalStateForArtifact, 'final' | 'interrupted' | 'timeout_no_speech' | 'error'>
>;

// ---------- T-A4: keyof SpeechTranscriptArtifact does NOT include submittedBody ----

// If 'submittedBody' were a key, Exclude removing it would not equal keyof.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _T_A4 = AssertTrue<
  Equals<
    Exclude<keyof SpeechTranscriptArtifact, 'submittedBody'>,
    keyof SpeechTranscriptArtifact
  >
>;

// ---------- Runtime helpers -------------------------------------------------

const CAP_OK: SpeechCapabilitySnapshot = {
  voiceOfferable: true,
  recognizer: 'ios',
  onDeviceRecognition: true,
  language: 'en-US',
};

const START_EVT: RecognizerEvent = {
  type: 'USER_START',
  sessionId: 'sess-A',
  transcriptId: 'tx-A',
  capability: CAP_OK,
  nowIso: '2026-08-01T00:00:00.000Z',
};

function driveTo(events: RecognizerEvent[]): FreshSpeechTranscriptArtifact | null {
  let state = initialSpeechSessionState();
  let last: ReturnType<typeof reduceSpeechSession> = {
    nextState: state,
    producedArtifact: null,
  };
  for (const ev of events) {
    last = reduceSpeechSession(state, ev);
    state = last.nextState;
  }
  return last.producedArtifact;
}

// Runs the reducer once and returns the produced artifact.
function stepArtifact(events: RecognizerEvent[]): FreshSpeechTranscriptArtifact {
  const art = driveTo(events);
  if (art === null) throw new Error('expected artifact');
  return art;
}

// ---------- T-A5: Object.isFrozen(artifact) === true -----------------------

describe('T-A5 - every yielded artifact is Object.frozen', () => {
  test.each<[string, RecognizerEvent[]]>([
    [
      'final',
      [START_EVT, { type: 'start' }, { type: 'result_final', transcript: 'x' }],
    ],
    [
      'interrupted',
      [START_EVT, { type: 'start' }, { type: 'USER_ABORT' }],
    ],
    [
      'timeout_no_speech',
      [START_EVT, { type: 'start' }, { type: 'nomatch' }],
    ],
    [
      'error',
      [START_EVT, { type: 'start' }, { type: 'error', code: 'network' }],
    ],
  ])('%s terminal artifact is frozen', (_label, events) => {
    const art = stepArtifact(events);
    expect(Object.isFrozen(art)).toBe(true);
  });
});

// ---------- T-A6: strict-mode assignment throws TypeError ------------------

describe('T-A6 - frozen artifact refuses mutation', () => {
  test('strict-mode reassignment throws', () => {
    'use strict';
    const art = stepArtifact([
      START_EVT,
      { type: 'start' },
      { type: 'result_final', transcript: 'x' },
    ]);
    expect(() => {
      (art as unknown as { rawTranscript: string }).rawTranscript = 'mutated';
    }).toThrow(TypeError);
  });
});

// ---------- T-A7: JSON round-trip deep-equal -------------------------------

describe('T-A7 - JSON round-trip preserves the artifact', () => {
  test('round-trip on a final artifact', () => {
    const art = stepArtifact([
      START_EVT,
      { type: 'start' },
      { type: 'result_interim', transcript: 'p' },
      { type: 'result_final', transcript: 'the body' },
    ]);
    const parsed = JSON.parse(JSON.stringify(art)) as SpeechTranscriptArtifact;
    expect(parsed).toEqual(art);
  });

  test('round-trip on a timeout_no_speech artifact', () => {
    const art = stepArtifact([
      START_EVT,
      { type: 'start' },
      { type: 'nomatch' },
    ]);
    const parsed = JSON.parse(JSON.stringify(art)) as SpeechTranscriptArtifact;
    expect(parsed).toEqual(art);
  });
});

// ---------- T-A8: hadFinalEvent=false implies rawTranscript='' -------------

describe('T-A8 - hadFinalEvent=false implies rawTranscript empty', () => {
  test.each<[string, RecognizerEvent[]]>([
    ['interrupted', [START_EVT, { type: 'start' }, { type: 'USER_ABORT' }]],
    ['timeout_no_speech', [START_EVT, { type: 'start' }, { type: 'nomatch' }]],
    ['error', [START_EVT, { type: 'start' }, { type: 'error', code: 'network' }]],
    [
      'timeout_no_speech via empty final',
      [START_EVT, { type: 'start' }, { type: 'result_final', transcript: '' }],
    ],
  ])('%s artifact carries hadFinalEvent=false and rawTranscript=empty', (_label, events) => {
    const art = stepArtifact(events);
    expect(art.hadFinalEvent).toBe(false);
    expect(art.rawTranscript).toBe('');
  });
});

// ---------- T-A9: interimCount and editDistance non-negative ---------------

describe('T-A9 - interimCount and editDistance are non-negative', () => {
  test('final artifact has non-negative counters', () => {
    const art = stepArtifact([
      START_EVT,
      { type: 'start' },
      { type: 'result_interim', transcript: 'a' },
      { type: 'result_interim', transcript: 'ab' },
      { type: 'result_final', transcript: 'abc' },
    ]);
    expect(art.interimCount).toBeGreaterThanOrEqual(0);
    expect(art.editDistance).toBeGreaterThanOrEqual(0);
  });
});

// ---------- T-A10: sessionEndedAt >= sessionStartedAt ----------------------

describe('T-A10 - sessionEndedAt is not earlier than sessionStartedAt', () => {
  test.each<[string, RecognizerEvent[]]>([
    ['final', [START_EVT, { type: 'start' }, { type: 'result_final', transcript: 'x' }]],
    ['interrupted', [START_EVT, { type: 'start' }, { type: 'USER_ABORT' }]],
    ['timeout_no_speech', [START_EVT, { type: 'start' }, { type: 'nomatch' }]],
    ['error', [START_EVT, { type: 'start' }, { type: 'error', code: 'audio-capture' }]],
  ])('%s artifact: sessionEndedAt >= sessionStartedAt', (_label, events) => {
    const art = stepArtifact(events);
    expect(art.sessionEndedAt >= art.sessionStartedAt).toBe(true);
  });
});

// ---------- T-A11: no artifact on unavailable ------------------------------

describe('T-A11 - unavailable transitions never yield an artifact', () => {
  test('idle + USER_START (voiceOfferable=false) yields null', () => {
    const st = initialSpeechSessionState();
    const capUnavailable: SpeechCapabilitySnapshot = {
      voiceOfferable: false,
      recognizer: 'web',
      onDeviceRecognition: false,
      language: 'en-US',
    };
    const { producedArtifact } = reduceSpeechSession(st, {
      type: 'USER_START',
      sessionId: 's',
      transcriptId: 't',
      capability: capUnavailable,
      nowIso: '2026-08-01T00:00:00.000Z',
    });
    expect(producedArtifact).toBeNull();
  });

  test('idle + AVAILABILITY_LOST yields null', () => {
    const st = initialSpeechSessionState();
    const { producedArtifact } = reduceSpeechSession(st, {
      type: 'AVAILABILITY_LOST',
      reason: 'recognizer_disabled',
    });
    expect(producedArtifact).toBeNull();
  });

  test('starting + AVAILABILITY_LOST yields null', () => {
    const drivenState = reduceSpeechSession(initialSpeechSessionState(), START_EVT).nextState;
    const { producedArtifact } = reduceSpeechSession(drivenState, {
      type: 'AVAILABILITY_LOST',
      reason: 'permission_revoked',
    });
    expect(producedArtifact).toBeNull();
  });
});

// ---------- T-A12: fresh literals on every yielded artifact ----------------

describe('T-A12 - fresh literals on every yielded artifact', () => {
  test.each<[string, RecognizerEvent[]]>([
    ['final', [START_EVT, { type: 'start' }, { type: 'result_final', transcript: 'x' }]],
    ['interrupted', [START_EVT, { type: 'start' }, { type: 'USER_ABORT' }]],
    ['timeout_no_speech', [START_EVT, { type: 'start' }, { type: 'nomatch' }]],
    ['error', [START_EVT, { type: 'start' }, { type: 'error', code: 'network' }]],
  ])('%s artifact carries fresh literals', (_label, events) => {
    const art = stepArtifact(events);
    expect(art.audioPersistence).toBe('none');
    expect(art.audioUri).toBeNull();
    expect(art.wasEdited).toBe(false);
    expect(art.editDistance).toBe(0);
  });
});
