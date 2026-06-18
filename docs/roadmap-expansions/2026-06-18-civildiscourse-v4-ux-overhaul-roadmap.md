# CivilDiscourse v4 — UX Overhaul Roadmap

**Authored:** 2026-06-18 · **Status:** Planning (docs-only) · **Epic label:** `epic:civildiscourse-v4`
**Source design package:** `CivilDiscourse v4.dc.html` (181,386 B, sha `afb7f2b19633a13a`, 1,029 lines; inspected in `.tmp/`, not committed)
**Grounding bundle:** `.claude/worktrees/civildiscourse-v4-ux-overhaul-slate/.tmp/cd-v4-facts.md` (@ main `c1b4fd5`)
**Visible product name:** **CivilDiscourse** (one word). Internal repo identifiers stay `cdiscourse` until a separate operator-gated migration (design file L91).

> This is a planning document. No code, no installs, no migrations, no provider/Supabase calls were made to produce it. Every card below is filed (or amended) as a separate GitHub issue under `epic:civildiscourse-v4` by the issue-filing track, not by this doc.

---

## 1. Executive thesis

CivilDiscourse v4 is not a re-skin; it is a **convergence of three already-half-built ideas into one coherent room**: the *Premium Mediator Board* as the visual base, a *Speech-first loop* as the primary interaction, and the *Disagreement Ledger* as the information architecture (design file L30). The hero line states the whole goal: *"I can finally see what this argument is actually about."* (L29). The product remains, verbatim, **"A mediator, not a judge. We surface the structure of a disagreement — never who's right."** (L119).

The single largest UX win the package delivers is the **collapse of "chip soup" into one structural state per node**. Today a node mounts *both* `MediatorNodeMarker` (one primary state) *and* `NodeLabelStrip` (a machine chip + a user chip + overflow) — they have never been unified (facts §B "Node markup MIXED"). The design's before/after (L734-784) is explicit: eight competing signals → "One state. One move. The other seven signals live in Inspect." This is the spine of the whole overhaul; almost every other card hangs off it.

The work is overwhelmingly **UI, copy, pure-TS models, and tests** — not backend semantics. The mediator derivation engine, the design tokens, the 13-code state vocabulary, the Disagreement Points rail, and the room-creation matrix all already ship on `main` (facts §B). The v4 deltas are: (1) precedence *collapse* of the two node-markup components into one chip; (2) net-new *screens* for states whose model helpers already exist (evidence-blocked, definition/scope, structured impasse, next-move, feedback); (3) the **1:1 principal-voice + point-scoped chime-in** room topology, which the current matrix does not distinguish; and (4) the **speech-first composer**, which has zero shipped React components and is governed by the separate VOICE slate (#658–671), which we AMEND rather than duplicate.

**Bottom line:** v4 is achievable as a sequence of mostly-No-GATE-C UI/model cards on top of shipped foundations, with exactly one place that may touch backend semantics (the chime-in / principal-voice room model) and one external dependency lane (the VOICE/MCP-K family). Everything else is reachable without changing room, seat, chime-in, or submission semantics.

---

## 2. Why this package changes the roadmap

1. **It supersedes the "argument room as comment thread / gallery card list" mental model** with a *mediator board*: one selected node, one state, one move, a points ledger. The Conversation Gallery and Argument Stack work (Stages 6.1.8–6.4) remain valid plumbing, but the *node surface* is being redefined.
2. **It forces a decision the codebase has been deferring**: how lifecycle tags + manual tags + classifier observations collapse to *one* visible state (operator open question #3, L937). The shipped `deriveMediatorBoardState` already projects 13 codes to one primary state; v4 demands that the *rendering* layer stop double-mounting two chip components and honor that single derivation everywhere.
3. **It makes "no scoreboard" a UI invariant, not just a copy rule.** The package replaces the still-shipping forbidden taglines and "score / ahead / more supported" surfaces (facts §C) with structural language: *"Mark the point, not the person."* / *"See what remains unresolved."*
4. **It promotes speech-first from a doc/ADR backlog to a first-class interaction** — but bounded by hard doctrine: waveform = amplitude only, never credibility; **raw audio is never stored, uploaded, replayed, or sent to MCP**; text-only fallback at every entry window; permission denial never blocks posting (facts §E).
5. **It introduces a room topology** (1:1 principals + point-scoped chime-ins + observers) that the current `argumentRoomCreationMatrix.ts` does not model. This is the one place the overhaul may cross into backend semantics, so it is gated behind a semantics-assessment step.

---

## 3. CivilDiscourse brand + first-run thesis

**Brand.** The visible name is **CivilDiscourse**, anchored by the existing cream line-art crane mark with a gold sunrise (design file L78-80; assets `branding/civic-discourse-logo.png` full lockup, `civildiscourse-mark.png` header mark). The header lockup pairs the mark with the Newsreader wordmark (L85). The brand is currently **split** in the codebase — `CivilDiscourse` ships in `AppHeader.tsx:227` / About / auth-callback, but legacy `CDiscourse` still ships in `corridorModel.ts:111/159`, `inviteCopy.ts:64/66`, `DevEnvironmentBanner:46/51`, `gameCopy.ts:1599/1607`, and `app.json` (facts §C). The roadmap collapses **visible** copy to CivilDiscourse and **defers** the identity-bearing changes (`package.json` name, `app.json` slug `expo-scaffold` / name / `web.name`, `EXPO_PUBLIC_` prefix, domain, Supabase project-ref) to a separate operator-gated migration.

**First-run thesis (screen 01, L104-119).** The sign-in / first-run screen is the product's promise in one breath:
- Hero: **"A high-trust room for hard conversations."** (L110)
- Sub: **"Mark the point. Respond clearly. See what remains unresolved."** (L111)
- Room-model primer, inline: *"A high-trust **1:1** — invite one person privately, or open a public room others can watch."* (L112)
- Footer doctrine line: **"A mediator, not a judge. We surface the structure of a disagreement — never who's right."** (L119)

First-run is **folded into UX-COPY-001** (facts §D: `UX-FIRST-RUN-001 → UX-COPY-001`), not a separate card. The biggest single copy violation to fix is the live tagline **"Just get to the bottom of it"** (`src/lib/designTokens.ts:204` → `AppHeaderTagline.tsx:78`, `AppHeader.tsx:242`, `AboutScreen.tsx:26`), which the design replaces with **"Mark the point, not the person."** (L31, L946).

---

## 4. Visual system / logo / token direction

**Shipped already (facts §B; do not re-implement):** `src/lib/designTokens.ts` carries black `#08060F` / `#13101D`, cream `#F5EDE0`, gold `#C6A15B` (accent), and an indigo family (`#4f46e5`). There is **no verdict red/green** in tokens — that invariant already holds.

**Accent doctrine (design L37-42, L991-1004, props block L951-1026).** Three roles, never mixed:
- **Gold `#C6A15B`** — *brand / dignity / emphasis only*: wordmark, selected-node halo, the one dignified state (impasse), premium card borders. **Never the action color** ("Never the interface", L40).
- **Indigo (`--act-bg #312e81` / `--act-bd #6366f1` / `--act-fg #e0e7ff`)** — *the functional / active-path color*: Act buttons, CTAs, composer record ring, the "responding-to" rail (L41, L966).
- **Axis dots** — fact · definition · scope · causal · value · logic, rendered as *equal-weight, muted* oklch hues, explicitly **"Never red/green verdict"** (L42).

**Tweak controls (props L951-1026)** — record as the design's chosen defaults, not hardcode-all-four:
| Control | Options | Default | Cascades |
|---|---|---|---|
| `brandAccent` | Warm gold / Cool active / Quiet mono | **Warm gold** | `--gold` / `--gold-rgb` |
| `actionAccent` | Indigo / Violet / Steel | **Indigo** | `--act-bg/-bd/-fg/-bd-rgb/-glow-rgb` |
| `roomEnergy` | Hushed / Calm / Lively | **Calm** | `--wf-dur` / `--glow-dur` / `--ring-dur` (Hushed ≈ reduce-motion) |
| `brandLockup` | Compact / Balanced / Editorial | **Balanced** | `--logo-scale` 0.82 / 1 / 1.2 |

**Gaps to close (facts §B item 10):**
- **Typography** — Newsreader (serif: brand / impasse / mediator voice), Hanken Grotesk (body & interface), JetBrains Mono (small structural metadata only) (L13, L55-57). Not yet in tokens.
- **`#1C1730` selected-node surface** — the distinct elevated surface for the selected node card (L51, L771, L602). Currently only `#08060F` / `#13101D` exist.
- **Axis-dot oklch colors** — the muted fact/definition/scope/causal/value/logic palette (L42, L66-70). Not tokenized.

**Card:** UX-TOKENS-001 (P1/S/UI-tokens/No-GATE-C) adds fonts, `#1C1730`, and axis-dot oklch values as additive tokens. Cross-refs VG-003 #6, UX-001.7 #296.

---

## 5. 1:1 room topology + chime-in model

**The model (design R1-R7, L600-696; facts §A).** Every room is a **1:1 between two principal voices**, plus bounded **point-scoped chime-ins** and **observers**:
- **Two principal voices** are the only "seats." The **first open public seat is the RESPONDENT PRINCIPAL seat — NOT a chime-in** (facts §A; this is a doctrine line we must never blur).
- **Chime-ins** attach to a *point*, do **not** open a seat, and are **public-only** and **bounded** in what they may add: *a source · a clarifying question · a narrower claim · relevant context* (L680-686, L604). "Bounded contribution — attaches to this point, doesn't open a seat." (L689). They are *never* a third principal voice (L608: "The two principal voices stay primary.").
- **Public 1:1** — observers may watch; chime-ins are allowed *once the public 1:1 exists*. **Seats full → observe-only**, but the point ledger stays readable: *"You can keep watching. The point ledger stays open to read."* (L630, R5).
- **Private 1:1** — invited parties only, **no observers, no chime-ins**: *"Invited 1:1. No observers, no chime-ins — the point stays between you and Maya."* (L656, R6). The private selected-node view shows **no chime-in CTA** (L658).
- **Chime-in composer (R7, L669-696)** is point-scoped: it anchors to a specific point ("Chiming in on · Dan's point") and offers the four bounded contribution types plus speak-or-type.

**Repo gap (facts §B).** `argumentRoomCreationMatrix.ts` currently models private = 1v1 cap2, public cap5, one invite, observers ≠ active — but has **no principal-voice vs chime-in distinction**. The "moderator" side is the room host/creator (memory: `moderator-side-is-room-host`), orthogonal to this.

**Cards.**
- **UX-ROOM-1V1-CHIMEIN-001** (P0/L/UX-model/**Case-by-case GATE-C — Yes if backend semantics**) — absorbs the folded `UX-CHIMEIN-001`. This card carries the **semantics-assessment step**: if chime-in / principal-voice changes touch room/seat/submission semantics, a backend-mutation card is split out and operator-gated *before* any DB change (facts §E invariant). UI-only first.
- **UX-ROOM-SEATLINE-001** (P0/M/UI/No-if-UI-only) — the seat-line / "2 seats open" / "seats full · observe-only" presentation and the principal-vs-chime-in role badges (L606, L630).

**Doctrine guard (visible-copy ban):** never imply "first open public seat is a chime-in"; never imply "chime in" applies in private rooms.

---

## 6. Argument node + selected-node model

**The node card (component inventory L897):** author, kind dot, body, and **exactly one state chip**. The selected-node panel (L898, S3 anatomy L786-813) has five labeled parts:
1. **Role badge** — *not a state* (principal voice / respondent seat / observer / chime-in). "These are badges, not the primary structural chip. They never occupy the one-state slot." (L843-844).
2. **Responding-to anchor** — parent excerpt on the indigo `--act-bd` rail (L796).
3. **Node body** — primary reading text, set in Newsreader (L799).
4. **One primary structural state** — the single chip, optionally with axis suffix ("Needs evidence · fact", L802).
5. **Act / Inspect / Go dock** — *Act dominant* (one obvious primary), Inspect + Go touch-safe secondary (L804-807, component L907).

The **Inspect drawer (S4, L815-835)** is where the *other seven signals* live: a "WHY THIS STATE?" rationale, "OTHER STRUCTURE NOTES" (axis, parent relation, evidence debt, manual tags), "WHAT WOULD MOVE THIS FORWARD?" chips, and HISTORY — all plain-language, **no raw machine keys** (L834: "plain-language, no raw keys · UX-MEDIATOR-002 · MCP-K").

**Cards.**
- **UX-SELECTED-NODE-001** (P0/M/UI/No) — the five-part selected-node anatomy + Inspect drawer shell. Cross-refs IX-004 #135, SC-002 #10, SC-004 #63, CARD-VIEW-DETAIL-HUB-001 #517. **Does not subsume** OPEN `CARD-VIEW-DATA-001` #504 (data-loading concern).
- **UX-MEDIATOR-002** (P0/M/UI-model/No) — the *one primary state chip / node markup* that finally **merges `NodeLabelStrip` + `MediatorNodeMarker` into a single 9-state chip** (facts §B gap 3; design before/after L734-784). This is the precedence-collapse card and the keystone of the overhaul.

---

## 7. Mediator board model

**SHIPPED — cross-reference, do NOT re-implement (facts §B; memory `mediator-board-single-derivation`).** The mediator stack is wired on `main`:
- `src/features/mediator/deriveMediatorBoardState.ts` — pure read-only projection; the board is derived **once** in `ArgumentGameSurface` (L683-693) and shared by both the rail and the node markup (reuse, never re-derive).
- `mediatorBoardTypes.ts` — **13 `MediatorStateCode`s** (open / needs_evidence / evidence_blocked / key_detail_unavailable / definition_not_shared / scope_mismatch / missing_mechanism / value_tradeoff / narrowed / off_point / accounts_differ / structured_impasse / resolved_or_settled), a **superset** of the v4 nine (v4 "Missing link" = `missing_mechanism`).
- `MediatorNodeMarker.tsx`, `DisagreementPointsRail.tsx`, `evidenceDebtDisplay.ts`, `definitionScopeBridgeDisplay.ts`, `mediatorPlainLanguage.ts`, `roomMediatorAdapter.ts`.
- Closed predecessors REF-001..006 (#584-589, #599); merged PRs #644-648.

**The v4 delta is two things, not a rebuild:**
1. **Precedence collapse** — stop double-mounting `NodeLabelStrip` + `MediatorNodeMarker`; render one chip from the single derivation (UX-MEDIATOR-002). The design's conflict-resolution table (L864-870) is the precedence spec to validate the derivation against:
   - Needs evidence + Narrowed → **Needs evidence**
   - Definition + Scope → **Definition not shared**
   - Evidence blocked + Needs evidence → **Evidence blocked**
   - Accounts differ + Evidence blocked → **depends on cause**
   - Impasse + any path remains → **not impasse**
   - Chime-in resolves source → **state recomputes**
   - Voice transcript used → **no state change**
2. **Screens for states whose models already exist** (evidence-blocked, definition/scope, impasse, next-move).

**Cards.** UX-MEDIATOR-001 (P0/L/pure-TS/No — derive precedence, validate against L864-870), UX-MEDIATOR-002 (keystone, §6), UX-MEDIATOR-003 (P1/M/model-UI/Case-by-case — evidence-blocked/debt screen, §10), UX-MEDIATOR-004 (P1/M/UI-model/No — definition+scope bridge screen), UX-MEDIATOR-005 (P0/L/UI/No — Disagreement Points rail/sheet vocabulary, §8). All cross-ref REF-001..005 + merged #644-648; **AMEND-on-collision guard**: if any `UX-MEDIATOR-00X` already exists, amend not duplicate (no such issue exists today, facts §D).

---

## 8. Disagreement Points rail

**SHIPPED:** `DisagreementPointsRail.tsx` (collapsed → rail/sheet), plus the 005 Disagreement Points rail and 002 active-node marker on `main` (memory `mediator-board-single-derivation`).

**v4 delta:** the **full mobile Disagreement Points SHEET** (the rail exists; the bottom-sheet expansion does not — facts §B gap 5; design screen 06). Each **disagreement point row** anchors to a node and says *what would move it forward* (component L900). The **evidence debt row** is the "source owed / blocked" variant (L901). On tablet/desktop the rail becomes a persistent right column / col-3 ledger (L430-438, L485, §12). The rail header carries a muted multi-segment progress bar that is **structural, not a score** (L431).

**Card:** UX-MEDIATOR-005 (P0/L/UI/No) — rail vocabulary + the mobile sheet. Visible-copy guard: the segments describe *kinds of unresolved points*, never "ahead / behind / winning."

---

## 9. What would move this forward

This is the central organizing question of the whole product, surfaced two ways:
- In the **Inspect drawer** as a "WHAT WOULD MOVE THIS FORWARD?" chip set (L827).
- As the **"Suggest my next move"** screen (07, L319-325): *"What would move this forward?"* with the sub-line **"The mediator suggests an action — never a belief, winner, or truth."** (L324-325).

**Repo state:** a `MediatorNextAction` type exists; there is **no UI** (facts §B gap 6). **Card: UX-NEXT-MOVE-001** (P1/M/pure-TS-UI/No). Cross-refs ST-002 #13, GAL-002 #31, REF-004 #587, UX-001.4 #290. **Does not subsume** `CARD-VIEW-DATA-001` #504. Operator open question #2 (L936): is UX-NEXT-MOVE net-new or an extension of mediator/standing work? — recorded in §18, resolved by the operator before build.

---

## 10. Structured impasse taxonomy (the 9 states)

The design's **node-state precedence table (L713-729)** is *impasse-first* and defines one primary state per node, in deterministic priority order. Each carries a "must not imply" guard and a primary move:

| Pri | State | Use when · must NOT imply | Primary move |
|---|---|---|---|
| 1 | **Structured impasse** | Form followed; no current pathway remains; disagreement preserved. *Never implies failure, deadlock, or a loser.* | **Save this resolution** (reopen w/ source · definition · narrower claim) |
| 2 | **Evidence blocked** | The record that would test the point is unavailable/inaccessible now. *Never implies someone is hiding evidence.* | **Mark evidence unavailable** (name artifact · branch provable part) |
| 3 | **Accounts differ** | Dispute turns on incompatible recollections that can't currently be tested. *Never implies lying or memory failure.* | **Separate account from record** (ask for record · narrow to shared facts) |
| 4 | **Definition not shared** | Same key term used two ways; no shared definition yet. *Wins over scope — shared terms usually unlock scope.* | **Define the key term** (propose a shared definition) |
| 5 | **Scope mismatch** | Reply addresses a broader/narrower/different claim than the point. *Never implies evasion or bad faith.* | **Narrow the claim** (respond to exact point · branch) |
| 6 | **Missing link** | Reasoning depends on an unstated mechanism/bridge premise/causal step. *Never implies the claim is false.* | **Ask for the missing step** (add mechanism · clarify chain) |
| 7 | **Needs evidence** | Point can move forward with a source/quote/record/detail. *Never implies the claim is currently wrong.* | **Ask for a source** (add evidence · mark unavailable) |
| 8 | **Narrowed** | A broad clash reduced to a smaller disagreement; a progress state. *Does not override a stronger unresolved blocker (moves to history).* | **Continue on remaining point** (mark clarified · branch remainder) |
| 9 | **Open** | Default — no stronger state applies. *Neutral; not "unanswered" or "weak".* | **Respond to this point** (ask for source · narrow · branch) |

**Mapping to the shipped 13 codes:** v4 "Missing link" = `missing_mechanism`. The shipped vocabulary additionally carries `key_detail_unavailable`, `value_tradeoff`, `off_point`, `resolved_or_settled` — a superset; UX-MEDIATOR-001 must map the 13 → the 9 visible states deterministically. Whether the **9-state vocabulary is final** is operator open question #6 (L940), recorded in §18.

**The Structured impasse screen (09, L374-396)** is the dignified endpoint: *"Nothing new is available to test this point right now. The disagreement is preserved — not lost, and not decided."* (L382). The state + type exist; **the full screen does not** (facts §B gap 8). **Card: UX-IMPASSE-001** (P1/M/model-UI-copy/No). Cross-refs GAME-001 #64, GAME-007 #146. The state code already exists in `mediatorBoardTypes.ts`; this card builds the screen + the "Save this resolution / reopen path" affordance, never a "loser" framing.

---

## 11. Feedback / clarity progress (no likes, no scores)

**Design screen 08 (L8, component L908):** a **feedback chip row** for **clarity ratings, never likes or popularity**. This directly replaces the still-shipping de-score targets: `ArgumentScoreTracker.tsx:33/39`, `ComposerValidationPanel.tsx:150-151`, and `gameCopy` STATUS strings "Currently ahead" / "More supported" (facts §C).

**Card: UX-FEEDBACK-001** (P1/M/UI-copy/No). Cross-refs MCP-008 #158. **The deferred `UX-CLARITY-RATING-001`** (P2) is *not* a distinct package screen — its intent is **folded into UX-FEEDBACK-001** (facts §D DEFER). Doctrine: no likes, no heat, no popularity, no "ahead/behind," no truth value — clarity progress only (facts §E). Operator open question #2 (L936): net-new vs extension — recorded in §18.

---

## 12. Speech-first path + relationship to the VOICE slate

**Design screens 04/05 (speech composer · listening; post-response progress) and the chime-in composer R7.** The composer is **voice-first with text fallback** (component L904); the **waveform is amplitude-only mic feedback — no analysis, no playback** (L905); the **transcript review box is editable and the user owns the final text** (L906).

**Hard doctrine (facts §E, design L938, L946, L856):**
- Waveform = mic-active amplitude feedback, **never credibility**.
- **Raw audio is never stored, uploaded, replayed, or sent to MCP.** Speech persistence is *transcript text only*, optionally plus a stored *amplitude envelope* for a static waveform (operator open question #4, L938 — must be confirmed).
- Text-only fallback at **every** entry window; permission denial **never** blocks posting.
- Voice / waveform / transcript is the **drafting path only** — it appears in history/provenance, **never as the primary state** (L856; conflict table "Voice transcript used → no state change", L870).

**Repo state:** **zero shipped React voice components** — only VOICE docs/ADR (facts §B gap 1). The composer seam already exists: `OneBox.tsx` hosted in `ArgumentComposerDock.tsx` (sheet < 720 / side-panel ≥ 720), posting via `submit-argument` (facts §B). The speech composer plugs into this seam; it is **not a new submission path**.

**Relationship to the VOICE slate — AMEND, never duplicate (facts §D).** The speech-first work is owned by the existing **OPEN VOICE issues #658–671**. This roadmap **posts the canonical "CivilDiscourse v4 design package update" comment** to each (never a duplicate issue):
- VOICE-ADR-001 #658, VOICE-001 #659, VOICE-002 #660, VOICE-003 #661, VOICE-004 #662, VOICE-005 #663, VOICE-006 #664, VOICE-007 #665, VOICE-008 #666, VOICE-009 #667, VOICE-010 #668, MCP-K-001 #669, MCP-K-002 #670, AUDIO-001 #671.
- Design's own mapping: screen 04 → VOICE-007/008; 05 → UX-MEDIATOR-002 / VOICE-009; speech artifact persistence → VOICE-009; Family K speech/waveform observations → MCP-K-001/002 (L922-924).
- The folded **UX-VOICE-HANDOFF-001 → AMEND VOICE-009 #667 (+ VOICE-008 #666)** (facts §D FOLD).

**Family K (MCP-K)** is net-new (facts §B gap 11) and lives entirely in the AMEND lane on #669/#670; it carries **GATE-C deploy coupling** (MCP boolean/prompt changes are deploy-bearing per memory `mcp-server-deno-deploy`) and is **not** filed as a new UX card here.

---

## 13. Tablet / desktop expansion

**Design "Tablet & desktop" (L399-446):** "same system, more revealed at once." Progressive disclosure on mobile becomes side-by-side context on larger screens; the composer dock stays anchored to the selected point (L404).
- **Tablet 768 (L408-442)** — two-pane mediator room: center timeline + selected-node + anchored composer dock; right **272px Disagreement Points rail**.
- **Desktop 1440 (L444+)** — **three-column board: path · node + composer · ledger** (L446). Col 3 is the Disagreement Ledger as a persistent column (L485).

**Operator open question #5 (L939):** does the desktop col-3 ledger **replace** the existing side action rail, or **coexist** with it? (Note: `ArgumentSideActionRail` is already de-scoped, entries folded into Act — facts §B.) Recorded in §18.

**Card:** UX-RESPONSIVE-V4-001 (P0/M/UI-responsive/No). Cross-refs UX-001.6 #294, BR-004 #143, plus the live mobile-overflow context (#654; memory `mobile-responsive-overflow-causes` — reuse `useHeaderBreakpoint`/`resolveBand`/`TOUCH_TARGET(44)`, do not re-derive breakpoints).

---

## 14. Accessibility / responsive

Governed by Skill `accessibility-targets`. Requirements pulled from the design and doctrine:
- **Tap targets ≥ 44px** (Act dock min-heights 46–54px already in the comp; memory `TOUCH_TARGET(44)`).
- **Color independence** — every state must be distinguishable without color (state name + dot shape; axis dots are muted equal-weight, never red/green — L42, L946). The dignified-impasse chip uses an *outline* dot, not a fill, reinforcing shape-not-color (L70, L713).
- **Reduce-motion** (operator open question #7, L941): waveform + selected-node glow must **degrade to static**; amplitude-only must still read as "mic active." `roomEnergy: Hushed` (`--wf-dur 7s` etc.) is the near-static path (L975, L1007).
- **Screen-reader contract** — the one state chip exposes its plain-language state + primary move; Inspect exposes the rationale; role badges are announced as role, not state.

**Card:** UX-ACCESSIBILITY-001 (P1/M/UI-test/No). Cross-refs IX-003 #22, SC-005 #112.

---

## 15. Implementation tracks (A–G)

| Track | Theme | Cards | GATE-C |
|---|---|---|---|
| **A — Foundation & docs** | Design package of record, sequence plan, doctrine copy tests | UX-DESIGN-PACKAGE-001, UX-OVERHAUL-SEQUENCE-001, UX-COPY-DOCTRINE-001 | No |
| **B — Brand & copy** | Visible CivilDiscourse, taglines, first-run, assets, tokens | UX-COPY-001, UX-BRAND-ASSETS-001, UX-TOKENS-001 | Copy No; assets case-by-case |
| **C — Mediator core** | Precedence derivation + one-chip collapse + selected node | UX-MEDIATOR-001, UX-MEDIATOR-002, UX-SELECTED-NODE-001 | No |
| **D — Mediator surfaces** | Evidence-blocked, definition/scope, points rail+sheet | UX-MEDIATOR-003, UX-MEDIATOR-004, UX-MEDIATOR-005 | 003 case-by-case |
| **E — Room topology** | 1:1 principals + chime-ins, seat line | UX-ROOM-1V1-CHIMEIN-001, UX-ROOM-SEATLINE-001 | Room model case-by-case (Yes if backend semantics) |
| **F — Guidance screens** | Next-move, structured impasse, clarity feedback | UX-NEXT-MOVE-001, UX-IMPASSE-001, UX-FEEDBACK-001 | No |
| **G — Cross-cutting quality** | Responsive (tablet/desktop), accessibility, test harness | UX-RESPONSIVE-V4-001, UX-ACCESSIBILITY-001, UX-TEST-001 | UX-TEST operator-gated if auth |
| **VOICE (AMEND lane)** | Speech-first composer + persistence + Family K | AMEND #658–671 (incl. MCP-K-001/002) | Yes (VOICE-002 backend; MCP-K Deno deploy) |

---

## 16. Card table

20 net-new FILE cards + 3 FOLD + 1 DEFER + the VOICE/MCP-K AMENDs. Fields per facts §F. All FILE cards carry `epic:civildiscourse-v4` (label, not a Project single-select option — adding an option wipes assignments, memory `projectv2-field-option-destructive`).

| # | Card | Disposition | Pri | Effort | Lane | GATE-C | Track | Key cross-refs |
|---|---|---|---|---|---|---|---|---|
| 1 | UX-DESIGN-PACKAGE-001 | FILE | P0 | S | docs | No | A | UX-001.7 #296, UX-001.1 #284 |
| 2 | UX-COPY-001 (absorbs first-run) | FILE | P0 | M | UI-copy | No (defer identity) | B | COPY-001 #71, QOL-035 #204 |
| 3 | UX-COPY-DOCTRINE-001 | FILE | P0 | S | copy-test | No | A | RULE-007 #145, QOL-035 #204, REF-ADR-001 #590 |
| 4 | UX-BRAND-ASSETS-001 | FILE | P0 | M | UI-assets | Case-by-case | B | BRAND-001 #46, BRAND-003 #139, UX-001.1 #284, NAV-START-ARGUMENT-001 #524 |
| 5 | UX-TOKENS-001 | FILE | P1 | S | UI-tokens | No | B | VG-003 #6, UX-001.7 #296 |
| 6 | UX-ROOM-1V1-CHIMEIN-001 (absorbs chime-in) | FILE | P0 | L | UX-model | Case-by-case (Yes if backend semantics) | E | GAME-004 #141, GAME-005 #142, GAME-006 #144, BR-004 #143 |
| 7 | UX-ROOM-SEATLINE-001 | FILE | P0 | M | UI | No-if-UI-only | E | GAME-005 #142, ARG-ROOM-005 #616 |
| 8 | UX-MEDIATOR-001 | FILE | P0 | L | pure-TS | No | C | REF-001 #584, REF-ADR-001 #590, merged #644-648 |
| 9 | UX-MEDIATOR-002 | FILE | P0 | M | UI-model | No | C | REF-002 #585, merged #644-648 |
| 10 | UX-MEDIATOR-003 | FILE | P1 | M | model-UI | Case-by-case | D | REF-003 #586 |
| 11 | UX-MEDIATOR-004 | FILE | P1 | M | UI-model | No | D | REF-004 #587 |
| 12 | UX-MEDIATOR-005 | FILE | P0 | L | UI | No | D | REF-006-RAIL #599, REF-005 #588 |
| 13 | UX-SELECTED-NODE-001 | FILE | P0 | M | UI | No | C | IX-004 #135, SC-002 #10, SC-004 #63, CARD-VIEW-DETAIL-HUB-001 #517 (does NOT subsume #504) |
| 14 | UX-NEXT-MOVE-001 | FILE | P1 | M | pure-TS-UI | No | F | ST-002 #13, GAL-002 #31, REF-004 #587, UX-001.4 #290 (does NOT subsume #504) |
| 15 | UX-IMPASSE-001 | FILE | P1 | M | model-UI-copy | No | F | GAME-001 #64, GAME-007 #146 |
| 16 | UX-FEEDBACK-001 | FILE | P1 | M | UI-copy | No | F | MCP-008 #158 (folds UX-CLARITY-RATING-001 intent) |
| 17 | UX-RESPONSIVE-V4-001 | FILE | P0 | M | UI-responsive | No | G | UX-001.6 #294, BR-004 #143, #654 live context |
| 18 | UX-TEST-001 | FILE | P1 | L | test-harness | Operator-gated if auth | G | AN-002 #35, REF-006 #589 (sibling — do NOT fold human protocol) |
| 19 | UX-ACCESSIBILITY-001 | FILE | P1 | M | UI-test | No | G | IX-003 #22, SC-005 #112 |
| 20 | UX-OVERHAUL-SEQUENCE-001 | FILE | P0 | S | docs-PM | No | A | — |
| F1 | UX-CHIMEIN-001 | FOLD → #6 | — | — | — | — | E | folded into UX-ROOM-1V1-CHIMEIN-001 |
| F2 | UX-FIRST-RUN-001 | FOLD → #2 | — | — | — | — | B | TL-002 #2, DEMO-001 #602; folded into UX-COPY-001 |
| F3 | UX-VOICE-HANDOFF-001 | FOLD → AMEND VOICE-009 #667 (+ VOICE-008 #666) | — | — | — | — | VOICE | folded into VOICE amend |
| D1 | UX-CLARITY-RATING-001 | DEFER (P2; not filed) | P2 | — | — | — | F | intent folded into UX-FEEDBACK-001 |
| A1 | VOICE-ADR-001..VOICE-010, MCP-K-001/002, AUDIO-001 (#658–671) | AMEND (canonical comment, never duplicate) | — | — | VOICE | Yes (VOICE-002 backend; MCP-K Deno deploy) | VOICE | design 04→VOICE-007/008, 05→VOICE-009, MCP-K→#669/#670 |

**Labels per FILE card:** `priority:p0/p1/p2`, `effort:s/m/l/xl`, `ux`, `epic:civildiscourse-v4`, plus `design-only` (docs cards 1/20), `area:docs` (1/3/20), `area:testing` (18/19), `gated` (any case-by-case/Yes GATE-C). Project #1: Phase = Backlog; Priority / Effort / Area set per row.

---

## 17. Dependency DAG (slate §16, validated)

```
A (foundation, no deps)
  UX-DESIGN-PACKAGE-001 ──► UX-OVERHAUL-SEQUENCE-001
  UX-COPY-DOCTRINE-001  ──► (gates the de-score/ban-clean acceptance of every copy card)

B (brand/copy)
  UX-TOKENS-001 ──► UX-MEDIATOR-002, UX-SELECTED-NODE-001, UX-RESPONSIVE-V4-001  (tokens before chrome)
  UX-COPY-001  ◄── (absorbs UX-FIRST-RUN-001)
  UX-BRAND-ASSETS-001 ──► UX-COPY-001 (lockup before first-run polish)

C (mediator core — the spine)
  UX-MEDIATOR-001 (pure-TS precedence) ──► UX-MEDIATOR-002 (one-chip collapse) ──► UX-SELECTED-NODE-001
                                       └─► UX-MEDIATOR-005 (rail uses same single derivation)

D (mediator surfaces, depend on core)
  UX-MEDIATOR-001 ──► UX-MEDIATOR-003, UX-MEDIATOR-004
  UX-MEDIATOR-002 ──► UX-MEDIATOR-005

E (room topology)
  UX-ROOM-1V1-CHIMEIN-001 (model + semantics assessment) ──► UX-ROOM-SEATLINE-001
   └─(if backend semantics)─► [operator-gated backend-mutation card, split out]

F (guidance screens, depend on core + models)
  UX-MEDIATOR-001 ──► UX-NEXT-MOVE-001
  UX-MEDIATOR-001 ──► UX-IMPASSE-001
  UX-COPY-DOCTRINE-001 ──► UX-FEEDBACK-001 (de-score precondition)

G (cross-cutting, last)
  C + D + E + F ──► UX-RESPONSIVE-V4-001 ──► UX-ACCESSIBILITY-001 ──► UX-TEST-001

VOICE (AMEND lane, parallel; gated)
  VOICE-003 / VOICE-004 (pure-TS) ──► VOICE-002  ◄── per VOICE-PATCH-001 ("pure-TS before VOICE-002")
  VOICE-007/008 (speech composer) plug into the shipped OneBox/ArgumentComposerDock seam
  VOICE-009 (persistence: transcript + amplitude envelope, NO raw audio)
  MCP-K-001/002 (Family K) — Deno-deploy-bearing GATE-C
```

**Validated ordering note (VOICE-PATCH-001):** the pure-TS VOICE-003 / VOICE-004 land **before** VOICE-002, because VOICE-002 consumes their models. Recorded here so the AMEND comments preserve that order.

**Critical path:** UX-MEDIATOR-001 → UX-MEDIATOR-002 → UX-SELECTED-NODE-001 / UX-MEDIATOR-005, with UX-TOKENS-001 as a B-track prerequisite for the chrome. Everything in F depends on UX-MEDIATOR-001 being settled (it owns the 13→9 mapping + precedence).

---

## 18. GATE-C matrix

| Card | GATE-C | Why / what triggers it |
|---|---|---|
| UX-DESIGN-PACKAGE-001 | No | docs only |
| UX-COPY-001 | No (defer identity) | visible copy only; `package.json`/`app.json`/`EXPO_PUBLIC_`/domain/project-ref DEFERRED to a separate operator-gated migration |
| UX-COPY-DOCTRINE-001 | No | copy/ban-clean tests only |
| UX-BRAND-ASSETS-001 | Case-by-case | asset add/recolor; aspect ratio preserved, no recolor (L91) — gate only if it touches build/icon config |
| UX-TOKENS-001 | No | additive tokens |
| UX-ROOM-1V1-CHIMEIN-001 | **Case-by-case — Yes if backend semantics** | UI-only first; **any room/seat/chime-in/submission semantics change splits out a separate operator-gated backend card** (facts §E invariant) |
| UX-ROOM-SEATLINE-001 | No-if-UI-only | gate only if seat counting moves into backend |
| UX-MEDIATOR-001 | No | pure-TS |
| UX-MEDIATOR-002 | No | UI/model render of existing derivation |
| UX-MEDIATOR-003 | Case-by-case | gate only if evidence-blocked introduces a new write/Edge path |
| UX-MEDIATOR-004 | No | UI/model |
| UX-MEDIATOR-005 | No | UI |
| UX-SELECTED-NODE-001 | No | UI |
| UX-NEXT-MOVE-001 | No | pure-TS + UI; **MCP must never be the submission gate** (facts §E) |
| UX-IMPASSE-001 | No | model+UI+copy |
| UX-FEEDBACK-001 | No | UI+copy; no new scoring write |
| UX-RESPONSIVE-V4-001 | No | UI responsive |
| UX-TEST-001 | **Operator-gated if auth** | live/authed harness needs operator credentials; REF-006 #589 human protocol stays separate |
| UX-ACCESSIBILITY-001 | No | UI+test |
| UX-OVERHAUL-SEQUENCE-001 | No | docs/PM |
| VOICE-002 (AMEND) | **Yes** | backend persistence path |
| MCP-K-001/002 (AMEND) | **Yes** | Deno-deploy-bearing (memory `mcp-server-deno-deploy`); new MCP booleans/prompts gate on hosted `*.deno.net` smoke |

**Universal acceptance invariant (every card restates the relevant subset):** *"AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."* (facts §E).

---

## 19. Automerge matrix

| Card class | Automerge default | Condition |
|---|---|---|
| Docs-only (UX-DESIGN-PACKAGE-001, UX-OVERHAUL-SEQUENCE-001) | **Yes** | green CI; no deploy coupling |
| Copy / token / UI pure (UX-COPY-DOCTRINE-001, UX-TOKENS-001, UX-COPY-001, UX-MEDIATOR-002/004/005, UX-SELECTED-NODE-001, UX-NEXT-MOVE-001, UX-IMPASSE-001, UX-FEEDBACK-001, UX-ROOM-SEATLINE-001, UX-RESPONSIVE-V4-001, UX-ACCESSIBILITY-001) | **Yes** | fully green post-smoke/review/adversarial; typecheck+lint+test clean (memory `auto_merge_green_prs`) |
| Pure-TS model (UX-MEDIATOR-001) | **Yes** | green + 100% branch coverage on any transition logic |
| Case-by-case GATE-C (UX-BRAND-ASSETS-001, UX-ROOM-1V1-CHIMEIN-001, UX-MEDIATOR-003) | **No — operator gate** | hold if the card resolves into backend semantics / build config / new Edge path |
| Operator-gated (UX-TEST-001 if authed) | **No** | needs operator credentials |
| AMEND lane (VOICE-002, MCP-K-001/002) | **No — HARD STOP** | deploy-bearing GATE-C; pipeline-governance never-self-approve (deploy / Deno redeploy / hosted smoke) |

Default posture: green UI/copy/model PRs squash-merge immediately unless the original card says HARD STOP or the GATE-C cell is Yes (memory `auto_merge_green_prs`, `pipeline-governance-contract`).

---

## 20. Risks + the 7 operator open questions

**Risks.**
1. **Precedence-collapse regression.** Merging `NodeLabelStrip` + `MediatorNodeMarker` (UX-MEDIATOR-002) could drop a signal users relied on. Mitigation: the conflict-resolution table (L864-870) is the test oracle; the dropped signals must all be reachable in Inspect (L827); the board must stay derived **once** and shared (memory `mediator-board-single-derivation`).
2. **Room-topology scope creep into backend.** UX-ROOM-1V1-CHIMEIN-001 is the one card that can cross into semantics. Mitigation: semantics-assessment step precedes any DB change; backend split out + operator-gated (facts §E).
3. **Speech doctrine breach.** Any path that stores/uploads/replays raw audio, or lets the waveform imply credibility, is a hard doctrine violation. Mitigation: VOICE AMENDs restate the no-raw-audio + amplitude-only + text-fallback + permission-never-blocks invariants; persistence = transcript + amplitude envelope only (pending operator confirmation, Q4).
4. **Brand/identity over-reach.** Renaming `app.json` slug / project-ref in a UI card would break deploy + auth. Mitigation: visible copy only; identity migration is a separate operator-gated card (facts §C, L91).
5. **Forbidden-copy reappearance.** The de-scored strings ("score / ahead / more supported / wrong / honest / Just get to the bottom of it") could reappear. Mitigation: UX-COPY-DOCTRINE-001 is a *test* card (ban-list assertion) and is a precondition for the copy/feedback cards.
6. **MCP-K deploy chain.** Family K booleans are Deno-deploy-bearing; a merge that skips the hosted smoke regresses live (memory `mcp-server-deno-deploy`, `mcp-build2-stack-pilot-order-and-smoke-gap`). Mitigation: HARD STOP automerge; per-family new-rawKey smoke.
7. **Reduce-motion / a11y gaps** in the waveform and selected-node glow (Q7). Mitigation: UX-ACCESSIBILITY-001 owns the static degrade + color-independence checks.

**The 7 operator open questions (record verbatim intent; resolve before the dependent card builds) — design L935-941 / facts §A:**
1. **Room internals color** — unify on warm `#08060F` BRAND black, or keep cooler `#020617` SURFACE family for the timeline? → blocks UX-TOKENS-001 final.
2. **UX-FEEDBACK / UX-NEXT-MOVE net-new or extensions** of existing mediator/standing work? → affects scoping of cards 14/16.
3. **One-state collapse rule** — exactly how lifecycle + manual + classifier signals collapse to one state (precedence)? → owned by UX-MEDIATOR-001/002; L864-870 is the proposed answer, needs sign-off.
4. **Speech persistence** — transcript text only + stored amplitude envelope, **no raw audio** — confirm per doctrine. → blocks VOICE-009.
5. **Desktop col-3 ledger** — replace the side action rail (already de-scoped) or coexist? → blocks UX-RESPONSIVE-V4-001 desktop layout.
6. **Is the 9-state vocabulary final?** (Open · Needs evidence · Definition not shared · Scope mismatch · Missing link · Narrowed · Evidence blocked · Accounts differ · Structured impasse.) → blocks UX-MEDIATOR-001 13→9 mapping freeze.
7. **Reduce-motion** — waveform + selected-node glow degrade to static; amplitude-only still reads as "mic active." → blocks UX-ACCESSIBILITY-001 sign-off.

---

## 21. Recommended next cards

In dependency order, the build should open with:
1. **UX-DESIGN-PACKAGE-001** + **UX-OVERHAUL-SEQUENCE-001** (A — make the package the record of truth; lock sequence). Docs-only, automergeable.
2. **UX-COPY-DOCTRINE-001** (A — land the ban-list test *first* so every later copy card is gated by it).
3. **UX-TOKENS-001** (B — fonts, `#1C1730`, axis-dot oklch; prerequisite for all v4 chrome).
4. **UX-COPY-001** (B — kill the "Just get to the bottom of it" tagline; collapse visible CDiscourse → CivilDiscourse; first-run copy). Highest user-visible doctrine win.
5. **UX-MEDIATOR-001 → UX-MEDIATOR-002** (C — the precedence-collapse spine; resolves operator Q3/Q6).
6. **UX-SELECTED-NODE-001** + **UX-MEDIATOR-005** (C/D — selected-node anatomy + Disagreement Points rail/sheet on the single derivation).

Parallel, non-blocking: post the **canonical CivilDiscourse v4 design-package-update comment** to VOICE-ADR-001..AUDIO-001 (#658–671), preserving the VOICE-003/004-before-VOICE-002 order (VOICE-PATCH-001). Hold UX-ROOM-1V1-CHIMEIN-001 until operator Q1/Q3 and the semantics-assessment outcome are in; hold all AMEND/MCP-K deploy-bearing work behind the HARD STOP gate.

---

*Doctrine held (design L946): no winner/loser · no AI judge · no truth verdict · no person labels · no "fallacy" · no emotion/intent inference · no likes/heat · no red/green · waveform = amplitude only, never credibility · Mark the point, not the person.*
