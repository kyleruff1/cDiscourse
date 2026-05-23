# MCP-MOD-001 — Documentation reorganization (foundational docs → `docs/core/`)

**Card:** MCP-MOD-001 (Rules UX · P2 · S · Release 6.9 · Movement A).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** A (documentation). First card in the modularity slate.
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** nothing.
**Unblocks:** MCP-MOD-002, MCP-MOD-003 (both write into `docs/architecture/`, a sibling subfolder created here).

---

## 1. Goal

Create a `docs/core/` subfolder for foundational repo documents, move the right documents into it with preserved git
history, and update every internal cross-reference. After this card, a new contributor can find the project's
high-level overview, current status, and next-moves planning in one place rather than at the top level of `docs/`.

## 2. Files moved

The "foundational" set is intentionally narrow. Movement candidates:

| Source path | Destination | Rationale |
|---|---|---|
| `docs/project.md` | `docs/core/project.md` | The single-document project overview. |
| `docs/current-status.md` | `docs/core/current-status.md` | The session-handoff status doc CLAUDE.md instructs every session to read. |
| `docs/session-handoff.md` | `docs/core/session-handoff.md` | Architectural invariants doc CLAUDE.md instructs every session to read. |
| `docs/next-moves.md` | `docs/core/next-moves.md` | Roadmap-level next-moves planning (if present). |
| `docs/implementation-plan.md` | `docs/core/implementation-plan.md` | Staged build plan referenced by CLAUDE.md. |
| `docs/product-spec.md` | `docs/core/product-spec.md` | Full product spec referenced by CLAUDE.md. |
| `docs/architecture.md` | `docs/core/architecture.md` | Architecture doc referenced by CLAUDE.md. |
| `docs/constitution-v1.md` | `docs/core/constitution-v1.md` | Constitution v1 referenced by CLAUDE.md. |
| `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md` | `docs/core/roadmap-semantic-referee-modularity.md` | The meta-roadmap moves here (rename drops the date prefix). |

The implementer scans `docs/` for any other doc that meets the "foundational" bar (a repo-wide reference, not a card-
specific design or testing run) and moves it the same way. Card-specific docs (`docs/designs/*.md`,
`docs/testing-runs/*.md`, `docs/roadmap-expansions/*.md` other than the meta-roadmap, `docs/ux-storyboards/*.md`,
`docs/project-audits/*.md`) DO NOT move.

## 3. Cross-references updated

After the moves, the implementer greps the entire repo for the old paths and updates every reference. Search targets:

- All Markdown files under `docs/` — relative links and absolute repo-root paths.
- `CLAUDE.md` — instructions point at `docs/current-status.md` and `docs/session-handoff.md`.
- `README.md` if present.
- `.claude/skills/*.md` and `.claude/agents/*.md` — any hardcoded path in skill or agent definitions.
- `scripts/**/*.{js,ts}` — any path string referencing the moved files (e.g. checkpoint scripts).
- `package.json` — `scripts` block if any script references the paths.
- The GitHub-projects tooling under `scripts/github/`.

Each reference becomes the new `docs/core/...` path. Relative links inside moved documents are recalculated based on
the new location.

## 4. History preservation

Each move uses `git mv` so blame history survives. The card's PR description names this requirement explicitly; a
review check is "git log --follow on each moved file still walks back to the original commit."

## 5. Tests

This card has no behavior changes, so no new behavior tests. The required acceptance checks are:

- **Path-existence test** (new, optional): a tiny Jest test that asserts each `docs/core/*.md` path exists. Useful as a
  forward-compat anchor — if a future cleanup accidentally deletes one of these files, the test catches it.
- **No-broken-links scan**: the implementer runs a script (existing or new in-card helper) that scans every Markdown file
  for broken relative links. No new broken link survives the card.
- **Skill / agent regression**: the implementer runs `npm run skills:validate` (referenced in existing CI workflows) and
  confirms no skill or agent breaks from the path changes.

## 6. Deployment

None. Documentation-only card; nothing to deploy.

## 7. Rollback

`git revert` the merge commit. Documents return to their original paths and cross-references restore.

## 8. Acceptance criteria

- [ ] `docs/core/` exists and contains the documents named in §2 (plus any "foundational" doc the implementer
      identified).
- [ ] Every moved file's history walks back through the original commit (verified by `git log --follow`).
- [ ] No internal cross-reference points at an old `docs/*.md` path that has been moved.
- [ ] `CLAUDE.md` instructions point at the new `docs/core/...` paths.
- [ ] `npm run skills:validate` passes (no skill or agent broke).
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] The meta-roadmap at `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md` is moved to
      `docs/core/roadmap-semantic-referee-modularity.md` as part of this card.

## 9. Risks

- **Hardcoded paths in agent prompts or skill instructions.** Mitigated by the cross-reference sweep + the
  skills:validate run.
- **PRs in flight that reference old paths.** Mitigated by surface communication: the operator pauses other docs work
  while this card is in review. If a PR collides, the implementer cherry-picks the path update.

## 10. Not in scope

- Moving design docs (`docs/designs/*.md`), testing runs (`docs/testing-runs/*.md`), or other card-specific docs.
- Reorganizing `docs/architecture/` itself — that subfolder is created here and filled in MCP-MOD-002 / MCP-MOD-003.
- Renaming files for content reasons. The only rename is the meta-roadmap (drops the date prefix).
- Any code change. This card is documentation-only.
