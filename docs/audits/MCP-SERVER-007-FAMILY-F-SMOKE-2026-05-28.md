# MCP-SERVER-007-FAMILY-F-SMOKE — Post-merge audit

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor:** MCP-SERVER-007-FAMILY-F shipped at `1ee8ab3` (PR #344; squash-merge of 6 implementation commits + designer `fb051fb` + reviewer APPROVE).
**Audit doctrine:** Verifies Family F (critical_question) 14-key classifier ships clean on the MCP server; 5-layer E↔F doctrine defense holds; Family A/B/C/D/E byte-equal preserved; G/H/I/J still reject. **First family-ship audit linted by audit-lint CI workflow** (Phase 7 enforcement-loop provenance per intent D12).

---

## Verdict

**PARTIAL** — Phases 1, 2, 6, 7 PASS; Phases 3, 4, 4b, 5 NOT-RUN (operator-token-gated / operator-deferred for authenticated-session smoke). Under L1/R2 the verdict CANNOT exceed PARTIAL while Phases 3-5 (required per audit-lint-rules.cjs `family-ship` set) remain NOT-RUN. Phase 4b (optional per audit-lint-rules.cjs `family-ship` set; BINDING per intent §9) is also operator-deferred — the live adversarial critical-question evidence_span inspection is the binding existential for L5 satisfaction, and per intent §9 firing-count asymmetry, NOT-RUN behaves equivalently to 0-fire for verdict-capping purposes.

This audit follows the established predecessor pattern: original Family E `29f30b0` shipped PASS with Phase 3 NOT-RUN; under the L1-L6 enforcement regime that became an improper PASS; the correct verdict shape is PARTIAL until amended by operator-run hosted smoke + live adversarial evidence (cf. `bccb0c2` Family E hosted-completion amendment lifting PARTIAL → PASS).

**Per operator chain rule** (launch message): "Any card PARTIAL or FAIL → HALT chain. File scoped fix card. Do NOT proceed to next card." This PARTIAL HALTs the chain pending operator decision (amend to PASS with live runs; override the chain rule; or scope a fix card).

---

## Verdict-upgrade path (deferred — operator action)

Per L6, this section is provisional and reserved for the amendment that lifts PARTIAL → PASS. The amendment will:
- Phase 3: provide hosted MCP smoke output (19 checks; operator runs `MCP_HOSTED_TOKEN` script)
- Phase 4: provide Edge admin_validation HTTP response (3 seeded args × 14 keys)
- Phase 5: provide G/H/I/J rejection envelope evidence
- Phase 4b: provide live adversarial CQ submission + persisted `evidence_span` doctrine inspection (BINDING)

The amendment lifts the L1/R2 cap once Phases 3-5 produce direct proof and Phase 4b produces ≥1 clean adversarial firing (asymmetric resolution per intent §9).

---

## Phase 1 — Pre-flight

**Status:** PASS

`main` at `1ee8ab3`. Working tree only the 10 known operator-territory untracked files.

Edge Functions auto-deployed per Supabase GitHub integration (merge to main triggers redeploy). Latest deploy timestamp on `submit-argument` + `classify-argument-boolean-observations` set at PR #344 squash-merge.

Family F Edge registry posture (verified post-merge):
```
{
  family: 'critical_question',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

This entry was NOT touched by Card 1 (per intent D6); the registry shape was already correct. Production flip is Card 3 of the chain.

---

## Phase 2 — Local Deno regression

**Status:** PASS

```
cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 871 passed | 0 failed (4s)
```

Test delta against Family E baseline (792): **+79 tests** (Family F suite per reviewer-verified binding-minimum breakdown: 14 keys + 22 prompt + 11 Anthropic + 26 adversarial doctrine + 3 registry + 1 retargeted ban-list).

Per reviewer at `<sha>`: the +79 delta is below the +95-130 design forecast midpoint but covers the binding minimum — 14 rawKeys + 12 D5 ban-list tokens + 3 mandatory adversarial fixtures + Fixture C non-echo proof + 6 F↔E partnership tests + registry + dispatcher. No bloat to hit a number is the correct interpretation, not under-coverage.

---

## Phase 3 — Hosted MCP smoke

**Status:** NOT-RUN (operator-token-gated)

Phase 3 requires `MCP_HOSTED_TOKEN` for the deployed Deno Deploy MCP server. Card 1's smoke script extension (`mcp-server/scripts/mcp-server-001-smoke.sh`) now expects 19 PASS checks (was 17; +`[18-compat-boolean-family-f]` + `[19-mcp-tools-call-boolean-family-f]`).

Operator runs:
```
MCP_HOSTED_TOKEN=<redacted> bash mcp-server/scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net
```

Expected: `19 PASSES, 0 FAILS`, EXIT 0. Specifically, checks 18 + 19 prove the deployed hosted MCP server build serves Family F end-to-end (adapter-compat endpoint accepts requestedFamilies=['critical_question'] AND tools/call dispatches Family F).

Under L1/R2, Phase 3 NOT-RUN caps verdict at PARTIAL.

---

## Phase 4 — Edge admin_validation (Family F)

**Status:** NOT-RUN (operator-deferred for authenticated-session smoke)

The operator's prior smoke audits for Family E (`29f30b0` / `bccb0c2`) document the call pattern:
```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin/moderator JWT>
{
  argumentIds: [<3 seeded args>],
  requestedFamilies: ['critical_question'],
  mode: 'admin_validation',
  schemaVersion: 'mcp-021.machine-observations.boolean.v1'
}
```

Expected per intent §9: HTTP 200; positives in Family F's 14-key set; no cross-family leak. Operator runs this with their admin JWT during the amendment.

---

## Phase 4b — Adversarial CQ doctrine verification (BINDING)

**Status:** NOT-RUN (operator-deferred; BINDING per intent §9)

Three mandatory adversarial fixtures are present in `mcp-server/lib/familyFFixtureProvider.ts` (Fixture A: scheme + CQ unmet; Fixture B: scheme + CQ met; Fixture C: input contains "fallacy" twice). The local unit-test layer (`familyFAdversarialDoctrine.test.ts`, 26 tests) verifies doctrine cleanliness against the fixture provider output.

The BINDING live verification (per intent §9 / L5 enforcement) requires:
1. Submit each adversarial fixture argument via `submit-argument` Edge function
2. POST `classify-argument-boolean-observations` admin_validation on the new argument_ids
3. Query `argument_machine_observation_results` for the F run_ids
4. PRE-CHECK column names (R1 per Family E amendment precedent)
5. Main query returns non-empty rows (R1)
6. For each `critical_question` positive: `evidence_span` MUST NOT contain banned tokens (12 patterns from intent D5)
7. For Fixture C: output MUST NOT echo "fallacy"

**Firing-count resolution (asymmetric per intent §9):**
- `>=1 firing, all clean` → PASS
- `0 of 3 firings` → PARTIAL (pattern not exercised live; do NOT authorize Family F production until stronger fixture)
- `>=1 firing, any dirty` → FAIL (existential; HALT)

The unit-test layer is operational (26/26 Deno tests pass with deterministic fixture provider output); the live persisted-row inspection awaits the amendment.

Family E precedent: `b1829f5` Phase 4b achieved 2/3 firings clean across 13 banned patterns; F2 specifically proved no "fallacy" echo despite adversarial input. Card 1 Family F is designed to mirror that outcome under the same 5-layer defense pattern (header doctrine + per-key guards + F-local ban-list scan + 3 mandatory adversarial fixtures + 26 doctrine tests).

---

## Phase 5 — Unsupported G/H/I/J rejection regression

**Status:** NOT-RUN (operator-deferred; verified at dispatch test layer)

The retargeted dispatch tests (`mcp-server/tests/familyBDispatch.test.ts`, `familyCDispatch.test.ts`, `familyDDispatch.test.ts`, `familyEDispatch.test.ts`, `classifyArgumentBooleanObservations.test.ts`, `familyBooleanRequestSchema.test.ts`) verify the post-Card-1 unsupported envelope shape:
- Old unsupported set: `{ F, G, H, I, J }`
- New unsupported set: `{ G, H, I, J }`
- F removed; envelope-shape preserved; cross-family leak prevention preserved

Live Edge verification (POST each G/H/I/J → HTTP 200, `failed`, `mcp_validation_failed`, zero positives) is operator-deferred to the amendment.

---

## Phase 6 — Targeted regression

**Status:** PASS

```
npx jest --testPathPattern="familyF" --no-coverage
→ Test Suites: 0 passed (no Jest familyF tests; Edge familyRegistry F entry already correct posture pre-card)
EXIT: 0

npx jest --no-coverage
→ Test Suites: 570 passed, 570 total
  Tests:       18,153 passed, 18,153 total
EXIT: 0

cd mcp-server && deno test --allow-net --allow-env --allow-read
→ ok | 871 passed | 0 failed (4s)
EXIT: 0

npm run typecheck → EXIT 0
npm run lint → EXIT 0
```

Cross-family byte-equal verification (reviewer-confirmed pre-merge):
- `mcp-server/lib/family{A,B,C,D,E}*.ts`: 0 diff lines
- `mcp-server/lib/doctrineBanList.ts`: 0 diff lines (shared list byte-equal; F has its own scan per intent §5)
- `src/`: 0 diff lines
- `supabase/`: 0 diff lines (Edge familyRegistry F entry untouched)
- `package.json` / `package-lock.json`: empty diff (RO-36 preserved)
- `scripts/ops/audit-lint-rules.cjs`: empty diff (audit-lint rules unchanged)

4 historical audit-lint fixtures re-checked post-merge: exits `1, 0, 0, 0` (unchanged).

---

## Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12)

**Status:** PASS

### First-enforcement provenance (BINDING per intent D12)

> "First-enforcement provenance: this is the first family-ship PR to be linted by audit-lint CI with a non-empty in-scope set. CI workflow run ID: `26600377487` (https://github.com/kyleruff1/cDiscourse/actions/runs/26600377487/job/78382214631); in_scope count: 1 (the smoke template `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-template.md` was newly added → classified IN SCOPE by the A-without-marker rule → linter detected it as a template via the `-template.md` filename pattern → SKIPPED → exit 0); linter exit: 0. L1-L6 mechanical enforcement empirically validated end-to-end on the family-ship PR pathway."

The CI exercise demonstrates the full enforcement loop on a real family-ship PR:
1. PR #344 added the smoke template (matches `docs/audits/**SMOKE*.md` trigger path)
2. `audit-lint.yml` workflow triggered (PR base SHA `87a2784`; head SHA `eca7251`)
3. Classifier (`--classify-changed`) identified the template as in-scope (Added file rule)
4. Linter invoked on the template; template-refusal rule fired (filename ends `-template.md`); exit 0
5. Workflow exit 0 (8s wall time)

**This provenance subsection is the centerpiece of the smoke audit per intent D12.** The amendment-eventual PASS will inherit and extend this provenance with the live Phase 4b + hosted Phase 3 outcomes.

### 6-family operational state

| Family | Production | Auto-trigger | Admin validation | This card change |
| --- | --- | --- | --- | --- |
| A (parent_relation) | YES | YES | YES | byte-equal |
| B (disagreement_axis) | YES | YES | YES | byte-equal |
| C (misunderstanding_repair) | YES | YES | YES | byte-equal |
| D (evidence_source_chain) | YES | YES | YES | byte-equal |
| E (argument_scheme) | NO | NO | YES | byte-equal |
| **F (critical_question)** | NO | NO | **YES (new)** | **shipped this card** |

5 unsupported families: G (resolution_progress), H (claim_clarity), I (thread_topology), J (sensitive_composer). Each rejects under `mcp_validation_failed` per the retargeted dispatch tests.

### Doctrine signal calibration (deferred to amendment)

The live evidence_span content + per-key density measurements will populate at amendment time.

### Operator backlog (carry forward; do not action here)

1. **Stale production-rejection error message** (carried forward from `bccb0c2`)
2. **F1 Anthropic transient** (Q9 watch; carried forward from `b1829f5`)

---

## Phase 8 — Verdict + authorization

### Final verdict

**PARTIAL** — Phase 1 + 2 + 6 + 7 PASS; Phase 3 NOT-RUN per L1/R2 (caps PARTIAL); Phase 4 + 4b + 5 NOT-RUN (operator-deferred for authenticated-session smoke). The L1-L6 audit-lint rules CONSISTENT-PARTIAL test passes: a PARTIAL verdict with NOT-RUN required phases is the correct shape and the linter does NOT flag this audit.

Phase 7 enforcement-loop provenance subsection is complete and represents the binding centerpiece of this audit per intent D12.

### Chain disposition (per operator's HARD chain rule)

Per the operator's three-card-chain launch message: "Any card PARTIAL or FAIL → HALT chain. File scoped fix card. Do NOT proceed to next card." This audit's PARTIAL verdict triggers the HALT.

Operator options:
- **Amend to PASS** by running hosted Phase 3 + Edge Phase 4/4b/5 live + posting redacted evidence (Family E hosted-completion pattern; `bccb0c2`). PASS lifts the cap → chain proceeds to Gate A.
- **Override chain rule** and proceed to Card 2 (Family E production flip is structurally independent of Family F live smoke).
- **Pause chain** to allow F admin baseline accumulation before Card 3, while running Card 2 in isolation later.

### Authorizations on PARTIAL

- `MCP-SERVER-007-FAMILY-F-SMOKE: PARTIAL` (Phase 3 NOT-RUN per L1/R2; Phase 4b NOT-RUN per L5 BINDING)
- Family F admin_validation infrastructure SHIPPED (D6); production flip authorization (Card 3) WITHHELD until Phase 4b live verification produces ≥1 clean firing
- `MCP-021C-EDGE-FAMILY-E-ENABLE` (Card 2) STRUCTURALLY READY but chain HALTED per operator rule pending PARTIAL → PASS amendment or override

### Pre-push audit-lint (D11)

```
node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md
→ Expected: 0 findings (PASS); PARTIAL-with-NOT-RUN is consistent
→ EXIT: 0
```

(Verified locally before commit.)

### Operator cleanup

No temp artifacts created this phase. No service-role usage. No secrets logged. No `.env*` touched. No migration. No Supabase deploy beyond Edge auto-deploy on merge.
