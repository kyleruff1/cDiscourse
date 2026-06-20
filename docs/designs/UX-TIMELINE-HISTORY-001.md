# UX-TIMELINE-HISTORY-001 — Read-only argument history / replay projection

> Design-first plan for a READ-ONLY history/replay projection over the argument
> graph: an ordered history event log, an "as-of" board snapshot for any past
> moment, and a per-moment diff. Replay NEVER mutates live board state and NEVER
> rewrites history — it is a derived, time-windowed projection of the existing
> `arguments` rows.
>
> This document satisfies acceptance bullet 1 (the design doc). Acceptance
> bullets 2-4 (a pure-TS model that provably performs no write, a fixture-backed
> worked example, and proven replay/live isolation) require committed code and
> tests; they land in a follow-up implementation slice. The issue stays open
> until that slice merges.
>
> Sibling issue: #750 vertical timeline (shares the timeline surface but is a
> distinct feature; this card does NOT depend on it).

## 1. Problem and intent

A long disagreement accrues a history: moves are added, points narrow, sources
arrive, an exchange reaches an impasse. Today the board always shows the room
as it stands now. There is no honest way to ask "what did the board look like
before move 8?" without scrolling and reconstructing it by eye.

We want a read-only projection that answers "as of an earlier moment, what was
on the board?" without ever changing the live board, and without inventing a
second source of truth. Every fact in the projection already lives in the
`arguments` rows the room has loaded.

## 2. Doctrine — read-only, never a judge, never a rewrite

- **No mutation, ever.** Replay derives a snapshot from already-loaded rows. It
  performs no submit, no insert, no update, no delete, no fetch. The board is
  already described as "a read-only projection of the once-derived mediator
  board" (`src/features/arguments/RoomBoardLayout.tsx:25-27`); the history layer
  is a second read-only projection on top of the same input.
- **No rewrite of history.** The event log is derived from immutable
  append-style data. `arguments` rows are never hard-deleted (soft-delete via
  `is_deleted`, per CLAUDE.md Supabase Conventions), so the timestamps an honest
  log needs (`created_at`, `updated_at`) are already present and stable.
- **Not a judge or scoreboard.** A past snapshot carries no winner / loser /
  score / verdict / truth / heat / popularity framing. Whatever was unknown at a
  past moment stays unknown in the snapshot — replay never back-fills certainty.
- **The engine stays the sole submission gate.** Replay posts nothing. It is a
  navigation surface, not a composing surface; the live composer is disabled
  while history is being viewed.
- **Plain language.** "Viewing history" / "as of" framing is paraphrased in
  original repo-native wording, never lifted from the reference (see §9).

## 3. Reference (feature / IA only, not a copy source)

The v4 handoff `07-argument-timeline.md` confirms this is its own surface,
distinct from the vertical-rendering work:

- TL1 history event log (`:17-118`) — every room keeps a replayable, ordered
  history of events (move added, narrowed, source/chime-in, state change,
  impasse).
- TL2 replay scrubber (`:119-210`) — a ticked scrubber + playhead that freezes
  the board at a chosen past move, with a clearly-marked viewing-history state
  and an exit-to-live control.
- TL3 moment diff (`:211-280`) — what changed at one event: before -> after
  structural state plus before/after claim excerpt.
- TL4 desktop axis (`:281-390`) — the read-only projection sitting under the
  three-column board on wide viewports.

The reference is feature / IA / interaction shape only. No reference copy is
lifted; see §9.

## 4. Event-log derivation

The event log is a deterministic, JSON-serializable list derived from the
in-memory room set the board already holds — no new query is required for v1.

- **Ordering primitive.** Reuse `sortMessagesChronologically`
  (`src/features/arguments/argumentGameSurfaceModel.ts:221`), which sorts any
  `{ id, createdAt }[]` by creation time with a deterministic id tie-break. The
  event log inherits that exact ordering so the log, the timeline, and the board
  all agree.
- **Event kinds (derived, not stored).** Each event is computed from fields
  already present on the rows / derived board, e.g.:
  - `move_added` — a row's `created_at` (one event per non-deleted argument).
  - `state_change` / `narrowed` / `source_added` / `chime_in` / `impasse` —
    derived from the same signals the mediator board already computes
    (`deriveMediatorBoardState`, `src/features/mediator/deriveMediatorBoardState.ts:586`),
    read at the row's `updated_at` where a row was revised after creation.
  Event-kind labels reuse existing plain-language vocabulary; no new
  verdict/score token is introduced.
- **Shape.** Each event carries a stable `id`, an `ordinal` (its 0-based index
  in chronological order), an `at` timestamp (the source field it was derived
  from), an event `kind`, and the `nodeId` it concerns. The list is pure data —
  no functions, no React, no Supabase handles — so it round-trips through JSON.
- **No write.** Derivation reads rows and returns a new array; it mutates
  nothing and calls nothing networked. The follow-up implementation proves this
  with a source-scan test (no `submit` / `insert` / `update` / `fetch`
  reference in the model file).

## 5. "As-of" snapshot derivation

Given a cutoff (an event `ordinal`, equivalently a timestamp), the snapshot is
the board re-derived from the subset of rows visible at that cutoff:

1. Filter the loaded rows to those whose derivation timestamp is `<=` the cutoff
   (chronological prefix of the sorted list).
2. Re-run the existing derivations on that prefix only — the timeline via
   `buildArgumentTimelineMap` (used once today at
   `src/features/arguments/ArgumentGameSurface.tsx:628`) and the mediator board
   via `deriveMediatorBoardState` (`src/features/mediator/deriveMediatorBoardState.ts:586`).
   No new derivation logic is invented; the snapshot is the same functions fed a
   smaller, time-bounded input.
3. The result is a frozen, read-only board value for that moment. It does not
   touch the live `mode` / active-node state held in `ArgumentGameSurface`
   (`:473`).

Because the snapshot is pure derivation over a filtered copy, two snapshots at
the same cutoff are byte-identical (determinism), and no snapshot can affect
any other or the live board.

## 6. Moment diff

A moment diff describes what changed AT a single event by comparing two
adjacent "as-of" snapshots — the snapshot at `ordinal - 1` versus the snapshot
at `ordinal`:

- **Structural before -> after** for the affected node (e.g. its prior board
  state vs its state after this event), read from the two snapshots.
- **Claim excerpt before -> after** when the event is a revision (`updated_at`
  change): the prior body excerpt vs the new excerpt, both already available on
  the rows. For a brand-new move the "before" is empty (the node did not exist
  yet) and the diff says so in plain language.
- A jump affordance back to that node in the live board (reusing the existing
  jump callback signature, e.g. the one `DisagreementPointsRail` uses today,
  `src/features/mediator/DisagreementPointsRail.tsx:640`).

The diff is pure data computed from two snapshots; it writes nothing and asserts
no verdict about whether the change was good, correct, or persuasive.

## 7. Read-only "viewing history" mode and exit-to-live

- **Unmistakable state.** When a past moment is selected the surface enters a
  clearly-marked read-only history state. The marker copy is original
  repo-native wording (e.g. an "Earlier view" / "Read-only — earlier moment"
  badge); it is NOT lifted from the reference's "Viewing history" string.
- **Composer disabled.** While viewing history the live composer is disabled —
  replay is a navigation surface, never a posting surface; the engine remains
  the sole submission gate. Disabling is a UI gate over the existing composer;
  no submission path is added or changed.
- **Exit to live.** A single control returns to the live board. The label is an
  original repo-native string or reuses an existing canonical control verbatim.
  Note (audit): "Jump to latest" is NOT canonical rendered copy in this repo —
  it exists only as `accessibilityLabel="Jump to latest message"` on the
  latest-jump control (`src/features/arguments/ArgumentTimelineMap.tsx:1025`).
  The final exit-to-live label must therefore be grep-confirmed before shipping:
  either reuse that exact accessibility phrasing or add a new repo-native label
  to the copy constants. Exiting restores the live active node exactly; because
  the snapshot never mutated live state, "exit" is simply dropping the
  read-only snapshot value and showing the live board again.
- **State isolation.** Replay selection lives in its own state slot (a cutoff
  ordinal or null). Live `mode` / active-node state in `ArgumentGameSurface`
  (`:473`) is never written by replay, so exiting cannot have moved the live
  active node. The follow-up proves this with an isolation test.

## 8. Responsive behavior

- **phone (<600):** the scrubber + viewing-history badge sit above the board
  body; the moment diff opens in the selected-node readout slot (read-only).
  Vertical page scroll unchanged.
- **tablet (600-1279):** scrubber in the spine column; moment diff in the right
  pane. `RoomBoardLayout` topology unchanged.
- **wide (>=1280):** optional read-only axis under the three-column board (the
  reference's TL4 shape) — an enhancement, not required for v1.

No `RoomBoardLayout` column topology changes; history is an overlay/state on the
existing columns, not a new layout.

## 9. Test strategy (for the follow-up implementation slice)

- **Pure model:** event-log ordering (matches `sortMessagesChronologically`);
  "as-of" snapshot correctness at several cutoffs; moment-diff before/after;
  determinism (same cutoff -> identical snapshot); JSON round-trip.
- **No-write proof:** a source scan asserting the model file contains no
  `submit` / `insert` / `update` / `delete` / `fetch` reference.
- **Worked example:** a fixture room of 14 moves; assert the "as of move 8"
  snapshot reproduces the expected board (acceptance bullet 3).
- **Isolation:** selecting a past moment then exiting leaves the live active
  node unchanged (acceptance bullet 4).
- **Component (when built):** viewing-history mode disables the composer; the
  exit control restores the live board; a11y (grayscale, 44x44 targets,
  reduce-motion) + ban-list (no winner/loser/score/verdict/truth/heat/
  popularity over new strings, mirroring the `uxBoardRail002Topology` pattern).
- Invoke `test-discipline`, `cdiscourse-doctrine`, `timeline-grammar`.

## 10. Reference-copy note

The v4 handoff is feature / IA reference only. Reference lines such as
"Viewing history" (`07-argument-timeline.md:137`) and "as the board stood at"
(`:141`) are paraphrased in original wording, never lifted. "Jump to latest" is
NOT canonical rendered copy in this repo (only the `accessibilityLabel="Jump to
latest message"` at `ArgumentTimelineMap.tsx:1025`); any exit-to-live label is
original repo-native or a grep-confirmed reuse of existing canonical copy before
shipping.

## 11. GATE-C classification

NOT GATE-C for the read-only-over-already-loaded-rows v1: no deploy, no
migration, no provider call, no secrets, no service-role. If a later follow-up
adds a dedicated server-side history query or a migration, THAT follow-up is
GATE-C and is filed separately.
