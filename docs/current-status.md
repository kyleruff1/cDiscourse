# CDiscourse — Current Status

_Last updated: 2026-05-17 (Stage 6.1.5.2)_

## Current Stage

**Stage 6.1.5.2 complete (anti-amplification doctrine + xAI X Search seeder + political frame).** Encodes the doctrine that popularity / repetition / engagement velocity / political identity are NOT evidence. Every annotation now carries `politicalIssueFrame` (14 values), `politicalValence` (12 values, describes TEXT not user), `amplificationSignals` (10-bool object), `evidentiaryRisk`, `amplificationRisk`, `platformSupportWarning`, `recommendedGameTreatment` (9 values), `justification` (text-feature only), plus 9 new `deterministicRuleCandidate` boolean flags. Schema bumped to v2. New pure-TS module `src/features/pointStanding/antiAmplification.ts` post-processes a `PointStandingDelta`: amplification earns engagement credit but never factual-standing credit; narrowing / sourcing / clarification earns the conversion bonus. `loadXaiSeedsLive` is now wired to `POST /v1/chat/completions` with xAI Live Search (`search_parameters`), gated behind the existing env + `--pilot` flags. `runAiDrivenCorpus.js` captures `submitErrorDetail` per move; the intelligence report shows it plus new aggregate sections (political frame distribution, amplification signals fired, rule flags fired, platformSupportWarning examples, claims that should NOT receive factual standing, claims that could receive standing AFTER evidence, viral-without-evidence examples, political-generalization examples). `runTinyXNewsPilot.js` appends a deterministic anti-amplification annotation section to the existing X News pilot report — per-root + per-reply political/amplification fields + aggregates + recommendations. **No Anthropic / xAI call by Claude in this stage.** +57 new tests. **1258 tests / 50 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.5.2".

**Stage 6.1.5.1 annotation pipeline complete (scaffold; live pilots operator-gated).** Adds an optional Anthropic-driven annotation pass on top of the AI-driven corpus runner. Pure-TS schema `src/features/engagementIntelligence/anthropicArgumentAnnotations.ts` defines `AnthropicArgumentAnnotation` (`messageCategory`, `primaryRhetoricalArchetype`, `opinionVector`, `agreementDisagreementVector`, `issueDebtSignal`, `gameImplication`, `evidenceSignals`, `threadSignals`, `modelJustification`, `deterministicRuleCandidate`, `annotationSource`, `userReviewRequired: true`). Every output is advisory and carries `userReviewRequired: true`. Forbidden verdict tokens (liar / dishonest / bad faith / manipulative / extremist / propagandist / winner / loser / stupid / idiot) are banned from any annotation field and stripped from input bodies before they appear in the report. New JS modules under `scripts/bot-fixtures/`: `anthropicAnnotationPrompt.js` (system + user prompt builder with full safety constraints), `anthropicArgumentAnnotator.js` (gated Anthropic call → strict JSON parse → schema validate → single retry → deterministic fallback; never blocks the corpus run), `deterministicArgumentAnnotator.js` (pure-JS fallback mirroring the full schema, classifies category / archetype / issue debt / game implication / rule candidate from local fields), `aiArgumentIntelligenceReport.js` (per-room transcript + aggregate distributions + top-20 rule candidates + sample interest areas + recommendations Markdown writer with redactor that scrubs emails / JWTs / `sb_secret_` / `sk-ant-` / `xai-` / forbidden tokens). `runAiDrivenCorpus.js` accepts new flags `--annotate / --annotation-only / --annotation-jsonl <path> / --deep / --report-name / --max-moves-per-room / --min-moves-per-room`; the live submit loop runs annotation after each move and streams to a gitignored JSONL. New npm scripts: `bot:fixture:ai:annotated:dry`, `bot:fixture:ai:3:annotated`, `bot:fixture:ai:50:annotated`. **No Anthropic / xAI call by Claude in this stage** — the dry path produces a complete annotated Markdown using deterministic fallback only. +45 new tests cover prompt safety (forbidden-token enumeration, no key/Bearer leakage), annotator validation (rejects bad shapes, clamps numerics, retries on invalid JSON, deterministic source on error), deterministic shape coverage (every argument type, archetype mapping), report safety (verdict tokens redacted, secrets stripped, source file safety), and runner wiring (flags, file-level: no service-role, no Authorization literal, routes Anthropic through `claudeMessagesClient`). **1210 tests / 46 suites passing**, typecheck + lint clean. See `docs/ai-driven-bot-rooms.md` § "Stage 6.1.5.1 — annotation pipeline".

**Stage 6.1.3.2b complete (xAI auth probe Windows clean-exit patch).** The live xAI auth probe (`engagement:intel:xai:probe:live`) was authenticating cleanly (`status=200`, `category=auth_ok`) but Node on Windows printed a `UV_HANDLE_CLOSING` assertion immediately after — a process-cleanup bug, not an auth bug. Patched `scripts/engagement-intelligence/xaiAuthProbe.js` to explicitly cancel/drain the response body, drain the event loop, set `process.exitCode` instead of calling `process.exit()`, and treat an empty-string `XAI_API_KEY` in `process.env` as "no key" (matching `safeEnvSnapshot`). Live probe now exits cleanly with code 0; no Windows assertion. xAI classification remains disabled by default. **1165 tests / 41 suites passing**, typecheck + lint clean. See `docs/x-api-and-xai-setup.md` § "Stage 6.1.3.2b".

**Stage 6.1.5.1 complete (Admin Arguments + message qualifier taxonomy + game recommendations).** Live AI corpus from Stage 6.1.5 completed clean — 3 rooms × ~13 moves = **38 / 38 posted, 0 failures** (`docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md`, run id `2026-05-17T05-33-03-863Z-fc5b47a8`). Stage 6.1.5.1 surfaces that data: new `AdminArgumentsTab` reads `public.arguments` via existing admin RLS (no Edge Function change, no migration), shows `created_at` + `updated_at`, and decorates each row with `MessageCategory` + `MessageQualifier` badges + UI nudges. Pure-TS `src/features/arguments/messageQualifiers.ts` defines 13 categories × 26 qualifiers; vocabulary tests assert zero verdict tokens. New `src/lib/formatDateTime.ts`. New docs: `docs/message-qualifier-taxonomy.md`, `docs/game-qualifier-recommendations.md`. No Anthropic / xAI call by Claude in this stage. +67 new tests. **1157 tests / 41 suites passing**, typecheck + lint clean.

**Stage 6.1.5 scaffold (AI-driven bot test rooms; live runs operator-gated).** Adds an AI-driven fixture path: real-world topic stances seed the thesis (synthetic by default; xAI X Search scaffold), each subsequent bot move body is generated by Anthropic (Claude) conditioned on the persona's skill + Constitution transitions + concession-marker rule + forbidden-phrase list. Posts go through the existing `submit-argument` flow. New files in `scripts/bot-fixtures/` (`claudeMessagesClient.js`, `aiBotPersonas.js`, `aiMoveRenderer.js`, `runAiDrivenCorpus.js`) + `scripts/engagement-intelligence/xaiSeededStances.js` + synthetic seed fixture + `docs/ai-driven-bot-rooms.md`. New npm scripts: `bot:fixture:ai:dry / ai:3 / ai:50`. Anthropic + xAI both fail-closed; **no Anthropic call has been made by Claude in this session**. +28 new tests. **1090 tests / 38 suites passing**, typecheck + lint clean.

Narrow exception to the "Do not call Anthropic" rule: the bot-fixture runner only — gated behind env + `--pilot`. Production app still must not call Anthropic.

**Stage 6.1.4 complete (point-standing economy, pure-TS engine, not auto-wired).** Adds the scoring layer above the Constitution: `PointStandingDelta`, `OpenIssueDebt`, `ScoringEligibility`, `ConcessionEffect` + weight tables, `MIXED_CLASS_WEIGHTS`, `GradingQuestionSet`, and an in-memory `IssueDebtLedger`. Two public functions: `gradeChallenge(input)` (opens debts) and `gradeRepair(input, options)` (closes debts via concession / narrowing / synthesis, or penalizes evasion). Doctrine encoded: **concession is a scoring repair, not a scoring defeat** — a narrow explicit concession lifts broad standing AND pays the responder recovery credit, while evasion pays an unresolved-debt penalty. Anti-exploit gates block tangent / near-duplicate / self-concession-loop / no-axis-identified moves. Credit is awarded at most once per debt. **Not auto-wired into the existing argument room** — a future stage adds the Supabase ledger + Edge Function + UI nudges. +24 new tests (worked bike-lane example, evasion example, anti-exploit, doctrine, ledger). **1062 tests / 37 suites passing**, typecheck + lint clean. See `docs/point-standing-economy.md`.

**Stage 6.1.3.3 scaffold complete (live pilot operator-gated).** Added the mixed-agreement taxonomy (`MixedAgreementClass`, `MixedAgreementFlags`, `GradingFlags`, breadth bands, `playableTensionScore`, suggested game nudges) in both TS and JS, plus a `runTinyXNewsPilot.js` orchestrator that gates on `.env.engagement-intelligence` + `ENGAGEMENT_INTEL_ENABLE_X_API=true` + `X_BEARER_TOKEN` + `--pilot`. Refuses if xAI is accidentally on (`--allow-xai` is NOT to be passed in this stage). Hard caps at 5 stories × 3 posts × 12 replies (180 reply pairs). Redacted JSONL stays local-only at `data/engagement-intelligence/redacted/`; aggregate Markdown lands at `docs/testing-runs/<date>-x-news-reply-pilot.md`. **No live X API call has been made by Claude in this session** — env is not configured. +30 new tests. **1038 tests / 36 suites passing**, typecheck + lint clean. See `docs/x-news-disagreement-epidemiology.md` § "Mixed-agreement taxonomy" and `docs/x-api-and-xai-setup.md` § "Tiny X News pilot".

**Stage 6.1.3.2a complete (xAI auth reality check).** Fail-closed `xaiAuthProbe.js` script + 18 new tests, used to verify that xAI inference is not reachable without `Authorization: Bearer <XAI_API_KEY>`. Probe defaults to dry (no network). Live probe with a key gates on key presence. No-key probe requires explicit `--probe-missing-key` and reports HTTP 200 as `unexpected_unauthenticated_access` (exit 2). Output is always sanitized — keys / Bearer tokens / Authorization headers / response bodies are never logged. **1008 tests / 34 suites passing**. xAI stays disabled by default for the upcoming Stage 6.1.3.3 X News pilot. See `docs/x-api-and-xai-setup.md` § "xAI auth reality check".

**Stage 6.1.3.2 complete (engagement-intelligence scaffold).** Compliant scaffold for X public-reply epidemiology + xAI structured stance classification. Both live APIs are DISABLED by default; scripts refuse to call out unless `ENGAGEMENT_INTEL_ENABLE_X_API=true` / `ENGAGEMENT_INTEL_ENABLE_XAI=true` AND the operator passes `--pilot` on the CLI. New pure-TS module `src/features/engagementIntelligence/` (two-axis agreement+disagreement scalar with `coexistenceScore`, redaction, rule-candidate builder, xAI prompt/schema/validator/merger). New `scripts/engagement-intelligence/` (env loader, plan, API client stub, refuse-by-default collectors, normalizer, offline analyzer, Markdown report writer, xAI CLI). 24-pair synthetic fixture. 4 new test files = 139 new tests. **990 tests / 33 suites passing**, typecheck + lint clean. No live X / xAI calls have been made. See `docs/x-news-disagreement-epidemiology.md` and `docs/x-api-and-xai-setup.md`.

**Stage 6.1.3.1 complete (live corpus:50 written).** Engagement corpus mode landed and ran live. New `scripts/bot-fixtures/engagementCorpus.js` (decision-trace classifiers + 8-dimension room scoring + single-file Markdown / optional JSONL builders). Two new deep-chain templates (`deep-chain-12` at depth 10, `deep-chain-15` at depth 14) plus expanded spicy pools and richer renderers. `runStressBatch.js` gained `--corpus`, `--corpus-only`, `--write-jsonl`, `--no-write-markdown` flags. New npm scripts: `bot:fixture:corpus:dry`, `bot:fixture:corpus:10`, `bot:fixture:corpus:50`. **Live `corpus:50` posted 625/625 moves across 50 rooms** (run id `2026-05-17T02-52-24-643Z-110e0333`, 0 failures, all 8 categories, max depth 14). Corpus md is 12,751 lines with full bodies, decision traces, room scores, no secrets, no forbidden phrases. **851 tests / 29 suites passing**, lint + typecheck clean. Generator now takes `outputDir` so test suites don't race on the shared dir.

**Stage 6.1.3 complete (live stress:10 run).** Spicy bot stress-test suite landed. New: `topicBank.json` (8 categories × 4 topics), `spicyLanguage.js` (bounded phrase pools — claim-hostile, never person-hostile), 3 stress templates (12 / 11 / 13 moves) honoring all Constitution `transition_*` rules and `concession_integrity` markers, a deterministic seeded generator (`generateStressScenarios.js`), and a batch runner (`runStressBatch.js`) with JSONL event logging and a safe Markdown summary. New npm scripts: `bot:fixture:generate-stress`, `bot:fixture:stress:dry`, `bot:fixture:stress:10`, `bot:fixture:stress:50`. Validator extended with `validateStressScenario` (transitions, concession markers, 10–15 move band) and `ScenarioCategory` widened with 7 stress categories. 21 new tests asserting deterministic generation, valid transitions across 50 generated scenarios, concession markers on `concession` + `synthesis`, and absence of forbidden person-attack phrases. `npm run bot:fixture:stress:dry` reports 0 plan issues on 10 scenarios. **824 tests, 28 suites passing.** Live stress runs not yet executed.

**Stage 6.1.2.4b complete.** Bot fixture runner repaired and first end-to-end live fixture run achieved (sports-play-in, 7/7 moves posted via normal Supabase auth + `submit-argument`, room `62305b8b-c11e-41a6-81b8-4c95daf73d2c`). Runner extracts real HTTP status from `FunctionsHttpError.context.status` (no more `failed_500` collapse for real 422/403), records `errorDetail` from `blockingErrors[0]` / 403 `reason`, skips children when parent did not post, and maps persona side `neutral` → participant side `moderator`.

**Stage 6.1.2 (foundation) complete.** Admin and bot operations foundation: `is_admin()` helper, `admin_audit_events` / `admin_block_rules` / `bot_user_registry` tables (migration 0007 applied to hosted DB), `admin-users` Edge Function with 14 whitelisted actions, admin client wrapper, AdminScreen with 5 sub-tabs (Users / View As / History / Blocks / Bot Users), Admin tab gated by `profiles.role = 'admin'`. View As is read-only snapshot only — no auth impersonation. Bootstrap admin SQL is untracked (`scripts/admin/bootstrap-admin.local.sql` is gitignored).

Stages 6.1.0 (gamified UX), 6.0.3 (inline composer), 5.5.6.1 (RLS hotfix), 5.5.6 (account), 5.5.5 (post-submit refresh), and earlier all committed.

## What Works

### Infrastructure (live)
- Supabase project `qsciikhztvzzohssddrq` linked and accessible
- All 7 migrations applied to hosted project (0001–0007)
- `submit-argument` Edge Function ACTIVE (version 1)
- `admin-users` Edge Function: ✅ deployed ACTIVE v1 (2026-05-16 22:20 UTC)
- `.env` configured; gitignored
- Secret scan clean
- ANTHROPIC_API_KEY set as Supabase secret (reportedly rotated — not called in this or earlier stages)

### Core (local, tested)
- Session contracts, reducer, storage
- Constitution v1 engine — pure TS
- `submit-argument` Edge Function (JWT-protected, deterministic re-validation server-side)
- Migrations 0001–0007 (schema, RLS, seed, rails+edge, session+scalability, RLS fix, admin operations)
- Auth: `AuthScreen`, `useAuthSession`
- Argument viewport, tree, timeline/track view
- Argument composer (inline, "Your Move", idempotent submit, server 422)
- Account/profile feature (display name, ADMIN? row visible)
- **Stage 6.1.0** — gameStatus, claimStanding, argumentTimeline, gameCopy, counterClaim, invite UI
- **Stage 6.1.2** — admin layer:
  - Migration 0007: `is_admin()` helper, `admin_audit_events`, `admin_block_rules`, `bot_user_registry`
  - Edge Function `admin-users` (Deno, JWT-verified, admin-only): list_users, get_user_detail, create_user, create_bot_user, update_role, send_password_reset, set_temporary_password, disable_user, enable_user, soft_delete_user, list_blocks, add_block, remove_block, view_as_snapshot
  - Shared helpers: `adminAuth.ts` (requireAdmin), `adminAudit.ts` (write + sanitize), `adminSchemas.ts` (zod discriminated union)
  - Client wrapper: `src/lib/edgeFunctions.ts → adminUsers()`
  - Feature slice: `src/features/admin/` (AdminScreen, AdminUsersTab, AdminUserDetailPanel, AdminCreateUserForm, AdminViewAsTab, AdminHistoryTab, AdminBlocksTab, AdminBotUsersTab, adminHelpers, adminApi, useAdminUsers)
  - Tab gating: `getVisibleTabs(role, isDev)` in `roomNavigation.ts`
  - Account screen shows `ADMIN? true/false`
  - Bootstrap docs + untracked local SQL script (`scripts/admin/bootstrap-admin.local.sql`)
- Jest test suite: **750 tests**, 26 suites, all passing
- TypeScript strict mode clean (0 errors)
- ESLint clean (0 warnings)

## What Is Stubbed / Pending

- `admin-users` deploy: ✅ done
- Admin bootstrap SQL: ✅ run; dev human is `role=admin` (verified)
- **Live browser smoke (Stage 6.1.2.1 A–H)**: pending operator run — see `docs/testing-runs/2026-05-16-admin-smoke.md`
- IP/email block rules are **app-level only**; full Supabase Auth pre-login enforcement is a later stage
- View As is **read-only snapshot only**; no auth impersonation in this stage
- Bot user automation (counter-runner programmatic posting) is a later stage

## What Is Blocked

- **Live admin smoke test** — requires `admin-users` deploy + bootstrap SQL run
- **Docker/Supabase local** — never validated (Docker Desktop unavailable)

## Last Verification Commands

Run on 2026-05-17 (post Stage 6.1.3.1 dry-corpus gate):

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (0 warnings) |
| `npm run test` | ✅ Pass (851 tests, 29 suites) |
| `npx supabase db push --dry-run` | ✅ Remote database is up to date |
| `npx supabase functions list` | submit-argument ACTIVE v1; admin-users ACTIVE v1 |
| `npm run bot:fixture:sports` | ✅ 7/7 moves posted via normal auth + submit-argument (Stage 6.1.2.4b) |
| `npm run bot:fixture:stress:10` | ✅ 10/10 rooms, 123/123 moves posted (Stage 6.1.3) |
| `npm run bot:fixture:corpus:dry` | ✅ 10 scenarios planned-only, single ~2.5k-line corpus md emitted, no secrets |
| `npm run bot:fixture:corpus:50` | ✅ 50/50 rooms, **625/625 moves posted**, 12,751-line corpus md emitted, no secrets, max depth 14 |
| `npm run engagement:intel:plan` | ✅ dry plan; no live calls (Stage 6.1.3.2) |
| `npm run engagement:intel:synthetic` | ✅ deterministic scalar over 24 synthetic pairs; safe Markdown report emitted |
| `npm run engagement:intel:x-news:dry` | ✅ refuses live X API without explicit `--pilot` + env flag |
| `npm run engagement:intel:xai:probe:dry` | ✅ prints booleans-only env snapshot; no network |
| `npm run engagement:intel:xai:probe:live` | ✅ refuses without `XAI_API_KEY`; no network on refusal path |
| `npm run engagement:intel:x-news:tiny-pilot` | ✅ dry mode; refuses without env + `--pilot`; no network |

## Hosted Backend Status

| Item | Status |
|---|---|
| Project ref | `qsciikhztvzzohssddrq` |
| Migrations applied | ✅ 0001–0007 |
| `submit-argument` deployed | ✅ ACTIVE v1 |
| `admin-users` deployed | ✅ ACTIVE v1 |
| `.env` configured | ✅ |
| Admin bootstrap SQL run | ✅ dev human promoted; verification row confirms `is_admin=true` |

## Next Recommended Steps

1. ✅ `admin-users` deployed
2. ✅ Admin bootstrap SQL run
3. ✅ Bot fixture runner repaired and first live run posted 7/7 moves (Stage 6.1.2.4b)
4. ✅ Stage 6.1.3 dry-run + `stress:10` live (10/10 rooms, 123/123 moves)
5. ✅ Stage 6.1.3.1 dry-corpus gate (10-scenario corpus written, 851 tests)
6. **Run `bot:fixture:corpus:10` (live)** — writes a single ~2.5k-line corpus Markdown for human engagement review
7. **If `corpus:10` reads usefully**, run `bot:fixture:corpus:50` and triage strongest / weakest rooms
8. **Live browser smoke (A–H)** + **UX triage of stress-generated rooms** — still operator-driven
9. **Stage 6.1.3.3 — tiny live X News pilot** (5 stories × 3 posts × 12 replies = up to 180 reply pairs; X API only, xAI optional + initially off, redacted local logs only)
10. Stage 6.1.4 — argument-room UX simplification informed by corpus engagement notes
11. Stage 6.1.5 — persistent resting status / claim standing from server
