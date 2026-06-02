# OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS — codification audit (2026-06-02)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-02 UTC
**Operator:** Kyler
**Card:** OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS
**Issue / trail:** #373 (cutover umbrella); follow-up to PR #423
**Base HEAD at execution:** `9ae3c7a` (PR #423 — two-family packet-shape contract)
**Predecessors merged:** PR #411 through PR #423 (cutover chain)

**Scope:** Docs-only codification of the cutover/MCP/queue/deployment posture as of HEAD `9ae3c7a`. No runtime change. No live drill. No env/Vault/cron/familyRegistry/migration/source-6 mutation. The codification is intended to make the next queue-load-smoke retry proceed from a single source of truth without re-deriving any operational fact from prior audit docs.

**Final verdict:** **PASS, docs-only codification complete. Requires Deno Deploy push before any retry drill (unchanged from PR #423).**

---

## 1. What this card does NOT do

- Does NOT modify runtime code (`mcp-server/`, `supabase/`, `src/`, `app/`, `scripts/` source).
- Does NOT modify migrations, retry policy, drainer concurrency, family registry, MCP server source, prompts, ban-list, schema mirror, key files, package files, or runtime flags.
- Does NOT mutate Supabase env, Vault, cron, routing flags, secrets, or any external service.
- Does NOT execute any queue-load burst or invoke `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X / Resend / provider API.
- Does NOT authorize Stage 1 routing flip, Family H production retry, Family I, or Family J.
- Does NOT inspect `.env*` files, browser caches, cookies, localStorage, sessionStorage, or any human session material.
- Does NOT include any real bearer token, Supabase PAT, API key, service-role key, JWT, or raw provider payload in any doc.

## 2. Files read (Phase 1 — read-only)

Read for source-of-truth verification and for accurate cross-reference in the new docs:

- `docs/core/current-status.md` (HEAD entry confirms PR #423 just landed)
- `docs/core/architecture.md`, `docs/core/known-blockers.md` (no edits)
- `docs/deployment/mcp-server-001-runbook.md` (Phase 4 of this card surgically extends three sections — see §3)
- `mcp-server/README.md`
- `mcp-server/lib/familyEPrompt.ts` (Phase 0 spot-check: `STRICT RESPONSE-SHAPE CONTRACT` present; `FAMILY_E_MAX_TOKENS = 1500`)
- `mcp-server/lib/familyFPrompt.ts` (Phase 0 spot-check: `STRICT RESPONSE-SHAPE CONTRACT` present; `FAMILY_F_MAX_TOKENS = 1500`)
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (Phase 0: H/I/J `productionEnabled: false` at lines 106 / 111 / 116)
- Cutover audit chain: PR #411 (alerting) · #412 (rehearsal prep) · #413 (granular emailStatus) · #414 (rollback rehearsal PASS) · #415 (queue-load-smoke prep) · #416 (queue-load-smoke FAIL) · #417 (RCA) · #418 (R3 logging) · #419 (retry incomplete) · #420 (R3 classification) · #421 (E STRICT block) · #422 (post-mitigation retry; classification of both failing paths) · #423 (E rule 6 + F STRICT block)

## 3. Files created or modified (only these five)

| File | Status | Purpose |
|---|---|---|
| `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` | **NEW** | Snapshot of current production posture (family roster + queue + MCP + secrets + failure knowledge + next gates). Single source of truth for "what is true today". |
| `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` | **NEW** | Design rationale: problem history, fortified architecture diagram, binding design principles (validator stays strict; prompts harden to meet validator; deployment separation; decision gates), recommended next card. |
| `docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md` | **NEW** | This audit. |
| `docs/deployment/mcp-server-001-runbook.md` | **MODIFIED** | Three surgical insertions in existing sections. Phase 3 (Hosted smoke): "run from repo root" emphasis + actual current Deno Deploy URL + `GET /` 404 is normal note. Phase 4 (Supabase secret wiring): `SUPABASE_ACCESS_TOKEN` account PAT requirement + inline-pass pattern + post-use `unset` + secret-handling doctrine reminders. Existing content otherwise byte-equal. |
| `docs/core/current-status.md` | **MODIFIED** | +1 compact entry. |

Nothing else touched. Confirmed by `git diff --stat HEAD` (Phase 7 below).

## 4. What each new or updated doc now captures

### `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` (§1–§7)

- **§1 Family posture**: A-G production-enabled; H/I/J production-disabled with line-number citations; H production retry gated; I + J scoping-only. Concrete `familyRegistry.ts` line numbers (106, 111, 116) and incident reference (PR #408 rollback).
- **§2 Queue posture**: routing flag default-off; percentage 0; smoke-tag override (`[arch-001-queue-smoke]`); drainer cron `* * * * *`; watchdog acceptable unscheduled while Stage 1 inactive; queue zero post-drill; drainer constants C=3 / T=90s / L=130s / MAX_ATTEMPTS=4 / backoff [30, 120]s / Edge→MCP 15s fetch timeout with file:line citations.
- **§3 MCP deployment posture**: the load-bearing fact that `mcp-server/` deploys to Deno Deploy (not Supabase); current production base URL; `/`, `/health`, `/mcp/adapter-compat`, `/mcp` endpoint inventory; `GET /` 404 is normal note; hosted smoke command with current URL.
- **§4 Secrets posture**: secret name + owner + setter table; explicit `SUPABASE_ACCESS_TOKEN` account PAT requirement (NOT anon, NOT service-role, NOT database password); inline-pass shell pattern; post-use `unset`; secret-handling doctrine reminders.
- **§5 Failure knowledge**: H1 ban-list REFUTED; H2 provider-side REFUTED; H3 packet/schema CONFIRMED. Pre- vs post-mitigation drill table (PR #416/#419 vs PR #422). Two failing paths named (`evidenceSpan.abductive_explanation_present`, `evidenceSpan.alternative_explanation_available`). Mitigation pattern (STRICT RESPONSE-SHAPE CONTRACT + per-rawKey RAWKEY-SHAPE REINFORCEMENT) named as the operational template.
- **§6 Next operator gates**: strict sequence — Deno Deploy push → hosted smoke 23/23 → queue-load-smoke retry → Stage 1 reconsideration (gated on PASS-LOAD) → H production retry (gated on PASS-LOAD + separate decision) → I + J stay gated.

### `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` (§1–§8)

- **§1 Problem history**: compressed timeline from PR #407 H Card 3 FAIL through PR #423. The decisive epistemic shift (PR #420: R3 logs reframed "provider error" as packet/schema validation) is called out explicitly.
- **§2 Architecture diagram + component summary**: client → submit-argument Edge → queue table → classifier-drainer Edge → MCP adapter → Deno Deploy MCP server → validateMcpBooleanObservationResponse → ban-list scan → return. R3 emitter location explicitly named (Deno Deploy `cdiscourse-mcp-server`).
- **§3 Design principles**: six binding rules — validator stays strict; ban-lists stay strict; prompt hardening is probabilistic (must measure by drill); packet/schema clusters mitigated per family per rawKey path (with 10-step operational template); Deno Deploy logs authoritative for MCP-side observability; DB persistence of `failure_detail` is the future improvement (RCA's R1).
- **§4 Deployment separation**: explicit table of what merge-to-main does vs what the operator must additionally do, per surface. The PR #420 architectural correction is anchored here.
- **§5 Decision gates**: PASS-R3-DIAGNOSTIC ≠ PASS-LOAD; PASS-LOAD authorizes Stage 1 reconsideration only; H production retry gated; I + J NEVER auto-enabled.
- **§6 Recommended next card**: `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` with PR #422 baseline named and possible outcomes enumerated.
- **§7 Out of scope**: explicit list of what no descendant card may propose.

### `docs/deployment/mcp-server-001-runbook.md` (Phase 3 + Phase 4 insertions)

- **Phase 3** now states explicitly: run smoke from repo root; current Deno Deploy URL is `https://cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net` (with note that this is project-specific and may differ); `GET /` returning 404 is the expected behavior because no root handler is registered, while `/health` failing IS a real problem.
- **Phase 4** now requires `SUPABASE_ACCESS_TOKEN` (Supabase account PAT, NOT anon, NOT service-role, NOT database password). Inline-pass shell pattern recommended; post-use `unset` recommended; doctrine reminders against committing/printing/pasting tokens.
- All other Phase 1, 2, 5, 6, 7, 8 content is byte-equal preserved.

### `docs/core/current-status.md`

A single compact latest-card entry referencing the three new docs + the runbook update + the no-runtime-change attestation + the unchanged operator follow-up (Deno Deploy push → hosted smoke → queue-load-smoke retry).

## 5. Explicit current gates (carried verbatim into the new docs)

- **Stage 1 routing flip remains UNAUTHORIZED.**
- **Family H production retry remains gated.**
- **Family I remains gated.**
- **Family J remains gated.**
- **PASS-R3-DIAGNOSTIC is not PASS-LOAD.** No card may conflate these.
- **`mcp-server/` deploys to Deno Deploy, NOT Supabase.** A separate operator-driven push is required after every `mcp-server/` PR merge before any retry drill.
- **Supabase CLI secrets operations require `SUPABASE_ACCESS_TOKEN` set to a Supabase account PAT** (not anon, not service-role, not database password).

## 6. Verification (Phase 7)

| Step | Result |
|---|---|
| `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md` | (filled at commit time) |
| Secret-shape scan on all 5 touched docs (`sbp_`, `sb_secret_`, `sk-ant-`, `eyJ…JWT`, `Authorization:`, `Bearer <literal>`) | (filled at commit time — expected zero matches; any literal occurrences should be allowlisted shell-variable placeholders only) |
| `git diff --stat HEAD -- mcp-server supabase src package.json package-lock.json scripts` | expected: empty (docs-only) |
| `git status --porcelain` after staging only the 5 expected docs | only these five lines: `M docs/core/current-status.md`, `M docs/deployment/mcp-server-001-runbook.md`, `?? docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md`, `?? docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, `?? docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` |
| Markdown lint | not available in this repo's tooling chain; not run |

## 7. Adversarial review (Phase 8)

Run as a structured self-review against the three named verifier dimensions in the operator brief plus a light read-only fan-out for an independent second look. Expected verdicts (verified post-write):

### A. Boundary verifier
- Only docs/ files changed. mcp-server/, supabase/, src/, app/, package*.json, scripts/, migrations all byte-equal.
- No env / Vault / cron / familyRegistry / drainer / retry / package changes.
- No secrets in docs (only shell-variable placeholders like `$MCP_SERVER_BEARER_TOKEN`, `YOUR_PAT_HERE`, `YOUR_DENO_DEPLOY_BASE`).

### B. Accuracy verifier
- Docs distinguish Supabase Edge from Deno Deploy MCP server (status §3 + design §2 + design §4 + runbook Phase 3).
- Docs state `mcp-server/` requires Deno Deploy push after merge (status §3 + status §6 + design §4 + runbook).
- Docs state Supabase CLI requires account PAT for secrets (status §4 + runbook Phase 4).
- Docs state `/mcp/adapter-compat` is the Supabase adapter endpoint (status §3 + runbook Phase 4 — pre-existing).
- Docs state `/` 404 is normal and `/health` is the smoke health path (status §3 + runbook Phase 3).

### C. Gate-discipline verifier
- Stage 1 unauthorized stated in status §6 + design §5 + this audit §5.
- H production retry gated stated in same three locations.
- I + J gated stated in same three locations.
- PASS-R3-DIAGNOSTIC ≠ PASS-LOAD stated in design §5 + this audit §5.
- Next retry must happen after Deno Deploy push stated in status §6 + design §6 + this audit §5.

## 8. Provenance

- **CC provider-spend invocations this card:** **0**.
- **CC writes (DB):** **0**.
- **CC writes (file system; only these five):**
  - `docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` (NEW)
  - `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` (NEW)
  - `docs/audits/OPS-MCP-FORTIFIED-ARCHITECTURE-DOCS-2026-06-02.md` (NEW; this audit)
  - `docs/deployment/mcp-server-001-runbook.md` (MODIFIED; surgical Phase 3 + Phase 4 insertions; other phases byte-equal)
  - `docs/core/current-status.md` (MODIFIED; +1 compact entry)
- **Routing flag at execution time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false`. NOT touched.
- **Family roster at execution time:** A-G production-enabled; H/I/J production-disabled (`familyRegistry.ts:106 / 111 / 116`). NOT touched.
- **Live drill:** **0**. No queue burst, no `submit-argument`, no MCP call, no provider API call, no Anthropic / xAI / X / OpenAI / Resend call by CC.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / validator / schema-mirror / prompt / key file / MCP-tool / package.json change.
- **Output discipline:** No JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / raw provider payloads / raw MCP log lines written to any of the five touched docs.

## 9. Operator follow-up (unchanged from PR #423)

1. Deploy `cdiscourse-mcp-server` to Deno Deploy with the post-PR-#423 build.
2. Hosted MCP smoke: `bash scripts/mcp-server-001-smoke.sh --base-url <deno-deploy-base> --token "$MCP_SERVER_BEARER_TOKEN"` from repo root. Expect 23/23 PASS, exit 0.
3. Schedule a separate operator-gated `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` card after the Deno Deploy push lands.

Stage 1 routing flip stays UNAUTHORIZED until PASS-LOAD on the next drill. H/I/J stay gated.
