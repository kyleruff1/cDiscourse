# QOL-038 — Design verification + enrichment assessment

**Status:** Verification pass (2026-05-24 designer phase)
**Base:** `main` HEAD `2d91b5a` (OPS-001 reviewer template strengthening).
**Original design:** [`docs/designs/QOL-038.md`](./QOL-038.md) (dated 2026-05-21).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/207
**Skill consulted:** `cdiscourse-doctrine` (invoked before any read or write per the agent contract).

---

## §0 — Purpose

The QOL-038 design predates five post-slate landings:

| PR / commit | Date | What changed |
|---|---|---|
| #252 MCP-CAT-001 | 2026-05-23 | SEMANTIC_CLASSIFIER_CATALOG expanded 23 → 35 ids. |
| #253 QOL-035 | 2026-05-23 | User-facing terminology scrub: `debate` → `argument`, `moderator` → `observer`/`admin`. |
| #254 band-space-rent smoke | 2026-05-23 | Post-MCP-CAT-001 smoke verification only. |
| #255 / #257 / #259 QOL-041 chain | 2026-05-23 | Concession list + acceptance gradient + fist-bump + migration in-place recovery. |
| #262 OPS-001 | 2026-05-24 | Reviewer template strengthened for migration-bearing cards. |

This document assesses the original design against the three questions named
in the QOL-038 designer addendum (backward compatibility, long-duration auth,
edge cases) and records whether enrichment is required or the design stands.
The verification deliberately does **not** replace the original design — it
sits beside it, and only one targeted enrichment is appended to the source
design (see §4).

---

## §1 — Q1: Backward-compatible invite links — **PASS**

> Does the invite link format the design specifies (`/invite/<token>`) break
> backward compatibility with any invite links that may already exist in user
> inboxes from prior product releases?

**Audit of the existing invite surface:**

| Surface | URL shape it emits | In-the-wild scope |
|---|---|---|
| `src/features/invites/InvitePanel.tsx` (Stage 6.1.0 placeholder) | None. `inviteCopy.ts` returns the static string `[room link — invite backend coming later]`. The "Copy room link" button only echoes the placeholder; no functional URL is produced or stored. | Zero — never a live link. |
| `supabase/functions/admin-users/index.ts` → `handleInviteUser` (QOL-024 admin invite) | Uses Supabase's `auth.admin.inviteUserByEmail()`. The link and token never enter function memory or the response — the link lives only in the Supabase email template and lands on the project's auth-callback URL (`/auth/callback`). | Admin-tool operator use only. Lands on `/auth/callback`, never on `/invite/<token>`. |
| `src/lib/auth/buildAuthRedirectUrl.ts` | Builds `/auth/callback?...` for `confirm_signup` / `recovery` flows. | The Supabase auth round-trip. Owns `/auth/callback` exclusively. |

**Finding.** The `/invite/<token>` route the QOL-038 design introduces is a
**new URL shape with zero prior in-the-wild collision surface.**

- The Stage 6.1.0 placeholder never emitted a functional URL, so no inbox
  contains a CDiscourse room-invite link of any shape today.
- The QOL-024 admin-invite path (used to create new human users from the
  admin UI) is operator-only and lands on `/auth/callback`, not on the new
  `/invite/<token>` path. The two paths solve different problems
  (administrative user creation vs. room invitation) and live on
  non-overlapping URL paths.
- The Supabase auth round-trip continues to use `/auth/callback` —
  QOL-038 §6.2 is explicit that the invite token is **not** appended to a
  Supabase email link and survives the round-trip in the persisted
  `pendingInviteIntent` session slice, not in the auth URL itself.

No transition-window deep-link handler is required. No older format needs
to be recognized.

**Design-doc location of the answer:** §4.4 (file changes), §6.2 (the link
itself), §6.3 (`pendingInviteIntent` is the auth-round-trip carrier — not
the URL). All three sections are accurate as of HEAD `2d91b5a`.

**Verdict:** **PASS — no enrichment required.**

---

## §2 — Q2: Long-duration auth flow — **PASS**

> Does the auth interruption handling account for the case where a user clicks
> an invite link, signs up, completes email confirmation, and returns several
> minutes or hours later?

**Audit of the four sub-cases:**

| Sub-case | Where the design handles it |
|---|---|
| 2a — Page reload during signup | §6.3 — `pendingInviteIntent` is persisted via `sessionStorage.ts`; cold start restores it; reducer preserves it across `SIGNED_OUT → SIGNED_IN`. The accept-on-first-signed-in trigger fires whenever the persisted intent is non-null. |
| 2b — Email confirmation roundtrip (close tab, return via confirmation email) | §6.4 "Email-confirmation wrinkle" — Supabase confirm flow re-enters via `/auth/callback`; the persisted intent is still present and the accept fires on the first *confirmed* signed_in state. Works whether Supabase email confirmation is on or off. |
| 2c — Browser restart on the same device | §6.3 persistence + §6.4 trigger — covered identically to 2a. |
| 2d — Cross-device (tap link on phone, complete confirmation on laptop) | The URL itself is the carrier — `/invite/<token>` is the durable medium that survives any device boundary. The laptop reads the URL on its own first cold start (§6.2), captures the token into its local `pendingInviteIntent`, and runs the same accept-on-first-signed-in flow. The token TTL (14 days, §4.1) bounds the realistic resume window. |

**Token TTL:** the design picks 14 days (§4.1). For live-conflict
de-escalation this is generous; the operator question in §15 already
surfaces the choice for confirmation.

**24h staleness drop on the local `pendingInviteIntent`:** §6.3 names this
explicitly — an intent older than 24h is dropped on read so a user
returning weeks later is not silently redirected. The token itself can
still be redeemed via a fresh tap on the URL (which re-captures a new
intent), so the 24h drop is a UX safety, not a hard cap on usable life.

**Design-doc location of the answer:** §6.3 (the persistence model), §6.4
(new-user flow with confirmation wrinkle), §6.5 (existing-user flow with
mismatch handling). All three are accurate as of HEAD `2d91b5a`.

**Minor observation for the implementer (no enrichment needed):** the
cross-device case (2d) is handled by the design but not named as a discrete
case. The implementer may want to add a one-line note in `InviteRedeemGate`
testIDs / accessibility text confirming the gate works without a prior
session — the §7.2 "Valid + signed out" state already covers this; no copy
or model change is required.

**Verdict:** **PASS — no enrichment required.**

---

## §3 — Q3: Edge cases — **GAP FOUND (Q3.2)**

> Does the post-auth landing logic handle these four edge cases?

| # | Case | Status | Where handled (or where the gap is) |
|---|---|---|---|
| 3.1 | Already-member (user already a participant in the room) | **PASS** | §10 row 6 — `accept` step 6 insert is a no-op via `(debate_id, user_id)` uniqueness; invite still flips to `accepted`; room opens normally. Existing role is preserved (the insert is a no-op, so the existing `side` is not downgraded). |
| 3.2 | **Soft-deleted room** (room removed between invite generation and click) | **GAP** | §10 row 8 names "room deleted" but assumes `on delete cascade` removes the invite — that path is correct for **hard** deletes. The DB-level reality is different: `debates.status` enum is `draft \| open \| locked \| archived` (per `supabase/migrations/20260516000001_initial_schema.sql` line 145). The "soft-delete" path for rooms is **transition to `archived`**, not row deletion. An archived room's invite row still exists; `lookup_by_token` and `accept` will find it; the design does not name what happens next. See §4 for the enrichment. |
| 3.3 | Expired token | **PASS** | §5.4 step 3, §5.5 step 3, §7.2 "Expired" state, §10 row 3 — token-shape valid but `expires_at < now()` returns `expired`; `InviteRedeemGate` shows "Ask <inviter> to send a new one." Clear copy, no crash. |
| 3.4 | Wrong-account collision (signed in to a different account than the invited address) | **PASS** | §5.5 step 4 (email-binding check), §6.5 (existing-user mismatch flow), §7.2 "Valid + signed in (email mismatch)" — explicit copy: *"This invite was sent to a different email address. Sign in with the address the invite was sent to, or ask <inviter> to re-send it to <your address>."* Plus a "Sign in as someone else" affordance that preserves the intent across sign-out. |

**Verdict:** **GAP FOUND for Q3.2 only — minimal enrichment appended to the
source design (see §4).**

---

## §4 — Enrichment summary

One targeted enrichment is appended to `docs/designs/QOL-038.md` as a new
final section titled **"QOL-038 design enrichment (2026-05-24 designer
pass)"**. It addresses the Q3.2 archived-room gap and does not contradict
or invalidate any other section of the existing design.

**Enrichment scope (verbatim summary):**

- Add an explicit `accept` / `lookup_by_token` branch for the case
  `debate.status = 'archived'`. The §5.1 (create) step 5 already rejects
  `locked`/`settled` rooms; the parallel rule for archived rooms at the
  read/accept boundary is missing.
- Introduce one new error code: `409 room_archived` (sibling to the
  existing `409 room_closed` from §5.6).
- Add one new `InviteRedeemGate` state: **"Room archived"** with copy
  *"This argument was archived and is no longer active. Ask <inviter> if
  there is a newer argument to join."* Mirrors the §7.2 expired-state
  shape (clear copy, "Go to my arguments" exit, never traps the user).
- Document the relationship between `archived` (soft-delete via status
  transition, the realistic case) and `on delete cascade` (hard delete,
  the §10 row 8 case) so the implementer handles both. The cascade-delete
  path stays correct; the archived-status path is the new explicit branch.
- Update §10 to add a new row distinguishing these two cases.

**Why this is the right enrichment (not a redesign):** the gap is a single
missing branch in the `accept` flow + one new error code + one new gate
state. Every other section of the original design (data model, RLS, the
five Edge Function actions, the auth round-trip, the seamless-entry
ordering doctrine, all other §10 edge cases, the §11 test plan structure)
stays correct as written. The implementer adds one branch, one code, one
gate state, and one test.

---

## §5 — Terminology refresh observations (for the implementer)

QOL-035 (#253, 2026-05-23) scrubbed `debate` → `argument` and
`moderator` → `observer` / `admin` from user-facing copy across the
codebase. **`src/features/invites/inviteCopy.ts` was NOT touched by
QOL-035.** The Stage 6.1.0 placeholder copy in that file contains several
strings the QOL-038 implementer must rewrite anyway (the design's §4.4
already calls for a rewrite of `inviteCopy.ts`). Flagging these for the
implementer so the QOL-038 rewrite does not regress against QOL-035:

| Existing string in `inviteCopy.ts` | Required by QOL-035 doctrine |
|---|---|
| `title: 'Invite a challenger'` | Use the design's §9 framing — *"Invite someone to respond"* / *"Invite to this argument"*. The word `challenger` is a banned framing per design §9 ("Take the other side"/`challenger` labels removed). |
| `subtitle: 'Invite someone to take the other side.'` | Replace with the design's §9 plain-language framing — the seat language is `intended_seat: 'respondent'`, surfaced as *"respond to the argument"*. |
| `inviteTextTemplate: 'You\'ve been invited to argue about: ...'` + `'Join the argument and take a side.'` | The design §9 invite email subject is *"You were invited to respond to an argument."* — the rewrite must match. |
| `INVITE_ROLE_LABELS: { challenger, supporter, observer, any }` | Per design §4.1, `role_or_side` → `intended_seat` enum (`respondent`/`co_primary`). The `challenger`/`supporter`/`observer` role labels are removed; only the `respondent` / `co_primary` mapping survives. |

The existing `__tests__/inviteCopy.test.ts` asserts the legacy labels are
present. The QOL-038 implementer rewrites both the source file and the
test file as part of the §11 "Doctrine" test reshuffle (the design names
`__tests__/inviteCopyDoctrine.test.ts` as the new replacement test). The
old `__tests__/inviteCopy.test.ts` is superseded by the new doctrine test
+ a UI test (`__tests__/InvitePanel.test.tsx`).

**Note on `debate` as an internal identifier:** the design correctly keeps
`debate_id` / `debate_participants` / `debates` table references intact
(internal-code exemption per QOL-035 commit message and
`docs/ux-storyboards/terminology-and-copy-rules.md`). The user-facing
strings in `InvitePanel` and the invite email body are the only places
the implementer must rewrite for terminology compliance.

---

## §6 — Companion-doc reference audit

The QOL-038 design references several companion docs. Verifying each is
still accurate as of HEAD `2d91b5a`:

| Companion doc | Referenced from | Status as of HEAD |
|---|---|---|
| `docs/invite-flow.md` | §1 (Stage 6.1.0 placeholder), §4.1 (table-shape draft), §13 (supersedes) | **Accurate.** The Stage 6.1.0 placeholder is unchanged since 2026-05-16; the "Future Invite Model" SQL sketch in lines 19–35 is the draft the design's §4.1 deviates from (deviations table is correct). |
| `docs/edge-functions.md` | §4.4 (documentation target), §12 (consumed helpers) | **Accurate.** The `submit-argument` and `annotate-evidence` patterns documented there are unchanged. The design's note that `manage-room-invite` follows the same `_shared/http.ts` shape + caller-scoped/service-role-split pattern is correct. |
| `docs/rls.md` | §4.4 (documentation target), §12 (consumed helpers) | **Accurate.** The policy table at lines 32–72 is the live reference; the design's §4.2 RLS proposal for `argument_room_invites` follows the documented `is_moderator_or_admin()` + `auth.uid()` pattern verbatim. |
| `docs/designs/QOL-030.md` | §0 (companion), §13 (not superseded by QOL-030) | **Accurate.** QOL-030 §6.2 names `root_claim` as the room-setup box and explicitly scopes the invite *backend* out (QOL-030 §1 "Out of scope"). QOL-030 §12 names the InvitePanel re-housing as a follow-up, not part of QOL-030. The two designs remain complementary. |
| `docs/ux-storyboards/roommates-dishes-public-argument.md` | §2 (source storyboard) | **Accurate** (not re-read this pass; the QOL-035 terminology scrub did not touch this file per the QOL-035 commit's file list). |
| `docs/ux-storyboards/band-space-rent-private-evidence-argument.md` | §2 (source storyboard) | **Accurate** (same reasoning). |

**No companion-doc updates are required for QOL-038 implementation.** The
docs the design names as *modified* (`docs/edge-functions.md`,
`docs/rls.md`, `docs/invite-flow.md`) are the right ones — the implementer
follows the design's §4.4 list.

---

## §7 — Doctrine self-check on this verification pass

This verification doc adds documentation only and does not propose any new
user-facing strings beyond the implementer-guidance examples in §5 (which
are copies of the original design's §9 framing). The doctrine constraints
from `cdiscourse-doctrine`:

- **§1 (no truth labels).** Zero banned tokens (`winner`, `loser`,
  `correct`, `true`, `false`, `liar`, `dishonest`, `bad faith`,
  `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`) in any
  added text.
- **§4 (AI moderator limits).** No AI is added to the invite flow by this
  verification pass.
- **§6 (secrets).** No secret value appears in any added text. The
  design's existing logging-rule discipline (§5.7) is unchanged.
- **§7 (no AI calls from production app).** The design's existing
  no-Anthropic / no-xAI guarantee is preserved by the enrichment.
- **§8 (Supabase conventions).** The enrichment does not propose any new
  migration. The Q3.2 fix is a function-layer branch + a new UI state, no
  schema change. RLS posture unchanged. Soft-delete-as-archived is the
  existing convention; the enrichment makes the flow explicit, not new.
- **§10 (v1 scope guards).** Nothing in this pass is v2. No voting, no
  search, no OAuth, no public API, no push notifications.

---

## §8 — Cascade-test implications

The OPS-001 reviewer template strengthening (PR #262) introduces a
mandatory "Migration-bearing card verification" gate. QOL-038 ships a
migration (`20260521000010_qol038_argument_room_invites.sql`, ~55 lines).
The QOL-038 review will therefore trigger the new gate. The implementer
and reviewer should expect:

- The reviewer either runs `npx supabase db reset --linked=false` locally
  (if Docker is available) or performs the four-class heightened textual
  review against the migration.
- The four classes to scan are: ambiguous column references in subqueries
  (the QOL-041 motivating example), column type mismatches, implicit
  ordering dependencies, and function/trigger/extension dependencies.
- The QOL-038 migration as designed in §4.1 uses qualified references
  throughout the RLS policies (e.g. `argument_room_invites.debate_id`
  vs `d.id`) so the ambiguous-column class should not trigger. The
  `gen_random_uuid()` reference assumes `pgcrypto` is available — true
  in Supabase by default but worth noting in the migration's header
  comment for the heightened-review path.

No design change is required to satisfy OPS-001; the existing design's
RLS proposal is already well-qualified. This is a procedural note for the
QOL-038 implementer/reviewer pair, not a design gap.

---

## §9 — Summary

| Question | Verdict | Action |
|---|---|---|
| Q1 — Backward-compatible invite links | **PASS** | No change. `/invite/<token>` has zero collision surface; admin-invite uses `/auth/callback` only. |
| Q2 — Long-duration auth flow | **PASS** | No change. All four sub-cases (page reload, email confirmation, browser restart, cross-device) are covered by §6.3 persistence + the URL itself as cross-device carrier. |
| Q3 — Edge cases (4 sub-cases) | **PASS for 3 of 4; GAP for Q3.2** | One enrichment appended to `docs/designs/QOL-038.md`: explicit handling for `debate.status = 'archived'` (soft-delete path), one new error code `409 room_archived`, one new `InviteRedeemGate` state. |
| Terminology refresh | Note for implementer | The §4.4 `inviteCopy.ts` rewrite must reconcile with QOL-035 doctrine — five legacy strings + the `INVITE_ROLE_LABELS` constant flagged in §5 above. |
| Cascade-test implications | Note for implementer / reviewer | OPS-001's migration-bearing-card gate applies. The design's RLS policies are already well-qualified; the migration's `pgcrypto` assumption should be noted in the file header. |

The design at `docs/designs/QOL-038.md` stands as authored, with the one
appended enrichment section. The implementer should treat this
verification doc + the enriched original design as the complete design
input for the QOL-038 implementation phase.
