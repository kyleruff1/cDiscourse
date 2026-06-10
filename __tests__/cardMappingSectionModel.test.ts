/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice B) — cardMappingSectionModel
 * pure-model tests.
 *
 * Covers (test-discipline; design §2 / §3 / cdiscourse-doctrine §1/§9/§10a):
 *   - builds chips from the evaluator's `card`-surface results
 *   - empty / no-results → teaching empty state, hasSignals false
 *   - confidence → PIPS count (low=1 / medium=2 / high=3), never a number
 *   - composite-supersedes-singles: a consumed single does not also render
 *   - DEFENSIVE: a result whose displayLabel is a raw internal code is dropped
 *   - DEFENSIVE: a result referencing the frozen Family J is dropped (H + I
 *     are now production-enabled — PR #559 / #562 — and render)
 *   - ban-list: no verdict tokens / snake_case in any rendered field
 *
 * Expectations track the REAL Slice-A registry semantics (verified against
 * the evaluator output): the `parent_relation.single_true.challenges_parent`
 * rule is always consumed by a pair on `challenges_parent`, so a clean
 * standalone single is exercised via `refines_parent` (no composite consumes
 * it) and `provides_evidence` (MBOM-00031, the cross-family does not fire
 * without `disputes_evidence_applicability`).
 *
 * Pure-model: imports the model directly + the real Slice-A evaluator +
 * registry. No React, no Supabase, no fetch.
 */

import {
  buildCardMappingSection,
  CARD_MAPPING_ADVISORY_CAPTION,
  CARD_MAPPING_EMPTY_STATE,
  CARD_MAPPING_SECTION_HEADING,
} from '../src/features/arguments/cardView/cardMappingSectionModel';
import {
  evaluateObservationMapping,
  OBSERVATION_MAPPING_REGISTRY,
} from '../src/features/nodeLabels/observationMapping';
import type { ObservationMappingResult } from '../src/features/nodeLabels/observationMapping';

function cardResults(positiveRawKeys: ReadonlyArray<string>): ReadonlyArray<ObservationMappingResult> {
  return evaluateObservationMapping(positiveRawKeys, OBSERVATION_MAPPING_REGISTRY, {
    surface: 'card',
  });
}

describe('buildCardMappingSection — happy path', () => {
  it('renders a standalone single that no composite consumes', () => {
    const section = buildCardMappingSection(cardResults(['refines_parent']));
    expect(section.hasSignals).toBe(true);
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain('parent_relation.single_true.refines_parent');
    expect(section.heading).toBe(CARD_MAPPING_SECTION_HEADING);
    expect(section.advisoryCaption).toBe(CARD_MAPPING_ADVISORY_CAPTION);
  });

  it('carries the plain-language short label + diagnostic on each chip', () => {
    const section = buildCardMappingSection(cardResults(['refines_parent']));
    const chip = section.chips.find(
      (c) => c.id === 'parent_relation.single_true.refines_parent',
    );
    expect(chip).toBeTruthy();
    expect(chip!.label).toBe('Refines the parent');
    expect(chip!.diagnosticSentence.length).toBeGreaterThan(0);
  });

  it('renders the adopted-from-CSV evidence single (MBOM-00031)', () => {
    const section = buildCardMappingSection(cardResults(['provides_evidence']));
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain('MBOM-00031');
  });

  it('preserves evaluator ordering (displayPriority asc, then mappingId)', () => {
    const section = buildCardMappingSection(cardResults(['refines_parent']));
    // The evaluator already sorts; the model preserves that order. The
    // highest-priority (lowest number) chip must be first.
    const ids = section.chips.map((c) => c.id);
    expect(ids.length).toBeGreaterThan(1);
    // MBOM-00032 (priority 102) sorts after the refines single (priority 102,
    // tie broken by mappingId: 'MBOM-00032' < 'parent_relation...'). Assert the
    // section's order matches the evaluator's order exactly.
    const evalOrder = cardResults(['refines_parent']).map((r) => r.mappingId);
    expect(ids).toEqual(evalOrder);
  });
});

describe('buildCardMappingSection — composite-supersedes-singles', () => {
  it('does NOT render a consumed single alongside its pair composite', () => {
    // challenges_parent + quote_anchors_parent fires the pair "Anchored
    // challenge", which consumes the challenges_parent single.
    const section = buildCardMappingSection(
      cardResults(['challenges_parent', 'quote_anchors_parent']),
    );
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain(
      'parent_relation.pair_true_true.challenges_parent+quote_anchors_parent',
    );
    // The consumed single is NOT also rendered.
    expect(ids).not.toContain('parent_relation.single_true.challenges_parent');
  });

  it('does NOT render the concedes single alongside the narrowing pair', () => {
    const section = buildCardMappingSection(
      cardResults(['narrows_claim', 'concedes_narrow_point']),
    );
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain(
      'resolution_progress.pair_true_true.narrows_claim+concedes_narrow_point',
    );
    expect(ids).not.toContain(
      'resolution_progress.single_true.concedes_narrow_point',
    );
  });

  it('curated triple renders and its consumed singles do not', () => {
    const section = buildCardMappingSection(
      cardResults([
        'challenges_parent',
        'quote_anchors_parent',
        'corrects_parent_detail',
      ]),
    );
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain(
      'parent_relation.curated_triple.challenges_parent+quote_anchors_parent+corrects_parent_detail',
    );
    expect(ids).not.toContain('parent_relation.single_true.challenges_parent');
  });
});

describe('buildCardMappingSection — empty / degenerate', () => {
  it('returns the teaching empty state for no positive rawKeys', () => {
    const section = buildCardMappingSection(cardResults([]));
    expect(section.hasSignals).toBe(false);
    expect(section.chips).toHaveLength(0);
    expect(section.emptyStateCopy).toBe(CARD_MAPPING_EMPTY_STATE);
    // Never a verdict-style "clean" / "no issues".
    expect(section.emptyStateCopy.toLowerCase()).not.toContain('clean');
    expect(section.emptyStateCopy.toLowerCase()).not.toContain('no issues');
  });

  it('returns the empty state for null / undefined input', () => {
    expect(buildCardMappingSection(null).hasSignals).toBe(false);
    expect(buildCardMappingSection(undefined).hasSignals).toBe(false);
  });

  it('a node with NO persisted positive rawKeys yields the empty state', () => {
    // An empty positive set is the realistic "node with no machine
    // observations" case (absence of a row IS the negative per the
    // persistence schema). The evaluator returns [] for an empty set, so the
    // section is the teaching empty state.
    const section = buildCardMappingSection(cardResults([]));
    expect(section.hasSignals).toBe(false);
    expect(section.chips).toHaveLength(0);
  });

  it('an unknown positive rawKey still surfaces the absence (negative) labels', () => {
    // Documented evaluator behavior: with a non-empty positive set, the
    // single_false negatives fire on the absence of their canonical positive.
    // The section renders what the evaluator returns (no positive composite,
    // but the absence observations are surfaced). This is NOT empty.
    const section = buildCardMappingSection(cardResults(['zzz_not_a_flag']));
    expect(section.hasSignals).toBe(true);
    const ids = section.chips.map((c) => c.id);
    expect(ids).toContain('evidence_source_chain.single_false.has_evidence');
  });
});

describe('buildCardMappingSection — confidence as PIPS, never a number', () => {
  it('maps the pip level to a 1/2/3 count + plain-language word', () => {
    const section = buildCardMappingSection(cardResults(['refines_parent']));
    const chip = section.chips.find(
      (c) => c.id === 'parent_relation.single_true.refines_parent',
    );
    // The refines single carries `confidencePip: 'medium'` → 2 pips.
    expect(chip!.confidencePips).toBe(2);
    expect(chip!.confidenceLabel).toBe('medium confidence');
  });

  it('maps a high-confidence pair to 3 pips', () => {
    const section = buildCardMappingSection(
      cardResults(['source_attached', 'quote_attached']),
    );
    const chip = section.chips.find(
      (c) => c.id === 'evidence_source_chain.pair_true_true.source_attached+quote_attached',
    );
    expect(chip!.confidencePips).toBe(3);
    expect(chip!.confidenceLabel).toBe('high confidence');
  });

  it('never emits a numeric confidence anywhere in a chip field', () => {
    const section = buildCardMappingSection(
      cardResults(['source_attached', 'quote_attached']),
    );
    for (const chip of section.chips) {
      expect(chip.label).not.toMatch(/\d+\s*%/);
      expect(chip.accessibilityLabel).not.toMatch(/\d+\s*%/);
      expect(chip.confidenceLabel).toMatch(/confidence$/);
    }
  });
});

describe('buildCardMappingSection — defensive guards', () => {
  function fakeResult(over: Partial<ObservationMappingResult>): ObservationMappingResult {
    return {
      mappingId: 'fake-1',
      observationCode: 'fake.code',
      displayLabel: 'A readable label',
      shortLabel: 'Readable',
      diagnosticSentence: 'A readable diagnostic about the move.',
      familyKey: 'parent_relation',
      ruleKind: 'single_true',
      displayPriority: 50,
      confidencePip: 'medium',
      kind: 'machine_observation',
      ...over,
    };
  }

  it('drops a result whose displayLabel is a raw internal snake_case code', () => {
    const section = buildCardMappingSection([
      fakeResult({ displayLabel: 'challenges_parent_detail' }),
    ]);
    expect(section.hasSignals).toBe(false);
  });

  it('drops a result referencing the frozen Family J (sensitive_composer)', () => {
    const section = buildCardMappingSection([
      fakeResult({ familyKey: 'sensitive_composer' }),
    ]);
    expect(section.hasSignals).toBe(false);
  });

  it('KEEPS a result referencing Family H or Family I (now production-enabled, PR #559 / #562)', () => {
    for (const production of ['claim_clarity', 'thread_topology']) {
      const section = buildCardMappingSection([fakeResult({ familyKey: production })]);
      expect(section.hasSignals).toBe(true);
    }
  });

  it('drops a cross-family result if EITHER half is the frozen Family J', () => {
    const section = buildCardMappingSection([
      fakeResult({ familyKey: 'parent_relation+sensitive_composer' }),
    ]);
    expect(section.hasSignals).toBe(false);
  });

  it('keeps a well-formed production result through the guards', () => {
    const section = buildCardMappingSection([fakeResult({})]);
    expect(section.hasSignals).toBe(true);
    expect(section.chips[0].label).toBe('Readable');
  });
});

describe('buildCardMappingSection — doctrine ban-list', () => {
  // Standalone verdict WORDS — matched at word boundaries so a legitimate
  // verb ("corrects") does not trip the "correct" verdict token.
  const BANNED_WORDS = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'manipulative',
    'extremist',
    'propagandist',
  ];
  // Multi-word verdict phrases — matched as substrings.
  const BANNED_PHRASES = ['bad faith'];

  it('emits no verdict tokens or snake_case in any rendered field', () => {
    // Fire a broad set of rules across families.
    const section = buildCardMappingSection(
      cardResults([
        'challenges_parent',
        'quote_anchors_parent',
        'corrects_parent_detail',
        'source_attached',
        'quote_attached',
        'provides_evidence',
        'narrows_claim',
        'concedes_narrow_point',
        'refines_parent',
        'disputes_evidence_applicability',
        'asks_for_evidence',
      ]),
    );
    expect(section.chips.length).toBeGreaterThan(0);
    for (const chip of section.chips) {
      const fields = [chip.label, chip.longLabel, chip.diagnosticSentence, chip.accessibilityLabel];
      for (const field of fields) {
        const lower = field.toLowerCase();
        for (const w of BANNED_WORDS) {
          expect(lower).not.toMatch(new RegExp(`\\b${w}\\b`));
        }
        for (const p of BANNED_PHRASES) {
          expect(lower).not.toContain(p);
        }
        // No raw snake_case identifier leaks into a rendered label/diagnostic.
        expect(field).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
      }
    }
  });
});
