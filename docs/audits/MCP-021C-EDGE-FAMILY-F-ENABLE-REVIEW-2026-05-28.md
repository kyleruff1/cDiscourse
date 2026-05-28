# MCP-021C-EDGE-FAMILY-F-ENABLE — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-28
**Branch:** feat/MCP-021C-EDGE-FAMILY-F-ENABLE
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/347
**HEAD at review:** `d5bf089`
**Design:** docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE.md (`c04fed2`)
**Intent:** docs/designs/MCP-021C-EDGE-FAMILY-F-ENABLE-intent.md (`24ccb45`)
**Chain position:** Card 3 (terminal) of 3 in FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE → EDGE-FAMILY-F-ENABLE

---

## Summary

This terminal card ships a single-character production-mode flip for
Family F (`critical_question`) — `productionEnabled: false → true` at
`supabase/functions/_shared/booleanObservations/familyRegistry.ts:96`.
`adminValidationEnabled` stays `true`. Auto-trigger extends from 5 → 6
production families automatically via the registry-derived dispatcher;
NO dispatcher / prompt / mcp-server code change required. The
implementation is byte-precise against the design and intent: scope is
exactly the one boolean + 19 defensive tests (FFE-1..16) + 6 stale-
assertion flips + a smoke template carrying `Audit-Lint: v1`. All 20
HALT triggers from intent §6 are clean. All 24 conditional checks pass.
Verification gates exit 0 across the board (typecheck, lint, full Jest
572 suites / 18,192 tests, Deno 871 / 0 failed, audit-lint on template
`[skip] template doc`). The smoke template encodes Gate B's 4 operator
fallback rules verbatim and includes a dedicated L5 BINDING section
near the top stating the operator-binding obligation regardless of CI's
current `DOCTRINE_RISK_FAMILIES` scope. Approve to push.

---

## Verification

| Gate | Result |
| --- | --- |
| typecheck (`npm run typecheck`) | pass (exit 0) |
| lint (`npm run lint`) | pass (exit 0) |
| Jest full (`npx jest --no-coverage`) | pass: 18,192 tests / 572 suites / 0 failed (baseline 18,173 → +19 net) |
| Deno (`cd mcp-server && deno test --allow-net --allow-env --allow-read`) | pass: 871 passed / 0 failed (byte-equal vs Card 2 baseline) |
| Targeted Jest (`--testPathPattern="(familyRegistry|autoTrigger|edgeFamily|AdminValidation)"`) | pass: 291 tests / 15 suites (was 272 / 14 pre-card) |
| Audit-lint on smoke template | `[skip] template doc` exit 0 |
| Audit-lint historical fixtures (4) | exits 1, 0, 0, 0 (expected) |
| Secret scan (regex on full diff) | clean — no key/token/Authorization literal |
| Doctrine scan (verdict tokens in production source) | clean — `familyRegistry.ts` + new test file scanned; zero matches |
| Working tree at review time | clean — exactly 10 operator-territory untracked files (matches spawn-time list) |

---

## 20-item HALT matrix (intent §6)

### Registry + data safety (1-7)

1. **PASS** — `familyRegistry.ts` diff is 1 char (`false → true`) at line 96 only. `git diff main..HEAD -- supabase/functions/_shared/booleanObservations/familyRegistry.ts` shows exactly 1 `-` line + 1 `+` line in the `critical_question` block; no other family entry touched.
2. **PASS** — A (line 71), B (line 76), C (line 81), D (line 86), E (line 91) `productionEnabled: true` byte-equal preserved. G (line 101), H (line 106), I (line 111), J (line 116) `productionEnabled: false` byte-equal preserved.
3. **PASS** — `autoTriggerDispatcher.ts` byte-equal (not in `git diff main..HEAD --name-only`). Source-text confirms line 87 still imports `productionEnabledFamilies` and line 403 still materializes `eligibleFamilies = productionEnabledFamilies()` at runtime; no hard-coded family list.
4. **PASS** — F `adminValidationEnabled: true` unchanged at line 97 (the unmodified second field of the F entry).
5. **PASS** — `machineObservationPersistenceQuery.ts` byte-equal (not in changed-files list). Source 6 filter `run_mode='production'` family-agnostic; F production rows visible automatically.
6. **PASS** — `supabase/migrations/` byte-equal (no files in `git diff main..HEAD --name-only -- supabase/migrations/`).
7. **PASS** — `booleanObservationRequestBuilder.ts` byte-equal. `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` at lines 68-72 contains only `evidence_source_chain`; NO `critical_question` entry. FFE-15 source-text scan defends this.

### Protocol + security (8-13)

8. **PASS** — No new taxonomy keys; `mcp-server/lib/familyF*.ts` and `src/features/nodeLabels/machineObservationDefinitions/familyF.ts` byte-equal (not in changed-files list).
9. **PASS** — No MCP schema version change; `mcpBooleanObservationSchemaMirror.ts` byte-equal.
10. **PASS** — `mcp-server/lib/familyA*.ts`, `familyB*.ts`, `familyC*.ts`, `familyD*.ts`, `familyE*.ts`, `familyF*.ts` all byte-equal (`git diff main..HEAD -- mcp-server/lib/` returns empty).
11. **PASS** — No mcp-server file changes; Deno regression 871/871 byte-equal vs Card 2 baseline.
12. **PASS** — Secret-scan regex on full diff returns only meta-references in design/status text (a "Bearer" word in human prose; `§6 — Secrets policy | No env vars added…` meta-affirmation). No actual key/token literal.
13. **PASS** — No raw logging change (no source file modified except 1-char registry flip).

### Architecture (14-15)

14. **PASS** — Auto-trigger preserved for A/B/C/D/E; cross-family defenses present (FFE-10 / FFE-11 / FFE-12 / FFE-13 / FFE-14 each assert `productionEnabled: true` for A/B/C/D/E individually). Targeted Jest 15/15 suites green.
15. **PASS** — Test forecast +19 ≪ +100 HALT (baseline 18,173 → final 18,192).

### Doctrine — F-specific (16-17)

16. **PASS** — Smoke template Phase 4b (lines 183-229) is the L5 BINDING section. Lines 185-188 declare BINDING obligation. Note block (lines 190-199) explicitly states `DOCTRINE_RISK_FAMILIES` currently doesn't include `critical_question`; the audit author MUST treat L5 as binding-required regardless of CI's current scope. R1 column pre-check at line 201. 16-pattern ban-list scan at lines 213-218. The dedicated **L5 BINDING — operator obligation** section at lines 22-41 is positioned near the top, reinforcing that the obligation is operator-binding from intent §6.
17. **PASS** — Smoke template line 62-63 states "**If production F fires with a banned doctrine token in `evidence_span`:** IMMEDIATE HALT, mark FAIL, and file a scoped fix card (intent §6 HALT trigger #17 BINDING DOCTRINE FAIL)." Re-stated at lines 224-227 in Phase 4b. Re-stated at lines 311-313 in Phase 8 FAIL rules.

### Enforcement-loop (18-19)

18. **PASS** — `Audit-Lint: v1` is on line 3 of the smoke template.
19. **PASS** — `node scripts/ops/audit-lint.mjs docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` returns `[skip] template doc: MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` with exit 0.

### Working tree (20)

20. **PASS** — `git status --porcelain` shows exactly the 10 known operator-territory untracked files at review time: 4 testing-runs files from 2026-05-25 + 3 mcp021c-edge-smoke artifacts + `netlify-prod.git` + 2 phase5 logs. Matches spawn-time list byte-for-byte.

---

## Additional checks

### A. FFE-1..16 defensive test coverage

**PASS.** `__tests__/edgeFamilyFProductionEnable.test.ts` (187 lines, 19 tests across 5 describe blocks):

- FFE-1 (line 33-37): F `productionEnabled=true`
- FFE-2 (line 39-43): F `adminValidationEnabled=true` (HALT #4 defense)
- FFE-3 (line 45-47): `edgeProductionEnabledFamilies()` includes `critical_question`
- FFE-4 (line 49-51): length 6
- FFE-5 (line 53-62): production list = `[parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question]` in registry order
- FFE-6 (line 64-68): `edgeFilterFamiliesForMode(['critical_question'], 'production')` keeps `critical_question`
- FFE-7:G/H/I/J × 4 (lines 79-86): G/H/I/J each `productionEnabled=false` (HALT #2 widening defense; parametrized loop)
- FFE-8 (line 89-93): F at index 5 in `EDGE_FAMILY_REGISTRY`
- FFE-9 (line 95-98): A still first (iteration order)
- FFE-10..14 (lines 105-133): A/B/C/D/E `productionEnabled=true` unchanged (cross-family regression)
- FFE-15 (line 137-158): source-text scan of `booleanObservationRequestBuilder.ts` — `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` constant block must not contain `critical_question`
- FFE-16 (line 160-186): production-mode Family F request contains all 14 ai_classifier rawKeys; byte-equal (sorted) vs admin_validation-mode

All 16 logical predicates present; matches design intent §6 §D7 exactly.

### B. Smoke template Gate B operator fallback rules verbatim

**PASS.** All 4 fallback rules present in `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md` lines 50-63:

1. Line 50-51: "Do NOT use arg `781f8057` as targeted-signal (known 3/3 mcp_validation_failed pattern from Card 1 admin_validation baseline)."
2. Line 52-56: "Do NOT use prior known-failing fixtures as primary production proof. This rules out the Card 1 amendment adversarial fixtures (`cd67e76f`, `f1757532`, `5242c8cd` per amendment Phase 4b provenance). Use NEW critical-question-targeted text crafted at smoke time."
3. Line 57-60: "If first targeted F production fixture returns `mcp_validation_failed`: do NOT mark PASS; retry once with a stronger, clearer critical-question fixture; if still fails, HALT and file a scoped fix card."
4. Line 61-63: "If production F fires with a banned doctrine token in `evidence_span`: IMMEDIATE HALT, mark FAIL, and file a scoped fix card (intent §6 HALT trigger #17 BINDING DOCTRINE FAIL)."

Fallback rules also re-stated at the per-phase points where they bind (Phase 2 line 92-94 for rules 1+2; Phase 3 lines 123-126 for rule 3; Phase 4b line 226-227 for rule 4).

### C. L5 BINDING section in smoke template

**PASS.** Dedicated **L5 BINDING — operator obligation** block at lines 22-41 (above Phase 1), plus restatement at Phase 4b (lines 183-228):

- Lines 22-30 state L5 BINDING is operator-binding even though CI `DOCTRINE_RISK_FAMILIES` doesn't include `critical_question` (operator must treat as binding regardless of CI's current scope).
- Lines 31-41 explain audit-lint enforcement scope and obligation persistence (audit must include explicit `evidence_span` inspection content so a future CI scope extension retroactively complies).
- Phase 4b line 201-205 specifies R1 column pre-check (`raw_key`, `confidence`, `evidence_span`, `family`, `run_id`).
- Phase 4b lines 213-218 specify the 16-pattern doctrine ban-list scan (`unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`, `fallacy`, `fallacious`, `flawed`, `wrong`, `weak argument`, `invalid argument`, `bad reasoning`, `proof of`, `weak`, `invalid`, `logical error`, `informal fallacy`).
- Phase 4b lines 224-227 specify zero-tolerance HALT on banned token in persisted F production `evidence_span`.

### D. 4 historical audit-lint fixtures still self-validate

**PASS.** Exit codes match expected (1, 0, 0, 0):

```
original-family-e-IMPROPER-PASS: exit=1
family-e-amendment-PARTIAL: exit=0
family-e-hosted-completion-PASS: exit=0
family-d-strengthened-amendment-PASS: exit=0
```

Confirms audit-lint engine semantics unchanged by this card (scope binding holds — `scripts/ops/audit-lint*` byte-equal).

---

## Design conformance

- [x] All design file-changes present (1 boolean flip + 19 defensive tests + 6 stale-assertion flips + smoke template + current-status paragraph + design doc)
- [x] No undocumented file-changes (`git diff main..HEAD --name-only` shows exactly 11 files; each matches design intent)
- [x] Data model unchanged (no migration)
- [x] Edge Function code unchanged (registry-only flip)
- [x] mcp-server byte-equal (Deno 871/871)
- [x] Auto-trigger 6-family extension achieved via registry-derivation (no dispatcher edit)
- [x] Stage 2B NOT REQUIRED determination respected (no subset filter for F; FFE-15 source-text scan defends)
- [x] Test forecast +25..+70 band (+19 came in slightly under the lower bound — defensive coverage is concentrated in FFE-1..16 and the 6 stale-assertion flips; designer's expected band was conservative)

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings (production-source scan clean; verdict tokens appear only in design/audit/test content discussing what is forbidden — meta-doctrine, not assertions)
- [x] Score never blocks posting (no score logic changed)
- [x] No service-role in client code (zero changes to `app/` or `src/`)
- [x] No direct insert into `public.arguments` (no migration; no Edge Function code change)
- [x] No new AI calls in production app paths (registry-only flip; auto-trigger already-existing path is what extends)
- [x] Plain language only (no raw internal codes leaked to UI strings — no UI change in this card)
- [x] Epic-specific doctrine (cdiscourse-doctrine §1, §3, §10a — Machine Observations are structural; production enablement is gameplay-routing, never a verdict on the family's quality; per registry header at `familyRegistry.ts:27-29`)
- [x] L5 BINDING obligation encoded in smoke template (operator-binding; CI-mechanical extension is a follow-up OPS card per intent §2 OUT)

## Test coverage

- [x] New public function (`productionEnabledFamilies()`) post-flip behavior asserted by FFE-3, FFE-4, FFE-5
- [x] User-facing strings: no UI change in this card; existing ban-list tests still pass
- [x] Edge cases from design (subset filter absence; cross-family regression; auto-trigger 6-family inclusion; G-J widening defense) all covered by FFE-15, FFE-10..14, FFE-7:G..J
- [x] FFE-16 byte-equal cross-mode assertion is a strong defense against accidental subset filter introduction
- [x] Smoke template Phase 4b includes the L5 BINDING obligation as explicit operator binding even though CI scope hasn't extended yet

---

## Blockers

None.

---

## Suggestions (non-blocking)

1. **Follow-up OPS card**: extend `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` to include `critical_question` so the L5 BINDING obligation becomes CI-mechanically enforced (currently operator-binding). The smoke template already explicitly documents that retroactive compliance via explicit `evidence_span` content is guaranteed regardless of when this extension lands. This is correctly named in intent §2 OUT as a future OPS card; no action needed in this card.

2. **Designer Phase A.4 latency projection refinement** (post-smoke): if Phase 7 OPS observations reveal actual 6-family wall-time differs materially from the 27-28s projection, capture the refined per-family timing for future planning.

3. Test forecast came in at +19 vs design band +25..+70. This is a conservative count for the registry shape — the +19 captures FFE-1..16 + 3 cross-card stale-assertion deltas (Card 2's FEE binding adjusts; D's FDE binding adjusts; the AVM/DREG/FE/FR adjustments are net-0 to net-+1 each because tests were UPDATED rather than added). Not a defect; just a note for future-card forecast calibration.

---

## Operator next steps

1. Push the branch:
   ```
   git push -u origin feat/MCP-021C-EDGE-FAMILY-F-ENABLE
   ```

2. Open PR (closes issue #347):
   ```
   gh pr create \
     --title "MCP-021C-EDGE-FAMILY-F-ENABLE: Family F production-mode flip (Card 3 of 3-card chain)" \
     --body-file docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-REVIEW-2026-05-28.md
   ```

3. Post-merge:
   - Supabase auto-deploys the new `familyRegistry.ts` via the GitHub integration (1-char source change; standard auto-deploy path; no manual deploy).
   - Deno auto-deploys (no mcp-server change; nothing to redeploy in practice — Deno deploy is a no-op for this card).

4. Post-merge 8-phase smoke per `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-template.md`:
   - Phase 1 pre-flight (verify Edge familyRegistry shows F `productionEnabled: true`)
   - Phase 2 dispatch (NEW arg via `submit-argument`; verify 6 production runs A+B+C+D+E+F; G/H/I/J do NOT run)
   - Phase 3 targeted-signal (NEW critical-question-targeted text; verify ≥1 F production positive result row; Gate B fallback rules 1+2+3 apply)
   - Phase 4 read-path (Source 6 returns F production rows)
   - **Phase 4b L5 BINDING** (R1 column pre-check + 16-pattern doctrine ban-list scan over persisted `evidence_span`; HALT on any banned token; Gate B fallback rule 4 applies)
   - Phase 5 regression (A/B/C/D/E unregressed; admin_validation still works for E+F; G/H/I/J reject)
   - Phase 6 observability (Q9 / Q11 / Q14)
   - Phase 7 OPS provenance subsection (verbatim per template lines 273-280; chain completion note)
   - Phase 8 verdict + authorization

5. Smoke audit commit on `main` named `docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md`.
   - Local pre-lint: `node scripts/ops/audit-lint.mjs docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md` MUST exit 0 before push.
   - CI on smoke audit PR MUST exit 0.

6. Post-merge worktree cleanup (per `roadmap-reviewer.md` § "Post-merge worktree cleanup"):
   ```
   git worktree list | grep "feat/MCP-021C-EDGE-FAMILY-F-ENABLE"
   git worktree remove -f -f ".claude/worktrees/agent-<hash>"
   git branch -D feat/MCP-021C-EDGE-FAMILY-F-ENABLE
   git worktree list | grep -c "agent-<hash>"   # must print 0
   ```

7. Authorizations granted on smoke PASS:
   - `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
   - Family F PRODUCTION + auto-trigger LIVE (6 production families: A+B+C+D+E+F)
   - **3-card chain COMPLETE**
   - `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin (G/H/I/J still unsupported)
