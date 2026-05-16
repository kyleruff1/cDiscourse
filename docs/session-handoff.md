# CDiscourse — Session Handoff Guide

How to resume work in a new Claude Code session after compaction or interruption.

---

## How to Resume After Compaction

1. Open the project root: `C:\Users\kyler\cdiscourse\debate-constitution-app`
2. Run the checkpoint: `npm run checkpoint`
3. Read `docs/current-status.md` — confirms what is done, stubbed, and blocked
4. Read `docs/known-blockers.md` — active issues that affect what commands you can run
5. Check git status: `git status`
6. Do NOT start new feature work until `npm run typecheck` and `npm run test` pass

---

## Exact Command to Start From Project Root

```bash
npm run checkpoint && npm run typecheck && npm run test
```

All three must pass before proceeding with any implementation.

---

## Files Claude Should Inspect First

| Priority | File | Why |
|---|---|---|
| 1 | `CLAUDE.md` | Project rules, current stage, security constraints |
| 2 | `docs/current-status.md` | What works, what is blocked, what is stubbed |
| 3 | `docs/known-blockers.md` | Active blockers — affects what you can run |
| 4 | `docs/implementation-plan.md` | Stage-gated build order and verification steps |
| 5 | `src/domain/constitution/engine.ts` | Core rules engine — read before touching anything nearby |
| 6 | `src/domain/constitution/types.ts` | Canonical domain types |

---

## What Not to Modify Accidentally

- **`src/domain/constitution/engine.ts`** — Pure TS only. No async, no imports from React or Supabase. Any import added here breaks Edge Function compatibility.
- **`supabase/migrations/`** — Never edit an already-applied migration. Write a new numbered file (`0005_`, etc.) instead.
- **`supabase/functions/_shared/constitution/`** — Mirrors `src/domain/constitution/`. Both copies must stay in sync manually. There is no build step that copies them.
- **`.env`** — Gitignored. Never commit. Never log its contents.
- **`SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY`** — These must never appear in any file under `src/`, `app/`, or any committed config file.

---

## Current Architectural Invariants

1. **Rules engine is pure.** `src/domain/constitution/engine.ts` has zero side effects, zero async, zero network imports. Verify before any edit.

2. **Dual-layer constitution code.** `src/domain/constitution/` (client) and `supabase/functions/_shared/constitution/` (Edge Functions) are parallel manual copies. Keep them in sync.

3. **RLS on every table.** No table may have RLS disabled. Service role bypasses RLS for Edge Functions — that is by design, not a vulnerability.

4. **Flags are advisory only.** No flag ever automatically hides, deletes, or modifies content. AI-sourced flags always set `authoritative: false`.

5. **Soft-delete only.** Arguments use `is_deleted = true`. Flags use `dismissed = true`. Hard deletes are not permitted.

6. **Constitution is immutable after insert.** `constitution_versions` rows are write-once. Never update or delete them.

7. **Migration sequence is sacred.** Migrations apply in numbered order. An applied migration must never be edited.

8. **Stage gate discipline.** Do not implement a later stage's features until the previous stage's verification commands pass.
