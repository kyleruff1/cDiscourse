# Storyboard — Roommates / Dishes / Public Argument

**Scenario 1.** Two roommates settle a chores dispute in a **public** argument
room. A community observer chimes in because the room is public.

> This is a storyboard, not final visual design. It describes the intended
> experience, the UI state at each step, the data generated, the notifications
> sent, and the capability gaps. The system never decides who is right.

---

## Actors

| Actor | Role in the story | Role in the model |
|---|---|---|
| **Roommate A** | Originator / protagonist / claimant | Room creator; first participant; author of the root claim |
| **Roommate B** | Invited roommate / antagonist / refuter | Invited named respondent; second participant |
| **Community Observer C** | A third person who reads the public room and chimes in | Observer; becomes a chime-in participant; later moved back to observer |

## Context

Roommate A and Roommate B are arguing **in person** about whose turn it is to do
the dishes. They are frustrated and talking over each other. They decide to stop
yelling and put the disagreement into CDiscourse so it can be **structured,
recorded, and settled**. The point of the app, in this moment, is
de-escalation: turn a shouting match into an orderly, written exchange.

The room is **public** (the default). That decision matters later — it is what
lets Observer C enter.

---

## Step-by-step experience

Each step records four things: **UI state** (what is on screen), **Data**
(what the system stores), **Notifications** (what is delivered), and **Timeline**
(how the node board changes).

### Step 1 — Roommate A opens the app

- **UI state:** The app opens to the Conversation Gallery. The primary entry
  action is a clearly-labelled **"Start an argument"** affordance. There is no
  "Start a game" and no "Start a debate" anywhere. Roommate A taps it.
- **Data:** None yet. No room exists.
- **Notifications:** None.
- **Timeline:** None.

### Step 2 — Compose screen

- **UI state:** A compose screen with: an **optional title** field; a
  **visibility** control (Public / Private, **defaulting to Public**); an
  **invite by email** field; and the root-claim body field (Step 3). Roommate A
  types the title `Dishes after the camping week` and invites Roommate B by
  email. Helper copy notes that a blank title will fall back to an excerpt of
  the root claim.
- **Data:** On submit, a room record is created (internally a `debates` row),
  the creator is enrolled as a participant, and a **pending invite** record is
  created for Roommate B's email address.
- **Notifications:** An invite email is queued to Roommate B (delivered in
  Step 4).
- **Timeline:** Not yet rendered — the room has only the root claim once Step 3
  is submitted.

> **Capability note.** Invite is **email-only** today and is a UI placeholder
> (`docs/invite-flow.md`): there is no invite backend, no email send, and no
> auth-return routing. This is the single largest gap in Scenario 1.

### Step 3 — Root claim composition

- **UI state:** Roommate A writes the root claim:
  > "I've done the dishes four times in a row over the last two weeks, and we
  > should be alternating because that was the agreement we made when we signed
  > the lease."

  Below the body, Roommate A selects classification tags: **claim**,
  **household agreement**, **fairness / turn-taking**, **fact — supported by
  memory**, and **source / evidence: none attached yet**. An optional reasoning
  field is filled in: "We agreed to alternate dishes when we signed the lease. I
  believe I covered the last four rounds."
- **Data:** The root argument row is written via the `submit-argument` Edge
  Function — never a direct insert. It stores the body, the argument type, and
  the selected qualifier tags. No truth value is stored.
- **Notifications:** None to A (it is A's own move).
- **Timeline:** The board now has **Node 1 — root claim**, marked with a Root
  marker. The system classifies the *move type*; it does **not** say the claim
  is correct. No AI / autonomous flag fires.

### Step 4 — Invite email

- **UI state (in Roommate B's inbox):** An email with a subject in the spirit of
  *"You were invited to respond to an argument."* It must **not** say "debate
  challenge" or "game invite." The email body names the room
  (`Dishes after the camping week`) and carries one link.
- **Data:** The invite record's status is `sent`.
- **Notifications:** This step *is* the notification.
- **Timeline:** Unchanged.
- **Routing requirement:**
  - If Roommate B **has no account**, the link routes through sign-up, then
    **back into the specific argument room**.
  - If Roommate B **has an account**, the link routes through auth, then
    **directly into the room**.

### Step 5 — Roommate B opens the room

- **UI state:** Roommate B lands **directly on the argument room** — the
  Timeline board with Node 1 active. They see the root claim, Roommate A's
  selected tags, and a clean **response panel**. Because B was invited as the
  **named respondent**, there is **no observer/side modal** — B is already a
  primary participant. The response panel is reachable in one tap; the design
  goal is speed, because this is a live in-person conflict.
- **Data:** Roommate B is enrolled as the second participant (the opposing
  primary seat).
- **Notifications:** None.
- **Timeline:** Unchanged — still Node 1.

### Step 6 — Roommate B's response

- **UI state:** The response composer shows **two main areas**:
  - **Concede points** — an itemized list. Even if B writes naturally, the UI
    coaxes the input into a clean, separable list.
  - **Main refutation** — a single body.

  Roommate B enters two concession items:
  1. "We did agree we would alternate when we signed the lease."
  2. "It's probably true you did the dishes four times in a row, even though
     they were your own dishes."

  And the main refutation:
  > "Since I was camping and only ate fast food and didn't use any dishes at all
  > this week, the alternating rule should not apply to me. You can do as many
  > in a row as you want if they are your own dishes."

  B sends.
- **Data:** A response argument row is written via `submit-argument`. The two
  concession items must be stored as **separate, individually-addressable
  sub-items**, not as one blob of text — Step 8 needs to act on each one.
- **Notifications:** A new-response notification is queued to Roommate A.
- **Timeline:** **Node 2 — B's concessions + main refutation** is added on the
  horizontal mainline, directly after Node 1. Node 2 becomes the active node.

### Step 7 — Notification to Roommate A

- **UI state:** Roommate A receives *"New response in: Dishes after the camping
  week."* Opening it returns **directly to the argument room** with the **latest
  response (Node 2) active**.
- **Data:** Notification marked read on open.
- **Notifications:** This step is the notification.
- **Timeline:** Node 2 active.

### Step 8 — Concession review by Roommate A

- **UI state:** Roommate A sees B's two concessions as **separate concession
  sub-items / nodes**. Each one carries an **acceptance gradient** control:
  - Agree
  - Agree with caveat
  - Disagree based on framing
  - Disagree based on context
  - Disagree based on fact

  Roommate A selects:
  - Concession 1 → **Agree**
  - Concession 2 → **Disagree based on fact**

  Any choice other than "Agree" makes a **clarification / refutation box
  required**. Roommate A writes, for Concession 2:
  > "Before you left on your camping trip, you had company over, made dinner,
  > left dishes in the sink, and the stove was dirty. I had to clean those,
  > which means it should be your turn next anyway."

- **Data:** A new argument row records the acceptance decision per concession
  and the required clarification body. The room's **active-disagreement
  classification** is now `fact`.
- **Notifications:** A "concession challenged" notification is queued to B.
- **Timeline:** **Node 3 — A's concession acceptance + fact disagreement** is
  added on the mainline. Node 3's metadata shows the active disagreement is
  fact-based.

### Step 9 — Roommate B's second notification

- **UI state:** Roommate B receives *"Your concession was challenged based on
  fact in: Dishes after the camping week."* Opening it lands on Node 3, with the
  **exact challenged concession** highlighted and the new detail (company,
  dinner, sink dishes, stove) visible.
- **Data:** Notification marked read.
- **Notifications:** This step is the notification.
- **Timeline:** Node 3 active.

### Step 10 — The timeline / node board becomes prominent

By now the room has several nodes and the **timeline becomes the primary
surface** — a **horizontal progression**, never a vertical comment thread.

- **UI state:** The board:
  - **Node 1** — A: root claim
  - **Node 2** — B: concessions + main refutation
  - **Node 3** — A: concession acceptance + fact disagreement
  - **Node 4** — B: response (Step 11)

  Each node is clickable. Tapping a node shows: **move type**, **actor**,
  **timestamp**, **concession / refutation / evidence metadata**, **whether it
  is on the main line or a branch**, and the **active fact / context / source /
  framing classification**.
- **Data:** Unchanged — this is a rendering of existing rows.
- **Timeline:** The mainline reads left → right; beginning / middle / end
  timestamps sit below the rail.

### Step 11 — Roommate B responds to the fact challenge

- **UI state:** Roommate B taps **"Disagree based on fact"** and writes:
  > "Clarification for the meal before my camping trip: I had done the dishes,
  > and you came and added extra dishes to them. It's possible there were
  > leftover issues from the dinner, but they were not all mine and should not
  > have reset the alternating rule."

- **Data:** A new argument row on the mainline; active disagreement stays
  `fact`.
- **Notifications:** New-response notification to A.
- **Timeline:** **Node 4** is added as a **horizontal mainline node** — it is a
  direct response on the core argument line.

### Step 12 — Public observer chime-in

Because Roommate A never marked the room private, **Community Observer C** sees
it in the public rooms list and opens it.

- **UI state:** Observer C opens the room in **observer mode** — read and
  inspect only. There is **no blocking "do you want to observe?" modal**;
  observer is simply the default for a non-participant entering a public room. C
  can read every node. C sees a **"Chime in"** action, available because the
  room is public and chime-in seats remain.

  C taps the latest relevant node and writes:
  > "If there were mixed dishes that day but it was still the roommate's turn to
  > do dishes, you may need to specify how much the alternating-dishes agreement
  > is affected by same-day dish-mixing incidents."

- **Data:** A chime-in argument row is written, **attached to the specific node
  C clicked**, with a derived `chime_in` seat role — never written as a primary
  side.
- **Notifications:** A chime-in notification is queued to both A and B.
- **Timeline:** The chime-in renders as a **vertical branch node**, not a
  horizontal mainline node. It is labelled **"Chime in"** and attaches to the
  node C selected.

### Step 13 — Chime-in notification

- **UI state:** Roommate A and Roommate B both receive *"[Observer C] chimed in
  on: Dishes after the camping week."* The notification includes the room name
  and exposes **nothing beyond what the room's visibility allows**.
- **Data:** Notification rows for A and B.
- **Notifications:** This step is the notification.
- **Timeline:** Unchanged from Step 12.

### Step 14 — Chime-in disposition (accept / reject)

- **UI state:** **Only Roommate A and Roommate B** — the two primary
  participants — can act on the chime-in. Each can mark it:
  - **Useful**
  - **Not useful**
  - **Hide from my view**
  - **Convert to branch**
  - **Let it stand**

  In this story, **both A and B mark it "Not useful."**
- **Data:** Two governance reactions recorded against the chime-in node. When
  **two distinct primaries** both mark "Not useful," the chime-in node moves to
  a **muted / greyed** state and Observer C can no longer post in the room.
- **Notifications:** None yet (the made-private notification in Step 15 carries
  the news).
- **Timeline:** The chime-in branch remains in the timeline as a **muted
  branch** — it is never deleted. Observer C keeps **read access**.

> **Doctrine.** "Not useful" describes the *move's fit to this room*, never the
> person. C is not labelled. The branch stays on the record; it is muted, not
> erased.

### Step 15 — Public-to-private transition

Only the two original primaries are now active. Roommate A decides to make the
room **private**.

- **UI state:** Roommate A toggles room visibility to **Private**. A
  confirmation explains, in neutral language, what changes: the room leaves the
  public list and the chime-in leaves public visibility.
- **Data:** The room visibility field flips to `private`. Public read access is
  revoked for non-participants.
- **Notifications:**
  - Observer C receives *"This argument was made private."*
  - Because both A and B had rejected the chime-in, C also receives *"Your
    chime-in was marked unwanted by both primary participants."* — phrased
    **neutrally**, never as shaming.
- **Timeline:** Unchanged structurally; the muted chime-in branch is now
  visible only to A and B.

### Step 16 — Roommate A continues the mainline

- **UI state:** Roommate A concedes one point: "You are right that I added some
  dishes that day." — then adds a refutation: "But I ended up doing those dishes
  anyway, and I did dishes several times after that, so it is still your turn."
- **Data:** A new mainline argument row with a concession sub-item plus a
  refutation body.
- **Notifications:** New-response notification to B.
- **Timeline:** A new **horizontal mainline node** with a concession sub-item
  and a refutation.

### Step 17 — Roommate B responds and raises a second issue

- **UI state:** Roommate B concedes ("Yes, you did your own dishes and you did
  dishes for three days while I was camping.") and refutes ("I also did my own
  dishes while I was camping, and that did not trade off and make you need to
  start doing mine."). Then B adds: **"Also, you left the door unlocked three
  times last week."**
- **Data:** A new mainline argument row. The "door unlocked" sentence introduces
  a **new axis** unrelated to dishes.
- **Notifications:** New-response notification to A.
- **Timeline:** A new mainline node — but it carries content that does not
  belong on the dishes line (handled in Step 18).

### Step 18 — Tangent detection / tagging

- **UI state:** Roommate A uses a simple control to resolve the dishes sub-
  conflict as **"Touché."** Separately, A flags the **"door unlocked"** portion
  as a **Tangent**.
- **Data:** The "door unlocked" content is re-classified as a tangent branch
  rooted at the node where it appeared. The "Touché" marks a partial resolution
  on the dishes line.
- **Notifications:** Optional low-priority notification to B that a tangent was
  split off.
- **Timeline:** The board visibly changes:
  - the **dishes argument continues horizontally** on the mainline;
  - the **door-unlocked issue branches diagonally** from the node where it
    appeared, labelled **"Tangent"**;
  - the tangent gets its **own node chain** if pursued.

  The app does **not** punish the tangent. It is a branch that can be pursued or
  ignored.

### Step 19 — Tangent branch response

- **UI state:** Roommate B replies on the **tangent branch**:
  > "I don't think I left the door unlocked three times last week. That was two
  > weeks ago, and it feels like last week because you were camping. But you're
  > right that I should be better about that."

  Roommate A taps a **fist-bump / acknowledgment reaction** — a low-friction
  affordance that marks a **partial resolution** of the tangent.
- **Data:** A tangent-branch argument row; a reaction record on it.
- **Notifications:** Light notification only.
- **Timeline:** The tangent branch gets a node; the reaction marks it
  partially resolved.

### Step 20 — Mainline resolution

- **UI state:** Roommate B sends an optional summary:
  > "It's still your turn to do the dishes even though you did them four times in
  > a row, because I did your dishes last."

  Roommate A chooses **not to continue** refuting and sends a final
  **acknowledgment / fist-bump**.
- **Data:** The room status flips to **settled / resolved**. A final summary
  node is recorded.
- **Notifications:** A "this argument is settled" notification to both.
- **Timeline:** The board becomes **grey, locked, and non-interactable** except
  for reading, sharing (if allowed), and referencing.

### Step 21 — Later reuse

- **UI state:** Weeks later, the same two users start a **new argument** about
  the door being unlocked again. In the new room they can **reference the prior
  argument** by its ID. The new room shows *"Linked prior argument: Dishes after
  the camping week"* and can surface the relevant resolved **tangent nodes** as
  context.
- **Data:** A link record connects the new room to the old room. The old locked
  room remains immutable and is used as context, not re-opened.
- **Notifications:** None specific to the link.
- **Timeline:** The new room's timeline shows a context chip for the linked
  prior argument.

---

## Timeline / node / branch behavior (summary)

| Element | Behavior |
|---|---|
| **Mainline** | Horizontal, left → right. Root claim, response, concession+refutation, counter-response all sit on it. |
| **Node** | Clickable. Shows move type, actor, timestamp, concession/refutation/evidence metadata, mainline-vs-branch, active classification. |
| **Chime-in branch** | **Vertical** branch off the node the observer selected. Labelled "Chime in." |
| **Tangent branch** | **Diagonal** branch off the node where a new, unrelated axis appeared. Labelled "Tangent." Never auto-punished. |
| **Muted branch** | A chime-in both primaries reject is greyed, never deleted; stays on the record. |
| **Settled / locked board** | Grey, read-only; reading, sharing, and referencing remain. |

## Notifications generated (summary)

| Trigger | Recipients | Copy intent |
|---|---|---|
| Invite | Roommate B | "You were invited to respond to an argument." |
| New response | The other primary | "New response in: <room>." |
| Concession challenged | The challenged participant | "Your concession was challenged based on fact in: <room>." |
| Chime-in posted | Both primaries | "[Observer] chimed in on: <room>." |
| Room made private | Observer C | "This argument was made private." |
| Chime-in rejected | Observer C | "Your chime-in was marked unwanted by both primary participants." (neutral) |
| Argument settled | Both primaries | "This argument is settled." |

---

## Missing-capability analysis — Scenario 1

For every story feature: **classification** (Already supported / Partially
supported / Missing), the **kind of work** required, and the **issue target**.
See [`missing-capabilities-and-issues.md`](missing-capabilities-and-issues.md)
for the full cross-scenario report and acceptance criteria.

| # | Story need | Classification | Kind of work | Issue target |
|---|---|---|---|---|
| 1 | "Start an argument" entry, no "game"/"debate" copy | Already supported (live tab + entry label say "Arguments" / "Start an argument") | Copy scrub of remaining strings | QOL-022 (RULE) |
| 2 | Optional title; blank → root-claim excerpt | Already supported | — | Existing (debate title) |
| 3 | Public/Private visibility chosen at compose | Partially supported (room created public by default; private toggle is the gap) | Rules / policy + data model | QOL-026 (RULE) |
| 4 | Invite by email | Missing (UI placeholder only — `docs/invite-flow.md`) | Data model + notification path | QOL-025 (IX) |
| 5 | No-account invite → signup → return to room | Missing | Auth deep-link routing | QOL-025 (IX) |
| 6 | Account invite → auth → direct into room | Missing | Auth deep-link routing | QOL-025 (IX) |
| 7 | Invited respondent skips the observer/side modal | Already supported (Stage 6.4 seamless entry; existing participants keep their side) | — | Existing (TL-001 / seamless entry) |
| 8 | Itemized concession list UI | Partially supported (point-standing economy models concessions; the composer list UI is the gap) | UI component | QOL-028 (RULE) |
| 9 | Concession acceptance gradient (5 levels) | Missing | UI component + data model | QOL-028 (RULE) |
| 10 | Required clarification on any disagreement | Partially supported (RULE-004 pre-send review is advisory) | Rules / UI | QOL-028 (RULE) |
| 11 | Horizontal timeline as the primary surface | Already supported (TL-001/002/003, Stage 6.1.8 timeline) | — | Existing |
| 12 | Clickable nodes with full metadata | Already supported (SC-002 node popover, META-001 ledger) | — | Existing |
| 13 | Public observer entry with no blocking modal | Already supported (Stage 6.4 observer-first) | — | Existing |
| 14 | Chime-in node (vertical branch) | Already supported (BR-004 `chime_in_vertical`; GAME-005 seats) | — | Existing (BR-004 / GAME-005) |
| 15 | Chime-in accept/reject by primaries | Partially supported (GAME-005 governance: useful / off_track / needs_source / move_to_tangent) | Add "Hide from my view", "Convert to branch", "Let it stand" dispositions | QOL-025-adjacent / GAME-005 follow-up |
| 16 | Tangent branch (diagonal) | Already supported (BR-003 routing, BR-004 `tangent_diagonal`) | — | Existing |
| 17 | Room lock / settled state | Already supported (room status model; argument bodies immutable) | — | Existing |
| 18 | Fist-bump / acknowledgment reaction | Missing | UI component + data model | QOL-028-adjacent (see report) |
| 19 | Public → private transition + observer notification | Missing | Rules / policy + notification path | QOL-026 (RULE) + QOL-027 (IX) |
| 20 | Notification lifecycle (invite, response, chime-in, made-private, settled) | Missing | Notification path (no NOTIF epic exists — maps to IX/QOL) | QOL-027 (IX) |
| 21 | Linked prior argument as context | Missing | Data model + UI | QOL-029 (RULE) |

## Suggested issues — Scenario 1

All issues below are **deduped** against the existing roadmap. Where an existing
card covers the need, no new card is proposed — the storyboard is recorded as
*story evidence* on the existing card instead. See
[`storyboard-to-roadmap-map.md`](storyboard-to-roadmap-map.md).

| Proposed card | Epic | Why it is new (not a duplicate) |
|---|---|---|
| **QOL-022** — User-facing terminology scrub | Rules UX | No existing card scrubs "game"/"debate" from UI copy. |
| **QOL-025** — Invite → signup/auth → room return path | Interaction | `docs/invite-flow.md` is a placeholder; no roadmap card owns the auth-return deep link. |
| **QOL-026** — Public ↔ private room visibility transition | Rules UX | GAME-005 covers public *seats*; nothing covers the visibility *toggle* and its consequences. |
| **QOL-027** — Invite & response notification lifecycle | Interaction | No NOTIF epic exists; no card owns the notification system. |
| **QOL-028** — Concession acceptance gradient | Rules UX | Point-standing economy models concession *effects*; no card owns the 5-level acceptance UI or the fist-bump reaction. |
| **QOL-029** — Linked prior argument reference | Rules UX | No card covers referencing a prior locked room as context. |

Story moments **already covered** (no new card — append story evidence to the
existing card): TL-001/002/003 (timeline), SC-002 (node popover), META-001
(node metadata), BR-003/BR-004 (tangent + chime-in branch grammar), GAME-005
(chime-in governance / seats), Stage 6.4 seamless entry (observer-first, no
modal).
