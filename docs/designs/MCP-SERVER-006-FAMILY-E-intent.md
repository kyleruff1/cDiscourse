# MCP-SERVER-006-FAMILY-E — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** MCP server family rollout
**Card position:** Card 3 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain
**Predecessor chain on main:**
- `MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE PASS` at `2abb6b0` (Card 2 of this chain)
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE PASS` at `9b040be` (Card 1 of this chain)
- All preceding MCP cards (FAMILY-D ship + fix; FAMILY-C; FAMILY-B; FAMILY-A; OPS-MCP-*; etc.)

---

## 1. Family E scope

Family E (`argument_scheme`) — Walton (1995, 2008) argumentation schemes.

Per Phase 0 live verification of `src/features/nodeLabels/machineObservationDefinitions/familyE.ts`:
- **16 rawKeys** (matches inspection report; matches launch text)
- **ALL `source: 'ai_classifier'`** via shared `buildScheme(b)` factory; no auto_metadata or lifecycle entries
- **ALL `defaultSurface: 'inspect'`** (no timeline_node)
- **ALL `disposition: 'future_source'`**
- **ALL `family: 'argument_scheme'`** (no compound-key collision)
- **0 retroactive keys; all new**

The 16 keys (in source order):

1. `causal_reasoning_present`
2. `analogy_reasoning_present`
3. `example_reasoning_present`
4. `authority_reasoning_present`
5. `consequence_reasoning_present`
6. `principle_reasoning_present`
7. `definition_reasoning_present`
8. `classification_reasoning_present`
9. `precedent_reasoning_present`
10. `means_end_reasoning_present`
11. `tradeoff_reasoning_present`
12. `abductive_explanation_present`
13. `exception_reasoning_present`
14. **`slippery_slope_reasoning_present`** ← doctrine-load-bearing
15. `cost_benefit_reasoning_present`
16. `risk_reasoning_present`

Family E ships admin_validation-only (mirroring B/C/D initial ship pattern). Production flip + auto-trigger inclusion deferred to a future card.

---

## 2. Stage 2B determination

Per launch Decision 2: Stage 2B is CONDITIONAL — mandatory ONLY if designer Phase A surfaces subset/source-mix complexity.

Phase 0 evidence (verified live):
- Uniform `ai_classifier` source → NO subset filter needed
- No compound-key collision → no schema change needed
- 16 keys ≈ Family A's 16 (which fits MAX_TOKENS=1500) → MAX_TOKENS=1500 likely fits (designer Phase A.2 confirms)

**Designer Phase A.1 MUST explicitly state in the design doc:** "Stage 2B: NOT REQUIRED — Family E is uniform ai_classifier, fits MAX_TOKENS=1500" OR "Stage 2B: REQUIRED — <reason>".

Default expectation (per launch + Phase 0 inventory): **NO Stage 2B required.**

---

## 3. BINDING doctrine: slippery_slope guard (Decision 3)

The Family E source file header at `src/features/nodeLabels/machineObservationDefinitions/familyE.ts:1-22` already documents the doctrine binding:

> "copy NEVER labels a scheme a 'fallacy' even when its critical question (Family F) is unmet. Schemes are descriptive shape facts. The critical-question framing is what keeps Family E + F safe."

The Family E MCP server prompt MUST:
- Frame ALL 16 schemes as descriptive inferential patterns
- Frame `slippery_slope_reasoning_present` as "this move uses a slippery-slope inference pattern" — NEVER as "this move commits the slippery-slope fallacy"
- Carry an explicit per-key guard on slippery_slope mirroring Family C/D's per-key guard pattern (familyCKeys.ts:212; familyDKeys.ts doctrine guards)

This is the existential doctrine constraint of Card 3.

---

## 4. Mandatory adversarial slippery_slope fixtures (Decision 4)

Card 3 ships with 3-5 fixtures targeting slippery_slope:
- A fixture with clear slippery-slope reasoning text (expected positive)
- The expected positive: `slippery_slope_reasoning_present=true`
- Doctrine assertion: evidence_span + model output contain NO fallacy/weak/invalid/bad-reasoning/verdict tokens
- Adversarial framing: the fixture text may contain "fallacy" (in the argument being classified); the classifier must detect the scheme without echoing fallacy-framing in its OWN output

---

## 5. Ban-list scan extension (Decision 5)

`familyEBanListScan.ts` extends the shared `DOCTRINE_BAN_PATTERNS` with slippery_slope-specific verdict tokens:
- `"fallacy"`, `"fallacious"`
- `"weak argument"`, `"invalid argument"`
- `"bad reasoning"`, `"flawed reasoning"`
- `"logical error"`, `"informal fallacy"`

The scan applies to `evidence_span` AND any model output strings.

---

## 6. Subset filter: NOT needed (Decision 8)

Per Phase 0 + Decision 8 of launch: Family E is uniform ai_classifier. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` does NOT need an E entry — all 16 keys are MCP-routed naturally.

If designer Phase A surfaces a mixed-source finding (extremely unlikely per Phase 0), that becomes a Stage 2B trigger.

---

## 7. Token budget: fits 1500 (Decision 9)

16 keys ≈ Family A's count. MAX_TOKENS=1500 should fit (Family A's budget; Family C at 17 keys also fits 1500 per its smoke). Designer Phase A.2 confirms.

If designer says MAX_TOKENS=1500 insufficient, that's a Stage 2B trigger.

---

## 8. Edge Function admin_validation-only (Decision 6)

Family E Edge familyRegistry entry: `adminValidationEnabled: true`, `productionEnabled: false`.

Production flip + auto-trigger inclusion is a separate deferred card (will be similar to MCP-021C-EDGE-FAMILY-D-ENABLE pattern after E gets observation period).

---

## 9. Smoke script extension (Decision 7)

Add checks `[16-compat-boolean-family-e]` + `[17-mcp-tools-call-boolean-family-e]` to `mcp-server/scripts/mcp-server-001-smoke.sh`. Final smoke tally: **17 checks** (was 15 after Family D).

---

## 10. Out of scope

- Family F/G/H/I/J registration
- Production-mode flip for Family E (deferred)
- Auto-trigger inclusion for Family E (deferred)
- Family A/B/C/D prompt or registry changes (byte-equal)
- Source 6 rendering changes
- Persistence schema changes
- UI changes
- Schema mirror change
- MCP schema version change
- New taxonomy keys

---

## 11. HALT triggers (24)

Any ONE fires HALT.

### Registry + family-batch integrity (1-6):
1. Card 2 (EDGE-FAMILY-D-ENABLE) smoke PASS audit missing from main
2. Family E raw key list differs from MCP-021A source (familyE.ts)
3. Any Family F/G/H/I/J registration in this card
4. Family A/B/C/D behavior changes (not byte-equal)
5. unsupported_family rejection envelope changes for F/G/H/I/J
6. Schema mirror response shape change

### Protocol + security (7-12):
7. New taxonomy keys
8. MCP schema version change
9. Family A/B/C/D prompt changes
10. Client-side MCP call introduced
11. Secret exposure
12. Logs raw body/prompt/response/token/key

### Architecture (13-17):
13. Family E requires schema mirror change (compound-key — if surfaces, Stage 2B finding)
14. MAX_TOKENS change without Stage 2B approval
15. Subset filter needed for E without Stage 2B approval (if mixed sources)
16. Test forecast exceeds +300
17. Family E Edge familyRegistry entry productionEnabled=true (must be false; admin_validation only)

### Doctrine (18-23) — Family E is doctrine-heavy:
18. `slippery_slope_reasoning_present` prompt copy frames it as a fallacy, weak argument, invalid, bad reasoning, or any verdict (BINDING)
19. Any Family E scheme key framed as a fallacy when its critical question is unmet
20. Family E ban-list scan does NOT cover slippery_slope-specific verdict tokens
21. No adversarial slippery_slope fixture
22. Verdict/winner/fallacy tokens in user-facing strings (general)
23. Family E prompt frames any scheme as inherently good or bad (descriptive only)

### Working tree (24):
24. Unclassified untracked files at PR creation

Any ONE fires HALT. Triggers 18-21 are the doctrine core.

---

## 12. Required Phase A audits (5)

### A.1 — Source verification + Stage 2B determination
- Enumerate all 16 keys with rawKey + source + defaultSurface
- Verify uniform ai_classifier (already preliminarily verified at Phase 0)
- **State explicitly:** Stage 2B REQUIRED vs NOT REQUIRED with rationale

### A.2 — Token budget
- 16 keys × ~85 tokens/key ≈ ~1360 + overhead; should fit 1500
- Confirm or surface need for MAX_TOKENS bump (Stage 2B trigger)

### A.3 — slippery_slope doctrine design
- Verbatim prompt language for `slippery_slope_reasoning_present` per-key guard
- Mirror Family C's per-key falsePositiveGuards pattern
- Family E-specific ban-list extensions

### A.4 — Adversarial fixture design
- 3-5 fixtures targeting slippery_slope
- Expected positives
- Doctrine assertions (evidence_span and model output contain no fallacy tokens)
- Adversarial framing (fixture text may itself contain "fallacy"; classifier must not echo)

### A.5 — Test plan + smoke plan
- Per-file test count forecast
- Implementation file list (familyE* lib files; tests; fixtures; smoke script)

---

## 13. Test forecast: +80 to +130

HALT at +300 either way.

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|familyE|opsMcp)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`

---

## 14. Smoke plan (8-phase)

Audit at `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<date>.md`:

1. Pre-flight
2. Local Deno regression (expected ~694-744)
3. Hosted MCP smoke (17 checks; operator-token-gated)
4. Edge admin_validation (Family E; 3 seeded args)
5. **DOCTRINE: adversarial slippery_slope verification** (Phase 4b)
   - POST a Family E request against an argument with slippery-slope text
   - If `slippery_slope_reasoning_present` fires: verify evidence_span + output contain NO fallacy tokens
   - Binding doctrine smoke check
6. Unsupported F/G/H/I/J rejection regression (6 families, since D is now supported)
7. Targeted Jest regression
8. OPS observations + verdict + audit

### Verdict rules

**PASS:** Phase 3 = 17/17; Phase 4 valid E response; Phase 4b NO fallacy-framing on slippery_slope; Phase 5 F-J reject; regression clean.

**PARTIAL:** Phase 4 0-positives (acceptable; sparse signal); Phase 4b slippery_slope didn't fire on available text (document; not a failure).

**FAIL:** Phase 4b slippery_slope fires WITH fallacy-framing (doctrine violation; existential); Phase 5 unsupported accepted; A/B/C/D byte-equal failure.

---

## 15. Authorizations granted on PASS

- `MCP-SERVER-006-FAMILY-E-SMOKE: PASS`
- Family E admin_validation operational
- 5 families operational (A+B+C+D production-capable; E admin_validation)
- `MCP-SERVER-007-FAMILY-F` AUTHORIZED (with Stage-2B if F has structural complexity)
- `MCP-021C-EDGE-FAMILY-E-ENABLE` AUTHORIZED to design (production flip)
- Remaining: F, G, H, I, J

---

## 16. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-SERVER-006-FAMILY-E.md` | Designer plan + Stage 2B determination |
| `mcp-server/lib/familyE*.ts` (5 NEW) | Family E classifier files |
| `mcp-server/lib/familyRegistryInit.ts` | One-line register call |
| `mcp-server/tools/classifyArgumentBooleanObservations.ts` | Family E dispatch |
| `mcp-server/fixtures/classify-argument-boolean-observations.family-e-*.json` (5+ fixtures incl. adversarial slippery_slope) | Fixtures |
| `mcp-server/tests/familyE*.test.ts` (9 NEW) | Test coverage |
| `mcp-server/scripts/mcp-server-001-smoke.sh` | +2 checks (17 total) |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | E entry (admin only; productionEnabled=false) |
| `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` (NEW) | Edge registry assertion |
| `docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-<date>.md` | Post-merge audit |

---

## 17. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact)
2. Stage 0 — commit + push intent brief to main
3. Phase B — create `feat/MCP-SERVER-006-FAMILY-E` branch + GitHub issue
4. Stage 1 — spawn roadmap-designer subagent (5 Phase A audits; explicit Stage 2B determination)
5. Stage 2A — conditional HALT evaluation
6. **CONDITIONAL Stage 2B** — only if designer surfaces complexity (likely NOT required)
7. Stage 3 — implementer
8. Stage 4 — reviewer (includes explicit slippery_slope doctrine matrix item)
9. Stage 5 — PR + squash-merge + post-merge gates
10. Post-merge smoke (8-phase incl. Phase 4b doctrine verification)
