# OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION — design (2026-06-02)

Sibling to the Stage-1 audit (`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`) and the fortified-architecture design (`docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md`). This document explains **why a synthetic launch-qualification verdict is needed while the live Stage-1 1% window observes zero organic routed traffic**, what that synthetic load does and does not prove, and the exact gated execution + verdict criteria.

This is a design + framing doc. It does not authorize 5%, does not enable H/I/J, and does not turn a zero-organic window into real-load proof.

---

## 1. Why this is needed (organic 1% ≈ 0)

The Stage-1 cutover armed queue routing at `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1` (PR #428, `UTC_ARMED_TIMESTAMP=2026-06-02T07:50:54Z`). At 1%, an organic submit routes through the ARCH-001 queue path only when `hash(argument_id) % 100 < 1`. CDiscourse is **pre-launch / low-organic-volume**: organic submit volume is effectively zero, so the expected organic routed count over a 24h window is ≈ 0.

The read-only metrics confirm this: as of 2026-06-02T08:28:29Z, `routed_args_since_arm_total = 1`, all of it the smoke-tagged Stage-1 canary (`non_smoke_routed_args = 0`).

A 24h observation window with zero organic routed cells cannot, by construction, demonstrate real organic load handling. It demonstrates plumbing, observability, rollback, and inertness — all valuable, none of them "the queue handles real traffic." The honest launch-readiness question — *can the queue handle a concurrent classifier load without the provider/packet-shape cluster that motivated this whole chain?* — must therefore be answered by **synthetic** load, which is exactly what the PR #425 / #426 PASS-LOAD drills did. This card produces a **named** synthetic launch-qualification verdict so that "launch confidence" rests on explicit synthetic evidence, not on a zero-organic window misread as a real-load PASS.

---

## 2. What the synthetic load proves

A single N=8 smoke-tagged burst (8 synthetic root theses → 56 A-G classifier cells via `Promise.allSettled` concurrency) routed through the live queue, under the live Stage-1 config, demonstrates:

- The ARCH-001 queue substrate accepts a concurrent A-G fan-out and drains it under the C=3 bounded-concurrency drainer.
- The post-PR-#423 packet-shape mitigation (Family E rule 6 + Family F STRICT RESPONSE-SHAPE CONTRACT + rule 6) holds: no terminal `provider_server_error` / packet-shape cluster recurs; transient validation failures (if any) are absorbed by the 4-attempt retry budget.
- The single-flight lease holds (no overlapping drains), idempotency holds (no duplicate-success), and no H/I/J cell leaks.
- The current live production path is healthy end-to-end *right now*: the deployed Supabase Edge functions (`submit-argument`, `classifier-drainer`, `classify-argument-boolean-observations` proxy) + the current Deno Deploy MCP build (`qrvrmvp6qqhn` from `d2d436a`) + the real Anthropic provider.

## 3. What the synthetic load does NOT prove

- **Real organic load behavior.** Smoke-tagged args route via the `[arch-001-queue-smoke]` title override, which is independent of `PERCENTAGE`. They never touch organic traffic and do not exercise the `hash(argument_id) % 100 < 1` organic-routing path. The genuinely-new behavior that `PERCENTAGE=1` enables — 1% of *organic* submits routing — cannot be exercised by a synthetic smoke burst at all.
- **Real traffic mix / timing / arrival distribution.** The burst is a single concurrent fan-out of 8 synthetic theses; real traffic arrives over time with varied content and concurrency.
- **The zero-organic Stage-1 window is not converted into real-load proof by this burst.** The burst is supplementary synthetic confidence; organic observation remains zero until real traffic appears.

## 4. Why synthetic supplements but does not replace organic observation

The two are complementary, not substitutable:

- **Synthetic (N=8 burst):** controllable, repeatable, concurrent — proves the *mechanism* handles a load shape without the historical cluster. Already demonstrated twice (#425 PASS-LOAD, #426 PASS-LOAD-CONFIRM). This card's burst is **largely confirmatory** under the live 1% config.
- **Organic (Stage-1 1% window):** real but, at pre-launch volume, ≈ zero. Proves plumbing/observability/rollback/inertness; will only prove real-load handling once organic traffic actually appears.

The launch-qualification verdict therefore reads: *the mechanism is synthetically qualified for launch; organic confirmation accrues as real traffic arrives.* It does not claim organic load has been handled.

## 5. Why this does NOT authorize 5%

5% is a separate operator-gated step (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-2` or equivalent), per the fortified-architecture decision-gate sequence (`docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §5). A synthetic-launch-qualification PASS increases launch confidence at 1% but does not satisfy the 5% gate, which requires its own operator authorization, its own observation window, and (ideally) some real organic routed evidence at 1% first. **No audit auto-advances the percentage.**

## 6. Execution — canary-then-burst (mandatory; see fortified-architecture §3.7)

Per the canary-then-burst discipline (`docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` §3.7), the burst is gate-bearing only if a canary first confirms the queue path is live:

1. Confirm Stage 1 still armed (`ENABLED=true`/`PERCENTAGE=1`), monitor active, queue inert (M2 non-terminal=0).
2. **N=1 canary** (`node .claude-tmp/queue-load-smoke-burst.cjs 1`). Inspect (argId-scoped, read-only): exactly 7 A-G rows, all `family IS NOT NULL`, 0 `family=NULL`, 0 H/I/J. (One cell in `retry_scheduled` at first look is an expected transient that recovers — not a canary fail.)
3. **If the canary indicates routing corruption or H/I/J leakage → HALT and disarm** (`scripts/ops/stage1/disarm-stage1.sh`).
4. **One N=8 burst** (`node .claude-tmp/queue-load-smoke-burst.cjs 8`). No second burst.
5. Poll the read-only pack until all 56 cells terminal.

Expected provider spend: N=1 canary (≈7 Anthropic Haiku calls) + N=8 burst (56) = **≈ 63 calls** on a healthy run; hard ceiling ≈ 252 only under pathological max-retry (×4), itself a FAIL signal.

## 7. PASS / PARTIAL / FAIL criteria

- **PASS-SYNTHETIC-LAUNCH-QUALIFICATION:** canary clean (7 A-G, family-set, 0 H/I/J, 0 legacy) AND burst 56/56 terminal succeeded AND `duplicate_success_cell_count=0` AND `overlapping_drain_pairs=0` AND provider cluster `distinct_provider_failing_family_count=0` AND 0 H/I/J AND 0 `family=NULL` leakage AND M1 < 120s AND M2 drains to 0 AND monitor healthy.
- **PARTIAL-…:** a transient validation failure that recovered on retry, OR one clearly-typed within-dead-letter-budget anomaly, with all other gates green.
- **FAIL-…:** packet/schema cluster recurrence, `family=NULL` leakage on a routed arg, `duplicate_success > 0`, `overlapping_drain_pairs > 0`, monitor cron failure, or alert-path failure → run `scripts/ops/stage1/disarm-stage1.sh`, confirm inert, surface evidence, stop.

## 8. Rollback criteria

Identical to the Stage-1 audit §6: H/I/J rows · `family=NULL` direct-dispatch leakage on a routed queue arg · queue does not drain · `duplicate_success > 0` · `overlapping_drain_pairs > 0` · provider/server cluster recurs · dead-letter cluster · monitor cron fails (Layer 1) · alert email path fails · non-smoke routed volume materially > 1% · operator request → `bash scripts/ops/stage1/disarm-stage1.sh` (sets `ENABLED=false`/`PERCENTAGE=0`), confirm inert, HALT.

## 9. Boundaries (binding)

- Stage 1 stays live at 1% throughout (no disarm unless a trigger fires); **no advance above 1%**.
- No Family H/I/J enablement; no `familyRegistry` production-flag change; `cutover-health-monitor` stays active.
- No MCP-server / runtime source edit while Stage 1 is live; no migration / validator / schema-mirror / prompt / key / ban-list change.
- Exactly one N=1 canary + one N=8 burst — no additional bursts "for the appearance of rigor."
- No secret value in any script/doc/audit/log/PR/chat.
- This card does **not** close the Stage-1 24h window and does **not** issue `PASS-STAGE-1`.

## 10. Right-size note

The load-readiness signal already exists from #425/#426 (N=8 56/56, twice). This card's burst adds (a) confirmation under the live 1% config (`PERCENTAGE=1`, not 0 — though a smoke-tagged burst routes via the override identically regardless of percentage, so the *new* information is the live-production end-to-end health check, not a percentage-sensitive routing difference) and (b) a named launch-qualification verdict. It is **largely confirmatory**. If conserving provider spend, the doc/framing half (Phases 0–2, 4) stands alone and the burst may be skipped — that choice is recorded in the qualification audit. This design does not manufacture additional bursts for the appearance of rigor.
