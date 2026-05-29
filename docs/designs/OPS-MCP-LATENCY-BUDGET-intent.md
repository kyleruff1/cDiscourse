# OPS-MCP-LATENCY-BUDGET — Intent brief

**Operator:** Kyler
**Date:** 2026-05-28
**Card type:** OPS measurement + codification. **Measures and codifies; does NOT redesign, parallelize, or change dispatch behavior.**
**Predecessor state (verified Phase 0):** main at `868fd7f` (OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK smoke PASS). Families A+B+C+D+E+F `productionEnabled: true`; G/H/I/J `false`.

> Operator pre-flight findings (§ Phase 0 below) are guidance to de-risk
> the card; the designer's four Phase A audits MUST independently confirm
> them.

---

## 1. Motivation

Six families (A+B+C+D+E+F) now fire **sequentially** per new argument via
the registry-derived auto-trigger dispatcher (`autoTriggerDispatcher.ts`,
one `await` per family in a `for-of` loop, run as a background task via
`EdgeRuntime.waitUntil`). The F-doctrine-risk smoke explicitly recommended
latency budgeting before more production-enable cards. Family G
(`MCP-SERVER-008-FAMILY-G`) is authorized but should enter the production
path with a **defined** budget, not a reactive surprise. Background
latency grows linearly with family count under sequential dispatch; this
card measures the current per-family + total latency, codifies
warning/FAIL thresholds against a precisely-defined clock, and PROJECTS
the family count at which sequential dispatch crosses the threshold.

---

## 2. Scope

**Measure + codify only.** Allowed: latency reporting (extend
`mcp-observability-report.*` or a new `mcp-latency-report.mjs`), a new
read-only SQL query under `scripts/ops/sql/`, a `docs/ops/` budget doc
(`LATENCY-BUDGET.md` or a section), budget-classification logic + tests
under `__tests__/`, `current-status.md` handoff, this card's
design/audit docs.

**Forbidden (NO behavior change):** `autoTriggerDispatcher.ts` (no
dispatch/parallelization change), `familyRegistry.ts` (no production
flips, no registration), any prompt/taxonomy/schema/key, `mcp-server/**`
runtime, `package.json`/`package-lock.json` (RO-36), the audit-lint
surface (rules/lib/mjs/fixtures).

---

## 3. The three clocks + which one binds (D2)

Compute and record all three per sample; bind the threshold to the
**wall-clock background** one.

| Clock | Definition | Role |
| --- | --- | --- |
| `sum_of_per_family_durations` | Σ over the argument's production runs of (`completed_at − started_at`) | work time; context |
| **`wall_clock_background`** | `max(completed_at) − min(started_at)` over the argument's 6 production runs | **BINDING threshold clock** — grows with family count; the quantity that crosses 45s |
| `submit_to_last_complete` | `max(completed_at) − submit_started_at` (app-side submit time) | full elapsed incl. dispatch kickoff; context |

The budget doc MUST state explicitly that the 45s budget is defined
against `wall_clock_background`, so a future reader does not apply it to
the wrong clock. (Phase 0 confirmed `argument_machine_observation_runs`
has `started_at` + `completed_at`, so all three clocks are computable —
the first two purely from the DB run rows, the third by correlating the
app-side submit timestamp with the argument's run rows.)

---

## 4. Multi-sample measurement (D1, D4)

Measure across **N=5** fresh submitted arguments — never a single
submission (per-family Anthropic latency has real variance; cf. the F1
transient `mcp_validation_failed` watch). Record per-family duration for
each of the 5 samples. For each family, record **min / p50 / p95 / max**;
the budget uses **p50** for the "typical" line and **p95** for the
threshold projection — never a single observation. Also record
`wall_clock_background` p50/p95 across the 5 samples.

---

## 5. Threshold definitions (D5; against `wall_clock_background` p95)

- **PASS:** `wall_clock_background` p95 < **45s** (safe budget) AND the
  submit path does not block on classification.
- **PARTIAL:** `wall_clock_background` p95 ≥ **30s** (warning line) but
  < 45s and non-blocking — headroom pressure worth flagging before the
  next production family.
- **FAIL:** submit path blocks on classification, OR
  `wall_clock_background` p95 routinely ≥ 45s.

The 30s warning / 45s fail lines are the recommended defaults from the
Family D amendment latency note; the designer confirms or adjusts with a
stated rationale.

**Submit path is independent (D3):** submit-argument is fire-and-forget
(`EdgeRuntime.waitUntil`; the response returns before the dispatcher
settles — confirmed in `autoTriggerDispatcher.ts` §2.3 comments). If
submit ever blocks on classification, that is an immediate FAIL
regardless of background timing. Record the submit HTTP response time as
a DISTINCT metric.

---

## 6. The projection deliverable (D6 — the card's reason to exist)

Using per-family **p95**, project total `wall_clock_background` for **7,
8, 9, 10** families (the current 6 plus G/H/I/J), assuming sequential
dispatch continues. State explicitly:
- the family count at which sequential dispatch is projected to cross the
  30s warning line and the 45s FAIL line;
- whether **G (the 7th family)** is projected under or over budget.

This answers the operative question: can G go production under sequential
dispatch, or must a parallelization card precede it?

---

## 7. Out of scope

- Parallelization of the dispatcher (a FUTURE card —
  `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` — filed ONLY if the projection
  shows G or a near-term family crosses the 45s FAIL line). Per D9,
  sequential execution stays; this card does not change
  `autoTriggerDispatcher.ts`.
- Any `familyRegistry.ts` change (no production flips, no G registration).
- Any prompt/taxonomy/schema/key change; any `mcp-server` runtime change.
- The audit-lint enforcement surface.

---

## 8. HALT triggers (10)

1. Any `autoTriggerDispatcher.ts` change (no dispatch behavior change).
2. Any parallelization in this card (future card only, per D9).
3. Any `familyRegistry.ts` change (no flips/registration).
4. Any prompt/taxonomy/schema/key change.
5. Any `mcp-server/**` runtime change.
6. `package.json`/`package-lock.json` change.
7. Any audit-lint surface change (rules/lib/mjs/fixtures untouched).
8. Budget defined against the wrong clock (sum or submit-to-complete
   instead of `wall_clock_background`) — D2 binding violated. **[correctness core]**
9. Single-sample measurement (D1 requires N=5).
10. Test forecast > +50.

Triggers 1/2 are the scope core (no dispatch change); trigger 8 is the
correctness core (wrong clock = wrong budget).

---

## 9. Test forecast

**+10 to +30** (HALT ceiling **+50**). Tests cover the
budget-classification pure function (PASS/PARTIAL/FAIL boundary cases:
just-under-45, just-over-45, exactly-30, submit-blocked-but-fast-background
→ FAIL) and the projection arithmetic — NOT new runtime behavior.

---

## 10. Smoke plan (6-phase, post-merge)

Audit: `docs/audits/OPS-MCP-LATENCY-BUDGET-SMOKE-2026-05-28.md` (carries
`Audit-Lint: v1`; self-lints clean).

1. **Multi-sample submission (D1):** submit 5 fresh args via
   `submit-argument`; record submit HTTP response time (D3) per arg.
2. **Six-run verification:** each arg → EXACTLY 6 production runs
   (A+B+C+D+E+F); G/H/I/J zero.
3. **Per-family + total timing (D2, D4):** per-family duration, the three
   clocks per sample, per-family min/p50/p95/max + wall-clock p50/p95.
4. **Classification + projection (D5, D6):** classify wall-clock p95;
   project 7/8/9/10 families; state the crossing counts + the G call.
5. **Observability + duplicate check:** latency metrics surface in the
   report; Q9 — the 5 new args classify as audit_or_smoke_rerun, no
   organic_duplicate_candidate.
6. **Regression + dogfood:** typecheck/lint/jest(latency)/Deno (871
   unchanged); the smoke audit self-lints exit 0.

**Live-measurement credential dependency:** Phases 1–4 require live
`submit-argument` calls from `.env.bot-tests` (present, 17 assignments —
the same gated path used in the F amendment). Each submission triggers
the production auto-trigger → ~6 background Anthropic classification calls
(≈30 total across 5 samples) — this is the deployed production system's
normal behavior, fire-and-forget. If `.env.bot-tests` lacks the needed
keys at smoke time, the measurement is operator-deferred and the smoke
is PARTIAL (budget thresholds + classification logic + projection method
codified; actual numbers pending operator measurement) — mirroring the
established consistent-PARTIAL pattern.

---

## 11. Brief ledger

| Item | Value |
| --- | --- |
| Card | OPS-MCP-LATENCY-BUDGET |
| Type | OPS measure + codify (no dispatch change) |
| Phase 0 | timing columns exist; dispatcher sequential + fire-and-forget; obs report extensible; `.env.bot-tests` present |
| Binding clock | `wall_clock_background` (D2) |
| Thresholds | 30s warn / 45s fail (designer confirms/adjusts) |
| Samples | N=5 (D1) |
| Projection | 7/8/9/10 families; G under/over-budget call (D6) |
| Test forecast | +10 to +30 (HALT +50) |
| Dispatch change | NONE (D9) |
| Migration | NONE (read-only query only) |
| Anthropic call | only via live `submit-argument` in the post-merge smoke (production behavior; `.env.bot-tests`-gated) |

This card measures and codifies the latency budget so Family G enters the
production path with a known budget. It does not change dispatch behavior.
