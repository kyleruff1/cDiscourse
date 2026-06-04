# CORPUS-QUEUE-SMOKE-TAG-001 — Review (GATE C)

**Verdict:** **APPROVE**
**Reviewer agent run:** 2026-06-04
**Branch:** `feat/corpus-queue-smoke-tag-001`
**Design:** `docs/designs/CORPUS-QUEUE-SMOKE-TAG-001.md`
**Issue:** #484
**Top commits reviewed:** `34ac4ed` (tests) · `75afcba` (feat) on base `3ffd720`

---

## Executive summary

This card adds an opt-in `--smoke-tag` / `--queue-smoke-tag <literal>` capability to the
adversarial corpus runner (`scripts/bot-fixtures/runXaiAdversarialBotCorpus.js`) so that,
when explicitly requested, every synthetic debate title is **prefixed** with the Edge
routing contract literal `[arch-001-queue-smoke]`. The prefix is applied OUTSIDE the
`slice(0,80)` claim budget at both live title sites via a single shared `buildRoomTitle`
helper, so the produced title `startsWith` the literal at position 0 and the Edge predicate
`title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)` (`classifierQueueRouting.ts:174`) matches.
Default OFF is byte-identical to today's titles, proven by golden-string equality at both
sites. The diff is strictly bounded to `scripts/bot-fixtures/**` + `__tests__/**` +
`docs/core/current-status.md`; it touches no Edge/DB/src code, never reads
`CLASSIFIER_QUEUE_ROUTING_ENABLED`, arms nothing, and adds no provider/network path.
typecheck=0, lint=0, full suite green modulo the single pre-flagged FX-10 condition (an
untracked operator deliverable absent from `origin/main`, unrelated to this card and
correctly untouched). Approve; auto-merge eligible per design §"Stage gates" (GATE C not
required — no migration, no Edge deploy).

---

## Verification

| Gate | Result |
|---|---|
| typecheck | **pass** (`tsc --noEmit`, exit 0) |
| lint | **pass** (`eslint . --ext .ts,.tsx --max-warnings 0`, exit 0 — whole-tree recurse clean, no stray scratch `.ts`) |
| test (full suite) | **630 of 631 suites pass**; `Tests: 1 failed, 1 skipped, 19280 passed, 19282 total`; exit 1 **solely** from the pre-flagged FX-10 |
| new suite | `__tests__/corpusSmokeTagPrefix.test.ts` — **18 passed / 18 total**, exit 0 |
| test delta vs baseline | 630 → 631 suites (+1); 19263 → 19280 passing (+17 net¹); +18 in the new suite |
| secret scan | **clean** (no key/JWT/Bearer/.env value in diff) |
| doctrine scan | **clean** (no winner/loser/liar/dishonest/bad-faith/etc. in diff) |
| skip scan | **clean** (no `.skip`/`.only`/`xit`/`xdescribe` in the new test file) |
| Migration apply | **n/a** — diff touches no `supabase/migrations/**` |

¹ The forecast was +8 to +14; the implementer delivered +18 in one suite. Test count goes
UP; nothing removed or skipped — compliant with test-discipline and design §"Test-count forecast".

---

## Per-check findings (design §5 adversarial checks 1–6 + secrets + skip + green-gate)

### 1. Default-off integrity — PASS
`resolveSmokeTagPrefix` returns `''` when disabled: `runXaiAdversarialBotCorpus.js:143-153`
(`if (!enabled) return ''`). The test constructs the pre-change golden string the old way
(`goldenLegacyTitle`, `corpusSmokeTagPrefix.test.ts:72-74`) and asserts byte-equality at BOTH
sites:
- legacy shape: `corpusSmokeTagPrefix.test.ts:181-186` (`expect(title).toBe(goldenLegacyTitle(...))` + `startsWith(tag) === false`).
- banked shape: `corpusSmokeTagPrefix.test.ts:188-194`.
Plus a delta-isolation test proving on-vs-off differ ONLY by the leading tag prefix
(`:217-231`, `expect(onTitle).toBe(\`${EDGE_CONTRACT_TAG} ${offTitle}\`)`).

### 2. Predicate match — PASS
The prefix is concatenated BEFORE the sliced claim in the shared helper:
`buildRoomTitle` = `` `${prefix}${claim.slice(0,80)} [${runTag} t${nn}]` `` (`:164-168`), so the
tag sits at position 0, OUTSIDE the slice. Both live sites use it with
`resolveSmokeTagPrefix(args)`: legacy `:528-534`, banked `:848-854` — no third title
construction exists (`grep roomTitle\\s*= → only :529, :849`). The test replicates the
`startsWith` predicate from `classifierQueueRouting.ts:174` exactly: `:196-202`
(`expect(title.startsWith(EDGE_CONTRACT_TAG)).toBe(true)`), plus per-shape flag-on
assertions at `:162-166` (legacy) and `:168-179` (banked).

### 3. Tag-literal drift — PASS
Runner-local const `CORPUS_SMOKE_TAG_DEFAULT = '[arch-001-queue-smoke]'`
(`runXaiAdversarialBotCorpus.js:135`). Edge contract const
`CLASSIFIER_QUEUE_SMOKE_TAG = '[arch-001-queue-smoke]'`
(`classifierQueueRouting.ts:51`) — read and confirmed identical. The drift guard exists in
two layers: (a) runner literal === an independent in-test literal (`:83-87`); (b) an `fs`
read of the actual Edge file that regex-extracts the const and asserts equality
(`:89-100`), so neither side can silently drift. Either side changing without the other
fails the suite.

### 4. Title-length survival — PASS
`public.debates.title` is declared `text NOT NULL` with **no length cap and no CHECK
constraint** (`supabase/migrations/20260516000001_initial_schema.sql:141`). The only
title-length constraint in the migration set is on `room_notifications.room_title`
(`20260524000014_qol_040_room_notifications.sql:123`), an unrelated table. The slice(0,80)
applies to the claim only; the tag is never truncated, asserted at `:204-215` (claim portion
capped at 80, tag at position 0 untruncated). The prefixed title survives uncut into the
column, so `startsWith` still matches downstream.

### 5. Boundary (load-bearing) — PASS
`git diff main --name-only` touches ONLY: `__tests__/corpusSmokeTagPrefix.test.ts`,
`docs/core/current-status.md`, `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js`. A
targeted name-only filter on `supabase/** src/** app/** **/familyRegistry.ts
supabase/migrations/** supabase/functions/**` returns **empty** — no forbidden surface
touched. The runner does NOT read `CLASSIFIER_QUEUE_ROUTING_ENABLED` /
`CLASSIFIER_QUEUE_ROUTING_PERCENTAGE`: the only two occurrences of that name in the runner
(`:80`, `:129`) are comment lines stating the runner never reads it; a full-file grep finds
no `process.env.CLASSIFIER_QUEUE_ROUTING_*` read. The only env reads added are
`e.CORPUS_SMOKE_TAG` (enable, `:144`) and `e.CLASSIFIER_QUEUE_SMOKE_TAG` (tag literal,
`:149-150`). No `productionEnabled` flip (the two `productionEnabled` hits in the diff are
pre-existing current-status.md narrative context, not added code). No provider/network path
added — diff grep for `fetch(` / `https?://` / `api.x.ai` / `api.anthropic` on the runner
returns empty.

### 6. Acceptance-gate invariant — PASS
Nothing here can block/route/delay a real user post; it changes only synthetic-corpus debate
titles in a dev script. The diff adds no submission-path code and no Edge code (check 5).
The invariant is stated verbatim in the design (`CORPUS-QUEUE-SMOKE-TAG-001.md:13`) and in
the implementer's current-status entry ("AI/MCP classifiers MUST NEVER be the submission
acceptance gate; src/lib/constitution/engine.ts is the sole gate; classifiers run after an
argument is stored; no path may block/reject/route/delay an ordinary user post"). The runner
resolver carries the same statement inline (`:128-133`).

### Secrets (§6) — PASS
Diff secret scan (`ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SERVICE_ROLE|sb_secret_|sk-ant-|xai-|Bearer|Authorization:|eyJ…`)
returns clean. The smoke tag `[arch-001-queue-smoke]` is a public literal — fine.

### Skip-scan (§4-T) — PASS
`.skip` / `.only` / `xit` / `xdescribe` grep on the new test file: zero matches.

### Green-gate — PASS (modulo the one pre-flagged condition; see below)
New `corpusSmokeTagPrefix` suite green (18/18). No other suite and no new test from this card
fails. The single full-suite failure is exclusively the pre-flagged FX-10.

---

## FX-10 pre-existing-condition note (confirmed unrelated)

The full suite reports exactly one failing suite:
`__tests__/mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` → `FX-10 — corpus file exists (operator
deliverable)`, which asserts `fs.existsSync('docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md')`.

Confirmed this is the pre-flagged main-is-red-in-clean-checkout condition, NOT this card:
- The file **does not exist in `origin/main`**: `git cat-file -e
  origin/main:docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` → `fatal: path … does
  not exist in 'origin/main'`.
- The file is **absent on disk** in this fresh worktree (so the assertion fails here),
  whereas the documented baseline ran in the operator's local-main working copy where the
  untracked artifact is present — which is why the baseline counted it passing.
- This card's diff touched **neither** that test nor that file
  (`git diff main..HEAD --name-only` excludes both).

The implementer correctly did NOT modify the failing guard or the absent deliverable
(§4-A: never modify a failing guard to make CI pass; §4-T: never lower a bar). The card's
gate is therefore green-modulo-this-known-condition.

---

## Doctrine self-check

- [x] No truth/winner/loser language anywhere in the diff (§1) — scan clean.
- [x] Score never blocks posting; acceptance gate unchanged (§1/§5) — diff adds no submission-path or Edge code; invariant stated verbatim.
- [x] No service-role in client code (§6) — n/a; no client/Edge code touched; scan clean.
- [x] No direct insert into `public.arguments` (§8) — the runner's existing `debates.insert` is unchanged in shape (only the title string differs).
- [x] No AI calls in production app paths (§7) — change is in `scripts/bot-fixtures/` only; no new provider/network path; live path still operator-gated by `.env.engagement-intelligence` + `--pilot`.
- [x] Plain language / no raw codes leaked to UI (§9) — n/a; the tag is an internal dev-script room-title prefix, not a user-facing string; H/I/J `productionEnabled:false` untouched (§4-C).
- [x] Epic-specific: ARCH-001 queue-routing contract — runner-local literal is drift-guarded against `classifierQueueRouting.ts:51`; runner never arms routing; percentage dial untouched; #371/#373 not re-litigated.

---

## Test coverage

- [x] New public functions have unit tests — `resolveSmokeTagPrefix` (8 cases incl. default-off, flag-on, env on/off, override precedence, env-literal override, does-not-read-routing-enable) + `buildRoomTitle` (7 cases) + exports/drift (3 cases).
- [x] Default-off byte-equality asserted at both legacy and banked shapes.
- [x] Flag-on `startsWith` asserted at both shapes + the predicate replication.
- [x] Edge cases from design §"Smoke plan" covered: env-fallback, override-matches-contract, tag-outside-slice budget.
- [x] No accessibility assertions needed (non-UI dev-tooling card).

---

## Blockers

None.

## Suggestions (non-blocking)

1. The design §"Smoke plan" item 5 mentions a dry-run shape check
   (`node … --dry --smoke-tag --scenarios 2` emitting `smokeTagApplied: true`). The
   implementer surfaced `smokeTagApplied` + `resolvedSmokeTag` on the `run_summary` event
   (`:1925-1934`) and unit-tested the resolver feeding it, but did not add an end-to-end
   dry-run JSONL assertion. The unit coverage of the resolver + helper is sufficient for
   correctness; an integration dry-run shape test is a nice-to-have a follow-up could add.
   Not blocking.

## Operator next steps

- Push the branch: `git push -u origin feat/corpus-queue-smoke-tag-001`
- Open PR: `gh pr create --title "CORPUS-QUEUE-SMOKE-TAG-001: --smoke-tag prefix for the adversarial corpus runner" --body-file docs/reviews/CORPUS-QUEUE-SMOKE-TAG-001.md`
- Deploy steps: **none** — no migration, no Edge deploy (design §"Cutover and rollback path"). Auto-merge eligible once green.
- Operator follow-up (OUT OF SCOPE for this card): running an actual queue-routed corpus smoke (#479 MCP-LIT-CORPUS-RUN) additionally requires the operator to arm `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` on `submit-argument` and disarm it afterward.
- Post-merge worktree cleanup per `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)".

---

**Boundary attestation:** No code modified. No push. No PR opened. No merge.
