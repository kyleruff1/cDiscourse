# MCP-021C-EDGE-FAMILY-I-PRODUCTION-ENABLE — D1 design / runbook

Audit-type: design
Family: thread_topology

**Status:** Design draft (D1 / GATE-A). DOCS-ONLY. This document authorizes no advancement.
**Epic:** Epic 12 / MCP semantic-referee cutover. Lane D (`MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` §6.2 / §7 Template D).
**Release:** Family I production-enable RUNBOOK — not a fresh classifier build.
**Implementation issue:** #394 (`MCP-021C-EDGE-FAMILY-I-ENABLE` — production-mode flip for `thread_topology`; Tier-3; OPEN, stays open after D1).
**Supersedes:** #478 (`MCP-I-SCOPE-001`) — the scoping-confirmation artifact `docs/designs/MCP-I-SCOPE-001.md` ships bundled with this doc and **Closes #478 on merge**.
**Verified-at-HEAD:** `main` = `67f86d3`. Every `file:line` below was re-read at this HEAD.

---

## 0. HARD RULE (verbatim) and acceptance-gate invariant

> No section of this document enables any family, arms routing, raises a routing percentage, flips a `productionEnabled` flag, deploys, or spends provider budget. A "complete design row" is NOT a gate-pass. Advancement is operator-gated (Tier-3 never-self-approve) per `docs/core/pipeline-governance-contract.md` and `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`. One family at a time. Failure rolls back. This document forbids itself as an advancement authorization.

**Per the #478 acceptance criteria, carried verbatim and binding on this design and every card it describes:**

> not authorized to flip productionEnabled in this card or any subsequent card without explicit operator-named authorization.

**Constitutional acceptance-gate invariant (binding on every card this doc names):** the deterministic rules engine, `src/lib/constitution/engine.ts`, is the SOLE submission acceptance gate. Every MCP / classifier / queue / observation path is post-storage, advisory, display-only. No classifier path may block, reject, route, or delay an ordinary user post; `submit-argument` returns 201 before the dispatch fork (`classifierQueueRouting.ts` strict `=== 'true'` master flag + fail-closed percentage).

---

## 1. Status and scope

D1 is **design-only** and ends at GATE-A. It produces exactly two committed files — this runbook and the bundled `docs/designs/MCP-I-SCOPE-001.md` — and nothing else.

- **#394** is the implementation issue (the D2 flip). It **remains OPEN** after D1 merges; D1 does not execute it.
- **#478** is satisfied **literally** by the bundled `MCP-I-SCOPE-001.md`; this PR **Closes #478 on merge**.
- This card performs **no** registry flip, **no** Edge/Deno deploy, **no** provider spend, **no** migration, **no** routing change. The `thread_topology` registry entry stays `productionEnabled: false` (`familyRegistry.ts:111`) at the end of D1.

What this runbook delivers downstream readers: the exact D2 implementation scope, the D2 proof obligations, the D3 post-merge smoke plan, the D4 observation-window plan, and the rollback lever — so a fresh implementer can execute D2 without re-deriving any of it, once (and only once) the operator authorizes by name.

---

## 2. Authority and preconditions

### 2.1 The two operator-recorded preconditions (cited)

- **#552 Lane C / C4 — Family H accelerated observation closeout: PASS / NO ORGANIC VOLUME (2026-06-10).** H remains production-enabled (A–H roster). Window evidence since the flip: 3 terminal holes across 184 production cells (~1.6%), all `mcp_api_error`, all on the direct-dispatch path, dispersed across three sibling families — the path-level provider-transient class, a typed finding, NOT a rollback trigger. No H-specific cluster (H sample success 8/8, ≥ every sibling). 0 doctrine/secret hits across 426 + 143 scanned result rows. 0 I/J production rows. #523 (stale H rows) is CLOSED (7→0).
- **#394 Lane D / D0 — H-STABLE PRECONDITION CLEARED (operator-confirmed, accelerated standard, 2026-06-10).** Template D0 (`MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` §7) requires "H stable in production, its window clean (Lane C); `#394_BLOCKED_BY_H-not-stable` cleared." The operator cleared it per the accelerated-closeout standard at main `67f86d3`. D0 also re-verified the D-lane structural pre-checks: the subset entry is present (#550) and STAYS; the I server is Deno-live at admin_validation (#546); `family_i` L5 audit-lint entries are present (#549); `edgeFamilyIProductionEnable.test.ts` does not yet exist (D2 creates it).

### 2.2 Honesty caveat (carried forward verbatim-spirit — binding)

H-stability evidence is **operator-seeded / NO ORGANIC VOLUME** over a roughly two-hour window — it is **NOT** a 24-hour organic PASS. The `#394_BLOCKED_BY_H-not-stable` blocker is cleared **under the operator's trudge-forward H-stability standard**, not under an organic-volume standard. P1 (real-organic Stage-1 evidence) remains **separately PENDING** and is NOT claimed here. Clearing this blocker authorizes the I **design** (D1) and makes the I **flip** (D2) *evaluable* under separate operator authorization; it does **NOT** auto-authorize any queue-routing percentage ramp, which is a separate operator-card-gated step (§10).

---

## 3. Family I build state (what is already shipped — do not rebuild)

Family I is a **mixed-source** family: 21 taxonomy keys split **8 `auto_metadata` + 7 `lifecycle` + 6 `ai_classifier`** (`mcp-server/lib/familyIKeys.ts:14-24`; src taxonomy `src/features/nodeLabels/machineObservationDefinitions/familyI.ts:4-20`).

| Shipped artifact | Where | State |
|---|---|---|
| I MCP-server classifier (6 `ai_classifier` keys) | `mcp-server/lib/familyIKeys.ts:92-99`; classifier-set version `family-i-v1` (`:138`) | Deno-live admin_validation (#546); hosted smoke 25/25, checks 24/25 `family-i-v1` |
| `family_i` L5 audit-lint doctrine-risk mechanization | `scripts/ops/audit-lint-rules.cjs:92-108` (`thread_topology` / `family_i` / `compares_options`) | Shipped (#549) |
| Edge mixed-source subset bridge | `booleanObservationRequestBuilder.ts:82-88` — `thread_topology: Object.freeze(new Set(['ai_classifier']))` | Shipped (#550) — **STAYS exactly as shipped** |

**The six `ai_classifier` keys (re-derived from `mcp-server/lib/familyIKeys.ts:92-99`, declaration order):**

1. `introduces_new_issue` (`:93`)
2. `references_prior_agreement` (`:94`)
3. `introduces_sub_axis` (`:95`)
4. `returns_to_prior_issue` (`:96`)
5. `references_external_context` (`:97`)
6. `compares_options` (`:98`)

**The 15 deterministic keys that are NEVER sent to the hosted MCP** (`familyIKeys.ts:117-135`): 8 `auto_metadata` (`has_reply`, `participant_skipped_node`, `no_response_after_n_turns`, `repeated_axis_pressure`, `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node`) + 7 `lifecycle` (`open`, `answered`, `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`, `ignored_by_negative`, `ignored_by_both`). These are deterministically derived from argument-tree structure / cluster-temporal state via NON-MCP paths.

### 3.1 Why the subset entry is mandatory and STAYS (the mixed-source live-only trap)

The Edge request builder drops any rawKey whose `source` is not in the family's allowlist (`booleanObservationRequestBuilder.ts:158-159`). The `thread_topology` allowlist of `{'ai_classifier'}` automatically selects exactly the 6 `ai_classifier` keys — no explicit key list needed (`MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET.md` §"The fix"). Absence of this entry means **full registry passthrough** → the Edge would send all 21 keys → the hosted MCP rejects the 15 deterministic keys with `unsupported_rawKey` → the Edge maps that to `mcp_validation_failed` for every I request. This is the documented mixed-source live-only failure class (Families D, G, I) — it passes Deno/Jest but fails hosted smoke. The subset entry is the fix and **removing it (or widening it) is the HALT-13-inverse defect for I**.

---

## 4. D2 implementation scope (the future flip card — under separate operator authorization)

D2 is a **surgical one-boolean flip + test re-baselines**, mirroring the shipped H pattern (`__tests__/edgeFamilyHProductionEnable.test.ts`) with the mixed-source inverse (the GGE-pattern subset assertions, not the uniform HHE/FFE pattern).

### 4.1 D2 MAY change ONLY

- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — the single boolean `thread_topology` `productionEnabled: false` → `productionEnabled: true` (`:111`). `adminValidationEnabled: true` (`:112`) is unchanged. (~1 line.)
- **Roster re-baseline tests A–H → A–I (NINE).** Existing sibling production-enable suites assert the roster count/order. The H flip moved them SEVEN→EIGHT; D2 moves them EIGHT→NINE. Re-baseline the count/order assertions in the existing `edgeFamily{D,E,F,G,H}ProductionEnable.test.ts` suites that assert `edgeProductionEnabledFamilies()` length/order.
- **NEW `__tests__/edgeFamilyIProductionEnable.test.ts`** — the I-specific binding (≈19 tests; §5). Mirrors the H file structure with the mixed-source subset inverse.
- **Stale-test updates from I joining the production roster — HUNT count-drift beyond the obvious set (MCP-H-002 / PR #559 lesson).** QUANTIFIED EXPECTATION: the H flip (PR #559, `580f197`) touched **15 test files** for a one-boolean registry change — the 5 sibling enable suites, 6 registry/dispatcher/admin-mode suites, the burst-concurrency proof, and two `__tests__/docs/` ledger doc-guards that only FULL Jest surfaced. Plan for a similar 12-15+ test-file footprint here. **Running FULL Jest (`npx jest --maxWorkers=4`, the whole tree, not selected suites) is a REQUIRED D2 step, not advice** — selective runs will miss doc-guard and cross-card count assertions and produce a masked-red branch. Named candidates to verify (re-baseline ONLY if they assert a roster-derived count):
  - `__tests__/archOneCardThreeBurstConcurrency.test.ts` — burst-cell family math (8→9 families per arg). H re-baselined it 7→8; I re-baselines 8→9 with the `C=3` concurrency pin preserved.
  - readiness-ledger / roster doc-guard tests, if any assert the frozen non-production set `{I,J}` → `{J}`.
  - admin tripwire constants **only if a test asserts them at D2 time** — see §4.3 (the client/admin re-scope is a separate follow-up, not D2's job).
- `docs/core/current-status.md` + the D3 production-enable smoke audit doc.
- The D3 smoke template `docs/audits/MCP-021C-EDGE-FAMILY-I-ENABLE-SMOKE-template.md` if absent.

### 4.2 D2 MUST NOT change

`mcp-server/**` (the I server is already live); `familyIKeys.ts` / the I prompt entries; `booleanObservationRequestBuilder.ts` (tests may **only ASSERT** the subset entry stays — never edit it); any migration; `src/lib/constitution/engine.ts`; the `submit-argument` routing / acceptance path; the queue-routing percentage; provider config; H or J registry state; schema versions; the observation definitions (`machineObservationDefinitions/familyI.ts`); the anti-amplification / point-standing modules; **client render behavior**.

### 4.3 The client/admin re-scope is explicitly NOT D2 (decoupling, mirrors H)

Flipping I to production at the **Edge** does NOT, by itself, surface I observations on the **client**. Two src-side mirrors gate I off production user surfaces independently of the Edge registry:

- `src/features/arguments/detail/argumentDetailModel.ts:669-670` — `HUB_NON_PRODUCTION_FAMILIES` lists `thread_topology`; the hub family-allow-list gate (`:756-760`) keeps I chips off the production hub even if per-entry dispositions are `rendered_now`. The verdict-free heading `'How the thread is shaped'` (`:706`) is pre-authored but dormant.
- `src/features/adminClassifierHealth/classifierHealthModel.ts:36-40` — `FROZEN_NON_PRODUCTION_FAMILIES` lists `thread_topology`.

The H closeout recorded the H analog ("re-scope the admin-health tripwire from `{H,I,J}` to `{I,J}`") as a **separate follow-up card, not part of the flip**. D2 follows that precedent: the I re-scope (`{I,J}` → `{J}`) of these client/admin mirrors is a **separate follow-up card**, surfaced here as an operator decision (§Operator steps). Keeping it out of D2 is what holds the "client render behavior unchanged" guarantee in D2 and lets D4 verify "0 I rows on the client surface" while I rides the Edge production path.

---

## 5. D2 expected tests (proof obligations for `edgeFamilyIProductionEnable.test.ts`)

The new binding must assert (mirroring `edgeFamilyHProductionEnable.test.ts:67-249`, with the mixed-source subset inverse):

1. `thread_topology` entry `productionEnabled === true` AND `adminValidationEnabled === true` (admin posture unchanged across the flip).
2. `edgeProductionEnabledFamilies()` includes `thread_topology`, has **length 9**, and equals the registry-derived order `A→I` (`parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress, claim_clarity, thread_topology`) — derived from the actual registry order, not a hard-coded list.
3. `thread_topology` occupies index **8** in `EDGE_FAMILY_REGISTRY`; A–H order preserved.
4. **J non-production:** `sensitive_composer` `productionEnabled === false` (no widening past I).
5. **H stays production-enabled:** `claim_clarity` `productionEnabled === true` (the live-verified post-MCP-H-002 state); A–G also stay `true` (drift guard).
6. **Subset entry PRESENT (inverse of H's HHE-17):** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` HAS a `thread_topology` entry equal to `{'ai_classifier'}` — assert via the test-only export `getMcpServerSupportedFamilySources` (`booleanObservationRequestBuilder.ts:96-100`) and/or a read of the constant block; the test ASSERTS presence, never edits the builder.
7. **Production-mode I request emits exactly the 6 `ai_classifier` keys:** `edgeBuildBooleanObservationRequestForArgument({ requestedFamilies: ['thread_topology'], mode: 'production' })` returns `requestedRawKeys.length === 6`, and the set equals the six keys in §3; byte-equal (sorted) to the `admin_validation`-mode request (the subset filter applies in both modes).
8. **No deterministic I key reaches the hosted MCP:** none of the 15 keys in §3 appears in the production request's `requestedRawKeys`.
9. Implied-by-construction (assert as contract, exercised live in D3): no `unsupported_rawKey`; no `mcp_validation_failed`; no migration; no `mcp-server/**` change; no `productionEnabled` drift outside I.
10. **Acceptance-gate invariant:** a test (or an existing one re-confirmed) that no classifier path gates submission — `submit-argument` returns before the dispatch fork.

Test-count posture: net positive (≈ +15 to +25 per the intent forecast `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md:43,52`), minus any obsoleted assertion deltas. The implementer captures the exact `Test Suites: X / Tests: Y` line with an explicit exit code and runs **full Jest** (not just the obvious suites) per the MCP-H-002 count-drift lesson.

---

## 6. D3 post-merge smoke plan (GATE-MERGE → GATE-SPEND; operator-run, never auto-run)

### Phase 1 — GATE-MERGE (squash; Edge auto-deploy)

D2 squash-merges. The `booleanObservationRequestBuilder.ts` subset entry and `familyRegistry.ts` flip are Edge-bearing; the Supabase GitHub integration auto-redeploys the affected Edge Functions on merge to `main`. **Verify the function version bump** (e.g. `submit-argument` version readback, as the H closeout did v457→v461) BEFORE any smoke traffic. **No Deno redeploy is needed** — the I server is already live (#546) — UNLESS the Deno state is unexpectedly stale (re-run the hosted `family-i-v1` smoke if in doubt).

### Phase 2 — GATE-SPEND canary (operator-gated provider spend)

(a) Drive a smoke-tag queue canary via the production `submit-argument` path.
(b) Expect **A–I = 9 family cells per argument**, **no J cell**.
(c) `thread_topology` runs succeed; **no `mcp_validation_failed`**.
(d) Any I result rows appear **only** among the 6 `ai_classifier` keys (§3).
(e) The 15 deterministic I keys are **absent** from the MCP path.

### Phase 3 — GATE-SPEND targeted I-signal canary

(f) A second, targeted canary with text designed to elicit a positive on at least one I key — e.g. `compares_options`, `introduces_sub_axis`, or `references_external_context`.
(g) If no I positive fires: strengthen the fixture text **once**. If still none → record **PARTIAL, not PASS**, unless the operator explicitly accepts the transport proof (subset-filtered request shape well-formed, 0 errors) in lieu of a positive observation.

### Phase 4 — GATE-SPEND burst

(h) **N=8 burst** = 8 args × 9 families = **72 cells**. PASS bar = **0 terminal dead-letters** at N=72, submit nonblocking, dup=0, overlap=0, `family=NULL`=0, no single-family provider cluster (≥2 `provider_*` terminal failures concentrated on I without sibling dispersion). The operator may elect a **canary-only D3** (skip the burst) at their discretion; record which was run.

### Phase 5 — doctrine / leak scan and J-zero check

(i) Scan every I positive row's `evidence_span`, every `failure_*` field, every drain-audit row, and every log line: **0** banned verdict/author-label tokens; **0** secret shapes (`Bearer` / `sk-ant` / `sb_secret` / JWT / `service_role`); **0** raw bodies / `inactive_reason` / `inactive_by` leaked to a non-admin surface; **0** printed evidence spans (counted, never printed). Run the non-admin leak scan against a NON-admin role (the standing BOT_A-is-admin finding, `MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` §14).
(j) **J production rows remain 0.**

Record the verdict in `docs/audits/MCP-021C-EDGE-FAMILY-I-ENABLE-SMOKE-<date>.md` with the exact check counts and an explicit exit code.

---

## 7. D4 observation-window plan

### Phase 1 — window default

Open a nominal ≥24-hour observation window after the D3 smoke PASS (mirrors the H C4 cadence). Snapshot: I production runs since flip (success rate, failure typing via `failure_detail`); J = 0; queue non-terminal = 0; tick/monitor clean; doctrine scan on all new I `evidence_span` rows = 0 hits; 0 I rows on the client surface (the client mirror re-scope is deferred — §4.3).

### Phase 2 — accelerated option (with explicit caveat)

If organic volume is zero, the operator MAY authorize an accelerated closeout using controlled, operator-seeded ordinary production posts — **mirroring the H C4 NO ORGANIC VOLUME standard**. Any such closeout MUST carry the explicit caveat that it is NOT an organic PASS and that P1 real-organic Stage-1 evidence remains separately pending.

### Phase 3 — rollback triggers (any one → roll back)

- An **I-specific** provider/contract failure cluster (single-family ≥2 `provider_*` terminal failures concentrated on I, without sibling-family dispersion).
- A deterministic I key reaching the MCP path → `unsupported_rawKey`.
- An `mcp_validation_failed` cluster on I.
- Any doctrine / secret leak in an I row.
- **Any J production row** (J must stay 0).
- Any submission **blocked or delayed** by classification (acceptance-gate invariant breach).

### Phase 4 — rollback lever

Revert the one boolean: `thread_topology` `productionEnabled: true` → `false` (the #408 single-boolean revert pattern). This preserves the I server, the `family_i` L5 entries, the admin_validation posture, and the subset entry. Routing disarm (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`) is the orthogonal instant lever for the queue plane. The Edge/Deno/client/DB rollback planes are enumerated in `MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` §9.

---

## 8. #478 disposition

This PR **supersedes #478** via the bundled `docs/designs/MCP-I-SCOPE-001.md`, which satisfies #478's acceptance criteria literally (the four required answers + the verbatim authorization sentence). **Closes #478 on merge.** #394 remains OPEN — it is the implementation issue, untouched by D1.

---

## 9. #394 execution boundary

#394 stays OPEN after D1. The D2 flip is **Tier-3** (production-enable: the highest never-self-approve tier per the pipeline governance contract). It requires **explicit operator-named authorization** before any implementer begins. D1 neither performs nor pre-authorizes D2.

---

## 10. Lane-order recommendation

**D2 → D3 → D4.** Each step is operator-gated; D2 is Tier-3.

- **Family J is separate and later.** J is not server-built; the hosted server returns `unsupported_family`. Under the ratified N=0 disposition it has an admin-validation ceiling and never reaches production without a fresh §10a doctrine review (`MCP-HIJ-SCALEUP-IMPLEMENTATION-PLAN.md` §5.3 / Template E). J is out of scope for the I lane.
- **The queue-routing percentage ramp is separate and operator-card-gated.** I production-enable rides the existing direct-dispatch fan-out plus whatever percentage is already armed; raising the percentage is a distinct Tier-3 operator card requiring real-organic evidence (§2.2). The family dial and the percentage dial are separate (canonical HARD RULE).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels; score never blocks posting):** the flip is gameplay-routing, not a verdict on the family's quality; I observations are structural topology relations, never verdicts. No banned verdict/author-label token appears in this doc; the only `false`/`true` occurrences are the `productionEnabled` boolean flag value in backticks, not truth claims about a person or claim.
- **cdiscourse-doctrine §3 (popularity is not evidence):** the `references_external_context` key records the structural fact of an external reference and never grants factual standing from virality/engagement (`familyIKeys.ts:62-65,245-246`).
- **cdiscourse-doctrine §4 (AI moderator advisory-only):** I classifier outputs are post-storage, advisory; `engine.ts` remains the sole acceptance gate; the flip changes only which structural Observations the Edge requests.
- **cdiscourse-doctrine §5 (engine sacred):** no `engine.ts` change in D1 or D2.
- **cdiscourse-doctrine §6 (secrets):** no secret value appears; env names are referenced as shapes only.
- **cdiscourse-doctrine §7 (no AI from the production app):** the I classifier call lives in the Edge/Deno path; no client AI call; D2 changes a pure `_shared` boolean and tests only.
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change, no table touched; the flip is additive routing.
- **cdiscourse-doctrine §9 (plain-language mapping):** the user-facing I heading maps through the node-label registry (`'How the thread is shaped'`); no raw classifier ID reaches a user string.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** I keys are machine Observations describing how a move relates to the conversation graph; the verdict-adjacent candidate `repeats_prior_point` was pruned upstream (`familyI.ts:28-30`). The doctrine/leak scan in D3 (`evidence_span` inspection) enforces this empirically.

---

## Operator steps

D1 is docs-only — no operator deploy step for D1 itself. The operator actions named (NOT executed) for the downstream lane are:

1. **Authorize D2 by name** (Tier-3) before any implementer begins the flip.
2. After D2 squash-merge: confirm the Supabase Edge auto-redeploy and the function version bump before D3 smoke traffic.
3. Run the D3 GATE-SPEND smoke (§6); record the audit verdict.
4. Run / authorize the D4 observation window (§7); decide default vs accelerated (with the NO ORGANIC VOLUME caveat if accelerated).
5. **Separate follow-up card:** the client/admin mirror re-scope (`HUB_NON_PRODUCTION_FAMILIES` and `FROZEN_NON_PRODUCTION_FAMILIES` `{I,J}` → `{J}`) — surface I on the client/admin-health surfaces only when the operator chooses, mirroring the deferred H tripwire re-scope.
6. **Separate operator card (later):** any queue-routing percentage ramp.
