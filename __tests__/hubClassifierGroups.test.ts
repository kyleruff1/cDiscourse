/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2, ask iii) — all-families classifier
 * cap-lift + EXPLICIT production family gate + per-family grouping.
 *
 * OPS-FROZEN-SET-RESCOPE {H,I,J} → {J}: Family H (claim_clarity, PR #559) and
 * Family I (thread_topology, PR #562) are now productionEnabled, so they JOIN
 * the hub. Only Family J (sensitive_composer) is still gated out.
 *
 * Covers the design's §6.5 + §10 adversarial set:
 *   - uncapped grouped view vs the old ≤3 selected_context cap
 *   - per-family grouping via the registry lookup
 *   - unknown rawKey → "Other observations" (never the raw code)
 *   - Family H + Family I marks now RENDER on the hub (post re-scope)
 *   - HARD Family-J negative (adversarial #7): a force-passed Family J mark is
 *     dropped by the explicit family allow-list gate — it does NOT render
 *   - confidence PIPS not numbers; advisory caption present; neutral heading
 *   - the A–I allow-list is DERIVED from `productionEnabled` (the canonical
 *     family enumeration + the frozen J non-production set), not a
 *     hard-coded family code list
 *
 * Pure-model test. No React, no Supabase.
 */

import {
  buildHubClassifier,
  buildHubClassifierGroups,
  HUB_CLASSIFIER_ADVISORY_CAPTION,
  HUB_CLASSIFIER_FAMILY_HEADING,
  HUB_CLASSIFIER_OTHER_HEADING,
  HUB_NON_PRODUCTION_FAMILIES,
  HUB_PRODUCTION_ENABLED_FAMILIES,
} from '../src/features/arguments/detail/argumentDetailModel';
import { markToChip } from '../src/features/arguments/cardView/cardClassifierStripModel';
import {
  buildCardClassifierStrip,
  type BuildCardClassifierStripInput,
} from '../src/features/arguments/cardView/cardClassifierStripModel';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels/nodeLabelTypes';
import { FROZEN_NON_PRODUCTION_FAMILIES } from '../src/features/adminClassifierHealth/classifierHealthModel';
import { lookupMachineObservationDefinitionByCompoundKey } from '../src/features/nodeLabels/machineObservationDefinitions';
import type { NodeLabelMark } from '../src/features/nodeLabels/nodeLabelTypes';
import type { AutoMetadataCode } from '../src/features/metadata';

const ACTIVE = 'msg-active';

// Default fixture uses a Family A (parent_relation), rendered_now,
// auto_metadata mark (`has_rebuttal`) so the bare `mark()` SURVIVES the
// A–G family gate. Family assignments are pinned by the registry, not the
// fixture — `has_reply` (Family I) and friends are seeded explicitly where
// the negative path is under test.
function mark(over: Partial<NodeLabelMark> = {}): NodeLabelMark {
  return {
    id: over.id ?? `machine_observation:auto_metadata:${over.rawKey ?? 'has_rebuttal'}:${ACTIVE}`,
    rawKey: over.rawKey ?? 'has_rebuttal',
    kind: over.kind ?? 'machine_observation',
    source: over.source ?? 'auto_metadata',
    label: over.label ?? 'Has rebuttal',
    shortLabel: over.shortLabel ?? 'Rebuttal',
    description: over.description ?? 'A same-axis challenge was posted.',
    defaultSurface: over.defaultSurface ?? 'selected_context',
    disposition: over.disposition ?? 'rendered_now',
    priority: over.priority ?? 10,
    visibleByDefault: over.visibleByDefault ?? true,
    confidence: over.confidence,
  };
}

describe('CVDH-001 Slice 2 — production family allow-list is DERIVED, not hard-coded', () => {
  it('the non-production set mirrors the canonical frozen J set (admin-health twin)', () => {
    expect([...HUB_NON_PRODUCTION_FAMILIES].sort()).toEqual(
      [...FROZEN_NON_PRODUCTION_FAMILIES].sort(),
    );
    // Post re-scope: the frozen set is exactly Family J.
    expect([...HUB_NON_PRODUCTION_FAMILIES]).toEqual(['sensitive_composer']);
  });

  it('the allow-list is the complement of frozen-J over ALL_MACHINE_OBSERVATION_FAMILIES (exactly the 9 A–I families)', () => {
    const expected = ALL_MACHINE_OBSERVATION_FAMILIES.filter(
      (f) => !HUB_NON_PRODUCTION_FAMILIES.includes(f),
    );
    expect([...HUB_PRODUCTION_ENABLED_FAMILIES]).toEqual([...expected]);
    // The allow-list is exactly A–I (9 families) after the H/I enables.
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).toHaveLength(9);
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).toContain('parent_relation');
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).toContain('resolution_progress');
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).toContain('thread_topology'); // Family I — now production
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).toContain('claim_clarity'); // Family H — now production
    expect(HUB_PRODUCTION_ENABLED_FAMILIES).not.toContain('sensitive_composer'); // Family J — still frozen
  });
});

describe('CVDH-001 Slice 2 — buildHubClassifierGroups grouping + family gate', () => {
  it('groups surviving marks under plain-language family headings (multiple families)', () => {
    // has_rebuttal / has_counter_rebuttal → Family A (parent_relation);
    // has_evidence → Family D (evidence_source_chain).
    const marks = [
      mark({ rawKey: 'has_rebuttal', id: 'a1', label: 'Has rebuttal' }),
      mark({ rawKey: 'has_counter_rebuttal', id: 'a2', label: 'Has counter' }),
      mark({ rawKey: 'has_evidence', id: 'd1', label: 'Has evidence' }),
    ];
    const model = buildHubClassifierGroups({ marks, markToChip });
    expect(model.hasSignals).toBe(true);
    const families = model.groups.map((g) => g.familyCode);
    expect(families).toContain('parent_relation');
    expect(families).toContain('evidence_source_chain');

    const groupA = model.groups.find((g) => g.familyCode === 'parent_relation');
    expect(groupA?.familyLabel).toBe(HUB_CLASSIFIER_FAMILY_HEADING.parent_relation);
    expect(groupA?.familyLabel).not.toMatch(/_/); // plain-language, never raw code
    expect(groupA?.chips.length).toBe(2);

    const groupD = model.groups.find((g) => g.familyCode === 'evidence_source_chain');
    expect(groupD?.chips.length).toBe(1);

    // Groups are ordered by the canonical family enumeration (A before D).
    expect(families.indexOf('parent_relation')).toBeLessThan(
      families.indexOf('evidence_source_chain'),
    );
  });

  it('uncapped: surfaces MORE than the old ≤3 selected_context cap', () => {
    // 5 distinct rendered_now A/D auto-metadata codes — the capped strip
    // shows at most 3 observations; the hub shows all 5 (uncapped).
    const codes: AutoMetadataCode[] = [
      'has_rebuttal', // Family A
      'has_counter_rebuttal', // Family A
      'has_evidence', // Family D
      'source_attached', // Family D
      'quote_attached', // Family D
    ];
    const input: BuildCardClassifierStripInput = {
      activeMessageId: ACTIVE,
      persistedClassifierRows: [],
      manualTagEntries: [],
      autoMetadataCodes: codes,
      clusterState: 'open',
      messageContribution: null,
    };
    const capped = buildCardClassifierStrip(input);
    expect(capped.chips.length).toBeLessThanOrEqual(3);

    const hub = buildHubClassifier(input);
    const totalHubChips = hub.groups.reduce((n, g) => n + g.chips.length, 0);
    expect(totalHubChips).toBeGreaterThan(capped.chips.length);
    expect(totalHubChips).toBe(5);
  });

  it('unknown rawKey → "Other observations" group, never the raw code', () => {
    const marks = [
      mark({
        rawKey: 'totally_unknown_raw_key',
        id: 'u1',
        source: 'ai_classifier',
        label: 'Some observation',
      }),
    ];
    // Confirm the (source, rawKey) genuinely has no registry entry.
    expect(
      lookupMachineObservationDefinitionByCompoundKey('ai_classifier', 'totally_unknown_raw_key'),
    ).toBeNull();
    const model = buildHubClassifierGroups({ marks, markToChip });
    expect(model.hasSignals).toBe(true);
    const other = model.groups.find((g) => g.familyCode === 'other');
    expect(other).toBeDefined();
    expect(other?.familyLabel).toBe(HUB_CLASSIFIER_OTHER_HEADING);
    expect(other?.familyLabel).not.toContain('totally_unknown_raw_key');
    // No rendered string is the raw code.
    expect(JSON.stringify(model)).not.toContain('totally_unknown_raw_key');
  });

  it('confidence renders as PIPS (1-3), never a number string', () => {
    const marks = [mark({ rawKey: 'has_rebuttal', id: 'c1', confidence: 'high' })];
    const model = buildHubClassifierGroups({ marks, markToChip });
    const chip = model.groups[0].chips[0];
    expect(chip.confidencePips).toBe(3);
    expect(chip.label).not.toMatch(/[0-9]/);
    // The confidence is not surfaced as a numeric string anywhere on the chip.
    expect(chip.confidenceLabel).toBe('high confidence');
  });

  it('carries the advisory caption (never a verdict)', () => {
    const model = buildHubClassifierGroups({ marks: [mark()], markToChip });
    expect(model.advisoryCaption).toBe(HUB_CLASSIFIER_ADVISORY_CAPTION);
    expect(model.advisoryCaption).toContain('advisory, not a verdict');
  });

  it('empty marks → empty model (teaching state, not a verdict)', () => {
    const model = buildHubClassifierGroups({ marks: [], markToChip });
    expect(model.hasSignals).toBe(false);
    expect(model.groups).toHaveLength(0);
    expect(model.emptyStateCopy.toLowerCase()).not.toContain('no issues');
    expect(model.emptyStateCopy.toLowerCase()).not.toContain('clean');
  });
});

describe('CVDH-001 Slice 2 — Family I + H now RENDER; HARD Family-J negative (adversarial #7)', () => {
  it('a Family I rendered_now mark (no_response_after_n_turns) NOW RENDERS on the hub (post re-scope)', () => {
    // Prove the seed is genuinely Family I AND genuinely rendered_now.
    const def = lookupMachineObservationDefinitionByCompoundKey(
      'auto_metadata',
      'no_response_after_n_turns',
    );
    expect(def).not.toBeNull();
    expect(def!.family).toBe('thread_topology'); // Family I
    expect(def!.disposition).toBe('rendered_now'); // passes selected_context

    const familyIMark = mark({
      rawKey: 'no_response_after_n_turns',
      id: 'i1',
      source: 'auto_metadata',
      label: 'No follow-up',
      disposition: 'rendered_now',
    });
    const model = buildHubClassifierGroups({ marks: [familyIMark], markToChip });

    // Family I is now productionEnabled (PR #562), so the mark renders under
    // the thread_topology group.
    expect(model.hasSignals).toBe(true);
    const group = model.groups.find((g) => g.familyCode === 'thread_topology');
    expect(group).toBeDefined();
    expect(group?.familyLabel).toBe(HUB_CLASSIFIER_FAMILY_HEADING.thread_topology);
    expect(group?.familyLabel).not.toMatch(/_/); // plain-language heading, never raw code
    expect(group?.chips.length).toBeGreaterThanOrEqual(1);
    // markToChip maps mark.label → chip.longLabel (chip.label is mark.shortLabel).
    expect(group?.chips.some((c) => c.longLabel === 'No follow-up')).toBe(true);
  });

  it('through the FULL pipeline, a seeded Family I auto-metadata code NOW reaches the hub', () => {
    // Seed via the autoMetadataCodes input (the real surface path).
    const input: BuildCardClassifierStripInput = {
      activeMessageId: ACTIVE,
      persistedClassifierRows: [],
      manualTagEntries: [],
      autoMetadataCodes: ['no_response_after_n_turns'],
      clusterState: 'open',
      messageContribution: null,
    };
    // The capped strip surfaces the Family I rendered_now mark.
    const capped = buildCardClassifierStrip(input);
    expect(capped.hasSignals).toBe(true);
    expect(capped.chips.some((c) => c.label === 'No follow-up')).toBe(true);

    // The hub (production gate now admits A–I) also surfaces it.
    const hub = buildHubClassifier(input);
    expect(hub.hasSignals).toBe(true);
    expect(JSON.stringify(hub)).toContain('No follow-up');
    expect(hub.groups.some((g) => g.familyCode === 'thread_topology')).toBe(true);
  });

  it('a Family H mark (claim_present) NOW RENDERS on the hub (post re-scope)', () => {
    const hDef = lookupMachineObservationDefinitionByCompoundKey(
      'ai_classifier',
      'claim_present',
    );
    expect(hDef).not.toBeNull();
    expect(hDef!.family).toBe('claim_clarity'); // Family H

    const familyHMark = mark({
      rawKey: 'claim_present',
      id: 'h1',
      source: 'ai_classifier',
      label: 'Claim present',
      disposition: 'rendered_now',
    });
    const model = buildHubClassifierGroups({ marks: [familyHMark], markToChip });

    expect(model.hasSignals).toBe(true);
    const group = model.groups.find((g) => g.familyCode === 'claim_clarity');
    expect(group).toBeDefined();
    expect(group?.familyLabel).toBe(HUB_CLASSIFIER_FAMILY_HEADING.claim_clarity);
    expect(group?.chips.length).toBeGreaterThanOrEqual(1);
    expect(group?.chips.some((c) => c.longLabel === 'Claim present')).toBe(true);
  });

  it('a force-passed Family J mark is STILL DROPPED by the family gate (still frozen)', () => {
    // Family J is composer_only and never reaches selected_context via the
    // pipeline; force-pass disposition to isolate the family gate.
    const familyJMark = mark({
      rawKey: 'shifts_to_person_or_intent',
      id: 'j1',
      source: 'semantic_referee',
      label: 'Shifts to person',
      disposition: 'rendered_now',
    });
    const jDef = lookupMachineObservationDefinitionByCompoundKey(
      'semantic_referee',
      'shifts_to_person_or_intent',
    );
    expect(jDef).not.toBeNull();
    expect(jDef!.family).toBe('sensitive_composer'); // Family J

    const model = buildHubClassifierGroups({ marks: [familyJMark], markToChip });

    // Family J is still gated out — nothing renders.
    expect(model.hasSignals).toBe(false);
    const json = JSON.stringify(model);
    expect(json).not.toContain('Shifts to person');

    // No production group ever contains a Family J chip.
    for (const group of model.groups) {
      if (group.familyCode !== 'other') {
        expect(HUB_PRODUCTION_ENABLED_FAMILIES).toContain(group.familyCode);
      }
    }
  });
});
