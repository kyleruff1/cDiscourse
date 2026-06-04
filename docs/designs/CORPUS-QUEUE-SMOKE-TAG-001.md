# CORPUS-QUEUE-SMOKE-TAG-001 — Smoke-tag prefix flag for the adversarial corpus runner

**Type:** dev-tooling (design-only doc; build phase is `scripts/bot-fixtures/**` + `__tests__/**` only)
**Status:** DESIGN — not implemented. No code, test, migration, or non-docs file is touched by this card's design phase.
**Verified-at-HEAD hash:** `37ccd9e`
**Auto-merge eligible (build phase):** yes (dev-tooling + tests; no §4 app/DB/Edge/provider surface).
**requiresMigration / requiresEdgeDeploy / requiresOperatorGateC:** false / false / false.

---

## Constitutional acceptance-gate invariant (stated verbatim)

> "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post."

This card does not move that line. Queue routing changes only **how** a stored argument's classifier fan-out is dispatched (synchronous auto-trigger vs. the ARCH-001 asynchronous Postgres queue). It never changes **whether** a post is accepted. The argument row is inserted by `submit-argument` and the function returns `201` before any dispatch decision is read (`submit-argument/index.ts:800-824`). This card only makes the *test-corpus runner* capable of producing debate titles that the smoke predicate already recognizes; it does not arm routing, flip any flag, or run any smoke.

---

## Scope

Add an opt-in capability to `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` so that, **when explicitly requested**, every debate title the runner creates is **prefixed** with the literal smoke tag `[arch-001-queue-smoke]`. The prefix makes each created room match the Edge routing predicate's `title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)` branch (`classifierQueueRouting.ts:173-174`), so a queue-routed corpus smoke can be run **by tag** rather than by percentage routing.

Concretely, the build phase will:
1. Add a `--smoke-tag` boolean CLI flag (and a `--queue-smoke-tag <literal>` valued variant for override), following the existing positional `parseArgs` loop pattern (`runXaiAdversarialBotCorpus.js:77-97`).
2. Add an env fallback honoring `CLASSIFIER_QUEUE_SMOKE_TAG` from the environment, mirroring the existing `process.env.*` fallback pattern in `envBooleans()` (`runXaiAdversarialBotCorpus.js:115-118`). The literal default stays `[arch-001-queue-smoke]`.
3. Prepend the resolved tag to `roomTitle` at **both** construction sites — the legacy path (`:456`) and the banked path (`:767`) — **outside** the `slice(0, 80)` so the title begins with the exact literal at position 0.
4. Add tests asserting that **every** created title `startsWith` the tag when the flag is set, **and** that **no** title carries the tag when the flag is unset (default off).

This is the **tooling prerequisite** for #479 (MCP-LIT-CORPUS-RUN), the run that would *consume* this tooling. CORPUS-QUEUE-SMOKE-TAG-001 produces smoke-taggable debates; #479 (separately, operator-gated) would run them once routing is armed by the operator.

## Non-goals

- Does **not** arm queue routing. `CLASSIFIER_QUEUE_ROUTING_ENABLED` is operator-set on the `submit-argument` Edge Function and is **not read by the runner** (`submit-argument/index.ts:811-812`; `classifierQueueRouting.ts:61`).
- Does **not** run the smoke, post live, or call any provider. The runner's live path is independently gated by `.env.engagement-intelligence` + `--pilot` (`runXaiAdversarialBotCorpus.js:128-137`); this card adds no new network path.
- Does **not** touch `classifierQueueRouting.ts`, `submit-argument`, or any Edge/DB code. The predicate is already correct; only the runner's title construction changes.
- Does **not** change the percentage-routing path (`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`). The whole point is to enable a deterministic *tag-based* smoke without touching the percentage dial.
- Does **not** flip any `productionEnabled` flag. H/I/J stay `productionEnabled:false` (`familyRegistry.ts:106/111/116`). Only A–G are enqueued by the queue path (`classifierQueueRouting.ts:228-255`); the runner does not change which families dispatch.
- Does **not** re-open, re-litigate, or resurrect #371/#373 (Deno-KV recorded-rejected; ARCH-001 Postgres async queue is the chosen path). This card is orthogonal to the capacity mechanism.

## Current production state

- **Smoke tag literal (the contract):** `CLASSIFIER_QUEUE_SMOKE_TAG = '[arch-001-queue-smoke]'` (`classifierQueueRouting.ts:51`). A dedicated, unambiguous prefix that cannot collide with `[smoke-test]`/`[stress]`/`[xai-adv …]` suffixes.
- **Routing predicate:** `shouldRouteToQueue(argument, debate, enabled, percentage=0)` returns `false` unless `enabled === true`; returns `false` on `debate_id` mismatch; **returns `true` when `title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)`**; otherwise falls to the percentage path (`pct<=0 → false`, `pct>=100 → true`, else `stableHashArgumentId(id)%100 < pct`) (`classifierQueueRouting.ts:160-184`, specifically the prefix match at `:173-174`).
- **Match method is a PREFIX:** the tag must be at the **start** of the title to route (`classifierQueueRouting.ts:173-174`). A suffix tag does not match.
- **Routing baseline is OFF:** `submit-argument/index.ts:811-816` reads `CLASSIFIER_QUEUE_ROUTING_ENABLED` via strict `=== 'true'` (unset = false) and `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` via `parseRoutingPercentage` (fail-closes to 0). The most recent corpus run (`d49e04cd`) ran with routing OFF (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:55-56`).
- **Runner does NOT prefix the tag today.** Both title sites place the claim summary at position 0 with `[runTag tNN]` as a **suffix**:
  - Legacy (`runXaiAdversarialBotCorpus.js:456`):
    ```js
    const roomTitle = `${(source.sourceClaimSummary || scene.title || '').slice(0, 80)} [${runTag} t${String(threadIndex).padStart(2, '0')}]`;
    ```
  - Banked (`runXaiAdversarialBotCorpus.js:767`):
    ```js
    const roomTitle = `${(seed.claimSummary || scene.title || '').slice(0, 80)} [${runTag} t${String(threadIndex).padStart(2, '0')}]`;
    ```
  A grep for `arch-001-queue-smoke` / `CLASSIFIER_QUEUE_SMOKE_TAG` / `smokeTag` across the runner returns **no matches** — so today no runner-created room can `startsWith('[arch-001-queue-smoke]')` (Phase 0 fact `runner_no_smoke_prefix_today`, `runXaiAdversarialBotCorpus.js:456,767`).
- **Existing flag-parse pattern** is a positional for-loop over `argv` (`i=2..`): valued flags use `else if (a === '--flag' && argv[i + 1]) args.x = String(argv[++i])`; booleans use `else if (a === '--flag') args.x = true` (`runXaiAdversarialBotCorpus.js:77-97`).
- **Existing env-fallback pattern** reads `.env.*` then overlays `process.env.*` (`runXaiAdversarialBotCorpus.js:108-118`).

## RCA / problem summary

A queue-routed corpus smoke needs debate titles the Edge predicate will route. The predicate routes only on `title.startsWith('[arch-001-queue-smoke]')` (`classifierQueueRouting.ts:173-174`). The runner builds both titles with the claim summary at position 0 and `[runTag tNN]` as a suffix (`:456`, `:767`), so **no runner-created room is smoke-taggable today** — the only alternative is the percentage dial, which is a coarser, non-deterministic, all-traffic lever the operator would rather not arm for a targeted smoke. The fix is purely mechanical: prepend the literal tag to `roomTitle` at both sites, gated behind an opt-in flag so normal runs are unaffected.

## Why this is or is not a ceiling/limit

This is **not** a ceiling. It is a small, deterministic capability addition in a test-only runner. There is no capacity, latency, or provider-concurrency dimension here. The capacity ceiling work (ARCH-001 Postgres async queue, superseding #371/#373) is orthogonal and explicitly out of scope. The only design subtlety — keeping the tag **outside** `slice(0, 80)` so `startsWith` sees the literal at position 0 — is a correctness requirement, not a limit.

## Architecture options considered

**Option A — prepend literal tag at both title sites, gated by an opt-in flag (CHOSEN).** Minimal diff, deterministic, default-off. The tag is concatenated *before* the existing `slice(0,80)` claim summary, so the predicate's `startsWith` sees the literal at position 0 and the 80-char budget is still applied only to the claim portion.

**Option B — re-slice the combined `tag + claim` to 80 chars.** Rejected: a ~24-char tag would consume the claim budget, and if the slice ever started before the tag's end the title would not `startsWith` the literal. The tag must be outside the slice (Phase 0 watch-out, `injection_point_for_corpus_smoke_tag_001`).

**Option C — percentage routing for the smoke instead.** Rejected by the card's purpose: percentage routing is non-deterministic, applies to all traffic, and arming it is an operator-gated production change. Tag-based smoke is deterministic and targeted.

**Option D — a shared `buildRoomTitle(...)` helper to dedupe the two sites.** Deferred. The two sites differ only in `source.sourceClaimSummary` vs. `seed.claimSummary`; extracting a helper is a reasonable refactor but enlarges the diff. The build phase may extract a tiny `prefixSmokeTag(title, tag, enabled)` helper used at both sites to guarantee the two paths cannot diverge (mirrors the §467/§468 lesson that twin code paths must stay in lockstep). This is left to the implementer; either inline or helper is acceptable as long as both sites are covered and tested.

## Chosen architecture

1. **CLI flags** (positional loop, `runXaiAdversarialBotCorpus.js:77-97` pattern):
   - `--smoke-tag` → boolean `args.smokeTag = true`.
   - `--queue-smoke-tag <literal>` → valued `args.queueSmokeTag = String(argv[++i])` (override; defaults to the contract literal). Supplying this implies `args.smokeTag = true`.
   - Default in the `args` object literal (`:62-76`): `smokeTag: false`, `queueSmokeTag: null`.
2. **Env fallback** (overlay pattern, `runXaiAdversarialBotCorpus.js:115-118`): if `process.env.CLASSIFIER_QUEUE_SMOKE_TAG` is a non-empty string, use it as the tag literal; an additional opt-in env (e.g. `CORPUS_SMOKE_TAG=true`) may enable the prefix without the CLI flag. The literal default remains `[arch-001-queue-smoke]`. **The runner must never read `CLASSIFIER_QUEUE_ROUTING_ENABLED`** — that flag belongs to the Edge function and arming it is an operator action.
3. **Resolution helper** (pure): `resolveSmokeTagPrefix(args, env)` → returns `''` when disabled, or `'<tag> '` (literal + single trailing space) when enabled. Default-off: if neither flag nor env opt-in is present, returns `''`.
4. **Injection at both sites** — outside `slice(0, 80)`:
   - Legacy (`:456`): `` `${PREFIX}${(source.sourceClaimSummary || scene.title || '').slice(0, 80)} [${runTag} t${NN}]` ``
   - Banked (`:767`): `` `${PREFIX}${(seed.claimSummary || scene.title || '').slice(0, 80)} [${runTag} t${NN}]` ``
   where `PREFIX = resolveSmokeTagPrefix(args, env)`. When `PREFIX === ''` the produced title is **byte-identical** to today's title — that is the default-off guarantee.

**Invariant:** the tag is concatenated before the sliced claim; the slice budget (80) applies to the claim only. With the prefix enabled, `roomTitle.startsWith('[arch-001-queue-smoke]')` is true at both sites; with it disabled, `roomTitle` is unchanged.

## Data model

Not relevant. No schema, no migration, no column. The debate `title` column already exists; this card only changes the string the runner writes into it.

## Worker/drainer model

Not relevant to this card. The runner does not touch the ARCH-001 drainer/enqueue path. For context only: when the operator separately arms `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, a smoke-tagged submit takes the `enqueueClassifierJobs` branch (one row per A–G family into `argument_machine_observation_runs`) instead of the synchronous `dispatchAutoTriggerForArgument` branch (`submit-argument/index.ts:800-824`; `classifierQueueRouting.ts:228-255`). This card does not arm that and does not change those code paths.

## Liveness and observability

- The runner already emits structured JSONL stage events (`StageJsonlStream`, `runXaiAdversarialBotCorpus.js:141-163`) and per-room summaries. The build phase should surface whether smoke-tagging was active for the run — e.g. include `smokeTagApplied: boolean` (and the resolved tag literal) on the run-level summary event so a downstream reviewer can confirm the run was smoke-taggable. No raw secrets are involved; the tag is a public literal.
- No new provider call, no new network path, no new DB write beyond the existing `debates.insert` (which already runs only on the live `--pilot` path).

## Cutover and rollback path

- **Cutover:** none required at the platform level. This is a dev-tooling capability. Merging the build PR adds the flag; nothing changes for existing runs (default off).
- **Rollback:** revert the build PR. Because the default-off path produces byte-identical titles, there is no behavioral drift for any existing run-kind.
- **Operator note (out of scope for this card):** running an actual queue-routed smoke additionally requires the operator to arm `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` on `submit-argument` and disarm it afterward (per the routing runbook). That is #479's concern, not this card's.

## Smoke plan

This card ships **tooling**, so its "smoke" is the test suite plus a dry-run shape check (no live posting):

1. **Unit (default-off):** run the title builder for both legacy and banked scenes with the flag unset; assert no title `startsWith('[arch-001-queue-smoke]')` and that each title is byte-identical to the pre-change output (golden-string equality on a fixture scene).
2. **Unit (flag-on):** run both builders with `--smoke-tag`; assert **every** title `startsWith('[arch-001-queue-smoke]')` and that the claim-summary slice still applies (tag is outside the 80-char budget).
3. **Env-fallback:** with the CLI flag unset but the env opt-in set, assert the tag is applied; with both unset, assert it is not.
4. **Override:** with `--queue-smoke-tag '[arch-001-queue-smoke]'`, assert the literal matches the Edge contract exactly (guards against a typo'd override silently failing the `startsWith` predicate).
5. **Dry-run shape:** `node scripts/bot-fixtures/runXaiAdversarialBotCorpus.js --dry --smoke-tag --scenarios 2` produces JSONL with `smokeTagApplied: true` and no live post (dry path makes no network call). Capture `; echo "EXIT: $?"` to confirm exit 0.

No live corpus run, no provider call, no flag arming in this card.

## Open questions

1. **Flag-name bikeshed:** `--smoke-tag` (boolean) + `--queue-smoke-tag <literal>` (valued override) vs. a single valued `--smoke-tag <literal>`. Recommendation: keep the boolean for the common case (default literal) plus a valued override, but the implementer may collapse to one valued flag if simpler. Either satisfies the acceptance test.
2. **Env opt-in name:** the tag literal is supplied via `CLASSIFIER_QUEUE_SMOKE_TAG`; the *enable* env (if any) needs a name that cannot be confused with the Edge `CLASSIFIER_QUEUE_ROUTING_ENABLED`. Proposed `CORPUS_SMOKE_TAG=true`. Confirm at build time.
3. **Helper vs. inline (Option D):** extract `prefixSmokeTag`/`buildRoomTitle` shared by both sites, or inline at both. Recommendation: a tiny shared resolver to prevent the two title paths from diverging (the §467/§468 twin-divergence lesson), but inline-at-both with a test covering both is acceptable.
4. **Run-level surfacing:** confirm the exact event/field name for `smokeTagApplied` against the existing summary event shape so the reviewer can verify the run was smoke-taggable.

## Stage gates before implementation

- **Phase 0 → DESIGN (this doc):** complete. All state claims carry `file:line` or Phase 0 fact-key citations.
- **GATE A (design approval):** required before any code is written.
- **IMPLEMENT:** `scripts/bot-fixtures/**` + `__tests__/**` only. No `app/`, `src/`, `supabase/`, no provider call.
- **GATE B (self-verify):** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0; new test count captured from the `Test Suites/Tests` line with explicit exit code.
- **REVIEW:** reviewer re-runs the suite and confirms both default-off byte-equality and flag-on `startsWith`.
- **GATE C:** not required — no migration, no Edge deploy, no operator-only merge surface. Auto-merge eligible once green.

## Commit-slice plan

1. **Slice 1 — flag + env + resolver (no behavior change yet):** add `--smoke-tag` / `--queue-smoke-tag` to `parseArgs`, the env overlay, and `resolveSmokeTagPrefix(args, env)`. Wire it but leave both title sites unchanged; resolver is pure and unit-tested in isolation.
2. **Slice 2 — inject at both title sites:** prepend `PREFIX` at `:456` and `:767` outside `slice(0,80)`; add `smokeTagApplied` to the run summary event.
3. **Slice 3 — tests:** default-off byte-equality, flag-on `startsWith` at both sites, env-fallback, override-literal-matches-contract, dry-run shape.

(The implementer may merge slices 1–2 if the diff stays small; tests in slice 3 are mandatory in the same PR.)

## Test-count forecast

Baseline: **630 suites / 19263 passing / 1 skipped / 19264 total** on `main` (test-discipline skill baseline). This card projects **+8 to +14 tests** in one new suite (e.g. `__tests__/bot-fixtures/corpusSmokeTagPrefix.test.ts`), covering: default-off byte-equality (legacy + banked = 2), flag-on `startsWith` (legacy + banked = 2), env-fallback on/off (2), override literal matches the Edge contract (1), tag-outside-slice budget preserved (1), and a dry-run `smokeTagApplied` shape assertion (1+). Test count goes **up**; no test is removed or skipped.

## HALT ceiling

HALT and surface for operator decision if any of the following is true during build:
- The change would require editing `classifierQueueRouting.ts`, `submit-argument`, any Edge/DB code, or any file outside `scripts/bot-fixtures/**` + `__tests__/**`.
- The change would read or write `CLASSIFIER_QUEUE_ROUTING_ENABLED` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` from the runner, or otherwise arm routing.
- The default-off path is not byte-identical to today's titles (the no-silent-smoke-tagging guarantee fails).
- Any `productionEnabled` flag for H/I/J would change (frozen set: must stay `false`).
- The override literal could diverge from `[arch-001-queue-smoke]` without a test catching it.

## Current-status manifest stub

- **MODIFIED:** `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` (flag parse `:77-97`; env overlay `:108-118`; `roomTitle` at `:456` and `:767`; run-summary event gains `smokeTagApplied`).
- **NEW:** `__tests__/bot-fixtures/corpusSmokeTagPrefix.test.ts` (or co-located equivalent); optionally a tiny `resolveSmokeTagPrefix`/`buildRoomTitle` helper module under `scripts/bot-fixtures/`.
- **BYTE-EQUAL preserved:** all titles when the flag/env opt-in is absent (default-off guarantee); `classifierQueueRouting.ts`, `submit-argument/index.ts`, `familyRegistry.ts`, every Edge/DB file — untouched.
- **Test deltas:** +8 to +14 tests, +1 suite; none removed or skipped.
- **Operator follow-up:** running an actual queue-routed smoke (#479 MCP-LIT-CORPUS-RUN) additionally requires the operator to arm `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` on `submit-argument` and disarm afterward — **not** part of this card.
- **Discipline line:** design-only doc; no code/test/migration written in this phase; no secret printed; H/I/J `productionEnabled` stays `false`; #371/#373 not re-litigated; every state claim carries a `file:line` or Phase 0 fact-key citation.

## Required-reading manifest for the later build phase

- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:61-98` — `parseArgs` flag loop + `args` defaults (pattern to follow).
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:104-126` — env overlay pattern (`.env.*` then `process.env.*`).
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:448-469` — legacy title site (`:456`) + the `debates.insert`.
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:758-779` — banked title site (`:767`) + the `debates.insert`.
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js:141-163` — `StageJsonlStream` (where to surface `smokeTagApplied`).
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:51` — `CLASSIFIER_QUEUE_SMOKE_TAG` literal (the contract; do NOT edit).
- `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts:160-184` — `shouldRouteToQueue` predicate, prefix match at `:173-174` (read-only context; do NOT edit).
- `supabase/functions/submit-argument/index.ts:800-824` — the enqueue-vs-direct dispatch fork (read-only context; confirms the acceptance gate is unchanged; do NOT edit).
- Skill(cdiscourse-doctrine) §1 (no truth labels) · §3 (popularity-not-evidence) · §4 (AI moderator advisory-only) · §4-C (never-self-approve / family-registry flip forbidden) · §4-T (no bar lowering) · §5 (engine.ts sole gate) · §6 (secrets) · §7 (no AI from production app) · §8 (soft-delete + append-only + RLS) · §9 (plain-language) · §10a (Observations vs Allegations).
- Skill(test-discipline) — baseline 630 suites / 19263 passing / 1 skipped / 19264 total; tests are part of "done".
- `docs/core/pipeline-governance-contract.md` §2 (stage machine) · §4 (never-self-approve) · §5 (merge=deploy applies to `supabase/functions/**` + `supabase/migrations/**`, neither of which this card touches).
- Cross-reference: **#479 MCP-LIT-CORPUS-RUN** is the consuming run; CORPUS-QUEUE-SMOKE-TAG-001 is its tooling prerequisite.

---

### Doctrine self-attestation (design phase)

Design-only. No secret value printed. Frozen set untouched (H/I/J `productionEnabled:false`). #371/#373 not re-opened or re-litigated. The acceptance-gate invariant is stated verbatim and respected: queue routing changes only how a stored argument's classifier fan-out dispatches, never whether the post is accepted. Every state claim above carries a `file:line` or Phase 0 fact-key citation.
