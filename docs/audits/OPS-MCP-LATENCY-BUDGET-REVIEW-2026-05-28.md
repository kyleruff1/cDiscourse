# OPS-MCP-LATENCY-BUDGET — Review

**Verdict:** **APPROVE**
**Reviewer agent run:** 2026-05-28
**Branch:** `feat/OPS-MCP-LATENCY-BUDGET`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/351
**Design:** `docs/designs/OPS-MCP-LATENCY-BUDGET.md` (+ intent brief `…-intent.md`, D1–D9)

---

## Summary

A clean MEASURE-AND-CODIFY card. It ships a read-only operator latency report
(`scripts/ops/mcp-latency-report.mjs` + pure `mcp-latency-report-lib.cjs`), two
read-only aggregate SQL files, a budget doc, and two test suites. It codifies a
per-family + total auto-trigger latency budget bound to **one** precisely-defined
clock (`wall_clock_background` p95), with a 30s warning / 45s FAIL two-band
classifier and a projection for 7/8/9/10 families that mechanically answers the
"can Family G ship under sequential dispatch?" question. The diff footprint is
exactly the design's 9-file list — **zero** dispatch change, **zero** registry
change, **zero** `package.json`/audit-lint/`src`/`app`/`mcp-server` change. Every
operator hard gate is satisfied: the observability SQL dir and both observability
test files are byte-equal (0-diff), the latency SQL carries equivalent safety
coverage in its sibling home, the binding clock is `wall_clock_background` (not
sum, not submit), no `out/` artifact is committed, and the report runs read-only
end-to-end (exit 0, no `submit-argument`). The one documented deviation from the
operator's literal preferred path (`scripts/ops/latency-sql/` → sibling
`scripts/ops-latency-sql/`) is **acceptable** — it is the only layout that
satisfies all of the operator's hard gates simultaneously (see ruling below). No
blockers. No doctrine concerns.

---

## Verification

| Gate | Result |
| --- | --- |
| typecheck (`tsc --noEmit`) | **pass** (exit 0) |
| lint (`eslint . --max-warnings 0`) | **pass** (exit 0) |
| jest — latency suites | **pass** — 2 suites / 67 tests (47 budget + 20 SQL safety) |
| jest — observability suites | **pass** — 12 suites / 173 tests (back to 16-file baseline) |
| jest — `opsMcp(Latency\|Observability)` combined | **pass** — 14 suites / 240 tests (exit 0) |
| jest — **full suite** | **pass** — **574 suites / 18,269 tests** (exit 0) |
| read-only report (`--no-write`) | **pass** — runs end-to-end, classifies PARTIAL, exit 0, **no submit-argument** |
| secret scan (diff) | **clean** (only ban-list docstring lines; no literals) |
| doctrine scan (diff) | **clean** (banned tokens appear only inside ban-list assertion arrays / enumerations) |
| direct insert into `public.arguments` | **none** |
| `out/` committed (`git ls-files \| grep '^out/'`) | **0 tracked** |
| staged/modified-tracked after report run | **0** (report mutated nothing) |

> **Note on the migration-bearing-card check:** the two `.sql` files live in
> `scripts/ops-latency-sql/`, **not** `supabase/migrations/`. They are
> operator-CLI read-only query files, not migrations
> (`git diff main..HEAD --name-only -- 'supabase/migrations/**'` is empty). The
> mandatory migration-apply / heightened-textual-review gate therefore does not
> trigger. The latency SQL nonetheless received a full safety scan via
> `__tests__/opsMcpLatencySqlSafety.test.ts` (no DDL, no `select *`, no bare
> body/`evidence_span`, no secrets, terminating `;`, header).

### Independent boundary-diff re-runs (verified; not trusted from the report)

```
git diff main..HEAD -- scripts/ops/sql/                                          -> 0   (obs SQL dir untouched)
git diff main..HEAD -- opsMcpObservabilitySqlSafety + NoServiceRoleNoSecrets     -> 0   (obs tests byte-equal)
git diff main..HEAD -- autoTriggerDispatcher.ts + familyRegistry.ts              -> 0   (no dispatch/registry change)
git diff main..HEAD -- package.json package-lock.json .gitignore                 -> 0
git diff main..HEAD -- audit-lint-rules.cjs audit-lint-lib.cjs audit-lint.mjs    -> 0
ls scripts/ops/sql/ | wc -l                                                      -> 16
ls scripts/ops-latency-sql/                                                      -> 01-…  02-…
git diff main..HEAD --name-only                                                  -> 9 files (exactly the design list)
node scripts/ops/mcp-latency-report.mjs --no-write                               -> exit 0; [classification] PARTIAL; no submit-argument
```

**Full name-only diff (9 files, = design file-changes list):**
`__tests__/opsMcpLatencyBudget.test.ts`, `__tests__/opsMcpLatencySqlSafety.test.ts`,
`docs/core/current-status.md`, `docs/designs/OPS-MCP-LATENCY-BUDGET.md`,
`docs/ops/LATENCY-BUDGET.md`, `scripts/ops-latency-sql/01-…sql`,
`scripts/ops-latency-sql/02-…sql`, `scripts/ops/mcp-latency-report-lib.cjs`,
`scripts/ops/mcp-latency-report.mjs`.

---

## Verdict matrix — card 12-item

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Scope: reporting/SQL/tests/docs only; ZERO dispatch change | **PASS** | 9-file diff is report + lib + 2 SQL + budget doc + 2 design docs + status; no runtime file |
| 2 | `autoTriggerDispatcher.ts` byte-equal | **PASS** | `git diff` = 0 lines |
| 3 | `familyRegistry.ts` byte-equal (no flips/registration) | **PASS** | `git diff` = 0 lines |
| 4 | Budget bound to `wall_clock_background` (D2) | **PASS** | `classifyLatencyBudget(wallClockBackgroundP95Seconds, submitBlocked)` — param is the wall-clock-background p95, not sum/submit (lib L303) |
| 5 | Multi-sample N=5 (D1); flags `<5`-sample families | **PASS** | both SQL files `limit 5` in `recent_args`; `LOW_SAMPLE_FLOOR = 5`; `lowSampleWarning` on per-family + wall-clock aggregates |
| 6 | Per-family p50/p95/max recorded (D4) | **PASS** | `aggregatePerFamily` emits `{min,p50,p95,max,samples,lowSampleWarning}`; markdown table renders all |
| 7 | Three clocks computed; binding clock stated (D2) | **PASS** | Q17 emits `wall_clock_background_seconds` + `sum_of_per_family_seconds`; `submit_to_last_complete` documented as context; budget doc states "45s budget is defined against `wall_clock_background`" |
| 8 | Threshold definitions present (30 warn / 45 fail) (D5) | **PASS** | `WARN_SECONDS = 30`, `FAIL_SECONDS = 45`; inclusive lower edge documented |
| 9 | **[core]** Projection 7/8/9/10; G under/over call stated (D6) | **PASS** | `projectWallClockForFamilyCounts` returns rows for [7,8,9,10] + `gUnderBudget` + crossing counts; markdown verdict line "G (7th family) is projected UNDER/OVER … crossed at N=__" |
| 10 | Budget classification unit-tested at boundaries (D8) | **PASS** | tested: just-under-45→PARTIAL¹, exactly-30→PARTIAL, exactly-45→FAIL, submitBlocked+fast→FAIL, NaN/-1/Inf→RangeError |
| 11 | No `package.json` / no audit-lint surface change | **PASS** | both diffs = 0 lines |
| 12 | Tests pass; forecast reasonable + green | **PASS** | +67 (47 budget + 20 SQL-safety); full suite 18,269/574 green. See forecast note² |

¹ **Boundary nuance (correct):** the design Test-plan line `classify(44.9,false)→PASS`
is an internal typo — 44.9 is `>= 30` and `< 45`, so the *normative* contract
(decision order `>= 30 → PARTIAL`) yields **PARTIAL**. The adjacent design rows
`classify(44.999)→PARTIAL` and `classify(45)→FAIL` confirm the band. The
implementer followed the normative contract and documented the correction inline
in the test. This is the right call — the band semantics are internally
consistent and match the budget doc's threshold table. Not a defect.

² **Forecast note (matrix 12 — anticipated):** design forecast was +18 (the budget
suite). Actual budget suite is 47 (thorough `it.each` boundary coverage), plus a
+20 SQL-safety suite that the Option-B relocation *necessitated* (the latency SQL
left the observability-scanned tree and needed its own safety scan). Total +67.
This is reasonable and was explicitly anticipated by the card's matrix item 12
("+18..+~67 with the added safety scans"). All green. The original intent-brief
HALT-10 ceiling of +50 referred to the *budget-logic* forecast band; the +20
safety suite is doctrine-coverage the relocation forced, not scope creep, and the
work remains a pure-test addition with zero runtime change.

---

## Verdict matrix — operator's 10 requirements

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `scripts/ops/sql/` observability ownership intact | **PASS** | `git diff` = 0; `ls` = 16 files |
| 2 | Latency SQL in its own dir | **PASS** | `scripts/ops-latency-sql/01,02` (sibling — see ruling) |
| 3 | Latency SQL still safety-scanned | **PASS** | `opsMcpLatencySqlSafety.test.ts` (+20): no DDL / no `select *` / no bare body / no bare `evidence_span` / no service-role-secrets-Bearer-JWT / no mutation / terminating `;` / header |
| 4 | No generated `out/` artifacts committed | **PASS** | `git ls-files \| grep '^out/'` = 0; `out/` is untracked only |
| 5 | No runtime dispatch behavior changed | **PASS** | dispatcher diff = 0 lines |
| 6 | No registry/prompt/taxonomy/schema/package.json/audit-lint change | **PASS** | registry diff = 0; package.json diff = 0; audit-lint diff = 0; no schema/migration; no `mcp-server/**` |
| 7 | Latency report runs end-to-end | **PASS** | `--no-write` runs both SQL files, classifies PARTIAL, exit 0 |
| 8 | Threshold uses wall-clock-background, not sum | **PASS** | classifier param `wallClockBackgroundP95Seconds`; budget doc states it explicitly (correctness core; matches dispatcher's sequential+gap reality) |
| 9 | Submit-response latency separated from background-classification latency | **PASS** | `submitBlocked` is a SEPARATE boolean param; markdown states "submit path is fire-and-forget … measures background time only"; `submit_to_last_complete` is a distinct context clock; submit HTTP response time is a DISTINCT smoke metric (D3) |
| 10 | Live-measurement smoke gated before spending Anthropic budget | **PASS** | the report is read-only (`npx supabase db query --linked`; no `submit-argument`); the only `submit-argument` (→ ~6 Anthropic calls/arg) is in the post-merge smoke, `.env.bot-tests`-gated |

---

## Sibling-directory deviation ruling

**Ruling: ACCEPTABLE.**

The operator's Option-B resolution named the dedicated dir `scripts/ops/latency-sql/`
(a *child* of `scripts/ops/`). That literal path **cannot** satisfy the operator's
own verification gates: `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`
collects `.sql` files **recursively** under `scripts/ops/` and asserts the count is
**exactly 16**. A nested `scripts/ops/latency-sql/` would push that recursive count
to 18 and leave the observability secrets suite red — which directly violates the
operator's hard gate (1) "observability ownership intact" and the byte-equal-tests
gate. The implementer verified this empirically (the design's § "Implementer note:
RESOLVED" records that the nested path fixed `opsMcpObservabilitySqlSafety` but left
`opsMcpObservabilityNoServiceRoleNoSecrets:81` red at 18).

The **sibling** dir `scripts/ops-latency-sql/` — outside the `scripts/ops/`
recursive scan — is the *only* layout that satisfies **every** operator hard gate
at once:

- `scripts/ops/sql/` is byte-equal, 16 files (gate 1).
- Both observability test files are 0-diff (gate 1 / byte-equal tests).
- The latency SQL is out of `scripts/ops/sql/` (gates 1 + 2).
- The latency SQL still gets equivalent safety coverage (gate 3).

The operator explicitly delegated the exact directory to implementer preference and
required only that the observability tests stay intact. The deviation is the minimal
change (sibling vs child) needed to honor the operator's *dominant intent and every
hard gate*, it is documented in three places (`docs/ops/LATENCY-BUDGET.md`
§ "Directory ownership", the design's "Implementer note: RESOLVED", and the
`current-status.md` handoff), and a test (`opsMcpLatencySqlSafety.test.ts`) actively
asserts the sibling layout (`path.relative(opsDir, LATENCY_SQL_DIR)` starts with
`..`). This is a correct, well-reasoned resolution, not a violation.

---

## Design conformance

- [x] All design file-changes are present (9 files = design list exactly)
- [x] No undocumented file-changes
- [x] Data model matches design (read-only; reads `argument_machine_observation_runs`; no migration)
- [x] API contracts match design (`classifyLatencyBudget` / `projectWallClockForFamilyCounts` signatures + CLI flags + exit codes match design § API contracts; SQL bodies byte-match design Q16/Q17 modulo the relocated header path)

---

## Doctrine self-check (all ✓)

- [x] **No truth/winner/loser language in user-facing strings** — the report markdown is ban-list scanned (`scanMarkdownForBannedTokens`); test asserts zero banned tokens in the body; the only token occurrences in the diff are inside ban-list assertion arrays (the *enforcement*) and design enumerations.
- [x] **Score never blocks posting** — N/A to score, but the analogous invariant holds: latency is advisory measurement; the budget never gates which families run (that is `familyRegistry.ts`, untouched) and never blocks posting (`submit-argument` is fire-and-forget via `EdgeRuntime.waitUntil` — independently confirmed in `autoTriggerDispatcher.ts` L77/L431). A FAIL projection is a signal to file a parallelization card, never an instruction to drop a family or block a submit.
- [x] **No service-role in client code** — no `app/`/`src/` touched; the report runs via the operator's `npx supabase db query --linked` CLI session; lib source asserts no `SERVICE_ROLE`/`ANTHROPIC_API_KEY` literal.
- [x] **No direct insert into `public.arguments`** — both SQL files are pure aggregate SELECTs; diff scan for inserts = 0.
- [x] **No AI calls in production app paths** — no `app/`/`src/`/`mcp-server/**` change; the lib makes no network call (purity test); the report only reads run rows.
- [x] **Plain language** — operator tooling; family taxonomy strings (`parent_relation`, …) are machine-taxonomy in an operator report, never surfaced to end users (same posture as the observability report); no `gameCopy` code added.
- [x] **Doctrine §1/§2 (latency is system-performance, never truth/heat)** — `cdiscourse-doctrine`: the report carries no per-argument verdict and no "fast = good / slow = bad" framing; the doctrine footer states latency is "never a gameplay/truth/heat signal"; ban-list test enforces it. Heat (§2 — move activity) is unrelated and not conflated.
- [x] **Doctrine §3 (popularity is not evidence)** — the queried table has no engagement/view/retweet column; the SQL selects only timing + family + status.
- [x] **No body / `evidence_span` leak** — both SQL files select only `argument_id`, `family`, timing columns, `family_runs`; tests assert `LATENCY_SECTIONS` columns exclude any body-ish key and the markdown body contains no `evidence_span` / `| body ` / `body:`.

---

## Test coverage

- [x] New public functions have unit tests — `classifyLatencyBudget`, `projectWallClockForFamilyCounts`, `percentile`, `aggregatePerFamily`, `computeWallClockSamples`, `deriveDefaultAddedFamilyP95`, `stitchLatencyMarkdown`, `buildLatencyJson` all exercised.
- [x] User-facing (operator) markdown has ban-list assertion — `stitchLatencyMarkdown` body scanned for zero banned tokens + explicit token-by-token assertion.
- [x] Edge cases from design § "Edge cases" have tests — empty result → `indeterminate (no samples)` not PASS; `<5`-sample family → `lowSampleWarning`; single sample → p95==p50; exactly-30/exactly-45 boundaries; `submitBlocked`+fast → FAIL; non-finite/negative → RangeError; data-derived G call (worked + pessimistic fixtures).
- [x] N/A — accessibility (not a UI card).

---

## Blockers

**None.**

---

## Suggestions (non-blocking)

1. The `current-status.md` handoff cites the full-suite count as "18,269 / 574
   suites green." The reviewer independently confirmed this with a captured
   `npm run test` run (exit 0). No action needed — flagged only because
   test-discipline treats implementer-stated full-suite counts as authoritative
   only once a reviewer re-run confirms them; that confirmation is now on record.
2. The design's Test-plan line `classify(44.9,false)→PASS` is an acknowledged
   internal typo (the implementer corrected it inline and the band is internally
   consistent). A one-line erratum in the design doc's Test-plan section would
   prevent a future reader from re-introducing the wrong expectation, but this is
   cosmetic — the normative contract in the design's § "Pure classification
   function" is unambiguous and the code follows it. Defer freely.

---

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-LATENCY-BUDGET`
- Open PR:
  `gh pr create --title "OPS-MCP-LATENCY-BUDGET: read-only auto-trigger latency budget (measure + codify; no dispatch change)" --body-file docs/audits/OPS-MCP-LATENCY-BUDGET-REVIEW-2026-05-28.md`
- **Deploy steps:** **none required for merge** — pure code + read-only SQL + docs
  (no migration, no Edge Function, no env var, no `package.json`). The Supabase
  GitHub auto-deploy is a no-op for this card.
- **Post-merge smoke (operator):** run the read-only report against the linked DB
  to capture the binding fresh-N=5 `wall_clock_background` p95 + the G projection,
  and record the smoke per the design's smoke plan
  (`docs/audits/OPS-MCP-LATENCY-BUDGET-SMOKE-2026-05-28.md`, carries
  `Audit-Lint: v1`). The 5 fresh `submit-argument` calls are `.env.bot-tests`-gated
  and are the deployed system's normal fire-and-forget behavior.
- Post-merge worktree cleanup (per `roadmap-reviewer.md` § "Post-merge worktree
  cleanup (operator step)").
