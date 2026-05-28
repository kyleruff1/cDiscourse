# MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-F-ENABLE (Family F critical_question production-mode flip; 14-key uniform ai_classifier; second production-enable card under L3+L4+L5 mechanical CI enforcement; FIRST card with L5 BINDING enforcement)
**Chain position:** Card 3 (terminal) of 3 in FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE → EDGE-FAMILY-F-ENABLE (this) chain
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

> Template binding source: intent brief §9 (8-phase smoke incl. L3+L4+L5
> mechanical CI enforcement + L5 BINDING for Family F doctrine-risk) +
> design §"Smoke template skeleton". Fill each section after merge;
> commit the completed audit to `docs/audits/` as
> `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## L5 BINDING — operator obligation (read before starting)

**Family F is doctrine-risk-by-construction.** Every critical-question
key surfaces a productive inquiry, but a naive rendering could read as
a verdict on the argument's quality. Card 1 amendment (`deff068`)
empirically verified Family F is clean under admin_validation (19
persisted rows × 16 doctrine patterns = 0 dirty rows, 0 fallacy
echoes). This card extends that posture to production.

**The L5 BINDING obligation in this audit is OPERATOR-BINDING from
intent §6 D6.L5, not CI-mechanically enforced.** The
`DOCTRINE_RISK_FAMILIES` constant in `scripts/ops/audit-lint-rules.cjs`
currently contains `argument_scheme` + `slippery_slope` but NOT
`critical_question` (intent §2 OUT forbids editing
`scripts/ops/audit-lint*` in this card; that's a follow-up OPS card).
The audit author MUST treat Phase 4b as binding-required (NOT optional)
regardless of CI's current scope. The audit must include explicit
`evidence_span` inspection content so that even if a future card adds
`critical_question` to `DOCTRINE_RISK_FAMILIES`, this audit
retroactively complies.

---

## Operator fallback rules (Gate B; read before Phase 2/3)

These rules are operator-binding from intent §6 D6.L4 + Gate B baseline
data review (intent §3). Carry them to the targeted-fixture decision.

1. **Do NOT use arg `781f8057` as targeted-signal** (known 3/3
   `mcp_validation_failed` pattern from Card 1 admin_validation baseline).
2. **Do NOT use prior known-failing fixtures as primary production
   proof.** This rules out the Card 1 amendment adversarial fixtures
   (`cd67e76f`, `f1757532`, `5242c8cd` per amendment Phase 4b
   provenance). Use NEW critical-question-targeted text crafted at smoke
   time.
3. **If first targeted F production fixture returns
   `mcp_validation_failed`:** do NOT mark PASS; retry once with a
   stronger, clearer critical-question fixture; if still fails, HALT
   and file a scoped fix card.
4. **If production F fires with a banned doctrine token in
   `evidence_span`:** IMMEDIATE HALT, mark FAIL, and file a scoped fix
   card (intent §6 HALT trigger #17 BINDING DOCTRINE FAIL).

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the 10 known
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] Verify Edge familyRegistry Family F entry post-merge state:
      `productionEnabled: true, adminValidationEnabled: true`.
- [ ] Verify A/B/C/D/E entries byte-equal preserved (productionEnabled: true).
- [ ] Verify G/H/I/J entries byte-equal preserved (productionEnabled: false).
- [ ] Targeted regression: Jest test count >= 18,173 + new tests; Deno
      871 byte-equal (no mcp-server change).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Auto-trigger dispatch (L3a) — 6 production runs A+B+C+D+E+F

**L3a obligation:** auto-trigger fires; run row status=success; 6
production runs created on a new arg via `submit-argument`;
run_mode='production' on every row.

- [ ] Submit a NEW critical-question-targeted argument via
      `submit-argument` Edge Function. **Operator binding (Gate B fallback
      rule 1+2): the targeted body MUST be NEW critical-question-targeted
      text that's NOT `781f8057` and NOT a prior known-failing fixture**
      (rules out `cd67e76f`, `f1757532`, `5242c8cd` which are Family F
      Phase 4b adversarial fixtures from Card 1 amendment). Arg id
      recorded.
- [ ] Wait ~30s for the 6-family dispatch to complete.
- [ ] Query `argument_machine_observation_runs` for the new arg id:
      verify EXACTLY 6 production runs (run_mode='production',
      provider_key=PROVIDER_KEY) for A+B+C+D+E+F observed.
- [ ] All 6 runs `status='success'` (or at minimum: A+B+C+D+E+F all
      `'success'` or `'failed'` cleanly; no missing rows).
- [ ] G/H/I/J do NOT have production rows for this arg (registry-derived
      dispatcher correctly excluded them; query asserts zero matches).
- [ ] Capture latency: per-family duration table + total dispatch
      wall-time. Expected ~27-28s per design A.4 projection.

**Result:** ☐ PASS ☐ FAIL — _<notes; arg id; run ids>_

---

## Phase 3 — Targeted-signal (L3b + L4) — Family F positive result row required

**L3b + L4 obligation (per operator binding instruction; intent §6
D6.L4):** the targeted arg MUST contain deliberately critical-question-
targeted text (causal mechanism implied without explanation; analogy
without mapping; consequence without probability anchor; warrant
assumed but unstated; etc.). At least 1 positive result row from
targeted text. **0 positives on a targeted text is NOT PASS** — use a
stronger targeted critical-question fixture before accepting PASS.

**Fallback rules (operator binding from Gate B fallback rule 3):**
- If first targeted F production fixture returns `mcp_validation_failed`:
  do NOT mark PASS; retry once with a stronger, clearer critical-
  question fixture; if still fails, HALT and file a scoped fix card.

- [ ] Submit a SECOND new argument with body deliberately exercising
      one or more Family F critical-question patterns (recommended
      starter fixture: a body whose pattern is likely to trigger
      `consequence_probability_unclear`, `causal_mechanism_missing`,
      `analogy_mapping_missing`, or `counterexample_available` — the
      doctrine-risk-paired keys for Phase 4b L5 BINDING coverage). Arg
      id recorded.
- [ ] Wait ~30s for the 6-family dispatch.
- [ ] Query `argument_machine_observation_results` for the new arg's
      Family F production run:
      `SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results r JOIN argument_machine_observation_runs runs ON runs.id = r.run_id WHERE r.family = 'critical_question' AND runs.run_mode = 'production' AND runs.argument_id = '<arg-id>';`
- [ ] Verify at least 1 positive result row (`raw_key` in the 14-key
      Family F set: missing_warrant, unstated_assumption,
      authority_basis_missing, causal_mechanism_missing,
      analogy_mapping_missing, example_representativeness_unclear,
      consequence_probability_unclear, definition_boundary_unclear,
      criterion_weighting_unclear, alternative_explanation_available,
      counterexample_available, scope_limit_unstated,
      qualification_missing, comparison_baseline_missing; `confidence`
      band emitted). Record the result-row evidence as a
      `raw_key | confidence | evidence_span` table so the L4 lint
      pattern matches the doc.
- [ ] **If 0 positives:** record the fixture text, design a stronger
      targeted fixture, resubmit, repeat. PASS REQUIRES at least 1
      positive result row from targeted text.
- [ ] **If `mcp_validation_failed`:** apply Gate B fallback rule 3 (one
      retry with stronger fixture; HALT if second attempt also fails).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture text>_

---

## Phase 4 — Read-path (L3c) — Source 6 production rows visible

**L3c obligation:** Source 6 production-only filter
(`machineObservationPersistenceQuery.ts:127`) returns the Family F
production result rows for the Phase 3 arg.

- [ ] Source 6 query path
      (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
      `run_mode='production'` filter via PostgREST `!inner` join) returns
      the Family F production result rows for the Phase 3 arg.
- [ ] A+B+C+D+E rows ALSO present in the Source 6 result for the same
      arg (6-family production read-path coverage verified).
- [ ] admin_validation rows for the same arg (if any exist) are NOT
      counted as production proof — they are filtered out by the
      production-only filter (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family F has no `deterministic_key` rows in
      production (F is uniform ai_classifier; no auto_metadata /
      lifecycle source contamination).

**Result:** ☐ PASS ☐ FAIL — _<query output excerpts>_

---

## Phase 4b — DOCTRINE (L5 BINDING) — persisted evidence_span doctrine inspection

**L5 BINDING obligation (intent §6 D6.L5; BINDING):** Family F is
doctrine-risk-by-construction. If `consequence_probability_unclear` or
any E-paired critical-question key fires on the production-mode
targeted arg, perform the persisted-output inspection.

> **NOTE on audit-lint enforcement:** `DOCTRINE_RISK_FAMILIES` in
> `scripts/ops/audit-lint-rules.cjs` currently contains `argument_scheme`
> and `slippery_slope` but NOT `critical_question`. Per intent §2 OUT
> binding, this card MUST NOT modify `scripts/ops/audit-lint*`. The L5
> BINDING obligation in this audit is therefore **operator-binding from
> the intent brief, not CI-mechanically enforced**. The audit must
> include explicit `evidence_span` inspection content so that even if a
> future card adds `critical_question` to `DOCTRINE_RISK_FAMILIES`, this
> audit will retroactively comply. The audit author MUST treat L5 as
> binding-required (not optional) regardless of CI's current scope.

- [ ] **R1 — column pre-check:** verify the `argument_machine_observation_results`
      table has columns `raw_key`, `confidence`, `evidence_span`,
      `family`, `run_id`. (Catches a schema drift that would silently
      break the doctrine scan.) Same column set verified at Card 1
      amendment `deff068` Phase 4b and Card 2 Phase 4b.
- [ ] If `consequence_probability_unclear` or another E-paired CQ key
      fired in Phase 3: skip to "ban-list scan" below.
- [ ] If NOT fired: design a STRONGER targeted critical-question fixture
      whose pattern is likely to trigger one of the doctrine-risk-paired
      keys (consequence_probability_unclear / causal_mechanism_missing /
      analogy_mapping_missing / counterexample_available). Resubmit;
      query; repeat Phase 3 + 4 for the new arg.
- [ ] **Ban-list scan over 16 patterns** (same set as Card 1 amendment
      `deff068`):
      `unmet-means-fallacy`, `proves wrong`, `invalidates`, `refutes`,
      `fallacy`, `fallacious`, `flawed`, `wrong`, `weak argument`,
      `invalid argument`, `bad reasoning`, `proof of`, `weak`,
      `invalid`, `logical error`, `informal fallacy`.
- [ ] Query persisted `evidence_span` for the Family F production rows
      containing CQ keys; scan for any of the 16 patterns. Verify ZERO
      banned tokens present.
- [ ] If targeted input contained "fallacy" or similar adversarial
      verdict bait: verify NO ECHO in output `evidence_span`.
- [ ] **If a banned token is present in persisted F production
      `evidence_span`:** **HALT IMMEDIATELY** and FAIL (intent §6 HALT
      trigger #17 BINDING DOCTRINE FAIL; file scoped fix card).
      Gate B fallback rule 4 applies.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; CQ rows; ban-list scan output>_

---

## Phase 5 — Regression

- [ ] A/B/C/D/E production behavior unregressed (Phase 2 verified
      A+B+C+D+E ran; this section confirms there's no quality drift in
      their output for the new args).
- [ ] admin_validation still works for E + F (operator HTTP call against
      `classify-argument-boolean-observations` with `mode: 'admin_validation'`
      and `requestedFamilies: ['critical_question']` returns a Family F
      admin_validation run row; same for E).
- [ ] G/H/I/J still reject under `mcp_validation_failed` for
      admin_validation calls (unsupported-family behavior preserved).
- [ ] Local gates: `npm run typecheck`, `npm run lint`,
      `npm run test`, `cd mcp-server && deno test --allow-net
      --allow-env --allow-read` all exit 0.

**Result:** ☐ PASS ☐ FAIL — _<gate output>_

---

## Phase 6 — Observability

- [ ] Q11 reframed (per-family per-mode coverage): Family F now shows
      production rows (FIRST real production data for F).
- [ ] Q14 density: Family F production density present. Pre-merge
      admin-baseline F density was 27.1% per-(run,key) (Gate B
      baseline). Production density may differ.
- [ ] Q9: no new `organic_duplicate_candidate` rows for the new args.
      Auto-trigger runs classify as `audit_or_smoke_rerun` (intent §6
      D8).
- [ ] Rerun the observability report (`node scripts/ops/mcp-observability-report.mjs --no-write`)
      and confirm Family F appears in production mode.

**Result:** ☐ PASS ☐ FAIL — _<observability report excerpts>_

---

## Phase 7 — OPS observations + enforcement-loop provenance

**Required subsection (verbatim per intent §9 Phase 7):**

> "Third-enforcement provenance: second PRODUCTION-ENABLE card linted
> by audit-lint CI; first card under L5 BINDING enforcement. CI workflow
> run ID: `<id from PR>`; in_scope count: `<n>`; linter exit: 0. L3
> satisfied by Phases 2+3+4 (dispatch ✓ + targeted-signal ✓ + read-path
> ✓). L4 satisfied by Phase 3 targeted critical-question text producing
> ≥1 positive result row. L5 BINDING satisfied by Phase 4b persisted
> evidence_span doctrine inspection (≥1 clean firing under production
> mode)."

- [ ] Record the 6-family operational state (A+B+C+D+E+F production
      LIVE; G/H/I/J admin baseline).
- [ ] Record latency observations (per-family + total dispatch
      wall-time).
- [ ] Doctrine-key calibration note (any unexpected Family F
      raw_key behaviour observed during the smoke).
- [ ] **Chain completion note:** 3-card chain complete; all 6 families
      production+auto-trigger; G/H/I/J unsupported.

**Result:** ☐ PASS ☐ FAIL — _<provenance subsection completed>_

---

## Phase 8 — Verdict + authorization

- [ ] **Pre-push audit-lint:** `node scripts/ops/audit-lint.mjs
      docs/audits/MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-<date>.md` exits 0
      before push.
- [ ] CI runs on the smoke audit PR and exits 0 (L1-L6 mechanically
      enforced; L3+L4 mechanical obligations met; L5 operator-binding
      satisfied via explicit `evidence_span` content even if
      `critical_question` is not in `DOCTRINE_RISK_FAMILIES`).
- [ ] Verdict:
  - **PASS:** All 8 phases clean; L3/L4/L5 each satisfied by an
    explicit phase; Phase 4b ≥1 clean firing (doctrine-clean);
    pre-lint + CI both exit 0; A/B/C/D/E unregressed.
  - **PARTIAL:** Phase 3 0-positives even on stronger targeted arg
    (sparse signal); Phase 4b 0-fire even after fallback fixture.
    Card 3 PASS is required to fully close the 3-card chain.
  - **FAIL:**
    - Phase 4b dirty firing (banned token in F production
      `evidence_span`) → IMMEDIATE HALT + fix card.
    - Phase 3 `mcp_validation_failed` on first AND fallback targeted
      → HALT + fix card.
    - Any non-Family-F rawKey on F run.
    - Family A/B/C/D/E byte-equal failure.
    - CI passes an L3/L4/L5-missing audit.

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE: PASS`
- Family F PRODUCTION + auto-trigger LIVE (6 production families:
  A+B+C+D+E+F)
- 3-card chain COMPLETE
- `MCP-SERVER-008-FAMILY-G` AUTHORIZED to begin (G/H/I/J still
  unsupported)

**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<verdict notes>_

---

**Required final step:** Run `node scripts/ops/audit-lint.mjs <this-doc>`;
MUST exit 0 before Verdict line is valid.
