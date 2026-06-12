# REF-001 — Disagreement Contract + Referee Card

**Status:** Design draft (GATE-A artifact)
**Epic:** Rules UX
**Release:** 6.6
**Priority/Effort/Lane:** P0 · L · design-only (GATE A ends this card)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/584
**Verified-at-HEAD:** `c46c8e0` (every source `file:line` re-resolved at this SHA)
**Consumed by:** REF-002 (pure model) · REF-003 (card surface) · REF-004 (loop) · REF-005 (allegations)
**Soft input:** REF-ADR-001 (channels-as-user-facing-layer disposition — recorded here, ratified in parallel)

This is an **integration contract**, not a concept doc. It freezes the `DisagreementContract` / `OpenIssue`
derivation, the Referee Card zone spec + copy, the Open Issues rail vocabulary, and the test surfaces REF-002 / REF-003
must carry. No production code is written here.

---

## Goal (one paragraph)

CDiscourse asks a debater to hold five simultaneous vocabularies — Constitution argument types, RULE-005 move
channels, LIFE-001 lifecycle states, MCP boolean Observation families, and UX-001.5A user Allegations. Each is sound
machinery; together they are too many mental models to hold at once. REF-001 designs the single object the user holds
while debating: the **Disagreement Contract / Open Issue** — a first-class object *above the raw argument node and
below the room* — and its user-facing translation, the **Referee Card**. The Open Issue is a **convergence seam**, a
*pure derivation* over surfaces that already ship; it is **not** a new taxonomy, not a second compose system, not a
second scoring ledger, not a new classifier family, and not a new provider path. The doctrine that shapes every line
of this design: the deterministic engine (`src/domain/constitution/engine.ts`, mirrored at
`supabase/functions/_shared/constitution/`) is the sole submission gate and the Open Issue model never re-validates or
contradicts it; classifiers are advisory and run *after* an argument is stored; the Referee Card never emits a verdict
or person label, never says a user is wrong, never accuses motive, and always offers a move (cdiscourse-doctrine §1,
§4, §9, §10a). The slate's recommendation — and this design's decision — is **derived-only v1**: no persisted
`OpenIssue` table, no migration.

---

## What the object must answer (acceptance criterion — slate §4)

The `DisagreementContract` answers exactly six questions; each maps to a field and a frozen copy line:

| Question | Field | Derived from | Card copy |
|---|---|---|---|
| What exact point is under dispute? | `contestedProposition` + `targetQuote` | target/parent excerpt or exact quote anchor (deterministic, never AI-summarized) | "Point under dispute: …" + quoted chip |
| Which axis? | `axis` (8 values) | evidence-debt → `disagreementAxis` → manual tag → lifecycle debt → observation → process | One plain axis word |
| What is owed? | `burden` (5 values) | evidence/quote debt → clarification → reply → none | "The open task is {burden}." |
| What did the referee observe? | `refereeObservations` (≤1 on card) | the selected `RefereeBanner` + one summarized `NodeLabelMark` | "Referee note: {relation}." |
| What move keeps focus? | `nextBestMoves` (2–3) | `deriveSuggestedMoves()` ∩ `buildActPopout()` survivors | 2–3 Act buttons |
| How did it resolve? | `state` (8 values) | LIFE-001 state + evidence-debt status + concession/synthesis state | Open Issues rail label |

Every participant pays the same procedural cost — target → quote when needed → axis in plain language → provide /
request evidence / narrow / concede / branch. That symmetric cost is what keeps the surface level against social
pressure (slate §4).

---

## Data model

`DisagreementContract` (alias `OpenIssue`) is the reference shape from slate §4. REF-002 implements it as a pure model
at `src/features/refereeLoop/openIssueModel.ts` (the path the slate index §9 and REF-002's issue body name). v1 is
**derived-only**: the `id` is a deterministic string, not a DB primary key.

```ts
// src/features/refereeLoop/openIssueModel.ts  (REF-002 builds; REF-001 freezes the shape)

/** The 8 issue axes (slate §4). Plain labels only at the surface. */
export type DisagreementAxis =
  | 'evidence' | 'definition' | 'scope' | 'causal'
  | 'logic' | 'value' | 'framing' | 'process';

/** Relation of the move to its parent (8 values). `reply` is neutral. */
export type RelationToParent =
  | 'supports' | 'challenges' | 'asks_source' | 'asks_quote'
  | 'narrows' | 'branches' | 'concedes' | 'synthesizes' | 'replies';

/** What is owed on the issue (5 values). Evidence/quote outrank generic reply. */
export type IssueBurden =
  | 'source_owed' | 'quote_owed' | 'reply_owed' | 'clarification_owed' | 'none';

/** Resolution state (8 values; no hidden v1 states). */
export type IssueState =
  | 'open' | 'answered' | 'source_requested' | 'quote_requested'
  | 'narrowed' | 'conceded' | 'synthesis_ready' | 'moved_on';

/** A referee Observation summarized for the issue. Public card shows ≤1. */
export interface IssueObservation {
  /** The seeding banner code OR a NodeLabelMark id. NEVER user-visible raw. */
  sourceCode: string;
  /** Plain-language line (already routed through gameCopy / banner library). */
  line: string;
  /** Non-color tone marker carried from the banner when seeded from one. */
  toneGlyph: 'star' | 'arrow' | 'branch' | null;
  /** 'machine_observation' always — Allegations live in `userAllegations`. */
  kind: 'machine_observation';
}

/** A user Allegation surfaced on the issue. Never merged into Observations. */
export interface IssueAllegation {
  /** USER_ALLEGATION_REGISTRY rawKey. NEVER user-visible raw. */
  sourceCode: string;
  /** Plain-language line. */
  line: string;
  kind: 'user_allegation';
  /** Visibility gate — person-directed concerns stay composer/moderator only. */
  visibility: 'public' | 'composer_only' | 'moderator_only';
}

/** A next-best move — an Act entry that survived the gates, or a recovery route. */
export interface MoveSuggestion {
  /** A surviving `ActEntryId` (or the recovery `branch_tangent` entry). */
  actEntryId: string;
  /** Plain-language button label, read from the Act entry definition. */
  label: string;
  /** Verbose accessibility label, read from the Act entry definition. */
  accessibilityLabel: string;
  /** True when this replaced a gate-removed suggestion with its recovery route. */
  isRecoveryRoute: boolean;
  /** When `isRecoveryRoute`, the SuggestedMoveCode it recovered. Diagnostic only. */
  recoveredFromCode: string | null;
}

export interface DisagreementContract {
  /** Deterministic: `issue:<targetNodeId>:<relation>:<axis-or-debt>`. v1 not a DB row. Never shown raw. */
  id: string;
  /** Active room/debate id. null → no issue object exists. Not shown. */
  roomId: string | null;
  /** The anchored node / evidence object / concession set / branch / room target. Used for jump/focus. */
  targetNodeId: string | null;
  /** Exact quote/excerpt; never AI-summarized; null acceptable. Short quoted chip when present. */
  targetQuote: string | null;
  /** Deterministic excerpt/truncation of the contested point. No AI synthesis. */
  contestedProposition: string;
  axis: DisagreementAxis;
  relationToParent: RelationToParent;
  burden: IssueBurden;
  state: IssueState;
  /** Public card uses ≤1; Inspect shows grouped provenance. Family J never present. */
  refereeObservations: ReadonlyArray<IssueObservation>;
  /** User-applied, quote-targeted, procedural. Never merged into Observations. */
  userAllegations: ReadonlyArray<IssueAllegation>;
  /** 2–3 advisory Act buttons; only engine+role-gate survivors. */
  nextBestMoves: ReadonlyArray<MoveSuggestion>;
}
```

**No new persisted data model.** See "Derived-only v1 decision" below. The model imports **types only** from the
seam files and stays pure (no React, no Supabase, no network, no `Date.now()` — staleness inputs, if any, are injected,
exactly as `evidenceDebtModel.ts` does).

---

## Existing-surface convergence map (Scope 6 — required deliverable)

The Open Issue **composes** these seams into one turn-level reading —
`selected target → contested point → issue axis → burden/debt → referee observation → next valid Act move` — and owns
none of them. Every row: what the surface already owns · what the Open Issue / Referee Card consumes · what stays out
of scope.

| Existing surface / file | What it already owns | What the Open Issue / Referee Card consumes | Out of scope (stays where it is) |
|---|---|---|---|
| **Act** `oneBox/actPopoutModel.ts` (`buildActPopout`, `ActEntryId`, `actEntryToQuickAction`) | The 3-gate flash menu (engine + role hard-filter; stage soft-promote) | The **surviving entries** are the universe `nextBestMoves` may render; `relationToParent` reads the selected `ActEntryId` | The gate logic, the box-opening chassis, the preset bridge — never reimplemented |
| **Inspect** `oneBox/inspectContentBuilder.ts` + `inspectPopoutModel.ts` | The full-detail explanation surface | Nothing on the compact card; raw keys / family IDs / spans / confidence belong HERE | The popout itself; the Referee Card never renders raw codes |
| **Go** `oneBox/goPopoutModel.ts` + `timelineMiniMapModel.ts` + `timelineDensityLensModel.ts` | Navigation, lenses, viewport; **dims, never hides** | The Open Issues rail may ask Go to jump/filter to a `targetNodeId` | Go's dim-not-hide rule; lens math |
| **OneBox chassis** `oneBox/boxModel.ts`, `OneBox.tsx`, `Popout*.tsx` | The single switchable composer + popout shell | The Referee Card mounts beside it; the box drafts the next move | No second compose system is designed |
| **Suggested moves** `suggestedMovesModel.ts` (`deriveSuggestedMoves` :336) | Deterministic advisory next-move list (9 `SuggestedMoveCode`s) | The **input half** of `nextBestMoves` (intersected with Act survivors) | The rationale builder, the preset/dock maps — reused verbatim |
| **Node labels** `nodeLabels/nodeLabelTypes.ts` (`NodeLabelMark` :89), `machineObservationRegistry.ts`, `userAllegationRegistry.ts` (:139), `nodeLabelPresentationModel.ts` | Observations vs Allegations vocabulary; sensitive-surface gating; raw-key suppression; provenance | One summarized Observation (card) + the Allegation list (visibility-gated); the **axis** reads classifier family | The registries, the display caps, the descriptor adapter |
| **Referee banners** `refereeBanners/selectBanner.ts` + `types.ts` (`BannerSelectionResult` :151) | "One short non-verdict banner per move" selection | **Zone-1 seed** — the card's relation line seeds from `selectBanner()` output | `selectBanner` logic — wrapped, **never forked** |
| **Referee ledger** `refereeLedger/types.ts` (`CategoryReading` :166), `reconcileMove.ts` | Play-quality categories, feedback codes, conflict routing | `CategoryReading[]` feeds the banner selection input + (optionally) one Observation line | No second scoring ledger is built |
| **Evidence debt** `evidence/evidenceDebtModel.ts` (`EvidenceDebt`, `EvidenceDebtKind`, `EvidenceDebtStatus`) | Source-obligation debt lifecycle (render-time derived) | **Highest-precedence** input for `axis` (evidence) + `burden` (source/quote owed) + `state` (source/quote requested) | The debt derivation; the EV-003 doctrine (debt ≠ verdict) |
| **Lifecycle** `lifecycle/pointLifecycleModel.ts` (`PointLifecycleState` :80, 18 states; `PointLifecycleAxis`, 10 axes) | The cluster's gameplay state + axis | Primary `state` source; secondary `axis` source | LIFE-001 priority math; the 18→8 mapping is REF-002's |
| **Metadata ledger** `metadata/moveMetadataLedger.ts` (10 manual tags + 16 auto-metadata) | Participant annotations + deterministic machine metadata | Manual tags refine `axis` / `burden` / `relation`; auto-metadata refines `nextBestMoves` (via suggested-moves) | The ledger itself; the forbidden-imports boundary |
| **Active disagreement** `concessions/activeDisagreement.ts` (`ActiveDisagreementKind` framing/context/fact/none) | The room's live disagreement kind from acceptance rows | Maps to the `framing` axis as **issue-focus language only** | The acceptance-gradient model; never a truth/winner read |
| **Tangent routing** `arguments/tangentRoutingModel.ts` (`RedirectRisk`, `RedirectSuggestedAction`) | Structural redirect advisory (no person labels) | The **recovery route** for gate-removed suggestions ("Open a side issue") | The advisory itself; the no-block guarantee |
| **#504 card chassis** `arguments/cardView/CardDetailPanel.tsx`, `cardDetailModel.ts`, `cardClassifierStripModel.ts` | The data-rich active-card hub (5 zones; raw classifier strip) | REF-003 mounts the Referee Card **here**, above the raw strip | #504's five zones — REF-003 claims only the synthesized zone (see disposition below) |

**Parallel-taxonomy guard (slate §9A):** no new classifier family, no new provider path, no new compose system, no
second ledger, no new action-label vocabulary appears anywhere in this design. Every label is read from an existing
plain-language surface.

---

## Derivation table (Scope 7 — required deliverable; slate §4B frozen)

Every row filled with the live source, the rule, and the REF-002 test that pins it. **Precedence is justified after the
table.**

| Field | Derived from (live source) | Rule (v1 binding) | REF-002 test |
|---|---|---|---|
| `id` | `roomId`, `targetNodeId`, derived `relationToParent`, derived `axis`, first open debt kind | Deterministic string `issue:<targetNodeId>:<relation>:<axis-or-debt>`; v1 no DB row | `openIssueModel.test.ts` "id is deterministic + stable" |
| `roomId` | active room/debate id | Required; null → `buildOpenIssue` returns `null` (no issue) | `openIssueModel.test.ts` "null room → null issue" |
| `targetNodeId` | selected/active node id (or evidence object / concession set / branch / room target id) | Required; the issue is always anchored | `openIssueModel.test.ts` "anchors to the selected target" |
| `targetQuote` | `target_excerpt`, quote anchor (`sourceChainPopoverModel`), or selected evidence quote; else null | Prefer exact quote/excerpt; **never AI-summarized**; null acceptable | `openIssueModel.test.ts` "prefers exact quote; null OK; never synthesized" |
| `contestedProposition` | parent/target body excerpt or exact selected quote or node summary | v1 deterministic truncation/excerpt only; **no AI synthesis**; user-editable title is a later card | `openIssueModel.test.ts` "deterministic excerpt, no synthesis" |
| `axis` | open `EvidenceDebt` kind; LIFE-001 `PointLifecycleAxis`; Family B `disagreement_present` umbrella; manual tags; active-disagreement kind | **Precedence (high→low): evidence/quote debt → explicit `disagreementAxis` → manual tag → lifecycle debt → semantic observation → branch/process fallback.** Normalize via the table below | `openIssueModel.test.ts` "axis precedence" + `.actGateParity` cross-checks |
| `relationToParent` | selected `ActEntryId` → `MoveChannel` → stored `ArgumentType` → manual tag → lifecycle transition | Map to the 9 relation values; **`reply` is neutral** unless same-side + support evidence → `supports`; **never infer agreement from side alone** | `openIssueModel.test.ts` "relation precedence + reply-neutrality" |
| `burden` | open `EvidenceDebt` status/kind; LIFE-001 state; manual tag; `RefereeFeedbackCode`; unanswered target | `source_owed` / `quote_owed` (evidence/quote debt) **outrank** `clarification_owed` (definition/clarify) **outrank** `reply_owed` (generic) **outrank** `none` | `openIssueModel.test.ts` "burden precedence — evidence outranks reply" |
| `state` | LIFE-001 `PointLifecycleState` (18→8 map); `EvidenceDebtStatus`; concession/narrowing/synthesis state | Open debt state (`source_requested`/`quote_requested`) outranks lifecycle resolution state; map per the 18→8 table; no hidden v1 states | `openIssueModel.test.ts` "state 18→8 map + debt outranks" |
| `refereeObservations` | `selectBanner()` `BannerSelectionResult` + `NodeLabelMark[]` (production families A–I) + `CategoryReading[]` | Public card: **≤1** summarized observation (banner-seeded); Inspect: grouped provenance + raw codes; **Family J never present** | `openIssueModel.test.ts` ".sensitiveSurface" — J excluded; ≤1 on card |
| `userAllegations` | `USER_ALLEGATION_REGISTRY` / manual tags (REF-005 later adds the structured concern object) | User-applied, quote-targeted, procedural; **never merged** into Observations; person-directed → composer/moderator visibility only | `openIssueModel.test.ts` "allegations never merge; visibility gated" |
| `nextBestMoves` | `deriveSuggestedMoves()` **∩** `buildActPopout()` surviving entries | Advisory; render only entries that survive engine+role gates; a gate-removed suggestion surfaces its **recovery route**, never the invalid action | `.actGateParity` "no invalid-here action ever rendered; recovery route used" |

### Axis normalization (slate §4B — 8 OpenIssue axes ← live sources)

| OpenIssue axis | LIFE-001 axis | Manual tag | Classifier family / kind | Evidence-debt kind |
|---|---|---|---|---|
| `evidence` | `evidence`, `source`, `quote`, `fact` | `needs_source`, `needs_quote`, `evidence_debt` | Family D (`evidence_source_chain`); Family B `disputes_fact` / `disputes_evidence_applicability` / `disputes_interpretation` / `disputes_generalization` | `source`, `quote`, `receipt`, `context`, `primary_record` |
| `definition` | `definition` | `definition_issue` | Family B `disputes_definition`; Family C clarify/define-term | — |
| `scope` | `scope` | `scope_issue`, `narrowed_claim` | Family B `disputes_scope` | — |
| `causal` | `causal` | `causal_mechanism` | Family B `disputes_causal_link`; Family F `causal_mechanism_missing` | — |
| `logic` | `logic` | — | Family E argument-scheme; Family F critical-questions; Family B `disputes_analogy` | — |
| `value` | `value` | — | Family B `disputes_value_weighting` / `disputes_decision_criterion` / `disputes_priority_order` | — |
| `framing` | — | — | `ActiveDisagreementKind` framing/context/fact (issue-focus language only); Family B `disputes_relevance` | — |
| `process` | `unaxed` (fallback) | `tangent` | pacing / mode mismatch / branch hygiene / `moved_on*` / `ignored*` / `exhausted` | — |

> Note on `fact`: LIFE-001 axis `fact` and Family B `disputes_fact` are **evidence-resolvable**, so they normalize to
> `evidence` (the most concrete next move is a source/quote). The `ActiveDisagreementKind` value `fact` is a *different
> source* — the receiver's coarse stance on conceded points — and normalizes to `framing` as issue-focus language, per
> slate §4B. The two `fact` inputs are kept distinct in code.

### Precedence justification

- **Axis — evidence/quote debt first.** A live evidence/quote debt names the single most concrete next move ("get the
  source"). Surfacing it ahead of a generic disagreement axis gives the user the cheapest, clearest action and matches
  the banner library's own priority (`source_chain_gap` / `evidence_debt` / `quote_needed` rank 2–4 in
  `BANNER_CATEGORY_PRIORITY`, ahead of every other category). Below the debt, the explicit `disagreementAxis` (the
  classifier umbrella / LIFE-001 axis) is the user-stated/structural axis; manual tags are participant intent; lifecycle
  debt is a softer structural signal; semantic observations are advisory; `process` is the never-empty fallback.
- **Burden — evidence/quote owed outranks reply owed.** A `source_owed` / `quote_owed` debt is a concrete, dischargeable
  obligation; "reply owed" is diffuse. Promoting the concrete debt keeps the card actionable. (`evidenceDebtModel`'s
  `OPEN_EVIDENCE_DEBT_STATUSES` already defines "still owed".)
- **State — open debt outranks lifecycle resolution.** If a source/quote debt is still `requested`, the issue is
  `source_requested` / `quote_requested` even when the lifecycle cluster reads `answered`, because the user's next move
  is to discharge the debt, not to treat the issue as closed.
- **Relation — selected move first.** The user's explicit `ActEntryId` is their stated intent and the most authoritative
  relation source; stored type / tag / lifecycle are fallbacks for moves not initiated through the flash menu. The
  `reply`-neutrality rule (never read agreement from side alone) is doctrine: side ≠ agreement.

### Frozen compact copy set (slate §4B/§5 — ban-list-scanned, raw codes suppressed)

- **Relation labels:** `Challenges evidence` · `Asks for source` · `Asks for quote` · `Narrows scope` ·
  `Branches a side issue` · `Concedes a point` · `Ready to synthesize` · `Replies to the point` · `Supports the point`.
- **Burden labels:** `Source owed` · `Quote owed` · `Reply owed` · `Clarification owed` · `No open task`.
- **State labels (Open Issues rail):** `Open` · `Source requested` · `Quote requested` · `Answered` · `Narrowed` ·
  `Conceded` · `Ready to synthesize` · `Moved on`.
- **Axis labels:** `Evidence` · `Definition` · `Scope` · `Cause` · `Logic` · `Value` · `Framing` · `Process`.
- **Referee Card template:**
  `Referee note: {relation}. The open task is {burden}. Best next moves: {move1} · {move2} · {move3}.`

Direct claim-level critique copy is permitted (e.g. "source does not connect to the selected claim"); person-directed
characterization is not — the §2 prohibition list governs (see Doctrine self-check).

---

## `nextBestMoves` semantics (Scope 5 — the intersection)

`nextBestMoves` = `deriveSuggestedMoves(input)` **intersected with** the surviving `buildActPopout(input)` entries.
Neither model is re-authored; REF-002 only joins them.

**Step 1 — map each `SuggestedMoveCode` to an `ActEntryId`** (the canonical join; the dock/preset maps already in
`suggestedMovesModel.ts` make this 1:1 or documented-fallback):

| `SuggestedMoveCode` | `dockAction` | `presetKey` | → `ActEntryId` |
|---|---|---|---|
| `ask_source` | `ask_source` | `source` | `ask_source` |
| `ask_quote` | `ask_quote` | `quote` | `ask_quote` |
| `narrow` | `narrow` | `narrow` | `narrow` |
| `concede` | `concede` | `concede` | `concede` |
| `confirm` | `confirm` | `confirm` | `confirm` |
| `challenge_mechanism` | `challenge` | `challenge` | `challenge` |
| `challenge_scope` | `narrow` | `narrow` | `narrow` |
| `branch_tangent` | `branch` | `branch` | `branch_tangent` |
| `synthesize` | `synthesize` | `synthesize` | `synthesize` |

**Step 2 — intersect with Act survivors.** Flatten `buildActPopout(...)` (engine + role hard gates already applied;
stage soft-promote applied) into the set of surviving `ActEntryId`s. For each suggested move, in suggested-moves
priority order, up to 3:

- If the mapped `ActEntryId` **is** a survivor → render it as a `MoveSuggestion` (label + accessibilityLabel read from
  the Act entry definition). `isRecoveryRoute = false`.
- If the mapped `ActEntryId` **was gate-removed** (e.g. `narrow` invalid as a child of this parent, or role is
  `observer`) → **do not render the invalid action.** Surface its **recovery route** instead: the `branch_tangent`
  entry ("Open a side issue"), which carries `argumentType: null` and therefore always survives the engine gate for a
  `participant_other` node target (slate §3 recovery-route doctrine; RULE-004/RULE-005 advisory precedent). Set
  `isRecoveryRoute = true`, `recoveredFromCode = <the SuggestedMoveCode>`. If `branch_tangent` itself is not a survivor
  (e.g. observer role), the suggestion is **dropped**, not forced.

**Doctrine consequence:** the card can never present a button that the engine or role gate would reject — there is no
"click → rejected" path. A structurally-invalid-here move always converts to a recovery route or is dropped. This is
the §1 "score never blocks; advisory only" rule expressed as UI: the model is consultative, never gating.

```ts
function deriveNextBestMoves(input: {
  suggestionInput: SuggestionDerivationInput;     // → deriveSuggestedMoves
  actGroups: ActPopoutGroup[];                     // → buildActPopout output
  maxMoves?: number;                               // default 3
}): MoveSuggestion[];
```

---

## Referee Card zone spec (Scope 2 — the surface contract)

One compact card attached to the active issue — **never** a stack of raw families or flags. It mounts in
`CardDetailPanel.tsx` above the raw classifier strip (see #504 disposition). Three zones, frozen copy:

### Zone 1 — What this move is doing (one plain-language relation)

- Seeds from the selected `RefereeBanner` when `selectBanner()` returns one: the card's relation line uses the banner's
  `headline` (≤64 chars, ban-list clean) and `toneGlyph` (`star`/`arrow`/`branch` — a non-color shape marker).
  **`selectBanner` logic is never forked** — REF-003 calls it (or consumes a `BannerSelectionResult` passed in) and
  reads the result. The Open Issue object owns the burden/state/next-move context; the banner owns only the relation
  voice.
- When no banner is available, the relation line falls back to the `relationToParent` label from the frozen set
  (e.g. `Challenges evidence`). One line, never two.

### Zone 2 — What remains open (one debt or unresolved axis)

- One line from `burden` + `axis`: e.g. "The open task is a source or exact quote." / "The scope is unresolved." /
  "A definition is unclear." Never a stack; the single highest-precedence burden/axis wins (per the derivation table).
- When `burden === 'none'` and the state is terminal, zone 2 reads the state label ("Ready to synthesize." /
  "Conceded.") instead of an open-task line.

### Zone 3 — Next moves (2–3 buttons from the Act popout)

- 2–3 `MoveSuggestion` buttons from `nextBestMoves` (Ask source · Add evidence · Reply · Narrow · Branch · Concede ·
  Confirm · Synthesize). Each is a real `Pressable` (see accessibility). A recovery-route button reads its normal Act
  label ("Open a side issue") — it never reads as a rejection.
- Zero buttons is valid (observer with no compose rights, or a fully resolved issue) — the zone collapses; the card
  never fabricates an action.

**Frozen example surface copy (slate §5):**

> *"Referee note: This reply challenges the evidence for the parent claim. The open task is a source or exact quote.
> Best next moves: Ask source · Add evidence · Narrow the claim."*

Backed internally by many booleans; presents one coherent state; carries no truth/winner language (those tokens appear
in this doc only as prohibitions); never says the user is wrong; never accuses motive; always gives a move (or
collapses cleanly). Raw family IDs / rawKeys / spans / confidence appear only in Inspect.

### Open Issues rail / ledger (REF-001 defines; REF-003/REF-004 render)

Plain-language states only — `Source requested` · `Definition unclear` · `Scope narrowed` · `Evidence challenged` ·
`Ready to synthesize` (and the frozen 8-state set above). Each rail entry maps its `IssueState` through
`gameCopy.toPlainLanguageOrSuppress` (`gameCopy.ts:855`/`:893`); **unknown codes are suppressed, not echoed**. REF-002
registers the 8 `IssueState` codes in `PLAIN_LANGUAGE_COPY` (or routes them through the existing `LIFECYCLE_UX_MAP`
labels where a state aligns 1:1 — `source_requested`, `quote_requested`, `narrowed`, `synthesis_ready` already have
lifecycle labels), so the plain-language-coverage test passes without authoring fresh verdict-adjacent copy. Raw
classifier IDs only in Inspect.

---

## The loop verbs (Scope 4)

The shipped one-box chassis (`src/features/arguments/oneBox/`) becomes the implementation of one loop; REF-001 names
the wiring, REF-004 closes it:

> **Act changes the issue · Inspect explains the issue · Go moves around the issue map · the box drafts the next move ·
> the Referee Card summarizes what the MCP observed and what keeps the issue focused.**

- **Act** (`buildActPopout`) changes the issue: selecting an entry sets the next move's relation and (after it posts)
  the issue's `state`/`burden` shift on the next derivation.
- **Inspect** (`inspectContentBuilder`) explains the issue: it is the only home for raw keys, family IDs, evidence
  spans, confidence, provenance, and the grouped Observations/Allegations.
- **Go** (`goPopoutModel` + the two timeline lens models) moves around the issue map: the Open Issues rail may ask Go to
  jump/filter to a `targetNodeId`; Go still **dims, never hides**.
- **The box** (`boxModel`/`OneBox`) drafts the next move from the chosen Act entry.
- **The Referee Card** summarizes what the MCP observed (zone 1, banner-seeded) and what keeps the issue focused
  (zones 2–3). It updates **asynchronously** and **never blocks** a post.

---

## Inspect contract (Scope 9)

Raw keys, family IDs, evidence spans, confidence values, source provenance, and the **full grouped
Observations/Allegations** appear **only** in Inspect / admin diagnostic surfaces (`inspectContentBuilder.ts`,
`InspectPopout.tsx`, the `CardDetailPanel` hub classifier groups via `argumentDetailModel.HubClassifierGroupsModel`,
and `nodeLabelPresentationModel`'s `inspect` surface). The compact Referee Card carries **zero** raw codes — it shows
≤1 summarized Observation line, plain-language axis/burden/state labels, and Act-labelled buttons. Confidence on any
surface renders as **pips, never a number** (per #504). REF-003's `refereeCardNoRawCodes` test asserts no rawKey,
family id, span, or numeric confidence reaches the card. This is the same scan discipline the MCP stack uses.

---

## Derived-only v1 decision (Scope 5)

**Recommendation and decision: derived-only.** No persisted `OpenIssue` table, no migration, no new Edge read path.
Justification from a pre-launch codebase survey at `c46c8e0`:

- Every input the Open Issue reads is **already render-time derived**: `evidenceDebtModel` is explicitly "render-time
  derived in v1 (no `evidence_debt` table, no migration)"; `activeDisagreement` derives from existing
  `concession_acceptances` rows with "no new DB column"; `suggestedMovesModel`, `pointLifecycleModel`, and
  `selectBanner` are all pure derivations over already-persisted rows. **No shipped `OpenIssue` persistence seam
  exists** (the `REF-` namespace was confirmed clear of code at filing — slate index §5.12).
- A persisted Open Issue (cross-session issue history) would need a migration + RLS review and is a **named future
  card** (provisionally `REF-002B — Open Issue persistence`), never silently folded into this slate. This mirrors how
  REF-005 splits its persistence into `REF-005B`.

Derived-only stands.

---

## Four worked traces (Scope 11 — required deliverable)

Each shows input fields → derived issue → card copy → Act buttons. Inputs are abbreviated to the load-bearing fields;
the role is `participant_other` on a `node` target unless noted.

### Trace 1 — Source requested

- **Inputs:** selected `ActEntryId = ask_source`; `EvidenceDebt{ kind: 'source', status: 'requested' }`;
  LIFE-001 `state = source_requested`, `axis = source`; parent type `claim`; `sourceChainStatus = no_source`;
  `selectBanner()` → `source_chain_gap` banner.
- **Derived issue:** `relationToParent = asks_source`; `axis = evidence` (debt first); `burden = source_owed`;
  `state = source_requested`; `refereeObservations = [source_chain_gap banner line]`;
  `nextBestMoves`: `deriveSuggestedMoves` → `[ask_source]`; Act survivors include `add_evidence`, `ask_source`,
  `branch_tangent` → intersection keeps `ask_source`, then the card pads with the next survivors `add_evidence`,
  `narrow`.
- **Card copy:** *"Referee note: This move asks for a source. The open task is a source. Best next moves: Ask for a
  source · Add evidence · Narrow the claim."*
- **Act buttons:** `Ask for a source` · `Add evidence` · `Narrow the claim` (all engine+role survivors).

### Trace 2 — Quote requested

- **Inputs:** selected `ActEntryId = ask_quote`; `EvidenceDebt{ kind: 'quote', status: 'requested' }`;
  `sourceChainStatus = source_no_quote`; LIFE-001 `state = quote_requested`; manual tag `needs_quote`;
  `selectBanner()` → `quote_needed` banner.
- **Derived issue:** `relationToParent = asks_quote`; `axis = evidence`; `burden = quote_owed`;
  `state = quote_requested`; `refereeObservations = [quote_needed banner line]`;
  `nextBestMoves`: `deriveSuggestedMoves` → `[ask_quote]` (source-chain override), Act survivors keep `ask_quote`;
  pad with `add_evidence`, `branch_tangent`.
- **Card copy:** *"Referee note: This move asks for a quote. The open task is an exact quote. Best next moves: Ask for a
  quote · Add evidence · Open a side issue."*
- **Act buttons:** `Ask for a quote` · `Add evidence` · `Open a side issue`.

### Trace 3 — Scope narrowed

- **Inputs:** selected `ActEntryId = narrow`; stored type `concession`; LIFE-001 `state = narrowed`, `axis = scope`;
  manual tag `narrowed_claim`; no open evidence debt; `selectBanner()` → no banner (relation falls back to the label).
- **Derived issue:** `relationToParent = narrows`; `axis = scope`; `burden = none` (narrowing discharged the scope
  ask); `state = narrowed`; `refereeObservations = []` (no banner → zone 1 uses the relation label);
  `nextBestMoves`: `deriveSuggestedMoves` (lifecycle `narrowed`) → `[confirm]`; Act survivors keep `confirm`
  (argumentType `null`, exempt from the engine gate); pad with `synthesize`.
- **Card copy:** *"Referee note: Narrows scope. The scope is now narrower — no open task. Best next moves: Confirm ·
  Synthesize."* (Zone 2 reads the state, not an open-task line, because `burden = none`.)
- **Act buttons:** `Confirm` · `Synthesize`.

### Trace 4 — Tangent branched

- **Inputs:** selected `ActEntryId = branch_tangent`; manual tag `tangent`; auto-metadata `branch_suggested`;
  LIFE-001 `state = branch_recommended`, `axis = unaxed`; `tangentRoutingModel` `RedirectRisk = strong`;
  `selectBanner()` → `tangent_suggestion` banner.
- **Derived issue:** `relationToParent = branches`; `axis = process` (`unaxed` + `tangent` → process fallback);
  `burden = none`; `state = moved_on` (branch_recommended → moved_on per the 18→8 map);
  `refereeObservations = [tangent_suggestion banner line]`;
  `nextBestMoves`: `deriveSuggestedMoves` → `[branch_tangent, narrow]`; Act survivors keep both; render
  `branch_tangent`, `narrow`.
- **Card copy:** *"Referee note: Branches a side issue. This belongs on its own branch — no open task here. Best next
  moves: Open a side issue · Narrow the claim."*
- **Act buttons:** `Open a side issue` · `Narrow the claim`.

> A fifth illustrative case — **gate-removed suggestion → recovery route:** if the suggested `narrow` is an invalid
> child of the parent type, the intersection drops the invalid `narrow` button and renders the `branch_tangent`
> recovery route instead (`isRecoveryRoute = true`). The user never sees a button the engine would reject.

---

## API / interface contracts

REF-002 implements; REF-003 consumes. REF-001 freezes these signatures.

```ts
// REF-002 — pure model (src/features/refereeLoop/openIssueModel.ts)

export interface BuildOpenIssueInput {
  roomId: string | null;
  targetNodeId: string | null;
  // Relation sources (highest precedence first)
  selectedActEntryId: ActEntryId | null;
  selectedChannel: MoveChannel | null;
  storedArgumentType: ArgumentType | null;
  sameSideAsParent: boolean;            // for the reply→supports rule (never side alone)
  carriesSupportEvidence: boolean;      // for the reply→supports rule
  // Act-gate intersection inputs
  parentType: ArgumentType | null;
  viewerRole: ActViewerRole;
  rules: ReadonlyArray<ConstitutionRule>;
  // Axis / burden / state sources
  lifecycleState: PointLifecycleState | null;
  lifecycleAxis: PointLifecycleAxis | null;
  openEvidenceDebts: ReadonlyArray<EvidenceDebt>;       // already filtered to open statuses by caller
  sourceChainStatus: SourceChainStatus | null;
  manualTags: ReadonlyArray<ManualTagCode>;
  autoMetadata: ReadonlyArray<AutoMetadataCode>;
  activeDisagreementKind: ActiveDisagreementKind | null;
  // Observations / allegations (production families A–I; J excluded)
  machineObservations: ReadonlyArray<NodeLabelMark>;    // model RE-ASSERTS the J gate (HUB_NON_PRODUCTION_FAMILIES)
  bannerSelection: BannerSelectionResult | null;        // zone-1 seed (never re-derived)
  categoryReadings: ReadonlyArray<CategoryReading>;
  userAllegations: ReadonlyArray<NodeLabelMark>;        // user_allegation kind
  // Excerpt sources
  targetExcerpt: string | null;
  quoteAnchor: string | null;
  // next-best-moves source (passed straight to deriveSuggestedMoves)
  suggestionInput: SuggestionDerivationInput;
}

/** Total + deterministic + pure. Returns null when roomId or targetNodeId is null. */
export function buildOpenIssue(input: BuildOpenIssueInput): DisagreementContract | null;

// Named, individually-tested derivation helpers:
export function deriveOpenIssueAxis(input: BuildOpenIssueInput): DisagreementAxis;
export function deriveOpenIssueRelation(input: BuildOpenIssueInput): RelationToParent;
export function deriveOpenIssueBurden(input: BuildOpenIssueInput): IssueBurden;
export function deriveOpenIssueState(input: BuildOpenIssueInput): IssueState;
export function deriveNextBestMoves(input: { suggestionInput: SuggestionDerivationInput; actGroups: ActPopoutGroup[]; maxMoves?: number; }): MoveSuggestion[];
```

```ts
// REF-003 — surface view model (recommended; REF-003 design owns the final shape)
export interface RefereeCardViewModel {
  zone1RelationLine: string;        // banner headline OR relation label
  zone1ToneGlyph: 'star' | 'arrow' | 'branch' | null;
  zone2OpenTaskLine: string;        // burden+axis OR terminal-state line
  zone3Moves: ReadonlyArray<MoveSuggestion>;   // 2–3 Act buttons
  refereeNoteSentence: string;      // the full frozen-template sentence
  accessibilityLabel: string;       // one complete screen-reader sentence
}
export function buildRefereeCardViewModel(issue: DisagreementContract): RefereeCardViewModel;
```

The model imports **types only** from the seam files and adds **no value-import** of `supabase`, `fetch`, `anthropic`,
`xai`, React, or any router — mirroring the boundary already enforced on `suggestedMovesModel.ts` and
`selectBanner.ts`.

---

## Edge cases

- **No active room / no selected node** → `buildOpenIssue` returns `null`; no Referee Card mounts (no issue to show).
- **Root claim (no parent, `parentType === null`)** → the engine gate keeps only `null`-`argumentType` Act entries;
  `relationToParent` defaults to `replies`; `nextBestMoves` may be `add_evidence` / `branch_tangent` only.
- **Observer role** → `buildActPopout` survivors are `watch`/`join_*`/`chime_in`/`view_qualifiers` only; none map to a
  `SuggestedMoveCode`, so `nextBestMoves` is empty and zone 3 collapses. The card still shows zones 1–2 (read-only
  reading of the issue).
- **Own bubble** → Act survivors are `view_qualifiers` + `request_deletion` only; `nextBestMoves` empty; zone 3
  collapses. (Own-bubble safety rule: no edit/disagree/flag/score on your own move.)
- **Engine says zero valid types** (empty `rules`) → all typed Act entries removed; only `null`-type entries (e.g.
  `branch_tangent`, `confirm`) can survive; if none survive, zone 3 collapses.
- **Gate-removed suggestion** → recovery route (`branch_tangent`) substitutes; if it too is removed, the suggestion is
  dropped. Never a rejected button.
- **Multiple open evidence debts** → the highest-precedence open debt (source before quote before the rest) drives
  `axis`/`burden`/`state`; the others surface only in Inspect.
- **No banner available** → zone 1 falls back to the `relationToParent` label; `refereeObservations` may be empty.
- **Unknown / unmapped state code** → `toPlainLanguageOrSuppress` returns `null`; the rail entry is **suppressed**,
  never echoed raw.
- **Family J observation in the input** (`sensitive_composer` — `shifts_to_person_or_intent` /
  `contains_unplayable_insult_only` / `needs_pre_send_pause`) → re-asserted out by the model's `HUB_NON_PRODUCTION_FAMILIES`
  gate; never reaches `refereeObservations`; stays composer-only.
- **Person-directed user Allegation** → `visibility = composer_only` or `moderator_only`; never rendered on the public
  card.
- **Heat / popularity tries to influence the issue** → it does not: no field reads engagement, view count, virality,
  or a strength band. The model never imports a temperature band (mirrors the `suggestedMovesModel` doctrine).
- **Concurrent edits / async classifier arrival** → the issue is re-derived on each render from current inputs; a late
  classifier result simply changes the next derivation. Nothing blocks or delays the post in the meantime.

---

## Referee-banner disposition vs #504 (the named collision — required decision)

**Decision: the Referee Card zone 1 absorbs the standalone `RefereeBanner` that #504's slice 4 relocates into card
detail. #504 slice 4 does NOT mount a separate `RefereeBannerView` in card detail.**

Rationale and mechanism:

- #504 slice 4 originally plans to "move sidecar + referee banner into card detail." If that lands as a *standalone*
  `RefereeBannerView` AND REF-003 adds a Referee Card, the card detail panel would render the same banner twice and two
  pipelines would race on the same zone (slate §10 "REF-003 duplicates #504" risk).
- The Referee Card is, per slate §9, "the synthesized one-state layer that sits above #504's raw classifier strip."
  Zone 1 already **seeds from `selectBanner()`** — the identical `BannerSelectionResult` #504 would have rendered. So
  the banner content has exactly one home on the card: zone 1 of the Referee Card.
- Therefore: #504's slice-4 referee-banner relocation is **fulfilled by** REF-003's Referee Card zone 1, not by a
  separate banner element. The #504 amendment comment (`issuecomment-4688728719`) already records this expectation;
  REF-001 ratifies it here. `selectBanner` logic is **never forked** — both surfaces read its output.
- Boundary in one line (carried from the #504 amendment): **#504 stays the chassis + raw-data layer (5 zones, raw
  classifier strip, evidence/standing strips, full action dock); the Referee Card is the synthesis layer mounted above
  the raw strip.** REF-003's 2–3 next-move buttons are the *synthesized subset*, distinct from #504's full zone-5
  action dock. REF-003 claims **only** the Referee Card zone; it changes none of #504's five zones.

Sequencing: REF-003 coordinates with #504's slice order at launch (REF-003 depends on REF-002; it reconciles slice
order with #504's then-current pipeline state).

---

## Dependencies (cards / docs / files)

- **QOL-030/031/032/033 (built; `src/features/arguments/oneBox/`)** — the loop's chassis. Act = changes the issue /
  Inspect = explains it / Go = navigates it / the box drafts the next move. `buildActPopout` is the survivor universe
  for `nextBestMoves`; the design reads the live code (the doc headers lag build state). REF-004 closes the loop.
- **RULE-005 (`docs/designs/RULE-005.md`)** — the 12 active `MoveChannel`s are the user-facing move-intent layer the
  relation reads; the advisory/no-keyword-block doctrine (`:70-74`, `:469-506`) is the precedent for recovery routes.
- **UX-001.5A (`docs/designs/UX-001.5A.md`; `nodeLabels/`)** — the Observations vs Allegations schema. `NodeLabelMark`
  is the Observation/Allegation input; `AnnotationChipDescriptor.source` is optional (`source?:`,
  `annotationChipDescriptor.ts:111`) and an adapter bridges the roadmap-level `machine_observation | user_allegation`
  form. REF-005 builds the structured allegation object on this substrate.
- **#504 CARD-VIEW-DATA-001 (OPEN)** — REF-003 renders into the same `CardDetailPanel.tsx` chassis; the referee-banner
  unification disposition above is the named touch point. REF-002's derived issue state is a *new input* #504's card
  view can consume; no duplicate model is built (SC-003 / ST-002 / GAL-002 "suggested next move" surfaces become
  consumers).
- **Reads existing code at:** `buildActPopout` (`actPopoutModel.ts:685`), `deriveSuggestedMoves`
  (`suggestedMovesModel.ts:336`), `selectBanner` (`refereeBanners/selectBanner.ts:155`), `CategoryReading`
  (`refereeLedger/types.ts:166`), `EvidenceDebt*` (`evidenceDebtModel.ts`), `PointLifecycleState`
  (`pointLifecycleModel.ts:80`), `ActiveDisagreementKind` (`activeDisagreement.ts:47`), `toPlainLanguage`
  (`gameCopy.ts:855`), `HUB_NON_PRODUCTION_FAMILIES` (`argumentDetailModel.ts:670`), `NodeLabelMark`
  (`nodeLabelTypes.ts:89`), Family B definitions (`machineObservationDefinitions/familyB.ts`).
- **Blocks:** REF-002 (implements this derivation) → REF-003 (renders the card) → REF-004 (the loop); REF-005
  (structured allegations) depends on REF-001 GATE A + shipped UX-001.5A.
- **REF-ADR-001 (soft input):** the channels-as-user-facing-layer disposition. REF-001 records the recommended
  disposition (Constitution types stay the validation layer; channels are the drafting vocabulary; the matrix becomes
  a hidden affordance + recovery system) and proceeds; the ADR ratifies in parallel. No P0 card hard-depends on the P2
  ADR.

---

## Risks

- **REF-002 silently becomes a second engine.** Mitigation: the model is consultative, derives only, never re-validates
  or contradicts the engine; the acceptance-gate invariant is restated below; `.actGateParity` tests pin that
  `nextBestMoves` is a *subset* of `buildActPopout` survivors and never invents a move.
- **Referee Card copy drifts toward verdict tokens.** One synthesized sentence is more tempting to editorialize than
  twenty booleans. Mitigation: the frozen §4B/§5 copy pattern; the `refereeCardBanList` + `openIssueModel.banlist`
  tests scan every emitted label; copy review at GATE A.
- **`selectBanner` gets forked.** Mitigation: REF-002/REF-003 consume `BannerSelectionResult`; a test asserts no banner
  category-priority or selection logic is re-implemented in `refereeLoop/`.
- **Family J leaks onto a public card.** Mitigation: the model re-asserts the `HUB_NON_PRODUCTION_FAMILIES` gate even
  though upstream already filters; `.sensitiveSurface` pins it.
- **Existing tests that may need updating:** none in REF-001 (docs-only). REF-002 adds tests; REF-003 adds UI tests; the
  full Jest suite is the non-decreasing regression gate. Plain-language coverage gains 8 `IssueState` codes — REF-002
  must add them to `PLAIN_LANGUAGE_COPY` (or route through `LIFECYCLE_UX_MAP`) or the coverage test fails.
- **Small-screen placement (open question).** Where the Referee Card lives on phone — inside `CardDetailPanel` (default)
  vs pinned above the composer. Recommendation: mount in `CardDetailPanel` as the zone above the raw strip on all
  viewports; on phone (`Platform.OS !== 'web'` or width < 1024) render a compact variant of the **same** view model
  pinned above the composer when the card detail is not in view. REF-003 resolves with mockups; flagged for operator
  review.

---

## Out of scope

- **No code, no migration, no AI call, no new MCP family, no new rawKey, no ban-list edit, no `familyRegistry` change.**
  Family J stays `productionEnabled: false`; sensitive Observations stay composer-only.
- **No change to the stored type system or the transition matrix.** CLM/RBT/CRB/EVD/CLR/CON/SYN and the matrix stay the
  validation layer.
- **No persistence for the Open Issue object** (derived-only; persistence is the named future `REF-002B`).
- **No second compose system, no second scoring ledger, no new action-label vocabulary, no new provider path.**
- **No Constitution v1.1 text change** — that disposition is REF-ADR-001's.
- **No user-editable issue title** (deterministic excerpt only in v1; an editable title is a later card).
- **No structured allegation object** — that is REF-005.
- **No queue/routing arm, no percentage change, no Edge deploy.**
- **v1 scope guards:** no voting, no winner-producing scoring, no OAuth, no push notifications, no public API, no
  argument search.

---

## Test plan (Scope: REF-001 names the files REF-002/REF-003 carry; design-only card writes none)

### REF-002 — pure model tests (`src/features/refereeLoop/`)

- **`__tests__/openIssueModel.test.ts`** — happy path + every derivation helper:
  - `deriveOpenIssueAxis` precedence (evidence/quote debt → `disagreementAxis` → manual tag → lifecycle debt →
    observation → process fallback), including the `fact` normalization split (LIFE-001 `fact` → `evidence`;
    `ActiveDisagreementKind` `fact` → `framing`).
  - `deriveOpenIssueRelation` precedence + the `reply`-neutrality rule (same side alone never → `supports`).
  - `deriveOpenIssueBurden` (evidence/quote owed outranks reply owed) and `deriveOpenIssueState` (18→8 map; open debt
    outranks lifecycle resolution).
  - `buildOpenIssue` returns `null` for null room/target; deterministic `id`; all four worked traces reproduced
    field-for-field.
  - Edge cases: root claim, multiple debts, no banner, unknown state code suppressed.
- **`__tests__/openIssueModel.banlist.test.ts`** — scans every emitted user-facing string (relation/burden/state/axis
  labels, the Referee Card sentence) for the prohibited verdict/person tokens (winner, loser, correct, incorrect,
  truth, untrue, dishonest, liar, manipulative, extremist, propagandist, stupid, idiot, verdict, "bad faith",
  "proof of") and for raw `snake_case` leakage (`looksLikeInternalCode`). Asserts the plain-language coverage of the 8
  `IssueState` codes.
- **`__tests__/openIssueModel.actGateParity.test.ts`** — `nextBestMoves` is always a subset of `buildActPopout`
  survivors; a gate-removed suggestion surfaces its recovery route (`isRecoveryRoute = true`) and **never** the invalid
  action; observer/own-bubble roles yield empty `nextBestMoves`; the `SuggestedMoveCode → ActEntryId` map is exhaustive.
- **`__tests__/openIssueModel.sensitiveSurface.test.ts`** — Family J (`sensitive_composer`) observations never reach
  `refereeObservations`; the public card carries ≤1 Observation; person-directed Allegations carry composer/moderator
  visibility and never render public; Allegations are never merged into Observations.
- **Forbidden-imports test** (pattern of `suggestedMovesModel`/`selectBanner`): no value-import of `supabase`, `fetch`,
  `anthropic`, `xai`, React, or a router in `refereeLoop/`.

### REF-003 — surface tests (`src/features/arguments/cardView/` or `refereeLoop/`)

- **`__tests__/RefereeCardView.test.tsx`** — renders the three zones from a `DisagreementContract`; zone 3 renders 2–3
  buttons; zones collapse cleanly when empty; the full Referee Card sentence matches the frozen template; zone 1 seeds
  from the banner when present and falls back to the relation label otherwise.
- **`__tests__/refereeCardBanList.test.tsx`** — the rendered tree contains none of the prohibited verdict/person tokens.
- **`__tests__/refereeCardNoRawCodes.test.tsx`** — no rawKey, family id, evidence span, or numeric confidence reaches
  the card; confidence (where shown) is pips; unknown state codes are suppressed.
- **`__tests__/refereeCardA11y.test.tsx`** — every Act button is a `Pressable` with `accessibilityRole="button"`,
  populated `accessibilityLabel` (reads the action name, not a key badge), `accessibilityState`, and ≥44×44 hit target
  (via size or `hitSlop`); the card exposes one complete screen-reader sentence; tone is carried by a shape glyph, not
  color alone (grayscale-legible); the card is reduce-motion safe (static, nothing animates).

---

## Doctrine self-check

**Acceptance-gate invariant (verbatim, slate §2.1):**
*AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine
(`src/domain/constitution/engine.ts`, mirrored for the server at `supabase/functions/_shared/constitution/`) is the
sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user
post.*
→ Respected: the Open Issue model is **consultative**, derives only, and emits no block. `nextBestMoves` is a
*subset* of engine+role-gate survivors — it never resurrects a move the engine rejects and never gates one. The Referee
Card updates asynchronously and never sits in the post path.

- **cdiscourse-doctrine §1 (no truth labels; score never blocks).** Every emitted label is from the frozen §4B copy set;
  the prohibited verdict/person tokens appear in this doc only as prohibitions and in the ban-list test specs. The card
  never says a user is wrong, never accuses motive, always gives a move (or collapses cleanly). Standing/relation
  describe the MOVE's gameplay state, never truth.
- **§2 (heat = activity/friction).** No field reads heat; "Moved on" / "Open" describe procedural state, not
  importance.
- **§3 (popularity is not evidence).** No field reads engagement, views, virality, or a strength band. Evidence debt is
  an obligation marker, never a truth verdict (EV-003 doctrine preserved).
- **§4 (AI moderator limits).** No AI call from the production app; the card consumes already-persisted Observations;
  it never triggers classification, never assigns a truth value, never returns an authoritative flag.
- **§5 (engine is sacred).** The model imports types only, is pure/side-effect-free/JSON-serializable, and never
  re-validates or contradicts the engine.
- **§9 (plain language).** Rail states map through `gameCopy.toPlainLanguageOrSuppress`; unknown codes suppressed, never
  echoed; zero raw `snake_case` in any user-facing string.
- **§10a (Observations vs Allegations).** The distinction is load-bearing: `refereeObservations` (machine) and
  `userAllegations` (user) are separate fields, never merged. Sensitive Observations (`shifts_to_person_or_intent`,
  `contains_unplayable_insult_only`, `needs_pre_send_pause`) stay composer-only; Family J (`sensitive_composer`,
  `productionEnabled: false`) is **never a derivation input** — the model re-asserts the `HUB_NON_PRODUCTION_FAMILIES`
  gate.
- **§10 (v1 scope guards).** No voting/winner scoring, OAuth, push, public API, or search is introduced.
- **Doctrine-constraint edge case — "what if heat tries to influence the axis/burden? — it doesn't":** no input is a
  heat/popularity/strength signal; the derivation is a pure function of structural move facts.

---

## Operator steps (if any)

None — pure design doc. GATE-A ratification of the design semantics is the operator gate (standard pipeline); it is
separate from the docs-only PR merge mechanics. No `db push`, no `functions deploy`, no env var.

---

## Interpretive ledger (orchestrator-authored brief notes)

This card's issue body (#584) is operator-filed but its scope was sharpened by the mid-run addendum (slate index §3.12).
Where this design resolved an interpretation by orchestrator default rather than explicit operator direction:

- **Axis `fact` split** (LIFE-001 `fact` → `evidence`; `ActiveDisagreementKind` `fact` → `framing`): resolved per slate
  §4B normalization; the two `fact` sources are distinct. Operator may review.
- **18→8 lifecycle-state map** and **5-trace recovery-route fallback to `branch_tangent`**: derived from
  `actPopoutModel`/`suggestedMovesModel` live behavior + RULE-004/005 advisory precedent; not separately operator-validated.
- **Small-screen placement**: recommended (card-detail default + compact composer-pinned variant on phone) but flagged
  as REF-003 open question for operator review.
- **`IssueState` plain-language registration in `gameCopy`**: orchestrator default that REF-002 owns the mapping
  addition; reuses `LIFECYCLE_UX_MAP` where aligned.

All other sections derive from the operator-filed issue, the slate (the operator-validated canonical chain), and the
`c46c8e0` codebase survey.
