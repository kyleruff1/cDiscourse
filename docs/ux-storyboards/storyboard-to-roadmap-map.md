# CDiscourse — Storyboard-to-Roadmap Map

Every storyboard moment mapped to a roadmap card. A moment either **maps to an
existing card** (cite it; do not duplicate) or **needs a new card** (propose the
key + acceptance criteria).

Roadmap sources of truth: `docs/ux-ui-project-board.md` (epics + cards),
`docs/current-status.md` (what is built), `scripts/github/uxBoardCards.json`
(the local issue catalogue). Canonical epic prefixes: **TL** Timeline, **VG**
Visual Grammar, **BR** Branches, **SC** Sidecar Rail, **ST** Stack Detail,
**EV** Evidence, **SW** Strength/Weakness, **IX** Interaction, **PR** Profiles,
**HOST** Hosting, **GAL** Gallery, **RULE** Rules UX, **AN** Analytics,
**PM** Project Mgmt, **QOL** cross-cutting.

---

## Scenario 1 — Roommates / dishes / public

| Story moment | Maps to | Status |
|---|---|---|
| 1 — "Start an argument" entry, no game/debate copy | RULE — terminology | **New: QOL-022** (live tab already correct) |
| 2 — Compose: optional title, blank → root excerpt | Existing — debate title (Stage 6.1.8) | Covered |
| 2 — Visibility chosen at compose (Public default) | RULE — room visibility | **New: QOL-026** |
| 2 — Invite by email | IX — invite path | **New: QOL-025** |
| 3 — Root claim + classification tags | Existing — TL-002 (root marker), VG-001 (grammar), RULE-005 (channels) | Covered |
| 4 — Invite email; no "debate/game" subject | IX — invite path | **New: QOL-025** |
| 4 — No-account → signup → return; account → auth → room | IX — auth deep link | **New: QOL-025** |
| 5 — Invited respondent skips observer/side modal | Existing — Stage 6.4 seamless entry, TL-001 | Covered |
| 6 — Itemized concession list + main refutation composer | RULE — concession UI | **New: QOL-028** |
| 7 — "New response" notification → returns to room | IX — notifications | **New: QOL-027** |
| 8 — Concession acceptance gradient (5 levels) | RULE — concession UI | **New: QOL-028** |
| 8 — Required clarification on disagreement | Existing — RULE-004 (advisory review); extended by QOL-028 | Partial |
| 9 — "Concession challenged" notification | IX — notifications | **New: QOL-027** |
| 10 — Horizontal timeline becomes primary; clickable nodes | Existing — TL-001/002/003, SC-002, META-001 | Covered |
| 11 — Mainline horizontal node for a direct response | Existing — BR-001 (mainline), BR-004 (`mainline`) | Covered |
| 12 — Public observer entry, no modal | Existing — Stage 6.4 observer-first, SC-001 | Covered |
| 12 — Chime-in as a vertical branch node | Existing — BR-004 (`chime_in_vertical`), GAME-005 (chime-in seat) | Covered |
| 13 — Chime-in notification to both primaries | IX — notifications | **New: QOL-027** |
| 14 — Chime-in accept/reject by primaries | Existing — GAME-005 (governance reactions) | Covered (core) |
| 14 — "Hide from my view" / "Convert to branch" / "Let it stand" | GAME-005 follow-up | Small follow-up (story evidence on GAME-005) |
| 14 — Rejected chime-in becomes a muted branch, never deleted | Existing — GAME-005 (observer-fallback retains branch) | Covered |
| 15 — Public → private transition | RULE — room visibility | **New: QOL-026** |
| 15 — "Made private" / "chime-in rejected" observer notifications | IX — notifications | **New: QOL-027** |
| 16–17 — Mainline concession + refutation nodes | Existing — VG-001, RULE-005, point-standing-economy | Covered |
| 18 — "Touché" partial-resolution control | RULE — concession UI / reactions | **New: QOL-028** (reaction affordance) |
| 18 — Tangent flag → diagonal branch | Existing — BR-003 (tangent routing), BR-004 (`tangent_diagonal`) | Covered |
| 19 — Tangent-branch response + fist-bump reaction | RULE — reactions | **New: QOL-028** (fist-bump) |
| 20 — Settlement → grey, locked board | Existing — room status / lock model | Covered |
| 21 — Linked prior argument as context | RULE — cross-room link | **New: QOL-029** |

## Scenario 2 — Band / rent / private evidence

| Story moment | Maps to | Status |
|---|---|---|
| 1 — Private argument from creation | RULE — room visibility | **New: QOL-026** |
| 1 — Invite by email into a private room | IX — invite path | **New: QOL-025** |
| 2 — Root claim, payment-dispute tags, evidence reference | Existing — EV-001 (evidence object), RULE-005 (channels) | Partial — see QOL-023 |
| 3 — Private invite → auth → private room, never listed | IX — auth deep link + RULE visibility | **New: QOL-025 + QOL-026** |
| 4 — Private room marked Private; evidence panel available | RULE — visibility; EV — panel | **New: QOL-026**; EV-002/005 follow-up |
| 5 — "Attach evidence" toggle; evidence as an object | Existing — EV-001; toggle UI extends it | Partial — EV-001 follow-up |
| 5 — Payment metadata (amount, date, redacted payer/payee, note, claimed month) | EV — evidence metadata | **New: QOL-023** |
| 6 — Structured evidence response (Accept / Dispute applicability / …) | EV — applicability flow | **New: QOL-024** |
| 6 — Required clarification on a non-Accept response | Existing — RULE-004; extended by QOL-024 | Partial |
| 7 — Evidence card/pill on node; evidence side panel | Existing — EV-002 (source-chain popover), EV-005 (annotations) | Partial — EV follow-up |
| 8 — "Agree with caveat" on evidence | EV — applicability flow | **New: QOL-024** |
| 9 — "Ask for source" → evidence-debt marker, "Evidence requested" | Existing — EV-002, EV-003 | Covered |
| 10 — Evidence supplied → status improves | Existing — EV-003 (debt resolution); status extends via QOL-024 | Partial |
| 11 — Concession list ("I concede …") | RULE — concession UI | **New: QOL-028** |
| 12 — "Disagree based on context" + attach evidence | EV — applicability flow; QOL-024 / QOL-028 | **New** |
| 13 — "Accept evidence" + summary; "Confirm resolution" → settled lock | Existing — room status / lock; QOL-024 for the evidence-accept action | Partial |
| 14 — Linked prior **private** argument with access check | RULE — cross-room link | **New: QOL-029** |
| All — invite / response / source / settled notifications | IX — notifications | **New: QOL-027** |

---

## New cards — proposed keys + acceptance criteria

All new cards are filed under the closest existing canonical epic and use the
`QOL-NNN` prefix the local catalogue (`scripts/github/uxBoardCards.json`)
requires. Full acceptance criteria are in
[`missing-capabilities-and-issues.md`](missing-capabilities-and-issues.md).

| Key | Title | Epic | Priority / Effort / Release |
|---|---|---|---|
| **QOL-021** | Storyboard canon + storyline-narrative-officer skill | Project Mgmt | P1 / S / 6.6 |
| **QOL-022** | User-facing terminology scrub: no "game", prefer "Argument" | Rules UX | P1 / M / 6.6 |
| **QOL-023** | Payment / screenshot evidence metadata object | Evidence | P1 / M / 6.7 |
| **QOL-024** | Evidence applicability dispute flow | Evidence | P1 / M / 6.7 |
| **QOL-025** | Invite → signup/auth → argument-room return path | Interaction | P1 / L / 6.7 |
| **QOL-026** | Public ↔ private room visibility transition rules | Rules UX | P1 / M / 6.7 |
| **QOL-027** | Invite & response notification lifecycle | Interaction | P2 / L / 6.7 |
| **QOL-028** | Concession acceptance gradient + concession-list UI | Rules UX | P1 / M / 6.6 |
| **QOL-029** | Linked prior argument reference (context / evidence) | Rules UX | P2 / M / 6.8 |

## Existing cards — story evidence to append

These cards already cover a storyboard moment. Rather than create duplicates,
append a one-line *story evidence* note pointing at the relevant storyboard
step. (This pass records the mapping here; an issue agent applies the note when
the cards are next touched.)

| Existing card | Story evidence to append |
|---|---|
| TL-001 / TL-002 / TL-003 | Scenario 1 Steps 3, 10 — timeline-first room, root marker. |
| SC-002 | Scenario 1 Step 10 — clickable node, full metadata popover. |
| META-001 | Scenario 1 Step 10 — node metadata (move type, actor, classification). |
| BR-003 / BR-004 | Scenario 1 Steps 12, 18 — chime-in vertical + tangent diagonal branch grammar. |
| GAME-005 | Scenario 1 Step 14 — chime-in governance; small follow-up: viewer-side hide, "let it stand". |
| EV-001 | Scenario 2 Steps 2, 5 — evidence as a first-class object. |
| EV-002 | Scenario 2 Steps 7, 9 — source-chain popover, "Ask for source". |
| EV-003 | Scenario 2 Steps 9, 10 — evidence-debt marker, "Evidence requested". |
| EV-005 | Scenario 2 Step 7 — evidence side panel / annotations. |
| GAL-002 | Scenario 2 — private invited-argument gallery entry state. |
| RULE-004 | Scenario 1 Step 8, Scenario 2 Step 6 — required-clarification advisory. |
| RULE-005 | Both scenarios — move channels (reply / challenge / clarify / ask_source). |

---

## How an issue agent should use this map

1. Read this map and `missing-capabilities-and-issues.md`.
2. The new `QOL-021 … QOL-029` cards are already in
   `scripts/github/uxBoardCards.json`. Run `npm run github:ux-board:dry` to see
   the create plan.
3. Only after the operator authorizes it, run
   `bash scripts/github/applyUxProjectBoard.sh` to create the GitHub issues.
4. For the "existing cards" table above, append the story-evidence note to each
   card's body when it is next edited — do not open duplicate issues.
5. Do not invent new epic headers. Every gap here fits an existing epic.
