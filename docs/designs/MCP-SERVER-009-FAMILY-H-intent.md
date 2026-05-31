# MCP-SERVER-009-FAMILY-H — Intent brief (Card 1 of 3-card suite)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** MCP-server family ship — `claim_clarity` (Family H), admin_validation-only Edge posture. Doctrine-heavy (clarity↔verdict adjacency).
**Suite:** Card 1 (admin ship) → Gate A (doctrine-risk determination) → Card 2 (CONDITIONAL: L5 mechanization for `family_h`) → Gate B → Card 3 (production-enable + observability backfill).
**Predecessor (verified Phase 0):** main at `b974b25` (ARCH-001 Card 3 smoke PASS). A–G production + auto-trigger live; H/I/J unsupported on the MCP server.
**Trail:** Umbrella issue #388. Card issue #389.

> Operator Phase 0 findings (§ Phase 0) are guidance to scope this card and anticipate Stage 2B; the designer's 5 Phase-A audits MUST independently confirm them. **A.1 is the gating output: is `claim_clarity` doctrine-risk?** (assumed-YES per the H spec extraction in OPS-WORKFLOW-RESTORATION Phase 1; see §Doctrine).

---

## 1. Goal

Ship Family H (`claim_clarity`) on the hosted MCP server with an **admin_validation-only** Edge posture (production flip is Card 3). Mirror the Family G pattern (`mcp-server/lib/familyG*.ts` + 5-layer doctrine defense). The doctrine peril is that `claim_clarity` keys (conclusion_missing / reason_missing / claim_specificity_low / unclear_reference_present) sit one step from "the speaker is wrong" — exactly the verdict-framing the no-verdict doctrine forbids. H's classifier must surface **descriptive formulation-state**, never a verdict on truth or the speaker.

---

## 2. Phase 0 findings (designer to confirm)

- **H source** (`src/features/nodeLabels/machineObservationDefinitions/familyH.ts`): **12 keys, uniform `ai_classifier` source** (verified by OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.1). Verbatim keys: `provides_temporal_constraint`, `claim_present`, `reason_present`, `conclusion_missing`, `reason_missing`, `multiple_claims_present`, `claim_specificity_high`, `claim_specificity_low`, `quantifier_present`, `modal_language_present`, `hedging_present`, `unclear_reference_present`.
- **MCP-server scope:** the LLM boolean classifier handles **all 12 H keys** (no subset filter; uniform `ai_classifier` source, unlike Family G's mixed-source 17/29 subset).
- **familyH\* MCP-server files do NOT exist** → Card 1 creates `familyHKeys.ts`, `familyHPrompt.ts`, `familyHAnthropic.ts`, `familyHBanListScan.ts`, `familyHFixtureProvider.ts` + one `register('claim_clarity', {...})` call in `familyRegistryInit.ts` + dispatcher routing (registry-derived per the post–B/C-enable pattern; no dispatcher edit) + fixtures + tests + smoke +2 checks.
- **Edge `familyRegistry.ts` H entry ALREADY EXISTS** [OPERATOR DECISION NEEDED: confirm by reading `supabase/functions/_shared/booleanObservations/familyRegistry.ts` and citing exact line numbers]: `{ family: 'claim_clarity', productionEnabled: false, adminValidationEnabled: true }` is the expected baseline. **D6 is pre-satisfied** — Card 1 makes NO Edge registry change (verify byte-equal); Card 3 flips `productionEnabled`.

---

## 3. Doctrine — clarity↔verdict (the existential concern)

**Doctrine-risk: ASSUMED-YES** (A.1 confirms or refutes with reasoning). Evidence: the H keys' descriptive surface ("conclusion_missing" / "reason_missing" / "claim_specificity_low" / "unclear_reference_present") sits in the verdict neighborhood — "unclear" reads as "wrong"; "missing" reads as "the speaker failed"; "low specificity" reads as "weak / vague / lazy". cdiscourse-doctrine §1 forbids exactly this drift. The keys are **STRUCTURAL OBSERVATIONS** about the claim's surface form, NEVER verdicts on truth, NEVER judgments on the speaker.

- **DESCRIPTIVE (clean):** "is a conclusion stated? is a reason attached? is the claim broadly or narrowly scoped? is a referent unclear?"
- **VERDICT (violation):** "the speaker failed to state a conclusion / wrote a bad argument / made a weak claim / was unclear and therefore wrong."

If A.1 proves H is purely descriptive formulation-state with NO verdict adjacency, Card 2 is SKIPPED (2-card chain). Given the 4 HIGH-risk keys, that outcome is unlikely.

**HIGH-risk keys identified in Phase 1** [OPERATOR DECISION NEEDED: confirm final list — Phase 1 flagged `conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`; designer A.1 produces the binding final list with per-key falsePositiveGuards]:
- `conclusion_missing` — "no conclusion stated" → "argument is incomplete" drift
- `reason_missing` — "no reason attached" → "argument is unsupported" drift
- `claim_specificity_low` — "broad" → "weak / vague / lazy" drift
- `unclear_reference_present` — "unclear pronoun" → speaker-judgment drift

---

## 4. Autonomy — Stage 2B (anticipated MANDATORY on T3 only)

Five complexity triggers (A.1 evaluates):
- **T1 mixed source provenance** — **FALSE** (uniform `ai_classifier`; no subset decision; Family D / G subset precedent does NOT apply). Stage 2B not required on this axis.
- **T2 compound rawKey collision** — assumed FALSE (per the cross-family rejection-test precedent; designer verifies in A.2).
- **T3 doctrine-risk framing** — **anticipated TRUE** (clarity↔verdict). → doctrine prompt-structure decision (how H detects formulation-state WITHOUT verdict-framing; mirror Family G's 5-layer defense). Stage 2B MANDATORY.
- **T4 MAX_TOKENS bump** — anticipated FALSE. Token math: 12 keys × ~85 tokens ≈ 1020 with ~480 headroom against the 1500 default. [OPERATOR DECISION NEEDED: confirm `FAMILY_H_MAX_TOKENS = 1500` or specify alternate value with token math].
- **T5 dependency on prior-family outputs** — FALSE (H's classifier reads argument text + parent context only; not A–G outputs).

Designer MUST state explicitly: **"Stage 2B REQUIRED because T3"** (anticipated) **| NOT REQUIRED**. If REQUIRED, Stage 2 surfaces the descriptive-formulation prompt structure as an operator-decision before the implementer starts.

---

## 5. Binding decisions (D1–D13)

**D1 — Source split is uniform `ai_classifier` (HALT 3 PASS).** All 12 keys carry `source: 'ai_classifier'`; no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry needed (HALT 13 inapplicable for H).

**D2 — Card 1 scope is admin_validation-only on the Edge.** Edge `familyRegistry.ts` `productionEnabled` stays `false` for H this card (Card 3 flips).

**D3 — 5-layer doctrine defense mirrors Family G structurally**, with H-specific tokens replacing G's resolution-related tokens:
1. System-prompt absolute rules (byte-equal to G except substitute claim-clarity guards).
2. Per-key `falsePositiveGuards` on the 4 HIGH-risk keys (verbatim "MUST NOT contain words like..." enumerations).
3. `FAMILY_H_BAN_PATTERNS` Family-H-LOCAL runtime scanner.
4. Adversarial fixtures targeting the clarity↔verdict boundary.
5. Phase 4b smoke verification on persisted `evidence_span` rows (L5 enforcement after Card B lands `family_h` in `DOCTRINE_RISK_FAMILIES`).

**D4 — `FAMILY_H_MAX_TOKENS = 1500`** [OPERATOR DECISION NEEDED: confirm; math: 12 × ~85 ≈ 1020 with 480 headroom; F shipped 14 keys at 1500 with 310 headroom; H is lighter].

**D5 — `FAMILY_H_BAN_PATTERNS` is Family-H-LOCAL (NOT promoted to shared `doctrineBanList.ts`).** Patterns target clarity-specific verdict-leak shapes (`weak`, `sloppy`, `lazy`, `careless`, `confused`, `unsound`, `unsupported`, `incoherent`, `illogical`, `bad reasoning`, `bad argument`, `bad writing`, `argument is incomplete|unsupported|weak|bad|failed`, `claim fails|is wrong|is weak|is bad`). Family-H-LOCAL because some "fail"/"wrong" wording legitimately appears in other family contexts. [OPERATOR DECISION NEEDED: confirm final pattern list].

**D6 — Edge `familyRegistry.ts` H entry is unchanged in this card.** Byte-equal preserved. Card 3 owns the flip.

**D7 — Cross-family rawKey collision is empty.** A.2 verifies H keys do not collide with A–G.

**D8 — `FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1'`** per the chain convention.

**D9 — Smoke template carries `Audit-Lint: v1` marker + required-final-step `node scripts/ops/audit-lint.mjs <doc>` instruction.** Phase 4b doctrine evidence_span inspection language MANDATORY because doctrine-risk = YES; Card B will retroactively re-lint this audit with L5 once `family_h` lands in `DOCTRINE_RISK_FAMILIES`.

**D10 — Card 2 (audit-lint) is BINDING ON Card 3 smoke posture, not on Card 1 ship.** Card 1 admin_validation smoke runs WITHOUT L5 enforcement; Card 2 mechanizes L5 for `family_h`; Card 3 production-enable smoke runs WITH L5 CI-mechanical.

**D11 — Test forecast: +110 to +160 net Deno tests + ~8 Jest tests** [OPERATOR DECISION NEEDED: confirm forecast range; designer A.5 provides binding number].

**D12 — Smoke script extension: 2 new checks** (`compat-boolean-family-h` + `mcp-tools-call-boolean-family-h`) mirroring G's checks 18+19. [OPERATOR DECISION NEEDED: confirm check IDs and slippery-slope-style adversarial fixture choice].

**D13 — Family-A/B/C/D/E/F/G lib byte-equal preserved** (HALT 4); shared `doctrineBanList.ts` byte-equal (HALT 5); `providerConcurrency.ts` MCP-cap=5 semaphore unchanged (HALT 5); `seedPrompt.ts` / `anthropicCall.ts` / `mcpBooleanObservationSchemaMirror.ts` byte-equal (HALT 5).

---

## 6. Test forecast (range, not exact)

[OPERATOR DECISION NEEDED: confirm — designer A.5 produces binding number]
- **Deno (mcp-server/tests):** +110 to +160 across familyHKeys + familyHKeysParity + familyHPrompt + familyHBanListScan + familyHAnthropic + familyHResponseValidator + familyHDispatch + familyHFixtureParity + familyHDoctrineFixtures + familyRegistryInit/familyRegistry/familyBooleanRequestSchema/classifyArgumentBooleanObservations updates.
- **Jest (Edge):** +6 to +10 in new `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` (productionEnabled=false guard at registration time; admin-only at the Edge gate).

HALT 8 ceiling: +250 net (well above forecast midpoint).

---

## 7. HALT triggers (numbered, binding)

[OPERATOR DECISION NEEDED: confirm full list — designer A.1 produces 20-24 triggers mirroring G's table]
1. **HALT 1** — Required-reading missing.
2. **HALT 2** — Standard preflight not green.
3. **HALT 3** — A.1 finds H source-split is NOT uniform `ai_classifier`.
4. **HALT 4** — A–G family files modified (byte-equal violation).
5. **HALT 5** — Protected surface modified (`seedPrompt.ts`, `anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts`, shared `doctrineBanList.ts`, `supabase/functions/_shared/booleanObservations/familyRegistry.ts`, `supabase/migrations/`, `package.json`, `src/features/nodeLabels/**`).
6. **HALT 6** — roadmap-reviewer returns BLOCK.
7. **HALT 7** — Any adversarial Explore finds blocking refutation.
8. **HALT 8** — Test delta out of bounds (Deno > +250 OR Jest > +12).
9. **HALT 9** — Cross-family rawKey collision found.
10. **HALT 10** — `FAMILY_H_MAX_TOKENS` bump above 2000 without explicit operator approval.
11. **HALT 11** — Smoke template lacks `Audit-Lint: v1` marker or required-final-step.
12. **HALT 12** — Smoke template Phase 4b doctrine `evidence_span` inspection language absent (D9 violation).
13. **HALT 13** — Edge `familyRegistry.ts` H entry changed (this card is admin-only).
14. Additional triggers TBD per designer A.1.

---

## 8. Hard guardrails

- NO migration; no taxonomy key (read-only upstream); no MCP schema version change; no `package.json` change.
- NO `mcp-server/lib/family[A-G]*.ts` change (HALT 4).
- NO production-mode auto-trigger inclusion for Family H (Card 3 territory).
- NO Edge Function code change beyond the Jest test file under `__tests__/`.
- NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry (HALT 13 — uniform `ai_classifier`).
- NO shared `doctrineBanList.ts` addition; Family-H-LOCAL ban patterns ONLY.
- NO `providerConcurrency.ts` change (MCP cap=5 invariant; HALT 5).

---

## 9. Process

1. **Designer** (roadmap-designer subagent) writes `docs/designs/MCP-SERVER-009-FAMILY-H.md` from this intent brief + reading the source-of-truth (`familyH.ts`) + Family G precedent.
2. **Implementer** (roadmap-implementer subagent) creates worktree on `feat/MCP-SERVER-009-family-h`, follows the design's file-change list, slice commits per OPS-004 cadence.
3. **Reviewer** (roadmap-reviewer subagent) writes `docs/reviews/MCP-SERVER-009-FAMILY-H.md` with APPROVE / CHANGES-REQUESTED / BLOCK.
4. Adversarial Explore × 3 (verdict-leak hunt, cross-family key collision, ban-list completeness) after reviewer APPROVE.
5. **PR open + HARD STOP at operator merge gate.**
6. Operator merges, runs MCP-SERVER-009-FAMILY-H smoke, authors `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-<date>.md` with PASS verdict.
7. Smoke PASS unblocks Card 2 (audit-lint L5 mechanization for `family_h`).

---

## 10. Post-merge smoke skeleton (phases, not SQL)

Per the F/G smoke template precedent:

- **Phase 0** — pre-flight (function list, secrets-list-by-name, registry confirm)
- **Phase 1** — server registry confirms H registered + 12 keys
- **Phase 2** — admin_validation dispatch path includes H
- **Phase 3** — Hosted MCP `compat-boolean-family-h` POSTs H request against canonical input; `family-h-v1` in `modelInfo.classifierSetVersion`
- **Phase 4** — Hosted MCP `mcp-tools-call-boolean-family-h` covers tool-call surface
- **Phase 4b** — DOCTRINE: persisted `evidence_span` scan on admin_validation H rows; 0 banned verdict tokens
- **Phase 5** — Edge `familyRegistry.ts` confirms H is `productionEnabled=false adminValidationEnabled=true`
- **Phase 6** — Adversarial: try to elicit verdict-framing from the 4 HIGH-risk H keys via adversarial input fixtures; verify ban-list scanner catches; verify per-key `falsePositiveGuards` hold
- **Phase 7** — Observability + audit-lint marker present + verdict line

Smoke verdict authority: PASS (unblocks Card 2) | PARTIAL (chain pauses; operator decides fix-forward vs scope re-design) | FAIL (chain stops; HALT 9 per chain prompt).

---

## Markers summary ([OPERATOR DECISION NEEDED] count: ~10)

- Trail issue # (header + #4)
- Edge familyRegistry.ts H entry line numbers (#2)
- HIGH-risk keys final list (#3)
- `FAMILY_H_MAX_TOKENS` final value (#4 D4)
- `FAMILY_H_BAN_PATTERNS` final pattern list (#5 D5)
- Test forecast binding number (#6, D11)
- Smoke script check IDs + adversarial fixture choice (#5 D12)
- HALT trigger full list (#7)
- Stage 2B explicit declaration (#4)
- Audit-lint L5 retroactive re-lint posture (#5 D9)
