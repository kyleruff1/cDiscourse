# RESEED-001 — Repeatable reseeder harness (args.me → submit-argument)

**Status:** Design draft
**Epic:** Dev-tooling / bot-fixtures (sibling of Stage 6.1.5 AI-driven corpus, Stage 6.1.7 xAI thread corpus, CORPUS-30 pool-driven planner)
**Release:** Internal (pre-launch test-content seeding; not a shipped app surface)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/862

---

## Goal (one paragraph)

Build a repeatable, operator-driven **reseeder harness** that materializes realistic debate rooms — debates, argument trees, and adversarial maneuvers — from the free **args.me** debate library (Webis corpus, CC-BY 4.0), posting every move through the existing `submit-argument` Edge Function under bot JWT auth. The harness is **bank-first** (fetch → gitignored source bank JSONL → plan → render → post → report), deterministic by default (`--no-provider` renders from bank premises with zero model spend and 100% validator pass because every template is engine-valid **by construction**), and Sonnet-tunable behind an operator gate (validator-aware prompt, one retry, deterministic fallback, fallback-reason histogram). It is dev-tooling only: `scripts/reseeder/**` + `__tests__/**` + this design doc + a parent-level operating skill. It respects every doctrine constraint that governs bot fixtures: **the engine is the sole acceptance gate** (engine-rejected seeds are logged signal, never failures); **no direct insert into `public.arguments`** and **no service-role in the posting path** (posts go through `submit-argument` with the allowed-keys-only `buildSubmitArgumentBody` fence); **no truth/winner labels, no popularity-as-evidence**; and **the license is respected** — raw scraped source URLs and attribution live only in the gitignored `logs/reseeder/` bank, never in committed files, enforced by a leak-scan test.

This card does **not** clear the database (a later red-gate card owns that), touch app UI, deploy anything, or add a migration. It reuses the additive `public.debates.run_tag` column that already exists (CORPUS-30-RUNTAG-PERSIST).

---

## Data model

**No new SQL / no migration.** The harness only writes rows the existing app already writes: `public.debates` (via authenticated bot client — allowed), `public.debate_participants` (via authenticated bot client — allowed), and `public.arguments` (**only** via `submit-argument`, never a direct insert). The additive `debates.run_tag` column (already present, populated by `runAiDrivenCorpus.js`) carries the parseable run identifier.

New in-memory / on-disk **JSONL** shapes (pure-TS/JS types, no DB):

### 1. Source-bank record (gitignored `logs/reseeder/<runId>-source-bank.jsonl`)
The only place raw source URLs + attribution ever land.

```ts
interface ReseedSourceRecord {
  bankName: string;          // deterministic dedupe key, e.g. "school-uniforms::debateorg::0007"
  topic: string;             // args.me `conclusion` (the claim/thesis material)
  stance: 'PRO' | 'CON' | 'UNKNOWN';
  premise: string;           // args.me `premises[].text` — the body material
  conclusion: string;        // args.me `conclusion` verbatim
  sourceUrl: string | null;  // args.me source/context URL — GITIGNORED ONLY
  license: 'CC-BY-4.0';      // constant; attribution obligation marker
  sourceId: string;          // args.me `id` — GITIGNORED ONLY
  fetchedAt: string;         // ISO
  ingestMode: 'args_me_live' | 'offline_dump';
}
```

### 2. Move-event record (gitignored `logs/reseeder/<runId>-reseed.jsonl`)
Full attribution field set, non-zero from move 1. Event `stage` values mirror the CORPUS-30 vocabulary so the reporter twin can consume them: `seed_assignment`, `bot_assignment`, `move_planned`, `move_rendered`, `move_validated`, `move_body_sample`, `move_posted`, `room_created`, `run_summary`.

```ts
interface ReseedMoveEvent {
  stage: string;
  runId: string;
  pack: ReseedPackName;
  scenarioId: string;
  roomId: string | null;      // null in dry
  seedId: string;             // bankName of the seed that opened the thread
  threadIndex: number;
  moveIndex: number;
  moveId: string;
  spineId: string;            // maneuver spine, e.g. "objection-led"
  voiceId: string;            // rotated per thread (see planner)
  bankName: string;           // source record this body derives from
  optionIndex: number;        // which template option within the bank was chosen
  argumentType: ArgumentType;
  source: 'deterministic_template' | 'sonnet' | 'deterministic_fallback' | 'seed';
  issues: string[];           // validator issues (prefix-bucketed in histogram)
  seed: boolean;              // true for the root/opening move (excluded from fallback %)
  postStatus?: string;        // 'posted' | `failed_${n}` | 'skipped_missing_parent'
  engineValid: boolean;       // pure-TS engine pre-check verdict at plan time
  tokenSetHash?: string;      // samey-move fingerprint (move_body_sample)
  tokenHashes?: string[];     // samey-move fingerprint (move_body_sample)
}
```

**No `ReseedSourceRecord.sourceUrl` / `.sourceId` field is ever written into `docs/**` or any committed file.** The committed Markdown report carries counts + attribution-presence bands only.

---

## File changes

All new files. No modified production files. No deleted files.

### New — `scripts/reseeder/argsMeSourceFetcher.js` (~220 lines)
Query args.me → normalize → append to gitignored source bank. Purpose: the ONLY component that touches the network for source material (offline path bypasses it).
- Composes with: nothing in the reuse map (new leaf); writes the bank that the planner reads.

### New — `scripts/reseeder/reseedNormalizer.js` (~90 lines)
Pure normalizer `{ id, conclusion, premises[], stance, sourceUrl } → ReseedSourceRecord[]`. Shared by both the live fetcher and the offline-dump ingester (so both paths produce byte-identical bank shapes).
- Composes with: `argsMeSourceFetcher` (live) + `reseedOfflineIngest` (dump).

### New — `scripts/reseeder/reseedOfflineIngest.js` (~70 lines)
Ingest a downloaded Webis/DebateSum dump file through `reseedNormalizer`. Purpose: the bank-first fallback when args.me is unreachable.

### New — `scripts/reseeder/reseedEnginePrecheck.js` (~110 lines)
Pure-TS→CJS shim that imports the **client-safe** engine (`src/domain/constitution`) and answers "would `submit-argument` accept this planned move?" for every template BEFORE it is emitted. Purpose: guarantees `--no-provider` validator pass = 100%.
- Composes with: `src/domain/constitution/evaluateArgumentDraft` + `railsChecks` + `constitution.v1` (imported, read-only).

### New — `scripts/reseeder/reseedPackPlanner.js` (~320 lines)
Deterministic planner for the 6 named packs. Purpose: turns bank records into an engine-valid move plan (thread structure, voice/spine rotation, maneuver grammar).
- Composes with: `reseedEnginePrecheck` (every emitted move passes), `stressScenarioTemplates.pickTargetExcerpt` (reused verbatim for responsiveness), `reseedPacks` (spec table).

### New — `scripts/reseeder/reseedPacks.js` (~140 lines)
The 6 pack specs as data (`baseline`, `deep-thread`, `wide-room`, `evidence-heavy`, `archive-cluster`, `resolution-arc`) — depth/breadth/spine caps + the archive-cluster near-verbatim knob.

### New — `scripts/reseeder/reseedJaccard.js` (~40 lines)
Pure token-set Jaccard + the reused `NEAR_VERBATIM_THRESHOLD = 0.60` constant. Purpose: the `archive-cluster` pack builds sibling bodies whose pairwise Jaccard ≥ 0.60 so the existing samey-move detector (`xaiAdversarialReport.sameyJaccardSets`, `SAMEY_MOVE_HIGH_PAIR_THRESHOLD = 0.60`) fires end-to-end. Threshold is a named constant re-exported from the located source value; a test pins twin-equality with `xaiAdversarialReport`.

### New — `scripts/reseeder/reseedMoveRenderer.js` (~190 lines)
`--no-provider` deterministic template renderer (default) + `--provider sonnet` validator-aware renderer with one retry + deterministic fallback + fallback-reason histogram emission.
- Composes with: `claudeMessagesClient` (reused gated client for the sonnet path), `reseedEnginePrecheck` (re-validates the sonnet body; falls back on failure).

### New — `scripts/reseeder/runReseeder.js` (~340 lines)
Orchestrator + poster + reporter entry. Purpose: fetch/plan/render/post loop + JSONL + committed Markdown.
- Composes with: `loadEnv` (`loadEnvFiles`/`buildBotConfig`), `supabaseClient` (`createBotClient`/`signInBot`), `adminOps` (`ensureBotUser`), `submitMove` (`buildSubmitArgumentBody`/`invokeSubmitArgument`), `personaMapping` (`mapPersonaSideToParticipantSide`), `writeRunLog` (JSONL), `reseedReport`.

### New — `scripts/reseeder/reseedReport.js` (~260 lines)
Markdown reporter mirroring the §9 attribution-presence pattern (`severityBand: 'n/a'` on absent/insufficient data; never green-by-absence). Adds an **engine-rejection count** section.
- Composes with: `reseedJaccard` (near-verbatim cluster band), the CORPUS-30 diversity-check shape (`repeated-option`, `spine-saturation`, `voice-distribution`, `samey-move`).

### New — `scripts/reseeder/redactor.js` (~80 lines)
Sanitizer applied to any string bound for a committed file / the Markdown report. Strips raw args.me source URLs (`args.me`, `debate.org`, `idebate.org` hosts + bare), `sk-ant-*`, `sb_secret_*`, JWT-shape, `Bearer`, `Authorization`, emails. Purpose: license + secrets leak fence at the report boundary.

### New — parent skill `C:/Users/kyler/cdiscourse/.claude/skills/cdiscourse-reseeder/SKILL.md`
Operating procedure for a cache-cold session. (Parent-level, outside the repo.)

### New — tests (see Test plan): 11 files under `__tests__/`.

### Modified — `package.json` (scripts block only): 3 new npm scripts.

**Line-count estimate for the code deliverable:** ~2,300 lines of JS + ~1,400 lines of tests.

---

## API / interface contracts

### `argsMeSourceFetcher.js`
```ts
async function fetchArgsMeTopic(opts: {
  query: string; pageSize: number; fetchImpl?: typeof fetch;
}): Promise<{ records: ReseedSourceRecord[]; parseMode: 'json' | 'xml_fallback' }>;

async function populateSourceBank(opts: {
  topics: string[]; perTopic: number; bankPath: string; runId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ written: number; bankPath: string; parseModes: Record<string, number> }>;
```
Content negotiation: request header `Accept: application/json`. If the response `content-type` is not JSON (args.me defaults to xpath-functions XML on a bare GET — confirmed: a bare fetch returns HTML/XML, not JSON), parse the XML/`arguments` map through the same field extraction and set `parseMode = 'xml_fallback'`. `fetchImpl` is injectable so tests never hit the network.

### `reseedNormalizer.js`
```ts
function normalizeArgsMeArgument(raw: unknown, ctx: { fetchedAt: string; ingestMode: string }):
  ReseedSourceRecord | null;    // null on malformed/empty premise
function normalizeArgsMeBatch(raws: unknown[], ctx): ReseedSourceRecord[];
```

### `reseedEnginePrecheck.js`
```ts
interface PlannedMove {
  argumentType: ArgumentType;
  parentType: ArgumentType | null;   // null = root
  body: string;
  targetExcerpt: string | null;
  parentBody: string | null;
  selectedTagCodes: string[];
  attachedEvidence: { url?: string; sourceText?: string }[];
  resolution: string;
}
function isEngineValidMove(move: PlannedMove): { valid: boolean; blockingCodes: string[] };
```
Implementation: builds the `ArgumentDraftEvaluationInput` from `constitution.v1` (`constitutionRules`, `tagDefinitions`, `flagDefinitions`, `constitutionVersion`) and returns `evaluateArgumentDraft(input).allowPost` plus the blocking `ruleCode`s. `valid === allowPost`. This is the SAME code `submit-argument` runs (`_shared/constitution` is a copy of `src/domain/constitution`), so a move that passes the pre-check passes the Edge Function.

### `reseedPackPlanner.js`
```ts
type ReseedPackName = 'baseline' | 'deep-thread' | 'wide-room'
  | 'evidence-heavy' | 'archive-cluster' | 'resolution-arc';

function planPack(opts: {
  pack: ReseedPackName; count: number; seed: string; runId: string;
  bank: ReseedSourceRecord[];
}): {
  scenarios: ReseedScenario[];     // each: { scenarioId, seedId, resolution, personas[], moves[] }
  rejectedTemplates: number;       // count of pre-check rejections (should be 0)
};
```
Determinism: all randomness comes from `seededRng(hash(runId + '::' + seed + '::' + scenarioId + '::' + moveIndex))` (reusing `stressScenarioTemplates.seededRng`, a Mulberry32). **No `Date.now()`, no `Math.random()`** anywhere in the planner or renderer. Voice rotation: `voiceId = VOICES[hash(runId + seed + threadIndex) % VOICES.length]` — **rotated per thread**, not per account (the 3-bot pool stays fixed; the voice a bot uses changes thread to thread).

### `reseedMoveRenderer.js`
```ts
function renderNoProvider(move: PlannedMove, seedRecord: ReseedSourceRecord, rng): {
  body: string; source: 'deterministic_template'; optionIndex: number;
};
async function renderSonnet(opts: {
  client; move: PlannedMove; seedRecord; rng; maxRetries: 1;
}): Promise<{ body: string; source: 'sonnet' | 'deterministic_fallback'; attempts: number; issues: string[] }>;
```

### `runReseeder.js`
```ts
function parseArgs(argv): {
  dry: boolean; pilot: boolean; pack: ReseedPackName; count: number; seed: string;
  provider: 'none' | 'sonnet'; topics: string[] | null; offlineDump: string | null;
  writeJsonl: boolean; writeMarkdown: boolean;
};
function buildReseedRunTag(pack, dateYyyymmdd, hash8): string; // `reseed-<pack>-<yyyymmdd>-<hash8>`
function buildRoomTitle(seedTitle, runTag): string;            // `${seedTitle} [${runTag}]`
```
`--no-provider` (i.e. `provider === 'none'`) is the DEFAULT. `--provider sonnet` requires `--pilot` + the Anthropic env gate (identical to `runAiDrivenCorpus`). Live posting requires `--pilot` + `.env.bot-tests`.

### `reseedReport.js`
```ts
function buildReseedMarkdown(opts: {
  runId; dateIso; mode: 'dry' | 'live'; pack; events: ReseedMoveEvent[]; args;
}): string;
function reseedDiversityChecks(events): {  // n/a on absent/insufficient, never false-green
  duplicateSeed; voiceDistribution; spineSaturation; nearVerbatimCluster; sameyMove; engineRejection;
};
```

### Parent skill contract (frontmatter)
```yaml
name: cdiscourse-reseeder
description: Manual-only CDiscourse dev/test reseeder harness operating procedure ...
disable-model-invocation: true
user-invocable: true
effort: high
```

---

## Edge cases

- **args.me returns XML/HTML on a bare GET (default behavior).** → `Accept: application/json` header; on non-JSON `content-type`, XML-fallback parse. Confirmed live: a bare fetch of `https://www.args.me/api/v2/arguments?query=...` returns rendered HTML with BM25 metadata, not JSON.
- **args.me unreachable / non-2xx / network error.** → fetcher returns `{ records: [], parseMode }`; orchestrator falls back to bank-first. If the bank is empty AND no `--offline-dump` given → hard exit with a clear message (`no source material: provide --offline-dump or restore connectivity`). Never posts an empty run silently.
- **Empty / whitespace-only premise from args.me.** → `normalizeArgsMeArgument` returns `null`; the record is dropped (not posted as a 0-char body, which the engine hard-blocks anyway).
- **Premise longer than `maxChars` (2000).** → planner truncates to a sentence boundary ≤ 2000 before the pre-check; if still over, the pre-check rejects and the template is re-drawn (never emitted).
- **Reply body shares no tokens with parent (C-RAIL-001 hard floor 0.05).** → every reply carries a `targetExcerpt` pulled verbatim from the parent via `pickTargetExcerpt`, which passes responsiveness immediately (`parentBody.includes(excerpt)`); the pre-check confirms.
- **Evidence-type move with no source (C-EVIDENCE-001 blocking).** → `evidence-heavy` pack always attaches `{ sourceText }` (or `{ url }`) derived from the bank record; the pre-check confirms `allowPost`.
- **Concession/synthesis without a concession marker (C-RAIL-003 review, C-engine CON warning).** → concession/synthesis templates always embed a marker from the constitution's `concessionMarkers` list; not a hard block, but kept clean.
- **Root move with a non-root type.** → planner only ever opens a thread with `thesis` (or `claim`); pre-check enforces `allowedRootTypes`.
- **Concurrent edits / duplicate participant insert (`23505`).** → mirror `runAiDrivenCorpus`: swallow `error.code === '23505'` on `debate_participants.insert`, warn on other codes.
- **`submit-argument` transient failure / relay error.** → per-move result records `failed_${status}` + `errorDetail`; the run continues; the reporter tallies submit errors. Never retried into a spin loop.
- **Child move whose parent failed to post.** → `skipped_missing_parent` (mirrors the `argIdByMoveId` guard), never posts an orphan.
- **`--no-provider` accidentally receiving a client.** → renderer signature for the no-provider path takes no client; the orchestrator never constructs a Claude client unless `provider === 'sonnet' && pilot`. A source-scan test asserts `reseedMoveRenderer.renderNoProvider` contains no `claudeMessagesClient` / `anthropic` reference.
- **Sonnet returns a JSON-wrapped or preamble-prefixed body.** → validator-aware prompt forbids wrappers; the renderer strips a leading code fence defensively, re-runs the pre-check, and on failure emits `deterministic_fallback` with an `issues` entry (`sonnet_wrapper` / `sonnet_engine_reject`).
- **Doctrine ban tokens in a bank premise (input) vs a generated label (output).** → banned tokens are corpus INPUT and are NOT scrubbed from bodies (operator `policy_no_censorship`); they ARE banned from any harness-generated **label / qualifier / report field** (asserted by a ban-list test on report strings + any qualifier the planner stamps).

---

## Test plan

All under `__tests__/` (jest `testMatch: **/__tests__/**/*.test.(ts|tsx)`). Pure requires of the CJS modules; no network, no Supabase, no real Anthropic.

1. `__tests__/reseedNormalizer.test.ts`
   - Happy path: a well-formed args.me argument → `ReseedSourceRecord` with all fields; stance mapping PRO/CON/UNKNOWN.
   - Empty/whitespace premise → `null`.
   - Batch drops nulls; preserves order.

2. `__tests__/argsMeSourceFetcher.test.ts`
   - Injected `fetchImpl` returning JSON `content-type` → `parseMode: 'json'`, records normalized.
   - Injected `fetchImpl` returning XML/HTML `content-type` → `parseMode: 'xml_fallback'`, records still normalized.
   - Asserts the request carried `Accept: application/json`.
   - Non-2xx → `{ records: [], parseMode }`, no throw.
   - **No real network**: test fails if `fetchImpl` is omitted (guard).

3. `__tests__/reseedEnginePrecheck.test.ts`
   - A valid root `thesis` → `{ valid: true }`.
   - A root `rebuttal` → `{ valid: false, blockingCodes: [...] }` (root type).
   - A `synthesis` under a `thesis` (illegal transition) → `{ valid: false }` with `INVALID_TRANSITION`.
   - An `evidence` move with no source → `{ valid: false }` with `EVIDENCE_REQUIRED`.
   - A reply with a `targetExcerpt` that is a substring of parent → `{ valid: true }` (responsiveness satisfied).
   - **Engine-invalid-template rejection** (adversarial check #7): a hand-built illegal template returns `valid: false`.

4. `__tests__/reseedPackPlanner.determinism.test.ts`
   - Same `{ pack, count, seed, runId, bank }` → deep-equal plan (JSON.stringify equality).
   - Different `seed` → different plan (not accidentally constant).
   - `rejectedTemplates === 0` for every pack (engine-valid by construction).
   - No `Date.now` / `Math.random` in the planner source (source-scan).

5. `__tests__/reseedPackPlanner.noProviderValidatorPass.test.ts`
   - For each of the 6 packs: plan → render every move with `renderNoProvider` → run each through `isEngineValidMove` → **100% valid** (asserts the core contract).

6. `__tests__/reseedPackPlanner.voiceRotation.test.ts`
   - Voice rotates per thread, not per account: the same bot alias uses ≥2 distinct `voiceId`s across threads; within a thread a bot's voice is stable.

7. `__tests__/reseedArchiveCluster.jaccard.test.ts`
   - The `archive-cluster` pack produces at least one sibling pair with token-set Jaccard ≥ `NEAR_VERBATIM_THRESHOLD` (0.60).
   - `reseedJaccard.NEAR_VERBATIM_THRESHOLD === xaiAdversarialReport`'s `SAMEY_MOVE_HIGH_PAIR_THRESHOLD` (twin-equality; if the reused source constant changes, this fails).
   - Feeding the cluster's `move_body_sample` events to `reseedDiversityChecks` yields `nearVerbatimCluster.severityBand !== 'green'` (it fires).

8. `__tests__/reseedMoveRenderer.noProvider.test.ts`
   - `renderNoProvider` never imports/calls the Anthropic client (source-scan + behavioral: no `client` param).
   - Deterministic: same `(move, seedRecord, rng-seed)` → same body.

9. `__tests__/reseedMoveRenderer.sonnetFallback.test.ts`
   - Stubbed client returning a JSON-wrapped body → renderer falls back to `deterministic_template` body with `source: 'deterministic_fallback'` and an `issues` entry.
   - Fallback-reason histogram buckets on issue PREFIX only; never echoes an option/spine id or a banned label value (mirrors `corpusFallbackHistogramAndSameyMove` assertions).

10. `__tests__/reseedNoDirectInsert.guard.test.ts` (the doctrine fence)
   - Source-scan across `scripts/reseeder/**`: **zero** occurrences of `service_role`, `SERVICE_ROLE`, `serviceClient`, `createServiceClient`, `.from('arguments').insert`, `from("arguments").insert`.
   - Every posting path uses `invokeSubmitArgument` / `buildSubmitArgumentBody`; asserts `runReseeder` imports from `submitMove`.
   - Asserts `buildSubmitArgumentBody` output passes `isAllowedSubmitBody` for a representative move.
   - Asserts no committed source file contains a raw `args.me` / `debate.org` source URL literal (**license leak-scan**) — scans `scripts/reseeder/**` and this design doc.

11. `__tests__/reseedReport.attribution.test.ts`
   - Empty event stream → every diversity check `severityBand: 'n/a'` with `reason: 'attribution_absent'`; the report **cannot render green** (regression guard mirroring `xaiAdversarialReport.attribution-absent-na`).
   - `engineRejection` count section renders; a run with N rejections shows N, a clean run shows 0.
   - Ban-list scan: rendered Markdown contains none of `winner / loser / liar / true / false / correct / dishonest / bad faith / troll / propagandist`.
   - Attribution-present full stream → bands compute (green reachable) — proves the report isn't stuck at n/a.

12. `__tests__/reseedParentSkillExists.test.ts`
   - Asserts `C:/Users/kyler/cdiscourse/.claude/skills/cdiscourse-reseeder/SKILL.md` exists and carries `disable-model-invocation: true` + the Identity Declaration + the "does not use service-role / does not write directly to public.arguments / does not bypass submit-argument" boundary line.

**npm test selector for the implementer:** `npm test -- reseed argsMe` (jest matches file basenames containing `reseed` or `argsMe`; 11 of the 12 files match `reseed`, and `argsMeSourceFetcher` matches `argsMe`). Full-suite run (`npm test`) must still be green and the count must go UP.

---

## Dependencies (cards / docs / files)

- **Assumes the additive `public.debates.run_tag` column exists** (CORPUS-30-RUNTAG-PERSIST, already live and used by `runAiDrivenCorpus.js:314`). If a linked DB were missing the column, the debate insert would fail — the harness surfaces `fatal=create_room_failed` rather than corrupting anything.
- **Reads (imports, read-only):**
  - `src/domain/constitution/evaluateArgumentDraft.ts` → `evaluateArgumentDraft` (engine pre-check).
  - `src/domain/constitution/railsChecks.ts` (via `evaluateArgumentDraft`).
  - `src/domain/constitution/constitution.v1.ts` → `constitutionRules`, `tagDefinitions`, `flagDefinitions`, `constitutionVersion`.
  - `src/domain/constitution/types.ts` → `ArgumentType`.
  - `scripts/bot-fixtures/loadEnv.js` → `loadEnvFiles`, `buildBotConfig`.
  - `scripts/bot-fixtures/supabaseClient.js` → `createBotClient`, `signInBot`.
  - `scripts/bot-fixtures/adminOps.js` → `ensureBotUser`.
  - `scripts/bot-fixtures/submitMove.js` → `buildSubmitArgumentBody`, `invokeSubmitArgument`, `isAllowedSubmitBody`.
  - `scripts/bot-fixtures/personaMapping.js` → `mapPersonaSideToParticipantSide`.
  - `scripts/bot-fixtures/stressScenarioTemplates.js` → `seededRng`, `pickTargetExcerpt`.
  - `scripts/bot-fixtures/claudeMessagesClient.js` → `createClient` (sonnet path only).
  - `scripts/bot-fixtures/writeRunLog.js` → JSONL writer.
  - `scripts/bot-fixtures/xaiAdversarialReport.js` → `sameyJaccardSets`, `SAMEY_MOVE_HIGH_PAIR_THRESHOLD` (threshold twin-lock only).
- **Blocks nothing directly.** A future "DB clear + reseed" red-gate card can call this harness after clearing; that card owns the destructive step, not this one.

---

## Risks

- **Two constitution copies can drift.** `src/domain/constitution` (imported by the pre-check) and `supabase/functions/_shared/constitution` (run by the deployed `submit-argument`) are separate files kept in sync by convention. If they drift, a pre-check-valid move could be Edge-rejected. Mitigation: the harness treats an Edge rejection as **logged signal, not a harness failure** (doctrine-aligned), and the reporter's `engineRejection` count makes drift visible. The implementer should add a comment in `reseedEnginePrecheck.js` pointing at both copies.
- **args.me JSON shape unverified from here.** WebFetch upgrades to HTTPS and renders markdown, so the exact JSON envelope (`arguments[]` vs a top-level wrapper) could not be captured raw. The normalizer must be defensive: accept both `{ arguments: [...] }` and a bare array, and tolerate missing `premises[].stance`. The implementer MUST confirm the live JSON shape with a one-off `curl -H 'Accept: application/json'` during build and adjust `normalizeArgsMeArgument` field paths.
- **Sonnet model string staleness.** Do NOT hardcode a model id. `claudeMessagesClient` already owns the model; the sonnet renderer should read it from the client's `snapshotUsage().model`. Candidate at design time is `claude-sonnet-4-6` — **the implementer must confirm the current sonnet snapshot** via the claude-api skill / `claudeMessagesClient` default before enabling the `--provider sonnet` path.
- **Flaky wall-clock tests.** None of the planned tests use `toBeLessThan(ms)` timing; keep it that way (repo has a known LIFE-001/META-001 flake class to avoid).
- **`rg` unreliability in Git Bash here** — the implementer's source-scan tests use Node `fs.readFileSync` + `String.includes`, not shell `rg` (matches the existing `corpusFallbackHistogramAndSameyMove` "widening cannot turn green" pattern).
- **Existing tests that might need updating:** none expected — all new files, additive npm scripts, additive test count. If `package.json`'s scripts object is re-serialized, confirm no unrelated diff.

---

## Out of scope

- **Database clear / truncate / delete** — a later red-gate card owns it. This harness only ADDS rooms.
- **App UI** — no screen, no component, no `app/**` or `src/**` (outside read-only engine import).
- **Edge Function / migration / deploy** — none. No `supabase/**` change. No `run_tag` migration (already exists).
- **Direct insert into `public.arguments`** — forbidden; posting is `submit-argument`-only.
- **Service-role usage** — forbidden in the posting path.
- **Storage bucket** — none; the source bank is a gitignored JSONL file, not object storage.
- **`.env*` writes** — none; env is read via `loadEnvFiles`.
- **Committing raw scraped source content / URLs** — forbidden by license; bank is gitignored.
- **xAI / X API** — not used; args.me is the source (Anthropic Sonnet is the only optional provider, gated).
- **Voting / winner scoring** — v1 scope guard; the harness never assigns a winner or truth label.
- **Live run execution by the designer** — this is a design; no run is performed.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/winner labels):** the harness posts argument bodies (which may contain hostile rhetoric as corpus input, per `policy_no_censorship`) but stamps **no** winner/loser/true/false label on any move; the reporter emits activity/diversity bands only. Ban-list test on report strings + planner-stamped qualifiers.
- **§1 (score never blocks posting):** the engine pre-check gates only on **validation** (`allowPost`), never on a score; scoring plays no role in whether a move is emitted.
- **§3 (popularity is not evidence):** the harness derives nothing from engagement/view counts; args.me BM25 relevance is used only to pick topics, never to grant a claim standing. No amplification credit path is touched.
- **§4 (AI moderator limits):** the optional Sonnet path renders **body text only** for test bots; it decides no truth, deletes nothing, returns no authoritative flag, and runs **only** in the gated `scripts/reseeder` runner (never the app). Production app is untouched.
- **§5 (engine is sacred):** the pre-check **imports** the pure engine read-only and adds no network/React/mutation to it. The engine remains the sole acceptance gate; the pre-check is a mirror, not a replacement.
- **§6 / §7 (secrets, no AI from app):** no service-role, no `ANTHROPIC_API_KEY` in `app/`/`src/`; the only Anthropic call is the operator-gated `claudeMessagesClient` under `scripts/reseeder` + `--pilot` + env flag (identical to the sanctioned Stage 6.1.5 exception). The redactor strips `sk-ant-*`, `sb_secret_*`, JWT, Bearer, Authorization from any committed output.
- **§8 (Supabase conventions):** RLS untouched; no migration; `arguments` never hard-deleted or direct-inserted (posted via `submit-argument`, which respects RLS then inserts authoritatively).
- **§9 (plain language):** the reporter maps nothing raw to users (it's a dev doc), and buckets fallback reasons on prefix tokens only — no internal option/spine id or label value leaks (mirrors CORPUS-30).
- **§10a (Observations vs Allegations):** the harness generates no user-facing node labels; any qualifier it stamps is a machine Observation and carries no truth/intent claim.
- **§10 (v1 scope):** no voting/winner, no search, no OAuth, no push, no public API introduced.
- **License (CC-BY 4.0):** attribution (`sourceUrl`, `sourceId`) recorded **only** in the gitignored bank; a leak-scan test forbids raw source URLs in committed files; seeded bodies are private pre-launch test content, not a redistributed corpus.

### Adversarial self-check (all 7)

1. **Can any path direct-insert into `public.arguments` or touch service-role in posting?** No. Every argument write goes through `invokeSubmitArgument` → `submit-argument` (JWT, RLS-respecting). Debate/participant inserts use the authenticated bot client (allowed, not service-role). `reseedNoDirectInsert.guard.test.ts` source-scans for `service_role`/`serviceClient`/`.from('arguments').insert` and finds zero. The bot client factory (`createBotClient`) only ever receives the publishable/anon key.
2. **Can `--no-provider` secretly call a provider?** No. `provider === 'none'` is the default; the orchestrator constructs a Claude client **only** when `provider === 'sonnet' && pilot`. `renderNoProvider` takes no client param and its source contains no `anthropic`/`claudeMessagesClient` reference (asserted). Dry mode makes zero network calls of any kind.
3. **Can attribution be zero on any move?** No. Every `ReseedMoveEvent` is stamped with `seedId, threadIndex, spineId, voiceId, bankName, optionIndex` at plan time (move 1 included, since the root move is a seed with its own bankName). The reporter treats a missing field as `attribution_absent → n/a`, so a zero would surface as n/a, never as a false green. A planner test asserts all six fields present + non-zero-length on every emitted move.
4. **Can the near-verbatim pack fail to cluster at threshold?** No. `archive-cluster` deliberately composes sibling bodies from the same premise with ≤ (1 − 0.60) token divergence budget, so pairwise Jaccard ≥ 0.60. `reseedArchiveCluster.jaccard.test.ts` asserts at least one pair ≥ threshold AND that `nearVerbatimCluster` fires (band ≠ green). The threshold is twin-locked to the reused source constant.
5. **Can the source bank commit raw scraped content against the license?** No. The bank JSONL lives under `logs/reseeder/` (gitignored: `.gitignore:45 logs/`). `sourceUrl`/`sourceId` fields exist ONLY in the bank. The redactor strips source-host URLs at the committed-report boundary, and `reseedNoDirectInsert.guard.test.ts` scans `scripts/reseeder/**` + this doc for raw `args.me`/`debate.org` URL literals and finds none.
6. **Can the reporter green on empty input?** No. `reseedDiversityChecks` returns `severityBand: 'n/a'` + `reason: 'attribution_absent'` on an empty/attribution-less stream (mirrors the ratified CORPUS-30 §9 default). `reseedReport.attribution.test.ts` asserts empty-in → n/a-out and that the Markdown never renders a green band from absence. The samey/near-verbatim bands additionally honor the ≥50-sample floor → `insufficient_samples` n/a.
7. **Can a pack emit templates the engine rejects wholesale?** No. Every planned move passes `isEngineValidMove` (the SAME `evaluateArgumentDraft` the Edge runs) BEFORE it is emitted; a rejected draw is re-drawn or dropped, and `planPack` returns `rejectedTemplates` (asserted `=== 0` per pack). `reseedPackPlanner.noProviderValidatorPass.test.ts` renders + re-validates all six packs at 100%. Residual Edge-vs-src drift is caught as `engineRejection` count at post time (logged signal, not a crash).

---

## Operator steps (if any)

Pure dev-tooling; nothing to deploy. To operate:

1. **Zero-spend default (safe, no live posting):**
   `npm run bot:fixture:reseed:dry` — plans + renders + writes a dry Markdown report + gitignored JSONL; no network, no Supabase, no Anthropic.
2. **Live deterministic reseed (posts through `submit-argument`, zero model spend):**
   Requires `.env.bot-tests` filled (`CDISCOURSE_ADMIN_*`, `CDISCOURSE_BOT_A/B/C_*`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and connectivity to args.me (or `--offline-dump <path>`).
   `npm run bot:fixture:reseed:baseline` (adds `--pilot`).
3. **Sonnet-tuned reseed (operator-gated model spend):**
   Additionally requires `.env.engagement-intelligence` with `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `ANTHROPIC_API_KEY`.
   `npm run bot:fixture:reseed:sonnet` (adds `--pilot --provider sonnet`).
4. **If the deployed `submit-argument` is behind on constitution changes**, engine-rejection counts may rise; the operator re-deploys `submit-argument` (`npx supabase functions deploy submit-argument --linked`) — but that is not required for this card and is outside its scope.

**No `db push`, no migration, no function deploy is required for this card.** The `run_tag` column already exists.

---

## npm scripts (proposed)

```jsonc
"bot:fixture:reseed:dry":      "node scripts/reseeder/runReseeder.js --dry --pack baseline --count 5",
"bot:fixture:reseed:baseline": "node scripts/reseeder/runReseeder.js --pilot --pack baseline --count 5",
"bot:fixture:reseed:sonnet":   "node scripts/reseeder/runReseeder.js --pilot --provider sonnet --pack baseline --count 5"
```
(Naming matches the repo convention `bot:fixture:<name>:<variant>`; the implementer may add `:deep-thread` / `:wide-room` / etc. variants if useful, but the three above satisfy the card.)

---

## Pack specs (the 6 named packs)

Each pack is engine-valid by construction (root `thesis`, transitions per `constitution.v1`, replies carry `targetExcerpt`, evidence carries a source).

| Pack | Shape | Spine mix | Distinctive knob |
|---|---|---|---|
| `baseline` | 1 thesis → 2-3 claims → 1-2 rebuttals; depth ≤ 3; ~6 moves/room | objection, evidence-pressure | The reference pack; broadest voice/spine rotation. |
| `deep-thread` | thesis → claim → rebuttal → counter_rebuttal → evidence → clarification chain; depth 6-8; single long spine | alternative-explanation, resolution-pressure | Exercises `maxDepth`; every reply pulls a fresh `targetExcerpt` from its immediate parent. |
| `wide-room` | thesis → 6-10 sibling claims, each with 1 rebuttal; depth ≤ 2; breadth-heavy | objection | Exercises sibling-similarity (kept below the 0.7 duplicate-sibling warn by drawing distinct premises). |
| `evidence-heavy` | every non-root move is `evidence` where the transition allows, else `rebuttal`+`evidence` child | evidence-pressure | Every `evidence` move attaches `{ sourceText }` from the bank (C-EVIDENCE-001 satisfied). |
| `archive-cluster` | thesis → N sibling claims where a subset is near-verbatim (Jaccard ≥ 0.60) | objection | **Deliberately** trips the samey-move / near-verbatim detector end-to-end. |
| `resolution-arc` | thesis → claim → rebuttal → concession → synthesis (full arc to a closed thread) | concession/narrowing → resolution-pressure | Concession + synthesis carry markers; exercises the CON/SYN engine paths and the resolution grammar. |

**Maneuver grammar (spine, rotated per thread):** `objection → evidence-pressure → alternative-explanation → concession/narrowing → resolution-pressure`. Each spine maps to a legal argument-type sequence under the transition matrix; the planner picks the sequence, the renderer fills the body from bank premises + the spine's rhetorical shape.

**Attribution field set (non-zero from move 1):** `seedId`, `threadIndex`, `spineId`, `voiceId`, `bankName`, `optionIndex` — every one present on every `move_planned` / `move_validated` / `move_posted` event.
