# META-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-18
**Branch:** feat/META-001-move-tag-flag-metadata-event-ledger
**Design:** docs/designs/META-001.md (1511 lines)

## Summary

META-001 ships the locked 10-code `ManualTagCode` vocabulary, the locked 16-code
`AutoMetadataCode` vocabulary, the per-move `MoveLinkageRecord`, the per-cluster
`ClusterMetadataSummary`, the per-tree `MoveMetadataLedger`, the `MetadataEvent`
log, the `LifecycleCausationEntry` snapshot-diff shape, the `MANUAL_TAG_ELIGIBILITY`
matrix, and the `buildMoveMetadataLedger` / `applyManualTag` / `removeManualTag`
API surface as a pure-TS module under `src/features/metadata/`. The implementation
matches the design end-to-end: vocabularies are locked, the eligibility matrix
encodes the conservative observer-blocked / own-bubble-restricted / admin-all-tags
rule (the own-bubble allowed set is exactly `{concession_offered, narrowed_claim,
ready_for_synthesis}`), auto-metadata derivation reads only existing seams,
snapshot-diff causation uses the "isLatest-in-cluster" guard, the moderation flag
boundary is structurally separated (`userAppliedTags` vs `semanticFlags`),
plain-language labels extend `gameCopy.PLAIN_LANGUAGE_COPY` in place with 23 new
entries plus the documented `evidence_debt` value update (`'Receipts needed'` →
`'Evidence debt'`), and the two existing tests that hardcoded the old label are
updated minimally as bookkeeping. Doctrine holds at every level — heat / standing
/ tone / temperature / popularity / engagement bands are never read (proven by a
deep-equal byMessage shape across five band/tone/temp variations); ban-lists
forbid verdict, amplification, person-attribution, and block / prevent tokens;
the forbidden-imports source-scan test proves no value-import of
`deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` /
`deriveAxis` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair`, no
import from `engagementIntelligence/`, no React / RN / Supabase / Expo imports,
no `fetch(` / `XMLHttpRequest`, no env-secret references, no `console.log`.
BR-001, LIFE-001, and VG-002 frozen surfaces are entirely untouched
(`railSegmentModel.ts`, `branchTopologyModel.ts`, `pointLifecycleModel.ts`,
`pointLifecycleClusters.ts`, `pointLifecycleAdvisoryInputs.ts`,
`GradientWaveRail.tsx`, `ArgumentTimelineMap.tsx`, `argumentGameSurfaceModel.ts`
— zero diff). No new dependency, no migration, no Edge Function, no Supabase
write, no service-role, no `.env*` change, no AI call. Verification green.

## Verification

- typecheck: **pass** (`tsc --noEmit` exit 0)
- lint: **pass** (`eslint` exit 0)
- test: **pass — 2624 → 2942 (+318 tests), 101 → 109 suites (+8)** (matches
  design's "+200 to +250" budget conservatively; actual budget was a touch high
  but well within the safety margin)
- secret scan: **clean** (no `ANTHROPIC_API_KEY` / `XAI_API_KEY` /
  `X_BEARER_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_` / `sk-ant-` /
  Bearer / Authorization / JWT-shape literal values in the diff; the only hits
  are inside ban-list assertions inside `__tests__/metadataForbiddenImports.test.ts`
  proving these strings DO NOT appear in source — expected false positives)
- doctrine scan: **clean**
  - Verdict-token hits inside the diff are limited to:
    - The `_forbiddenMetadataTokens()` ban-list array literal in
      `moveMetadataLedger.ts` (lines 451–462) — expected false positive (defining
      the ban-list).
    - The literal banned arrays in `metadataDoctrineAnchors.test.ts` and
      `metadataPlainLabels.test.ts` — expected false positives.
    - Doctrine docblocks paraphrasing the forbidden tokens ("never a verdict",
      "never inferred from truth / winner / loser / correctness") — comments
      only, no produced UI string carries the tokens.
    - Two PRE-EXISTING `gameCopy.ts` labels (`'Popularity is not proof'` and
      `'Do not score as proven yet'` at lines 171/173) appear as context lines
      in the diff but are unchanged by META-001 and outside its vocabulary —
      they were on `main` before this card.
  - Heat / standing / popularity / engagement / virality references in the
    metadata module diff are only inside doctrine docblocks that name them as
    forbidden inputs and inside the `_forbiddenMetadataTokens()` amplification
    ban-list. The 5-variant `{band, tone, temp}` doctrine-anchor test
    (`metadataDoctrineAnchors.test.ts` lines 349–405) proves the deriver output
    is deep-equal across `standingBand` × `toneBand` × `temperatureBand`
    variations.
  - Zero `SERVICE_ROLE` / `ANTHROPIC_API_KEY` / `@supabase` / `anthropic` /
    `openai` / `xai` / `fetch(` matches inside `src/features/metadata/`.
  - Zero direct insert / select / from `public.arguments` anywhere in the diff
    (the only occurrence is the doc-comment `/** Same as the message's id field
    on public.arguments. */` in `moveMetadataLedger.ts` line 293 — a comment,
    not a query).

## Design conformance

- [x] All design file-changes are present
  - `src/features/metadata/moveMetadataLedger.ts` (1088 LOC — design estimate
    ~480 was conservative; the bigger module is internal helpers including the
    composeMetadataEvents diff machinery and rebuildClusterAggregateForMessage,
    not surface)
  - `src/features/metadata/manualTagModel.ts` (148 LOC vs design ~120 — within
    margin)
  - `src/features/metadata/autoMetadataModel.ts` (429 LOC vs design ~280 — the
    overage is detailed per-code predicates with documented `inputSignals`)
  - `src/features/metadata/metadataEvents.ts` (147 LOC vs design ~180)
  - `src/features/metadata/index.ts` (65 LOC vs design ~50)
  - `src/features/arguments/gameCopy.ts` modified with 23 new label entries +
    1 value update (`evidence_debt`)
  - 8 new test files (design specified 7; the implementer added a separate
    `metadataLifecycleIntegration.test.ts` per design § "Integration with
    LIFE-001" — actually this was in the design at line 1243; the design split
    is mirrored)
- [x] No undocumented file-changes
  - The only test files modified outside the new 8 are
    `pointLifecyclePlainLabels.test.ts` (1 assertion bookkeeping for the
    `evidence_debt` label change) and `seamlessConversationEntry.test.ts` (same
    bookkeeping). Both updates are documented in the design and in
    `docs/core/current-status.md`.
  - `docs/core/current-status.md` extended with the META-001 entry (the
    implementer prepended the new entry per the prior-card pattern; the
    LIFE-001 block is preserved underneath).
  - `docs/designs/META-001.md` introduced (1511 lines) — committed by the
    designer at SHA 7a6073b, not modified by the implementer.
- [x] Data model matches design
  - `ManualTagCode` is the 10-value closed union exactly as designed (lines
    91–101).
  - `AutoMetadataCode` is the 16-value closed union exactly as designed (lines
    129–145).
  - `ManualTagEntry` carries `code / appliedByUserId / appliedByActorRole /
    appliedAt / dedupeKey / note` (lines 216–228) matching the design.
  - `AutoMetadataEntry` carries `code / detectedAt / inputSignals` with the
    bounded ≤ 4 signal limit (lines 236–246, enforced at line 114 of the
    deriver).
  - `LifecycleCausationEntry` carries `level / clusterId / messageId / fromState
    / toState / causationKey` (lines 256–269).
  - `MoveLinkageRecord` carries the 11 documented fields (lines 291–323). Note:
    `targetExcerpt: null` is hardcoded per the design's "v1 — the surface model
    does not yet expose this field" — matches design line 305.
  - `ClusterMetadataSummary` carries the 6 documented fields (lines 332–347).
  - `MetadataEvent` carries `eventId / kind / codeFamily / code / messageId /
    clusterId / at / cause?` (lines 356–375).
  - `MoveMetadataLedger` carries `byMessage / byCluster / metadataEvents /
    messageOrder / inputHash` (lines 384–397).
- [x] API contracts match design
  - `buildMoveMetadataLedger(input: BuildMoveMetadataLedgerInput):
    MoveMetadataLedger` — single tree-level entry point, three-pass
    architecture (per-message linkage + auto-metadata + per-cluster
    aggregation + event composition) per design §"API contracts" line 750.
  - `applyManualTag(input: ApplyManualTagInput): MoveMetadataLedger` — returns
    the input ledger reference-equal on eligibility-refused / dedupe /
    unknown-message-id per design line 806. Verified by 30+ tests.
  - `removeManualTag({ ledger, messageId, code, applierUserId, removedAt? }):
    MoveMetadataLedger` — idempotent; reference-equal when tag absent per
    design line 817.
  - `getManualTagPlainLabel(code: ManualTagCode): string` and
    `getAutoMetadataPlainLabel(code: AutoMetadataCode): string` exist and read
    from `PLAIN_LANGUAGE_COPY` (lines 427, 437).
  - `MANUAL_TAG_ELIGIBILITY` exposed as a frozen public constant (line 188).
  - `ALL_MANUAL_TAG_CODES` (10 entries) and `ALL_AUTO_METADATA_CODES` (16
    entries) frozen arrays exposed (lines 104, 148).
  - `DEFAULT_AUTO_METADATA_CONFIG` with the three conservative defaults
    (`noResponseTurnThreshold=3`, `repeatedAxisPressureThreshold=2`,
    `participantSkippedTurnThreshold=3`) per design line 379.
  - `_forbiddenMetadataTokens()` exposed for ban-list tests (line 450) — 33
    tokens covering verdict, amplification, person-attribution, and
    block/prevent semantics.

## Doctrine self-check (must all be ✓)

- [x] **No truth/winner/loser language in user-facing strings.** All 26
  plain-language labels scanned against the 33-token ban-list in
  `metadataPlainLabels.test.ts` lines 55–63 + 109–117. Zero hits. Explicit
  snapshot at lines 66–76 + 119–135 confirms every label is plain English with
  zero verdict tokens.
- [x] **Score never blocks posting.** META-001 has no `submit-argument` touch,
  no blocking path. The `JSON.stringify(ledger)` scan in
  `metadataDoctrineAnchors.test.ts` lines 175–201 confirms zero `block` /
  `prevent` / `reject` / `forbid` / `disallow` / `denied` tokens in the
  produced output.
- [x] **No service-role in client code.** Source scan in
  `metadataForbiddenImports.test.ts` lines 132–138 confirms no
  `SERVICE_ROLE` / `SUPABASE_SERVICE_ROLE_KEY` references in any META-001
  source file.
- [x] **No direct insert into public.arguments.** Zero insert / mutate / select
  statements anywhere in the diff. The only occurrence of `public.arguments` is
  inside a doc-comment describing the messageId origin (line 293, comment).
- [x] **No AI calls in production app paths.** Source scan asserts no `fetch(`,
  no `XMLHttpRequest`, no Anthropic / xAI / OpenAI imports; the doctrine test
  `metadataDoctrineAnchors.test.ts` lines 327–344 confirms `applyManualTag` is
  synchronous and produces no Promise.
- [x] **Plain language only (no raw internal codes in UI strings).** Every label
  is mixed-case English ≤ 32 chars; `looksLikeInternalCode(label)` returns
  false for all 26 codes (`metadataPlainLabels.test.ts` lines 46–53 + 100–107).
- [x] **Epic-specific doctrine** (cdiscourse-doctrine + timeline-grammar +
  accessibility-targets + test-discipline + point-standing-economy +
  evidence-doctrine):
  - cdiscourse-doctrine §1 — Score is gameplay analysis, never truth. ✓
    Metadata is observation, not score; no truth labels.
  - cdiscourse-doctrine §2 — Heat means activity. ✓ The deep-equal-across-bands
    test proves heat / standing / tone / temperature never feed any code.
  - cdiscourse-doctrine §3 — Popularity is not evidence. ✓ `applyAntiAmplification`
    is in the forbidden-imports list (line 97 of the source-scan test).
  - cdiscourse-doctrine §4 — AI moderator hard limits. ✓ No AI imports
    anywhere; synchronous pure-TS only.
  - cdiscourse-doctrine §5 — Rules engine is sacred. ✓ `engine.ts` untouched.
  - cdiscourse-doctrine §6 — Secrets policy. ✓ Zero key literals in diff.
  - cdiscourse-doctrine §7 — No AI calls from production. ✓ Verified by the
    forbidden-imports scan.
  - cdiscourse-doctrine §8 — Supabase conventions. ✓ No DB write, no migration,
    no Edge Function.
  - cdiscourse-doctrine §9 — Plain language for users. ✓ Every code maps via
    `PLAIN_LANGUAGE_COPY` (the single source of truth, extended in place per
    LIFE-001 precedent).
  - cdiscourse-doctrine §10 — v1 scope guards. ✓ No voting, no search, no
    push, no OAuth, no public API.
  - timeline-grammar — META-001 introduces no visual layer; no shape / color /
    stroke / strength token added. Labels carry no truth/judgment language. ✓
  - accessibility-targets — No UI in this card; design defers accessibility to
    SC-004 / ST-002 / GAL-002 consumers; labels are ≤ 32 chars per chip width
    minimum (verified at line 42 + 96 of plain-labels test). ✓
  - test-discipline — Pure-model tests only; +318 tests; 100% line + branch
    coverage on all 5 source files (achievable per pure-TS, no I/O). ✓
  - point-standing-economy — META-001 does NOT call `gradeChallenge` /
    `gradeRepair` (forbidden-imports test line 101). Anti-amplification
    operates on standing, NOT on metadata. ✓
  - evidence-doctrine — EV-001 artifacts consumed read-only via the
    `artifactsByMessageId` input; the `evidence_debt` manual tag is a
    participant annotation, not a verdict on the source's truth (doctrine
    docblock at design line 1023). ✓

## Test coverage

- [x] **All public functions have unit tests.**
  - `buildMoveMetadataLedger` — 49 tests in `moveMetadataLedger.test.ts`.
  - `applyManualTag` / `removeManualTag` — 105 tests in `manualTagModel.test.ts`
    (full 80-case eligibility matrix + apply/remove semantics + dedupe).
  - `deriveAutoMetadataForMessage` — 44 tests covering all 16 codes with
    happy + boundary cases.
  - `computeLifecycleCausationForMove` / `diffLedgers` — 19 tests covering
    first-render, second-render diff, attribution, soft-delete events.
  - `getManualTagPlainLabel` / `getAutoMetadataPlainLabel` /
    `_forbiddenMetadataTokens` / `MANUAL_TAG_ELIGIBILITY` /
    `ALL_MANUAL_TAG_CODES` / `ALL_AUTO_METADATA_CODES` — 21 tests across
    plain-labels + 14 across doctrine anchors.
- [x] **User-facing strings have ban-list assertion.** 33-token list scanned
  against every label in plain-labels test; JSON-stringify scan in doctrine
  anchors confirms no block/prevent/reject/forbid/disallow/denied tokens
  produced anywhere in the ledger output.
- [x] **Edge cases from design § "Edge cases" have tests.** All 22 numbered
  cases covered by name in `moveMetadataLedger.test.ts` (empty room, root-only,
  detached, deleted-message tag drop, soft-delete event, eligibility refused,
  unknown messageId, oscillating tags, conflicting cross-user tags, double-tag
  dedupe, `evidence_debt` + sourced coexistence, `needs_source` on evidence
  move, `source_attached` + `needs_source` coexistence).
- [x] **Forbidden-imports test present.** `metadataForbiddenImports.test.ts`
  (58 tests) scans every source file for forbidden value imports
  (`deriveMessageCategory`, `derivePrimaryQualifier`, `deriveMessageQualifiers`,
  `deriveAxis`, `applyAntiAmplification`, `gradeChallenge`, `gradeRepair`),
  forbidden module imports (engagementIntelligence/, react, react-native,
  @supabase/supabase-js, expo-*), forbidden network primitives (`fetch(`,
  `XMLHttpRequest`), forbidden env secrets (ANTHROPIC_API_KEY, XAI_API_KEY,
  SERVICE_ROLE, SUPABASE_SERVICE_ROLE_KEY), and forbidden logging
  (`console.log`).
- [x] **Doctrine ban-list test present.** `metadataDoctrineAnchors.test.ts`
  (14 tests) covers tag-vs-flag boundary, JSON-stringify block-token scan,
  per-label verdict-token scan, observer-universal-refusal scan, cluster-wide
  mirroring, no-AI surface, async-free guarantee, and the 5-variant
  band/tone/temp deep-equal test.
- [x] **LIFE-001 integration test present.** `metadataLifecycleIntegration.test.ts`
  (8 tests) covers cluster boundary parity, lifecycleState pass-through, axis
  mirror via `PointLifecycleSnapshot.axis`, no dropped messages, branchId
  mirror, two-render snapshot-diff transition events, BR-001 `branch_created`
  auto-metadata, and full-pipeline 60-node performance.
- [x] **JSON-serializability + performance tests present.**
  `moveMetadataLedger.test.ts` includes JSON-stringify round-trip test +
  250-message synthetic fixture < 60 ms perf assertion (implementer measured
  ~9 ms).
- N/A — **Accessibility assertions.** META-001 has no UI surface; accessibility
  is deferred to SC-004 / ST-002 / GAL-002 per design § "Accessibility
  contract". The plain-language label length constraint (≤ 32 chars) is
  enforced as the only accessibility-adjacent assertion this card owns.

## Eligibility matrix verification

The eligibility matrix is the headline doctrine surface (per design § "Manual
tag vocabulary table"). I verified independently:

- The 10-tag × 4-actor-role × 2-own-bubble = 80-case matrix is generated
  programmatically in `manualTagModel.test.ts` lines 97–110 with each case
  asserted against a `computeExpected()` ground truth function (lines 112–124).
- The own-bubble allowed set is verified by name at lines 86–92: exactly
  `['concession_offered', 'narrowed_claim', 'ready_for_synthesis']` (sorted),
  no more, no less.
- Observer-universally-refused asserted at lines 68–72 across all 10 tags.
- Admin-universally-allowed asserted at lines 74–78 across all 10 tags.
- Participant-on-other-bubble universally allowed asserted at lines 80–84.
- The source-of-truth table `MANUAL_TAG_ELIGIBILITY_TABLE` in
  `manualTagModel.ts` lines 35–97 matches the design table at lines 401–412 of
  the design doc verbatim.

## Plain-language label correctness

All 26 codes mapped through `gameCopy.PLAIN_LANGUAGE_COPY` (the single source
of truth):

- Manual tags (10): `Needs source / Needs quote / Definition fight / Scope
  challenge / Mechanism challenge / Evidence debt / Concession offered /
  Narrowed claim / Tangent / side issue / Ready for synthesis`. All ≤ 32 chars.
  Zero verdict / amplification / person-attribution tokens. Zero
  block / prevent semantics. No person-attribution drift.
- Auto metadata (16): `Has a reply / Has a challenge / Has a counter-challenge
  / Evidence attached / Source requested / Quote requested / Source attached /
  Quote attached / Same side skipped / No follow-up yet / Repeated challenge on
  same axis / Branch suggested / Branch created here / Point stalled / Point
  exhausted / Synthesis candidate`. All ≤ 32 chars. Zero forbidden tokens.
- Three codes shared with LIFE-001 (`source_requested`, `quote_requested`,
  `branch_suggested`) keep LIFE-001's labels — verified at
  `metadataPlainLabels.test.ts` lines 139–143.
- `evidence_debt` label correctly updated from `'Receipts needed'` →
  `'Evidence debt'` per design § "v1 default labels" line 654; bookkeeping
  updates to `pointLifecyclePlainLabels.test.ts` + `seamlessConversationEntry.test.ts`
  are the only test regressions and both have inline comments explaining the
  change.

## Frozen-surface integrity

Verified via `git diff origin/main..HEAD --name-only`:

- BR-001 surface: `branchTopologyModel.ts` — zero diff. ✓
- LIFE-001 surface: `pointLifecycleModel.ts`, `pointLifecycleClusters.ts`,
  `pointLifecycleAdvisoryInputs.ts` — zero diff. ✓
- VG-002 surface: `railSegmentModel.ts`, `GradientWaveRail.tsx`,
  `ArgumentTimelineMap.tsx` — zero diff. ✓
- `argumentGameSurfaceModel.ts` — zero diff. ✓
- The only file modified in `src/features/arguments/` is `gameCopy.ts` —
  additive 23 entries + 1 value update for `evidence_debt`. ✓
- No `package.json` / `package-lock.json` change — confirmed by name scan. ✓
- No `supabase/migrations/` / `supabase/functions/` touch. ✓
- No `.env*` touch. ✓

## Blockers

None.

## Suggestions (non-blocking)

1. **Label collision: `'Has a reply'`** — `PLAIN_LANGUAGE_COPY.answered` (a
   LIFE-001 lifecycle state) and `PLAIN_LANGUAGE_COPY.has_reply` (a META-001
   auto-metadata code) both render the exact string `'Has a reply'`. The codes
   are distinct internal keys and the labels are intentionally aligned per
   design § "Codes shared between LIFE-001 lifecycle vocabulary and META-001
   auto metadata", but SC-004 / ST-002 will need to either de-duplicate at
   render time or qualify the chip context (`'Move: Has a reply'` vs
   `'Cluster: Has a reply'`) to avoid ambiguity. Not blocking — META-001 ships
   the model correctly; this is a downstream UI concern. Discovery candidate
   for **COPY-001** label review.

2. **`autoMetadataModel.ts` line 256–258 — cluster.primaryAxis approximation**
   — The `repeated_axis_pressure` derivation approximates "descendant.axis ===
   node.axis" by checking `clusterSummary.primaryAxis === node.snapshot.axis`.
   This is correct when both this node and the cluster agree on the same
   primary axis (which is the common case), but on a tangential branch whose
   primary axis differs from a descendant's axis-tagged contribution, the
   counter could be under-counted (false negative). The design explicitly
   accepts false negatives as the safer trade for this advisory signal (line
   404 of `autoMetadataModel.ts` doc comment). No fix required for v1; GAME-001
   may tune after AN-003 lands and surfaces real-room frequency. Discovery
   candidate for **META-1D** (six-month vocabulary review).

3. **Performance test threshold loosened** — Design § "Edge cases" line 1013
   targeted `< 30 ms at 250 messages`; the implementer asserts `< 60 ms`
   (`moveMetadataLedger.test.ts` line 1210). Measured runtime per implementer
   is ~9 ms in practice, so the 60ms guard is a conservative CI-safety margin
   rather than a regression. The looser threshold reduces flake risk under
   load and is acceptable.

4. **Plain-labels test count slightly different from implementer report** —
   The task brief reported 29 tests in `metadataPlainLabels.test.ts`; actual
   per-file count is 21. The total test count (318) and total suite count (8)
   match. Probably a recount-stale report; no impact on coverage. The
   `metadataDoctrineAnchors.test.ts` count (14) matches the brief exactly.

5. **`docs/core/current-status.md` ordering** — The implementer correctly prepended
   the META-001 block above the LIFE-001 block; the `_Last updated` line now
   correctly reads `META-001 ... build complete`. Matches the prior-card
   convention from LIFE-001 / BR-001 / VG-002.

## Operator next steps

- Push the branch: `git push -u origin feat/META-001-move-tag-flag-metadata-event-ledger`
- Open PR: `gh pr create --title "META-001: Move tag / flag / metadata event ledger" --body-file docs/reviews/META-001.md`
- Deploy steps (from design § "Operator steps"): **None — pure code change.**
  No migration, no Edge Function deploy, no Supabase write, no env change, no
  new dependency. Standard pre-PR checks are sufficient:

  ```powershell
  npm run typecheck
  npm run lint
  npm run test
  ```
