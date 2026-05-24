# Post-Interaction-Epic Roadmap Reconciliation — 2026-05-24

> **Supersedes:** [`2026-05-23-post-slate-reconciliation.md`](./2026-05-23-post-slate-reconciliation.md). The prior report covered state up to 2026-05-23. This report covers all state changes since then, including the completion of the Interaction epic for Release 6.7 (QOL-038 / QOL-040 / QOL-039 shipped on 2026-05-24) and the supporting OPS-001 / QOL-041 / QOL-041.1 / QOL-041.2 / band-space-rent verification work.
>
> **Companion document:** [`2026-05-24-deferred-candidate-dispositions.md`](./2026-05-24-deferred-candidate-dispositions.md) carries the full working-scope drafts and filed-issue bodies for the five §6 deferred candidates. The companion is referenced from each row of this report's §6 inventory.
>
> **Why this exists.** Reconciliation only — no production code modified, no migrations or Edge Functions touched, no project-board cards reshaped, no tests changed. The card filed exactly two new GitHub issues (#270 QOL-036.1, #271 QOL-040.3) per the operator-pre-authorised §6 dispositions. This is the verified roadmap snapshot before the next session selects a card.

---

## §1 — Executive summary

- **Main HEAD reconciled:** `9e60310` (QOL-039 squash, PR #268).
- **Snapshot date:** 2026-05-24.
- **Commits since prior reconciliation (`280f2a3` on 2026-05-23 → `9e60310` on 2026-05-24):** 11 commits — 7 implementation cards (`QOL-041` / `QOL-041.1` / `QOL-041.2` / `OPS-001` / `QOL-038` / `QOL-040` / `QOL-039`) and 4 design-pass commits (`design: OPS-001`, `design: QOL-038`, `design: QOL-040`, `design: QOL-039 verification + enrichments`).
- **Test baseline:** 10,393 tests / 414 suites at QOL-039 merge, the value the QOL-039 review (`docs/reviews/QOL-039.md` line 30) recorded. The full-suite run at RECON-001 implementer time reproduced 10,392 tests passing + 1 perf-sensitive assertion in `__tests__/moveMetadataLedger.test.ts` line 1210 (`expect(elapsed).toBeLessThan(60)`) failing at 80ms when the whole suite ran with full Jest parallelism. Re-running that single suite alone is green (49/49 in 1.3 s); the test is a known performance-sensitive assertion that flakes under full-suite parallelism. The reviewer-side baseline is 10,393 passing. RECON-001 ships no test changes; the baseline is preserved.
- **State of post-Interaction-epic work:** The **Interaction epic (Release 6.7) is complete.** All four originally-blocking QOL cards (QOL-038 invite path, QOL-040 notification lifecycle, QOL-039 visibility transitions, QOL-041 concession-acceptance gradient) shipped. OPS-001 codified the migration-bearing reviewer template as the lesson from the QOL-041 deploy chain. QOL-041.1 and QOL-041.2 corrected the QOL-041 migration deploy chain. The Rules-UX epic (Release 6.6) is also substantively complete via QOL-041 + the MCP-MOD slate; only the catalog design-card orphan (#238) and the META-1 cluster (#77, #79, #80) remain in that epic family.
- **Next-epic recommendation:** **See §7.** A note on divergence from the RECON-001 design: the design recommended **EV-003** (Evidence debt tracker) as the next card, but EV-003 has already shipped (issue #16 closed 2026-05-21 with `docs/reviews/EV-003.md` present). Per the design's §EC-5 and §6.3 ("the implementer follows the actual queue, not this design's pre-mapped recommendation, and notes the divergence"), this report records that all P0 and P1 cards in `docs/ux-storyboards/priority-implementation-queue.md` are shipped. The remaining open issues (#8 BR-002, #25 PR-003, #26 PR-004, #77 META-1B, #79 META-1D, #80 META-1E, #238 MCP-CAT-001 design-orphan) are all P2 cards across multiple epics. The recommended next epic is **Evidence (Epic 6)** for continued integration work, with **QOL-036.1 (#270)** as the recommended next card — see §7.

---

## §2 — Inventory

### §2.1 — Cards shipped since 2026-05-23 (Category A)

Category A = shipped through the standard implementer→reviewer→PR→squash-merge pipeline with a `docs/reviews/<CODE>.md` present. The 7 cards below are the new entries since the prior report; each cited review doc was verified to exist before this report was committed.

| Code | Title | Issue # | Closed | PR | Squash SHA | Review doc | Notes |
|---|---|---|---|---|---|---|---|
| **QOL-041** | Concession list + acceptance gradient + fist-bump reaction | #210 | 2026-05-23 | #255 | `a41dd3c` | `docs/reviews/QOL-041.md` | Original migration broke on deploy (column-ambiguity SQLSTATE 42702) — see QOL-041.1 + QOL-041.2 below. |
| **QOL-041.1** | Fix-forward migration — qualify ambiguous `debate_id` in RLS policies | #256 | 2026-05-23 | #257 | `df0a61d` | `docs/reviews/QOL-041.1.md` | New migration that supersedes the ambiguous policy bodies. Later superseded by QOL-041.2's doctrine-scoped in-place edit. |
| **QOL-041.2** | In-place migration recovery (doctrine-scoped exception) | #258 | 2026-05-23 | #259 | `6fcfdbf` | `docs/reviews/QOL-041.2.md` | Doctrine-scoped exception (factual basis: `npx supabase migration list --linked` showed Remote empty for `20260522000012` at 2026-05-23T22:54Z, confirmed at review time). One-time only. |
| **OPS-001** | Strengthen reviewer template for migration-bearing cards | #260 | 2026-05-24 | #262 | `2d91b5a` | `docs/reviews/OPS-001.md` | Codifies the QOL-041 deploy lesson into the reviewer charter — mandatory `npx supabase db reset --linked=false` when Docker available; heightened textual review against four named issue classes when not. |
| **QOL-038** | Invite → signup/auth → argument-room return path | #207 | 2026-05-24 | #264 | `84aeb23` | `docs/reviews/QOL-038.md` | Five-action `manage-room-invite` Edge Function + `argument_room_invites` table + RLS. Native deep-link path deferred (review Suggestion #2); web path shipped. |
| **QOL-040** | Invite & response notification lifecycle | #209 | 2026-05-24 | #266 | `7f2d2cd` | `docs/reviews/QOL-040.md` | Ten triggers shipped. `invite_expired_notice` eleventh trigger deferred per operator decision E7.3. Notification preferences deferred per operator decision E7.2 (see §6.1). |
| **QOL-039** | Public ↔ private room visibility transition rules | #208 | 2026-05-24 | #268 | `9e60310` | `docs/reviews/QOL-039.md` | One-way `public → private` only; counts-only audit table; `record-visibility-transition` Edge Function. Moderator-initiated visibility deferred (see §6.2). |

**Doc-only commit since 2026-05-23 (not a Category A shipped card; recorded for completeness):**

- `docs/roadmap/2026-05-23-post-slate-reconciliation.md` — the prior report itself, committed at `280f2a3` on 2026-05-23. Now superseded by this report.

### §2.2 — All open issues (Category C, dependency-ordered)

Category C = genuinely open issues ready for autonomous pipeline work or sequenced operator decision. Reproduced from `gh issue list --state open` at RECON-001 implementer time (after RECON-001's own issue #269 is excluded — it's tracked separately as the card driving this report).

| # | Title | Epic | Priority | Effort | Release | Design doc? | Dependencies / notes |
|---|---|---|---|---|---|---|---|
| #270 | QOL-036.1 - Composition-layer integration for payment-evidence pill state | epic:evidence | P2 | M | 6.7 | No (filed by RECON-001) | Filed 2026-05-24 by this card. Depends on QOL-036 (shipped) + COMP-001 + MCP-CAT-001 (both shipped). See §6.3. |
| #271 | QOL-040.3 - Deep-link node pre-activation via Stage 6.4 entry-hint extension | epic:interaction | P2 | M | 6.7 | No (filed by RECON-001) | Filed 2026-05-24 by this card. Depends on QOL-040 (shipped), Stage 6.4 (shipped), QOL-038 (shipped). See §6.5. |
| #238 | MCP-CAT-001: Binary classifier catalog design and scenario-derived question set | epic:rules-ux | P2 | M | 6.9 | Yes (`docs/designs/MCP-CAT-001.md`) | **Design-orphan**: the implementation shipped via PR #252 (`78e9056`) but PR #252 did not include `Closes #238`. Per prior reconciliation §4.1, operator-judgment closure pending. Preserved here. |
| #80 | META-1E - Cards-detail metadata diff inspector | epic:stack-detail | P2 | M | 6.7 | No | Metadata tooling; admin/operator surface. Carries forward from prior report. |
| #79 | META-1D - Six-month vocabulary review (manual + auto codes) | epic:rules-ux | P2 | S | 6.8 | No | Periodic governance task. Carries forward from prior report. |
| #77 | META-1B - Realtime multi-user manual-tag sync | epic:rules-ux | P2 | M | 6.8 | No | Multi-user collaboration on tags. Carries forward from prior report. Note: "realtime" here means the existing Supabase realtime channel pattern for tag synchronisation, NOT push notifications (per v1 scope guard). |
| #26 | PR-004 - Contact information update | epic:profile | P2 | L | 6.7 | No | Profile editing. Carries forward from prior report. |
| #25 | PR-003 - Avatar upload policy and storage | epic:profile | P2 | L | 6.7 | No | Storage + auth + profile. Carries forward from prior report. |
| #8 | BR-002 - Split-screen branch inspector | epic:branches | P2 | XL | 6.6 | No | Branch UI refinement. Carries forward from prior report. XL effort — operator decision required before sequencing. |

**Total open issues at snapshot:** 9 (excluding RECON-001 #269 itself). Two filed by this card; seven carry forward from the prior report.

### §2.3 — Category counts (definition shape preserved from prior report's §2.3)

| Category | Definition | Count at this snapshot |
|---|---|---|
| **A** | Shipped through standard pipeline with review doc | 97 review docs at `docs/reviews/` (from `/tmp/recon-001-review-docs.txt` line count; +5 vs prior report's ~92 directly verified). +7 new shipped cards from §2.1 (the 5 new review docs since 2026-05-23 are `OPS-001.md`, `QOL-038.md`, `QOL-040.md`, `QOL-041.md`, `QOL-041.1.md`, `QOL-041.2.md`, `QOL-039.md` — actually 7 new docs; the prior report's ~92 number is approximate). |
| **B** | Closed but no review doc — closed via non-standard path or administratively | **10 verified** (QOL-015..QOL-022, QOL-025, QOL-034) — same set as prior report; carries forward unchanged. |
| **C** | Genuinely open and ready for autonomous pipeline work | **9** (2 new from RECON-001 filing: #270, #271; 7 carry-forward: #238, #80, #79, #77, #26, #25, #8). |
| **D** | Referenced in prior reconciliation or chain prompts but never filed | **0 unresolved** at end of this card (was 1 in prior report — COMP-001.1 — now disposed per §6.4). Plus 3 new candidates this card identified and disposed (QOL-040.1, QOL-040.2, QOL-040 §17 deep-link gap → renamed QOL-040.3). 2 of the 5 candidates filed (QOL-036.1 + QOL-040.3); 3 deferred indefinitely (QOL-040.1, QOL-040.2, COMP-001.1). |
| **Orphan-open** | Open issue but implementation shipped through a different code path | **1** (#238 MCP-CAT-001 design card) — unchanged from prior report. |

---

## §3 — Category C dependency-ordered list (next-up sequencing)

Open issues grouped by epic and dependency. Each row cites its issue number per the citation contract.

### §3.1 — Evidence (Epic 6)

- **#270 QOL-036.1 — Composition-layer integration for payment-evidence pill state.** Filed 2026-05-24 by this card. P2 / M / 6.7. Dependencies all shipped (QOL-036 #205, COMP-001 #244, MCP-CAT-001 effective via PR #252). **The recommended next card per §7.**

### §3.2 — Interaction (Epic 8)

- **#271 QOL-040.3 — Deep-link node pre-activation via Stage 6.4 entry-hint extension.** Filed 2026-05-24 by this card. P2 / M / 6.7. Dependencies all shipped (QOL-040 #209, Stage 6.4 shipped, QOL-038 #207). Operator-discretion sequencing.

### §3.3 — Rules-UX (Epic 12)

- **#238 MCP-CAT-001 — Binary classifier catalog design.** Design-phase orphan; PR #252 shipped the implementation but did not close the issue. Per prior report §4.1, operator-judgment closure pending. **Not blocking any current open work.**
- **#77 META-1B — Realtime multi-user manual-tag sync.** P2 / M / 6.8. Operator-discretion.
- **#79 META-1D — Six-month vocabulary review.** P2 / S / 6.8. Operator-discretion governance task.

### §3.4 — Stack-detail (Epic 5)

- **#80 META-1E — Cards-detail metadata diff inspector.** P2 / M / 6.7. Operator-discretion admin/operator surface.

### §3.5 — Profile (Epic 9)

- **#25 PR-003 — Avatar upload policy and storage.** P2 / L / 6.7. Operator-discretion; depends on Profile epic sequencing.
- **#26 PR-004 — Contact information update.** P2 / L / 6.7. Operator-discretion; depends on Profile epic sequencing.

### §3.6 — Branches (Epic 3)

- **#8 BR-002 — Split-screen branch inspector.** P2 / XL / 6.6. Operator-discretion; XL effort warrants its own scoping decision before sequencing.

---

## §4 — Category B operator-review list (verbatim carryover from prior report §4)

Ten verified Category B cards in the QOL range, all in the QOL-015..QOL-026/034 cluster — these pre-date the standard roadmap-implementer/reviewer pipeline. Per the prior report's §4 recommendation, this card does NOT re-investigate; the list is carried forward verbatim.

| Issue # | Title | Assessment (verbatim from prior report) |
|---|---|---|
| #39 | QOL-015 - Admin email delivery validation | Pre-pipeline. Likely shipped via direct work. |
| #40 | QOL-016 - Supabase Auth email + redirect audit | Pre-pipeline. Replaced/superseded by QOL-023 (#109). |
| #41 | QOL-017 - GitHub Projects automation script | Pre-pipeline tooling card. |
| #42 | QOL-018 - Repo-local Claude agent charters | Pre-pipeline tooling card. |
| #43 | QOL-019 - Bot tester prompt refresh | Pre-pipeline. |
| #44 | QOL-020 - Open-room engagement runner patch | Pre-pipeline. |
| #56 | QOL-021 - Fix GitHub CLI binary resolution on Windows | Pre-pipeline tooling fix. |
| #58 | QOL-022 - Install @testing-library/react-native + EV-002 render-tree tests | Pre-pipeline test infra. |
| #136 | QOL-025 - Whole-app button action inventory + no-silent-no-op rule | May have shipped through direct work. |
| #203 | QOL-034 - UX storyboard canon + storyline-narrative-officer skill | Skill + doc work; may have shipped without a dedicated review doc. |

**Recommendation:** Operator inspects each at their discretion to confirm whether the closure represented real completion. None of these blocks current open work. The Category B list is informational — flagging the gap between issue-close and review-doc-present so the pattern is consistent going forward.

### §4.1 — The MCP-CAT-001 (#238) design-card orphan (unchanged disposition)

The prior report's §4.1 identified #238 as a design-phase issue whose implementation shipped via PR #252 but where the issue was never explicitly closed. Disposition was operator-judgment closure. **This report preserves that disposition.** Operator either (a) closes #238 manually as "design realized through PR #252 + the catalog-design doc", or (b) ticks off the design-acceptance checklist explicitly and closes. Low priority — neither blocks any current open work.

---

## §5 — Category D explicit decisions

Five candidates surfaced during the Interaction-epic shipping work or carried forward from the prior report. Each has exactly one disposition. Full working-scope drafts and filed-issue body text live in the companion doc [`2026-05-24-deferred-candidate-dispositions.md`](./2026-05-24-deferred-candidate-dispositions.md).

### §5.1 — QOL-040.1 (notification preferences surface)

**Origin:** `docs/designs/QOL-040.md` §E7.2 (lines 1351–1369). Working name pre-claimed by the QOL-040 design's operator decision E7.2.

**Pressure signal:** absent. **Integration leverage:** low. **Effort estimate:** L. **Working-scope precision:** yes. **Doctrine compliance:** yes.

**Disposition: (b) Defer indefinitely.**

**Rationale (one-paragraph summary; full bullets in dispositions doc §2):** Operator decision E7.2 explicitly authorised indefinite deferral pending real product pressure for preferences. No card depends on preferences; the notification list works without them. Filing now would create a "ready" issue with no demand. Re-promote to (a) when (i) user churn from notification volume, (ii) feature requests for mute/quiet hours, or (iii) email unsubscribe compliance requirement materialises.

**New issue #:** n/a — deferred indefinitely.

### §5.2 — QOL-040.2 (moderator-initiated visibility transitions)

**Origin:** `docs/reviews/QOL-039.md` line 98. The QOL-039 implementation reserved `callerIsModeratorOrAdmin` in the model surface and kept the DB+RLS layer creator-or-mod as defense-in-depth so a future widening is non-breaking.

**Pressure signal:** absent. **Integration leverage:** low. **Effort estimate:** S. **Working-scope precision:** yes. **Doctrine compliance:** yes.

**Disposition: (b) Defer indefinitely.**

**Rationale (full bullets in dispositions doc §3):** No storyboard moment requires moderator-initiated visibility transition. The reserved fields in the model surface mean a future mod-initiated visibility transition can be added in a single S-effort card without breaking changes — there is no architectural cost to deferring. Re-promote to (a) when moderator intervention is needed (e.g. a public room with abusive behaviour the creator won't address).

**New issue #:** n/a — deferred indefinitely.

### §5.3 — QOL-036.1 (payment-evidence pill state from composition signals)

**Origin:** `docs/roadmap/2026-05-23-post-slate-reconciliation.md` §6.1 (highest-leverage integration follow-up row 1).

**Pressure signal:** medium. **Integration leverage:** high. **Effort estimate:** M. **Working-scope precision:** yes. **Doctrine compliance:** yes.

**Disposition: (a) File.**

**Rationale (full bullets + acceptance criteria in dispositions doc §4):** The QOL-036 chain prompt explicitly anticipated this integration ("mutations driving evidence-pill state"); the integration was scoped out of QOL-036's shipped scope (additive metadata only) and is consumable now that MCP-CAT-001 has shipped the four named mutation types. Sets the pattern for the broader composition-layer integration sweep enumerated in the prior report's §6.1.

**New issue #:** **#270** — https://github.com/kyleruff1/cDiscourse/issues/270. Filed 2026-05-24. Labels: `priority:p2`, `effort:m`, `epic:evidence`, `release:6.7`, `area:roadmap`, `area:ux-storyboards`.

### §5.4 — COMP-001.1 (three smoke-surfaced refinement candidates)

**Origin:** `docs/testing-runs/2026-05-23-band-space-rent-smoke-verification.md` lines 81–86 ("Follow-up candidates"). Three candidates: `evidence_applicability_supported` mutation type, `prior_dispute_resolved` mutation type, `sub_axis_resolved` state transition.

**Pressure signal:** low. **Integration leverage:** medium for `sub_axis_resolved`; low for the other two. **Effort estimate:** S per candidate; M for the bundle. **Working-scope precision:** yes for `sub_axis_resolved`; partial for the other two. **Doctrine compliance:** yes.

**Disposition: (b) Defer indefinitely.**

**Rationale (full bullets in dispositions doc §5):** No user-facing breakage; all three are doc-vs-implementation gaps that the smoke verification itself sanctioned as future work. The natural moment to re-evaluate is when the composition-layer integration sweep (post-QOL-036.1) begins — if QOL-036.1 ships and the pattern proves useful, the three COMP-001.1 candidates can be folded into that sweep as a bundle.

**New issue #:** n/a — deferred indefinitely.

### §5.5 — QOL-040.3 (deep-link node pre-activation via Stage 6.4 entry-hint extension)

**Origin:** `docs/designs/QOL-040.md` §17 + `docs/reviews/QOL-040.md` Suggestion #1 (lines 112–113). Honestly disclosed by the QOL-040 implementer.

**Working name re-labelling.** The launch prompt and the QOL-040 review used "QOL-040.2" for this candidate. **QOL-040.2 was already claimed** by the moderator-initiated-visibility candidate (§5.2). To prevent collision, RECON-001 re-labels this candidate **QOL-040.3**. This decision is recorded both here and in the filed issue body so a fresh reader of either surface sees the rationale.

**Pressure signal:** low. **Integration leverage:** medium. **Effort estimate:** M. **Working-scope precision:** yes. **Doctrine compliance:** yes.

**Disposition: (a) File.**

**Rationale (full bullets + acceptance criteria in dispositions doc §6):** Both the implementer (in source-code comment at `App.tsx` lines 111–113) and the reviewer (Suggestion #1) explicitly identified the gap. The Stage 6.4 entry-hint extension is additive and benefits every future deep-link consumer, not just notifications. Filing now means the next time a notification user-experience issue arises, the operator has a ready card to promote rather than re-extrapolating from the QOL-040 source-code comment.

**New issue #:** **#271** — https://github.com/kyleruff1/cDiscourse/issues/271. Filed 2026-05-24. Labels: `priority:p2`, `effort:m`, `epic:interaction`, `release:6.7`, `area:roadmap`, `area:ux-storyboards`.

### §5.6 — Summary table

| # | Candidate | Working name | Disposition | New issue # |
|---|---|---|---|---|
| §5.1 | Notification preferences surface | QOL-040.1 | (b) Defer indefinitely | n/a |
| §5.2 | Moderator-initiated visibility | QOL-040.2 | (b) Defer indefinitely | n/a |
| §5.3 | Payment-evidence pill from composition signals | **QOL-036.1** | **(a) File** | **#270** |
| §5.4 | COMP-001.1 three refinements | COMP-001.1 | (b) Defer indefinitely | n/a |
| §5.5 | Deep-link node pre-activation | **QOL-040.3** (re-labelled) | **(a) File** | **#271** |

Two filings; three indefinite deferrals; zero BLOCKs.

---

## §6 — Forward-looking integration opportunities (preserved from prior report §6 with status update)

The composition-layer mutation surface added by MCP-CAT-001 + the COMP-001 base set is consumable by several UI surfaces whose shipped scope did not include consumption (because MCP-CAT-001 had not yet shipped at their merge time). These remain integration follow-ups, not bugs — every listed card works correctly without consuming the mutations. The prior report's §6.1 enumerated the candidates; this card files **QOL-036.1 (#270)** as the strongest of those candidates and defers the rest to organic candidates as related work surfaces.

The full table is preserved in [`2026-05-23-post-slate-reconciliation.md`](./2026-05-23-post-slate-reconciliation.md) §6.1. No additional candidate is filed by RECON-001 beyond QOL-036.1.

---

## §7 — Next-epic identification + recommended next card

### §7.1 — Divergence from the RECON-001 design

The RECON-001 design (`docs/designs/RECON-001.md` §5.4) recommended **EV-003 (Evidence debt tracker)** as the next card. At implementer time, EV-003 was verified to be **already shipped** — issue #16 closed on 2026-05-21 with `docs/reviews/EV-003.md` present (the review doc was added pre-recon-cutoff but the design's §5.2 walk missed it). Per the design's §EC-5 and §6.3 ("the implementer follows the actual queue, not this design's pre-mapped recommendation, and notes the divergence in §6"), this report follows the live queue.

### §7.2 — Methodology applied to live state

Per the design's §5.1 methodology:

1. **Priority queue walk** (`docs/ux-storyboards/priority-implementation-queue.md`):
   - **P0 — Foundation / unblockers** — all shipped: P0-1 QOL-035 (PR #253), P0-2 IX-001 (#20, shipped 2026-05-21), P0-3 QOL-030 (#199, shipped 2026-05-22), P0-4 GAME-003B (covered by GAME-003 stub), P0-5 (standing guardrail — always-on, not a build item).
   - **P1 — Entry gallery / argument discovery** — all shipped: GAL-002 (#31, shipped 2026-05-19), IX-001 (#20, shipped 2026-05-21), QOL-031 (#200, shipped 2026-05-22), QOL-032 (#201, shipped 2026-05-22), QOL-033 (#202, shipped 2026-05-22).
   - **P1 — One-box composer (P1-C1..C4)** — all shipped: QOL-030 (#199), QOL-031..033 (#200, #201, #202).
   - **P1 — Timeline / node interaction (P1-T1..T3)** — covered by stage history (TL-001..003, BR-003/004 shipped earlier; remaining items are polish follow-ups, not blocking the next epic).
   - **P1 — Evidence and source-chain UX (P1-E1..E3)** — all shipped: P1-E1 EV-003 (#16, shipped 2026-05-21), P1-E2 QOL-036 (#205, shipped 2026-05-21), P1-E3 QOL-037 (#206, shipped 2026-05-21).
   - **P2 — Notifications / invite lifecycle (P2-N1, P2-N2)** — both shipped: QOL-038 (#207), QOL-040 (#209).
   - **P2 — Settlement / archival (P2-S1, P2-S2)** — P2-S2 QOL-042 (#211, shipped 2026-05-22); P2-S1 covered by the existing room status model per the queue's notes.
   - **Later — Voting** — out of scope per v1 guard.

2. **Storyboard-to-roadmap map cross-check** (`docs/ux-storyboards/storyboard-to-roadmap-map.md`): All Scenario 1 and Scenario 2 moments are either "Covered" or carry an existing-card row whose card is shipped. No "Missing" rows remain.

3. **Missing-capabilities cross-check** (`docs/ux-storyboards/missing-capabilities-and-issues.md`): The "Summary table" lists 9 "New issue" rows (QOL-034..QOL-042). All 9 are shipped at this snapshot: QOL-034 (review doc absent but Category B per prior report), QOL-035 (#204, shipped), QOL-036 (#205, shipped), QOL-037 (#206, shipped), QOL-038 (#207, shipped), QOL-039 (#208, shipped), QOL-040 (#209, shipped), QOL-041 (#210, shipped), QOL-042 (#211, shipped).

4. **Open-issue cross-check** (`/tmp/recon-001-open-issues.json` + live `gh issue list` re-validation): 9 open issues at snapshot (excluding #269 RECON-001 itself), all P2, spread across multiple epics (Epic 3 Branches, Epic 5 Stack-detail, Epic 6 Evidence, Epic 8 Interaction, Epic 9 Profile, Epic 12 Rules-UX).

### §7.3 — Conclusion: the P0 and P1 blocks are complete

The substantive v1 work tracked by the priority queue is shipped. No P1 card remains open. The remaining 9 open issues are P2 across multiple epics. The natural "next" decision is **operator priority across the P2 surface**, not a mechanical pull from the queue.

### §7.4 — Recommended next card: QOL-036.1 (#270)

**Recommendation rationale.** Among the 9 open P2 issues, **#270 QOL-036.1** is the recommended next card for the following reasons:

- **Filed during this card** as the highest-leverage candidate from the prior reconciliation's §6.1 sweep, with explicit operator-pre-authorisation to file (per the RECON-001 launch prompt).
- **All dependencies shipped:** QOL-036 (#205), COMP-001 (#244), MCP-CAT-001 (effective via PR #252).
- **High integration leverage:** sets the pattern for the broader composition-layer integration sweep that the prior report's §6.1 enumerated (EV-001..005, GAME-004..006, BR-001/003/004, SC-003..005, COMPOSER-001..002, GAL-001..002, SW-002, IX-001..004).
- **Effort M:** single feature, no schema work, no Edge Function change.
- **Doctrine-clean:** deterministic classifier-driven pill state changes; no AI call from production app; no verdict semantics.

**Epic:** Evidence (Epic 6).
**Release:** 6.7.
**Design doc:** to be written (the next designer pass authors `docs/designs/QOL-036.1.md` based on the working scope in `docs/roadmap/2026-05-24-deferred-candidate-dispositions.md` §4.1 and the prior report's §6.1 row).
**Prerequisites:** none beyond shipped state. QOL-036, COMP-001, MCP-CAT-001 are all shipped.

**Alternative paths (operator override candidates).** If the operator prefers a different next direction, the natural alternates are:

- **Profile epic (Epic 9):** #25 PR-003 (avatar storage) → #26 PR-004 (contact info). Two L-effort cards; sequenced after the Profile epic is operator-chosen.
- **Metadata governance (Epic 12 Rules-UX):** #79 META-1D (vocabulary review, S effort) or #77 META-1B (manual-tag sync, M effort) or #80 META-1E (metadata diff inspector, M effort). Operator-discretion governance / tooling work.
- **Branches (Epic 3):** #8 BR-002 (split-screen branch inspector, XL effort). Operator-decision required before sequencing given XL effort.
- **QOL-040.3 (#271):** the other follow-up filed by this card — the deep-link node pre-activation. M effort, Epic 8 Interaction. Same prerequisites as QOL-036.1; can ship in parallel.

The framing here is "based on the priority-queue dependency order as written; operator overrides on launch." Per the design's §R-5 mitigation, the operator's next card-launch prompt is the canonical override mechanism.

---

## §8 — Epic-completion summary

This section names the **completed epic** that closes with this snapshot and confirms the **recommended next epic** with prerequisites and rationale.

### §8.1 — Interaction epic (Release 6.7) — complete

The Interaction epic for Release 6.7 closes with this snapshot. The four originally-blocking QOL cards shipped:

- **QOL-038** (#207, PR #264, squash `84aeb23`) — invite → signup/auth → argument-room return path.
- **QOL-040** (#209, PR #266, squash `7f2d2cd`) — invite & response notification lifecycle (ten triggers).
- **QOL-039** (#208, PR #268, squash `9e60310`) — public ↔ private room visibility transition rules.
- **QOL-041** (#210, PR #255, squash `a41dd3c`) — concession list + 5-level acceptance gradient + fist-bump reaction (with QOL-041.1 + QOL-041.2 migration recovery follow-ups, both shipped).

Supporting operator-discipline work:

- **OPS-001** (#260, PR #262, squash `2d91b5a`) — reviewer template strengthened for migration-bearing cards, codifying the QOL-041 deploy lesson.

The Interaction epic's deferred follow-ups (filed and indefinite) are recorded in §5 above.

### §8.2 — Next epic = Evidence (Epic 6) — continued integration work

**Rationale:**

- The Evidence epic's pure-doctrine baseline (EV-001 evidence object model, EV-002 source-chain popover, EV-003 evidence-debt tracker, QOL-036 payment-evidence metadata, QOL-037 evidence-applicability dispute flow) is fully shipped.
- The next layer of value is **wiring the doctrine baseline into the composition layer** so evidence-pill state transitions fire on classifier mutations rather than only on explicit user-action. This is the "highest-leverage integration follow-up" the prior reconciliation's §6.1 identified.
- QOL-036.1 (#270) is the first concrete card in that integration sweep and is filed by this report.
- The Interaction-epic prerequisites for the Evidence-integration sweep (notification surface for `source_requested` / `evidence_supplied` events, invite-flow for fresh participants) are now satisfied — QOL-040 ships those triggers.

### §8.3 — Recommended next card = QOL-036.1 (#270)

**Card details:**

- **Code:** QOL-036.1
- **Title:** Composition-layer integration for payment-evidence pill state
- **Issue:** https://github.com/kyleruff1/cDiscourse/issues/270
- **Epic:** Evidence (Epic 6)
- **Release:** 6.7
- **Priority / Effort:** P2 / M
- **Design doc:** to be written by the next designer pass. Working scope draft at [`2026-05-24-deferred-candidate-dispositions.md`](./2026-05-24-deferred-candidate-dispositions.md) §4.1.
- **Prerequisites:** none beyond shipped state (QOL-036 #205, COMP-001 #244, MCP-CAT-001 effective via PR #252 — all shipped).

**One-paragraph rationale.** QOL-036.1 is the first concrete card in the post-Evidence-epic-baseline composition-layer integration sweep that the prior reconciliation's §6.1 enumerated. The four named mutation types (`evidence_applicability_disputed`, `corroborating_document_attached`, `evidence_debt_opened`, `evidence_debt_resolved`) are stable in MCP-CAT-001's catalog v1; the QOL-036 payment-evidence pill is shipped and ready to consume them. The card sets a reusable pattern — wire one shipped UI surface to the classifier-driven composition layer — that subsequent cards in the sweep can mirror (EV-001..005, GAME-004..006, BR-001/003/004, SC-003..005, COMPOSER-001..002, GAL-001..002, SW-002, IX-001..004 per the prior report's §6.1 table). Filing was operator-pre-authorised by the RECON-001 launch prompt; the design + acceptance criteria are precise enough for the next designer pass to author the full design doc without re-extrapolation.

### §8.4 — Operator note

The recommendation is mechanical — based on the priority queue + the prior reconciliation's §6.1 sweep map + the shipped-state cross-check. If the operator has a different priority (e.g. Profile epic, or the Branches BR-002 XL scoping decision), the operator's next card-launch prompt is the override mechanism per the design's §R-5 mitigation. No PR amendment to RECON-001 is required to override.

---

*End of post-Interaction-epic reconciliation. Two GitHub issues filed (#270 QOL-036.1, #271 QOL-040.3). Three deferred candidates documented with re-evaluation triggers (QOL-040.1, QOL-040.2, COMP-001.1). Zero BLOCKs. No production code, no migrations, no Edge Functions, no test files touched. Operator next step: review and either accept the §8.3 recommendation by launching QOL-036.1 designer pass, or override by launching a different P2 card.*
