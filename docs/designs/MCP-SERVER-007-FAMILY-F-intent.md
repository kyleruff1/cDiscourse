# MCP-SERVER-007-FAMILY-F — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Card:** 1 of 3 in chain (Card 2 = MCP-021C-EDGE-FAMILY-E-ENABLE; Card 3 = MCP-021C-EDGE-FAMILY-F-ENABLE)
**Family:** F — critical_question (14 keys; uniform `source: 'ai_classifier'` per pre-flight)
**Posture this card:** admin_validation-only (productionEnabled=false; productionEnabled→true is Card 3)
**Predecessors on main (required):**
- `87a2784` audit(OPS-MCP-SMOKE-LINT-CI-WIRING): PASS (CI live)
- `b11f519` OPS-MCP-SMOKE-LINT-CI-WIRING ship (PR #342)
- `91a3664` OPS-MCP-SMOKE-DOCTRINE-HARDENING ship (PR #340)
- `bccb0c2` audit(MCP-SERVER-006-FAMILY-E): hosted completion PASS
- All preceding cards

---

## 1. Sequencing chain + role under CI

This is Card 1 of a three-card chain shipping under live audit-lint CI (`87a2784`).

```
Card 1 (this card) — Family F admin-only ship → Gate A (low tension) →
Card 2 — Family E production flip (first under L3+L4+L5 mechanical enforcement) → Gate B (high tension; F admin baseline thin) →
Card 3 — Family F production flip (L5 BINDING on production doctrine)
```

This card's smoke audit PR is the FIRST family-ship audit to reach the CI workflow with a non-empty in-scope set. The enforcement loop's empirical validation rides on this smoke audit (Phase 7 provenance subsection per D12).

---

## 2. Family F doctrine-risk-by-construction posture

Family F is the **critical-questions layer over Family E's argument schemes**. The doctrine peril is binary:

- **Right framing** (what F must do): "this argument has not yet answered the critical question X" — descriptive flag on an absence/gap
- **Wrong framing** (what F must NEVER do): "this argument is a fallacy because it failed to answer X" — verdict on argument quality

The pre-flight inspection of `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` confirms the source-of-truth definitions are already disciplined: every entry has a `falsePositiveGuards` clause warning against "this argument is wrong / weak / fallacious" framing; rawKey names are descriptive (`missing_warrant`, not `weak_warrant`); the header doctrine block explicitly anchors §10a-doctrine + Walton + MCP-020 §"Rejected labels".

The risk this card must manage: ensuring the NEW files (`familyFPrompt.ts`, `familyFAnthropic.ts`, `familyFBanListScan.ts`, `familyFKeys.ts`, fixtures) propagate that source-of-truth discipline through the Anthropic prompt + per-key guards + ban-list scan + fixture coverage, without introducing verdict-framing at any layer.

---

## 3. Conditional Stage 2B (5 triggers T1-T5)

Designer Phase A.1 MUST evaluate each trigger and state Stage 2B requirement explicitly:

| Trigger | Description | Pre-flight read |
| --- | --- | --- |
| T1 | mixed source provenance (auto_metadata / lifecycle / ai_classifier mix) | Pre-flight shows uniform `ai_classifier` — T1 LIKELY DOES NOT FIRE |
| T2 | compound rawKey collision (Family D pattern) | Designer A.1 to verify against existing rawKey namespace |
| T3 | critical-question keys that imply correctness/fallacy if phrased poorly (E↔F doctrine boundary) | **ASSUMED-TRUE until A.1 explicitly proves false.** Designer must evaluate whether translating F's source-of-truth definitions into an Anthropic prompt is structurally simple (no Stage 2B needed) or requires operator architectural input on prompt structure |
| T4 | MAX_TOKENS bump beyond 1500 | Designer A.2 latency/token projection |
| T5 | cross-family classifier dependency (e.g., F outputs depend on E outputs) | Designer A.1 to verify F is structurally independent |

**Stage 2B required if:** T1, T2, T4, or T5 fires (architectural) OR T3 alone fires (doctrine prompt structure).

**Stage 2B NOT required if:** all 5 disposed.

Designer MUST state: "Stage 2B NOT REQUIRED because…" with explicit per-trigger disposition OR "Stage 2B REQUIRED because trigger T<n>: …". Assuming "uniform ai_classifier" without source verification is HALT trigger 1.

---

## 4. Binding decisions D1-D12

### D1. Pattern replication from Family E
`familyFKeys.ts`, `familyFPrompt.ts`, `familyFAnthropic.ts`, `familyFBanListScan.ts`, `familyFFixtureProvider.ts` mirroring Family E's file structure. Registry registration via `familyRegistryInit.ts`. Dispatcher routing via `classifyArgumentBooleanObservations.ts`. Smoke script `+2 checks (17→19)`.

### D2. Designer Phase A.1 verbatim source verification
- Open `src/features/nodeLabels/machineObservationDefinitions/familyF.ts`; enumerate every rawKey verbatim with its source field.
- For each, document doctrine-risk grade (low / medium / high) on the verdict-framing axis.
- State Stage 2B requirement explicitly per §3.

### D3. E↔F doctrine binding (BINDING regardless of Stage 2B)
`familyFPrompt.ts` MUST:
- Frame critical_question keys as DESCRIPTIVE PROBES, not verdicts
- Never imply an unmet critical question makes E's scheme a fallacy
- Carry per-key `falsePositiveGuards` on any key whose CQ partners with a doctrine-risk E scheme (e.g., F's `consequence_probability_unclear` partners with E's `slippery_slope_reasoning_present`)
- Header doctrine block explicitly forbids verdict framing for critical questions, mirroring Family E's header doctrine block at `mcp-server/lib/familyEPrompt.ts:81-94`

### D4. Mandatory adversarial fixtures (3-5)
- **Fixture A** — scheme present, critical question unmet: F output flags the unmet CQ; F output must NOT label E's scheme as a fallacy
- **Fixture B** — scheme present, critical question met: both descriptive
- **Fixture C** — scheme present, input text contains "fallacy" word: F output evidence_span must NOT echo "fallacy"
- (Optional D, E — multi-scheme mixed CQ states)

### D5. Ban-list scan extension
`familyFBanListScan.ts` extends shared `DOCTRINE_BAN_PATTERNS` with critical-question-specific verdict tokens:
- `unmet-means-fallacy`, `proves-wrong`, `invalidates`, `refutes` (used as verdict)
- `fallacy`, `fallacious`, `weak argument`, `invalid argument`, `bad reasoning`, `flawed`, `wrong`, `proof of`

Scans: `evidence_span`, `modelInfo`, `content[text]` if present.

### D6. Edge Function admin_validation-only
Family F Edge `familyRegistry` entry: `adminValidationEnabled=true, productionEnabled=false`. The pre-flight check confirms current state is already `{ productionEnabled: false, adminValidationEnabled: true }`. This card does NOT touch that entry. Production flip is Card 3.

### D7. Subset filter contingent on T1
- T1 NOT fires (uniform ai_classifier): NO subset filter entry for F
- T1 fires: Stage 2B operator-decision required (subset vs full)

### D8. Token budget contingent on T4
- T4 NOT fires (fits MAX_TOKENS=1500): unchanged
- T4 fires: Stage 2B operator-decision required

### D9. Smoke script extension
Add checks `[18-compat-boolean-family-f]` + `[19-mcp-tools-call-boolean-family-f]`. Final tally: 19 checks.

### D10. Smoke template carries `Audit-Lint: v1` marker
Without the marker, CI silently exempts the audit and the enforcement loop fails to exercise on this card. This is HALT trigger 24.

### D11. Smoke audit local pre-lint (closes HALT trigger 25)
Before pushing the smoke audit PR:
```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md
```
Must exit 0. If it fails locally, fix the audit BEFORE opening PR. CI is the merge gate; local pre-lint is the fast feedback loop.

### D12. Enforcement-loop provenance note (NEW)
Smoke audit Phase 7 includes a NEW required subsection (verbatim):
> "First-enforcement provenance: this is the first family-ship PR to be linted by audit-lint CI with a non-empty in-scope set. CI workflow run ID: `<id>`; in_scope count: `<n>`; linter exit: 0. L1-L6 mechanical enforcement empirically validated end-to-end."

---

## 5. Out of scope

- Production flip for F (Card 3)
- New family (G, H, I, J)
- Family A/B/C/D/E behavior changes (byte-equal preservation)
- Shared `DOCTRINE_BAN_PATTERNS` modification (F adds its own scan; shared list byte-equal)
- Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (no entry for F unless T1 fires with Stage 2B)
- Schema mirror response shape
- Hosted MCP server file changes outside `familyF*` files + smoke script
- Client-side MCP call
- Migration; Supabase deploy beyond Edge auto-deploy on merge

---

## 6. HALT triggers (26)

### Registry + family-batch integrity (1-7)
1. Designer skips Phase A.1 source verification (must read familyF.ts verbatim and explicitly enumerate each rawKey's source)
2. Family F rawKey list differs from MCP-021A source
3. Any Family G/H/I/J registration in this card
4. Family A/B/C/D/E behavior changes (not byte-equal)
5. unsupported_family rejection envelope changes for G/H/I/J
6. Schema mirror response shape change
7. F Edge `familyRegistry` `productionEnabled=true` (must be false)

### Protocol + security (8-13)
8. New taxonomy keys
9. MCP schema version change
10. Family A/B/C/D/E prompt changes
11. Client-side MCP call introduced
12. Secret exposure
13. Logs raw body / prompt / response / token / key

### Architecture (14-18)
14. Stage 2B REQUIRED but operator approval missing when implementer starts
15. Subset filter modified for A/B/C/D/E (locked); F gets entry ONLY if T1 fires with Stage 2B approval
16. MAX_TOKENS change without Stage 2B approval (T4)
17. Family F prompt frames critical_question keys as fallacy / weakness / error / verdict / bad reasoning / invalid (EXISTENTIAL DOCTRINE)
18. Family F prompt implies unmet critical question makes E's scheme a fallacy (EXISTENTIAL DOCTRINE; the MCP-020 violation Card 3 of prior chain prevented for E)

### Doctrine — F-specific (19-23)
19. ban-list scan does NOT cover critical-question verdict tokens (D5 list)
20. No mandatory adversarial fixtures targeting E↔F doctrine boundary (D4 list)
21. Smoke Phase 4b adversarial doctrine verification missing (L5 enforcement; CI WILL fail merge)
22. Family F slippery_slope/consequence_probability_unclear partner (or equivalent F partner to E's slippery_slope) lacks per-key doctrine guard
23. Verdict/winner/fallacy tokens in user-facing strings (general)

### Enforcement-loop (24-25)
24. Smoke audit lacks `Audit-Lint: v1` marker (CI won't lint; defeats enforcement loop)
25. Smoke audit fails local audit-lint dry-run before PR (must fix BEFORE opening PR)

### Working tree (26)
26. Unclassified untracked files at PR creation

**Triggers 17-18 and 21-22 are the doctrine core. Triggers 24-25 are the enforcement-loop core.**

---

## 7. Required designer Phase A audits (5)

### A.1 — Source verification + Stage 2B determination
- Enumerate every Family F rawKey with its source field
- Document doctrine-risk grade per key (low / medium / high) on verdict-framing axis
- Evaluate T1-T5; state Stage 2B requirement explicitly per §3

### A.2 — Token budget + latency projection
- Count keys × prompt overhead → project MAX_TOKENS usage
- Project latency vs Family E baseline (~16.73s for 16 keys × 3 args)

### A.3 — E↔F doctrine binding design
- Header doctrine block content for `familyFPrompt.ts`
- Per-key `falsePositiveGuards` for CQ-paired keys (identify F↔E partnerships)
- Ban-list scan extensions (D5 list)

### A.4 — Adversarial fixture design (D4)
- Three required fixtures with input text + expected positives + doctrine-clean assertions on evidence_span
- Operator-readable per-fixture rationale (which doctrine peril does each catch?)

### A.5 — Test plan + smoke plan
- 8-phase smoke (Phase 4b BINDING; Phase 7 enforcement-loop provenance)
- Test forecast +90 to +180 (HALT +220 per §8)

---

## 8. Test forecast: +90 to +180

HALT ceiling +220. The Family E precedent of +178 proved doctrine-heavy families need the L1-L6 rule+fixture coverage matrix; this is the new baseline, NOT a ceiling raise to permit bloat.

Run gates per commit:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="familyF" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`

---

## 9. Smoke plan (8-phase incl. Phase 4b BINDING + Phase 7 enforcement-loop provenance)

Audit at `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md` (MUST carry `Audit-Lint: v1` marker).

### Phase 1 — Pre-flight
HEAD; Edge functions deployed; F registry posture (`adminValidationEnabled=true, productionEnabled=false`); test counts.

### Phase 2 — Local Deno regression
Expected ~890-970 (792 baseline + ~98-178 new from F suite).

### Phase 3 — Hosted MCP smoke (19 checks)
Operator runs hosted smoke with token. Required-direct phase under L1; NOT-RUN here caps verdict at PARTIAL per R2.

### Phase 4 — Edge admin_validation (Family F)
Submit 3 seeded args via submit-argument. POST Edge admin_validation with `requestedFamilies: ['critical_question']`. Verify HTTP 200; positives in F's 14-key set; no cross-family leak.

### Phase 4b — DOCTRINE: live adversarial CQ verification (BINDING; L5 enforcement)
- Submit each adversarial fixture argument (D4) via submit-argument (production auto-trigger A+B+C+D+E fires as side effect; document as bonus observation)
- POST Edge admin_validation with `requestedFamilies: ['critical_question']` on the new adversarial argument_ids
- Query `argument_machine_observation_results` for the F run_ids
- **PRE-CHECK column names** (R1 per Family E amendment precedent)
- Main query MUST return non-empty rows (R1)
- For each critical_question positive:
  - `evidence_span` MUST NOT contain fallacy / fallacious / weak / invalid / flawed / wrong / proof of / logical error / bad reasoning / informal fallacy / unmet-means-fallacy / proves-wrong / invalidates
  - For Fixture C (input contained "fallacy"): output MUST NOT echo
- **Firing-count resolution (asymmetric):**
  - `>=1 firing, all clean` → PASS
  - `0 of 3 firings` → PARTIAL (pattern not exercised live; do NOT authorize Family F production until stronger fixture)
  - `>=1 firing, any dirty` → FAIL (existential; HALT)

### Phase 5 — Unsupported G/H/I/J rejection regression
POST each of the 4 still-unsupported families against arg2. Expected: HTTP 200, `failed`, `mcp_validation_failed`, zero positives.

### Phase 6 — Targeted Jest + Deno regression
- `npx jest --testPathPattern="familyF" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read`
- typecheck + lint

### Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12)
Required subsection (verbatim per D12; operator extracts CI run ID + in_scope count + linter exit from the smoke-audit PR's Actions tab):
> "First-enforcement provenance: this is the first family-ship PR to be linted by audit-lint CI with a non-empty in-scope set. CI workflow run ID: `<id>`; in_scope count: `<n; should be 1 — the smoke audit itself>`; linter exit: 0. L1-L6 mechanical enforcement empirically validated end-to-end."

Plus standard 6-family operational state, latency, doctrine-key calibration.

### Phase 8 — Verdict + authorization
- Final verdict
- Authorizations (Gate A surface)
- Operator cleanup

### Pre-push audit-lint (D11)
Before pushing smoke audit PR: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-<date>.md` MUST exit 0.

### Verdict rules

**PASS:** Phase 3 19/19 (or NOT-RUN → PARTIAL cap); Phase 4 valid; Phase 4b ≥1 clean firing (or 0-fire PARTIAL); Phase 5 G-J reject; Phase 6 regression; Phase 7 provenance subsection present; pre-lint + CI exit 0.

**PARTIAL:** Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR CI caught real L1-L6 violation requiring audit fix.

**FAIL:** Phase 4b dirty firing; non-Family-F rawKey; prior-family byte-equal failure; CI incorrectly passed an L1-L6-violating audit.

---

## 10. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/MCP-SERVER-007-FAMILY-F.md` | Designer plan with Stage 2B determination |
| `mcp-server/lib/familyFKeys.ts` (NEW) | 14-key definitions |
| `mcp-server/lib/familyFPrompt.ts` (NEW) | Anthropic prompt with header doctrine block |
| `mcp-server/lib/familyFAnthropic.ts` (NEW) | Anthropic adapter |
| `mcp-server/lib/familyFBanListScan.ts` (NEW) | Output scan with CQ verdict tokens (D5) |
| `mcp-server/lib/familyFFixtureProvider.ts` (NEW) | Adversarial fixtures (D4) |
| `mcp-server/lib/familyRegistryInit.ts` (MODIFIED) | F registration |
| `mcp-server/lib/classifyArgumentBooleanObservations.ts` (MODIFIED) | F dispatch |
| `mcp-server/scripts/mcp-server-001-smoke.sh` (MODIFIED) | +2 checks → 19 total |
| `mcp-server/tests/familyF*.test.ts` (NEW) | Coverage + adversarial unit tests |
| Edge `familyRegistry.ts` (UNTOUCHED) | F entry already correct posture |
| `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-template.md` (NEW) | Smoke template carrying marker |

---

## 11. Execution order

1. Phase 0 pre-flight (DONE)
2. Stage 0 — commit + push intent to main
3. Phase B — create `feat/MCP-SERVER-007-FAMILY-F` branch + GitHub issue
4. Stage 1 — designer subagent (5 Phase A audits; Stage 2B determination)
5. Stage 2A — conditional HALT eval
6. Stage 2B — conditional operator-decision checkpoint (only if designer marks REQUIRED)
7. Stage 3 — implementer subagent
8. Stage 4 — reviewer subagent (22+ matrix items)
9. Stage 5 — PR + squash-merge + post-merge gates
10. Post-merge 8-phase smoke (Phase 4b BINDING + Phase 7 enforcement-loop provenance)
11. Local pre-lint + smoke audit PR → CI exercises with non-empty in-scope set
12. Audit commit on main
13. Gate A (HARD) → operator decides Card 2 path
