# ARG-ROOM-007 — live-smoke matrix (2026-06-13)

> **TEMPLATE — filled by the operator-armed live run, not by the ARG-ROOM-007
> merge.** The card ships this template + the dry-default harness; the live run
> is a separate operator-armed step **after** ARG-ROOM-004 deploys. The harness
> never self-arms a gate or a live send. Run with
> `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE=1 node scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live --four-deployed`
> and paste its printed report block over the placeholders below.

## Header
| Field | Value |
|---|---|
| Cards under test | ARG-ROOM-002 (deployed) · 003 (merged) · 004 (deployed) |
| HEAD SHA | `<sha>` (main == origin/main) |
| Harness | `scripts/arg-room-live-smoke/runArgRoomLiveSmoke.js --live` |
| Gate: invite email (`INVITE_EMAIL_ENABLED`) | `<ON/OFF as-found → as-left>` |
| Gate: new-user Auth send | `<ON/OFF>` |
| Accounts | admin + accounts A/B/C (+ D/E if provisioned) — `<N>` distinct |
| Outcome | SMOKE `<k>`/12 PASSED (+`<r>` regression) |

## Preconditions (all confirmed before arming)
| Gate | Result | Evidence |
|---|---|---|
| ARG-ROOM-004 merged + auto-deployed (`manage-room-invite` / `room-notifications` / `create-argument-room` registered in `config.toml`) | `<confirmed>` | merge=deploy via the Supabase GitHub integration |
| Which Edge emits the create-time invite email (probe — Open Q #1) | `<create-argument-room \| manage-room-invite handleCreate>` | Deno log inspection (short-id + email-domain only) |
| Hosted redirect allow-list preserves `?invite=<token>` to `/auth/callback` (#9 browser leg, Open Q #2) | `<confirmed>` | bundle-marker + `auth-live-invite-seed-smoke.md` |
| Resolved distinct accounts | `<N>` | env (admin + accounts A/B/C [+ D/E]) |
| Low-traffic window accepted for transiently-visible `open` cap-5 rooms (#5/#7, Open Q #4) | `<confirmed>` | operator window + immediate archive in disarm |

## Results
| # | Check | Accts | Expected | Actual | Result |
|---|---|---|---|---|---|
| 1 | public/no-invite create | 1 | `200` | `<…>` | `<PASS>` |
| 2 | public/one-invite create (reserves a seat) | 1 | `200` inviteId set | `<…>` | `<PASS>` |
| 3 | private/one-invite create (cap 2 reached) | 1 | `200` inviteId set | `<…>` | `<PASS>` |
| 4 | private/no-invite → forced reject | 1 | `400 private_requires_invite` | `<…>` | `<PASS>` |
| 5 | public cap-5 → sixth active refused | 6 | `23514 room_capacity_reached` | `<… or SKIP>` | `<PASS / covered_by>` |
| 6 | reserved-invite seat acceptance | 2 | `200 accepted`, seat | `<…>` | `<PASS>` |
| 7 | observer into a full public room | 6 | `200`, active still 5 | `<… or SKIP>` | `<PASS / covered_by>` |
| 8 | wrong-user invite recovery | 2 | `403 invite_email_mismatch` | `<…>` | `<PASS>` |
| 9 | new-user invite callback (email→callback→set-pwd→auto-accept) | 2 | `200` uniform; operator-confirmed browser; `200 accepted` seat | `<…>` | `<PASS / SKIP if 004 not deployed>` |
| 10 | existing-user invite flow | 2 | invite `200`; `200 accepted` seat | `<…>` | `<PASS / SKIP>` |
| 11 | no enumeration (uniform existing-vs-new) | 1 | byte-identical shape+status+`notification` | `<…>` | `<PASS / SKIP>` |
| 12 | no token leakage | 1 | raw token only in creator-only `inviteLink` | `<…>` | `<PASS>` |
| R1 | regression — 2+ invites refused | 1 | `422 validation_failed` | `<…>` | `<PASS>` |
| R2 | regression — self-invite refused | 1 | `400 cannot_invite_self` | `<…>` | `<PASS>` |
| R3 | regression — direct `debates` insert refused (door) | 1 | `42501` | `<…>` | `<PASS>` |

## Account-limited checks (#5 / #7)
`<live-proven with >= 6 accounts | covered_by: 002-B6 + roomCapacityModel parity>`

If only 3-5 accounts are provisioned, the harness emits `accounts_insufficient →
covered_by` for #5/#7 (never a misleading PASS). The **same** `enforce_room_capacity`
trigger was live-proven at the private cap of 2 by the 002 smoke (B6 → `23514`);
`roomCapacityModel` parity tests pin `roomActiveSeatCap('public') === 5` and
`canJoinActive(5, 0, 5) === false`; the observer short-circuit is unit-tested.
**Do not** substitute a service-role seat-fill script (doctrine §6) — seat-filling
must use real JWT self-joins.

## No-enumeration (#11) — response diff
`<keys + status + notification value identical across existing-email and
fresh-email create calls; only opaque inviteId / inviteLink differ>`

## No-token-leakage (#12)
`<response scan CLEAN | LEAK in …>` — the harness's `scanForSecretLeak` flags any
raw token / JWT-shape / auth-prefixed header / sha-256 hash in any captured body.
The raw token appears **only** in the creator-only create-time `inviteLink`. Log
half operator-confirmed via Deno logs (short-id + email-domain only,
`create-argument-room:197-204`, `manage-room-invite:626-630`).

## Cleanup / disarm
1. `INVITE_EMAIL_ENABLED` returned to its as-found state (`<OFF>`); QOL-040 owns the durable flip.
2. Every `[ARG-ROOM-007 smoke 2026-06-13]` room archived (status flip, **never** hard delete).
3. Leftover **pending** invites revoked (`manage-room-invite revoke`).
4. Fresh devtest alias from #9 soft-deleted via the admin surface (optional).
5. `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE` unset.

## Follow-ups
`<#623 fixture-account migration if seat-filling reuse is wanted; any residuals>`
