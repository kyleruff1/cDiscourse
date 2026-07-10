# FEEDBACK-002 — derivedObservationSignals: zero-spend cross-family composition

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP) — feedback/intel lane
**Release:** M-ASP-7 · Phase P7
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/899
**Binding spec:** pivot plan doc **10 §5** (the ratified 7-signal contract) + doc **07 §6** (file placement `feedbackFlags/derivedObservationSignals.ts`). The issue cites "doc 07 §5"; doc 07 §5 is the mobile/a11y cross-cut and §6's `BooleanFeedbackBar` row is where the file is named — the substantive signal contract lives in doc 10 §5. This design treats **doc 10 §5** as the binding contract and reconciles the reference in "The spec contract" below.

---

## Goal (one paragraph)

Machine observations (families A–J) are consumed **one family at a time** — the friendly-flag layer (`buildPointFeedbackFlags`) maps a single `(family, rawKey)` row into one calm pill, and the mediator board reads raw keys per node, but nothing **composes across families, across nodes, and across the human `move_marks` + evidence-debt + structure layers**. Doc 10 §5 mandates a **zero-spend** derivation layer that reads only **already-persisted** rows (`argument_machine_observation_results` + `move_marks` + `EvidenceDebt` + timeline structure + the deterministic heat band) and produces higher-order **advisory** signals — `proof_moment`, `hot_but_proof_light`, `talking_past`, `resolution_window`, `callback_worthy`, `own_tension_hint`, `dodge_chain`. No new classifier call, no migration, no Edge. The doctrine that shapes every line of this design: signals are **advisory, never authoritative, and never touch factual standing** (cdiscourse-doctrine §1/§3/§4; point-standing-economy anti-amplification interlock). They **move existing furniture; they never add new furniture** (doc 10 §4) — this card wires exactly two mandated surfaces (the existing Inspect advisory disclosure and the mediator "what remains unresolved" rail) and emits the remaining signals dormant for the surface cards that own them. The mediator board is **derived once** and the signal layer never re-derives it (doc 07 §3 single-derivation rule; repo memory `mediator-board-single-derivation`).

---

## The spec contract (doc 10 §5 fidelity)

Doc 10 §5 ratifies **seven** cross-family compositions. Quoted verbatim, each is `inputs → predicate → consumer → doctrine note`:

- **5.1 `proof_moment` (B × D × F × marks):** `disagrees_on_facts`(B) on a reply targeting move M **∧** (`needs_a_receipt`/`open_receipt`(D) on M **∨** open `source|quote` debt on M **∨** `receipts_requested` mark on M) **∧** optionally `unanswered_question`(F) → **ProofButton gold pulse + "1 receipt owed"** for M's author; Your-turn ranking boost. Doctrine: *"invitation on your own move only."*
- **5.2 `hot_but_proof_light` (heat × D × debts):** deterministic heat ≥ `hot_now` band **∧** zero D-family positive keys across the room's last N moves **∧** ≥1 open source debt → gallery/floor bucket **"Hot, receipts pending"**. Doctrine: *"bucket label describes the room state, not participants."*
- **5.3 `talking_past` (C × B × H, both sides):** unresolved `asks_for_clarification`(C) **∧** `disagrees_on_scope`(B) **∧** `could_be_more_specific`/`reads_as_hedged`(H) present on moves from **both** sides within a window → mediator rail line *"You two may be arguing different claims — pin the claim."* Doctrine: *"describes the exchange, not either person."*
- **5.4 `resolution_window` (G × F × debts):** `narrowed_the_claim`/`found_common_ground`/`synthesis_on_the_table`(G) **∧** no open F-family `unanswered_question` **∧** open debts ≤1 → StateRail "Synthesis may be on the table"; Your-turn verb → **"Land it"**; gallery `resolved_or_synthesized` leading edge. Doctrine: *"prompt, never auto-synthesis (user must write it)."*
- **5.5 `callback_worthy` (E × G × A):** `names_the_pattern`(E) **∨** `strong_comparison`(E) **∧** later `clean_concession`/`found_common_ground`(G) **∧** `callback_material`(A) → feeds the QUOTE-FORGE linked-prior picker ordering + future lore. Doctrine: *"celebrates a move, not a victor."*
- **5.6 `own_tension_hint` (A × B, self-scoped, composer-only):** a draft reply that `builds_on_point`(A) toward node X while `disagrees_on_facts/scope`(B) fired between X and the draft's target → composer-only whisper *"This may cut against your earlier point — want to reconcile or branch?"* **Never rendered on any public surface, never visible to the opponent.** Doctrine: *"self-consistency aid, not accusation."*
- **5.7 `dodge_chain` (marks × A, mediator-weighted):** ≥2 consecutive `did_not_address` marks on the same thread line **∧** A-family shows replies attach elsewhere → mediator summary weights that point as "still open after N exchanges"; contradiction-candidate list for the room's mediator drawer (advisory only). Doctrine: *"the point remains unanswered, never X is evading."*

Doc 10 §5 **Guardrails (tested), quoted:** *"pure module with fixture-table tests per signal; a source-scan that `derivedObservationSignals` is imported by UI/model layers only (never by `evaluateArgumentDraft`, never by submit path); forbidden-token suite over all whisper/nudge copy; every consumer surface is one of the enumerated ones (no new pills)."* Doc 10 §7 **What NOT to collect (binding):** no verdict machinery, no popularity-shaped signals feeding standing, listen/view counts are never score inputs, no cross-user per-person quality scores.

This card ships the **full 7-signal derivation** (all tested) and wires the **two mandated surfaces** for this card only (Inspect advisory + mediator rail). The other consumers are emitted-but-dormant; see "Design decisions §3".

---

## The DerivedSignal envelope (shared-shape section — THIS doc owns it)

> **Ownership note (worktree coordination):** A concurrent designer authoring `docs/designs/INTEL-001-002.md` (specificity KPI) reconciles against this section. This doc defines the envelope; INTEL consumes it. The reconciliation rule is at the end of this section.

Every signal, regardless of code, is one immutable `DerivedSignal`:

```ts
// src/features/feedbackFlags/derivedObservationSignals.ts

/** The seven v1 composition codes (doc 10 §5.1–§5.7). snake_case, NEVER user-facing. */
export type DerivedSignalCode =
  | 'proof_moment'          // 5.1
  | 'hot_but_proof_light'   // 5.2
  | 'talking_past'          // 5.3
  | 'resolution_window'     // 5.4
  | 'callback_worthy'       // 5.5
  | 'own_tension_hint'      // 5.6
  | 'dodge_chain';          // 5.7

/**
 * The CLOSED set of surfaces a signal is allowed to reach. This enum IS the
 * "no new pills / signals move furniture" guardrail (doc 10 §4/§5), enforced by
 * the type system — a signal cannot declare a consumer that is not here, and
 * there is deliberately NO score/standing/credit consumer in the set.
 */
export type DerivedSignalConsumer =
  | 'inspect_advisory_line'  // wired THIS card (Inspect active-node disclosure)
  | 'mediator_rail_line'     // wired THIS card (DisagreementPointsRail overlay)
  | 'proof_button_pulse'     // dormant — PROOF/proof_drawer card owns wiring
  | 'state_rail_line'        // dormant — ROOM-001 StateRail card owns wiring
  | 'your_turn_ranking'      // dormant — HOME card owns wiring
  | 'gallery_bucket'         // dormant — conversationGalleryModel card owns wiring
  | 'linked_prior_ordering'  // dormant — QUOTE-FORGE card owns wiring
  | 'composer_whisper';      // dormant — composer card owns wiring (5.6 only)

/** What the signal is anchored to. */
export type DerivedSignalScope =
  | { readonly kind: 'node'; readonly argumentId: string }
  | { readonly kind: 'thread'; readonly anchorArgumentId: string; readonly pointId: string; readonly memberArgumentIds: readonly string[] }
  | { readonly kind: 'room'; readonly debateId: string };

/** Composition provenance — audit + tests only, NEVER user-facing. */
export interface DerivedSignalProvenance {
  readonly contributingFlagKeys: readonly string[];   // FriendlyFlagKey values that fired
  readonly contributingMarkCodes: readonly string[];  // MoveMarkCode values that fired
  readonly contributingDebtKinds: readonly string[];  // EvidenceDebtKind values that contributed
  readonly heatBand: 'quiet' | 'active' | 'hot' | null; // set ONLY for hot_but_proof_light
  readonly note: string;                              // ban-list-clean composition note
}

/**
 * A single derived advisory signal. The three literal-typed booleans are the
 * doctrine spine: a signal that is not advisory / is authoritative / affects
 * standing literally cannot typecheck.
 */
export interface DerivedSignal {
  readonly code: DerivedSignalCode;
  /** ALWAYS true — there is no non-advisory signal (cdiscourse-doctrine §1). */
  readonly advisory: true;
  /** ALWAYS false — mirrors the AI-flag rule (cdiscourse-doctrine §4). */
  readonly authoritative: false;
  /** ALWAYS true — a structural assertion this signal touches no standing (§3). */
  readonly neverAffectsStanding: true;
  readonly scope: DerivedSignalScope;
  /** The subset of the closed enum this signal may reach. */
  readonly consumers: readonly DerivedSignalConsumer[];
  /** true ONLY for own_tension_hint — never rendered on any public/opponent surface. */
  readonly composerOnly: boolean;
  readonly provenance: DerivedSignalProvenance;
}
```

**Envelope invariants (each is a test in `derivedSignalEnvelopeShape.test.ts`):**

1. `advisory === true`, `authoritative === false`, `neverAffectsStanding === true` on **every** emitted signal — literal types, so the compiler is the first gate and the test is belt-and-braces.
2. `consumers` values are drawn only from `DerivedSignalConsumer`; the enum contains **no** token matching `/stand|score|credit|band|win|verdict/i`.
3. `composerOnly === true` **iff** `code === 'own_tension_hint'`; when `composerOnly` is true the `consumers` set must be exactly `['composer_whisper']` and must never include a public consumer.
4. `provenance.heatBand` is non-null **iff** `code === 'hot_but_proof_light'` (the anti-amplification pin — heat is the only activity input and it reaches exactly one signal).
5. Output is frozen (`Object.freeze` per signal + array) and sorted deterministically by `(code, scope-id)`.

**INTEL-001-002 reconciliation rule (binding on the concurrent designer):**
The `DerivedSignal` envelope is the contract for **discrete, scope-anchored, predicate-driven advisory compositions**. A **continuous metric** (INTEL-002's "% of replies that target a marker/quote") is **not** a `DerivedSignal` — it has no scope-anchored predicate and no discrete firing; INTEL models it as its own metric type. **If** INTEL surfaces a *threshold-crossing* of that metric as an advisory nudge (e.g. "specificity is low — pin a quote"), that nudge **must wear this envelope**: `advisory:true`, `authoritative:false`, `neverAffectsStanding:true`, a `consumers` value from the closed enum above, and it **must not** add a standing/score consumer nor read any popularity/engagement/view/listen input. Any new `DerivedSignalCode` added by INTEL is appended to the union here (this file owns the union) — INTEL does not fork a parallel envelope.

---

## Observation-read reality audit

What is *actually* in the codebase today (Grepped in the worktree), so the implementer builds on real shapes, not assumptions:

| Concern | Reality (file:symbol) | Consequence for this card |
|---|---|---|
| Persisted observation rows | `src/features/nodeLabels/machineObservationPersistenceQuery.ts:fetchPersistedObservationsForArguments` — read-only SELECT, RLS-gated, `run_mode='production'` filter, returns `MachineObservationResultRow[]` (`{ argumentId, rawKey, family, confidence, evidenceSpan, … }`). Offline / unconfigured → `[]`. | The module reads these rows; **it does not fetch**. The room already holds them as `persistedObservationsByArgumentId` (see below). Empty on offline is the safe default. |
| How the room holds them | `src/features/arguments/room/ArgumentRoom.tsx:1433` — `persistedObservationsByArgumentId?.[activeMessageId]`; `buildPointFeedbackFlags(rows, …)` runs at 1463; the "Combination observations" section (`evaluateObservationMapping`, MCP-MAPPING-EXPANSION-001) runs at 1431. | The signal memo sits **as a sibling** to these two, reading the **whole** `persistedObservationsByArgumentId` map (all nodes), not just the active node. |
| Family → friendly-key mapping | `src/features/feedbackFlags/friendlyFlagMap.ts:friendlyFlagsFor` — maps `(family, rawKey)` → `FriendlyFlag[]` (deduped, input-order), drops negatives/unknown/J. `FriendlyFlagKey` union is the composition currency doc 10 §5 speaks in (`disagrees_on_facts`, `needs_a_receipt`, `unanswered_question`, `narrowed_the_claim`, `callback_material`, …). | **Compose over friendly keys, not raw keys.** The module maps each node's rows through `friendlyFlagsFor` once → `Set<FriendlyFlagKey>` per node. This reuses the shipped, tested routing verbatim and matches doc 10 §5's own predicate language. |
| Human marks | `src/features/feedback/moveMarksModel.ts:MoveMarkRow` + `moveMarkAggregateModel.ts:deriveMoveMarkAggregate` — 5 codes; `receipts_requested`, `did_not_address` are the two this card reads; behind the `move_marks` flag (empty when OFF). | `proof_moment` mark-arm + `dodge_chain` consume marks. Flag OFF → marks empty → those arms simply don't fire (byte-safe). |
| Evidence debts | `src/features/evidence/evidenceDebtModel.ts:deriveEvidenceDebts` → `EvidenceDebt[]` (already derived once in-room as `evidenceDebts`); `OPEN_EVIDENCE_DEBT_STATUSES`, `debtKind ∈ {source,quote,receipt,context,primary_record}`, `nodeId` = attached node. | Passed in already-derived; the module reads open `source|quote` debts on a node. **No re-derivation.** |
| Heat band | `src/features/strengthWeakness/heatModel.ts:HeatLevel = 'quiet'|'active'|'hot'` (SW-002, deterministic, injected clock). | `hot_but_proof_light` reads `heatBand === 'hot'` only. Heat is the sole activity input and reaches exactly one signal. |
| Mediator board | `src/features/mediator/deriveMediatorBoardState.ts` — derived **once** in `ArgumentRoom.tsx:958` (`deriveRoomMediatorBoardState`), consumed by rail + node markers (single-derivation invariant, memory `mediator-board-single-derivation`). Board `points[]` carry `id` (=pointId), `memberNodeIds`, `state`. | The rail overlay selector reads the **already-derived** `mediatorBoard`; the signal module **never** imports `deriveMediatorBoardState` / `buildPointLifecycleMap` / `deriveEvidenceDebts`. Source-scan pin. |
| Feature-flag shape | `src/lib/featureFlags.ts` — 7 ASP flags, each a **static** `process.env.EXPO_PUBLIC_*` dot read (web-inlining gotcha `expo-web-static-env-inlining`; guard `__tests__/featureFlagsStaticEnv.test.ts`). Default OFF, flag-off byte-identical (FEEDBACK-001 `move_marks` precedent). | This card adds an **8th** flag `derived_signals` the same way (static dot read + guard-test entry). |
| Existing per-node combination | `src/features/nodeLabels/observationMapping/observationMappingEvaluator.ts:evaluateObservationMapping` — a **single-node, cross-key** display-only combiner already in Inspect. | Complementary, **not** a collision: it combines rawKeys **on one node**; this card composes **across nodes, families, marks, debts, heat, structure** at **room** scope. New sibling module; do not fold into it. |

**Read-path conclusion:** every input the seven predicates need is already resident in the room render tree. This card adds one pure fold and two thin display bindings; it fetches nothing.

---

## Data model

**No new persisted data model. No migration.** Signals are render-time-derived (the EV-003 precedent). New **in-memory** types only, all in `derivedObservationSignals.ts`:

```ts
/** Per-node structural facts the derivation needs (all resident in-room). */
export interface DerivedSignalNodeInput {
  readonly argumentId: string;
  readonly parentId: string | null;
  readonly branchRootId: string;   // = timelineMap node.branchRootMessageId (the point/cluster anchor)
  readonly authorId: string | null;
  readonly side: string | null;    // 'affirmative' | 'negative' | 'moderator' | null
  readonly ordinal: number;        // chronological order in room
  readonly actor: 'self' | 'other' | 'unknown'; // viewer-relative (own-node scoping for 5.1/5.6)
}

/** For 5.6 own_tension_hint — present only while a composer is open. */
export interface DerivedSignalDraftContext {
  readonly draftAuthorId: string;       // the drafting viewer
  readonly targetArgumentId: string;    // the node the draft replies to
  readonly relationToTarget: 'builds_on' | 'disagrees' | 'other'; // from composer intent / draft relation
  readonly priorOwnNodeIds: readonly string[]; // the drafter's earlier nodes in this room
}

export interface DeriveDerivedSignalsInput {
  readonly debateId: string;
  readonly nodes: readonly DerivedSignalNodeInput[];
  /** SAME rows the room already fetched, keyed by argumentId (family, rawKey). */
  readonly observationsByArgumentId: Readonly<Record<string, readonly { family: string; rawKey: string }[]>>;
  readonly evidenceDebts: readonly import('../evidence/evidenceDebtModel').EvidenceDebt[];
  /** Active move-mark rows (empty when move_marks flag OFF). */
  readonly moveMarks: readonly import('../feedback/moveMarksModel').MoveMarkRow[];
  readonly heatBand: 'quiet' | 'active' | 'hot' | null;
  readonly draftContext: DerivedSignalDraftContext | null;
  /** Window size N for dodge_chain / talking_past. Defaults to DERIVED_SIGNAL_WINDOW. */
  readonly windowSize?: number;
}

export function deriveDerivedObservationSignals(
  input: DeriveDerivedSignalsInput,
): readonly DerivedSignal[];
```

The function is a pure fold: it internally builds `flagsByNode: Map<argumentId, Set<FriendlyFlagKey>>` via `friendlyFlagsFor`, `marksAgg = deriveMoveMarkAggregate(moveMarks)`, and `openDebtsByNode: Map<nodeId, EvidenceDebt[]>`, then runs seven independent pure predicate functions (`deriveProofMoment`, `deriveHotButProofLight`, `deriveTalkingPast`, `deriveResolutionWindow`, `deriveCallbackWorthy`, `deriveOwnTensionHint`, `deriveDodgeChain`), concatenates, freezes, and sorts. No clock, no randomness (`evidenceDebts` already baked in `nowMs`).

---

## API / interface contracts

```ts
// src/features/feedbackFlags/derivedObservationSignals.ts
export const DERIVED_SIGNAL_WINDOW = 6; // "last N moves" for 5.2/5.3/5.7
export function deriveDerivedObservationSignals(input: DeriveDerivedSignalsInput): readonly DerivedSignal[];
export const ALL_DERIVED_SIGNAL_CODES: readonly DerivedSignalCode[]; // frozen, for test enumeration

// src/features/feedbackFlags/derivedSignalConsumerModel.ts  (the two mandated surfaces; pure)
/** Node-scoped + room-scoped advisory LINES for the Inspect active-node disclosure. */
export function selectInspectAdvisoryLines(
  signals: readonly DerivedSignal[],
  activeArgumentId: string | null,
): readonly DerivedSignalLine[];               // { code, text, accessibilityLabel } — ban-list clean

/** dodge_chain + talking_past overlay lines keyed to an ALREADY-derived board point. */
export function selectMediatorRailOverlay(
  signals: readonly DerivedSignal[],
  boardPointIds: readonly string[],            // = mediatorBoard.points.map(p => p.id)
): Readonly<Record<string /*pointId*/, DerivedSignalLine>>;  // NEVER reorders; additive only

// src/lib/featureFlags.ts (additive)
export const DERIVED_SIGNALS_FLAG = 'EXPO_PUBLIC_DERIVED_SIGNALS' as const;
export function isDerivedSignalsEnabled(): boolean; // static dot read; default OFF
```

`DerivedSignalLine` copy is a ban-list-clean plain-language map inside `derivedSignalConsumerModel.ts` (one place for the ban-list test to scan, mirroring `moveMarksCopy.ts` / `gameCopy`). Example lines (advisory, no verdict, no code leak): proof_moment → *"A receipt would carry this point further."*; resolution_window → *"Synthesis may be on the table."*; talking_past → *"You two may be arguing different claims — pin the claim."*; dodge_chain → *"This point is still open after a few exchanges."* (never "evading", never "X is dodging").

---

## File changes

**New files**

- `src/features/feedbackFlags/derivedObservationSignals.ts` — envelope types + `DeriveDerivedSignalsInput` + seven pure derivers + orchestrator + `ALL_DERIVED_SIGNAL_CODES`. **~440–500 lines.**
- `src/features/feedbackFlags/derivedSignalConsumerModel.ts` — `selectInspectAdvisoryLines`, `selectMediatorRailOverlay`, the ban-list-clean `DERIVED_SIGNAL_LINE_COPY` map, `DerivedSignalLine`. **~160–200 lines.**
- Test files (see Test plan) — 7 new suites.

**Modified files**

- `src/features/feedbackFlags/index.ts` — export the two new modules' public surface. **~4 lines.**
- `src/lib/featureFlags.ts` — add the 8th flag `derived_signals` / `EXPO_PUBLIC_DERIVED_SIGNALS`: `DERIVED_SIGNALS_FLAG` const, `isDerivedSignalsEnabled()` (static dot read), and the registry entry. **~12 lines** (mirror the 7 existing exactly; **do not** loop/compute the env key — web-inlining gotcha). Stays byte-identical behaviorally: default OFF.
- `src/features/arguments/room/ArgumentRoom.tsx` — one `derivedSignals` memo (gated `isDerivedSignalsEnabled()`; returns `[]` when OFF), assembling `DerivedSignalNodeInput[]` from `timelineMap`/`viewModels`, passing `persistedObservationsByArgumentId`, `evidenceDebts`, the marks rows (already in scope for FEEDBACK-001 aggregate), `heatBand` (already derived), and `draftContext` when the composer is open. Then: (a) `selectInspectAdvisoryLines(derivedSignals, activeMessageId)` → pass to the Inspect active-node disclosure next to the existing `PointFeedbackFlagsRow` (~line 2874); (b) `selectMediatorRailOverlay(derivedSignals, mediatorBoard.points.map(p=>p.id))` → pass to `DisagreementPointsRail`. **~45–60 lines.** Flag OFF → empty everywhere → byte-identical.
- `src/features/mediator/DisagreementPointsRail.tsx` — accept an optional `advisoryOverlayByPointId?: Readonly<Record<string, DerivedSignalLine>>` prop; render an advisory sub-line under the matching point. Optional prop defaults to `{}` → **byte-identical when not passed**. **~20–30 lines.** Does not reorder points; does not read the board again.
- (Inspect disclosure) the render site around `ArgumentRoom.tsx:2874` — render the `inspectAdvisoryLines` as calm advisory `<Text>` lines under `PointFeedbackFlagsRow`. Additive; empty array renders nothing → byte-identical when flag OFF. **~15–20 lines.** (No separate component required; reuse the existing disclosure container. If the implementer prefers a tiny presentational `DerivedSignalAdvisoryLines.tsx`, that is acceptable and adds one file.)
- `__tests__/featureFlagsStaticEnv.test.ts` — add the 8th flag's static-literal assertion (**required** or the guard fails). **~4 lines.**

**Deleted files:** none.

---

## Edge cases

- **Empty room / no observations** → `deriveDerivedObservationSignals` returns frozen `[]`.
- **`move_marks` flag OFF** → `moveMarks` empty → `dodge_chain` and `proof_moment`'s mark-arm never fire from marks; `proof_moment` can still fire from D-flags/open debts. Byte-safe.
- **Node with observations but no composition match** → no signal (under-fire on uncertainty is the doctrine-safe direction).
- **`talking_past` with only one side present** → not emitted (the both-sides gate); if `side` is null/unknown for a participant it under-fires (safe).
- **`heatBand === null`** → `hot_but_proof_light` never fires; `provenance.heatBand` stays null (and is null for every other code by invariant #4).
- **Composer closed (`draftContext === null`)** → `own_tension_hint` never fires.
- **Signal references a node not in `nodes`** (dangling id) → skipped defensively.
- **Duplicate observation rows** (same family/rawKey on a node) → `friendlyFlagsFor` dedupes; derivation idempotent.
- **Rows arriving out of order / concurrent edits** → the module sorts nodes by `ordinal` internally and sorts output by `(code, scope-id)`; deterministic regardless of input order.
- **Offline / `SUPABASE_CONFIGURED` false** → the persistence query already returns `[]`; the module receives an empty map → `[]`.
- **`proof_moment` on the viewer's OWN node** — this is the intended doctrine reading (doc 10 §5.1 *"invitation on your own move only"*): the signal surfaces on the author's own node as a **self-invitation to strengthen**, never as a verdict on another. The Inspect line is phrased as an offer, not an accusation.
- **`dodge_chain` "same thread line"** — defined precisely as: ≥2 nodes sharing a `branchRootId` (same mediator point/cluster), each carrying an active `did_not_address` mark, in ascending `ordinal`, whose A-family relation (`direct_challenge`/`builds_on_point` targeting a *different* parent than the marked node) shows "replies attach elsewhere." The signal is `thread`-scoped with `pointId = branchRootId`, so the rail overlay maps it to the board point with no re-derivation.
- **Doctrine-edge:** *"can heat lift a claim's standing?"* — no. Heat feeds only `hot_but_proof_light`, whose sole consumer is `gallery_bucket` (an activity descriptor), and `neverAffectsStanding` is a literal `true` on every signal.

---

## Test plan

All pure-model suites (test-discipline: 100% on new pure models). Files:

- `__tests__/derivedObservationSignals.test.ts` — **the derivation matrix.** One `describe` per code 5.1–5.7. Each has: the happy-path fixture that fires the signal, plus one negative fixture per predicate atom removed (proves the AND-gates). E.g. `proof_moment`: fires with B-flag + D-flag; does not fire with D-flag but no B-flag; fires via open source debt instead of D-flag; fires via `receipts_requested` mark instead of D-flag; not on a node with none. Assert scope, `consumers`, `provenance` contents.
- `__tests__/derivedObservationSignalsDeterminism.test.ts` — same input twice → `toEqual` (deep); permuted node/observation order → identical output; output arrays + signal objects are frozen.
- `__tests__/derivedObservationSignalsZeroNetwork.test.ts` — **source scan** of `derivedObservationSignals.ts` + `derivedSignalConsumerModel.ts`: no `fetch`, `supabase`, `anthropic`, `xai`, `Date.now`, `Math.random`, `console.log`; **no import** from `src/features/pointStanding/`; **no import** of `deriveMediatorBoardState` / `buildPointLifecycleMap` / `deriveEvidenceDebts` (single-derivation pin); not imported by `evaluateArgumentDraft` / submit path (scan those files for the module path).
- `__tests__/derivedObservationSignalsAntiAmplification.test.ts` — `provenance.heatBand` non-null **iff** `code === 'hot_but_proof_light'`; that signal's `consumers ⊆ {'gallery_bucket'}`; every signal `neverAffectsStanding === true`; the `DerivedSignalConsumer` enum has no `/stand|score|credit|band|win|verdict/i` token; module imports nothing from `pointStanding`.
- `__tests__/derivedObservationSignalsBanList.test.ts` — every string in `DERIVED_SIGNAL_LINE_COPY` (and every `DerivedSignalLine.text`/`accessibilityLabel` produced by the two selectors over a broad fixture) scanned against `_forbiddenVerdictTokens()` (reused from `friendlyFlagMap`); no snake_case leak (`/_/` and no raw `DerivedSignalCode` value in any rendered line); assert `dodge_chain` copy contains no `evad`/`dodge`, `talking_past` copy names neither person.
- `__tests__/derivedSignalEnvelopeShape.test.ts` — the five envelope invariants (advisory/authoritative/neverAffectsStanding literals; consumer-enum standing-free; `composerOnly` iff own_tension_hint with `consumers === ['composer_whisper']`; heatBand iff 5.2; frozen + sorted).
- `__tests__/derivedSignalsFlagOff.test.ts` — with `EXPO_PUBLIC_DERIVED_SIGNALS` unset, `isDerivedSignalsEnabled()` is false and the room-shaped harness yields empty Inspect lines + empty rail overlay (byte-identical path); mirrors `moveMarksFlagOff.test.ts`.
- `__tests__/featureFlagsStaticEnv.test.ts` — **modified**: add the 8th flag's static-literal assertion + keep the dynamic-read ban green.

**Expected delta vs baseline (983 suites / 34,101 tests):** **+7 suites, ~+95–130 tests** → target ≈ **990 suites / ≈34,210 tests**. This is an estimate; the implementer captures the real `Test Suites:` / `Tests:` line with exit 0 and records it in `current-status.md` (test-discipline gate rule). The `current-status.md` H2 count for FEEDBACK-002 MUST match `docs/reviews/FEEDBACK-002-review.md`.

---

## Dependencies (cards / docs / files)

- Assumes **FEEDBACK-001 (#898, move_marks)** is complete — `moveMarksModel`/`moveMarkAggregateModel` are the human-signal input for `dodge_chain` + `proof_moment`. Base `159a586` includes it. ✓
- Reads **UX-FLAGS-001** `friendlyFlagMap.ts:friendlyFlagsFor` (the composition currency), **EV-003** `evidenceDebtModel.ts` (debts, already derived), **SW-002** `heatModel.ts` (`HeatLevel`), **MCP-021B/C** `machineObservationPersistenceQuery.ts` (the read path), **UX-MEDIATOR-001** `deriveMediatorBoardState.ts` (the board the rail overlay reads, never re-derives).
- **Blocks / feeds:** `INTEL-001-002` reconciles its threshold-nudges against the `DerivedSignal` envelope defined here. The dormant consumers (`gallery_bucket`, `composer_whisper`, `proof_button_pulse`, `state_rail_line`, `your_turn_ranking`, `linked_prior_ordering`) will be wired by the gallery / composer / PROOF / ROOM-001 / HOME / QUOTE-FORGE cards, which read the already-emitted signals (the doc-07-§4 "props sit ready, light up later" pattern).

---

## Risks

- **Friendly-key coupling.** Composing over `FriendlyFlagKey` means a future change to `friendlyFlagMap`'s rawKey→key routing shifts signal behavior. Mitigation: this is deliberate (stable, tested currency vs. 170+ raw keys); document the dependency in the module header; the derivation matrix tests pin the composition, so a routing change that breaks a signal shows up as a red matrix test.
- **`talking_past` both-sides detection** depends on reliable `side` on nodes; unknown side under-fires (safe direction) but may make the signal rare in practice. Acceptable for v1.
- **Single-derivation trip-wire.** The rail overlay must be additive only. If the implementer is tempted to "weight/reorder" the board per doc 10 §5.7's word "weights," that would require re-deriving the board — **forbidden**. The design represents `dodge_chain` as an advisory sub-line + emphasis flag on the *display*, never a reorder of `mediatorBoard.points` or `nextAction`. The zero-network test pins the no-re-derive imports; the reviewer should also confirm the board object is passed through untouched.
- **Boundary/scan suites pin `ArgumentRoom.tsx`-area files.** `uxOneOneTwoDoctrine` (apostrophe-free comments — memory `doctrine-scanner-apostrophe-gotcha`) scans the room orchestrator, and `uxOneOneFive/Six` boundary suites pin file paths; additive edits may trip them. Mitigation: keep new room comments apostrophe-free; relax a pinned path with an explicit `NOTE` per the house rule; run the doctrine + boundary suites before pushing.
- **8th feature flag + web inlining.** The new flag MUST be a static `process.env.EXPO_PUBLIC_DERIVED_SIGNALS` dot read (never computed), or it silently resolves `undefined` in the Netlify web bundle while jest stays green (memory `expo-web-static-env-inlining`). The `featureFlagsStaticEnv.test.ts` addition is the guard.
- **Test-count drift.** The implementer captures the real count; do not copy this design's estimate into `current-status.md`.

---

## Out of scope

- Family K / voice-derived signals (blocked on #863 + PASS-LOAD; doc 10 §8).
- Any new classifier call, new MCP family, or provider spend (zero-spend mandate).
- Migration / Edge / persisted `derived_signals` table (render-time only, EV-003 precedent).
- **Surface wiring for the dormant consumers:** `hot_but_proof_light` → gallery bucket (`conversationGalleryModel` card); `own_tension_hint` → composer whisper (composer card); `proof_moment` → ProofButton pulse (PROOF/`proof_drawer` card); `resolution_window` → StateRail/Your-turn verb (ROOM-001/HOME); `callback_worthy` → linked-prior ordering (QUOTE-FORGE). This card **emits** these signals (fully tested) but wires only the two mandated surfaces.
- Any per-person label, tally, or standing/score change (doctrine §1/§3/§10a; doc 10 §7).
- INTEL-001-002's specificity KPI itself (concurrent card) — this doc only defines the envelope it reconciles against.
- `CardDetailPanel` / `RingsideCard` Inspect parity for the advisory lines — the required Inspect wiring is the in-room active-node disclosure only; parity in the Cards/Ringside detail is a follow-up.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks; advisory only):** every signal is `advisory:true` / `authoritative:false`; no consumer gates posting (the enum has no submit/validation consumer); all copy is ban-list tested. ✓
- **§2 (heat = activity):** heat reaches only `hot_but_proof_light` (an activity bucket), pinned by invariant #4 + the anti-amplification test; never framed as truth/consensus. ✓
- **§3 (popularity is not evidence; anti-amplification):** no engagement/popularity/view/like/listen input anywhere; signals produce no `PointStandingDelta`; module imports nothing from `pointStanding`; `neverAffectsStanding:true` literal on every signal. ✓
- **§4 (AI moderator limits):** zero network / zero AI (pure TS, source-scan); `authoritative:false`; no auto-modify of content. ✓
- **§5 (engine sacred):** module never touches `engine.ts`, never enters `evaluateArgumentDraft` / submit (source-scan). ✓
- **§9 (plain language):** `DerivedSignalCode`/`FriendlyFlagKey`/rawKeys never user-facing; lines routed through the ban-list-clean copy map; snake_case-leak test. ✓
- **§10a (Observations vs Allegations; no per-person):** signals are machine-derived compositions of Observations; `own_tension_hint` is `composerOnly` (mirrors the sensitive-composer precedent); no per-person label or tally. ✓
- **point-standing-economy (anti-amplification interlock):** `dodge_chain` is a display-emphasis line, not a standing weight; nothing routes through `antiAmplification.ts`; concession/synthesis signals (`resolution_window`, `callback_worthy`) are advisory prompts, never auto-applied credit. ✓
- **Single-derivation (doc 07 §3 + memory):** the module never re-derives the mediator board/lifecycle/debts; the rail overlay consumes the once-derived board; source-scan pin + reviewer check. ✓

---

## Operator steps (if any)

**None to ship** — pure code change: no migration, no Edge deploy, no service-role, no provider spend. The new flag `EXPO_PUBLIC_DERIVED_SIGNALS` defaults **OFF**, so merging changes zero live surfaces. Turning the signals **on** later is the same operator env action as the other ASP flags (`netlify env:set EXPO_PUBLIC_DERIVED_SIGNALS true` + a strict-FF publish + bundle-hash poll), gated behind the reviewer's parity check — not part of this card's implementation.
