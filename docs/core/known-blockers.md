# CDiscourse — Known Blockers

_Last updated: 2026-05-24 (Stage 6.4 / OPS-002)_

---

## RESOLVED — Previously Blocking

### ✅ Supabase Project Linked
Project `qsciikhztvzzohssddrq` is now linked (`supabase projects list` shows `●`).

### ✅ Migrations Applied
All 5 migrations (0001–0005) are applied to the hosted project. `npx supabase db push --dry-run` reports "Remote database is up to date."

### ✅ submit-argument Deployed
`submit-argument` Edge Function is ACTIVE (version 1) on the hosted project.

### ✅ `.env` Created
`.env` exists with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to real values. Gitignored.

### ✅ Post-Submit Refresh
`ArgumentTreeScreen` now accepts a `refreshRef` prop. `App.tsx` passes `refreshTreeRef` and calls it in `handleSubmitSuccess`. The tree re-fetches after a successful submit.

### ✅ Account / Profile Feature Missing
`AccountScreen` now shows email, masked user ID, role label (via `formatProfileRole`), and editable display name. `buildProfileUpdatePayload` explicitly excludes role/id/email — no client-side privilege escalation possible. See `docs/account-operations.md` and `docs/supabase-admin-ops.md`.

### ✅ Admin Foundation Deployed (Stage 6.1.2.1)
Migration 0007 applied; `admin-users` Edge Function deployed (ACTIVE v1); dev human bootstrapped to `role=admin` via untracked `scripts/admin/bootstrap-admin.local.sql`. Verification query confirms `is_admin=true`. Live browser smoke (sections A–H of `docs/testing-runs/2026-05-16-admin-smoke.md`) pending operator run.

### ✅ Bot Fixture Runner Live End-to-End (Stage 6.1.2.4b)
First live fixture run posted **7/7** moves for `sports-play-in` via normal auth + `submit-argument` (room `62305b8b-c11e-41a6-81b8-4c95daf73d2c`). Runner error classification, persona→side mapping, and parent-skipping repaired; fixture transitions and bodies aligned with the constitution and topic-satisfaction thresholds. No service-role key, no Anthropic. See `docs/testing-runs/2026-05-17-sports-play-in.md` and `docs/bot-fixture-runner.md`.

### ✅ QOL-041 Migration Deploy Chain — Reviewer Template Strengthened (OPS-001)

**Incident.** The QOL-041 work (#210, PR #255 at `a41dd3c`) shipped with a
SQL bug: 5 unqualified `debate_id` references in 3 INSERT-policy
`WITH CHECK` subqueries triggered `SQLSTATE 42702 ambiguous column
reference` on every `npx supabase db push` attempt. The reviewer of PR #255
approved the migration by structural read of the SQL ("well-formed per
design §5") without running the migration against a real Postgres. The
QOL-041.1 fix-forward attempt (#256, PR #257 at `df0a61d`) added a
subsequent migration to recreate the broken policies with qualified
references, but Postgres applies migrations in strict filename order — the
broken original always failed first, its transaction rolled back, and the
fix-forward migration never executed. The QOL-041.1 reviewer also approved
by read because Docker was unavailable on Windows.

**Recovery (QOL-041.2, #258, PR #259 at `6fcfdbf`).** The fix landed under
a doctrine-scoped exception to CLAUDE.md §8 ("Never edit an applied
migration"). The exception was permitted because the migration had never
been *applied* to any database — `npx supabase migration list --linked` at
2026-05-23T22:54Z confirmed the Remote column for `20260522000012` was
empty. The recovery edited the original migration in place to qualify the
5 ambiguous references and deleted the redundant fix-forward file. The
exception is one-time, narrowly scoped, factually justified, and documented
inline as a recovery-comment banner at lines 1–29 of the post-recovery
migration file. Future migration-bearing cards continue to follow the
standard never-edit-applied doctrine.

**Template update (OPS-001, #260).** The reviewer template at
`.claude/agents/roadmap-reviewer.md` now contains a mandatory subsection
titled "Migration-bearing card verification (mandatory)" that triggers on
any diff under `supabase/migrations/`. When Docker is available, reviewers
must run `npx supabase db reset --linked=false` and block on apply failure.
When Docker is not available, reviewers must document the limitation and
perform a heightened textual review against four named issue classes —
ambiguous column references in subqueries (QOL-041 motivating example),
column type mismatches, implicit ordering dependencies, and function /
trigger / extension dependencies. The full policy text and the four-class
table live in the reviewer template; the cross-references in this file,
in `CLAUDE.md` § "Supabase Conventions", and in `docs/core/agent-charters.md`
all point back to that canonical location.

### ✅ Pipeline Branch-Naming Misalignment + Worktree Orphan Accumulation (OPS-002)

**Incident.** Four consecutive autonomous pipeline sessions — QOL-039
(#268, PR shipped), RECON-001 (#272, PR shipped), QOL-040.3 (#274, PR
shipped), and QOL-036.1 (#273, PR shipped) — required push-time
refspec reconciliation between the `spawn-card.ps1` prompt's named
branch (`feat/<code>-<slug>`) and the implementer subagent's actual
working branch (`worktree-agent-<hash>`). All four shipped successfully
via `git push origin worktree-agent-<hash>:feat/<code>-<slug>`, but the
refspec is fragile (operator-typed each time, no automation) and the
mismatch leaks into review docs and operator-next-step lists where the
branch name is referenced. Separately, 96 orphan worktrees accumulated
under `.claude/worktrees/` (all marked `locked`), each tying up disk
space and blocking `gh pr merge --delete-branch` for the merged
card. The gap is operational hygiene, not correctness — the pipeline
shipped — but the friction compounds with each card.

**Root cause.** The `isolation="worktree"` runtime in the Claude Code
harness creates a worktree on a new local branch named
`worktree-agent-<hash>` (the runtime's convention, not configurable
from the subagent prompt). The `spawn-card.ps1` and `spawn-card.sh`
scripts compute and embed `feat/<code>-<slug>` into the agent
prompt — a branch name the runtime never adopts. The implementer
charter at `.claude/agents/roadmap-implementer.md:14` describes the
working directory as the `feat/<code>-<slug>` branch, but the
description was aspirational: the charter did not previously include a
rename step. The mismatch propagated through every subsequent
charter sentence that referenced the branch name.

**Resolution (OPS-002, #275).** Two coordinated changes:

1. **Rename step added to the implementer charter as a new Phase
   order step 1.** Before any baseline check or implementation, the
   implementer subagent runs `git branch -m feat/<code>-<slug>` to
   rename the auto-branch to the named feat branch. The rest of the
   pipeline (commits, charter sentences, operator push, PR title,
   squash-merge) then uses one consistent name. The `spawn-card.ps1`
   and `spawn-card.sh` scripts are unchanged; the implementer charter
   absorbs the alignment.

2. **Worktree cleanup procedure added to the reviewer charter as a
   new section "Post-merge worktree cleanup (operator step)."** The
   operator runs the procedure after each PR merges: `git worktree
   remove --force <path>` plus `git branch -D <branch>` for both
   branch-name forms (the auto-branch for pre-OPS-002 cards is
   preserved as a fallback). Cross-platform notes cover the
   PowerShell-vs-Bash invocation; a bulk pass for the 96 historical
   orphans is documented as operator-judgement-gated and is NOT
   automated by OPS-002.

**Lesson for future sessions.** Two rules:

- **Rule 1 (alignment):** The implementer charter is the canonical
  place to operationalise a branch-name expectation. When a script
  prints a branch name into a subagent prompt, the subagent's charter
  must include the step that makes the local branch match the
  printed name. Aspirational charter sentences ("your branch is X")
  do not configure runtime behaviour; the subagent must run the
  command. The spawn-card scripts remain the source of the *name*,
  but the implementer is the source of the *binding*.

- **Rule 2 (cleanup):** Worktree creation is automated; worktree
  removal is not. Every pipeline that uses `isolation="worktree"` for
  per-card work must document a per-card cleanup procedure adjacent
  to the success-path documentation. The procedure runs after merge,
  not before. Bulk cleanup of historical orphans is
  operator-judgement-gated because mis-identifying a non-merged
  worktree as orphan loses work.

The OPS-001 reviewer-template lesson and the OPS-002 alignment lesson
together form the foundation of the OPS-* series: OPS cards capture
process bugs that ship product correctly but accumulate operational
friction; they fix the process, not the product. Future OPS cards
follow the same shape (a single design doc, a verbatim lesson block,
a minimal-footprint implementer diff, and a verification table in the
reviewer doc that confirms the lesson is recorded).

---

## ACTIVE BLOCKERS

### 1. ANTHROPIC_API_KEY Must Be Rotated

**Status:** Security — requires manual action  
**Impact:** The ANTHROPIC_API_KEY that was set during the 2026-05-16 session was exposed in conversation. It should be rotated before the AI language-processing feature is enabled.

**Resolution (manual — do not paste key into chat):**
1. Go to `console.anthropic.com` → API Keys → revoke the exposed key
2. Create a new key
3. Update the Supabase secret:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=<new-key>
   ```

This blocker does NOT affect the MVP demo — `AI_LANGUAGE_PROCESSING_ENABLED=false` by default and no client-side Anthropic calls exist.

---

### 2. Docker Unavailable — Supabase Local Never Validated

**Status:** Informational — not MVP blocking  
**Impact:** Migrations have been applied to hosted project (resolved), but local Supabase stack has never been validated with Docker.

If Docker Desktop becomes available:
```bash
npx supabase start
npx supabase db reset
npx supabase db status
npx supabase db lint
```

---

### 3. Live Manual Smoke Test Pending

**Status:** Partially unblocked — RLS recursion fixed; full walkthrough still needed  
**Impact:** The hosted backend is configured. Migration 0006 fixed the `debates` RLS recursion that caused the "infinite recursion" error in the browser.

**Resolution:** Run `npm run web -- --clear` and walk through `docs/browser-visual-test.md` sections A–K.

Items expected to work after migration 0006:
- Debates tab loads without policy error
- Auth sign-up / sign-in / sign-out
- Debate create / join / list
- Composer: type picker, side picker, body, validation preview
- Submit: submitArgumentDraft → Edge Function → argument row → success
- Post-submit: tree auto-refreshes via refreshRef (Stage 5.5.5)
- Server 422: error shown, draft preserved
- Idempotency: duplicate client_submission_id rejected

---

### 4. npm Install Peer Dependency Caveats

**Status:** Informational  
**Impact:** `npm install` may fail with peer dependency conflicts involving `jest-expo` and React 19

Use `--legacy-peer-deps` if needed. Do not use `--force`.

---

### 5. Deno Mirror Risk for Edge Functions

**Status:** Informational  
**Impact:** Edge Function URL imports may break if a mirror goes down

All Edge Function dependencies are imported by URL in `supabase/functions/`. If an import URL breaks, pin to a specific version tag.
