# CDiscourse CC Orchestration Pattern

**Status:** living document. Update when new auth surfaces become available, new gap patterns are observed, or new stage shapes emerge.
**Audience:** anyone (human or CC) drafting a prompt that involves subagent fan-out, long pipelines, or multi-system runtime operations.
**Why this exists:** the outer phase structure (preflight → write → verify → converge) has been working across ARCH-001 cards. The breakage has been at the inner subagent-spawn boundary — orchestrator prompts haven't been telling each agent what auth context to use, so they fall back to defaults (interactive `supabase login`, anon-key reads against RLS-protected tables, psql binary lookup) that don't work in this environment. The main turn ends up filling 4–6 gaps per workflow. This doc gives the inner template that closes that gap.

## 1. The core shape
```
Main turn:     production writes, gates, secret handling, sequential setup
↓
Subagents:     read-only verification, independent checks, adversarial probes (parallel fan-out)
↓
Main turn:     collect reports, fill gaps subagents couldn't handle, converge to verdict
↓
Main turn:     closeout (audit doc, status update, disable flags)
```

Sequential is for anything that writes, holds a secret, or depends on a prior step's output. Parallel is for anything read-only and independent.

## 2. Stage-by-stage parallelism map

| Stage | Sequential (main turn) | Parallel (subagent fan-out) |
|---|---|---|
| Design (intent brief) | Draft | — |
| Implementation | Write code + tests | After write: typecheck, lint, jest, audit-lint, secret scan, doctrine scan (all parallel) |
| Review | — | Per-file readers + scan agents + adversarial refuters |
| PR open + merge | `gh pr merge` | — |
| Runtime setup | Secret writes, env vars, cron schedules | Pre-write discovery: state checks, by-name presence, CLI verifiability |
| Smoke preflight | — | 8 parallel state checks |
| Smoke canary | 1 submit | 7 parallel post-submit verifications + doctrine + RPM |
| Smoke burst | N sequential submits | 8 parallel post-burst verifications + doctrine + RPM |
| Smoke adversarial | — | 8 parallel refutation agents trying to break PASS |
| Audit + closeout | Audit doc + commit + PR | — |

## 3. Outer prompt skeleton

Use this verbatim as the wrapper for any phase. Fill in CONTEXT / APPROVED WRITES / CONSTRAINTS / VERDICT RULES for the specific phase.
```
ULTRACODE+ — [CARD-ID] [PHASE-NAME]
ORCHESTRATION

Production writes: sequential, main agent turn only.
Read-only verification: parallel subagent fan-out, converge in main turn.
Boundary: never print secret values, JWTs, headers, env values, prompt text,
argument bodies, raw provider payloads.

CONTEXT (current state)

Branch: [main | fix/...]
HEAD: [SHA]
Cards landed: [list]
Routing flag: [enabled | disabled]
Cron: [active | inactive]
MCP cap: [confirmed value]
[other gate items]

APPROVED PRODUCTION WRITES (this phase only)

[explicit list — nothing not listed]

HARD CONSTRAINTS

[explicit list — what NOT to touch]
Throwaways under .claude-tmp/, never committed.

PHASE [N] — [name]
[Specific instructions; subagent fan-out spec uses template §4]
VERDICT RULES
[Explicit convergence: PASS if X, PARTIAL if Y, FAIL if Z]
CLOSEOUT
[Audit doc shape, status update, flag disablement]
```

## 4. Inner subagent prompt template

This is where deviation has been. Every Task() or Workflow()-spawned subagent prompt MUST include all of these sections, in order. Do not assume the subagent inherits the main turn's tool knowledge or auth context.
```
ROLE: [one-line — what this subagent does]
AUTH SURFACES AVAILABLE

DB reads (BYPASSES RLS): npx supabase db query --linked --file <path>

Returns JSON array of rows.
--file returns ONLY the LAST statement's rows; use UNION ALL when querying
multiple things in one file.


gh CLI: authenticated via existing local token (read PRs, issues, comments).
Management API: npx supabase secrets set|list ... ONLY when
SUPABASE_ACCESS_TOKEN is loaded from .claude-tmp/supabase-management.env
(currently [VALID | INVALID — must report as INCONCLUSIVE]).
Read-only HTTP probes: curl with explicit headers.
Filesystem read (cat, head, tail, find, ls, grep).
git read (log, diff, status, show, branch).

AUTH SURFACES NOT AVAILABLE

Interactive supabase login (no TTY in subagent context).
psql binary (not installed on this machine).
Anon-key reads for RLS-protected tables (will return [] silently OR
permission error — never the actual rows).
Browser-based OAuth.
Any auth requiring user interaction.

TASK
[specific check or probe — be precise about which query, which table, which window]
TIME WINDOW (for audit/log queries)

Default to 30–60 minutes back, NOT 5 min — late-arriving rows are common.
Always sort DESC LIMIT N rather than relying on time predicate alone.

ON SUCCESS
[exact output format expected — usually JSON with status + evidence]
ON FAILURE / INCONCLUSIVE

DO NOT retry with different auth patterns.
DO NOT attempt interactive auth.
DO NOT make up plausible-looking output.
Report: {status: 'INCONCLUSIVE', reason: '<error class>', evidence: '<exact error>'}
Main thread will fill the gap from its own auth context.

BOUNDARY

Read-only (no INSERT/UPDATE/DELETE/DDL — even temp tables).
Never print secret values, JWTs, headers, env values, prompt text, argument
bodies, raw provider payloads, or response bodies.
Throwaways under .claude-tmp/ only; never committed.

OUTPUT FORMAT
{status: 'OK' | 'FAIL' | 'INCONCLUSIVE', evidence: [...], gaps: [...]}
```

## 4a. Project-specific delegation mapping (CDiscourse)

The runbook §4 inner template gives a generic "ROLE" line. In this repo, the role often maps to one of three project-specific subagents under `.claude/agents/`. The generic §4 fan-out then runs **around** the subagent's sequential phase — as preflight before delegation, or as adversarial verification of the subagent's verdict.

### Subagents (under `.claude/agents/`)

- **roadmap-designer** — design-only phase. Use BEFORE any implementation, on every new roadmap card. Reads the card's intent brief + the upstream spec; writes `docs/designs/<code>.md` describing data model, file changes, edge cases, test plan, risks. Does NOT write production code.
- **roadmap-implementer** — implementation phase. Use AFTER a design exists. Creates a worktree on `feat/<code>-<slug>`, follows the design's file-change list, slice commits per OPS-004 recovery cadence (multi-commit slices so a recoverable mid-implementation state survives). Updates `docs/core/current-status.md` on completion.
- **roadmap-reviewer** — review phase. Use AFTER implementation is committed. Reads the diff, the design doc, and the relevant skills; writes `docs/reviews/<code>.md` with APPROVE / CHANGES-REQUESTED / BLOCK. Carries a HARD migration-bearing-card gate (the QOL-041 / PR-003 / PR-004 / function/trigger/extension precedent — see `.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification (mandatory)").

### Skills (under `.claude/skills/`)

Skill invocations happen via the `Skill` tool and load the skill's content into context.

**Universal — invoke in every code-touching session:**
- `cdiscourse-doctrine` — the 10 non-negotiable rules (no verdicts, no truth labels, AI moderator hard limits, secrets policy, RLS, v1 scope guards). Read FIRST.
- `test-discipline` — where tests live, what counts as required coverage, how to verify "done" (typecheck + lint + test all exit 0).

**Epic-specific — invoke when the card touches the named surface:**
- `supabase-edge-contract` — Edge Functions, RLS, migrations, storage. Auth/JWT patterns. The no-service-role-in-client rule.
- `expo-rn-patterns` — Expo + React Native UI cards (most of Epics 1, 2, 4, 5, 7, 8, 9, 11).
- `evidence-doctrine` — Epic 6 Evidence cards + Epic 11 Gallery source-trail buckets + Epic 12 Rules UX.
- `point-standing-economy` — Epic 7 Strength/Weakness, Epic 6 evidence scoring, anything touching `argumentScoreModel` or standing bands.
- `timeline-grammar` — Epic 2 Visual Grammar, Epic 3 Branches, Epic 7 Strength/Weakness, argument node rendering and branch lanes.
- `accessibility-targets` — any visible-UI card; especially IX-003 (keyboard/a11y nav).
- `transcript-lang-min` — when transcript language is in scope.

**Manual-only — operator-spawned tools, NEVER model-invoked:**
- `bot-provocateur`, `bot-revocateur`, `argument-counter-runner`, `argument-fixture-author`, `storyline-narrative-officer`, `diagnostic-inspect-package-operator`. These carry `disable-model-invocation: true` in their frontmatter; the model treats them as operator-only.

### Standard preflight (every session, before any work)

```
npm run checkpoint
npm run skills:validate
git status -sb          # must be clean (tracked); pre-existing untracked is fine
npm run typecheck && npm run lint && npm run test
```

Any non-zero exit halts before work begins. Pre-existing untracked operator-territory files (`.tmp/`, prior smoke artifacts, etc.) are noise, not blockers.

### The composition pattern (proven in ARCH-001 Card 3)

Generic §4 fan-out + project subagent + adversarial verification is the canonical structure for non-trivial cards:

1. **Preflight** — main turn runs the standard preflight battery and Phase A read-only fan-out (file existence, source citations, current-state DB confirms).
2. **Delegate** — invoke the appropriate roadmap-* subagent for the phase.
3. **Verify** — generic §4 Explore agents in parallel (typecheck, lint, jest, secret scan, doctrine scan, diff scope, invariant preservation, test quality, etc.) confirm the subagent's claimed work.
4. **Adversarially refute** — 2–8 additional Explore agents try to FAIL the subagent's verdict. Each starts from "assume the subagent is wrong; find evidence." Catches non-blocking doc-drift, off-by-one, edge-case misses.
5. **Resolve + STOP** — main turn applies §5 convergence rules to the fan-out, then opens the PR and stops at the operator merge gate (CC never auto-merges unless the operator has authorized the merge in the same turn).

Card 3's example: roadmap-implementer wrote the implementation + tests; Phase C 8 Explore agents verified diff scope + invariants + secrets + doctrine + test quality + no drift; roadmap-reviewer wrote `docs/reviews/ARCH-001-CARD3-TUNING-AND-ROLLOUT.md` with APPROVE; 3 adversarial Explore agents tried to refute (Adv 1 found a stale doc comment — non-blocking, fixed in a follow-up commit; Adv 2 and 3 found no refutation). REVIEW_PASS → PR open → operator merge.

### Composition gotchas (banked from this run)

- **Subagents may commit to whichever branch they're on.** If you don't `git checkout -b` before invoking the implementer, it may commit to `main`. Verify the branch before invocation.
- **Subagents inherit the main turn's CWD but not its branch state knowledge.** Re-state the branch + HEAD SHA in every subagent prompt.
- **Skill invocations don't persist across subagent invocations.** The main turn invokes; each subagent re-invokes the skills it needs.
- **Manual-only skills (`disable-model-invocation: true`) must never be invoked by the model.** The skill loader enforces this; the model should not even try.

## 5. Convergence rules — must be explicit per phase

Every verification phase needs an explicit rule the main turn applies to converge subagent results. Examples observed in Card 2:

**Cron equality (7 agents)**
- VERIFIED: A=1 row AND (B has completed/0-jobs audit row OR C shows recent 2xx from drainer URL)
- MISMATCH: A=1 row AND C shows 401/4xx AND B has no audit row
- INCONCLUSIVE: anything else

**Canary verification (7 agents + doctrine + RPM)**
- CANARY_PASS: all 9 checks OK
- CANARY_FAIL: any non-recoverable hole

**Burst verification (8 agents + doctrine + RPM + adversarial)**
- BURST_PASS: 100% coverage with no holes
- BURST_PARTIAL: dead-letters bounded + classified correctly (the C-calibration signal)
- BURST_FAIL: terminal holes, double-success, secret leakage, submit blocking

**Adversarial (8 refutation agents)**
- PASS holds only if no refutation survives. Each agent independently tries to find counter-evidence to the PASS claim.

## 6. Common subagent gaps + main-thread fills

This is the playbook for when convergence shows gaps. The main turn fills using its own auth surfaces.

| Gap symptom | Cause | Main-thread fill |
|---|---|---|
| "could not read [RLS-protected table]" | Subagent used anon key | `npx supabase db query --linked --file <UNION query>` |
| "JWT could not be decoded" or "no auth context" | Subagent fell back to interactive OAuth | Re-query via `db query --linked` |
| "could not list Function secrets" | Subagent lacks PAT env | Load `.claude-tmp/supabase-management.env` in main shell (`set -a; . .claude-tmp/supabase-management.env; set +a`), retry |
| "db query --file returned only N rows when expecting M" | Multi-statement output truncation | Rewrite as single statement with UNION ALL |
| "no rows in 5-min window" | Audit window too narrow | Widen to 30–60 min, sort DESC LIMIT N |
| "psql: command not found" | Subagent tried psql binary | Use `db query --linked` instead |
| "interactive login required" | Subagent has no TTY | Report INCONCLUSIVE; main turn uses non-interactive path |
| "Edge Function logs not accessible" | No CLI access to Function logs | Use `classifier_drain_audit` + `net._http_response` as visible signal proxy |

## 7. Anti-patterns (the deviation set)

These are the specific patterns observed degrading workflow quality. Avoid each:

- ❌ Spawning a subagent without specifying AUTH SURFACES AVAILABLE / NOT AVAILABLE
- ❌ Sequential reads when fan-out works (read calls are cheap; sequence them only when later depends on earlier)
- ❌ Multi-statement `db query --file` (returns only the last statement's rows — silent data loss)
- ❌ Hard-coded 5-min audit windows (audit rows can be 10–30+ min old; widen)
- ❌ Production writes from subagents (only main turn writes; subagents are read-only)
- ❌ Subagents printing secret values "for verification" (verification is by hash/length/presence, never value)
- ❌ Subagent retry loops on auth failure (fail-fast → INCONCLUSIVE → main turn fills)
- ❌ Workflow prompt without per-agent prompts that include AUTH SURFACES sections (relies on default subagent behavior, which won't match this environment)
- ❌ Trusting subagent output that says "no rows found" without main-turn confirmation when the table is RLS-protected (anon-key reads return [] silently for RLS-blocked queries)
- ❌ "Improving" or paraphrasing file content provided verbatim in a prompt (the content IS the artifact)
- ❌ Parity-only structural checks where you need exact-count checks (e.g. "fence count must be even" passes on 0 fences when 6 are expected — verification check must be "count equals expected N", not "count is even")
- ❌ Embedding file-content artifacts inside outer triple-backtick code blocks in chat prompts without an escape mechanism (inner fences collide with outer; use heredoc with a single-quoted distinctive sentinel like CCORCHEND, or distinct text delimiters like ═══BEGIN FILE═══ … ═══END FILE═══)

## 8. How to apply going forward

Before drafting any prompt that involves subagent fan-out:

1. Read this doc (or have CC read it as the first step of any pipeline prompt).
2. Use the outer skeleton (§3) verbatim, fill in CONTEXT + CONSTRAINTS + APPROVED WRITES for the specific phase.
3. For each Workflow()/Task() spawn, use the inner template (§4) verbatim. Do not skip the AUTH SURFACES sections, even if they feel redundant — the subagent does NOT know the environment.
4. For each verification phase, write the convergence rule (§5) explicitly before the agents run, so the main turn knows what to compare against.
5. After convergence, if any agent reported INCONCLUSIVE, fill from §6's playbook before declaring final verdict.
6. Audit the result against §7's anti-patterns. If any apply, restructure before continuing.

The one-line opener for future pipeline prompts:

> Read docs/runbooks/cc-orchestration-pattern.md (or wherever this doc lives) before any subagent spawn in this phase. Use the inner template (§4) verbatim for every Workflow()/Task() call. Apply §5 convergence rules. Fill gaps per §6.
