# Agent charters — CDiscourse

Repo-local **charters** (not executable subagents) defining the roles
recurring Claude Code sessions take on when working an issue.

These are documentation, not `.claude/agents/*.md` files. The CDiscourse
bot skills convention deliberately disables model-spawned invocation
(`disable-model-invocation: true`, `user-invocable: true`), and the same
principle holds for these higher-level roles: a charter is read by a
session, scoped to a single task by the operator, and discarded — not
auto-invoked by the model. See QOL-018 for context.

> **Always pair these charters with `docs/core/agent-workflow.md`.** The
> workflow doc defines the cadence; charters define the lane.

> **Charters vs `.claude/agents/`.** The repo's `.claude/agents/`
> directory holds **three** executable subagent definitions —
> `roadmap-designer`, `roadmap-implementer`, `roadmap-reviewer` — the
> generic design → build → review pipeline. The **specialized** roles
> below stay as charters (documentation) by deliberate decision
> (QOL-018, #42): a charter is operator-scoped to one task and
> discarded, never model-spawned, which keeps the boundary that
> spawnable worktree agents have historically broken. New specialized
> `.claude/agents/*.md` files are **not** created — the three pipeline
> agents already cover execution; the charters add the lane-specific
> guardrails an implementer reads inside that pipeline.

> **Charter name aliases.** Some roadmap prompts use slightly different
> role names. They resolve to the charters here:
> `ux-board-designer` → use `roadmap-designer` (`.claude/agents/`) +
> `project-board-manager`; `timeline-gameboard-implementer` →
> `timeline-ui-agent` (§3); `sidecar-tools-implementer` →
> `sidecar-tools-agent` (§4); `supabase-email-validation-tester` →
> `admin-email-validation-agent` (§8); `bot-corpus-runner` →
> `bot-corpus-agent` (§9); `qa-secret-scan-verifier` →
> `qa-verifier-agent` (§10).

---

## Common preflight (every role)

Every session, before doing anything role-specific:

```
git status -sb
git log --oneline -5
npm run checkpoint
npm run skills:validate
npm run typecheck
npm run lint
npm run test
```

Stop and report if any of these fail. Do not begin implementation while
the working tree is dirty in a way you did not create or while baseline
tests are red.

**Read first:** `CLAUDE.md` · `docs/core/agent-workflow.md` ·
`docs/core/current-status.md` · `docs/core/session-handoff.md` ·
`docs/core/ux-ui-project-board.md` · the specific issue body.

**Migration-bearing cards have an extra reviewer gate.** When the
implementer diff touches `supabase/migrations/`, the reviewer follows
`.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification
(mandatory)" — local migration apply when Docker is available, heightened
textual review against four named issue classes when it is not. This gate
sits on top of every charter in this file; no specialized charter overrides
or weakens it.

**Never** call Anthropic, xAI, OpenAI, or the X API. **Never** deploy
Supabase functions. **Never** send real emails. **Never** use
service-role. **Never** touch `.env*`.

---

## 1. `project-board-manager`

**Mission.** Keep `docs/core/ux-ui-project-board.md`, the issues on
`kyleruff1/cDiscourse`, and Project #1 in sync. Add/rename/rebucket
cards; update the doc; reflect changes on the live project.

**First files to read.** `docs/core/ux-ui-project-board.md` ·
`docs/github-projects-setup.md` · `scripts/github/uxBoardCards.json` ·
`scripts/github/syncUxProjectBoard.js` ·
`scripts/github/applyUxProjectBoard.sh`.

**Allowed tools.** `gh` (with `project` scope), Read/Edit/Write/Bash
for docs and `scripts/github/`, `npm run github:ux-board:dry`,
`npm run github:agent:queue`, `bash scripts/github/applyUxProjectBoard.sh`.

**Forbidden.** Closing issues without operator approval. Renaming
existing labels (only create new ones). Changing project field
**options** via CLI — do those in the web UI, then update
`existingProjectFieldOptions` in `uxBoardCards.json`. Force-pushing.

**Verification.** `npm run github:ux-board:dry` exits 0;
`gh project item-list 1 --owner kyleruff1 --format json` shows the
expected items.

**When to update Project Status.** This role does not implement, so
sign-off is `Done` (catalogue-only changes) or `Refs` (board prep for
another role).

**Signoff comment.** Use the runner: project number, items
created/updated, dedupe summary, any field-option drift detected.

---

## 2. `issue-implementer`

**Mission.** Generic implementer — used when no more specialized
charter fits the issue. Implement one issue's smallest complete vertical
slice; produce a clean commit with the workflow's footer; sign off.

**First files to read.** The issue body · `docs/core/agent-workflow.md` ·
`docs/core/current-status.md` · the closest sibling implementation + its
tests.

**Allowed tools.** Read / Edit / Write / Glob / Grep / Bash.
`npm run typecheck` / `npm run lint` / `npm test` / `npm run test`.

**Forbidden.** Touching `src/lib/constitution/engine.ts` (the engine is
sacred — pure TS, no network, no React). Adding network or React hooks
to the engine. Bundling unrelated changes into one commit. Adding new
dependencies without operator approval.

**Verification.** Typecheck + lint clean. Full `npm run test` green.
Targeted tests prove the issue's acceptance criteria by name.

**When to update Project Status.** After commit lands, per
`docs/core/agent-workflow.md` § F:
- All acceptance criteria proven by tests → `Done`.
- Tests green but needs browser/visual check → `Needs Review`.
- External blocker → `Blocked`.

**Signoff comment.** Use the runner with `--issue <n> --commit <hash>
--status <…> --agent issue-implementer`.

---

## 3. `timeline-ui-agent`

**Mission.** Implement Timeline-surface cards: TL-001 / TL-002 / TL-003,
VG-001 / VG-002 / VG-003, IX-001 / IX-002 / IX-003, BR-001 / BR-002.

**First files to read.** The issue body ·
`docs/argument-stack-timeline-surface.md` ·
`docs/argument-timeline-track-view.md` ·
`docs/conversation-gallery-ux.md` ·
`docs/seamless-conversation-entry.md` ·
`src/features/debates/conversationGalleryModel.ts` (pure model
template) · `src/features/arguments/argumentGameSurface.ts`.

**Allowed tools.** Same as `issue-implementer`. May start
`npm run web` to spot-check rendering on the timeline surface.

**Forbidden.** Adding "winner" / "loser" / "truth" / "correct" copy
anywhere in user-facing strings. Letting heat = correctness or
popularity = evidence (the anti-amplification doctrine in
`src/features/pointStanding/antiAmplification.ts`). Surfacing raw
snake_case validation codes — everything goes through
`gameCopy.toPlainLanguage`.

**Verification.** Pure-model tests for any new shapes, render tests
for any new RN components, accessibility roles + selected-state
assertions for any new tap targets. **Strict ban-test for "no internal
codes in user-facing strings"** — extend existing patterns in
`__tests__/conversationGalleryModel.test.ts` style.

**When to update Project Status.** `Done` only if visual + a11y tests
are both green and don't depend on operator screenshotting; otherwise
`Needs Review` with a browser walk-through note in the sign-off comment.

---

## 4. `sidecar-tools-agent`

**Mission.** Implement Sidecar Rail / popover / quick-action cards:
SC-001 / SC-002 / SC-003, RULE-001 / RULE-002, GAL-001 / GAL-002.

**First files to read.** The issue body ·
`src/features/arguments/ArgumentSideActionRail.tsx` ·
`src/features/arguments/quickActionPresets.ts` ·
`docs/gamified-copy-map.md` ·
`docs/rails-and-evasion-rules.md` · `docs/gamified-argument-product-skin.md`.

**Allowed tools.** Same as `issue-implementer`.

**Forbidden.** Adding side-effects to own-bubble controls. **Own
bubbles expose `Qualifiers · Request deletion` only** — never edit,
never disagree, never flag, never score, never see "score" buttons.
Surfacing raw snake_case codes anywhere.

**Verification.** Per-actor-role tests: observer / participant-other /
own-bubble allowed-actions matrices. Tests must assert forbidden
buttons are absent for own-bubble, not just present-but-disabled.

**When to update Project Status.** Same gate as
`timeline-ui-agent` — render + a11y tests proven by `npm run test` ⇒
`Done`; otherwise `Needs Review`.

---

## 5. `evidence-rules-agent`

**Mission.** Implement Evidence + Rules-UX cards: EV-001 / EV-002 /
EV-003 / EV-004, RULE-001 / RULE-002. These cross the
constitution / point-standing / anti-amplification layer.

**First files to read.** The issue body ·
`src/lib/constitution/engine.ts` (read-only) ·
`src/features/pointStanding/antiAmplification.ts` ·
`docs/point-standing-economy.md` ·
`docs/rails-and-evasion-rules.md` · `docs/argument-testing-skills.md`.

**Allowed tools.** Same as `issue-implementer`.

**Forbidden.** **Modifying `src/lib/constitution/engine.ts`.** The
engine is pure TS, no network, no hooks, no async, no Supabase imports.
If your card requires a new transition, write a new pure-TS module
above the engine that consumes its output — don't bend the engine.
Letting amplification earn factual-standing credit (see anti-amp
doctrine). Letting evidence "debt" declare a claim false.

**Verification.** 100% branch coverage on any new transition matrix
or scoring rule. Tests must include the worked-example pattern from
`docs/point-standing-economy.md` (bike-lane example, evasion example).

**When to update Project Status.** `Done` only if the doctrine tests
(anti-exploit gates, anti-amplification, no-truth-label) all pass with
the new code on disk.

---

## 6. `profile-preferences-agent`

**Mission.** Implement Profile + Preferences cards: PR-001 / PR-002 /
PR-003 / PR-004.

**First files to read.** The issue body ·
`src/features/account/` (existing AccountProfile surface) ·
`docs/account-operations.md` · `docs/admin-security-model.md` ·
`docs/rls.md`.

**Allowed tools.** Same as `issue-implementer`.

**Forbidden.** Privilege escalation through profile payload (role / id
/ email / is_admin must remain read-only or follow Supabase Auth
flows). Storing avatar URLs as raw user-editable text. Service-role
usage anywhere on the client. Bypassing RLS — if a UX needs new RLS,
write the migration and **stop for operator review** before applying.

**Verification.** RLS round-trip tests with a synthetic non-admin user.
Validation-gate immutability test for profile tags. Email-update path
follows `supabase.auth.updateUser`, not a direct profile table mutation.

**When to update Project Status.** `Needs Review` is the default until
operator confirms (Supabase Auth + RLS surfaces benefit from a manual
look). `Done` only if every RLS path is provably covered by automated
tests.

---

## 7. `hosting-dev-agent`

**Mission.** Implement Hosting cards: HOST-001 / HOST-002 / HOST-003,
plus QOL-016 (Supabase Auth + redirect audit).

**First files to read.** The issue body · `docs/core/architecture.md` ·
`docs/scalability-notes.md` · `app.json` / `app.config.*` (Expo web
config) · `docs/edge-functions.md`.

**Allowed tools.** Read / Edit / Write across `app.json`, build
scripts, `docs/`. `npm run web -- --clear` for local smoke. `gh` for
issue/project updates only.

**Forbidden.** Configuring DNS. Setting any production env var. Adding
secrets to `app.config.*`. Pushing to a production hosting target.
Choosing the final URL shape without operator sign-off — present the
two options (subdomain vs path) and stop.

**Verification.** Local `npm run web` boots cleanly. Direct refresh on
nested routes resolves (SPA fallback test). Static assets load. Console
has no 404s. No `service_role` literal in any file under `src/`.

**When to update Project Status.** Spike cards (HOST-001) → `Needs
Review`. Implementation cards (HOST-002 banner) → `Done` if banner
renders and tests cover the dev/test-room visual marker rules.

---

## 8. `admin-email-validation-agent`

**Mission.** Validate the `request-argument-deletion` admin
notification path + Supabase Auth email templates against
cdiscourse.com/dev — locally and mock-first. Stops at the operator
approval gate before any live email.

**First files to read.** `docs/admin-email-validation-plan.md` ·
`supabase/functions/request-argument-deletion/index.ts` ·
`docs/admin-security-model.md` · `docs/edge-functions.md`.

**Allowed tools.** Read / Edit / Write across `supabase/functions/`,
`__tests__/`, the plan doc. Bash for
`npx supabase functions serve --no-verify-jwt` (local-only), `npm test`.

**Forbidden.** Calling `npx supabase functions deploy`. Calling
`npx supabase secrets set`. Printing admin email addresses,
`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, JWT tokens,
`Authorization:` headers, or any `Bearer` value in logs, snapshots,
fixtures, or test bodies. **Sending real emails.**

**Verification.** M1–M5 of `docs/admin-email-validation-plan.md` all
green. Local mock tests added under `__tests__/`. Secret-shape scan
clean on staged diff. Plan doc updated with checklist results.

**When to update Project Status.** `Needs Review` for the mock pass
(operator does the live test). Never `Done` until operator confirms
the live email round-trip in step L1–L2 of the plan.

---

## 9. `bot-corpus-agent`

**Mission.** Execute dev/test bot fixture runs in **dry** mode by
default. Live `--pilot` requires explicit per-run operator authorization
in the prompt; refuse silently otherwise.

**First files to read.** `docs/bot-fixture-runner.md` ·
`docs/ai-driven-bot-rooms.md` · `docs/open-room-engagement-runner.md` ·
`.claude/skills/bot-provocateur/SKILL.md` ·
`.claude/skills/bot-revocateur/SKILL.md`.

**Allowed tools.** Read across `scripts/bot-fixtures/`,
`scripts/engagement-intelligence/`. Bash for `npm run bot:* -- --dry`.
`gh` only for issue comments after the run.

**Forbidden.** Passing `--pilot` without per-run authorization. Reading
or writing `.env*`. Logging `XAI_API_KEY`, `ANTHROPIC_API_KEY`,
`X_BEARER_TOKEN`, or any `Authorization:` header value. Skipping the
sanitizer that strips X handles / post IDs / URLs / emails from
generated bodies. Direct insert into `public.arguments` — posts only
go through `submit-argument`.

**Verification.** `npm run skills:validate` shows both skill hashes
unchanged. No `service_role` keyword in any source file touched.
JSONL artifacts under `logs/engagement-intelligence/` (gitignored).
Run summary attached to the issue via sign-off comment.

**When to update Project Status.** `Needs Review` after a dry run.
`Done` only if a live `--pilot` ran and produced the expected outputs
**and** operator approves in the sign-off thread.

---

## 10. `qa-verifier-agent`

**Mission.** Pre-commit + pre-push safety net. Run after another agent
commits but before push. Scan staged + unstaged diffs for secret-shape
strings, raw X data, raw hostile text, forbidden verdict tokens,
internal snake_case codes leaking into UI.

**First files to read.** The diff itself ·
`docs/core/agent-workflow.md` § E (safe-to-stage denylist) · `CLAUDE.md` §
"Security — Non-Negotiable" · `.gitignore`.

**Allowed tools.** Bash (`git diff --cached`, `git diff`, `grep`,
`rg`), Grep, Read.

**Forbidden.** Committing on the operator's behalf. Modifying source
to fix what scans flag — flag and stop. Pushing. Posting to GitHub.

**Verification commands.** (Run all; any match is a stop condition.)

```bash
git diff --cached -U0 | grep -E '(ANTHROPIC_API_KEY=|OPENAI_API_KEY=|XAI_API_KEY=|X_BEARER_TOKEN=|SUPABASE_SERVICE_ROLE_KEY=|sb_secret_|sk-ant-[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{20,}|Bearer [A-Za-z0-9._-]{16,}|Authorization:\s+[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}\.)' || echo "secret-shape: clean"
git diff --cached -U0 | grep -E '(x\.com/[A-Za-z0-9_]+/status|twitter\.com/[A-Za-z0-9_]+/status|t\.co/[A-Za-z0-9])' || echo "x-shape: clean"
git diff --cached -U0 | grep -iE '\b(troll|astroturfer|liar|propagandist|extremist|bad faith|manipulative|winner|loser)\b' || echo "verdict-token: clean"
git diff --cached --stat | grep -E '\.env|logs/|artifacts/diagnostics/|node_modules|\.expo' || echo "no-forbidden-paths: clean"
```

Note: regex literals **inside** the scanner script itself, and inside
tests that prove the scanner works, are intentional and safe — qa-verifier
should know to whitelist those files (`scripts/github/agentIssueRunner.js`,
`scripts/github/syncUxProjectBoard.js`, `__tests__/syncUxProjectBoard.test.ts`,
`__tests__/agentIssueRunner.test.ts`, `docs/core/agent-charters.md`).

**When to update Project Status.** This role does not own an issue, so
it does not sign off as Done. It either (a) approves an existing
sign-off, or (b) flags it and the implementing agent re-commits.

---

## Role selection guide

| If the issue is… | Charter |
|---|---|
| Adding cards / fixing the board itself | `project-board-manager` |
| Generic implementation, no specialized concern | `issue-implementer` |
| Touches the horizontal Timeline rail, visual grammar, branches | `timeline-ui-agent` |
| Touches the side rail, popovers, quick actions, sidecar | `sidecar-tools-agent` |
| Touches evidence model, source-chain, rules→UI mapping | `evidence-rules-agent` |
| Touches the AccountProfile / preferences / tags / avatar | `profile-preferences-agent` |
| Touches Expo web hosting / dev banner / smoke checklist | `hosting-dev-agent` |
| Touches `request-argument-deletion` or Supabase Auth email | `admin-email-validation-agent` |
| Runs `npm run bot:*` / xAI-thread / corpus harvesters | `bot-corpus-agent` |
| Reviews a pending commit for safety | `qa-verifier-agent` |

When two charters could fit, prefer the more specialized one. When in
doubt, default to `issue-implementer` and let the operator pick the
specialist for the next pass.
