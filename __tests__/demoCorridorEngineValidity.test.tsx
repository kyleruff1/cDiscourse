/**
 * DEMO-001 — Engine-validity coverage (review §1).
 *
 * Closes the one Changes-requested item from the DEMO-001 review: the
 * design's highest risk (#1) and its Edge-cases section require proof that
 * each of the four corridor moves yields an engine-valid draft so the REAL
 * Post button is genuinely pressable once the viewer follows the corridor's
 * own instructions. Two halves:
 *
 *   A. Per-preset `evaluateArgumentDraft` validity — drive each corridor
 *      move's draft to its COMPLETED form (for `ask_source`/`narrow`: the
 *      preset as-offered; for `add_evidence`/`branch`: the preset plus the
 *      minimal completion the corridor copy instructs — the receipt / the
 *      chosen type) and assert the REAL engine returns `allowPost: true`
 *      against the fixture room's constitution + parent context. Uses the
 *      SHIPPED `quickActionToPreset` + `buildEvaluationInput` +
 *      `evaluateArgumentDraft` — the exact chain the demo composer evaluates
 *      against, so this proves the real Post button can light up.
 *
 *   B. Assembled-Post regression — mount the corridor (the REAL `OneBox`
 *      path), complete one immediately-valid move (`ask_source`), press the
 *      REAL "Post move" button, and assert (i) the corridor advances to the
 *      scripted `issue_state_change` beat and (ii) `submitArgumentDraft` is
 *      never called (the pre-network `onBeforeSubmit` seam holds).
 *
 * Part A is pure (no React). Part B renders with the established
 * @testing-library/react-native pattern. The module-level mocks below are
 * inert for Part A (it calls the engine directly) and only shape Part B's
 * render so the real Post button can reach `canSubmit === true` without a
 * network or a provider call.
 */
import React from 'react';

// Part B render scaffolding — the established repo mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Spy on the network submit so Part B can prove it is never reached.
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));
// The real "Post move" button is gated on `SUPABASE_CONFIGURED` (the
// composer's `canSubmit`). Flip it true for the assembled-Post test and
// neutralise the auth listener so no async session work runs during render.
jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
  };
});
// Serve the bundled v1 constitution directly so the render never attempts a
// Supabase fetch (SUPABASE_CONFIGURED is now true). This is exactly the
// local fallback the demo composer uses at runtime.
jest.mock('../src/features/arguments/useConstitution', () => {
  const c = jest.requireActual('../src/domain/constitution');
  return {
    useConstitution: () => ({
      loading: false,
      error: null,
      source: 'local_fallback',
      activeConstitution: c.constitutionVersion,
      activeRules: c.constitutionRules,
      tagDefinitions: c.tagDefinitions,
      flagDefinitions: c.flagDefinitions,
    }),
  };
});

import { render, fireEvent, within } from '@testing-library/react-native';
import {
  evaluateArgumentDraft,
  constitutionVersion,
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
} from '../src/domain/constitution';
import { buildEvaluationInput } from '../src/features/arguments/composerValidation';
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';
import type { ComposerDraft, EvidenceAttachmentLocal } from '../src/features/arguments/composerState';
import {
  DEMO_DEBATE,
  DEMO_PARENT_ARGUMENT,
  ALL_DEMO_MOVE_CODES,
  type DemoMoveCode,
} from '../src/features/demoCorridor/demoFixtureRoom';
import { DEMO_MOVE_TO_QUICK_ACTION } from '../src/features/demoCorridor/corridorModel';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { DemoCorridorScreen } from '../src/features/demoCorridor/DemoCorridorScreen';
import { CORRIDOR_COPY } from '../src/features/demoCorridor/corridorModel';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';

// ════════════════════════════════════════════════════════════════
// Part A — per-preset evaluateArgumentDraft validity (pure engine)
// ════════════════════════════════════════════════════════════════

const CONSTITUTION_DATA = {
  activeConstitution: constitutionVersion,
  activeRules: constitutionRules,
  tagDefinitions,
  flagDefinitions,
};

/**
 * Build a `ComposerDraft` from a corridor move's SHIPPED preset (the same
 * `quickActionToPreset` the demo composer seeds), parented to the fixture's
 * disputed claim. `overrides` apply the corridor-instructed completion for
 * the moves that need one (`add_evidence`: a receipt; `branch`: a type).
 */
function draftFromPreset(move: DemoMoveCode, overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  const preset = quickActionToPreset(DEMO_MOVE_TO_QUICK_ACTION[move], DEMO_PARENT_ARGUMENT.argumentType);
  return {
    draftId: `demo-${move}`,
    debateId: DEMO_DEBATE.id,
    parentId: DEMO_PARENT_ARGUMENT.id,
    argumentType: preset?.argumentType ?? null,
    // The demo participant side. Side is required for the composer to build
    // an evaluation input, but is not itself a blocking rule.
    side: 'affirmative',
    body: preset?.body ?? '',
    selectedTagCodes: preset?.suggestedTagCodes ?? [],
    targetExcerpt: null,
    disagreementAxis: preset?.disagreementAxis ?? null,
    attachedEvidence: [],
    updatedAt: '2026-06-12T09:15:00.000Z',
    dirty: false,
    ...overrides,
  };
}

/** Evaluate a draft exactly as the composer does and read engine `allowPost`. */
function evalAllowPost(draft: ComposerDraft): boolean {
  const input = buildEvaluationInput(draft, DEMO_DEBATE, DEMO_PARENT_ARGUMENT, CONSTITUTION_DATA);
  // A null input means the composer cannot evaluate yet (no type/side) — the
  // Post button is therefore unreachable, which is a `false` Post-ability.
  if (!input) return false;
  return evaluateArgumentDraft(input).allowPost;
}

const RECEIPT: EvidenceAttachmentLocal = {
  url: 'https://example.test/town-library/visit-counts',
  label: 'Town parks-and-libraries quarterly report',
  sourceText: 'Weeknight 6-to-9 pm library visits averaged 41 per evening across the most recent quarter.',
};

describe('DEMO-001 — per-preset evaluateArgumentDraft allowPost (review §1)', () => {
  it('ask_source: the preset as-offered is engine-valid (allowPost true)', () => {
    // `source` preset → clarification_request + a seeded body. A valid reply
    // to the rebuttal claim, non-empty body → immediately Post-able.
    expect(evalAllowPost(draftFromPreset('ask_source'))).toBe(true);
  });

  it('narrow: the preset as-offered is engine-valid (allowPost true)', () => {
    // `narrow` preset → concession + a seeded body. A valid reply to the
    // rebuttal claim, non-empty body → immediately Post-able.
    expect(evalAllowPost(draftFromPreset('narrow'))).toBe(true);
  });

  it('add_evidence: the preset as-offered is NOT yet Post-able (no body, no receipt)', () => {
    // `evidence` preset seeds the type only; the corridor copy instructs the
    // viewer to add the receipt. As-offered: empty body + a missing source.
    expect(evalAllowPost(draftFromPreset('add_evidence'))).toBe(false);
  });

  it('add_evidence: with the corridor-instructed receipt + body, allowPost is true', () => {
    const completed = draftFromPreset('add_evidence', {
      body: 'Here are the weeknight visit counts pulled from the quarterly report.',
      attachedEvidence: [RECEIPT],
    });
    expect(evalAllowPost(completed)).toBe(true);
  });

  it('branch: the preset is null (no forced type) — a type must be chosen', () => {
    // `branch` deliberately returns no preset: the viewer picks the move
    // type. Without a type the composer cannot evaluate → not yet Post-able.
    expect(
      quickActionToPreset(DEMO_MOVE_TO_QUICK_ACTION['branch'], DEMO_PARENT_ARGUMENT.argumentType),
    ).toBeNull();
    expect(evalAllowPost(draftFromPreset('branch'))).toBe(false);
  });

  it('branch: with the corridor-instructed chosen type + body, allowPost is true', () => {
    const completed = draftFromPreset('branch', {
      argumentType: 'counter_rebuttal',
      body: 'A separate question worth its own thread: should weekend hours change at the same time?',
    });
    expect(evalAllowPost(completed)).toBe(true);
  });

  it('every corridor move has an engine-valid completed draft (the real Post button can light up)', () => {
    const completed: Record<DemoMoveCode, ComposerDraft> = {
      ask_source: draftFromPreset('ask_source'),
      narrow: draftFromPreset('narrow'),
      add_evidence: draftFromPreset('add_evidence', {
        body: 'Here are the weeknight visit counts pulled from the quarterly report.',
        attachedEvidence: [RECEIPT],
      }),
      branch: draftFromPreset('branch', {
        argumentType: 'counter_rebuttal',
        body: 'A separate question worth its own thread: should weekend hours change at the same time?',
      }),
    };
    for (const move of ALL_DEMO_MOVE_CODES) {
      expect(evalAllowPost(completed[move])).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Part B — assembled-Post regression (real OneBox, real Post button)
// ════════════════════════════════════════════════════════════════

function mount() {
  return render(
    <AppSessionProvider>
      <DemoCorridorScreen onExit={() => {}} />
    </AppSessionProvider>,
  );
}

const advance = (r: ReturnType<typeof render>) =>
  fireEvent.press(r.getByTestId('demo-corridor-primary'));

describe('DEMO-001 — assembled real-Post advances the corridor without a submit (review §1)', () => {
  beforeEach(() => {
    (submitArgumentDraft as jest.Mock).mockClear();
  });

  it('completing ask_source and pressing the REAL enabled Post advances to issue_state_change', () => {
    const r = mount();
    // claim → disputed_point → referee_open_task → choose_move
    advance(r);
    advance(r);
    advance(r);
    // Pick the immediately-valid move; the real OneBox opens.
    fireEvent.press(r.getByTestId('demo-corridor-move-ask_source'));
    const panel = r.getByTestId('demo-composer-panel');
    expect(within(panel).getByTestId('one-box')).toBeTruthy();

    // Complete the move through the REAL composer controls the viewer uses,
    // so the composer's `canSubmit` (type + side + body + engine allowPost)
    // is satisfied: a clarification (Ask-for-a-source) move, on a side, with
    // a body. This is the "complete one immediately-valid move" of review §1.
    fireEvent.press(within(panel).getByLabelText('Clarification'));
    fireEvent.changeText(
      within(panel).getByTestId('composer-body-input'),
      'Could you point to the source for the after-6 pm weeknight visit counts?',
    );
    fireEvent.press(within(panel).getByLabelText('Affirmative'));

    // The real "Post move" button is now genuinely enabled (not a no-op).
    const postButton = within(panel).getByLabelText('Post move');
    expect(postButton.props.accessibilityState?.disabled).toBe(false);

    // Press the REAL Post button. The pre-network `onBeforeSubmit` seam fires
    // (returns false), advancing the corridor and never reaching the submit.
    fireEvent.press(postButton);

    // (i) The corridor advanced to the scripted next beat…
    expect(r.getByText(CORRIDOR_COPY.issueStateChangeLines[0])).toBeTruthy();
    // …and the composer is gone (the move is "posted" into the fixture).
    expect(r.queryByTestId('demo-composer-panel')).toBeNull();
    // (ii) …without ever touching the production network submit.
    expect(submitArgumentDraft).not.toHaveBeenCalled();
  });
});
