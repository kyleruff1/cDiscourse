# Storyboard — Band Members / Practice-Room Rent / Private Evidence

**Scenario 2.** Two bandmates settle a rent dispute in a **private** argument
room, using a payment-screenshot as **evidence** and disputing not whether the
payment exists but **which month it applied to**.

> This is a storyboard, not final visual design. It describes the intended
> experience, the UI state at each step, the data generated, the notifications
> sent, and the capability gaps. Evidence is never treated as truth: a payment
> screenshot proves that a payment object exists, never automatically what it
> was for.

---

## Actors

| Actor | Role in the story | Role in the model |
|---|---|---|
| **Bandmate A** | Drummer; starts the private argument | Room creator; first participant |
| **Bandmate B** | Guitarist; invited respondent | Invited named respondent; second participant |
| **Bandmate C** *(optional)* | Bassist | Added **only if both A and B agree**; does not appear in this walkthrough |

There is **no public observer** — the room is private from the first action.

## Context

The band rents a shared practice space. **Bandmate A** believes **Bandmate B**
did not pay their share of the **March** practice-room rent. Bandmate B says they
paid via a money-transfer app (referred to here generically as a payment app).
Bandmate A thinks that payment was for a **February reimbursement** (a cable and
a pedalboard), not March rent. The argument is about the **applicability** of a
payment, not its existence.

The room is **private** from Step 1. Nothing in this scenario is ever publicly
listed.

---

## Step-by-step experience

### Step 1 — Bandmate A starts a private argument

- **UI state:** Bandmate A taps **"Start an argument"**, then — on the compose
  screen — sets visibility to **Private before sending**. A invites Bandmate B
  by email and sets an optional title `March practice-room rent`. Helper copy
  notes a blank title falls back to a root-claim excerpt.
- **Data:** A private room record is created; A is enrolled as participant; a
  pending invite is created for B's email. The room is **never** added to any
  public list.
- **Notifications:** An invite email is queued to B.
- **Timeline:** Not yet rendered.

### Step 2 — Root claim

- **UI state:** Bandmate A writes the root claim:
  > "You still owe your March share of the practice-room rent. The $120 you sent
  > on the payment app was for the February cable and pedalboard reimbursement,
  > not March rent."

  A selects tags: **claim**, **payment dispute**, **evidence expected**,
  **private**, **fact / context dispute**. A optionally references evidence: a
  ledger note, a screenshot placeholder, and a payment transaction reference
  **shown redacted in the UI**. No raw financial account data is entered.
- **Data:** The root argument row is written via `submit-argument`. Any evidence
  reference is stored as a structured **evidence object**, not as free text in
  the body.
- **Notifications:** None to A.
- **Timeline:** **Node 1 — root claim** with a Root marker. The classification
  records this is a fact/context dispute; no truth value is stored.

### Step 3 — Invite path

- **UI state (B's inbox):** An email — *"You were invited to respond to a
  private argument."* One link. The link routes through sign-up / auth if
  needed, then **directly into the private room**. The room is **never** publicly
  listed at any point.
- **Data:** Invite status `sent`.
- **Notifications:** This step is the notification.
- **Timeline:** Unchanged.

### Step 4 — Bandmate B opens the private room

- **UI state:** B lands directly on the room. The room is clearly marked
  **Private** — only invited participants can view it. B sees the root claim, an
  **evidence panel** available, and a response composer with **Concede points**
  and **Main refutation** areas.
- **Data:** B is enrolled as the second participant.
- **Notifications:** None.
- **Timeline:** Node 1 active.

### Step 5 — Bandmate B attaches evidence

- **UI state:** B turns on the **"Attach evidence"** toggle. The evidence editor
  opens. B attaches / describes a payment-app payment of **$120**, dated, with
  the note text "practice space," plus a screenshot (or screenshot metadata).

  B then concedes two items:
  1. "I did owe a March share."
  2. "The amount was $120."

  And refutes:
  > "The payment on March 3 was for practice-room rent. The note said 'practice
  > space.' It was not for the February cable or pedalboard reimbursement."

- **Data:** The evidence is stored as a **first-class evidence object** (see the
  Evidence object model below) — not as body text. The two concessions are
  stored as separate sub-items. The response argument row is written via
  `submit-argument`.
- **Notifications:** A "new response" notification is queued to A.
- **Timeline:** **Node 2 — B's evidence-backed rebuttal.** The evidence appears
  as a **card / pill attached to Node 2.**

### Step 6 — Bandmate A receives the notification and responds to evidence

- **UI state:** A opens the latest node and sees: B conceded the amount and the
  obligation; B attached evidence; the evidence panel is active; the dispute is
  now about **applicability of the evidence**, not whether a payment exists.

  A can respond to evidence with **structured choices**:
  - Accept evidence
  - Accept evidence with caveat
  - Dispute evidence date
  - Dispute evidence amount
  - **Dispute evidence applicability**
  - Request source / receipt
  - Request clarification

  A selects **"Dispute evidence applicability."** A **required clarification
  box** appears. A writes:
  > "The March 3 payment note says 'practice space,' but we had already agreed
  > that February's cable and pedalboard reimbursement would be grouped under
  > practice-space expenses. March rent was due March 10, after that payment."

- **Data:** A new argument row records the structured evidence response
  (`dispute_applicability`) and the required clarification. The evidence object's
  status becomes **`applicability_disputed`**.
- **Notifications:** A "new response" notification is queued to B.
- **Timeline:** **Node 3 — A's evidence applicability challenge** on the
  mainline.

### Step 7 — Evidence timeline behavior

- **UI state:** The horizontal mainline now reads:
  - Node 1 — root claim
  - Node 2 — evidence-backed rebuttal
  - Node 3 — evidence applicability challenge

  The evidence renders as a **card / pill on B's Node 2.** Clicking it opens an
  **evidence side panel** showing:
  - payment date
  - amount
  - note text
  - claimed month
  - disputed month
  - who submitted it
  - who challenged it
  - evidence status: **Applicability disputed**

- **Data:** The side panel is a read view of the evidence object plus the
  applicability dispute record.
- **Notifications:** None.
- **Timeline:** Node 3 active; the evidence pill on Node 2 now shows a
  "disputed" state.

### Step 8 — Bandmate B responds

- **UI state:** B selects **"Agree with caveat"** on the point that March rent
  was due March 10, and writes:
  > "You're right March rent was due March 10, but I paid early because I knew I
  > would be traveling. I labeled it 'practice space' because that's what it was
  > for."

  B may add optional further evidence (a group-chat message screenshot saying
  "I'll send rent early," or a calendar note) — or none.
- **Data:** A new mainline argument row with the `agree_with_caveat` decision.
- **Notifications:** "New response" to A.
- **Timeline:** A new mainline node.

### Step 9 — Bandmate A asks for source

- **UI state:** A taps **"Ask for source"** and writes: "Can you show the message
  where you said you were sending March rent early?" This creates an
  **evidence-debt marker** on the timeline. The room status line now reads
  **"Evidence requested."**
- **Data:** An evidence-debt record (type: `source needed`) is opened against
  B's caveat. The room's derived status surfaces "Evidence requested."
- **Notifications:** A "source requested" notification to B.
- **Timeline:** An evidence-debt marker chip appears on the relevant node.

### Step 10 — Bandmate B supplies the message evidence

- **UI state:** B attaches a group-chat screenshot / text excerpt: "Sending my
  March rent early so I don't forget." The **evidence panel updates**:
  - evidence status: **stronger**
  - applicability: **likely March**
  - remaining dispute: whether it covered the full share

- **Data:** A second evidence object is created and linked to B's caveat. The
  evidence-debt marker is marked **resolved**. The first evidence object's
  applicability status improves from `applicability_disputed` toward
  `applicability_supported` (still not "true" — just better supported).
- **Notifications:** "Evidence supplied" notification to A.
- **Timeline:** The evidence-debt chip flips to resolved; the evidence pill
  shows a stronger state.

### Step 11 — Bandmate A concedes

- **UI state:** A uses the concession list:
  1. "I concede the $120 payment was intended for March rent."
  2. "I concede I misread the payment timing."

  And refutes the remaining point:
  > "I still think you owe $20 because the rent went up to $140 starting March."

- **Data:** A new mainline argument row: two concession sub-items plus a
  refutation introducing a **new sub-axis (the amount)**.
- **Notifications:** "New response" to B.
- **Timeline:** A new mainline node; the original applicability dispute is now
  effectively resolved, the live dispute narrows to the amount.

### Step 12 — Bandmate B disputes the amount

- **UI state:** B selects **"Disagree based on context"** and writes:
  > "The rent increase started in April. March was still $120. The text about
  > $140 was for the next month."

  B attaches evidence: a landlord-message excerpt and invoice due dates, with the
  lease / payment message **shown redacted**.
- **Data:** A new mainline argument row with `disagree_context`; a third
  evidence object (landlord message) attached.
- **Notifications:** "New response" to A.
- **Timeline:** A new mainline node with an attached evidence pill.

### Step 13 — Outcome (chosen resolution)

- **UI state:** Bandmate A accepts the evidence. A taps **"Accept evidence"**,
  then writes a summary:
  > "Resolved: March was paid. I confused the February reimbursement and the
  > April rent increase with March."

  Bandmate B taps **"Confirm resolution."**
- **Data:** The room status flips to **settled**. A final summary node is
  recorded:
  > "March rent was paid; the dispute was caused by payment-label ambiguity and
  > month confusion."

- **Notifications:** A "this argument is settled" notification to both.
- **Timeline:** The **private room locks as settled** — grey, read-only;
  reading, and referencing by authorized participants remain.

### Step 14 — Future use

- **UI state:** Next month a rent question arises again. Either bandmate, in a
  new room, can **reference this private argument by ID**. Because the prior room
  is private, **only the same authorized participants** can view its details.
  The new room shows a **safe reference**: *"Linked prior private argument: March
  practice-room rent"* — the title shows, the content does **not** open for
  anyone not authorized on the original room.
- **Data:** A link record connects the new room to the old private room. The
  link carries an **access check**: the linked content is viewable only by users
  authorized on the original room.
- **Notifications:** None specific to the link.
- **Timeline:** The new room shows a context chip; tapping it opens the prior
  room only for authorized viewers.

---

## Evidence object model

Evidence in CDiscourse is a **structured object**, never just body text. The
storyboard requires these fields to be separable so the UI can dispute one
without disputing the others.

| Field | Meaning | Example (Scenario 2) |
|---|---|---|
| `kind` | Evidence type | `payment_screenshot` |
| `platform` | Where the record came from (generic label) | payment app |
| `date` | When the evidence event happened | March 3 |
| `amount` | The monetary amount, if any | $120 |
| `payer` / `payee` | **Redacted** in the UI | redacted |
| `noteText` | The note/memo on the record | "practice space" |
| `claimedApplicability` | What the submitter says it applies to | March rent |
| `disputedApplicability` | What a challenger says it applies to | February reimbursement |
| `confidence` | Always **user-asserted, not system-proven** | `user_asserted` |
| `submittedBy` / `challengedBy` | Who added it / who is disputing it | B / A |
| `status` | Evidence lifecycle state | `applicability_disputed` → `stronger` |

The model **separates** these so a dispute is precise:

- evidence **existence** (a payment object exists)
- evidence **amount**
- evidence **date**
- evidence **note**
- evidence **applicability** (which month / which obligation it covers)
- evidence **interpretation** (what the parties read into it)

A payment screenshot proves **at most that a payment object exists** — never
automatically what it was *for*. The applicability dispute is the heart of
Scenario 2, and it is a separate axis from existence.

### Evidence status labels (no truth verdicts)

| Label | Meaning |
|---|---|
| Evidence attached | An evidence object is present. |
| Evidence disputed | A challenger disagrees with the evidence. |
| Applicability disputed | The challenge is specifically about which month / obligation it covers. |
| Source requested | A participant has asked for the underlying source. |
| Evidence accepted by both | Both primaries accepted it. |
| Still unresolved | The dispute is open. |

Forbidden on any evidence surface: **"proof", "true", "winner", "loser"**, and
**"case closed"** — even at settlement, the word is **"settled."**

## Evidence toggle and side panel behavior

| Element | Behavior |
|---|---|
| **Attach evidence toggle** | Opens the evidence editor; evidence is captured as a structured object, not pasted into the body. |
| **Evidence card / pill** | Renders attached to the author's node on the timeline; shows the current evidence status. |
| **Evidence side panel** | Opens on tapping the pill; shows date, amount, note, claimed month, disputed month, submitter, challenger, status. |
| **Structured evidence response** | Accept / Accept with caveat / Dispute date / Dispute amount / Dispute applicability / Request source / Request clarification. Any non-Accept choice requires a clarification. |
| **Evidence-debt marker** | A "source needed" / "quote needed" chip on the node; resolvable by a later move. |
| **Redaction** | Payer/payee, account data, raw lease/landlord text are shown redacted. |

## Notifications generated (summary)

| Trigger | Recipients | Copy intent |
|---|---|---|
| Invite | Bandmate B | "You were invited to respond to a private argument." |
| New response | The other primary | "New response in: <room>." |
| Source requested | The asked participant | "A source was requested in: <room>." |
| Evidence supplied | The requester | "Evidence was supplied in: <room>." |
| Argument settled | Both primaries | "This argument is settled." |

---

## Missing-capability analysis — Scenario 2

| # | Story need | Classification | Kind of work | Issue target |
|---|---|---|---|---|
| 1 | Private argument start (Private chosen before sending) | Partially supported (room model exists; an enforced private-from-creation path + RLS is the gap) | Rules / policy + data model | QOL-026 (RULE) |
| 2 | Private invite → auth → private room | Missing (invite is a UI placeholder) | Notification path + auth deep-link | QOL-025 (IX) |
| 3 | "Attach evidence" toggle | Partially supported (EV-001 evidence model; the composer toggle UI is the gap) | UI component | EV-001 follow-up / QOL-023 (EV) |
| 4 | Evidence **object** model (not body text) | Already supported (EV-001 `EvidenceArtifact`) | — | Existing (EV-001) |
| 5 | Payment-specific evidence metadata (amount, date, redacted payer/payee, note, claimed applicability) | Missing (EV-001 has no payment fields) | Data model | QOL-023 (EV) |
| 6 | Redacted payment / screenshot handling | Partially supported (EV-001 has `screenshot_redacted` kind; payment-field redaction is the gap) | Data model + UI | QOL-023 (EV) |
| 7 | Evidence side panel | Partially supported (EV-002 source-chain popover, EV-005 annotations) | UI component | EV-002/EV-005 follow-up |
| 8 | Evidence **applicability** dispute flow | Missing (EV-002 covers source/quote; applicability is a distinct axis) | Rules / UI + data model | QOL-024 (EV) |
| 9 | Evidence status changes (disputed → stronger) | Partially supported (EV-003 evidence-debt; applicability status is the gap) | Data model | QOL-024 (EV) |
| 10 | Evidence-debt marker | Already supported (EV-003 evidence debt tracker) | — | Existing (EV-003) |
| 11 | "Accept evidence with caveat" | Missing | UI component + data model | QOL-024 (EV) |
| 12 | Settled room lock | Already supported (room status; immutable bodies) | — | Existing |
| 13 | Private prior-argument reference with access check | Missing | Data model + RLS + UI | QOL-029 (RULE) |
| 14 | Notification lifecycle (invite, response, source, evidence supplied, settled) | Missing | Notification path | QOL-027 (IX) |
| 15 | Structured evidence response choices | Missing | UI component + rules | QOL-024 (EV) |

## Suggested issues — Scenario 2

All deduped against the existing roadmap (EV-001 … EV-005 already exist).

| Proposed card | Epic | Why it is new (not a duplicate) |
|---|---|---|
| **QOL-023** — Payment / screenshot evidence metadata object | Evidence | EV-001's `EvidenceArtifact` has no amount / date / payer / payee / claimed-applicability fields; payment evidence needs them. |
| **QOL-024** — Evidence applicability dispute flow | Evidence | EV-002 covers source/quote disputes; **applicability** (which month a payment covers) is a separate axis with its own structured responses and status. |
| **QOL-025** — Invite → signup/auth → room return path | Interaction | Shared with Scenario 1 — the invite backend + auth deep link does not exist. |
| **QOL-026** — Public ↔ private room visibility transition | Rules UX | Private-from-creation enforcement + RLS is not a roadmap card. |
| **QOL-027** — Invite & response notification lifecycle | Interaction | No NOTIF epic; no card owns notifications. |
| **QOL-029** — Linked prior argument reference | Rules UX | Private prior-reference needs an access-checked link; no card covers it. |

Story moments **already covered** (append story evidence to the existing card):
EV-001 (evidence object), EV-002 (source-chain popover / "Ask for source"),
EV-003 (evidence-debt marker / "Evidence requested"), EV-005 (evidence
annotations), the room status / lock model, `submit-argument` as the single
write path.
