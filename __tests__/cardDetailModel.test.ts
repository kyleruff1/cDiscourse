/**
 * CARD-VIEW-DATA-001 — cardDetailModel tests.
 *
 * Covers the pure builder `buildCardDetailViewModel` + the
 * `artifactsToEvidenceSources` helper:
 *   - determinism + non-mutation of inputs
 *   - each zone populated from representative inputs
 *   - unknown lifecycle codes SUPPRESSED (null), not echoed raw
 *   - NO verdict tokens in any output field (ban-list scan)
 *   - NO `inactive_reason` field / value anywhere
 *   - §10a surface filter drops composer_only marks from the classifier strip
 *   - empty inputs → safe empty zones
 *
 * Pure-model test: imports the builder directly. No React, no Supabase.
 */

import {
  artifactsToEvidenceSources,
  buildCardDetailViewModel,
  CARD_DETAIL_EVIDENCE_EMPTY,
  type BuildCardDetailViewModelInput,
} from '../src/features/arguments/cardView/cardDetailModel';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';

const ACTIVE = 'msg-active';
const PARENT = 'msg-parent';

function persistedRow(
  overrides: Partial<MachineObservationResultRow> = {},
): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: ACTIVE,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  };
}

function artifact(overrides: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: 'ev-1',
    argumentId: ACTIVE,
    kind: 'url',
    label: 'nytimes.com/example',
    sourceChainStatus: 'unverified',
    risk: 'low',
    addedByUserId: 'u-1',
    createdAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  } as EvidenceArtifact;
}

const ORDINALS: Record<string, number> = { [ACTIVE]: 4, [PARENT]: 3 };
const KINDS: Record<string, string> = { [ACTIVE]: 'rebuttal', [PARENT]: 'claim' };
const PARENTS: Record<string, string | null> = { [ACTIVE]: PARENT, [PARENT]: null };

function baseInput(
  overrides: Partial<BuildCardDetailViewModelInput> = {},
): BuildCardDetailViewModelInput {
  return {
    activeMessageId: ACTIVE,
    chronologicalIds: [PARENT, ACTIVE],
    ordinalOf: (id) => ORDINALS[id] ?? null,
    kindLabelOf: (id) => KINDS[id] ?? 'move',
    parentIdOf: (id) => PARENTS[id] ?? null,
    categoryLabel: 'Rebuttal',
    qualifierLabels: ['Scope challenge'],
    persistedClassifierRows: [persistedRow()],
    manualTagEntries: [],
    autoMetadataCodes: [],
    clusterState: 'rebutted',
    messageContribution: null,
    evidenceSources: [],
    evidenceDebtSummary: 'Receipts owed: a source for this claim.',
    standingHint: 'Needs work',
    lifecycleState: 'rebutted',
    flagLabels: ['Scope challenge'],
    ...overrides,
  };
}

const BANNED = [
  'winner',
  'loser',
  ' true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'correct',
];

/** Recursively collect every string value in an object/array. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

describe('CARD-VIEW-DATA-001 — buildCardDetailViewModel — zones populated', () => {
  it('builds the step-reference line with a tappable parent token', () => {
    const m = buildCardDetailViewModel(baseInput());
    expect(m.stepReference.text).toBe(
      'Acting on #4 (rebuttal) · Replied to #3 (claim)',
    );
    expect(m.stepReference.parentOrdinalToken).toBe('#3');
    expect(m.stepReference.parentMessageId).toBe(PARENT);
  });

  it('surfaces category + qualifier labels', () => {
    const m = buildCardDetailViewModel(baseInput());
    expect(m.categoryLabel).toBe('Rebuttal');
    expect(m.qualifierLabels).toEqual(['Scope challenge']);
  });

  it('produces a classifier chip from a persisted observation row (PIPS, not a number)', () => {
    const m = buildCardDetailViewModel(baseInput());
    expect(m.classifierStrip.hasSignals).toBe(true);
    expect(m.classifierStrip.chips.length).toBeGreaterThanOrEqual(1);
    const chip = m.classifierStrip.chips.find((c) => c.label === 'Challenged');
    expect(chip).toBeDefined();
    // confidence 'high' → 3 pips; never a raw number in the label.
    expect(chip!.confidencePips).toBe(3);
    expect(chip!.confidenceLabel).toBe('high confidence');
    expect(chip!.label).not.toMatch(/[0-9]/);
  });

  it('carries an evidence-debt summary and the teaching empty state', () => {
    const m = buildCardDetailViewModel(baseInput({ evidenceSources: [] }));
    expect(m.evidence.hasSource).toBe(false);
    expect(m.evidence.emptyStateCopy).toBe(CARD_DETAIL_EVIDENCE_EMPTY);
    expect(m.evidence.debtSummary).toBe('Receipts owed: a source for this claim.');
  });

  it('maps attached artifacts into display-only source labels', () => {
    const m = buildCardDetailViewModel(
      baseInput({ evidenceSources: artifactsToEvidenceSources([artifact()]) }),
    );
    expect(m.evidence.hasSource).toBe(true);
    expect(m.evidence.sources[0].label).toBe('Source · nytimes.com/example');
  });

  it('surfaces the advisory standing label', () => {
    const m = buildCardDetailViewModel(baseInput());
    expect(m.standingLabel).toBe('Needs work');
  });

  it('maps the lifecycle code to plain language', () => {
    const m = buildCardDetailViewModel(baseInput({ lifecycleState: 'sourced' }));
    expect(m.lifecycleLabel).toBe('Source attached');
  });

  it('surfaces semantic-flag labels', () => {
    const m = buildCardDetailViewModel(baseInput({ flagLabels: ['Scope challenge', 'Needs source'] }));
    expect(m.flagLabels).toEqual(['Scope challenge', 'Needs source']);
  });
});

describe('CARD-VIEW-DATA-001 — root + degenerate inputs', () => {
  it('root message → "Opening claim (#1)" with no tappable token', () => {
    const m = buildCardDetailViewModel(
      baseInput({
        activeMessageId: PARENT,
        chronologicalIds: [PARENT],
        ordinalOf: () => 1,
        kindLabelOf: () => 'claim',
        parentIdOf: () => null,
      }),
    );
    expect(m.stepReference.text).toBe('Opening claim (#1)');
    expect(m.stepReference.parentMessageId).toBeNull();
  });

  it('empty inputs → safe empty zones (no throw)', () => {
    const m = buildCardDetailViewModel({
      activeMessageId: '',
      chronologicalIds: [],
      ordinalOf: () => null,
      kindLabelOf: () => 'move',
      parentIdOf: () => null,
      categoryLabel: null,
      qualifierLabels: [],
      persistedClassifierRows: [],
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      evidenceSources: [],
      evidenceDebtSummary: null,
      standingHint: null,
      lifecycleState: null,
      flagLabels: [],
    });
    expect(m.categoryLabel).toBeNull();
    expect(m.qualifierLabels).toEqual([]);
    expect(m.classifierStrip.hasSignals).toBe(false);
    expect(m.evidence.hasSource).toBe(false);
    expect(m.evidence.debtSummary).toBeNull();
    expect(m.standingLabel).toBeNull();
    expect(m.lifecycleLabel).toBeNull();
    expect(m.flagLabels).toEqual([]);
  });

  it('classifier strip with no signals shows the teaching empty state', () => {
    const m = buildCardDetailViewModel(
      baseInput({ persistedClassifierRows: [], clusterState: 'open' }),
    );
    expect(m.classifierStrip.hasSignals).toBe(false);
    expect(m.classifierStrip.emptyStateCopy).toBe('No classifier signals yet on this move.');
  });
});

describe('CARD-VIEW-DATA-001 — §10a / doctrine guards', () => {
  it('drops §10a composer_only observations from the classifier strip', () => {
    const m = buildCardDetailViewModel(
      baseInput({
        persistedClassifierRows: [
          persistedRow({ id: 'res-1', rawKey: 'has_rebuttal' }),
          // §10a-sensitive: composer_only → must NEVER reach the card.
          persistedRow({ id: 'res-2', rawKey: 'shifts_to_person_or_intent' }),
        ],
      }),
    );
    const labels = m.classifierStrip.chips.map((c) => c.longLabel.toLowerCase());
    expect(labels.join(' ')).not.toContain('person');
    expect(labels.join(' ')).not.toContain('intent');
  });

  it('suppresses an unknown lifecycle code rather than echoing it raw', () => {
    const m = buildCardDetailViewModel(
      baseInput({ lifecycleState: 'totally_unknown_internal_code' }),
    );
    expect(m.lifecycleLabel).toBeNull();
  });

  it('never includes an inactive_reason field or value', () => {
    const m = buildCardDetailViewModel(
      baseInput({ lifecycleState: 'inactive_reason' as never }),
    );
    const json = JSON.stringify(m);
    expect(json).not.toContain('inactive_reason');
    expect(json.toLowerCase()).not.toContain('admin note');
    expect(json.toLowerCase()).not.toContain('admin-only');
  });

  it('emits no verdict tokens in any output string', () => {
    const m = buildCardDetailViewModel(baseInput());
    const strings = collectStrings(m);
    for (const s of strings) {
      const lower = ` ${s.toLowerCase()} `;
      for (const banned of BANNED) {
        expect(lower).not.toContain(banned);
      }
    }
  });

  it('emits no snake_case internal code leak in labels/captions', () => {
    const m = buildCardDetailViewModel(baseInput());
    const strings = [
      m.categoryLabel ?? '',
      ...m.qualifierLabels,
      ...m.flagLabels,
      m.lifecycleLabel ?? '',
      m.standingLabel ?? '',
      ...m.classifierStrip.chips.map((c) => c.label),
      m.classifierStrip.advisoryCaption,
    ];
    for (const s of strings) {
      expect(s).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

describe('CARD-VIEW-DATA-001 — determinism + non-mutation', () => {
  it('is deterministic — identical inputs yield deep-equal output', () => {
    const a = buildCardDetailViewModel(baseInput());
    const b = buildCardDetailViewModel(baseInput());
    expect(a).toEqual(b);
  });

  it('does not mutate its input arrays', () => {
    const input = baseInput();
    const rows = input.persistedClassifierRows;
    const quals = input.qualifierLabels;
    const flags = input.flagLabels;
    buildCardDetailViewModel(input);
    expect(input.persistedClassifierRows).toBe(rows);
    expect(input.qualifierLabels).toBe(quals);
    expect(input.flagLabels).toBe(flags);
    expect(input.qualifierLabels).toEqual(['Scope challenge']);
  });
});

describe('CARD-VIEW-DATA-001 — artifactsToEvidenceSources', () => {
  it('returns [] for non-array / undefined', () => {
    expect(artifactsToEvidenceSources(undefined)).toEqual([]);
  });

  it('prefixes each source with its plain-language kind word', () => {
    const sources = artifactsToEvidenceSources([
      artifact({ id: 'a', kind: 'url', label: 'example.com' }),
      artifact({ id: 'b', kind: 'quote', label: 'a verbatim line' }),
    ]);
    expect(sources[0].label).toBe('Source · example.com');
    expect(sources[1].label).toBe('Quote · a verbatim line');
  });
});
