# Plain-language label review — pass 1 (post-Wave 1)

**Status:** Audit (no code change required)
**Card:** COPY-001
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/71
**Source under audit:** `src/features/arguments/gameCopy.ts` (PLAIN_LANGUAGE_COPY map only)
**Snapshot point:** post-BR-001 / LIFE-001 / META-001 (Wave 1 of Stage 6.6)
**Audit date anchor:** 2026-05-19

This audit categorizes every entry in `PLAIN_LANGUAGE_COPY` by semantic level, documents known and newly-surfaced collisions, and specifies render-time qualification rules that future consumers (SC-004, ST-002, RULE-003) must encode. It does NOT propose label changes — the doctrine slip surface is the consumer, not the copy table.

---

## 1. Scope and method

### 1.1 What this audit covers

- Every entry currently in `PLAIN_LANGUAGE_COPY` (the `PlainLanguageKey` union — 78 unique keys at time of audit).
- Each entry's semantic level (validation code, semantic axis, runner status, lifecycle state, manual tag, auto metadata, participant/role).
- Every doctrine ban-list (verdict / amplification / person-attribution / block-semantics) — re-confirmed against `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()`.
- Pairs of entries that render an identical or near-identical user-visible string ("collisions").
- The render-time qualification rules consumers (SC-004, ST-002, RULE-003) must encode to disambiguate collisions WITHOUT relabeling either entry.

### 1.2 What this audit does NOT do

- It does not propose label changes. Any change to `PLAIN_LANGUAGE_COPY` would force a snapshot test update in `metadataPlainLabels.test.ts` / `pointLifecyclePlainLabels.test.ts` and is out of scope for an audit pass.
- It does not introduce a `toPlainLanguageQualified(context, code)` overload. That belongs to SC-004 / ST-002 consumer code.
- It does not enumerate codes that have not yet been added to `PLAIN_LANGUAGE_COPY`. The audit is a snapshot, not a forward roadmap.
- It does not redefine the doctrine ban-lists. The existing ban-lists in `_forbiddenLifecycleTokens()` / `_forbiddenMetadataTokens()` are canonical.

### 1.3 How "collision" is defined for this audit

Two `PLAIN_LANGUAGE_COPY` entries collide when:

- Their `value` strings are exactly equal after trimming, OR
- Their `value` strings are equal under ASCII case-fold + whitespace normalization.

Near-collisions are entries whose values share the dominant noun phrase ("Source attached" vs "Sourced" — different keys, similar surface) but read differently. These are flagged separately because they may still confuse a user when stacked in a header / chip strip.

---

## 2. Semantic levels (the categorization spine)

Every entry maps to exactly one of these semantic levels. Render-time qualification rules consume the level, not the entry value.

| Level | Definition | Where it appears | Owner module |
| --- | --- | --- | --- |
| `validation_code` | A non-blocking validation rail signal. Read from `submit-argument` validation output. Always advisory; never blocks posting. | Validation rail in the composer / sidecar. | `src/features/composer/validationRail.ts` (consumes the codes; the labels live in `gameCopy.ts`). |
| `semantic_axis` | A class of disagreement axis (`source_chain`, `scope`, `definition`, `logic`, `causal`, `anti_amplification`, `evidence_debt`, `platform_support_warning`) — used by RULE-001's semantic-code map. | Sidecar axis chips, validation rail axis chips. | `src/features/arguments/ruleToUiMap.ts` (RULE-001). |
| `runner_status` | Bot / Edge Function pipeline status code. Surfaced when a runner stops (`validation_failed_after_retries`, `max_depth_reached`, `submit_failed`, `three_in_a_row_failures`, `synthesis`, `concession`). | Operator diagnostics + (when promoted to user-visible) admin tab; for normal users, generally suppressed. | `scripts/bot-fixtures/*` + `submit-argument` Edge Function. |
| `participant_role` | The role a user holds in a room (observer, moderator, affirmative, negative, neutral). | Side action rail, gallery badges, profile chips. | `src/features/debates/roles.ts`. |
| `lifecycle_state` | A LIFE-001 cluster-scope state. Describes the **resting state of a cluster of moves on a single axis**. Worst-priority-wins aggregation. NEVER move-scope. | Cluster header on the timeline node action dock; gallery cluster mini-status; sidecar cluster summary. | `src/features/lifecycle/pointLifecycleModel.ts`. |
| `manual_tag` | A META-001 participant-applied tag on a single move. Eligibility-gated by role + scope per `MANUAL_TAG_ELIGIBILITY`. NEVER cluster-scope. | Per-move chip strip (selected node); composer "Tag this move" picker; RULE-003 helper text. | `src/features/metadata/manualTagModel.ts`. |
| `auto_metadata` | A META-001 deterministically-derived observation about a single move. Observed from timeline + lifecycle + EV-001 contracts. NEVER cluster-scope. | Per-move chip strip (selected node); AN-003 diagnostics. | `src/features/metadata/autoMetadataModel.ts`. |

Important: the lifecycle/manual-tag/auto-metadata trichotomy is the load-bearing concept for the COPY-001 disambiguation rule. The same noun phrase ("Has a reply") can be doctrinally correct at two levels (cluster-scope LIFECYCLE vs move-scope AUTO_METADATA) — and the dock NEVER renders both on the same line. SC-004 owns that dedup.

---

## 3. Entry-by-entry categorization

Format: `key` → label → semantic level → notes.

### 3.1 Validation rail codes (17 entries)

| key | label | level | notes |
| --- | --- | --- | --- |
| `topic_satisfaction_lexical` | This reply needs a clearer link to the active card. | `validation_code` | Advisory only per Stage 6.2 (was blocking pre-6.2). |
| `weak_relevance` | Needs a stronger tie-in | `validation_code` | Sentence-fragment label — used in pill chips. |
| `parent_nonresponsive` | Optional: tie this more directly to the parent. | `validation_code` | Advisory only per Stage 6.2. |
| `tangent_shift` | Looks like it drifted from the parent. | `validation_code` | Advisory only. |
| `off_topic` | This may be drifting from the topic. | `validation_code` | Advisory only per Stage 6.2. |
| `weak_topic` | Topic coverage is light. | `validation_code` | Advisory only. |
| `unclear_claim` | Short body — a longer reply is usually clearer. | `validation_code` | Advisory only. |
| `excessive_length` | Too long — trim it down. | `validation_code` | Advisory only. |
| `invalid_transition` | That move type isn't allowed here. | `validation_code` | Blocking. Engine refusal. The closest the table comes to "block" semantics, but the label uses "isn't allowed here" — describes the move, not the user. Passes ban-list (no `block` / `reject` / `forbid` / `disallow` token). |
| `evidence_required` | Evidence post needs at least one source. | `validation_code` | Blocking. Describes the move, not the user. |
| `missing_parent` | There's nothing to reply to yet. | `validation_code` | Blocking edge case (root-only state). |
| `loaded_clarification` | Clarification reads loaded — keep it neutral. | `validation_code` | Advisory only. |
| `duplicate` | That's very similar to an existing reply. | `validation_code` | Advisory only. |
| `concession_evasion` | Concession looks like it dodges the original point. | `validation_code` | Advisory only. Describes the *move*'s shape, not the user's intent. |
| `fact_confusion` | There's uncertainty mixed with a factual challenge. | `validation_code` | Advisory only. |
| `ad_hominem` | Keep it about the claim, not the person. | `validation_code` | Advisory only. Reinforces person-attribution doctrine in the helper itself. |
| `civility_risk` | Tone is getting heated. | `validation_code` | Advisory only. Describes message tone, not user character. |

### 3.2 Semantic axes (8 entries — RULE-001 surface)

| key | label | level | notes |
| --- | --- | --- | --- |
| `source_chain` | Source trail | `semantic_axis` | Used by EV-001 popover header + sidecar axis chip. |
| `anti_amplification` | Popularity is not proof | `semantic_axis` | RULE-001 mapping. Uses the doctrinal phrase verbatim. |
| `evidence_debt` | Evidence debt | `semantic_axis` AND `manual_tag` | **Cross-level reuse — see §4.2.** META-001 explicitly updated this from the earlier "Receipts needed" to the manual-tag label so the same string reads correctly in both layers. |
| `platform_support_warning` | Do not score as proven yet | `semantic_axis` | The anti-amplification gate's "no factual standing yet" advisory. |
| `scope` | Scope dispute | `semantic_axis` | RULE-001 mapping. |
| `definition` | Definition dispute | `semantic_axis` | RULE-001 mapping. |
| `logic` | Logic challenge | `semantic_axis` | RULE-001 mapping. |
| `causal` | Mechanism challenge | `semantic_axis` | RULE-001 mapping. |

### 3.3 Runner / pipeline status (6 entries)

| key | label | level | notes |
| --- | --- | --- | --- |
| `validation_failed_after_retries` | The move needs a clearer shape before it can play well. | `runner_status` | Normal-user friendly. |
| `max_depth_reached` | Deep unresolved chain | `runner_status` | |
| `synthesis_ready` | Ready for synthesis | `runner_status` AND `lifecycle_state` AND (manual tag `ready_for_synthesis` renders the same label) | **Cross-level reuse — see §4.1.** |
| `synthesis` | Resolved | `runner_status` | Distinct from lifecycle `archived_or_resolved` (also "Resolved"). See §4.3. |
| `concession` | Conceded | `runner_status` | Distinct from lifecycle `conceded` ("Conceded by author"). |
| `submit_failed` | Posting failed | `runner_status` | |
| `three_in_a_row_failures` | Posting kept failing — try a different angle. | `runner_status` | |

### 3.4 Participant / role (5 entries)

| key | label | level | notes |
| --- | --- | --- | --- |
| `observer` | Watching | `participant_role` | |
| `moderator` | Observer | `participant_role` | **Surprising mapping.** The DB role `moderator` renders as "Observer" because v1 moderators do not have an in-room voice — they only review flags. This is intentional but warrants a CLAUDE.md cross-check (§7 below). |
| `affirmative` | For | `participant_role` | Gallery / side rail label. |
| `negative` | Against | `participant_role` | Gallery / side rail label. |
| `neutral` | Neutral | `participant_role` | |

### 3.5 Lifecycle states (19 entries — LIFE-001 vocabulary)

All cluster-scope. Owner: `src/features/lifecycle/pointLifecycleModel.ts`.

| key | label | level | notes |
| --- | --- | --- | --- |
| `open` | Open for response | `lifecycle_state` | Initial state. |
| `answered` | Has a reply | `lifecycle_state` | **Collision with `has_reply`.** See §4.1. |
| `rebutted` | Under pressure | `lifecycle_state` | |
| `clarified` | Clarified | `lifecycle_state` | |
| `sourced` | Source attached | `lifecycle_state` | **Collision with `source_attached`.** See §4.4. |
| `quote_requested` | Quote requested | `lifecycle_state` AND `auto_metadata` | **Intentional cross-level reuse — see §4.5.** |
| `source_requested` | Source requested | `lifecycle_state` AND `auto_metadata` | **Intentional cross-level reuse — see §4.5.** |
| `narrowed` | Narrowed | `lifecycle_state` | |
| `conceded` | Conceded by author | `lifecycle_state` | Doctrine: concession is a scoring repair, not a defeat. Label says "by author" to make the self-directed nature explicit. |
| `confirmed` | Confirmed by other side | `lifecycle_state` | Note: `confirmed` is not "true". It means the opposing side acknowledged the point. The qualifier "by other side" makes the move-source explicit. |
| `synthesis_ready` | Ready for synthesis | `lifecycle_state` AND `runner_status` AND (`ready_for_synthesis` manual tag → same label) | **Cross-level reuse — see §4.1.** |
| `moved_on_by_affirmative` | Affirmative moved on | `lifecycle_state` | |
| `moved_on_by_negative` | Negative moved on | `lifecycle_state` | |
| `ignored_by_affirmative` | Affirmative did not respond | `lifecycle_state` | |
| `ignored_by_negative` | Negative did not respond | `lifecycle_state` | |
| `ignored_by_both` | Nobody followed up | `lifecycle_state` | |
| `exhausted` | Out of new angles | `lifecycle_state` | |
| `branch_recommended` | Branch suggested | `lifecycle_state` | **Collision with `branch_suggested`.** See §4.6. |
| `archived_or_resolved` | Resolved | `lifecycle_state` | **Collision with `synthesis` runner status.** See §4.3. |

### 3.6 Manual tags (10 entries — META-001 vocabulary, the participant-applied layer)

All move-scope. Owner: `src/features/metadata/manualTagModel.ts`.

| key | label | level | notes |
| --- | --- | --- | --- |
| `needs_source` | Needs source | `manual_tag` | |
| `needs_quote` | Needs quote | `manual_tag` | |
| `definition_issue` | Definition fight | `manual_tag` | Distinct from semantic axis `definition` ("Definition dispute"). The manual-tag label is the participant-applied annotation; the axis label is the system's classification of the disagreement type. Near-collision. See §4.7. |
| `scope_issue` | Scope challenge | `manual_tag` | Near-collision with semantic axis `scope` ("Scope dispute"). See §4.7. |
| `causal_mechanism` | Mechanism challenge | `manual_tag` | Same noun ("Mechanism challenge") as semantic axis `causal` ("Mechanism challenge") — **exact collision.** See §4.8. |
| `evidence_debt` | Evidence debt | `manual_tag` AND `semantic_axis` | Intentional same-label reuse. See §4.2. |
| `concession_offered` | Concession offered | `manual_tag` | Distinct from lifecycle `conceded` ("Conceded by author"). |
| `narrowed_claim` | Narrowed claim | `manual_tag` | Distinct from lifecycle `narrowed` ("Narrowed"). |
| `tangent` | Tangent / side issue | `manual_tag` | |
| `ready_for_synthesis` | Ready for synthesis | `manual_tag` | Same label as lifecycle `synthesis_ready`. See §4.1. |

### 3.7 Auto-derived metadata (16 entries — META-001 vocabulary, the deterministic layer)

All move-scope. Owner: `src/features/metadata/autoMetadataModel.ts`.

| key | label | level | notes |
| --- | --- | --- | --- |
| `has_reply` | Has a reply | `auto_metadata` | **Collision with lifecycle `answered`.** See §4.1. |
| `has_rebuttal` | Has a challenge | `auto_metadata` | |
| `has_counter_rebuttal` | Has a counter-challenge | `auto_metadata` | |
| `has_evidence` | Evidence attached | `auto_metadata` | Near-collision with lifecycle `sourced` ("Source attached") + auto `source_attached` ("Source attached"). Different noun ("Evidence" vs "Source") so the user-visible distinction holds. See §4.4. |
| `source_requested` | Source requested | `auto_metadata` AND `lifecycle_state` | Intentional cross-level reuse. See §4.5. |
| `quote_requested` | Quote requested | `auto_metadata` AND `lifecycle_state` | Intentional cross-level reuse. See §4.5. |
| `source_attached` | Source attached | `auto_metadata` | **Collision with lifecycle `sourced`.** See §4.4. |
| `quote_attached` | Quote attached | `auto_metadata` | |
| `participant_skipped_node` | Same side skipped | `auto_metadata` | |
| `no_response_after_n_turns` | No follow-up yet | `auto_metadata` | |
| `repeated_axis_pressure` | Repeated challenge on same axis | `auto_metadata` | |
| `branch_suggested` | Branch suggested | `auto_metadata` | **Collision with lifecycle `branch_recommended`.** See §4.6. |
| `branch_created` | Branch created here | `auto_metadata` | |
| `point_stalled` | Point stalled | `auto_metadata` | |
| `point_exhausted` | Point exhausted | `auto_metadata` | Distinct from lifecycle `exhausted` ("Out of new angles"). Same noun ("exhausted") but different surface label. Near-collision. See §4.9. |
| `synthesis_candidate` | Synthesis candidate | `auto_metadata` | Near-collision with lifecycle `synthesis_ready` / manual tag `ready_for_synthesis` ("Ready for synthesis"). Different label. |

**Entry count check.** 17 validation + 8 axes + 7 runner + 5 role + 19 lifecycle + 10 manual + 16 auto = 82 listed entries. PLAIN_LANGUAGE_COPY's `PlainLanguageKey` union exposes 78 unique keys. The 4-entry delta is exactly the documented cross-level **key reuse** (same key serves two levels — counted once in the union but listed under both levels above): `evidence_debt` (axis + manual), `synthesis_ready` (lifecycle + runner), `quote_requested` (lifecycle + auto), `source_requested` (lifecycle + auto). Separately, the 5 manual-tag / auto-metadata pairs that share *labels but NOT keys* (`answered`/`has_reply`, `sourced`/`source_attached`, `branch_recommended`/`branch_suggested`, `narrowed`/`narrowed_claim`, `conceded`/`concession_offered`) contribute distinct keys to the union — they count once each. This delta is expected and structural. Tests in `metadataPlainLabels.test.ts` lines 184–196 already assert the 26 META-001 codes (10 manual + 16 auto) are all present in the map.

---

## 4. Collisions and near-collisions

A collision is two PLAIN_LANGUAGE_COPY entries that render the same user-visible string. Each one needs a render-time qualification rule (in the **consumer**, not the **copy table**) so the user sees the right semantic surface for the right scope.

### 4.1 Collision: `answered` (lifecycle) vs `has_reply` (auto) → both render "Has a reply"

**Severity:** known, documented in META-001. The most prominent collision in the table. Promoted to issue COPY-001 explicitly.

**Why both exist:** A cluster of moves on an axis can be in resting state `answered` ("at least one reply has landed on this axis") while a *specific* move within that cluster carries the auto-metadata observation `has_reply` ("this exact node has at least one direct child"). They describe the same observable fact at two different scopes.

**Why the labels are kept identical:** The plain-language noun phrase ("a reply exists") is the doctrinally honest one for both scopes. Forcing a different noun on one of them ("Has a child node" / "Continuation observed") would either leak structural jargon or imply a verdict-flavored "answered = settled". The fix is at the consumer.

**Render-time qualification rule (SC-004 / ST-002 / RULE-003 MUST implement):**

> **Rule R1 — scope-strict positioning.**
> A surface that renders cluster-scope codes MUST NOT render move-scope codes in the same visual band, and vice versa. The cluster header reads from `getPointLifecyclePlainLabel(cluster.state)` only. The per-move chip strip reads from `getAutoMetadataPlainLabel(autoCode)` / `getManualTagPlainLabel(tagCode)` only.

> **Rule R2 — same-label dedup.**
> When a single dock / chip strip / sidecar panel would render the cluster-scope label `"Has a reply"` (via `answered`) AND a move-scope chip with the same label `"Has a reply"` (via `has_reply`) on the same render, the move-scope chip is **suppressed**. Cluster header wins. This is asserted by SC-004's `timelineNodeActionDockDoctrine.test.ts` (see SC-004 design §"COPY-001 dedup test").

**What SC-004 already encodes:** SC-004 design §"Cluster header + per-move chip" (lines 210–249) and §"COPY-001 dedup test" (lines 761–763) implement R1 + R2 explicitly. COPY-001's contribution is to make those rules **portable to any other future consumer** (ST-002 suggested-move chips, RULE-003 reference card, GAL-002 gallery cards, AN-003 diagnostics).

**Other consumers (ST-002, RULE-003) consume rule R1 + R2:** Both must implement the cluster-header-vs-move-chip separation. If ST-002 builds a "suggested next move" chip from a node-scope code, it must use the auto-metadata label, never the lifecycle label, even when the lifecycle aggregate happens to share a noun.

### 4.2 Cross-level reuse (NOT a collision): `evidence_debt` is BOTH a manual tag AND a semantic axis

**Why both exist:** The semantic-axis layer (`source_chain` / `scope` / `definition` / `logic` / `causal` / `anti_amplification` / `evidence_debt` / `platform_support_warning`) is consumed by RULE-001's semantic-code-to-UI map. The manual-tag layer (`needs_source` / `needs_quote` / `definition_issue` / `scope_issue` / `causal_mechanism` / `evidence_debt` / ...) is consumed by participants who tag their own / others' moves.

**Why the label is identical:** META-001 deliberately unified the label so that the user sees "Evidence debt" as the same phrase whether it's:
- An axis the validator surfaced ("This move has open evidence debt against the axis the parent introduced.")
- A tag a participant applied ("I'm flagging this move as having evidence debt.")

**Render-time qualification rule:**

> **Rule R3 — provenance suffix.**
> Surfaces that render `evidence_debt` MUST attach a provenance hint adjacent to the chip:
> - When sourced from RULE-001 axis classification: chip carries an `axis` provenance dot.
> - When sourced from a participant manual tag: chip carries the tagger's avatar / role glyph.
> The label itself is unchanged.

This rule was implicit in META-001's eligibility design (`MANUAL_TAG_ELIGIBILITY` records who can apply each tag). COPY-001 makes it explicit for the design layer.

### 4.3 Collision: `synthesis` (runner) vs `archived_or_resolved` (lifecycle) → both render "Resolved"

**Severity:** medium. The runner code `synthesis` is essentially never user-visible (it surfaces only when a corpus runner reports "this room ended in synthesis"). The lifecycle code `archived_or_resolved` is the canonical cluster-scope "resolved" signal.

**Why both exist:** `synthesis` is a runner outcome — it describes a single move pipeline result (the runner produced a synthesis move). `archived_or_resolved` is a cluster state — it describes the resting state of an entire cluster of moves.

**Why the labels are kept identical:** A user who sees a "Resolved" badge does not need to distinguish "the runner produced a synthesis here" from "this cluster has reached a resolved state". For the user, both mean "this is closed."

**Render-time qualification rule:**

> **Rule R4 — runner-status suppression in normal-user surfaces.**
> The runner-status codes (`synthesis`, `concession`, `submit_failed`, `validation_failed_after_retries`, `three_in_a_row_failures`, `max_depth_reached`) MUST NOT appear in normal-user UI as primary labels. They are operator / corpus / AN-003 diagnostics. When a runner output bubbles up to a normal user, the consumer renders the LIFECYCLE state of the affected cluster (`archived_or_resolved` → "Resolved") instead. The runner code is dropped or routed to an admin/debug tab.

**Consumer responsibility:** SC-004 already does this — its `clusterHeader.lifecycleLabel` always reads the lifecycle state, never a runner code. RULE-003 and ST-002 must do the same.

### 4.4 Collision: `sourced` (lifecycle) vs `source_attached` (auto) → both render "Source attached"

**Severity:** high. This is the **second-most prominent collision in the table** and was not surfaced in the COPY-001 issue body. It is structurally identical to §4.1 (cluster-scope lifecycle "this cluster has a sourced move in it" vs move-scope auto-metadata "this exact node has a source attached").

**Why both exist:** Same reason as §4.1. The cluster carries the state "at least one move in this cluster is sourced"; an individual move carries the observation "this node has source-bearing evidence attached".

**Render-time qualification rule:** Rule R1 + R2 (above) cover this verbatim. Cluster header reads `sourced` → "Source attached"; move chip strip reads `source_attached` → "Source attached"; same-label dedup applies (move chip suppressed when cluster header already shows the same string).

**Action required:** SC-004's dedup test (`timelineNodeActionDockDoctrine.test.ts`) should add a second case asserting the same suppression behavior for `sourced` + `source_attached`. The test currently asserts only the `answered` + `has_reply` pair per COPY-001's prompt. The implementer of COPY-001's follow-up — or of ST-002, whichever lands first — should extend the test.

### 4.5 Cross-level reuse (NOT a collision): `quote_requested` and `source_requested` are BOTH lifecycle AND auto metadata

**Why both exist:** The lifecycle layer treats "quote requested" / "source requested" as cluster-resting states — when the most-recent move on a cluster is a quote/source request, the whole cluster sits in that lifecycle state. The auto-metadata layer treats them as per-move observations — "this exact move is a quote/source request."

**Why the labels are kept identical:** The user reading the cluster header or a per-move chip wants the same phrase ("Source requested") in both places; the disambiguation is positional, not lexical.

**Render-time qualification rule:** Rule R1 (scope-strict positioning) covers it. Same-label dedup (Rule R2) also applies when the selected move's auto-metadata happens to match the cluster header.

### 4.6 Collision: `branch_recommended` (lifecycle) vs `branch_suggested` (auto) → "Branch suggested"

**Severity:** medium. Cluster-scope `branch_recommended` ("the cluster has hit the depth/breadth threshold where a branch is recommended") renders as "Branch suggested". Move-scope `branch_suggested` ("this exact move triggered the branch-suggestion heuristic") renders as "Branch suggested".

**Render-time qualification rule:** Rule R1 + R2 apply unchanged.

### 4.7 Near-collision: semantic axis `scope` / `definition` vs manual tags `scope_issue` / `definition_issue`

| key | label | scope |
| --- | --- | --- |
| `scope` (axis) | Scope dispute | system classification |
| `scope_issue` (manual tag) | Scope challenge | participant annotation |
| `definition` (axis) | Definition dispute | system classification |
| `definition_issue` (manual tag) | Definition fight | participant annotation |

**Why near, not exact:** the user-visible nouns differ ("dispute" vs "challenge" / "fight"). However, on a chip strip that mixes axis chips and manual tags, the labels read as redundant ("Scope dispute · Scope challenge"). This is a UX hygiene issue more than a doctrine slip.

**Render-time qualification rule:**

> **Rule R5 — axis-vs-manual-tag dedup on shared semantic root.**
> When a chip strip would render an axis chip AND a manual-tag chip whose labels share the dominant semantic root word (`scope*`, `definition*`, `mechanism*`, `evidence*`), the consumer renders the **axis chip first** (system classification has priority) and **suppresses the manual-tag chip**. Provenance is preserved by an "from: <tagger>" affordance on hover / long-press of the axis chip; the underlying tag is still in the ledger.

**Open question for SC-004 / RULE-003:** Rule R5 is a hygiene rule, not a doctrine rule. RULE-003 should decide whether to ship it in v1 or v1.1. If it ships in v1.1, the v1 fallback is: render both chips, no dedup. The labels do not violate doctrine; they only feel redundant.

### 4.8 Collision: semantic axis `causal` vs manual tag `causal_mechanism` → both render "Mechanism challenge"

**Severity:** medium. This is an exact same-label collision across two semantic levels (axis vs manual tag).

**Why the labels are kept identical:** META-001 chose "Mechanism challenge" for the manual tag because it reads more naturally than "Causal mechanism" or "Causality dispute". The axis label `causal` was already "Mechanism challenge" from RULE-001.

**Render-time qualification rule:** Rule R5 (above) applies. When both an axis chip and a manual-tag chip would render "Mechanism challenge" on the same strip, the axis chip wins and the manual-tag chip is suppressed.

### 4.9 Near-collision: lifecycle `exhausted` ("Out of new angles") vs auto `point_exhausted` ("Point exhausted")

**Why near, not exact:** Different nouns ("Out of new angles" vs "Point exhausted"). However, both render in a "this point is winding down" zone of the UI. A user might wonder why a per-move chip says "Point exhausted" while the cluster header says "Out of new angles" — the answer is that the cluster has multiple moves and is described aggregately, while a single move can be observed as exhausted within an otherwise-open cluster.

**Render-time qualification rule:** No new rule needed. Rule R1 (scope-strict positioning) already gates this. RULE-003 should document the helper line for each: cluster `exhausted` → "Both sides have stopped finding new angles here." Move `point_exhausted` → "This specific move has no remaining direct moves available."

---

## 5. Doctrine ban-list re-confirmation

Every entry in PLAIN_LANGUAGE_COPY was scanned (case-insensitive substring match) against the union of:

- `_forbiddenLifecycleTokens()` — verdict + amplification + block-semantics tokens used to gate LIFE-001 labels.
- `_forbiddenMetadataTokens()` — verdict + amplification + block-semantics tokens used to gate META-001 labels.

Token list as of audit (identical between the two helpers):

```
verdict:        winner, loser, correct, incorrect, true, false, liar,
                dishonest, bad faith, manipulative, extremist, propagandist,
                troll, bot, astroturfer, verdict, proof, proven, disproven,
                lost, defeated, won
amplification:  likes, retweets, shares, views, followers, verified,
                engagement, amplification, trending, virality, popular, viral
block:          block, prevent, reject, forbid, disallow, denied
```

**Result: ZERO drifts.** Every label scans clean.

### 5.1 Tokens called out by the COPY-001 issue but NOT in the helper ban-lists

The COPY-001 issue body lists these doctrine-banned tokens explicitly:

- **verdict tokens** the issue called out that ARE in the helpers: `winner`, `loser`, `liar`, `true`, `false`, `verdict`, `proof`, `proven`, `correct`, `incorrect`, `lost`, `defeated`, `won`.
- **verdict tokens** the issue called out that are NOT in the helpers: `right`, `wrong`, `validated`.
- **amplification tokens** the issue called out that ARE in the helpers: `popular`, `viral`, `trending`.
- **amplification tokens** the issue called out that are NOT in the helpers: `hot`.

Manual scan against the gap tokens (`right`, `wrong`, `validated`, `hot`):

- `right` — substring `right` appears in zero entries. (Check: no labels contain "right" as a standalone word OR as substring.) Pass.
- `wrong` — substring `wrong` appears in zero entries. Pass.
- `validated` — substring `validated` appears in zero entries. Pass. (Note: the validation rail uses the *code* `validation_failed_after_retries`, whose **label** is "The move needs a clearer shape before it can play well." — no "validated" token.)
- `hot` — substring `hot` appears in zero PLAIN_LANGUAGE_COPY entries. (The label "Tone is getting heated." contains "heated" but the substring `h-o-t` is not in "heated".) Pass within PLAIN_LANGUAGE_COPY scope. Outside that scope, `hot` appears in `GALLERY_SECTIONS` (sibling map in `gameCopy.ts`): "Hot rooms with active back-and-forth." and "Hot but unresolved". This is OUT OF SCOPE for COPY-001 (which audits PLAIN_LANGUAGE_COPY only), but worth flagging here: the usage IS doctrine-consistent under the carve-out in `cdiscourse-doctrine` §2 ("Hot = recent move count, unresolved axes, branch depth, no-rebuttal pressure. 'Hot' does NOT mean correct, popular, important, or trending"). The accompanying section subheads ("active back-and-forth", "Long threads still searching for a resolution") clarify that "Hot" describes activity, not popularity. A future audit pass on GALLERY_SECTIONS should re-confirm this carve-out is the only "hot" usage and that it remains paired with activity-clarifying subheads.

**Recommendation to the implementer of COPY-001's follow-up:** Three gap tokens (`right`, `wrong`, `validated`) should be added to `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` so the existing ban-list tests catch any future drift. This is a one-line append in each helper plus a regression test that asserts each of the 3 tokens is in the ban list. This change is **purely additive** and does not change any current label.

The fourth gap token (`hot`) is **explicitly NOT recommended** for the ban-list because doctrine §2 carves out a legitimate use for "hot" as a synonym for *activity / friction* (recent move count, unresolved axes, branch depth, no-rebuttal pressure). Adding `hot` to the ban-list would break the existing — and doctrine-permitted — gallery-section subheads ("Hot rooms with active back-and-forth.", "Hot but unresolved"). Future "hot" drift toward popularity / truth meaning must be caught by reviewer judgement, not by the token ban-list, because the same word is permitted under one semantic and banned under another.

> **Proposed regression test (sketch):**
> `__tests__/copyReviewBanListGaps.test.ts`
> Imports `_forbiddenLifecycleTokens` and `_forbiddenMetadataTokens`.
> Asserts each of `right`, `wrong`, `validated` is present in both arrays.
> Re-runs the existing per-label scan against the expanded list.
> Optionally asserts that `hot` is NOT in either array, documenting the doctrine §2 carve-out as a test invariant.

### 5.2 Person-attribution sweep

Doctrine: a label describes the **move** or the **cluster**, never the **user**.

Audited entries that read most closely to person-attribution:

- `conceded` → "Conceded by author" — the phrase "by author" describes who made the move, not who the user *is*. Doctrine-passing.
- `confirmed` → "Confirmed by other side" — the phrase "by other side" describes whose move confirmed it. Doctrine-passing.
- `moved_on_by_affirmative` → "Affirmative moved on" — describes the affirmative side's pattern of moves, not the user's character. Doctrine-passing.
- `moved_on_by_negative` → "Negative moved on" — symmetric. Doctrine-passing.
- `ignored_by_affirmative` / `ignored_by_negative` / `ignored_by_both` → "Affirmative did not respond" / "Negative did not respond" / "Nobody followed up" — describes move-stream pattern, not user character. Doctrine-passing.
- `ad_hominem` → "Keep it about the claim, not the person." — the *helper* explicitly reinforces person-attribution doctrine. Doctrine-passing.
- `participant_skipped_node` → "Same side skipped" — describes a turn-order pattern. Doctrine-passing.

All clear.

### 5.3 Block-semantics sweep

The closest entry to block semantics is `invalid_transition` → "That move type isn't allowed here." This is a **blocking** validation outcome but the label uses the phrasing "isn't allowed here" — describes the move and the location, not the user. The 6 forbidden block tokens (`block`, `prevent`, `reject`, `forbid`, `disallow`, `denied`) are all absent.

All clear.

---

## 6. Render-time qualification rules — summary table for SC-004 / ST-002 / RULE-003

| Rule | Statement | Consumer who must implement | Status |
| --- | --- | --- | --- |
| R1 | A surface that renders cluster-scope codes MUST NOT render move-scope codes in the same visual band, and vice versa. | SC-004 dock, ST-002 suggestion chips, RULE-003 reference card. | Implemented in SC-004 design (lines 210–249). Pending in ST-002 / RULE-003 (not yet designed). |
| R2 | When a cluster header and a move chip would render the same plain-language string on the same surface, the move chip is suppressed (cluster wins). | SC-004 dock, ST-002, RULE-003. | Implemented in SC-004 design (lines 715–763). Pending in ST-002 / RULE-003. |
| R3 | Surfaces that render `evidence_debt` attach a provenance hint (axis dot vs tagger glyph). The label is unchanged. | RULE-001 axis chip, META-001 manual-tag chip, SC-004 dock, ST-002. | Implicit in META-001 eligibility model. COPY-001 promotes it to an explicit render rule. |
| R4 | Runner-status codes (`synthesis`, `concession`, `submit_failed`, `validation_failed_after_retries`, `three_in_a_row_failures`, `max_depth_reached`) MUST NOT appear in normal-user UI as primary labels. They are operator / admin / debug only. The lifecycle state of the affected cluster is rendered instead. | All normal-user surfaces (SC-004, ST-002, GAL-002, gallery, sidecar). | Implemented as the existing `toPlainLanguageOrSuppress` discipline. COPY-001 makes the suppression target explicit. |
| R5 | When a chip strip would render an axis chip AND a manual-tag chip sharing the dominant semantic root (`scope*`, `definition*`, `mechanism*`, `evidence*`), the axis chip wins; the manual-tag chip is suppressed; provenance is preserved on hover / long-press. | RULE-003 (label map), SC-004 dock. | Pending. Could ship in v1.1 — v1 fallback is render both chips. |

---

## 7. Surprising / non-obvious mappings worth re-confirming

These are not drifts. They are intentional choices that a downstream implementer or reviewer might mis-read as drifts.

- **`moderator` → "Observer"** is intentional. In v1 there is no in-room moderator voice — `moderator` is a DB role for flag review, not a participant. Surfacing "Moderator" on the side-rail would imply an authority the v1 product does not grant. CLAUDE.md (Stage 6.4 line) corroborates: the action rail does not expose moderator controls in-room. **No change recommended.** If a reviewer flags this, point them at the action rail spec.

- **`conceded` → "Conceded by author"** with the "by author" qualifier is intentional. It anchors the doctrine "concession is self-directed — you own it." (See `CONCESSION_COPY.concessionSelfDirected`.) **No change recommended.**

- **`confirmed` → "Confirmed by other side"** is intentional. It explicitly states the move-source (the OTHER side acknowledged the point). Without the qualifier, a user might read "Confirmed" as a truth assertion. **No change recommended.**

- **`synthesis_ready` → "Ready for synthesis"** (not "Near resolution") is the LIFE-001-corrected label per the audit history. **No change recommended.**

- **`evidence_debt` → "Evidence debt"** (not "Receipts needed") is the META-001-corrected label per the audit history. **No change recommended.**

- **`synthesis` (runner) → "Resolved"** vs **`archived_or_resolved` (lifecycle) → "Resolved"** — both correct under Rule R4 (runner status is operator-only in normal-user UI; lifecycle wins). **No change recommended.**

---

## 8. Required follow-ups for the implementer

If the operator chooses to land any code change as a result of this audit, the changes are small and additive:

1. **Add 3 gap tokens to the ban-lists.** Append `right`, `wrong`, `validated` to `_forbiddenLifecycleTokens()` (in `src/features/lifecycle/pointLifecycleModel.ts`) and to `_forbiddenMetadataTokens()` (in `src/features/metadata/moveMetadataLedger.ts`). This is purely additive — no label changes. **Do NOT add `hot`**, because doctrine §2 carves out a legitimate "hot = activity" usage (see §5.1). Mandatory regression test: `__tests__/copyReviewBanListGaps.test.ts` asserts each of the 3 gap tokens is in both ban lists, that `hot` is NOT in either array, and that the existing per-label scan still passes.

2. **Extend the `sourced` + `source_attached` dedup test.** SC-004's `timelineNodeActionDockDoctrine.test.ts` should add a second case asserting Rule R2 for the `sourced` (cluster) + `source_attached` (move) pair, mirroring the existing `answered` + `has_reply` case.

3. **No label changes are recommended.** Every entry passes doctrine. Every collision is resolved by render-time qualification, not by relabeling.

**Items 1 and 2 are optional follow-ups, not blockers on landing COPY-001.** The audit itself is the deliverable; these are recommended hardening steps the implementer or the next consumer card (SC-004 follow-up / ST-002 design) can pick up.

---

## 9. Cross-references

- **SC-004** (timeline node action dock — merged design at `docs/designs/SC-004.md`): Implements R1 + R2 for the dock. Already documents the COPY-001 dedup rule (§"Cluster header + per-move chip" lines 210–249 and §"COPY-001 dedup test" lines 761–763).
- **ST-002** (suggested reply flags — roadmap §12, issue #13): Will consume R1 + R2 + (optionally) R5. Design pending.
- **RULE-003** (lifecycle-to-UX doctrine map — roadmap §12, issue #65): Will consume R1 + R2 + R5. Design pending. RULE-003 is the canonical home for the helper-line + icon + allowed-action triple per lifecycle/manual-tag/auto code; this audit gives RULE-003 the disambiguation rules it must encode.
- **META-001** (move tag + metadata ledger — `docs/designs/META-001.md`): The `_forbiddenMetadataTokens()` helper this audit re-scanned against.
- **LIFE-001** (point lifecycle model — `docs/designs/LIFE-001.md`): The `_forbiddenLifecycleTokens()` helper this audit re-scanned against.
- **RULE-001** (semantic-code-to-UI map — roadmap §12): Owns the 8 axis labels in §3.2. R3 + R5 implicate RULE-001 surfaces.

---

## 10. Audit version

This is **pass 1** (post-Wave 1 / BR-001 + LIFE-001 + META-001 merged). A pass-2 audit will be filed when Wave 2 lands (SC-004 + ST-002 + IX-001), at which point the in-product surfaces that render these labels will exist and a manual visual sweep across rendered chips becomes possible.
