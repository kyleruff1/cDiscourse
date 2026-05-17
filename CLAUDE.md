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

Current stage: **Stage 6.1.3.2 complete (engagement-intelligence scaffold)** — Compliant scaffold for X public-reply epidemiology + xAI structured stance classification. Both live APIs are **DISABLED by default**; scripts refuse to call out unless env flags are explicitly `true` AND `--pilot` is passed on the CLI. New module `src/features/engagementIntelligence/` (pure TS: types, lexicons, two-axis agreement+disagreement scalar with `coexistenceScore`, redaction, rule-candidate builder, xAI prompt/schema/validator/merger). New scripts `scripts/engagement-intelligence/` (env loader, news plan, X API client stub, news/reply collectors that refuse live runs, normalizer, offline analyzer, Markdown report writer, xAI runtime CLI). Synthetic fixture with 24 reply pairs covering strong/weak/mixed stances + receipt/quote/definition/scope/causal/value/logic challenges + counterexample/tangent/joke/unclear/concession+rebut/etc. 4 new test files (139 new tests) verify scalar, redaction, xAI compliance contract, and disabled-by-default X API behavior. **990 tests / 33 suites passing**, typecheck/lint clean. `.env.engagement-intelligence.example` documents the kill switches. Live X / xAI calls NOT executed. Stage 6.1.3.1 (live corpus:50) remains valid.

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
