# MCP-H-001 — Family H (claim_clarity) retry scoping (Stage-2 re-attempt, GATE A only)

Audit-type: ops

**Status:** Design draft (scoping + reproduction plan only)
**Epic:** Epic 12 — MCP semantic-referee cutover (Lane C, Family H)
**Release:** Post-Stage-6.4 MCP track (H/I/J integration)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/472
**Card type:** Design-only. **No IMPLEMENT phase.** Ends at GATE A (operator approval).

> **This card authorizes nothing.** It is a scoping doc plus a read-only reproduction plan. It does not flip a registry boolean, does not edit a source subset, does not change a guard or threshold, does not advance a routing percentage, and does not run the reproduction plan. The plan is delivered as a doc and executed only in a later operator-gated card after GATE A and after the E#7 conjunction clears.

---

## 0. Goal (one paragraph)

Family H (`claim_clarity`) was production-enabled at PR #405 / `488d105`, its post-merge smoke FAILed (audited at PR #407), and the flip was reverted at PR #408 / `722f17b`. The recorded failure was terminal `mcp_api_error` holes dispersed across four families (`argument_scheme`, `critical_question`, `disagreement_axis`, `claim_clarity`) at the 8-family load — a provider/server reliability pattern, **not** an H-specific classifier defect (`docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md:15-17`). HALT 15 fired. Before any retry can be drafted, the project needs one thing the FAIL audit did not produce: a per-layer attribution of the failure across the seven candidate layers (prompt, schema, validator, source subset, packet shape, latency, UI display), plus a read-only reproduction plan that would isolate the cause without re-exposing the production surface. This card delivers exactly that, and encodes the operator-ratified retry gate (E#7) and terminal-zero bar (E#11) verbatim so the path to any future flip is unambiguous. The design is shaped by cdiscourse-doctrine §1 (claim-clarity keys are structural Observations, never a verdict on a person or on a claim's correctness), §4 (the classifier is advisory; `authoritative: false`), §5 (no engine change), and §10a (machine-source node labels; H is not a sensitive family).

---

## 1. Inventory of the PR #407 smoke FAIL artifacts (failure-context root)

The failure-context root is two documents, cited here with re-derived line numbers:

- **FAIL audit** — `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-01.md:15-17`. Verbatim verdict frame:
  - `:15` — "**Final verdict: FAIL.**"
  - `:17` — "The Family H chain is HALTED at Card 3 smoke under **HALT 15** ... background classifier **run-completeness failed**: the canary had a terminal hole on `argument_scheme`, and the burst surfaced terminal holes across multiple families (`argument_scheme`, `critical_question`, `disagreement_axis`, `claim_clarity`). The pattern is provider/server reliability resurfacing at 8-family count, not an H-specific prompt / classifier defect."
- **Revert review** — `docs/reviews/REVERT-MCP-021C-EDGE-FAMILY-H-ENABLE.md:15`. Verbatim scope: the post-merge smoke "reported terminal provider holes spread across `argument_scheme`, `critical_question`, `disagreement_axis`, and `claim_clarity` (7 `mcp_api_error` events across 4 distinct families — not H-specific; reads as provider/server reliability resurfacing at the 8-family load profile). HALT 15 fired. The rollback restores the Edge production roster to A–G (7 families) by flipping `claim_clarity` `productionEnabled` from `true` back to `false` at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106`".

Key facts established from the artifacts:

| Fact | Value | Citation |
|---|---|---|
| Enable merged | PR #405, `main` commit `488d105` (flip at `familyRegistry.ts:106`) | FAIL audit `:10` |
| Reverted | PR #408, commit `722f17b` (flip back `true → false`) | issue #472 body; revert review `:15`, `:25` |
| Failure signature | terminal `mcp_api_error` (provider/transport), 7 events / 4 families | FAIL audit `:52`, `:54`, `:116`, `:159` |
| Canary result | `successFamilies = 7/8`; terminal hole on `argument_scheme`; **H itself succeeded** | FAIL audit `:62`, `:65` |
| Burst result | 1/4 args reached 8/8; holes on `argument_scheme` (2 args), `critical_question`, `disagreement_axis`, `claim_clarity` | FAIL audit `:109-116` |
| Latency | p50 24.4 s / p95 31.3 s — within PARTIAL band, under the 45 s FAIL line; `maxOverlap = 2` | FAIL audit `:117-118` |
| Doctrine (L5) | CLEAN on 29 H production success rows; 0 banned-token hits across the 7 scanned categories | FAIL audit `:128`, `:145`, `:147` |
| Dispersal observation | 7 `mcp_api_error` over 4 families argues against an H-prompt-shape defect; provider/server reliability at the 8-family concurrency profile | FAIL audit `:159`, `:176` |
| HALT | HALT 15 (run-completeness under live load) | FAIL audit `:17`, `:183` |

**The one fact the FAIL audit did NOT establish (the gap this card names but does not invent):** the audit did not narrow the failure to any specific Family H key (`definition_present` / `claim_specificity_low` / etc.). Per the FAIL audit, Family H's own classifier succeeded on 4 of 5 smoke args and produced clean, in-set, doctrine-clean rows; the single arg where the H run failed twice (`660042f6`) failed with `mcp_api_error`, the same provider/transport signature seen on `argument_scheme`. Per-key failure isolation for Family H is therefore **currently MISSING**. This designer does not invent per-key attribution; the reproduction plan (§4) is the instrument that would produce it.

---

## 2. The seven candidate failure layers — rule-in / rule-out

Each layer is evaluated against the recorded PR #407 signature and against the comparative failure classes the project has already typed. The canonical residual-classification source is the persisted `failure_detail` (`detail.serverReason` + `validator_path`) from PR #432, DB-readable (`docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:37`).

### Layer 1 — Prompt (`family-h-v1` system prompt + per-key falsePositiveGuards)

- **Rule-OUT (strong).** The FAIL audit's Phase 3 (`:73-93`) shows Family H produced clean, high-confidence positive rows on every arg where the H run succeeded (4 of 5), entirely within the 12-key uniform `ai_classifier` set, with no out-of-set raw_keys. The Card 1 hosted smoke (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md:41`, 23/23 PASS, exit 0) independently proves the prompt yields valid `family-h-v1` output on both `/compat` and `/mcp` at admin_validation depth. A prompt-content defect would present as malformed/empty output or a doctrine leak on completed rows; neither was observed.
- **Residual to confirm.** That the terminal `mcp_api_error` holes are not prompt-induced. `mcp_api_error` is a provider/transport outcome (the call did not return a parseable classifier result), not a content rejection. Exit criterion: §4 Stage 1 + Stage 2 produce valid H output → prompt confirmed clean.
- **Surface:** `mcp-server/lib/familyHPrompt.ts` + `familyHKeys.ts` (12 keys, uniform `ai_classifier`; the 4 verdict-adjacent keys carry per-key `falsePositiveGuards` per `docs/designs/MCP-SERVER-009-FAMILY-H-intent.md:22`, `:38-42`, `:65-70`). Out of scope to edit in this card.

### Layer 2 — Schema (boolean-observation schema mirror / response contract for the 12 H keys)

- **Rule-OUT.** H is the 8th family on an already-shipped schema. A schema mismatch presents as `validation_failed` + `packet_invalid` (`docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:36`), not `mcp_api_error`. The 29 completed H rows validated against the 12-key set with no out-of-set keys (FAIL audit `:91`). The recorded failure_reason was `mcp_api_error` throughout (FAIL audit `:52`, `:54`, `:116`).
- **Exit criterion.** §4 Stage 3 SQL shows 0 `validation_failed` / `packet_invalid` on `claim_clarity` rows → schema confirmed clean.
- **Surface:** `seedPrompt.ts` / `mcpBooleanObservationSchemaMirror.ts` were byte-equal-protected during the H ship (HALT 5; intent `:90`). Out of scope.

### Layer 3 — Validator (downstream result-validation under burst — the second `mcp_validation_failed` cause)

- **Comparative rule-in (analog, not the observed signature).** MEMORY note "mcp_validation_failed under burst concurrency" documents a second, intermittent (~4–8 s), load-correlated cause of `mcp_validation_failed` in downstream result-validation (distinct from the input-subset cause), gating Family H production and concurrency > 2 on follow-up #365. The PR #407 holes were load-correlated (they appeared only under the 8-family burst), which is the family resemblance to this class.
- **Rule-OUT for the specific PR #407 incident.** The recorded failure_reason was `mcp_api_error`, not `mcp_validation_failed`; the dispersal across 4 families and the recovery-on-other-args pattern point at provider/transport, not at a deterministic validator rejection (FAIL audit `:159`). The discriminator is `failure_detail.validator_path`: `null` → provider/transport; non-null → downstream validator (cutover-gate `:35`, `:37`).
- **Exit criterion.** §4 Stage 4 burst: holes with `failure_reason = mcp_validation_failed` + non-null `validator_path` implicate the validator; holes with `mcp_api_error` + `validator_path = null` implicate provider/transport.

### Layer 4 — Source subset (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES`)

- **Rule-OUT (definitive, by family structure).** Family H is uniform `ai_classifier` across all 12 keys. It therefore has **no** entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (`supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts:68-89` lists only `evidence_source_chain`, `resolution_progress`, and `thread_topology`; `claim_clarity` is absent throughout the map). Absence = full registry passthrough — there is no subset to mis-scope (FAIL audit Phase 1 `:36`). The source-subset failure class (live-only `mcp_validation_failed` from `unsupported_rawKey`) applies ONLY to mixed-source families (D, G, I) per MEMORY note "MCP mixed-source family Edge subset" and `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:133`. H cannot exhibit it.
- **HARD constraint.** Adding a `claim_clarity` entry to `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` is a **HALT-13 defect** (`docs/designs/MCP-SERVER-009-FAMILY-H-intent.md:61`, `:119`, `:130`). No future H card may add one.
- **Exit criterion.** None required — definitively ruled out.

### Layer 5 — Packet shape (response-packet contract; families E/F shape-tuning precedent)

- **Comparative rule-in candidate.** Families E/F required packet-shape tuning (the STRICT RESPONSE-SHAPE CONTRACT + per-rawKey RAWKEY-SHAPE REINFORCEMENT mitigations, PRs #421/#423). A packet/schema residual presents as `validation_failed` + `packet_invalid` on a specific `evidenceSpan.*` path, **deterministic across all 4 attempts** (cutover-gate `:36`; confirmed precedent `critical_question.evidenceSpan.unstated_assumption`, `9ef5aab5`, PR #443, cutover-gate `:75`, `:79`).
- **Rule-OUT for PR #407.** The H holes were `mcp_api_error` (provider/transport), not `validation_failed` + `packet_invalid`; and they were **not** deterministic per-key — the same families succeeded on other args within the same burst, which a packet-shape residual (deterministic per rawKey, retry-immune) would not do.
- **Exit criterion.** §4 Stage 3 SQL: 0 `packet_invalid` on `claim_clarity`. §4 Stage 4: any `claim_clarity` hole carrying `validation_failed` + `packet_invalid` + an `evidenceSpan.*` path, deterministic 4/4, would implicate packet shape and route to a Family-H STRICT RESPONSE-SHAPE CONTRACT card (§3 matrix).

### Layer 6 — Latency (8-family bounded-parallel wall time; D8 re-measure)

- **Rule-OUT as proximate cause.** FAIL audit `:117` — p50 24.4 s / p95 31.3 s, within the 30–45 s PARTIAL band, under the 45 s FAIL line; `maxOverlap = 2` (bounded-parallel limit held). FAIL audit `:122` states verbatim: "The reliability failure is NOT a latency-regression effect — terminal holes appear even on the args that finished faster."
- **Rule-IN as contributing load factor.** The failure is concurrency-correlated (provider reliability at the 8-family load profile; roadmap P5 `:138-139`). Latency is a symptom band, not the cause.
- **Exit criterion.** §4 Stage 4: re-measure p50/p95 at admin_validation depth; terminal-zero with wall under 45 s confirms latency is non-causal.

### Layer 7 — UI display (how H Observations render — the node-label surface)

- **Rule-OUT (definitive, out of the failure path).** The PR #407 failure was in background classifier run-completeness (server/provider), entirely upstream of any client render. H Observations are machine-source node labels (doctrine §10a); the production flip routes auto-trigger dispatch only. The revert review confirms the flip touched zero `src/**` (revert review `:89`); no UI code is in scope for the flip. The smoke FAIL was scored on persisted run rows, not on display.
- **Exit criterion.** None required — UI is not in the failure path.

### Summary attribution

The PR #407 signature is **provider/server reliability at the 8-family load profile** (Layer 6 contributing, Layers 1/2/4/7 ruled out, Layers 3/5 comparative analogs ruled out for this incident but retained as reproduction-plan discriminators). The per-key isolation gap (§1) is the missing evidence the reproduction plan would close.

---

## 3. Per-layer exit criteria and downstream-fix decision matrix

Each isolated cause maps to its eventual fix card. **None of these is this card** — this card only names them.

| Isolated cause (evidence that isolates it) | Downstream fix card (NOT this card) |
|---|---|
| Provider/transport at load (`mcp_api_error`, `validator_path = null`, dispersed across families, recovers on other args) | The provider/server reliability track: the `#371` successor / provider-control architecture named in the revert review `:125`; the ARCH-001 queue + bounded-concurrency drainer cutover. The H flip re-attempt (Lane C / Template C / **MCP-H-002**) consumes this track's result; it does not drive it. |
| Downstream result-validation under burst (`mcp_validation_failed`, non-null `validator_path`, intermittent ~4–8 s) | `OPS-MCP-RESULT-VALIDATION-BURST-HARDENING` (corpus-30 README `:50`) / the `#365` follow-up (MEMORY "mcp_validation_failed under burst concurrency"). |
| Packet/schema residual on a `claim_clarity` rawKey (`validation_failed` + `packet_invalid`, deterministic 4/4, `evidenceSpan.*` path) | A Family-H-specific STRICT RESPONSE-SHAPE CONTRACT + per-rawKey RAWKEY-SHAPE REINFORCEMENT card (the #421/#423/#443 pattern; cutover-gate `:36`). The validator gate is never relaxed. |
| Prompt/doctrine drift on a completed H row (banned-token hit or malformed output) | A Family-H prompt-revision card (falsePositiveGuards + `FAMILY_H_BAN_PATTERNS`). Phase 6 of the FAIL audit found this CLEAN, so this branch is improbable. |
| Latency band breach (> 45 s) | The bounded-parallel / drainer tuning track (limit, `C=3`, `MAX_ATTEMPTS=4`, backoff `[30,120]s`). Not an H card. |

The decision matrix is a routing table, not an authorization. Whichever cause the reproduction plan isolates, the fix lands in its own operator-gated card, and only after that does the E#7 conjunction (§5) become evaluable for an H flip.

---

## 4. Smoke reproduction plan (delivered as a plan; NOT executed in this card)

All four stages are **read-only with respect to the production family roster**: no `productionEnabled` flip, no registry edit, no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` edit, no routing-percentage change. Stages 1–3 are pure verification; Stage 4 drives the **admin_validation** path only (which is already enabled for H — `familyRegistry.ts:107` `adminValidationEnabled: true`), so it measures provider reliability at the target load without re-exposing the production surface.

### Stage 1 — Local Deno + Jest smoke of the H admin_validation path (should still PASS)

- **Deno:** run the `mcp-server` `familyH*` test suites (`familyHKeys` / `familyHKeysParity` / `familyHPrompt` / `familyHBanListScan` / `familyHAnthropic` / `familyHResponseValidator` / `familyHDispatch` / `familyHDoctrineFixtures`).
- **Jest (Edge):** run `__tests__/booleanObservationFamilyRegistry.test.ts` (guards H `productionEnabled: false`), `__tests__/booleanObservationRequestBuilder.test.ts` (guards H uniform-source / no subset entry), `__tests__/auditLintRules.test.ts` (guards Card-2 L5 `family_h` enforcement).
- **What it isolates:** confirms Layers 1 (prompt), 2 (schema), and the validator code path are code-clean at the unit level — the admin_validation posture is unchanged since Card 1.
- **Posture:** local only; no network beyond the Deno test harness; no DB write.

### Stage 2 — Hosted MCP smoke at admin_validation depth (no flip, no registry edit)

- Re-run `scripts/mcp-server-001-smoke.sh --base-url https://cdiscourse-mcp-server.civildiscourse.deno.net --token "$MCP_HOSTED_TOKEN"` (the Card 1 smoke; `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md:36-41`, expected 23/23, exit 0).
- Checks 22 (`compat-boolean-family-h`) + 23 (`mcp-tools-call-boolean-family-h`) assert `classifierSetVersion` contains `family-h-v1` on both surfaces.
- **What it isolates:** confirms the hosted classifier serves valid H output → rules out Layers 1/2/5 at the hosted-classifier boundary under single-call conditions.
- **Posture:** hosted read of the classifier surface; no production flip; no Edge registry edit.

### Stage 3 — Read-only SQL verification of `claim_clarity` runs/results rows

- Re-use the `scripts/corpus-30-phase-7-sql/` read-only inspection pattern (`README.md:10-16` posture: no insert/update/delete, no re-trigger, no routing arm, no H/I/J production touch).
- Query `argument_machine_observation_runs` (group by `COALESCE(family, requested_families[1])` — the DIRECT-DISPATCH path does not populate `family`, `README.md:41`) and `argument_machine_observation_results` (`.family` IS populated, `README.md:42`) for family `claim_clarity`, `run_mode IN ('admin_validation')`.
- Inspect the persisted `evidence_span` column on the `claim_clarity` result rows for doctrine compliance (the same scan the FAIL audit ran at `:128-147`, and the BINDING L5 inspection-pattern from `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md:115-135`), and project the leak-safe `failure_detail` fields (`detail.serverReason` + `validator_path`) for any failure rows.
- **What it isolates:** discriminates `mcp_api_error` (`validator_path = null`, provider/transport) vs `mcp_validation_failed` (non-null `validator_path`, downstream validator) vs `validation_failed` + `packet_invalid` (packet shape) — the discriminator from cutover-gate `:35-37`.
- **Posture:** read-only SQL via an admin SELECT role; no backfill (a backfill is a separate operator authorization, `README.md:54`).

### Stage 4 — N=8 burst against admin_validation only, bounded-parallel limit 2

- Drive N=8 **admin_validation** classification requests (NOT production; no flip) through the established bot-session path (`.env.bot-tests`, anon-key + Supabase Auth; no service-role; no direct insert), at bounded-parallel limit 2 — the auto-trigger pattern from MEMORY note "Auto-trigger burst → provider_network_error" and "mcp_validation_failed under burst concurrency" (bounded-parallel limit 2; p95 improved 34.6 s → 19.3 s).
- Measure: per-family terminal-hole rate, per-hole `failure_reason` + `failure_detail.validator_path`, and p50/p95 wall.
- **What it isolates:** whether the H admin_validation path holds terminal-zero at the 8-family-equivalent load on the post-cutover substrate. If it does, provider reliability is demonstrated for the H path without a production flip. If holes recur, Stage 3's `failure_detail` discriminator attributes them per the §3 matrix.
- **Posture:** admin_validation only; no `productionEnabled` flip; bounded-parallel limit 2; read-only with respect to the production roster.

**Plan-level invariant:** this card delivers the plan. The plan is executed only in a later operator-gated card, after GATE A and after the E#7 conjunction (§5) clears. Synthetic execution of this plan does NOT by itself unblock H (see §5, E#11, and the §4-T bar-integrity rule).

---

## 5. The retry gate — E#7 and E#11 encoded verbatim; today's precondition status

### E#7 — the three-conjunctive-condition H retry gate (verbatim)

From `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:78`, the normalized (tightened) wording, verbatim:

> H retry requires **all of**: (a) non-H PASS-LOAD, (b) separate operator decision, (c) provider/server reliability proven at higher (8-family) load + clean Card-3 re-run smoke; the non-H PASS-LOAD alone does NOT unblock H

Operator ratification, verbatim from the GATE C block at `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:100`:

> **✅ GATE C COMPLETE — operator ratified all five (2026-06-03, on PR #446).** ... (3) **H production stays gated behind the real-organic Stage-1 precondition** — synthetic-only evidence does not authorize H

And the §F-3 ratification, verbatim from `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:104`:

> 3. **Synthetic-only H authorization.** The H re-attempt smoke is defined purely on a synthetic canary-then-burst, while P1 requires real organic evidence above 1%. A synthetic-only reading would lower the H un-freeze bar and re-expose the 8-family surface that already failed (PR #407/#408). **Kept both: P1 real-organic precondition must precede the H synthetic smoke.** *Operator confirm: the ordering is binding before any H flip.*

**Synthetic PASS alone does NOT unblock H.** Lowering the bar to accept synthetic-only evidence is forbidden by the §4-T bar-integrity rule (`docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:8`): "This consolidation may **tighten, preserve, or clarify** a gate bar. It may **never lower** a bar". This scoping card does not propose, and may not be read to propose, any relaxation of E#7.

### E#11 — the terminal-zero bar (verbatim)

From `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md:82`, verbatim:

> Reconcile to the stricter **terminal-zero** bar for both: terminal dead-letters/holes = 0 at burst level; the ~2–4% is a **per-attempt** floor absorbed by the 4-attempt budget before terminal; isolated-5xx tolerance applies only to an already-armed window's disarm decision, never to burst/PASS-LOAD admission

Applied to any future H smoke: the burst-level terminal-hole count must be **0**. The per-attempt transient floor and the isolated-5xx disarm tolerance never apply to a burst/PASS-LOAD admission decision for H.

### Today's precondition status deltas (2026-06-10, recorded on #552 unless noted)

E#7 condition (a) and part of (c) have moved since 2026-06-03; (b) and the rest of (c) remain open:

- **E#7 (a) non-H PASS-LOAD — SATISFIED.** Two consecutive independent N=56 drills met the canonical bar (0 terminal dead-letters at N=56), i.e. PASS-LOAD **and** PASS-LOAD-CONFIRM, audited at `docs/audits/ARCH-001-CARD3-SMOKE-2026-06-10-PASS-LOAD.md:12` ("PASS-LOAD and PASS-LOAD-CONFIRM both met ... 0 terminal dead-letters at N=56, twice consecutively"). A–G only; H/I/J stayed frozen.
- **#523 stale-H-rows cleanup — COMPLETE.** The historical leakage tripwire moved 7 → 0 (recorded on #523; issue closed). At the 2026-06-10 PASS-LOAD smoke the 7 historical `claim_clarity` rows (all 2026-06-01 01:20–01:24 UTC) were byte-identical before and after (`docs/audits/ARCH-001-CARD3-SMOKE-2026-06-10-PASS-LOAD.md:19`), confirming the tripwire is a true producer-bug detector; the cleanup followed. Lane B (`MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` Template B) is therefore resolved — it MUST precede the H flip, and it now does.
- **Queue routing — armed at Organic 1%, but P1 still PENDING.** Routing is armed at 1%, but real-organic Stage-1 evidence has not accrued: the window closed at `PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME` (0 organic routed cells). **INSUFFICIENT-ORGANIC-VOLUME does NOT satisfy P1** (cutover-gate `:24`, `:104`; roadmap P1 `:126-127`). The H flip's organic precondition is unmet.
- **E#7 (b) separate operator decision — OPEN.** No operator decision to re-attempt the H flip has been made; this card is the GATE-A input that would precede such a decision.
- **E#7 (c) provider/server reliability at the 8-family load + clean Card-3 re-run smoke — PARTIALLY OPEN.** The non-H PASS-LOAD/CONFIRM proves A–G (7-family) reliability on the new substrate; reliability at the **8-family** load (A–H) under the H path is exactly what §4 Stage 4 is designed to measure and has not yet been demonstrated.

**Net:** of E#7's three conditions, (a) is satisfied and (c) is half-satisfied (7-family proven; 8-family unproven; organic P1 pending); (b) is open. H remains correctly FROZEN.

---

## 6. The §7 HARD RULE (verbatim)

From `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md:198`, this card binds itself to the H-I-J roadmap §7 HARD RULE:

> No file in this card enables any family.

The full §7 rule (`:198-202`) also binds: no doc/audit/roadmap auto-advances a family to production; the percentage dial and the family dial are separate; one family at a time (H before I; J not at all under current disposition); failure rolls back.

---

## 7. Non-scope (what this card explicitly does NOT do)

- Does NOT flip `productionEnabled` on `claim_clarity` (or any family) in `familyRegistry.ts`.
- Does NOT add or modify a `claim_clarity` entry in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (`booleanObservationRequestBuilder.ts`) — H is uniform `ai_classifier`; adding one is a HALT-13 defect.
- Does NOT change `src/lib/constitution/engine.ts` (sacred per cdiscourse-doctrine §5).
- Does NOT lower, loosen, or reclassify any guard, threshold, or the terminal-zero bar (§4-T forbidden).
- Does NOT advance the 5% / ramp / routing percentage (the percentage dial and the family dial are separate; H also gates on the P1 organic Stage-1 precondition, which is unmet).
- Does NOT execute the §4 reproduction plan — the plan is delivered as a doc, executed in a later operator-gated card.
- Does NOT touch `supabase/functions/**`, `supabase/migrations/**`, `src/**`, `mcp-server/**`, or `scripts/**`.
- Does NOT change `submit-argument` semantics, soft-delete behavior, or RLS posture.
- Does NOT propose any Family J work (J is dormant by design; `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` N=0).
- Does NOT propose making H output authoritative or gating submit on it (cdiscourse-doctrine §4; the classifier is advisory, `authoritative: false`).

---

## 8. Data model

No new data model. This card writes one design doc and makes one targeted edit to `docs/core/known-blockers.md`. The reproduction plan reads the existing `argument_machine_observation_runs` / `argument_machine_observation_results` tables (read-only); it defines no new columns, tables, or types.

---

## 9. File changes

- **New:** `docs/designs/MCP-H-001-FAMILY-H-CLAIM-CLARITY-RETRY-SCOPING.md` — this scoping doc + reproduction plan (~310 lines).
- **Modified:** `docs/core/known-blockers.md` — §ACTIVE BLOCKERS #2 (the Family H / I / J FROZEN entry) gains a one-sentence pointer to this scoping card as the path-to-retry. No other line changes; the FROZEN posture is unchanged.

Diff is exactly these two files. No code under `supabase/**`, `src/**`, `mcp-server/**`, or `scripts/**`.

---

## 10. Test plan

This card is **DOC-ONLY**. Expected test count delta: **0 tests added, 0 suites added** (baseline holds at 1805 tests / 70 suites per CLAUDE.md "Current stage").

- `npm run test` — must still PASS at baseline (no regression).
- `npm run typecheck` — must still PASS.
- `npm run lint` — must still PASS (no scratch `.ts` files; scratch uses `.txt` per MEMORY note "eslint scans .claude-tmp .ts scratch").
- `node scripts/ops/audit-lint.mjs docs/designs/MCP-H-001-FAMILY-H-CLAIM-CLARITY-RETRY-SCOPING.md` — must report 0 findings (this doc's audit-type resolves to `unknown`, so L1–L4/L6 do not apply; the doctrine-risk L5 path is satisfied by the persisted `evidence_span` inspection language in §4 Stage 3).
- Ban-list scan: 0 occurrences of the 10 banned verdict tokens per cdiscourse-doctrine §1.

Existing coverage that protects the H posture during this scoping (no edits needed here): `__tests__/booleanObservationFamilyRegistry.test.ts` (H `productionEnabled: false`), `__tests__/booleanObservationRequestBuilder.test.ts` (H uniform-source / no subset entry), `__tests__/auditLintRules.test.ts` (Card-2 L5 `family_h`). The eventual downstream fix/flip card (MCP-H-002) will add its own `edgeFamilyHProductionEnable.test.ts` and a 9-phase smoke template (`MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` Template C C2/C3).

---

## 11. Dependencies (cards / docs / files)

- Assumes **MCP-SERVER-009-FAMILY-H** (Card 1, PR #400) is shipped — it provides the admin_validation server module the reproduction plan exercises at Stages 1–2. No edit.
- Assumes **OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK** (Card 2, PR #403/#404) is shipped — its L5 mechanization (`scripts/ops/audit-lint-rules.cjs:79-91`) guards the H key posture during scoping. No edit.
- Reads **OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION** (operator-ratified 2026-06-03) for E#7 (`:78`/`:100`/`:104`) and E#11 (`:82`).
- Cross-references **PHASE7-OBSERVATION-001** / `scripts/corpus-30-phase-7-sql/` for the Stage 3 read-only SQL pattern (COALESCE on `family`).
- Mirrors the read-only-doc shape of **OPS-FAMILY-J-SCOPING-AUDIT** (closed #398 / PR #406).
- Sits at **Lane C, Phase C0** of `docs/designs/MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` (`:238`, `:331`).
- **Blocks / unblocks:** GATE A on this card is a precondition for **MCP-H-002** (the eventual H production-flip re-attempt), which additionally requires the E#7 conjunction and the resolution of whichever cause the §4 plan isolates.

---

## 12. Risks

- **Reading this card as authorization.** The single largest risk. Mitigated by §0, §6, §7, and the §5 §4-T statement: this card authorizes nothing and the §7 verbatim sentence is binding.
- **Per-key attribution temptation.** The FAIL audit did not isolate a Family H key; this designer does not invent one. Anyone consuming this doc must treat per-key isolation as MISSING until the §4 plan produces it.
- **Field-name drift in the eventual implement card.** The persisted-row schema uses `family` on `_results` but relies on `COALESCE(family, requested_families[1])` on `_runs` for DIRECT-DISPATCH rows (corpus-30 README `:41`). The Stage 3 SQL author must honor this or the family filter silently under-counts.
- **Substrate has changed since PR #407.** The 2026-06-10 PASS-LOAD/CONFIRM ran on the post-ARCH-001 cutover substrate (cron drain-tick, bounded concurrency). Any reproduction must run against the current substrate, not the 2026-06-01 one, or it measures the wrong system.
- **Line-number drift.** All citations were re-derived against the working tree at this card's authoring; a reviewer should re-verify before relying on a specific `:NN`.

---

## 13. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels).** Family H keys are structural Observations about claim formulation-state (e.g. is a conclusion stated, is the claim broadly or narrowly scoped) — never a verdict on the person or on a claim's correctness. This doc preserves that framing in every reference and lists none of the 10 banned verdict tokens per cdiscourse-doctrine §1. Respected.
- **cdiscourse-doctrine §4 (AI advisory-only).** The doc proposes no change making H output authoritative and no submit-gating on H. The classifier stays advisory (`authoritative: false`). Respected.
- **cdiscourse-doctrine §5 (engine sacred).** No change to `src/lib/constitution/engine.ts` proposed. Respected.
- **cdiscourse-doctrine §7 (no AI from production app).** H runs in the hosted MCP server / Edge path only; the doc proposes no client-side classifier logic. Respected.
- **cdiscourse-doctrine §8 (RLS / soft-delete / append-only migrations).** Doc-only; reads tables read-only; proposes no RLS change, no migration, no row deletion. Respected.
- **cdiscourse-doctrine §9 (plain language).** The failure-layer taxonomy is internal scoping vocabulary living in `docs/designs/**`; it introduces no new internal code to a user-facing surface, so no `gameCopy.toPlainLanguage` entry is required by this card. Respected.
- **cdiscourse-doctrine §10a (Observations vs Allegations).** H is a machine-source Observation family and is NOT sensitive (J is). The doc proposes no surfacing of an H Observation on a target's node that could read as an accusation. Respected.
- **Cutover-gate §4-T (no bar lowered).** The doc encodes E#7 and E#11 verbatim at their tightened bar and explicitly forbids reading itself as a relaxation. Respected.

---

## 14. Operator steps (if any)

None for this card — it is a pure docs change (the design doc + the targeted known-blockers edit). Nothing to deploy, migrate, or arm.

The reproduction plan's stages, when a later card executes them, are operator-run and read-only (a hosted MCP smoke token, a read-only admin SELECT role for the SQL stages, and the `.env.bot-tests` bot session for the Stage 4 admin_validation burst). None of those is performed in this card.

---

## 15. GATE A

This card ends at GATE A. The operator approves the design (and may elect manual gate vs auto-merge of the docs-only PR). No IMPLEMENT / GATE B / REVIEW / GATE C phase exists for this card; downstream re-attempt cards (MCP-H-002 and the cause-specific fix card the §3 matrix names) are spawned only after GATE A approval AND the E#7 conjunction clears.
