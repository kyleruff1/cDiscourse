# GitHub Projects setup — CDiscourse UX/UI Roadmap

Operator-level setup notes for working with the live GitHub Project that
mirrors `docs/ux-ui-project-board.md`.

- **Project URL:** https://github.com/users/kyleruff1/projects/1
- **Project number:** 1
- **Owner:** `kyleruff1`
- **Repo:** `kyleruff1/cDiscourse`

---

## Prerequisites

1. Install the **official** GitHub CLI from https://cli.github.com/ (or
   `winget install --id GitHub.cli`). Do **not** rely on the npm package
   coincidentally also named `gh` — it's a long-defunct third-party tool
   and is broken on its own.
2. `gh auth login` — pick GitHub.com → HTTPS → "Login with a web browser".
3. `gh auth refresh -s project` — adds Projects v2 scope. Verify with
   `gh auth status` — the token-scopes line should include `project`.

If the project shim isn't on PATH (winget installs to
`$LOCALAPPDATA\Microsoft\WinGet\Packages\GitHub.cli_..._8wekyb3d8bbwe\bin\gh.exe`),
either add that bin dir to user PATH or invoke `gh.exe` by absolute path.

---

## Field schema

Captured live on 2026-05-18 from
`gh project field-list 1 --owner kyleruff1 --format json`:

| Field | Type | Options |
|---|---|---|
| Status | single-select | Todo · In Progress · Done |
| Priority | single-select | P0 · P1 · P2 |
| Effort | single-select | S · M · L · XL |
| Epic | single-select | Timeline · Visual Grammar · Branches · Sidecar Rail · Stack Detail · Evidence · Strength Weakness · Interaction · Profile · Hosting · Gallery · Rules UX · Analytics · Project Mgmt |
| Release | single-select | 6.5 · 6.6 · 6.7 · 6.8 |
| Phase | single-select | Backlog · Design · Build · Review · Done · Blocked |

Built-in fields: Title, Assignees, Labels, Linked PRs, Milestone, Repository,
Reviewers, Parent issue, Sub-issues progress, Created, Updated, Closed.

**Catalogue alignment**: `scripts/github/uxBoardCards.json` carries an
`existingProjectFieldOptions` block. The dry-run validator
(`npm run github:ux-board:dry`) fails fast if any card's `priority`,
`effort`, `release`, `epic`, or `phase` value falls outside the schema —
catching drift before any GitHub mutation happens.

If you add a new option in the web UI (e.g., a `release:6.9` value),
update `existingProjectFieldOptions` in the JSON in the same change.

---

## Adding a single issue to the project

```bash
gh project item-add 1 --owner kyleruff1 --url <ISSUE_URL>
```

Setting a field on that item requires the project ID + field ID + option ID.
The simplest path is `gh project item-edit`:

```bash
gh project item-edit \
  --id <ITEM_ID> \
  --project-id PVT_kwHOAvpEDc4BYA8w \
  --field-id   <FIELD_ID> \
  --single-select-option-id <OPTION_ID>
```

Get the IDs with:

```bash
gh project field-list 1 --owner kyleruff1 --format json
```

---

## Bulk operations

Two scripts in `scripts/github/`:

| File | Role |
|---|---|
| `uxBoardCards.json` | Source of truth: 6 new `QOL-NNN` cards + their target field values. |
| `syncUxProjectBoard.js` | Dry-run validator + plan printer. Default mode. No mutation. |
| `applyUxProjectBoard.sh` | Operator-runnable Bash script that creates missing issues, adds them to project #1, and sets Status/Priority/Effort/Epic/Release/Phase per the catalogue. Reads field IDs and option IDs live from `gh project field-list` — no embedded schema. |

Run order:

```bash
npm run github:ux-board:dry          # validate + preview
bash scripts/github/applyUxProjectBoard.sh   # apply for real
```

**Dedupe.** The Bash script searches `gh issue list --search "$prefix
in:title"` before creating anything. If a prefix already exists, the card is
skipped — re-running is safe.

**Never embed tokens.** Both scripts go through `gh`, which uses the
user-level credential. No `GITHUB_TOKEN` is read from env, written to disk,
or echoed to stdout/stderr.

---

## Limitations / open items

- `gh project field-create` cannot reliably create single-select options on
  an existing field via CLI in 2.92.0. To add new options (e.g.,
  `release:6.9`), edit the project field in the web UI first, then update
  `existingProjectFieldOptions` in the catalogue.
- The current `--apply` mode in `syncUxProjectBoard.js` delegates to the
  Bash script rather than re-implementing the gh calls in Node. The Node
  half is dry-run + validator; the Bash half is the mutator. A future
  iteration (tracked as QOL-017) can collapse the two if the duplication
  proves annoying.
- Issue body templates live entirely in `uxBoardCards.json`. They render
  verbatim into GitHub — no Markdown post-processing, no link rewriting.
  Add a `_doc` field at the top of the JSON whenever the schema changes.
