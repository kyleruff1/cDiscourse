# ARG-ROOM-002 — GATE-C deploy + live data-plane smoke (2026-06-13)

## Header
| Field | Value |
|---|---|
| Card | ARG-ROOM-002 — server-authoritative capacity + private-requires-invite + one-invite enforcement (#613) |
| PR | #621 squash-merged → `2fe6331` |
| Deploy mode | **Option A — bounded-window GATE-C** (operator-chosen). Merge auto-applies migration `20260613000001` + deploys the `create-argument-room` Edge via the Supabase GitHub integration; the frontend is a manual `netlify-prod` push |
| Outcome | **SMOKE 7/7 PASSED — deploy verified end-to-end; create-debate outage window opened and closed** |

## Step 1 — precondition (HALT gate): PASSED
`select debate_id, count(*) from argument_room_invites where status='pending' group by 1 having count(*) > 1;` → **0 rows** (admin RLS read via `ari_select_mod_or_admin`). Total pending invites in production: **0** (the create surface never wired invites). The new `argument_room_invites_one_live_per_room` UNIQUE index applies cleanly.

## Steps 2–3 — deploy
- **Merge #621 → main `2fe6331`** (squash). Supabase GitHub integration auto-applied the migration (4 SECURITY DEFINER helpers, `enforce_room_capacity` trigger, one-live-per-room index, tightened participants INSERT policy, `create_argument_room` RPC, **DROP** of the client `debates` INSERT policy) + deployed the `create-argument-room` Edge.
- **Frontend:** `git checkout netlify-prod && git merge main && git push origin netlify-prod` → `3c8c499..2fe6331` (clean fast-forward), triggering the Netlify rebuild.

## Steps 4–5 — deploy verification
- **Edge live:** `POST /functions/v1/create-argument-room` with an invalid body → `422 {"error":"validation_failed",...}` (Zod `.strict()`), confirming the Edge deployed. Edge-deployed ⟹ migration-applied (one integration run; the smoke below proves the RPC end-to-end).
- **Bundle fresh:** live `index-9822adfa399e03ea9881492e952ce3af.js` (2.74 MB) contains `create-argument-room` **and** the matrix markers (`private_requires_invite` / `too_many_direct_invites`) — the rewired `createDebate` (Edge path) is live, so the create-debate outage is **closed**. Window was bounded to ~the gap between the migration apply and the Netlify rebuild (a few minutes).

## Step 6 — live data-plane smoke (deployed Edge + admin/bot accounts) — 7/7 PASS
Rejection + door checks create no rows; the two happy-path creates are **draft** rooms (not user-visible), labeled `[ARG-ROOM-002 smoke 2026-06-13]`. **No email sent** (the Edge only mints the invite row; the QOL-040 send is separate + default OFF).

| Check | Behavior | Result |
|---|---|---|
| B1 | public + no invite → create | **200** (debate `6095fc1d…`) |
| B2 | private + 1 invite → create | **200** (debate `fc930abd…`, `inviteId` set, seat reserved) |
| B3 | private + no invite → rejected | **400 `private_requires_invite`** |
| MAX1 | 2+ invites → rejected | **422 `validation_failed`** (single-invite strict schema) |
| SELF | invite addressed to caller → rejected | **400 `cannot_invite_self`** |
| DOOR | direct client `debates` INSERT (admin) → refused | **42501** `new row violates row-level security policy for table "debates"` — the direct-insert door is **closed** (the security fix is live) |
| B6 | non-invitee self-join into the private room → refused | **23514 `room_capacity_reached`** — refused by the live `enforce_room_capacity` trigger (room at cap 2 = creator + reserved invite) |

## Account-limited behaviors (covered by tests + the live trigger proof)
The operator's "public cap: 6th active refused" (behavior 4 at the **public** cap of 5) and "observer into a **full** public room succeeds" (behavior 5) require ≥6 distinct accounts to fill a 5-seat public room; only 4 test accounts exist (admin + bots A/B/C). The **`enforce_room_capacity` trigger is proven LIVE** by B6 (`room_capacity_reached` at the private cap of 2) — the same trigger function enforces the public cap of 5 (`roomCapacityModel` parity tests pin `PUBLIC_ROOM_SEAT_CAP === 5`; the migration text-scan + RLS tests pin the trigger + cap math). The observer short-circuit is unit-tested. These two specific public-cap-5 scenarios were not live-exercised; the enforcement mechanism was.

## Cleanup (non-urgent)
Two draft smoke rooms (`6095fc1d-a754-4d3d-bf31-99bf93b61414` public, `fc930abd-7ce0-407a-b0d2-317c518312ba` private + one reserved invite to `kyleruff+arg002smoke@gmail.com`) remain, label `[ARG-ROOM-002 smoke 2026-06-13]`, status `draft` (not user-visible). Archive/delete at leisure.

## Follow-ups
- **Bot-fixture migration card** (filed): 6 operator-gated `scripts/bot-fixtures/*` runners do client `debates` inserts that are now refused post-deploy (`runStressBatch`, `runAiDrivenCorpus`, `runXaiAdversarialBotCorpus`, `runXaiAdversarialThreadCorpus`, `runMcpSmokeTest`, `runScenario`). They must move to `create-argument-room` / a service-role harness. Not in CI.
- `23505` relabel in `manage-room-invite create` → owned by ARG-ROOM-006.
