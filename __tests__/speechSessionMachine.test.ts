/**
 * VOICE-003 (issue 661) - reducer scenario matrix + runtime invariants.
 *
 * Covers the 10-state x 12-event transition table (120 cells) with 41
 * named scenarios plus a blanket IGNORE matrix over every cell not
 * covered above (asserts nextState is byte-identical AND producedArtifact
 * is null). Runtime invariants B1..B9 are asserted here; type-level
 * invariants live in speechTranscriptArtifact.test.ts.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import {
  initialSpeechSessionState,
  reduceSpeechSession,
  SPEECH_SESSION_MACHINE_VERSION,
  type RecognizerEvent,
  type SpeechCapabilitySnapshot,
  type SpeechErrorCode,
  type SpeechSessionMachineState,
  type SpeechSessionState,
} from '../src/features/voice/speech/speechSessionMachine';

// ---------- Fixtures --------------------------------------------------------

const CAP_OK: SpeechCapabilitySnapshot = Object.freeze({
  voiceOfferable: true,
  recognizer: 'web',
  onDeviceRecognition: false,
  language: 'en-US',
});

const CAP_UNAVAILABLE: SpeechCapabilitySnapshot = Object.freeze({
  voiceOfferable: false,
  recognizer: 'web',
  onDeviceRecognition: false,
  language: 'en-US',
});

const START_ISO = '2026-08-01T00:00:00.000Z';

const START_EVT: RecognizerEvent = Object.freeze({
  type: 'USER_START',
  sessionId: 'sess-1',
  transcriptId: 'tx-1',
  capability: CAP_OK,
  nowIso: START_ISO,
});

const START_EVT_UNAVAILABLE: RecognizerEvent = Object.freeze({
  type: 'USER_START',
  sessionId: 'sess-1',
  transcriptId: 'tx-1',
  capability: CAP_UNAVAILABLE,
  nowIso: START_ISO,
});

// Apply a sequence of events and return the accumulated (state, lastResult).
function drive(events: RecognizerEvent[]): {
  finalState: SpeechSessionMachineState;
  lastArtifact: ReturnType<typeof reduceSpeechSession>['producedArtifact'];
  perStep: ReturnType<typeof reduceSpeechSession>[];
} {
  let state = initialSpeechSessionState();
  let last: ReturnType<typeof reduceSpeechSession> = {
    nextState: state,
    producedArtifact: null,
  };
  const perStep: ReturnType<typeof reduceSpeechSession>[] = [];
  for (const ev of events) {
    last = reduceSpeechSession(state, ev);
    state = last.nextState;
    perStep.push(last);
  }
  return { finalState: state, lastArtifact: last.producedArtifact, perStep };
}

// Reach a specific active state deterministically.
function reachStarting(): SpeechSessionMachineState {
  return drive([START_EVT]).finalState;
}
function reachListening(): SpeechSessionMachineState {
  return drive([START_EVT, { type: 'start' }]).finalState;
}
function reachInterim(interimCount = 1): SpeechSessionMachineState {
  const events: RecognizerEvent[] = [START_EVT, { type: 'start' }];
  for (let i = 0; i < interimCount; i += 1) {
    events.push({ type: 'result_interim', transcript: `partial ${i}` });
  }
  return drive(events).finalState;
}
function reachFinalizing(): SpeechSessionMachineState {
  return drive([START_EVT, { type: 'start' }, { type: 'speechend' }]).finalState;
}
function reachFinal(): SpeechSessionMachineState {
  return drive([
    START_EVT,
    { type: 'start' },
    { type: 'result_final', transcript: 'hello world' },
  ]).finalState;
}
function reachInterrupted(): SpeechSessionMachineState {
  return drive([START_EVT, { type: 'start' }, { type: 'USER_ABORT' }]).finalState;
}
function reachTimeoutNoSpeech(): SpeechSessionMachineState {
  return drive([START_EVT, { type: 'start' }, { type: 'nomatch' }]).finalState;
}
function reachError(): SpeechSessionMachineState {
  return drive([
    START_EVT,
    { type: 'start' },
    { type: 'error', code: 'network' },
  ]).finalState;
}
function reachUnavailable(): SpeechSessionMachineState {
  return drive([START_EVT, { type: 'AVAILABILITY_LOST', reason: 'permission_revoked' }])
    .finalState;
}

const ALL_STATES: readonly SpeechSessionState[] = Object.freeze([
  'idle',
  'starting',
  'listening',
  'interim',
  'finalizing',
  'final',
  'interrupted',
  'timeout_no_speech',
  'error',
  'unavailable',
]);

const ALL_EVENT_TYPES: readonly RecognizerEvent['type'][] = Object.freeze([
  'USER_START',
  'USER_ABORT',
  'USER_RESET',
  'AVAILABILITY_LOST',
  'start',
  'speechstart',
  'result_interim',
  'result_final',
  'speechend',
  'end',
  'nomatch',
  'error',
]);

const ALL_ERROR_CODES: readonly SpeechErrorCode[] = Object.freeze([
  'no-speech',
  'aborted',
  'audio-capture',
  'network',
  'not-allowed',
  'service-not-allowed',
  'bad-grammar',
  'language-not-supported',
]);

// Build a canonical event for each event type. Payload-carrying events
// use safe placeholder values.
function eventOfType(t: RecognizerEvent['type']): RecognizerEvent {
  switch (t) {
    case 'USER_START':
      return START_EVT;
    case 'USER_ABORT':
      return { type: 'USER_ABORT' };
    case 'USER_RESET':
      return { type: 'USER_RESET' };
    case 'AVAILABILITY_LOST':
      return { type: 'AVAILABILITY_LOST', reason: 'permission_revoked' };
    case 'start':
      return { type: 'start' };
    case 'speechstart':
      return { type: 'speechstart' };
    case 'result_interim':
      return { type: 'result_interim', transcript: 'partial' };
    case 'result_final':
      return { type: 'result_final', transcript: 'body text' };
    case 'speechend':
      return { type: 'speechend' };
    case 'end':
      return { type: 'end' };
    case 'nomatch':
      return { type: 'nomatch' };
    case 'error':
      return { type: 'error', code: 'network' };
  }
}

function stateReacher(s: SpeechSessionState): SpeechSessionMachineState {
  switch (s) {
    case 'idle':
      return initialSpeechSessionState();
    case 'starting':
      return reachStarting();
    case 'listening':
      return reachListening();
    case 'interim':
      return reachInterim(1);
    case 'finalizing':
      return reachFinalizing();
    case 'final':
      return reachFinal();
    case 'interrupted':
      return reachInterrupted();
    case 'timeout_no_speech':
      return reachTimeoutNoSpeech();
    case 'error':
      return reachError();
    case 'unavailable':
      return reachUnavailable();
  }
}

// ---------- Scenario suite (41 named cases) ---------------------------------

describe('VOICE-003 - reduceSpeechSession named scenarios', () => {
  test('#1 happy path: mic 3 interims then final then end', () => {
    const events: RecognizerEvent[] = [
      START_EVT,
      { type: 'start' },
      { type: 'speechstart' },
      { type: 'result_interim', transcript: 'hel' },
      { type: 'result_interim', transcript: 'hello' },
      { type: 'result_interim', transcript: 'hello wor' },
      { type: 'result_final', transcript: 'hello world' },
      { type: 'end' },
    ];
    const { finalState, perStep } = drive(events);
    expect(finalState.state).toBe('final');
    // Artifact yielded exactly on the result_final step.
    const yielded = perStep.filter((r) => r.producedArtifact !== null);
    expect(yielded).toHaveLength(1);
    const art = yielded[0].producedArtifact!;
    expect(art.hadFinalEvent).toBe(true);
    expect(art.rawTranscript).toBe('hello world');
    expect(art.interimCount).toBe(3);
    expect(art.wasEdited).toBe(false);
    expect(art.editDistance).toBe(0);
    expect(art.audioPersistence).toBe('none');
    expect(art.audioUri).toBeNull();
    expect(art.terminalState).toBe('final');
  });

  test('#2 fast path: recognizer emits final directly from listening', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: 'quick',
    });
    expect(nextState.state).toBe('final');
    expect(producedArtifact!.hadFinalEvent).toBe(true);
    expect(producedArtifact!.interimCount).toBe(0);
    expect(producedArtifact!.rawTranscript).toBe('quick');
  });

  test('#3 fast-fast path: final before start callback fires', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: 'oh',
    });
    expect(nextState.state).toBe('final');
    expect(producedArtifact!.hadFinalEvent).toBe(true);
  });

  test('#4 interim then final ordering', () => {
    const st = reachInterim(2);
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: 'the body',
    });
    expect(nextState.state).toBe('final');
    expect(producedArtifact!.hadFinalEvent).toBe(true);
    expect(producedArtifact!.rawTranscript).toBe('the body');
  });

  test('#5 speechend then final ordering routes through finalizing', () => {
    const st = reachInterim(1);
    const afterSpeechend = reduceSpeechSession(st, { type: 'speechend' });
    expect(afterSpeechend.nextState.state).toBe('finalizing');
    expect(afterSpeechend.producedArtifact).toBeNull();
    const afterFinal = reduceSpeechSession(afterSpeechend.nextState, {
      type: 'result_final',
      transcript: 'done',
    });
    expect(afterFinal.nextState.state).toBe('final');
    expect(afterFinal.producedArtifact!.hadFinalEvent).toBe(true);
  });

  test('#6 late interim after speechend is IGNORED (INV-21)', () => {
    const st = reachFinalizing();
    const before = { count: st.interimCount, text: st.latestInterimText };
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_interim',
      transcript: 'late ghost',
    });
    expect(nextState.state).toBe('finalizing');
    expect(nextState.interimCount).toBe(before.count);
    expect(nextState.latestInterimText).toBe(before.text);
    expect(producedArtifact).toBeNull();
  });

  test('#7 end without final from listening -> timeout_no_speech', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'end' });
    expect(nextState.state).toBe('timeout_no_speech');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
    expect(producedArtifact!.rawTranscript).toBe('');
    expect(producedArtifact!.interimCount).toBe(0);
  });

  test('#8 end without final from interim -> timeout_no_speech (no auto-promote)', () => {
    const st = reachInterim(2);
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'end' });
    expect(nextState.state).toBe('timeout_no_speech');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
    expect(producedArtifact!.rawTranscript).toBe('');
    expect(producedArtifact!.interimCount).toBe(2);
  });

  test('#9 end without final from finalizing -> timeout_no_speech', () => {
    const st = reachFinalizing();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'end' });
    expect(nextState.state).toBe('timeout_no_speech');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
  });

  test('#10 empty result_final routes to timeout_no_speech (INV-B9)', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: '',
    });
    expect(nextState.state).toBe('timeout_no_speech');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
    expect(producedArtifact!.rawTranscript).toBe('');
  });

  test('#11 nomatch from listening -> timeout_no_speech', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'nomatch' });
    expect(nextState.state).toBe('timeout_no_speech');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
  });

  test('#12 nomatch then end from interim - trailing end is no-op', () => {
    const st = reachInterim(1);
    const r1 = reduceSpeechSession(st, { type: 'nomatch' });
    expect(r1.nextState.state).toBe('timeout_no_speech');
    const r2 = reduceSpeechSession(r1.nextState, { type: 'end' });
    expect(r2.nextState).toBe(r1.nextState); // Object.is - same reference
    expect(r2.producedArtifact).toBeNull();
  });

  test('#13 phantom pre-speech speechend from listening -> finalizing', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'speechend' });
    expect(nextState.state).toBe('finalizing');
    expect(nextState.interimCount).toBe(0);
    expect(nextState.speechStartFired).toBe(false);
    expect(producedArtifact).toBeNull();
  });

  test('#14 phantom pre-start speechend from starting is IGNORED', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'speechend' });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#15 speechstart before start (some platforms) -> listening', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'speechstart' });
    expect(nextState.state).toBe('listening');
    expect(nextState.speechStartFired).toBe(true);
    expect(producedArtifact).toBeNull();
  });

  test('#16 interim before start (some platforms) -> interim', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_interim',
      transcript: 'oh',
    });
    expect(nextState.state).toBe('interim');
    expect(nextState.interimCount).toBe(1);
    expect(nextState.speechStartFired).toBe(true);
    expect(producedArtifact).toBeNull();
  });

  test('#17 USER_ABORT from listening -> interrupted (distinct from error{aborted})', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'USER_ABORT' });
    expect(nextState.state).toBe('interrupted');
    expect(producedArtifact!.hadFinalEvent).toBe(false);
    expect(producedArtifact!.terminalState).toBe('interrupted');
  });

  test('#18 USER_ABORT then error{aborted} - reducer defensively no-ops', () => {
    const st = reachListening();
    const r1 = reduceSpeechSession(st, { type: 'USER_ABORT' });
    expect(r1.nextState.state).toBe('interrupted');
    const r2 = reduceSpeechSession(r1.nextState, { type: 'error', code: 'aborted' });
    expect(r2.nextState).toBe(r1.nextState);
    expect(r2.producedArtifact).toBeNull();
  });

  test('#19 recognizer error{network} mid-stream -> error', () => {
    const st = reachInterim(1);
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'error',
      code: 'network',
    });
    expect(nextState.state).toBe('error');
    expect(nextState.lastErrorCode).toBe('network');
    expect(producedArtifact!.terminalState).toBe('error');
  });

  test('#20 error{not-allowed} during starting -> error (state machine does not distinguish permission)', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'error',
      code: 'not-allowed',
    });
    expect(nextState.state).toBe('error');
    expect(nextState.lastErrorCode).toBe('not-allowed');
    expect(producedArtifact!.terminalState).toBe('error');
  });

  test('#21 error{no-speech} during listening then trailing end is no-op', () => {
    const st = reachListening();
    const r1 = reduceSpeechSession(st, { type: 'error', code: 'no-speech' });
    expect(r1.nextState.state).toBe('timeout_no_speech');
    const r2 = reduceSpeechSession(r1.nextState, { type: 'end' });
    expect(r2.nextState).toBe(r1.nextState);
    expect(r2.producedArtifact).toBeNull();
  });

  test('#22 error{language-not-supported} in starting -> error', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'error',
      code: 'language-not-supported',
    });
    expect(nextState.state).toBe('error');
    expect(producedArtifact!.terminalState).toBe('error');
  });

  test('#23 recognizer end from starting -> interrupted', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'end' });
    expect(nextState.state).toBe('interrupted');
    expect(producedArtifact!.terminalState).toBe('interrupted');
  });

  test('#24 AVAILABILITY_LOST mid-listen -> unavailable, no artifact', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'AVAILABILITY_LOST',
      reason: 'permission_revoked',
    });
    expect(nextState.state).toBe('unavailable');
    expect(producedArtifact).toBeNull();
  });

  test('#25 AVAILABILITY_LOST during starting -> unavailable, no artifact', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'AVAILABILITY_LOST',
      reason: 'recognizer_disabled',
    });
    expect(nextState.state).toBe('unavailable');
    expect(producedArtifact).toBeNull();
  });

  test('#26 defensive: USER_START with voiceOfferable=false -> unavailable', () => {
    const st = initialSpeechSessionState();
    const { nextState, producedArtifact } = reduceSpeechSession(st, START_EVT_UNAVAILABLE);
    expect(nextState.state).toBe('unavailable');
    expect(producedArtifact).toBeNull();
  });

  test('#27 late error after final does NOT retract artifact (INV-B7)', () => {
    const st = reachFinal();
    const before = { ...st };
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'error',
      code: 'network',
    });
    expect(nextState).toBe(st);
    expect(nextState.rawTranscript).toBe(before.rawTranscript);
    expect(producedArtifact).toBeNull();
  });

  test('#28 second result_final after final is IGNORED (first final wins)', () => {
    const st = reachFinal();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: 'overwrite attempt',
    });
    expect(nextState).toBe(st);
    expect(nextState.rawTranscript).toBe('hello world');
    expect(producedArtifact).toBeNull();
  });

  test('#29 late result_interim in final IGNORED', () => {
    const st = reachFinal();
    const before = st.interimCount;
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_interim',
      transcript: 'ghost',
    });
    expect(nextState).toBe(st);
    expect(nextState.interimCount).toBe(before);
    expect(producedArtifact).toBeNull();
  });

  test('#30 AVAILABILITY_LOST in a terminal is IGNORED (first terminal wins)', () => {
    const st = reachError();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'AVAILABILITY_LOST',
      reason: 'service_unreachable',
    });
    expect(nextState).toBe(st);
    expect(nextState.state).toBe('error');
    expect(producedArtifact).toBeNull();
  });

  test('#31 terminal-plus-terminal race: trailing end in error is IGNORED', () => {
    const st = reachError();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'end' });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#32 USER_START double-tap in starting is a byte-identical no-op (INV-B6)', () => {
    const st = reachStarting();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'USER_START',
      sessionId: 'sess-DIFFERENT',
      transcriptId: 'tx-DIFFERENT',
      capability: CAP_OK,
      nowIso: '2099-12-31T00:00:00.000Z',
    });
    expect(nextState).toBe(st);
    expect(nextState.transcriptId).toBe('tx-1');
    expect(nextState.sessionStartedAt).toBe(START_ISO);
    expect(producedArtifact).toBeNull();
  });

  test('#33 USER_START in listening is a no-op', () => {
    const st = reachListening();
    const { nextState, producedArtifact } = reduceSpeechSession(st, START_EVT);
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#34 USER_RESET from final -> idle', () => {
    const st = reachFinal();
    const { nextState, producedArtifact } = reduceSpeechSession(st, { type: 'USER_RESET' });
    expect(nextState).toEqual(initialSpeechSessionState());
    expect(producedArtifact).toBeNull();
  });

  test('#35 USER_RESET from interrupted -> idle', () => {
    const st = reachInterrupted();
    const { nextState } = reduceSpeechSession(st, { type: 'USER_RESET' });
    expect(nextState).toEqual(initialSpeechSessionState());
  });

  test('#36 USER_RESET from timeout_no_speech -> idle', () => {
    const st = reachTimeoutNoSpeech();
    const { nextState } = reduceSpeechSession(st, { type: 'USER_RESET' });
    expect(nextState).toEqual(initialSpeechSessionState());
  });

  test('#37 USER_RESET from error -> idle (lastErrorCode cleared)', () => {
    const st = reachError();
    expect(st.lastErrorCode).toBe('network');
    const { nextState } = reduceSpeechSession(st, { type: 'USER_RESET' });
    expect(nextState).toEqual(initialSpeechSessionState());
    expect(nextState.lastErrorCode).toBeNull();
  });

  test('#38 USER_RESET from unavailable -> idle', () => {
    const st = reachUnavailable();
    const { nextState } = reduceSpeechSession(st, { type: 'USER_RESET' });
    expect(nextState).toEqual(initialSpeechSessionState());
  });

  test('#39 USER_START from final without USER_RESET is IGNORED (prevents double-tap auto-restart)', () => {
    const st = reachFinal();
    const { nextState, producedArtifact } = reduceSpeechSession(st, START_EVT);
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#40 USER_START from error without USER_RESET is IGNORED', () => {
    const st = reachError();
    const { nextState, producedArtifact } = reduceSpeechSession(st, START_EVT);
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });

  test('#41 idle IGNOREs stray recognizer events', () => {
    const st = initialSpeechSessionState();
    const { nextState, producedArtifact } = reduceSpeechSession(st, {
      type: 'result_interim',
      transcript: 'phantom',
    });
    expect(nextState).toBe(st);
    expect(producedArtifact).toBeNull();
  });
});

// ---------- Additional error-code branch coverage --------------------------
// Ensures dispatchError is exercised for every SpeechErrorCode value.

describe('VOICE-003 - error code dispatch branch coverage', () => {
  test.each(ALL_ERROR_CODES)(
    'error code %s in listening routes correctly',
    (code) => {
      const st = reachListening();
      const { nextState, producedArtifact } = reduceSpeechSession(st, {
        type: 'error',
        code,
      });
      if (code === 'no-speech') {
        expect(nextState.state).toBe('timeout_no_speech');
        expect(producedArtifact!.terminalState).toBe('timeout_no_speech');
      } else if (code === 'aborted') {
        expect(nextState.state).toBe('interrupted');
        expect(producedArtifact!.terminalState).toBe('interrupted');
      } else {
        expect(nextState.state).toBe('error');
        expect(nextState.lastErrorCode).toBe(code);
        expect(producedArtifact!.terminalState).toBe('error');
      }
    },
  );

  test.each(ALL_ERROR_CODES)('error code %s in interim routes correctly', (code) => {
    const st = reachInterim(1);
    const { nextState } = reduceSpeechSession(st, { type: 'error', code });
    if (code === 'no-speech') expect(nextState.state).toBe('timeout_no_speech');
    else if (code === 'aborted') expect(nextState.state).toBe('interrupted');
    else expect(nextState.state).toBe('error');
  });

  test.each(ALL_ERROR_CODES)('error code %s in finalizing routes correctly', (code) => {
    const st = reachFinalizing();
    const { nextState } = reduceSpeechSession(st, { type: 'error', code });
    if (code === 'no-speech') expect(nextState.state).toBe('timeout_no_speech');
    else if (code === 'aborted') expect(nextState.state).toBe('interrupted');
    else expect(nextState.state).toBe('error');
  });

  test.each(ALL_ERROR_CODES)('error code %s in starting routes correctly', (code) => {
    const st = reachStarting();
    const { nextState } = reduceSpeechSession(st, { type: 'error', code });
    if (code === 'no-speech') expect(nextState.state).toBe('timeout_no_speech');
    else if (code === 'aborted') expect(nextState.state).toBe('interrupted');
    else expect(nextState.state).toBe('error');
  });
});

// ---------- Test #42: blanket IGNORE matrix over the full Cartesian --------

describe('VOICE-003 - blanket IGNORE matrix (Cartesian state x event)', () => {
  // Pairs where the reducer SHOULD transition. Every other pair is
  // expected to be a byte-identical no-op with producedArtifact === null.
  const TRANSITIONING_PAIRS: ReadonlySet<string> = new Set([
    // idle
    'idle|USER_START',
    'idle|AVAILABILITY_LOST',
    // starting - only USER_START is a self-loop IGNORE; speechend is IGNORE;
    // start-and-speechstart change state.
    'starting|USER_ABORT',
    'starting|AVAILABILITY_LOST',
    'starting|start',
    'starting|speechstart',
    'starting|result_interim',
    'starting|result_final',
    'starting|end',
    'starting|nomatch',
    'starting|error',
    // listening - start and speechstart are IGNORE/mutating (speechstart
    // does mutate speechStartFired so belongs here).
    'listening|USER_ABORT',
    'listening|AVAILABILITY_LOST',
    'listening|speechstart',
    'listening|result_interim',
    'listening|result_final',
    'listening|speechend',
    'listening|end',
    'listening|nomatch',
    'listening|error',
    // interim
    'interim|USER_ABORT',
    'interim|AVAILABILITY_LOST',
    'interim|speechstart',
    'interim|result_interim',
    'interim|result_final',
    'interim|speechend',
    'interim|end',
    'interim|nomatch',
    'interim|error',
    // finalizing
    'finalizing|USER_ABORT',
    'finalizing|AVAILABILITY_LOST',
    'finalizing|result_final',
    'finalizing|end',
    'finalizing|nomatch',
    'finalizing|error',
    // terminals: only USER_RESET exits.
    'final|USER_RESET',
    'interrupted|USER_RESET',
    'timeout_no_speech|USER_RESET',
    'error|USER_RESET',
    'unavailable|USER_RESET',
  ]);

  const cells: { s: SpeechSessionState; e: RecognizerEvent['type'] }[] = [];
  for (const s of ALL_STATES) {
    for (const e of ALL_EVENT_TYPES) cells.push({ s, e });
  }
  const ignoreCells = cells.filter(({ s, e }) => !TRANSITIONING_PAIRS.has(`${s}|${e}`));

  test('the IGNORE partition covers exactly 80 cells (120 total - 40 transitioning)', () => {
    // Note: the design section 4.11 gives approximate totals of ~46 / ~74; the
    // exact split, once the table is enumerated, is 40 / 80. Cells where a
    // sub-field mutates but state.state stays the same (e.g. listening plus
    // speechstart flipping speechStartFired) are transitions, not IGNOREs.
    expect(ignoreCells).toHaveLength(80);
  });

  test.each(ignoreCells)(
    'IGNORE $s + $e - state reference unchanged AND producedArtifact null',
    ({ s, e }) => {
      const before = stateReacher(s);
      const { nextState, producedArtifact } = reduceSpeechSession(before, eventOfType(e));
      expect(producedArtifact).toBeNull();
      expect(nextState).toBe(before); // Object.is - same reference
      // And field-level Object.is on every field (INV-B6 byte-identical).
      expect(Object.is(nextState.state, before.state)).toBe(true);
      expect(Object.is(nextState.sessionId, before.sessionId)).toBe(true);
      expect(Object.is(nextState.transcriptId, before.transcriptId)).toBe(true);
      expect(Object.is(nextState.recognizer, before.recognizer)).toBe(true);
      expect(Object.is(nextState.onDeviceRecognition, before.onDeviceRecognition)).toBe(true);
      expect(Object.is(nextState.language, before.language)).toBe(true);
      expect(Object.is(nextState.sessionStartedAt, before.sessionStartedAt)).toBe(true);
      expect(Object.is(nextState.sessionEndedAt, before.sessionEndedAt)).toBe(true);
      expect(Object.is(nextState.rawTranscript, before.rawTranscript)).toBe(true);
      expect(Object.is(nextState.latestInterimText, before.latestInterimText)).toBe(true);
      expect(Object.is(nextState.interimCount, before.interimCount)).toBe(true);
      expect(Object.is(nextState.speechStartFired, before.speechStartFired)).toBe(true);
      expect(Object.is(nextState.hadFinalEvent, before.hadFinalEvent)).toBe(true);
      expect(Object.is(nextState.lastErrorCode, before.lastErrorCode)).toBe(true);
      expect(Object.is(nextState.terminalState, before.terminalState)).toBe(true);
    },
  );
});

// ---------- Runtime invariants B1..B9 ---------------------------------------

describe('VOICE-003 - runtime invariants B1..B9', () => {
  test('INV-B1: every yielded artifact is Object.frozen', () => {
    const st = reachListening();
    const { producedArtifact } = reduceSpeechSession(st, {
      type: 'result_final',
      transcript: 'hi',
    });
    expect(producedArtifact).not.toBeNull();
    expect(Object.isFrozen(producedArtifact)).toBe(true);
  });

  test('INV-B2: hadFinalEvent=false implies rawTranscript=empty across every non-final terminal', () => {
    const targets: Array<() => SpeechSessionMachineState> = [
      reachInterrupted,
      reachTimeoutNoSpeech,
      reachError,
    ];
    for (const build of targets) {
      const st = build();
      const path: RecognizerEvent[] = [
        START_EVT,
        { type: 'start' },
        { type: 'USER_ABORT' },
      ];
      // Drive again to capture the yielded artifact via the transition.
      const events: RecognizerEvent[] =
        build === reachInterrupted
          ? path
          : build === reachTimeoutNoSpeech
            ? [START_EVT, { type: 'start' }, { type: 'nomatch' }]
            : [START_EVT, { type: 'start' }, { type: 'error', code: 'network' }];
      const { perStep } = drive(events);
      const art = perStep[perStep.length - 1].producedArtifact!;
      expect(art.hadFinalEvent).toBe(false);
      expect(art.rawTranscript).toBe('');
      // Silence unused warning.
      expect(st.state).toMatch(/interrupted|timeout_no_speech|error/);
    }
  });

  test('INV-B3: interimCount is monotonic and >= 0', () => {
    const events: RecognizerEvent[] = [START_EVT, { type: 'start' }];
    for (let i = 0; i < 5; i += 1) {
      events.push({ type: 'result_interim', transcript: `p${i}` });
    }
    const { perStep, finalState } = drive(events);
    expect(finalState.interimCount).toBe(5);
    let last = 0;
    for (const step of perStep) {
      expect(step.nextState.interimCount).toBeGreaterThanOrEqual(last);
      last = step.nextState.interimCount;
    }
  });

  test('INV-B4: sessionEndedAt >= sessionStartedAt on every yielded artifact', () => {
    // Sample several terminals.
    const startVariants: RecognizerEvent[][] = [
      [START_EVT, { type: 'start' }, { type: 'result_final', transcript: 'x' }],
      [START_EVT, { type: 'start' }, { type: 'USER_ABORT' }],
      [START_EVT, { type: 'start' }, { type: 'nomatch' }],
      [START_EVT, { type: 'start' }, { type: 'error', code: 'network' }],
    ];
    for (const events of startVariants) {
      const { perStep } = drive(events);
      const art = perStep[perStep.length - 1].producedArtifact!;
      expect(art.sessionEndedAt >= art.sessionStartedAt).toBe(true);
    }
  });

  test('INV-B5: reducer never writes rawTranscript from result_interim', () => {
    const events: RecognizerEvent[] = [
      START_EVT,
      { type: 'start' },
      { type: 'result_interim', transcript: 'partial hello' },
      { type: 'result_interim', transcript: 'partial hello world' },
    ];
    const { finalState } = drive(events);
    expect(finalState.rawTranscript).toBe('');
    expect(finalState.hadFinalEvent).toBe(false);
    expect(finalState.latestInterimText).toBe('partial hello world');
  });

  test('INV-B6: USER_START in {starting, listening, interim, finalizing} is byte-identical no-op', () => {
    const reachers: Array<() => SpeechSessionMachineState> = [
      reachStarting,
      reachListening,
      () => reachInterim(2),
      reachFinalizing,
    ];
    for (const build of reachers) {
      const st = build();
      const evt: RecognizerEvent = {
        type: 'USER_START',
        sessionId: 'DIFFERENT',
        transcriptId: 'DIFFERENT',
        capability: CAP_OK,
        nowIso: '2099-01-01T00:00:00.000Z',
      };
      const { nextState, producedArtifact } = reduceSpeechSession(st, evt);
      expect(nextState).toBe(st);
      expect(producedArtifact).toBeNull();
      // Fields explicitly checked per the design.
      expect(nextState.transcriptId).toBe(st.transcriptId);
      expect(nextState.sessionStartedAt).toBe(st.sessionStartedAt);
      expect(nextState.interimCount).toBe(st.interimCount);
      expect(nextState.latestInterimText).toBe(st.latestInterimText);
      expect(nextState.rawTranscript).toBe(st.rawTranscript);
      expect(nextState.speechStartFired).toBe(st.speechStartFired);
      expect(nextState.hadFinalEvent).toBe(st.hadFinalEvent);
      expect(nextState.sessionId).toBe(st.sessionId);
    }
  });

  test('INV-B7: producedArtifact is non-null only on terminal-yielding transitions', () => {
    // Walk a happy path and verify each step.
    const events: RecognizerEvent[] = [
      START_EVT,
      { type: 'start' },
      { type: 'result_interim', transcript: 'partial' },
      { type: 'result_final', transcript: 'done' },
    ];
    const { perStep } = drive(events);
    expect(perStep[0].producedArtifact).toBeNull();
    expect(perStep[1].producedArtifact).toBeNull();
    expect(perStep[2].producedArtifact).toBeNull();
    expect(perStep[3].producedArtifact).not.toBeNull();
    expect(perStep[3].nextState.state).toBe('final');
  });

  test('INV-B7b: producedArtifact null for unavailable and IGNORE paths', () => {
    // Unavailable from idle.
    const { producedArtifact: p1 } = reduceSpeechSession(
      initialSpeechSessionState(),
      START_EVT_UNAVAILABLE,
    );
    expect(p1).toBeNull();
    // AVAILABILITY_LOST from listening.
    const st2 = reachListening();
    const { producedArtifact: p2 } = reduceSpeechSession(st2, {
      type: 'AVAILABILITY_LOST',
      reason: 'service_unreachable',
    });
    expect(p2).toBeNull();
  });

  test('INV-B8: JSON round-trip preserves every yielded artifact', () => {
    const { perStep } = drive([
      START_EVT,
      { type: 'start' },
      { type: 'result_interim', transcript: 'p' },
      { type: 'result_final', transcript: 'done' },
    ]);
    const art = perStep[perStep.length - 1].producedArtifact!;
    const parsed = JSON.parse(JSON.stringify(art));
    expect(parsed).toEqual(art);
    // No Date object leaks - ISO string on both sides.
    expect(typeof parsed.sessionStartedAt).toBe('string');
    expect(typeof parsed.sessionEndedAt).toBe('string');
  });

  test('INV-B9: empty-string result_final never yields state=final', () => {
    const targets: Array<SpeechSessionMachineState> = [
      reachStarting(),
      reachListening(),
      reachInterim(1),
      reachFinalizing(),
    ];
    for (const st of targets) {
      const { nextState, producedArtifact } = reduceSpeechSession(st, {
        type: 'result_final',
        transcript: '',
      });
      expect(nextState.state).toBe('timeout_no_speech');
      expect(producedArtifact!.hadFinalEvent).toBe(false);
      expect(producedArtifact!.rawTranscript).toBe('');
    }
  });
});

// ---------- Sanity checks ---------------------------------------------------

describe('VOICE-003 - module version and initial state', () => {
  test('SPEECH_SESSION_MACHINE_VERSION is a semver-ish string', () => {
    expect(SPEECH_SESSION_MACHINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('initialSpeechSessionState returns idle with cleared fields', () => {
    const s = initialSpeechSessionState();
    expect(s.state).toBe('idle');
    expect(s.sessionId).toBeNull();
    expect(s.transcriptId).toBeNull();
    expect(s.recognizer).toBeNull();
    expect(s.onDeviceRecognition).toBe(false);
    expect(s.language).toBe('');
    expect(s.sessionStartedAt).toBeNull();
    expect(s.sessionEndedAt).toBeNull();
    expect(s.rawTranscript).toBe('');
    expect(s.latestInterimText).toBe('');
    expect(s.interimCount).toBe(0);
    expect(s.speechStartFired).toBe(false);
    expect(s.hadFinalEvent).toBe(false);
    expect(s.lastErrorCode).toBeNull();
    expect(s.terminalState).toBeNull();
  });

  test('produced artifact carries the module version', () => {
    const { perStep } = drive([
      START_EVT,
      { type: 'start' },
      { type: 'result_final', transcript: 'x' },
    ]);
    const art = perStep[perStep.length - 1].producedArtifact!;
    expect(art.producedByModuleVersion).toBe(SPEECH_SESSION_MACHINE_VERSION);
  });
});
