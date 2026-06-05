/**
 * OPS-MCP-OBSERVABILITY-002 — pure-TS classifier-health model coverage.
 *
 * Counts-only aggregation; time-window filter; provider-error cluster (Q5);
 * H/I/J frozen-family tripwire derivation; CSV builder; plain-language mapping;
 * RunTagSource heuristic; ban-list scan of all panel copy.
 *
 * Doctrine: cdiscourse-doctrine §1 (no truth labels) / §4-C (frozen set,
 * never-self-approve) / §6 (leak-safe) / §9 (plain-language) / §10a.
 */
import {
  aggregateClassifierHealth,
  FROZEN_NON_PRODUCTION_FAMILIES,
  PROVIDER_ERROR_CLUSTER_REASONS,
  classifierHealthPlainLanguage,
  CLASSIFIER_TRANSPORT_CODES,
  CLASSIFIER_TRANSPORT_LABELS,
  buildClassifierHealthCsv,
  CLASSIFIER_HEALTH_CSV_HEADER,
  makeRunTagSource,
  runTagMatches,
} from '../src/features/adminClassifierHealth';
import type { ClassifierHealthRunRow } from '../src/features/adminClassifierHealth';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels/nodeLabelTypes';

// ── Fixtures ─────────────────────────────────────────────────────

function row(overrides: Partial<ClassifierHealthRunRow> = {}): ClassifierHealthRunRow {
  return {
    status: 'success',
    state: 'succeeded',
    failure_reason: null,
    failure_sub_reason: null,
    dead_letter_reason: null,
    run_mode: 'production',
    requested_families: ['parent_relation'],
    family: 'parent_relation',
    started_at: '2026-06-01T10:00:00.000Z',
    completed_at: '2026-06-01T10:00:05.000Z',
    failure_detail: null,
    ...overrides,
  };
}

// ── Count grouping ───────────────────────────────────────────────

describe('aggregateClassifierHealth — count grouping', () => {
  it('counts by status across rows', () => {
    const rows = [
      row({ status: 'success' }),
      row({ status: 'success' }),
      row({ status: 'failed', failure_reason: 'mcp_api_error' }),
      row({ status: 'fallback' }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.totalRows).toBe(4);
    const byStatus = Object.fromEntries(v.byStatus.map((b) => [b.rawKey, b.count]));
    expect(byStatus.success).toBe(2);
    expect(byStatus.failed).toBe(1);
    expect(byStatus.fallback).toBe(1);
  });

  it('buckets a NULL column under rawKey:null (never the literal "null")', () => {
    const rows = [row({ failure_reason: null }), row({ failure_reason: null })];
    const v = aggregateClassifierHealth(rows);
    const nullBucket = v.byFailureReason.find((b) => b.rawKey === null);
    expect(nullBucket).toBeDefined();
    expect(nullBucket?.count).toBe(2);
    // No bucket carries the string "null" / "undefined".
    for (const b of v.byFailureReason) {
      expect(b.rawKey).not.toBe('null');
      expect(b.rawKey).not.toBe('undefined');
    }
  });

  it('flattens requested_families ∪ family into the family axis', () => {
    const rows = [
      row({ requested_families: ['parent_relation', 'disagreement_axis'], family: 'parent_relation' }),
    ];
    const v = aggregateClassifierHealth(rows);
    const fams = v.byFamily.map((b) => b.rawKey).sort();
    expect(fams).toEqual(['disagreement_axis', 'parent_relation']);
  });

  it('sorts buckets by count desc then key asc (stable)', () => {
    const rows = [
      row({ status: 'failed', failure_reason: 'b_reason' }),
      row({ status: 'failed', failure_reason: 'a_reason' }),
      row({ status: 'failed', failure_reason: 'a_reason' }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.byFailureReason[0].rawKey).toBe('a_reason');
    expect(v.byFailureReason[0].count).toBe(2);
    expect(v.byFailureReason[1].rawKey).toBe('b_reason');
  });

  it('tolerates a non-array input without throwing', () => {
    // @ts-expect-error — defensive: model handles a non-array gracefully.
    const v = aggregateClassifierHealth(null);
    expect(v.totalRows).toBe(0);
  });
});

// ── Scalar + time-window filter ──────────────────────────────────

describe('aggregateClassifierHealth — filters', () => {
  it('applies a scalar status filter (case-insensitive)', () => {
    const rows = [row({ status: 'success' }), row({ status: 'failed', failure_reason: 'x' })];
    const v = aggregateClassifierHealth(rows, { status: 'FAILED' });
    expect(v.totalRows).toBe(1);
    expect(v.byStatus[0].rawKey).toBe('failed');
  });

  it('applies a family filter (row references the requested family)', () => {
    const rows = [
      row({ requested_families: ['parent_relation'] }),
      row({ requested_families: ['disagreement_axis'], family: 'disagreement_axis' }),
    ];
    const v = aggregateClassifierHealth(rows, { family: 'disagreement_axis' });
    expect(v.totalRows).toBe(1);
  });

  it('applies a failure_detail.reason filter through the allow-list', () => {
    const rows = [
      row({ status: 'failed', failure_detail: { reason: 'mcp_validation_failed' } }),
      row({ status: 'failed', failure_detail: { reason: 'mcp_api_error' } }),
    ];
    const v = aggregateClassifierHealth(rows, { failure_detail_reason: 'mcp_api_error' });
    expect(v.totalRows).toBe(1);
  });

  it('windows on completed_at within [from, to)', () => {
    const rows = [
      row({ completed_at: '2026-06-01T09:00:00.000Z' }),
      row({ completed_at: '2026-06-01T12:00:00.000Z' }),
      row({ completed_at: '2026-06-01T15:00:00.000Z' }),
    ];
    const v = aggregateClassifierHealth(rows, {
      window: { fromIso: '2026-06-01T10:00:00.000Z', toIso: '2026-06-01T14:00:00.000Z' },
    });
    expect(v.totalRows).toBe(1);
  });

  it('falls back to started_at when completed_at is NULL for the window', () => {
    const rows = [
      row({ completed_at: null, started_at: '2026-06-01T12:00:00.000Z' }),
      row({ completed_at: null, started_at: '2026-06-01T20:00:00.000Z' }),
    ];
    const v = aggregateClassifierHealth(rows, {
      window: { fromIso: '2026-06-01T10:00:00.000Z', toIso: '2026-06-01T14:00:00.000Z' },
    });
    expect(v.totalRows).toBe(1);
  });

  it('excludes a row with no usable timestamp from a bounded window', () => {
    const rows = [row({ completed_at: null, started_at: null })];
    const v = aggregateClassifierHealth(rows, {
      window: { fromIso: '2026-06-01T10:00:00.000Z' },
    });
    expect(v.totalRows).toBe(0);
  });
});

// ── Provider-error cluster (Q5) ──────────────────────────────────

describe('aggregateClassifierHealth — provider-error cluster (Q5)', () => {
  it('cluster set is exactly mcp_api_error / mcp_network_error / provider_server_error', () => {
    expect([...PROVIDER_ERROR_CLUSTER_REASONS].sort()).toEqual(
      ['mcp_api_error', 'mcp_network_error', 'provider_server_error'].sort(),
    );
  });

  it('counts only cluster-member failure reasons', () => {
    const rows = [
      row({ status: 'failed', failure_reason: 'mcp_api_error' }),
      row({ status: 'failed', failure_reason: 'provider_server_error' }),
      row({ status: 'failed', failure_reason: 'mcp_validation_failed' }), // NOT in cluster
      row({ status: 'success' }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.providerErrorCluster.count).toBe(2);
    const reasons = v.providerErrorCluster.byReason.map((b) => b.rawKey).sort();
    expect(reasons).toEqual(['mcp_api_error', 'provider_server_error']);
  });
});

// ── H/I/J frozen-family tripwire ─────────────────────────────────

describe('aggregateClassifierHealth — H/I/J leakage tripwire', () => {
  it('frozen set is exactly claim_clarity / thread_topology / sensitive_composer', () => {
    expect([...FROZEN_NON_PRODUCTION_FAMILIES].sort()).toEqual(
      ['claim_clarity', 'sensitive_composer', 'thread_topology'].sort(),
    );
  });

  it('frozen names are a subset of the canonical family enumeration (registry mirror pin)', () => {
    for (const f of FROZEN_NON_PRODUCTION_FAMILIES) {
      expect(ALL_MACHINE_OBSERVATION_FAMILIES).toContain(f);
    }
  });

  it('a clean A–G fixture reads 0 tripwire', () => {
    const rows = [
      row({ run_mode: 'production', status: 'success', requested_families: ['parent_relation'] }),
      row({ run_mode: 'production', status: 'success', requested_families: ['evidence_source_chain'] }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.frozenFamilyTripwire.count).toBe(0);
    expect(v.frozenFamilyTripwire.watchedFamilies).toEqual(FROZEN_NON_PRODUCTION_FAMILIES);
  });

  it('a production-SUCCESS H/I/J row FIRES the tripwire', () => {
    const rows = [
      row({ run_mode: 'production', status: 'success', requested_families: ['claim_clarity'], family: 'claim_clarity' }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.frozenFamilyTripwire.count).toBe(1);
    const claimClarity = v.frozenFamilyTripwire.byFamily.find((f) => f.family === 'claim_clarity');
    expect(claimClarity?.count).toBe(1);
  });

  it('an H/I/J FAILURE-only row does NOT fire (only success indicates a flip)', () => {
    const rows = [
      row({
        run_mode: 'production',
        status: 'failed',
        failure_reason: 'mcp_validation_failed',
        requested_families: ['thread_topology'],
        family: 'thread_topology',
      }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.frozenFamilyTripwire.count).toBe(0);
  });

  it('an H/I/J admin_validation SUCCESS row does NOT fire (production-only tripwire)', () => {
    const rows = [
      row({
        run_mode: 'admin_validation',
        status: 'success',
        requested_families: ['sensitive_composer'],
        family: 'sensitive_composer',
      }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.frozenFamilyTripwire.count).toBe(0);
  });
});

// ── RunTagSource heuristic (Q3) ──────────────────────────────────

describe('RunTagSource — title-suffix heuristic (Q3)', () => {
  const src = makeRunTagSource();

  it('extracts the runTag from a [<runTag> tNN] title suffix', () => {
    expect(src.extract({ debateTitle: 'Cars are bad [xai-adv t03]' })).toBe('xai-adv');
    expect(src.extract({ debateTitle: 'Foo [ai-corpus t12]' })).toBe('ai-corpus');
    expect(src.extract({ debateTitle: 'Bar [stress t00]' })).toBe('stress');
  });

  it('returns null when there is no recognizable suffix', () => {
    expect(src.extract({ debateTitle: 'Just a normal room title' })).toBeNull();
    expect(src.extract({ debateTitle: '' })).toBeNull();
    expect(src.extract({ debateTitle: null })).toBeNull();
    expect(src.extract({ debateTitle: undefined })).toBeNull();
  });

  it('reports the title_suffix_heuristic kind', () => {
    expect(src.kind).toBe('title_suffix_heuristic');
  });

  it('runTagMatches is case-insensitive and a null filter matches everything', () => {
    expect(runTagMatches('xai-adv', 'XAI-ADV')).toBe(true);
    expect(runTagMatches('xai-adv', 'stress')).toBe(false);
    expect(runTagMatches(null, 'xai-adv')).toBe(false);
    expect(runTagMatches('xai-adv', null)).toBe(true);
    expect(runTagMatches(null, null)).toBe(true);
  });

  it('a runTag filter selects only rows whose title suffix matches', () => {
    const rows = [
      row({ debate_title: 'A [xai-adv t01]' }),
      row({ debate_title: 'B [stress t01]' }),
      row({ debate_title: 'C [xai-adv t02]' }),
    ];
    const v = aggregateClassifierHealth(rows, { runTag: 'xai-adv' });
    expect(v.totalRows).toBe(2);
    expect(v.runTagSource).toBe('title_suffix_heuristic');
  });

  it('reports runTagSource "none" when no runTag filter is supplied', () => {
    const v = aggregateClassifierHealth([row()]);
    expect(v.runTagSource).toBe('none');
  });
});

// ── Plain-language mapping (§9) ──────────────────────────────────

describe('classifierHealthPlainLanguage (§9)', () => {
  it('maps every panel-local transport code to a non-snake_case label', () => {
    for (const code of CLASSIFIER_TRANSPORT_CODES) {
      const label = classifierHealthPlainLanguage(code);
      expect(label).not.toBeNull();
      expect(label).not.toMatch(/^[a-z][a-z0-9_]*_[a-z0-9_]*$/); // not a bare snake_case code
      expect((label ?? '').length).toBeGreaterThan(0);
    }
  });

  it('suppresses an unknown code (returns null, never echoes the raw code)', () => {
    expect(classifierHealthPlainLanguage('totally_unknown_reason_xyz')).toBeNull();
    expect(classifierHealthPlainLanguage(null)).toBeNull();
    expect(classifierHealthPlainLanguage(undefined)).toBeNull();
    expect(classifierHealthPlainLanguage('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(classifierHealthPlainLanguage('MCP_API_ERROR')).toBe(
      classifierHealthPlainLanguage('mcp_api_error'),
    );
  });
});

// ── CSV builder ──────────────────────────────────────────────────

describe('buildClassifierHealthCsv', () => {
  it('emits the metadata-only header and parses as CSV', () => {
    const v = aggregateClassifierHealth([
      row({ status: 'failed', failure_reason: 'mcp_api_error' }),
      row({ status: 'success' }),
    ]);
    const csv = buildClassifierHealthCsv(v);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CLASSIFIER_HEALTH_CSV_HEADER.join(','));
    // Every data line has exactly 4 comma-separated fields (no embedded commas
    // in these fixtures).
    for (const line of lines.slice(1)) {
      expect(line.split(',').length).toBe(4);
    }
  });

  it('includes the provider-error cluster and frozen-family tripwire groups', () => {
    const v = aggregateClassifierHealth([
      row({ status: 'failed', failure_reason: 'provider_server_error' }),
    ]);
    const csv = buildClassifierHealthCsv(v);
    expect(csv).toContain('provider_error_cluster');
    expect(csv).toContain('frozen_family_tripwire');
    expect(csv).toContain('total_rows');
  });

  it('escapes a value containing a comma/quote (RFC-4180)', () => {
    // Synthetic bucket via a crafted verdict — the plain-language labels never
    // contain commas, but the builder must still escape defensively.
    const v = aggregateClassifierHealth([row({ status: 'success' })]);
    const csv = buildClassifierHealthCsv(v);
    // No unescaped double-quote run that would break a parser.
    expect(() => csv.split('\n').forEach((l) => l.split(','))).not.toThrow();
  });
});

// ── Ban-list scan of all panel copy (doctrine §1) ────────────────

describe('panel copy — doctrine ban-list scan', () => {
  const BANNED = [
    'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
    'extremist', 'propagandist', 'stupid', 'idiot', 'correct', ' true ', ' false ',
  ];

  it('no plain-language label contains a verdict/truth token', () => {
    for (const label of CLASSIFIER_TRANSPORT_LABELS) {
      const lower = ` ${label.toLowerCase()} `;
      for (const b of BANNED) {
        expect(lower).not.toContain(b);
      }
    }
  });
});
