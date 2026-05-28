# MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE — audit template

Audit-Lint: v1

**Card:** MCP-021C-EDGE-FAMILY-E-ENABLE (Family E argument_scheme production-mode flip; 16-key uniform ai_classifier; first production-enable card under L3+L4+L5 mechanical CI enforcement)
**Chain position:** Card 2 of 3 in FAMILY-F-SHIP → EDGE-FAMILY-E-ENABLE (this) → EDGE-FAMILY-F-ENABLE chain
**Operator:** _<operator-name>_
**Date:** _<YYYY-MM-DD>_
**Merge SHA:** _<sha-of-PR-merge-into-main>_
**Edge Function build:** _<supabase-function-version>_ (auto-deployed via GitHub integration)

> Template binding source: intent brief §8 (8-phase smoke incl. L3+L4+L5
> mechanical CI enforcement) + design §"Smoke template skeleton". Fill
> each section after merge; commit the completed audit to `docs/audits/`
> as `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<YYYY-MM-DD>.md`. Local pre-lint
> `node scripts/ops/audit-lint.mjs <audit-doc>` MUST exit 0 before push;
> CI MUST exit 0 on the smoke audit PR.

---

## Phase 1 — Pre-flight

- [ ] HEAD at merge SHA; git status clean (only the 10 known
      operator-territory untracked files).
- [ ] Edge Functions auto-deployed via GitHub integration:
      `submit-argument` and `classify-argument-boolean-observations`
      reflect post-merge version timestamps.
- [ ] Verify Edge familyRegistry Family E entry post-merge state:
      `productionEnabled: true, adminValidationEnabled: true`.
- [ ] Verify A/B/C/D entries byte-equal preserved (productionEnabled: true).
- [ ] Verify F/G/H/I/J entries byte-equal preserved (productionEnabled: false).
- [ ] Targeted regression: Jest test count >= 18,153 + new tests; Deno
      871 byte-equal (no mcp-server change).

**Result:** ☐ PASS ☐ FAIL — _<notes>_

---

## Phase 2 — Auto-trigger dispatch (L3a) — 5 production runs A+B+C+D+E

**L3a obligation:** auto-trigger fires; run row status=success; 5
production runs created on a new arg via `submit-argument`;
run_mode='production' on every row.

- [ ] Submit a new argument via `submit-argument` Edge Function (debate
      seed; non-targeted body for the dispatch test; observed; arg id
      recorded).
- [ ] Wait ~30s for the 5-family dispatch to complete.
- [ ] Query `argument_machine_observation_runs` for the new arg id:
      verify EXACTLY 5 production runs (run_mode='production',
      provider_key=PROVIDER_KEY) for A+B+C+D+E observed.
- [ ] All 5 runs `status='success'` (or at minimum: A+B+C+D+E all
      `'success'` or `'failed'` cleanly; no missing rows).
- [ ] F/G/H/I/J do NOT have production rows for this arg (registry-derived
      dispatcher correctly excluded them; query asserts zero matches).
- [ ] Capture latency: per-family duration table + total dispatch
      wall-time.

**Result:** ☐ PASS ☐ FAIL — _<notes; arg id; run ids>_

---

## Phase 3 — Targeted-signal (L3b + L4) — Family E positive result row required

**L3b + L4 obligation (per operator binding instruction; intent §4
D6.L4):** the targeted arg MUST contain deliberately scheme-targeted
text (causal / principle / precedent / example / definition /
classification / consequence / analogy / authority / abductive /
slippery_slope / cost_benefit / risk / exception / tradeoff /
means_end). At least 1 positive result row from targeted text. **0
positives on a targeted text is NOT PASS** — use a stronger targeted
slippery_slope (or other E scheme) fixture before accepting PASS.

- [ ] Submit a SECOND new argument with body deliberately exercising one
      or more Family E schemes (recommended starter fixture: a
      slippery_slope-targeted body to hit the doctrine-risk path for
      Phase 4b). Arg id recorded.
- [ ] Wait ~30s for the 5-family dispatch.
- [ ] Query `argument_machine_observation_results` for the new arg's
      Family E production run.
- [ ] Verify at least 1 positive result row (`raw_key` in the 16-key
      Family E set; `confidence` band emitted). Record the result-row
      evidence as a `raw_key | confidence | evidence_span` table so the
      L4 lint pattern matches the doc.
- [ ] **If 0 positives:** record the fixture text, design a stronger
      targeted fixture, resubmit, repeat. PASS REQUIRES at least 1
      positive result row from targeted text.

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<arg id; positives table; fixture text>_

---

## Phase 4 — Read-path (L3c) — Source 6 production rows visible

**L3c obligation:** Source 6 production-only filter
(`machineObservationPersistenceQuery.ts:127`) returns the Family E
production result rows for the Phase 3 arg.

- [ ] Source 6 query path
      (`src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
      `run_mode='production'` filter via PostgREST `!inner` join) returns
      the Family E production result rows for the Phase 3 arg.
- [ ] A+B+C+D rows ALSO present in the Source 6 result for the same arg
      (5-family production read-path coverage verified).
- [ ] admin_validation rows for the same arg (if any exist) are NOT
      counted as production proof — they are filtered out by the
      production-only filter (Source 6 separation invariant holds).
- [ ] Defensive: confirm Family E has no `deterministic_key` rows in
      production (E is uniform ai_classifier; no auto_metadata /
      lifecycle source contamination).

**Result:** ☐ PASS ☐ FAIL — _<query output excerpts>_

---

## Phase 4b — DOCTRINE (L5) — persisted evidence_span ban-list scan

**L5 obligation (intent §4 D6.L5):** if `slippery_slope_reasoning_present`
fires on any production run, perform the persisted-output inspection on
`evidence_span`. If it does NOT fire on the Phase 3 targeted text, use a
stronger slippery_slope-targeted fixture before accepting PASS.

- [ ] **R1 — column pre-check:** verify the `argument_machine_observation_results`
      table has columns `raw_key`, `confidence`, `evidence_span`,
      `family`, `run_id`. (Catches a schema drift that would silently
      break the doctrine scan.)
- [ ] If `slippery_slope_reasoning_present` fired in Phase 3: skip to
      "ban-list scan" below.
- [ ] If NOT fired: design a STRONGER targeted slippery_slope fixture
      (chained "X → X1 → X2 → bad final state" body; multi-step
      consequence chain). Resubmit; query; repeat Phase 3 + 4 for the
      new arg.
- [ ] **Ban-list scan over 13 patterns** (per intent §4 D6.L5):
      `fallacy`, `fallacious`, `weak`, `weak argument`, `invalid`,
      `invalid argument`, `bad reasoning`, `flawed`, `flawed reasoning`,
      `wrong`, `proof of`, `logical error`, `informal fallacy`.
- [ ] Query persisted `evidence_span` for the Family E production rows
      containing `slippery_slope_reasoning_present`; scan for any of the
      13 patterns. Verify ZERO banned tokens present.
- [ ] If a banned token is present: HALT and FAIL (intent §"FAIL"
      conditions).

**Result:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<fixture text; slippery_slope row; ban-list scan output>_

---

## Phase 5 — Regression

- [ ] A/B/C/D production behavior unregressed (Phase 2 verified A+B+C+D
      ran; this section confirms there's no quality drift in their
      output for the new args).
- [ ] admin_validation still works for E + F (operator HTTP call against
      `classify-argument-boolean-observations` with `mode: 'admin_validation'`
      and `requestedFamilies: ['argument_scheme']` returns a Family E
      admin_validation run row; same for F).
- [ ] Local gates: `npm run typecheck`, `npm run lint`,
      `npm run test`, `cd mcp-server && deno test --allow-net
      --allow-env --allow-read` all exit 0.

**Result:** ☐ PASS ☐ FAIL — _<gate output>_

---

## Phase 6 — Observability

- [ ] Q11 reframed (per-family per-mode coverage): Family E now shows
      production rows (FIRST real production data for E).
- [ ] Q14 density: Family E production density present.
- [ ] Q9: no new `organic_duplicate_candidate` rows for the new args.
      Auto-trigger runs classify as `audit_or_smoke_rerun`.
- [ ] Rerun the observability report (`node scripts/ops/mcp-observability-report.mjs`)
      and confirm Family E appears in production mode.

**Result:** ☐ PASS ☐ FAIL — _<observability report excerpts>_

---

## Phase 7 — OPS observations + enforcement-loop provenance

**Required subsection (verbatim per intent §8):**

> "Second-enforcement provenance: first PRODUCTION-ENABLE card linted by
> audit-lint CI with L3+L4+L5 mechanically enforced. CI workflow run ID:
> `<id from PR>`; in_scope count: `<n>`; linter exit: 0. L3 satisfied by
> Phases 2+3+4 (dispatch+targeted-signal+read-path). L4 satisfied by
> Phase 3 targeted scheme text producing at least 1 positive result row.
> L5 satisfied by Phase 4b persisted evidence_span doctrine inspection
> (at least 1 clean firing)."

- [ ] Record the 6-family operational state (A+B+C+D+E production
      LIVE; F admin baseline; G/H/I/J admin baseline).
- [ ] Record latency observations (per-family + total dispatch
      wall-time).
- [ ] Doctrine-key calibration note (any unexpected Family E
      raw_key behaviour observed during the smoke).

**Result:** ☐ PASS ☐ FAIL — _<provenance subsection completed>_

---

## Phase 8 — Verdict + authorization

- [ ] **Pre-push audit-lint:** `node scripts/ops/audit-lint.mjs
      docs/audits/MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE-<date>.md` exits 0
      before push.
- [ ] CI runs on the smoke audit PR and exits 0 (L1-L6 mechanically
      enforced; L3+L4+L5 obligations met).
- [ ] Verdict:
  - **PASS:** All 8 phases clean; L3/L4/L5 each satisfied by an
    explicit phase; local pre-lint + CI both exit 0; A/B/C/D
    unregressed.
  - **PARTIAL:** Phase 3 0-positives even on stronger targeted arg
    (sparse signal; do NOT authorize Card 3); Phase 4b 0-fire on
    slippery_slope-targeted arg even after fallback fixture.
  - **FAIL:** Phase 3 0-positives on targeted arg AND no PARTIAL marker;
    Phase 4b dirty firing (banned token in E production evidence_span);
    A/B/C/D regression; CI incorrectly passes an L3/L4/L5-missing audit.

**Authorizations granted on PASS:**
- `MCP-021C-EDGE-FAMILY-E-ENABLE-SMOKE: PASS`
- Family E PRODUCTION + auto-trigger LIVE (5 production families:
  A+B+C+D+E)
- `MCP-021C-EDGE-FAMILY-F-ENABLE` (Card 3) AUTHORIZED to design under
  Gate B surface

**Final verdict:** ☐ PASS ☐ PARTIAL ☐ FAIL — _<verdict notes>_

---

**Required final step:** Run `node scripts/ops/audit-lint.mjs <this-doc>`;
MUST exit 0 before Verdict line is valid.
