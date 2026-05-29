# OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Intent brief

**Operator:** Kyler
**Date:** 2026-05-29
**Card type:** runtime OPS — auto-trigger DISPATCH STRATEGY only (sequential → bounded parallel). Ships NO new family; changes NO prompts/taxonomy/keys/schema/Source-6/audit-lint; flips NO productionEnabled flags.
**Predecessor (Phase 0 verified):** main at `494a92a`. A–G production + auto-trigger; H/I/J unsupported. Family G suite complete (admin ship → 1A Edge subset fix → 1B test robustness → 2 L5 mechanization → 3 production flip). 7-family sequential `wall_clock_background` p95 = 34.6s (30–45s warning band; 45s FAIL projected at the 8th pessimistic / 9th central family).

## 1. Motivation

The 7-family production auto-trigger is sequential; the latency budget is in the warning band and trending toward the 45s FAIL line as families are added. This card hardens the dispatcher with **bounded parallelism** BEFORE the next production flip (Family H), keeping submit nonblocking and background completion under budget. **Organizing principle: unit-green ≠ concurrency-correct** — the smoke (overlap diagnostic + 429 capture) verifies what unit tests structurally cannot (actual call overlap, submit-still-nonblocking under load, no shared-state corruption, no rate-limit flakiness).

## 2. Phase 0 findings (designer confirms)

- **Sequential loop**: `autoTriggerDispatcher.ts:430–438` — `const outcomes = []; for (const family of eligibleFamilies) { const o = await dispatchOneFamilyIteration(argumentId, family, serviceClient); outcomes.push(o); } return outcomes;`. No inter-family throttle/sleep. Per-family failure isolation ALREADY exists (the try/catch inside `dispatchOneFamilyIteration`).
- **D4 reentrancy — already satisfied**: `dispatchOneFamilyIteration` uses only LOCAL state (`iterationStartMs`, `singleFamilyArray`, `lastSummary` (261), `attemptNumber` (262)); the shared `serviceClient` is a stateless Supabase client; no module-level mutable, no shared accumulator. Tasks are independent → no "make independent first" rework needed. (The card's D4/HALT-16 condition does not fire.)
- **D8 inter-family gap**: await-induced serialization (the ~1.3–2.2s wall-vs-sum gap is scheduling + the per-family idempotency pre-check between the sequential awaits), NOT a deliberate throttle. Bounded parallelism subsumes it by overlapping the ~5s per-family classifications. The retry backoff (sleep 2s/8s) lives INSIDE `dispatchOneFamilyIteration` (per-family, retryable-failure only) and is preserved.
- **Submit fire-and-forget**: the dispatcher is the background task (`EdgeRuntime.waitUntil` at the submit-argument call site); the loop is inside it; submit never awaits classification. Preserved.

## 3. Binding decisions

- **D1 bounded concurrency = 2.** Named exported constant `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` (constant, not env var — auditable, rollback-via-PR), placed where the test imports it (D7). NOT unbounded `Promise.all`. **Rationale for 2: SAFETY** (rate-limit headroom + simple reasoning), not throughput-optimality; a later bump to 3 is a 1-line PR gated on the measured 429 rate at 2 (smoke Phase 4c).
- **D2 per-task error isolation (allSettled-style).** Each family's rejection is caught per-task + logged; a rejected family NEVER aborts siblings. (Builtin `Promise.all` forbidden — it aborts on first rejection.) The existing per-iteration try/catch already returns a typed `failed` outcome rather than throwing, so allSettled-style collection is natural.
- **D3 preserve**: registry-derived eligible-family selection (no per-family hardcoding); one-production-run-per-family-per-argument (the idempotency pre-check); A–G classifier behavior byte-equal; D/G subset filtering through the existing `booleanObservationRequestBuilder`; submit fire-and-forget.
- **D4 reentrancy**: confirmed already satisfied (§2); the helper consumes independent tasks.
- **D5 latency-report anchor fix** (in-scope, tightly scoped): `mcp-latency-report.mjs`'s projection section hardcodes a "6-family" anchor label (off-by-one after the G flip). Make it DERIVE the current production-family count dynamically (label/anchor only — no broader report-scope change). Any latency SQL stays in `scripts/ops-latency-sql/` (sibling; `scripts/ops/sql/` is observability-owned).

## 4. Scope

Allowed runtime: `autoTriggerDispatcher.ts` (or the smallest pure concurrency helper the designer recommends extracting). Allowed tests: new/updated Edge auto-trigger + concurrency tests. Allowed observability: `scripts/ops/mcp-latency-report*` and/or sibling latency SQL — D5 anchor fix only.
Disallowed: prompt/taxonomy/family-key/schema; familyRegistry flags; MCP-server family code (unless designer PROVES a test-only import is unavoidable); Source 6 policy; audit-lint rules; package.json/lockfile; .gitignore. Do NOT commit out//tmp/smoke-harnesses/reports; explicit `git add <files>` only.

## 5. Test requirements (D6–D8)

D6 concurrency tests (NO live Anthropic — a stubbed dispatch fn recording start/end ticks): (1) max observed concurrency NEVER exceeds the bound; (2) max observed concurrency REACHES the bound with ≥3 eligible families; (3) all A–G dispatch, H/I/J don't; (4) a per-family rejection does NOT prevent siblings dispatching; (5) one-run-per-family intact; (6) D/G subset filtering still holds through production request construction; (7) submit path remains fire-and-forget (does NOT await family completion).
D7 assert against the IMPORTED constant: `expect(maxObserved).toBeLessThanOrEqual(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)` + `expect(maxObserved).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)`. Forbidden: `expect(maxObserved).toBe(2)` (Card-1B brittleness repeat when the constant becomes 3).
D8 boundary diffs shown: no prompt/taxonomy/MCP-family diff; no familyRegistry flag diff; no audit-lint diff; no package.json diff; no generated artifacts staged.

## 6. HALT triggers (16)

1 H/I/J family work; 2 productionEnabled flag change; 3 prompt/taxonomy/schema/key change; **4 unbounded parallelism**; **5 submit starts awaiting classifier completion (existential)**; **6 a per-family failure can abort siblings**; 7 idempotency behavior changes without review; 8 D/G subset weakening; 9 Source 6 change; 10 audit-lint rule change; 11 package.json/lockfile change; 12 generated report/harness staged; 13 forecast > +120 without rationale (expected +15 to +40); 14 live smoke spends Anthropic before operator approval; **15 concurrency test hardcodes the literal bound instead of importing the constant (D7)**; **16 dispatchOneFamilyIteration found to share mutable state and the card does NOT make tasks independent first (D4 — Phase 0 already cleared this)**. Triggers 4/5/6 + 15/16 are the core.

## 7. Test forecast

+15 to +40 (HALT +120). The concurrency-runner tests (the 7 D6 cases) + the bound assertions (D7) + the latency-anchor test.

## 8. Smoke plan (post-merge; operator-gated before live Anthropic spend; canary-first)

Phase 1 read-only latency (record p95; confirm D5 anchor labels correct). Phase 2 CANARY (1 submit; **submit-nonblocking GATE measured FIRST** — if submit regressed → IMMEDIATE FAIL; then 7 production runs A–G; H/I/J zero). Phase 3 live N=5. Phase 4 latency vs ~34.6s baseline (PASS <30s; PARTIAL 30–45s but ≥20–25% improved + correctness clean; FAIL >45s or correctness regression). **Phase 4b OVERLAP DIAGNOSTIC** (make/break): from per-family started_at/completed_at compute MAX OBSERVED CONCURRENCY — expected up to the bound; **overlap=1 → HALT-and-DIAGNOSE (downstream serialization), NOT "try concurrency 3"**. **Phase 4c RATE-LIMIT CAPTURE**: 429/retry count across N=5 (zero at 2 pre-justifies a future bump to 3). Phase 5 read-path + Q9 (no organic_duplicate_candidate). Phase 6 audit (`Audit-Lint: v1`; `Doctrine-risk: false`; before/after latency table; max-observed-concurrency; 429 count; canary + N=5 evidence; self-lint exit 0).

## 9. Ledger

| Item | Value |
| --- | --- |
| Card | OPS-MCP-AUTO-TRIGGER-PARALLELIZATION |
| Change | sequential `for...await` → bounded parallel (limit 2) in autoTriggerDispatcher.ts |
| Constant | `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` (exported; tested via import) |
| Isolation | allSettled-style per-task (no Promise.all) |
| D4 reentrancy | already satisfied (local state only) — no rework |
| D5 | latency-report anchor → dynamic production-family count |
| Family change | NONE; no flag flip; no prompt/taxonomy/schema |
| Forecast | +15 to +40 (HALT +120) |
| Smoke | overlap diagnostic + 429 capture; canary-first; ~35–40 gated Anthropic calls |
