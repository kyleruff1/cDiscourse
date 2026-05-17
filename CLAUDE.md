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

Current stage: **Stage 6.1.3 dry-run gate complete** — Spicy bot stress-test suite added: `fixtures/argument-scenarios/topicBank.json` (8 categories × 4 topics), `scripts/bot-fixtures/{spicyLanguage,stressConfig,stressScenarioTemplates,generateStressScenarios,runStressBatch}.js`, 3 stress templates (12 / 11 / 13 moves) honoring all Constitution `transition_*` rules and the `concession_integrity` marker requirement, deterministic seeded generation, JSONL event logging, safe Markdown summary. New npm scripts: `bot:fixture:generate-stress`, `bot:fixture:stress:dry`, `bot:fixture:stress:10`, `bot:fixture:stress:50`. Validator extended with `validateStressScenario` (10–15 moves, transitions, concession markers) and `ScenarioCategory` widened with 7 stress categories. `logs/` and `fixtures/generated-scenarios/` gitignored. **824 tests / 28 suites passing**, lint and typecheck clean. `npm run bot:fixture:stress:dry` reports 0 plan issues on 10 scenarios. Live stress runs (`stress:10`, `stress:50`) NOT yet executed. Stage 6.1.2.4b (bot fixture runner repair) and earlier remain complete. Next: operator-driven `bot:fixture:stress:10`; on green gate, `stress:50` and triage.

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
