# UX-IMPASSE-001 — Dignified structured-impasse states

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (design-package slate)
**Release:** P1 / effort M / lane model-UI-copy
**Issue:** https://github.com/<owner>/debate-constitution-app/issues/689

---

## Goal (one paragraph)

Make the **structured-impasse** family of mediator states read as a calm, dignified,
*complete* destination — not a failure, deadlock, defeat, or verdict. A structured
impasse says: *the disagreement is preserved clearly, and no available next move would
test it further yet*, while always keeping the door open to **continue** if a new source,
shared definition, narrower claim, or branch appears. This card is a **language + display
clarification** over the already-shipped mediator stack (UX-MEDIATOR-001…005,
UX-SELECTED-NODE-001, UX-NEXT-MOVE-001, UX-BOARD-RAIL-001). It does **not** rebuild the
mediator stack, does **not** change board topology, does **not** add a screen, and does
**not** add persistence or a classifier. It tightens the impasse-subtype copy that the
existing surfaces render and decides, per impasse type, whether that copy is
**display-derivable today** or must **defer**. Doctrine shaping it: impasse is a
*structural* state, never a truth/verdict (cdiscourse-doctrine §1); the engine is the sole
gate and the board never blocks posting (§1); copy is person-neutral and advisory; an
insufficient signal collapses to **Open**, never to a *stronger* impasse claim.

> **Scope reality:** the issue #689 title says "build the Structured Impasse full *screen*."
> The card prompt (operator) **narrows** that to a copy + display-mapping clarification on
> the *existing* surfaces (node chip / Inspect / selected-node detail / rail row / next-move
> card) with **no board-topology change and no new screen**. This design follows the prompt's
> narrowed scope. A standalone full-screen impasse destination — if still wanted — is a
> separate UX-BOARD-RAIL-002 / new-screen card (see Deferrals). The dignified-end framing
> the issue asks for is delivered here through copy on the surfaces that already exist.

---

## ⚠️ §3 GATE — Per-type DERIVABLE-NOW vs DEFER verdict (read first)

This is the load-bearing decision. For each impasse type: is it display-derivable **today**
from data the board already produces (the 13 `MediatorStateCode`s + `v4DisplayStateFor` +
the shipped pathway / evidence-debt / lifecycle model), or does it need NEW
derivation / classifier / persistence?

| # | Impasse type | Internal source that already exists | Derivable **now**? | Verdict |
|---|---|---|---|---|
| 1 | **Structured impasse** | `structured_impasse` fires from lifecycle `exhausted` + Gate A demotion (`buildPointStateCandidates` L335-336; `decidePointState` L445-449). `deriveImpasseMarkers` already emits `StructuredImpasse[]`. `v4DisplayStateFor` keeps it as-is. | **Yes** — fully shipped state + markers + pathway. | **SHIP NOW (copy)** |
| 2 | **Evidence blocked** | `evidence_blocked` fires from a declined (`unresolved`) debt (L338-340). Copy already shipped in UX-MEDIATOR-003 (`MEDIATOR_STATE_HELPER.evidence_blocked`, rail `blockedEvidencePath`, `nextMovesForState`). | **Yes** — already on-surface. | **KEEP SHIPPED (no change unless conflict — none found)** |
| 3 | **Different priorities** (`value_tradeoff`) | `value_tradeoff` IS computed internally (value axis / value observation, L398-402) but `V4_DISPLAY_STATE_BY_CODE.value_tradeoff = 'open'` (L180) → it **collapses to Open** for display today. Surfacing "Different priorities" requires a **display-mapping decision** (see Open Questions Q1). | **Computable today, but NOT surfaced** — needs a deliberate display-map change. | **DEFER the surfacing decision to operator (Q1); ship the copy constant ready, do NOT flip the map without sign-off** |
| 4 | **Narrowed but unresolved** | `narrowed` fires from lifecycle `narrowed`/`conceded` (L394-395). It survives `v4DisplayStateFor` unchanged and already renders (chip + rail + next-move). "Unresolved child" = the point's `state` is still `narrowed` (not `resolved_or_settled`) AND its pathway has an available step — both already in `DisagreementPoint`. | **Yes** for "Narrowed"; the "smaller remaining point" is already the point's live (non-resolved) state. A *separate* per-child node link is NOT modeled and is out of scope. | **SHIP NOW (copy)** |
| 5 | **Accounts differ** | `accounts_differ` is **reserved**: `RECOLLECTION_KEYS` is empty in v1, so the candidate at L351 **never fires** (comment L350). No detector, no persistence. | **No** — never synthesized; the type is reserved with no producer. | **DEFER — do NOT invent. Future classifier/persistence card.** |
| 6 | **Key detail unavailable** | `key_detail_unavailable` fires from a `flags_context_limit` observation (family D, L344-348). It exists but `v4DisplayStateFor` collapses it to `evidence_blocked` for display (L176). | **Computable today**, but currently *folded into* "Evidence blocked" for display. Surfacing it distinctly is the same kind of display-map decision as Q1 (see Open Questions Q2). | **DEFER the distinct-surfacing decision (Q2); keep folding into Evidence blocked for now.** |
| 7 | **No current pathway** | This is the *condition under which* `structured_impasse` stands: `deriveImpasseMarkers` only emits when `pathway.anyAvailable === false` (L572), and Gate A demotes impasse whenever any non-impasse, non-`open` pathway is available (`anyNonImpassePathwayAvailable` L422-428). A pure helper can therefore PROVE "no available step" from the already-derived `pathwaysByPointId`. | **Yes** — provable from shipped pathway data, no new derivation. | **SHIP NOW (copy)** — render as the impasse "no available step" line; do **not** invent a separate `no_current_pathway` state. |

**Summary verdict:** **SHIP NOW** — Structured impasse (#1), Evidence blocked (#2, keep),
Narrowed (#4), No current pathway (#7, as the impasse condition line). **DEFER** —
Different priorities (#3, operator display-map decision Q1), Key detail unavailable
(#6, operator display-map decision Q2), Accounts differ (#5, no producer → future
classifier/persistence card). No new persisted impasse subtype, no "mark impasse" write,
no classifier ships in this card.

---

## Data model

**No new data model.** No new type, no field, no migration, no persisted state.

- `MediatorStateCode` (13), `V4MediatorStateCode` (9), `V4_DISPLAY_STATE_BY_CODE`,
  `StructuredImpasse`, `ResolutionPathway.anyAvailable`, `DisagreementPoint.state` — all
  **unchanged** and **reused**.
- The card adds only **frozen copy constants** (strings) and at most one **pure display
  helper** (see File changes), both pure-TS, JSON-serializable, no I/O.

The §4 operator-locked copy already exists almost verbatim in `nextMovesForState`
(`NEXT_MOVE_COPY` / `NEXT_MOVE_RATIONALE`): `preserve_disagreement`, `reopen_with`,
`separate_memory`, `name_verify`, `branch_provable`, `name_record_kind`, `continue_smaller`,
`concede_resolved`. This card aligns the **lead/help** copy (currently in
`MEDIATOR_STATE_HELPER`) to the §4 wording and adds the impasse "no available step" line.

---

## File changes

All changes are **copy / display-mapping / pure-helper / tests**. No `src/` behavior change,
no `app/` change, no `supabase/` change.

**Modified — copy alignment (no behavior change):**

- `src/features/mediator/mediatorPlainLanguage.ts` (~+25 / -8 lines) — align
  `MEDIATOR_STATE_HELPER` lead/help for the impasse family to the §4 operator-locked
  wording; add an impasse "no available next move" **lead** + **help** + **next** line set
  (a new frozen `IMPASSE_SUBTYPE_COPY` block keyed by display state, see API). The
  ban-list (`_forbiddenMediatorTokens`) is **kept**; the new copy is scanned by it.
  `evidence_blocked` copy is **left as shipped** (#003) unless review finds a conflict
  (none found — see Doctrine self-check).

- `src/features/mediator/mediatorRailCopy.ts` (~+10 lines) — add an impasse-specific row
  lead/next pair so the rail row for a `structured_impasse` point shows the dignified
  "The disagreement is preserved." + reopen line **instead of an empty "Move forward:"**
  (today `nextStepLabelFor` returns `''` for impasse because the only pathway step is
  `await_record`/unavailable — DisagreementPointsRail L255-263). This is **copy on an
  existing surface row**, not a new row, not relocation.

- `src/features/mediator/nextMovesForState.ts` (~+4 / -0 lines, copy only) — confirm /
  align the `structured_impasse` and `accounts_differ` move labels to §4. (Today they
  already read "Preserve the disagreement" / "Reopen with a source, definition, or
  narrower claim" / "Separate memory from records" / "Name what could verify it" —
  this is a copy *audit*, likely zero functional diff; align rationale wording only if
  it drifts from §4.)

**New — pure display helper (only if needed; see Open Question Q3):**

- `src/features/mediator/impasseSubtypeDisplay.ts` (~60-90 lines) — a pure function
  `impasseSubtypeFor(point, pathway)` that returns the **dignified impasse copy set**
  (chip / lead / help / next) for a point whose **display** state is `structured_impasse`
  (or `evidence_blocked`/`narrowed` when the surface wants the dignified framing). It
  reads ONLY the already-derived `DisagreementPoint` + its `ResolutionPathway`
  (`anyAvailable`) — no derivation, no I/O. It is the single source the chip / Inspect /
  rail / next-move surfaces read so the wording stays in lockstep. **If review decides the
  existing `MEDIATOR_STATE_HELPER` + `nextMovesForState` already cover every surface
  cleanly (they nearly do), this file is unnecessary and the card is pure copy — prefer
  that.** (Recommendation: ship as a thin constant module, NOT a new derivation, to keep
  the "smallest-safe delta" — see Smallest-safe delta.)

**New — tests:**

- `__tests__/mediator/impasseDignifiedCopy.test.ts` — copy + ban-list + dignity assertions.
- (extends) `__tests__/mediator/mediatorPlainLanguage.test.ts` if present — coverage of the
  new copy block.

**Wiring (display-only, in existing slots — no new surface):**

- `src/features/arguments/ArgumentGameSurface.tsx` (~+6 / -2 lines, optional) — if the
  rail-impasse line and the Inspect impasse line should read from one helper, pass the
  impasse copy set into the **already-mounted** `MediatorNodeInspectDetail` /
  `MediatorNextMovesCard` / rail props. **No new component, no topology change, no new
  Inspect section** — the existing `SelectedNodeInspectDrawer` "Move forward:" /
  "Why this state" slots already render the impasse case. Prefer the smallest touch: if the
  copy modules carry the dignified strings, the surfaces already pick them up via the
  shipped `helperForMediatorState` / `nextMovesForState` calls and this file may need **zero**
  change.

---

## API / interface contracts

**New frozen copy block (in `mediatorPlainLanguage.ts`):**

```ts
/** Dignified impasse-family copy, keyed by the v4 DISPLAY state it dresses.
 *  chip = MEDIATOR_STATE_COPY label (unchanged); lead/help/next are the §4
 *  operator-locked, person-neutral, ban-list-clean strings. */
export const IMPASSE_SUBTYPE_COPY: Readonly<Record<
  'structured_impasse' | 'evidence_blocked' | 'narrowed' | 'no_current_pathway',
  { chip: string; lead: string; help: string; next: string }
>> = Object.freeze({
  structured_impasse: {
    chip: 'Structured impasse',
    lead: 'The disagreement is preserved.',
    help: 'No available next move would test this point further yet.',
    next: 'Reopen with a source, shared definition, or narrower claim.',
  },
  evidence_blocked: { // KEEP shipped #003 copy; mirror here for one-source reads
    chip: 'Evidence blocked',
    lead: 'The evidence path is not available right now.',
    help: 'Name what kind of record would test this point, without demanding private access.',
    next: 'Mark evidence unavailable, or branch the provable part.',
  },
  narrowed: {
    chip: 'Narrowed',
    lead: 'The disagreement is smaller now.',
    help: 'Continue on the remaining point.',
    next: 'Continue on the smaller point, or concede the resolved part.',
  },
  no_current_pathway: {
    chip: 'No current pathway',
    lead: 'No available step would test this further yet.',
    help: 'The point can be reopened if a source, shared definition, or narrower claim appears.',
    next: 'Preserve the disagreement.',
  },
});
```

> `no_current_pathway` here is **a copy key, not a new state**. It dresses a
> `structured_impasse` point and is selected purely from `pathway.anyAvailable === false`.
> Surfaces choose `structured_impasse` vs `no_current_pathway` copy by whether any pathway
> step exists at all (impasse-with-prior-form vs nothing-actionable). See Open Question Q4 —
> recommendation is to use the single **Structured impasse** copy for both and treat
> `no_current_pathway` copy as a reserved alternate (avoids chip soup).

**Deferred copy (constant present, NOT wired into the display map):**

```ts
// DEFERRED — surfaced only if Open Question Q1 is approved by the operator.
export const VALUE_TRADEOFF_DISPLAY_COPY = Object.freeze({
  chip: 'Different priorities',
  lead: 'This is a value tradeoff.',
  help: 'Name the priority at stake instead of asking for a source.',
  next: 'State the tradeoff clearly.',
});
// DEFERRED — accounts_differ has NO producer in v1 (RECOLLECTION_KEYS empty).
export const ACCOUNTS_DIFFER_DISPLAY_COPY = Object.freeze({
  chip: 'Accounts differ',
  lead: 'The accounts do not line up.',
  help: 'Separate what each person remembers from what a record could test.',
  next: 'Name what could verify it.',
});
// DEFERRED — key_detail_unavailable currently folds into Evidence blocked (Q2).
export const KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY = Object.freeze({
  chip: 'Key detail unavailable',
  lead: 'A key detail is not available.',
  help: 'Branch the parts that can still be tested.',
  next: 'Branch the provable part.',
});
```

**Optional pure helper signature (if adopted):**

```ts
// impasseSubtypeDisplay.ts — pure, no I/O, deterministic.
export function impasseDignifiedCopyFor(
  point: Pick<DisagreementPoint, 'state'>,
  pathway: Pick<ResolutionPathway, 'anyAvailable'> | null | undefined,
): { chip: string; lead: string; help: string; next: string } | null;
// Returns the IMPASSE_SUBTYPE_COPY entry when v4DisplayStateFor(point.state) is one of
// {structured_impasse, evidence_blocked, narrowed}; null otherwise (caller renders nothing).
```

**No existing signature changes.** `v4DisplayStateFor`, `nextMovesForState`,
`helperForMediatorState`, `getNodeMediatorMarker`, rail props — all unchanged.

---

## MAPPING TABLE (per surface)

Columns: **Surface · current implementation · desired v4 impasse behavior · source/model hook ·
impasse type · exact copy · copy-to-avoid · behavior-touched · data/API-touched · safe-now/deferred · test coverage**

| Surface | Current implementation | Desired v4 impasse behavior | Source/model hook | Impasse type | Exact copy | Copy-to-avoid | Behavior-touched | Data/API-touched | Safe-now / deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| **Node chip** (`MediatorNodeMarker` via `getNodeMediatorMarker`) | Shows `structured_impasse` chip with a left-rule (geometry) calm treatment (`wrapImpasse`); label from `MEDIATOR_STATE_COPY`. `accounts_differ`/`value_tradeoff`/`open`/`resolved` suppressed. | Same chip, same calm geometry. Label stays **"Structured impasse"**. No change beyond confirming the calm treatment + the suppression of non-impasse states. | `getNodeMediatorMarker` → `v4DisplayStateFor` → `MEDIATOR_STATE_COPY.structured_impasse` | Structured impasse | chip: `Structured impasse` | deadlock / failure / decided / winner / loser | **N** | **N** | **Safe now** (no change; confirm) | chip label test; ban-list; impasse keeps calm geometry |
| **Inspect "Why this state"** (`MediatorNodeInspectDetail`) | Renders `marker.label` + `helper` (`helperForMediatorState`) + optional "What would help next:" line; `wrapImpasse` left-rule for impasse; impasse pathway is unavailable so the next line is omitted. | For impasse: lead **"The disagreement is preserved."** + help **"No available next move would test this point further yet."** + next **"Reopen with a source, shared definition, or narrower claim."** | `helperForMediatorState('structured_impasse')` (aligned to §4) | Structured impasse / No current pathway | lead/help/next as §4 | failure / deadlock / lost / not decided-as-verdict | **N** (copy only) | **N** | **Safe now** | helper copy test; ban-list; impasse renders dignified lead+help+next |
| **Inspect "Move forward:"** (`MediatorNextMovesCard` via `nextMovesForState`) | For impasse renders `preserve_disagreement` (dominant) + `reopen_with`, both `available:false` → guidance text, not pressable. | Keep. Audit labels to §4: **"Preserve the disagreement"** + **"Reopen with a source, definition, or narrower claim"**. Guidance-only (no new action). | `nextMovesForState('structured_impasse')` | Structured impasse | "Preserve the disagreement" / "Reopen with a source, definition, or narrower claim" | decide for me / AI judge / verdict | **N** | **N** | **Safe now** (copy audit, likely 0 diff) | next-move copy test; ban-list; availability=false stays guidance |
| **Selected-node detail** (`SelectedNodeInspectDrawer` slots) | Sections the four Inspect siblings; "Move forward:" header suppressed when the inline next-move line already shows. | No structural change. The dignified impasse copy flows through the existing "Why this state" + "Move forward:" slots. | composes `MediatorNodeInspectDetail` + `MediatorNextMovesCard` | Structured impasse | (inherits above) | (inherits) | **N** | **N** | **Safe now** (no wrapper change) | render test: impasse drawer shows dignified copy, no empty section |
| **Disagreement Points rail row** (`DisagreementPointRow`) | Impasse row shows the chip + `viewInTimeline`, but **no "Move forward:" line** (`nextStepLabelFor` returns `''` because impasse's only step is unavailable). | Add a dignified impasse line on the row: lead **"The disagreement is preserved."** + reopen next **"Reopen with a source, shared definition, or narrower claim."** Rendered in the existing row body (no new row, no relocation). | rail reads `point.state==='structured_impasse'` (via `v4RowBadgeLabel`) + `pathway.anyAvailable===false`; copy from `mediatorRailCopy` | Structured impasse / No current pathway | rail lead+reopen as §4 | failure / deadlock / loser / score | **N** (copy on existing row) | **N** | **Safe now** | rail render test: impasse row shows dignified line instead of empty Move-forward |
| **Evidence blocked (all surfaces)** | Shipped #003 copy: chip "Evidence blocked", help "The evidence path is not available right now…", rail `blockedEvidencePath`. | **KEEP as shipped.** Confirm it reads dignified (it does). | `evidence_blocked` (declined debt) | Evidence blocked | (shipped #003 copy) | hiding / withheld / refused / failed | **N** | **N** | **Keep shipped** | existing #003 tests + ban-list re-run |
| **Narrowed (all surfaces)** | `narrowed` chip "Partially narrowed"; help "Part of this was conceded or narrowed; a smaller disagreement remains."; next-move `continue_smaller` + `concede_resolved`. | Align lead to **"The disagreement is smaller now."** + help **"Continue on the remaining point."**; keep next-moves. (Chip "Partially narrowed" vs §4 "Narrowed" — see Q5.) | `narrowed` (lifecycle narrowed/conceded) | Narrowed but unresolved | lead/help as §4; next "Continue on the smaller point" / "Concede the resolved part" | failure / defeat / conceded-as-loss | **N** (copy) | **N** | **Safe now** | narrowed copy test; ban-list |
| **Different priorities** (`value_tradeoff`) | `value_tradeoff` computed internally but `v4DisplayStateFor`→`open`; surfaces show it as Open (no chip). | **DEFERRED.** Copy constant authored (`VALUE_TRADEOFF_DISPLAY_COPY`) but NOT wired into `V4_DISPLAY_STATE_BY_CODE`. Surfacing it needs Q1 sign-off (it changes a node from "no chip" to "Different priorities chip"). | would require `V4_DISPLAY_STATE_BY_CODE.value_tradeoff` change | Different priorities | chip "Different priorities"; "This is a value tradeoff."; "Name the priority at stake instead of asking for a source."; "State the tradeoff clearly." | source-demand / score / winner | (deferred) | (deferred) | **Deferred → Q1** | constant-shape + ban-list test only (not wired) |
| **Key detail unavailable** | `key_detail_unavailable` computed (family D context-limit) but `v4DisplayStateFor`→`evidence_blocked`. | **DEFERRED.** Folds into Evidence blocked today; distinct surfacing needs Q2. | would require display-map change | Key detail unavailable | chip "Key detail unavailable"; "A key detail is not available."; "Branch the parts that can still be tested."; "Branch the provable part." | failure / unprovable-as-verdict | (deferred) | (deferred) | **Deferred → Q2** | constant-shape + ban-list test only |
| **Accounts differ** | `accounts_differ` reserved; **never fires** (`RECOLLECTION_KEYS` empty); suppressed at node-marker level. | **DEFERRED — do NOT invent.** No producer exists. Copy constant authored for the future card only. | needs a NEW recollection classifier + (likely) persistence | Accounts differ | chip "Accounts differ"; "The accounts do not line up."; "Separate what each person remembers from what a record could test."; "Name what could verify it." | liar / dishonest / failure / memory-as-fault | **Deferred** | **Deferred** | **Deferred → future classifier card** | constant-shape + ban-list test only (no wiring; assert it stays unproduced) |
| **No current pathway** | Implicit: impasse only stands when `pathway.anyAvailable===false`. | Render as the impasse "no available step" line (alternate copy of Structured impasse). A pure read of `pathwaysByPointId[id].anyAvailable`. | `ResolutionPathway.anyAvailable` (already derived) | No current pathway | "No available step would test this further yet." + reopen | failure / dead-end / give-up | **N** | **N** | **Safe now** (copy; recommend folding into Structured impasse — Q4) | helper test: `anyAvailable===false` → dignified preserve line |

---

## State → impasse guidance (the §3 mapping, restated for the implementer)

```
display state (v4DisplayStateFor(point.state))     →   impasse copy + surface behavior
─────────────────────────────────────────────────────────────────────────────────────
structured_impasse                                 →   IMPASSE_SUBTYPE_COPY.structured_impasse
  AND pathwaysByPointId[id].anyAvailable === false →   (same; optionally no_current_pathway alt — Q4)
evidence_blocked                                   →   KEEP shipped #003 copy (mirror in IMPASSE_SUBTYPE_COPY)
narrowed                                           →   IMPASSE_SUBTYPE_COPY.narrowed (lead/help align; keep next-moves)
value_tradeoff (internal) → 'open' (display)       →   DEFERRED (Q1): Open / ordinary next-move today
key_detail_unavailable (internal) → 'evidence_blocked' (display) → DEFERRED (Q2): Evidence blocked today
accounts_differ                                    →   DEFERRED: never produced; do not synthesize
open / resolved_or_settled / anything else         →   Open / ordinary next-move (NOT a stronger impasse)
insufficient / unknown signal                      →   Open (fallback) — never escalate to impasse
```

**Insufficient → Open fallback (doctrine):** when the board cannot place a point in a
specific impasse subtype, it stays `open` and shows the ordinary next-move set
(`nextMovesForState('open')` → "Respond to the exact point" / "Ask a clarifying question").
The card **never** escalates an ambiguous point to a stronger impasse claim. This mirrors
the shipped `buildPointStateCandidates` behavior (`open` is always the fallback candidate,
L404-405) — the card adds no new escalation path.

---

## Where each impasse type appears

- **Node chip** (`MediatorNodeMarker`): Structured impasse only (calm left-rule geometry).
  Evidence blocked also shows as a chip. Narrowed shows as a chip. `accounts_differ` /
  `value_tradeoff` / `key_detail_unavailable` do **not** show a distinct chip today
  (suppressed / collapsed) — unchanged by this card.
- **Inspect "Why this state"** (`MediatorNodeInspectDetail`): dignified lead + help for
  the active node's impasse-family state.
- **Inspect "Move forward:"** (`MediatorNextMovesCard`): the guidance next-moves
  (Preserve / Reopen for impasse; Continue smaller / Concede for narrowed).
- **Selected-node detail** (`SelectedNodeInspectDrawer`): hosts the two Inspect blocks
  above; no structural change.
- **Disagreement Points rail row** (`DisagreementPointRow`): the dignified impasse line
  replaces today's empty "Move forward:" for impasse points.
- **Next-move card** (`nextMovesForState`): the move list source for both Inspect and any
  rail next-step (one source of truth).

---

## Smallest-safe delta

Prefer **copy-only**, in this order, stopping at the smallest set that delivers the
dignified framing on every surface:

1. **Align `MEDIATOR_STATE_HELPER`** lead/help for `structured_impasse` + `narrowed`
   to §4. (Surfaces already call `helperForMediatorState` — they pick this up with **zero
   component change**.) — *required.*
2. **Add the impasse reopen line to the rail** (`mediatorRailCopy` + a copy read in
   `DisagreementPointRow` for `point.state==='structured_impasse'` with
   `pathway.anyAvailable===false`). — *required* (fixes the empty "Move forward:" row).
3. **Audit `nextMovesForState`** impasse/narrowed labels against §4 (likely 0 functional
   diff). — *required (audit), code change only if drift.*
4. **Author the deferred copy constants** (`VALUE_TRADEOFF_DISPLAY_COPY`,
   `ACCOUNTS_DIFFER_DISPLAY_COPY`, `KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY`) but **do not
   wire** them — they exist so the future card / operator decision (Q1/Q2) is a one-line
   map flip, not a re-author. — *recommended.*
5. **Optional thin helper** `impasseDignifiedCopyFor` only if review finds the four
   surfaces would otherwise duplicate the lead/help/next strings. **Recommendation: skip
   the helper; the shipped `helperForMediatorState` + `nextMovesForState` + the rail copy
   already cover all four surfaces from one source each.** Adopt the helper only to remove
   duplication, never to add derivation.

**Files for the implementer (smallest path):** `mediatorPlainLanguage.ts` (copy),
`mediatorRailCopy.ts` (copy) + the one rail-row copy read in `DisagreementPointsRail.tsx`,
`nextMovesForState.ts` (copy audit), and tests. `ArgumentGameSurface.tsx` likely needs
**zero** change (it reads the copy via the shipped helpers). No new component, no new
screen, no topology change.

---

## No chip soup / no topology change (confirmation)

- **One chip per node** is preserved — the card adds no new chip type to the timeline.
  `getNodeMediatorMarker` still returns exactly one marker; impasse remains a single calm
  chip. `value_tradeoff` / `accounts_differ` / `key_detail_unavailable` distinct chips are
  **deferred**, so no new chips appear.
- **No board / timeline topology change** — no lane, no node placement, no branch, no
  rail relocation, no column, no timeline flex/width/scroll change. Every edit is a string
  or a copy read inside an existing row/slot.
- **No new Inspect section** — the dignified copy uses the existing "Why this state" /
  "Move forward:" slots of `SelectedNodeInspectDrawer`.

---

## Edge cases

- **Impasse with zero prior pathway ever** vs **impasse after form was followed** — both
  render the same dignified Structured-impasse copy; the card does not distinguish "never
  had a pathway" from "exhausted a pathway" beyond the optional `no_current_pathway`
  alternate copy (Q4 recommends folding both into Structured impasse).
- **A point flips out of impasse** (a new source/definition/narrower claim arrives → Gate A
  demotes impasse, pathway becomes available) — the surfaces re-read the derived board and
  the dignified copy disappears automatically; the reopen promise is honored by the
  existing derivation, not by this card.
- **`value_tradeoff` point today** — shows as **Open** (no chip), ordinary next-move. The
  card does **not** silently start showing "Different priorities" (that is Q1). No regression.
- **`accounts_differ`** — never appears (no producer). A test asserts it stays unproduced so
  a future accidental wiring is caught.
- **Empty board / no points** — rail shows its shipped empty state
  (`emptyHelper` already mentions "reach a structured impasse"); unchanged.
- **Internal-code leak** — every new string is scanned by `looksLikeInternalCode` (already
  applied in `MediatorNodeMarker` / `MediatorNodeInspectDetail`) and by the ban-list test.
- **Reduce-motion / a11y** — no new motion; impasse calm geometry is a static left-rule
  (already reduce-motion-safe). New copy adds no interactive element, so no new tap target;
  the rail row remains a single `Pressable` (jump) with its existing 44×44 hitSlop. New
  guidance text is `accessibilityRole="text"` (matches `MediatorNextMovesCard` pattern).

---

## Test plan

- `__tests__/mediator/impasseDignifiedCopy.test.ts`:
  - **Structured impasse copy** — `IMPASSE_SUBTYPE_COPY.structured_impasse` equals the §4
    lead/help/next verbatim; `helperForMediatorState('structured_impasse')` reflects the
    aligned wording.
  - **Narrowed copy** — lead/help match §4; next-moves include "Continue on the smaller
    point" + "Concede the resolved part".
  - **No current pathway** — given a point with `state==='structured_impasse'` and a
    pathway with `anyAvailable===false`, the dignified preserve line is produced; with an
    available pathway, the point is NOT an impasse (defensive parity with `deriveImpasseMarkers`).
  - **Insufficient → Open** — `nextMovesForState('open')` (and an unknown state) yields the
    neutral move set, never an impasse line.
  - **Ban-list** — every new/aligned string passes `_forbiddenMediatorTokens()` AND the
    explicit §5 ban-list (`deadlock`, `failure`, `failed`, `wrong`, `bad faith`,
    `dishonest`, `liar`, `truth`, `verdict`, `winner`, `loser`, `score`, `fallacy`,
    `decide for me`, `AI thinks`, `AI judge`, `credibility`, `intent`, plus
    emotion/tone/anger/voice tokens). Reuse the `nextMovesForState` person-attribution ban.
  - **Deferred constants are NOT wired** — assert `V4_DISPLAY_STATE_BY_CODE.value_tradeoff
    === 'open'` and `.key_detail_unavailable === 'evidence_blocked'` are UNCHANGED (the
    deferred copy exists but does not alter display); assert `accounts_differ` never appears
    in a derived board from a fixture lacking recollection keys.
  - **Evidence blocked unchanged** — the shipped #003 copy strings are byte-identical
    (regression guard).
- **Rail render test** (extend existing `DisagreementPointsRail` test): an impasse-point
  fixture renders the dignified preserve/reopen line in the row body (not an empty
  "Move forward:"), with the existing single jump `Pressable` and testIDs intact.
- **Inspect render test** (extend `MediatorNodeInspectDetail` test): impasse marker renders
  dignified lead + help; impasse next-move guidance is non-pressable (availability=false).
- `npm run typecheck` + `npm run lint` clean; test count goes **up**.

---

## Dependencies (cards / docs / files)

- **Assumes UX-MEDIATOR-001 complete** — relies on `v4DisplayStateFor`,
  `V4_DISPLAY_STATE_BY_CODE`, the 13→9 precedence, and the impasse Gate A demotion.
- **Assumes UX-MEDIATOR-002 complete** — node chip + `getNodeMediatorMarker` + the calm
  impasse geometry (`MediatorNodeMarker.wrapImpasse`).
- **Assumes UX-MEDIATOR-003 complete** — evidence-blocked copy (KEPT) + rail evidence lines.
- **Assumes UX-MEDIATOR-004 complete** — definition/scope bridge copy (untouched).
- **Assumes UX-MEDIATOR-005 complete** — `DisagreementPointsRail` + `mediatorRailCopy`
  (the impasse reopen line is added here).
- **Assumes UX-SELECTED-NODE-001 complete** — `SelectedNodeInspectDrawer` (slots reused).
- **Assumes UX-NEXT-MOVE-001 complete** — `nextMovesForState` already carries the impasse
  + accounts-differ §4 move labels (audited, not rebuilt).
- **Reads** `deriveMediatorBoardState.ts` at `buildPointStateCandidates` /
  `deriveImpasseMarkers` / `pathwayForState` (to understand derivability; does not modify).
- **Extends #64 (GAME-001) + #146 (GAME-007)** — builds on the shipped state/type; does
  not re-implement the state machine.
- **Blocks**: a future "value_tradeoff display surfacing" card and an "accounts_differ
  classifier" card consume the deferred copy constants authored here.

---

## Risks

- **Issue/prompt scope mismatch** — the issue asks for a full *screen*; the prompt narrows
  to copy/display on existing surfaces. The implementer must follow the **prompt** (no new
  screen). Flagged in Goal + Open Questions Q6.
- **Empty "Move forward:" rail row for impasse** — today the rail shows nothing for impasse
  because the only pathway step is unavailable. The fix is a copy read keyed on
  `point.state` + `anyAvailable`; ensure it does not accidentally render for non-impasse
  points (test guards this).
- **Chip-label drift** — `MEDIATOR_STATE_COPY.narrowed` is "Partially narrowed" but §4 says
  "Narrowed"; `MEDIATOR_STATE_COPY.accounts_differ` is "Difference of recollection" but §4
  says "Accounts differ". Changing a shipped chip label may break existing label tests
  (UX-MEDIATOR-002/005). See Q5 — recommend keeping shipped chip labels and applying §4
  wording only to **lead/help/next** (not the chip) unless the operator wants the chip
  relabeled (then update the existing tests in the same commit).
- **Deferred-constant temptation** — an implementer might wire the deferred copy. Tests
  assert the display map is unchanged to catch this.
- **One-source helper over-engineering** — adding `impasseSubtypeDisplay.ts` as a *derivation*
  would duplicate `deriveImpasseMarkers`. Keep it a constant/selector if adopted at all.

---

## Out of scope

- A standalone full-screen Structured Impasse destination (new route/screen).
- "Save resolution" / "Set reopen trigger" **persisted** actions (the issue mentions them;
  any write is a GATE-C operator-gated slice — deferred).
- Surfacing `value_tradeoff` as "Different priorities" (deferred → Q1).
- Surfacing `key_detail_unavailable` distinctly from Evidence blocked (deferred → Q2).
- An `accounts_differ` recollection detector / classifier / persistence (deferred).
- Any board/timeline topology, lane, branch, rail-relocation, or column change.
- Any change to `evidence_blocked` copy beyond confirming it (KEEP #003).
- Submit-path, room/seat/chime-in, schema/RLS/auth, Supabase, MCP, provider, Family K/J.
- New tappable next-move chooser with new action semantics (UX-NEXT-MOVE-002).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict; score never blocks; advisory only)** —
  Impasse is a *structural* state; every copy line describes the disagreement's shape, never
  who is right. No string asserts true/false/winner/loser/decided. The board never gates a
  post; all new copy is advisory guidance. ✔
- **§1 (engine is sole gate)** — no engine import, no derivation change, no submission path
  touched. The reopen promise is honored by the *existing* Gate A demotion, not by new gating. ✔
- **§9 (plain language; no internal codes)** — every new string is plain English; impasse
  display reads through `MEDIATOR_STATE_COPY` / `helperForMediatorState`; `looksLikeInternalCode`
  guards already applied; ban-list test scans the new copy. ✔
- **§10a (Observations vs Allegations)** — impasse is a machine-derived **Observation**; no
  copy implies a person made a claim; person-attribution ban-list (from `nextMovesForState`)
  reused. ✔
- **§5 ban-list (this card)** — `deadlock / failure / failed / wrong / bad faith / dishonest /
  liar / truth / verdict / winner / loser / score / fallacy / decide for me / AI thinks /
  AI judge / credibility / intent / emotion-tone-anger-voice` — none appear in any §4 copy;
  enforced by test. The §4 copy is person-neutral and dignified by construction. ✔
- **accessibility-targets** — no new motion (impasse calm geometry is static); new copy is
  `accessibilityRole="text"`; the rail row keeps one `Pressable` with 44×44 hitSlop; color is
  never the only signal (impasse left-rule geometry persists). ✔
- **test-discipline** — copy + ban-list + render + deferred-guard tests; count goes up;
  no `.skip`/`.only`. ✔
- **v1 scope guards** — no voting/winner, no search, no OAuth, no push, no public API, no AI
  call from the app. ✔

---

## Open questions for the operator (with recommendations)

- **Q1 — `value_tradeoff` → "Different priorities" display mapping.** Surfacing it means
  flipping `V4_DISPLAY_STATE_BY_CODE.value_tradeoff` from `'open'` to a distinct display
  state, which changes value-axis nodes from **no chip** to a **"Different priorities" chip**
  on the timeline + rail. That is a *visible behavior change* (more chips), not pure copy.
  **Recommendation: DEFER.** Author the copy constant now (done), keep the map at `'open'`,
  and decide in a follow-up whether value-tradeoff deserves its own chip (risk: chip soup /
  implying a value difference is a *state to resolve* when it may simply be a stance). If the
  operator wants it now, it is a one-line map flip + chip-label test + a "Different priorities"
  entry in `NODE_MARKER_PRIORITY` — small, but it IS a display-behavior change, so it should
  be its own reviewed slice.
- **Q2 — `key_detail_unavailable` distinct from "Evidence blocked".** Same shape as Q1:
  flipping `V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable` from `'evidence_blocked'` to a
  distinct display state. **Recommendation: DEFER** — folding into Evidence blocked is
  dignified and avoids a near-duplicate chip; surface distinctly only if user testing shows
  the conflation confuses (then a small reviewed slice).
- **Q3 — adopt the thin `impasseSubtypeDisplay.ts` helper, or stay pure-copy?**
  **Recommendation: stay pure-copy.** The shipped `helperForMediatorState` + `nextMovesForState`
  + the rail copy already deliver every surface from one source. Add the helper ONLY if the
  reviewer finds string duplication across surfaces.
- **Q4 — separate "No current pathway" copy, or fold into "Structured impasse"?**
  **Recommendation: FOLD** into Structured impasse for the chip (avoid two near-identical
  chips = chip soup); keep `no_current_pathway` copy as a reserved alternate constant for a
  future card that wants to distinguish "exhausted form" from "no pathway ever".
- **Q5 — relabel shipped chips to §4 wording?** §4 implies chip "Narrowed" (shipped:
  "Partially narrowed") and "Accounts differ" (shipped: "Difference of recollection").
  **Recommendation:** apply §4 wording to **lead/help/next only**; keep the shipped CHIP
  labels to avoid breaking UX-MEDIATOR-002/005 label tests — UNLESS the operator wants the
  chip text changed, in which case update those tests in the same commit.
- **Q6 — confirm "no new screen."** The issue title says "full screen"; the prompt says
  copy/display on existing surfaces. **Recommendation:** proceed with the prompt's narrowed
  scope (no new screen); if a full-screen dignified destination is still wanted, file it as a
  UX-BOARD-RAIL-002 / new-screen card.

---

## Deferrals (explicit)

- **Different priorities surfacing** (`value_tradeoff` display map) → Q1 / future small slice.
- **Key detail unavailable surfacing** (display map) → Q2 / future small slice.
- **Accounts differ** → future **classifier + (likely) persistence** card (no producer today;
  do NOT invent).
- **Save resolution / Set reopen trigger persisted writes** → **GATE-C operator-gated** slice
  (any DB write), preceded by a semantics assessment.
- **Standalone full-screen impasse destination / board-topology changes** → **UX-BOARD-RAIL-002**.
- **Tappable next-move chooser with new action semantics** → **UX-NEXT-MOVE-002**.
- **Granular impasse detection needing a classifier** (recollection, value-vs-fact split) →
  future **MCP / design card**.

---

## Operator steps (if any)

**None — pure code change (copy + tests).** No migration, no Edge Function deploy, no env
var. The card ships display copy + tests only; no Supabase write, no service-role, no
provider call.
