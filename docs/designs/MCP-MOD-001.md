# MCP-MOD-001 — Documentation reorganization (foundational docs → `docs/core/`)

**Card:** MCP-MOD-001 (Rules UX · P2 · S · Release 6.9 · Movement A).
**Status:** Design draft.
**Epic:** Rules UX (Epic 12).
**Movement:** A (documentation). First card in the semantic-referee modularity slate.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/230
**Design summary it supersedes:** `docs/designs/modularity-slate/MCP-MOD-001.md` — kept on disk but is no longer the canonical spec; this doc is the canonical spec the implementer reads.
**Meta-roadmap:** [`docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md`](../roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md) — this document MOVES (with rename) to `docs/core/roadmap-semantic-referee-modularity.md` as part of this card.
**Companion contracts:** none. This is a docs-only card.
**Prior cards:** none. MCP-MOD-001 is the first card in the modularity slate; it has no roadmap dependencies. (SMOKE-FIX-001 and SMOKE-FIX-002 are sequenced ahead of the slate by operator preference, but they do not block this card mechanically.)
**Unblocks:** MCP-MOD-002, MCP-MOD-003 (both expect a sibling `docs/architecture/` subfolder under `docs/`; the `docs/core/` convention introduced here makes the destination layout obvious).

---

## 1. Goal (one paragraph)

CDiscourse's `docs/` directory has grown into a flat surface of ~70 Markdown files mixing repo-wide foundational
references (`current-status.md`, `session-handoff.md`, `product-spec.md`, `architecture.md`, `constitution-v1.md`,
`implementation-plan.md`, `next-prompts.md`, `known-blockers.md`, `ux-ui-project-board.md`) with card-specific output
(`docs/designs/*`, `docs/reviews/*`, `docs/testing-runs/*`, dozens of feature memoranda). A new contributor cannot tell
from the directory listing which docs are "read first" and which are "context for one card". This card carves out
`docs/core/` and moves the foundational docs into it with **preserved git history** (`git mv`), then sweeps every
internal cross-reference (Markdown links, `CLAUDE.md`, `.claude/skills/`, `.claude/agents/`, `scripts/`) to the new
paths. The meta-roadmap for this very slate (currently at `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md`)
also moves to `docs/core/`, with a rename that drops the date prefix. **No production code is touched. No behavior
changes. No migration. No deployment.**

---

## 2. Scope

### 2.1 In scope

#### Files moved (with rename where stated)

The foundational set was determined by inspecting every top-level `docs/*.md` file in the repo and applying a single
bar: **does this document describe the repo, the project, the active work, or how to resume a session — independent of
any particular card?** If yes, it is foundational and moves to `docs/core/`. If no (card-specific design, review,
feature memo, testing run, deployment runbook, roadmap expansion that is not the slate's meta-roadmap), it stays put.

| # | Source path | Destination path | Bar |
|---|---|---|---|
| 1 | `docs/current-status.md` | `docs/core/current-status.md` | The status doc `CLAUDE.md` instructs every session to read. |
| 2 | `docs/session-handoff.md` | `docs/core/session-handoff.md` | The session-resume doc `CLAUDE.md` instructs every session to read. |
| 3 | `docs/known-blockers.md` | `docs/core/known-blockers.md` | The active-blockers doc `session-handoff.md` instructs every session to read. |
| 4 | `docs/next-prompts.md` | `docs/core/next-prompts.md` | The next-session prompt log (treated as historical-but-still-referenced per `project-audits/2026-05-18-overnight-work-audit.md`; the diagnostic script still ingests it). |
| 5 | `docs/implementation-plan.md` | `docs/core/implementation-plan.md` | The staged build plan referenced by `CLAUDE.md`. |
| 6 | `docs/product-spec.md` | `docs/core/product-spec.md` | The product spec referenced by `CLAUDE.md`. |
| 7 | `docs/architecture.md` | `docs/core/architecture.md` | The architecture overview referenced by `CLAUDE.md`. |
| 8 | `docs/constitution-v1.md` | `docs/core/constitution-v1.md` | The Constitution v1 reference doc cited by `CLAUDE.md` and the rules engine source. |
| 9 | `docs/ux-ui-project-board.md` | `docs/core/ux-ui-project-board.md` | The roadmap board doc that every card design references (the `roadmap-designer` agent reads it for context). |
| 10 | `docs/agent-charters.md` | `docs/core/agent-charters.md` | The role-charter doc for recurring sessions; orthogonal to any card. |
| 11 | `docs/agent-workflow.md` | `docs/core/agent-workflow.md` | The operator's reference for the design → implement → review pipeline; orthogonal to any card. |
| 12 | `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md` | `docs/core/roadmap-semantic-referee-modularity.md` | **The meta-roadmap.** Rename drops the date prefix. |

**The single rename** is row 12. Every other move preserves the filename byte-for-byte.

Note on `docs/project.md`: the design summary at `docs/designs/modularity-slate/MCP-MOD-001.md` lists this file, but
**it does not exist in the repo today.** The implementer must NOT create it. Verified by:
```
ls docs/project.md  →  No such file or directory
```

Note on `docs/next-prompts.md` (row 4): the project audit at `docs/project-audits/2026-05-18-overnight-work-audit.md`
declares this file "historical; do not extend." Despite that, it is still referenced by
`scripts/diagnostics/buildDiagnosticInspectPackage.js:736` and `.claude/skills/diagnostic-inspect-package-operator/SKILL.md`
as a top-level foundational artifact. The move keeps the file findable; the "do-not-extend" note in the audit doc is
independent of physical location and is not a reason to leave the file at the top level.

#### Cross-reference sweep targets

After the moves complete, the implementer greps the repo for the OLD paths AND the OLD meta-roadmap filename, and
rewrites each occurrence to the NEW path. The implementer scans:

- **All Markdown files under `docs/`** — relative links AND repo-rooted paths. Inbound links from `docs/designs/`,
  `docs/reviews/`, `docs/testing-runs/`, `docs/roadmap-expansions/`, `docs/project-audits/`, `docs/ux-storyboards/`,
  `docs/research/`, `docs/research-plans/`, `docs/deployment/`, `docs/semantic-prompts/`, `docs/semantic-referee/`,
  `docs/copy-review/`, and the moved docs themselves (relative-link recalculation — see §6.4.3).
- **`CLAUDE.md`** at repo root. Currently references `docs/current-status.md`, `docs/session-handoff.md`,
  `docs/product-spec.md`, `docs/architecture.md`, `docs/constitution-v1.md`, `docs/implementation-plan.md`. All six lines
  must update.
- **`.claude/skills/*/SKILL.md`** — three files reference the foundational docs:
  - `.claude/skills/test-discipline/SKILL.md:52` and `.claude/skills/test-discipline/SKILL.md:121` reference `docs/current-status.md`.
  - `.claude/skills/diagnostic-inspect-package-operator/SKILL.md:32` references `docs/current-status.md`, `docs/next-prompts.md`, `CLAUDE.md` as a triple.
  - `.claude/skills/storyline-narrative-officer/SKILL.md:127` and `:182` reference `docs/current-status.md`.
- **`.claude/agents/*.md`** — three agent files reference the foundational docs:
  - `.claude/agents/roadmap-implementer.md:58` and `:94` reference `docs/current-status.md`.
  - `.claude/agents/roadmap-designer.md:17`, `:24` reference `docs/ux-ui-project-board.md`.
  - `.claude/agents/roadmap-reviewer.md` does NOT currently reference any moved doc (verified by grep) — no change.
- **`scripts/**/*.{js,ts,ps1,sh}`** — four scripts reference the foundational docs:
  - `scripts/diagnostics/buildDiagnosticInspectPackage.js:400-401` reads `docs/current-status.md` as a literal path.
  - `scripts/diagnostics/buildDiagnosticInspectPackage.js:736` iterates `['docs/current-status.md', 'docs/next-prompts.md', 'CLAUDE.md']`.
  - `.claude/scripts/spawn-card.ps1:120` echoes the literal string `update docs/current-status.md, final verification.`.
  - `.claude/scripts/spawn-card.sh:174` echoes the same literal string.
  - `.claude/scripts/create-roadmap-issues.ps1:44` carries the PM-002 card row that mentions `docs/current-status.md` in
    its `title`, `goal`, and `accept` strings.
- **`package.json`** — verified by grep to contain **zero** `docs/` references. No change.
- **`README*.md`** at repo root — verified by `ls`: **no README.md exists at repo root.** No change.

There is no `.github/workflows/` directory in this repo (verified by `ls`), so no CI manifest needs updating.

The implementer treats the cross-reference sweep as a closed set: the targets above are the entire surface. If the
implementer's grep surfaces a hit that is not in this list, it is added to the sweep and the design is amended via an
"Implementer note" at the bottom of this doc; otherwise no design change is made mid-implementation.

#### History-preservation requirement

Every move uses `git mv` so blame and `git log --follow` walk back through the original commit. The implementer
verifies this AFTER each move by running:
```
git log --follow docs/core/<filename>.md | head -3
```
The first commit in the listing must equal the first commit in the pre-move file's history (sanity-check: compare the
output to `git log <oldpath> | head -3` from `HEAD~N` at the pre-move commit, where N is the number of `git mv`
operations performed).

### 2.2 Out of scope (explicitly — do NOT touch in this card)

These are the subfolders that stay where they are. **Name each one so the implementer doesn't accidentally move them.**

- `docs/designs/` (all `*.md`, including `docs/designs/MCP-MOD-001.md` itself, which is THIS file). Card-specific.
- `docs/designs/modularity-slate/` (all 8 design summaries). Slate-specific; do NOT promote any to `docs/core/`.
- `docs/reviews/` (all `*.md`). Card-specific.
- `docs/testing-runs/` (all `*.md`). Card-specific run logs.
- `docs/roadmap-expansions/` — **EXCEPT** the single file in row 12 of §2.1 (the meta-roadmap). The other roadmap
  expansions (`2026-05-20-mcp-integration-readiness-roadmap.md`, `2026-05-20-mcp-semantic-referee-roadmap.md`,
  `2026-05-23-binary-classifier-catalog-design.md`) stay put — they are card-family planning artifacts, not foundational
  repo references.
- `docs/ux-storyboards/`. Storyboard maps.
- `docs/project-audits/`. Historical audit reports.
- `docs/research/`, `docs/research-plans/`. Research artifacts.
- `docs/deployment/`. Per-card deployment runbooks.
- `docs/semantic-prompts/`, `docs/semantic-referee/`. Card-family prompt and rendering doc folders.
- `docs/copy-review/`, `docs/diagnostics/`. Card-family folders.
- **All other top-level `docs/*.md` files NOT named in §2.1's table.** Concretely (verified by `ls`): `account-operations.md`,
  `admin-bootstrap.md`, `admin-email-validation-plan.md`, `admin-operations.md`, `admin-security-model.md`,
  `ai-driven-bot-rooms.md`, `ai-provider-decision.md`, `argument-first-ux.md`, `argument-stack-timeline-surface.md`,
  `argument-testing-skills.md`, `argument-timeline-track-view.md`, `bot-engagement-corpus.md`, `bot-fixture-runner.md`,
  `bot-navigation-map.md`, `bot-topic-bank.md`, `bot-user-operations.md`, `browser-visual-test.md`, `claim-standing.md`,
  `conversation-gallery-ux.md`, `conversation-move-navigation.md`, `counterclaim-flow.md`, `deployment-smoke-checklist.md`,
  `dev-fixture-seeding-plan.md`, `edge-functions.md`, `evidence-object-model.md`, `game-qualifier-recommendations.md`,
  `game-status-model.md`, `gamified-argument-product-skin.md`, `gamified-copy-map.md`, `github-projects-setup.md`,
  `invite-flow.md`, `live-smoke-debug-log.md`, `message-qualifier-taxonomy.md`, `mvp-smoke-test.md`,
  `open-room-engagement-runner.md`, `point-standing-economy.md`, `product-status-ledger.md`, `rails-and-evasion-rules.md`,
  `rls.md`, `roadmap-timeline-tree-game-board.md`, `scalability-notes.md`, `schema.md`,
  `seamless-conversation-entry.md`, `semantic-review.md`, `session-model.md`, `supabase-admin-ops.md`,
  `testing-gap-audit.md`, `transcript-language-processing.md`, `visual-qa-snapshots.md`, `x-api-and-xai-setup.md`,
  `x-news-disagreement-epidemiology.md`. None of these moves.
- **`src/`, `app/`, `supabase/`, `scripts/` source files** beyond the four named in §2.1's cross-reference sweep. The
  card touches only the string contents of those four scripts.
- **`package.json`'s `scripts` block**. Verified to contain no `docs/` reference; no change.

---

## 3. Doctrine constraints (the lines a reviewer enforces)

A docs-reorg card is benign relative to most CDiscourse doctrine, but the following lines are still load-bearing and a
reviewer enforces them:

1. **No production-code change.** No `*.ts` or `*.tsx` under `src/` or `app/`. No `supabase/` change. No migration. No
   Edge Function. The four scripts touched in §6.4 are documentation-tool scripts; their behavior must be byte-identical
   except for the new path strings.
2. **Git history is preserved.** Every move uses `git mv`. Renaming a file via copy+delete is forbidden. The PR
   description must explicitly state the moves were performed with `git mv`.
3. **No broken internal links survive the card.** The cross-reference sweep is exhaustive (per §2.1). If the implementer
   misses a reference, the in-card path-existence test (§7) catches it before commit.
4. **No secret leak.** None of the moved docs contain secrets, but the diagnostic-package script
   (`scripts/diagnostics/buildDiagnosticInspectPackage.js`) reads `docs/current-status.md` and ingests it into a
   sanitized package. The behavior of that script must be preserved when its source-of-truth path changes; the
   `sanitiseFile` call site is unchanged in shape — only the literal path string updates.
5. **No deletion of foundational docs.** Every file in §2.1's table moves; none is deleted. After the moves,
   `git status -sb` shows no `D` line for any of the foundational files (only `R` rename lines).
6. **The card does not retroactively change content.** No section is rewritten, no paragraph is added, no header is
   renumbered. The only change to the body of any moved file is the recalculation of internal relative links inside the
   document (§6.4.3 — e.g. a link from the meta-roadmap to `../designs/MCP-001.md` becomes
   `../designs/MCP-001.md` if the link target is relative to its new location).

---

## 4. Background — why the foundational set looks the way it does

A naive carve-out might lift every `docs/*.md` file with a "this describes the project" feel into `docs/core/`.
That would leave the top level half-empty and bury feature memoranda one folder deeper without making them easier to
find. The bar above (§2.1's "describes the repo, the project, the active work, or how to resume a session — independent
of any particular card") is deliberately narrow: it keeps `docs/core/` to a one-screen list, and every entry is
referenced by `CLAUDE.md`, the `.claude/agents/*` files, the `.claude/skills/*` files, or the diagnostic-package
script — i.e. there is hard evidence each foundational doc is referenced from outside the docs tree.

The meta-roadmap (row 12) is the only entry NOT in that "referenced from outside docs" set, but it belongs in
`docs/core/` for a different reason: it is the planning artifact for the slate this card opens, and it explicitly
includes its own move into `docs/core/` in §1 ("After MCP-MOD-001 lands, this document moves (via `git mv`) to
`docs/core/roadmap-semantic-referee-modularity.md`"). Leaving it at the date-prefixed path after the slate begins would
be a self-contradiction.

The bar deliberately EXCLUDES:

- **Feature memoranda** like `docs/seamless-conversation-entry.md`, `docs/argument-stack-timeline-surface.md`,
  `docs/conversation-gallery-ux.md`. Each describes one stage's deliverable; they read like archived design notes, not
  active references. They stay at the top level until a future card decides what bin they belong in.
- **Operational runbooks** like `docs/mvp-smoke-test.md`, `docs/deployment-smoke-checklist.md`,
  `docs/admin-operations.md`. These are operator references but not session-bootstrap reading; their natural home is a
  future `docs/ops/` subfolder (out of scope here).
- **Doctrine documents** like `docs/point-standing-economy.md`, `docs/evidence-object-model.md`,
  `docs/rls.md`. Each is the prose layer for a code feature; their natural home is a future `docs/doctrine/` subfolder
  (out of scope here).

If a reviewer pushes back on any single inclusion or exclusion in §2.1 during PR review, the right move is a follow-up
card — not a mid-PR addition. This card establishes the convention; future cards refine it.

---

## 5. Pre-flight checks (before any `git mv`)

Before running any move, the implementer executes:

1. `git rev-parse --show-toplevel` — confirms cwd is the worktree, not the main checkout. If the toplevel matches the
   main repo path (`C:\Users\kyler\cdiscourse\debate-constitution-app`), STOP.
2. `git branch --show-current` — confirms `feat/MCP-MOD-001-documentation-reorganization`.
3. `git status -sb` — confirms a clean working tree (only this design doc as staged/committed change).
4. `npm run typecheck && npm run lint && npm run test` — captures baseline pass/fail counts BEFORE any change. The
   implementer records the test count in the commit body for §6.5.

If any pre-flight step fails, STOP and surface. Do not begin moves on a non-clean baseline.

---

## 6. File changes

### 6.1 Create `docs/core/` directory

The directory is created implicitly by the first `git mv` into it. Git does not track empty directories, so no
`.gitkeep` is needed. The implementer can verify creation by `ls docs/core/` after the first move.

### 6.2 Move foundational docs with `git mv` (preserving history)

The implementer runs the following eleven commands in sequence, **in the order shown** (so the working tree state is
deterministic on partial failure):

```bash
# Run from repo root inside the worktree.
git mv docs/current-status.md       docs/core/current-status.md
git mv docs/session-handoff.md      docs/core/session-handoff.md
git mv docs/known-blockers.md       docs/core/known-blockers.md
git mv docs/next-prompts.md         docs/core/next-prompts.md
git mv docs/implementation-plan.md  docs/core/implementation-plan.md
git mv docs/product-spec.md         docs/core/product-spec.md
git mv docs/architecture.md         docs/core/architecture.md
git mv docs/constitution-v1.md      docs/core/constitution-v1.md
git mv docs/ux-ui-project-board.md  docs/core/ux-ui-project-board.md
git mv docs/agent-charters.md       docs/core/agent-charters.md
git mv docs/agent-workflow.md       docs/core/agent-workflow.md
```

Total: 11 plain `git mv` operations, no renames.

After running them, `git status -sb` should show 11 `R` (rename) lines and nothing else.

### 6.3 Move + rename the meta-roadmap

```bash
git mv docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md \
       docs/core/roadmap-semantic-referee-modularity.md
```

This is the only rename in the card. The date prefix drops because `docs/core/` is not a chronological log; the file
is now a permanent reference. After this command, `git status -sb` shows 12 total `R` lines.

The implementer verifies the rename with `git log --follow docs/core/roadmap-semantic-referee-modularity.md` —
output must walk back through `daf3dad` or earlier (the file was created in commit `daf3dad` per the slate's history).

### 6.4 Cross-reference sweep

The sweep runs in three logical passes. Each pass uses `Grep` (the harness tool) — NOT raw `grep` or `rg` — to find
hits, and `Edit` for the literal replacements.

#### 6.4.1 Grep patterns to run

The implementer runs each of the following Grep queries with `output_mode: "content"` and `-n: true` to see the exact
line of every hit:

| # | Pattern (regex) | Search root | Glob | Purpose |
|---|---|---|---|---|
| 1 | `docs/current-status\.md` | repo root | `**/*.{md,ts,tsx,js,ps1,sh,json}` | Find every reference to the status doc. |
| 2 | `docs/session-handoff\.md` | repo root | same | Session-resume doc. |
| 3 | `docs/known-blockers\.md` | repo root | same | Blockers doc. |
| 4 | `docs/next-prompts\.md` | repo root | same | Next-prompts log. |
| 5 | `docs/implementation-plan\.md` | repo root | same | Staged build plan. |
| 6 | `docs/product-spec\.md` | repo root | same | Product spec. |
| 7 | `docs/architecture\.md` | repo root | same | Architecture overview. |
| 8 | `docs/constitution-v1\.md` | repo root | same | Constitution doc. |
| 9 | `docs/ux-ui-project-board\.md` | repo root | same | Roadmap board. |
| 10 | `docs/agent-charters\.md` | repo root | same | Charter doc. |
| 11 | `docs/agent-workflow\.md` | repo root | same | Workflow doc. |
| 12 | `2026-05-22-semantic-referee-modularity-roadmap\.md` | repo root | same | The meta-roadmap (caught as a bare filename; the path-prefix `docs/roadmap-expansions/` is implicit in the regex matches). |
| 13 | `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap\.md` | repo root | same | The meta-roadmap (caught as a full path). |

Patterns 12 and 13 are both included because some links carry the bare filename only (relative links inside
`docs/roadmap-expansions/`, e.g. `[meta-roadmap](2026-05-22-...md)`). The pattern set is monotonic — running all 13 is
safe even if some return zero hits.

#### 6.4.2 Expected hits (the implementer should NOT be surprised by these)

Based on a sweep run during design, the expected hit set is:

- **In `CLAUDE.md`** (6 lines): the "What This Project Is" preamble references
  `docs/product-spec.md`, `docs/architecture.md`, `docs/constitution-v1.md`, `docs/implementation-plan.md`. The "Start
  Every Session Here" section references `docs/current-status.md` and `docs/session-handoff.md`.
- **In `.claude/skills/test-discipline/SKILL.md`** (2 lines): `docs/current-status.md` on line 52 and line 121.
- **In `.claude/skills/diagnostic-inspect-package-operator/SKILL.md`** (1 line): line 32 references
  `docs/current-status.md, docs/next-prompts.md, CLAUDE.md` as a comma-joined triple.
- **In `.claude/skills/storyline-narrative-officer/SKILL.md`** (2 lines): `docs/current-status.md` on line 127 and
  line 182.
- **In `.claude/agents/roadmap-implementer.md`** (2 lines): line 58 and line 94 reference `docs/current-status.md`.
- **In `.claude/agents/roadmap-designer.md`** (2 lines): line 17 and line 24 reference `docs/ux-ui-project-board.md`.
- **In `scripts/diagnostics/buildDiagnosticInspectPackage.js`** (3 lines): lines 400, 401 read
  `docs/current-status.md` as a literal path; line 736 iterates a triple `['docs/current-status.md', 'docs/next-prompts.md', 'CLAUDE.md']`.
- **In `.claude/scripts/spawn-card.ps1`** (1 line): line 120 echoes `update docs/current-status.md, final verification.`.
- **In `.claude/scripts/spawn-card.sh`** (1 line): line 174 echoes the same literal string.
- **In `.claude/scripts/create-roadmap-issues.ps1`** (1 line): line 44 carries the PM-002 card row referencing
  `docs/current-status.md` in `title`, `goal`, and `accept`. Three substring replacements on the single line.
- **In `docs/` Markdown files** — many. Every doc that references one of the moved foundational docs by repo-rooted
  path. The implementer rewrites each occurrence. Sample hits the designer saw:
  - `docs/current-status.md` itself references `docs/next-prompts.md`, `docs/ux-ui-project-board.md`,
    `docs/agent-charters.md` (multiple lines).
  - `docs/mvp-smoke-test.md:133` references `docs/known-blockers.md`.
  - `docs/testing-gap-audit.md:185` references `docs/known-blockers.md`.
  - `docs/session-handoff.md:12, :34` references `docs/known-blockers.md`.
  - `docs/project-audits/2026-05-18-overnight-work-audit.md:74` references `docs/next-prompts.md`.
  - `docs/project-audits/2026-05-21-roadmap-collision-supersession-analysis.md:80` references
    `docs/current-status.md`, `docs/next-prompts.md`.
  - `docs/designs/modularity-slate/MCP-MOD-002.md` through `MCP-MOD-008.md` each carry a **Meta-roadmap** line linking
    to `docs/core/roadmap-semantic-referee-modularity.md` ALREADY (the slate's design summaries pre-anticipated this
    move). The implementer verifies these links resolve after the move and updates only the ones still pointing at the
    `docs/roadmap-expansions/` path (MCP-MOD-001's summary in row 7 of §2.1 of `docs/designs/modularity-slate/MCP-MOD-001.md`
    line 7, and MCP-MOD-002's summary line 7 — both already carry the new path as an alternative; consolidate to the
    new path).
  - `docs/roadmap-expansions/2026-05-23-binary-classifier-catalog-design.md:19` references the meta-roadmap via the
    date-prefixed path.
- **Inside the meta-roadmap itself** (relative-link recalculation): the meta-roadmap's `Companion docs` block links to
  `../designs/MCP-001.md`, `2026-05-20-mcp-semantic-referee-roadmap.md`, `../semantic-prompts/mcp-semantic-referee-prompt-bank.md`,
  `../testing-runs/2026-05-22-smoke-test-failure-investigation.md`, `../designs/SMOKE-FIX-001.md`. After the move, the
  document sits at `docs/core/roadmap-semantic-referee-modularity.md`, so:
  - `../designs/MCP-001.md` → still `../designs/MCP-001.md` (correct from `docs/core/` too).
  - `2026-05-20-mcp-semantic-referee-roadmap.md` → `../roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md`
    (the bare-filename link no longer works from the new location).
  - `../semantic-prompts/mcp-semantic-referee-prompt-bank.md` → still `../semantic-prompts/...` (correct).
  - `../testing-runs/2026-05-22-smoke-test-failure-investigation.md` → still `../testing-runs/...` (correct).
  - `../designs/SMOKE-FIX-001.md` → still `../designs/SMOKE-FIX-001.md` (correct).
- **Inside any other moved foundational doc** — relative links inside the moved files. The implementer scans each
  moved file for `](docs/...)` and `](./...)` patterns and recalculates. The sample audit done during design showed
  only one such recalculation surface: the meta-roadmap (above). The other foundational docs use either repo-root paths
  (caught by the §6.4.1 sweep) or anchor links (which are location-independent).

#### 6.4.3 Replacement rule

For every hit, the implementer performs a literal-text replacement using `Edit`:

- `docs/current-status.md` → `docs/core/current-status.md`
- `docs/session-handoff.md` → `docs/core/session-handoff.md`
- `docs/known-blockers.md` → `docs/core/known-blockers.md`
- `docs/next-prompts.md` → `docs/core/next-prompts.md`
- `docs/implementation-plan.md` → `docs/core/implementation-plan.md`
- `docs/product-spec.md` → `docs/core/product-spec.md`
- `docs/architecture.md` → `docs/core/architecture.md`
- `docs/constitution-v1.md` → `docs/core/constitution-v1.md`
- `docs/ux-ui-project-board.md` → `docs/core/ux-ui-project-board.md`
- `docs/agent-charters.md` → `docs/core/agent-charters.md`
- `docs/agent-workflow.md` → `docs/core/agent-workflow.md`
- `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md`
  → `docs/core/roadmap-semantic-referee-modularity.md`
- Bare-filename `2026-05-22-semantic-referee-modularity-roadmap.md` (when inside a `docs/roadmap-expansions/` doc):
  → `../core/roadmap-semantic-referee-modularity.md`

The `Edit` tool's `old_string`/`new_string` pair must be exact. If a single source file contains multiple occurrences
of the same path, `replace_all: true` is acceptable as long as the path string is unambiguous (which the docs paths are
— they are not substrings of any other path the repo uses).

For the four `scripts/`-tree files, the same rule applies — string literals get the new `docs/core/` prefix.

### 6.4.4 Mass-update strategy (operator-friendly)

To reduce edit count, the implementer can issue **one Edit per source file** with `replace_all: true`, walking the
13 search patterns one path at a time. With ~50 expected hit-bearing files, the operation is ~150–200 individual edits.
This is well within budget for a single card.

### 6.5 Verify history preservation

After all moves and edits, the implementer runs one `git log --follow` per moved file as a smoke check:

```bash
for f in current-status session-handoff known-blockers next-prompts implementation-plan \
         product-spec architecture constitution-v1 ux-ui-project-board agent-charters agent-workflow; do
  echo "--- $f ---"
  git log --follow --format='%h %s' docs/core/$f.md | head -3
done
echo "--- meta-roadmap ---"
git log --follow --format='%h %s' docs/core/roadmap-semantic-referee-modularity.md | head -3
```

Each output block must show a multi-commit history walking back through the document's original commits. If `git log
--follow` returns only one commit (the rename commit), the move was not done via `git mv` — STOP and re-run the move.

### 6.6 Backwards-reference update inside the modularity slate's design summaries

The slate's design summaries (`docs/designs/modularity-slate/MCP-MOD-001.md` through `MCP-MOD-008.md`) each carry a
**Meta-roadmap** header line on row 7. The slate already anticipated this card:

- `MCP-MOD-001.md` (summary): line 7 reads
  ```
  **Meta-roadmap:** [`docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md`](../../roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md) — this document moves to `docs/core/roadmap-semantic-referee-modularity.md` as part of this card's deliverable.
  ```
  After this card, rewrite line 7 to:
  ```
  **Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
  ```
  Also update the **File moved** table on lines 33 (the meta-roadmap row stays as historical record but is rewritten to
  "moved here" past-tense), and the **Acceptance criteria** checkbox on lines 88-89 (mark the rename complete in past
  tense or strike the checkbox — implementer choice; the simpler edit is to leave the checkbox as written, since the
  summary is supplanted by THIS canonical design).
- `MCP-MOD-002.md` (summary): line 7 reads
  ```
  **Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md) (after MCP-MOD-001 moves it) — or `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md` if MCP-MOD-001 has not yet shipped.
  ```
  After this card, the alternative-path clause is stale. Rewrite to:
  ```
  **Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
  ```
- `MCP-MOD-003.md` through `MCP-MOD-008.md`: each summary's line 7 already reads
  `**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).` —
  no change. The relative path `../../core/...` resolves correctly from `docs/designs/modularity-slate/`.

The implementer also updates the meta-roadmap's own §1 reference to "this document lives at `docs/roadmap-expansions/`
because card MCP-MOD-001 has not landed yet" — rewrite to past tense ("This document was relocated from
`docs/roadmap-expansions/` to `docs/core/` by MCP-MOD-001"). The **Operator launch checklist** §8 step 3 ("After MCP-MOD-001
lands, `git mv` this document to `docs/core/roadmap-semantic-referee-modularity.md` as part of the card's deliverable")
is rewritten to past tense or struck through.

---

## 7. Test plan

### 7.1 Required passing CI commands (operator runs after the implementer commits)

The acceptance criteria require:

- `npm run typecheck` — must remain green (no type change is expected since no `.ts` files are touched).
- `npm run lint` — must remain green.
- `npm run test` — must remain green; the test count is unchanged or higher by the count of new tests in §7.2.
- `npm run skills:validate` (script defined at `package.json:51`, runs `node scripts/skills/validateBotSkills.js`) — must
  remain green; no skill or agent's path strings are syntactically invalid after the rewrite.

### 7.2 New tests

Two new tests are added under `__tests__/`. Both are pure-TS source-scan tests (no Deno, no runtime call).

#### 7.2.1 `__tests__/foundationalDocsCorePathExistence.test.ts` (new)

A Jest test that asserts each `docs/core/*.md` path exists. Mirrors the posture of existing source-scan tests
(`__tests__/semanticAnthropicSourceScan.test.ts`). Sample structure:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

const REQUIRED_CORE_FILES = [
  'current-status.md',
  'session-handoff.md',
  'known-blockers.md',
  'next-prompts.md',
  'implementation-plan.md',
  'product-spec.md',
  'architecture.md',
  'constitution-v1.md',
  'ux-ui-project-board.md',
  'agent-charters.md',
  'agent-workflow.md',
  'roadmap-semantic-referee-modularity.md',
];

describe('docs/core foundational doc set', () => {
  it.each(REQUIRED_CORE_FILES)('docs/core/%s exists', (filename) => {
    const fullPath = path.join(REPO_ROOT, 'docs', 'core', filename);
    expect(fs.existsSync(fullPath)).toBe(true);
  });

  it.each(REQUIRED_CORE_FILES.filter((f) => f !== 'roadmap-semantic-referee-modularity.md'))(
    'old top-level docs/%s no longer exists (moved to docs/core/)',
    (filename) => {
      const oldPath = path.join(REPO_ROOT, 'docs', filename);
      expect(fs.existsSync(oldPath)).toBe(false);
    },
  );

  it('old docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md no longer exists', () => {
    const oldPath = path.join(
      REPO_ROOT,
      'docs',
      'roadmap-expansions',
      '2026-05-22-semantic-referee-modularity-roadmap.md',
    );
    expect(fs.existsSync(oldPath)).toBe(false);
  });
});
```

This test fails the build if a future cleanup accidentally deletes one of these files OR if a stray copy is left
behind at the old path.

#### 7.2.2 `__tests__/foundationalDocsNoStaleReferences.test.ts` (new)

A source-scan test that asserts no Markdown file under `docs/` AND no `.claude/agents/*.md`, `.claude/skills/**/*.md`,
or `scripts/**/*.{js,ts,ps1,sh}` file references an old top-level path that has been moved. Sample structure:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_OLD_PATHS = [
  'docs/current-status.md',
  'docs/session-handoff.md',
  'docs/known-blockers.md',
  'docs/next-prompts.md',
  'docs/implementation-plan.md',
  'docs/product-spec.md',
  'docs/architecture.md',
  'docs/constitution-v1.md',
  'docs/ux-ui-project-board.md',
  'docs/agent-charters.md',
  'docs/agent-workflow.md',
  'docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md',
];

// Walk an allow-list of source roots; the file-walker is small enough to inline.
const SCAN_ROOTS = [
  { root: 'docs', exts: ['.md'] },
  { root: '.claude/agents', exts: ['.md'] },
  { root: '.claude/skills', exts: ['.md'] },
  { root: 'scripts', exts: ['.js', '.ts', '.ps1', '.sh'] },
  // CLAUDE.md at repo root is also scanned by a separate it() below.
];

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

describe('No stale references to moved foundational docs', () => {
  for (const { root, exts } of SCAN_ROOTS) {
    const absRoot = path.join(REPO_ROOT, root);
    if (!fs.existsSync(absRoot)) continue;
    const files = walk(absRoot, exts);
    for (const file of files) {
      it(`${path.relative(REPO_ROOT, file)} has no stale path`, () => {
        const text = fs.readFileSync(file, 'utf8');
        for (const forbidden of FORBIDDEN_OLD_PATHS) {
          // Exception: the design doc itself (docs/designs/MCP-MOD-001.md) and the
          // design summary at docs/designs/modularity-slate/MCP-MOD-001.md are allowed to
          // mention the old paths in past-tense documentation of the move.
          if (file.endsWith(path.join('designs', 'MCP-MOD-001.md'))) continue;
          if (file.endsWith(path.join('designs', 'modularity-slate', 'MCP-MOD-001.md'))) continue;
          // Exception: project audits and historical commit logs may reference the old paths.
          if (file.includes(path.join('docs', 'project-audits'))) continue;
          // Exception: testing-runs may reference the old paths historically.
          if (file.includes(path.join('docs', 'testing-runs'))) continue;
          expect(text.includes(forbidden)).toBe(false);
        }
      });
    }
  }

  it('CLAUDE.md has no stale path', () => {
    const text = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    const ALWAYS_FORBIDDEN = FORBIDDEN_OLD_PATHS.filter(
      (p) => p !== 'docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md',
    );
    for (const forbidden of ALWAYS_FORBIDDEN) {
      expect(text.includes(forbidden)).toBe(false);
    }
  });
});
```

The exception list is deliberately narrow: the design doc itself, its predecessor summary, project audits, and
testing runs are allowed to mention old paths as historical references. Everywhere else, a stale reference is a build
failure.

### 7.3 Manual verification

After CI passes, the implementer runs one additional manual check:

```bash
# In the worktree, after all moves and the cross-reference sweep:
git log --follow docs/core/roadmap-semantic-referee-modularity.md | head -10
git log --follow docs/core/current-status.md | head -10
```

Each must show a multi-commit history. If either returns a single commit, `git mv` was not used somewhere and the move
must be redone.

---

## 8. Deployment plan

**None.** This is a documentation-only card. No code changes, no migration, no Edge Function change, no `supabase`
command runs after merge.

Supabase auto-redeploy on `main` (per the user's memory note `supabase-merge-autodeploy.md`) sees zero
`supabase/migrations/` change and zero `supabase/functions/` change in the merge commit, so no auto-deploy fires. The
GitHub Actions workflows directory does not exist in this repo (verified by `ls`), so no CI deploy logic is invoked
either.

---

## 9. Rollback plan

`git revert` the merge commit. All 12 `git mv` operations reverse cleanly, all cross-reference edits revert,
and the repository returns to its pre-card state. There is no migration to roll back, no Edge Function to redeploy.

If, for some reason, a partial state is committed (the implementer's worktree state at the moment of stop), the same
revert applies — the diff is purely text and file-rename ops.

---

## 10. Acceptance criteria (checkbox set for the GitHub issue)

- [ ] `docs/core/` exists and contains the 12 files named in §2.1's table.
- [ ] Every moved file's `git log --follow` walks back through its original commit history (not just the rename commit).
- [ ] No internal cross-reference in `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**/*.md`, `scripts/**/*.{js,ts,ps1,sh}`,
      or any non-exempted `docs/**/*.md` file points at an old top-level `docs/<foundational>.md` path or the
      date-prefixed meta-roadmap path. (Exemptions per §7.2.2: this design doc itself, its predecessor summary,
      `docs/project-audits/`, `docs/testing-runs/`.)
- [ ] `CLAUDE.md`'s six references update from `docs/<file>.md` to `docs/core/<file>.md` (two in "Start Every Session
      Here", four in "What This Project Is").
- [ ] The four `scripts/`-tree files (`scripts/diagnostics/buildDiagnosticInspectPackage.js`,
      `.claude/scripts/spawn-card.ps1`, `.claude/scripts/spawn-card.sh`, `.claude/scripts/create-roadmap-issues.ps1`)
      update their path string literals.
- [ ] The three `.claude/skills/` files and the two `.claude/agents/` files (roadmap-implementer, roadmap-designer)
      update their references.
- [ ] The meta-roadmap is at `docs/core/roadmap-semantic-referee-modularity.md` after the card; its internal §1 and §8
      references are updated to past tense.
- [ ] The design summaries `docs/designs/modularity-slate/MCP-MOD-001.md` and `MCP-MOD-002.md` have their **Meta-roadmap**
      lines simplified to the new `docs/core/` path with no alternative-path clause.
- [ ] `__tests__/foundationalDocsCorePathExistence.test.ts` passes.
- [ ] `__tests__/foundationalDocsNoStaleReferences.test.ts` passes.
- [ ] `npm run typecheck && npm run lint && npm run test && npm run skills:validate` all pass.
- [ ] No `D` (delete) line in `git status -sb` for any foundational file — only `R` (rename) lines plus `M` (modify) for
      cross-reference targets.

---

## 11. Risks and open questions

### 11.1 Risks

- **Hardcoded paths in agent prompts or skill instructions.** Mitigated by the §6.4 cross-reference sweep and the
  `__tests__/foundationalDocsNoStaleReferences.test.ts` regression test. The test catches any stale path the implementer
  misses by hand.
- **PRs in flight that reference old paths.** Mitigated by surface communication: the operator pauses other docs work
  while this card is in review. If a PR collides at merge time, the operator rebases the colliding PR and updates the
  one or two stale paths by hand — the regression test guards the post-merge state.
- **The meta-roadmap rename specifically.** The design summaries in `docs/designs/modularity-slate/` link to the
  meta-roadmap; those links MUST be updated (§6.6). The summaries DO already carry the new `../../core/roadmap-...md`
  link as the preferred form (MCP-MOD-003 through MCP-MOD-008) or as one of two alternatives (MCP-MOD-001,
  MCP-MOD-002) — so the only edit needed is the simplification of MCP-MOD-001 and MCP-MOD-002's lines, plus the
  meta-roadmap's own §1 and §8 self-references.
- **The diagnostic-package script touches `docs/current-status.md` as a literal path twice.** Mitigated by the §6.4
  sweep, which catches lines 400, 401, and 736. The script's behavior is unchanged — it still reads, sanitizes, and
  packages the status doc.
- **A future contributor recreates `docs/project.md` thinking it was moved.** Mitigated by §2.1's explicit note that
  the file does not exist and must not be created. The path-existence test does not require it.
- **`docs/next-prompts.md` is flagged "historical" by the project audit, but is being moved as foundational.** This
  is a deliberate decision — the file is still referenced by the diagnostic script and the diagnostic-inspect-package
  operator skill. The "do-not-extend" guidance from the audit is content guidance, not location guidance; moving the
  file does not contradict it.

### 11.2 Open questions (each has a recommendation; flag any disagreement during review)

- **Should `docs/agent-charters.md` and `docs/agent-workflow.md` move into `docs/core/`?**
  Recommendation: YES (rows 10 and 11 of §2.1). Both are referenced by `.claude/agents/roadmap-designer.md`'s prose, and
  both describe pipeline orthogonal to any single card. A future contributor who reads `docs/core/` learns the agent
  pipeline as part of the foundational set. If the reviewer prefers leaving them at the top level, dropping rows 10–11
  is a one-line edit to this design.
- **Should `docs/ux-ui-project-board.md` move into `docs/core/`?**
  Recommendation: YES (row 9 of §2.1). The roadmap board is the canonical card list and is referenced by the designer
  agent (`.claude/agents/roadmap-designer.md:17, :24`). It is the same class of doc as `current-status.md` and
  `implementation-plan.md` — describes the project, not any single card.
- **Should the in-card path-existence test ALSO assert exhaustiveness** (i.e. `docs/core/` contains EXACTLY 12 files,
  not 11 or 13)?
  Recommendation: NO. Asserting exact contents would break the first time a future card adds a 13th foundational doc.
  The test asserts the required minimum; additions are welcome.
- **Should the cross-reference sweep additionally rewrite RELATIVE links inside docs that link UP-DIR to a moved
  foundational doc** (e.g. a doc under `docs/designs/` that uses `../current-status.md`)?
  Recommendation: YES, but this case is unlikely to exist in the repo — most cross-references use repo-root paths.
  The Grep patterns in §6.4.1 catch repo-root references; the implementer additionally runs `Grep "\.\./current-status"`
  (and analogues) as a sanity sweep. Any hit is rewritten to `../core/current-status.md` (or the appropriate relative
  prefix).

---

## 12. Operator follow-up

**None required after merge other than informing other in-flight contributors.**

Specifically, the operator does NOT need to:

- Run `npx supabase ...` (no migration, no Edge Function).
- Update `.env` (no secret change).
- Re-run any smoke test (no behavior change).
- Update any GitHub Action (none exist in this repo).
- Manually re-link Project board issues (issues #230 etc. reference the card code, not the doc path).

The operator SHOULD:

- Notify in-flight roadmap-card contributors (if any) that foundational doc paths have moved, so their open PRs can
  rebase against the new paths.
- After merge, optionally run `npm run skills:validate` locally to confirm the post-merge state is green.

---

## 13. Doctrine self-check

Per the requirement to walk through relevant doctrine skills:

- **`cdiscourse-doctrine`** §1 (score is gameplay analysis, never truth): N/A — no scoring code touched.
- **`cdiscourse-doctrine`** §2 (heat means activity, not truth): N/A.
- **`cdiscourse-doctrine`** §3 (popularity is not evidence): N/A.
- **`cdiscourse-doctrine`** §4 (AI moderator hard limits): N/A — no AI call.
- **`cdiscourse-doctrine`** §5 (rules engine is sacred): N/A — `src/lib/constitution/engine.ts` is not touched.
- **`cdiscourse-doctrine`** §6 (secrets policy): Respected — no `.env*` file is touched; no secret key appears in any
  moved doc; the `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` check returns zero matches both before and
  after the card (verified by the fact that the card does not touch `app/` or `src/`).
- **`cdiscourse-doctrine`** §7 (no AI calls from production app): Respected — no production code touched.
- **`cdiscourse-doctrine`** §8 (Supabase conventions): N/A — no migration, no RLS change, no table touched.
- **`cdiscourse-doctrine`** §9 (plain language for users): N/A — no user-facing string touched.
- **`cdiscourse-doctrine`** §10 (v1 scope guards): Respected — the card adds nothing beyond doc reorganization.

The card is doctrine-clean by construction: it moves Markdown files and updates paths. No application surface, no
data model, no copy, no behavior.

---

## 14. Follow-ups (NOT part of this card)

Logged here for traceability; each is a separate future card:

- **A `docs/ops/` carve-out** for operational runbooks (`mvp-smoke-test.md`, `deployment-smoke-checklist.md`,
  `admin-operations.md`, etc.). Out of scope here.
- **A `docs/doctrine/` carve-out** for prose layers of code features (`point-standing-economy.md`,
  `evidence-object-model.md`, `rls.md`). Out of scope here.
- **A `docs/architecture/` subfolder** populated by MCP-MOD-002 (classifier catalog inventory) and MCP-MOD-003 (prompt
  template inventory) — both depend on this card mechanically.
- **Auto-redirect stub files** at the old paths (e.g. a stub `docs/current-status.md` that says "moved to
  `docs/core/current-status.md`"). Out of scope — `git log --follow` and the regression test together cover the
  "where did this go?" question, and stub files would pollute the top level the carve-out is trying to clean.
