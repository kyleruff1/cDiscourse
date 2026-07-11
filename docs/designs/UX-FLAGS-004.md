# UX-FLAGS-004 — Feedback flag composer intents

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP) — Feedback flags · Milestone M-ASP-7
**Release:** M-ASP-7
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/836
**Base:** `1d99953f` (main — includes the quote/callback pair #906) · worktree `wt-flags-004` · branch `feat/ux-flags-004-intents`
**Design intent (authoritative):** `docs/designs/PRODUCT-REDIRECT-RECORDED-WIT-PRIVATE-MEMORY-2026-06-28.md` §6 "How flags prefill composer intents" + §7 "Feedback flags driven by MCP family groups"; Design Pass §9 "Boolean MCP feedback".

---

## Goal (one paragraph)

A friendly feedback flag on a point should be **one-tap actionable**: tapping "Needs a receipt" opens the composer already pre-typed to the matching intent (ask-for-source), reusing the shipped `sourceChainPresetCopy` / `quickActionToPreset` preset lane (§6.224). The friendly-flag descriptors shipped in UX-FLAGS-001 (#833) already declare `actionable: boolean` + `composerIntent: string | null` per flag — this card builds the **bridge from that abstract intent code to a concrete composer preset dispatch**, wires the pill tap through the **exact** shipped reply-with-preset path (`handleAction('reply', messageId, preset)` → the dock's `initialPatch`), and adds the actor/own-bubble/observer gating that keeps the surface calm and doctrine-clean. The card ships behind a new default-OFF flag so the (already-live, currently read-only) pills stay byte-identical until the operator rolls tappability out. Doctrine that shapes the design: cdiscourse-doctrine §1 (the flag is advisory, never a verdict; the prefill is the **user's** move, never a claim that the machine flag is authoritative), §10a (machine label = Observation, not Allegation), §3 (Family D flags carry `neverGrantsStanding` and the prefill uses source/receipt language, never "proof"), and the Design Pass §9 rule that machine feedback stays "un-game-like" (calm, optional, nothing required to post).

---

## Scope-reality audit (read this first — it reshapes the card)

This card is orchestrator-adjacent and its brief line ("composer intent wiring — `ArgumentGameSurface.tsx handleAction`") plus the 2026-07-08 re-scope ("the mount point retargets to the one-bar composer (ROOM-003)") both make load-bearing assumptions about where a seeded body lands. Per the POSTRUN-UX001 scope-reality rule I audited the actual chain before designing.

**What is actually there:**

1. **The intent map already half-exists.** `src/features/feedbackFlags/friendlyFlagMap.ts` (UX-FLAGS-001 #833) already carries `actionable: boolean` and `composerIntent: string | null` on every `FriendlyFlag`. Seven flags are `actionable:true` today, mapping to **five** distinct intent codes:
   | Flag key | Family | `composerIntent` | `ownBubbleSuppressed` |
   |---|---|---|---|
   | `needs_a_receipt` | D evidence | `ask_for_source` | false |
   | `open_receipt` | D evidence | `ask_for_source` | false |
   | `complete_the_chain` | D evidence | `ask_for_source` | false |
   | `asks_for_clarification` | C repair | `ask_clarify` | false |
   | `unanswered_question` | F critical_question | `answer_question` | false |
   | `synthesis_on_the_table` | G resolution | `propose_synthesis` | false |
   | `could_be_more_specific` | H claim_clarity | `sharpen_claim` | **true** |

2. **The pills are shipped LIVE but non-interactive.** `PointFeedbackFlagPill.tsx` (UX-FLAGS-002 #834) renders a `<View accessibilityRole="text">` with **no `onPress`**. `PointFeedbackFlagsModel`'s view model **deliberately drops** `composerIntent`/`actionable` ("intentionally NOT carried — no composer wiring"). So the descriptor *knows* the intent; the VM currently forgets it.

3. **The row mounts on the ACTIVE node in three places.** `ArgumentRoom.tsx:3018` (Timeline mode, col2), `RingsideCard.tsx:284` (Exchange lens, `card.isActive` only), `CardDetailPanel.tsx:1177` (legacy Cards surface). The first two are the ROOM-003 A×B pair (Exchange + Map/Timeline); both scope the row to `activeMessageId`.

4. **The shipped preset lane seeds the DOCK, not the one-bar composer.** The reply-with-preset dispatch is:
   `ArgumentRoom.handleAction(control, msgId, preset)` → `onAction?.(...)` → `ArgumentTreeScreen.handleAction` (its `explicitPreset` branch, `ArgumentTreeScreen.tsx:617-631`) → `onComposerPreset(preset)` **+** `onReply(msgId, arg)` → `App.tsx` `setComposerPreset(preset)` + open composer → **`ArgumentComposerDock.initialPatch={composerPreset}`** (`App.tsx:1485`) → `ArgumentComposer.handleMovePatch` writes `patch.body` into the draft (`ArgumentComposer.tsx:205-211`). This is the **same** lane the side-action rail's `ask_for_source`, the SC-004 dock (`narrow`/`confirm`/`synthesize`), and the RULE-002 validation chip already use.
   **The ROOM-003 one-bar `ArgumentEntryComposer` does NOT consume a seeded body** — it takes no `initialPatch`, seeds its draft only from `useArgumentComposer(debate.id, selectedParentId)`, and routes its Source/More affordances to the shipped dock via `handleComposerExpand` (`App.tsx:1491-1524`, comment: "Its Source + More affordances open the SAME shipped dock above").

**The reconciliation (interpretation of "retargets to the one-bar composer"):** In ROOM-003 the one-bar bar is the *fast blank-reply* surface; anything that needs a **seeded body or structure** (source, quote, callback, proof, and now a flag intent) **already escalates to the shipped dock**. Therefore "the flag intent enters the ROOM-003 compose flow" is delivered by routing the tap through the existing `explicitPreset` lane so the **shipped dock opens pre-typed** — exactly as the one-bar's own Source slot does. This needs **zero composer edits and zero pinned-file edits**. Making the seeded text appear **inside the one-bar text field itself** (rather than the escalated dock) is a *different, larger* change (edit `ArgumentEntryComposer` + `useArgumentComposer` to accept and apply an initial seed) — specified as optional **Path B** below and flagged for an operator ruling.

**Recommended scope correction:** ship **Path A** (route through the shipped dock lane; the one-bar's Source-slot pattern). It reuses the preset mechanism verbatim, keeps every pinned composer byte-identical, and is consistent with ROOM-003's own escalation model. Effort stays `effort:m`. **Open the "which composer shows the seed" question to the operator** (Gaps §1) — if the operator wants the one-bar field itself pre-typed, add Path B (+1 non-pinned composer file, +~30 lines, +a draft-seed test).

---

## Data model

**No new table, no new column, no migration, no Edge Function.** This card is a pure map module + view wiring + one feature-flag literal. It reads the already-persisted machine-observation rows (`persistedObservationsByArgumentId`) exactly as UX-FLAGS-002 does; it writes nothing new. The composer preset it produces is the existing `MoveDraftPatch` type (`src/features/arguments/conversationMoves.ts`).

### New TypeScript surface (the bridge)

```ts
// src/features/feedbackFlags/flagComposerIntentMap.ts

import type { FriendlyFlag, FriendlyFlagKey } from './friendlyFlagMap';
import type { QuickActionLabel } from '../arguments/quickActionPresets';

/**
 * The closed set of abstract composer-intent codes a FriendlyFlag may carry.
 * MUST equal exactly the set of non-null `composerIntent` values present in
 * FRIENDLY_FLAG_DESCRIPTORS (enforced by the cross-coverage manifest test —
 * flagComposerIntentMap.test.ts — so the two never drift). Never user-facing.
 */
export type ComposerIntentCode =
  | 'ask_for_source'
  | 'ask_clarify'
  | 'answer_question'
  | 'propose_synthesis'
  | 'sharpen_claim';

/**
 * Abstract intent → the shipped QuickActionLabel whose quickActionToPreset(...)
 * produces the seeded MoveDraftPatch. `ask_for_source` / `propose_synthesis`
 * REUSE existing labels (source / synthesize) so their preset bodies
 * (ASK_SOURCE_PRESET_BODY / SYNTHESIZE_PRESET_BODY) are not re-authored. The
 * other three point at labels this card adds to quickActionPresets.ts.
 */
export const FLAG_INTENT_TO_QUICK_ACTION: Readonly<Record<ComposerIntentCode, QuickActionLabel>> =
  Object.freeze({
    ask_for_source: 'source',
    ask_clarify: 'ask_clarify',
    answer_question: 'answer_question',
    propose_synthesis: 'synthesize',
    sharpen_claim: 'sharpen_claim',
  });

export interface ResolvedFlagIntent {
  intent: ComposerIntentCode;
  quickAction: QuickActionLabel;
}

/** True iff `value` is a known ComposerIntentCode (defensive; never throws). */
export function isComposerIntentCode(value: unknown): value is ComposerIntentCode;

/**
 * Resolve a descriptor to its concrete composer dispatch, or null when the flag
 * is not actionable / carries no known intent. DERIVES actionability from the
 * #833 descriptor (`flag.actionable` + `flag.composerIntent`) — this module
 * NEVER re-declares which flags are actionable (single source of truth = #833).
 */
export function resolveFlagComposerIntent(flag: FriendlyFlag): ResolvedFlagIntent | null;

/** Convenience for the pill, which only holds the VM id (= FriendlyFlagKey). */
export function flagIntentForKey(key: FriendlyFlagKey | string): ResolvedFlagIntent | null;
```

`resolveFlagComposerIntent` returns `null` when `flag.actionable !== true`, `flag.composerIntent == null`, or `!isComposerIntentCode(flag.composerIntent)`. `flagIntentForKey(key)` looks up `FRIENDLY_FLAG_DESCRIPTORS[key]` and delegates.

### New preset bodies (inline in `quickActionPresets.ts`, mirroring the SC-004 precedent)

`ask_for_source` and `propose_synthesis` reuse the **already-shipped, already-ban-listed** bodies (`ASK_SOURCE_PRESET_BODY`, `SYNTHESIZE_PRESET_BODY`). Three new bodies are added for the intents that lack a seeded label today (§Decision 3 for exact copy).

---

## File changes

**New (1):**
- `src/features/feedbackFlags/flagComposerIntentMap.ts` — the bridge above. Pure TS, no React, no Supabase, no network, deterministic. **~95 lines.**

**Modified (8):**
- `src/features/arguments/quickActionPresets.ts` *(NOT pinned)* — add 3 `QuickActionLabel` union members (`ask_clarify`, `answer_question`, `sharpen_claim`); add 3 frozen inline bodies + `ALL_FLAG_INTENT_PRESET_BODIES` (mirrors `ALL_SC004_PRESET_BODIES`); add 3 `switch` cases. Purely additive — every existing case is byte-identical; the existing `default: return null` already tolerates the wider union. **~+40 lines.**
- `src/features/feedbackFlags/PointFeedbackFlagPill.tsx` *(NOT pinned)* — add optional `onPress?: (flagKey: string) => void` + `actionable?: boolean` props. When **both** are present render a `<Pressable accessibilityRole="button">` (hitSlop → 44×44, web focus ring, `accessibilityHint`); otherwise render **today's** `<View accessibilityRole="text">` **byte-identical**. **~+40 lines.**
- `src/features/feedbackFlags/PointFeedbackFlagsRow.tsx` *(NOT pinned)* — add optional `onFlagIntent?: (flagKey: string) => void`. When present, per pill compute `flagIntentForKey(flag.id) != null` and pass `onPress`/`actionable`; when absent, pills render exactly as today (the "why?" toggle path is untouched). **~+15 lines.**
- `src/features/feedbackFlags/index.ts` — `export * from './flagComposerIntentMap';`. **~+1 line.**
- `src/features/arguments/room/ArgumentRoom.tsx` *(NOT pinned)* — add `feedbackFlagIntentsEnabled` prop; add `handleFlagIntent(flagKey)` = `resolveFlagComposerIntent` → `quickActionToPreset(quickAction, activeParentType)` → `handleAction('reply', activeMessageId, preset)` (reuse/extract the existing `enterBoxForActEntry` tail as `enterBoxForQuickAction`); pass `onFlagIntent` to the Timeline `PointFeedbackFlagsRow` (line 3018) and thread it to the Ringside render (line 2880) **only when** `feedbackFlagIntentsEnabled && seatCanPost(participantSide) && activeViewModel?.actor !== 'self'`. **~+30 lines.**
- `src/features/arguments/room/RingsideCard.tsx` *(NOT pinned)* — add optional `onFlagIntent?` to `RingsideCardProps`; pass it to the active card's `PointFeedbackFlagsRow` gated by the existing `card.isActive && !card.isOwn && card.actionRow.kind === 'participant'` signal (parity with the FEEDBACK-001 ghost-bar gate two lines below). **~+12 lines.**
- `src/lib/featureFlags.ts` *(NOT pinned)* — add `FEEDBACK_FLAG_INTENTS_FLAG = 'EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS' as const` + `isFeedbackFlagIntentsEnabled()` (STATIC `process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS` dot read, #776). The 10th flag. **~+12 lines.**
- `App.tsx` *(NOT pinned)* — read the accessor once; prop-thread `feedbackFlagIntentsEnabled` down the existing `moveMarksEnabled`-style chain to `ArgumentRoom`; add the **seed-if-empty** preset-body guard at the `onComposerPreset` seam (Decision 8). **~+8 lines** (+ ~2 per pass-through hop in `ArgumentTreeScreen.tsx` / `ArgumentGameSurface.tsx`, mirroring `moveMarksEnabled`).

**Deleted:** none.

**Explicitly NOT touched (pinned / byte-identical):** `ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `composer/*` (incl. `ArgumentEntryComposer.tsx`\*, `useEntryComposerSubmit.ts`, `composerDraftRegistry.ts`), `oneBox/OneBox.tsx`, `oneBox/{Act,Go,Popout}.tsx`, `friendlyFlagMap.ts`, `pointFeedbackFlagsModel.ts`, `feedbackFlagPriority.ts`, `supabase/functions/submit-argument/`.
\* `ArgumentEntryComposer.tsx` / `useArgumentComposer.ts` are **not** in the pinned set, but Path A does not edit them; only Path B (deferred) would.

---

## API / interface contracts

### `flagComposerIntentMap.ts` (see Data model for signatures)

- `resolveFlagComposerIntent(flag)` → `ResolvedFlagIntent | null`. Null unless `flag.actionable === true && isComposerIntentCode(flag.composerIntent)`.
- `flagIntentForKey(key)` → `ResolvedFlagIntent | null`.
- `FLAG_INTENT_TO_QUICK_ACTION` — total over `ComposerIntentCode`.

### `quickActionPresets.ts` additions

```ts
export type QuickActionLabel =
  | /* …existing… */
  | 'ask_clarify'      // Family C — asks the author to pin a term/reference down
  | 'answer_question'  // Family F — answer an open critical question (type free)
  | 'sharpen_claim';   // Family H — ask the author to narrow/specify (own-bubble suppressed upstream)

// quickActionToPreset(action, parentType) new cases:
case 'ask_clarify':
  return { argumentType: 'clarification_request', body: ASK_CLARIFY_PRESET_BODY };
case 'answer_question':
  return { body: ANSWER_QUESTION_PRESET_BODY }; // body-only: user keeps type freedom
case 'sharpen_claim':
  return { argumentType: 'clarification_request', body: SHARPEN_CLAIM_PRESET_BODY };
```

### `PointFeedbackFlagPill` props

```ts
export interface PointFeedbackFlagPillProps {
  flag: PointFeedbackFlagViewModel;
  /** UX-FLAGS-004 — present only when the parent authorizes an actionable pill. */
  onPress?: (flagKey: string) => void;
  /** UX-FLAGS-004 — true iff flagIntentForKey(flag.id) != null (parent-computed). */
  actionable?: boolean;
  testID?: string;
}
```
Render contract: **button** iff `typeof onPress === 'function' && actionable === true`; otherwise the shipped inert `text` view, unchanged. A button never announces without a resolvable intent (`actionable` gates it), so a non-actionable pill never becomes a button even if a stray `onPress` is passed.

### `PointFeedbackFlagsRow` props

```ts
onFlagIntent?: (flagKey: string) => void; // present ⇒ actionable pills; absent ⇒ inert (today)
```

### `ArgumentRoom` — dispatch (reuses the shipped tail)

```ts
// Extract the enterBoxForActEntry tail so both callers share ONE path:
const enterBoxForQuickAction = useCallback(
  (quickAction: QuickActionLabel, messageId: string, parentType: ArgumentType | null) => {
    const preset = quickActionToPreset(quickAction, parentType);
    handleAction('reply', messageId, preset);
  }, [handleAction]);

const handleFlagIntent = useCallback((flagKey: string) => {
  if (!activeMessageId) return;
  const resolved = flagIntentForKey(flagKey);
  if (!resolved) return; // non-actionable / unknown ⇒ no-op
  enterBoxForQuickAction(resolved.quickAction, activeMessageId, activeParentType);
}, [activeMessageId, activeParentType, enterBoxForQuickAction]);
```
`onFlagIntent={handleFlagIntent}` is passed to the flag row/Ringside **only** when the actor gate (Decision 6) and the feature flag are satisfied; otherwise `undefined` ⇒ inert pills ⇒ byte-identical.

### `featureFlags.ts`

```ts
export const FEEDBACK_FLAG_INTENTS_FLAG = 'EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS' as const;
/** Default OFF. True only when EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS === 'true'. */
export function isFeedbackFlagIntentsEnabled(): boolean {
  const fromEnv = process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS; // STATIC dot access REQUIRED (#776)
  return fromEnv === 'true';
}
```

---

## Decisions (the eight the brief asks for)

### 1. The intent map — two layers, single source of truth, no drift

- **Layer 1 (existing, `friendlyFlagMap.ts` — untouched):** each `FriendlyFlag` already declares `actionable` + `composerIntent`. This is the authority for *which* flags are actionable and *what abstract intent* they carry.
- **Layer 2 (new, `flagComposerIntentMap.ts`):** maps the abstract `composerIntent` code → `{quickAction}` (the shipped preset producer to reuse) and, via `resolveFlagComposerIntent`, **derives** actionability straight from Layer 1 (never re-declares it). Target scoping is a constant: the reply targets the **flagged move = the active node** (both mounts render on `activeMessageId`).
- **Non-actionable flags stay inert:** `resolveFlagComposerIntent` returns `null` for every `actionable:false` descriptor (all of A-relations, B-axes, E-schemes, most of C/G descriptives, I-topology), so the pill never becomes a button.
- **Suppression is respected structurally:** `feedbackFlagPriority` already caps the rendered set to `visible` (≤3); a flag suppressed by the cap is not rendered and therefore cannot fire. Own-bubble/`clientSuppressed`/Family-J suppression is applied **upstream** in `buildPointFeedbackFlags` before the row ever sees a flag. The intent map adds no way to reach a suppressed flag.

### 2. Tap wiring — reuse the shipped lane, no new dispatch machinery

`PointFeedbackFlagPill.onPress(flag.id)` → `PointFeedbackFlagsRow.onFlagIntent(flag.id)` → `ArgumentRoom.handleFlagIntent(flag.id)` → `flagIntentForKey` → `enterBoxForQuickAction(quickAction, activeMessageId, activeParentType)` → **the existing** `handleAction('reply', activeMessageId, quickActionToPreset(...))` → `onAction` → `ArgumentTreeScreen.handleAction` `explicitPreset` branch → `onComposerPreset` + `onReply` → `App` `composerPreset` → **`ArgumentComposerDock.initialPatch`** → `ArgumentComposer.handleMovePatch` applies `body`. This is the identical path the side-action rail's `ask_for_source`, the SC-004 dock, and the RULE-002 validation chip already travel — proven by `sourceChainPresetWiring.test.ts` + the SC-004 tests. The reply is scoped to the flagged move because `handleAction` receives `activeMessageId`.

### 3. Pre-typed text — exact copy, doctrine-clean, advisory, editable, never auto-submits

The prefill is the **user's** draft body (they edit or clear it before posting); it never asserts the machine flag is authoritative and never blocks posting (the engine gate is unchanged). Copy uses source/receipt vocabulary — never "proof" as a box token — first person, bracketed placeholders (EV-002 / SC-004 precedent):

| Intent | Body source | Exact copy |
|---|---|---|
| `ask_for_source` | **reuse** `ASK_SOURCE_PRESET_BODY` | "Could you point to the source you're working from here? A link, citation, or quoted excerpt would help me follow the trail." |
| `propose_synthesis` | **reuse** `SYNTHESIZE_PRESET_BODY` | "Synthesis: where I think we landed is — [shared point]. Open questions still on the table: [list]." |
| `ask_clarify` | **new** `ASK_CLARIFY_PRESET_BODY` | "Which part would you pin down for me? I want to make sure I'm answering what you actually mean by [term]." |
| `answer_question` | **new** `ANSWER_QUESTION_PRESET_BODY` | "Here's my answer to the open question: [your answer]. If I've missed what you were asking, tell me where." |
| `sharpen_claim` | **new** `SHARPEN_CLAIM_PRESET_BODY` | "Could you make this more specific? Narrowing it to [the exact case] would help me engage the specific point." |

All five pass the `friendlyFlagMapBanList` `BANNED_TOKENS` scan and `looksLikeInternalCode` (no snake_case, no verdict/truth/popularity token, no "proof"). The three new bodies are pinned by a new ban-list test (Test plan).

### 4. Flag posture — **recommend a new 10th default-OFF flag** `EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS`

The pills are already **live** (UX-FLAGS-002 shipped). Making them **tappable** is net-new user-visible behavior. The house precedent is ironclad — every new user-visible behavior in this program got its own default-OFF flag: `proof_drawer`, `timestamp_rebuttals`, `move_marks` (with a 10%-cohort rollout note), `derived_signals`, `quote_forge`. Weighing the options:

- **(a) New 10th flag — RECOMMENDED.** Independent kill switch + cohort rollout (like move_marks); flag-off ⇒ `onFlagIntent` is `undefined` everywhere ⇒ pills render exactly as today (byte-identical). `App.tsx` is the **sole importer** (zero `featureFlags` imports under `src/features`, the QUOTE-FORGE-002 R4 pattern); `feedbackFlagIntentsEnabled` is prop-threaded. Cost: flag #10.
- **(b) Ride `room_exchange_v2` (LIVE) — REJECT.** It ships next push, so tappability would go live with **no** independent kill switch; and the Timeline flag row renders **regardless** of `room_exchange_v2` (it is unconditional in the `mode==='timeline'` block), so gating on it would leave Timeline tappability semantically mis-coupled to an Exchange-surface flag.
- **(c) Ride `derived_signals` (OFF) — REJECT.** That flag governs the P7 intel advisory lines — a different feature. Overloading it couples two unrelated rollouts and muddies the kill-switch story.

### 5. Accessibility

- **Actionable pill** → `<Pressable accessibilityRole="button">`, `accessibilityLabel` = the VM's existing spoken label (tone-word + label + Family-D "receipt or source help"), `accessibilityHint` naming the **result** (e.g. "Opens a reply pre-filled to ask for a source."), `hitSlop={TOUCH_TARGET.hitSlopAll}` to clear 44×44 (the visual stays chip-sized), and the same web focus-ring pattern the row's "why?" toggle uses (`Platform.OS==='web' && state.focused → focus border`). Reduce-motion: nothing to disable (static; the composer-open animation is the existing shipped path).
- **Non-actionable pill** → unchanged `<View accessibilityRole="text">` — it must **not** falsely announce as a button.
- **Calm, not a CTA (deliberate, §9 "un-game-like"):** the actionable pill keeps the **same** muted visual as the inert pill — no loud button chrome, no color-only signal. Actionability is carried by role + hint + hitSlop + focus ring, not by a new color. (Discoverability trade-off flagged in Gaps §3; a subtle color-independent `›` affordance is an operator opt-in, not shipped by default.)

### 6. Actor-awareness matrix

A flag intent opens a **reply** composer, so its actionability follows the **reply/rail** rules (own bubbles never expose reply-type controls — "Qualifiers · Request deletion only"), and mirrors the closest shipped sibling — the FEEDBACK-001 `BooleanFeedbackBar` (#898/#903): *participants only, hidden on own moves, disabled for observers*.

| Viewer | Own active move (`actor==='self'`) | Another's active move |
|---|---|---|
| **Seated participant / host** (`seatCanPost` = affirmative / negative / moderator-host) | pills **inert** (text) | actionable pills **fire the intent** |
| **Observer** (no seat) | pills **inert** | pills **inert** |

Plus: **flag OFF ⇒ inert everywhere** (byte-identical). Upstream, `buildPointFeedbackFlags` already dropped `ownBubbleSuppressed` flags on own moves (so `sharpen_claim` — the only actionable *and* own-bubble-suppressed flag — is already gone on your own move), plus all `clientSuppressed` / Family-J.

- **Gate signals:** `seatCanPost(participantSide)` (the same predicate `ArgumentEntryComposer` uses to decide post-vs-join) AND `activeViewModel?.actor !== 'self'`. Ringside reuses its per-card `card.isActive && !card.isOwn && card.actionRow.kind === 'participant'` (parity with the ghost-bar gate two lines below the flag row). **Capability parity (Output 6 rule):** both the Exchange (Ringside) and Map/Timeline lenses fire the **same** `handleFlagIntent` through the **same** `handleAction` — view is a lens, never a capability gate.
- **Observer rationale:** strict (no actionable pills) matches move_marks "participants only" and loses **no** capability — an observer who wants a source already has the rail's dedicated "Ask source" affordance; duplicating it on the pill would be redundant, not additive.
- **CardDetailPanel (legacy Cards surface):** stays **read-only** (no `onFlagIntent` passed) for v1 — it is outside the ROOM-003 Exchange/Map pair. Wiring it later is a one-line prop pass (Gaps §2).

### 7. Test plan (see full list below)

Real-derivation manifest + firing negative controls + ban-list + flag-off byte-identity + pinned zero-diff + a11y; **no wall-clock `toBeLessThan(ms)` assertions** anywhere (avoids the LIFE-001 / META-001 full-suite flake class).

### 8. Prefill collision with an in-progress draft — **rule: seed-if-empty (never clobber non-empty user text)**

The shipped dock (`ArgumentComposer.handleMovePatch`) **overwrites** the draft body when a preset carries one (`ArgumentComposer.tsx:209`). That is fine on a fresh/empty draft (the common case: composer closed, tap flag, dock opens seeded) but would destroy a heated in-progress reply if re-seeded onto the same target (reachable on wide viewports where the dock side-panel and the flag row are both visible).

- **Decision:** the flag intent seeds the body **only when the target's current draft body is empty/whitespace**. If the user already has non-empty text for that target, the composer still opens/scopes to the target but the seeded `body` is **dropped** (type/tag fields may still apply — they do not destroy typed prose).
- **Enforcement seam (non-pinned, no composer edit):** at the `onComposerPreset` dispatch that App owns, read the target's current draft body via the `composerDraftRegistry` getter (the registry file is **pinned — read-only; call its getter, do not edit it**) and, when non-empty, strip `preset.body` before `setComposerPreset`. Since this seam is shared by *all* seeded presets, the guard naturally generalizes (rail ask-source, Act, validation chip, flag) — a small consistency win, not a flag-only special case.
- **Justification:** Design Pass Principles 5/11 (the surface serves the user; nothing is required and nothing destroys their words) + doctrine §1 (advisory, never overrides the user). An advisory nudge must never delete a reply someone is mid-typing.
- **Fallback (if the registry read is impractical):** gate the actionable affordance so the intent only seeds when the composer is **closed for that target** (open-with-content ⇒ the tap just focuses the composer, no seed). Recommend the seam guard; the fallback is acceptable and equally non-clobbering.

---

## Edge cases

- **Empty flag list** → `PointFeedbackFlagsRow` already returns `null`; nothing renders; no intent path. Unchanged.
- **Non-actionable pill tapped path impossible** → non-actionable pills never receive `onPress`/`actionable` (parent computes `flagIntentForKey(id) === null`), so they stay `role="text"`. Firing negative control in tests.
- **`onFlagIntent` present but flag not actionable** (defensive) → pill still renders as text (its own `actionable` gate is false).
- **Flag capped out by priority** (`suppressedCount > 0`) → not in `visible` → not rendered → cannot fire.
- **Own move** → adapter already dropped own-bubble-suppressed flags; the render gate additionally withholds `onFlagIntent` ⇒ all remaining pills inert.
- **Observer** → `seatCanPost` false ⇒ no `onFlagIntent` ⇒ inert. If somehow fired, the downstream composer shows the read-only join prompt (`seatCanPost` guard in `ArgumentEntryComposer`) — no post occurs.
- **`activeMessageId` null** (no selection) → `handleFlagIntent` early-returns; also the flag row only renders with an active node.
- **In-progress draft on the same target** → seed-if-empty drops the body (Decision 8); typed text preserved.
- **Unknown / future `composerIntent` string** in a descriptor → `isComposerIntentCode` false ⇒ `resolveFlagComposerIntent` null ⇒ inert (under-actionable on uncertainty — doctrine-safe). The manifest test catches the drift at CI time.
- **Flag OFF** → `feedbackFlagIntentsEnabled` false ⇒ `onFlagIntent` undefined at every mount ⇒ pills byte-identical to today.
- **Reduce motion** → no new animation.
- **Doctrine edge:** heat/standing never influence the intent — the map keys on the machine `family`/intent only; a Family-D flag's `neverGrantsStanding` rides through untouched and the prefill uses source/receipt language, never a standing claim.

---

## Test plan

Pure-model + RTL render + wiring tests. Real-derivation assertions run the **production** map/preset producers (never fixture echoes). No `toBeLessThan(ms)` budgets (LIFE-001/META-001 flake class).

- **`__tests__/flagComposerIntentMap.test.ts`** (pure model — the drift manifest, QA-001 style):
  - **Cross-coverage:** for every `FriendlyFlagKey`, `resolveFlagComposerIntent(FRIENDLY_FLAG_DESCRIPTORS[key])` is non-null **iff** the descriptor's `actionable === true`, and the resolved `intent === descriptor.composerIntent`.
  - Every non-null `composerIntent` present in the descriptor table is a member of `ComposerIntentCode`; every `ComposerIntentCode` has a `FLAG_INTENT_TO_QUICK_ACTION` entry (both directions — no drift).
  - Every resolved intent's `quickAction` yields a **non-null `MoveDraftPatch` with a non-empty `body`** from the production `quickActionToPreset(label, null)` (proves "pre-typed" for all 5 intents).
  - **Firing negative control:** `resolveFlagComposerIntent` / `flagIntentForKey` return `null` for `nice_bridge`, `direct_challenge`, `disagrees_on_scope`, `new_issue` (representative non-actionable flags across families).
  - `isComposerIntentCode` accepts the 5, rejects `''`/`null`/`'source'`/unknown; determinism (same in → same out).
- **`__tests__/flagIntentPresetCopy.test.ts`** (ban-list over the new copy):
  - Scan `ALL_FLAG_INTENT_PRESET_BODIES` with the `friendlyFlagMapBanList` `BANNED_TOKENS` + `looksLikeInternalCode` + no-underscore + **no "proof"** token; assert source/receipt vocabulary only where evidence-adjacent.
- **`__tests__/quickActionPresets.test.ts`** (extend the EV-002 wiring test):
  - `ask_clarify` → `clarification_request` + `ASK_CLARIFY_PRESET_BODY`; `answer_question` → body-only (`argumentType` undefined) + `ANSWER_QUESTION_PRESET_BODY`; `sharpen_claim` → `clarification_request` + `SHARPEN_CLAIM_PRESET_BODY`.
  - **Regression:** `source`/`quote`/`synthesize`/`clarify`/`reply`/`branch`/`flag` still return exactly what they did (additive proof).
- **`__tests__/pointFeedbackFlagPill.test.tsx`** (RTL):
  - `onPress` absent → `accessibilityRole="text"`, no button (flag-off / observer / own / non-actionable path); pressing does nothing.
  - `onPress` + `actionable` → `accessibilityRole="button"`, fires `onPress(flag.id)`, `hitSlop` clears 44×44, `accessibilityHint` present; web focus-ring on focus.
  - **Firing negative control:** `onPress` passed but `actionable={false}` → still `role="text"`.
  - Grayscale legibility: glyph carries tone with color tokens neutralized.
- **`__tests__/pointFeedbackFlagsRow.test.tsx`** (extend UX-FLAGS-002 row test):
  - `onFlagIntent` present → actionable pills get `onPress`, non-actionable stay text; the "why?" toggle path unchanged.
  - `onFlagIntent` absent → **all** pills text (byte-identical to today).
- **`__tests__/uxFlags004RoomWiring.test.tsx`** (ArgumentRoom + Ringside wiring):
  - Flag ON + seated participant + other's active move: tapping an actionable pill calls `onAction('reply', activeMessageId, preset)` where `preset` **deep-equals** the production `quickActionToPreset(quickAction, activeParentType)` (real derivation, not a fixture).
  - Flag ON + own move → `onFlagIntent` not wired (pills inert). Flag ON + observer → not wired. **Flag OFF → not wired anywhere** (byte-identical).
  - **Ringside parity:** same assertions on the active `RingsideCard` (Exchange ⇄ Map capability parity).
  - Suppressed (capped) flag never renders ⇒ cannot fire.
- **`__tests__/featureFlagsStaticEnv.test.ts`** (extend): assert `isFeedbackFlagIntentsEnabled` reads the **static** `process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS` literal (no computed key — #776).
- **Contract preservation (run unchanged, must stay green):** `uxOneOneFiveReadOnlyBoundary.test.ts` (composer/OneBox/popout zero-diff), `friendlyFlagMapBanList.test.ts`, `pointFeedbackFlagsModel`/`feedbackFlagPriority` tests, `sourceChainPresetWiring.test.ts`.

**File/test budget:** 1 new source file + 8 modified; ~4 new test files + 3 extended; **+~50–60 tests**.

---

## Dependencies (cards / docs / files)

- **Blocked-by UX-FLAGS-002 (#834) — CLEARED.** The pill/row substrate is shipped; this card adds the tap.
- Builds on **UX-FLAGS-001 (#833)** `friendlyFlagMap.ts` (`actionable`/`composerIntent` are read as the single source of truth) and **UX-FLAGS-003 (#835)** `feedbackFlagPriority.ts` (only `visible` flags render ⇒ suppression respected).
- Reuses **EV-002** `sourceChainPresetCopy.ts` (`ASK_SOURCE_PRESET_BODY`) + **Stage 6.2 / SC-004** `quickActionPresets.ts` (`quickActionToPreset`, `SYNTHESIZE_PRESET_BODY`, the inline-body precedent).
- Reuses the **shipped reply-with-preset lane**: `ArgumentRoom.handleAction`/`enterBoxForActEntry` → `ArgumentTreeScreen.handleAction` `explicitPreset` branch → `App.composerPreset` → `ArgumentComposerDock.initialPatch` → `ArgumentComposer.handleMovePatch`.
- Mirrors the **QUOTE-FORGE-002 R4** flag pattern (App-sole-importer, prop-threaded, static-env literal, flag-off byte-identical) and the **FEEDBACK-001** per-move actor-gate (`card.isActive && !isOwn && participant`).
- **Blocks nothing hard.** Enables future EVIDENCE-ECHO-* depth (explicitly out of scope here).

---

## Risks

- **Intent-map drift vs `friendlyFlagMap` (top risk).** Mitigation: `resolveFlagComposerIntent` **derives** actionability from the #833 descriptor and the `flagComposerIntentMap.test.ts` cross-coverage manifest asserts the two match in both directions (QA-001 executable-manifest precedent). Adding an actionable flag to #833 without a matching intent, or vice-versa, is a red CI, not a silent gap.
- **"Which composer shows the seed" ambiguity** (ROOM-003 re-scope). Path A routes to the shipped dock (consistent with the one-bar's own Source-slot escalation). If the operator wants the one-bar text field itself pre-typed, Path B is required (Gaps §1) — surfaced now, not discovered at implementation.
- **`QuickActionLabel` union growth.** The 3 new members are additive; `quickActionToPreset`'s `default: return null` tolerates them, and pinned consumers (`OneBox`, `ArgumentComposer*`) **call** `quickActionToPreset` rather than exhaustively `switch` over the union. **Implementer must confirm** no pinned consumer does `switch(label){…default: assertNever}` (a grep for `assertNever`/exhaustive switches over `QuickActionLabel`); the shipped `default: return null` in the producer strongly indicates safety.
- **Clobbering an in-progress reply** — mitigated by seed-if-empty (Decision 8); the `composerDraftRegistry` read must use its **getter** (the file is pinned — do not edit it).
- **Prop-threading depth.** `feedbackFlagIntentsEnabled` rides the existing `moveMarksEnabled` chain (App → ArgumentTreeScreen → ArgumentGameSurface shim → ArgumentRoom); miss a hop and the flag row silently never actionable. Mirror `moveMarksEnabled` exactly and assert with the wiring test.
- **Static-env web-bundle trap (#776).** The new accessor MUST be a static `process.env.EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS` dot read or it forces OFF in the Netlify bundle while jest stays green. Pinned by `featureFlagsStaticEnv.test.ts`.
- **Calm-vs-discoverable tension** (§9). Shipping the calm variant (no loud CTA) risks low discovery of the new affordance; flagged for the operator (Gaps §3).

---

## Out of scope

- **EVIDENCE-ECHO-\* game depth** (per the issue's Out-of-scope) — no evidence-echo cross-referencing, no "banter detective".
- **Path B** — making the seeded body appear inside the ROOM-003 **one-bar text field** (vs the escalated dock). Deferred to an operator ruling; specified as an option, not built.
- **CardDetailPanel (legacy Cards surface) actionable pills** — stays read-only; not part of the ROOM-003 Exchange/Map pair.
- **New machine observations / new intents** beyond the 5 the descriptors already declare — this card wires existing intents; it adds no classifier family or `composerIntent` value.
- **Any migration, Edge Function, RLS, or `submit-argument` change** — none.
- **Loud/gamified pill styling, streaks, counts, confetti** (§9 un-game-like).
- **Generalizing seed-if-empty to a universal composer guard** as its own refactor card — the seam guard here covers this card's dispatch; a cross-cutting version is a separate follow-up.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the flag is advisory; the tap opens a composer pre-typed with the **user's** editable ask — never a verdict, never "the machine says you're wrong", never a block. Every prefill string is ban-list-scanned. ✔
- **§3 (popularity ≠ evidence; Family-D fence):** Family-D flags (`needs_a_receipt`/`open_receipt`/`complete_the_chain`) map to `ask_for_source`, whose body uses source/trail/receipt language and asks a question; `neverGrantsStanding` rides through untouched; no engagement/standing is granted by tapping. `friendlyFlagMap`'s no-`antiAmplification`-import invariant is preserved (this card doesn't touch it). ✔
- **§4 (AI limits):** no AI anywhere; pure deterministic map + shipped preset producer. No client AI call. ✔
- **§10a (Observation vs Allegation):** the machine flag is an **Observation**; the prefill it opens is authored by the **user** (an editable draft), so surfacing the intent never turns a machine signal into a person-directed allegation. Copy stays pointed at the move ("this claim", "the source"), never the person. ✔
- **§9 (plain language):** every user string is a frozen preset body or the shipped descriptor label; no internal code (`ask_for_source`, `family`, rawKey) ever reaches the UI — codes live only in the map + `accessibilityHint` is plain prose. ✔
- **§6/§7 (secrets / no AI from prod):** no keys, no service-role, no provider call; nothing new leaves the room boundary (§7.4 privacy). ✔
- **§8 (Supabase conventions):** no migration, no RLS, no table, `submit-argument` byte-preserved. ✔
- **Design Pass §9 (un-game-like):** the actionable pill keeps the calm muted visual; nothing is required to post; no counters/streaks/confetti; machine families stay invisible-by-default (this only makes the *already-surfaced* friendly flag one-tap useful). ✔
- **expo-rn-patterns / accessibility-targets:** RN primitives only (`Pressable`/`View`/`Text`); no new dep; 44×44 via `hitSlop`; role + label + hint; web focus ring; grayscale-legible; reduce-motion N/A (static). ✔

---

## Operator steps (if any)

**None to ship the code** — pure code change, no migration, no function deploy.

**Feature-flag rollout is operator-gated** (like the other ASP flags): after this card merges, set `EXPO_PUBLIC_FEEDBACK_FLAG_INTENTS=true` in the Netlify env (and flip off as a kill switch). Recommended: mirror the **move_marks 10%-cohort** rollout posture — enable for a small cohort first, watch for the calm-vs-discoverable read, then widen. No `db push`, no `functions deploy`.

---

## Gaps needing an orchestrator ruling

1. **Which composer shows the seed (blocking interpretation).** Path A (recommended) routes the intent to the **shipped dock** pre-typed — reusing the preset lane verbatim, consistent with how the ROOM-003 one-bar's Source/More affordances already escalate. If the operator specifically wants the **one-bar text field itself** pre-typed, that's Path B: edit `ArgumentEntryComposer` + `useArgumentComposer` (both non-pinned) to accept and apply an initial seed (+~30 lines, +1 draft-seed test). Confirm Path A is acceptable (recommended) or authorize Path B.
2. **CardDetailPanel actionable pills.** Recommended: leave the legacy Cards surface read-only for v1 (outside the Exchange/Map pair). Confirm, or authorize the one-line prop pass to make it consistent.
3. **Calm vs discoverable pill affordance.** Recommended: ship the calm variant (no color-only CTA; role/hint/hitSlop/focus-ring carry actionability). If discovery matters more than calm, authorize a subtle color-independent affordance (e.g. a trailing `›` on actionable-ON pills, matching the Ringside "Answer ›" pattern).
4. **Observer posture.** Recommended: strict (no actionable pills for observers), matching move_marks "participants only" and losing no capability (the rail's "Ask source" already serves observers). Confirm, or request per-intent observer parity (observers get only `ask_for_source`, matching the rail's observer set) — more nuanced, more surface.
