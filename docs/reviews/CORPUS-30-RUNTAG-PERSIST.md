# CORPUS-30-RUNTAG-PERSIST — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/corpus-30-runtag-persist (HEAD `5655b71`)
**Base:** origin/main (`8278390`)
**Design:** none at `docs/designs/CORPUS-30-RUNTAG-PERSIST.md` — card spec delivered inline (issue #476). Reviewed against the inline acceptance criteria.
**Migration-bearing:** YES → merge = production deploy = operator-gated (do NOT auto-merge).

## Summary
This card promotes the corpus run identifier from a fragile title-substring parse to a
durable, queryable column. The single migration
`20260605000001_corpus30_runtag_persist.sql` is strictly additive: one nullable `text`
column on `public.debates` plus one partial index `WHERE run_tag IS NOT NULL`. No DROP,
no TRUNCATE, no CHECK, no RLS change, no DEFAULT, no NOT NULL, no backfill — so it applies
instantly with no table rewrite. The runner change (`runAiDrivenCorpus.js`) introduces two
pure single-source helpers (`buildRunTag`, `buildRoomTitle`) so the title bracket and the
new column value can never drift; the debate insert now writes `run_tag` while KEEPING the
legacy `[ai-corpus …]` title bracket for back-compat + gallery dedupe. The operator backfill
recipe is documented in the migration's trailing comment and is NOT executed. Tests cover
both the migration shape (additive-only scan, partial index, no prior-migration edit) and
the runner wiring (helper format, identical title bracket, the live insert writes `run_tag`,
backfill-regex round-trip). All gates green. No concerns remain.

## Verification
- typecheck: **pass** (exit 0, `tsc --noEmit`)
- lint: **pass** (exit 0, `eslint . --max-warnings 0`)
- test: **648 suites passed / 19577 passed, 1 skipped, 19578 total** (exit 0, captured) — matches expected ~648 / 19577; card suite `corpus30RunTagPersist.test.ts` = 18/18
- secret scan: **clean** (no key/JWT/Bearer/Authorization hits in the diff)
- doctrine scan: **clean** (no verdict tokens; no SERVICE_ROLE/ANTHROPIC_API_KEY in src/app; the only `public.arguments` substring hits are pre-existing unchanged context lines in `current-status.md` describing OTHER cards — not additions)
- console.log / .only / .skip in added lines: **none**
- 1 skipped test is pre-existing (carried from the prior card's baseline), not introduced here.

| Check | Result |
|---|---|
| Migration apply | heightened-review pass — Docker not available (`docker info` exit 127, command not found); classes 1–4 scanned with zero unresolved markers |

## Migration heightened review (four named issue classes)
Docker path NOT taken — `docker info` returned 127 (Docker CLI not installed in this
worktree environment). Heightened textual review performed on the sole new SQL file. The
migration contains exactly two DDL statements (`ALTER TABLE … ADD COLUMN`, `CREATE INDEX`)
plus one `COMMENT ON COLUMN` and comment blocks.

- **Class 1 — Ambiguous column references in subqueries:** PASS. No subqueries, no policy
  WITH CHECK/USING blocks. The only `WHERE` clause is `WHERE run_tag IS NOT NULL` in the
  partial index, referencing a single column on the index's own table — no join, no
  ambiguity possible.
- **Class 2 — Column type mismatches:** PASS. No FK, no CHECK, no join condition. The new
  column is `text NULL`, a self-contained declaration with no cross-column comparison.
- **Class 3 — Implicit ordering dependencies:** PASS. Statement order is `ADD COLUMN
  run_tag` → `COMMENT ON COLUMN … run_tag` → `CREATE INDEX … (run_tag)`. The column is
  created before it is commented and before the index references it. `public.debates`
  pre-exists (created in `20260516000001_initial_schema.sql`). No DROP statements at all.
- **Class 4 — Function / trigger / extension dependencies:** PASS. No `gen_random_uuid()`,
  no `auth.uid()`, no `GRANT`, no trigger, no helper-function calls. The single
  `COMMENT ON COLUMN` targets a `public`-schema table the migration role owns — NOT
  `storage.*`, so no ownership (SQLSTATE 42501) risk.

Additional migration facts verified:
- Column nullable, NO DEFAULT, NO NOT NULL → instant ALTER, no table rewrite, no backfill
  needed (confirmed by test assertions + direct read).
- Timestamp `20260605000001` sorts AFTER the prior `20260604000001` and is the
  newest `.sql` across the entire `supabase/migrations/` directory.
- `run_tag` appears in NO prior migration; no prior migration file was edited.
- Backfill recipe is comment-only (no executable UPDATE/INSERT outside the dashed comment
  block — asserted by a comment-stripping test).

## Design conformance
- [x] All spec'd file-changes present (migration, runner wiring, tests, status-doc line)
- [x] No undocumented file-changes (4 files; footprint exactly matches the card)
- [x] Data model matches spec (additive nullable column + partial index)
- [x] Runner contract matches spec (single-source `buildRunTag`/`buildRoomTitle`; insert
      writes `run_tag`; legacy title bracket KEPT byte-equal — old inline literal
      `${s.title} [ai-corpus ${runId.slice(0,8)} #${s.scenarioId}]` is reproduced exactly
      by `buildRoomTitle`)

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (scan clean; `run_tag` is an
      opaque operational identifier, never a verdict)
- [x] Score never blocks posting (no scoring path touched)
- [x] No service-role in client code (runner insert uses `botA.client`, the bot's
      caller-scoped client; `grep SERVICE_ROLE` on the runner → no matches)
- [x] No direct insert into public.arguments (insert targets `public.debates` for room
      creation — the correct path; no `public.arguments` write added)
- [x] No AI calls in production app paths (change is in `scripts/bot-fixtures/`, the
      operator-gated `--pilot` exception; no provider call added)
- [x] Plain language only (no raw internal codes added to user-facing strings)
- [x] Epic-specific doctrine — `supabase-edge-contract`: migrations append-only (new file,
      no edit to applied migration ✓); RLS not disabled ✓; existing debates SELECT/INSERT
      policies already cover the new column and `run_tag` exposes no new sensitivity beyond
      the title that already carries the same string ✓; Claude does NOT deploy — operator
      runs `npx supabase db push --linked` ✓.

## Test coverage
- [x] New public functions have unit tests — `buildRunTag` (format + 8-char slice),
      `buildRoomTitle` (identical bracket, back-compat) both directly tested
- [x] Migration-shape coverage — additive-only scan, nullable/no-DEFAULT column, partial
      index, no DROP/CHECK/RLS-disable, only-public.debates, backfill-not-executed, prior
      migrations untouched, newest timestamp
- [x] Runner-writes-run_tag wiring asserted via source scan of the live insert
- [x] Backfill-regex round-trip test mirrors the SQL recipe (title built by
      `buildRoomTitle` → regex recovers the exact `run_tag`)
- [x] No accessibility surface (no UI card) — N/A

## Blockers
None.

## Suggestions (non-blocking)
1. The source-scan tests assert the insert via a regex over the JS file text
   (`.from('debates').insert({…run_tag: runTag`). That is fine for this card, but if the
   runner is later refactored to build the insert object separately the regex could
   silently stop matching. A future hardening could export the insert-payload builder as a
   pure helper and assert on its return value, mirroring the `buildRunTag`/`buildRoomTitle`
   pattern already used here. Defer — current coverage is adequate.
2. When #499 / the #469 runTag filter consumes the new column, confirm the
   `OPS-MCP-OBSERVABILITY-002` `RunTagSource` seam (the documented `DEVEX-RUNTAG-COLUMN-SWAP-001`
   follow-up) is swapped from the title-suffix heuristic to this durable column. Tracked
   separately; out of scope here.

## Operator next steps
- Push the branch: `git push -u origin feat/corpus-30-runtag-persist`
- Open PR: `gh pr create --title "CORPUS-30-RUNTAG-PERSIST: durable run_tag column + index + runner wiring" --body-file docs/reviews/CORPUS-30-RUNTAG-PERSIST.md`
- **GATE: migration-bearing → merge = production deploy → OPERATOR-GATED.** Do NOT
  auto-merge; present at the operator gate after approval.
- Deploy step (operator, after merge): `npx supabase db push --linked` (the Supabase
  GitHub integration may also auto-apply on merge to main).
- Operator backfill of legacy corpus rooms (one-time, OPTIONAL, after deploy) — recipe is
  in the migration's trailing comment block; run from the SQL editor / service-role.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree
  cleanup (operator step)").
