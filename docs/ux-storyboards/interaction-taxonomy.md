# CDiscourse — Interaction Taxonomy

The shared vocabulary of every recurring interaction in a CDiscourse argument.
Each entry is defined once, here, so designers, issue agents, and implementers
use the same word for the same thing.

For every interaction:

- **User-facing copy** — what a normal user reads. Held to the terminology
  rules: it is an *argument* product (never "game", avoids "debate").
- **Internal semantic field** — the model/data concept, where one is known.
  Internal names may be legacy (`debates`, `gameCopy`); that is allowed.
- **Visual representation** — how it appears on the timeline / board.
- **Permissions** — who may create or act on it.
- **Issue / epic category** — the roadmap family that owns it.

> Internal field names below are descriptive, not a schema spec. Where a field
> is not yet built, it is marked *(proposed)*.

---

## Core moves

### Root claim

- **User-facing copy:** "Opening claim" / "Root". The room's first statement.
- **Internal semantic field:** the root `arguments` row (no parent); `Root`
  marker in the timeline model.
- **Visual representation:** Rounded-square / flag-tab node, indigo, solid
  stroke, "Root" label. Always the leftmost node; never visually lost.
- **Permissions:** Created by the room creator only, at compose time.
- **Issue / epic:** Timeline (TL-002 root marker), Visual Grammar (VG-001).

### Response

- **User-facing copy:** "Response" / "Reply".
- **Internal semantic field:** a child `arguments` row on the mainline;
  `argumentType` from the Constitution; `MoveChannel` `reply`.
- **Visual representation:** Circle node on the horizontal mainline.
- **Permissions:** Any primary participant on a node that is not their own.
- **Issue / epic:** Timeline, Sidecar Rail (SC-004 action dock).

### Concession item

- **User-facing copy:** "Concede points" — an **itemized list**; each entry is
  one conceded point.
- **Internal semantic field:** a separable concession sub-item *(proposed —
  must be individually addressable, not one text blob)*; relates to
  `ConcessionEffect` in the point-standing economy.
- **Visual representation:** A pill, purple, soft gradient, "Narrowed" / a
  concession sub-marker on the authoring node.
- **Permissions:** Authored by a responding primary participant.
- **Issue / epic:** Rules UX (QOL-028), Strength/Weakness (point-standing).

### Concession acceptance

- **User-facing copy:** The **acceptance gradient** on a received concession:
  *Agree* · *Agree with caveat* · *Disagree based on framing* · *Disagree based
  on context* · *Disagree based on fact*.
- **Internal semantic field:** a per-concession acceptance decision *(proposed)*.
- **Visual representation:** A gradient control on each concession sub-item; the
  chosen level shows on the node.
- **Permissions:** Only the participant who **received** the concession (the
  one whose claim it concedes to) may set the gradient.
- **Issue / epic:** Rules UX (QOL-028).

### Concession disagreement

- **User-facing copy:** Any acceptance-gradient choice other than *Agree*.
  Selecting one makes a **clarification box required**.
- **Internal semantic field:** acceptance decision ≠ `agree`; sets the room's
  **active-disagreement classification** (`framing` / `context` / `fact`).
- **Visual representation:** The node's metadata shows the active disagreement
  kind (e.g. "fact-based").
- **Permissions:** Same as concession acceptance.
- **Issue / epic:** Rules UX (QOL-028), Rules UX (RULE-004 advisory review).

### Main refutation

- **User-facing copy:** "Main refutation" — the single body of a response that
  pushes back.
- **Internal semantic field:** the response `arguments` body; `MoveChannel`
  `challenge`.
- **Visual representation:** Diamond node, orange/red, bold left edge,
  "Challenge" label.
- **Permissions:** Any primary participant on another participant's node.
- **Issue / epic:** Visual Grammar (VG-001), Rules UX (RULE-005 channels).

### Clarification request

- **User-facing copy:** "Ask for clarification" / "Clarify".
- **Internal semantic field:** `MoveChannel` `clarify`; a required clarification
  body when a disagreement gradient is chosen.
- **Visual representation:** Circle with a question notch, amber, light pulse,
  "Clarify" label.
- **Permissions:** Any primary participant.
- **Issue / epic:** Rules UX (RULE-002 validation-to-move map).

---

## Evidence

### Evidence object

- **User-facing copy:** "Evidence attached." An attached, structured record.
- **Internal semantic field:** `EvidenceArtifact` (EV-001) — `kind`, `label`,
  `url?`, `sourceText?`, `quote?`, `sourceChainStatus`, `risk`. Payment-specific
  fields (amount, date, redacted payer/payee, claimed applicability) are
  *(proposed — QOL-023)*.
- **Visual representation:** Hexagon node / a receipt-chip pill attached to the
  authoring node; "Evidence" label, inner receipt mark.
- **Permissions:** Attached by the move's author; readable by all room viewers.
- **Issue / epic:** Evidence (EV-001, QOL-023).

### Evidence applicability challenge

- **User-facing copy:** "Dispute evidence applicability" / "Applicability
  disputed". A dispute over **what** a piece of evidence applies to (e.g. which
  month a payment covers), distinct from disputing that it exists.
- **Internal semantic field:** evidence status `applicability_disputed`;
  structured evidence response `dispute_applicability` *(proposed — QOL-024)*.
- **Visual representation:** The evidence pill shows a "disputed" state; the
  side panel shows claimed month vs. disputed month.
- **Permissions:** Any primary participant who is not the evidence's author.
- **Issue / epic:** Evidence (QOL-024).

### Source request

- **User-facing copy:** "Ask for the source" / "Source requested."
- **Internal semantic field:** `MoveChannel` `ask_source`; opens an
  evidence-debt record (EV-003); room status "Evidence requested."
- **Visual representation:** Hexagon with a dotted teal ring, "Source?" label;
  an evidence-debt chip on the node.
- **Permissions:** Any primary participant.
- **Issue / epic:** Evidence (EV-002 popover, EV-003 debt tracker).

---

## Community participation

### Chime in

- **User-facing copy:** "Chime in." A contribution from someone who is **not** a
  primary participant, in a **public** room.
- **Internal semantic field:** an `arguments` row with a derived `chime_in`
  seat role (GAME-005); `BranchDirection` `chime_in_vertical` (BR-004).
- **Visual representation:** A **vertical** branch node off the node the
  contributor selected, labelled "Chime in."
- **Permissions:** Any observer in a public room **while chime-in seats remain**
  (GAME-005, 6-seat cap).
- **Issue / epic:** Branches (BR-004), Rules UX (GAME-005).

### Accepted chime in

- **User-facing copy:** "Useful" (a primary's disposition on a chime-in); or
  "Let it stand" (a neutral keep).
- **Internal semantic field:** a governance reaction `useful` (GAME-005);
  *(proposed: a neutral "let it stand" disposition)*.
- **Visual representation:** The chime-in branch keeps its normal style.
- **Permissions:** Only the two **primary participants** may set a disposition.
- **Issue / epic:** Rules UX (GAME-005).

### Rejected chime in

- **User-facing copy:** "Not useful" (per-primary); "Hide from my view"
  (per-viewer); the node becomes a **muted branch** when both primaries reject.
- **Internal semantic field:** governance reaction `off_track` (GAME-005);
  *(proposed: a per-viewer hide and a "convert to branch" disposition)*. The row
  is **never deleted** — only muted.
- **Visual representation:** Greyed / muted vertical branch; stays on the
  record.
- **Permissions:** "Not useful" — primaries only. "Hide from my view" — any
  viewer, affecting only their own view.
- **Issue / epic:** Rules UX (GAME-005), Interaction (QOL-025-adjacent).

---

## Structure

### Branch

- **User-facing copy:** "Branch" / "Side branch."
- **Internal semantic field:** `RailBranchKind` (BR-001) topology;
  `BranchDirection` (BR-004) presentation. A branch is a sub-line off the
  mainline.
- **Visual representation:** A bent connector off the parent node; a collapsed
  branch shows a stub with a count.
- **Permissions:** Created structurally (a chime-in, a tangent) or explicitly
  via the "Split branch" / "Branch" action.
- **Issue / epic:** Branches (BR-001, BR-003, BR-004).

### Tangent

- **User-facing copy:** "Tangent" / "Side issue."
- **Internal semantic field:** `BranchDirection` `tangent_diagonal` (BR-004);
  BR-003 tangent routing (`introduces_new_axis`, `user_marked_tangent`).
- **Visual representation:** A **diagonal** branch off the node where a new,
  unrelated axis appeared, labelled "Tangent." Dashed edge.
- **Permissions:** A participant may flag part of a move as a tangent; routing
  may also advise it. Never auto-punished.
- **Issue / epic:** Branches (BR-003, BR-004).

### Settled room

- **User-facing copy:** "Settled." Both parties have agreed the argument is
  done. Never "case closed", never "winner".
- **Internal semantic field:** room status `settled`; a final summary node.
- **Visual representation:** The board turns grey; a settlement summary node.
- **Permissions:** Reached by a settlement action both primaries confirm.
- **Issue / epic:** Rules UX, Strength/Weakness (status model).

### Locked room

- **User-facing copy:** "Locked." A settled room is locked: read-only.
- **Internal semantic field:** room status `locked`; argument bodies were
  already immutable; deletion is request-only.
- **Visual representation:** Grey, non-interactable board; reading, sharing
  (if allowed), and referencing remain.
- **Permissions:** No new moves by anyone; reading by anyone the visibility
  allows.
- **Issue / epic:** Rules UX.

### Private room

- **User-facing copy:** "Private argument." Visible only to invited
  participants.
- **Internal semantic field:** room visibility `private`; RLS restricts reads to
  participants *(private-from-creation enforcement is proposed — QOL-026)*.
- **Visual representation:** A "Private" marker on the room; never on a public
  list.
- **Permissions:** Created private, or transitioned private by the room creator.
- **Issue / epic:** Rules UX (QOL-026).

### Public room

- **User-facing copy:** "Public argument." Visible in the Conversation Gallery;
  observable by anyone.
- **Internal semantic field:** room visibility `public` (the default).
- **Visual representation:** Appears in the gallery's play lanes.
- **Permissions:** Anyone may observe; chime-in seats are limited (GAME-005).
- **Issue / epic:** Gallery (GAL-001/002), Rules UX (QOL-026).

---

## Roles

### Participant

- **User-facing copy:** "Participant." Anyone with a posting role in a room.
- **Internal semantic field:** a `debate_participants` row with a `side`.
- **Visual representation:** Named on their nodes.
- **Permissions:** May post moves per the Constitution and the room's seat
  rules. Never called a "player."
- **Issue / epic:** Rules UX (GAME-004/005 seats).

### Observer

- **User-facing copy:** "Observer" / "Watching." A reader who has not joined a
  side.
- **Internal semantic field:** derived observer role; `side` `observer`. Default
  for a non-participant entering a public room (Stage 6.4).
- **Visual representation:** No authored nodes; an observer-first collapsed
  side action rail.
- **Permissions:** Read and inspect. May chime in on a public room if seats
  remain.
- **Issue / epic:** Sidecar Rail (SC-001), Timeline (TL-001 seamless entry).

### Primary participants

- **User-facing copy:** "Primary participants." The two people the argument is
  *between* — in a 1v1 room, the initiator and the opponent.
- **Internal semantic field:** GAME-004 `RoomContract` seats `initiator` /
  `primary_opponent`; the only roles that may govern chime-ins (GAME-005).
- **Visual representation:** Their nodes carry the mainline.
- **Permissions:** Govern chime-ins; settle the room; toggle visibility (creator).
- **Issue / epic:** Rules UX (GAME-004, GAME-005).

---

## Cross-room

### Linked prior argument

- **User-facing copy:** "Linked prior argument" (public) / "Linked prior private
  argument" (private). A reference from a new room to an earlier, settled room.
- **Internal semantic field:** a link record between two rooms; carries an
  **access check** so a private prior room's content opens only for users
  authorized on that original room *(proposed — QOL-029)*.
- **Visual representation:** A context chip on the new room's timeline; tapping
  it opens the prior room (subject to the access check).
- **Permissions:** Anyone may create a link; viewing the linked content respects
  the prior room's visibility.
- **Issue / epic:** Rules UX (QOL-029).

---

## Quick reference — copy ↔ internal ↔ epic

| Interaction | User-facing copy | Internal field (legacy ok) | Epic |
|---|---|---|---|
| Root claim | Opening claim / Root | root `arguments` row | TL / VG |
| Response | Response / Reply | child `arguments` row; `MoveChannel reply` | TL / SC |
| Concession item | Concede points (list) | concession sub-item *(proposed)* | RULE / SW |
| Concession acceptance | Agree / Agree with caveat / Disagree… | acceptance decision *(proposed)* | RULE |
| Main refutation | Main refutation | response body; `MoveChannel challenge` | VG / RULE |
| Clarification request | Clarify | `MoveChannel clarify` | RULE |
| Evidence object | Evidence attached | `EvidenceArtifact` (EV-001) | EV |
| Evidence applicability challenge | Applicability disputed | evidence status *(proposed)* | EV |
| Source request | Ask for the source | `MoveChannel ask_source`; evidence debt | EV |
| Chime in | Chime in | `chime_in` seat; `chime_in_vertical` | BR / RULE |
| Accepted chime in | Useful / Let it stand | governance reaction `useful` | RULE |
| Rejected chime in | Not useful / Hide from my view | governance reaction `off_track`; muted | RULE |
| Branch | Branch / Side branch | `RailBranchKind` / `BranchDirection` | BR |
| Tangent | Tangent / Side issue | `tangent_diagonal` (BR-004) | BR |
| Settled room | Settled | room status `settled` | RULE |
| Locked room | Locked | room status `locked` | RULE |
| Private room | Private argument | visibility `private` | RULE |
| Public room | Public argument | visibility `public` | GAL / RULE |
| Participant | Participant | `debate_participants` row | RULE |
| Observer | Observer / Watching | derived observer role | SC / TL |
| Primary participants | Primary participants | `RoomContract` seats | RULE |
| Linked prior argument | Linked prior argument | room-to-room link *(proposed)* | RULE |
