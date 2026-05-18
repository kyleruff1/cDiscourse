# Agent workflow — CDiscourse

Canonical workflow every CDiscourse agent session follows when working an
issue from the GitHub Project board down to a verified commit and a
project sign-off.

> **One issue, one branch, one commit.** Do not mix issues. Do not let
> two agents share a dirty working tree — use `git worktree add` for
> parallel work.

The minimum safe cadence:

```
Queue → Claim → Branch/worktree → Implement → Verify → Commit → Signoff → Project status → (push, when authorized)
```

Project Status follows **verified commits**. An agent does not mark
`Done` because it "worked on the issue"; it marks `Done` only when the
commit footer, the tests, and the issue sign-off comment all agree.

---

## A. Select the issue

```
npm run github:agent:queue
```

The runner orders open roadmap issues by:

1. Priority (P0 → P1 → P2)
2. Release (6.5 → 6.6 → 6.7 → 6.8)
3. Effort (S → M → L → XL)
4. Issue number (lower first)

Prefer **P0 / release 6.5** items first. If the top item is too large
(spans multiple files / multiple acceptance criteria that don't share a
core), split it into child issues **before** writing any code. Add a
comment on the parent linking the children and update
`scripts/github/uxBoardCards.json` if the children are QOL-NNN cards.

---

## B. Claim the issue

```
node scripts/github/agentIssueRunner.js claim --issue <number> --agent <name>
```

Without `--apply` this is a dry-run that prints the exact `gh` commands
it would issue.

Claiming does three things:

1. **Comments on the issue:**
   > Agent started: `<agent-name>`. Branch: `<branch>`. Scope: `<short scope>`. Verification target: `<commands>`.
2. **Updates Project Status** to `In Progress` and **Project Phase** to
   `Build` (or `Design` if the agent is still in design mode).
3. **Adds label** `agent:active` if the label exists, or skips it
   silently. The runner does not create labels — that's a one-time
   `gh label create` by the operator.

If the runner cannot resolve the project item id for the issue, it
prints the manual fallback command and exits without comment.

---

## C. Implement

Read first, in order:

1. The issue body (`gh issue view <n> --json number,title,body,labels`).
2. `docs/ux-ui-project-board.md` for context on epic + release.
3. Any docs linked from the issue body.
4. The closest existing implementation (find a sibling file in the same
   epic and read its tests too).
5. `docs/current-status.md` and `docs/session-handoff.md` for invariants.

Write a short implementation note in your own scratch context (not on
disk) before editing. Then:

- Modify the **smallest** set of files that satisfies the acceptance
  criteria. No drive-by cleanup. No speculative abstractions.
- Add or update tests. Pure-TS / pure-JS models should hit the same
  coverage bar as the constitution engine.
- Update `docs/current-status.md` or `docs/ux-ui-project-board.md`
  **only when product status actually changes** — not when you start
  working, not when you push a commit that doesn't ship the user a new
  behaviour.
- Update `docs/product-status-ledger.md` with the row for this issue.

If you discover the issue is wrong (acceptance criteria contradict the
spec, dependencies aren't met, etc.), **stop, comment on the issue, set
Project Status to `Blocked` via the signoff command, and ask**.

---

## D. Verify

Targeted first, then full:

```bash
npm run skills:validate || true       # never write bot output through this path
npm run typecheck
npm run lint
npm test -- --testPathPattern="<targeted pattern>"
npm run test
```

If targeted tests fail, fix and re-run. Do not move to full suite until
targeted is green. Do not move to commit until full suite is green.

If a test failure is genuinely unrelated to the issue (pre-existing
flake, environmental), document it in the commit footer's `Notes:` line
**and** as a comment on the issue. Don't paper over it.

---

## E. Commit

Use this footer format on **every** issue-agent commit:

```
<type>: <issue-prefix-lowercase> <short outcome>

Refs: #<issue-number>
Product-Status: <Not Started|In Progress|Needs Review|Done|Blocked>
Project-Status: <Todo|In Progress|Done>
Project-Phase: <Backlog|Design|Build|Review|Done|Blocked>
Verification: typecheck=<pass|fail>; lint=<pass|fail>; tests=<count|fail>
Agent: <agent-name>
Scope: <one-line scope>
Docs: <yes|no — list of doc files touched if yes>
Notes: <optional — only when something unusual needs explanation>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

Rules:

- `Closes #<issue>` belongs in the body **only** if every acceptance
  criterion in the issue is satisfied by this commit. Otherwise use
  `Refs: #<issue>` so the issue stays open.
- `Product-Status: Done` is illegal if `tests=fail`. (`Blocked` is the
  honest answer.)
- Don't combine multiple issues in one commit. If your change naturally
  satisfies two issues, ship one, then rebase to ship the second.
- Stage **only safe files** (see denylist below). Never blanket-stage
  the working tree.

### Safe-to-stage denylist

Never `git add` any of these:

- `.env*`
- `logs/`
- `artifacts/diagnostics/`
- `node_modules/`
- `.expo/`
- `.claude/worktrees/`
- raw JSONL (`*.jsonl` under `logs/`, `data/`, `artifacts/`)
- raw X data (anything under `data/engagement-intelligence/raw/`)
- screenshots with secrets
- raw API responses
- any file the diff shows containing a token-shape string

If `git add` would have included one of these, stage individual files
by path instead of `git add -A` / `git add .`.

---

## F. Sign off

```
node scripts/github/agentIssueRunner.js signoff \
  --issue <n> --commit <hash> --status "<Done|Needs Review|Blocked|In Progress>" \
  --agent <name>
```

Default mode is dry-run. Add `--apply` to actually mutate GitHub.

Sign-off does four things:

1. **Comments on the issue** with this template:
   > Agent finished: `<agent-name>`. Commit: `<hash>` (<short subject>).
   >
   > Verification: `typecheck=<…>; lint=<…>; tests=<…>`
   > Product status: `<…>`
   > Files changed: `<count>` (<top 5 paths>)
   > Remaining gaps: `<bullet list or "none">`
   > Issue status: `<closed|still open>`
2. **Updates Project Status / Project Phase** by status:
   | Sign-off status | Project Status | Project Phase |
   |---|---|---|
   | `Done` | Done | Done |
   | `Needs Review` | In Progress | Review |
   | `Blocked` | In Progress | Blocked |
   | `In Progress` | In Progress | Build |
3. **Closes the issue** only when sign-off status is `Done` AND the
   commit message contains `Closes #<n>`. The runner refuses to close
   an issue from `Needs Review` — that's an explicit operator gate.
4. **Removes the `agent:active` label** (if present) and adds either
   `agent:done` or `agent:blocked` (if those labels exist; the runner
   does not create labels).

### When to use each sign-off status

| Status | Use when… |
|---|---|
| `Done` | Every acceptance criterion is proven by a test that runs in `npm run test`, the commit closes the issue, no follow-up needed. |
| `Needs Review` | Code is complete and tests pass, but the acceptance criteria include a browser walk-through or visual check the operator needs to do. |
| `Blocked` | Implementation is impossible until another issue lands, an operator decision is made, or an external constraint changes. The comment must name the blocker. |
| `In Progress` | Mid-stream save: the agent is pausing the session but has not finished the issue. Rare — usually the agent finishes or doesn't claim in the first place. |

---

## Parallel agents (worktrees)

If two agents must run at the same time, give each its own working tree:

```bash
git worktree add ../cdiscourse-agent-18 -b agent/18-sw-001-strength-bands main
git worktree add ../cdiscourse-agent-15 -b agent/15-ev-002-source-chain-popover main
```

Then one Claude session per worktree. Jest is configured to ignore
`.claude/worktrees/` (see `package.json` → `jest.testPathIgnorePatterns`)
so internal worktrees there don't double-run tests. External worktrees
in sibling directories are isolated by definition.

After each commit lands on `main`, prune:

```bash
git worktree remove ../cdiscourse-agent-18
```

---

## Push gate

The runner **never** pushes. After sign-off, the operator decides:

```bash
git push origin <branch-or-main>
```

If the commit was made on `main` (small docs/scripts changes), push
`main`. If on a feature branch, push that branch and open a PR — the
sign-off comment is your PR description prep.

---

## What this workflow is not

- **Not a CI replacement.** Local typecheck/lint/test still catches
  what CI does; this just makes the per-issue cadence explicit.
- **Not an autonomous loop.** No agent self-assigns the next issue;
  each turn is operator-triggered.
- **Not a substitute for issue grooming.** If the issue body is
  unclear, comment on the issue and stop, don't guess.
