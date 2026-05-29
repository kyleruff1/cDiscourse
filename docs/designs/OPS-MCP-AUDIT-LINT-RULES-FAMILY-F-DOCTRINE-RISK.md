# OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — Design

**Status:** Design draft
**Epic:** Epic 12 — MCP / semantic-referee track (OPS audit-lint sub-track)
**Release:** OPS hardening (audit-lint RULES, data-and-tests)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/349
**Card type:** audit-lint RULES — **data-and-tests**, NOT logic-and-runtime
**Intent brief:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-intent.md`

---

## A.2 OUTCOME (one line, decisive)

**data-only** — no logic change. The real Family F PARTIAL audit still passes L5 after adding `family_f` to `DOCTRINE_RISK_FAMILIES` (it mentions `evidence_span` 4×, so `hasInspection` is true; L5 does not fire). Empirically confirmed below. Zero HALT triggers fire.

---

## Goal (one paragraph)

Family F (`critical_question`) doctrine was proven **live** by operator smoke (`MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT`, PASS): 3 adversarial `submit-argument` runs, 9 persisted rows, ≥1 clean firing, 0 banned tokens across a 16-pattern scan, and the existential adversarial test (F3 input contained "fallacy" twice; the persisted `evidence_span` did NOT echo it). That proof currently lives only in operator discipline. The audit-lint L5 rule mechanically requires persisted direct-output (`evidence_span`) inspection only for Family E (`argument_scheme` / `slippery_slope`); it is **blind to Family F**. So a *future* F-prefix smoke audit could declare verdict PASS without any persisted `evidence_span` inspection and the linter would let it through — exactly the `29f30b0` improper-PASS defect class that motivated `OPS-MCP-SMOKE-DOCTRINE-HARDENING`. This card converts the Family F doctrine proof from operator-discipline into **mechanical L5 enforcement** by adding the doctrine-risk family aliases for Family F to the `DOCTRINE_RISK_FAMILIES` DATA set in `scripts/ops/audit-lint-rules.cjs`, plus the test fixtures that prove the new teeth bite (synthetic F-improper FAILS L5) and that legitimate F audits (PARTIAL-with-deferred-obligation; PASS-with-evidence) are preserved. **Doctrine note:** the audit-lint linter is a structural/process gate, not a user-facing surface — no truth labels, no scoring, no AI, no network, no secrets. It enforces the *evidence-doctrine* discipline (factual standing requires persisted evidence inspection) at audit-authoring time. This design respects cdiscourse-doctrine §1/§3 (the linter never adjudicates argument truth; it checks that the audit *inspected* the persisted span) and §6/§7 (pure regex + text, no keys, no LLM, no network).

---

## Data model

**No new data model.** The only production-source change is adding string entries to an existing in-memory `Set` (`DOCTRINE_RISK_FAMILIES`) in a pure-DATA CommonJS module. No TypeScript types, no SQL, no migration, no schema.

### The exact DATA edit (A.1 alias decision)

`scripts/ops/audit-lint-rules.cjs`, lines 55–58, currently:

```js
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',
]);
```

becomes:

```js
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',
  // Family F (critical_question). `family_f` is the string detectFamily()
  // actually emits for a `MCP-SERVER-NNN-FAMILY-F` title (mapFamilyLetterToName
  // has no F case → default branch → `family_f`); it is the load-bearing alias.
  // `critical_question` is the canonical key name (also covers any doc that
  // declares `Family: critical_question`). `consequence_probability_unclear`
  // is the F doctrinal-axis partner key (the exact parallel of `slippery_slope`
  // for E), reachable only via a `Family:` declaration — added for parallelism.
  'critical_question',
  'family_f',
  'consequence_probability_unclear',
]);
```

**Exact strings to add (in this order):** `'critical_question'`, `'family_f'`, `'consequence_probability_unclear'`.

**Why `family_f` is load-bearing and `critical_question` alone is a no-op:** see A.1 evidence below. `detectFamily` maps the title letter F via `mapFamilyLetterToName('F')`, which has no `F` case and falls through to `default` → `` `family_${letter}` `` → `family_f`. Neither real F audit carries a body-level `Family:` declaration. So the linter classifies both real F docs as `family: 'family_f'`. Adding only `critical_question` would never match them; `family_f` is the alias the detector actually emits.

`MARKER_STRING` (`'Audit-Lint: v1'`) is unchanged. No other export changes.

---

## File changes

**Modified (production DATA, ~6 lines):**
- `scripts/ops/audit-lint-rules.cjs` — add 3 strings (with comment) to the `DOCTRINE_RISK_FAMILIES` set, lines 55–58. **This is the only production-source change.** No logic, no `.mjs`, no `audit-lint-lib.cjs`.

**New fixtures (3 files):**
- `__tests__/fixtures/audit-lint/family-f-original-PARTIAL.md` — static copy of the on-main F PARTIAL audit + fixture marker on line 1 (~258 lines).
- `__tests__/fixtures/audit-lint/family-f-amendment-PASS.md` — static copy of the on-main F amendment PASS audit + fixture marker on line 1 (~266 lines).
- `__tests__/fixtures/audit-lint/family-f-IMPROPER-PASS-no-evidence-span.md` — SYNTHETIC hand-authored negative fixture; F-amendment shape with every `evidence_span` trigger stripped, verdict PASS, L6 intact (~70 lines; full body in the "Fixture matrix" section below).

**Modified tests (~30–45 lines net add):**
- `__tests__/opsAuditLint.test.ts`:
  - New `describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — ...')` block(s) for the new unit + fixture tests.
  - In the existing "fixture-directory invariants" block (lines 1112–1145): extend the `FIXTURE_FILES` array from 4 → 7 entries; change `fixture count is exactly 4` assertion `toHaveLength(4)` → `toHaveLength(7)` (line ~1142) and rename the `it()` label to `'fixture count is exactly 7'`.
  - The 4 existing fixture `it()`s in the "4-fixture self-validation" block (lines 1064–1106) stay **byte-identical**.

**Modified docs:**
- `docs/ops/AUDIT-LINT.md` — ENHANCE the existing "Adding a doctrine-risk family" section (lines ~192–214) and the fixture-directory description (lines ~233–254, incl. the "exactly 4" → "exactly 7" line at 254) with the Family F lessons. (~25 lines.)
- `__tests__/fixtures/audit-lint/README.md` — update the "exactly 4 / four motivating arc docs" prose (lines 23–26) and the expected-outcomes table (lines 63–74) to reflect 7 fixtures + the 3 new rows + re-extraction commands for fixtures 5/6. (~20 lines.) **Scope rationale:** the README lives under `__tests__/fixtures/audit-lint/` (a fixture-dir `.md`), so it falls inside the brief's `__tests__/fixtures/audit-lint/*.md` allowance; updating it keeps the self-validation contract coherent (its prose + table become stale on a 3-fixture add). This is a documented scope clarification per the brief's §2 designer-ruling request, not a scope expansion.
- `docs/core/current-status.md` — handoff (Phase framing + new test count). (~1 stage block.)

**This design doc + the smoke audit doc:**
- `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK.md` — this file.
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE-2026-05-28.md` — post-merge smoke audit (implementer/operator authors per §9; must carry `Audit-Lint: v1` and self-lint clean).

**Deleted:** none.

**MUST NOT touch (re-affirmed):** `scripts/ops/audit-lint.mjs` LOGIC, `scripts/ops/audit-lint-lib.cjs` LOGIC (incl. `mapFamilyLetterToName` — that is logic), `mcp-server/**`, `supabase/functions/**`, `src/**` non-test, `package.json`/`package-lock.json`, `.github/workflows/audit-lint.yml`, the 4 existing fixtures (byte-equal), Family A–F prompts/keys, production registry flags.

---

## API / interface contracts

No callable interface changes. `DOCTRINE_RISK_FAMILIES` is consumed by exactly one logic path — `applyL5` in `audit-lint-lib.cjs`:

```js
// audit-lint-lib.cjs applyL5 (READ ONLY — quoted for context, NOT edited):
isDoctrineRisk = !!parsed.family && rules.DOCTRINE_RISK_FAMILIES.has(parsed.family);
// ...
const hasInspection = rules.L5_PERSISTED_INSPECTION_PATTERNS.some((re) => re.test(fullDocText));
if (hasInspection) { return []; }   // <- mention of evidence_span anywhere passes L5
return [{ rule: 'L5', severity: 'error', message: 'Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).', ... }];
```

The contract that matters: `applyL5` reads `rules.DOCTRINE_RISK_FAMILIES` **at call time** (the lib `require`s the rules module once at load; the Set is mutated by us only at authoring-edit time, not at runtime). Adding members to the Set is the entire mechanism. `applyL5` is **verdict-blind** (no `verdict === 'PASS'` check) and `hasInspection` tests the **full doc text** for any of the 5 `L5_PERSISTED_INSPECTION_PATTERNS` (the most permissive being the bare word `\bevidence_span\b`).

The 5 L5 inspection patterns (the strings the synthetic fixture must NOT contain):
- `/\bevidence_span\b/i`
- `/SELECT[\s\S]{0,200}evidence_span/i`
- `/\|\s*evidence_span\s*\|/i`
- `/persisted\s+evidence/i`
- `/direct[-\s]output\s+inspection/i`

---

## Edge cases (the implementer must handle)

- **Alias the detector ignores (A.1 trap).** Adding `critical_question` alone is a silent no-op for the real F docs — they detect as `family_f`. The fix MUST include `family_f`. A unit test pins `detectFamily('# MCP-SERVER-007-FAMILY-F-SMOKE — x', body) === 'family_f'` so a future refactor that adds an `F` case to `mapFamilyLetterToName` (changing the emitted string) will fail loudly rather than silently un-arming L5.
- **Consistent-PARTIAL preserved by mention, not by verdict-awareness (A.2 / Decision 5).** A PARTIAL F audit with Phase 4b NOT-RUN must NOT fail. It passes L5 because it **names** `evidence_span` as a deferred / BINDING obligation → `hasInspection` true. Fixture 5 (the real on-main F PARTIAL) is the regression guard. If a future F PARTIAL audit forgets to even mention `evidence_span`, L5 will (correctly) fire — that is the intended teeth, not a regression.
- **Synthetic fixture must trip L5 ONLY (not L1/L2/L6).** The synthetic is an `amendment`-type doc (title contains AMENDMENT) → `amendment` has an empty required-phase set, so L1 cannot fire on NOT-RUN phases; all its phases are PASS anyway. It contains no L2 indirect-proof phrases. Its L6 provenance is intact (prior verdict named, gap/missing-proof named, newly-supplied-proof named). The only defect is the absent `evidence_span` inspection → `[L5]` only. Empirically confirmed below (`rules: ["L5"]`).
- **Fixture marker on line 1 + title on line 2.** `parseAuditDoc` (lines 593–617) explicitly skips leading HTML-comment + blank lines to find the title, so a fixture with the `<!-- AUDIT-LINT-FIXTURE … -->` marker on line 1 and the `# MCP-SERVER-007-FAMILY-F-SMOKE …` title on line 2 still detects `family_f` and the correct audit type. Verified against the existing `family-e-amendment-PARTIAL.md` fixture, which uses exactly this shape.
- **`Audit-Lint: v1` marker inside the fixture body.** Both real F docs carry `Audit-Lint: v1` on their original line 3. As a fixture the marker line moves down by one (after the prepended fixture comment) but is still present, so `hasMarker` parses true. This does not affect L5 (L5 keys on family + inspection-pattern presence, not the marker). The fixtures are direct-invoked by the test via `lintAuditDoc(fs.readFileSync(...))`, so CI marker-gating is irrelevant to the fixture assertions.
- **Doctrine ban-list scan does NOT reach the fixtures.** The verdict-token scanner (`scripts/ops/mcp-observability-report-lib.cjs` `scanMarkdownForBannedTokens`, tested in `__tests__/opsMcpObservabilityDoctrineBanList.test.ts`) scans the stitched **observability report** built from `opsMcpObservabilityFixture`, NOT `__tests__/fixtures/audit-lint/` or `docs/audits/`. Verified by grep: no scanner reads the fixture dir. The synthetic fixture still carries the `<!-- AUDIT-LINT-FIXTURE … -->` marker per the README contract (defensive opt-out + required by the marker-invariant test).
- **Empty / malformed doc.** Unchanged behavior — `lintAuditDoc` returns exit 2 with a `parse` finding when title + audit-type + verdict are all unextractable. Not exercised by this card; no change.
- **Permission-denied / offline / concurrent edits.** Not applicable — pure-text, no fs (in the lib), no network, no DB, no concurrency surface.

---

## Test plan

All tests live in `__tests__/opsAuditLint.test.ts` (the existing audit-lint suite, currently 137 tests / exit 0). Tests are pure: `require('../scripts/ops/audit-lint-lib.cjs')` + `fs.readFileSync` of fixtures; no React, no Supabase, no network.

**New unit tests (doctrine-risk membership + L5 firing for Family F):**
- `DOCTRINE_RISK_FAMILIES.has('critical_question')` is `true`. (mirrors the existing `…contains argument_scheme` test at line ~1323)
- `DOCTRINE_RISK_FAMILIES.has('family_f')` is `true`.
- `DOCTRINE_RISK_FAMILIES.has('consequence_probability_unclear')` is `true`.
- `detectFamily('# MCP-SERVER-007-FAMILY-F-SMOKE — x', '…body…')` returns `'family_f'` (A.1-trap pin; documents that the title letter F maps to `family_f`, not `critical_question`).
- L5 **fires** on a `family_f`-titled family-ship doc with verdict PASS and no `evidence_span` mention: build via `buildFamilyShipDoc({ titleOverride: '# MCP-SERVER-007-FAMILY-F-SMOKE — synthetic', phases: [['Phase 1 — Pre-flight','PASS']], verdict: 'PASS' })`; assert `findings.some(f => f.rule === 'L5')` is `true`. (mirrors the existing E firing test at line ~904)
- L5 does **NOT** fire on a `family_f`-titled doc that mentions `evidence_span` (e.g. a `SELECT … evidence_span …` line in a phase justification): assert `findings.some(f => f.rule === 'L5')` is `false`. (mirrors the existing E non-firing test at line ~913)

**New fixture self-validation tests (NEW `describe` block named for this card; the existing 4 `it()`s stay byte-identical in their own block):**
- `family-f-original-PARTIAL.md` → `exitCode === 0` and `findings` length 0 (consistent-PARTIAL for F; the load-bearing Decision 5 regression).
- `family-f-amendment-PASS.md` → `exitCode === 0` and `findings` length 0 (legitimate F amendment with persisted inspection passes L5).
- `family-f-IMPROPER-PASS-no-evidence-span.md` → `exitCode === 1`; `findings.map(f => f.rule)` **contains `'L5'`**, and (teeth-precision) does **NOT** contain `'L1'`, `'L2'`, or `'L6'` (proves L5-only). This is the TEETH proof — the F analog of `original-family-e-IMPROPER-PASS`.

**Existing-behavior regressions (edits to the invariants block, not new `it()`s):**
- `FIXTURE_FILES` array grows 4 → 7 (adds the 3 new filenames).
- `fixture count is exactly 4` → `fixture count is exactly 7`; `toHaveLength(4)` → `toHaveLength(7)`; the `mdFiles.sort()` deep-equality now compares against all 7.
- The "each fixture file starts with the HTML comment marker" `it()` is unchanged in code but now iterates 7 files (the 3 new fixtures carry the marker, so it stays green).
- The 4 existing fixture assertions (`original-family-e-IMPROPER-PASS` → exit 1 / L1+L2; the 3 PASS/PARTIAL → exit 0) remain byte-identical and must still pass.

**Doctrine ban-list assertions:** N/A for user-facing strings — this card touches no user-facing copy and no `gameCopy` codes. The audit-lint linter explicitly is "not a verdict-token doctrine scanner" (per `AUDIT-LINT.md` § "What the linter is NOT"). No new ban-list test is required; the existing `opsMcpObservabilityDoctrineBanList` suite is untouched and out of scope.

---

## Test forecast (precise)

**+8 to +14** (HALT ceiling **+45**). Anchored to the captured baseline of **137 tests / exit 0** in `opsAuditLint.test.ts`.

Decomposition:
- 3 membership tests (`critical_question`, `family_f`, `consequence_probability_unclear`).
- 1 `detectFamily` → `family_f` A.1-trap pin.
- 2 L5 firing tests for `family_f` (fires without inspection; does not fire with `evidence_span`).
- 3 fixture self-validation `it()`s (fixture 5 → 0; 6 → 0; 7 → 1 citing L5-only).
- The `FIXTURE_FILES`/count-assertion edits modify existing `it()`s (no count delta); the marker `it()` iterates more files (no count delta).

Minimum realistic = **+8** (drop the optional `consequence_probability_unclear` membership and the `detectFamily` pin → but both are cheap and high-value, so they are included). Expected = **+9 to +12**. Upper bound if the implementer adds a dedicated consistent-PARTIAL-for-F test and a couple of extra teeth-precision assertions = **~+14**. The brief's band is +8 to +25; this design forecasts the tighter **+8 to +14**. If the implementer's count exceeds **+45**, HALT trigger 12 fires.

---

## Dependencies (cards / docs / files)

- **Assumes complete:** `MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT` (PASS) and `MCP-SERVER-007-FAMILY-F-SMOKE` (PARTIAL) — both on `main` at `6395023`; they are the static-copy sources for fixtures 5 and 6. Also `OPS-MCP-SMOKE-DOCTRINE-HARDENING` (the L1–L6 linter) and `OPS-MCP-SMOKE-LINT-CI-WIRING` (the CI workflow) — both shipped; this card is a pure DATA extension of their `DOCTRINE_RISK_FAMILIES` set.
- **Reads existing:** `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES` (lines 55–58); `audit-lint-lib.cjs` `applyL5` (lines 967–998), `detectFamily` (384–416), `mapFamilyLetterToName` (423–439), `parseAuditDoc` marker-skip (593–617) — READ ONLY; `__tests__/opsAuditLint.test.ts` blocks at lines 900–1005 (L5), 1062–1106 (4-fixture self-validation), 1112–1145 (fixture-dir invariants), 1186–1206 (`buildFamilyShipDoc`), 1323–1325 (membership test pattern).
- **Static-copy sources (on `main` at `6395023`):** `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` → fixture 5; `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md` → fixture 6.
- **Will block / enable:** the future `MCP-SERVER-008-FAMILY-G` family-ship arc — once G ships and is proven, the same DATA-list pattern (add `family_g` + the canonical G key) extends L5 to Family G. This card is the template for that. It does NOT itself add Family G (HALT trigger if proposed).

---

## Risks (things that might trip up the implementer)

- **Silent-no-op alias (highest-value gotcha).** Forgetting `family_f` and adding only `critical_question` produces a green suite (the membership test for `critical_question` passes) while leaving L5 blind to every real F audit. Mitigation: the `detectFamily → family_f` pin test + the fixture-7 teeth test (which only fails-correctly when `family_f` is present) both guard this. The implementer MUST run fixture 7 and confirm it fails with `family_f` in the set, not just that the membership test passes.
- **Synthetic fixture accidentally re-introduces an `evidence_span` trigger.** The fixture-6 source body is dense with `evidence_span`; the synthetic (fixture 7) is derived from its *shape*, not its text. If the implementer copies fixture 6 and scrubs, they must strip ALL 5 inspection patterns — including the bare word `evidence_span` (which appears ~12× in fixture 6), the `| evidence_span |` table headers, the `SELECT … evidence_span` query blocks, and any `persisted evidence` / `direct-output inspection` phrasing. The design provides a hand-authored minimal synthetic body (below) that is already verified clean — RECOMMENDED to use it nearly verbatim rather than scrub the dense source.
- **Synthetic fixture accidentally trips L1/L2/L6.** If the synthetic drops the L6 provenance, or names a NOT-RUN required phase under a non-amendment audit type, extra rules fire and the teeth test's "L5-only" precision assertion fails. The provided body is `amendment`-typed (empty required-phase set), all-PASS phases, full L6 provenance — verified to trip `["L5"]` only.
- **Byte-equality of the 4 existing fixtures.** The `FIXTURE_FILES` array edit and count-assertion change are in the same `describe` block as the existing files; the implementer must edit ONLY the array + the count number + the count `it()` label, and must NOT touch the 4 existing fixture files or their 4 `it()`s. A `git diff --stat` on the 4 existing fixtures must show 0 changed lines.
- **README staleness vs scope.** The README update is in-scope (fixture-dir `.md`) but the implementer must NOT edit the *body* of the existing 4 fixtures' description in a way that changes their meaning — only add the 3 new rows, bump "4 → 7", and add re-extraction commands for fixtures 5/6. The "DO NOT EDIT [fixture bodies]" clause still stands.
- **No CI workflow change.** `.github/workflows/audit-lint.yml` is correct and out of scope. Adding fixtures under `__tests__/fixtures/` does NOT match the workflow's `docs/audits/**SMOKE*.md` trigger path, so CI scope is unaffected. The post-merge smoke audit doc DOES live under `docs/audits/` and will be linted by CI — it must carry `Audit-Lint: v1` and self-lint clean (exit 0).
- **Migration / operator deploy.** None. This is a pure code+docs change with no DB, no Edge Function, no deploy.

---

## Out of scope (explicit — reduces scope creep)

- Any change to `audit-lint.mjs` or `audit-lint-lib.cjs` LOGIC (incl. adding an `F` case to `mapFamilyLetterToName`). A data-only change is sufficient and proven; touching logic would fire HALT trigger 1/6.
- Family G/H/I/J doctrine-risk enrollment (G/H/I/J are unsupported; F is the only family this card enrolls).
- Adding a `verdict`-awareness check to L5 (it is intentionally verdict-blind; consistent-PARTIAL is preserved by inspection-pattern mention — see A.2). Changing L5 firing semantics is a logic change → HALT trigger 10.
- Broad historical-corpus enforcement (the `--report-only docs/audits/` census stays informational; CI scope stays new/modified-marked-only).
- Any taxonomy / prompt / key / production-flag / `package.json` change.
- Editing the 4 existing fixtures' bodies, or weakening any existing Family E rule.
- The post-merge smoke audit *execution* (Phase 1–5 of §9) — that is the operator/implementer smoke step after merge, not part of the design.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** The audit-lint linter never adjudicates who is right in a debate and never labels a claim true/false. L5 checks that an *audit doc* inspected the persisted `evidence_span` column — a process/evidence-discipline gate, not a truth verdict on any argument. Nothing here touches posting, scoring, or strength bands. RESPECTED.
- **cdiscourse-doctrine §3 (popularity is not evidence) / evidence-doctrine (factual standing requires persisted evidence):** L5 is the *meta-enforcement* of exactly this doctrine: it mechanically requires that a doctrine-risk family audit inspected the persisted direct-output evidence before claiming PASS. Adding Family F extends that evidence-discipline to `critical_question` — the family whose live proof (F3 "fallacy" non-echo across 9 persisted rows) is the canonical demonstration that the persisted span must be inspected, not assumed. RESPECTED and reinforced.
- **cdiscourse-doctrine §4 (AI moderator limits):** No AI. The linter is pure regex + text parsing; the brief and the lib both forbid LLM/network. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine is sacred):** `src/lib/constitution/engine.ts` is untouched. This card touches an OPS audit-lint DATA file, not the Constitution engine. RESPECTED.
- **cdiscourse-doctrine §6/§7 (secrets; no AI calls from prod):** No keys, no `.env*`, no service-role, no Anthropic/xAI/X. The lib has no fs/spawn/network; the rules file is pure data. The synthetic fixture's example JWT/token lines are shown `[REDACTED]` (mirroring the real audits). RESPECTED.
- **cdiscourse-doctrine §9 (plain language for users):** N/A — no user-facing strings. Internal codes (`family_f`, `critical_question`) live only in an operator-facing rules file and operator docs, never surfaced to end users. RESPECTED.
- **test-discipline (tests are part of done):** The card ships +8 to +14 tests covering membership, the A.1 detector trap, L5 firing/non-firing for `family_f`, and 3 fixture assertions incl. the teeth proof. The 4 existing fixtures + their assertions are preserved. Test count goes UP. Suite must exit 0 (typecheck + lint + jest). RESPECTED.
- **Intent-brief HALT triggers (12):** evaluated below — none fire. Trigger 8 (must add a regression proving F L5 enforcement) is SATISFIED by fixture 7. Trigger 9 (4 existing fixtures keep exits 1,0,0,0) is SATISFIED (empirically unchanged). Trigger 10 (A.2 requires logic change) does NOT fire (A.2 = data-only). Trigger 11 (F PARTIAL newly fails) does NOT fire (empirically exit 0). RESPECTED.

---

## Operator steps (if any)

**None for the code change** — pure code + docs, no DB, no Edge Function, no deploy, no env var.

**Post-merge smoke (operator/implementer, per intent §9):** run the 5-phase smoke and author `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK-SMOKE-2026-05-28.md`:
1. Existing-fixture regression: 4 hardening fixtures still exit 1,0,0,0.
2. Family F enforcement (teeth): synthetic F-improper → exit 1 citing L5; F amendment fixture → 0; F PARTIAL fixture → 0; real on-main F amendment → 0; real on-main F PARTIAL → 0.
3. Report-only census: `node scripts/ops/audit-lint.mjs --report-only docs/audits/` — no crash; no NEW unexpected would-fail introduced by the F doctrine-risk add.
4. Regression: `npm run typecheck`; `npm run lint`; `npx jest opsAuditLint`; `cd mcp-server && deno test …` (871 unchanged — no mcp-server touch). All exit 0.
5. Dogfood: the smoke audit doc lints itself clean (`Audit-Lint: v1` marker; exit 0).

The Supabase GitHub integration auto-deploys on merge, but this card changes no migration and no Edge Function, so the auto-deploy is a no-op for this card.

---

## Fixture matrix (7 fixtures — exit codes + finding codes)

| # | Fixture | Source | Audit type | Verdict | Expected exit | Finding rules | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `original-family-e-IMPROPER-PASS.md` | static (29f30b0) | family-ship | PASS | **1** | `L1, L2, L5` | E improper-PASS centerpiece — UNCHANGED |
| 2 | `family-e-amendment-PARTIAL.md` | static (b1829f5) | amendment | PARTIAL | **0** | (none) | consistent-PARTIAL — UNCHANGED |
| 3 | `family-e-hosted-completion-PASS.md` | static (bccb0c2) | hosted-completion | PASS | **0** | (none) | gap closed by direct proof — UNCHANGED |
| 4 | `family-d-strengthened-amendment-PASS.md` | static | amendment | PASS | **0** | (none) | model amendment — UNCHANGED |
| 5 | `family-f-original-PARTIAL.md` | static (on main, `6395023`) | family-ship | PARTIAL | **0** | (none) | F PARTIAL passes L5 via `evidence_span` mention (4×) → consistent-PARTIAL preserved |
| 6 | `family-f-amendment-PASS.md` | static (on main, `6395023`) | amendment | PASS | **0** | (none) | F amendment passes L5 via persisted `evidence_span` inspection (12×) → legitimate PASS preserved |
| 7 | `family-f-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | TEETH — F doctrine-risk + verdict PASS + NO `evidence_span` → L5 fires; L1/L2/L6 do NOT |

The 4 existing fixtures' finding codes for #1 in the table reflect the README/test contract (README names L1+L2; the live probe shows `L1, L2, L5` — the existing `it()` only asserts `toContain('L1')` + `toContain('L2')`, so the extra `L5` does not break it). Fixtures 1–4 produce **exits 1, 0, 0, 0** unchanged with the F aliases added (empirically verified).

### Synthetic fixture 7 — exact construction (verified clean; `["L5"]` only)

Line 1 is the fixture marker; line 2 is the title (contains `MCP-SERVER-007-FAMILY-F` → `family_f` and `AMENDMENT` → amendment type). Body has all phases PASS, full L6 provenance, and **zero** L5 inspection triggers. The implementer should use this nearly verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-007-FAMILY-F-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)

Audit-Lint: v1

**Date:** 2026-05-28
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md` (PARTIAL — Phases 3/4/4b/5 NOT-RUN).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family F smoke audit | `5591b76` | **PARTIAL** | Phase 1, 2, 6, 7 PASS. Phase 3 NOT-RUN; Phase 4, 4b, 5 NOT-RUN. Prior verdict: PARTIAL capped by Gap 1 unmet obligation. |
| **This amendment** | (this commit) | **PASS** | Phase 3 closed by operator-supplied hosted MCP smoke evidence (19/19 PASS, EXIT 0). Phase 4 closed by Edge admin_validation HTTP 200 with 10 positives across 3 args. Phase 5 closed by 4/4 G/H/I/J rejection. Gap 1 closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 3 — Hosted MCP smoke (19 checks)

**Status:** PASS

​```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]
PASS [18-compat-boolean-family-f]
PASS [19-mcp-tools-call-boolean-family-f]
MCP-SERVER-001 smoke: 19 PASSES, 0 FAILS
EXIT: 0
​```

19/19 PASS, EXIT 0; checks 18 + 19 prove the deployed build serves Family F end-to-end.

---

## Phase 4 — Edge admin_validation (Family F)

**Status:** PASS

​```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
→ HTTP 200; time_total=24s
​```

10 Family F positives across 3 args; 4 distinct CQ keys fired; all in Family F's 14-key set; no cross-family leakage.

---

## Phase 5 — Unsupported G/H/I/J rejection regression

**Status:** PASS

4/4 reject correctly under mcp_validation_failed. Zero positives. Zero leakage.

---

## Phase 6 — Targeted regression

**Status:** PASS

typecheck EXIT 0; lint EXIT 0; jest 570 suites pass; deno 871 pass.

---

## Final upgraded verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) now have direct proof; Phase 6 regression unchanged; Phase 7 provenance carries forward.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

(The three ​``` fences above are shown with a zero-width marker only to keep this design doc's own code fence intact; the implementer writes plain ``` triple-backtick fences in the fixture file. The fixture has NO `evidence_span`, NO `| evidence_span |`, NO `SELECT … evidence_span`, NO `persisted evidence`, NO `direct-output inspection`.)

### Static-copy extraction for fixtures 5 and 6

Per the fixture README's `git show <sha>:<path>` recipe, sources are on `main` at `6395023`:

```bash
git show 6395023:docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-05-28.md > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-f-original-PARTIAL.md

git show 6395023:docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-AMENDMENT-2026-05-28.md > /tmp/raw.md && \
  cat <(echo '<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') /tmp/raw.md \
  > __tests__/fixtures/audit-lint/family-f-amendment-PASS.md
```

(On Windows/PowerShell the implementer may instead `git show … | Out-File -Encoding utf8` then prepend the marker line; the byte content of the audit body must be the on-main version. The fixtures must remain frozen at `6395023`.)

---

## Evidence section — empirical A.1 + A.2 probe outputs

Two read-only node probes were run against the repo files (the rules `Set` was mutated only in-memory in the probe, never on disk; the probe scripts were deleted after capture and are NOT committed). The lib reads `rules.DOCTRINE_RISK_FAMILIES` at call time, so `.add()` on the live Set exercises `applyL5` exactly as the on-disk DATA edit will.

### A.1 — detector output + consistent-PARTIAL mechanism

```
real F PARTIAL   title: "# MCP-SERVER-007-FAMILY-F-SMOKE — Post-merge audit"
  detectFamily -> "family_f"
real F AMENDMENT title: "# MCP-SERVER-007-FAMILY-F-SMOKE — Amendment (live-evidence completion)"
  detectFamily -> "family_f"
mapFamilyLetterToName("F") -> "family_f"
mapFamilyLetterToName("E") -> "argument_scheme"
real F PARTIAL   body "Family:" decl? none
real F AMENDMENT body "Family:" decl? none
real F PARTIAL   hasInspection (any L5 pattern)? true
real F PARTIAL   evidence_span literal count: 4
real F AMENDMENT hasInspection (any L5 pattern)? true
real F AMENDMENT evidence_span literal count: 12
```

**A.1 conclusion:** Both real F docs detect as `family_f` (NOT `critical_question`); `mapFamilyLetterToName('F')` returns `family_f` via the `default` branch (no `F` case); neither doc has a body `Family:` declaration. **Load-bearing alias = `family_f`.** Add `critical_question` (canonical/declared-name) + `family_f` (detector output) + `consequence_probability_unclear` (doctrinal-axis partner, parallel to `slippery_slope`). `mapFamilyLetterToName` is NOT touched.

### Baseline (current set: `argument_scheme`, `slippery_slope`) — before the edit

```
DOCTRINE_RISK_FAMILIES = ["argument_scheme","slippery_slope"]
real F PARTIAL   {"exit":0,"rules":[],"family":"family_f","auditType":"family-ship","verdict":"PARTIAL"}
real F AMENDMENT {"exit":0,"rules":[],"family":"family_f","auditType":"amendment","verdict":"PASS"}
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}
```

### A.2 — after monkey-patching `family_f` + `critical_question` + `consequence_probability_unclear`

```
DOCTRINE_RISK_FAMILIES = ["argument_scheme","slippery_slope","family_f","critical_question","consequence_probability_unclear"]
real F PARTIAL   {"exit":0,"rules":[],"family":"family_f","auditType":"family-ship","verdict":"PARTIAL"}   <- consistent-PARTIAL preserved
real F AMENDMENT {"exit":0,"rules":[],"family":"family_f","auditType":"amendment","verdict":"PASS"}        <- legitimate PASS preserved
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}   <- unchanged
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}                 <- unchanged
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}                 <- unchanged
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}                 <- unchanged
```

**A.2 conclusion: DATA-ONLY.** Adding `family_f` does NOT make the real F PARTIAL audit fail (it mentions `evidence_span` 4× → `hasInspection` true → L5 returns no finding). The real F amendment stays PASS. The 4 existing fixtures stay **1, 0, 0, 0**. No logic change required. HALT triggers 8/9/10/11 do NOT fire.

### Teeth proof — synthetic F-improper (negative control + with `family_f`)

```
synthetic contains any L5 inspection trigger? false (must be false)
synthetic evidence_span literal count: 0 (must be 0)

--- WITHOUT family_f (current set) — negative control ---
synthetic {"exit":0,"rules":[],"family":"family_f","auditType":"amendment","verdict":"PASS"}   <- would WRONGLY pass without F in set

--- WITH family_f added ---
synthetic {"exit":1,"rules":["L5"],"family":"family_f","auditType":"amendment","verdict":"PASS"}   <- exit 1, rules ["L5"] ONLY (teeth)
```

**Teeth conclusion:** Without `family_f`, the synthetic improper-PASS wrongly passes (exit 0) — proving the rule is currently blind to Family F. With `family_f`, it fails with **exit 1, finding `["L5"]` ONLY** — not L1/L2/L6. This is the regression that satisfies HALT trigger 8 and is the F analog of `original-family-e-IMPROPER-PASS`.

### Suite baseline captured

```
npx jest opsAuditLint --no-coverage
Test Suites: 1 passed, 1 total
Tests:       137 passed, 137 total
EXIT: 0
```

The forecast (+8 to +14) is anchored to this 137-test / exit-0 baseline.

---

## HALT-trigger evaluation (all 12)

| # | Trigger | Fires? | Why |
| --- | --- | --- | --- |
| 1 | Runtime code change (`mcp-server`/`supabase`/`src` non-test) | NO | DATA + tests + docs only |
| 2 | Taxonomy / prompt / key change | NO | none proposed |
| 3 | Production flag change | NO | none proposed |
| 4 | `package.json` / lock change | NO | none proposed |
| 5 | Broad historical-corpus enforcement change | NO | census stays informational; CI scope unchanged |
| 6 | Weakening any existing audit-lint behavior | NO | additive only; E rules untouched |
| 7 | Removing/altering an existing Family E doctrine-risk rule | NO | `argument_scheme` + `slippery_slope` preserved verbatim |
| 8 | No regression proving Family F L5 enforcement | NO | fixture 7 FAILS L5 (teeth proven) |
| 9 | 4 existing fixtures no longer 1,0,0,0 | NO | empirically unchanged |
| 10 | A.2 = requires logic change | NO | A.2 = data-only (empirical) |
| 11 | F PARTIAL audit newly FAILS | NO | empirically exit 0 |
| 12 | Forecast > +45 | NO | forecast +8 to +14 |

**No HALT trigger fires. The card proceeds as data-and-tests.**
