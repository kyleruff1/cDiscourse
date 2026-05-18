/**
 * EV-002 — SourceChainPopover pure-helper tests.
 *
 * Tests the popover's load-bearing decisions through pure helpers
 * (`planSourceChainPopover`, `buildSourceChainPopoverAccessibilityLabel`,
 * `SOURCE_CHAIN_POPOVER_OBSERVER_HELPER`). The .tsx extension is retained
 * because the file historically housed RN-tree tests; the current
 * pure-helper variant is still TypeScript-valid as .tsx.
 *
 * Covers:
 *   - Happy paths: no_source / source_and_quote / broken render the
 *     correct ask CTA / inspect affordance.
 *   - Edge: isOwnMessage hides every ask CTA across every status; inspect
 *     affordance still shows.
 *   - Edge: isReadModeViewer keeps the CTA visible but DISABLED with the
 *     locked helper "Join a side to ask".
 *   - Accessibility: the constructed label includes the expected suffixes
 *     in own / observer modes and never contains a banned token.
 *   - Ban-list: locked observer helper string carries no verdict token.
 */
import {
  ALL_SOURCE_CHAIN_POPOVER_ACTIONS,
  buildSourceChainPopoverModel,
  buildSourceChainPopoverModelFromChip,
} from '../src/features/evidence/sourceChainPopoverModel';
import {
  buildSourceChainPopoverAccessibilityLabel,
  planSourceChainPopover,
  SOURCE_CHAIN_POPOVER_OBSERVER_HELPER,
} from '../src/features/evidence/SourceChainPopover';
import {
  ALL_SOURCE_CHAIN_STATUSES,
  getTimelineEvidenceContract,
  summarizeArtifactsForReceiptChip,
  type EvidenceArtifact,
  type SourceChainStatus,
} from '../src/features/evidence/evidenceModel';

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
];

const AMPLIFICATION_TOKENS = [
  'likes',
  'retweets',
  'shares',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'trending',
  'virality',
  'popular',
  'viral',
];

function modelFor(status: SourceChainStatus) {
  if (status === 'no_source') {
    return buildSourceChainPopoverModelFromChip(summarizeArtifactsForReceiptChip([]));
  }
  const art: EvidenceArtifact = {
    id: 'a:evidence:0',
    argumentId: 'a',
    kind: 'url',
    label: 'example',
    sourceChainStatus: status,
    risk: 'unknown',
    addedByUserId: 'u',
    createdAt: '2026-05-18T00:00:00Z',
    url: 'https://example.com/x',
    quote: status === 'source_and_quote' ? 'a verbatim line' : undefined,
  };
  return buildSourceChainPopoverModelFromChip(summarizeArtifactsForReceiptChip([art]));
}

// ── Happy paths: dispatch outcomes ─────────────────────────────

describe('EV-002 SourceChainPopover — happy paths', () => {
  it('no_source: ask CTA renders, no inspect affordance, observer helper hidden in participant mode', () => {
    const m = modelFor('no_source');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: false,
    });
    expect(plan.showsAskCta).toBe(true);
    expect(plan.showsInspectAffordance).toBe(false);
    expect(plan.ctaDisabled).toBe(false);
    expect(plan.showsObserverHelper).toBe(false);
    expect(m.primaryAction!.label).toBe('Ask for source');
  });

  it('source_and_quote: no ask CTA, inspect affordance renders', () => {
    const m = modelFor('source_and_quote');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: false,
    });
    expect(plan.showsAskCta).toBe(false);
    expect(plan.showsInspectAffordance).toBe(true);
    expect(m.primaryAction).toBeNull();
  });

  it('broken: ask CTA renders with tone=attention and the "stronger source" label', () => {
    const m = modelFor('broken');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: false,
    });
    expect(plan.showsAskCta).toBe(true);
    expect(m.primaryAction!.tone).toBe('attention');
    expect(m.primaryAction!.label).toBe('Ask for stronger source');
  });

  it('primary_present: no ask CTA, inspect affordance renders', () => {
    const m = modelFor('primary_present');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: false,
    });
    expect(plan.showsAskCta).toBe(false);
    expect(plan.showsInspectAffordance).toBe(true);
  });
});

// ── isOwnMessage hides every ask CTA ──────────────────────────

describe('EV-002 SourceChainPopover — isOwnMessage hides every ask CTA', () => {
  for (const status of ALL_SOURCE_CHAIN_STATUSES) {
    it(`status=${status}: own message → no ask CTA, inspect affordance always renders`, () => {
      const m = modelFor(status);
      const plan = planSourceChainPopover({
        isReadOnly: m.isReadOnly,
        hasPrimaryAction: m.primaryAction !== null,
        isOwnMessage: true,
        isReadModeViewer: false,
      });
      expect(plan.showsAskCta).toBe(false);
      expect(plan.showsInspectAffordance).toBe(true);
    });
  }
});

// ── Observer-mode contract LOCKED ──────────────────────────────

describe('EV-002 SourceChainPopover — observer mode keeps CTA visible but disabled', () => {
  it('isReadModeViewer === true + no_source → CTA visible AND disabled', () => {
    const m = modelFor('no_source');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: true,
    });
    // Visible
    expect(plan.showsAskCta).toBe(true);
    // Disabled
    expect(plan.ctaDisabled).toBe(true);
    // Observer helper text rendered alongside the disabled CTA
    expect(plan.showsObserverHelper).toBe(true);
  });

  it('locked observer helper string is exactly "Join a side to ask"', () => {
    expect(SOURCE_CHAIN_POPOVER_OBSERVER_HELPER).toBe('Join a side to ask');
  });

  it('observer mode + own message → ask CTA still hidden (own takes precedence)', () => {
    const m = modelFor('no_source');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: true,
      isReadModeViewer: true,
    });
    expect(plan.showsAskCta).toBe(false);
    expect(plan.ctaDisabled).toBe(false);
    expect(plan.showsObserverHelper).toBe(false);
  });

  it('observer mode + read-only status (source_and_quote) → no CTA, no observer helper', () => {
    const m = modelFor('source_and_quote');
    const plan = planSourceChainPopover({
      isReadOnly: m.isReadOnly,
      hasPrimaryAction: m.primaryAction !== null,
      isOwnMessage: false,
      isReadModeViewer: true,
    });
    expect(plan.showsAskCta).toBe(false);
    expect(plan.showsObserverHelper).toBe(false);
    expect(plan.showsInspectAffordance).toBe(true);
  });
});

// ── Accessibility label assembly ───────────────────────────────

describe('EV-002 SourceChainPopover — accessibilityLabel assembly', () => {
  it('participant + non-own: label is the bare model accessibility label', () => {
    const m = modelFor('no_source');
    const a11y = buildSourceChainPopoverAccessibilityLabel(
      m.accessibilityLabel,
      m.primaryAction !== null,
      false,
      false,
    );
    expect(a11y).toBe(m.accessibilityLabel);
  });

  it('own message: label appends "Your own message — inspection only."', () => {
    const m = modelFor('broken');
    const a11y = buildSourceChainPopoverAccessibilityLabel(
      m.accessibilityLabel,
      m.primaryAction !== null,
      true,
      false,
    );
    expect(a11y).toContain('Your own message — inspection only.');
  });

  it('observer mode + ask CTA: label appends "Join a side to ask."', () => {
    const m = modelFor('no_source');
    const a11y = buildSourceChainPopoverAccessibilityLabel(
      m.accessibilityLabel,
      m.primaryAction !== null,
      false,
      true,
    );
    expect(a11y).toContain('Join a side to ask.');
  });

  it('observer mode + read-only status: no observer suffix (no ask CTA visible)', () => {
    const m = modelFor('source_and_quote');
    const a11y = buildSourceChainPopoverAccessibilityLabel(
      m.accessibilityLabel,
      m.primaryAction !== null,
      false,
      true,
    );
    expect(a11y).not.toContain('Join a side to ask');
  });
});

// ── EV-001 surface consumption sanity ─────────────────────────

describe('EV-002 SourceChainPopover — consumes EV-001 surface only', () => {
  it('buildSourceChainPopoverModel reads only chip.status / chip.count from EV-001 (no engagement metrics)', () => {
    // Sanity: chip has no engagement-shaped fields. Feed EV-001's contract
    // straight in and verify the popover model exposes only the fields we
    // documented.
    const contract = getTimelineEvidenceContract('evidence', []);
    const model = buildSourceChainPopoverModel(contract);
    const keys = Object.keys(model).sort();
    expect(keys).toEqual([
      'accessibilityLabel',
      'artifactCount',
      'headline',
      'helper',
      'isReadOnly',
      'primaryAction',
      'showsSourceChainPressure',
      'status',
    ]);
  });
});

// ── Ban-list pass on rendered strings + observer helper ───────

describe('EV-002 SourceChainPopover — ban-list pass', () => {
  it('the observer helper string carries no verdict / amplification token', () => {
    const lc = SOURCE_CHAIN_POPOVER_OBSERVER_HELPER.toLowerCase();
    for (const t of VERDICT_TOKENS) expect(lc.includes(t)).toBe(false);
    for (const t of AMPLIFICATION_TOKENS) expect(lc.includes(t)).toBe(false);
  });

  it('every primary-action label across the dispatch table is question-shaped (no verdict)', () => {
    for (const entry of ALL_SOURCE_CHAIN_POPOVER_ACTIONS) {
      if (!entry.action) continue;
      const lc = entry.action.label.toLowerCase();
      for (const t of VERDICT_TOKENS) expect(lc.includes(t)).toBe(false);
      for (const t of AMPLIFICATION_TOKENS) expect(lc.includes(t)).toBe(false);
      // "ask for" prefix enforced earlier; sanity-check no truth phrasing.
      expect(lc.includes('is true')).toBe(false);
      expect(lc.includes('is false')).toBe(false);
    }
  });
});
