# OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP — docs + roadmap catch-up audit (2026-06-02) — PASS

Audit-Lint: v1
Audit-type: ops
Doctrine-risk: false

> **L5 override note.** This is an OPS docs/roadmap catch-up audit. It names production family keys (`argument_scheme`, `critical_question`, `claim_clarity`, etc.) only as routing targets / roadmap subjects — it does NOT inspect classifier `evidence_span` output for doctrine compliance (that is the job of the per-family ship / production-enable audits). The `Doctrine-risk: false` override tells `audit-lint` to skip the L5 persisted-output-inspection requirement, which does not apply to a documentation card that performs no classification and reads no result rows.

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-STAGE1-DOCS-AND-ROADMAP-CATCHUP (Card 2 of 2; runs AFTER Card 1's synthetic launch-qualification merged)
**Issue / trail:** #373 (cutover umbrella); Card 1 = `OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION` (PR #429, merged `a9602b9`, verdict PARTIAL); Stage-1 audit (`docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md`, OBSERVING).
**Base HEAD at execution:** `a9602b9` (post Card-1 merge).
**Stage-1 arm state (unchanged by this card):** `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1`, armed `2026-06-02T07:50:54Z`. The 24h observation window is **OPEN** (closes ≥ `2026-06-03T07:50:54Z`).

**Scope:** Documentation + read-only operator tooling catch-up after the Stage-1 1% cutover and its PARTIAL synthetic launch-qualification. **Docs / scripts / tests only.** No source / migration / validator / prompt / registry / secret change; **no DB write; no provider/MCP call; no percentage change; no H/I/J enablement; no window close; no `PASS-STAGE-1`.**

## Verdict

**PASS** — the catch-up deliverables (read-only observation pack + mirror safety test, two operator runbooks, A-G stability roadmap, H/I/J integration roadmap, fortified-architecture cutover-state update, current-status entry, and the Stage-1 audit "Live observation window checkpoints" section) are authored, doctrine-clean, and verified: `typecheck` + `lint` + `test` all exit 0; the observability exact-`sqlFiles===17` scan under `scripts/ops/` is preserved (all new SQL lives in the sibling `scripts/ops-stage1-sql/`); secret + banned-token scans are clean. Stage 1 stays armed at 1% with the window OPEN.

---

## Phase 1 — Preflight (PASS)

**Status:** PASS

- **Card 1 merged:** `OPS-MCP-STAGE1-LOW-TRAFFIC-SYNTHETIC-LAUNCH-QUALIFICATION` squash-merged as PR #429 (`a9602b9`), verdict PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION. This card runs after, as designed (both touch the Stage-1 audit; sequential).
- **Baseline green** at branch point: `tsc --noEmit` exit 0, `eslint` exit 0, full Jest suite green.
- **Stage 1 armed at 1%, window OPEN** (`2026-06-02T07:50:54Z` → closes `2026-06-03T07:50:54Z`); `non_smoke_routed_args = 0` (zero organic), confirmed read-only.
- **No provider spend, no DB write, no env mutation** performed by this card.

---

## 2. What this card delivered

**Read-only observation pack** (the named Card-2 pack):
- `scripts/ops/stage1/stage1-snapshot.sh`, `stage1-routed-volume.sh`, `stage1-hij-leakage.sh`, `stage1-window-close-readonly.sh` — thin runners (`#!/usr/bin/env bash` → `set -uo pipefail` → `set +x`; each runs exactly one read-only `npx supabase db query --linked --file scripts/ops-stage1-sql/<name>.sql`; project-linked auth, no privileged client, no operator token sourced).
- `scripts/ops-stage1-sql/stage1-routed-volume.sql`, `stage1-snapshot.sql`, `stage1-hij-leakage.sql`, `stage1-window-close-readonly.sql` — committed read-only SELECTs (aggregate counts only; smoke-vs-organic via `debates.title LIKE '[arch-001-queue-smoke]%'`).
- `__tests__/opsStage1SqlSafety.test.ts` — mirror safety test (modeled on `__tests__/opsMcpLatencySqlSafety.test.ts`) scanning the whole `scripts/ops-stage1-sql/` dir.

**A-G stability roadmap + its gate-evidence probes** (see §5 scope note):
- `docs/roadmap-expansions/2026-06-02-mcp-A-G-stability-roadmap.md`.
- `scripts/ops-stage1-sql/01-routing-liveness-and-leakage.sql` … `05-drainer-freshness-and-depth.sql` — five read-only gate-evidence probes mapping to the roadmap's E1–E9 evidence contract.
- `scripts/ops/stage1/gate-routing-leakage.sh` … `gate-drainer-freshness-depth.sh` — five thin read-only runners.
- `__tests__/opsMcpStage1GateProbeSafety.test.ts` — safety test for the five probes + five runners.

**H/I/J integration roadmap:** `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md`.

**Doc updates:**
- `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` — §2 dated "Cutover state — 2026-06-02" note; §5 decision-gate table marks Stage-1-arm DONE + 5% as the next separately-gated step; §6 repointed to the two live successors + the two new roadmaps (§3/§7 untouched).
- `docs/runbooks/stage1-local-operator-secrets.md`, `docs/runbooks/stage1-observation.md` (new).
- `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` — new §10 "Live observation window checkpoints" with the first live checkpoint (`2026-06-02T09:10:42Z`).
- `docs/core/current-status.md` — new "Latest implementer card" entry (prepended).

## 3. Observation pack + the sibling-dir / exact-count discipline

The observability suite (`__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`) recursively scans `scripts/ops/` and asserts **`sqlFiles.length === 17`** (exact) plus `FILES.length >= 19`. Every committed Stage-1 `.sql` therefore lives in the **sibling** dir `scripts/ops-stage1-sql/` (outside `scripts/ops/`), exactly mirroring the established `scripts/ops-latency-sql/` precedent and its `opsMcpLatencySqlSafety.test.ts` mirror test. Verified post-authoring: `find scripts/ops -name '*.sql' | wc -l` = **17** (unchanged); the nine new `.sql` are all under `scripts/ops-stage1-sql/`. The thirteen `scripts/ops/stage1/*.sh` (four pre-existing + nine new) are `.sh`, so they do not affect the `.sql` count, and they pass the observability banned-token scan (including their `#` comments, which that scan does not strip).

## 4. Runbooks

- `stage1-local-operator-secrets.md` — how the operator prepares the gitignored `.claude-tmp/operator-secrets.env` (three secret NAMES only, never values; `check-operator-secrets.sh` presence-by-name; `set +x` discipline; the invalid-PAT clean-abort failure mode from the Stage-1 audit). No real or realistic token value appears.
- `stage1-observation.md` — how to run the read-only observation pack during the OPEN window; how to read M1 (idle-empty large-M1-with-M2=0 is benign; M1 staleness alarms **only** with M2 > 0), M2, routed volume (organic = `non_smoke_routed_args`), and H/I/J leakage (must stay 0); the full rollback-trigger list with the single-cell-vs-cluster distinction from Card 1; and the explicit, repeated note that observation does **not** close the window or advance the percentage.

## 5. Roadmaps + scope note on the A-G gate probes

- **A-G stability roadmap** — the 1% → close-window → 5% → higher ramp, each step separately operator-gated with its own ≥24h window and (preferred) real organic evidence first; the per-gate E1–E9 evidence contract; dead-letter budget thinking (isolated typed provider 5xx = within tolerance; CLUSTER or leakage = HALT); the open Family-F follow-up for the lone `9ef5aab5` `provider_server_error` dead_letter (read-only R3-log disambiguation first, F packet-shape mitigation only if a residual is confirmed); and explicit non-goals (no auto-advance; H/I/J out of scope).
- **H/I/J integration roadmap** — why H/I/J are dormant (H was production-enabled in PR #405, failed post-merge smoke on provider holes at the 8-family load, and was rolled back to admin-only; I is chained behind H + is mixed-source; J is dormant by design per the J scoping audit); the prerequisites (A-G stable at a higher % with organic evidence; per-family ship + production-enable audit; the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Edge entry for mixed-source Family I; a doctrine review for `sensitive_composer` whose Observations render composer-only and never on the target node); the one-family-at-a-time canary-then-burst sequence; and the hard rule that H/I/J stay OFF until each is explicitly operator-gated.

**Scope note (disclosed):** the A-G roadmap shipped with **five read-only gate-evidence probes** (`scripts/ops-stage1-sql/01–05` + `scripts/ops/stage1/gate-*.sh` + `opsMcpStage1GateProbeSafety.test.ts`) that operationalize its E1–E9 contract. These were authored alongside the roadmap by the catch-up workflow and exceed the minimally-named "four-script observation pack." They are kept because they are **read-only, doctrine-clean, fully tested, and directly serve cutover safety** (pre-staged gate checks the operator runs when a future ramp is authorized). They are functionally inert until run and change no production state. If a leaner PR is preferred, they can be removed in a follow-up without affecting the named observation pack or the roadmaps.

## 6. Verification

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (`--max-warnings 0`) |
| `npm run test` | **598 suites / 18,866 tests passed**, exit 0 (clean re-run) |
| Test delta | 18,825 → 18,866 (**+41**), suites 596 → 598 (**+2** safety suites) |
| `audit-lint` (this audit + Stage-1 audit) | 0 findings each |
| `scripts/ops/` `.sql` count | 17 (unchanged) |
| Secret-shaped literal scan (all authored files) | 0 matches |
| Banned-token scan (`.sh`, incl. `#` comments) | 0 matches |
| Executable write-keyword scan (9 new `.sql`) | 0 matches |

**Flaky-test note (transparency, not a Card-2 regression):** one full-suite run reported a single failure in `__tests__/pointLifecycleModel.test.ts`; it passes **76/76 in isolation** and the full suite passes cleanly on re-run. That suite carries a hard wall-clock performance assertion (`builds in < 30 ms`, ~6 ms isolated) that can exceed its bound under full-suite CPU contention. Card 2 changes nothing this pure-model test depends on. It is a pre-existing wall-clock-bound flake, out of scope for this docs/ops card; a future card may relax the bound or make it contention-tolerant.

## 7. Boundaries honored (binding)

- ✅ `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` unchanged at 1 — **no advance above 1%**.
- ✅ No Family H/I/J enablement; no `familyRegistry` change; `cutover-health-monitor` left active.
- ✅ No MCP-server / runtime source edit; no migration / validator / schema-mirror / prompt / key / ban-list change.
- ✅ No DB write; no provider/MCP/X/Anthropic call; no env / Vault / cron mutation; no burst harness run. All DB access was read-only `supabase db query --linked` for the §10 checkpoint snapshot.
- ✅ No secret value in any script / doc / audit / log / PR / chat (operator secrets referenced by NAME only).
- ✅ This card does **not** close the Stage-1 24h window and does **not** issue `PASS-STAGE-1`. 5% remains separately operator-gated.

## 8. Provenance

- **Authoring:** a read-only multi-agent catch-up workflow produced the observation pack, runbooks, roadmaps, gate probes, and the fortified-architecture update; a doctrine + test-safety critic agent reviewed all authored files (verdict: clean). The main thread independently re-verified gates, secret/banned-token scans, the exact `.sql` count, and authored the Stage-1 audit §10 checkpoints, the current-status entry, and this audit.
- **CC provider-spend this card:** 0. **CC DB writes:** 0 (read-only SELECT only). **CC env/cron mutation:** 0.
- **Secrets discipline:** no `SUPABASE_ACCESS_TOKEN` / `MCP_SERVER_BEARER_TOKEN` / `CUTOVER_MONITOR_SHARED_SECRET` / service-role / JWT / Bearer value printed anywhere; `.claude-tmp/operator-secrets.env` stays gitignored and uncommitted.
