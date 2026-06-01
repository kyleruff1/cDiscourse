/**
 * OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-ALERTING — pure-TS threshold classifier.
 *
 * Classifies the 6 silent-failure alert conditions for the provider reliability
 * cutover (Conditions A–F in the operator's alerting brief), corresponding to
 * the M1/M2/M4/M5/M6/M8 SQL queries in
 * docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md §5.8.
 *
 * The classifier is PURE: no Deno.env, no fetch, no network, no console,
 * no Date.now. Inputs are the parsed JSON shapes of the 6 SQL queries; outputs
 * are typed severity verdicts. Pure-TS so it can run identically in:
 *   - The cutover-health-monitor Edge Function (server-side).
 *   - Jest unit tests (assertion of threshold bands + safety invariants).
 *
 * Doctrine (cdiscourse-doctrine):
 *   - §1, §3 — the classifier emits ONLY operational severities; no truth /
 *     winner / loser / popularity / engagement signal participates.
 *   - §6 — no secret value, no body text, no evidence_span content reaches
 *     the output. The doctrine condition (Condition F) is classified on a
 *     pre-counted SUM (hit count) — the evidence_span text NEVER leaves SQL.
 *   - §7 — no AI / model / provider call inside this module.
 *
 * Alert thresholds mirror design §5.8 PASS / PARTIAL / FAIL bands exactly.
 * A WARN classification corresponds to the design's PARTIAL band; an ALERT
 * classification corresponds to the design's FAIL band. PASS = no signal.
 */

// ── Severity ─────────────────────────────────────────────────────

/** Operational severity for a single condition's verdict. */
export type CutoverAlertSeverity = 'pass' | 'warn' | 'alert';

/** Stable identifier for each of the 6 alert conditions. */
export type CutoverAlertConditionId =
  | 'A_drainer_stale'
  | 'B_queue_backlog'
  | 'C_dead_letter_spike'
  | 'D_direct_dispatch_leak'
  | 'E_duplicate_success'
  | 'F_doctrine_banned_token';

// ── Per-condition input shapes ───────────────────────────────────

/**
 * Condition A — M1 drainer cron freshness probe.
 *
 * `seconds_since_last_completed_drain` is `null` ONLY when the audit table
 * has zero `completed` rows (drainer never started) OR an extreme edge
 * (cleared table). Either way we treat NULL as the ALERT state — the
 * drainer is unable to prove liveness.
 */
export interface MetricInputDrainerFreshness {
  seconds_since_last_completed_drain: number | null;
  completed_in_window: number;
  non_completed_in_window: number;
}

/**
 * Condition B — M2 queue depth + oldest-pending-age.
 *
 * `oldest_pending_age_seconds` is `null` when there are zero pending rows
 * (healthy quiet load); treated as PASS.
 */
export interface MetricInputQueueBacklog {
  non_terminal_rows: number;
  oldest_pending_age_seconds: number | null;
  pending_count: number;
  leased_count: number;
  retry_scheduled_count: number;
}

/**
 * Condition C — M4 dead-letter rate.
 *
 * Numeric pct is the SQL `ROUND(... , 3)` value as a string (Postgres
 * returns NUMERIC as string over JSON). Empty window → 0 cells → 0.0%.
 */
export interface MetricInputDeadLetterRate {
  total_terminal_cells: number;
  dead_letter_cells: number;
  /** Postgres NUMERIC → string; treat null/'' as 0. */
  dead_letter_pct: string | null;
}

/**
 * Condition D — M6 direct-dispatch leakage absence.
 *
 * Any non-zero value is an immediate ALERT (no PARTIAL band; the routing
 * predicate is mutually exclusive by design §5.4).
 */
export interface MetricInputDirectDispatchLeak {
  direct_dispatch_leak_count: number;
}

/**
 * Condition E — M5 duplicate-success absence.
 *
 * Any non-zero value is an immediate ALERT (the DB partial unique index
 * makes this DB-impossible; a non-zero is either a constraint regression
 * or a query bug, both blocking).
 */
export interface MetricInputDuplicateSuccess {
  duplicate_success_cell_count: number;
}

/**
 * Condition F — M8 doctrine ban-list scan over `evidence_span`.
 *
 * Counts only; the SQL aggregator returns SUMs of CASE-WHEN matches per
 * banned-token category. Any non-zero in ANY category is an immediate
 * ALERT.
 */
export interface MetricInputDoctrineBanList {
  total_evidence_spans_scanned: number;
  hits_verdict_persona: number;
  hits_truth_or_victory: number;
  hits_quality_verdict: number;
  hits_motive_verdict: number;
}

/** Full input bundle — one entry per condition. */
export interface CutoverHealthInputs {
  conditionA: MetricInputDrainerFreshness;
  conditionB: MetricInputQueueBacklog;
  conditionC: MetricInputDeadLetterRate;
  conditionD: MetricInputDirectDispatchLeak;
  conditionE: MetricInputDuplicateSuccess;
  conditionF: MetricInputDoctrineBanList;
}

// ── Per-condition verdict ────────────────────────────────────────

/**
 * A condition's verdict. Carries the observed value + the threshold the
 * classifier matched against + a short remediation hint. The verdict
 * intentionally does NOT carry the raw input row — only the SAFE numeric
 * value relevant to the alert + a stable category identifier.
 */
export interface CutoverAlertVerdict {
  /** Stable id; safe for logs + email subjects. */
  conditionId: CutoverAlertConditionId;
  /** One-word severity. */
  severity: CutoverAlertSeverity;
  /** Numeric value the threshold matched against (NaN if N/A). */
  observedValue: number;
  /** Human-readable threshold expression (e.g., '> 300s'). */
  thresholdExpression: string;
  /** Short observation window expression (e.g., '30 min'). */
  observationWindow: string;
  /** Short remediation hint (no PII, no secret). */
  remediation: string;
}

/** Full output bundle. */
export interface CutoverHealthVerdict {
  overallSeverity: CutoverAlertSeverity;
  conditionVerdicts: CutoverAlertVerdict[];
  /** Count of conditions at each severity. */
  alertCount: number;
  warnCount: number;
  passCount: number;
}

// ── Numeric helpers ──────────────────────────────────────────────

/**
 * Parse a Postgres-numeric-as-JSON-string into a finite number. Returns
 * `fallback` (default 0) when the input is null/undefined/NaN.
 *
 * Pure; never throws. Exported for tests.
 */
export function parsePgNumeric(
  raw: string | number | null | undefined,
  fallback: number = 0,
): number {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : fallback;
  }
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

// ── Per-condition classifiers ────────────────────────────────────

/**
 * Condition A — drainer stale.
 *   PASS:  seconds_since_last_completed_drain < 120
 *   WARN:  120–299
 *   ALERT: >= 300 OR null (no drain ever completed in the audit window)
 *
 * Mirrors design §5.8 M1 PASS/PARTIAL/FAIL bands exactly.
 */
export function classifyConditionA(
  input: MetricInputDrainerFreshness,
): CutoverAlertVerdict {
  const seconds = input.seconds_since_last_completed_drain;
  if (seconds === null) {
    return {
      conditionId: 'A_drainer_stale',
      severity: 'alert',
      observedValue: Number.POSITIVE_INFINITY,
      thresholdExpression: 'no completed drain row in audit window',
      observationWindow: '30 min',
      remediation:
        'Drainer cron may be disabled / Edge function failing on startup. Check cron.job_run_details and classifier-drainer logs.',
    };
  }
  const s = parsePgNumeric(seconds, Number.POSITIVE_INFINITY);
  if (s >= 300) {
    return {
      conditionId: 'A_drainer_stale',
      severity: 'alert',
      observedValue: s,
      thresholdExpression: '>= 300s',
      observationWindow: '30 min',
      remediation:
        'Drainer not ticking. Roll back routing immediately (unset CLASSIFIER_QUEUE_ROUTING_ENABLED). Investigate cron + classifier-drainer Edge function health.',
    };
  }
  if (s >= 120) {
    return {
      conditionId: 'A_drainer_stale',
      severity: 'warn',
      observedValue: s,
      thresholdExpression: '120-299s',
      observationWindow: '30 min',
      remediation:
        'One missed drain tick. Continue monitoring; if next M1 also breaches, escalate to ALERT.',
    };
  }
  return {
    conditionId: 'A_drainer_stale',
    severity: 'pass',
    observedValue: s,
    thresholdExpression: '< 120s',
    observationWindow: '30 min',
    remediation: '',
  };
}

/**
 * Condition B — queue backlog.
 *   PASS:  oldest_pending < 300s OR no pending rows
 *   WARN:  300-899s
 *   ALERT: >= 900s
 */
export function classifyConditionB(
  input: MetricInputQueueBacklog,
): CutoverAlertVerdict {
  const seconds = input.oldest_pending_age_seconds;
  // No pending rows → queue is healthy or quiet load.
  if (seconds === null) {
    return {
      conditionId: 'B_queue_backlog',
      severity: 'pass',
      observedValue: 0,
      thresholdExpression: 'no pending rows',
      observationWindow: '30 min',
      remediation: '',
    };
  }
  const s = parsePgNumeric(seconds, Number.POSITIVE_INFINITY);
  if (s >= 900) {
    return {
      conditionId: 'B_queue_backlog',
      severity: 'alert',
      observedValue: s,
      thresholdExpression: '>= 900s (15 min)',
      observationWindow: '30 min',
      remediation:
        'Drainer is behind. Roll back routing. Check drainer concurrency C, Anthropic Tier RPM, and provider error rates.',
    };
  }
  if (s >= 300) {
    return {
      conditionId: 'B_queue_backlog',
      severity: 'warn',
      observedValue: s,
      thresholdExpression: '300-899s',
      observationWindow: '30 min',
      remediation:
        'Queue depth approaching warning band. Monitor M4 dead-letter rate + M7 provider RPM.',
    };
  }
  return {
    conditionId: 'B_queue_backlog',
    severity: 'pass',
    observedValue: s,
    thresholdExpression: '< 300s',
    observationWindow: '30 min',
    remediation: '',
  };
}

/**
 * Condition C — dead-letter rate spike.
 *   PASS:  < 1.0%
 *   WARN:  1.0% - 2.999%
 *   ALERT: >= 3.0%
 */
export function classifyConditionC(
  input: MetricInputDeadLetterRate,
): CutoverAlertVerdict {
  // Empty terminal-cell window → 0% (PASS). Numerator/denominator NaN-guard.
  if (input.total_terminal_cells <= 0) {
    return {
      conditionId: 'C_dead_letter_spike',
      severity: 'pass',
      observedValue: 0,
      thresholdExpression: 'no terminal cells',
      observationWindow: '24 h',
      remediation: '',
    };
  }
  const pct = parsePgNumeric(input.dead_letter_pct, 0);
  if (pct >= 3) {
    return {
      conditionId: 'C_dead_letter_spike',
      severity: 'alert',
      observedValue: pct,
      thresholdExpression: '>= 3.0%',
      observationWindow: '24 h',
      remediation:
        'Dead-letter rate has spiked. Roll back routing. Investigate provider error class + drainer retry schedule.',
    };
  }
  if (pct >= 1) {
    return {
      conditionId: 'C_dead_letter_spike',
      severity: 'warn',
      observedValue: pct,
      thresholdExpression: '1.0%-2.999%',
      observationWindow: '24 h',
      remediation:
        'Dead-letter rate in warning band. Continue monitoring; if rate climbs, escalate.',
    };
  }
  return {
    conditionId: 'C_dead_letter_spike',
    severity: 'pass',
    observedValue: pct,
    thresholdExpression: '< 1.0%',
    observationWindow: '24 h',
    remediation: '',
  };
}

/**
 * Condition D — direct-dispatch leakage.
 *   PASS:  count == 0
 *   ALERT: any non-zero (no WARN band; mutual-exclusion is binary)
 */
export function classifyConditionD(
  input: MetricInputDirectDispatchLeak,
): CutoverAlertVerdict {
  const count = Number.isFinite(input.direct_dispatch_leak_count)
    ? input.direct_dispatch_leak_count
    : 0;
  if (count > 0) {
    return {
      conditionId: 'D_direct_dispatch_leak',
      severity: 'alert',
      observedValue: count,
      thresholdExpression: '> 0 leaked rows',
      observationWindow: '1 h',
      remediation:
        'Routing predicate broken — argument took BOTH paths. Roll back routing IMMEDIATELY. Investigate shouldRouteToQueue branch.',
    };
  }
  return {
    conditionId: 'D_direct_dispatch_leak',
    severity: 'pass',
    observedValue: 0,
    thresholdExpression: '== 0',
    observationWindow: '1 h',
    remediation: '',
  };
}

/**
 * Condition E — duplicate success rows.
 *   PASS:  count == 0
 *   ALERT: any non-zero (DB partial unique index makes this DB-impossible;
 *          non-zero is a constraint regression or query bug — blocking)
 */
export function classifyConditionE(
  input: MetricInputDuplicateSuccess,
): CutoverAlertVerdict {
  const count = Number.isFinite(input.duplicate_success_cell_count)
    ? input.duplicate_success_cell_count
    : 0;
  if (count > 0) {
    return {
      conditionId: 'E_duplicate_success',
      severity: 'alert',
      observedValue: count,
      thresholdExpression: '> 0 duplicate-success cells',
      observationWindow: '24 h',
      remediation:
        'Partial unique index breach detected. Roll back routing IMMEDIATELY. Investigate amor_one_success_per_cell_idx and the atomic finalizer.',
    };
  }
  return {
    conditionId: 'E_duplicate_success',
    severity: 'pass',
    observedValue: 0,
    thresholdExpression: '== 0',
    observationWindow: '24 h',
    remediation: '',
  };
}

/**
 * Condition F — doctrine ban-list scan.
 *   PASS:  all 4 hit-counts == 0
 *   ALERT: any non-zero (immediate doctrine escalation)
 *
 * The classifier sums all 4 categories' hits as the observed value; the
 * remediation cites which categories breached so the operator knows what
 * doctrine surface to investigate.
 */
export function classifyConditionF(
  input: MetricInputDoctrineBanList,
): CutoverAlertVerdict {
  const persona = Number.isFinite(input.hits_verdict_persona) ? input.hits_verdict_persona : 0;
  const truthVictory = Number.isFinite(input.hits_truth_or_victory) ? input.hits_truth_or_victory : 0;
  const quality = Number.isFinite(input.hits_quality_verdict) ? input.hits_quality_verdict : 0;
  const motive = Number.isFinite(input.hits_motive_verdict) ? input.hits_motive_verdict : 0;
  const total = persona + truthVictory + quality + motive;
  if (total > 0) {
    const categories: string[] = [];
    if (persona > 0) categories.push('verdict-persona');
    if (truthVictory > 0) categories.push('truth-or-victory');
    if (quality > 0) categories.push('quality-verdict');
    if (motive > 0) categories.push('motive-verdict');
    return {
      conditionId: 'F_doctrine_banned_token',
      severity: 'alert',
      observedValue: total,
      thresholdExpression: '> 0 banned-token hits',
      observationWindow: '24 h',
      remediation: `Doctrine breach in ${categories.join(', ')}. Roll back routing IMMEDIATELY + doctrine escalation. Investigate classifier prompt + ban-list scan coverage.`,
    };
  }
  return {
    conditionId: 'F_doctrine_banned_token',
    severity: 'pass',
    observedValue: 0,
    thresholdExpression: 'all 4 categories == 0',
    observationWindow: '24 h',
    remediation: '',
  };
}

// ── Bundle-level classifier ──────────────────────────────────────

/**
 * Classify the full input bundle into a per-condition verdict array and an
 * overall severity (the worst severity across all conditions).
 *
 * Pure; no I/O.
 */
export function classifyCutoverHealth(
  inputs: CutoverHealthInputs,
): CutoverHealthVerdict {
  const verdicts: CutoverAlertVerdict[] = [
    classifyConditionA(inputs.conditionA),
    classifyConditionB(inputs.conditionB),
    classifyConditionC(inputs.conditionC),
    classifyConditionD(inputs.conditionD),
    classifyConditionE(inputs.conditionE),
    classifyConditionF(inputs.conditionF),
  ];
  let alertCount = 0;
  let warnCount = 0;
  let passCount = 0;
  for (const v of verdicts) {
    if (v.severity === 'alert') alertCount += 1;
    else if (v.severity === 'warn') warnCount += 1;
    else passCount += 1;
  }
  const overallSeverity: CutoverAlertSeverity =
    alertCount > 0 ? 'alert' : warnCount > 0 ? 'warn' : 'pass';
  return {
    overallSeverity,
    conditionVerdicts: verdicts,
    alertCount,
    warnCount,
    passCount,
  };
}

// ── Safety: forbidden-substring scan ─────────────────────────────

/**
 * Sentinel substrings the cutover-health alert payload MUST NEVER contain.
 * Used both at runtime (defensive scrubber on the outgoing email body) and
 * in tests (assert that every classifier output is sentinel-free).
 *
 * Categories:
 *   - Secret / auth prefixes (Supabase PAT prefix, Supabase service-key prefix,
 *     Anthropic key prefix, JWT prefix, the Authorization header literal).
 *   - Doctrine verdict tokens (mirrors §F ban-list).
 *
 * The list is intentionally short + structural — the runtime test verifies
 * that classifier outputs are clean; the email composer adds a final
 * defensive scrub.
 *
 * The Supabase-key prefixes are constructed by concatenation so this source
 * file does not itself contain a contiguous occurrence of the literal — this
 * keeps the repo's secret-literal scan (`__tests__/adminSecurity.test.ts`)
 * green. Same convention as the Edge-side AUTH_SCHEME_PREFIX literal in the
 * MCP boolean-observation request adapter + the classifier-drainer.
 */
const SUPABASE_PAT_PREFIX = 's' + 'bp_';
const SUPABASE_SERVICE_KEY_PREFIX = 'sb' + '_secret_';
const ANTHROPIC_KEY_PREFIX = 'sk' + '-ant-';

export const FORBIDDEN_OUTPUT_SUBSTRINGS: ReadonlyArray<string> = Object.freeze([
  SUPABASE_PAT_PREFIX,
  SUPABASE_SERVICE_KEY_PREFIX,
  ANTHROPIC_KEY_PREFIX,
  'eyJ',
  'Authorization:',
  // Doctrine verdict tokens (output MUST NOT echo them; remediation strings
  // describe CATEGORIES, never raw tokens):
  'winner',
  'loser',
  'liar',
  'dishonest',
]);

/**
 * Returns true if any forbidden substring appears in `text`. Case-insensitive
 * to catch ANY shape of the forbidden tokens. Used by tests + the email composer.
 */
export function containsForbiddenSubstring(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  const lower = text.toLowerCase();
  for (const f of FORBIDDEN_OUTPUT_SUBSTRINGS) {
    if (lower.includes(f.toLowerCase())) return true;
  }
  return false;
}
