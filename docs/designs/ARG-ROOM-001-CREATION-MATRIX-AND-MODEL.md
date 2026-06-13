# ARG-ROOM-001 — Creation matrix model and pure validator

Status: Design draft
Epic: ARG-ROOM-VISIBILITY-INVITE (room-creation visibility + single-invite seat reservation; extends QOL-038 / QOL-039 / QOL-040 room lifecycle)
Release 6.7
Issue: #612 — https://github.com/kyleruff1/cDiscourse/issues/612

---

## Goal

Provide the one pure, deterministic, JSON-serializable decision function that answers a single question at room-creation time: *given a chosen visibility and an optional single invite email, is this a valid room to create, and what is its seat accounting?*

This card is **net-new**: there is no creation-matrix model in the tree today. The shipped surfaces each hold one fragment of the rule — `createDebate` normalizes visibility (debatesApi.ts:125), `publicSeatModel` owns the active-seat cap (publicSeatModel.ts:62), the invite layer owns email shape (inviteCopy.ts:186-191) and the self-invite guard lives server-side (manage-room-invite/index.ts:182-184) — but nothing composes them into the binding creation contract. ARG-ROOM-001 composes the existing seams into one validator that both the client create surface and the server enforcement path (sibling cards) call. It mirrors the purity discipline of `src/domain/constitution/engine.ts` (engine.ts:1-5): "pure TypeScript, no side effects, no async. Safe to import on the client ... and in Edge Functions. Never import Supabase, React, or network libs."

**Scope boundary:** ARG-ROOM-001 is decision-only. It adds no migration, no Edge Function, no insert, no RLS, no UI. It REUSES shipped primitives and reconciles one shipped constant (the public cap, 6 → 5). The write-path enforcement (reserving the seat, capping participants, the atomic create-plus-invite) is a sibling enforcement card that imports this model on both planes.

---

## Product contract (the matrix verbatim)

The binding creation matrix:

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
| Private | 0 | 0 | 0 | 2 | NO (private requires one invite) |
| Private | 1 | 1 | 0 | 2 | YES (default) |
| Public | 0 | 0 | 4 | 5 | YES |
| Public | 1 | 1 | 3 | 5 | YES |
| any | 2+ | — | — | — | NO (max one direct invite) |

The repeated one-liners (binding, restated verbatim):

> One direct invite at creation. Private rooms are 1v1. Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants.

Seat-accounting identity encoded by this card (the creator always occupies one active seat — they auto-join, debatesApi.ts:146-148):

```
openParticipantSlotsAfterCreation = capacity − 1 (creator) − reservedInviteSeats
  public,  0 invite:  5 − 1 − 0 = 4
  public,  1 invite:  5 − 1 − 1 = 3
  private, 1 invite:  2 − 1 − 1 = 0
```

---

## Existing shipped state (file:line — what to REUSE)

This card **composes** these seams. It does not rebuild any of them.

**Capacity seams (GAME-004 / GAME-005):**
- `PUBLIC_ROOM_SEAT_CAP` (publicSeatModel.ts:62) — the public active-seat cap, today `6`. This card reconciles it to `5` (see Divergence) and the matrix model imports it rather than authoring a new literal.
- `PRIMARY_SEAT_COUNT` (publicSeatModel.ts:68) — `2`, the two primary seats. This is exactly the private-room capacity (a private room is the two primary seats with no chime-ins). Reused as the private cap.
- `roomContractModel.ts` — GAME-004's 1v1 contract (`PrimarySeat` = `initiator` | `primary_opponent`, roomContractModel.ts:29). The private room is this 1v1 contract; the matrix encodes its capacity (2) and the "private is 1v1" one-liner.
- Public-room seat copy already uses a `{cap}` placeholder (`CHIME_IN_GOVERNANCE_COPY.seat_count`, consumed publicSeatModel.ts:708-710), so the 6 → 5 change flows into rendered copy automatically.

**Email seams (QOL-038):**
- `validateInviteEmailInput(email)` (inviteCopy.ts:186-191) — the shipped local email-shape check (`null` on valid, else an inline error). Reused verbatim; this card does not author an email regex.
- `normaliseInviteeEmail(input)` (inviteModel.ts:196-210) — returns `lower(trim(...))` or `null`. Reused for the normalized form fed to the downstream invite path.
- `maskInviteeEmail(emailLower)` (inviteModel.ts:147-159) — the display-only `a•••@example.com` mask. Reused for any echo surface.

**Self-invite precedent (QOL-038):**
- `manage-room-invite` `create` rejects with `cannot_invite_self` when the caller's session email equals the invitee (manage-room-invite/index.ts:182-184). This card mirrors that comparison in the pure layer (best-effort, when a creator email is supplied) while the Edge guard remains authoritative.

**One-invite seam (QOL-038):**
- `argument_room_invites` (migration 20260524000013) with partial-unique `argument_room_invites_one_live` (one live invite per debate+email); `createRoomInvite` (inviteApi.ts:142-151) takes exactly one `inviteeEmail`; `InvitePanel` is a single-email field (`INVITE_PANEL_COPY.emailLabel` = "Their email address", inviteCopy.ts:85). The "one direct invite" rule mirrors this single-email wire shape.

**Plain-language seam (doctrine §9):**
- `plainLanguageForInviteError(code)` (inviteCopy.ts:171-179) maps internal codes to neutral copy and returns a **generic fallback for any unknown code, never echoing the raw token**. The matrix's reason→copy mapper reuses this for the two overlapping reasons (`cannot_invite_self`, `invalid_email` in `ERROR_CODE_MAP`, inviteCopy.ts:146-147) and its generic-fallback behavior.

**Visibility + create seams (QOL-039):**
- `debates.visibility` column + one-way `enforce_room_visibility_one_way` trigger (migration 20260524000015:85-94, :103-123) and the `debates` SELECT RLS (:189-198). Visibility is an access property, never a verdict (migration header doctrine, 20260524000015:32-48).
- `createDebate` client insert (debatesApi.ts:107-151), normalizing visibility with `input.visibility === 'private' ? 'private' : 'public'` (debatesApi.ts:125). The matrix reuses this exact normalization rule.
- `RoomVisibility` type + `CreateDebateInput.visibility?` (types.ts:10, :43-54).

**Future consumers (not touched by this card):**
- `StartArgumentPage.tsx` — the live create surface (no visibility / invite / capacity today).
- `CreateDebateForm.tsx` — orphaned, holds the lift-ready Public/Private radiogroup (CreateDebateForm.tsx:20-54, :105-131) and `ROOM_VISIBILITY_COPY` (gameCopy.ts:1604-1672).
- Gallery already hides private rooms via RLS — no client filter (debatesApi.ts:97-99).

**Purity precedent:**
- `engine.ts:1-5` purity header; `roomContractModel.ts` and `publicSeatModel.ts` are the in-feature pure-model precedents (frozen, deterministic outputs).

---

## Divergence from shipped (what this card adds / changes)

**Adds (net-new):**
1. `src/features/debates/argumentRoomCreationMatrix.ts` — the pure module (types + `deriveArgumentRoomCreation` + capacity helpers + reason→copy mapper).
2. `__tests__/argumentRoomCreationMatrix.test.ts` — the full test plan.
3. Two new neutral copy strings (the only copy this card authors) for the two reasons that have no shipped equivalent (`too_many_invites`, `private_requires_invite`).

**Changes (the binding reconciliation — operator decision 2):**

> ### ADR: public active-participant cap reconciled 6 → 5
>
> **Context.** GAME-005 shipped `PUBLIC_ROOM_SEAT_CAP = 6` (publicSeatModel.ts:62 — seat 1 initiator, seat 2 primary opponent, seats 3–6 four chime-in seats). The ARG-ROOM-VISIBILITY-INVITE matrix requires public total capacity = **5**. Two different numbers for the same real-world quantity ("max active participants in a public room") is a one-source-of-truth violation.
>
> **Decision (binding, operator).** The public active-participant cap is **5**. `PUBLIC_ROOM_SEAT_CAP` is changed from `6` to `5` at publicSeatModel.ts:62. The matrix module does **not** author a second capacity literal — it imports `PUBLIC_ROOM_SEAT_CAP` and `PRIMARY_SEAT_COUNT` and re-exports them under capacity-semantic names (`PUBLIC_ACTIVE_PARTICIPANT_CAP`, `PRIVATE_ACTIVE_PARTICIPANT_CAP`). A parity test pins both, so a future careless edit to publicSeatModel trips this suite too.
>
> **Consequence.** Public chime-in capacity becomes `5 − 2 = 3` (was 4). A public room seats the initiator, the primary opponent, and up to three chime-ins. Beyond that → observer (GAME-005's overflow path, unchanged in mechanism). `CHIME_IN_GOVERNANCE_COPY.seat_count` renders via a `{cap}` placeholder (publicSeatModel.ts:708-710), so "of N" copy auto-updates — no copy string is re-authored.
>
> **Test impact (updated, not removed):** publicSeatModel.test.ts:840-841 (`PUBLIC_ROOM_SEAT_CAP` `toBe(6)` → `toBe(5)`); the swarm case at publicSeatModel.test.ts:187 ("seats 3-6 hold the first 4") becomes "seats 3-5 hold the first 3", and its overflow expectation publicSeatModel.test.ts:205 (`['u-c5','u-c6','u-c7']`) gains the now-overflowed fourth chime-in; the cap-fill fixture near publicSeatModel.test.ts:182-184 seats one fewer chime-in to reach the new cap.
>
> **Why this flip rides in ARG-ROOM-001 (not the enforcement card):** the parity test (`PUBLIC_ACTIVE_PARTICIPANT_CAP === PUBLIC_ROOM_SEAT_CAP === 5`) is part of this card. It is red until publicSeatModel is `5`. A binding operator decision cannot ship behind a red guard, so the flip is in-card by construction. Recorded here per operator decision 2; companion to `docs/decisions/`.

This card changes **no** RLS, **no** migration, **no** Edge Function, and adds **no** write path.

---

## Chosen approach

A single pure module, `src/features/debates/argumentRoomCreationMatrix.ts`, co-located with `publicSeatModel.ts` / `roomContractModel.ts` / `debatesApi.ts`. No imports from Supabase, React, or any network lib; no `async`; no clock; no randomness; frozen output (mirrors `roomContractModel` / `publicSeatModel`, which `Object.freeze` their results).

`deriveArgumentRoomCreation(intent, opts?)` runs a fixed-order decision (stable reasons, exactly like `explainQualifyingResponse`, roomContractModel.ts:235-275):

1. Normalize visibility with the shipped rule: anything other than `'private'` is `'public'` (matches debatesApi.ts:125). `capacity` follows from visibility alone — `'public'` → `PUBLIC_ACTIVE_PARTICIPANT_CAP` (5), `'private'` → `PRIVATE_ACTIVE_PARTICIPANT_CAP` (2).
2. Trim `directInviteEmail`. If empty (or only separators):
   - `'private'` → reject `private_requires_invite` (a private room with no invite is invalid).
   - `'public'` → accept with 0 invites, 0 reserved, 4 open.
3. Non-empty: split on `[,;\s]+` and count non-empty tokens (the "one direct invite" structural rule, checked before per-email shape). More than one token → reject `too_many_invites`. This split is checked **before** `validateInviteEmailInput` so a two-address paste yields the specific `too_many_invites`, not a generic `invalid_email`. (Splitting on whitespace is safe: a syntactically valid address contains no spaces — `normaliseInviteeEmail` rejects any `\s`, inviteModel.ts:208.)
4. The single token runs through `validateInviteEmailInput` (inviteCopy.ts:186-191); non-`null` → reject `invalid_email`. `normaliseInviteeEmail` (inviteModel.ts:196-210) yields the storage form; `null` (belt-and-braces) → `invalid_email`.
5. Self-invite: if `opts.creatorEmail` is supplied, compare its normalized form to the normalized invitee (case/whitespace-insensitive). Equal → reject `self_invite` (default for **both** public and private), mirroring manage-room-invite/index.ts:182-184. When `creatorEmail` is absent the pure layer cannot detect self-invite and skips the check — the Edge guard (reading the real session email) stays authoritative, exactly as today.
6. Otherwise accept: 1 invite, 1 reserved seat; open = `capacity − 1 − 1` (private → 0, public → 3); carry the normalized + masked email for the downstream invite path.

On any reject, the seat-count fields are zeroed (`directInviteCount` 0, `reservedInviteSeats` 0, `openParticipantSlotsAfterCreation` 0) so the literal-union types stay honest; only `visibility`, `capacity`, `valid:false`, and `reason` carry meaning. The invariant `reservedInviteSeats === directInviteCount` holds for every valid result.

The module is the **client + server shared validator**. A sibling enforcement card imports it in the create orchestrator (client, for instant inline feedback) and in the create-room enforcement path (server, authoritative) — one validator, two call sites, identical result, exactly the engine.ts pattern.

---

## Alternatives rejected

- **Author new capacity literals (`5`, `2`) in the matrix module.** Rejected — two sources of truth. Import `PUBLIC_ROOM_SEAT_CAP` / `PRIMARY_SEAT_COUNT` and pin with a parity test instead (one literal in the tree).
- **Re-author an email regex / validator.** Rejected — doctrine + DRY. Reuse `validateInviteEmailInput` + `normaliseInviteeEmail` (the exact shipped wire-shape check) so the model and the invite Edge function agree byte-for-byte.
- **Model multiple invites as `directInviteEmails: string[]`.** Rejected — the wire (`manage-room-invite` `create` takes one `inviteeEmail`) and `InvitePanel` (single field) are single-email. A `string` field with multi-address detection matches shipped reality and yields a clean `too_many_invites`.
- **Make the model async / fetch the creator email / check account existence.** Rejected — breaks purity (doctrine §5) and risks account enumeration. `creatorEmail` is passed in; user existence is never queried; the result is identical whether the invitee is an existing or new account.
- **Put write enforcement (insert / RLS / Edge) in this card.** Rejected — keeps ARG-ROOM-001 pure and automerge-prefer. The new enforcement goes through RLS / Edge in a sibling card (no new direct client insert into a protected table).
- **Boolean-only result (no reason).** Rejected — the create surface needs a specific neutral message per failure; reasons map through plain language with no raw-code leak.

---

## Data / API shape

```ts
// src/features/debates/argumentRoomCreationMatrix.ts — pure TS. No React, no
// Supabase, no network, no async. JSON-serializable in and out. Shared by the
// client create surface and the server enforcement path (mirror engine.ts).

import { PUBLIC_ROOM_SEAT_CAP, PRIMARY_SEAT_COUNT } from './publicSeatModel';
import { validateInviteEmailInput, plainLanguageForInviteError } from '../invites/inviteCopy';
import { normaliseInviteeEmail, maskInviteeEmail } from '../invites/inviteModel';

export type ArgumentRoomVisibility = 'public' | 'private';
export type ArgumentRoomCapacity = 2 | 5;

// Reconciled capacity seams — imported, not re-authored (one source of truth).
export const PUBLIC_ACTIVE_PARTICIPANT_CAP = PUBLIC_ROOM_SEAT_CAP;  // 5 after reconcile
export const PRIVATE_ACTIVE_PARTICIPANT_CAP = PRIMARY_SEAT_COUNT;   // 2 (the 1v1 seats)
export const MAX_DIRECT_INVITES_AT_CREATION = 1;

export type ArgumentRoomCreationRejectReason =
  | 'private_requires_invite'
  | 'too_many_invites'
  | 'invalid_email'
  | 'self_invite';

export interface ArgumentRoomCreationIntent {
  visibility: ArgumentRoomVisibility;
  directInviteEmail: string | null;
}

export interface DeriveArgumentRoomCreationOptions {
  /** When supplied, enables the self-invite check (Edge stays authoritative when absent). */
  creatorEmail?: string | null;
}

export interface ArgumentRoomCreationDerived {
  visibility: ArgumentRoomVisibility;
  capacity: ArgumentRoomCapacity;                       // 2 | 5
  directInviteCount: 0 | 1;                             // count ACCEPTED (0 on any reject)
  reservedInviteSeats: 0 | 1;                           // === directInviteCount when valid
  openParticipantSlotsAfterCreation: 0 | 3 | 4;         // 0 on any reject
  valid: boolean;
  reason?: ArgumentRoomCreationRejectReason;            // omitted when valid
  // Composition outputs (beyond the minimal conceptual shape) so the
  // enforcement card never re-normalises:
  normalisedDirectInviteEmail: string | null;          // lower(trim) or null
  maskedDirectInviteEmail: string | null;              // maskInviteeEmail(...) or null
}

export function deriveArgumentRoomCreation(
  intent: ArgumentRoomCreationIntent,
  opts?: DeriveArgumentRoomCreationOptions,
): ArgumentRoomCreationDerived;          // returns a frozen object

// Capacity accounting helpers (operator-specified invariants).
export function fitsPublicCapacity(activeParticipants: number, reservedInviteSeats: number): boolean;
//   => activeParticipants + reservedInviteSeats <= PUBLIC_ACTIVE_PARTICIPANT_CAP (5)
export function fitsPrivateCapacity(activeParticipants: number, reservedInviteSeats: number): boolean;
//   => activeParticipants + reservedInviteSeats <= PRIVATE_ACTIVE_PARTICIPANT_CAP (2)

// Reason -> neutral plain language. Reuses shipped invite copy for the two
// overlapping reasons + the shipped generic fallback for unknown reasons.
export function plainLanguageForCreationReason(
  reason: ArgumentRoomCreationRejectReason | null | undefined,
): string;
```

Derived results for the five matrix rows:

| Intent | `valid` | `reason` | `capacity` | `directInviteCount` | `reservedInviteSeats` | `openParticipantSlotsAfterCreation` |
| private, no email | false | `private_requires_invite` | 2 | 0 | 0 | 0 |
| private, one valid email | true | — | 2 | 1 | 1 | 0 |
| public, no email | true | — | 5 | 0 | 0 | 4 |
| public, one valid email | true | — | 5 | 1 | 1 | 3 |
| any, two emails | false | `too_many_invites` | 2 or 5 | 0 | 0 | 0 |
| any, malformed email | false | `invalid_email` | 2 or 5 | 0 | 0 | 0 |
| any, email == creator | false | `self_invite` | 2 or 5 | 0 | 0 | 0 |

No new DB table, column, RLS policy, Edge Function, or client insert. No token handling (the create-time raw token is fed separately to `manage-room-invite`, never through this model).

---

## UI copy (ban-list-clean)

This card authors only two new strings (frozen, scanned by the ban-list test); the other reasons reuse shipped invite copy.

| Reason | Source | String |
| `self_invite` | reuse `plainLanguageForInviteError('cannot_invite_self')` (inviteCopy.ts:146) | "You cannot invite yourself." |
| `invalid_email` | reuse `plainLanguageForInviteError('invalid_email')` (inviteCopy.ts:147) | "Enter a valid email address." |
| `too_many_invites` | **new** | "Add just one email — you can invite one person as you start." |
| `private_requires_invite` | **new** | "A private argument needs one invite so someone can join you." |
| unknown / undefined | reuse `plainLanguageForInviteError(null)` (generic fallback, inviteCopy.ts:172-178) | "That invite action could not be completed. Try again." |

All strings are plain language, person-neutral, verdict-free. They avoid the QOL-038 banned framing (`BANNED_INVITE_FRAMING`, inviteCopy.ts:22-42 — `challenger` / `opponent` / `winner` / `loser` / etc.). No internal reason code is ever shown to a user; an unknown reason falls back to the shipped generic message (doctrine §9, mirroring `plainLanguageForInviteError`).

---

## Tests (named)

New suite `__tests__/argumentRoomCreationMatrix.test.ts`:

**Matrix rows (exhaustive over the contract table)**
- `private + no email → invalid, reason private_requires_invite, capacity 2, reserved 0, open 0`
- `private + one valid email → valid, capacity 2, directInviteCount 1, reserved 1, open 0`
- `public + no email → valid, capacity 5, reserved 0, open 4`
- `public + one valid email → valid, capacity 5, reserved 1, open 3`
- `public + two emails → invalid, reason too_many_invites`
- `private + two emails → invalid, reason too_many_invites`

**Reserved / open derivation invariants**
- `reservedInviteSeats === directInviteCount for every valid result`
- `openParticipantSlotsAfterCreation === capacity − 1 − reservedInviteSeats for every valid result`
- `active + reserved never exceeds the cap (via fitsPublicCapacity / fitsPrivateCapacity)`
- `openParticipantSlotsAfterCreation is always one of 0 | 3 | 4 across all branches`
- `directInviteCount and reservedInviteSeats are always 0 | 1 across all branches`

**Self-invite (default reject, both visibilities)**
- `public + email equal to creatorEmail → reason self_invite`
- `private + email equal to creatorEmail → reason self_invite`
- `self-invite match is case / whitespace insensitive ("  Creator@X.COM " vs "creator@x.com")`
- `no creatorEmail supplied → self-invite NOT detected, result is valid (Edge stays authoritative)`

**Multi-email reject (one direct invite max)**
- `"a@x.com, b@y.com" → too_many_invites (NOT invalid_email)`
- `"a@x.com; b@y.com" → too_many_invites`
- `"a@x.com b@y.com" → too_many_invites`
- `trailing separator "a@x.com," → valid single invite`
- `field of only separators ", ," → treated as empty (private invalid, public valid)`

**Invalid email**
- `"nope", "a@", "@b.com" → invalid_email`

**Normalisation / mask composition (reuses shipped helpers)**
- `"  Alice@Example.COM " → normalisedDirectInviteEmail 'alice@example.com', maskedDirectInviteEmail 'a•••@example.com'`
- `reject results carry normalisedDirectInviteEmail null and maskedDirectInviteEmail null`

**Visibility normalisation (reuses the createDebate rule)**
- `unknown / garbage visibility coerces to 'public' (matches debatesApi.ts:125)`

**Generic statuses / plain language (doctrine §9)**
- `every reason maps to a non-empty string with no snake_case leak (no "_")`
- `unknown / undefined reason → shipped generic fallback`
- `self_invite and invalid_email copy equals the shipped invite strings (reuse proof)`

**Determinism + non-mutation (mirror engine.ts discipline)**
- `calling deriveArgumentRoomCreation twice on the same input yields a deeply-equal result`
- `the input intent and opts objects are not mutated`
- `the returned object is frozen`

**Ban-list (doctrine safety)**
- `scans the two new copy strings + plainLanguageForCreationReason over every reason (and unknown) for banned verdict / person tokens` (winner / loser / liar / true / false / correct / dishonest / bad faith / manipulative / extremist / propagandist / troll / bot, plus `challenger` / `opponent` from `BANNED_INVITE_FRAMING`)

**Capacity helpers**
- `fitsPublicCapacity(4, 1) === true; fitsPublicCapacity(4, 2) === false (boundary 5)`
- `fitsPrivateCapacity(1, 1) === true; fitsPrivateCapacity(2, 1) === false (boundary 2)`

**Reconciliation parity**
- `PUBLIC_ACTIVE_PARTICIPANT_CAP === 5 === PUBLIC_ROOM_SEAT_CAP`
- `PRIVATE_ACTIVE_PARTICIPANT_CAP === 2 === PRIMARY_SEAT_COUNT`
- `ArgumentRoomCapacity literal union {2, 5} matches the two caps`

Modified existing tests (the 6 → 5 reconcile): publicSeatModel.test.ts:840-841 (`toBe(6)` → `toBe(5)`); publicSeatModel.test.ts:187 swarm title + publicSeatModel.test.ts:205 overflow expectation; the cap-fill fixture near publicSeatModel.test.ts:182-184.

Test-count note: target roughly +40 new tests in the new suite; the publicSeatModel edits modify (do not remove) existing tests, so the suite count rises. Per test-discipline, the final count is captured from the `Tests: … passed` line with exit 0 at implementation (GATE-B), not asserted here.

---

## Doctrine compliance

- **§1 (no verdict).** The model decides capacity and validity, never correctness. No string says winner / loser / true / false / liar / dishonest / bad faith / manipulative / extremist / propagandist. Visibility is an access property, not a verdict (QOL-039 header, 20260524000015:32-48). A reject is a structural "this is not a valid room to create", never a judgment of a person.
- **§5 (purity).** Pure TypeScript, no Supabase / React / network imports, no `async`, no clock, no randomness, frozen JSON-serializable output. Mirrors engine.ts:1-5 and the in-feature pure-model precedents. The same module runs identically on the client and in an Edge Function — the shared-validator requirement.
- **§6 (secrets).** None referenced or touched.
- **§7 (no AI).** No AI provider calls.
- **§8 (Supabase conventions).** No migration, no RLS change, no Edge Function, no direct client insert added by this card. Write-path enforcement is deferred to a sibling card that goes through RLS / Edge. No applied migration is edited.
- **§9 (plain language).** Internal reason codes are never echoed; `plainLanguageForCreationReason` maps them, reuses `plainLanguageForInviteError`, and falls back generically for unknown codes.
- **Account enumeration.** The model returns the same shape regardless of whether the invitee is an existing or new account — it never queries user existence; it only checks email shape and (optionally) self-match. The uniform-response guarantee is preserved; the downstream `manage-room-invite` already responds uniformly.
- **Raw email handling.** `normalisedDirectInviteEmail` is for the server / create-invite path; `maskedDirectInviteEmail` (via `maskInviteeEmail`) is the only form for any echo / list surface. The model never logs.
- **No token / link exposure.** The model never handles an invite token or link.
- **Email + password v1.** No OAuth implication.

---

## GATE-C + merge posture

- **Not deploy-bearing.** No migration, no Edge Function, no Deno / MCP server, no hosted-config write, no live send. **GATE-C (deploy gate) is N/A.**
- **Client-bundle behavior change.** The 6 → 5 reconcile changes GAME-005 runtime seating in the client bundle (Expo / Netlify). It ships via the normal bundle; no server smoke is required. If the operator wants belt-and-braces, the client-plane verify lane (Netlify bundle parity) covers it — no browser tooling needed.
- **Gate flow.** GATE-A (this doc) → GATE-B (implement; `npm run typecheck` + `npm run lint` + `npm run test` green, including the parity + updated publicSeatModel tests) → merge.
- **Merge posture: automerge-prefer.** Pure-TS, single net-new module plus one reconciling constant flip. The parity test self-gates the flip (suite red until `PUBLIC_ROOM_SEAT_CAP === PUBLIC_ACTIVE_PARTICIPANT_CAP === 5`). Once fully green, squash-merge.
- **Governance note.** This card changes a shipped guard constant (`PUBLIC_ROOM_SEAT_CAP`). That is not a silent self-approval of a failing guard: it is a **binding operator decision** (decision 2), recorded in the ADR above, and the new parity test prevents future silent drift. Per the pipeline-governance contract this is a GATE-A-recorded reconciliation, not an unannounced bar change.

---

## Risks

- **R1 — runtime seating change.** `PUBLIC_ROOM_SEAT_CAP` 6 → 5 reduces public chime-in capacity 4 → 3. Mitigation: `seat_count` copy uses a `{cap}` placeholder (publicSeatModel.ts:708-710) so rendered "of N" copy auto-follows; the implementer scans for any hard-coded literal `6` in seat copy / labels before merge.
- **R2 — multi-address split.** The `[,;\s]+` split on the single email field could in theory split a legitimate address — but a valid address has no whitespace (`normaliseInviteeEmail` rejects `\s`, inviteModel.ts:208) and the invite wire is single-email, so the split is safe and matches reality. Covered by the multi-email tests.
- **R3 — self-invite is best-effort in the pure layer.** It needs `creatorEmail`; if a create orchestrator forgets to pass it, the pure check is skipped. Mitigation: the authoritative self-invite guard stays server-side (manage-room-invite/index.ts:182-184); the enforcement card passes the session email; document the contract on `DeriveArgumentRoomCreationOptions`.
- **R4 — literal-union drift.** `ArgumentRoomCapacity = 2 | 5` and `openParticipantSlotsAfterCreation: 0 | 3 | 4` hard-code the reconciled cap. A future tuning card that changes the cap must update these unions together. Mitigation: the parity test pins `5`; the module header documents the coupling.
- **R5 — decision-only, not enforcement.** This card does not cap participants on the write path; until the sibling enforcement card lands, the matrix is advisory. Mitigation: the scope boundary is stated up front so no one assumes ARG-ROOM-001 enforces the cap. `is_debate_joinable` still checks only status (20260516000006), and `submit-argument` membership-existence has no count cap (submit-argument/index.ts:160-194) — both unchanged here.

---

## Open questions

- **OQ1 — flip placement.** Confirm the 6 → 5 publicSeatModel flip rides in ARG-ROOM-001 (parity-test-forced, as designed) rather than the enforcement card. The cap value (5) is already operator-decided; only card placement is in question. Recommendation: here.
- **OQ2 — composition outputs.** Keep `normalisedDirectInviteEmail` + `maskedDirectInviteEmail` on the derived shape (avoids a double-normalize at the create / invite seam), or keep the derived shape minimal and re-normalize downstream? Recommendation: keep.
- **OQ3 — multi-address policy.** Reject the whole field on 2+ addresses (`too_many_invites`, chosen) vs. accept-first-ignore-rest? Recommendation: reject (no silent drop).
- **OQ4 — private atomicity.** The matrix encodes that a private room requires one invite at creation; whether the create + invite is one atomic Edge transaction or a client create followed by `createRoomInvite` is the enforcement card's call. Flag for that card; ARG-ROOM-001 only encodes the rule.
- **OQ5 — copy home.** The two new strings live co-located in the new module (self-contained + scanned). `gameCopy.ts` (`ROOM_VISIBILITY_COPY`, gameCopy.ts:1604-1672) is the established room-copy home — move them there if the operator prefers one copy surface. Recommendation: co-locate now, lift later if a UI card consolidates.

---

## Operator-ratified acceptance (2026-06-13) — BINDING

The operator pinned the validator's behavior with concrete examples. These are the **binding acceptance contract**; where they differ from the design's earlier analysis on surface shape, **these win**. The design's reasoning above remains valid background.

**Canonical input shape:** `directInviteEmails: string[]` (an array, **max length 1**) — supersedes the earlier `directInviteEmail: string | null` "Alternatives" note. The array form is the public contract the UI passes and the backend mirrors; the validator detects `length > 1` and rejects with `too_many_direct_invites`. (Downstream the wire may still carry a single `inviteeEmail` — single-email transport parity is preserved internally; only the validator's *input* is the array.)

**Canonical reject reasons:** `private_requires_invite`, `too_many_direct_invites`, `invalid_email`, `self_invite`. (The design's `too_many_invites` is the same reason — use the ratified name `too_many_direct_invites`.)

**The five binding examples (pin the product in code before any backend/UI work):**

```ts
deriveArgumentRoomCreation({ visibility: 'private', directInviteEmails: [] })
// INVALID — reason: 'private_requires_invite'

deriveArgumentRoomCreation({ visibility: 'private', directInviteEmails: ['a@example.com'] })
// VALID — capacity 2, reservedInviteSeats 1, openSlots 0

deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: [] })
// VALID — capacity 5, reservedInviteSeats 0, openSlots 4

deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: ['a@example.com'] })
// VALID — capacity 5, reservedInviteSeats 1, openSlots 3

deriveArgumentRoomCreation({ visibility: 'public', directInviteEmails: ['a@example.com', 'b@example.com'] })
// INVALID — reason: 'too_many_direct_invites'
```

`openSlots` is the operator's name for the design's `openParticipantSlotsAfterCreation` (same field — keep one name, expose `openSlots` in the public type). The UI imports this validator; the backend (ARG-ROOM-002) has its own server validation but **must match the same matrix**, mirrored by tests.

**The four seat states are binding and must not be collapsed (the heart of the feature):** *active participant* (counts against the cap), *observer/reader* (uncapped, never a seat), *pending reserved invite seat* (held against the cap until accept/expire/revoke), *open public seat* (`cap − active − reserved`, self-claimable on public only). `public` is a **capped active-participant** room with unlimited observers — **not** an unbounded comment thread; `private` is a 1v1 that **requires** its one invite — **not** a hidden solo note. See roadmap §1 "The four seat states."
