# stage1-observation — operator runbook

**Card:** OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP
**Read-only observation scripts:** `scripts/ops/stage1/stage1-snapshot.sh`, `scripts/ops/stage1/stage1-routed-volume.sh`, `scripts/ops/stage1/stage1-hij-leakage.sh`, `scripts/ops/stage1/stage1-window-close-readonly.sh`
**Read-only SQL (committed):** `scripts/ops-stage1-sql/*.sql`
**Rollback script:** `scripts/ops/stage1/disarm-stage1.sh`
**Watchdog (5-min alerting):** `docs/runbooks/cutover-health-monitor.md`
**Local secrets prep:** `docs/runbooks/stage1-local-operator-secrets.md`
**Stage-1 audits:** `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` (OBSERVING), `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md` (PARTIAL)

## What this runbook is for

The Stage-1 1% routing config is **armed and OBSERVING** (armed `2026-06-02T07:50:54Z`; the ≥ 24h window closes `≥ 2026-06-03T07:50:54Z`). This runbook describes the **read-only** observation pack the operator runs during the OPEN window to confirm the system stays healthy and inert, and the trigger list that calls for immediate rollback.

The 5-minute `cutover-health-monitor` alerting tick is the **primary** silent-failure detector (Conditions A–F; see its runbook). The scripts here are the **manual cross-check** run at roughly the same cadence the Stage-1 audit uses (~every 15 min during Stage 1). They observe; they never mutate.

> **This runbook does NOT close the window and does NOT advance the percentage.** Running every script here as many times as you like changes nothing: no script mutates state, no script issues a terminal verdict, and none advances `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` above 1. The window closes only by elapsed time (≥ 24h), and the terminal verdict (`PASS-STAGE-1` / PARTIAL / FAIL) is recorded in a follow-up audit update per the Stage-1 audit §0 rule — not by this pack. Advancing to 5% is a SEPARATE operator-authorized step that no audit or doc auto-grants.

## How the read-only pack authenticates

Every observation script under `scripts/ops/stage1/`:

- opens with `#!/usr/bin/env bash`, then `set -uo pipefail`, then `set +x`;
- runs ONLY read-only queries via `npx supabase db query --linked --file scripts/ops-stage1-sql/<name>.sql`;
- authenticates via the **project link**, NOT the operator account token — so the observation cadence stays off the privileged-token path entirely (the account token is used only by the mutating arm / disarm scripts);
- references operator secret NAMES only, never values.

Every committed `.sql` under `scripts/ops-stage1-sql/` is read-only (no `INSERT`/`UPDATE`/`DELETE`/`ALTER`/`CREATE`/`DROP`/`TRUNCATE`/`GRANT`/`REVOKE`), returns aggregate counts only, and prints no body text or `evidence_span`. (The committed Stage-1 SQL lives in this sibling directory, not under `scripts/ops/`, because the observability suite asserts an exact `.sql` count under `scripts/ops/` — exactly the reason `scripts/ops-latency-sql/` exists as a sibling.)

## The four observation scripts

### `stage1-snapshot.sh` — one-glance health snapshot

The all-in-one read-only snapshot, anchored to the arm timestamp. In a single result row it reports:

| Field | Meaning | Healthy value |
|---|---|---|
| `routed_args_since_arm` | distinct args with queue rows (`family IS NOT NULL`) since arm | any (smoke-tagged so far) |
| `non_smoke_routed_args` | of those, args whose debate title does NOT carry the `[arch-001-queue-smoke]` prefix — i.e. **organic** routed volume | `0` (pre-launch; see §routed volume) |
| `hij_rows_since_arm` | routed rows in family `claim_clarity` / `thread_topology` / `sensitive_composer` | **`0`** (must stay 0) |
| `m1_seconds_since_drain` | seconds since the last drainer completion (M1 freshness) | read with M2 (see §M1) |
| `m2_non_terminal` | queue rows in `pending` / `leased` / `retry_scheduled` (M2 depth) | `0` when idle |
| `sec_until_window_close` / `window_close_at` | time remaining until the ≥ 24h window closes | informational |

This is the script to run first each cadence. The four dimensions below break out the same signals at finer grain.

### `stage1-routed-volume.sh` — organic vs smoke routed volume

Splits routed args since arm into `non_smoke_routed_args` (organic) vs `smoke_routed_args`, plus the total. The smoke-tag override (`debates.title LIKE '[arch-001-queue-smoke]%'`, joined on `debate_id`) routes regardless of percentage, so canary / burst / qualification args show up as smoke-routed. **Organic** routed volume is `non_smoke_routed_args`, and as of the live checkpoints it is `0` — the product is pre-launch / low-volume, so almost no organic submit hashes into the 1% bucket. A persistent `non_smoke_routed_args = 0` is the expected, healthy state; see the §0 low-traffic interpretation rule in the Stage-1 audit for how this shapes the closeout verdict.

### `stage1-hij-leakage.sh` — Family H/I/J leakage guard

Counts routed rows whose `family` is `claim_clarity`, `thread_topology`, or `sensitive_composer`. Families H/I/J are `productionEnabled: false` in the family registry; production routing targets only A–G (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`). **The expected count is `0`, always.** Any non-zero value is a rollback trigger (a gated family must not have routed).

### `stage1-window-close-readonly.sh` — window-time + final-snapshot readout

A read-only readout for the end-of-window check: it reports the same health fields plus `sec_until_window_close` / `window_close_at` so the operator can see, at a glance, how much of the ≥ 24h window remains and whether every gate is still green as the window approaches close. **It is a readout, not a gate.** It does NOT close the window, does NOT issue `PASS-STAGE-1`, and does NOT advance the percentage. The window closes by elapsed time; the terminal verdict is recorded in a follow-up audit update.

## Reading the signals

### M1 — drainer freshness (idle-empty vs stuck)

M1 is the seconds since the drainer last completed a tick. The decisive rule:

> **M1 staleness is an alert ONLY when paired with M2 > 0.**

- **Idle-empty (NOT stuck):** M1 is large but `M2 = 0`. There is nothing in the queue, so the bounded drainer (ARCH-001, concurrency C=3) has no work and legitimately sits idle between ticks. At the live checkpoint, `m1_since_last_drain ≈ 35 min` with `m2_non_terminal = 0` — that is idle-empty, **healthy**, not an incident. A large M1 with an empty queue is expected during the zero-organic window.
- **Stuck (incident):** M1 is climbing **and** `M2 > 0`. There is work the drainer is not clearing. That is the queue-stall condition and is a rollback trigger (see triggers below; cross-checked by the monitor's Condition A/B at ALERT).

Always read M1 together with M2. M1 alone is not actionable.

### M2 — queue depth

M2 is the count of non-terminal queue rows (`pending` + `leased` + `retry_scheduled`). Terminal states are `succeeded` / `dead_letter` / `failed_terminal`.

- `M2 = 0` (idle/empty) is the steady state during the zero-organic window and after any synthetic burst fully drains.
- A transient `M2 > 0` immediately after a synthetic burst is normal and should drain back to 0 under the C=3 drainer (the synthetic qualification drained 56 cells to M2 = 0).
- `M2 > 0` that **does not return to 0** (climbing / not draining), especially paired with rising M1, is the queue-stall rollback trigger.

### Routed volume (organic = `non_smoke_routed_args`)

Organic routed volume is `non_smoke_routed_args` and is currently `0`. The smoke-tagged canary / burst / qualification args route via the title override independent of the 1% hash, so they appear under `smoke_routed_args`, not as organic. Watch organic volume for two things: (a) it should generally stay near 0 pre-launch, and (b) if it ever climbs **materially above the 1% expectation** for the observed organic submit rate, that is a rollback trigger (routing more than intended).

### H/I/J leakage

Must stay `0`. Families H/I/J are gated (`productionEnabled: false`). A non-zero count means a gated family routed — rollback trigger, no exceptions.

## Rollback triggers — disarm IMMEDIATELY on ANY of these

On ANY trigger below, run `scripts/ops/stage1/disarm-stage1.sh` immediately. It sets `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` via the CLI and prints `UTC_DISARMED_TIMESTAMP`. The disarm path is held in reserve for a genuine trigger; the synthetic qualification did NOT fire any of these.

1. **`family = NULL` leakage on a routed arg** — a routed arg shows a legacy direct-dispatch (`family = NULL`) run row where the queue path was expected.
2. **Family H/I/J rows** — any routed row in `claim_clarity` / `thread_topology` / `sensitive_composer` (`hij_rows_since_arm > 0`).
3. **Queue stall** — M2 non-terminal climbing / not returning to 0 (read with rising M1; cross-checked by monitor Condition A/B at ALERT).
4. **`duplicate_success > 0`** — the same cell reached `succeeded` more than once (idempotency breach).
5. **`overlapping_drain_pairs > 0`** — single-flight leasing breach (two drains overlapped on the same work).
6. **Provider / server error CLUSTER** — multiple cells failing the same provider/server way (`distinct_provider_failing_family_count > 0` recurring across cells/families). A SINGLE isolated, clearly-typed within-budget cell is NOT a cluster (the synthetic qualification's lone `provider_server_error` dead-letter on `critical_question` was one isolated cell, absorbed by the dead-letter safety net — that was PARTIAL, not a trigger).
7. **Dead-letter CLUSTER** — multiple cells landing in `dead_letter`, not one isolated within-budget cell.
8. **Monitor cron fail** — the `cutover-health-monitor-tick` watchdog FAILs (Layer 1: `recent_invocations = 0` in the window OR `failed_invocations > 0` OR `seconds_since_last_invocation ≥ 600`). The watchdog being dead makes the drainer unobservable; continuing to route is unsafe.
9. **Alert-path fail** — the alert delivery path is broken (e.g. the monitor's `emailStatus` shows a persistent `failed_*` mode, so an ALERT would not actually reach an inbox).
10. **Non-smoke routed materially > 1%** — organic routed volume materially exceeds the 1% expectation for the observed organic submit rate (routing more than intended).
11. **Operator request** — the operator decides to roll back for any reason.

The single-cell-vs-cluster distinction in triggers 6 and 7 is the line the synthetic qualification established: one isolated, clearly-typed, within-dead-letter-budget anomaly is observed and noted (PARTIAL), not rolled back; a *cluster* (multiple same-typed failures, or the historical `argument_scheme` packet-shape signature recurring) is a FAIL trigger.

## After a rollback

If a trigger fired and you disarmed:

1. Confirm `UTC_DISARMED_TIMESTAMP` printed and the script exited 0. If it returned a non-zero rc, **verify manually** that routing is OFF (re-run `stage1-snapshot.sh`; routing rows should stop appearing for new args).
2. Record what fired and when. The Stage-1 audit is updated with the disarm and the cause; this runbook is not the place for the verdict.
3. Re-arming is a separate operator decision after the cause is understood — it is not part of this observation pack.

## Boundaries (binding)

- Observation is **read-only**. No script here mutates state, and every committed Stage-1 SQL is read-only aggregate-counts-only.
- This pack does **not** close the ≥ 24h window (window closes by elapsed time ≥ `2026-06-03T07:50:54Z`).
- This pack does **not** issue `PASS-STAGE-1` and does **not** advance the percentage; 5% is a SEPARATE operator-gated step.
- No Family H/I/J enablement; no source / migration / validator / prompt / registry / secret change is performed by observing.
- Doctrine: machine outputs are **Observations**, not allegations or verdicts. Heat / activity / queue depth are system signals, never truth values about any person, post, or claim. Popularity / engagement is not evidence. Nothing here labels any participant or content.

## Cross-references

- Low-traffic interpretation + closeout-verdict rule + T0 baseline + rollback criteria: `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` (§0, §4, §6).
- Synthetic launch-qualification (canary + burst, the one isolated dead-letter, single-cell-vs-cluster framing): `docs/audits/OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION-2026-06-02.md`.
- 5-minute alerting watchdog (Conditions A–F, Layer 1/2/3, `emailStatus`): `docs/runbooks/cutover-health-monitor.md`.
- Local operator secrets prep (the three NAMES, `set +x`, presence-by-name): `docs/runbooks/stage1-local-operator-secrets.md`.
- Disarm / rollback script: `scripts/ops/stage1/disarm-stage1.sh`.
