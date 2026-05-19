# RULE-003 — Lifecycle-to-UX doctrine map

**Status:** Design draft
**Epic:** rules-ux
**Release:** 6.6
**Wave:** 3 (Game constraints)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/65

---

## Goal

RULE-003 ships the single source of truth that maps every LIFE-001 point-lifecycle state, every META-001 manual tag, and every META-001 auto-derived metadata code to a render-ready UX triple: `{ helperLine, iconHint, allowedDockActions[] }`. The plain-language `label` field on each entry is **not** newly authored — it reads through `getPointLifecyclePlainLabel(code)` / `getManualTagPlainLabel(code)` / `getAutoMetadataPlainLabel(code)`, which themselves read `PLAIN_LANGUAGE_COPY` in `src/features/arguments/gameCopy.ts`. RULE-003 is the layer that lets consumers (SC-003 cluster headers, SC-004 dock — already merged but uses its own helper copy table, ST-002 suggested-move chips, GAL-002 gallery cards, IX-002 keyboard hint surface, the upcoming RULE reference card) read one map and stay doctrine-clean by construction.

Doctrine constraints that shape the design (from `cdiscourse-doctrine`, `accessibility-targets`, `timeline-grammar`):

- **No verdict tokens** in any produced string (`label`, `helperLine`). Re-routed through `_forbiddenLifecycleTokens()` and `_forbiddenMetadataTokens()` — COPY-001 added `right` / `wrong` / `validated` to both helpers; RULE-003 consumes those updated bans.
- **No person-attribution** in any produced `helperLine`. The label describes the *cluster* or the *move structure*, never the author. Specifically: `ignored_by_negative` surfaces as "Negative did not respond" (cluster-level factual statement about a side), never as an accusation against a user.
- **No truth / popularity / heat language** as a label. (`hot` is OK only in the legitimate `GALLERY_SECTIONS` carveout per doctrine §2; in RULE-003 helper lines it is forbidden because the helper would slip into truth/correctness territory.)
- **No new state derivation.** RULE-003 is a constant-lookup module: pure data + three deterministic readers with no fallback strings (unknown code → `null`).
- **No allowed-action invention.** Every `allowedDockActions[]` value is a member of SC-004's existing `TimelineNodeActionDockActionCode` union — typed by `import type { TimelineNodeActionDockActionCode }` so the type system enforces it and refactors propagate.
- **R1 + R2 (COPY-001 audit §6) honored.** RULE-003 entries are tagged by semantic level (cluster vs move), and consumers MUST honor R1 (scope-strict positioning — cluster codes render in cluster bands only, move codes in move bands only) + R2 (same-label dedup — when both layers render the identical plain-language string on the same surface, the cluster wins, move chip is suppressed). The map itself documents which level each code belongs to; consumer code does the actual filtering.

The map is pure constants. No logic. No animation. No rendering. No persistence.

## Data model

### Module path

`src/features/rulesUx/lifecycleUxMap.ts` (confirmed — sibling to the existing `ruleToUiMap.ts`; no new directory).

No barrel file. The existing `src/features/rulesUx/` does not have an `index.ts`, and `ruleToUiMap.ts` is imported directly by `__tests__/ruleToUiMap.test.ts` (`from '../src/features/rulesUx/ruleToUiMap'`). RULE-003 follows the same pattern — consumers `import { LIFECYCLE_UX_MAP, getLifecycleUx } from 'src/features/rulesUx/lifecycleUxMap'`.

### Exported types

```ts
// Re-imported types (NOT re-defined):
import type { PointLifecycleState } from '../lifecycle';
import type { ManualTagCode, AutoMetadataCode } from '../metadata';
import type { TimelineNodeActionDockActionCode } from '../arguments/timelineNodeActionDockModel';

/**
 * Structural / positional / mood icon hints. NEVER a verdict glyph
 * (no `checkmark`, `x`, `crown`, `flame`, `thumbs_up`, `thumbs_down`).
 * Consumers choose the actual icon implementation; this is the SEMANTIC
 * vocabulary RULE-003 commits to.
 */
export type IconHint =
  // Structural — describe the move/cluster shape.
  | 'open_circle'           // open / awaiting reply
  | 'speech_bubble'         // has a reply / answered
  | 'hexagon'               // sourced / source_attached / has_evidence
  | 'document'              // quote attached / quote requested
  | 'dotted_hexagon'        // source_requested (asking for source)
  | 'dotted_document'       // quote_requested (asking for quote)
  | 'arrow_inward'          // narrowed / narrowed_claim (scope tightening)
  | 'arrow_handshake'       // conceded (concession given)
  | 'arrow_merge'           // confirmed / synthesis_ready / synthesis_candidate
  | 'arrow_branch'          // branch_recommended / branch_suggested / branch_created
  | 'question_mark'         // clarified / definition_issue / loaded_clarification
  | 'diamond'               // rebutted / has_rebuttal / challenge axis
  | 'double_diamond'        // has_counter_rebuttal
  | 'scope_brackets'        // scope_issue / scope axis
  | 'gear'                  // causal_mechanism / mechanism axis
  // Positional — describe board state.
  | 'pause_dots'            // moved_on / no_response / point_stalled
  | 'crossed_lines'         // ignored_by_both
  | 'fade'                  // ignored_by_*  (single side absence)
  | 'archive_box'           // archived_or_resolved
  | 'horizon'               // exhausted / point_exhausted
  | 'side_step'             // tangent / participant_skipped_node
  // Mood — neutral activity descriptors. NOT verdicts.
  | 'meter'                 // repeated_axis_pressure
  | 'spark'                 // synthesis_candidate (positive activity, not "winner")
  | 'eye'                   // ready_for_synthesis (signal observed)
  ;

/** Frozen list — tests iterate this to assert no verdict glyph leaked in. */
export const ALL_ICON_HINTS: ReadonlyArray<IconHint> = Object.freeze([
  'open_circle','speech_bubble','hexagon','document','dotted_hexagon',
  'dotted_document','arrow_inward','arrow_handshake','arrow_merge',
  'arrow_branch','question_mark','diamond','double_diamond','scope_brackets',
  'gear','pause_dots','crossed_lines','fade','archive_box','horizon',
  'side_step','meter','spark','eye',
]);

/**
 * Action vocabulary is SC-004's, re-aliased here so consumers don't import
 * deep into `arguments/`. The alias is `import type`, not re-export — the
 * canonical type still lives in `timelineNodeActionDockModel.ts`.
 */
export type DockAction = TimelineNodeActionDockActionCode;

/**
 * Per-lifecycle-state UX triple. `label` reads through
 * `getPointLifecyclePlainLabel(code)` at module-load time; helper /
 * iconHint / allowedDockActions are committed here.
 */
export interface LifecycleUxEntry {
  code: PointLifecycleState;
  /** Read from getPointLifecyclePlainLabel(code). NEVER overridden here. */
  label: string;
  /** ≤ 80 chars. Single-line tooltip / helper hint. Plain English. */
  helperLine: string;
  iconHint: IconHint;
  /**
   * Advisory list of dock actions that "make sense" for a node/cluster
   * sitting in this lifecycle state. SC-004's role/own-bubble/observer
   * gates still apply on top — this list NEVER overrides actor rules.
   * MAY be empty for terminal states (e.g. `archived_or_resolved`).
   */
  allowedDockActions: ReadonlyArray<DockAction>;
}

/** Per-manual-tag UX triple. No `allowedDockActions` — tags are participant
 *  annotations, not state. SC-004's MANUAL_TAG_ACTION_PROMOTION already
 *  maps tags to actions; RULE-003 does NOT shadow that. */
export interface ManualTagUxEntry {
  code: ManualTagCode;
  label: string;
  helperLine: string;
  iconHint: IconHint;
}

/** Per-auto-metadata UX triple. No `allowedDockActions` — auto-derived
 *  observations are surfaced as chips, not as state. */
export interface AutoMetadataUxEntry {
  code: AutoMetadataCode;
  label: string;
  helperLine: string;
  iconHint: IconHint;
}

export const LIFECYCLE_UX_MAP: Readonly<Record<PointLifecycleState, LifecycleUxEntry>>;
export const MANUAL_TAG_UX_MAP:  Readonly<Record<ManualTagCode, ManualTagUxEntry>>;
export const AUTO_METADATA_UX_MAP: Readonly<Record<AutoMetadataCode, AutoMetadataUxEntry>>;

/** Strict typed readers. NO fallback strings — unknown code → null. */
export function getLifecycleUx(code: PointLifecycleState): LifecycleUxEntry;
export function getManualTagUx(code: ManualTagCode): ManualTagUxEntry;
export function getAutoMetadataUx(code: AutoMetadataCode): AutoMetadataUxEntry;
```

### Content of the maps

All `label` values shown below are READ from `getPointLifecyclePlainLabel` / `getManualTagPlainLabel` / `getAutoMetadataPlainLabel` at module-load time — they are listed here so the implementer can sanity-check helper-line copy against the label. The label column is **derived**, not authored.

#### LIFECYCLE_UX_MAP (19 entries — every value in `ALL_POINT_LIFECYCLE_STATES`)

| code | label (derived) | helperLine | iconHint | allowedDockActions |
|---|---|---|---|---|
| `open` | Open for response | Nobody has replied to this yet. | `open_circle` | `['reply','challenge','ask_source','clarify','flag']` |
| `answered` | Has a reply | At least one reply landed on this cluster. | `speech_bubble` | `['challenge','clarify','ask_source','reply','flag']` |
| `rebutted` | Under pressure | A same-axis rebuttal is in play and has not been answered. | `diamond` | `['challenge','clarify','add_evidence','ask_source','flag']` |
| `clarified` | Clarified | A clarification has narrowed the question. | `question_mark` | `['reply','challenge','add_evidence','flag']` |
| `sourced` | Source attached | A primary source is attached to a move in this cluster. | `hexagon` | `['challenge','ask_quote','add_evidence','reply','flag']` |
| `quote_requested` | Quote requested | Someone asked for the exact passage. | `dotted_document` | `['ask_quote','clarify','add_evidence','reply','flag']` |
| `source_requested` | Source requested | Someone asked for a primary source. | `dotted_hexagon` | `['ask_source','clarify','add_evidence','reply','flag']` |
| `narrowed` | Narrowed | The claim was narrowed to a tighter scope. | `arrow_inward` | `['confirm','challenge','reply','flag']` |
| `conceded` | Conceded by author | The author conceded the broad point. | `arrow_handshake` | `['confirm','synthesize','reply','flag']` |
| `confirmed` | Confirmed by other side | The other side confirmed the repaired claim. | `arrow_merge` | `['synthesize','reply','flag']` |
| `synthesis_ready` | Ready for synthesis | The two sides have converged enough to summarise. | `eye` | `['synthesize','confirm','reply','flag']` |
| `moved_on_by_affirmative` | Affirmative moved on | Affirmative has not posted to this cluster in a while. | `pause_dots` | `['confirm','reply','synthesize','flag']` |
| `moved_on_by_negative` | Negative moved on | Negative has not posted to this cluster in a while. | `pause_dots` | `['confirm','reply','synthesize','flag']` |
| `ignored_by_affirmative` | Affirmative did not respond | Affirmative has an open request unanswered. | `fade` | `['reply','synthesize','flag']` |
| `ignored_by_negative` | Negative did not respond | Negative has an open request unanswered. | `fade` | `['reply','synthesize','flag']` |
| `ignored_by_both` | Nobody followed up | Both sides have stalled on the same open request. | `crossed_lines` | `['reply','synthesize','flag']` |
| `exhausted` | Out of new angles | Same-axis pressure has repeated without new information. | `horizon` | `['narrow','branch','synthesize','flag']` |
| `branch_recommended` | Branch suggested | Off-axis pressure has built up; a branch reads cleaner. | `arrow_branch` | `['branch','narrow','reply','flag']` |
| `archived_or_resolved` | Resolved | An admin or synthesis closed this cluster. | `archive_box` | `[]` |

Notes on the `archived_or_resolved` empty list: SC-004's dock keeps `reply` and `open_cards_detail` enabled even on archived clusters (the dock RECOMMENDS, never BLOCKS — see SC-004 design §"Doctrine anchor"). RULE-003's empty advisory list is the *recommended* set; SC-004's actor-matrix / lifecycle-state gate fills in the always-on actions. This is the intended layering — RULE-003 says "nothing actively recommended here"; SC-004 says "`reply` and `open_cards_detail` are always physically possible".

#### MANUAL_TAG_UX_MAP (10 entries — every value in `ALL_MANUAL_TAG_CODES`)

| code | label (derived) | helperLine | iconHint |
|---|---|---|---|
| `needs_source` | Needs source | A participant flagged this move as needing a primary source. | `dotted_hexagon` |
| `needs_quote` | Needs quote | A participant asked for the exact quoted passage. | `dotted_document` |
| `definition_issue` | Definition fight | A participant flagged that a key term is undefined or contested. | `question_mark` |
| `scope_issue` | Scope challenge | A participant flagged that the claim's scope is too broad. | `scope_brackets` |
| `causal_mechanism` | Mechanism challenge | A participant asked for the cause-and-effect mechanism. | `gear` |
| `evidence_debt` | Evidence debt | A participant flagged unresolved evidence on this move. | `meter` |
| `concession_offered` | Concession offered | The author offered a concession on this move. | `arrow_handshake` |
| `narrowed_claim` | Narrowed claim | The author narrowed the claim on this move. | `arrow_inward` |
| `tangent` | Tangent / side issue | A participant flagged this move as off-axis. | `side_step` |
| `ready_for_synthesis` | Ready for synthesis | A participant signalled the cluster is ready to summarise. | `eye` |

#### AUTO_METADATA_UX_MAP (16 entries — every value in `ALL_AUTO_METADATA_CODES`)

| code | label (derived) | helperLine | iconHint |
|---|---|---|---|
| `has_reply` | Has a reply | A reply was posted under this move. | `speech_bubble` |
| `has_rebuttal` | Has a challenge | A same-axis challenge was posted under this move. | `diamond` |
| `has_counter_rebuttal` | Has a counter-challenge | A counter-challenge was posted under this move. | `double_diamond` |
| `has_evidence` | Evidence attached | This move has an evidence artifact attached. | `hexagon` |
| `source_requested` | Source requested | This move asked for a primary source. | `dotted_hexagon` |
| `quote_requested` | Quote requested | This move asked for the exact passage. | `dotted_document` |
| `source_attached` | Source attached | This move has a primary source attached. | `hexagon` |
| `quote_attached` | Quote attached | This move has an exact quote attached. | `document` |
| `participant_skipped_node` | Same side skipped | The same side moved past this node without replying. | `side_step` |
| `no_response_after_n_turns` | No follow-up yet | No reply landed after the configured turn threshold. | `pause_dots` |
| `repeated_axis_pressure` | Repeated challenge on same axis | The same axis was challenged repeatedly without new information. | `meter` |
| `branch_suggested` | Branch suggested | Off-axis pressure suggests a branch would read cleaner. | `arrow_branch` |
| `branch_created` | Branch created here | A branch was opened from this move. | `arrow_branch` |
| `point_stalled` | Point stalled | This move has had no further activity for a while. | `pause_dots` |
| `point_exhausted` | Point exhausted | This move has no remaining direct moves available. | `horizon` |
| `synthesis_candidate` | Synthesis candidate | This move sits at a point where a summary would land. | `spark` |

### Reader contract

```ts
export function getLifecycleUx(code: PointLifecycleState): LifecycleUxEntry {
  // Direct typed lookup. The type system guarantees `code` is a member;
  // the map is keyed by `Record<PointLifecycleState, ...>` so the lookup
  // is total — NO fallback string, NO runtime branch for unknown codes.
  return LIFECYCLE_UX_MAP[code];
}
```

Same shape for `getManualTagUx` / `getAutoMetadataUx`. Because the input types come from frozen union types (`PointLifecycleState`, `ManualTagCode`, `AutoMetadataCode`) and the maps are `Record<Union, Entry>`, TypeScript guarantees totality. No `null` return, no fallback string — adding a new code to the union without adding a map entry is a **compile error**.

## File changes

- NEW: `src/features/rulesUx/lifecycleUxMap.ts` — the constants + readers + `IconHint` union + `ALL_ICON_HINTS` array. Estimated ~310 lines (3 maps × ~16 entries × ~5 lines each ≈ 240 lines of data + ~70 lines of types/readers/comments).
- NEW: `__tests__/lifecycleUxMap.test.ts` — coverage + ban-list + length-cap + cross-vocabulary tests. Estimated ~270 lines (described in detail in the Test plan below).
- NOT touched in v1 (consumer cards SC-003 / ST-002 / GAL-002 / IX-002 bind to the map in later cards):
  - `src/features/arguments/gameCopy.ts` — label authoring is COPY-001's territory; RULE-003 only reads.
  - `src/features/lifecycle/pointLifecycleModel.ts` — state vocabulary owner.
  - `src/features/metadata/moveMetadataLedger.ts` — tag/auto vocabulary owner.
  - `src/features/arguments/timelineNodeActionDockModel.ts` — SC-004's own helper-copy table + actor matrix stays put. RULE-003's `allowedDockActions[]` is *additional* advisory data, not a replacement.
  - `src/features/rulesUx/ruleToUiMap.ts` — RULE-001 stays untouched.
  - No barrel: `src/features/rulesUx/index.ts` would be new and the existing module pattern (direct file import) already works.
- No migration. No Edge Function. No `.env*`. No `supabase/`. No new dependency.

## API / interface contracts

### What consumers do

```ts
// SC-003 cluster header (future card):
import { getLifecycleUx } from 'src/features/rulesUx/lifecycleUxMap';
const ux = getLifecycleUx(cluster.state);
// Render verbatim: ux.label (NEVER override); ux.helperLine (NEVER reauthor);
// ux.iconHint (lookup icon via consumer's icon registry).
// ux.allowedDockActions is advisory — actual dock filtering happens in SC-004.

// ST-002 suggested-move chip (future card):
const ux = getAutoMetadataUx(autoCode);
// R1 (scope-strict): only render auto-metadata UX in the per-move chip band.
// R2 (same-label dedup): suppress this chip if the cluster header already shows
//   the same ux.label string for the same cluster.
```

### Consumer contract (encoded in JSDoc on the readers + in this design doc)

1. **Read verbatim.** Consumers MUST render `ux.label` / `ux.helperLine` exactly as returned. No string concatenation that changes meaning, no localization rewrites in v1, no inline "you / your / they" injection.
2. **Honor R1 (scope-strict positioning, COPY-001 audit §6).** Cluster-scope codes (lifecycle states) render only in cluster-header bands. Move-scope codes (manual tags, auto metadata) render only in per-move chip bands. The map's TYPE encodes the level — `LifecycleUxEntry` for cluster, `ManualTagUxEntry` / `AutoMetadataUxEntry` for move. Consumers that ignore this commit a doctrine slip; SC-004 already proves the pattern with `CLUSTER_LEVEL_AUTO_CODES` / `MOVE_LEVEL_AUTO_CODES`.
3. **Honor R2 (same-label dedup, COPY-001 audit §6).** When a single dock / chip strip would render the cluster-scope label `"Has a reply"` (via `answered`) AND a move-scope chip with the same label `"Has a reply"` (via `has_reply`) on the same render, the move-scope chip is suppressed. The map exposes the labels; consumers compare strings and dedup. RULE-003 does NOT centralize the dedup logic — that lives in each consumer (SC-004 already implements it).
4. **`allowedDockActions[]` is ADVISORY only.** SC-004's actor matrix (own-bubble / observer / etc.) still applies on top — RULE-003 NEVER overrides SC-004's role logic. If `LIFECYCLE_UX_MAP['conceded'].allowedDockActions` includes `'synthesize'` and the viewer is the bubble author (`self`), SC-004's `actorRule('self', 'synthesize')` decides whether to enable or grey the button.
5. **R5 (axis-vs-manual-tag dedup, COPY-001 audit §6) deferred to consumers.** RULE-003 does NOT encode R5 — it ships labels for both axis codes (via RULE-001's `ruleToUiMap.ts`) and manual-tag codes (this map). When ST-002 / SC-004 render an axis chip + a manual-tag chip with shared semantic root, they apply R5 themselves. Per COPY-001 audit §4.7: R5 is hygiene, not doctrine; v1 fallback is "render both chips, no dedup" — doctrine-clean.

## Edge cases

1. **A future LIFE-001 state added without a RULE-003 entry.** The `LIFECYCLE_UX_MAP: Readonly<Record<PointLifecycleState, LifecycleUxEntry>>` typing makes this a TypeScript compile error. The coverage test (`for (const code of ALL_POINT_LIFECYCLE_STATES) ...`) catches it at runtime in the unlikely case the type assertion is bypassed. Both fail loudly; neither path silently falls back.
2. **A future META-001 manual tag / auto code added without a RULE-003 entry.** Same — `Readonly<Record<ManualTagCode, ManualTagUxEntry>>` typing is total; coverage tests assert every member of `ALL_MANUAL_TAG_CODES` / `ALL_AUTO_METADATA_CODES` resolves.
3. **A manual tag that should not surface in normal-user UI** (e.g. an operator-only or admin-only tag added later). RULE-003 STILL provides a full UX entry — `label`, `helperLine`, `iconHint`. Whether the consumer surface chooses to render it is a consumer decision (driven by `MANUAL_TAG_ELIGIBILITY` in META-001 + the consumer's role-aware filter). The doctrine guarantee is: if a code exists in the vocabulary, RULE-003 has plain-language UX for it.
4. **An icon hint that is verdict-like (`checkmark`, `x`, `crown`, `flame`, `trophy`, `thumbs_up`, `thumbs_down`, `shield`, `warning_triangle`).** The `IconHint` union explicitly excludes all of these. A test enumerates `ALL_ICON_HINTS` and scans for banned glyph names. Adding a verdict-shaped hint requires updating the union (compile error if not added) AND the ban list — and the test will refuse the new glyph.
5. **A helper line longer than 80 chars.** A length-cap test asserts every `helperLine` is ≤ 80 chars. The 80-char target comes from the accessibility-targets skill (one-line tooltip / accessibility hint convention) and from SC-004's existing 80-char a11y label budget.
6. **A helper line containing the underscored code itself** (e.g. `helperLine: "branch_recommended fires when ..."`). A regex scan (`/[a-z]+_[a-z]+/`) catches accidental snake_case leakage.
7. **A helper line that describes the *person* instead of the *cluster* / *move*** (e.g. `"You should reply to this"`, `"The author is dodging"`). A person-attribution token-list scan refuses these. The token list: `"you "`, `" your "`, `" they "`, `" their "`, `" he "`, `" she "`, `"the user"`, `"the author"`, `"the poster"`. The scan looks at lowercase `helperLine` with word boundaries.
8. **A helper line that uses heat / popularity language as a quality signal** (e.g. `"This is a hot take"`, `"Trending challenge"`). Disallowed in `helperLine` because doctrine §2 says heat = activity, and a helper line that says "hot" implies correctness. The doctrine carveout that allows `hot` in `GALLERY_SECTIONS` does NOT extend to RULE-003 — the test asserts `hot` / `viral` / `popular` / `trending` / `engagement` are absent from every helper line. Documented as a known nuance.
9. **`allowedDockActions: []` (terminal state).** Explicitly allowed for `archived_or_resolved`. Test asserts at-least-one entry with empty array AND at-least-one entry with ≥ 2 actions.
10. **Concurrent edits / persistence.** Not applicable — the map is a frozen module-load constant. No reads from the DB, no async, no caching.
11. **Offline / network failure.** Not applicable — pure data.

## Test plan

File: `__tests__/lifecycleUxMap.test.ts`. Imports:

```ts
import {
  ALL_POINT_LIFECYCLE_STATES,
  getPointLifecyclePlainLabel,
  _forbiddenLifecycleTokens,
} from '../src/features/lifecycle';
import {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
  _forbiddenMetadataTokens,
} from '../src/features/metadata';
import {
  ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  LIFECYCLE_UX_MAP,
  MANUAL_TAG_UX_MAP,
  AUTO_METADATA_UX_MAP,
  ALL_ICON_HINTS,
  getLifecycleUx,
  getManualTagUx,
  getAutoMetadataUx,
  type IconHint,
} from '../src/features/rulesUx/lifecycleUxMap';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
```

### Coverage tests (no hardcoded vocabularies)

1. `every PointLifecycleState in ALL_POINT_LIFECYCLE_STATES has a LIFECYCLE_UX_MAP entry`
2. `every ManualTagCode in ALL_MANUAL_TAG_CODES has a MANUAL_TAG_UX_MAP entry`
3. `every AutoMetadataCode in ALL_AUTO_METADATA_CODES has an AUTO_METADATA_UX_MAP entry`
4. `LIFECYCLE_UX_MAP has no extra keys beyond ALL_POINT_LIFECYCLE_STATES`
5. `MANUAL_TAG_UX_MAP has no extra keys beyond ALL_MANUAL_TAG_CODES`
6. `AUTO_METADATA_UX_MAP has no extra keys beyond ALL_AUTO_METADATA_CODES`

### Label parity (the no-drift contract)

7. `every LIFECYCLE_UX_MAP[code].label === getPointLifecyclePlainLabel(code)` — iterate `ALL_POINT_LIFECYCLE_STATES`.
8. `every MANUAL_TAG_UX_MAP[code].label === getManualTagPlainLabel(code)` — iterate `ALL_MANUAL_TAG_CODES`.
9. `every AUTO_METADATA_UX_MAP[code].label === getAutoMetadataPlainLabel(code)` — iterate `ALL_AUTO_METADATA_CODES`.

These three tests are the cardinal anti-drift guarantee. They make it impossible to invent a new label in RULE-003 without updating `PLAIN_LANGUAGE_COPY` first.

### Ban-list assertions (doctrine)

10. `every helperLine across all three maps passes _forbiddenLifecycleTokens()` — the lifecycle helper has a slightly larger ban surface and is fine for both layers.
11. `every helperLine across all three maps passes _forbiddenMetadataTokens()` — second pass with the metadata helper for symmetry.
12. `every label across all three maps passes both ban-lists` (defensive — labels already come from `PLAIN_LANGUAGE_COPY` which passes the bans via existing tests, but RULE-003 re-asserts to catch a future regression).

### Snake_case / internal-code scan

13. `no helperLine contains snake_case identifier shape /[a-z]+_[a-z]+/` — catches accidental `branch_recommended` / `no_response_after_n_turns` leaks.
14. `no helperLine returns true from looksLikeInternalCode(helperLine)` — defensive belt + braces.

### Person-attribution scan

15. `no helperLine contains second-person / third-person attribution tokens` — token list: `'you '`, `' your '`, `' they '`, `' their '`, `' he '`, `' she '`, `'the user'`, `'the author'`, `'the poster'`. The scan lowercases the helper line and uses literal `.includes()`. (Note: "the author" is allowed in the manual-tag helpers describing what the author DID on their own bubble — but RULE-003's helper lines deliberately phrase those as "A participant flagged…" / "The same side skipped…" / structural descriptions. The test enforces this.)

### Heat / popularity / engagement scan

16. `no helperLine contains heat / popularity / engagement tokens` — token list: `'hot'`, `'viral'`, `'popular'`, `'trending'`, `'engagement'`. Doctrine §2 carves out `hot` in `GALLERY_SECTIONS` only; RULE-003 helper lines do not get the carveout, because a helper line that says "hot" implies correctness. Documented in the test comment.

### Length cap

17. `every helperLine.length is ≤ 80 chars` — one-line tooltip budget per accessibility-targets.

### Icon hint validation

18. `every iconHint in every map is a member of ALL_ICON_HINTS` — runtime assert, complements the type system.
19. `ALL_ICON_HINTS contains no verdict glyph names` — scan for `'checkmark'`, `'check'`, `'x_mark'`, `'cross'`, `'crown'`, `'trophy'`, `'flame'`, `'thumbs_up'`, `'thumbs_down'`, `'shield'`, `'warning'`, `'star'`, `'medal'`, `'gavel'`. (Note: `'meter'`, `'spark'`, `'eye'`, `'fade'`, `'horizon'` are deliberately neutral mood/structural names.)

### Allowed-action cross-check (lifecycle map only)

20. `every allowedDockActions[] entry is a member of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES` — runtime assert, complements the `DockAction` type alias.
21. `allowedDockActions[] does NOT include 'expand_branch' or 'mark_moved_on' or 'mark_ignored' for any lifecycle state` — those are SC-004 v1-disabled or collapsed-stub-only primitives; recommending them from RULE-003 would mislead. (See SC-004 design — `mark_moved_on` / `mark_ignored` are disabled for every actor in v1; `expand_branch` is only meaningful on `collapsed_stub` targets.)
22. `at least one lifecycle state has allowedDockActions: []` — specifically `archived_or_resolved`.
23. `at least one lifecycle state has allowedDockActions.length ≥ 3` — proves the non-empty path.
24. `no allowedDockActions[] contains a duplicate code` — sanity check.

### Reader contract

25. `getLifecycleUx returns the exact frozen entry for each code` — `Object.is` reference-equal against the map.
26. `getManualTagUx returns the exact frozen entry for each code`.
27. `getAutoMetadataUx returns the exact frozen entry for each code`.

### Doctrine anchor / cross-map sanity

28. `the three maps have disjoint code keys across the lifecycle vocabulary` — `ALL_POINT_LIFECYCLE_STATES`, `ALL_MANUAL_TAG_CODES`, `ALL_AUTO_METADATA_CODES` are independent unions; but `synthesis_ready` / `quote_requested` / `source_requested` deliberately appear in BOTH lifecycle AND auto-metadata per COPY-001 audit §4.5. The test asserts: shared codes (`synthesis_ready`, `quote_requested`, `source_requested`) MUST produce the same `label` in both maps (because both go through `PLAIN_LANGUAGE_COPY[code]`), and MAY have different `helperLine` (the lifecycle helper describes the cluster; the auto helper describes the move). This is the cross-level reuse documented in COPY-001 audit §4.5.
29. `LIFECYCLE_UX_MAP entries are deeply frozen` — `Object.isFrozen(LIFECYCLE_UX_MAP['open'])` is true; mutating an entry at runtime throws in strict mode.

Estimated final test count: ~29 distinct `it()` blocks. Existing baseline is **1805 tests**; RULE-003 adds approximately +29 → ~1834.

## Dependencies (cards / docs / files)

- **Reads from LIFE-001** (`src/features/lifecycle/pointLifecycleModel.ts`) — `PointLifecycleState`, `ALL_POINT_LIFECYCLE_STATES`, `getPointLifecyclePlainLabel`, `_forbiddenLifecycleTokens`. Status: merged.
- **Reads from META-001** (`src/features/metadata/moveMetadataLedger.ts`) — `ManualTagCode`, `AutoMetadataCode`, `ALL_MANUAL_TAG_CODES`, `ALL_AUTO_METADATA_CODES`, `getManualTagPlainLabel`, `getAutoMetadataPlainLabel`, `_forbiddenMetadataTokens`. Status: merged.
- **Reads from SC-004** (`src/features/arguments/timelineNodeActionDockModel.ts`) — `TimelineNodeActionDockActionCode`, `ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES`. Status: merged.
- **Reads from COPY-001** (`docs/copy-review/plain-language-labels-pass-1.md` audit §6) — R1, R2, R3, R5 are the consumer contract. The audit lists RULE-003 in the rule-consumption matrix as required for R1, R2, R3, R5 (R4 is N/A — RULE-003 doesn't surface runner statuses). Status: merged (commit `f516afd`).
- **Reads `PLAIN_LANGUAGE_COPY`** indirectly via the three plain-label helpers. RULE-003 NEVER reads the map directly — all label lookups route through the typed helpers so a future rename of the `PLAIN_LANGUAGE_COPY` key set doesn't silently break RULE-003.
- **Blocks SC-003** (cluster header) — SC-003 design must bind to `LIFECYCLE_UX_MAP` for the cluster header's `helperLine` + `iconHint`.
- **Blocks ST-002** (suggested-move chips) — ST-002 binds to `MANUAL_TAG_UX_MAP` + `AUTO_METADATA_UX_MAP` for chip copy; must apply R1 + R2 itself.
- **Blocks GAL-002** (gallery source-trail buckets) — GAL-002 may surface lifecycle UX on gallery cards.
- **Blocks IX-002** (keyboard hint surface) — IX-002 may surface `helperLine` as the on-focus hint for a lifecycle-state badge.

## Risks

- **The `IconHint` union is opinionated.** A consumer might want an icon that isn't in the list. Mitigation: the union is intentionally narrow + structural — adding a new hint requires updating `IconHint` + `ALL_ICON_HINTS` together in a single commit, and the ban-glyph test refuses verdict-shaped additions. The implementer should NOT inline new hints — they must extend the union deliberately.
- **`allowedDockActions[]` may drift from SC-004's lifecycle → action table.** SC-004 owns `LIFECYCLE_PRIMARY_ACTION_TABLE` (primary + fallback per lifecycle); RULE-003's `allowedDockActions[]` is a broader advisory list (multiple actions, not just primary + fallback). Tests don't assert exact equality — they assert subset membership in `ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES`. The implementer should make sure RULE-003's lifecycle entries' `allowedDockActions[]` are a SUPERSET of SC-004's `LIFECYCLE_PRIMARY_ACTION_TABLE[state].primary` + `.fallback` — a spot-check test could add this if drift is observed in v1.1.
- **Helper lines may need localization in v2.** v1 is English-only. The string-literal data shape works fine for an eventual i18n layer (extract → translate → return same shape).
- **No barrel file means consumers import deep into `src/features/rulesUx/lifecycleUxMap`.** That mirrors how RULE-001 (`ruleToUiMap.ts`) is consumed today. If the rulesUx feature grows to 3+ files, a v1.1 follow-up could add `index.ts`. Not required in this card.
- **Heat-token nuance (test #16).** Doctrine §2 allows `hot` in `GALLERY_SECTIONS`; RULE-003 bans `hot` in helper lines. The test comment must document the carveout so a future implementer reading the test doesn't think the ban-list is inconsistent.

## Out of scope

- **No UI rendering** of the map. SC-003, ST-002, RULE-002 (separate card), GAL-002, IX-002 consume it later.
- **No state transition logic.** That is LIFE-001's territory.
- **No new validation behavior.** That belongs in the constitution engine / RULE-001 / RULE-002.
- **No persistence.** Pure constants; no DB columns, no migrations.
- **No animation hints.** `iconHint` is a semantic string; the visual animation (pulse, fade, scale) is the consumer's choice.
- **No R5 (axis-vs-manual-tag dedup) encoding in v1.** Per COPY-001 audit §4.7 and §6, R5 is hygiene, not doctrine; the v1 fallback ("render both chips") is doctrine-clean. RULE-003 ships labels for both layers and lets consumers (ST-002, SC-004) implement R5 on their own surface. Documented as a follow-up.
- **No barrel `index.ts`** for `src/features/rulesUx/`. Direct file import is the existing pattern (RULE-001 is imported the same way).
- **No new manual tags / auto metadata codes / lifecycle states.** RULE-003 only maps the existing vocabulary. New codes land with the cards that introduce them.
- **No relabeling.** Labels come from `PLAIN_LANGUAGE_COPY` via the typed helpers — RULE-003 is read-only on that table.

## Doctrine self-check

Walking every relevant doctrine point:

- **cdiscourse-doctrine §1 (score is gameplay, never truth).** RULE-003's labels (read from `PLAIN_LANGUAGE_COPY`) contain no truth tokens (already enforced by COPY-001's `_forbiddenLifecycleTokens` / `_forbiddenMetadataTokens`). RULE-003's `helperLine` adds new authored copy — bans re-enforced via tests #10, #11, #12, #15. `helperLine` never says "right" / "wrong" / "validated" / "correct" / "true" / "false" / "winner" / "loser".
- **cdiscourse-doctrine §2 (heat = activity, never correctness).** Heat-token scan (test #16) refuses `hot` / `viral` / `popular` / `trending` / `engagement` in any helper line. The `GALLERY_SECTIONS` carveout for `hot` does NOT extend here.
- **cdiscourse-doctrine §3 (popularity is not evidence).** No metric / engagement language in any helper line. The auto-metadata helpers describe move structure ("A reply was posted", "Source attached"), never engagement ("Lots of replies", "Trending challenge").
- **cdiscourse-doctrine §4 (AI moderator limits).** RULE-003 has no AI calls. Pure constants.
- **cdiscourse-doctrine §5 (rules engine is sacred).** RULE-003 does NOT touch `src/lib/constitution/engine.ts`. Pure-TS module with zero engine imports.
- **cdiscourse-doctrine §6 (secrets policy).** No env reads. No network. No keys.
- **cdiscourse-doctrine §7 (no AI calls from production app).** RULE-003 is in `src/features/rulesUx/`, not `scripts/bot-fixtures/`, and contains no external API calls of any kind.
- **cdiscourse-doctrine §8 (Supabase conventions).** No DB touched. No migration.
- **cdiscourse-doctrine §9 (plain language for users).** All `helperLine` strings are plain English; the snake_case scan (test #13) catches any internal-code leak.
- **cdiscourse-doctrine §10 (v1 scope guards).** No voting / collab editing / OAuth / public API / push / search. Pure label map.
- **timeline-grammar (no truth labels on nodes).** Icon vocabulary deliberately excludes verdict glyphs (`checkmark`, `x`, `crown`, `flame`, `trophy`, `thumbs_up`, `thumbs_down`). The structural / positional / mood vocabulary covers every code without leaking truth claims.
- **accessibility-targets (helper-line length).** Helper lines capped at 80 chars (test #17) to fit the one-line tooltip / a11y-hint budget.
- **expo-rn-patterns (pure-TS model file).** `lifecycleUxMap.ts` is `*Model.ts`-shaped — no React, no Supabase, no fetch, no platform-specific code, no new dependency.
- **test-discipline (tests as deliverable).** ~29 new tests ship with the implementation card; coverage + parity + ban-list + length + glyph + action-vocab + reader-contract + cross-map sanity all covered.
- **COPY-001 audit §6 (R1, R2, R3, R5).** RULE-003 is named in COPY-001's rule-consumption matrix (line 113 of `docs/copy-review/plain-language-labels-pass-1.md`) as a required consumer for R1, R2, R3, R5. R1 + R2 are encoded structurally — the map TYPE communicates the semantic level (cluster vs move), so a consumer that imports `LifecycleUxEntry` is reading cluster-scope UX, and one that imports `ManualTagUxEntry` / `AutoMetadataUxEntry` is reading move-scope UX. R3 (provenance suffix) is honored — labels stay identical across `evidence_debt` axis vs `evidence_debt` manual tag; provenance is a CONSUMER concern, not a label concern. R5 (axis-vs-manual-tag dedup) deferred to consumers per audit §4.7.

## Operator steps (if any)

None — pure code change. No migration, no Edge Function deploy, no env var, no secret.
