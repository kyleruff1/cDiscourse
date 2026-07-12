# UX-PR-D — Cohesion contract doc + ratchet guards

**Status:** Design draft
**Epic:** UX Continuity Audit remediation / design-system cohesion (cross-cutting) — the audit's item **P1-1 / PR-D** ("the ratchet lands before the repaint", `UX_COHESION_AND_MISSION_REVIEW.md` §9 commitment 8)
**Release:** UX Continuity 2026-07 remediation wave (ships FIRST, ahead of the migration PRs P2-2 / P1-7 / P2-9 so eras stop multiplying during migration)
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/925

> Source of truth for every claim below: `docs/audits/ux-continuity-2026-07/UX_COHESION_AND_MISSION_REVIEW.md` on branch `origin/docs/ux-continuity-audit-2026-07` (NOT on main). Read it with
> `git show origin/docs/ux-continuity-audit-2026-07:docs/audits/ux-continuity-2026-07/UX_COHESION_AND_MISSION_REVIEW.md`.
> Cited as **COHESION §N** throughout. Production-file citations are `path:line` and were grep-verified in this worktree at base `origin/main @ 6aaea78f`.

---

## Goal (one paragraph)

PR-D is a **docs + guard-tests-only card — ZERO production source change.** It ships two things: (1) `docs/design-cohesion-principles.md`, the ratified statement of the 12 cohesion principles + the one state principle from COHESION §8, each tied to its evidence anchor and its §9 commitment, naming **Era A ("calm slate console with kind-color spines" inside a warm brand shell) as canonical**; and (2) three **source-scan ratchet guards** for principles #2 (tokens by reference), #3 (provenance visible), and #9 (red = app failure only). The doctrine that shapes the whole design (cdiscourse-doctrine §1/§9, and the mission's non-negotiable that machine-derived text must never read as the app's verdict) is exactly what principles #3 and #9 encode. The **critical constraint**: the audit found the current tree still violates #2 (~1,169 hex literals; Era-A′ files hardcode hex — COHESION §2) and #9 (gallery maroon, flag red, legacy `counter` red, the standing-band red→green gradient — COHESION §6). Those fixes are scheduled for LATER PRs (P2-2, P1-7, P2-9). Therefore each guard is a **ratchet, not an absolute ban**: it must **PASS on the current tree today** (proven below by running the exact scan) and **FIRE on a freshly-seeded violation** (a firing control mirroring `__tests__/componentsDarkThemeGuard.test.ts`). A naive "ban all violations" guard that reddened CI immediately would be a defect.

**Cannot-proceed check:** none. The card is well-specified and doctrine-aligned. It adds guardrails only; it changes no product behavior, no tokens, no palette. Proceed.

---

## Data model

**No new data model.** No types, no SQL, no schema. The guards operate on file text via `fs.readFileSync`; the principles doc is prose + one table.

---

## File changes

New files only (3 test files + 1 doc). No modified, no deleted production files.

- **new** `docs/design-cohesion-principles.md` — the ratified 12 + 1 principles, Era-A canonical statement, `useMyCircles` documented exception, per-principle burn-down mapping. ~180–240 lines. Structure spec in **Deliverable 1** below.
- **new** `__tests__/cohesionPrinciple2Guard.test.ts` — tokens-by-reference ratchet over a grep-verified clean-set of 4 Era-A files. ~90–130 lines / ~6–8 `it`s. Spec in **Deliverable 2 → Guard #2**.
- **new** `__tests__/cohesionPrinciple3Guard.test.tsx` — provenance-visible ratchet over the two PR-C affix surfaces. ~110–150 lines / ~7–9 `it`s. Spec in **Guard #3**.
- **new** `__tests__/cohesionPrinciple9Guard.test.ts` — red-is-app-failure ratchet over 6 content-state files with a documented allowlist. ~140–190 lines / ~9–11 `it`s. Spec in **Guard #9**.

**Blast radius:** `docs/**` + `__tests__/**` only. No file under `src/`, `app/`, `supabase/` is touched. Test count goes UP by ~22–28 (3 new suites). No production render changes → no snapshot churn.

---

## Deliverable 1 — `docs/design-cohesion-principles.md` (transcribe, do not invent)

The implementer **transcribes** from COHESION §8 and §9; they do not author new principles. Keep every path:line citation. Required structure:

### §0 Front matter
- Title: `# CDiscourse design-cohesion principles`
- One-line purpose: the ratified design contract; the ratchet that lands before the repaint (COHESION §9.8).
- Source line: "Derived from `UX_COHESION_AND_MISSION_REVIEW.md` §8–§9 (audit branch `docs/ux-continuity-audit-2026-07`). This doc is the on-`main` home of that contract."
- Guard pointer: "Principles #2, #3, #9 are enforced by source-scan ratchet tests: `__tests__/cohesionPrinciple2Guard.test.ts`, `cohesionPrinciple3Guard.test.tsx`, `cohesionPrinciple9Guard.test.ts`."

### §1 The canonical language
One short section stating, verbatim from COHESION §2/§9.1:
- The implicit language name: **"calm slate console with kind-color spines" inside a warm brand shell** (anchor `designTokens.ts:2-21`; `TIMELINE_KIND_COLORS argumentGameSurfaceModel.ts:824-832`).
- **Era A is canonical.** Everything user-facing converges on the token-referenced slate console. Era A′ migrates mechanically (P2-2); Era C is deprecated post-bake (P3-3); Era D stays sanctioned strictly inside `admin/` with a fontSize guard at the boundary (P2-6). (COHESION §2 era table, §9.1.)
- The two-zone shell (Era B) is **unratified**; the decision itself (`#08060F`-everywhere vs a formal identity-zone/work-zone model, P3-1) is SUBJECTIVE DESIGN DIRECTION and is deferred, but must be decided — recorded here so it is not forgotten (COHESION §9.2).

### §2 The 12 cohesion principles (one row each)
Transcribe COHESION §8's table, one subsection per principle. For each: **the principle statement**, **evidence anchor(s)** (path:line), **the §9 commitment line it serves**, and **guard status** (source-scan / none). Reproduce exactly:

| # | Principle | Evidence anchor | Guard | §9 commitment |
|---|---|---|---|---|
| 1 | One black, one elevation ladder | `App.tsx:1731` vs `RoomBoardLayout.tsx:165` | — | §9.2 ratify/collapse two-zone shell |
| 2 | Tokens by reference, never matching literals | `RingsideCard.tsx:416-517` (the A′ counter-example) | **source-scan** | §9.1 Era A canonical |
| 3 | Provenance must be visible, not only audible | `derivedSignalConsumerModel.ts:40` VERIFIED; `MediatorNodeMarker.tsx:44` | **source-scan** | §9.3 provenance is visible grammar |
| 4 | Dashed/dotted = owed or provisional; solid = standing fact | `ReceiptChip.tsx:91`; `RingsideCard.tsx:483` | — | §9.3 (extend the named rule to "derived") |
| 5 | Body is the largest, quietest type; chrome may be small or bold, never both | `RingsideCard.tsx:434,451` | — | §9.4 argument text is protagonist |
| 6 | A reading measure (~640-720px) on wide web | `RoomBoardLayout.tsx:175` | — | §9.4 |
| 7 | One verb per intent; kind labels are grammar, not verbs | `gameCopy.ts:40` vs `:1180` | — | §9.6 one vocabulary, derived once |
| 8 | A chrome budget per card — generalize the mediator one-chip-per-node rule | `ArgumentRoom.tsx:3253-3267` | — | §9.4 |
| 9 | Red means app failure, never content state | `ConversationGalleryScreen.tsx:790` vs the mediator ban (`a11y693MediatorBoardAxisGuard`) | **source-scan** | §9.5 red reserved for app failure |
| 10 | Current-vs-historical is ambient, not just a slot notice | `RoomSettledNotice.tsx:57`; `TimestampMarker.tsx:68` (good pattern) | — | §9.7 screens tell the truth about state |
| 11 | Two fidelities per concept max, both documented | `RingsideCard.tsx:268` vs `ProofChip.tsx:39` | — | §9.1 |
| 12 | Every capability reachable from both lenses via the same action codes | `roomCapabilityParity.ts` (already binding, keep) | — | §9.6 |

### §3 The state principle (the "+1")
Transcribe COHESION §8's state principle:
- Hooks return `{data, loading, error, refetch}`; screens render **banner-over-stale-content, never silent-empty**. Template: `BooleanFeedbackBar.tsx:151-176` (write path). Anti-pattern: `ArgumentHome.tsx:206-217`.
- Commitment: §9.7 (hedge copy renders only when the hedge is real).
- **Documented by-design exception (record explicitly so the P1-2 family fix neither misses nor "fixes" it):** `useMyCircles.ts:10,40-44` is an intentional silent-failure hook — `error` stays `null` by construction (verified this worktree: header comment lines 8-13 "Circles are an accelerator, never a gate… `error` stays `null` by construction"; the `setState` at 40-44 hardcodes `error: null`). Circles are an accelerator, never a gate; a failed read yields no circle chips, not a blocking error. This exception carries a **by-design tag** in the family census. (COHESION §8, critic gap #1.)

### §4 The ratchet and its burn-down map
State that PR-D ships the doc + the three guards FIRST (COHESION §9.8), and that the still-open debts each have a scheduled burn-down PR:

| Principle | Current known debt (still open) | Burn-down PR |
|---|---|---|
| #2 | ~1,169 hex literals; Era A′ files hardcode hex (`RingsideCard.tsx`, `ConversationGalleryScreen.tsx`, `RoomBoardLayout.tsx:165`, `TimestampMarker.tsx:125`) | **P2-2** (Era A′ token migration; byte-identical-render verification) |
| #3 | closed for the two named surfaces by **PR-C** (issue 923 — the visible affix). Extend "dashed/dotted = provisional/owed" to cover "derived" | **P1-5 + P2-11** (extend the named rule) |
| #9 | gallery maroon `#7f1d1d`, `#fecaca`; flag `#ef4444`; tone-hostile `#dc2626`; standing-band `#b91c1c` red→green gradient (dup'd in 3 places); legacy `counter` `#ef4444` | **P1-7** (dedupe now + re-ramp off red/green — doctrine-gated, operator ruling required) and **P2-9** (gallery re-tone) |

### §5 What already serves the mission (do not regress)
Short bullet list transcribed from COHESION §7 (the obligation-vs-possession dashed/dotted grammar; verdict-token ban-lists with test guards; advisory-never-gates; marker tombstones; body-text hierarchy; the capability-parity contract). Included so the migration PRs do not flatten the assets.

---

## Deliverable 2 — the three ratchet guards

Common shape (mirrors `componentsDarkThemeGuard.test.ts`): pure-TS scanners over an **explicit, small SCAN_SET of production files** (never a whole-tree walk — the tree has ~1,169 hexes and would fire everywhere). Each guard has: (a) the real scan asserting `[]` offenders on today's tree, (b) a **firing negative control** proving the guard bites, (c) a **must-not-fire control** proving no false positives. All helpers are self-contained (no import from production); comments are **apostrophe-free** (uxOneOneTwoDoctrine hazard — see checklist).

### Shared helper (define once per file, do not share a module — keep each guard standalone)

```ts
// Every quoted color-hex literal in source (RN colors are ALWAYS quoted string
// literals, so quote-anchoring cleanly excludes GitHub issue-ref comments like
// "// CARD (#901)" that are hex-shaped but not colors). 3-8 digits catches
// #rgb / #rgba / #rrggbb / #rrggbbaa. Returned lowercased, quote stripped.
function quotedColorHex(source: string): string[] {
  const m = source.match(/['"`]#[0-9a-fA-F]{3,8}\b/g) ?? [];
  return m.map((x) => x.slice(1).toLowerCase());
}
```

---

### Guard #2 — `__tests__/cohesionPrinciple2Guard.test.ts` (tokens by reference)

**What it asserts:** a curated set of already-clean Era-A canonical files contains **zero quoted color-hex literals** → any new hardcoded hex in a protected file fires. It does **not** scan the A′-debt files (those are P2-2).

**SCAN_SET (all four grep-verified raw-color-hex-free TODAY):**
```ts
const SCAN_SET_P2 = [
  'src/features/home/ArgumentCard.tsx',        // Era A — COHESION §2 exemplar
  'src/features/mediator/MediatorNodeMarker.tsx', // Era A — COHESION §2 exemplar (also a #3 surface)
  'src/features/proof/ProofDrawer.tsx',        // Era A — COHESION §2 exemplar
  'src/features/admin/AdminArgumentsTab.tsx',  // Era D console — color-clean; COLOR-hex only, NOT fontSize
] as const;
```
> Scope note: `AdminArgumentsTab.tsx` is Era D (ops-console density, sanctioned per §9.1). It is included because it is **color-token-clean**; this guard bans **color hex only**, it says nothing about the sanctioned sub-10px fontSize (that is P2-6's guard). Do not conflate.

**Mechanism:** for each file, `expect(quotedColorHex(readFileSync(file))).toEqual([])`.

**PASS-on-current-tree evidence (run in this worktree @ `6aaea78f`):**
```
src/features/home/ArgumentCard.tsx        => 0 quoted color-hex   (0 rgb/rgba)
src/features/mediator/MediatorNodeMarker.tsx => 0 quoted color-hex (0 rgb/rgba)
src/features/proof/ProofDrawer.tsx        => 0 quoted color-hex   (0 rgb/rgba)
src/features/admin/AdminArgumentsTab.tsx  => 0 quoted color-hex   (0 rgb/rgba)
```
(The hex-shaped tokens present in these files — `#874`, `#889`, `#901`, `#514`, … — are all GitHub issue-refs in comments, e.g. `// INTEL-002 (#901) — the specificity KPI`. They are UNQUOTED, so `quotedColorHex` ignores them.)

**Counter-example proving the guard is meaningful (why the A′ files are excluded):** `RingsideCard.tsx` (Era A′, scheduled P2-2) has **27** quoted color hex (`'#4338ca'`, `'#1e293b'`, `'#0b1220'`, `'#6366f1'`, …). It is deliberately NOT in SCAN_SET.

**Firing negative control:**
```ts
expect(quotedColorHex(`backgroundColor: '#0b1220'`)).toEqual(['#0b1220']);
expect(quotedColorHex(`color: "#fff"`)).toEqual(['#fff']);
```

**Must-NOT-fire control (no false positives):**
```ts
expect(quotedColorHex(`// INTEL-002 (#901) - KPI derivation`)).toEqual([]); // issue-ref comment
expect(quotedColorHex(`color: SURFACE_TOKENS.textPrimary`)).toEqual([]);     // token reference
expect(quotedColorHex(`// preserving the #654 intent`)).toEqual([]);          // issue-ref comment
```

**Sanity test:** assert `SCAN_SET_P2` contains all four named files (mirrors the PR-A "scan set covers every target" sanity test).

---

### Guard #3 — `__tests__/cohesionPrinciple3Guard.test.tsx` (provenance visible)

**What it asserts:** the two machine-note surfaces still carry the PR-C **visible provenance affix** rendered as an **accessibility-hidden sibling** next to the human-readable label. Passes post-PR-C (PR-C, issue 923, is merged into this base); fires if either affix is removed or un-hidden.

**Confirmed on this base (both constants exist):**
- `src/features/feedbackFlags/DerivedSignalAdvisoryLines.tsx:30` → `export const DERIVED_SIGNAL_PROVENANCE_AFFIX = 'Advisory';`, rendered at `:52` inside a `<Text accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" testID={\`derived-signal-advisory-affix-${line.code}\`}>` sibling to the labeled line `<Text>` (`:54-61`).
- `src/features/mediator/MediatorNodeMarker.tsx:28` → `export const MEDIATOR_NODE_PROVENANCE_AFFIX = 'Mediator note';`, rendered at `:56` inside a `<Text accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" testID="mediator-node-marker-affix">` sibling to the labeled `<Text>` (`:58-65`).

**Mechanism — two legs (both cheap; include both to double-lock):**

*Leg A — source-scan (catches deletion of the constant or the a11y-hidden attribute):*
```ts
const DERIVED_SRC = readFileSync('src/features/feedbackFlags/DerivedSignalAdvisoryLines.tsx','utf8');
const MARKER_SRC  = readFileSync('src/features/mediator/MediatorNodeMarker.tsx','utf8');
// constant declared + rendered + hidden
expect(DERIVED_SRC).toMatch(/export const DERIVED_SIGNAL_PROVENANCE_AFFIX\s*=/);
expect(DERIVED_SRC).toContain('{DERIVED_SIGNAL_PROVENANCE_AFFIX}');
expect(DERIVED_SRC).toContain('accessibilityElementsHidden');
expect(MARKER_SRC).toMatch(/export const MEDIATOR_NODE_PROVENANCE_AFFIX\s*=/);
expect(MARKER_SRC).toContain('{MEDIATOR_NODE_PROVENANCE_AFFIX}');
expect(MARKER_SRC).toContain('accessibilityElementsHidden');
```

*Leg B — render assertion (mirrors `a11y693MediatorBoardAxisGuard.test.tsx`; proves "rendered as an a11y-hidden sibling", not just present in source):* import the two components + their exported affix constants; render each with a minimal fixture; locate the affix node by testID and assert it is hidden AND shows the constant, and that a visible labeled sibling exists.
```ts
// MediatorNodeMarker
const { getByTestId, getByText } = render(
  <MediatorNodeMarker marker={{ nodeId:'n1', code:'open', label:'Needs evidence', isImpasse:false }} />
);
const affix = getByTestId('mediator-node-marker-affix');
expect(affix.props.accessibilityElementsHidden).toBe(true);
expect(affix.props.children).toBe(MEDIATOR_NODE_PROVENANCE_AFFIX);   // visible affix text
getByText('Needs evidence');                                        // the labeled sibling renders
// DerivedSignalAdvisoryLines
const lines = [{ code:'topic_fit', text:'This may drift off the resolution.', accessibilityLabel:'Advisory: this may drift off the resolution.' }];
const r2 = render(<DerivedSignalAdvisoryLines lines={lines} />);
const affix2 = r2.getByTestId('derived-signal-advisory-affix-topic_fit');
expect(affix2.props.accessibilityElementsHidden).toBe(true);
expect(affix2.props.children).toBe(DERIVED_SIGNAL_PROVENANCE_AFFIX);
```
> Fixture note: use a real `DerivedSignalLine` shape (`code`, `text`, `accessibilityLabel`) from `derivedSignalConsumerModel`; the marker fixture is a `NodeMediatorMarker`. Reuse the shapes visible in `a11y693MediatorBoardAxisGuard.test.tsx` and the component files. Do NOT hardcode any signal copy — the fixtures carry their own text.

**Firing negative control:** define a local `assertHiddenAffix(node, expected)` that throws when `node.props.accessibilityElementsHidden !== true` OR `node.props.children !== expected`; prove it throws on `{ props: { children: 'x', accessibilityElementsHidden: false } }` (affix un-hidden) and on `{ props: { accessibilityElementsHidden: true } }` (affix text missing).

**Must-NOT-fire control:** `assertHiddenAffix({ props: { children: 'Advisory', accessibilityElementsHidden: true } }, 'Advisory')` does not throw.

---

### Guard #9 — `__tests__/cohesionPrinciple9Guard.test.ts` (red = app failure only)

**What it asserts:** no **red-family** color hex in a **defined content-state file set** outside an **explicit documented allowlist** of today's known reds. A NEW red hex in a scanned file, outside the allowlist, fires. Orange/amber/rust "heat" colors do NOT fire (they are a separate tone concern, P2-9 re-tone, not a #9 red-failure concern).

**"Red-family" defined precisely (a hue test — mirrors the `hexToRgb` + verdict-color classifier in `a11y693MediatorBoardAxisGuard.test.tsx:160-186`, narrowed to red-only):**
```ts
function isRedFamily(hex: string): boolean {
  const c = hexToRgb(hex); if (!c) return false;          // reuse a11y693's hexToRgb
  const { r, g, b } = c;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let H = 0;
  if (d !== 0) {
    if (max === r) H = 60 * (((g - b) / d) % 6);
    else if (max === g) H = 60 * ((b - r) / d + 2);
    else H = 60 * ((r - g) / d + 4);
  }
  if (H < 0) H += 360;
  const sat = max === 0 ? 0 : d / max;
  const nearRed = H <= 12 || H >= 348;                    // within 12deg of pure red (0deg)
  return nearRed && sat >= 0.15 && max >= 80;             // saturated + bright enough (excludes near-gray)
}
```
Why this rule: it is the simplest defensible rule that admits exactly the named offenders and rejects the heat/warn family. Verified hues (computed in this worktree): crimson reds `#7f1d1d`/`#dc2626`/`#ef4444`/`#b91c1c` = hue 0°, and light-red `#fecaca` = hue 0° sat 0.20 → all IN; orange/rust `#7c2d12`/`#9a3412`/`#78350f` (15–22°), amber `#f59e0b`/`#f97316`/`#facc15` (25–48°), magenta `#ec4899` (330°), purple/teal/green/slate → all OUT. (The `sat >= 0.15` floor is what keeps light-red `#fecaca` in-scope while excluding near-gray; document this choice next to the constant.)

**SCAN_SET (6 content-state files — the COHESION §6 red-doctrine offenders):**
```ts
const SCAN_SET_P9 = [
  'src/features/debates/ConversationGalleryScreen.tsx',
  'src/features/arguments/argumentGameSurfaceModel.ts',
  'src/features/arguments/argumentScoreModel.ts',
  'src/features/arguments/ArgumentScoreTracker.tsx',
  'src/features/arguments/ArgumentTimelineNode.tsx',
  'src/features/arguments/ArgumentTrack.tsx',
] as const;
```

**ALLOWLIST (per-file — grep-verified COMPLETE below; each entry tagged with burn-down PR + role). A per-file map, not a flat set, so a known red appearing in a NEW file scope still fires:**
```ts
const ALLOWLIST_P9: Record<string, readonly string[]> = {
  // gallery: #7f1d1d/#fecaca serve BOTH a legit errorBanner/errorText (app-failure
  //   red - correct per #9, KEEP) AND a content misuse (overheated heat pill :135,
  //   signalChipCritical :822) - burn down the misuse in P2-9. Same hex, two roles;
  //   a hex-literal scan cannot separate them, so both are allowlisted.
  'src/features/debates/ConversationGalleryScreen.tsx': ['#7f1d1d', '#fecaca'],   // P2-9 (misuse) / KEEP (error surface)
  // flag kind :830 (#ef4444), standing-band gradient :840 (#b91c1c), tone-hostile :855 (#dc2626) - P1-7
  'src/features/arguments/argumentGameSurfaceModel.ts': ['#ef4444', '#b91c1c', '#dc2626'], // P1-7
  'src/features/arguments/argumentScoreModel.ts': ['#b91c1c'],        // standing-band dup :50 - P1-7
  'src/features/arguments/ArgumentScoreTracker.tsx': ['#b91c1c'],     // inline sparkline ternary :69 - P1-7
  'src/features/arguments/ArgumentTimelineNode.tsx': ['#ef4444'],     // legacy TRACK_COLORS counter :16 - P1-7 (Era C, also P3-3)
  'src/features/arguments/ArgumentTrack.tsx': ['#ef4444'],            // legacy TRACK_ACCENT counter :21 - P1-7 (Era C, also P3-3)
};
```

**Mechanism:** for each file, `offenders = quotedColorHex(src).filter(isRedFamily)` deduped, minus `ALLOWLIST_P9[file]`; `expect(offenders).toEqual([])`.

**PASS-on-current-tree evidence (full guard simulation run in this worktree @ `6aaea78f`):**
```
ConversationGalleryScreen.tsx  reds: #7f1d1d, #fecaca            allow: #7f1d1d, #fecaca            OFFENDERS: [] PASS
argumentGameSurfaceModel.ts    reds: #ef4444, #b91c1c, #dc2626   allow: #ef4444, #b91c1c, #dc2626   OFFENDERS: [] PASS
argumentScoreModel.ts          reds: #b91c1c                     allow: #b91c1c                     OFFENDERS: [] PASS
ArgumentScoreTracker.tsx       reds: #b91c1c                     allow: #b91c1c                     OFFENDERS: [] PASS
ArgumentTimelineNode.tsx       reds: #ef4444                     allow: #ef4444                     OFFENDERS: [] PASS
ArgumentTrack.tsx              reds: #ef4444                     allow: #ef4444                     OFFENDERS: [] PASS
=== GUARD #9 pass-on-current-tree: PASS (all offenders empty)
```

**Firing negative control:**
```ts
expect(quotedColorHex(`chip: '#ff0000'`).filter(isRedFamily)).toEqual(['#ff0000']);  // new pure red fires
// and end-to-end: a red not in the file's allowlist is an offender
expect(offendersFor('src/features/arguments/argumentScoreModel.ts', `x: '#7f1d1d'`)).toEqual(['#7f1d1d']);
expect(isRedFamily('#dc2626')).toBe(true);
```

**Must-NOT-fire control:**
```ts
expect(quotedColorHex(`pill: '#f97316'`).filter(isRedFamily)).toEqual([]);  // orange heat pill - NOT red
expect(isRedFamily('#f59e0b')).toBe(false);  // amber
expect(isRedFamily('#10b981')).toBe(false);  // green (standing "supported")
expect(isRedFamily('#1f2937')).toBe(false);  // slate neutral
expect(isRedFamily('#a5b4fc')).toBe(false);  // indigo focus ring
```

**Allowlist-completeness test (so the ratchet cannot rot):** assert that for every file, the current red set on disk is a subset of the allowlist AND every allowlist entry is actually present on disk (no stale allowlist entries) — this makes the guard fail loudly if a burn-down PR removes a red but forgets to shrink the allowlist, or if a red is added without updating the allowlist.

---

## API / interface contracts

None exported to production. The only "contracts" are internal test helpers (`quotedColorHex`, `isRedFamily`, `hexToRgb`, `assertHiddenAffix`) — each self-contained inside its guard file, no import from `src/`. Consumed constants: the two PR-C affixes are imported by Guard #3 from their existing modules (already exported).

---

## Edge cases

- **GitHub issue-ref comments that look like hex** (`#901`, `#654`, `#874`) — pervasive in the scanned files. Handled by the **quote-anchor**; a bare-hex regex would false-fire. This is the single most important mechanism choice.
- **3/4/6/8-digit hex** (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) — the `{3,8}` range + `\b` covers all RN color forms.
- **Same hex, two roles (#9):** `#7f1d1d`/`#fecaca` are BOTH a legit app-failure error surface (KEEP) and a content misuse (burn down P2-9). A literal scan cannot tell them apart — so both are allowlisted and the burn-down is what fixes the misuse. Documented in the allowlist comments.
- **A new genuinely-app-failure red** added later to a scanned file — the guard fires (offender). Correct behavior: the implementer of that later PR adds it to the allowlist with a one-line justification ("app-failure error state, legit per #9"). The ratchet forces the conversation; it does not forbid all red forever. Document this in the doc's §4 and the guard header.
- **rgb()/rgba()/named colors** — out of scope for #2/#9 (the audit metric is hex; the clean files use 0 rgb/rgba). Noted as a possible future extension, not built here.
- **File moved/renamed** by a future PR — the guard's explicit path would throw on `readFileSync` (loud failure, not silent skip). Acceptable; the SCAN_SET is intentionally explicit.
- **Empty/vacuous green** — the firing controls guarantee the guard is not vacuously passing.
- **A′-debt file accidentally added to SCAN_SET_P2** — would fail immediately (RingsideCard has 27 hexes). The sanity test + the fixed 4-file list guard against scope creep.

---

## Test plan

Three new suites (all part of "done"; no follow-up):

- `__tests__/cohesionPrinciple2Guard.test.ts`
  - each of the 4 SCAN_SET files has zero quoted color hex (the ratchet).
  - firing control: seeded `'#0b1220'` / `"#fff"` produce offenders.
  - must-not-fire: issue-ref comment + token reference produce `[]`.
  - sanity: SCAN_SET contains the 4 named files.
- `__tests__/cohesionPrinciple3Guard.test.tsx`
  - source-scan: both affix constants declared + rendered + a11y-hidden attribute present.
  - render: each affix node is `accessibilityElementsHidden === true` and shows the exported constant; the labeled sibling renders.
  - firing control: `assertHiddenAffix` throws on un-hidden / missing-text nodes.
  - must-not-fire: passes on a well-formed hidden affix.
- `__tests__/cohesionPrinciple9Guard.test.ts`
  - each of the 6 SCAN_SET files: red offenders (post-allowlist) is `[]` (the ratchet).
  - `isRedFamily` unit table: crimson reds true; orange/amber/pink/green/slate/indigo false (paste the verified list).
  - firing control: seeded `'#ff0000'` and an allowlist-absent red produce offenders.
  - must-not-fire: `'#f97316'` (heat) and green/slate produce `[]`.
  - allowlist-completeness: on-disk red set ⊆ allowlist AND no stale allowlist entries.
- **Doctrine ban-list assertions:** not applicable to new user-facing strings (this card ships none). The principles doc is internal design documentation; it will quote token names but adds no runtime copy. (The affix strings "Advisory"/"Mediator note" are pre-existing PR-C copy, unchanged.)
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0; capture the confirmed `Tests: Y passed` line + exit code for the completion report (test-discipline gate rule). Count goes up by ~22–28.

---

## Precedent to mirror (read in full before writing)

- **`__tests__/componentsDarkThemeGuard.test.ts`** — THE structural template for #2 and #9: an explicit/curated SCAN_SET, an `offendersIn`-style pure scanner, a firing negative control (`describe('… firing negative control')`), and a must-NOT-ban control (`describe('… must-NOT-ban control (no false positives)')`, which specifically proves GitHub issue-ref comments `#654`/`#746`/`#916` are not flagged). Guard #2 and #9 mirror this file's three-block structure exactly.
- **`__tests__/a11y693MediatorBoardAxisGuard.test.tsx`** — THE template for #3 (render + source-scan hybrid) and the source of `hexToRgb` + the red/green verdict-color classifier (`:160-186`) that #9's `isRedFamily` narrows to red-only. Reuse its `readFileSync(join(process.cwd(), …))` idiom and its firing-control pattern (`isRedOrGreenVerdictColor('#7f1d1d') === true`).
- **`src/lib/designTokens.ts:637-647`** — `FORBIDDEN_TOKEN_TOKENS` — the ban-list-as-exported-array idiom the audit §8 cites as the guard precedent. Guard #2/#9's allowlists/scan-sets are the structural inverse (allowlist of tolerated literals rather than ban-list of forbidden tokens), same spirit.

Structure mapping: **#2 ⇒ mirror componentsDarkThemeGuard** (scan-set + firing + must-not-fire). **#9 ⇒ mirror componentsDarkThemeGuard for the scan/firing structure + a11y693's hexToRgb classifier for red detection**. **#3 ⇒ mirror a11y693** (render + source-scan + firing control).

---

## Scanner-hazard checklist (for the implementer)

1. **Quote-anchor the #2/#9 hex regex** (`/['"`]#[0-9a-fA-F]{3,8}\b/g`). A bare-hex regex WILL false-fire on the GitHub issue-ref comments (`#901`, `#514`, `#874`, `#889`) that lead almost every file in the scan sets. This is verified (AdminArgumentsTab has 20+ such refs, 0 quoted color hex).
2. **Apostrophe-free comments in all three new test files** (uxOneOneTwoDoctrine: one apostrophe in any comment can poison that scanner's naive quote-parity string parsing file-wide and flag distant innocent comments). Write "the guard bites" not "the guard doesn't bite"; write "reader announces once" not "reader announces it's label". Run the full suite before push.
3. **Fixture-hex isolation.** The #9 firing control uses example red hex strings (`'#ff0000'`, `'#7f1d1d'`) as fixtures inside `cohesionPrinciple9Guard.test.ts`. This is safe because: (a) Guard #2 and #9 scan ONLY their explicit production SCAN_SETs — neither scans `__tests__/`, so a guard never scans itself; (b) `componentsDarkThemeGuard` scans only `src/components/` + one feature file, not `__tests__/`. Confirm no other repo scanner is whole-tree-hex over `__tests__/` before relying on this (the doctrine scanner bans tokens/quote-parity, not hex; eslint does not ban hex). Keep firing-control hexes as inline string literals, not exported consts.
4. **`process.cwd()` base for `readFileSync`**, matching both precedents (jest runs from repo root). Use `path.join(process.cwd(), rel)`.
5. **Self-contained helpers** — no `import` from `src/` for `quotedColorHex`/`isRedFamily`/`hexToRgb` (a production refactor must not be able to silently disarm a guard). Guard #3 is the sole exception: it imports the two affix constants + components it is asserting on (that coupling is the point).
6. **`.tsx` for Guard #3** (it renders RN components); `.ts` for #2 and #9 (pure text scan).
7. **No `.only`/`.skip`/`console.log`**; test count goes up.

---

## Dependencies (cards / docs / files)

- **Assumes PR-C (issue 923) is merged into this base** — confirmed: `DERIVED_SIGNAL_PROVENANCE_AFFIX` (DerivedSignalAdvisoryLines.tsx:30) and `MEDIATOR_NODE_PROVENANCE_AFFIX` (MediatorNodeMarker.tsx:28) both exist on `origin/main @ 6aaea78f`. Guard #3 depends on them.
- **Reads (does not modify)** the 4 clean-set files, the 6 content-state files, and the 2 PR-C files listed above.
- **Blocks / precedes** P2-2 (Era A′ migration), P1-7 (standing-gradient dedupe + red re-ramp), P2-9 (gallery re-tone): each burn-down PR must SHRINK the relevant allowlist as it removes reds — the #9 allowlist-completeness test will fail loudly if it forgets. Call this out to the P1-7/P2-9 implementers.
- **Source of truth doc** `UX_COHESION_AND_MISSION_REVIEW.md` lives on the audit branch, NOT main; `docs/design-cohesion-principles.md` is its on-main home for the principles/commitments (not a copy of the whole audit).

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bare-hex regex false-fires on issue-ref comments → CI red on merge | High if unquoted | Quote-anchor (checklist #1); must-not-fire control proves it. |
| A later burn-down PR removes a red but leaves a stale allowlist entry → ratchet silently loosens | Medium | Allowlist-completeness test (on-disk ⊆ allowlist AND allowlist ⊆ on-disk). |
| Guard #2 scoped too broadly (an A′ file sneaks into SCAN_SET) → immediate red | Low | Fixed explicit 4-file list + sanity test; A′ files verified excluded (RingsideCard 27 hexes). |
| #9 hue threshold clips a legit case (e.g. a future magenta or a rust the team calls "red") | Low | Threshold is documented + unit-tabled; a disagreement is a one-line threshold edit, not a redesign. Orange/rust are deliberately OUT (they are P2-9 tone, not #9 failure-red). |
| Guard #3 render leg flakes on RN test env | Low | Mirror a11y693 exactly (same `render` from `@testing-library/react-native`, same testID lookup); source-scan leg is a non-render backstop. |
| uxOneOneTwoDoctrine flags an innocent comment in a new test file | Medium | Apostrophe-free comments (checklist #2); run full suite pre-push. |
| A file in a SCAN_SET is renamed later → `readFileSync` throws | Low | Loud failure (not silent skip) is acceptable and desired; the renaming PR updates the path. |

---

## Out of scope (non-goals)

- **No production source change.** No `src/`, `app/`, `supabase/` edits. No token value change, no hue change, no new `designTokens.ts` keys, no re-skin. Those are P2-2 / P1-7 / P2-9.
- **Not** guards for principles #1, #4–#8, #10–#12 or the state principle — only #2/#3/#9 get source-scan guards (COHESION §8). The others are documented in the principles doc without a test.
- **Not** the Era A′ migration, the standing-gradient dedupe, the red re-ramp, or the gallery re-tone — this card only ratchets so those cannot regress further.
- **Not** rgb()/rgba()/named-color detection, fontSize/spacing/radius guards (P2-6 owns the fontSize boundary guard).
- **Not** the two-zone-shell ratification (P3-1) — recorded as deferred in the doc, not decided here.
- **Not** a copy of the full audit into `main` — only the principles/commitments contract.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** this card adds NO user-facing strings, no scoring, no gating. Principle #9's guard actively defends the doctrine by keeping red (a failure/danger signal) off content-state surfaces so a reader never reads a red chip as "this claim is wrong/false". ✓
- **cdiscourse-doctrine §9 / §10a (plain language; observations vs allegations):** Guard #3 defends the machine-Observation provenance promise — it locks in the visible "Advisory"/"Mediator note" affix so a sighted user sees that a line is machine-derived, exactly the AI-moderation non-authoritativeness the doctrine requires (COHESION §4 calls the provenance gap "the single most mission-critical grammar failure"). No raw internal codes are introduced. ✓
- **cdiscourse-doctrine §5 (engine sacred), §6/§7 (secrets / no AI in prod):** untouched — no engine, no network, no secrets, no AI. Pure test + doc. ✓
- **test-discipline:** three new suites, each with happy path + firing control + must-not-fire control; count goes up; no `.skip`/`.only`; gates must exit 0 with captured counts. ✓
- **accessibility-targets:** Guard #3's render leg asserts the a11y-hidden sibling + visible label structure (color-is-never-the-only-signal is exactly principle #9's spirit; provenance-visible is principle #3). The guards themselves add no UI. The principles doc records the a11y contract (§8 anchors). ✓
- **Ratchet doctrine (the card's own critical constraint):** every guard PASSES on the current tree (proven above by running the exact scan) and FIRES on a seeded violation (firing controls). No guard reddens CI on merge. ✓

---

## Operator steps (if any)

**None — pure docs + test change.** No migration, no Edge Function deploy, no env var, no `supabase`/`netlify`. The implementer commits the doc + 3 test files; CI runs the guards. The only downstream operator dependency is doctrinal, not mechanical: the P1-7 red re-ramp inside the burn-down wave is **operator-doctrine-gated** (COHESION §9.5 "re-ramped only on operator doctrine ruling") — but that is P1-7's concern, not PR-D's.

---

## One-paragraph summary for the reviewer

PR-D adds one doc and three ratchet-guard test files and changes zero production source. `docs/design-cohesion-principles.md` transcribes COHESION §8's 12 principles + the state principle (each with its path:line anchor and §9 commitment), names Era A canonical, records the `useMyCircles` silent-by-design exception, and maps each still-open debt to its burn-down PR (#2→P2-2, #3→PR-C-closed + P1-5/P2-11, #9→P1-7/P2-9). The three guards each mirror a named precedent (`componentsDarkThemeGuard.test.ts` for #2/#9 structure, `a11y693MediatorBoardAxisGuard.test.tsx` for #3's render leg and #9's `hexToRgb` classifier) and each is a ratchet: **#2** bans quoted color hex in 4 grep-verified-clean Era-A files (ArgumentCard, MediatorNodeMarker, ProofDrawer, AdminArgumentsTab — all 0 quoted color hex today), **#3** asserts the two PR-C affix constants still render as a11y-hidden siblings, **#9** bans crimson-red hex (hue ≤12° of pure red, sat ≥0.15) in 6 content-state files outside a per-file allowlist of the 5 current reds (#7f1d1d, #fecaca, #ef4444, #b91c1c, #dc2626), each tagged to its burn-down PR. The reviewer can verify by (a) confirming the quote-anchored regex, not bare hex, is used; (b) re-running the pasted grep/hue simulation to confirm every guard's offenders list is empty on the current tree; (c) confirming each guard has both a firing control and a must-not-fire control; and (d) confirming no `src/`/`app/`/`supabase/` file is in the diff.
