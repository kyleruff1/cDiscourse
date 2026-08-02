/**
 * VOICE-003 (issue 661) - deriveEditedProvenance coverage (T-D1..T-D7).
 *
 * Levenshtein pinned (not Damerau): transposition of two adjacent chars
 * counts as two edits. Neutral-zero return when the artifact terminal
 * state is anything other than 'final'.
 *
 * Comments are apostrophe-free for the doctrine scanner.
 */

import { deriveEditedProvenance } from '../src/features/voice/speech/deriveEditedProvenance';
import type {
  SpeechTranscriptArtifact,
  TerminalStateForArtifact,
} from '../src/features/voice/speech/speechTranscriptArtifact.types';
import { SPEECH_SESSION_MACHINE_VERSION } from '../src/features/voice/speech/speechSessionMachine';

function makeArtifact(
  terminalState: TerminalStateForArtifact,
  rawTranscript: string,
  hadFinalEvent: boolean = terminalState === 'final',
): SpeechTranscriptArtifact {
  return Object.freeze({
    transcriptId: 'tx-1',
    sessionId: 'sess-1',
    recognizer: 'web' as const,
    onDeviceRecognition: false,
    language: 'en-US',
    sessionStartedAt: '2026-08-01T00:00:00.000Z',
    sessionEndedAt: '2026-08-01T00:00:00.000Z',
    rawTranscript,
    hadFinalEvent,
    interimCount: 0,
    terminalState,
    wasEdited: false,
    editDistance: 0,
    audioPersistence: 'none' as const,
    audioUri: null,
    producedByModuleVersion: SPEECH_SESSION_MACHINE_VERSION,
  });
}

// ---------- T-D1: identical strings ----------------------------------------

describe('T-D1 - identical rawTranscript and submittedBody', () => {
  test('returns wasEdited=false, editDistance=0', () => {
    const art = makeArtifact('final', 'hello world');
    const result = deriveEditedProvenance(art, 'hello world');
    expect(result).toEqual({
      wasEdited: false,
      editDistance: 0,
      transcriptEditedAfterDictation: false,
    });
  });

  test('empty strings on both sides also returns zeros', () => {
    // hadFinalEvent must be false when rawTranscript is empty per the
    // reducer contract; but the function does not enforce that, and
    // pushing an empty artifact through should still return zeros for
    // a final terminal.
    const art = makeArtifact('final', '', true);
    const result = deriveEditedProvenance(art, '');
    expect(result.wasEdited).toBe(false);
    expect(result.editDistance).toBe(0);
    expect(result.transcriptEditedAfterDictation).toBe(false);
  });
});

// ---------- T-D2: single-char insertion ------------------------------------

describe('T-D2 - single-char insertion', () => {
  test('insertion of one char yields distance=1', () => {
    const art = makeArtifact('final', 'cat');
    const result = deriveEditedProvenance(art, 'cart');
    expect(result.editDistance).toBe(1);
    expect(result.wasEdited).toBe(true);
    expect(result.transcriptEditedAfterDictation).toBe(true);
  });

  test('inserted char at the start also yields distance=1', () => {
    const art = makeArtifact('final', 'at');
    const result = deriveEditedProvenance(art, 'cat');
    expect(result.editDistance).toBe(1);
  });
});

// ---------- T-D3: substitution ---------------------------------------------

describe('T-D3 - single-char substitution', () => {
  test('substituting one char yields distance=1', () => {
    const art = makeArtifact('final', 'cat');
    const result = deriveEditedProvenance(art, 'bat');
    expect(result.editDistance).toBe(1);
    expect(result.wasEdited).toBe(true);
  });
});

// ---------- T-D4: deletion -------------------------------------------------

describe('T-D4 - single-char deletion', () => {
  test('deleting one char yields distance=1', () => {
    const art = makeArtifact('final', 'cart');
    const result = deriveEditedProvenance(art, 'cat');
    expect(result.editDistance).toBe(1);
    expect(result.wasEdited).toBe(true);
  });
});

// ---------- T-D5: terminalState != 'final' returns neutral zeros -----------

describe('T-D5 - non-final terminals always return neutral zeros', () => {
  test.each<[TerminalStateForArtifact]>([
    ['interrupted'],
    ['timeout_no_speech'],
    ['error'],
  ])('%s terminal returns zeros regardless of body diff', (terminal) => {
    const art = makeArtifact(terminal, '', false);
    const result = deriveEditedProvenance(art, 'user typed body');
    expect(result).toEqual({
      wasEdited: false,
      editDistance: 0,
      transcriptEditedAfterDictation: false,
    });
  });

  test('non-final terminal with matching bodies is still zeros', () => {
    const art = makeArtifact('timeout_no_speech', '', false);
    const result = deriveEditedProvenance(art, '');
    expect(result).toEqual({
      wasEdited: false,
      editDistance: 0,
      transcriptEditedAfterDictation: false,
    });
  });
});

// ---------- T-D6: Levenshtein pinned, NOT Damerau --------------------------

describe('T-D6 - transposition costs 2 (Levenshtein, not Damerau)', () => {
  test('adjacent-char transposition ab -> ba yields distance=2', () => {
    const art = makeArtifact('final', 'ab');
    const result = deriveEditedProvenance(art, 'ba');
    expect(result.editDistance).toBe(2);
    expect(result.wasEdited).toBe(true);
  });

  test('longer transposition example: from converse to consreve', () => {
    // "converse" (c-o-n-v-e-r-s-e) vs a swap of the r and s (letters 6
    // and 7) yielding "convesre" - Levenshtein distance is 2 (two subs).
    // Damerau would call this 1.
    const art = makeArtifact('final', 'converse');
    const result = deriveEditedProvenance(art, 'convesre');
    expect(result.editDistance).toBe(2);
  });
});

// ---------- T-D7: empty raw + non-empty submitted with final terminal ------

describe('T-D7 - defensive empty-raw + non-empty-submitted branch', () => {
  test('unreachable-in-practice branch defensively returns distance=length', () => {
    // In practice rawTranscript is empty only when hadFinalEvent is false,
    // and hadFinalEvent is false only when terminalState is not 'final'.
    // But if a caller synthesizes such a shape, the function must still
    // return a sane value.
    const art = makeArtifact('final', '', true);
    const submitted = 'user typed this';
    const result = deriveEditedProvenance(art, submitted);
    expect(result.editDistance).toBe(submitted.length);
    expect(result.wasEdited).toBe(true);
    expect(result.transcriptEditedAfterDictation).toBe(true);
  });
});

// ---------- Additional coverage: long strings, unicode ---------------------

describe('deriveEditedProvenance - additional coverage', () => {
  test('multi-char edits accumulate', () => {
    const art = makeArtifact('final', 'kitten');
    // Classic Levenshtein example: kitten -> sitting is 3 edits.
    const result = deriveEditedProvenance(art, 'sitting');
    expect(result.editDistance).toBe(3);
  });

  test('empty raw with empty submitted on final yields zero', () => {
    const art = makeArtifact('final', '');
    const result = deriveEditedProvenance(art, '');
    expect(result.editDistance).toBe(0);
    expect(result.wasEdited).toBe(false);
  });

  test('non-empty raw with empty submitted on final yields distance=raw.length', () => {
    const art = makeArtifact('final', 'abc');
    const result = deriveEditedProvenance(art, '');
    expect(result.editDistance).toBe(3);
    expect(result.wasEdited).toBe(true);
  });
});
