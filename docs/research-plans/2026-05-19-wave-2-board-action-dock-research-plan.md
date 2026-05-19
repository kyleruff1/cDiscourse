# Wave 2 — Board action dock research plan (SC-004)

**Status:** Research / pre-design.
**Date:** 2026-05-19.
**Owner:** Kyler.
**Target card:** [#63 SC-004 — Timeline node action dock](https://github.com/kyleruff1/cDiscourse/issues/63).
**Audience:** the next `roadmap-designer` invocation. This note must be specific enough that they can produce `docs/designs/SC-004.md` without re-litigating Wave 1.

## 0. Research planner skill — not present

There is no `.claude/skills/research-planner/SKILL.md` (or `product-research-planner` / `roadmap-research-planner`) in this repo today. The available planning surfaces are `timeline-grammar`, `cdiscourse-doctrine`, `accessibility-targets`, `test-discipline`, `evidence-doctrine`, `point-standing-economy`, and `expo-rn-patterns` — those provide doctrine for design, not a planning meta-skill. This note is therefore written as a manual research artifact following the structure laid out in the operator's run-prompt. No fake skill invocation.

If a research-planner skill is later authored, the recommended pattern is: read the roadmap doc → read the freshly-shipped sibling design + review docs → read the consumer/source files the next card will touch → produce a focused note that names the seams, the doctrine guardrails, the test plan, and the explicit "do not implement in this card" boundary.

---

## 1. Current foundation shipped (main @ `c04d229`)

What SC-004 builds on top of, all already merged:

- **BR-001** ([PR #68](https://github.com/kyleruff1/cDiscourse/pull/68), merged `6097802`) — tree topology contract. `src/features/arguments/branchTopologyModel.ts` exposes the 5-value `RailBranchKind` enum, `branchRootMessageId` cluster identity, the `BranchCollapseState` shape, and the auto-expand rule for "active node inside collapsed branch". Frozen seam: `RailBranchKind`, `RailSegmentInput`, `derivePlaceholderBranchKind` signature, `GradientWaveRail.tsx`.
- **LIFE-001** ([PR #69](https://github.com/kyleruff1/cDiscourse/pull/69), merged `ea62b6e`) — point lifecycle. `src/features/lifecycle/` exposes the 18-value `PointLifecycleState` union, per-node `PointLifecycleSnapshot`, per-cluster `PointLifecycleClusterSummary`, the `PointLifecycleMap` per-tree shape, advisory thresholds, and the `LIFECYCLE_PRIORITY` worst-priority-wins table. Cluster boundary = `branchRootMessageId` from BR-001.
- **META-001** ([PR #70](https://github.com/kyleruff1/cDiscourse/pull/70), merged `b22f4ef`) — move tag / metadata ledger. `src/features/metadata/` exposes the 10-value `ManualTagCode` union, the 16-value `AutoMetadataCode` union, the `MoveLinkageRecord` per-move shape, the `ClusterMetadataSummary` per-cluster shape, the `MetadataEvent` log, the `MANUAL_TAG_ELIGIBILITY` matrix, and the snapshot-diff `computeLifecycleCausationForMove` algorithm. Reading the ledger is observer-safe; applying a manual tag is participant-only with own-bubble restricted to `concession_offered` / `narrowed_claim` / `ready_for_synthesis`; admins universal.
- **EV-001 / EV-002** ([PR #57](https://github.com/kyleruff1/cDiscourse/pull/57), [PR #59](https://github.com/kyleruff1/cDiscourse/pull/59)) — evidence object model + source-chain popover. `src/features/evidence/evidenceModel.ts` exposes the 6-value `SourceChainStatus` union (`no_source` / `unverified` / `source_no_quote` / `source_and_quote` / `broken` / `primary_present`), `EvidenceArtifact`, and the per-node `TimelineEvidenceContract`. `sourceChainPresetCopy.ts` provides `ASK_SOURCE_PRESET_BODY` / `ASK_QUOTE_PRESET_BODY` / `ASK_STRONGER_SOURCE_PRESET_BODY` — non-accusatory bodies the composer already accepts via `MoveDraftPatch.body`.
- **VG-002** rail grammar — `RailBranchKind` dispatch table, `GradientWaveRail.tsx` renderer. SC-004 reads colours and branch identity but must NOT mutate the rail's surface.
- **SC-002 popover** — `src/features/arguments/timelineNodePopoverModel.ts` already turns an active node + actor into a compact view-model. Its action set today comes from `getBubbleControlsForActor` — a purely *actor*-driven choice. SC-004's contribution is to layer *lifecycle + metadata + evidence + branch context* on top, so the dock surfaces a context-aware **primary** suggestion instead of an unranked menu.
- **Stage 6.4 side rail** — `src/features/arguments/ArgumentSideActionRail.tsx` owns the bubble-rail action vocabulary (`Watch` / `Join For` / `Join Against` / `Ask source` / `Open timeline` / `Share` for observers; `Reply` / `Disagree` / `Ask source` / `Ask quote` / `Split branch` / `Flag` / `Qualifiers` for participant-other; `Qualifiers` / `Request deletion` for self). SC-004 uses the SAME vocabulary at the dock surface; the dock is not a parallel action universe.
- **gameCopy** — `src/features/arguments/gameCopy.ts` `PLAIN_LANGUAGE_COPY` now covers all 18 lifecycle states + 10 manual tag codes + 16 auto metadata codes (39 entries added by LIFE-001 / META-001).

**Baseline:** 2942 tests / 109 suites passing on `main @ c04d229`. Typecheck + lint clean. Zero known baseline failures.

---

## 2. Wave 2 thesis

The Timeline/Tree is now a board, but it is not yet a **playable** game board unless the next playable moves are directly available on the board surface. SC-004 should make the selected node or cluster actionable in **one click**, using lifecycle + metadata + evidence + actor rules.

Concretely: today a participant sees a tree, taps a node, gets the SC-002 popover, and chooses from a flat actor-driven action menu. The menu does not know that the cluster is `source_requested`. The menu does not know the move has `evidence_debt`. The menu does not know the source-chain is `broken`. The menu does not know that the chosen node sits inside a `branch_recommended` cluster. SC-004 collapses that knowledge gap so the *primary* action surfaces what the game state already says is the next playable move.

This is a doctrine-aligned move: the dock RECOMMENDS, never BLOCKS. An ordinary reply is always available; lifecycle/metadata/evidence only re-orders the suggestion.

---

## 3. COPY-001 gate decision

[#71 COPY-001](https://github.com/kyleruff1/cDiscourse/issues/71) is **OPEN** (P1 / effort:S / release 6.6 / epic:visual-grammar).

**Decision: treat COPY-001 as a design guardrail for SC-004, not a blocker.**

Justification:
- COPY-001 is a copy-audit pass; it does not produce production code unless a verdict-tone drift is found.
- The one concrete defect already surfaced — `PLAIN_LANGUAGE_COPY.answered` (LIFE-001 cluster state) and `PLAIN_LANGUAGE_COPY.has_reply` (META-001 move auto-metadata) both render `"Has a reply"` (`gameCopy.ts:205` and `gameCopy.ts:239`) — is a **render-time qualification problem**, not a relabel problem. SC-004 owns the consumer that needs to qualify the context.
- No existing test fails because of this collision; production tests pass at 2942/2942.

**Guardrail SC-004 design must encode:**

a. Lifecycle state names and metadata codes must render through `gameCopy.toPlainLanguage` / `PLAIN_LANGUAGE_COPY`. No raw `snake_case` strings in dock copy.
b. Cluster-level codes (`answered`, `rebutted`, `confirmed`, etc.) and move-level codes (`has_reply`, `has_rebuttal`, etc.) can share a label string only if the dock consumer disambiguates context at render time. The recommended pattern: when both could apply, the dock's *cluster header* uses the cluster label, while a *move chip* uses the move label, never side-by-side on the same line.
c. `answered` (cluster) and `has_reply` (move) must not appear together on the same dock without a context qualifier (e.g. "Cluster: Has a reply" vs "This move: Has a reply"), OR the dock must collapse one of them at render time.
d. SC-004 does NOT relabel either entry — that's COPY-001's job if it decides relabelling is warranted.
e. No verdict tokens. No person-attribution drift. No `block` / `prevent` / `reject` semantics in any dock copy.

If a concrete verdict-tone bug is found during SC-004 design or build, that's a STOP condition and COPY-001 becomes a blocker. Otherwise, COPY-001 runs in parallel and SC-004 honours the guardrails above.

---

## 4. SC-004 action-dock concept

**A compact contextual action palette rendered on or near the Timeline/Tree surface.** The dock appears after selecting a node or cluster. It exposes one primary suggested action plus a small set of secondary actions, derived from lifecycle + metadata + evidence/source-chain + branch context + actor role. It does NOT replace Cards/Stack detail mode — `Open Cards detail` is always one of the secondary actions and is a *surface toggle*, not a route change (TL-003 doctrine).

Required action vocabulary (from roadmap §8 verbatim, ordered):

1. `reply`
2. `challenge`
3. `ask_source`
4. `ask_quote`
5. `clarify`
6. `add_evidence`
7. `narrow`
8. `concede`
9. `confirm`
10. `mark_moved_on`
11. `mark_ignored`
12. `branch`
13. `synthesize`
14. `flag`
15. `open_cards_detail`

15 actions. The dock never renders all 15 at once. The dock renders **one primary** + **at most ~4 secondary** + **overflow → Open Cards detail**.

---

## 5. Actor rules (locked, mirroring roadmap §8 + Stage 6.4 rail)

### Own message

**Never:** `challenge`, `flag`, `reply` (replying to your own bubble is a UI mistake; if it is allowed elsewhere, the dock should still not promote it), edit body, score, `ask_source` against your own move, `ask_quote` against your own move.

**Allowed:**
- `open_cards_detail`
- `add_evidence` ONLY if the existing safe author-side evidence path applies (the composer-driven evidence post path is a participant-other action against the parent; for *own* bubble, this row should be omitted in v1 unless EV-001 explicitly enables an "add evidence to my own move" path. Default: omit.)
- Manual tag application restricted to the META-001 own-bubble set: `concession_offered`, `narrowed_claim`, `ready_for_synthesis`. The dock surfaces these as `narrow` / `concede` / `synthesize` actions that apply a *manual tag*, not a *new argument post* — to be confirmed in design.
- `request_deletion` if the existing flow is preserved (Stage 6.1.8 owns that surface; SC-004 should reuse, not reinvent).

No primary action for own bubble. Dock for own bubble is intentionally small.

### Participant-other (the rich case)

**Allowed (lifecycle-permitting):**
- `reply`, `challenge`, `ask_source`, `ask_quote`, `clarify`, `add_evidence`, `narrow`, `concede`, `confirm`, `mark_moved_on`, `mark_ignored`, `branch`, `synthesize`, `flag`, `open_cards_detail`.

The primary is chosen from the lifecycle/metadata/evidence/branch context (§6–§9 below). Secondary actions are the next-most-relevant 3–4 from the same matrix.

### Observer

**Allowed:**
- `open_cards_detail`
- `ask_source` (Stage 6.4 explicitly placed this on the observer rail)
- `flag` if the observer-flag policy permits (CLAUDE.md: flags are never deleted, only soft-dismissed; observer flagging is allowed today)
- Disabled affordances for participant-only actions, with helper copy like **"Join For to reply"** / **"Join Against to challenge"** / **"Join a side to ask quote"** — non-coercive, never accusatory.

The dock does not hide participant-only actions for observers; it shows them with `disabledReason = 'observer_must_join'` and a join-side helper line. This honors the Stage 6.4 "Observer can see what's possible, not what to do" doctrine.

### Bot / test room

Same semantics as participant-other. Any test-room visual marker that exists today stays visibly distinct (Stage 6.1.7+ test-bot identity rule). SC-004 does not invent new bot affordances.

### Admin

All participant-other actions, plus access to admin moderation paths (out of scope for SC-004 — admin flag review is owned by AdminArgumentsTab).

---

## 6. Lifecycle-to-primary-action mapping

Matrix below maps each LIFE-001 state to a primary action suggestion. The dock applies actor rules first (own / observer get restricted sets), THEN lifecycle, THEN metadata/evidence/branch refinements.

| Lifecycle state | Primary action (participant-other, default actor) | Fallback if primary inapplicable |
| --- | --- | --- |
| `open` | `reply` | `challenge` |
| `answered` | `challenge` | `clarify` |
| `rebutted` | `challenge` (counter) | `clarify` |
| `clarified` | `reply` | `challenge` |
| `sourced` | `challenge` (challenge the evidence) | `add_evidence` (counter-evidence) |
| `quote_requested` | `add_evidence` (attach quote) OR `ask_quote` if you are NOT the author | `clarify` |
| `source_requested` | `add_evidence` (attach source) OR `ask_source` if you are NOT the author | `clarify` |
| `narrowed` | `confirm` (accept the narrowed claim) | `challenge` (the narrowed version) |
| `conceded` | `confirm` (accept the concession) | `synthesize` |
| `confirmed` | `synthesize` | `mark_moved_on` |
| `synthesis_ready` | `synthesize` | `confirm` |
| `moved_on_by_affirmative` | `confirm` move-on OR `reply` to reopen | `mark_moved_on` (your side) |
| `moved_on_by_negative` | `confirm` move-on OR `reply` to reopen | `mark_moved_on` (your side) |
| `ignored_by_affirmative` | `mark_ignored` advisory OR `reply` (ask again) | `synthesize` if stale |
| `ignored_by_negative` | `mark_ignored` advisory OR `reply` (ask again) | `synthesize` if stale |
| `ignored_by_both` | `reply` (reopen) OR `synthesize` | `mark_moved_on` |
| `exhausted` | `narrow` OR `branch` OR `mark_moved_on` | `synthesize` |
| `branch_recommended` | `branch` | `narrow` |
| `archived_or_resolved` | `open_cards_detail` | `reply` (if reopen allowed) |

**Doctrine reminders:**
- No lifecycle state may BLOCK `reply`. Even `exhausted` and `archived_or_resolved` only re-order suggestions; the user can always post.
- `conceded` does NOT mean the conceding side lost. It is a scoring repair (see `docs/point-standing-economy.md`). The primary `confirm` invites the other side to accept the repair, which moves the cluster toward `synthesis_ready` — that is gameplay progress, not "victory".
- `ignored_by_*` describes the cluster, never the user as a person. The action `mark_ignored` is an advisory tag, not an accusation.

---

## 7. Metadata-to-action mapping (META-001 ledger consumption)

SC-004 consumes the `MoveMetadataLedger` and the per-cluster `ClusterMetadataSummary`. It does NOT re-derive anything.

**Manual tag → primary action influence:**

| Manual tag on selected target | Primary action influence |
| --- | --- |
| `needs_source` | Promote `ask_source` (or `add_evidence` if user has the source) |
| `needs_quote` | Promote `ask_quote` (or `add_evidence`) |
| `definition_issue` | Promote `clarify` |
| `scope_issue` | Promote `narrow` |
| `causal_mechanism` | Promote `challenge` with mechanism axis hint |
| `evidence_debt` | Promote `add_evidence` |
| `concession_offered` | Promote `confirm` (other side) / `synthesize` |
| `narrowed_claim` | Promote `confirm` / `challenge` (narrowed version) |
| `tangent` | Promote `branch` |
| `ready_for_synthesis` | Promote `synthesize` |

**Auto metadata → secondary action / badge influence:**

| Auto metadata code | Dock effect |
| --- | --- |
| `has_reply` (move-level) | Cluster header shows "Has a reply" only if cluster is `answered`; otherwise this is a move-chip note. |
| `has_rebuttal` | Cluster header shows "Under pressure" if cluster is `rebutted`. |
| `has_counter_rebuttal` | Cluster header shows "Counter-rebuttal recorded". |
| `has_evidence` | Promote `inspect_receipt` (via Cards detail) and suppress `ask_source` / `ask_quote`. |
| `source_requested` (move-auto) | Promote `add_evidence` / `ask_source` per actor rule. |
| `quote_requested` | Promote `add_evidence` / `ask_quote`. |
| `source_attached` | Add badge; suppress `ask_source` for the selected move. |
| `quote_attached` | Add badge; suppress `ask_quote`. |
| `participant_skipped_node` | Badge; promote `reply` (ask again). |
| `no_response_after_n_turns` | Badge "No follow-up yet"; promote `reply`. |
| `repeated_axis_pressure` | Promote `narrow` / `branch`. |
| `branch_suggested` | Promote `branch`. |
| `branch_created` | Badge; no primary effect. |
| `point_stalled` | Promote `synthesize` / `mark_moved_on`. |
| `point_exhausted` | Same as lifecycle `exhausted` — promote `narrow` / `branch` / `mark_moved_on`. |
| `synthesis_candidate` | Promote `synthesize`. |

**Rule of composition:**

- Lifecycle primary action is the default.
- If a manual tag on the selected target promotes the SAME action, badge it as "high confidence" (visual emphasis, not new copy).
- If a manual tag promotes a DIFFERENT action, the manual tag wins — it is participant-applied intent, more specific than the deterministic lifecycle rule.
- Auto metadata never overrides lifecycle for the primary action; it only adds badges and re-orders the secondary list.
- Per META-001 doctrine: SC-004 must NOT call `deriveMessageCategory` / `derivePrimaryQualifier` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair` — only consume their outputs via the ledger and summary shapes.

---

## 8. Evidence / source-chain mapping (EV-001 / EV-002)

SC-004 consumes `TimelineEvidenceContract.sourceChainStatus`. It does NOT redefine `SourceChainStatus`.

| `SourceChainStatus` | Primary action (participant-other) | Secondary action |
| --- | --- | --- |
| `no_source` (aggregate-only) | `ask_source` (or `add_evidence` if you have one) | `open_cards_detail` |
| `unverified` | `ask_source` | `add_evidence` |
| `source_no_quote` | `ask_quote` | `add_evidence` (quote) |
| `source_and_quote` | `inspect_receipt` (via Cards detail) | `challenge` (the evidence) |
| `broken` | `ask_stronger_source` → maps to existing `weak_source` preset | `add_evidence` (a primary source) |
| `primary_present` | `inspect_receipt` | `challenge` (the mechanism, not the source) |

Composer preset mapping reuses EV-002's existing seam:

- `ask_source` → `quickActionToPreset('source', parentType)` → seeds `ASK_SOURCE_PRESET_BODY` + `argumentType: 'clarification_request'` + `suggestedTagCodes: ['source_request']`.
- `ask_quote` → `quickActionToPreset('quote', parentType)` → seeds `ASK_QUOTE_PRESET_BODY` + `suggestedTagCodes: ['quote_request']`.
- `ask_stronger_source` → `quickActionToPreset('weak_source', parentType)` → seeds `ASK_STRONGER_SOURCE_PRESET_BODY`.
- `inspect_receipt` → opens the SC-002 popover's existing source-chain section, NOT a composer (per EV-002).

SC-004 must NOT re-author these preset bodies. It MUST reuse `quickActionToPreset` (or a thin wrapper that calls it) so EV-002's safety guarantees stay intact.

---

## 9. Branch / tree mapping (BR-001)

Selection targets:

- **Node target** — user tapped a single message node. Dock renders for the SELECTED node, using its move-level metadata + the cluster's lifecycle/metadata summary.
- **Cluster target** — user tapped a branch area or a cluster header chip. Dock renders for the CLUSTER, using the cluster's lifecycle summary and aggregate metadata. The primary action speaks to the cluster ("Reply at root of this branch", "Synthesize this cluster") rather than a specific move.
- **Collapsed stub target** — user tapped a `BranchCollapseStub`. Per BR-001's auto-expand rule, if the active node sits inside the collapsed branch, ancestors silently uncollapse. If the user tapped a stub for a different branch, the dock offers (a) `expand_branch` (UI affordance, NOT an argument-post action) and (b) `open_cards_detail` for the cluster summary.

`expand_branch` is a UI primitive, not a new argument type. SC-004 routes it to BR-001's existing `toggleBranchCollapse` helper. Implementer must NOT introduce a new `argument_type` for it.

Selection state lives in the room shell. SC-004 reads `selectedTarget: { kind: 'node', messageId } | { kind: 'cluster', branchRootMessageId } | { kind: 'collapsed_stub', branchRootMessageId }` and produces the dock model.

---

## 10. UI placement

Default placement rules (RN-only, no new dependencies):

- **Narrow viewport (≤ 480 logical pixels):** stable bottom dock fixed above the safe-area inset. Single primary action button + secondary action chips + overflow to Open Cards detail. This is the dominant mobile case.
- **Wide viewport (> 480 logical pixels):** inline dock near the selected node IF current RN layout can place it safely without overlapping the rail or the active-node ring. If layout safety is uncertain in design, fall back to the bottom dock on wide too. Don't introduce new positioning libraries.
- **Cards detail escalation:** always-visible overflow affordance ("More…" or "Open details") that opens Cards detail as a *surface toggle*, never as a route change.

The dock dismisses when:
- the user taps a different node / cluster (selection changes)
- the user taps outside the dock and the selected target
- the user opens Cards detail (surface toggle)

**Non-route guarantee (TL-003):** Open Cards detail is a surface toggle. Browser back must not strand the dock. Implementer should write a regression test that proves no route push happens when the dock fires `open_cards_detail`.

---

## 11. Test strategy

SC-004 ships:

1. **Pure action availability model tests** — feed a `BuildTimelineNodeActionDockInput`, expect a deterministic `TimelineNodeActionDockModel`.
2. **Actor-role matrix tests** — observer / own / participant-other / bot / admin × 15 actions. Confirm the exact set of allowed/disabled actions per actor for each lifecycle state.
3. **Lifecycle primary-action matrix tests** — every one of the 19 LIFE-001 states (18 + the design-canonical `archived_or_resolved` terminal) has a primary action OR a documented "safe fallback to reply" rule. No state may leave the dock with `primary = null` for participant-other.
4. **Metadata interaction tests** — for each of the 10 manual tag codes + 16 auto metadata codes, the dock's primary/secondary/badge changes are tested.
5. **Evidence/source-chain mapping tests** — 6 `SourceChainStatus` × 4 actor roles → expected action set.
6. **Branch/cluster selection tests** — node vs cluster vs collapsed-stub target produces the right dock variant.
7. **No-route transition tests** — `open_cards_detail` does NOT call any router method; it sets a surface toggle state.
8. **Plain-language tests** — no raw snake_case in any dock copy (all labels go through `gameCopy.toPlainLanguage` / `PLAIN_LANGUAGE_COPY`).
9. **Ban-list tests** — no `winner` / `loser` / `liar` / `dishonest` / `bad faith` / `manipulative` / `extremist` / `propagandist` / `troll` / `astroturfer` / `true` / `false` / `correct` / `incorrect` / `right` / `wrong` / `defeated` / `lost` / `won` / `proof` / `proven` / `validated` / `verdict` tokens in any dock-produced field. Reuse the LIFE-001 / META-001 ban-list test pattern.
10. **Accessibility label tests** — every action has an `accessibilityLabel`; observer-disabled actions have non-coercive helper copy; dock root has an `accessibilityRole='menu'` or equivalent.
11. **250+ message stress fixture** — selected-node dock model build completes in < 50 ms on a 250-message synthetic tree. Mirrors LIFE-001's perf precedent.
12. **Composer preset mapping tests** — `actionDockToComposerPreset(action, target)` round-trips to `quickActionToPreset(...)` correctly for `ask_source` / `ask_quote` / `weak_source` / `clarify` / `evidence` / `concede` / `challenge`; returns null for `reply` / `branch` / `mark_moved_on` / `mark_ignored` / `flag` / `open_cards_detail` / `narrow` / `confirm` / `synthesize` (those without a preset or those that apply tags rather than starting a post).
13. **Forbidden-imports source scan** — `timelineNodeActionDockModel.ts` must NOT value-import `deriveMessageCategory`, `derivePrimaryQualifier`, `deriveMessageQualifiers`, `applyAntiAmplification`, `gradeChallenge`, `gradeRepair`, `buildPointLifecycleMap` (consume input shape, don't re-derive). Mirrors LIFE-001's forbidden-imports test pattern.
14. **No service-role / direct insert scan** — `timelineNodeActionDockModel.ts` and `TimelineNodeActionDock.tsx` must NOT reference `SERVICE_ROLE`, `from('arguments').insert`, `supabase.from`, or any `fetch` / network call. Pure-TS model; the component dispatches actions back to the room shell which uses the existing `submit-argument` Edge Function path.

Test file targets:
- `__tests__/timelineNodeActionDockModel.test.ts` — pure model (~150–200 tests covering 1–13).
- `__tests__/timelineNodeActionDockForbiddenImports.test.ts` — source scan (~20 tests).
- `__tests__/timelineNodeActionDockDoctrine.test.ts` — ban-list + structural deep-equal under standing/tone/temperature variation (~15 tests).
- `__tests__/TimelineNodeActionDock.test.tsx` — render tests if render tooling is available; otherwise pure-helper render-output assertions (~10 tests). QOL-022 may unblock real component tests; if not, ship the model coverage and defer component tests with a discovery note.

---

## 12. Follow-up boundaries (do NOT implement in SC-004)

Out of scope:
- **IX-001** — zoom/density modes for the timeline.
- **IX-002** — mini-map overview.
- **ST-002** — Cards detail's suggested-reply flag panel (the dock LINKS to Cards detail; ST-002 fills the panel).
- **GAME-001** — exhaustion / timeout / moved-on advisory engine (LIFE-001 ships the model; GAME-001 wires the rule engine; SC-004 only consumes lifecycle outputs).
- **RULE-003** — lifecycle-to-UX doctrine map (SC-004 encodes a *subset* — the dock's primary-action matrix — but does not enumerate every possible UX surface).
- **META-1A** persistence — manual tag application via the dock writes to the in-memory `MoveMetadataLedger` only; persistence is META-1A's v2 work.
- **META-1B / META-1C / META-1E** — realtime, audit log, metadata-diff inspector.
- **EV-003** — evidence debt tracker.
- **EV-004** — evidence symmetry with game rules.
- **COPY-001** — full copy audit; SC-004 honors guardrails but does not run the audit.
- **HIST-001** — lifecycle event history surface.
- **New dependencies** — no `react-native-popover`, no `@floating-ui`, no animation libraries. Use existing `Pressable` + `View` + safe-area inset.
- **Supabase migration** — none. Manual tag application is in-memory until META-1A.
- **Live AI** — none.
- **Service-role** — none.
- **Public API** — none.

If during design the designer finds any of the above is actually required for SC-004 acceptance, that is a STOP condition — the design must either split SC-004 or block on the prerequisite.

---

## 13. Recommended next card after SC-004

Priority order, dependency-aware:

1. **#71 COPY-001** if the SC-004 build surfaces a concrete verdict-tone bug; otherwise it can land in parallel as a docs-only audit.
2. **#20 IX-001** — Timeline zoom and density modes (P0/L/6.6). After SC-004 lands, the next blocker is making dense trees navigable. IX-001 is the natural Wave 2 follow-up.
3. **#13 ST-002** — Suggested reply flags per bubble card (P1/M/6.6). Consumes lifecycle + metadata to populate Cards-detail suggestions. Needs SC-004's contracts as input.
4. **#64 GAME-001** — Point exhaustion / timeout / moved-on advisory engine (P1/M/6.6). Needs lifecycle outputs already shipped, but SC-004 should land first so the dock can surface GAME-001 advisories as primary suggestions.
5. **#65 RULE-003** — Lifecycle-to-UX doctrine map (P1/M/6.6). After SC-004 + GAME-001, RULE-003 codifies the doctrine into a single document and a single test surface.

**Agent recommendation per card:**
- COPY-001: `roadmap-designer` first (audit pass).
- IX-001: full Design → Build → Review.
- ST-002: full Design → Build → Review; will reuse SC-004 contracts.
- GAME-001: full Design → Build → Review.
- RULE-003: `roadmap-designer` first to scope the doctrine doc.

---

## 14. Open questions for the SC-004 designer (not blockers)

These do not block design but are worth resolving in the design doc:

1. **Inline vs bottom dock decision rule.** Should the design freeze "bottom dock always" for v1 simplicity, or attempt the inline-on-wide-screen variant? Recommend: bottom dock only in v1; inline-on-wide as a §18 backlog item (call it SC-1A — "Inline action dock for wide viewports") if a real need shows up post-merge.
2. **Composer preset for `narrow` / `concede` / `synthesize`.** EV-002's `quickActionToPreset` covers `source` / `quote` / `weak_source` / `clarify` / `evidence` / `concede` / `flag` already. The roadmap §8 table proposes preset bodies for `narrow` ("I'd narrow this to…") / `confirm` ("I accept this point") / `synthesize` ("Synthesis: …") that don't exist today. Recommend: ship the SC-004 composer preset extension in this same card if doctrine-safe; otherwise file SC-1B follow-up.
3. **Cluster target vs node target for `synthesize`.** Synthesis is typically a cluster-level move. Recommend the dock requires a CLUSTER target for `synthesize`; on a node target it shows `synthesize` as disabled with helper "Select the cluster to synthesize."
4. **Mark-moved-on / Mark-ignored as manual tags vs as side-state.** META-001 manual tag codes do not currently include `moved_on_by_<side>` / `ignored_by_<side>` — those are *lifecycle states*, not manual tags. The dock's `mark_moved_on` / `mark_ignored` actions should write a META-001 manual tag if META-001 has the right code; otherwise the action is a no-op advisory (UI hint only). Recommend the designer verifies the META-001 vocabulary against the dock's needs and flags any missing tag code as a META-001 design defect (it would need a META-001 patch card, not an SC-004 detour).
5. **`expand_branch` UI primitive.** Where does it live? Recommend the dock dispatches a `expand_branch` event that the room shell routes to BR-001's `toggleBranchCollapse`. The dock model returns it as an action with no composer preset.

---

## 15. Doctrine self-check summary (for the designer to mirror)

SC-004 design must explicitly assert:
- Dock RECOMMENDS, never BLOCKS.
- Lifecycle is play state, not truth.
- No verdict tokens in any user-facing copy.
- No person-attribution drift; tag labels describe the move or cluster.
- No re-derivation of upstream signals (forbidden-imports test).
- No service-role in client; no direct insert into `public.arguments`; existing `submit-argument` Edge Function is the only post path.
- No new dependency; no Supabase migration; no live AI call.
- No route transition for Open Cards detail.
- Plain-language only; no raw snake_case in dock copy.
- Heat ≠ correctness; popularity ≠ evidence; standing band must NOT feed primary action selection (the dock may DISPLAY a standing chip via SC-002's existing surface, but the chip does not gate any action).
- VG-002 / BR-001 / LIFE-001 / META-001 / EV-001 / EV-002 frozen surfaces stay zero-diff.

---

## 16. Discovery candidates already named (file as P2 follow-ups during SC-004, not blockers)

The roadmap §18 backlog already names several items that touch the dock surface. None are blockers; designer should reference them but not implement:

- **NAV-001** — Keyboard branch traversal shortcuts (depends on IX-003).
- **NAV-002** — Selected cluster breadcrumb at top of dock.
- **NAV-003** — "Collapse all resolved branches" gesture.
- **NAV-004** — Unresolved point queue (sidebar).
- **NAV-005** — Suggested next move queue.
- **LEG-001** — Board legend simplification.
- **A11Y-001** — Touch target audit for dense trees.

If the designer finds additional candidates while writing SC-004 — e.g. an inline-on-wide-screen variant, a reduced-motion preference for dock animation, a metadata-debug overlay — they should be filed as P2 issues per Part 10 of the run-prompt with full acceptance criteria.

---

## 17. Recommendation: start design now

This research note is sufficient. The designer should:

1. Run `.\\.claude\\scripts\\spawn-card.ps1 SC-004` from main.
2. Invoke `roadmap-designer` with `isolation: 'worktree'`.
3. Read this research plan, the BR-001 / LIFE-001 / META-001 / EV-001 / EV-002 designs + reviews, the consumer/source files named in §1, and the skills named in the operator's run-prompt.
4. Produce `docs/designs/SC-004.md` mirroring the LIFE-001 / META-001 template, sections 1–17 of the operator's run-prompt §5.
5. Commit only the design doc on `feat/SC-004-<slug>`.
6. Report design doc path, commit SHA, eight designer answers, top 3 implementer risks, and any discovery items.
