# RULE-005 — Structured argument channels (move-type field model)

## Superseded by — the one-box interface (QOL-030…033)

> Added 2026-05-21 from `docs/project-audits/2026-05-21-roadmap-collision-supersession-analysis.md`.

**Partial supersession.** RULE-005's pure model — `channelModel`,
`CHANNEL_DEFINITIONS`, `suggestChannelFromDraft` — is **shipped and stays**: it
is the box-type vocabulary the one-box composer consumes. Only the
**`ChannelChipRow` React surface** is superseded — it re-houses under **QOL-031
(Act popout)** as the flash-popout decision menu. **Do not rebuild
`ChannelChipRow` as a standalone surface.** See `docs/core/ux-ui-project-board.md` →
"Supersession map" and the QOL-031 design doc.

---

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (Rules-UX)
**Release:** 6.6 (Branches and evidence)
**Priority / Effort:** p0 / L
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/115
**Branch:** `feat/RULE-005-rule-005-structured-argument-channels-mo`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\RULE-005.md`
**Depends on (status verified against the repo — see §0):**
- LIFE-001 (#61) — MERGED. `src/features/lifecycle/` point-lifecycle model.
- META-001 (#62) — MERGED. `src/features/metadata/` move tag / metadata ledger.
- RULE-001 / RULE-003 (#32, #65) — MERGED. `gameCopy.PLAIN_LANGUAGE_COPY` + `src/features/rulesUx/lifecycleUxMap.ts`.
- COMPOSER-002 (#111, PR #150) — MERGED. `src/features/arguments/ArgumentComposerDock.tsx`.

---

## §0 — Card-vs-reality discrepancies (read this first)

The card body names several symbols and paths. Every one was checked against
the actual repo at the head of `main`. Where the card and reality disagree,
the design follows **reality**.

| # | Card says | Reality | Design decision |
|---|---|---|---|
| D1 | New file lives at `src/features/composer/channelModel.ts` | **`src/features/composer/` does not exist.** The whole composer/argument-room codebase lives under `src/features/arguments/` (`ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `conversationMoves.ts`, `quickActionPresets.ts`, etc.). | The pure-TS model ships at **`src/features/arguments/channelModel.ts`** — beside the other composer/argument models. Creating a new `composer/` folder for one file would fragment the feature; META-1A-style discrepancy handling: design against reality. |
| D2 | "Channel mismatch warning surfaces … in `PreSendReviewSheet` (RULE-004)" | **`PreSendReviewSheet` does not exist. RULE-004 has not been built** (no commit, no file, no issue artifact in the tree). | The mismatch advisory cannot be wired into a component that does not exist. The model (`suggestChannelFromDraft`) is fully designed here and is **forward-compatible** with RULE-004: when RULE-004 lands, its sheet calls `suggestChannelFromDraft` and renders the `reason`. Until then, the advisory surfaces inline in the existing `ArgumentComposerDock` channel-chip row (see §4). This is flagged as **Operator decision OD-1**. |
| D3 | "Each posted move's channel is recorded as a META-001 manual tag (e.g. `manual:channel/challenge`)" | META-001's `ManualTagCode` union is a **locked 10-code vocabulary** (`needs_source`, `needs_quote`, `definition_issue`, `scope_issue`, `causal_mechanism`, `evidence_debt`, `concession_offered`, `narrowed_claim`, `tangent`, `ready_for_synthesis`). It contains **no `channel/*` namespace** and no free-form tag string. `applyManualTag` rejects any code not in that union. The META-001 doctrine header explicitly states the vocabulary is "locked". | RULE-005 **must not** widen META-001's locked vocabulary — that would be a META-001 change, not a RULE-005 change, and would break META-001's ban-list and eligibility tests. See §3 "Data model" for the chosen carry mechanism: the channel is a **draft-time advisory field**, not a persisted manual tag in v1. Persisting the channel is flagged as **Operator decision OD-2** (a future migration). |
| D4 | "Channels (built on existing constitution argument types + tags)" lists **14 channels** including `Evidence interaction (EV-005)` and `Mode-specific procedural move` | EV-005 is a future card; "mode-specific procedural move" depends on GAME-003 (out of scope per the card's own Non-scope list). The 8 Constitution argument types are `thesis · claim · rebuttal · counter_rebuttal · evidence · clarification_request · concession · synthesis`. | The `MoveChannel` enum ships the **12 channels that map onto already-merged surface** (see §2). `evidence_interaction` and `mode_specific` are reserved as **documented future enum members** but are NOT emitted by `suggestChannelFromDraft` and have stub definitions — adding their real behaviour is EV-005 / GAME-003 work. This keeps RULE-005 inside its own scope. |
| D5 | `suggestChannelFromDraft(draft, parent, mode)` — `mode` parameter | "Mode strictness rules → GAME-003" is on the card's own Non-scope list. A `mode` value exists today only as the casual default (`DEFAULT_CASUAL_PACING_RULE` in `src/features/modes/`). | `mode` is accepted as a parameter (typed `ChannelSuggestionMode`) so the signature is stable for GAME-003, but in v1 it only ever takes the value `'casual'` and **never changes the suggestion** — it changes whether helper fields are *advisory* vs *required* downstream, and GAME-003 owns that. v1 behaviour is documented in §3. |
| D6 | "uses existing semantic flags from META-001 + LIFE-001" | META-001's `MoveLinkageRecord` and LIFE-001's `PointLifecycleSnapshot` are **tree-level** structures built from a fully-posted argument tree. A *draft being composed* has no `messageId`, no node in the timeline map, and therefore no `MoveLinkageRecord` / `PointLifecycleSnapshot` of its own. | `suggestChannelFromDraft` reads the **parent's** already-derived `PointLifecycleSnapshot` / `PointLifecycleClusterSummary` and `MoveLinkageRecord` (those exist — the parent is posted), plus the *draft's own* `argumentType` / `disagreementAxis` / `suggestedTagCodes` from `MoveDraftPatch`. It does **not** invent a draft-level lifecycle deriver. See §5 "API / interface contracts". |

None of these discrepancies block the card. The pure-TS model, the deterministic
suggestion logic, and the composer-chip integration are all buildable. The two
items that require an operator decision (OD-1 RULE-004 wiring, OD-2 channel
persistence) are isolated and called out explicitly so the Build phase does not
silently widen scope.

---

## Goal

A debate room today exposes argument **types** (the 8 Constitution types) and a
move **navigator** (`conversationMoves.ts` — 7 `ConversationMoveKind` options).
Those describe what the rules engine validates. RULE-005 adds a thin layer
*above* that: **channels** — a small, plain-language vocabulary that describes
the *structural purpose* of a move ("you are challenging", "you are asking for a
source", "you are conceding a narrow point") so the composer can (a) suggest the
channel that fits the draft and the parent, and (b) optionally reveal helper
fields for that channel (a URL field for "Add evidence", a quote field for "Ask
quote"). A channel is **never** a verdict — it labels what the move *does*,
never whether it is right, popular, or strong.

Doctrine constraints that shape the design (from `cdiscourse-doctrine`):

- **§1 — score never blocks posting.** A channel suggestion is advisory. It
  never blocks an ordinary post. Only the existing deterministic structural
  validation (`evaluateArgumentDraft`, the Constitution transition table) can
  block. A channel *mismatch* produces a re-route *suggestion*, never a
  punitive label and never a `structuralBlock`.
- **§4 / §7 — no AI call.** `suggestChannelFromDraft` is deterministic. It
  reads existing META-001 / LIFE-001 derived flags + the draft's own typed
  fields. No Anthropic, no xAI, no client AI, no Edge Function call. RULE-006
  (semantic AI channel detection) is explicitly out of scope.
- **§9 — plain language.** Every channel label is read through the existing
  `gameCopy` plain-language map. No new snake_case in any user-facing string;
  no new verdict tokens.
- **§5 — the rules engine is sacred.** `channelModel.ts` is pure TypeScript:
  no React, no Supabase, no network, no AI, no mutation. It imports types only.
- **§10 — no v1 scope item touched.** No voting, no search, no AI, no public
  API. RULE-005 is a UI-model card.

---

## Cannot-proceed check

The card is buildable. There is **no** doctrine conflict and **no** missing
hard dependency. The two soft gaps (RULE-004 not built, META-001 vocabulary
locked) are handled by §0 D2 / D3 without widening scope. The card proceeds.

---

## §1 — Architecture overview

Three layers, cleanly separated (the repo's `*Model.ts` convention):

```
┌─────────────────────────────────────────────────────────────┐
│ ArgumentComposerDock.tsx  (existing — COMPOSER-002)          │
│   + ChannelChipRow.tsx   (NEW — thin presentational strip)   │
│   + ChannelHelperFields.tsx (NEW — collapsed optional fields)│
└───────────────────────────┬─────────────────────────────────┘
                            │ imports, calls
┌───────────────────────────▼─────────────────────────────────┐
│ channelModel.ts  (NEW — pure TS, src/features/arguments/)    │
│   MoveChannel enum · channelDefinition() ·                   │
│   suggestChannelFromDraft() · CHANNEL_DEFINITIONS table      │
└───────────────────────────┬─────────────────────────────────┘
                            │ reads types only (no runtime import of derivers)
┌───────────────────────────▼─────────────────────────────────┐
│ EXISTING — read-only:                                        │
│   MoveDraftPatch (conversationMoves.ts)                      │
│   PointLifecycleSnapshot / ClusterSummary (lifecycle/)       │
│   MoveLinkageRecord (metadata/)                              │
│   PLAIN_LANGUAGE_COPY (gameCopy.ts)                          │
└──────────────────────────────────────────────────────────────┘
```

The model is unit-testable in isolation. The two new UI files are thin
presentational pieces that the Build phase wires into the existing dock.

---

## §2 — The `MoveChannel` vocabulary

12 active channels + 2 reserved (see §0 D4). Each channel maps onto an
already-merged surface — a Constitution argument type, a `ConversationMoveKind`,
a META-001 manual tag, or an EV-001 evidence interaction.

| `MoveChannel` value | Plain label (via gameCopy) | Maps to (existing) | Active in v1 |
|---|---|---|---|
| `reply` | Reply | `ConversationMoveKind.make_claim` / generic `answered` | ✅ |
| `challenge` | Challenge | `challenge_parent`, argument types `rebuttal` / `counter_rebuttal` | ✅ |
| `clarify` | Clarify | `ask_clarification`, type `clarification_request` | ✅ |
| `ask_source` | Ask for a source | `clarification_request` + qualifier `ask_receipts` / `source_request` | ✅ |
| `ask_quote` | Ask for a quote | `clarification_request` + qualifier `quote_exact_bit` / `quote_request` | ✅ |
| `add_evidence` | Add evidence | `add_evidence`, type `evidence` | ✅ |
| `narrow` | Narrow the claim | `concede_or_narrow` + qualifier `narrow_scope` / `concede_small_point` | ✅ |
| `concede` | Concede the point | `concede_or_narrow` + qualifier `concede_broad_point`, type `concession` | ✅ |
| `confirm` | Confirm the point | type `confirmation` / qualifier `pure_accept` (LIFE-001 `confirmed`) | ✅ |
| `synthesize` | Synthesize the thread | `synthesize_thread`, type `synthesis` | ✅ |
| `branch_tangent` | Branch a side issue | qualifier `branch_this_off` / `tangent_or_joke` (META-001 `tangent`) | ✅ |
| `meta_process` | Process note | room/process comment (no Constitution type — see §3) | ✅ |
| `evidence_interaction` | *(reserved — EV-005)* | EV-005 evidence-object interaction | ❌ reserved |
| `mode_specific` | *(reserved — GAME-003)* | GAME-003 mode procedural move | ❌ reserved |

**Why these names.** Each value is `snake_case` *internally* (it is a code, not a
string) and is rendered to the user **only** through the plain-language map. The
labels above are render strings — they go into `gameCopy.PLAIN_LANGUAGE_COPY`
(see §3 + §6). No label contains a verdict token. `branch_tangent`'s label is
deliberately non-punitive: "Branch a side issue", and its suggestion copy is
"This introduces a new issue — branch it?" — never "you are dodging".

`meta_process` has **no Constitution argument type** (a process note is not a
debate move). The channel is still useful in the composer as a *suggestion the
user can pick*, but selecting it does not change `argumentType`; v1 keeps the
user's existing type. Its `optionalFields` is empty. This is the one channel that
does not map 1:1 onto a Constitution type, and the design documents it so the
implementer does not try to invent a type for it.

---

## §3 — Data model

### 3.1 The pure-TS types (new — `channelModel.ts`)

```ts
/** RULE-005 — the structural-purpose vocabulary for a composed move. */
export type MoveChannel =
  | 'reply'
  | 'challenge'
  | 'clarify'
  | 'ask_source'
  | 'ask_quote'
  | 'add_evidence'
  | 'narrow'
  | 'concede'
  | 'confirm'
  | 'synthesize'
  | 'branch_tangent'
  | 'meta_process'
  // Reserved — NOT emitted by suggestChannelFromDraft in v1. See §0 D4.
  | 'evidence_interaction'  // EV-005
  | 'mode_specific';        // GAME-003

/** Frozen list of every channel. Tests + the chip row iterate this. */
export const ALL_MOVE_CHANNELS: ReadonlyArray<MoveChannel>;

/** The 12 channels surfaced as pickable chips in v1 (reserved 2 excluded). */
export const ACTIVE_MOVE_CHANNELS: ReadonlyArray<MoveChannel>;

/** Optional helper-field identifiers a channel may reveal. */
export type ChannelOptionalField =
  | 'source_url'
  | 'quote_text'
  | 'scope_example'
  | 'definition'
  | 'mechanism'
  | 'counterexample'
  | 'primary_source';

/** Static, frozen definition for one channel. */
export interface ChannelDefinition {
  channel: MoveChannel;
  /** Plain-language purpose sentence. READ from gameCopy — never authored here. */
  purpose: string;
  /** Optional structured field helpers this channel may reveal (collapsed). */
  optionalFields: ReadonlyArray<ChannelOptionalField>;
  /** Channels a user commonly moves to next. Advisory ordering only. */
  suggestedFollowups: ReadonlyArray<MoveChannel>;
  /**
   * Constitution argument type this channel produces, when there is a
   * 1:1 mapping. `null` for `meta_process` (no Constitution type) and
   * for the two reserved channels.
   */
  resultingArgumentType: ArgumentType | null;
}

/** Why suggestChannelFromDraft picked the channel it did. */
export type ChannelSuggestionReason =
  | 'deterministic_match'      // draft's own typed fields name the channel
  | 'lifecycle_state'          // parent's LIFE-001 state implies the next move
  | 'parent_demands_evidence'  // parent has an open source/quote request
  | 'no_signal';               // nothing deterministic — defaults to `reply`

export type ChannelSuggestionConfidence = 'low' | 'medium' | 'high';

/** v1: always 'casual'. Stable for GAME-003. See §0 D5. */
export type ChannelSuggestionMode = 'casual' | 'strict';

/** Output of suggestChannelFromDraft. */
export interface ChannelSuggestion {
  suggested: MoveChannel;
  reason: ChannelSuggestionReason;
  confidence: ChannelSuggestionConfidence;
  /**
   * Plain-language one-liner explaining the suggestion to the user.
   * READ from a frozen copy table — never authored at call time.
   * Satisfies the acceptance criterion "user can always understand WHY".
   */
  rationale: string;
  /**
   * True when the draft's *current* channel (the user's pick, if any)
   * differs from `suggested`. The composer shows the re-route advisory
   * only when this is true. NEVER a block.
   */
  isMismatch: boolean;
}
```

### 3.2 How the chosen channel is carried with a move

**v1: the channel is a draft-time advisory field. It does NOT persist.**

Rationale (this is the load-bearing data-model decision):

1. META-001's `ManualTagCode` union is **locked** (§0 D3). RULE-005 cannot add
   a `channel/*` tag without editing META-001, which would break META-001's
   ban-list and eligibility tests. That is out of RULE-005's footprint.
2. `public.arguments` has **no `channel` column**. Adding one is a migration —
   the card body does not ask for a migration, and the agent definition says
   *do not design a migration into this card unless the card demands it*. The
   card's §3 "Visible-in-Timeline metadata" *wants* the channel visible, but
   the card's own scope (§"Scope") lists the model + composer + Timeline-label
   surfacing — it never lists a migration or an Edge Function change.
3. The Timeline can already surface the channel **derived at render time**
   without persistence: LIFE-001 + META-001 already classify a posted move's
   structure (its `messageContribution`, its qualifier codes, its
   `autoDerivedMetadata`). A read-only helper `deriveChannelForPostedMove(node)`
   (see §5.4) maps an *already-posted* move's existing derived fields back to a
   `MoveChannel` for label display — no new storage, no new column. This is the
   same "read existing seams, never re-derive" pattern META-001 itself uses.

So the channel lives in **two** places, both without new storage:

| Phase | Where the channel lives | Mechanism |
|---|---|---|
| **Composing** | The dock's local component state (`useState<MoveChannel \| null>`). Threaded into the existing `MoveDraftPatch` via its existing fields. | The composer already maps a channel-equivalent (`moveKind`) onto `argumentType` / `disagreementAxis` / `suggestedTagCodes`. The channel chip drives the **same existing patch** — see §4.3. No new draft field is strictly required; an optional `channel?: MoveChannel` may be added to `MoveDraftPatch` purely as an in-memory hint (see §4.3 note). |
| **Posted (Timeline / Cards)** | Nowhere — derived at render time. | `deriveChannelForPostedMove(node)` reads the node's existing LIFE-001 / META-001 derived fields and returns a `MoveChannel` for the label. |

**The persisted-channel option (a real `arguments.channel` column) is deferred
and flagged as Operator decision OD-2.** If the product later wants the channel
to be the *author's stated intent* rather than a *render-time re-derivation*
(the two can differ — a move classified as `challenge` might have been composed
in the `clarify` channel), that requires a migration + an Edge Function change
to `submit-argument`. That is a separate card. RULE-005 v1 ships the
re-derivation path, which is doctrine-clean and migration-free.

### 3.3 New plain-language copy

`gameCopy.PLAIN_LANGUAGE_COPY` gains the 12 active channel codes + a small
`CHANNEL_PURPOSE_COPY` / `CHANNEL_RATIONALE_COPY` block. All new strings:
- ≤ 48 chars for labels, ≤ 90 chars for rationale lines.
- Zero verdict / amplification / person-attribution tokens.
- Plain English; no snake_case leak.

`PLAIN_LANGUAGE_COPY` keys are *not* allowed to collide. Two channel codes
overlap with existing keys: `tangent` (META-001 manual tag) and `synthesis`
(already present). To avoid collision the channel codes are **distinct strings**
(`branch_tangent`, `synthesize`) — see the §2 table; `synthesize` (channel) ≠
`synthesis` (existing key) and `branch_tangent` ≠ `tangent`. The implementer
must verify no key already exists before adding (the META-001 plain-language
coverage test will catch a collision).

---

## §4 — Composer integration

### 4.1 Where the chip row goes

COMPOSER-002's `ArgumentComposerDock.tsx` has a `handleStrip` containing the
`headerRow` (label "Compose your move" + `PacingChip` + Cancel). The dock then
renders `<ArgumentComposer mode="dock" … />` inside `composerBody`.

The channel chip row is a **new presentational strip rendered by the dock
directly below `handleStrip` and above `composerBody`** — a horizontally
scrolling `<ScrollView horizontal>` of channel chips. It is NOT rendered inside
`ArgumentComposer` itself, because:
- The dock owns chrome; `ArgumentComposer` owns the form. The chip row is
  chrome-adjacent (it influences the form but is a selector, not a field).
- Keeping it in the dock means the chip row is also reusable if a future card
  embeds the composer elsewhere.

New component: **`ChannelChipRow.tsx`** (presentational). New component:
**`ChannelHelperFields.tsx`** (the collapsed optional-field block, rendered
just below the chip row when a channel with `optionalFields` is selected and the
user expands it).

### 4.2 How the suggestion surfaces

On dock open (and whenever `parentArgument` / the draft's `argumentType` changes),
the dock calls `suggestChannelFromDraft(draft, parent, 'casual')`:

- The **suggested** channel's chip shows a small "Suggested" affordance — a
  text dot/label, NOT color-only (doctrine: color is never the only signal).
  `accessibilityLabel` includes ", suggested".
- A single-line **rationale** (`suggestion.rationale`) renders under the chip
  row: e.g. "The parent asked for a source — Add evidence fits here." This
  satisfies the acceptance criterion *"user can always understand WHY a channel
  is suggested"*.
- If `suggestion.isMismatch` is true (the user has already picked a channel
  that differs from `suggested`), the rationale line becomes a **non-punitive
  re-route advisory** with a "Switch channel" `Pressable`: "This reads more
  like a side issue — switch to Branch a side issue?" Tapping it sets the
  channel to `suggested`. Ignoring it does nothing — the post is never blocked.

**RULE-004 forward-compat (§0 D2).** The card wants the mismatch advisory in
`PreSendReviewSheet`. That component does not exist. The design ships the
advisory inline in the dock chip-row now; when RULE-004 lands, RULE-004's sheet
imports `suggestChannelFromDraft` and renders `suggestion.rationale` +
`suggestion.isMismatch` with the same "Switch channel" action. No model change
needed — the model is already the single source. This is **Operator decision
OD-1**: ship inline now, or wait for RULE-004. Recommendation: ship inline now
(the model is the value; the sheet is a render target).

### 4.3 How the user overrides

- Tapping any chip sets the channel. The chip row is a single-select radio
  group (`accessibilityRole="radio"`, `accessibilityState={{ selected }}`).
- Selecting a channel applies the channel's `resultingArgumentType` and
  suggested qualifier codes to the draft **through the existing
  `MoveDraftPatch` path** — the same path `quickActionPresets.ts` and
  `conversationMoves.mapMoveToDraftPatch` already use. RULE-005 adds a pure
  helper `channelToDraftPatch(channel, parentType, rules)` that returns a
  `MoveDraftPatch` (mirroring `mapMoveToDraftPatch`'s shape). It never sets a
  field the channel does not imply.
- The user can always pick a different chip, or ignore the suggestion entirely.
  Picking `meta_process` does **not** change `argumentType` (§2).
- Helper fields are **collapsed by default** (card requirement). A channel with
  non-empty `optionalFields` shows a "Add details" disclosure; expanding it
  reveals `ChannelHelperFields`. The fields are **advisory in casual mode** —
  leaving them empty never blocks the post.

**`MoveDraftPatch` optional `channel` field.** `MoveDraftPatch` (in
`conversationMoves.ts`) is owned by an earlier card. RULE-005 may add **one
optional field** `channel?: MoveChannel` to it — purely an in-memory hint so the
dock and `ArgumentComposer` agree on the current channel without a second state
holder. This is a 1-line type addition, additive, no behaviour change for
existing callers (mirrors the precedent of `body?: string` added by EV-002).
The Build phase should confirm this is the smallest change; if the dock can hold
the channel entirely in its own `useState` without threading it through the
patch, prefer that (zero change to `conversationMoves.ts`). Documented as a
**Build-phase judgment call**, not a hard requirement.

---

## §5 — API / interface contracts

### 5.1 `channelDefinition(channel)`

```ts
/**
 * Returns the frozen static definition for a channel. Pure O(1) lookup.
 * Throws on an unknown channel value (the union makes that unreachable
 * from typed callers; the throw guards untyped boundaries).
 */
export function channelDefinition(channel: MoveChannel): ChannelDefinition;
```

Backed by a module-level frozen `CHANNEL_DEFINITIONS: Readonly<Record<MoveChannel,
ChannelDefinition>>`. Each definition's `purpose` is read from the new
`CHANNEL_PURPOSE_COPY` block in `gameCopy.ts` — never authored inside
`channelModel.ts` (mirrors `getPointLifecyclePlainLabel` / `getManualTagPlainLabel`).

Example entries:

| channel | optionalFields | suggestedFollowups | resultingArgumentType |
|---|---|---|---|
| `challenge` | `scope_example`, `counterexample` | `add_evidence`, `clarify`, `branch_tangent` | `rebuttal` (or `counter_rebuttal` — resolved by caller from parent) |
| `ask_source` | `primary_source` | `add_evidence`, `challenge` | `clarification_request` |
| `ask_quote` | `quote_text` | `add_evidence`, `clarify` | `clarification_request` |
| `add_evidence` | `source_url`, `quote_text`, `primary_source` | `challenge`, `confirm` | `evidence` |
| `narrow` | `scope_example` | `synthesize`, `confirm` | `concession` |
| `concede` | — | `synthesize` | `concession` |
| `clarify` | `definition` | `reply`, `challenge` | `clarification_request` |
| `branch_tangent` | — | `reply` | `null` (branch is a topology op, not a type) |
| `meta_process` | — | `reply` | `null` |

Note `challenge`'s `resultingArgumentType`: the model returns `rebuttal` as the
**base** type; the actual rebuttal-vs-counter_rebuttal resolution is the
caller's job (it already exists — `resolveChallengeType` in `conversationMoves.ts`).
RULE-005 does not duplicate that logic.

### 5.2 `suggestChannelFromDraft(draft, parent, mode)`

```ts
export interface SuggestChannelDraftInput {
  /** The draft's currently-selected argument type, if any. */
  argumentType: ArgumentType | null;
  /** The draft's disagreement axis, if any (from MoveDraftPatch). */
  disagreementAxis: DisagreementAxis | null;
  /** Qualifier / tag codes already on the draft (MoveDraftPatch.suggestedTagCodes). */
  draftTagCodes: ReadonlyArray<string>;
  /** The channel the user has already picked, if any. Drives `isMismatch`. */
  currentChannel: MoveChannel | null;
}

export interface SuggestChannelParentInput {
  /** The parent move's LIFE-001 per-message snapshot. null for a root draft. */
  parentSnapshot: PointLifecycleSnapshot | null;
  /** The parent's LIFE-001 cluster summary. null for a root draft. */
  parentClusterSummary: PointLifecycleClusterSummary | null;
  /** The parent's META-001 linkage record. null for a root draft. */
  parentLinkage: MoveLinkageRecord | null;
}

/**
 * Deterministically suggests the channel that fits the draft + parent.
 *
 * Reads ONLY the inputs above — all of which are already-derived META-001 /
 * LIFE-001 surface (the parent is posted, so it has them) plus the draft's
 * own typed fields. NO AI. NO network. NO re-derivation of axis / category /
 * lifecycle. Pure. Deterministic. Idempotent.
 *
 * `mode` is accepted for GAME-003 forward-compat; in v1 it is always
 * 'casual' and does NOT change the suggested channel (see §0 D5).
 */
export function suggestChannelFromDraft(
  draft: SuggestChannelDraftInput,
  parent: SuggestChannelParentInput,
  mode: ChannelSuggestionMode,
): ChannelSuggestion;
```

**Deterministic derivation order** (first match wins — encoded as an ordered
rule list, fully unit-testable):

1. **`deterministic_match` / high** — the draft's own `argumentType` names the
   channel unambiguously: `evidence → add_evidence`, `synthesis → synthesize`,
   `concession` + `concede_broad_point` → `concede`, `concession` +
   (`narrow_scope`|`concede_small_point`) → `narrow`, `confirmation` /
   `pure_accept` → `confirm`, `clarification_request` + `ask_receipts`/`source_request`
   → `ask_source`, `clarification_request` + `quote_exact_bit`/`quote_request`
   → `ask_quote`, `clarification_request` (other) → `clarify`,
   `rebuttal`/`counter_rebuttal` → `challenge`.
2. **`deterministic_match` / medium** — the draft tag codes carry a tangent
   qualifier (`branch_this_off`, `tangent_or_joke`) → `branch_tangent`.
3. **`parent_demands_evidence` / high** — the parent's `parentSnapshot.messageContribution`
   is `source_requested` or `quote_requested`, OR
   `parentClusterSummary.hasOpenSourceOrQuoteRequest` is true → `add_evidence`
   (the move that resolves an open request). This is the highest-value
   suggestion: the parent literally asked for a source.
4. **`lifecycle_state` / medium** — the parent's cluster state implies the
   useful next move: `rebutted` → `challenge` (continue the pressure) or
   `add_evidence`; `branch_recommended` → `branch_tangent`; `synthesis_ready` →
   `synthesize`; `narrowed` / `conceded` → `synthesize` or `confirm`. The
   model picks the single highest-priority mapping (a small frozen table).
5. **`lifecycle_state` / low** — parent exists but state is `open` / `answered`
   → `reply`.
6. **`no_signal` / low** — no parent (root draft) and no draft type → `reply`.

`isMismatch = currentChannel !== null && currentChannel !== suggested`.
`rationale` is read from `CHANNEL_RATIONALE_COPY[reason]` (a frozen table keyed
by `ChannelSuggestionReason`, with `branch_tangent` getting its own
non-punitive line) — never authored at call time.

**No-keyword-block guarantee.** The model never inspects the *draft body text*.
It reads typed fields (`argumentType`, qualifier codes) and the parent's
already-derived structural state. It therefore cannot produce a keyword-only
mismatch that blocks a post — and it produces no block at all (its output is a
`ChannelSuggestion`, which has no `structuralBlock` field). This is asserted by
`__tests__/channelNoKeywordBlock.test.ts`.

### 5.3 `channelToDraftPatch(channel, parentType, rules)`

```ts
/**
 * Maps a user-picked channel to a MoveDraftPatch the composer applies.
 * Mirrors conversationMoves.mapMoveToDraftPatch — never sets a field the
 * channel does not imply. `meta_process` returns an empty patch (no type
 * change). Pure.
 */
export function channelToDraftPatch(
  channel: MoveChannel,
  parentType: ArgumentType | null,
  rules: ConstitutionRule[],
): MoveDraftPatch;
```

### 5.4 `deriveChannelForPostedMove(node)`

```ts
/**
 * Render-time reverse map: given an already-posted move's existing derived
 * fields (its LIFE-001 messageContribution + its META-001 qualifier/auto
 * codes, both already on the timeline node / linkage record), returns the
 * MoveChannel for label display in the Timeline / Cards. NO new storage.
 * Pure. Deterministic. Used by the Timeline metadata surface (§6 of card).
 */
export function deriveChannelForPostedMove(input: {
  messageContribution: PointLifecycleState;
  qualifierCodes: ReadonlyArray<string>;
  argumentTypeLabel: string;
}): MoveChannel;
```

This is the function the Timeline / Cards call to show "Channel: Challenge" on
a posted bubble — derived, not stored. It reuses the same mapping table as
rule 1 of `suggestChannelFromDraft` (a shared internal `classifyByTypeAndTags`
helper, so the forward and reverse maps cannot drift).

### 5.5 Component prop contracts (new UI files)

```ts
// ChannelChipRow.tsx
interface ChannelChipRowProps {
  channels: ReadonlyArray<MoveChannel>;   // = ACTIVE_MOVE_CHANNELS
  selectedChannel: MoveChannel | null;
  suggestion: ChannelSuggestion;
  onSelectChannel: (channel: MoveChannel) => void;
  reduceMotionOverride?: boolean;
}

// ChannelHelperFields.tsx
interface ChannelHelperFieldsProps {
  channel: MoveChannel;                   // the selected channel
  values: Partial<Record<ChannelOptionalField, string>>;
  onChangeField: (field: ChannelOptionalField, value: string) => void;
  /** v1: always 'casual'. In casual mode every field is advisory. */
  mode: ChannelSuggestionMode;
}
```

---

## §6 — File changes

### New files (RULE-005 footprint)

- `src/features/arguments/channelModel.ts` — the pure-TS model. `MoveChannel`,
  `ChannelDefinition`, `ChannelSuggestion`, `CHANNEL_DEFINITIONS`,
  `channelDefinition`, `suggestChannelFromDraft`, `channelToDraftPatch`,
  `deriveChannelForPostedMove`, `ALL_MOVE_CHANNELS`, `ACTIVE_MOVE_CHANNELS`,
  `_forbiddenChannelTokens()` (for the ban-list test). **~280–340 lines.**
- `src/features/arguments/ChannelChipRow.tsx` — horizontal scrolling chip row;
  radio-group semantics; "Suggested" affordance; one-line rationale + re-route
  advisory. **~160–200 lines.**
- `src/features/arguments/ChannelHelperFields.tsx` — collapsed optional-field
  block; one `TextInput` per `ChannelOptionalField`. **~120–160 lines.**
- `__tests__/channelModel.test.ts` — every channel has a definition. **~120 lines.**
- `__tests__/channelSuggestionDerivation.test.ts` — derivation rule table. **~180 lines.**
- `__tests__/channelNoKeywordBlock.test.ts` — advisory-not-block. **~70 lines.**
- `__tests__/channelCopyBanList.test.ts` — ban-list over all produced strings. **~90 lines.**

### Modified files

- `src/features/arguments/gameCopy.ts` — ADD 12 channel codes to
  `PLAIN_LANGUAGE_COPY` + a new `CHANNEL_PURPOSE_COPY` and
  `CHANNEL_RATIONALE_COPY` frozen block. Nothing existing changes. **~+40 lines.**
- `src/features/arguments/ArgumentComposerDock.tsx` — render `<ChannelChipRow>`
  below `handleStrip`; hold `selectedChannel` in `useState`; call
  `suggestChannelFromDraft` on open / parent change; pass the channel into the
  composer (see §4.3 — either a new optional `MoveDraftPatch.channel` or dock-local
  state). **~+50–70 lines.** No existing behaviour removed.
- `src/features/arguments/conversationMoves.ts` — *(optional, Build-phase call)*
  ADD one optional field `channel?: MoveChannel` to `MoveDraftPatch`. Additive,
  zero behaviour change. **~+2 lines.** Skip if dock-local state suffices.

### Files this card does NOT touch (and why)

- `src/features/metadata/*` — META-001's `ManualTagCode` vocabulary is locked.
  RULE-005 reads META-001 types; it adds nothing to META-001 (§0 D3).
- `src/features/lifecycle/*` — read-only consumer.
- `supabase/migrations/*` — no migration in v1 (§3.2). Persistence is OD-2.
- `supabase/functions/*` — no Edge Function change. `submit-argument` is untouched.
- `ArgumentComposer.tsx` — the form is unchanged; the channel chip lives in the
  dock chrome. (Exception: if the optional `MoveDraftPatch.channel` route is
  chosen, `ArgumentComposer` may read it — but it already accepts `initialPatch`,
  so even that is zero structural change.)

### Future-card footprint (NOT this card)

- `evidence_interaction` channel behaviour → **EV-005**.
- `mode_specific` channel + mode-strictness (required-vs-advisory fields) → **GAME-003**.
- `PreSendReviewSheet` mismatch surface → **RULE-004** (model is already ready).
- A persisted `arguments.channel` column + Edge Function write → a future
  migration card (OD-2).
- Tangent **auto-routing** (acting on the `branch_tangent` suggestion
  automatically) → **BR-003**. RULE-005 only *suggests*.
- Semantic AI channel detection → **RULE-006**.

---

## §7 — Edge cases

The implementer must handle each of these:

1. **Root draft (no parent).** `parent.*` inputs are all `null`. Rules 3–5 are
   skipped; the model falls through to rule 1 (draft type) or rule 6
   (`no_signal → reply`). Test covers a root thesis draft.
2. **Empty draft (no type picked yet).** `argumentType` is `null`,
   `draftTagCodes` empty. Rule 1 finds nothing; the parent's lifecycle state
   drives the suggestion (rule 3/4/5), or `no_signal`. Never throws.
3. **Parent has an open source request AND the draft is already typed as
   `evidence`.** Rule 1 (`deterministic_match`, high) wins over rule 3 — but
   both suggest `add_evidence`, so `confidence` is `high` and `isMismatch` is
   false. Test asserts no contradiction.
4. **User picked a channel, then changed the draft type underneath it.**
   `currentChannel` no longer matches `suggested` → `isMismatch = true`, the
   re-route advisory appears. The post is still allowed — the advisory is not a
   block. Test covers this.
5. **`meta_process` selected.** `channelToDraftPatch` returns an empty patch;
   `argumentType` is unchanged; `ChannelHelperFields` renders nothing
   (`optionalFields` empty). Selecting it never breaks the composer's existing
   validation.
6. **Channel maps to a Constitution type the parent does not allow.** e.g. user
   picks `synthesize` but the parent type forbids a `synthesis` reply. RULE-005
   does **not** re-validate transitions — that is the Constitution engine's job.
   `channelToDraftPatch` still returns the patch; `evaluateArgumentDraft`
   surfaces the real block in the existing validation panel. RULE-005 must not
   duplicate or pre-empt that. Test: `channelToDraftPatch` returns a patch even
   for a transition the engine will later reject (separation of concerns).
7. **Unknown channel string at an untyped boundary.** `channelDefinition`
   throws; `deriveChannelForPostedMove` falls back to `reply`. Both tested.
8. **Reduce motion.** The chip row's "Suggested" affordance and the re-route
   advisory must not animate when `prefersReducedMotion` is true (snap, no
   slide / pulse). The dock already threads `reduceMotionOverride`.
9. **Concurrent edits / offline.** RULE-005 is a pure draft-time model with no
   network. Offline has no effect on suggestion. There is no concurrency
   surface (no write). Documented as N/A.
10. **Doctrine edge — does heat or popularity ever change the suggested
    channel?** No. `suggestChannelFromDraft` reads `argumentType`, qualifier
    codes, and the parent's *structural* lifecycle state. It never reads a
    strength band, a heat value, a reply count as popularity, or any
    engagement signal. A `branch_tangent` suggestion fires from off-axis
    *structure*, never from "this is unpopular". Asserted by a test that feeds
    two parents identical in structure but different in (hypothetical) heat and
    expects identical suggestions.
11. **Doctrine edge — does a `concede` channel suggestion ever read as a
    defeat?** No. The `concede` rationale copy describes the move shape ("You
    are conceding the point") and the followup is `synthesize`. No "lost" /
    "defeated" / "wrong" token. Covered by the ban-list test.

---

## §8 — Test plan (Build-phase responsibility)

Per `test-discipline`: tests ship **with** the Build-phase code, not after.
Pure-model files require each public function to have unit tests including
failure cases.

- **`__tests__/channelModel.test.ts`**
  - Every `MoveChannel` in `ALL_MOVE_CHANNELS` has a `CHANNEL_DEFINITIONS`
    entry with a non-empty `purpose`, a `ReadonlyArray` `optionalFields`, and a
    `ReadonlyArray` `suggestedFollowups` (card acceptance criterion).
  - `suggestedFollowups` only contains valid `MoveChannel` values.
  - `channelDefinition` returns the frozen entry; throws on an unknown value.
  - `ACTIVE_MOVE_CHANNELS` excludes the 2 reserved channels;
    `ALL_MOVE_CHANNELS` includes all 14.
  - `channelToDraftPatch` returns the expected `argumentType` per channel;
    returns an empty patch for `meta_process`.
- **`__tests__/channelSuggestionDerivation.test.ts`**
  - A row-per-rule table: each of the 6 derivation rules fires for a crafted
    input and produces the expected `{ suggested, reason, confidence }`.
  - Root draft → `no_signal` / `reply`.
  - Parent with an open source request → `parent_demands_evidence` /
    `add_evidence` / `high`.
  - Parent `branch_recommended` → `lifecycle_state` / `branch_tangent`.
  - `isMismatch` true when `currentChannel` differs from `suggested`, false
    when equal or `currentChannel` is `null`.
  - Determinism: the same input twice → reference-stable output shape.
  - `deriveChannelForPostedMove` reverse-map parity with rule 1.
- **`__tests__/channelNoKeywordBlock.test.ts`**
  - `ChannelSuggestion` has **no** `structuralBlock` / blocking field.
  - A "keyword-only" mismatch (draft type says `clarify`, user picked
    `challenge`) yields `isMismatch: true` with a non-empty `rationale` and
    nothing that prevents posting.
  - The model never reads a body string (assert by passing inputs with no body
    field at all — the type makes this structural).
  - Two structurally-identical parents with different (mock) heat / reply
    counts produce the **same** suggestion (doctrine §1/§2).
- **`__tests__/channelCopyBanList.test.ts`**
  - Scan every produced string — all `purpose`, all `rationale`, every
    `PLAIN_LANGUAGE_COPY` channel label, `CHANNEL_PURPOSE_COPY`,
    `CHANNEL_RATIONALE_COPY` — for the forbidden token list (reuse the
    `_forbiddenMetadataTokens()` / `_forbiddenLifecycleTokens()` set: winner,
    loser, correct, true, false, liar, dishonest, bad faith, manipulative,
    extremist, propagandist, right, wrong, validated, plus amplification +
    block tokens). Zero matches.
  - The `branch_tangent` rationale specifically does NOT contain "dodge",
    "dodging", "evading", "avoiding" (non-punitive requirement — card
    acceptance criterion: *"This introduces a new issue — branch?", not
    "You're dodging"*).
  - `looksLikeInternalCode` is false for every channel label.
- **UI tests (React Testing Library, JSDOM)** — `__tests__/ChannelChipRow.test.tsx`:
  - The suggested chip exposes `accessibilityLabel` containing "suggested".
  - Every chip is `accessibilityRole="radio"` with `accessibilityState.selected`.
  - Hit target ≥ 44×44 (or `hitSlop`).
  - Tapping a chip calls `onSelectChannel` with the right channel.
  - The re-route advisory renders only when `suggestion.isMismatch`.
  - Grayscale check: the "Suggested" affordance is legible without color
    (text/shape, not color-only).

Test-count expectation: ~+55–70 tests across the four model suites + the UI
suite. The exact number is confirmed by the Build phase running `npm run test`.

---

## §9 — Dependencies (cards / docs / files)

- **Assumes LIFE-001 (#61) complete** — `suggestChannelFromDraft` reads
  `PointLifecycleSnapshot.messageContribution` and
  `PointLifecycleClusterSummary.hasOpenSourceOrQuoteRequest`. Verified present:
  `src/features/lifecycle/pointLifecycleModel.ts`.
- **Assumes META-001 (#62) complete** — reads `MoveLinkageRecord` and the
  qualifier codes on it; the channel reverse-map reuses META-001's qualifier
  vocabulary. Verified present: `src/features/metadata/moveMetadataLedger.ts`.
- **Assumes RULE-001 / RULE-003 (#32, #65) complete** — channel labels go into
  `gameCopy.PLAIN_LANGUAGE_COPY`; RULE-003's `lifecycleUxMap.ts` is the
  precedent for "read the label, never author it". Verified present.
- **Assumes COMPOSER-002 (#111) complete** — the chip row is hosted by
  `ArgumentComposerDock.tsx`. Verified present (PR #150, commit `eb4f014`).
- **Reads** `conversationMoves.ts` at `MoveDraftPatch` / `mapMoveToDraftPatch` /
  `resolveChallengeType` — RULE-005's `channelToDraftPatch` mirrors that shape
  and reuses `resolveChallengeType` rather than duplicating it.
- **Reads** `quickActionPresets.ts` — the `QuickActionLabel` → `MoveDraftPatch`
  precedent. The channel chips are conceptually a superset; RULE-005 does not
  replace `quickActionPresets` (the action dock still uses it).
- **Blocks RULE-004** — the `PreSendReviewSheet` mismatch advisory consumes
  `suggestChannelFromDraft` + `ChannelSuggestion`. RULE-004 cannot render a
  channel re-route until this model exists.
- **Blocks / enables RULE-006** — semantic AI channel detection would *replace*
  the deterministic rules in `suggestChannelFromDraft` with an Edge-Function
  classifier behind the same `ChannelSuggestion` return type. RULE-005 defines
  that contract.
- **Enables EV-005 / GAME-003** — the two reserved enum members give those
  cards a stable extension point.

---

## §10 — Risks

- **R1 — `PLAIN_LANGUAGE_COPY` key collision.** `synthesis`, `tangent`,
  `concession`, `narrowed` already exist as keys (LIFE-001 / META-001). The
  channel codes are deliberately distinct (`synthesize`, `branch_tangent`),
  but `confirm` / `clarify` / `reply` / `narrow` must be checked against the
  existing key set before adding. **Mitigation:** the META-001 plain-language
  coverage test (`maps every internal code`) will fail loudly on a duplicate
  key; the implementer runs `npm run test` early. Also `reply` is a safe new
  key, but `concede` vs existing `concession` and `narrow` vs existing
  `narrowed` must not be conflated — they are different keys, keep them
  separate.
- **R2 — Channel ≠ derived classification drift.** `suggestChannelFromDraft`
  (forward) and `deriveChannelForPostedMove` (reverse) must agree on the
  type→channel mapping. **Mitigation:** both call one shared private
  `classifyByTypeAndTags` helper; a test asserts round-trip parity.
- **R3 — Scope creep into RULE-004 / GAME-003.** It is tempting to build the
  `PreSendReviewSheet` or wire mode-strictness. **Mitigation:** §0 D2/D5 and §6
  "Future-card footprint" draw the line explicitly; the reserved enum members
  have stub definitions only.
- **R4 — `MoveDraftPatch` change.** Editing a type owned by an earlier card is
  low-risk (additive optional field) but should be the *smallest* possible
  change. **Mitigation:** §4.3 makes the field optional and flags the
  dock-local-state alternative; the Build phase picks the smaller diff.
- **R5 — Chip row crowding on narrow viewports.** 12 chips will not fit a
  phone width. **Mitigation:** the row is a horizontal `ScrollView` (the repo
  pattern — `argumentTimeline` scrubber, `quickActionPresets` chips already do
  this); the suggested chip scrolls into view on open. No new dependency.
- **R6 — No existing test depends on the composer dock's exact layout, but a
  snapshot test of `ArgumentComposerDock` (if one exists) will change.**
  **Mitigation:** the Build phase updates that snapshot deliberately and notes
  it; the chip row is purely additive chrome.

---

## §11 — Out of scope (explicit)

RULE-005 does **NOT** include:

- Any AI / semantic channel detection — that is **RULE-006**.
- Tangent **auto-routing** (automatically creating the branch) — that is
  **BR-003**. RULE-005 only *suggests* `branch_tangent`.
- Mode-strictness rules (which fields are *required* vs *advisory* per mode) —
  that is **GAME-003**. RULE-005 ships the `mode` parameter as a stable
  forward-compat hook only.
- The `PreSendReviewSheet` component — that is **RULE-004**. RULE-005 ships the
  model the sheet will consume and an interim inline advisory.
- The `evidence_interaction` channel's real behaviour — that is **EV-005**.
- Persisting the channel to the database (`arguments.channel` column, migration,
  Edge Function write) — a future migration card. v1 derives the channel at
  render time.
- Any change to META-001's locked `ManualTagCode` vocabulary.
- Any change to the Constitution transition table or `evaluateArgumentDraft`.
- Voting, search, push notifications, OAuth, public API — v1 scope guards.

---

## §12 — Doctrine self-check

- **cdiscourse-doctrine §1 — no truth labels; score never blocks posting.**
  A channel describes a move's *structural purpose* ("Challenge", "Ask for a
  source"), never its truth or strength. `ChannelSuggestion` has no blocking
  field; `suggestChannelFromDraft` cannot prevent a post. A channel *mismatch*
  is an advisory with a "Switch channel" action the user may ignore. ✅
- **cdiscourse-doctrine §2/§3 — heat / popularity are not signals.**
  `suggestChannelFromDraft` reads `argumentType`, qualifier codes, and the
  parent's *structural* lifecycle state only. It never reads strength bands,
  heat, reply counts as popularity, or engagement. §7 edge case 10 is a test
  that proves identical-structure / different-heat parents get identical
  suggestions. ✅
- **cdiscourse-doctrine §4/§7 — no AI call.** The model is deterministic pure
  TS. No Anthropic / xAI / Edge Function. RULE-006 owns AI detection. ✅
- **cdiscourse-doctrine §5 — rules engine sacred / pure models.**
  `channelModel.ts` imports types only — no React, no Supabase, no network, no
  mutation, no async. The two UI files import the model; the model imports
  nothing from them. ✅
- **cdiscourse-doctrine §9 — plain language.** Every channel label, purpose,
  and rationale is read from `gameCopy` and is plain English; no snake_case
  leaks; `channelCopyBanList.test.ts` enforces zero verdict tokens. ✅
- **cdiscourse-doctrine §10 — v1 scope.** No voting, search, notifications,
  OAuth, or public API. ✅
- **timeline-grammar — color is never the only signal.** The "Suggested" chip
  affordance and the re-route advisory use text + shape, not color alone;
  a grayscale snapshot test verifies it. The `branch_tangent` channel maps to
  the existing `branch` node visual — RULE-005 adds no new node visual. ✅
- **accessibility-targets — 44×44, role/label/state, reduce-motion.** Every
  chip is a `Pressable` with `accessibilityRole="radio"`,
  `accessibilityState.selected`, `accessibilityLabel` (incl. ", suggested" on
  the suggested chip), and ≥ 44×44 hit target. Helper-field `TextInput`s carry
  `accessibilityLabel`. The chip-row affordances honour `reduceMotionOverride`
  (snap, no animation). ✅
- **test-discipline — tests ship with the card.** §8 lists four model suites +
  one UI suite; every public function has happy-path + failure-case coverage;
  the ban-list test follows the existing safety-test pattern. ✅
- **META-001 doctrine — vocabulary is locked.** RULE-005 adds nothing to
  `ManualTagCode`; it reads META-001 types and reuses its qualifier vocabulary
  read-only. ✅

---

## §13 — Operator steps and decisions

**Operator steps after the implementer commits: None — pure code change.**
No migration (`npx supabase db push`), no Edge Function deploy
(`npx supabase functions deploy`), no env var, no manual step. RULE-005 v1 is
client-only pure TypeScript + two presentational components.

**Operator decisions to confirm before / during the Build phase:**

- **OD-1 — RULE-004 wiring.** The card wants the channel-mismatch advisory in
  `PreSendReviewSheet` (RULE-004), which is not built. *Decision:* ship the
  advisory inline in the `ArgumentComposerDock` chip row now (recommended — the
  model is the value, the sheet is just a render target), OR hold the advisory
  surface until RULE-004 lands. The model (`suggestChannelFromDraft`) ships
  either way and is forward-compatible.
- **OD-2 — channel persistence.** v1 derives the channel at render time
  (no migration). *Decision:* accept render-time derivation for v1 (recommended
  — migration-free, doctrine-clean), OR schedule a future card adding an
  `arguments.channel` column + an `submit-argument` Edge Function write if the
  product needs the *author's stated channel intent* preserved distinctly from
  the re-derived classification. This is a real future card, not RULE-005.
- **OD-3 — `MoveDraftPatch.channel` field.** Build-phase judgment: add one
  optional field to `MoveDraftPatch`, or hold the channel in dock-local state.
  Prefer whichever produces the smaller diff (§4.3 / R4).
```
