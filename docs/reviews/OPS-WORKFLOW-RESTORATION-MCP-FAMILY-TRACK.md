# OPS-WORKFLOW-RESTORATION-MCP-FAMILY-TRACK — Review (Phase 4 + 5 completion)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Branch:** docs/OPS-WORKFLOW-RESTORATION-phase4-5-completion
**Card type:** DOCS-ONLY card mode. The substantive body of the workflow restoration card already merged via PR #387 (`10fa96e`); this follow-up backfills the 10 GitHub issue numbers (#388–#398) into the Trail lines and board doc that Phase 4 originally deferred.

## Summary

The branch carries one commit (`3d8f591`) that replaces `[OPERATOR DECISION NEEDED]` and `#TBD` placeholders in 10 intent briefs + the board doc with the umbrella issue (#388) and the 10 sequential card issues (#389–#398). The diff footprint is exactly 11 files / +20 / -20 — surgical, scope-pure, no incidental edits. The substantive surface (the 10 briefs themselves, runbook §4a, board doc Epic 12 acknowledgment) is already on main and was reviewed against the 9-section structural requirement, doctrine, parallel-structure invariants, and the §4a-to-`.claude/` reality match. All gates pass.

## Verification

| Gate | Result |
|---|---|
| typecheck (`npm run typecheck`) | exit 0 |
| lint (`npm run lint`) | exit 0 |
| test (`npm run test`) | exit 0 — **18713 / 18713 tests, 592 / 592 suites** |
| secret scan (`ANTHROPIC_API_KEY` / `SERVICE_ROLE` / `Bearer` / JWT / email shapes) | clean — exit 1 (no match) |
| service-role / API-key scan on diff | clean — exit 1 (no match) |
| direct `public.arguments` insert scan | clean — exit 1 (no match) |
| doctrine verdict-language scan | clean — the only matches are `productionEnabled: false → true` boolean code references in docs (no truth-verdict labels about a person, claim, or post) |
| Migration apply | N/A — no migration in this card; documented absence |
| 10 GitHub issues exist on main repo (#388–#398) | all 10 confirmed via `gh issue view` — all `OPEN`, titles match brief subjects |
| Trail-line HALT 4 self-check | clean — zero `[OPERATOR DECISION NEEDED]` markers remain on Trail lines across all 10 briefs |
| `[OPERATOR DECISION NEEDED]` total | **39** (matches prompt expectation) — H Card 1: 10, audit-lint H: 4, edge-enable H: 2, I Card 1: 12, audit-lint I: 1, edge-enable I: 2, observability G: 3, observability H: 2, observability I: 2, J scoping: 1 |

## Design conformance (DOCS-ONLY card mode — substantive surface on main)

### Intent-brief structural check (9 required sections per workflow card prompt)

| Brief | Sections | 9-section coverage |
|---|---|---|
| MCP-SERVER-009-FAMILY-H (Card 1) | 10 (Goal / Phase 0 / Doctrine / Autonomy / Binding decisions / Test forecast / HALT triggers / Hard guardrails / Process / Post-merge smoke) | Full — header + 9 substantive sections; doctrine + autonomy carved out as separate sections |
| OPS-MCP-AUDIT-LINT-RULES-FAMILY-H (Card 2) | 8 (Goal / Scope IN-OUT / Binding decisions / Test forecast / HALT triggers / Hard guardrails / Process / Post-merge smoke) | Full — "why" is folded into Goal + Suite header; lighter doctrine/autonomy treatment because card is DATA-only |
| MCP-021C-EDGE-FAMILY-H-ENABLE (Card 3) | 8 | Full — ditto |
| MCP-SERVER-010-FAMILY-I (Card 1) | 10 | Full — mirrors H Card 1 structure with mixed-source-specific differences |
| OPS-MCP-AUDIT-LINT-RULES-FAMILY-I (Card 2) | 8 | Full — explicitly CONDITIONAL per A.1 verdict; mirrors H audit-lint card |
| MCP-021C-EDGE-FAMILY-I-ENABLE (Card 3) | 8 | Full — mirrors H Card 3 with HALT-13 INVERSE for mixed-source |
| OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE | 6 | Adequate — small observability backfill; scope/decisions/HALTs/process/status; no test forecast or post-merge smoke section because the card has no post-merge phase distinct from PR merge |
| OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE | 6 | Adequate — same shape |
| OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE | 6 | Adequate — same shape with mixed-source note |
| OPS-FAMILY-J-SCOPING-AUDIT | 8 (Goal / Scope / Binding decisions / HALT triggers / Hard guardrails / Process / Expected conclusion / Post-merge) | Adequate — explicitly "DIFFERENT SHAPE" (audit-only); deliverable IS an audit doc, not code |

The lighter 6-section briefs (observability backfill x3) fold "why" into Goal and "scope OUT" into Scope IN/OUT, and omit smoke phases because the cards have no smoke distinct from PR merge. This is appropriate for the card type and is consistent with prior observability backfill precedents (Family D observability card).

### Cross-brief invariants

- [x] H Card 1 / Card 2 / Card 3 HALT trigger structure parallels Family G's precedent (H Card 1 carries 20 HALTs vs G's ~20; H Card 3 mirrors G-enable card structure with HALTs 12-15)
- [x] I Card 1 / Card 2 / Card 3 HALT trigger structure parallels D's mixed-source pattern + G's structure (I Card 1 inherits H's HALT list with HALT 14 added for mixed-source subset filter; I Card 3 inverts HALT 13 — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block STAYS PRESENT for mixed-source I)
- [x] All 3 observability briefs reference `scripts/ops/sql/` (G + H explicit; I says "SQL files" generically and points at D / G / H precedents which carry the exact path)
- [x] All cards reference runbook structural concepts (Stage 2B, roadmap-* subagents, HALT N triggers, OPS-004 cadence) — vocabulary inherited from §4 + §4a even when not citing the runbook by file path. This is appropriate for intent briefs (designer will explicitly cite the runbook in `docs/designs/<code>.md` outputs)

### Runbook §4a accuracy check

§4a (lines 133–192 of `docs/deployment/cc-orchestration-pattern-runbook.md`) names:

- **3 subagents:** `roadmap-designer`, `roadmap-implementer`, `roadmap-reviewer` — verified present at `.claude/agents/roadmap-{designer,implementer,reviewer}.md`
- **9 skills:** `cdiscourse-doctrine`, `test-discipline` (universal); `supabase-edge-contract`, `expo-rn-patterns`, `evidence-doctrine`, `point-standing-economy`, `timeline-grammar`, `accessibility-targets`, `transcript-lang-min` (epic-specific) — all 9 verified present under `.claude/skills/`
- **6 manual-only skills:** `bot-provocateur`, `bot-revocateur`, `argument-counter-runner`, `argument-fixture-author`, `storyline-narrative-officer`, `diagnostic-inspect-package-operator` — all 6 verified present AND all 6 carry `disable-model-invocation: true` in frontmatter

§4a correctly does NOT reference `.claude/agents/agent-charters.md` (which does not exist); the runbook PR-387 body explicitly documented this. §4a accurately mirrors filesystem reality.

### Board doc Epic 12 acknowledgment + 10 new entries

- [x] Epic 12 header at line 494; acknowledgment note at line 496 explicitly declares retroactive issue-backfill OUT OF SCOPE (correct doctrine: forward-looking discipline only)
- [x] All 10 new entries land within Epic 12, each with: Priority / Effort / Release / Wave / Agent / Status / Goal / Acceptance / Tests; all 10 reference their corresponding intent brief; all 10 carry real issue numbers (#389–#398)
- [x] No retroactive backfill of historical MCP/ARCH cards (Family D/E/F/G server cards, MCP-021C edge-enable cards B/C/D/E/F/G, audit-lint L5 rules, ARCH-001 Cards) — appropriately deferred per the acknowledgment note

## Doctrine self-check (all required ✓)

- [x] No truth/winner/loser language in user-facing strings (doctrine scan clean; H Card 1 §3 explicitly enforces DESCRIPTIVE-not-VERDICT framing as the existential concern; brief content actively reinforces no-verdict doctrine)
- [x] Score never blocks posting (not applicable — DOCS-ONLY card)
- [x] No service-role in client code (no client code in diff)
- [x] No direct insert into `public.arguments` (no DB writes in diff)
- [x] No AI calls in production app paths (no production code in diff)
- [x] Plain language only (no raw internal codes in UI strings; briefs are internal documentation appropriately using technical vocabulary `claim_clarity`, `thread_topology`, `family_h`, etc.)
- [x] Epic-specific doctrine — supabase-edge-contract (Edge Function shape preserved across briefs; HALT 5 explicitly protects `supabase/functions/_shared/booleanObservations/familyRegistry.ts` from non-flip edits; HALT 13 protects `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` block from incorrect mixed-source handling)
- [x] §10a Observations vs Allegations doctrine respected — H Card 1 §3 explicitly distinguishes "descriptive formulation-state" (clean Observation surface) from "verdict on truth or speaker-judgment" (forbidden Allegation drift); the entire H 5-layer doctrine defense is engineered to enforce this distinction

## `[OPERATOR DECISION NEEDED]` marker honesty spot-check

Spot-checked 8 markers (random sample across briefs); zero evasions found. Each marker flags a genuine designer/operator surface decision rather than hiding a silent binding choice:

| Marker | Honest? | Why |
|---|---|---|
| H Card 1 D4 `FAMILY_H_MAX_TOKENS = 1500` | Honest | Phrased as "confirm; math: 12 × ~85 ≈ 1020 with 480 headroom" — token-math context provided, designer can refute |
| H Card 1 D5 `FAMILY_H_BAN_PATTERNS` final list | Honest | Provides explicit candidate list; designer A.1 may refine |
| I Card 1 D2 `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` boundary | Honest | "Card 1 may need to add the entry, OR defer to Card 3" — surfaces a real architectural boundary decision |
| I Card 1 §4 doctrine-risk verdict (LOW vs MEDIUM+) | Honest | Drives whether Card 2 ships vs is SKIPPED; binary determination explicit |
| Audit-lint H D1 highest-doctrine-risk classifier key | Honest | "select from Card A design — likely one of `conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`" |
| Audit-lint I D3 fixture provenance | Honest | Conditional on Card A smoke verdict — surfaces real chain-dependency |
| J scoping D1 authorship (CC main-thread vs designer subagent) | Honest | Genuine operator preference call; reasoning explicit |
| Observability G D2 test forecast +20 to +50 | Honest | Range provided; designer produces binding number |

Convention is faithful: markers carry the designer's anticipated answer + reasoning + an honest request for operator/designer confirmation. None hide a silent CC binding choice.

## Test coverage

DOCS-ONLY card; no production code changed in this branch's diff. Tests added to support the substantive surface landed via PR #387 (which I do not re-review here — the prompt explicitly scoped this review to the backfill diff plus structural acceptance of the on-main substantive surface).

The substantive surface on main introduced 10 forward-looking intent briefs that explicitly state per-card test forecasts (e.g., H Card 1: +110 to +160 net Deno + ~8 Jest; observability cards: +20 to +50 Jest). Those test commitments are forward-binding on future implementer work, not retroactive obligations for this card.

## Blockers

None.

## Suggestions (non-blocking)

1. **Observability-I brief could explicitly cite `scripts/ops/sql/` once** in its IN list (line 23) instead of inheriting via "D / G / H precedents". The other two observability briefs cite the path directly; the I brief breaks the pattern by referring generically to "SQL files". Trivial wording polish for future readers; not a substantive defect.

2. **The 39 `[OPERATOR DECISION NEEDED]` markers are concentrated in H/I Card 1 briefs (10 + 12 = 22 / 39 = 56%)**. This is appropriate — those are the deepest design surfaces — but the operator may want to triage them into "must answer before designer starts" vs "designer can produce binding answer from Card 1 Phase A audits" buckets when issue #389 / #392 are spun up. Not a defect of the briefs; a workflow nudge for the upcoming card spin-up.

3. **The runbook §4a manual-only skill list could be sorted alphabetically** for slightly faster operator scan. Currently bullet order appears to be authoring order. Trivial polish.

## Operator next steps

- Push the branch: `git push -u origin docs/OPS-WORKFLOW-RESTORATION-phase4-5-completion`
- Open PR: `gh pr create --title "docs(workflow): backfill umbrella + 10 card issue numbers (#388–#398) into intent briefs + board" --body-file docs/reviews/OPS-WORKFLOW-RESTORATION-MCP-FAMILY-TRACK.md`
- No deploy step (DOCS-ONLY card; no migration, no Edge Function, no production code change)
- Post-merge worktree cleanup not applicable (this branch was authored from the main checkout, not an isolated worktree)
- After merge, the H Card 1 (#389) is unblocked for designer spin-up per the OPS-004 cadence
