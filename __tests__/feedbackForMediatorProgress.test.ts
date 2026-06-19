/**
 * UX-FEEDBACK-001 — feedbackForMediatorProgress (pure helper).
 *
 * The operator RE-LOCKED scope: STATIC current-state CONFIRMATION ONLY. This
 * suite is the load-bearing doctrine gate for the helper. It proves:
 *   - totality + determinism over the nine v4 display states (+ the selection cue);
 *   - the EXACT operator-locked copy ("Point anchored." / "Claim narrowed." /
 *     "Concession preserved." / "Source path identified." / "Next useful move: …");
 *   - restraint by default — most states return null;
 *   - NO temporal / transition phrasing ("cleaner"/"clearer"/"moved forward"/
 *     "clarified"/"just"/"now"/"improved") in any produced line;
 *   - NO rating / applause / popularity / score / like token;
 *   - NO person-attribution token;
 *   - impasse returns null here (cross-ref UX-IMPASSE-001 — no second render);
 *   - insufficient signal → null (no overclaiming);
 *   - the helper imports nothing from the engine / pointStanding / argumentScoreModel.
 */
import fs from 'fs';
import path from 'path';

import {
  feedbackForMediatorProgress,
  _forbiddenFeedbackTokens,
  type MediatorProgressNote,
} from '../src/features/mediator/feedbackForMediatorProgress';
import { ALL_V4_MEDIATOR_STATE_CODES } from '../src/features/mediator/mediatorBoardTypes';
import { nextMovesForState } from '../src/features/mediator/nextMovesForState';

const REPO = process.cwd();
const HELPER_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'feedbackForMediatorProgress.ts'),
  'utf8',
);

// The states whose Inspect note is a state-reflective acknowledgement (not the
// next-move lead-in). `narrowed` → "Claim narrowed." Everything else either
// returns the "Next useful move:" lead-in or null.
const ALL_STATES = ALL_V4_MEDIATOR_STATE_CODES;

// ── 1. Totality + determinism (inspect surface) ───────────────

describe('UX-FEEDBACK-001 — feedbackForMediatorProgress totality + determinism', () => {
  it('returns a note or null for every display state (inspect surface)', () => {
    for (const state of ALL_STATES) {
      const note = feedbackForMediatorProgress(state, { surface: 'inspect' });
      expect(note === null || (typeof note === 'object' && typeof note.line === 'string')).toBe(true);
    }
  });

  it('is deterministic — same input deep-equals same output', () => {
    for (const state of ALL_STATES) {
      expect(feedbackForMediatorProgress(state, { surface: 'inspect' })).toEqual(
        feedbackForMediatorProgress(state, { surface: 'inspect' }),
      );
      expect(feedbackForMediatorProgress(state, { surface: 'selection', isNodeAnchored: true })).toEqual(
        feedbackForMediatorProgress(state, { surface: 'selection', isNodeAnchored: true }),
      );
    }
  });

  it('defaults the surface to inspect when ctx is omitted', () => {
    // narrowed with no ctx → inspect note "Claim narrowed."
    const note = feedbackForMediatorProgress('narrowed');
    expect(note?.line).toBe('Claim narrowed.');
  });
});

// ── 2. The EXACT operator-locked copy ─────────────────────────

describe('UX-FEEDBACK-001 — exact operator-locked static copy', () => {
  it('selection + anchored non-root → "Point anchored."', () => {
    const note = feedbackForMediatorProgress('open', { surface: 'selection', isNodeAnchored: true });
    expect(note).not.toBeNull();
    expect(note?.line).toBe('Point anchored.');
    expect(note?.tone).toBe('progress');
    expect(note?.id).toBe('progress-anchored');
  });

  it('narrowed (no concession) → "Claim narrowed."', () => {
    const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' });
    expect(note?.line).toBe('Claim narrowed.');
    expect(note?.tone).toBe('progress');
    expect(note?.id).toBe('progress-narrowed');
  });

  it('narrowed + concession preserved → "Concession preserved."', () => {
    const note = feedbackForMediatorProgress('narrowed', {
      surface: 'inspect',
      isConcessionPreserved: true,
    });
    expect(note?.line).toBe('Concession preserved.');
    expect(note?.tone).toBe('progress');
    expect(note?.id).toBe('progress-concession');
  });

  it('evidence state with an identified source path → "Source path identified."', () => {
    const note = feedbackForMediatorProgress('needs_evidence', {
      surface: 'inspect',
      hasIdentifiedSourcePath: true,
    });
    expect(note?.line).toBe('Source path identified.');
    expect(note?.tone).toBe('dignified');
    expect(note?.id).toBe('progress-source-path');
  });

  it('an actionable state with no other signal → "Next useful move: <dominant>"', () => {
    const note = feedbackForMediatorProgress('needs_evidence', { surface: 'inspect' });
    const dominant = nextMovesForState('needs_evidence')[0].label;
    expect(note?.line).toBe(`Next useful move: ${dominant}`);
    expect(note?.tone).toBe('progress');
    expect(note?.id).toBe('progress-next-move');
  });
});

// ── 3. Restraint by default (most states → null) ──────────────

describe('UX-FEEDBACK-001 — restraint by default', () => {
  it('selection surface with NO anchored node → null', () => {
    for (const state of ALL_STATES) {
      expect(feedbackForMediatorProgress(state, { surface: 'selection' })).toBeNull();
      expect(
        feedbackForMediatorProgress(state, { surface: 'selection', isNodeAnchored: false }),
      ).toBeNull();
    }
  });

  it('structured_impasse → null on EVERY surface (cross-ref UX-IMPASSE-001)', () => {
    expect(feedbackForMediatorProgress('structured_impasse', { surface: 'inspect' })).toBeNull();
    expect(
      feedbackForMediatorProgress('structured_impasse', { surface: 'selection', isNodeAnchored: true }),
    ).toBeNull();
    expect(
      feedbackForMediatorProgress('structured_impasse', {
        surface: 'inspect',
        isConcessionPreserved: true,
        hasIdentifiedSourcePath: true,
      }),
    ).toBeNull();
  });

  it('open inspect with no extra signal → the neutral next-move lead-in (open has moves), never an overclaim', () => {
    // `open` always has a next-move set; the lead-in is the ONLY note, never a
    // narrowed/concession/source claim.
    const note = feedbackForMediatorProgress('open', { surface: 'inspect' });
    expect(note?.id).toBe('progress-next-move');
    expect(note?.line.startsWith('Next useful move:')).toBe(true);
  });
});

// ── 4. NO transition / temporal language (the load-bearing test) ─

describe('UX-FEEDBACK-001 — NO transition / temporal language', () => {
  // The exact phrases the operator forbids, plus the looser temporal tokens.
  const FORBIDDEN_TEMPORAL = [
    'cleaner now',
    'the board is cleaner',
    'clearer',
    'is clearer',
    'moved forward',
    'moved the point',
    'moves the point forward',
    'source path clarified',
    'clarified',
    'just',
    'improved',
    'before',
    'after',
    'now',
  ];

  function allProducedLines(): string[] {
    const lines: string[] = [];
    // every inspect note
    for (const state of ALL_STATES) {
      const inspect = feedbackForMediatorProgress(state, {
        surface: 'inspect',
        isConcessionPreserved: true,
        hasIdentifiedSourcePath: true,
      });
      if (inspect) lines.push(inspect.line);
      const inspectPlain = feedbackForMediatorProgress(state, { surface: 'inspect' });
      if (inspectPlain) lines.push(inspectPlain.line);
      const selection = feedbackForMediatorProgress(state, {
        surface: 'selection',
        isNodeAnchored: true,
      });
      if (selection) lines.push(selection.line);
    }
    return lines;
  }

  it('no produced line contains a temporal / transition token', () => {
    for (const line of allProducedLines()) {
      const lower = line.toLowerCase();
      for (const token of FORBIDDEN_TEMPORAL) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });

  it('explicitly: no produced line is "The board is cleaner now." or "Source path clarified."', () => {
    for (const line of allProducedLines()) {
      expect(line).not.toBe('The board is cleaner now.');
      expect(line).not.toBe('Source path clarified.');
      expect(line).not.toBe('The next useful move is clearer.');
      expect(line).not.toBe('This moved the point forward.');
      expect(line).not.toBe('Definition named.');
      expect(line).not.toBe('Scope clarified.');
    }
  });
});

// ── 5. DOCTRINE ban-list (rating / applause / verdict / person) ─

describe('UX-FEEDBACK-001 — ban-list clean copy', () => {
  const BANNED = _forbiddenFeedbackTokens();

  function allLines(): string[] {
    const lines: string[] = [];
    for (const state of ALL_STATES) {
      for (const ctx of [
        { surface: 'inspect' as const },
        { surface: 'inspect' as const, isConcessionPreserved: true },
        { surface: 'inspect' as const, hasIdentifiedSourcePath: true },
        { surface: 'selection' as const, isNodeAnchored: true },
      ]) {
        const note = feedbackForMediatorProgress(state, ctx);
        if (note) lines.push(note.line);
      }
    }
    return lines;
  }

  it('no produced line contains a banned token', () => {
    for (const line of allLines()) {
      const lower = line.toLowerCase();
      for (const token of BANNED) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });

  it('the ban-list explicitly covers rating / applause / verdict / person tokens', () => {
    const lower = BANNED.map((t) => t.toLowerCase());
    for (const required of [
      'like', 'vote', 'score', 'ranking', 'leaderboard', 'popularity',
      'applause', 'trophy', 'badge', 'streak', 'confetti',
      'winner', 'loser', 'truth', 'verdict', 'correct',
      'you', 'your', 'the user',
      'just', 'clearer', 'clarified', 'moved forward', 'improved',
    ]) {
      expect(lower).toContain(required);
    }
  });

  it('no produced line leaks snake_case', () => {
    for (const line of allLines()) {
      expect(line).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ── 6. No-write / gate-independence (source scan) ─────────────

describe('UX-FEEDBACK-001 — gate-independence + no write to standing', () => {
  it('the helper imports nothing from the engine / pointStanding / argumentScoreModel', () => {
    // Scan only `import ... from '...'` statements (not doctrine comments).
    const imports = (HELPER_SRC.match(/^import[\s\S]*?from\s+'[^']+';/gm) ?? []).join('\n');
    expect(imports).not.toMatch(/constitution\/engine/);
    expect(imports).not.toMatch(/pointStanding/);
    expect(imports).not.toMatch(/argumentScoreModel/);
  });

  it('the helper wires no submit / post / write / persistence call', () => {
    expect(HELPER_SRC).not.toMatch(/submitArgument|submit-argument|supabase|insert\(|update\(|onSubmit|onPost/);
  });

  it('the helper introduces no clock / randomness', () => {
    expect(HELPER_SRC).not.toMatch(/Date\.now|new Date|Math\.random|performance\.now/);
  });

  it('every produced note object is frozen (display-only, never mutated)', () => {
    const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' }) as MediatorProgressNote;
    expect(Object.isFrozen(note)).toBe(true);
  });
});
