# Roadmap Collision & Supersession Analysis — 2026-05-21

A deep analysis of numbering collisions and conceptual supersession across the
CDiscourse roadmap, triggered by the QOL numbering collision the UX storyboard
pass introduced. Covers the fix applied, the supersession the one-box design
(QOL-030…033) creates, the remaining conceptual tensions, and the refactor plan.

---

## 1. Scope & method

- **Numbering collisions** — every GitHub issue (109 total) was prefix-extracted
  and checked for duplicate `PREFIX-NNN` keys.
- **Conceptual collisions** — the one-box interface design
  (`docs/ux-storyboards/one-box-interface-model.md`, QOL-030…033) was
  cross-referenced against the shipped roadmap (`docs/ux-ui-project-board.md`,
  `docs/current-status.md`, `docs/designs/`).
- **Catalogue state** — `scripts/github/uxBoardCards.json` was checked against
  live GitHub issue numbers.

## 2. Numbering collisions

### 2.1 The one real collision — QOL-021…026

The UX storyboard pass (commit `9a43bff`) created catalogue cards QOL-021…029.
**QOL-021…026 collide with six cards already on the repo:**

| Storyboard-pass card | Collided with |
|---|---|
| QOL-021 Storyboard canon | #56 QOL-021 Fix GitHub CLI binary resolution |
| QOL-022 Terminology scrub | #58 QOL-022 Install @testing-library/react-native |
| QOL-023 Payment evidence metadata | #109 QOL-023 Supabase auth redirect helper |
| QOL-024 Evidence applicability | #110 QOL-024 Admin user invite/create workflow |
| QOL-025 Invite/auth return path | #136 QOL-025 Whole-app button inventory |
| QOL-026 Public↔private transition | #137 QOL-026 Fix Admin All Arguments load error |

**Root cause:** `scripts/github/uxBoardCards.json` is a partial snapshot
(`_doc` dated 2026-05-18, contents QOL-001…020). The repo kept allocating QOL
numbers *outside* the catalogue (QOL-021…026 were created directly as issues
#56–#137). The storyboard pass trusted the stale catalogue and numbered from
QOL-021.

**Entanglement:** the real QOL-023/024/026 (auth + admin work) are referenced in
~50 source/test files and have their own `docs/designs/QOL-023|024|026.md` and
`docs/reviews/`. The renumber therefore **cannot be a global find/replace** — it
is scoped to the storyboard-pass-authored files only.

### 2.2 Not collisions — verified

The prefix scan flagged `LIFE`, `META`, `HOST` as "duplicate keys." These are
**false positives** — sub-card naming (`LIFE-001` / `LIFE-1A` / `LIFE-1B` /
`LIFE-1C`; `META-001` / `META-1A` / `META-1C`; `HOST-001` / `HOST-001b`). The
scan's prefix regex stopped at the alpha segment. No real LIFE/META/HOST
collision exists.

**Conclusion: the QOL-021…026 collision is the only numbering collision in the
project.**

### 2.3 The fix applied this pass

The storyboard-pass cards are renumbered into the next free contiguous block
(verified free against `gh issue list` and `docs/designs/`):

| Was | Now | Card |
|---|---|---|
| QOL-021 | **QOL-034** | UX storyboard canon + narrative-officer skill |
| QOL-022 | **QOL-035** | User-facing terminology scrub |
| QOL-023 | **QOL-036** | Payment / screenshot evidence metadata |
| QOL-024 | **QOL-037** | Evidence applicability dispute flow |
| QOL-025 | **QOL-038** | Invite → signup/auth → room return path |
| QOL-026 | **QOL-039** | Public ↔ private room visibility transition |
| QOL-027 | **QOL-040** | Invite & response notification lifecycle |
| QOL-028 | **QOL-041** | Concession acceptance gradient |
| QOL-029 | **QOL-042** | Linked prior argument reference |

The one-box cards **QOL-030…033 keep their numbers** — they were already free.
Final state: one-box = QOL-030…033, storyboard pass = QOL-034…042 — each
contiguous. Renumber scope: `uxBoardCards.json`, the `docs/ux-storyboards/`
docs, the storyboard-pass `docs/designs/QOL-030…033.md` cross-refs,
`docs/current-status.md` (the storyboard entry only), `docs/next-prompts.md`,
`scripts/ux/auditUserFacingTerminology.js`. **No source file, no real
QOL-023/024/026 design/review doc was touched.**

### 2.4 Catalogue hygiene

`uxBoardCards.json` is not a reliable QOL-number authority — it is a partial
snapshot. **Recommendation:** its `_doc` should state it is a partial catalogue
and that new QOL numbers must be checked against `gh issue list`, *not* against
the catalogue's max. A future card could make the sync script fail if a
catalogue prefix already exists as a GitHub issue with a different title.

## 3. Conceptual supersession — QOL-030…033

The one-box interface design supersedes the **build requirements** of a web of
shipped/built cards. "Supersede" here means: the card's acceptance criteria are
now subsumed by a QOL-03x card; the card's pure **model** survives, but its
standalone React **surface** is re-housed.

| Superseding card | Supersedes the surface of | Survives unchanged |
|---|---|---|
| **QOL-030** One-box foundation | COMPOSER-001, COMPOSER-002 (the composer dock → the OneBox) | — |
| **QOL-031** Act popout | SC-001 side rail · SC-004 action dock · RULE-005 `ChannelChipRow` | `ObserverActionDockLayout`, `timelineNodeActionDockModel`, `channelModel` — the pure models |
| **QOL-032** Inspect popout | SC-002 node popover · SC-003 sidecar | `sourceChainPopoverModel`, `buildSidecarViewModel` |
| **QOL-033** Go popout | IX-002 mini-map · IX-001 density/lenses | `timelineMiniMapModel`, the IX-001 density hooks |

QOL-030 also **absorbs** the bespoke input surfaces — `CreateDebateForm`,
`JoinDebatePanel`, `AddAnnotationSheet`, `DeletionRequestSheet` — as box types
(named QOL-030 follow-ups).

**Doctrine of the supersession:** every superseded surface is a thin React
shell over a pure model. The supersession is a **re-housing under the popout
chassis — not a model rewrite.** The QOL-030…033 *implementation* is where the
code refactor happens; this analysis only records the intent.

## 4. Conceptual tensions (not collisions — reconciliation notes)

- **ST-001 vs QOL-030 D2.** ST-001 shipped Cards view as "inspection only — no
  body editing." QOL-030 decision D2 makes Cards view **authorable** ("one box
  across the board"). ST-001's contract is **amended by QOL-030 D2** — Cards
  view gains the box. This must be noted on the ST-001 card.
- **RULE-001 / RULE-002 / RULE-003.** Three "X → UI-label" maps. Already
  deconflicted in the board doc (RULE-003 owns lifecycle→UX, RULE-002 owns
  validation→move, RULE-001 owns semantic-code→label). The one-box popout
  content models consume all three. No collision — recorded for clarity.
- **LIFE-001 vs GAME-001.** LIFE-001 defines the lifecycle **state vocabulary**
  (incl. `exhausted`); GAME-001 defines the **advisory rules** that drive
  transitions into those states. Complementary layers, not a collision. The
  one-box stage gate (QOL-030 §3) consumes LIFE-001's output.
- **The semantic-referee stack (MCP-011…016, RULE-006, GAME-003
  `semanticClassification`).** A deep advisory layer. The one-box flash menu is
  **deterministic and engine-gated** — it does *not* depend on the semantic
  layer. Keep it that way: the semantic layer stays advisory and separate from
  the box's gating.

## 5. Blank designs the narrative drives

The storyboards depend on three cards that have **no design doc**:

- **EV-003** (Evidence debt tracker) — Scenario 2's "Ask source → evidence-debt
  marker → *Evidence requested*" drives it; QOL-030's `ask_source` type and
  QOL-032's "what's unresolved" both lean on it.
- **IX-001** (Timeline density + focus lenses) — QOL-033 designs the *lenses*
  but consumes an undefined density/zoom core.
- **GAME-003B** (Argument mode setup screen) — the one-box `root_claim` box does
  room setup; mode setup belongs there.

## 6. The refactor / rewrite plan

| Phase | Action | Status |
|---|---|---|
| **0** | Renumber QOL-021…029 → QOL-034…042; write this analysis | **done this pass** |
| 1 | Board-doc rewrite — add "superseded by QOL-03x" to SC-001/002/003/004, RULE-005, IX-001/002, COMPOSER-001/002; amend ST-001 for D2 | proposed |
| 2 | Open design stubs for EV-003, IX-001, GAME-003B | proposed |
| 3 | Implement QOL-030 → 031 → 032 → 033 — **this is the code refactor** (re-house the shipped shells under the popout chassis) | proposed |
| 4 | Retire the bespoke surfaces (`CreateDebateForm`, `JoinDebatePanel`, `AddAnnotationSheet`, `DeletionRequestSheet`) as box types | proposed |

## 7. Executed this pass vs. proposed

- **Executed:** the QOL-021…029 → 034…042 renumber across the storyboard-pass
  files; this analysis document; explicit "Supersedes" lines on the QOL-031/032/
  033 catalogue cards.
- **Proposed (needs go-ahead):** phases 1–4 above. The board-doc supersession
  rewrite (phase 1) is the next mechanical step; the code refactor (phase 3) is
  the QOL-030…033 implementation and is sized in their design docs.
