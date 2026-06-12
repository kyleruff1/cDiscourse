# OPS-MCP-BAN-SCAN-NORMALIZATION — close the regex-evasion gaps in the ban-scan layer

**Status:** Implemented (2026-06-12). See "Implementation actuals" at the bottom.
**Epic:** Epic 12 — MCP / semantic-referee track (OPS hardening sub-track)
**Release:** OPS hardening (rejection-granularity follow-up chain: #576 J key-level → #577 A–J widening → #578 fixture/tripwire corpus → live probe → **this card**)
**Issue:** No standalone GitHub issue URL was supplied to the designer. The card is named at two places in-tree: `OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE` (the #578 files) records each evasion gap as "OUT OF SCOPE TO CHANGE HERE; closing it is a pattern-engine card" (`mcp-server/tests/softParaphraseRegexBoundaryHonesty.test.ts:11-14,:56-57,:69-70,:81-82`), and the live-probe audit names it as follow-up candidate (a): "the pattern-engine card for unicode/leet evasions (already named at #578)" (`docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md:73`).
**Baseline:** main @ `8e509eb` (clean). Deno baseline **1700 / 0**. jest **715 / 29620 (+1 skip)** — jest is untouched by this card.

---

## Goal (one paragraph)

The MCP ban-scan layer rejects model-output spans that carry verdict / truth / person tokens, but it matches them with **ASCII literal, case-insensitive, word/`snake_case`-boundary** regexes (`mcp-server/lib/doctrineBanList.ts:24-29`). The #578 honesty corpus pinned four evasions the ASCII patterns cannot see: **Cyrillic/Greek homoglyphs** (`tr`+U+043E+`ll`), **diacritics** (`wínner`), **leetspeak** (`tr0ll`), and — added by this card — **zero-width character insertion** (`t`+U+200B+`roll`). This card closes those gaps by normalizing the **scanned text only** (detection-time; persisted spans stay verbatim) before pattern-testing. This is **evasion-closure of each family's OWN existing boundary, NOT cross-family widening** — a disguised `tr0ll` was always within Family J's `troll` intent; the ASCII regex just couldn't see it. The change is consistent with the list-union ADR (`docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md`) **Option 0**: per-family lists stay per-family, **no token is added to any list**, each family's list becomes evasion-resistant. The defining constraints are cdiscourse-doctrine §1 (the server never emits a verdict/person token — disguised or not), §10a (a disguised slur is not a "structural feature of the move's own text"; surfacing it reads as the machine using the slur), and the chain's **no-divergence invariant** (the per-key drop collector and the whole-packet scan must build their decision from the identical detection logic). **Tightening is permitted; relaxing never is** — the design proves no string caught before is lost.

---

## Cannot-proceed check

No conflict. The card's purpose is to move a boundary the #578 tests **intentionally pinned as movable** with a documented flip procedure (`softParaphraseRegexBoundaryHonesty.test.ts:13-14`: "If a future card closes one of these gaps, the corresponding NOT-caught pin flips to caught and must be updated deliberately as part of that card."). One internal tension in the charter is surfaced and resolved below (Design decision **D2**: the "ASCII-identity" tighten-only proof as literally stated is incompatible with leet mapping, which transforms ASCII digits; resolved by the raw-OR-normalized matcher, which is strictly stronger). That is a design refinement, not a doctrine conflict.

---

## Data model

**No new data model.** No schema, no migration, no persisted field, no wire-shape change. The response packet (`McpBooleanObservationValidatedResponse`) is unchanged. Normalization is a pure in-memory transform applied to a `string` immediately before `RegExp.test`, never written anywhere. Persisted `evidence_span` / `evidenceSpan` text stays **verbatim** (normalization decides cleanliness; it never rewrites content).

---

## File changes

### New files

- `mcp-server/lib/banScanNormalize.ts` — **the only new production module** (~130–170 lines, mostly the commented homoglyph + leet tables). Exports:
  - `normalizeForBanScan(text: string): string` — the pure normalizer (steps in §"API / interface contracts").
  - `banScanMatches(text: string | null | undefined, patterns: readonly RegExp[]): boolean` — the **single shared matcher** (raw-OR-normalized; see D2). This is the one choke point through which **both** the ten family scans **and** the key-level collector test patterns, so the normalization decision can never diverge between them.

- `mcp-server/tests/banScanNormalize.test.ts` — new Deno suite for the normalizer + matcher (mapping classes, tighten-only property, idempotence, null safety, false-positive guards, disguised-token collector⇔scan agreement). ~40–48 `Deno.test` cases (see Test plan).

### Modified files

- `mcp-server/lib/keyLevelFailClosed.ts` — in `findUncleanEvidenceSpanKeys` (`:140-155`), replace the inner `for (const pattern of patterns) { if (pattern.test(span)) … }` with `if (banScanMatches(span, patterns)) dirty.push(rawKey)`; add the `banScanMatches` import. The `typeof span !== 'string'` skip stays (matches the MIX `keyNull` null-skip pin). **No change** to `banPatternsForKeyLevelFamily`, `KEY_LEVEL_FAIL_CLOSED_FAMILIES`, or `dropUncleanEvidenceSpanKeys` — pattern arrays and the drop mechanics are untouched. Net ~ −4 / +3 lines.

- `mcp-server/lib/familyABanListScan.ts` … `familyJBanListScan.ts` (**all ten**) — in each `scanFamily<X>BooleanResponseForBanList`, replace the three inner pattern loops (evidenceSpan-in-loop, `modelInfo.serverName`, `modelInfo.classifierSetVersion`) with `banScanMatches(value, <stack>)`, where `<stack>` is `DOCTRINE_BAN_PATTERNS` for A–D and the existing `allPatterns` local for E–J; add the `banScanMatches` import. **No change** to `DOCTRINE_BAN_PATTERNS` or any `FAMILY_<X>_BAN_PATTERNS` array — zero token added, removed, or reordered. Field-scan order and the returned `path` strings are preserved exactly. Net ~ −6 / +5 lines each (10 files).

- `mcp-server/tests/softParaphraseRegexBoundaryHonesty.test.ts` — **the documented flip.** Three pins flip `false → true` with boundary-moved notes naming this card:
  - `EDGE-homoglyph` (`:60-64`) — Cyrillic-o `troll` → now **caught**.
  - `EDGE-diacritic` (`:72-76`) — `wínner` → now **caught**.
  - `EDGE-leet` (`:84-86`) — `tr0ll` → now **caught**.
  Three pins **stay green** unchanged: `EDGE-case-insensitive` (positive control, `:48-51`), `EDGE-strict-boundary-asymmetry` `troll`≠`trolling` (`:95-97`), and `astroturf\w*` matches `astroturfing` (`:99-101`). Add 2 new EDGE pins (zero-width insertion caught; NFKD fullwidth `ｔｒｏｌｌ` caught). Net: 3 assertions edited + comment rewrites, +2 tests.

### Deleted files

None.

### Explicitly NOT modified

- `mcp-server/tests/softParaphraseSurvivorCorpus.test.ts` — **re-run as the SURV tripwire; not edited.** SURV-1 / SURV-union exercise `findUncleanEvidenceSpanKeys` (which now normalizes), so they implicitly re-verify all 20 soft exemplars stay clean post-normalization. If any flips, that is a **STOP** finding (see Edge cases / Risks), not a silent edit.
- `mcp-server/tests/keyLevelFailClosedWidening.test.ts`, `mcp-server/tests/softParaphraseMixedPacketReachability.test.ts`, `mcp-server/tests/familyJKeyLevelFailClosed.test.ts`, and every `family*BanListScan.test.ts` / `*AdversarialDoctrine.test.ts` / `*DoctrineFixtures.test.ts` — **expected to stay green untouched** (their spans are ASCII; the raw scan is preserved, and ASCII clean spans normalize to identity modulo lowercase). The implementer must run them and confirm; any red is a finding to evaluate, not to paper over.
- `mcp-server/lib/doctrineBanList.ts` and the `FAMILY_<X>_BAN_PATTERNS` constants — byte-unchanged. No list content change.

---

## API / interface contracts

```ts
// mcp-server/lib/banScanNormalize.ts

/**
 * Normalize text for ban-scan DETECTION ONLY. Pure; never mutates persisted
 * content. Order is fixed and deterministic. Output is used additively (see
 * banScanMatches) — it never replaces the raw scan.
 */
export function normalizeForBanScan(text: string): string;

/**
 * The single shared matcher. A span is "dirty" iff any pattern matches the RAW
 * text OR the normalized text. Null/undefined/non-string → false.
 *   return patterns.some(p => p.test(text)) || patterns.some(p => p.test(normalizeForBanScan(text)));
 */
export function banScanMatches(
  text: string | null | undefined,
  patterns: readonly RegExp[],
): boolean;
```

### `normalizeForBanScan` — fixed step order

1. **Lowercase** — `text.toLowerCase()` (Unicode-aware; folds Latin/Cyrillic/Greek case in one call). Done first so the homoglyph and leet tables need only **lowercase** entries, and so uppercase homoglyph attacks (`TRОLL`) fold before mapping. (Patterns are `/i`, so lowercasing cannot lose a case-insensitive match; D1.)
2. **Zero-width / invisible strip** — remove the explicit set `{ U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+2060 WORD JOINER, U+FEFF ZWNBSP/BOM }` via `replace(/[​‌‍⁠﻿]/g, '')`. **Explicit set, not a `\p{Cf}` category sweep** — an auditable, reviewable list; a category sweep also pulls in soft hyphen, bidi controls, and language tags whose folding behavior is harder to reason about. The raw-OR-normalized union (D2) keeps us safe even if the set is incomplete, so an explicit set costs nothing in safety and buys auditability. **Bidi controls (U+202A–U+202E, U+2066–U+2069)** are a named, deliberate deferral: also pure invisible insertions, candidate for a follow-up if a probe surfaces them; excluded here to keep v1 minimal and testable.
3. **Unicode fold** — `.normalize('NFKD').replace(/\p{M}/gu, '')`. NFKD decomposes precomposed diacritics (`í` → `i`+combining acute) and folds **fullwidth forms** (`ｔ`→`t`) and **ligatures**; the combining-mark strip then drops the accents. Fullwidth folding is **desired** — fullwidth `ｔｒｏｌｌ` is an evasion too.
4. **Homoglyph map** — explicit, commented lowercase Cyrillic/Greek → ASCII table, applied char-by-char. Minimum set (the common look-alikes; expand only with a documented reason):
   - Cyrillic: `а→a е→e о→o р→p с→c х→x у→y і→i ј→j ѕ→s` (U+0430, U+0435, U+043E, U+0440, U+0441, U+0445, U+0443, U+0456, U+0458, U+0455).
   - Greek: `ο→o α→a ε→e ρ→p ν→v? ` — include only unambiguous visual look-alikes: `ο→o α→a ε→e ρ→p`. (Greek letters with no clean ASCII look-alike are left untouched.)
   No library, no new dependency (Deno; no npm). An explicit table is reviewable and deterministic.
5. **Leet map (adjacency-gated)** — `{ '0':'o','1':'l','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s' }`. **A leet char is mapped iff an immediate neighbor (index ±1) is an ASCII letter `[a-z]`** (adjacency computed against the post-step-4 string, before substitution). See D3 for the rationale and the full false-positive analysis.
6. Return.

`banScanMatches` is null-safe (returns `false` for non-string), so the existing `typeof span !== 'string'` guard in `findUncleanEvidenceSpanKeys` and the family scans' `if (typeof span !== 'string') continue` remain correct and redundant-safe.

### Design decisions (the load-bearing ones)

- **D1 — lowercase in normalize:** YES. Redundant for matching (patterns are `/i`) but it lets the homoglyph/leet tables be lowercase-only and folds uppercase homoglyphs. Deterministic.
- **D2 — raw-OR-normalized matcher (resolves the charter's item-4 vs item-6 tension):** The charter's tighten-only proof as literally written — "for all pure-ASCII inputs, `normalize(text)` must be identity (modulo lowercase)" — is **incompatible with leet mapping**, which transforms the pure-ASCII string `tr0ll` into `troll`. It is also incompatible with the **only** way to catch in-token zero-width evasion: to catch `t`+U+200B+`roll` you must *delete* the ZWSP (gluing `troll`), but deleting a ZWSP that sat between two alphanumerics can *destroy* a boundary the raw pattern relied on (`ro`+U+200B+`bot` → `robot`, which the strict `bot` boundary deliberately does not match — so a pure `normalize-then-scan` would *lose* that incidental catch). Both problems vanish if the matcher tests **raw OR normalized**: the raw scan is always run, so **no prior catch is ever lost, for any input** (strictly stronger than the ASCII-only claim), and the normalized scan is **purely additive**. This is the recommended design. The narrower property "normalize is identity on pure-lowercase-ASCII-letter text" stays true and is still property-tested, but it is no longer the load-bearing proof; the load-bearing proof is "the matcher always tests the raw text." Rejected alternative: `normalize-then-scan` (REPLACE) — only tighten-only "modulo removing pre-existing incidental over-matches," which is harder to prove and weaker on the doctrine bar; union removes all doubt.
- **D3 — leet mapping is adjacency-gated:** Map a leet digit/symbol only when a neighbor is an ASCII letter. **Rationale:** evasion embeds the leet char *inside a letter run* (`tr0ll`, `l0ser`, `b0t`, `@stroturf`); standalone numerals (years, statute numbers, prices, model numbers, counts) are never evasions. Gating (a) keeps `2019`, `Section 230`, `Model 3`, `$5`, `co2` numeric/untouched, shrinking the noise surface to near-zero, and (b) keeps the false-positive surface trivially bounded — a banned token can only *form* when leet chars sit among letters, which is exactly the evasion signature. See the false-positive analysis below.

---

## Where it applies (no-divergence)

There is **no single shared scan helper today** — each of the ten `scanFamily<X>BooleanResponseForBanList` functions has its **own** identical three-site loop (evidenceSpan-in-loop, `serverName`, `classifierSetVersion`), and `findUncleanEvidenceSpanKeys` has its own loop (verified by reading all eleven modules). **Choke-point finding:** the cleanest single choke point is the `RegExp.test(text)` primitive itself. The design introduces `banScanMatches(text, patterns)` and routes **all eleven** call sites through it (the 10 family scans × 3 field sites + the collector). The normalization decision then lives in **exactly one function**, so the whole-packet scan, the key-level collector, and the post-drop re-scan (`classifyArgumentBooleanObservations.ts:683-695`) are **structurally incapable of diverging** — they call the same matcher. This is stronger than the current arrangement (eleven independent inlined loops). `modelInfo.serverName` / `modelInfo.classifierSetVersion` are normalized too (uniformity, per charter).

---

## Edge cases

- **Empty / null / whitespace span:** `banScanMatches(null|undefined|'' )` → `false`; `normalizeForBanScan('')` → `''`. The `keyNull: null` MIX pin (`softParaphraseMixedPacketReachability.test.ts:141,:164`) stays green.
- **Pure-ASCII clean text (the bulk of real spans):** normalize lowercases (no new match — `/i`), applies no homoglyph (ASCII), strips no zero-width (none), and leet-maps only letter-adjacent digits. Raw scan is preserved verbatim. No catch added unless the text *forms* a banned token at boundaries after mapping.
- **Disguised token verbatim-quoting the author's own word** (move literally says `tr0ll`): now **dropped** by key-level fail-closed where it previously survived on a clean sibling. This is the intended §10a trade-off — assessed plainly below.
- **In-token zero-width** (`t`+U+200B+`roll`): caught via the normalized form. **Boundary-faking zero-width** (`ro`+U+200B+`bot` → would-be `robot`): the raw form still matches `bot` (ZWSP is a boundary) and is **preserved** (we never relax); the normalized form does not match `robot` (boundary destroyed). Net: still caught (raw), no relaxation. This is the D2 monotonicity guarantee in action.
- **`trolling` vs `troll`** (inflection): out of scope. `trolling` is pure ASCII → normalize identity → the strict `troll` boundary still does not match. The `EDGE-strict-boundary-asymmetry` pin **stays green**. (Charter: inflection is a word-boundary semantics question, not an evasion.)
- **`astroturfing`:** `astroturf\w*` matches it raw → stays caught. Pin stays green.
- **Legit non-ASCII words** (`café`, `naïve`, `résumé`, `Москва`): NFKD/homoglyph folds them to `cafe` / `naive` / `resume` / partially-mapped `мoсkвa` — none form a banned token. (False-positive test asserts this.)
- **Standalone numbers / prices / model numbers** (`2019`, `Section 230`, `Model 3`, `$5`): adjacency-gating leaves them numeric → no leet substitution → unchanged.
- **Doctrine-constraint edge:** "what if a disguised token tried to ride on a clean sibling key?" — it can't anymore; the collector now sees the normalized form and drops that key alone (clean siblings still survive — key-level fail-closed semantics unchanged).

---

## Test plan

All new/changed tests are **Deno** (`mcp-server/tests/`); jest is untouched.

- `mcp-server/tests/banScanNormalize.test.ts` (new):
  - **Zero-width** (~4): each of the 5 chars stripped; in-token ZWSP `t​roll` → `banScanMatches` true vs J stack; standalone/edge positions; idempotence on a ZWSP-laden string.
  - **Diacritic / NFKD** (~4): `wínner` (precomposed U+00ED) caught vs DOCTRINE; combining-mark form (`w`+`i`+U+0301+`nner`) caught; fullwidth `ｔｒｏｌｌ` caught vs J; a ligature case.
  - **Homoglyph** (~4): Cyrillic-o `troll`, Cyrillic mix on `winner`, Greek-o, and a legit Cyrillic word (`Москва`) NOT caught.
  - **Leet** (~6): `tr0ll`→caught (the pinned flip); `l0ser`→caught (DOCTRINE); `w0n`→caught vs G; adjacency-gating: `Model 3` / `2019` / `Section 230` NOT mapped (assert `normalizeForBanScan` leaves the digit) and NOT caught; `$5` price not mapped.
  - **Tighten-only property** (~3): for a fixed list of pure-lowercase-ASCII-letter strings, `normalizeForBanScan(s) === s`; and the **monotonicity** property — for a sampled set of raw-matching inputs (incl. the boundary-faking ZWSP `robot` case), `banScanMatches` stays `true` after the change.
  - **Idempotence** (~1): `normalizeForBanScan(normalizeForBanScan(x)) === normalizeForBanScan(x)` over a mixed corpus.
  - **Null/empty safety** (~2): `banScanMatches(null/undefined/'')` → false; `normalizeForBanScan('')` → `''`.
  - **False-positive guards** (~6): `Model 3 costs $5`, `café`, `naïve`, `Ünternehmen`, `résumé`, `co2 emissions`, `the 2019 report`, a legit Cyrillic word — each asserted clean against the DOCTRINE stack **and** the J stack (no `banScanMatches` hit).
  - **Disguised-token collector⇔scan agreement** (~6): for a sample of families — **A** (doctrine-only), **H** (family-array, `sloppy`-class), **J** (`troll`/`astroturf*`) — a disguised dirty span (homoglyph + leet variant) is caught by **both** `findUncleanEvidenceSpanKeys(.., banPatternsForKeyLevelFamily(slug))` **and** `scanFamily<X>BooleanResponseForBanList`, on the exact same key, proving the new normalization decision is identical on both paths.
- `mcp-server/tests/softParaphraseRegexBoundaryHonesty.test.ts` (modified): flip the 3 EDGE pins (`false`→`true`) with boundary-moved comments naming `OPS-MCP-BAN-SCAN-NORMALIZATION`; add 2 EDGE pins (zero-width, fullwidth). The case-insensitive / strict-boundary / `astroturfing` pins stay.
- `mcp-server/tests/softParaphraseSurvivorCorpus.test.ts` (re-run, not edited): SURV-1 / SURV-2 / SURV-union must stay green — all 20 soft exemplars clean post-normalization, all 10 hard controls still caught. **A SURV failure is a STOP** (boundary moved onto a pinned survivor — surface it; do not edit the exemplar).
- Doctrine ban-list assertion: the new tests use hard tokens only as scan-detection inputs (established precedent — the #578 files do the same); no banned token appears as app copy. The false-positive corpus contains zero banned tokens.

**Estimated counts:** ~40–48 new Deno tests + 2 added EDGE pins; 3 EDGE assertions flipped (no count change). New Deno total ≈ **1700 → ~1745, 0 failures**. jest unchanged at **715**. Implementer must capture the explicit `Test Suites: … / Tests: …` line + exit code (test-discipline gate-timeout rule).

---

## Dependencies (cards / docs / files)

- Assumes **#576 (J key-level fail-closed)**, **#577 (A–J widening)**, and **#578 (fixture/tripwire corpus)** are complete — they are (`keyLevelFailClosed.ts`, the EDGE/SURV/MIX suites, and the A–J `banPatternsForKeyLevelFamily` switch are all in-tree at `8e509eb`). The card edits the boundary those tests deliberately pinned as movable.
- Consistent with and cites `docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md` **Option 0** (per-family lists stay per-family; no token added; each list becomes evasion-resistant) and the live-probe audit `docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md:73` (this is named follow-up (a)).
- Reads existing: all ten `mcp-server/lib/family*BanListScan.ts`; `mcp-server/lib/doctrineBanList.ts:24-54`; `mcp-server/lib/keyLevelFailClosed.ts:106-155`; the dispatcher call site `mcp-server/tools/classifyArgumentBooleanObservations.ts:677-709`.
- **Does not block** any named future card. It narrows (does not close) the L5 ops-SQL historical-row gap (below). The soft-paraphrase residual remains open (a different card; no token-scan closes it).

---

## Risks

- **Leet false positive on existing clean test spans:** the only way an existing clean ASCII span newly fails is if it contains a letter-adjacent digit/symbol that maps to a *bounded* banned token (e.g. a span literally containing `w0n`). Adjacency-gating + the strict boundaries + the raw-OR-normalized union make this vanishingly unlikely, but it is not provably zero. **Mitigation:** run the FULL Deno suite; treat any newly-red previously-clean assertion as a finding to evaluate (likely a genuinely disguised token, possibly a rare false positive to assess) — do not blanket-edit.
- **`\p{M}` / `\p{Cf}` Unicode property support:** Deno supports Unicode property escapes with the `u` flag — verify on the target Deno version; fallback is the explicit combining range `[̀-ͯ]`.
- **Flip discipline:** the 3 EDGE pins MUST be updated deliberately. If the implementer forgets, those tests go **red** — a *safe* failure that forces attention (better than a silent boundary move).
- **Existing-test churn beyond the named files:** expected zero (ASCII spans, raw scan preserved), but the implementer must run `family*BanListScan.test.ts`, the `*AdversarialDoctrine` / `*DoctrineFixtures` suites, `keyLevelFailClosedWidening`, `softParaphraseMixedPacketReachability`, and `familyJKeyLevelFailClosed` and confirm green.
- **Deno-deploy-bearing:** merge to main auto-redeploys `cdiscourse-mcp-server` to Deno Deploy (GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server`; `deno.jsonc` `org/app`). This card adds **no MCP booleans and no prompt-family changes**, so it is **not** the booleans-GATE-C class — but it is still deploy-bearing code; post-merge needs a build readback + `/health`. No provider spend (deterministic server code; the Deno tests are the proof).
- **Performance:** `normalizeForBanScan` runs per field per scan; spans are ≤240 chars (`machineObservationPersistenceAdapter.ts:99-101`); cost is negligible.

---

## Out of scope

- **L5 ops-SQL readback regexes** — SQL cannot normalize. Stated honestly: the server scan is the **pre-persist gate**, so once this ships, disguised tokens never persist; the SQL gap narrows to **historical rows** written before this card. No SQL change here.
- **The Edge** — no ban scan exists there (per the ADR); untouched.
- **Inflection / word-boundary semantics** (`troll` vs `trolling`) — a semantics question, not an evasion; the asymmetry pin stays.
- **Any list content change** — no token added, removed, reordered, or promoted to the shared list. (That is the rejected ADR Options 1/2.)
- **The soft-paraphrase residual** (regex-clean, model-authored person/intent characterization) — no normalization catches it (it carries no banned token in any form); a separate pattern-engine card with its own §10a + production review.
- **`modelInfo` emission-shape reinforcement** — its own card (`OPS-MCP-MODELINFO-SHAPE-REINFORCEMENT`, audit Amendment).
- **Bidi-control stripping** — named deferral (§3 step 2 rationale).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict label; observation not allegation):** the change makes the server *better* at refusing to emit a verdict/person token — a disguised `tr0ll` reads as `troll` to a human, so surfacing it is exactly the emission §1 forbids. Omission asserts nothing (key-level fail-closed unchanged: the unclean key dies alone, clean siblings survive, nothing is coerced to a fabricated finding). **RESPECTED — strengthened.**
- **cdiscourse-doctrine §3 (popularity/satire earn no standing):** untouched; anti-amplification semantics not in scope. **RESPECTED.**
- **cdiscourse-doctrine §4 (AI advisory; server-side only; never assigns truth):** no change to authority or runtime locus; this is pure server-side detection hardening. **RESPECTED.**
- **cdiscourse-doctrine §10a (Observations vs Allegations) — the trade-off, stated plainly:** A span that verbatim-quotes the author's own *disguised* token (move says `tr0ll`) would now be **dropped** where before it survived. Assessed against the ADR's reasoning: the rejected cross-family union (ADR Options 1/2) would drop quotes of content the lists **never intended to catch** — a Family-D span quoting "the bill **won** committee approval", where `won` is a *Family-G* token Family D was deliberately built to ignore. **This card is different in kind:** it drops a quote of content the family's **own** list **always intended to catch** — `troll` is Family J's existential token; the disguised `tr0ll` was the anomaly that slipped an ASCII regex. The ADR's §10a verbatim-quote defense holds for *person-neutral structural* quotes, but a disguised slur is **not** person-neutral — surfacing `tr0ll` reads as the machine using the slur, the precise weak spot the ADR's defense was thinnest on. Closing it is therefore doctrine-**positive**, and the cost is one observation key (dropped alone), never the packet. **RESPECTED — the trade-off is named, not papered over.**
- **No-divergence invariant (chain constant, #577/#578):** strengthened. `banPatternsForKeyLevelFamily` arrays are byte-unchanged (WIDEN-3 source+flags pins stay green); the scan, the collector, and the post-drop re-scan all route through the single `banScanMatches`, so the normalization decision cannot diverge. **RESPECTED.**
- **§5 (engine sacred), §6/§7 (secrets; no AI from the app), §8 (RLS/migrations), §9 (plain language), §10 (v1 scope):** no engine touch, no secret, no provider call, no DB/migration/RLS, no user-facing string, no voting/search/push/OAuth/public-API. **RESPECTED.**

---

## Operator steps (if any)

**Deno-deploy-bearing, no provider spend.** On merge to main the Supabase/Deno GitHub integration auto-redeploys `cdiscourse-mcp-server` to Deno Deploy (`deploy/civildiscourse/cdiscourse-mcp-server`). Operator action after the implementer's PR merges:

1. Confirm the Deno Deploy build for `cdiscourse-mcp-server` succeeded (the hosted `*.deno.net` build readback).
2. Hit `/health` on the hosted endpoint → expect 200.

No `npx supabase db push`, no Edge Function deploy, no env var, no secret rotation, no MCP-boolean smoke (no new booleans/prompts). The Deno test suite is the correctness proof; the post-merge readback confirms the deploy landed.

---

## Implementation actuals (2026-06-12)

Implemented exactly per the design with the operator-confirmed D2 raw-OR-normalized union matcher. No redesign.

- **New production module** `mcp-server/lib/banScanNormalize.ts` (~185 lines incl. the commented homoglyph + leet tables): `normalizeForBanScan` (5 fixed steps — lowercase → explicit zero-width strip → NFKD + `\p{M}` combining-mark strip → explicit Cyrillic/Greek homoglyph map → adjacency-gated leet map) and the shared `banScanMatches(text, patterns)` (raw scan first, then additive normalized scan; null-safe; `normalized === text` short-circuit for the bulk-ASCII case). Pure, zero deps, Deno-clean (`deno check` + `deno lint` clean).
- **All eleven call sites routed through `banScanMatches`**: the ten `scanFamily<X>BooleanResponseForBanList` functions (each of the three field sites — evidenceSpan-in-loop, `serverName`, `classifierSetVersion`) + `findUncleanEvidenceSpanKeys`. The post-drop re-scan (`classifyArgumentBooleanObservations.ts`) needed no edit — it calls `providers.banListScan` + `findUncleanEvidenceSpanKeys`, so it routes through the matcher by construction (verified). `DOCTRINE_BAN_PATTERNS` and every `FAMILY_<X>_BAN_PATTERNS` are byte-unchanged (git diff confirms zero pattern-array hunks; the family-scan diffs are import + loop→matcher routing only; `path` strings and field order preserved exactly).
- **Tests** `mcp-server/tests/banScanNormalize.test.ts` (new, 39 `Deno.test` cases): zero-width, NFKD/diacritic/fullwidth/ligature, homoglyph (incl. uppercase fold + legit Cyrillic word clean), adjacency-gated leet (incl. `Model 3` / `2019` / `Section 230` / `$5` / `co2` clean), tighten-only + monotonicity (incl. the boundary-faking `ro`+ZWSP+`bot` raw catch), idempotence, null/empty, false-positive guards, disguised-token collector⇔scan agreement (A/H/J), and the persisted-content-verbatim property.
- **Documented flips** in `softParaphraseRegexBoundaryHonesty.test.ts`: the 3 EDGE pins (homoglyph / diacritic / leet) flipped `false → true` with boundary-moved notes naming this card; 2 new EDGE pins added (in-token zero-width + NFKD fullwidth). The case-insensitive positive control and the strict-boundary-asymmetry pins (`troll`≠`trolling`; `astroturf\w*` matches `astroturfing`) stay as-is.
- **SURV tripwire re-verified (not edited):** all 20 soft exemplars stay clean under the union matcher; all 10 hard controls still caught. No STOP finding.

**Estimates vs actuals (estimates retained above):** Deno **1700 → 1741, 0 failures** (+39 new file + 2 new EDGE pins; the design estimated ~1745). jest unchanged at **715 suites / 29620 + 1 skip, exit 0** (Deno scan untouched by jest). `npm run typecheck` exit 0. Scoped `deno lint` + `deno check` on new/touched files clean. Deno-deploy-bearing — operator steps above stand.
