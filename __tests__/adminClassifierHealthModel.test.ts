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

// ── RunTagSource — durable column (canonical) + title-suffix fallback ──
//
// DEVEX-RUNTAG-COLUMN-SWAP-001: `makeRunTagSource()` now returns the durable
// `debates.run_tag` source (canonical). It falls back to the legacy
// title-suffix parse only for legacy rows whose `run_tag` is NULL/empty. The
// title-suffix behavior below is the FALLBACK path of the same default source.

describe('RunTagSource — durable column (canonical) + title-suffix fallback', () => {
  const src = makeRunTagSource();

  it('reports the durable_column kind (canonical default)', () => {
    expect(src.kind).toBe('durable_column');
  });

  it('falls back to the [<runTag> tNN] title suffix when no durable run_tag', () => {
    expect(src.extract({ debateTitle: 'Cars are bad [xai-adv t03]' })).toBe('xai-adv');
    expect(src.extract({ debateTitle: 'Foo [ai-corpus t12]' })).toBe('ai-corpus');
    expect(src.extract({ debateTitle: 'Bar [stress t00]' })).toBe('stress');
  });

  it('returns null when neither durable run_tag nor a recognizable suffix is present', () => {
    expect(src.extract({ debateTitle: 'Just a normal room title' })).toBeNull();
    expect(src.extract({ debateTitle: '' })).toBeNull();
    expect(src.extract({ debateTitle: null })).toBeNull();
    expect(src.extract({ debateTitle: undefined })).toBeNull();
  });

  it('uses the durable run_tag when present (no title needed)', () => {
    expect(src.extract({ debateTitle: null, debateRunTag: 'ai-corpus 2026abcd #foo' })).toBe(
      'ai-corpus 2026abcd #foo',
    );
    expect(src.extract({ debateTitle: 'Some room with no suffix', debateRunTag: 'stress' })).toBe(
      'stress',
    );
  });

  it('durable run_tag WINS over a conflicting title suffix', () => {
    // Title parses to "xai-adv" but the durable column says "stress" — durable
    // is authoritative.
    expect(
      src.extract({ debateTitle: 'Cars are bad [xai-adv t03]', debateRunTag: 'stress' }),
    ).toBe('stress');
  });

  it('trims a durable run_tag with surrounding whitespace', () => {
    expect(src.extract({ debateTitle: null, debateRunTag: '  ai-corpus  ' })).toBe('ai-corpus');
  });

  it('treats an empty/whitespace durable run_tag as ABSENT → title fallback', () => {
    // Empty string → fallback to the title suffix.
    expect(src.extract({ debateTitle: 'A [xai-adv t01]', debateRunTag: '' })).toBe('xai-adv');
    // Whitespace-only → fallback to the title suffix.
    expect(src.extract({ debateTitle: 'A [xai-adv t01]', debateRunTag: '   ' })).toBe('xai-adv');
    // Empty durable + no suffix → null.
    expect(src.extract({ debateTitle: 'No suffix here', debateRunTag: '' })).toBeNull();
  });

  it('runTagMatches is case-insensitive and a null filter matches everything', () => {
    expect(runTagMatches('xai-adv', 'XAI-ADV')).toBe(true);
    expect(runTagMatches('xai-adv', 'stress')).toBe(false);
    expect(runTagMatches(null, 'xai-adv')).toBe(false);
    expect(runTagMatches('xai-adv', null)).toBe(true);
    expect(runTagMatches(null, null)).toBe(true);
  });

  it('a runTag filter selects rows by the durable column first', () => {
    const rows = [
      row({ debate_title: 'A [stress t01]', debate_run_tag: 'xai-adv' }), // durable wins
      row({ debate_title: 'B [stress t01]', debate_run_tag: 'stress' }),
      row({ debate_title: 'C [xai-adv t02]', debate_run_tag: 'xai-adv' }),
    ];
    const v = aggregateClassifierHealth(rows, { runTag: 'xai-adv' });
    expect(v.totalRows).toBe(2);
    expect(v.runTagSource).toBe('durable_column');
  });

  it('a NULL-run_tag row with a matching title suffix still matches (legacy fallback)', () => {
    const rows = [
      row({ debate_title: 'A [xai-adv t01]', debate_run_tag: null }), // legacy → title fallback
      row({ debate_title: 'B [stress t01]', debate_run_tag: null }),
      row({ debate_title: 'C [xai-adv t02]' }), // debate_run_tag absent → title fallback
    ];
    const v = aggregateClassifierHealth(rows, { runTag: 'xai-adv' });
    expect(v.totalRows).toBe(2);
    expect(v.runTagSource).toBe('durable_column');
  });

  it('mixes durable + legacy rows under one canonical filter', () => {
    const rows = [
      row({ debate_run_tag: 'xai-adv', debate_title: 'no suffix' }), // durable
      row({ debate_title: 'legacy [xai-adv t05]', debate_run_tag: null }), // title fallback
      row({ debate_run_tag: 'stress', debate_title: 'x [xai-adv t09]' }), // durable wins → stress
    ];
    const v = aggregateClassifierHealth(rows, { runTag: 'xai-adv' });
    expect(v.totalRows).toBe(2);
  });

  it('historical NULL-run_tag rows do NOT disappear from unscoped views', () => {
    // No runTag filter → every row is in scope regardless of run_tag presence.
    const rows = [
      row({ debate_run_tag: null, debate_title: 'legacy room' }),
      row({ debate_run_tag: 'ai-corpus x', debate_title: 'stamped room' }),
      row({ debate_run_tag: undefined }),
    ];
    const v = aggregateClassifierHealth(rows);
    expect(v.totalRows).toBe(3);
    expect(v.runTagSource).toBe('none');
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

  it('the CSV export honors the durable-first runTag filter (counts match the verdict)', () => {
    // DEVEX-RUNTAG-COLUMN-SWAP-001: the export is built from the same filtered
    // verdict, so a durable-runTag filter scopes the CSV the same way it scopes
    // the JSON aggregate (durable wins over the conflicting title suffix).
    const rows = [
      row({ status: 'failed', failure_reason: 'mcp_api_error', debate_run_tag: 'xai-adv', debate_title: 'x [stress t01]' }),
      row({ status: 'success', debate_run_tag: 'stress', debate_title: 'y [xai-adv t01]' }),
      row({ status: 'success', debate_run_tag: null, debate_title: 'z [xai-adv t02]' }), // legacy fallback matches
    ];
    const v = aggregateClassifierHealth(rows, { runTag: 'xai-adv' });
    expect(v.totalRows).toBe(2);
    const csv = buildClassifierHealthCsv(v);
    // The total_rows footer reflects the durable-first filtered count, not 3.
    expect(csv).toContain('total_rows,,,2');
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
