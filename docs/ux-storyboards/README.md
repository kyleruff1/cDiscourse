# CDiscourse — UX Storyboards

First-version storyboards for the CDiscourse experience. These documents are the
**storyboard canon**: the agreed picture of how a real person moves through an
argument, from the first frustrated in-person disagreement to a settled,
locked, referenceable record.

## Why these storyboards exist

CDiscourse has a large roadmap, a deep rules engine, and a dozen feature epics.
What it did not have, before this canon, was one place that walks the *whole*
experience end to end in plain language. A roadmap card describes a slice. A
storyboard describes the journey the slices have to add up to.

The storyboards give every downstream role a shared reference:

- **Designers** get concrete UI-state descriptions to draw against.
- **Product** gets a gap report grounded in real scenarios, not abstractions.
- **Issue / roadmap agents** get deduped issue recommendations tied to story
  evidence.
- **Implementation agents** get acceptance criteria and an interaction taxonomy
  so the shipped UI matches the intended experience.

## What these storyboards are NOT

- They are **not final visual design**. No pixel layouts, no color specs, no
  component trees. They describe *what the user experiences and what state the
  system holds*, not how a screen is laid out.
- They are **not marketing copy**. They are operational: chronological steps,
  visible UI states, required data states, notifications, and explicit
  capability gaps.
- They are **not a promise that everything described is built**. Each storyboard
  ends with a missing-capabilities table that is honest about what exists, what
  is partial, and what is absent.
- They do **not** decide truth. No storyboard says a participant is "right". The
  app structures and records an argument; it never adjudicates it.

## What they define

1. The **intended experience** — the chronological journey, step by step.
2. The **missing capabilities** — for every story need: current support,
   missing support, the kind of work required, and the issue it maps to.
3. The **terminology** — the strict normal-user vocabulary (it is an *argument*
   product; the UI never says "game" and avoids "debate").
4. The **acceptance criteria** — testable conditions that tell an implementer
   when a story moment is actually delivered.

## The documents

| Document | Purpose |
|---|---|
| [`roommates-dishes-public-argument.md`](roommates-dishes-public-argument.md) | Scenario 1 — two roommates settle a chores dispute in a **public** argument room; a community observer chimes in. |
| [`band-space-rent-private-evidence-argument.md`](band-space-rent-private-evidence-argument.md) | Scenario 2 — two bandmates settle a rent dispute in a **private** argument room using payment-screenshot **evidence**. |
| [`interaction-taxonomy.md`](interaction-taxonomy.md) | The shared vocabulary of every interaction (root claim, response, concession, refutation, evidence object, chime in, branch, tangent, settled room, …) with copy, internal field, visuals, permissions, and epic. |
| [`missing-capabilities-and-issues.md`](missing-capabilities-and-issues.md) | The structured product-gap report across both scenarios. |
| [`terminology-and-copy-rules.md`](terminology-and-copy-rules.md) | The strict forbidden-term → replacement table for normal-user UI copy. |
| [`storyboard-to-roadmap-map.md`](storyboard-to-roadmap-map.md) | Every story moment mapped to an existing roadmap card or a proposed new one. |
| [`one-box-interface-model.md`](one-box-interface-model.md) | **MVP-critical.** The one-box + 3-popout interaction architecture — wireframe layouts for the box and the Act / Inspect / Go popouts, the type × target × view model, and the convergence audit. |
| [`keyboard-map.md`](keyboard-map.md) | The canonical keyboard map — every action's shortcut, two-tier, contextual. Design source for the reopened IX-003. |
| [`terminology-audit.md`](terminology-audit.md) | Generated report — current prohibited / discouraged UI strings in app source. Refresh with `npm run ux:terminology:audit`. |

## How to use this canon

- **Starting a design or build card?** Read the relevant scenario and the
  interaction taxonomy first. If the build would contradict a storyboard, raise
  it — do not silently diverge.
- **Proposing a new issue?** Check [`storyboard-to-roadmap-map.md`](storyboard-to-roadmap-map.md)
  and [`missing-capabilities-and-issues.md`](missing-capabilities-and-issues.md)
  for an existing card before creating anything.
- **Writing user-facing copy?** Read [`terminology-and-copy-rules.md`](terminology-and-copy-rules.md)
  and run `npm run ux:terminology:audit`.
- **Maintaining the canon?** Use the `storyline-narrative-officer` skill
  (`.claude/skills/storyline-narrative-officer/SKILL.md`) — it is the manual,
  dev/design-only skill for keeping these storyboards coherent.

## A note on internal vs. user-facing names

The app's database still has a table called `debates`, and the codebase has
identifiers like `gameCopy` and `argumentGameSurface`. **Renaming a shipped
database table is risky and out of scope** for the storyboard pass. These
storyboards therefore distinguish two layers:

- **Normal-user UI copy** — held to the strict rule: it is an *argument* product
  (`argument`, `argument room`, `conversation`), never a "game", and it avoids
  "debate".
- **Internal code and schema** — may keep legacy names (`debates`, `gameCopy`).
  Admin and debug docs may explain the mapping.

This split is enforced by `scripts/ux/auditUserFacingTerminology.js`, which scans
only app source for user-facing strings and leaves table names and identifiers
alone.
