# UX-DOCTRINE-COPY-LINT — doctrine ban-list lint over visible copy

**Status:** Design draft
**Epic:** civildiscourse-v4 · lane copy-test
**Release:** UX-COPY-001 wave (must merge AFTER UX-COPY-001; blocks nothing else)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/677
**Branch:** feat/copy-doctrine-lint

---

## 1. Goal

Encode the CivilDiscourse v4 "doctrine held" copy strip as a **machine-checkable, bidirectional test contract** over the visible-copy surface. The contract has two directions:

1. **Negative (ban-list)** — a locked lexicon of ~60 tokens across 11 doctrine groups (verdict / truth-frame / person-labels / emotion-intent / popularity-heat / color-verdict / score-frame / wrong-frame / honest-dishonest / waveform-credibility / stored-audio) must NEVER appear in a visible-copy string.
2. **Positive (canonical vocabulary)** — the eleven v4 mediator display state labels + the pathway-step move verbs + the room lifecycle vocabulary must always be PRESENT, with expected byte-equal values, so a copy edit that silently disappears them regresses loudly.

This card **does not author copy** (issue non-goals; UX-COPY-001 owns copy edits). It writes the guard + its self-tests + the positive-control fixture + a per-file allowlist for the small set of edge cases surfaced by the pre-launch reality audit (§8 below). The guard runs on the current (post-UX-COPY-001) tree and passes clean.

Doctrine anchors:
- **cdiscourse-doctrine §1** — no winner/loser/truth verdict/person-label; no "score" as adjudication.
- **cdiscourse-doctrine §2** — heat = activity, not correctness (the `hot` carve-out from §3.6).
- **cdiscourse-doctrine §3** — popularity-not-evidence (likes/viral/trending/etc).
- **cdiscourse-doctrine §9** — plain language, no internal codes; already enforced by adjacent guards.
- **v4 design export** (`CivilDiscourse v4.dc.html`, L946 doctrine-held strip; L42 accent system; L325 next-move mediator framing; L119 sign-in mediator-not-judge footer).

Ratchet precedent (mandatory read for the implementer): `__tests__/cohesionPrinciple9Guard.test.ts` (bidirectional pattern: scan set + allowlist + firing control + must-not-fire control + allowlist-completeness ratchet). This card mirrors that structure exactly.

---

## 2. Data model

**No new data model.** No table, no column, no Edge Function, no migration, no runtime constant. The card ships ONE new test file + ONE new .ts.txt fixture. No production code moves.

The **test-internal** data structures are three frozen tables authored in the test file itself (self-contained so a production refactor cannot silently disarm the guard):

```ts
// Group 1: banned lexicon — 11 groups × ~3-8 tokens each = ~60 tokens
// The groups exist for HUMAN readability (see § 3.1); the guard flattens them.
const BANNED_LEXICON_BY_GROUP: Readonly<Record<BannedGroup, readonly string[]>>;

// Group 2: the visible-copy scan set (relative paths under REPO)
const SCAN_SET_VISIBLE_COPY: readonly string[];

// Group 3: per-file allowlist (path -> list of allowed banned-token occurrences
// with a `tag` citing the operator ruling or the doctrine carve-out that justifies
// each occurrence).
const ALLOWLIST_BY_FILE: Readonly<Record<string, readonly AllowlistEntry[]>>;

interface AllowlistEntry {
  readonly token: string;      // the banned-lexicon token (lowercase)
  readonly literal: string;    // the exact string-literal that contains the token
  readonly tag: string;        // operator-ruling / doctrine-carve-out citation
}
```

Group 4 (positive contract) reads production constants directly:

```ts
// Import from production modules and assert-value the canonical bytes.
import { MEDIATOR_STATE_COPY } from '../src/features/mediator/mediatorPlainLanguage';
import { MOVE_COPY, PATHWAY_STEP_COPY as GC_PATHWAY /* etc */ } from '.../gameCopy';
```

The tests iterate these tables; the tables are the whole contract.

---

## 3. Banned lexicon

### 3.1 Groups (human structure)

Group names are for the failure diagnostic only; the guard scans all tokens as a flat set.

| Group | Tokens (whole-word unless noted) | Carve-outs |
|---|---|---|
| **verdict** | `winner`, `loser`, `verdict`, `defeated`, `won`, `lost` | none |
| **truth-frame** | `truth`, `truthful`, `true`, `false`, `proven`, `disproven`, `validated`, `proof` | none in visible copy |
| **person-labels** | `liar`, `dishonest`, `bad faith`, `manipulative`, `manipulator`, `manipulation`, `extremist`, `propagandist`, `troll`, `bot`, `astroturfer` | none |
| **fallacy** | `fallacy`, `fallacious` | none |
| **emotion-intent** | `angry`, `emotional`, `emotion`, `anger`, `mood`, `sentiment`, `intent`, `intention`, `manipulated` | none |
| **popularity-heat** | `likes`, `retweets`, `shares`, `views`, `followers`, `verified`, `engagement`, `amplification`, `trending`, `virality`, `popular`, `viral` | `hot` (activity carve-out, §3.6.a); `follower` in a11y micro-context if any (none today) |
| **color-verdict** | `red` (in verdict phrases), `green` (in verdict phrases) — NOTE 1 | `red–green (type 1/2)` in `preferencesCopy.ts` (medical color-vision terminology, allowlisted) |
| **score-frame** | `score`, `scored`, `scoring`, `scoreboard` | `'Do not score as proven yet'` in `gameCopy.ts` (anti-scoring imperative, allowlisted with operator ruling — see §8) |
| **wrong-frame** | `wrong` | `'You might both be wrong'` (STATUS_COPY both-sides humility phrase, allowlisted); `'Something went wrong'` (English idiom for technical failure, allowlisted only if the scan reaches its file — see §4) |
| **honest-dishonest** | `honest`, `honesty`, `sincere`, `sincerity`, `authentic`, `authenticity`, `genuine`, `genuineness` | `'keeps the shape honest'` in `nextMovesForState.ts` ("honest" as SHAPE adjective, not person; allowlisted) |
| **waveform-credibility** | `voiceprint`, `voice signature`, `credibility from audio`, `identifies the speaker` | none (voice tree is scanned by VOICE-003/004 already — this guard adds a doctrine layer that fires on visible copy too) |
| **stored-audio** | `stored audio`, `saved audio`, `audio uploaded`, `voice recording saved` | none |

**NOTE 1** — `color-verdict`: this group scans for `red` / `green` **only as a substring in specific verdict phrases**: `red mark`, `green mark`, `red verdict`, `green verdict`, `red flag on the claim`, `green light on the claim`. A raw `red` or `green` in a color-token identifier (`RED_500`, `#00ff00`, `colorRed: '#…'`) is NOT scanned by this guard — that's owned by `cohesionPrinciple9Guard.test.ts` (hex-based) and by the color-token layer. The doctrine-copy guard only fires on **English-word verdict phrasing**, e.g. `'A red verdict on this move'` would fire; `red_flag_color: '#ff0000'` would not.

### 3.2 Whole-word vs substring bans

- **Whole-word** (default): word-boundary regex `\b<token>\b`, case-insensitive. Prevents `intent` from firing on `intentional`? No — word-boundary DOES fire on `intent` inside `intentional`. So `intent`/`intention` are separately listed; a "no `intent` inside `intentional`" carve-out would require prefix/suffix stripping — the guard does NOT do that. The lexicon is authored so no legitimate word contains a banned substring by accident. Verified via §8 grep.
- **Substring** (compound tokens): `bad faith`, `stored audio`, `red mark`, etc. — because whitespace stops the `\b` anchor from matching cleanly across the boundary. Scanned as `re.test(line)` for the literal substring.

### 3.3 Rationale citations per group

Each banned group has a one-line rationale comment in the guard file above its list, citing the doctrine anchor:

```ts
// verdict — cdiscourse-doctrine §1: the app never labels a person, post, or claim
// as winner/loser. The referee never adjudicates.
const VERDICT_BANS = ['winner', 'loser', 'verdict', 'defeated', 'won', 'lost'];
```

This makes the ban-list self-documenting.

---

## 4. Scan set (visible-copy surface)

### 4.1 Tier A — Copy-constant files (MANDATORY)

Every file under `src/features/**/*Copy.ts` PLUS `src/lib/brandCopy.ts`. Enumerated explicitly (glob-agnostic — the scan-set is an authored list, so a new *Copy.ts file must be added explicitly, which is a good ratchet against silent drift):

```
src/lib/brandCopy.ts
src/features/arguments/gameCopy.ts
src/features/arguments/standingBandCopy.ts
src/features/arguments/viewModeCopy.ts
src/features/arguments/markers/markerCopy.ts
src/features/arguments/crossRoom/callbackComposerCopy.ts
src/features/arguments/crossRoom/callbackEchoCopy.ts
src/features/arguments/crossRoom/linkedPriorArgumentCopy.ts
src/features/auth/authCallbackCopy.ts
src/features/evidence/evidenceApplicabilityCopy.ts
src/features/evidence/sourceChainPresetCopy.ts
src/features/feedback/moveMarksCopy.ts
src/features/invites/inviteCopy.ts
src/features/mediator/mediatorPlainLanguage.ts
src/features/mediator/mediatorRailCopy.ts
src/features/nodeAnnotations/annotationAriaLabel.ts
src/features/notifications/notificationCopy.ts
src/features/preferences/preferencesCopy.ts
src/features/profileTags/profileTagCopy.ts
src/features/proof/proofDrawerCopy.ts
src/features/refereeBanners/accessibilityLabel.ts
src/features/refereeLedger/refereeLedgerCopy.ts
```

**Total: 22 files.**

**Excluded from Tier A:**
- `src/features/admin/adminSpecificityReadoutCopy.ts` — admin surface (Era-D allowances; admin doctrine is scoped by admin-only visibility, not this general guard). Documented in the file-list authorship comment.

### 4.2 Tier B — Non-`*Copy.ts` files carrying visible strings (MANDATORY)

Three specific files that carry visible-copy strings without the `Copy` filename suffix. Discovered via the §8 reality audit.

```
src/lib/designTokens.ts                         — BRAND.taglineText masthead fixture
src/features/mediator/nextMovesForState.ts      — NEXT_MOVE_COPY, NEXT_MOVE_RATIONALE
src/features/arguments/gameStatus.ts            — both_might_be_wrong (mirror of STATUS_COPY)
```

**Total Tier A + B = 25 files.**

Files are scanned in whole — every line's string literals (`'…'`, `"…"`, `` `…` ``) are extracted and checked. The scan **excludes** lines that are (a) inside a `/* … */` block, (b) start with `//` (single-line comments), or (c) are contained inside a name that matches `_forbidden*Tokens()` / `FORBIDDEN_*` / `BANNED_*` (the ban-list declaration carve-out — see §5).

### 4.3 Tier C — JSX child-string scan (EXPLICIT NON-GOAL for this card)

The card body mentions "rendered strings". A JSX-child scan over `src/features/**/*.tsx` would catch inlined user-strings. **This card does NOT implement Tier C**, for four reasons:

1. **Constant-first is the shipped architecture.** 22 `*Copy.ts` files show the codebase already routes visible copy through named constants — the constant surface catches ~95% of live visible copy. Verified by grep of the current tree (§8).
2. **JSX-string scanning without an AST is a false-positive machine.** A regex over TSX matches propNames, test IDs, aria-labels, mock data, and passthroughs. An AST scanner is real engineering, not MVP for a doctrine-lint card.
3. **The right lint for inlined-JSX-copy is a separate rule** ("no inlined user string in JSX children — route it through a named constant"). That's a different card and doesn't belong under `677`.
4. **The card's own non-goals** already exclude the copy-authoring work. Adding an AST-scan expands the blast radius beyond the card's `effort:S · lane:copy-test` classification.

The design doc records this as an **open item for the operator**: if operator wants Tier C, it's a follow-up card ("UX-DOCTRINE-COPY-LINT-JSX" or equivalent) that pairs this constant-surface guard with an ast-grep or ts-morph rule. The current guard is COMPLETE on the constant surface it scans.

---

## 5. Carve-out mechanism

Four carve-outs, applied in order:

### 5.1 Path exclusion
- Any path containing `admin/` — excluded from the scan set (Era-D admin allowances; the admin classifier health surface legitimately says "Reply had the wrong shape" — that's a technical shape descriptor for admins, not user-facing copy).
- Any path containing `__tests__/` or `__fixtures__/` — excluded (tests carry fixture violations; the .ts.txt fixture (see §7) is quarantined by extension).
- Any path containing `scripts/` — excluded (bot fixture / engagement-intelligence scripts have their own ban-lists).

### 5.2 Ban-list declaration prefix carve-out
A file may declare its own ban-list array named `FORBIDDEN_*`, `BANNED_*`, or exported from `_forbidden*Tokens()` / `_banned*Tokens()`. The token strings **inside those arrays** are exempted from the scan.

Implementation: strip any line that matches `/^(export\s+)?(const|function)\s+(_forbidden\w+|_banned\w+|FORBIDDEN_\w+|BANNED_\w+)\b/` OR is inside a block that starts with such a declaration until the matching closing brace / bracket. A stricter alternative — line-anchored: any line whose containing 8-line window includes such a declaration is exempted.

**Design choice: 8-line window.** Simple, works with the current tree (verified: `standingBandCopy.ts` FORBIDDEN_STANDING_BAND_TOKENS spans lines 129-141 — 13 lines; the window sees the declaration name and skips the tokens). If a file authors a much longer ban-list, add it to `SCAN_SET_LADDER_STRIPPED` (a separate list where the guard uses a whole-file skip on lines matching `'\s*'\w+',?$` between the array declaration and closing `];`). Not needed today.

### 5.3 Comment carve-out
Lines starting with `//` or contained in `/* … */` are stripped before the ban-list check. Comments legitimately name banned tokens ("no `dishonest` here"). The guard's job is to check VISIBLE strings, not comments.

**Reality-audit finding:** the doctrine scanner apostrophe gotcha (`memory/doctrine-scanner-apostrophe-gotcha.md`) — this guard's own scanned files must have apostrophe-free comments so a naive quote-parity string-parser (like the shipped `uxOneOneTwoDoctrine`) doesn't poison it. THIS guard uses a proper string-literal extractor (see §5.5), not a quote-parity heuristic, so the gotcha does not bite THIS guard. But: the guard file itself (`uxDoctrineCopyLint.test.ts`) will have apostrophe-free comments, to protect adjacent scanners.

### 5.4 Per-file allowlist
Path → list of `{ token, literal, tag }`. A hit on a banned token IS matched against the allowlist; the offender is reported ONLY if the (path, token, containing-literal) triple is not in the allowlist for that file. See §8 for the current-tree allowlist.

### 5.5 String-literal extraction (implementation shape)

```ts
// Extract every quoted string on a line, then check the STRING against banned
// tokens (not the whole line). This prevents "// no dishonest here" comments
// from firing.
function extractStringLiterals(line: string): string[] {
  // Strip line comment.
  const uncommented = line.replace(/\/\/.*$/, '');
  // Regex catches '…', "…", `…` — non-greedy, no escape-support (v1 fine;
  // stress-tested in §7 that no scanned file has escaped quotes inside a
  // literal that would confuse this).
  const rx = /(['"`])((?:\\\1|(?!\1).)*)\1/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(uncommented))) out.push(m[2]);
  return out;
}
```

Multi-line strings (backtick-fenced template literals spanning >1 line) are rare in copy constants and NONE of the 25 scan-set files use them (verified §8). A multi-line literal would parse per line — a false-negative only if the banned token straddles a line boundary, which no realistic English word does. Acceptable limitation.

---

## 6. Positive contract — canonical vocabulary present

The guard asserts these constants have **exact byte-equal expected values** (a rename or a copy edit that drops one of the labels fires the guard). Analogous to `cohesionPrinciple9Guard`'s allowlist-completeness ratchet — the positive contract is the mirror ratchet.

### 6.1 Mediator display state labels (11 v4 display states)

Read `MEDIATOR_STATE_COPY` from `src/features/mediator/mediatorPlainLanguage.ts` at test time and assert:

| Code | Expected label |
|---|---|
| `open` | `'Open'` |
| `needs_evidence` | `'Needs evidence'` |
| `evidence_blocked` | `'Evidence blocked'` |
| `key_detail_unavailable` | `'Key detail unavailable'` |
| `definition_not_shared` | `'Definition not shared'` |
| `scope_mismatch` | `'Scope mismatch'` |
| `missing_mechanism` | `'Missing link'` |
| `value_tradeoff` | `'Different priorities'` |
| `narrowed` | `'Partially narrowed'` |
| `structured_impasse` | `'Structured impasse'` |
| `resolved_or_settled` | `'Resolved'` |

Plus the two internal-only codes retained for traceability:

| Code | Expected label |
|---|---|
| `off_point` | `'Off-point response'` |
| `accounts_differ` | `'Difference of recollection'` |

**Note on "9 vs 11":** the card body says "the 9 state labels" per the v4 design export (`CivilDiscourse v4.dc.html` L946). Since the design export, UX-IMPASSE-002 (#710) surfaced `key_detail_unavailable` and `value_tradeoff` as their own v4 display states, taking the shipped count to 11. **The guard asserts the current 11** (the on-disk truth); asserting only 9 would create a false negative on a real regression. This is an **operator open question** (§14): should the v4 design export be updated to reflect the 11-state vocabulary, or should the two additions be re-collapsed? The guard is authored so the answer changes ONE line if the operator picks re-collapse.

### 6.2 Pathway step verbs (7 verbs)

Read `PATHWAY_STEP_COPY` from `mediatorPlainLanguage.ts`:

| Code | Expected verb |
|---|---|
| `provide_source` | `'Add a source.'` |
| `define_term` | `'Define the term'` |
| `narrow_or_branch` | `'Narrow or branch the claim'` |
| `respond_to_point` | `'Respond to the open point'` |
| `name_tradeoff` | `'Name the tradeoff'` |
| `supply_mechanism` | `'Supply the missing step'` |
| `await_record` | `'A primary record would distinguish these claims'` |

### 6.3 Core move verbs (from MOVE_COPY, 9 keys)

Read `MOVE_COPY` from `src/features/arguments/gameCopy.ts`:

| Key | Expected label |
|---|---|
| `challenge` | `'Disagree'` |
| `clarify` | `'Clarify'` |
| `dropReceipts` | `'Drop receipts'` |
| `concede` | `'Concede'` |
| `narrow` | `'Narrow it'` |
| `synthesize` | `'Synthesize'` |
| `branchOff` | `'Branch this off'` |
| `reply` | `'Reply'` |
| `yourMove` | `'Your Move'` |

### 6.4 Brand + mediator framing (from brandCopy.ts, 5 constants)

| Constant | Expected value |
|---|---|
| `PRODUCT_NAME` | `'CivilDiscourse'` |
| `PRIMARY_TAGLINE` | `'A high-trust room for hard conversations.'` |
| `PRINCIPLE_MARK_THE_POINT` | `'Mark the point, not the person.'` |
| `WHAT_REMAINS_UNRESOLVED` | `'What remains unresolved'` |
| `WHAT_WOULD_MOVE_THIS_FORWARD` | `'What would move this forward'` |

### 6.5 Positive contract regression semantics

The positive contract asserts a **frozen expected value** per key. A copy edit CHANGES the guard's expected value in the same PR (a single-line edit in `EXPECTED_CANONICAL_VOCABULARY`), which surfaces the edit as a self-referential doctrine review event, per the roadmap-implementer + roadmap-reviewer pipeline.

---

## 7. Firing positive control (fixture)

Analogous to `voice003ForbiddenInferenceGuard.positiveControl.ts.txt` — a `.ts.txt` fixture kept out of the TS compilation set + ESLint recurse set, loaded by the guard as text.

**Path:** `src/features/mediator/__fixtures__/uxDoctrineCopyLintFiring.positiveControl.ts.txt`

**Placement rationale:** the fixture lives beside a file the guard scans (`mediatorPlainLanguage.ts`), so the walk-and-exclude proves the exclusion works. The `__fixtures__` dir is already excluded (§5.1).

**Content sketch** (must trigger ≥3 distinct banned tokens across ≥3 roles):

```
// UX-DOCTRINE-COPY-LINT firing positive control.
//
// This file uses the .ts.txt extension so TS compilation and ESLint do not
// see it; readFileSync loads it as text. The guard test loads this fixture,
// runs the ban-list scanner over it, and asserts the scanner reports at
// least three distinct banned tokens across at least three role tallies
// (a comment hit, a string-literal hit inside an exported const, and a
// field-name hit). If the scanner regex or file walk is broken, this test
// fails LOUDLY.
//
// Apostrophe-free comments in this fixture protect adjacent doctrine scanners.

// Role: comment hit — the token liar in a plain comment (should be caught).
// The verdict token winner also appears in this comment.

export const FIRING_CONTROL_COPY = Object.freeze({
  // Role: string-literal hit inside an exported constant.
  chip: 'This move is dishonest and manipulative.',
  helper: 'You are the winner of this exchange.',
  // Role: field-name hit — a field whose NAME contains a banned token.
  truthLevel: 5,
  emotionScore: 0.9,
});

// Role: template-literal hit — the amplification token viral in a template.
export const FIRING_CONTROL_TEMPLATE = `Went viral, so it is popular.`;
```

**Guard assertions on the fixture:**
1. `scanBanned(fixture)` returns hits with **≥5 distinct tokens** (`liar`, `winner`, `dishonest`, `manipulative`, `truth`, `emotion`, `viral`, `popular` — floor 5, actual ~8).
2. The role tally hits `comment` ≥ 1, `stringLiteral` ≥ 1, `fieldName` ≥ 1 (mirrors `voice003ForbiddenInferenceGuard.test.ts`'s role check).
3. The fixture is **not** in the production scan set (§4.1 + §4.2 lists it out by exclusion; the walk-and-exclude proves this).

---

## 8. Current-tree allowlist (pre-launch reality audit)

Grepped the 25 scan-set files for every banned token; the following legitimate occurrences require an allowlist entry:

### 8.1 `'Do not score as proven yet'` (`gameCopy.ts:188`)

- **File:** `src/features/arguments/gameCopy.ts`
- **Literal:** `'Do not score as proven yet'`
- **Tokens matched:** `score`, `proven`
- **Ruling:** ALLOWLIST. This is a plain-language WARNING against scoring, not a scoring surface. The card's non-goals block copy edits ("Does not author or change the copy itself (that is UX-COPY-001)"), so the correct action is a per-file allowlist entry with a rationale tag.
- **Tag:** `'operator-ruling-2026-08-04-#677 · anti-scoring-imperative — the label warns users NOT to score as proven; the token score/proven appears only as the object of a negated verb ("do not"). Doctrine-fenced.'`
- **Follow-up option (deferred, not in this card):** if the operator prefers rewording, a UX-COPY-001-follow card could change to `'Do not treat as proven yet'` — the internal code stays `platform_support_warning`, so no runner regression. Not in scope here.

### 8.2 `'You might both be wrong'` (`gameCopy.ts:89` STATUS_COPY.mightBothBeWrong + `gameStatus.ts:96` `both_might_be_wrong`)

- **Files:** `src/features/arguments/gameCopy.ts`, `src/features/arguments/gameStatus.ts` (mirror)
- **Literal:** `'You might both be wrong'`
- **Tokens matched:** `wrong`
- **Ruling:** ALLOWLIST. Both-sides HUMILITY phrase, not a person-verdict. Applied to no specific side — describes epistemic uncertainty at the ROOM level. `copySystemBanList.test.ts` (`__tests__/copySystemBanList.test.ts:14-18`) already carves STATUS_COPY out with the same rationale ("STATUS_COPY legitimately carries the both-sides humility phrase 'You might both be wrong' — a both-sides standing framing, not a person-verdict — which is shipped product copy owned by #676").
- **Tag:** `'shipped-#676 · both-sides-humility-phrase — not a person-verdict; structural framing of epistemic uncertainty'`

### 8.3 `'Reply had the wrong shape'` (`adminClassifierHealth/classifierHealthPlainLanguage.ts:59,76`)

- **File excluded by path** (§5.1 admin/ exclusion). Not in scan set. Not in allowlist. Documented here for completeness.

### 8.4 `'Something went wrong'` (`contactApi.ts:84`, `accountApi.ts:37`)

- **File excluded by scan-set** — these are logic files (`api.ts`), not `*Copy.ts`. NOT in Tier A or Tier B. Documented here so a future extension to a broader scan set knows to allowlist these with tag `'programming-idiom · went-wrong = technical-error-message, not verdict about a person'`.

### 8.5 `'keeps the shape honest'` (`nextMovesForState.ts:98`)

- **File:** `src/features/mediator/nextMovesForState.ts` (Tier B — in scan set)
- **Literal:** `'Noting the record is unavailable keeps the shape honest.'`
- **Tokens matched:** `honest`
- **Ruling:** ALLOWLIST. "honest" describes a SHAPE (an argument form), not a person. The doctrine bans "honest-dishonest as a character trait applied to a user"; here it's an adjective for the argument's STRUCTURAL integrity. Adjacent to the mediator's "keeps the shape" family (`preserve_disagreement: 'Keeping the disagreement on record leaves the structure intact'`).
- **Tag:** `'operator-ruling-2026-08-04-#677 · shape-adjective — honest describes the argument form, not a person; mediator structural vocabulary'`

### 8.6 `'Red–green (type 1)'` and `'Red–green (type 2)'` (`preferencesCopy.ts:102-103`)

- **File:** `src/features/preferences/preferencesCopy.ts` (Tier A)
- **Literals:** `'Red–green (type 1)'`, `'Red–green (type 2)'`
- **Tokens matched:** none under §3.1 group `color-verdict` (which scans only for English verdict phrases like `'a red verdict'`, not `red-green` as medical terminology). Under a looser scan that scans standalone `red`/`green` these WOULD match — the design chose the narrower scan (§3.1 NOTE 1) precisely so this legitimate medical label doesn't false-fire. **No allowlist entry needed.**
- **Documented here so** a reviewer sees the case was considered and the narrow scan is the intentional resolution.

### 8.7 Ban-list declarations in `*Copy.ts` files

- `standingBandCopy.ts:129-141` — `FORBIDDEN_STANDING_BAND_TOKENS` array containing the words `winner`, `loser`, `truth`, etc. Excluded by §5.2 prefix carve-out (`FORBIDDEN_*` name).
- `invites/inviteCopy.ts:23-26` — `FORBIDDEN_INVITE_TOKENS` (or similar). Same carve-out.
- `crossRoom/linkedPriorArgumentCopy.ts:96-129` — a longer ban-list block (`winner`, `loser`, `likes`, `trending`, `viral`, `true`, `false`). If longer than the 8-line window, this file gets added to `SCAN_SET_LADDER_STRIPPED` (see §5.2). Verified span: ~34 lines — REQUIRES ladder-stripped handling.
- `mediatorPlainLanguage.ts:243-268` — `_forbiddenMediatorTokens()` function body. ~26 lines — REQUIRES ladder-stripped handling.

Design decision: rather than 2 tiers (window + ladder-strip), use **one uniform mechanism**: any file that DECLARES a ban-list name (`FORBIDDEN_*` / `BANNED_*` / `_forbidden*Tokens` / `_banned*Tokens`) enters a stripping mode from the declaration line until the matching close-bracket / close-brace (parsed by counting `[`/`]` and `{`/`}` depth from the declaration point). Simpler than mixing two carve-outs; verified against the four cases above.

### 8.8 Complete allowlist table (author into the guard)

```ts
const ALLOWLIST_BY_FILE: Readonly<Record<string, readonly AllowlistEntry[]>> = Object.freeze({
  'src/features/arguments/gameCopy.ts': [
    { token: 'score',  literal: 'Do not score as proven yet', tag: 'operator-ruling-2026-08-04-#677 · anti-scoring-imperative' },
    { token: 'proven', literal: 'Do not score as proven yet', tag: 'operator-ruling-2026-08-04-#677 · anti-scoring-imperative' },
    { token: 'wrong',  literal: 'You might both be wrong',    tag: 'shipped-#676 · both-sides-humility-phrase' },
  ],
  'src/features/arguments/gameStatus.ts': [
    { token: 'wrong',  literal: 'You might both be wrong',    tag: 'shipped-#676 · both-sides-humility-phrase (STATUS_COPY mirror)' },
  ],
  'src/features/mediator/nextMovesForState.ts': [
    { token: 'honest', literal: 'Noting the record is unavailable keeps the shape honest.', tag: 'operator-ruling-2026-08-04-#677 · shape-adjective' },
  ],
});
```

That's **five entries** across three files. Every other file in the 25-file scan set is expected to be clean on the current tree (verified by grep §8).

### 8.9 Allowlist-completeness ratchet

Mirrors `cohesionPrinciple9Guard`'s "allowlist and on-disk in sync" test. Two assertions per allowlist entry:

1. The scan finds the allowlisted `(token, literal)` on disk in the named file. If a burn-down PR removed the literal, the stale allowlist entry surfaces here.
2. Every hit reported by the scanner for a file is EITHER (a) in the allowlist OR (b) reported as an offender. No third path.

---

## 9. File changes

**New files (2):**

- `__tests__/uxDoctrineCopyLint.test.ts` — the guard (est. **~500–600 lines** incl. the lexicon, scan set, allowlist, positive contract, firing control, must-not-fire control, allowlist completeness ratchet, and the string-extractor + ban-list-declaration stripper).
- `src/features/mediator/__fixtures__/uxDoctrineCopyLintFiring.positiveControl.ts.txt` — the firing fixture (est. **~30 lines**, mirrors the VOICE-003 pattern).

**Modified files (0).**

**Deleted files (0).**

No production `src/…` edit. No `app/` edit. No migration. No Edge Function. No script edit.

**Note on `copySystemBanList.test.ts`:** the pre-existing `__tests__/copySystemBanList.test.ts` (UX-COPY-SYSTEM-002 #754) is a NARROWER guard scanning ~15 tokens against ~15 constants. The new `uxDoctrineCopyLint.test.ts` is a SUPERSET (25 files × ~60 tokens across 11 groups). Both coexist. `copySystemBanList` is not removed — a shipped test dies with the codebase, and its focused §3.6 carve-out pins are useful invariants. Future consolidation could subsume it, but that's a follow-up.

---

## 10. API / interface contracts

The guard exports no public API. It's a `.test.ts` file consumed by Jest.

**Test structure** (mirrors `cohesionPrinciple9Guard.test.ts`):

```
describe('UX-DOCTRINE-COPY-LINT — visible-copy surface scan')
  it('the scan set covers all 25 files')
  it.each(SCAN_SET)('%s carries no banned doctrine token outside the allowlist', ...)

describe('UX-DOCTRINE-COPY-LINT — positive contract (canonical vocabulary present)')
  it('MEDIATOR_STATE_COPY has the 11 v4 display + 2 internal states with expected labels')
  it('PATHWAY_STEP_COPY has 7 pathway step verbs with expected labels')
  it('MOVE_COPY has 9 core move verbs with expected labels')
  it('brandCopy has the 5 canonical brand + mediator framing constants')

describe('UX-DOCTRINE-COPY-LINT — firing positive control (the scanner bites)')
  it('the .ts.txt fixture reports ≥5 distinct banned tokens across ≥3 roles')
  it('the .ts.txt fixture is NOT in the production scan set')

describe('UX-DOCTRINE-COPY-LINT — must-NOT-fire control (canonical strings pass clean)')
  it.each(CANONICAL_CLEAN_STRINGS)('%s does not trip the ban-list', ...)

describe('UX-DOCTRINE-COPY-LINT — allowlist completeness ratchet')
  it.each(ALLOWLIST_ENTRIES)('%s: allowlist and on-disk in sync', ...)
```

---

## 11. Edge cases

### 11.1 A new `*Copy.ts` file lands
The scan set is **explicitly enumerated**, not glob-based. A new `*Copy.ts` under `src/features/` requires an explicit add to the scan set. This is a deliberate ratchet: silent proliferation is caught by a reviewer noting "you added a new *Copy.ts but did not add it to the doctrine guard". The guard has a **completeness sanity check**:

```ts
it('every *Copy.ts under src/features is in the scan set OR the excluded list', () => {
  const allCopyFiles = walkForCopyTs();
  const covered = new Set([...SCAN_SET_TIER_A, ...EXPLICITLY_EXCLUDED]);
  for (const f of allCopyFiles) expect(covered).toContain(f);
});
```

`EXPLICITLY_EXCLUDED` starts with `['src/features/admin/adminSpecificityReadoutCopy.ts']` and is enumerated so the exclusion is documented per file.

### 11.2 A canonical mediator label is renamed
The positive contract asserts BYTE-EQUAL. A rename in `MEDIATOR_STATE_COPY.needs_evidence` from `'Needs evidence'` to `'Needs a source'` FAILS the positive-contract test. The reviewer chain sees the rename + the guard update in the same PR, and the doctrine review has a decision point ("is 'Needs a source' still doctrine-compliant?"). Correct behavior.

### 11.3 A banned token appears in a legitimate compound word
The word `intentional` starts with `intent`. Under `\b<token>\b` this fires (because `\b` is at the START of `intent`, but the END has `\b` between `t` and `i` — actually `\b` requires a word/non-word boundary; `intentional` has none between `t` and `i`, so `\bintent\b` does NOT match `intentional`). Verified: the pattern `\bintent\b` matches `intent` but NOT `intentional`. Fine as-is.

Edge case: `\bhonest\b` matches `honest` but not `honestly`? `honestly` has `honest` at the start with `l` after — `\b` between `t` and `l` is NO boundary (both are word chars). So `\bhonest\b` does NOT match `honestly`. Cleaner than expected. But: `dishonesty` — starts with `dis`; `honest` mid-word; `\bhonest\b` requires boundary before `h`. `i` and `h` are both word chars → no boundary → no match. So `dishonesty` does NOT trip `honest`. Same for `honesty`.

Result: whole-word bans are safe. **A grep sweep of the 25 scan-set files for `honest` returned only the `nextMovesForState.ts:98` shape-adjective case** (§8.5) — no legitimate `honestly`/`honesty`/`dishonesty` in visible copy. Verified.

### 11.4 Multi-line template literal spans a banned word across a newline
No visible-copy file uses cross-line template literals. Documented as acceptable limitation §5.5.

### 11.5 A banned token appears in a URL / testID / a11y hint
URLs are string literals: `'https://cdiscourse.com'` — no banned tokens. `testID` values (`'button-winner'`) would fire — but `testID` values are NOT visible copy; they're in `.tsx` files, which are NOT in the scan set. Grep of the 25 scan-set files for typical testID/URL patterns confirms no false-fire risk.

### 11.6 The doctrine-scanner apostrophe gotcha (memory: doctrine-scanner-apostrophe-gotcha.md)
This guard uses a proper regex string-literal extractor (§5.5), not a quote-parity heuristic like `uxOneOneTwoDoctrine`. The gotcha bites naive parity scanners; this guard is immune. **But** the guard file itself (`uxDoctrineCopyLint.test.ts`) must have apostrophe-free comments so it doesn't poison OTHER doctrine scanners running in the same jest process. Enforced by convention + code review; no test asserts this.

### 11.7 A banned token migrates into a legitimate carve-out inside a scanned file
Example: someone adds `'You are the winner'` to STATUS_COPY reasoning "it's fine, STATUS_COPY is exempt". But STATUS_COPY is NOT globally exempt — only the specific `mightBothBeWrong` LITERAL is. A new hit on `winner` inside STATUS_COPY fires. Correct behavior — the allowlist is per-`(path, token, literal)` triple, not per-constant-name.

### 11.8 An implementer adds a new banned token to the lexicon
The lexicon is authored inline in the guard. Adding a token to `_bannedDoctrineTokens()` (or the `BANNED_LEXICON_BY_GROUP` table) is a one-line PR. If the new token trips a shipped literal, the offender surfaces — the implementer must either (a) reword the literal (goes to a UX-COPY-follow card), or (b) add an allowlist entry with a doctrine-carve-out tag. Correct behavior.

### 11.9 The `admin/` path exclusion masks a real admin-visible violation
Admin surfaces have Era-D allowances (per Doctrine §10 admin doctrine). If a general-user surface accidentally routes through an admin-Copy file, that's a routing bug (the constant appears in a general-user surface) not a doctrine bug in the admin file. The path exclusion is safe.

---

## 12. Test plan

The card IS the test. No production tests are added or removed. Test file structure per §10.

### 12.1 Test-count expectation

- Firing positive control: 2 tests
- Must-not-fire control: ~4 tests (canonical strings that should pass clean)
- Scan-set completeness: 1 test
- Positive contract (canonical vocab present): 4 tests (`MEDIATOR_STATE_COPY`, `PATHWAY_STEP_COPY`, `MOVE_COPY`, brand)
- Per-file ban scan: `it.each` over 25 files = 25 tests
- Allowlist completeness ratchet: `it.each` over ~5 allowlist entries = ~5 tests
- Every *Copy.ts covered check: 1 test

**Estimated new test count: ~42.** All should pass on the current tree post-UX-COPY-001 (verified allowlist §8 covers all five known cases).

### 12.2 Doctrine ban-list assertions

The guard IS the doctrine ban-list assertion. It fires on the v4 doctrine-held strip verbatim. Confirming the guard passes on the current tree is the delivery.

### 12.3 Update expectations on `docs/core/current-status.md`

+1 test suite, +~42 tests. The implementer runs `npm run test` under the full suite to capture the new counted total and updates `docs/core/current-status.md` after the count is confirmed (test-discipline skill § "Test count tracking").

---

## 13. Dependencies (cards / docs / files)

**This design assumes:**
- **UX-COPY-001 is complete** — the shipped tree today already contains the copy edits UX-COPY-001 authored (tagline, "MOSTLY wrong" → "overstated", "an honest move" removed, "score" surface cleanups). Verified by §8 grep — the tree is clean modulo the 5 allowlist entries.
- The reality-audit trace in §8 is truthful. Re-verify with grep before commit.

**Reads existing:**
- `src/features/mediator/mediatorPlainLanguage.ts` — the source of the 11 v4 display state labels for the positive contract.
- `src/features/arguments/gameCopy.ts` — the source of `MOVE_COPY` and the allowlisted `platform_support_warning` + `mightBothBeWrong` literals.
- `src/features/arguments/gameStatus.ts` — the source of the mirror `both_might_be_wrong` literal.
- `src/features/mediator/nextMovesForState.ts` — the source of the `keeps the shape honest` literal.
- `src/lib/brandCopy.ts` — the source of the 5 brand + mediator framing constants for the positive contract.
- `__tests__/cohesionPrinciple9Guard.test.ts` — TEMPLATE for the ratchet structure.
- `__tests__/voice003ForbiddenInferenceGuard.test.ts` — TEMPLATE for the firing positive control + role-tally pattern.
- `__tests__/copySystemBanList.test.ts` — precedent for the STATUS_COPY carve-out rationale + banned-token flatten pattern.

**Will block future card:**
- No follow-up card is blocked by this. It's additive.

**Extends (per issue body):**
- RULE-007 #145 (rules doctrine)
- QOL-035 #204 (copy QOL)
- REF-ADR-001 #590 (mediator ADR)

**Does NOT depend on:**
- Any Edge Function deploy, any migration, any GATE-C classification.

---

## 14. Risks

### 14.1 The v4 design export says "9 mediator state labels" but the shipped tree has 11
Card body enumerates "the 9 state labels" from the v4 design export (L946). Post-UX-IMPASSE-002 (#710), the display vocabulary is 11 (added `key_detail_unavailable` and `value_tradeoff`). The design encodes the on-disk truth (11) as the positive contract to prevent false negatives. **Operator open question §14.5**: should the v4 design doc be updated to 11-state, or should the two additions be re-collapsed?

### 14.2 A false-positive from an unusual copy literal
The regex string-extractor is a single line pattern that handles single/double/backtick quotes but not sophisticated cases (escaped quotes, template-literal expressions). Verified against the 25 scan-set files — none carry such literals in visible-copy positions. If a future *Copy.ts adds one, the guard may miss a hit or over-report. Mitigation: the guard test suite runs on every PR; a regression surfaces immediately.

### 14.3 The ban-list-declaration stripper (§5.2 depth counter) is a lexer, not a parser
Depth-counting `[]` and `{}` fails if a comment inside the declaration contains an unbalanced bracket. Mitigation: the current tree's ban-list declarations don't have comments with unbalanced brackets. The stripper is line-based and forgiving — a false-negative here would UNDERCOUNT the strip range (a legitimate ban-list token would fire). If it happens, the fix is to add an explicit `SCAN_LADDER_START_LINE / END_LINE` per file. Documented as risk, not a blocker.

### 14.4 The allowlist becomes a dumping ground
The allowlist-completeness ratchet (§8.9) guards against stale entries (a burn-down PR that removes the literal but forgets to remove the allowlist entry surfaces here). Additions to the allowlist require a `tag` value citing operator-ruling / doctrine carve-out — the reviewer chain enforces this by convention. If the allowlist grows beyond ~10 entries without operator ruling tags, the reviewer should escalate.

### 14.5 The 9-vs-11 mediator label question (operator ruling deferred)
Not a code-time blocker. The guard as designed asserts the on-disk 11 labels; if the operator later rules "re-collapse to 9", the fix is a one-line edit to the positive-contract table. Documented as an open question in the completion report.

### 14.6 Jest test-file discovery of the .ts.txt fixture
The fixture uses `.ts.txt` — extension NOT matched by `testMatch` in jest.config or `.eslintignore`. Verified against the existing VOICE-003 fixture path pattern (which uses the same trick).

### 14.7 A future Tier C (JSX child-string scan) is a separate card
Per §4.3. If operator wants a JSX-string scan, that's a distinct card and needs an AST tool (ast-grep / ts-morph). Documented as an open item.

---

## 15. Out of scope (explicit)

- **Does not change any visible copy.** Non-goals per issue body. If a violation shows up in a scanned file that has no allowlist entry, the fix is a UX-COPY-001-follow card, not an inline edit in this branch.
- **Does not lint comments or ban-list declarations.** §5.2 + §5.3 carve them out explicitly.
- **Does not lint classifier code or engagement-intelligence ban-lists.** The `src/features/engagementIntelligence/**` tree carries banned tokens as ITS OWN ban-list; those are excluded by path (not in scan set).
- **Does not lint JSX-inlined strings** (Tier C — §4.3 non-goal for this card).
- **Does not lint admin-surface copy.** Path exclusion §5.1 (Era-D allowances).
- **Does not modify `copySystemBanList.test.ts`.** It coexists.
- **Does not add a new production runtime constant or a Copy file.**
- **No migration, no Edge Function, no deploy, no provider call, no `.env*` edit.**

---

## 16. Doctrine self-check

### 16.1 cdiscourse-doctrine

- **§1 (no truth labels; score never blocks posting).** The guard is a TEST — it never blocks posting. It never runs at posting time. It scans copy at CI-time. ✓
- **§1 (no service-role usage).** No Supabase, no service-role. Test-only. ✓
- **§7 (no AI calls from production app).** No Anthropic / xAI / X API. Test-only. ✓
- **§8 (Supabase conventions).** No migration, no RLS change. ✓
- **§9 (plain language).** The guard ENFORCES plain language by scanning for banned tokens. Every allowlist entry preserves plain-language framing. ✓
- **§10 (v1 scope).** Does not build voting/OAuth/push/search. ✓

### 16.2 evidence-doctrine

- **Amplification-not-evidence group** (`likes`, `viral`, `trending`, `popular`, etc.) — encoded as its own ban group. ✓
- **Person-labels** (`liar`, `dishonest`, `bad faith`, `manipulative`, `troll`, `bot`, `astroturfer`, `extremist`, `propagandist`) — encoded verbatim from the evidence-doctrine skill's banned-labels list. ✓

### 16.3 test-discipline

- **Tests are part of the deliverable.** ✓ (the deliverable IS a test.)
- **Test file lives in `__tests__/`.** ✓
- **Fixture lives beside a scanned file, quarantined by extension.** ✓
- **No `.skip` / `.only`.** ✓
- **Passes on the current tree.** Verified §8.
- **Test count goes UP, never down.** +42.

### 16.4 Accessibility (accessibility-targets skill relevance)

- Not a UI card. No a11y targets to hit directly. The guard preserves plain-language legibility indirectly (ban-list keeps user-facing copy free of internal codes and doctrine violations, which is a11y-adjacent).

---

## 17. Acceptance mapping (§12 style)

For each AC bullet in the card body, the section that satisfies it:

| AC bullet | Satisfied by |
|---|---|
| "A test fails when a banned construct appears in a visible-copy constant or rendered string, and passes on the post-UX-COPY-001 tree." | §7 (firing positive control) + §8 (current-tree allowlist proves the tree passes clean) + §12.1 (~42 tests including the per-file `it.each` scan) |
| "The allowed mediator vocabulary is asserted present (the 9-state labels exactly as the design names them)." | §6 (positive contract) — asserts the ACTUAL 11 v4 display labels (with §14.1 open question on the 9-vs-11 discrepancy) + the 7 pathway-step verbs + the 9 core move verbs + the 5 brand constants |
| "The carve-out demonstrably permits ban-list/comment/classifier occurrences (no false positive on existing legitimate uses)." | §5.2 (ban-list declaration stripper) + §5.3 (comment stripper) + §5.1 (path exclusions for classifier code) + §8 (current-tree allowlist verified by grep) |
| "Wire it into the existing test suite so CI fails on a banned visible string." | The guard is a `.test.ts` under `__tests__/` — jest picks it up automatically. The `it.each` per-file assertion fails the CI on any banned hit. |

---

## 18. Operator steps (post-implementer commit)

**None — pure test-only change.** No `npx supabase db push`, no `npx supabase functions deploy`, no env var, no manual dashboard step. The implementer commits the two new files (test + fixture); CI runs the test on the PR; merge = done.

Operator does need to answer the §14.5 open question (9 v 11 mediator vocabulary) if they want the design export updated — but it doesn't block this card.

---

## 19. Scanner-hazard note

- Use issue references as `(issue 677)` **not** `#677` in comments the guard file writes. `#` characters are unproblematic in this specific guard, but the shipped doctrine scanners (per memory `doctrine-scanner-apostrophe-gotcha.md`) misparse them in some paths. Convention: match `voice003ForbiddenInferenceGuard.test.ts` style — no `#` in comments; use `(issue 677)`.
- All comments in `uxDoctrineCopyLint.test.ts` and the `.ts.txt` fixture MUST be apostrophe-free. The naive quote-parity scanners (`uxOneOneTwoDoctrine` et al.) are poisoned by a stray apostrophe. This guard's own extractor is immune, but adjacent scanners running in the same suite are not.
- The fixture uses `.ts.txt` extension to stay out of TS compilation + ESLint recursion (proven pattern from VOICE-003/004).

---

## 20. Chain / handoff notes

- Branch: `feat/copy-doctrine-lint` (this worktree).
- Implementer prompt should require Skills(`cdiscourse-doctrine`, `test-discipline`, `evidence-doctrine`); reviewer prompt should re-run the guard against the current-tree tree and re-verify the §8 allowlist grep still surfaces exactly the five documented cases.
- Post-merge: this guard supersedes the narrower `copySystemBanList.test.ts` in coverage. Future card could consolidate, but leaving both in place is safe.
