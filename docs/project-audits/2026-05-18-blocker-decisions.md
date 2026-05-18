# 2026-05-18 — Blocker decisions

Decision memo covering the three blockers surfaced after the overnight audit
(`2026-05-18-overnight-work-audit.md`):

1. GitHub CLI runner blocker on Windows.
2. Local-only `.claude/worktrees/` directory leaking into `git status`.
3. Roadmap ordering — EV-002 (source-chain popover) sits at the top of the
   open queue but logically depends on EV-001 (evidence object model).

Audit pass — docs + minimal fix only. No Supabase mutation, no AI/API calls,
no `.env*` edits, no service-role use, no live pilots.

---

## 1. Tooling blocker — GitHub CLI runner

### Diagnosis: **C — gh works directly, but `agentIssueRunner.js` hardcoded the wrong Windows executable.**

### Evidence

```
> where.exe gh
C:\Users\kyler\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe

> gh --version
gh version 2.92.0 (2026-04-28)

> gh auth status
✓ Logged in to github.com account kyleruff1 (keyring)
  Token scopes: 'gist', 'project', 'read:org', 'repo', 'workflow'

> npm run github:agent:queue
Error: failed to list open issues (gh exit code null)
    at fetchOpenRoadmapIssues (scripts/github/agentIssueRunner.js:269:11)
```

`gh --version` and `gh auth status` succeed. The runner fails with
`spawnSync` returning `status: null` — ENOENT — because the previous
implementation was hard-wired to `gh.cmd` on Windows:

```js
return process.env.GH_BIN || (process.platform === 'win32' ? 'gh.cmd' : 'gh');
```

WinGet installs a real `gh.exe`. There is no `gh.cmd` on this machine, so
`spawnSync` exits with `status: null` and the runner throws the misleading
`exit code null` error.

Confirmation: setting `GH_BIN` to the absolute `gh.exe` path made both
`queue` and `ledger --dry` succeed against the runner.

Auth scope is **not** the blocker — `project` is already present.

### Fix applied

`scripts/github/agentIssueRunner.js`:

- Replaced the single-shot `ghBin()` with `resolveGhBin({ env, platform, spawn })`
  that probes candidates in order:
  1. `env.GH_BIN` if set.
  2. On `win32`: `gh.exe`, then `gh.cmd`, then `gh`.
  3. On non-Windows: `gh`.
- A candidate is "working" when `<bin> --version` exits 0. First working
  candidate wins. Result is cached for the process lifetime.
- ENOENT-style spawner throws are caught and treated as a failed candidate,
  so the resolver keeps trying.
- When nothing resolves, the error message names every candidate tried and
  tells the operator exactly how to set `GH_BIN` on the current platform.
- `resolveGhBin` is exported for tests.

`__tests__/agentIssueRunner.test.ts`: +10 tests cover GH_BIN override,
`gh.exe` preferred on Windows, `gh.cmd` fallback, bare `gh` fallback,
non-Windows path, ENOENT-style throw handled, no probing past the first
working candidate, and the directive error message.

`docs/agent-workflow.md`: new "Troubleshooting — GitHub CLI on Windows"
section documenting the resolution order, the WinGet exit-43 false-fatal
pattern, and the exact `$env:GH_BIN` line to paste when an absolute path is
needed.

### Verification

```
> unset GH_BIN; npm run github:agent:queue        # PASS
> unset GH_BIN; npm run github:agent:ledger -- --dry  # PASS
> npx jest __tests__/agentIssueRunner.test.ts     # 65 / 65 PASS (was 55)
```

### Operator action needed

None for the tooling fix itself. If a future Windows machine has neither
`gh.exe` nor `gh.cmd` on PATH, the runner now prints a directive error
telling the operator to install GitHub CLI or set `GH_BIN`.

---

## 2. Local artifact blocker — `.claude/worktrees/`

### Diagnosis

The agent worktree directory is created by `isolation: "worktree"` when the
designer / implementer / reviewer agents run. It is local-only, ephemeral,
and already on `SAFE_STAGE_DENYLIST` in `agentIssueRunner.js`:

```js
/^\.claude\/worktrees(\/|$)/,
```

It does **not** belong in git. Leaving it untracked just clutters
`git status` and risks accidental `git add .` staging.

### Decision: gitignore it.

`.gitignore` now ignores `.claude/worktrees/` with a comment that mirrors the
denylist source of truth. The denylist regex stays — it remains the runtime
guard against staging via any path that bypasses `.gitignore` (e.g., a
forced `git add -f`).

### Verification

```
> git status --short
 M .gitignore
 M __tests__/agentIssueRunner.test.ts
 M docs/agent-workflow.md
 M scripts/github/agentIssueRunner.js
```

`.claude/worktrees/` no longer appears.

---

## 3. Roadmap dependency blocker — EV-001 → EV-002

### Diagnosis

After the tooling fix, `npm run github:agent:queue` returns:

```
#  prefix      pri  rel   eff  title
15 EV-002      p0   6.6   m    EV-002 - Source-chain popover
 5 VG-002      p0   6.6   l    VG-002 - Gradient wave rail
 7 BR-001      p0   6.6   l    BR-001 - Tangent kink model
14 EV-001      p0   6.6   l    EV-001 - Evidence object model v1
```

`EV-002` sorts to the top because its effort is `m` and `EV-001` is `l` —
the comparator does not know about logical dependencies.

Reading both issues:

- **EV-001** (#14, effort L): defines `EvidenceArtifact { id, argumentId,
  kind, label, url?, sourceText?, quote?, sourceChainStatus, risk,
  addedByUserId, createdAt }`. Source-chain status enum + risk enum + the
  rule that missing evidence only blocks explicit Evidence posts.
- **EV-002** (#15, effort M): one-click popover that reads
  `sourceChainStatus` and routes to the right composer preset — `No source
  → Ask for source`, `Source no quote → Ask for quote`, `Both → Inspect
  receipt`, `Broken → Source trail weak`, `Primary present → Source trail
  anchored`.

EV-002 reads the very fields EV-001 defines. Implementing EV-002 first
would require either (a) inventing those fields ad-hoc and migrating later,
or (b) building EV-002 as a model-less placeholder that can only render
"Ask for source" because no other state exists yet. Both are net-negative.

### Decision

**Do EV-001 next. Defer EV-002 until EV-001's model is committed.**

The queue comparator should not be changed to encode this — dependency
ordering belongs in the card body / design doc, not in a runner heuristic
that would mis-fire elsewhere.

Alternative non-blocked P0 / 6.6 cards if a different lane is preferred:

- **#5 VG-002** — Gradient wave rail. Pure visual grammar. No model
  dependency.
- **#7 BR-001** — Tangent kink model. Branch-lane geometry. Independent of
  Evidence.

Recommendation: **#14 EV-001** first, because it unblocks both EV-002 and
the rest of Epic 6, and 6.6 ("Branches and evidence") is the active
release.

### How to apply

The next `roadmap-designer` invocation should target `EV-001`, branch
`agent/14-ev-001`. The three-agent loop runs as documented in
`docs/agent-workflow.md`. EV-002 stays in the queue and is the natural
follow-up once EV-001 lands.

---

## 4. Project drawdown blocker

No new drift discovered in this pass. The overnight audit
(`2026-05-18-overnight-work-audit.md`) already corrected:

- BRAND-001 Phase: Backlog → Done.
- HOST-003 Status+Phase: In Progress → Done (issue was already closed).
- Ledger rows appended for all 10 overnight-merged roadmap cards.

The runner queue now lists 19 open roadmap issues, all consistent with
their GitHub state. No issue closures applied in this pass — closure only
happens when commit body contains `Closes #<n>` and acceptance criteria
are clearly met, which is not the case for any of the remaining cards.

A new card is being filed for the tooling fix itself — see
`QOL-021 — Fix GitHub CLI binary resolution on Windows` (filed as part of
this commit, status set to whatever phase reflects "this commit fixes it").

---

## 5. Verification summary (post-fix)

| Check | Result |
|---|---|
| `npx jest __tests__/agentIssueRunner.test.ts` | 65 / 65 pass (+10 new) |
| `npm run github:agent:queue` (no GH_BIN) | works, 19 issues listed |
| `npm run github:agent:ledger -- --dry` (no GH_BIN) | works, full ledger rendered |
| `.claude/worktrees/` in `git status` | no longer shown |
| Secrets in diff | none |
| Verdict tokens in diff | none |
| Raw X identifiers in diff | none |
| Forbidden paths in diff | none |

Full suite verification (`npm run typecheck`, `npm run lint`,
`npm run test`) is captured in the commit body.
