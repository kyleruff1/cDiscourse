/**
 * OPS-MCP-OBSERVABILITY-002 — admin classifier-health panel: pure-TS types.
 *
 * The panel is an OPERATIONAL DIAGNOSTIC READ surface over
 * `public.argument_machine_observation_runs`. It renders COUNTS ONLY — never
 * a raw row, never a body, never an `evidence_span`, never a raw MCP payload.
 *
 * Acceptance-gate invariant (binding on this whole feature):
 *   "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The
 *    deterministic rules engine, src/lib/constitution/engine.ts, is the sole
 *    gate. Classifiers run after an argument is stored. No path may block,
 *    reject, route, or delay an ordinary user post."
 * This panel has no write path, no re-trigger, no routing control, no
 * productionEnabled flip — it cannot block/route/delay any user post.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1/§10a — counts are structural transport/health
 *     facts; never a verdict on a person or a claim.
 *   - §6 — the row shape consumed here is the LEAK-SAFE allow-list only; the
 *     `failure_detail` jsonb is read strictly as the `RunRowFailureDetail`
 *     keys (validator_path / reason / family / correlation_id / attempt_count
 *     / run_mode / schema_version). There is NO entry point for a body / span
 *     / prompt / provider payload.
 *
 * Pure TS — no React, no Supabase, no fetch, no Deno. Jest-loadable.
 */

/**
 * The leak-safe `failure_detail` shape the panel consumes. MIRRORS
 * `RunRowFailureDetail` in
 * `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts`.
 * The panel NEVER reads a richer shape than this — an unexpected key is
 * ignored, never echoed (§6).
 */
export interface ClassifierHealthFailureDetail {
  validator_path?: string;
  reason?: string;
  family?: string;
  correlation_id?: string;
  attempt_count?: number;
  run_mode?: string;
  schema_version?: string;
}

/**
 * One in-memory run row as the panel reads it. This is the EXACT column
 * allow-list the Edge function selects (column-explicit, never `SELECT *`):
 * status / state / failure_reason / failure_sub_reason / dead_letter_reason /
 * run_mode / requested_families / family / started_at / completed_at /
 * failure_detail.
 *
 * There is deliberately NO `body`, NO `evidence_span`, NO content field on
 * this shape — those have no entry point into the aggregate.
 */
export interface ClassifierHealthRunRow {
  status: string | null;
  state: string | null;
  failure_reason: string | null;
  failure_sub_reason: string | null;
  dead_letter_reason: string | null;
  run_mode: string | null;
  requested_families: string[] | null;
  /** The per-result family column (queue-substrate). Single value, may be null. */
  family: string | null;
  started_at: string | null;
  completed_at: string | null;
  failure_detail: ClassifierHealthFailureDetail | null;
  /**
   * OPTIONAL title context for the runTag title-suffix FALLBACK (Q3). The Edge
   * function joins `debates.title` ONLY when a runTag filter is supplied. This
   * is the room TITLE — never a body, never an `evidence_span`. The heuristic
   * reads only the trailing `[<runTag> tNN]` suffix; the rest of the title is
   * not surfaced in any count. Used only when `debate_run_tag` is absent.
   */
  debate_title?: string | null;
  /**
   * OPTIONAL durable runTag — the `public.debates.run_tag` column value joined
   * in ONLY when a runTag filter is supplied (DEVEX-RUNTAG-COLUMN-SWAP-001).
   * This is the CANONICAL runTag: authoritative when present (non-null,
   * non-empty, non-whitespace). `null`/absent → the title-suffix fallback runs.
   * It carries no new sensitivity beyond the title (per the #476 migration
   * comment) and is never surfaced raw in any count — only used to bucket.
   */
  debate_run_tag?: string | null;
  /**
   * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — OPTIONAL text[] of the rawKey NAMES the MCP
   * server dropped by OMISSION (key-level fail-closed) on this SUCCESS run. NULL
   * / absent on runs with zero drops + on historical rows. NAMES ONLY — never a
   * span, never a body. The panel reads it as a counts-only bucket
   * (`byUncleanSpanKeyDrop`), never echoing span content.
   */
  dropped_unclean_span_keys?: string[] | null;
}

/** The grouping axes the panel can count over. */
export type ClassifierHealthGroupKey =
  | 'status'
  | 'state'
  | 'failure_reason'
  | 'failure_sub_reason'
  | 'dead_letter_reason'
  | 'run_mode'
  | 'family'
  | 'failure_detail_reason'
  | 'unclean_span_key_drop';

/**
 * One aggregate bucket: a grouping axis + the key value + the count + the
 * plain-language label for that key. `rawKey` is the internal code (admin-only
 * surface; never shown on a normal-user surface). `plainLanguage` is the
 * operator-facing string; `null` means the code is unknown and SUPPRESSED.
 */
export interface ClassifierHealthCountBucket {
  groupKey: ClassifierHealthGroupKey;
  /** The internal key value, or `null` when the column was NULL on the row. */
  rawKey: string | null;
  /** Plain-language label (§9). `null` = unknown code, suppressed. */
  plainLanguage: string | null;
  count: number;
}

/**
 * The time-window filter. Both bounds optional. Applied to `completed_at`
 * (fallback `started_at` when `completed_at` is NULL), UTC (Q6).
 */
export interface ClassifierHealthTimeWindow {
  /** Inclusive lower bound, ISO-8601 UTC. */
  fromIso?: string;
  /** Exclusive upper bound, ISO-8601 UTC. */
  toIso?: string;
}

/**
 * The filter input the panel applies before aggregating. All optional.
 * Unknown keys are rejected at the Edge zod layer; this in-memory shape is
 * the post-validation filter.
 */
export interface ClassifierHealthFilter {
  status?: string;
  state?: string;
  family?: string;
  run_mode?: string;
  failure_reason?: string;
  failure_sub_reason?: string;
  failure_detail_reason?: string;
  window?: ClassifierHealthTimeWindow;
  /** runTag — derived from the debate-title suffix heuristic (Q3). */
  runTag?: string;
}

/**
 * The provider-error cluster verdict (Q5: mcp_api_error / mcp_network_error /
 * provider_server_error). A count + the contributing reasons so an operator
 * can see the dominant ambiguous-provider failure shape at a glance.
 */
export interface ProviderErrorClusterVerdict {
  /** Total rows whose failure_reason is in the cluster set. */
  count: number;
  /** Per-reason breakdown within the cluster. */
  byReason: ClassifierHealthCountBucket[];
}

/**
 * The H/I/J leakage tripwire verdict. `count` SHOULD always be 0. A non-zero
 * count means a frozen-set family (claim_clarity / thread_topology /
 * sensitive_composer) appeared on a `run_mode = 'production'` SUCCESS row —
 * the tripwire firing. The panel OBSERVES it; it never flips it.
 */
export interface FrozenFamilyTripwireVerdict {
  /** Count of production-success rows that referenced a frozen family. */
  count: number;
  /** Per-frozen-family breakdown (each SHOULD be 0). */
  byFamily: Array<{ family: string; count: number }>;
  /** The frozen family set this tripwire watches (echoed for transparency). */
  watchedFamilies: ReadonlyArray<string>;
}

/**
 * The full verdict object the Edge function returns — counts + grouping keys +
 * plain-language labels ONLY. NO raw rows, NO body, NO evidence_span, NO
 * payload, NO secret.
 */
export interface ClassifierHealthVerdict {
  /** Total rows in scope after the filter. */
  totalRows: number;
  /** Count by status (success / failed / fallback / null). */
  byStatus: ClassifierHealthCountBucket[];
  /** Count by queue lifecycle state (incl. dead_letter). */
  byState: ClassifierHealthCountBucket[];
  /** Count by failure_reason (plain-language mapped). */
  byFailureReason: ClassifierHealthCountBucket[];
  /** Count by failure_sub_reason. */
  byFailureSubReason: ClassifierHealthCountBucket[];
  /** Count by dead_letter_reason. */
  byDeadLetterReason: ClassifierHealthCountBucket[];
  /** Count by run_mode (production / admin_validation). */
  byRunMode: ClassifierHealthCountBucket[];
  /** Count by family (flattened from requested_families + family column). */
  byFamily: ClassifierHealthCountBucket[];
  /** Count by failure_detail->>'reason' (the first-read column). */
  byFailureDetailReason: ClassifierHealthCountBucket[];
  /**
   * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — per-rawKey count of SUCCESS runs that
   * dropped that key by OMISSION (key-level fail-closed). NAMES + counts ONLY;
   * never echoes a span. A sustained drop rate on a specific key is the
   * operator's ADVISORY signal that prompt iteration is warranted for that key's
   * span-anchoring — it never gates, never flips a family posture.
   */
  byUncleanSpanKeyDrop: ClassifierHealthCountBucket[];
  /** The provider-error cluster row. */
  providerErrorCluster: ProviderErrorClusterVerdict;
  /** The H/I/J leakage tripwire row (SHOULD read 0). */
  frozenFamilyTripwire: FrozenFamilyTripwireVerdict;
  /** The runTag-source strategy used to derive the runTag filter, for transparency. */
  runTagSource: 'title_suffix_heuristic' | 'durable_column' | 'none';
}
