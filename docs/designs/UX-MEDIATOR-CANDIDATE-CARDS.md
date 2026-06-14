# UX-MEDIATOR-CANDIDATE-CARDS — draft backlog (not filed)

Status: Draft candidate cards only. **Not filed as GitHub issues.** Companion to `docs/designs/UX-MEDIATOR-ASSESSMENT-001.md`.
Date: 2026-06-14

> These are **drafts for operator review**, not issues. No card here authorizes implementation. Each carries a tier (**[SHIP-NOW] / [BRIDGE] / [NORTH-STAR]**) and, where speculative, the full quality bar (why it matters · user pain · surfaces touched · data/model support · prototype · test · doctrine/UX risk).
>
> Every card inherits the standard boundary line, to be made verbatim at design time:
> *"NO runtime mutation, NO provider call, NO queue arm, NO Supabase config write, NO deployment, NO H/I/J flip, NO service-role/client leakage by Claude in this card."* (Cards that legitimately add a migration/Edge Function relax exactly the clause they need, and only with operator sign-off per the pipeline-governance contract.)

---

## UX-MEDIATOR-001 — pure-TS mediator-state model + `deriveMediatorBoardState`  **[BRIDGE]**

**Problem.** The "live structure of the disagreement" is computed in pieces ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts), [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts), Families A–I) but never composed into one object the UI can render.

**User story.** "As a reader I want one object that tells me the open disagreement points, what's owed, and what's stuck — so the UI can show me the shape of the fight."

**Scope.** Net-new pure module `src/features/mediator/` (types + `deriveMediatorBoardState` + `deriveOpenDisagreementPoints` + `deriveEvidenceDebt` adapter + `deriveImpasseMarkers` + `deriveResolutionPathways` + `plainLanguageForMediatorState`). **No UI, no migration, no Edge Function, no hook in this card** (a sibling adds the fetch hook). Mirrors [engine.ts](src/domain/constitution/engine.ts) purity.

**Reuses.** `buildPointLifecycleMap`, `deriveEvidenceDebts`/roll-ups, `argumentGameSurfaceModel`, persisted observation row types ([machineObservationPersistenceTypes.ts](src/features/nodeLabels/machineObservationPersistenceTypes.ts)). Imports nothing from Supabase/React/network.

**Model changes.** The types in UX-MEDIATOR-ASSESSMENT-001 §8.3. Add an `isBlocked` sub-reason path on the evidence-debt *view* (the EV-003 model itself is untouched here; the blocked detection lands in UX-MEDIATOR-003).

**Classifier/MCP support.** Consumes already-persisted Families A–I rows. No new classifier. No dormant-family activation.

**First validating tests.** Fixture graphs whose expected `MediatorBoardState` is known: (a) one open claim → one `open` point; (b) claim + source request → `needs_evidence`; (c) narrow concession → `narrowed`; (d) exhausted with no pathway → `structured_impasse`; (e) determinism (same input twice → deep-equal); (f) ban-list scan over every `plainLanguageForMediatorState` output; (g) uncertainty: empty observations → `confidence: 'unknown'`, state `open`; (h) **`primaryState` priority** — a node carrying multiple concepts (e.g. `narrowed` + `off_point`) resolves to one deterministic `primaryState` via a worst-priority-wins ranking that reuses LIFE-001's `LIFECYCLE_PRIORITY` order ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)); (i) **cache key** — `inputHash` mirrors the LIFE-001 `inputHash` pattern so the board re-derives only when inputs change.

**Doctrine.** Pure, deterministic, JSON-serializable, never a gate, plain-language mapped, uncertainty-preserving. GATE-C N/A (no deploy). Automerge-prefer once green.

**Boundary.** NO runtime mutation, NO provider call, NO queue arm, NO Supabase config write, NO deployment, NO H/I/J flip, NO service-role/client leakage, NO migration by Claude in this card.

---

## UX-MEDIATOR-002 — one-primary-chip node markup + board impasse markup  **[BRIDGE]**

**Problem (C3).** A node can stack lifecycle tag + manual tags + evidence chip + referee banner + 3 classifier chips. No single answer to "what's the state of this point?"

**User story.** "As a reader I want each move to show one clear state, with detail on tap."

**Surfaces.** [NodeLabelStrip.tsx](src/features/nodeLabels/NodeLabelStrip.tsx), [cardClassifierStripModel.ts](src/features/arguments/cardView/cardClassifierStripModel.ts), timeline node renderer. Binds to `MediatorMarkup` from UX-MEDIATOR-001.

**Data/model support.** `MediatorMarkup.primaryState` per node; existing chips move to an on-tap detail surface.

**Prototype.** Render the single primary chip from the deriver; keep all current chips behind an "expand" affordance.

**Test (Puppeteer + unit).** Snapshot per `MediatorStateCode`; assert exactly one primary chip in the default node view; assert detail expands on tap.

**Doctrine/UX risk.** Chip-soup creeping back; the structured-impasse banner reading as "you failed" (copy must be calm/dignified).

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-MEDIATOR-003 — evidence-debt + blocked-evidence-path surface  **[BRIDGE]**

**Problem.** Evidence debts are scattered per-node; "a record exists but is unavailable" (blocked path) is not modeled distinctly from "owed/declined/stale."

**User story.** "As a participant I want to see what sources are owed in one place, and to mark when the record that would settle it isn't available — without it sounding like I'm accusing anyone of hiding it."

**Surfaces + reuse.** [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts) roll-ups (`getRoomEvidenceDebtSummary`, `getNodeEvidenceDebtSummary`); a new composer affordance to mark a debt `blocked` with an artifact *category* (never a demand for disclosure).

**Model changes.** Add a `blocked` sub-reason on the EvidenceDebt view (the persisted EV-003 model can gain a render-time flag; a later persistence card stores it). Plain-language chip variant "Evidence not available."

**Classifier support.** Family D `flags_context_limit` / `creates_source_chain_gap` as advisory inputs.

**Test.** Fixtures: open source debt → "Source requested"; declined → "Still unresolved"; blocked → "Evidence not available"; settled-by-both → "Settled by both"; ban-list over all chip copy.

**Doctrine/UX risk.** "Blocked" must never read as "they're hiding it." Copy names a *category* of record, not a person.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-MEDIATOR-004 — definition / scope mismatch bridge UI  **[BRIDGE]**

**Problem.** Same term used two ways; replies answer a broader/narrower claim than the target — both are detectable but not surfaced as a guided bridge.

**User story.** "When we're using a word differently, prompt us to pin it. When I'm answering a different scope, let me accept, narrow, or branch."

**Surfaces.** Composer ([conversationMoves.ts](src/features/arguments/conversationMoves.ts)) + selected-point card. Binds `DefinitionMismatch` / `ScopeMismatch` from UX-MEDIATOR-001.

**Classifier support.** Family C (`proposes_shared_definition`, `flags_term_ambiguity`, `scope_mismatch_identified`), Family B (`disputes_definition`, `disputes_scope`).

**Prototype.** When the deriver flags a definition/scope mismatch on the active point, show a 1-tap "Define the term" / "Accept · Narrow · Branch" bridge.

**Test.** Fixtures with term ambiguity → definition bridge appears; off-scope reply → scope bridge appears with three actions.

**Doctrine/UX risk.** Must read as help, not "you're equivocating." Advisory; never blocks.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-MEDIATOR-005 — Disagreement Points rail (first visible board)  **[BRIDGE]**

**Problem (the core vision).** You must read the whole thread to find the actual fight.

**User story.** "As a reader/observer I want a rail of the live disagreement points and their state, anchored to the right nodes."

**Surfaces.** New rail in [ArgumentGameSurface.tsx](src/features/arguments/ArgumentGameSurface.tsx); collapsible; observer-friendly. Binds `MediatorBoardState.points`.

**Scope (v1 deliberately minimal).** Three states only: **Open · Needs evidence · Structured impasse.** Tapping a point scrolls/anchors to its node. No scores, no "winning," no person labels.

**Data/model support.** UX-MEDIATOR-001 output; no new classifier.

**Prototype.** Render `points` as a list; each row = plain label + state + tap-to-anchor.

**Test (Puppeteer + unit).** Fixture room with three branches → rail shows three rows anchored to the three correct nodes with the three expected states; mobile-width collapse renders a count chip; observer view shows the rail but no compose affordance.

**Doctrine/UX risk.** "Is this a leaderboard?" → copy says "open points," never "winning points"; states are structural.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-SIMPLIFY-001 — create-room / create-argument flow streamlining  **[SHIP-NOW / BRIDGE]**

**Problem.** Creation already composes visibility + invite + capacity ([argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts), [StartArgumentPage.tsx](src/features/arguments/startArgument/StartArgumentPage.tsx)); verify the path is the *obvious* one and the four seat states are legible at creation.

**User story.** "As a creator I want the default (private 1v1 with one invite, or public capped) to be obvious without reading docs."

**Surfaces.** [StartArgumentPage.tsx](src/features/arguments/startArgument/StartArgumentPage.tsx), [CreateDebateForm.tsx](src/features/debates/CreateDebateForm.tsx).

**Test.** Puppeteer: private path requires exactly one invite; public path shows the seat math ("4 open of 5"); copy is verdict-free.

**Doctrine.** Preserve the four seat states (do not collapse). **[SHIP-NOW]** for copy; **[BRIDGE]** if it restructures the form.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-SIMPLIFY-002 — observer / participant + seat clarity  **[SHIP-NOW]**

**Problem (C8).** Public rooms can feel like unbounded comment threads; observer vs active-seat is not obvious at a glance.

**User story.** "As anyone entering a public room I want to see who can speak and how many seats are open."

**Surfaces.** Room header; reuse seat math from [argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts) + active-participant count.

**Test.** Puppeteer: public room header shows "N of 5 active · M watching"; observer has no compose affordance; private shows the 1v1 state.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-SIMPLIFY-003 — composer form-enforcement simplification  **[SHIP-NOW / BRIDGE]**

**Problem (C4, C6).** 9 latent composer modes; ask-source/ask-quote buried in the Act popout.

**Changes.** Promote ask-source / ask-quote to one-tap on another participant's node; clearly gate or remove the 9 design-only modes from [argumentModeModel.ts](src/features/modes/argumentModeModel.ts) so latent complexity isn't shipped.

**Test.** Puppeteer: ask-source reachable in one tap; only shipped modes selectable. Unit: mode list = shipped set.

**Boundary.** NO runtime mutation, NO provider call … (standard line).

---

## UX-TEST-001 — Puppeteer journey harness (operator-gated)  **[BRIDGE]**

**Problem.** No browser/E2E harness exists; the assessment could only test the logged-out screen non-mutatingly (§11).

**Scope.** Add a dev-only browser harness (Puppeteer **or** the Claude_Preview MCP) that drives: logged-out clarity (no creds), then — **only under an operator flag with test credentials against a disposable/fixture backend** — create/observe/respond/evidence/concede/impasse/mobile journeys. **Never** against production data.

**Deliverables.** `scripts/ux/` harness + `docs/testing-runs/` report template. Draft journeys: `.tmp/ux-mediator-assessment/journeys.draft.md`.

**Gating.** Logged-out journeys: ungated, non-mutating. Authenticated journeys: env flag + test creds + non-prod backend + `--pilot`-style gate, mirroring the bot-fixture discipline.

**Test.** The harness self-tests on the logged-out screen (assert title fixed, value prop present, masthead height) — these double as regression guards for UX-COPY-001.

**Boundary.** Dev-only. NO production data mutation; authenticated runs are operator-gated. NO provider call by Claude.

---

## UX-COPY-001 — plain-language + first-run clarity  **[SHIP-NOW]**

**Problem (F1, F2, C1, C9 + two recorded conflicts).** Tab title `expo-scaffold`; no value prop on the logged-out screen; four-word noun sprawl; `moderator`→"Observer" collision. Two items are **operator decisions, not unilateral fixes** (see Changes 3 and 6).

**Changes.**
1. Set product display name + **web document title** (fix `expo-scaffold`). *Note:* the `app.json` `slug` affects EAS/deploy identity — change the **display name and web title** safely; treat the `slug` change as a separate, deploy-aware decision. **[SHIP-NOW]**
2. Add a one-line value proposition + "see an example" affordance to [AuthScreen.tsx](src/features/auth/AuthScreen.tsx) (no value-prop node exists today; additive). **[SHIP-NOW]**
3. **Auth-screen masthead height — OPERATOR DECISION ITEM (do not action unilaterally).** The 296 px masthead (`PROMINENT_LOGO_HEIGHT_PX = 288`, [AppHeader.tsx:100-116](src/components/AppHeader.tsx)) is an explicit 2026-05-26 operator request that overrode UX-001.1's band heights. Surface the trade (≈41% of the auth viewport) and let the operator decide whether the sign-in screen specifically uses a smaller logo. **Operator-gated.**
4. Unify the user-facing noun ("argument"); extend [auditUserFacingTerminology.js](scripts/ux/auditUserFacingTerminology.js) to flag "conversation"/"room"/"debate" drift in user copy. **[SHIP-NOW]**
5. Rename the `moderator`→"Observer" plain-language collision ([gameCopy.ts](src/features/arguments/gameCopy.ts)). **[SHIP-NOW]**
6. **Widen the ban-list/terminology auditor to all exported `COPY` objects** (not just `PLAIN_LANGUAGE_COPY`) and audit `STATUS_COPY` comparative-standing strings `'Currently ahead'`/`'More supported'` ([gameCopy.ts:72-75](src/features/arguments/gameCopy.ts)). Confirm render usage; if rendered, reframe to structural copy. **[SHIP-NOW]** (audit) / decision (copy change).

**Test.** Puppeteer/Claude_Preview: `document.title` is the product name; value-prop text present. Unit: terminology audit passes (now including `STATUS_COPY`); ban-list clean. (Masthead height is asserted only if the operator approves change 3.)

**Doctrine.** Verdict-free, person-neutral copy. **[SHIP-NOW]** for the additive items; changes 3 and 6-copy are operator decisions.

**Boundary.** NO runtime mutation, NO provider call, NO deployment by Claude in this card (display-name/title/copy edits land via the normal client bundle; the `slug` decision is operator-gated).

---

## Sequencing summary

```
UX-MEDIATOR-001 (model)  ──▶  UX-MEDIATOR-005 (rail)  ──▶  UX-MEDIATOR-002/003/004 (markers/bridges)
UX-COPY-001 (clarity, parallel, ship-now)
UX-SIMPLIFY-002 (seat clarity, parallel, ship-now)
UX-TEST-001 (harness, enables regression guards for the above)
```

Recommended first three (see assessment §15): **UX-MEDIATOR-001 · UX-MEDIATOR-005 · UX-COPY-001** — model → surface → clarity.
