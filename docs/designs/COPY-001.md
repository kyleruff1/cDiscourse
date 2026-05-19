# COPY-001 — Plain-language label review pass (post-Wave 1)

**Status:** Design draft
**Epic:** 12 — Rules UX (cross-cutting copy doctrine)
**Release:** 6.6 — Wave 1 follow-up
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/71

## Goal (one paragraph)

Run a focused audit pass over every entry in the `PLAIN_LANGUAGE_COPY` map (`src/features/arguments/gameCopy.ts`) post-Wave 1 (BR-001 + LIFE-001 + META-001 merged) to confirm: (a) every internal code a user-facing surface will render has a non-empty plain-language label; (b) no label drifts into verdict / amplification / person-attribution / block-semantics territory; (c) cross-level codes that share semantic surface (the known `answered` vs `has_reply` collision and any newly-surfaced collisions) are explicitly disambiguated at the **consumer** level via render-time qualification rules — never at the **copy** level. The audit is the deliverable. No code change to `gameCopy.ts` is recommended. The doctrine constraints from `cdiscourse-doctrine` (no truth labels, no popularity-as-evidence, no person-attribution) and `accessibility-targets` (chip-fit label length) are the inputs that shape the design.

## Data model

**No new data model.** This card produces docs only.

The audit consumes the existing data model unchanged:

- `PlainLanguageKey` union and `PLAIN_LANGUAGE_COPY` map (`src/features/arguments/gameCopy.ts`).
- `PointLifecycleState` + `ALL_POINT_LIFECYCLE_STATES` (`src/features/lifecycle/pointLifecycleModel.ts`).
- `ManualTagCode` + `AutoMetadataCode` + their `ALL_*_CODES` frozen arrays (`src/features/metadata/moveMetadataLedger.ts`).
- `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` helpers (the canonical doctrine ban-lists).

The audit also documents 5 render-time qualification rules (R1 through R5) as a portable contract that consumers (SC-004, ST-002, RULE-003) must encode. The rules live in the audit doc, not in code — encoding them in code is a consumer responsibility.

## File changes

This is a docs-only card.

**New files:**

- `docs/copy-review/plain-language-labels-pass-1.md` — the audit doc itself. ~530 lines. Contains: scope + method, full entry-by-entry categorization by semantic level (validation_code / semantic_axis / runner_status / participant_role / lifecycle_state / manual_tag / auto_metadata), collision + near-collision catalogue, render-time qualification rules (R1–R5), ban-list re-confirmation, surprising-mapping callouts, follow-up recommendations for the implementer, cross-references.
- `docs/designs/COPY-001.md` — this file. ~270 lines. Pointer + render-rule index.

**Modified files:** None.

**Deleted files:** None.

**Production code:** No change. The audit's findings are: (a) zero label drifts; (b) all 5 collisions / near-collisions resolve via render-time qualification rules at the consumer; (c) a 1-line additive ban-list expansion is *optionally* recommended for hardening but is not a blocker on COPY-001.

If the operator chooses to land the optional ban-list hardening as a separate follow-up, the changes are:

- `src/features/lifecycle/pointLifecycleModel.ts` — append 3 tokens (`right`, `wrong`, `validated`) to the array returned by `_forbiddenLifecycleTokens()` (line 291–304). ~3 lines. **Do NOT add `hot`** — doctrine §2 carves out a legitimate "hot = activity" usage in `GALLERY_SECTIONS`.
- `src/features/metadata/moveMetadataLedger.ts` — same 3-token append (`right`, `wrong`, `validated`) to `_forbiddenMetadataTokens()` (line 450–463). ~3 lines.
- `__tests__/copyReviewBanListGaps.test.ts` — new ~30-line regression test asserting the 3 gap tokens are in both ban-lists, that `hot` is NOT in either array (documenting the doctrine §2 carve-out as a test invariant), AND that the existing per-label scan still passes.

The hardening is purely additive — no current label is affected. It is documented in the audit (§8) but **NOT** in scope for COPY-001's design phase.

## API / interface contracts

No new APIs. The audit defines a contract that **consumers** (SC-004, ST-002, RULE-003) must implement; it does not add a contract that the audit itself owns.

### Render-time qualification rules (the contract for consumers)

Consumers that render any entry from `PLAIN_LANGUAGE_COPY` in a normal-user surface MUST implement the following five rules. Each rule is restated here from the audit doc for design-time visibility.

**Rule R1 — scope-strict positioning.**

> A surface that renders cluster-scope codes MUST NOT render move-scope codes in the same visual band, and vice versa. The cluster header reads `getPointLifecyclePlainLabel(cluster.state)` only. The per-move chip strip reads `getAutoMetadataPlainLabel(autoCode)` / `getManualTagPlainLabel(tagCode)` only.

Pseudocode for the rule:

```ts
// Cluster header — ONLY lifecycle codes.
header.lifecycleLabel = getPointLifecyclePlainLabel(cluster.state);

// Per-move chip strip — ONLY auto-metadata + manual-tag codes.
moveChips = [
  ...autoCodes.map((c) => ({ code: c, label: getAutoMetadataPlainLabel(c) })),
  ...manualCodes.map((c) => ({ code: c, label: getManualTagPlainLabel(c) })),
];
```

The two streams **never cross**. SC-004's `TimelineNodeActionDockClusterHeader` vs `TimelineNodeActionDockMoveChip` shape is the canonical implementation.

**Rule R2 — same-label dedup.**

> When a single dock / chip strip / sidecar panel would render the cluster-scope label AND a move-scope chip with the same label on the same render, the move-scope chip is **suppressed**. Cluster header wins.

Pseudocode:

```ts
const headerLabel = header.lifecycleLabel;
moveChips = moveChips.filter((chip) => chip.label !== headerLabel);
```

This rule covers the documented `answered` + `has_reply` collision AND the newly-surfaced `sourced` + `source_attached` collision AND the `branch_recommended` + `branch_suggested` collision.

**Rule R3 — provenance suffix on cross-level reuse.**

> When the same label is rendered from two semantic levels (e.g. `evidence_debt` as both an axis chip and a manual tag), the consumer attaches a provenance hint adjacent to the chip:
>
> - Axis-sourced: an `axis` provenance dot or icon.
> - Tag-sourced: the tagger's avatar / role glyph.
>
> The label itself is unchanged.

**Rule R4 — runner-status suppression in normal-user surfaces.**

> The runner-status codes (`synthesis`, `concession`, `submit_failed`, `validation_failed_after_retries`, `three_in_a_row_failures`, `max_depth_reached`) MUST NOT appear in normal-user UI as primary labels. They are operator / corpus / AN-003 diagnostics. When a runner output bubbles up to a normal user, the consumer renders the LIFECYCLE state of the affected cluster (`archived_or_resolved` → "Resolved") instead. The runner code is dropped or routed to an admin / debug tab.

**Rule R5 — axis-vs-manual-tag dedup on shared semantic root.**

> When a chip strip would render an axis chip AND a manual-tag chip whose labels share the dominant semantic root word (`scope*`, `definition*`, `mechanism*`, `evidence*`), the consumer renders the **axis chip first** and **suppresses the manual-tag chip**. Provenance is preserved by an "from: \<tagger\>" affordance on hover / long-press. The label itself is unchanged.

> R5 is a hygiene rule, not a doctrine rule. It MAY ship in v1.1 — the v1 fallback is "render both chips, no dedup." Both options pass doctrine.

### Rule consumption matrix

| Consumer | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| SC-004 (dock) — designed | required | required | required | required | optional v1.1 |
| ST-002 (suggested-move chips) — pending | required | required | required | required | optional v1.1 |
| RULE-003 (lifecycle-to-UX map) — pending | required | required | required | required | required |
| GAL-002 (gallery cards) — later | required | required | optional | required | optional |
| AN-003 (analytics) — later | n/a (admin/debug surface) | n/a | n/a | n/a | n/a |

## Edge cases

The audit anticipates the following edge cases that consumers must handle.

- **Empty cluster summary.** A cluster with no resolved lifecycle state still renders SOMETHING — consumers use the most-recent move's lifecycle as the cluster's; if even that is empty, the dock renders an empty `lifecycleLabel: ''`. Rule R1 + R2 still apply (no move chip dedup is needed when the header is empty).

- **Unknown code.** `toPlainLanguage('some_new_code')` returns `null`. Normal-user surfaces MUST route this through `toPlainLanguageOrSuppress` (which returns `null` and the consumer drops the chip). Admin / debug surfaces MAY echo the raw code. This is the existing Stage 6.4 discipline.

- **Selected node is the root.** Per SC-004 §"Five docking states" (root case), the move-chip strip is empty for root because root has no parent metadata signals like `has_reply`. The cluster header still renders. Rule R2 is a no-op (no move chips to dedup).

- **Same label across THREE levels.** `synthesis_ready` (lifecycle) AND `synthesis_ready` (runner status — different layer, same key) AND `ready_for_synthesis` (manual tag — different key, same LABEL "Ready for synthesis"). Under R4, the runner-status occurrence is suppressed in normal-user UI. Under R1 + R2, when the cluster header shows "Ready for synthesis" via the lifecycle state, the manual-tag chip with the same label is suppressed.

- **Collision in a non-dock surface (e.g. gallery card).** GAL-002 cards render cluster-state badges only (not move-level chips), so R1 + R2 are no-ops there. The rule the gallery cares about is R4 (don't surface runner-status as a card badge).

- **Concurrent edits to manual tags.** The auto-metadata + lifecycle + manual-tag ledgers are derived on each render — there is no race. If a tag is applied between two renders, the next render's chip strip is updated. Rule R2 is re-applied each render. No state to reconcile.

- **Permission-denied paths.** None. The audit produces docs only. RLS is unchanged.

- **Doctrine-constraint edge case: what if a future axis is added with a verdict-flavored noun?** The ban-list tests (`metadataPlainLabels.test.ts`, `pointLifecyclePlainLabels.test.ts`) re-scan every label against the forbidden-token helpers on every test run. Adding a new code without a doctrine-clean label is a test failure. COPY-001's optional ban-list hardening (§8 of the audit) closes the 4 known gap tokens (`right`, `wrong`, `validated`, `hot`) so future drifts in those directions are caught the same way.

## Test plan

No new production tests are required by COPY-001 itself. The audit is the deliverable.

Existing tests that COPY-001 relies on (and that the audit was scanned against):

- `__tests__/metadataPlainLabels.test.ts` — already asserts: every manual-tag + auto-metadata code maps to a non-empty label; every label ≤ 32 chars; every label is mixed-case English (not snake_case, not ALL CAPS); every label scans clean against `_forbiddenMetadataTokens()`; explicit snapshot tests for the verbatim manual-tag and auto-metadata labels; backward-compat with LIFE-001 (shared codes keep their labels); case-insensitive lookup.
- `__tests__/pointLifecyclePlainLabels.test.ts` — same battery against `_forbiddenLifecycleTokens()` for the 19 lifecycle states; backward-compat with existing non-lifecycle codes; explicit snapshot for verbatim lifecycle labels; case-insensitive lookup.
- `__tests__/metadataDoctrineAnchors.test.ts` — broader doctrine anchors for META-001.
- `__tests__/pointLifecycleModel.test.ts` — LIFE-001 deep-equal doctrine anchors (output invariant under tone / temperature / standing variation).

Optional follow-up tests (per audit §8, NOT required to land COPY-001):

- `__tests__/copyReviewBanListGaps.test.ts` — ~30 lines. Asserts each of `right`, `wrong`, `validated` is present in both `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` arrays. Asserts `hot` is NOT present (documenting the doctrine §2 carve-out as a test invariant). Re-runs the existing per-label scan against the expanded ban list to prove no current label trips the new tokens.
- An extension to SC-004's `__tests__/timelineNodeActionDockDoctrine.test.ts` — add a case asserting Rule R2 dedup for the `sourced` (cluster) + `source_attached` (move) pair, mirroring the existing `answered` + `has_reply` case. The implementer of SC-004's follow-up OR of ST-002's design phase can pick this up.

## Dependencies (cards / docs / files)

- This design assumes **BR-001** (branch model) is complete because the auto-metadata layer reads from the timeline map produced by BR-001.
- This design assumes **LIFE-001** (point lifecycle model) is complete because the lifecycle vocabulary is the cluster-scope side of every collision.
- This design assumes **META-001** (manual tags + auto metadata + plain-language mapping) is complete because the move-scope vocabulary is the other side of every collision AND because META-001 is the card that promoted `evidence_debt` to its current label.
- Reads existing `_forbiddenLifecycleTokens()` in `src/features/lifecycle/pointLifecycleModel.ts` (lines 290–304).
- Reads existing `_forbiddenMetadataTokens()` in `src/features/metadata/moveMetadataLedger.ts` (lines 450–463).
- Reads `PLAIN_LANGUAGE_COPY` in `src/features/arguments/gameCopy.ts` (lines 150–253).
- Reads `ALL_POINT_LIFECYCLE_STATES`, `ALL_MANUAL_TAG_CODES`, `ALL_AUTO_METADATA_CODES` to enumerate vocabulary.
- Cross-references the **SC-004** design doc (`docs/designs/SC-004.md` §"Cluster header + per-move chip" lines 210–249, §"COPY-001 disambiguation rule" lines 715–722, §"COPY-001 dedup test" lines 761–763). SC-004 is the first consumer of R1 + R2.
- **Blocks ST-002** (issue #13) — ST-002 must consume the rule table in §6 of the audit before designing its suggestion chips. Until COPY-001 lands, ST-002 has no portable contract for how to disambiguate cluster vs move scope.
- **Blocks RULE-003** (issue #65) — RULE-003 is the canonical home for the lifecycle/manual-tag/auto label-helper-icon-allowedActions map. It must consume R1 + R2 + R3 + R5 before designing its label map. Until COPY-001 lands, RULE-003 has no rule index to encode.

## Risks

- **Risk: a future card adds a code to PLAIN_LANGUAGE_COPY with a verdict-flavored label and the test ban-list misses one of the gap tokens (`right`, `wrong`, `validated`).** The audit recommends adding these tokens to both ban-list helpers (§8). If the operator declines the optional hardening, the gap remains. Mitigation: this design doc names the 3 tokens explicitly so any later reviewer can grep for them. (`hot` is deliberately excluded from the recommended additions — doctrine §2 permits "hot = activity"; see audit §5.1 and §8.)

- **Risk: a future consumer implements R1 / R2 inconsistently, leading to a doctrine slip on one surface while another is clean.** Mitigation: each consumer card (SC-004, ST-002, RULE-003) MUST cite the rule index in §6 of the audit AND ship a doctrine-anchor test that re-asserts the same dedup invariant the rule names. SC-004 already does this (`timelineNodeActionDockDoctrine.test.ts`). The same pattern is the contract for ST-002 and RULE-003.

- **Risk: the audit drifts from PLAIN_LANGUAGE_COPY as new codes are added.** The audit is labeled "pass 1" with an explicit version anchor (Stage 6.4 / post-META-001). A pass-2 audit is queued for when Wave 2 surfaces (SC-004 + ST-002 + IX-001) land and a manual visual sweep across rendered chips becomes possible. The audit's existence does NOT imply it auto-tracks new entries; tests are the auto-tracker (the existing `metadataPlainLabels.test.ts` / `pointLifecyclePlainLabels.test.ts` fail on any new code without a clean label).

- **Risk: R5 (axis-vs-manual-tag dedup) is correct but is hygiene, not doctrine, and shipping it in v1 may add scope to RULE-003.** Mitigation: R5 is marked optional v1.1 in the rule consumption matrix. RULE-003 may defer it without violating doctrine — the v1 fallback (render both chips) is doctrine-clean, just redundant.

- **Risk: a reviewer mis-reads "Moderator → Watching" or "Conceded → Conceded by author" as a drift.** The audit's §7 ("Surprising / non-obvious mappings worth re-confirming") names every such mapping and the doctrinal reason it is intentional. Reviewers should be pointed at §7.

- **Library / platform gotchas:** None. The audit and design are doc-only.

- **Existing tests that might need updating:** None. The audit reads existing tests; it does not change them. If the operator lands the optional ban-list hardening, the new test file `__tests__/copyReviewBanListGaps.test.ts` is purely additive and cannot break existing tests.

- **Migration that requires operator deploy:** None. Pure docs.

## Out of scope

The following are explicitly NOT part of COPY-001 to keep scope tight:

- **Any label change in `PLAIN_LANGUAGE_COPY`.** The audit found zero drifts. Touching the map would force snapshot test updates and is out of scope for an audit pass.
- **Introducing a `toPlainLanguageQualified(context, code)` overload** in `gameCopy.ts`. The qualification belongs to the consumer (SC-004's `clusterHeader.lifecycleLabel` vs `moveChips[].label` separation is the right level), not the lookup helper. Adding the overload to `gameCopy.ts` would push consumer policy into the copy table.
- **New labels for codes that have not yet been added to `PLAIN_LANGUAGE_COPY`.** The audit is a snapshot, not a forward roadmap. New codes land with the cards that introduce them (SC-004 / ST-002 / RULE-003 / GAL-002 / AN-003 each can extend the vocabulary).
- **Implementing R1–R5 in any consumer.** Consumer cards (SC-004 already does it; ST-002 / RULE-003 are pending) implement the rules. COPY-001 names them.
- **Re-running tests, lint, or typecheck.** This card produces no code, so there is nothing to verify. (CLAUDE.md says to run typecheck + lint + test after changes; this card has no changes.)
- **Touching `.env*`, hosting files, migrations, or any Edge Function.** None apply.
- **Calling Anthropic / xAI / X API.** Hard-banned by `cdiscourse-doctrine`; the audit is a desk review, not an AI annotation pass.

## Doctrine self-check

- **cdiscourse-doctrine §1 — No truth labels.** Every entry was scanned against the 22-token verdict ban list. Zero hits. Confirmed.
- **cdiscourse-doctrine §1 — Score never blocks posting.** The audit does not touch scoring. The closest blocking label (`invalid_transition` → "That move type isn't allowed here.") is a Constitution engine refusal, not a score-driven block; the label describes the move and the location, not the user. Confirmed.
- **cdiscourse-doctrine §2 — Heat means activity, not truth.** The audit confirmed `hot` is not in any PLAIN_LANGUAGE_COPY entry. It DOES appear in the sibling `GALLERY_SECTIONS` map ("Hot rooms…", "Hot but unresolved") — out of scope for COPY-001 but flagged in audit §5.1 as a doctrine-permitted "hot = activity" usage. The audit therefore recommends NOT adding `hot` to the ban-list helpers — only `right`, `wrong`, `validated` are recommended additions. Confirmed.
- **cdiscourse-doctrine §3 — Popularity is not evidence.** Every entry was scanned against the 12-token amplification ban list. Zero hits. `anti_amplification` renders the doctrinal phrase "Popularity is not proof" verbatim — the doctrine appears as user copy. Confirmed.
- **cdiscourse-doctrine §4 — AI moderator hard limits.** The audit is a desk review with no AI in the loop. No AI labels are introduced or modified. Confirmed.
- **cdiscourse-doctrine §5 — Rules engine is sacred.** No engine change. Confirmed.
- **cdiscourse-doctrine §6 — Secrets policy.** No secrets, no env. Confirmed.
- **cdiscourse-doctrine §7 — No AI calls from production app.** N/A; pure docs. Confirmed.
- **cdiscourse-doctrine §8 — Supabase conventions.** No RLS / migration / table change. Confirmed.
- **cdiscourse-doctrine §9 — Plain language for users.** This card IS the plain-language audit. Confirmed.
- **cdiscourse-doctrine §10 — v1 scope guards.** The audit introduces nothing buildable; it cannot violate v1 scope. Confirmed.
- **accessibility-targets — chip-fit label length.** All 78 unique-keyed entries' labels are ≤ 32 chars per the existing tests in `metadataPlainLabels.test.ts` lines 40–44 and `pointLifecyclePlainLabels.test.ts` lines 37–42. The audit relies on these constraints; it does not introduce new labels. Confirmed.
- **accessibility-targets — color independence.** Render-rule R1 + R2 are *positional* (cluster band vs move chip strip), not color-coded. The dedup logic survives color blindness / high-contrast / reduce-motion modes. Confirmed.
- **accessibility-targets — screen-reader contract.** SC-004's `clusterHeader.accessibilityLabel` already combines the four header fields into a single screen-reader-friendly string. The audit's R1 keeps cluster + move information separated so the SR consumer can announce each band in turn. Confirmed.

## Operator steps (if any)

**None — pure docs change.**

The deliverables are two markdown files (`docs/designs/COPY-001.md` and `docs/copy-review/plain-language-labels-pass-1.md`). No migration, no Edge Function deploy, no env var, no secret rotation, no service restart.

The optional follow-up hardening (§8 of the audit — 3 gap tokens added to the ban-list helpers + one new regression test) is a separate card / commit that the operator may choose to land as a quick hygiene PR after COPY-001 merges. It also requires no deploy step — local `npm run typecheck && npm run lint && npm run test` is sufficient.
