# UX-MEDIATOR-001 — 9-state precedence in the pure derivation (RECONCILIATION, not rebuild)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/682
**Base:** `588b827` · branch `feat/UX-MEDIATOR-001-precedence`
**Lane:** pure-TS · GATE-C: No (no deploy / migration / provider) · effort: L

---

## Goal (one paragraph)

The mediator stack is **already shipped on main** (PRs #644-648). `deriveMediatorBoardState` is a pure read-only projection that already collapses the lifecycle map + evidence-debt list + persisted machine observations into **exactly one** `MediatorStateCode` per disagreement point (`decidePointState`, worst-priority-wins). This card does **not** rebuild that — it **re-orders and tightens** the existing single-state decision so its priority matches the v4 design's published precedence table (impasse-first) and so the v4 conflict-resolution rows resolve as the design specifies, and it adds a **total, documented 13→9 display mapping** so the shipped 13-code superset projects onto the v4 nine-state display vocabulary (`missing_mechanism` → "Missing link"). The derivation stays pure (no React / Supabase / network), stays derived **once** in `ArgumentGameSurface` and shared (single-derivation invariant), and **never gates submission** — the deterministic Constitution engine at `src/domain/constitution/engine.ts` remains the sole acceptance gate; mediator state is an advisory projection only. Doctrine (`cdiscourse-doctrine`): no person/intent/honesty/credibility language, no winner/loser/verdict framing, no "fallacy" primary label, machine observations advisory, uncertainty preserved (unknown → Open, never a stronger/accusatory state).

---

## 1. Inventory — what EXISTS today

### Files (all on main, all pure TS except the two `.tsx`)

| File | Role | Touched by this card? |
|---|---|---|
| `src/features/mediator/mediatorBoardTypes.ts` | 13 `MediatorStateCode`s + all I/O interfaces | **Yes** — add the 13→9 mapping type + frozen const |
| `src/features/mediator/deriveMediatorBoardState.ts` | the pure projection; `decidePointState` picks the one state | **Yes** — re-order `decidePointState` to v4 precedence; add conflict-row handling; expose `v4DisplayStateFor` |
| `src/features/mediator/mediatorPlainLanguage.ts` | plain-language label per state + ban-list tokens | **Maybe (minimal)** — see §6; the `missing_mechanism` label rename is the one optional copy change |
| `src/features/mediator/index.ts` | public surface | **Yes** — export the new mapping const + helper |
| `src/features/mediator/nodeMediatorMarkers.ts` (UX-MEDIATOR-002) | display-suppression + node-marker priority | **No** — pins existing display priority; reconcile, do not change |
| `src/features/mediator/roomMediatorAdapter.ts` (UX-MEDIATOR-005) | room → board adapter | **No** |
| `src/features/mediator/MediatorNodeMarker.tsx` / `DisagreementPointsRail.tsx` | presentation | **No** |
| `src/features/mediator/{evidenceDebtDisplay,definitionScopeBridgeDisplay,mediatorRailCopy,nodeMediatorMarkers}.ts` | downstream consumers | **No** |
| `src/features/arguments/ArgumentGameSurface.tsx` L683-693 | single derivation site (`deriveRoomMediatorBoardState`) | **No** — invariant preserved |

### The 13 shipped `MediatorStateCode`s vs the v4 nine

```
SHIPPED 13 (mediatorBoardTypes.ts:57-70):
  open · needs_evidence · evidence_blocked · key_detail_unavailable ·
  definition_not_shared · scope_mismatch · missing_mechanism · value_tradeoff ·
  narrowed · off_point · accounts_differ · structured_impasse · resolved_or_settled

v4 NINE (design export L700-729, operator decision #6 INDEX L168), priority order:
  1 structured_impasse  2 evidence_blocked  3 accounts_differ
  4 definition_not_shared  5 scope_mismatch  6 missing_mechanism ("Missing link")
  7 needs_evidence  8 narrowed  9 open
```

**Already in the v4 nine (9 of 13):** `structured_impasse`, `evidence_blocked`, `accounts_differ`, `definition_not_shared`, `scope_mismatch`, `missing_mechanism`, `needs_evidence`, `narrowed`, `open`.

**The 4 superset codes NOT in the v4 nine** (the 13→9 mapping must place each):

| Internal code | v4 display state | Rationale |
|---|---|---|
| `resolved_or_settled` | **(suppressed)** — not a "live" point state; maps to `open` ONLY if it must yield a non-empty primary, but per UX-MEDIATOR-002 it is suppressed from node markers and is a terminal/settled marker, not one of the nine live states | A resolved point is not an open disagreement; the rail already filters these (`mediatorRailCopy.emptyPrimary`). The display mapping returns `resolved_or_settled` as its own display atom (kept), NOT folded into a live state — see §3 row. |
| `key_detail_unavailable` | `evidence_blocked` | v4 has no separate "key detail" state; a pivotal detail that cannot be settled from the record is the v4 "Evidence blocked" family ("the record is unavailable"). The internal code is **preserved** for Inspect/traceability; only the DISPLAY state collapses. |
| `value_tradeoff` | `narrowed` (display) — OR kept as its own internal code surfaced only in Inspect | v4 nine has no "value tradeoff" state. A priority/tradeoff disagreement is a non-evidence, non-blocked, still-open point; the safest v4 display is the **lowest-precedence live state that does not imply an evidence obligation**. We map the DISPLAY to `open` (it is genuinely "open for a response, this is a priorities difference"), keep `value_tradeoff` internally for Inspect + the rail's `name_tradeoff` pathway. **Open question O-2.** |
| `off_point` | `scope_mismatch` (display) | v4 folds "off-point / non-responsive" into the Scope family ("answers a broader/narrower claim than the point"). The internal `off_point` + the node-level `NodeDeviation` are **preserved** (UX-MEDIATOR-002 already shows `off_point` as a node deviation); only the point-level DISPLAY state collapses to `scope_mismatch`. |

### Can multiple states currently surface per node? — NO at the derivation layer; the v4 collapse is a DISPLAY concern

This is the single most important reconciliation fact and it shapes the whole delta:

- **At the derivation layer there is already exactly one state per point.** `decidePointState` returns one `{ state, confidence }`; `markupByNodeId[nodeId].primaryState` is one code. There is **no chip soup in the model** today.
- **The "chip soup" the v4 design fixes (S1→S2, design L734-784) is a DISPLAY phenomenon** — two markups still mount per node (`MediatorNodeMarker` one state + `NodeLabelStrip` machine+user chips + overflow). **Collapsing those is UX-MEDIATOR-002, explicitly a non-goal here.**
- Therefore THIS card's job is narrower and surgical: make the one state the model already picks **match the v4 priority order**, make the conflict rows resolve correctly, and publish the 13→9 display mapping so downstream cards render the v4 vocabulary. It is a **re-ordering + mapping delta**, not a "make it pick one state" delta.

### How `decidePointState` picks state TODAY (the shipped cascade), and where it diverges from v4

The shipped cascade (early-return, `deriveMediatorBoardState.ts:237-327`) in its current order:

```
1  resolved/confirmed/synthesis_ready        → resolved_or_settled  (HIGH)
2  narrowed/conceded                          → narrowed            (HIGH)   ← diverges
3  open debt OR source/quote_requested:
      · any unresolved debt                   → evidence_blocked    (HIGH)
      · context-limit key                     → key_detail_unavailable
      · else                                  → needs_evidence      (HIGH)
3b context-limit key (no debt)                → key_detail_unavailable
4  definition keys & not confirmed            → definition_not_shared
5  scope keys                                 → scope_mismatch
5b lifecycle branch_recommended               → scope_mismatch      (LOW)
6  value axis / value keys                    → value_tradeoff
7  causal axis + contested lifecycle          → missing_mechanism   (LOW)
8  lifecycle exhausted                        → structured_impasse  (HIGH)  ← diverges
9  ignored/moved-on / Q-A mismatch            → off_point
10 (reserved recollection — never fires v1)   → accounts_differ
11 default                                    → open
```

**Two divergences from the v4 priority order:**

- **D1 — Impasse is too LOW.** v4 ranks `structured_impasse` **#1** (highest); shipped checks it at step 8, AFTER narrowed/evidence/definition/scope. So a cluster that is BOTH `exhausted` and carries an open debt currently returns `needs_evidence`, but v4 says impasse is the dominant frame **only when no pathway remains** (conflict row "Impasse + any path remains → not impasse"). The fix is NOT "always pick impasse first" — it is "pick impasse first **iff** no resolution pathway is available", which is exactly the v4 conflict rule (§2).
- **D2 — Narrowed is too HIGH.** v4 ranks `narrowed` **#8** (low, just above Open); shipped returns it at step 2 BEFORE the evidence check. So a `narrowed` cluster that ALSO owes a source currently returns `narrowed`, but the v4 conflict row says "Needs evidence + Narrowed → Needs evidence". The fix is to move the narrowed/conceded check **below** the evidence/definition/scope/missing-link checks.

Everything else in the shipped cascade already matches the v4 intent; the delta is small.

---

## 2. Precedence model (deterministic total order + tie-breaks)

### The canonical v4 priority (highest wins) — encode verbatim

```ts
// New frozen const in mediatorBoardTypes.ts (display vocabulary, priority order).
export const V4_PRIMARY_STATE_PRIORITY: ReadonlyArray<V4MediatorStateCode> = Object.freeze([
  'structured_impasse',   // 1 — terminal frame, ONLY when no pathway remains
  'evidence_blocked',     // 2 — the record is unavailable
  'accounts_differ',      // 3 — difference of recollection (detector deferred; never synthesized in v1)
  'definition_not_shared',// 4 — wins over scope (shared terms unlock scope)
  'scope_mismatch',       // 5
  'missing_mechanism',    // 6 — display label "Missing link"
  'needs_evidence',       // 7 — a source would move it forward
  'narrowed',             // 8 — a repair, not a defeat
  'open',                 // 9 — default; preserves uncertainty
]);
```

`V4MediatorStateCode` is the nine-member display union (a subset of the 13). `resolved_or_settled` is **terminal/suppressed** — it is not a live primary state and is excluded from `V4_PRIMARY_STATE_PRIORITY` (it sits "below" Open in the sense that a resolved point is not an open disagreement; the rail filters it, UX-MEDIATOR-002 suppresses its node marker).

### The deterministic rule (single output for a single input)

`decidePointState` is restructured to compute **candidate signals** first, then pick the **highest-priority candidate that is currently true**, applying two v4 conflict gates. Pseudocode (pure, no early-return reordering surprises):

```
candidates = the set of state codes whose deterministic / observation inputs are satisfied
             for this cluster (each computed exactly as today, see §3 table)

// Gate A — Impasse demotion (v4 conflict row: "Impasse + any path remains → not impasse")
if 'structured_impasse' in candidates:
    if a resolution pathway IS available for any non-impasse candidate:
        remove 'structured_impasse' from candidates   // demote to the next-highest candidate

// Gate B — Definition wins over Scope (v4 conflict row "Definition + Scope → Definition not shared")
//   (already implied by priority: definition_not_shared (4) outranks scope_mismatch (5);
//    no special-case needed beyond the ordered priority — documented for the reviewer.)

primary = highest-priority code in V4_PRIMARY_STATE_PRIORITY that is in candidates
          (if candidates is empty → 'open')
confidence = confidence computed for `primary` exactly as the shipped code computes it
             (unknown when no supporting observation; never invented)
```

**Why "candidates then pick" rather than tweaking the early-return order:** it makes the precedence a **single explicit total order** (the const), makes the conflict rows fall out of the order + Gate A, and makes 100% branch coverage tractable (each candidate is an independent boolean; the picker is a single loop). It also keeps the diff legible for the reviewer: the per-signal detection logic (the observation key sets, the debt status checks, the lifecycle checks) is **moved verbatim** out of the cascade into named predicates, and only the **selection** changes.

### Conflict-resolution rows (design L863-870) — how each resolves

| v4 conflict row | How it resolves under this model |
|---|---|
| **Needs evidence + Narrowed → Needs evidence** | `needs_evidence` (7) outranks `narrowed` (8) in `V4_PRIMARY_STATE_PRIORITY`. Fixes shipped divergence **D2**. |
| **Definition + Scope → Definition not shared** | `definition_not_shared` (4) outranks `scope_mismatch` (5). Gate B documents the intent; no special case needed. |
| **Evidence blocked + Needs evidence → Evidence blocked** | `evidence_blocked` (2) outranks `needs_evidence` (7). Already true in shipped step 3 (declined debt checked before plain needs_evidence); preserved. |
| **Impasse + any path remains → not impasse** | Gate A: `structured_impasse` is removed from candidates when any non-impasse candidate has an available pathway, so the next-highest candidate wins. Fixes shipped divergence **D1**. |
| **Chime-in resolves source → state recomputes** | No special code: chime-in changes the underlying debt/observation rows; the next `useMemo` pass re-runs the pure derivation on new inputs → state recomputes. (Behavioral note for the reviewer; nothing to add — purity guarantees it.) |
| **Voice transcript used → no state change** | No special code: transcript text is NOT one of `decidePointState`'s inputs (it reads lifecycle + debts + observation rawKeys only). A test asserts adding a transcript-shaped input field does not alter the output. |

### Tie-breaks

Within a single point there are **no ties** — `V4_PRIMARY_STATE_PRIORITY` is a strict total order, so the picker returns the unique highest. Across **points** (rail ordering, `nextAction` choice) the shipped tie-break is preserved unchanged: most-pressing by `LIFECYCLE_PRIORITY`, ties by `compareStrings(point.id)`. This card does not touch cross-point ordering.

---

## 3. Per-state mapping table (each of the v4 nine + the 4 superset codes)

For each: deterministic inputs · optional machine-observation inputs (advisory) · confidence · plain-language label (ban-list clean) · next useful move · when it must NOT apply · what moves to Inspect.

| # | Display state | Deterministic inputs | Advisory obs inputs | Confidence | Label (current → v4) | Next move | Must NOT apply when | To Inspect |
|---|---|---|---|---|---|---|---|---|
| 1 | `structured_impasse` | lifecycle `exhausted` | — | high | "Structured impasse" | (none available) — `await_record` | a resolution pathway is available for any other candidate (Gate A) | the lifecycle trace, remaining claim node ids |
| 2 | `evidence_blocked` | any open debt `status==='unresolved'` (declined) | `flags_context_limit` (family D) | high (declined) / obs-conf (context-limit) | "Blocked evidence path" | `narrow_or_branch` (+ `await_record`, unavailable) | no declined debt AND no context-limit signal — never implies someone is hiding evidence | the debt id, artifact category, the context-limit rationale |
| 3 | `accounts_differ` | **none in v1** (recollection detector deferred) | recollection keys (empty set) | low (reserved) | "Difference of recollection" | `await_record` | **always in v1** — never synthesized from absent input (doctrine §4: observation-driven, never invented) | reserved type only |
| 4 | `definition_not_shared` | — | definition keys (`disputes_definition` B, `flags_term_ambiguity`/`proposes_shared_definition` C) AND NOT `confirms_shared_definition` | obs-conf (med fallback) | "Definition needed" → **may rename to "Definition not shared"** (see §6, O-1) | `define_term` | `confirms_shared_definition` present | the proposing node, the term |
| 5 | `scope_mismatch` | lifecycle `branch_recommended` (low conf) | scope keys (`disputes_scope` B, `scope_mismatch_identified` C) | obs-conf / low (lifecycle) | "Scope mismatch" | `narrow_or_branch` | no scope signal — never implies evasion or bad faith | the scope node |
| 6 | `missing_mechanism` | causal axis + lifecycle in {`rebutted`,`answered`,`open`} | — (no critical-question family consumed yet) | low | "Missing mechanism" → **rename to "Missing link"** (see §6, O-1) | `supply_mechanism` | non-causal axis, or evidence obligation open | the causal axis, the dependent step |
| 7 | `needs_evidence` | open debt (`requested`/`stale`/`challenged`) OR lifecycle `source_requested`/`quote_requested` | — | high | "Needs evidence" | `provide_source` | no open obligation; OR a declined/blocked path (→ #2) | the debt id, debt kind |
| 8 | `narrowed` | lifecycle `narrowed` or `conceded` | — | high | "Partially narrowed" | `respond_to_point` | a higher candidate (evidence/definition/scope/missing-link) is present — fixes D2 | what was conceded vs what remains |
| 9 | `open` | default — no other candidate true | — | medium if any obs on cluster, else **unknown** | "Open" | `respond_to_point` | (it is the fallback; preserves uncertainty) | — |

**The 4 superset codes (display collapse; internal code preserved for Inspect/traceability):**

| Internal code | Detected when | Display state | Preserved where |
|---|---|---|---|
| `key_detail_unavailable` | `flags_context_limit` (family D) and no declined debt | **`evidence_blocked`** | `point.state` keeps `key_detail_unavailable` internally; `v4DisplayStateFor(state)` returns `evidence_blocked`; the `nonProvableKeyDetails[]` collection + the blocked-path "Key detail unavailable" rationale remain for Inspect |
| `value_tradeoff` | value axis OR `disputes_value_weighting` (family B) | **`open`** (display) | `point.state` keeps `value_tradeoff`; pathway keeps `name_tradeoff`; Inspect shows the tradeoff. **O-2** |
| `off_point` | lifecycle ignored/moved-on OR `question_answer_mismatch` (family C) | **`scope_mismatch`** (display) | `point.state` keeps `off_point`; the node-level `NodeDeviation.kind==='off_point'` is preserved (UX-MEDIATOR-002 renders it); Inspect shows the non-responsive rationale |
| `resolved_or_settled` | lifecycle `archived_or_resolved`/`confirmed`/`synthesis_ready` | **terminal / suppressed** (not a live primary) | kept as its own atom; rail filters it; node marker suppressed |

**Display mapping is a pure total function**, `v4DisplayStateFor(code: MediatorStateCode): V4MediatorStateCode | 'resolved_or_settled'`, defined over all 13 codes (a frozen `Record`), so it is exhaustive and tested. The internal 13-code `point.state` is **unchanged** — the card adds a parallel display projection, it does not narrow the existing field (that would be a breaking change to every consumer + test). See §6.

---

## 4. Uncertainty rule

- When no candidate signal is satisfied, the primary is **`open`** — never a stronger or accusatory state.
- When `open` is reached and the cluster carries **no** supporting observation, confidence is **`unknown`** (doctrine §3 — preserve uncertainty); when some observation exists on the cluster, confidence is `medium`. This mirrors the shipped `fallbackConfidence` and is preserved verbatim.
- `accounts_differ` is **never synthesized** in v1 (its key set is empty; the detector is a deferred future card). Absent input → it is simply not a candidate → the picker falls through to a lower, weaker state. Insufficient evidence MUST NOT produce a recollection/blocked/impasse label.
- Malformed / empty input (no nodes, no clusters) returns the well-formed empty board (shipped behavior, pinned by the empty-graph test) — preserved.

---

## 5. Doctrine guards (cdiscourse-doctrine)

- **No person / intent / honesty / credibility language.** Every produced label flows through `mediatorPlainLanguage.ts` and is scanned by the existing `_forbiddenMediatorTokens()` ban-list test. The delta adds no new user-facing string except the optional `missing_mechanism` rename ("Missing link" — ban-list clean: contains no banned token) and the optional `definition_not_shared` rename ("Definition not shared" — ban-list clean). The ban-list test must be extended to scan the new display-mapped labels too.
- **No winner / loser / verdict framing.** States are structural; the priority order ranks *structure*, not *who is winning*. Impasse is "both sides made the case and no new pathway is available," never "tie / draw / nobody won."
- **No "fallacy" as a primary user-facing label.** None of the nine is a fallacy label; `missing_mechanism`/"Missing link" describes a *structural gap in the argument chain*, not a named fallacy. Confirmed clean.
- **Machine observations advisory.** Observation inputs only ever *raise* a point to a more specific state; they never gate, never block, never assert truth. Confidence carries `unknown`.
- **Engine remains the sole acceptance gate.** This module imports nothing from `src/domain/constitution/engine.ts`; it never returns a "can post" decision; it runs *after* storage, on already-persisted rows. The acceptance-gate invariant (classifiers run after storage; derivation never gates submission) is structurally guaranteed by purity — re-asserted in a test that the module exports no gate-shaped function.
- **Observations vs Allegations (doctrine §10a).** This card operates on machine `Observations` (the persisted rawKeys) and lifecycle/debt machine state only; it surfaces no user `Allegation` as a primary state. No sensitive composer-only observation (`shifts_to_person_or_intent`, etc.) is ever promoted to a point/node primary state.

---

## 6. Smallest-safe delta (ADD / CHANGE / UNTOUCHED)

### ADD

- **`mediatorBoardTypes.ts`** (~40 lines):
  - `export type V4MediatorStateCode` — the nine-member display union.
  - `export const ALL_V4_MEDIATOR_STATE_CODES` — frozen array of the nine (tests iterate).
  - `export const V4_PRIMARY_STATE_PRIORITY` — the frozen priority order (§2).
  - `export const V4_DISPLAY_STATE_BY_CODE: Readonly<Record<MediatorStateCode, V4MediatorStateCode | 'resolved_or_settled'>>` — the total 13→9 mapping (§3).
- **`deriveMediatorBoardState.ts`** (~60-80 lines net, mostly refactor-in-place):
  - Extract the per-signal detection out of the early-return cascade into named pure predicates (`isImpasseCandidate`, `isEvidenceBlockedCandidate`, `isNeedsEvidenceCandidate`, …) — **logic moved verbatim**, only relocated.
  - Replace the cascade tail of `decidePointState` with: build candidate set → Gate A (impasse demotion) → pick highest in `V4_PRIMARY_STATE_PRIORITY` (+ the 4 superset codes folded by mapping for *display*, but `point.state` keeps the internal code).
  - `export function v4DisplayStateFor(code: MediatorStateCode)` — thin lookup over `V4_DISPLAY_STATE_BY_CODE` (the public helper UX-MEDIATOR-002/005 will consume).
  - Add (non-breaking, additive) a `v4DisplayState` field to `DisagreementPoint` **OR** keep it derivable via `v4DisplayStateFor(point.state)` — **prefer the helper, add no field** to minimize the type surface and avoid touching the JSON-serializability/round-trip tests. **O-3.**
- **`index.ts`** (~4 lines): export the new const + `v4DisplayStateFor` + `V4MediatorStateCode` type.

### CHANGE (optional, copy-only, behind operator confirm — see Open questions)

- **`mediatorPlainLanguage.ts`** line 25 `missing_mechanism: 'Missing mechanism'` → `'Missing link'` (the prompt's §2 target name + operator decision #6). **This is a label rename, not a precedence change.** It is the ONE place the v4 display vocabulary differs from the shipped copy in a way visible to tests.
- **`mediatorPlainLanguage.ts`** line 23 `definition_not_shared: 'Definition needed'` → `'Definition not shared'` — CARDS doc L246 attributes this rename to UX-MEDIATOR-001/004; **the issue scope for THIS card does NOT list label renames**, and CARDS L964 puts the "Definition not shared" rename test under **UX-MEDIATOR-004**. **Recommendation: DEFER the definition rename to UX-MEDIATOR-004; do the `missing_mechanism`→"Missing link" rename here ONLY if the reviewer approves** (it is the prompt's named target). See O-1.

### UNTOUCHED (preserve byte-for-byte / behavior)

- `ArgumentGameSurface.tsx` single-derivation site (L683-693) — invariant preserved.
- `roomMediatorAdapter.ts`, `MediatorNodeMarker.tsx`, `DisagreementPointsRail.tsx`, `nodeMediatorMarkers.ts`, `evidenceDebtDisplay.ts`, `definitionScopeBridgeDisplay.ts`, `mediatorRailCopy.ts`.
- The 13-code `MediatorStateCode` union and `point.state` field — **not narrowed** (narrowing would break every consumer + the JSON round-trip test).
- The cross-point ordering, `nextAction`, `inputHash`, all the marker collections.

### Existing tests that PIN current behavior + how the delta reconciles

| Test | Pins | Reconciliation |
|---|---|---|
| `__tests__/mediatorBoardState.test.ts` §9 "lifecycle narrowed → narrowed" / "conceded → narrowed" | a `narrowed`/`conceded` cluster **with no other signal** → `narrowed` | **Still passes** — narrowed remains a candidate; with no higher candidate it wins. Only changes when an evidence/definition/scope/missing-link candidate co-occurs (which these fixtures do not have). |
| `mediatorBoardState.test.ts` §10 "exhausted → structured_impasse + no available pathway" | `exhausted` with nothing actionable → impasse, `anyAvailable===false` | **Still passes** — Gate A only demotes impasse when a non-impasse candidate has an *available* pathway; this fixture has none, so impasse stands. |
| `mediatorBoardState.test.ts` §4/§5/§6/§7/§8 | needs_evidence / evidence_blocked / definition / scope / off_point single-signal fixtures | **Still pass** — single-signal fixtures pick the same state under the new order. |
| `mediatorBoardState.test.ts` §11 determinism / §13 JSON round-trip / §12 no-mutation | output shape + determinism + serializability | **Still pass** — output shape unchanged (no new field if O-3 = helper). New ban-list scan added, not removed. |
| `__tests__/nodeMediatorMarkers.test.ts` (UX-MEDIATOR-002) `NODE_MARKER_PRIORITY[0]==='structured_impasse'` etc. | the DISPLAY suppression priority | **Untouched** — that file is not modified; its priority is a display concern that already happens to lead with impasse, consistent with v4. |
| `__tests__/MediatorNodeMarker.test.tsx:48` expects label `'Definition needed'` | the current definition label | **Only at risk if we rename `definition_not_shared`** — which we DEFER (O-1). If `missing_mechanism`→"Missing link" is done, this test does not reference it, so it is unaffected; but `mediatorBoardState.test.ts` §14 (plain-language coverage) and §15 (ban-list) will exercise the new label and must be updated to expect "Missing link". |
| `__tests__/disagreementPointsRailBridge.test.tsx:80,129` expects `'Definition needed …'` | rail bridge copy from `mediatorRailCopy.ts` | **Untouched** — `mediatorRailCopy.ts` is not in scope; if the definition rename is deferred, these stay green. |

**Net:** the delta is designed so that **no shipped fixture flips** except those that assert the `missing_mechanism` *label* (one or two assertions in `mediatorBoardState.test.ts`), which are updated in lockstep with the optional rename. If the reviewer prefers zero copy change, drop the rename and the implement step is purely additive (new priority const + candidate-picker refactor + display-mapping helper) with **all** existing assertions green.

---

## 7. Test plan (`__tests__/`, pure-model, 100% branch on the new precedence/conflict logic)

New + extended tests in `__tests__/mediatorBoardState.test.ts` (and a focused new file `__tests__/mediatorPrecedence.test.ts` for the priority/conflict matrix):

- **Priority order is a strict total order:** for a fixture cluster with every candidate signal simultaneously present, the result is the single highest-priority state (`structured_impasse` when no pathway, else `evidence_blocked`, …). Iterate `V4_PRIMARY_STATE_PRIORITY` and assert each rank.
- **Conflict rows (one test each, design L863-870):**
  - Needs evidence + Narrowed → `needs_evidence` (regression for D2).
  - Definition + Scope → `definition_not_shared`.
  - Evidence blocked + Needs evidence → `evidence_blocked`.
  - Impasse + any path remains → NOT impasse (regression for D1; assert the demoted next-highest wins).
  - Chime-in resolves source → recompute: same input minus the debt → state changes (purity behavioral test).
  - Voice transcript used → no state change: adding a transcript-shaped field to the input leaves the output deep-equal.
- **One primary state per node:** every `markupByNodeId[*].primaryState` is a single code; the v4 display projection `v4DisplayStateFor(point.state)` returns exactly one of the nine (or `resolved_or_settled`).
- **13→9 mapping is total + documented:** `V4_DISPLAY_STATE_BY_CODE` has a key for all 13 `ALL_MEDIATOR_STATE_CODES`; every value is in `ALL_V4_MEDIATOR_STATE_CODES` ∪ `{resolved_or_settled}`; `missing_mechanism` → `missing_mechanism` (display label "Missing link"); `off_point`→`scope_mismatch`; `key_detail_unavailable`→`evidence_blocked`; `value_tradeoff`→`open` (O-2).
- **Role / seat / chime-in / voice never become a primary state:** a fixture carrying only role/seat/chime-in/voice-shaped inputs yields `open` (or the existing weakest state), never one of the eight stronger states.
- **Uncertainty fallback:** no-signal cluster → `open` with `confidence: 'unknown'`; insufficient evidence is NEVER a verdict-like / accusatory state (assert result ∉ {impasse, evidence_blocked, accounts_differ} for empty input).
- **Deep-equal idempotence:** `JSON.stringify(derive(x)) === JSON.stringify(derive(x))` (extend §11).
- **Plain-language + ban-list (doctrine):** extend §14 coverage to assert "Missing link" (if renamed) maps cleanly, no snake_case; extend §15 ban-list scan to cover labels produced through the new display mapping. Assert definition/scope/evidence/impasse labels are plain-language and ban-list clean.
- **No gate-shaped export:** assert the module exports no function returning a `{ canPost }` / boolean-gate shape (structural doctrine guard).
- **All existing mediator/rail tests stay green** (run the full `__tests__/{mediator*,nodeMediator*,disagreementPoints*,definitionScope*,evidenceDebtDisplay,roomMediatorAdapter,MediatorNodeMarker}.test.tsx` set).

Coverage target: 100% branch on `decidePointState`, the candidate predicates, Gate A, the picker, and `v4DisplayStateFor` (test-discipline; the engine bar applies to this engine-adjacent pure logic).

---

## 8. Dependencies (cards / docs / files)

- **Reads / extends shipped:** `deriveMediatorBoardState` + `mediatorBoardTypes` + `mediatorPlainLanguage` (PRs #644-648). Extends #584 (REF-001), cross-refs REF-ADR-001 #590.
- **Reads existing models (no re-derivation):** `pointLifecycleModel.ts` (`LIFECYCLE_PRIORITY`, `PointLifecycleState`), `evidenceDebtModel.ts` (`OPEN_EVIDENCE_DEBT_STATUSES`, statuses).
- **Design source of truth:** `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` L654-740 + L863-870 mapping; `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` L58 (mediator inventory) + L168 (the v4 nine); `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`.
- **Blocks / feeds:** UX-MEDIATOR-002 (one-chip node markup — consumes `v4DisplayStateFor` + the priority const), UX-MEDIATOR-003 (evidence-blocked UI), UX-MEDIATOR-004 (definition/scope bridge UI — owns the "Definition not shared" rename), UX-MEDIATOR-005 (rail/sheet), UX-SELECTED-NODE-001, UX-NEXT-MOVE-001.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): board derived ONCE in `ArgumentGameSurface`, shared by rail + node markup — never re-derive. This card adds a pure helper consumed at that one site (or downstream of it), not a second derivation.
- **Engine path note** (`memory: claude-md-engine-path-stale`): the live engine is `src/domain/constitution/engine.ts`, not `src/lib/constitution/engine.ts`. This module imports neither — engine independence is structural.

---

## 9. Risks

- **R1 — Label-rename test churn (mitigated by deferral).** Renaming `definition_not_shared` here would touch `MediatorNodeMarker.test.tsx`, `disagreementPointsRailBridge.test.tsx`, and `mediatorRailCopy.ts` — out of this card's scope. **Mitigation:** defer that rename to UX-MEDIATOR-004 (where CARDS L964 already places its test); do only the `missing_mechanism`→"Missing link" rename here, and only with reviewer approval (O-1).
- **R2 — Over-collapsing the 4 superset codes.** Folding `value_tradeoff`→`open` for display could hide a useful "this is a priorities difference" signal. **Mitigation:** keep the internal `value_tradeoff` code + `name_tradeoff` pathway (only the *display* state collapses); surface it in Inspect. Flag O-2 for operator.
- **R3 — Gate A subtlety (impasse vs pathway).** The "Impasse + any path remains → not impasse" rule must check pathway availability for the *non-impasse* candidates, not for impasse itself (impasse's pathway is always unavailable by construction). Getting this backwards would make impasse never (or always) fire. **Mitigation:** explicit test for both branches (exhausted-with-open-debt → not impasse; exhausted-with-nothing → impasse).
- **R4 — Branch-coverage on the candidate set.** Moving detection into independent predicates increases branch count; each predicate needs both-branch fixtures. **Mitigation:** the §7 matrix is built predicate-by-predicate.
- **R5 — Refactor risk to `decidePointState`.** Relocating the detection logic risks an off-by-one in a key set or status check. **Mitigation:** move logic verbatim; rely on the unchanged single-signal fixtures (§4-§8) as the regression net — they must stay green before the new precedence tests are trusted.

---

## 10. Out of scope (explicit)

- **No visual node redesign, no one-chip node markup** — that is **UX-MEDIATOR-002**.
- **No rail / sheet redesign** — that is **UX-MEDIATOR-005**.
- **No evidence-blocked UI / debt-row UI** — that is **UX-MEDIATOR-003**.
- **No definition/scope bridge UI, no "Definition not shared" rename** — that is **UX-MEDIATOR-004**.
- No chime-in mechanics, no room/seat/invite/1v1 semantics, no submission-gate change.
- No persistence, no migration, no Edge Function, no deploy, no provider call.
- No MCP / classifier activation (the module reads *already-persisted* observation rows only; it does not run a classifier).
- No Family K / J work, no recollection (`accounts_differ`) detector (deferred future card; the type stays reserved, never synthesized).
- No new fetch, no React/Supabase/network import in the pure module.
- **UI change:** none planned. The only file outside `src/features/mediator/*.ts` that *could* change is none — and even within `mediator/`, the `.tsx` files are untouched. Any UI-visible change is limited to the optional `missing_mechanism` label string and only with reviewer approval.

---

## 11. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the nine states are structural; impasse/blocked/narrowed describe the point's *standing in the game*, never truth or a person. The module returns no posting decision and imports nothing from the engine — score/structure cannot block posting. PASS.
- **cdiscourse-doctrine §3 (popularity is not evidence):** the projection reads lifecycle + debts + observation rawKeys only — never `standingBand`/`toneBand`/`temperatureBand`/engagement. No amplification token in any label (ban-list test). PASS.
- **cdiscourse-doctrine §4 (AI moderator limits):** observations are advisory inputs that only *raise specificity*; `authoritative` is never asserted; no content is modified/hidden/deleted; nothing runs on a network. PASS.
- **cdiscourse-doctrine §5 (engine sacred):** this is a *feature* projection, not the engine, but it holds the same discipline — pure TS, side-effect free, JSON-serializable, no React/Supabase/network/clock/randomness/mutation. The engine remains the sole acceptance gate. PASS.
- **cdiscourse-doctrine §9 (plain language) + §10a (Observations vs Allegations):** every code maps through `mediatorPlainLanguage.ts`; no raw rawKey/code reaches the UI; the module surfaces machine Observations as structural states, never a user Allegation as a primary state, and never promotes a sensitive composer-only observation to a node/point state. PASS.
- **test-discipline:** pure-model tests for the priority order + every conflict row + the total 13→9 mapping + uncertainty fallback + ban-list; 100% branch on the new precedence/conflict logic; full mediator/rail suite stays green; test count goes up. PASS (plan).

---

## 12. Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration. The implement step ships a pure-TS delta merged via the normal green-PR path; the single-derivation site picks up the new behavior with no operator action.

---

## Open questions for the operator / reviewer

- **O-1 (labels):** Do the `missing_mechanism`→"Missing link" rename in THIS card (it is the prompt's §2 named target + operator decision #6), or defer ALL label renames (incl. "Definition not shared") to UX-MEDIATOR-004 to keep UX-MEDIATOR-001 purely additive with zero copy-test churn? **Designer recommendation:** do "Missing link" here (one label, ban-list clean, named in the prompt), defer "Definition not shared" to UX-MEDIATOR-004.
- **O-2 (`value_tradeoff` display):** map the DISPLAY of `value_tradeoff` to `open` (keep the internal code + tradeoff pathway in Inspect), or request a tenth display atom? The v4 nine has no value-tradeoff state, so `open` is the faithful collapse. **Designer recommendation:** `open` display, internal code + `name_tradeoff` preserved.
- **O-3 (field vs helper):** expose the v4 display state via a pure helper `v4DisplayStateFor(point.state)` (no type-surface change, no round-trip-test churn) rather than adding a `v4DisplayState` field to `DisagreementPoint`. **Designer recommendation:** helper (smallest safe delta).

---

## Recommended implement-step scope

Touch **3 files** (additive) + **1 optional copy line**:
1. `src/features/mediator/mediatorBoardTypes.ts` — add `V4MediatorStateCode`, `ALL_V4_MEDIATOR_STATE_CODES`, `V4_PRIMARY_STATE_PRIORITY`, `V4_DISPLAY_STATE_BY_CODE`.
2. `src/features/mediator/deriveMediatorBoardState.ts` — refactor `decidePointState` to candidate-set + Gate A + ordered picker (logic moved verbatim); add `v4DisplayStateFor`.
3. `src/features/mediator/index.ts` — export the new const + helper + type.
4. (optional, O-1) `src/features/mediator/mediatorPlainLanguage.ts` — `missing_mechanism: 'Missing link'`.

Plus tests: extend `__tests__/mediatorBoardState.test.ts` and add `__tests__/mediatorPrecedence.test.ts`. Run `npm run typecheck && npm run lint && npm run test`; confirm the full mediator/rail suite is green and the test count goes up. No `src/` file outside `src/features/mediator/` changes; the single-derivation site in `ArgumentGameSurface.tsx` is untouched.
