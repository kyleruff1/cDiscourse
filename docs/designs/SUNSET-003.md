# SUNSET-003 — retire raw MCP/debug leakage from default UI

**Status:** Design draft
**Card:** SUNSET-003 (GitHub issue #849)
**Roadmap:** PRODUCT-REDIRECT-001 (epic #826)
**Release:** UI / UX only
**Baseline:** main @ 5213042 (VISUAL-SIMPLIFY-001 #857 hub collapse; VISUAL-SIMPLIFY-002 #856 analysis drawers; VISUAL-SIMPLIFY-003 #855 band-neutral default; UX-FLAGS chain #850/#851 friendly feedback flags)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/849

> Baseline note: the PR numbers named in the card prompt (#844 hub collapse, #845 analysis drawers, #846 band-neutral) map to the actually-merged VISUAL-SIMPLIFY-001 / -002 / -003 cards on this repo (#857 / #856 / #855). This doc is reconciled to the merged reality. The UX-FLAGS "friendly feedback flag" chain shipped as #850 / #851. All named mechanisms are COMPOSED WITH, never modified.

## Goal (one paragraph)

Machine detail on the CDiscourse room surfaces is already copy-safe by construction — raw classifier codes route through `gameCopy.toPlainLanguage` / RULE-003 helpers, and `familyCode` appears only in `testID`s, never in rendered text. The wave-2 chain then reduced the VOLUME of that detail on the default path: VISUAL-SIMPLIFY-001 collapsed the active-card `CardDetailPanel` hub behind ONE "More detail" toggle; VISUAL-SIMPLIFY-002 put the Disagreement / Open-Issues / Mediator-readout surfaces behind the `activeAnalysisSurface` selector; VISUAL-SIMPLIFY-003 retired per-node strength bands from the default timeline; and the UX-FLAGS chain made the friendly-flag row the single calm default surface. SUNSET-003 is therefore NOT a large relocation card. It is (1) a rigorous DEFAULT-PATH LEAKAGE AUDIT that VERIFIES the funnels actually hold on the composed post-wave-2 render (rather than assuming), (2) the smallest correct gating of any residual found, and (3) ONE durable regression test that PINS "no raw family / rawKey / snake_case / classifier jargon / confidence numerals / evidenceSpan text / run-debug id on the default path" so no future card can silently regress it. The doctrine anchors that shape the work: cdiscourse-doctrine §9 (internal codes never appear in user-facing strings; unknown codes suppressed, not echoed), §10a (machine detail is Observations routed through the registry, never raw ids; sensitive observations stay composer-only), §1 (advisory, never a verdict), and accessibility-targets (any new opt-in toggle carries role + expanded state + ≥44×44 + reduce-motion snap).

## Audit findings — the heart of this card

Render-path inspection from source, DEFAULT states only (timeline mode + stack mode, nothing tapped/expanded). Verdicts: **CLEAN** = nothing machine-raw reaches the tree by default; **OPT-IN-OK** = machine detail is present but only after an explicit tap/expand (acceptable per the card scope); **RESIDUAL** = something machine-raw renders on the default path and must be gated.

| # | Surface | File:line | What renders by DEFAULT | Verdict |
|---|---|---|---|---|
| 1 | Active readout (compact) | `TimelineSelectedReadoutPanel.tsx:183-270` | 5-line summary: kindLabel, body excerpt, "Responding to this point" + parent hint/excerpt, reply/branch count, "Acting on" — all plain-language. The 6-section SC-003 sidecar (incl. **Semantic flags**) is behind the `expanded` state ("Show full details ▾"). Default mount always passes `compact` (`ArgumentGameSurface.tsx:2476-2480`). | **CLEAN** (sidecar detail is opt-in behind Show full details) |
| 2 | Sidecar "Semantic flags" section | `ArgumentReplySidecar.tsx:231-266` via `argumentDetailModel.buildSectionSemanticFlags:924-999` | Only reached via the readout expand (surface 1) OR the legacy `compact === false` path — which NO default room mount uses. Every `chip.label` is RULE-003 plain language (`getManualTagUx`/`getAutoMetadataUx`); `sourceCode`/`id`/`family` are typed-internal, never rendered (`INTERNAL_CODE_FIELD_PATHS`). In condensed (timeline) mode it shows only a count + "Show details". | **OPT-IN-OK** (labels plain-language by construction; gated behind readout expand) |
| 3 | Point friendly-flag row | `ArgumentGameSurface.tsx:2487-2490` (`PointFeedbackFlagsRow`, #850/#851) | ≤3 friendly descriptor pills + "+N more"; renders nothing when empty. Descriptors routed through the #850 friendly-flag map (own ban-list test `friendlyFlagMapBanList.test.ts`). | **CLEAN** |
| 4 | Micro-moment banner | `ArgumentGameSurface.tsx` (entryHint verbPhrase) | A single plain-language nudge sentence (`deriveConversationEntryHint`); no code, no id. | **CLEAN** |
| 5 | Mediator node marker + Inspect caret | `ArgumentGameSurface.tsx:2529-2548` | ONE primary state chip (v4 nine-state plain vocabulary) + an "Inspect" caret. Chip is plain-language; caret opens the opt-in overlay. | **CLEAN** |
| 6 | Active `CardDetailPanel` (stack mode) collapsed default | `CardDetailPanel.tsx:1141-1193` | Parent bubble (quote + "Replying to" + actor label), message body + step reference, `CompactMetaLine` (categoryLabel · qualifierLabels[0] · lifecycleLabel — all plain), friendly-flag row, `AdvisoryLine` (referee `zone2OpenTaskLine`, plain), the "More detail" toggle. NO classifier grid, NO combination zone, NO S/T/H, NO evidenceSpan. | **CLEAN** (post VISUAL-SIMPLIFY-001; verify) |
| 7 | `CardDetailPanel` expansion (`HubClassifierZone`, `CombinationObservationsZone`, S/T/H, evidence, standing, lifecycle, actions, full tags) | `CardDetailPanel.tsx:1201-1221`, `HubClassifierZone:266-318`, `ClassifierLabel:196-252` | Renders `chip.evidenceSpanFramed` (evidence span text), family headings (`familyLabel`, plain), confidence PIPS (dots, not numerals), `familyCode` in `testID` only. All behind `detailExpanded`. | **OPT-IN-OK** (evidence span + dense grid only after "More detail") |
| 8 | Analysis surfaces (Disagreement / Open Issues / Mediator readout) | `ArgumentGameSurface.tsx:2511, 2683-2707, 2899` gated on `activeAnalysisSurface` | Default `activeAnalysisSurface` is not one of these → they render nothing until summoned (VISUAL-SIMPLIFY-002). | **OPT-IN-OK** |
| 9 | `NodeLabelInspectGroups` overlay | `ArgumentGameSurface.tsx:2778-2808` gated on `inspectVisible && activeMessageId` | Renders only after the Inspect caret is pressed. Its own §10a machine/allegation groups route through the registry. | **OPT-IN-OK** |
| 10 | Timeline node popover | `timelineNodePopoverModel.ts` via `decideNodeTapEffect`/`decideInfoIconEffect` | Opt-in on tap. `headerLine` (ordinal+kind+side), `standingLabel` (SW-001 soft), `bodyPreview` are plain. `toneBand`/`temperatureBand` are typed raw-band fields — the COMPONENT must render them via the plain-language band map (verify at implement; the popover component, not the model, owns display). | **OPT-IN-OK** (verify popover component maps bands; not a default-path surface) |
| 11 | Timeline nodes (a11y labels) | `ArgumentTimelineMap` node `<Pressable accessibilityLabel>` | Verbose plain-language a11y sentence (kind + side + ordinal + standing band label + active/branch/debt). No raw code. | **CLEAN** |

**Audit verdict:** The default render path is **already clean** across all eleven surfaces after the wave-2 chain. Every machine-detail-dense surface (semantic flags, classifier hub, combination observations, S/T/H strip, evidence spans, analysis panes, Inspect groups, node popover) is EITHER already routed through the plain-language funnels (labels) OR gated behind an explicit opt-in (expand / Inspect / analysis-selector / tap). There is **no residual that renders raw family names, rawKey strings, snake_case codes, confidence numerals, evidenceSpan text, or run/debug ids on the default path.** SUNSET-003's substantive deliverable is therefore the DURABLE REGRESSION TEST that pins this state, plus a written verification of surface 10's band mapping.

## Data model

**No new data model. No migration. No Edge Function change. No feedbackFlags-module change.** SUNSET-003 is a verification-and-pin card. If the surface-10 band-mapping verification surfaces a defect (unlikely), the fix is a visibility/label-only change with no schema impact.

## File changes

- **new file:** `__tests__/sunset003DefaultPathLeakage.test.tsx` (~230-300 lines) — the durable default-path leakage regression suite (see Test plan). This is the ONLY guaranteed file change.
- **verify-only (no edit expected):** `src/features/arguments/ArgumentGameSurface.tsx`, `TimelineSelectedReadoutPanel.tsx`, `ArgumentReplySidecar.tsx`, `cardView/CardDetailPanel.tsx`, `detail/argumentDetailModel.ts`, `nodeLabels/NodeLabelInspectGroups.tsx`, `timelineNodePopoverModel.ts` + its component. The audit expects zero source edits; the implementer VERIFIES each against the test and only edits if the test surfaces a real leak.
- **conditional residual edit (only if the test fails):** the smallest visibility/label gate on the offending surface (see Residual relocations). Estimated ≤10 lines if triggered.

Line-count estimate: new test ~230-300 lines; source edits 0 expected, ≤10 if a residual is found.

## API / interface contracts

No public API changes. The test consumes existing exports only:
- `looksLikeInternalCode` from `src/features/arguments/gameCopy.ts` (the canonical internal-code shape detector).
- The room surface components / their view-model builders (`buildSidecarViewModel`, `buildTimelineSelectedReadoutViewModel`, `CardDetailPanel`, `ArgumentGameSurface` or its sub-panels) rendered via `@testing-library/react-native`.
- Existing fixture builders where available; otherwise inline observation-rich fixtures constructed in the test file.

If a residual gate is needed, it reuses an existing disclosure state (the readout `expanded`, the card `detailExpanded`, or `inspectVisible`) — no NEW toggle is introduced, so no new a11y contract is created. (If, and only if, a brand-new toggle were unavoidable, it would carry `accessibilityRole="button"` + `accessibilityState={{ expanded }}` + `hitSlop={TOUCH_TARGET.hitSlopAll}` + reduce-motion snap, mirroring `MoreDetailToggle` — but this is not anticipated.)

## Edge cases

- **Empty observation set:** default surfaces render nothing machine-derived (flag row returns null, classifier zones absent). The test includes an empty-fixture case asserting the calm default still has zero leak (trivially true, but pins the null path).
- **Observation-rich set (families A–I):** the test's primary fixture carries manual tags + auto-metadata + persisted classifier rows with snake_case rawKeys, confidence values, and evidenceSpan text. The default render must still be clean; only after opt-in do the plain-language labels (never the raw codes) appear.
- **Unknown rawKey:** `toPlainLanguage` / the registry suppress unknown codes (return null → chip omitted), never echo them. The fixture includes one unknown rawKey to pin the suppress-not-echo path on any surface that would render it.
- **Own bubble vs other bubble:** `isOwnPoint` changes the friendly-flag descriptor set and the sidecar action vocabulary, but neither introduces raw codes. The test renders both actor states.
- **Sensitive observations (§10a):** `shifts_to_person_or_intent` / `contains_unplayable_insult_only` / `needs_pre_send_pause` are composer-only and must NEVER appear on the target node's default render. The fixture includes one; the test asserts it is absent from the node/readout/card default tree.
- **Doctrine-constraint edge:** heat/tone bands are activity/register descriptors, never truth — the default path renders band-neutral (VISUAL-SIMPLIFY-003) so no band chip reaches the timeline node by default; the test asserts no `standingBand`/`toneBand`/`temperatureBand` raw token string reaches default text.

## Test plan

ONE new suite: `__tests__/sunset003DefaultPathLeakage.test.tsx` (`.tsx` because it renders components via `React.createElement` / RNTL).

**Fixture design (observation-rich, families A–I):**
- A room/argument set with an active node carrying: manual tag codes (e.g. `misreads_source`), auto-metadata codes (e.g. `source_requested`, `no_response_after_n_turns`), and `persistedObservationsByArgumentId` rows spanning families A–I with realistic snake_case `rawKey`s (e.g. `parent_relation`, `quote_anchors_parent`, `challenges_parent`, `source_chain_gap`, `introduces_new_issue`), numeric `confidence` values (e.g. `0.82`), and `evidenceSpan` text (a distinctive sentinel like `"EVIDENCE_SPAN_SENTINEL bikes are safer downtown"`).
- One UNKNOWN rawKey (`totally_unregistered_key`) to pin the suppress-not-echo path.
- One §10a composer-only sensitive code (`shifts_to_person_or_intent`) to pin composer-only exclusion from the target node.
- A run/debug sentinel id embedded in the fixture (e.g. `runId: "RUN_DEBUG_SENTINEL_abc123"`, `schemaVersion: "v2"`) to pin that provenance/debug ids never reach default text.

**Surfaces rendered in the DEFAULT state (nothing tapped/expanded):**
1. The timeline-mode default: `ArgumentGameSurface` (or the extracted col2 default: `TimelineSelectedReadoutPanel` with `compact` + `PointFeedbackFlagsRow` + mediator marker). If mounting the full surface is too heavy, render the readout panel (compact) and the flag row directly with the rich view-model — the compact path is the canonical default readout.
2. The stack-mode default: `CardDetailPanel` for the active card with `detailExpanded === false` (default) fed the rich model + prioritized flags.

**Scan classes (assert NONE appear in default leaf text or default a11y labels):**
- **(a) `looksLikeInternalCode` scan** — every leaf text string and every populated `accessibilityLabel` in the default tree returns `looksLikeInternalCode(s) === false`. (Depth-first `collectText` + `collectA11yLabels` idioms copied from `openIssuesRailNoRawCodes.test.ts`; testIDs are NOT scanned, so `familyCode` in `card-detail-classifier-group-*` testIDs is safe by construction.)
- **(b) family internal names** — none of `parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`, `claim_clarity`, `thread_topology`, `sensitive_composer` appears in default text.
- **(c) fixture rawKey strings** — none of the fixture's rawKeys (`quote_anchors_parent`, `challenges_parent`, `source_chain_gap`, `introduces_new_issue`, `totally_unregistered_key`, …) appears in default text.
- **(d) snake_case tokens** — a `/[a-z]+_[a-z0-9_]+/` scan of default leaf text yields no match (allowlist is empty because default text is all multi-word plain language; testIDs excluded from the scan).
- **(e) confidence numerals** — the fixture's confidence values (`0.82`, `82`, `82%`) do not appear in default text (confidence is PIPS/absent on the default path).
- **(f) evidenceSpan text** — the `EVIDENCE_SPAN_SENTINEL` string does not appear in default text (evidence span renders only in the expanded `HubClassifierZone`).
- **(g) run/debug ids** — `RUN_DEBUG_SENTINEL_abc123` and `schemaVersion`/`v2` sentinels do not appear in default text.
- **(h) §10a composer-only** — `shifts_to_person_or_intent` (raw) and its plain label do not appear on the target node's default render.
- **(i) opt-in positive control** — after opening the readout ("Show full details") and the card ("More detail"), the plain-language LABELS DO appear (proving the detail is relocated, not deleted) while the raw codes / rawKeys / evidenceSpan-raw-code still never appear as raw tokens. This guards against a false-green where the surface simply renders nothing.

**Doctrine ban-list assertions:** reuse the shared verdict ban-list (winner/loser/liar/true/false/correct/dishonest/bad faith/…) against default AND expanded leaf text, mirroring `refereeCardBanList.test.ts`.

## Test audit — update vs preserve

**No existing test needs to change** in the expected (zero-source-edit) path — SUNSET-003 adds a suite, it does not alter render behavior. Enumerated:

- `__tests__/timelineReadoutBanList.test.ts` — **PRESERVE.** Already pins the readout copy; unchanged.
- `__tests__/refereeCardNoRawCodes.test.ts`, `refereeCardBanList.test.ts` — **PRESERVE.** Referee surface unchanged.
- `__tests__/openIssuesRailNoRawCodes.test.ts` — **PRESERVE** (source idiom for the new suite).
- `__tests__/visualSimplify001CardCollapse.test.tsx` — **PRESERVE.** Pins the CardDetailPanel collapse; SUNSET-003 relies on it, does not touch it.
- `__tests__/friendlyFlagMapBanList.test.ts` — **PRESERVE.** #850 flag-descriptor ban-list unchanged.
- `__tests__/CardDetailPanel.test.tsx`, `CardDetailHubPanel.test.tsx`, `argumentDetailParity.test.ts` — **PRESERVE.** Component/model behavior unchanged.
- `uxOneOneFiveReadOnlyBoundary.test.ts` / `uxOneOneSixReadOnlyBoundary.test.ts` — **PRESERVE.** No source file is edited in the expected path (see Boundary relaxation).
- `uxOneOneTwoDoctrine.test.ts` — **PRESERVE.** No edit to its `UX_001_2_FILES` in the expected path; if a residual edit to `ArgumentGameSurface.tsx` is triggered, all new comments MUST be apostrophe-free with balanced quotes/backticks (landmine 1), and this suite is re-run before push.

**Only if the audit test surfaces a real residual** (not anticipated) and a source gate is added: the affected surface's own test flips to open-first (the same "render through the full panel → open the disclosure first" rule VISUAL-SIMPLIFY-001 used). This is a contingency, not a planned change.

## Boundary-test relaxation

**None needed in the expected (zero-source-edit) path.** The new test file is not pinned by any boundary suite.

Contingency map, if a residual source gate is required:
- `TimelineSelectedReadoutPanel.tsx` — already REMOVED from the `uxOneOneFiveReadOnlyBoundary` zero-diff set (NOTE at lines 109-125); the `uxOneOneSixReadOnlyBoundary` pin is `requiredApi: ['TimelineSelectedReadoutPanel']` (presence-only) — a visibility edit preserving the export needs no relaxation.
- `ArgumentGameSurface.tsx` — `uxOneOneSixReadOnlyBoundary` pin is `requiredApi: ['ArgumentGameSurface']` (presence-only); no zero-diff pin; an additive/visibility edit preserving the export holds. It IS scanned by `uxOneOneTwoDoctrine` (apostrophe-free comment rule applies).
- `CardDetailPanel.tsx` / `ArgumentReplySidecar.tsx` / `argumentDetailModel.ts` / `NodeLabelInspectGroups.tsx` — absent from both boundary suites' zero-diff sets; no relaxation needed.
- `timelineNodePopoverModel.ts` — pure model; not a boundary-pinned zero-diff file.

## Risks

- **Doctrine quote-parity landmine (landmine 1).** IF a residual edit lands in `ArgumentGameSurface.tsx`, any apostrophe in a new comment (e.g. `card's`) breaks `uxOneOneTwoDoctrine`'s naive `STRING_RE` and can bleed a banned token across literals → false-positive failure. Mitigation: all new comments apostrophe-free, balanced quotes/backticks; run `npm run test -- uxOneOneTwoDoctrine` before push. Applies to the NEW TEST FILE too if its comments are scanned — write the test's comments apostrophe-free as a precaution.
- **Over-eager `looksLikeInternalCode` on plain words.** `looksLikeInternalCode('parent')` is TRUE (single lowercase token ≥5 chars). The default surfaces render multi-word plain-language strings ("Well supported", "Replying to", "Responding to this point") which contain spaces and do NOT trip the detector — but a lone plain word like "Mainline" or "Measured" WOULD if rendered as a standalone leaf. Verify the default fixtures do not surface a single-word leaf that is legitimately plain but code-shaped; if one exists, the scan must target the (b)-(h) explicit token lists rather than a blanket `looksLikeInternalCode` on every leaf, OR carry a tiny plain-word allowlist. Design the (a) scan to run alongside (b)-(h) so a false positive on a legit plain word is caught and handled deliberately, not by weakening the whole scan.
- **Full-surface mount weight.** `ArgumentGameSurface` is a heavy component with many providers. If mounting it whole is brittle in jest, render the canonical default sub-surfaces directly (compact readout + flag row + collapsed `CardDetailPanel`) — they ARE the default path and give a faithful, lighter scan. Prefer sub-surface mounts; document the choice in the test header.
- **Flaky suites (landmine 4).** `startArgumentInviteLinkBox` / `pointLifecycleModel LIFE-001` flake under full-suite parallel load — re-run isolated if they fire; they are unrelated to this diff.
- **False-green.** A scan that passes because the default renders NOTHING is a false green. The (i) opt-in positive control (open the disclosures, assert plain LABELS now appear) guards against this.

## Out of scope

- The friendly-flag redesign itself (UX-FLAGS-*) — consumed as-is; `src/features/feedbackFlags/` is NOT edited.
- Re-doing VISUAL-SIMPLIFY-001/-002/-003 mechanisms — composed with, never modified (no change to `detailExpanded`, `activeAnalysisSurface`, or band-neutral semantics).
- Any admin / Inspect / analysis-surface REMOVAL — diagnostic depth STAYS available behind the role-gated / opt-in surfaces; this card relocates/pins, never deletes.
- Edge Function / mcp-server / migration / config / validator / ban-list / familyRegistry / prompt changes — none.
- `docs/core/current-status.md` — not touched by this card.
- Provider spend, new dependencies — none.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; no service-role):** the audit confirms every default surface renders advisory plain language; no verdict token; the pin test asserts the verdict ban-list on default AND expanded text. Pure client-side, presentation-only; no submit path, no service-role.
- **§9 (plain language; unknown codes suppressed, not echoed):** the whole card exists to PIN §9 on the composed default path — the (a)-(h) scans assert no internal code / rawKey / family name / confidence numeral reaches default text, and the unknown-rawKey fixture pins suppress-not-echo.
- **§10a (Observations vs Allegations; sensitive composer-only):** the composer-only fixture (`shifts_to_person_or_intent`) pins that sensitive observations never render on the target node's default surface; the friendly-flag row and any surviving chip route through the registry, never raw ids.
- **§3 (popularity is not evidence):** unaffected — no engagement→standing path is touched; the flag row's `neverGrantsStanding` passes through untouched.
- **accessibility-targets:** no new toggle is anticipated (residuals reuse existing disclosure state). If one were forced, it mirrors `MoreDetailToggle` (role button + expanded state + ≥44×44 hitSlop + reduce-motion snap + web focus ring). The pin test also asserts default text stays inside `<Text>` (no raw strings in `<View>`).
- **test-discipline:** the card ships its test; test count goes UP by one suite; no `.skip`/`.only`; boundary + doctrine suites stay green; full `npm run test` run with captured exit code before claiming done.

## Operator steps (if any)

None — pure client-side change (a new test, plus at most a visibility gate). No `db push`, no `functions deploy`, no env var, no migration.
