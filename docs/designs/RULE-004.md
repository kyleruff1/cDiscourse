# RULE-004 — Pause-before-send move review (advisory friction with payoff)

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (Rules-UX)
**Release:** 6.6 (Evidence-enhanced game rules) — ships after COMPOSER-002 / RULE-005
**Priority / Effort:** p1 / M
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/114
**Branch:** `feat/RULE-004-rule-004-pause-before-send-move-review-a`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\RULE-004.md`

**Depends on (status verified against the repo — see §0):**
- COMPOSER-002 (#111) — MERGED. `src/features/arguments/ArgumentComposerDock.tsx`.
- RULE-005 (#115) — MERGED. `src/features/arguments/channelModel.ts` + `ChannelChipRow.tsx`.
- LIFE-001 (#61) — MERGED. `src/features/lifecycle/` point-lifecycle model.
- META-001 (#62) — MERGED. `src/features/metadata/` move tag / metadata ledger.
- RULE-001 / RULE-003 (#32, #65) — MERGED. `gameCopy.PLAIN_LANGUAGE_COPY` + plain-language maps.

---

## §0 — Card-vs-reality discrepancies (read this first)

The card body names several symbols and paths. Every one was checked against
the actual repo at the head of `main` (commit `c22b58a`, Stage 6.4 complete +
RULE-005 merged). Where the card and reality disagree, **the design follows
reality** — the same discipline RULE-005 §0 and META-1A applied.

| # | Card says | Reality | Design decision |
|---|---|---|---|
| D1 | New files live at `src/features/composer/preSendReviewModel.ts` and `src/features/composer/PreSendReviewSheet.tsx` | **`src/features/composer/` does not exist.** Every composer / argument-room file lives under `src/features/arguments/` — `ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `channelModel.ts`, `conversationMoves.ts`, `quickActionPresets.ts`, `composerValidation.ts`. RULE-005 made the identical call (its §0 D1). | Both new files ship under **`src/features/arguments/`**: `preSendReviewModel.ts` and `PreSendReviewSheet.tsx`. Creating a one-file `composer/` folder would fragment the feature and split RULE-004 from RULE-005's `channelModel.ts`, which it must compose with. |
| D2 | Output type lists `structuralBlocks[]` with kinds `empty_body \| invalid_transition \| evidence_without_source \| over_length \| cooldown_active` — implying RULE-004 *produces* them | The structural blocks **already exist** and are *already computed* by `evaluateArgumentDraft` (`src/domain/constitution/evaluateArgumentDraft.ts`), which returns `{ allowPost, blockingErrors, warnings, ... }`. `allowPost === false` IFF `blockingErrors.length > 0`. `ArgumentComposer` already gates `canSubmit` on `evaluationResult.allowPost`. | RULE-004 **does not implement any structural block.** `preSendReviewModel` *reads* the already-computed `EvaluateArgumentDraftResult` and *re-shapes* its `blockingErrors` into the doc's `structuralBlocks[]` view shape (plain-language only). It is a **read-only projection** of existing validation — it invents no block, adds no rule. `cooldown_active` is GAME-002's (see D4). |
| D3 | `severity: 'soft'` advisories in strict modes "require explicit dismiss"; mode wired from GAME-003 | **GAME-003 has not shipped.** A `mode` value exists today only as the casual default — `DEFAULT_CASUAL_PACING_RULE` in `src/features/modes/`. There is no `strict` argument-mode template. The dock already threads a `pacingRule` (GAME-002) but no `argument mode`. | `mode` is accepted by the model as a typed parameter (`ReviewMode = 'casual' \| 'strict'`) so the signature is **stable for GAME-003**, but **in v1 it is always `'casual'`**. In casual mode `info` advisories surface and auto-dismiss; `soft` advisories still render but the sheet is never *gated* on dismissal. The `strict` branch is fully specified here but is **dead until GAME-003 supplies a non-casual mode** — flagged **Operator decision OD-1**. |
| D4 | `structuralBlocks` includes `cooldown_active`; "rate-limit/cooldown in modes the user has opted into" | GAME-002 shipped `PacingRule` + `buildPacingChipViewModel` in `src/features/modes/`. The casual default rule is a **no-op** — `buildPacingChipViewModel` renders nothing and never disables the composer. There is **no cooldown that blocks a post today.** | RULE-004 **does not implement cooldown.** `cooldown_active` is a **reserved `StructuralBlockKind` enum member** with no producer in v1 — RULE-004's projection only emits it if a future GAME-002 follow-up makes pacing *blocking* (it is advisory today). Documented as a reserved member; **out of scope** otherwise. |
| D5 | "Transformation actions … wire into existing `quickActionPresets.ts` to prefill the body" | `quickActionPresets.ts` exists; `quickActionToPreset(action, parentType)` returns a `MoveDraftPatch \| null`. Its `QuickActionLabel` union is `reply · challenge · source · quote · clarify · evidence · concede · branch · flag · weak_source · inspect_receipt · narrow · confirm · synthesize`. The card's `suggested` union (`narrow · branch_tangent · ask_source · ask_question · add_quote · add_evidence · save_draft · post_anyway`) does **not** 1:1 match those labels. | RULE-004's `suggested` values map onto **existing** `QuickActionLabel`s via a small frozen table (§5.4) — `ask_source → 'source'`, `add_quote → 'quote'`, `add_evidence → 'evidence'`, `narrow → 'narrow'`, `branch_tangent → 'branch'`. `save_draft` and `post_anyway` are **sheet actions, not preset actions** — they do not go through `quickActionPresets`. RULE-004 adds **no** new `QuickActionLabel`. |
| D6 | "Channel mismatch warning surfaces … in `PreSendReviewSheet` (RULE-004)" (from RULE-005 §0 D2 / OD-1) | RULE-005 already **shipped** the channel-mismatch advisory **inline in the `ArgumentComposerDock` chip row** (`ChannelChipRow` renders `suggestion.rationale` + the "Switch channel" `Pressable` when `suggestion.isMismatch`). RULE-005 §13 OD-1 chose "ship inline now". | RULE-004 **absorbs** RULE-005's channel-mismatch into the pre-send review as a `channel_mismatch` advisory **kind** (an addition to the card's listed kinds — justified in §2). The pre-send sheet calls `suggestChannelFromDraft` (RULE-005's existing model) and renders the *same* advisory. The inline chip-row advisory and the sheet advisory **must not both fire as separate surfaces for the same condition** — §4.4 specifies the reconciliation: the chip-row advisory stays as the *live, while-composing* hint; the sheet advisory is the *pause-before-send* recap. They share one model (`suggestChannelFromDraft`) and one copy line, so they cannot say different things. |
| D7 | `kind: 'asks_new_question'` with `suggested: 'ask_question'` | There is no `ask_question` preset in `quickActionPresets.ts` and no "ask a question" Constitution flow. The closest existing structural notion is `clarify` (→ `clarification_request`). The card's intent is "this move opens a question that may belong in its own thread". | `asks_new_question` is kept as an advisory **kind** (it is a real structural observation — derivable from META-001 `branch_suggested` / a tangent qualifier), but its `suggested` transformation is **`branch_tangent`** (route the question into its own branch) plus `clarify`, not a non-existent `ask_question` preset. Documented in §2 / §5.4. |

None of these block the card. The pure-TS model, the deterministic derivation,
and the dock integration are all buildable. The one item needing an operator
decision (OD-1 — the strict-mode branch is dead until GAME-003) is isolated.

---

## Goal

The most valuable friction point for civil-discourse quality is **before the
move leaves**. CDiscourse keeps a permanent record; a user who is about to post
a sweeping claim, drift off the resolution, attach an "Evidence" move with no
source, or open a brand-new question inside someone else's thread should get one
short, *non-judgemental* review chance — and that pause must always hand back
something useful (a narrower framing, a branch, a source field, the option to
save a draft). RULE-004 builds the **structural scaffolding** for that pause: a
pure-TS deterministic model (`preSendReviewModel.ts`) that derives a list of
**advisories** (info/soft, never blocking) from existing LIFE-001 / META-001 /
RULE-005 / Constitution signals, plus a thin React sheet (`PreSendReviewSheet`)
that the COMPOSER-002 dock shows on the Post intent.

Doctrine constraints that shape the design (`cdiscourse-doctrine`):

- **§1 — score never blocks posting; advisories are not verdicts.** RULE-004
  adds **zero new blocking rules.** The *only* thing that can block a post is
  the deterministic structural validation that **already exists**
  (`evaluateArgumentDraft` → `blockingErrors`). RULE-004 *reads* that result
  and re-shapes it; it never produces a block of its own. Every advisory is
  `info` or `soft`, and "Post anyway" is always available unless an existing
  structural block is already hit.
- **§1 / Stage 6.2 doctrine — no keyword-only gating.** Stage 6.2's "advisory
  rescue" exists precisely because keyword-only gating produced false-positive
  "cage" failures. `preSendReviewModel` **never inspects raw body text for
  keyword gating.** It reads typed structural fields and already-derived
  LIFE-001 / META-001 flags. The narrow exception — a deterministic
  *length / shape* read of the body (character count, presence of a `?`) — is
  used only to *raise an advisory*, never to block, and is documented in §7.
- **§2 / §3 — heat / popularity are not signals.** The model never reads a
  strength band, a heat value, a reply count as popularity, or any engagement
  metric. The `permanent_record_warning` advisory is honest and neutral — it
  states the record is permanent, never "this will be judged".
- **§4 / §7 — no AI call.** `preSendReviewModel` is deterministic pure TS. No
  Anthropic, no xAI, no client AI, no Edge Function call. The card explicitly
  defers semantic AI advisories to **RULE-006**.
- **§5 — pure models.** `preSendReviewModel.ts` imports types + frozen copy
  tables only. No React, no Supabase, no network, no mutation, no async.
- **§9 — plain language.** Every advisory string is read from a frozen copy
  block in `gameCopy.ts`. No new snake_case in any user-facing string; no
  verdict / person-attribution tokens. A ban-list test enforces it.
- **§10 — no v1 scope item touched.** No voting, search, notifications, OAuth,
  public API.

---

## Cannot-proceed check

The card is buildable. There is **no doctrine conflict** and **no missing hard
dependency** — COMPOSER-002, RULE-005, LIFE-001, META-001, RULE-001/003 are all
merged and verified present. The soft gaps (GAME-003 strict mode not built,
GAME-002 cooldown is advisory-only) are handled by §0 D3 / D4 *without widening
scope* — the strict-mode branch and `cooldown_active` member are specified but
inert in v1. The card proceeds.

---

## §1 — Architecture overview

Three layers, the repo's `*Model.ts` convention (matches RULE-005 §1):

```
┌──────────────────────────────────────────────────────────────────┐
│ ArgumentComposerDock.tsx  (existing — COMPOSER-002)               │
│   intercepts the Post intent → shows ↓ when the review is non-empty│
│   + PreSendReviewSheet.tsx   (NEW — thin presentational sheet)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ imports, calls
┌────────────────────────────▼─────────────────────────────────────┐
│ preSendReviewModel.ts  (NEW — pure TS, src/features/arguments/)   │
│   buildPreSendReview({ draft, mode, parent, room, lifecycle,      │
│     evaluation, channelSuggestion }) → PreSendReview              │
│   { advisories[], structuralBlocks[] }                            │
└────────────────────────────┬─────────────────────────────────────┘
                             │ reads (types + already-computed results)
┌────────────────────────────▼─────────────────────────────────────┐
│ EXISTING — read-only inputs:                                      │
│   EvaluateArgumentDraftResult  (evaluateArgumentDraft.ts)         │
│   ChannelSuggestion            (channelModel.ts — RULE-005)       │
│   PointLifecycleSnapshot / ClusterSummary (lifecycle/)           │
│   MoveLinkageRecord            (metadata/)                        │
│   ComposerDraft                (composerState.ts)                 │
│   PLAIN_LANGUAGE_COPY + new PRESEND_* copy (gameCopy.ts)          │
└──────────────────────────────────────────────────────────────────┘
```

The model is unit-testable in isolation. `PreSendReviewSheet` is a thin
presentational piece. The dock change is the only modification to an existing
file outside `gameCopy.ts`.

**Key architectural decision — RULE-004 does NOT own validation.** It is a
*presentation + advisory-derivation* layer. `evaluateArgumentDraft` stays the
single source of truth for what blocks a post. `preSendReviewModel` consumes
its result. This keeps the rules engine sacred (`cdiscourse-doctrine` §5) and
means RULE-004 cannot accidentally introduce a block.

---

## §2 — The advisory vocabulary

The card lists 6 advisory `kind`s. The design ships **7** — the 6 from the card
plus `channel_mismatch`, which **absorbs RULE-005's already-shipped
channel-mismatch advisory** (see §0 D6 / §4.4). Adding it here is not scope
creep: it is the *reconciliation the card context explicitly requires* —
RULE-005's design OD-1 stated its advisory model is "forward-compatible with
RULE-004", and the card brief instructs RULE-004 to "compose with / absorb"
it rather than duplicate it.

| `AdvisoryKind` | What it observes (structural — never truth) | Default `severity` | `suggested` transformations | Derived from |
|---|---|---|---|---|
| `broad_claim` | The draft is long *and* declares no scope qualifier — a wide claim with no narrowing. | `soft` | `narrow`, `add_evidence`, `post_anyway` | draft body length + absence of a `scope_issue` / `narrow_scope` / `narrowed_claim` tag |
| `topic_drift` | `evaluateArgumentDraft` already returned a **WEAK_TOPIC** / **OFF_TOPIC** *warning* (advisory since Stage 6.2). | `soft` | `narrow`, `branch_tangent`, `post_anyway` | `evaluation.warnings` containing `WEAK_TOPIC` / `OFF_TOPIC` |
| `asks_new_question` | META-001 derived `branch_suggested`, OR the draft carries a tangent qualifier (`branch_this_off` / `tangent_or_joke` / `tangent`), OR the body shape ends in a question mark while the draft type is not `clarification_request`. | `soft` | `branch_tangent`, `clarify`, `post_anyway` | META-001 linkage + draft tags + body-shape read (§7) |
| `no_source_attached` | The draft argument type is `evidence` **but** `attachedEvidence` is empty. NOTE: this is *also* a structural block (`evidence_without_source`); the advisory mirrors it as a *suggested-move* surface when the engine has not yet hard-blocked (e.g. type not finalized). | `soft` | `add_evidence`, `add_quote`, `post_anyway` | `draft.argumentType === 'evidence'` + `draft.attachedEvidence.length === 0` |
| `depth_warning` | The reply would sit at or beyond a deep nesting threshold (the move is far down a chain). | `info` | `branch_tangent`, `post_anyway` | `parent.depth` (existing `ArgumentRow.depth`) ≥ threshold |
| `permanent_record_warning` | Always available when the sheet shows for a *first contentful post in this dock session* — honest framing that the record is permanent. In casual mode it is `info` and auto-dismisses; in strict mode it is `soft`. | `info` (casual) / `soft` (strict) | `save_draft`, `post_anyway` | always (sheet-session flag) |
| `channel_mismatch` | RULE-005's `suggestChannelFromDraft` returned `isMismatch === true` — the user picked a channel that differs from the deterministically suggested one. | `info` | the suggested channel's transformation (e.g. `branch_tangent`), `post_anyway` | `ChannelSuggestion.isMismatch` (RULE-005 model, passed in) |

**Why `channel_mismatch` is `info`, not `soft`.** RULE-005 already surfaces the
mismatch inline while composing; by the time the sheet shows, the user has
*already seen* the chip-row advisory. The sheet repeats it at a lower severity
as a recap, never as a fresh scold. §4.4 governs the de-duplication.

**Severity semantics.**
- `info` — surfaces; in casual mode auto-dismisses (renders but does not hold
  the sheet open / does not require a tap). Lightweight.
- `soft` — surfaces; the user must *see* it. In casual mode it does not gate
  posting (the sheet's "Post anyway" is always live). In strict mode (GAME-003,
  inert in v1) a `soft` advisory requires an explicit per-advisory dismiss tap
  before "Post anyway" enables. This is the **only** behavioural difference
  between the modes, and it is the only place `mode` is read.
- There is **no `hard` / blocking advisory severity.** The union is exactly
  `'info' | 'soft'`. A blocking condition is a `structuralBlock`, never an
  advisory.

`structuralBlocks` is the read-only projection of `evaluateArgumentDraft`'s
`blockingErrors`. Its `kind` enum: `empty_body · invalid_transition ·
evidence_without_source · over_length · cooldown_active` (the card's list).
**RULE-004 produces none of these — it maps existing `blockingErrors` flag
codes onto these display kinds.** `cooldown_active` has no producer in v1
(§0 D4 — reserved).

---

## §3 — Data model

### 3.1 New pure-TS types (`preSendReviewModel.ts`)

```ts
/** RULE-004 — the structural observations a pre-send review can raise. */
export type AdvisoryKind =
  | 'broad_claim'
  | 'topic_drift'
  | 'asks_new_question'
  | 'no_source_attached'
  | 'depth_warning'
  | 'permanent_record_warning'
  | 'channel_mismatch'; // absorbs RULE-005's channel-mismatch — see §0 D6.

/** Advisory severity. There is NO blocking severity — see §2. */
export type AdvisorySeverity = 'info' | 'soft';

/**
 * A transformation the user can take from an advisory card. `narrow` /
 * `branch_tangent` / `ask_source` / `add_quote` / `add_evidence` map onto
 * existing `quickActionPresets.QuickActionLabel`s (§5.4). `save_draft` and
 * `post_anyway` are SHEET actions — they do NOT go through quickActionPresets.
 */
export type AdvisoryTransformation =
  | 'narrow'
  | 'branch_tangent'
  | 'ask_source'
  | 'add_quote'
  | 'add_evidence'
  | 'save_draft'
  | 'post_anyway';

/** One advisory card in the pre-send review. */
export interface PreSendAdvisory {
  kind: AdvisoryKind;
  severity: AdvisorySeverity;
  /**
   * Ordered transformations offered on the card (2–3). The FIRST is the
   * primary suggestion; `post_anyway` is always present and always last.
   * Every advisory has at least one non-`post_anyway` transformation —
   * asserted by a test (card acceptance criterion).
   */
  suggested: ReadonlyArray<AdvisoryTransformation>;
  /**
   * Plain-language one-liner. READ from a frozen copy table — never
   * authored at call time. Move-level language ("This may open a side
   * issue"), never person-level ("you are dodging").
   */
  plainLanguage: string;
}

/** Display kinds for an EXISTING structural block (see §0 D2). */
export type StructuralBlockKind =
  | 'empty_body'
  | 'invalid_transition'
  | 'evidence_without_source'
  | 'over_length'
  | 'cooldown_active'; // reserved — no producer in v1 (§0 D4).

/**
 * A structural block, projected READ-ONLY from `evaluateArgumentDraft`'s
 * `blockingErrors`. RULE-004 implements no block — it re-shapes one.
 */
export interface PreSendStructuralBlock {
  kind: StructuralBlockKind;
  /** Plain-language one-liner — read from gameCopy, never authored here. */
  plainLanguage: string;
}

/** v1: always 'casual'. Stable for GAME-003 (§0 D3). */
export type ReviewMode = 'casual' | 'strict';

/** The complete pre-send review — the model's single output. */
export interface PreSendReview {
  advisories: ReadonlyArray<PreSendAdvisory>;
  structuralBlocks: ReadonlyArray<PreSendStructuralBlock>;
  /**
   * True IFF `structuralBlocks` is non-empty. When true the sheet hides
   * "Post anyway" — an existing structural block genuinely prevents the
   * post (this is NOT a RULE-004 block; it is the engine's).
   */
  hasStructuralBlock: boolean;
  /**
   * True when the sheet should be shown at all: advisories non-empty OR
   * structuralBlocks non-empty. When false the dock posts straight through
   * with no sheet (ordinary clean reply — no friction).
   */
  shouldShowSheet: boolean;
}
```

### 3.2 The model input

```ts
export interface PreSendReviewInput {
  /** The composer draft being reviewed (composerState.ComposerDraft). */
  draft: ComposerDraft;
  /** v1: always 'casual'. See §0 D3. */
  mode: ReviewMode;
  /** The parent argument row, or null for a root move. */
  parent: ArgumentRow | null;
  /** Lightweight room context (resolution depth limit etc.). */
  room: PreSendRoomContext;
  /**
   * The parent's already-derived LIFE-001 / META-001 structures. All
   * null for a root draft. RULE-004 NEVER re-derives these — it reads
   * what LIFE-001 / META-001 already computed for the posted parent.
   */
  lifecycle: PreSendLifecycleContext;
  /**
   * The already-computed Constitution evaluation result for this draft.
   * RULE-004 reads `blockingErrors` + `warnings`; it never re-runs the
   * engine. `null` when the draft is too incomplete to evaluate (no
   * type / side) — the model then derives only draft-shape advisories.
   */
  evaluation: EvaluateArgumentDraftResult | null;
  /**
   * RULE-005's channel suggestion for this draft, or null when no
   * channel is in play. Drives the `channel_mismatch` advisory.
   */
  channelSuggestion: ChannelSuggestion | null;
  /**
   * True when this is the first contentful post attempt in the current
   * dock session — drives `permanent_record_warning`. The dock owns this
   * flag (resets when the dock re-opens).
   */
  isFirstPostInSession: boolean;
}

export interface PreSendRoomContext {
  /** Max nesting depth before `depth_warning` fires. Frozen default 6. */
  depthWarningThreshold: number;
}

export interface PreSendLifecycleContext {
  parentSnapshot: PointLifecycleSnapshot | null;
  parentClusterSummary: PointLifecycleClusterSummary | null;
  parentLinkage: MoveLinkageRecord | null;
}
```

`ComposerDraft`, `ArgumentRow`, `EvaluateArgumentDraftResult`,
`ChannelSuggestion`, `PointLifecycleSnapshot`, `PointLifecycleClusterSummary`,
`MoveLinkageRecord` are all **existing types imported as types only**. The model
adds no new persisted shape and no new storage.

### 3.3 New plain-language copy (`gameCopy.ts`)

A new frozen block beside RULE-005's `CHANNEL_*` blocks:

```ts
/** RULE-004 — plain-language line per advisory kind. */
export const PRESEND_ADVISORY_COPY = Object.freeze({
  broad_claim: 'This is a wide claim — narrowing it makes it easier to defend.',
  topic_drift: 'This may be drifting from the resolution.',
  asks_new_question: 'This opens a new question — a side branch keeps it tidy.',
  no_source_attached: 'This is an Evidence move with no source attached yet.',
  depth_warning: 'This sits deep in the thread — a fresh branch may read clearer.',
  permanent_record_warning: 'Posted moves stay on the record. Take a beat if you need it.',
  channel_mismatch: 'This reads more like a different move — switch channel?',
} as const);

/** RULE-004 — plain-language line per structural-block display kind. */
export const PRESEND_BLOCK_COPY = Object.freeze({
  empty_body: 'Add a body before posting.',
  invalid_transition: 'This move type is not allowed as a reply here.',
  evidence_without_source: 'An Evidence move needs at least one source.',
  over_length: 'This move is over the length limit — trim it to post.',
  cooldown_active: 'A short cooldown is active — you can post again shortly.',
} as const);
```

All strings: ≤ 90 chars, plain English, no snake_case, **zero verdict /
amplification / person tokens**, non-punitive framing. Enforced by
`__tests__/preSendReviewBanList.test.ts` (§8).

`permanent_record_warning` is deliberately **honest, not fear-based** — "stay on
the record" is a fact; "take a beat if you need it" is a non-punitive invitation
(card doctrine: "not fear-based").

---

## §4 — Composer integration

### 4.1 Where the sheet mounts

`ArgumentComposerDock.tsx` is the host (COMPOSER-002). It already renders a
`<Modal>` containing the dock panel with the `ChannelChipRow` (RULE-005) and the
`<ArgumentComposer mode="dock" />`. RULE-004 adds **one nested overlay**:
`<PreSendReviewSheet>`, rendered *inside the dock* (a `View` overlay above the
composer body, NOT a second RN `<Modal>` — nested modals are fragile on
native). It is `position: absolute` filling the dock panel with a scrim, so the
composer stays mounted behind it (the draft is never lost — same invariant the
dock already protects).

### 4.2 Intercepting the Post intent

Today: `ArgumentComposer`'s "Post move" `Pressable` calls `handleSubmit`
directly; `canSubmit` already gates on `evaluationResult.allowPost`.

RULE-004 inserts a **review gate** between the Post tap and `handleSubmit`. The
cleanest seam that does **not** rewrite `ArgumentComposer`'s submit flow:

1. The dock owns a new callback `onRequestSubmit` it passes into
   `ArgumentComposer` as an **optional prop** (`onBeforeSubmit?: () => boolean`).
   When provided, `ArgumentComposer`'s Post handler calls `onBeforeSubmit()`
   first; if it returns `false`, `ArgumentComposer` does **not** call its
   internal `handleSubmit` — the dock has taken over.
2. The dock's `onBeforeSubmit` builds the `PreSendReview` (calling
   `buildPreSendReview`). If `review.shouldShowSheet` is `false` it returns
   `true` (let the composer post straight through — no friction for a clean
   move). If `true`, it stores the review in dock state, shows
   `PreSendReviewSheet`, and returns `false`.
3. The sheet's "Post anyway" calls a dock handler that **programmatically
   triggers the composer's real submit** — exposed by `ArgumentComposer` via a
   second optional prop `submitRef` (an imperative handle: `{ submit: () => void }`),
   or, simpler, the dock re-invokes the same path with a one-shot
   `bypassReview` flag so `onBeforeSubmit` returns `true` that once.

**Build-phase judgment call (documented, not mandated):** the `submitRef`
imperative handle vs a `bypassReview` boolean flag are two valid wirings. The
`bypassReview` flag is the smaller diff (no `useImperativeHandle`, no ref
plumbing) and is the **recommended** path: the dock sets `bypassReviewOnce`,
calls a state setter the composer watches, the composer posts once and clears
it. The Build phase picks whichever produces the smaller, clearer diff. Either
way **`ArgumentComposer`'s `evaluateArgumentDraft` / `submit-argument` path is
unchanged** — RULE-004 only adds a *gate before* it.

This means RULE-004 does **not** need `evaluateArgumentDraft` to move. The dock
already has everything to call `buildEvaluationInput` + `evaluateArgumentDraft`
itself for the review (or — cleaner — `ArgumentComposer` passes its already-memo'd
`evaluationResult` up through `onBeforeSubmit`'s closure / a callback). §5.5
specifies the prop contract; the Build phase confirms the exact handoff.

### 4.3 What the sheet shows

`PreSendReviewSheet` renders:
- A short neutral header: "One quick look before you post" (frozen copy).
- A `structuralBlocks` section first (if any) — each block is a plain-language
  line. When `hasStructuralBlock` is true, **"Post anyway" is hidden** (the
  engine genuinely blocks the post) and a "Fix and continue" / "Back to editing"
  button returns to the composer.
- An `advisories` section — each advisory is a card with its `plainLanguage`
  line + 2–3 transformation `Pressable`s. Tapping a transformation that maps to
  a `QuickActionLabel` (§5.4) applies the preset via the existing
  `quickActionToPreset` → `handleMovePatch` machinery and **closes the sheet
  back to the composer** so the user sees the prefilled change.
- "Post anyway" — always present **unless** `hasStructuralBlock`. Posts the
  move (bypasses the review for that one post).
- "Save draft" — always present. Calls the existing draft-save path
  (`composerState` / the draft persistence the composer already uses) and
  closes the dock.

### 4.4 Reconciliation with RULE-005's already-shipped channel-mismatch advisory

**This is the load-bearing reconciliation the card brief requires.**

RULE-005 already shipped — verified in `channelModel.ts` + the dock — a
channel-mismatch advisory that surfaces **inline in `ChannelChipRow`** while the
user is composing: when `suggestChannelFromDraft(...).isMismatch === true` the
chip row renders `suggestion.rationale` and a "Switch channel" `Pressable`.

RULE-004 must **compose with, not duplicate or conflict with** that. The rule:

| Surface | When it shows | What it is | Owner |
|---|---|---|---|
| `ChannelChipRow` inline advisory | While composing — live, as the user picks a channel / changes the draft type | A *live hint* — "you picked Challenge but this reads like a side issue" | RULE-005 (unchanged — RULE-004 does **not** remove or alter it) |
| `PreSendReviewSheet` `channel_mismatch` advisory card | At the Post intent — the pause-before-send recap | A *recap* — the same mismatch, surfaced one last time alongside the other pre-send advisories | RULE-004 |

**They share one model and one copy line so they cannot diverge:**

1. Both call **RULE-005's `suggestChannelFromDraft`** — RULE-004 does not write
   its own channel logic. The dock already computes `channelSuggestion`; it
   passes that *same object* into `buildPreSendReview` as
   `input.channelSuggestion`. One computation, two render targets.
2. The `channel_mismatch` advisory's `plainLanguage` is **RULE-005's
   `suggestion.rationale`** (already plain-language, already ban-list-clean — it
   comes from `CHANNEL_RATIONALE_COPY`). RULE-004's `PRESEND_ADVISORY_COPY`
   `channel_mismatch` line is a **fallback** used only if `channelSuggestion` is
   null at sheet build (it never is when a mismatch fired). The sheet prefers
   `suggestion.rationale` verbatim. This guarantees the two surfaces say the
   *same sentence*.
3. The advisory's transformation is **"switch to the suggested channel"** — the
   same action the chip-row "Switch channel" button performs. RULE-004 reuses
   RULE-005's channel-switch handler (the dock's `setSelectedChannel` /
   `handleSelectChannel`) — it does not invent a parallel switch path.
4. **De-dup guarantee:** `channel_mismatch` is emitted into `advisories` **only
   when `channelSuggestion.isMismatch === true`** — the exact same condition
   that fires the chip-row advisory. They are never in contradictory states.
   The chip-row advisory is the *editing-time* surface; the sheet advisory is
   the *send-time* surface; the same condition drives both, so the user sees a
   consistent story, never two advisories disagreeing.

This is the forward-compatibility RULE-005 §0 D2 / OD-1 promised: RULE-005
shipped the inline advisory *and* the reusable model; RULE-004 plugs the model
into the sheet without touching RULE-005's code. **RULE-004 modifies neither
`channelModel.ts` nor `ChannelChipRow.tsx`.**

### 4.5 Mode behaviour (v1 = casual only)

- **Casual (v1, always):** `info` advisories render compactly and auto-dismiss
  (no tap required). `soft` advisories render as cards but "Post anyway" is
  always enabled. The sheet only appears when `shouldShowSheet` is true.
- **Strict (GAME-003, inert in v1 — OD-1):** every `soft` advisory must be
  explicitly dismissed (a per-card "Got it" tap) before "Post anyway" enables;
  `permanent_record_warning` upgrades to `soft`. The model already emits the
  correct severities for `mode === 'strict'`; the sheet's gating logic for the
  strict path is specified and tested but **never reachable in v1** because the
  dock always passes `mode: 'casual'`.

---

## §5 — API / interface contracts

### 5.1 `buildPreSendReview(input)`

```ts
/**
 * Builds the complete pre-send review for a draft. Pure. Deterministic.
 * Idempotent. NO AI, NO network, NO mutation, NO async.
 *
 * Reads:
 *  - `input.evaluation.blockingErrors` → projected to `structuralBlocks`
 *    (RULE-004 implements NO block — it re-shapes the engine's result).
 *  - `input.evaluation.warnings`       → `topic_drift` advisory.
 *  - `input.draft` typed fields + a deterministic body length / shape read
 *    (NOT keyword gating — see §7) → `broad_claim`, `no_source_attached`,
 *    `asks_new_question`.
 *  - `input.lifecycle` (parent's already-derived LIFE-001 / META-001) →
 *    `asks_new_question`.
 *  - `input.parent.depth` + `input.room.depthWarningThreshold` →
 *    `depth_warning`.
 *  - `input.channelSuggestion.isMismatch` → `channel_mismatch`.
 *  - `input.isFirstPostInSession` + `input.mode` → `permanent_record_warning`.
 *
 * Never reads: strength bands, heat, reply counts, engagement, the raw
 * body text for keyword matching.
 */
export function buildPreSendReview(input: PreSendReviewInput): PreSendReview;
```

**Derivation order** (advisories appended in this order — the array order is the
render order; an ordered, fully-unit-testable rule list):

1. `structuralBlocks` — project every `blockingError` whose flag code maps to a
   `StructuralBlockKind` (§5.3). Sets `hasStructuralBlock`.
2. `no_source_attached` — `draft.argumentType === 'evidence'` &&
   `draft.attachedEvidence.length === 0`.
3. `topic_drift` — `evaluation.warnings` contains `WEAK_TOPIC` or `OFF_TOPIC`.
4. `broad_claim` — body length ≥ `BROAD_CLAIM_MIN_CHARS` (frozen, e.g. 280) &&
   no scope-narrowing tag on the draft (`scope_issue` / `narrow_scope` /
   `narrowed_claim` / `scope_example`).
5. `asks_new_question` — `parentLinkage` / cluster carries `branch_suggested`,
   OR `draft.selectedTagCodes` has a tangent code, OR the body shape ends with
   `?` and `draft.argumentType !== 'clarification_request'`.
6. `depth_warning` — `parent !== null` && `parent.depth + 1 >=
   room.depthWarningThreshold`.
7. `channel_mismatch` — `channelSuggestion !== null &&
   channelSuggestion.isMismatch === true`.
8. `permanent_record_warning` — `isFirstPostInSession === true`. Severity is
   `mode === 'strict' ? 'soft' : 'info'`.

`shouldShowSheet = advisories.length > 0 || structuralBlocks.length > 0`.

Each advisory's `severity`, `suggested`, and `plainLanguage` come from a frozen
`ADVISORY_DEFINITIONS` table (§5.2) — never authored at call time.

### 5.2 `advisoryDefinition(kind)` + the frozen table

```ts
export interface AdvisoryDefinition {
  kind: AdvisoryKind;
  /** Severity in casual mode. `permanent_record_warning` overrides per mode. */
  baseSeverity: AdvisorySeverity;
  /** Ordered transformations; `post_anyway` always last. */
  suggested: ReadonlyArray<AdvisoryTransformation>;
}

/** Frozen per-kind definition. O(1) lookup; throws on an unknown kind. */
export function advisoryDefinition(kind: AdvisoryKind): AdvisoryDefinition;

export const ADVISORY_DEFINITIONS:
  Readonly<Record<AdvisoryKind, AdvisoryDefinition>>;
```

### 5.3 Block flag-code projection

```ts
/**
 * Maps an EXISTING `evaluateArgumentDraft` blocking flag code to a
 * RULE-004 display `StructuralBlockKind`. Unknown codes project to
 * `invalid_transition` as a safe generic (they are still real engine
 * blocks — RULE-004 just lacks a specific display bucket).
 */
export function projectBlockKind(flagCode: string): StructuralBlockKind;
```

The mapping table (Build phase verifies the exact flag codes against
`FLAG_CODES` in `evaluateArgumentDraft.ts` — e.g. empty-body, transition,
evidence-missing-source, max-length codes). RULE-004 **adds no flag code**.

### 5.4 Transformation → preset bridge

```ts
/**
 * Maps an `AdvisoryTransformation` to an existing
 * `quickActionPresets.QuickActionLabel`, or null for the two sheet-only
 * actions (`save_draft`, `post_anyway`). RULE-004 adds NO new QuickActionLabel.
 */
export function transformationToQuickAction(
  t: AdvisoryTransformation,
): QuickActionLabel | null;
//  narrow         -> 'narrow'
//  branch_tangent -> 'branch'
//  ask_source     -> 'source'
//  add_quote      -> 'quote'
//  add_evidence   -> 'evidence'
//  save_draft     -> null  (sheet action)
//  post_anyway    -> null  (sheet action)
```

The sheet calls `transformationToQuickAction`, then — for a non-null result —
routes through the dock's existing `quickActionToPreset` + `handleMovePatch`
(the same path RULE-002 / SC-004 / EV-002 already use). The sheet itself never
builds a `MoveDraftPatch`.

### 5.5 Component prop contracts

```ts
// PreSendReviewSheet.tsx
interface PreSendReviewSheetProps {
  visible: boolean;
  review: PreSendReview;
  /** Apply a transformation preset (maps via transformationToQuickAction). */
  onApplyTransformation: (t: AdvisoryTransformation) => void;
  /** "Post anyway" — bypasses the review for this one post. Hidden if
   *  review.hasStructuralBlock. */
  onPostAnyway: () => void;
  /** "Save draft" — always present. */
  onSaveDraft: () => void;
  /** "Back to editing" — closes the sheet, keeps the draft. */
  onBackToEditing: () => void;
  /** PR-001 effective reduce-motion (the dock already threads this). */
  reduceMotionOverride?: boolean;
  /** v1: always 'casual'. Drives strict-mode per-advisory dismiss (inert v1). */
  mode: ReviewMode;
}

// ArgumentComposer.tsx — additive optional props only (no behaviour change
// for existing callers that omit them):
interface ArgumentComposerProps {
  // ...existing props unchanged...
  /** RULE-004 — called on Post intent. Return false to suppress the
   *  composer's own submit (the dock is showing the review sheet). */
  onBeforeSubmit?: () => boolean;
}
```

`ArgumentComposer` is the one existing *form* file touched, and only by an
**additive optional prop** — every existing caller that omits `onBeforeSubmit`
behaves identically (the Post button calls `handleSubmit` directly). This
mirrors RULE-005's "additive optional field" discipline (its R4).

---

## §6 — File changes

### New files (RULE-004 footprint)

- `src/features/arguments/preSendReviewModel.ts` — the pure-TS model:
  `AdvisoryKind`, `AdvisorySeverity`, `AdvisoryTransformation`, `PreSendAdvisory`,
  `StructuralBlockKind`, `PreSendStructuralBlock`, `ReviewMode`, `PreSendReview`,
  `PreSendReviewInput` (+ `PreSendRoomContext`, `PreSendLifecycleContext`),
  `ADVISORY_DEFINITIONS`, `advisoryDefinition`, `buildPreSendReview`,
  `projectBlockKind`, `transformationToQuickAction`, `ALL_ADVISORY_KINDS`,
  `_forbiddenPreSendTokens()` (ban-list test support).
  **~300–360 lines.**
- `src/features/arguments/PreSendReviewSheet.tsx` — the presentational sheet:
  scrim overlay, structural-block section, advisory cards, "Post anyway" /
  "Save draft" / "Back to editing". **~200–260 lines.**
- `__tests__/preSendReviewModel.test.ts` — per-advisory derivation. **~200 lines.**
- `__tests__/preSendReviewBanList.test.ts` — ban-list across every produced
  string. **~90 lines.**
- `__tests__/preSendReviewNoBlockOnKeywords.test.ts` — keyword inputs never
  yield a `structuralBlock`; the model never reads body text for gating.
  **~80 lines.**
- `__tests__/preSendReviewSheetUi.test.tsx` — "Post anyway" visibility,
  reduce-motion, a11y roles. **~140 lines.**

### Modified files

- `src/features/arguments/gameCopy.ts` — ADD `PRESEND_ADVISORY_COPY` +
  `PRESEND_BLOCK_COPY` + a short `PRESEND_SHEET_COPY` (header / button labels)
  frozen block. Nothing existing changes. **~+30 lines.**
- `src/features/arguments/ArgumentComposerDock.tsx` — own the review state,
  build the `PreSendReview` on Post intent, render `<PreSendReviewSheet>`,
  thread `onBeforeSubmit` into `<ArgumentComposer>`, wire "Post anyway" /
  "Save draft" / transformation handlers. Pass the already-computed
  `channelSuggestion` into `buildPreSendReview`. **~+70–100 lines.** No
  existing behaviour removed.
- `src/features/arguments/ArgumentComposer.tsx` — ADD one additive optional
  prop `onBeforeSubmit?: () => boolean`; the Post handler calls it first and
  returns early if it returns `false`. **~+8 lines.** Zero change for callers
  that omit the prop.

### Files this card does NOT touch (and why)

- `src/domain/constitution/*` — the rules engine is sacred. RULE-004 *reads*
  `evaluateArgumentDraft`'s result; it adds no rule, no flag code, no block.
- `src/features/arguments/channelModel.ts` + `ChannelChipRow.tsx` — RULE-005's
  channel model and inline advisory are reused **unchanged** (§4.4).
- `src/features/arguments/quickActionPresets.ts` — RULE-004 reuses
  `QuickActionLabel` / `quickActionToPreset`; it adds no label, no preset.
- `src/features/metadata/*` + `src/features/lifecycle/*` — read-only consumers.
- `supabase/migrations/*` + `supabase/functions/*` — no migration, no Edge
  Function. RULE-004 is client-only pure TS + one presentational component +
  a dock wiring. `submit-argument` is untouched.

### Future-card footprint (NOT this card)

- Semantic AI advisories (a model that reads body *meaning*) → **RULE-006**.
- Strict-mode behaviour becoming *reachable* (a non-casual argument mode) →
  **GAME-003**. RULE-004 ships the strict branch dead-but-tested.
- A *blocking* cooldown → a future **GAME-002** follow-up. `cooldown_active` is
  a reserved enum member with no v1 producer.
- Tangent **auto-routing** (acting on `branch_tangent` automatically) →
  **BR-003**. RULE-004 only *suggests* it.

---

## §7 — Edge cases

The implementer must handle each:

1. **Clean ordinary reply (no advisories, no blocks).** `buildPreSendReview`
   returns `shouldShowSheet: false`; the dock's `onBeforeSubmit` returns `true`;
   `ArgumentComposer` posts straight through — **zero friction**. This is the
   common path and the card's first acceptance criterion. Test covers it.
2. **Empty body.** `evaluateArgumentDraft` already produces an empty-body
   blocking error → projected to `structuralBlocks` with `empty_body`;
   `hasStructuralBlock` true; "Post anyway" hidden. RULE-004 does not itself
   detect the empty body — it re-shapes the engine's block. Test covers it.
3. **Invalid transition.** Same as #2 — engine block, projected, "Post anyway"
   hidden. RULE-004 never re-validates the transition table.
4. **Keyword-laden body, but structurally fine.** A body full of charged words
   but a valid type / non-empty body / valid transition yields **no
   structuralBlock** — the model never reads body text for keyword gating.
   `__tests__/preSendReviewNoBlockOnKeywords.test.ts` asserts this directly
   (card acceptance criterion + Stage 6.2 doctrine).
5. **Body-shape read is length / punctuation only.** `broad_claim` reads
   `body.length`; `asks_new_question` reads whether `body.trim()` ends with `?`.
   These are **deterministic shape reads, not keyword matches** — they raise an
   `info`/`soft` advisory, never a block, and the user can always "Post anyway".
   Documented so the implementer does not drift into keyword scanning.
6. **Draft too incomplete to evaluate (`evaluation` is null).** No type / side
   yet → the model skips block projection and `topic_drift`, still derives
   draft-shape advisories (`broad_claim`, `asks_new_question`,
   `no_source_attached`, `permanent_record_warning`). Never throws.
7. **Root move (no parent).** `parent` and all `lifecycle.*` inputs are `null`.
   `depth_warning` is skipped (no parent depth); `asks_new_question`'s
   META-001 branch is skipped; the body-shape branch still applies. Test covers
   a root thesis draft.
8. **`evidence` type, no source — and the engine ALSO blocks it.** Both
   `no_source_attached` (advisory) and `evidence_without_source` (structural
   block) can describe the same draft. When the block is present, "Post anyway"
   is hidden; the advisory still renders as a *suggested-move* card (it points
   at `add_evidence`). The two are not contradictory — the block says "can't
   post", the advisory says "here's how to fix it". Test asserts both surface
   without conflict.
9. **Channel mismatch when `channelSuggestion` is null.** No channel in play →
   no `channel_mismatch` advisory. `buildPreSendReview` handles `null` cleanly.
10. **"Post anyway" with a structural block present.** Not possible — the sheet
    hides "Post anyway" when `hasStructuralBlock`. The user must "Back to
    editing". This is the engine's block, surfaced honestly — RULE-004 does not
    let the user bypass an *existing* structural block (it only ever lets them
    bypass an *advisory*, which was never a block).
11. **Concurrent edits / offline.** `buildPreSendReview` is a pure draft-time
    model with no network. Offline has no effect. There is no write, so no
    concurrency surface. The "Save draft" action uses the composer's existing
    draft-persistence path (already offline-tolerant). N/A beyond that.
12. **Reduce motion.** The sheet's appearance and the advisory cards must snap
    (no slide / fade) when `reduceMotionOverride` is true. The dock already
    threads `effectiveReducedMotion`; the sheet receives it.
13. **Doctrine edge — does heat / popularity ever raise an advisory?** No.
    `buildPreSendReview` reads typed structural fields, the engine's
    block/warning lists, LIFE-001/META-001 *structural* state, parent depth,
    and the channel suggestion. It never reads a strength band, heat, reply
    count, or engagement. A test feeds two drafts identical in structure but
    different in (hypothetical) heat and expects identical reviews.
14. **Doctrine edge — does `permanent_record_warning` read as a threat?** No.
    Its copy states a fact ("posted moves stay on the record") and offers a
    non-punitive option ("take a beat if you need it" / Save draft). No
    "you will be judged", no verdict token. Covered by the ban-list test.
15. **Doctrine edge — can an advisory ever block a post?** No. The
    `AdvisorySeverity` union is exactly `'info' | 'soft'`; neither gates posting
    in casual mode. The ONLY thing that hides "Post anyway" is a
    `structuralBlock`, which is the *engine's* pre-existing block. A test
    asserts no `severity` value other than `info` / `soft` exists and that
    every advisory-only review keeps "Post anyway" available.
16. **Strict-mode branch unreachable in v1.** `mode` is always `'casual'` from
    the dock. The strict branch (per-advisory dismiss gating) is unit-tested by
    calling the model / sheet with `mode: 'strict'` directly, but no v1 UI path
    reaches it. Documented as OD-1.

---

## §8 — Test plan (Build-phase responsibility)

Per `test-discipline`: tests ship **with** the Build-phase code, not after.
Every public function of the pure model needs happy-path + failure-case
coverage.

- **`__tests__/preSendReviewModel.test.ts`**
  - A row-per-rule table: each of the 8 derivation rules fires for a crafted
    input and produces the expected advisory `{ kind, severity, suggested }`.
  - Every `AdvisoryKind` in `ALL_ADVISORY_KINDS` has an `ADVISORY_DEFINITIONS`
    entry; `advisoryDefinition` throws on an unknown kind.
  - **Every advisory has ≥ 1 non-`post_anyway` transformation** (card
    acceptance criterion) and `post_anyway` is always present and always last.
  - `projectBlockKind` maps each known `evaluateArgumentDraft` blocking flag
    code to the right `StructuralBlockKind`; unknown → `invalid_transition`.
  - `transformationToQuickAction` returns the right `QuickActionLabel`;
    `save_draft` / `post_anyway` → `null`.
  - Clean draft → `shouldShowSheet: false`, empty `advisories` + `structuralBlocks`.
  - Root draft (all parent / lifecycle inputs null) → no throw; depth /
    META-001 branches skipped.
  - `evaluation: null` → no block projection, draft-shape advisories still
    derived.
  - Determinism: same input twice → equal output.
  - `permanent_record_warning` severity is `info` for `mode: 'casual'`,
    `soft` for `mode: 'strict'`.
- **`__tests__/preSendReviewBanList.test.ts`**
  - Scan every produced string — every `plainLanguage` from every advisory
    kind, every block kind, `PRESEND_ADVISORY_COPY`, `PRESEND_BLOCK_COPY`,
    `PRESEND_SHEET_COPY` — for the forbidden token list (reuse
    `_forbiddenPreSendTokens()`, mirroring `_forbiddenChannelTokens()` /
    `_forbiddenMetadataTokens()`: winner, loser, correct, true, false, liar,
    dishonest, bad faith, manipulative, extremist, propagandist, troll, bot,
    right, wrong, validated, plus amplification + block/prevent tokens).
    Zero matches.
  - Specifically: no advisory copy contains "dodge / dodging / evading /
    avoiding" (non-punitive requirement, card acceptance criterion — copy is
    move-level, never person-level).
  - `looksLikeInternalCode` is false for every produced string (no snake_case
    leak — reuses `gameCopy.looksLikeInternalCode`).
  - `permanent_record_warning` copy contains no fear token ("judged",
    "punished", "permanent damage" — honest, not fear-based).
- **`__tests__/preSendReviewNoBlockOnKeywords.test.ts`**
  - A draft whose body is full of charged keywords but is structurally valid
    (non-empty, valid type, valid transition) yields **zero `structuralBlock`s**.
  - The model never reads the body for keyword matching: assert by passing a
    draft with charged keywords and a benign one of equal length / shape — the
    `advisories` are identical (only length / `?`-shape / typed fields differ).
  - Two structurally-identical drafts with different (mock) heat / reply counts
    produce the **same** `PreSendReview` (doctrine §2 / §13).
  - `PreSendAdvisory` has no blocking field; `AdvisorySeverity` has exactly two
    members.
- **`__tests__/preSendReviewSheetUi.test.tsx`** (React Testing Library, JSDOM)
  - "Post anyway" is visible when `hasStructuralBlock` is false; hidden when
    true (card acceptance criterion).
  - "Save draft" is always visible.
  - Each advisory card renders its `plainLanguage` line + its transformation
    `Pressable`s; every `Pressable` has `accessibilityRole="button"`,
    `accessibilityLabel`, ≥ 44×44 hit target (or `hitSlop`).
  - Tapping a transformation calls `onApplyTransformation` with the right value.
  - Reduce-motion: with `reduceMotionOverride` true the sheet does not animate
    (snap) — explicit assertion or a no-animation render path.
  - Grayscale legibility: structural-block vs advisory sections are
    distinguishable by text / shape, not color alone.
  - Strict mode (`mode: 'strict'`): a `soft` advisory requires a per-card
    dismiss before "Post anyway" enables (tests the dead-but-specified branch).

Test-count expectation: **~+55–70 tests** across the three model suites + the
UI suite. The exact count is confirmed by the Build phase running
`npm run test` and is recorded in `docs/current-status.md` then.

---

## §9 — Dependencies (cards / docs / files)

- **Assumes COMPOSER-002 (#111) complete** — `PreSendReviewSheet` is hosted by
  `ArgumentComposerDock.tsx`; the Post-intent gate threads through it. Verified
  present.
- **Assumes RULE-005 (#115) complete** — `buildPreSendReview` consumes
  `ChannelSuggestion` / `suggestChannelFromDraft` to derive `channel_mismatch`
  and to reconcile with the inline chip-row advisory (§4.4). Verified present:
  `src/features/arguments/channelModel.ts`, `ChannelChipRow.tsx`.
- **Assumes LIFE-001 (#61) complete** — reads `PointLifecycleSnapshot` /
  `PointLifecycleClusterSummary` for the parent. Verified present:
  `src/features/lifecycle/pointLifecycleModel.ts`.
- **Assumes META-001 (#62) complete** — reads `MoveLinkageRecord` /
  `branch_suggested` for `asks_new_question`. Verified present:
  `src/features/metadata/moveMetadataLedger.ts`.
- **Assumes RULE-001 / RULE-003 (#32, #65) complete** — all advisory copy goes
  into `gameCopy` and is read through it; `looksLikeInternalCode` is the
  precedent the ban-list test reuses. Verified present.
- **Reads** `src/domain/constitution/evaluateArgumentDraft.ts` at its
  `{ allowPost, blockingErrors, warnings }` result — RULE-004 projects, never
  re-runs it. Reads `FLAG_CODES` for `projectBlockKind`.
- **Reads** `quickActionPresets.ts` (`QuickActionLabel` / `quickActionToPreset`)
  — RULE-004's transformation bridge maps onto existing labels; adds none.
- **Reads** `composerState.ts` (`ComposerDraft`) and `types.ts` (`ArgumentRow`).
- **Blocks RULE-006** — the semantic-AI advisory card *replaces* the
  deterministic body-shape rules of `buildPreSendReview` with an Edge-Function
  classifier behind the same `PreSendReview` return type. RULE-004 defines that
  contract.
- **Enabled-by RULE-005** — RULE-005 §0 D2 / §13 OD-1 explicitly built the
  channel-mismatch model to be RULE-004-ready; RULE-004 is the consumer.

---

## §10 — Risks

- **R1 — Submit-flow seam.** Intercepting Post without rewriting
  `ArgumentComposer`'s submit is the trickiest part. **Mitigation:** §4.2
  specifies an additive optional `onBeforeSubmit` prop + a `bypassReview`
  one-shot — both additive, zero change for callers that omit them. The Build
  phase picks the smaller diff. `evaluateArgumentDraft` / `submit-argument` are
  untouched.
- **R2 — Double channel-mismatch surface.** RULE-005's inline chip-row advisory
  and RULE-004's sheet advisory could feel like nagging. **Mitigation:** §4.4 —
  one shared model (`suggestChannelFromDraft`), one shared copy line
  (`suggestion.rationale`), one shared switch handler; the chip-row advisory is
  the *editing-time* surface, the sheet is the *send-time* recap. They are
  never contradictory because the same `isMismatch` flag drives both.
- **R3 — `gameCopy` key collision.** `PRESEND_*` keys must not collide with
  existing `PLAIN_LANGUAGE_COPY` / `CHANNEL_*` keys. **Mitigation:** the new
  copy lives in its own frozen blocks (`PRESEND_ADVISORY_COPY` etc.), not in
  `PLAIN_LANGUAGE_COPY`; the META-001 plain-language coverage test catches a
  stray collision. The implementer runs `npm run test` early.
- **R4 — Scope creep into RULE-006 / GAME-003.** It is tempting to add a
  "semantic" advisory or wire real strict-mode behaviour. **Mitigation:** §0
  D3 + §6 "Future-card footprint" draw the line; the strict branch is
  dead-but-tested; the model never reads body *meaning*, only *shape*.
- **R5 — Friction fatigue.** If the sheet shows on every post it becomes
  noise. **Mitigation:** `shouldShowSheet` is false for a clean ordinary reply
  (§7 #1) — the common path has zero friction. `permanent_record_warning` fires
  only on the *first* post in a dock session, not every post.
- **R6 — `ArgumentComposerDock` snapshot test churn.** If a dock snapshot test
  exists it will change. **Mitigation:** the Build phase updates it deliberately
  and notes it; the sheet is additive overlay chrome.
- **R7 — Body-shape read drifting into keyword gating.** A future contributor
  might "improve" `broad_claim` by scanning for words. **Mitigation:** §7 #5
  and the doctrine self-check pin the rule to length / punctuation only;
  `preSendReviewNoBlockOnKeywords.test.ts` fails loudly if body text starts
  to influence the output beyond length / `?`-shape.

---

## §11 — Out of scope (explicit)

RULE-004 does **NOT** include:

- Any new **blocking** rule. Only the existing `evaluateArgumentDraft`
  structural validation blocks; RULE-004 re-shapes its result.
- Any AI / semantic advisory — that is **RULE-006**.
- Cooldown / rate-limit *mechanics* — that is **GAME-002**. `cooldown_active`
  is a reserved display kind with no v1 producer.
- Argument-mode strictness *profiles* (what makes a mode "strict") — that is
  **GAME-003**. RULE-004 ships the `mode` parameter + a dead-but-tested strict
  branch only.
- Tangent **auto-routing** — that is **BR-003**. RULE-004 only *suggests*
  `branch_tangent`.
- Any change to the Constitution engine, the transition table,
  `evaluateArgumentDraft`, or `FLAG_CODES`.
- Any change to RULE-005's `channelModel.ts` or `ChannelChipRow.tsx`.
- Any new `QuickActionLabel` or `quickActionPresets` entry.
- Persisting the review, the advisories, or a "saw the warning" flag —
  RULE-004 is render-time only, no migration, no Edge Function, no storage.
- Voting, search, push notifications, OAuth, public API — v1 scope guards.

---

## §12 — Doctrine self-check

- **cdiscourse-doctrine §1 — score never blocks posting; advisories are not
  verdicts.** RULE-004 adds **zero** blocking rules. `AdvisorySeverity` is
  exactly `'info' | 'soft'` — neither gates a post. The only thing that hides
  "Post anyway" is a `structuralBlock`, which is the *pre-existing* engine
  block (`evaluateArgumentDraft.blockingErrors`) re-shaped read-only. Every
  advisory describes a move's *structure* ("This is a wide claim", "This opens
  a new question"), never its truth, strength, or author. ✅
- **cdiscourse-doctrine §1 / Stage 6.2 — no keyword-only gating.**
  `buildPreSendReview` never inspects raw body text for keyword matching. The
  one body read is a deterministic *length / punctuation* shape read used only
  to raise an `info`/`soft` advisory — never to block. `preSendReviewNoBlock
  OnKeywords.test.ts` proves a keyword-laden but structurally-valid draft
  yields no block and that charged vs benign bodies of equal shape yield
  identical reviews. ✅
- **cdiscourse-doctrine §2 / §3 — heat / popularity are not signals.** The
  model reads typed structural fields, the engine's block/warning lists,
  LIFE-001/META-001 *structural* state, parent depth, and RULE-005's channel
  suggestion. It never reads a strength band, heat, reply count, or engagement.
  §7 #13 is a test that proves identical-structure / different-heat drafts get
  identical reviews. ✅
- **cdiscourse-doctrine §4 / §7 — no AI call.** `buildPreSendReview` is
  deterministic pure TS. No Anthropic / xAI / client AI / Edge Function.
  RULE-006 owns semantic advisories. ✅
- **cdiscourse-doctrine §5 — rules engine sacred / pure models.**
  `preSendReviewModel.ts` imports types + frozen copy tables only — no React,
  no Supabase, no network, no mutation, no async. It *consumes*
  `evaluateArgumentDraft`'s output; it never modifies or re-implements the
  engine. The engine stays the single source of truth for what blocks. ✅
- **cdiscourse-doctrine §9 — plain language.** Every advisory and block string
  is read from a frozen `gameCopy` block; no snake_case leaks;
  `preSendReviewBanList.test.ts` enforces zero verdict / amplification / person
  tokens and `looksLikeInternalCode === false`. ✅
- **cdiscourse-doctrine §10 — v1 scope.** No voting, search, notifications,
  OAuth, public API. No migration, no Edge Function. ✅
- **point-standing-economy — concession is a repair, not a defeat.** The
  `narrow` / `concede` transformations route to the existing `narrow` /
  `concede` presets, whose copy already frames narrowing as a repair (SC-004
  `NARROW_PRESET_BODY`). RULE-004 adds no new standing logic and no new copy
  that frames a concession as a loss; the `channel_mismatch` and other
  advisories never read or write point standing. ✅
- **expo-rn-patterns — RN primitives, no new dep.** `PreSendReviewSheet` is
  built from `View` / `Text` / `Pressable` / `ScrollView` / `Animated` —
  exactly the dock's existing primitives. **No new dependency.** No icon lib;
  text glyphs / shape carry meaning. The model is a pure `*Model.ts` per the
  repo convention. ✅
- **accessibility-targets — 44×44, role/label/state, reduce-motion.** Every
  sheet `Pressable` ("Post anyway", "Save draft", "Back to editing", each
  transformation) has `accessibilityRole="button"`, an `accessibilityLabel`,
  and a ≥ 44×44 hit target (or `hitSlop`). The sheet honours
  `reduceMotionOverride` (snap, no slide). Structural-block vs advisory
  sections are distinguishable by text/shape, not color alone (grayscale
  test). The sheet sets `accessibilityViewIsModal` over the composer. ✅
- **test-discipline — tests ship with the card.** §8 lists three model suites +
  one UI suite; every public function has happy-path + failure-case coverage;
  the ban-list test follows the existing safety-test pattern; the
  no-keyword-block test is a doctrine assertion. ✅
- **RULE-005 reconciliation — compose, don't duplicate.** RULE-004 reuses
  RULE-005's `suggestChannelFromDraft` model, its `suggestion.rationale` copy,
  and its channel-switch handler. It modifies neither `channelModel.ts` nor
  `ChannelChipRow.tsx`. The inline chip-row advisory (editing-time) and the
  sheet `channel_mismatch` advisory (send-time) are driven by the *same*
  `isMismatch` flag, so they can never contradict each other. ✅

---

## §13 — Operator steps and decisions

**Operator steps after the implementer commits: None — pure code change.**
No migration (`npx supabase db push`), no Edge Function deploy
(`npx supabase functions deploy`), no env var, no manual step. RULE-004 is
client-only pure TypeScript + one presentational component + a dock wiring.

**Operator decisions to confirm before / during the Build phase:**

- **OD-1 — strict-mode behaviour is dead until GAME-003.** RULE-004 ships the
  `mode` parameter and a fully-specified, unit-tested `strict` branch
  (per-advisory dismiss gating, `permanent_record_warning` upgraded to `soft`).
  But the dock always passes `mode: 'casual'` in v1 because no non-casual
  argument mode exists yet (GAME-003 owns that). *Decision:* accept that the
  strict branch is built-but-inert in v1 (recommended — it makes GAME-003 a
  pure wiring change), OR strip the strict branch entirely and re-add it in
  GAME-003. Recommendation: keep it (built + tested, zero runtime cost in
  casual mode).
- **OD-2 — `cooldown_active` reserved member.** The card lists `cooldown_active`
  as a structural-block kind, but GAME-002's pacing is **advisory-only** today
  (no blocking cooldown). *Decision:* accept `cooldown_active` as a reserved
  `StructuralBlockKind` with no v1 producer (recommended — keeps the enum
  forward-compatible for a future GAME-002 follow-up), OR drop it from the enum
  until a blocking cooldown actually exists. Recommendation: keep it reserved
  and documented; `projectBlockKind` simply never emits it in v1.
- **OD-3 — submit-flow seam.** Build-phase judgment: the `bypassReview` one-shot
  flag vs a `submitRef` imperative handle for "Post anyway" (§4.2). Prefer
  whichever produces the smaller, clearer diff to `ArgumentComposer` — the
  recommendation is the `bypassReview` flag (no `useImperativeHandle`).
