# UX-PR-C — Visible provenance for machine notes

**Status:** Design draft
**Epic:** Accessibility / UX-continuity remediation lane (a11y floor over the Argument Surface Pivot surfaces; sibling to A11Y-693-ASP). Motivated by the 2026-07 UX audit finding **P1-6 (visible provenance)**.
**Release:** Cross-cutting a11y/UX floor. Priority P1 · Effort S · Area: UI + Testing.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/923

> **Scope note:** the caller supplied the verified problem statement (2026-07 UX audit P1-6). This design audits the **two shipped surfaces** named in the issue and specifies a minimal, doctrine-safe visible-provenance affix. No new data model, no migration, no Edge Function, no flag change, no board/scoring change.

---

## Goal

The app's grammar separates **HUMAN moves** from **MACHINE notes** (doctrine §10a: machine-generated labels are *Observations*, rendered "without implying a person made the claim"). Today, on two machine-note surfaces, that provenance is carried **only in `accessibilityLabel`** — so **sighted users get *less* provenance than screen-reader users**, the exact inversion P1-6 flags. This card adds a **fixed visible textual affix** that names the provenance in plain language:

- Derived-signal advisory lines get a leading **"Advisory"** (matches the "Advisory:" prefix already present in every `accessibilityLabel` at `derivedSignalConsumerModel.ts:40-65`).
- The mediator node marker gets a leading **"Note"** (compact form of the "Mediator note:" prefix already present at `MediatorNodeMarker.tsx:44`).

Doctrine constraints that shape the design (`cdiscourse-doctrine`, `accessibility-targets`):
- **§1 / §10a** — the affix names provenance ("this is a machine Observation"), never a verdict, never a truth/strength claim, never a person.
- **"Signals move furniture; they never add furniture"** (the FEEDBACK-002 charter at `derivedSignalConsumerModel.ts:7-8`) — the affix re-labels **existing** text furniture (the line / label `Text`), adds no row, no icon, no interactive surface, no color-coded chrome. It is the minimal furniture increment: one word inside the existing footprint.
- **Color is never the only signal** (`accessibility-targets` §2) — the affix is a *word*; it carries meaning in grayscale. No new hex, no color-only distinction.
- **Screen-reader parity** — the visible affix must not *degrade* the existing SR experience, i.e. no "Advisory. Advisory:" double announcement.

### Chosen treatment (with the principle-#4 alternative evaluated)

**RECOMMENDED: fixed visible textual affix, rendered as chrome (not signal copy).** "Advisory" leads each derived-signal line; "Note" leads the mediator marker. The affix is a separate, accessibility-hidden `<Text>` sibling; the existing sentence/label `Text` and its `accessibilityLabel` are left byte-unchanged.

**Alternative considered — cohesion principle #4 (a dashed/dotted "machine-note" border on every machine note).** Evaluated and **declined for this card** (recommended as a possible separate follow-on, not folded in):
- Larger blast radius — a systemic machine-note border is a `timeline-grammar` token-level change touching *every* machine-note surface, not the two P1-6 surfaces.
- Weaker provenance signal — a dashed border is not self-describing; a sighted user who does not know the convention learns nothing, so it does not actually close P1-6 for the naive reader the way a word does.
- Truth-label risk — a dashed/tentative border reads as "weak / unverified," brushing against the §1 ban on strength/validity signalling on machine notes. A word ("Advisory"/"Note") states provenance without implying standing.
- Furniture cost — a persistent border ring *adds* chrome around each note; the textual affix re-labels existing text. The affix better honors "signals move furniture, never add furniture."

**Recommendation:** ship the textual affix now. If the audit later wants a repo-wide machine-vs-human *visual* convention, design principle #4 as its own `timeline-grammar` card with the truth-label risk explicitly mitigated — do **not** bundle it here.

---

## Data model

**No new data model. No new model field.** The affix is a display-only chrome constant. Deliberately **not** added to `DERIVED_SIGNAL_LINE_COPY` (`derivedSignalConsumerModel.ts:35-66`) nor to `DerivedSignalLine` (`derivedSignalConsumerModel.ts:24-28`), because:
1. It is identical for every code (one word) — per-code model storage adds noise.
2. Keeping it out of the model leaves `derivedSignalConsumerModel.ts` **byte-unchanged**, so all four of its scanners stay green with zero risk (`derivedObservationSignalsBanList.test.ts`, `derivedObservationSignalsZeroNetwork.test.ts`, `derivedSignalConsumerModel.test.ts`, `derivedSignalsFlagOff.test.ts`).
3. The issue's own instruction: "Keep the ban-list-scanned SENTENCE copy pure — the affix is chrome, not signal copy."

The two affix strings live as **exported chrome constants in the two component files** so tests can import and pin the exact value:

```ts
// DerivedSignalAdvisoryLines.tsx
export const DERIVED_SIGNAL_PROVENANCE_AFFIX = 'Advisory';

// MediatorNodeMarker.tsx
export const MEDIATOR_NODE_PROVENANCE_AFFIX = 'Note';
```

---

## File changes

**Modified (2 source files only):**

- `src/features/feedbackFlags/DerivedSignalAdvisoryLines.tsx` — (~+18 lines) add `DERIVED_SIGNAL_PROVENANCE_AFFIX` export; change the per-line render (`:33-43`) so each line is a **row** `[affix Text][sentence Text]`; add `styles.row` + `styles.affix`. The sentence `Text` keeps its `key`, `testID` (`derived-signal-advisory-<code>`), `accessibilityRole="text"`, and `accessibilityLabel` **unchanged**. The affix `Text` is accessibility-hidden. `null`-on-empty (`:30`) is untouched.
- `src/features/mediator/MediatorNodeMarker.tsx` — (~+14 lines) add `MEDIATOR_NODE_PROVENANCE_AFFIX` export; make `styles.wrap` `flexDirection: 'row'` with `alignItems: 'center'` + a small `gap`; render an affix `Text` **before** the existing label `Text` (`:40-47`). The label `Text` keeps `numberOfLines={1}`, `accessibilityRole="text"`, and `accessibilityLabel={`Mediator note: ${label}`}` **unchanged**. The affix `Text` is accessibility-hidden. `null`-on-no-marker / empty-label (`:30`, `:33`) untouched.

**Modified (3 test files):** see Test plan. (~+40 lines total.)

**New files:** none.
**Deleted files:** none.
**NOT changed:** `derivedSignalConsumerModel.ts`, `src/features/arguments/room/ArgumentRoom.tsx` (the mount site), any feature flag, any migration, any Edge Function.

---

## API / interface contracts

No public signature changes. `DerivedSignalAdvisoryLinesProps` (`DerivedSignalAdvisoryLines.tsx:21-24`) and `MediatorNodeMarkerProps` (`MediatorNodeMarker.tsx:20-24`) are unchanged — the mount site (`ArgumentRoom.tsx:3313`, `:3372-3377`) passes the same props, so **no prop plumbing through `ArgumentRoom.tsx` is required**.

Two new exported chrome constants (additive):
- `DERIVED_SIGNAL_PROVENANCE_AFFIX: 'Advisory'`
- `MEDIATOR_NODE_PROVENANCE_AFFIX: 'Note'`

New testIDs (additive):
- `derived-signal-advisory-affix-<code>` on each derived-signal affix `Text`.
- `mediator-node-marker-affix` on the marker affix `Text`.

### Render shape — derived-signal line (target)

```tsx
<View style={styles.wrap} testID={testID ?? 'derived-signal-advisory-lines'}>
  {lines.map((line) => (
    <View key={line.code} style={styles.row}>
      <Text
        style={styles.affix}
        accessibilityElementsHidden           // iOS: drop from a11y tree
        importantForAccessibility="no-hide-descendants"  // Android + RN Web (aria-hidden)
        testID={`derived-signal-advisory-affix-${line.code}`}
      >
        {DERIVED_SIGNAL_PROVENANCE_AFFIX}
      </Text>
      <Text
        style={styles.line}
        accessibilityRole="text"
        accessibilityLabel={line.accessibilityLabel}   // UNCHANGED — already starts "Advisory:"
        testID={`derived-signal-advisory-${line.code}`}
      >
        {line.text}
      </Text>
    </View>
  ))}
</View>
```

`styles.row`: `{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs }` (sentence wraps beside the affix; affix pins to the first line). `styles.affix`: `{ color: SURFACE_TOKENS.textSecondary, fontSize: TYPOGRAPHY.chipLabel.fontSize, lineHeight: TYPOGRAPHY.chipLabel.lineHeight + 3, fontWeight: '700' }` and `styles.line` gets `flex: 1` so it wraps. **No new hex.**

### Render shape — mediator marker (target)

```tsx
<View style={[styles.wrap, marker.isImpasse && styles.wrapImpasse]} testID={...}>
  <Text
    style={styles.affix}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    testID="mediator-node-marker-affix"
  >
    {MEDIATOR_NODE_PROVENANCE_AFFIX}
  </Text>
  <Text
    style={styles.label}
    numberOfLines={1}
    accessibilityRole="text"
    accessibilityLabel={`Mediator note: ${label}`}   // UNCHANGED
  >
    {label}
  </Text>
</View>
```

`styles.wrap` gains `flexDirection: 'row', alignItems: 'center', gap: SPACING.xs`. `styles.affix`: `{ color: SURFACE_TOKENS.textSecondary, fontSize: TYPOGRAPHY.chipLabel.fontSize, fontWeight: '600' }` (visually subordinate to the `fontWeight: '700'` `textPrimary` label). **No new hex.**

---

## Screen-reader correctness (the decisive design point)

**Chosen: keep both `accessibilityLabel`s byte-identical to today, and hide the visible affix from the a11y tree.** Rationale:
- The SR provenance is already correct and shipped — `"Advisory: …"` (`derivedSignalConsumerModel.ts:40-65`) and `"Mediator note: {label}"` (`MediatorNodeMarker.tsx:44`). Changing nothing there means **zero SR regression risk** and no test churn on the existing SR assertions (`DerivedSignalAdvisoryLines.test.tsx:36-41`; `a11y693MediatorBoardAxisGuard.test.tsx:264-268`).
- The visible affix is **pure redundancy** for sighted users. If it were left in the a11y tree it would double-announce ("Advisory. Advisory: a source…"; "Note. Mediator note: Needs evidence"). Marking it `accessibilityElementsHidden={true}` + `importantForAccessibility="no-hide-descendants"` (and giving it **no** `accessibilityLabel`) removes it from the announcement on iOS, Android, and RN Web.

Final announced strings after this card (unchanged from today):
- Derived-signal line: `line.accessibilityLabel` (e.g. `"Advisory: a source on your own move would carry this point further."`).
- Marker: `"Mediator note: " + label` (e.g. `"Mediator note: Needs evidence"`).

The rejected alternative — *restructure so visible affix + sentence compose the announcement* (drop "Advisory:" from `accessibilityLabel` and let the visible affix carry it) — is worse: it forces a model edit to `derivedSignalConsumerModel.ts`, breaks the exact-match SR test (`DerivedSignalAdvisoryLines.test.tsx:40`), and reduces robustness (the affix would have to be a real a11y element in reading order). Do not do this.

---

## Flag-off byte-identity

Confirmed byte-identical when `derived_signals` is OFF:
- `DerivedSignalAdvisoryLines` returns `null` for an empty list (`DerivedSignalAdvisoryLines.tsx:30`). The affix renders **inside** the `lines.map`, so it exists only when a line exists. Flag-off ⇒ `inspectAdvisoryLines` is the frozen empty array (`ArgumentRoom.tsx:1244-1247`, gated on `derivedSignalsEnabled !== true` ⇒ `EMPTY_DERIVED_SIGNALS`, pinned by `derivedSignalsFlagOff.test.ts:79-83`) ⇒ component renders `null` ⇒ no affix.
- `MediatorNodeMarker` returns `null` when `marker` is null or the label is empty (`:30`, `:33`); the mount is gated on `activeNodeMediatorMarker` truthiness (`ArgumentRoom.tsx:3372`). No marker ⇒ no affix.

The affix cannot introduce a stray node into a flag-off / no-marker room.

---

## Test plan

Three existing files updated; **existing assertions all preserved** (the sentence/label `Text` keeps its `testID`, role, and `accessibilityLabel`, so nothing existing breaks). New assertions:

**`__tests__/DerivedSignalAdvisoryLines.test.tsx`**
- Import `DERIVED_SIGNAL_PROVENANCE_AFFIX`; render `[LINE_A, LINE_B]`; assert `getByTestId('derived-signal-advisory-affix-proof_moment')` renders text exactly `'Advisory'` (`=== DERIVED_SIGNAL_PROVENANCE_AFFIX`).
- Assert the affix `Text` is accessibility-hidden: `props.importantForAccessibility === 'no-hide-descendants'` and `props.accessibilityElementsHidden === true`, and it has **no** `accessibilityLabel` (no double announcement).
- Assert the sentence `Text` (`derived-signal-advisory-proof_moment`) still has `accessibilityRole === 'text'` and `accessibilityLabel === LINE_A.accessibilityLabel` (**SR unchanged**).
- Empty list ⇒ `toJSON()` is `null` **and** no affix testID present (byte-identity reaffirmed).

**`__tests__/MediatorNodeMarker.test.tsx`**
- Import `MEDIATOR_NODE_PROVENANCE_AFFIX`; render a `needs_evidence` marker; assert `getByTestId('mediator-node-marker-affix')` renders `'Note'`, and `getByText('Needs evidence')` still resolves (label `Text` intact).
- Assert the label `Text` still has `accessibilityRole === 'text'` and `accessibilityLabel === 'Mediator note: Needs evidence'` (**no double prefix** — assert it does not contain `'Note: Note'` / `/note.*note/i` beyond the single "Mediator note").
- Assert the affix `Text` has no `accessibilityLabel` and is accessibility-hidden.
- Marker `null` ⇒ `toJSON()` null (no affix).
- Extend the existing ban-list loop (`:46-57`) so the rendered affix `'Note'` is included in the `collectText` scan (it is, once rendered): assert no `_forbiddenMediatorTokens()` hit and no `/[a-z]+_[a-z]+/` snake_case.

**`__tests__/derivedSignalConsumerModel.test.ts`** (model boundary regression guard — the file itself is *not* changed, only its test)
- Add a `describe('UX-PR-C — provenance affix is chrome, not signal copy')`:
  - For every code, assert `DERIVED_SIGNAL_LINE_COPY[code].text` does **not** start with `'Advisory'` (the visible sentence stays a plain sentence; the affix lives in the view). This locks the chrome/signal boundary so a future edit cannot smuggle the affix into the ban-scanned model copy.
  - For every code, assert `DERIVED_SIGNAL_LINE_COPY[code].accessibilityLabel` **starts with** `'Advisory:'` (the SR provenance stays at the model level — a positive lock so a future edit cannot silently drop the SR prefix while the visible affix carries it).

**Regression (run, do not edit):** `a11y693MediatorBoardAxisGuard.test.tsx` (renders the marker for all 11 states + source-scans `MediatorNodeMarker.tsx` for red/green hex), `uxMediator002NodeMarkup.test.tsx` (renders the marker, ban-list-scans visible text incl. `'Note'`), `derivedSignalsFlagOff.test.ts`, `derivedObservationSignalsBanList.test.ts`, `derivedObservationSignalsZeroNetwork.test.ts`. All must stay green.

Gates: `npm run typecheck`, `npm run lint`, `npm run test` (capture the `Tests: … passed` line + exit 0). Test count goes **up** (net-new assertions; no deletions).

---

## Scanner-hazard checklist (for the implementer)

Exact scanner scope, verified by reading each scanner:

| File you change | Scanned by | What it enforces | Hazard / action |
|---|---|---|---|
| `MediatorNodeMarker.tsx` | `a11y693MediatorBoardAxisGuard.test.tsx:39-42, 321-328` (source hex-scan) | every `#[0-9a-fA-F]{3,8}` literal in the file must not decode to a red/green verdict color | **`#923`→red gotcha.** `#923` matches the hex regex, expands (3-char path, `hexToRgb` `:161-167`) to `#992233`, classifies **red** (`isRedOrGreenVerdictColor` `:179-186`) ⇒ **test fails.** Any issue reference in a comment MUST read `(issue 923)`, never `#923`, and add **no** new hex (reuse `SURFACE_TOKENS`). |
| `MediatorNodeMarker.tsx` | `a11y693…:302-308, 314-319` | no per-`point.kind` color map, no `STATUS.danger`/`STATUS.success` | affix uses `SURFACE_TOKENS.textSecondary` only — safe. Do not introduce `kindColor`/`STATUS.*`. |
| `MediatorNodeMarker.tsx` | `a11y693…:255-272` | `getByText(marker.label)` resolves; that node's `accessibilityLabel.toContain(marker.label)` | affix must be a **separate sibling** `Text` (never nested into / concatenated with the label `Text`), and the label `Text`'s `accessibilityLabel` must stay `Mediator note: {label}`. |
| `MediatorNodeMarker.tsx` | `MediatorNodeMarker.test.tsx:46-57`, `uxMediator002NodeMarkup.test.tsx:307-338` | rendered visible text: no `_forbiddenMediatorTokens()`, no `/[a-z]+_[a-z]+/` snake_case | `'Note'` is safe — `_forbiddenMediatorTokens()` (`mediatorPlainLanguage.ts:243-...`) contains neither `note` nor `advisory` nor `mediator`; `'Note'` has no underscore. |
| `DerivedSignalAdvisoryLines.tsx` | `DerivedSignalAdvisoryLines.test.tsx`, `derivedSignalsFlagOff.test.ts:39-43` (no `featureFlags` import) | sentence `Text` keeps testID/role/label; null-on-empty; no flag read | keep the sentence `Text` untouched; do not import `featureFlags`. `'Advisory'` is already in every scanned `accessibilityLabel` and passes `_forbiddenVerdictTokens()` today ⇒ safe. |
| `derivedSignalConsumerModel.ts` | `derivedObservationSignalsBanList/ZeroNetwork/ConsumerModel/FlagOff` | copy value-scan (no underscore, no verdict token, no raw code); zero-network; no side effects | **Do not edit this file.** Leaving it byte-unchanged is the reason all four scanners stay green with zero risk. |
| `ArgumentRoom.tsx` (mount site) | `uxOneOneTwoDoctrine.test.ts:29-54` (STRING_RE apostrophe-parity + verdict + security), `uxMediator002NodeMarkup.test.tsx:92-166` (mount-tree source-scan) | apostrophe-parity quote scan; mount-tree regex shapes | **Do not edit `ArgumentRoom.tsx`** (this card needs no change there). *If* an edit becomes necessary: keep all added comments **apostrophe-free** (the `STRING_RE` at `:84` treats a lone `'` in a comment as a string open and poisons the whole file), and preserve every mount-tree regex the mediator test asserts. |

Note on the STRING_RE apostrophe gotcha: it lives in `uxOneOneTwoDoctrine.test.ts`, whose file list (`:29-54`) covers `ArgumentRoom.tsx` but **not** the three card files — so it does not scan `MediatorNodeMarker.tsx` / `DerivedSignalAdvisoryLines.tsx` / `derivedSignalConsumerModel.ts`. Keeping comments apostrophe-free in the two changed component files remains a cheap defensive convention (matching their existing headers, e.g. `derivedSignalConsumerModel.ts:15`), but the only *scanner-enforced* apostrophe risk is on `ArgumentRoom.tsx`, which this card does not touch.

---

## Edge cases

- **Empty / no signal:** component returns `null` (both surfaces) ⇒ no affix. Covered.
- **Multiple lines:** each row renders its own affix; de-dup by code is already done upstream (`derivedSignalConsumerModel.ts:100-108`). Affix is identical per row by design.
- **Long marker label + `numberOfLines={1}`:** the affix consumes ~4 characters of width; the label keeps `numberOfLines={1}` and truncates as before. Layout risk noted below (Risks).
- **Reduce motion:** no animation added; nothing to gate.
- **`structured_impasse` marker (`isImpasse`):** the left-rule geometry (`MediatorNodeMarker.tsx:64-67`) is preserved; the affix sits inside the pill after the left rule. Verify visually.
- **Screen reader:** affix hidden ⇒ single announcement (see SR section).
- **Doctrine edge — "does the affix imply strength/truth?"** No. "Advisory"/"Note" name provenance (machine Observation), not standing. The strength band / score is untouched; the affix adds no verdict.
- **Doctrine edge — "does heat/popularity leak in?"** No. The affix is a static provenance word, independent of any signal value.

---

## Dependencies (cards / docs / files)

- Assumes **FEEDBACK-002** (#899) is complete — it ships `DerivedSignalAdvisoryLines.tsx`, `derivedSignalConsumerModel.ts`, and the `derived_signals` flag plumbing this card decorates.
- Assumes **UX-MEDIATOR-002** is complete — it ships `MediatorNodeMarker.tsx` and the node-marker mount.
- Reads (does not change) the mount site `ArgumentRoom.tsx:3313` and `:3372-3377`, and the mediator marker selection `getNodeMediatorMarker` (unchanged).
- Sibling of **A11Y-693-ASP** (`docs/designs/A11Y-693-ASP.md`) — same a11y-floor lane; this card does not touch the board-axis guard, but the guard *scans the marker source* so this card must respect it (see checklist).
- Blocks nothing; it is a leaf remediation.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `#923` written in a `MediatorNodeMarker.tsx` comment ⇒ decodes to red ⇒ `a11y693` fails | Medium (natural to write) | Checklist mandates `(issue 923)`; reviewer greps the diff for `#[0-9a-fA-F]{3,8}` in the marker file. |
| Affix nested into the marker label `Text` ⇒ `getByText(label)` returns the wrong node ⇒ `a11y693:264-268` fails | Medium | Design mandates a **separate sibling** `Text`; test explicitly asserts the label `Text` still carries role + label. |
| Marker affix contrast against `SURFACE_TOKENS.raised` (`#162033`) at 11px | Low–Medium | `textSecondary` (`#94a3b8`) is ~5.2:1 vs elevated; verify ≥4.5:1 vs `raised` (small text). If borderline, use `textPrimary` at `fontWeight:'600'` to differentiate from the `'700'` label — still no new hex. Flag in QA. |
| Affix widens the compact node pill and truncates the label sooner | Low | `label` keeps `numberOfLines={1}`; "Note" is 4 chars; verify on 390px viewport. If tight, operator may prefer no marker affix (open question below). |
| Editing `ArgumentRoom.tsx` unnecessarily and tripping STRING_RE / mount-tree scans | Low | Design requires **no** `ArgumentRoom.tsx` change; reviewer confirms the diff excludes it. |
| SR double announcement if affix not hidden | Low | `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` + no `accessibilityLabel`; test asserts all three. |

---

## Out of scope

- The **sentence / label copy** in `DERIVED_SIGNAL_LINE_COPY` and the mediator plain-language vocabulary (untouched).
- The **mediator board, scoring, point standing, disagreement axes** (untouched; this is presentational).
- **Principle #4 dashed/dotted machine-note border** (evaluated; recommended as a separate `timeline-grammar` follow-on, not built here).
- Any **feature flag** change (`derived_signals`, mediator flags) — no flip, no gate change.
- Any **other machine-note surface** (e.g. `DisagreementPointsRail`, `NodeLabelStrip`, proof/receipt chips). P1-6 named these two surfaces; extending the affix convention repo-wide is a follow-on.
- **`ArgumentRoom.tsx`**, Edge Functions, migrations, Supabase, AI calls.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the affix is a provenance word ("Advisory"/"Note"), never winner/loser/true/false/correct; it adds no verdict, no gate, no submit. `_forbiddenVerdictTokens()` and `_forbiddenMediatorTokens()` contain neither word; "Advisory" already passes the derived-signal ban list today.
- **§2 (heat ≠ truth) / §3 (popularity ≠ evidence):** the affix is static provenance, independent of any signal value or engagement.
- **§4 (AI moderator limits):** presentational only; no AI call, no authoritative flag, no client AI.
- **§6 / §7 (secrets / no AI in prod):** no secrets, no provider import; the `uxOneOneTwoDoctrine` security patterns apply only to `ArgumentRoom.tsx`, which is untouched.
- **§9 (plain language):** "Advisory"/"Note" are plain English; no internal code leaks (the affix is not a code; the model copy that *is* code-mapped is untouched).
- **§10a (Observations vs Allegations):** this is the doctrine the card **serves** — it makes the *machine Observation* provenance visible to sighted users without implying a person authored it. The affix names machine provenance ("Note" = mediator Observation; "Advisory" = derived Observation), never a user allegation, never intent.
- **accessibility-targets §2 (color independence):** the affix is a word (grayscale-legible); no new color, no color-only meaning. §3 (text in `<Text>`): satisfied. §4: the affix is non-interactive `role=text`/hidden; the interactive caret beside the marker (`ArgumentRoom.tsx`) is unchanged and keeps its 44×44 target. **SR contract:** no double announcement (affix hidden; existing labels unchanged).

---

## Operator steps (if any)

None — pure client-side code change. No `supabase db push`, no `functions deploy`, no env var, no flag flip. Ships behind the existing `derived_signals` flag (derived-signal surface) and the existing mediator marker mount; both already live per the ASP program.

---

## Reviewer one-paragraph summary

UX-PR-C makes machine-note provenance **visible** on exactly two surfaces by adding a fixed, accessibility-hidden textual affix — **"Advisory"** leading each derived-signal advisory line (`DerivedSignalAdvisoryLines.tsx`) and **"Note"** leading the mediator node marker (`MediatorNodeMarker.tsx`) — as a **separate sibling `Text`** rendered from an exported chrome constant, with **every existing `accessibilityLabel` left byte-unchanged** so there is no screen-reader double announcement and no SR regression. It touches **two source files** (no `derivedSignalConsumerModel.ts` edit, no `ArgumentRoom.tsx` edit, no model field, no flag, no migration) and **three test files** (new assertions pinning the visible affix, the unchanged SR labels, the affix being a11y-hidden, and the chrome-vs-signal boundary). A correct implementation: (1) never nests the affix into the marker's label `Text` (so `a11y693:264-268` `getByText(label)` still resolves), (2) writes any issue reference in `MediatorNodeMarker.tsx` as `(issue 923)` never `#923` (the `#[0-9a-fA-F]{3,8}` red-hex gotcha), (3) adds **no new hex** (reuses `SURFACE_TOKENS.textSecondary`), (4) renders the affix only when a line/marker renders (flag-off / no-marker rooms stay byte-identical), and (5) leaves all six regression scanners green.

**Open question for the operator:** confirm the marker's visible affix wording — compact **"Note"** (recommended, space-constrained pill) vs. the fuller **"Mediator note"** that matches the SR label verbatim. Default in this design is "Note".
