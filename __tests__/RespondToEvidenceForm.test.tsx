/**
 * QOL-037 — RespondToEvidenceForm tests.
 *
 * Follows the repo's UI test discipline (see SourceChainPopover.test.tsx /
 * EvidenceDebtChip.test.tsx): the form's load-bearing decisions are extracted
 * into the pure planner `planRespondToEvidenceForm` + the pure
 * `composeApplicabilityPreviewLine` helper and exercised exhaustively here; the
 * component contract (radio roles, the conditional clarification field, the
 * never-silent disabled Post, the role gates, reduce-motion, the EV-002 seed,
 * accessibility, the ban-list) is asserted by a source-scan.
 *
 * The .tsx extension is retained for parity with SourceChainPopover.test.tsx;
 * the pure-helper variant is still TypeScript-valid as .tsx.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  planRespondToEvidenceForm,
  composeApplicabilityPreviewLine,
  PICK_A_RESPONSE_PROMPT,
  type RespondToEvidenceViewerRole,
} from '../src/features/evidence/RespondToEvidenceForm';
import {
  ALL_EVIDENCE_RESPONSE_CHOICES,
  buildRespondToEvidenceViewModel,
  type EvidenceResponseChoice,
} from '../src/features/evidence/evidenceApplicabilityModel';
import {
  CLARIFICATION_REQUIRED_REASON,
  CLARIFICATION_TOO_SHORT_REASON,
  OBSERVER_RESPONSE_DISABLED_REASON,
  APPLICABILITY_PREVIEW_NO_CHANGE,
  ALL_EVIDENCE_APPLICABILITY_STRINGS,
} from '../src/features/evidence/evidenceApplicabilityCopy';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Helpers ────────────────────────────────────────────────────

function plan(
  overrides: Partial<Parameters<typeof planRespondToEvidenceForm>[0]> = {},
) {
  return planRespondToEvidenceForm({
    viewerRole: 'participant',
    selectedChoice: null,
    clarificationBody: '',
    currentApplicabilityStatus: 'applicability_undisputed',
    isSubmitting: false,
    ...overrides,
  });
}

const VALID_BODY = 'This is a real clarification sentence.';
const NON_ACCEPT_CHOICES: EvidenceResponseChoice[] = [
  'accept_with_caveat',
  'dispute_date',
  'dispute_amount',
  'dispute_applicability',
  'request_source',
  'request_clarification',
];

// ── planRespondToEvidenceForm — no choice selected ─────────────

describe('planRespondToEvidenceForm — before a choice is picked', () => {
  it('Post is disabled with the "pick a response" prompt', () => {
    const p = plan({ selectedChoice: null });
    expect(p.postDisabled).toBe(true);
    expect(p.disabledReason).toBe(PICK_A_RESPONSE_PROMPT);
  });

  it('no clarification field and no preview line are shown', () => {
    const p = plan({ selectedChoice: null });
    expect(p.showsClarificationField).toBe(false);
    expect(p.previewLine).toBeNull();
  });

  it('is not a read-only view for a participant', () => {
    expect(plan({ selectedChoice: null }).isReadOnlyView).toBe(false);
  });
});

// ── planRespondToEvidenceForm — accept ─────────────────────────

describe('planRespondToEvidenceForm — accept', () => {
  it('hides the clarification field for accept', () => {
    expect(plan({ selectedChoice: 'accept' }).showsClarificationField).toBe(false);
  });

  it('accept with an empty body → Post enabled, no disabled reason', () => {
    const p = plan({ selectedChoice: 'accept', clarificationBody: '' });
    expect(p.postDisabled).toBe(false);
    expect(p.disabledReason).toBeNull();
  });
});

// ── planRespondToEvidenceForm — the required-clarification rule ──

describe('planRespondToEvidenceForm — required-clarification rule', () => {
  it.each(NON_ACCEPT_CHOICES)('%s shows the clarification field', (choice) => {
    expect(plan({ selectedChoice: choice }).showsClarificationField).toBe(true);
  });

  it.each(NON_ACCEPT_CHOICES)(
    '%s + empty body → Post disabled with the "add a note" reason',
    (choice) => {
      const p = plan({ selectedChoice: choice, clarificationBody: '' });
      expect(p.postDisabled).toBe(true);
      expect(p.disabledReason).toBe(CLARIFICATION_REQUIRED_REASON);
    },
  );

  it('a non-accept choice + a too-short body → the "too short" reason', () => {
    const p = plan({
      selectedChoice: 'dispute_applicability',
      clarificationBody: 'short',
    });
    expect(p.postDisabled).toBe(true);
    expect(p.disabledReason).toBe(CLARIFICATION_TOO_SHORT_REASON);
  });

  it('a non-accept choice + a valid body → Post enabled, no disabled reason', () => {
    const p = plan({
      selectedChoice: 'dispute_applicability',
      clarificationBody: VALID_BODY,
    });
    expect(p.postDisabled).toBe(false);
    expect(p.disabledReason).toBeNull();
  });

  it('a disabled Post ALWAYS carries a visible reason (never a silent no-op)', () => {
    // Every disabled state across choices + bodies must surface a reason.
    const states = [
      plan({ selectedChoice: null }),
      plan({ selectedChoice: 'dispute_date', clarificationBody: '' }),
      plan({ selectedChoice: 'dispute_date', clarificationBody: 'tiny' }),
      plan({ viewerRole: 'observer', selectedChoice: 'accept' }),
      plan({ selectedChoice: 'accept', isSubmitting: true }),
    ];
    for (const s of states) {
      expect(s.postDisabled).toBe(true);
    }
    // Every one EXCEPT the in-flight case carries a reason; the in-flight Post
    // shows the busy state ("Posting…") on the button itself.
    expect(states[0].disabledReason).not.toBeNull();
    expect(states[1].disabledReason).not.toBeNull();
    expect(states[2].disabledReason).not.toBeNull();
    expect(states[3].disabledReason).not.toBeNull();
  });
});

// ── planRespondToEvidenceForm — submitting ─────────────────────

describe('planRespondToEvidenceForm — submitting', () => {
  it('a valid draft is Post-disabled while a submit is in flight', () => {
    const p = plan({
      selectedChoice: 'dispute_applicability',
      clarificationBody: VALID_BODY,
      isSubmitting: true,
    });
    expect(p.postDisabled).toBe(true);
  });
});

// ── planRespondToEvidenceForm — role gates ─────────────────────

describe('planRespondToEvidenceForm — role gates', () => {
  it('evidence_author gets a read-only view, never the interactive form', () => {
    const p = plan({ viewerRole: 'evidence_author', selectedChoice: 'accept' });
    expect(p.isReadOnlyView).toBe(true);
    expect(p.showsClarificationField).toBe(false);
    expect(p.previewLine).toBeNull();
  });

  it('observer keeps the form but Post is disabled with "Join a side to respond"', () => {
    const p = plan({
      viewerRole: 'observer',
      selectedChoice: 'dispute_applicability',
      clarificationBody: VALID_BODY,
    });
    expect(p.isReadOnlyView).toBe(false);
    expect(p.postDisabled).toBe(true);
    expect(p.disabledReason).toBe(OBSERVER_RESPONSE_DISABLED_REASON);
  });

  it('the observer disable wins even over an otherwise-valid draft', () => {
    // A valid clarification must NOT enable Post for an observer.
    const p = plan({
      viewerRole: 'observer',
      selectedChoice: 'accept',
    });
    expect(p.postDisabled).toBe(true);
    expect(p.disabledReason).toBe(OBSERVER_RESPONSE_DISABLED_REASON);
  });

  it('a participant with a valid draft can post', () => {
    const roles: RespondToEvidenceViewerRole[] = ['participant'];
    for (const role of roles) {
      const p = plan({
        viewerRole: role,
        selectedChoice: 'dispute_applicability',
        clarificationBody: VALID_BODY,
      });
      expect(p.postDisabled).toBe(false);
    }
  });
});

// ── composeApplicabilityPreviewLine ────────────────────────────

describe('composeApplicabilityPreviewLine', () => {
  it('dispute_applicability previews the "Applicability disputed" status change', () => {
    const line = composeApplicabilityPreviewLine(
      'dispute_applicability',
      'applicability_undisputed',
    );
    expect(line).toContain('Applicability disputed');
  });

  it.each<EvidenceResponseChoice>([
    'accept',
    'accept_with_caveat',
    'dispute_date',
    'dispute_amount',
    'request_source',
    'request_clarification',
  ])('%s previews the "no change" copy from undisputed', (choice) => {
    expect(
      composeApplicabilityPreviewLine(choice, 'applicability_undisputed'),
    ).toBe(APPLICABILITY_PREVIEW_NO_CHANGE);
  });

  it('the preview line is surfaced via the plan once a choice is picked', () => {
    const p = plan({
      selectedChoice: 'dispute_applicability',
      clarificationBody: VALID_BODY,
    });
    expect(p.previewLine).toContain('Applicability disputed');
  });
});

// ── Ban-list across the rendered surface ───────────────────────

const VERDICT_TOKENS = [
  'proof',
  'proven',
  'disproven',
  'true',
  'false',
  'correct',
  'incorrect',
  'winner',
  'loser',
  'verdict',
  'wrong',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
];
const AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'shares',
  'views',
  'followers',
  'verified',
  'engagement',
  'viral',
  'trending',
  'popular',
];

describe('RespondToEvidenceForm — ban-list across every rendered string', () => {
  /** Every system-generated string the form can surface. */
  function renderedStrings(): string[] {
    const strings: string[] = [...ALL_EVIDENCE_APPLICABILITY_STRINGS, PICK_A_RESPONSE_PROMPT];
    // Preview lines for every choice from every status.
    for (const choice of ALL_EVIDENCE_RESPONSE_CHOICES) {
      for (const status of [
        'applicability_undisputed',
        'applicability_disputed',
        'applicability_supported',
      ] as const) {
        strings.push(composeApplicabilityPreviewLine(choice, status));
      }
    }
    return strings.filter((s) => s.length > 0);
  }

  it('no rendered string carries a verdict token', () => {
    for (const text of renderedStrings()) {
      const lower = text.toLowerCase();
      for (const token of VERDICT_TOKENS) {
        if (token === 'true') {
          expect(lower).not.toMatch(/\btrue\b/);
        } else {
          expect(lower).not.toContain(token);
        }
      }
      expect(lower).not.toMatch(/\bright\b/);
    }
  });

  it('no rendered string carries an amplification token', () => {
    for (const text of renderedStrings()) {
      const lower = text.toLowerCase();
      for (const token of AMPLIFICATION_TOKENS) {
        expect(lower).not.toContain(token);
      }
    }
  });

  it('no rendered string looks like an internal snake_case code', () => {
    for (const text of renderedStrings()) {
      expect(looksLikeInternalCode(text.trim())).toBe(false);
    }
  });
});

// ── Component-contract source-scan ─────────────────────────────

describe('RespondToEvidenceForm — component contract (source-scan)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'evidence', 'RespondToEvidenceForm.tsx'),
    'utf8',
  );

  it('renders the choices as a radio group with accessibilityRole', () => {
    expect(src).toMatch(/accessibilityRole="radiogroup"/);
    expect(src).toMatch(/accessibilityRole="radio"/);
  });

  it('renders every choice from the frozen EVIDENCE_RESPONSE_CHOICES set', () => {
    expect(src).toMatch(/EVIDENCE_RESPONSE_CHOICES\.map/);
    // The model's frozen set has exactly seven choices.
    expect(ALL_EVIDENCE_RESPONSE_CHOICES).toHaveLength(7);
  });

  it('the radio rows carry accessibilityState with selected', () => {
    expect(src).toMatch(/accessibilityState=\{\{\s*selected/);
  });

  it('the conditional clarification field is gated on plan.showsClarificationField', () => {
    expect(src).toMatch(/plan\.showsClarificationField\s*\?/);
  });

  it('the disabled-Post reason renders in a polite live region (never silent)', () => {
    expect(src).toMatch(/accessibilityLiveRegion="polite"/);
    expect(src).toMatch(/plan\.disabledReason/);
  });

  it('the Post button wires disabled + accessibilityState from the plan', () => {
    expect(src).toMatch(/disabled=\{plan\.postDisabled\}/);
    expect(src).toMatch(/accessibilityState=\{\{\s*disabled:\s*plan\.postDisabled/);
  });

  it('reduce-motion gates the clarification show/hide LayoutAnimation', () => {
    expect(src).toMatch(/if\s*\(\s*!reduceMotion\s*\)/);
    expect(src).toMatch(/LayoutAnimation\.configureNext/);
  });

  it('request_source seeds the clarification body via the EV-002 preset path', () => {
    expect(src).toMatch(/requestSourceSeedBody/);
    expect(src).toMatch(/choice === 'request_source'/);
  });

  it('keeps a per-choice clarification draft buffer (edge case 3)', () => {
    expect(src).toMatch(/clarificationByChoice/);
  });

  it('the evidence author sees a read-only own-evidence notice, not the form', () => {
    expect(src).toMatch(/if\s*\(\s*isAuthor\s*\)/);
    expect(src).toMatch(/OWN_EVIDENCE_NOTICE/);
  });

  it('renders the applicability read-view (QOL-032 §E inline fallback)', () => {
    expect(src).toMatch(/ApplicabilityReadView/);
    expect(src).toMatch(/CLAIMED_APPLICABILITY_LABEL/);
    expect(src).toMatch(/DISPUTED_APPLICABILITY_LABEL/);
  });

  it('uses 44-min tap targets and hit-slop on the interactive elements', () => {
    expect(src).toMatch(/minHeight:\s*44/);
    expect(src).toMatch(/hitSlop=\{HIT_SLOP\}/);
  });

  it('authors no user-facing copy of its own — pulls every string from copy/model', () => {
    expect(src).toMatch(/from '\.\/evidenceApplicabilityCopy'/);
    expect(src).toMatch(/from '\.\/evidenceApplicabilityModel'/);
  });

  it('makes no Supabase / network / AI import', () => {
    // Scan import statements specifically — the file's doc comment legitimately
    // says "no Supabase, no network" as a doctrine note.
    const importLines = src
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /from ['"]/.test(line));
    for (const line of importLines) {
      expect(line.toLowerCase()).not.toMatch(/supabase/);
      expect(line.toLowerCase()).not.toMatch(/anthropic|openai|\bxai\b/);
    }
    expect(src).not.toMatch(/fetch\(/);
  });

  it('drives the render off the pure planner so the helper cannot drift', () => {
    expect(src).toMatch(/planRespondToEvidenceForm\(\{/);
  });
});

// ── Read-view view-model integration ───────────────────────────

describe('RespondToEvidenceForm — read-view integration', () => {
  it('the view-model surfaces "Not specified" claimed applicability when QOL-036 is absent', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', [], null);
    expect(vm.claimedApplicability).toBeNull();
    // The component renders APPLICABILITY_NOT_SPECIFIED for a null value —
    // asserted by the source-scan; here we lock the model decision.
  });

  it('the view-model carries the claimed applicability when QOL-036 supplies it', () => {
    const vm = buildRespondToEvidenceViewModel('art-1', [], 'March practice-room rent');
    expect(vm.claimedApplicability).toBe('March practice-room rent');
  });
});
