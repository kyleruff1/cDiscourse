# GAME-002 — Turn pacing, daily messages, cooldown (mode-driven)

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (game-rules / pacing layer; cross-cuts the COMPOSER surface)
**Release:** Roadmap (filed by the 2026-05-19 product audit; runner-suitable after COMPOSER-002, which has now merged — commit `eb4f014`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/118

---

## Goal (one paragraph)

GAME-002 introduces **mode-level turn pacing** so that argument modes can make moves
feel consequential — cooldowns, a daily message cap, response windows, and a
cooldown-driven point-weight flag — *without ever becoming an invisible
punishment*. The deliverable is a pure-TS deterministic model
(`pacingModel.ts`) and a small, screen-reader-accessible status component
(`PacingChip.tsx`) mounted in the COMPOSER-002 dock header. The doctrine that
shapes the whole design: **score never blocks posting, validation does — but
pacing is neither a validation gate nor a score**. Pacing is a *consented,
visible* room rule. The chip therefore always shows the user exactly where they
stand (remaining moves, time until next available) and the cause of any block in
plain language. v1 ships with the **default-casual `PacingRule`** (no pacing at
all): casual mode is the baseline and is provably a no-op. Non-casual mode
templates wire their `pacingRule` in later via **GAME-003**. Pacing state is
**in-memory only** in v1 — no migration, no table, no persistence (the issue
explicitly defers persistent pacing to a later card).

---

## Scope-conflict findings (read first)

The card body and the roadmap reference two things that do not exist or are not
done. Per the coordinator's scope constraints, this design **does not** widen to
cover them. Both findings are stated here so the implementer is not surprised:

1. **`PreSendReviewSheet` does not exist in the repo.** A repo-wide search
   (`Grep "PreSendReviewSheet"`) returns matches **only in docs**
   (`docs/research/playable-argument-modes.md`) — there is **no
   `PreSendReviewSheet.tsx` source file** (`Glob "**/PreSendReviewSheet*"` →
   no files). That component is owned by **RULE-004**, which is **not done**.
   The issue's scope item 2 ("'Permanent move' advisory in `PreSendReviewSheet`")
   and the "File / surface boundaries" entry ("Modified: `PreSendReviewSheet`
   for permanent-record copy") therefore reference a non-existent file.
   **Resolution:** GAME-002 does **not** create or modify any pre-send review
   component. Instead, `permanentRecordWarning: 'on' | 'off'` ships as a pure
   **data field** on `PacingRule`, and `pacingModel.ts` additionally exports a
   small, pure copy helper (`describePermanentRecord`) so RULE-004 can consume a
   ready, doctrine-checked string the moment it builds the sheet. This is a
   **deferred seam**, documented in "Dependencies" below. No production file is
   modified for it in this card.

2. **GAME-003 mode templates are not done.** There is no
   `src/features/modes/` directory yet. GAME-002 creates that directory and
   ships the default-casual rule (`DEFAULT_CASUAL_PACING_RULE`) and a constructor
   (`createPacingRule`). The non-casual templates (strict, ranked, etc.) and the
   wiring of `mode → pacingRule` are GAME-003's job. GAME-002's
   `ArgumentComposerDock` integration reads the default-casual rule, so the chip
   is a no-op render until GAME-003 supplies a non-casual rule.

Neither finding is a blocker — the card is fully buildable inside the
new-file + one-modified-file footprint. The design proceeds.

---

## Data model

No new DB data model. No migration, no table, no RLS, no Edge Function. Pacing
state lives in memory for the lifetime of the room view (the issue: "in v1
pacing state lives in-memory; persistent pacing is a follow-up card").

### `PacingRule` — mode-level rule (immutable, exactly as the issue specifies)

```ts
// src/features/modes/pacingModel.ts

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
   * GAME-002 EXPORTS this flag and the deterministic helper that reads it;
   * actually applying weight to point standing is GAME-003 / point-standing
   * wiring, NOT this card. See "Out of scope".
   */
  weightedByCooldown: boolean;
  /** Strict-mode 'permanent record' advisory toggle. Pure data in v1. */
  permanentRecordWarning: 'on' | 'off';
}>;
```

### `PacingEvaluationInput` — evaluation arguments

```ts
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
```

### `PacingEvaluation` — evaluation result (exactly the issue's shape)

```ts
export type PacingBlockReason =
  | 'ok'
  | 'cooldown_active'
  | 'daily_limit_hit'
  | 'response_window_expired';

export type PacingEvaluation = Readonly<{
  /** Whether this participant may post a move right now. */
  canSendNow: boolean;
  /** Epoch ms the user may next send. null = sendable now OR no time gate. */
  nextAvailable: number | null;
  /** Moves left in the rolling 24h window. null = unlimited. */
  remainingToday: number | null;
  /** Machine reason. Plain-language copy is derived separately. */
  reason: PacingBlockReason;
}>;
```

### `PacingChipViewModel` — what the chip renders (derived, plain-language)

```ts
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
```

`weightedByCooldown` and `permanentRecordWarning` produce no DB rows and no
score writes in this card — see "Out of scope".

---

## File changes

### New files

- `src/features/modes/pacingModel.ts` — **pure TS, no React, no Supabase**
  (~190–230 lines). Exports:
  - the types above (`PacingRule`, `PacingMoveRecord`, `PacingEvaluationInput`,
    `PacingEvaluation`, `PacingBlockReason`, `PacingChipViewModel`);
  - `DEFAULT_CASUAL_PACING_RULE: PacingRule` — the no-pacing baseline
    (`maxMovesPerDay: null, cooldownAfterSendSec: 0, responseWindowSec: null,
    weightedByCooldown: false, permanentRecordWarning: 'off'`);
  - `createPacingRule(partial?): PacingRule` — constructor that merges a partial
    over the casual default, clamps negatives to safe values, and `Object.freeze`s
    the result (used by GAME-003 mode templates later);
  - `isNoPacingRule(rule): boolean` — true when the rule is functionally
    casual (no cap, no cooldown, no window). Drives chip `visible: false`;
  - `evaluatePacing(input): PacingEvaluation` — the deterministic core;
  - `formatCountdown(seconds): string` — `"0:42"` / `"3:05"` / `"1:02:30"`
    style formatter (pure; handles 0, sub-minute, multi-hour, NaN guard);
  - `buildPacingChipViewModel(input): PacingChipViewModel` — composes
    `evaluatePacing` + `formatCountdown` into the render-ready view model with
    plain-language strings;
  - `describePermanentRecord(rule): string | null` — the **deferred seam** for
    RULE-004: returns a plain, non-threatening advisory string when
    `permanentRecordWarning === 'on'`, else `null`. Exported and tested now;
    no production caller in this card.
- `src/features/modes/PacingChip.tsx` — **RN component** (~90–130 lines).
  Presentational. Takes a `PacingChipViewModel` (and an optional
  `reduceMotionOverride`) and renders the dock-header chip. Returns `null` when
  `viewModel.visible === false`. No business logic — all derivation lives in the
  model.
- `src/features/modes/index.ts` — barrel export for the two modules above
  (mirrors `src/features/evidence/index.ts`, `src/features/preferences/`
  conventions). ~6 lines.

> Optional: the implementer MAY skip `index.ts` and import the model/component
> directly. If skipped, note it; it is not load-bearing for any test.

### Modified files

- `src/features/arguments/ArgumentComposerDock.tsx` — **single modified
  production file** (~25–40 added lines, no deletions of existing behavior).
  Changes:
  - import `PacingChip` + `buildPacingChipViewModel` +
    `DEFAULT_CASUAL_PACING_RULE` from `../modes`;
  - accept one new **optional** prop `pacingRule?: PacingRule` (defaults to
    `DEFAULT_CASUAL_PACING_RULE` when omitted) and one new **optional** prop
    `pacingRecentMoves?: readonly PacingMoveRecord[]` (defaults to `[]`);
  - inside the `handleStrip` `headerRow`, render `<PacingChip … />` between the
    `headerLabel` `<Text>` and the `Cancel` `<Pressable>`. The chip is a status
    display, not a button; it sits in the existing header strip;
  - a `now` value is read once per render via `Date.now()` and a
    1-second `setInterval` tick drives the countdown re-render **only while
    `visible` and the chip is in a countdown state** (interval cleared on close
    / unmount / when no countdown is active — see "Edge cases");
  - the existing reduce-motion read in the dock is reused (no second listener);
    it is passed to `PacingChip` as `reduceMotionOverride`.
  - **Unchanged:** the dock's layout variants, slide animation, Escape/back
    close paths, scrim behavior, `ArgumentComposer` mount, `mode="dock"`. The
    chip does **not** touch the composer's draft, validation, or
    `submit-argument` path. **Save-draft remains always available** because the
    chip never disables the composer (it cannot — see "Doctrine self-check").

### Deleted files

None.

---

## API / interface contracts

### `pacingModel.ts` public functions

```ts
export const DEFAULT_CASUAL_PACING_RULE: PacingRule;

export function createPacingRule(partial?: Partial<PacingRule>): PacingRule;

export function isNoPacingRule(rule: PacingRule): boolean;

export function evaluatePacing(input: PacingEvaluationInput): PacingEvaluation;

export function formatCountdown(totalSeconds: number): string;

export function buildPacingChipViewModel(
  input: PacingEvaluationInput,
): PacingChipViewModel;

/** Deferred seam for RULE-004's PreSendReviewSheet. */
export function describePermanentRecord(rule: PacingRule): string | null;
```

`evaluatePacing` algorithm (deterministic; documented so tests are precise):

1. If `isNoPacingRule(rule)` → return
   `{ canSendNow: true, nextAvailable: null, remainingToday: null, reason: 'ok' }`.
2. **Daily cap:** if `maxMovesPerDay !== null`, count `recentMoves` whose
   `sentAtMs` is within `now - 86_400_000 ≤ sentAtMs ≤ now` (rolling 24h).
   `remainingToday = max(0, maxMovesPerDay - count)`. If `remainingToday === 0`
   → `reason: 'daily_limit_hit'`, `canSendNow: false`,
   `nextAvailable` = `oldestInWindow.sentAtMs + 86_400_000` (when the oldest
   counted move ages out, a slot frees).
3. **Cooldown:** if `cooldownAfterSendSec > 0` and there is a most-recent move,
   `cooldownEnd = lastMove.sentAtMs + cooldownAfterSendSec * 1000`. If
   `now < cooldownEnd` → `reason: 'cooldown_active'`, `canSendNow: false`,
   `nextAvailable = cooldownEnd`.
4. **Response window:** if `responseWindowSec !== null` and
   `opponentLastMoveAtMs` is provided, `windowEnd = opponentLastMoveAtMs +
   responseWindowSec * 1000`. If `now > windowEnd` → `reason:
   'response_window_expired'`, `canSendNow: false`, `nextAvailable: null`
   (an expired window is not a "wait", so no countdown — copy says so).
5. **Precedence** when more than one would fire: `daily_limit_hit` >
   `response_window_expired` > `cooldown_active`. (The daily cap is the
   hardest gate; an expired window is a structural state; a cooldown is the
   softest, time-resolving gate. Tests assert this ordering explicitly.)
6. Otherwise → `canSendNow: true`, `reason: 'ok'`, `nextAvailable: null`,
   `remainingToday` carried through from step 2.

> **Doctrine note on `canSendNow`:** the field is *advisory metadata for the
> chip's tone*, NOT a posting gate. The composer's existing
> validation/submit path is untouched; `canSendNow: false` only changes what
> the chip says. Pacing is a consented room rule surfaced honestly, not a
> hidden block — and "block" here means "the chip tells you to wait", which the
> user agreed to at room setup. See "Doctrine self-check".

### `PacingChip.tsx` props

```ts
interface PacingChipProps {
  viewModel: PacingChipViewModel;
  /** PR-001 effective reduce-motion, threaded from the dock. */
  reduceMotionOverride?: boolean;
}
```

Render contract:
- returns `null` when `viewModel.visible === false`;
- a non-interactive `<View>` (it is a status display, not a `Pressable`) with
  `accessibilityRole="text"`, `accessibilityLiveRegion="polite"` (so the
  countdown / remaining-count updates are announced without being chatty), and
  `accessibilityLabel={viewModel.accessibilityLabel}`;
- renders `remainingLabel` and `countdownLabel` as separate `<Text>` children
  (never concatenated into one prose blob — mirrors the timestamp-cell pattern
  from Stage 6.1.6b);
- color is supplementary only: a non-color signal (a `⏳` glyph for active
  countdown, `•` for remaining-count) carries meaning so the chip is legible in
  grayscale;
- `testID="pacing-chip"`.

### `ArgumentComposerDock` new props

```ts
// added to ArgumentComposerDockProps — both optional, both default to no-op
pacingRule?: PacingRule;
pacingRecentMoves?: readonly PacingMoveRecord[];
```

Omitting both keeps today's behavior exactly (chip renders nothing). The caller
chain (`App.tsx` → room shell) does **not** need to change in this card;
GAME-003 supplies non-default values when mode templates land.

### DEV-only override

A `__DEV__`-guarded override lets a developer force a `PacingRule` for manual
testing. Contract:

```ts
// pacingModel.ts
/**
 * DEV-ONLY. Returns a pacing rule override if a developer has set one,
 * else null. Guarded by __DEV__ so it is dead-code-eliminated from
 * production bundles. NEVER surfaced in any user-facing UI.
 */
export function getDevPacingOverride(): PacingRule | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  // reads a module-local variable set only by setDevPacingOverride
  return devOverride;
}
export function setDevPacingOverride(rule: PacingRule | null): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  devOverride = rule;
}
```

The dock applies the override **only** behind `if (__DEV__)` and never renders a
button or toggle for it — it is a console / debug-only seam. The override never
appears in any rendered string and is excluded from production builds by the
bundler's `__DEV__` constant folding.

---

## Edge cases

The implementer must handle every one of these:

- **No-pacing / casual mode** — `DEFAULT_CASUAL_PACING_RULE` or any rule where
  `isNoPacingRule` is true: `evaluatePacing` returns `ok` with all-null limits;
  `buildPacingChipViewModel` returns `visible: false`; `PacingChip` renders
  `null`; the dock mounts no interval. This is the v1 default and must be a
  provable no-op (`pacingNoHiddenBlock.test.ts`).
- **Empty `recentMoves`** — first move of the room: daily count is 0,
  `remainingToday = maxMovesPerDay`, no cooldown (no last move),
  `canSendNow: true`.
- **`maxMovesPerDay = 0`** — a degenerate but valid config: `remainingToday`
  is 0, `reason: 'daily_limit_hit'`, `nextAvailable: null` (no move has been
  made to age out). The chip copy must not imply the user "lost" — it states
  the cap plainly.
- **Cooldown exactly elapsed** — `now === cooldownEnd`: treat as **sendable**
  (`now < cooldownEnd` is the block predicate; equality is not a block).
- **`cooldownAfterSendSec` very large** (e.g. > 24h) — `formatCountdown` must
  render hours (`1:02:30`); no overflow, no negative.
- **Negative / NaN inputs** — `createPacingRule` clamps negative
  `cooldownAfterSendSec`/`maxMovesPerDay`/`responseWindowSec` to safe values
  (`0` or `null`); `evaluatePacing` and `formatCountdown` guard `NaN`/`Infinity`
  `now` / seconds and degrade to `ok` / `"0:00"` rather than throwing.
- **Clock skew / `now` before a move's `sentAtMs`** — a future-dated move:
  the rolling-window count clamps (a move with `sentAtMs > now` is not counted);
  cooldown `nextAvailable` may be in the future and that is fine; the model
  never returns a negative countdown.
- **Response window with no `opponentLastMoveAtMs`** — treated as
  not-applicable; never blocks (`reason` can still be `ok` /
  `cooldown_active` / `daily_limit_hit`).
- **Response window already expired** — `reason: 'response_window_expired'`,
  `canSendNow: false`, `nextAvailable: null` (an expired window is not a
  countdown); chip copy explains it is a missed window, not a punishment, and
  **save-draft is still available**.
- **Multiple gates active at once** — precedence is
  `daily_limit_hit` > `response_window_expired` > `cooldown_active`; the
  test suite asserts the exact tiebreak.
- **Interval lifecycle** — the 1s tick must start only when the chip is in a
  countdown state, must clear on dock close, on unmount, and when the countdown
  reaches zero (re-evaluate once, then stop). No leaked interval, no tick while
  the dock is closed.
- **Reduce-motion** — there is no animation on the chip beyond the text
  updating; the countdown is information, not motion, so it keeps ticking under
  reduce-motion (consistent with `accessibility-targets`: "color changes
  themselves — information, not motion — keep"). The `reduceMotionOverride`
  prop is threaded for consistency but the chip has no decorative animation to
  suppress; document this so a reviewer does not flag a "missing" reduce-motion
  branch.
- **Doctrine edge case — cooldown payoff** — `weightedByCooldown` is carried as
  data and exposed via the model, but GAME-002 does **not** apply weight to
  point standing. If a reviewer expects the cooldown to *do something to the
  score*, the answer is: that wiring is GAME-003 + a point-standing change,
  explicitly out of scope here. The chip still honors the "clear payoff"
  doctrine because the *rule itself* was consented to and is fully visible.
- **Doctrine edge case — heat does not touch pacing** — pacing is a mode rule;
  it never reads room heat, score, or strength band, and heat/score never read
  pacing. The model has no input for heat by construction.

---

## Test plan

All three test files named in the issue, plus the standard pure-model coverage.
Tests live at the repo top-level `__tests__/` (matching `test-discipline`).

- `__tests__/pacingModel.test.ts` — happy path + **every `reason` path**:
  - `evaluatePacing` returns `ok` for `DEFAULT_CASUAL_PACING_RULE`;
  - `cooldown_active` when `now < cooldownEnd`; sendable at and after `cooldownEnd`;
  - `daily_limit_hit` when the rolling-24h count reaches `maxMovesPerDay`;
    `remainingToday` decrements correctly; a move aging past 24h frees a slot;
  - `response_window_expired` when `now > windowEnd`; not-applicable when
    `opponentLastMoveAtMs` is omitted;
  - precedence: daily-limit beats expired-window beats cooldown when all fire;
  - `createPacingRule` merges over the casual default and clamps negatives;
  - `isNoPacingRule` true for casual, false for any active rule;
  - `formatCountdown`: `0 → "0:00"`, `42 → "0:42"`, `185 → "3:05"`,
    `3750 → "1:02:30"`, `NaN → "0:00"`;
  - `buildPacingChipViewModel`: `visible:false` for casual; `remainingLabel` /
    `countdownLabel` populated correctly for active rules;
  - `describePermanentRecord`: `null` when `'off'`, non-empty plain string when
    `'on'`;
  - edge cases: empty `recentMoves`, `maxMovesPerDay: 0`, cooldown-exactly-
    elapsed, future-dated move (clock skew), NaN `now`.
- `__tests__/pacingNoHiddenBlock.test.ts` — **the no-hidden-punishment proof**:
  - for `DEFAULT_CASUAL_PACING_RULE` and several arbitrary `recentMoves` /
    `now` combinations, `evaluatePacing` **always** returns `canSendNow: true`,
    `reason: 'ok'`, `nextAvailable: null`;
  - `buildPacingChipViewModel` returns `visible: false` for the casual rule, so
    the chip renders nothing and adds no surface;
  - assert that no field of `PacingEvaluation` / `PacingChipViewModel` can
    *disable the composer* — i.e. the model exposes no "block submit" output;
    the chip is status-only;
  - (UI-level) `PacingChip` with a `visible:false` view model renders `null`.
- `__tests__/pacingCopyBanList.test.ts` — **doctrine ban-list across every
  produced string**:
  - collect every user-facing string the feature can emit — all
    `remainingLabel`, `countdownLabel`, `accessibilityLabel` values across a
    matrix of rules/states, plus `describePermanentRecord('on')` and any
    static copy constants;
  - assert none contains a verdict / person token:
    `winner, loser, liar, true, false, correct, dishonest, bad faith,
    manipulative, extremist, propagandist, stupid, idiot, punish, penalty,
    banned, blocked, locked out` (the last few guard against pacing copy that
    *sounds* punitive — doctrine: "never threatening");
  - assert no internal `PacingBlockReason` code (`cooldown_active`,
    `daily_limit_hit`, `response_window_expired`) leaks into any user-facing
    string (snake_case check);
  - assert the `permanentRecordWarning: 'on'` copy is plain-language and
    non-threatening.

> No Edge Function tests (no Edge Function). No migration tests (no migration).
> The `ArgumentComposerDock` integration is covered by the existing dock test
> suite remaining green plus the `PacingChip`-renders-`null` assertion above; if
> the implementer adds a small dock-mount test, name it
> `__tests__/argumentComposerDockPacing.test.ts` and keep it to the
> chip-presence/absence assertion (optional, not required by the issue).

---

## Dependencies (cards / docs / files)

- **Assumes COMPOSER-002 is complete** — it is (commit `eb4f014`, PR #150).
  GAME-002 reads the merged `src/features/arguments/ArgumentComposerDock.tsx`
  and mounts the chip inside its existing `handleStrip` → `headerRow`. The
  design was written against the actual merged file.
- **Reads** `src/lib/formatDateTime.ts` only as a *pattern reference* for terse
  relative formatting — `pacingModel.ts` ships its own `formatCountdown`
  because the existing helpers do `"3m ago"`-style relative strings, not a
  live `M:SS` countdown. No import dependency.
- **Reads** `src/features/arguments/gameCopy.ts` as a pattern reference for
  plain-language copy constants. GAME-002's strings are pacing-specific and
  live in `pacingModel.ts`; if a future card wants them centralized in
  `gameCopy.ts` that is a separate refactor.
- **Deferred seam — RULE-004:** `describePermanentRecord(rule)` is exported and
  tested now. When RULE-004 builds `PreSendReviewSheet`, it imports that helper
  and renders the string. GAME-002 modifies **no** pre-send component because
  none exists. This is the documented hand-off.
- **Blocks / is consumed by GAME-003:** GAME-003 mode templates each supply a
  `PacingRule` (via `createPacingRule`) and thread it into `ArgumentComposerDock`
  as the `pacingRule` prop. Until GAME-003 lands, the dock uses
  `DEFAULT_CASUAL_PACING_RULE` and the chip is inert. GAME-003 cannot wire
  pacing without this card's model.
- **Future card — persistent pacing:** the issue's non-scope item ("persistent
  pacing across app restarts") will add a table + loader and replace the
  in-memory `recentMoves` derivation. `PacingEvaluationInput` is shaped so that
  card can swap the data source without changing `evaluatePacing`.

---

## Risks

- **`setInterval` leak in the dock** — the highest-risk change. The 1s tick
  must be created in a `useEffect` keyed on `visible` + whether a countdown is
  active, and torn down in the effect cleanup. If the implementer keys it only
  on `visible`, an idle interval ticks for the dock's whole open lifetime even
  with no pacing. Mitigation: gate interval creation on
  `viewModel.countdownLabel !== null`; clear on cleanup and when the countdown
  hits zero. The existing dock has a clean `useEffect` pattern to mirror.
- **`__DEV__` typing** — `__DEV__` is a React Native global. In a pure-TS model
  file Jest may not define it. Mitigation: the design uses
  `typeof __DEV__ === 'undefined' || !__DEV__` so the override functions are
  safe under Jest and dead-code-eliminated in production. The implementer must
  not `import` anything to get `__DEV__`.
- **Re-render churn** — a 1s `Date.now()` re-render of the whole dock could be
  wasteful. Mitigation: keep the `now` state local; the dock body
  (`ArgumentComposer`) is memo-stable on its own props, so a `now` change
  re-renders only the header strip. If profiling shows churn, the chip can own
  its own interval — but start with the dock owning it for a single timer.
- **Existing dock tests** — adding two optional props with defaults is
  backward-compatible; the existing `ArgumentComposerDock` test suite should
  stay green untouched. If any existing test does an exact-snapshot of the
  header strip, it may need a one-line update — flag it, do not delete it.
- **No new dependency** — confirmed achievable: `View`, `Text`, RN
  `setInterval` (global), `Date.now()`. No timer library, no date library.
  `formatCountdown` is ~15 lines of pure arithmetic.
- **Scope creep toward `PreSendReviewSheet`** — the implementer must NOT create
  that file. If the temptation arises, re-read the "Scope-conflict findings"
  section: it is RULE-004's deliverable.

---

## Out of scope

Explicitly **not** in GAME-002 — do not build these here:

- Any DB migration, table, RLS policy, or Edge Function. Pacing is in-memory.
- Persistence of pacing state across app restarts (issue non-scope; a later
  card).
- Creating or modifying `PreSendReviewSheet` (RULE-004 owns it; it does not
  exist yet). GAME-002 only exports the `describePermanentRecord` helper.
- GAME-003 mode templates and the non-casual `PacingRule` instances. GAME-002
  ships only `DEFAULT_CASUAL_PACING_RULE` + `createPacingRule`.
- Applying `weightedByCooldown` to actual point standing / `argumentScoreModel`
  / `antiAmplification`. GAME-002 carries the flag as data and exposes it; the
  scoring wiring is GAME-003 + a point-standing change.
- A room-setup screen showing the rule summary to both parties. The issue's
  scope item 4 mentions it; with no GAME-003 mode picker and no non-casual
  rules to summarize, there is nothing to render in v1. The `PacingRule` shape
  is the contract that screen will read later. (If the coordinator wants a
  stub summary surface, that is a follow-up — not buildable inside this card's
  3-file footprint.)
- Push notifications for "your turn" (issue non-scope; v2).
- Real-time presence indicators (issue non-scope).
- Any disabling of the composer / Post button. The composer's submit and
  save-draft paths are untouched.

---

## Doctrine self-check

- **cdiscourse-doctrine — no truth labels:** the feature emits no verdict /
  person token in any string. `pacingCopyBanList.test.ts` enforces it across
  every produced string, and the ban-list is extended with punitive-sounding
  words (`punish`, `penalty`, `banned`, `blocked`, `locked out`) because
  doctrine says pacing copy is "never threatening". ✔
- **cdiscourse-doctrine — score never blocks posting; validation can:** pacing
  is **neither** score **nor** validation. It is a consented mode rule. The
  model exposes `canSendNow` as advisory chip-tone metadata only — it has no
  "disable submit" output, and `ArgumentComposerDock` never disables the
  composer or the Post button. `pacingNoHiddenBlock.test.ts` proves the model
  cannot block. Save-draft is always available (issue scope item 4). ✔
- **cdiscourse-doctrine — no service-role, no AI call, no `.env`:** pure-TS
  model + presentational RN component + one optional-prop addition to an
  existing component. Nothing touches Supabase, Anthropic, xAI, secrets, or
  `.env`. ✔
- **cdiscourse-doctrine — plain language / no internal codes:** `PacingBlockReason`
  is an internal enum; it never reaches a user-facing string. All chip copy is
  built in `buildPacingChipViewModel` as plain language; the ban-list test
  asserts no snake_case leak. ✔
- **cdiscourse-doctrine — pacing is never hidden punishment:** the chip *always*
  shows remaining moves and time-to-next; any block has a plain-language reason;
  the rule is mode-level and consented at room setup. Casual default has no
  pacing at all. ✔
- **point-standing-economy — heat / score do not influence pacing and pacing
  does not silently influence standing:** `PacingEvaluationInput` has no heat,
  no score, no strength-band field by construction. `weightedByCooldown` is
  carried as data but **not applied** to standing in this card (that wiring is
  GAME-003 + a point-standing change, in "Out of scope"). The anti-amplification
  gate is untouched. The "concession is never inferred from silence" rule is
  respected: an expired response window produces an *advisory* — it never
  auto-concedes the user. ✔
- **expo-rn-patterns — no new dependency, RN primitives only:** chip is `View`
  + `Text`; timer is the RN/JS global `setInterval`; `formatCountdown` is pure
  arithmetic. No date/timer/icon library. Model file is pure TS with no React
  or Supabase import (`*Model.ts` convention). ✔
- **accessibility-targets — screen-reader + 44px + color independence:** the
  chip is a **non-interactive status display** (`accessibilityRole="text"`,
  `accessibilityLiveRegion="polite"`, full `accessibilityLabel`), so the 44×44
  *tap-target* rule does not apply (nothing to tap) — this is called out so a
  reviewer does not flag a "missing hit target". If a later card makes the chip
  interactive it must add a 44px target. A non-color glyph (`⏳` / `•`) carries
  meaning so the chip is legible in grayscale. The countdown keeps ticking
  under reduce-motion because it is information, not motion. ✔
- **test-discipline — tests are part of done:** all three named test files plus
  full pure-model coverage are specified above; no `.skip`/`.only`; test count
  goes up. ✔

---

## Operator steps (if any)

None — pure code change. No migration to push, no Edge Function to deploy, no
env var to set. The implementer commits the three new files and the one
modified file; `npm run typecheck`, `npm run lint`, `npm run test` must pass
before the card is claimed done.
