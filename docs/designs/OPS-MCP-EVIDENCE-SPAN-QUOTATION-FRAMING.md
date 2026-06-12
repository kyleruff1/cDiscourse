# OPS-MCP-EVIDENCE-SPAN-QUOTATION-FRAMING — frame the classifier evidence span as a marked quotation of the move's own words

**Status:** Implemented on `feat/evidence-span-quotation-framing` — display/copy-only, exactly as designed. Actual: +9 additive tests (8 in `cardClassifierProvenance.test.ts` — happy-path, null span, nested-quote, truncation-ellipsis, a11y framing, frame ban-list, hostile-token-preservation, single-source; 1 render assertion in `cardViewRefine.test.tsx`; estimate was ~7–8). Full jest **715 suites / 29620 passed + 1 pre-existing skip = 29621 total, exit 0** (+9 vs the 29611 baseline; no new suite). Typecheck exit 0; per-file eslint clean on all touched files. Estimates below are retained as written.
**Epic:** Epic 2 (Visual Grammar) / Epic 11 (Gallery surfaces) — UI / copy
**Release:** OPS hardening (rejection-granularity follow-up; the named Option-3 card from the cross-family list-union ADR)
**Issue:** No standalone GitHub issue URL was supplied. The motivating record is `docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md` §"Named follow-up card" (`:159-161`) and its investigation finding #5 (`:97`). This card is explicitly named there as **optional, low-priority, display-only**.

---

## Goal (one paragraph)

The cross-family list-union ADR decided (Option 0) to make **no scan-layer change**: the residual where one family's verbatim evidence-span legitimately quotes another family's hostile token (`…astroturfed…`, `…wrong…`) is a §10a-clean structural Observation of the move's *own* text, rendered **attached** on the author's own node. The one honest weakness the ADR found (investigation #5, `:97`) is purely a **framing softness at a single render site**: the span is prefixed `"Why this fired:"` and is **not** wrapped in quotation marks, so a bare hostile token reads marginally more like a *machine-stated reason* than a *marked quote of the author's words*. This card sharpens that one framing — display/copy-only — so the span reads unambiguously as a quotation: it (1) replaces `CARD_CLASSIFIER_EVIDENCE_PREFIX` (`'Why this fired:'`) with an attribution frame and wraps the span in curly quotation marks, mirroring the in-repo parent-bubble quote precedent (`CardDetailPanel.tsx:465` renders `` `“${bubble.quote.quote}”` ``); and (2) does the secondary comment-only cleanup of the stale "A–G" comments that misled the ADR investigation. Doctrine that shapes this: `cdiscourse-doctrine` §1 (the frame must read as the machine pointing at the move's own words, **never** as a verdict), §9 (plain language; no internal codes), §10a (an Observation is a structural feature of the move's *own* text — explicit quotation makes that posture visible). **No scan change, no migration, no Edge/Deno change, no behavior change to what data persists or loads, no gate/suppression change.**

---

## Data model

**No new data model.** No DB column, no migration, no schema change. No change to `NodeLabelMark`, to the persisted `evidence_span` column, to `MachineObservationResultRow`, or to the §10a disposition/surface enums.

The only model-shape change is **one additive display field** on the existing pure-TS `CardClassifierChip` interface (`src/features/arguments/cardView/cardClassifierStripModel.ts:119-149`):

```ts
export interface CardClassifierChip {
  // ...existing fields unchanged...
  /** ≤240-char evidence span, RAW (verbatim, unaltered). null when the mark
   *  carried no span. Kept for logic (isExpandable) + tests. */
  evidenceSpan: string | null;
  /** NEW — the display string the UI renders: the attribution frame + the
   *  raw span wrapped in curly quotation marks, e.g.
   *  `From this move’s text: “…astroturfed…”`. null when evidenceSpan is null.
   *  Built in markToChip so the framing has ONE source of truth (the capped
   *  strip AND the uncapped hub both render this field). */
  evidenceSpanFramed: string | null;
  // ...
}
```

`evidenceSpan` stays **raw and unaltered** (doctrine: it is a verbatim excerpt; the model must not mutate the quoted bytes). `evidenceSpanFramed` is a derived display string only.

---

## File changes

All paths are under `src/features/arguments/`. None of these files is RO-N pinned (verified against the cross-family ADR's RO-N scan note and the prompt's verification). No file outside `src/features/arguments/` is touched.

### Modified — the framing (scope item 1)

- **`cardView/cardClassifierStripModel.ts`** (~10 lines net):
  - `:69` — change `CARD_CLASSIFIER_EVIDENCE_PREFIX` value from `'Why this fired:'` to `'From this move’s text:'` (curly apostrophe U+2019, matching the existing `'From the move’s lifecycle'` provenance constant at `:87`). Keep the exported NAME (only one importer; no test references the literal — see Test plan). Update its doc comment (`:68`) from "Prefix applied to the evidence span when a chip expands" to describe it as an **attribution frame**, not a reason label.
  - Add the curly-quote constants (or inline literals) `“` (U+201C) / `”` (U+201D) mirroring `CardDetailPanel.tsx:465`. Inline in `markToChip` is fine; a named pair (`EVIDENCE_QUOTE_OPEN` / `EVIDENCE_QUOTE_CLOSE`) is cleaner for the ban-list test to import.
  - `markToChip` (`:199-227`) — add `evidenceSpanFramed`:
    ```ts
    const evidenceSpanFramed = evidenceSpan != null
      ? `${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${EVIDENCE_QUOTE_OPEN}${evidenceSpan}${EVIDENCE_QUOTE_CLOSE}`
      : null;
    ```
    The whole span (including any trailing truncation ellipsis) is wrapped; inner quotes are **not** normalized (verbatim preserved — see Edge cases). Add `evidenceSpanFramed` to the returned object (`:213-226`).
  - `markToChip` accessibility label (`:208-211`) — change `spanPhrase` from `'. Tap to see why this fired.'` to `'. Tap to see the quoted text from this move.'` so the screen-reader hint frames the span as a quote, consistent with the new visual frame. (The span text itself is not in the row label today and stays out; the framed quote reaches the screen reader via the child `<Text>` that renders `evidenceSpanFramed` — see API/interface contracts.)
  - Update the `evidenceSpan` field doc (`:142-144`) — it currently says "(no prefix; the UI prepends the prefix)"; the UI no longer prepends, so reword to "(raw, verbatim; the framed display string is `evidenceSpanFramed`)".
  - `:310` (comment, in `buildHubClassifierMarks` doc) — fix stale "EXPLICIT A–G family gate" → "EXPLICIT A–I family gate" (this is a hub-gate comment in a file already being edited; see scope item 2 finding).

- **`cardView/CardDetailPanel.tsx`** (~6 lines):
  - `ClassifierLabel` (`:169-171`) — replace
    `` const evidenceText = chip.evidenceSpan ? `${CARD_CLASSIFIER_EVIDENCE_PREFIX} ${chip.evidenceSpan}` : null; ``
    with `const evidenceText = chip.evidenceSpanFramed;`. The inline (`:200-208`) and stacked (`:211-215`) render branches are unchanged (they already render `evidenceText`).
  - `:38` — remove the now-unused `CARD_CLASSIFIER_EVIDENCE_PREFIX` import (the model builds the framed string). Lint will flag it if left.
  - `:227-228` (comment fix, scope item 2) and `:849` (comment fix, scope item 2) — see below.

### Modified — comment-only stale-comment cleanup (scope item 2, zero behavior)

- **`cardView/CardDetailPanel.tsx`**:
  - `:227-228` (HubClassifierZone doc) — "Only A–G families survive the model's explicit family gate, so H/I/J never render here." → "Only A–I families survive the model's explicit family gate (only Family J / `sensitive_composer` is excluded), so J never renders here."
  - `:849` (classifier-column render comment) — "observations (A–G gated, uncapped)." → "observations (A–I gated, uncapped)."
  - `:302` (CombinationObservationChip / mapping-section doc) — "A-G only; H/I/J never (the model already drops them). No `inactive_reason`." → "Production families only (A–I); the frozen Family J (`sensitive_composer`) is dropped by the defensive gate. No `inactive_reason`." (See finding: this site IS stale; the mapping roster is now A–I with J-only frozen.)
- **`cardView/cardDetailModel.ts`**:
  - `:148` — "/** ask iii — all-families family-grouped classifiers (A–G gated). */" → "(A–I gated)".
  - `:338` — "// ask iii — all-families family-grouped classifiers (A–G gated, uncapped)." → "(A–I gated, uncapped)".

### Recommended additional comment-only fixes (discovered adjacent; see Dependencies/finding)

- **`cardView/cardMappingSectionModel.ts`** `:26` and `:130` — same stale "A-G / H/I/J" framing as `:302`; the mapping roster is A–I, frozen set is J-only. Comment-only, zero behavior. Recommend including for completeness (they are the same misleading framing the ADR flagged). If the operator wants to hold scope strictly to the five named sites, file these two + the `:310` site as a one-line follow-up; the design's preference is to fix them now because they are trivial and identical in kind.

### NOT touched

- `nodeLabels/observationMapping/deployedAgRawKeys.ts` — already self-documents the historical-name rename (`:22-28`, `:45-52`); its comments are accurate. Leave.
- `detail/argumentDetailModel.ts:670-688` (`HUB_NON_PRODUCTION_FAMILIES`) and all gate/grouping logic — **untouched** (hard constraint).
- `machineObservationPersistenceAdapter.ts` (truncation `:67-71`, `:99-101`) — **untouched**; `evidenceSpanFramed` consumes the already-truncated span.
- All `mcp-server/**`, `supabase/**`, migrations, `engine.ts` — **untouched**.

### New files

- **None.** (Tests are added to existing files — see Test plan.)

---

## API / interface contracts

### `CardClassifierChip` (consumer-facing)

New field `evidenceSpanFramed: string | null` (additive, documented above). Existing fields unchanged. Built in `markToChip(mark: NodeLabelMark): CardClassifierChip` — the SAME function the capped Cards strip (`buildCardClassifierStrip`) and the uncapped hub (`buildHubClassifierGroups`) both use, so the framing is byte-identical across both surfaces from one code path (the `markToChip` "byte-identical chip derivation" contract documented at `cardClassifierStripModel.ts:194-198` is preserved).

### Framed-string contract

```
evidenceSpanFramed === null                       ⟺  evidenceSpan === null
evidenceSpanFramed === `${PREFIX} “${span}”`      when evidenceSpan === span (verbatim, unaltered)
PREFIX === CARD_CLASSIFIER_EVIDENCE_PREFIX === 'From this move’s text:'
quote marks === U+201C … U+201D  (curly “ ”), matching CardDetailPanel.tsx:465
```

The raw `span` is inserted **verbatim** between the quote marks — no inner-quote normalization, no whitespace trimming, no re-truncation.

### `ClassifierLabel` (view, `CardDetailPanel.tsx:162-218`)

Props unchanged (`{ chip, isWide }`). Internally renders `chip.evidenceSpanFramed` (was: locally-concatenated `${PREFIX} ${span}`). The two render branches and their testIDs (`card-detail-classifier-evidence-${chip.id}`) are unchanged.

### Screen-reader contract (accessibility-targets)

`markToChip` composes `accessibilityLabel = ${taxonomyWord}: ${mark.label}${pipsPhrase}${spanPhrase}` (`:208-211`). The span TEXT is **not** in this row label (today or after this card) — it reaches the screen reader via the child `<Text>` that renders `evidenceSpanFramed`. Two things change for a11y, both in `markToChip` (single source):
1. `spanPhrase` hint → `'. Tap to see the quoted text from this move.'` (was "why this fired").
2. The child-Text content the reader hears is now the framed, quoted string (because the view renders `evidenceSpanFramed`).

No new `accessibilityRole` / `accessibilityState` is introduced; the classifier row stays `accessibilityRole="text"` (display-only Observation, doctrine §1/§4 — it is NOT a Pressable, so the 44×44 hit-target rule does not apply here).

---

## Edge cases

- **`evidenceSpan === null`** (mark carried no span): `evidenceSpanFramed === null`; `isExpandable === false`; the view renders nothing (both branches gate on `evidenceText`). Unchanged behavior.
- **Empty active id / no marks / all marks suppressed**: handled upstream by `buildCardClassifierStrip` empty model; `markToChip` is never called. Unchanged.
- **Nested quotes — span already contains `"` or `“…”`**: wrap **unconditionally** in outer curly quotes; do **not** strip or normalize inner quotes. Rationale: (a) the span is a verbatim excerpt and altering it would falsify the quote (doctrine §10a — it must remain the move's *own* text); (b) this mirrors the parent-bubble precedent at `CardDetailPanel.tsx:459-467`, which wraps `bubble.quote.quote` in `“…”` unconditionally with no inner-quote handling. Example: span `"already quoted"` → `From this move’s text: “"already quoted"”`; span `“curly”` → `From this move’s text: ““curly””`. Visually nested, semantically unambiguous (outer = our attribution frame, inner = the move's own quoting). A test pins this (see Test plan).
- **≤240-char truncation + trailing ellipsis**: `machineObservationPersistenceAdapter.truncate` (`:67-71`) appends a single trailing `…` (U+2026) on overflow (`${span.slice(0, 239)}…`, total 240). The framed string wraps the **entire** (already-truncated) span, so the closing `”` lands **after** the ellipsis: `From this move’s text: “…<239 chars>…”`. This is correct — the ellipsis signals omission inside the quoted excerpt; the closing quote closes the whole excerpt. No special handling needed (the truncation happens before `markToChip`; the model just wraps). There is **no leading ellipsis** (the adapter only adds a trailing one); do not assume one. A test pins the trailing-ellipsis-inside-quotes case.
- **Span contains a hostile/verdict-shaped token** (`astroturfed`, `wrong`, the motivating residual): the framed string **still contains the verbatim token, inside the quotes** — it is NOT dropped or altered (this card is explicitly NOT a scan/suppression change; the ADR Option 0 keeps the span). The doctrine guarantee this card adds is that the **frame copy** (prefix + quote marks + a11y hint) reads as a quotation, never a verdict — so the machine is visibly pointing at the move's own word, not stating it. The ban-list test must therefore target the **frame**, not the rendered string-with-span (see Test plan, critical note).
- **Permission-denied / offline**: N/A — pure display transform of already-loaded data; no network, no fetch, no auth path in scope.
- **Doctrine edge — could the frame ever read as a machine verdict?** "From this move’s text:" + curly quotes is purely attributive; it asserts provenance ("these are the move's words"), not evaluation. The ban-list test pins that the frame contains no verdict token.

---

## Test plan

All tests are pure-model or RTL component tests; no Supabase/network. Counts are estimates.

### Modified existing assertions

- **`__tests__/cardViewRefine.test.tsx`** — the existing test "the evidence span renders inline (≤240 chars carried by the model)" (`:316-322`) uses `toContain('M has a child typed challenge.')`. After the change the rendered text is `From this move’s text: “M has a child typed challenge.”`; the substring is still present, so the assertion **still passes unchanged** — verify, do not edit. Likewise "the classifier zone copy is ban-list clean" (`:358-364`) scans the zone text; the new frame copy + quote marks contain no banned token and the fixture span is clean, so it **still passes** — verify. (Add an explicit `toContain('From this move’s text:')` + `toContain('“')` assertion to one render test to pin the new framing renders.)
- **No test asserts the literal `'Why this fired:'`** anywhere (verified: a repo-wide search finds it only in `cardClassifierStripModel.ts` and the ADR doc). So changing the prefix value breaks no string assertion.

### New tests — `__tests__/cardClassifierProvenance.test.ts` (the `markToChip` unit home; already imports `markToChip`)

- happy path: `markToChip(mark({ evidenceSpan: 'plain excerpt' }))` → `chip.evidenceSpanFramed === 'From this move’s text: “plain excerpt”'`; `chip.evidenceSpan === 'plain excerpt'` (raw unchanged); `chip.isExpandable === true`. (~1 test)
- null span: `evidenceSpan` absent → `evidenceSpanFramed === null`, `isExpandable === false`. (~1)
- **nested-quote edge**: `evidenceSpan: '"already quoted"'` → framed wraps in outer curly quotes, inner straight quotes preserved verbatim (`includes('"already quoted"')` and starts with the frame + `“`, ends with `”`). Repeat for curly inner quotes. (~1)
- **truncation/ellipsis edge**: `evidenceSpan` ending in `…` → framed ends with `…”` (closing quote after the ellipsis); the ellipsis is inside the quotes. (~1)
- **accessibility-label framing**: `chip.accessibilityLabel` ends with `'. Tap to see the quoted text from this move.'` when `isExpandable`; contains no "why this fired"; for a non-span mark the hint is absent. (~1)
- **frame ban-list (doctrine, ADR-mandated)** — CRITICAL that this targets the FRAME, not the span: assert `CARD_CLASSIFIER_EVIDENCE_PREFIX`, the quote constants, and the a11y `spanPhrase` contain none of the banned verdict tokens (`winner/loser/correct/incorrect/true/false/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot` — reuse the `BANNED` list shape from `cardViewRefine.test.tsx:35-39`). Then a focused case: build a chip with `evidenceSpan: 'astroturfed'` (the residual token) and assert (a) the framed string **still contains** `astroturfed` (verbatim quote preserved, not dropped), AND (b) the framed string **minus the quoted span** — i.e. the frame portion — contains no banned token, AND (c) the span is wrapped in `“ ”`. This is the doctrine proof that the frame never reads as a verdict even when quoting a hostile token. (~2 tests)

### New / extended — `__tests__/cardViewRefine.test.tsx` (RTL render)

- render `CardDetailPanel` with a span-bearing fixture; assert the `card-detail-classifier-evidence-*` Text content `toContain('From this move’s text:')` and `toContain('“')`/`toContain('”')`. (~1 test, both inline-wide and stacked branches if cheap)

### New — constant ban-list (if not folded into the provenance file)

- `__tests__/cardClassifierEvidenceFramingBanList.test.ts` (optional, or fold into provenance test): pin `CARD_CLASSIFIER_EVIDENCE_PREFIX` ban-list clean + plain-language (no snake_case via `looksLikeInternalCode`). (~1)

Estimated net new tests: **~7–8**, all additive (test count goes up). Update `docs/core/current-status.md` test count after `npm run test` confirms the new total.

---

## Dependencies (cards / docs / files)

- **Assumes the cross-family list-union ADR (`docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md`) is merged** (it is — main @ `d4a1862`, the ADR is `#580`). This card is that ADR's named Option-3 follow-up and inherits its scope boundaries (display-only; scan layer byte-unchanged).
- **Reads / mirrors** the parent-bubble quotation precedent at `CardDetailPanel.tsx:459-467` (curly `“…”`) — the in-repo grammar this card adopts.
- **Reads** `markToChip` (`cardClassifierStripModel.ts:199-227`) as the single chip-derivation site shared by the capped strip and the hub; the framing lands here so both surfaces inherit it.
- **Reads** `machineObservationPersistenceAdapter.truncate` (`:67-71`) to confirm trailing-ellipsis-only truncation (informs the truncation edge test).
- **Blocks nothing.** No future card depends on this; it is the terminal honesty-sharpening for the residual.

### Finding surfaced during the scope-reality audit (scope item 2)

The ADR enumerated **five** stale "A–G" comments (`CardDetailPanel.tsx:227,302,849`, `cardDetailModel.ts:148,338`). I verified each against the live code:

- All **five are genuinely stale** — confirmed. Both the hub roster (`HUB_NON_PRODUCTION_FAMILIES = ['sensitive_composer']`, `argumentDetailModel.ts:670-671`) and the mapping roster (`PRODUCTION_AG_FAMILIES` is now A–I; `FROZEN_HIJ_FAMILIES = ['sensitive_composer']`, `deployedAgRawKeys.ts:30-52`) are A–I with **only Family J frozen**. Note: `:302` is the **mapping-section** doc (not the hub), so its correction differs from the hub comments — it should describe "A–I roster, J-only frozen," not simply "A–I gated." (My first read mis-assumed `FROZEN_HIJ_FAMILIES` was still `{H,I,J}`, which would have made `:302` accurate; the constant is J-only, so `:302` IS stale. This is exactly why the prompt required verifying the exact current text at each site.)
- **Two additional adjacent stale comments** carry the same misleading framing and were NOT in the named five: `cardMappingSectionModel.ts:26` and `:130` ("A-G-only", "frozen H/I/J family"). Recommend fixing now (comment-only, trivial) or as a one-line follow-up.
- **One additional stale comment in a file already being edited**: `cardClassifierStripModel.ts:310` ("EXPLICIT A–G family gate"). Recommend fixing in this card since the file is already open for scope item 1.

---

## Risks

- **Additive interface field**: adding `evidenceSpanFramed` to `CardClassifierChip` is safe for tests that read individual fields (the ones seen — `cardClassifierProvenance.test.ts` reads `chip.category`, `chip.sourceProvenanceLabel`). Risk only if a test does a full-object `expect(chip).toEqual({ ...entire object... })`. Mitigation: implementer greps `__tests__` for `toEqual(` applied to a `markToChip` / `CardClassifierChip` result and updates if found (none observed in the files inspected).
- **Curly-character correctness**: the quote marks (U+201C/U+201D), the apostrophe in the prefix (U+2019), and the ellipsis (U+2026) are non-ASCII. The implementer must write them as literal Unicode characters (copy the exact pattern from `CardDetailPanel.tsx:465` and `cardClassifierStripModel.ts:87`), not as `\u` escapes that could drift, and ensure no lint rule rejects them (the file already contains U+2019 at `:87`, so it is allowed).
- **Removing the now-unused import**: after the model builds the framed string, `CARD_CLASSIFIER_EVIDENCE_PREFIX` is no longer imported by `CardDetailPanel.tsx`; leaving the import triggers a lint `no-unused-vars` error. Remove it (`:38`).
- **No migration / no deploy**: this is a pure code/copy change. There is no operator deploy step and no Edge/Deno surface, so the Deno suite (1674/0) is untouched and the no-divergence MCP invariants are not in scope.
- **Ban-list test mis-aim**: the single most likely implementer mistake is scanning the rendered string *including the span* for banned tokens and accidentally banning a legitimately-quoted hostile token (which would re-introduce a suppression the ADR explicitly rejected). The Test plan's critical note guards this: the ban-list assertion targets the **frame**, and a dedicated test proves the verbatim hostile token is preserved inside the quotes.

---

## Out of scope

- **Any scan-layer / ban-list change** in `mcp-server/**` (the ADR rejected Options 1 and 2; this card does not catch, drop, or suppress any token).
- **The §10a composer-only / inspect-only suppression** (`cardClassifierStripModel.ts:264-270`, `filterMarksBySurface`) — byte-unchanged.
- **The A–I hub family gate** (`HUB_NON_PRODUCTION_FAMILIES`, `argumentDetailModel.ts:670-688`) and the mapping-section frozen-J gate (`cardMappingSectionModel.ts`) — logic byte-unchanged (only their *comments* are corrected).
- **The soft-paraphrase residual** (regex-clean, model-authored characterization) — explicitly not addressed by the ADR or this card.
- **The node-chip / timeline surface** — it carries no span field (`AnnotationChipDescriptor`); nothing to frame there.
- **Admin health / cutover-alert surfaces** — counts-only; the span text never reaches them.
- **Renaming `CARD_CLASSIFIER_EVIDENCE_PREFIX`** to a new constant name — optional nicety, not required; the design keeps the name and changes only the value + doc.
- **Migrating to straight quotes / a styled quote component** — out of scope; mirror the existing curly-quote string precedent.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks; Observation not allegation):** the new frame "From this move’s text:" + curly quotes is attributive, never evaluative — it asserts the words are the **move's own**, not that they are true/false/winning/losing. The span is unchanged (no suppression, so posting/standing are untouched — score never blocks). The frame ban-list test pins zero verdict tokens in the frame copy. **RESPECTED.**
- **cdiscourse-doctrine §9 (plain language; no internal codes):** the frame is a locked plain-language constant (same convention as the file's existing `CARD_CLASSIFIER_ADVISORY_CAPTION` / `CARD_CLASSIFIER_EMPTY_STATE`), grammatically consistent with the "From …" provenance labels (`:85-92`). No raw classifier code is introduced; a `looksLikeInternalCode` assertion covers it. **RESPECTED.**
- **cdiscourse-doctrine §10a (Observations vs Allegations):** explicit quotation is the §10a posture made visible — an Observation is a structural feature of the move's *own* text; framing it as a marked quote of that text (attached, author's own node) makes that explicit and reduces the risk a quoted hostile token reads as a machine accusation. The span stays verbatim (not mutated). The node-chip span-free path and J's composer-only suppression are untouched. **RESPECTED.**
- **accessibility-targets:** the screen-reader path is fixed in the same single source (`markToChip`): the hint reframes to "Tap to see the quoted text from this move," and the child Text the reader encounters now carries the framed quote. The row stays `accessibilityRole="text"` (non-interactive Observation), so the 44×44 rule does not apply; no color-only signal is added (quotation marks are a textual cue, legible in grayscale). **RESPECTED.**
- **§4 / §5 / §6 / §7 / §8 / §10:** no AI authority/runtime change; `engine.ts` untouched; no secret literal; no provider call; no DB/RLS/migration; no v1-scope feature (voting/search/push/OAuth/public-API). **RESPECTED.**

---

## Operator steps (if any)

**None — pure code/copy change.** No migration (`npx supabase db push`), no function deploy, no env var. After the implementer commits: run `npm run typecheck`, `npm run lint`, `npm run test`, capture the new test count, and update `docs/core/current-status.md`.
