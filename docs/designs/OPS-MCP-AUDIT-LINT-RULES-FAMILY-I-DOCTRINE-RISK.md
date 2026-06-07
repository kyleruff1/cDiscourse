# OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — Design

**Status:** Design draft — GATE-A
**Epic:** Epic 12 — MCP / semantic-referee track (OPS audit-lint sub-track)
**Release:** OPS hardening (audit-lint RULES, data-and-tests)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/393 (umbrella #388)
**Card type:** audit-lint RULES — **DATA-only** (Set append), NOT logic-and-runtime
**Intent brief:** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-intent.md`
**Template (mirrored exactly):** `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK.md` (#403)
**Branch:** `feat/ops-mcp-audit-lint-rules-family-i`
**Date:** 2026-06-07
**Prerequisites:**
- Card 1 ship: `MCP-SERVER-010-FAMILY-I` (PR #392/#546, merge `4b9dabd` — current `origin/main` HEAD)
- Family H doctrine-risk chain shipped (`#403`/`#404`) — the `DOCTRINE_RISK_FAMILIES` set already carries E (2) + F (3) + G (3) + H (3) = 11 entries on disk
- Families A–H MCP operational; Family I admin_validation shipped (9th family)

This card is a faithful replica of the already-shipped Family H doctrine-risk
card (#403), applied to Family I, with the substitutions `family_h → family_i`
and `claim_clarity → thread_topology`. It adds Family I to L5 doctrine-risk
enforcement exactly as `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK` added
Family H. **One structural divergence from the H card** (resolved in §"A.1" and
§"Risks"): there is no real Card-1 I smoke audit on disk (Card 1's hosted smoke
is operator-post-merge and has not run), so this card has **no byte-copy
"original" fixture** — all 3 I fixtures are SYNTHETIC / hand-authored, unlike
H's fixture 11 which was a byte-copy of the on-main H smoke. See §"Fixture
matrix".

---

## ⚠️ Operator override context (READ FIRST)

The intent brief makes this card **CONDITIONAL**: if Card 1's doctrine-risk
verdict is LOW, the card may be SKIPPED (chain reduces to 2 cards). **Card 1
(`MCP-SERVER-010-FAMILY-I`, #392) explicitly found doctrine-risk = LOW** and
recommended SKIP (`MCP-SERVER-010-FAMILY-I.md` §A.1.2 / §GATE-A decision 2:
"Recommended default: SKIP Card 2"). Its reasoning: all 6 ai_classifier keys
are post-doctrine-filter descriptive thread-topology relations; the one
verdict-adjacent candidate (`repeats_prior_point`) was already pruned upstream;
and there is **no axis-partner key for I** (no analog to H's
`claim_specificity_low`).

**The operator has OVERRIDDEN that SKIP recommendation and chosen to SHIP this
card anyway** — a 3-card chain with belt-and-suspenders L5 mechanization. This
design is therefore written **to SHIP**, not to skip. The doctrine-risk = LOW
finding is preserved as context (it drives the third-set-entry decision and the
"NORMAL intensity" framing of the synthetic fixtures), but the card ships
regardless. The override is the single most consequential GATE-A operator
decision; it is restated in §"GATE-A verdict" with the residual decision (the
third set entry) the operator must ratify.

---

## A.2 OUTCOME (one line, decisive)

**DATA-only** — no logic change. The 13 existing fixtures (4 hardening + 3 F +
3 G + 3 H) are byte-equal in lint outcome before/after the I additions. There
is **no Card-1 I smoke audit on `main`** (only `docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-template.md`
exists), so unlike H this card adds no byte-copy fixture and has no on-main
smoke doc to retroactively bite. Zero HALT triggers fire (full table in
§"HALT-trigger evaluation").

---

## Goal (one paragraph)

Family I (`thread_topology`) ships on the MCP server in admin_validation mode
with 6 ai_classifier keys (`introduces_new_issue`, `references_prior_agreement`,
`introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`,
`compares_options`). Card 1 graded its doctrine-risk **LOW** — the keys describe
how a move relates to the conversation graph, not the move's merit, and the one
verdict-adjacent candidate (`repeats_prior_point`) was pruned upstream. The
audit-lint L5 rule mechanically requires persisted direct-output
(`evidence_span`) inspection for the doctrine-risk families enrolled so far —
E (`argument_scheme`/`slippery_slope`), F (`critical_question`/`family_f`/`consequence_probability_unclear`),
G (`resolution_progress`/`family_g`/`concedes_broader_point`), and H
(`claim_clarity`/`family_h`/`claim_specificity_low`) — but it is **blind to
Family I**. A *future* canonical-titled I smoke audit (Card 3's
`MCP-021C-EDGE-FAMILY-I-ENABLE` production-flip smoke, or any I amendment)
authored with a `MCP-SERVER-NNN-FAMILY-I-SMOKE` title could declare verdict
PASS without any persisted `evidence_span` inspection and the linter would let
it through — the same `29f30b0` improper-PASS defect class that motivated
`OPS-MCP-SMOKE-DOCTRINE-HARDENING`. Per the operator's belt-and-suspenders
override (despite the LOW grade), this card converts the Family I doctrine proof
from operator-discipline into **mechanical L5 enforcement** by appending the
Family I aliases to the `DOCTRINE_RISK_FAMILIES` DATA set in
`scripts/ops/audit-lint-rules.cjs`, plus the synthetic test fixtures that prove
the new teeth bite (synthetic I-improper FAILS L5) and that legitimate I audits
are preserved. **Doctrine note:** the audit-lint linter is a structural/process
gate, not a user-facing surface — no truth labels, no scoring, no AI, no
network, no secrets. It enforces evidence-doctrine discipline (factual standing
requires persisted evidence inspection) at audit-authoring time. This design
respects cdiscourse-doctrine §1/§3 (the linter never adjudicates argument truth;
it checks that the audit *inspected* the persisted span) and §6/§7 (pure regex +
text, no keys, no LLM, no network).

---

## Data model

**No new data model.** The only production-source change is adding string
entries to an existing in-memory `Set` (`DOCTRINE_RISK_FAMILIES`) in a pure-DATA
CommonJS module. No TypeScript types, no SQL, no migration, no schema.

### The exact DATA edit (the resolved Set additions)

`scripts/ops/audit-lint-rules.cjs`, the `DOCTRINE_RISK_FAMILIES` set (lines
55–92 in the current tree at HEAD `4b9dabd`) currently carries E's 2 + F's 3 +
G's 3 + H's 3 = 11 entries. Append I's entries **after H's 3** (do NOT reorder
or remove any existing member):

```js
const DOCTRINE_RISK_FAMILIES = new Set([
  'argument_scheme',
  'slippery_slope',
  // …F's comment block + 3 entries byte-equal preserved…
  'critical_question',
  'family_f',
  'consequence_probability_unclear',
  // …G's comment block + 3 entries byte-equal preserved…
  'resolution_progress',
  'family_g',
  'concedes_broader_point',
  // …H's comment block + 3 entries byte-equal preserved…
  'claim_clarity',
  'family_h',
  'claim_specificity_low',
  // Family I (thread_topology). `family_i` is the string detectFamily()
  // actually emits for a `MCP-SERVER-NNN-FAMILY-I` title (mapFamilyLetterToName
  // has no I case → default branch → `family_i`); it is the load-bearing alias.
  // `thread_topology` is the canonical key name (also covers any doc that
  // declares `Family: thread_topology`). Card 1 (MCP-SERVER-010-FAMILY-I, #392)
  // graded I's doctrine-risk LOW — all 6 ai_classifier keys are descriptive
  // thread-graph relations and the one verdict-adjacent candidate
  // (`repeats_prior_point`) was pruned upstream; there is NO axis-partner key
  // (no analog to H's `claim_specificity_low`). The operator OVERRODE the LOW
  // verdict's SKIP recommendation and chose belt-and-suspenders L5
  // mechanization. `compares_options` is added as the precautionary
  // third entry — the single most verdict-adjacent I key (it carries the
  // "never picks a winner" doctrine guard, the closest I analog to G's
  // `concedes_broader_point`), reachable only via a `Family:` declaration.
  'thread_topology',
  'family_i',
  'compares_options',
]);
```

**Exact strings to add (in this order):** `'thread_topology'`, `'family_i'`,
`'compares_options'`.

**Why `family_i` is load-bearing and `thread_topology` alone is a no-op:**
`detectFamily` maps the title letter I via `mapFamilyLetterToName('I')`, which
has no `I` case and falls through to `default` → `` `family_${letter}` `` →
`family_i`. A canonical-titled I smoke audit (`MCP-SERVER-NNN-FAMILY-I-SMOKE`)
carries no body-level `Family:` declaration, so the linter classifies it as
`family: 'family_i'`. Adding only `thread_topology` would never match it;
`family_i` is the alias the detector actually emits. (This mirrors the F/G/H
load-bearing-alias decision exactly.) **Verified at design time** (read-only
node probe, set not mutated on disk): `mapFamilyLetterToName('I') === 'family_i'`
and `detectFamily('# MCP-SERVER-010-FAMILY-I-SMOKE — x', '…') === 'family_i'`.

### THE ONE OPEN DECISION — the third set entry (RESOLVED with default + alternative)

H/F/G each added a third "axis-partner" entry: the single canonical key most
verdict-adjacent (H = `claim_specificity_low`, G = `concedes_broader_point`,
F = `consequence_probability_unclear`). **But Card 1 §A.1.2 states explicitly:
"There is no axis-partner key for I"** — all 6 keys are LOW, none sit at a
verdict boundary, and the verdict-adjacent candidate was pruned upstream. So the
third entry is genuinely undetermined by the H precedent. Two readings:

- **Strict reading (2-entry):** add only `thread_topology` + `family_i`. Since
  no I key is MEDIUM-or-HIGH, there is no axis-partner to add. This is the
  literal Card-1 finding ("no axis-partner key for I") and the Family E
  precedent (E's set has just `argument_scheme` + `slippery_slope`, where
  `slippery_slope` is a doctrinal-axis alias, not a separately-risk-graded key).

- **Precautionary reading (3-entry, RECOMMENDED DEFAULT):** add
  `thread_topology` + `family_i` + **`compares_options`**. The operator's
  belt-and-suspenders override implies *maximizing* the mechanized teeth, not
  minimizing them. Among the 6 I keys, `compares_options` is the single most
  verdict-adjacent: it is the only key carrying an explicit anti-verdict doctrine
  line in Card 1's prompt ("**Comparing options is not picking a winner** … It
  NEVER asserts which option is 'correct', 'better', or 'wins' as a verdict",
  `MCP-SERVER-010-FAMILY-I.md` §A.3.1, line 147). It is the closest I analog to
  G's `concedes_broader_point` (resolution↔verdict) and H's `claim_specificity_low`
  (clarity↔verdict): a comparison move that concludes "option X wins" is the one
  I topology relation a careless reader could mis-frame as an adjudication. The
  third entry is reachable only via an explicit body-level `Family: compares_options`
  declaration (the detector never emits it from a title), so it is **inert for
  the common canonical-titled case** — exactly the parallel role `slippery_slope`
  /`consequence_probability_unclear`/`concedes_broader_point`/`claim_specificity_low`
  play for E/F/G/H. Adding it costs nothing (it cannot false-fire on A–H docs,
  whose families never emit `compares_options`) and it gives the belt-and-
  suspenders posture a concrete axis-partner.

**Designer recommended default: the 3-entry precautionary form with
`compares_options` as the third entry.** Rationale: (1) it preserves byte-for-
byte structural parity with the H/F/G three-entry shape the chain has shipped
four times, keeping the test plan, fixture matrix, and smoke template uniform;
(2) it honors the operator's belt-and-suspenders intent (the operator overrode a
SKIP to maximize teeth — a 2-entry minimal form would under-serve that intent);
(3) `compares_options` is the demonstrably-most-verdict-adjacent key per Card 1's
own prompt doctrine, so it is the defensible axis-partner if one is to be named.
The 2-entry strict form is the documented alternative the operator may elect; it
is also doctrinally safe (it loses nothing material because the canonical-titled
case keys on `family_i`, which both forms include). **This is the residual
GATE-A operator decision** (§"GATE-A verdict").

> Note: `compares_options` is the SAME key whose tool-description Card 1
> reworded with the "comparing options is not picking a winner" guard. Choosing
> it as the precautionary third entry is the consistent extension of that Card-1
> doctrine reasoning into the audit-lint set.

`MARKER_STRING` (`'Audit-Lint: v1'`) is unchanged. No other export changes.
**`mapFamilyLetterToName` is NOT touched** (that is logic — touching it fires
HALT trigger 1).

---

## File changes

**Modified (production DATA, ~16 lines: 3 strings + a ~13-line comment block):**
- `scripts/ops/audit-lint-rules.cjs` — append 3 strings (`'thread_topology'`,
  `'family_i'`, `'compares_options'`) with a comment block to the
  `DOCTRINE_RISK_FAMILIES` set, AFTER H's 3 entries. **This is the only
  production-source change.** No logic, no `.mjs`, no `audit-lint-lib.cjs`.
  (If the operator elects the 2-entry strict form, drop `'compares_options'`
  and the corresponding membership test — net effect: +9 tests instead of +11.)

**New fixtures (3 files — ALL synthetic / hand-authored):**
- `__tests__/fixtures/audit-lint/family-i-amendment-PASS.md` — **HAND-AUTHORED
  representative** I amendment / production-enable smoke shape: verdict PASS +
  persisted `evidence_span` inspection + canonical
  `MCP-SERVER-010-FAMILY-I-AMENDMENT` title → `detectFamily()` returns
  `family_i` → DOCTRINE_RISK = true → `hasInspection` true → L5 satisfied →
  exit 0 (~70 lines). Mirrors `family-h-amendment-PASS` in role. Full body in
  the "Fixture matrix" section below.
- `__tests__/fixtures/audit-lint/family-i-IMPROPER-PASS-no-evidence-span.md` —
  SYNTHETIC hand-authored negative fixture; I-amendment shape with every
  `evidence_span` trigger stripped, verdict PASS, L6 intact, canonical
  `-FAMILY-I` title format (~70 lines). Trips `["L5"]` ONLY. Full body below.
  This is the **teeth proof**.
- `__tests__/fixtures/audit-lint/family-i-consistent-PARTIAL.md` — **HAND-
  AUTHORED representative** consistent-PARTIAL I smoke shape: verdict PARTIAL +
  names `evidence_span` as the deferred Phase 4b obligation → `hasInspection`
  true → L5 does not fire → exit 0 (~55 lines). Mirrors `family-g-original-PARTIAL`
  / `family-f-original-PARTIAL` in role — the load-bearing regression guard that
  a legitimately-deferred I audit still passes because it names the persisted
  inspection obligation. **This is the I substitute for H's byte-copy "original"
  fixture** (see §"Risks" — fixture-provenance divergence). Full body below.

> **Why no byte-copy "original" fixture for I:** the H card's fixture 11
> (`family-h-original-PASS`) was a byte-copy of the on-main Card-1 H smoke audit
> (`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` at `12ec7eb`).
> **No equivalent exists for I** — `docs/audits/` contains only
> `MCP-SERVER-010-FAMILY-I-SMOKE-template.md` (a template), not a real Card-1 I
> smoke audit (Card 1's hosted Phase 3 + Edge Phase 4/4b are operator-post-merge
> and have not run; see `MCP-SERVER-010-FAMILY-I.md` §GATE-A "Post-merge
> (smoke; operator-run)"). So this card CANNOT byte-copy a real I smoke. The
> `family-i-consistent-PARTIAL` hand-authored representative substitutes for it,
> giving the same regression-guard role (a real consistent-PARTIAL I smoke that
> names `evidence_span` passes L5) without depending on a doc that does not yet
> exist. This is the single deliberate divergence from the H fixture matrix and
> is surfaced as a GATE-A interpretive note.

**Modified tests (~55–65 lines net add) in `__tests__/opsAuditLint.test.ts`:**
- New `describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — …')`
  block(s) for the new unit + fixture tests (mirror the H blocks at lines
  1362–1514).
- In the existing "fixture-directory invariants" block (lines 1520–1562):
  extend the `FIXTURE_FILES` array from 13 → 16 entries (append the 3 new I
  filenames); change `fixture count is exactly 13` → `fixture count is exactly
  16`, `toHaveLength(13)` → `toHaveLength(16)`, and rename the `it()` label.
- The 4 hardening fixture `it()`s, the 3 F (lines 1179–1217), 3 G (1317–1355),
  and 3 H (1464–1514) fixture `it()`s stay **byte-identical**.

**Modified docs:**
- `__tests__/fixtures/audit-lint/README.md` — change "exactly 13" → "exactly
  16" (lines 26–32); add 3 new rows to the expected-outcomes table (after the H
  rows at lines 146–148); add a note that all three I fixtures are
  HAND-AUTHORED (no byte-copy `git show` recipe — there is no on-main I smoke);
  add a one-sentence note that I has no real Card-1 smoke yet so the
  `family-i-consistent-PARTIAL` fixture is the representative substitute for the
  missing "original". (~25 lines.) **Scope rationale:** the README lives under
  `__tests__/fixtures/audit-lint/`, so it falls inside the brief's
  `__tests__/fixtures/audit-lint/*.md` allowance; updating it keeps the
  self-validation contract coherent (its prose + table become stale on a
  3-fixture add) — identical to how the F/G/H cards handled the README.
- `docs/ops/AUDIT-LINT.md` — IF it carries a fixture-count line / "Adding a
  doctrine-risk family" how-to (the H/G/F cards updated it), enhance with the 3
  new I fixture bullets, change the fixture count to 16, and add the one-line
  "Family I followed the same DATA path (operator-override belt-and-suspenders
  despite LOW doctrine-risk)" note. (~10–15 lines.) **The implementer confirms
  the current AUDIT-LINT.md fixture-count phrasing and updates the count fact;
  if AUDIT-LINT.md has no fixture-count line, this edit is skipped — load-bearing
  fact is the count is 16.**
- `docs/core/current-status.md` — handoff (Phase framing + new test count
  `169 → 180` for the opsAuditLint suite at the 3-entry default). (~1 stage
  block.)

**This design doc + the smoke template:**
- `docs/designs/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK.md` — this file.
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-template.md`
  — pre-merge smoke template (per F/G/H precedent; 5-phase; carries
  `Audit-Lint: v1` and self-lints clean). Skeleton in §"Smoke template" below.
- `docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-2026-06-07.md`
  — post-merge smoke audit (implementer/operator authors per §8 of the intent;
  must carry `Audit-Lint: v1` and self-lint clean). NOT authored as part of the
  design (operator/implementer step after merge).

**Deleted:** none.

**MUST NOT touch (re-affirmed):** `scripts/ops/audit-lint.mjs` LOGIC,
`scripts/ops/audit-lint-lib.cjs` LOGIC (incl. `mapFamilyLetterToName` — that is
logic), `mcp-server/**`, `supabase/functions/**`, `src/**` non-test,
`package.json`/`package-lock.json`, `.github/workflows/audit-lint.yml`, the 4
hardening fixtures + the 3 F + 3 G + 3 H fixtures (byte-equal), Family A–H
prompts / keys / taxonomy / schema, production registry flags, the on-disk
`thread_topology` Edge registry posture. **Do not start Card 3
(`MCP-021C-EDGE-FAMILY-I-ENABLE`, #394).**

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

The contract that matters: `applyL5` reads `rules.DOCTRINE_RISK_FAMILIES` at
call time. Adding members to the Set is the entire mechanism. `applyL5` is
**verdict-blind** (no `verdict === 'PASS'` check) and `hasInspection` tests the
full doc text for any of the 5 `L5_PERSISTED_INSPECTION_PATTERNS` (the most
permissive being the bare word `\bevidence_span\b`).

The 5 L5 inspection patterns (the strings the synthetic I-improper fixture must
NOT contain):
- `/\bevidence_span\b/i`
- `/SELECT[\s\S]{0,200}evidence_span/i`
- `/\|\s*evidence_span\s*\|/i`
- `/persisted\s+evidence/i`
- `/direct[-\s]output\s+inspection/i`

---

## Edge cases (the implementer must handle)

- **Alias the detector ignores (A.1 trap).** Adding `thread_topology` alone is a
  silent no-op for a canonical-titled I doc — it detects as `family_i`. The fix
  MUST include `family_i`. A unit test pins
  `detectFamily('# MCP-SERVER-010-FAMILY-I-SMOKE — x', body) === 'family_i'` so
  a future refactor that adds an `I` case to `mapFamilyLetterToName` (changing
  the emitted string) will fail loudly rather than silently un-arming L5.
- **No on-main I smoke audit exists (provenance divergence).** Unlike H, there
  is no real Card-1 I smoke to byte-copy. The `family-i-consistent-PARTIAL`
  hand-authored representative substitutes for it. The implementer must NOT
  attempt a `git show … MCP-SERVER-010-FAMILY-I-SMOKE-*.md` extraction — that
  doc does not exist on `main` (only the `-template.md`). The README must NOT
  carry a `git show` re-extraction recipe for any I fixture.
- **Detector returns ONE family; `compares_options` in the body does not change
  classification.** `detectFamily` for a `MCP-SERVER-010-FAMILY-I` title with no
  `Family:` declaration returns `family_i` regardless of how many times
  `compares_options` appears in the body. The body of all three I fixtures may
  freely mention `compares_options` as descriptive text — it is
  `parsed.family === 'family_i'` that arms L5, not the third-entry key appearing
  in prose. (`compares_options` is added to the set only so a *future* doc that
  explicitly declares `Family: compares_options` is also covered — the parallel
  of `slippery_slope`/`consequence_probability_unclear`/`concedes_broader_point`/
  `claim_specificity_low` for E/F/G/H.)
- **Synthetic fixture must trip L5 ONLY (not L1/L2/L6).** The synthetic is an
  `amendment`-type doc (title contains AMENDMENT) → `amendment` has an empty
  required-phase set, so L1 cannot fire; all its phases are PASS. It contains no
  L2 indirect-proof phrases. Its L6 provenance is intact (prior verdict named,
  gap/missing-proof named, newly-supplied-proof named). The only defect is the
  absent `evidence_span` inspection → `[L5]` only.
- **`family-i-amendment-PASS` is the inverse risk — it MUST contain an
  `evidence_span` trigger.** It is hand-authored with the canonical title format
  AND must include explicit `evidence_span` inspection-pattern language (a
  `SELECT … evidence_span …` block + an `| … evidence_span … |` table). If the
  implementer strips `evidence_span` from it by accident, it will (correctly,
  but unexpectedly) fail L5 because the title format DOES match `family_i`.
- **`family-i-consistent-PARTIAL` must also name `evidence_span`.** Its verdict
  is PARTIAL and it names `evidence_span` as the deferred Phase 4b obligation →
  `hasInspection` true → L5 does not fire → exit 0. If the implementer omits the
  `evidence_span` mention, the PARTIAL fixture would wrongly fail L5 (`family_i`
  is doctrine-risk and L5 is verdict-blind). The provided body names it.
- **Fixture marker on line 1 + title on line 2.** `parseAuditDoc` explicitly
  skips leading HTML-comment + blank lines to find the title, so a fixture with
  the `<!-- AUDIT-LINT-FIXTURE … -->` marker on line 1 and the
  `# MCP-SERVER-010-FAMILY-I-… ` title on line 2 still detects `family_i` and the
  correct audit type. Verified against the existing
  `family-h-IMPROPER-PASS-no-evidence-span.md` / `family-g-…` fixtures, which use
  exactly this shape.
- **`Audit-Lint: v1` marker inside the fixture body.** All three I fixtures carry
  `Audit-Lint: v1`. As fixtures they are direct-invoked by the test via
  `lintAuditDoc(fs.readFileSync(...))`, so CI marker-gating is irrelevant to the
  fixture assertions; the marker is present for shape fidelity.
- **Doctrine ban-list scan does NOT reach the fixtures.** The verdict-token
  scanner scans the stitched observability report, NOT
  `__tests__/fixtures/audit-lint/` or `docs/audits/`. The synthetic I fixtures
  carry the `<!-- AUDIT-LINT-FIXTURE … -->` marker per the README contract
  (required by the marker-invariant test).
- **Empty / malformed doc.** Unchanged behavior — `lintAuditDoc` returns exit 2
  with a `parse` finding when title + audit-type + verdict are all
  unextractable. Not exercised by this card; no change.
- **Permission-denied / offline / concurrent edits.** Not applicable — pure
  text, no fs (in the lib), no network, no DB, no concurrency surface.

---

## Test plan

All tests live in `__tests__/opsAuditLint.test.ts` (the existing audit-lint
suite, **baseline 169 tests / 1 suite passing** as captured at HEAD `4b9dabd`
via `npx jest --testPathPattern="opsAuditLint" --no-coverage`). Tests are pure:
`require('../scripts/ops/audit-lint-lib.cjs')` + `fs.readFileSync` of fixtures;
no React, no Supabase, no network. Mirror the H blocks at lines 1362–1514.

**New unit tests (doctrine-risk membership + L5 firing for Family I):**
- `DOCTRINE_RISK_FAMILIES.has('thread_topology')` is `true`. (mirrors the H
  `…contains claim_clarity` test at line 1363)
- `DOCTRINE_RISK_FAMILIES.has('family_i')` is `true`. (mirrors the H
  `…contains family_h` test at line 1367)
- `DOCTRINE_RISK_FAMILIES.has('compares_options')` is `true`. **(3-entry form
  only — drop this test if the operator elects the 2-entry strict form.)**
  (mirrors the H `…contains claim_specificity_low` test at line 1371)
- `preserves the existing Family E + F + G + H doctrine-risk members` —
  additive-only guard asserting `argument_scheme`, `slippery_slope`,
  `critical_question`, `family_f`, `consequence_probability_unclear`,
  `resolution_progress`, `family_g`, `concedes_broader_point`, `claim_clarity`,
  `family_h`, `claim_specificity_low` are all still present, AND
  `DOCTRINE_RISK_FAMILIES.size === 14` (was 11 after H; +3 for I = 14).
  **(2-entry form → size 13.)** (extends the H "preserves E+F+G" test at line
  1377 to also cover the 3 H members.)
- `detectFamily('# MCP-SERVER-010-FAMILY-I-SMOKE — x', '…body…')` returns
  `'family_i'` (A.1-trap pin; documents that the title letter I maps to
  `family_i`, not `thread_topology`). (mirrors the H A.1 pin at line 1398)
- L5 **fires** on a `family_i`-titled doc with verdict PASS and no
  `evidence_span` mention: build via `buildFamilyShipDoc({ titleOverride:
  '# MCP-SERVER-010-FAMILY-I-SMOKE — synthetic', phases: [['Phase 1 —
  Pre-flight','PASS']], verdict: 'PASS' })`; assert
  `findings.some(f => f.rule === 'L5')` is `true`. (mirrors the H firing test at
  line 1414)
- L5 does **NOT** fire on a `family_i`-titled doc that mentions `evidence_span`
  (a `SELECT … evidence_span …` line in a phase justification): assert
  `findings.some(f => f.rule === 'L5')` is `false`. (mirrors the H non-firing
  test at line 1424)
- `family_i` PASS audit that names `evidence_span` does NOT fail L5
  (consistent-PASS regression; mirrors the H consistent-PASS regression at line
  1440).

**New fixture self-validation tests (NEW `describe` block named for this card;
the existing 4 + 3 F + 3 G + 3 H `it()`s stay byte-identical in their own
blocks):**
- `family-i-consistent-PARTIAL.md` → `exitCode === 0` and `findings` length 0;
  assert `parsed.family === 'family_i'` and `parsed.verdict === 'PARTIAL'` (a
  legitimately-deferred I audit that names `evidence_span` passes L5 — the
  load-bearing regression guard; the I substitute for H's "original" fixture).
- `family-i-amendment-PASS.md` → `exitCode === 0` and `findings` length 0;
  assert `parsed.family === 'family_i'` (representative I amendment /
  production-enable shape with canonical title format AND persisted inspection
  passes L5).
- `family-i-IMPROPER-PASS-no-evidence-span.md` → `exitCode === 1`;
  `findings.map(f => f.rule)` **contains `'L5'`**, and (teeth-precision) does
  **NOT** contain `'L1'`, `'L2'`, or `'L6'` (proves L5-only). This is the TEETH
  proof — the I analog of `family-h-IMPROPER-PASS-no-evidence-span`.

**Doctrine ban-list assertions:** N/A for user-facing strings — this card
touches no user-facing copy and no `gameCopy` codes. The audit-lint linter is
explicitly "not a verdict-token doctrine scanner". No new ban-list test is
required; the existing `opsMcpObservabilityDoctrineBanList` suite is untouched
and out of scope.

**Existing-behavior regressions (edits to the invariants block, not new
`it()`s):**
- `FIXTURE_FILES` array grows 13 → 16 (adds the 3 new filenames).
- `fixture count is exactly 13` → `fixture count is exactly 16`;
  `toHaveLength(13)` → `toHaveLength(16)`; the `mdFiles.sort()` deep-equality now
  compares against all 16.
- The "each fixture file starts with the HTML comment marker" `it()` is
  unchanged in code but now iterates 16 files (the 3 new fixtures carry the
  marker, so it stays green).
- The 13 existing fixture assertions remain byte-identical and must still pass.

---

## Test forecast (precise)

**+11** at the 3-entry default (**+9** if the operator elects the 2-entry strict
form — drop the `compares_options` membership test and the set-size assertion
shifts to 13). HALT ceiling **+30** per the intent brief §4. Anchored to the
**169-test** opsAuditLint baseline → **180 post-card** (3-entry).

Decomposition (11 new tests at the 3-entry default):
- 3 membership tests (`thread_topology`, `family_i`, `compares_options`).
- 1 `preserves existing E + F + G + H members` additive-only guard (size 14).
- 1 `detectFamily` → `family_i` A.1-trap pin.
- 2 L5 firing tests for `family_i` (fires without inspection; does not fire with
  `evidence_span`).
- 1 consistent-PASS regression (`family_i` PASS audit naming `evidence_span`
  does not fail L5).
- 3 fixture self-validation `it()`s (i-consistent-PARTIAL → 0; i-amendment-PASS
  → 0; i-improper → 1 citing L5-only).
- The `FIXTURE_FILES`/count-assertion edits modify existing `it()`s (no count
  delta); the marker `it()` iterates more files (no count delta).

Forecast = **+11** (within the brief's `+10..+15` range; HALT 8 ceiling is +30).
If the implementer's count exceeds +30, HALT trigger fires.

---

## Dependencies (cards / docs / files)

- **Assumes complete:**
  - `MCP-SERVER-010-FAMILY-I` (Card 1 ship — PR #392/#546 / `4b9dabd`) — made the
    I admin path live, provided the doctrine-risk = LOW verdict and the
    `compares_options` "never picks a winner" guard that motivates the
    precautionary third entry.
  - `OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK` (#403, the immediate
    template) — E/F/G/H's 11 entries in `DOCTRINE_RISK_FAMILIES` are the
    prerequisite Set state.
  - Transitively: the F + G doctrine-risk cards, `OPS-MCP-SMOKE-DOCTRINE-HARDENING`
    (the L1–L6 linter), `OPS-MCP-SMOKE-LINT-CI-WIRING` (the CI workflow) — all
    shipped; this card is a pure DATA extension of their `DOCTRINE_RISK_FAMILIES`
    set.
- **Reads existing (READ ONLY):** `scripts/ops/audit-lint-rules.cjs`
  `DOCTRINE_RISK_FAMILIES` (lines 55–92); `audit-lint-lib.cjs` `applyL5`,
  `detectFamily`, `mapFamilyLetterToName`, `parseAuditDoc` marker-skip;
  `__tests__/opsAuditLint.test.ts` H blocks at lines 1362–1514 (the immediate
  mirror) + fixture-dir invariants at 1520–1562 + `buildFamilyShipDoc`;
  `__tests__/fixtures/audit-lint/README.md`; `MCP-SERVER-010-FAMILY-I.md`
  (§A.1.2 doctrine-risk verdict, §A.3.1 `compares_options` guard, §GATE-A).
- **Static-copy source:** NONE — no on-main I smoke exists; all 3 I fixtures are
  hand-authored. (Divergence from H, which byte-copied `12ec7eb`.)
- **Will block / enable:** Card 3 (`MCP-021C-EDGE-FAMILY-I-ENABLE`, #394 —
  production-enable smoke + Edge family flip) is gated on this Card 2 smoke PASS.
  This card is the L5 mechanization prerequisite; it does NOT itself flip I to
  production (HALT trigger if proposed). The pattern extends to Family J if/when
  it ships.

---

## Risks (things that might trip up the implementer)

- **Silent-no-op alias (highest-value gotcha).** Forgetting `family_i` and
  adding only `thread_topology` produces a green suite (the membership test for
  `thread_topology` passes) while leaving L5 blind to any future canonical-titled
  I audit. Mitigation: the `detectFamily → family_i` pin test + the
  `family-i-IMPROPER-PASS-no-evidence-span` teeth test (which only
  fails-correctly when `family_i` is present) both guard this. The implementer
  MUST confirm the synthetic fixture fails WITH `family_i` in the set — WITHOUT
  `family_i` it lints exit 0 (the negative control).
- **Fixture-provenance divergence from H (the load-bearing structural
  difference).** The H card had a byte-copy "original" fixture (fixture 11) from
  the on-main H smoke. **Family I has NO on-main smoke** — `docs/audits/` carries
  only `MCP-SERVER-010-FAMILY-I-SMOKE-template.md`. So this card's three I
  fixtures are ALL hand-authored: `family-i-consistent-PARTIAL` (the substitute
  for the missing "original", in the consistent-PARTIAL role of
  `family-g-original-PARTIAL`/`family-f-original-PARTIAL`), `family-i-amendment-PASS`
  (representative, persisted inspection present), and
  `family-i-IMPROPER-PASS-no-evidence-span` (synthetic teeth). The implementer
  MUST NOT attempt a `git show` extraction for any I fixture and MUST NOT add a
  `git show` recipe for I to the README. This divergence is the single most
  important deviation from the H mirror and is GATE-A-flagged.
- **Doctrine-risk is LOW (operator-override card).** Card 1 graded I LOW and
  recommended SKIP. This card ships on operator override. The implementer must
  NOT re-litigate the SKIP — the operator has decided. The synthetic-fixture
  "intensity" is NORMAL (descriptive-clean), not the existential-FAIL intensity
  H's was, but the L5 teeth mechanism is identical (a `family_i` PASS audit with
  no `evidence_span` fails L5 regardless of the underlying doctrine-risk grade —
  L5 keys on family-set membership + inspection-pattern presence, not on a
  risk-magnitude judgment).
- **Synthetic fixture accidentally re-introduces an `evidence_span` trigger.**
  The synthetic (`family-i-IMPROPER-PASS-no-evidence-span`) must keep ALL 5
  inspection patterns absent — the bare word `evidence_span`, the
  `| evidence_span |` table headers, the `SELECT … evidence_span` query blocks,
  and any `persisted evidence` / `direct-output inspection` phrasing. The
  provided body (below) is verified clean — use it nearly verbatim.
- **`family-i-amendment-PASS` AND `family-i-consistent-PARTIAL` MUST each
  contain an `evidence_span` trigger.** Both detect as `family_i` (canonical
  title), so L5 is verdict-blind and will fire unless `evidence_span` is named.
  The amendment fixture includes a `SELECT … evidence_span` block + an
  `| … evidence_span … |` table; the consistent-PARTIAL fixture names
  `evidence_span` as the deferred Phase 4b obligation. Stripping the mention from
  either is a silent test failure.
- **Synthetic fixture accidentally trips L1/L2/L6.** If the synthetic drops the
  L6 provenance, or names a NOT-RUN required phase under a non-amendment audit
  type, extra rules fire and the teeth test's "L5-only" precision assertion
  fails. The provided body is `amendment`-typed (empty required-phase set),
  all-PASS phases, full L6 provenance.
- **Byte-equality of the 13 existing fixtures.** The `FIXTURE_FILES` array edit
  and count-assertion change are in the same `describe` block as the existing
  files; the implementer must edit ONLY the array + the count number + the count
  `it()` label, and must NOT touch the 4 hardening, 3 F, 3 G, or 3 H fixture
  files or their `it()`s. A `git diff --stat` on the 13 existing fixtures must
  show 0 changed lines.
- **README staleness vs scope.** The README update is in-scope (fixture-dir
  `.md`) but the implementer must NOT edit the body of the existing fixtures'
  description — only add the 3 new rows, bump "13 → 16", note the three
  hand-authored I fixtures, and add the one-sentence "I has no on-main smoke"
  explanation. The "DO NOT EDIT [fixture bodies]" clause still stands.
- **No CI workflow change.** `.github/workflows/audit-lint.yml` is correct and
  out of scope. Adding fixtures under `__tests__/fixtures/` does NOT match the
  workflow's `docs/audits/**SMOKE*.md` trigger path. The post-merge smoke audit
  doc DOES live under `docs/audits/` and will be linted by CI — it must carry
  `Audit-Lint: v1` and self-lint clean (exit 0).
- **Migration / operator deploy.** None. Pure code + docs; no DB, no Edge
  Function, no deploy.

---

## Out of scope (explicit — reduces scope creep)

- Any change to `audit-lint.mjs` or `audit-lint-lib.cjs` LOGIC (incl. adding an
  `I` case to `mapFamilyLetterToName`). A DATA-only change is sufficient and
  proven; touching logic fires HALT trigger 1.
- Family J doctrine-risk enrollment (J is unsupported; I is the only family this
  card enrolls).
- Re-litigating the Card-1 doctrine-risk = LOW verdict or the SKIP decision —
  the operator has overridden it; this card ships.
- Authoring a real Card-1 I smoke audit, or byte-copying one (none exists). The
  three I fixtures are hand-authored representatives.
- Adding a `verdict`-awareness check to L5 (it is intentionally verdict-blind;
  consistent-PASS / consistent-PARTIAL are preserved by inspection-pattern
  mention). Changing L5 firing semantics is a logic change → HALT trigger.
- Any taxonomy / prompt / key / production-flag / `package.json` change. **The I
  production flip is Card 3 (#394) — do NOT start it.** The Edge-subset entry
  (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']`) is a separate
  Edge-bearing follow-up per Card 1 §GATE-A — NOT this card.
- Editing the 4 hardening, 3 F, 3 G, or 3 H fixtures' bodies, or weakening any
  existing Family E/F/G/H rule.
- The post-merge smoke audit *execution* (Phase 1–5 of the intent §8) — that is
  the operator/implementer smoke step after merge, not part of the design. The
  smoke template `…-SMOKE-template.md` IS authored as part of this card.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** The
  audit-lint linter never adjudicates who is right in a debate and never labels a
  claim true/false. L5 checks that an *audit doc* inspected the persisted
  `evidence_span` column — a process/evidence-discipline gate, not a truth
  verdict on any argument. Nothing here touches posting, scoring, or strength
  bands. RESPECTED.
- **cdiscourse-doctrine §3 (popularity is not evidence) / evidence-doctrine
  (factual standing requires persisted evidence):** L5 is the meta-enforcement of
  exactly this doctrine — it mechanically requires that a doctrine-risk family
  audit inspected the persisted direct-output evidence before claiming PASS.
  Adding Family I extends that evidence-discipline to `thread_topology`. Note
  that I's `references_external_context` key is itself an anti-amplification
  surface (an external reference is NOT automatic factual standing per §3); the
  Card-1 prompt already encodes that, and L5's persisted-inspection requirement
  is the audit-time backstop. RESPECTED and reinforced.
- **cdiscourse-doctrine §4 (AI moderator limits):** No AI. The linter is pure
  regex + text parsing; no LLM/network. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine is sacred):**
  `src/lib/constitution/engine.ts` is untouched. This card touches an OPS
  audit-lint DATA file, not the Constitution engine. RESPECTED.
- **cdiscourse-doctrine §6/§7 (secrets; no AI calls from prod):** No keys, no
  `.env*`, no service-role, no Anthropic/xAI/X. The rules file is pure data; the
  fixtures' example JWT/token lines are shown `<… redacted>`. RESPECTED.
- **cdiscourse-doctrine §9 (plain language for users):** N/A — no user-facing
  strings. Internal codes (`family_i`, `thread_topology`, `compares_options`)
  live only in an operator-facing rules file and operator docs, never surfaced to
  end users. RESPECTED.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** Not applicable —
  this card touches no node label, no AnnotationChipDescriptor, no UI surface. The
  audit-lint linter operates on `docs/audits/*SMOKE*.md` operator-facing text.
  RESPECTED.
- **test-discipline (tests are part of done):** The card ships +11 tests
  (3-entry) covering membership, the E+F+G+H-preserved guard, the A.1 detector
  trap, L5 firing/non-firing for `family_i`, the consistent-PASS regression, and
  3 fixture assertions incl. the teeth proof. The 13 existing fixtures + their
  assertions are preserved. Test count goes UP (+11; 169 → 180). Suite must exit
  0 (typecheck + lint + jest). RESPECTED.
- **HALT triggers (mirror H §5 + HALT 11):** evaluated in the table below — none
  fire. Trigger 11 (`family_i` alias missing) is SATISFIED by the explicit
  inclusion of `family_i` + the membership + detectFamily-pin tests. RESPECTED.

---

## Operator steps (if any)

**None for the code change** — pure code + docs, no DB, no Edge Function, no
deploy, no env var.

**Post-merge smoke (operator/implementer, per intent §8):** run the 5-phase
smoke and author
`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-2026-06-07.md`
(must carry `Audit-Lint: v1`; self-lints clean):
1. **Phase 1 — membership:** `family_i` + `thread_topology` (+ `compares_options`
   at the 3-entry default) entries present in Set.
2. **Phase 2 — preservation:** Family A–H entries byte-equal preserved; set size
   = 14 (3-entry) or 13 (2-entry).
3. **Phase 3 — `detectFamily()`:** returns `family_i` for a canonical
   `# MCP-SERVER-010-FAMILY-I-SMOKE` title.
4. **Phase 4 — L5 firing:** synthetic I-improper → exit 1 citing L5;
   `family-i-amendment-PASS` → 0; `family-i-consistent-PARTIAL` → 0.
5. **Phase 5 — 16 fixture self-validation:** the 13 existing fixtures still exit
   `1,0,0,0,0,0,1,0,0,1,0,0,1`; the 3 new I fixtures exit `0,0,1`.
6. Regression: `npm run typecheck`; `npm run lint`;
   `npx jest --testPathPattern="opsAuditLint" --no-coverage` (exit 0).
7. Dogfood: the smoke audit doc lints itself clean. **NB:** the smoke audit doc
   title MUST use the canonical `OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE`
   form (no `-FAMILY-I` letter substring, so it does NOT trigger family-detect;
   it detects as audit-type `ops` per `AUDIT_TYPE_PATTERNS.ops` `/^#\s*OPS-/im` —
   same behavior as the G/H smoke audit docs).

The Supabase GitHub integration auto-deploys on merge, but this card changes no
migration and no Edge Function, so the auto-deploy is a no-op for this card.

---

## Fixture matrix (16 fixtures — exit codes + finding codes)

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
| 9 | `family-g-amendment-PASS.md` | HAND-AUTHORED | amendment | PASS | **0** | (none) | representative G amendment — UNCHANGED |
| 10 | `family-g-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | G teeth — UNCHANGED |
| 11 | `family-h-original-PASS.md` | static (`12ec7eb`) | unknown | PASS | **0** | (none) | Card 1 H smoke; title-format quirk → `family: null` — UNCHANGED |
| 12 | `family-h-amendment-PASS.md` | HAND-AUTHORED | amendment | PASS | **0** | (none) | representative H amendment — UNCHANGED |
| 13 | `family-h-IMPROPER-PASS-no-evidence-span.md` | SYNTHETIC | amendment | PASS | **1** | `L5` (ONLY) | H teeth — UNCHANGED |
| 14 | `family-i-consistent-PARTIAL.md` | **HAND-AUTHORED** | family-ship | PARTIAL | **0** | (none) | representative I consistent-PARTIAL; names `evidence_span` as the deferred Phase 4b obligation → `hasInspection` true → L5 does not fire. **The substitute for H's byte-copy "original" (no on-main I smoke exists).** |
| 15 | `family-i-amendment-PASS.md` | **HAND-AUTHORED** | amendment | PASS | **0** | (none) | representative I amendment / production-enable shape with canonical title AND persisted `evidence_span` inspection → `family: family_i` → DOCTRINE_RISK = true → `hasInspection` true → L5 satisfied |
| 16 | `family-i-IMPROPER-PASS-no-evidence-span.md` | **SYNTHETIC** | amendment | PASS | **1** | `L5` (ONLY) | TEETH — I doctrine-risk + verdict PASS + NO `evidence_span` → L5 fires; L1/L2/L6 do NOT |

Fixtures 1–13 produce **1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1** unchanged with
the I aliases added. Fixtures 14–16 produce **0, 0, 1**.

### Fixture 14 — `family-i-consistent-PARTIAL.md` (HAND-AUTHORED; exit 0)

The I substitute for a byte-copy "original" (none exists). A consistent-PARTIAL
I smoke that names `evidence_span` as the deferred Phase 4b obligation → L5 does
not fire. Use nearly verbatim (the implementer writes plain ``` fences):

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-010-FAMILY-I-SMOKE — Family I admin_validation ship (representative)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Card:** MCP-SERVER-010-FAMILY-I (Card 1 of the I chain)
**Verdict:** PARTIAL

## Phase 1 — Preflight

**Status:** PASS

Local typecheck + lint + Deno tests green. 9-family registry order preserved.

## Phase 3 — Hosted MCP smoke

**Status:** NOT-RUN (operator-deferred)

Hosted Phase 3 (25/25) is the GATE-C Deno-redeploy verification; operator-run post-merge.

## Phase 4b — Doctrine verification (optional; deferred)

**Status:** NOT-RUN (operator-deferred)

The binding persisted direct-output readback — querying evidence_span on the
production-mode thread_topology rows and scanning for topology-verdict drift
(off-topic / derailing / rehashing / going-in-circles) — is deferred to the
Card 3 production-enable amendment. This consistent-PARTIAL verdict names the
deferred evidence_span inspection obligation so the audit is doctrine-complete
about what remains.

## Final verdict: PARTIAL

Phase 3 + 4b operator-deferred. A later amendment (E/F/G/H precedent) lifts
PARTIAL to PASS once the hosted smoke + persisted evidence_span readback land.

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

### Fixture 15 — `family-i-amendment-PASS.md` (HAND-AUTHORED; exit 0)

Line 1 is the fixture marker; line 2 is the title (canonical
`MCP-SERVER-010-FAMILY-I-AMENDMENT` → `family_i` and `AMENDMENT` → amendment
type). It carries a persisted `evidence_span` readback (`SELECT … evidence_span`
block + `| … evidence_span … |` table) → `hasInspection` true → exit 0. Use
nearly verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-010-FAMILY-I-AMENDMENT — Production-enable completion (representative)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Predecessor audit:** docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-2026-06-07.md (PARTIAL — Phase 3 + 4b operator-deferred to Card 3).
**Reason:** Representative production-enable completion. Lifts the Card 1 admin_validation-only state to production by supplying the operator-run Edge admin_validation cycle + the binding Phase 4b persisted direct-output readback against production-mode I rows.

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family I smoke audit | (prior) | **PARTIAL** | Phase 1-2 local green. Phase 3 hosted smoke NOT-RUN. Phase 4b persisted readback NOT-RUN (no production I rows yet). Prior verdict: PARTIAL; doctrine-risk inspection deferred to Card 3. |
| **This amendment** | (this commit) | **PASS** | Phase 3 + 4b closed by operator-supplied production-enable smoke. The doctrine-risk persisted evidence_span readback was performed against the first production thread_topology rows. Required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

## Phase 4 — Edge admin_validation + production cycle (Family I)

**Status:** PASS

POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production' → HTTP 200; time_total=14s

Seeded args classified successfully; positives within the 6-key ai_classifier subset; no cross-family leakage.

## Amendment §1 — Persisted direct-output readback (BINDING; doctrine-risk)

**Status:** PASS

The persisted evidence_span rows were queried for the I production runs and scanned for topology-verdict drift:

SELECT res.raw_key, res.confidence, res.evidence_span FROM public.argument_machine_observation_results res JOIN public.argument_machine_observation_runs r ON r.id = res.run_id WHERE res.family = 'thread_topology' AND r.run_mode = 'production';

| raw_key | evidence_span | topology-verdict drift? |
| --- | --- | --- |
| introduces_new_issue | "Worth thinking about museum funding too" (the new-topic wording verbatim) | NO |
| compares_options | "carbon tax vs cap-and-trade … the tax is simpler" (the compared options verbatim) | NO |
| returns_to_prior_issue | "Coming back to the library staffing question" (the re-engagement wording verbatim) | NO |

The persisted evidence_span anchored the structural relation (new topic opened / compared options / parked issue returned to) and did NOT echo any topology-verdict word (off-topic / derailing / evasive / rehashing / repetitive / going-in-circles / the-right-option / winner). The binding L5 obligation (persisted argument_machine_observation_results.evidence_span inspection against the I ban-list) is SATISFIED.

## Final upgraded verdict

**PASS** — Phase 4 production cycle supplied; the doctrine-risk persisted evidence_span readback re-affirmed clean; Card 1 PARTIAL preserved and lifted.

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

### Fixture 16 — `family-i-IMPROPER-PASS-no-evidence-span.md` (SYNTHETIC; `["L5"]` only)

Line 1 is the fixture marker; line 2 is the title (canonical
`MCP-SERVER-010-FAMILY-I-AMENDMENT` → `family_i` and `AMENDMENT` → amendment
type). Body has all phases PASS, full L6 provenance, and **zero** L5 inspection
triggers. This is the I analog of `family-h-IMPROPER-PASS-no-evidence-span`. Use
nearly verbatim:

```markdown
<!-- AUDIT-LINT-FIXTURE: intentional negative case; preserved historical content for self-validation; exclude from doctrine/verdict scans -->
# MCP-SERVER-010-FAMILY-I-AMENDMENT — SYNTHETIC improper PASS (doctrine fixture)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Predecessor audit:** docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-2026-06-07.md (PARTIAL — Phase 3 + 4b deferred).
**Reason:** SYNTHETIC NEGATIVE FIXTURE. Verdict declared PASS and L6 provenance present, but the doctrine-risk persisted direct-output readback was never performed. L5 must catch this.

## Verdict-upgrade provenance (per L6)

| Stage | Commit | Verdict | What was proven; what was missing |
| --- | --- | --- | --- |
| Original Family I smoke audit | (prior) | **PARTIAL** | Phase 1-2 local green. Phase 3 NOT-RUN. Phase 4b NOT-RUN. Prior verdict: PARTIAL capped by deferred obligations. |
| **This amendment** | (this commit) | **PASS** | Phase 3 closed by operator-supplied production cycle. Gap closed; required verifications now supplied; direct proof supplements the original. All criteria satisfied per amendment §1. |

## Phase 4 — Edge production cycle (Family I)

**Status:** PASS

POST /functions/v1/classify-argument-boolean-observations
Authorization: Bearer <admin JWT redacted>
runMode: 'production' → HTTP 200; time_total=14s

Seeded args classified successfully; positives within the 6-key ai_classifier subset.

## Amendment §1 — Production cycle proof

**Status:** PASS

Production cycle completed cleanly. Run rows show status=success. Zero cross-family leakage. The proof is supplied by direct invocation evidence above.

## Final upgraded verdict

**PASS** — All required phases now have direct invocation proof; Card 1 PARTIAL preserved and lifted.

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

(Fixture 16 has NO `evidence_span`, NO `| evidence_span |`, NO `SELECT …
evidence_span`, NO `persisted evidence`, NO `direct-output inspection`. Fixtures
14 + 15 DELIBERATELY name `evidence_span` so L5 is satisfied — 15 via the
`SELECT … evidence_span` block + `| … evidence_span … |` table, 14 via the
deferred-obligation mention. The implementer MUST confirm fixture 16 contains
none of the 5 inspection patterns — run
`node scripts/ops/audit-lint.mjs __tests__/fixtures/audit-lint/family-i-IMPROPER-PASS-no-evidence-span.md`
→ exit 1 with `["L5"]`.)

---

## Smoke template (`docs/audits/OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE-template.md`)

Per the F + G + H precedent, this card produces a 5-phase (plus regression +
dogfood) smoke template authored as part of the design package. The template
carries `Audit-Lint: v1` and self-lints clean (detects as audit-type `ops`).
Skeleton (implementer fills in post-merge; the implementer writes plain ```
fences):

```markdown
# OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE — Post-merge smoke (TEMPLATE)

Audit-Lint: v1

**Date:** 2026-06-07
**Operator:** Kyler
**Card:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK (Card 2 of 3-card I chain; operator-override ship despite LOW doctrine-risk)
**Predecessor:** OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK (#403)
**Verdict:** TBD (implementer fills in post-merge)

## Phase 1 — Preflight (Set additions present)

**Status:** TBD

Required:
- DOCTRINE_RISK_FAMILIES.has('thread_topology') → true
- DOCTRINE_RISK_FAMILIES.has('family_i') → true
- DOCTRINE_RISK_FAMILIES.has('compares_options') → true  (3-entry default; omit if 2-entry form elected)

Verification command:

node -e "const r = require('./scripts/ops/audit-lint-rules.cjs'); console.log({ thread_topology: r.DOCTRINE_RISK_FAMILIES.has('thread_topology'), family_i: r.DOCTRINE_RISK_FAMILIES.has('family_i'), compares_options: r.DOCTRINE_RISK_FAMILIES.has('compares_options') });"

## Phase 2 — Preservation (Family A–H byte-equal)

**Status:** TBD

Required:
- argument_scheme, slippery_slope (E); critical_question, family_f, consequence_probability_unclear (F); resolution_progress, family_g, concedes_broader_point (G); claim_clarity, family_h, claim_specificity_low (H) all present.
- Set size = 14 (was 11 after H; +3 for I = 14). [2-entry form: 13.]

## Phase 3 — detectFamily I → family_i

**Status:** TBD

Required: a canonical MCP-SERVER-010-FAMILY-I-SMOKE title detects as family_i (NOT thread_topology).

Verification command:

node -e "const lib = require('./scripts/ops/audit-lint-lib.cjs'); console.log(lib.detectFamily('# MCP-SERVER-010-FAMILY-I-SMOKE - Post-merge audit', 'Phase 4b deferred.'));"

## Phase 4 — L5 firing/non-firing

**Status:** TBD

Required:
- Family-I titled doc WITHOUT evidence_span inspection → exit 1 with L5 finding
- Family-I titled doc WITH evidence_span inspection → exit 0
- Family-I titled doc with verdict PASS that names evidence_span → exit 0 (consistent-PASS)

## Phase 5 — Fixture self-validation

**Status:** TBD

Required: 16 fixtures lint to expected outcomes (1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,1).

## Phase 6 — Regression

**Status:** TBD

Required: npm run typecheck → 0; npm run lint → 0; npx jest --testPathPattern="opsAuditLint" --no-coverage → 0; npm run test → 0.

## Phase 7 — Dogfood

**Status:** TBD

Required: this smoke audit doc lints itself clean. The title uses the canonical OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK-SMOKE form (no -FAMILY-I letter substring), so it detects as audit-type ops, not family_i.

## Final verdict: TBD

Smoke verdict authority: PASS (unblocks Card 3) | PARTIAL (chain pauses) | FAIL (chain stops).

## Operator cleanup

No service-role usage. No secrets logged. No `.env*` touched. No migration.
```

---

## Evidence section — empirical A.1 probe (design-time, read-only)

Read-only probes confirm the detector behavior (the rules `Set` was NOT mutated
on disk; the `mapFamilyLetterToName` default-branch behavior is the verified
F/G/H precedent, and the on-disk set + the absence of an I smoke audit were
inspected directly):

```
Canonical I title:  "# MCP-SERVER-010-FAMILY-I-SMOKE — Post-merge smoke"
  detectFamily → "family_i"      (mapFamilyLetterToName('I') → default branch → `family_i`; no I case)
  auditType    → "family-ship"

mapFamilyLetterToName("I")       → "family_i"   (default branch; no I case — parallel to F/G/H)

On-disk DOCTRINE_RISK_FAMILIES (HEAD 4b9dabd):
  ["argument_scheme","slippery_slope",
   "critical_question","family_f","consequence_probability_unclear",
   "resolution_progress","family_g","concedes_broader_point",
   "claim_clarity","family_h","claim_specificity_low"]   ← 11 entries (E2+F3+G3+H3)

docs/audits/ I smoke audit on main?   → NONE (only MCP-SERVER-010-FAMILY-I-SMOKE-template.md)
opsAuditLint suite baseline (jest)    → 169 tests / 1 suite passing
```

**A.1 conclusion:**
1. The canonical-titled I doc detects as `family_i` (NOT `thread_topology`);
   `mapFamilyLetterToName('I')` returns `family_i` via the `default` branch.
   **Load-bearing alias = `family_i`.** Add `thread_topology` (canonical/declared
   name) + `family_i` (detector output) + `compares_options` (precautionary
   axis-partner; 3-entry default).
2. There is **no on-main Card-1 I smoke audit** to byte-copy → all 3 I fixtures
   are hand-authored; `family-i-consistent-PARTIAL` substitutes for H's byte-copy
   "original".
3. Adding `family_i` does NOT change any of the 13 existing fixtures' lint
   outcomes (none detects as `family_i`); DATA-only.

---

## HALT-trigger evaluation (mirror the H §5 + HALT 11)

| # | Trigger | Fires? | Why |
| --- | --- | --- | --- |
| 1 | Required-reading missing / logic touched | NO | All required docs read (intent brief, H design #403, current `audit-lint-rules.cjs`, Card 1 I design #392, fixture README, opsAuditLint.test.ts H blocks); the change is DATA-only — `audit-lint.mjs`, `audit-lint-lib.cjs`, `mapFamilyLetterToName` byte-equal |
| 2 | Standard preflight not green | NO | Pre-design probe ran cleanly; opsAuditLint baseline 169 captured; no typecheck/lint/test changes required for the design phase |
| 6 | roadmap-reviewer returns BLOCK | DEFERRED | Reviewer evaluates the implementer's output, not this design — designer's role ends here |
| 7 | Adversarial Explore (L5 teeth verification) finds blocking refutation | NO | Synthetic I-improper FAILS L5 with `["L5"]` only (by construction, mirroring the verified H teeth fixture); negative control without `family_i` proves the teeth bite is load-bearing |
| 8 | Test delta > +30 | NO | Forecast +11 (3-entry) / +9 (2-entry); well under the +30 ceiling |
| 9 | Card 1 smoke was FAIL or PARTIAL-with-no-evidence-span-claim | N/A | Card 1's hosted smoke is operator-post-merge and has NOT run; there is no on-main I smoke verdict. The fixtures are hand-authored representatives (not derived from a Card-1 smoke), so HALT 9 has no on-disk artifact to evaluate — surfaced as the fixture-provenance divergence, not a HALT |
| 11 | `family_i` alias missing from the added set | NO | `family_i` is explicit in the additions (`thread_topology` / `family_i` / `compares_options`); the membership test pins it; the detectFamily-pin test pins the title→`family_i` mapping; the teeth fixture proves the alias is load-bearing |

**No HALT trigger fires. The card proceeds as DATA-and-tests.** Triggers 7 and
11 are the correctness core and are both addressed above.

---

## Carry-forward invariants (byte-equality surfaces)

This design respects all DATA-only byte-equality surfaces:

- `scripts/ops/audit-lint.mjs` byte-equal — DATA-only edit, NO logic change. ✓
- `scripts/ops/audit-lint-lib.cjs` byte-equal — NO logic change incl.
  `mapFamilyLetterToName`. ✓
- `.github/workflows/audit-lint.yml` byte-equal — CI workflow unchanged. ✓
- Family A–H fixtures byte-equal — the 13 existing fixtures unmodified; only the
  `FIXTURE_FILES` array gets 3 new appended entries + the count assertion bumps
  13 → 16. ✓
- E / F / G / H entries in `DOCTRINE_RISK_FAMILIES` byte-equal — the design
  appends I's entries AFTER H's 3 (no reordering, no removal). ✓
- `package.json` byte-equal — no new dependency. ✓
- `mcp-server/**`, `supabase/functions/**`, `src/**` non-test byte-equal — this
  card touches none of them. ✓

---

## GATE-A verdict

**VERDICT: GATE-A PASS — design complete and implementable, PENDING the single
residual operator decision below.**

Almost every decision is resolved from code + the H/F/G precedent (DATA-only Set
append; `family_i` load-bearing alias; +11 test forecast; 5-phase smoke template;
hand-authored fixtures). The operator's belt-and-suspenders override of the LOW
doctrine-risk SKIP recommendation is the framing that makes this card ship at
all, and it is already given.

**Resolved (no operator action needed):**
- **DATA-only Set append** — `'thread_topology'` + `'family_i'` (+ `'compares_options'`)
  appended after H's 3; no logic change; no workflow edit; A–H entries byte-equal.
- **Load-bearing alias `family_i`** — verified from `mapFamilyLetterToName('I') →
  default branch → family_i`.
- **Test forecast +11** (3-entry) — within the brief's +10..+15; HALT ceiling +30.
- **Smoke template** — 5-phase (+ regression + dogfood), authored as part of this
  card; Phase 4 verifies L5 fires exit 1 on a `family_i` doc lacking
  `evidence_span` and does NOT fire when present.
- **Fixture provenance = SYNTHETIC** — all 3 I fixtures hand-authored (no on-main
  Card-1 I smoke exists to byte-copy); `family-i-consistent-PARTIAL` substitutes
  for H's byte-copy "original". (This is an interpretive resolution, surfaced for
  operator awareness but not a blocker.)

**The single genuine GATE-A operator decision requiring ratification (with
recommended default):**

1. **The third set entry (D-third).** The strict reading of Card 1's "no
   axis-partner key for I" / "all 6 keys LOW" finding is a **2-entry** form
   (`thread_topology` + `family_i` only). The **recommended default is the
   3-entry precautionary form** adding **`compares_options`** as the third entry
   — the single most verdict-adjacent I key (it carries Card 1's "comparing
   options is not picking a winner" guard; the closest I analog to G's
   `concedes_broader_point`). The 3-entry form keeps structural parity with the
   shipped H/F/G three-entry shape, honors the operator's belt-and-suspenders
   intent (maximize teeth), and costs nothing (the third entry is inert for
   canonical-titled docs, reachable only via an explicit `Family: compares_options`
   declaration, and cannot false-fire on A–H docs). The 2-entry strict form is
   the documented, doctrinally-safe alternative (it loses nothing material
   because the canonical-titled case keys on `family_i`, in both forms). **If the
   operator elects 2-entry, drop the `compares_options` membership test → +9
   tests and set-size 13.** Recommended: **3-entry with `compares_options`.**

**Belt-and-suspenders override (already given, restated for the record):** the
operator has overridden Card 1's SKIP recommendation (LOW doctrine-risk) and
chosen to SHIP this card as the L5 mechanization for Family I. This design ships
to that decision. The card is ready for implementation upon operator ratification
of decision 1 (the third set entry; default 3-entry / `compares_options`).
