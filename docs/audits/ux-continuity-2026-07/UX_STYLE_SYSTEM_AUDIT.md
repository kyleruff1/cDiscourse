# UX Style System Audit — CDiscourse UX Continuity Audit 2026-07

**Artifact 3 of 7** in `docs/audits/ux-continuity-2026-07/`. Read-only audit; no code changes ride this document.

- **Audit root:** `C:/Users/kyler/cdiscourse/wt-voice-adr` (src identical to `origin/main` @ `da32f56b`).
- **Sources:** style synthesis digest (8-reader → 5-synthesizer → completeness-critic workflow), completeness-critic gap #12, and the operator-authed runtime walk of the live site (cited below as `RUNTIME 2026-07-12 authed walk @487px`).
- **Citation discipline:** every claim carries its `path:line` citation from the digest or a RUNTIME citation. Grep-based counts are ±~10% (dynamic styles). Counts cover `src/features` + `src/components`.
- **Companion artifacts:** severity ledger and PR sequencing live in `UX_ACTION_PLAN.md`; era naming and cohesion principles in `UX_COHESION_AND_MISSION_REVIEW.md`; dead-affordance census in `UX_ARTIFACT_CLEANUP_AUDIT.md`.

---

## Severity canon (binding, reconciled across all digests)

The critic demanded one severity canon; these rulings are final and this artifact uses them:

| Finding | Canonical severity | Note |
|---|---|---|
| Light-theme shared components on the dark app (F-01) | **P0** | P0-1 in the action plan. |
| Chime-in silent failure | **P0** (P0-2) | Not a style finding — carried in UX_ACTION_PLAN; listed here only so the canon is complete. |
| Button.tsx vs CONTROL contradiction (F-02) | **P1** | 4.47:1 is a hair's-width AA miss; the critic's calibration (style digest's "marginal" P1) was accepted over cohesionPlan's P0-3. Still rides PR-A. |
| Focus/Esc/corridor/containment cluster | **P0** | Not a style finding — must not be dropped; carried in UX_ACTION_PLAN Wave 1. |
| useReduceMotion consumer count | **1** | Grep-verified (DisagreementPointsRail only). The style digest's F-26 said "imported in only 2" — that number is superseded; carry **1** everywhere. |

---

## 1. Verdict: a two-generation system

CDiscourse's style system is **two generations living in one codebase**:

**Generation 1 (mature, correct, winning in new files):** the `designTokens.ts` layer — `SPACING` / `RADIUS` / `SURFACE_TOKENS` / `CONTROL` / `TYPOGRAPHY` / `TOUCH_TARGET` / `BORDER_WIDTH` / `GLOW`. **104 of 182 `.tsx` files import it**; `SURFACE_TOKENS` alone has **~1,007 references** and is the strongest-adopted family. The token layer is self-documenting (design language named at `designTokens.ts:2-21`), carries verdict-token ban-lists (`designTokens.ts:637-647`), and documents its own reduce-motion contract (`designTokens.ts:361-365`). The token layer itself is **not the problem and should not be redesigned**.

**Generation 0 (the literal underbrush):** **~1,169 six-digit hex occurrences** and **990 `fontSize` literals** sitting file-local, alongside 1,290 spacing literals and 347 radius literals. Adoption by family: SURFACE_TOKENS strongest; SPACING ~24%; RADIUS ~21%; TYPOGRAPHY ~14% (partly because the scale *cannot express* 14–18px — see F-09); TOUCH_TARGET ~40%.

**The gap is adoption, not architecture.** Four coexisting visual eras (named in the cohesion review, inventoried here as F-31): Era A token-slate (the target), Era A′ hardcoded-hex slate dialect (same look, no token linkage — F-10), Era B warm shell (F-21), Era C legacy bubble theater (F-16), plus a sanctioned admin-console idiom (F-24). Normalization = migrate literals onto the existing layer, additively extend the layer where it cannot express real needs, and never mutate the pinned values.

### Contradiction resolution (verified in-repo during synthesis)

| Claim | Verdict |
|---|---|
| Tone-band drift (3 copies) | **CONFIRMED.** `railSegmentModel.ts:160-166` and `timelineNodeVisualModel.ts:134-140` are byte-identical (calm `#22c55e`, measured `#3b82f6`, heated `#f97316`, hostile `#ef4444`, unknown `#94a3b8`; pin comment :131-133 covers only these two). `argumentGameSurfaceModel.ts:851-857` differs on 4 of 5 keys (calm `#22d3ee`, measured `#818cf8`, hostile `#dc2626`, unknown `#475569`; only heated matches). The pin test never covered the third copy. |
| Button vs CONTROL | **CONFIRMED, scope refined.** `Button.tsx:67,76` primary = `#6366f1`+white — the exact 4.47:1 AA fail documented at `designTokens.ts:428-430`; `Button.tsx:72` danger = full-bleed `#ef4444` vs CONTROL.danger "bordered, NOT a full-bleed red flood" (`designTokens.ts:445-450`); radius 10 at :61. **Refinement:** the secondary variant was ALREADY re-skinned to a BRAND gold ghost (UX-BRAND-001 comment, `Button.tsx:68-71`) — fix scope is primary + danger only. |
| TextInputField light theme | **CONFIRMED verbatim** (`TextInputField.tsx:50-63`: label `#374151`, input `#fff`/`#111827`, border `#d1d5db`). |
| STANDING_BAND_COLOR duplication | **CONFIRMED** — `argumentScoreModel.ts:49-59` and `argumentGameSurfaceModel.ts:839-849` carry the same red→green map; VISUAL-SIMPLIFY-003 neutral-collapse comment confirmed at `argumentGameSurfaceModel.ts:836-838`. |

No true reader contradictions remained; the two kind-palette findings (style + cohesion readers) are merged below as F-05.

---

## 2. Ranked findings

### P0 — hides content / breaks a11y

**F-01 — Light-theme leftovers in shared components on the dark app.**
- **Where:** `TextInputField.tsx:50-63` (label `#374151` ≈ 1.9:1 on the `#08060F` shell — near-invisible; white `#fff`/`#111827` input patch; border `#d1d5db`), `ErrorNotice.tsx:18-25` (`#fef2f2`/`#991b1b`), `EmptyState.tsx:28-29` (`#111827` title, `#6b7280` body), `CreateDebateForm.tsx:155-173` (`#444`/`#888`/`#222` labels, `#fafafa`/`#f4f4f4` cards).
- **What:** four shared components still ship their pre-dark-theme light palette while every screen around them is the dark shell. Dark-gray labels land at ~1.9:1 contrast on `#08060F` — functionally invisible text on live lanes.
- **Why it matters:** a11y — this is a WCAG failure by an order of magnitude, not a marginal miss; it hides form labels, empty-state copy, and error text. Consumers are live lanes: AuthScreen, CreateDebateForm, ConversationGalleryScreen, DebateListScreen, ArgumentHome. `SURFACE_TOKENS` ships purpose-built `inputBg`/`inputBorder`/`placeholder` roles (`designTokens.ts:416-418`) that these components ignore.
- **Change:** re-skin the 4 components onto `SURFACE_TOKENS` + `STATUS.danger` (for ErrorNotice). This is action-plan **PR-A / P0-1**.
- **Risk / blast:** 4 files + ~10 consumer screens visually; low test-pin exposure (INFERRED — pin inventory partial).
- **Test:** visual smoke on the ~10 consumer screens; contrast re-check on live dark lanes. **RUNTIME-CHECK #1:** rendered contrast on dev-cdiscourse.netlify.app (a local light card behind the fields would downgrade to P1 — not observed in the 487px walk, so P0 stands).

### P1 — major cohesion / marginal a11y fail / doctrine

**F-02 — Button.tsx contradicts CONTROL on primary + danger.** *(P1 per canon — see rulings table.)*
- **Where:** `Button.tsx:67,72,76` vs `designTokens.ts:434-451`; radius 10 at `Button.tsx:61`.
- **What:** primary = `#6366f1`+white, the exact 4.47:1 AA fail already documented at `designTokens.ts:428-430`; danger = full-bleed `#ef4444` where CONTROL.danger prescribes "bordered, NOT a full-bleed red flood" (`designTokens.ts:445-450`). Secondary was already re-skinned to the BRAND gold ghost (UX-BRAND-001, `Button.tsx:68-71`).
- **Why it matters:** every primary CTA in the app ships a documented WCAG AA miss (hair's-width: 4.47 vs 4.5), and the destructive variant is the exact red flood the token layer forbids — a doctrine contradiction between the shared component and its own token contract.
- **Change:** point primary + danger at CONTROL (secondary is done). Rides **PR-A** alongside F-01.
- **Risk / blast:** 1 file + 5 consumers (ArgumentComposer, AuthScreen, AuthCallbackScreen, CreateDebateForm, JoinDebatePanel) + snapshots; visual delta = one indigo step darker.
- **Test:** snapshot updates on the 5 consumers; contrast assert on the CONTROL primary pair.

**F-03 — Standing bands are red→green verdict-gradient colored, duplicated ×2 + an inline ternary.**
- **Where:** `argumentGameSurfaceModel.ts:839-849` == `argumentScoreModel.ts:49-59` (pretty_wrong `#b91c1c` → completely_right `#10b981`); a third independent banding inline at `ArgumentScoreTracker.tsx:69`, live via `room/ArgumentRoom.tsx` (room_exchange_v2 ON).
- **What:** the standing-band color ramp encodes right/wrong as red→green. SW-001 softened the *labels* only (`standingBandCopy.ts:32-40`); the color channel kept the verdict gradient. Mitigation already shipped: the default timeline edge collapses to neutral grey (`argumentGameSurfaceModel.ts:834-838`).
- **Why it matters:** doctrine — the app must not color-code truth verdicts; this is the largest remaining verdict-coloring surface, and it is live. Also maintainability: three copies of the ramp drift independently.
- **Change:** two-step. (1) Consolidate to a single canonical export now (mechanical, safe — this is action-plan **PR-F** dedupe). (2) Hold the ramp re-hue (e.g. neutral→indigo intensity meaning "support strength", not "truth") for an **operator doctrine ruling** — statically undecidable (PR-F′, gated).
- **Risk / blast:** 2 models + ArgumentScoreTracker + the VISUAL-SIMPLIFY-003 contract test + timeline-grammar skill expectations.
- **Test:** contract test moves from byte-duplication to single-import; re-hue (if ruled) needs a timeline-grammar skill pass.

### P2 — cohesion / drift

**F-04 — Tone-band palette drift across 3 copies.**
- **Where/what:** verified in §1 table — `railSegmentModel.ts:160-166` and `timelineNodeVisualModel.ts:134-140` byte-identical; `argumentGameSurfaceModel.ts:851-857` drifted on 4 of 5 keys. The byte-equality pin (:131-133) never covered the third copy.
- **Why:** the same semantic axis (conversation tone) renders in two different palettes depending on surface (rail/nodes vs game-surface readouts) — silent incoherence users can perceive but not name. Note calm=green/hostile=red is itself mild good/bad coding; `railSegmentModel.ts:159-160` defends it as activity-not-correctness.
- **Change:** promote one `TONE_BAND_HEX` to designTokens (importable by pure models), delete the drifted copy, convert the byte-equality pin to import-equality.
- **Risk / blast:** 3 files + 1 pin test. **Test:** the converted import-equality pin.

**F-05 — (MERGED style+cohesion) Three kind-color palettes for the same argument families.**
- **Where:** live: `TIMELINE_KIND_COLORS` (`argumentGameSurfaceModel.ts:824-832`; claim `#6366f1` / challenge `#f97316` / evidence `#06b6d4` / flag `#ef4444`). Token twin with DIFFERENT hues: `designTokens.ARGUMENT` (`designTokens.ts:99-106`; header at :18-20 concedes TIMELINE_KIND_COLORS "remain the source of truth"). Legacy third map ×2: `TRACK_COLORS` (`ArgumentTimelineNode.tsx:14-21`) + `TRACK_ACCENT` (`ArgumentTrack.tsx:19-26`).
- **What:** three sources of truth for kind color; the legacy pair colors **'counter' pure red `#ef4444`** — red-coding disagreement itself, contradicting the live challenge=orange grammar. Still imported by ArgumentTreeScreen/ArgumentTimelineScreen (wired at `App.tsx:112`).
- **Why:** doctrine-adjacent (red = disagreement teaches users disagreement is failure) + cohesion (same kind, three hues).
- **Change:** (a) merge the TRACK maps + re-hue counter→orange (2 files, trivial); (b) fold TIMELINE_KIND_COLORS into designTokens as canonical single import path.
- **Risk / blast:** 2 legacy files trivially; the canonical fold touches every kind-color consumer's import line.
- **Test:** grep-guard for the retired maps. **RUNTIME-CHECK #2:** which lane/flag actually renders the legacy screens in prod (determines urgency of the re-hue).

**F-06 — Spacing scale adherence ~24%.**
- **Where/what:** 1,290 literals vs 414 SPACING refs. Histogram: 8→271 ✓, **6→211 ✗**, **10→164 ✗**, 4→148 ✓, 12→156 ✓, **2→124 ✗**, 14→51 ✗, 16→44 ✓, 20→23 ✗, 24→16 ✓; 6 negative margins. The scale is xs4/s8/m12/l16/xl24 with an "ends-only" rule (`designTokens.ts:25-32`) — but the three most-needed values (2, 6, 10) are interior, so the rule is self-defeating in practice.
- **Why:** maintainability — a token retune cannot reach 76% of spacing; and the scale's own rule guarantees continued literal growth.
- **Change:** additive keys only (`xxs:2`, `sm:6`, `m10:10`); migrate opportunistically per-file. **Do NOT mass-rewrite** — SPACING_PRESETS values are test-asserted (`designTokens.ts:582` → `uxOneOneSevenTokenExports.test.ts`).
- **Risk / blast:** token file additive (zero-risk vs pins); per-file migrations bounded. **Test:** existing preset pin stays green; new keys get pin coverage.

**F-07 — Radius drift.**
- **Where/what:** RADIUS = 4/8/12/999 (`designTokens.ts:43-48`); literal frequency: 4→53 ✓, **6→78 ✗**, 8→71 ✓, **10→54 ✗**, 12→15 ✓, **999→45** (hand-written pill sentinel), strays 5/7/9/11/14-22; token-sourced only 90 of ~437.
- **Why:** maintainability; the 45 literal `999`s are a free win (the token already exists as `RADIUS.pill`).
- **Change:** add half-steps (6, 10) or bless a 3-step migration; replace the 45 literal 999s with `RADIUS.pill` (zero visual risk).
- **Risk / blast:** ~350 callsites total if fully migrated; radius rarely test-pinned (INFERRED). **Test:** spot snapshots; pill codemod is behavior-identical.

**F-08 — Three competing gray families; 40 files mix two.**
- **Where/what:** Tailwind-slate (~294 refs) + Tailwind-gray (~220: `#1f2937` ×83, `#6b7280` ×31, `#374151` ×28, `#111827` ×25, …) + shorthand `#444`/`#888`/`#222`/`#666` (`CreateDebateForm.tsx:155-198`). Mixers include ArgumentBubbleCard, ArgumentReplySidecar, ArgumentSideActionRail, `DebateListScreen.tsx:459,490`. `SURFACE_TOKENS` already names slate roles (`designTokens.ts:410-412`).
- **Why:** cohesion — two neutral ramps at slightly different temperatures inside one file reads as accidental; and gray-family text literals are exactly where the F-01 class of contrast failures breeds.
- **Change:** slate is the only neutral ramp; codemod the ~220 gray occurrences to the nearest SURFACE_TOKENS role, file-by-file. Visual delta minimal.
- **Risk / blast:** ~220 occurrences across ~40 files; mechanical. **Test:** per-file visual smoke; grep-guard on the gray hexes after migration.

**F-09 — Typography: 990 literals vs 157 TYPOGRAPHY refs; no body/title roles; sub-10px floor violations.**
- **Where/what:** histogram: 12→263, 11→217, 13→200, 14→96, 10→83, 15→50, **9→~21, 8→1**, 16→24, 18→16, 20→7, 22→5. TYPOGRAPHY covers only ten 10–13px roles (`designTokens.ts:542-563`) — 14–18px callsites **cannot** be token-sourced. Weight skews heavy (700→358, 800→98 vs 400→8). Sub-floor sites: fontSize 9 ×~23 (`AdminArgumentsTab.tsx:1549,1573,1727`; `DebateListScreen.tsx:459,486,490`; `ConversationGalleryScreen.tsx:780,793`; `TimelineNodePopover.tsx:398`), fontSize 8 at `BranchCollapseStub.tsx:226`.
- **Why:** a11y (8–9px breaches any legibility floor, including on live gallery lanes) + maintainability (the scale structurally excludes half the app, so literal growth is guaranteed).
- **Change:** ADD roles — bodySm 13 / body 14–15 / titleSm 16 / title 18 / microLabel min 10; sweep the ~24 sub-10px lines in ~12 files up to 10–11. **TYPOGRAPHY values are test-pinned (`designTokens.ts:540`) — ADD keys, never mutate.**
- **Risk / blast:** token file additive; sub-10px sweep = ~24 lines / ~12 files (admin tables + gallery + popover + stub). **Test:** pin test extended to the new keys; visual smoke on admin tables. See also §4 (critic #12 font-scaling gap → RUNTIME-CHECK #9).

**F-10 — Era A′: hardcoded-hex slate dialect (same look, no token linkage).**
- **Where:** RingsideCard (`RingsideCard.tsx:66-69,416-517`), ConversationGalleryScreen (:713-805), `RoomBoardLayout.tsx:165`, RoomSettledNotice (:104-143).
- **What:** these ASP-era files render the token-slate look via raw hex. Some hexes exist in NO token set: `#111827` quoteChip, `#0c4a6e` proofChip, `#1e3a5f` marker highlight (`TimestampMarker.tsx:125`).
- **Why:** maintainability — a token retune would strand the app's newest, most-visible surfaces; the missing chip tints mean these files *couldn't* comply even if edited today.
- **Change:** bounded mechanical card — literals→references in the 4 ASP room/gallery files; add the missing chip-tint tokens first.
- **Risk / blast:** 4 files; RingsideCard + gallery are hot files (54 hex in gallery alone) — do behind visual smoke. **Test:** per-file snapshots; grep-guard for the named orphan hexes.

**F-11 — Derived/advisory provenance is audible, not visible** (gated: derived_signals).
- **Where:** "Advisory:" exists only in `accessibilityLabel` (`derivedSignalConsumerModel.ts:47-48`); same for "Mediator note:" (`MediatorNodeMarker.tsx:44`); visible provisionality = 11px dimming only (`DerivedSignalAdvisoryLines.tsx:53-57`).
- **What/why:** sighted users cannot tell machine observation from app truth — an inversion of the usual a11y gap, and a doctrine exposure (advisory outputs must read as advisory). This feeds the action plan's "visible provenance" P1 (PR-C).
- **Change:** visible affix or dashed-border treatment (extend the F-30 dashed/dotted=provisional grammar to "derived") + a render-test pin.
- **Risk / blast:** consumer components of derived signals + MediatorNodeMarker; flag-gated so blast is bounded. **Test:** render-test pin asserting the visible affix.

**F-12 — No reading measure on wide web.**
- **Where:** body is correctly the largest/quietest text (15/21 vs 11–13 bold chrome, `RingsideCard.tsx:451,434`) but spineColumn is `flex:1.2` with no maxWidth (`RoomBoardLayout.tsx:175-177`; `RingsideFeed.tsx:108-110`) → estimated 90–120ch line length at 1280px+.
- **Why:** readability/utility on the live web platform — 90–120ch is roughly double the comfortable measure.
- **Change:** ~640–720px cap on the spine column, centered.
- **Risk / blast:** one file + snapshot. **Test:** snapshot; **RUNTIME-CHECK #3:** actual rendered measure (wide viewport was NOT covered by the 487px walk — still open).

**F-13 — Chrome accumulation on the exchange screen.**
- **Where/what:** ~12 stacked bands (masthead, detail header, state rail, chime governance + affordance `ArgumentRoom.tsx:2968-2995`, micro-moment :3005-3020, feed, Act/Inspect/Go :3315, BoardBottomChrome :3696-3757, composer bar `App.tsx:1559`); the active card alone stacks up to ~15 elements (`RingsideCard.tsx:55-64,169-331`). The design pass promised one strip replacing three rails (design-pass Output 2 #09).
- **RUNTIME confirmation:** ~230px of masthead + nav chrome sits above content at 487px, and the gallery renders a nested scrolling card list (inner scrollbar; double-scroll pattern) — `RUNTIME 2026-07-12 authed walk @487px` (runtime finding 8). On a ~844px-tall phone viewport that is >25% of the screen spent before content. See §9.
- **Why:** utility/mission — the calm-console mission dies by a dozen well-intentioned strips; the runtime walk shows the cost is real at mobile width, not theoretical.
- **Change:** explicit chrome budget per card (precedent: the mediator one-chip-per-node rule, `ArgumentRoom.tsx:3253-3267`); fold OpenIssuesRail + SideActionRail verbs into the state rail/action row; revisit the double-scroll gallery container.
- **Risk / blast:** cross-cutting (room + gallery chrome); needs its own design card, not a mechanical sweep. **Test:** **RUNTIME-CHECK #4** (partially resolved): re-measure chrome px after the fold; visible band counts are room-state-dependent.

**F-14 — Settled rooms read live.**
- **Where:** RoomSettledNotice mounts only in the composer slot (`App.tsx:1593`; `RoomSettledNotice.tsx:57`); cards are pixel-identical to a live room. Retracted marks vanish traceless for other viewers (`moveMarkAggregateModel.ts:55`; SELECT-policy claim INFERRED from memory — migration SQL not re-read).
- **Why:** comprehension — a settled room's cards give no ambient signal of settlement above the fold.
- **Change:** ambient "Settled" chip on the state rail; document retract-invisibility as intentional.
- **Risk / blast:** state rail + copy; small. **Test:** render test on settled-room state; **RUNTIME-CHECK #8** for the SELECT-policy claim.

**F-15 — No comparison affordance anywhere; spec'd Constitution diff unbuilt.**
- **Where:** `product-spec.md:83-85` promises a diff view; no ConstitutionViewer/DiffView in src (grep-nil). Only comparison = vertical adjacency + quote-chip jump (`RingsideCard.tsx:187-204`).
- **Why:** utility gap vs spec — recorded as **opportunity, not regression**.
- **Change:** pinned-quote split view or spec diff (future card). **Risk / blast:** new-feature scale; out of normalization scope. **Test:** n/a until carded.

**F-16 — Era C: legacy z-stack bubble theater dormant-but-reachable.**
- **Where:** 18px radius, shadows (0.35/elev 6), cyan own-border, uppercase pills, purple standing badge (`ArgumentBubbleCard.tsx:234-279`); renders whenever room_exchange_v2 is off / ringsideFeed absent (`ExchangeView.tsx:127`); still the jest-pinned baseline.
- **Why:** cohesion — a full second visual dialect one flag-flip away; also carries most of the app's remaining shadow usage (§6).
- **Change:** deprecation card post-bake, or restyle into the slate dialect. The restyle option is **SUBJECTIVE DESIGN DIRECTION** (deprecation is the maintainability play; restyling is a taste call).
- **Risk / blast:** jest-pinned baseline — either path touches pins deliberately. **Test:** pin migration in the same slice.

**F-17 — Mission-fit verdict: passes at component level, leaks at product level.**
- **Where/what:** component level passes — conversation-first card faces (`RingsideCard.tsx:13-16`), verdict ban-lists (`designTokens.ts:637-647`), advisory-never-gate (`DerivedSignalAdvisoryLines.tsx:14`). Product level leaks via accumulation: era seams, chrome count (F-13), game-flavored gallery copy ("Logic traps", "Source trail fights", heat pills — `gameCopy.ts:1103,1121`; `ConversationGalleryScreen.tsx:763-764`), invisible provenance (F-11).
- **Why:** mission — each leak is individually defensible; the sum reads as a different product than the doctrine describes.
- **Change:** the specific fixes are F-11/F-13/F-22/F-28; this finding is the roll-up. **Test:** the cohesion principles doc + source-scan guards (normalization Wave 5).

### P3 — polish

**F-18 — Scrim token missing.** 14 ad-hoc `rgba(2,6,23,α)` variants, α∈{0.32…0.85}, plus `rgba(0,0,0,…)`, across ~27 callsites (~19 arguments + 8 debates files); only sanctioned rgba tokens are cream hairline/gold tints (`designTokens.ts:156,174-175`). **Change:** add `SCRIM {light .45 / medium .6 / heavy .8}` (maintainability). **Test:** additive token pin; codemod grep-guard.

**F-19 — Touch-target adoption ~40%.** 100 literal hitSlop objects vs 69 TOUCH_TARGET uses; 92 literal 44s vs 59 `minSizePx`. Presets exist (`designTokens.ts:477-481`); 4 primitives are §12.B-exempt by design (:471-474). **Change:** mechanical per-file codemod (a11y-maintainability). **Test:** per-file diff review; no behavior change.

**F-20 — Icon grammar: unicode glyphs, zero-dep (OK), but the one tokenized glyph is bypassed.** ~15-glyph vocabulary (○ ● ▾ ▸ ✓ → ◇ ◆ • ↑↓ ⤴ ↩; `proofDrawerModel.ts:51`); `CALLBACK_GLYPH` tokenized (`callbackComposerCopy.ts:25`) yet inlined at `ArgumentEntryComposer.tsx:363` and `room/MapView.tsx:174`. **Change:** add a `GLYPHS` export; replace the 2 inline ⤴ now (cohesion/maintainability). **Test:** grep-guard. **RUNTIME-CHECK #6:** Android fallback-font rendering of ◆/⤴.

**F-21 — Two-blacks seam.** Warm shell `#08060F` (`App.tsx:1731-1772`, `Screen.tsx:39`) vs cool slate `#020617` interior (`RoomBoardLayout.tsx:165`, `ConversationGalleryScreen.tsx:714`); the UX-001.1 mapping at `designTokens.ts:206-219` is not followed by room surfaces. **Change:** ratify a two-zone model or re-anchor the SURFACE base — *which* black wins is **SUBJECTIVE DESIGN DIRECTION**; that exactly one written rule should exist is maintainability. **Test:** the ratified rule lands in the cohesion principles doc + source-scan guard.

**F-22 — Red doctrine split.** The mediator board test-bans red/green pairing (a11y693MediatorBoardAxisGuard) while the gallery paints signal chips `#7f1d1d` maroon (`ConversationGalleryScreen.tsx:790`), heat pills shout uppercase (:763-764), and the flag family is bright `#ef4444` (`argumentGameSurfaceModel.ts:830`). **Change:** adopt product-wide "red = app failure only"; re-tone gallery criticals — the amber choice specifically is **SUBJECTIVE DESIGN DIRECTION**, the red-reservation rule is doctrine. Feeds the F-03 operator ruling. **Test:** extend the axis-guard pattern product-wide.

**F-23 — Vocabulary drift.** Disagree (`gameCopy.ts:40`; `RingsideCard.tsx:57`) / Challenge (`gameCopy.ts:966,1180`; legend `argumentGameSurfaceModel.ts:1666`) / Counter / "Needs first rebuttal" (`gameCopy.ts:1091`) all name one intent. **Change:** rule — verb = Disagree; kind label = challenge (grammar layer only). Cohesion/comprehension. **Test:** copy-source scan.

**F-24 — Admin console idiom (sanctioned, bounded).** 9–11px, uppercase headers, mono ids (`AdminArgumentsTab.tsx:1547-1574`); 4 parallel hand-declared COL maps + TABLE_WIDTH 1462 (`AdminArgumentsTab.tsx:92-106`; `AdminDebatesTab.tsx:49`; `AdminMetadataEventsTab.tsx:49`; `DebateListScreen.tsx:70`) with repeated 170px timestamp columns; responsiveTable mitigation live (`responsiveTable.ts:52-60`). **Change:** sanction "console density" for admin only; extract shared column presets next touch; lift 9px→10-11 (rides the F-09 sweep). **Test:** table visual smoke; see RUNTIME-CHECK #9 (zoom behavior of these exact tables — critic #12).

**F-25 — Receipt two-fidelity.** Card face renders a bespoke presence-only "Receipt/Receipts N" pill (`RingsideCard.tsx:268-273,469-477`) vs the shared 6-state ReceiptChip contract + dotted pressure ring elsewhere (`ProofChip.tsx:39-70`; `ReceiptChip.tsx:43-104`). Intentional per the header (:16) but undocumented. **Change:** codify "card face = presence; Inspect/drawer = status contract" in the cohesion principles doc. **Test:** doc + comment cross-reference.

**F-26 — Motion.** 5 duration literals app-wide (140×1, 160×3, 180×1); 6 Animated files; **useReduceMotion has exactly 1 consumer (DisagreementPointsRail — grep-verified per canon; the digest's "2" is superseded)**. The hook exists to be reused, never re-inlined. GLOW documents the reduce-motion contract (`designTokens.ts:361-365`). **Change:** thread the hook through the uncovered Animated sites; tokenize `MOTION {fast:140, base:160, slow:180}`. a11y + maintainability. **Test:** per-site reduce-motion unit tests; **RUNTIME-CHECK #5:** OS reduce-motion behavior of the unguarded sites.

**F-27 — visuallyHidden hack.** 1px text colored to the surface (`TimelineSelectedReadoutPanel.tsx:330`) ghosts in if the surface tone shifts. **Change:** extract an RN-web-safe visuallyHidden helper. a11y-robustness. **Test:** helper unit test + the one migration.

**F-28 — Gallery dialect hitch (nav model otherwise coherent).** Home's 3-verb grammar drops into 11 game-flavored buckets + 6 sorts + page-size chips past the floor door (`gameCopy.ts:1085-1139`; `ConversationGalleryScreen.tsx:724-744`); J1's "no taxonomy until Floor" is honored, but the floor itself breaks the calm grammar. Verb grammar partially adopted (Observe→/Continue→/Open→). **Change:** copy/density pass — mission/cohesion, not mechanical. **Test:** copy review against the cohesion principles.

### Info / assets (no action or positive record)

**F-29 — Units are CLEAN.** Zero calc/vw/vh; 37 benign % styles (width 100% ×22, sheet maxHeight 70–88% ×10); no ≥100 fixed heights in features/components; no spacer-Views; 6 negative margins; aspectRatio appears only in comments documenting the RN-web workaround (`AuthScreen.tsx:41,146`; `signInLockupModel.ts:30,91`). The masthead-432px incident class is contained. **No action.**

**F-30 — Obligation-vs-possession grammar is the app's strongest visual asset.** Dotted teal ring = source-chain pressure (`ReceiptChip.tsx:91-97`), dashed teal = owed (`RingsideCard.tsx:478-489`), solid attention = open debt (`EvidenceDebtChip.tsx:68-76`), solid pill = present. **Change:** name it in designTokens — "dashed/dotted = provisional/owed; solid = standing fact" — and extend it to "derived" (which fixes F-11). Protect it; do not restyle it.

**F-31 — Design language named.** "Calm slate console with kind-color spines" (VG-003, `designTokens.ts:2-21`) inside a warm cream/gold brand shell (`designTokens.ts:144-176`). Four eras coexist: **A** token-slate (target — `ArgumentCard.tsx:118-185`, ProofDrawer, MediatorNodeMarker), **A′** hex-slate (F-10), **B** warm shell (F-21), **C** bubble theater (F-16), plus the sanctioned admin console (F-24). Era naming and merge sequencing continue in `UX_COHESION_AND_MISSION_REVIEW.md`.

---

## 3. Token inventory vs literals

| Token family | Token refs | File-local literals | Adoption |
|---|---|---|---|
| SURFACE_TOKENS (color roles) | ~1,007 | ~1,169 six-digit hex | strongest; winning in new files |
| SPACING | 414 | 1,290 | ~24% |
| RADIUS | 90 | 347 | ~21% |
| TYPOGRAPHY | 157 | 990 fontSize | ~14% (scale can't express 14–18px) |
| TOUCH_TARGET | 69 hitSlop + 59 minSize | 100 + 92 | ~40% |
| designTokens import | 104 / 182 .tsx files | — | — |

**Hottest literal files** (sequence normalization BY FILE, not by token type): `ConversationGalleryScreen.tsx` (54 hex), `ArgumentTimelineMap.tsx` (42), `DebateListScreen.tsx` (35), `argumentGameSurfaceModel.ts` (35), `ArgumentReplySidecar.tsx` (33) — ~200 literals in five files. (Counts grep-based over src/features + src/components; ±~10% for dynamic styles.)

---

## 4. Typography hierarchy verdict

**Structurally sound on the card, systemically unadoptable.** Body is correctly the largest + quietest text (15/21 regular vs 11–13/700–800 chrome — F-12 citation set); but the token scale stops at 13px so half the app cannot participate (F-09); the weight distribution is inverted (700 ×358 vs 400 ×8); 8–9px/800 uppercase micro-labels breach the legibility floor at ~24 sites including live gallery lanes; and there is no reading measure on wide web (F-12). Verdict: **ADD roles (never mutate pinned values), cap the measure, lift the sub-10px floor.**

### Font scaling / browser zoom — unassessed (critic gap #12 → RUNTIME-CHECK)

No reader checked `allowFontScaling` usage or 200% browser-text-zoom behavior on the fixed 9–13px chrome and the ~1462px admin tables (`AdminArgumentsTab.tsx:92-106` TABLE_WIDTH family, F-24). This is a standard operator a11y question on RN-web and it is **currently unanswered in both directions**: if RN-web scales the text, the dense 9–13px chrome and hand-declared COL widths may clip or wrap destructively; if it does not scale, the sub-10px sites (F-09) have no user remedy at all. The 487px runtime walk did not exercise zoom. **Carried as RUNTIME-CHECK #9** — run 200% browser zoom + OS font-scale over: (a) the gallery chip rows (`ConversationGalleryScreen.tsx:763-793`), (b) an admin table at TABLE_WIDTH 1462, (c) the state-rail micro-labels. Outcome sets whether the F-09 sweep is P2 (as rated) or escalates.

---

## 5. Color semantics + verdict-coloring risk

- **Verdict-coloring risk is REAL in three places:** standing bands red→green (F-03, P1, doctrine-gated, live via score tracker/Inspect); legacy 'counter' = pure red (F-05); gallery maroon signal chips vs the mediator red/green ban (F-22). Mitigants already shipped: label softening (SW-001, `standingBandCopy.ts:32-40`), timeline neutral-collapse (VISUAL-SIMPLIFY-003, `argumentGameSurfaceModel.ts:834-838`), verdict-token ban-lists (`designTokens.ts:637-647`).
- **Neutral ramp is contested** (F-08: slate vs gray vs shorthand).
- **Kind color has 3 sources of truth** (F-05); **tone band has 2 palettes across 3 copies** (F-04).
- **Missing tokens:** SCRIM (F-18), MOTION (F-26), GLYPHS (F-20), chip tints `#111827`/`#0c4a6e`/`#1e3a5f` (F-10), body/title TYPOGRAPHY roles (F-09), SPACING 2/6/10 (F-06), RADIUS 6/10 (F-07).
- **Duplicated tokens:** STANDING_BAND_COLOR ×2 + inline ternary (F-03); TONE_BAND ×3, one drifted (F-04); kind palettes ×3 (F-05); COL/TABLE_WIDTH ×4 (F-24).

---

## 6. Spacing / radius / elevation drift

- **Spacing** (scale 4/8/12/16/24): 8→271 ✓ · 6→211 ✗ · 10→164 ✗ · 4→148 ✓ · 12→156 ✓ · 2→124 ✗ · 14→51 ✗ · 16→44 ✓ · 20→23 ✗ · 24→16 ✓.
- **Radius** (scale 4/8/12/999): 6→78 ✗ · 8→71 ✓ · 10→54 ✗ · 4→53 ✓ · 999-literal→45 (should be `RADIUS.pill`) · 12→15 ✓.
- **Elevation: healthy** — expressed via SURFACE bg steps per design (`designTokens.ts:398-404`); only 37 shadow lines across 8 files, concentrated in legacy Era C (F-16).

---

## 7. Icon + button + input + chip grammar inventory

- **Icons:** zero-dep unicode strategy (no icon lib in package.json), ~15 glyphs; one tokenized constant, bypassed twice (F-20).
- **Buttons:** CONTROL token (primary/secondary/danger, `designTokens.ts:434-451`) vs shared Button.tsx honoring it on secondary only (F-02, P1 per canon); action-row chips on cards use their own CONTROL_LABEL grammar (`RingsideCard.tsx:55-64`).
- **Inputs:** SURFACE_TOKENS input roles exist (`designTokens.ts:416-421` incl. shared focusRing) but the shared TextInputField is fully light-themed (F-01, P0).
- **Chips:** strongest grammar in the app — the dashed/dotted/solid obligation axis (F-30); the one-chip-per-node mediator budget (`ArgumentRoom.tsx:3253-3267`) is the precedent to generalize (F-13).

---

## 8. Unit-usage audit

**Clean** (F-29). Zero calc/vw/vh; benign % usage only; no spacer-Views; aspectRatio only in workaround-documenting comments. Keep `signInLockupModel` as the documented Image-sizing precedent (`signInLockupModel.ts:30,91`).

---

## 9. Runtime style/density findings (RUNTIME 2026-07-12 authed walk @487px)

Two live-site observations from the operator-authed walk land in this artifact as style/density items:

**R-8 — Header density: ~230px of chrome above content at 487px (P2).**
- **Where:** live site, gallery + room lanes — `RUNTIME 2026-07-12 authed walk @487px` (runtime finding 8).
- **What:** ~230px of masthead + nav chrome renders above the first content pixel at 487px width; the gallery additionally nests a scrolling card list inside the page scroll (inner scrollbar; double-scroll pattern).
- **Why it matters:** utility — this is the runtime confirmation of F-13's chrome-accumulation risk: over a quarter of a typical phone viewport is spent before content, and the double-scroll pattern makes list position ambiguous (which scrollbar owns the wheel/swipe is a classic RN-web trap).
- **Change:** fold into the F-13 chrome-budget card: collapse/condense masthead on scroll or in-room, and flatten the gallery to a single scroll container.
- **Risk / blast:** shared shell (App.tsx masthead region) + gallery container; cross-cutting, needs the design card.
- **Test:** re-measure chrome px at 487px after the fold (RUNTIME-CHECK #4 continuation); scroll-ownership manual check.

**R-9 — Raw locale timestamps ×3 stacked in the map (P3).**
- **Where:** live site, map surface — `RUNTIME 2026-07-12 authed walk @487px` (runtime finding 9).
- **What:** three stacked raw `toLocaleString`-style timestamps ("07/11/2026, 12:42:10 PM") render in the map, seconds included.
- **Why it matters:** cohesion/polish — the codebase already owns `formatDateTime` + `formatRelativeShort` (the admin tables and debate list use the absolute+relative stacked pattern deliberately); raw locale strings with seconds are a dialect break and burn horizontal space at 487px.
- **Change:** route the map timestamps through the existing `formatDateTime`/`formatRelativeShort` pair; drop seconds.
- **Risk / blast:** map surface only; trivial.
- **Test:** unit test on the formatter call; visual re-check at 487px.

---

## 10. Normalization plan (sequenced, with blast radius + pins)

**Binding constraints (read before any slice):**
- TYPOGRAPHY + SPACING_PRESETS **values are pinned** by `uxOneOneSevenTokenExports.test.ts` (`designTokens.ts:540,582`) — **additive keys only, never mutate**.
- uxOneOneFive / uxOneOneSix read-only boundaries pin timeline/composer file paths zero-diff — when a pinned file must be edited, relax the specific path **with a NOTE** in the boundary test.
- The tone-band byte-equality pin (`timelineNodeVisualModel.ts:129-133`) must become import-equality when consolidating (F-04).

**Wave 1 — a11y/doctrine (small blast, high payoff):** F-01 re-skin 4 shared components (4 files + visual smoke on ~10 screens; RUNTIME-CHECK #1 first); F-02 Button→CONTROL (1 file + 5 consumers + snapshots) — rides PR-A as **P1** per canon; F-03 consolidate STANDING_BAND_COLOR to one export now, hold the ramp re-hue for the **operator doctrine ruling** (2 models + tracker + contract test); sub-10px sweep from F-09 (~24 lines / ~12 files).

**Wave 2 — token additions (zero-risk, additive vs the pins):** TYPOGRAPHY body/title roles; SPACING 2/6/10; RADIUS 6/10 + pill codemod (45 sites); SCRIM (27 sites); MOTION (5 sites); GLYPHS (+2 inline ⤴); missing chip tints (`#111827`/`#0c4a6e`/`#1e3a5f`).

**Wave 3 — consolidations:** TONE_BAND single source (3 files + pin test conversion); kind palette single import path + legacy counter re-hue (F-05 — check ArgumentTreeScreen reachability first, RUNTIME-CHECK #2); gray→slate codemod (~220 occurrences, file-by-file); Era A′ literals→references (4 ASP files).

**Wave 4 — cohesion cards:** reading measure cap (1 file + snapshot; wide-viewport RUNTIME-CHECK #3 first); visible provenance affix (derived_signals-gated, F-11); chrome budget + rail folding (F-13 + R-8); ambient settled treatment (F-14); gallery copy/density pass (F-28); vocabulary ruling (F-23); Era C deprecation post-bake (F-16); map timestamp formatting (R-9).

**Wave 5 — guards:** land `docs/design-cohesion-principles.md` (the 12 principles — cohesion artifact item 18 / F-31) with source-scan guards for tokens-by-reference, visible provenance, and red-means-failure — mirroring the existing ban-list guard pattern (`designTokens.ts:637-647`).

---

## 11. Top-10 normalization moves

Ordered by payoff-per-blast. "Pins" = the binding constraints in §10.

| # | Move | Files | Blast radius | Validation |
|---|---|---|---|---|
| 1 | **F-01** Re-skin TextInputField / ErrorNotice / EmptyState / CreateDebateForm onto SURFACE_TOKENS + STATUS.danger (P0) | 4 shared components | ~10 consumer screens visually; low pin exposure (INFERRED) | RUNTIME-CHECK #1 contrast first; visual smoke per consumer; contrast asserts |
| 2 | **F-02** Point Button primary + danger at CONTROL (secondary already done) (P1, rides PR-A) | `Button.tsx` | 5 consumers + snapshots; visual = one indigo step darker | Snapshot updates; contrast assert ≥4.5:1 |
| 3 | **F-03(a)** Consolidate STANDING_BAND_COLOR ×2 + inline ternary to one export (re-hue held for operator doctrine ruling) | `argumentScoreModel.ts`, `argumentGameSurfaceModel.ts`, `ArgumentScoreTracker.tsx` | 2 models + tracker + VISUAL-SIMPLIFY-003 contract test | Contract test converts to single-import; behavior-identical |
| 4 | **F-09** Sub-10px sweep (9px ×~23, 8px ×1 → 10–11px) | ~12 files (AdminArgumentsTab, DebateListScreen, ConversationGalleryScreen, TimelineNodePopover, BranchCollapseStub…) | ~24 lines; admin/gallery density shifts slightly | Visual smoke on admin tables + gallery; RUNTIME-CHECK #9 informs floor |
| 5 | **Wave-2 token additions** — TYPOGRAPHY body/title roles, SPACING 2/6/10, RADIUS 6/10, SCRIM, MOTION, GLYPHS, chip tints | `designTokens.ts` (+ pin test) | Zero-risk: additive keys only vs the `designTokens.ts:540,582` pins | Extended pin coverage on new keys; existing pins stay green |
| 6 | **F-07** RADIUS.pill codemod — replace 45 literal `999`s | ~45 callsites | Behavior-identical; radius rarely pinned (INFERRED) | Mechanical diff review; spot snapshots |
| 7 | **F-04** TONE_BAND single source in designTokens; delete drifted copy | `railSegmentModel.ts`, `timelineNodeVisualModel.ts`, `argumentGameSurfaceModel.ts` | 3 files + 1 pin test | Byte-equality pin (:129-133) converts to import-equality |
| 8 | **F-05** Merge TRACK_COLORS/TRACK_ACCENT + re-hue counter red→orange; fold TIMELINE_KIND_COLORS into designTokens as canonical | `ArgumentTimelineNode.tsx`, `ArgumentTrack.tsx`, `argumentGameSurfaceModel.ts`, `designTokens.ts` | Legacy pair trivial (2 files); canonical fold touches kind-color imports app-wide | RUNTIME-CHECK #2 (legacy lane reachability) first; grep-guard on retired maps |
| 9 | **F-08** Gray→slate codemod (~220 occurrences → SURFACE_TOKENS roles) | ~40 mixer files, file-by-file | Visual delta minimal; hottest files (§3) sequenced first | Per-file visual smoke; post-migration grep-guard on gray hexes |
| 10 | **F-10** Era A′ literals→references in the 4 ASP room/gallery files (after move 5 lands the chip tints) | `RingsideCard.tsx`, `ConversationGalleryScreen.tsx`, `RoomBoardLayout.tsx`, `RoomSettledNotice.tsx` (+`TimestampMarker.tsx:125`) | 4 hot, highly visible files; mechanical but large per-file diffs | Per-file snapshots; grep-guard for the orphan hexes `#111827`/`#0c4a6e`/`#1e3a5f` |

Not in the top-10 but P2-tracked: F-06 spacing migration (opportunistic per-file, rides moves 5+), F-12 reading measure (1 file, after RUNTIME-CHECK #3), F-13/R-8 chrome budget (design card, not mechanical), F-11 visible provenance (PR-C lane).

---

## 12. RUNTIME-CHECK register (carried; status after the 2026-07-12 walk)

The authed walk ran at ~487px as an admin user (kyleruff+devtests1); wide-viewport behavior and plain-user rendering remain untested; deep states (playback, moderation) untriggered (`RUNTIME 2026-07-12 authed walk @487px`, runtime gaps item).

| # | Check | Finding | Status |
|---|---|---|---|
| 1 | Rendered contrast of TextInputField/EmptyState/ErrorNotice/CreateDebateForm on live dark lanes (a local light card behind fields would downgrade to P1) | F-01 | **OPEN** — not recorded in the 487px walk; P0 stands per canon until checked |
| 2 | Which lane/flag actually renders ArgumentTreeScreen/ArgumentTrack (red counter) in prod | F-05 | **OPEN** |
| 3 | Actual body line length at 1280px+ (est. 90–120ch) | F-12 | **OPEN** — walk was 487px only; wide viewport explicitly untested |
| 4 | Real visible chrome counts on an active room (state-dependent) | F-13 | **PARTIALLY RESOLVED** — ~230px masthead+nav chrome above content at 487px + gallery double-scroll confirmed (`RUNTIME 2026-07-12 authed walk @487px`, finding 8); per-state band counts still open |
| 5 | Whether the unguarded Animated sites animate under OS reduce-motion (useReduceMotion consumers = 1 per canon) | F-26 | **OPEN** |
| 6 | Glyph rendering (◆/⤴) on Android fallback fonts | F-20 | **OPEN** — walk was browser-only |
| 7 | Production flag ON-set | inventory | **RESOLVED by program record** (plan context): 9 live / 2 dark — only the #863 voice pair off |
| 8 | Retracted-marks SELECT-policy invisibility (model comment + memory; migration SQL not re-read) | F-14 | **OPEN** — verify via the DB lane |
| 9 | **(NEW — critic #12)** `allowFontScaling` / 200% browser-zoom behavior on the fixed 9–13px chrome and the ~1462px admin tables (`AdminArgumentsTab.tsx:92-106` TABLE_WIDTH family) | F-09 / F-24 / §4 | **OPEN** — never assessed by any reader or the walk; outcome may escalate F-09 |
| 10 | Plain-user rendering (walk ran as admin) + deep states (playback, moderation) | all | **OPEN** — carried from the walk's own gaps list |

**Residual gaps carried from readers:** grep counts ±10%; test-pin inventory partial beyond the documented pins; single-dark-theme assumption (no `prefers-color-scheme` found — if a light theme is ever planned, F-01's fix direction changes); F-03 ramp acceptability is an operator/doctrine ruling, not statically decidable.
