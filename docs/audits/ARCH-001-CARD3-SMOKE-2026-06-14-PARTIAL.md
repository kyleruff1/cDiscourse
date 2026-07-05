# ARCH-001 Card 3 — controlled A–I queue-routing burst (9-family, 72-cell): PARTIAL (2026-06-14)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-14
**Operator:** Kyler (authorized the controlled burst and the single authorized provider spend; armed and disarmed the gate — "Authorize — you arm the gate" / "You'll run it" / "Controlled A–H burst (the #371/#373 de-risk)").
**Merges consumed (none made by this audit):** none. This audit changed no source, no migration, no config, no Edge Function. Main unchanged throughout. The only mutations were two operator-gated `supabase secrets set` calls on the routing gate (arm → restore), both digest-verified, plus the production `submit-argument` posts that seeded the burst (no service-role, no direct insert).
**Issue trail:** #552 (Card 3 tracker). Predecessor audit: `docs/audits/ARCH-001-CARD3-SMOKE-2026-06-10-PASS-LOAD.md` (prior verdict: PASS, at N=56 over the A–G roster). De-risk targets: #371 / #373 (burst-capacity / provider-saturation — the failure mode that sank the Family-H production smoke at 8-family load).
**Scope:** First controlled queue-routing burst over the **current 9-family production roster** (parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress, claim_clarity, thread_topology — A through I). `sensitive_composer` (Family J) remains `productionEnabled:false` and MUST NOT appear. Burst shape: 8 fresh smoke-tagged rooms × 9 families = **72 queue cells**, posted in a tight ~12 s window — deliberately denser than the predecessor's 56-cell A–G drills, to reproduce the #371/#373 multi-family saturation regime. Drainer constants unchanged (C=3 → 4 attempts max, T=90 s, lease=130 s; cron `arch-001-classifier-drain-tick`, 60 s cadence).

**Verdict: PARTIAL (the queue demonstrably fired and processed all 72 cells — 71/72 succeeded — but 1 `claim_clarity` cell exhausted its 4-attempt retry budget on a `provider_server_error` transient and dead-lettered. The canonical PASS-LOAD bar is 0 terminal dead-letters, so this is not PASS; the architecture behaved correctly under load — retried with backoff, isolated the blast radius to one cell, leaked nothing — so it is not FAIL.)**

Headline results (72 burst cells + 9 canary cells):

* **71/72 succeeded; 1 dead_letter; 0 failed_terminal; 0 duplicate-success; 0 `family=NULL`.** Per-arg cell count exactly 9 for all 8 args.
* **0 `sensitive_composer` (J) rows anywhere** — the frozen family stayed frozen.
* **The lone dead-letter is a tunable provider transient, not an architecture defect:** `claim_clarity`, `failure_reason=mcp_api_error`, `failure_sub_reason=provider_server_error`, `dead_letter_reason=retry_attempts_exhausted`, `attempt_count=4`, retry span ~899 s (06:27:01 → last attempt 06:42:00 → 06:42:04 UTC). The queue retried the transient four times across the backoff schedule before exhausting the budget — exactly the load-smoothing contrast RESULTS-001 wanted: under **direct dispatch** that same `provider_server_error` is an immediate hard failure to the caller (the #371/#373 8-family-load failure mode); under the **queue** it was absorbed, retried, and isolated while the other 71 cells succeeded.
* **Phase-7 queue-fired proof is direct:** 30 cron drain-tick audit rows fired inside the burst window (06:26 → 06:47 UTC), `jobs_processed` summing to 76 (> 72 because the dead-letter cell's 4 attempts re-processed), `dead_letters` summing to 1, outcomes `completed` / `partial` / `skipped_single_flight` (single-flight = overlapping-tick coalescing, as designed). The cells were drained by the queue, not direct-dispatched.
* **Leak-safety clean:** 72 run rows + 159 persisted result rows scanned — 0 secret-shape hits (Bearer / sk-ant / sb_secret / JWT / 64-hex), 0 system-emitted verdict tokens in any system field (`failure_*`, `dead_letter_reason`, `raw_key`, `family`), 0 verdict words in any `evidence_span` (which is a quotation of the move's own user text by design).

---

## Phase 0 — preflight + state verification (read-only)

**Status:** PREFLIGHT_OK

| Check | Result |
|---|---|
| Production roster | 9 families `productionEnabled:true` in `familyRegistry.ts` (A–I); `sensitive_composer` (J) `productionEnabled:false` |
| Cron tick | `arch-001-classifier-drain-tick`, 60 s cadence, active (30 ticks observed in the burst window) |
| `classifier-drainer` Edge Function | behaviorally proven — per-window `completed`/`partial` `classifier_drain_audit` rows, no 401 cluster |
| Gate state on entry | found `ENABLED=true` / `PERCENTAGE=100`. **Undocumented since the 2026-06-10 audit closed at `ENABLED=true` / `PCT=0`** — the percentage was moved 0→100 after that audit without a recorded smoke. **Flagged for operator confirmation** (see Disposition); this audit neither authored nor blesses that organic ramp. |
| ARG-ROOM-002 / #623 | client `debates` INSERT policy was dropped by ARG-ROOM-002, so the prior direct-insert smoke runners 42501'd; runners were repointed at the `create-argument-room` Edge Function for this burst (no direct insert, no service-role) |

## Phase A — GATE-ARM (operator-approved, smoke-tag isolation)

**Status:** ARMED_VERIFIED

For the controlled burst the gate was set to `CLASSIFIER_QUEUE_ROUTING_ENABLED=true` (re-asserted, 06:21:14Z) + `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0` (temporarily reduced from the organic 100 for smoke-tag isolation) via `supabase secrets set` (PAT lane; values never printed). Post-set readback digest-matched the SHA-256 of literal `true` / `0`. At PCT=0 only `[arch-001-queue-smoke]`-titled rooms route (the smoke-tag override); the hash-bucket organic path is inert, so the burst load is attributable solely to the 8 smoke rooms.

## Phase B — canary (routing-path gate)

**Status:** PASS

One synthetic `[arch-001-queue-smoke]` thesis via production `submit-argument` (admin bot lane from `.env.bot-tests`; no service-role; no direct insert). Result: **9/9 A–I queue cells, `family IS NOT NULL`, `run_mode='production'`, all `succeeded`, 0 J rows, 0 `family=NULL`.**

## Phase C — GATE-PASS-LOAD burst (N=72, 8 args × 9 families)

**Status:** PARTIAL

8 synthetic smoke-tagged theses (8 fresh rooms) posted in a ~12 s window; 8/8 accepted (HTTP 201; engine validation is the sole pre-fork acceptance gate, classification strictly post-storage and advisory). Poll-to-settle at 5–20 s cadence; settled with one cell taking the full retry path to exhaustion.

| Gate | Observed |
|---|---|
| Cells | 72/72 present; each of 8 args exactly the 9 A–I families |
| Terminal | 71 `succeeded`; **1 `dead_letter`**; 0 `failed_terminal`; 0 unresolved non-terminal |
| Dead-letter detail | `claim_clarity` — `mcp_api_error` / `provider_server_error` / `retry_attempts_exhausted`, `attempt_count=4`, span ~899 s |
| Duplicate success | 0 (`argument_id × family × run_mode × schema_version` unique) |
| `family=NULL` / J / organic-routed | 0 / 0 / 0 |
| Window | first run row 06:26:52 → last activity 06:42:04 UTC |
| Distinct families | 9 (full production roster) |

**Why PARTIAL, not PASS:** the canonical PASS-LOAD bar is "0 terminal dead-letters" ("0 preferred", not "≤1%"). One cell dead-lettered, so the bar is not met. **Why PARTIAL, not FAIL:** the failure is a single provider-side transient (`provider_server_error`) that the queue handled exactly as designed — four backoff-spaced attempts, blast radius isolated to one cell, the other 71 unaffected, no duplicate success, no integrity violation, no leak. The architecture is sound; the retry budget (C=3 → 4 attempts) is marginally under-provisioned for a 9-family burst at this concurrency, consistent with the #371/#373 provider-saturation signature.

## Phase D — Phase-7 drain-audit proof (queue actually fired)

**Status:** PASS

`classifier_drain_audit` rows in the burst window (read via the `--linked` Management-API query lane; the admin bot lane is RLS-blocked on this table):

| Metric | Observed |
|---|---|
| Drain ticks in window (06:26 → 06:47 UTC) | 30 |
| Σ `jobs_processed` | 76 (= 72 cells + the dead-letter cell's 3 extra re-attempts + finisher overlap) |
| Σ `dead_letters` | 1 |
| Outcomes seen | `completed`, `partial`, `skipped_single_flight` (single-flight = overlapping-tick coalescing, expected) |

This is the direct proof the **queue drainer** processed the burst (not direct dispatch): every one of the 72 cells carried `family IS NOT NULL` + `run_mode='production'` (queue-row shape) and was drained by the cron-driven drainer across these 30 ticks. RESULTS-001 direct-vs-queue contrast established: the queue's retry-with-backoff path is visible in the `jobs_processed` 76 > 72 over-count and in the dead-letter cell's 4-attempt / 899 s trail.

## Phase E — leak-safety + doctrine scan (direct-output inspection)

**Status:** PASS

Direct-output inspection of the persisted `evidence_span` column of `argument_machine_observation_results` (159 result rows for the 72 burst run rows) plus all system-emitted text fields of the 72 run rows (`failure_reason`, `failure_sub_reason`, `dead_letter_reason`, `failure_detail`, `provider_key`, `model_name`):

* **Secret-shape hits: 0** across all 231 rows (regex: `Bearer `, `sk-ant-`, `sb_secret_`, JWT three-segment shape, bare 64-hex).
* **System-emitted verdict-token hits: 0** in the system fields (`failure_*`, `dead_letter_reason`, `raw_key`, `family`) — the queue/drainer never wrote a verdict label (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/idiot/stupid/verdict/untrue).
* **`evidence_span` verdict words: 0** (FYI — `evidence_span` quotes the move's own user text per OPS-MCP-EVIDENCE-SPAN-QUOTATION-FRAMING, so a hit there would be the user's word, not a system label; none present regardless).
* Harness artifacts under `.claude-tmp/` are gitignored and hold short ID prefixes + counts only — no bodies, no spans, no JWTs, no emails, no provider payloads.

## Disposition

* **Verdict recorded as PARTIAL.** The Card-3 queue is **functionally proven over the full 9-family roster** (Phase-7 drain proof + 71/72 success + clean leak scan), but the canonical 0-dead-letter PASS-LOAD bar was not met on this denser burst. A clean **PASS-LOAD over the 9-family roster is not yet on record**.
* **Re-tune does NOT advance the percentage ladder.** The remedy is a calibration pass (raise the retry ceiling beyond C=3, and/or pace the drainer's per-tick concurrency to stay under provider Tier limits during a 9-family burst) followed by a re-smoke. That re-smoke is a separate authorized spend and is itself GATE-bounded; **nothing here advances the organic-percentage staged-arm ladder.**
* **Routing state at audit close:** restored to the entry baseline `ENABLED=true` / `PERCENTAGE=100` (06:43:06Z; digest-matched SHA-256 of literal `100`). The temporary PCT=0 smoke-isolation window is closed. Disarm to direct dispatch remains a one-flag revert (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`).
* **Operator-confirmation flag:** the gate was found at `PCT=100` on entry — an undocumented ramp from the 2026-06-10 close state (`PCT=0`). The operator should confirm whether that organic ramp was intended; if so, a PASS-LOAD over the 9-family roster (after the re-tune above) should back it.
* `sensitive_composer` (J) remains `productionEnabled:false`; #371 / #373 remain the open burst-capacity follow-ups, now with a concrete 9-family reproduction and a named remedy.
