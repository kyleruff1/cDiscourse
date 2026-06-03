# CDiscourse — Known Blockers

_Last updated: 2026-06-02 (MCP provider-reliability cutover arc + Stage-1 closeout; dependency-deprecation tracking). Live sources of truth: `docs/core/current-status.md`, `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, the `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-*` audits, and the 2026-06-02 roadmaps. This file is a curated index, not the manifest._

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

### ✅ PR-003 Storage Schema Comment Ownership (2026-05-24)

**Problem:** PR-003's migration
`20260525000016_pr_003_profile_avatars.sql` failed at apply time on
statement 12 (`COMMENT ON POLICY "profile-avatars: anyone can read" ON
storage.objects`) with `SQLSTATE 42501 must be owner of relation
objects`. The migration's transaction rolled back cleanly; remote
database was in pre-PR-003 state with PR-003's code already merged on
main (PR #280, SHA `cf59816`). The chain conditional gate caught the
failure correctly and deferred PR-004 to a fresh session.

**Root cause:** The Supabase `storage` schema's `objects` table is
owned by `supabase_storage_admin`, not by the standard migration
runner role. `CREATE POLICY ... ON storage.objects` works because
policy creation is granted to non-owners via Supabase's storage RLS
setup; `COMMENT ON POLICY ... ON storage.objects` requires
ownership that the migration role lacks. The OPS-001 four-class
textual review does NOT catch this — the SQL syntax is valid; the
privilege error only surfaces against a live Supabase instance.

**Resolution:** Removed the single offending `COMMENT ON POLICY ...
ON storage.objects` statement from migration 16 (the migration had
not applied to remote, so editing in place was doctrine-compliant —
distinct from the QOL-041.1 fix-forward precedent which applies only
to migrations that DID partially apply). The policy itself remained
intact; only its explanatory COMMENT documentation was removed.
Added an inline SQL `-- NOTE: ... REMOVED` comment block at the
removal site + a recovery header comment block at the migration top
documenting the decision and pointing back to this lesson. Re-pushed
migration successfully; deployed `upload-avatar` Edge Function;
smoke verification 16/16 passing. Recovery committed directly to
main per operator authorization (single-shot recovery; no PR-003.1
filed because the recovery scope is operator-side and the migration
had not previously shipped to remote).

**Lesson for future migrations:** Any `COMMENT ON {POLICY,TABLE,
COLUMN,...} ON storage.*` statement requires either:
(a) running as `supabase_storage_admin` (not available in standard
migrations),
(b) omitting the COMMENT entirely — preferred, since the policy body
itself + inline SQL `--` comments serve as the policy's
documentation,
(c) wrapping in a privilege-tolerant DO block:
```sql
DO $$ BEGIN
  EXECUTE $sql$ COMMENT ON POLICY "name" ON storage.objects IS '...' $sql$;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
```
Future migrations affecting the storage schema should be tested via
`npx supabase db reset --linked=false` (when Docker is available) OR
via the Supabase MCP `apply_migration` dry-run on a branch DB before
main-deploy to catch privilege issues that the OPS-001 textual
review cannot see. This pattern is a Class 4 gap (function/extension
dependencies) in the OPS-001 four-class checklist that the textual
review does not flag because the SQL is syntactically valid; only
the live apply surfaces the privilege boundary.

### ✅ PR-004 DROP COLUMN Before DROP POLICY Order Dependency (2026-05-25)

**Problem:** PR-004's migration
`20260525000017_pr_004_deprecate_avatar_pipeline.sql` failed at apply
time on statement 1 (`ALTER TABLE public.profiles DROP COLUMN avatar_path,
...`) with `SQLSTATE 2BP01 cannot drop column avatar_path of table
profiles because other objects depend on it (policy "profiles: users
update own — narrow" depends on column avatar_path)`. The original
migration ordered DROP COLUMN before DROP POLICY; the narrowed UPDATE
policy from migration 16 referenced the four avatar columns in its
WITH CHECK clause, blocking the column drop. Migration transaction
rolled back cleanly; remote DB was in post-PR-003 state.

**Root cause:** OPS-001 Class 3 (statement ordering dependency) gap.
The reviewer's heightened textual review did not trace the
cross-statement column-reference graph between the policy body and
the column drops, so the wrong ordering passed review. The
`profiles: users update own — narrow` policy created in migration
16 explicitly named all four avatar columns in its `WITH CHECK`
freeze clause; dropping the columns before dropping the policy
violates Postgres's dependency tracking.

**Resolution:** Edited migration 17 in place (rolled-back
transaction makes this doctrine-compliant — distinct from QOL-041.2's
in-place exception which applies only to migrations that DID
partially apply). Swapped steps 2 and 3 so the narrowed policy is
dropped BEFORE the columns it references. Added inline `-- 2026-05-25
RECOVERY` block at the swap site + recovery header at file top.
Re-pushed migration successfully; deleted `upload-avatar` Edge
Function; ran `npm install` to pick up `expo-image-picker` removal;
smoke verification 16/16 passing.

**Lesson for future migrations:** Any `DROP COLUMN` must be preceded
by `DROP` of every policy, index, view, trigger, or function that
references the column. The dependency graph is invisible to textual
review unless the reviewer manually traces it. The OPS-001 Class 3
checklist should be strengthened to include: "for every `DROP COLUMN`
or `DROP TABLE` statement, grep the entire migration set for the
column or table name and verify no `CREATE POLICY`, `CREATE INDEX`,
`CREATE VIEW`, `CREATE TRIGGER`, or `CREATE FUNCTION` body references
it earlier in the same migration or in any prior migration whose
object would be affected." Same testing path as the PR-003 storage
schema lesson: `npx supabase db reset --linked=false` (Docker) OR
Supabase MCP `apply_migration` dry-run on a branch DB.

**2026-05-25 follow-up:** `__tests__/deprecateAvatarMigration.test.ts`
assertion at line 82 was updated post-OPS-004 to match the
migration's post-hotfix DROP order. The test was originally written
against the pre-hotfix order (`columnDropIdx < narrowedDropIdx`) and
failed silently in `npm test` until OPS-004 surfaced the orphan debt
in its post-merge verification. The fix flipped the assertion to
`narrowedDropIdx < columnDropIdx` to match the shipped migration
(narrowed policy dropped BEFORE columns it references); the test's
logic is unchanged. Direct-to-main commit per the PR-003 and PR-004
recovery precedents; no separate pipeline card because the scope is
bounded to one test assertion plus this documentation footnote.
Full `npm test` now exits 0 cleanly (10734/10734, 427/427 suites).
The OPS-001 Class 3 strengthening from OPS-004 prevents the same
class of test-vs-migration drift from recurring on future cards.

### ✅ OPS-002 Stale-Worktree-Branch-Claim (2026-05-25)

**Problem:** PR-004's implementer subagent ran the OPS-002 charter
rename step (`git branch -m feat/PR-004-contact-information-update`)
which failed with `fatal: a branch named '...' already exists`. The
canonical branch was held by the prior designer worktree
(`agent-a75a7f3256dd3a767`). Even `git checkout feat/PR-004-...`
failed with `fatal: '...' is already used by worktree at ...`. The
implementer recovered via `git switch --ignore-other-worktrees
feat/PR-004-contact-information-update` + branch cleanup, but the
recovery is undocumented in the OPS-002 charter.

**Root cause:** The OPS-002 charter assumes the canonical branch
name is free when the implementer arrives. In practice, the
designer's prior worktree (created by `isolation="worktree"` during
the designer phase) holds the canonical branch reservation. When the
operator pushes the designer branch via the refspec workaround
(`worktree-agent-<hash>:feat/<code>-<slug>`) the remote tracking
ref takes the canonical name, and the implementer's subsequent
`git branch -m` collides.

**Resolution:** The workaround `git switch
--ignore-other-worktrees <name>` (followed by cleanup of the
implementer's own auto-generated branch via `git branch -d`)
unblocks the implementer when the canonical branch is held by a
clean prior worktree. The override is safe when the prior worktree
has no uncommitted work (which is typical post-designer).

**Lesson for future implementers (candidate OPS-004 fix):** The
OPS-002 charter rename step should be extended to handle the
stale-worktree-claim case explicitly. The recommended sequence:
1. `git branch --show-current` — capture the auto-branch name.
2. Try `git branch -m feat/<code>-<slug>` — succeeds if canonical is free.
3. On failure with "branch already exists":
   - Run `git worktree list` to identify which worktree holds it.
   - If that worktree is the designer's (post-design), apply
     `git switch --ignore-other-worktrees feat/<code>-<slug>`.
   - Delete the original auto-branch with `git branch -d
     worktree-agent-<hash>`.
4. Proceed with the baseline check.

The OPS-004 hypothetical card (now accumulating three signals:
spawn-card colon-vs-dash, storage schema COMMENT ownership, this
stale-worktree-claim) could fold all three into a single operational
hygiene sweep when the operator decides to file it.

### ✅ OPS-004 Pipeline Operational Hygiene Sweep (2026-05-25)

**Problem.** Four operational signals accumulated between the OPS-003 ship
date (2026-05-24) and the OPS-004 design date (2026-05-25):

1. **PR-004 DROP COLUMN ordering** (this file §
   "PR-004 DROP COLUMN Before DROP POLICY Order Dependency (2026-05-25)").
   Migration 17's `ALTER TABLE public.profiles DROP COLUMN avatar_path,
   …` failed at apply time on `SQLSTATE 2BP01 cannot drop column …
   because other objects depend on it (policy depends on column …)`.
   The OPS-001 reviewer template's Class 3 ordering checks covered
   `CREATE` order but not `DROP` order; the textual review missed
   the cross-statement column-reference graph.
2. **PR-003 storage schema COMMENT ownership** (this file §
   "PR-003 Storage Schema Comment Ownership (2026-05-24)"). Migration
   16's `COMMENT ON POLICY … ON storage.objects` failed at apply
   time on `SQLSTATE 42501 must be owner of relation objects`. The
   OPS-001 Class 4 function/extension dependency checks did not name
   the storage-schema ownership boundary; the textual review missed
   that the SQL was syntactically valid but ran under the wrong role.
3. **OPS-002 stale-worktree-branch-claim** (this file §
   "OPS-002 Stale-Worktree-Branch-Claim (2026-05-25)"). PR-004's
   implementer subagent ran the OPS-002 rename step and got
   `fatal: a branch named '…' already exists` because the canonical
   branch was held by the designer's prior worktree. The OPS-002
   charter's "STOP and surface" placeholder did not name the safe
   recovery path (`git switch --ignore-other-worktrees` + auto-branch
   cleanup), so the implementer had to re-discover it.
4. **OPS-002 §7 colon-vs-dash spawn-card regex** (deferred from
   OPS-002 as cosmetic). The PowerShell and bash spawn-card scripts'
   strip regex assumed a dash separator between the issue code and
   the title; modern colon-separated titles produced
   doubled-prefix slugs (`feat/OPS-002-ops-002-…` instead of
   `feat/OPS-002-…`). OPS-002 §7 pinned the current behaviour in the
   regression test and flagged the issue as out of scope; the fix
   accumulated into OPS-004.

**Root cause.** All four signals share the same shape: operational
boundaries that surface only at execution time, not at textual review
time. Postgres surfaces signals 1 and 2 only on `db push`; git
surfaces signal 3 only on the second worktree-claim attempt; the
spawn-card regex surfaces signal 4 only on the resulting slug. The
OPS-001 textual review and the OPS-002 rename charter are
structurally incapable of catching these classes of gap because the
gap only exists at the tool boundary the textual review cannot
exercise. The pattern is the OPS-* series' core insight: textual
review is necessary but not sufficient; some gaps require tooling
enforcement.

**Resolution (OPS-004, #282).** Four coordinated strengthening
deliverables, all in the process layer (no production code touched):

1. **OPS-001 Class 3 sub-check (e) for DROP COLUMN ordering.** The
   reviewer template's four-class table at
   `.claude/agents/roadmap-reviewer.md` Class 3 cell gains a new
   marker `(e)` requiring reviewers to grep the entire migration set
   for the column or table name and verify no `CREATE POLICY`,
   `CREATE INDEX`, `CREATE VIEW`, `CREATE TRIGGER`, or
   `CREATE FUNCTION` body references the dropped object earlier in
   the same migration or in any prior migration whose object would
   be affected. PR-004's exact failure mode is cited as the worked
   example.
2. **OPS-001 Class 4 sub-check (f) for storage schema COMMENT
   ownership.** The Class 4 cell gains a new marker `(f)` naming the
   `COMMENT ON … ON storage.*` privilege boundary with three ranked
   resolution options (preferred: omit; alternative: privilege-tolerant
   DO block; not-available: run as `supabase_storage_admin`). PR-003's
   exact failure mode is cited as the worked example.
3. **OPS-002 charter rename step extension (lines 49–53).** The
   "STOP and surface" placeholder is replaced with the documented
   recovery sequence: `git worktree list | grep` to identify the
   holder, `git -C <other-worktree> status -sb` to inspect for clean
   state, then `git switch --ignore-other-worktrees feat/<code>-<slug>`
   plus `git branch -d worktree-agent-<hash>` cleanup. The STOP escape
   hatch is preserved for every case the sequence does not cover
   (uncommitted work, active session, divergent HEAD).
4. **spawn-card regex correction.** A single-character-class change
   in each spawn-card script — `-` → `[-:]` inside the existing
   strip regex (`^$Code\s*[-:]\s*` in PS1; `^${CODE}[[:space:]]*[-:][[:space:]]*` in
   bash). The regex now matches both legacy dash and modern colon
   separators. The four pre-OPS-004 shipped cards' branch names
   remain immutable in PR history.

**Meta-lesson for future sessions.** Operational signals that recur or
accumulate warrant tooling enforcement beyond textual documentation.
The OPS-001 textual review catches the classes it names; the classes
it does not name (DROP ordering, storage COMMENT ownership) require
either an additional textual sub-check (OPS-004's path) or a live
apply gate (Docker-when-available, per OPS-001 §2.3). The OPS-002
charter language is a starting contract; recovery paths discovered
empirically (the PR-004 stale-worktree-claim) need to be folded
back into the charter as named sequences, not left as
"STOP and surface" defaults. The spawn-card regex bug ran for at
least four shipped cards before OPS-004 absorbed it; future cosmetic
gaps deferred from one OPS card should be filed as their own
follow-up issue (per OPS-002 §7's documented option) rather than
remaining in a designer's note. Future OPS cards continue to follow
the same shape (single design doc, verbatim lesson block,
minimal-footprint implementer diff, verification table in the
reviewer doc that confirms the lesson is recorded).

The PR-003 entry (this file § "PR-003 Storage Schema Comment Ownership
(2026-05-24)"), the PR-004 entry (this file § "PR-004 DROP COLUMN
Before DROP POLICY Order Dependency (2026-05-25)"), and the OPS-002
stale-worktree-claim entry (this file § "OPS-002
Stale-Worktree-Branch-Claim (2026-05-25)") remain as the historical
record of each individual incident; OPS-004 is the consolidated
strengthening response that closes all four gaps with one card.

### ✅ MCP Provider-Reliability Cutover — the chronic `argument_scheme` cluster (2026-06-02)

**Incident.** Family H's production-enable smoke FAIL'd at the 8-family load (PR #407 → rollback PR #408): `mcp_api_error` / `provider_server_error` holes across multiple family cells under burst. Root cause (#371, #373): a per-isolate in-memory provider-concurrency semaphore (`mcp-server/lib/providerConcurrency.ts`) is structurally incapable of bounding GLOBAL Anthropic concurrency under Deno Deploy's dynamic multi-isolate fan-in (cap=5 PARTIAL, cap=2 FAIL → the 15s Edge→MCP timeout fires). A SEPARATE packet/schema response-shape cluster (Family E `argument_scheme` + F `critical_question`, on the `evidenceSpan.*` rawKey paths) compounded it.

**Resolution (the arc, PR #411→#432).** Two coherent fixes:

1. **Capacity/concurrency → the ARCH-001 Postgres async classifier queue** (chosen over the rejected Deno-KV limiter #373). Classification moved OFF the synchronous 15s submit path; linearizable; bounded drainer concurrency `C=3`, `MAX_ATTEMPTS=4`, backoff `[30,120]s`.
2. **Packet/schema cluster → the STRICT RESPONSE-SHAPE CONTRACT** (PR #421/#423): key-set equality + null-for-false + per-rawKey reinforcement in the Family E/F prompts. Eliminated to terminal — two consecutive PASS-LOAD drills (#425/#426, 56/56, 0 dead-letter).

**Outcome.** Stage 1 (1% routing) armed (#428) → synthetic launch-qualification PARTIAL (#429) → **CLOSED at `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`** (#431), routing disarmed to baseline. The mechanism is synthetically qualified; real-organic-load handling is deferred to a launch-time ramp decision (zero organic traffic, pre-launch). See `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, the `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-*` audits, and the 2026-06-02 A-G / H-I-J roadmaps. **The remaining family gates + the residual transient floor are tracked under ACTIVE BLOCKERS below (items 1–4), not as resolved.**

---

## ACTIVE BLOCKERS — current state (2026-06-02)

> This section is a curated index of what is genuinely open. The per-card detail lives in the live sources named at the top of this file; do not duplicate it here.

### 1. MCP queue routing above 1% — GATED (launch-time decision)

**Status:** Gated resting state, not a defect.
Stage 1 (1% routing) is **CLOSED at `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME`**; routing is **disarmed to baseline** (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false` / `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`). The queue is synthetically qualified but has handled **zero organic routed cells** (pre-launch). 5% → 25% → 50% → 100% each require real organic evidence + a SEPARATE operator authorization. **No audit auto-advances the percentage; the real ramp is a launch-time decision, not a scheduled ladder.** Re-arming requires re-scheduling `cutover-health-monitor-tick` first and the canary-then-burst discipline. See the A-G stability roadmap.

### 2. Family H / I / J production — FROZEN

**Status:** Gated on provider reliability proven at higher load + per-family operator cards.
`supabase/functions/_shared/booleanObservations/familyRegistry.ts` H/I/J `productionEnabled: false` (lines 106/111/116). **H (`claim_clarity`)** failed its production-enable smoke at the 8-family load (PR #407 → rollback #408 — the canonical incident); the now-qualified queue is the substrate that should eventually unblock it, but H needs a real higher-load reliability proof. **I (`thread_topology`)** is chained behind H and is mixed-source — it needs its `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Edge entry or admin_validation/production fails `mcp_validation_failed`. **J (`sensitive_composer`)** is dormant by design (`docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`: N=0 production cards under current disposition). Do NOT flip any flag without a separate operator card. See the H-I-J integration roadmap.

### 3. Residual transient provider-failure floor + the lone Family-F dead-letter

**Status:** **RESOLVED 2026-06-03 — deployed + verified in production.** R3 disambiguation done 2026-06-02; F-hardening implemented + merged (PR #443, `f529edb`); deployed to Deno Deploy + production-verified 2026-06-03 (hosted smoke 23/23; smoke-only canary-then-burst → 9/9 `critical_question` first-attempt, **0** `unstated_assumption` dead-letter). The residual transient floor remains a documented within-budget reality, not a blocker.
A low transient floor (~2–4% per-attempt `provider_server_error`) is absorbed by the 4-attempt retry budget. The ONE isolated Family-F (`critical_question`) cell (argId `9ef5aab5…`, a **synthetic** smoke-tagged qualification-burst arg — `organic_non_smoke_routed_args = 0`) that exhausted all 4 attempts was disambiguated via the Deno Deploy R3 `boolean_observation_tool_error` log: it is a **deterministic packet-shape residual** (`validation_failed` on `evidenceSpan.unstated_assumption`; 5/5 `packet_invalid`, 0 ban-list, 61 healthy Anthropic 200s), **NOT** a provider-side 5xx — the queue's `provider_server_error` sub_reason is an Edge-adapter bucketing artifact. It did **not** change the `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` verdict (organic = 0). **Resolution:** the fix (design `docs/designs/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md`, PR #441) extends the PR #421/#423 rule-6 RAWKEY-SHAPE REINFORCEMENT to `unstated_assumption`; implemented + merged (PR #443, `f529edb`), deployed to Deno Deploy, and **production-verified 2026-06-03** (§ 13 of the Stage-1 cutover audit): hosted smoke 23/23; smoke-only (`PERCENTAGE=0`, 0% organic) canary-then-burst → **9/9 `critical_question` first-attempt, 0 `unstated_assumption` dead-letter**; the lone burst dead-letter was a within-budget provider-side Family-E (`argument_scheme`) transient (`validator_path = null` per `failure_detail`, so no Deno-log pull needed). Routing disarmed to baseline (`2026-06-03T03:04:54Z`). A 5% ramp remains a separate launch-time decision. Full evidence: §§ 12–13 of the Stage-1 cutover audit + `docs/reviews/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md`.

### 4. `failure_detail` persistence — DEPLOYED + MERGED (PR #432, `c90e1a5`)

**Status:** **RESOLVED 2026-06-02.**
`OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE` (PR #432) shipped a leak-safe `failure_detail jsonb` so classifier failures are self-describing (no more Deno-log pulls for triage). The mandatory deploy ordering was followed: migration applied FIRST via `npx supabase db push --linked` (routing disarmed) and verified (`failure_detail` column + 9-arg `finalize_classifier_job` present, 8-arg gone), THEN merged (Edge auto-deployed the drainer). Future `critical_question` `provider_server_error` cells now persist `detail.serverReason` + `validator_path` straight to the DB row — the next recurrence of the § 3 packet-shape residual is a one-query read, no R3 log pull needed.

### 5. Deprecated build/test dependencies — tracked (OPS-DEPS-001..004, issues #433–#436)

**Status:** Dev/test/build-time only — NOT in the production runtime.
The Netlify deploy log warns on 8 deprecated transitive build/test packages (from jest@29 / jsdom@20 / RN dev-middleware / Expo config / xcode). `inflight@1.0.6`'s "leaks memory" is a **CI/test-process** leak, not user-facing; `glob@7.2.3` carries real CVEs. Tracked, grouped by fix: **#433** (jest→v30, p1 — clears the leak + CVEs + 3 jsdom deprecations in one bump), **#434** (remove `@testing-library/jest-native`, the only direct dep), **#435** (`rimraf`), **#436** (`uuid`).

### 6. ANTHROPIC_API_KEY rotation — verify

**Status:** Security — verify; manual only.
A key exposed in the 2026-05-16 session should have been rotated. The current production key lives in **Deno Deploy env vars** (server-side only; the MCP server runs there — see `OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` §4). Confirm the 2026-05-16-exposed key was revoked. NEVER paste a key into chat; the operator rotates via the Deno Deploy dashboard (and `SEMANTIC_REFEREE_MCP_TOKEN` / `MCP_SERVER_BEARER_TOKEN` if rotating the bearer).

### 7. Docker unavailable — migration verification is textual

**Status:** Informational — affects migration-bearing review rigor.
Docker Desktop is unavailable, so migration-bearing cards get the OPS-001 heightened TEXTUAL review (four issue classes) instead of `npx supabase db reset --linked=false`. Live apply still surfaces privilege/ordering issues the textual review can miss (see the PR-003 / PR-004 incidents in the RESOLVED section). If Docker becomes available, run `npx supabase start && db reset && db status && db lint`.

### 8. Deno mirror risk for Edge Functions

**Status:** Informational.
Edge Function deps are URL-imported in `supabase/functions/`. If an import URL/mirror breaks, pin to a specific version tag.

---

_Obsolete (resolved by progress, removed from ACTIVE in the 2026-06-02 refresh): the former "Live Manual Smoke Test Pending" (a Stage-5 migration-0006 RLS-recursion item) and the "npm peer-dependency `--legacy-peer-deps`" caveat — the app is at Stage 6.4+ and `npm ci` installs cleanly in the production Netlify deploy._
