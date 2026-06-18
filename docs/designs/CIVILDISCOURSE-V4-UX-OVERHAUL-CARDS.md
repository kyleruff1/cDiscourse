# CivilDiscourse v4 UX Overhaul — Card Archive

This is the full issue-body archive for the CIVILDISCOURSE-V4-UX-OVERHAUL slate (slate §12.4). It contains the verbatim body of every FILE card filed for the v4 overhaul plus the AMEND register for the OPEN VOICE / MCP-K / AUDIO issues. The orchestrator files each FILE card from its per-card scratch body under `.tmp/issue-bodies/<CODE>.md`; this archive is the committed, reviewable record.

- Visible product name: **CivilDiscourse** (one word). Internal repo identifiers stay `cdiscourse` until a separate operator-gated migration.
- Design source: the CivilDiscourse v4 design package (`CivilDiscourse v4.dc.html`) was inspected in `.tmp/`; the zip/assets were **not** committed. Asset integration happens only in implementation cards.
- Companion docs: `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` (index), `docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md` (inventory), `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md` (roadmap + DAG + operator questions).

## Doctrine held (every card restates the relevant subset)

No AI judge · no truth engine/verdict · no winner · no loser · no score · no "fallacy" · no "wrong" · no bad-faith · no honest/dishonest framing · no emotion/intent inference · no red/green verdict · no person labels · no likes/heat/popularity in visible copy. Waveform = mic-active amplitude feedback, never credibility. Raw audio is never stored/uploaded/replayed/sent to MCP; text fallback exists at every entry window; permission-denial never blocks posting. "Mark the point, not the person." Machine-Observation vs user-Allegation boundary preserved. UI-first cards must NOT change room/seat/chime-in/submission semantics; a semantics-assessment card precedes any backend mutation (operator-gated GATE-C). Acceptance-gate invariant: **"AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."**

## FILE card register (20)

| Code | Title | Pri | Effort | Lane | GATE-C |
|---|---|---|---|---|---|
| UX-DESIGN-PACKAGE-001 | Ingest the v4 design package: INDEX + inventory | P0 | S | docs | No |
| UX-COPY-001 | v4 copy system + first-run (folds UX-FIRST-RUN-001) | P0 | M | UI-copy | No (identity deferred) |
| UX-COPY-DOCTRINE-001 | Doctrine ban-list lint over visible copy | P0 | S | copy-test | No |
| UX-BRAND-ASSETS-001 | v4 brand lockup at four scales | P0 | M | UI-assets | Case-by-case |
| UX-TOKENS-001 | v4 token additions (type, #1C1730, axis oklch) | P1 | S | UI-tokens | No |
| UX-ROOM-1V1-CHIMEIN-001 | 1:1-first room model + chime-in (folds UX-CHIMEIN-001) | P0 | L | UX-model | Case-by-case (Yes if backend semantics) |
| UX-ROOM-SEATLINE-001 | Room header seat line / voices bar | P0 | M | UI | No-if-UI-only |
| UX-MEDIATOR-001 | 9-state precedence in the pure derivation | P0 | L | pure-TS | No |
| UX-MEDIATOR-002 | One primary state chip + selected-node anatomy | P0 | M | UI-model | No |
| UX-MEDIATOR-003 | Evidence blocked / evidence-debt UI | P1 | M | model-UI | Case-by-case |
| UX-MEDIATOR-004 | Definition not shared / scope-mismatch bridge UI | P1 | M | UI-model | No |
| UX-MEDIATOR-005 | Disagreement Points sheet + vocabulary | P0 | L | UI | No |
| UX-SELECTED-NODE-001 | Inspect drawer + responding-to anchor | P0 | M | UI | No |
| UX-NEXT-MOVE-001 | "Suggest my next move" deterministic actions | P1 | M | pure-TS-UI | No |
| UX-IMPASSE-001 | Structured Impasse dignified-end screen | P1 | M | model-UI-copy | No |
| UX-FEEDBACK-001 | Clarity feedback (not popularity) | P1 | M | UI-copy | No |
| UX-RESPONSIVE-V4-001 | 390 / 768 / 1440 three-tier layout | P0 | M | UI-responsive | No |
| UX-TEST-001 | v4 UX test harness | P1 | L | test-harness | Operator-gated-if-auth |
| UX-ACCESSIBILITY-001 | a11y + reduce-motion across v4 surfaces | P1 | M | UI-test | No |
| UX-OVERHAUL-SEQUENCE-001 | Sequencing / DAG / operator-question PM card | P0 | S | docs-PM | No |

**Folds:** UX-CHIMEIN-001 → UX-ROOM-1V1-CHIMEIN-001 · UX-FIRST-RUN-001 → UX-COPY-001 · UX-VOICE-HANDOFF-001 → AMEND VOICE-009 (#667).
**Deferred (not filed):** UX-CLARITY-RATING-001 (P2; intent folded into UX-FEEDBACK-001's non-goals). Also deferred: the brand internal-rename migration; Family K.
**Cross-ref boundaries:** does not subsume CARD-VIEW-DATA-001 #504 (vs UX-SELECTED-NODE-001 / UX-NEXT-MOVE-001); does not fold REF-006 #589 human smoke (sibling to UX-TEST-001).

---

# FILE card bodies (verbatim)

---

## UX-DESIGN-PACKAGE-001 — Ingest the v4 design package: INDEX + inventory

## Goal

Land the CivilDiscourse v4 design package as the single canonical reference for the overhaul: an indexed, doctrine-checked inventory of every screen, token, and copy string in `CivilDiscourse v4.dc.html`, so every downstream UX card cites one stable source instead of re-reading the raw design-tool export.

## Problem

The v4 design export is a 1,029-line single-file design-tool HTML (`CivilDiscourse v4.dc.html`, 181,386 B). It is not committable as-is, it carries design-tool runtime (`support.js`), and its assets are large binaries. Without a committed index + inventory, every implementation card would have to re-derive screen numbers, token values, and copy from the raw file, and the doctrine review (no winner/loser, no AI judge, no score, waveform = amplitude only) would be re-litigated per card. We need one authored docs artifact that pins the package contents and the doctrine pass once.

## Design export references

- Header / converged direction (`CivilDiscourse v4.dc.html` L28-31): "brand + logo integration", the three pillars (Premium Mediator Board · Speech-first loop · Disagreement Ledger), and "Never a judge, scoreboard, or feed."
- Accent system + surfaces + type panel (L37-58): gold = brand/dignity ("Never the interface."), indigo = action/active path, axis dots equal-weight muted ("Never red/green verdict."), surfaces `#08060F / #13101D / #1C1730 / #F5EDE0`, type Newsreader / Hanken Grotesk / JetBrains Mono.
- Mobile flow screens 01-09 (L102-395) and the per-screen "maps →" handoff footers.
- 1:1 room model R1-R7 (L511-696).
- Node-state precedence table, 9 states + S1-S4 (L700-835).
- Component inventory, 14 named parts (L889-909).
- Implementation handoff + open-questions tables (L911-940-plus).
- Doctrine-held strip (L946).

## Current repo grounding

- The mediator stack is already shipped under `src/features/mediator/` (`deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts`, `MediatorNodeMarker.tsx`, `DisagreementPointsRail.tsx`, etc.); board derived once in `ArgumentGameSurface` (facts §B).
- Design tokens live at `src/lib/designTokens.ts` (NOT `src/designTokens.ts`): black `#08060F`/`#13101D`, cream `#F5EDE0`, gold `#C6A15B`, indigo family present; no verdict red/green (facts §B).
- This card **extends** the prior package-inventory discipline established by UX-001.7 #296 and UX-001.1 #284 — it does not re-implement those; it produces the v4-specific index + inventory docs.

## Scope

- Author `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` — the canonical index that names every screen (01-09, R1-R7, S1-S4, tablet/desktop), maps each to its FILE card, and links the inventory + roadmap.
- Author `docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md` — the file/asset inventory (canonical HTML + history versions + assets with sizes/hashes), the tweak-control matrix, the 9-state vocabulary, and the doctrine-held checklist pass.
- Confirm and record the package-source disclaimer: the export was inspected in `.tmp/`; the zip/assets were not committed.

## Non-goals

- No asset integration, no token edits, no component changes — those happen only in the implementation cards (UX-BRAND-ASSETS-001, UX-TOKENS-001, the mediator/screen cards).
- Does not commit the raw `.dc.html`, `support.js`, or the large branding binaries.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md` exists, lists all screens with their FILE-card mapping and the "maps →" footer for each, and links the inventory + roadmap.
- `docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md` exists with the file inventory (names + byte sizes + hashes from facts §A), tweak-control defaults, the 9-state vocabulary, and a doctrine-held pass that names each banned construct and confirms absence.
- Every other FILE card can cite these two docs plus the roadmap in its footer.
- No banned strings introduced; visible brand reads CivilDiscourse.

## Test plan

- Docs-only: a markdown-lint / link-check pass (relative links resolve to the roadmap, the INDEX, and the inventory).
- A grep over the two new docs confirms zero banned tokens outside explicit ban-list context (winner/loser, AI judge, truth verdict, score, fallacy, red/green, "stored audio").
- Manual review: each of screens 01-09, R1-R7, S1-S4 appears exactly once in the INDEX with a card mapping.

## Doctrine compliance

- No AI judge / truth engine / winner / loser / score / fallacy / red-green verdict / person labels / likes/heat in any visible copy reproduced into the docs.
- Waveform documented strictly as mic-active amplitude feedback, never credibility.
- Raw audio: the inventory records the doctrine that no raw audio is stored/uploaded/replayed/sent to MCP (operator open question 04).
- Acceptance-gate invariant restated in the inventory: "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate."

## Dependencies

- Root of the v4 DAG; blocks/feeds every other UX-* card (they cite the INDEX + inventory).
- Extends #296 (UX-001.7), #284 (UX-001.1).

## GATE-C classification

No (docs-only; no deploy coupling, no migration, no provider call).

## Automerge posture

Eligible for automerge once green (docs-only, no GATE-C).

## Project labels/fields

priority:p0 · effort:s · lane:docs · epic:civildiscourse-v4 · ux · design-only · area:docs. Project #1: Phase=Backlog, Priority=P0, Effort=S, Area=Docs.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO code edit (docs-only). UI-first boundary not applicable (no UI); room/seat/chime-in/submission semantics untouched.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-COPY-001 — v4 copy system + first-run (folds UX-FIRST-RUN-001)

## Goal

Adopt the v4 copy system across the visible product: replace the forbidden tagline, collapse visible brand to CivilDiscourse, de-score the surfaces that currently say "score" / "ahead" / "more supported", soften concession/honest copy, and add the v4 net-new phrases ("Mark the point, not the person.", "What remains unresolved", "What would move this forward"). This card also **absorbs the first-run / sign-in copy** (folded UX-FIRST-RUN-001).

## Problem

The shipped copy contradicts the doctrine and the v4 design. The biggest violation is the tagline "Just get to the bottom of it" (`src/lib/designTokens.ts:204` → `AppHeaderTagline.tsx:78`, `AppHeader.tsx:242`, `AboutScreen.tsx:26`). Visible brand is split (CivilDiscourse in some places, legacy CDiscourse in others). "score" / "Currently ahead" / "More supported" imply a scoreboard; "I'm only MOSTLY wrong" and "an honest move" smuggle in verdict/person framing. The v4 design replaces all of this with mediator language.

## Design export references

- Hero + dignity pill (`CivilDiscourse v4.dc.html` L29-31): "I can finally see what this argument is actually about." and the italic pill "Mark the point, not the person."
- Sign-in / first-run screen 01 (L108-119): "A high-trust room for hard conversations.", "Mark the point. Respond clearly. See what remains unresolved.", the 1:1 explainer pill, and the footer "A mediator, not a judge. We surface the structure of a disagreement — never who's right."
- Brand-lockup handoff footer (L91): logo/masthead/header treatment maps → UX-COPY-001; "internal repo identifiers stay cdiscourse until a separate operator-gated migration."
- Implementation handoff row (L925): "First-run clarity / sign-in copy → UX-COPY-001."

## Current repo grounding

- Tagline at `src/lib/designTokens.ts:204` (`BRAND.taglineText`), consumed by `AppHeaderTagline.tsx:78`, `AppHeader.tsx:242`, `AboutScreen.tsx:26` (facts §C).
- Visible brand already CivilDiscourse in `AppHeader.tsx:227` / About / auth-callback; legacy CDiscourse still in `corridorModel.ts:111/159`, `inviteCopy.ts:64/66`, `InviteRedeemGate`/`InviteCredentialStep`, `DevEnvironmentBanner:46/51`, `gameCopy.ts:1599/1607` (facts §C).
- De-score targets: `ArgumentScoreTracker.tsx:33/39`, `ComposerValidationPanel.tsx:150-151`, `gameCopy` STATUS "Currently ahead"/"More supported" :75-76. Soften: `CONCESSION_COPY` gameCopy.ts:63, "an honest move" gameCopy.ts:299.
- This card **extends** COPY-001 #71 and QOL-035 #204 (it does not re-implement those copy passes); it applies the v4 string set on top.

## Scope

- Swap the tagline at `designTokens.ts:204` to "Mark the point, not the person." (or the operator-approved v4 line) and verify the three consumers update.
- First-run / sign-in copy (folded): apply the screen-01 strings (high-trust room, mark/respond/see-what-remains, the mediator-not-a-judge footer, the 1:1 visibility explainer).
- Collapse remaining visible CDiscourse → CivilDiscourse in the user-facing strings listed above.
- De-score: remove "score"/"ahead"/"more supported" visible copy; replace with mediator/standing-neutral language.
- Soften concession + "honest move" copy to mediator phrasing.
- Add the net-new phrases as reusable copy constants.

## Non-goals

- MUST DEFER (identity migration, not this card): `package.json` name, `app.json` slug/name/web.name, the `EXPO_PUBLIC_` prefix, the domain, Supabase config/project-ref. This card does not touch any of those.
- Does not change room/seat/chime-in/submission semantics.
- Does not implement the doctrine ban-list lint — that is UX-COPY-DOCTRINE-001.
- Does not subsume #504 (CARD-VIEW-DATA-001).

## Acceptance criteria

- `BRAND.taglineText` no longer reads "Just get to the bottom of it"; the three consumers render the new line; no test still pins the old string.
- First-run / sign-in surface renders the screen-01 copy set.
- No visible user-facing string reads "score", "Currently ahead", "More supported", "I'm only MOSTLY wrong", or "an honest move".
- Visible brand reads CivilDiscourse in the previously-legacy surfaces; no deferred-identity field changed.
- Net-new phrases exist as constants and are referenced where the design places them.

## Test plan

- Update/extend snapshot + unit tests for the tagline, first-run copy, and de-scored surfaces (test-discipline: tests are part of done).
- A targeted test asserts the old tagline and the score/honest/wrong strings are absent from the rendered copy constants.
- Typecheck + lint clean; full suite green.

## Doctrine compliance

- No score / winner / loser / "wrong" / "honest-dishonest" / person labels in visible copy.
- "Mark the point, not the person." and "A mediator, not a judge … never who's right." are the framing.
- Brand-identity deferral honored: no `EXPO_PUBLIC_` / app.json / package.json / domain / project-ref change (the operator-gated migration is separate).

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001 (cites the INDEX + inventory).
- Pairs with UX-COPY-DOCTRINE-001 (the lint that guards these strings) and UX-BRAND-ASSETS-001 (the lockup).
- Absorbs UX-FIRST-RUN-001 (folded) — extends TL-002 #2 and DEMO-001 #602.
- Extends COPY-001 #71, QOL-035 #204.

## GATE-C classification

No (UI-copy; identity migration explicitly deferred, so no deploy coupling).

## Automerge posture

Eligible for automerge once green (no GATE-C), provided the deferred-identity non-goals are verified untouched.

## Project labels/fields

priority:p0 · effort:m · lane:UI-copy · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO identity-field change (package.json / app.json / EXPO_PUBLIC_ / domain / project-ref deferred). UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-COPY-DOCTRINE-001 — Doctrine ban-list lint over visible copy

## Goal

Encode the v4 doctrine-held copy strip as an automated, test-enforced ban-list so the forbidden constructs (winner/loser, AI judge, truth verdict, person labels, "fallacy", emotion/intent inference, likes/heat, red/green, "score", "wrong", "honest-dishonest", waveform-as-credibility, "stored audio") can never silently re-enter visible copy.

## Problem

UX-COPY-001 fixes today's violations, but without a guard the next copy change can re-introduce them. The v4 design publishes an explicit "doctrine held" strip; we need that strip as a machine-checkable contract over the visible-copy surface (copy constants + rendered strings), distinct from ban-lists that legitimately live in comments and classifier code.

## Design export references

- Doctrine-held strip (`CivilDiscourse v4.dc.html` L946): no winner/loser · no AI judge · no truth verdict · no person labels · no "fallacy" · no emotion/intent inference · no likes/heat · no red/green · waveform = amplitude only, never credibility.
- Accent system (L42): "Never red/green verdict."
- Next-move screen 07 (L325): "The mediator suggests an action — never a belief, winner, or truth."
- Sign-in footer (L119): "A mediator, not a judge … never who's right."

## Current repo grounding

- Allowed phrases exist verbatim in `mediatorPlainLanguage.ts` ("Needs evidence", "Scope mismatch", "Structured impasse"); "Definition needed" → renamed "Definition not shared" at `mediatorPlainLanguage.ts:23` (facts §C).
- Known live violations the lint must catch on a baseline run: the tagline (`designTokens.ts:204`), "score" surfaces, "I'm only MOSTLY wrong" (`gameCopy.ts:63`), "an honest move" (`gameCopy.ts:299`) — these are fixed by UX-COPY-001; the lint then keeps them out.
- This card **extends** RULE-007 #145 (rules doctrine), QOL-035 #204 (copy QOL), and REF-ADR-001 #590 (mediator ADR) — it does not re-implement those; it adds the copy-surface guard.

## Scope

- Add a doctrine ban-list test/lint over the visible-copy surface (copy constants + the screens' rendered strings), with an allow-list carve-out for ban-list declarations, classifier code, and comments.
- Codify the allowed mediator vocabulary (the 9 state labels + move verbs) as the positive contract.
- Wire it into the existing test suite so CI fails on a banned visible string.

## Non-goals

- Does not author or change the copy itself (that is UX-COPY-001).
- Does not lint internal code identifiers, comments, or classifier ban-lists.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- A test fails when a banned construct appears in a visible-copy constant or rendered string, and passes on the post-UX-COPY-001 tree.
- The allowed mediator vocabulary is asserted present (the 9-state labels exactly as the design names them).
- The carve-out demonstrably permits ban-list/comment/classifier occurrences (no false positive on existing legitimate uses).

## Test plan

- The card is itself a test/lint card: the deliverable is the guard plus its self-tests (a fixture of banned strings fails; a fixture of allowed mediator strings passes).
- Run the guard against the current tree to confirm it flags the known violations before UX-COPY-001, and is green after.
- Typecheck + lint clean.

## Doctrine compliance

- This card operationalizes the full doctrine-held strip; it restates and enforces: no AI judge / truth engine / winner / loser / score / fallacy / wrong / bad-faith / honest-dishonest / emotion-intent inference / red-green verdict / person labels / likes-heat in visible copy; waveform = amplitude only; no "stored audio" phrasing.

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001.
- Tightly paired with UX-COPY-001 (the lint should be green only after the copy fixes land; sequence the lint to merge after, or land in the same wave).
- Extends RULE-007 #145, QOL-035 #204, REF-ADR-001 #590.

## GATE-C classification

No (copy-test; no deploy, no migration, no provider call).

## Automerge posture

Eligible for automerge once green, but only after UX-COPY-001 is on the branch (otherwise the lint legitimately fails).

## Project labels/fields

priority:p0 · effort:s · lane:copy-test · epic:civildiscourse-v4 · ux · area:testing. Project #1: Phase=Backlog, Priority=P0, Effort=S, Area=Testing.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-BRAND-ASSETS-001 — v4 brand lockup at four scales

## Goal

Integrate the v4 CivilDiscourse brand lockup — cream line-art crane + gold sunrise wordmark — at the four scales the design specifies (sign-in full lockup, app-header lockup, icon/favicon, minimum mobile-safe), aspect-ratio preserved and no recolor.

## Problem

The shipped app header reads CivilDiscourse but does not yet use the v4 crane mark / wordmark lockup, and the sign-in surface lacks the full sign-in lockup. The design ships the real assets in `assets/branding/`; we need them wired at the right scales with the masthead overflow fix already learned in production (the masthead logo width caused a universal 390px overflow).

## Design export references

- Brand-lockup section (`CivilDiscourse v4.dc.html` L75-91): "the repo mark · cream line-art crane, gold sunrise"; four scales — Sign-in lockup (`assets/branding/civic-discourse-logo.png`, "the name is part of the mark"), App-header lockup (`assets/civildiscourse-mark.png` + Newsreader wordmark), Icon/favicon, Minimum mobile-safe.
- Handoff footer (L91): "logo / masthead / header treatment · UX-COPY-001 · aspect ratio preserved, no recolor · internal repo identifiers stay cdiscourse until a separate operator-gated migration."
- Sign-in screen 01 (L109): full lockup at `--logo-scale` (Compact/Balanced/Editorial → 0.82/1/1.2).
- Tablet/desktop headers (L415, L453): the compact mark + Newsreader "CivilDiscourse" wordmark.
- Asset inventory (facts §A): `civic-discourse-logo.png` 2,310,665 B (full sign-in lockup), `civildiscourse-mark.png` 226,481 B (crane mark/header), `favicon.png`, `icon.png`, `lockup-horizontal.png`, `lockup-horizontal-ink.png`.

## Current repo grounding

- `AppHeader.tsx:227` already renders the CivilDiscourse name; the masthead logo width fix `resolveMastheadLogoHeightPx` shipped in #654 (mobile-overflow context, facts memory) — the prominent lockup is kept on tablet/wide but must not regress 390px.
- `useHeaderBreakpoint` / `resolveBand` and `TOUCH_TARGET(44)` already exist and should be reused (facts memory).
- This card **extends** BRAND-001 #46, BRAND-003 #139, UX-001.1 #284, and NAV-START-ARGUMENT-001 #524 — it does not re-implement the header shell; it swaps in the v4 lockup assets at the defined scales.

## Scope

- Add the v4 brand assets to the repo asset tree and wire them at the four scales (sign-in full, app-header, icon/favicon, minimum mobile-safe).
- Preserve aspect ratio; no recolor; honor `--logo-scale` band mapping (0.82 / 1 / 1.2) via the existing breakpoint helpers.
- Verify no 390px masthead overflow regression (reuse `resolveMastheadLogoHeightPx`).
- Provide the `alt`/accessibility text ("CivilDiscourse").

## Non-goals

- Does not rename internal repo identifiers, app.json slug/name, or the domain — those stay `cdiscourse` until a separate operator-gated migration (deferred).
- Does not change the header layout system or breakpoints (reuse only).
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- Sign-in/first-run shows the full lockup; app header (mobile/tablet/desktop) shows the crane mark + Newsreader wordmark; icon/favicon use the mark.
- Aspect ratio preserved, no recolor at any scale.
- No 390px overflow regression; tablet/wide keep the prominent lockup.
- `alt` text reads "CivilDiscourse"; touch targets ≥ 44.

## Test plan

- Snapshot/layout tests at the breakpoint bands (390 / 768 / 1440) assert the correct lockup variant and no overflow.
- Asset-presence test (files referenced exist; sizes sane).
- Accessibility: `alt`/label assertions; reduce-motion not affected (static assets).
- Typecheck + lint clean.

## Doctrine compliance

- Brand-only; carries no verdict or scoreboard semantics. Gold = brand/dignity accent, never the interface action color (accent system L40-42).
- Identity-migration deferral honored: internal identifiers stay `cdiscourse`.

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001; pairs with UX-COPY-001 (shared masthead/header treatment) and UX-TOKENS-001 (typography/colors the lockup sits on).
- Extends BRAND-001 #46, BRAND-003 #139, UX-001.1 #284, NAV-START-ARGUMENT-001 #524.

## GATE-C classification

Case-by-case: No if assets are bundled client-side only (no deploy-coupled config). If favicon/icon changes touch app.json or web manifest entries that are deploy-bearing, treat the deploy-bearing slice as GATE-C and operator-gate it; the bundled lockup swaps are non-GATE-C.

## Automerge posture

The bundled-asset slice is automerge-eligible once green. Any deploy-bearing manifest slice is operator-gated (no automerge).

## Project labels/fields

priority:p0 · effort:m · lane:UI-assets · epic:civildiscourse-v4 · ux · gated (for any deploy-bearing manifest slice). Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO identity-rename (internal `cdiscourse` deferred) · any deploy-bearing manifest change is operator-gated, not performed by Claude. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-TOKENS-001 — v4 token additions

## Goal

Extend `src/lib/designTokens.ts` with the v4 token additions the design depends on: the typography stack (Newsreader / Hanken Grotesk / JetBrains Mono with their roles), the `#1C1730` selected-node surface, and the equal-weight muted axis-dot oklch colors — without disturbing the test-pinned token values already shipped.

## Problem

The shipped tokens have black/cream/gold and an indigo family, but the v4 system needs three additions the current set lacks: the named typography roles, the selected-node surface `#1C1730` (a third dark surface above `#08060F`/`#13101D`), and the axis-dot palette in oklch (fact/definition/scope/causal/value/logic) that must read as equal-weight and never as red/green verdict. Without these, the mediator and screen cards have nowhere to source their colors/type.

## Design export references

- Surfaces & type panel (`CivilDiscourse v4.dc.html` L46-58): surfaces `#08060F / #13101D / #1C1730 / #F5EDE0`; Newsreader ("brand · impasse · mediator voice"), Hanken Grotesk ("body & interface"), JetBrains Mono ("small structural metadata only").
- Accent system axis dots (L42): "Fact · definition · scope · causal · value · logic. Never red/green verdict." with `oklch(.72 .06 235/305/160 …)` examples.
- 9-state chip colors (L64-70 and the precedence table L713-729): each state's dot uses a muted oklch hue; gold reserved for brand/the one key state.
- `--act-*` action vars and `--gold` (L17): `--gold #C6A15B`, `--act-bg #312e81`, `--act-bd #6366f1`, `--act-fg #e0e7ff`.

## Current repo grounding

- Tokens live at `src/lib/designTokens.ts` (NOT `src/designTokens.ts`): black `#08060F`/`#13101D` present, cream `#F5EDE0` present, gold `#C6A15B` present, indigo `#4f46e5` family present; no verdict red/green present (facts §B).
- TYPOGRAPHY tokens are test-pinned — "don't mass-bump" (facts memory, mobile-overflow note). Additions must be additive, not a re-pin.
- This card **extends** VG-003 #6 (visual grammar tokens) and UX-001.7 #296 (token/package) — it does not re-implement the token module; it adds the v4-specific entries.

## Scope

- Add the typography role tokens (font families + their assigned roles) for Newsreader / Hanken Grotesk / JetBrains Mono.
- Add the `#1C1730` selected-node surface token.
- Add the axis-dot oklch color tokens (six axes), equal-weight, with documentation that they are not verdict colors.
- Keep existing test-pinned values byte-stable; additions only.

## Non-goals

- Does not mass-bump or re-pin existing typography tokens.
- Does not apply the tokens to components — consumption happens in the mediator/screen/responsive cards.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- `designTokens.ts` exports the three font roles, the `#1C1730` surface, and the six axis oklch colors.
- Existing pinned token tests still pass unchanged (no value drift).
- A test asserts the axis colors contain no red/green verdict pair and are documented as equal-weight.

## Test plan

- Add unit tests for the new token presence + values; confirm the pre-existing TYPOGRAPHY pin tests remain green (no edit to their expected values).
- Color-independence assertion: axis dots are distinguishable by label, not color alone (handoff to UX-ACCESSIBILITY-001).
- Typecheck + lint clean.

## Doctrine compliance

- Axis dots equal-weight, muted; "Never red/green verdict." Gold reserved for brand/dignity/the one key state, never the interface action color.
- No token encodes truth/score/winner semantics.

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001; feeds every mediator/screen/responsive card (they consume these tokens).
- Extends VG-003 #6, UX-001.7 #296.

## GATE-C classification

No (UI-tokens; pure additive constants, no deploy/migration/provider).

## Automerge posture

Eligible for automerge once green (additive, pinned tests preserved).

## Project labels/fields

priority:p1 · effort:s · lane:UI-tokens · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P1, Effort=S, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-ROOM-1V1-CHIMEIN-001 — 1:1-first room model + chime-in (folds UX-CHIMEIN-001)

## Goal

Establish the v4 1:1-first room model in the product's UX vocabulary: every room is a 1:1 between two principal voices, with bounded point-scoped chime-ins (public-only) and observers. This card **absorbs the chime-in work** (folded UX-CHIMEIN-001) and defines the principal-voice / respondent-seat / chime-in / observer distinctions the design's R1-R7 sequence requires.

## Problem

The shipped room matrix has private = 1v1 (cap 2), public (cap 5), one invite, observers ≠ active — but it has **no principal-voice vs chime-in distinction**. The v4 design is built on that distinction: the first open public seat is the respondent **principal** seat (not a chime-in); chime-ins are bounded, point-scoped, public-only, and never a third principal voice; private 1:1 has no observers and no chime-ins. Without this model the room header, seat line, and chime-in composer have no coherent rules.

## Design export references

- 1:1 room model R1-R7 (`CivilDiscourse v4.dc.html` L511-696):
  - R1 create/visibility (L518-528): Private 1:1 = "Invite one person. No observers, no chime-ins"; Public 1:1 = "Visible to observers. Once both seats are filled, chime-ins may be allowed."
  - R2 open respondent seat (L554): "The respondent seat is open … Reply to take it and become the second principal voice. This is a 1:1 — not an open thread." → "Take the respondent seat".
  - R3 two principals (L578-580): the bounded "Chime in on this point · 3 seats open" affordance.
  - R4 one chime-in (L604-608): "Chime-ins attach to a point. The two principal voices stay primary."
  - R5 seats full (L630-632): "Chime-in seats full … You can keep watching. The point ledger stays open to read." → observe-only.
  - R6 private no-chime guard (L656): "Invited 1:1. No observers, no chime-ins — the point stays between you and Maya."
  - R7 chime-in composer (L677-689): point-scoped, "Bounded contribution — attaches to this point, doesn't open a seat."
- Role-vs-state note (L849, L855): chime-in is a role + attached treatment, "never itself the state."

## Current repo grounding

- `argumentRoomCreationMatrix.ts`: private = 1v1 cap 2, public cap 5, one invite, observers ≠ active; **no principal-voice vs chime-in distinction** (facts §B, GAP 4).
- "moderator" SIDE = the room host/creator (active cap-counted seat), relabeled "Host" by UX-SIMPLIFY-002A — orthogonal to the platform app-role (facts memory). The principal-voice model must not collide with the host seat.
- This card **extends** GAME-004 #141, GAME-005 #142, GAME-006 #144, BR-004 #143 — it does not re-implement the room matrix; it adds the principal-voice / chime-in model on top.

## Scope

- Define the UX model + types for: principal voice (two per room), respondent-seat-open state, chime-in (bounded, point-scoped, public-only, capped), observer/observe-only, private-no-chime guard.
- Specify the R1-R7 state transitions as a pure model (seat-open → take seat → two principals → chime-in used → seats full → observe-only).
- Specify the copy/affordances for each state (taking the seat, chiming in, seats-full observe-only, private guard).
- **Semantics-assessment first:** if the model requires backend seat/role changes, produce the semantics-assessment as the leading slice and gate the mutation separately (operator-gated GATE-C). The UI-model slice ships first.

## Non-goals

- A first open public seat is **not** a chime-in (it is the respondent principal seat) — do not model it as one.
- Chime-ins are never a third principal voice and never the node's structural state.
- This card does not, by itself, mutate room/seat/submission backend semantics; any such mutation is a separate operator-gated slice preceded by the semantics-assessment.
- Does not change the deterministic submission acceptance gate.

## Acceptance criteria

- A pure model expresses the R1-R7 states and transitions with tests for each.
- Private 1:1 yields no observers and no chime-in affordance; public 1:1 yields observers and (post-both-seats) capped chime-ins.
- The respondent-seat-open state is modeled as a principal seat, distinct from chime-in.
- Seats-full yields observe-only with the ledger still readable.
- If backend semantics are required, the card delivers a semantics-assessment doc and the mutation is split out + GATE-C gated.

## Test plan

- Pure-model unit tests for every R1-R7 transition and the two guards (private-no-chime, seats-full-observe-only).
- A test asserts "first open public seat" resolves to respondent-principal, not chime-in.
- A test asserts chime-in never sets node structural state and never increments principal count.
- Typecheck + lint clean; full suite green.

## Doctrine compliance

- UI-first card: must not change room/seat/chime-in/submission semantics; a semantics-assessment card precedes any backend mutation (operator-gated GATE-C).
- Acceptance-gate invariant restated: "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate."
- No first-open-public-seat-is-a-chime-in; no chime-in in private rooms.

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001 and UX-COPY-001 (seat-line copy).
- Feeds UX-ROOM-SEATLINE-001 (the header seat line renders this model).
- Extends GAME-004 #141, GAME-005 #142, GAME-006 #144, BR-004 #143.

## GATE-C classification

Case-by-case: No for the UI-model slice; **Yes** for any slice that mutates room/seat/role backend semantics (operator-gated, preceded by the semantics-assessment).

## Automerge posture

UI-model slice automerge-eligible once green. Any backend-semantics slice is operator-gated (no automerge).

## Project labels/fields

priority:p0 · effort:l · lane:UX-model · epic:civildiscourse-v4 · ux · gated (for the backend-semantics slice). Project #1: Phase=Backlog, Priority=P0, Effort=L, Area=UX.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration in the UI-model slice · NO change to the deterministic submission gate. Any room/seat/role backend mutation is a separate operator-gated slice preceded by a semantics-assessment.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-ROOM-SEATLINE-001 — Room header seat line / voices bar

## Goal

Render the v4 room header "seat line" / voices bar: the visibility badge (PUBLIC 1:1 / PRIVATE 1:1), the two-principal voices bar (Maya vs Dan, or "seat open"), the watching count, and the seats-full / observe-only status — a read-only header projection of the UX-ROOM-1V1-CHIMEIN-001 model.

## Problem

The current room header has no seat line that shows who the two principal voices are, whether the respondent seat is open, how many are watching, or whether chime-in seats are full. The v4 design puts this line at the top of every R-screen and on tablet/desktop. It is the at-a-glance "this is a 1:1, not a thread" signal.

## Design export references

- R2 seat line (`CivilDiscourse v4.dc.html` L544, L547): "PUBLIC 1:1 · RESPONDENT SEAT OPEN · OBSERVERS WATCHING"; voices bar with Maya + dashed "seat open" + "9 watching".
- R3 (L571, L574): "PUBLIC 1:1 · 2 PRINCIPAL VOICES · OBSERVERS"; Maya vs Dan + "12 watching".
- R4 (L596): "PUBLIC 1:1 · 2 PRINCIPAL VOICES · 1 OF 3 CHIME-INS USED".
- R5 (L622): "PUBLIC 1:1 · CHIME-IN SEATS FULL · OBSERVERS WELCOME" + "31 watching".
- R6 (L646, L648): "PRIVATE 1:1 · INVITED PARTIES ONLY" (gold), Maya & Dan, "just you two".
- Tablet/desktop headers (L416, L455): "PUBLIC 1:1 · 2 VOICES (· OBSERVERS)" + "4 open · 12 points".

## Current repo grounding

- `AppHeader.tsx` and the room header exist; `useHeaderBreakpoint`/`resolveBand` + `TOUCH_TARGET(44)` are shipped and reusable (facts memory).
- The seat-line data comes from the UX-ROOM-1V1-CHIMEIN-001 model (principal voices, respondent-seat-open, chime-in count, observer count) — this card is the **view**, not the model.
- "moderator" SIDE = host seat (relabeled Host) — the seat line shows principal voices, not the platform app-role (facts memory).
- This card **extends** GAME-005 #142 and ARG-ROOM-005 #616 — it does not re-implement the room header shell; it adds the seat-line projection.

## Scope

- Render the visibility badge (PUBLIC 1:1 / PRIVATE 1:1, gold for private), the voices bar (two principals or "seat open"), the watching count, and the chime-in-status / seats-full text.
- Drive all of it from the UX-ROOM-1V1-CHIMEIN-001 model (read-only projection, no new semantics).
- Responsive: collapse gracefully at 390px; reuse the breakpoint helpers.

## Non-goals

- UI-only: does not change room/seat/chime-in/submission semantics — it reads the model.
- Does not implement the take-seat / chime-in actions (those are room-model + composer cards).
- Does not show likes/heat or any popularity count beyond the neutral "watching" observer count.

## Acceptance criteria

- Header shows the correct seat line for each R1-R7 state (open seat, two principals, N-of-3 chime-ins, seats full, private invited-only).
- Private rooms never show observer/chime-in counts; public rooms show "watching" + chime-in status.
- No overflow at 390px; touch targets ≥ 44 for any interactive header chip.

## Test plan

- Snapshot/render tests for each seat-line state driven by model fixtures.
- 390px overflow test.
- Accessibility: visibility badge + counts have text labels (not color/icon alone).
- Typecheck + lint clean.

## Doctrine compliance

- UI-first: does not change room/seat/chime-in/submission semantics.
- "watching" is a neutral observer presence count, not likes/heat/popularity.
- No winner/loser/score in the header.

## Dependencies

- Depends on UX-ROOM-1V1-CHIMEIN-001 (the model) and UX-COPY-001 (seat-line strings); pairs with UX-TOKENS-001 (gold private badge).
- Extends GAME-005 #142, ARG-ROOM-005 #616.

## GATE-C classification

No-if-UI-only (read-only header projection; no backend mutation).

## Automerge posture

Eligible for automerge once green (UI-only).

## Project labels/fields

priority:p0 · effort:m · lane:UI · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics (read-only projection of the room model).

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-MEDIATOR-001 — 9-state precedence in the pure derivation

## Goal

Bring the shipped `deriveMediatorBoardState` projection into exact alignment with the v4 9-state precedence: one primary structural state per node, chosen by the design's deterministic priority order (impasse-first), with the conflict-resolution rules the design publishes. This is the pure-TS derivation layer; it **extends, does not re-implement**, the merged mediator stack.

## Problem

The shipped derivation already produces a single board state, but it carries a 13-code superset, not the v4 9-state ordered vocabulary, and the v4 design publishes an explicit priority order and conflict-resolution table (e.g. Definition wins over Scope; Impasse + any path remains → not impasse; "Missing link" = the repo's `missing_mechanism`). We need the precedence encoded so the one-chip rule is deterministic and matches the design.

## Design export references

- Node-state precedence table (`CivilDiscourse v4.dc.html` L700-729): the 9 states in priority order — 1 Structured impasse, 2 Evidence blocked, 3 Accounts differ, 4 Definition not shared, 5 Scope mismatch, 6 Missing link, 7 Needs evidence, 8 Narrowed, 9 Open — each with "use when · must not imply" and a primary move.
- Conflict-resolution / stress tests (L863-870): Needs evidence + Narrowed → Needs evidence; Definition + Scope → Definition not shared; Evidence blocked + Needs evidence → Evidence blocked; Impasse + any path remains → not impasse; chime-in resolves source → state recomputes; voice transcript used → no state change.
- Handoff (L878): "Derive MediatorBoardState → UX-MEDIATOR-001."
- Role-vs-state (L843-857): role/seat/chime-in/voice are badges, "never occupy the one-state slot."

## Current repo grounding

- `src/features/mediator/deriveMediatorBoardState.ts` is a pure read-only projection; the board is derived **once** in `ArgumentGameSurface` (L683-693) and shared by the rail + node markup (facts §B, facts memory — single-derivation invariant).
- `mediatorBoardTypes.ts` has 13 `MediatorStateCode`s (a superset of the v4 9); v4 "Missing link" = repo `missing_mechanism` (facts §B).
- **Extends #584 (REF-001)** and the merged PRs #644-648 (mediator board single-derivation); also cross-refs REF-ADR-001 #590. This card does not re-implement the derivation — it adds/aligns the v4 precedence + conflict-resolution and maps the 13-code superset onto the 9-state display vocabulary.
- **AMEND-on-collision:** if a `UX-MEDIATOR-001` issue already exists, AMEND it (post the canonical v4 comment + this scope), do not duplicate. No such issue exists today.

## Scope

- Encode the v4 priority order and conflict-resolution rules in the pure derivation (or a thin precedence layer over it), preserving the single-derivation invariant.
- Map the 13-code internal superset → the v4 9-state display vocabulary (incl. `missing_mechanism` → "Missing link").
- Keep the projection pure/read-only; no React/network/Supabase imports.

## Non-goals

- Does not re-implement `deriveMediatorBoardState` or move the derivation out of `ArgumentGameSurface` (single-derivation preserved).
- Does not render chips (that is UX-MEDIATOR-002) or change the rail (UX-MEDIATOR-005).
- Does not change room/seat/chime-in/submission semantics; voice/transcript never changes state.
- Does not subsume #589 (REF-006 human smoke).

## Acceptance criteria

- For any node, the derivation yields exactly one primary state following the v4 priority order.
- The conflict-resolution table cases (L863-870) all resolve as the design specifies, with tests.
- The 13→9 mapping is total and documented; "Missing link" maps to `missing_mechanism`.
- Derivation remains pure (no new imports of React/Supabase/network); still derived once and shared.

## Test plan

- Pure-model unit tests for the priority order and each conflict-resolution row.
- A test asserts role/seat/chime-in/voice inputs never become the primary state.
- A test asserts "Impasse + any path remains" does not yield impasse, and "voice transcript used" yields no state change.
- 100% branch coverage on the precedence/conflict logic (test-discipline).
- Typecheck + lint clean.

## Doctrine compliance

- The chip "describes the point's structure, not the person."
- No AI judge / truth verdict / winner / loser / score; states are structural, not verdicts.
- Pure-TS, side-effect free, JSON-serializable (engine-adjacent discipline; though this is a feature projection, it stays pure).
- Acceptance-gate invariant: classifiers run after storage; the derivation never gates submission.

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001.
- Feeds UX-MEDIATOR-002 (chip), UX-MEDIATOR-003/004/005, UX-SELECTED-NODE-001.
- Extends #584 (REF-001), REF-ADR-001 #590, merged PRs #644-648. AMEND-on-collision if a UX-MEDIATOR-001 issue exists.

## GATE-C classification

No (pure-TS derivation; no deploy/migration/provider).

## Automerge posture

Eligible for automerge once green (pure-TS, single-derivation invariant preserved).

## Project labels/fields

priority:p0 · effort:l · lane:pure-TS · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=L, Area=UX.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics; the derivation never gates submission.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-MEDIATOR-002 — One primary state chip + selected-node anatomy

## Goal

Collapse node markup to the v4 "one primary state chip + one move" rule: unify the currently-double node markup (MediatorNodeMarker + NodeLabelStrip) into a single consolidated structural chip, and render the selected-node anatomy (role badge, responding-to anchor, body, one state, Act/Inspect/Go dock). This **extends, does not re-implement**, the merged node-marker work.

## Problem

Today two markups mount per node: `MediatorNodeMarker` (one primary state) and `NodeLabelStrip` (one machine + one user chip + overflow) — "chip soup" is still possible because they are not yet unified. The v4 design's central thesis (S1 → S2) is exactly this collapse: eight competing signals become one state + one move, with everything else in Inspect.

## Design export references

- S1 before / S2 after (`CivilDiscourse v4.dc.html` L734-784): chip soup ("Eight competing signals. No clear state.") → one state, one move ("The other seven signals live in Inspect.").
- S3 selected-node anatomy (L786-812): ① role badge (not a state) · ② responding-to anchor + parent excerpt · ③ node body (Newsreader) · ④ one primary structural state · ⑤ Act/Inspect/Go (Act dominant). "maps → selected node anatomy · UX-MEDIATOR-002."
- Screen 02 room board (L150-153, footer L174): selected node card with one "Needs evidence" chip; "maps → ArgumentTimelineMap · UX-MEDIATOR-002."
- Screen 03 (L186-202, footer L208): responding-to anchor, one state "· fact", MEDIATOR NOTE, "Act · Respond / Inspect / Go". "maps → TimelineNodeActionDock · TimelineSelectedReadoutPanel · UX-MEDIATOR-002."
- Handoff (L879, L918): "One primary chip / markup → UX-MEDIATOR-002."

## Current repo grounding

- Node markup is MIXED: `MediatorNodeMarker` (1 primary state) + `NodeLabelStrip` (1 machine + 1 user chip + overflow) **both mount → not yet unified** (facts §B, GAP 3).
- `MediatorNodeMarker.tsx` already renders one primary-state badge from the shared board state; board derived once in `ArgumentGameSurface` (facts §B).
- `nodeMediatorMarkers.ts`, `roomMediatorAdapter.ts` present in `src/features/mediator/`.
- **Extends #585 (REF-002)** (one primary chip / node marker) and merged PRs #644-648 (single derivation, active-node marker). Cross-refs the mediator board single-derivation invariant — reuse the once-derived board, never re-derive.
- **AMEND-on-collision:** if a `UX-MEDIATOR-002` issue exists, AMEND, do not duplicate. None exists today.

## Scope

- Unify `MediatorNodeMarker` + `NodeLabelStrip` into one consolidated structural chip (one state per node); move the overflow signals into Inspect.
- Render the selected-node anatomy (role badge separate from state, responding-to anchor, body, one state chip with axis suffix, Act/Inspect/Go dock with Act dominant).
- Consume the once-derived board (UX-MEDIATOR-001); do not re-derive.

## Non-goals

- Does not change the precedence logic (that is UX-MEDIATOR-001).
- Does not build the Inspect drawer's deep content beyond the move-from-soup relocation (Inspect detail lives with the mediator data cards / MCP-K plain language).
- Does not build the composer (VOICE-007/008) — Act routes to it but the composer is its own card.
- Does not change room/seat/chime-in/submission semantics; role/seat/chime-in/voice are badges, never the state.

## Acceptance criteria

- Exactly one structural state chip renders per node; `NodeLabelStrip`'s competing chips no longer mount alongside it.
- Selected-node anatomy renders the five labeled regions; Act is the dominant control; Inspect + Go are touch-safe.
- Role/seat/chime-in/voice render as badges and never occupy the one-state slot.
- The chip color/label match the v4 9-state vocabulary and tokens.

## Test plan

- Render tests asserting a single state chip per node (no double-mount).
- Selected-node anatomy snapshot covering the five regions and Act-dominant dock.
- A test asserts a role/voice/chime-in badge never renders as the primary state chip.
- Touch-target + reduce-motion handoff to UX-ACCESSIBILITY-001 (no glowpulse when reduce-motion).
- Typecheck + lint clean.

## Doctrine compliance

- One state chip "describes the point's structure, not the person."
- No winner/loser/score/red-green; axis suffix is equal-weight, never a verdict.
- Waveform/voice appears only as provenance, never as state.

## Dependencies

- Depends on UX-MEDIATOR-001 (precedence) and UX-TOKENS-001 (chip colors, `#1C1730` selected surface).
- Feeds UX-SELECTED-NODE-001 (detail/anchor depth) and UX-NEXT-MOVE-001 (Act suggestions).
- Extends #585 (REF-002), merged PRs #644-648. AMEND-on-collision if a UX-MEDIATOR-002 issue exists.

## GATE-C classification

No (UI-model; consumes the pure board, no backend mutation).

## Automerge posture

Eligible for automerge once green (UI-model, reuses single derivation).

## Project labels/fields

priority:p0 · effort:m · lane:UI-model · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics; reuses the once-derived mediator board (never re-derives).

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-MEDIATOR-003 — Evidence blocked / evidence-debt UI

## Goal

Render the v4 "Evidence blocked / evidence debt" surface: the evidence-blocked state and the source-owed / source-blocked debt row variant, with the design's plain-language framing ("no public dataset exists yet — mark unresolved") and the structured-impasse "accounts differ" endpoint's evidence-blocked path. This **extends, does not re-implement**, the shipped evidence-debt model helpers.

## Problem

The repo has the model helpers (`evidenceDebtDisplay.ts`) but no v4 UI for the evidence-blocked state or the evidence-debt row. The design distinguishes "Needs evidence" (a source would move it forward) from "Evidence blocked" (the record is unavailable/inaccessible right now — "Never implies someone is hiding evidence"), and gives each its own row treatment and move.

## Design export references

- Precedence rows (`CivilDiscourse v4.dc.html` L715 Evidence blocked, L725 Needs evidence): the use-when / must-not-imply / primary-move for each.
- Conflict resolution (L866): "Evidence blocked + Needs evidence → Evidence blocked."
- Disagreement-points sheet evidence-blocked row (L306): "Office serendipity raises output. Move forward: no public dataset exists yet — mark unresolved."
- Component inventory (L901): "Evidence debt row — Source owed / blocked variant of the point row."
- Inspect drawer (L826): "Evidence debt — 1 source owed."
- Handoff (L880, L920): "Evidence blocked / debt → UX-MEDIATOR-003."

## Current repo grounding

- `src/features/mediator/evidenceDebtDisplay.ts` exists (display helper) — model layer shipped; UI is the GAP (facts §B, GAP 9).
- The evidence/anti-amplification doctrine layer is `src/features/pointStanding/antiAmplification.ts` (engagement credit vs factual-standing credit are separate) — the UI must not conflate them.
- **Extends #586 (REF-003)** (evidence blocked / debt) — this card does not re-implement the debt model; it renders the v4 evidence-blocked state + debt-row variant on top.
- **AMEND-on-collision:** if a `UX-MEDIATOR-003` issue exists, AMEND, do not duplicate. None exists today.

## Scope

- Render the Evidence blocked node state and its primary move ("Mark evidence unavailable · name artifact · branch provable part").
- Render the evidence-debt row variant (source owed / blocked) for the points rail/sheet (handing off the rail layout to UX-MEDIATOR-005).
- Use the `evidenceDebtDisplay.ts` helper as the data source; plain-language only (no raw keys).

## Non-goals

- Does not change the evidence-debt model or the anti-amplification scoring (those are shipped pure-TS layers).
- Does not implement the points rail/sheet layout (UX-MEDIATOR-005) — supplies the evidence rows it consumes.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- Evidence blocked renders distinctly from Needs evidence, with the correct move and the "never implies hiding evidence" framing in the Inspect rationale.
- The evidence-debt row renders source-owed and source-blocked variants from the helper.
- No conflation of engagement credit with factual-standing credit in any visible string.

## Test plan

- Render tests for Evidence blocked vs Needs evidence and the two debt-row variants.
- A copy test asserts no "hiding evidence" / accusation phrasing and no score/verdict.
- Typecheck + lint clean.

## Doctrine compliance

- Evidence-blocked "Never implies someone is hiding evidence"; no person labels.
- Amplification/popularity is not evidence; engagement credit and factual-standing remain separate (evidence doctrine).
- No truth verdict / winner / loser / score / red-green.

## Dependencies

- Depends on UX-MEDIATOR-001 (state precedence) and UX-MEDIATOR-002 (chip); feeds UX-MEDIATOR-005 (rows in the rail/sheet) and UX-IMPASSE-001 (evidence-blocked impasse path).
- Extends #586 (REF-003). AMEND-on-collision if a UX-MEDIATOR-003 issue exists.

## GATE-C classification

Case-by-case: No for the display layer over the shipped helper. If a new persisted "mark evidence unavailable" action requires a backend write, that slice is split out and operator-gated (preceded by the semantics-assessment).

## Automerge posture

Display slice automerge-eligible once green. Any persistence slice is operator-gated.

## Project labels/fields

priority:p1 · effort:m · lane:model-UI · epic:civildiscourse-v4 · ux · gated (for any persistence slice). Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write in the display slice · NO service-role usage · NO migration. Any persisted "mark unavailable" action is a separate operator-gated slice. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-MEDIATOR-004 — Definition not shared / scope-mismatch bridge UI

## Goal

Render the v4 "Definition not shared / Scope mismatch" bridge: the two states, their precedence relationship (Definition wins over Scope), and the "define the key term" / "narrow the claim" moves, surfaced on the node, the points sheet, and the impasse "agreed along the way" summary. This **extends, does not re-implement**, the shipped definition/scope bridge helper.

## Problem

The repo has `definitionScopeBridgeDisplay.ts` but no v4 UI for these two adjacent states. The design treats them as a pair where shared terms usually unlock scope (Definition wins), each with a distinct move, and renames the shipped "Definition needed" to "Definition not shared".

## Design export references

- Precedence rows (`CivilDiscourse v4.dc.html` L719 Definition not shared "Wins over scope — shared terms usually unlock scope", L721 Scope mismatch "Never implies evasion or bad faith").
- Conflict resolution (L865): "Definition + Scope → Definition not shared."
- Disagreement-points sheet definition row (L304): "What counts as 'knowledge work'? Move forward: agree the key term before arguing the claim." (chime-in · Priya).
- Next-move screen 07 (L328-329): "Define the key term" and "Narrow the claim" actions with rationale.
- Impasse "Agreed along the way" (L387): "'Knowledge work' = roles with >3 daily handoffs."
- Handoff (L881, L921): "Definition + scope bridge → UX-MEDIATOR-004."

## Current repo grounding

- `src/features/mediator/definitionScopeBridgeDisplay.ts` exists; `mediatorPlainLanguage.ts:23` already renames "Definition needed" → "Definition not shared" (facts §B/§C). Model shipped; UI is the GAP (facts §B, GAP 9).
- **Extends #587 (REF-004)** (definition/scope bridge) — this card renders the v4 states/moves on top of the shipped helper; it does not re-implement the bridge.
- **AMEND-on-collision:** if a `UX-MEDIATOR-004` issue exists, AMEND, do not duplicate. None exists today.

## Scope

- Render Definition not shared and Scope mismatch as distinct node states with their moves ("Define the key term · propose a shared definition" / "Narrow the claim · respond to exact point · branch").
- Surface the bridge in the points sheet row and the impasse "agreed along the way" summary.
- Use `definitionScopeBridgeDisplay.ts` as the data source; plain-language only.

## Non-goals

- Does not change the bridge model or the precedence logic (UX-MEDIATOR-001 owns precedence).
- Does not own the points-sheet layout (UX-MEDIATOR-005) or the impasse card chrome (UX-IMPASSE-001) — supplies their definition/scope content.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- Definition not shared and Scope mismatch render distinctly with the correct moves and "never implies evasion or bad faith" framing.
- Definition-wins-over-scope is reflected wherever both could apply (delegating the decision to UX-MEDIATOR-001).
- The "agreed along the way" definition summary renders in the impasse path.

## Test plan

- Render tests for both states + their moves; copy test asserting no "evasion/bad faith" phrasing and no verdict.
- A test asserts the renamed "Definition not shared" label (never "Definition needed").
- Typecheck + lint clean.

## Doctrine compliance

- Scope mismatch "Never implies evasion or bad faith"; no person labels.
- No truth verdict / winner / loser / score / red-green; states are structural.

## Dependencies

- Depends on UX-MEDIATOR-001 (precedence) and UX-MEDIATOR-002 (chip); feeds UX-MEDIATOR-005 (rows) and UX-IMPASSE-001 (agreed-ground summary).
- Extends #587 (REF-004). AMEND-on-collision if a UX-MEDIATOR-004 issue exists.

## GATE-C classification

No (UI-model over the shipped display helper; no backend mutation).

## Automerge posture

Eligible for automerge once green (UI-model).

## Project labels/fields

priority:p1 · effort:m · lane:UI-model · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-MEDIATOR-005 — Disagreement Points sheet + vocabulary

## Goal

Build the full v4 Disagreement Points bottom sheet (mobile) and its vocabulary, on top of the shipped collapsed rail: a sorted list of point rows, each anchored to a node, each saying what would move it forward, with the state-distribution bar and the "12 total" count. This **extends, does not re-implement**, the shipped `DisagreementPointsRail`.

## Problem

The repo ships `DisagreementPointsRail.tsx` (collapsed → rail/sheet handle) but not the full mobile sheet the design specifies. The v4 design promotes the points list to the room's information architecture (the "Disagreement Ledger"): a swipe-up sheet on mobile, a persistent rail on tablet/desktop, with each row owning a state chip, an anchor (→ Dan / ↳ chime-in), and a "move forward" line.

## Design export references

- Screen 06 disagreement-points sheet (`CivilDiscourse v4.dc.html` L286-314): "Disagreement points · 12 total"; state-distribution bar (L298); rows for Needs evidence ("Move forward: attach a study measuring coordination cost"), Definition not shared, Evidence blocked, Narrowed. "maps → new DisagreementPointsSheet · UX-MEDIATOR-005 (+003/004)."
- Room board sheet handle (L164-165): "Disagreement points · swipe up ↑".
- Component inventory (L900): "Disagreement point row — Anchors to a node; says what would move it forward."
- Tablet/desktop right rail (L430-437, L457-plus): persistent "Disagreement points" column with the distribution bar + compact rows.
- Handoff (L882, L919): "Points rail vocabulary / Disagreement Points rail / sheet → UX-MEDIATOR-005."

## Current repo grounding

- `src/features/mediator/DisagreementPointsRail.tsx` exists (collapsed → rail/sheet); `mediatorRailCopy.ts` present (facts §B). The full mobile SHEET is the GAP (facts §B, GAP 5 — "rail exists").
- The rail/sheet reads the once-derived board (single-derivation invariant; reuse, never re-derive) — facts memory.
- **Extends #599 (REF-006-RAIL)** (points rail) and #588 (REF-005) — this card adds the full sheet + vocabulary on top of the shipped rail; it does not re-implement the rail.
- **AMEND-on-collision:** if a `UX-MEDIATOR-005` issue exists, AMEND, do not duplicate. None exists today.

## Scope

- Build the mobile bottom sheet (swipe-up handle → full sheet) with the count, the state-distribution bar, and the sorted point rows.
- Each row: state chip (v4 vocabulary), anchor (→ principal / ↳ chime-in), and the "Move forward: …" line.
- Reuse `DisagreementPointsRail` for the tablet/desktop persistent rail; the sheet and rail share the same row vocabulary.
- Consume evidence-debt rows (UX-MEDIATOR-003) and definition/scope rows (UX-MEDIATOR-004).

## Non-goals

- Does not re-derive the board or re-implement the rail (reuse the single derivation + shipped rail).
- Does not own the evidence-blocked or definition/scope row internals (those are 003/004) — composes them.
- Does not change room/seat/chime-in/submission semantics; does not introduce voting/scoring on points.

## Acceptance criteria

- Mobile sheet opens from the swipe-up handle and lists the points with count + distribution bar.
- Each row shows one state chip, an anchor, and a "move forward" line; chime-in-sourced rows show the ↳ chime-in marker.
- Tablet/desktop render the same vocabulary in the persistent rail.
- No overflow at 390px; sheet is dismissible; reduce-motion respected.

## Test plan

- Render tests for the sheet (count, distribution bar, rows) and the rail parity (same vocabulary).
- A test asserts the row "move forward" copy and the absence of score/winner/heat.
- 390px + reduce-motion handoff to UX-RESPONSIVE-V4-001 / UX-ACCESSIBILITY-001.
- Typecheck + lint clean; full suite green.

## Doctrine compliance

- Rows describe structure + the move that would advance the point, "not the person."
- No likes/heat/popularity sort; ordering is by structural state, not votes.
- No winner/loser/score/red-green; chime-in is a contribution marker, never a third principal or a state.

## Dependencies

- Depends on UX-MEDIATOR-001 (precedence) and UX-MEDIATOR-002 (chip); composes UX-MEDIATOR-003 + UX-MEDIATOR-004 rows.
- Extends #599 (REF-006-RAIL), #588 (REF-005). AMEND-on-collision if a UX-MEDIATOR-005 issue exists.

## GATE-C classification

No (UI; read-only projection of the board, no backend mutation).

## Automerge posture

Eligible for automerge once green (UI, reuses the shipped rail + single derivation).

## Project labels/fields

priority:p0 · effort:l · lane:UI · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=L, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics; reuses the once-derived board (never re-derives).

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-SELECTED-NODE-001 — Inspect drawer + responding-to anchor

## Goal

Build the v4 selected-node detail experience: the Inspect drawer (secondary detail — "why this state?", other structure notes, "what would move this forward?", history) and the responding-to anchor + parent excerpt, so the one-state-one-move card has a clean place to put the seven other signals. This **extends, does not re-implement**, the merged selected-node / readout work.

## Problem

The v4 design collapses the node to one state + one move, but the displaced detail has to live somewhere coherent: the Inspect drawer. Today there is no v4 Inspect drawer; the displaced signals would either crowd the card (chip soup) or vanish. The drawer is also where MCP plain-language ("no raw keys") rationale lives.

## Design export references

- S4 Inspect drawer (`CivilDiscourse v4.dc.html` L815-834): "WHY THIS STATE?", "OTHER STRUCTURE NOTES" (disagreement axis, parent relation, evidence debt, manual tags), "WHAT WOULD MOVE THIS FORWARD?" chips, "HISTORY" (narrowed, chime-in added a source). "maps → Inspect drawer · plain-language, no raw keys · UX-MEDIATOR-002 · MCP-K."
- S3 anatomy ② (L796-797): "Responding to · Maya's claim" anchor + parent excerpt.
- Screen 03 anchor (L186) and MEDIATOR NOTE (L193).
- Component inventory (L898): "Selected node panel — Responding-to anchor, body, one state, mediator note, AIG dock."

## Current repo grounding

- Node markup mixed (MediatorNodeMarker + NodeLabelStrip) — the unification is UX-MEDIATOR-002; this card owns the **detail/drawer** that receives the displaced signals.
- The mediator board (single-derivation) supplies the "why this state" rationale via `mediatorPlainLanguage.ts` (plain-language, no raw keys) — facts §B.
- **Extends #135 (IX-004), #10 (SC-002), #63 (SC-004), and CARD-VIEW-DETAIL-HUB-001 #517** — this card builds the v4 Inspect drawer + anchor on top; it does not re-implement the detail hub.
- **Does not subsume #504 (CARD-VIEW-DATA-001)** — that open card owns the card-view data contract; this card consumes it, it does not replace it.

## Scope

- Build the Inspect drawer with the four sections (why this state · other structure notes · what would move it forward · history), sourced from the once-derived board + plain-language helper.
- Render the responding-to anchor + parent excerpt on the selected node.
- Route the "what would move it forward" chips to the same moves as UX-NEXT-MOVE-001.

## Non-goals

- Does not own the one-state chip collapse (UX-MEDIATOR-002) — it receives the overflow.
- Does not own the next-move suggestion logic (UX-NEXT-MOVE-001) — it links to the moves.
- Does not subsume #504 (CARD-VIEW-DATA-001) or re-derive the board.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- Inspect drawer renders all four sections with plain-language only (no raw classifier keys).
- Responding-to anchor + parent excerpt render on the selected node.
- The drawer's "what would move it forward" chips match the node's primary-move set.
- Drawer is dismissible; reduce-motion respected; no overflow at 390px.

## Test plan

- Render tests for the four drawer sections from board fixtures; assert no raw-key strings leak.
- Anchor + parent-excerpt render test.
- Accessibility + 390px handoffs.
- Typecheck + lint clean.

## Doctrine compliance

- "WHY THIS STATE?" explains structure, "not the person"; no truth verdict.
- MCP rationale is plain-language, advisory; classifiers never gate submission.
- No score/winner/loser/red-green; history shows structural moves (narrowed, chime-in added a source), not popularity.

## Dependencies

- Depends on UX-MEDIATOR-001/002 (board + chip) and UX-NEXT-MOVE-001 (move set); pairs with UX-TOKENS-001.
- Extends #135 (IX-004), #10 (SC-002), #63 (SC-004), CARD-VIEW-DETAIL-HUB-001 #517. Does not subsume #504.

## GATE-C classification

No (UI; read-only detail projection).

## Automerge posture

Eligible for automerge once green (UI).

## Project labels/fields

priority:p0 · effort:m · lane:UI · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics; reuses the once-derived board.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-NEXT-MOVE-001 — "Suggest my next move" deterministic actions

## Goal

Build the v4 "Suggest my next move" surface: a quiet list of mediator-suggested actions (ask for the source, define the key term, narrow the claim, branch the provable part, mark unresolved) derived deterministically from the node's structural state — "an action — never a belief, winner, or truth."

## Problem

The repo has the `MediatorNextAction` type but no UI for it (GAP). The v4 design gives the user an explicit "what would move this forward?" screen of action cards, each with a one-line rationale, ranked by the node's state. This is the action counterpart to the one-state chip and must never read as a verdict or a recommendation about who is right.

## Design export references

- Screen 07 "Suggest my next move" (`CivilDiscourse v4.dc.html` L317-337): "What would move this forward?" + "The mediator suggests an action — never a belief, winner, or truth."; cards "Ask for the source", "Define the key term", "Narrow the claim", "Branch the provable part", "Mark unresolved for now". "maps → mediator suggestions · new UX-NEXT-MOVE · MCP-K-001."
- Each precedence row's "Primary move" column (L713-729) defines the canonical move per state.
- MCP suggestion card (component inventory L903): "Quiet next-move action + one-line rationale. Never a verdict."
- Handoff (L927): "'Suggest my next move' → new · UX-NEXT-MOVE."

## Current repo grounding

- `MediatorNextAction` type exists; **no UI** (facts §B, GAP 6).
- Moves are derivable from the once-derived board state (single derivation) + the precedence table's primary-move column — pure-TS, deterministic.
- **Extends #13 (ST-002), #31 (GAL-002), #587 (REF-004), and #290 (UX-001.4)** — this card builds the suggestion UI + the pure move-ranking on top; it does not re-implement the action type.
- **Does not subsume #504 (CARD-VIEW-DATA-001)** — consumes the card-view data, does not replace it.

## Scope

- Add a pure-TS move-ranking that maps a node's structural state → its ordered primary moves (one dominant + alternates), reusing the precedence table.
- Build the suggestion list UI (action card + one-line rationale, dominant first), routing each action to its composer/flow.
- Wire it as the node's Act target and the Inspect "what would move it forward" chips (shared move set with UX-SELECTED-NODE-001).

## Non-goals

- Does not call any LLM/MCP at runtime to choose the move — the move set is deterministic from state (MCP-K may later enrich rationale, but the gate/choice is deterministic).
- Does not assign truth/score/winner; never suggests a belief.
- Does not subsume #504; does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- For each of the 9 states, the suggestion list shows the design's primary move dominant, with the correct alternates.
- Each card has a one-line, structure-only rationale; none reads as a verdict or a who's-right recommendation.
- The same move set powers Act and the Inspect "move forward" chips.

## Test plan

- Pure-model unit tests mapping each state → its ordered moves (matches the precedence table).
- Render tests for the suggestion list (dominant-first, rationale present).
- Copy test: no "belief/winner/truth/score" framing; matches "never a belief, winner, or truth."
- Typecheck + lint clean.

## Doctrine compliance

- "The mediator suggests an action — never a belief, winner, or truth."
- Deterministic move selection; classifiers/LLM never gate or decide the action.
- No truth verdict / winner / loser / score / red-green / person labels.

## Dependencies

- Depends on UX-MEDIATOR-001 (state + primary-move table) and UX-MEDIATOR-002 (chip/Act); shares its move set with UX-SELECTED-NODE-001.
- Extends #13 (ST-002), #31 (GAL-002), #587 (REF-004), #290 (UX-001.4). Does not subsume #504. (Open operator question 02: net-new vs extension — recorded in the roadmap.)

## GATE-C classification

No (pure-TS move-ranking + UI; deterministic, no provider call, no backend mutation).

## Automerge posture

Eligible for automerge once green (pure-TS + UI).

## Project labels/fields

priority:p1 · effort:m · lane:pure-TS-UI · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=UX.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO runtime LLM/MCP call to choose the move (deterministic) · NO Supabase write · NO service-role usage · NO migration. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-IMPASSE-001 — Structured Impasse dignified-end screen

## Goal

Build the v4 Structured Impasse full screen: the dignified endpoint where form was followed, no current pathway remains, and the disagreement is preserved — showing each side's held position, the agreed ground, and the reopen path. "You both made the case … not lost, and not decided."

## Problem

The repo has the structured-impasse state + type but no full screen (GAP). The v4 design makes impasse a first-class, dignified destination — not a failure, deadlock, or loser. Without the screen, reaching impasse has no satisfying, doctrine-safe resolution surface, and the "save resolution / set reopen trigger" actions have nowhere to live.

## Design export references

- Screen 09 structured impasse (`CivilDiscourse v4.dc.html` L372-394): "Structured impasse · accounts differ"; "You both made the case."; "Nothing new is available to test this point right now. The disagreement is preserved — not lost, and not decided."; "Maya holds" / "Dan holds"; "Agreed along the way"; "Reopen with a source, a shared definition, or a narrower claim."; actions "Save resolution" / "Set reopen trigger". "maps → StructuredImpasseCard · UX-MEDIATOR-003/004."
- Precedence row 1 (L713): Structured impasse "Form was followed; no current pathway remains; the disagreement is preserved. Never implies failure, deadlock, or a loser." Primary move "Save this resolution · reopen w/ source · definition · narrower claim."
- Conflict resolution (L868): "Impasse + any path remains → not impasse."
- Component inventory (L902): "Structured impasse card — Dignified endpoint: accounts, agreed ground, reopen path."

## Current repo grounding

- The structured-impasse state + type exist in `mediatorBoardTypes.ts` (`structured_impasse`); no screen (facts §B, GAP 8).
- The "accounts differ" / "evidence blocked" / definition-scope summaries that populate the impasse card come from UX-MEDIATOR-003 (evidence) + UX-MEDIATOR-004 (definition/scope).
- **Extends #64 (GAME-001) and #146 (GAME-007)** — this card builds the dignified-end screen on top of the shipped state/type; it does not re-implement the state machine.

## Scope

- Build the Structured Impasse screen: the impasse kind subtitle (accounts differ / evidence blocked), the "you both made the case" framing, each side's "holds" summary, the "agreed along the way" ground, and the reopen path copy.
- Wire "Save resolution" and "Set reopen trigger" actions (UI; persistence slice split out if it needs a backend write).
- Enforce the precedence guard at the view boundary: never present impasse when a path remains (delegated to UX-MEDIATOR-001; the screen trusts the derived state).

## Non-goals

- Does not decide who is right; impasse "Never implies failure, deadlock, or a loser."
- Does not own the impasse-eligibility logic (UX-MEDIATOR-001 owns precedence + the "any path remains → not impasse" rule).
- Does not change room/seat/chime-in/submission semantics; any persisted reopen-trigger write is a separate operator-gated slice.

## Acceptance criteria

- The screen renders both sides' "holds", the agreed ground, and the reopen path, with the dignified framing copy.
- The subtitle reflects the impasse kind (accounts differ / evidence blocked).
- Actions render; the reopen-trigger persistence (if any) is split out + gated.
- Copy contains no "failure/deadlock/loser/winner/decided" verdict framing.

## Test plan

- Render tests for the impasse screen from board fixtures (accounts-differ and evidence-blocked variants).
- Copy test asserting the dignified-end vocabulary and the absence of winner/loser/failure/score.
- A test asserts the screen does not render when the derived state is not impasse.
- Typecheck + lint clean.

## Doctrine compliance

- Impasse is dignified: "the disagreement is preserved — not lost, and not decided"; "Never implies failure, deadlock, or a loser."
- No truth verdict / winner / loser / score / red-green / person labels.
- Reopen is structural (source / definition / narrower claim), not a re-vote.

## Dependencies

- Depends on UX-MEDIATOR-001 (impasse precedence) and composes UX-MEDIATOR-003 (evidence-blocked) + UX-MEDIATOR-004 (agreed-ground summary).
- Extends #64 (GAME-001), #146 (GAME-007).

## GATE-C classification

No for the screen; the reopen-trigger persistence slice (if it writes) is Case-by-case → operator-gated and preceded by the semantics-assessment.

## Automerge posture

Screen slice automerge-eligible once green. Any persistence slice is operator-gated.

## Project labels/fields

priority:p1 · effort:m · lane:model-UI-copy · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write in the screen slice · NO service-role usage · NO migration. Any persisted reopen-trigger is a separate operator-gated slice. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-FEEDBACK-001 — Clarity feedback (not popularity)

## Goal

Build the v4 "Feedback · clarity, not popularity" surface: chip-based feedback on how a response moved the point (answered the point / helped clarify / brought needed evidence / narrowed the disagreement) plus "flag what's missing" chips — never likes, never popularity, never a score.

## Problem

The repo has no clarity-feedback surface (net-new GAP). The v4 design wants a way for participants/observers to mark whether a response advanced the disagreement, but in clarity terms only. The doctrine risk is high: this must never become a like button, a vote, or a popularity/heat signal. The design states the constraint in the screen title itself: "clarity, not popularity."

## Design export references

- Screen 08 feedback (`CivilDiscourse v4.dc.html` L340-369): "How did this response move the point?"; positive clarity chips "Answered the point / Helped clarify / Brought needed evidence / Narrowed the disagreement"; "OR FLAG WHAT'S MISSING" chips "Still misses the point / Needs a definition / Source path blocked"; "Save feedback". "maps → clarity ratings · new UX-FEEDBACK."
- Component inventory (L908): "Feedback chip row — Clarity ratings, never likes or popularity."
- Handoff (L926): "Clarity feedback ratings → new · UX-FEEDBACK."
- Doctrine strip (L946): "no likes/heat."

## Current repo grounding

- Net-new (facts §B, GAP 7) — no shipped feedback UI.
- The "this response moved the point" semantics align with the point-standing economy's concession/narrowing/synthesis effects, but feedback chips are **clarity ratings**, not score inputs — they must not feed standing or any popularity tally.
- **Extends #158 (MCP-008)** — this card builds the clarity-feedback surface; it does not re-implement MCP feedback plumbing.

## Scope

- Build the feedback chip surface (positive clarity chips + "flag what's missing" chips + Save feedback), anchored to a response.
- Clarity-only vocabulary; no counts shown as popularity; no aggregate "score".
- If feedback is persisted, model it as private clarity annotations (not a public tally); the persistence slice is split out + gated.

## Non-goals

- No likes, no upvotes, no popularity/heat counts, no leaderboard, no score.
- Does not feed point-standing or any ranking from these chips.
- **UX-CLARITY-RATING-001 is DEFERRED** (P2; not a distinct package screen — its intent is folded here, but the deferred card is not filed). This card does not implement a separate clarity-rating scale beyond the v4 chip set.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- The surface renders the four positive clarity chips + three "missing" chips + Save feedback.
- No visible like/upvote/popularity/heat/score affordance anywhere on the surface.
- Any persistence is private clarity annotation, split out + operator-gated; the UI slice ships first.

## Test plan

- Render tests for the chip set + Save.
- A doctrine test asserts no like/popularity/heat/score string or affordance is present.
- A test asserts feedback chips do not write to point-standing/ranking.
- Typecheck + lint clean.

## Doctrine compliance

- "Clarity ratings, never likes or popularity"; "no likes/heat."
- No score / winner / loser / red-green; feedback describes how the response moved the point, "not the person."
- Classifiers/feedback never gate submission.

## Dependencies

- Depends on UX-MEDIATOR-001/002 (state vocabulary the chips reference); pairs with UX-COPY-001 (chip copy) + UX-COPY-DOCTRINE-001 (guards "likes/popularity").
- Extends #158 (MCP-008). Folds the intent of the deferred UX-CLARITY-RATING-001 (not filed). (Open operator question 02: net-new vs extension — recorded in the roadmap.)

## GATE-C classification

No for the UI slice; any persistence slice is Case-by-case → operator-gated.

## Automerge posture

UI slice automerge-eligible once green. Any persistence slice is operator-gated.

## Project labels/fields

priority:p1 · effort:m · lane:UI-copy · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write in the UI slice · NO service-role usage · NO migration · NO likes/popularity/heat/score affordance. Any persisted clarity annotation is a separate operator-gated slice. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-RESPONSIVE-V4-001 — 390 / 768 / 1440 three-tier layout

## Goal

Implement the v4 responsive system: mobile 390px progressive disclosure → tablet 768 two-pane (timeline + selected · disagreement rail) → desktop 1440 three-column (path · node + composer · ledger), with the composer dock anchored to the selected point at every size and no 390px overflow.

## Problem

The v4 design specifies three distinct layouts that reveal more of the same system at larger sizes. The repo has breakpoint helpers but no v4 three-column desktop / two-pane tablet, and there is a live 390px overflow class to avoid regressing. Without this card, the mediator board, points ledger, and composer don't have a coherent responsive home.

## Design export references

- Tablet & desktop section (`CivilDiscourse v4.dc.html` L399-404): "Progressive disclosure on mobile becomes side-by-side context on larger screens — the composer dock stays anchored to the selected point."
- Tablet 768 (L408-442): two-pane — center timeline + selected node + composer dock; right 272px disagreement rail with distribution bar.
- Desktop 1440 (L444-459-plus): three-column — COL1 thread / path, COL2 node + composer, COL3 ledger; app header with mark + wordmark + seat line.
- Mobile flow (L93-98): the 390px left→right core loop.
- Open operator question 05 (L935-plus): desktop ledger col-3 replace vs coexist with the side action rail (recorded in roadmap).

## Current repo grounding

- `useHeaderBreakpoint` / `resolveBand` + `TOUCH_TARGET(44)` exist and must be reused; the universal 390px overflow cause was the masthead logo width, fixed by `resolveMastheadLogoHeightPx` #654; admin-table `TABLE_WIDTH ~1462` overflow is deferred (facts memory, mobile-overflow note).
- The composer seam: `OneBox.tsx` hosted in `ArgumentComposerDock.tsx` (sheet < 720 / side-panel ≥ 720) — the dock already has a breakpoint behavior to extend (facts §B).
- The side action rail was de-scoped (entries folded into Act) — informs the col-3 replace-vs-coexist question (facts §B).
- **Extends #294 (UX-001.6) and #143 (BR-004)** (responsive) with the live mobile-overflow #654 context — it does not re-implement the breakpoint system; it adds the v4 three-tier layout.

## Scope

- Implement the tablet two-pane and desktop three-column layouts, reusing the breakpoint helpers and the `ArgumentComposerDock` sheet/side-panel seam.
- Keep the composer dock anchored to the selected point at every size.
- Verify no 390px overflow (masthead + new layouts); record the col-3 replace-vs-coexist decision per the operator answer.

## Non-goals

- Does not change the mediator board derivation or node markup (those are the mediator cards) — it lays them out.
- Does not fix the deferred admin-table width overflow.
- Does not change room/seat/chime-in/submission semantics.

## Acceptance criteria

- 390px: progressive-disclosure loop with no overflow; 768: two-pane; 1440: three-column — each matching the design's column assignment.
- Composer dock stays anchored to the selected point across all three.
- The col-3 ledger behavior (replace or coexist) matches the recorded operator decision.

## Test plan

- Layout/snapshot tests at 390 / 768 / 1440 asserting the correct pane/column structure.
- 390px overflow regression test (reuse the masthead guard).
- Reduce-motion / touch-target handoffs to UX-ACCESSIBILITY-001.
- Typecheck + lint clean.

## Doctrine compliance

- Layout-only; carries no verdict/score semantics.
- No likes/heat surfaced by the layout; the ledger orders by structure, not popularity.
- Reduce-motion: the v4 `roomEnergy` Hushed ≈ reduce-motion is honored (handoff to a11y card).

## Dependencies

- Depends on UX-TOKENS-001 (type/surfaces) and consumes UX-MEDIATOR-002/005 (board + ledger) and the composer (VOICE-007/008); pairs with UX-ROOM-SEATLINE-001 (header).
- Extends #294 (UX-001.6), #143 (BR-004); live context #654.

## GATE-C classification

No (UI-responsive; layout only, no backend mutation).

## Automerge posture

Eligible for automerge once green (UI-responsive).

## Project labels/fields

priority:p0 · effort:m · lane:UI-responsive · epic:civildiscourse-v4 · ux. Project #1: Phase=Backlog, Priority=P0, Effort=M, Area=UI.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy. UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-TEST-001 — v4 UX test harness

## Goal

Build the v4 UX test harness: end-to-end coverage of the core loop (open room → board → select node → one state → choose move → speak/type → review transcript → submit → node lands → state updates) plus the R1-R7 room states and the 9-state precedence, so the overhaul ships with regression protection rather than a follow-up.

## Problem

The overhaul touches the room model, mediator board, composer, and every screen. Without a dedicated harness, regressions (chip soup returning, a banned string slipping in, a 390px overflow, a private room exposing chime-in) would only be caught ad hoc. Tests are part of "done," not a follow-up.

## Design export references

- Mobile core-loop description (`CivilDiscourse v4.dc.html` L98): "Open a room → read the board → tap a node → see one state → choose a move → speak (or type) → review transcript → submit → the node joins the board and the point's state updates."
- 1:1 room model R1-R7 (L511-696) — each state is a test case.
- Node-state precedence + conflict-resolution + S1-S4 (L700-870) — the one-state/conflict matrix is a test case.
- Doctrine-held strip (L946) — the banned-construct assertions.

## Current repo grounding

- Repo runs jest suites (current main: large passing suite per CLAUDE.md stage notes); pure models have unit tests, UI has render tests, Edge functions have their own tests (test-discipline).
- The mediator board single-derivation invariant (derived once in `ArgumentGameSurface`) is a key thing to pin so refactors don't re-derive (facts §B, facts memory).
- Flaky wall-clock perf tests exist (LIFE-001 / META-001) — re-run isolated before blaming a branch (facts memory).
- **Extends #35 (AN-002)** (analysis/test) — this card adds the v4 harness.
- **Sibling, do NOT fold: #589 (REF-006 human smoke).** This card is automated coverage; it does not subsume or replace the human smoke protocol.

## Scope

- Add automated coverage for: the core-loop happy path, the R1-R7 room states, the 9-state precedence + conflict-resolution matrix, the one-state-one-move collapse (no chip soup), private-no-chime-in, seats-full observe-only, and the doctrine ban-list over visible copy.
- Pin the single-derivation invariant (board derived once).
- Wire into the existing suite; keep flaky perf tests out of the gating path or run isolated.

## Non-goals

- **Does not fold the #589 (REF-006) human smoke protocol** — that human-in-the-loop card stays separate.
- Does not test live provider/X/Supabase paths; any auth-bearing E2E is operator-gated.
- Does not change product semantics.

## Acceptance criteria

- The core loop, R1-R7, and the precedence/conflict matrix each have passing tests.
- A test fails if two state chips mount on one node (chip-soup guard) or if a private room exposes a chime-in affordance.
- The doctrine ban-list test runs in CI.
- The single-derivation invariant is asserted.

## Test plan

- This card is the test harness; its deliverable is the suite plus a short coverage map in the test docs.
- Run the full suite green; run the known-flaky perf tests isolated to confirm they are not regressed by the harness.
- If any auth-bearing E2E is added, gate it behind the operator env flag (no Claude-run live auth).

## Doctrine compliance

- The harness asserts the doctrine: no winner/loser/score/AI-judge/truth/red-green/likes-heat in visible copy; waveform = amplitude only; no "stored audio".
- Acceptance-gate invariant pinned: classifiers run after storage; no path blocks/rejects/routes/delays an ordinary user post.

## Dependencies

- Depends on the cards it covers (UX-MEDIATOR-001..005, UX-ROOM-1V1-CHIMEIN-001, the screen cards, UX-COPY-DOCTRINE-001); typically lands last in a wave.
- Extends #35 (AN-002). Sibling to #589 (REF-006) — not folded.

## GATE-C classification

Operator-gated-if-auth: No for offline harness; any live-auth E2E slice is operator-gated (env-flagged, not Claude-run).

## Automerge posture

Offline harness automerge-eligible once green. Any live-auth slice is operator-gated.

## Project labels/fields

priority:p1 · effort:l · lane:test-harness · epic:civildiscourse-v4 · ux · area:testing · gated (for any live-auth slice). Project #1: Phase=Backlog, Priority=P1, Effort=L, Area=Testing.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO live-auth run by Claude (any auth-bearing E2E is operator-gated, env-flagged). UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-ACCESSIBILITY-001 — a11y + reduce-motion across v4 surfaces

## Goal

Bring the v4 surfaces up to the project's accessibility contract: ≥44 tap targets, screen-reader labels for every state chip / seat-line badge / move action, color-independent state encoding (axis dots + chips never rely on color alone), keyboard navigation, and reduce-motion behavior (the v4 `roomEnergy` Hushed mode degrades the waveform / glowpulse / record-ring to static).

## Problem

The v4 design leans on color (axis dots, state chips), motion (waveform, glowpulse selected node, record-ring), and dense controls — all accessibility risk surfaces. The doctrine + the accessibility skill require color-independence, reduce-motion degradation, and full keyboard/screen-reader support; without a dedicated card these get missed across many components.

## Design export references

- Accent system (`CivilDiscourse v4.dc.html` L42): axis dots "equal-weight, muted … Never red/green verdict" — color must not be the only signal.
- Animations (L17-20): `wf` (waveform), `glowpulse` (selected node), `ring` (record-ring) — `roomEnergy` Hushed ≈ reduce-motion (tweak control, facts §A).
- State chips (L64-70, precedence table L713-729) — each chip pairs a dot with a text label (the label is the color-independent signal).
- Composer record-ring + waveform (L223-247) — motion that must degrade to static.
- Open operator question 07 (facts §A): reduce-motion degrade to static — recorded in roadmap.

## Current repo grounding

- `TOUCH_TARGET(44)` and `useHeaderBreakpoint`/`resolveBand` exist and must be reused (facts memory).
- The `accessibility-targets` skill defines the contract (tap targets, screen-reader contract, keyboard nav, color independence, reduce-motion).
- **Extends #22 (IX-003)** (keyboard/a11y nav) and **#112 (SC-005)** — this card applies the contract to the v4 surfaces; it does not re-implement the a11y primitives.

## Scope

- Audit + fix the v4 components: state chips, seat-line badges, points rows, move actions, composer controls, Inspect drawer, impasse screen.
- Ensure every state is conveyed by text/label, not color alone.
- Add reduce-motion: waveform → static amplitude bars, no glowpulse, no record-ring animation, `roomEnergy` Hushed honored.
- Verify keyboard navigation order + screen-reader labels; tap targets ≥ 44.

## Non-goals

- Does not redesign the surfaces (it adapts them for accessibility).
- Does not change room/seat/chime-in/submission semantics.
- Does not add audio playback (waveform is amplitude-only and, under reduce-motion, static).

## Acceptance criteria

- Every state chip / badge / move action has a screen-reader label and is reachable by keyboard.
- No state relies on color alone (axis dots + chips carry text).
- Reduce-motion disables waveform animation (static bars), glowpulse, and the record-ring; nothing animates.
- Tap targets ≥ 44 across the v4 surfaces.

## Test plan

- Accessibility tests: label presence, keyboard order, color-independence assertions, tap-target sizing.
- Reduce-motion test: with reduce-motion on, the animated components render static.
- Run alongside UX-TEST-001; typecheck + lint clean.

## Doctrine compliance

- Waveform = amplitude only, never credibility; under reduce-motion it is static and still never implies analysis.
- No color-coded verdict (no red/green); labels are the signal.
- No score/winner/loser/likes-heat introduced by a11y affordances.

## Dependencies

- Depends on the surfaces it audits (UX-MEDIATOR-002/005, UX-SELECTED-NODE-001, UX-IMPASSE-001, the composer VOICE-007/008, UX-ROOM-SEATLINE-001) and UX-TOKENS-001 (axis colors); pairs with UX-RESPONSIVE-V4-001.
- Extends #22 (IX-003), #112 (SC-005).

## GATE-C classification

No (UI-test/adaptation; no backend mutation).

## Automerge posture

Eligible for automerge once green (UI-test/adaptation).

## Project labels/fields

priority:p1 · effort:m · lane:UI-test · epic:civildiscourse-v4 · ux · area:testing. Project #1: Phase=Backlog, Priority=P1, Effort=M, Area=Testing.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO audio playback (waveform amplitude-only; static under reduce-motion). UI-first: does not change room/seat/chime-in/submission semantics.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

## UX-OVERHAUL-SEQUENCE-001 — Sequencing / DAG / operator-question PM card

## Goal

Own the sequencing, dependency DAG, and operator-decision tracking for the whole CivilDiscourse v4 UX overhaul: a single PM card that records the build order (waves), the cross-card dependencies, the 7 operator open questions, the AMENDed VOICE/MCP-K/AUDIO issues, and the deferred items — so the 20-card slate executes in the right order without re-litigation.

## Problem

Twenty interdependent cards (plus the AMENDed voice/audio stack) cannot ship in arbitrary order: the pure derivation precedes the chip; the chip precedes the rail/drawer; the room model precedes the seat line; copy precedes the copy-lint; tokens precede everything visual; tests/a11y land last. There are also 7 operator decisions that change the build (warm vs cool internals, net-new vs extension, the precedence collapse, speech persistence, ledger col-3, the 9-state vocab finality, reduce-motion). One PM card keeps the slate coherent.

## Design export references

- Implementation handoff table (`CivilDiscourse v4.dc.html` L911-928): each surface → its repo home + work card.
- Open questions for the operator (L930-940-plus): the 7 decisions (warm #08060F vs cool #020617 internals; UX-FEEDBACK/UX-NEXT-MOVE net-new vs extension; how lifecycle+manual+classifier collapse to one state; speech persistence = transcript + amplitude envelope, no raw audio; desktop ledger col-3 replace vs coexist; is the 9-state vocab final; reduce-motion degrade to static).
- Node-state handoff (L877-886) + brand handoff (L91) + per-screen "maps →" footers — the card→surface map.

## Current repo grounding

- The mediator stack is shipped (single-derivation invariant) and the VOICE/MCP-K/AUDIO issues are OPEN (#658-671) — the sequence card records which are AMENDed (canonical v4 comment) vs newly filed (facts §D).
- The pipeline governance contract (`docs/core/pipeline-governance-contract.md`) binds mutation cards (GATE A/B/C, never-self-approve) — the sequence card flags which v4 cards carry GATE-C slices (facts memory).
- **Extends** the roadmap-expansion discipline; this card authors/maintains `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md` (the slate's roadmap) and keeps the INDEX in sync.

## Scope

- Author `docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md`: the dependency DAG, the build waves, the GATE-C flags per card, the AMEND list, and the deferred items (UX-CLARITY-RATING-001; brand internal-rename migration; Family K).
- Record the 7 operator open questions with a place for the answers; gate the affected cards on the relevant answer.
- Record the cross-ref boundaries (does not subsume #504, #589) and the fold map (UX-CHIMEIN→UX-ROOM-1V1-CHIMEIN-001, UX-FIRST-RUN→UX-COPY-001, UX-VOICE-HANDOFF→VOICE-009 AMEND).

## Non-goals

- Does not implement any UI/model/copy (it sequences the cards that do).
- Does not change room/seat/chime-in/submission semantics.
- Does not file the deferred UX-CLARITY-RATING-001 (records it as deferred only).

## Acceptance criteria

- The roadmap doc exists with the DAG, waves, GATE-C flags, AMEND list, deferred items, and the 7 operator questions.
- Every FILE card's dependencies in this slate are reflected in the DAG and consistent with each card body.
- The fold map and cross-ref boundaries are recorded; the INDEX links the roadmap.

## Test plan

- Docs-only: link-check (the roadmap, INDEX, and inventory cross-link); a consistency pass that every card code in the slate appears in the DAG.
- A grep confirms no banned tokens in the roadmap doc outside ban-list context.

## Doctrine compliance

- Docs/PM only; restates the doctrine summary the slate must hold (no AI judge/truth/winner/loser/score/red-green/likes-heat; waveform amplitude-only; no stored audio; acceptance-gate invariant; UI-first cards do not change semantics; semantics-assessment precedes any backend mutation).

## Dependencies

- Depends on UX-DESIGN-PACKAGE-001 (the INDEX + inventory it links).
- Governs ordering for all other UX-* cards; references the AMENDed #658-671 and the closed predecessors.

## GATE-C classification

No (docs-PM; no deploy/migration/provider).

## Automerge posture

Eligible for automerge once green (docs-PM).

## Project labels/fields

priority:p0 · effort:s · lane:docs-PM · epic:civildiscourse-v4 · ux · design-only · area:docs. Project #1: Phase=Backlog, Priority=P0, Effort=S, Area=Docs.

## Design package source

The CivilDiscourse v4 design package was inspected in `.tmp/`; the zip/assets were not committed. Asset integration happens only in implementation cards.

## Boundary attestation

NO Anthropic / xAI / X API call by Claude · NO Supabase write · NO service-role usage · NO migration · NO deploy · NO code edit (docs-PM only). UI-first boundary not applicable; room/seat/chime-in/submission semantics untouched.

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md

---

# AMEND register (OPEN issues — post the canonical comment, never duplicate)

The following OPEN issues are the canonical cards for their scope. The v4 package adds concrete UI states/copy, **not** duplicate cards. The canonical comment is posted on each; VOICE-007/008/009 also receive a per-issue addendum.

**Canonical comment (posted on all listed issues):**

> **CivilDiscourse v4 design package update.** The CivilDiscourse v4 design export was ingested in the CIVILDISCOURSE-V4-UX-OVERHAUL slate (see docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md). This issue remains the canonical card for its scope — the v4 package adds concrete UI states/copy, not a duplicate card. No duplication filed.

| Issue | Code | Comment |
|---|---|---|
| #658 | VOICE-ADR-001 | canonical |
| #659 | VOICE-001 | canonical |
| #660 | VOICE-002 | canonical |
| #661 | VOICE-003 | canonical |
| #662 | VOICE-004 | canonical |
| #663 | VOICE-005 | canonical |
| #664 | VOICE-006 | canonical |
| #665 | VOICE-007 | canonical + addendum (composer screens 04 / R7) |
| #666 | VOICE-008 | canonical + addendum (cross-surface + StartArgumentPage adapter) |
| #667 | VOICE-009 | canonical + addendum (persistence + ABSORBS voice→MCP handoff §13) |
| #668 | VOICE-010 | canonical |
| #669 | MCP-K-001 | canonical |
| #670 | MCP-K-002 | canonical |
| #671 | AUDIO-001 | canonical |

**MEDIATOR AMEND-on-collision guard:** no `UX-MEDIATOR-00X` issue exists today, so all five are filed fresh. If any later collides, AMEND (post the canonical comment + the card scope) rather than duplicate, and cross-ref the merged mediator code (`src/features/mediator/`, PRs #644-648) plus the closed REF-001..006 predecessors (#584-589, #599).

## VOICE-007 addendum (concrete composer states)

The v4 package gives VOICE-007 its concrete composer UI on screens 04 and R7 (`CivilDiscourse v4.dc.html` L211-252, L669-695): waveform hero (amplitude-only, L223-237), "Listening" pill (L217), editable transcript-review box "TRANSCRIPT · TAP TO EDIT" (L239), record-ring (`ring` animation, L246; static under reduce-motion), "Type instead" fallback (L245), "Use transcript" confirm (L247), and a deterministic form-not-AI validation line (L241). Maps → ArgumentComposerDock. No raw audio stored/sent to MCP; deterministic engine is the sole submission gate.

## VOICE-008 addendum (cross-surface + StartArgumentPage adapter)

The composer is cross-surface — in-room reply (screen 04), point-scoped chime-in (R7, L688), and the tablet/desktop anchored dock (L427, L457). The **StartArgumentPage requires its own adapter**: the room-reply composer anchors to a selected node, but start-argument / room creation (R1, L511-535) has no parent node, so it needs a separate composer adapter rather than the in-room anchored seam (cross-ref NAV-START-ARGUMENT-001 #524).

## VOICE-009 addendum (persistence + ABSORBS voice→MCP handoff §13)

Persistence = transcript text only, plus an optional stored amplitude envelope for a static waveform; **no raw audio** (design open question 04, L938). Voice/waveform/transcript is provenance only and never a node's structural state ("Voice transcript used → no state change", L870). **This issue ABSORBS the UX-VOICE-HANDOFF-001 §13 scope** — the voice→MCP metadata handoff (transcript-used flag + amplitude-envelope reference, never raw audio, to Family-K speech observations MCP-K-001/002). Do not file a separate handoff card.

---

See: docs/roadmap-expansions/2026-06-18-civildiscourse-v4-ux-overhaul-roadmap.md · docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md · docs/testing-runs/2026-06-18-civildiscourse-v4-design-package-inventory.md
