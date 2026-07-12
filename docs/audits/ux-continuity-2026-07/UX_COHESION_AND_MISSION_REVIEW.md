# UX Cohesion & Mission Review — CDiscourse UX Continuity Audit (2026-07)

**Artifact 5 of 7** in `docs/audits/ux-continuity-2026-07/`. Source of truth: the cohesion synthesis digest (8-reader → 5-synthesizer → completeness-critic workflow, read-only, audit root `C:/Users/kyler/cdiscourse/wt-voice-adr`, src identical to origin/main `da32f56b`), the completeness critic's verified gap list, and the operator-authed runtime walk of the live site (cited throughout as **RUNTIME 2026-07-12 authed walk @487px**). Every claim keeps its path:line citation. No new findings were invented for this document.

**Question this artifact answers:** does the product surface read as ONE product in service of the mission (calm, evidence-first, un-game-like structured disagreement) — and where it does not, what design language should it commit to?

**Verdict in one line:** the canonical design language is real, good, and mission-aligned — but it is one era among five, and the mission leaks by accumulation at the seams, not through any single component.

---

## 0. Severity canon (binding for this artifact)

Per the audit-wide reconciliation (the critic demanded one canon; it was ruled):

| Finding | Canonical severity | Note |
|---|---|---|
| Chime-in silent failure (attach/retract discards expected 409s) | **P0** (P0-2) | flag LIVE; misleads users |
| Light-theme shared components on the dark app | **P0** (P0-1) | near-invisible labels on the auth front door |
| Focus/Esc/corridor/containment cluster (zero `.focus(` in src on a web platform; Esc collision; corridor nav trap; MarkerPhrasePicker/RequestReviewComposer containment) | **P0** | the audit's only unanimous P0; lives in UX_ACTION_PLAN Wave 1 and must not be dropped |
| Button.tsx contrast (4.47:1 vs 4.5 AA threshold) | **P1** | hair-miss; critic's calibration accepted; still rides PR-A |
| useReduceMotion consumer count | **1** (grep-verified: DisagreementPointsRail only) | carry this number everywhere |

Where this document's source digest said "three style/states findings promote to P0," read it under this canon: light-theme and chime stay P0; Button.tsx is P1.

---

## 1. Contradictions resolved before writing (verified by re-read)

The four cross-reader contradictions in the cohesion lane were each settled in-repo before this artifact was written:

1. **"Advisory:" prefix visibility** — the states reader claimed derived signals are visibly "prefixed 'Advisory:'"; the cohesion reader claimed the prefix is a11y-only. **VERIFIED: cohesion is correct** — `DERIVED_SIGNAL_LINE_COPY` puts "Advisory:" only in `accessibilityLabel`; the visible `text` is a bare hedged sentence (derivedSignalConsumerModel.ts:38-65, re-read). Sighted users get LESS provenance than screen-reader users. Finding stands at P1 (§4 below).
2. **"No P0s" (cohesion) vs style/states P1s** — the cohesion reader's verdict was scoped to its own lane (design debt only). Under the audit rubric (P0 = hides content / blocks use / breaks a11y / misleads) the promotions are as ruled in §0.
3. **Voice 08-plan retention numbers vs ADR-002 D6** — ADR wins (it is self-aware: "5 min supersedes the package's ~10-min exemplar", VOICE-ADR-002:131). Stale numbers at 08:13,24,52,66,96,116,139 + 07:64 + 12:13 scope mismatch. Folded into UX_ACTION_PLAN as the mandatory first action when the voice lane opens (P3-V0).
4. **Tone-band "pinned so never drift"** — both readers were right: the byte-equality pin covers railSegmentModel.ts:161-166 ↔ timelineNodeVisualModel.ts:134-140 only; **argumentGameSurfaceModel.ts:851-857 is a third, divergent copy outside the pin** (calm cyan vs green, hostile #dc2626 vs #ef4444).

---

## 2. The named design eras and their tells

The codebase is not styled by one system; it is styled by five identifiable eras plus pre-era remnants. **Implicit language name: "calm slate console with kind-color spines" inside a warm brand shell** (designTokens.ts:2-21; TIMELINE_KIND_COLORS argumentGameSurfaceModel.ts:824-832).

| Era | Tell | Evidence |
|---|---|---|
| **A — Slate console, token-referencing** (canonical target) | SURFACE_TOKENS/BRAND/TYPOGRAPHY by reference, TOUCH_TARGET presets, gold only via BRAND.accent | ArgumentCard.tsx:118-185, MediatorNodeMarker.tsx:52-73, ProofDrawer.tsx:403-457, AdminArgumentsTab.tsx:1476-1573 |
| **A′ — Slate console, hardcoded-hex** (same look, no linkage) | #0b1220/#1e293b/#6366f1 literals matching tokens; off-token hexes (#111827 quoteChip, #0c4a6e proofChip, #1e3a5f marker highlight) | RingsideCard.tsx:66-69,416-517; ConversationGalleryScreen.tsx:713-805; RoomBoardLayout.tsx:165; TimestampMarker.tsx:125 |
| **B — Warm brand shell** (cream/gold on #08060F) | BRAND.surface.app vs cool slate #020617 interior — the "two-blacks seam" crossed every session; UX-001.1 token mapping the rooms don't follow (designTokens.ts:206-219) | App.tsx:1731-1772, Screen.tsx:39 vs RoomBoardLayout.tsx:165 |
| **C — Legacy z-stack bubble theater** (dormant-but-reachable) | 18px radius, drop shadows, cyan own-move border, uppercase pills, purple standing badge; renders when room_exchange_v2 off / ringsideFeed absent | ArgumentBubbleCard.tsx:234-279; ExchangeView.tsx:127 |
| **D — Ops-console admin idiom** (sanctioned divergence) | 9-11px type, uppercase headers, monospace ids, TABLE_WIDTH≈1462; palette-cohesive (uses tokens) | AdminArgumentsTab.tsx:1547-1574,92-106 |
| **Pre-era light-theme remnants** (not an era — bugs; P0-1) | White inputs, #fef2f2 error cards, #374151/#444 labels on the dark app | TextInputField.tsx:50-62 (VERIFIED), ErrorNotice.tsx:18-25, EmptyState.tsx:28-29, CreateDebateForm.tsx:155-173 |

**Two-generation codebase, quantified** (style-layer stats): 104/182 .tsx files import designTokens; SURFACE_TOKENS ~1,007 refs winning on color — but ~1,169 hex literals, 990 fontSize literals vs 157 TYPOGRAPHY refs (~14%), 1,290 spacing literals vs 414 (~24%), 347 radius literals vs 90 (~21%) (designTokens.ts:611 summary item). The token layer is good; adoption is the gap.

---

## 3. Mission-fit verdict per era

- **A: PASS** — conversation-first card faces ban standing/heat/classifier data (RingsideCard.tsx:13-16), verdict-token ban-lists guarded (designTokens.ts:637-647), advisory-never-gates (DerivedSignalAdvisoryLines.tsx:14).
- **A′: PASS visually, FAIL structurally** — same mission grammar but a token retune strands 4+ files silently. *Why it matters (maintainability):* the visual PASS is an accident of copied hex values, not a system property; the first retune breaks it invisibly. *Change:* UX_ACTION_PLAN P2-2 (Era A′ token migration). *Risk:* medium — 4-5 files, byte-identical-render verification required. *Test:* snapshot byte-stability + no-new-hexes guard.
- **B: NEUTRAL** — the identity/entry vs working-surface split is defensible but unratified; reads as two products at the seam. *Change:* P3-1 two-blacks ratification (pick #08060F or formally ratify the two-zone model — the pick itself is **SUBJECTIVE DESIGN DIRECTION**; the requirement to decide is maintainability: an unratified seam invites per-file drift). *Test:* decision recorded in the cohesion contract doc.
- **C: FAIL** against "minimal ornament, un-game-like" (shadows, theater transforms, uppercase pills, purple standing badge) — tolerable only because dormant. **RUNTIME-CHECK its prod reachability** (renders when room_exchange_v2 off / ringsideFeed absent — ArgumentBubbleCard.tsx:234-279; ExchangeView.tsx:127). *Change:* P3-3 deprecation card post-bake; high blast (jest-pinned baseline) — schedule, don't rush.
- **D: PASS as sanctioned console density**, provided its 9-10px sizes never leak into user surfaces — **they already have** (gallery 9px excerptLabel/signal chips, ConversationGalleryScreen.tsx:780,793). *Change:* P2-6 sub-10px bump with grep guard `fontSize <10 outside admin/`.
- **Product level: the mission leaks by accumulation, not by any one component** — chrome band count (§6), era seams, game-flavored gallery copy ("Logic traps", "Source trail fights", heat pills — gameCopy.ts:1085-1139; ConversationGalleryScreen.tsx:763-764), and provenance that is audible but not visible (RingsideCard.tsx:12 finding; §4).

### 3.1 Lived evidence from the runtime walk (era-seam and naming symptoms in production)

These are not new categories — they are the era-seam and vocabulary findings above, observed live by a user's eyes:

- **IA seam: "My Arguments" nav routes to the gallery my-rooms lane, not ArgumentHome (P2)** — identical chrome to Browse; no visible nav affordance returns to the home_v2 resume-first surface (it is only the initial lane). Hedge copy "This link may not work…" renders even for rooms the viewer can open. (RUNTIME 2026-07-12 authed walk @487px, finding 7.) *Why it matters (cohesion + utility):* Era B's "identity/entry vs working surface" split (§2) only makes sense if the entry surface is reachable; when the nav's own label points somewhere else, the two-products-at-the-seam reading becomes literal. The unconditional hedge copy also violates the honest-state principle (§7) — hedging about rooms the viewer can demonstrably open trains users to ignore the copy. *Change:* IA fix rides the fixtures/IA PR in UX_ACTION_PLAN; hedge copy becomes conditional. *Risk:* low. *Test:* nav-routing jest + copy renders only when access is actually unknown.
- **Role-copy mismatch: the creator/Initiator of an empty room sees rail state "You are watching this argument / Watching" plus a "Watch ▾" observer control, while the overflow says "You are the Initiator" and the composer accepts posts (P2)** (RUNTIME 2026-07-12 authed walk @487px, finding 4). *Why it matters (mission + comprehension):* the vocabulary-drift finding (§6) made concrete — two role grammars render simultaneously and contradict each other on the same screen; a first-time host is told they are a spectator of their own room. *Change:* one role vocabulary per surface, derived from one source (the same one-derivation rule the mediator board already follows). *Risk:* low-medium (role copy threads through rail + overflow + composer gating). *Test:* jest — initiator identity in → no observer copy/control rendered.
- **"Public 1:1" labels a 5-seat room (P2 naming)** (RUNTIME 2026-07-12 authed walk @487px, finding 5). *Why it matters (cohesion):* naming grammar drift of the same species as Disagree/Challenge/Counter/Rebuttal (§6) — a room-type label that contradicts the room's own seat arithmetic ("3 of 5 active seats") undermines every other label's credibility. *Change:* room-type label derives from seat configuration, not a static string. *Risk:* low. *Test:* label model jest across seat configs.

---

## 4. Claim / evidence / source / inference — visual-grammar verdict

The mission requires that a reader can tell, at a glance, *what kind of thing* each piece of text is. Verdict by distinction:

| Distinction | Verdict | Evidence |
|---|---|---|
| CLAIM vs CHALLENGE vs EVIDENCE | **PASS** | distinct spine colors always paired with text labels, never color alone (argumentGameSurfaceModel.ts:824-832; RingsideCard.tsx:170-176) |
| SOURCE vs EVIDENCE | **PARTIAL** | 'source' folds into the 'evidence' spine family (argumentGameSurfaceModel.ts:814); the distinction lives only in the ReceiptChip 6-state contract + dotted pressure ring (ReceiptChip.tsx:43-104,91-97) |
| INFERENCE (machine/derived) | **FAIL for sighted users** | distinguished by placement (behind Inspect) and 11px dimming only (DerivedSignalAdvisoryLines.tsx:53-57); "Advisory:"/"Mediator note:" exist solely in a11y labels (derivedSignalConsumerModel.ts:40 VERIFIED; MediatorNodeMarker.tsx:44) |
| Obligation vs possession | **PASS — the strongest asset** | dotted teal ring = source-chain pressure (ReceiptChip.tsx:91-97), dashed teal = source owed (RingsideCard.tsx:478-489), solid attention = open debt (EvidenceDebtChip.tsx:68-76), solid pill = artifact present; J7 requested→supplied is a modeled flip. Undocumented as a named rule — extend "dashed/dotted = provisional/owed" to cover "derived" |
| Trust surfaces | **Honest at artifact level, thin at room level** | marker tombstones with verbatim quoted_text survive deletion (TimestampMarker.tsx:68-76), retraction is a timestamp never a delete (moveMarksModel.ts:20-21); but a settled room renders pixel-identical to a live one outside the composer slot (RoomSettledNotice.tsx:57; App.tsx:1593), and retracted marks vanish traceless for other viewers (moveMarkAggregateModel.ts:55; RLS layer INFERRED from memory — RUNTIME-CHECK) |

**The provenance gap is the single most mission-critical grammar failure (P1).** *Where:* derivedSignalConsumerModel.ts:38-65, MediatorNodeMarker.tsx:44, DerivedSignalAdvisoryLines.tsx:53-57. *What:* machine-derived advisory text is visibly indistinguishable from human argument text except by dimming and placement; the honest "Advisory:" framing exists but only screen-reader users receive it. *Why it matters (mission):* the AI-moderation hard rules make non-authoritativeness the load-bearing promise; a sighted user who cannot see that a line is derived may take it as the app's judgment — exactly the misreading the doctrine forbids. *Change:* UX_ACTION_PLAN P1-6 — a fixed visible affix ("note"/"derived" word or dashed-border treatment per principle #4). *Risk:* low — two components plus a model string. *Test:* render test pins the visible prefix; verdict-token ban-lists unaffected.

---

## 5. Reading-experience verdict

**The body text wins its card but loses the page.** Body is the largest, quietest text (15/21 regular, RingsideCard.tsx:451) vs 11-13px 700-800 chrome — correct hierarchy inside the card. But:

- **No max reading measure anywhere** — spineColumn flex:1.2 unbounded (RoomBoardLayout.tsx:175-177), RingsideFeed imposes none (:108-110); est. 90-120ch lines at the 1280+ band (RUNTIME-CHECK: actual measure — the runtime walk ran at ~487px and could not observe wide behavior). Same unbounded width on gallery/home excerpts (ConversationGalleryScreen.tsx:781; ArgumentCard.tsx:180-184). *Change:* P2-1 reading-measure cap ~640-720px centered (the specific value within the readable band is **SUBJECTIVE DESIGN DIRECTION**; having a cap at all is utility — long-line readability). *Risk:* low. *Test:* snapshot + RUNTIME-CHECK at 1280+.
- **Sub-floor type on user surfaces:** 9px ×~23 callsites + one 8px (BranchCollapseStub.tsx:226). fontWeight skews heavy (700→358, 800→98 vs 400→8).
- **No comparison affordance exists anywhere** — the spec's Constitution diff viewer is unbuilt (product-spec.md:83-85; grep ConstitutionViewer → nothing); comparing two moves requires memory across popover round-trips. *Change:* P2-13, design card first — not a quick fix.
- **No skeleton/layout-reserve pattern**; all loading is full-pane LoadingNotice swaps + post-load chip pop-in (useProofItems.loading returned but unused, ArgumentRoom.tsx:846).
- **Lived evidence — raw machine timestamps in the reading surface:** three stacked raw locale timestamps in the map ("07/11/2026, 12:42:10 PM") (P3) (RUNTIME 2026-07-12 authed walk @487px, finding 9). *Why it matters (cohesion):* the repo already owns a humane convention (`formatDateTime` + `formatRelativeShort`, used by the admin tables per Stage 6.1.6a); un-formatted `toLocaleString` output in a user surface is era-drift in text form — the reading surface should never show text no one designed. *Change:* route map timestamps through the existing formatters. *Risk:* low. *Test:* jest on the map's timestamp rendering.

---

## 6. Emphasis-competition findings

**What the eye must defeat to reach an argument:**

- **~12 chrome bands per exchange screen**: masthead, DebateDetailHeader, ArgumentStateRail (≤6 chip kinds), chime governance + affordance, micro-moment banner, feed, Act/Inspect/Go row, OpenIssuesRail pill + SeatAvailabilityStrip + SideActionRail, composer bar (ArgumentRoom.tsx:2968-3757; App.tsx:1559).
- **The active card alone stacks ~15 elements** (spine, kind label, meta, time, quote chip, markers, respond-CTA, callback echo, receipt pill, owed chip, branch pill, flag row, ≤8-control action row, feedback bar — RingsideCard.tsx:55-64,169-331).
- The design pass promised ONE strip "replacing three competing rails" (design-pass-extracted.md #09); rails were made collapsible but **all still mount**. Counts are static mount-graph maxima — RUNTIME-CHECK per-screen visible counts.
- **What outshouts the argument text**: colored 800-weight kind label, gold owed chip, indigo primary action, four collapsed-rail pills.
- **Lived evidence — the chrome does not merely compete, it contradicts itself:** state rail "7 open points" vs mediator strip "Open issues · 4" on the same screen, with no explanation of the difference (P1 comprehension) (RUNTIME 2026-07-12 authed walk @487px, finding 3). *Why it matters (utility + mission):* two authoritative-looking counters disagreeing about the room's central quantity teaches users that the chrome is decorative — the worst possible lesson for a product whose chrome exists to carry epistemic state. *Change:* rides UX_ACTION_PLAN P1 (competing open-counts): either derive both from one model (the mediator-board one-derivation precedent) or label the two scopes distinctly. *Risk:* medium — count semantics differ upstream and must be reconciled, not merely relabeled. *Test:* jest — one source of truth in → both surfaces agree or are visibly scoped.
- **Red doctrine is self-contradictory:** the mediator board bans red/green verdict pairing (test-guarded, a11y693MediatorBoardAxisGuard) while the gallery paints signal chips maroon #7f1d1d + shouting heat pills (ConversationGalleryScreen.tsx:790,763-764), the kind palette gives 'flag' bright red (argumentGameSurfaceModel.ts:830), legacy TRACK_COLORS paints 'counter' pure red (ArgumentTimelineNode.tsx:14-21; ArgumentTrack.tsx:19-26), and **standing bands run a red→green right/wrong gradient duplicated byte-identically in two files plus an inline sparkline ternary** (argumentGameSurfaceModel.ts:839-849; argumentScoreModel.ts:49-59; ArgumentScoreTracker.tsx:69) even though SW-001 softened the labels (standingBandCopy.ts:32-40). *Change:* P1-7 (a) dedupe now, (b) re-ramp off red/green — **doctrine-gated, operator ruling required**; P2-9 gallery re-tone. *Risk:* medium; the re-ramp is a doctrine question, not a style question. *Test:* import-equality test replaces the byte-pin; ban-list style guard for red-on-content.
- **Vocabulary drift:** Disagree / Challenge / Counter / Rebuttal for one intent (gameCopy.ts:40,966,1091,1180; argumentGameSurfaceModel.ts:1666). The runtime walk's Initiator-sees-"Watching" and "Public 1:1"-on-5-seats findings (§3.1) are this drift observed live. *Change:* P3-2 vocabulary ruling (verb='Disagree', kind-label='challenge').

---

**Chrome-before-content density (RUNTIME 2026-07-12 authed walk @487px — runtime finding 8).** *Where:* the masthead + primary-nav block consumes ~230px of vertical space before any content at 487px, and the gallery card list scrolls inside its own fixed-height region (inner scrollbar; the double-scroll pattern). *Why it matters (mission):* the reading surface — the argument itself — is what the mission privileges; a fifth of the viewport spent on chrome before the first card, plus nested scrolling, taxes exactly the comprehension the app exists to serve. *Change:* owned by UX_STYLE_SYSTEM_AUDIT R-8 (header density) and UX_ACTION_PLAN P2-R5; recorded here as emphasis-competition evidence. *Risk:* medium (masthead geometry is operator-tuned — the prominent-logo request is on record). *Test:* viewport-matrix render assertions at 390/487/768.

## 7. What already serves the mission (do not regress these)

Recorded so the fix waves do not flatten what works — several were confirmed live:

- **Settle confirm sheet is live and doctrine-clean** — 5 honest bullets (RUNTIME 2026-07-12 authed walk @487px, finding 10).
- **Observer flow copy is strong** — "Readers do not use active seats", "Join to reply" (RUNTIME 2026-07-12 authed walk @487px, finding 10).
- **Whole-card tap targets**; **virtualized list mounts a11y nodes correctly** (RUNTIME 2026-07-12 authed walk @487px, finding 10).
- The composer ships an (ungated) "Voice — coming soon" teaser slot — an asset for the voice lane, with a gating caveat carried in UX_ACTION_PLAN P3-V (RUNTIME 2026-07-12 authed walk @487px, finding 10).
- **The obligation-vs-possession dashed/dotted grammar** (§4) — the strongest visual asset in the app; name it and extend it, never dilute it (ReceiptChip.tsx:91-97; RingsideCard.tsx:478-489; EvidenceDebtChip.tsx:68-76).
- **Verdict-token ban-lists with test guards** (designTokens.ts:637-647) and **advisory-never-gates** (DerivedSignalAdvisoryLines.tsx:14).
- **Artifact-level trust honesty** — marker tombstones with verbatim quoted_text survive deletion (TimestampMarker.tsx:68-76); retraction is a timestamp, never a delete (moveMarksModel.ts:20-21).
- **Body-text hierarchy inside the card** — largest, quietest text (RingsideCard.tsx:451).
- **The capability-parity contract** (roomCapabilityParity.ts) — already binding; keep.

---

## 8. The 12 cohesion principles (evidence-tied)

These land as `docs/design-cohesion-principles.md` with **source-scan guards for #2, #3, #9** (ban-list test precedent: designTokens.ts:637-647; UX_ACTION_PLAN P1-1).

| # | Principle | Evidence anchor | Guard |
|---|---|---|---|
| 1 | One black, one elevation ladder | App.tsx:1731 vs RoomBoardLayout.tsx:165 | — |
| 2 | Tokens by reference, never matching literals | RingsideCard.tsx:416-517 | **source-scan** |
| 3 | Provenance must be visible, not only audible | derivedSignalConsumerModel.ts:40 VERIFIED; MediatorNodeMarker.tsx:44 | **source-scan** |
| 4 | Dashed/dotted = owed or provisional; solid = standing fact | ReceiptChip.tsx:91; RingsideCard.tsx:483 | — |
| 5 | Body is the largest, quietest type; chrome may be small or bold, never both | RingsideCard.tsx:434,451 | — |
| 6 | A reading measure (~640-720px) on wide web | RoomBoardLayout.tsx:175 | — |
| 7 | One verb per intent; kind labels are grammar, not verbs | gameCopy.ts:40 vs :1180 | — |
| 8 | A chrome budget per card — generalize the mediator one-chip-per-node rule | ArgumentRoom.tsx:3253-3267 | — |
| 9 | Red means app failure, never content state | ConversationGalleryScreen.tsx:790 vs the mediator ban | **source-scan** |
| 10 | Current-vs-historical is ambient, not just a slot notice | RoomSettledNotice.tsx:57; TimestampMarker.tsx:68 as the good pattern | — |
| 11 | Two fidelities per concept max, both documented | RingsideCard.tsx:268 vs ProofChip.tsx:39 | — |
| 12 | Every capability reachable from both lenses via the same action codes | roomCapabilityParity.ts — already binding, keep | — |

**Plus one state principle** (from the states lane): hooks return `{data, loading, error, refetch}`; screens render banner-over-stale-content, never silent-empty (template: BooleanFeedbackBar.tsx:151-176 write path; anti-pattern: ArgumentHome.tsx:206-217). One documented exception carries a **by-design tag**: `useMyCircles.ts:10,40-44` is a documented-intentional silent-failure hook ("error stays null by construction; a failed read simply yields no circles") — list it in the family census so the P1-2 family fix neither misses it nor accidentally "fixes" it (critic gap #1). The runtime walk's contradictory open-counts, observer-copy-for-Initiator, and unconditional hedge copy (§3.1, §6) are all lived violations of this principle's spirit: the screen must say what is actually true.

---

## 9. What the implicit design language should COMMIT to

The language already has a name — **"calm slate console with kind-color spines" inside a warm brand shell** — it just hasn't been ratified. Commitments, each traceable to the evidence above:

1. **Era A is canonical.** Everything user-facing converges on token-referenced slate console (§2 stats: the token layer already wins on color; adoption is the gap). Era A′ migrates mechanically (P2-2); Era C is deprecated post-bake (P3-3); Era D stays sanctioned strictly inside `admin/` with a fontSize guard at the boundary (P2-6).
2. **Ratify or collapse the two-zone shell.** Decide #08060F-everywhere vs a formal identity-zone/work-zone model (P3-1). Either answer is acceptable (**SUBJECTIVE DESIGN DIRECTION**); leaving it undecided is not — the unratified seam is what lets eras multiply.
3. **Provenance is a visible grammar, not an a11y courtesy.** Extend the named rule "dashed/dotted = provisional/owed" to cover "derived" so machine text is visibly other (§4; P1-5 + P2-11). This is the mission's non-negotiable rendered in pixels.
4. **The argument text is the protagonist.** Chrome budget per card (principle 8), reading measure on wide web (principle 6), sub-10px floor on user surfaces, and one authoritative count per concept per screen (§6 lived evidence). Chrome that contradicts itself gets merged or scoped, never left to compete.
5. **Red is reserved for app failure.** Content state uses the kind/tone palettes; the standing-band red→green gradient is deduped now and re-ramped only on operator doctrine ruling (P1-7).
6. **One vocabulary, derived once.** One verb per intent; role copy, room-type labels, and counts derive from single models the way the mediator board already derives once and shares (§3.1, §6; P3-2).
7. **Screens tell the truth about state.** The `{data, loading, error, refetch}` contract with banner-over-stale-content, silent-empty banned except by documented design (§8 state principle); hedge copy renders only when the hedge is real (§3.1).
8. **The ratchet lands before the repaint.** The principles doc + the three source-scan guards (#2, #3, #9) ship first (P1-1 / PR-D) so eras stop multiplying while migration proceeds.

---

## 10. RUNTIME-CHECK register (carried; cohesion-relevant items)

Items requiring an operator-authed browser pass that this audit could not settle statically. The two headline gaps from the runtime walk itself (finding 11): **the walk ran as an admin (kyleruff+devtests1) — plain-user rendering is unverified; and the preview pane's native width was ~487px — wide-viewport behavior is untested.**

| # | Check | Why (anchor) |
|---|---|---|
| 1 | **Plain-user rendering** — repeat the walk on a non-admin account | authed pass ran as admin; RUNTIME 2026-07-12 authed walk @487px, finding 11 |
| 2 | **Wide viewport (1280+)** — actual line measure on room/gallery/home | est. 90-120ch unbounded (RoomBoardLayout.tsx:175-177; §5) |
| 3 | Era C prod reachability — legacy bubble theater + tree lens + red TRACK palette | ArgumentBubbleCard.tsx:234-279; ExchangeView.tsx:127; ArgumentTimelineNode.tsx:14-21; App.tsx:112 |
| 4 | Per-screen *visible* chrome-band and active-card element counts (static counts are mount-graph maxima) | §6; ArgumentRoom.tsx:2968-3757 |
| 5 | Retracted-marks RLS invisibility for other viewers (migration SQL not re-read; INFERRED from memory) | moveMarkAggregateModel.ts:55; §4 trust surfaces |
| 6 | Rendered contrast of the P0-1 light-theme components per consumer screen | TextInputField.tsx:50-62 et al.; §2 pre-era row |
| 7 | Silent-hook failure frequency in the wild (no telemetry exists), incl. the auth-expiry cascade — expired JWT fails every silent read-hook simultaneously (critic gap #11) | §8 state principle; useProofItems.ts:66-69 |
| 8 | Deep states untriggered in the walk (playback, moderation) | RUNTIME 2026-07-12 authed walk @487px, finding 11 |

---

*End of UX_COHESION_AND_MISSION_REVIEW. Companion artifacts: UX_SURFACE_MAP (inventory), UX_TRANSITION_MAP (motion/state), UX_STYLE_SYSTEM_AUDIT (token stats in full), UX_ARTIFACT_CLEANUP_AUDIT (dead affordances/components), UX_ACTION_PLAN (the P0/P1/P2/P3 items and PR waves referenced above), UX_AUDIT_SUMMARY.*
