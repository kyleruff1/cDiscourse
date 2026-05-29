# MCP-SERVER-008-FAMILY-G — Intent brief (Card 1 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-29
**Card type:** MCP-server family ship — `resolution_progress` (Family G), admin_validation-only Edge posture. Doctrine-heavy (resolution↔verdict adjacency).
**Suite:** Card 1 (admin ship) → Gate A (doctrine-risk determination) → Card 2 (CONDITIONAL: L5 mechanization) → Gate B → Card 3 (production-enable + latency re-measure).
**Predecessor (verified Phase 0):** main at `9837fdf` (OPS-MCP-LATENCY-BUDGET smoke PARTIAL). A–F production + auto-trigger; G/H/I/J unsupported on the MCP server.

> Operator Phase 0 findings (§ Phase 0) are guidance to scope this card and anticipate Stage 2B; the designer's 5 Phase-A audits MUST independently confirm them. **A.1 is the gating output: is `resolution_progress` doctrine-risk?** (assumed-YES; see §Doctrine).

---

## 1. Goal

Ship Family G (`resolution_progress`) on the hosted MCP server with an **admin_validation-only** Edge posture (production flip is Card 3). Mirror the Family F pattern (`mcp-server/lib/familyF*.ts` + 5-layer doctrine defense). The doctrine peril is acute and structural: `resolution_progress` keys (concession, synthesis, common-ground, settlement, resolved/archived) are **semantically adjacent to "who is winning / losing / conceding / won the point"** — exactly the verdict-framing the no-verdict doctrine forbids. G's classifier must surface **descriptive convergence-state**, never a verdict.

---

## 2. Phase 0 findings (designer to confirm)

- **G source** (`src/features/nodeLabels/machineObservationDefinitions/familyG.ts`): **29 keys, the largest MCP-021A family, MIXED source provenance** — `auto_metadata` (5: branch_suggested, branch_created, point_stalled, point_exhausted, synthesis_candidate), `lifecycle` (7: narrowed, conceded, confirmed, synthesis_ready, exhausted, branch_recommended, archived_or_resolved), `ai_classifier` (the rest, ~17–18 incl. the 9 NEW keys: concedes_broader_point, common_ground_identified, unresolved_point_isolated, synthesis_proposed, move_on_requested, issue_closed_by_participant, decision_criterion_proposed, action_item_proposed, followup_question_proposed).
- **MCP-server scope:** the LLM boolean classifier handles the **`ai_classifier`-source subset only** (text-derivable). auto_metadata + lifecycle keys are system/cluster-derived and are NOT LLM-classified — **exactly the Family D precedent** (`familyDKeys.ts` = "19 ai_classifier-subset rawKeys … per Stage 2B operator binding decision"; E and F were uniform ai_classifier so needed no subset). So `familyGKeys.ts` = G's ai_classifier subset; the designer enumerates the exact key list in A.1.
- **familyG* MCP-server files do NOT exist** → Card 1 creates `familyGKeys.ts`, `familyGPrompt.ts`, `familyGAnthropic.ts`, `familyGBanListScan.ts`, `familyGFixtureProvider.ts` + one `register('resolution_progress', {...})` call in `familyRegistryInit.ts` + dispatcher routing (registry-derived; no dispatcher edit) + fixtures + tests + smoke +2 checks.
- **Edge `familyRegistry.ts` G entry ALREADY EXISTS**: `{ family: 'resolution_progress', productionEnabled: false, adminValidationEnabled: true }` (lines ~100–103). **D6 is pre-satisfied** — Card 1 makes NO Edge registry change (verify byte-equal); Card 3 flips `productionEnabled`.

---

## 3. Doctrine — resolution↔verdict (the existential concern)

**Doctrine-risk: ASSUMED-YES** (A.1 confirms or refutes with reasoning). Evidence: every `doctrineNotes` block in `familyG.ts` emphatically repeats the anti-verdict guard — "concession is a SCORING REPAIR, not a loss"; "never framed as 'this side lost'"; "synthesis is a GAMEPLAY move, not a verdict about who 'won'. Both sides retain standing"; "broad concession is RELINQUISHMENT … NEVER framed as 'this side lost'." The keys (`conceded`, `concedes_broader_point`, `synthesis_proposed`, `common_ground_identified`, `archived_or_resolved`, settlement keys) sit in the verdict neighborhood. This is the most acute doctrine risk in the track to date.

- **DESCRIPTIVE (clean):** "are the parties converging on shared understanding? is a narrow point conceded while the broad claim stands? is a synthesis proposed?"
- **VERDICT (violation):** "who is ahead / behind / won / lost / conceded-and-therefore-lost / settled-in-X's-favor?"

If A.1 proves G is purely descriptive convergence-state with NO verdict adjacency, Card 2 is SKIPPED (2-card chain). Given the keys, that outcome is unlikely.

---

## 4. Autonomy — Stage 2B (anticipated MANDATORY)

Five complexity triggers (A.1 evaluates):
- **T1 mixed source provenance** — **anticipated TRUE** (auto_metadata + lifecycle + ai_classifier). → ai_classifier-subset decision (mirror Family D). Stage 2B MANDATORY.
- **T3 doctrine-risk framing** — **anticipated TRUE** (resolution↔verdict). → doctrine prompt-structure decision (how G detects resolution-state WITHOUT verdict-framing; mirror Family F's 5-layer defense). Stage 2B MANDATORY.
- T2 compound rawKey collision / T4 MAX_TOKENS bump / T5 dependency on prior-family outputs — A.1 evaluates; G's classifier should be self-contained on the argument text + parent context (not reading A–F outputs), so T5 likely false.

Designer MUST state explicitly: **"Stage 2B REQUIRED because T1+T3"** (anticipated) **| NOT REQUIRED**. If REQUIRED, Stage 2 surfaces an operator-decision (the ai_classifier-subset confirmation + the descriptive-convergence prompt structure) before the implementer starts.

---

## 5. Binding decisions (D1–D13)

D1. Replicate the Family F pattern: `familyGKeys.ts` (ai_classifier subset), `familyGPrompt.ts`, `familyGAnthropic.ts`, `familyGBanListScan.ts`, `familyGFixtureProvider.ts`; `register('resolution_progress', …)`; dispatcher routing (registry-derived, no edit); fixtures; smoke +2 checks (tally 19→21); familyG tests.
D2. Phase A.1 verbatim source verification + Stage 2B determination + **the gating doctrine-risk yes/no with reasoning**. Per rawKey: flag verdict-adjacency.
D3. **Resolution↔verdict doctrine binding (BINDING if doctrine-risk, regardless of Stage 2B):** G prompt frames keys as DESCRIPTIVE convergence-state; never implies winner/loser/concession-as-defeat/settled-in-favor; per-key `falsePositiveGuards` on the most verdict-adjacent keys (the `conceded`/`concedes_broader_point` axis — G's analog to E's `slippery_slope` / F's `consequence_probability_unclear`); a header CRITICAL-DOCTRINE block forbidding verdict framing for resolution-state (mirror `familyFPrompt.ts`).
D4. Mandatory adversarial fixtures (3–5) targeting the resolution↔verdict boundary: (a) a disagreement where one side has the objectively stronger position → G output stays descriptive ("narrow point conceded; broad claim stands"), NOT "X winning"; (b) a resolved disagreement → "converged on shared understanding / synthesis proposed", NOT "X won"; (c) a stalemate → descriptive, no verdict; (d) a concession → "scoring repair", NOT "defeat".
D5. `familyGBanListScan.ts` extends the shared `DOCTRINE_BAN_PATTERNS` with **resolution-verdict tokens**: won, lost, winner, loser, conceded(-as-loss framing), defeated, prevailed, "settled in favor", ahead, behind, capitulated, "X won the argument". Scans `evidence_span`, modelInfo, content[text]. (G adds its OWN scan; the shared `doctrineBanList.ts` is NOT edited.)
D6. Edge admin_validation-only — **pre-satisfied** (G registry entry already adminValidationEnabled=true, productionEnabled=false). Verify byte-equal; Card 3 flips it.
D7. Subset filter (the ai_classifier-keys subset) per A.1 T1 + Stage 2B approval (mirror Family D).
D8. Token budget per A.1 T4 (G is the largest family; A.2 confirms the prompt fits the family-standard budget or surfaces a bump as Stage 2B).
D9. Smoke +2 checks: `[20-compat-boolean-family-g]` + `[21-mcp-tools-call-boolean-family-g]`. Tally 21.
D10. Smoke template carries `Audit-Lint: v1`.
D11. Smoke audit local pre-lint before push (`node scripts/ops/audit-lint.mjs <audit>` exit 0).
D12. Enforcement-loop provenance subsection in the smoke audit (Phase 7): CI run ID + in_scope count + linter exit for G's smoke PR.
D13. **CONSISTENT-PARTIAL DISCIPLINE (banked from the F→Card-2 interaction):** if Card 1's smoke is PARTIAL (token-gated phases NOT-RUN), the audit MUST name its deferred Phase 4b `evidence_span` obligation IN INSPECTION-PATTERN LANGUAGE (e.g. "the live adversarial persisted `evidence_span` inspection is deferred to the amendment"). Card 2 will add `family_g` to `DOCTRINE_RISK_FAMILIES`, after which the verdict-blind `applyL5` re-evaluates Card 1's marked smoke audit on its next CI lint — it passes-as-PARTIAL ONLY if it mentions `evidence_span` as the deferred obligation (exactly how the real F PARTIAL audit survived the F data-change). Omitting this language would retroactively fail Card 1's smoke audit.

---

## 6. Out of scope

- Family H/I/J registration (this card ships ONLY G).
- Production flip (Card 3); any `productionEnabled` change.
- Editing the shared `doctrineBanList.ts` (G adds its own scan).
- Family A–F lib changes (must stay byte-equal).
- `src/` taxonomy / other family prompts / dispatcher hard-coding / MCP schema version / token bump without Stage 2B.
- The Edge `familyRegistry.ts` (G entry already correct; no change).

---

## 7. HALT triggers (26)

Per this operator card's enumeration (registry+batch 1–7; protocol+security 8–13; architecture 14–16; doctrine-G-specific 17–23; enforcement-loop 24–25; working-tree 26). The **doctrine core** is 17–18 (prompt frames resolution as a verdict on who is winning/won — EXISTENTIAL) and 21–22 (Phase 4b adversarial evidence_span inspection missing; doctrinal-axis partner key lacks a guard). The **enforcement core** is 24–25 (marker; local pre-lint). Cross-family core: 4 (A–F byte-equal). Architecture core: 14 (Stage 2B REQUIRED but operator approval missing when implementer starts).

---

## 8. Test forecast

**+90 to +180** (HALT ceiling **+220**). The Family E/F doctrine-heavy baseline (familyKeys + prompt + anthropic + adversarial-doctrine + ban-list-scan + fixture-parity test suites), NOT a license for bloat. G is the largest family (~17–18 classified keys) so the per-key test surface is larger than E/F.

---

## 9. Smoke plan (8-phase, post-merge)

Audit: `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (`Audit-Lint: v1`; self-lints clean).
1. Pre-flight (HEAD; Edge deploy; G admin-only posture).
2. Local Deno regression (baseline + G suite).
3. Hosted MCP smoke (21 checks; operator token). NOT-RUN caps verdict at PARTIAL (L1).
4. Edge admin_validation (Family G; 3 seeded args).
4b. **DOCTRINE (BINDING if doctrine-risk; the L5 obligation):** submit adversarial fixtures via submit-argument (fires the 6-family production auto-trigger A–F as a documented side effect); admin_validation `requestedFamilies=['resolution_progress']`; query persisted `evidence_span`; for each G positive, evidence_span MUST NOT contain a resolution-verdict token (D5); the stronger-position fixture MUST NOT be labeled "winning". Asymmetric: ≥1 clean → PASS; 0-fire → PARTIAL (do not authorize G production); ≥1 dirty → FAIL.
5. Unsupported H/I/J rejection regression (3 still-unsupported).
6. Targeted Jest + Deno regression.
7. OPS observations + enforcement-loop provenance (D12) + 7-family operational state (A–F production; G admin new).
8. Verdict + authorization.
Pre-push: `node scripts/ops/audit-lint.mjs <audit>` exit 0 (D11; D13 language if PARTIAL).
**Amendment path** (E/F precedent): if PARTIAL due to token-gated NOT-RUN phases, the operator runs hosted Phase 3 (19→21/21) + live Phase 4/4b/5 (canary-first; gated Anthropic spend; no JWTs logged; no out/ committed); the amendment lifts PARTIAL→PASS with full L6 provenance. The amendment is its own marked, self-linting doc.

---

## 10. Ledger

| Item | Value |
| --- | --- |
| Card | MCP-SERVER-008-FAMILY-G (Card 1 of 3) |
| Builds | MCP-server familyG classifier (ai_classifier subset, admin-only) |
| G source | 29 keys, mixed source; MCP subset = ai_classifier (~17–18) |
| Edge registry | G already admin-only (productionEnabled=false) — no change |
| Doctrine-risk | ASSUMED-YES (designer A.1 confirms) → Card 2 likely runs |
| Stage 2B | anticipated MANDATORY (T1 subset + T3 doctrine) |
| Forecast | +90 to +180 (HALT +220) |
| Production flip | NONE (Card 3) |
| Anthropic call | only via gated live smoke (Phase 4b / amendment), canary-first |
| Gate after | Gate A (records doctrine-risk determination) |

Card 1 ships G to admin_validation under resolution↔verdict doctrine discipline and determines (A.1) whether G is doctrine-risk — the gating decision for whether Card 2 runs.
