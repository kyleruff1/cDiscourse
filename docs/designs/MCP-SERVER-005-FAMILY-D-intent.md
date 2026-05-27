# MCP-SERVER-005-FAMILY-D — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** MCP server family rollout (Family D of B/C/D/E batch)
**Predecessor chain on main:**
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS` at `ac66b2e` (Card 1 of combined launch)
- `OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE PASS` at `1624f6b`
- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE PASS` at `b8ce07b`
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS` at `19b8d8a`
- `MCP-SERVER-004-FAMILY-C-SMOKE PASS` at `70b18f2`
- `MCP-SERVER-003-FAMILY-B-SMOKE PASS` at `05b42c3`
- All preceding MCP cards

Card 2 of the combined launch (Card 1 = EDGE-FAMILIES-B-C-ENABLE; this card = FAMILY-D).

---

## 1. The structural outlier

Family D (`evidence_source_chain`) ships as the most architecturally complex family in the B/C/D/E batch:

- **27 total taxonomy entries** (verified live at Phase 0 against `src/features/nodeLabels/machineObservationDefinitions/familyD.ts`)
- **Compound-key collision**: 2 rawKeys appear under TWO source types:
  - `source_requested`: auto_metadata + lifecycle (2 entries)
  - `quote_requested`: auto_metadata + lifecycle (2 entries)
- **Source provenance breakdown:**
  - `auto_metadata` (5 keys): has_evidence, source_requested, quote_requested, source_attached, quote_attached
  - `lifecycle` (3 keys): sourced, quote_requested, source_requested
  - `ai_classifier` (19 keys): asks_for_evidence, provides_evidence, evidence_supports_claim, creates_source_chain_gap, opens_evidence_debt_marker, closes_evidence_debt_marker, supplies_corroborating_document, source_provided, quote_provided, concrete_example_requested, concrete_example_provided, evidence_claim_present, evidence_gap_present, source_chain_repair, anecdote_used, statistic_used, external_authority_used, evidence_quality_questioned, burden_request_present

**Note on launch's estimate:** the combined launch projected "~12 ai_classifier keys" for the subset path. Phase 0 live count is **19 ai_classifier keys**. Designer Phase A.1 verifies + reconciles. The token-budget projection in §3 below assumes 19 keys.

---

## 2. Mandatory Stage 2B operator-decision checkpoint

This card has a **MANDATORY** Stage 2B operator-decision checkpoint. The designer's Phase A delivers two paths with explicit recommendation; the pipeline HALTs until the operator chooses one (or overrides).

### Path A — Subset (ai_classifier only, 19 keys)

- 19 ai_classifier-source keys ONLY (auto_metadata + lifecycle keys excluded from MCP server scope)
- Compound-key collision avoided by exclusion (the duplicated `source_requested` + `quote_requested` aren't in the ai_classifier subset)
- MAX_TOKENS: TBD by designer Phase A.2 (preliminary projection: 19 keys × ~85 tokens = ~1615; SLIGHTLY OVER current 1500 envelope; designer must decide between (a) keeping 1500 + tighter prompt; (b) bumping to ~1800; (c) auditing if 85-token-per-key estimate is conservative)
- Schema mirror unchanged
- Latency projection: ~22-25s for 3 args (similar to Family C at 17 keys = 20.46s, scaled for +2 keys)
- Auto_metadata + lifecycle keys (8 total) deferred — Edge Function adapter may compute them deterministically from tree/cluster state in a separate future card

### Path B — Full-27 (all sources, compound-keyed response)

- All 27 entries routed through MCP server
- Schema mirror response shape changes: `observations: Record<rawKey, boolean>` → `observations: Record<compoundKey, boolean>` where `compoundKey = '<source>:<rawKey>'`
- Edge Function adapter handles compound-key response
- MAX_TOKENS bumped (preliminary projection: ~2400+)
- Latency projection: ~30-35s for 3 args (approaches Edge timeout threshold)
- Significantly larger test surface (compound-key tests; schema change tests; Edge adapter compound-key parsing)

### Default recommendation

Default recommendation per launch text: **subset path**. Rationale supporting subset:
- Auto_metadata + lifecycle keys are deterministic (the classifier can't add value beyond what tree/cluster state already encodes)
- Avoids schema mirror breaking change
- Avoids MAX_TOKENS bump
- Latency stays under 25s (within comfortable Edge timeout headroom)
- Architectural precedent for future families (E, F, G, etc.) with similar source-mix complexity: filter ai_classifier subset

Designer Phase A.5 may diverge from this default with explicit justification.

---

## 3. Token budget analysis (preliminary; designer Phase A.2 binding)

| Card | Key count | MAX_TOKENS | Observed latency (3 args) |
| --- | --- | --- | --- |
| Family A | 16 | 1500 | ~17s |
| Family B | 14 | 1500 | ~16-18s |
| Family C | 17 | 1500 | 20.46s |
| **Family D (subset)** | **19** | TBD (1500 tight or 1800 safe) | **~22-25s projected** |
| **Family D (full-27)** | **27** | **~2400+ required** | **~30-35s projected** |

Designer Phase A.2 produces the binding per-key token estimate (Family C's ~85 tokens/key is the baseline; Family D may be higher due to evidence-citation verbosity).

---

## 4. Doctrine load-bearing keys (3)

Per Family D's source taxonomy, 3 keys carry doctrine load:

### 4.1 `anecdote_used` (anti-bias copy required)
- Anecdotes are legitimate evidence in some contexts
- Copy must NOT imply weakness
- Per-key prompt guard: descriptive only ("anecdote_used describes a structural feature; it is NOT a verdict on the move's value")
- Ban-list test: no `weak`, `bad`, `inferior`, `lesser` in this key's prompt or output

### 4.2 `burden_request_present` (descriptive, not verdict)
- Debated philosophical territory (epistemic burden assignment)
- CDiscourse treats it descriptively, not as a verdict on which side is right
- Per-key prompt guard: descriptive only ("burden_request_present indicates a structural request; it does NOT determine which side bears the burden")
- Ban-list test: no `right`, `wrong`, `correct`, `incorrect` in this key's prompt or output

### 4.3 `evidence_gap_present` (anti-amplification)
- Popularity ≠ evidence
- Per-key prompt guard: descriptive only ("evidence_gap_present indicates a structural state; it does NOT imply the move is dishonest or low-quality")
- Ban-list test: no `dishonest`, `low_quality`, `weak` in this key's prompt or output

Designer Phase A.4 verifies these 3 keys + adds Family D-specific ban-list extensions to the shared `DOCTRINE_BAN_PATTERNS`.

---

## 5. Out of scope

- Family E/F/G/H/I/J registration
- New taxonomy keys
- MCP schema version change
- Family A/B/C prompt or registry changes (byte-equal preserved)
- Auto-trigger inclusion for Family D (this card ships admin_validation-only; production flip is a future card)
- Source 6 rendering changes (Family D admin_validation rows excluded from Source 6 automatically; production rows from this card don't exist yet)
- Persistence schema changes
- UI changes

---

## 6. HALT triggers (24)

Any ONE fires HALT.

### Registry + family-batch integrity (1-6):
1. Card 1 (FAMILIES-B-C-ENABLE) smoke PASS audit missing from main
2. Family D raw key list differs from MCP-021A source (`src/features/nodeLabels/machineObservationDefinitions/familyD.ts`)
3. Any Family E/F/G/H/I/J registration in this card
4. Family A or Family B or Family C behavior changes (not byte-equal)
5. unsupported_family rejection envelope changes for E/F/G/H/I/J
6. Schema mirror response shape change without operator approval at Stage 2B (the Full-27 path requires this; Subset path does NOT)

### Protocol + security (7-12):
7. New taxonomy keys
8. MCP schema version change
9. Family A/B/C prompt changes
10. Client-side MCP call introduced
11. MCP bearer / Anthropic / service-role secret exposure
12. Logs raw argument body, raw prompt, raw model response, bearer token, or API key

### Architecture (13-17):
13. Subset filter implementation differs from Stage 2B operator approval
14. Full-27 implementation chosen without operator approval at Stage 2B
15. MAX_TOKENS bump proposed without operator approval at Stage 2B
16. Compound-key response shape proposed without operator approval at Stage 2B
17. Family D Edge familyRegistry entry: `productionEnabled` must be `false` in this card (admin_validation-only ship; mirrors B + C initial posture)

### Doctrine (18-22):
18. Prompt frames evidence-source moves as judgmental (descriptive only per MCP-021A doctrine)
19. `anecdote_used` framed as weakness
20. `burden_request_present` framed as a verdict
21. `evidence_gap_present` framed as failure
22. Verdict/winner/fallacy tokens in user-facing strings

### Working tree (23-24):
23. Unclassified untracked files at PR creation
24. Test forecast exceeds +300

---

## 7. Required Phase A audits (5)

### A.1 — Family D source verification + 27-key inventory
- Verify 27 total entries
- Document compound-key collision (`source_requested` + `quote_requested`)
- Classify each key by source: auto_metadata (5), lifecycle (3), ai_classifier (19)
- Document exact ai_classifier subset count (19 expected)

### A.2 — Token budget analysis
- Per-key token estimate (Family C baseline ~85)
- Subset path projection
- Full-27 path projection
- MAX_TOKENS implications for each path
- Edge timeout headroom analysis

### A.3 — Compound-key collision design
- Subset path: filter approach (auto_metadata + lifecycle out of MCP scope; the 2 collision keys disappear from MCP routing)
- Full-27 path: response shape change (compound keys) + Edge adapter changes
- Compatibility implications for each

### A.4 — Doctrine load-bearing keys
- Per-key prompt guard text for `anecdote_used`, `burden_request_present`, `evidence_gap_present`
- Ban-list scan tests for each
- Mechanical copy strategy from Family C's per-key guards

### A.5 — Subset-vs-full-27 recommendation
- Pick ONE path with explicit justification
- Document the alternative considered + rejected
- Test forecast per path
- Smoke plan adjustments per path

---

## 8. Test forecast

- Subset path: +80 to +120
- Full-27 path: +150 to +250
- HALT at +300 either way

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|familyD|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`

---

## 9. Smoke plan (8-phase, post-merge)

Audit at `docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-<date>.md`:

1. Pre-flight (HEAD + functions + DB)
2. Local Deno regression (mcp-server; ~547-620 expected with Family D additions)
3. Hosted MCP smoke (15 checks: 13 existing + 2 new Family D checks)
4. Edge admin_validation smoke (Family D against 3 seeded args; positive count documented per Decision 9)
5. Unsupported E/F/G/H/I/J rejection regression
6. Targeted Jest regression
7. OPS observations + observability report (4 families now operational: A+B+C production + D admin_validation)
8. Verdict + audit commit

---

## 10. Authorizations granted on PASS

- `MCP-SERVER-005-FAMILY-D-SMOKE: PASS`
- Family D admin_validation operational
- `MCP-021C-EDGE-FAMILY-D-ENABLE` AUTHORIZED to design (production flip for D)
- `MCP-SERVER-006-FAMILY-E` AUTHORIZED to begin (with Stage-2B if E has similar structural complexity)
- `OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE` (optional) for 4-family state observability

---

## 11. Execution order

1. Phase 0 pre-flight (DONE; this brief is the artifact; 27 keys + 19 ai_classifier subset verified live)
2. Stage 0 — commit + push this intent brief to `main`
3. Phase B — create `feat/MCP-SERVER-005-FAMILY-D` branch + GitHub issue
4. Stage 1 — spawn roadmap-designer subagent (5 Phase A audits + binding recommendation)
5. Stage 2A — conditional HALT evaluation
6. **STAGE 2B — MANDATORY operator-decision checkpoint** (Subset vs Full-27)
7. Stage 3 — implementer (per Stage 2B path)
8. Stage 4 — reviewer
9. Stage 5 — PR + squash-merge + post-merge gates
10. Post-merge smoke (8-phase)
