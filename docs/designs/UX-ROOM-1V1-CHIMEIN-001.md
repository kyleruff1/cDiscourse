# UX-ROOM-1V1-CHIMEIN-001 — 1:1-first room model + public chime-in rules

**Status:** Design draft (DESIGN / MODEL ASSESSMENT ONLY — no production code, no tests, no migration)
**Epic:** civildiscourse-v4 (Epic 16 — CivilDiscourse v4 UX overhaul)
**Release:** Backlog (P0 · effort L · lane UX-model)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/680

---

## 1. Summary

CivilDiscourse is **1:1-first**: every argument room is a structured 1:1 between two **principal voices**. This card maps that product rule against the *current codebase* and produces (a) an honest current-code assessment, (b) a **safe-now** UI/copy subset the code can support today with no backend change, (c) a **GATE-C** subset that requires backend/semantics work, and (d) a three-layer implementation DAG.

**The good news, surfaced up front:** the repo already carries the structural model this card needs. GAME-004 (`roomContractModel.ts`) gives a derived 1:1 contract with a distinct *open respondent/principal seat*. GAME-005 (`publicSeatModel.ts`) gives a derived, point-scoped, public-only chime-in layer with capacity (3 seats), observer fallback, and primary-only governance. ARG-ROOM-001/002/005/006 give persisted visibility (`debates.visibility`), a DB capacity trigger, an access/feed model, and a seat-availability preview. QOL-039/040 give a persisted public→private transition and chime-in-aware notifications. UX-MEDIATOR-005 already shipped a **dormant chime-in render slot** in the Disagreement Points rail explicitly waiting for *this* card's adapter.

**The honest gap, surfaced up front:** the four role distinctions the product rule needs — (1) active principal voices, (2) the open respondent/principal seat, (3) observers/readers, (4) bounded point-scoped chime-ins — are all *expressible in the current model layer*, but several are **not threaded into the live UI** and a few of the product rule's *semantics* are not what the shipped code does. Specifically:

- The live room header seat strip (`RoomContractSeatStrip` via `DebateDetailHeader`) defaults `roomType='public'` for *every* room (App.tsx never passes the persisted `visibility`), so even a private room shows "Open seat — first reply takes it". This is a **safe-now fix** — the data exists, it just is not wired.
- The chime-in model (`buildPublicRoomSeatMap`, `ChimeInGovernanceControl`, `PublicRoomMetricsStrip`) is **defined and tested but NOT mounted** in the live room (`ArgumentGameSurface` / App.tsx mount only `SeatAvailabilityStrip`). There is **no chime-in contribution composer anywhere** — `ChimeInGovernanceControl` is a *primary-only governance* control (react to existing chime-ins), not a way to author a chime-in.
- There is **no persisted chime-in role, column, capacity, or contribution write path**. `chime_in` is a *derived read-time role only* (never written to `debate_participants.side`). A point-scoped chime-in *contribution* surface is therefore **GATE-C**.
- The product rule "**private rooms have no observers**" (v4 index L196) **conflicts** with the shipped backend, where observers are first-class and uncapped in *all* rooms including private (migration `20260613000001` line 38). This is a genuine **operator decision** — do not silently change it.

### The four role distinctions

| # | Role | What it is | Current-code source of truth |
|---|---|---|---|
| 1 | **Active principal voices** (two) | The Initiator + the Primary Opponent. The 1:1. | `RoomContract.initiatorUserId` + `RoomContract.primaryOpponentUserId` (`roomContractModel.ts`) |
| 2 | **Open respondent/principal seat** | The *second principal* seat before it is claimed — a respondent seat, **NOT a chime-in**. | `RoomContract.primaryOpponentUserId === null` → `opponentSeat.isOpen` (`roomContractModel.ts:516-527`); persisted invite `intendedSeat: 'respondent' \| 'co_primary'` (`inviteModel.ts:25`) |
| 3 | **Observers / readers** | Uncapped, read-only. Includes `side='observer'` participants and pure (non-participant) readers. | `isActiveParticipantSide` excludes `observer` (`seatClaimModel.ts:66-70`); `canObserve` always true for a readable room (`roomAccessModel.ts`) |
| 4 | **Bounded point-scoped chime-ins** | Public-only, capped (3), attached to a point/branch, never a third principal voice, never the node's structural state. | `SeatRole='chime_in'` derived role (`publicSeatModel.ts:55`); capacity `PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT = 3` (`publicSeatModel.ts:67,73,538`) |

---

## 2. Current-code evidence section (cite file:line) + four halt-question verdicts

### What exists today (with file:line)

**Visibility (public/private) — PERSISTED + ENFORCED.**
- `debates.visibility: RoomVisibility = 'public' | 'private'` is a persisted column, backfilled to `'public'` (migration `20260524000015`; type `types.ts:10,29`).
- `roomVisibilityModel.ts` — pure model for the one-way public→private transition (`canTransitionToPrivate` :204; there is intentionally **no** `canTransitionToPublic`).
- `room_active_seat_cap(uuid)` SQL function: `CASE WHEN d.visibility = 'private' THEN 2 ELSE 5 END` (migration `20260613000001:101`). Cap is a *pure function of visibility* — no separate persisted seat-class column.
- `CreateDebateForm.tsx:108-131` — a working public/private radiogroup with helper copy (`ROOM_VISIBILITY_COPY.option_public_helper / option_private_helper`).
- `MakePrivateConfirmation.tsx` + `DebateDetailHeader.tsx:316-326` — private badge + make-private flow.

**Seat / capacity / principal-vs-observer — DERIVED + (partly) ENFORCED.**
- `roomContractModel.ts:36-47` — `RoomContract` with `initiatorUserId` and nullable `primaryOpponentUserId`. The two primary seats are `PrimarySeat = 'initiator' | 'primary_opponent'` (:29).
- `resolvePrimaryOpponent` (:338) — private rooms honor a recorded `invitedOpponentUserId`; public rooms (and private-without-invite) award the seat to the *first qualifying response* (`isQualifyingResponse` :283, anti-sniping gate).
- `buildRoomContractViewModel` (:489) — `opponentSeat.isOpen` true when the second principal seat is unclaimed; label `ROOM_CONTRACT_COPY.seatOpen = 'Open seat — first reply takes it'` (:107,519-527).
- `publicSeatModel.ts` — GAME-005 public seat layer. `PUBLIC_ROOM_SEAT_CAP = 5` (:67), `PRIMARY_SEAT_COUNT = 2` (:73) → chime-in capacity 3 (:538). `buildPublicRoomSeatMap` (:493) derives seats 1-2 (primaries) + 3-5 (chime-ins, first-qualifying-move order) + `movedToObserver` (overflow / governance) read-time.
- `roomCapacityModel.ts` — pure twin of the SQL trigger: `roomActiveSeatCap` (:42), `canJoinActive` (:95) = `active + reserved + 1 <= cap`, `openActiveSlots` (:117).
- `seatClaimModel.ts` — `isActiveParticipantSide` (:66, excludes `observer`), `deriveSeatAvailability` (:133), `buildSeatAvailabilityViewModel` (:279). Copy: `SEAT_CLAIM_COPY` (`gameCopy.ts:971`) incl. `readersNote: 'Readers do not use active seats'`, `youAreWatching: "You're watching."`.
- `roomAccessModel.ts:61-66` — `RoomAccessState = public_open | public_reserved | public_full | private_member | private_no_access`. Observers uncapped (`canObserve` always true). No-enumeration guarantee.
- Capacity ENFORCEMENT: `enforce_room_capacity()` BEFORE INSERT trigger on `debate_participants` (migration `20260613000001:17`) — but it caps *total active count only* (private 2 / public 5). It does **not** enforce a principal-vs-chime-in seat boundary; the seats 3-5 chime-in layout is GAME-005 read-time derivation only.

**Invite — PERSISTED, with intended-seat semantics.**
- `inviteModel.ts:25` — `IntendedSeat = 'respondent' | 'co_primary'`. `inviteApi.ts:177` defaults `'respondent'`.
- `create-argument-room/index.ts:53,121,166` — atomic create + one invite; `intendedSeat` defaults `'respondent'`, threaded to the RPC.
- Affordance: `DebateDetailHeader.tsx:380-393` overflow panel invite row; `INVITE_PANEL_COPY`.
- One direct invite at creation (`argumentRoomCreationMatrix.ts`); private requires exactly one (`private_requires_invite` :281).

**Chime-in (what exists already) — DERIVED MODEL + GOVERNANCE UI ONLY; NO contribution path; NOT mounted live.**
- `publicSeatModel.ts` — the full chime-in *seat-layout + governance* model (capacity 3, observer fallback, primary-only governance reactions `useful/off_track/needs_source/move_to_tangent`, `evaluateChimeInStanding` :395). **`chime_in` is a DERIVED role only — never written to `debate_participants.side`** (:32,52-55).
- `ChimeInGovernanceControl.tsx` — what it does today: a **primary-only governance control** (OP + Primary Opponent *react* to an existing chime-in branch). It has **no composer, no contribution path, no capacity claim** — it is "keep this chime-in on track" (:46), not "chime in". Read-time, no write path (:7-8).
- `PublicRoomMetricsStrip.tsx` — read-time seat/chime-in count strip.
- `useChimeInGovernance.ts` — in-session (ephemeral) governance reaction state, no I/O.
- **Mounting reality:** grep across `src/` shows `ChimeInGovernanceControl`, `PublicRoomMetricsStrip`, and `buildPublicRoomSeatMap` are referenced **only** by their own files, `index.ts` (barrel), the governance hook, and `publicSeatModel`/tests. They are **NOT mounted** in `ArgumentGameSurface.tsx` or `App.tsx`. Only `SeatAvailabilityStrip` is live (`ArgumentGameSurface.tsx:2775`).
- **No persistence:** no `chime` column or table in any migration. The QOL-040 notification ENUM carries `chime_in_posted` / `chime_in_rejected` *types* (migration `20260524000014:102-104`) and QOL-039 carries `rejected_chime_in_ids` (ARGUMENT ids, not user ids), but **no chime-in role/capacity/contribution is ever persisted**.
- **Dormant render slot (ready for this card):** `mediator/DisagreementPointsRail.tsx:90-106,607-770` ships an OPTIONAL `contributionKind?: 'principal' | 'chime_in'` anchor field and a render slot that draws a chime-in marker IFF the data is present — with the explicit comment "owned by UX-ROOM-1V1-CHIMEIN-001 (not yet shipped)... We NEVER synthesize the marker from absent data". This is the C-layer integration target.

**Gallery cards (public vs private) — ALREADY DISTINGUISHED.**
- `ConversationGalleryScreen.tsx:526-606` — derives a `RoomAccessView` per card; renders a public/private visibility pill (`gallery-card-visibility-*`), enumeration-safe (`private_no_access` shows an empty badge). Action labels `Observe → / Continue → / Open →` (`roomAccessModel.ts:75`).
- `conversationGalleryModel.ts` — `classifyCardToSection` routes private rooms to `my_rooms` (never a public lane).

**Copy mapping — established blocks (all ban-list scanned today).**
- `gameCopy.ts`: `ROOM_CONTRACT_COPY` (`roomContractModel.ts:101`), `SEAT_CLAIM_COPY` (:971), `CHIME_IN_GOVERNANCE_COPY` (:1333), `ROOM_VISIBILITY_COPY` (:1651), `ROOM_ACCESS_COPY` (:1731), `BRANCH_GRAMMAR_COPY` (:1296, incl. `direction_chime_in_vertical: 'Chime-in'`).
- `roomRoleDisplay.ts:41-46` — side labels: `affirmative→'For'`, `negative→'Against'`, `observer→'Watching'`, `moderator→'Host'` (the room host/creator seat).

**Tests that pin room capacity / invite / observer / participant copy (so the design knows what is frozen).**
- `__tests__/roomContractModel*.test.ts` (seat open/claimed, qualifying response).
- `__tests__/publicSeatModel*.test.ts` + `__tests__/chimeInGovernanceDoctrine.test.ts` (cap=5, chime-in capacity 3, governance, ban-list via `_forbiddenChimeInGovernanceTokens`).
- `__tests__/argumentRoomCreationMatrix.test.ts` (cap parity 5/2, private-requires-invite, ban-list incl. `challenger`/`opponent`).
- `__tests__/seatClaimModel*.test.ts` (active-side predicate, `_forbiddenSeatClaimTokens`).
- `__tests__/roomAccessModel.test.ts` (access states, no-enumeration, ban-list).
- `__tests__/roomVisibilityModel*.test.ts` (one-way transition, consequences).
- UX-SIMPLIFY-002A/002B tests pin `Host`/`Watching` labels + `readersNote`.
- A **capacity parity test** pins `PUBLIC_ROOM_SEAT_CAP === 5` and the matrix cap together (a 6→5 reconcile cannot half-land).

### The four halt-question verdicts

> **(a) Can the current code distinguish a PUBLIC vs PRIVATE room? — YES.**
> Persisted `debates.visibility` (`types.ts:29`, migration `20260524000015`), enforced by `room_active_seat_cap` (migration `20260613000001:101`), surfaced in the gallery (`ConversationGalleryScreen.tsx:531`) and create form (`CreateDebateForm.tsx:116-129`). *Caveat:* the live room **header seat strip** does not consume it — `useRoomContract` is called without `roomType` (`App.tsx:739-744`), so it defaults to `'public'` for every room. The distinction exists in data; it is just not threaded to that one surface. → **safe-now wiring**.

> **(b) Can the current code distinguish an ACTIVE participant from an OBSERVER? — YES.**
> `isActiveParticipantSide` (`seatClaimModel.ts:66-70`) is the pure twin of the SQL `side <> 'observer'` (migration `20260613000001:127`). Observers are uncapped and first-class; `youAreWatching` / `readersNote` copy already exists. `roomRoleDisplay.ts` maps `observer→'Watching'`, the active host seat `moderator→'Host'`.

> **(c) Can the current code distinguish an INVITE-RESERVED seat from an OPEN seat? — YES (with a viewer-visibility caveat).**
> Reserved invites are counted server-side (`count_reserved_invites`, migration `20260613000001:168`) and the access model has a `public_reserved` state (`roomAccessModel.ts:63`). **But by design (no-enumeration), a non-member viewer always passes `knownReservedInviteCount = 0`** (`App.tsx:760`, `seatClaimModel.ts:38-41`) so a hidden-reserved room and a genuinely-open room render IDENTICALLY to a public viewer. A creator/inviter/admin surface *can* see the real reserved count. The distinction exists; the *public view deliberately hides it*. Respect that — do not surface reserved-seat enumeration.

> **(d) Can the current code distinguish a PRINCIPAL RESPONDENT seat from a CHIME-IN? — YES for the SEAT MODEL; NO for a chime-in CONTRIBUTION path.**
> The respondent seat is `RoomContract.primaryOpponentUserId` with role `primary_opponent` (`roomContractModel.ts:29,36-47`); it is `isOpen` when null (:516) and is filled by the *first qualifying response*, NOT by a chime-in. Chime-ins are `SeatRole='chime_in'` (`publicSeatModel.ts:55`), strictly seats 3-5, explicitly excluded from the primary set (`publicSeatModel.ts:349-350`). So the *model* cleanly separates respondent-principal from chime-in.
> **HOWEVER:** there is **no chime-in contribution path** anywhere. `ChimeInGovernanceControl` is governance-only (no composer). No persisted chime-in role/capacity. The seat-layout model derives a `chime_in` role from an *already-posted* qualifying argument, but nothing in the product lets a user *deliberately chime in on a point* as a bounded, point-scoped contribution distinct from "just reply". **The chime-in CONTRIBUTION semantics do NOT exist and MUST NOT be faked — they are GATE-C** (see §6).

**Scope-halt summary:** Three of four distinctions (a, b, c) are fully present and (a) is a pure-wiring safe-now win. The fourth (d) is half-present: the *seat model* distinguishes respondent-principal from chime-in, but the *chime-in contribution* is absent and is marked GATE-C below. **Per the scope guard, no chime-in semantics are invented in the safe-now subset.**

---

## 3. Mapping table

One row per surface in the "Surfaces to inspect" list. Columns are abbreviated in the header for width; full names: Surface · Current implementation · Current room/seat model source · Current public/private copy · Current observer/principal distinction · Current open-seat behavior · Current invite behavior · Current capacity behavior · Proposed 1:1-first copy · Proposed chime-in copy · Private-room no-chime guard · Public respondent-seat-open state · Public 1:1-established state · Public chime-in-available state · Public chime-in-full state · Data/API touched (Y/N) · Room semantics touched (Y/N) · Safe-now UI/copy only (Y/N) · Requires backend/GATE-C (Y/N) · Implementation card dependency · Test coverage.

> Legend for the 6-state cells: each state cell says what the surface should show *in that state* and whether it is **safe-now** or **GATE-C**.

### Row 1 — Room creation / visibility selection (`CreateDebateForm.tsx`)
- **Current impl:** working public/private radiogroup + helpers.
- **Room/seat model source:** `argumentRoomCreationMatrix.deriveArgumentRoomCreation`, `ROOM_VISIBILITY_COPY`.
- **Public/private copy:** `option_public_helper` / `option_private_helper` (live).
- **Observer/principal distinction:** none at create (no seat exists yet).
- **Open-seat behavior:** n/a at create.
- **Invite behavior:** one direct invite (private requires it); `intendedSeat` defaults `'respondent'`.
- **Capacity behavior:** cap derived from visibility (5/2) at create.
- **Proposed 1:1-first copy:** clarify both helpers are 1:1-framed — public helper add "A public 1:1 — anyone can read and observe; once both seats are filled, point-scoped chime-ins may open."; private helper add "A private 1:1 — only the person you invite. No chime-ins."
- **Proposed chime-in copy:** mention only ("chime-ins may open" for public; "No chime-ins" for private). No chime-in *control* here.
- **Private no-chime guard:** copy-level only ("No chime-ins" in the private helper).
- **Respondent-seat-open / 1:1-established / chime-in-available / chime-in-full:** n/a (pre-creation).
- **Data/API:** N · **Room semantics:** N · **Safe-now:** Y · **GATE-C:** N.
- **Card dependency:** A-layer (UI/copy).
- **Test coverage:** extend `argumentRoomCreateCopyDoctrine.test.ts` ban-list over new helper strings; plain-language coverage.

### Row 2 — Room header / seat line (`DebateDetailHeader.tsx` → `RoomContractSeatStrip.tsx`)
- **Current impl:** seat strip in overflow panel; room-type glyph + two seat pills + turn label.
- **Room/seat model source:** `RoomContractViewModel` from `useRoomContract` — **defaulted `roomType='public'` because App.tsx omits it** (`App.tsx:739`).
- **Public/private copy:** room-type glyph 🔒/○ + `'Private room'`/`'Public room'` (`RoomContractSeatStrip.tsx:31`); but always shows public today.
- **Observer/principal distinction:** seat pills show `You`/`Initiator`/`Opponent`/`Open seat…`.
- **Open-seat behavior:** `seatOpen = 'Open seat — first reply takes it'`.
- **Invite behavior:** invite row sits in the same overflow panel.
- **Capacity behavior:** strip shows the two primary seats only (not chime-in seats).
- **Proposed 1:1-first copy:** thread persisted `visibility` into `useRoomContract` so a private room reads "Private 1:1"; relabel `seatOpen` to respondent/principal language: **"Respondent seat open"** (replaces "Open seat — first reply takes it"); room-type labels become **"Public 1:1" / "Private 1:1"**.
- **Proposed chime-in copy:** none on the header (chime-ins are a point-scoped surface, not header chrome).
- **Private no-chime guard:** when `roomType='private'`, render no chime affordance (the header never had one — no change needed, just must not add one).
- **Respondent-seat-open:** label **"Public 1:1 · respondent seat open"**; opponent pill shows "Respondent seat open".
- **1:1-established:** label **"Public 1:1 · 2 principal voices"** (both seats filled).
- **Chime-in-available / chime-in-full:** header does NOT change for these — chime-in state lives in the rail/node surface (GATE-C/C-layer).
- **Data/API:** N (reads already-loaded `debate.visibility`) · **Room semantics:** N · **Safe-now:** Y · **GATE-C:** N.
- **Card dependency:** A-layer. Feeds UX-ROOM-SEATLINE-001 (#681).
- **Test coverage:** new `roomContractModel` copy tests for respondent-seat labels; `useRoomContract` visibility-threading test; ban-list (no `challenger`/`opponent` — note the existing `ROOM_CONTRACT_COPY.seatOpponent = 'Opponent'` is currently allowed by *its* ban list but is on the **AVOID** list in §9; relabel to a role-neutral term — see Risks).

### Row 3 — InvitePanel / join panel (`DebateDetailHeader` overflow invite row + `InvitePanel`/`inviteApi`)
- **Current impl:** overflow invite row → invite panel; `intendedSeat` persisted.
- **Room/seat model source:** `inviteModel.IntendedSeat`, `INVITE_PANEL_COPY`.
- **Public/private copy:** invite is the private-room join path; public uses the open seat.
- **Observer/principal distinction:** invite targets a *respondent principal* (default `'respondent'`).
- **Open-seat behavior:** an invite *reserves* the respondent seat (public) or is required (private).
- **Invite behavior:** one per room.
- **Capacity behavior:** reserved seat counted server-side; hidden from public viewers.
- **Proposed 1:1-first copy:** frame the invite as "Invite the other principal voice" (a respondent), never "invite to chime in".
- **Proposed chime-in copy:** none — invites are never chime-in invites.
- **Private no-chime guard:** copy makes explicit the invitee is the *respondent principal*, not a chime-in.
- **States:** respondent-seat-open → invite is the way to fill it; 1:1-established → invite already consumed; chime-in states → invite unaffected.
- **Data/API:** N (copy only) · **Room semantics:** N · **Safe-now:** Y (copy) · **GATE-C:** N.
- **Card dependency:** A-layer.
- **Test coverage:** invite copy ban-list (`argumentRoomCreateCopyDoctrine`-style).

### Row 4 — Public room gallery cards (`ConversationGalleryScreen.tsx`)
- **Current impl:** per-card access view + visibility pill + action label.
- **Room/seat model source:** `roomAccessModel.deriveRoomAccessView`.
- **Public/private copy:** `accessView.badgeLabel` (public pill); action `Observe →/Continue →/Open →`.
- **Observer/principal distinction:** observe-friendly framing; full room still observable.
- **Open-seat behavior:** `public_open` → "Open seat — observe or step in." (`ROOM_ACCESS_COPY.public_open_line`).
- **Invite behavior:** reserved hidden from non-members.
- **Capacity behavior:** `public_full` → observe-only line.
- **Proposed 1:1-first copy:** public card may carry a "1:1" framing chip; relabel `public_open_line` from "Open seat — observe or step in." → **"Respondent seat open — observe or take it."**
- **Proposed chime-in copy:** optional small "chime-ins open" affordance ONLY when the room is past both-seats AND has open chime-in seats — but the gallery card cannot compute that without the seat map, so **defer to GATE-C/C-layer**; safe-now is the respondent-seat copy only.
- **Private no-chime guard:** private cards already routed to `my_rooms`; no chime affordance — no change.
- **Respondent-seat-open:** "Respondent seat open" framing (safe-now).
- **1:1-established / chime-in-available / chime-in-full:** would need the seat map at the card → GATE-C/C-layer.
- **Data/API:** N · **Room semantics:** N · **Safe-now:** Y (respondent copy) · **GATE-C:** partial (chime-in card chips).
- **Card dependency:** A-layer (copy) + C-layer (chime-in chips).
- **Test coverage:** `roomAccessModel.test.ts` copy update + ban-list.

### Row 5 — Private room gallery cards (`ConversationGalleryScreen.tsx` + `conversationGalleryModel.classifyCardToSection`)
- **Current impl:** private cards routed to `my_rooms`; enumeration-safe empty badge for non-members.
- **Room/seat model source:** `roomAccessModel` (`private_member` / `private_no_access`).
- **Public/private copy:** `private_member_line = 'Private — you are in this argument.'`; `private_no_access` → cause-neutral, no "Private".
- **Observer/principal distinction:** member sees private chrome; non-member sees nothing (no enumeration).
- **Open-seat behavior:** private 1:1 — the respondent is the invitee.
- **Invite behavior:** invite required at creation.
- **Capacity behavior:** cap 2.
- **Proposed 1:1-first copy:** `private_member_line` → **"Private 1:1 — you are in this argument."** (1:1 framing).
- **Proposed chime-in copy:** explicit ABSENCE — no chime affordance ever.
- **Private no-chime guard:** structural — private cards never render a chime CTA (already true; assert with a test).
- **States:** respondent-seat-open (private) = invitee not yet joined → member view only; others n/a.
- **Data/API:** N · **Room semantics:** N · **Safe-now:** Y · **GATE-C:** N.
- **Card dependency:** A-layer.
- **Test coverage:** `roomAccessModel.test.ts`; assert private path renders no chime CTA.

### Row 6 — Selected-node actions (`ArgumentSideActionRail.tsx`, Act/Inspect via `ArgumentGameSurface`)
- **Current impl:** observer dock with `Watch · Join For · Join Against · Ask source · Open timeline · Share`; participant set per CLAUDE.md Stage 6.4.
- **Room/seat model source:** `ArgumentSideActionRail` props (`canClaimActiveSeat`, `fullRoomNotice`).
- **Public/private copy:** full-room nudge `fullRoomNotice` (verdict-free).
- **Observer/principal distinction:** observer dock collapsed by default; participant dock differs.
- **Open-seat behavior:** Join For/Against disabled when `canClaimActiveSeat===false`.
- **Invite behavior:** invite lives in the header, not the node rail.
- **Capacity behavior:** seat-full disables join + shows the watch nudge.
- **Proposed 1:1-first copy:** when the *respondent* seat is the one being claimed, the join action could read "Take the respondent seat" (a principal action) instead of generic "Join For/Against" — **but** this couples to the 1:1 turn/seat state and the existing Join For/Against side-choice; treat as **GATE-C/seatline card** (UX-ROOM-SEATLINE-001), not safe-now, to avoid faking the seat-state binding in the rail.
- **Proposed chime-in copy:** a node-scoped "Chime in on this point" action — **GATE-C** (needs the contribution path + capacity).
- **Private no-chime guard:** never render a chime action in a private room — GATE-C guard (rail does not know visibility today; would need threading + capacity).
- **Respondent-seat-open:** "Take the respondent seat" (GATE-C/seatline — binds to seat state).
- **1:1-established:** standard reply/disagree (participant) — current behavior.
- **Chime-in-available:** node-scoped "Chime in on this point · N seats open" — GATE-C.
- **Chime-in-full:** "Chime-in seats full · observing open" — GATE-C.
- **Data/API:** chime-in contribution = Y (GATE-C) · **Room semantics:** Y (chime-in capacity/role) · **Safe-now:** N (for chime/respondent actions) · **GATE-C:** Y.
- **Card dependency:** B-layer (semantics) then C-layer (rail wiring); the respondent-seat action belongs to UX-ROOM-SEATLINE-001.
- **Test coverage:** (GATE-C) chime-in action gating; private-no-chime guard.

### Row 7 — Disagreement Points rail dormant chime-in slot (`mediator/DisagreementPointsRail.tsx`)
- **Current impl:** OPTIONAL `contributionKind?: 'principal' | 'chime_in'` anchor field + dormant render slot (`:99-106, 607-770`). Renders a chime-in marker IFF the data is present; today always absent → renders nothing.
- **Room/seat model source:** the anchor's `contributionKind` (unfilled — "supplied later by UX-ROOM-1V1-CHIMEIN-001 / its adapter").
- **Public/private copy:** rail is read-only for observers + participants.
- **Observer/principal distinction:** marker is *visually subordinate* to the principal voices (muted, by design).
- **Open-seat behavior:** n/a (point-level).
- **Invite behavior:** n/a.
- **Capacity behavior:** n/a at the slot (the producer would feed capacity).
- **Proposed 1:1-first copy:** `DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker` already exists (the dormant marker text).
- **Proposed chime-in copy:** the marker reads as a *point-scoped chime-in attached to a point*, subordinate to the two principal voices.
- **Private no-chime guard:** the adapter must never set `contributionKind='chime_in'` for a private room.
- **Respondent-seat-open / 1:1-established:** no marker.
- **Chime-in-available:** a "chime in on this point" affordance could attach here — GATE-C.
- **Chime-in-full:** no new markers; observe-only.
- **Data/API:** the *adapter* that fills `contributionKind` = derives from the seat map (read-time) → could be N for *rendering an existing* derived chime-in, but a *contribution* path is Y · **Room semantics:** Y (contribution) · **Safe-now:** N · **GATE-C:** Y.
- **Card dependency:** C-layer (after B). This is the canonical C-layer integration target.
- **Test coverage:** (C-layer) adapter maps GAME-005 `chime_in` seats → `contributionKind`; marker renders; private rooms never emit the marker.

### Row 8 — Open Issues bottom chrome (`BoardBottomChrome` / Open Issues, ref UX-BOARD-RAIL-004)
- **Current impl:** Open Issues + seat + side action grouping wrapper (commit `25e22d2`).
- **Room/seat model source:** seat strip + side action.
- **Public/private copy:** inherits seat strip.
- **Observer/principal distinction:** seat line distinguishes active vs watching.
- **Open-seat behavior:** inherits respondent-seat copy from Row 2.
- **Invite behavior:** n/a here.
- **Capacity behavior:** inherits seat availability.
- **Proposed 1:1-first copy:** ensure the grouped seat line reflects "respondent seat open" / "2 principal voices" once Row 2 lands (consume, not re-author).
- **Proposed chime-in copy:** chime-in count could surface here ("N people chiming in") — GATE-C/C-layer once the seat map is mounted.
- **Private no-chime guard:** no chime count for private rooms.
- **States:** consume from Row 2 (respondent/established) safe-now; chime-in count states GATE-C.
- **Data/API:** N (consume) · **Room semantics:** N · **Safe-now:** Y (seat-line copy reuse) · **GATE-C:** partial (chime count).
- **Card dependency:** A-layer (reuse) + C-layer (chime count).
- **Test coverage:** snapshot of grouped seat line in the two safe-now states.

### Row 9 — Observer / active participant / invited seat / open seat copy (`gameCopy.ts` blocks + `roomRoleDisplay.ts`)
- **Current impl:** `ROOM_CONTRACT_COPY`, `SEAT_CLAIM_COPY`, `ROOM_ACCESS_COPY`, `roomRoleDisplay`.
- **Room/seat model source:** the copy blocks themselves.
- **Public/private copy:** `'Private room'/'Public room'`, access lines.
- **Observer/principal distinction:** `'Watching'` (observer), `'Host'` (creator seat), `'You'/'Initiator'/'Opponent'`.
- **Open-seat behavior:** `seatOpen`, `public_open_line`.
- **Invite behavior:** invite copy in `INVITE_PANEL_COPY`.
- **Capacity behavior:** `readersNote`, `activeSeatsSummary`.
- **Proposed 1:1-first copy:** introduce a small new copy block (or extend `ROOM_CONTRACT_COPY`) with the §9 allowed vocabulary: `Public 1:1`, `Private 1:1`, `2 principal voices`, `Respondent seat open`, `Observers watching`, `Readers do not use active seats` (reuse). Relabel `seatOpponent` away from "Opponent".
- **Proposed chime-in copy:** reuse `CHIME_IN_GOVERNANCE_COPY` + `BRANCH_GRAMMAR_COPY.direction_chime_in_vertical`; add point-scoped chime-in copy ("Point-scoped chime-in", "Attach to this point", "Does not open a seat", "Chime-in seats full · observing open") — the *copy* is safe-now; the *controls* are GATE-C.
- **Private no-chime guard:** copy block documents that chime-in copy is public-only.
- **States:** all six states' copy can be authored safe-now (copy != behavior).
- **Data/API:** N · **Room semantics:** N · **Safe-now:** Y (copy authoring) · **GATE-C:** N (controls that *use* the chime copy are GATE-C).
- **Card dependency:** A-layer (copy authoring), consumed by A and C.
- **Test coverage:** plain-language coverage + ban-list over every new string; `looksLikeInternalCode` false.

### Row 10 — Current capacity model / participant-side model (`publicSeatModel.ts`, `roomCapacityModel.ts`, `seatClaimModel.ts`, `argumentRoomCreationMatrix.ts`)
- **Current impl:** full derived seat math + DB trigger twin.
- **Room/seat model source:** these modules.
- **Public/private copy:** n/a (model).
- **Observer/principal distinction:** `isActiveParticipantSide`; primary set in `publicSeatModel`.
- **Open-seat behavior:** `primaryOpponentUserId===null`; `openActiveSlots`.
- **Invite behavior:** reserved-seat math.
- **Capacity behavior:** cap 5/2 (one source of truth); chime-in capacity 3 (derived).
- **Proposed 1:1-first copy:** n/a (model).
- **Proposed chime-in copy:** n/a.
- **Private no-chime guard:** a new pure predicate `chimeInAllowed(roomType)` = `roomType==='public'` (safe-now — a pure boolean over existing visibility). This is the *guard*, not a contribution path.
- **Respondent-seat-open:** model already expresses it (`isOpen`).
- **1:1-established:** both primaries set.
- **Chime-in-available / chime-in-full:** `openChimeInSeatCount` (`publicSeatModel.ts:162,599`) already computes it — but only meaningful once the seat map is mounted + a contribution path exists.
- **Data/API:** N (pure model) · **Room semantics:** the *guard* is N (boolean over existing data); a *contribution capacity* enforcement is Y/GATE-C · **Safe-now:** Y (the `chimeInAllowed` guard predicate + a pure R1-R7 state model) · **GATE-C:** Y (contribution capacity enforcement, persistence).
- **Card dependency:** A-layer can ship the pure R1-R7 state machine + guards (model-only, the issue's stated acceptance "a pure model expresses R1-R7"); B-layer adds persistence/enforcement.
- **Test coverage:** **this is where the issue's required R1-R7 pure-model tests live** — see §5 + Test plan.

### Row 11 — Tests that pin room capacity / invite / observer / participant copy
- **Current impl:** the suites listed in §2.
- **Source:** `__tests__/*`.
- **Public/private copy:** ban-list tests pin every visible string.
- **Observer/principal distinction:** pinned (`Host`/`Watching`/active-side).
- **Open-seat behavior:** `roomContractModel` tests pin `seatOpen`.
- **Invite behavior:** matrix tests pin private-requires-invite.
- **Capacity behavior:** parity test pins cap 5/2.
- **Proposed 1:1-first copy:** any relabel of `seatOpen`/`seatOpponent` will **break the existing `roomContractModel` snapshot/string tests** — those tests must be updated in lockstep (Risks).
- **Proposed chime-in copy:** new chime-in copy needs new ban-list coverage.
- **Private no-chime guard:** add a test asserting private path emits no chime CTA.
- **States:** the R1-R7 model gets a per-transition test (issue acceptance).
- **Data/API:** N · **Room semantics:** N · **Safe-now:** Y (tests ship with A-layer) · **GATE-C:** N.
- **Card dependency:** ships with each layer.
- **Test coverage:** itself — the test plan.

---

## 4. The 6 required design states (exact labels + copy)

> All copy below is run against the §9 ban-list and confirmed clean (see §9).

**State 1 — Private 1:1.**
- Label: **"Private 1:1"**.
- No chime-in CTA. Do **NOT** render a disabled chime-in control (absence, not a greyed control).
- Invited parties only. Header room-type reads "Private 1:1"; private badge present.
- Copy (private helper / member line): "A private 1:1 — only the person you invite. No chime-ins."
- Source today: `debate.visibility === 'private'` (persisted). **Safe-now** (header wiring + copy).

**State 2 — Public room, respondent seat open.**
- Label: **"Public 1:1 · respondent seat open"**.
- CTA uses respondent/principal language: **"Take the respondent seat."** — NOT "chime in".
- Copy (seat strip / access line): "Respondent seat open — observe or take it."
- Source today: `roomType='public'` + `opponentSeat.isOpen` (`roomContractModel.ts:516`). The **copy/label is safe-now**; the *active "Take the respondent seat" claim binding in the node rail* is GATE-C/seatline (it binds to seat-claim semantics). Header label + access line are safe-now.

**State 3 — Public room, 1:1 established.**
- Label: **"Public 1:1 · 2 principal voices"**.
- Observers are listed **separately** from the two active voices ("Observers watching").
- No chime-in surface unless the room state allows it (i.e. only when chime-in seats are open AND the contribution path exists — GATE-C).
- Copy: "2 principal voices · Observers watching".
- Source today: both `primaryOpponentUserId` set. Header label + observer/active separation are **safe-now** (the data exists). Chime-in opening is GATE-C.

**State 4 — Public room, chime-in available.**
- Label: **"Point-scoped chime-ins available"**.
- A chime-in **attaches to a point**; it does **NOT** become a principal seat; it does **NOT** open a general comment thread.
- Copy: "Point-scoped chime-in · Attach to this point · Does not open a seat".
- Source today: `openChimeInSeatCount > 0` on a mounted seat map (`publicSeatModel.ts:162`) — but the *contribution* path is absent. **GATE-C** (the available-state *copy* is safe-now to author; the *control* is GATE-C).

**State 5 — Public room, chime-in full.**
- Label: **"Chime-in seats full · observing open"**.
- No new active chime-ins. Observing remains (observers uncapped).
- Copy: "Chime-in seats full · observing open" + reuse `overflow_observer_body` family.
- Source today: `openChimeInSeatCount === 0` (`isCapReached` / capacity 3 consumed). **GATE-C** (depends on the mounted seat map + contribution path; the copy is safe-now to author).

**State 6 — Chime-in contribution.**
- A chime-in is **attached to a node/point**, **visually subordinate** to the two principal voices, **not** a third principal voice, **not** a generic reply thread.
- Render target: the `mediator/DisagreementPointsRail.tsx` dormant marker (`contributionKind='chime_in'`) + (later) a selected-node chime-in card.
- Copy: `DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker` (already shipped, dormant) + "Attach to this point · Does not open a seat".
- Source today: the dormant slot exists; **the producer/contribution path does NOT. GATE-C.**

---

## 5. Safe-now UI/copy subset (no backend; states the code can already distinguish today)

Each item below is pure UI/copy on a distinction the code can already make. **None invents chime-in semantics.**

1. **Thread persisted `visibility` into the room header seat strip** — pass `currentDebate.visibility` as `useRoomContract({ ..., options: { roomType: visibility } })` (`App.tsx:739`). Today it defaults to `'public'` for every room. *Why no backend:* `debate.visibility` is already loaded in `App.tsx`; this is pure prop threading. → unlocks States 1 & 2 labels.
   - Files: `App.tsx` (pass option), `useRoomContract.ts` (already accepts `options.roomType`), no model change.

2. **Relabel the open-seat label to respondent/principal language** — `ROOM_CONTRACT_COPY.seatOpen` "Open seat — first reply takes it" → **"Respondent seat open"**; room-type labels `'Public room'/'Private room'` → **"Public 1:1"/"Private 1:1"**; relabel `seatOpponent` "Opponent" → role-neutral (e.g. "Other voice" / "Second voice"). *Why no backend:* copy only. → States 1, 2, 3.
   - Files: `roomContractModel.ts` (`ROOM_CONTRACT_COPY`), `RoomContractSeatStrip.tsx` (glyph text branch reads "Private 1:1"). Tests: update `roomContractModel` string tests in lockstep.

3. **Private-room no-chime affordance = simply never render a chime CTA** — assert structurally (the header/rail never adds a chime control in a private room). *Why no backend:* the guard is "render nothing" — no control to disable, no data needed beyond `visibility`. → State 1.
   - Files: documented as an invariant + a guard predicate `chimeInAllowed(roomType) = roomType === 'public'` (pure, in `publicSeatModel.ts` or a small new `oneToOneRoomModel.ts`). Test: private path emits no chime CTA.

4. **Observer/principal seat-line wording** — separate "2 principal voices" from "Observers watching" in the seat line, reusing `SEAT_CLAIM_COPY.readersNote` + `youAreWatching`. *Why no backend:* `isActiveParticipantSide` + counts already exist. → State 3.
   - Files: `seatClaimModel.ts` view-model copy or a new copy block; `SeatAvailabilityStrip.tsx`/`RoomContractSeatStrip.tsx` consume.

5. **Gallery + access-line respondent copy** — `ROOM_ACCESS_COPY.public_open_line` "Open seat — observe or step in." → **"Respondent seat open — observe or take it."**; `private_member_line` → "Private 1:1 — you are in this argument." *Why no backend:* copy only on existing `RoomAccessState`. → States 2, 5 (private).
   - Files: `gameCopy.ts` (`ROOM_ACCESS_COPY`), tests `roomAccessModel.test.ts`.

6. **Create-form 1:1 framing** — extend `option_public_helper`/`option_private_helper` with the 1:1 + chime-in-mention copy (§3 Row 1). *Why no backend:* copy only. → States 1, 2.
   - Files: `gameCopy.ts` (`ROOM_VISIBILITY_COPY`), tests `argumentRoomCreateCopyDoctrine.test.ts`.

7. **Author the point-scoped chime-in COPY block** (not controls) — a frozen copy block with the §9 allowed vocabulary ("Point-scoped chime-in", "Attach to this point", "Does not open a seat", "Chime-in seats full · observing open", "Observe only"). *Why no backend:* authoring strings + ban-list tests is pure. The *controls that use them* are GATE-C; the strings are safe-now so the GATE-C card consumes a pre-tested vocabulary. → States 4, 5, 6 copy.
   - Files: `gameCopy.ts` new block; ban-list + plain-language tests.

8. **(Issue acceptance) A pure R1-R7 state model** — a new pure-TS `oneToOneRoomModel.ts` expressing the R1-R7 states + transitions + the two guards (private-no-chime, seats-full-observe-only) **as a read-only projection over the EXISTING derived data** (`RoomContract` + `PublicRoomSeatMap`). *Why no backend:* it composes already-derived inputs; it adds no write path and no new persisted field; it never *enables* a chime-in, it only *describes* the state. This satisfies the issue's "a pure model expresses the R1-R7 states with tests for each" without faking the contribution path.
   - Files: new `src/features/debates/oneToOneRoomModel.ts`; tests `__tests__/oneToOneRoomModel.test.ts`.

**Recommended next implementation card = the safe-now subset above (items 1-8), NOT "build chime-ins".** Suggested code/title: `UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room model (pure) + header/gallery/copy clarification (UI/copy-only, no backend)`.

---

## 6. GATE-C subset (requires backend/semantics — NO authorization in this card)

Each item states *why* it is GATE-C and *what data model* it needs. **None of these is invented in the safe-now subset.**

1. **A point-scoped chime-in CONTRIBUTION path.** *Why GATE-C:* no contribution write path exists — `ChimeInGovernanceControl` is governance-only; a chime-in is currently only *derived* from an already-posted qualifying argument, not a deliberate bounded point-scoped contribution. *Data model needed:* either (a) a new `argument` subtype/flag marking a move as a point-scoped chime-in attached to a target node, or (b) a new `chime_ins` table (argumentId, debateId, targetNodeId, authorId, createdAt) with RLS (insert-by-author, public-room-only, select-by-room-readers). Submission still goes through the deterministic `submit-argument` gate — chime-ins **never** bypass it. Likely a new/extended Edge path; operator-gated deploy.

2. **Backend chime-in CAPACITY enforcement.** *Why GATE-C:* the DB trigger (`enforce_room_capacity`) enforces *total active count* (private 2 / public 5), **not** a principal-vs-chime-in seat boundary. The GAME-005 chime-in capacity (3) is read-time only — nothing stops the 4th chime-in at the DB. *Data model needed:* a server-side capacity check (extend `enforce_room_capacity` or a new trigger/RPC) that distinguishes principal seats from chime-in seats and caps chime-ins at 3 for public rooms, 0 for private. Migration + operator deploy.

3. **Persisted chime-in ROLE (optional, if (1) chooses persistence).** *Why GATE-C:* `chime_in` is deliberately a derived role today (never written to `debate_participants.side`, whose CHECK is affirmative/negative/observer/moderator). Persisting it changes a constrained column or adds a table. *Data model needed:* a new column/table + RLS + migration; respects the no-service-role-in-client rule.

4. **RLS / migration / Edge changes for the contribution path.** *Why GATE-C:* any new table/column needs RLS (insert-by-author, public-only, no service-role in client) + a migration + possibly an Edge Function. Operator runs `npx supabase db push --linked` + (if new fn) `functions deploy`.

5. **Notification semantics for chime-ins.** *Why GATE-C:* the ENUM types `chime_in_posted` / `chime_in_rejected` exist (migration `20260524000014`) but no producer fires them for a *contribution*. *Data model needed:* the contribution path emits the notification; QOL-040 `room-notifications` already accepts the type. Edge + operator deploy.

6. **The node-rail "Chime in on this point" control + "Take the respondent seat" claim binding.** *Why GATE-C:* these bind to seat-claim semantics + the contribution path. The *labels/copy* are safe-now (§5.7); the *active controls* require (1)-(2). The respondent-seat claim action belongs to **UX-ROOM-SEATLINE-001 (#681)**; the chime-in control to the B/C layers here.

7. **Private-room observer policy decision** (see §7 OD-1) — if the operator rules "private rooms have no observers" (v4 index L196), that is a **backend semantics change** (the trigger + RLS currently allow private observers). GATE-C.

---

## 7. Open operator decisions

- **OD-1 — Do private rooms have observers?** The v4 design package (index L196) says **private rooms have no observers**. The shipped backend says observers are **uncapped and first-class in all rooms** (migration `20260613000001:38`; `roomAccessModel` `private_member`). These conflict. The safe-now subset does NOT change this (it leaves private observers as-is per the shipped code). **Decision needed:** keep shipped behavior (private observers allowed) vs adopt the v4 rule (no private observers → GATE-C backend change). **Recommendation:** keep shipped behavior for now; if the v4 rule is adopted, file it as an explicit GATE-C semantics card.

- **OD-2 — Chime-in capacity number.** GAME-005 ships chime-in capacity **3** (cap 5 − 2 principals), reconciled from an earlier 6→5. Confirm 3 is the v4 number before any B-layer enforcement is built.

- **OD-3 — Does the respondent seat auto-lock?** Today the respondent seat is filled by the *first qualifying response* (public) or the invitee (private), and GAME-004 has an advisory `isPrimaryOpponentSeatStale` (72h) but **no** auto-reopen/auto-lock. Confirm whether the v4 model wants the respondent seat to auto-lock after claim (it effectively does — there is no re-open write path) and whether stale-seat re-open is in scope (it is a separate card).

- **OD-4 — Chime-in contribution persistence shape.** If/when B-layer is authorized: a new `chime_ins` table vs an `arguments` subtype/flag. Affects RLS + migration shape (§6.1/6.3).

- **OD-5 — Respondent/"Opponent" relabel wording.** The safe-now copy relabels `seatOpponent='Opponent'` (on the §9 AVOID list) to a role-neutral term. Confirm the exact word ("Other voice" / "Second voice" / "Respondent"). The existing `_forbidden*` ban lists already forbid `challenger`/`opponent` for *other* blocks — `ROOM_CONTRACT_COPY` is the one block that still uses "Opponent" and should be brought in line.

---

## 8. Recommended implementation DAG (three layers)

**Layer A — UI/copy clarification only (independent; ship first).**
- Thread persisted `visibility` into the room header seat strip (§5.1).
- Respondent/principal + "Public 1:1"/"Private 1:1" relabels (§5.2).
- Private-room no-chime affordance = render nothing + `chimeInAllowed` guard predicate (§5.3).
- Observer/principal seat-line separation (§5.4).
- Gallery + access-line respondent copy (§5.5).
- Create-form 1:1 framing (§5.6).
- Author the point-scoped chime-in COPY block (§5.7).
- Pure R1-R7 state model + per-transition tests + two guards (§5.8) — **satisfies the issue's pure-model acceptance**.
- **Depends on:** nothing (independent). **Output card:** `UX-ROOM-1V1-CHIMEIN-001A` (UI/copy + pure model, no backend, automerge-eligible once green).

**Layer B — model/semantics GATE-C (operator-gated; preceded by the semantics-assessment, which IS this doc).**
- Chime-in contribution path (write path; through `submit-argument`'s deterministic gate) (§6.1).
- Backend chime-in capacity enforcement (principal-vs-chime-in boundary, cap 3 public / 0 private) (§6.2).
- Persisted chime-in role/table + RLS + migration (§6.3, §6.4).
- Notification semantics for chime-in contributions (§6.5).
- Private-observer policy if OD-1 adopts the v4 rule (§6.7).
- **Depends on:** A (consumes the copy block + guard + state model). **Operator-gated; no automerge.**

**Layer C — visual integration after semantics (depends on B).**
- Activate the Disagreement Points rail dormant chime-in slot via an adapter that fills `contributionKind` from the mounted GAME-005 seat map (§3 Row 7).
- Selected-node chime-in card rendering ("Chime in on this point · N seats open" control + contribution card) (§3 Row 6).
- Mount `PublicRoomMetricsStrip` / chime-in count in the bottom chrome (§3 Row 8).
- Board topology adjustments (if any) so chime-ins render subordinate to the two principal voices.
- **Depends on:** B (the contribution path + capacity must exist before the UI can drive them). **Operator-gated alongside B.**

```
A (UI/copy + pure R1-R7 model)  ──independent──▶ ship first (next card)
        │
        ▼ (copy block + guard + state model consumed by)
B (chime-in contribution + capacity + RLS/migration/Edge + notifications)  ──operator-gated──
        │
        ▼
C (rail slot activation + selected-node chime card + metrics mount + topology)  ──operator-gated──
```

---

## 9. Copy compliance

**Allowed vocabulary used:** Public 1:1 · Private 1:1 · 2 principal voices · Respondent seat open · Observers watching · Point-scoped chime-in · Attach to this point · Does not open a seat · Observe only · Readers do not use active seats. ✔ all used above.

**Banned vocabulary (must not appear in proposed copy):** comment · pile on · audience · forum · join the debate · open mic · third side · winner · loser · score · verdict · AI decides · fallacy · wrong · dishonest · bad faith · manipulative.

**Ban-list run over my proposed NEW copy strings** ("Respondent seat open", "Public 1:1", "Private 1:1", "Respondent seat open — observe or take it.", "Private 1:1 — you are in this argument.", "Take the respondent seat.", "2 principal voices · Observers watching", "Point-scoped chime-in · Attach to this point · Does not open a seat", "Chime-in seats full · observing open", "A public 1:1 — anyone can read and observe; once both seats are filled, point-scoped chime-ins may open.", "A private 1:1 — only the person you invite. No chime-ins."): **CLEAN — zero banned tokens.**

- Note the deliberate avoidance of "comment thread" (used only to say what a chime-in is NOT, never as product copy), "audience" (→ "Observers"/"Readers"), "join the debate" (→ "Take the respondent seat" / "observe or take it"), "third side"/"open mic" (→ "Point-scoped chime-in · Does not open a seat").
- **One existing-copy flag:** `ROOM_CONTRACT_COPY.seatOpponent = 'Opponent'` is on the §9 AVOID list. The safe-now subset (§5.2) relabels it (OD-5). The other `_forbidden*` ban lists already forbid `opponent`/`challenger` for sibling blocks; this brings `ROOM_CONTRACT_COPY` into line.

---

## 10. Doctrine self-check + halt-condition results

**`cdiscourse-doctrine`:**
- §1 Score is never truth: no proposed string labels a person/claim winner/loser/correct/true/false. Chime-in is a *participation structure*, not a verdict. ✔
- §1 Score never blocks posting: chime-ins (if B-layer ships) go through the deterministic `submit-argument` gate; score/standing never gates them. ✔
- §2/§3 Heat/popularity not evidence: seat assignment + chime-in order are first-qualifying-move chronology only; no heat/popularity input (`publicSeatModel` imports nothing from score/heat). ✔
- §4 AI moderator limits: nothing here gives AI/MCP authority over who may chime in. The deterministic engine remains the sole submission gate (restated). ✔
- §5 Engine sacred: no change to `src/domain/constitution/engine.ts`. ✔
- §6/§7 Secrets / no client AI: no AI calls, no secrets, no service-role in client; GATE-C Edge work uses caller-scoped clients per `supabase-edge-contract`. ✔
- §8 Supabase conventions: any B-layer migration is append-only, RLS-on, soft-delete only; no service-role in client. ✔
- §9 Plain language: every new string maps through the copy blocks; no internal code leaks; new chime-in copy gets `looksLikeInternalCode`-false coverage. ✔
- §10/§10a Observations vs Allegations: the chime-in marker is a *machine-derived* structural Observation (seat role), not a person allegation; renders subordinate, never accusatory. ✔
- §10 v1 scope: **no voting/scoring-winner, no real-time body editing, no OAuth, no public API, no push notifications, no argument search.** Chime-in is a bounded structured contribution, NOT a comment thread / social feed (explicitly forbidden framing). ✔

**`supabase-edge-contract`:** no service-role in client; chime-in writes (B-layer) go through an Edge/`submit-argument` path; RLS append-only; soft-delete only; deploy steps are operator-run. ✔ (this card writes none of it.)

**`expo-rn-patterns` / `accessibility-targets`:** safe-now is copy + prop threading + a pure model — no new deps; any C-layer control must carry role+label+state, 44×44 hit target, color-independent shape, reduce-motion. ✔ (documented for the C-layer card.)

**`test-discipline`:** the safe-now card ships the R1-R7 pure-model tests + copy ban-list + private-no-chime guard test + relabel-lockstep test updates as part of "done", not a follow-up. ✔

### Halt-condition results
- Public-vs-private: **NOT halted** — distinguishable (persisted `visibility`).
- Active-vs-observer: **NOT halted** — distinguishable (`isActiveParticipantSide`).
- Invite-reserved-vs-open-seat: **NOT halted** — distinguishable server-side; public view deliberately hides reserved (respect no-enumeration).
- Principal-respondent-vs-chime-in: **PARTIALLY halted for CONTRIBUTION** — the *seat model* distinguishes them, but the *chime-in contribution path does not exist*. Per the scope guard, chime-in contribution semantics are **marked GATE-C and NOT faked** (§6). The safe-now subset ships only the copy/label/guard/state-model that the current code already supports.

---

## 11. Operator steps (if any)

**For the recommended next card (Layer A — safe-now UI/copy + pure model):** **None — pure code change.** No migration, no Edge deploy, no env var. App-side copy + prop threading + a pure model + tests only.

**For Layer B / C (GATE-C, when authorized):** operator runs `npx supabase db push --linked` (chime-in capacity/table migration) and, if a new/changed Edge Function is introduced, `npx supabase functions deploy <name> --linked`. These are **not** part of this card and **not** part of the recommended next card.

---

## Appendix — Brief interpretive notes (orchestrator-context)

- This card's issue (#680) is operator-filed (the v4 slate). The brief named several files at paths that differ from the live tree; the live paths used are: `RoomContractSeatStrip.tsx` (in `src/features/debates/`, not `src/features/arguments/`), `DebateDetailHeader.tsx` (in `src/features/debates/`), and the dormant chime-in slot is in `src/features/mediator/DisagreementPointsRail.tsx` (not `src/features/arguments/`). No `ArgumentGameSurface.tsx` chime-in slot exists; its only seat surface is `SeatAvailabilityStrip` (line 2775).
- Resolved by orchestrator default (flagged for operator review): the respondent/"Opponent" relabel wording (OD-5) and whether the safe-now subset should relabel `seatOpponent` now or defer to the seatline card. Recommendation: relabel now (it is pure copy) but confirm the word.
- Operator-deferred review: OD-1 (private observers), OD-2 (capacity 3), OD-3 (respondent auto-lock), OD-4 (persistence shape), OD-5 (relabel word).

---

## UX-ROOM-1V1-CHIMEIN-001A implementation map

Layer-A safe-now slice (issue #737). UI/copy + a pure display-state model only. NO backend / schema / RLS / Edge / migration / capacity / chime-in contribution path. OD-1 is NOT resolved here.

**OD-1-safe override applied:** the operator's OD-1 guidance arrived after this design's draft strings were written. Per #737, the private-room phrasings that imply "no observers" were OVERRIDDEN. The implemented private copy is "Private 1:1" / "Invited access." / "No public chime-ins." — it never says "no observers", "invited parties only", or "only the person you invite". The design draft strings `option_private_helper` "...only the person you invite. No chime-ins." (§3 Row 1 / §4 State 1) and "Invited parties only." (§4 State 1) were NOT used.

**`seatOpponent` override:** the design (§5.2 / §9 / OD-5) recommended relabeling `ROOM_CONTRACT_COPY.seatOpponent` ("Opponent") now. Per #737 this is DEFERRED — OD-5 is undecided and "opponent" is not on this card's ban-list. `seatOpponent` is left byte-identical.

| Surface | Current impl | Visibility/seat data available | Current copy | Safe desired copy (implemented) | Behavior touched | Room semantics touched | Data/API touched | Private-room OD-1 risk | Safe now or deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| `App.tsx` `useRoomContract` call | omitted `roomType` → model defaulted every room to `'public'` | `currentDebate.visibility` already loaded (drives `seatAvailability`) | n/a (no copy) | pass `options: { roomType: currentDebate?.visibility }` | N | N | N | N (threads existing data; no observer-policy change) | Safe now | `oneToOneRoomModel.test.ts` App.tsx source-scan |
| `roomContractModel.ts` `ROOM_CONTRACT_COPY` room-type | `'Public room'` / `'Private room'` | persisted `visibility` | `'Public room'` / `'Private room'` | **"Public 1:1" / "Private 1:1"** | N | N | N | N | Safe now | `roomContractModel`/`roomContractSeatStrip`/`roomContractDoctrine` lockstep |
| `roomContractModel.ts` `seatOpen` / `turnOpenSeat` | open second-principal seat label | `RoomContract.primaryOpponentUserId === null` | `'Open seat — first reply takes it'` | **"Respondent seat open"** (principal language; never "chime-in") | N | N | N | N | Safe now | `roomContractModel`/`roomContractSeatStrip` lockstep |
| `roomContractModel.ts` `seatOpponent` | held-by-other seat label | — | `'Opponent'` | **unchanged (byte-identical)** — deferred OD-5 | N | N | N | N | Deferred (OD-5) | unchanged tests still pin `'Opponent'` |
| `RoomContractSeatStrip.tsx` `roomTypeGlyph` | `=== 'Private room'` literal | — | glyph 🔒/○ | keys off `ROOM_CONTRACT_COPY.privateRoom` (drift-proof) | N | N | N | N | Safe now | `roomContractSeatStrip` glyph test |
| `gameCopy.ts` `ROOM_ACCESS_COPY.public_open_line` | gallery/list public access line | `RoomAccessState` | `'Open seat — observe or step in.'` | **"Respondent seat open — observe or take it."** | N | N | N | N | Safe now | `roomAccessModel` / gallery+list visibility (read constant — auto-follow) |
| `gameCopy.ts` `ROOM_ACCESS_COPY.private_member_line` | private member access line | `RoomAccessState` | `'Private — you are in this argument.'` | **"Private 1:1 — you are in this argument."** | N | N | N | N (member line; no observer claim) | Safe now | `roomAccessModel` / gallery+list visibility (auto-follow) |
| `gameCopy.ts` `ROOM_VISIBILITY_COPY` create-form helpers | create form radiogroup helpers | n/a at create | "Anyone can find and read..." / "Only people you invite can find and read..." | 1:1-framed; private uses OD-1-safe "invited access. No public chime-ins." | N | N | N | N (OD-1-safe; no "no observers") | Safe now | `roomVisibilityModel.banlist` (auto-scan) + `oneToOneRoomModel.test.ts` |
| `gameCopy.ts` NEW `ROOM_ONE_TO_ONE_COPY` | — | — | — | state labels/subcopy ("Public 1:1", "Invited access.", "Respondent seat open.", "2 principal voices.", "Observers watching") | N | N | N | N | Safe now | `oneToOneRoomModel.test.ts` ban-list + plain-language |
| `gameCopy.ts` NEW `POINT_SCOPED_CHIME_IN_COPY` (DORMANT) | — | — | — | "Point-scoped chime-ins", "Attach to this point", "Does not open a principal seat", "Chime-in seats full · observing open" — referenced by tests/constants only | N | N | N | N (public-only vocabulary) | Safe now (copy); controls DEFERRED (GATE-C) | `oneToOneRoomModel.test.ts` (exists + ban-list + no live UI renders it) |
| NEW `src/features/debates/oneToOneRoomModel.ts` | — | composes `RoomContract` open/established + `PublicRoomSeatMap.openChimeInSeatCount` + viewer flags | — | pure `RoomOneToOneDisplayState` union + `deriveRoomOneToOneDisplayState` + `buildRoomOneToOneViewModel` + `buildOneToOneSeatLineViewModel` + `chimeInAllowed` guard | N | N (read-only projection; no write path, no new persisted field) | N (pure model) | N (private → `private_invited_access`; never "no observers") | Safe now | `oneToOneRoomModel.test.ts` (38 tests) |
| node-rail "Take the respondent seat" / "Chime in on this point" | observer/participant dock | — | — | NOT implemented | — | — | — | — | Deferred (GATE-C / #681 seatline + Layer B/C) | n/a |

**Deferred (NOT in this card):** `seatOpponent` relabel (OD-5); the active "Take the respondent seat" claim CTA (binds seat-claim semantics — GATE-C / UX-ROOM-SEATLINE-001 #681); all chime-in contribution controls + capacity + persistence + RLS + Edge + notifications (Layer B/C, operator-gated); the Disagreement Points rail dormant-slot adapter (Layer C); OD-1 private-observer policy.
