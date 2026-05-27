# OPS-MCP-TEST-DATA-CLEANUP — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-27
**Branch:** feat/OPS-MCP-TEST-DATA-CLEANUP
**Design:** docs/designs/OPS-MCP-TEST-DATA-CLEANUP.md (Approach A, operator-confirmed Stage 2B)
**Intent brief:** docs/designs/OPS-MCP-TEST-DATA-CLEANUP-intent.md
**HEAD:** 9f3064c (3 implementation commits on top of designer 779bcc1; intent brief 8d0ddb9 on main)

---

## Summary

A 4-file PR cleans 11 synthetic test rows (2 runs + 9 results, all tagged `provider_key='smoke-mcp:test-server'` from a single 2026-05-26 05:56:33 insertion event) that the OPS-MCP-OBSERVABILITY smoke at 0e98c27 surfaced as contamination of the Q11+Q12 production-mode aggregates. The migration is a single `DELETE FROM public.argument_machine_observation_runs WHERE provider_key = 'smoke-mcp:test-server'` — exact-equality predicate, no `LIKE`, no `IN`, no subquery, no join. The FK `ON DELETE CASCADE` on `results.run_id → runs.id` (declared at `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql:102-103`) atomically removes the 9 dependent results inside the same migration transaction. The 10 new tests (A-1..A-10) are pure-Jest structural assertions over the migration file content via a comment-stripping helper that mirrors the existing `opsMcpObservabilitySqlSafety.test.ts` pattern. Doctrine is clean: zero verdict tokens in executable SQL, zero PII/body content, no `flags`/`public.arguments` touch, no service-role/secret leakage, no `src/`/`mcp-server/`/`supabase/functions/`/`scripts/ops/sql/` edits (scope-creep scan empty). The HALT-trigger 11 ("Approach A without operator Stage 2B approval") is satisfied by the operator-launch text confirming Approach A. Recommend Approve and proceed to PR.

## Verification

| gate | result |
| --- | --- |
| typecheck | pass (exit 0) |
| lint | pass (exit 0; `--max-warnings 0`) |
| targeted test | pass — `opsMcpTestDataCleanup` 10/10 tests, 1 suite; `opsMcpObservability|opsMcpTestDataCleanup` umbrella 141/141 tests, 12 suites |
| suite count | 561 total (matches implementer claim of 560 → 561) |
| secret scan | clean (zero hits for `ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|^xai-|Bearer |Authorization:|JWT-shape`) |
| doctrine scan | clean (all "winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist" hits are inside the ban-list test array — defensive, not emissive; `true`/`false` hits are markdown-table cell values and Jest assertion shape) |
| service-role / direct-public.arguments scan | clean (zero src/app hits; zero direct-insert hits) |
| Migration apply | heightened-review pass — Docker not available (`docker info`: command not found in this shell); classes 1–4 scanned with zero unresolved markers |

## Design conformance

- [x] All design file-changes are present (1 migration + 1 test file; design §6.a A-1..A-10; design §4 migration SQL)
- [x] No undocumented file-changes (4 files total; the design doc and the appended `current-status.md` paragraph were anticipated)
- [x] Data model matches design (single-table `DELETE`; CASCADE handles results; no schema change)
- [x] API contracts match design (no API surface changed)

## Doctrine self-check (must all be checked)

- [x] No truth/winner/loser language in user-facing strings (migration is operator-facing; ban-list-test references are defensive, not emissive)
- [x] Score never blocks posting (no score path touched)
- [x] No service-role in client code (zero matches in src/app)
- [x] No direct insert into public.arguments (zero matches; the DELETE is on a different table)
- [x] No AI calls in production app paths (no code path added)
- [x] Plain language only (no raw internal codes in UI strings — no UI touched)
- [x] Epic-specific doctrine — cdiscourse-doctrine §8 "soft-delete only for arguments" properly distinguished: `public.argument_machine_observation_runs` is an observation/audit table, NOT an arguments table; doctrine soft-delete rule does not apply (migration header at lines 21-28 encodes this judgement explicitly). cdiscourse-doctrine §8 "flags rows never delete" preserved — flags table not referenced.
- [x] supabase-edge-contract: migration is append-only (new file `20260527000020_…`; no edit to applied migration), idempotent (a second apply matches 0 rows), RLS not disabled, no Edge Function shape change.
- [x] test-discipline: +10 tests, +1 suite (matches +10 design forecast); tests strictly increase; pure-Jest fs-based shape assertions matching the existing `opsMcpObservabilitySqlSafety` pattern; no `.skip`/`.only`/console.log.

## Test coverage

- [x] New public functions have unit tests — N/A (no public TS API added); the migration's shape is the only deliverable, and it has 10 structural tests
- [x] User-facing strings have ban-list assertion — defensive A-8 verdict-token ban-list is present (10 tokens scanned)
- [x] Edge cases from design § "Edge cases" have tests:
  - File existence (A-1)
  - Header references card + intent brief + 4 predecessor SHAs (A-2)
  - Exactly one DELETE; no INSERT/UPDATE/ALTER/DROP/CREATE/TRUNCATE in executable SQL (A-3)
  - DELETE targets `public.argument_machine_observation_runs` only (A-4)
  - WHERE uses exact-equality `provider_key = 'smoke-mcp:test-server'` (no LIKE/ILIKE/IN/SIMILAR TO/regex) (A-5)
  - No DELETE-without-WHERE (truncation guard) (A-6)
  - No PII/body content (no email-shape strings; no body-shaped quoted strings) (A-7)
  - No verdict tokens (A-8)
  - No `flags` table touch (A-9)
  - No `public.arguments` touch (A-10)
- [x] Accessibility assertions — N/A (no UI card)

## Verdict matrix (22 items)

| # | item | result | evidence |
| --- | --- | --- | --- |
| A | Migration file in `supabase/migrations/` (not `scripts/`) | PASS | `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql` |
| B | Filename follows YYYYMMDDHHMMSS_*.sql convention | PASS | `20260527000020_ops_mcp_test_data_cleanup.sql` |
| C | Migration sequential after `20260526000019` | PASS | 20260527 > 20260526; ls confirms it's the last file |
| D | Header cites the card (`OPS-MCP-TEST-DATA-CLEANUP`) | PASS | migration:2-3,10 |
| E | Header documents idempotency | PASS | migration:34 ("Idempotent: a second apply finds 0 matching rows and is a no-op"); 80-83 |
| F | WHERE clause exact equality `provider_key = 'smoke-mcp:test-server'` | PASS | migration:74-75; tests A-5 enforces |
| G | WHERE matches only the synthetic provider | PASS | single equality predicate; no OR/JOIN/subquery |
| H | DELETE targets only `argument_machine_observation_runs` | PASS | migration:74; test A-4 enforces |
| I | CASCADE FK verified | PASS | `20260526000018_mcp_021b_machine_observation_results.sql:101-103` declares `REFERENCES public.argument_machine_observation_runs(id) ON DELETE CASCADE` |
| J | No DROP/TRUNCATE/ALTER/CREATE INDEX/DELETE-without-WHERE | PASS | test A-3 enforces; test A-6 enforces no-DELETE-without-WHERE |
| K | No explicit `BEGIN/COMMIT` | PASS | migration:70-72 acknowledges this convention; no BEGIN/COMMIT in file |
| L | No verdict tokens in migration comments / test labels | PASS | test A-8 enforces; manual scan confirms |
| M | Test file at `__tests__/opsMcpTestDataCleanup.test.ts` with 10 tests A-1..A-10 | PASS | file exists; 10 `it(…)` calls map to A-1..A-10 |
| N | Tests are pure Jest unit tests (no live DB call) | PASS | imports `fs` + `path` only; no Supabase client; `stripSqlComments` helper |
| O | Test forecast +10 within design +10 and below +60 HALT | PASS | exactly +10 / +1 suite; suite count 560 → 561 |
| P | No file under `src/` modified | PASS | `git diff --name-only -- 'src/'` empty |
| Q | No file under `mcp-server/` modified | PASS | `git diff --name-only -- 'mcp-server/'` empty |
| R | No file under `supabase/functions/` modified | PASS | `git diff --name-only -- 'supabase/functions/'` empty |
| S | No file under `scripts/ops/sql/` modified | PASS | `git diff --name-only -- 'scripts/ops/sql/'` empty |
| T | No taxonomy / prompt / registry file modified | PASS | `mcp-server/lib/familyRegistry.ts` not touched; no `supabase/functions/_shared/booleanObservations/` touch |
| U | `docs/core/current-status.md` appended (not rewritten; no banned token) | PASS | +6 lines append at lines 5341-5346; no banned token introduced |
| V | Working tree only the 10 known operator-territory untracked files | PASS | `git status -sb` shows exactly the 10 expected entries (4 testing-runs MDs, 3 mcp021c-edge-smoke artifacts, netlify-prod.git, 2 phase5-mcpserver002 logs) |

**Result: 22/22 PASS. No FAIL, no NOT-APPLICABLE items (all 22 items are applicable to a hard-delete migration card).**

## Migration-bearing four-class scan (Docker-unavailable path; heightened textual review)

- **Class 1 — Ambiguous column references in subqueries:** **PASS via N/A.** The migration is a single-table DELETE with one WHERE clause. No subquery, no JOIN, no policy body, no shared column names with a joined relation. The QOL-041 motivating pattern (bare `debate_id` inside a subquery's WHERE) cannot apply.

- **Class 2 — Column type mismatches:** **PASS via type compatibility.** `provider_key` is declared `text` at `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql:86` (`provider_key text`); `'smoke-mcp:test-server'` is a text literal. Exact type match. No FK declaration introduced. No CHECK constraint introduced. No casting required.

- **Class 3 — Implicit ordering dependencies:** **PASS via N/A.** The migration creates nothing, alters nothing, drops nothing. It is a single DELETE. No `CREATE INDEX` before `CREATE TABLE`, no `CREATE POLICY` before `ENABLE ROW LEVEL SECURITY`, no `CREATE TRIGGER` before its function, no `DROP COLUMN` chain. The CASCADE-deletion of the 9 results is automatic per the FK declared in migration 18; the new migration has no ordering responsibility.

- **Class 4 — Function / trigger / extension dependencies:** **PASS via N/A.** No `gen_random_uuid()` call, no `auth.uid()` reference, no `GRANT`, no trigger function reference, no `is_admin(auth.uid())` call. **Critically, no `COMMENT ON storage.*` statement** (the PR-003 SQLSTATE 42501 boundary is preserved). The migration introduces no new function, no extension, no role dependency.

**Conclusion:** All four issue classes scanned and resolved without a single unresolved marker. The migration is the simplest shape in the four-class taxonomy: a single-table hard-delete with exact-equality predicate. The heightened-review path provides sufficient safety despite Docker unavailability.

## HALT triggers re-evaluation (all 18 from intent brief §6)

All 18 HALT triggers re-evaluated; none fire post-implementation.

- **HALT 1** (Q12-SEMANTIC-TIGHTENING smoke missing from main): PASS — verified at `19b8d8a` (predecessor SHA in design §1).
- **HALT 2** (DELETE touches non-synthetic providers): PASS — single exact `provider_key = 'smoke-mcp:test-server'` predicate; test A-5 enforces.
- **HALT 3** (touches tables beyond `argument_machine_observation_*`): PASS — single DELETE on the runs table only; CASCADE handles results (same family). Test A-9 ensures no `flags`; test A-10 ensures no `public.arguments`.
- **HALT 4** (Source 6 filter weakened): N/A — Approach A does not touch Source 6.
- **HALT 5** (> 11 rows): PASS — exact 11 (design §1 inventory verified live).
- **HALT 6** (backfill scope creep): N/A — Approach A has no backfill.
- **HALT 7** (registry change): PASS — `mcp-server/lib/familyRegistry.ts` not in diff.
- **HALT 8** (Edge Function change): PASS — `supabase/functions/*` not in diff.
- **HALT 9** (UI change): PASS — zero `src/*` edits.
- **HALT 10** (taxonomy/prompt change): PASS — no `_shared/booleanObservations/*` touch.
- **HALT 11** (Approach A without Stage 2B approval): PASS — operator launch text explicitly confirms Approach A at Stage 2B.
- **HALT 12** (Approach B without approval): N/A — Approach B was not chosen.
- **HALT 13** (non-backward-compatible schema change): PASS — no schema change at all.
- **HALT 14** (test forecast > +60): PASS — +10 (well clear).
- **HALT 15** (verdict tokens in user-facing strings): PASS — no user-facing string introduced; ban-list test A-8 defensive.
- **HALT 16** (PII/body content in migration or test output): PASS — test A-7 enforces; manual scan of design doc inventory tables shows only UUIDs + family/rawKey/confidence values, no body text.
- **HALT 17** (unclassified untracked files at PR creation): PASS — `git status -sb` shows exactly the 10 known operator-territory entries (4 testing-runs MDs, 3 mcp021c-edge-smoke artifacts, netlify-prod.git, 2 phase5-mcpserver002 logs); no surprise files.
- **HALT 18** (cleanup script in `scripts/` instead of migration): PASS — file is at `supabase/migrations/20260527000020_ops_mcp_test_data_cleanup.sql`, not under `scripts/`.

**All 18 HALT triggers clean.**

## Doctrine deep-check findings

1. **Exact WHERE clause.** The migration contains exactly one `WHERE` clause at line 75: `WHERE provider_key = 'smoke-mcp:test-server'`. No `LIKE`, no `ILIKE`, no `IN (…)`, no `SIMILAR TO`, no POSIX regex (`~` / `~*`), no subquery, no JOIN. Test A-5 enforces each of these negatives explicitly. The exact-equality match is the strongest possible scope-binding for a DELETE migration — only rows with the literal string `smoke-mcp:test-server` in `provider_key` are affected. Verified.

2. **CASCADE behavior verification.** Read `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql:101-103`. The FK is: `run_id uuid NOT NULL REFERENCES public.argument_machine_observation_runs(id) ON DELETE CASCADE`. Exact match for what the new migration relies on. Deleting a run row atomically deletes all `argument_machine_observation_results` rows whose `run_id` matches, inside the same migration transaction. The 9 results in the inventory (5 from run `2a16fe8b…` + 4 from run `ff2bd3cc…`) will be removed by the CASCADE. The migration body's comment at lines 67-72 explicitly cites the line number of the CASCADE declaration — accurate to the source. No orphan-result risk.

3. **Scope-creep scan.** Ran `git diff --stat 779bcc1..HEAD -- src/ mcp-server/ supabase/functions/ scripts/ops/sql/` — empty output (zero files modified in any locked directory). Then re-ran `git diff --name-only 8d0ddb9..HEAD -- 'src/' 'mcp-server/' 'supabase/functions/' 'scripts/ops/sql/' 'supabase/functions/_shared/' 'mcp-server/lib/familyRegistry.ts' 'src/lib/constitution/engine.ts'` — also empty. The 4 files in the diff are: 1 new migration, 1 new test, 1 new design doc, 1 appended status doc. Confirmed.

4. **Header comment scan.** Migration header (lines 1-64) cites:
   - The card: `OPS-MCP-TEST-DATA-CLEANUP` (line 10)
   - Intent brief path (line 11)
   - Design doc path with Approach A (line 12)
   - Operator decision (line 13)
   - 4 predecessor SHAs (lines 16-19): `19b8d8a`, `e060eef`, `0e98c27`, `d500037`
   - Doctrine encoding (lines 21-34) — explicit distinction between observation/audit table and `public.arguments`
   - Idempotency proof (line 34, 80-83)
   - HALT trigger evaluation (lines 43-49)
   - OPS-001 §4 four-class compliance (lines 51-63)
   - No verdict tokens anywhere in the header (test A-8 enforces).

5. **Test coverage scan.** The 10 tests cover all required dimensions from design §6.a:
   - A-1: File location ✓
   - A-2: Header references (card + intent brief + 4 SHAs) ✓
   - A-3: Exactly one DELETE; no other DDL/DML keywords in executable SQL ✓
   - A-4: DELETE target single-table (`public.argument_machine_observation_runs`) ✓
   - A-5: WHERE exact-equality + ban on LIKE/ILIKE/IN/SIMILAR TO/regex ✓
   - A-6: No DELETE-without-WHERE (truncation guard) ✓
   - A-7: No PII/body content ✓
   - A-8: No verdict tokens (10-token ban-list) ✓
   - A-9: No `flags` table touch ✓
   - A-10: No `public.arguments` touch ✓
   The `stripSqlComments` helper (lines 42-63) is structurally identical in intent to the helper in `__tests__/opsMcpObservabilitySqlSafety.test.ts`, so the executable-SQL scans cleanly bypass header-comment references to banned tokens (the header legitimately says "this migration does NOT touch the flags table"; the test scans executable SQL only). Pattern is correct.

6. **No service-role / no secret in migration body.** Grep over migration file for `service_role|apikey|Bearer|ANTHROPIC_API_KEY|BEGIN PRIVATE KEY` returns zero matches. The migration body uses only one string literal: `'smoke-mcp:test-server'` (the provider_key value). Test A-7 enforces this by inspecting every single-quoted literal in the migration source.

7. **Idempotency proof.** A second apply of `DELETE FROM public.argument_machine_observation_runs WHERE provider_key = 'smoke-mcp:test-server'` matches zero rows (because the first apply removed them) and is a no-op. This is the natural-idempotency pattern for DELETE — no explicit `IF EXISTS` needed because DELETE's contract is "remove rows matching predicate" and an empty match-set is non-erroneous. The migration header at lines 34 and 80-83 documents this. Verified.

8. **Working tree pre-commit discipline.** `git status -sb` shows exactly the 10 known operator-territory untracked files:
   - `docs/testing-runs/2026-05-25-ai-driven-bot-corpus-annotated.md`
   - `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`
   - `docs/testing-runs/2026-05-25-bot-engagement-corpus.md`
   - `docs/testing-runs/2026-05-25-bot-stress-summary.md`
   - `mcp021c-edge-smoke-request.json`
   - `mcp021c-edge-smoke-response.json`
   - `mcp021c-edge-smoke-runids.txt`
   - `netlify-prod.git`
   - `phase5-mcpserver002-hosted-smoke.log`
   - `phase5-mcpserver002-validator.log`
   These match the 10-file list documented in the intent brief and design §11. No surprise files; HALT 17 not fired.

## Blockers

None. Verdict is **Approve**.

## Suggestions (non-blocking)

1. **Smoke audit Phase 3 ambiguity (designer flagged at design §9, open question 1).** The intent brief §9 Phase 3 says "Source 6 verification (Approach B only)". Since Approach A was chosen, Phase 3 is naturally skipped. The designer's recommended "Phase 3-A: re-run Q11 + Q12 to confirm 0 contamination" already lives in Phase 2 of the smoke plan. The operator may want to make this explicit in the post-merge audit doc (`docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md`) by noting "Phase 3 N/A under Approach A". Non-blocking; operator discretion.

2. **Follow-on card: insert-time guardrail.** The designer's recommendation §3.c flagged that the "right" defense against future `provider_key='smoke-*'` re-contamination is an insert-time CHECK constraint (e.g., `provider_key NOT LIKE 'smoke-%' OR run_mode = 'admin_validation'`) or an Edge Function provider whitelist. This is explicitly out of scope for this card but would close the future-leak risk that Approach A inherently does not address. If the operator wants this, a follow-on `OPS-MCP-INSERT-GUARDRAILS` card would be the right vehicle. Non-blocking.

3. **Post-merge auto-deploy sequencing.** The Supabase GitHub integration auto-applies the migration on merge to main per `docs/core/CLAUDE.md` § "Supabase merge auto-deploy" (per the implementer handoff at `docs/core/current-status.md:5343`). The 5-phase smoke at `docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md` should explicitly confirm migration is applied (e.g., via `npx supabase migration list --linked` or a SELECT against the table confirming 0 synthetic rows) before running the observability report. The implementer flagged this as risk R-S2 in design §11. Non-blocking; operator-handled at smoke time.

## Operator next steps

- **Push branch:** `git push -u origin feat/OPS-MCP-TEST-DATA-CLEANUP`
- **Open PR:** `gh pr create --title "OPS-MCP-TEST-DATA-CLEANUP: hard-delete 11 synthetic test rows (Approach A)" --body-file docs/reviews/OPS-MCP-TEST-DATA-CLEANUP.md`
- **Deploy step:** none — Supabase GitHub integration auto-applies the migration on merge to main (no `npx supabase db push --linked` needed)
- **Post-merge smoke (per intent brief §9 and design §10):**
  - Phase 1: confirm migration applied (e.g., `SELECT COUNT(*) FROM public.argument_machine_observation_runs WHERE provider_key = 'smoke-mcp:test-server'` returns 0)
  - Phase 2: `node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/cleanup-smoke` and inspect Q11 (0 misunderstanding_repair production rows) and Q12 (0 unsupported-family positives, down from 3)
  - Phase 3: N/A under Approach A (Source 6 not modified)
  - Phase 4: `npx jest --testPathPattern="(opsMcpObservability|opsMcpTestDataCleanup)" --no-coverage` → exit 0
  - Phase 5: commit `docs/audits/OPS-MCP-TEST-DATA-CLEANUP-SMOKE-2026-05-27.md`
- **Post-merge worktree cleanup** (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)"):
  - `git worktree list | grep "feat/OPS-MCP-TEST-DATA-CLEANUP"` (or `Select-String` on Windows PowerShell)
  - `git worktree remove -f -f ".claude/worktrees/agent-<hash>"`
  - `git branch -D feat/OPS-MCP-TEST-DATA-CLEANUP`
- **Authorization granted on smoke PASS:** `OPS-MCP-IDEMPOTENCY-HARDENING` becomes authorized to begin (Q9's 3 duplicate-run pairs are the only outstanding observability finding once Q11+Q12 are clean).
