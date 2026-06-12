# REF-006 — Usability smoke protocol (5-task first-user pass)

**Run lane:** human-run usability session · **zero provider spend** (no Anthropic / xAI / X API call, no Supabase write beyond the participant's own ordinary moves, no service-role).
**Verified-at-HEAD:** `b515da6` (the full disagreement loop — REF-002 model, REF-003 Referee Card, REF-004 Act/Inspect/Go routing, REF-005 Request-review — is shipped and merged to `main`; every surface label below was re-resolved against live source at this SHA).
**Companion file:** record results in `docs/testing-runs/REF-006-usability-smoke-results-template.md` (one filled copy per participant).
**Design (binding spec):** `docs/designs/REF-006.md`.

---

## Why this run exists (instrument vs usability)

> The synthetic corpus runs prove the instrument: skill gates fire, the engine is deterministic, and no provider is billed. They do not prove that a first-time person understands the surface. This run is that evidence. With one to three participants it is a directional first baseline — it is not a metric, not a pass/fail gate, and produces no quantitative claim. Its output is a list of verbatim stuck points, each of which becomes a new card.

This run produces the **first human usability evidence** for the disagreement loop. The synthetic corpus runs
(`docs/testing-runs/2026-06-12-xai-adversarial-bot-corpus-dry.md`, `docs/testing-runs/2026-06-12-ai-driven-bot-corpus-dry.md`)
validate the **instrument**. They cannot tell us whether a **first-time person** can find the point under dispute, ask for
a source on the right target, push back on a claim without attacking a person, branch a tangent without losing the mainline,
and read the Referee Card back in their own words. This protocol produces that evidence path.

---

## Recruitment note

- **1–3 first-time participants** — people who have not used CDiscourse and have not read its docs.
- **No documentation is provided** to the participant. The whole point is to see the surface cold.
- Participants are identified only as **P1 / P2 / P3** (see § Privacy). No PII beyond what they volunteer.
- One **facilitator** runs the session and records; the **participant** drives the device.

---

## Facilitator ground rules (the doctrine spine of the protocol)

- The facilitator reads each task's script **verbatim** and then **stays quiet**. No hints, no leading questions, no pointing
  at the screen.
- The facilitator **never asks the participant to judge who is right or wrong**, never asks which side is winning, and never
  uses an evaluative word about the debate content. Tasks are **procedural only** — they ask the participant to *do* a thing
  or *say back* what they see, never to *rule* on the argument.
- If the participant asks "what should I do?", the facilitator replies only: *"Whatever makes sense to you — there's no wrong
  move here."* and records the question as a stuck point.
- The facilitator records, in the participant's **own words**, what they call each thing (this feeds the "their words vs our
  labels" vocabulary table in the results file).
- The facilitator notes **where the participant taps first** for each task (`whereTheyTappedFirst`) and the **time to first
  move** (`timeToFindDisputedPointSec` for Task 1; a stopwatch note for the rest).
- **Known label split (do not be surprised, and do not point it out):** the structured concern flow reads `Request review` on the
  bubble chip and the composer, but `Send for review` in the board-Act popout entry. This is a documented REF-005 cosmetic
  label split, **not** a participant error. An incidental participant remark about it is a valid `suggestedCopyFix`.

---

## The 5 tasks

Each task block has four parts: **(a) Start screen** (the real shipped surface + labels, from the pre-launch reality audit at
`b515da6`); **(b) Task** (verbatim from the issue); **(c) Facilitator script** (neutral, read aloud); **(d) Capture** (the
fields to record). The participant-facing **Task** and **Facilitator script** lines name **no internal vocabulary** — plain
instructions only. The bracketed surface references in **Start** and **Capture** are facilitator-only.

### Task 1 — Open a room and identify the exact point currently under dispute

- **Start:** the Conversation Gallery (`ConversationGalleryScreen`), grouped into lanes — e.g. **Needs first rebuttal**,
  **Jump in now**, **Source trail fights**, **Evidence needed**, **Definition fights** (live labels, `gameCopy.ts:1022-1083`).
  The card action button reads **`Observe →`** or **`Open →`** for a first-timer (never **`Continue →`**, which only shows for
  a room they have already joined). Tapping it opens the room **in read / observer mode** (no "choose side" modal). The active
  node's detail shows the **Referee Card** with a **`Point under dispute: "…"`** quoted anchor and a **`Referee note: …`** line.
- **Task (verbatim):** Open a room and identify the exact point currently under dispute.
- **Facilitator script (verbatim):** *"Open one of these rooms, then tell me in your own words the exact point the two sides
  are arguing about right now."*
- **Capture:** `timeToFindDisputedPointSec` · `whereTheyTappedFirst` (free note) · `stuckPointText` (verbatim) ·
  `rawCodeSeen` (failure capture — see § Capture-field definitions) · the participant's own word for "the point under dispute".

### Task 2 — Ask for a source or quote on the right target

- **Start:** the active node's detail. **Two valid paths** — the rail no longer carries a top-level Ask-source button;
  `Ask source` now lives inside **Act** (`ArgumentSideActionRail.tsx:90` — *"Act is the canonical home"*). Path A: the
  **Referee Card next-move button** `Ask for a source` (when present in the card's candidate moves). Path B: **open Act on the
  node** and pick **`Ask source`** (`timelineNodeActionDockModel.ts:470`). Either way the composer then shows what it is acting
  on (`Ask source for {type} · "{excerpt}"`, `composerActingOnModel.ts:166`) so the participant can confirm the target.
- **Task (verbatim):** Ask for a source or quote on the right target.
- **Facilitator script (verbatim):** *"Ask the other side to back up that specific point with a source or a quote."*
- **Capture:** `askedSourceOnIntendedTarget` · `whereTheyTappedFirst` (record **which path** they found first — Referee Card
  button vs Act vs hunted elsewhere) · `pickedBackendTypeManually` (expected `false` — the one-box infers the move) ·
  `stuckPointText` · `rawCodeSeen`.

### Task 3 — Reply with a claim-level critique without referring to the person

- **Start:** the active node's detail → **`Reply`** or **`Disagree`** on the rail (`ArgumentSideActionRail.tsx:109-110`), **or**
  Act → **Respond** (the one-box `respond` composite, QOL-030). The one-box infers the type; the participant is **not** asked
  to pick a backend type.
- **Task (verbatim):** Reply with a claim-level critique without referring to the person.
- **Facilitator script (verbatim):** *"Write a reply that pushes back on the point itself — not on the person who made it."*
- **Capture:** `usedAccusationInsteadOfProcedure` (did the wording target the person rather than the claim) ·
  `pickedBackendTypeManually` (expected `false`) · `stuckPointText` · `rawCodeSeen`.
- **Facilitator note:** the app **never blocks** the post — the deterministic engine is the sole gate; advisory surfaces only
  *suggest*. Record what the participant *wrote*, not whether the system "allowed" it.

### Task 4 — Branch a tangent without losing the main point

- **Start:** the active node's detail. **Two valid paths** — Path A: the **Referee Card next-move button** `Open a side issue`
  (the `branch_tangent` entry / recovery route). Path B: **open Act** and pick the branch entry. After branching, the
  horizontal timeline shows the branch on its own lane while the mainline node stays selectable.
- **Task (verbatim):** Branch a tangent without losing the main point.
- **Facilitator script (verbatim):** *"Start a side point that's related but separate — without losing the main argument."*
- **Capture:** `branchPreservedMainline` (did the mainline stay anchored / findable) · `whereTheyTappedFirst` (record **which
  path** they found first) · `stuckPointText` · `rawCodeSeen`.

### Task 5 — Read the Referee Card and explain it back

- **Start:** the **Referee Card** on the active node (`RefereeCardView`). The three zones map one-to-one to the three things
  asked: **zone 1** `Referee note: {relation}.` = what the move is doing; **zone 2** `The open task is {burden}.` (or a
  terminal-state line) = what remains open; **zone 3** = 2–3 candidate next-move buttons. When the move has no observation yet,
  zone 1 reads **`No referee notes yet on this move.`** (`RefereeCardView.tsx:60`) — a valid, non-error teaching state.
- **Task (verbatim):** Read the Referee Card and explain: what the move is doing, what remains open, and which next move you
  would take.
- **Facilitator script (verbatim):** *"Read this card out loud, then tell me three things in your own words: what this move is
  doing, what's still open, and what you'd do next."*
- **Capture:** `refereeCardParaphraseMatched` (did the paraphrase match the three zones) · `mixedUpScoreHeatWithStanding`
  (failure capture — see § Capture-field definitions) · `stuckPointText` · `rawCodeSeen` · `suggestedCopyFix` (any wording
  they tripped on).

---

## Capture rules (how to record)

- **Verbatim stuck points** — write the participant's exact words in quotes; do not paraphrase.
- **Time-to-first-move** — start a stopwatch when the script ends; stop at the participant's first deliberate action.
- **Where they tapped first** — note the first interactive element they reached for, even if it was the "wrong" one. For
  Tasks 2 and 4, this is where you record **which of the two valid paths** they discovered first.
- **Their words** — record the participant's own name for each thing (feeds the vocabulary table).
- **`rawCodeSeen`** — if any `snake_case` token, family ID, `rawKey`, classifier ID, or internal code ever reaches the screen
  the participant is reading, that task is a **failure**; record exactly what appeared and where.

---

## Capture-field definitions (the 10 fields)

The issue lists 10 per-task capture fields. **Three were renamed for copy hygiene** at design time (their `camelCase` joints
glued a prohibited verdict token into the identifier); the renames change the **name only**, never the measurement intent. All
field names are code-style identifiers and appear in backticks everywhere — they are never participant-facing prose.

### Traceability map (renamed three)

| Issue field name (original, superseded) | Adopted token-free name | Measurement intent (unchanged) |
|---|---|---|
| `askedSourceOnCorrectTarget` | `askedSourceOnIntendedTarget` | Did the participant aim the source/quote ask at the node currently under dispute, rather than a different node? |
| `refereeCardParaphraseCorrect` | `refereeCardParaphraseMatched` | Did the participant's paraphrase of the Referee Card match its three zones (relation · open task · next move)? |
| `confusedByScoreHeatOrTruth` | `mixedUpScoreHeatWithStanding` | Did the participant read heat or a number as a verdict on the debate (the failure mode this field captures) rather than as activity / point standing in the game? |

### The remaining seven (issue names verbatim)

- `timeToFindDisputedPointSec` — seconds from end-of-script to the participant naming the point under dispute (Task 1).
- `pickedBackendTypeManually` — did the participant have to pick an internal move type by hand? Expected `false` (the one-box
  infers the move).
- `rawCodeSeen` — **failure capture**, not a neutral observation: any `snake_case` token, family ID, `rawKey`, classifier ID,
  or internal code reaching the participant is a **task failure** (the whole loop's plain-language doctrine is the thing under
  test). Record exactly what appeared and where.
- `branchPreservedMainline` — after branching (Task 4), did the mainline node stay anchored and findable?
- `usedAccusationInsteadOfProcedure` — did the participant's reply wording target the **person** rather than the **claim**?
  (`accusation` describes the move's relation to the claim — a procedural framing, exactly like REF-005's bounded
  "About the person rather than the claim" concern type — not a person-verdict.)
- `stuckPointText` — the participant's exact words at any point of friction, in quotes.
- `suggestedCopyFix` — any wording the participant tripped on, with their proposed plainer phrasing if they offer one.

The two renamed comprehension fields are clean by construction: `refereeCardParaphraseMatched` uses `Matched`;
`mixedUpScoreHeatWithStanding` uses `Standing` (point standing in the game — gameplay state, never a truth claim).

---

## Privacy

- No PII beyond what the participant volunteers. Do not record names, emails, faces, or device identifiers.
- Quotes in the committed results are **anonymized**; participant identifiers are **P1 / P2 / P3** only.
- If a participant volunteers identifying detail inside a quote, the facilitator **redacts it before committing**.

---

## Operator dry walk-through (acceptance criterion — the card does not close until this passes)

The **operator** runs this checklist **once, solo**, before recruiting any participant, to confirm every task is executable on
the current build. Each line is a checkbox + a "confirmed on build ___" slot. If any line fails on the operator's build, that
failure is itself a finding (a new card), and recruitment waits until the blocking surface is fixed.

1. [ ] **Gallery loads** with grouped lanes; at least one room shows `Observe →` or `Open →`. *(build ___)*
2. [ ] **Open a room as a first-timer** → it enters in **read / observer** mode with **no "choose side" modal**. *(build ___)*
3. [ ] **The active node shows a Referee Card** with a `Referee note: …` line and (when a quote anchor exists) a
   `Point under dispute: "…"` anchor. *(build ___)*
4. [ ] **Task 2 path exists:** either an `Ask for a source` button on the Referee Card **or** `Ask source` inside Act on the
   node opens a composer that names the target. *(build ___)*
5. [ ] **Task 3 path exists:** `Reply` / `Disagree` on the rail **or** Act → `Respond` opens the one-box without asking for a
   manual backend type. *(build ___)*
6. [ ] **Task 4 path exists:** `Open a side issue` (Referee Card next-move button **or** Act branch entry) creates a branch on
   its own timeline lane while the mainline node stays selectable. *(build ___)*
7. [ ] **Task 5 readback:** the Referee Card's three zones (or the `No referee notes yet on this move.` empty state) are all
   legible; no `snake_case` / family ID / `rawKey` is visible on the card. *(build ___)*
8. [ ] **No raw code anywhere a participant reads** across Tasks 1–5 (the `rawCodeSeen` failure condition). *(build ___)*

---

## What happens to findings

- Every stuck point and every `suggestedCopyFix` becomes a **new GitHub issue** (a new card), filed against the right epic.
- **Findings are not fixed inline in this card.** REF-006 produces the evidence; the fixes are separate cards.
- The "their words vs our labels" table in the results file is offered as **input to META-1D (#79)**. #79's current scope is
  the 26 META-001 codes; any extension of its scope to the REF rail/card vocabulary is **proposed via a comment on #79**, never
  assumed here.

---

## Edge cases (the facilitator / operator must handle)

- **Empty gallery / no open rooms** → the operator seeds a room (any existing dev room works) before the session; a first-time
  participant needs at least one `Observe →` / `Open →` card on screen.
- **A room with no Referee observation yet** → Task 5's card reads `No referee notes yet on this move.` — a valid, non-error
  state; the participant reads zones 2–3 and the empty zone-1 teaching line. Not a stuck point by itself.
- **Participant joins a side** (taps `Join For` / `Join Against`) mid-Task-1 → allowed; the rail switches to the participant
  set (`Reply · Disagree`); the facilitator records it and continues. The tasks still resolve.
- **Participant lands on their own bubble** → the rail collapses to `Open Act ▾` (own-bubble safety: no edit / disagree / flag
  on your own move). Record any confusion as a stuck point; it is not a protocol error.
- **Micro-moment banner absent** → expected on some buckets / on deep-link entry; the protocol never depends on it. Capture
  whether the participant notices/uses it when it is present, never depend on it.
- **The two Request-review labels** → if a participant wanders into the concern flow and remarks on `Request review` vs
  `Send for review`, that is a valid `suggestedCopyFix`, not a task failure.
- **Participant asks "who's winning?"** → the facilitator does **not** answer and does **not** evaluate; replies only
  *"This isn't about who's winning — just do what makes sense to you,"* and records the question (it is itself a usability
  signal that the surface read as a scoreboard, captured under `mixedUpScoreHeatWithStanding`).
- **A raw code appears on screen** → record under `rawCodeSeen`, mark the task failed, and file it as a new card (a
  plain-language regression).
- **Offline / network failure during a post** → the existing submit path owns its own offline handling; a failed post is a
  system event to record, never a participant error, and never a verdict on the content.
- **n = 1** (only one participant available) → still valid as a directional baseline; the no-quantitative-claims reminder
  applies even more strongly.
