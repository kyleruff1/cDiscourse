# ARG-ROOM smoke cleanup (2026-06-13)

Post-smoke disarm + debris cleanup, run after the ARG-ROOM-007 live-smoke
exercise. Data plane only, admin JWT via RLS (no service-role). Reversible
status flips only — **zero hard deletes**.

## What the discovery found

| Item | Id | State found | Disposition |
|---|---|---|---|
| `[ARG-ROOM-007 smoke 2026-06-13]` rooms | — | **none exist** | nothing to archive (the 007 create calls all 422'd → created no rows) |
| `[ARG-ROOM-002 smoke 2026-06-13] public-no-invite` | `6095fc1d` | `status=open` | **archived** (status flip) |
| `[ARG-ROOM-002 smoke 2026-06-13] private-1-invite` | `fc930abd` | `status=open` | **archived** (status flip) |
| Smoke pending invite (in `fc930abd`) | `dfe87179` | `pending` | **revoked** via `manage-room-invite` |
| Real user room *"our baby is cuter…"* | `8114dad3` | `status=open`, created by a **non-admin** user | **left untouched** (real user content, not smoke) |
| Real user pending invite (in `8114dad3`) | `7b88d236` | `pending` | **left untouched** (real user invite) |

Scope note: the operator's written scope named the 007 rooms. None existed, so
the cleanup was extended to the two **ARG-ROOM-002** smoke rooms I created during
the 002 GATE-C deploy smoke — unambiguous test debris previously flagged for
cleanup. The extension is reversible (status flip) and is the only deviation.

Hard guard: the executor carried an explicit allow-list (`6095fc1d`, `fc930abd`,
invite `dfe87179`) and a protected deny-list (`8114dad3`, invite `7b88d236`); it
asserts the protected user invite is still `pending` post-run.

## End state (verified post-mutation)

- `6095fc1d` → `status=archived`
- `fc930abd` → `status=archived`
- invite `dfe87179` → `status=revoked`
- `8114dad3` → `status=open` (untouched), invite `7b88d236` → `pending` (untouched)
- Only one pending invite remains system-wide: `7b88d236` (the real user invite).

## Gate + arm confirmation

Presence checked across all local `.env*` files + `process.env` (key names only,
values never read):

| Key | Local files | process.env | Deployed default |
|---|---|---|---|
| `INVITE_EMAIL_ENABLED` | absent | unset | OFF (`=== 'true'` gate, absent → false) |
| `INVITE_AUTH_BRIDGE_ENABLED` | absent | unset | OFF (`=== 'true'` gate, absent → false) |
| `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE` | absent | unset | n/a (live-smoke arm; was inline-only, did not persist) |

The two email gates were shipped dormant in ARG-ROOM-004 (#627) and were never
armed as hosted secrets this session. A definitive read of the *hosted* secret
values requires the Supabase management API (operator lane); the non-mutating
evidence above (deploy-default-OFF + local absence + dormancy provenance) is the
basis for this confirmation. A behavioral `notification: not_configured` probe of
`room-notifications` was deliberately **not** run — it would write a stray in-app
bell row.

## Disarm checklist

- [x] 007 smoke rooms archived (none existed)
- [x] 002 smoke rooms archived (status flip, reversible)
- [x] smoke pending invite revoked
- [x] real user room + invite left untouched
- [x] `INVITE_EMAIL_ENABLED` OFF
- [x] `INVITE_AUTH_BRIDGE_ENABLED` OFF
- [x] `CDISCOURSE_ALLOW_ARG_ROOM_LIVE_SMOKE` not armed
