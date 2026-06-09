# ARCH-001 Card 3 — production smoke harness (OPERATOR, synthetic-only)

Poll-to-settle SQL + canary/N=56 helpers for the Card-3 production smoke. This
is an **operator** harness (GATE-C). Claude wrote these files but ran nothing.
Every query here is **read-only** (`SELECT` only) — no write, no service-role,
no secret. Run them via the Supabase SQL editor / psql while you drive the
synthetic burst.

Full procedure + PASS/PARTIAL/FAIL definitions live in
`docs/runbooks/ARCH-001-CARD3-staged-arm-runbook.md` §4. This README is the
short operating sheet.

## Prerequisites

- Migration applied + Vault seeded (runbook §1–§2).
- Step-1 smoke arm set on `submit-argument`:
  `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`.
- Synthetic rooms titled with the smoke tag `[arch-001-queue-smoke]` (reuse the
  corpus smoke-tag tooling, `docs/designs/CORPUS-QUEUE-SMOKE-TAG-001.md`). The
  tag is the routing contract — only these rooms route to the queue.

## The two stages

### 1. Canary (routing-path gate — NOT load evidence)

Post ONE `[arch-001-queue-smoke]…` submit, then run `canary-completeness.sql`.
PASS = 7 A–G rows (`family IS NOT NULL`, `run_mode='production'`), **0 H/I/J
rows**, all `state='succeeded'`. HALT on any `family=NULL` queue row. A clean
canary is a precondition; an N=56 burst without a preceding passing canary
yields no valid gate evidence and is discarded.

### 2. N=56 burst (the canonical PASS-LOAD)

N=56 = **8 synthetic args × 7 families**, posted in a tight window into
smoke-tagged rooms so the queue drains across multiple drainer invocations.

Poll-to-settle (no fixed sleep): loop `snapshot-a-queue-health.sql` every ~5s,
bounded by a generous max wall (e.g. 10 min), until the settle predicate holds:

```
pending = 0
AND due retry_scheduled (available_at <= now()) = 0
AND leased = 0
AND stale leases (leased AND lease_expires_at < now()) = 0
AND (drain lease not held OR last_drain_completed > final-submit-ts)
```

Only THEN read completeness via `burst-completeness.sql`.

## PASS-LOAD bar (NOT lowered)

- **0 terminal dead-letters** across all 56 cells (`state='dead_letter'` count = 0).
  `1/56 = 1.79% > 1%`, so "0 preferred" and "≤1%" reconcile to **0**. **N=56** is
  the canonical burst size; do not substitute a smaller wave.
- Structural gates green (dup=0, overlap=0, `family=NULL`=0, 0 H/I/J, every cell
  `succeeded` or an explicit typed terminal, monitor healthy).
- Submit nonblocking; leak-safe (no verdict token, no `Bearer`/`sk-ant`/
  `sb_secret`/JWT in any row or log).

PASS-LOAD-CONFIRM = a second consecutive independent N=56 drill meeting all 15
gates. PARTIAL does not advance the percentage. Record the verdict in
`docs/audits/ARCH-001-CARD3-SMOKE-<date>.md`.

## Files

| File | Snapshot | Reads |
|---|---|---|
| `snapshot-a-queue-health.sql` | A | pending / retry_scheduled / leased / dead_letter / oldest ages |
| `snapshot-b-failure-class.sql` | B | failure-class breakdown by `failure_sub_reason` |
| `snapshot-c-last-drain.sql` | C | last drain + skipped-tick + counters from `classifier_drain_audit` |
| `snapshot-d-stuck-lease.sql` | D | stuck-lease detector |
| `canary-completeness.sql` | — | the canary 7-A–G / 0-H/I/J gate |
| `burst-completeness.sql` | — | the N=56 completeness + dup + dead-letter gate |

All snapshots are scoped to smoke-tagged rooms (a join on `debates.title LIKE
'[arch-001-queue-smoke]%'`) so they never read organic traffic.
