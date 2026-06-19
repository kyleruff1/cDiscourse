# UX-MEDIATOR-003 — Evidence-debt + evidence-blocked detail (display-layer; persistence gated)

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/684
**Base:** `52748be` (after #704 UX-MEDIATOR-004) · branch `feat/UX-MEDIATOR-003-evidence-detail`
**Lane:** model-UI (consumes the once-derived board; no backend mutation) · GATE-C: **No** for the display slice · effort: **S–M** (see §0 reality audit)
**Depends on:** UX-MEDIATOR-001 (precedence + `v4DisplayStateFor`) · UX-MEDIATOR-002 (one chip + Inspect) · composes into UX-MEDIATOR-005 (rail) — all merged (#701/#702/#703/#704). Extends EV-003 (`evidenceDebtModel.ts`) + #586 (REF-003).

---

## ⚠️ §2 GATE — DISPLAY-LAYER vs PERSISTENCE — DETERMINATION (read first)

**Determination: `evidence_blocked` is fully DISPLAY-LAYER DERIVABLE from data the mediator board ALREADY has. NO new persistence, column, table, migration, persisted sub-reason, or model/type round-trip is required for this card. This card is the DISPLAY SLICE only. GATE-C: No.**

Evidence supporting the determination (verified against the shipped code at base `52748be`):

1. **`evidence_blocked` is already a first-class derived state.** `deriveMediatorBoardState.ts` emits `state: 'evidence_blocked'` purely from existing inputs:
   - a declined evidence debt — `EvidenceDebt.status === 'unresolved'` (the asked party explicitly declined / evaded, recognised by the `source_declined` / `request_evaded` tag in `evidenceDebtModel.ts`), OR
   - a `flags_context_limit` machine observation (family D, MCP-021B persisted rows) → `key_detail_unavailable`, which `v4DisplayStateFor` collapses to the `evidence_blocked` display state.
   See `deriveMediatorBoardState.ts:338-349` (candidate build), `:528-533` (`EvidenceDebtView.isBlocked`), `:699-739` (`deriveBlockedPaths`). Pinned by `mediatorBoardState.test.ts:240-275` (cases A/B/C).
2. **The board already carries every field this card renders:** `MediatorBoardState.blockedEvidencePaths` (`BlockedEvidencePath[]`), `EvidenceDebtView.isBlocked`, `point.state === 'evidence_blocked'`, and the `evidenceDebtDisplay.ts` selector (`getEvidenceDebtForPoint` → `{ openCount, kindWords, kindsLine, isBlocked }`). All pure, deterministic, JSON-serializable, already tested.
3. **"Needs evidence" ≠ "Evidence blocked" is already distinguished WITHOUT new persistence.** A plain `requested` debt with no blocking signal stays `needs_evidence`; only a declined (`unresolved`) debt or a `flags_context_limit` flag yields `evidence_blocked` (`mediatorBoardState.test.ts` case C proves the distinction is data-supported, never invented).

**What this card is NOT and what is DEFERRED to a GATE-C persistence card:**

- The issue names a possible *new persisted "mark evidence unavailable" action* (a backend write that records the asked party / a primary marking the evidence path as unavailable so the state persists round-trip rather than being re-derived from the decline tag). **That is a NEW persistence slice and is explicitly DEFERRED.** It is NOT designed here, NOT scoped here, and is operator-gated (must be preceded by a semantics-assessment). This card derives `evidence_blocked` from the *already-persisted* decline tag + family-D observation; it adds no new "mark unavailable" verb, no column, no table, no Edge Function, no migration.
- The richer "blocked-evidence-PATH model extension" (e.g. a persisted artifact-category enum on the path, a structured "what record would test this" field) is likewise a later GATE-C item — this card renders the `artifactCategory` the board *already* derives (`evidenceDebtKindWord(debt.debtKind)`), and adds person-neutral copy around it; it does not extend the model.

**Net:** this card ships UI copy + display-state mapping + plain-language helper refinements + Inspect/rail evidence rows + tests. Pure code change; no operator deploy step. Any persisted "mark evidence unavailable" action is split out and operator-gated.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

A pre-build reality audit was run against the shipped stack. Three findings reshape the scope. **The headline: much of the originally-conceived UX-MEDIATOR-003 already shipped** — this card is a NARROW DELTA, not a build-from-scratch card.

### Finding A — the evidence-debt + blocked-path RAIL surface ALREADY SHIPPED (composed by 005)

The earlier mediator series shipped #649 ("UX-MEDIATOR-003 — evidence-debt + blocked-path surface in the Disagreement Points rail"), and the canonical v4 rail (#703, UX-MEDIATOR-005) re-composes it. At base `52748be`, `DisagreementPointsRail.tsx` already renders, per point:

- `Evidence that would help: <kinds>` (`getEvidenceDebtForPoint(board, point.id).kindsLine`) — testID `disagreement-points-rail-evidence-help-<id>`;
- the open-debt count line `N evidence request(s)` — `disagreement-points-rail-evidence-<id>`;
- `Blocked evidence path` when `evidence.isBlocked` — testID `disagreement-points-rail-blocked-<id>`.

Pinned by `__tests__/disagreementPointsRailEvidence.test.tsx` (named "UX-MEDIATOR-003"). **The rail evidence section is DONE.** The implementer must NOT rebuild it; the rail delta in this card is COPY-ONLY (the person-neutral lead-in distinction + the "never implies hiding evidence" help), and even that is small.

### Finding B — the Inspect mediator-state block is GENERIC and already differentiates the two states

`MediatorNodeInspectDetail.tsx` (UX-MEDIATOR-002, #702) renders the active node's mediator state label + helper + next-move pathway. It is state-agnostic: for an `evidence_blocked` node it already shows label `Blocked evidence path` + helper `The record that would settle this is not available at the moment.` + the next-move (`Narrow or branch the claim`, since the `await_record` step is `available:false`). For a `needs_evidence` node it shows `Needs evidence` + `A source or quote was asked for and is still owed.` + `Provide a source`. **The distinction already renders in Inspect via the plain-language maps.**

The GAP the issue actually names for Inspect is the **doctrine framing**: the acceptance criterion "the *never implies hiding evidence* framing in the Inspect rationale." The shipped `evidence_blocked` helper ("The record that would settle this is not available at the moment.") is person-neutral but does NOT explicitly carry the non-accusation framing. This card's Inspect delta is to **strengthen the `evidence_blocked` helper copy** so the "not available right now — never implies anyone is hiding evidence" framing is present, plus a person-neutral next-move (name the artifact / branch the provable part). This is a COPY change in `mediatorPlainLanguage.ts`, not new structure.

### Finding C — the canonical v4 label is "Evidence blocked"; the shipped label is "Blocked evidence path"

The v4 vocabulary (index O-6, inventory L191) lists the state as **"Evidence blocked"**; the issue's recommended chip copy (§5) also says **"Evidence blocked"**. The shipped `MEDIATOR_STATE_COPY.evidence_blocked === 'Blocked evidence path'`. These are different word orders of the same meaning. **A rename to "Evidence blocked" is an interpretive decision with real test churn** (it would flip `nodeMediatorMarkers.test.ts:106`, `MediatorNodeInspectDetail.test.tsx:97`, `disagreementPointsRailEvidence.test.tsx:106/129`, `mediatorBoardState.test.ts`, `mediatorRailCopy.ts:50`). It is surfaced as **Open question O-1** with a recommendation; the safest-minimum path keeps the shipped label and ships only the helper/lead-in distinction. **The implementer must NOT silently rename — O-1 must be resolved first.**

**Effort re-estimate:** the issue labels this **M**. Given Findings A–C, the *code* delta is **S–M** (copy refinements in two files + tests). The **M** is justified by the cross-file copy reconciliation (the rename decision O-1 touches 5 test files if taken) and the doctrine-framing test surface, not by new structure.

---

## Goal (one paragraph)

Make the mediator board's **"Needs evidence"** and **"Evidence blocked"** surfaces read as **structural states about a POINT, never about a person**. "Needs evidence" means a point still owes a source/quote/record — a structural obligation, not a person failing or lying. "Evidence blocked" means the record that would test the point is unavailable / inaccessible / outside the room right now — and (the doctrine load-bearing part) it **never implies anyone is hiding, withholding, or concealing evidence**. The two states already render distinctly (Finding A/B); this card closes the doctrine-framing gap by (1) strengthening the `evidence_blocked` plain-language helper to carry the non-accusation framing and a person-neutral next move ("name what kind of record would test this point" / "branch the provable part"), (2) adding a person-neutral "what evidence would help / ask for the source" framing to the rail evidence lead-in, and (3) pinning the distinction + the non-accusation invariant in tests. It is a pure read-only projection over the once-derived `MediatorBoardState` — no derivation, no network/AI, no mutation, never a submission gate, no truth/verdict/score, and (per §2) **no new persistence**. Doctrine anchors: cdiscourse-doctrine §1 (no truth/verdict; never blocks posting), §3 + evidence-doctrine (popularity/amplification is not evidence; engagement credit and factual-standing credit stay SEPARATE and are never conflated in a visible string), §10a (machine Observation, not a user Allegation; never implies intent).

---

## Data model

**No new data model. No new persisted field. No migration.** This card consumes existing, already-derived, already-persisted-or-derivable structures verbatim:

| Existing type | Where | Used for |
|---|---|---|
| `MediatorStateCode = 'needs_evidence' \| 'evidence_blocked' \| 'key_detail_unavailable' \| …` | `mediatorBoardTypes.ts:57` | the two states (+ `key_detail_unavailable` → `evidence_blocked` display) |
| `V4MediatorStateCode` (nine) incl. `evidence_blocked`, `needs_evidence` | `mediatorBoardTypes.ts:109` | display vocabulary the chip/rail/Inspect render |
| `EvidenceDebtView { isOpen, isBlocked, kind, status, plainLabel }` | `mediatorBoardTypes.ts:306` | per-debt board view (`isBlocked` distinguishes the two) |
| `BlockedEvidencePath { pointId, nodeId, debtId, artifactCategory, plainLabel }` | `mediatorBoardTypes.ts:318` | the blocked-path roll-up the rail/Inspect read |
| `PointEvidenceDisplay { openCount, kindWords, kindsLine, isBlocked }` | `evidenceDebtDisplay.ts:18` | the compact per-point evidence selector |
| `EvidenceDebtKind` + `evidenceDebtKindWord(kind)` | `evidenceDebtModel.ts:48,713` | plain kind words ('source','quote','receipt','context','primary record') |

The derivation that produces `evidence_blocked` (declined `unresolved` debt OR `flags_context_limit` family-D obs) is **unchanged** — this card does not touch `deriveMediatorBoardState.ts`.

---

## The compact MAPPING TABLE (core deliverable)

Each surface was read before tabulating. Columns: **Surface · current implementation · desired v4 behavior · source/model hook · copy-to-use · copy-to-avoid · behavior-touched · data/API-touched · safe-now / deferred · test coverage.**

| Surface | Current impl (base `52748be`) | Desired v4 behavior | Source/model hook | Copy-to-USE | Copy-to-AVOID | Behavior touched | Data/API touched | Safe-now / deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|
| **Node chip — Needs evidence** | `MediatorNodeMarker` shows `Needs evidence` (via `getNodeMediatorMarker`→`v4DisplayStateFor`→`plainLanguageForMediatorState`) | Unchanged label; reads as a structural point obligation | `MEDIATOR_STATE_COPY.needs_evidence` | "Needs evidence" | failed · proof · liar · score | N | N | **Safe-now (no change)** | `nodeMediatorMarkers.test.ts:74-79` (regression) |
| **Node chip — Evidence blocked** | Shows `Blocked evidence path` (also from `key_detail_unavailable` collapse) | Distinct from Needs evidence; (O-1) optionally relabel "Evidence blocked" | `MEDIATOR_STATE_COPY.evidence_blocked` | "Evidence blocked" (O-1) / "Blocked evidence path" (shipped) | hiding · withheld · concealed · failed | N (label only if O-1) | N | **Safe-now** (label rename gated on O-1) | `nodeMediatorMarkers.test.ts:101-106` (update iff O-1) |
| **Inspect detail — Needs evidence** | `MediatorNodeInspectDetail` shows label + `MEDIATOR_STATE_HELPER.needs_evidence` + next-move | Lead reads "This point needs a source or record." | `helperForMediatorState('needs_evidence')` | "This point needs a source or record." / next "Add a source." (alt "Ask for a source.") · help "A source would make this point easier to test." | "failed to provide" · "proof" | N (copy only) | N | **Safe-now** (helper copy refine) | `MediatorNodeInspectDetail.test.tsx` (extend: helper text + ban-list) |
| **Inspect detail — Evidence blocked** | Shows label + `MEDIATOR_STATE_HELPER.evidence_blocked` ("…not available at the moment.") + next-move (`Narrow or branch the claim`) | Lead "The evidence path is not available right now." + **explicit "never implies someone is hiding evidence"** rationale; person-neutral next move | `helperForMediatorState('evidence_blocked')` + pathway `evidence_blocked` (`await_record` unavailable, `narrow_or_branch` available) | "The evidence path is not available right now." · help "Name what kind of record would test this point, without demanding private access." · next "Mark evidence unavailable." (alt "Branch the provable part.") | **hiding · withheld · concealed** · failed · proof · accusation | N (copy only) | N | **Safe-now** (the core doctrine-framing delta) | NEW `uxMediator003EvidenceDetail.test.tsx`: blocked ≠ concealment/blame |
| **Rail row — evidence-help line** | `Evidence that would help: <kinds>` (`evidenceHelp` + `kindsLine`) | Person-neutral "what would test this point" framing; unchanged structure | `DISAGREEMENT_POINTS_RAIL_COPY.evidenceHelp` + `getEvidenceDebtForPoint().kindsLine` | "Evidence that would help" (keep) · alt "Show what would test this point." | "owed by them" · "they failed to" | N (copy keep/refine) | N | **Safe-now (shipped; copy optional)** | `disagreementPointsRailEvidence.test.tsx:82-92` (regression) |
| **Rail row — blocked line** | `Blocked evidence path` when `evidence.isBlocked` | Distinct from the help line; (O-1) "Evidence blocked" | `DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath` + `evidence.isBlocked` | "Evidence blocked" (O-1) / "Blocked evidence path" (shipped) | hiding · withheld · concealed | N (label only if O-1) | N | **Safe-now (shipped)** | `disagreementPointsRailEvidence.test.tsx:94-107` (update iff O-1) |
| **`evidenceDebtDisplay.ts` selector** | `getEvidenceDebtForPoint` → `{openCount,kindWords,kindsLine,isBlocked}` | Unchanged (already SELECTS, never derives) | — | — (returns kind words only) | — | N | N | **Safe-now (no change)** | `evidenceDebtDisplay.test.ts` (regression) |
| **`mediatorPlainLanguage.ts` helper map** | `MEDIATOR_STATE_HELPER.evidence_blocked` / `.needs_evidence` | Refine both helpers to the §5 person-neutral framing; add the non-accusation clause to `evidence_blocked` | `MEDIATOR_STATE_HELPER` + `_forbiddenMediatorTokens()` | §5 copy | ban-list | N (copy) | N | **Safe-now (the change site)** | `mediatorBoardState.test.ts:490-514` ban-list (regression) + new helper-text test |
| **Pathway step copy** | `PATHWAY_STEP_COPY.await_record` = "A primary record would distinguish these claims" ; `narrow_or_branch` = "Narrow or branch the claim" | Optionally add a person-neutral "Mark evidence unavailable" / "Branch the provable part" next-move framing for blocked | `PATHWAY_STEP_COPY` (+ optional new step code — O-3) | "Mark evidence unavailable." / "Branch the provable part." | "force them to disclose" | N (copy; **no new step code unless O-3**) | N | **Safe-now (copy) / new step code DEFERRED to O-3** | new pathway-copy test iff O-3 |
| **Persisted "mark evidence unavailable" action** | none | a backend write that records the path as unavailable | — | — | — | — | **YES (write)** | **DEFERRED — GATE-C persistence card** | n/a (out of scope) |
| **`gameCopy.toPlainLanguage`** | maps internal validation codes; `evidence_debt` / `evidence_blocked` already mapped? (verify) | ensure no raw code leaks if any evidence-blocked code reaches a user string | `gameCopy.ts` (read-only verify) | plain words | snake_case | N | N | **Safe-now (verify only)** | existing gameCopy ban-list tests (regression) |

**Safe-now summary:** node-chip distinction (shipped), Inspect helper refinement (the core doctrine delta), rail evidence/blocked rows (shipped — copy optional), helper/pathway copy in `mediatorPlainLanguage.ts`, tests. **Deferred:** the persisted "mark evidence unavailable" action (GATE-C), any new pathway step code (O-3), the "Evidence blocked" label rename (gated on O-1).

---

## Exact copy (person-neutral) — the §5 recommendation, reconciled to shipped maps

**Evidence debt ("Needs evidence")**
- Chip: `Needs evidence` (shipped `MEDIATOR_STATE_COPY.needs_evidence` — keep).
- Detail lead / helper (`MEDIATOR_STATE_HELPER.needs_evidence`): **"This point needs a source or record."** (refine from the shipped "A source or quote was asked for and is still owed.").
- Next move (pathway `provide_source`): **"Add a source."** (alt "Ask for a source.") — refine `PATHWAY_STEP_COPY.provide_source` from "Provide a source" (optional, O-2).
- Help: **"A source would make this point easier to test."**

**Evidence blocked ("Evidence blocked")**
- Chip: **"Evidence blocked"** (O-1) — or keep shipped `"Blocked evidence path"`.
- Detail lead / helper (`MEDIATOR_STATE_HELPER.evidence_blocked`): **"The evidence path is not available right now."** + the non-accusation clause folded in (one or two `<Text>` lines): **"This never implies anyone is hiding evidence."** (the load-bearing doctrine framing; the issue's acceptance criterion).
- Next move: **"Mark evidence unavailable."** (alt "Branch the provable part.") — rendered from the pathway label; if no new step code is added (O-3 declined), reuse the existing `narrow_or_branch` label "Narrow or branch the claim" / `await_record` and put "Mark evidence unavailable" / "Branch the provable part" in the helper/help line instead.
- Help: **"Name what kind of record would test this point, without demanding private access."**

**Source / quote prompts (rail / Inspect, advisory):** "Ask for the source." · "Ask for the quote." · "Add the record." · "Show what would test this point."

**AVOID (ban-list — never in any visible string):** hiding · withheld · concealed · failed · proof of truth · fallacy · dishonest · bad faith · manipulative · "AI thinks" · truth · verdict · winner · loser · score · "decide for me". (These appear only in test ban-list arrays, never user-facing.) The shipped `_forbiddenMediatorTokens()` already bans most; this card adds the explicit **hiding / withheld / concealed / failed** assertions to the test scan over the new copy (and to `_forbiddenMediatorTokens()` if not already present — `'failed'`-family terms are present; add `hiding`/`withheld`/`concealed` to the scan).

---

## Where "Needs evidence" / "Evidence blocked" will appear (after this card)

- **Node chip** (active node, `MediatorNodeMarker`): "Needs evidence" / "Evidence blocked" (or "Blocked evidence path") — already renders; this card does not change the chip component, only (optionally, O-1) its label string via `MEDIATOR_STATE_COPY`.
- **Inspect detail** (`MediatorNodeInspectDetail`, active node, when Inspect open): label + the refined person-neutral helper (the **non-accusation framing lands here** — the acceptance criterion) + next-move. Already mounts; this card refines the copy it consumes.
- **Disagreement Points rail** (per live point): the evidence-help line + the blocked line — **already render** (Finding A); copy optionally refined.
- **NOT** on every node, NOT as a posting gate, NOT as a banner. `getNodeMediatorMarker` already suppresses non-actionable nodes (no chip soup); this card preserves that.

---

## File changes (smallest-safe delta)

- **MODIFY `src/features/mediator/mediatorPlainLanguage.ts`** (~8–14 lines changed, no new export): refine `MEDIATOR_STATE_HELPER.needs_evidence` and `MEDIATOR_STATE_HELPER.evidence_blocked` to the §5 person-neutral copy (the blocked helper gains the explicit "never implies anyone is hiding evidence" clause). Optionally refine `PATHWAY_STEP_COPY.provide_source` (O-2). If O-1 taken: change `MEDIATOR_STATE_COPY.evidence_blocked` → "Evidence blocked". Add `hiding`/`withheld`/`concealed` to `_forbiddenMediatorTokens()` if absent. **This is the primary change site.**
- **MODIFY `src/features/mediator/MediatorNodeInspectDetail.tsx`** (~6–10 lines, only if the non-accusation clause is a SEPARATE `<Text>` row rather than folded into the helper string): add an optional `nonAccusationNote` prop/row rendered only for `evidence_blocked`, person-neutral, `accessibilityRole="text"`. **Recommendation:** fold the clause into the helper string to avoid touching the component (then this file is UNTOUCHED) — see O-4.
- **MODIFY `src/features/mediator/mediatorRailCopy.ts`** (~0–4 lines, optional): refine the `evidenceHelp` lead-in or add an alt "Show what would test this point." If O-1 taken: `blockedEvidencePath` → "Evidence blocked". Keep all existing keys exported (deprecate, never delete).
- **NEW `__tests__/uxMediator003EvidenceDetail.test.tsx`** (~120–160 lines): the doctrine-framing + distinction tests (see Test plan).
- **MODIFY (reconcile only) the pinned tests** named in "Tests pinning evidence-debt wording" below — ONLY if O-1 / O-2 change a pinned string; otherwise untouched.

**UNTOUCHED (byte-for-byte / behavior preserved):**
- `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts` — the derivation + the state codes are unchanged (no new code, no precedence change).
- `evidenceDebtDisplay.ts`, `evidenceDebtModel.ts` — the selectors + the debt model are unchanged (this card SELECTS the words they return, never re-derives).
- `DisagreementPointsRail.tsx` — the evidence/blocked rows already render (Finding A); touched ONLY if a rail copy string changes (and only via `mediatorRailCopy.ts` constants, not the component logic).
- `MediatorNodeMarker.tsx`, `nodeMediatorMarkers.ts` — the chip component + selection are unchanged (label string flows from `MEDIATOR_STATE_COPY`).
- `antiAmplification.ts`, `pointStanding/*` — untouched; engagement-credit vs factual-standing separation is preserved by NOT importing or conflating them in any visible string.
- `ArgumentGameSurface.tsx` — no mount change.

**Net file count:** Modified **1–3** (`mediatorPlainLanguage.ts` always; `mediatorRailCopy.ts` + `MediatorNodeInspectDetail.tsx` optional). New **1** (test file). Deleted **0**. Migration **0**. Edge Function **0**.

---

## API / interface contracts

No new public function signatures. The card refines values in three frozen copy maps (`MEDIATOR_STATE_HELPER`, optionally `MEDIATOR_STATE_COPY`, `PATHWAY_STEP_COPY`, `DISAGREEMENT_POINTS_RAIL_COPY`) consumed by the existing typed lookups `helperForMediatorState`, `plainLanguageForMediatorState`, `plainLanguageForPathwayStep`. If a separate non-accusation row is chosen (O-4b), `MediatorNodeInspectDetailProps` gains one optional field:

```ts
// OPTIONAL — only if O-4b (separate row) is chosen; default recommendation is O-4a (fold into helper, no prop).
export interface MediatorNodeInspectDetailProps {
  // …existing…
  /** Person-neutral non-accusation note, rendered only for evidence_blocked. Null/empty → omitted. */
  nonAccusationNote?: string | null;
}
```

---

## Edge cases (the implementer must handle)

- **Empty inputs:** `null` board / no points / point with no debt → no evidence line, no blocked line (shipped `getEvidenceDebtForPoint` returns null; pinned). No change.
- **`requested` debt, no blocking signal:** stays "Needs evidence", never "Evidence blocked" (the distinction must not regress — `mediatorBoardState.test.ts` case C). The new test re-asserts this at the display layer.
- **`key_detail_unavailable` (family-D `flags_context_limit`, no debt):** collapses to `evidence_blocked` display; the blocked-path uses `plainLabel: 'Key detail unavailable'` for the path but the chip/Inspect read the `evidence_blocked` display copy. Confirm the Inspect helper for this collapsed case still reads person-neutral (it does — the helper is keyed by the internal code in the marker; `getNodeMediatorMarker` projects to `evidence_blocked`, so the Inspect block receives `code:'evidence_blocked'`). The new test covers a `key_detail_unavailable` node → Inspect shows the blocked, non-accusation framing.
- **Insufficient signal → Open/unknown preserved:** a point with no evidence obligation and no observation stays `open` with `confidence:'unknown'`; no evidence-blocked copy appears. The card never promotes uncertainty to a stronger claim (doctrine §3 / UX-MEDIATOR-001 §3).
- **Both blocked + needs-evidence on one point:** the conflict rule (`evidence_blocked` wins, `INTERNAL_STATE_PRIORITY`) is unchanged; the point shows ONE primary state (Evidence blocked), and the rail still lists the kind words. No chip soup (one primary state by default — preserved).
- **Engagement vs factual-standing:** no visible string may state or imply that engagement/popularity grants the point standing, nor that an evidence debt lowers a "score". The ban-list + a targeted assertion guard this (evidence-doctrine).
- **Reduce motion / a11y:** no new motion (copy only); all new text inside `<Text>`, `accessibilityRole="text"`; the Inspect block already carries its labelled header. No new interactive element (so no 44×44 obligation) unless O-3 adds a next-move affordance — and the next move stays read-only copy, not a button, in this card.

---

## Test plan (`__tests__/`)

**New — `__tests__/uxMediator003EvidenceDetail.test.tsx`:**
- **Distinction (v4 labels):** `needs_evidence` node → Inspect/marker shows "Needs evidence"; `evidence_blocked` node → "Evidence blocked"/"Blocked evidence path" (whichever O-1 resolves); assert the two strings differ and neither leaks the other's framing.
- **Blocked ≠ concealment / blame (the doctrine acceptance criterion):** render the `evidence_blocked` Inspect detail; assert the rendered text contains the non-accusation framing ("not available right now" / "never implies … hiding") AND assert it contains NONE of `['hiding','withheld','concealed','failed','dishonest','bad faith','accusation','manipulative']`.
- **Person-neutral + ban-list clean:** scan all rendered strings (chip + Inspect + the refined helpers) against `_forbiddenMediatorTokens()` + the explicit `hiding/withheld/concealed/failed/proof/truth/verdict/winner/loser/score` list; no snake_case leak.
- **Engagement ≠ factual-standing:** assert no rendered evidence string contains `['engagement','likes','views','followers','popular','viral','amplification','score']` (re-scan; evidence-doctrine).
- **Rail == chip vocabulary:** for a board with an `evidence_blocked` point, the rail blocked line and the node chip use the same display label (`v4DisplayStateFor` parity).
- **Insufficient → Open:** a point with no debt/obs renders no evidence-blocked / needs-evidence copy (stays open, no chip).
- **`key_detail_unavailable` collapse:** a family-D-flagged node shows the blocked, non-accusation Inspect framing.
- **Ordinary submit untouched (regression-by-assertion):** the card imports nothing from the submit path; a smoke assert that the copy maps are pure (no side effects) — and the full-suite run confirms `submit-argument` tests are green.

**Reconcile (only if O-1/O-2 flip a pinned string):**
- `__tests__/nodeMediatorMarkers.test.ts:101-106` (chip label), `__tests__/MediatorNodeInspectDetail.test.tsx:97`, `__tests__/disagreementPointsRailEvidence.test.tsx:94-129`, `__tests__/mediatorBoardState.test.ts` (`MEDIATOR_STATE_COPY` ban-list/label), `mediatorRailCopy.ts` consumers — update the expected string in lockstep with the rename. If O-1 is declined, these are **untouched**.

**Regression (must stay green):** `__tests__/{evidenceDebtDisplay,evidenceDebtModel,mediatorBoardState,mediatorPrecedence,nodeMediatorMarkers,MediatorNodeMarker,MediatorNodeInspectDetail,DisagreementPointsRail,disagreementPointsRailEvidence,disagreementPointsRailBridge,uxMediator002NodeMarkup,uxMediator004DefinitionScopeBridge,uxMediator005DisagreementSheet,roomMediatorAdapter}.test.*`.

**Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite, captured exit code per test-discipline gate-timeout rule); test count goes UP.

---

## Dependencies (cards / docs / files)

- **Depends on UX-MEDIATOR-001** (#701, merged) — `v4DisplayStateFor`, the nine-state display vocabulary, the `evidence_blocked`/`needs_evidence` codes + precedence. `docs/designs/UX-MEDIATOR-001.md`.
- **Depends on UX-MEDIATOR-002** (#702, merged) — the one-chip node markup + `MediatorNodeInspectDetail` (the Inspect block this card refines copy for). `docs/designs/UX-MEDIATOR-002.md`.
- **Composes into UX-MEDIATOR-005** (#703, merged) — the rail already renders the evidence/blocked rows (Finding A); this card refines the copy they consume. `docs/designs/UX-MEDIATOR-005.md`.
- **Extends EV-003** (`src/features/evidence/evidenceDebtModel.ts`) + **#586 (REF-003)** — reuses `EvidenceDebtKind`/`evidenceDebtKindWord`/statuses; does NOT re-implement the debt model.
- **Reads existing (no re-derivation):** `deriveMediatorBoardState` (once-derived board in `ArgumentGameSurface`), `getEvidenceDebtForPoint`, `helperForMediatorState`/`plainLanguageForMediatorState`/`plainLanguageForPathwayStep`.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): the board is derived once and shared; this card adds no second derivation.

---

## Risks

- **R1 — O-1 rename test churn.** Relabeling `evidence_blocked` → "Evidence blocked" flips ~5 pinned test strings. *Mitigation:* O-1 is an explicit operator decision; if declined, the card is a pure helper-copy change with zero label churn. The implementer greps `__tests__` for `'Blocked evidence path'` before any rename and updates in lockstep.
- **R2 — Helper copy could re-introduce a banned token.** The "never implies … hiding evidence" clause literally names the concept it forbids. *Mitigation:* phrase the non-accusation clause WITHOUT the banned word in the visible string (e.g. "This never implies anyone is keeping evidence back" risks "withheld"-adjacency) — **prefer** "The record is simply not reachable right now." + "It does not mean anyone is at fault." The ban-list test will catch a slip; the clause must pass it. This is the single most delicate copy choice — flagged as O-5.
- **R3 — Conflating engagement and factual-standing.** A careless "evidence would raise this point's standing" string would imply scoring. *Mitigation:* copy speaks of making a point "easier to test", never "stronger / higher standing / more credit"; the test scans for score/standing/engagement tokens.
- **R4 — Scope creep into the persisted action.** The issue dangles a "mark evidence unavailable" write. *Mitigation:* §2 gate explicitly defers it; "Mark evidence unavailable." is rendered as advisory next-move COPY only — no button, no write, no state change.
- **R5 — `MediatorNodeInspectDetail` is pinned (UX-MEDIATOR-002 tests).** Editing it risks a snapshot. *Mitigation:* O-4a (fold the clause into the helper string) leaves the component UNTOUCHED — recommended.

---

## Out of scope (explicit non-goals)

- **NO new persistence / migration / Edge Function / column / persisted sub-reason / "mark evidence unavailable" backend write** — DEFERRED to a separate GATE-C card (semantics-assessment first).
- **NO derivation / precedence change** — `deriveMediatorBoardState.ts` is untouched; UX-MEDIATOR-001 owns it.
- **NO new mediator state code, NO new evidence debt kind/status.**
- **NO classifier / MCP / Family K/J / provider / AI call.**
- **NO new evidence-upload flow** — the card renders what already exists.
- **NO rail redesign** — UX-MEDIATOR-005 owns the rail; this card composes its shipped evidence rows.
- **NO node-chip component change** beyond an optional `MEDIATOR_STATE_COPY` label string (O-1).
- **NO room / seat / chime-in / submission-semantics change; NO submit-path change.**
- **NO route/model/table/type rename** (the `evidence_blocked` → "Evidence blocked" change is a COPY-VALUE change, not a code/type rename).
- **NO deploy, NO netlify-prod, NO Supabase write, NO service-role.**

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict; score never blocks posting):** "Needs evidence" / "Evidence blocked" are structural states about a POINT; never a verdict/person/truth label. The board is read-only and gates nothing; this card adds no gate. PASS.
- **§2 (heat ≠ truth):** no heat/temperature/engagement signal enters the evidence copy. PASS.
- **§3 + evidence-doctrine (popularity is not evidence; engagement vs factual-standing SEPARATE):** copy speaks of making a point "easier to test", never of standing/credit/engagement; a test scans for score/standing/engagement/popularity tokens; `antiAmplification.ts` is not imported or conflated. PASS.
- **§4 (AI moderator limits):** no AI-judge framing; the deterministic engine remains the sole submission gate; the evidence-blocked state is derived from persisted decline tags + family-D observations (advisory, `authoritative:false`), never an AI verdict; insufficient signal → Open/unknown. PASS.
- **§9 (plain language):** every rendered string flows through the plain-language maps; no internal code (`evidence_blocked`, `flags_context_limit`, `source_chain`) reaches a user string; the new test re-asserts no snake_case leak. PASS.
- **§10a (Observations vs Allegations):** "Evidence blocked" is a machine **Observation** (derived from the decline tag / family-D flag), never a user **Allegation**, and explicitly **never implies a person is hiding/withholding evidence** (the load-bearing copy). PASS.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API, no realtime body editing, no new persistence. PASS.
- **accessibility-targets:** copy-only; all text inside `<Text>`, `accessibilityRole="text"`; the Inspect block keeps its labelled header; no new interactive element / no new motion. PASS.
- **test-discipline:** new distinction + non-accusation + ban-list + engagement-separation + insufficient→open tests; regression re-run of the mediator/evidence/rail suites; full-suite exit-0 gate; test count up. PASS (plan).

---

## Operator steps (if any)

**None — pure code change (display slice).** No `db push`, no `functions deploy`, no env var, no migration, no deploy. Merged via the normal green-PR path; the once-derived board picks up the refined copy with no operator action. **The persisted "mark evidence unavailable" action, if ever pursued, is a SEPARATE operator-gated GATE-C card with its own semantics-assessment + `db push` — not this card.**

---

## Open questions for the operator (each with a designer recommendation)

- **O-1 (label — "Evidence blocked" vs shipped "Blocked evidence path"):** the v4 vocabulary + the issue §5 say chip **"Evidence blocked"**; the shipped `MEDIATOR_STATE_COPY.evidence_blocked` is **"Blocked evidence path"**. Rename, or keep? **Recommendation: rename to "Evidence blocked"** — it matches the canonical v4 nine-state vocabulary (index O-6) and the issue's recommended copy, and it is a copy-VALUE change (not a type rename). Cost: ~5 pinned test strings updated in lockstep. Decline only for the absolute-minimum diff (then ship only the helper distinction).
- **O-2 (next-move verb — "Add a source." vs shipped "Provide a source"):** refine `PATHWAY_STEP_COPY.provide_source`? **Recommendation: optional** — "Add a source." is slightly warmer/shorter; low value, low churn. Defer if minimizing diff.
- **O-3 (new pathway step code for blocked next-move):** add a `mark_evidence_unavailable` step code, or render "Mark evidence unavailable." / "Branch the provable part." as helper/help copy reusing the existing `narrow_or_branch` step? **Recommendation: reuse existing steps + put the phrasing in the helper/help line** — adding a step code touches `ResolutionPathwayStepCode` (a type) + the pathway derivation; keeping it copy-only honours "no model/type change". A persisted action is separately deferred (§2).
- **O-4 (non-accusation clause — fold into helper string vs separate Inspect row):** (a) fold "never implies anyone is hiding evidence" into `MEDIATOR_STATE_HELPER.evidence_blocked` (leaves `MediatorNodeInspectDetail.tsx` UNTOUCHED), or (b) add an optional `nonAccusationNote` row to the Inspect component? **Recommendation: (a)** — zero component churn, the helper already renders as its own `<Text>`; the clause reads naturally as a second sentence.
- **O-5 (exact non-accusation wording — avoid the banned token it describes):** the clause must convey "no one is hiding evidence" WITHOUT using `hiding`/`withheld`/`concealed` (which the ban-list scan will reject). **Recommendation:** "The record is simply not reachable right now — it does not mean anyone is at fault." (passes the ban-list; carries the doctrine). Operator may prefer alternate wording; any choice must pass the ban-list test.

---

## Deferrals

- **Persisted "mark evidence unavailable" action** → a separate **GATE-C persistence card** (new column/table or persisted sub-reason + Edge Function + migration + semantics-assessment + operator deploy). Not designed here.
- **Selected-node deeper evidence anatomy** → **UX-SELECTED-NODE-001**.
- **Act-suggestion next-move wiring off the evidence state** → **UX-NEXT-MOVE-001**.
- **Evidence-blocked → structured-impasse endpoint path** → **UX-IMPASSE-001** (this card supplies the person-neutral blocked framing it consumes).
- **Chime-in / principal contribution context on evidence rows** → **UX-ROOM-1V1-CHIMEIN-001**.
- **Any new pathway step code** (O-3) → folded into UX-NEXT-MOVE-001 if pursued.

---

## Recommended implement-step scope

Touch **1–3 files + 1 new test**:

1. `src/features/mediator/mediatorPlainLanguage.ts` — refine `MEDIATOR_STATE_HELPER.evidence_blocked` (+ the non-accusation clause, O-5) and `.needs_evidence`; optionally `PATHWAY_STEP_COPY.provide_source` (O-2); if O-1: `MEDIATOR_STATE_COPY.evidence_blocked` → "Evidence blocked"; add `hiding`/`withheld`/`concealed` to `_forbiddenMediatorTokens()` if absent.
2. (optional) `src/features/mediator/mediatorRailCopy.ts` — if O-1, `blockedEvidencePath` → "Evidence blocked"; optional alt help string.
3. (only if O-4b) `src/features/mediator/MediatorNodeInspectDetail.tsx` — optional `nonAccusationNote` row. **Recommendation: skip (O-4a).**
4. `__tests__/uxMediator003EvidenceDetail.test.tsx` (new) + lockstep reconcile of the pinned strings ONLY if O-1/O-2 taken.

Run `npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the mediator + evidence + rail suites are green and the test count goes up. No `deriveMediatorBoardState` change, no backend, no migration, no deploy.
