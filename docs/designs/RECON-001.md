# RECON-001 — Post-Interaction-epic roadmap reconciliation and follow-up filing

**Status:** Design draft
**Epic:** Operations (documentation-only)
**Release:** none (process card)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/269
**Card metadata:** P2 / S / Type: Operations / Branch: `feat/RECON-001-recon-001-post-interaction-epic-roadmap`

---

## Goal (one paragraph)

The Interaction epic for Release 6.7 has shipped. Since the prior reconciliation
report at `docs/roadmap/2026-05-23-post-slate-reconciliation.md` was written, 11
new cards have merged to `main` (QOL-035, QOL-041, QOL-041.1, QOL-041.2,
OPS-001, QOL-038, QOL-040, QOL-039, plus the `band-space-rent` smoke
verification doc and the prior reconciliation pass itself). The
`docs/core/current-status.md` header still says *"Latest implementer card:
QOL-039 — Build complete, awaiting Review"*, which is stale (PR #268 merged at
`9e60310`). Five recently-shipped cards (OPS-001, QOL-041.1, QOL-041.2,
MCP-MOD-001, SMOKE-FIX-002) are referenced in other entries but lack their own
`##` sections in `current-status.md`. Four follow-up candidates surfaced during
the Interaction-epic shipping work (QOL-040.1 notification preferences,
QOL-040.2 moderator-initiated visibility, QOL-036.1 payment-evidence pill
state from composition signals, COMP-001.1 three smoke-surfaced refinements)
plus one design-doc-disclosed v1 gap (QOL-040 §17 deep-link node
pre-activation) — all of which need an explicit file/defer decision before they
re-extrapolate into chain prompts. RECON-001 ships four documentation
artifacts: (1) a fresh dated reconciliation report at
`docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md`, (2)
header + gap-section updates to `docs/core/current-status.md`, (3) explicit
decisions on the five deferred candidates above (with full working scope for
those recommended for filing), and (4) the next-epic identification with a
recommended next card. This card respects every doctrine constraint by virtue
of being documentation-only and citing-only.

**Doctrine constraints that shape the design.** Documentation cards still
inherit the universal `cdiscourse-doctrine` rules:
(a) **no truth labels** in any artifact — Category A means *"shipped through
standard pipeline with review doc"*, never *"correct"* or *"true"*;
(b) **no service-role leaks** — copy comparing the reconciliation diff against
the prior report must never quote real `SUPABASE_SERVICE_ROLE_KEY` or
`ANTHROPIC_API_KEY` values;
(c) **no fabricated AI claims** — the next-epic recommendation cites the
priority queue + storyboard-to-roadmap map + missing-capabilities report, not
"AI suggested" or "the model believes";
(d) **plain language for users** — every status line in the reconciliation
report uses prose, never internal codes;
(e) **v1 scope guards** — the recommended next epic must not be voting,
search, push, OAuth, or any other §10 forbidden item, and the deferred
candidates' working scopes must not violate those guards either.

---

## Data model

**No new data model.** This card writes three documentation files and
optionally files GitHub issues (issue filing is an `gh` shell action, not a
schema change).

The implementer works with three pre-existing canonical structures, treated
as read-only inputs:

1. **The Category A/B/C/D taxonomy** from the prior reconciliation report
   (`docs/roadmap/2026-05-23-post-slate-reconciliation.md` §2.3). The
   implementer carries the taxonomy forward verbatim — same column meaning,
   same definitions, only the row contents change.

2. **The `gh issue list` JSON shape** captured at
   `/tmp/recon-001-open-issues.json` and `/tmp/recon-001-shipped-issues.json`.
   Each item has `{ number, title, state, closedAt?, labels[] }`. The
   implementer reads these and the (uncaptured but easily re-run) full
   open-issue list — not a new shape.

3. **The `docs/core/current-status.md` per-card entry shape** that the file
   already uses for every prior card: `## <CODE> — <Title> (Epic ...)` H2
   header, then `**Status:**` line, then `**Doctrine highlights:**` bullet
   list, then `**Files added:**` / `**Files modified:**` lists, then `**Test
   count:**` line, then `**Operator follow-up to ship live:**` numbered list,
   then a closing `See` reference. The new entries match this exact shape;
   no new field is invented.

---

## File changes

The implementer touches exactly these paths. Everything is under `docs/` or
fixture-adjacent — no production code paths, no `src/`, no `app/`, no
`supabase/`, no `__tests__/` (this card's *artifact* is documentation; tests
only get added if a test *verifies a reconciliation claim* per the issue body's
"Non-deliverables" §3).

### New files

| Path | Purpose | Est. lines |
|---|---|---|
| `docs/designs/RECON-001.md` | **This design doc.** Already authored. | ~600 |
| `docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md` | The new dated reconciliation report. Supersedes the 2026-05-23 report. Structure per §2 below. | ~500–700 |
| `docs/roadmap/2026-05-24-deferred-candidate-dispositions.md` | The explicit decision document for the five deferred candidates per §3 below. Cross-linked from the reconciliation report. | ~250–400 |

### Modified files

| Path | What changes | What stays | Est. lines changed |
|---|---|---|---|
| `docs/core/current-status.md` | (a) Replace header comment (line 2) with a current summary naming the post-Interaction-epic state. (b) Update the QOL-039 `**Status:**` line from "Build complete, awaiting Review" to "Shipped — PR #268 merged 2026-05-24". (c) Insert five new `##` sections for cards that shipped without a dedicated entry: **OPS-001**, **QOL-041.1**, **QOL-041.2**, **MCP-MOD-001**, **SMOKE-FIX-002**. Insert each section *between* existing entries in chronological-by-merge order (newest at top). | Every existing `## <CODE>` section below the header — preserved unchanged. | ~5 lines replaced (header + status), ~400 lines added (five new sections). Net add. |
| `docs/roadmap/2026-05-23-post-slate-reconciliation.md` | Append a single one-line **supersession note** at the very top: `> **Superseded by [2026-05-24-post-interaction-epic-reconciliation.md](./2026-05-24-post-interaction-epic-reconciliation.md).**` Do NOT mutate the rest — the prior report is historical record. | The entire body. | 1 line added. |

### Deleted files

None.

### Files NOT touched (explicit non-deliverable list)

- `src/**`, `app/**`, `supabase/**` — no production code, no migrations, no
  Edge Functions per the issue body's "Non-deliverables" §3.
- `__tests__/**` — the issue body's "Non-deliverables" §3 explicitly excludes
  test file modifications "except where a test verifies a reconciliation
  report claim." This design does NOT identify any such test as necessary;
  if the implementer believes a test is required, they MUST surface the
  conflict to the operator before adding one.
- `docs/designs/QOL-*.md`, `docs/reviews/QOL-*.md` — all 17 shipped-card
  design and review docs are read-only inputs to this card.
- `package.json`, `tsconfig.json`, `.eslintrc*` — no dependency or tooling
  changes.

### Optional artifact (operator-gated): GitHub issues filed

If the implementer's working-scope draft for any deferred candidate passes
the "specifically-enough-to-file" bar per §3 below, the implementer also runs
`gh issue create` to file that candidate. **The launch prompt for this card
grants the orchestrator authority to file these issues**, with the proviso
that the working scope must be specified precisely enough in this design.
Where this design recommends *defer indefinitely* or *BLOCK*, NO issue is
filed.

Filed-issue scope: title + body + labels follow the OPS-001 filing pattern
(see issue #260 for the canonical example). No service-role, no `gh
project` calls beyond `gh issue create`, no `gh issue close` of any open
issue. The implementer commits the resulting issue numbers back into the
reconciliation report's §5 (Category D dispositions) so a fresh reader can
trace every decision.

---

## API / interface contracts

**No code-level API contracts.** This card has three "interface contracts"
in the documentation sense:

### 1. Reconciliation report cross-citation contract

Every Category A row in the new reconciliation report's §2 inventory MUST
cite an existing `docs/reviews/<CODE>.md` file by relative path. The
implementer verifies each cited path resolves with `ls docs/reviews/<CODE>.md`
or equivalent. A claimed Category A row whose cited review doc does not exist
is a defect.

Every Category C row MUST cite an open GitHub issue by `#NNN` number.
Verified by `gh issue view <NNN>` returning `state: OPEN`.

Every Category D row MUST cite (a) the prior reconciliation section
referencing it (e.g. `2026-05-23 §5.1` for COMP-001.1) or (b) the design doc
that introduced the working-name label (e.g. `QOL-040 §E7.2` for QOL-040.1).

### 2. Current-status entry shape contract

Every new `## <CODE>` section in `current-status.md` follows the exact
structure used by the existing 47+ entries already in the file. The
implementer reads the QOL-035 section (line 630–662) as the **canonical short
template** for cards with no migration / no Edge Function. Reads the
QOL-041.2 entry in the QOL-041 section (lines 615+) as **embedded context**
the new QOL-041.2 standalone section must factually agree with.

### 3. Deferred-candidate disposition contract

Each candidate in §3 has exactly one of three dispositions:

- **(a) File with full working scope drafted** — the design lists the
  proposed title, body skeleton, label set, and `area:roadmap` /
  `priority:` / `effort:` / `epic:` labels. The implementer drafts the issue
  body from this skeleton and files it via `gh issue create`.
- **(b) Defer indefinitely with documented rationale** — the design states
  the rationale (typically: integration leverage too low; pressure signal
  absent; future epic will absorb it organically). The implementer copies
  the rationale verbatim into the deferred-candidate-dispositions doc and
  files no issue.
- **(c) BLOCK — operator judgment required** — the design states the
  specific question the operator must answer. The implementer copies the
  question verbatim into the dispositions doc, files no issue, and surfaces
  the BLOCK in the implementer's final summary message.

Each disposition is **exactly one** of these three — never "file and also
defer", never "file pending operator approval after". If the disposition is
(c), the implementer's final message MUST name the BLOCK at the top.

---

## Edge cases

The implementer MUST handle each of these. Each case has a defined
response.

### EC-1 — A new issue is filed between survey snapshot and implementer run

The survey captured `/tmp/recon-001-open-issues.json` at orchestrator launch
time. If the implementer's `gh issue list --state open` returns additional
issues at run time, the new issues either (a) are Category C (genuinely open
work) and get added to the report's Category C inventory, or (b) were filed
by the operator during the design pass for the deferred candidates this card
itself recommends filing, in which case they appear in Category D as
"filed during RECON-001 pass" with the new issue number.

### EC-2 — A `docs/reviews/<CODE>.md` cited as Category A does not exist

If the Category A claim cannot be substantiated by a review doc, the
implementer downgrades the card to **Category B** (closed without review
doc) in the new report and flags it in §4 (Category B operator-review list).
The implementer does NOT manufacture a review doc to satisfy the citation.

### EC-3 — An open issue is closed between survey snapshot and implementer run

If a Category C row's `#NNN` is closed at implementer run time, the row moves
to **Category A** (if a corresponding review doc exists) or **Category B**
(if not). The reconciliation report's §1 executive summary mentions any
mid-run state change.

### EC-4 — The implementer cannot decide between two dispositions for a deferred candidate

The implementer does NOT pick one and hope. The implementer surfaces the
ambiguity in the final summary message and asks the operator to break the
tie. The deferred-candidate-dispositions doc carries a `**Status: pending
operator decision**` line for that candidate.

### EC-5 — A new follow-up candidate surfaces during the implementer's read of design / review docs

If the implementer discovers a previously-unflagged follow-up candidate
during the Category A pass (e.g. reading QOL-041.md surfaces a new gap), the
candidate is added to §3 as a *new sub-section* with the implementer's
recommended disposition. The implementer does NOT silently expand the
deferred-candidate list and file the new candidate — they record it and
surface it.

### EC-6 — Operator pre-decision conflict

The launch prompt grants the orchestrator authority to file deferred
candidates the designer recommends for filing. If the designer's working
scope for a "(a) File" recommendation is *insufficiently precise* — meaning
the implementer cannot draft a real issue body from it — the disposition
silently degrades to **(c) BLOCK** and the implementer's final message names
the missing detail. This is the §3 "specifically enough to file" guard.

### EC-7 — Current-status header conflict with body entries

The current header comment (line 2) names a specific test-suite count
(`10393 tests / 414 suites`). The new header reflects post-Interaction-epic
state; the implementer must check whether subsequent merges changed the
test count and write the actual current count (not the QOL-039-era count).
If the implementer cannot verify the current count without running the
suite (which they should NOT do as part of a documentation-only card), the
header says `~10393+ tests` with the `+` denoting "verified at QOL-039
merge; no later card was a test-bearing pass".

### EC-8 — Doctrine ban-list trip in deferred-candidate scope

Any deferred candidate whose working scope hints at a ban-list violation
(e.g. a notification-preferences UI that says "winning rooms" instead of
"high-activity rooms") gets its working scope rewritten before filing. If
the candidate's storyboard source itself violates the doctrine, the
disposition is **(c) BLOCK** and the design names the conflict.

### EC-9 — v1-scope-guard trip

If a deferred candidate's working scope would require a v1-forbidden feature
(voting, push notification, public API, OAuth, web version, real-time
collaborative editing, argument search), disposition is **(b) Defer
indefinitely** with rationale `"v1 scope guard — see CLAUDE.md §What Not to
Build (v1 Scope)"`. The implementer does NOT file the candidate.

### EC-10 — Concurrent design pass on another card during this card's run

If a parallel agent ships a new card while RECON-001 is in flight, the
report's §1 executive summary cites the cut-off SHA the report reflects
(e.g. `as of main HEAD <SHA>`). The reconciliation is a snapshot — drift
after the snapshot is the *next* reconciliation's concern.

---

## Test plan

The issue body's "Non-deliverables" explicitly states *"No test file
modifications except where a test verifies a reconciliation report claim."*
This design does **not** identify any such required test. The reconciliation
report's claims are verified by:

- **`gh issue view <NNN>`** for every Category C citation — the reviewer
  runs this manually during review, not a committed test.
- **`Test-Path docs/reviews/<CODE>.md`** (or `ls` equivalent) for every
  Category A citation — manual.
- **`grep -n "^## <CODE>"` in `docs/core/current-status.md`** for every
  current-status entry the report references — manual.

No `__tests__/RECON-001.test.ts` is created. The implementer does NOT add
test coverage. If the implementer believes a test is necessary (per §EC-5
above, an unforeseen need), they MUST surface the conflict to the operator
before adding one.

**Doctrine ban-list check (manual, by reviewer).** The reviewer runs the
existing `npm run ux:terminology:audit --strict` to confirm the new
documentation does not introduce prohibited user-facing copy. This audit
already exists and covers `docs/**.md`; no new audit configuration is added.

**Reviewer verification matrix** (per the issue body's acceptance criteria):

- [ ] `git diff main..HEAD --stat` shows only `docs/` paths (no `src/`,
  `app/`, `supabase/`).
- [ ] Each Category A row cites an existing `docs/reviews/<CODE>.md`.
- [ ] Each Category C row cites an open GitHub issue.
- [ ] The `current-status.md` header reflects the actual latest card with no
  stale "awaiting Review" claim.
- [ ] Each deferred candidate has exactly one disposition with reasoning.
- [ ] Next-epic identification cites the priority queue + storyboard-to-
  roadmap map + missing-capabilities report.

---

## Dependencies (cards / docs / files)

### Reads (read-only inputs)

- `docs/roadmap/2026-05-23-post-slate-reconciliation.md` — prior report to
  supersede. Read for the Category A/B/C/D taxonomy carryover.
- `docs/core/current-status.md` — the file being modified. Read in full to
  identify which cards lack their own `##` sections.
- `docs/ux-storyboards/priority-implementation-queue.md` — read for §5
  next-epic identification. The queue is sequential; "next epic" = the next
  P-tier section with unshipped cards.
- `docs/ux-storyboards/storyboard-to-roadmap-map.md` — read for §5
  cross-validation of the next-epic recommendation.
- `docs/ux-storyboards/missing-capabilities-and-issues.md` — read for §5
  gap-inventory cross-check.
- `docs/designs/QOL-040.md` — read for QOL-040.1 working-name confirmation
  (§E7.2 lines 1351–1369) and QOL-040 §17 deep-link gap (lines 832–862).
- `docs/reviews/QOL-040.md` — read for the QOL-040 §17 gap's review-side
  framing (lines 113).
- `docs/reviews/QOL-039.md` — read for QOL-040.2 working-name confirmation
  (lines 604–607).
- `docs/testing-runs/2026-05-23-band-space-rent-smoke-verification.md` —
  read for COMP-001.1 three-candidate spec (lines 81–85).
- `docs/reviews/QOL-038.md` — read for the QOL-038 native deep-link
  deferral (line 106) — confirms scope-reduction is doctrine-aligned.
- `docs/designs/OPS-001.md` (the design that produced PR #262) — read as the
  canonical OPS-001-pattern example for new-issue filing.
- The seven open-issue contexts via `gh issue view #238 #80 #79 #77 #26 #25 #8`
  — verifies each Category C row's metadata.
- The 11 shipped-since-2026-05-23 issue contexts via `gh issue view #260
  #256 #258 #208 #244 #209 #210 #207 #199 #260` — verifies each Category A
  row's metadata.
- The pre-captured survey artifacts at `/tmp/recon-001-*.{json,txt}` — see
  the launch prompt's "Pre-implementer survey output" list.
- `git log --oneline --since="2026-05-23"` — for PR numbers + merge SHAs.

### Blocks (downstream consumers)

This design assumes the following are complete:

- All 17 Interaction-epic cards have shipped (verified by
  `/tmp/recon-001-shipped-issues.json` + the 25-commit `git log` since
  2026-05-23).
- The prior reconciliation report's claims about the *pre-Interaction-epic*
  state are accepted as-is — no retroactive recategorization of
  pre-2026-05-23 cards.
- `docs/reviews/` contains the expected 17 review docs (verified by
  `/tmp/recon-001-review-docs.txt`).

### Blocks (future cards)

This design blocks:

- **The recommended next card** (see §5) — its design agent reads the new
  reconciliation report's §6 ("Recommended next card") as the canonical
  selection rationale, instead of re-doing the priority-queue scan.
- **Any future reconciliation card (`RECON-002+`)** — uses this design's
  six-section structure as the template.
- **Any deferred candidate that gets filed** — uses this design's §3
  working-scope as the issue body draft source.

---

## Risks

### R-1 — Stale survey snapshots

The `/tmp/recon-001-*.{json,txt}` artifacts were captured at orchestrator
launch. If the implementer's run is delayed (e.g. several hours later or
across a session boundary), the open-issue list may have drifted. **Mitigation:**
the implementer re-runs `gh issue list --state open --limit 100` at the
start of their pass and cross-validates against `/tmp/recon-001-open-issues.json`.
If divergence, the live result wins.

### R-2 — Deferred-candidate working-scope under-specification

The §3 working-scope drafts may be too vague to file as real issues. The
"specifically enough" bar is subjective. **Mitigation:** §3 below specifies
each candidate's *working scope acceptance criteria* — a concrete list the
implementer can verify before drafting the `gh issue create` body. If a
candidate fails the criteria, EC-6 applies (silent degrade to BLOCK).

### R-3 — Operator-decision drift during the design pass

The operator may decide, between this design landing and the implementer
running, that a (a)-recommended candidate should actually be deferred. **Mitigation:**
the implementer's final-summary message names every issue they filed, with
the new issue number, so the operator can immediately close any that
contradict their later judgment. No issue is filed with `state: WONTFIX` or
similar — every filed issue is a real piece of work the implementer
believed the design authorised.

### R-4 — Current-status entry merge conflicts

Five new `##` sections are inserted into `current-status.md`. If another
agent is also modifying the file in a parallel branch, a merge conflict is
possible. **Mitigation:** the implementer rebases on `main` before
committing, and the new sections are inserted at distinct line ranges (one
per H2 boundary) so conflict resolution is straightforward.

### R-5 — Next-epic recommendation contradicts a parallel operator priority

The §5 next-epic recommendation is mechanically derived from the priority
queue. If the operator has a different priority in mind, the recommendation
is "rejected" via the operator's next card-launch prompt, not via a recall
of RECON-001. **Mitigation:** the report's §6 frames the recommendation as
"based on the priority queue as written; operator overrides on launch."

### R-6 — Ban-list trip in a deferred-candidate's working-scope draft

The §3 working-scope drafts include user-facing copy proposals (e.g. for
QOL-040.1 notification-preferences UI). Any draft that includes a banned
token would fail `ux:terminology:audit`. **Mitigation:** every working-scope
draft in §3 below uses neutral phrasing ("recent activity", "frequent
participants", "rooms you joined") — never verdict tokens. The reviewer
verifies via the existing audit.

### R-7 — Citation hallucination

The implementer might cite a non-existent review doc or a non-existent
issue. **Mitigation:** §1 audit methodology requires the implementer to
verify each citation programmatically before committing the report.

---

## Out of scope

These items are NOT this card's responsibility, and the implementer must NOT
implement them:

- **Filing GitHub issues for the seven currently-open Category C issues.**
  These are already filed (#238, #80, #79, #77, #26, #25, #8). The new
  reconciliation report just *inventories* them; it does not refile.
- **Closing #238 (the MCP-CAT-001 design-card orphan).** The prior report's
  §4.1 deferred this to operator judgment; this card preserves that deferral.
- **Recategorising Category B cards.** The 10 Category B cards from the
  prior report (QOL-015..QOL-022, QOL-025, QOL-034) remain Category B in
  the new report. The implementer does NOT investigate whether each was
  "really shipped" — that is operator work.
- **Modifying any of the 17 shipped-card design or review docs.** They are
  read-only inputs.
- **Auditing the supersession map** (`docs/roadmap-expansions/`). The prior
  report did not audit it; neither does this one.
- **Filing the "highest-leverage integration follow-ups" from the prior
  report's §6.1** (the 10-row table of cards that could consume composition-
  layer mutations: EV-001..EV-005, GAME-004..006, BR-001/003/004,
  SC-003..SC-005, COMPOSER-001..002, GAL-001..002, SW-002, IX-001..IX-004).
  These are organic candidates per the prior report's recommendation and
  this card does NOT promote any of them to a filed issue. QOL-036.1 is the
  *one* exception that this card explicitly evaluates — and §3 below
  recommends deferring it indefinitely.
- **Modifying CLAUDE.md or any skill (`.claude/skills/*/SKILL.md`).** No
  stage update, no skill content drift.
- **Modifying any project-board / `scripts/github/uxBoardCards.json`** card
  metadata. The reconciliation is read-only against the board.
- **Re-validating the prior report's claims.** The prior report is treated
  as authoritative for state up to 2026-05-23. The new report only covers
  state changes since 2026-05-23.
- **Verifying the test-count claim** in the current-status header by running
  the suite. The implementer takes the QOL-039 entry's claim
  (`10393 tests / 414 suites`) as the most recent verified count; if any
  later card was test-bearing and the count changed, the reviewer flags it
  but the implementer does NOT run the suite.

---

## Doctrine self-check

This card is documentation-only; the doctrine constraints are about content,
not behaviour. Per the `cdiscourse-doctrine` skill:

| Rule | How this design respects it |
|---|---|
| §1 Score is gameplay analysis, never truth | The reconciliation report uses neutral category names ("shipped", "open", "deferred"). No card is called "winning", "correct", "best"; the next-epic recommendation is justified by sequential priority, not "best card". |
| §2 Heat means activity / friction | The report's status framing for cards uses "shipped on 2026-05-DD" and "open since 2026-05-DD" — temporal facts, never "hot" or "trending" framing. |
| §3 Popularity is not evidence | The §5 next-epic rationale cites the priority queue's documented dependency order, not "the most-discussed epic" or "the most popular cards." |
| §4 AI moderator hard limits | The report makes no AI-moderator claims; the deferred-candidate working scopes (especially QOL-040.1) do not require AI moderation decisions. |
| §5 Rules engine is sacred | No code change; the engine is not touched. |
| §6 Secrets policy | The implementer's `gh issue create` commands MUST NOT echo `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `X_BEARER_TOKEN`. The new docs cite the *name* of the key when relevant ("the room-notifications function uses the service-role key already in Supabase secrets") but never a value or fragment. The pre-commit `grep -r "SERVICE_ROLE\|ANTHROPIC_API_KEY" docs/roadmap/` must return zero. |
| §7 No AI calls from production app | This card is documentation-only — no AI call possible. |
| §8 Supabase conventions | No migration, no RLS change, no `arguments` hard-delete; the QOL-039 entry in current-status already says "retained (muted), never deleted" — preserved. |
| §9 Plain language for users | The reconciliation report uses prose throughout. Internal codes (`source_chain_lexical`, `topic_satisfaction_lexical`, etc.) are referenced only when naming a documented gap, never as user-facing copy. |
| §10 v1 scope guards | The next-epic recommendation (Evidence epic per §5) does not require voting, push, OAuth, public API, web, or argument search. The deferred candidates' working scopes are each checked against §10 in EC-9 above; QOL-040.1 working scope explicitly disclaims push and OAuth. |

### Operations-specific checks

- **No service-role usage.** The reconciliation report is read-only; the
  optional `gh issue create` calls are GitHub API actions, not Supabase
  service-role actions.
- **No `.env*` touched.** The implementer's `git diff --stat` must show no
  `.env*` paths.
- **No `package.json` change.** No new dependencies.
- **No skill or CLAUDE.md drift.** Stage-status claims live in CLAUDE.md;
  this card does NOT modify CLAUDE.md. The current-status.md update is
  separate from CLAUDE.md.

---

## Operator steps (if any)

After the implementer commits and the reviewer approves:

1. **Merge the PR.** Standard squash-merge. No deploy chain — no migration,
   no Edge Function redeploy, no app build.

2. **Decide on any BLOCK dispositions.** If §3 below resolves any candidate
   as "(c) BLOCK", the operator answers the surfaced question in a follow-up
   message; the orchestrator either files the candidate then (with the
   resolved scope) or records it as a permanent deferral in a follow-up
   doc-only commit.

3. **Pre-resolved dispositions are auto-filed.** Per the launch prompt, the
   orchestrator has authority to file any (a) disposition during the
   implementer pass. The operator reviews the filed issue numbers in the
   implementer's final-summary message and may close any that contradict
   later judgment.

4. **Use the new reconciliation report as the next session's starting
   point.** Subsequent card launches read
   `docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md` to
   identify the next card, not the (now-superseded) 2026-05-23 report.

5. **No deploy required.** Pure code documentation change.

---

# Section §1 — Audit methodology

The implementer reconciles by running this six-step procedure. Each step
produces an artifact (a list, a table row, a citation) that feeds the
reconciliation report.

## §1.1 — Snapshot baseline

```powershell
# Re-run the survey at implementer time (drift check)
gh issue list --state open --limit 100 --json number,title,labels,createdAt,updatedAt > /tmp/recon-001-open-issues-live.json
gh issue list --state closed --limit 200 --search "closed:>2026-05-22" --json number,title,closedAt,labels > /tmp/recon-001-shipped-issues-live.json
git log --oneline --since="2026-05-23T00:00:00" main > /tmp/recon-001-commits-since-recon.txt
git log --merges --since="2026-05-23T00:00:00" --pretty=format:"%h %s" main >> /tmp/recon-001-commits-since-recon.txt
ls docs/reviews/ | Sort-Object > /tmp/recon-001-reviews-live.txt
```

Cross-validate against the pre-captured `/tmp/recon-001-*.json` artifacts.
If the open-issue list has drifted, the live result is authoritative; if
the closed-issue list has drifted (a new card shipped between launch and
implementer), the new card joins Category A in the new report.

## §1.2 — Classify every commit since the prior reconciliation

For each commit in `/tmp/recon-001-commits-since-recon.txt`:

- If the commit message matches `^<CODE>:` and `<CODE>` has a closed issue
  → **Category A candidate**. Verify `docs/reviews/<CODE>.md` exists.
- If the commit message matches `^design: <CODE>` and there is a
  corresponding implementation commit → record as a design-pass commit; the
  implementation commit is the Category A row.
- If the commit message matches `^docs:` and is the prior reconciliation
  itself or the band-space-rent smoke verification → Category A (process
  card or doc card), but cited as "doc artifact" not "shipped feature".
- If the commit is neither — surface as a discrepancy in the report's §1
  executive summary.

## §1.3 — Build the Category A table

For each Category A candidate from §1.2:

```
| Code | Title | Closed PR | Squash SHA | Closed Date | Review doc | Notes |
```

The implementer extracts `Closed PR` from the commit message's trailing
`(#NNN)`. The squash SHA is the commit's first 7 chars. Closed date comes
from `/tmp/recon-001-shipped-issues-live.json`. Review doc is the relative
path to `docs/reviews/<CODE>.md`. Notes captures anything unusual (e.g.
"shipped without standalone current-status entry — added by RECON-001").

Verify each row by:

```powershell
Test-Path "docs/reviews/$Code.md"
gh issue view $IssueNum --json state,closedAt
git show --stat $SquashSha | Select-Object -First 3
```

A row that fails any verification is downgraded to Category B (closed, no
review doc) and flagged in §4.

## §1.4 — Build the Category B table

Category B = closed issues with no `docs/reviews/<CODE>.md`. The prior
report identified 10 cards in this state (QOL-015..QOL-022, QOL-025,
QOL-034). The implementer:

- Carries the 10 prior-report rows forward verbatim (no re-investigation).
- Adds any new Category B candidate found in §1.3 (a card whose review doc
  is missing).
- Notes: this card does NOT investigate whether each Category B closure
  represented real completion — that is operator work, per the prior
  report's recommendation.

## §1.5 — Build the Category C table

Category C = genuinely open and ready for autonomous pipeline work.

```
| # | Title | Epic | Priority | Effort | Release | Design doc? | Dependencies |
```

The implementer reads each open issue body via `gh issue view <NNN>` and
extracts the four label fields. The "Design doc?" column is `Test-Path
docs/designs/<CODE>.md`. Dependencies are read from the issue body's
"Depends on" section, if any.

Order the table by dependency: a card depending on another open card sorts
after its dependency. Within an unordered tie, sort by Priority (P1 > P2).

Per the issue body's acceptance criteria, every Category C row MUST cite an
open issue number. The implementer does NOT add a row without a #NNN
citation.

## §1.6 — Build the Category D table

Category D = referenced in prior reconciliation or chain prompts but never
filed. The prior report identified 1 (COMP-001.1). This card identifies 4
new candidates (QOL-040.1, QOL-040.2, QOL-036.1, QOL-040 §17 deep-link
gap) — see §3 below for the dispositions.

Each Category D row has:

```
| Working name | Origin (doc + section) | Disposition | New issue # (if filed) |
```

The disposition links to the §3 sub-section of the new reconciliation
report (which mirrors this design's §3).

---

# Section §2 — Reconciliation report template

The new report lives at
`docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md`. The
implementer writes it with this exact section structure (mirrors the prior
report's structure where applicable, with two added sections for §5 and §6):

## §2.1 — Header

```markdown
# Post-Interaction-Epic Roadmap Reconciliation — 2026-05-24

> **Supersedes:** [`2026-05-23-post-slate-reconciliation.md`](./2026-05-23-post-slate-reconciliation.md). The prior report covered state up to 2026-05-23. This report covers all state changes since then, including the completion of the Interaction epic for Release 6.7 (QOL-038 / QOL-040 / QOL-039 shipped) and the supporting MCP-MOD / MCP-CAT / COMP / OPS / QOL-035 / QOL-041 / QOL-041.1 / QOL-041.2 work.

> **Why this exists.** Reconciliation only — no code modified beyond docs, no GitHub issues filed except the §5 deferred-candidate decisions. This is the verified roadmap snapshot before the next session selects a card.
```

## §2.2 — §1 Executive summary

- **Main HEAD:** `<sha>` (`git rev-parse HEAD`).
- **Date:** 2026-05-24.
- **Cards shipped since 2026-05-23:** 11 (8 MCP-MOD already shipped by
  2026-05-22, plus QOL-035, COMP-001, MCP-CAT-001, QOL-041, QOL-041.1,
  QOL-041.2, OPS-001, QOL-038, QOL-040, QOL-039 → that's 10; plus the
  band-space-rent smoke verification + the prior reconciliation pass = 12
  commits total). The implementer counts and reports the actual number.
- **State of post-Interaction-epic work:** Interaction epic (Release 6.7)
  complete. All four originally-blocking QOL cards (QOL-038, QOL-040,
  QOL-039, QOL-041) shipped. OPS-001 codified the migration-bearing
  reviewer template. QOL-041.1 and QOL-041.2 corrected the QOL-041
  migration deploy chain. The Rules-UX epic (Release 6.6) is also largely
  complete via QOL-041 + the MCP-MOD slate; only the catalog design-card
  orphan (#238) and the META-1 cluster (#77, #79, #80) remain in that
  epic family. **The next dependency-ordered card is from the Evidence
  epic** (Release 6.6, queue position P1-E1) — see §6.

## §2.3 — §2 Inventory (full Category A/B/C/D tables per §1.3–§1.6)

Three sub-tables:

- §2.1 — Cards shipped since 2026-05-23 (Category A, 11+ rows)
- §2.2 — All open issues (Category C, 7 rows)
- §2.3 — Category counts (verbatim shape of prior report's §2.3)

## §2.4 — §3 Category C dependency-ordered list

The 7 open issues, dependency-ordered. Format per §1.5. The implementer
groups by epic:

- **Evidence (Epic 6) — none open yet, but the next session's natural
  card** (recommended in §6).
- **Profile (Epic 9):** #25 PR-003 (avatar upload), #26 PR-004 (contact
  info). Large/large. Operator-deferred until Profile epic is sequenced.
- **Branches (Epic 3):** #8 BR-002 (split-screen branch inspector). XL.
  Operator-deferred until Branches epic is sequenced.
- **Metadata governance (cross-epic):** #77 META-1B (realtime tag sync),
  #79 META-1D (vocabulary review), #80 META-1E (metadata diff inspector).
  None are blocked; all are operator-discretion items.
- **Rules-UX design-orphan:** #238 MCP-CAT-001 design card — per prior
  report's §4.1, operator-judgment closure. Preserved here as outstanding.

## §2.5 — §4 Category B operator-review list

Verbatim from prior report's §4 (10 rows). No re-investigation.

## §2.6 — §5 Category D explicit decisions

Five sub-sections, one per candidate. Each sub-section mirrors §3 of this
design:

- §5.1 — QOL-040.1 (notification preferences surface)
- §5.2 — QOL-040.2 (moderator-initiated visibility transitions)
- §5.3 — QOL-036.1 (payment-evidence pill state from composition signals)
- §5.4 — COMP-001.1 (three smoke-surfaced refinement candidates)
- §5.5 — QOL-040 §17 deep-link node pre-activation gap

Each sub-section:

```markdown
### §5.N — <Working name>

**Origin:** <doc path + section>
**Pressure signal:** <high / medium / low / absent>
**Integration leverage:** <high / medium / low>
**Effort estimate:** <S / M / L / XL>
**Operator pre-decision:** authorised filing if working scope precise enough

**Disposition: (a) File / (b) Defer indefinitely / (c) BLOCK**

**Rationale:**
- <bullet 1>
- <bullet 2>
- <bullet 3>

**New issue #:** <NNN if filed, "n/a — deferred" if (b), "n/a — pending" if (c)>

**If filed, the issue body draft is at:**
`docs/roadmap/2026-05-24-deferred-candidate-dispositions.md` §<X>.
```

## §2.7 — §6 Next-epic identification + recommended next card

Three sub-sections:

- **§6.1 — Next-epic methodology** — Cites the priority queue's P1 section,
  the storyboard-to-roadmap map's "covered/missing" delta after the
  Interaction epic shipped, and the missing-capabilities report's
  Evidence-epic gaps.
- **§6.2 — Next epic = Evidence (Epic 6)** — Rationale: the priority queue
  P1-E1 / P1-E2 / P1-E3 series (EV-003, QOL-036, QOL-037) is the next
  unshipped P1 dependency-ordered block. The Interaction-epic prerequisites
  for these (QOL-038 + QOL-040 + QOL-039 + QOL-041) are now satisfied.
- **§6.3 — Recommended next card = EV-003** (Evidence debt tracker).
  Rationale: priority queue position P1-E1 (highest unshipped P1); design
  doc exists at `docs/designs/EV-003.md`; depends on EV-001 (already in
  `src/features/evidence/`); unblocks QOL-036 + QOL-037 which depend on
  EV-003's evidence-debt model. Prerequisites: none beyond shipped state.

The implementer verifies each of these claims by reading the queue + map +
gap report at run time. If the queue has been edited since this design was
written and the natural next card is different, the implementer follows
the actual queue, not this design's pre-mapped recommendation — and notes
the divergence in §6.

---

# Section §3 — Deferred candidate decision framework

## §3.0 — Decision criteria

For each candidate, apply these criteria:

1. **Product pressure signal** — Is there real user / operator pressure
   for this feature? Sources: storyboards, missing-capabilities report,
   operator comments, recent design-doc enrichments naming the gap. Score:
   high / medium / low / absent.

2. **Integration leverage** — Does the candidate unblock multiple
   downstream cards, or is it a leaf-node refinement? Score: high / medium
   / low.

3. **Effort estimate** — S / M / L / XL per the standard label set.

4. **Working-scope precision** — Can the design specify the candidate's
   scope precisely enough for the implementer to draft a real issue body
   without further operator judgment? Yes / no. If no, disposition is (c)
   BLOCK regardless of other criteria.

5. **Doctrine compliance** — Does the candidate's working scope respect
   all 10 doctrine rules and CLAUDE.md §"What Not to Build"? Yes / no. If
   no, disposition is (b) Defer indefinitely with `"doctrine conflict"`
   rationale.

**Default disposition logic:**

| Pressure | Leverage | Effort | Precision | Doctrine | → Disposition |
|---|---|---|---|---|---|
| high | high | any | yes | yes | (a) File |
| high | medium | S/M | yes | yes | (a) File |
| high | low | any | yes | yes | (b) Defer indefinitely (collect more pressure) |
| medium | high | S/M/L | yes | yes | (a) File |
| medium | high | XL | yes | yes | (b) Defer indefinitely (XL warrants its own epic decision) |
| medium | medium/low | any | yes | yes | (b) Defer indefinitely |
| low / absent | any | any | yes | yes | (b) Defer indefinitely |
| any | any | any | no | yes | (c) BLOCK |
| any | any | any | yes | no | (b) Defer indefinitely (doctrine conflict) |

## §3.1 — QOL-040.1 (notification preferences surface)

**Origin:** `docs/designs/QOL-040.md` §E7.2 (lines 1351–1369). The
QOL-040 design explicitly names QOL-040.1 as the working name and
defers per operator decision E7.2.

**Pressure signal:** **absent.** Operator decision E7.2 explicitly states
*"the operator may file it later if real product pressure for preferences
emerges; otherwise the deferral may stand indefinitely."* No
storyboard moment requires per-kind preferences. No user comment cited.

**Integration leverage:** **low.** Preferences are a quality-of-life
enhancement to the existing notification list; they do not unblock any
downstream card. The notification list itself works without preferences.

**Effort estimate:** **L.** Adds: preferences table + RLS, preferences UI
(toggle list), Edge Function read of preferences before insert, a
per-trigger opt-out check, copy for the preferences screen. Multi-file
change touching `src/features/notifications/`, `src/features/preferences/`,
and `supabase/functions/room-notifications/`.

**Working-scope precision:** **yes** — the QOL-040 design's E7.2 and
E3 sections name the integration points (`notificationsOptInStub`,
`useNotifications`) and the JSDoc comments already mark the deferral
locations.

**Doctrine compliance:** **yes** — preferences carry no verdict, no
truth, no popularity; "mute a room" is a personal access preference, not
a judgment. Push is out of scope (preserved); email unsubscribe is
deferred with preferences (preserved).

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure absent — operator decision E7.2 explicitly authorised
  indefinite deferral.
- Leverage low — no card depends on it; the notification list works
  without preferences.
- Filing now creates a "ready" issue that has no demand and may sit
  unaddressed for releases. Better to file when real pressure emerges
  (e.g. user reports excessive notifications, operator wants quiet-hours).

**Recommended re-evaluation trigger:** if the operator observes (a) user
churn from notification volume, (b) feature requests for mute/quiet hours,
or (c) an opt-out is required for compliance reasons (e.g. email
unsubscribe regulation), re-promote QOL-040.1 to disposition (a) and file.

**New issue #:** n/a — deferred.

## §3.2 — QOL-040.2 (moderator-initiated visibility transitions)

**Origin:** `docs/designs/QOL-039.md` (referenced in `docs/reviews/QOL-039.md`
lines 604–607). QOL-039 shipped with creator-only UI gate; the
`callerIsModeratorOrAdmin` field is reserved in the model surface so
QOL-040.2 can later widen the gate to mods without a model break.

**Pressure signal:** **absent.** No storyboard moment requires moderator-
initiated visibility transition. No user comment cited. The QOL-039
design notes that the DB+RLS layer already permits creator-or-mod as
defense-in-depth, so a future mod-initiated transition would not require
schema work — only UI surface + Edge Function gate widening.

**Integration leverage:** **low.** Affects only `record-visibility-
transition` Edge Function + `MakePrivateConfirmation.tsx` UI gate +
`roomVisibilityModel.ts` allowance check. No downstream card depends on it.

**Effort estimate:** **S.** The reserved fields are already in place; the
card flips the UI gate and adds a mod-actor branch in the Edge Function.

**Working-scope precision:** **yes** — QOL-039's design §E4 and the review's
finding #1 name the exact integration points.

**Doctrine compliance:** **yes** — moderator action is structural (room
access), never verdict (the moderator does not judge the room's content
as "true" / "false"). The notification copy already drafted for
`room_made_private` is actor-agnostic.

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure absent — QOL-039 design's §E4 explicitly notes "QOL-040.2 may
  stand indefinitely unfiled if mod-initiated visibility transitions
  never become a product need."
- Leverage low — no card depends on it.
- The reserved fields in the model surface mean a future mod-initiated
  visibility transition can be added in a single S-effort card without
  breaking changes — there is no architectural cost to deferring.

**Recommended re-evaluation trigger:** if the operator observes moderator
intervention is needed (e.g. abusive public-room behaviour that a creator
won't address), promote QOL-040.2 to disposition (a) and file.

**New issue #:** n/a — deferred.

## §3.3 — QOL-036.1 (payment-evidence pill state from composition-layer signals)

**Origin:** `docs/roadmap/2026-05-23-post-slate-reconciliation.md` §6.1.
The prior report identified this as "the strongest candidate for a near-
term integration follow-up" since the QOL-036 chain prompt explicitly
anticipated it ("mutations driving evidence-pill state").

**Pressure signal:** **medium.** The integration was anticipated by the
QOL-036 chain prompt but never carried into QOL-036's shipped scope
(which was additive metadata only). It is consumable now that MCP-CAT-001
has shipped the `evidence_applicability_disputed`,
`corroborating_document_attached`, and `evidence_debt_opened/resolved`
mutations.

**Integration leverage:** **high.** Wires QOL-036's payment-metadata
evidence pill to the composition layer's lifecycle signals — the pill's
applicability-status changes would then fire on classifier signals
rather than only on explicit user-action. Same wiring pattern is then
reusable by EV-001..EV-005 (per the prior report's §6.1 table).

**Effort estimate:** **M.** The card adds a composition-layer consumer in
`src/features/evidence/` that maps the four named mutation types to pill
state transitions. Adds tests covering each mutation-to-state mapping.
Does not require schema or Edge Function changes.

**Working-scope precision:** **yes** — the prior report's §6.1 names the
exact four mutation types and the shipped QOL-036 surface lists the pill
fields they would drive. The MCP-CAT-001 catalog ids are now stable.

**Doctrine compliance:** **yes** — the pill state changes never produce
verdicts. "Applicability disputed" is a status, not a truth claim
(established by QOL-037's design). The composition layer is
deterministic; no AI call required.

**Disposition: (a) File.**

**Rationale:**
- Pressure medium and explicitly anticipated by an earlier chain prompt
  (the QOL-036 chain prompt's integration hint).
- Leverage high — sets the pattern for the broader composition-layer
  integration sweep that the prior report's §6.1 enumerated.
- Effort M — single feature, no schema work.
- Filing now means the next session can sequence it after the Evidence-
  epic baseline (EV-003) without re-extrapolating its scope.

**Working scope for the filed issue:**

- **Title:** `QOL-036.1 - Composition-layer integration for payment-evidence pill state`
- **Labels:** `priority:p2`, `effort:m`, `epic:evidence`, `release:6.7` (post-Evidence-epic),
  `area:roadmap`, `area:ux-storyboards`
- **Body skeleton:**

```markdown
# QOL-036.1 — Composition-layer integration for payment-evidence pill state

Follow-up to QOL-036 (issue #205, shipped 2026-05-21). Anticipated by the QOL-036 chain prompt and the prior reconciliation report's §6.1 ("strongest candidate for a near-term integration follow-up").

## Goal

Wire the payment-evidence pill's applicability-status to composition-layer signals so the pill state changes fire on classifier mutations rather than only on user-action.

## Acceptance criteria

- The pill consumes the following composition-layer mutations (introduced by MCP-CAT-001):
  - `evidence_applicability_disputed` → pill state becomes "applicability disputed"
  - `corroborating_document_attached` → pill state becomes "corroborated"
  - `evidence_debt_opened` → pill state becomes "source requested"
  - `evidence_debt_resolved` → pill state becomes "source supplied"
- Each transition fires deterministically from the classifier output; no AI call from production app.
- The pill's applicability-status field never produces a verdict / truth value (per QOL-037 doctrine).
- No schema or Edge Function changes.
- Tests cover each mutation-to-state mapping plus a doctrine ban-list check.

## Out of scope

- The other 10 cards listed in the prior reconciliation's §6.1 (EV-001..EV-005, GAME-004..006, BR-001/003/004, etc.) — those are separate follow-up candidates. This card establishes the pattern; the sweep is a future operator decision.
- Schema changes — purely a UI / model consumer of existing data.
- AI moderator hookup — deterministic classifier output only.

## Doctrine

- v1 scope: no voting, no push, no OAuth, no public API, no real-time editing, no search.
- AI hard limits: no AI call from production app.
- Plain language: pill copy uses `gameCopy.toPlainLanguage` for any classifier code surfaced to the user.

## Dependencies

- QOL-036 (#205) — shipped, payment-evidence metadata baseline.
- MCP-CAT-001 (effective via PR #252) — shipped, mutation catalog v1.
- COMP-001 (#244) — shipped, composition layer.
- EV-003 (recommended next card per RECON-001 §6) — soft dep; this card can ship in parallel.

## Filed by RECON-001 (2026-05-24) per operator pre-decision authorising filing of recommended candidates.
```

**New issue #:** to be assigned by the implementer's `gh issue create`. The
implementer records the assigned number in the reconciliation report's §5.3.

## §3.4 — COMP-001.1 (three smoke-surfaced refinement candidates)

**Origin:** `docs/testing-runs/2026-05-23-band-space-rent-smoke-verification.md`
§"Follow-up candidates" (lines 81–85). Three candidates surfaced by the
smoke verification against the doc-side 35-id catalog.

The three candidates:

1. **`evidence_applicability_supported`** mutation type — symmetric
   companion to `evidence_applicability_disputed`. Would fire on the
   original evidence-attaching move when a corroborating document
   later supports the same applicability claim.
2. **`prior_dispute_resolved`** mutation type — fires when a concession
   resolves a prior applicability dispute. Doc-flagged as "implementer
   decision."
3. **`sub_axis_resolved`** state transition — when a move on the sub-axis
   carries `ready_for_synthesis=1` with corroborating evidence, the
   active sub-axis should flip from `status: 'open'` to `status:
   'resolved'`. Currently stays open even after a settling move.

**Pressure signal:** **low.** The smoke verification's disposition for all
three is "follow-up candidate; none blocking; none required for QOL-035 or
QOL-036." No user-facing breakage. The doc explicitly frames them as
implementer-decision items rather than hard requirements.

**Integration leverage:** **medium** for the `sub_axis_resolved` candidate
(it is a state-machine refinement that the MCP-CAT-001 addendum explicitly
scoped out — adding it now would close the loop on the open-vs-resolved
sub-axis distinction). **Low** for the other two (asymmetric companions
that no UI currently consumes).

**Effort estimate:** **S** for any single candidate; **M** for the
three-candidate bundle.

**Working-scope precision:** **yes** for `sub_axis_resolved` (the smoke
verification names the exact state transition and the missing
`CompositionState` field). **partial** for the other two — the smoke
verification labels them "implementer decision" and "scope follow-up."

**Doctrine compliance:** **yes** — state transitions are structural, not
verdicts.

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure low — no user-facing breakage, all three are doc-vs-
  implementation gaps the doc itself sanctioned as future work.
- Two of three candidates have only partial working-scope precision.
- The MCP-CAT-001 addendum explicitly stated "rules that would require
  new CompositionState fields are out of scope for this card and should
  be filed as follow-up" — but "should be filed" assumed user-pressure
  signal that has not materialised.
- The Evidence-epic sweep (post-EV-003 — see §6) is the natural moment to
  re-evaluate: if QOL-036.1 ships and the broader composition-layer
  integration pattern proves useful, the three COMP-001.1 candidates can
  be folded into that sweep as a bundle.

**Recommended re-evaluation trigger:** when the composition-layer
integration sweep (post-QOL-036.1) begins, re-check whether
`sub_axis_resolved` is needed to close the loop on the synthesis-readiness
UI. If yes, promote at that point.

**New issue #:** n/a — deferred.

## §3.5 — QOL-040 §17 deep-link node pre-activation gap

**Origin:** `docs/designs/QOL-040.md` §17 (lines 859 area) and
`docs/reviews/QOL-040.md` line 113. The QOL-040 implementer disclosed the
gap honestly: the notification deep-link routes to the correct room, but
cannot pre-activate the *specific* `activeArgumentId` because Stage 6.4's
entry-hint mechanism does not accept one. The room's existing logic
selects the latest move on entry — adequate for v1, less precise than the
storyboards imply.

**Pressure signal:** **low.** Reviewer disposition was "Not a Block — the
notification still routes correctly to the room." The gap is "less
precise than the storyboards imply," not "broken."

**Integration leverage:** **medium.** Fix touches Stage 6.4's entry-hint
mechanism (`seamlessConversationEntry.ts` or equivalent) to accept an
optional `entryHintForArgumentId` field. Once added, every notification
type benefits, and any future deep-link consumer (e.g. a "jump to this
move" share link in the gallery) also benefits.

**Effort estimate:** **M.** Stage 6.4 model is well-tested; the addition
is additive (new optional field, new branch in the hint resolver). The
notification handler in `App.tsx` lines 111–113 already has the
comment-marked spot.

**Working-scope precision:** **yes** — the QOL-040 design §17 and the
QOL-040 review finding #1 name the exact integration points and the
proposed field name (`entryHintForArgumentId`).

**Doctrine compliance:** **yes** — deep-link pre-activation is a routing
refinement, not a verdict. No AI call required.

**Disposition: (a) File.**

**Rationale:**
- Pressure low but clearly identified by both the implementer (in
  source code comment) and the reviewer.
- Leverage medium — the Stage 6.4 extension benefits every future
  deep-link consumer, not just notifications.
- Effort M, precise working scope.
- Filing now means the next time a notification user-experience issue
  arises, the operator has a ready card to promote rather than re-
  extrapolating from the QOL-040 source-code comment.

**Working scope for the filed issue:**

- **Title:** `QOL-040.3 - Deep-link node pre-activation via Stage 6.4 entry-hint extension`
- **Labels:** `priority:p2`, `effort:m`, `epic:interaction`, `release:6.7`,
  `area:roadmap`, `area:ux-storyboards`
- **Body skeleton:**

```markdown
# QOL-040.3 — Deep-link node pre-activation via Stage 6.4 entry-hint extension

Follow-up to QOL-040 (issue #209, shipped 2026-05-24). Identified as a v1 gap in QOL-040 design §17 and QOL-040 review finding #1.

## Goal

Extend Stage 6.4's entry-hint mechanism to accept an optional `entryHintForArgumentId` field so that a notification deep-link can pre-activate the specific argument node the notification references, not just route to the room.

## Acceptance criteria

- Stage 6.4's seamless-entry hint model accepts an optional `entryHintForArgumentId: string` field (additive; existing entry-hint behaviour preserved when field is absent).
- `App.tsx`'s notification handler passes the notification's `activeArgumentId` (already in the `room_notifications` row) to the hint when navigating.
- The argument room screen consumes the hint and selects the specified argument as active on mount; falls back to the existing "select latest move" logic when the hint is absent or the argument is no longer accessible (e.g. soft-deleted).
- No schema change; no Edge Function change; no migration.
- The TODO comment in `App.tsx` lines 111–113 is replaced by the wired call.
- Tests cover: hint present + valid → that argument is active on mount; hint absent → fallback to latest-move; hint references soft-deleted argument → fallback to latest-move with neutral log line.

## Out of scope

- Realtime notification delivery (separately deferred per QOL-040 §17 follow-up).
- Notification preferences (separately deferred per QOL-040.1).
- QOL-038 native deep-link path (separately deferred per QOL-038 review finding #2; the web path is unaffected by this card).

## Doctrine

- v1 scope: no push, no realtime, no OAuth, no public API, no search.
- AI hard limits: no AI call.
- Plain language: no user-facing copy changes — pure routing improvement.

## Dependencies

- QOL-040 (#209) — shipped, notification model.
- Stage 6.4 (`docs/seamless-conversation-entry.md`) — shipped, entry-hint baseline.
- QOL-038 (#207) — shipped, web deep-link path is the consumer this hint
  serves.

## Filed by RECON-001 (2026-05-24) per operator pre-decision authorising filing of recommended candidates.
```

**Note on the working name.** The launch prompt and QOL-040 review use the
working name "QOL-040.2" for this candidate, but QOL-040.2 is already
taken by the moderator-initiated-visibility candidate (per QOL-039 review
lines 604–607). This design re-labels the deep-link gap as **QOL-040.3**
to avoid the name collision. The reconciliation report's §5.5 records the
re-labelling explicitly so the operator is not confused.

**New issue #:** to be assigned by the implementer's `gh issue create`.

## §3.6 — Summary table

| # | Candidate | Working name | Disposition | New issue # (if filed) |
|---|---|---|---|---|
| §3.1 | Notification preferences surface | QOL-040.1 | (b) Defer indefinitely | n/a |
| §3.2 | Moderator-initiated visibility | QOL-040.2 | (b) Defer indefinitely | n/a |
| §3.3 | Payment-evidence pill from composition signals | QOL-036.1 | **(a) File** | <to assign> |
| §3.4 | COMP-001.1 three refinements | COMP-001.1 | (b) Defer indefinitely | n/a |
| §3.5 | QOL-040 §17 deep-link gap | **QOL-040.3** (re-labelled) | **(a) File** | <to assign> |

Two filings recommended (QOL-036.1 + QOL-040.3); three indefinite
deferrals (QOL-040.1 + QOL-040.2 + COMP-001.1).

---

# Section §4 — Current-status update spec

## §4.1 — Header replacement (line 2)

**Current (stale):**
```
<!-- Latest implementer card: QOL-039 (Public ↔ Private Room Visibility Transition Rules — Epic Interaction). 1 migration ... Full suite is 10393 tests / 414 suites (all passing, +230 from QOL-040 baseline). Typecheck + lint clean. -->
```

**New (replacement, line 2):**
```
<!-- Latest implementer card: RECON-001 (post-Interaction-epic roadmap reconciliation; documentation-only). The Interaction epic for Release 6.7 is complete — QOL-038 (#207, PR #264), QOL-040 (#209, PR #266), QOL-039 (#208, PR #268) all shipped. Supporting work: OPS-001 (#260, PR #262, reviewer template), QOL-041 + QOL-041.1 + QOL-041.2 (#210/#256/#258, PRs #255/#257/#259, concession gradient + migration recovery), QOL-035 (PR #253, terminology scrub), MCP-CAT-001 (effective via PR #252, catalog v1), COMP-001 (#244, PR #251, composition layer). Verified test count at QOL-039 merge: ~10393 tests / 414 suites passing, typecheck + lint clean — RECON-001 is doc-only and does not change the count. See `docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md` for the full reconciliation. -->
```

The implementer adjusts the test count if any post-QOL-039 card was test-
bearing (verify by `git log --oneline --since="2026-05-24"` and looking at
each commit's diff for `__tests__/` additions). Per EC-7, if uncertain, use
`~10393+ tests`.

## §4.2 — QOL-039 status line update (line 6 area)

**Current:**
```
**Status:** Build complete, awaiting Review — adds the room visibility...
```

**New:**
```
**Status:** Shipped — PR #268 merged 2026-05-24 (squash `9e60310`). Adds the room visibility...
```

Rest of QOL-039 entry (lines 7–99) preserved unchanged.

## §4.3 — Five new section insertions

The implementer inserts five new `##` sections in `current-status.md`, each
in chronological order at the correct position (newest at top). The
insertion positions are:

- **OPS-001 entry** — insert between the QOL-039 entry (ends ~line 99) and
  the QOL-040 entry (starts line 101). OPS-001 is post-QOL-039 in merge
  order but pre-RECON-001 in topical order. Position: just above `## QOL-040`.

  Actually wait — by *merge* date, the order is QOL-039 (2026-05-24) →
  QOL-040 (2026-05-24, slightly earlier) → QOL-038 (2026-05-24, earlier
  still) → OPS-001 (2026-05-24, before QOL-038) → QOL-041.2 (2026-05-23)
  → QOL-041.1 (2026-05-23) → QOL-041 (2026-05-23). The existing
  current-status order honours this. So the implementer:

- **OPS-001** between QOL-038 (ends line 378) and QOL-041 (starts line 379)
  — because OPS-001 shipped chronologically between them.

- **QOL-041.2** between QOL-041 (ends ~line 629) and QOL-035 (starts line
  630), because QOL-041.2 shipped after QOL-041 and before QOL-035 in
  chronological order. **Re-check:** QOL-041.2 shipped 2026-05-23
  (PR #259), QOL-035 shipped 2026-05-23 (PR #253) earlier in the day,
  so QOL-041.2 actually goes ABOVE QOL-041 in current-status (which
  orders newest-first). Implementer follows the existing newest-first
  convention.

  **Definitive order (newest-first), with PR numbers and merge SHAs:**

  ```
  QOL-039 — PR #268, 9e60310, merged 2026-05-24 latest in day
  QOL-040 — PR #266, 7f2d2cd, merged 2026-05-24 earlier
  QOL-038 — PR #264, 84aeb23, merged 2026-05-24 earlier still
  OPS-001 — PR #262, 2d91b5a, merged 2026-05-24 earliest in day
  QOL-041.2 — PR #259, 6fcfdbf, merged 2026-05-23 late
  QOL-041.1 — PR #257, df0a61d, merged 2026-05-23 earlier
  QOL-041 — PR #255, a41dd3c, merged 2026-05-23 earlier still
  (then existing sections: QOL-035, MCP-CAT-001, COMP-001, MCP-MOD-008..002)
  ```

  Insertion positions in the file:

  - **OPS-001** new section: insert at line 379 (immediately before
    `## QOL-041` line). Existing QOL-038 ends around line 378.
  - **QOL-041.1** new section: insert at line 630 (immediately before
    `## QOL-035`). Existing QOL-041 ends around line 629.
  - **QOL-041.2** new section: insert at line 630 (immediately before
    QOL-041.1, since QOL-041.2 is newer than QOL-041.1). The two new
    sections go in order QOL-041.2 → QOL-041.1.
  - **MCP-MOD-001** new section: insert at line ~782 (immediately before
    `## SMOKE-FIX-001`). MCP-MOD-001 shipped before SMOKE-FIX-001 in
    chronological order, so in newest-first ordering it goes AFTER
    MCP-MOD-002 and BEFORE SMOKE-FIX-001. The implementer verifies
    by checking the merge SHA of MCP-MOD-001 (`2cbdf8b`, 2026-05-22)
    vs SMOKE-FIX-001 (`7140299`, 2026-05-22).
  - **SMOKE-FIX-002** new section: insert at line ~782 (between
    SMOKE-FIX-001 and MCP-MOD-008 — wait, SMOKE-FIX-002 is PR #241
    2026-05-22, MCP-MOD-008 is PR #250 2026-05-22 later in day). The
    implementer verifies merge order via `git log --oneline | grep -E
    "SMOKE-FIX|MCP-MOD-00"` and inserts SMOKE-FIX-002 between the
    correct neighbours. **Definitive:** SMOKE-FIX-002 (5648a9c) is older
    than MCP-MOD-001 (2cbdf8b), so newest-first order is:

    ```
    MCP-MOD-008 ... MCP-MOD-002 (already in file)
    MCP-MOD-001 (NEW)
    SMOKE-FIX-001 (already in file)
    SMOKE-FIX-002 (NEW)
    MCP-018 (already in file)
    ...
    ```

    Wait — re-check: SMOKE-FIX-002 PR #241 merged 2026-05-22 before
    SMOKE-FIX-001 PR #239 merged 2026-05-22? Let me re-verify with the
    actual `git log` output:

    ```
    2cbdf8b MCP-MOD-001 ... (#242)
    c8a51e5 chore(smoke-test): m3 evidence must include sourceText
    5648a9c SMOKE-FIX-002: ... (#241)
    75e6965 chore: settings allowlist ...
    7140299 SMOKE-FIX-001: ... (#239)
    ```

    So commit order (newest-first): MCP-MOD-001 → ... → SMOKE-FIX-002 →
    ... → SMOKE-FIX-001. The implementer follows this. The current-status
    already has SMOKE-FIX-001 in correct position; SMOKE-FIX-002 goes
    ABOVE SMOKE-FIX-001 (between SMOKE-FIX-001 and MCP-MOD-001).

The implementer verifies all insertion positions by running `grep -n "^## "
docs/core/current-status.md` and aligning to the actual file line numbers
at run time. The line numbers in this design are approximations to give
the implementer a starting point.

## §4.4 — Section content templates

Each new section follows the existing convention. Templates for the five
sections:

### OPS-001 section template

```markdown
## OPS-001 — Reviewer template strengthening for migration-bearing cards (Operations · process)

**Status:** Shipped — PR #262 merged 2026-05-24 (squash `2d91b5a`). Documentation-only update to `.claude/agents/roadmap-reviewer.md` adding a "Migration-bearing card verification (mandatory)" section that codifies the four-class verification template surfaced by the QOL-041 migration deploy chain.

**Doctrine highlights:**
- Reviewer template now requires either (a) `npx supabase db reset --linked=false` (when Docker available) or (b) heightened textual review against four named issue classes.
- The four classes: (1) Ambiguous column references in RLS policy bodies; (2) Function/extension dependencies not documented in migration header; (3) RLS recursion through dependent tables; (4) Missing pre-existing-data backfill.
- The template is process-only — no production code, no migrations, no Edge Function changes.

**Files added:** none.

**Files modified:**
- `.claude/agents/roadmap-reviewer.md` (~80 lines added): new mandatory section + four-class checklist.
- `CLAUDE.md` (cross-reference): one-line mention of the new template under "Supabase Conventions".
- `docs/core/known-blockers.md`: new "QOL-041 Migration Deploy Chain — Reviewer Template Strengthened (OPS-001)" entry preserving the QOL-041 lesson.

**Test count:** unchanged (process card).

**Operator follow-up:** none — process change effective on merge.

See `docs/designs/OPS-001.md` and `docs/reviews/OPS-001.md`.
```

### QOL-041.1 section template

```markdown
## QOL-041.1 — Fix-forward migration: qualify ambiguous debate_id in QOL-041 RLS policies (Epic 12 — Rules UX · Migration recovery)

**Status:** Shipped — PR #257 merged 2026-05-23 (squash `df0a61d`). Fix-forward migration that resolves the `debate_id` column-reference ambiguity in the QOL-041 `concession_acceptances` RLS policy bodies (subquery joined `concession_items` with `arguments`, both of which expose `debate_id`).

**Doctrine highlights:**
- Migration-only fix; no model / API change.
- Fix-forward (new migration that supersedes the ambiguous policy) rather than in-place edit — preserves the discipline that applied migrations are never edited.
- Followed by QOL-041.2 in-place recovery (doctrine-scoped exception) — QOL-041.1 is the first-attempt recovery, QOL-041.2 is the final recovery.

**Files added:**
- `supabase/migrations/20260523000013_qol_041_1_fix_concession_acceptances_policies.sql` (~120 lines): drops the four ambiguous RLS policies and re-creates them with explicit table-qualified `debate_id` references.

**Files modified:** none.

**Test count:** unchanged (migration-only).

**Operator follow-up to ship live:** `npx supabase db push --linked` to apply the new migration.

See `docs/designs/QOL-041.1.md` and `docs/reviews/QOL-041.1.md`.
```

### QOL-041.2 section template

```markdown
## QOL-041.2 — In-place migration recovery for QOL-041 (doctrine-scoped exception · Epic 12 — Rules UX)

**Status:** Shipped — PR #259 merged 2026-05-23 (squash `6fcfdbf`). Doctrine-scoped exception to the "never edit an applied migration" rule: rewrites the QOL-041 migration `20260522000012_qol_041_concession_acceptance.sql` in-place to fix the column-ambiguity bug at source, then deletes the QOL-041.1 fix-forward migration (which is no longer needed).

**Doctrine highlights:**
- Doctrine-scoped exception is explicitly tracked in `docs/core/known-blockers.md` "QOL-041 Migration Deploy Chain" entry. The exception is justified by: (a) the original QOL-041 migration had never been applied to any non-dev environment; (b) the QOL-041.1 fix-forward was itself never applied to any non-dev environment; (c) in-place rewrite produces a single canonical migration file rather than a fix-forward chain that complicates future review.
- The exception is one-time and not a general pattern.
- OPS-001 (PR #262) codified the lesson learnt into the roadmap-reviewer template so future migration-bearing cards catch the column-ambiguity issue at review time, not at deploy time.

**Files modified:**
- `supabase/migrations/20260522000012_qol_041_concession_acceptance.sql` (in-place rewrite): four RLS policy bodies updated with table-qualified `debate_id` references.

**Files deleted:**
- `supabase/migrations/20260523000013_qol_041_1_fix_concession_acceptances_policies.sql`: the QOL-041.1 fix-forward, no longer needed.

**Test count:** unchanged (migration-only).

**Operator follow-up to ship live:** `npx supabase db reset --linked=false` to re-apply migrations cleanly in dev; for any environment that already applied QOL-041 + QOL-041.1, the operator manually drops + recreates the four policies (one-time recovery). See `docs/designs/QOL-041.2.md` for the recovery script.

See `docs/designs/QOL-041.2.md` and `docs/reviews/QOL-041.2.md`.
```

### MCP-MOD-001 section template

```markdown
## MCP-MOD-001 — Documentation reorganization (foundational docs → docs/core/) (Epic 12 — Rules UX · Movement A)

**Status:** Shipped — PR #242 merged 2026-05-22 (squash `2cbdf8b`). Pure documentation reorganization that relocates 12 foundational docs into `docs/core/` so subsequent MCP-MOD-002..008 cards can reference a single canonical location.

**Doctrine highlights:**
- Documentation-only — no production code, no migrations, no Edge Functions.
- Uses `git mv` to preserve file history.
- Updates every cross-reference in `CLAUDE.md`, `docs/core/architecture.md`, `docs/core/product-spec.md`, `docs/core/constitution-v1.md`, and the meta-roadmap doc.

**Files moved:** 12 files relocated to `docs/core/` (named in PR #242 commit body). No content changes; only paths.

**Test count:** unchanged (documentation-only).

**Operator follow-up:** none — paths effective on merge.

See `docs/designs/MCP-MOD-001.md` and `docs/reviews/MCP-MOD-001.md`.
```

### SMOKE-FIX-002 section template

```markdown
## SMOKE-FIX-002 — Tighten seed prompt: enumerate routeSuggestion + frictionSuggestion values + worked example (Epic 12 — Rules UX)

**Status:** Shipped — PR #241 merged 2026-05-22 (squash `5648a9c`). Targeted remediation on top of SMOKE-FIX-001's diagnostic-log addition: rewrites the semantic-referee seed prompt to enumerate the 7 `routeSuggestion` enum values and 8 `frictionSuggestion` enum values inline and ship a one-shot worked example with ban-list-clean concrete values. After Supabase auto-redeploys on merge, the smoke-test re-run is the acceptance check.

**Doctrine highlights:**
- Bumps `SEED_PROMPT_VERSION` to `mcp-semantic-referee-prompt-v1` per the version-bump-on-wording-change invariant.
- Worked example contains zero verdict / truth / popularity tokens (ban-list-clean).
- No production code path changed beyond the seed prompt module — the validators, redactor, and provider plumbing are untouched.

**Files modified:**
- `supabase/functions/_shared/semanticReferee/seedPrompt.ts`: enumerated `routeSuggestion` + `frictionSuggestion` values inline; added worked example; bumped `SEED_PROMPT_VERSION`.

**Test count:** +X tests (SMOKE-FIX-002 adds ban-list and version-stamp tests). Implementer verifies the count.

**Operator follow-up:** none — Supabase auto-redeploys the Edge Function on merge per the Supabase GitHub integration. Smoke-test re-run is the acceptance check.

See `docs/designs/SMOKE-FIX-002.md` and `docs/reviews/SMOKE-FIX-002.md` if present (the SMOKE-FIX-002 review may have been folded into a single comment on PR #241 — implementer checks).
```

The implementer verifies each section against the corresponding `docs/designs/<CODE>.md` and `docs/reviews/<CODE>.md` (where present) to ensure factual accuracy.

## §4.5 — Preserved sections

Every `##` section currently in `docs/core/current-status.md` BELOW the
QOL-039 entry is preserved unchanged. The implementer does not edit any
prior entry, even to fix typos. The historical record is sacred.

---

# Section §5 — Next-epic identification methodology

## §5.1 — Methodology

1. **Read the priority queue** (`docs/ux-storyboards/priority-implementation-queue.md`).
   The queue is sequential by design — work proceeds top-to-bottom. The
   "next" card is the first card in the highest-priority unshipped block.

2. **Identify the boundary** between shipped and unshipped. Walk down the
   queue and mark each card as shipped (closed issue + review doc) or
   unshipped (open issue or no issue). The first unshipped card in the
   highest-priority unshipped block is the candidate.

3. **Validate via the storyboard-to-roadmap map**
   (`docs/ux-storyboards/storyboard-to-roadmap-map.md`). Each storyboard
   moment is either "Covered" or "New". The candidate from step 2 should
   either be a "New" card or an "existing-card follow-up." If the
   candidate is "Covered", it has been mis-identified — re-walk the queue.

4. **Cross-check via the missing-capabilities report**
   (`docs/ux-storyboards/missing-capabilities-and-issues.md`). The
   candidate should appear in the summary table as a missing capability
   (or as an in-progress capability that depends on the candidate). If
   not, the candidate is mis-identified.

5. **Verify dependencies are satisfied.** Check the candidate's design doc
   (or stub) for a "Depends on" section. Each dependency must be shipped
   (Category A) or in a complete state (e.g. design doc plus pure-TS model
   landed in a prior stage).

6. **Identify the recommended next card.** The candidate from steps 1–5 is
   the recommendation. State the rationale by citing all four sources
   (queue + map + report + deps).

## §5.2 — Applying §5.1 to current state

**Queue walk** (priority queue, P-section-by-section):

- **P0 — Foundation / terminology / unblockers** — all shipped:
  - P0-1 QOL-035 → SHIPPED (PR #253).
  - P0-2 IX-001 (P1-G2 below) → not yet (open as #not-filed-yet, but
    listed as a P1 below — the P0-2 row says "with the gallery work";
    treat as P1 priority).
  - P0-3 QOL-030 → SHIPPED (#199, PR before recon-cutoff).
  - P0-4 GAME-003B → status uncertain in queue (P0-4 references the stub;
    no closed issue cited). The implementer verifies via `gh issue list
    --search "GAME-003B"`.
  - P0-5 standing guardrail → always-on, not a build item.

- **P1 — Entry gallery and argument discovery** —
  - P1-G1 GAL-002 (gallery triage set) — open / status uncertain.
  - P1-G2 IX-001 (lens model) — open / status uncertain.
  - P1-G3 QOL-031 (Act popout, observer-first folding) — SHIPPED if
    `docs/reviews/QOL-031.md` exists. (Per `/tmp/recon-001-review-docs.txt`:
    not listed — so OPEN.)

  Wait, recheck: the review-docs list contains QOL-038, QOL-039, QOL-040,
  QOL-041, QOL-041.1, QOL-041.2, QOL-030, QOL-031, QOL-032, QOL-033,
  QOL-035... Actually the survey lists 97 review docs and I see in
  `/tmp/recon-001-review-docs.txt`: COMPOSER-001, COMPOSER-002, EV-001..005,
  GAL-001, GAL-002 — so **GAL-001 and GAL-002 have review docs** — they
  are SHIPPED. The implementer cross-validates each via `gh issue view`
  for the closed-state confirmation.

  Reviewing the doc list more carefully:
  - QOL-030 review doc present → P1-C1 SHIPPED.
  - QOL-031..QOL-033 not in the listed review docs → P1-C2/C3/C4 NOT
    shipped (or shipped but missing review doc — implementer checks).

  **Per the current-status.md heading listing** (from `grep -n "^## "`):
  QOL-030/031/032/033 all have current-status entries from earlier stages,
  but those are *design-stage* entries, not shipped entries. The
  implementer cross-checks: a card is "shipped" only when (a) its issue is
  closed AND (b) a review doc exists AND (c) the implementer cited a
  closing PR. Without all three, the card is "designed but not shipped."

- **P1 — One-box composer (P1-C1..C4)** — QOL-030 SHIPPED (#199, before
  recon-cutoff); QOL-031..QOL-033 status uncertain. Implementer verifies.

- **P1 — Timeline / node interaction (P1-T1..T3)** — TL-001..003 covered
  by stage history; BR-003..004 covered; remaining items are polish
  follow-ups, not blocking the next epic.

- **P1 — Evidence and source-chain UX (P1-E1..E3)** —
  - **P1-E1 EV-003 (Evidence debt tracker)** — design doc present at
    `docs/designs/EV-003.md`; no review doc; no closed issue cited in
    the catalogue. Status: **DESIGNED, UNSHIPPED.** This is the
    **first unshipped P1 card with a real design doc** after the
    composer block (which has design but is not the natural next sweep
    given the Evidence-epic-shaped storyboard gaps the Interaction-
    epic shipping just opened).

  - **P1-E2 QOL-036 (Payment / screenshot evidence metadata)** —
    SHIPPED (PR #213, pre-recon-cutoff). Review doc present.
  - **P1-E3 QOL-037 (Evidence applicability dispute flow)** — SHIPPED
    (PR #214, pre-recon-cutoff). Review doc present.

  So the P1-E block has EV-003 as the only unshipped card. EV-003 unblocks
  the broader composition-layer-integration sweep (per the prior report's
  §6.1) and aligns naturally with the QOL-036.1 filed candidate (§3.3).

- **P2 — Notifications / invite lifecycle (P2-N1, P2-N2)** —
  - QOL-038 SHIPPED (#207, PR #264).
  - QOL-040 SHIPPED (#209, PR #266).
  So the P2-N block is fully shipped.

- **P2 — Settlement / archival (P2-S1, P2-S2)** —
  - P2-S1 RULE-follow-up — partial shipping per the priority queue
    notes. Status uncertain.
  - P2-S2 QOL-042 — open in the catalogue, no review doc. Status: open.

- **Later — Voting** — out of scope.

**Conclusion of §5.2:** The first unshipped P1 card in dependency order
that has a complete design doc is **EV-003 (Evidence debt tracker)**.
EV-003 is the recommended next card.

## §5.3 — Validating EV-003 against the three other sources

- **Storyboard-to-roadmap map** — EV-003 appears as the implementer for
  Scenario 2 Steps 9 ("Ask for source", evidence-debt marker) and 10
  ("Evidence supplied → status improves"). Both rows are marked
  "Covered" in the map's "Existing card / baseline" column — but
  "Covered" here means the existing baseline EV-001 + EV-002 + EV-003
  *together* cover it. The EV-003 design has not shipped, so the row's
  "Covered" status is contingent on EV-003 actually landing.

- **Missing-capabilities report** — EV-003 ("Evidence-debt marker /
  Source requested") appears in the report's coverage table as
  "Built — EV-003." Same caveat as above — "Built" here refers to the
  doctrine model existing, not the user-facing UI shipping.

- **Dependencies** — EV-003 depends on EV-001 (EvidenceArtifact, shipped
  per `src/features/evidence/` listing in `/tmp/recon-001-features.txt`).
  No other unshipped dep.

EV-003 is the validated next card.

## §5.4 — Recommended next card: EV-003

**Card:** EV-003 (Evidence debt tracker)
**Epic:** Evidence (Epic 6)
**Release:** 6.6 (Branches and Evidence)
**Design doc:** `docs/designs/EV-003.md` (verify presence at run time)
**Prerequisites:**
- EV-001 evidence object model (shipped, per `src/features/evidence/`).
- Stage 6.1.8 argument-room timeline (shipped).
- QOL-038/040/039 Interaction-epic shipping (just completed) — provides
  the notification infrastructure EV-003 will dispatch `source_requested`
  / `evidence_supplied` events through.

**Rationale (one paragraph for the report's §6.3):**

EV-003 is the first unshipped P1 card in priority-queue dependency order
that has a complete design doc, no unshipped dependencies, and unblocks
multiple downstream pieces. The Interaction epic just shipped the
notification surface that EV-003 will dispatch through (`source_requested`
trigger in `room-notifications`, already implemented per QOL-040 §6
trigger row 4). QOL-036 and QOL-037 (the other two P1-E cards) shipped
ahead of EV-003 in chronological order but both *expect* the
evidence-debt baseline EV-003 establishes; their shipped scope landed
without it because EV-001's static evidence object was sufficient for
their metadata-only acceptance criteria. With EV-003 landed, the
composition-layer integration filed as QOL-036.1 (§3.3) can ship next,
followed by the broader Evidence-epic sweep (EV-005, BR-001..004 polish,
SC-003..005, etc.) the prior reconciliation's §6.1 enumerated.

---

# Section §6 — Acceptance criteria

The implementer's output passes RECON-001 only if **every one** of these
conditions is true. The reviewer's verdict matrix checks each item.

## §6.1 — File-presence criteria

- [ ] `docs/designs/RECON-001.md` exists (this design doc).
- [ ] `docs/roadmap/2026-05-24-post-interaction-epic-reconciliation.md`
  exists.
- [ ] `docs/roadmap/2026-05-24-deferred-candidate-dispositions.md` exists.
- [ ] `docs/core/current-status.md` exists and has been modified (header +
  QOL-039 status line + five new sections).
- [ ] `docs/roadmap/2026-05-23-post-slate-reconciliation.md` has the
  one-line supersession note at the top.

## §6.2 — Diff-scope criteria

- [ ] `git diff main..HEAD --stat` shows ONLY paths under `docs/`,
  `.claude/`, or `fixtures/`. No `src/`, no `app/`, no `supabase/`,
  no `__tests__/`, no `package.json`, no `tsconfig.json`, no `.env*`.
- [ ] `grep -r "SERVICE_ROLE\|ANTHROPIC_API_KEY\|XAI_API_KEY\|X_BEARER_TOKEN"
  docs/roadmap/ docs/core/current-status.md docs/designs/RECON-001.md`
  returns ZERO matches (no secret leaks).

## §6.3 — Reconciliation report content criteria

- [ ] Report's §1 executive summary names the actual `main` HEAD SHA and
  date 2026-05-24.
- [ ] Report's §2 Category A table cites a `docs/reviews/<CODE>.md` for
  every shipped card row.
- [ ] Report's §2 Category A table cites a closing PR # and a 7-char
  squash SHA for every shipped card row.
- [ ] Report's §3 Category C list cites an open issue `#NNN` for every
  open card row.
- [ ] Report's §4 Category B list carries forward the prior report's 10
  rows unchanged.
- [ ] Report's §5 Category D list has exactly five sub-sections (one per
  candidate per this design's §3).
- [ ] Report's §5 each sub-section has exactly one disposition (one of
  (a)/(b)/(c)).
- [ ] Report's §6 names EV-003 as the recommended next card (or, if the
  queue has been edited and EV-003 is no longer the natural next card,
  the report names whatever IS the natural next card and explicitly notes
  the divergence from this design).

## §6.4 — Deferred-candidate-dispositions doc criteria

- [ ] Doc has exactly five sub-sections, one per candidate from §3.
- [ ] Each (a)-disposition sub-section contains the full filed-issue body
  text the implementer used in `gh issue create`.
- [ ] Each (a)-disposition sub-section ends with the assigned issue number.
- [ ] Each (b)-disposition sub-section contains the rationale and the
  recommended re-evaluation trigger.
- [ ] Each (c)-disposition sub-section (if any) names the specific
  question for the operator and surfaces the BLOCK in the implementer's
  final-summary message.

## §6.5 — Current-status update criteria

- [ ] Line 2 header comment updated per §4.1 (no stale "Build complete,
  awaiting Review" claim).
- [ ] QOL-039 status line updated per §4.2 (shipped, PR #268, squash
  `9e60310`).
- [ ] Five new `##` sections inserted (OPS-001, QOL-041.1, QOL-041.2,
  MCP-MOD-001, SMOKE-FIX-002).
- [ ] Each new section uses the existing convention (H2 header, Status
  line, Doctrine highlights, Files added/modified/deleted, Test count,
  Operator follow-up, See reference).
- [ ] Each new section is inserted at the correct chronological position
  (newest-first; matches the existing file's ordering convention).
- [ ] No pre-existing `##` section is modified (preservation of historical
  record).

## §6.6 — GitHub-issue filing criteria (if applicable)

- [ ] Exactly TWO new issues filed by this card: QOL-036.1 and QOL-040.3.
- [ ] Each filed issue's body matches the working-scope draft in §3.3 /
  §3.5 of this design.
- [ ] Each filed issue has the correct labels (`priority:p2`, `effort:m`,
  `epic:<correct-epic>`, `release:6.7`, `area:roadmap`,
  `area:ux-storyboards`).
- [ ] Each filed issue's number is recorded in the reconciliation report
  §5 and the dispositions doc §3.

## §6.7 — Doctrine criteria

- [ ] The reconciliation report contains zero verdict tokens (no "winner",
  "loser", "correct", "true", "false", "best", "liar", "dishonest", "bad
  faith", "manipulative", "extremist", "propagandist", "stupid",
  "idiot"). Verified via the existing `ux:terminology:audit --strict`.
- [ ] No internal validation codes appear as user-facing strings in any
  new doc. (Internal codes may be referenced when naming a documented
  gap — e.g. "the `evidence_applicability_disputed` mutation" — but
  never as user-facing copy.)
- [ ] Every deferred candidate's working scope respects all 10 doctrine
  rules and CLAUDE.md §"What Not to Build" — verified by the implementer
  before drafting the `gh issue create` body.

## §6.8 — Commit message criteria

- [ ] Commit message follows the OPS-001 / prior-reconciliation pattern:
  `design: RECON-001 - post-Interaction-epic roadmap reconciliation`
  for the design doc commit; the implementer's commit may follow a
  different convention but should clearly attribute to RECON-001.

## §6.9 — Final summary criteria (implementer's user-facing message)

- [ ] Names the four artifacts created/modified.
- [ ] Names the two filed issue numbers (if (a)-dispositions fired).
- [ ] Names the recommended next card (EV-003) with one-line rationale.
- [ ] Names any (c) BLOCK dispositions for operator attention.
- [ ] Is terse (≤8 lines) — the docs carry the detail.

---

*End of RECON-001 design draft. Doctrine self-check: clean. Out-of-scope list: explicit. Dependencies: documentation-only. Risks: enumerated. Edge cases: ten cases named with specific handling. The implementer can execute without clarifying questions, modulo the EC-6 "specifically enough to file" guard which §3 already addresses with explicit working-scope drafts.*
