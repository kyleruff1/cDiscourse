# OPS-MCP-CANARY-THEN-BURST-RUNBOOK — codification audit (2026-06-02)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-CANARY-THEN-BURST-RUNBOOK
**Issue / trail:** #373 (cutover umbrella); operational lesson from PR #426
**Base HEAD at execution:** `44e4646` (PR #426 — PASS-LOAD-CONFIRM)
**Predecessors merged:** PR #411 through PR #426

**Scope:** Docs-only codification of the **canary-then-burst** arming discipline as the standard sequence for every queue-routing drill (queue-load-smoke, confirmatory smoke, AND Stage 1 ramp). No source code, no migration, no Supabase env/secrets mutation, no cron change, no routing-flag change, no provider call, no `submit-argument` call.

**Final verdict:** **PASS, docs-only codification complete.**

---

## 1. Origin — the PR #426 first-burst misfire

During the PR #426 confirmatory queue-load-smoke drill, the operator armed routing (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true`, `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=0`) and reported "arm done". CC then ran a first N=8 burst at 2026-06-02T04:34:24Z. The burst submit returned 8 posted / 0 failed, **but post-burst inspection showed all 58 created `argument_machine_observation_runs` rows had `family = NULL`** — the burst had taken the legacy direct-dispatch path, not the ARCH-001 queue path. The routing flag had not actually propagated to the running Edge isolate at burst time.

The misfire:
- Produced **no gate-bearing queue evidence** (queue-path queries filter `family IS NOT NULL`).
- Still consumed ~58 operator-authorized Anthropic calls (just on the wrong path).
- Was only caught because CC inspected the actual queue rows and noticed `family = NULL`.

**The corrected flow** (which produced the valid PR #426 PASS-LOAD-CONFIRM evidence):
1. Operator re-set the env vars via `npx supabase secrets set` with a Supabase **account PAT** (`SUPABASE_ACCESS_TOKEN`; not anon key, not service-role, not db password).
2. Operator verified via `npx supabase secrets list` and waited 120 seconds for Edge propagation.
3. CC ran an **N=1 canary** at 04:54:58Z.
4. CC confirmed the canary produced **7 A-G queue rows with `family IS NOT NULL` and zero H/I/J** (6 succeeded attempt 1; 1 `critical_question` in `retry_scheduled`, an expected transient that recovered).
5. CC then ran the gate-bearing **N=8 confirmatory burst** at 04:56:12Z → 56/56 succeeded → PASS-LOAD-CONFIRM.

The lesson: **Supabase Edge env-var propagation is non-deterministic on the order of a minute or more.** `npx supabase secrets list` confirming the value is set is necessary but **not sufficient** to prove the flag is live in the running Edge isolate. A behavioral verification (the canary) is required before committing the full N=8 spend.

---

## 2. The binding arming sequence (codified)

Applies to **every** queue-routing drill: queue-load-smoke, confirmatory smoke, and Stage 1 ramp.

1. **Operator sets** the routing env vars with a Supabase **account PAT** (`SUPABASE_ACCESS_TOKEN`):
   - `CLASSIFIER_QUEUE_ROUTING_ENABLED=true`
   - `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=<0 for smoke; 1 for Stage 1>`
2. **Operator verifies** via `npx supabase secrets list` AND **waits ≥ 120 seconds** for Edge propagation.
3. **CC runs an N=1 canary** through the existing smoke-tag harness (`node .claude-tmp/queue-load-smoke-burst.cjs 1`).
4. **CC inspects the canary's cells** with a read-only query scoped to the canary argId:
   - **PASS**: exactly 7 A-G queue rows, all `family IS NOT NULL` (queue path), zero H/I/J. (A single cell in `retry_scheduled` at first inspection is an expected transient and recovers — it does not fail the canary.)
   - **HALT**: any row with `family = NULL` → routing did NOT propagate → **HALT; do NOT run the N=8 burst.** Surface the diagnosis, ask the operator to re-verify/re-set the flag, and re-canary.
5. **Only after the canary confirms `family IS NOT NULL`** does CC run the gate-bearing N=8 burst.
6. The canary's cells are **informational, not gate-bearing**. The N=8 burst's 56 cells are the gate-bearing evidence.

---

## 3. Required wording (verbatim, per card brief)

- **Stage 1 routing flip remains unauthorized by this docs-only card.**
- **Family H production retry remains gated.**
- **Family I remains gated.**
- **Family J remains gated.**
- **`cutover-health-monitor` remains unscheduled** until a separate Stage 1 operator card re-enables it.
- **The canary is NOT a substitute for N=8.** It is only a routing-path verification gate.
- **The N=8 burst is gate-bearing only if the canary confirms `family IS NOT NULL` queue rows.**

---

## 4. Files changed (docs only)

| File | Status | Change |
|---|---|---|
| `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` | MODIFIED | NEW §3.7 "Canary-then-burst arming discipline (binding for every queue-routing drill)" — origin, the binding 6-step sequence, the two clarifications (canary ≠ substitute for N=8; N=8 gate-bearing only after canary PASS). Plus a cross-link in §3.4 step 10 and a reproducibility note in §5 (PR #425 + #426). |
| `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` | MODIFIED | §5 drill table extended with PR #425 (PASS-LOAD) + PR #426 (PASS-LOAD-CONFIRM) rows + "cluster eliminated to terminal" note. §6 gates advanced (steps 1–3 marked DONE; canary-then-burst added as binding step 4; Stage 1 reconsideration described as separate 1%-only operator card; cutover-health-monitor re-enable deferred to Stage 1). §7 provenance updated. |
| `docs/deployment/mcp-server-001-runbook.md` | MODIFIED | Short "Related operational discipline" cross-reference blockquote in the intro pointing to §3.7 + this audit. Other content byte-equal. |
| `docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md` | NEW | This audit. |

No source code, migration, Supabase function, MCP server, prompt, validator, schema mirror, key file, ban-list, familyRegistry, drainer, retry policy, cron, env, Vault, secret, or package change.

---

## 5. Verification

| Step | Result |
|---|---|
| `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-CANARY-THEN-BURST-RUNBOOK-2026-06-02.md` | exit 0, findings 0 (PASS) |
| `git diff --stat HEAD -- mcp-server supabase src app scripts package.json package-lock.json` | empty (docs-only confirmed) |
| `git status --porcelain` (after staging) | only the 4 docs (3 modified + 1 new) |
| Secret-shape scan on all 4 touched docs (`sbp_`, `sb_secret_`, `sk-ant-`, `eyJ…JWT`) | zero real secrets (only placeholder variable names / descriptive prose) |

---

## 6. Adversarial review

Ran as a 3-verifier read-only Workflow (boundary, accuracy, gate-discipline) — all three returned **APPROVE**; 21/21 checks PASS; zero FAIL/INCONCLUSIVE.

- **Boundary (B1–B6) APPROVE**: only docs/ changed (`git diff --stat HEAD` on non-docs paths empty); all four files pure markdown; no real secrets (only placeholders + descriptive prose); no migration/familyRegistry/drainer/retry/prompt/validator/schema/cron/env/Vault change; runbook Phase 1–8 byte-equal except the single intro cross-ref blockquote; design doc top-level sections §4–§8 UNCHANGED (canary added as §3.7 to avoid renumbering).
- **Accuracy (A1–A7) APPROVE**: the canary-then-burst sequence matches what actually happened in PR #426; `family=NULL` correctly described as legacy direct-dispatch and `family IS NOT NULL` as queue path; the §5 PASS-LOAD (#425, 2 transient retries E+F) and PASS-LOAD-CONFIRM (#426, 1 transient retry on evidence_source_chain) rows match the source audits exactly; the Supabase account PAT requirement is consistent across status §4 + runbook Phase 4 + this audit; the ≥120s propagation wait + N=1 canary verification gate stated correctly; cross-references between the four docs consistent.
- **Gate-discipline (G1–G8) APPROVE**: all 7 required wording statements present verbatim; G8 confirms no doc authorizes Stage 1 / percentage > 0 / H/I/J enablement / auto-flipping the routing flag.

---

## 7. Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**.
- **CC writes (DB):** **0**. One read-only `SELECT` preflight (`npx supabase db query --linked --file .claude-tmp/rehearsal-queries/preflight.sql`) for Phase 0 inert confirmation.
- **CC writes (file system; only these four):** the design doc, status doc, deployment runbook (all MODIFIED docs/), and this NEW audit.
- **Routing flag at execution time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested at PR #426 stand-down 2026-06-02T05:06:03Z). NOT touched.
- **Family roster:** A-G production-enabled; H/I/J production-disabled (`familyRegistry.ts:105/110/115`). NOT touched.
- **cutover-health-monitor:** unscheduled. NOT touched.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / validator / schema-mirror / prompt / key file / MCP-tool / package.json / source change.
- **Output discipline:** No JWTs / Bearer tokens / API keys / service-role keys / Supabase PATs / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to any touched doc.

---

## 8. Authorizations + follow-ups

- This docs-only card AUTHORIZES nothing operationally. It codifies a discipline.
- **Stage 1 routing flip remains UNAUTHORIZED.** The next card (`OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1`) is the separate operator authorization for a 1%-only ramp; it must use the canary-then-burst sequence codified here.
- **Family H production retry remains gated.**
- **Family I remains gated.**
- **Family J remains gated.**
- **`cutover-health-monitor` remains unscheduled** until the Stage 1 card re-enables it.
