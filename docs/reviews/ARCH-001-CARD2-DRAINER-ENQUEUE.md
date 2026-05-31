# ARCH-001 Card 2 — drainer + enqueue behind smoke-only routing — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-30
**Branch:** feat/ARCH-001-card2-drainer-enqueue
**Design:** docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md (+ parent
ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md §A.2/A.4/A.5/A.6/A.9/A.10/A.11/A.12)

> Diff base: **`origin/main` (70d4804)** — the PR base that already carries
> Card 1 (`…21`) + Card 2A (`…22`). Local `main` is stale at 448ff28, so
> `main..HEAD` would wrongly fold in the Card-2A files; this review uses
> `git diff origin/main..HEAD` throughout (10 commits, 25 files,
> +3545/-42).

## Summary
The largest card in the chain ships exactly its scope and nothing more. The
classifier fan-out gains a smoke-only, **default-disabled** queue path: a pure
`shouldRouteToQueue` predicate wraps the existing submit-path dispatch in a
mutually-exclusive `if (enqueue) else (original direct dispatch)`; a new
single-flight, bounded-batch `classifier-drainer` Edge Function drains the
queue (reclaim-first, C=3, T=90s, batch/invocation caps, lease in `finally`);
an enqueue-kick trigger + a *commented* operator cron tick drive it from
Vault-sourced credentials; `findExistingRun` becomes active-queue-aware; and
the MCP adapter timeout is parameterized so the drainer gets ≥30s while the
submit path keeps 15s byte-for-byte. All six Card-1/2A SQL functions are
**called, never redefined**. The migration is written-not-applied and touches
no table/column/index/policy/extension. The two changed tests (UX-001.5
boundary, IDEM-11) are design-authorized and verified to retain teeth. The
work is entirely server-side (zero `src/`/`app/` changes), secret-safe, and
doctrine-clean. Ready for PR + the operator-gated smoke.

## Verification
| Gate | Result |
|---|---|
| typecheck | pass (`tsc --noEmit`, exit 0) |
| lint | pass (`eslint … --max-warnings 0`, exit 0) |
| test | 18552 → **18676** tests / 583 → **591** suites (full `npx jest`, exit 0); 8 Card-2 + changed suites re-run = 167 passed |
| secret scan | clean (only `not.toMatch` ban assertions matched) |
| doctrine scan | clean (only the ban-list array + `not.toMatch` assertions matched) |
| Migration apply | heightened-review pass — Docker not available (`docker info` → exit 127, command not found); classes 1–4 scanned with zero unresolved markers |

## Design conformance
- [x] All design file-changes present (routing, drainer fn+core+classify+retry, kick migration, findExistingRun, additive adapter timeout, config.toml, monitoring SQL + runbooks, tests)
- [x] No undocumented file-changes (11 source files map 1:1 to scope items 1–4 + §A.6; rest are tests/docs)
- [x] Data model matches design (no schema change this card; the job IS the run row; finalizer `p_observations` jsonb mirrored)
- [x] API contracts match design (`enqueue_classifier_job` per A–G; finalizer consistent pairs; ≥30s drainer / 15s submit)

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings — only counters + structural reasons (`mcp_*`, `retry_attempts_exhausted`); ban-list array is a test
- [x] Score never blocks posting — enqueue is a fast local INSERT after the row is stored; submit returns 201 regardless; both arms fire-and-forget under `waitUntil`
- [x] No service-role in client code — zero `src/`/`app/` changes; drainer/routing are server-only under `supabase/functions/`
- [x] No direct insert into public.arguments — none; all writes go through Card-1/2A RPCs or the guarded run-row UPDATE on `argument_machine_observation_runs`
- [x] No AI calls in production app paths — the only provider surface is the server-side MCP adapter inside the drainer Edge Function
- [x] Plain language only — no raw internal codes in UI strings (no UI touched)
- [x] Epic-specific doctrine — `supabase-edge-contract`: standard Edge shape (verify_jwt=false + shared-secret-before-work → service client → Card SQL fns → audit row → safe counter-only response); migration discipline (new sequenced file, never edits an applied one, no COMMENT ON storage.*). `cdiscourse-doctrine §6/§7`: Vault-only secrets, nothing logged. `§10a`: Family J (`sensitive_composer`) excluded from the production enqueue set.

## Test coverage
- [x] New public functions have unit tests — `classifyDrainerFailure` (16 retry-policy), `shouldRouteToQueue`/`enqueueClassifierJobs` (21 routing-predicate, 17 submit-routing), drainer core (34, incl. DC-13/14/15 false-return, DC-7 single-flight, DC-8 reclaim-first, DC-17/18 consistent pairs, DC-20 retry-UPDATE), drainer edge (21), kick migration scan (21)
- [x] User-facing strings have ban-list assertion — retry-policy + report ban-list tests assert no verdict token in any reason/sub-reason
- [x] Edge cases tested — lost-lease, dead-letter cap, argument-missing terminal, Vault-unseeded skip, H/I/J exclusion, nonblocking submit, ≥30s vs 15s
- [x] Accessibility assertions — N/A (no UI card)

## Reviewer's mandated answers
1. **UX-001.5 boundary still fails on a real auth/validation/insert/notification/response removal?** YES. The relaxed `isDispatchTailLine` (test lines ~158-178) admits a *removed* line only if it is blank, purely structural (`/^[}{)\];]*$/`), one of the three exact relocated arg strings (`insertedArg.id,` / `data.debate_id,` / `serviceClient,`) or `).catch(`-prefixed, or contains one of 13 dispatch-tail tokens. A removed `requireAuth`/`evaluateTransition`/`.from('arguments').insert`/`sendNotification`/`new Response(JSON.stringify(...))` line carries real identifiers → matches none → lands in `offendingRemovals` → `expect([]).toEqual` FAILS. The seven actual removals are all genuine dispatch relocations. Verified empirically (`submit-argument` removed-line list). Legitimate, not gaming. IDEM-11 likewise keeps both the preserved `existing.status === 'success'` check and the `existing &&` guard, adapting to the documented `existing && (isActiveQueueJob || status==='success')` shape — not weakened.
2. **Double-dispatch impossible?** YES. `submit-argument/index.ts` (~795-838) is a single `if/else`: the `if` arm calls only `enqueueClassifierJobs`; the `else` arm is the byte-unchanged original `dispatchAutoTriggerForArgument(...).catch(...)` + `EdgeRuntime.waitUntil`. `shouldRouteToQueue` is default-disabled (`enabled !== true` first; env `=== 'true'` AND smoke-tag). Card-1 indexes #4/#5 are the DB backstops.
3. **`false`-return honored (no double-success)?** YES. `finalizeJob` returns `data === true` (false on error too). Every call site maps false → `'lost_lease'` (`classifierDrainerCore.ts` 304/319/360/376; `scheduleRetry` 345). `'lost_lease'` increments only `jobsLostLease` — never `jobsSucceeded`/`jobsRetried` (switch arm 224-228). The job re-runs on a later drain. Retry path guarded on `lease_owner + state='leased'` (506-519) → empty result = `'lost_lease'`.
4. **Drainer→MCP ≥30s with 15s submit default preserved?** YES. `DRAINER_MCP_REQUEST_TIMEOUT_MS = 30_000` passed to both the request builder and adapter options (`classifierDrainerClassify.ts` 132/138). `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000` is byte-unchanged; the adapter's `options` are additive and resolve to 15s when absent. `autoTriggerDispatcher.ts:320` still passes the adapter as a bare 1-arg reference (no diff) → 15s.
5. **Single-flight + bounded batch sound, exits before the ceiling?** YES. `acquire_drain_lease` first (skip+exit, no claim/provider call if not self); `reclaim_stale_leases()` before the loop; loop bounded by `jobsProcessed < 60` AND `elapsed < 90s` with an in-batch budget re-check; provider concurrency C=3; `release_drain_lease` in `finally`. Worst case ≈ T(90) + one trailing 30s call ≈ 120s < 150s ceiling; lease TTL 130s ≥ 90+30+10.
6. **Secret-safe (Vault-only, nothing logged)?** YES. The kick trigger + commented cron read URL+secret from `vault.decrypted_secrets`; no secret literal in the migration; an unseeded secret skips silently (never fails the INSERT); `net.http_post` wrapped so SQLERRM is never surfaced. The drainer validates the shared secret (constant-time-ish) BEFORE any work → 401 otherwise. Zero `console.*` in the new Edge code; the `classifier_drain_audit` row carries only opaque owner + counters. Monitoring SQL is read-only and secret-free.
7. **Anything out-of-scope?** NO. `engine.ts`, `mcp-server/`, prompts/taxonomy/family-keys/schema-mirror, `package.json`/lockfile, `persistenceWriter.ts`, `familyRegistry.ts`, `machineObservationDefinitions.ts` all untouched. No Family H, no detector tiering, no production/percentage rollout, no executed `cron.schedule`. `boundedConcurrencyRunner.ts` reused (pre-existing). Monitoring dir is a sibling of `scripts/ops/`, not under it.

## Migration heightened review (classes 1–4)
- **Class 1 (ambiguous refs):** clean — the only subquery (`EXISTS … FROM inserted_rows ir WHERE ir.state … AND ir.family …`) is fully alias-qualified; Vault reads are single-table `WHERE name = …`.
- **Class 2 (type mismatch):** clean — `kick_key bigint` (value 7700100023 needs bigint) for `pg_try_advisory_xact_lock(bigint)`; `net.http_post(url text, body jsonb, headers jsonb)` matches the pg_net signature.
- **Class 3 (ordering):** clean — function created before `CREATE TRIGGER … EXECUTE FUNCTION`; `DROP TRIGGER IF EXISTS` precedes the create on the same table; COMMENT last; no DROP COLUMN/TABLE.
- **Class 4 (fn/ext deps):** clean — `net.http_post` (pg_net) + `vault.decrypted_secrets` (Vault) provided by Card 1 / Supabase default; `cron.schedule` is commented (not executed); `SECURITY INVOKER`; the only `COMMENT ON` targets the just-created `public` function (no `storage.*` → PR-003 SQLSTATE 42501 boundary preserved). Mechanical greps: `CREATE POLICY … FOR (INSERT|UPDATE|DELETE)` = 0; uncommented `cron.schedule` = 0; the two DDL-keyword hits are comment prose on lines 70-71.

> Heightened-review caveat: the SQL was reviewed textually because Docker was
> unavailable. The behavioral proof (kick fires once per statement, fires only
> for queue rows, skips on unseeded Vault) is operator-verified in the smoke
> runbook; CI suites lock the migration text/shape.

## Suggestions (non-blocking)
1. The bare-secret fallback in the drainer (`presented = authHeader` when it lacks the `Bearer ` prefix, index.ts 105-107) is fine for the apikey-style cron header, but the operator runbook should make explicit which header form the seeded cron/kick actually sends so the two stay in lockstep.
2. `readAttemptCount` defaults to `1` on a read miss (core 420/423). That is conservative (one extra retry at worst) and harmless, but a one-line comment that "1" deliberately biases toward retry-not-dead-letter on a transient read failure would aid a future reader.
3. Consider noting in the smoke runbook that, because `findExistingRun` orders `started_at DESC LIMIT 1`, a cell with a terminal-failed older row and a newer active queue row reads the newer (active) row — the intended behavior — so a re-submit during an in-flight retry does not double-dispatch.

(All three are documentation/clarity nits; none affect correctness or doctrine.)

## Operator next steps
- Push the branch: `git push -u origin feat/ARCH-001-card2-drainer-enqueue`
- Open PR: `gh pr create --title "ARCH-001 Card 2: drainer + enqueue behind smoke-only routing" --body-file docs/reviews/ARCH-001-CARD2-DRAINER-ENQUEUE.md`
- Post-merge deploy / smoke (operator-gated, in order — from the intent brief + migration footer):
  1. `npx supabase db push --linked` (installs the inert enqueue-kick trigger).
  2. Deploy `classifier-drainer` (Supabase GitHub integration auto-deploys on merge; confirm it is live and capture its URL).
  3. Set the `CLASSIFIER_DRAIN_SHARED_SECRET` function secret.
  4. Seed the two Vault secrets (`arch_001_classifier_drainer_url`, `arch_001_classifier_drainer_secret`) — never commit them.
  5. Schedule the 60s cron tick (the commented `cron.schedule` block at the foot of `…23`) AFTER steps 2–4.
  6. Restore `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=5`.
  7. Set `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, then run `scripts/arch-001-card2-sql/smoke-runbook.md` (canary → 3×5 burst → poll-to-settle → completeness + Step 5 reclaim-vs-finalize race). PASS gates Card 3.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)").
