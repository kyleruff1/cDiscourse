# Post-Slate Roadmap Reconciliation — 2026-05-23

> **Superseded by [2026-05-24-post-interaction-epic-reconciliation.md](./2026-05-24-post-interaction-epic-reconciliation.md).**

> **Why this exists.** The autonomous pipeline had been operating against a chain of cards drafted from extrapolated session context rather than from verified roadmap state. The QOL-036 halt confirmed at least one card the chain treated as outstanding had actually shipped two days before MCP-CAT-001. This document is the verified roadmap snapshot before any further pipeline work is proposed. Reconciliation only — no code modified, no issues filed, no project-board changes.

## 1. Executive summary

- **Main HEAD:** `5654703` (docs: band-space-rent smoke verification, PR #254).
- **Date:** 2026-05-23.
- **State of post-slate work:** Cleaner than the chain prompts assumed. The five-card chain (MCP-CAT-001, QOL-035, smoke-verification, QOL-036, QOL-037) treated QOL-036 and QOL-037 as upcoming work, but both shipped on 2026-05-21 via PRs #213 and #214 — **two days before MCP-CAT-001 shipped on 2026-05-23.** Of the four cards I actually drove through the standard pipeline in this session, three shipped cleanly (MCP-CAT-001, QOL-035, smoke verification). QOL-036 and QOL-037 were already done before I started. COMP-001.1 was proposed in chain prompts but never filed as a real issue. The post-MCP-CAT-001 composition-layer integration angle the QOL-036 addendum hinted at is **net-new follow-up work, not in any existing card's scope.**

## 2. Inventory

### 2.1 Chain-referenced cards

| Issue # | Title | State | Closing PR | Squash SHA | Review doc | Category |
|---|---|---|---|---|---|---|
| #238 | MCP-CAT-001: Binary classifier catalog **design** | **OPEN** | none direct | — (impl via #252) | `MCP-CAT-001.md` exists | **Orphan-open** (see §4.2) |
| (none) | MCP-CAT-001 implementation | n/a | #252 | `78e9056` | `MCP-CAT-001.md` | A (effective) |
| #204 | QOL-035 - User-facing terminology scrub | CLOSED | #253 | `f2d07cb` | `QOL-035.md` | A |
| #205 | QOL-036 - Payment / screenshot evidence metadata | CLOSED 2026-05-21 | #213 | `4e27927` | `QOL-036.md` | A |
| #206 | QOL-037 - Evidence applicability dispute flow | CLOSED 2026-05-21 | #214 | `665de3f` | `QOL-037.md` | A |
| #244 | COMP-001 - Deterministic composition layer | CLOSED | #251 | `cc8dab2` | `COMP-001.md` + `COMP-001-IMPL.md` | A |
| (none) | COMP-001.1 (smoke-surfaced refinements) | **NEVER FILED** | — | — | — | D |
| #230–#237 | MCP-MOD-001 through MCP-MOD-008 (8 cards) | All CLOSED | various | various | All 8 review docs present | A (all 8) |

### 2.2 All open issues (entire repo)

| Issue # | Title | Epic | Priority | Effort | Release |
|---|---|---|---|---|---|
| #238 | MCP-CAT-001: Binary classifier catalog **design** | (catalog design) | — | — | — |
| #210 | QOL-041 - Concession list and acceptance gradient | rules-ux | P1 | M | 6.6 |
| #209 | QOL-040 - Invite and response notification lifecycle | interaction | P2 | L | 6.7 |
| #208 | QOL-039 - Public/private room visibility transition | rules-ux | P1 | M | 6.7 |
| #207 | QOL-038 - Invite→signup/auth→argument-room return path | interaction | P1 | L | 6.7 |
| #80 | META-1E - Cards-detail metadata diff inspector | — | — | — | — |
| #79 | META-1D - Six-month vocabulary review (manual + auto codes) | — | — | — | — |
| #77 | META-1B - Realtime multi-user manual-tag sync | — | — | — | — |
| #26 | PR-004 - Contact information update | — | — | — | — |
| #25 | PR-003 - Avatar upload policy and storage | — | — | — | — |
| #8 | BR-002 - Split-screen branch inspector | — | — | — | — |

**Totals:** 11 open issues / Project #1 has 137 items / 25 QOL issues (4 open + 21 closed) / 1 COMP issue (closed) / 1 MCP-CAT issue (open, design-phase, orphaned) / 8 MCP-MOD issues (all closed).

### 2.3 Category counts

| Category | Definition | Count |
|---|---|---|
| **A** | Shipped through standard pipeline with review doc | ~85 (13 directly verified above; the rest from the broader review-docs listing of 87 files) |
| **B** | Closed but no review doc — closed via non-standard path or administratively | **10 verified** (QOL-015..QOL-022, QOL-025, QOL-034) — more likely exist outside the chain context |
| **C** | Genuinely open and ready for autonomous pipeline work | **10** (QOL-038–041, META-1B/D/E, PR-003/004, BR-002) |
| **D** | Referenced in my chain prompts but never filed as real issues | **1** (COMP-001.1) |
| **Orphan-open** | Open issue but implementation shipped through a different code path | **1** (#238 design card) |

## 3. Category C — outstanding work, dependency-ordered

### 3.1 Post-slate UX cards (chain-context)

These are the four QOL cards that should have been the chain's continuation past the (already-shipped) QOL-036/037. Listed in approximate dependency order.

#### QOL-041 (#210) — Concession list and acceptance gradient
- **Design:** `docs/designs/QOL-041.md`
- **Epic:** rules-ux · **Priority:** P1 · **Effort:** M · **Release:** 6.6
- **Depends on:** point-standing economy (`ConcessionEffect`) — already in `src/features/pointStanding/` (Stage 6.1.4); RULE-004 (advisory review) — status unverified.
- **Blocked status:** Largely unblocked; verify RULE-004 status before spawning.
- **What it ships:** Composer support for multi-item concession lists; per-concession 5-level acceptance gradient (Agree / Agree with caveat / Disagree based on framing / Disagree based on context / Disagree based on fact); fist-bump acknowledgment reaction with no score / no verdict. Each non-Agree gradient choice requires a clarification body.

#### QOL-038 (#207) — Invite→signup/auth→argument-room return path
- **Design:** `docs/designs/QOL-038.md`
- **Epic:** interaction · **Priority:** P1 · **Effort:** L · **Release:** 6.7
- **Depends on:** `docs/invite-flow.md` (referenced in body; verify presence).
- **Blocked status:** Verify invite-flow doc exists; otherwise unblocked.
- **What it ships:** Email-invite backend (invite record + RLS), auth deep link, seamless entry as primary participant (no observer/side modal — consistent with Stage 6.4). Emails are operator-gated until release.

#### QOL-040 (#209) — Invite and response notification lifecycle
- **Design:** `docs/designs/QOL-040.md`
- **Epic:** interaction · **Priority:** P2 · **Effort:** L · **Release:** 6.7
- **Depends on:** QOL-038 (invites produce a notification); GAME-005 / GAME-006 (chime-in lifecycle).
- **Blocked status:** Soft dep on QOL-038; can proceed in parallel since notification surface is mostly independent of invite backend wiring.
- **What it ships:** In-app notification lifecycle for every storyboard trigger (invite, new response, concession challenged, source requested, evidence supplied, chime-in posted/rejected, room made private, argument settled). Push notifications explicitly out of scope. Neutral copy, never shaming.

#### QOL-039 (#208) — Public/private room visibility transition rules
- **Design:** `docs/designs/QOL-039.md`
- **Epic:** rules-ux · **Priority:** P1 · **Effort:** M · **Release:** 6.7
- **Depends on:** GAME-005 (public seats); **QOL-040 (notifications)** — explicit dep in issue body.
- **Blocked status:** **Blocked by QOL-040.** Ship QOL-040 first or descope the notification half of QOL-039.
- **What it ships:** Room can be created private (never on public lists); public→private transition revokes non-participant RLS read; rejected chime-in branches retained-but-muted (never deleted); neutral observer notifications via QOL-040.

### 3.2 Non-chain open cards (operator surface for future planning)

| # | Card | Notes |
|---|---|---|
| #80 | META-1E - Cards-detail metadata diff inspector | Metadata tooling; admin/operator surface. |
| #79 | META-1D - Six-month vocabulary review | Periodic governance task. |
| #77 | META-1B - Realtime multi-user manual-tag sync | Multi-user collaboration on tags. |
| #26 | PR-004 - Contact information update | Profile editing. |
| #25 | PR-003 - Avatar upload policy and storage | Storage + auth + profile. |
| #8 | BR-002 - Split-screen branch inspector | Branch UI refinement. |

These are not blocked by anything from the post-slate chain. They are independent work areas (profiles, metadata governance, branches) that the operator can sequence at will.

## 4. Category B — closed cards without review docs (flagged for operator review)

Ten verified Category B cards in the QOL range, all in the QOL-015..QOL-026/034 cluster — these pre-date the standard roadmap-implementer/reviewer pipeline. They were closed through earlier processes (manual closure, ad-hoc work, or non-roadmap PRs) rather than the spawn-card → implementer → reviewer → squash-merge pattern that took hold around QOL-023/024.

| Issue # | Title | Assessment |
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

**Recommendation:** Operator inspects each to confirm whether the closure represented real completion. None of these blocks current open work. The Category B list is informational — flagging the gap between issue-close and review-doc-present so the pattern is consistent going forward.

## 4.1 The MCP-CAT-001 (#238) design-card orphan

**Special case.** Issue #238 is the *design* card for MCP-CAT-001 (the body explicitly says "Design-phase card. Deliverable is a finalized catalog proposal, NOT a catalog implementation"). The design artifact lives at `docs/roadmap-expansions/2026-05-23-binary-classifier-catalog-design.md` and was the basis for the implementation that shipped via PR #252. The issue was never closed because:
- PR #252 (the implementation) did not include `Closes #238` in its body.
- No separate implementation issue was filed.
- The design deliverables in #238's acceptance criteria are largely satisfied by the catalog-design doc and the shipped catalog — but the issue's checkboxes were never ticked off.

**Recommendation:** Operator either (a) closes #238 manually as "design realized through PR #252 + the catalog-design doc," or (b) ticks off the design-acceptance checklist explicitly and closes. Low priority — neither blocks any current open work.

## 5. Category D — referenced in chain prompts but never filed

### 5.1 COMP-001.1 — smoke-surfaced refinement candidates

**Status:** Proposed in my QOL-036 chain prompt; never filed as a real GitHub issue.

**Chain-prompt context:** The band-space-rent smoke verification (committed in PR #254) surfaced three doc-vs-implementation gaps in the MCP-CAT-001 deliverables that were doc-sanctioned omissions rather than regressions:

1. `evidence_applicability_supported` mutation type — symmetric companion to `evidence_applicability_disputed`. Would fire on the original evidence-attaching move when a corroborating document later supports the same applicability claim.
2. `prior_dispute_resolved` mutation type — explicitly framed in `COMP-001-worked-examples.md` as an "implementer decision documented in the rule."
3. `sub_axis_resolved` state transition — when a move on the sub-axis carries `ready_for_synthesis=1` with corroborating evidence, the active sub-axis should flip from `status: 'open'` to `status: 'resolved'`. Currently stays `open` even after a settling move.

**Recommendation:** Operator decides whether to file COMP-001.1 as a real issue. The three refinements are documented in `docs/testing-runs/2026-05-23-band-space-rent-smoke-verification.md` §"Follow-up candidates." Filing as a single small card is reasonable; striking from future chain prompts and addressing organically as related work surfaces is equally reasonable.

## 6. Forward-looking integration opportunities

The composition-layer mutation surface added by MCP-CAT-001 + the COMP-001 base set is consumable by several UI surfaces whose shipped scope did not include consumption (because MCP-CAT-001 hadn't shipped). These are integration follow-ups, not bugs — every listed card works correctly without consuming the mutations. Operator decides which warrant filing.

Composition-layer mutation surface (post-MCP-CAT-001, 35 total per-move + cross-node mutations including):
`evidence_debt_opened`, `evidence_debt_resolved`, `evidence_attached_supporting`, `evidence_applicability_disputed`, `corroborating_document_attached`, `point_conceded`, `point_narrowed`, `concession_landed`, `narrowing_landed`, `sub_axis_opened`, `synthesis_ready`, `synthesis_offered`, `pre_send_pause_advised`, `playable_hot_take`, `mode_mismatch_warning`, `source_chain_gap_flagged`, `source_chain_gap_filled`, `retraction_cited`, `evidence_retracted`, `qualified_concession_with_caveat`, `alternate_interpretation_offered`, `settlement_proposed`, `settlement_accepted`, `branch_route_hint`, `tangent_route_hint`, `person_shift_warning`, etc.

### 6.1 Highest-leverage integration follow-ups

| Shipped card | Could consume | Why it's worth a follow-up |
|---|---|---|
| **QOL-036** (payment evidence metadata) | `evidence_applicability_disputed`, `corroborating_document_attached`, `evidence_debt_opened/resolved` | The QOL-036 chain prompt explicitly hinted at this integration ("mutations driving evidence-pill state"). The shipped scope was additive metadata only — driving the pill's applicability-lifecycle state from composition-layer signals is net-new work. **Strongest candidate** for a near-term integration follow-up. |
| **QOL-037** (evidence applicability dispute flow) | `evidence_applicability_disputed`, `evidence_debt_opened` | Worth verifying whether the existing implementation already wires this or relies on layer-1 metadata alone. If layer-1 only, a small integration card flips the dispute-status pill on classifier signal rather than user-action only. |
| **EV-001..EV-005** (evidence object model + UI) | `evidence_debt_opened/resolved`, `evidence_attached_supporting`, `corroborating_document_attached`, `source_chain_*` | The whole evidence-pill state lifecycle could be classifier-driven. |
| **GAME-004..006** (point standing UI / strength bands) | `point_conceded`, `point_narrowed`, `concession_landed`, `narrowing_landed` | Standing-band visual changes could fire from classifier signals rather than user-action only. |
| **BR-001 / BR-003 / BR-004** (branch surfaces) | `sub_axis_opened`, `branch_route_hint`, `tangent_route_hint`, `branch_suggested` | Branch-affordance suggestions surface from the classifier; UI could chip these. |
| **SC-003..SC-005** (source chain) | `source_chain_gap_flagged`, `source_chain_gap_filled`, `retraction_cited`, `evidence_retracted` | Source-chain pills with classifier-driven state. |
| **COMPOSER-001..002** (one-box composer) | `pre_send_pause_advised`, `playable_hot_take`, `mode_mismatch_warning` | Pre-send composer affordances. |
| **GAL-001..002** (gallery) | `synthesis_ready`, `synthesis_offered` | Gallery card synthesis-readiness indicators. |
| **SW-002** (strength/weakness) | `point_narrowed`, `concession_landed` | Strength-band updates. |
| **IX-001..IX-004** (interaction) | Broad consumer surface | Likely the meta-card for "wire composition layer into all interactive surfaces." |

**Recommendation:** Operator triages this list. The strongest candidate is **QOL-036.1** (payment-evidence pill state from composition-layer signals) since the chain prompt explicitly anticipated it. The rest are organic candidates as related work surfaces.

---

*End of reconciliation report. No code modified; no issues filed; no project-board changes. Operator next step: review and choose the next card directly.*
