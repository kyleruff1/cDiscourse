/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Deno-clean twin of
 * `src/features/adminClassifierHealth/classifierHealthModel.ts`. Behavior-parity
 * copy; the ONLY difference from the client original is extensionful
 * (`./x.ts`) intra-`_shared` imports + the Deno-clean plain-language twin (no
 * `gameCopy`). Server (Deno / Edge) side.
 *
 * Counts-only aggregation over an in-memory `ClassifierHealthRunRow[]`. The
 * Edge function reads the column-explicit allow-list, maps rows to this shape,
 * and calls `aggregateClassifierHealth`. NO raw row ever leaves the function.
 *
 * Frozen-set tripwire (cdiscourse-doctrine §4-C never-self-approve): the frozen
 * family name (`sensitive_composer`, Family J) is a FROZEN constant in code,
 * NOT user input. It mirrors the lone `productionEnabled: false` entry in the
 * Deno `familyRegistry.ts` (Family H / `claim_clarity` was production-enabled
 * via PR #559, Family I / `thread_topology` via PR #562; both Edge windows
 * closed PASS). The panel OBSERVES the tripwire; it never flips a production
 * flag.
 *
 * Pure TS — no React, no Supabase, no fetch. Deno-loadable + Jest-loadable.
 */
import type {
  ClassifierHealthRunRow,
  ClassifierHealthFilter,
  ClassifierHealthCountBucket,
  ClassifierHealthGroupKey,
  ClassifierHealthVerdict,
  ProviderErrorClusterVerdict,
  FrozenFamilyTripwireVerdict,
} from './types.ts';
import { classifierHealthPlainLanguage } from './classifierHealthPlainLanguage.ts';
import { makeRunTagSource, runTagMatches, type RunTagSource } from './runTagSource.ts';

/**
 * The FROZEN non-production family set the leakage tripwire watches. After
 * Family H (`claim_clarity`) was production-enabled via PR #559 and Family I
 * (`thread_topology`) via PR #562 — both Edge production-enable windows closed
 * PASS — only Family J (`sensitive_composer`) remains frozen by ratified
 * disposition. This set mirrors the lone `productionEnabled: false` entry in
 * the Deno `familyRegistry.ts`, frozen in code, never derived from user input.
 * A production-mode SUCCESS row that references J is the tripwire firing.
 *
 * Re-scoping {H,I,J} → {J} restores the tripwire as a TRUE producer-bug
 * detector: it no longer counts the now-legitimate H/I production-success rows
 * (which had been firing as false positives), so a non-zero count is once again
 * a real leak of the still-frozen J family.
 *
 * Byte-parity twin of `src/features/adminClassifierHealth/classifierHealthModel.ts`
 * (`adminClassifierHealthSharedParity.test.ts` enforces value parity).
 */
export const FROZEN_NON_PRODUCTION_FAMILIES: ReadonlyArray<string> = Object.freeze([
  'sensitive_composer', // Family J — frozen by ratified disposition
]);

/**
 * The provider-error cluster (Q5). The ambiguous provider buckets an operator
 * watches as a single dominant-failure-shape signal.
 */
export const PROVIDER_ERROR_CLUSTER_REASONS: ReadonlyArray<string> = Object.freeze([
  'mcp_api_error',
  'mcp_network_error',
  'provider_server_error',
]);

/** Normalize a code for comparison (lowercase, snake_case). */
function normalize(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * The timestamp a row is windowed on: `completed_at` if present, else
 * `started_at` (Q6). Returns `null` when neither parses to a finite time.
 */
function rowWindowTimeMs(row: ClassifierHealthRunRow): number | null {
  const raw = row.completed_at ?? row.started_at;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** True when the row falls inside the (optional) time window. */
function rowInWindow(row: ClassifierHealthRunRow, filter: ClassifierHealthFilter): boolean {
  const w = filter.window;
  if (!w || (w.fromIso == null && w.toIso == null)) return true;
  const t = rowWindowTimeMs(row);
  if (t === null) {
    // A row with no usable timestamp cannot be placed in a bounded window.
    return false;
  }
  if (w.fromIso != null) {
    const from = Date.parse(w.fromIso);
    if (Number.isFinite(from) && t < from) return false;
  }
  if (w.toIso != null) {
    const to = Date.parse(w.toIso);
    if (Number.isFinite(to) && t >= to) return false;
  }
  return true;
}

/** The set of families a row references (requested_families ∪ family column). */
function rowFamilies(row: ClassifierHealthRunRow): string[] {
  const out = new Set<string>();
  if (Array.isArray(row.requested_families)) {
    for (const f of row.requested_families) {
      if (typeof f === 'string' && f.length > 0) out.add(normalize(f));
    }
  }
  if (typeof row.family === 'string' && row.family.length > 0) {
    out.add(normalize(row.family));
  }
  return Array.from(out);
}

/** True when a string equality filter (case-insensitive) passes for a value. */
function eqFilter(value: string | null | undefined, filter: string | undefined): boolean {
  if (filter == null || filter.length === 0) return true;
  if (value == null) return false;
  return normalize(value) === normalize(filter);
}

/**
 * True when the row passes every supplied scalar filter (status / state /
 * run_mode / failure_reason / failure_sub_reason / failure_detail.reason /
 * family / time window / runTag). Family filter matches when the row
 * references the requested family.
 */
function rowPassesFilter(
  row: ClassifierHealthRunRow,
  filter: ClassifierHealthFilter,
  runTagSource: RunTagSource,
): boolean {
  if (!eqFilter(row.status, filter.status)) return false;
  if (!eqFilter(row.state, filter.state)) return false;
  if (!eqFilter(row.run_mode, filter.run_mode)) return false;
  if (!eqFilter(row.failure_reason, filter.failure_reason)) return false;
  if (!eqFilter(row.failure_sub_reason, filter.failure_sub_reason)) return false;
  if (!eqFilter(row.failure_detail?.reason ?? null, filter.failure_detail_reason)) return false;
  if (filter.family != null && filter.family.length > 0) {
    if (!rowFamilies(row).includes(normalize(filter.family))) return false;
  }
  if (!rowInWindow(row, filter)) return false;
  if (filter.runTag != null && filter.runTag.length > 0) {
    // Canonical runTag derivation: durable `debates.run_tag` first, with the
    // title-suffix as the legacy fallback (DEVEX-RUNTAG-COLUMN-SWAP-001). This
    // is the ONE derivation that grouping / filtering / export all share.
    const extracted = runTagSource.extract({
      debateTitle: row.debate_title,
      debateRunTag: row.debate_run_tag,
    });
    if (!runTagMatches(extracted, filter.runTag)) return false;
  }
  return true;
}

/**
 * Build count buckets for one grouping axis over the filtered rows. A NULL
 * column value is bucketed under `rawKey: null` (rendered as a placeholder in
 * the UI, never as the literal "null"). Buckets are sorted by count desc, then
 * rawKey asc for stable output.
 */
function countBy(
  rows: ClassifierHealthRunRow[],
  groupKey: ClassifierHealthGroupKey,
  valueOf: (row: ClassifierHealthRunRow) => Array<string | null>,
): ClassifierHealthCountBucket[] {
  const counts = new Map<string, { rawKey: string | null; count: number }>();
  for (const row of rows) {
    const values = valueOf(row);
    for (const v of values) {
      const mapKey = v == null ? 'NULL' : normalize(v);
      const existing = counts.get(mapKey);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(mapKey, { rawKey: v == null ? null : v, count: 1 });
      }
    }
  }
  const buckets: ClassifierHealthCountBucket[] = [];
  for (const { rawKey, count } of counts.values()) {
    buckets.push({
      groupKey,
      rawKey,
      plainLanguage: isReasonAxis(groupKey) ? classifierHealthPlainLanguage(rawKey) : null,
      count,
    });
  }
  buckets.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const ak = a.rawKey ?? '';
    const bk = b.rawKey ?? '';
    return ak.localeCompare(bk);
  });
  return buckets;
}

/** Axes whose key is a reason code that should carry a plain-language label. */
function isReasonAxis(groupKey: ClassifierHealthGroupKey): boolean {
  return (
    groupKey === 'failure_reason' ||
    groupKey === 'failure_sub_reason' ||
    groupKey === 'dead_letter_reason' ||
    groupKey === 'failure_detail_reason'
  );
}

/** Provider-error cluster verdict over the filtered rows (Q5). */
function deriveProviderErrorCluster(rows: ClassifierHealthRunRow[]): ProviderErrorClusterVerdict {
  const clusterSet = new Set(PROVIDER_ERROR_CLUSTER_REASONS.map(normalize));
  const inCluster = rows.filter(
    (r) => r.failure_reason != null && clusterSet.has(normalize(r.failure_reason)),
  );
  const byReason = countBy(inCluster, 'failure_reason', (r) => [r.failure_reason]);
  return { count: inCluster.length, byReason };
}

/**
 * H/I/J leakage tripwire (frozen-set). Counts rows that:
 *   - are in `run_mode = 'production'`, AND
 *   - have `status = 'success'` (only a SUCCESS indicates a flip — a FAILURE
 *     on a frozen family is the family being correctly held out), AND
 *   - reference a frozen family (claim_clarity / thread_topology /
 *     sensitive_composer).
 * SHOULD always be 0.
 */
function deriveFrozenFamilyTripwire(
  rows: ClassifierHealthRunRow[],
): FrozenFamilyTripwireVerdict {
  const frozen = new Set(FROZEN_NON_PRODUCTION_FAMILIES.map(normalize));
  const byFamilyCounts = new Map<string, number>();
  for (const f of FROZEN_NON_PRODUCTION_FAMILIES) byFamilyCounts.set(normalize(f), 0);

  let total = 0;
  for (const row of rows) {
    if (normalize(row.run_mode ?? '') !== 'production') continue;
    if (normalize(row.status ?? '') !== 'success') continue;
    const fams = rowFamilies(row);
    const hits = fams.filter((f) => frozen.has(f));
    if (hits.length === 0) continue;
    total += 1;
    for (const f of hits) {
      byFamilyCounts.set(f, (byFamilyCounts.get(f) ?? 0) + 1);
    }
  }

  return {
    count: total,
    byFamily: FROZEN_NON_PRODUCTION_FAMILIES.map((f) => ({
      family: f,
      count: byFamilyCounts.get(normalize(f)) ?? 0,
    })),
    watchedFamilies: FROZEN_NON_PRODUCTION_FAMILIES,
  };
}

/**
 * Aggregate the run rows into a counts-only verdict object after applying the
 * filter. The result carries NO raw row, NO body, NO evidence_span, NO
 * payload — only counts + grouping keys + plain-language labels.
 */
export function aggregateClassifierHealth(
  rows: ClassifierHealthRunRow[],
  filter: ClassifierHealthFilter = {},
  runTagSource: RunTagSource = makeRunTagSource(),
): ClassifierHealthVerdict {
  const safeRows = Array.isArray(rows) ? rows : [];
  const filtered = safeRows.filter((r) => rowPassesFilter(r, filter, runTagSource));

  return {
    totalRows: filtered.length,
    byStatus: countBy(filtered, 'status', (r) => [r.status]),
    byState: countBy(filtered, 'state', (r) => [r.state]),
    byFailureReason: countBy(filtered, 'failure_reason', (r) => [r.failure_reason]),
    byFailureSubReason: countBy(filtered, 'failure_sub_reason', (r) => [r.failure_sub_reason]),
    byDeadLetterReason: countBy(filtered, 'dead_letter_reason', (r) => [r.dead_letter_reason]),
    byRunMode: countBy(filtered, 'run_mode', (r) => [r.run_mode]),
    byFamily: countBy(filtered, 'family', (r) => {
      const fams = rowFamilies(r);
      return fams.length > 0 ? fams : [null];
    }),
    byFailureDetailReason: countBy(filtered, 'failure_detail_reason', (r) => [
      r.failure_detail?.reason ?? null,
    ]),
    providerErrorCluster: deriveProviderErrorCluster(filtered),
    frozenFamilyTripwire: deriveFrozenFamilyTripwire(filtered),
    runTagSource:
      filter.runTag != null && filter.runTag.length > 0 ? runTagSource.kind : 'none',
  };
}
