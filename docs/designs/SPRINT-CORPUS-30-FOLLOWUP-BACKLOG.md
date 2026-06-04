# SPRINT — Post-CORPUS-30 Follow-up Backlog

**Status:** Design draft (issue pack — ready to spawn into individual cards via `.claude/scripts/spawn-card.ps1`).
**Author role:** roadmap-designer.
**Created:** 2026-06-04.
**Source request:** operator prompt of 2026-06-04 — "turn the CORPUS-30 result set, current admin UX pain, and MCP/H/I/J runway into actionable GitHub issues/cards." Operator-provided draft backlog is at the bottom of the source prompt; this doc is the formalized, fact-checked, governance-bound version.
**Governance:** this backlog runs under the *CDiscourse Pipeline Governance Contract v1* (`docs/core/pipeline-governance-contract.md`). The stage gates (§2), HALT conditions (§3), the never-self-approve list (§4), and the merge/deploy rules (§5) are binding on every card spawned from this doc.
**Authoring standard:** `cdiscourse-prompt-standard` skill (§1–§10). Where a card body and the governance contract or this skill conflict, the contract wins and the spawned agent surfaces the conflict.

---

## 0. Reality check (read before pulling any card)

Two material findings from the Phase-0 grounding pass change the original prompt's framing. Cards below have been redrawn around them.

### 0.1 The `CD - MCP Server` label/enable work has partially shipped, but the *full write path* still needs an audit + smoke

The user's proposed P0 card said "make `CD - MCP Server` selectable and remove greyed-out 'Coming later'". The headline label + enum change landed in **PR #460** (commit `d7aa3a5`, 2026-06-03):

- [src/features/admin/AdminSemanticRefereeTab.tsx:41](src/features/admin/AdminSemanticRefereeTab.tsx:41) — `SELECTABLE_MODES` includes `mcp`.
- [src/features/admin/AdminSemanticRefereeTab.tsx:273](src/features/admin/AdminSemanticRefereeTab.tsx:273) — explicit comment: `// mcp is now in SELECTABLE_MODES — no separate disabled row.`
- [supabase/functions/_shared/adminSemanticConfigSchemas.ts:37](supabase/functions/_shared/adminSemanticConfigSchemas.ts:37) — `SEMANTIC_PROVIDER_WRITE_MODES` includes `'mcp'`.
- `MODE_DESCRIPTIONS.mcp = "Operator-hosted MCP server adapter. Routes through the configured MCP URL + bearer."`

**But "rename the label" is not the whole card.** The full *admin write path* for `providerMode='mcp'` spans seven layers — the operator made this explicit in the 2026-06-04 follow-up:

1. **Label** rendered to the admin (`PROVIDER_MODE_LABELS.mcp`).
2. **Selectable row** in the UI (`SELECTABLE_MODES`, `accessibilityState.disabled=false`, no "Coming later").
3. **TypeScript API type** ([src/lib/edgeFunctions.ts](src/lib/edgeFunctions.ts) — `SemanticRefereeConfigView.providerMode` + `SetSemanticRefereeConfigInput.providerMode` must include `'mcp'`).
4. **Edge schema enum** ([adminSemanticConfigSchemas.ts](supabase/functions/_shared/adminSemanticConfigSchemas.ts) — `SEMANTIC_PROVIDER_WRITE_MODES` + the `.refine()` must allow `mcp` one-click).
5. **admin-users handler validation + doctrine comment** ([supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) — the `set_semantic_config` handler must persist `mcp` and the audit row must record it; a comment must explain why `mcp` is one-click while `anthropic` requires `confirmAnthropic: true`).
6. **Tests** asserting (a) every layer above is correct, (b) no MCP URL / bearer / hostname leaks to the client bundle, (c) no UI label reads "Coming later" / "MCP-018".
7. **End-to-end smoke** (admin flips to `mcp`; one subsequent referee call reaches the Deno-hosted MCP adapter; audit doc records PASS / PARTIAL / FAIL).

**Therefore:** the slot becomes **`ADMIN-MCP-001`** (the original code name) and is a full *audit-and-tighten* card. It enumerates all seven layers, audits each at HEAD, fixes the layers that are thin or missing, and finishes with the operator-run smoke.

**Merge-class branching is explicit in the card:** the audit phase is read-only. **If the tightening phase modifies anything under `supabase/functions/**`** (e.g., adds a doctrine comment to the admin-users handler, tightens the zod refine, or adds the `mcp` doctrine note that the Stage 6.2 ADMIN-AI-001 doc partially placeholders) — **the merge is deploy-like and operator-only per pipeline-governance-contract §5**. If the tightening lands only under `src/**` (typing or test files), autonomous green squash-merge is permitted under §5. The card body says this in plain text up front so the reviewer's GATE-C decision is mechanical.

### 0.2 The CORPUS-30 run report cited in the operator prompt is not committed

The operator prompt cites the run `corpus-prod-synthetic-20260603-1924-d49e04cd` (30 debates, 300 args, 420 Supabase writes, 23 Anthropic calls, yellow-tagged diversity). I searched the repo at HEAD `d7aa3a5`:

- `docs/testing-runs/` contains zero post-2026-05 files. The latest is `2026-05-23-engagement-epidemiology-synthetic.md`.
- The runTag string `corpus-prod-synthetic-20260603-1924-d49e04cd` (full or partial `d49e04cd`) appears only in design docs, the planner JS, the reviewer's notes, and a `__tests__/corpusPoolDrivenPlanner.runTag.test.ts` — never in a run report.
- `logs/` is empty (or gitignored entirely).
- `docs/core/current-status.md` has no entry tagged `2026-06-03` or `2026-06-04` for CORPUS-30 (verified by grep — only design-stage references).

**Implication:** any "analysis of the corpus run" card depends on first surfacing the runner's JSONL + markdown outputs into the repo. The corpus analysis cards below open with that step explicitly. If the operator has those outputs locally but not committed, the first sub-task is to commit them under `docs/testing-runs/2026-06-03-corpus-30-prod-synthetic.md` (markdown report) and (separately) under a gitignored `logs/engagement-intelligence/` path for the JSONL, then proceed.

### 0.3 Did the corpus light up the MCP server?

Short answer: **Yes — partially, via the auto-trigger path, for families A–G only. The queue path was NOT exercised, and H/I/J were not exercised.** This is structural reasoning from the wiring at HEAD; direct DB evidence requires a read-only SQL pass against `argument_machine_observation_runs` (Phase 7).

The reasoning chain:

| Path | Wired? | Exercised by CORPUS-30? | Evidence |
|---|---|---|---|
| `submit-argument` calls `dispatchAutoTriggerForArgument` on every accepted post | **Yes** | **Yes** (every one of the 300 posts) | `supabase/functions/submit-argument/index.ts:838` invokes it; `EdgeRuntime.waitUntil(autoTriggerPromise)` at :844 |
| `dispatchAutoTriggerForArgument` proxies into `classify-argument-boolean-observations` which uses `booleanObservationMcpAdapter` | **Yes** | **Yes**, for families A–G | `OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md` §3 — the proxy talks to the Deno-deployed MCP server at `https://cdiscourse-mcp-server.civildiscourse.deno.net/mcp/adapter-compat` |
| Families A–G `productionEnabled: true` | **Yes** | **Yes** | `familyRegistry.ts` per status doc §1 |
| Families H/I/J `productionEnabled: false` | **Yes** (gated off) | **No** | `familyRegistry.ts:106` (H), `:111` (I), `:116` (J); status doc §1 |
| Queue routing path (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true` + smoke-tag prefix `[arch-001-queue-smoke]` or % > 0) | **Yes** (off by default) | **No** | Status doc §2 says steady state is `_ENABLED=false` and `_PERCENTAGE=0`; corpus runTag prefix is `corpus-prod-synthetic-` — not the smoke-tag prefix — so even if `_ENABLED=true` were on, those debates would not route |

**What "lit up" really means here:** every accepted CORPUS-30 post should have caused one MCP request per A–G family (7 families × 300 args = up to 2,100 MCP calls, modulo concurrency caps and the bounded-parallel autotrigger). Each call resolves into a row in `argument_machine_observation_runs` with `family ∈ {A..G}` and `status ∈ {succeeded, failed_terminal, dead_letter, …}`. To turn this from *structural inference* into *measured evidence*, Phase 7 must execute the read-only SQL pack (see `CORPUS-30-PHASE7-OBSERVATION-001` below) scoped to the corpus debate set.

**What did NOT light up:**

- The classifier queue routing path — confirmed disarmed at HEAD per `next-prompts.md` ("PASS-STAGE-1-PLUMBING / INSUFFICIENT-ORGANIC-VOLUME with 0 organic routed args and routing disarmed to baseline").
- Family H (claim_clarity) — production retry remains gated on PASS-LOAD + named operator authorization.
- Family I (thread_topology) — scoping audit only; productionEnabled false.
- Family J (sensitive_composer) — scoping only; productionEnabled false.
- The semantic referee `mcp` provider mode — that's a different MCP entry point (the `semantic-referee` Edge Function reading config via `runtimeConfig.ts` and routing to the MCP adapter under `providerMode='mcp'`). Whether *that* path was exercised depends on whether the corpus runner asked any semantic-referee questions during the 300 posts; structurally, the runner generates moves with `aiMoveRenderer.js` (Anthropic-direct), not via `classifyMove`. The referee mode was not invoked by the corpus regardless of which provider was selected at the time. The `ADMIN-MCP-001` card below covers verifying the referee mode lights up MCP when an admin picks it.

---

## 1. Recommended sequencing

The structure follows the operator's recommendation, adjusted for the reality findings above. The phases are tight slices, not waterfall — each card runs the full design→implement→review pipeline before the next moves.

```
Phase 1 — Admin unblockers (P0; ship now, in order)
   1. ADMIN-MCP-001              — full write-path audit + smoke for `mcp` provider mode
                                    (audit-only path = autonomous merge; if tightening
                                    touches supabase/functions/** → merge = deploy)
   2. ADMIN-ARGS-CANONICAL-001   — canonical argument-artifact view model + dedupe across
                                    surfaces (view-model + navigation only; NOT visibility)
   3. ADMIN-ARGS-INACTIVE-001    — reversible "inactive" visibility state (migration + RLS
                                    + admin-users action + audit; doctrine: "fresh start
                                    = filtered view," never hard delete; orthogonal to #2)

Phase 2 — Corpus evidence consolidation (P1; gate Phase 3 on this)
   4. CORPUS-30-RUN-COMMIT-001   — commit the runner outputs that the operator referenced
   5. CORPUS-30-PHASE7-OBSERVATION-001 — author + run the A–G coverage SQL pack
   6. CORPUS-30-RESULTS-001      — analysis report + executive verdict

Phase 3 — Corpus quality follow-ups (P1; can run in parallel with each other)
   7. CORPUS-30-QUALITY-001      — fix fallback dominance + samey-move metric green-on-empty
   8. CORPUS-30-DIVERSITY-001    — voice + spine diversity tuning (per-room role identity)

Phase 4 — Admin usability sweep (P1; depends on Phase 1)
   9. ADMIN-ARGS-USABILITY-001   — density, columns, filters, row actions, runTag filter

Phase 5 — H/I/J runway (P2; ledger FIRST, then scoping; NO enablement, NO flip)
   10. MCP-HIJ-LEDGER-000        — readiness matrix; classifies each family's blockers
                                    (prompt / schema / validator / source-context / UI)
                                    → produces docs/designs/MCP-HIJ-READINESS-LEDGER.md.
                                    Cards 11-13 CANNOT START until this lands — without
                                    the per-family blocker classification, scoping cards
                                    overfit to the wrong axis and create gate debt.
   11. MCP-H-SCOPE-001           — Family H scoping design + smoke plan (no productionEnabled flip)
   12. MCP-I-SCOPE-001           — Family I scoping (thread topology — required input audit)
   13. MCP-J-SCOPE-001           — Family J scoping (sensitive composer — admin-only-observation question)

Phase 6 — Supporting infrastructure (P2; pulls in when slot opens)
   14. OPS-MCP-HEALTH-002        — admin classifier health panel (consumes failure_detail jsonb)
   15. CORPUS-30-REVIEW-001      — human review board of the 30 debates (UX feedback workflow)
```

**What ships now (no deploy, no migration, no operator gate beyond GATE-A/B/C):**

- `ADMIN-MCP-001` audit phase + the `src/**`-only tightening branch (read-only audit + client typing + tests + operator-run smoke)
- `ADMIN-ARGS-CANONICAL-001` (pure model + UI consumer changes, no DB; **explicitly does NOT change visibility — only how visible rows are grouped**)
- `CORPUS-30-RUN-COMMIT-001` (docs-only commit)
- `CORPUS-30-RESULTS-001` (docs-only)
- `CORPUS-30-QUALITY-001` (test/tooling-only)
- `CORPUS-30-DIVERSITY-001` (planner code change + tests; no DB)
- `ADMIN-ARGS-USABILITY-001` (UI-only)
- `MCP-HIJ-LEDGER-000` (docs-only)
- `MCP-H-SCOPE-001` / `MCP-I-SCOPE-001` / `MCP-J-SCOPE-001` (design-only docs)
- `CORPUS-30-REVIEW-001` (docs-only)

**What requires migration + Supabase deploy (merge = deploy; operator GATE-C required):**

- `ADMIN-MCP-001` **only if the tightening phase modifies `supabase/functions/**`** (e.g., adds a doctrine comment to the admin-users handler, tightens the zod refine). If the audit finds the Edge path complete and the only tightening lands in `src/**`, the card stays autonomous-merge.
- `ADMIN-ARGS-INACTIVE-001` (new migration, new admin-users action, RLS additive policy, `supabase/functions/**` touched; **doctrine: reversible visibility state with audit — never hard delete; "archive" / "delete" / "remove" / "clean slate" language is banned from the card body**)
- `CORPUS-30-PHASE7-OBSERVATION-001` only requires the operator to *run* the read-only SQL pack via the Supabase SQL Editor or `psql`; it does NOT modify schema, so its merge is docs/tooling-only.
- `OPS-MCP-HEALTH-002` (likely new Edge Function read-only endpoint + new admin tab; merge = deploy)

**What never lands inside this sprint** (frozen by §4 of the governance contract and explicit operator direction):

- H/I/J production enablement (any `familyRegistry.ts` `productionEnabled: false → true`).
- Any classifier-queue routing arm (`CLASSIFIER_QUEUE_ROUTING_ENABLED=true` or `_PERCENTAGE>0`).
- Any percentage-ramp advance (Stage 1 → 5% → ...).
- Any direct DB mutation by Claude (no service-role write, no mass delete, no edit of an applied migration).
- Any provider spend (Anthropic / xAI / X / live MCP smoke beyond the operator-authorized verify burst in card #1).

---

## 2. Cross-cutting boundary line (applies to every card below)

Every card spawned from this backlog carries the following boundary line under its Global Execution Contract, tailored per card. The tailoring is named in each card's "Governance & safety" block.

> **NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration apply. NO Edge Function deploy. NO MCP server deploy. NO classifier routing arm. NO `familyRegistry.ts` `productionEnabled` flip. NO direct insert into `public.arguments`. NO mass delete. NO `.env*` write. NO secret printed to chat, logs, audits, or PR bodies. NO edit of an applied migration. Provider spend (including the verify burst in ADMIN-MCP-001) is operator-run. Claude prepares the harness, the operator triggers it.**

Cards that need a narrow exception (e.g. ADMIN-ARGS-INACTIVE-001 may *write* a new migration file but never *apply* one) state the exception verbatim.

---

# Phase 1 — Admin unblockers (P0)

---

## Card ADMIN-MCP-001 — Full write-path audit for `CD - MCP Server` (seven layers) + end-to-end smoke

**Priority:** P0
**Status:** Proposed
**Epic:** Epic 12 — Rules UX / Admin Operations
**Estimate:** S–M (audit-only path = S; if tightening lands in `supabase/functions/**` it becomes M and merge = deploy)
**Slug:** `admin-mcp-write-path-audit-and-smoke`
**Branch on spawn:** `feat/ADMIN-MCP-001-admin-mcp-write-path-audit`

### Problem statement

The headline label work for `CD - MCP Server` shipped in PR #460 (commit `d7aa3a5`), but "rename the label" is not the whole card. The full *admin write path* for `providerMode='mcp'` is seven layers deep, and the operator's 2026-06-04 follow-up makes it explicit that the card must audit each one — not just the UI surface. Today the structural posture is "probably correct," because:

- The label + selectable row landed in the UI (`AdminSemanticRefereeTab.tsx`).
- The write enum landed on the Edge schema (`adminSemanticConfigSchemas.ts`).
- The handler that persists the config IS the `set_semantic_config` handler in `admin-users/index.ts`, and the audit table records the change.

But what has **not** been independently audited at HEAD `d7aa3a5` is:

- Whether [src/lib/edgeFunctions.ts](src/lib/edgeFunctions.ts)'s `SemanticRefereeConfigView.providerMode` and `SetSemanticRefereeConfigInput.providerMode` union types actually include `'mcp'` (the ADMIN-AI-001 design doc lines 392–404 specified `mock | fixture` *excluding* `mcp` on `SetSemanticRefereeConfigInput` — that may or may not have been updated by PR #460).
- Whether the admin-users handler has a doctrine comment explaining *why* `mcp` is one-click while `anthropic` requires `confirmAnthropic: true` (so a future maintainer doesn't break the one-click contract by mistake).
- Whether the handler's audit-row writes correctly record `previous_mode='anthropic'/new_mode='mcp'` in `semantic_referee_config_audit`.
- Whether the `semantic-referee` Edge Function's `providers.ts` actually has a working `mcp` branch in `classifyWithProvider` (not the stale `not_implemented` stub from MCP-016).
- Whether the operator-hosted MCP server is reachable end-to-end from a `providerMode='mcp'` admin flip — measured, not inferred.

This card is the **audit-and-tighten** card that closes those gaps. **It is NOT verify-only.** If the audit finds a layer is thin or missing the doctrine note, the card tightens it in the same branch. The merge-class then branches:

- **If every layer audits clean and the only changes land under `src/**`** (typing tightening, test additions, audit doc): autonomous green squash-merge per §5.
- **If any tightening lands under `supabase/functions/**`** (handler comment, refine-tightening, validator note): merge is **deploy-like — operator-only at GATE C per pipeline-governance-contract §4-B and §5**. The card body says this in plain text up front so the reviewer's decision is mechanical.

### User-visible outcome

After this card lands:

1. A committed audit doc `docs/audits/ADMIN-MCP-001-WRITE-PATH-AUDIT.md` (`Audit-Lint: v1`) enumerates each of the seven layers with `file:line` evidence at HEAD, a PASS / PARTIAL / FAIL verdict per layer, and the tightening (if any) applied.
2. If any `src/**` layer was thin, the tightening is committed (e.g., `SetSemanticRefereeConfigInput.providerMode` union widened to include `'mcp'`, new RN test asserting the `mcp` row mounts).
3. If any `supabase/functions/**` layer was thin, the tightening is committed AND the audit doc states "**merge = deploy; operator-only**" in its verdict line.
4. A committed smoke audit `docs/audits/ADMIN-MCP-001-SMOKE.md` (`Audit-Lint: v1`) records the end-to-end flip-and-classify with PASS / PARTIAL / FAIL.
5. Three pure-TS tests assert no MCP URL / bearer / hostname leaks from the client bundle.
6. `docs/core/current-status.md` records the audit verdict + smoke verdict.

### Scope (in) — the seven layers, audited in order

**Layer 1 — Label.** Confirm `PROVIDER_MODE_LABELS.mcp === 'CD - MCP Server'` in [semanticRefereeConfigApi.ts](src/features/admin/semanticRefereeConfigApi.ts). If wrong, fix the constant. (PR #460 set this; the audit confirms.)

**Layer 2 — Selectable row.** Confirm [AdminSemanticRefereeTab.tsx:41](src/features/admin/AdminSemanticRefereeTab.tsx:41) has `mcp` in `SELECTABLE_MODES` and that the rendered `Pressable` has `accessibilityState.disabled === false`. Confirm no rendered text in the tab contains `Coming later` or `MCP-018`. If a label or text is wrong, fix it.

**Layer 3 — TypeScript API type.** Read [src/lib/edgeFunctions.ts](src/lib/edgeFunctions.ts) and confirm both `SemanticRefereeConfigView.providerMode` AND `SetSemanticRefereeConfigInput.providerMode` are unions that include `'mcp'`. The ADMIN-AI-001 design doc (lines 392–404 of `docs/designs/ADMIN-AI-001.md`) originally defined `SetSemanticRefereeConfigInput.providerMode` as `'anthropic' | 'mock' | 'fixture'` *without* `mcp`. PR #460 likely widened it, but the card audits this directly — if the type is still narrow, widen it. **Merge class:** `src/**` → autonomous; nothing in `supabase/functions/**` is touched by this layer.

**Layer 4 — Edge schema enum.** Confirm [adminSemanticConfigSchemas.ts:37](supabase/functions/_shared/adminSemanticConfigSchemas.ts:37) has `'mcp'` in `SEMANTIC_PROVIDER_WRITE_MODES` AND that the `.refine()` at lines 59–65 does NOT require `confirmAnthropic` for `mcp` (only for `anthropic`). Confirm there is no hidden `if (providerMode === 'mcp') return 'reserved'` clause elsewhere in the schema file. If the schema is correct but the doctrine comment is missing (the original ADMIN-AI-001 file at lines 9–20 documents the mcp-is-one-click rule; confirm that comment block is still accurate post-#460), update the comment. **Merge class:** any edit here is `supabase/functions/**` → merge = deploy, operator-only at GATE C.

**Layer 5 — admin-users handler validation + doctrine comment.** Read the `handleSetSemanticConfig` function in [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) and confirm:
- The handler accepts `providerMode: 'mcp'` and persists it in the `semantic_referee_runtime_config` singleton row.
- The audit-row insert into `semantic_referee_config_audit` correctly records `previous_mode → new_mode` when either side is `mcp`.
- There is a one-paragraph doctrine comment near the handler explaining: (a) why `mcp` is one-click while `anthropic` requires `confirmAnthropic`, (b) that the `mcp` URL + bearer never leave the Edge Function side (the client never reads them), and (c) that `providerMode='mcp'` does NOT grant the packet truth authority — the packet schema is `.strict()` with `authoritative: z.literal(false)` regardless of provider.
If the doctrine comment is missing or stale, add it. **Merge class:** any edit here is `supabase/functions/**` → merge = deploy, operator-only.

**Layer 6 — Provider resolver / routing core.** Confirm [supabase/functions/_shared/semanticReferee/providers.ts](supabase/functions/_shared/semanticReferee/providers.ts) and [providerRoutingCore.ts](supabase/functions/_shared/semanticReferee/providerRoutingCore.ts) route a resolved `providerMode='mcp'` to the MCP adapter (not the stale `not_implemented` stub from MCP-016). Confirm [runtimeConfig.ts](supabase/functions/_shared/semanticReferee/runtimeConfig.ts)'s `resolveSemanticRefereeConfig` returns `{ source: 'db', providerMode: 'mcp', enabled: true }` cleanly when the row says `mcp`. **Merge class:** any edit here is `supabase/functions/**` → merge = deploy, operator-only.

**Layer 7 — Tests.** Add three pure-TS tests:
- `__tests__/adminMcpProviderClientLeakage.test.ts` — `fs.readdirSync` walks `src/**`, asserts no file body contains `SEMANTIC_REFEREE_MCP_URL`, `SEMANTIC_REFEREE_MCP_TOKEN`, `MCP_SERVER_BEARER_TOKEN`, the regex `/Bearer\s+[a-f0-9]{16,}/`, the substring `civildiscourse.deno.net`, or the path `/mcp/adapter-compat`. Edge Function files are excluded from the scan.
- `__tests__/adminSemanticRefereeTabMcpLabelling.test.tsx` — RN Testing Library; mounts the tab; asserts the `mcp` row mounts visible, selectable, not disabled, label is `CD - MCP Server`, NOT containing `Coming later` or `MCP-018`.
- `__tests__/adminMcpWritePathTypeUnion.test.ts` — TypeScript-level test that constructs `const _: SetSemanticRefereeConfigInput['providerMode'] = 'mcp'` (this fails to compile if the union doesn't include `'mcp'`; the test runs `tsc --noEmit` over a small fixture file).

**Operator-run smoke (after the audit lands):**

- `docs/audits/ADMIN-MCP-001-SMOKE.md` — `Audit-Lint: v1`, four phases: (1) pre-flight (HEAD assertion + each of the seven layers' audit verdicts must be PASS); (2) operator flips to `mcp` from the admin UI; Claude verifies via a read-only metadata SQL `select provider_mode from semantic_referee_runtime_config where id=true` (no token, no URL, no body); (3) operator triggers one semantic-referee classify call from an admin context; operator confirms a Deno Deploy log entry at `/mcp/adapter-compat` within 30s (operator views logs; Claude never sees the token); (4) verdict PASS / PARTIAL / FAIL.

### Scope (out — non-goals)

- Any change to the MCP server (`mcp-server/`).
- Any change to the semantic-referee Anthropic provider (MCP-017 territory).
- Any change to `submit-argument` or the auto-trigger path (CORPUS-30-PHASE7 covers that).
- Any change to the cost/rate-limit posture of the MCP server.
- A separate admin "test classify" button. The smoke uses the existing referee surface.
- Re-running PR #460's tests. They exist; this card audits the *path* they exercise.

### Files to inspect first

- [src/features/admin/AdminSemanticRefereeTab.tsx](src/features/admin/AdminSemanticRefereeTab.tsx)
- [src/features/admin/semanticRefereeConfigApi.ts](src/features/admin/semanticRefereeConfigApi.ts)
- [src/lib/edgeFunctions.ts](src/lib/edgeFunctions.ts)
- [supabase/functions/_shared/adminSemanticConfigSchemas.ts](supabase/functions/_shared/adminSemanticConfigSchemas.ts)
- [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) — `handleSetSemanticConfig`
- [supabase/functions/_shared/semanticReferee/providers.ts](supabase/functions/_shared/semanticReferee/providers.ts)
- [supabase/functions/_shared/semanticReferee/providerRoutingCore.ts](supabase/functions/_shared/semanticReferee/providerRoutingCore.ts)
- [supabase/functions/_shared/semanticReferee/runtimeConfig.ts](supabase/functions/_shared/semanticReferee/runtimeConfig.ts)
- [docs/designs/ADMIN-AI-001.md](docs/designs/ADMIN-AI-001.md) lines 392–404 (the original write-enum exclusion of `mcp`)
- [docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md](docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md) §3, §4

### Dependencies

- PR #460 in `main` (HEAD `d7aa3a5` confirms).
- Operator-hosted MCP server reachable at the configured URL (confirmed in production per status doc).
- Supabase secrets `SEMANTIC_REFEREE_MCP_URL` and `SEMANTIC_REFEREE_MCP_TOKEN` set on the linked project (operator verifies via `supabase secrets list` + SHA-256 digest comparison — value never printed).

### Blockers

- Operator has not set MCP secrets on the linked project. Surface; smoke FAILs with `unavailable / configuration_missing`; card carries follow-up "operator: set MCP secrets before re-running smoke."
- Layer 6 (provider resolver) routes `mcp` to the stale `not_implemented` stub. If so, this card cannot ship until the stub is replaced — that is a follow-up implementation card (`ADMIN-MCP-IMPL-002`), not in scope here. The audit records FAIL on Layer 6 and stops.

### Acceptance criteria

- [ ] `docs/audits/ADMIN-MCP-001-WRITE-PATH-AUDIT.md` exists with one row per layer + PASS/PARTIAL/FAIL + the tightening (if any) committed.
- [ ] Layer 7 tests (three of them) exist and pass.
- [ ] If Layers 4 / 5 / 6 needed tightening, the audit doc carries "**merge = deploy; operator-only at GATE C**" verbatim in its verdict line.
- [ ] `docs/audits/ADMIN-MCP-001-SMOKE.md` exists with the four phases pre-defined.
- [ ] After operator runs the smoke, the audit is updated with the verdict and one structural Deno Deploy log line (no token, no URL, no body).
- [ ] `docs/core/current-status.md` updated.
- [ ] Typecheck + lint clean.
- [ ] Test count delta forecast: +3 to +5 (more if tightening adds Edge tests).

### Test plan

See acceptance criteria. Coverage: every new test has a happy-path + a failure case. The leakage scan has a positive fixture (under `__tests__/__fixtures__/leakage-positive.ts.fixture`, never executed) that confirms the scan would catch a planted token if one existed.

### Governance & safety

- **Stage gates:** GATE A (design with the seven-layer audit plan) → GATE B (committed audit doc + tests + any tightening + smoke doc skeleton) → operator runs smoke → GATE C (review verdict + merge decision, branching on which layers were touched).
- **HALT triggers (card-specific):**
  - Any layer reads as a token / URL / bearer that Claude would have to see in cleartext. Never. The operator runs the smoke; Claude never reads the token.
  - The audit doc would contain the URL, token, request body, or Anthropic-key state.
  - Smoke result is FAIL: the audit records FAIL and stops; a follow-up card is created if needed.
  - Layer 6 finds the `mcp` branch routes to `not_implemented`. HALT — the card cannot ship; a follow-up implementation card is needed.
  - The seven-layer audit would require editing an applied migration (it should not — column-name confirmation is read-only). HALT if it does.
- **Never-self-approve (§4):** Claude never deploys, never sets secrets, never runs the verify burst (provider spend / MCP roundtrip), never edits an applied migration, never reads the token.
- **Merge = deploy?** **Conditional:**
  - If only Layers 1, 2, 3, 7 were touched (`src/**` only): **No.** Autonomous green squash-merge permitted under §5 once smoke is recorded.
  - If any of Layers 4, 5, 6 were touched (`supabase/functions/**`): **Yes — operator-only at GATE C per §4-B + §5.** The Supabase GitHub integration auto-redeploys Edge Functions on merge to `main`.
  - The audit doc's verdict line declares which branch applies. The reviewer's decision is then mechanical.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO MCP server source change (`mcp-server/`). NO package.json change. NO provider call. NO token displayed to Claude. NO direct insert into public.arguments. The verify smoke is operator-run. If the audit tightens anything under `supabase/functions/**`, the card states "merge = deploy" verbatim in its verdict; the operator decides the merge.*

---

## Card ADMIN-ARGS-CANONICAL-001 — Canonical Argument-Artifact view model + dedupe across every argument-list surface

**Priority:** P0
**Status:** Proposed
**Epic:** Admin Operations / Argument Surface Modeling
**Estimate:** L (pure-TS model + audit of every argument-list screen + UI consumer changes)
**Slug:** `argument-artifact-canonical-grouping`
**Branch on spawn:** `feat/ADMIN-ARGS-CANONICAL-001-argument-artifact-canonical-grouping`

### Problem statement

Operator pain (verbatim from the 2026-06-04 prompt): "many duplicate-looking argument rows show across screens. Need a consolidated single clickable artifact regardless of how many times the argument was updated or re-rendered." Currently every argument list surface — main user Arguments tab, Admin > Arguments, debate-timeline scrubber, gallery search results, sidecar timelines — renders one row per row, with no grouping. The CORPUS-30 run made this acute: 300 args spread across 30 debates inflate into many more rows when each argument's update/observation/qualifier metadata is also enumerated; the admin and the user both see "duplicate-looking" rows even when the underlying logical argument is one. This card builds a single canonical view-model that every argument-list surface consumes, so one logical argument = one clickable artifact with its update lineage nested inside.

Before the implementer writes code, **the designer must inspect the actual schema to decide the grouping key** — the operator prompt names a candidate order (canonical/origin/revision id if present → `argument_id` with update rows as children → derived fallback `debate_id + parent_id + user_id + normalized_body_hash`). The card structure encodes the spike-then-implement gate.

### Orthogonality with ADMIN-ARGS-INACTIVE-001 (read this first)

**This card is a view-model + navigation problem.** It changes how visible rows are *grouped* — it does NOT change which rows are visible. Whether a logical argument should be visible to a given user is a SEPARATE concern handled by **`ADMIN-ARGS-INACTIVE-001`** (visibility / RLS / audit).

The two cards are deliberately orthogonal because combining them would make the diff too large to review safely AND would obscure whether a row disappeared because (a) it was *grouped under an artifact* by this card, or (b) it was *marked inactive* by INACTIVE-001. The two failure modes have different fixes; conflating them costs reviewer time and produces gate debt.

Concrete interface between the two cards:

- This card defines `ArgumentArtifact.isInactive?: boolean` as a reserved field on the artifact, propagated from the underlying rows. The default is `false`.
- INACTIVE-001 fills in the value (via the `inactive_at` column on `public.arguments`) and adds the UI filter (`Show inactives` toggle).
- If this card ships first, the field is reserved and unused — every artifact has `isInactive: false` by default; no UI behavior changes.
- If INACTIVE-001 ships first, this card consumes the existing column when it lands.
- Neither card resurrects inactive children: the grouping invariant — "child revisions retain their `isInactive` state" — is asserted by `__tests__/argumentArtifactInactiveResilience.test.ts` (in this card's test pack; runs green either way because the test fixture supplies the field directly).

### User-visible outcome

After this card lands:

1. Every argument-list surface (named in §"Surface inventory" below) renders one row per logical argument, never per update/observation row.
2. Each artifact card displays: latest visible body excerpt, author, debate, latest update timestamp, an update/revision count badge (`3 updates`), classifier coverage count badge (`5/7 observations`), qualifier badges, and a "show update history" affordance.
3. Sorting uses the artifact's latest update timestamp; filtering/search matches the latest body + the nested update metadata.
4. No data is deleted, hidden, or rewritten by this card — pure presentation grouping.
5. Clicking an artifact routes to the canonical debate/argument anchor (same as today, but from the artifact id).

### Scope (in)

**Phase A — schema spike (the designer's first move; do this before drafting the view model):**
- Read [src/lib/types.ts](src/lib/types.ts) and the migrations under [supabase/migrations/](supabase/migrations/) to identify what the "update row" actually is. Hypotheses to falsify, in order:
  1. **Canonical id exists** — there is a `canonical_argument_id` or `origin_argument_id` column on `public.arguments` (unlikely from a quick scan, but verify).
  2. **One row per update** — `public.arguments` has `updated_at` separate from `created_at` and updates are tracked elsewhere (a sibling `argument_updates` table) — group by `argument_id`.
  3. **One row per observation** — the "duplicate-looking" rows are actually `argument_machine_observation_runs` rows that are being joined into the list query; the fix is to collapse on the join, not on the artifact.
  4. **UI join multiplication** — the duplicate-looking rows come from a left-join in [adminArgumentsApi.ts](src/features/admin/adminArgumentsApi.ts) that fans out one argument into N rows; the fix is in the query.
- Decide the grouping key and document it in `docs/designs/ADMIN-ARGS-CANONICAL-001.md` § "Grouping key — chosen approach". The choice is recorded with `file:line` evidence for each hypothesis falsified.

**Phase B — view model:**
- New pure-TS module `src/features/arguments/argumentArtifactModel.ts` exporting:
  - `ArgumentArtifact` (the grouped object: `artifactId`, `latestBody`, `authorId`, `debateId`, `latestUpdatedAt`, `createdAt`, `updateCount`, `observationCount`, `qualifiers`, `revisions: ArgumentRevision[]`).
  - `ArgumentRevision` (one entry per update row: `revisionId`, `body`, `updatedAt`).
  - `groupArgumentsIntoArtifacts(rows: ArgumentRow[]): ArgumentArtifact[]` — pure, deterministic, no I/O.
  - `sortArtifactsByLatestActivity(artifacts, direction): ArgumentArtifact[]`.
  - `filterArtifactsByQuery(artifacts, query): ArgumentArtifact[]` — matches latest body + revision bodies + qualifier labels.
- The model has no React import, no Supabase import, no `fetch`.

**Phase C — UI consumers (one screen at a time, in this order):**
- [src/features/admin/AdminArgumentsTab.tsx](src/features/admin/AdminArgumentsTab.tsx) — replace the `rows.map` with `groupArgumentsIntoArtifacts(rows)` and render artifact rows with the update-count badge + expand-history affordance.
- The main user Arguments tab — same change.
- The debate timeline scrubber (`ArgumentStackTimeline*` if applicable) — group; do not collapse the timeline itself, just the row list beneath it.
- The Conversation Gallery search/result screens that list arguments — confirm whether they already dedupe (per Stage 6.3 model) and either reuse the new model or document why the existing collapse is sufficient.
- The sidecar/label-timeline lists — same.

**Phase D — tests:**
- `__tests__/argumentArtifactModel.test.ts` — at least 12 cases covering: empty input; one row; two rows same `argument_id`; three rows same `argument_id` with non-monotonic `updated_at`; rows from two different `argument_id`s; rows with missing `updated_at`; rows with body excerpt longer than the display cap; sort stability; filter case sensitivity; deterministic output (same input → same output array); no child loss (`revisions.length` totals = input row count).
- `__tests__/argumentArtifactInactiveResilience.test.ts` — *prepares for `ADMIN-ARGS-INACTIVE-001`*: the model accepts an `isInactive?: boolean` field and (a) preserves it on the artifact when ANY revision is inactive, (b) does not resurrect inactive children when a sibling is active. This test exists so that when INACTIVE-001 lands, the grouping does not silently flip inactive rows back into the default view.
- `__tests__/AdminArgumentsTab.canonical.test.tsx` — 5 rows for the same `argument_id` render as one artifact with `3 updates` (or whatever the chosen count semantics say).

### Scope (out — non-goals)

- Any DB migration (this is pure-TS + UI; no schema change).
- Any data rewrite (no canonicalization of existing rows; the grouping is a presentation layer).
- The inactive-state workflow (separate card; INACTIVE-001).
- The usability sweep (separate card; ADMIN-ARGS-USABILITY-001).
- Any change to `submit-argument` or to how arguments are written. The card touches the *read path* only.
- Any change to the timeline visual itself.
- Routing/anchor changes beyond passing the new `artifactId` through the existing route — if the route key today is `argument_id`, the artifactId IS that id (because the chosen key is `argument_id` per hypothesis 2 — unless the spike says otherwise, in which case the designer states the route impact).

### Files to inspect first

- [src/features/admin/AdminArgumentsTab.tsx](src/features/admin/AdminArgumentsTab.tsx) — current row rendering.
- [src/features/admin/adminArgumentsApi.ts](src/features/admin/adminArgumentsApi.ts) — current load query + return shape.
- [src/features/admin/types.ts](src/features/admin/types.ts) — `AdminArgumentRow` shape (the inferred candidate key).
- [src/lib/types.ts](src/lib/types.ts) — domain `Argument` type.
- [supabase/migrations/20260516000001_initial_schema.sql](supabase/migrations/20260516000001_initial_schema.sql) — original arguments table.
- [supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql](supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql) — confirm the deletion-request lineage and how it relates to "update vs revision."
- [src/features/arguments/argumentGameSurfaceModel.ts](src/features/arguments/argumentGameSurfaceModel.ts) — existing collapse / lane model; may inform the artifact model.
- [src/features/debates/conversationGalleryModel.ts](src/features/debates/conversationGalleryModel.ts) — Stage 6.3 already dedupes `[xai-adv ...]` / `[ai-corpus ...]` / `[stress ...]` debate titles; that is a different layer (debate-level), but the pattern + tests are a reference.

### Dependencies

- None hard. The schema spike is internal to the card.
- Soft: ADMIN-ARGS-INACTIVE-001 will consume `ArgumentArtifact.isInactive`. The artifact model is designed to forward that field; INACTIVE-001's UI then filters on it. If INACTIVE-001 lands first, this card consumes the field from the artifact rows; if this card lands first, INACTIVE-001 adds the field and the artifact model already supports it.

### Blockers

- **Unknown schema lineage.** If the spike finds that "duplicate-looking" rows are coming from a UI-level join (hypothesis 4), the card may shrink dramatically — the fix is in `adminArgumentsApi.ts`'s `select(...)` clause, not in a new model. The designer states the choice and the implementer follows it; the card body must support both outcomes.
- **No reliable canonical key.** If neither a canonical id nor `argument_id` is sufficient (e.g., the duplicates are across user re-posts with different argument_ids), the spike falls through to the derived key, which adds a normalization step that requires its own test pack. The designer flags this in §"Grouping key" with a fallback estimate.

### Acceptance criteria

- [ ] `docs/designs/ADMIN-ARGS-CANONICAL-001.md` records the chosen grouping key with the four hypotheses falsified or accepted, each with `file:line` evidence.
- [ ] `src/features/arguments/argumentArtifactModel.ts` exists with `ArgumentArtifact`, `ArgumentRevision`, `groupArgumentsIntoArtifacts`, `sortArtifactsByLatestActivity`, `filterArtifactsByQuery` — pure-TS, no React/Supabase imports.
- [ ] The five UI surfaces listed in §"Phase C" all consume the artifact model, with one row per logical argument by default.
- [ ] An `isInactive` field on `ArgumentRevision` is plumbed through (default `false` if absent) — even though INACTIVE-001 has not landed yet, the field is reserved.
- [ ] Update-count + observation-count badges render plain text (`3 updates`, `5/7 observations`) — no truth/verdict tokens.
- [ ] `__tests__/argumentArtifactModel.test.ts` ≥ 12 cases; all green.
- [ ] `__tests__/argumentArtifactInactiveResilience.test.ts` ≥ 4 cases.
- [ ] `__tests__/AdminArgumentsTab.canonical.test.tsx` ≥ 3 cases (single-revision artifact; multi-revision artifact; mixed-debate filter).
- [ ] Existing Admin Arguments tests (`adminArgumentsTable*`, etc.) keep passing.
- [ ] Typecheck + lint clean.
- [ ] Test count delta forecast: +18 to +24 tests. Implementer captures the exact delta in `current-status.md`.

### Test plan

See acceptance criteria. In addition:

- **Determinism guard:** `groupArgumentsIntoArtifacts(rowsCopy)` returns the same array shape and ordering on every call given the same input — a property-style test runs the call N=10 times and asserts JSON-equality.
- **No-child-loss invariant:** `sum(artifact.revisions.length) === input.length` — asserted across every test case.
- **Doctrine ban-list scan:** `__tests__/argumentArtifactBanList.test.ts` — scans every user-facing string the artifact model and the new UI controls render (badge text, "Show update history" label, "Hide" label, etc.) for `winner|loser|won|lost|right|wrong|true|false|correct|incorrect|liar|dishonest|bad faith|manipulative|propagandist|extremist`. Zero matches.

### Governance & safety

- **Stage gates:** GATE A (design doc with the spike outcome) → GATE B (committed diff + all tests green + typecheck + lint) → GATE C (review + merge).
- **HALT triggers (card-specific):**
  - The schema spike contradicts the candidate-order hypotheses entirely (e.g., the "duplicates" come from a third unrelated source). The designer surfaces this; the card is re-scoped before the implementer starts.
  - Adopting the model would alter the route key for an existing argument deep-link in a way that breaks a saved link in the codebase. Surface; do not silently change the route.
  - A test that previously asserted "N rows for argument X" now needs to be relaxed. **Do not relax the test.** Either keep both shapes available via a flag, or surface the test as an operator decision (§4-A: never relax a failing guard to make a PR pass).
- **Never-self-approve (§4):** no DB write, no migration, no deploy. The PR may NOT auto-merge if a §4-A guard would need to relax — surface and stop.
- **Merge = deploy?** **No.** Pure client code + tests. Touches no `supabase/functions/**`, no migrations. Autonomous green squash-merge is permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO new dependency. NO direct insert into public.arguments. NO data rewrite. The change is pure read-path presentation grouping.*

---

## Card ADMIN-ARGS-INACTIVE-001 — Reversible "inactive" visibility state for whole arguments (admin-initiated; audited; never a hard delete)

**Priority:** P0
**Status:** Proposed
**Epic:** Admin Operations / Visibility
**Estimate:** L (migration + RLS additive policy + new admin-users action + UI + bulk action + audit)
**Slug:** `admin-argument-inactive-state`
**Branch on spawn:** `feat/ADMIN-ARGS-INACTIVE-001-admin-argument-inactive-state`

### Doctrine framing (read this before the problem statement)

The product primitive this card adds is **`inactive`** — a *reversible visibility state* with audit. It is NOT delete, NOT remove, NOT archive, NOT a clean slate. The operating doctrine, named by the operator, is **"fresh start = filtered view, not erasure."** Words like *delete / remove / clean slate / archive* are banned from every user-facing string, every admin label, every code comment, every test assertion, every commit message, and every doc body in this card and downstream. The columns are named `inactive_at` / `inactive_by` / `inactive_reason`. The admin-users actions are `set_argument_inactive` / `bulk_set_argument_inactive`. The UI labels are `Inactive` / `Show inactives` / `Mark inactive` / `Mark active`. The verb pairs are `inactive ↔ active`, never `delete ↔ restore`.

Why the framing matters: an "archive" connotes a one-way move and a separate storage tier; "delete" connotes data loss; "remove" connotes that the row is gone. None of those are true. The row stays in `public.arguments` exactly where it was, with the same primary key, the same author, the same body, the same `created_at`. What changes is *whether non-admin SELECT policies return it by default*. That is a visibility filter, full stop. Reversibility: flipping `inactive_at` back to `NULL` returns the row to default views in one operator action.

### Orthogonality with ADMIN-ARGS-CANONICAL-001

This card is a **visibility + RLS + audit problem**. It does NOT change how visible rows are grouped or displayed. How the surface presents multiple revisions of one logical argument is a SEPARATE concern handled by **`ADMIN-ARGS-CANONICAL-001`** (view-model + navigation).

The two cards are deliberately orthogonal because combining them would make the diff too large to review safely AND would obscure whether a row disappeared because (a) it was *grouped under an artifact* by CANONICAL-001, or (b) it was *marked inactive* by this card. The two failure modes have different fixes; conflating them costs reviewer time and produces gate debt.

Concrete interface between the two cards:

- CANONICAL-001 defines `ArgumentArtifact.isInactive?: boolean` as a reserved field on the artifact, default `false`.
- This card *fills in* that value (via the new `inactive_at` column on `public.arguments`) and adds the UI filter (`Show inactives` toggle).
- The grouping invariant from CANONICAL-001 — "child revisions retain their `isInactive` state; a sibling being active does not resurrect an inactive child" — is asserted by `__tests__/argumentArtifactInactiveResilience.test.ts` (already in CANONICAL-001; this card supplies the real data).

### Problem statement

Operator pain (verbatim): "Admin > Arguments needs a separate inactive/archive capability. Whole argument can be marked inactive by admin. Default views hide inactive arguments. Admin can toggle 'Show Inactives.' This is separate from grouping." Today the admin can soft-flag via the deletion-request workflow (`request-argument-deletion`, migration `20260517000008`), but that is *user-initiated* (the author requests deletion of their own argument, admin reviews). There is no *admin-initiated* "filter from default views" control — and reusing the deletion-request semantics would conflate user agency with admin moderation. The operator explicitly directed this be separate from the canonical-grouping card.

Note on the user's word "inactive/archive" in the original prompt: the doctrine framing above replaces "archive" with "inactive." The card body uses *inactive* consistently. The user's source prompt is paraphrased into the doctrine-aligned vocabulary throughout this card.

### User-visible outcome

After this card lands:

1. Admin > Arguments shows a per-row checkbox under a new "Inactive" column. Selecting one or more rows enables a "Mark inactive" / "Mark active" button at the top of the table.
2. Admin > Arguments has a top-level toggle `[ ] Show inactives` (default unchecked). When unchecked, inactive rows are hidden from the table. When checked, they appear with a dimmed style and a chip `Inactive`.
3. Every user-facing argument surface (main user Arguments tab, debate timeline, room lists, search, sidecar, label timeline, gallery cards) filters out inactive arguments by default. RLS enforces the same filter at the row level for non-admin callers; a direct URL to an inactive argument does not render its body for non-admins.
4. An audit row records actor, target argument id, previous state, new state, optional reason, and timestamp.
5. The change is fully reversible (mark active again) — never a hard delete.

### Scope (in)

**Migration:**

- New migration `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql`:
  - `ALTER TABLE public.arguments ADD COLUMN inactive_at timestamptz NULL`.
  - `ALTER TABLE public.arguments ADD COLUMN inactive_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL`.
  - `ALTER TABLE public.arguments ADD COLUMN inactive_reason text NULL`.
  - `CREATE INDEX arguments_inactive_at_null_idx ON public.arguments (created_at DESC) WHERE inactive_at IS NULL` (partial index — the common-case filter).
  - `CREATE INDEX arguments_inactive_at_set_idx ON public.arguments (inactive_at DESC) WHERE inactive_at IS NOT NULL` (admin "show inactives" view).
  - New table `public.argument_inactive_audit` — `id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL, argument_id uuid NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE, previous_inactive_at timestamptz, new_inactive_at timestamptz, reason text, created_at timestamptz NOT NULL DEFAULT now()`.
  - Indexes for the audit table.
- RLS policies:
  - `public.arguments` already has SELECT policies. **Add** a `WHERE inactive_at IS NULL` predicate to every non-admin SELECT policy. **Add** a separate admin SELECT policy that allows reading rows with `inactive_at IS NOT NULL` (via `public.is_admin(auth.uid())` or equivalent). **The migration must NOT rewrite the existing policies — it ADDS the qualifier to a new policy with the same `USING` keys** to avoid the "edit an applied migration" prohibition. Designer reads the existing policies and decides the cleanest additive shape (e.g., a new policy `arguments_select_visible_to_user` that includes `inactive_at IS NULL`, plus the existing `arguments_select_admin` policy that is unrestricted).
  - `public.argument_inactive_audit` — admin SELECT, admin INSERT (defense-in-depth; actual writes go through the Edge Function with service role), NO UPDATE / NO DELETE.

**Edge Function:**

- New admin-users actions: `set_argument_inactive` (one argument; takes `argumentId`, `inactive: boolean`, optional `reason`) and `bulk_set_argument_inactive` (bounded list — cap at 100 ids per call; same payload shape per id).
- Both go through `requireAdmin` + `writeAdminAudit` + zod schema validation.
- The handler writes the column update + the dedicated audit row in one transaction (or two writes if a transaction is not trivial; the `argument_inactive_audit` row is best-effort, never blocks the column update — same pattern as ADMIN-AI-001's config audit).
- Add both action names to `WHITELISTED_ACTIONS` and to the `AdminUsersRequestSchema` discriminated union (via `supabase/functions/_shared/adminInactiveSchemas.ts` — a new small file mirroring `adminSemanticConfigSchemas.ts`).
- The handler MUST NOT delete a row in `public.arguments` (CLAUDE.md doctrine).

**Client API:**

- `src/features/admin/adminArgumentsInactiveApi.ts` — typed wrapper exposing `setArgumentInactive(argumentId, inactive, reason?)` and `bulkSetArgumentInactive(items)`.
- `src/lib/edgeFunctions.ts` — adds the two action names to the `AdminUsersAction` union plus the response interfaces.

**UI:**

- `AdminArgumentsTab.tsx` — gains the `Inactive` column, the per-row checkbox, the bulk-action toolbar (`Selected: 3 of 27 — [ Mark inactive ] [ Mark active ] [ Cancel ]`), and the `Show inactives` toggle. The default sort + filter excludes inactive rows.
- Every other argument-list surface adds `WHERE inactive_at IS NULL` (or the equivalent filter on the artifact model from `ADMIN-ARGS-CANONICAL-001`).
- The `ArgumentArtifact.isInactive` field plumbed through CANONICAL-001 lights up here.

**Tests:**

- `__tests__/argumentInactiveMigrationShape.test.ts` — leak-safe textual scan of the new migration file: no `INSERT INTO public.arguments ...` (this is a column-add migration, not a data-rewrite); no `DROP`; no `ALTER ... DROP`; ALL the new columns are nullable; both indexes are partial.
- `__tests__/adminInactiveSchemas.test.ts` — zod schema unit tests (re-declared-local zod, per the project's `adminSchemas.test.ts` convention). Asserts the bulk action caps at 100 ids; rejects empty list; rejects unknown ids by uuid shape.
- `__tests__/AdminArgumentsTab.inactive.test.tsx` — per-row checkbox; bulk action; "Show inactives" toggle hides/shows rows; default view excludes inactive.
- `__tests__/argumentArtifactInactiveResilience.test.ts` — already created in CANONICAL-001; this card adds the actual `isInactive` values from the artifact rows.
- `__tests__/argumentInactiveRlsScan.test.ts` — textual scan of every non-admin SELECT policy on `public.arguments` after the migration applies, asserting either `inactive_at IS NULL` is present OR the policy is named in an explicit allowlist (e.g., the admin policy).
- `__tests__/argumentInactiveBanList.test.ts` — doctrine ban-list scan of every new user-facing string (`Inactive`, `Show inactives`, `Mark inactive`, `Mark active`, reason placeholder, audit row label) — zero verdict/truth tokens.

### Scope (out — non-goals)

- Hard delete. Never.
- Conflating with `request-argument-deletion`. The two surfaces co-exist; the deletion-request flow is user-initiated, this is admin-initiated.
- Per-user "block" or "mute" semantics. Inactive is about the argument, not the author.
- Restoring a previously-inactive argument's evidence credit — scoring is untouched; `argumentScoreModel`, `antiAmplification`, and standing bands are out of scope.
- Per-room "freeze" semantics — that is a separate concept.
- A separate inactive-rooms (debates) workflow. This card is *arguments* only.
- A pagination / infinite-scroll change on the admin table.

### Files to inspect first

- [supabase/migrations/20260516000002_rls_policies.sql](supabase/migrations/20260516000002_rls_policies.sql) — current arguments RLS.
- [supabase/migrations/20260516000007_stage6_admin_operations.sql](supabase/migrations/20260516000007_stage6_admin_operations.sql) — admin pattern (`is_admin()`, `admin_audit_events`).
- [supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql](supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql) — the precedent admin-vs-author moderation surface.
- [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) — action `switch` + handler pattern.
- [supabase/functions/_shared/adminAudit.ts](supabase/functions/_shared/adminAudit.ts) — `WHITELISTED_ACTIONS`.
- [supabase/functions/_shared/adminSchemas.ts](supabase/functions/_shared/adminSchemas.ts) — discriminated union pattern.
- [supabase/functions/_shared/adminSemanticConfigSchemas.ts](supabase/functions/_shared/adminSemanticConfigSchemas.ts) — pattern for the small dedicated schema file.
- [src/features/admin/AdminArgumentsTab.tsx](src/features/admin/AdminArgumentsTab.tsx) — UI surface.
- [src/features/admin/adminArgumentsApi.ts](src/features/admin/adminArgumentsApi.ts) — load query (filter must default to active).
- Every argument-list surface from CANONICAL-001's Phase C.

### Dependencies

- Soft on CANONICAL-001: if grouping lands first, this card adds the `isInactive` propagation. If this lands first, CANONICAL-001 consumes the column. The two can ship in either order; the operator may choose to bundle them, but the prompt asked for them to be separate cards.
- Migration disambiguation: the next sequential migration after `20260602000001_ops_mcp_classifier_failure_detail.sql` is `20260604000001_*` (today's UTC date or operator's chosen date). Designer confirms the next-number rule with `git log --oneline -- supabase/migrations/ | head -5`.

### Blockers

- **Schema/RLS decision.** The designer must decide whether to (a) extend every existing non-admin SELECT policy with `AND inactive_at IS NULL` (cleaner but edits applied-migration policies via a new migration) or (b) add new policies and rely on `OR` semantics. CDiscourse doctrine forbids editing applied migrations — but adding a *new* migration that creates a new policy is permitted, and the new policy can drop or replace an old one within Postgres without rewriting the old migration file. Designer states the choice in `docs/designs/ADMIN-ARGS-INACTIVE-001.md`.
- **"All argument surfaces" inventory.** The card cannot merge until every surface in the inventory either filters on `inactive_at IS NULL` or is explicitly listed as "admin-only" with the inactive filter inverted. The designer produces the inventory; the implementer ticks each off; the reviewer audits each one in the diff.

### Acceptance criteria

- [ ] `docs/designs/ADMIN-ARGS-INACTIVE-001.md` records the chosen RLS shape and the full surface inventory.
- [ ] Migration file `20260604000001_admin_args_inactive_001_argument_inactive_state.sql` exists, lints clean (`npx supabase db lint` runs locally without errors).
- [ ] No existing migration file is edited (verified via `git diff main..HEAD -- supabase/migrations/`).
- [ ] New table `argument_inactive_audit` has RLS enabled, no UPDATE policy, no DELETE policy.
- [ ] `arguments.inactive_at`, `inactive_by`, `inactive_reason` columns added; both partial indexes created.
- [ ] Existing non-admin SELECT policies, in the post-migration state, all gate on `inactive_at IS NULL` (verified by `argumentInactiveRlsScan.test.ts`).
- [ ] Admin SELECT policy reads inactive rows without filter.
- [ ] `set_argument_inactive` and `bulk_set_argument_inactive` actions exist in `admin-users` with zod validation, `requireAdmin`, `WHITELISTED_ACTIONS` membership, and audit write.
- [ ] `AdminArgumentsTab.tsx` renders the `Inactive` column, the bulk-action toolbar, the `Show inactives` toggle; default view excludes inactive.
- [ ] Every argument-list surface in the inventory filters out inactive arguments for non-admin callers.
- [ ] Non-admin attempting to load an inactive argument by direct URL gets the standard "argument not found" experience — *not* "this is hidden, but here's the body".
- [ ] Bulk action capped at 100 ids per call.
- [ ] All seven new test files green; typecheck + lint clean.
- [ ] Test count forecast: +28 to +36. Implementer captures exact delta in `current-status.md`.

### Test plan

See acceptance criteria. In addition:

- **Bulk-action transactionality:** if any of the 100 ids in a bulk call fails (uuid mismatch, RLS rejection), the handler returns a per-id result map `{argumentId: 'ok' | 'error_<code>'}` and the audit row is written per successful id. Tests cover the partial-failure case.
- **No body leak in audit:** the audit row stores `argument_id` + state booleans + actor + optional admin reason — NEVER the argument body. Verified by a textual scan of the handler.
- **Edge Function source file scan:** the new handlers must not `console.log` the argument body, the reason, or the audit row payload — verified by a `__tests__/adminInactiveLeakageScan.test.ts`.

### Governance & safety

- **Stage gates:** GATE A (design with RLS shape + surface inventory) → GATE B (committed diff + all tests green + `npx supabase db lint` clean locally + leak scans) → GATE C (review verdict + **operator-only merge** because merge = deploy).
- **HALT triggers (card-specific):**
  - Designer cannot find an additive RLS path that does not require editing an applied policy. Surface; the operator decides whether to (i) accept a new "supersede" policy that overrides the old one or (ii) re-shape the card.
  - The surface inventory misses a surface (a screen renders an inactive argument body to a non-admin). Block the merge until the inventory is complete.
  - Bulk action is uncapped or the handler can write more than 100 rows per call. HALT.
  - The migration touches an existing migration file's SQL. HALT (edit-an-applied-migration is forbidden).
  - The audit row would store the argument body. HALT.
- **Never-self-approve (§4):** Claude never applies the migration, never deploys the Edge Function, never sets RLS bypass. The operator runs `supabase db push --linked` and `supabase functions deploy admin-users --linked`.
- **Merge = deploy?** **Yes.** The PR touches `supabase/migrations/**` and `supabase/functions/**` — the Supabase GitHub integration auto-applies on merge. Merge is operator-only per §4-B; the green PR sits at GATE C until the operator decides.
- **Reviewer mandate:** under the migration-bearing card heightened-review rule (`.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification (mandatory)"), the reviewer either (a) runs `npx supabase db reset --linked=false` locally if Docker is up, or (b) performs the four-issue-class textual review (column-add reversibility, RLS additive shape, index validity, audit-table policy completeness).
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration apply (operator runs `db push`). NO Edge Function deploy (operator runs `functions deploy`). NO MCP server change. NO direct insert into public.arguments. NO hard delete of any public.arguments row. NO edit of an applied migration. NO .env* write. NO secret in logs. The card writes the migration source file; the operator applies it.*

---

# Phase 2 — Corpus evidence consolidation (P1)

---

## Card CORPUS-30-RUN-COMMIT-001 — Commit the CORPUS-30 prod-synthetic-20260603 run report into the repo

**Priority:** P1
**Status:** Proposed (operator-input required — see "Open question")
**Epic:** Engagement Intelligence / Test-Run Hygiene
**Estimate:** S (docs-only; depends on operator producing the raw artifacts)
**Slug:** `corpus-30-prod-synthetic-run-commit`
**Branch on spawn:** `docs/CORPUS-30-RUN-COMMIT-001-corpus-30-prod-synthetic-run-commit`

### Problem statement

The CORPUS-30 prod-synthetic run referenced in the operator's 2026-06-04 prompt (`runTag: corpus-prod-synthetic-20260603-1924-d49e04cd`; 30 debates, 300 args, 420 Supabase writes, 23 Anthropic calls, voice yellow / spine yellow / repeated-option yellow) is not committed in the repo. There is no entry under `docs/testing-runs/`, no aggregate report, no JSONL trail. Every downstream card in this sprint (RESULTS-001, QUALITY-001, DIVERSITY-001, PHASE7-OBSERVATION-001, REVIEW-001) depends on a single source of truth for "what the run produced." This card creates that single source of truth.

### User-visible outcome

After this card lands:

1. `docs/testing-runs/2026-06-03-corpus-30-prod-synthetic.md` is committed. It contains the runner's markdown report verbatim (or the operator's reconstruction of it), with the runTag prominently named, plus the metadata table (debates, args, Supabase writes, Anthropic-call count, diversity verdicts), the `topReplyMethod` and `disagreement axis` distributions, the per-room body / attribution / bankName / optionIndex / voiceId / spineId fields the planner records, and a leak-safe-by-construction discipline (NO raw hostile X reply bodies; use hashes or short neutral categories per existing engagement-intelligence convention).
2. The underlying JSONL log is *referenced* (path under a gitignored `logs/engagement-intelligence/`) but **not committed**. The committed Markdown is the canonical product evidence; the JSONL is operator-local.
3. `docs/core/current-status.md` is updated with a new entry naming the run, the runTag, and the verdict "usable product signal, not organic evidence" (per the operator's framing).

### Scope (in)

- Author the report file with the structure from prior engagement-intel reports (`docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md` is the closest precedent). Sections:
  - Run header (date, runTag, operator, build SHA, env).
  - Compliance posture (no service-role; no direct `public.arguments` insert; route through `submit-argument`; secrets-not-printed).
  - Aggregate counts (debates, args per debate, Supabase writes, post failure rate).
  - Provider counts (Anthropic calls + tokens spent if measurable from operator-local data).
  - Diversity verdicts (duplicate-seed; repeated-option; spine saturation; voice distribution; samey-move) with the raw numbers + the band colour.
  - Source distribution (banked seed vs Anthropic-rendered vs deterministic fallback) — IF the operator can produce it; otherwise marked `n/a — see CORPUS-30-QUALITY-001`.
  - Top opening phrases — top 10, with counts.
  - Voice distribution by role + by bot account.
  - Spine distribution.
  - Bank exhaustion / repeated-option list.
  - Per-bot persona summary.
  - Pointer to PHASE7-OBSERVATION-001 for classifier coverage.
  - Doctrine cleanliness scan results (zero verdict tokens, zero raw X handles, zero URLs, etc.).
- Add a small leak-safe scan test `__tests__/corpus30RunReportLeakage.test.ts` that scans the committed report for: known secret patterns (`sk-ant-`, `sb_secret_`, JWT shape, Bearer hex); raw X handles (`@<1-15 chars>`); URLs containing `x.com|twitter.com|t.co`; 15–20 digit post IDs; email addresses. Zero matches.
- Update `docs/core/current-status.md` with a small entry.

### Scope (out — non-goals)

- Re-running the corpus. The operator has already run it; this card consolidates the output.
- Committing the raw JSONL.
- Any analysis (verdicts, follow-ups) beyond "the run happened, these are the numbers, these are the verdicts the runner reported." Analysis is RESULTS-001.
- Quality / diversity follow-up code changes. Those are QUALITY-001 and DIVERSITY-001.
- Phase 7 SQL execution. That is PHASE7-OBSERVATION-001.

### Files to inspect first

- [docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md](docs/testing-runs/2026-05-17-ai-driven-bot-corpus.md) — closest precedent for structure.
- [docs/testing-runs/2026-05-17-xai-adversarial-bot-corpus.md](docs/testing-runs/2026-05-17-xai-adversarial-bot-corpus.md) — leak-safe X-source pattern.
- [docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md](docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md) — what the runner reports.
- [docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md](docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md) — observability fields the runner emits.
- [scripts/bot-fixtures/corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) — runTag generation + emitted fields.

### Dependencies

- Operator must provide either the raw markdown report (preferred) or the JSONL trail (Claude can synthesize the markdown from it, with the operator approving the result before commit). If neither is available, the card cannot ship and HALTs — surface the missing input.

### Blockers

- **Operator has the run output locally but not yet provided.** Surface and wait. This is the most likely cause of HALT.
- **The run was not actually executed.** If the artifacts do not exist, this card and every downstream card in Phase 2 / Phase 3 are blocked; rerunning the corpus is a separate, provider-spend, operator-gated action. Surface; do not run the corpus from this card.

### Open question (for the operator at GATE A)

> Is the markdown summary the runner produced still available locally? If yes, paste/path it into the spawned agent's session so it can be committed verbatim (with the leak-safe scan applied). If only the JSONL is available, the spawned agent will synthesize the markdown and ask you to confirm before commit.

### Acceptance criteria

- [ ] `docs/testing-runs/2026-06-03-corpus-30-prod-synthetic.md` exists and matches the structure named in §Scope.
- [ ] `__tests__/corpus30RunReportLeakage.test.ts` exists and passes — zero matches for any secret pattern, X handle, URL, post ID, or email.
- [ ] `docs/core/current-status.md` records the run with the runTag and the operator's verdict line.
- [ ] No raw X reply bodies in the committed Markdown — only hashes or neutral category labels.
- [ ] No raw Anthropic prose from the corpus that would include verdict tokens (the runner's body strings DO appear in the report, but they go through the same ban-list scan that the bot fixture renderer already runs).
- [ ] Typecheck + lint clean (the new test file must compile).

### Test plan

- `corpus30RunReportLeakage.test.ts` — five sub-cases (secrets, X handles, URLs, post IDs, emails) each asserting zero matches on the committed Markdown body.
- The doctrine ban-list scan from earlier corpus reports is reused: scan the Markdown for `winner|loser|won|lost|right|wrong|true|false|liar|dishonest|bad faith|manipulative|propagandist|extremist`. Zero matches.

### Governance & safety

- **Stage gates:** GATE A (design with open-question answered) → GATE B (committed report + green tests) → GATE C (autonomous green squash-merge — docs-only).
- **HALT triggers:** missing input from operator; report would contain secret pattern; report would contain X handle / URL / email; report contains a verdict token.
- **Never-self-approve (§4):** Claude does not re-run the corpus, does not call any provider, does not write to the DB.
- **Merge = deploy?** **No.** Docs-only. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO direct insert into public.arguments. NO re-run of the corpus. NO inclusion of raw X reply bodies. NO secret in the committed file.*

---

## Card CORPUS-30-PHASE7-OBSERVATION-001 — Author + run the A–G classifier coverage SQL pack scoped to the CORPUS-30 debate set

**Priority:** P1
**Status:** Proposed
**Epic:** Classifier Observability / Engagement Intelligence
**Estimate:** M (SQL pack + audit doc + operator-run; no app code change)
**Slug:** `corpus-30-phase-7-coverage-audit`
**Branch on spawn:** `docs/CORPUS-30-PHASE7-OBSERVATION-001-corpus-30-phase-7-coverage-audit`

### Problem statement

The operator prompt referenced "the six read-only Phase 7 SQL files already staged under `scripts/corpus-30-phase-7-sql/`." Grounding pass: **that directory does not exist in the repo.** No `scripts/corpus-30-phase-7-sql/` folder, no `.sql` files under it. The card therefore *creates* the SQL pack and the operator-run audit doc as one unit, then the operator runs the queries via the Supabase SQL editor (read-only metadata SQL only) and Claude updates the audit with the verdicts.

The structural claim from §0.3 above — that the auto-trigger path lit up families A–G on every accepted post — needs to be *measured*, not inferred. Phase 7 is the measurement.

### User-visible outcome

After this card lands:

1. `scripts/corpus-30-phase-7-sql/` exists with six read-only `.sql` files, one per probe.
2. `docs/audits/CORPUS-30-PHASE7-OBSERVATION-SMOKE.md` (`Audit-Lint: v1`) is committed with the four phases (pre-flight; query execution; verdict; follow-ups) and the per-query PASS / PARTIAL / FAIL threshold pre-defined.
3. After the operator runs the SQL pack against the linked project (read-only) and pastes the cell-count tables back, the audit is updated with the actual evidence: A–G coverage matrix, failure breakdown by family/reason/sub-reason, positive observation density, missing family rows per argument, and **explicit H/I/J leakage = 0 verification**.
4. If gaps are found (e.g., Family E missing on 40 args), a follow-up issue is opened — `CORPUS-30-PHASE7-BACKFILL-XXX` — but the backfill / retry is **not** triggered from this card.

### Scope (in)

**SQL pack (six files; all read-only metadata; never select `evidence_span`, body text, JWT, secrets):**

- `scripts/corpus-30-phase-7-sql/01-universe.sql` — counts the corpus universe. Returns `count(DISTINCT debate_id) AS debates`, `count(*) AS arguments` for `debates.run_tag = 'corpus-prod-synthetic-20260603-1924-d49e04cd'` (or whatever the canonical runTag column / metadata join is — the SQL designer reads the planner code to find the runTag persistence path). Expected: `debates = 30`, `arguments = 300`.
- `scripts/corpus-30-phase-7-sql/02-coverage-matrix.sql` — A–G coverage matrix. Returns a 7-row table `family | observed | succeeded | failed | dead_letter | missing` aggregated over the 300 args. The "missing" cell is the diagnostic: any family with `missing > 0` is a gap.
- `scripts/corpus-30-phase-7-sql/03-failures-by-reason.sql` — failure breakdown. `SELECT family, failure_reason, failure_sub_reason, COUNT(*) FROM argument_machine_observation_runs WHERE argument_id IN (<corpus universe>) AND status IN ('failed_terminal', 'dead_letter') GROUP BY 1,2,3 ORDER BY 4 DESC`.
- `scripts/corpus-30-phase-7-sql/04-positive-observation-density.sql` — for each family, what % of observed args returned a positive observation (e.g., `has_quote_present = true`, `has_source_present = true`)? Density-only, no body content.
- `scripts/corpus-30-phase-7-sql/05-missing-family-rows.sql` — anti-join: `argument_id`s in the universe that have no row for a given family. Returns shortened argument id (`substring(id::text, 1, 8)`) + missing-family list per row.
- `scripts/corpus-30-phase-7-sql/06-hij-leakage.sql` — explicit zero check: `SELECT family, count(*) FROM argument_machine_observation_runs WHERE argument_id IN (<corpus universe>) AND family IN ('claim_clarity', 'thread_topology', 'sensitive_composer') GROUP BY 1`. Expected: empty result set (no H/I/J rows). Any non-zero is a HALT for the *Stage-1 ramp* policy — not for this card per se, but the audit records it loudly.

**Each SQL file header** carries the leak-safe contract verbatim:

```
-- READ-ONLY METADATA QUERY — NO INSERT/UPDATE/DELETE/DROP/ALTER.
-- NEVER selects evidence_span, body, prompt, response, or secrets.
-- Scope: corpus runTag corpus-prod-synthetic-20260603-1924-d49e04cd.
-- Returns aggregates / counts / shortened ids only.
```

**Audit document:**

- `docs/audits/CORPUS-30-PHASE7-OBSERVATION-SMOKE.md` — `Audit-Lint: v1`, four phases:
  - Phase 1 — Pre-flight: HEAD assertion; runTag string assertion; routing-disarmed assertion (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`, verified via `supabase secrets list` operator-side or via the latest committed audit).
  - Phase 2 — Query execution (operator runs each of the six SQL files in the Supabase SQL Editor; pastes the result tables back into the audit as Markdown).
  - Phase 3 — Verdict per probe: PASS if the cell matches the predicted band; PARTIAL if it's outside the predicted band but within tolerance; FAIL if it's outside tolerance OR if H/I/J leakage > 0.
  - Phase 4 — Follow-ups: list of opened follow-up cards (none expected if PASS across the board).

**Tests:**

- `__tests__/corpus30Phase7SqlSafety.test.ts` — textual scan of every file in `scripts/corpus-30-phase-7-sql/` asserting: file extension `.sql`; first non-comment token is `SELECT` or `WITH` (never `INSERT|UPDATE|DELETE|DROP|ALTER`); no occurrence of `evidence_span` anywhere; no occurrence of the literal string `Bearer ` or `sk-ant-`; no `select *` (each query selects explicit columns).
- `__tests__/corpus30Phase7AuditShape.test.ts` — asserts the audit doc has the four phases, the `Audit-Lint: v1` line, the per-phase PASS/PARTIAL/FAIL definitions, the runTag string, the H/I/J leakage probe.

### Scope (out — non-goals)

- Re-triggering classification (no `re-classify-argument` invocation; the auto-trigger already ran on accept).
- Backfilling missing observations. If 05-missing-family-rows.sql shows gaps, that becomes a separate card. Do not silently re-classify from this card.
- Querying any classifier *response body* — only metadata + status + reason codes.
- Running the SQL — that is operator action. Claude prepares the pack and reads back the result tables the operator pastes.
- Arming routing. Not now, not ever from this card.

### Files to inspect first

- [supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql](supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql) — `argument_machine_observation_runs` shape.
- [supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql](supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql) — `failure_detail jsonb` column added; available as a join target.
- [supabase/functions/_shared/booleanObservations/familyRegistry.ts](supabase/functions/_shared/booleanObservations/familyRegistry.ts) — the canonical family names (the SQL must use the exact enum strings).
- [scripts/bot-fixtures/corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) — how runTag is persisted (column on `debates`? metadata join? a runtag → debate-id table?).
- [docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md](docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md) — runTag invariant.
- The `cdiscourse-prompt-standard` skill's **leak-safe SQL** section.
- The OPS-MCP-FORTIFIED-ARCHITECTURE status doc §5 — failure detail vocabulary, dead-letter / cluster definitions.

### Dependencies

- Hard: `CORPUS-30-RUN-COMMIT-001` must land first OR the operator must confirm the runTag string in chat. Without the runTag, the queries cannot scope. (Designer surfaces this at Phase 0.)
- Soft: `OPS-MCP-HEALTH-002` consumes the same `argument_machine_observation_runs` shape — they should align on column names.

### Blockers

- Runner does not persist runTag in a queryable form. If the planner never wrote `run_tag` onto `debates` (or any joinable surface), the queries cannot scope precisely — they fall back to `created_at` window (e.g., `WHERE debates.created_at BETWEEN '2026-06-03 19:24' AND '2026-06-03 20:30'`), which is a weaker scope. Designer documents the choice.
- `argument_machine_observation_runs` table is empty for the corpus debate set — would imply the auto-trigger path did NOT fire, contradicting the structural claim in §0.3. That is a finding, not a HALT for the card; the audit records it and a follow-up investigates.

### Acceptance criteria

- [ ] `scripts/corpus-30-phase-7-sql/` exists with six `.sql` files, each carrying the leak-safe header.
- [ ] `docs/audits/CORPUS-30-PHASE7-OBSERVATION-SMOKE.md` exists with the four phases pre-defined.
- [ ] `__tests__/corpus30Phase7SqlSafety.test.ts` exists and passes; no banned SQL keyword, no `evidence_span`, no `select *`, no secret patterns.
- [ ] `__tests__/corpus30Phase7AuditShape.test.ts` exists and passes.
- [ ] After operator runs the pack and pastes back the result tables, the audit is updated with the verdict and the H/I/J-leakage probe explicitly shows `0`.
- [ ] Any gap surfaced is logged as a follow-up issue with the title `CORPUS-30-PHASE7-BACKFILL-<family>` — NOT triggered from this card.
- [ ] No raw evidence_span / body / prompt is ever in the audit text.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A (design with the runTag-persistence question resolved) → GATE B (SQL pack + audit doc + two tests green) → operator runs the pack → GATE C (Claude updates the audit with verdicts, autonomous green squash-merge under §5 because the change is read-only metadata + docs).
- **HALT triggers:**
  - The runTag string is unavailable.
  - The pack would select `evidence_span`, body, or a secret column.
  - The H/I/J probe returns non-zero (records loudly in the audit; the *card* still merges with FAIL verdict, but a `OPS-HIJ-LEAKAGE-INVESTIGATION` follow-up opens and that is operator-gated).
- **Never-self-approve (§4):** Claude does NOT run the SQL. The operator runs it via the SQL editor or `npx supabase db psql` (operator-only).
- **Merge = deploy?** **No.** Docs + read-only SQL files. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO classifier re-trigger. NO INSERT/UPDATE/DELETE/DROP/ALTER in any committed SQL. NO selection of evidence_span / body / prompt / response / secret. NO routing arm. NO H/I/J productionEnabled flip. The SQL is operator-run.*

---

## Card CORPUS-30-RESULTS-001 — Corpus result analysis report + executive verdict

**Priority:** P1
**Status:** Proposed
**Epic:** Engagement Intelligence / Product Evidence
**Estimate:** M (docs-only synthesis card)
**Slug:** `corpus-30-results-analysis-report`
**Branch on spawn:** `docs/CORPUS-30-RESULTS-001-corpus-30-results-analysis-report`

### Problem statement

The 30-room run produced a useful signal (30 scenarios built, 30 usable dissent replies, 300 posts, 420 Supabase writes, clean compliance posture, full skill-gate validation) but the operator's read of the markdown surfaces three yellow diversity warnings and a suspicious-green samey-move metric (mean=0, max=0). The operator framing in the 2026-06-04 prompt was "use as product evidence, not organic evidence." This card produces the executive analysis that turns the raw run into a product decision: what the corpus proved, what it did NOT prove, and which follow-up cards close the remaining evidence gaps.

### User-visible outcome

After this card lands:

1. `docs/testing-runs/2026-06-03-corpus-30-analysis.md` is committed. It is the *analysis* layer above the *run-commit* layer.
2. The report carries an executive verdict line at the top: "**Usable product signal. NOT organic evidence.**" (or the operator's revision of that line at GATE A).
3. The report contains explicit "**What the corpus proved**" and "**What the corpus did NOT prove**" sections.
4. Every follow-up is named with an issue link (this backlog provides the slugs; the spawned card opens the GH issues at the right phase).
5. The report includes concrete UI observations from Admin > Arguments and the main user Arguments tab (the operator's "yes the duplicate-row pain is real / no it isn't") — collected via a manual UI walkthrough by the operator and pasted into the report. If the operator hasn't walked through yet, that is an open-question at GATE A.

### Scope (in)

- Synthesize from CORPUS-30-RUN-COMMIT-001 (the runner's markdown), CORPUS-30-PHASE7-OBSERVATION-001 (the coverage matrix), and the operator's UI walkthrough.
- Sections:
  - **Executive verdict** (3–5 lines).
  - **What the corpus proved** (e.g., the live-path planner wires through correctly; 300/300 posted; auto-trigger path is alive; submit-argument shape; no service-role; no direct insert).
  - **What the corpus did NOT prove** (e.g., organic Stage-1 evidence; H/I/J behavior; semantic-referee MCP routing; long-thread dynamics beyond 10-move ceiling; classifier accuracy on real user prose; cross-room user behavior; UI ergonomics under high write volume).
  - **Diversity verdicts re-examined** — the runner's yellow tags re-stated in product language, with each yellow tied to a follow-up card (`CORPUS-30-QUALITY-001`, `CORPUS-30-DIVERSITY-001`).
  - **Samey-move green-on-empty** — names this as a metric defect (mean=0 / max=0 on non-empty body samples), points to QUALITY-001 for the fix.
  - **UI observations** — short list of operator findings from a manual walkthrough of Admin > Arguments and the main user tab.
  - **Follow-up issue list** with one-line summaries.
- Update `docs/core/current-status.md` with the verdict.

### Scope (out — non-goals)

- Code change. Pure synthesis.
- Re-running the corpus.
- Posting any verdict / follow-up issue to GitHub yourself — surface the list, operator opens issues.
- Truth claims about who is right in any debate. The report records the *process* (the corpus posted, the planner wired) not the *content* (which side was correct on any specific argument).

### Files to inspect first

- The output of CORPUS-30-RUN-COMMIT-001 (its markdown).
- The output of CORPUS-30-PHASE7-OBSERVATION-001 (its audit).
- [docs/core/current-status.md](docs/core/current-status.md) — surrounding entries for tone / shape.
- [docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md](docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md) — what the live-path wiring promised; the report's "what was proved" enumerates that.

### Dependencies

- Hard: CORPUS-30-RUN-COMMIT-001 in `main`.
- Soft: CORPUS-30-PHASE7-OBSERVATION-001 ideally in `main` (the coverage matrix sharpens the "what was proved" claims). If PHASE7 is still in flight, the report ships with a stub section linking to PHASE7 as "in progress" and re-opens once PHASE7 lands.

### Blockers

- Operator UI walkthrough not yet done. Surface as open-question at GATE A.

### Acceptance criteria

- [ ] `docs/testing-runs/2026-06-03-corpus-30-analysis.md` exists with the four named sections.
- [ ] Executive verdict line is the first non-header line.
- [ ] "What the corpus proved" and "What the corpus did NOT prove" sections both present.
- [ ] Every yellow diversity tag is tied to a named follow-up card.
- [ ] Samey-move metric defect is explicitly called out and tied to QUALITY-001.
- [ ] No raw verdict tokens about any user or any side.
- [ ] `current-status.md` updated.

### Test plan

- `__tests__/corpus30AnalysisReportBanList.test.ts` — doctrine scan of the committed report; zero verdict tokens about a user, a side, or a debate.
- `__tests__/corpus30AnalysisReportLeakage.test.ts` — same leak-safe scan as the run-commit card.

### Governance & safety

- **Stage gates:** GATE A (design with the UI walkthrough question resolved) → GATE B (committed report + tests) → GATE C (autonomous green squash-merge; docs-only).
- **HALT triggers:** missing input from PHASE7 cannot be excused for the "what was proved" claim about classifier coverage; if PHASE7 has not run, the relevant claim is marked `pending` and not asserted. Never claim coverage without measured evidence.
- **Never-self-approve (§4):** Claude does not open GitHub issues from this card — the operator does. Claude lists the issue slugs.
- **Merge = deploy?** **No.** Docs-only. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO re-trigger of any classifier. NO new GitHub issue creation by Claude. NO truth verdict in any sentence. NO secret in the committed file.*

---

# Phase 3 — Corpus quality follow-ups (P1)

---

## Card CORPUS-30-QUALITY-001 — Reduce deterministic fallback dominance; fix samey-move green-on-empty defect

**Priority:** P1
**Status:** Proposed
**Epic:** Engagement Intelligence / Corpus Runner
**Estimate:** M (planner / renderer / reporter changes + new threshold tests; no DB)
**Slug:** `corpus-fallback-dominance-and-samey-metric`
**Branch on spawn:** `feat/CORPUS-30-QUALITY-001-fallback-and-samey-fix`

### Problem statement

Two related defects in the corpus run:

1. **Fallback dominance.** The runner's markdown shows only ~23 Anthropic calls across 300 moves. If 30 moves are banked-seed M1/M2 (where Anthropic is intentionally skipped) and ~30 are root theses (similarly banked), the remaining ~240 moves *should* be Anthropic-rendered — but the call count is an order of magnitude below that. Either (a) the renderer is falling back to deterministic templates on retry/timeout/budget errors more aggressively than expected, or (b) the corpus was deliberately budget-capped, or (c) the reporter is undercounting calls. Without a `source_distribution` first-class metric, we cannot tell which.
2. **Samey-move green-on-empty.** The runner reports `samey-move mean=0 / max=0` and marks it green. A green metric with empty samples is a false-positive — the same shape that the live-path wiring card already encountered on the tiny-stage run (per the operator's framing). The fix is to (a) compute samey-move from actual token-set samples and (b) emit `n/a`, never green, on absent data.

### User-visible outcome

After this card lands:

1. `bot-fixtures` runner has a first-class `source_distribution` metric in its report: per-move classification into `banked_seed` / `anthropic_rendered` / `deterministic_fallback`, with a per-move-index breakdown.
2. New band thresholds in the runner report:
   - `anthropicRenderedMovePct >= 60%` of non-seed moves → green; 40-60% → yellow; < 40% → red.
   - `deterministicFallbackPct <= 20%` of non-seed moves → green; 20-40% → yellow; > 40% → red.
   - `topOpeningPhrasePct < 8%` per opening phrase → green; 8-15% → yellow; > 15% → red.
   - `sameyMoveMean` — green only if computed from ≥ N=50 non-empty body samples and the score is below threshold; `n/a` if N < 50; never green on empty.
3. Tests assert no green-on-empty regression for any new metric.
4. The fix is *runner-only* — no app code change, no DB change.

### Scope (in)

- New module `scripts/bot-fixtures/corpusSourceDistributionReporter.js` (or extension of the existing reporter) that classifies each move into one of the three sources and aggregates the per-move-index distribution.
- Move-renderer instrumentation: every call to the Anthropic renderer captures `{ ok: boolean, fallbackReason: 'rate_limit' | 'validation_after_retry' | 'budget_exhausted' | 'token_cap' | 'unknown' }`. The runner emits this into the JSONL.
- Reporter changes: add the new metric sections to the Markdown.
- Samey-move metric fix: compute over the actual body token sets; emit `n/a` when sample size < N=50.
- Diagnosis hooks (read-only): the runner logs per-call latency + HTTP status on the Anthropic side (already partially there per the live-path card) so a future run can see whether 429s are the cause.
- New tests:
  - `__tests__/corpusSourceDistributionMetric.test.ts` — covers each band; covers the green-on-empty refusal; covers the per-move-index aggregation.
  - `__tests__/corpusSameyMoveGuard.test.ts` — feeding non-empty body samples produces non-zero mean/max; feeding empty samples produces `n/a` (not green).
  - `__tests__/corpusReporterThresholds.test.ts` — every new threshold; green/yellow/red transitions.

### Scope (out — non-goals)

- Re-running the corpus from this card. The card adds metrics + the metric fix; the next corpus run uses them.
- Changing the planner's selection / voice / spine model. That is DIVERSITY-001.
- Anthropic-side throttling decisions or token caps. Diagnosis only — a follow-up may tune the cap.
- Live provider call. Operator triggers any provider-spend smoke.
- Any change to `submit-argument`.

### Files to inspect first

- [scripts/bot-fixtures/corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) — what the planner emits.
- The runner's reporter module (search for `samey-move` to locate).
- [scripts/bot-fixtures/aiMoveRenderer.js](scripts/bot-fixtures/aiMoveRenderer.js) — where fallback decisions happen.
- [scripts/bot-fixtures/anthropicMessagesClient.js](scripts/bot-fixtures/anthropicMessagesClient.js) — call-site for instrumenting `httpStatus` + `fallbackReason`.
- [docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md](docs/designs/CORPUS-30-LIVE-PATH-PLANNER-WIRING-AND-REPORTER-ACCURACY.md) — the principle "reporter must not green on absent data" is established here; reuse the test pattern.

### Dependencies

- Hard: CORPUS-30-RUN-COMMIT-001 in `main` (so the new thresholds can be back-checked against the existing run's numbers).
- Soft: DIVERSITY-001 is parallel; both modify the runner but in different code paths.

### Blockers

- The Anthropic client does not currently expose `httpStatus` per call in a structured way (would need a small refactor). Designer confirms.

### Acceptance criteria

- [ ] `source_distribution` is a first-class metric in the runner report.
- [ ] All four new thresholds present and tested.
- [ ] Samey-move metric returns `n/a` on empty samples, not green.
- [ ] No green-on-empty for any new metric.
- [ ] Existing runner tests keep passing.
- [ ] Typecheck + lint clean.
- [ ] Test count forecast: +14 to +20.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B (committed diff + green tests, including the no-green-on-empty regression guard) → GATE C (autonomous green squash-merge — dev-tooling only).
- **HALT triggers:** a new metric that can be green on empty data (the "samey-move incident" repeated).
- **Never-self-approve (§4):** Claude never triggers a corpus run, never calls Anthropic, never deploys.
- **Merge = deploy?** **No.** Dev-tooling only (`scripts/bot-fixtures/**`). Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO corpus re-run. NO direct insert into public.arguments.*

---

## Card CORPUS-30-DIVERSITY-001 — Voice diversity tuning (per-room role identity); spine saturation diagnosis

**Priority:** P1
**Status:** Proposed
**Epic:** Engagement Intelligence / Corpus Runner
**Estimate:** M (planner change + tests; no DB)
**Slug:** `corpus-voice-spine-diversity-tuning`
**Branch on spawn:** `feat/CORPUS-30-DIVERSITY-001-voice-spine-diversity-tuning`

### Problem statement

The 30-room run used only three voices (`analogist`, `scope_narrower`, `plain_skeptic`, 30 each), which trips the voice-distribution yellow tag. Root cause hypothesis (operator-stated and matches the planner code): `voiceId = hash(runId + botUserId) % 8` is per-bot-user-per-run, and the run uses 3 bot accounts → 3 voices, deterministically. The 8-voice catalog is underused.

Remediation (operator-stated, adopted): change voice assignment to per-room-role identity: `voiceId = hash(runId + threadIndex + role + botUserId) % 8` and enforce "no same-room voice collision where possible." This keeps persona continuity *within* a single room (a given role's voice does not flip mid-thread) and uses more of the catalog *across* the run.

Spine saturation yellow is the secondary signal — likely related, since spines and voices interact in the planner. The card diagnoses spine saturation and proposes a tuning if needed.

### User-visible outcome

After this card lands:

1. A 30-room run uses ≥ 6 of 8 voices.
2. No same-room voice collision unless N-roles > N-voices forces it (e.g., 9-role rooms cannot avoid one collision).
3. Spine distribution yellow either resolves or is reframed as "expected because spines are stricter than voices" (a documented decision, not a silent yellow).
4. Voice-distribution target band recalibrated in the reporter to the per-room-role count (60 role slots in a 2-role × 30-room run, or 90 if synthesizer counts).

### Scope (in)

- [scripts/bot-fixtures/corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) — voice assignment refactor: `voiceId = hash(runId + threadIndex + role + botUserId) % 8`. Add per-room collision avoidance pass: if room R's assigned voices have a duplicate, re-roll the duplicate by extending the hash key with a salt counter and retrying up to K=8 times before giving up (deterministic; never falls back to non-deterministic).
- Reporter band recalibration: voice-distribution target is "≥ 6 distinct voices across the run AND ≤ 1 same-room collision per 10 rooms." Greens/yellows/reds re-stated.
- Spine diagnosis: the implementer reads the spine assignment logic and decides whether (a) a similar refactor applies, (b) spines are structurally narrower (only N=3 spines and that is intentional), or (c) spine saturation is correlated with voice and clears once voice is fixed.
- Tests:
  - `__tests__/corpusVoiceAssignmentDiversity.test.ts` — synthetic 30-room run input; assert ≥ 6 voices; assert no same-room collision when N-roles ≤ N-voices.
  - `__tests__/corpusVoiceAssignmentDeterminism.test.ts` — same input → same voice assignment, twice.
  - `__tests__/corpusSpineSaturationReporter.test.ts` — spine count assertions against the new target band.

### Scope (out — non-goals)

- Re-running the corpus. The next run uses the new assignment.
- Adding new voices to the 8-voice catalog. That is a separate (and larger) call.
- Changing the persona-prompt content. The card changes assignment, not persona text.
- Cross-room persona continuity (e.g., "bot A's voice is consistent across multiple rooms"). The operator explicitly chose per-room-role.

### Files to inspect first

- [scripts/bot-fixtures/corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) — current voice-id hash.
- [scripts/bot-fixtures/aiBotPersonas.js](scripts/bot-fixtures/aiBotPersonas.js) — 8-voice catalog.
- The runner's reporter — voice-distribution thresholds.
- [docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md](docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md) — observability invariants (voiceId must remain emitted per move).

### Dependencies

- None hard. Can run in parallel with QUALITY-001 (different code paths).

### Blockers

- Spine assignment might be structurally limited. The implementer surfaces this if it cannot be tuned without re-architecting; the card then ships voice-only and opens a `CORPUS-SPINE-CATALOG-EXPANSION` follow-up.

### Acceptance criteria

- [ ] Voice assignment is per-room-role.
- [ ] 30-room synthetic input yields ≥ 6 distinct voices.
- [ ] Deterministic — same input → same output.
- [ ] Voice-distribution band recalibrated and tested.
- [ ] Spine saturation either resolved or reframed with a documented rationale.
- [ ] No green-on-empty for the new diversity bands.
- [ ] Typecheck + lint clean.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B (committed diff + green tests) → GATE C (autonomous green squash-merge — dev-tooling only).
- **HALT triggers:** non-deterministic voice assignment in any code path; loss of the observability fields (voiceId, spineId, attribution, bankName, optionIndex, runTag) per the live-path-wiring invariant.
- **Never-self-approve (§4):** no corpus re-run, no provider call.
- **Merge = deploy?** **No.** Dev-tooling only. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO loss of attribution / bankName / optionIndex / voiceId / spineId / runTag fields. NO corpus re-run. NO non-deterministic behavior.*

---

# Phase 4 — Admin usability sweep (P1)

---

## Card ADMIN-ARGS-USABILITY-001 — Admin Arguments list usability pass (density, columns, filters, row actions, runTag)

**Priority:** P1
**Status:** Proposed
**Epic:** Admin Operations
**Estimate:** M (UI-only; depends on CANONICAL-001 + INACTIVE-001)
**Slug:** `admin-arguments-usability-pass`
**Branch on spawn:** `feat/ADMIN-ARGS-USABILITY-001-admin-arguments-usability-pass`

### Problem statement

After CANONICAL-001 collapses duplicates into artifacts and INACTIVE-001 adds inactive/active filtering, Admin > Arguments is still a single big sortable table without the filters, density control, runTag scoping, or quick actions a moderator actually needs. The corpus run made the absence acute: hundreds of bot-authored corpus rows mixed with regular user rows, with no way to isolate "this run's data" vs "everything else."

### User-visible outcome

After this card lands:

1. Admin > Arguments has a top toolbar with: density (compact / comfortable), quick filters (Active · Inactive · Bots only · Humans only · Has failed classifier · Missing classifier coverage · Corpus runs (paste a runTag)), and a "Reset filters" button.
2. Columns: Status (active/inactive chip) · Side · Type · Debate / latest body excerpt · Author (display name + bot/user chip) · Latest Updated · Created · Classifier coverage (`6/7` with hover tooltip listing which families are present/missing) · Qualifier badges · Update count · Action (open artifact / open debate / mark inactive / copy id).
3. Admin can paste a runTag string and the table filters to just that run's args (per the persistence path PHASE7 already established).
4. Preferences (density, current filters, sort) persist in local storage per admin user.
5. The table remains keyboard-navigable.

### Scope (in)

- UI changes to [AdminArgumentsTab.tsx](src/features/admin/AdminArgumentsTab.tsx) and any new sub-components.
- Persistence via `AsyncStorage` or the equivalent already used in the admin area.
- Quick-filter implementation as pure-TS selectors on the artifact list (no new server-side filter — keep the existing `loadAdminArguments` happy path; filter client-side, paginate if needed).
- Classifier coverage column: needs a join from `arguments` → `argument_machine_observation_runs` (count of distinct families with `status='succeeded'`). The query MUST stay metadata-only (count + family enum); no body content.
- runTag filter: requires the planner-persistence path established in PHASE7-OBSERVATION-001; if it's not yet committed, the filter is gated behind a feature flag and the column shows `unavailable` until PHASE7 lands.
- Tests:
  - `__tests__/AdminArgumentsTabFilters.test.tsx` — each filter chip in isolation + in combination.
  - `__tests__/AdminArgumentsTabClassifierCoverage.test.tsx` — coverage column renders `N/7`; hover reveals the missing family list.
  - `__tests__/AdminArgumentsTabRunTagFilter.test.tsx` — pasting a runTag filters to just that run.
  - `__tests__/AdminArgumentsTabPreferencesPersistence.test.tsx` — local-storage round-trip.

### Scope (out — non-goals)

- Server-side filter / pagination. Stays client-side for this card; if perf becomes a problem, that's a separate card.
- Editing classifier coverage from the UI. The column is read-only.
- Triggering classifier re-runs. (Anything resembling a re-classify button is HALT until OPS-MCP-HEALTH-002 lands.)
- Cross-admin shared preferences.
- Adding a debate-list usability pass (separate; this card is *arguments* only).

### Files to inspect first

- [src/features/admin/AdminArgumentsTab.tsx](src/features/admin/AdminArgumentsTab.tsx).
- [src/features/admin/adminArgumentsApi.ts](src/features/admin/adminArgumentsApi.ts) — joinable columns; what `loadAdminArguments` currently returns.
- The `ArgumentArtifact` view model from CANONICAL-001.
- The `inactive_at` filter from INACTIVE-001.
- The runTag persistence path from PHASE7.

### Dependencies

- Hard: CANONICAL-001 in `main` (artifact model is the row unit).
- Hard: INACTIVE-001 in `main` (Inactive filter is meaningful).
- Soft: PHASE7-OBSERVATION-001 (runTag filter falls back to disabled if not yet committed).

### Blockers

- Classifier coverage column needs a server-side count per argument. If the count is expensive, the API may need a paginated approach. Designer notes the tradeoff.

### Acceptance criteria

- [ ] Density toggle present and persisted.
- [ ] All seven quick filters present and tested.
- [ ] runTag filter works against an existing committed runTag.
- [ ] Coverage column renders `N/7` with the missing-family tooltip.
- [ ] All four new tests green.
- [ ] Existing AdminArgumentsTab tests keep passing.
- [ ] Typecheck + lint clean.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B → GATE C (autonomous green squash-merge — client-only).
- **HALT triggers:** any UI control that would re-trigger classification, mass-action arguments, or apply server-side mutations directly from the table.
- **Never-self-approve (§4):** no DB write, no migration, no deploy.
- **Merge = deploy?** **No.** Pure client. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO direct insert into public.arguments. NO hard delete. NO classifier re-trigger button. NO mass action surface beyond bulk mark-inactive (the action INACTIVE-001 already exposes). The "delete" / "remove" / "archive" / "clean slate" vocabulary is banned from any UI control in this card.*

---

# Phase 5 — H/I/J runway (P2; ledger + scoping ONLY)

---

## Card MCP-HIJ-LEDGER-000 — H/I/J readiness ledger (no implementation, no enablement; MUST land before any scoping card)

**Priority:** P2
**Status:** Proposed
**Epic:** Classifier Observation / Family Runway
**Estimate:** M (docs-only synthesis)
**Slug:** `mcp-hij-readiness-ledger`
**Branch on spawn:** `docs/MCP-HIJ-LEDGER-000-mcp-hij-readiness-ledger`

### Why this card is FIRST in the H/I/J runway

Families H, I, and J could fail at any of five distinct axes — **prompt shape**, **schema/packet validation**, **validator/ban-list**, **source-context (input data sufficiency)**, **UI consumer** — and the failure mode is different at each axis. The H Card-3 incident (PR #407 FAIL → PR #408 rollback → PR #421 / #423 mitigation → PR #425 / #426 PASS-LOAD) confirmed packet/schema validation as the binding cluster for H, but I and J have never been load-tested and we don't know which axis binds them.

If we write a scoping card per family BEFORE the per-axis classification, each scoping card will overfit to the wrong axis — it will plan a smoke that exercises the WRONG failure mode, recommend a mitigation that doesn't apply, and produce gate debt the next operator card has to unwind. The H/I/J retry chain has already paid this cost once (the original "increase concurrency to mask the cluster" mitigations that PR #418 had to undo); it should not pay it again.

**Therefore this ledger lands first.** It is a single-page per-axis-per-family classification — for each of H, I, J, what is the *blocking axis*? Only after that classification can MCP-H-SCOPE-001, MCP-I-SCOPE-001, MCP-J-SCOPE-001 design a smoke that targets the real bottleneck. Until this card is in `main`, **the three scoping cards CANNOT start**. The spawn pass enforces this as a hard precondition.

### Problem statement

Families H (`claim_clarity`), I (`thread_topology`), J (`sensitive_composer`) remain `productionEnabled: false` per `familyRegistry.ts` and per the OPS-MCP-FORTIFIED-ARCHITECTURE status doc. H production retry is gated on PASS-LOAD + named operator authorization. I and J have scoping audits only. The state spans many docs (`docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md`, `MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md`, the scoping audits, the status doc, `next-prompts.md`). The operator should not start H, I, or J without a single page that names every blocker per family and what would resolve it — and which of the five axes (prompt / schema / validator / source-context / UI) is the binding one.

### User-visible outcome

After this card lands:

1. `docs/designs/MCP-HIJ-READINESS-LEDGER.md` is committed. It is the single source for "what would have to be true to enable H? I? J?"
2. The ledger names, per family: current code status (`productionEnabled` line + `file:line`), prompt status, server status, validator status, schema status, UI consumer status, gating-doc state, blocker list, smoke/canary requirements, load-smoke requirements, doctrine risks.
3. Each family ends with a "preconditions to scope" list — the inputs the corresponding scoping card (H-SCOPE / I-SCOPE / J-SCOPE) consumes.
4. The ledger explicitly states that this doc authorizes nothing — it is a status read.

### Scope (in)

- Read every file the status section names — `familyRegistry.ts`, the H/I/J design docs, the H Card-3 rollback notes, the I/J scoping audits, `OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md`, `OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`, `next-prompts.md`.
- Author the ledger doc.
- Update `docs/core/current-status.md` with a pointer.
- No code change.
- Tests: a textual scan asserting the ledger doc has the per-family sections + an "authorizes nothing" disclaimer.

### Scope (out — non-goals)

- Any production enablement.
- Any `familyRegistry.ts` edit.
- Any queue routing arm.
- Any provider call.
- Designing the actual H/I/J implementations — that is the scoping cards below.

### Files to inspect first

- [supabase/functions/_shared/booleanObservations/familyRegistry.ts](supabase/functions/_shared/booleanObservations/familyRegistry.ts).
- [docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md](docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE.md).
- [docs/designs/MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md](docs/designs/MCP-021C-EDGE-FAMILY-I-ENABLE-intent.md).
- The two scoping audits under `docs/audits/`.
- [docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md](docs/core/OPS-MCP-FORTIFIED-ARCHITECTURE-STATUS.md).
- The canonical gate-criteria doc.
- [docs/core/next-prompts.md](docs/core/next-prompts.md).

### Dependencies

- None hard.

### Blockers

- The ledger requires reading many docs accurately; the designer must not paper over any blocker. If a doc disagrees with current code reality (CLAUDE.md memory entry says "trust git + file tree as ground truth"), the file tree wins and the ledger records the doc-vs-code discrepancy.

### Acceptance criteria

- [ ] `docs/designs/MCP-HIJ-READINESS-LEDGER.md` exists with three family sections, each carrying the named subfields.
- [ ] "Authorizes nothing" disclaimer is in the doc header.
- [ ] Test: `__tests__/mcpHijLedgerShape.test.ts` asserts the structure.
- [ ] No claim is unsourced — every blocker carries `file:line` or `HEAD <hash>` evidence.
- [ ] No HEAD value is fabricated — the doc's HEAD anchor is the actual HEAD at the time of authoring.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B → GATE C (autonomous green squash-merge — docs-only).
- **HALT triggers:** any claim that would require provider spend or production enablement.
- **Never-self-approve (§4):** no enablement, no routing arm, no `familyRegistry` edit.
- **Merge = deploy?** **No.** Docs-only. Autonomous green squash-merge permitted under §5.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO H/I/J productionEnabled flip. NO routing arm. NO secret in the committed file.*

---

## Card MCP-H-SCOPE-001 — Family H scoping / smoke plan (design-only)

**Priority:** P2
**Status:** Proposed
**Epic:** Classifier Observation / Family H
**Estimate:** M (design doc only)
**Slug:** `mcp-family-h-scope-design`
**Branch on spawn:** `docs/MCP-H-SCOPE-001-mcp-family-h-scope-design`

### Problem statement

H (`claim_clarity`) failed its production-enable smoke in PR #407 and was rolled back in PR #408. The cluster has been root-caused (packet/schema validation; specific evidenceSpan paths) and mitigated in PR #421 + #423, with two consecutive PASS-LOAD drills (PR #425 + #426). The next move is a *scoping design* — not implementation — that names exactly what H's retry would do, what the smoke plan looks like, and what the gating preconditions are. This card produces that design only.

### User-visible outcome

After this card lands:

1. `docs/designs/MCP-H-SCOPE-001.md` is committed.
2. It contains a complete prior-evidence summary, a hypothesis ladder (what was the failure: prompt shape / taxonomy / validation / transport / UI display?), the proposed retry shape, the smoke plan (local Deno → hosted MCP → admin_validation canary → N=8 burst → read-only SQL coverage), and an explicit "**not authorized to flip productionEnabled in this card or the next**" line.
3. A rollback posture is documented for the *eventual* enablement (separate, operator-gated, future card).

### Scope (in)

- Synthesis design only.
- Tests: `__tests__/mcpHScopeShape.test.ts` asserts the design has the six sections (evidence summary, hypothesis ladder, retry shape, smoke plan, preconditions, rollback) and the verbatim "not authorized" line.

### Scope (out — non-goals)

- Any code change.
- Any familyRegistry edit.
- Triggering any smoke.

### Files to inspect first

- The MCP-HIJ-LEDGER-000 doc (this card's primary input).
- The H failure history (PR #407 / #408 / #421 / #423 / #425 / #426 commit history + the design docs).
- The canonical gate-criteria doc.

### Dependencies

- **Hard: MCP-HIJ-LEDGER-000 in `main`.** Cannot start without it. The ledger names which of the five axes (prompt / schema / validator / source-context / UI) is the binding blocker for Family H. Without that classification, this scoping card overfits to the wrong axis and creates gate debt — exactly the failure mode the ledger card exists to prevent.

### Blockers

- The ledger's H-axis classification is `unknown` or `multiple`. If so, this card cannot scope a useful smoke; surface as HALT and request the ledger be sharpened first.

### Acceptance criteria

- [ ] Design doc exists with the six sections.
- [ ] "Not authorized to flip productionEnabled in this card or any subsequent card without an explicit operator-named authorization" appears verbatim.
- [ ] Test passes.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B → GATE C (autonomous green squash-merge — docs-only).
- **HALT triggers:** any sentence in the design that authorizes a flip.
- **Never-self-approve (§4):** no enablement.
- **Merge = deploy?** **No.** Docs-only.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO service-role. NO migration. NO Edge Function source edit. NO MCP server change. NO H productionEnabled flip. NO H smoke trigger. The design names what a future enablement would do; it does not authorize one.*

---

## Card MCP-I-SCOPE-001 — Family I (thread_topology) scoping

**Priority:** P2
**Status:** Proposed
**Epic:** Classifier Observation / Family I
**Estimate:** M (design doc only)
**Slug:** `mcp-family-i-scope-design`
**Branch on spawn:** `docs/MCP-I-SCOPE-001-mcp-family-i-scope-design`

### Problem statement

Family I (`thread_topology`) has a scoping audit (`docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` — the audit covers both I and J despite the filename naming J) but no scoping design. The required thread context, whether the current classifier input shape has enough thread state, and the UI consumers are not yet named in a design doc.

### User-visible outcome

After this card lands:

1. `docs/designs/MCP-I-SCOPE-001.md` is committed.
2. It names the required thread context (parent chain depth, sibling count, lane membership, etc.), confirms or denies that the current `classifyMove` input shape carries it, and identifies the UI consumers (probably the timeline scrubber + the gallery cards).
3. A blocker list ends the doc.

### Scope (in)

- Synthesis design only.
- Tests: `__tests__/mcpIScopeShape.test.ts`.

### Scope (out — non-goals)

- Any code change.
- Any familyRegistry edit.

### Files to inspect first

- The shared scoping audit (filename references J but content covers I).
- [supabase/functions/_shared/booleanObservations/familyRegistry.ts](supabase/functions/_shared/booleanObservations/familyRegistry.ts).
- The booleanObservationRequestBuilder.

### Dependencies

- **Hard: MCP-HIJ-LEDGER-000 in `main`.** Cannot start without it. For Family I the dominant axis hypothesis is **source-context** (whether the classifier input carries enough thread state), but that is unconfirmed; the ledger pins it. Without the per-axis classification, this scoping card overfits and produces gate debt.

### Blockers

- The ledger's I-axis classification is `unknown` or `multiple`. HALT and request a sharper ledger.

### Acceptance criteria

- [ ] Design doc exists.
- [ ] Required thread context listed.
- [ ] Current-input-shape sufficiency answered yes/no with `file:line` evidence.
- [ ] UI consumers identified.
- [ ] Blocker list present.

### Test plan

See acceptance criteria.

### Governance & safety

- Same as MCP-H-SCOPE-001.

---

## Card MCP-J-SCOPE-001 — Family J (sensitive_composer) scoping

**Priority:** P2
**Status:** Proposed
**Epic:** Classifier Observation / Family J
**Estimate:** M (design doc only)
**Slug:** `mcp-family-j-scope-design`
**Branch on spawn:** `docs/MCP-J-SCOPE-001-mcp-family-j-scope-design`

### Problem statement

Family J (`sensitive_composer`) is composer-only (the operator framing says so) and the scoping audit raises the "must not read as allegation" doctrine risk. The card produces the design doc that nails down:

- Is J composer-only? (i.e., it runs on draft text before the submit-argument acceptance gate? — but the acceptance-gate invariant says classifiers NEVER block submission. So composer-only means *advisory* on draft, no blocking, no truth verdict.)
- Does J live in admin-only observation first, before any user-visible output?
- What is the doctrine framing — J's output must never read as "this user is being abusive"; it must only flag a *text feature*, never the person.

### User-visible outcome

After this card lands:

1. `docs/designs/MCP-J-SCOPE-001.md` is committed.
2. The "composer-only" question and the "admin-only observation first?" question are both answered with `file:line` evidence + a designer recommendation.
3. The "must not read as allegation" doctrine is named verbatim.
4. A blocker list ends the doc.

### Scope (in)

- Synthesis design only.
- Tests: `__tests__/mcpJScopeShape.test.ts`.

### Scope (out — non-goals)

- Any code change.
- Any familyRegistry edit.
- Any composer UI change.

### Files to inspect first

- The scoping audit.
- The cdiscourse-doctrine skill on AI moderation hard rules.
- [supabase/functions/_shared/booleanObservations/familyRegistry.ts](supabase/functions/_shared/booleanObservations/familyRegistry.ts).

### Dependencies

- **Hard: MCP-HIJ-LEDGER-000 in `main`.** Cannot start without it. For Family J the dominant axis hypothesis is **doctrine framing** (the "must not read as allegation" risk crosses the UI consumer axis AND the prompt axis), so the ledger's classification is especially important here. Without it, this scoping card risks recommending a UI surface that violates the AI-moderation hard rules.

### Blockers

- The ledger's J-axis classification is `unknown` or `multiple`. HALT and request a sharper ledger.

### Acceptance criteria

- [ ] Design doc exists.
- [ ] Composer-only question answered.
- [ ] Admin-only-observation-first question answered.
- [ ] Doctrine "must not read as allegation" stated verbatim.
- [ ] Blocker list present.

### Test plan

See acceptance criteria.

### Governance & safety

- Same as MCP-H-SCOPE-001.

---

# Phase 6 — Supporting infrastructure (P2)

---

## Card OPS-MCP-HEALTH-002 — Admin classifier health panel (consumes `failure_detail` jsonb)

**Priority:** P2
**Status:** Proposed
**Epic:** Admin Operations / Classifier Observability
**Estimate:** L (new admin tab + new admin-users action + RLS read + reasonably-rich UI)
**Slug:** `admin-classifier-health-panel`
**Branch on spawn:** `feat/OPS-MCP-HEALTH-002-admin-classifier-health-panel`

### Problem statement

Migration `20260602000001_ops_mcp_classifier_failure_detail.sql` added `failure_detail jsonb` to `argument_machine_observation_runs` specifically so failure triage stops requiring Deno log pulls. The Stage-1 5% prompt in `next-prompts.md` cites it: "Classify every residual from failure_detail (PR #432), not Deno logs." The structured field exists, but there is no admin surface that consumes it. Operators currently have to query the DB by hand. This card builds the admin health panel that turns `failure_detail` into a triage view.

### User-visible outcome

After this card lands:

1. Admin > Classifier Health is a new tab.
2. It aggregates `argument_machine_observation_runs` over the last N (configurable: 1h / 24h / 7d) and shows: per-family success rate, per-family failure reasons (with `failure_reason / failure_sub_reason / failure_detail.reason` faceted), dead-letter rate, recent rows.
3. There is an explicit "H/I/J leakage" indicator that shows the row count for H/I/J — should always be 0; non-zero is a red alert.
4. RunTag filter (corpus runs scoping).
5. CSV export of *metadata only* — never the body, evidence_span, prompt, response.

### Scope (in)

- New Edge Function action under `admin-users` (or a new `admin-classifier-health` Edge Function if the existing handler is too narrow): `get_classifier_health(window: '1h' | '24h' | '7d', runTag?: string)` returning aggregates only.
- The handler uses the service-role client to query `argument_machine_observation_runs` aggregates — never selects body / evidence_span / prompt / response columns.
- New admin tab `AdminClassifierHealthTab.tsx`.
- CSV export client-side from the aggregates already returned.
- Tests for the schema, the handler shape, the UI, the CSV leak-safe contract.

### Scope (out — non-goals)

- Re-triggering classification from the panel. The panel is read-only.
- Per-argument drill-in that shows raw bodies. Aggregates only.
- A separate admin-only family-status flip surface.
- Anything that lights up H/I/J.

### Files to inspect first

- [supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql](supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql).
- [supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql](supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql).
- [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts).
- [src/features/admin/AdminScreen.tsx](src/features/admin/AdminScreen.tsx).

### Dependencies

- Soft: INACTIVE-001 may share admin-users handler patterns.
- Soft: PHASE7-OBSERVATION-001 sharpens the SQL shape.

### Blockers

- The handler must never select the body / evidence_span / prompt / response. Designer states the column-list explicitly.

### Acceptance criteria

- [ ] New admin tab visible to admins only.
- [ ] Aggregates render for 1h / 24h / 7d.
- [ ] runTag filter works.
- [ ] H/I/J leakage indicator visible.
- [ ] CSV export contains metadata only — body / evidence_span / prompt / response are never present.
- [ ] Tests cover the leak-safe contract + the aggregate shapes.
- [ ] Typecheck + lint clean.

### Test plan

See acceptance criteria.

### Governance & safety

- **Stage gates:** GATE A → GATE B → GATE C (operator-only merge if the PR touches `supabase/functions/**`; otherwise autonomous green squash-merge under §5).
- **HALT triggers:** any column selected that exposes body / evidence_span / prompt / response; any UI control that would re-trigger classification.
- **Never-self-approve (§4):** no deploy, no migration, no service-role from client.
- **Merge = deploy?** **Yes**, if the PR touches `supabase/functions/**`. Operator-gated.
- **Boundary line (verbatim, tailored):** *NO Anthropic / xAI / X API call by Claude. NO Supabase write beyond reading aggregates via service-role on the Edge Function side. NO direct insert into public.arguments. NO body / evidence_span / prompt / response selected in any SQL. NO classifier re-trigger. NO H/I/J productionEnabled flip. NO routing arm.*

---

## Card CORPUS-30-REVIEW-001 — Human review board for the 30 debates (UX feedback workflow)

**Priority:** P2
**Status:** Proposed
**Epic:** UX / Product Feedback
**Estimate:** S (docs-only workflow card; no code)
**Slug:** `corpus-30-human-review-board`
**Branch on spawn:** `docs/CORPUS-30-REVIEW-001-corpus-30-human-review-board`

### Problem statement

The corpus is product evidence; turning it into product feedback requires a manual review pass. This card creates the workflow + the docs scaffold for the operator (or a designated reviewer) to mark each of the 30 debates with a category and notes, then surface the findings as UX / planner / classifier / admin / doctrine follow-ups.

### User-visible outcome

After this card lands:

1. `docs/testing-runs/2026-06-03-corpus-30-human-review.md` is committed with a scaffold table: one row per debate, columns `debate_id` (shortened), `useful | repetitive | confusing | hostile-but-converted | label-helpful | label-noisy | notes`.
2. ≥ 10 of the 30 debates have been manually reviewed and categorized (operator action; Claude prepares the table and applies leak-safe scans afterward).
3. Each flagged issue maps to one of five buckets (UX / planner-rendering / classifier / admin-tooling / doctrine).
4. No raw hostile content in the committed doc — use shortened ids + neutral descriptions.

### Scope (in)

- Author the review scaffold doc.
- Apply the leak-safe scan (no X handles, no URLs, no secrets, no verdict tokens about a user).
- Operator fills in at least 10 rows.
- Claude consolidates findings into the five buckets and lists candidate follow-up cards.

### Scope (out — non-goals)

- Implementing any of the follow-ups (separate cards).
- Reviewing all 30 — 10 is the floor; the operator decides depth.
- Storing raw bodies in the review doc — only shortened ids + neutral category labels.

### Files to inspect first

- The CORPUS-30-RUN-COMMIT-001 markdown.
- The CORPUS-30-RESULTS-001 report.

### Dependencies

- Hard: CORPUS-30-RUN-COMMIT-001.
- Soft: CORPUS-30-RESULTS-001.

### Blockers

- Operator review bandwidth.

### Acceptance criteria

- [ ] Review doc exists with a 30-row table.
- [ ] ≥ 10 rows have operator notes.
- [ ] Five-bucket categorization complete for those 10.
- [ ] Candidate follow-ups listed with one-line summaries.
- [ ] Leak-safe scans green.

### Test plan

- `__tests__/corpus30HumanReviewLeakage.test.ts` — secrets, X handles, URLs, post IDs, emails, verdict tokens about users — zero matches.

### Governance & safety

- Same as the other docs-only cards. Autonomous green squash-merge permitted under §5.

---

## 3. Appendix A — Quick-reference table (for `spawn-card.ps1` / GH issue creation)

| Order | Card code | Priority | Estimate | Merge = deploy? | Migration? | Edge Function? | Auto-merge eligible? |
|---|---|---|---|---|---|---|---|
| 1 | ADMIN-MCP-001 | P0 | S–M | **Conditional** — Yes if any tightening lands under `supabase/functions/**` (Layers 4/5/6); No if only `src/**` (Layers 1/2/3/7) | No | **Possibly** (only if Layer 4/5/6 audit finds tightening needed) | Yes ONLY if every layer audits clean and tightening stays in `src/**` |
| 2 | ADMIN-ARGS-CANONICAL-001 | P0 | L | No | No | No | Yes |
| 3 | ADMIN-ARGS-INACTIVE-001 | P0 | L | **Yes** | **Yes** | **Yes** | **No — operator-only merge** |
| 4 | CORPUS-30-RUN-COMMIT-001 | P1 | S | No | No | No | Yes |
| 5 | CORPUS-30-PHASE7-OBSERVATION-001 | P1 | M | No | No | No | Yes (after operator pastes verdicts) |
| 6 | CORPUS-30-RESULTS-001 | P1 | M | No | No | No | Yes |
| 7 | CORPUS-30-QUALITY-001 | P1 | M | No | No | No | Yes |
| 8 | CORPUS-30-DIVERSITY-001 | P1 | M | No | No | No | Yes |
| 9 | ADMIN-ARGS-USABILITY-001 | P1 | M | No | No | No | Yes |
| 10 | MCP-HIJ-LEDGER-000 | P2 | M | No | No | No | Yes |
| 11 | MCP-H-SCOPE-001 | P2 | M | No | No | No | Yes |
| 12 | MCP-I-SCOPE-001 | P2 | M | No | No | No | Yes |
| 13 | MCP-J-SCOPE-001 | P2 | M | No | No | No | Yes |
| 14 | OPS-MCP-HEALTH-002 | P2 | L | **Yes** (Edge Function) | No | **Yes** | **No — operator-only merge** |
| 15 | CORPUS-30-REVIEW-001 | P2 | S | No | No | No | Yes |

## 4. Appendix B — Cross-card boundary invariants (apply to every card)

- The acceptance-gate invariant: AI/MCP classifiers NEVER block submission. `submit-argument` is the gate; classifiers run after store via the auto-trigger path. No card may change this.
- No H/I/J `productionEnabled` flip.
- No classifier-queue routing arm.
- No percentage-ramp authorization (Stage 1, 5%, 25%, 50%, 100% — each is a separate, future operator card).
- No edit of an applied migration.
- No direct `public.arguments` insert from Claude.
- No mass delete of any table.
- No `.env*` write.
- No secret printed in any committed file, chat, log, or PR body.
- No provider spend (Anthropic / xAI / X / live MCP smoke beyond the operator-authorized ADMIN-MCP-001 burst).
- No deploy by Claude (Supabase Edge / migrations / Deno Deploy / `mcp-server/`).
- Provider spend = operator. Claude prepares the harness; the operator triggers it.

## 5. Appendix C — Open questions for the operator at GATE A

These accumulate from the individual cards. The spawn pass surfaces them once, the operator answers once, the agents proceed.

1. **CORPUS-30-RUN-COMMIT-001** — is the runner's markdown summary still available locally? If not, is the JSONL available so the spawned agent can synthesize the markdown?
2. **CORPUS-30-PHASE7-OBSERVATION-001** — has the runTag been persisted onto `debates.run_tag` (or any joinable surface)? If not, queries will scope by `created_at` window instead, weaker but functional.
3. **CORPUS-30-RESULTS-001** — has a manual UI walkthrough of Admin > Arguments and the main user Arguments tab been done? If not, that section ships as `pending` and re-opens.
4. **ADMIN-ARGS-CANONICAL-001** — does the operator want the schema spike's preferred grouping key recorded in the design before the implementer begins, even if it means an extra GATE-A round? (Default: yes.)
5. **ADMIN-ARGS-INACTIVE-001** — for the RLS shape, does the operator prefer (a) additive policy that supersedes the existing one, or (b) a wholly new policy with an `OR (is_admin AND inactive_at IS NOT NULL)` clause? The designer recommends; operator confirms.
6. **ADMIN-MCP-001** — for the smoke, does the operator want the Deno Deploy log line evidence to be a screenshot (no token in it) or a copy-pasted excerpt with the token field redacted? Default: copy-paste, token redacted to `Bearer <redacted>`.

---

**End of backlog.**

This document is operator-ratifiable as-is. Each card is ready to spawn via `.claude/scripts/spawn-card.ps1 <CARD-CODE>` once the operator has answered the six open questions at the top of Appendix C.
