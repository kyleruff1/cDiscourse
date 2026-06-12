# SPRINT 2026-06-12 — REF Slate Index (Disagreement-Loop / Referee-Surface)

**Status:** Design + issue-filing run complete. 1 slate doc written; 7 new issues filed (#584–#590); 1 existing issue amended by comment (#504); this index.
**Author role:** Claude Code (ultracode / dynamic-workflow), human-orchestrated under the credential contract in the REF-SLATE-2026-06-12 driver prompt.
**Created:** 2026-06-12.
**Verified-at-HEAD:** `c46c8e0` (squash-merge of PR #583 `feat(OPS-MCP-BAN-SCAN-NORMALIZATION) …`). `main == origin/main` confirmed at run start and before push.
**Preflight baselines (captured this run):** Jest **715 suites / 29620 passed + 1 pre-existing skip** (exit 0; exact match to the operator anchor) · mcp-server Deno **1741 / 0** via `deno task test` (exit 0; brief expected 1700 — delta = #583's +41, see ledger item 1) · `npm run typecheck` exit 0 · `npm run lint` exit 1 with **all 12 errors confined to 5 stale `.claude/worktrees/` sibling checkouts; zero errors in the live tree** (the known pre-existing noise; ledger item 6) · `npm run checkpoint` pass, secret scan clean.
**Governance:** binds to `docs/core/pipeline-governance-contract.md` (§3 HALT, §4 never-self-approve, §5 merge rules). This run performed no card's IMPLEMENT stage, no deploy, no provider call, no Supabase write, no routing/registry change.

---

## 0. What this run did (and did not do)

- **FILED 7 cards** (#584–#590): the REF disagreement-loop slate per
  `docs/roadmap-expansions/2026-06-12-disagreement-loop-referee-surface-roadmap.md`, all added to Project #1 with
  Phase=Backlog + Priority/Effort/Epic/Release/Risk set and read-back verified.
- **AMENDED 1 open issue by comment** (#504 — `issuecomment-4688728719`): the chassis-vs-synthesis boundary between
  CARD-VIEW-DATA-001 and REF-002/REF-003, including the referee-banner unification disposition. Additive comment only;
  no body rewrite, no label change.
- **SKIPPED the brief's second headline deliverable** — `OPS-MCP-BAN-SCAN-NORMALIZATION` design doc + issue —
  because the card **already shipped at HEAD** (ledger item 1). No duplicate doc, no duplicate issue.
- **INTEGRATED the mid-run operator addendum** (precision fill + automerge posture): live-verified its 48-file source
  inventory, added slate §4A/§4B/§7A, amended all seven freshly-filed issue bodies in place via `gh issue edit`
  (ledger item 12). Body edits touched only this run's own issues — no pre-existing issue body was rewritten.
- **No code, no tests, no migrations, no Edge/Deno source** were written. No runtime mutation: no provider call, no
  Supabase write (read-only `select now()` preflight only), no service-role, no `CLASSIFIER_QUEUE_ROUTING_*` change,
  no `productionEnabled` flip, no bot posting, no `.env*` touch.
- **No issue closed** (`CDISCOURSE_ALLOW_SUPERSEDED_ISSUE_CLOSE` unarmed; no supersession candidate surfaced anyway).
- **Docs PR auto-merged** under `CDISCOURSE_ALLOW_DOCS_AUTOMERGE=1` (armed by the operator mid-run), after
  path-verification to the declared allowlist — see §7.

---

## 1. Card index (code → issue → action → doc → lane)

| # | Card | Issue | Action | Doc | Lane | GATE-C? | Automerge posture (distinct from GATE-C; see slate §7A) | Phase set |
|---|---|---|---|---|---|---|---|---|
| 1 | `REF-001` | [#584](https://github.com/kyleruff1/cDiscourse/issues/584) | **FILE** | GATE-A design later: `docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md` | design-only | no (GATE-A artifact) | Eligible (docs-only design PR; GATE-A ratification is separate) | Backlog |
| 2 | `REF-002` | [#585](https://github.com/kyleruff1/cDiscourse/issues/585) | **FILE** | GATE-A later | src pure model + tests | no | Prefer eligible after reviewer PASS (pure model) | Backlog |
| 3 | `REF-003` | [#586](https://github.com/kyleruff1/cDiscourse/issues/586) | **FILE** | GATE-A later | src UI | no | Prefer eligible only if reviewer classifies low-risk UI-only | Backlog |
| 4 | `REF-004` | [#587](https://github.com/kyleruff1/cDiscourse/issues/587) | **FILE** | GATE-A later | src UI | no | Case-by-case (gate-adjacent UI integration) | Backlog |
| 5 | `REF-005` | [#588](https://github.com/kyleruff1/cDiscourse/issues/588) | **FILE** | GATE-A later | src; persistence split to named follow-up `REF-005B` | **becomes GATE-C if `supabase/**` lands in-card** (flagged in body) | Not eligible while persistence/visibility surfaces are in play | Backlog |
| 6 | `REF-006` | [#589](https://github.com/kyleruff1/cDiscourse/issues/589) | **FILE** | protocol + template under `docs/testing-runs/` | docs/testing (human-run; zero provider spend) | no | Eligible (docs-only) | Backlog |
| 7 | `REF-ADR-001` | [#590](https://github.com/kyleruff1/cDiscourse/issues/590) | **FILE** (not folded — see below) | ADR later: `docs/designs/REF-ADR-001-MOVE-INTENT-DOCTRINE.md` | docs-only ADR | **yes — defines operative semantics; operator-ratified merge** (governance §5) | **Not eligible — operator-ratified** (addendum default yields to contract; contract wins) | Backlog |
| 8 | `CARD-VIEW-DATA-001` | [#504](https://github.com/kyleruff1/cDiscourse/issues/504) | **AMEND** (comment `issuecomment-4688728719`) | — | — | — | — | unchanged |
| 9 | `OPS-MCP-BAN-SCAN-NORMALIZATION` | none (never had one) | **SKIP — superseded by shipped work** | `docs/designs/OPS-MCP-BAN-SCAN-NORMALIZATION.md` (Status: Implemented 2026-06-12) | shipped: PR #583 = HEAD `c46c8e0` | was GATE-C; merged by operator lane | — | — |
| 10 | QOL-030/031/032/033 · RULE-004/005/006 · UX-001.5A · SC-003 · ST-002 · GAL-002 · BR-003 · GAME-003 · EV-005 · COMPOSER-002 · COPY-001 · LIFE-001 · META-001 · IX-001 · SMOKE-FIX-002 · MCP-CAT-001 · MCP-MOD-001…008 | #199–#202, #114–#117, #298, #11, #13, #31, #119, #120, #111, #71, #61, #62, #20, #240, #238, #230–#237 | **SKIP-amend (all CLOSED)** | relationships recorded in slate §9 instead of comments on closed issues | — | — | — | — |

**REF-ADR-001 FILE-vs-FOLD outcome:** FILED. Rationale: the Constitution v1.1 disposition is an operator-ratified
doctrine decision with its own decision-record precedent (`OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md`); folding it
into REF-001's UI design doc would bury a doctrine ratification inside a GATE-A artifact. It is a **soft**
(non-blocking) input to REF-001 — no priority inversion (validated in §2).

---

## 2. Dependency DAG (validated acyclic by the adversarial pass)

```
REF-ADR-001 #590 (P2, docs ADR) ··soft, non-blocking··► REF-001 #584 (P0, design)
REF-001 #584 ──► REF-002 #585 (P0, pure model) ──► REF-003 #586 (P1, card surface) ──► REF-004 #587 (P1, loop)
REF-001 #584 ──► REF-005 #588 (P1, allegations)      [substrate: UX-001.5A #298, shipped]
REF-003 #586 ──► REF-006 #589 (P1, human smoke)      [ideally after REF-004]
REF-003 #586 ··coordinates with··► #504 CARD-VIEW-DATA-001 (OPEN; shared CardDetailPanel chassis, disjoint zones,
                                                      referee-banner unification disposition fixed at REF-001 GATE A)
```

No cycles. No card depends on Family-J advancement, routing changes, or superseded work. The only P2→P0 edge
(ADR→REF-001) is soft/non-blocking in every artifact that mentions it. REF-006 vs open #479 (instrumented corpus run)
is explicitly human-vs-instrument distinct; no REF card overlaps #552, #508, #462, #433, #388, or #79.

---

## 3. Divergence ledger (brief vs live tree — what each artifact now says)

1. **`OPS-MCP-BAN-SCAN-NORMALIZATION` already shipped.** The brief carried it as a card to design + file (its §5.3);
   at HEAD it IS the HEAD commit (`c46c8e0`, PR #583, merged 2026-06-12T06:22Z). `mcp-server/lib/banScanNormalize.ts`
   exists (`normalizeForBanScan` + the shared `banScanMatches` raw-OR-normalized union matcher, routed through all
   eleven call sites); `docs/designs/OPS-MCP-BAN-SCAN-NORMALIZATION.md` carries Status: Implemented with
   implementation actuals; the #578 EDGE pins are flipped with notes naming the card; the 20 SURV exemplars survive;
   no pattern array changed. The shipped design matches the brief's §5.3 content in every load-bearing respect
   (including the brief's STOP-1/STOP-2 resolutions). **Run adaptation: deliverable SKIPped; no duplicate artifact.**
   The Deno count delta (brief 1700 → live 1741) is exactly this card's +41. Note: #583's post-merge Deno Deploy
   build readback + `/health` verification is recorded in `docs/core/current-status.md` as a PENDING operator
   follow-up.
2. **Engine path.** The brief's invariant text cited `src/lib/constitution/engine.ts` — that file does not exist
   (`src/lib/constitution/` holds only `semanticClassifierCatalog.ts`). Live engine:
   `src/domain/constitution/engine.ts`; submit-time gate is the Edge mirror
   `supabase/functions/_shared/constitution/evaluateArgumentDraft.ts`
   (`supabase/functions/submit-argument/index.ts:13`; engine run + `allowPost` block at `:296-337`; the other blocking
   paths — schema, auth/role, concession-structure — are likewise deterministic). All artifacts cite the live path.
   The checked-in `CLAUDE.md` § "Rules Engine is Sacred" still carries the stale `src/lib/` path — **recommended
   housekeeping (operator decision; not edited by this run).**
3. **Deploy posture for `mcp-server/**`.** Live evidence (PR #583 body "merge auto-builds `cdiscourse-mcp-server`";
   the 2026-06-11 audit's empirical post-merge readback; every post-2026-06-10 status entry) says a merge to `main`
   **does** auto-build on Deno Deploy. `docs/core/pipeline-governance-contract.md:118` still says the opposite
   ("not auto-deployed on merge"). The **normative consequence is identical** (GATE-C operator-only merge), but the
   contract's stated reason is inverted — recommended housekeeping for a future contract revision. The slate carries
   no `mcp-server/**` card, so nothing in this run turns on the resolution.
4. **H and I families are now production-enabled.** `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
   has `claim_clarity` (`:106`) and `thread_topology` (`:111`) `productionEnabled: true`; `sensitive_composer` is the
   **sole** `false` (`:114-117`). The 2026-06-04 sprint index's "frozen H/I/J" is now "frozen J". REF-002 gates
   classifier inputs via the live mirror `HUB_NON_PRODUCTION_FAMILIES = ['sensitive_composer']`
   (`src/features/arguments/detail/argumentDetailModel.ts:670-671`) rather than any hardcoded roster — exactly the
   brief's instruction. (Open issues #552/#462 contain stale H/I statements; not this run's surface.)
5. **Anchor drifts corrected in the artifacts:** "exactly one type" lives at `docs/core/constitution-v1.md:18`, not
   in `product-spec.md:72-76` (which is the Room Detail section; the compose-drawer real-time validation note is
   `:75`); RULE-005's advisory suggestion machinery is at `:70-74`, `:333-355`, `:469-506` (the brief's `:810-820` is
   its out-of-scope section); the board hard-constraints block is at `ux-ui-project-board.md:750-759` (score/heat/
   popularity doctrine verified at `:51-57`); the cross-family ADR's decision section is `:145-157` (descriptive-token
   rationale verified at `:43-55`).
6. **Baseline counts.** Jest matched the brief exactly. Deno: see item 1. Lint: exit 1 caused **only** by 5 stale
   `.claude/worktrees/` sibling checkouts (2 error files each, all under `…/mcp-server/tests/`); zero live-tree
   errors — the brief's anticipated pre-existing noise, verified to be all there is. Working tree at run start: 18
   untracked files (operator artifacts: testing-run reports, ops SQL dirs, `out/`, `netlify-prod.git`, root
   `deno.jsonc`), zero modified tracked files.
7. **Dry-run JSONL run-id mismatch.** The brief's named JSONL
   (`logs/engagement-intelligence/2026-06-12T05-25-01-611Z-f7e9f125-…`) exists (73,917 bytes) but is an **earlier
   same-day dry run**; the committed-format reports (`docs/testing-runs/2026-06-12-*-dry.md`) document the later
   07:04Z runs (`0ff245ae` / `78c2c2fd`) and carry the skill-gate hashes + zero-spend lines. Both reports are
   **untracked worktree artifacts** of the operator's corpus lane — the slate cites them with that caveat and this PR
   does not commit them (outside the run's declared allowlist).
8. **QOL-030/031/032/033 are built**, not pending designs (issues #199–#202 CLOSED; "build complete, awaiting
   Review" per `docs/core/current-status.md`; code in `src/features/arguments/oneBox/`). REF-004's dependency text
   names the shipped chassis. The four design-doc headers still say "Status: Design" — read `current-status.md` for
   build state.
9. **All §5.4 amendment candidates are CLOSED** except #504. Per the brief ("for each open issue"), exactly one
   AMEND comment was posted; closed-issue relationships are recorded in slate §9 (no comments on closed issues — keeps
   history quiet).
10. **UX-001.5A descriptor nuance:** `AnnotationChipDescriptor.source` is optional (`source?:`,
    `annotationChipDescriptor.ts:111`); the existing adapter bridges the roadmap-level Observation/Allegation form.
    REF-001/REF-005 carry the nuance.
11. **The two prompt-standard skills** named by the brief (`cdiscourse-prompt-standard`, `cdiscourse-prompt-author`)
    are not available in this session's skill registry; their conventions were applied from the brief's restatement.
    `cdiscourse-doctrine` was invoked before drafting, as required.
12. **Mid-run operator addendum (precision fill + automerge posture) integrated after initial filing.** The addendum
    (§5.3A–C, §8.5, §9A, §10A) arrived after the seven issues were created and before the docs PR was committed. The
    run live-verified the addendum's 48-file source inventory (46 exact; two path corrections:
    `timelineMiniMapModel.ts` and `timelineDensityLensModel.ts` live at `src/features/arguments/`, **not** under
    `oneBox/`), verified the named exports (`buildActPopout`, `deriveSuggestedMoves:336`, `NodeLabelMark:89`,
    `BannerSelectionResult:151`, `CategoryReading:166`, `USER_ALLEGATION_REGISTRY:139`, `PointLifecycleState:80`) and
    all anchor test files, added slate §4A (convergence seams) / §4B (derivation table, axis normalization, frozen
    copy set) / §7A (automerge posture), and amended all seven issue bodies in place via `gh issue edit` (each gained
    an Automerge posture block plus its card-specific precision patch). One addendum⨯contract conflict resolved
    contract-wins: REF-ADR-001 is **not** automerge-eligible despite being docs-only, because it defines operative
    semantics (governance §5).

---

## 4. Frozen set — left untouched (attested)

| Frozen surface | State at HEAD `c46c8e0` | Cite |
|---|---|---|
| J `sensitive_composer` `productionEnabled` | `false` (sole `false` in the registry) | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-117` |
| H `claim_clarity` / I `thread_topology` | `true` (production-enabled — ledger item 4; NOT changed by this run) | `familyRegistry.ts:106,:111` |
| Client non-production mirror | `['sensitive_composer']` | `src/features/arguments/detail/argumentDetailModel.ts:670-671` |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | baseline off (fail-closed `=== 'true'`) | `supabase/functions/submit-argument/index.ts:812` |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | default-disabled posture | `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:72,:85` |
| Ban-scan stack (doctrine + per-family lists, normalizer) | untouched by this run | `mcp-server/lib/doctrineBanList.ts`, `banScanNormalize.ts` (shipped by #583, pre-run) |

No card filed by this sprint flips a `productionEnabled` flag, arms routing, raises a percentage, edits a ban list,
or lowers any test/guard/bar. REF-005's only deploy-adjacent fork (in-card persistence) is explicitly GATE-C-flagged
in its body.

---

## 5. State verification (confirmed at HEAD by the Phase-0 fan-out)

1. ✅ Seven Constitution types + hard transition matrix — `docs/core/constitution-v1.md:18,:34-46`.
2. ✅ AI moderation hard rules — `docs/core/product-spec.md:92-106` (incl. `authoritative = false`, engine always
   authoritative at `:106`).
3. ✅ RULE-005: 12 active channels + 2 reserved — `docs/designs/RULE-005.md:130,:134-149`; advisory doctrine `:70-74`;
   no-keyword-block guarantee `:501-506`.
4. ✅ RULE-004 advisory sheet + transformation actions — `docs/designs/RULE-004.md:423-440`.
5. ✅ QOL-030 three-gates doctrine (stage never removes) — `docs/designs/QOL-030.md:85-98`; composite `respond`
   `:227-243`; chassis built (`src/features/arguments/oneBox/`, 8 named files present).
6. ✅ Deterministic engine sole submit gate — `supabase/functions/submit-argument/index.ts:13,:296-337`.
7. ✅ `gameCopy.toPlainLanguage` — `src/features/arguments/gameCopy.ts:855`.
8. ✅ LIFE-001 / META-001 shipped — `src/features/lifecycle/pointLifecycleModel.ts`, `src/features/metadata/`.
9. ✅ UX-001.5A descriptor — `src/features/nodeAnnotations/annotationChipDescriptor.ts:59,:66,:111`.
10. ✅ Cross-family ADR Option 0 ratified (per-family stacks; no union) —
    `docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md:145-157`.
11. ✅ No standing whole-file byte pin on `doctrineBanList.ts` / `family*BanListScan.ts` / `keyLevelFailClosed.ts`
    (constant-level source/flags pins only — WIDEN-3 `keyLevelFailClosedWidening.test.ts:216-224`).
12. ✅ `REF-` namespace fully clear pre-filing (no issue, no `docs/designs/REF-*.md`, no branch).
13. ✅ #504 is OPEN and its zone 2 / slice 4 are as the comment describes (`CardDetailPanel.tsx` is its in-progress
    component).

---

## 6. Adversarial validation outcome: **PASS** (0 BLOCK)

Six independent checkers (doctrine ban-scan · acceptance-gate invariant · frozen-surface breach · DAG + scope-overlap ·
stale-citation · secret-hygiene + historical-integrity) ran over the slate, all 7 issue bodies, and the #504 comment
**before any `gh` mutation**. Zero BLOCK findings. Six FIX findings, **all applied before filing**:

1. Slate §9 "source-of-…" registry jargon reworded to "the canonical registry" (ban-token hygiene; the removed token is not re-quoted here).
2. REF-005 doctrine block gained the explicit Family-J / composer-only restatement.
3. Slate §9 META-1D claim corrected to #79's actual 26-code scope (scope extension proposed-on-#79, not assumed).
4. #504 comment + REF-003 scope gained the referee-banner unification disposition (the named collision point).
5. Untracked testing-run citations annotated as operator worktree artifacts (not committed by this PR).
6. "Only blocking check" overstatement reworded in slate §2.1 + REF-001 (other blocking paths exist; all
   deterministic).

NOTE-severity items recorded without action: derived word-forms ("corrected", "anti-manipulation") that no
word-boundary scanner matches (two reworded anyway); the invariant is byte-identical across all six carrying bodies +
the slate; `CLAUDE.md` engine-path staleness (housekeeping recommendation, §8 of the completion report); QOL design-doc
headers lag build state.

---

## 7. Credential boundary attestation

| Lane | Used? | Notes |
|---|---|---|
| GitHub auth (cached `gh`, scopes incl. `project`) | ✅ | 7× issue create, 1× issue comment, 7× project item-add + 41 field edits as `kyleruff1`; 2 transient TLS timeouts retried once each, succeeded |
| Supabase linked read path | ✅ | one leak-safe `select now()` via `npx supabase db query --linked --file .tmp/ref-slate-preflight-now.sql`; no write, no DML, no table read |
| Bot-user JWT | ❌ | not obtained — lane not armed for this run (design-only; no synthetic submission) |
| `.claude-tmp/operator-secrets.env` | ❌ | not read — no command needed it |
| `CDISCOURSE_ALLOW_DOCS_AUTOMERGE` | ✅ armed by operator mid-run | exercised: green squash-merge of this run's docs-only PR after path-verification to the allowlist |
| `CDISCOURSE_ALLOW_SUPERSEDED_ISSUE_CLOSE` | ❌ unarmed | no close performed; no candidate surfaced |

> No provider call (Anthropic/xAI/X/MCP), no Supabase write, no service-role, no migration, no Edge/Deno deploy, no
> routing arm or percentage change, no `productionEnabled` flip, no bot posting, no `.env*` edit, no secret printed or
> committed. Pre-push staged-diff secret scan and `main == origin/main` branch-context gate both ran clean before
> push. Temp artifacts (`.claude-tmp/ref-issue-*.md`, `ref-comment-504.md`, `.tmp/ref-slate-preflight-now.sql`)
> removed at end of run.

---

## 8. Doctrine attestation

- §1/§3 — no truth/winner labels anywhere; verdict/person tokens appear only inside prohibition lists and ban-list
  test specifications (checker-verified per artifact); popularity-is-not-evidence restated in REF-002.
- §4/§5 — acceptance-gate invariant verbatim (byte-identical) in REF-001…REF-006 bodies + slate §2; the engine is the
  sole gate; classifiers run post-storage; the Referee Card never blocks a post and updates asynchronously.
- §4-C/§4-T — no registry flip, no routing change, no bar lowered; the run's only HALT-adjacent finding
  (shipped-card collision) resolved by SKIP, not by renaming/refiling.
- §6 — no secret value in any artifact; credential shapes scanned in drafts and in the staged diff.
- §7 — no AI call by this run; REF cards consume persisted Observations only; REF-006 is explicitly zero-spend.
- §8 — no doc/issue history rewritten (comment + labels only); Constitution immutability restated in REF-ADR-001
  (option (1) constrained additive-only); `flags` soft-dismiss preserved in REF-005.
- §9 — zero raw `snake_case` outside code spans in any artifact (checker-verified); rail states map through
  `gameCopy`.
- §10a — Observations vs Allegations distinction load-bearing in REF-001/REF-002/REF-005; sensitive Observations
  composer-only restated wherever allegations are discussed; Family J never an input (REF-002 test-pinned by design).

---

## 9. Parallel-taxonomy check + specificity ledger (addendum §10A)

**Parallel-taxonomy check: PASS.** The slate and every issue body treat the Open Issue as a composition over the
existing seams — Act (`buildActPopout`), Inspect (`inspectContentBuilder`), Go (`goPopoutModel` +
`timelineMiniMapModel`/`timelineDensityLensModel`), suggested moves (`deriveSuggestedMoves`), node labels
(`nodeLabels/` registries), referee banners (`selectBanner`/`RefereeBannerView` reused as zone-1 seed, never forked),
referee ledger (`CategoryReading` consumed, no second ledger), evidence debt (`evidenceDebtModel`), lifecycle
(`pointLifecycleModel`), metadata ledger (`moveMetadataLedger`), active disagreement (`activeDisagreement`), tangent
routing (`tangentRoutingModel`). No new classifier family, no new provider path, no second compose system, no second
scoring ledger, no new action-label vocabulary is introduced anywhere in the slate.

**Specificity ledger (source + test inventories named per issue body):**

| Card | Source seams named in body | Test paths named in body |
|---|---|---|
| REF-001 #584 | convergence-map rows: Act/Inspect/Go/`oneBox`/`suggestedMoves`/`nodeLabels`/`refereeBanners`/`refereeLedger`/`evidenceDebt`/lifecycle/metadata/`activeDisagreement`/`tangentRouting` + slate §4A/§4B | names the REF-002/REF-003 test files its design must specify |
| REF-002 #585 | `refereeLoop/openIssueModel.ts` target · `actPopoutModel` · `suggestedMovesModel:336` · `HUB_NON_PRODUCTION_FAMILIES` mirror · `BuildOpenIssueInput` API | `openIssueModel.test.ts` · `.banlist` · `.actGateParity` · `.sensitiveSurface` + 5 anchor suites |
| REF-003 #586 | `cardView/CardDetailPanel.tsx` + 3 card models · `RefereeBannerView` reuse · `RefereeCardView.tsx`/`OpenIssueRefereeCard.tsx` candidates | `RefereeCardView.test.tsx` · `refereeCardBanList` · `refereeCardNoRawCodes` · `refereeCardA11y` + anchors |
| REF-004 #587 | oneBox chassis files · handoff matrix over live `ActEntryId`s · `tangentRoutingModel`/`branchTopologyModel`/`branchGrammarModel` | `disagreementLoopRouting` · `GoFilter` · `RecoveryRoutes` · `InspectRawKeys` + 5 anchor suites |
| REF-005 #588 | `StructuredConcernDraft` types · `userAllegationRegistry:139` · `moveMetadataLedger` · `flags` conventions caveat | `requestReviewModel` · `requestReviewVisibility` · `requestReviewCopyBanList` · `requestReviewFlagsConventions` |
| REF-006 #589 | 5-task script + 10 named capture fields | n/a (human protocol; Markdown artifacts) |
| REF-ADR-001 #590 | RULE-005 channels · constitution-v1 anchors · cross-family ADR model | n/a (docs-only) |

No missing-specificity findings remained after the addendum integration pass.
