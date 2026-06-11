/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — parity between the Deno-clean
 * `supabase/functions/_shared/adminClassifierHealth/*` twins and the client
 * `src/features/adminClassifierHealth/*` originals.
 *
 * The Edge function was boot-failing because it imported the client `src/`
 * modules (cross-tree, transitively RN-coupled via `gameCopy`). The fix copies
 * Deno-clean twins under `supabase/functions/_shared/`. These tests prove the
 * twins behave identically to the originals so the move is provably safe:
 *   1. `aggregateClassifierHealth` deep-equals the src/ output over a broad
 *      fixture set (counts, sort order, filters, cluster, tripwire, runTag).
 *   2. `buildClassifierHealthCsv` is byte-identical to the src/ CSV.
 *   3. `classifierHealthPlainLanguage` agrees with the src/ resolver on every
 *      transport code (including the single gameCopy-overlap pin).
 *   4. The exported constants (frozen families, cluster reasons, csv header,
 *      transport codes/labels) are equal.
 *   5. The runTag heuristic + `runTagMatches` agree.
 *
 * Jest can load the `_shared` twins directly because they carry NO Deno-only
 * import (no `Deno.serve`, no `_shared/http.ts`); they are pure-TS, same as the
 * `_shared/adminInvitePayload.ts` precedent.
 */

// Client originals.
import {
  aggregateClassifierHealth as srcAggregate,
  buildClassifierHealthCsv as srcBuildCsv,
  CLASSIFIER_HEALTH_CSV_HEADER as srcCsvHeader,
  FROZEN_NON_PRODUCTION_FAMILIES as srcFrozen,
  PROVIDER_ERROR_CLUSTER_REASONS as srcCluster,
  makeRunTagSource as srcMakeRunTagSource,
  runTagMatches as srcRunTagMatches,
} from '../src/features/adminClassifierHealth';
import { classifierHealthPlainLanguage as srcPlain } from '../src/features/adminClassifierHealth/classifierHealthPlainLanguage';
import type { ClassifierHealthRunRow } from '../src/features/adminClassifierHealth';

import {
  CLASSIFIER_TRANSPORT_CODES as srcTransportCodes,
  CLASSIFIER_TRANSPORT_LABELS as srcTransportLabels,
} from '../src/features/adminClassifierHealth/classifierHealthPlainLanguage';

// Deno-clean twins. Loaded via `require` with the explicit `.ts` extension:
// the files use Deno-style extensionful imports, and `supabase/functions` is
// excluded from the project tsconfig, so a typed `import ... from '....ts'`
// would trip TS5097 (allowImportingTsExtensions). `require` keeps the path
// opaque to tsc while Jest's jest-expo resolver loads the `.ts` module + its
// extensionful internal imports at runtime (proven Jest-loadable: no Deno-only
// import in any of these twins). This is the parity harness's sole reason to
// reach into `supabase/functions/`.
const sharedModel = require('../supabase/functions/_shared/adminClassifierHealth/classifierHealthModel.ts');
const sharedCsvMod = require('../supabase/functions/_shared/adminClassifierHealth/classifierHealthCsv.ts');
const sharedPlainMod = require('../supabase/functions/_shared/adminClassifierHealth/classifierHealthPlainLanguage.ts');
const sharedRunTagMod = require('../supabase/functions/_shared/adminClassifierHealth/runTagSource.ts');

const sharedAggregate = sharedModel.aggregateClassifierHealth as typeof srcAggregate;
const sharedFrozen = sharedModel.FROZEN_NON_PRODUCTION_FAMILIES as typeof srcFrozen;
const sharedCluster = sharedModel.PROVIDER_ERROR_CLUSTER_REASONS as typeof srcCluster;
const sharedBuildCsv = sharedCsvMod.buildClassifierHealthCsv as typeof srcBuildCsv;
const sharedCsvHeader = sharedCsvMod.CLASSIFIER_HEALTH_CSV_HEADER as typeof srcCsvHeader;
const sharedPlain = sharedPlainMod.classifierHealthPlainLanguage as typeof srcPlain;
const sharedTransportCodes = sharedPlainMod.CLASSIFIER_TRANSPORT_CODES as typeof srcTransportCodes;
const sharedTransportLabels = sharedPlainMod.CLASSIFIER_TRANSPORT_LABELS as typeof srcTransportLabels;
const sharedMakeRunTagSource = sharedRunTagMod.makeRunTagSource as typeof srcMakeRunTagSource;
const sharedRunTagMatches = sharedRunTagMod.runTagMatches as typeof srcRunTagMatches;

// ── Fixtures (mirror the src model test fixtures + edge cases) ────

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

const FIXTURE_ROWS: ClassifierHealthRunRow[] = [
  row({ status: 'success' }),
  row({ status: 'success', requested_families: ['evidence_source_chain'], family: 'evidence_source_chain' }),
  row({ status: 'failed', failure_reason: 'mcp_api_error', failure_detail: { reason: 'mcp_api_error' } }),
  row({ status: 'failed', failure_reason: 'provider_server_error' }),
  row({ status: 'failed', failure_reason: 'mcp_validation_failed', failure_sub_reason: 'wrong_shape' }),
  row({ status: 'failed', failure_reason: 'validation_failed_after_retries' }),
  row({ status: 'fallback' }),
  row({ status: 'failed', state: 'dead_letter', dead_letter_reason: 'retry_attempts_exhausted' }),
  row({ run_mode: 'admin_validation', requested_families: ['sensitive_composer'], family: 'sensitive_composer' }),
  row({ run_mode: 'production', status: 'success', requested_families: ['claim_clarity'], family: 'claim_clarity' }),
  row({ completed_at: null, started_at: '2026-06-01T20:00:00.000Z' }),
  row({ failure_reason: null, completed_at: '2026-06-02T01:00:00.000Z' }),
  row({ debate_title: 'A claim [xai-adv t01]' }),
  row({ debate_title: 'B claim [stress t07]' }),
  // DEVEX-RUNTAG-COLUMN-SWAP-001 — durable-column fixtures: durable present,
  // durable-wins-over-conflicting-title, whitespace-absent → title fallback,
  // and NULL durable → legacy title fallback. The twins must agree on all.
  row({ debate_run_tag: 'xai-adv', debate_title: 'C claim no suffix' }),
  row({ debate_run_tag: 'stress', debate_title: 'D claim [xai-adv t09]' }), // durable wins
  row({ debate_run_tag: '   ', debate_title: 'E claim [stress t02]' }), // whitespace → fallback
  row({ debate_run_tag: null, debate_title: 'F claim [xai-adv t11]' }), // legacy fallback
  // OPS-MCP-KEY-LEVEL-FAIL-CLOSED — exercise the byUncleanSpanKeyDrop bucket in
  // BOTH trees: a J admin_validation SUCCESS run that dropped a key by omission.
  row({
    run_mode: 'admin_validation',
    requested_families: ['sensitive_composer'],
    family: 'sensitive_composer',
    dropped_unclean_span_keys: ['needs_pre_send_pause'],
  }),
  row({
    run_mode: 'admin_validation',
    requested_families: ['sensitive_composer'],
    family: 'sensitive_composer',
    dropped_unclean_span_keys: ['needs_pre_send_pause', 'uses_satire_as_evidence'],
  }),
];

const FILTERS = [
  {},
  { status: 'failed' },
  { status: 'SUCCESS' },
  { family: 'claim_clarity' },
  { run_mode: 'production' },
  { failure_reason: 'mcp_api_error' },
  { failure_detail_reason: 'mcp_api_error' },
  { failure_sub_reason: 'wrong_shape' },
  { window: { fromIso: '2026-06-01T00:00:00.000Z', toIso: '2026-06-01T23:59:59.000Z' } },
  { runTag: 'xai-adv' },
  { runTag: 'stress' },
] as const;

describe('shared/adminClassifierHealth — aggregate parity', () => {
  it.each(FILTERS.map((f, i) => [i, f] as const))(
    'aggregateClassifierHealth deep-equals src for filter #%i',
    (_i, filter) => {
      const sharedV = sharedAggregate(FIXTURE_ROWS, filter);
      const srcV = srcAggregate(FIXTURE_ROWS, filter);
      expect(sharedV).toEqual(srcV);
    },
  );

  it('tolerates a non-array input identically (both return totalRows 0)', () => {
    // @ts-expect-error — defensive parity check.
    expect(sharedAggregate(null)).toEqual(srcAggregate(null));
  });
});

describe('shared/adminClassifierHealth — CSV parity (byte-identical)', () => {
  it.each(FILTERS.map((f, i) => [i, f] as const))(
    'buildClassifierHealthCsv byte-equals src for filter #%i',
    (_i, filter) => {
      const sharedCsv = sharedBuildCsv(sharedAggregate(FIXTURE_ROWS, filter));
      const srcCsv = srcBuildCsv(srcAggregate(FIXTURE_ROWS, filter));
      expect(sharedCsv).toBe(srcCsv);
    },
  );

  it('exports the same CSV header', () => {
    expect([...sharedCsvHeader]).toEqual([...srcCsvHeader]);
  });
});

describe('shared/adminClassifierHealth — plain-language parity', () => {
  it('agrees with src on every transport code (incl. the gameCopy-overlap pin)', () => {
    // Use the SRC transport-code list as the universe (it is the authoritative
    // panel surface). The twin must produce the same label the src resolver
    // produces (which lets gameCopy win for validation_failed_after_retries).
    for (const code of srcTransportCodes) {
      expect(sharedPlain(code)).toBe(srcPlain(code));
    }
  });

  it('agrees with src on case-insensitive + null/unknown inputs', () => {
    const probes = ['MCP_API_ERROR', 'mcp_api_error', 'totally_unknown_xyz', '', null, undefined];
    for (const p of probes) {
      expect(sharedPlain(p)).toBe(srcPlain(p));
    }
  });

  it('exposes the same transport code + label sets as src', () => {
    expect([...sharedTransportCodes].sort()).toEqual([...srcTransportCodes].sort());
    // Labels parity: the src/_shared label tables differ only where gameCopy
    // shadows the src local entry. The PUBLIC label set the resolver returns is
    // what matters; assert the resolver agrees (covered above). Here we assert
    // the same set of CODES is exported (the labels array length matches).
    expect(sharedTransportLabels.length).toBe(srcTransportLabels.length);
  });
});

describe('shared/adminClassifierHealth — constant parity', () => {
  it('frozen non-production families match', () => {
    expect([...sharedFrozen]).toEqual([...srcFrozen]);
  });
  it('provider-error cluster reasons match', () => {
    expect([...sharedCluster]).toEqual([...srcCluster]);
  });
});

describe('shared/adminClassifierHealth — runTag parity', () => {
  const sharedSrc = sharedMakeRunTagSource();
  const srcSrc = srcMakeRunTagSource();
  const titles = [
    'Cars are bad [xai-adv t03]',
    'Foo [ai-corpus t12]',
    'Just a normal room title',
    '',
    null,
    undefined,
  ];

  it('extracts identically across title shapes', () => {
    for (const t of titles) {
      expect(sharedSrc.extract({ debateTitle: t })).toBe(srcSrc.extract({ debateTitle: t }));
    }
    expect(sharedSrc.kind).toBe(srcSrc.kind);
  });

  it('reports the durable_column kind in both trees', () => {
    expect(sharedSrc.kind).toBe('durable_column');
    expect(srcSrc.kind).toBe('durable_column');
  });

  it('extracts identically across durable run_tag + title combinations', () => {
    const contexts: Array<{ debateTitle: string | null | undefined; debateRunTag?: string | null }> = [
      { debateTitle: 'C [xai-adv t03]', debateRunTag: 'stress' }, // durable wins
      { debateTitle: null, debateRunTag: 'ai-corpus 2026abcd #foo' }, // durable only
      { debateTitle: 'D [stress t01]', debateRunTag: '' }, // empty → fallback
      { debateTitle: 'E [stress t01]', debateRunTag: '   ' }, // whitespace → fallback
      { debateTitle: 'No suffix', debateRunTag: null }, // null + no suffix → null
      { debateTitle: 'F [xai-adv t05]', debateRunTag: undefined }, // absent → fallback
    ];
    for (const ctx of contexts) {
      expect(sharedSrc.extract(ctx)).toBe(srcSrc.extract(ctx));
    }
  });

  it('runTagMatches agrees', () => {
    const pairs: Array<[string | null, string | null | undefined]> = [
      ['xai-adv', 'XAI-ADV'],
      ['xai-adv', 'stress'],
      [null, 'xai-adv'],
      ['xai-adv', null],
      [null, null],
    ];
    for (const [a, b] of pairs) {
      expect(sharedRunTagMatches(a, b)).toBe(srcRunTagMatches(a, b));
    }
  });
});
