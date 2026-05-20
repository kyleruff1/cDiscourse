/**
 * GAME-002 — Turn pacing model (pure TypeScript).
 *
 * Mode-level turn pacing: cooldowns, a rolling-24h daily message cap, and a
 * response window. The doctrine that shapes this file:
 *
 *  - Pacing is NEITHER a score NOR a validation gate. It is a *consented,
 *    visible* room rule. The model therefore exposes `canSendNow` as
 *    ADVISORY chip-tone metadata only — there is no "block submit" output.
 *    `pacingNoHiddenBlock.test.ts` proves the model cannot disable posting.
 *  - The v1 default is `DEFAULT_CASUAL_PACING_RULE`: no pacing at all. It is
 *    a provable no-op (`isNoPacingRule` true, `evaluatePacing` always `ok`).
 *  - All user-facing copy is plain language: no verdict tokens, no internal
 *    `PacingBlockReason` codes, no threatening / punitive wording.
 *  - Pacing never reads room heat, score, or strength band — the input shape
 *    has no field for them by construction.
 *
 * This file is pure TS — NO React, NO Supabase, NO network. Pacing state is
 * in-memory only in v1 (no migration, no table, no persistence).
 */

// ── Types ────────────────────────────────────────────────────────────────

/**
 * Mode-level turn pacing rule. Set per argument mode (GAME-003), never per
 * user. Both parties consent to it at room setup. Immutable once a room is
 * created.
 */
export type PacingRule = Readonly<{
  /** Max moves a participant may post per rolling 24h. null = unlimited. */
  maxMovesPerDay: number | null;
  /** Forced wait after a send, in seconds. 0 = no cooldown. */
  cooldownAfterSendSec: number;
  /** Window to respond to the opponent's move, in seconds. null = none. */
  responseWindowSec: number | null;
  /**
   * When true, a move posted after the full cooldown carries extra point
   * weight — the "clear payoff" doctrine: a cooldown must buy the user
   * something (framing time, weight, or reduced heat), never just a wait.
   * GAME-002 EXPORTS this flag; actually applying weight to point standing
   * is GAME-003 / point-standing wiring, NOT this card.
   */
  weightedByCooldown: boolean;
  /** Strict-mode 'permanent record' advisory toggle. Pure data in v1. */
  permanentRecordWarning: 'on' | 'off';
}>;

/** A single past move by THIS participant, used for cap + cooldown math. */
export type PacingMoveRecord = Readonly<{
  /** Epoch ms the move was sent. */
  sentAtMs: number;
}>;

export type PacingEvaluationInput = Readonly<{
  rule: PacingRule;
  /**
   * This participant's recent moves, any order. The model sorts internally.
   * In v1 this is derived in-memory from the loaded argument list filtered
   * to the current user — NOT persisted pacing state.
   */
  recentMoves: readonly PacingMoveRecord[];
  /** Epoch ms "now". Injected so the model stays pure + deterministic. */
  now: number;
  /**
   * Optional: epoch ms the opponent's last move arrived. Drives the
   * responseWindowSec check. When omitted, response-window is treated as
   * not-applicable (never blocks).
   */
  opponentLastMoveAtMs?: number;
}>;

/**
 * Machine reason. Plain-language copy is derived separately — these codes
 * NEVER reach a user-facing string.
 */
export type PacingBlockReason =
  | 'ok'
  | 'cooldown_active'
  | 'daily_limit_hit'
  | 'response_window_expired';

export type PacingEvaluation = Readonly<{
  /** Whether this participant may post a move right now. Advisory only. */
  canSendNow: boolean;
  /** Epoch ms the user may next send. null = sendable now OR no time gate. */
  nextAvailable: number | null;
  /** Moves left in the rolling 24h window. null = unlimited. */
  remainingToday: number | null;
  /** Machine reason. Plain-language copy is derived separately. */
  reason: PacingBlockReason;
}>;

/**
 * Render-ready view model. All strings are plain-language and pass the
 * doctrine ban-list. No internal codes (`cooldown_active`, etc.) ever
 * appear in any field here.
 */
export type PacingChipViewModel = Readonly<{
  /** When false the chip renders nothing (casual / no-pacing mode). */
  visible: boolean;
  /** e.g. "Moves left today: 7 of 10". null when maxMovesPerDay is null. */
  remainingLabel: string | null;
  /** e.g. "You can send again in 0:42". null when not in cooldown / window. */
  countdownLabel: string | null;
  /** One-line plain summary for the screen-reader accessibilityLabel. */
  accessibilityLabel: string;
  /** Mirrors PacingEvaluation.canSendNow — drives chip tone, not a gate. */
  canSendNow: boolean;
}>;

// ── Constants ────────────────────────────────────────────────────────────

/** Rolling-window length for the daily cap (24h in ms). */
const DAY_MS = 86_400_000;

/**
 * The no-pacing baseline. Casual mode is the v1 default and is a provable
 * no-op: no cap, no cooldown, no window, no cooldown weighting.
 */
export const DEFAULT_CASUAL_PACING_RULE: PacingRule = Object.freeze({
  maxMovesPerDay: null,
  cooldownAfterSendSec: 0,
  responseWindowSec: null,
  weightedByCooldown: false,
  permanentRecordWarning: 'off',
});

// ── Pure helpers ─────────────────────────────────────────────────────────

/** Clamp a `number | null` cap to a non-negative integer or null. */
function clampNullableCount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

/** Clamp a non-negative seconds value; non-finite / negative → 0. */
function clampNonNegativeSeconds(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Clamp a `number | null` seconds window to a non-negative integer or null. */
function clampNullableSeconds(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

/**
 * Constructor for a `PacingRule`. Merges a partial over the casual default,
 * clamps negative / non-finite inputs to safe values, and freezes the
 * result. Used by GAME-003 mode templates later.
 */
export function createPacingRule(partial?: Partial<PacingRule>): PacingRule {
  const base = DEFAULT_CASUAL_PACING_RULE;
  if (!partial || typeof partial !== 'object') {
    return base;
  }
  const permanentRecordWarning: 'on' | 'off' =
    partial.permanentRecordWarning === 'on' ? 'on' : 'off';
  return Object.freeze({
    maxMovesPerDay:
      'maxMovesPerDay' in partial
        ? clampNullableCount(partial.maxMovesPerDay)
        : base.maxMovesPerDay,
    cooldownAfterSendSec:
      'cooldownAfterSendSec' in partial
        ? clampNonNegativeSeconds(partial.cooldownAfterSendSec)
        : base.cooldownAfterSendSec,
    responseWindowSec:
      'responseWindowSec' in partial
        ? clampNullableSeconds(partial.responseWindowSec)
        : base.responseWindowSec,
    weightedByCooldown:
      'weightedByCooldown' in partial
        ? partial.weightedByCooldown === true
        : base.weightedByCooldown,
    permanentRecordWarning,
  });
}

/**
 * True when the rule is functionally casual: no cap, no cooldown, no
 * response window. Drives the chip's `visible: false`.
 */
export function isNoPacingRule(rule: PacingRule): boolean {
  if (!rule || typeof rule !== 'object') return true;
  const hasCap = rule.maxMovesPerDay !== null;
  const hasCooldown = clampNonNegativeSeconds(rule.cooldownAfterSendSec) > 0;
  const hasWindow = rule.responseWindowSec !== null;
  return !hasCap && !hasCooldown && !hasWindow;
}

/**
 * Format a seconds count as `"0:42"` / `"3:05"` / `"1:02:30"`. Pure.
 * Guards NaN / Infinity / negative → `"0:00"`.
 */
export function formatCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0:00';
  }
  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const two = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) {
    return `${hours}:${two(minutes)}:${two(seconds)}`;
  }
  return `${minutes}:${two(seconds)}`;
}

/**
 * Deterministic core. Evaluates pacing for the current participant.
 *
 * Algorithm:
 *  1. No-pacing rule → `ok` with all-null limits.
 *  2. Daily cap: count moves in the rolling 24h window; `remainingToday`
 *     is `max(0, cap - count)`. When 0 → `daily_limit_hit`.
 *  3. Cooldown: when the most-recent move is still inside the cooldown
 *     window → `cooldown_active`.
 *  4. Response window: when `now` is past the opponent's window end →
 *     `response_window_expired`.
 *  5. Precedence: `daily_limit_hit` > `response_window_expired` >
 *     `cooldown_active`.
 *
 * `canSendNow` is ADVISORY chip-tone metadata only — never a posting gate.
 */
export function evaluatePacing(input: PacingEvaluationInput): PacingEvaluation {
  // Guard a malformed input — degrade to the safe, no-block state.
  if (!input || typeof input !== 'object' || !input.rule) {
    return Object.freeze({
      canSendNow: true,
      nextAvailable: null,
      remainingToday: null,
      reason: 'ok' as const,
    });
  }

  const { rule } = input;

  if (isNoPacingRule(rule)) {
    return Object.freeze({
      canSendNow: true,
      nextAvailable: null,
      remainingToday: null,
      reason: 'ok' as const,
    });
  }

  // A non-finite `now` cannot drive any time math — degrade to `ok`.
  const now = input.now;
  if (!Number.isFinite(now)) {
    return Object.freeze({
      canSendNow: true,
      nextAvailable: null,
      remainingToday: null,
      reason: 'ok' as const,
    });
  }

  const recentMoves = Array.isArray(input.recentMoves) ? input.recentMoves : [];

  // ── Step 2: daily cap ──
  const cap = clampNullableCount(rule.maxMovesPerDay);
  let remainingToday: number | null = null;
  let dailyNextAvailable: number | null = null;
  let dailyLimitHit = false;

  if (cap !== null) {
    // Moves within the rolling 24h window: now - DAY_MS <= sentAt <= now.
    // A future-dated move (sentAt > now, clock skew) is NOT counted.
    const windowStart = now - DAY_MS;
    const inWindow = recentMoves.filter(
      (m) =>
        m &&
        Number.isFinite(m.sentAtMs) &&
        m.sentAtMs >= windowStart &&
        m.sentAtMs <= now,
    );
    remainingToday = Math.max(0, cap - inWindow.length);
    if (remainingToday === 0) {
      dailyLimitHit = true;
      // When a counted move ages past 24h, a slot frees. With no counted
      // move (e.g. cap === 0) there is nothing to age out → null.
      if (inWindow.length > 0) {
        const oldest = inWindow.reduce(
          (min, m) => (m.sentAtMs < min ? m.sentAtMs : min),
          inWindow[0].sentAtMs,
        );
        dailyNextAvailable = oldest + DAY_MS;
      } else {
        dailyNextAvailable = null;
      }
    }
  }

  // ── Step 3: cooldown ──
  const cooldownSec = clampNonNegativeSeconds(rule.cooldownAfterSendSec);
  let cooldownActive = false;
  let cooldownNextAvailable: number | null = null;

  if (cooldownSec > 0 && recentMoves.length > 0) {
    // Most-recent move = max sentAtMs (ignoring non-finite entries).
    let lastSentAt: number | null = null;
    for (const m of recentMoves) {
      if (m && Number.isFinite(m.sentAtMs)) {
        if (lastSentAt === null || m.sentAtMs > lastSentAt) {
          lastSentAt = m.sentAtMs;
        }
      }
    }
    if (lastSentAt !== null) {
      const cooldownEnd = lastSentAt + cooldownSec * 1000;
      // Equality is NOT a block: `now === cooldownEnd` is sendable.
      if (now < cooldownEnd) {
        cooldownActive = true;
        cooldownNextAvailable = cooldownEnd;
      }
    }
  }

  // ── Step 4: response window ──
  const windowSec = clampNullableSeconds(rule.responseWindowSec);
  let windowExpired = false;

  if (
    windowSec !== null &&
    typeof input.opponentLastMoveAtMs === 'number' &&
    Number.isFinite(input.opponentLastMoveAtMs)
  ) {
    const windowEnd = input.opponentLastMoveAtMs + windowSec * 1000;
    if (now > windowEnd) {
      windowExpired = true;
    }
  }

  // ── Step 5: precedence ──
  // daily_limit_hit > response_window_expired > cooldown_active.
  if (dailyLimitHit) {
    return Object.freeze({
      canSendNow: false,
      nextAvailable: dailyNextAvailable,
      remainingToday,
      reason: 'daily_limit_hit' as const,
    });
  }
  if (windowExpired) {
    // An expired window is not a "wait" — no countdown.
    return Object.freeze({
      canSendNow: false,
      nextAvailable: null,
      remainingToday,
      reason: 'response_window_expired' as const,
    });
  }
  if (cooldownActive) {
    return Object.freeze({
      canSendNow: false,
      nextAvailable: cooldownNextAvailable,
      remainingToday,
      reason: 'cooldown_active' as const,
    });
  }

  // ── Step 6: sendable ──
  return Object.freeze({
    canSendNow: true,
    nextAvailable: null,
    remainingToday,
    reason: 'ok' as const,
  });
}

/**
 * Compose `evaluatePacing` + `formatCountdown` into a render-ready chip
 * view model. All strings are plain-language; no internal `PacingBlockReason`
 * code ever reaches a field here.
 */
export function buildPacingChipViewModel(
  input: PacingEvaluationInput,
): PacingChipViewModel {
  const rule = input && input.rule ? input.rule : DEFAULT_CASUAL_PACING_RULE;

  // Casual / no-pacing → the chip renders nothing.
  if (isNoPacingRule(rule)) {
    return Object.freeze({
      visible: false,
      remainingLabel: null,
      countdownLabel: null,
      accessibilityLabel: 'No pacing rules for this conversation.',
      canSendNow: true,
    });
  }

  const evaluation = evaluatePacing(input);
  const now = Number.isFinite(input.now) ? input.now : 0;

  // ── remainingLabel ──
  let remainingLabel: string | null = null;
  if (
    evaluation.remainingToday !== null &&
    rule.maxMovesPerDay !== null
  ) {
    remainingLabel = `Moves left today: ${evaluation.remainingToday} of ${rule.maxMovesPerDay}`;
  }

  // ── countdownLabel ──
  let countdownLabel: string | null = null;
  if (
    evaluation.nextAvailable !== null &&
    Number.isFinite(evaluation.nextAvailable)
  ) {
    const remainingSec = Math.ceil((evaluation.nextAvailable - now) / 1000);
    if (remainingSec > 0) {
      countdownLabel = `You can send again in ${formatCountdown(remainingSec)}`;
    }
  }

  // ── accessibilityLabel — one plain-language line ──
  let accessibilityLabel: string;
  if (evaluation.reason === 'daily_limit_hit') {
    accessibilityLabel =
      remainingLabel !== null
        ? `${remainingLabel}. You have used all of today's moves. You can still save a draft.`
        : `You have used all of today's moves. You can still save a draft.`;
  } else if (evaluation.reason === 'response_window_expired') {
    accessibilityLabel =
      'The response window for this turn has passed. You can still save a draft and post when ready.';
  } else if (evaluation.reason === 'cooldown_active') {
    const tail = countdownLabel !== null ? ` ${countdownLabel}.` : '';
    accessibilityLabel = `A short pause is in effect after your last move.${tail}`;
  } else {
    // reason === 'ok'
    accessibilityLabel =
      remainingLabel !== null
        ? `${remainingLabel}. You can send a move now.`
        : 'You can send a move now.';
  }

  return Object.freeze({
    visible: true,
    remainingLabel,
    countdownLabel,
    accessibilityLabel,
    canSendNow: evaluation.canSendNow,
  });
}

/**
 * Deferred seam for RULE-004's `PreSendReviewSheet`. Returns a plain,
 * non-threatening advisory string when `permanentRecordWarning === 'on'`,
 * else `null`. Exported and tested now; GAME-002 has no production caller.
 */
export function describePermanentRecord(rule: PacingRule): string | null {
  if (!rule || typeof rule !== 'object') return null;
  if (rule.permanentRecordWarning !== 'on') return null;
  return 'This move becomes a lasting part of the conversation record. Take a moment to review it before you send.';
}

// ── DEV-only override ────────────────────────────────────────────────────

/**
 * DEV-only module-local override. Set only by `setDevPacingOverride`. The
 * `__DEV__` guards ensure both functions are no-ops (and dead-code-
 * eliminated) in production bundles. NEVER surfaced in any user-facing UI.
 */
let devOverride: PacingRule | null = null;

/**
 * DEV-ONLY. Returns a pacing rule override if a developer has set one,
 * else null. Guarded by `__DEV__` so it is dead-code-eliminated from
 * production bundles. NEVER surfaced in any user-facing UI.
 */
export function getDevPacingOverride(): PacingRule | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  return devOverride;
}

/**
 * DEV-ONLY. Sets (or clears, with `null`) the developer pacing override.
 * Console / debug-only seam — no UI button ever calls this.
 */
export function setDevPacingOverride(rule: PacingRule | null): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  devOverride = rule;
}
