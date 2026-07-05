# RESEED-001 GATE-CLEAR — clear + baseline reseed audit

**Audit-Lint: v1** · **Date:** 2026-07-04 · **Operator-authorized Tier-3** (`go GATE-CLEAR`, 5 flagged accounts ruled operator test accounts) · **Verdict: CLEAR = PASS · baseline reseed = BLOCKED (harness room-creation defect; zero data written).**

## Pre-clear census (exact, read-only `--linked`)
Clear-set: 25 content tables, **26,183 rows** (non-zero: observation_results 7,787 · observation_runs 6,732 · topic_satisfaction_checks 3,819 · arguments 3,819 · argument_flags 1,908 · debate_participants 1,222 · debates 604 · room_notifications 235 · argument_room_invites 37 · argument_inactive_audit 14 · debate_inactive_audit 5 · argument_deletion_requests 1). 100% operator-authored (bots A/B/C + admin + 2 trivial `kyleruff+` accounts). Auth users: 19 (0 unexpected new organic; the 5 flagged = operator test accounts).

## Snapshot (verified before clear)
`logs/reseeder/snapshot_20260704_221408/` (gitignored). All 12 non-zero tables exported to JSONL; **counts matched exactly (26,183/26,183). No snapshot verification, no clear — verification passed.**

## Clear (transactional explicit DELETEs, FK order children→parents; NO TRUNCATE CASCADE)
SQL: `docs/testing-runs/2026-07-04-reseed-001-clear.sql` (25 tables, `argument_room_links` before `debates` per the RESTRICT edge). Executed in one `begin;…commit;`. **Post-clear: all 25 content tables = 0 (total 0).**

## Preserve-list (unchanged — verified)
auth.users 19 · profiles 19 · constitution_versions 1 · constitution_rules 20 · flag_definitions 17 · tag_definitions 15 · bot_user_registry 3 · admin_audit_events 376 · classifier_drain_audit 50,617→50,652 (cron-grows, preserved) · Google provider config untouched · migrations/schema untouched. **No account deleted. No preserve-list drift.**

## Baseline reseed — BLOCKED (no data written; DB remains a clean slate)
`--no-provider` (zero spend). Dry run PASS: args.me fetched 24 records, planned 5 threads, `rejectedTemplates=0`. **Live run: all 5 room creations failed (`create_room_failed`), posted=0.**
- **Root cause:** `scripts/reseeder/runReseeder.js:309` creates rooms via a direct `botA.client.from('debates').insert(...)`. ARG-ROOM-002 (#613, shipped 2026-06-13) made room creation server-authoritative and **dropped the client `debates` INSERT policy** — direct inserts are now RLS-blocked. This is the known `ARG-ROOM-BOTFIX-001` (#623) class; the R1 reviewer's no-direct-insert scan checked `arguments` only, not `debates`.
- **Impact:** posted=0 ⇒ zero rooms/arguments written ⇒ the database is still a clean, consistent slate (the gate's primary goal — content cleared — is achieved).
- **Fix (deferred to a reviewed follow-up, RESEED-002 / folds #623):** route room creation through the `create-argument-room` Edge Function (`{ title, resolution, visibility:'public' }` → 200, creator auto-joined), and public-room bot joins through the RLS-permitted self-join (or the seat flow). Then re-run `bot:fixture:reseed:baseline`.

## Boundary attestation
Organic-user check passed (0 unexpected). No direct `public.arguments` insert. No service-role in the posting path (the direct `debates` insert used the authenticated bot client and was RLS-BLOCKED — no bypass occurred). Preserve-list untouched. Snapshot backed up + verified. No Google-auth change. No `.env` written. No secret printed. No Edge/migration/routing/family change. No provider spend.
