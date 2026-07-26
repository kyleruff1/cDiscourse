# UX-P2-6 — sub-10px type lift (10-11px legibility floor)

**Status:** Design draft
**Epic:** Visual cohesion / design-token system (typography legibility floor)
**Release:** Wave-2 (Era-A-prime follow-on to UX-PR-E micro-caption token)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/939

---

## Goal (one paragraph)

A UX audit found user-facing `fontSize` callsites rendering below 10px, where
small chrome labels (chip labels, type badges, band captions, table subtext)
lose legibility. UX-P2-6 lifts every such **visible** user-facing site to a
**10px floor** (a couple could read at 11 but none needed it here), landing
micro-labels on the `TYPOGRAPHY.microLabel` token that UX-PR-E appended for
exactly this purpose (`{ fontSize: 10, lineHeight: 14, fontWeight: '600' }`, doc
comment: "Min-10 legibility floor for micro captions (sub-10px sites migrate UP
to this)"). The `src/features/admin/**` sub-10 sites are a **sanctioned
exception** (Era-D ops-console density, already blessed by the P2-2 guard
comment) and stay. A new grep-guard ratchet (`uxP2SixTypeFloorGuard`) walks all
user-facing source and fails CI if any `fontSize` in the 2-9 band reappears, so
the sweep cannot regress and an omission is caught. This is a **visible size
change** (labels get 1-2px larger), NOT a byte-identical refactor — the only
byte-identical requirement is that every color hex, weight, letter-spacing, and
line-height on a changed line stays exactly as-is; only the `fontSize` numeral
moves. Doctrine that shapes the design: cdiscourse-doctrine §1-§3 (type size
never encodes truth / heat / standing — it is pure legibility) and
accessibility-targets (WCAG-AA legibility, and the two **intentionally
non-visible** sub-10 sentinels — icon-only `fontSize: 0` and the visually-hidden
live-region `fontSize: 1` — must NOT be "fixed" because raising them is an a11y
regression, not a legibility win).

---

## Scope-reality audit (ran the exhaustive grep before designing)

The brief's premise was "~22 sites below 10px, 21 at 9 and 1 at 8". The
exhaustive grep confirms that count **including admin** and surfaces two sites
the brief did not anticipate:

- **22 numeric sub-10 `fontSize` literals total** = 21 at `9` + 1 at `8`.
  - **10 are under `src/features/admin/**`** (all at `9`) — sanctioned, stay.
  - **12 are user-facing** (11 at `9` + 1 at `8` = the sites this card changes).
- **Two additional sub-10 sentinels the brief's "8/9" framing skipped**, both
  **intentional non-visible presentations** that must be **left unchanged**:
  - `src/lib/designTokens.ts:397` — `fontSize: 0` (icon-only header label on
    phone; deliberate icon-only presentation).
  - `src/features/arguments/TimelineSelectedReadoutPanel.tsx:330` —
    `liveRegionText: { fontSize: 1, ... }` inside a `position:absolute`,
    `1x1`, `overflow:hidden`, `left:-9999` visually-hidden screen-reader live
    region. `fontSize: 1` keeps it off-screen; raising it to 10 would surface
    hidden clutter and break the a11y pattern.
  - (`src/lib/designTokens.ts:375` mentions `fontSize: 0` inside a JSDoc comment
    — not a style; auto-safe.)

**Consequence for the guard (the key design refinement):** a literal
single-digit-class regex (`fontSize:\s*[0-9]`) as the brief sketched would fire
on the two sentinels (values `0` and `1`). The guard therefore extracts the
numeric value and flags the **2-9 band** — catching the real offenders (`8`,
`9`) while treating `0`/`1` as reserved sentinel sizes for intentionally
non-visible text. This is a conscious, documented deviation from the naive
single-digit approach, driven by the reality audit. See **API / interface
contracts → the guard**.

No forms other than object-literal `fontSize: <number>` exist: there are **zero**
`fontSize={N}` JSX-prop sites and **zero** const-fed sub-10 sites. Every
identifier-fed `fontSize` (`TYPOGRAPHY.*.fontSize`, `BRAND.typography.*.fontSize`,
`sizing.chipFontSize` 11/11/12, `sizing.titleFontSize` 16/17/18) resolves >=10.
The one **dynamic** expression, `InitialsAvatar.tsx:102`
`fontSize: Math.round(size * 0.38)`, is proportional avatar sizing (can compute
to 9 for a tiny avatar) — **out of scope**: it is not a fixed sub-10 chrome
literal, the guard scans literals only and correctly cannot flag a computed
expression, and forcing a floor here would break avatar scaling.

---

## Data model

No new data model. No new token. `TYPOGRAPHY.microLabel` already exists
(`src/lib/designTokens.ts:644`) and is currently unreferenced outside its own
definition — this card is its first consumer. No migration, no Edge Function, no
RLS, no schema. Pure presentational literal edits + one new test file.

---

## The COMPLETE site table (every user-facing sub-10 `fontSize`)

Default target is the **10px floor**. No site's surrounding hierarchy justified
11: every one of these is a **tertiary** label whose visible neighbors already
sit at 10-13; pushing to 11 would collide with primary chip/label text that is
already 11 (e.g. `markerKind` 11, `reactionText` 11, `bandValue` 12). So **all
12 land on 10**. Micro-labels (uppercase / letter-spaced / 700-800-weight chip
labels) reference `TYPOGRAPHY.microLabel.fontSize`; plain captions (no weight)
use a literal `10`.

| file:line | current | new value | rationale |
|---|---|---|---|
| `src/features/arguments/ArgumentDraftQualifierCards.tsx:108` (`cardLabel`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | uppercase + 700 + letterSpacing chip label -> the token. Line carries hex `#94a3b8` (hex-safe). New import needed. |
| `src/features/arguments/ArgumentNodeSummary.tsx:60` (`typeText`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 700 + letterSpacing type badge ("THS"/"CLM") -> the token. No hex on line. New import needed. |
| `src/features/arguments/ArgumentTimelineScrubber.tsx:136` (`markerBadges`) | `9` | `10` (literal) | plain badge caption (no weight, just color + marginTop) -> literal is cleaner, no import. Aligns with sibling `markerOrdinal` (10). Line carries hex `#94a3b8` (hex-safe). |
| `src/features/arguments/BranchCollapseStub.tsx:226` (`glyph`) | `8` | `TYPOGRAPHY.microLabel.fontSize` | 700-weight `+N` count badge glyph -> the token. **RUNTIME-CHECK**: 24x24 pill + `lineHeight: 9` (line 228, unchanged) — verify no vertical clip. `BRAND` import extended to add `TYPOGRAPHY`. |
| `src/features/arguments/BranchCollapseStub.tsx:241` (`summaryLine`) | `9` | `10` (literal) | plain caption, **currently `0x0` overflow-hidden** (BR-004 reserved-for-density) -> no visible change; literal 10 floors it for a future density-mode promotion. |
| `src/features/arguments/TimelineNodePopover.tsx:398` (`bandLabel`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 700 + uppercase + letterSpacing band chip label -> the token. Line carries hex `#94a3b8` (hex-safe). New import needed. |
| `src/features/debates/ChimeInGovernanceControl.tsx:143` (`appliedTag`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 700-weight applied tag -> the token. `fontSize` isolated on its own line (color `#1d4ed8` on line 145, unchanged). New import needed. |
| `src/features/debates/ConversationGalleryScreen.tsx:818` (`excerptLabel`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 800-weight + letterSpacing micro label -> the token. Color is `SURFACE_TOKENS.textMuted` (token, unchanged). `SURFACE_TOKENS` import extended to add `TYPOGRAPHY`. |
| `src/features/debates/ConversationGalleryScreen.tsx:831` (`signalChipText`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 700-weight chip text -> the token. Line carries hex `#f8fafc` (hex-safe). Same import as line 818. |
| `src/features/debates/DebateListScreen.tsx:469` (`headerCellSubtext`) | `9` | `10` (literal) | plain table subtext (no weight) -> literal. `fontSize` is first in object; hex `#6b7280` follows (hex-safe). |
| `src/features/debates/DebateListScreen.tsx:496` (`visibilityPillText`) | `9` | `TYPOGRAPHY.microLabel.fontSize` | 800 + uppercase + letterSpacing visibility pill ("PUBLIC"/"PRIVATE") -> the token. `fontSize` first; hex `#111827` follows (hex-safe). **RUNTIME-CHECK** (390px table pill width). New import needed (for this site). |
| `src/features/debates/DebateListScreen.tsx:500` (`fallbackHint`) | `9` | `10` (literal) | plain italic hint (no weight) -> literal. `fontSize` first; hex `#9ca3af` follows (hex-safe). |

**Summary:** 8 micro-label sites -> `TYPOGRAPHY.microLabel.fontSize`; 4 plain
captions -> literal `10`. Referencing only `.fontSize` (NOT spreading the whole
token) is deliberate: `microLabel`'s own `fontWeight:'600'`/`lineHeight:14` are
NOT applied, so each site keeps its existing weight (700/800) and line-height —
the non-goal "no weight/lineHeight change" is respected.

### admin/ exemption list (sub-10 sites that STAY, guard excludes them)

All 10 are `fontSize: 9` under `src/features/admin/`:

- `AdminArgumentsTab.tsx:1549`, `:1573`, `:1727`
- `AdminClassifierHealthTab.tsx:407`, `:451`
- `AdminDebatesTab.tsx:661`, `:684`
- `AdminMetadataEventsTab.tsx:526`, `:543`
- `AdminUsersTab.tsx:191`

Confirmed every admin sub-10 site is under `src/features/admin/` -> the guard's
directory exclusion (`skip any path segment === 'admin'` under `features`) is
correct and complete.

---

## File changes

**Modified source (8 files, 12 sites) — presentational only:**

- `src/features/arguments/ArgumentDraftQualifierCards.tsx` — add `TYPOGRAPHY`
  import from `../../lib/designTokens`; line 108 `9` -> token. (~2 lines)
- `src/features/arguments/ArgumentNodeSummary.tsx` — add `TYPOGRAPHY` import;
  line 60 `9` -> token. (~2 lines)
- `src/features/arguments/ArgumentTimelineScrubber.tsx` — line 136 `9` -> `10`.
  No import. (1 line)
- `src/features/arguments/BranchCollapseStub.tsx` — extend existing import
  `{ BRAND }` -> `{ BRAND, TYPOGRAPHY }`; line 226 `8` -> token; line 241 `9`
  -> `10`. (~3 lines)
- `src/features/arguments/TimelineNodePopover.tsx` — add `TYPOGRAPHY` import;
  line 398 `9` -> token. (~2 lines)
- `src/features/debates/ChimeInGovernanceControl.tsx` — add `TYPOGRAPHY` import;
  line 143 `9` -> token. (~2 lines)
- `src/features/debates/ConversationGalleryScreen.tsx` — extend existing import
  `{ SURFACE_TOKENS }` -> `{ SURFACE_TOKENS, TYPOGRAPHY }`; lines 818, 831 `9`
  -> token. (~3 lines)
- `src/features/debates/DebateListScreen.tsx` — add `TYPOGRAPHY` import; line 496
  `9` -> token; lines 469, 500 `9` -> `10`. (~4 lines)

**New file (1):**

- `__tests__/uxP2SixTypeFloorGuard.test.ts` — the grep-guard ratchet + firing /
  must-not-fire controls. (~120-150 lines, mirrors `cohesionPrinciple2Guard`.)

**Deleted files:** none.

**Blast radius:** 8 modified source files + 1 new guard = **9 files**. (The
brief's "~12 files" conflated the 12 *sites* with files; the true file count is
8 modified.)

**NOT touched:** `src/features/admin/**` (sanctioned), `designTokens.ts:397`
(`fontSize:0` sentinel), `TimelineSelectedReadoutPanel.tsx:330` (`fontSize:1`
live-region sentinel), and every hex / weight / letter-spacing / line-height on
every edited line.

---

## API / interface contracts

### The token reference

Each micro-label site replaces the bare `9`/`8` with
`TYPOGRAPHY.microLabel.fontSize` (resolves to `10`). Import shape (all affected
files are 2 dirs under `src/`, so the path is uniform):

```ts
import { TYPOGRAPHY } from '../../lib/designTokens';
// or extend an existing designTokens import in-place:
import { BRAND, TYPOGRAPHY } from '../../lib/designTokens';        // BranchCollapseStub
import { SURFACE_TOKENS, TYPOGRAPHY } from '../../lib/designTokens'; // ConversationGalleryScreen
```

### The guard (`__tests__/uxP2SixTypeFloorGuard.test.ts`)

Mirrors `cohesionPrinciple2Guard` (pure-TS, `fs`+`path`, `REPO=process.cwd()`, a
pure scanner + firing control + must-not-fire control) and borrows the
recursive-`readdirSync` idiom from `componentsDarkThemeGuard`. Unlike the
fixed-SCAN_SET cohesion ratchet, this guard **walks the whole user-facing tree**
so future sub-10 sites are auto-caught (completeness enforcement).

**Scan surface:** recursively all `.ts`/`.tsx` under `src/` (there is no `app/`
dir in this repo), **skipping** any directory segment named `admin` or
`__tests__` (note `src/__tests__/constitution/` exists and must be skipped).

**Pure scanner** — extract-then-range (NOT a bare single-digit class):

```ts
// Returns the sub-floor fontSize values found in a source string.
// Extracts the numeric literal after `fontSize:` (object form) or
// `fontSize={` (JSX-prop form), then flags values in the 2-9 band.
// Values 0 and 1 are RESERVED sentinels for intentionally non-visible
// text (icon-only presentation; visually-hidden live regions) and are
// NOT flagged. 10+ is the floor and passes. Anchoring on the literal
// word fontSize means lineHeight / letterSpacing numbers never match.
const FONT_SIZE_RE = /fontSize\s*(?::\s*|=\s*\{\s*)(\d+)/g;
function subFloorFontSizes(source: string): number[] {
  const out: number[] = [];
  for (const m of source.matchAll(FONT_SIZE_RE)) {
    const n = Number(m[1]);
    if (n >= 2 && n <= 9) out.push(n);
  }
  return out;
}
```

**Assertion:** for every scanned file, `subFloorFontSizes(source)` is `[]`.
(Use `it.each` over the recursively-discovered file list so a failure names the
offending file, mirroring the cohesion guard's per-file `it.each`.)

**Boundary verification (checked against real lines):**

| input | extracted | flagged? | why |
|---|---|---|---|
| `fontSize: 10` | `10` | no | 10 not in 2-9 (floor passes) — the "1 in 10" is captured whole, not as a single digit |
| `fontSize: 11` / `12`+ | `11`/`12` | no | >=10 |
| `fontSize:9` | `9` | **yes** | 9 in 2-9 (zero-space form caught) |
| `fontSize: 9` | `9` | **yes** | 9 in 2-9 |
| `fontSize: 8` | `8` | **yes** | 8 in 2-9 |
| `fontSize={9}` | `9` | **yes** | JSX-prop branch of the regex |
| `fontSize: 0` (icon-only) | `0` | no | sentinel (0 < 2) |
| `fontSize: 1` (live region) | `1` | no | sentinel (1 < 2) |
| `fontSize: TYPOGRAPHY.microLabel.fontSize` | (none) | no | no digit after the colon; the trailing `.fontSize` has no `:` after it, so it is not matched |
| `lineHeight: 9` | (none) | no | not anchored on `fontSize` |
| `letterSpacing: 0.5` | (none) | no | not anchored on `fontSize` |

**Firing control** (proves the guard bites, not vacuously green):
`expect(subFloorFontSizes("appliedTag: { fontSize: 9 }")).toEqual([9])`;
also `fontSize: 8` -> `[8]`, `fontSize={9}` -> `[9]`, a multi-literal fixture ->
`[9, 8]`.

**Must-not-fire control** (no false positives): the following each return `[]` —
`fontSize: 10`, `fontSize: 11`, `fontSize: TYPOGRAPHY.microLabel.fontSize`,
`lineHeight: 9`, `letterSpacing: 0.4`, `fontSize: 0`, `fontSize: 1`, and a
sample `admin/`-path source string containing `fontSize: 9` (proving the path
exclusion, i.e. the guard passing a synthetic admin file through the exclusion
filter yields no offender). These controls run against **inline string
literals** inside the test — the scanner never walks the `__tests__/` dir, so the
control fixtures do not self-flag.

---

## Edge cases

- **The two sub-10 sentinels (0, 1):** handled by the 2-9 band — left unchanged,
  not flagged. If the operator ever wanted "no fontSize < 10 at all", raising
  them would regress a11y; documented as a deliberate exclusion.
- **`BranchCollapseStub.tsx:226` glyph + `lineHeight: 9`:** bumping `8` -> `10`
  while line-height stays `9` (non-goal forbids touching lineHeight) means
  line-height is now < font-size on a 24x24 pill. Low-severity clip risk;
  RUNTIME-CHECK. Chosen `10` (not 11) is the conservative floor precisely to
  minimize this.
- **`summaryLine` (`0x0` overflow-hidden):** bumping to 10 has zero visible
  effect today; it simply pre-floors the reserved caption. No layout impact.
- **`fontSize` first in the object vs later:** on 469/496/500 the numeral is the
  first key, immediately followed by `, color: '#...'`. The edit replaces only
  the numeral; the comma and the hex that follow stay byte-identical.
- **Token-color line (818):** color is `SURFACE_TOKENS.textMuted`, not a raw
  hex — still must stay byte-identical; only the `9` moves.
- **Files with no existing designTokens import** (5 of the 8): a new single
  import line is added; the guard, typecheck, and lint confirm no unused-import
  or path error.
- **Dynamic `InitialsAvatar` expression:** intentionally left; not a literal, out
  of scope.
- **Doctrine edge:** none of these are truth/heat/standing signals — a larger
  font never changes what a label *means*, only its legibility. No copy changes.

---

## Test plan

- `__tests__/uxP2SixTypeFloorGuard.test.ts`:
  - **Recursive scan** (`it.each` over discovered `src/` files, admin +
    `__tests__` excluded) asserts `subFloorFontSizes(source) === []` per file —
    this is the completeness ratchet; it goes red if any of the 12 sites is
    missed or if a new sub-10 site lands later.
  - **Sanity**: the discovered file list is non-empty and contains at least one
    known target (e.g. `DebateListScreen.tsx`) and excludes admin (assert no
    path contains `features/admin`).
  - **Firing control**: `fontSize: 9`, `fontSize: 8`, `fontSize={9}`, and a
    multi-literal fixture each produce the expected non-empty array.
  - **Must-not-fire control**: `fontSize: 10/11`, the token reference,
    `lineHeight: 9`, `letterSpacing: 0.4`, `fontSize: 0`, `fontSize: 1`, and a
    synthetic admin-path source all return `[]`.
- **No new render/snapshot tests required** — this is a size-only change with no
  new component, prop, or string. Existing suites for the 8 touched components
  (already green) re-run unchanged; if any pins a literal `9`/`8` in a style
  snapshot, update that expectation to `10` with a one-line note (grep the 8
  components' test files first; none is expected, since these are inline style
  values, not asserted output).
- **No doctrine ban-list test needed** — no user-facing string changes. (The
  existing `uxOneOneTypographyBaseline.test.ts` ban-list on `TYPOGRAPHY` keys
  still passes; `microLabel` is a pre-existing, already-vetted key.)
- Gates: `npm run typecheck` (0), `npm run lint` (0), `npm run test` (0). Capture
  the new `Tests: N passed` line; expected delta is roughly +5-8 `it`s from the
  guard (final count from the implementer's captured run, not asserted here).

---

## Dependencies (cards / docs / files)

- Assumes **UX-PR-E** is complete because it appended `TYPOGRAPHY.microLabel`
  (`designTokens.ts:644`) as the sub-10 migration target; this card is its first
  consumer. Confirmed present on `origin/main @ cc576847`.
- Reads existing `TYPOGRAPHY` export (`designTokens.ts:617`) and the `BRAND` /
  `SURFACE_TOKENS` exports already imported by two of the targets.
- Mirrors `__tests__/cohesionPrinciple2Guard.test.ts` (structure) and
  `__tests__/componentsDarkThemeGuard.test.ts` (recursive-readdir idiom).
- Coordinates with the P2-2 / P2-9 no-new-hex guards: because this card leaves
  every hex byte-identical, those ratchets stay green. (`cohesionPrinciple2Guard`
  even notes it "says nothing about the sanctioned sub-10px fontSize (that is
  P2-6)" — this is the intended follow-up.)
- Blocks nothing; unblocks a future "min-10 floor is now enforced" claim in the
  cohesion audit.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Implementer touches a hex/weight/spacing while changing the numeral on a shared line | Medium | Per-line hex-safe callout below; guard + P2-2 hex ratchets catch a hex change; review diff must be numeral-only on those lines. |
| `glyph` (`+N`) clips in the 24x24 pill (lineHeight 9 < fontSize 10) | Low-Med | RUNTIME-CHECK at 390px; chose 10 not 11; if it clips, that is a follow-up card (do NOT touch lineHeight here). |
| A component test pins a `9`/`8` style literal in a snapshot | Low | Grep the 8 components' tests first; update the single expectation with a note if found. |
| Naive single-digit guard regex would false-fire on the 0/1 sentinels | Resolved in design | Guard uses extract-then-range (2-9), documented. |
| New import path wrong (unused-import / resolve error) | Low | Uniform `../../lib/designTokens`; typecheck + lint gate. |
| Scanner-comment apostrophe/hash hazard poisons the guard or a neighbor file | Low | See scanner-hazard note below. |

### Scanner-hazard note

- In the new guard file and in any comment added to the 8 edited files, write
  the issue reference as **`(issue 939)`**, never `#939` — a `#`-prefixed
  hex-shaped ref can false-fire hex-scanning guards, and the doctrine scanner
  has a known apostrophe-parity hazard.
- Keep all comments **apostrophe-free** (the `uxOneOneTwoDoctrine` naive
  quote-parity scanner treats a single apostrophe in any comment as poisoning
  string parsing file-wide — see memory "Doctrine scanner apostrophe gotcha").
- The guard **must** exclude its own `__tests__/` fixtures from the tree walk
  (the control strings contain `fontSize: 9`); the scanner runs against inline
  literals, never against files in `__tests__/`.

---

## Hex-safe shared-line callout (edit the numeral ONLY)

These changed lines carry a color literal/token (and often weight/spacing) that
must stay **byte-identical**; change only the `fontSize` value:

- `ArgumentDraftQualifierCards.tsx:108` — hex `#94a3b8` + `fontWeight:'700'` +
  `letterSpacing:0.5` on the line.
- `ArgumentTimelineScrubber.tsx:136` — hex `#94a3b8` + `marginTop:2`.
- `TimelineNodePopover.tsx:398` — hex `#94a3b8` + `700` + `uppercase` +
  `letterSpacing:0.4`.
- `ConversationGalleryScreen.tsx:818` — `SURFACE_TOKENS.textMuted` + `800` +
  `letterSpacing:0.4` (token color, keep verbatim).
- `ConversationGalleryScreen.tsx:831` — hex `#f8fafc` + `700`.
- `DebateListScreen.tsx:469` — `fontSize` first, then hex `#6b7280` + `marginTop`.
- `DebateListScreen.tsx:496` — `fontSize` first, then `800` + hex `#111827` +
  `uppercase` + `letterSpacing:0.3`.
- `DebateListScreen.tsx:500` — `fontSize` first, then hex `#9ca3af` +
  `fontStyle:'italic'` + `marginTop`.

Isolated (numeral alone on its own line, low risk): `BranchCollapseStub.tsx:226`,
`:241`; `ChimeInGovernanceControl.tsx:143`. No-hex weighted line:
`ArgumentNodeSummary.tsx:60` (keep `700` + `letterSpacing:0.5`).

---

## 390px-overflow RUNTIME-CHECK flags

Visible size change: **11 of 12 sites get 1-2px larger** (all except
`summaryLine`, which is `0x0` hidden -> no visual change). Conservatively all
land on 10 (not 11) to bound growth. Flags for eyes-on at 390px:

1. **`BranchCollapseStub.tsx:226` glyph (8 -> 10)** — PRIMARY. `+N` count badge
   inside a fixed 24x24 pill with `lineHeight: 9` (unchanged). Verify the glyph
   does not clip vertically or overflow the pill for 2-3-char counts (`+12`).
2. **`DebateListScreen.tsx:496` visibilityPillText (9 -> 10)** — SECONDARY. An
   uppercase 800 pill ("PUBLIC"/"PRIVATE") inside a narrow table column at
   390px; confirm the pill does not wrap or push the row width.
3. Low-risk (flexible/wrapping containers, note but no action expected):
   `ConversationGalleryScreen` `excerptLabel`/`signalChipText` (signalRow is
   `flexWrap:'wrap'`), `ArgumentTimelineScrubber` `markerBadges`,
   `DebateListScreen` `headerCellSubtext`/`fallbackHint`.

---

## Out of scope

- Any `src/features/admin/**` sub-10 site (sanctioned Era-D density).
- The `fontSize: 0` icon-only token and the `fontSize: 1` live-region sentinel.
- `InitialsAvatar.tsx:102` dynamic `Math.round(size*0.38)` (proportional).
- Any `fontWeight`, `lineHeight`, `letterSpacing`, `color`, or `textTransform`
  change (non-goal — only the `fontSize` numeral moves).
- Minting a new token, or migrating any hex to a token (that is P2-2/P2-9).
- Sizes >=10 (no down-tuning of 11/12/13; no scale rework).
- Any behavior, copy, a11y-label, or component-structure change.

---

## Doctrine self-check

- **cdiscourse-doctrine §1-§3 (no truth / heat / popularity encoding):** a font
  size is pure legibility; enlarging a label never changes what it asserts. No
  copy, no verdict vocabulary, no standing/heat signal touched. PASS.
- **cdiscourse-doctrine §4-§7 (no AI, engine purity, secrets, no provider
  calls):** no engine, network, AI, or secret touched — presentational literals
  + one test. PASS.
- **accessibility-targets (legibility floor + non-visible sentinels):** raises
  visible chrome to a 10px floor (better AA legibility) while explicitly
  **preserving** the two intentionally non-visible sub-10 sentinels (icon-only,
  screen-reader live region) — treating them as offenders would be an a11y
  regression. Hit targets / roles / labels unchanged. PASS.
- **timeline-grammar:** the timeline micro-labels affected
  (`ArgumentNodeSummary` type badge, `TimelineNodePopover` band label,
  `ArgumentTimelineScrubber` marker badge) keep shape/stroke/color as the
  primary encodings; only their text size floors up. No grammar drift. PASS.
- **test-discipline:** tests ship with the card (the guard + controls); test
  count goes up; no `.skip`/`.only`; the guard is a completeness ratchet, not a
  vacuous green. PASS.

---

## Operator steps (if any)

None — pure code change. No `supabase db push`, no `functions deploy`, no env
var, no Netlify publish. Ships on merge like any presentational card.

---

## One-paragraph summary (for the reviewer to check against)

UX-P2-6 lifts the **12 user-facing sub-10px `fontSize` sites** (11 at `9`, 1 at
`8`) across **8 files** to a **10px floor** — 8 micro-labels reference the
existing `TYPOGRAPHY.microLabel.fontSize` (10) and 4 plain captions use literal
`10`, changing **only the numeral** so every hex/weight/spacing/line-height stays
byte-identical. The **10 `admin/` sub-10 sites stay** (sanctioned), and the two
**intentionally non-visible sentinels** — `designTokens.ts:397` `fontSize:0`
(icon-only) and `TimelineSelectedReadoutPanel.tsx:330` `fontSize:1` (hidden live
region) — are left unchanged; the new `uxP2SixTypeFloorGuard` therefore flags the
**2-9 band** (not a naive single-digit class) via extract-then-range over a
recursive `src/` walk that skips `admin` + `__tests__`, with firing and
must-not-fire controls (including token-ref, `lineHeight`, and the 0/1
sentinels). Blast radius: 8 modified + 1 new guard = 9 files; two RUNTIME-CHECK
flags at 390px (`BranchCollapseStub` glyph vs its 24px pill + lineHeight 9;
`DebateListScreen` visibility pill); no operator steps.
