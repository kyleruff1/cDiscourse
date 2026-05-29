# OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — Design

**Status:** Design draft
**Epic:** Epic 12 — MCP / semantic-referee track (OPS audit-lint sub-track)
**Release:** OPS hardening (audit-lint RULES, data-and-tests)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/357
**Card type:** audit-lint RULES — **data-and-tests**, NOT logic-and-runtime
**Intent brief:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-intent.md`
**Template (mirrored exactly):** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK.md`

This card is a faithful replica of the already-shipped Family F doctrine-risk
card, applied to Family G. It adds Family G to L5 doctrine-risk enforcement
exactly as `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK` added Family F.
Every decision below is the G analog of an F decision, empirically re-confirmed
against the current tree (the on-disk set already carries E's 2 + F's 3).

---

## A.2 OUTCOME (one line, decisive)

**data-only** — no logic change. The real Family G PARTIAL audit
(`docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md`, Card 1's smoke)
still passes L5 after adding `family_g` to `DOCTRINE_RISK_FAMILIES` (it names
`evidence_span` — 7 lines / 10 literal occurrences — so `hasInspection` is
true; L5 does not fire). Empirically confirmed below. Zero HALT triggers fire.

---

## Goal (one paragraph)

Family G (`resolution_progress`) doctrine was proven **live** by Card 1
(`MCP-SERVER-008-FAMILY-G-SMOKE`, PARTIAL) Phase 4b — the binding
resolution↔verdict existential: Fixture C's input named verdict framing three
times ("you basically **won** this point and I **lost** the broader argument…
You **beat** me"); the G classifier detected `concedes_broader_point` (the
highest-risk axis-partner key) but its persisted `evidence_span` anchored the
structural relinquishment ("I withdraw the broad claim and stand on the narrow
scope only") and did **NOT** echo any verdict word. That proof currently lives
only in operator discipline. The audit-lint L5 rule mechanically requires
persisted direct-output (`evidence_span`) inspection for Families E
(`argument_scheme` / `slippery_slope`) and F (`critical_question` / `family_f` /
`consequence_probability_unclear`); it is **blind to Family G**. So a *future*
G-prefix smoke audit (e.g. Card 1's hosted-completion amendment, or Card 3's
production-enable) could declare verdict PASS without any persisted
`evidence_span` inspection and the linter would let it through — exactly the
`29f30b0` improper-PASS defect class that motivated
`OPS-MCP-SMOKE-DOCTRINE-HARDENING`. This card converts the Family G doctrine
proof from operator-discipline into **mechanical L5 enforcement** by adding the
doctrine-risk family aliases for Family G to the `DOCTRINE_RISK_FAMILIES` DATA
set in `scripts/ops/audit-lint-rules.cjs`, plus the test fixtures that prove the
new teeth bite (synthetic G-improper FAILS L5) and that legitimate G audits
(the real PARTIAL with its binding-obligation mention; a representative
hosted-completion amendment PASS-with-evidence) are preserved. It mechanizes L5
for G **before** any production flip (Card 3) — closing the gap the same way the
F doctrine-risk card did for `critical_question`. **Doctrine note:** the
audit-lint linter is a structural/process gate, not a user-facing surface — no
truth labels, no scoring, no AI, no network, no secrets. It enforces the
*evidence-doctrine* discipline (factual standing requires persisted evidence
inspection) at audit-authoring time. This design respects cdiscourse-doctrine
§1/§3 (the linter never adjudicates argument truth; it checks that the audit
*inspected* the persisted span) and §6/§7 (pure regex + text, no keys, no LLM,
no network).

---

## Data model

**No new data model.** The only production-source change is adding string
entries to an existing in-memory `Set` (`DOCTRINE_RISK_FAMILIES`) in a pure-DATA
CommonJS module. No TypeScript types, no SQL, no migration, no schema.

### The exact DATA edit (A.1 alias decision)

`scripts/ops/audit-lint-rules.cjs`, the `DOCTRINE_RISK_FAMILIES` set (lines
55–68 in the current tree) currently carries E's 2 + F's 3:

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

becomes (append G's 3 *after* F's 3 — do NOT reorder or remove any existing
member):

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

**Exact strings to add (in this order):** `'resolution_progress'`, `'family_g'`,
`'concedes_broader_point'`.

**Why `family_g` is load-bearing and `resolution_progress` alone is a no-op:**
see A.1 evidence below. `detectFamily` maps the title letter G via
`mapFamilyLetterToName('G')`, which has no `G` case and falls through to
`default` → `` `family_${letter}` `` → `family_g`. The real on-main G smoke
carries no body-level `Family:` declaration. So the linter classifies the real
G doc as `family: 'family_g'`. Adding only `resolution_progress` would never
match it; `family_g` is the alias the detector actually emits.

`MARKER_STRING` (`'Audit-Lint: v1'`) is unchanged. No other export changes.
**`mapFamilyLetterToName` is NOT touched** (that is logic — touching it fires
HALT trigger 1/6).

---

## File changes

**Modified (production DATA, ~9 lines: 3 strings + a 6-line comment block):**
- `scripts/ops/audit-lint-rules.cjs` — append 3 strings (with comment) to the
  `DOCTRINE_RISK_FAMILIES` set, after F's 3 entries. **This is the only
  production-source change.** No logic, no `.mjs`, no `audit-lint-lib.cjs`.

**New fixtures (3 files):**
- `__tests__/fixtures/audit-lint/family-g-original-PARTIAL.md` — static copy of
  the on-main G PARTIAL smoke (`docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md`
  at the on-main SHA `1c19d11`) + fixture marker on line 1 (~137 body lines +
  marker). Detects `family-ship` / `family_g`, verdict PARTIAL.
- `__tests__/fixtures/audit-lint/family-g-amendment-PASS.md` — **hand-authored
  representative** G hosted-completion amendment (verdict PASS + persisted
  `evidence_span` inspection) + fixture marker on line 1 (~70 lines). Card 1's
  real hosted-completion amendment does not exist yet (operator-deferred — the
  operator must run the hosted 21/21 with `MCP_HOSTED_TOKEN`), so this fixture
  is the representative shape, mirroring `family-f-amendment-PASS` in role.
  **NOTE the role difference vs F:** `family-f-amendment-PASS` was a *static
  copy* of a real on-main F amendment; `family-g-amendment-PASS` is
  *hand-authored* because no real G amendment exists yet. Full body in the
  "Fixture matrix" section below.
- `__tests__/fixtures/audit-lint/family-g-IMPROPER-PASS-no-evidence-span.md` —
  SYNTHETIC hand-authored negative fixture; G-amendment shape with every
  `evidence_span` trigger stripped, verdict PASS, L6 intact (~62 lines; full
  body in the "Fixture matrix" section below).

**Modified tests (~40–55 lines net add):**
- `__tests__/opsAuditLint.test.ts`:
  - New `describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — …')`
    block(s) for the new unit + fixture tests (mirror the F blocks at lines
    1113–1217).
  - In the existing "fixture-directory invariants" block (lines 1223–1259):
    extend the `FIXTURE_FILES` array from 7 → 10 entries (append the 3 new G
    filenames); change `fixture count is exactly 7` assertion `toHaveLength(7)`
    → `toHaveLength(10)` (line ~1256) and rename the `it()` label to
    `'fixture count is exactly 10'`.
  - The 4 existing fixture `it()`s ("4-fixture self-validation" block, lines
    1064–1106) AND the 3 existing F fixture `it()`s (the F self-validation
    block, lines 1179–1217) stay **byte-identical**.

**Modified docs:**
- `docs/ops/AUDIT-LINT.md` — ENHANCE the existing "The fixture directory"
  section (lines ~272–303) with the 3 new G fixture bullets, change "contains 7
  audit-doc fixtures — 6 STATIC … plus 1 SYNTHETIC" to reflect 10 fixtures (7
  static-or-real-shaped + … see note below), and update the "fixture count is
  exactly 7" line (~303) → "exactly 10". The "Adding a doctrine-risk family"
  how-to (lines ~192–254) already documents the alias-the-detector-needs trap
  and even names `family_g` as an example — add a one-line "Family G followed
  the same DATA path" note. (~15 lines.) **Fixture-count phrasing note:** the
  G amendment-PASS is hand-authored representative (not a static copy), so the
  "6 STATIC … plus 1 SYNTHETIC" phrasing must become "7 static / real-shaped + 2
  hand-authored representative-or-synthetic" or equivalent — the implementer
  picks accurate prose; the load-bearing fact is the count is 10.
- `__tests__/fixtures/audit-lint/README.md` — update the "exactly 7 … plus the
  three Family F …" prose (lines 23–28) to "exactly 10 … plus the three Family G
  …", add the 3 new rows to the expected-outcomes table (lines 84–92), add a
  re-extraction `git show 1c19d11:…` command for `family-g-original-PARTIAL`,
  and a note that `family-g-amendment-PASS` + `family-g-IMPROPER-PASS-no-evidence-span`
  are hand-authored (re-author from this design's bodies, not extracted). (~22
  lines.) **Scope rationale:** the README lives under
  `__tests__/fixtures/audit-lint/` (a fixture-dir `.md`), so it falls inside the
  brief's `__tests__/fixtures/audit-lint/*.md` allowance; updating it keeps the
  self-validation contract coherent (its prose + table become stale on a
  3-fixture add). This is a documented scope clarification per the brief §2, not
  a scope expansion — identical to how the F card handled the README.
- `docs/core/current-status.md` — handoff (Phase framing + new test count).
  (~1 stage block.)

**This design doc + the smoke audit doc:**
- `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK.md` — this file.
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE-2026-05-29.md`
  — post-merge smoke audit (implementer/operator authors per §9 of the intent;
  must carry `Audit-Lint: v1` and self-lint clean).

**Deleted:** none.

**MUST NOT touch (re-affirmed):** `scripts/ops/audit-lint.mjs` LOGIC,
`scripts/ops/audit-lint-lib.cjs` LOGIC (incl. `mapFamilyLetterToName` — that is
logic), `mcp-server/**`, `supabase/functions/**`, `src/**` non-test,
`package.json`/`package-lock.json`, `.github/workflows/audit-lint.yml`, Source 6,
the 4 hardening fixtures + the 3 F fixtures (byte-equal), Family A–G prompts /
keys / taxonomy / schema, production registry flags. **Do not start Card 3.**

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

The 5 L5 inspection patterns (the strings the synthetic G fixture must NOT
contain):
- `/\bevidence_span\b/i`
- `/SELECT[\s\S]{0,200}evidence_span/i`
- `/\|\s*evidence_span\s*\|/i`
- `/persisted\s+evidence/i`
- `/direct[-\s]output\s+inspection/i`

---

## Edge cases (the implementer must handle)

- **Alias the detector ignores (A.1 trap).** Adding `resolution_progress` alone
  is a silent no-op for the real G doc — it detects as `family_g`. The fix MUST
  include `family_g`. A unit test pins
  `detectFamily('# MCP-SERVER-008-FAMILY-G-SMOKE — x', body) === 'family_g'` so
  a future refactor that adds a `G` case to `mapFamilyLetterToName` (changing
  the emitted string) will fail loudly rather than silently un-arming L5.
- **Consistent-PARTIAL preserved by mention, not by verdict-awareness (A.2 /
  Decision 5).** A PARTIAL G audit with Phase 3 NOT-RUN must NOT fail. It passes
  L5 because it **names** `evidence_span` as the deferred / BINDING obligation
  (Card 1's Phase 4b queries `argument_machine_observation_results.evidence_span`
  for resolution-verdict tokens) → `hasInspection` true. The
  `family-g-original-PARTIAL` fixture (the real on-main G smoke) is the
  regression guard. If a future G PARTIAL audit forgets to even mention
  `evidence_span`, L5 will (correctly) fire — that is the intended teeth, not a
  regression.
- **Detector returns ONE family; `concedes_broader_point` in the body does not
  change classification.** `detectFamily` for a `MCP-SERVER-008-FAMILY-G` title
  with no `Family:` declaration returns `family_g` regardless of how many times
  `concedes_broader_point` appears in the body. The body of all three G
  fixtures may freely mention `concedes_broader_point` as descriptive text — it
  is `parsed.family === 'family_g'` that arms L5, not the axis-partner key
  appearing in prose. (`concedes_broader_point` is added to the set only so that
  a *future* doc that explicitly declares `Family: concedes_broader_point` is
  also covered — the exact parallel of `slippery_slope` for E.)
- **Synthetic fixture must trip L5 ONLY (not L1/L2/L6).** The synthetic is an
  `amendment`-type doc (title contains AMENDMENT) → `amendment` has an empty
  required-phase set, so L1 cannot fire on NOT-RUN phases; all its phases are
  PASS anyway. It contains no L2 indirect-proof phrases. Its L6 provenance is
  intact (prior verdict named, gap/missing-proof named, newly-supplied-proof
  named). The only defect is the absent `evidence_span` inspection → `[L5]`
  only. Empirically confirmed below (`rules: ["L5"]`).
- **Fixture marker on line 1 + title on line 2.** `parseAuditDoc` (lines
  593–617) explicitly skips leading HTML-comment + blank lines to find the
  title, so a fixture with the `<!-- AUDIT-LINT-FIXTURE … -->` marker on line 1
  and the `# MCP-SERVER-008-FAMILY-G-SMOKE …` title on line 2 still detects
  `family_g` and the correct audit type. Verified against the existing
  `family-f-IMPROPER-PASS-no-evidence-span.md` fixture, which uses exactly this
  shape, and re-confirmed in the empirical probe below.
- **`Audit-Lint: v1` marker inside the fixture body.** All three G fixtures
  carry `Audit-Lint: v1` (the real G smoke has it on its original line 3; the
  hand-authored fixtures include it). As a fixture the marker line moves down by
  one (after the prepended fixture comment) but is still present, so `hasMarker`
  parses true. This does not affect L5 (L5 keys on family + inspection-pattern
  presence, not the marker). The fixtures are direct-invoked by the test via
  `lintAuditDoc(fs.readFileSync(...))`, so CI marker-gating is irrelevant to the
  fixture assertions.
- **Doctrine ban-list scan does NOT reach the fixtures.** The verdict-token
  scanner (`scripts/ops/mcp-observability-report-lib.cjs`
  `scanMarkdownForBannedTokens`, tested in
  `__tests__/opsMcpObservabilityDoctrineBanList.test.ts`) scans the stitched
  **observability report** built from `opsMcpObservabilityFixture`, NOT
  `__tests__/fixtures/audit-lint/` or `docs/audits/`. The synthetic G fixture
  still carries the `<!-- AUDIT-LINT-FIXTURE … -->` marker per the README
  contract (defensive opt-out + required by the marker-invariant test).
  **Special caution for the real G smoke copy:** Card 1's smoke body quotes
  verdict words ("won", "lost", "beat me") inside the Phase 4b adversarial table
  as the *input that was tested* — this is exactly why the fixture marker
  exclusion contract exists. The static copy preserves that quoted language
  verbatim (it is the existential proof); the marker on line 1 opts it out of
  any ban-list scan, identical to how the F fixtures preserve the "fallacy"
  adversarial input.
- **Empty / malformed doc.** Unchanged behavior — `lintAuditDoc` returns exit 2
  with a `parse` finding when title + audit-type + verdict are all
  unextractable. Not exercised by this card; no change.
- **Permission-denied / offline / concurrent edits.** Not applicable — pure
  text, no fs (in the lib), no network, no DB, no concurrency surface.

---

## Test plan

All tests live in `__tests__/opsAuditLint.test.ts` (the existing audit-lint
suite, currently **147 tests / exit 0** — the post-F state). Tests are pure:
`require('../scripts/ops/audit-lint-lib.cjs')` + `fs.readFileSync` of fixtures;
no React, no Supabase, no network. Mirror the F blocks at lines 1113–1217.

**New unit tests (doctrine-risk membership + L5 firing for Family G):**
- `DOCTRINE_RISK_FAMILIES.has('resolution_progress')` is `true`. (mirrors the F
  `…contains critical_question` test at line ~1114)
- `DOCTRINE_RISK_FAMILIES.has('family_g')` is `true`.
- `DOCTRINE_RISK_FAMILIES.has('concedes_broader_point')` is `true`.
- `preserves the existing Family E + F doctrine-risk members` —
  additive-only guard asserting `argument_scheme`, `slippery_slope`,
  `critical_question`, `family_f`, `consequence_probability_unclear` are all
  still present (HALT trigger 7 / E-F-drift guard). (extends the F card's
  "preserves the existing Family E doctrine-risk members" test at line ~1128 to
  also cover the 3 F members.)
- `detectFamily('# MCP-SERVER-008-FAMILY-G-SMOKE — x', '…body…')` returns
  `'family_g'` (A.1-trap pin; documents that the title letter G maps to
  `family_g`, not `resolution_progress`). (mirrors the F A.1 pin at line ~1137)
- L5 **fires** on a `family_g`-titled doc with verdict PASS and no
  `evidence_span` mention: build via
  `buildFamilyShipDoc({ titleOverride: '# MCP-SERVER-008-FAMILY-G-SMOKE — synthetic', phases: [['Phase 1 — Pre-flight','PASS']], verdict: 'PASS' })`;
  assert `findings.some(f => f.rule === 'L5')` is `true`. (mirrors the F firing
  test at line ~1152)
- L5 does **NOT** fire on a `family_g`-titled doc that mentions `evidence_span`
  (e.g. a `SELECT … evidence_span …` line in a phase justification): assert
  `findings.some(f => f.rule === 'L5')` is `false`. (mirrors the F non-firing
  test at line ~1162)

**New fixture self-validation tests (NEW `describe` block named for this card;
the existing 4 + 3 F `it()`s stay byte-identical in their own blocks):**
- `family-g-original-PARTIAL.md` → `exitCode === 0` and `findings` length 0
  (consistent-PARTIAL for G; the load-bearing Decision 5 regression).
- `family-g-amendment-PASS.md` → `exitCode === 0` and `findings` length 0
  (representative G amendment with persisted inspection passes L5).
- `family-g-IMPROPER-PASS-no-evidence-span.md` → `exitCode === 1`;
  `findings.map(f => f.rule)` **contains `'L5'`**, and (teeth-precision) does
  **NOT** contain `'L1'`, `'L2'`, or `'L6'` (proves L5-only). This is the TEETH
  proof — the G analog of `family-f-IMPROPER-PASS-no-evidence-span` and
  `original-family-e-IMPROPER-PASS`.

**Optional consistent-PARTIAL-for-G regression (recommended, +1):** a dedicated
`it('family_g PARTIAL audit with deferred evidence_span mention does NOT fail
L5')` that builds a `family_g`-titled PARTIAL doc whose justification names
`evidence_span` and asserts `exitCode === 0` — documents the consistent-PARTIAL
mechanism independently of the static fixture.

**Existing-behavior regressions (edits to the invariants block, not new
`it()`s):**
- `FIXTURE_FILES` array grows 7 → 10 (adds the 3 new filenames).
- `fixture count is exactly 7` → `fixture count is exactly 10`;
  `toHaveLength(7)` → `toHaveLength(10)`; the `mdFiles.sort()` deep-equality now
  compares against all 10.
- The "each fixture file starts with the HTML comment marker" `it()` is
  unchanged in code but now iterates 10 files (the 3 new fixtures carry the
  marker, so it stays green).
- The 7 existing fixture assertions (`original-family-e-IMPROPER-PASS` → exit 1
  / L1+L2; the 3 E/D PASS/PARTIAL → exit 0; `family-f-original-PARTIAL` → 0;
  `family-f-amendment-PASS` → 0; `family-f-IMPROPER-PASS-no-evidence-span` →
  exit 1 / L5-only) remain byte-identical and must still pass.

**Doctrine ban-list assertions:** N/A for user-facing strings — this card
touches no user-facing copy and no `gameCopy` codes. The audit-lint linter
explicitly is "not a verdict-token doctrine scanner" (per `AUDIT-LINT.md` §
"What the linter is NOT"). No new ban-list test is required; the existing
`opsMcpObservabilityDoctrineBanList` suite is untouched and out of scope.

---

## Test forecast (precise)

**+8 to +14** (HALT ceiling **+45**). Anchored to the captured baseline of
**147 tests / exit 0** in `opsAuditLint.test.ts` (the post-F state; see the
evidence section).

Decomposition:
- 3 membership tests (`resolution_progress`, `family_g`,
  `concedes_broader_point`).
- 1 `preserves existing E + F members` additive-only guard (1 `it()`).
- 1 `detectFamily` → `family_g` A.1-trap pin.
- 2 L5 firing tests for `family_g` (fires without inspection; does not fire with
  `evidence_span`).
- 3 fixture self-validation `it()`s (g-original-PARTIAL → 0; g-amendment-PASS →
  0; g-improper → 1 citing L5-only).
- (optional) 1 dedicated consistent-PARTIAL-for-G `it()`.
- The `FIXTURE_FILES`/count-assertion edits modify existing `it()`s (no count
  delta); the marker `it()` iterates more files (no count delta).

Minimum realistic = **+8**. Expected = **+10 to +12** (the F card landed
exactly +10 at this same structure). Upper bound if the implementer adds the
optional consistent-PARTIAL test plus a couple of extra teeth-precision
assertions = **~+14**. The brief's band is +8 to +25; this design forecasts the
tighter **+8 to +14**. If the implementer's count exceeds **+45**, HALT trigger
12 fires.

After the card lands, the suite should read ~**155–161 tests / exit 0**
(147 + 8…14).

---

## Dependencies (cards / docs / files)

- **Assumes complete:** `MCP-SERVER-008-FAMILY-G-SMOKE` (PARTIAL) — on `main` at
  `1c19d11`; it is the static-copy source for `family-g-original-PARTIAL`. Also
  `MCP-SERVER-008-FAMILY-G` (Card 1 ship, `2640bf9`) and
  `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` (Card 1A, `3f395f8`), which made the G
  admin path live and proved the doctrine existential. Also
  `OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK` (the immediate template,
  shipped at `a921164`), `OPS-MCP-SMOKE-DOCTRINE-HARDENING` (the L1–L6 linter)
  and `OPS-MCP-SMOKE-LINT-CI-WIRING` (the CI workflow) — all shipped; this card
  is a pure DATA extension of their `DOCTRINE_RISK_FAMILIES` set.
- **Reads existing:** `scripts/ops/audit-lint-rules.cjs` `DOCTRINE_RISK_FAMILIES`
  (lines 55–68); `audit-lint-lib.cjs` `applyL5` (lines 967–998), `detectFamily`
  (384–416), `mapFamilyLetterToName` (423–439), `parseAuditDoc` marker-skip
  (593–617) — READ ONLY; `__tests__/opsAuditLint.test.ts` blocks at lines
  903–1005 (L5), 1064–1106 (4-fixture self-validation), 1113–1217 (the F
  doctrine-risk blocks — the mirror), 1223–1259 (fixture-dir invariants),
  1294–1320 (`buildFamilyShipDoc`).
- **Static-copy source (on `main` at `1c19d11`):**
  `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` →
  `family-g-original-PARTIAL.md`.
- **Will block / enable:** Gate B (Card 3 — G production-flip + latency) is
  gated on Card 1's hosted-amendment-PASS AND this Card 2 PASS. This card is the
  L5 mechanization prerequisite; it does NOT itself flip G to production (HALT
  trigger if proposed). The pattern extends to Family H/I/J if/when each ships
  and is proven doctrine-risk (add `family_h` + canonical key, mirror the
  3-fixture pattern).

---

## Risks (things that might trip up the implementer)

- **Silent-no-op alias (highest-value gotcha).** Forgetting `family_g` and
  adding only `resolution_progress` produces a green suite (the membership test
  for `resolution_progress` passes) while leaving L5 blind to the real G audit.
  Mitigation: the `detectFamily → family_g` pin test + the
  `family-g-IMPROPER-PASS-no-evidence-span` teeth test (which only
  fails-correctly when `family_g` is present) both guard this. The implementer
  MUST run the synthetic fixture and confirm it fails with `family_g` in the
  set, not just that the membership test passes. (Empirically: WITHOUT
  `family_g` the synthetic lints exit 0 — see the negative control below.)
- **Synthetic fixture accidentally re-introduces an `evidence_span` trigger.**
  The synthetic (`family-g-IMPROPER-PASS-no-evidence-span`) is derived from the
  amendment *shape*, not from the dense real G smoke text. The implementer must
  ensure ALL 5 inspection patterns stay absent — including the bare word
  `evidence_span`, the `| evidence_span |` table headers, the
  `SELECT … evidence_span` query blocks, and any `persisted evidence` /
  `direct-output inspection` phrasing. The design provides a hand-authored
  minimal synthetic body (below) that is already verified clean — RECOMMENDED to
  use it nearly verbatim.
- **`family-g-amendment-PASS` is the inverse risk — it MUST contain an
  `evidence_span` trigger.** Unlike the F amendment (a dense static copy), the G
  amendment-PASS is hand-authored. If the implementer strips `evidence_span`
  from it by accident, it will (correctly, but unexpectedly) fail L5 and the
  fixture test breaks. The provided body includes an explicit
  `SELECT … evidence_span …` readback section + an `| … | evidence_span | … |`
  table → `hasInspection` true → exit 0. Verified below.
- **Synthetic fixture accidentally trips L1/L2/L6.** If the synthetic drops the
  L6 provenance, or names a NOT-RUN required phase under a non-amendment audit
  type, extra rules fire and the teeth test's "L5-only" precision assertion
  fails. The provided body is `amendment`-typed (empty required-phase set),
  all-PASS phases, full L6 provenance — verified to trip `["L5"]` only.
- **Byte-equality of the 7 existing fixtures.** The `FIXTURE_FILES` array edit
  and count-assertion change are in the same `describe` block as the existing
  files; the implementer must edit ONLY the array + the count number + the count
  `it()` label, and must NOT touch the 4 hardening or 3 F fixture files or their
  `it()`s. A `git diff --stat` on the 7 existing fixtures must show 0 changed
  lines.
- **README staleness vs scope.** The README update is in-scope (fixture-dir
  `.md`) but the implementer must NOT edit the *body* of the existing fixtures'
  description in a way that changes their meaning — only add the 3 new rows, bump
  "7 → 10", add the `family-g-original-PARTIAL` re-extraction command, and note
  the two hand-authored G fixtures. The "DO NOT EDIT [fixture bodies]" clause
  still stands.
- **No CI workflow change.** `.github/workflows/audit-lint.yml` is correct and
  out of scope. Adding fixtures under `__tests__/fixtures/` does NOT match the
  workflow's `docs/audits/**SMOKE*.md` trigger path, so CI scope is unaffected.
  The post-merge smoke audit doc DOES live under `docs/audits/` and will be
  linted by CI — it must carry `Audit-Lint: v1` and self-lint clean (exit 0).
- **Migration / operator deploy.** None. This is a pure code+docs change with no
  DB, no Edge Function, no deploy.

---

## Out of scope (explicit — reduces scope creep)

- Any change to `audit-lint.mjs` or `audit-lint-lib.cjs` LOGIC (incl. adding a
  `G` case to `mapFamilyLetterToName`). A data-only change is sufficient and
  proven; touching logic would fire HALT trigger 1/6.
- Family H/I/J doctrine-risk enrollment (H/I/J are unsupported; G is the only
  family this card enrolls).
- Adding a `verdict`-awareness check to L5 (it is intentionally verdict-blind;
  consistent-PARTIAL is preserved by inspection-pattern mention — see A.2).
  Changing L5 firing semantics is a logic change → HALT trigger.
- Broad historical-corpus enforcement (the `--report-only docs/audits/` census
  stays informational; CI scope stays new/modified-marked-only).
- Any taxonomy / prompt / key / production-flag / `package.json` change. **The G
  production flip is Card 3 — do NOT start it.**
- Editing the 4 hardening or 3 F fixtures' bodies, or weakening any existing
  Family E or F rule.
- The post-merge smoke audit *execution* (Phase 1–5 of the intent §8) — that is
  the operator/implementer smoke step after merge, not part of the design.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** The
  audit-lint linter never adjudicates who is right in a debate and never labels
  a claim true/false. L5 checks that an *audit doc* inspected the persisted
  `evidence_span` column — a process/evidence-discipline gate, not a truth
  verdict on any argument. Nothing here touches posting, scoring, or strength
  bands. The G fixtures preserve quoted verdict-word *input* ("won"/"lost"/
  "beat") only as the adversarial test material proving the classifier does NOT
  echo it — the marker contract opts them out of ban-list scans. RESPECTED.
- **cdiscourse-doctrine §3 (popularity is not evidence) / evidence-doctrine
  (factual standing requires persisted evidence):** L5 is the *meta-enforcement*
  of exactly this doctrine: it mechanically requires that a doctrine-risk family
  audit inspected the persisted direct-output evidence before claiming PASS.
  Adding Family G extends that evidence-discipline to `resolution_progress` —
  the family whose live proof (Fixture C's `concedes_broader_point`
  evidence_span anchoring "I withdraw the broad claim…" without echoing
  "won/lost/beat") is the canonical demonstration that the persisted span must
  be inspected, not assumed. RESPECTED and reinforced.
- **cdiscourse-doctrine §4 (AI moderator limits):** No AI. The linter is pure
  regex + text parsing; the brief and the lib both forbid LLM/network.
  RESPECTED.
- **cdiscourse-doctrine §5 (rules engine is sacred):**
  `src/lib/constitution/engine.ts` is untouched. This card touches an OPS
  audit-lint DATA file, not the Constitution engine. RESPECTED.
- **cdiscourse-doctrine §6/§7 (secrets; no AI calls from prod):** No keys, no
  `.env*`, no service-role, no Anthropic/xAI/X. The lib has no fs/spawn/network;
  the rules file is pure data. The fixtures' example JWT/token lines are shown
  `[REDACTED]` (mirroring the real audits). RESPECTED.
- **cdiscourse-doctrine §9 (plain language for users):** N/A — no user-facing
  strings. Internal codes (`family_g`, `resolution_progress`,
  `concedes_broader_point`) live only in an operator-facing rules file and
  operator docs, never surfaced to end users. RESPECTED.
- **test-discipline (tests are part of done):** The card ships +8 to +14 tests
  covering membership, the E+F-preserved guard, the A.1 detector trap, L5
  firing/non-firing for `family_g`, and 3 fixture assertions incl. the teeth
  proof. The 4 hardening + 3 F fixtures + their assertions are preserved. Test
  count goes UP (147 → ~155–161). Suite must exit 0 (typecheck + lint + jest).
  RESPECTED.
- **Intent-brief HALT triggers (12):** evaluated in the table below — none fire.
  Trigger 8 (must add a regression proving G L5 enforcement) is SATISFIED by the
  synthetic G fixture. Trigger 9 (the 7 existing fixtures keep
  `1,0,0,0,0,0,1`) is SATISFIED (empirically unchanged). Trigger 10 (A.2
  requires logic change) does NOT fire (A.2 = data-only). Trigger 11 (G PARTIAL
  newly fails) does NOT fire (empirically exit 0). RESPECTED.

---

## Operator steps (if any)

**None for the code change** — pure code + docs, no DB, no Edge Function, no
deploy, no env var.

**Post-merge smoke (operator/implementer, per intent §8):** run the 5-phase
smoke and author
`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK-SMOKE-2026-05-29.md`
(must carry `Audit-Lint: v1`; self-lints clean):
1. Existing-fixture regression: 4 hardening + 3 F fixtures still exit
   `1,0,0,0,0,0,1`.
2. Family G enforcement (teeth): synthetic G-improper → exit 1 citing L5;
   `family-g-amendment-PASS` → 0; `family-g-original-PARTIAL` → 0; real on-main
   G smoke → 0.
3. Report-only census:
   `for f in docs/audits/*SMOKE*.md; do node scripts/ops/audit-lint.mjs "$f" --report-only; done`
   — no crash; no NEW unexpected would-fail introduced by the G doctrine-risk
   add (compare would-fail-with-G vs would-fail-without-G; expect identical).
4. Regression: `npm run typecheck`; `npm run lint`;
   `npx jest --testPathPattern="opsAuditLint" --no-coverage`;
   `cd mcp-server && deno test --allow-net --allow-env --allow-read` (1022
   unchanged — no mcp-server touch). All exit 0.
5. Dogfood: the smoke audit doc lints itself clean (`Audit-Lint: v1` marker;
   exit 0).

The Supabase GitHub integration auto-deploys on merge, but this card changes no
migration and no Edge Function, so the auto-deploy is a no-op for this card.

---

## Fixture matrix (10 fixtures — exit codes + finding codes)

| # | Fixture | Source | Audit type | Verdict | Expected exit | Finding rules | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `original-family-e-IMPROPER-PASS.md` | static (29f30b0) | family-ship | PASS | **1** | `L1, L2, L5` | E improper-PASS centerpiece — UNCHANGED |
| 2 | `family-e-amendment-PARTIAL.md` | static (b1829f5) | amendment | PARTIAL | **0** | (none) | consistent-PARTIAL — UNCHANGED |
| 3 | `family-e-hosted-completion-PASS.md` | static (bccb0c2) | hosted-completion | PASS | **0** | (none) | gap closed by direct proof — UNCHANGED |
| 4 | `family-d-strengthened-amendment-PASS.md` | static | amendment | PASS | **0** | (none) | model amendment — UNCHANGED |
| 5 | `family-f-original-PARTIAL.md` | static (6395023) | family-ship | PARTIAL | **0** | (none) | F PARTIAL passes L5 via `evidence_span` mention — UNCHANGED |
| 6 | `family-f-amendment-PASS.md` | static (6395023) | amendment | PASS | **0** | (none) | F amendment passes L5 via persisted inspection — UNCHANGED |
| 7 | `family-f-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | F teeth — UNCHANGED |
| 8 | `family-g-original-PARTIAL.md` | static (on main, `1c19d11`) | family-ship | PARTIAL | **0** | (none) | G PARTIAL passes L5 via `evidence_span` mention (7 lines / 10 literal) → consistent-PARTIAL preserved |
| 9 | `family-g-amendment-PASS.md` | HAND-AUTHORED representative | amendment | PASS | **0** | (none) | representative G amendment with persisted `evidence_span` inspection → legitimate PASS preserved (real amendment operator-deferred) |
| 10 | `family-g-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | TEETH — G doctrine-risk + verdict PASS + NO `evidence_span` → L5 fires; L1/L2/L6 do NOT |

Fixtures 1–7 produce **exits 1, 0, 0, 0, 0, 0, 1** unchanged with the G aliases
added (empirically verified below). Fixtures 8–10 produce **exits 0, 0, 1**.

### Fixture 8 — `family-g-original-PARTIAL.md` (static copy)

Static copy of the on-main Card 1 G smoke
(`docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` at SHA `1c19d11`)
with the `<!-- AUDIT-LINT-FIXTURE … -->` marker prepended on line 1. It detects
`family-ship` / `family_g`, verdict PARTIAL, and names `evidence_span` (7 grep
lines / 10 literal occurrences) as the Phase 4b binding obligation →
`hasInspection` true → L5 does not fire → exit 0. **Do NOT edit the body** (the
quoted "won/lost/beat" adversarial input is the existential proof; the marker
opts it out of ban-list scans). Extraction recipe is in the README update.

### Fixture 9 — `family-g-amendment-PASS.md` (HAND-AUTHORED representative; verified exit 0)

Card 1's real hosted-completion amendment does not exist yet (operator-deferred
— the operator must run the hosted 21/21 with `MCP_HOSTED_TOKEN`). This fixture
is the representative shape, mirroring `family-f-amendment-PASS` in role. Line 1
is the fixture marker; line 2 is the title (contains `MCP-SERVER-008-FAMILY-G`
→ `family_g` and `AMENDMENT` → amendment type). It carries a persisted
`evidence_span` readback (a `SELECT … evidence_span …` block + an
`| … | evidence_span | … |` table) → `hasInspection` true → exit 0. Use nearly
verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-008-FAMILY-G-SMOKE — Amendment (live-evidence completion; representative)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (PARTIAL — Phase 3 hosted operator-deferred).
**Reason:** Representative hosted-completion amendment. Lifts the prior PARTIAL to PASS by supplying the operator-run hosted 21/21, and re-affirms the binding doctrine-risk persisted direct-output readback.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family G smoke audit | `2640bf9` | **PARTIAL** | Phase 1, 2, 4, 4b, 5, 6 PASS. Phase 3 NOT-RUN (operator-token-gated). Prior verdict: PARTIAL capped by Gap 1 (hosted 21/21 unmet obligation). |
| **This amendment** | (this commit) | **PASS** | Gap 1 closed by operator-supplied hosted MCP smoke (21/21 PASS, EXIT 0). Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 3 — Hosted MCP smoke (21 checks)

**Status:** PASS

​```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]
PASS [20-compat-boolean-family-g]
PASS [21-mcp-tools-call-boolean-family-g]
MCP-SERVER-001 smoke: 21 PASSES, 0 FAILS
EXIT: 0
​```

21/21 PASS, EXIT 0.

---

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted `evidence_span` rows were re-queried for the G runs and scanned for resolution-verdict tokens:

​```
SELECT raw_key, confidence, evidence_span
  FROM argument_machine_observation_results
 WHERE run_id IN ('8489ec32...', '8a3cabef...');
​```

| raw_key | persisted evidence_span | verdict token? |
| --- | --- | --- |
| concedes_broader_point | "I withdraw the broad claim and stand on the narrow scope only" | NO |
| narrows_claim | "they work where enforcement is stable" | NO |

The persisted `evidence_span` anchored the structural relinquishment and did NOT echo any verdict word. The binding L5 obligation (persisted `argument_machine_observation_results.evidence_span` inspection) is SATISFIED.

---

## Final upgraded verdict

**PASS** — Phase 3 hosted 21/21 supplied; the doctrine-risk persisted `evidence_span` readback re-affirmed clean; prior PARTIAL lifted.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

### Fixture 10 — `family-g-IMPROPER-PASS-no-evidence-span.md` (SYNTHETIC; verified clean; `["L5"]` only)

Line 1 is the fixture marker; line 2 is the title (contains
`MCP-SERVER-008-FAMILY-G` → `family_g` and `AMENDMENT` → amendment type). Body
has all phases PASS, full L6 provenance, and **zero** L5 inspection triggers.
This is the G analog of `family-f-IMPROPER-PASS-no-evidence-span`. Use nearly
verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-008-FAMILY-G-SMOKE — Amendment (SYNTHETIC improper PASS; doctrine fixture)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Predecessor audit:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (PARTIAL — Phase 3 NOT-RUN).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

---

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family G smoke audit | `2640bf9` | **PARTIAL** | Phase 1, 2, 4, 4b, 5, 6 PASS. Phase 3 NOT-RUN. Prior verdict: PARTIAL capped by Gap 1 unmet obligation. |
| **This amendment** | (this commit) | **PASS** | Phase 3 closed by operator-supplied hosted MCP smoke evidence (21/21 PASS, EXIT 0). Gap 1 closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

---

## Phase 3 — Hosted MCP smoke (21 checks)

**Status:** PASS

​```
MCP-SERVER-001 smoke against: https://cdiscourse-mcp-server.civildiscourse.deno.net
Token: [REDACTED]
PASS [20-compat-boolean-family-g]
PASS [21-mcp-tools-call-boolean-family-g]
MCP-SERVER-001 smoke: 21 PASSES, 0 FAILS
EXIT: 0
​```

21/21 PASS, EXIT 0; checks 20 + 21 prove the deployed build serves Family G end-to-end.

---

## Phase 4 — Edge admin_validation (Family G)

**Status:** PASS

​```
POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
→ HTTP 200; time_total=25s
​```

Two seeded args classified successfully; positives all within the 18-key ai_classifier subset; no cross-family leakage.

---

## Phase 5 — Unsupported H/I/J rejection regression

**Status:** PASS

3/3 reject correctly under mcp_validation_failed. Zero positives. Zero leakage.

---

## Phase 6 — Targeted regression

**Status:** PASS

typecheck EXIT 0; lint EXIT 0; jest pass; deno 1022 pass.

---

## Final upgraded verdict

**PASS** — All five required phases (1, 2, 3, 4, 5) now have direct proof; Phase 6 regression unchanged; Phase 7 provenance carries forward.

---

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

(The ​``` fences in fixtures 9 + 10 above are shown with a zero-width marker only
to keep this design doc's own code fence intact; the implementer writes plain
``` triple-backtick fences in the fixture files. Fixture 10 has NO
`evidence_span`, NO `| evidence_span |`, NO `SELECT … evidence_span`, NO
`persisted evidence`, NO `direct-output inspection`. Fixture 9 DELIBERATELY has
the `SELECT … evidence_span` block + the `| … evidence_span … |` table so L5 is
satisfied.)

### Static-copy extraction for fixture 8

Per the fixture README's `git show <sha>:<path>` recipe, the source is on `main`
at `1c19d11`. On Windows/PowerShell:

```powershell
git show 1c19d11:docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md |
  Out-File -Encoding utf8 $env:TEMP\raw.md
# then prepend the marker line as line 1:
@('<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->') +
  (Get-Content $env:TEMP\raw.md) |
  Set-Content -Encoding utf8 __tests__/fixtures/audit-lint/family-g-original-PARTIAL.md
```

(Bash equivalent, if available:
`git show 1c19d11:docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md > /tmp/raw.md && cat <(echo '<!-- AUDIT-LINT-FIXTURE: … -->') /tmp/raw.md > __tests__/fixtures/audit-lint/family-g-original-PARTIAL.md`.)
The fixture body must be byte-identical to the on-main version and remain frozen
at `1c19d11`. Verify after extraction:
`node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-g-original-PARTIAL.md`
→ exit 0.

---

## Evidence section — empirical A.1 + A.2 + teeth probe outputs

Read-only node probes were run against the repo files (the rules `Set` was
mutated only in-memory in the probe via `.add()`, never on disk; the probe
scripts + the candidate fixture bodies were written under the OS temp dir,
captured, then deleted — they are NOT committed). The lib reads
`rules.DOCTRINE_RISK_FAMILIES` at call time, so `.add()` on the live Set
exercises `applyL5` exactly as the on-disk DATA edit will. The starting set is
the **post-F on-disk state** (`argument_scheme, slippery_slope,
critical_question, family_f, consequence_probability_unclear`); the probe adds
G's 3 on top.

### A.1 — detector output + consistent-PARTIAL mechanism

```
G smoke title: "MCP-SERVER-008-FAMILY-G-SMOKE — Post-merge smoke (2026-05-29)"
  detectFamily -> "family_g"
  auditType    -> "family-ship"
  verdict      -> "PARTIAL"
mapFamilyLetterToName("G") -> "family_g"
mapFamilyLetterToName("F") -> "family_f"
mapFamilyLetterToName("E") -> "argument_scheme"
G smoke "Family:" decl? none
G smoke evidence_span literal count: 10   (grep -c reports 7 LINES; /g reports 10 OCCURRENCES — both consistent)
G smoke hasInspection (any L5 pattern)? true
```

**A.1 conclusion:** The real G doc detects as `family_g` (NOT
`resolution_progress`); `mapFamilyLetterToName('G')` returns `family_g` via the
`default` branch (no `G` case); the doc has no body `Family:` declaration.
**Load-bearing alias = `family_g`.** Add `resolution_progress`
(canonical/declared-name) + `family_g` (detector output) +
`concedes_broader_point` (doctrinal-axis partner, parallel to E's
`slippery_slope` / F's `consequence_probability_unclear`).
`mapFamilyLetterToName` is NOT touched.

### Baseline (post-F on-disk set) — BEFORE adding G

```
DOCTRINE_RISK_FAMILIES = ["argument_scheme","slippery_slope","critical_question","family_f","consequence_probability_unclear"]
G smoke                                          {"exit":0,"rules":[],"family":"family_g","auditType":"family-ship","verdict":"PARTIAL"}
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}
fixture family-f-original-PARTIAL                {"exit":0,"rules":[],...}
fixture family-f-amendment-PASS                  {"exit":0,"rules":[],...}
fixture family-f-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}
```

### A.2 — after adding `resolution_progress` + `family_g` + `concedes_broader_point`

```
DOCTRINE_RISK_FAMILIES = ["argument_scheme","slippery_slope","critical_question","family_f","consequence_probability_unclear","resolution_progress","family_g","concedes_broader_point"]
G smoke                                          {"exit":0,"rules":[],"family":"family_g","auditType":"family-ship","verdict":"PARTIAL"}   <- consistent-PARTIAL preserved
fixture original-family-e-IMPROPER-PASS          {"exit":1,"rules":["L1","L2","L5"],...}   <- unchanged
fixture family-e-amendment-PARTIAL               {"exit":0,"rules":[],...}                 <- unchanged
fixture family-e-hosted-completion-PASS          {"exit":0,"rules":[],...}                 <- unchanged
fixture family-d-strengthened-amendment-PASS     {"exit":0,"rules":[],...}                 <- unchanged
fixture family-f-original-PARTIAL                {"exit":0,"rules":[],...}                 <- unchanged
fixture family-f-amendment-PASS                  {"exit":0,"rules":[],...}                 <- unchanged
fixture family-f-IMPROPER-PASS-no-evidence-span  {"exit":1,"rules":["L5"],...}             <- unchanged
```

**A.2 conclusion: DATA-ONLY.** Adding `family_g` does NOT make the real G
PARTIAL audit fail (it names `evidence_span` → `hasInspection` true → L5 returns
no finding). The 7 existing fixtures stay exactly **1, 0, 0, 0, 0, 0, 1**. No
logic change required. HALT triggers 8/9/10/11 do NOT fire.

### Teeth proof — synthetic G-improper (negative control + with `family_g`)

```
synthetic contains any L5 inspection trigger? false (must be false)
synthetic evidence_span literal count: 0 (must be 0)
  /\bevidence_span\b/i               -> false
  /SELECT[\s\S]{0,200}evidence_span/i -> false
  /\|\s*evidence_span\s*\|/i          -> false
  /persisted\s+evidence/i             -> false
  /direct[-\s]output\s+inspection/i   -> false

--- WITHOUT family_g (post-F set) — negative control ---
synthetic {"exit":0,"rules":[],"family":"family_g","auditType":"amendment","verdict":"PASS"}   <- would WRONGLY pass without G in set

--- WITH family_g + resolution_progress + concedes_broader_point added ---
synthetic {"exit":1,"rules":["L5"],"family":"family_g","auditType":"amendment","verdict":"PASS"}   <- exit 1, rules ["L5"] ONLY (teeth)
```

**Teeth conclusion:** Without `family_g`, the synthetic improper-PASS wrongly
passes (exit 0) — proving the rule is currently blind to Family G. With
`family_g`, it fails with **exit 1, finding `["L5"]` ONLY** — not L1/L2/L6. This
is the regression that satisfies HALT trigger 8 and is the G analog of
`family-f-IMPROPER-PASS-no-evidence-span` / `original-family-e-IMPROPER-PASS`.

### Representative G amendment-PASS — verified exit 0 (with + without G aliases)

```
g-amendment-PASS WITHOUT G aliases {"exit":0,"rules":[],"family":"family_g","auditType":"amendment","verdict":"PASS"}
g-amendment-PASS WITH G aliases    {"exit":0,"rules":[],"family":"family_g","auditType":"amendment","verdict":"PASS"}   <- evidence_span present -> L5 satisfied
```

The representative amendment passes both ways because it carries the persisted
`evidence_span` readback (its `SELECT … evidence_span` block + `| … evidence_span … |`
table satisfy `hasInspection`). This proves "the future hosted-completion
amendment can pass L5 when the evidence is supplied."

### Suite baseline captured

```
npx jest --testPathPattern="opsAuditLint" --no-coverage
Test Suites: 1 passed, 1 total
Tests:       147 passed, 147 total
EXIT: 0
```

The forecast (+8 to +14) is anchored to this 147-test / exit-0 baseline (the
post-F state). The F card landed +10 at this same structure.

---

## HALT-trigger evaluation (all 12, mirror the intent §7)

| # | Trigger | Fires? | Why |
| --- | --- | --- | --- |
| 1 | Runtime / logic code change (`mcp-server`/`supabase`/`src` non-test; `.mjs`/`-lib.cjs` LOGIC) | NO | DATA + tests + docs only; `mapFamilyLetterToName` untouched |
| 2 | Taxonomy / prompt / key change | NO | none proposed |
| 3 | Production flag change | NO | none proposed; Card 3 not started |
| 4 | `package.json` / lock change | NO | none proposed |
| 5 | Broad historical-corpus enforcement change | NO | census stays informational; CI scope unchanged |
| 6 | Weakening any existing audit-lint behavior | NO | additive only; E + F rules untouched |
| 7 | Removing / altering an existing Family E or F doctrine-risk rule | NO | `argument_scheme`, `slippery_slope`, `critical_question`, `family_f`, `consequence_probability_unclear` all preserved verbatim; G's 3 appended after |
| 8 | No regression proving Family G L5 enforcement (synthetic-G must FAIL L5) | NO | fixture 10 FAILS L5 (teeth proven, with verified negative control) |
| 9 | The 4 + 3 existing fixtures drift from `1,0,0,0,0,0,1` | NO | empirically unchanged |
| 10 | A.2 = requires logic change | NO | A.2 = data-only (empirical) |
| 11 | G-PARTIAL audit newly FAILS (consistent-PARTIAL broken) | NO | empirically exit 0 |
| 12 | Forecast > +45 | NO | forecast +8 to +14 |

**No HALT trigger fires. The card proceeds as data-and-tests.** Triggers 8 / 9 /
11 are the correctness core and are all empirically clear above.
