# CDiscourse UX/UI Roadmap

Canonical roadmap for Stage 6.5 – 6.8 game-board UX work. This doc is the
source for the GitHub Project board at
**https://github.com/users/kyleruff1/projects/1** and is referenced from
every roadmap issue body. Keep them in sync.

- **Project number:** 1
- **Project URL:** https://github.com/users/kyleruff1/projects/1
- **Card catalogue:** `scripts/github/uxBoardCards.json`
- **Dry-run sync:** `npm run github:ux-board:dry`
- **Apply (operator):** `bash scripts/github/applyUxProjectBoard.sh`

---

## Now / Next / Later

### Now — Release 6.5 (Timeline-first polish)

| # | Card | Epic | Priority | Effort | Status |
|---|---|---|---|---|---|
| 1 | TL-001 Make Timeline the default room landing mode | Timeline | P0 | M | Todo |
| 2 | TL-002 Timeline onboarding focus on the first point | Timeline | P0 | S | Todo |
| 3 | TL-003 Timeline board shell with no page redirect | Timeline | P0 | M | Todo |
| 4 | VG-001 Argument visual grammar: shape, color, weight, texture | Visual Grammar | P0 | L | Todo |
| 6 | VG-003 Bootstrap-inspired design tokens without importing Bootstrap | Visual Grammar | P1 | M | Todo |
| 9 | SC-001 Consolidate controls into the side action rail | Sidecar Rail | P0 | L | Todo |
| 10 | SC-002 Timeline node popover | Sidecar Rail | P0 | M | Todo |
| 12 | ST-001 Reposition Stack as Card Details | Stack Detail | P1 | S | Todo |
| 18 | SW-001 Strong vs weak talking point bands | Strength Weakness | P0 | M | Todo |
| 36 | PM-001 Create docs/ux-ui-project-board.md | Project Mgmt | P0 | S | **Done** |
| 37 | PM-002 Add Now/Next/Later tracker to docs/current-status.md | Project Mgmt | P1 | S | Todo |
| 41 | QOL-017 GitHub Projects automation script (sync roadmap to Project #1) | Project Mgmt | P1 | M | Design |
| 42 | QOL-018 Repo-local Claude agent charters for CDiscourse | Project Mgmt | P1 | S | Design |

### Next — Release 6.6 (Branches and evidence)

| # | Card | Epic | Priority | Effort | Status |
|---|---|---|---|---|---|
| 5 | VG-002 Gradient wave rail | Visual Grammar | P0 | L | Todo |
| 7 | BR-001 Tangent kink model | Branches | P0 | L | Todo |
| 8 | BR-002 Split-screen branch inspector | Branches | P2 | XL | Todo |
| 11 | SC-003 Sidecar as detail inspector, not action dumping ground | Sidecar Rail | P1 | M | Todo |
| 13 | ST-002 Suggested reply flags per bubble card | Stack Detail | P1 | M | Todo |
| 14 | EV-001 Evidence object model v1 | Evidence | P0 | L | Todo |
| 15 | EV-002 Source-chain popover | Evidence | P0 | M | Todo |
| 16 | EV-003 Evidence debt tracker | Evidence | P1 | L | Todo |
| 17 | EV-004 Evidence symmetry with game rules | Evidence | P1 | M | Todo |
| 19 | SW-002 Heat, momentum, trend without truth claims | Strength Weakness | P1 | M | Todo |
| 20 | IX-001 Timeline zoom and density modes | Interaction | P1 | L | Todo |
| 30 | GAL-001 Upgrade gallery sections into scrum-like play lanes | Gallery | P1 | M | Todo |
| 31 | GAL-002 Entry cards with first suggested move | Gallery | P1 | M | Todo |
| 32 | RULE-001 Semantic rule-to-UI map | Rules UX | P1 | M | Todo |
| 33 | RULE-002 Evidence symmetry between validation and visuals | Rules UX | P1 | M | Todo |
| 43 | QOL-019 Bot tester prompt refresh: more dynamic, still safe | Analytics | P1 | M | Backlog |
| 44 | QOL-020 Open-room engagement runner patch: filter, side-respect, coverage targeting | Analytics | P1 | M | Backlog |

### Later — Release 6.7 (Profiles and prefs)

| # | Card | Epic | Priority | Effort | Status |
|---|---|---|---|---|---|
| 21 | IX-002 Timeline mini-map overview | Interaction | P2 | L | Todo |
| 22 | IX-003 Keyboard and accessibility navigation | Interaction | P1 | M | Todo |
| 23 | PR-001 My preferences popout | Profile | P1 | M | Todo |
| 24 | PR-002 Profile tag popout | Profile | P2 | M | Todo |
| 25 | PR-003 Avatar upload policy and storage | Profile | P2 | L | Todo |
| 26 | PR-004 Contact information update | Profile | P2 | L | Todo |
| 34 | AN-001 Deterministic board diagnostics | Analytics | P2 | M | Todo |

### Later — Release 6.8 (Public dev deployment)

| # | Card | Epic | Priority | Effort | Status |
|---|---|---|---|---|---|
| 27 | HOST-001 Dev hosting architecture for cdiscourse.com/dev | Hosting | P0 | L | Todo |
| 28 | HOST-002 Dev environment banner and safety boundary | Hosting | P0 | S | Todo |
| 29 | HOST-003 Deployment smoke checklist | Hosting | P0 | S | Todo |
| 35 | AN-002 Visual QA snapshots | Analytics | P2 | M | Todo |
| 39 | QOL-015 Admin email delivery validation (mock first, live operator-gated) | Project Mgmt | P0 | M | Backlog |
| 40 | QOL-016 Supabase Auth email + redirect settings audit for cdiscourse.com/dev | Hosting | P0 | M | Backlog |

---

## QOL-NNN cards added 2026-05-18

Six cards added on top of the original TL/VG/BR/SC/ST/EV/SW/IX/PR/HOST/GAL/RULE/AN/PM lineage:

| # | Card | What it covers |
|---|---|---|
| 39 | QOL-015 Admin email delivery validation | Mock-first validation of `request-argument-deletion` admin notification + Resend fallback. Live send remains operator-gated. |
| 40 | QOL-016 Supabase Auth email + redirect settings audit | Audit signup / reset / magic-link / invite emails and redirect allow-list for cdiscourse.com/dev. |
| 41 | QOL-017 GitHub Projects automation script | `scripts/github/syncUxProjectBoard.js` + `applyUxProjectBoard.sh` + `uxBoardCards.json`. Dry-run default. |
| 42 | QOL-018 Repo-local Claude agent charters | `docs/agent-charters.md` defines 7 roles for future sessions. No `.claude/agents/*` files yet. |
| 43 | QOL-019 Bot tester prompt refresh | More dynamic dev/test bot prompts while preserving anti-amplification doctrine. |
| 44 | QOL-020 Open-room engagement runner patch | Skip empty rooms, respect existing side, target 33-66% coverage deterministically. |

### Originally proposed QOL- cards superseded by existing issues

QOL-001 → #1 TL-001 · QOL-002 → #10 SC-002 · QOL-003 → #9 SC-001 ·
QOL-004 → #4 VG-001 + #18 SW-001 · QOL-005 → #7 BR-001 + #8 BR-002 ·
QOL-006 → #15 EV-002 · QOL-007 → #16 EV-003 ·
QOL-008 → #12 ST-001 + #13 ST-002 · QOL-009 → #23 PR-001 ·
QOL-010 → #24 PR-002 · QOL-011 → #25 PR-003 ·
QOL-012 → #27 HOST-001 · QOL-013 → #28 HOST-002 ·
QOL-014 → #29 HOST-003 + #35 AN-002

---

## Implementation status

| Card | Repo state |
|---|---|
| PM-001 | Done — this document. |
| QOL-017 | Scaffold landed: catalogue + dry-run JS + operator Bash + npm scripts + tests. Future iteration: native `--apply` path in JS. |
| QOL-018 | Charter doc landed (`docs/agent-charters.md`). No `.claude/agents/*` files created — see charter for rationale. |
| All other cards | Planned only — no implementation yet. |

---

## Editing the board

To rename / re-bucket / add cards, edit `scripts/github/uxBoardCards.json`,
then:

```bash
npm run github:ux-board:dry       # validate + preview
bash scripts/github/applyUxProjectBoard.sh   # operator-runnable apply
```

The dry-run validates that every card's `priority` / `effort` / `release` /
`epic` / `phase` matches the live project field options (captured in
`existingProjectFieldOptions`). If the project schema changes, re-snapshot
those options before the next apply.

See `docs/github-projects-setup.md` for the full operator setup playbook.
