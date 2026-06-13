# ARG-ROOM-ADR-001 — Visibility, capacity, and direct-invite doctrine

**Status:** PROPOSED — operator-ratified at GATE-C merge (merging this file ratifies the operative semantics below; until then they are a proposal). Design draft, GATE-A. Docs-only decision record. This card writes exactly one file (this doc): zero production-file change, zero migration, zero code, zero tests, no deploy.
**Epic:** Argument Room Lifecycle — Visibility · Capacity · Invite (`ARG-ROOM-VISIBILITY-INVITE` slate). Consolidates the shipped owners QOL-038 (#207), QOL-039 (#208), QOL-040 (#209), GAME-004, GAME-005 (#142), and the invited-user auth-callback work (#607 / #608) into one binding doctrine.
**Release:** 6.7.
**Issue:** #611 — https://github.com/kyleruff1/cDiscourse/issues/611
**Card type:** reconciliation decision record (ADR). It DECIDES the operative semantics the four dependent slate cards implement; it does not itself implement, enforce, or deploy anything.
**Baseline:** main @ `f85ced2`.
**Doctrine anchors:** `cdiscourse-doctrine` §1 (no winner/loser/truth/verdict copy; structure, never judgment), §3 (popularity/heat never an input to access or seating), §6/§7 (secrets; no AI from the app — not engaged here), §8 (RLS on every table, never disabled; never edit an applied migration), §9 (plain language via `gameCopy`), §10 (v1 scope — no voting/scoring/search/OAuth/public API). Constitution immutability (`src/lib/constitution/engine.ts`) is **not relevant** to this card — nothing here touches the rules engine, the transition matrix, or any constitution version.

---

## Goal

Five separately-shipped primitives each encode one slice of "who can be in an argument room and how it is created," and they have **never been reconciled into one statement of operative truth**:

- QOL-039 shipped a `visibility` column + one-way trigger + read-side RLS (private rooms are invisible to non-participants) — but said nothing about capacity or invites.
- QOL-038 shipped one-live-invite-per-email plumbing — but the create surface never calls it and no rule says private *requires* an invite.
- GAME-004 shipped a derived 1v1 contract (2 primary seats) — read-time only, no write path.
- GAME-005 shipped a derived public seat map with a cap of **6** — explicitly "NO write path and NO new DB column" (`src/features/debates/publicSeatModel.ts:28-33`), i.e. **display-only**.
- The live create surface (`StartArgumentPage.tsx`) exposes **none** of visibility, invite, or capacity — every room created today is public, uninvited, and server-side **uncapped**.

The result is two doctrines silently disagreeing with the running server: the product *says* public rooms hold a bounded number of debaters and private rooms are 1v1 invited; the server *enforces* neither. This ADR fixes one binding contract — the **creation matrix** below — and pins (a) the numbers, (b) the operative definition of "active participant," (c) the single locus where the cap must be enforced, and (d) the two gaps the enforcement cards exist to close (`public ≠ unrestricted thread`; `private ≠ hidden solo draft`). It is the **keystone**: the other four cards in the slate consume these decisions and must not re-litigate them.

This card REUSES every shipped seam and rebuilds none. It reconciles exactly one shipped number: GAME-005's public cap **6 → 5**.

---

## Product contract (the matrix — verbatim, binding)

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
| Private | 0 | 0 | 0 | 2 | NO (private requires one invite) |
| Private | 1 | 1 | 0 | 2 | YES (default) |
| Public | 0 | 0 | 4 | 5 | YES |
| Public | 1 | 1 | 3 | 5 | YES |
| any | 2+ | — | — | — | NO (max one direct invite) |

The seven one-line invariants, repeated verbatim because every dependent card restates them:

> One direct invite at creation. Private rooms are 1v1. Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants.

---

## Existing shipped state (file:line — what to REUSE, not rebuild)

Everything below ships today and is the seam the slate builds *on*. No card in this slate may re-implement any of it.

**Room row + visibility (QOL-039 #208).**
- Room table is `public.debates`. Owner = `created_by` (`supabase/migrations/20260516000001_initial_schema.sql:140`). Status `draft | open | locked | archived` (`:144-145`).
- `visibility` column (`'public' | 'private'`, default `'public'`, NOT NULL backfilled) — `supabase/migrations/20260524000015_qol_039_room_visibility.sql:85-94`.
- One-way `public → private` trigger `enforce_room_visibility_one_way` — `:103-123`. A private room can never be re-published (privacy guarantee, below RLS).
- Read-side RLS — `debates` SELECT (`:189-198`): `created_by = auth.uid() OR is_moderator_or_admin() OR is_debate_participant(id, auth.uid()) OR (visibility = 'public' AND status IN ('open','locked'))`. Sibling `SECURITY DEFINER STABLE` helpers `is_debate_private` (`:130-141`) and `is_debate_open_or_locked_public` (`:156-169`); `arguments` + `debate_participants` SELECT gated to match (`:210-252`).
- `room_visibility_changes` audit table — counts + chime-in argument ids only, never dropped-observer identities; service-role INSERT only (`:272-369`).

**Participants — the uncapped boundary (the gap this slate closes).**
- `public.debate_participants` — `(debate_id, user_id, side ∈ affirmative | negative | observer | moderator, joined_at)`, PK `(debate_id, user_id)`, **no role/status column** (`20260516000001:164-170`).
- Join is a **direct client INSERT** (`src/features/debates/debatesApi.ts:153-170`, `joinDebate`), RLS-gated by `"debate_participants: users join as themselves"` WITH CHECK `user_id = auth.uid() AND public.is_debate_joinable(debate_id)` (`20260516000006_fix_debates_rls_recursion.sql:161-168`).
- `is_debate_joinable(p_debate_id)` is `SECURITY DEFINER STABLE` and checks **only** `status IN ('draft','open')` — **no count cap, no side cap** (`20260516000006:96-111`). `is_debate_participant` is the recursion-safe cross-table helper (`:36-60`).
- `submit-argument` Edge checks membership **existence** and side-vs-argument authorization (`supabase/functions/submit-argument/index.ts:160-194`) but **no count cap**; the authoritative insert is service-role (bypasses RLS). "You must join this debate before posting" is the only gate (`:180`).

**Room creation — client insert (NAV-START-ARGUMENT-001).**
- `createDebate` is a **client INSERT** into `debates`, RLS-gated `created_by = auth.uid()`, sets `visibility` (default `'public'`), and auto-joins the creator as `side = 'moderator'` (`debatesApi.ts:107-151`, visibility `:125`, auto-join `:146-148`). There is **no** create Edge function.
- Live create surface `src/features/arguments/startArgument/StartArgumentPage.tsx` — declaration-first; exposes **no** visibility / invite / capacity control today; submits via `CreateDebateInput → useDebates().create → createDebate`.
- Orphaned `src/features/debates/CreateDebateForm.tsx` already has a Public/Private `VisibilityOption` radiogroup (`:20-54`), default public (`:61`), `accessibilityRole="radio"`, testID `create-debate-visibility-<value>` (`:41`) — **to lift**, not rebuild.

**1v1 + public seat models (GAME-004, GAME-005 #142) — DERIVED, read-time only.**
- `roomContractModel.ts`: `RoomType = 'private' | 'public'` (`:26`); derived `RoomContract` recomputed every load, never persisted, no write path (`:14-20, :36-47`); `resolvePrimaryOpponent` — a private room's recorded invited opponent overrides post order, otherwise the first qualifying responder is the Primary Opponent (`:338-365`); `MIN_QUALIFYING_BODY_CHARS = 40` anti-snipe gate (`:67`).
- `publicSeatModel.ts` (GAME-005): `PUBLIC_ROOM_SEAT_CAP = 6` (`:62`), `PRIMARY_SEAT_COUNT = 2` (`:68`), chime-in capacity = `CAP − PRIMARY_SEAT_COUNT`. Overflow → observer is a **structural transition, never a penalty** (`:116-126`). The whole map is **derived, never persisted; "There is NO write path and NO new DB column"** (`:28-33`). Plain-language strip copy substitutes `{cap}` (`gameCopy.ts:1312` `'{active} of {cap} seats active'`), so any cap change auto-flows to the displayed string.

**One direct invite (QOL-038 #207).**
- `public.argument_room_invites` (`supabase/migrations/20260524000013_qol_038_argument_room_invites.sql:51-88`): `invitee_email_lower` NOT NULL (`:65`), `intended_seat ∈ respondent | co_primary` (`:74-75`), `status ∈ pending | accepted | revoked | expired` (`:76-77`), `token_hash` = sha-256 hex, **raw token never stored** (`:80, :169-170`), `expires_at` default 14 days (`:85`).
- Partial unique index `argument_room_invites_one_live` on `(debate_id, invitee_email_lower) WHERE status = 'pending'` — one **live** invite per (room, email) (`:93-95`).
- RLS enabled; **no authenticated INSERT/UPDATE/DELETE policy** — every write goes through `manage-room-invite`'s service-role client (`:104, :157-164`).
- `manage-room-invite` Edge actions `create | revoke | list_for_debate | lookup_by_token | accept` (`supabase/functions/manage-room-invite/index.ts:91-102`); `lookup_by_token` is the only no-JWT action — the token is the auth (`:99`); `accept` enrols the participant via service-role.
- Client `createRoomInvite` (`src/features/invites/inviteApi.ts:142-151`); single-email `InvitePanel.tsx`; `validateInviteEmailInput` (`inviteCopy.ts:186-191`); `maskInviteeEmail` (`inviteModel.ts:147`).

**Invited-user account + email (#607/#608, QOL-040 #209) — cited as owners.**
- New-user account: `admin-users` `handleInviteUser` → `inviteUserByEmail` (`supabase/functions/admin-users/index.ts:374`), redirect `'invite' → /auth/callback`. Set-password lands via `AuthCallbackScreen → consumeAuthCallback` (`needs_password` when `type='invite'`) → `authApi.setInvitedUserPassword` (#608). Context preserved by the `pendingInviteIntent` slice + `App.tsx:196-199` restore + `InviteRedeemGate` auto-accept (`:118-127`).
- Existing-user email: `room-notifications` Resend block (`:230-317`), gated `INVITE_EMAIL_ENABLED / RESEND_API_KEY / INVITE_EMAIL_FROM` (QOL-040 owns the flip; default OFF). **Known seam:** `room-notifications` `inviteLink` is `null` (`:416`) — the raw token is unrecoverable from the stored hash, so a create-time link must be fed from the create path's `rawToken`.

**Gallery — private already handled.**
- `listDebates` has no client `WHERE`; RLS withholds private rooms the caller cannot see (`debatesApi.ts:97-99`). `classifyCardToSection` routes a private card the user is in to `my_rooms` (`conversationGalleryModel.ts:1530-1541`). Observer-vs-participant = `participantSide`; `canInvite` gate at `App.tsx:906-910`.

---

## Divergence from shipped (what this slate adds/changes)

This ADR adds **one doctrine** and exactly **one reconciled number**; the rest is enforcement and exposure of already-shipped seams.

1. **Public active-participant cap 6 → 5 (the one number change).** GAME-005's `PUBLIC_ROOM_SEAT_CAP` (`publicSeatModel.ts:62`) is reconciled from 6 to 5. Chime-in capacity becomes `5 − 2 = 3`. This is operator decision (2), recorded as a consequence below. The edit itself belongs to the capacity-enforcement dependent card (this ADR is docs-only).
2. **Capacity becomes server-enforced, not display-derived.** Today the only place a number bounds participation is the *derived* GAME-005 map, which has no write path. The slate adds a server-side cap at the membership boundary. **This ADR does not itself close the gap** — it pins the locus and the definition; the enforcement card's migration is what closes it.
3. **Private requires one invite at creation.** Today `createDebate` accepts `visibility='private'` with zero invites (`debatesApi.ts:125`) and nothing requires an invitee — a "hidden solo draft." The slate makes private-at-creation mint exactly one invite or reject.
4. **Creation attaches at most one direct invite.** The QOL-038 one-live index dedupes per-email; the slate adds the stronger creation-time rule "**at most one** direct invite total" and reserves one seat for it.
5. **The live create surface gains visibility + a single invite field.** The orphaned `CreateDebateForm` radio (`CreateDebateForm.tsx:20-54`) and the `InvitePanel` single-email field are lifted into `StartArgumentPage.tsx`; `CreateDebateInput` is extended to carry `visibility` + one optional invite email.

Nothing here changes the read-side RLS (QOL-039 already correct), the invite token model (QOL-038 already correct), the one-way visibility trigger, the engine, or any constitution.

---

## Chosen approach — the decisions (binding)

Stated as an ADR: each decision carries its doctrine rationale and the shipped owner it reconciles. The dependent cards implement these; they do not reopen them.

**D1 — `public.debates.visibility` is the single source of truth for room visibility.** Reuse QOL-039 verbatim (`20260524000015:85-94`). No new visibility column, no new enum, no parallel flag. The one-way trigger (`:103-123`) and the read-side RLS (`:189-198`) stand unchanged. *Rationale:* §8 (never duplicate an applied schema; never edit an applied migration).

**D2 — A private room is 1v1: maximum two active participants.** The room creator (the GAME-004 Initiator = `created_by`) and exactly one invited respondent. Reuse the GAME-004 derived contract (`roomContractModel.ts:36-47, 338-365`) for the read-time seat view; the invited respondent is the QOL-038 invitee with `intended_seat = 'respondent'` (`20260524000013:74-75`). *Rationale:* matrix rows 1–2; §1 (a seat is a structural role, never a verdict).

**D3 — A public room caps at five active participants (GAME-005 6 → 5).** Two primaries + three chime-in seats. Reconcile `PUBLIC_ROOM_SEAT_CAP` (`publicSeatModel.ts:62`) 6 → 5; `PRIMARY_SEAT_COUNT = 2` (`:68`) is unchanged; derived chime-in capacity becomes 3. *Rationale:* operator decision (2); matrix rows 3–4. §3 — the cap is a fixed structural number, never a function of heat, reply count, or popularity (already asserted at `publicSeatModel.ts:24-27`).

**D4 — "Active participant" is operatively defined by debating-side MEMBERSHIP, not by the derived seat map.** An active participant is the room creator (always seat 1, regardless of the `'moderator'` side on their auto-join row at `debatesApi.ts:148`) **plus** every `debate_participants` row whose `side ∈ {affirmative, negative}`. This is the definition the cap counts because it is the single server-cheap, RLS-evaluable quantity (`count … WHERE side IN ('affirmative','negative')`). The GAME-005 derived seat map (`buildPublicRoomSeatMap`) remains the **read-time display** — it refines those members into Initiator / Primary Opponent / chime-in seats and overflow. *Rationale:* the derived map is posting-based and has no write path (`publicSeatModel.ts:28-33`); enforcement must bind on the join, which is membership-based. Reconciling the two vocabularies (below) is a consequence, not a rebuild.

**D5 — Observers are never active participants and the cap never blocks observing.** A `side = 'observer'` row (and the creator's `'moderator'` auto-join row) consume **no** seat. Reading/observing a public room is unbounded; the cap gates only debating-side membership. This preserves Stage 6.4 seamless entry (opening a gallery room defaults to Observer). *Rationale:* matrix invariant "Observers are not active participants"; §1 (observing is not a contest); GAME-005 overflow→observer is structural, not punitive (`publicSeatModel.ts:116-126`).

**D6 — At creation, at most one direct invite; it reserves one seat.** Public: 0 or 1 invite (1 reserves seat 2, leaving 3 open chime-in seats; 0 leaves 4 open). Private: exactly 1 invite, reserving seat 2 (0 open). A live (`status = 'pending'`, unexpired) invite counts against the cap as a reserved seat; on `revoke`/`expire`/`accept` the reservation resolves (accept converts the reservation into a member; revoke/expire frees it). Reuse the QOL-038 row + one-live index (`20260524000013:93-95`) and `manage-room-invite create` (`index.ts:92-93`). *Rationale:* matrix rows 2 & 4 and the "max one direct invite" reject row; "A public direct invite reserves one of the five seats."

**D7 — `public ≠ unrestricted thread` is a GAP the slate must close, server-side.** Today public participation is **unbounded on the server**: the participant INSERT RLS checks only `status` (`is_debate_joinable`, `20260516000006:96-111`), `submit-argument` checks only membership existence (`index.ts:160-194`), and the GAME-005 cap is display-only (`publicSeatModel.ts:28-33`). The cap of five is enforced at the **membership boundary** — the `debate_participants` INSERT path and the `manage-room-invite accept` path — never client-only. Any cross-table count inside an RLS `WITH CHECK` must use a `SECURITY DEFINER STABLE` helper, mirroring `is_debate_joinable` / `is_debate_participant`, to avoid the documented RLS recursion landmine. The new enforcement must go through RLS and/or the Edge function — **no direct client insert may be the sole gate** for the new rule. *Rationale:* §8; the doctrine the capacity-enforcement card exists to satisfy.

**D8 — `private ≠ hidden solo draft` is a GAP the slate must close, at creation.** A private room with zero invitees is invalid (matrix row 1). Creation of a private room must atomically attach exactly one invite (mint via `manage-room-invite create`) or reject; the create path captures the `rawToken` at mint and feeds it to the email surface (the `room-notifications` `inviteLink = null` seam, `:416`). *Rationale:* matrix row 1; QOL-038 invite is the reuse; §1 (a private room is a 1v1 invitation, never a private place to talk to oneself).

**D9 — Locus & non-duplication.** Visibility = `debates.visibility` (D1). Invite identity/seat = `argument_room_invites` (QOL-038). Cap = membership count at the join/accept boundary (D4/D7). Derived display = GAME-004/005 unchanged except the cap number. No new "room settings" table, no persisted seat column, no parallel participant status — unless a dependent card proves the boundary insufficient (recorded as an open question, not assumed). *Rationale:* keystone economy — one source per fact.

These nine decisions are the contract. The dependent cards (below) consume them.

### Dependent cards (consume this ADR — codes provisional, filed this run)

| Provisional code | Frame | Reuses | Closes |
|---|---|---|---|
| `ARG-ROOM-CREATE-UX` | live-surface exposure | lift `CreateDebateForm` radio `:20-54` + `InvitePanel` single email into `StartArgumentPage`; extend `CreateDebateInput` | D1, D6 (UI), `StartArgumentPage` has no controls today |
| `ARG-ROOM-CAP-ENFORCE` | enforcement + 6→5 reconciliation | `SECURITY DEFINER STABLE` count helper in `debate_participants` INSERT `WITH CHECK` + `manage-room-invite accept`; edit `publicSeatModel.ts:62` | D3, D4, D7 (the unbounded gap) |
| `ARG-ROOM-PRIVATE-INVITE` | enforcement | `manage-room-invite create`; atomic create-or-reject | D2, D8 (hidden-solo gap) |
| `ARG-ROOM-INVITE-WIRING` | live-surface + enforcement | create-time `rawToken` → `room-notifications` (`:416`) / `admin-users handleInviteUser :374`; QOL-040 gated send | D6, account-enumeration safety, email |

This ADR is the keystone; each card above must restate the matrix and cite these decisions by number.

---

## Alternatives rejected

**A1 — Persist the GAME-005 seat map / add a seat-state column and enforce from it.** Rejected: GAME-005 is explicitly "NO write path and NO new DB column" (`publicSeatModel.ts:28-33`); the map is posting-derived and would drift against the membership rows the cap actually needs to bound. The membership count (D4) is the cheap, recursion-safe, RLS-evaluable quantity; the derived map stays a pure read-time refinement. Persisting it would rebuild a shipped primitive for negative value.

**A2 — Enforce the cap only in the client (`joinDebate` / the create UX).** Rejected outright: a client-only gate is not a gate (the direct `debate_participants` INSERT and the service-role `submit-argument` both bypass any client check). §8 + D7 require a server boundary (RLS helper and/or Edge).

**A3 — Enforce the cap inside `submit-argument` (post-time).** Rejected as the *sole* locus: by post time the over-cap member has already joined, and `submit-argument`'s insert is service-role (RLS-bypassing), so a count there is advisory at best and races under concurrency. The membership boundary (join/accept) is the correct chokepoint; a post-time check may be a belt-and-braces secondary, not the primary.

**A4 — Keep the public cap at 6.** Rejected by operator decision (2): the slate standardizes on **five** active participants. The reconciliation cost is one constant + two named tests + comment cleanup (below); the displayed copy auto-follows `{cap}`.

**A5 — Allow unlimited direct invites at creation (fill all open seats by invite).** Rejected: the matrix caps direct invites at **one** at creation ("any | 2+ | NO"). Additional public seats fill by open join, not by a fan-out of invitations. Post-creation multi-invite seat-filling is explicitly out of slate scope (open question Q3).

**A6 — Make `private` a third value of some "room mode" rather than reuse `visibility`.** Rejected: QOL-039 already shipped the `'public' | 'private'` column, the one-way trigger, and the read RLS. Reuse (D1); never duplicate an applied migration.

---

## Data / API shape

**No new persisted shape is decided by this card.** The reconciliation rides entirely on shipped objects; the enforcement card supplies the SQL.

Operative reuse map (the contract the enforcement card binds to):

- **Visibility:** `debates.visibility text CHECK (visibility IN ('public','private'))`, default `'public'`, one-way trigger — unchanged (QOL-039).
- **Membership / cap quantity (D4):** count over `debate_participants` where `side IN ('affirmative','negative')`, plus the creator as seat 1. The enforcement card adds a `SECURITY DEFINER STABLE` helper (working name `active_participant_count(debate_id)` / `debate_has_open_active_seat(debate_id)`) and references it from the `debate_participants` INSERT `WITH CHECK` and from `manage-room-invite accept` — same shape as `is_debate_joinable` (`20260516000006:96-111`). No new column.
- **Invite (D6):** `argument_room_invites` unchanged; a live (`status='pending'`, `expires_at > now()`) row counts as one reserved seat in the helper above. `intended_seat = 'respondent'` for the 1v1 / reserved seat.
- **Create input (D6, UX card):** `CreateDebateInput` gains `visibility: 'public' | 'private'` (already typed via QOL-039's `RoomVisibility`, consumed at `debatesApi.ts:125`) and one optional invite email; the create flow then makes at most one `manage-room-invite create` call and threads its `rawToken` onward.

Vocabulary reconciliation (display vs enforcement — recorded so no card re-invents it):

| Concept | Schema side (`debate_participants.side`) | Derived seat role (GAME-004/005) | QOL-038 `intended_seat` |
|---|---|---|---|
| Creator / first seat | `moderator` (auto-join `:148`) | `initiator` | — |
| Opponent / reserved | `affirmative` or `negative` | `primary_opponent` | `respondent` |
| Additional debaters | `affirmative` or `negative` | `chime_in` (seats 3–5) | — |
| Observer | `observer` | (not seated) | — |

The cap counts the first three rows (D4); the fourth never counts (D5).

---

## UI copy (where relevant — ban-list-clean)

This ADR ships **no** runtime copy. It pins the copy seams the UX card reuses; all of these are already plain-language and verdict-free:

- Visibility labels/helpers: `ROOM_VISIBILITY_COPY` (`gameCopy.ts:1604-1665`) — e.g. `option_public_helper` "Anyone can find and read this argument.", `option_private_helper` "Only people you invite can find and read this argument." `ROOM_VISIBILITY_LABEL` (`:1668-1672`).
- Capacity readout: `seat_count` "`{active} of {cap} seats active`" (`gameCopy.ts:1312`) — substitutes `{cap}`, so 6→5 needs **no copy edit**.
- Invite field: `validateInviteEmailInput` (`inviteCopy.ts:186-191`), `maskInviteeEmail` (`inviteModel.ts:147`).

Doctrine for any *new* string a dependent card adds: no winner/loser/correct/incorrect/truth/verdict tokens; no person tokens (troll/bot/liar/bad faith); moving to observer or hitting the cap is described as **structure**, never removal/punishment ("This room has five active seats. You can follow as an observer." — never "the room is full, you were rejected"). Account-enumeration safety: the invite path returns a **uniform** response whether or not the address already has an account — never reveal existing/new (the #607/#608 split is invisible to the inviter). Raw email never in public UI/MCP (mask + domain); raw token/link never in any API response or log.

---

## Tests (named)

This card adds **no code and no tests** (docs-only; it writes one file). The names below are the **binding test contract** this ADR imposes on the dependent cards — the keystone pins them so the four cards cannot drift from the matrix:

- **Matrix conformance (capacity-enforce card):** `__tests__/argRoomCapacityEnforcement.test.ts` — assert each matrix row: private/0 invite rejected; private/1 accepted (2 total, 0 open); public/0 accepted (5 total, 4 open); public/1 accepted (5 total, 1 reserved, 3 open); any/2-invites-at-creation rejected. Assert a 6th debating-side join is refused server-side and an observer join at cap still succeeds (D5).
- **6 → 5 reconciliation (capacity-enforce card):** update `__tests__/publicSeatModel.test.ts` and `__tests__/publicRoomMetricsStrip.test.tsx` to the new cap; assert `PUBLIC_ROOM_SEAT_CAP === 5` and chime-in capacity `=== 3`; assert the `seat_count` string renders "`… of 5 seats active`" via `{cap}` substitution (no string literal change).
- **Private-requires-invite (private-invite card):** `__tests__/argRoomPrivateInviteRequired.test.ts` — creating a private room with no invite is rejected; with exactly one invite, the `respondent` reservation exists and seat 2 is reserved.
- **Reservation accounting (capacity-enforce card):** a pending unexpired invite consumes one seat; revoke/expire frees it; accept converts it to a member without exceeding the cap (no double-count race).
- **Enumeration + secret safety (invite-wiring card):** uniform invite response regardless of pre-existing account; no raw token/link/email in any response body or log (extends the existing `manage-room-invite` / `room-notifications` redaction suites).
- **Recursion-safety (capacity-enforce card):** the new count helper is `SECURITY DEFINER STABLE` and the `debate_participants` INSERT policy does not self-recurse (migration apply test, mirroring the `20260516000006` recursion fix).

Doctrine self-check tests already shipped — `__tests__/chimeInGovernanceDoctrine.test.ts` (ban-list over GAME-005 copy via `_forbiddenChimeInGovernanceTokens`, `publicSeatModel.ts:833-874`) — remain green and gain the 6→5 fixtures.

---

## Doctrine compliance

- **§1 (no verdict; structure not judgment):** every decision frames seats, visibility, and the cap as structural access properties; "full" and "observer" are never removal or a loss. RESPECTED.
- **§3 (popularity/heat never an input):** the cap is a fixed number (5/2), never derived from reply count, heat, or standing — already asserted at `publicSeatModel.ts:24-27`; this ADR keeps it. RESPECTED.
- **§6/§7 (secrets; no AI from the app):** no provider call, no secret literal; the slate touches no AI path. Raw token stays hash-only (QOL-038); raw email masked. RESPECTED.
- **§8 (RLS on every table; never disabled; never edit an applied migration; server-side enforcement):** the cap is enforced server-side at the membership boundary via a new `SECURITY DEFINER STABLE` helper + a **new** migration (never an edit to QOL-039/038); RLS stays enabled everywhere; the new rule never relies on a client-only gate (D7). RESPECTED.
- **§9 (plain language):** all copy routes through `ROOM_VISIBILITY_COPY` / `gameCopy`; the `{cap}` substitution means the number change ships zero new prose. RESPECTED.
- **§10 (v1 scope):** no voting, no scoring, no search, no OAuth, no public API, no push. A capacity number and an invite are room mechanics, not a score. RESPECTED.
- **Constitution immutability:** not engaged — no engine, transition-matrix, or constitution-version change anywhere in the slate. N/A by design.

---

## GATE-C + merge posture

- **This card is GATE-A, docs-only.** It writes one file. No migration, no Edge change, no constant edit, no deploy, no env var, no hosted-config write. It is **not** deploy-bearing and spends no GATE-B/GATE-C budget itself.
- **Status semantics:** PROPOSED until merge; **merging this file is the operator ratification** that turns the nine decisions and the matrix into the slate's operative semantics (PROPOSED → operatively ACCEPTED). The dependent cards then implement against a ratified contract.
- **Deploy-bearing work lives downstream.** The migration (new count helper + `debate_participants` INSERT policy), the `manage-room-invite accept` change, the `publicSeatModel.ts:62` 6→5 edit, and the create-surface wiring are owned by the four dependent cards, each carrying its own GATE-B/GATE-C (migration-bearing review per the roadmap-reviewer migration checklist; Supabase auto-applies on merge to main for `config.toml`-registered functions). **Ratifying this ADR does not, by itself, change any running behavior** — see Risk R1.
- **Self-approval boundary:** this card decides; it does not deploy, does not arm anything, does not change a failing guard. It is safe to merge on a feature branch and squash to main once reviewed.

---

## Risks

- **R1 — Ratification ≠ enforcement (the doctrine-vs-server gap stays open until the capacity card deploys).** Merging this ADR pins "five," but the server still accepts unbounded public debating-side joins until `ARG-ROOM-CAP-ENFORCE`'s migration applies. Every consumer of this ADR must state that the cap is **display-only** until that migration lands. Mitigation: sequence the capacity-enforce card immediately after ratification; do not advertise the cap as enforced before its deploy smoke.
- **R2 — 6→5 split-change breakage.** Editing `publicSeatModel.ts:62` without updating `__tests__/publicSeatModel.test.ts` + `__tests__/publicRoomMetricsStrip.test.tsx` and the "6-seat" comments (`publicSeatModel.ts:124` and the doc-string lines) leaves red or stale prose. Mitigation: the capacity card changes constant + tests + comments + GAME-005 #142 doc in one commit; the `{cap}` copy needs no edit.
- **R3 — RLS recursion.** A naive cross-table count in the `debate_participants` INSERT `WITH CHECK` re-introduces the recursion the `20260516000006` fix removed. Mitigation: D7 mandates a `SECURITY DEFINER STABLE` helper; the recursion-safety test is named.
- **R4 — Reservation race / leakage.** Counting a pending invite as a seat must exclude expired invites and must not double-count on accept. Mitigation: the helper filters `status='pending' AND expires_at > now()`; the reservation-accounting test covers revoke/expire/accept.
- **R5 — Definition drift (membership count vs derived seat map).** A user who joins a debating side but never posts consumes a membership slot yet is not shown as a GAME-005 seat (posting-derived). Mitigation: D4 makes membership the enforcement truth and the derived map a display refinement; Q1 records the joined-but-silent nuance for the enforcement card to confirm.
- **R6 — Creator double-count.** The creator's auto-join `side='moderator'` row plus their seat-1 status could be counted twice. Mitigation: D4 fixes the creator as seat 1 once; the count adds debating-side rows and treats the creator's `moderator` row as not a debating-side seat.

## Open questions

- **Q1 — Joined-but-silent slot.** Does a debating-side member who has not yet posted a qualifying move consume a cap seat (membership view, D4) or only on first qualifying post (derived view)? This ADR pins **membership** for enforcement safety; the capacity card confirms and documents the small gap vs the GAME-005 display.
- **Q2 — Creator's `moderator` auto-join.** Should the creator's auto-join side become an explicit debating side at creation (when they pick one) rather than `'moderator'`? Out of scope here; flagged for the create-UX card. The cap math treats the creator as seat 1 either way (D4/R6).
- **Q3 — Post-creation invites.** May a public room owner send further invites after creation to fill open seats? This ADR scopes invites to **creation-time, max one** (A5); post-creation seat-filling by invitation is deferred (v2 candidate), and open public seats fill by open join.
- **Q4 — Observer cap.** Confirmed unbounded for observing (D5); is there any future need to bound observers for a private room (where observers shouldn't exist at all)? A private 1v1 has two debating seats and no observer seat by construction; the create/accept paths should not enrol observers into a private room. Flagged for the private-invite card.
- **Q5 — Persisted seat state.** D9 assumes the membership boundary is sufficient and adds no seat column. If the capacity card finds the boundary cannot express "reserved by pending invite" cheaply enough, a minimal additive column may be proposed — as a **new** migration, never an edit, and only with its own justification.
