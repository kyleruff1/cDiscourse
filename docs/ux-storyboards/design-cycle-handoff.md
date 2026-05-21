# CDiscourse — Design-Cycle Handoff

The storyboards and the roadmap collision analysis trigger a **mandatory design
cycle** before broad implementation continues. This document defines who
receives what, and the order work proceeds in. It is the contract between the
designer, the issue/roadmap workflow, and the implementer.

---

## The handoff is mandatory

Storyboard findings and the collision analysis are **not optional
documentation**. They are a gate. Broad implementation does **not** resume as a
loose "improve the UX" task. It resumes only as the **ordered queue** in
[`priority-implementation-queue.md`](priority-implementation-queue.md), one card
at a time.

## What the designer receives

The designer's input packet:

- The two scenario storyboards — [`roommates-dishes-public-argument.md`](roommates-dishes-public-argument.md),
  [`band-space-rent-private-evidence-argument.md`](band-space-rent-private-evidence-argument.md).
- [`interaction-taxonomy.md`](interaction-taxonomy.md) — the shared vocabulary.
- [`terminology-and-copy-rules.md`](terminology-and-copy-rules.md) — the
  normal-user-mode copy rules.
- [`missing-capabilities-and-issues.md`](missing-capabilities-and-issues.md) —
  the product-gap report.
- [`../project-audits/2026-05-21-roadmap-collision-supersession-analysis.md`](../project-audits/2026-05-21-roadmap-collision-supersession-analysis.md)
  — the collision + supersession analysis.
- The one-box interface design — [`one-box-interface-model.md`](one-box-interface-model.md),
  [`keyboard-map.md`](keyboard-map.md), and `docs/designs/QOL-030.md` …
  `QOL-033.md`.
- The new design stubs — `docs/designs/EV-003.md`, `IX-001.md`, `GAME-003B.md`.
- [`designer-cycle-brief.md`](designer-cycle-brief.md) — the brief, including the
  questions the designer must answer and the decisions required before the
  implementer proceeds.

## What the issue / roadmap workflow receives

- The updated [`../ux-ui-project-board.md`](../ux-ui-project-board.md) with the
  "Supersession map".
- `scripts/github/uxBoardCards.json` — the catalogue (QOL-030…042; partial
  snapshot; check `gh issue list` before allocating new numbers).

## What the implementer receives

- [`priority-implementation-queue.md`](priority-implementation-queue.md) — the
  single ordered work list.
- The per-card design docs under `docs/designs/`.
- The "Supersession map" — so a superseded surface is never rebuilt as a
  standalone bespoke shell.

## Implementation order — sequential, not broad

1. **QOL-030 is first** — the one-box composer + flash-popout chassis
   foundation. Nothing else in the one-box block starts before it.
2. **QOL-031 (Act popout)** follows **only after QOL-030 is green** —
   typecheck, lint, tests, terminology audit all passing.
3. **QOL-032 (Inspect popout)** follows **only after QOL-031 is green**.
4. **QOL-033 (Go popout)** follows **only after QOL-032 is green**.
5. Bespoke surfaces (`CreateDebateForm`, `JoinDebatePanel`, `AddAnnotationSheet`,
   `DeletionRequestSheet`, the composer docks) are retired **only after** their
   replacement QOL surface is implemented and tested.

Each card is its **own commit**. Phases are not squashed together. Pure models
are reused, never deleted; React shells re-house under the QOL surfaces.

## Corpus testing is shelved

Full xAI corpus testing (the 100-harvest / 50-scenario runs) is **shelved**
until the entry surface, the gallery, the one-box composer, and the
argument-room interaction model are coherent enough that larger payloads can be
inspected meaningfully. Running large corpora before the UX is coherent produces
results no one can read.

Corpus testing resumes only when:

- the gallery shows one card per conversation with the full triage set;
- the one-box composer + Act/Inspect/Go popouts are implemented and green;
- and the operator explicitly re-authorizes corpus testing.

## Gate summary

| Gate | Must be true before proceeding |
|---|---|
| Design-cycle gate | The designer has reviewed the brief and answered the open questions. |
| Implementation gate | Board-doc supersession rewrite, design stubs, this handoff, the priority queue, the terminology audit, and catalogue validation are all complete; baseline tests green. |
| QOL-031/032/033 gate | The previous card is green (typecheck · lint · tests · audit). |
| Retirement gate | The replacement QOL surface is implemented and tested. |
| Corpus gate | The UX is coherent **and** the operator re-authorizes. |
