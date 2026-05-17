# CLAUDE.md — CDiscourse

Project-specific instructions for all Claude Code sessions. Read this before doing anything.

---

## What This Project Is

CDiscourse is a mobile-first AI-assisted debate app built with Expo React Native and Supabase. Users create debate rooms around a resolution and submit structured arguments in a recursive tree. A versioned software Constitution defines all valid argument types and transitions. A lightweight AI layer produces optional, non-authoritative flags.

Full product spec: `docs/product-spec.md`
Architecture: `docs/architecture.md`
Constitution v1: `docs/constitution-v1.md`
Staged build plan: `docs/implementation-plan.md`

---

## Start Every Session Here

Before doing anything else in a new session:

1. Run `npm run checkpoint` — confirms git state, package version, current stage, and environment
2. Read `docs/current-status.md` — what works, what is stubbed, what is blocked
3. Read `docs/session-handoff.md` — architectural invariants and what not to touch
4. Run `git status` — confirm working tree is clean
5. Do not add new features until `npm run typecheck`, `npm run lint`, and `npm run test` all pass

If the session was interrupted mid-task, read `docs/current-status.md` first — it records the last known passing state.

---

## Stage Discipline

Always check which stage is active before implementing. Do not implement Stage 2 features while Stage 1 is incomplete. After each stage, run the verification commands listed in `docs/implementation-plan.md` and confirm they pass before proceeding.

Current stage: **Stage 6.1.9 follow-up complete (dry JSONL contract stabilized; M1/M2 seed exemption tests)** — On top of Stage 6.2 UX rescue (timeline map / sidecar / advisory validation). The harvester now writes to `<runId>-xai-adversarial-harvest.jsonl` so it no longer collides with the runner's `…-semantic-corpus.jsonl`. The runner's dry mode emits the full required event set plus 4 new granular events (`bot_assignment`, `move_prompt_built`, `move_rendered`, `move_validated`); existing `bot_move_render` retained for back-compat. Every event still carries `skillGate` with both 16-hex skill hashes. New tests in `__tests__/seedM1M2NoKeywordStuffing.test.ts` (7 tests) prove the local shared engine never rejects xAI-derived M1/M2 seeds for missing keyword overlap — Stage 6.2 already converted OFF_TOPIC and PARENT_NONRESPONSIVE to advisory. **1671 tests / 65 suites passing**, typecheck + lint clean. **Tiny live verification done this session**: 1 xAI harvest (5 sources / 30 replies scanned / 4 usable / 3 synthetic), 1 Anthropic corpus run (14 calls, ~49k input + ~1.6k output tokens), 5 dev debate rooms created, 13/18 moves posted via `submit-argument`. The 5 rejections all trace to a single deployed-Edge-Function issue: the deployed `submit-argument` still hard-blocks on the pre-Stage-6.2 OFF_TOPIC rule. **Operator action**: run `npx supabase functions deploy submit-argument --linked` to pick up the advisory change. **Do NOT run 100-harvest / 50-scenario corpus until that deploy lands** — the rejection rate is gated on it. No service-role, no direct insert, no `.env*` touched. See `docs/current-status.md`.

Earlier completed stage: **Stage 6.1.8 complete (Argument Stack + Timeline game surface; deletion request workflow)** — Replaces the argument-room comment-thread feel with an interactive bubble stack + horizontal DAW-style timeline. Latest message is active by default and visually on top. Pure-TS model in `src/features/arguments/argumentGameSurface.ts` exports `ArgumentSurfaceMode` / `ArgumentBubbleActor` / `ArgumentBubbleControl` / `ArgumentTimelineSegment` / `ArgumentBubbleViewModel` / `ArgumentSurfaceState` + helpers. Stack uses scale + translate + rotate + opacity + zIndex transforms (NOT a vertical thread). Timeline is a horizontal scrubber with beginning / middle / end timestamps below the rail. Bubble controls are actor-aware: **own bubbles never expose body-edit / disagree / flag / reply / score controls** — only `view_qualifiers` + `request_deletion`. Debate title is optional and independent of root argument body; max 120 chars; empty falls back to root claim excerpt; updating title never mutates `public.arguments.body`. New migration `20260517000008_stage6_1_8_argument_deletion_requests.sql` (table + RLS: insert-by-author / select-own-or-admin / update-admin-only / one-open-request-per-argument). New Edge Function `request-argument-deletion` (JWT-verified, caller-scoped author check, optional Resend admin notification with graceful `not_configured` fallback, **never returns admin email addresses to client**, **never logs Authorization / RESEND_API_KEY**, **never deletes a row in `public.arguments`**). New `requestArgumentDeletion` client wrapper. Stage 6.1.6b Admin Arguments + Debate list tables (sortable Created / Last Updated columns) unchanged. **No Anthropic / xAI / X API / Supabase write by Claude in this stage** — migration + Edge Function are written but not deployed (operator runs `npx supabase db push --linked` + `npx supabase functions deploy request-argument-deletion` when ready). +60 new tests. **1425 tests / 58 suites passing**, typecheck + lint clean. See `docs/argument-stack-timeline-surface.md`.

Earlier completed stage: **Stage 6.1.7 complete (xAI adversarial thread corpus — scaffold; live pilots operator-gated)** — New runner `scripts/bot-fixtures/runXaiAdversarialThreadCorpus.js` turns the xAI Responses API + `x_search` tool into a structured adversarial thread corpus. Provider abstraction in `scripts/engagement-intelligence/xaiAdversarialProvider.js`: `xaiResponsesProvider` is default (Responses API surfaces explicit citation refs so we can keep metric-vs-inferred ranking honest); `legacyXaiChatSearchProvider` is fallback. Both gated by env + key + `--pilot`. Pipeline: source-candidate collector (target pool 300, deterministic seeded sampling) → top-12 reply collector (`topReplyMethod` honestly downgrades to `provider_inferred` when metrics are missing) → first-disagreement selector (threshold `disagreementScore ≥ 0.35`, prefers mixed-agreement classes) → synthetic-fallback option (marked `excludedFromRealEpidemiology=true`) → 3-bot deterministic scene builder (every persona declares test-bot identity, never claims to be real X user) → continuation loop via existing `aiMoveRenderer` + `submit-argument` (no direct insert, no service-role) → v2 annotation pass (Anthropic with deterministic fallback) → single gitignored JSONL under `logs/engagement-intelligence/` (18 event types) → single committable Markdown under `docs/testing-runs/`. Continuation stops at: explicit concession / synthesis / soft concession-synthesis marker / `--max-depth` / 3-in-a-row submit failures. **Engagement credit and factual-standing eligibility remain SEPARATE scores** — amplification can earn engagement credit while factual-standing gain is suppressed until evidence arrives. Sanitiser strips `xai-*`, `sk-ant-*`, `sb_secret_*`, JWT-shape, Bearer, Authorization, X @handles (1–15 chars), `x.com` / `t.co` / `twitter.com` URLs (including bare hosts), 15–20 digit post IDs, emails. New npm scripts: `bot:fixture:xai-adversarial:dry / :3 / :50`. **No Anthropic / xAI / X API / Supabase write by Claude in this stage.** +45 new tests. **1360 tests / 54 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.6b complete (timestamp columns as first-class dimensions)** — Admin Arguments and the Debate list are real tables now, not card lists with timestamp metadata. `AdminArgumentsTab` columns: Status · Side · Type · Debate / Argument · Category / Qualifier · **Created** · **Last Updated** · Action. `DebateListScreen` columns: Status · My Side · Debate · **Created** · **Last Updated** · Action. Sortable column headers (Created + Last Updated) are Pressables with `accessibilityRole="button"` and `accessibilityState={{ selected: active }}`; the active column shows `↓ newest first` or `↑ oldest first`. Each timestamp cell renders absolute + relative as **separate stacked `<Text>` elements** (no prose concatenation). Both tables wrap in a horizontal ScrollView so columns never collapse on narrow viewports. Sort uses **real `Date.getTime()`** comparisons; missing `updated_at` falls back to `created_at` for display and sort with `same as created` hint. testIDs: `admin-arguments-table`, `admin-arguments-header-created`, `admin-arguments-header-updated`, `admin-arguments-cell-created`, `admin-arguments-cell-updated`, plus the matching `debates-*` set. Default sort remains `updated_at desc`. **No Anthropic / xAI / X API / Supabase write / service-role usage in this stage.** **1315 tests / 52 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.6a complete (Admin Arguments timestamp sorting + Poppy UI clarity pass)** — Admin Arguments and the Debate list now expose explicit `Last Updated` + `Created` timestamp columns with toggleable sort (default `updated_at desc`). Plain-language sort chips (`Newest activity` / `Oldest activity` / `Newest created` / `Oldest created`), a visible `Sorted by: <Column> ↓/↑ (<plain label>)` status, helper copy (`Use Last Updated to find active conversations. Use Created to find newest rooms.`), and a legend (`Activity = most recent argument update · Created = original post/room creation time`). Each row shows `formatDateTime · formatRelativeShort`; missing `updated_at` falls back to `same as created` and reuses the created timestamp. Empty / loading / error / filtered-empty states are actionable. `AdminHistoryTab` audit events now render via `formatDateTime` + `formatRelativeShort`. `DebateListScreen` gained the same sort toolbar + per-card timestamps. `adminArgumentsApi.loadAdminArguments` now accepts `sortField` (`updated_at | created_at`) + `sortDirection` (`desc | asc`). **No Anthropic / xAI / X API call by Claude in this stage. No Supabase write. No service-role usage.** +47 new tests. **1305 tests / 52 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.5.2 complete (anti-amplification doctrine + xAI X Search seeder + political frame)** — Encodes the doctrine that popularity / repetition / engagement velocity / political identity are NOT evidence. Every annotation now carries `politicalIssueFrame` (14 values), `politicalValence` (12 values, **describes TEXT not user**), `amplificationSignals` (10-bool object incl. `appeal_to_virality`, `unknown_source_chain`, `high_engagement_low_evidence`), `evidentiaryRisk` (low/medium/high/unknown), `amplificationRisk` (none_observed/low/medium/high), `platformSupportWarning` (boolean — true when claim must NOT receive factual standing without evidence), `recommendedGameTreatment` (9 values incl. `suppress_score_gain_for_amplification_only`, `ask_for_primary_source`, `allow_point_standing_after_evidence`), `justification` (text-feature only — no claims about the author), plus 9 new `deterministicRuleCandidate` boolean flags. Schema bumped to v2. New pure-TS module `src/features/pointStanding/antiAmplification.ts` post-processes a `PointStandingDelta`: amplification earns engagement credit but never factual-standing credit; narrowing / sourcing / clarification of a viral claim earns the conversion bonus. Banned user labels (`troll`, `bot`, `astroturfer`, `liar`, `propagandist`, `extremist`, `bad faith`, `manipulative`) are refused in every annotation field and stripped from input bodies. `loadXaiSeedsLive` is now wired to `POST https://api.x.ai/v1/chat/completions` with xAI Live Search (`search_parameters`), gated behind `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_XAI=true` + `XAI_API_KEY` + `--pilot`. All returned seeds run through a redactor that strips X handles, URLs, JWTs. `runAiDrivenCorpus.js` captures `submitErrorDetail` per move; the intelligence report shows it plus new aggregate sections. `runTinyXNewsPilot.js` appends a deterministic anti-amplification annotation section. **No Anthropic / xAI call by Claude in this stage.** +57 new tests. **1258 tests / 50 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.5.1 annotation pipeline complete (scaffold; live pilots operator-gated)** — Adds an Anthropic-driven annotation pass on top of the AI-driven corpus runner. Pure-TS `AnthropicArgumentAnnotation` schema (`messageCategory`, `primaryRhetoricalArchetype`, `opinionVector`, `agreementDisagreementVector`, `issueDebtSignal`, `gameImplication`, `evidenceSignals`, `threadSignals`, `modelJustification`, `deterministicRuleCandidate`, `annotationSource`, `userReviewRequired: true`). Every output is advisory. Forbidden verdict tokens (liar / dishonest / bad faith / manipulative / extremist / propagandist / winner / loser / stupid / idiot) are banned from any annotation field and stripped from input bodies before they appear in the report. New JS modules under `scripts/bot-fixtures/`: `anthropicAnnotationPrompt.js`, `anthropicArgumentAnnotator.js`, `deterministicArgumentAnnotator.js`, `aiArgumentIntelligenceReport.js`. `runAiDrivenCorpus.js` accepts `--annotate / --annotation-only / --annotation-jsonl <path> / --deep / --report-name / --max-moves-per-room / --min-moves-per-room`. Annotation failure never blocks the corpus run; the deterministic fallback mirrors the schema. New npm scripts: `bot:fixture:ai:annotated:dry`, `bot:fixture:ai:3:annotated`, `bot:fixture:ai:50:annotated`. **No Anthropic / xAI call by Claude in this stage** — the dry path produces a complete annotated Markdown using the deterministic fallback only. +45 new tests cover prompt safety, annotator validation + retry + fallback, deterministic shape coverage, report safety (verdict tokens redacted, secrets stripped), and runner wiring (no service-role, no Authorization literal). **1210 tests / 46 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.5.1 — annotation pipeline".

Earlier completed stage: **Stage 6.1.3.2b complete (xAI auth probe Windows clean-exit patch)** — Live `engagement:intel:xai:probe:live` confirmed `status=200 / category=auth_ok / exit 0 / no Windows assertion`. The probe is **not inference** — single `GET /v1/models`, no prompt, no user text, no body read; no keys, headers, or response bodies are logged. Patch in `scripts/engagement-intelligence/xaiAuthProbe.js`: explicit `res.body.cancel()` (with `arrayBuffer` drain fallback) before status mapping, new `drainEventLoop()` helper (one `setImmediate` + one `setTimeout(0)`), `process.exitCode` replaces `process.exit()` in the require.main entry, explicit-empty `XAI_API_KEY` in `process.env` is treated as no-key (no `.env` fallback). xAI classification remains disabled by default. X News pilot remains separately gated by `X_BEARER_TOKEN` + `ENGAGEMENT_INTEL_ENABLE_X_API=true` + `--pilot`. **1165 tests / 41 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.5.1 complete (Admin Arguments + message qualifier taxonomy + game recommendations)** — Live AI corpus from Stage 6.1.5 completed clean: 3 rooms × ~13 moves = **38 / 38 posted, 0 failures** (run id `2026-05-17T05-33-03-863Z-fc5b47a8`, `docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md`). Stage 6.1.5.1 turns that into product surface: new `AdminArgumentsTab` (joins `public.arguments` with `debates(title)` and `profiles(display_name)`, sorted by `updated_at` desc, search + limit-50/100/200 chips, category + qualifier badges, evidence / flags / topic-score chips, `created_at` + `updated_at` with `formatDateTime` + `formatRelativeShort`). New pure-TS `src/features/arguments/messageQualifiers.ts` with `MessageCategory` (13 values) + `MessageQualifier` (26 values) + deterministic derivers + UI-nudge map. Tests assert the qualifier vocabulary contains zero verdict tokens (no winner / loser / truth / liar / dishonest / bad faith / manipulative / extremist / propagandist) in any label or nudge. New `src/lib/formatDateTime.ts`. New docs: `docs/message-qualifier-taxonomy.md`, `docs/game-qualifier-recommendations.md`. **No migration** (existing schema already has `arguments.updated_at` + trigger). **No Edge Function change** (admin RLS already permits `is_moderator_or_admin()` SELECT). **No Anthropic / xAI call by Claude in this stage**. +67 new tests. **1157 tests / 41 suites passing**, typecheck + lint clean.

Earlier completed stage: **Stage 6.1.5 scaffold (AI-driven bot test rooms; live runs operator-gated)** — Adds an AI-driven path for bot test fixtures: real-world topic stances seed the room thesis (synthetic file default; xAI X Search wired but scaffold-only this commit), each subsequent bot move body is generated by Anthropic (Claude) conditioned on the persona's skill rules, the Constitution transition table, and the conversation so far. Posts go through the existing `submit-argument` flow. New files: `scripts/bot-fixtures/claudeMessagesClient.js` (gated adapter; sanitizes errors; hard cost cap; refuses without env + `--pilot`), `aiBotPersonas.js` (system prompts bake in skill MD + transitions + concession-marker rule + forbidden-phrase list), `aiMoveRenderer.js` (validates length / forbidden / concession marker / target excerpt; falls back to deterministic renderer on failure), `runAiDrivenCorpus.js` orchestrator, `scripts/engagement-intelligence/xaiSeededStances.js` (gated seed source), `fixtures/engagement-intelligence/synthetic-xai-seeded-stances.json`, `docs/ai-driven-bot-rooms.md`. New npm scripts: `bot:fixture:ai:dry`, `bot:fixture:ai:3`, `bot:fixture:ai:50`. **No Anthropic call has been made by Claude in this session.** **No xAI call has been made.** Dry mode validates the orchestration with placeholder bodies. +28 new tests cover gating + sanitization + persona prompt structure + validators + deterministic fallback + safety scan of source files. **1090 tests / 38 suites passing**, typecheck + lint clean.

**Narrow exception to the "Do not call Anthropic" rule:** the bot fixture runner under `scripts/bot-fixtures/` may call Anthropic when the operator explicitly opts in via `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `--pilot`. The production app still must not call Anthropic. See `docs/ai-driven-bot-rooms.md` § "What we do NOT do".

Earlier completed stage: **Stage 6.1.4 complete (point-standing economy, pure-TS engine, not auto-wired)** — Adds the scoring layer that sits above the Constitution: `PointStandingDelta`, `OpenIssueDebt`, `ScoringEligibility`, `ConcessionEffect` + `CONCESSION_EFFECT_WEIGHTS`, `MIXED_CLASS_WEIGHTS`, `GradingQuestionSet`, and an in-memory `IssueDebtLedger`. Two public functions: `gradeChallenge(input)` (records a reply's pressure, opens a debt when the class creates one) and `gradeRepair(input, options)` (records concession / narrowing / synthesis / evasion against an existing debt). Doctrine encoded: **concession is a scoring repair, not a scoring defeat** — an explicit narrow concession that preserves the broad point lifts broad standing (+0.25) and shrinks the narrow defect (-0.15) while paying the responder recovery credit AND the challenger pressure credit. Evasion ("Cars are bad anyway.") pays the unresolved-debt penalty (0.25) and drops narrow standing (-0.3). Anti-exploit gates: tangent / near-duplicate / self-concession-loop / no-axis-identified moves earn no credit; credit components are awarded at most once per debt. NOT auto-wired into the existing argument room — a later stage adds the Supabase ledger table + Edge Function + UI nudges. +24 new tests (worked bike-lane example, evasion example, anti-exploit, doctrine, ledger). **1062 tests / 37 suites passing**, typecheck + lint clean. See `docs/point-standing-economy.md`.

Earlier completed stage: **Stage 6.1.3.3 scaffold ready (live pilot operator-gated)** — Added mixed-agreement taxonomy (`MixedAgreementClass`, `MixedAgreementFlags`, `GradingFlags`, breadth bands, `playableTensionScore`, suggested game nudges) and a `classifyMixedAgreement(vector, rootText, replyText)` classifier in both TS and a parity-tested JS twin. The most playable state — `broad_accept_narrow_decline` — is detected when a reply accepts the main conclusion/value frame and declines a specific scope/evidence/definition/causal point. Wired `xReplyCollect.js` for live `conversation_id` search via the official `/2/tweets/search/recent` endpoint (refuses without env flag + `--pilot`). Added `runTinyXNewsPilot.js` orchestrator that gates on `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_X_API=true` + `X_BEARER_TOKEN` + `--pilot`, refuses if xAI is accidentally on without `--allow-xai`, fetches up to 5 stories × 3 posts × 12 replies (cap 180 reply pairs), writes redacted JSONL to `data/engagement-intelligence/redacted/` (gitignored), and emits a committable Markdown report with stance + agreement-type + disagreement-type + reply-function + mixed-agreement-class distributions plus top-10 playable-tension / broad-accept-narrow-decline / narrow-accept-broad-decline exhibits. New npm script: `engagement:intel:x-news:tiny-pilot`. +30 new tests covering taxonomy classification, parity, report rendering, refusal paths. **1038 tests / 36 suites passing**, typecheck + lint clean. **No live X API call has been made by Claude in this session** — env is not configured. xAI remains off.

Earlier completed stage: **Stage 6.1.3.2a complete (xAI auth reality check)** — Added a fail-closed `xaiAuthProbe.js` that answers the single question "is the xAI inference API reachable from this machine and under what auth conditions?" without classifying anything, sending any user / public-X text, or logging keys / Bearer tokens / Authorization headers / response bodies. Dry mode is default; live probe with key gates on key presence; no-key probe requires explicit `--probe-missing-key` and treats HTTP 200 as `unexpected_unauthenticated_access` (exit 2). New npm scripts: `engagement:intel:xai:probe:dry` / `probe:live` / `probe:no-key`. 18 new tests assert no network in dry mode, no key/token leak in any output, source file never `console.log`s the `Authorization` header, and the existing xaiClassifyPairs CLI is still disabled-by-default. **1008 tests / 34 suites passing**. xAI remains disabled by default for the upcoming Stage 6.1.3.3 X News pilot. See `docs/x-api-and-xai-setup.md` § "xAI auth reality check".

Earlier completed stage: **Stage 6.1.3.2 complete (engagement-intelligence scaffold)** — Compliant scaffold for X public-reply epidemiology + xAI structured stance classification. Both live APIs are **DISABLED by default**; scripts refuse to call out unless env flags are explicitly `true` AND `--pilot` is passed on the CLI. New module `src/features/engagementIntelligence/` (pure TS: types, lexicons, two-axis agreement+disagreement scalar with `coexistenceScore`, redaction, rule-candidate builder, xAI prompt/schema/validator/merger). New scripts `scripts/engagement-intelligence/` (env loader, news plan, X API client stub, news/reply collectors that refuse live runs, normalizer, offline analyzer, Markdown report writer, xAI runtime CLI). Synthetic fixture with 24 reply pairs covering strong/weak/mixed stances + receipt/quote/definition/scope/causal/value/logic challenges + counterexample/tangent/joke/unclear/concession+rebut/etc. 4 new test files (139 new tests) verify scalar, redaction, xAI compliance contract, and disabled-by-default X API behavior. **990 tests / 33 suites passing**, typecheck/lint clean. `.env.engagement-intelligence.example` documents the kill switches. Live X / xAI calls NOT executed. Stage 6.1.3.1 (live corpus:50) remains valid.

Earlier completed stage: **Stage 6.1.3.1 complete (live corpus:50 written)** — Engagement corpus mode added on top of Stage 6.1.3's stress suite. New `scripts/bot-fixtures/engagementCorpus.js` (decision-trace classifiers — intent / spice / specificity / pressure — plus per-room scoring across 8 dimensions and single-file Markdown + optional JSONL builders). Two new deep-chain templates (`deep-chain-12` at depth 10, `deep-chain-15` at depth 14) plus expanded spicy phrase pools and richer renderers. `runStressBatch.js` gained `--corpus`, `--corpus-only`, `--write-jsonl`, `--no-write-markdown` flags. New npm scripts: `bot:fixture:corpus:dry`, `bot:fixture:corpus:10`, `bot:fixture:corpus:50`. **Live `corpus:50` posted 625/625 moves across 50 rooms** (run `2026-05-17T02-52-24-643Z-110e0333`, 0 failures, all 8 categories covered, max depth 14). Corpus md is 12,751 lines with full bodies, decision traces, per-room scores, no secrets, no forbidden phrases. **851 tests / 29 suites passing** (+27 corpus tests covering classifiers, redaction, Markdown structure, determinism, no forbidden phrases, JSONL safety; generator now accepts `outputDir` so parallel test suites don't race on the shared dir). Next: review the corpus for engagement quality and use findings for Stage 6.1.4 (UX simplification) or template tuning.

## Supabase Apply Commands

Docker Desktop must be running for local dev. Once available:

```bash
# Start local Supabase (runs migrations + seed automatically)
npx supabase start

# Reset local DB and re-run all migrations + seed.sql
npx supabase db reset

# Apply new migrations to a remote project (staging/prod)
npx supabase db push --linked

# Link to a remote project (one-time setup)
npx supabase link --project-ref <your-project-ref>
```

To verify migrations applied cleanly:
```bash
npx supabase db status       # shows applied migration list
npx supabase db lint         # runs plpgsql linting
```

Update this line when a stage completes.

---

## Dependency Policy

1. Check `package.json` before installing anything.
2. Expo/React Native packages: `npx expo install <package>` (gets compatible version).
3. Pure-JS packages (Zustand, etc.): `npm install <package>`.
4. Supabase Edge Function deps: import via URL (Deno-compatible); no npm installs inside `supabase/functions/`.
5. Do not install packages speculatively — only when they serve the current stage.

---

## Rules Engine is Sacred

`src/lib/constitution/engine.ts` must remain:
- Pure TypeScript — no imports from Supabase, React, or any network library.
- Side-effect free — no mutations, no async.
- JSON-serializable inputs/outputs — so it runs identically on client and in Edge Functions.

Never add network calls or React hooks to the engine. If you need to fetch a constitution, do it outside the engine and pass the loaded value in.

---

## AI Moderation Hard Rules

The AI moderator **must not**:
- Decide who is right or wrong in a debate.
- Delete, hide, or modify any user content automatically.
- Assign a truth value to a claim.
- Return authoritative flags (`authoritative` must always be `false` for AI-sourced flags).
- Run on the client — AI calls happen only in Supabase Edge Functions.

The AI moderator **may**:
- Assess topic relevance (is this argument on-topic to the resolution?).
- Assess type fit (does the body match the declared argument type?).
- Suggest tags (user must confirm).
- Summarize subtrees when requested (user must edit and submit).

---

## Security — Non-Negotiable

| Key | Where it lives | Never in |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` (client) | git |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` (client) | git |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets (Edge Functions only) | client code, git |
| `ANTHROPIC_API_KEY` | Supabase secrets (Edge Functions only) | client code, git |

Before any commit, verify:
```bash
grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/
# Must return zero matches
```

`.env.example` contains only key names with empty or placeholder values. It is safe to commit.

---

## Supabase Conventions

- All tables have RLS enabled. Never disable RLS on any table.
- Migrations are numbered sequentially: `0001_`, `0002_`, etc.
- Never edit an existing migration file after it has been applied — write a new migration instead.
- Constitution versions: written only by service role; never mutated after insert.
- `flags` rows: never deleted — only dismissed (`dismissed = true`, `reviewed_by`, `reviewed_at`).
- `arguments` rows: never hard-deleted — soft-delete via `is_deleted = true`.

---

## TypeScript Conventions

- Strict mode on. `tsconfig.json` `"strict": true`. Do not suppress with `any` unless unavoidable and explicitly commented.
- Domain types live in `src/lib/types.ts`. Constitution types live in `src/lib/constitution/types.ts`.
- All Supabase query return types must be explicitly typed — use the generated types or manual interfaces.
- No `console.log` in committed code — use a structured logger utility or remove before commit.

---

## Testing

- The rules engine must have 100% branch coverage on the transition matrix.
- Run `npm run test` after every change to the engine or its dependents.
- Run `npm run typecheck` before every commit.
- Do not skip tests or comment them out to make CI pass.

---

## What Not to Build (v1 Scope)

- No voting or scoring system.
- No real-time collaborative editing of argument bodies.
- No web version (Expo Web is out of scope for v1).
- No OAuth / social login (email+password only in v1).
- No public API.
- No push notifications.
- No argument search.

If a user or spec describes one of these, note it as a v2 item and do not implement it.
