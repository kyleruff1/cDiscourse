/**
 * UX-001.5A — Source adapter tests.
 *
 * Maps acceptance criteria AC 9, 12, 13 (every classifier accounted for
 * + no unbounded list + Timeline cap-respect at the source level).
 *
 * Critical: validates the implementer Stop Conditions 17 and 18:
 *   - Source 4 + Source 6 adapters return [] for ALL test inputs.
 *   - Source 5 node-mount adapter returns [] for ALL test inputs.
 */

import type { ManualTagEntry } from '../src/features/metadata/moveMetadataLedger';
import {
  adaptAllSourcesForNode,
  adaptAutoMetadataSource,
  adaptCompositionMutationSource,
  adaptLifecycleSource,
  adaptManualTagSource,
  adaptRawClassifierBinarySource,
  adaptSemanticRefereeSourceComposer,
  adaptSemanticRefereeSourceNodeMount,
} from '../src/features/nodeLabels/nodeLabelSourceAdapters';

function manualTag(code: string): ManualTagEntry {
  return {
    code: code as ManualTagEntry['code'],
    appliedByUserId: 'user-1',
    appliedByActorRole: 'participant_affirmative',
    appliedAt: '2026-05-25T12:00:00.000Z',
    dedupeKey: `${code}:user-1`,
  };
}

describe('UX-001.5A — adaptManualTagSource (Source 1)', () => {
  it('emits one mark per known manual tag', () => {
    const result = adaptManualTagSource({
      manualTagEntries: [manualTag('needs_source')],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe('user_allegation');
    expect(result[0].source).toBe('manual_tag');
    expect(result[0].rawKey).toBe('needs_source');
  });

  it('emits the per-node id with messageId baked in', () => {
    const result = adaptManualTagSource({
      manualTagEntries: [manualTag('definition_issue')],
      messageId: 'msg-7',
    });
    expect(result[0].id).toBe('user_allegation:manual_tag:definition_issue:msg-7');
  });

  it('emits multiple marks for multiple entries', () => {
    const result = adaptManualTagSource({
      manualTagEntries: [
        manualTag('needs_source'),
        manualTag('needs_quote'),
        manualTag('tangent'),
      ],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(3);
  });

  it('returns [] for empty input', () => {
    expect(adaptManualTagSource({ manualTagEntries: [], messageId: 'msg-1' })).toEqual([]);
  });

  it('drops unknown codes silently', () => {
    const result = adaptManualTagSource({
      manualTagEntries: [manualTag('nonexistent_code'), manualTag('needs_source')],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].rawKey).toBe('needs_source');
  });

  it('returns [] for empty messageId', () => {
    expect(adaptManualTagSource({ manualTagEntries: [manualTag('needs_source')], messageId: '' })).toEqual([]);
  });

  it('handles missing entries gracefully', () => {
    expect(
      adaptManualTagSource({ manualTagEntries: null as unknown as never, messageId: 'msg-1' }),
    ).toEqual([]);
  });
});

describe('UX-001.5A — adaptAutoMetadataSource (Source 2)', () => {
  it('emits one mark per known auto metadata code with source auto_metadata', () => {
    const result = adaptAutoMetadataSource({
      autoMetadataCodes: ['has_evidence'],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe('machine_observation');
    expect(result[0].source).toBe('auto_metadata');
    expect(result[0].rawKey).toBe('has_evidence');
  });

  it('emits the auto_metadata branch for source_requested even though lifecycle owns it too', () => {
    const result = adaptAutoMetadataSource({
      autoMetadataCodes: ['source_requested'],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('auto_metadata');
  });

  it('emits the per-node id with messageId baked in', () => {
    const result = adaptAutoMetadataSource({
      autoMetadataCodes: ['has_rebuttal'],
      messageId: 'msg-2',
    });
    expect(result[0].id).toBe('machine_observation:auto_metadata:has_rebuttal:msg-2');
  });

  it('emits multiple marks for multiple codes', () => {
    const result = adaptAutoMetadataSource({
      autoMetadataCodes: ['has_evidence', 'has_rebuttal', 'branch_suggested'],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(3);
  });

  it('returns [] for empty input', () => {
    expect(adaptAutoMetadataSource({ autoMetadataCodes: [], messageId: 'msg-1' })).toEqual([]);
  });

  it('drops unknown codes silently', () => {
    const result = adaptAutoMetadataSource({
      autoMetadataCodes: ['unknown_classifier_id' as never, 'has_evidence'],
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].rawKey).toBe('has_evidence');
  });

  it('returns [] for empty messageId', () => {
    expect(adaptAutoMetadataSource({ autoMetadataCodes: ['has_evidence'], messageId: '' })).toEqual(
      [],
    );
  });
});

describe('UX-001.5A — adaptLifecycleSource (Source 3)', () => {
  it('emits one mark for cluster state when messageContribution is null', () => {
    const result = adaptLifecycleSource({
      clusterState: 'rebutted',
      messageContribution: null,
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('lifecycle');
    expect(result[0].rawKey).toBe('rebutted');
  });

  it('emits TWO marks when cluster and messageContribution differ', () => {
    const result = adaptLifecycleSource({
      clusterState: 'rebutted',
      messageContribution: 'sourced',
      messageId: 'msg-1',
    });
    expect(result.length).toBe(2);
    expect(result.map((m) => m.rawKey).sort()).toEqual(['rebutted', 'sourced']);
  });

  it('emits ONE mark when cluster and messageContribution are equal', () => {
    const result = adaptLifecycleSource({
      clusterState: 'narrowed',
      messageContribution: 'narrowed',
      messageId: 'msg-1',
    });
    expect(result.length).toBe(1);
  });

  it('emits the cluster id correctly', () => {
    const result = adaptLifecycleSource({
      clusterState: 'rebutted',
      messageContribution: null,
      messageId: 'msg-9',
    });
    expect(result[0].id).toBe('machine_observation:lifecycle:cluster:rebutted:msg-9');
  });

  it('emits the message id correctly when distinct contribution exists', () => {
    const result = adaptLifecycleSource({
      clusterState: 'rebutted',
      messageContribution: 'sourced',
      messageId: 'msg-9',
    });
    const msgMark = result.find((m) => m.id.includes(':message:'));
    expect(msgMark?.id).toBe('machine_observation:lifecycle:message:sourced:msg-9');
  });

  it('returns [] for empty messageId', () => {
    expect(
      adaptLifecycleSource({
        clusterState: 'rebutted',
        messageContribution: null,
        messageId: '',
      }),
    ).toEqual([]);
  });

  it('skips unknown cluster states silently', () => {
    expect(
      adaptLifecycleSource({
        clusterState: 'unknown_state' as never,
        messageContribution: null,
        messageId: 'msg-1',
      }),
    ).toEqual([]);
  });
});

describe('UX-001.5A — adaptCompositionMutationSource (Source 4 — STOP CONDITION 17)', () => {
  // Stop condition 17: Source 4 OR Source 6 adapter emits non-empty for
  // ANY test input → HALT. These tests provide a battery of input shapes
  // and assert empty.
  const fixtures = [
    { messageId: 'msg-1' },
    { messageId: 'msg-1', mutations: [] },
    { messageId: 'msg-1', mutations: [{ kind: 'fake-mutation' }] },
    { messageId: 'msg-1', mutations: [null, undefined, 'string', 42, {}] as unknown as never },
    { messageId: '' },
    { messageId: 'msg-9999', mutations: Array(100).fill({ data: 'noisy' }) },
    { messageId: 'msg-with-special-!@#$', mutations: [{}] },
  ];

  for (const fixture of fixtures) {
    it(`returns [] for input ${JSON.stringify(fixture).slice(0, 60)}`, () => {
      expect(adaptCompositionMutationSource(fixture as never)).toEqual([]);
    });
  }
});

describe('UX-001.5A — adaptSemanticRefereeSourceComposer (Source 5 composer-only)', () => {
  it('emits one mark per known composer-only code with source semantic_referee', () => {
    const result = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes: ['shifts_to_person_or_intent'],
      moveId: 'move-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].kind).toBe('machine_observation');
    expect(result[0].source).toBe('semantic_referee');
    expect(result[0].disposition).toBe('composer_only');
  });

  it('emits the per-move id with moveId baked in', () => {
    const result = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes: ['needs_pre_send_pause'],
      moveId: 'move-7',
    });
    expect(result[0].id).toBe(
      'machine_observation:semantic_referee:composer:needs_pre_send_pause:move-7',
    );
  });

  it('emits all three sensitive composer-only codes when present', () => {
    const result = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes: [
        'shifts_to_person_or_intent',
        'contains_unplayable_insult_only',
        'needs_pre_send_pause',
      ],
      moveId: 'move-1',
    });
    expect(result.length).toBe(3);
    for (const mark of result) {
      expect(mark.disposition).toBe('composer_only');
    }
  });

  it('drops non-composer_only codes silently (e.g. inspect_only sensitive entries)', () => {
    const result = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes: ['uses_popularity_as_evidence'],
      moveId: 'move-1',
    });
    // uses_popularity_as_evidence is semantic_referee BUT disposition is
    // inspect_only — the composer adapter only emits composer_only.
    expect(result).toEqual([]);
  });

  it('drops unknown codes silently', () => {
    const result = adaptSemanticRefereeSourceComposer({
      composerOnlyCodes: ['unknown_code', 'shifts_to_person_or_intent'],
      moveId: 'move-1',
    });
    expect(result.length).toBe(1);
    expect(result[0].rawKey).toBe('shifts_to_person_or_intent');
  });

  it('returns [] for empty codes', () => {
    expect(
      adaptSemanticRefereeSourceComposer({ composerOnlyCodes: [], moveId: 'move-1' }),
    ).toEqual([]);
  });

  it('returns [] for empty moveId', () => {
    expect(
      adaptSemanticRefereeSourceComposer({
        composerOnlyCodes: ['shifts_to_person_or_intent'],
        moveId: '',
      }),
    ).toEqual([]);
  });
});

describe('UX-001.5A — adaptSemanticRefereeSourceNodeMount (Source 5 node-mount — STOP CONDITION 18)', () => {
  // Stop condition 18: Source 5 node-mount adapter emits non-empty for
  // ANY test input → HALT. These tests provide a battery of input shapes
  // and assert empty.
  const fixtures = [
    { messageId: 'msg-1' },
    { messageId: 'msg-1', refereePacket: undefined },
    { messageId: 'msg-1', refereePacket: { kind: 'fake-packet' } },
    { messageId: 'msg-1', refereePacket: { positiveBinaries: [{ classifierId: 'x' }] } },
    { messageId: '' },
    { messageId: 'msg-9999', refereePacket: { complex: { nested: { data: 'noisy' } } } },
    { messageId: 'msg-with-special-!@#$', refereePacket: 42 as unknown as never },
  ];

  for (const fixture of fixtures) {
    it(`returns [] for input ${JSON.stringify(fixture).slice(0, 60)}`, () => {
      expect(adaptSemanticRefereeSourceNodeMount(fixture as never)).toEqual([]);
    });
  }
});

describe('UX-001.5A — adaptRawClassifierBinarySource (Source 6 — STOP CONDITION 17)', () => {
  // Stop condition 17: Source 4 OR Source 6 adapter emits non-empty for
  // ANY test input → HALT. These tests provide a battery of input shapes
  // and assert empty.
  const fixtures = [
    { messageId: 'msg-1' },
    { messageId: 'msg-1', binaries: [] },
    { messageId: 'msg-1', binaries: [{ classifierId: 'x', value: 1 }] },
    { messageId: 'msg-1', binaries: [null, undefined, 'string', 42, {}] as unknown as never },
    { messageId: '' },
    { messageId: 'msg-9999', binaries: Array(100).fill({ data: 'noisy' }) },
    { messageId: 'msg-with-special-!@#$', binaries: [{}] },
  ];

  for (const fixture of fixtures) {
    it(`returns [] for input ${JSON.stringify(fixture).slice(0, 60)}`, () => {
      expect(adaptRawClassifierBinarySource(fixture as never)).toEqual([]);
    });
  }
});

describe('UX-001.5A — adaptAllSourcesForNode aggregator', () => {
  it('composes the PerNodeMarkInput shape correctly', () => {
    const result = adaptAllSourcesForNode({
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
      messageId: 'msg-1',
    });
    expect(result.manualTagMarks.length).toBe(1);
    expect(result.autoMetadataMarks.length).toBe(1);
    expect(result.lifecycleMarks.length).toBe(1);
    expect(result.compositionMutationMarks).toEqual([]);
    expect(result.semanticRefereeNodeMountMarks).toEqual([]);
    expect(result.rawClassifierMarks).toEqual([]);
  });

  it('keeps composition/node-mount/classifier arrays empty even with rich inputs', () => {
    const result = adaptAllSourcesForNode({
      manualTagEntries: [
        manualTag('needs_source'),
        manualTag('definition_issue'),
        manualTag('tangent'),
      ],
      autoMetadataCodes: ['has_evidence', 'has_rebuttal', 'branch_suggested'],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
      messageId: 'msg-1',
    });
    expect(result.manualTagMarks.length).toBe(3);
    expect(result.autoMetadataMarks.length).toBe(3);
    expect(result.lifecycleMarks.length).toBe(2);
    expect(result.compositionMutationMarks).toEqual([]);
    expect(result.semanticRefereeNodeMountMarks).toEqual([]);
    expect(result.rawClassifierMarks).toEqual([]);
  });

  it('returns empty arrays for empty inputs', () => {
    const result = adaptAllSourcesForNode({
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      messageId: 'msg-1',
    });
    expect(result.manualTagMarks).toEqual([]);
    expect(result.autoMetadataMarks).toEqual([]);
    expect(result.lifecycleMarks.length).toBe(1); // cluster state 'open' still emits 1
    expect(result.compositionMutationMarks).toEqual([]);
    expect(result.semanticRefereeNodeMountMarks).toEqual([]);
    expect(result.rawClassifierMarks).toEqual([]);
  });
});

describe('UX-001.5A — Stop Conditions 17/18 — explicit battery (random inputs)', () => {
  it('Source 4 adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const input = {
        messageId: `random-msg-${i}`,
        mutations: Array(i).fill({ random: Math.random() }),
      };
      expect(adaptCompositionMutationSource(input as never)).toEqual([]);
    }
  });

  it('Source 5 node-mount adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const input = {
        messageId: `random-msg-${i}`,
        refereePacket: { iteration: i, random: Math.random() },
      };
      expect(adaptSemanticRefereeSourceNodeMount(input as never)).toEqual([]);
    }
  });

  it('Source 6 adapter returns [] for 20 random inputs', () => {
    for (let i = 0; i < 20; i += 1) {
      const input = {
        messageId: `random-msg-${i}`,
        binaries: Array(i).fill({ random: Math.random() }),
      };
      expect(adaptRawClassifierBinarySource(input as never)).toEqual([]);
    }
  });
});
