# ARG-ROOM-007 — Live-smoke matrix (end-to-end verification)

Status: Design draft
Epic: Room Visibility & Invite (`ARG-ROOM-VISIBILITY-INVITE` slate)
Release: 6.7
Issue: #618 — https://github.com/kyleruff1/cDiscourse/issues/618 (**operator-rescoped**: the originally-filed #618 title was "visibility / invite / capacity plain-language copy + doctrine pass"; this card supersedes it with the **live-smoke matrix / end-to-end verification** scope. The plain-language copy pass is already satisfied on `main` — `ARGUMENT_ROOM_CREATION_COPY` `argumentRoomCreationMatrix.ts:365-370`, `gameCopy.toPlainLanguage` `gameCopy.ts:203-204` — and is treated here as a *thing-to-verify*, not a thing-to-author.)
Baseline: `main @ 8929bde` ("feat(ARG-ROOM-003): visibility + one direct invite on the live create surface (#614) (#624)")
Stamp: 2026-06-13
Doctrine anchors: `cdiscourse-doctrine` §1 (no winner/loser/truth/verdict copy — capacity/seat/heat/visibility are *structure*, never judgment), §2-3 (heat / popularity are never an input to access or seating), §6/§8 (no service-role in client or scripts; RLS on every table, never disabled; migrations append-only), §9 (plain language via `gameCopy`; unknown codes suppressed), §10a (four node-label states not collapsed); roadmap `2026-06-13-public-private-argument-room-invites-roadmap.md` §1 (the **four seat states**), §5 (no enumeration, no raw token in response/log, GATE-C on 002/004). `src/lib/constitution/engine.ts` immutability is **not engaged** — this card touches no engine, transition matrix, or constitution version.

---

## Goal

Prove, end-to-end against the **deployed** stack, that the full public/private argument-room invite feature behaves exactly as the binding matrix says — once ARG-ROOM-002 (deployed), 003, and 004 are merged/deployed and the operator has **intentionally armed** the live invite/email gates.

This card delivers a **protocol** (a 12-check live-smoke matrix with exact preconditions / action / expected result / browser-free verification per check) plus a **harness** (a dry-run-default Node operator tool that authenticates as JWT accounts and exercises the deployed Edges + RLS reads) plus a **committable report shape**. It is **verification only**: no production behavior, no migration, no Edge change, no RLS change, no gate flip. The live run is **operator-armed**; this card does not self-arm and does not run the matrix as part of its merge.

It mirrors, and extends, the data-plane discipline already proven in `docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md` (7/7 via admin/bot JWTs against the deployed Edge) and `docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md` (devtest98 branded-invite → `/auth/callback` → set-password loop).

---

## Product contract (restated — the binding invariant + the four seat states)

> One direct invite at creation. Private rooms are 1v1 (max 2 active participants). Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants. Max one direct invite per room.

The matrix the smoke must reproduce against the live DB (`argumentRoomCreationMatrix.ts:14-19`; migration header `20260613000001…sql:31-38`):

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
|---|---|---|---|---|---|
| Private | 0 | 0 | 0 | 2 | **No** — private requires one invite |
| Private | 1 | 1 | 0 | 2 | **Yes** (default) |
| Public | 0 | 0 | 4 | 5 | **Yes** |
| Public | 1 | 1 | 3 | 5 | **Yes** |
| any | 2+ | — | — | — | **No** — max one direct invite |

**The four seat states the smoke must keep distinct (never collapse — roadmap §1):**
1. **Active participant** — `debate_participants.side ∈ {affirmative, negative, moderator}`. Counts against the cap (2 private / 5 public). (`count_active_participants` `…sql:117-128`.)
2. **Observer / reader** — `side = observer`. Never active, **uncapped**, never a seat. The capacity trigger short-circuits observers (`enforce_room_capacity` `…sql:224-226`).
3. **Pending reserved invite seat** — a live `argument_room_invites` row (status `pending`, unexpired). Reserves one cap seat; accepting converts-not-double-counts (`count_reserved_invites` excludes the invitee's own invite, `…sql:168-192`).
4. **Open public seat** — `cap − active − reserved` (`openSlotsAfterCreate` `roomCapacityModel.ts:79-86`).

Every smoke check below asserts one of these states, and the report copy describes seats/capacity as **structure** ("full", "3 open seats"), never a verdict.

---

## Existing shipped state (file:line — what to REUSE; what 002/003/004 already cover)

The enforcement is **already real**; this card only observes it. Reuse, do not rebuild.

**Server enforcement (ARG-ROOM-002, DEPLOYED — migration `20260613000001` + `create-argument-room` Edge):**
- `enforce_room_capacity()` BEFORE INSERT trigger on `debate_participants` — fires for **every** writer incl. service-role accept (`…sql:211-265`); raises `room_capacity_reached` (ERRCODE `check_violation` = SQLSTATE `23514`) when `active + reserved + 1 > cap` (`…sql:245-249`). Observers + already-seated short-circuit (`…sql:224-233`).
- Derived cap `room_active_seat_cap` private 2 / public 5 (`…sql:94-104`); reserved-seat count `count_reserved_invites` (`…sql:168-192`).
- One-live-invite-**per-room** unique index (`argument_room_invites_one_live_per_room`, `…sql:273-275`).
- Tightened participants INSERT policy — client self-join is **public-only** (`is_debate_private(debate_id)=false`, `…sql:282-291`).
- `create_argument_room(...)` RPC, `service_role`-only, atomic room+creator+optional-invite, re-asserts `private => invite` (`…sql:299-369`).
- Direct client `debates` INSERT policy **dropped** (`…sql:391`) — the door is closed (live-proven 42501).
- `create-argument-room/index.ts`: strict ≤1-invite Zod schema (`:50-65`), `private_requires_invite` 400 (`:124-126`), `cannot_invite_self` 400 (`:129-131`), `room_capacity_reached` 409 (`:177-179`), `inviteLink` (raw token) returned **only to the creator, only at create** (`:189-211`), logs short-ids + email **domain only** (`:197-204`).
- Pure twins: `roomCapacityModel.ts` (`roomActiveSeatCap` `:42-48`, `canJoinActive` `active+reserved+1<=cap` `:95-103`); `publicSeatModel.PUBLIC_ROOM_SEAT_CAP=5` (`:67`), `PRIMARY_SEAT_COUNT=2` (`:73`); matrix `PUBLIC_ACTIVE_PARTICIPANT_CAP=5` (`argumentRoomCreationMatrix.ts:62`).

**What the 002 live smoke already proved** (so this card does not re-litigate, only re-confirms cheaply): B1 public+no-invite 200; B2 private+1-invite 200 (reserved); B3 private+no-invite `400 private_requires_invite`; MAX1 2+ invites `422 validation_failed`; SELF `400 cannot_invite_self`; DOOR direct `debates` insert `42501`; **B6 over-cap join `23514 room_capacity_reached` at the private cap of 2** (`docs/testing-runs/2026-06-13-arg-room-002-gatec-deploy-smoke.md:25-36`). The **same trigger function** enforces the public cap of 5 — the cap-5 checks below exercise it at 5.

**Invite create/accept (QOL-038 + ARG-ROOM-004):**
- `manage-room-invite/index.ts` — five actions (`:91-103`), `verify_jwt=false` per-action (`config.toml:427-428`). `handleAccept` is the security spine: email-binding `callerEmail === invite.invitee_email_lower` → `403 invite_email_mismatch` (`:561-563`); idempotent re-accept (`:547-558`, 23505 `:600-607`); enrol opposite side (`:585-599`); flip to accepted (`:609-617`); audit emits **emailDomain only** (`:626-630`). `lookup_by_token` (unauth) returns `tokenEcho` = the caller's own token (`:469`, `:501`) and `list_for_debate` deliberately **omits** `token_hash` (`:407-413`).
- ARG-ROOM-004 (the orchestration this smoke verifies, `docs/designs/ARG-ROOM-004-…md`): new-user redirect `…/auth/callback?invite=<token>` (§a), existing-user Resend email with the reconciled working link (§b, closing `room-notifications/index.ts:416` `inviteLink=null`), **uniform no-enumeration create response** (§c), `_shared/inviteEmail.ts` lifted from `maybeSendInviteEmail` (gate `INVITE_EMAIL_ENABLED`+`RESEND_API_KEY`+`INVITE_EMAIL_FROM`, `room-notifications/index.ts:238-243`, `not_configured`→no network `:239`, never logs key/body/recipient `:227-228`,`:298-316`). Both transport gates land **OFF**.

**New-/existing-user return path (#607/#608, shipped + smoke-passed):**
- `consumeAuthCallback.ts` returns `needs_password` for exactly `type=invite` (`:52-54`, `:118`); `pendingInviteIntent.ts` capture + 24h freshness (`:63`, `:70-78`, `:102-111`); the in-browser loop is operator-proven (devtest98, `2026-06-13-auth-live-invite-seed-smoke.md:58-68`); hosted Site URL + redirect allow-list already corrected (`:46-50`).

**Client API (the data-plane targets):** `createArgumentRoom` → `create-argument-room` Edge (`debatesApi.ts:149-185`); `joinDebate` client self-join insert (`:236-262`, 23505 reuse `:70-72`).

**Operator-smoke discipline to mirror:** `scripts/auth/sendInviteSmoke.js` — dry-run default (`:127-140`), `fingerprint` present+length-only (`:60-65`), redirect allow-list + `/auth/callback` (`:101-123`), live path authenticates as a JWT account and reads **no service-role** (`:236-276`), `kyleruff+devtestNN@gmail.com` seed shape (`:51`). Accounts loader: admin + bots **A/B (required), C (optional)** (`scripts/bot-fixtures/loadEnv.js:8-17`, `:63`) → **4 accounts exist today**.

**ARG-ROOM-003 caveat:** merged on `main` (`8929bde`) but the *live UI* is **not yet shipped to users** (frontend deploy gated on #625 / QOL-040). The smoke is **data-plane** (calls Edges directly), so it does not need the UI for the create/accept checks; only the operator-confirmed **browser leg** of the new-/existing-user checks needs the deployed 004 bundle (see those checks).

---

## Net-new vs already-shipped

| Area | Already shipped (do NOT rebuild) | Net-new in ARG-ROOM-007 |
|---|---|---|
| Cap / private-requires-invite / one-invite / self-invite / door-closed enforcement | **All of it** — 002 migration + Edge + 002 live smoke (B1-B6, DOOR, MAX1, SELF) | Nothing — re-confirmed live at the **public** cap of 5 (002 proved it at the private cap of 2) |
| Invite mint / accept / email-binding / idempotency | manage-room-invite (QOL-038) | Nothing — exercised, not changed |
| Email transport + new-/existing-user bridge + uniform response | ARG-ROOM-004 (`_shared/inviteEmail.ts`, `?invite=` bridge, no-enum response) | Nothing — **verified** against the deployed 004 |
| Browser invite loop (email→callback→set-password→auto-accept) | #607/#608, devtest98 | Nothing — re-confirmed for the room-seat case |
| Plain-language copy / ban-list | `ARGUMENT_ROOM_CREATION_COPY`, `gameCopy.toPlainLanguage`, `_forbidden*Tokens` | Nothing — **asserted** (no verdict tokens surface) |
| **A live-smoke protocol + harness + report** | — | **The whole deliverable**: the 12-check matrix, the dry-default JWT harness (`scripts/arg-room-live-smoke/`), the pure expected-result table + tests, the committable report template, the operator-arm/disarm runbook |

The card adds **zero** product code. Everything net-new lives in `scripts/`, `__tests__/`, and `docs/`.

---

## The live-smoke matrix (the protocol)

Every check is verified **without a browser**: the harness signs in as a JWT account (admin / bot / devtest, via `@supabase/supabase-js`, `persistSession:false`) and either invokes a deployed Edge (`supabase.functions.invoke`) or does an RLS-scoped table read — exactly as the 002 smoke did. Rooms are created via the `create-argument-room` Edge (**never** a direct `debates` insert — sidesteps #623 entirely). Test rooms carry the title label `[ARG-ROOM-007 smoke 2026-06-13]` and are archived (status flip, **never** hard-deleted) in disarm.

Status codes are the deployed contract: `200` ok; `400` `private_requires_invite` / `cannot_invite_self`; `409` `room_capacity_reached`; `422` `validation_failed`; `403` `invite_email_mismatch`; `23514` (trigger) / `42501` (RLS) on direct table writes.

| # | Check | Accts | Preconditions / gates | Action (data-plane) | Expected | Browser-free verification |
|---|---|---|---|---|---|---|
| **1** | Public, no invite, create | 1 (creator) | none | `create-argument-room` `{visibility:'public'}` | `200` `{debateId, visibility:'public', inviteId:null, inviteLink:null}` | RLS read: 1 active row (`side=moderator`), 0 pending invites; `openSlots`=4 (`roomCapacityModel`) |
| **2** | Public, one invite, create | 1 + 1 invitee email | none (gates OFF ok) | `create-argument-room` `{visibility:'public', invite:{email:botB}}` | `200` `inviteId` set, `inviteLink` present (creator only) | RLS read: 1 active + 1 pending invite (reserved); `openSlots`=3 |
| **3** | Private, one invite, create | 1 + 1 invitee email | none | `create-argument-room` `{visibility:'private', invite:{email:botB}}` | `200` `inviteId` set, reserved seat | RLS read: 1 active + 1 pending = cap 2 reached; `openSlots`=0 (matches 002 B2) |
| **4** | Private, no invite → forced reject | 1 | none | `create-argument-room` `{visibility:'private'}` (no invite) | `400 private_requires_invite` | response code; RLS read: **no** `debates` row created (matches 002 B3) |
| **5** | **Public cap at 5 — 6th active refused** | **≥6** | a public room from #1 (status `open`) | creator + 4 distinct accounts self-join active (`joinDebate` side aff/neg) → 5 active; 6th account self-joins active | first 5 → `200`; **6th → `23514 room_capacity_reached`** | RLS read: exactly 5 active rows; the 6th insert error code `23514`. Same trigger 002 proved at cap 2 |
| **6** | Reserved-invite-seat acceptance | 2 (creator + invitee) | a room from #2/#3 with a pending invite to the invitee's email; raw token from #2/#3 `inviteLink` | sign in **as the invitee** → `manage-room-invite` `{action:'accept', token}` | `200` `{status:'accepted', enteredAsParticipant:true}` | RLS read: invite flips `pending`→`accepted`; invitee now active on the opposite side; active+reserved never exceeded cap during convert (own invite excluded, `…sql:183`) |
| **7** | Observer into a **full** public room | **≥6** (reuses #5's 6th) | the now-full 5-active public room from #5 | the 6th account (refused as active in #5) self-joins `side=observer` | `200` (observer enrol succeeds) | RLS read: a 6th `debate_participants` row `side=observer`; active count still 5 (observers uncapped, `…sql:224-226`) |
| **8** | Wrong-user invite recovery | 2 (invitee + a different account) | a pending invite addressed to invitee's email; raw token | sign in as a **different** account → `accept` with that token | `403 invite_email_mismatch` | response code; RLS read: invite still `pending`; no participant row for the wrong user (`…index.ts:561-563`) |
| **9** | **New-user** invite callback (email → `/auth/callback` → set password → auto-accept) | 1 fresh devtest alias (no account) | ARG-ROOM-004 deployed; **operator-armed** new-user transport (hosted Auth invite / SMTP); deployed bundle carries the 004 `?invite=` handoff | (a) create-time invite to a **fresh** `kyleruff+devtest90@…`; (b) operator completes email→callback→set-password in a browser; (c) harness signs in **as the new account** → `accept` with the bridged token | (a) `200` uniform; (b) **operator-confirmed** account created + password set (mirrors devtest98); (c) `200 accepted` + seat | (a)+(c) data-plane (harness). (b) **operator-confirmed** (browser set-password is not Claude-automatable) + code-pinned: `consumeAuthCallback` `needs_password` only for `type=invite` (`:52-54`), `extractBridgedInviteToken` unit tests (004). The seat-join half (c) is the **same** `accept` Edge the in-app auto-accept fires |
| **10** | **Existing-user** invite flow | 2 (creator + existing invitee account) | invitee email = an existing account (bot/devtest); 004 deployed; transport gate state recorded | create-time invite to the existing email → invitee signs in → `accept` | invite `200`; `accept` `200 accepted`; if email gate ON, `notification` value recorded (no per-branch deliverability leak, 004 §c) | data-plane: invite row + accept + seat via RLS reads |
| **11** | **No enumeration** (uniform responses) | 1 existing email + 1 fresh email | 004 deployed; **same gate posture** for both calls | run the create-time-invite flow once with an **existing** account email, once with a **fresh unregistered** email | **byte-identical response shape + status + `notification` value**; only opaque `inviteId`/`inviteLink` differ | harness deep-diffs the two JSON responses (keys + status + `notification`); asserts equal (004 §c; mirrors `admin-users` uniform `buildInviteResponse`) |
| **12** | **No token leakage** (no raw token/link in any response or log) | 1 | a room with a pending invite | (a) `list_for_debate` as inviter; (b) `lookup_by_token` with a token; (c) inspect every harness-captured response | (a) **no** `token`/`token_hash` field; (b) `tokenEcho` = the **caller's own** supplied token only (not a new disclosure); (c) raw token appears **only** in the create-time `inviteLink` to the creator | harness scans every captured response body for the raw token / a JWT-shape / `Bearer` / hash; asserts absent except the create `inviteLink`. **Log half** = operator-confirmed via Deno log inspection (short-id + email-domain only, `create-argument-room:197-204`, `manage-room-invite:626-630`) **+** code-pinned by the 004 no-secret-in-log tests |

**Regression re-checks (cheap; already proven by 002 — included so the matrix is complete, flagged not-net-new):** R1 `MAX1` 2+ invites → `422 validation_failed`; R2 `SELF` invite-to-caller → `400 cannot_invite_self`; R3 `DOOR` direct `debates` insert → `42501`.

### Accounts that need ≥6 distinct accounts, and how to provision

**Only checks #5 and #7 need ≥6 distinct JWT accounts** (5 to fill the public cap + a 6th that is first **refused as active**, then **succeeds as observer** — so one 6th account covers both checks). All other checks run within the 4 accounts that exist today (admin + bots A/B/C, `loadEnv.js:63`).

Two provisioning options (the design recommends **(A)** for a true live proof, with **(B)** already satisfied as the fallback):

- **(A) Provision 2 more accounts (recommended).** Create `CDISCOURSE_BOT_D/E_*` (or reuse the `kyleruff+devtestNN@gmail.com` seed shape, `sendInviteSmoke.js:51`) so the harness has 6 JWT logins. These are real authed accounts that self-join the **public, RLS-gated** path (`joinDebate`), proving the cap exactly as a user would hit it. Store creds in the gitignored `.env.bot-tests`; document the keys in `.env.bot-tests.example` if present (no values). **No service-role** — these are ordinary user logins.
- **(B) Mark #5/#7 test-covered (already true).** If only 4 accounts exist: (i) the **same** `enforce_room_capacity` trigger is **live-proven** at the cap by 002 B6 (`23514` at private cap 2; the cap value is the only difference, computed by `room_active_seat_cap`); (ii) `roomCapacityModel` parity tests pin `roomActiveSeatCap('public')===5` and `canJoinActive(5,0,5)===false`; (iii) `publicSeatModel`/`argumentRoomCreationMatrix` pin cap 5. The harness emits `accounts_insufficient → covered_by: [002-B6, roomCapacityModel-parity]` for #5/#7 rather than a false PASS. **Do not** substitute a service-role seat-fill script — that would put a service-role key in a script (doctrine §6 violation); seat-filling must use real JWT self-joins.

---

## Operator-arm + disarm runbook (gates the operator flips; this card does NOT flip them)

The harness is dry-run by default and refuses live execution unless armed. **Claude never arms these** (STOP-AT-PR).

**Preconditions to confirm before arming (record in the report header):**
1. 002 deployed (already true), 003 merged, **004 merged + auto-deployed** (`manage-room-invite` / `room-notifications` / `create-argument-room` registered in `config.toml:427,437,460` → merge=deploy).
2. For check #9's browser leg only: the deployed Netlify bundle contains the 004 `?invite=` handoff markers (mirror the bundle-marker check in `2026-06-13-auth-live-invite-seed-smoke.md:16`); hosted Site URL + redirect allow-list already Netlify-correct (`:46-50`).

**Arm (operator, only for the email-bearing checks #9/#10/#11):**
- Harness live mode: `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1` **and** CLI `--live` (mirrors `sendInviteSmoke.js:148`,`:173`).
- Existing-user Resend transport (#10/#11, optional — checks pass with gate OFF too, recording `notification:'not_configured'`): set `INVITE_EMAIL_ENABLED=true` + `RESEND_API_KEY` + `INVITE_EMAIL_FROM` on the deployed function (`room-notifications/index.ts:238-243`).
- New-user Auth invite (#9): the hosted Auth SMTP / invite send (the same path devtest98 used); subject to the low hosted email rate limit (`auth-live-invite-seed-smoke.md:70-74`) — keep #9 to **one** fresh alias per run.

**Disarm / reset after the run (operator):**
1. Unset `INVITE_EMAIL_ENABLED` (or the env you flipped) back to OFF — QOL-040 owns the durable flip; the smoke leaves it as found.
2. Archive every `[ARG-ROOM-007 smoke 2026-06-13]` room (status → `archived`, **never** hard delete; doctrine §8). The cap-5 public rooms (#5/#7) are `open` and briefly user-visible during the run — archive immediately after; prefer a low-traffic window.
3. Revoke any leftover **pending** invites minted by the run (`manage-room-invite` `revoke`, status flip).
4. Optionally soft-delete the fresh devtest alias from #9 via the admin surface (leftover passwordless account, as in `auth-live-invite-seed-smoke.md:85`).
5. Unset `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE`.

---

## Committable report shape — `docs/testing-runs/2026-06-13-arg-room-live-smoke.md`

The harness prints a redacted result block; the operator pastes it into this template (mirrors the 002 + auth smoke docs). The report carries **no** raw token/link, **no** secret value (present+length only), **no** verdict token, and masked emails only.

```
# ARG-ROOM-007 — live-smoke matrix (2026-06-13)

## Header
| Field | Value |
| Cards under test | ARG-ROOM-002 (deployed) · 003 (merged) · 004 (deployed) |
| HEAD SHA | <sha> (main == origin/main) |
| Harness | scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live |
| Gates armed | INVITE_EMAIL_ENABLED=<on/off>; new-user Auth send=<on/off> |
| Accounts | admin + bot A/B/C (+ D/E if provisioned) — N distinct |
| Outcome | SMOKE k/12 PASSED (+3 regression) |

## Preconditions (all confirmed before arming)
| Gate | Result | Evidence |

## Results
| # | Check | Accts | Expected | Actual | Result |
|  1 | public/no-invite create | 1 | 200 | … | PASS |
|  … |
| R1-R3 | regression (MAX1/SELF/DOOR) | … |

## Account-limited checks (#5/#7)
<live-proven with ≥6 accounts | covered_by 002-B6 + roomCapacityModel parity>

## No-enumeration (#11) — response diff
<keys+status+notification identical; only inviteId/inviteLink differ>

## No-token-leakage (#12)
<response scan clean; log half operator-confirmed via Deno logs>

## Cleanup / disarm
<rooms archived; invites revoked; gates reset; devtest alias note>

## Follow-ups
<#623 bot-fixture migration if seat-filling reuse is wanted; any residuals>
```

---

## Data / API shape (harness module — pure where applicable; mirrors `engine.ts` discipline)

All net-new code is under `scripts/arg-room-live-smoke/` (CommonJS, like `sendInviteSmoke.js`) — **no production `src/`**. The expected-result matrix, plan resolution, redaction, and report rendering are **pure** (no network, no clock, exported, unit-tested); the **only** I/O is the live execution behind the armed gate + `require.main` entry.

**`scripts/arg-room-live-smoke/smokeMatrix.js` (pure data + helpers):**
```
SMOKE_CHECKS: ReadonlyArray<{
  id: string;                 // 'public-no-invite-create' … 'no-token-leakage'
  title: string;
  accountsNeeded: number;     // 1 | 2 | 6
  needsSixAccounts: boolean;  // true for #5, #7
  gateDependent: boolean;     // true for #9/#10/#11 (email-bearing)
  expected: { status?: number; code?: string; sqlState?: string };
  verify: 'edge_response' | 'rls_read' | 'response_diff' | 'response_scan' | 'operator_confirmed';
  coveredByIfInsufficientAccounts?: string[]; // ['002-B6','roomCapacityModel-parity']
}>;
// 12 checks + 3 regression entries, frozen.
function expectedForCheck(id): {...} | null;     // pure lookup
function checksRequiringSixAccounts(): string[];  // ['public-cap-5-refuse-6th','observer-into-full-public']
```

**`scripts/arg-room-live-smoke/plan.js` (pure):**
```
function resolveSmokePlan(args, env): { mode:'dry_run'|'live'|'refused', reason?, checks, accounts }
  // live requires --live AND env.CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE==='1' (mirror sendInviteSmoke:147-184)
function buildRedactedPlan(plan, env): {...}  // fingerprint() present+length only (reuse sendInviteSmoke:60-65)
function fingerprint(value): {present:boolean, length?:number}
```

**`scripts/arg-room-live-smoke/report.js` (pure):**
```
function renderReport(results): string         // the markdown above; no raw token/secret/verdict
function scanForSecretLeak(captured): string[] // returns offending fields; '' clean (token/JWT/Bearer/hash regex)
function _forbiddenReportTokens(): string[]    // reuse the matrix ban-list (argumentRoomCreationMatrix:406-439)
```

**`scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js` (CLI; I/O only behind the gate):** dry-run prints the redacted plan + the matrix; live signs in as each JWT account, runs each check in dependency order (create → reserve → accept → fill → observer), captures every response, runs `scanForSecretLeak`, and prints the report block. Reads **no** service-role; authenticates with email+password from `.env.bot-tests` (reuse the `loadEnv.js` env names but a **self-contained** reader so `scripts/bot-fixtures/` — #623 territory — is untouched).

**`package.json` scripts:** `"smoke:arg-room:dry"` (default), `"smoke:arg-room:live"` (mirrors `bot:fixture:*` naming).

---

## File changes

| File | Change | Gate |
|---|---|---|
| `scripts/arg-room-live-smoke/smokeMatrix.js` | **New.** Frozen 12+3 check table + pure lookups. | Standard |
| `scripts/arg-room-live-smoke/plan.js` | **New.** Pure plan resolution + redaction (dry default; live gated). | Standard |
| `scripts/arg-room-live-smoke/report.js` | **New.** Pure report renderer + secret-leak scanner + ban-list. | Standard |
| `scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js` | **New.** CLI; I/O only behind `--live` + armed env; no service-role; rooms via Edge only. | Standard |
| `__tests__/argRoomLiveSmoke.test.js` | **New.** Pure tests (matrix completeness, plan gating, redaction, report ban-list + no-raw-token). | Standard |
| `docs/testing-runs/2026-06-13-arg-room-live-smoke.md` | **New (template only).** Filled by the operator-armed run, not this card. | Standard |
| `docs/designs/ARG-ROOM-007-LIVE-SMOKE-MATRIX.md` | **New.** This doc. | Standard |
| `.env.bot-tests.example` | **Edit if present** — add `CDISCOURSE_BOT_D/E_*` + `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE` key names (no values). | Standard |
| `package.json` | **Edit** — add `smoke:arg-room:dry/:live`. | Standard |

**No `supabase/**` file is touched** → **NOT GATE-C** (standard-gated). No migration, no Edge change, no RLS change, no `config.toml` change, no production `src/` change.

---

## Edge cases

- **`create_argument_room` makes `open` rooms** (`…sql:335`), so cap-5 public rooms are joinable **and** briefly user-visible during #5/#7 (unlike the 002 smoke's draft rooms). Mitigation: distinctive title label + immediate archive in disarm + run in a low-traffic window.
- **Reserved-vs-active double-count at accept (#6):** the invitee's own pending invite is excluded from the reserved count (`count_reserved_invites` `p_exclude_email`, `…sql:183`), so converting reserved→active never transiently exceeds the cap. The smoke asserts active+reserved ≤ cap at every step.
- **Idempotent accept (#6/#9/#10):** a second `accept` by the same redeemer returns `200` (23505 swallowed, `…index.ts:600-607`) — the harness treats a repeat as PASS, not a duplicate seat.
- **`tokenEcho` is not a leak (#12):** `lookup_by_token` reflects the caller's **own** supplied token; the scanner whitelists "token equals the token this caller just sent." A token belonging to a *different* invite in a response is a FAIL.
- **Auth email rate limit (#9):** hosted limit is low (`auth-live-invite-seed-smoke.md:70-74`); cap #9 to one fresh alias per run; a rate-limited send still mints the row + link, so acceptance via the copyable link still proves the seat-join half.
- **004 send seam location:** if the deployed 004 emits the create-time-invite email from `manage-room-invite handleCreate` (per the 004 design) rather than from `create-argument-room`, the #9/#10/#11 email-bearing steps must drive **whichever** path 004 wired — a precondition step records which Edge emits the email (see Open questions). The **accept** is always `manage-room-invite accept`.
- **Insufficient accounts:** #5/#7 emit `accounts_insufficient → covered_by:[…]`, never a false PASS or a false FAIL.
- **Gate left armed:** disarm step 1 returns `INVITE_EMAIL_ENABLED` to OFF; the report header records the as-found and as-left state.

---

## Test plan (each labeled pure-model / integration-mocked / live-provable)

All authored tests are **pure / mocked** (jest, no live network — Claude runs no live xAI/Anthropic/X/Supabase write). The live matrix is the operator-armed artifact.

- **pure-model** — `smokeMatrix.test.js`: all 12 brief checks + R1-R3 present; `needsSixAccounts` true **only** for `public-cap-5-refuse-6th` and `observer-into-full-public`; every check has an `expected` and a `verify` mode; `coveredByIfInsufficientAccounts` set on #5/#7.
- **pure-model** — `plan.test.js`: dry-run by default; `--live` without `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1` → `refused`; `buildRedactedPlan` carries **no** secret value (only `{present,length}`); no raw token field in the plan.
- **pure-model** — `report.test.js`: `renderReport` emits **no** `_forbiddenReportTokens` (reuse `argumentRoomCreationMatrix:406-439` — winner/loser/true/false/liar/troll/bot/popular/trending/viral/…); `scanForSecretLeak` flags a planted raw token / JWT-shape / `Bearer` / sha-256 hex, and returns clean for a token equal to the caller's own supplied token.
- **integration-mocked** — `runArgRoomLiveSmoke.refusal.test.js`: with `require.main` not set, requiring the module performs **no** network and exports the pure helpers; the runner refuses (no sign-in) when not armed; rooms are created via `functions.invoke('create-argument-room')` (mock), **never** a `.from('debates').insert` (asserted absent — proves #623-independence); no `service_role` / `SERVICE_ROLE` / `Authorization` literal anywhere in the file.
- **live-provable (operator-armed; NOT run by Claude)** — checks #1-#12 + R1-R3 against the deployed stack, captured in `docs/testing-runs/2026-06-13-arg-room-live-smoke.md`. #9's browser set-password leg is **operator-confirmed** (mirrors devtest98); its seat-join half is harness-data-plane.

Gates to pass at PR: `npm run typecheck`, `npm run lint`, `npm run test` (count goes **up**; capture the `Tests: Y passed` line + exit 0 per `test-discipline`).

---

## Doctrine compliance

- **No verdict copy (§1).** The report + harness describe seats/capacity as structure ("full", "5 active", "3 open seats"); `_forbiddenReportTokens` ban-list scanned. `room_capacity_reached` surfaces as the shipped neutral copy ("This argument already has the most people it can hold.", `gameCopy.ts:204`). A refused 6th join is a **seat fact**, never a judgment on the person (roadmap §1; `publicSeatModel:14-33`).
- **Heat/popularity never gate access (§2-3).** The smoke asserts seating is by cap + invite + self-join only; nothing reads heat/standing.
- **Four seat states kept distinct (§1).** Every check asserts exactly one of active / observer / reserved / open; #7 proves observers are uncapped.
- **No enumeration (§5).** Check #11 asserts byte-identical existing-vs-new responses; the report never reveals whether an email is registered (masked emails only).
- **No token leakage (§5).** Check #12 scans every response; the raw token appears only in the creator-only `inviteLink`; logs are operator-confirmed short-id + email-domain only (`create-argument-room:197-204`).
- **Secrets (§6).** Harness reads **no** service-role; authenticates with user JWTs; `fingerprint` present+length only; tests assert no `SERVICE_ROLE` / `RESEND_API_KEY` / `Authorization` / raw-token literal in any source or log line.
- **RLS / migrations (§8).** Untouched. No RLS change, no migration, no applied-file edit. Cleanup uses status flips (archive / revoke), never hard delete.
- **Plain language (§9).** Any code surfaced routes through the shipped `gameCopy.toPlainLanguage`; unknown codes suppressed.

**GATE-C call-out:** this card touches **no** `supabase/**`, no RLS, no access policy, no migration, no Edge, no production `src/` → it is **STANDARD-GATED**, not GATE-C. **STOP-AT-PR (operator-gated, not self-approved):** (1) the card does **not** flip `INVITE_EMAIL_ENABLED` / the new-user Auth send / `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE`; (2) the card does **not** run the live matrix as part of merge — the live run is a separate operator-armed step **after** 004 is deployed; (3) authoring + merging the harness/protocol/report is safe (dry-run default; zero behavior change for users).

---

## Dependencies

- **ARG-ROOM-002** — DEPLOYED (migration `20260613000001` + `create-argument-room` Edge). The enforcement the smoke verifies. ✅
- **ARG-ROOM-003** (#614, merged `8929bde`) — visibility + one-invite on the create surface. Data-plane checks don't need the UI; only #9's browser leg needs the deployed bundle (frontend deploy gated on #625/QOL-040 — record bundle state in the report).
- **ARG-ROOM-004** (#615) — **must be merged + auto-deployed** before the email-bearing checks #9/#10/#11 are meaningful (the `?invite=` bridge, the working existing-user link, the uniform no-enum response). The cap/create/accept checks (#1-#8, #12, R1-R3) need only 002+QOL-038.
- **ARG-ROOM-005 / 006** (#616/#617) — the brief gates the live run on "004-006 merged/deployed." The core matrix exercises 002/003/004; 005 (seat surfacing) and 006 (lifecycle) are not required for any data-plane check here, but the operator should confirm they are merged before the live run if their surfaces are in scope. (No check below depends on 005/006.)
- **#607/#608** — DEPLOYED (auth-callback + pending-invite auto-accept). Underpins #9. ✅
- **Hosted Auth URL config** — Site URL + redirect allow-list already Netlify-correct (`auth-live-invite-seed-smoke.md:46-50`). ✅
- **Accounts** — 4 exist (admin + bot A/B/C). Checks #5/#7 need ≥6 → provision 2 (option A) or accept the test-covered fallback (option B).
- **#623 (bot-fixture migration) — NOT a dependency.** The harness creates rooms via the `create-argument-room` Edge and fills seats via JWT self-join, so it never hits the 6 refused direct-insert runners (`…sql:384-390`; 002 smoke `:42`). #623 is only relevant if the operator later wants to reuse bot-fixtures for seat-filling — record it as a follow-up, not a blocker.

---

## Open questions

1. **Which Edge emits the create-time-invite email under the deployed 004** — `create-argument-room` or `manage-room-invite handleCreate`? The 004 design wires the send into `manage-room-invite handleCreate`, but the create-time invite is minted by `create-argument-room`'s RPC. The smoke's #9/#10/#11 must target whichever path 004 deployed; add a precondition probe that records it. (Affects only the email-bearing checks; accept is always `manage-room-invite accept`.)
2. **Does the hosted redirect allow-list preserve `?invite=<token>` through to `/auth/callback`?** This is 004's own unproven link (its Open Q #1); #9's browser leg is the live proof. If the query is stripped, #9 falls back to the same-device storage seed and the copyable link.
3. **Provision 2 accounts (option A) or accept the test-covered fallback (option B) for #5/#7?** Operator call. Recommendation: provision (A) for a true live cap-5 proof; (B) is already satisfied and is the honest default if accounts aren't added.
4. **May the live run create transiently-visible `open` public rooms (#5/#7)?** Recommend a low-traffic window + immediate archive; confirm the operator accepts brief visibility, or whether cap-5 should be deferred to a staging project.
5. **Should #10/#11 run with `INVITE_EMAIL_ENABLED` OFF (recording `not_configured`) or require the operator to arm Resend first?** Lean: run OFF by default (still proves uniformity + accept), arm only to additionally prove deliverability.

**Deploy step (operator):** none for this card (no `supabase/**`). The live matrix is run **after** 004 deploys, via `npm run smoke:arg-room:live` with `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1` + any armed email gates; disarm per the runbook afterward.

---

Return paths (all absolute): design doc to write verbatim → `C:/Users/kyler/cdiscourse/debate-constitution-app/docs/designs/ARG-ROOM-007-LIVE-SMOKE-MATRIX.md`. Proposed net-new files: `C:/Users/kyler/cdiscourse/debate-constitution-app/scripts/arg-room-live-smoke/{smokeMatrix,plan,report,runArgRoomLiveSmoke}.js`, `C:/Users/kyler/cdiscourse/debate-constitution-app/__tests__/argRoomLiveSmoke.test.js`, and the report template `C:/Users/kyler/cdiscourse/debate-constitution-app/docs/testing-runs/2026-06-13-arg-room-live-smoke.md`. Card is **standard-gated** (no `supabase/**`); the live run is **operator-armed** and must not be self-run or self-armed at merge.
