# CDiscourse — Known Blockers

_Last updated: 2026-05-24 (Stage 6.4 / OPS-003)_

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

### ✅ Worktree Cleanup Procedure Hardened — Lock Force, Long Paths, Filesystem Orphans, Branch Refs (OPS-003)

**Incident.** The 2026-05-24 cleanup session — the first real-world
execution of OPS-002's "Post-merge worktree cleanup (operator step)"
procedure against the 96 orphan worktrees that accumulated before
OPS-002 shipped — surfaced four distinct procedural gaps that the
OPS-002 text did not address. Session outcome was a success: 96
git-registered worktrees removed (73 cat-3 merged + 16 cat-4 abandoned
+ 7 cat-5 detached-HEAD), 8 filesystem orphans removed (5 unregistered
`agent-*` directories at ~289 MB each + 3 zero-byte session directories),
218 local branches deleted in one bulk pass, 8.93 GB of disk space
recovered (48.56 GB → 57.49 GB free), and typecheck + lint + spawn-card
regression test all green post-cleanup. But each of the four gaps
required an in-session workaround that OPS-002 did not document; the
next operator running cleanup would have rediscovered and re-solved
each one.

**Root cause.** OPS-002 designed the procedure from the per-card model:
one card ships, the operator removes one worktree and one branch. The
2026-05-24 session was the first invocation against accumulated
historical debt (96 worktrees, 218 branches, 8 filesystem orphans), and
the per-card model did not generalise:

1. **EC-1: `--force` insufficient for agent-locked worktrees.** OPS-002
   step 2 used `git worktree remove --force` (single force). Git
   distinguishes "locked" from "in-use" and emits `use 'remove -f -f'
   to override or unlock first` when given only single force against
   an agent-locked worktree. The Claude `isolation="worktree"` runtime
   marks every worktree as locked, so 96/96 worktrees failed step 2 on
   the first attempt. The fix is mechanical (`--force` → `-f -f`).

2. **EC-2: Windows MAX_PATH (260 chars) blocks deep `node_modules`
   removal.** After EC-1 was fixed, 14/96 worktrees still failed with
   `error: failed to delete '<path>': Filename too long`. Nested
   `node_modules/jest/.../node_modules/...` paths exceed Win32
   MAX_PATH and `git worktree remove` uses the standard file API. The
   fix is the UNC long-path prefix from PowerShell:
   `Remove-Item -Path "\\?\<absolute-path>" -Recurse -Force` followed
   by `git worktree prune`. Linux and macOS operators do not hit this.

3. **EC-3: Filesystem orphans exist outside git's admin state.** After
   all 96 git-registered worktrees were removed and `git worktree
   list` showed only main, `Get-ChildItem .claude/worktrees/` still
   listed 8 directories that git's admin state never knew about
   (either past-session worktrees that were never `git worktree add`-ed
   or worktrees that were pruned while leaving their directory
   behind). The OPS-002 per-card iteration over `git worktree list`
   misses these by construction. The fix is a `Compare-Object` sweep
   between filesystem and git's list, with per-orphan operator
   decision (default: remove, since by definition no git association
   exists to preserve).

4. **EC-4: Local branch refs accumulate independently of worktree
   removal.** After all worktrees were removed, `git branch --list
   'feat/*' 'worktree-agent-*' 'review*' 'claude/*' 'ev005-expand'`
   returned 218 branches with no associated worktree and no associated
   remote (squash-merge `--delete-branch` had cleared remotes during
   each card's merge). OPS-002's per-card step 3 deletes the current
   card's branch only; historical accumulation from pre-OPS-002
   sessions (where per-card deletion was never run) and auto-naming
   patterns from past conventions survive until explicitly cleared.
   The fix is a periodic pattern-based bulk pass (`git branch -D`)
   that is idempotent, safe (local refs only), and runnable
   independently of any worktree removal.

**Resolution (OPS-003, #277).** The
`.claude/agents/roadmap-reviewer.md` section "Post-merge worktree
cleanup (operator step)" is rewritten in place to address all four
gaps. The section title and framing ("operator step, not reviewer
subagent's") are preserved per OPS-002; only the body content
changes. The per-card block uses `-f -f` (EC-1 fix); a new
**Windows long-path workaround** subsection covers EC-2 with the
trigger condition `Filename too long`; two new top-level
subsections **"Filesystem orphan sweep"** and **"Periodic
branch-ref cleanup"** cover EC-3 and EC-4. The existing
bulk-cleanup-of-historical-orphans block is preserved and updated
to use `-f -f`. The
`<!-- OPS-003: EC-N handler -->` HTML comment markers placed above
each new handler block provide the regression test's contract
surface (§4). No production code, no migration, no Edge Function,
no `spawn-card.ps1` / `spawn-card.sh` edit, no
`.claude/agents/roadmap-implementer.md` edit, no
`.claude/agents/roadmap-designer.md` edit. OPS-002's
implementer-charter rename step is preserved unchanged.

**Lesson for future sessions.** Three rules:

- **Rule 1 (force-flag granularity).** When a command uses `--force`
  to override one condition (e.g. "in-use"), the same command may
  require a stronger force-flag combination (e.g. `-f -f`) to override
  a *different* condition (e.g. "locked"). Read the error message
  carefully: git names the override required. The OPS-002 procedure
  was correct for the in-use case but incomplete for the locked case;
  OPS-003 captures both.

- **Rule 2 (cross-platform path limits).** Windows MAX_PATH (260
  chars) is a real production constraint on a procedure that walks a
  deep dependency tree. Procedures that work on Linux/macOS may fail
  on Windows with no warning until the deepest path is touched. When
  documenting a cleanup procedure, include the platform-specific
  long-path workaround as a named subsection with the trigger error
  string. The fix is the `\\?\` UNC prefix on Windows; macOS/Linux
  procedures don't need it.

- **Rule 3 (admin-state vs filesystem-state divergence).** Procedures
  that iterate over a tool's admin state (e.g. `git worktree list`)
  miss state that exists outside that admin state (filesystem
  orphans). When the admin state and filesystem state are *expected*
  to be coupled (the tool creates both in lockstep), any divergence
  is by construction an orphan that the per-iteration procedure
  cannot detect. The fix is a separate `Compare-Object` sweep that
  enumerates both and surfaces the diff. The same pattern applies to
  branch refs: `git worktree remove` clears worktree admin state but
  leaves branch refs intact, and the per-card deletion catches one
  branch at a time — historical accumulation requires a separate
  pattern-based bulk pass.

The OPS-001 reviewer-template lesson, the OPS-002 alignment lesson,
and the OPS-003 cleanup-hardening lesson together form the
foundation of the OPS-* series: OPS cards capture process bugs that
ship product correctly but accumulate operational friction; they fix
the process, not the product. Future OPS cards continue to follow
the same shape (single design doc, verbatim lesson block,
minimal-footprint implementer diff, verification table in the
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
