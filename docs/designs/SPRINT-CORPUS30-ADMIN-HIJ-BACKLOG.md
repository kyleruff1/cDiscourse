# SPRINT — CORPUS-30 / Admin / H-I-J Backlog (issue index)

**Status:** Sprint backlog index. All 15 cards in this sprint are filed as GitHub issues; this doc is the operator-facing pipeline + dependency map.
**Author role:** roadmap-designer.
**Created:** 2026-06-04.
**Source request:** operator prompt of 2026-06-04 — "NEXT-SPRINT-BACKLOG-CORPUS30-ADMIN-HIJ — Claude Code roadmap-designer prompt" (the version that listed the 15 explicit card codes ADMIN-MCP-001, ADMIN-RUNTIME-GATES-001, ADMIN-ARGUMENTS-001/002/003, PHASE7-OBSERVATION-001, CORPUS-30-RESULTS-001 / -QUALITY-001 / -DIVERSITY-001, OPS-MCP-OBSERVABILITY-002, MCP-HIJ-000, MCP-H-001, MCP-I-001, MCP-J-001, CORPUS-30-BACKLOG-001).
**Predecessor doc:** [SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md) (1640 lines, commit `c680ae0`, 2026-06-04). The predecessor is the **detailed per-card design source**; this doc is the **issue index + governance dispatcher**. Where a per-card design question is referenced from a GitHub issue, the answer lives in the predecessor's matching card section (see § "Predecessor card-code reconciliation" below).
**Governance:** binds to the *CDiscourse Pipeline Governance Contract v1* (`docs/core/pipeline-governance-contract.md`). Stage gates (§2), HALT conditions (§3), never-self-approve (§4), merge/deploy (§5) bind every card.
**Authoring skills:** Skill(cdiscourse-doctrine) + Skill(test-discipline) baked into every issue body.

---

## 0. Outcome of this card (the "what just happened")

Phase 0 read-only inventory ran across 6 parallel investigators producing 73KB of structured facts; a completeness critic surfaced 7 gaps and 15 doctrine/governance risks. Phase 1 ran 15 parallel card-drafters producing issue-ready bodies + dedup verdicts + governance flags; a cross-card validator confirmed valid DAG, no priority inversions, no ban-list violations (the verdict tokens only appear in `## Doctrine compliance` sections as listed prohibitions, which is the standard pattern).

Output of this card:

- **13 new GitHub issues** filed (#462 – #474, excluding #473's slot which is `MCP-J-001`; full table below).
- **1 GitHub issue updated** (#394 commented with the canonical `MCP-I-001` scoping body).
- **1 card documented as already shipped** (`ADMIN-MCP-001` ≡ PR #460 / commit `d7aa3a5`; no new issue filed — the predecessor doc also documents this).
- **6 read-only SQL files + README** for `PHASE7-OBSERVATION-001` already staged under `scripts/corpus-30-phase-7-sql/` (from an earlier session turn; bundled into this doc's commit for traceability).
- **Zero runtime mutations.** Zero classifier triggers. Zero queue arms. Zero H/I/J flips. Zero deploys. Zero migrations. Zero `public.arguments` touches.

---

## 1. Issue index (canonical card-code → GitHub issue)

| # | Code | Issue | Title | Wave | Pri | Ship-now? | Migration? | Edge deploy? | Runtime mutation? | GATE-C operator? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ADMIN-MCP-001` | *(close-out, no new issue — see PR [#460](https://github.com/kyleruff1/cDiscourse/pull/460) / commit `d7aa3a5`)* | Admin Semantic Referee — verify MCP selectable + labeled "CD - MCP Server" | 0 | P2 | yes | no | no | no | no |
| 2 | `ADMIN-RUNTIME-GATES-001` | [#462](https://github.com/kyleruff1/cDiscourse/issues/462) | Design operator-authorized runtime gate inspection surface (panel vs runbook decision) | 1 | P1 | yes (design only) | no | no | no | **yes** |
| 3 | `ADMIN-ARGUMENTS-001` | [#463](https://github.com/kyleruff1/cDiscourse/issues/463) | Canonical Argument Artifact grouping across admin argument list surfaces (DESIGN) | 1 | P1 | yes (design only) | option-dependent | no | no | no |
| 4 | `ADMIN-ARGUMENTS-002` | [#464](https://github.com/kyleruff1/cDiscourse/issues/464) | Admin inactive/archive workflow for whole arguments | 1 | P1 | yes (design only) | **yes** | **yes** | no | **yes** |
| 5 | `PHASE7-OBSERVATION-001` | [#465](https://github.com/kyleruff1/cDiscourse/issues/465) | Finish CORPUS-30 A–G classifier observation verification under MCP | 1 | P1 | yes | no | no | no | no |
| 6 | `CORPUS-30-RESULTS-001` | [#466](https://github.com/kyleruff1/cDiscourse/issues/466) | 30-stage corpus analysis + product readout (docs-only) | 2 | P1 | yes (after PHASE7) | no | no | no | no |
| 7 | `CORPUS-30-QUALITY-001` | [#467](https://github.com/kyleruff1/cDiscourse/issues/467) | Fallback-reason histogram + corrected samey-move metric + reporter thresholds (dev-tooling) | 2 | P1 | yes | no | no | no | no |
| 8 | `CORPUS-30-DIVERSITY-001` | [#468](https://github.com/kyleruff1/cDiscourse/issues/468) | Voice and spine diversity tuning for 30-thread corpus | 2 | P2 | yes (after QUALITY) | no | no | no | no |
| 9 | `ADMIN-ARGUMENTS-003` | [#469](https://github.com/kyleruff1/cDiscourse/issues/469) | Admin Arguments usability — runTag filter, classifier-coverage column, persistable prefs | 3 | P1 | no (chained) | no | **yes** | no | **yes** |
| 10 | `OPS-MCP-OBSERVABILITY-002` | [#470](https://github.com/kyleruff1/cDiscourse/issues/470) | Admin classifier health panel with failure_detail filter + runTag scope | 3 | P1 | yes (design only) | no | **yes** | no | **yes** |
| 11 | `MCP-HIJ-000` | [#471](https://github.com/kyleruff1/cDiscourse/issues/471) | H/I/J readiness ledger and blocker map (docs-only, advancement-neutral) | 4 | P1 | yes | no | no | no | no |
| 12 | `MCP-H-001` | [#472](https://github.com/kyleruff1/cDiscourse/issues/472) | Family H claim_clarity scoping / retry design only (Stage-2 re-attempt — GATE A only) | 4 | P1 | yes (design only) | no | no | no | no |
| 13 | `MCP-I-001` | [#394](https://github.com/kyleruff1/cDiscourse/issues/394) (updated; the canonical scoping body is the new comment) | Family I thread_topology scoping (DESIGN ONLY; precedes any production flip) | 4 | P1 | yes (design only) | no | no | no | no |
| 14 | `MCP-J-001` | [#473](https://github.com/kyleruff1/cDiscourse/issues/473) | Family J sensitive_composer scoping design only — deepen ratified N=0 disposition | 4 | P2 | yes (design only) | no | no | no | **yes** |
| 15 | `CORPUS-30-BACKLOG-001` | [#474](https://github.com/kyleruff1/cDiscourse/issues/474) | Human review board for corpus-30 learnings | 5 | P1 | yes | no | no | no | no |

**Ship-now? column meaning.** `yes (design only)` means: the card may begin Phase 0 + DESIGN immediately, but no IMPLEMENT phase is authorized until the operator clears GATE A on the design doc. `no (chained)` means: the card cannot begin DESIGN until its upstream cards close GATE C.

---

## 2. Sprint sequencing (5 waves)

### Wave 0 — verification close-out (zero risk)

1. `ADMIN-MCP-001` — confirm the 5 admin-semantic test files still pass (`npm test`); update `docs/core/current-status.md` if it still references this slot as pending; close as already-shipped per PR #460.

### Wave 1 — immediate ship-now design lane (operator-decision gated)

2. `ADMIN-ARGUMENTS-001` — design Argument Artifact grouping. Operator picks (a) UI heuristic / (b) `canonical_id` migration / (c) view at GATE A.
3. `ADMIN-ARGUMENTS-002` — design inactive/archive lifecycle. Operator picks (A) new column migration / (B) reuse `hidden` status at GATE A. This is the heaviest Wave-1 card (migration + Edge + GATE C).
4. `PHASE7-OBSERVATION-001` — operator authorizes execution channel (Supabase Studio paste / psql / Claude MCP OAuth); Claude runs the 6 staged SQL queries read-only; commits `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md`.
5. `ADMIN-RUNTIME-GATES-001` — design the runtime gate inspection surface (UI panel vs ops runbook). Operator-decision gated.

### Wave 2 — analysis lane (informs sprint product decisions)

6. `CORPUS-30-QUALITY-001` — fallback-reason histogram + corrected samey-move metric + reporter thresholds. Dev-tooling-only; may auto-merge if no §4 surface.
7. `CORPUS-30-DIVERSITY-001` — voice + spine tuning. Depends on `CORPUS-30-QUALITY-001` so the new fallback-reason histogram is in place when the diversity diagnosis runs. Operator picks voice-assignment-axis.
8. `CORPUS-30-RESULTS-001` — full executive readout. Diamond dependency on `PHASE7-OBSERVATION-001` + `CORPUS-30-QUALITY-001` + `CORPUS-30-DIVERSITY-001`. Docs-only.

### Wave 3 — admin polish lane (post-Wave-1 design phase)

9. `ADMIN-ARGUMENTS-003` — Admin Arguments table usability after grouping + inactive + classifier coverage signal exist. Hard chained on `ADMIN-ARGUMENTS-001`, `-002`, `PHASE7-OBSERVATION-001`.
10. `OPS-MCP-OBSERVABILITY-002` — admin classifier health panel consuming `failure_detail`. Design-only first (operator picks new tab vs extension vs CLI/SQL tool).

### Wave 4 — gated H/I/J design lane (no production flips)

11. `MCP-HIJ-000` — readiness ledger. Docs-only. **Explicit hard rule (verbatim from H-I-J roadmap §7):** "No file in this card enables any family. No doc, audit, or roadmap auto-advances a family to production. The percentage dial and the family dial are separate. One family at a time. Failure rolls back."
12. `MCP-H-001` — Family H scoping / retry design (Stage-2 GATE A only). Binds the three-conjunctive-condition retry criterion from cutover-gate-criteria E#7: (a) non-H PASS-LOAD + (b) separate operator decision + (c) provider reliability at higher organic load + clean re-run smoke. Synthetic PASS alone lowers the bar.
13. `MCP-I-001` ([#394](https://github.com/kyleruff1/cDiscourse/issues/394)) — Family I scoping (DESIGN ONLY). Mixed-source family: production-enable MUST add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = new Set(['ai_classifier'])` per HALT-13 inverse memory marker [[mcp-mixed-source-family-edge-subset]].
14. `MCP-J-001` — Family J scoping-extension (deepens ratified N=0 from closed #398 / PR #406). **Explicit framing:** this card does NOT propose flipping `productionEnabled` and is NOT a production card; cdiscourse-doctrine §10a is load-bearing (sensitive observations render composer-only). Any future J production proposal needs a fresh §10a doctrine review at roadmap-architecture level.

### Wave 5 — any-time analysis lane (no dependencies)

15. `CORPUS-30-BACKLOG-001` — human review board for the 30-debate corpus. Manual judgment work; docs-only.

---

## 3. Dependency DAG (validated as cycle-free by Workflow 2)

```
Wave 0:  ADMIN-MCP-001 (close-out)

Wave 1:  ADMIN-RUNTIME-GATES-001                     (no deps)
         ADMIN-ARGUMENTS-001                         (no deps)
         ADMIN-ARGUMENTS-002                         (no deps)
         PHASE7-OBSERVATION-001                      (no deps; SQL pack pre-staged)

Wave 2:  CORPUS-30-QUALITY-001                       (no deps)
         CORPUS-30-DIVERSITY-001 ──► CORPUS-30-QUALITY-001
         CORPUS-30-RESULTS-001   ──► PHASE7-OBSERVATION-001
                                 ──► CORPUS-30-QUALITY-001
                                 ──► CORPUS-30-DIVERSITY-001

Wave 3:  ADMIN-ARGUMENTS-003     ──► ADMIN-ARGUMENTS-001
                                 ──► ADMIN-ARGUMENTS-002
                                 ──► PHASE7-OBSERVATION-001
         OPS-MCP-OBSERVABILITY-002 ──► OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE
                                       (migration 20260602000001 — already shipped)

Wave 4:  MCP-HIJ-000             (no deps)
         MCP-H-001 (#391 history) (no in-batch deps; respects cutover-gate E#7)
         MCP-I-001 (#394 update)   ──► MCP-H-001 (informational; scoping may publish in parallel)
                                  ──► external prerequisites: MCP-SERVER-010,
                                       OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK
                                       (not in this batch; operator should verify status)
         MCP-J-001                 (no deps; scoping-extension of ratified #398)

Wave 5:  CORPUS-30-BACKLOG-001   (no deps)
```

**Diamond ack:** `CORPUS-30-RESULTS-001` waits on QUALITY + DIVERSITY + PHASE7 — implementer either waits for all three to land or accepts a placeholder for diversity findings.

---

## 4. Operator-authorized mutations section (binding)

This section is the canonical statement of what Claude Code may and may not do as cards in this sprint progress through stage gates. It echoes pipeline-governance-contract §4 and §5; any conflict is resolved in favor of the contract.

### What Claude Code MAY do autonomously inside an in-flight card

- Read any file, run any read-only SQL the operator has authorized, run any CLI command that does not mutate persistent state.
- Edit files under `scripts/`, `__tests__/`, `docs/` per the card's scope.
- Edit files under `src/` per the card's scope (typecheck/lint/test must remain green; pipeline contract §3).
- Commit + push the implementing branch.
- Open a PR for operator review.
- Auto-merge a PR **only when** the card explicitly authorizes auto-merge AND the PR is docs-only / dev-tooling-only / test-only AND touches no §4 surface AND introduces no new operative semantics (pipeline-governance-contract §5, lines 108-127).

### What Claude Code MAY do under explicit operator authorization in a later mutation card

The following actions are **never autonomous**. They require an operator-authorized card that names the exact mutation, the exact target, and exact verification + audit steps. Claude Code may perform them when the operator says "go" inside such a card:

- Flip `semantic_referee_runtime_config.provider_mode` (e.g., the 2026-06-03 mcp flip already done).
- Arm or disarm `CLASSIFIER_QUEUE_ROUTING_ENABLED` (currently `false`; digest `fcbcf165…`).
- Change `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` (currently `0`; digest `5feceb66…`).
- Run a read-only SQL audit against pre-launch prod synthetic (e.g., the 6 staged Phase-7 queries).
- Run a one-shot Edge invocation against an explicitly named runTag-scoped argument-id list (e.g., the classifier HTTP endpoint with N=10 per call).
- Trigger an Edge Function deploy (`npx supabase functions deploy …`) when the operator explicitly authorizes.
- Apply a migration (`npx supabase db push --linked`) when the operator explicitly authorizes — though merge-to-main auto-applies, so this is usually a side-effect of merging a `supabase/migrations/**` PR.

### What is NEVER autonomous (operator-gated regardless of card framing)

- **Merge-as-deploy** of any PR that changes `supabase/functions/**` or `supabase/migrations/**`. Per §5, those PRs auto-apply on merge; the merge button is the operator's. Claude Code never clicks it on those PRs.
- **Family-registry production flip** for H, I, or J (`productionEnabled: true`). This is §4-T bar-lowering territory and the H-I-J roadmap §7 HARD RULE binds: "No file in this card enables any family. No doc, audit, or roadmap auto-advances a family to production. The percentage dial and the family dial are separate. One family at a time. Failure rolls back."
- **Routing percentage advancement** (1% → 5% → ...). Stage 1 closed at PLUMBING / INSUFFICIENT-ORGANIC-VOLUME (PR #431); ramp advancement is a launch-time decision separate from any card here.
- **Provider spend authorization** beyond the operator's standing budget for bot fixture runs. CORPUS-30 used ~23 Anthropic calls; future cards that propose larger budgets require explicit authorization.
- **Secret arming** (XAI / Anthropic / RESEND / MCP shared bearer). Even rotating a secret is an operator action.
- **Editing an applied migration.** Append-only; new migration always.
- **Disabling RLS.** Not even temporarily.
- **Self-approving the same gate that the agent's prior work crossed** (a single agent never approves both GATE B and GATE C on the same card).

### Backlog creation itself performed NONE of the above

This card created 13 GitHub issues, commented on 1, and wrote 2 docs files. No runtime mutation. No classifier trigger. No queue arm. No H/I/J enablement. No `public.arguments` touch.

---

## 5. Per-card design source map (where the depth lives)

Each GitHub issue body is paste-ready with the standard sections (Problem, Scope, Non-scope, Acceptance, Test plan, Governance gates, Dependencies, Blockers, Doctrine compliance, file:line citations). For the cards that overlap with the predecessor doc `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md`, the predecessor's per-card section is the **deeper design source** and operators may treat it as the reference document at DESIGN phase. Both docs cite the same governance contract and doctrine skills, so divergences should not arise; if they do, file an issue under `area:docs` + `doctrine-risk`.

| This sprint's code | Predecessor doc card | Notes |
|---|---|---|
| `ADMIN-MCP-001` | [§ Card ADMIN-MCP-001 — Full write-path audit](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-admin-mcp-001--full-write-path-audit-for-cd---mcp-server-seven-layers--end-to-end-smoke) | Predecessor framed as 7-layer audit + smoke. This sprint framed as close-out (Phase 0 verdict already_shipped per #460/d7aa3a5). Operator decision: if the 7-layer audit is wanted, the predecessor card supersedes this close-out. |
| `ADMIN-ARGUMENTS-001` | [§ Card ADMIN-ARGS-CANONICAL-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-admin-args-canonical-001--canonical-argument-artifact-view-model--dedupe-across-every-argument-list-surface) | Predecessor name has `ARGS-CANONICAL`; same scope. |
| `ADMIN-ARGUMENTS-002` | [§ Card ADMIN-ARGS-INACTIVE-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-admin-args-inactive-001--reversible-inactive-visibility-state-for-whole-arguments-admin-initiated-audited-never-a-hard-delete) | Predecessor name has `ARGS-INACTIVE`; same scope. |
| `ADMIN-ARGUMENTS-003` | [§ Card ADMIN-ARGS-USABILITY-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-admin-args-usability-001--admin-arguments-list-usability-pass-density-columns-filters-row-actions-runtag) | Predecessor name has `ARGS-USABILITY`; same scope. |
| `PHASE7-OBSERVATION-001` | [§ Card CORPUS-30-PHASE7-OBSERVATION-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-corpus-30-phase7-observation-001--author--run-the-ag-classifier-coverage-sql-pack-scoped-to-the-corpus-30-debate-set) | Predecessor authors the SQL pack; this sprint **already staged** the SQL pack at `scripts/corpus-30-phase-7-sql/` (bundled into this commit). Issue #465 references the staged path directly. |
| `CORPUS-30-RESULTS-001` | [§ Card CORPUS-30-RESULTS-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-corpus-30-results-001--corpus-result-analysis-report--executive-verdict) | Identical card code. |
| `CORPUS-30-QUALITY-001` | [§ Card CORPUS-30-QUALITY-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-corpus-30-quality-001--reduce-deterministic-fallback-dominance-fix-samey-move-green-on-empty-defect) | Identical card code. |
| `CORPUS-30-DIVERSITY-001` | [§ Card CORPUS-30-DIVERSITY-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-corpus-30-diversity-001--voice-diversity-tuning-per-room-role-identity-spine-saturation-diagnosis) | Identical card code. |
| `OPS-MCP-OBSERVABILITY-002` | [§ Card OPS-MCP-HEALTH-002](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-ops-mcp-health-002--admin-classifier-health-panel-consumes-failure_detail-jsonb) | Predecessor name `HEALTH-002`. Same panel; same scope. |
| `MCP-HIJ-000` | [§ Card MCP-HIJ-LEDGER-000](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-mcp-hij-ledger-000--hij-readiness-ledger-no-implementation-no-enablement-must-land-before-any-scoping-card) | Predecessor name `LEDGER-000`. Same advancement-neutral ledger. |
| `MCP-H-001` | [§ Card MCP-H-SCOPE-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-mcp-h-scope-001--family-h-scoping--smoke-plan-design-only) | Predecessor name `H-SCOPE-001`. Same Stage-2 scoping. |
| `MCP-I-001` | [§ Card MCP-I-SCOPE-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-mcp-i-scope-001--family-i-thread_topology-scoping) | Predecessor name `I-SCOPE-001`. Same DESIGN-only scoping. |
| `MCP-J-001` | [§ Card MCP-J-SCOPE-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-mcp-j-scope-001--family-j-sensitive_composer-scoping) | Predecessor name `J-SCOPE-001`. Same composer-only scoping-extension. |
| `CORPUS-30-BACKLOG-001` | [§ Card CORPUS-30-REVIEW-001](SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md#card-corpus-30-review-001--human-review-board-for-the-30-debates-ux-feedback-workflow) | Predecessor name `REVIEW-001`. Same human review board. |
| `ADMIN-RUNTIME-GATES-001` | *(no predecessor equivalent)* | NEW card; no predecessor design source. Designer authors the design doc per the GATE A artifact contract. |

**No predecessor equivalent** for `ADMIN-RUNTIME-GATES-001`. Designer should treat the issue body as authoritative and ratify via GATE A before any IMPLEMENT begins.

---

## 6. Phase 7 SQL pack — already staged, ready for read-only execution

The 6 read-only queries + README that `PHASE7-OBSERVATION-001` consumes are pre-staged under `scripts/corpus-30-phase-7-sql/`. Operator picks the execution channel (Supabase Studio paste / psql / Claude MCP OAuth). Boundaries (also encoded in the README):

- Read-only. No `INSERT`, `UPDATE`, or `DELETE` on `public.arguments`, `public.debates`, `public.argument_machine_observation_runs`, `public.argument_machine_observation_results`.
- No re-trigger of the classifier (the HTTP endpoint has no idempotency pre-check; would write duplicate runs).
- No queue routing arm.
- No H/I/J touch (production-disabled in `familyRegistry.ts:104-118`; queries are scoped to A–G).
- runTag-scoped via `WHERE d.title LIKE '%corpus-prod-synthetic-20260603-1924-d49e04cd%'` (the runTag has no first-class column; debate title join is the scoping mechanism).

Files: `01-universe.sql`, `02-coverage-matrix.sql`, `03-failure-reason-breakdown.sql`, `04-positive-observation-density.sql`, `05-failure-detail-forensics.sql`, `06-per-argument-gap.sql`, `README.md`.

---

## 7. Phase 0 fact bundle (source of truth for the issue bodies)

The 73KB structured fact bundle that Phase 0 produced is preserved in the workflow journal. Every card body in this sprint cites Phase 0 fact keys + file:line anchors. Investigators:

1. `governance-and-corpus-state` — 23 findings (governance contract, CORPUS-30 docs, runTag validation, samey-move bug, no-censorship policy, branch reality).
2. `admin-mcp-and-runtime-state` — 13 findings (PR #460 / `d7aa3a5` verdict: already_shipped on every layer).
3. `admin-arguments-and-archive-surfaces` — 13 findings (AdminArgumentsTab loader contract, soft-delete pattern, no archive on `public.arguments`).
4. `mcp-hij-and-family-registry` — 18 findings (registry state, H Card 3 #405 + revert #408, I mixed-source, J ratified N=0).
5. `github-issue-dedup` — 15 findings (per-card dedup verdicts).
6. `corpus-30-jsonl-and-report-quality` — 15 findings (samey-move structural degeneracy, Anthropic 23/240 not 23/300, voice 5..12 band mismatch).

Critique flagged 7 missing-facts and 15 doctrine/governance risks — all surfaced into individual card bodies as `Blockers` + `Doctrine compliance` items.

---

## 8. Doctrine + governance assertions for the whole sprint

- **§1 no truth labels** — no card body contains the 10 forbidden verdict tokens except inside `## Doctrine compliance` sections explicitly listing the prohibition. Verified by the Workflow 2 cross-card validator + inline bash scan (76 hits, all in doctrine-listing sections).
- **§3 popularity is not evidence / anti-amplification** — no card proposes engagement-as-evidence remediation. The no-censorship operator policy is preserved verbatim where relevant (`CORPUS-30-RESULTS-001`, `-QUALITY-001`, `-DIVERSITY-001`, `-BACKLOG-001`).
- **§4 forbidden self-approval** — every card with `requiresOperatorGateC: true` explicitly states the operator-only merge boundary. Family-registry flip is named as §4-T bar-lowering territory in every H/I/J card.
- **§5 engine.ts sacred** — zero cards propose `src/lib/constitution/engine.ts` changes.
- **§6 secrets** — zero cards surface raw secret values. `ADMIN-RUNTIME-GATES-001` explicitly mandates digest-only display.
- **§7 no AI from production app** — `CORPUS-30-QUALITY-001` and `-DIVERSITY-001` are confined to `scripts/bot-fixtures/`; no pure-TS port to `src/` proposed.
- **§8 soft-delete only + append-only migrations + RLS always on** — `ADMIN-ARGUMENTS-002` is the only card touching migrations and is explicitly append-only + RLS-enabled at creation.
- **§9 plain-language mapping** — every card introducing new internal codes (failure_detail values, runTag, voiceId, spineId, validation reason codes, inactive transition codes) requires `gameCopy.toPlainLanguage` entries + ban-list test coverage.
- **§10a Observations vs Allegations** — Family J cards explicitly preserve composer-only disposition. `OPS-MCP-OBSERVABILITY-002` renders every classifier row as Observation (machine source), never Allegation.

---

## 9. Confirmation of "no runtime mutation, no classifier trigger, no queue arm, no H/I/J enablement"

This card performed:

- ✅ 13 `gh issue create` calls (filed #462–#474).
- ✅ 1 `gh issue comment` call (commented on #394 with the canonical `MCP-I-001` scoping body).
- ✅ 15 `gh label create` calls (idempotent; created 15 sprint-relevant labels).
- ✅ Wrote `docs/designs/SPRINT-CORPUS30-ADMIN-HIJ-BACKLOG.md` (this doc).
- ✅ Bundled the pre-existing `scripts/corpus-30-phase-7-sql/` (6 SQL files + README) into the commit for traceability.

This card did NOT:

- ❌ Mutate `semantic_referee_runtime_config` or any other runtime config row.
- ❌ Arm `CLASSIFIER_QUEUE_ROUTING_ENABLED` or change the percentage.
- ❌ Trigger the `classify-argument-boolean-observations` Edge Function (or any other classifier path).
- ❌ Flip `productionEnabled` for H, I, or J (or any other family).
- ❌ Touch `public.arguments`, `public.debates`, `public.argument_machine_observation_runs`, or `public.argument_machine_observation_results` (no SELECT, INSERT, UPDATE, or DELETE).
- ❌ Apply a migration or deploy an Edge Function.
- ❌ Read or rotate any secret.
- ❌ Modify `familyRegistry.ts` or any other §4 surface.

---

## 10. Final response summary (for the operator)

- **Sprint doc path:** `docs/designs/SPRINT-CORPUS30-ADMIN-HIJ-BACKLOG.md` (this file).
- **Predecessor doc:** `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md` (commit `c680ae0`; deeper per-card design source; this doc cross-references it).
- **Issues created (13):** #462, #463, #464, #465, #466, #467, #468, #469, #470, #471, #472, #473, #474.
- **Issues updated (1):** #394 (commented with canonical `MCP-I-001` scoping body).
- **Issues intentionally NOT created (1):** `ADMIN-MCP-001` — Phase 0 verdict already_shipped via PR #460 / `d7aa3a5`. Documented as close-out in this doc (§ Wave 0).
- **SQL pack pre-staged:** `scripts/corpus-30-phase-7-sql/` (6 read-only files + README) for `PHASE7-OBSERVATION-001` (#465).
- **Dependency graph:** valid DAG, no cycles, no priority inversions (validated by Workflow 2 cross-card validator).
- **Blockers requiring operator decision:** see each issue's `## Blockers` section. Highlights: (a) `ADMIN-ARGUMENTS-001` option (UI vs migration vs view); (b) `ADMIN-ARGUMENTS-002` option (new column vs reuse `hidden`); (c) `ADMIN-RUNTIME-GATES-001` panel vs runbook; (d) `OPS-MCP-OBSERVABILITY-002` tab vs extension vs CLI; (e) `MCP-H-001` operator confirmation of P1 organic Stage-1 precondition status (currently NOT satisfied; PR #431 PLUMBING close did not meet E#7 condition c); (f) `MCP-I-001` operator decision whether to keep `update_existing` (#394) or close-and-refile; (g) `MCP-J-001` operator confirmation that the scoping-extension framing is acceptable given ratified N=0 in closed #398 / PR #406.
- **Operator-only gates carried by this sprint:** `ADMIN-ARGUMENTS-002` (migration + Edge deploy + GATE C), `ADMIN-ARGUMENTS-003` (Edge deploy + GATE C), `OPS-MCP-OBSERVABILITY-002` (Edge deploy + GATE C), `MCP-J-001` (GATE C on the scoping doc), `ADMIN-RUNTIME-GATES-001` (GATE C on the design doc). All future family-registry flips remain §4 forbidden self-approval — no auto-merge ever.
- **Confirmation:** no runtime mutation, no classifier trigger, no queue arm, no H/I/J enablement.
