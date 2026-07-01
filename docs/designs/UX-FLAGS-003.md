# UX-FLAGS-003 — Feedback flag priority + suppression cap

Card: #835 (PRODUCT-REDIRECT-001 roadmap, epic #826)
Depends on: #850 / UX-FLAGS-001 (descriptor layer), #851 / UX-FLAGS-002 (point-level adapter + row)
Status: LOCKED design, implemented.

## Goal

With many machine observations resident on a single point, something must
choose the 1–3 feedback flags to surface and quietly suppress the rest. This
card adds the deterministic **display budget** that sits downstream of the #851
adapter: it takes the adapter's uncapped, input-ordered view models and returns
a small priority-ordered slice (length <= 3) plus a suppressed count, then wires
that into the one `ArgumentGameSurface` render site.

Priority is an internal display budget only. It is NEVER surfaced to the user as
importance, severity, score, or rank.

## Data model (no DB)

New pure interface in `src/features/feedbackFlags/feedbackFlagPriority.ts`:

```ts
export interface PrioritizedPointFeedbackFlags {
  visible: ReadonlyArray<PointFeedbackFlagViewModel>; // priority order, length <= cap, frozen, same refs
  suppressedCount: number;                            // max(0, inputLength - visible.length)
}
```

No migration, no new column, no persisted state. Everything is derived
POST-STORAGE from the view models the #851 adapter already produced.

## Tier mapping + comparator

Tier key = the view model's `tone` ONLY. The #851 `PointFeedbackFlagViewModel`
does not carry `actionable`, and the shipped #850 descriptor table makes `tone`
a faithful proxy: every named positive example is `actionable:false`, every
prompt descriptor is `actionable:true`, and no prompt is `actionable:false`. So
re-threading `actionable` is unnecessary and out of scope.

```
TIER_RANK: positive = 0, prompt = 1, descriptive = 2
UNKNOWN_TONE_RANK = 3   // defensive; a malformed tone sorts last, never throws

compare(a, b):
  ra = TIER_RANK[a.tone] ?? 3
  rb = TIER_RANK[b.tone] ?? 3
  if ra !== rb: return ra - rb
  return a.__inputIndex - b.__inputIndex   // stable tie-break by ORIGINAL input order
```

Ties break by original input index — never by id, label, or family. Implemented
via an index-decorated sort (`map(vm, i) → {vm, i}`, sort, read `.vm`) so engine
sort-stability is never relied upon. This mirrors the SELECTION DISCIPLINE of
`refereeBanners/selectBanner.ts` (fixed priority constant, stable tie-break by
input/pool order, suppress-the-rest) — not its code.

## Module

`src/features/feedbackFlags/feedbackFlagPriority.ts` (pure TS, frozen output,
deterministic, no verdict tokens, authors no strings):

```ts
export const DEFAULT_VISIBLE_FLAG_CAP = 3;
export const MIN_VISIBLE_FLAG_CAP = 1;

export function resolveVisibleFlagCap(cap?: number): number;
//   undefined / NaN / non-finite -> 3
//   else Math.min(3, Math.max(1, Math.floor(cap)))
//   never resolves above 3 — there is no uncapped render path.

export function prioritizePointFeedbackFlags(
  flags: ReadonlyArray<PointFeedbackFlagViewModel> | null | undefined,
  cap?: number,
): PrioritizedPointFeedbackFlags;
//   null / non-array / empty -> { visible: [], suppressedCount: 0 }
//   else sort by tier then input index, slice to resolved cap, freeze.
//   surviving elements are the SAME references from input (no copy / mutate).
```

Exported from the `src/features/feedbackFlags` barrel.

## Seam edit (ArgumentGameSurface)

Single memo neighborhood + single render site.

1. Import: `import { prioritizePointFeedbackFlags } from '../feedbackFlags/feedbackFlagPriority';`
   alongside the existing `{ buildPointFeedbackFlags, PointFeedbackFlagsRow }`
   barrel import.
2. The `activePointFeedbackFlags` memo now returns the prioritized OBJECT: it
   keeps the existing `buildPointFeedbackFlags(rows, { isOwnPoint })` call as
   input, then `return prioritizePointFeedbackFlags(built)` (default cap 3). The
   no-`activeMessageId` branch returns `prioritizePointFeedbackFlags([])`. The
   comment block is updated to say the cap now lands here (#835).
3. Render: `<PointFeedbackFlagsRow flags={activePointFeedbackFlags.visible}
   suppressedCount={activePointFeedbackFlags.suppressedCount} />`.

Seam chain: **#851 adapter (no cap) → #835 module (cap) → Row.visible**. The
#851 adapter file is UNTOUCHED, so its "NO cap length 5 not sliced" test stays
valid. The memo is now object-shaped, not array-shaped; only the render site
consumes it (verified by grep).

## +N more — DECISION = YES

Trivial, non-interactive. `PointFeedbackFlagsRowProps` gains
`suppressedCount?: number` (default 0). When `suppressedCount > 0` AND
`flags.length > 0`, the row renders a single quiet `<Text>` after the pill row:

- Copy: `+{N} more` (e.g. `+2 more`).
- a11y: `${N} more on this point`.
- `accessibilityRole="text"`, `testID="point-feedback-flags-more"`.
- NOT a Pressable, no `onPress`, reveals nothing.
- Styled `SURFACE_TOKENS.textSecondary` at `TYPOGRAPHY.chipLabel` size — a quiet
  footnote count, not a CTA. No severity / importance / priority / score framing.

The row still returns `null` on an empty flag list regardless of
`suppressedCount`.

## API / interface contracts

- `prioritizePointFeedbackFlags` and `resolveVisibleFlagCap` are pure and
  deterministic: same input → deeply-equal output. No clock, no randomness, no
  network, no React.
- `visible` is frozen; the result object is frozen; the surviving VMs are the
  same references from the input (no copy, no relabel).
- The module originates no user-facing strings — it only reorders / slices.

## Edge cases

- Empty / null / undefined input → `{ visible: [], suppressedCount: 0 }`.
- Malformed tone → sorts last (rank 3); never throws.
- `cap` of 0 / negative / NaN / Infinity → clamped into `[1, 3]`.
- Doctrine: no verdict/moralized token in any new string; the only new copy is
  `+N more` and its a11y label, both plain and calm.
- Composer-safety invariant: composer-time (pre-send) nudges are separate and
  excluded entirely upstream — Family J never reaches this POST-STORAGE display
  layer — so capping the display list can never hide a safety-relevant pre-send
  nudge. This is a documented invariant, not new code.

## Test plan

New `__tests__/feedbackFlagPriority.test.ts`:
- Tier ordering (mixed → positive, positive, prompt, descriptive; two positives
  keep relative input order); unknown tone sorts last.
- Hard cap default (5 → 3 visible, suppressedCount 2); under cap; exactly cap.
- `resolveVisibleFlagCap` + end-to-end clamp table (0→1, -4→1, 9→3, 2→2, 2.7→2,
  NaN→3, undefined→3; never above 3).
- Determinism (same input twice → deeply equal); tie-break stability proof.
- Empty / null / undefined → empty result; `Object.isFrozen(visible)`; surviving
  VMs are same frozen references; `neverGrantsStanding` passthrough.
- Module originates no user-facing strings (string fields byte-identical to
  input).

Extend `__tests__/PointFeedbackFlagsRow.test.tsx` (additive):
- Renders `+2 more` when `suppressedCount=2` and flags non-empty; a11y
  `2 more on this point`; non-interactive (role=text, no onPress); NOT rendered
  when 0 / omitted; returns null on empty flags even when `suppressedCount>0`;
  ban-list (reuse `_forbiddenVerdictTokens()` + local `importance|severity|score|priority`).

Regression re-runs (fix only what the cap legitimately changes):
- `__tests__/pointFeedbackFlagsModel.test.ts` — the "NO cap length 5 not sliced"
  test still passes (adapter pinned; cap lives downstream). No change needed.
- `__tests__/ArgumentGameSurface.integration.test.tsx` — no reference to the
  flags row; object-shape change is invisible to it. No change needed.

## Dependencies

- #850 `friendlyFlagMap.ts` — `FriendlyFlagTone` union + `_forbiddenVerdictTokens()`.
- #851 `pointFeedbackFlagsModel.ts` — `PointFeedbackFlagViewModel` input type.
- `refereeBanners/selectBanner.ts` — selection DISCIPLINE pattern (not code).
- `src/lib/designTokens` — `SURFACE_TOKENS.textSecondary`, `TYPOGRAPHY.chipLabel`.

## Risks

- Object-shape change to `activePointFeedbackFlags` could break another consumer.
  Mitigated: grep confirmed only the ~2405 render site reads the memo.
- Cap could be bypassed into an uncapped default. Mitigated:
  `resolveVisibleFlagCap` never resolves above 3, and the memo always routes
  through the module (no direct array render path).

## Out of scope

No new UI surfaces, no composer intents/actions, no Evidence Echoes/Lore/Reels,
no expansion interaction on "+N more", no changes to `friendlyFlagMap.ts`
descriptor content or the #851 adapter's suppression semantics (J /
clientSuppressed / own-bubble stay where they are), no Edge / mcp-server /
migration / config / validator / ban-list / familyRegistry / prompt change, no
provider spend, no new dependencies. `docs/core/current-status.md` is NOT touched
in this card (parallel-merge conflict avoidance).

## Doctrine self-check

- §1 Score is gameplay analysis, never truth — PASS. Priority is an internal
  display budget; no verdict/truth token in any new string; no ranking language
  surfaced.
- §3 Popularity is not evidence — PASS. `neverGrantsStanding` passed through
  untouched; module never converts anything into standing/credit.
- §9 Plain language — PASS. Only new copy is `+N more`; no internal code leaks.
- §10a Observations vs Allegations — PASS. Module only reorders/slices existing
  machine-observation view models; adds no label, changes no source semantics.
- Composer-safety invariant — PASS (documented above; Family J excluded upstream).
- test-discipline — PASS. New pure-model file has full unit coverage incl.
  failure cases; Row extension is additive; ban-list test present.

## Operator steps

None — pure code change. No migration, no Edge Function, no deploy, no provider
spend, no env var.
