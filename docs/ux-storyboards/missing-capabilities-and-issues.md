# CDiscourse — Missing Capabilities and Issues

A structured product-gap report across both storyboards. Each gap keeps five
fields **separate**: the **story need**, the **current app support**, the
**missing app support**, the **issue target**, and the **acceptance criteria**.

Every proposed card is **deduped** against the existing roadmap
(`docs/ux-ui-project-board.md`, `scripts/github/uxBoardCards.json`). Where an
existing card already covers a need, **no new card is created** — the storyboard
is recorded as *story evidence* on the existing card. See
[`storyboard-to-roadmap-map.md`](storyboard-to-roadmap-map.md).

Issue creation status for this pass: **local issue-catalogue entries only.**
The new `QOL-034 … QOL-042` cards are appended to
`scripts/github/uxBoardCards.json`. No GitHub issues were created — the task
prompt did not explicitly authorize GitHub issue creation, so the safe path
(local catalogue) was taken. An operator can promote the catalogue with
`npm run github:ux-board:dry` then `bash scripts/github/applyUxProjectBoard.sh`.

---

## Summary table

| Story need | Scenario | Current support | Missing capability | Canonical header | Existing match | New issue? | Priority | Effort | Release | 
|---|---|---|---|---|---|---|---|---|---|
| Invite by email → signup/auth → return to room | 1 + 2 | None (UI placeholder) | Invite backend + auth deep-link routing | IX — Interaction | — | **Yes — QOL-038** | P1 | L | 6.7 |
| Public ↔ private room visibility transition | 1 + 2 | Partial (room model) | Visibility toggle, RLS, transition consequences | RULE — Rules UX | partial: GAME-005 (seats only) | **Yes — QOL-039** | P1 | M | 6.7 |
| Invite & response notification lifecycle | 1 + 2 | None | Notification system (no NOTIF epic) | IX — Interaction | — | **Yes — QOL-040** | P2 | L | 6.7 |
| Concession list + 5-level acceptance gradient | 1 | Partial (point-standing economy) | Itemized concession UI + acceptance gradient + fist-bump reaction | RULE — Rules UX | partial: point-standing-economy | **Yes — QOL-041** | P1 | M | 6.6 |
| Linked prior argument as context/evidence | 1 + 2 | None | Room-to-room link with access check | RULE — Rules UX | — | **Yes — QOL-042** | P2 | M | 6.8 |
| Payment / screenshot evidence metadata | 2 | Partial (EV-001 object) | Amount / date / redacted payer-payee / claimed-applicability fields | EV — Evidence | partial: EV-001 | **Yes — QOL-036** | P1 | M | 6.7 |
| Evidence applicability dispute flow | 2 | Partial (EV-002/003) | Applicability axis + structured evidence responses + status | EV — Evidence | partial: EV-002, EV-003 | **Yes — QOL-037** | P1 | M | 6.7 |
| User-facing terminology scrub | 1 + 2 | Partial (live tab says "Arguments") | Scrub remaining "debate"/"moderator" copy | RULE — Rules UX | — | **Yes — QOL-035** | P1 | M | 6.6 |
| Storyboard canon + narrative officer skill | — | None | This pass delivers it | PM — Project Mgmt | — | **Yes — QOL-034** | P1 | S | 6.6 |
| Horizontal timeline as primary surface | 1 | Built | — | TL — Timeline | TL-001/002/003 | No | — | — | — |
| Clickable nodes with full metadata | 1 + 2 | Built | — | SC — Sidecar Rail | SC-002, META-001 | No | — | — | — |
| Observer-first public entry, no modal | 1 | Built | — | TL — Timeline | Stage 6.4 | No | — | — | — |
| Chime-in node (vertical branch) | 1 | Built | — | BR — Branches | BR-004, GAME-005 | No | — | — | — |
| Chime-in governance (accept/reject) | 1 | Partial (4 reactions) | "Hide from my view", "Convert to branch", "Let it stand" | RULE — Rules UX | GAME-005 | No — GAME-005 follow-up | P2 | S | 6.7 |
| Tangent branch (diagonal) | 1 | Built | — | BR — Branches | BR-003, BR-004 | No | — | — | — |
| Room lock / settled state | 1 + 2 | Built | — | RULE — Rules UX | room status model | No | — | — | — |
| Evidence object (not body text) | 2 | Built | — | EV — Evidence | EV-001 | No | — | — | — |
| Evidence-debt marker / "Source requested" | 2 | Built | — | EV — Evidence | EV-003 | No | — | — | — |

---

## Detailed gaps with acceptance criteria

Each entry below follows the five-field split. Acceptance criteria are testable.

### QOL-034 — Storyboard canon + narrative officer skill

- **Story need:** A durable, shared picture of the whole CDiscourse experience
  that design, product, issue, and implementation work all reference.
- **Current app support:** None. The roadmap describes feature slices; no doc
  walked the whole journey.
- **Missing app support:** The storyboard docs, the interaction taxonomy, the
  terminology rules + audit, and a manual skill to keep them coherent.
- **Issue target:** PM — Project Mgmt. New card **QOL-034**.
- **Acceptance criteria:**
  - `docs/ux-storyboards/` contains README, two scenario storyboards,
    interaction taxonomy, missing-capabilities report, terminology rules, the
    roadmap map, and a generated terminology audit.
  - `.claude/skills/storyline-narrative-officer/SKILL.md` exists with valid
    manual-only frontmatter (`disable-model-invocation: true`,
    `user-invocable: true`, `invocation: user`, `effort: high`).
  - The skill states it is dev/design-only, makes no AI/Supabase/email calls,
    enforces "do not call it a game in UI" and "prefer Argument over Debate in
    UI", and requires issue-deduping before proposing cards.
  - A test validates the skill frontmatter and required content.

### QOL-035 — User-facing terminology scrub

- **Story need:** The app never says "game" and avoids "debate" in normal-user
  copy (Scenario 1 Step 1: "Start an argument", not "Start a game/debate").
- **Current app support:** The live Arguments tab and entry label are already
  correct. `npm run ux:terminology:audit` reports the remainder.
- **Missing app support:** ~35 discouraged "debate"/"moderator" strings in live
  surfaces (CreateDebateForm, JoinDebatePanel, DebateDetailHeader, admin tabs,
  constitution copy) plus legacy strings in the not-mounted DebateListScreen.
- **Issue target:** RULE — Rules UX. New card **QOL-035**.
- **Acceptance criteria:**
  - `npm run ux:terminology:audit` reports **0 live prohibited** violations
    (already true after this pass) and the discouraged count trends to 0.
  - User-facing "Debate" / "debate room" copy in mounted screens is reworded.
  - The `debates` database table is **not** renamed.
  - `npm run ux:terminology:audit --strict` exits 0.

### QOL-036 — Payment / screenshot evidence metadata object

- **Story need:** Scenario 2 — attach a payment screenshot as evidence with
  amount, date, redacted payer/payee, note text, and a claimed applicability
  (which month it covers).
- **Current app support:** EV-001 `EvidenceArtifact` exists with `kind`
  (`screenshot_redacted`, `manual_citation`), `sourceChainStatus`, `risk`.
- **Missing app support:** Payment-specific fields — `amount`, `date`,
  redacted `payer`/`payee`, `noteText`, `claimedApplicability`,
  `confidence: user_asserted`. EV-001 has none of these.
- **Issue target:** EV — Evidence. New card **QOL-036** (extends EV-001).
- **Acceptance criteria:**
  - The evidence object gains payment metadata fields, all optional and
    additive to EV-001 (no breaking change to existing `EvidenceArtifact`).
  - Payer/payee and account data are stored redacted; raw financial account
    data is never required or stored.
  - `confidence` is always `user_asserted` — never `system_proven`.
  - A payment evidence object never produces a truth value or a point-standing
    delta on its own.

### QOL-037 — Evidence applicability dispute flow

- **Story need:** Scenario 2 — dispute **which month** a payment covers, as a
  separate axis from disputing that the payment exists.
- **Current app support:** EV-002 (source-chain popover, "Ask for source"),
  EV-003 (evidence-debt tracker). These cover source/quote disputes.
- **Missing app support:** The applicability axis: structured evidence
  responses (Accept / Accept with caveat / Dispute date / Dispute amount /
  Dispute applicability / Request source / Request clarification), an
  `applicability_disputed` → `stronger` status, and a required clarification on
  any non-Accept choice.
- **Issue target:** EV — Evidence. New card **QOL-037**.
- **Acceptance criteria:**
  - An evidence object carries a distinct applicability status separate from
    its existence and source-chain status.
  - The structured evidence-response choices exist; any non-Accept choice
    requires a clarification body.
  - Disputing applicability never declares the evidence false — it changes a
    status, never a truth value.
  - Copy uses "Applicability disputed", never "proof" / "true" / "false".

### QOL-038 — Invite → signup/auth → argument-room return path

- **Story need:** Both scenarios — invite a named respondent by email; the link
  routes a new user through sign-up and an existing user through auth, then
  **directly back into the specific room**. The path must be fast — these are
  real-time conflicts being de-escalated.
- **Current app support:** None. `docs/invite-flow.md` describes `InvitePanel`
  as a UI placeholder: no invite backend, no email send, no auth-return route.
- **Missing app support:** The invite data model (`argument_room_invites` per
  `docs/invite-flow.md`), the email send path, and an auth deep link that
  preserves the destination room across sign-up / auth.
- **Issue target:** IX — Interaction. New card **QOL-038**.
- **Acceptance criteria:**
  - Inviting by email creates an invite record; RLS lets the inviter manage it
    and the invitee see their own.
  - An invited new user completes sign-up and lands on the invited room.
  - An invited existing user completes auth and lands on the invited room.
  - The invited respondent enters as a primary participant — no observer/side
    modal (consistent with Stage 6.4 seamless entry).
  - No service-role in client; no broad user search exposed.

### QOL-039 — Public ↔ private room visibility transition

- **Story need:** Scenario 1 — a public room is made private after a chime-in is
  rejected; Scenario 2 — a room is private from creation and never publicly
  listed.
- **Current app support:** Rooms have a visibility concept; GAME-005 governs
  public *seats*. Private-from-creation enforcement and the transition flow are
  not built.
- **Missing app support:** A creator-only visibility toggle, RLS that revokes
  non-participant reads on transition to private, the consequences (room leaves
  the public list; chime-ins leave public visibility), and the neutral
  notifications that accompany the change.
- **Issue target:** RULE — Rules UX. New card **QOL-039**.
- **Acceptance criteria:**
  - A room can be created private and never appears on any public list.
  - The room creator can transition public → private; non-participant read
    access is revoked by RLS.
  - On transition, rejected chime-in branches are retained (muted), never
    deleted.
  - The transition triggers the neutral observer notifications described in
    QOL-040 — never shaming copy.

### QOL-040 — Invite & response notification lifecycle

- **Story need:** Both scenarios — notifications for invite, new response,
  concession challenged, source requested, evidence supplied, chime-in posted,
  room made private, chime-in rejected, argument settled. Opening a notification
  returns directly to the room with the right node active.
- **Current app support:** None. There is no notification epic.
- **Missing app support:** A notification model + delivery path; per-trigger
  copy; deep links that open the room at the relevant node. The repo's v1 scope
  explicitly excludes *push* notifications — in-app notifications are in scope.
- **Issue target:** IX — Interaction (no NOTIF epic exists; IX is the closest
  canonical header). New card **QOL-040**.
- **Acceptance criteria:**
  - Each trigger in the storyboards produces a notification with neutral copy.
  - Notification copy never exposes data the room's visibility forbids.
  - Opening a notification routes to the room with the relevant node active.
  - The "chime-in rejected" notification is neutral and never shames the
    observer.
  - No push notifications (v1 scope) — in-app only.

> **Taxonomy note.** There is no NOTIF issue family. This report maps
> notifications to **IX (Interaction)**. A dedicated NOTIF epic is only worth
> creating if notification scope grows well beyond QOL-040; for now IX is the
> correct, non-proliferating home.

### QOL-041 — Concession acceptance gradient

- **Story need:** Scenario 1 — a response concedes an itemized list of points;
  the receiver rates each concession on a 5-level gradient (Agree / Agree with
  caveat / Disagree based on framing / context / fact); any disagreement
  requires a clarification. Plus the low-friction fist-bump / acknowledgment
  reaction.
- **Current app support:** The point-standing economy models `ConcessionEffect`
  and concession scoring. RULE-004 provides advisory pre-send review.
- **Missing app support:** The itemized concession-list composer, the per-
  concession acceptance-gradient control, the required-clarification rule, and
  the fist-bump reaction affordance.
- **Issue target:** RULE — Rules UX. New card **QOL-041**.
- **Acceptance criteria:**
  - A response can carry multiple separately-addressable concession items.
  - Each received concession exposes the 5-level acceptance gradient.
  - Any gradient choice other than "Agree" requires a clarification body.
  - The chosen gradient sets the room's active-disagreement classification
    (framing / context / fact) and shows on the node.
  - A fist-bump / acknowledgment reaction exists as a low-friction partial-
    resolution affordance; it carries no score and no verdict.

### QOL-042 — Linked prior argument reference

- **Story need:** Both scenarios — a new room references an earlier settled
  room; for a private prior room, the link respects the original room's access.
- **Current app support:** None. Rooms are not linkable.
- **Missing app support:** A room-to-room link record; a context chip on the
  new room; an access check so a private prior room's content opens only for
  users authorized on the original room; surfacing relevant resolved tangent
  nodes as context.
- **Issue target:** RULE — Rules UX. New card **QOL-042**.
- **Acceptance criteria:**
  - A new room can reference a prior room by ID; the prior room's title shows
    as a context chip.
  - A locked prior room is never re-opened or mutated by the link.
  - A private prior room's content opens only for users authorized on that
    original room; an unauthorized user sees the title only.
  - Relevant resolved tangent nodes from the prior room can surface as context.

---

## Story moments already covered (no new card)

These needs are met by shipped or in-flight roadmap cards. The storyboards are
recorded as *story evidence* on them — they are **not** duplicated as new cards.

| Story moment | Existing card / baseline |
|---|---|
| Timeline is the primary surface | TL-001, TL-002, TL-003; Stage 6.1.8 timeline |
| Clickable node with metadata | SC-002 (node popover), META-001 (metadata ledger) |
| Observer-first public entry, no modal | Stage 6.4 seamless conversation entry |
| Chime-in node as a vertical branch | BR-004 (`chime_in_vertical`) |
| Chime-in governance core (useful / off-track / needs-source / move-to-tangent) | GAME-005 (chime-in governance) |
| Tangent branch as a diagonal branch | BR-003 (tangent routing), BR-004 (`tangent_diagonal`) |
| Room lock / settled state; immutable bodies; request-only deletion | Room status model; Stage 6.1.8 |
| Evidence as a first-class object | EV-001 (`EvidenceArtifact`) |
| "Ask for source" / source-chain popover | EV-002 |
| Evidence-debt marker / "Evidence requested" | EV-003 |
| Evidence-to-evidence annotations | EV-005 |
| Gallery entry lanes (needs-first-rebuttal, source-trail, quiet, etc.) | GAL-001, GAL-002 |
| Plain-language code mapping (no raw `snake_case`) | RULE-001, `gameCopy.toPlainLanguage` |

### Small follow-ups (not new cards)

- **Chime-in viewer-side "Hide from my view" + "Convert to branch" + neutral
  "Let it stand"** — GAME-005 ships four governance reactions; these three
  dispositions are a **small GAME-005 follow-up**, recorded here as story
  evidence rather than a separate card.
- **Private invited-argument gallery entry state** — recorded as story evidence
  on **GAL-002** (entry cards), not a new card.
