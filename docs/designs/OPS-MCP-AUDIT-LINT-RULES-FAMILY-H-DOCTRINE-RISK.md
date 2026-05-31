# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — Design

**Status:** Design draft
**Epic:** Epic 12 — MCP / semantic-referee track (OPS audit-lint sub-track)
**Release:** OPS hardening (audit-lint RULES, data-and-tests)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/390 (umbrella #388)
**Card type:** audit-lint RULES — **data-and-tests**, NOT logic-and-runtime
**Intent brief:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-intent.md`
**Template (mirrored exactly):** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK.md`
**Date:** 2026-05-31
**Prerequisites:**
- Card 1 ship: `MCP-SERVER-009-FAMILY-H` (PR #400, merge `3097521`)
- Card 1 smoke: `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` (PR #402, merge `12ec7eb`)
- Family G doctrine-risk (OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK) — shipped 2026-05-29; carries E + F + G aliases in `DOCTRINE_RISK_FAMILIES`
- Families A-G MCP operational

This card is a faithful replica of the already-shipped Family G doctrine-risk
card, applied to Family H. It adds Family H to L5 doctrine-risk enforcement
exactly as `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK` added Family G.
Every decision below is the G analog of an F decision (and, transitively, an E
decision), empirically re-confirmed against the current tree (the on-disk set
already carries E's 2 + F's 3 + G's 3).

---

## A.2 OUTCOME (one line, decisive)

**data-only** — no logic change. The 10 existing fixtures (4 hardening + 3 F +
3 G) are byte-equal in lint outcome before/after the H additions; the Card 1 H
smoke audit on main (`12ec7eb`) is **L5-orthogonal** to this card (its title
format `# MCP-SERVER-009 Family H smoke — 2026-05-31` does NOT match
`detectFamily()`'s family-letter regex — it detects as `family: null` and
`auditType: 'unknown'`, so L5 is not reachable for this specific audit doc
regardless of `DOCTRINE_RISK_FAMILIES` contents — surfaced in §"Risks" below).
Empirically confirmed in the Evidence section. Zero HALT triggers fire.

---

## Goal (one paragraph)

Family H (`claim_clarity`) is doctrine-risk because 4 of its 12 ai_classifier
keys are verdict-adjacent at the clarity↔verdict boundary — `conclusion_missing`
(no-conclusion-stated → "argument is incomplete" drift), `reason_missing` (no
reason attached → "argument is unsupported" drift), `claim_specificity_low`
(broad claim → "weak/vague/lazy" drift), and `unclear_reference_present`
(ambiguous pronoun → speaker-judgment drift). The H Card 1 ship (`3097521`)
encoded the upstream `falsePositiveGuards` and `doctrineNotes` precisely
because these keys live in the verdict neighborhood; the persisted
`evidence_span` column is the binding read-side proof that the classifier did
not echo verdict tokens. The audit-lint L5 rule mechanically requires persisted
direct-output (`evidence_span`) inspection for Families E (`argument_scheme` /
`slippery_slope`), F (`critical_question` / `family_f` /
`consequence_probability_unclear`), and G (`resolution_progress` / `family_g` /
`concedes_broader_point`); it is **blind to Family H**. So a *future* H-prefix
smoke audit (Card 3's `MCP-021C-EDGE-FAMILY-H-ENABLE` production-flip smoke,
or any H amendment) authored with a canonical `MCP-SERVER-NNN-FAMILY-H-SMOKE`
title format could declare verdict PASS without any persisted `evidence_span`
inspection and the linter would let it through — exactly the `29f30b0`
improper-PASS defect class that motivated `OPS-MCP-SMOKE-DOCTRINE-HARDENING`.
This card converts the Family H doctrine proof from operator-discipline into
**mechanical L5 enforcement** by adding the doctrine-risk family aliases for
Family H to the `DOCTRINE_RISK_FAMILIES` DATA set in
`scripts/ops/audit-lint-rules.cjs`, plus the test fixtures that prove the new
teeth bite (synthetic H-improper FAILS L5) and that legitimate H audits are
preserved. It mechanizes L5 for H **before** Card 3 (production-enable) lands
— closing the gap the same way the F and G doctrine-risk cards did for their
canonical keys. **Doctrine note:** the audit-lint linter is a
structural/process gate, not a user-facing surface — no truth labels, no
scoring, no AI, no network, no secrets. It enforces the *evidence-doctrine*
discipline (factual standing requires persisted evidence inspection) at
audit-authoring time. This design respects cdiscourse-doctrine §1/§3 (the
linter never adjudicates argument truth; it checks that the audit *inspected*
the persisted span) and §6/§7 (pure regex + text, no keys, no LLM, no
network).

---

## Data model

**No new data model.** The only production-source change is adding string
entries to an existing in-memory `Set` (`DOCTRINE_RISK_FAMILIES`) in a pure-DATA
CommonJS module. No TypeScript types, no SQL, no migration, no schema.

### The exact DATA edit (A.1 alias decision)

`scripts/ops/audit-lint-rules.cjs`, the `DOCTRINE_RISK_FAMILIES` set (lines
55–79 in the current tree at HEAD `12ec7eb`) currently carries E's 2 + F's 3 +
G's 3:

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
  // Family G (resolution_progress). `family_g` is the string detectFamily()
  // actually emits for a `MCP-SERVER-NNN-FAMILY-G` title (mapFamilyLetterToName
  // has no G case → default branch → `family_g`); it is the load-bearing alias.
  // `resolution_progress` is the canonical key name (also covers any doc that
  // declares `Family: resolution_progress`). `concedes_broader_point` is the G
  // doctrinal-axis partner key (G's analog of E's `slippery_slope` / F's
  // `consequence_probability_unclear` — the highest-risk verdict-adjacent key,
  // reachable via a `Family:` declaration) — added for parallelism.
  'resolution_progress',
  'family_g',
  'concedes_broader_point',
]);
```

becomes (append H's 3 *after* G's 3 — do NOT reorder or remove any existing
member):

```js
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',
  // Family F (critical_question). […F's comment block byte-equal preserved…]
  'critical_question',
  'family_f',
  'consequence_probability_unclear',
  // Family G (resolution_progress). […G's comment block byte-equal preserved…]
  'resolution_progress',
  'family_g',
  'concedes_broader_point',
  // Family H (claim_clarity). `family_h` is the string detectFamily()
  // actually emits for a `MCP-SERVER-NNN-FAMILY-H` title (mapFamilyLetterToName
  // has no H case → default branch → `family_h`); it is the load-bearing alias.
  // `claim_clarity` is the canonical key name (also covers any doc that
  // declares `Family: claim_clarity`). `claim_specificity_low` is the H
  // doctrinal-axis partner key (H's analog of E's `slippery_slope` / F's
  // `consequence_probability_unclear` / G's `concedes_broader_point` — the
  // highest verdict-adjacency key: a broad claim is the single H key most
  // likely to be mis-framed as "weak/vague/lazy/sloppy", per the H Card 1
  // design § "axis-partner" choice) — added for parallelism.
  'claim_clarity',
  'family_h',
  'claim_specificity_low',
]);
```

**Exact strings to add (in this order):** `'claim_clarity'`, `'family_h'`,
`'claim_specificity_low'`.

**Why `family_h` is load-bearing and `claim_clarity` alone is a no-op:**
see A.1 evidence below. `detectFamily` maps the title letter H via
`mapFamilyLetterToName('H')`, which has no `H` case and falls through to
`default` → `` `family_${letter}` `` → `family_h`. A future H smoke audit
authored with the canonical `MCP-SERVER-NNN-FAMILY-H-SMOKE` title format
carries no body-level `Family:` declaration (the Card 1 H ship uses
`familyRegistryInit.register('claim_clarity', …)` server-side but no body-
declaration line). So the linter would classify a canonical-titled H doc as
`family: 'family_h'`. Adding only `claim_clarity` would never match it;
`family_h` is the alias the detector actually emits.

**Why `claim_specificity_low` is the axis-partner:** Per the H Card 1 design
(`docs/designs/MCP-SERVER-009-FAMILY-H.md` § A.1.4), the H "axis-partner"
key — H's analog to E's `slippery_slope`, F's `consequence_probability_unclear`,
and G's `concedes_broader_point` — is **`claim_specificity_low`**, the HIGHEST
verdict-adjacency: a broad claim is the single key most likely to be mis-framed
as "weak/vague/lazy/sloppy". It carries the strongest verbatim guard in
`familyH.ts`. The intent brief Decision D1 confirms this selection. The other 3
HIGHEST-risk keys (`conclusion_missing`, `reason_missing`,
`unclear_reference_present`) are NOT added; G's precedent was to add only the
single canonical axis-partner, not all MEDIUM-or-HIGH keys.

`MARKER_STRING` (`'Audit-Lint: v1'`) is unchanged. No other export changes.
**`mapFamilyLetterToName` is NOT touched** (that is logic — touching it fires
HALT trigger 1/6).

---

## File changes

**Modified (production DATA, ~12 lines: 3 strings + a 9-line comment block):**
- `scripts/ops/audit-lint-rules.cjs` — append 3 strings (with comment) to the
  `DOCTRINE_RISK_FAMILIES` set, after G's 3 entries. **This is the only
  production-source change.** No logic, no `.mjs`, no `audit-lint-lib.cjs`.

**New fixtures (3 files):**
- `__tests__/fixtures/audit-lint/family-h-original-PASS.md` — static copy of
  the on-main Card 1 H smoke (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md`
  at on-main SHA `12ec7eb`) + fixture marker on line 1 (~233 body lines +
  marker). **Notable difference from G's original-PARTIAL fixture:** the H
  smoke's verdict is PASS (not PARTIAL). The H smoke contains 15 `evidence_span`
  occurrences (the BINDING Phase 4b inspection-pattern language) → if the title
  detected as `family_h`, L5 would be satisfied via inspection-pattern mention.
  **BUT** the title format used by Card 1 (`# MCP-SERVER-009 Family H smoke —
  2026-05-31`, with a space and lower-case "Family H smoke" instead of the
  canonical `-FAMILY-H-SMOKE` form) does NOT match the family-letter regex
  `/MCP-SERVER-\d+-FAMILY-([A-Z])/i`. Result: this fixture lints as
  `family: null` / `auditType: unknown` / exit 0 — pinning the on-main
  behavior. The fixture's role is "Card 1 smoke baseline preservation" — it
  guards against any future regression that would change the lint outcome of
  the Card 1 smoke doc. (Surfaced in §"Risks" as a documented limitation, NOT
  a regression of this card.)
- `__tests__/fixtures/audit-lint/family-h-amendment-PASS.md` — **hand-authored
  representative** H amendment / production-enable smoke shape with verdict
  PASS + persisted `evidence_span` inspection + canonical
  `MCP-SERVER-009-FAMILY-H` title format → `detectFamily()` returns `family_h`
  → DOCTRINE_RISK = true → `hasInspection` true → L5 satisfied → exit 0
  (~75 lines). Card 3's production-enable smoke does not exist yet
  (operator-deferred — Card 3 hasn't shipped), so this fixture is the
  representative shape, mirroring `family-g-amendment-PASS` in role. Full body
  in the "Fixture matrix" section below.
- `__tests__/fixtures/audit-lint/family-h-IMPROPER-PASS-no-evidence-span.md` —
  SYNTHETIC hand-authored negative fixture; H-amendment shape with every
  `evidence_span` trigger stripped, verdict PASS, L6 intact, canonical
  `-FAMILY-H` title format (~70 lines; full body in the "Fixture matrix"
  section below). Verified empirically to trip `["L5"]` only.

**Modified tests (~50–65 lines net add):**
- `__tests__/opsAuditLint.test.ts`:
  - New `describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — …')`
    block(s) for the new unit + fixture tests (mirror the G blocks at lines
    1219–1355).
  - In the existing "fixture-directory invariants" block (lines 1361–1399):
    extend the `FIXTURE_FILES` array from 10 → 13 entries (append the 3 new H
    filenames); change `fixture count is exactly 10` assertion `toHaveLength(10)`
    → `toHaveLength(13)` (line ~1397) and rename the `it()` label to
    `'fixture count is exactly 13'`.
  - The 4 hardening fixture `it()`s, the 3 F fixture `it()`s (lines 1179–1217),
    and the 3 G fixture `it()`s (lines 1317–1355) stay **byte-identical**.

**Modified docs:**
- `docs/ops/AUDIT-LINT.md` — ENHANCE the existing "The fixture directory"
  section with the 3 new H fixture bullets, change "exactly 10" to "exactly 13"
  in the fixture-count assertion, and update the "Adding a doctrine-risk
  family" how-to one-line note ("Family H followed the same DATA path") at
  the same spot the F and G additions sit. (~10–15 lines.) **Fixture-count
  phrasing note:** add "exactly 13 = 4 hardening + 3 F + 3 G + 3 H" or
  equivalent — the implementer picks accurate prose; the load-bearing fact is
  the count is 13.
- `__tests__/fixtures/audit-lint/README.md` — update the "exactly 10" prose
  (line 26) to "exactly 13", add 3 new rows to the expected-outcomes table
  (after the G rows at lines 110–112), and add a note that
  `family-h-original-PASS` is extracted from `12ec7eb` via `git show` while
  `family-h-amendment-PASS` + `family-h-IMPROPER-PASS-no-evidence-span` are
  hand-authored (re-author from this design's bodies, not extracted). Also add
  the H title-format trap as a one-sentence note explaining why the
  `family-h-original-PASS` fixture lints as `family: null` (it preserves the
  Card 1 title-format quirk verbatim). (~25 lines.) **Scope rationale:** the
  README lives under `__tests__/fixtures/audit-lint/` (a fixture-dir `.md`),
  so it falls inside the brief's `__tests__/fixtures/audit-lint/*.md`
  allowance; updating it keeps the self-validation contract coherent (its
  prose + table become stale on a 3-fixture add). This is a documented scope
  clarification per the brief §2, not a scope expansion — identical to how the
  F and G cards handled the README.
- `docs/core/current-status.md` — handoff (Phase framing + new test count).
  (~1 stage block.)

**This design doc + the smoke audit doc:**
- `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md` — this file.
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-2026-05-31.md`
  — post-merge smoke audit (implementer/operator authors per §8 of the intent;
  must carry `Audit-Lint: v1` and self-lint clean).
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-template.md`
  — pre-merge smoke template (per F/G precedent; 5-phase: membership +
  preservation + detectFamily + L5 firing + fixture self-validation; carries
  `Audit-Lint: v1` and self-lints clean).

**Deleted:** none.

**MUST NOT touch (re-affirmed):** `scripts/ops/audit-lint.mjs` LOGIC,
`scripts/ops/audit-lint-lib.cjs` LOGIC (incl. `mapFamilyLetterToName` — that
is logic), `mcp-server/**`, `supabase/functions/**`, `src/**` non-test,
`package.json`/`package-lock.json`, `.github/workflows/audit-lint.yml`,
Source 6, the 4 hardening fixtures + the 3 F fixtures + the 3 G fixtures
(byte-equal), Family A-G prompts / keys / taxonomy / schema, production
registry flags. **Do not start Card 3.**

---

## API / interface contracts

No callable interface changes. `DOCTRINE_RISK_FAMILIES` is consumed by exactly
one logic path — `applyL5` in `audit-lint-lib.cjs`:

```js
// audit-lint-lib.cjs applyL5 (READ ONLY — quoted for context, NOT edited):
isDoctrineRisk = !!parsed.family && rules.DOCTRINE_RISK_FAMILIES.has(parsed.family);
// ...
const hasInspection = rules.L5_PERSISTED_INSPECTION_PATTERNS.some((re) => re.test(fullDocText));
if (hasInspection) { return []; }   // <- mention of evidence_span anywhere passes L5
return [{ rule: 'L5', severity: 'error', message: 'Doctrine-risk audit does not inspect persisted direct output (evidence_span or equivalent).', ... }];
```

The contract that matters: `applyL5` reads `rules.DOCTRINE_RISK_FAMILIES` **at
call time** (the lib `require`s the rules module once at load; the Set is
mutated by us only at authoring-edit time, not at runtime). Adding members to
the Set is the entire mechanism. `applyL5` is **verdict-blind** (no
`verdict === 'PASS'` check) and `hasInspection` tests the **full doc text** for
any of the 5 `L5_PERSISTED_INSPECTION_PATTERNS` (the most permissive being the
bare word `\bevidence_span\b`).

The 5 L5 inspection patterns (the strings the synthetic H fixture must NOT
contain):
- `/\bevidence_span\b/i`
- `/SELECT[\s\S]{0,200}evidence_span/i`
- `/\|\s*evidence_span\s*\|/i`
- `/persisted\s+evidence/i`
- `/direct[-\s]output\s+inspection/i`

---

## Edge cases (the implementer must handle)

- **Alias the detector ignores (A.1 trap).** Adding `claim_clarity` alone is a
  silent no-op for a canonical-titled H doc — it detects as `family_h`. The fix
  MUST include `family_h`. A unit test pins
  `detectFamily('# MCP-SERVER-009-FAMILY-H-SMOKE — x', body) === 'family_h'` so
  a future refactor that adds an `H` case to `mapFamilyLetterToName` (changing
  the emitted string) will fail loudly rather than silently un-arming L5.
- **The H Card 1 smoke title-format quirk (load-bearing observation).** The
  Card 1 H smoke audit on main uses the title `# MCP-SERVER-009 Family H smoke
  — 2026-05-31` (space-separated, lower-case "Family H smoke"), which does NOT
  match the audit-lint family-detect regex
  `/MCP-SERVER-\d+-FAMILY-([A-Z])/i`. As a result, `detectFamily()` returns
  `null` and `detectAuditType()` returns `unknown` for this specific audit
  doc. **Consequence:** the byte-copy `family-h-original-PASS` fixture lints
  PASS as `family: null` / `auditType: unknown` — not as `family_h`. This is
  NOT a Card 2 regression (the on-main lint outcome is preserved exactly).
  This IS a documented limitation: Card 2's L5 mechanization does NOT
  retroactively bite the Card 1 smoke doc, contrary to the smoke audit's own
  self-claim that "after Card 2 lands on main, audit-lint will retroactively
  enforce L5 against this audit." The fix would be to amend the Card 1 audit
  to use the canonical `-FAMILY-H-SMOKE` title form, OR for Card 3's
  production-enable smoke to use the canonical title form (highly recommended;
  any future H amendment / production-enable audit MUST use the canonical
  title format to be L5-protected). This card does NOT fix the Card 1 title
  (out of scope — would require an amendment of the on-main smoke doc;
  operator-deferred). The fixture preserves the on-main outcome and a code
  comment in the fixture (top-of-file marker) names the trap.
- **Consistent-PASS preserved by mention, not by verdict-awareness (A.2).**
  A future canonical-titled H smoke audit with verdict PASS that names
  `evidence_span` (either as a SELECT query, a `| evidence_span |` table
  header, a `persisted evidence` phrase, or a `direct-output inspection`
  phrase) passes L5 because `hasInspection` is true. The
  `family-h-amendment-PASS` fixture (hand-authored canonical-titled H doc with
  inspection-pattern language) is the regression guard. If a future H audit
  forgets to even mention `evidence_span`, L5 will (correctly) fire — that is
  the intended teeth, not a regression.
- **Detector returns ONE family; `claim_specificity_low` in the body does not
  change classification.** `detectFamily` for a `MCP-SERVER-009-FAMILY-H`
  title with no `Family:` declaration returns `family_h` regardless of how
  many times `claim_specificity_low` appears in the body. The body of all
  three H fixtures may freely mention `claim_specificity_low` as descriptive
  text — it is `parsed.family === 'family_h'` that arms L5, not the
  axis-partner key appearing in prose. (`claim_specificity_low` is added to
  the set only so that a *future* doc that explicitly declares
  `Family: claim_specificity_low` is also covered — the exact parallel of
  `slippery_slope` for E, `consequence_probability_unclear` for F,
  `concedes_broader_point` for G.)
- **Synthetic fixture must trip L5 ONLY (not L1/L2/L6).** The synthetic is an
  `amendment`-type doc (title contains AMENDMENT) → `amendment` has an empty
  required-phase set, so L1 cannot fire on NOT-RUN phases; all its phases are
  PASS anyway. It contains no L2 indirect-proof phrases. Its L6 provenance is
  intact (prior verdict named, gap/missing-proof named, newly-supplied-proof
  named). The only defect is the absent `evidence_span` inspection → `[L5]`
  only. Empirically confirmed below (`rules: ["L5"]`).
- **Fixture marker on line 1 + title on line 2.** `parseAuditDoc` (lines
  593–617 in `audit-lint-lib.cjs`) explicitly skips leading HTML-comment +
  blank lines to find the title, so a fixture with the `<!-- AUDIT-LINT-FIXTURE
  … -->` marker on line 1 and the `# MCP-SERVER-009-FAMILY-H-SMOKE …` title
  on line 2 still detects `family_h` and the correct audit type. Verified
  against the existing `family-f-IMPROPER-PASS-no-evidence-span.md` +
  `family-g-IMPROPER-PASS-no-evidence-span.md` fixtures, which use exactly
  this shape, and re-confirmed in the empirical probe.
- **`Audit-Lint: v1` marker inside the fixture body.** All three H fixtures
  carry `Audit-Lint: v1` (the real H smoke has it on its original line 3; the
  hand-authored fixtures include it). As a fixture the marker line moves down
  by one (after the prepended fixture comment) but is still present, so
  `hasMarker` parses true. This does not affect L5 (L5 keys on family +
  inspection-pattern presence, not the marker). The fixtures are
  direct-invoked by the test via `lintAuditDoc(fs.readFileSync(...))`, so CI
  marker-gating is irrelevant to the fixture assertions.
- **Doctrine ban-list scan does NOT reach the fixtures.** The verdict-token
  scanner (`scripts/ops/mcp-observability-report-lib.cjs`
  `scanMarkdownForBannedTokens`, tested in
  `__tests__/opsMcpObservabilityDoctrineBanList.test.ts`) scans the stitched
  **observability report** built from `opsMcpObservabilityFixture`, NOT
  `__tests__/fixtures/audit-lint/` or `docs/audits/`. The synthetic H fixture
  still carries the `<!-- AUDIT-LINT-FIXTURE … -->` marker per the README
  contract (defensive opt-out + required by the marker-invariant test).
  **Special caution for the real H smoke copy:** Card 1's smoke body quotes
  the H ban-list patterns (`weak|sloppy|lazy|careless|confused|unsound|…`)
  inside the Phase 4b SQL block as the *banned-token regex tested against
  evidence_span* — this is exactly why the fixture marker exclusion contract
  exists. The static copy preserves that SQL block verbatim (it is the
  inspection-pattern proof); the marker on line 1 opts it out of any ban-list
  scan, identical to how the F + G fixtures preserve adversarial input.
- **Empty / malformed doc.** Unchanged behavior — `lintAuditDoc` returns exit
  2 with a `parse` finding when title + audit-type + verdict are all
  unextractable. Not exercised by this card; no change.
- **Permission-denied / offline / concurrent edits.** Not applicable — pure
  text, no fs (in the lib), no network, no DB, no concurrency surface.

---

## Test plan

All tests live in `__tests__/opsAuditLint.test.ts` (the existing audit-lint
suite, currently passing as of the captured G-post baseline — the implementer
captures the pre-card count via `npx jest --testPathPattern="opsAuditLint"
--no-coverage` and aims for +11 net). Tests are pure:
`require('../scripts/ops/audit-lint-lib.cjs')` + `fs.readFileSync` of fixtures;
no React, no Supabase, no network. Mirror the G blocks at lines 1219–1355.

**New unit tests (doctrine-risk membership + L5 firing for Family H):**
- `__tests__/opsAuditLint.test.ts` — `DOCTRINE_RISK_FAMILIES.has('claim_clarity')`
  is `true`. (mirrors the G `…contains resolution_progress` test at line 1226)
- `__tests__/opsAuditLint.test.ts` — `DOCTRINE_RISK_FAMILIES.has('family_h')`
  is `true`. (mirrors the G `…contains family_g` test at line 1230)
- `__tests__/opsAuditLint.test.ts` —
  `DOCTRINE_RISK_FAMILIES.has('claim_specificity_low')` is `true`. (mirrors
  the G `…contains concedes_broader_point` test at line 1233)
- `__tests__/opsAuditLint.test.ts` — `preserves the existing Family E + F + G
  doctrine-risk members` — additive-only guard asserting `argument_scheme`,
  `slippery_slope`, `critical_question`, `family_f`,
  `consequence_probability_unclear`, `resolution_progress`, `family_g`,
  `concedes_broader_point` are all still present (HALT trigger 7 /
  E-F-G-drift guard). (extends the G card's "preserves the existing Family E
  + F doctrine-risk members" test at line 1239 to also cover the 3 G members.)
- `__tests__/opsAuditLint.test.ts` —
  `detectFamily('# MCP-SERVER-009-FAMILY-H-SMOKE — x', '…body…')` returns
  `'family_h'` (A.1-trap pin; documents that the title letter H maps to
  `family_h`, not `claim_clarity`). (mirrors the G A.1 pin at line 1253)
- `__tests__/opsAuditLint.test.ts` — L5 **fires** on a `family_h`-titled doc
  with verdict PASS and no `evidence_span` mention: build via
  `buildFamilyShipDoc({ titleOverride: '# MCP-SERVER-009-FAMILY-H-SMOKE — synthetic', phases: [['Phase 1 — Pre-flight','PASS']], verdict: 'PASS' })`;
  assert `findings.some(f => f.rule === 'L5')` is `true`. (mirrors the G
  firing test at line 1268)
- `__tests__/opsAuditLint.test.ts` — L5 does **NOT** fire on a
  `family_h`-titled doc that mentions `evidence_span` (e.g. a `SELECT …
  evidence_span …` line in a phase justification): assert
  `findings.some(f => f.rule === 'L5')` is `false`. (mirrors the G non-firing
  test at line 1278)

**New fixture self-validation tests (NEW `describe` block named for this card;
the existing 4 + 3 F + 3 G `it()`s stay byte-identical in their own blocks):**
- `__tests__/opsAuditLint.test.ts` — `family-h-original-PASS.md` →
  `exitCode === 0` and `findings` length 0 (Card 1 H smoke baseline preserved;
  documented in the test description that this passes because of the title-
  format quirk — `family: null` / `auditType: unknown` — not because of L5
  satisfaction; this is the load-bearing on-main-preservation regression
  guard).
- `__tests__/opsAuditLint.test.ts` — `family-h-amendment-PASS.md` →
  `exitCode === 0` and `findings` length 0 (representative H amendment /
  production-enable shape with canonical title format AND persisted inspection
  passes L5).
- `__tests__/opsAuditLint.test.ts` — `family-h-IMPROPER-PASS-no-evidence-span.md`
  → `exitCode === 1`; `findings.map(f => f.rule)` **contains `'L5'`**, and
  (teeth-precision) does **NOT** contain `'L1'`, `'L2'`, or `'L6'` (proves
  L5-only). This is the TEETH proof — the H analog of
  `family-g-IMPROPER-PASS-no-evidence-span` and
  `family-f-IMPROPER-PASS-no-evidence-span` and
  `original-family-e-IMPROPER-PASS`.

**Doctrine ban-list assertions:** N/A for user-facing strings — this card
touches no user-facing copy and no `gameCopy` codes. The audit-lint linter
explicitly is "not a verdict-token doctrine scanner" (per `AUDIT-LINT.md` §
"What the linter is NOT"). No new ban-list test is required; the existing
`opsMcpObservabilityDoctrineBanList` suite is untouched and out of scope.

**Existing-behavior regressions (edits to the invariants block, not new
`it()`s):**
- `FIXTURE_FILES` array grows 10 → 13 (adds the 3 new filenames).
- `fixture count is exactly 10` → `fixture count is exactly 13`;
  `toHaveLength(10)` → `toHaveLength(13)`; the `mdFiles.sort()` deep-equality
  now compares against all 13.
- The "each fixture file starts with the HTML comment marker" `it()` is
  unchanged in code but now iterates 13 files (the 3 new fixtures carry the
  marker, so it stays green).
- The 10 existing fixture assertions remain byte-identical and must still
  pass.

---

## Test forecast (precise)

**+11** (HALT ceiling **+30** per the intent brief §4; G shipped +10–+11 at
this same structure). Anchored to the post-G baseline.

Decomposition (11 new tests):
- 3 membership tests (`claim_clarity`, `family_h`, `claim_specificity_low`).
- 1 `preserves existing E + F + G members` additive-only guard (1 `it()`).
- 1 `detectFamily` → `family_h` A.1-trap pin.
- 2 L5 firing tests for `family_h` (fires without inspection; does not fire
  with `evidence_span`).
- 3 fixture self-validation `it()`s (h-original-PASS → 0; h-amendment-PASS →
  0; h-improper → 1 citing L5-only).
- 1 dedicated consistent-PASS regression — `family_h` PASS audit that names
  `evidence_span` does NOT fail L5 (documents the consistent-PASS mechanism
  independently of the static fixture; mirrors G's optional consistent-PARTIAL
  regression at line 1294).
- The `FIXTURE_FILES`/count-assertion edits modify existing `it()`s (no count
  delta); the marker `it()` iterates more files (no count delta).

Forecast = **+11** (matches the chain prompt's expected `~+11`). HALT 8
ceiling is +30; this card is well under. If the implementer's count exceeds
+30, HALT trigger fires.

After the card lands, the suite delta is +11 tests with exit 0.

---

## Dependencies (cards / docs / files)

- **Assumes complete:**
  - `MCP-SERVER-009-FAMILY-H` (Card 1 ship — PR #400 / `3097521`) — made the H
    admin path live and provided the canonical doctrine proof for
    `claim_specificity_low` selection as axis-partner.
  - `MCP-SERVER-009-FAMILY-H-SMOKE` (Card 1 smoke audit — PR #402 / `12ec7eb`,
    current HEAD) — it is the static-copy source for
    `family-h-original-PASS`. (See §"Risks" for the title-format trap.)
  - `OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK` (the immediate template,
    shipped 2026-05-29) — F and G's 6 entries in `DOCTRINE_RISK_FAMILIES` are
    the prerequisite Set state.
  - `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK` (transitively — F's 3
    entries in the Set).
  - `OPS-MCP-SMOKE-DOCTRINE-HARDENING` (the L1–L6 linter), `OPS-MCP-SMOKE-LINT-CI-WIRING`
    (the CI workflow) — all shipped; this card is a pure DATA extension of
    their `DOCTRINE_RISK_FAMILIES` set.
- **Reads existing:** `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES`
  (lines 55–79); `audit-lint-lib.cjs` `applyL5` (lines ~967–998), `detectFamily`
  (384–416), `mapFamilyLetterToName` (423–439), `parseAuditDoc` marker-skip
  (593–617) — READ ONLY; `__tests__/opsAuditLint.test.ts` blocks at lines
  903–1005 (L5), 1064–1106 (4-fixture self-validation), 1113–1217 (F
  doctrine-risk blocks), 1219–1355 (G doctrine-risk blocks — the immediate
  mirror), 1361–1399 (fixture-dir invariants), ~1441–1461
  (`buildFamilyShipDoc`).
- **Static-copy source (on `main` at `12ec7eb`):**
  `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` →
  `family-h-original-PASS.md`.
- **Will block / enable:** Card 3 (`MCP-021C-EDGE-FAMILY-H-ENABLE` —
  production-enable smoke + Edge family flip) is gated on this Card 2 smoke
  PASS. This card is the L5 mechanization prerequisite; it does NOT itself
  flip H to production (HALT trigger if proposed). The pattern extends to
  Family I/J if/when each ships and is proven doctrine-risk (add `family_i` /
  `family_j` + canonical key, mirror the 3-fixture pattern).

---

## Risks (things that might trip up the implementer)

- **Silent-no-op alias (highest-value gotcha).** Forgetting `family_h` and
  adding only `claim_clarity` produces a green suite (the membership test for
  `claim_clarity` passes) while leaving L5 blind to any future canonical-titled
  H audit. Mitigation: the `detectFamily → family_h` pin test + the
  `family-h-IMPROPER-PASS-no-evidence-span` teeth test (which only
  fails-correctly when `family_h` is present) both guard this. The implementer
  MUST run the synthetic fixture and confirm it fails with `family_h` in the
  set, not just that the membership test passes. (Empirically: WITHOUT
  `family_h` the synthetic lints exit 0 — see the negative control below.)
- **H Card 1 smoke title-format trap (documented limitation, NOT a Card 2
  defect).** The on-main Card 1 H smoke audit
  (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md`) uses the title
  `# MCP-SERVER-009 Family H smoke — 2026-05-31` (space-separated,
  lower-case), which does NOT match the family-detect regex. Consequence:
  this audit doc lints as `family: null` / `auditType: unknown` regardless of
  whether `family_h` is in the doctrine-risk set. The byte-copy
  `family-h-original-PASS` fixture preserves this on-main outcome (exit 0,
  `family: null`). The audit's own self-claim "Card 2 will retroactively scan
  this" is **false at the title-format level**. The fix (out of scope for this
  card): operator amends the Card 1 smoke doc to use canonical
  `-FAMILY-H-SMOKE-` form, OR Card 3's production-enable smoke MUST use the
  canonical title format (highly recommended). This Card 2 design includes a
  note in `__tests__/fixtures/audit-lint/README.md` flagging the trap and a
  test description that explicitly names the title-format reason for the
  fixture's `family: null` lint outcome (so it does not look like a bug). The
  alternative considered — amending the Card 1 audit title format as part of
  this card — is rejected because it violates the brief's "NO Family A-G
  fixture modification" prohibition (H-equivalent: NO Card 1 H smoke audit
  modification; that is a separate amendment card / out of scope).
- **Synthetic fixture accidentally re-introduces an `evidence_span` trigger.**
  The synthetic (`family-h-IMPROPER-PASS-no-evidence-span`) is derived from
  the amendment *shape*, not from the dense real H smoke text. The implementer
  must ensure ALL 5 inspection patterns stay absent — including the bare word
  `evidence_span`, the `| evidence_span |` table headers, the `SELECT …
  evidence_span` query blocks, and any `persisted evidence` /
  `direct-output inspection` phrasing. The design provides a hand-authored
  minimal synthetic body (below) that is already verified clean — RECOMMENDED
  to use it nearly verbatim.
- **`family-h-amendment-PASS` is the inverse risk — it MUST contain an
  `evidence_span` trigger.** Unlike the static `family-h-original-PASS`
  fixture (which fails into PASS via title-format quirk, not via L5
  inspection-pattern), the `family-h-amendment-PASS` is hand-authored with the
  canonical title format AND must include explicit `evidence_span` inspection-
  pattern language. If the implementer strips `evidence_span` from it by
  accident, it will (correctly, but unexpectedly) fail L5 because the title
  format DOES match `family_h` and L5 would fire. The provided body includes
  an explicit `SELECT … evidence_span …` readback section + an `| …
  evidence_span … |` table → `hasInspection` true → exit 0.
- **Synthetic fixture accidentally trips L1/L2/L6.** If the synthetic drops
  the L6 provenance, or names a NOT-RUN required phase under a non-amendment
  audit type, extra rules fire and the teeth test's "L5-only" precision
  assertion fails. The provided body is `amendment`-typed (empty
  required-phase set), all-PASS phases, full L6 provenance — empirically
  verified to trip `["L5"]` only.
- **Byte-equality of the 10 existing fixtures.** The `FIXTURE_FILES` array
  edit and count-assertion change are in the same `describe` block as the
  existing files; the implementer must edit ONLY the array + the count number
  + the count `it()` label, and must NOT touch the 4 hardening, 3 F, or 3 G
  fixture files or their `it()`s. A `git diff --stat` on the 10 existing
  fixtures must show 0 changed lines.
- **README staleness vs scope.** The README update is in-scope (fixture-dir
  `.md`) but the implementer must NOT edit the *body* of the existing fixtures'
  description in a way that changes their meaning — only add the 3 new rows,
  bump "10 → 13", add the `family-h-original-PASS` re-extraction command (a
  `git show 12ec7eb:…` line), note the two hand-authored H fixtures, and add
  the one-sentence H title-format trap explanation. The "DO NOT EDIT [fixture
  bodies]" clause still stands.
- **No CI workflow change.** `.github/workflows/audit-lint.yml` is correct
  and out of scope. Adding fixtures under `__tests__/fixtures/` does NOT
  match the workflow's `docs/audits/**SMOKE*.md` trigger path, so CI scope is
  unaffected. The post-merge smoke audit doc DOES live under `docs/audits/`
  and will be linted by CI — it must carry `Audit-Lint: v1` and self-lint
  clean (exit 0).
- **Migration / operator deploy.** None. This is a pure code+docs change with
  no DB, no Edge Function, no deploy.

---

## Out of scope (explicit — reduces scope creep)

- Any change to `audit-lint.mjs` or `audit-lint-lib.cjs` LOGIC (incl. adding
  an `H` case to `mapFamilyLetterToName`). A data-only change is sufficient
  and proven; touching logic would fire HALT trigger 1/6.
- Family I/J doctrine-risk enrollment (I/J are unsupported; H is the only
  family this card enrolls).
- **Amending the on-main Card 1 H smoke audit title format** to use the
  canonical `-FAMILY-H-SMOKE-` shape. That is a separate amendment card
  (out of scope per the brief's "NO Family A-G fixture modification"
  equivalent for H). The fixture preserves the on-main outcome verbatim; the
  trap is surfaced in §"Risks" and the README.
- Adding a `verdict`-awareness check to L5 (it is intentionally verdict-blind;
  consistent-PASS is preserved by inspection-pattern mention — see A.2).
  Changing L5 firing semantics is a logic change → HALT trigger.
- Broad historical-corpus enforcement (the `--report-only docs/audits/`
  census stays informational; CI scope stays new/modified-marked-only).
- Any taxonomy / prompt / key / production-flag / `package.json` change.
  **The H production flip is Card 3 — do NOT start it.**
- Editing the 4 hardening, 3 F, or 3 G fixtures' bodies, or weakening any
  existing Family E, F, or G rule.
- The post-merge smoke audit *execution* (Phase 1–5 of the intent §8) — that
  is the operator/implementer smoke step after merge, not part of the design.
  The smoke template `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-template.md`
  IS authored as part of this card (per the brief's IN-scope list).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):**
  The audit-lint linter never adjudicates who is right in a debate and never
  labels a claim true/false. L5 checks that an *audit doc* inspected the
  persisted `evidence_span` column — a process/evidence-discipline gate, not
  a truth verdict on any argument. Nothing here touches posting, scoring, or
  strength bands. The H fixtures preserve the Card 1 H smoke's quoted
  ban-list regex tokens (`weak|sloppy|lazy|careless|confused|unsound|…`) only
  as the *banned-token regex tested against evidence_span* (the
  inspection-pattern doctrine input) — the marker contract opts them out of
  ban-list scans. RESPECTED.
- **cdiscourse-doctrine §3 (popularity is not evidence) / evidence-doctrine
  (factual standing requires persisted evidence):** L5 is the
  *meta-enforcement* of exactly this doctrine: it mechanically requires that
  a doctrine-risk family audit inspected the persisted direct-output evidence
  before claiming PASS. Adding Family H extends that evidence-discipline to
  `claim_clarity` — the family whose 4 HIGHEST-risk verdict-adjacent keys
  (`conclusion_missing`, `reason_missing`, `claim_specificity_low`,
  `unclear_reference_present`) are precisely the ones whose persisted
  `evidence_span` must be re-read to confirm no verdict-token echo (the Card
  1 smoke audit's Phase 4b SQL block encodes this exact scan). RESPECTED and
  reinforced.
- **cdiscourse-doctrine §4 (AI moderator limits):** No AI. The linter is
  pure regex + text parsing; the brief and the lib both forbid LLM/network.
  RESPECTED.
- **cdiscourse-doctrine §5 (rules engine is sacred):**
  `src/lib/constitution/engine.ts` is untouched. This card touches an OPS
  audit-lint DATA file, not the Constitution engine. RESPECTED.
- **cdiscourse-doctrine §6/§7 (secrets; no AI calls from prod):** No keys,
  no `.env*`, no service-role, no Anthropic/xAI/X. The lib has no
  fs/spawn/network; the rules file is pure data. The fixtures' example
  JWT/token lines are shown `[REDACTED]` (mirroring the real audits).
  RESPECTED.
- **cdiscourse-doctrine §9 (plain language for users):** N/A — no
  user-facing strings. Internal codes (`family_h`, `claim_clarity`,
  `claim_specificity_low`) live only in an operator-facing rules file and
  operator docs, never surfaced to end users. RESPECTED.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** Not applicable
  — this card touches no node label, no AnnotationChipDescriptor, no UI
  surface. The audit-lint linter operates on `docs/audits/*SMOKE*.md`
  operator-facing text, not user-facing labels. RESPECTED.
- **test-discipline (tests are part of done):** The card ships +11 tests
  covering membership, the E+F+G-preserved guard, the A.1 detector trap, L5
  firing/non-firing for `family_h`, the consistent-PASS regression, and 3
  fixture assertions incl. the teeth proof. The 4 hardening + 3 F + 3 G
  fixtures + their assertions are preserved. Test count goes UP (+11). Suite
  must exit 0 (typecheck + lint + jest). RESPECTED.
- **Intent-brief HALT triggers (numbered 1–7 + 11):** evaluated in the table
  below — none fire. Triggers 7 (Adversarial Explore L5 teeth verification
  finds blocking refutation) is SATISFIED by the synthetic H fixture proving
  L5-only teeth. Trigger 11 (`family_h` alias missing) is SATISFIED by the
  explicit inclusion of `family_h` in the appended set + the membership +
  detectFamily-pin tests. RESPECTED.

---

## Operator steps (if any)

**None for the code change** — pure code + docs, no DB, no Edge Function, no
deploy, no env var.

**Post-merge smoke (operator/implementer, per intent §8):** run the 5-phase
smoke and author
`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-2026-05-31.md`
(must carry `Audit-Lint: v1`; self-lints clean):
1. **Phase 1 — membership:** `family_h` + `claim_clarity` +
   `claim_specificity_low` entries present in Set.
2. **Phase 2 — preservation:** Family A–G entries byte-equal preserved.
3. **Phase 3 — `detectFamily()`:** returns `family_h` for a canonical
   `# MCP-SERVER-009-FAMILY-H-SMOKE` title.
4. **Phase 4 — L5 firing:** synthetic H-improper → exit 1 citing L5;
   `family-h-amendment-PASS` → 0; `family-h-original-PASS` → 0 (NB:
   `family: null` due to Card 1 title-format quirk — document this in the
   smoke audit).
5. **Phase 5 — 3 fixture self-validation:** plus 10 existing fixtures still
   exit `1,0,0,0,0,0,1,0,0,1`.
6. Regression: `npm run typecheck`; `npm run lint`;
   `npx jest --testPathPattern="opsAuditLint" --no-coverage` (exit 0).
7. Dogfood: the smoke audit doc lints itself clean (`Audit-Lint: v1` marker;
   exit 0). **NB:** the smoke audit doc title MUST use the canonical
   `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE` form (no
   `-FAMILY-H` letter substring, so it does NOT trigger family-detect; it
   detects as audit-type `ops` per the existing `AUDIT_TYPE_PATTERNS.ops`
   `/^#\s*OPS-/im` pattern — same behavior as the G smoke audit doc).

The Supabase GitHub integration auto-deploys on merge, but this card changes
no migration and no Edge Function, so the auto-deploy is a no-op for this
card.

---

## Fixture matrix (13 fixtures — exit codes + finding codes)

| # | Fixture | Source | Audit type | Verdict | Expected exit | Finding rules | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `original-family-e-IMPROPER-PASS.md` | static (29f30b0) | family-ship | PASS | **1** | `L1, L2, L5` | E improper-PASS centerpiece — UNCHANGED |
| 2 | `family-e-amendment-PARTIAL.md` | static (b1829f5) | amendment | PARTIAL | **0** | (none) | consistent-PARTIAL — UNCHANGED |
| 3 | `family-e-hosted-completion-PASS.md` | static (bccb0c2) | hosted-completion | PASS | **0** | (none) | gap closed by direct proof — UNCHANGED |
| 4 | `family-d-strengthened-amendment-PASS.md` | static | amendment | PASS | **0** | (none) | model amendment — UNCHANGED |
| 5 | `family-f-original-PARTIAL.md` | static (6395023) | family-ship | PARTIAL | **0** | (none) | F PARTIAL passes L5 via `evidence_span` mention — UNCHANGED |
| 6 | `family-f-amendment-PASS.md` | static (6395023) | amendment | PASS | **0** | (none) | F amendment passes L5 via persisted inspection — UNCHANGED |
| 7 | `family-f-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | F teeth — UNCHANGED |
| 8 | `family-g-original-PARTIAL.md` | static (1c19d11) | family-ship | PARTIAL | **0** | (none) | G PARTIAL passes L5 via `evidence_span` mention — UNCHANGED |
| 9 | `family-g-amendment-PASS.md` | HAND-AUTHORED representative | amendment | PASS | **0** | (none) | representative G amendment with persisted inspection — UNCHANGED |
| 10 | `family-g-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | G teeth — UNCHANGED |
| 11 | `family-h-original-PASS.md` | static (on main, `12ec7eb`) | **unknown** | PASS | **0** | (none) | Card 1 H smoke; **title-format quirk → `family: null` / `auditType: unknown`** → L5 unreachable; exit 0 preserves on-main lint outcome (NOT a doctrine satisfaction — see §"Risks" trap) |
| 12 | `family-h-amendment-PASS.md` | HAND-AUTHORED representative | amendment | PASS | **0** | (none) | representative H amendment / production-enable shape with canonical title format AND persisted `evidence_span` inspection → `family: family_h` → DOCTRINE_RISK = true → `hasInspection` true → L5 satisfied (real Card 3 smoke operator-deferred) |
| 13 | `family-h-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | TEETH — H doctrine-risk + verdict PASS + NO `evidence_span` → L5 fires; L1/L2/L6 do NOT |

Fixtures 1–10 produce **exits 1, 0, 0, 0, 0, 0, 1, 0, 0, 1** unchanged with the
H aliases added (empirically verified). Fixtures 11–13 produce **exits 0, 0,
1**.

### Fixture 11 — `family-h-original-PASS.md` (static copy)

Static copy of the on-main Card 1 H smoke
(`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` at SHA `12ec7eb`)
with the `<!-- AUDIT-LINT-FIXTURE … -->` marker prepended on line 1. It
detects as `auditType: unknown` / `family: null` because the title format
`# MCP-SERVER-009 Family H smoke — 2026-05-31` (space-separated, lower-case
"Family H smoke") does not match the family-letter regex. The fixture's
purpose is to **pin the on-main lint outcome verbatim** (so any future
linter/title-format regression is caught). Even though the audit body
contains 15 `evidence_span` occurrences (the Phase 4b inspection-pattern
language), `applyL5` returns no findings because `parsed.family` is `null` →
`isDoctrineRisk` is `false`. **Do NOT edit the body** (the quoted Phase 4b
SQL block carries banned-token regex patterns as the inspection-pattern
input; the marker opts it out of ban-list scans). Extraction recipe is in
the README update.

### Fixture 12 — `family-h-amendment-PASS.md` (HAND-AUTHORED representative; verified exit 0)

Card 3's real production-enable smoke does not exist yet (Card 3 is gated
by this Card 2 smoke PASS). This fixture is the representative shape,
mirroring `family-g-amendment-PASS` in role. Line 1 is the fixture marker;
line 2 is the title (contains canonical `MCP-SERVER-009-FAMILY-H-AMENDMENT`
→ `family_h` and `AMENDMENT` → amendment type). It carries a persisted
`evidence_span` readback (a `SELECT … evidence_span …` block + an
`| … | evidence_span | … |` table) → `hasInspection` true → exit 0. Use
nearly verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-009-FAMILY-H-AMENDMENT — Production-enable completion (representative)

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` (PASS — Phase 4 + 4b operator-deferred to Card 3).
**Reason:** Representative production-enable completion. Lifts the Card 1 admin_validation-only state to production by supplying the operator-run Edge admin_validation cycle + the binding Phase 4b persisted direct-output readback against production-mode H rows.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family H smoke audit | `12ec7eb` | **PASS** | Phase 1-3 hosted MCP smoke 23/23 PASS. Phase 4 Edge admin_validation cycle NOT-RUN (operator-deferred). Phase 4b persisted readback NOT-RUN (no production H rows yet). Prior verdict: PASS structurally; doctrine-risk inspection deferred to Card 3. |
| **This amendment** | (this commit) | **PASS** | Phase 4 + 4b closed by operator-supplied production-enable smoke. The doctrine-risk persisted `evidence_span` readback was performed against the first production H rows. Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 4 — Edge admin_validation + production cycle (Family H)

**Status:** PASS

​```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production'
→ HTTP 200; time_total=18s
​```

Seeded args classified successfully; positives within the 12-key ai_classifier subset; no cross-family leakage.

---

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted `evidence_span` rows were queried for the H production runs and scanned for verdict-token drift:

​```
SELECT res.raw_key, res.confidence, res.evidence_span
  FROM public.argument_machine_observation_results res
  JOIN public.argument_machine_observation_runs r ON r.id = res.run_id
 WHERE res.family = 'claim_clarity'
   AND r.run_mode = 'production';
​```

| raw_key | persisted evidence_span | verdict token? |
| --- | --- | --- |
| claim_specificity_low | "Carbon taxes work" (the bare claim verbatim) | NO |
| reason_missing | "EVs are good" (the bare claim verbatim) | NO |
| conclusion_missing | "Therefore — [the reasoning chain]" (the bare reasoning verbatim) | NO |

The persisted `evidence_span` anchored the structural ABSENCE / BREADTH and did NOT echo any verdict word (weak / sloppy / lazy / careless / confused / unsound / unsupported / incoherent / illogical / wrong / incomplete / failed / bad reasoning / bad argument / bad writing). The binding L5 obligation (persisted `argument_machine_observation_results.evidence_span` inspection against H ban-list) is SATISFIED.

---

## Final upgraded verdict

**PASS** — Phase 4 production cycle supplied; the doctrine-risk persisted `evidence_span` readback re-affirmed clean; Card 1 PASS preserved and extended.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

### Fixture 13 — `family-h-IMPROPER-PASS-no-evidence-span.md` (SYNTHETIC; verified clean; `["L5"]` only)

Line 1 is the fixture marker; line 2 is the title (contains canonical
`MCP-SERVER-009-FAMILY-H-AMENDMENT` → `family_h` and `AMENDMENT` → amendment
type). Body has all phases PASS, full L6 provenance, and **zero** L5
inspection triggers. This is the H analog of
`family-g-IMPROPER-PASS-no-evidence-span` and
`family-f-IMPROPER-PASS-no-evidence-span`. Use nearly verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-009-FAMILY-H-AMENDMENT — SYNTHETIC improper PASS (doctrine fixture)

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` (PASS — Phase 4 + 4b deferred).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family H smoke audit | `12ec7eb` | **PASS** | Phase 1-3 hosted MCP smoke PASS. Phase 4 NOT-RUN. Phase 4b NOT-RUN. Prior verdict: PASS capped by deferred obligations. |
| **This amendment** | (this commit) | **PASS** | Phase 4 closed by operator-supplied production cycle. Gap closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 4 — Edge production cycle (Family H)

**Status:** PASS

​```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production'
→ HTTP 200; time_total=18s
​```

Seeded args classified successfully; positives within the 12-key ai_classifier subset.

---

## Amendment §1 — Production cycle proof

**Status:** PASS

Production cycle completed cleanly. Run rows show status=success. Zero cross-family leakage. The proof is supplied by direct invocation evidence above.

---

## Final upgraded verdict

**PASS** — All required phases now have direct invocation proof; Card 1 PASS preserved and extended.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

(The ​``` fences in fixtures 12 + 13 above are shown with a zero-width
marker only to keep this design doc's own code fence intact; the
implementer writes plain ``` triple-backtick fences in the fixture files.
Fixture 13 has NO `evidence_span`, NO `| evidence_span |`, NO `SELECT …
evidence_span`, NO `persisted evidence`, NO `direct-output inspection`.
Fixture 12 DELIBERATELY has the `SELECT … evidence_span` block + the `| …
evidence_span … |` table so L5 is satisfied.)

### Static-copy extraction for fixture 11

Per the fixture README's `git show <sha>:<path>` recipe, the source is on
`main` at `12ec7eb`. On Windows/PowerShell:

```powershell
git show 12ec7eb:docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md |
  Out-File -Encoding utf8 $env:TEMP\raw.md
# then prepend the marker line as line 1:
@('<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') +
  (Get-Content $env:TEMP\raw.md) |
  Set-Content -Encoding utf8 __tests__/fixtures/audit-lint/family-h-original-PASS.md
```

(Bash equivalent, if available:
`git show 12ec7eb:docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md > /tmp/raw.md && cat <(echo '<!-- AUDIT-LINT-FIXTURE: … -->') /tmp/raw.md > __tests__/fixtures/audit-lint/family-h-original-PASS.md`.)
The fixture body must be byte-identical to the on-main version and remain
frozen at `12ec7eb`. Verify after extraction:
`node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-h-original-PASS.md`
→ exit 0 (with `family: null` for the documented title-format reason).

---

## Smoke template (`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE-template.md`)

Per the F + G precedent, this card produces a 5-phase smoke template
authored as part of the design package. The template carries `Audit-Lint:
v1` and self-lints clean. Skeleton (the implementer fills in actual smoke
results post-merge):

```markdown
# OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK-SMOKE — Post-merge smoke (TEMPLATE)

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Card:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK (Card 2 of 3-card H chain)
**Predecessor:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK (2026-05-29)
**Verdict:** TBD (implementer fills in post-merge)

---

## Phase 1 — Membership (Set additions present)

**Status:** TBD

Required:
- `DOCTRINE_RISK_FAMILIES.has('claim_clarity')` → true
- `DOCTRINE_RISK_FAMILIES.has('family_h')` → true
- `DOCTRINE_RISK_FAMILIES.has('claim_specificity_low')` → true

Verification command:
​```
node -e "const r = require('./scripts/ops/audit-lint-rules.cjs'); console.log({ claim_clarity: r.DOCTRINE_RISK_FAMILIES.has('claim_clarity'), family_h: r.DOCTRINE_RISK_FAMILIES.has('family_h'), claim_specificity_low: r.DOCTRINE_RISK_FAMILIES.has('claim_specificity_low') });"
​```

---

## Phase 2 — Preservation (Family A–G byte-equal)

**Status:** TBD

Required:
- `argument_scheme`, `slippery_slope` present (E)
- `critical_question`, `family_f`, `consequence_probability_unclear` present (F)
- `resolution_progress`, `family_g`, `concedes_broader_point` present (G)
- Set size = 11 (was 8 after G; +3 for H = 11)

---

## Phase 3 — detectFamily H → family_h

**Status:** TBD

Required: a canonical `MCP-SERVER-009-FAMILY-H-SMOKE` title detects as `family_h`.

---

## Phase 4 — L5 firing/non-firing

**Status:** TBD

Required:
- Family-H titled doc WITHOUT `evidence_span` inspection → exit 1 with `L5` finding
- Family-H titled doc WITH `evidence_span` inspection → exit 0
- `Family: claim_clarity` declaration + no inspection → exit 1 with `L5`

---

## Phase 5 — Fixture self-validation

**Status:** TBD

Required: 13 fixtures lint to expected outcomes (`1,0,0,0,0,0,1,0,0,1,0,0,1`).

---

## Final verdict: TBD

Smoke verdict authority: PASS (unblocks Card 3) | PARTIAL (chain pauses) |
FAIL (chain stops).
```

(The ​``` fences in the template above are shown with the zero-width marker
to keep the design fence intact.)

---

## Evidence section — empirical A.1 + A.2 + teeth probe outputs

Read-only node probes were run against the repo files (the rules `Set` was
mutated only in-memory in the probe via `.add()`, never on disk; the probe
scripts + the candidate fixture bodies were prototyped in-memory only — they
are NOT committed). The lib reads `rules.DOCTRINE_RISK_FAMILIES` at call
time, so `.add()` on the live Set exercises `applyL5` exactly as the on-disk
DATA edit will. The starting set is the **post-G on-disk state** (E's 2 +
F's 3 + G's 3 = 8 entries); the probe adds H's 3 on top.

### A.1 — detector output + title-format trap discovery

```
H smoke title (on-main Card 1):  "# MCP-SERVER-009 Family H smoke — 2026-05-31"
  detectFamily → null            ← KEY FINDING: title format does NOT match /MCP-SERVER-\d+-FAMILY-([A-Z])/i
  auditType    → "unknown"
  verdict      → "PASS"
  evidence_span literal count    → 15

Canonical title (synthetic):     "# MCP-SERVER-009-FAMILY-H-SMOKE — Post-merge smoke"
  detectFamily → "family_h"      ← would-be H detection
  auditType    → "family-ship"

mapFamilyLetterToName("H")       → "family_h"   (default branch; no H case)
mapFamilyLetterToName("G")       → "family_g"
mapFamilyLetterToName("F")       → "family_f"
mapFamilyLetterToName("E")       → "argument_scheme"

H smoke "Family:" decl?          → none
```

**A.1 conclusion:**
1. The canonical-titled H doc detects as `family_h` (NOT `claim_clarity`);
   `mapFamilyLetterToName('H')` returns `family_h` via the `default` branch
   (no `H` case). **Load-bearing alias = `family_h`.**
2. The Card 1 H smoke on main uses a **non-canonical title format**
   (space-separated, lower-case "Family H smoke") that fails the
   family-letter regex. This is a **title-format trap** that limits this
   card's reach over the Card 1 smoke doc — but it does NOT change the H
   doctrine-risk mechanization for future canonical-titled H audits.

Add `claim_clarity` (canonical/declared-name) + `family_h` (detector output)
+ `claim_specificity_low` (doctrinal-axis partner, parallel to E's
`slippery_slope` / F's `consequence_probability_unclear` / G's
`concedes_broader_point`). `mapFamilyLetterToName` is NOT touched.

### Baseline (post-G on-disk set) — BEFORE adding H

```
DOCTRINE_RISK_FAMILIES = [
  "argument_scheme","slippery_slope",
  "critical_question","family_f","consequence_probability_unclear",
  "resolution_progress","family_g","concedes_broader_point"
]
H smoke on main                                  {"exit":0,"rules":[],"family":null,"auditType":"unknown","verdict":"PASS"}
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}
fixture family-f-original-PARTIAL                {"exit":0,"rules":[],...}
fixture family-f-amendment-PASS                  {"exit":0,"rules":[],...}
fixture family-f-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}
fixture family-g-original-PARTIAL                {"exit":0,"rules":[],...}
fixture family-g-amendment-PASS                  {"exit":0,"rules":[],...}
fixture family-g-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}
```

### A.2 — after adding `claim_clarity` + `family_h` + `claim_specificity_low`

```
DOCTRINE_RISK_FAMILIES = [
  …8 prior entries…,
  "claim_clarity","family_h","claim_specificity_low"
]
H smoke on main                                  {"exit":0,"rules":[],"family":null,...}                 <- UNCHANGED (title-format trap)
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}                 <- unchanged
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}                               <- unchanged
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}                               <- unchanged
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}                               <- unchanged
fixture family-f-original-PARTIAL                {"exit":0,"rules":[],...}                               <- unchanged
fixture family-f-amendment-PASS                  {"exit":0,"rules":[],...}                               <- unchanged
fixture family-f-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}                           <- unchanged
fixture family-g-original-PARTIAL                {"exit":0,"rules":[],...}                               <- unchanged
fixture family-g-amendment-PASS                  {"exit":0,"rules":[],...}                               <- unchanged
fixture family-g-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}                           <- unchanged
```

**A.2 conclusion: DATA-ONLY.** Adding `family_h` does NOT make the on-main
Card 1 H smoke audit newly fail (it stays `family: null` due to the
title-format trap → `applyL5` short-circuits). The 10 existing fixtures stay
exactly **1, 0, 0, 0, 0, 0, 1, 0, 0, 1**. No logic change required. HALT
triggers 1/6/7 do NOT fire.

### Teeth proof — synthetic H-improper with canonical title (negative control + with `family_h`)

```
synthetic title:   "# MCP-SERVER-009-FAMILY-H-SMOKE — synthetic improper"
synthetic body:    no evidence_span; no SELECT…evidence_span; no | evidence_span |; no persisted evidence; no direct-output inspection
synthetic verdict: PASS
synthetic phases:  Phase 1 — Pre-flight PASS only

synthetic contains any L5 inspection trigger? false (must be false)
synthetic evidence_span literal count: 0 (must be 0)
  /\bevidence_span\b/i               -> false
  /SELECT[\s\S]{0,200}evidence_span/i -> false
  /\|\s*evidence_span\s*\|/i          -> false
  /persisted\s+evidence/i             -> false
  /direct[-\s]output\s+inspection/i   -> false

--- WITHOUT family_h (post-G set) — negative control ---
synthetic {"exit":0,"rules":[],"family":"family_h","auditType":"family-ship","verdict":"PASS"}   <- would WRONGLY pass without H in set

--- WITH family_h + claim_clarity + claim_specificity_low added ---
synthetic {"exit":1,"rules":["L5"],"family":"family_h","auditType":"family-ship","verdict":"PASS"}   <- exit 1, rules ["L5"] ONLY (teeth)
```

**Teeth conclusion:** Without `family_h`, the synthetic improper-PASS wrongly
passes (exit 0) — proving the rule is currently blind to Family H. With
`family_h`, it fails with **exit 1, finding `["L5"]` ONLY** — not L1/L2/L6.
This is the regression that satisfies HALT trigger 7 / 11 and is the H analog
of `family-g-IMPROPER-PASS-no-evidence-span` /
`family-f-IMPROPER-PASS-no-evidence-span` /
`original-family-e-IMPROPER-PASS`. (Note: the probe used a `family-ship`
title since `auditType: family-ship` is what `MCP-SERVER-009-FAMILY-H-SMOKE`
detects to; the hand-authored fixture body uses an `AMENDMENT` title to
detect as `auditType: amendment` so the empty required-phase set rules L1
out — the implementer follows the Fixture 13 body exactly.)

### Representative H amendment-PASS — verified exit 0 (with + without H aliases)

```
h-amendment-PASS WITHOUT H aliases {"exit":0,"rules":[],"family":"family_h","auditType":"amendment","verdict":"PASS"}
h-amendment-PASS WITH H aliases    {"exit":0,"rules":[],"family":"family_h","auditType":"amendment","verdict":"PASS"}   <- evidence_span present -> L5 satisfied
```

The representative amendment passes both ways because it carries the
persisted `evidence_span` readback (its `SELECT … evidence_span` block +
`| … evidence_span … |` table satisfy `hasInspection`). This proves "the
future Card 3 production-enable smoke can pass L5 when the evidence is
supplied with a canonical title format."

### Suite baseline note

The implementer captures the pre-card test count via
`npx jest --testPathPattern="opsAuditLint" --no-coverage` and confirms the
+11 forecast. The post-G baseline was approximately 157–158 tests (147
pre-G + 10–11 from G); the precise pre-card baseline is captured by the
implementer in the smoke audit.

---

## HALT-trigger evaluation (mirror the intent §5 — 7 triggers)

| # | Trigger | Fires? | Why |
| --- | --- | --- | --- |
| 1 | Required-reading missing | NO | All required docs read: intent brief, G design template, current audit-lint-rules.cjs, Card 1 H smoke, H Card 1 design, fixture README, opsAuditLint.test.ts G blocks |
| 2 | Standard preflight not green | NO | Pre-design probe ran cleanly; no typecheck/lint/test changes required for the design phase |
| 6 | roadmap-reviewer returns BLOCK | DEFERRED | Reviewer evaluates the implementer's output, not this design — designer's role ends here |
| 7 | Adversarial Explore (L5 teeth verification) finds blocking refutation | NO | Synthetic H-improper FAILS L5 with `["L5"]` only (empirical confirmation above); negative control without `family_h` proves teeth bite is load-bearing |
| 8 | Test delta > +30 | NO | Forecast +11; well under the +30 ceiling |
| 9 | Card A smoke was FAIL or PARTIAL-with-no-evidence-span-claim | NO | Card 1 smoke (`12ec7eb`) verdict is PASS; carries 15 `evidence_span` occurrences including the BINDING inspection-pattern language for Card 2's retroactive enforcement target. (Title-format quirk is a separate documented limitation, not a HALT 9 condition — the inspection-pattern language IS present in the audit doc body.) |
| 11 | `family_h` alias missing from the added set | NO | `family_h` is explicit in the 3 set additions (first, second, third are `claim_clarity` / `family_h` / `claim_specificity_low`); the membership test pins it; the detectFamily-pin test pins the title→`family_h` mapping; the teeth fixture proves the alias is load-bearing |

**No HALT trigger fires. The card proceeds as data-and-tests.** Triggers 7
and 11 are the correctness core and are both empirically clear above.

---

## Carry-forward invariants (CHAIN PROMPT VERIFICATION)

The chain prompt's "CARRY-FORWARD INVARIANTS" section requires byte-equality
on 8 surfaces. This design respects all 8:

- `scripts/ops/audit-lint.mjs` byte-equal — DATA-only edit, NO logic change. ✓
- `scripts/ops/audit-lint-lib.cjs` byte-equal — NO logic change incl.
  `mapFamilyLetterToName`. ✓
- `mapFamilyLetterToName` byte-equal — explicitly not touched (HALT 1
  guard). ✓
- `.github/workflows/audit-lint.yml` byte-equal — CI workflow unchanged. ✓
- Family A–G fixtures byte-equal — the 10 existing fixtures are not modified;
  only their `FIXTURE_FILES` array entry order is preserved + 3 new entries
  appended. ✓
- E / F / G entries in `DOCTRINE_RISK_FAMILIES` byte-equal — the design
  appends H's 3 entries AFTER G's 3 (no reordering, no removal). ✓
- `package.json` byte-equal — no new dependency. ✓
- No new dependency — pure DATA + tests + docs. ✓
