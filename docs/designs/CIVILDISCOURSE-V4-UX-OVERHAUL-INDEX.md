# CivilDiscourse v4 — UX Overhaul Slate Index

**Run code:** `CIVILDISCOURSE-V4-UX-OVERHAUL` · **Type:** DOCS + ISSUE-PLANNING run (no code, no installs, no migrations, no provider call, no Supabase write, no production change).
**Visible product name:** **CivilDiscourse** (one word). Internal repo identifiers stay `cdiscourse` until a separate operator-gated migration (design export L91; deferred — see §12 gap 12).
**Baseline read at:** `main @ cb6aca2` (read-only). Design package inspected in `.tmp/` (zip/assets NOT committed).
**Author role:** Claude Code (Agent INDEX), human-orchestrated under the CDiscourse credential contract.
**Governance:** binds to `docs/core/pipeline-governance-contract.md`. This run performs no card's IMPLEMENT stage, no deploy, no provider call, no Supabase write, no install, no routing/registry change. The cards plan future work, implemented later one at a time through the roadmap-designer → implementer → reviewer pipeline.

---

## 1. What this run did (and did not do)

- **PLANNED 20 net-new GitHub issues** for the CivilDiscourse v4 UX overhaul (the design package `CivilDiscourse v4.dc.html`): a high-trust 1:1-first debate room with a single mediator state per node, a speech-first composer seam, an Act/Inspect/Go dock, the Disagreement Points rail/sheet, evidence-blocked + definition/scope + structured-impasse surfaces, a "suggest my next move" action, clarity feedback, v4 tokens/typography/brand assets, responsive + accessibility passes, and the copy/doctrine overhaul (visible brand → CivilDiscourse, tagline swap). All 20 are **FILE**.
- **AMENDED the OPEN VOICE + Family-K + AUDIO slate** (#658–#671) with the canonical "CivilDiscourse v4 design package update" comment — the v4 design ratifies the speech-first composer + waveform + Family-K direction those cards already own. The design's own handoff table routes screens 04/05 → VOICE-007/008/009 and the Family-K row → MCP-K-001/002 (design export L922-924). The two voice-handoff folds land as amend notes on VOICE-009 #667 (and VOICE-008 #666).
- **FOLDED 2 candidate cards** into FILE cards and **1 into an AMEND:** UX-CHIMEIN-001 → UX-ROOM-1V1-CHIMEIN-001 (chime-in IS the 1:1-first room model); UX-FIRST-RUN-001 → UX-COPY-001 (first-run/sign-in copy is the same copy surface, design export L925); UX-VOICE-HANDOFF-001 → amend VOICE-009 #667 (speech artifact persistence already owns the handoff).
- **DEFERRED 1 candidate** (not filed): UX-CLARITY-RATING-001 (P2) — not a distinct package screen; its intent folds into UX-FEEDBACK-001.
- **SKIPPED none.** No v4 deliverable is fully superseded by shipped work.
- **RECONCILED against the live issue set:** the mediator stack is SHIPPED and is cross-referenced as closed predecessors (REF-001..006, merged PRs #644-648), never re-implemented. The UX-MEDIATOR-00X codes are net-new files here (no such issue exists today) and carry an AMEND-on-collision guard.
- **No code, no tests, no migrations, no Edge/Deno source, no native install, no `package.json`/`app.json` change** were written or run.
- **20 issues filed (#675–#694)** and patched into §6 (Project #1, Phase = Backlog, `epic:civildiscourse-v4`).

---

## 2. Baseline counts (read-only at run start)

- `npm run typecheck` — **0 errors** (clean).
- `npm run lint` — **0 errors** (clean).
- Full Jest on `cb6aca2` — **816 suites / 31,221 passed / 0 failed** (merged-green).
- The facts bundle header anchors `main @ c1b4fd5`; **c1b4fd5 adds only the docs-only VOICE-ADR merge on top of cb6aca2**, so the code is identical/unchanged and the cb6aca2 baseline counts hold verbatim. No v4 card is gated on any branch-artifact noise.
- No v4 UX test fixtures exist yet (chime-in seatline, 9-state precedence chip, next-move UI, feedback ratings, impasse/evidence-blocked/definition-scope screens are all net-new).

---

## 3. Design package inventory (facts §A)

**Canonical export:** `CivilDiscourse v4.dc.html` — 181,386 B, sha `afb7f2b19633a13a`, 1,029 lines (design-tool single-file HTML). Older files are history only: CDiscourse v3 (177,068 B, `0d3a470e`), Redesign v2 (97,171 B, `99d39d5d`), Redesign (94,104 B, `264a103d`). `support.js` (53,975 B) is the design-tool runtime.

**Assets (inspected in `.tmp/`, NOT committed):** `branding/civic-discourse-logo.png` (2,310,665 B, `481e06cf` — full sign-in lockup), `civildiscourse-mark.png` (226,481 B, `83539af8` — crane mark/header), `favicon.png` (1,466 B), `icon.png` (22,380 B), `lockup-horizontal.png` (128,937 B, `5d30a3b8`), `lockup-horizontal-ink.png` (103,444 B, `45cd9699`), plus a stray `.thumbnail`.

**Tweak controls (props block, design export L951-1026):**
- `brandAccent` [Warm gold / Cool active / Quiet mono], default **Warm gold** — gold is the brand/dignity EMPHASIS role (wordmark, selected-node halo, dignified state + impasse, premium borders); **NEVER the action color** (L958).
- `actionAccent` [Indigo / Violet / Steel], default **Indigo** — the functional/active-path color: Act buttons, CTAs, composer record ring, responding-to rail (L966).
- `roomEnergy` [Hushed / Calm / Lively], default **Calm** — motion temperament across waveform / selected-node glow / mic ring; Hushed ≈ near-static / reduce-motion feel (L974).
- `brandLockup` [Compact / Balanced / Editorial], default **Balanced** — logo prominence; cascades via `--logo-scale` 0.82 / 1 / 1.2 (L982, L1017).
- CSS vars: `--gold #C6A15B` / `--act-bg #312e81` / `--act-bd #6366f1` / `--act-fg #e0e7ff` (L1012-1021).

**Screens:** sign-in/first-run (01); room board · selected node (02); selected node · Act/Inspect/Go (03); speech composer · listening (04); post-response progress (05); disagreement points · bottom sheet (06); suggest my next move (07); feedback · clarity not popularity (08); structured impasse · dignified end (09); tablet 768 + desktop 1440 three-column (path · node+composer · ledger); 1:1 room model R1-R7; node-state precedence table + S1-S4; component inventory; implementation handoff table (L918-927).

**Taglines (target copy):** "A high-trust room for hard conversations." · "Mark the point. Respond clearly. See what remains unresolved." · "Mark the point, not the person." · "A mediator, not a judge. We surface the structure of a disagreement — never who's right." · hero "I can finally see what this argument is actually about." · next-move "What would move this forward? The mediator suggests an action — never a belief, winner, or truth." · impasse "You both made the case. The disagreement is preserved — not lost, and not decided."

**Doctrine-held strip (L946):** no winner/loser · no AI judge · no truth verdict · no person labels · no "fallacy" · no emotion/intent inference · no likes/heat · no red/green · waveform = amplitude only, never credibility.

---

## 4. Current repo grounding (facts §B — `main @ c1b4fd5`)

**SHIPPED — cross-reference, do NOT re-implement:**
- **Mediator stack WIRED** (`src/features/mediator/`): `deriveMediatorBoardState.ts` (pure read-only projection; board derived ONCE in `ArgumentGameSurface` L683-693 and shared by rail + node markup — reuse, never re-derive), `mediatorBoardTypes.ts` (13 `MediatorStateCode`s: open / needs_evidence / evidence_blocked / key_detail_unavailable / definition_not_shared / scope_mismatch / missing_mechanism / value_tradeoff / narrowed / off_point / accounts_differ / structured_impasse / resolved_or_settled — a SUPERSET of the v4 nine; v4 "Missing link" = `missing_mechanism`), `MediatorNodeMarker.tsx` (one primary-state badge), `DisagreementPointsRail.tsx` (collapsed → rail/sheet), `evidenceDebtDisplay.ts`, `definitionScopeBridgeDisplay.ts`, `mediatorPlainLanguage.ts`, `roomMediatorAdapter.ts`. Closed predecessors REF-001..006 (#584-589, #599); merged PRs #644-648.
- **Tokens** `src/lib/designTokens.ts` (NOT `src/designTokens.ts`): black #08060F / #13101D ✓, cream #F5EDE0 ✓, gold #C6A15B (accent) ✓, indigo family present (#4f46e5). NO verdict red/green ✓.
- **Composer seam:** `OneBox.tsx` hosted in `ArgumentComposerDock.tsx` (sheet <720 / side-panel ≥720), posts via `submit-argument`. `ArgumentSideActionRail` de-scoped (entries folded into Act).
- **Room matrix:** `argumentRoomCreationMatrix.ts` — private = 1v1 cap 2, public cap 5, one invite, observers ≠ active. NO principal-voice vs chime-in distinction yet.
- **Node markup MIXED:** `MediatorNodeMarker` (1 primary state) + `NodeLabelStrip` (1 machine + 1 user chip + overflow) BOTH mount → not yet unified to one chip.

**The 12 GAPS (net-new v4 work):** (1) speech-first composer (ZERO shipped React voice components; only VOICE docs/ADR); (2) Act/Inspect/Go 3-button dock (current is the OneBox composer); (3) node-state PRECEDENCE collapse (merge `NodeLabelStrip` + `MediatorNodeMarker` into one 9-state chip); (4) chime-in + principal-voice room model; (5) full Disagreement Points mobile SHEET (rail exists); (6) UX-NEXT-MOVE suggestion UI (`MediatorNextAction` type exists, no UI); (7) UX-FEEDBACK clarity ratings (net-new); (8) StructuredImpasse full screen (state + type exist, no screen); (9) evidence-blocked / definition-scope SCREENS (model helpers exist, no UI); (10) typography (Newsreader/Hanken/JetBrains) + #1C1730 selected-node surface + axis-dot oklch colors; (11) Family K (net-new); (12) brand internal-rename DEFERRED (`app.json` slug=`expo-scaffold`, name=`CDiscourse`).

---

## 5. Existing-issue reconciliation + FILE / AMEND / FOLD / DEFER / SKIP table (facts §D)

| Disposition | Cards | Rationale |
|---|---|---|
| **FILE (net-new, 20)** | UX-DESIGN-PACKAGE-001, UX-COPY-001 (absorbs first-run), UX-COPY-DOCTRINE-001, UX-BRAND-ASSETS-001, UX-TOKENS-001, UX-ROOM-1V1-CHIMEIN-001 (absorbs chime-in), UX-ROOM-SEATLINE-001, UX-MEDIATOR-001, UX-MEDIATOR-002, UX-MEDIATOR-003, UX-MEDIATOR-004, UX-MEDIATOR-005, UX-SELECTED-NODE-001, UX-NEXT-MOVE-001, UX-IMPASSE-001, UX-FEEDBACK-001, UX-RESPONSIVE-V4-001, UX-TEST-001, UX-ACCESSIBILITY-001, UX-OVERHAUL-SEQUENCE-001 | No open issue owns the v4 UX overhaul package. Mediator codes are net-new files (no UX-MEDIATOR-00X issue exists today) and cross-ref the shipped stack + closed REF-* — never rebuild. |
| **AMEND (OPEN — post canonical comment, NEVER duplicate)** | VOICE-ADR-001 #658, VOICE-001 #659, VOICE-002 #660, VOICE-003 #661, VOICE-004 #662, VOICE-005 #663, VOICE-006 #664, VOICE-007 #665, VOICE-008 #666, VOICE-009 #667, VOICE-010 #668, MCP-K-001 #669, MCP-K-002 #670, AUDIO-001 #671 | The v4 design package ratifies the speech-first composer + waveform + Family-K direction these cards own (handoff table L922-924). Post the single "CivilDiscourse v4 design package update" comment to each; do not refile. |
| **FOLD** | UX-CHIMEIN-001 → UX-ROOM-1V1-CHIMEIN-001; UX-FIRST-RUN-001 → UX-COPY-001; UX-VOICE-HANDOFF-001 → AMEND VOICE-009 #667 (+ VOICE-008 #666) | Chime-in IS the 1:1-first room model. First-run/sign-in copy is the same copy surface (L925). The voice handoff is already owned by the speech-artifact-persistence card. |
| **DEFER (note, not filed)** | UX-CLARITY-RATING-001 (P2) | Not a distinct package screen; fold its intent into UX-FEEDBACK-001. |
| **SKIP** | none | No v4 deliverable is fully superseded by shipped work. |

**Mediator AMEND-on-collision guard:** if any UX-MEDIATOR-00X already exists as a file/issue at filing time, AMEND it (cross-ref the merged code + closed REF-*), do not duplicate. No such issue exists today.

**Cross-ref boundaries (each card states "does not subsume"):**
- OPEN **CARD-VIEW-DATA-001 #504** — UX-SELECTED-NODE-001 and UX-NEXT-MOVE-001 render within #504's card zones; they DO NOT subsume #504's data contract. Coordinate, do not replace.
- OPEN **REF-006 #589** (human smoke) — UX-TEST-001 is the sibling automated harness; it DOES NOT fold the #589 human-smoke protocol.

**Closed predecessors to cross-ref per card:** UX-COPY-001 → COPY-001 #71, QOL-035 #204 · UX-COPY-DOCTRINE-001 → RULE-007 #145, QOL-035 #204, REF-ADR-001 #590 · UX-BRAND-ASSETS-001 → BRAND-001 #46, BRAND-003 #139, UX-001.1 #284, NAV-START-ARGUMENT-001 #524 · UX-TOKENS-001 → VG-003 #6, UX-001.7 #296 · UX-DESIGN-PACKAGE-001 → UX-001.7 #296, UX-001.1 #284 · UX-ROOM-1V1-CHIMEIN-001 → GAME-004 #141, GAME-005 #142, GAME-006 #144, BR-004 #143 · UX-ROOM-SEATLINE-001 → GAME-005 #142, ARG-ROOM-005 #616 · UX-MEDIATOR-001..005 → REF-001 #584 / REF-002 #585 / REF-003 #586 / REF-004 #587 / REF-006-RAIL #599 / REF-005 #588 / REF-ADR-001 #590 + merged PRs #644-648 · UX-SELECTED-NODE-001 → IX-004 #135, SC-002 #10, SC-004 #63, CARD-VIEW-DETAIL-HUB-001 #517 · UX-NEXT-MOVE-001 → ST-002 #13, GAL-002 #31, REF-004 #587, UX-001.4 #290 · UX-IMPASSE-001 → GAME-001 #64, GAME-007 #146 · UX-FEEDBACK-001 → MCP-008 #158 · UX-RESPONSIVE-V4-001 → UX-001.6 #294, BR-004 #143 (+ mobile-overflow #654 live context) · UX-TEST-001 → AN-002 #35, REF-006 #589 (sibling, don't fold) · UX-ACCESSIBILITY-001 → IX-003 #22, SC-005 #112 · UX-FIRST-RUN (folded) → TL-002 #2, DEMO-001 #602.

---

## 6. Issue table (20 FILE cards)

> Every `issue #` cell was patched with the filed number (#675–#694). All rows land on **Project #1**, Phase = **Backlog**, epic label **`epic:civildiscourse-v4`**. Epic single-select option is NOT added (wipe risk) — the label carries the grouping. Labels per card: `priority:p0/p1/p2`, `effort:s/m/l/xl`, `ux`, `design-only` (docs cards), `gated` (GATE-C), `area:testing` (UX-TEST / UX-ACCESSIBILITY), `area:docs`.

| code | issue # | title | priority | effort | lane | GATE-C | automerge posture | dependencies | Project phase |
|---|---|---|---|---|---|---|---|---|---|
| UX-DESIGN-PACKAGE-001 | #675 | Ingest + pin the CivilDiscourse v4 design package (canonical sha + assets + tokens map) | P0 | S | docs | No | Eligible after reviewer PASS (docs-only) | (root) | Backlog |
| UX-COPY-001 | #676 | CivilDiscourse v4 copy overhaul — tagline swap, de-score surfaces, visible brand → CivilDiscourse, first-run (absorbs UX-FIRST-RUN-001) | P0 | M | UI-copy | No (defer identity rename) | Eligible after reviewer PASS (no deploy coupling) | UX-DESIGN-PACKAGE-001 | Backlog |
| UX-COPY-DOCTRINE-001 | #677 | Doctrine-clean copy test harness (ban-list guard over visible strings) | P0 | S | copy-test | No | Eligible after reviewer PASS (test-only) | UX-COPY-001 | Backlog |
| UX-BRAND-ASSETS-001 | #678 | CivilDiscourse v4 brand assets (crane mark, lockups, favicon/icon) | P0 | M | UI-assets | Case-by-case | Case-by-case (asset bytes; case-by-case if native icon/splash) | UX-DESIGN-PACKAGE-001 | Backlog |
| UX-TOKENS-001 | #679 | v4 design tokens — typography (Newsreader/Hanken/JetBrains), #1C1730 selected surface, axis-dot oklch, action vs gold roles | P1 | S | UI-tokens | No | Eligible after reviewer PASS | UX-DESIGN-PACKAGE-001 | Backlog |
| UX-ROOM-1V1-CHIMEIN-001 | #680 | 1:1-first room model + bounded point-scoped chime-ins (absorbs UX-CHIMEIN-001) | P0 | L | UX-model | Case-by-case (YES if backend room/seat semantics change) | Not eligible if backend semantics change; else case-by-case | UX-DESIGN-PACKAGE-001 | Backlog |
| UX-ROOM-SEATLINE-001 | #681 | Principal-voice seatline + observe-only / chime-in surface (UI) | P0 | M | UI | No (if UI-only) | Eligible after reviewer PASS if UI-only | UX-ROOM-1V1-CHIMEIN-001 | Backlog |
| UX-MEDIATOR-001 | #682 | One-state-per-node derivation (single source; reuse shipped deriveMediatorBoardState) | P0 | L | pure-TS | No | Eligible after reviewer PASS (pure model) | UX-DESIGN-PACKAGE-001 | Backlog |
| UX-MEDIATOR-002 | #683 | One primary state chip · node markup (collapse NodeLabelStrip + MediatorNodeMarker) | P0 | M | UI-model | No | Eligible after reviewer PASS | UX-MEDIATOR-001 | Backlog |
| UX-MEDIATOR-003 | #684 | Evidence-blocked / debt-stack surface | P1 | M | model-UI | Case-by-case | Case-by-case | UX-MEDIATOR-002 | Backlog |
| UX-MEDIATOR-004 | #685 | Definition / scope bridge surface | P1 | M | UI-model | No | Eligible after reviewer PASS | UX-MEDIATOR-002 | Backlog |
| UX-MEDIATOR-005 | #686 | Disagreement Points rail + full mobile sheet | P0 | L | UI | No | Eligible after reviewer PASS | UX-MEDIATOR-002 | Backlog |
| UX-SELECTED-NODE-001 | #687 | Selected-node readout panel + Act/Inspect/Go dock (does not subsume #504) | P0 | M | UI | No | Eligible after reviewer PASS | UX-MEDIATOR-002 | Backlog |
| UX-NEXT-MOVE-001 | #688 | "Suggest my next move" action UI (no belief/winner/truth; does not subsume #504) | P1 | M | pure-TS-UI | No | Eligible after reviewer PASS | UX-MEDIATOR-001, UX-SELECTED-NODE-001 | Backlog |
| UX-IMPASSE-001 | #689 | Structured-impasse · dignified-end screen | P1 | M | model-UI-copy | No | Eligible after reviewer PASS | UX-MEDIATOR-002 | Backlog |
| UX-FEEDBACK-001 | #690 | Clarity feedback ratings (clarity not popularity; folds UX-CLARITY-RATING-001 intent) | P1 | M | UI-copy | No | Eligible after reviewer PASS | UX-MEDIATOR-002 | Backlog |
| UX-RESPONSIVE-V4-001 | #691 | v4 responsive — tablet 768 + desktop 1440 three-column (path · node+composer · ledger) | P0 | M | UI-responsive | No | Eligible after reviewer PASS | UX-SELECTED-NODE-001, UX-MEDIATOR-005 | Backlog |
| UX-TEST-001 | #692 | v4 UX test harness (sibling to REF-006 #589 human smoke — does not fold it) | P1 | L | test-harness | Operator-gated if auth | Eligible (testing; live/auth run operator-armed) | UX-MEDIATOR-002, UX-SELECTED-NODE-001, UX-ROOM-SEATLINE-001 | Backlog |
| UX-ACCESSIBILITY-001 | #693 | v4 accessibility pass (tap targets, screen-reader, keyboard, reduce-motion) | P1 | M | UI-test | No | Eligible after reviewer PASS | UX-MEDIATOR-002, UX-SELECTED-NODE-001 | Backlog |
| UX-OVERHAUL-SEQUENCE-001 | #694 | v4 overhaul sequencing + PM tracking card (the 7 operator decisions, order, gates) | P0 | S | docs-PM | No | Eligible after reviewer PASS (docs-only) | UX-DESIGN-PACKAGE-001 | Backlog |

---

## 7. Dependency DAG

```
UX-DESIGN-PACKAGE-001 (root, P0/S/docs)
  -> UX-OVERHAUL-SEQUENCE-001 (P0/S/docs-PM — sequencing + 7 operator decisions)
  -> UX-COPY-001 -> UX-COPY-DOCTRINE-001 (copy ban-list guard)
  -> UX-BRAND-ASSETS-001
  -> UX-TOKENS-001
  -> UX-ROOM-1V1-CHIMEIN-001 -> UX-ROOM-SEATLINE-001
  -> UX-MEDIATOR-001 (one-state derivation; reuse shipped deriveMediatorBoardState)
       -> UX-MEDIATOR-002 (one primary chip · node markup)
            -> UX-MEDIATOR-003 (evidence blocked)
            -> UX-MEDIATOR-004 (definition / scope bridge)
            -> UX-MEDIATOR-005 (Disagreement Points rail + sheet)
            -> UX-SELECTED-NODE-001 (selected-node + Act/Inspect/Go dock)
                 -> UX-NEXT-MOVE-001        (also depends on UX-MEDIATOR-001)
            -> UX-IMPASSE-001
            -> UX-FEEDBACK-001
            -> UX-ACCESSIBILITY-001        (also depends on UX-SELECTED-NODE-001)
UX-RESPONSIVE-V4-001  depends on UX-SELECTED-NODE-001 + UX-MEDIATOR-005
UX-TEST-001           depends on UX-MEDIATOR-002 + UX-SELECTED-NODE-001 + UX-ROOM-SEATLINE-001
```

**DAG rules (all satisfied):** the design package + sequencing PM card are the roots; copy/brand/tokens branch independently of the mediator UI; the one-state DERIVATION (UX-MEDIATOR-001, pure-TS, reuses the shipped stack) precedes the one-chip MARKUP (UX-MEDIATOR-002), which gates every node surface; the selected-node dock precedes next-move + responsive + accessibility + the test harness; no P0 hard-depends on a P1/P2; the 1:1-first room model precedes the seatline UI; copy precedes the copy ban-list guard. AMEND'd VOICE/MCP-K cards keep their own slate DAG (`docs/designs/VOICE-SLATE-2026-06-13-INDEX.md` + `VOICE-PATCH-001`); the v4 speech surfaces ride VOICE-007/008/009.

---

## 8. Operator decisions (the 7 open questions, design export L935-941)

1. **Room internals color:** unify on warm `#08060F` BRAND black (v3's choice) or keep the cooler `#020617` SURFACE family for the timeline? (Affects UX-TOKENS-001.)
2. **Net-new vs extension:** are UX-FEEDBACK and UX-NEXT-MOVE net-new cards or extensions of existing mediator / standing work? (This slate files both as net-new FILE cards — confirm.)
3. **One-state precedence rule:** how exactly do today's lifecycle tags + manual tags + classifier chips collapse into ONE state? Need the precedence rule (UX-MEDIATOR-001/002).
4. **Speech persistence:** transcript text only + a stored amplitude envelope for the static waveform? Confirm **no raw audio** per doctrine. (Lands on VOICE-009 #667.)
5. **Desktop ledger (col 3):** does it replace the existing side action rail or coexist with it? (Affects UX-RESPONSIVE-V4-001.)
6. **9-state vocabulary final?** (Open · Needs evidence · Definition not shared · Scope mismatch · Missing link · Narrowed · Evidence blocked · Accounts differ · Structured impasse.) The shipped `mediatorBoardTypes.ts` carries 13 codes (a superset); UX-MEDIATOR-001 maps 13 → the v4 nine.
7. **Reduce-motion:** waveform + selected-node glow must degrade to static. Confirm amplitude-only still reads as "mic active". (Affects UX-ACCESSIBILITY-001 + UX-TOKENS-001.)

These are tracked on UX-OVERHAUL-SEQUENCE-001 as the decisions that change the build.

---

## 9. Implementation order

1. **UX-DESIGN-PACKAGE-001** (pin the canonical sha + assets + tokens map — unblocks everything).
2. **UX-OVERHAUL-SEQUENCE-001** (record the 7 operator decisions, order, gates).
3. **UX-COPY-001** → **UX-COPY-DOCTRINE-001** (visible brand → CivilDiscourse, tagline swap, de-score; then the ban-list guard).
4. **UX-TOKENS-001** + **UX-BRAND-ASSETS-001** (parallel; visual foundation).
5. **UX-MEDIATOR-001** (one-state derivation, pure-TS, reuse shipped stack) → **UX-MEDIATOR-002** (one chip · node markup).
6. **UX-MEDIATOR-005** (Disagreement Points rail + sheet), **UX-SELECTED-NODE-001** (selected-node + Act/Inspect/Go), **UX-MEDIATOR-003/004**, **UX-IMPASSE-001**, **UX-FEEDBACK-001** (the node surfaces; can parallelize after UX-MEDIATOR-002).
7. **UX-ROOM-1V1-CHIMEIN-001** → **UX-ROOM-SEATLINE-001** (room model + seatline; UX-ROOM-1V1 is GATE-C if it touches backend semantics — a semantics-assessment precedes any mutation).
8. **UX-NEXT-MOVE-001** (after UX-SELECTED-NODE-001 + UX-MEDIATOR-001).
9. **UX-RESPONSIVE-V4-001** (after the dock + rail/sheet exist).
10. **UX-ACCESSIBILITY-001** + **UX-TEST-001** (verification passes; UX-TEST-001 live/auth run is operator-armed).
11. Speech surfaces ride the AMEND'd **VOICE-007/008/009** + **MCP-K-001/002** on their own slate DAG.

---

## 10. Boundary attestation

- **Acceptance-gate invariant (verbatim):** "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post." No v4 UX card moves the gate.
- **No truth adjudication:** no AI judge / truth engine / winner / loser / score / "fallacy" / "wrong" / bad-faith / honest-dishonest / emotion-intent inference / red-green verdict / person labels / likes-heat in any visible copy. **Mark the point, not the person.** The Machine-Observation vs user-Allegation boundary holds.
- **Waveform = mic-active amplitude feedback only, never credibility.** Raw audio is never stored / uploaded / replayed / sent to MCP. Text-only fallback exists at every entry window; permission denial never blocks posting.
- **Private rooms:** no observers, no chime-ins. The first open public seat is the RESPONDENT PRINCIPAL seat — **NOT a chime-in.** Seats-full = observe-only (still allows watching). Chime-ins are public-only, point-scoped, and never a third principal voice.
- **UI-first cards MUST NOT change room/seat/chime-in/submission semantics.** A semantics-assessment card precedes any backend mutation (operator-gated GATE-C). UX-ROOM-1V1-CHIMEIN-001 is GATE-C if/when it touches backend semantics; UX-ROOM-SEATLINE-001 stays UI-only (No GATE-C) unless it does.
- **Visible brand = CivilDiscourse.** Internal repo identifiers (package.json name, app.json slug/name/web.name, EXPO_PUBLIC_ prefix, domain, Supabase config/project-ref) stay `cdiscourse` and are DEFERRED to a separate operator-gated migration (gap 12).
- **No code / installs / migrations / provider call / Supabase write / GitHub mutation by Claude in this run.** Docs-only; issue filing is the orchestrator's.

---

## 11. Recommended spawn-card commands

```
.\.claude\scripts\spawn-card.ps1 UX-DESIGN-PACKAGE-001
.\.claude\scripts\spawn-card.ps1 UX-COPY-001
.\.claude\scripts\spawn-card.ps1 UX-MEDIATOR-001
.\.claude\scripts\spawn-card.ps1 UX-ROOM-1V1-CHIMEIN-001
.\.claude\scripts\spawn-card.ps1 UX-TEST-001
```

(Spawn **UX-DESIGN-PACKAGE-001** first — it pins the canonical design sha + assets + token map and unblocks every other card. **UX-COPY-001** is the highest-value, lowest-coupling user-visible win (tagline swap + de-score + visible brand → CivilDiscourse, no deploy coupling). **UX-MEDIATOR-001** is the pure-TS one-state derivation that gates the entire node-surface chain and reuses the shipped `deriveMediatorBoardState`. **UX-ROOM-1V1-CHIMEIN-001** is the largest model card (1:1-first + chime-ins; assess backend semantics before any mutation). **UX-TEST-001** is the verification harness, sibling to REF-006 #589 — run its live/auth lane operator-armed.)
