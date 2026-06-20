# UX-IMPASSE-002 — surface latent structured-impasse subtypes

**Status:** Design draft
**Epic:** 12 (Rules UX / Mediator board) — read-only mediator projection surface
**Release:** v4 mediator overhaul (follow-up to UX-IMPASSE-001 / #689)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/710

---

## 1. Summary + doctrine frame

The mediator board already DERIVES thirteen internal structural states
(`MediatorStateCode`) but DISPLAYS only nine (`V4MediatorStateCode`). Four internal
codes are collapsed onto a coarser display state by `V4_DISPLAY_STATE_BY_CODE`. Two
of those four — **`value_tradeoff`** and **`key_detail_unavailable`** — already have
**trustworthy deterministic producers that fire on real data today** (verified
below, with code quoted). They are merely *folded* in display: a value-axis point
shows as **Open** (no chip), and a context-limit point shows as **Evidence blocked**.

This card surfaces those two latent subtypes as their own **point states** by
flipping their entries in the display-state projection and supplying the
operator-locked copy. It is a **pure display-mapping + copy change**: it changes no
derivation logic, no point `state` value, no persisted field, no schema, no Edge
Function, no classifier, no room/seat/chime-in semantics, and no submission gate.

The other two latent subtypes named in the card — **`accounts_differ`** and **"No
current pathway"** — have **no trustworthy producer** (the first's key set is empty
in v1; the second is not a state at all but the Gate-A condition that keeps
`structured_impasse`). Both stay **deferred** as dormant copy constants with a #710
follow-up reference. We never invent signal.

**Doctrine (these are POINT STATES, not person labels).** Every surfaced subtype
describes the **shape of a disagreement** — "this point turns on a value tradeoff",
"a key detail is not available to test here" — never a verdict, never who is right,
never a truth value, never intent/credibility/blame. The board remains a read-only
projection (`cdiscourse-doctrine` §1: score never blocks posting; the deterministic
Constitution engine stays the sole submission gate). Surfacing a *more specific*
structural state never escalates to a *stronger accusation*: when signal is
insufficient the state falls back to **Open** (value axis absent) or **Structured
impasse** (exhausted, no pathway) — never to a stronger claim.

---

## 2. Subtype mapping table

> Files cited at the commit this design was authored against
> (`feat/UX-IMPASSE-002-latent-subtypes` @ 25e22d2). "Producer L###" is in
> `src/features/mediator/deriveMediatorBoardState.ts`; "display map L###" is in
> `src/features/mediator/mediatorBoardTypes.ts`.

| Subtype | Current producer/source (file:line) | Current display mapping | Proposed v4 display label | Proposed detail copy | Where it appears | Safely derivable today? | Changes visible behavior? | Data/API touched | Behavior touched | Safe now / deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Different priorities** (`value_tradeoff`) | Producer `deriveMediatorBoardState.ts` L398-403: `if (cluster.primaryAxis === 'value' \|\| clusterHasAnyKey(memberIds, VALUE_KEYS, index))`; `VALUE_KEYS = {disputes_value_weighting}` (L73-75, family B). | `V4_DISPLAY_STATE_BY_CODE.value_tradeoff = 'open'` (display map L180) → renders as **Open**, no chip. | **`value_tradeoff`** (new ninth→tenth display state) — chip label **"Different priorities"**. | Chip "Different priorities"; Lead "This point turns on a value tradeoff."; Help "Name the priority being weighed, then decide whether the factual part can be narrowed." Next move dominant: "Name the tradeoff". | node chip (`MediatorNodeMarker`), Inspect "Why this state" (`MediatorNodeInspectDetail`), Disagreement Points rail badge + distribution segment, next-move card (`MediatorNextMovesCard`), feedback note. | **Yes** — see §3 trustworthiness verdict. | Yes — a value-axis point gains a "Different priorities" chip where today it shows no chip (Open). | **N** | **N** (display projection only; derivation unchanged) | **SAFE NOW** | mapping → exactly one v4 state; chip/rail label parity; Inspect ban-list; next-move set; INVERTED deferral proof |
| **Key detail unavailable** (`key_detail_unavailable`) | Producer `deriveMediatorBoardState.ts` L344-349: `if (hasContextLimit && !(hasEvidenceObligation && declined))`; `hasContextLimit = clusterHasKey(memberIds, CONTEXT_LIMIT_KEY, index)`; `CONTEXT_LIMIT_KEY = 'flags_context_limit'` (L76, family D). | `V4_DISPLAY_STATE_BY_CODE.key_detail_unavailable = 'evidence_blocked'` (display map L176) → folds into **Evidence blocked**. | **`key_detail_unavailable`** (new display state) — chip label **"Key detail unavailable"**. | Chip "Key detail unavailable"; Lead "A key detail is not available to test here."; Help "Branch the part that can be checked, or preserve this point as unresolved." Next move dominant: "Branch the provable part". | same surfaces as above. | **Yes** — see §3. | Yes — a context-limit point (with no declined debt) gains its own "Key detail unavailable" chip instead of folding into "Evidence blocked". TRUE `evidence_blocked` rows are unchanged. | **N** | **N** | **SAFE NOW** | mapping; label parity; Inspect ban-list; **evidence_blocked byte-identical regression**; next-move set; INVERTED deferral proof |
| **Accounts differ** (`accounts_differ`) | "Producer" `deriveMediatorBoardState.ts` L350-353 is gated on `RECOLLECTION_KEYS.size > 0`; `RECOLLECTION_KEYS = new Set<string>()` (L85, intentionally empty). **Never fires in v1.** | `V4_DISPLAY_STATE_BY_CODE.accounts_differ = 'accounts_differ'` (already its own display state, but suppressed at node level + never produced). | (no change) — copy stays dormant. | Dormant only: Lead "The accounts do not line up."; Help "Separate memory from records. Add a source only if one exists." | NOT wired — dormant constant only. | **No** — no producer fires on real data. | No. | **N** | **N** | **DEFERRED** (#710 follow-up: needs a recollection classifier + likely persistence) | dormant-constant shape + ban-list; assertion it stays unproduced |
| **No current pathway** | NOT a `MediatorStateCode`. The "no available pathway" condition is Gate A: `anyNonImpassePathwayAvailable` (`deriveMediatorBoardState.ts` L422-428) + the `deriveImpasseMarkers` guard `if (pathway.anyAvailable) continue` (L572). It is the condition under which `structured_impasse` STANDS. | n/a — surfaced as the **Structured impasse** frame (UX-IMPASSE-001 `IMPASSE_SUBTYPE_COPY.no_current_pathway` is a reserved copy key that folds into the impasse chip). | (no change) — folds into Structured impasse. | Dormant only: Lead "No available step would test this point right now."; Help "Reopen with a source, definition, or narrower claim." | NOT a distinct chip — folds into the existing Structured impasse row. | **No** — surfacing it as a separate state would invent signal / duplicate `structured_impasse`. | No. | **N** | **N** | **DEFERRED** (#710 follow-up; remains the structured_impasse frame) | dormant-constant shape + ban-list; assertion it never becomes a distinct chip |
| **Narrowed but unresolved** (`narrowed`) | Producer L394-396: `if (lc === 'narrowed' \|\| lc === 'conceded')`. | `V4_DISPLAY_STATE_BY_CODE.narrowed = 'narrowed'` (already its own state). | (no change) — **"Partially narrowed"** (shipped). | (shipped UX-IMPASSE-001 copy). | already on-surface. | Already surfaced. | No (already shipped). | **N** | **N** | **ALREADY SHIPPED** (not part of this card) | existing UX-IMPASSE-001 tests stay green |
| **Evidence blocked** (`evidence_blocked`) | Producer L339-341: `if (hasEvidenceObligation && declined)`; `declined = openDebts.some(d => d.status === 'unresolved')` (L331). | `V4_DISPLAY_STATE_BY_CODE.evidence_blocked = 'evidence_blocked'`. | (no change) — **"Evidence blocked"** (LOCKED, UX-MEDIATOR-003). | (shipped, byte-identical — see §4). | already on-surface. | Already surfaced. | No. | **N** | **N** | **ALREADY SHIPPED / LOCKED** — copy must stay byte-identical | byte-identical regression assertion (must stay green) |
| **Structured impasse** (`structured_impasse`) | Producer L335-336: `if (lc === 'exhausted')`, then Gate A L446-449. | `V4_DISPLAY_STATE_BY_CODE.structured_impasse = 'structured_impasse'`. | (no change) — **"Structured impasse"** (shipped). | (shipped UX-IMPASSE-001 copy). | already on-surface. | Already surfaced. | No. | **N** | **N** | **ALREADY SHIPPED** | existing UX-IMPASSE-001 tests stay green |

---

## 3. Producer-trustworthiness verdict (safe-now candidates)

A subtype is **safe-now ONLY IF** (a) a real producer fires it on real data today,
(b) it is currently collapsed in display, and (c) surfacing it is a pure
display-mapping + copy change. Both safe-now candidates clear all three.

### `value_tradeoff` → "Different priorities" — TRUSTWORTHY (deterministic)

Producer (`deriveMediatorBoardState.ts` L398-403):

```ts
// value_tradeoff — value axis or value observation (display collapses to open).
if (cluster.primaryAxis === 'value' || clusterHasAnyKey(memberIds, VALUE_KEYS, index)) {
  candidates.push({
    state: 'value_tradeoff',
    confidence: clusterKeyConfidence(memberIds, VALUE_KEYS, index) ?? 'medium',
  });
}
```

- **Deterministic, not weak inference.** It fires on two hard, structural inputs:
  (1) the cluster's `primaryAxis === 'value'` (a deterministic field on the
  already-derived `PointLifecycleClusterSummary` — LIFE-001), or (2) a persisted
  machine observation with `rawKey === 'disputes_value_weighting'`
  (`VALUE_KEYS`, L73-75, family B). No probabilistic threshold, no scoring, no AI
  call — a `clusterHasAnyKey` set-membership check over persisted rows.
- **Fires on real data.** `mediatorPrecedence.test.ts` L335-337 proves a
  `primaryAxis: 'value'` cluster yields `point.state === 'value_tradeoff'`;
  family-B `disputes_value_weighting` is a real persisted observation key.
- **Currently collapsed.** Display map L180 maps it to `'open'`, so a value-axis
  point shows no chip today.
- **Uncertainty is preserved.** Confidence falls back to `'medium'` only when a
  value observation exists; an axis-only signal still produces `value_tradeoff` but
  the doctrine fallback (insufficient → Open) is unaffected because the producer
  only fires when the value signal is actually present.

**Verdict: SAFE NOW.** Surface it.

### `key_detail_unavailable` → "Key detail unavailable" — TRUSTWORTHY (deterministic)

Producer (`deriveMediatorBoardState.ts` L344-349):

```ts
// key_detail_unavailable — context-limit flag (with or without an open debt,
//   but NOT when a declined debt already wins evidence_blocked).
if (hasContextLimit && !(hasEvidenceObligation && declined)) {
  candidates.push({
    state: 'key_detail_unavailable',
    confidence: clusterKeyConfidence(memberIds, new Set([CONTEXT_LIMIT_KEY]), index) ?? 'medium',
  });
}
```

with `const hasContextLimit = clusterHasKey(memberIds, CONTEXT_LIMIT_KEY, index)`
(L332) and `CONTEXT_LIMIT_KEY = 'flags_context_limit'` (L76, family D).

- **Deterministic flag, not inference.** It fires on the presence of a persisted
  `flags_context_limit` observation (family D) — a set-membership check, no
  threshold.
- **Fires on real data, with a guard.** `mediatorBoardState.test.ts` L253-261
  proves a `flags_context_limit` observation with **no debt** yields
  `point.state === 'key_detail_unavailable'`. The `!(hasEvidenceObligation &&
  declined)` clause guarantees that a **declined evidence debt always wins**
  `evidence_blocked` (proved by `mediatorPrecedence.test.ts` L258-267): so
  surfacing `key_detail_unavailable` as its own chip never steals the
  `evidence_blocked` rows. This is the "just below a declined evidence_blocked"
  precedence required by the card.
- **Currently collapsed.** Display map L176 maps it to `'evidence_blocked'`.
- **Doctrine.** The copy describes an unavailable detail (a property of the
  RECORD), never a person's conduct, mirroring the `evidence_blocked` ban
  discipline (no "hiding"/"withheld"/"refused"/"failed").

**Verdict: SAFE NOW.** Surface it distinctly while keeping the TRUE
`evidence_blocked` rows byte-identical.

### Deferred candidates — NOT trustworthy

- **`accounts_differ`** — producer L350-353 is gated on `RECOLLECTION_KEYS.size > 0`,
  and `RECOLLECTION_KEYS` is the empty set (L85, intentional). It **never fires**.
  No producer on real data ⇒ DEFER. The card's own bar: defer unless an existing
  producer distinguishes incompatible recollection from ordinary factual
  disagreement — none does.
- **`no_current_pathway`** — not a `MediatorStateCode` at all; it is the Gate-A
  condition (L422-428) that keeps `structured_impasse`. Surfacing it separately
  would duplicate `structured_impasse` / invent a state ⇒ DEFER. It remains the
  structured-impasse frame (UX-IMPASSE-001 `IMPASSE_SUBTYPE_COPY.no_current_pathway`
  reserved alternate, folded into the impasse chip).

---

## 4. Exact copy (operator-locked)

Use the operator's recommended copy **verbatim**. No doctrine tweak is required —
every line passes the mediator + next-move + impasse ban-lists (verified token by
token against `_forbiddenMediatorTokens()`, `_forbiddenNextMoveTokens()`, and the
UX-IMPASSE-001 `IMPASSE_BANNED_PHRASES`). One note flagged below where existing
internal-code copy must be aligned so all surfaces read identically.

### Different priorities (`value_tradeoff`) — SURFACE NOW

- **Chip:** `Different priorities`
- **Lead:** `This point turns on a value tradeoff.`
- **Help:** `Name the priority being weighed, then decide whether the factual part can be narrowed.`
- **Next move (dominant):** `Name the tradeoff` (existing `name_tradeoff` pathway step / existing `NEXT_MOVE_COPY` — see §5/§6)

### Key detail unavailable (`key_detail_unavailable`) — SURFACE NOW

- **Chip:** `Key detail unavailable`
- **Lead:** `A key detail is not available to test here.`
- **Help:** `Branch the part that can be checked, or preserve this point as unresolved.`
- **Next move (dominant):** `Branch the provable part` (existing `narrow_or_branch` pathway step / existing `branch_provable` next-move copy)

### Evidence blocked (`evidence_blocked`) — LOCKED, byte-identical, DO NOT CHANGE

- **Chip:** `Evidence blocked`
- **Lead:** `The evidence path is not available right now.`
- **Help:** `Name what kind of record would test this point, without demanding private access.`
- Source of truth: `MEDIATOR_STATE_HELPER.evidence_blocked` (the full shipped
  three-sentence string), `MEDIATOR_STATE_COPY.evidence_blocked = 'Evidence
  blocked'`, `IMPASSE_SUBTYPE_COPY.evidence_blocked`, rail
  `blockedEvidencePath = 'Evidence blocked'`. **No reassurance/negation copy added.**

### Structured impasse (`structured_impasse`) — existing, unchanged

- **Lead:** `The disagreement is preserved.`
- **Help:** `You both made the case. Reopen with a source, definition, or narrower claim.`
- Today's shipped wording is `IMPASSE_SUBTYPE_COPY.structured_impasse.help = 'No
  available next move would test this point further yet.'` with the reopen line
  carried separately (`DISAGREEMENT_POINTS_RAIL_COPY.impasseReopen`). **This card
  does not touch structured-impasse copy** (out of scope; UX-IMPASSE-001 owns it).
  The card prompt's "You both made the case…" phrasing is the operator's
  description of the existing intent, not a change request — no edit.

### Dormant (DEFERRED — author/keep as constants, NOT wired)

- **Accounts differ** — `The accounts do not line up.` / `Separate memory from records. Add a source only if one exists.`
- **No current pathway** — `No available step would test this point right now.` / `Reopen with a source, definition, or narrower claim.`

> These already exist as dormant constants today, with slightly different shipped
> values:
> - `VALUE_TRADEOFF_DISPLAY_COPY` (`mediatorPlainLanguage.ts` L146-151) currently
>   reads `chip: 'Different priorities'`, `lead: 'This is a value tradeoff.'`,
>   `help: 'Name the priority at stake instead of asking for a source.'`,
>   `next: 'State the tradeoff clearly.'`.
> - `KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY` (L162-167) currently reads
>   `chip: 'Key detail unavailable'`, `lead: 'A key detail is not available.'`,
>   `help: 'Branch the parts that can still be tested.'`,
>   `next: 'Branch the provable part.'`.
>
> Because the operator copy in this card supersedes those drafts for the two
> SAFE-NOW subtypes, the implementer updates the **Lead/Help VALUES** of these two
> constants to the operator copy above (they stop being dormant; they become the
> wired source of the Inspect Lead/Help) and adds the `accounts_differ` /
> `no_current_pathway` dormant copy as new constants (or reuses the existing
> `IMPASSE_SUBTYPE_COPY.no_current_pathway`). See §6 for the exact change set.

---

## 5. v4 display-state map change (the load-bearing change)

All three changes are in `src/features/mediator/mediatorBoardTypes.ts`. **No
derivation logic changes** — only the display projection. `point.state` and the
13-code `MediatorStateCode` are untouched (Inspect / traceability unchanged).

### 5.1 `V4MediatorStateCode` (add two members)

Add `value_tradeoff` and `key_detail_unavailable` to the union (L109-118). New
union has **eleven** members.

### 5.2 `ALL_V4_MEDIATOR_STATE_CODES` (add two, in precedence order)

The frozen list (L121-131) must include both new states at their precedence
position (so the `V4_PRIMARY_STATE_PRIORITY === ALL_V4_MEDIATOR_STATE_CODES`
self-consistency test at `mediatorBoardState.test.ts` L597-600 stays green — both
arrays must be edited identically).

### 5.3 `V4_PRIMARY_STATE_PRIORITY` (insert two at the documented ranks)

Doctrine precedence (HIGHEST wins). Insert per the card:
- **`key_detail_unavailable`** "just below a declined `evidence_blocked`" → position
  **#3** (immediately after `evidence_blocked`, before `accounts_differ`).
- **`value_tradeoff`** "just above open" → the **second-to-last** position
  (immediately before `open`, after `narrowed`).

New order (eleven entries):

```ts
export const V4_PRIMARY_STATE_PRIORITY = Object.freeze([
  'structured_impasse',       // 1
  'evidence_blocked',         // 2
  'key_detail_unavailable',   // 3  ← NEW, just below a declined evidence_blocked
  'accounts_differ',          // 4  (still never produced in v1)
  'definition_not_shared',    // 5
  'scope_mismatch',           // 6
  'missing_mechanism',        // 7
  'needs_evidence',           // 8
  'narrowed',                 // 9
  'value_tradeoff',           // 10 ← NEW, just above open
  'open',                     // 11
]);
```

`ALL_V4_MEDIATOR_STATE_CODES` MUST be edited to this identical order.

> **This is a DISPLAY order only.** It controls (a) the order of segments in the
> Disagreement Points distribution bar (`mediatorDistribution.ts` L68 iterates
> this), and (b) tie-handling in any consumer that ranks by display priority. It
> does **NOT** reorder by magnitude/count (the distribution bar's `flexGrow` is
> count-driven but ordering stays structural — `mediatorDistribution.ts` doctrine
> comment L50) and it does **NOT** change `decidePointState`'s internal
> `INTERNAL_STATE_PRIORITY` (`deriveMediatorBoardState.ts` L289-303), which already
> ranks `key_detail_unavailable` just below a declined `evidence_blocked` and
> `value_tradeoff` just above `open`. The internal picker is already correct; only
> the *display* projection was collapsing the two states.

### 5.4 `V4_DISPLAY_STATE_BY_CODE` (flip two entries to identity)

```ts
// BEFORE (collapsed):
key_detail_unavailable: 'evidence_blocked',   // L176
value_tradeoff: 'open',                        // L180

// AFTER (surfaced — identity):
key_detail_unavailable: 'key_detail_unavailable',
value_tradeoff: 'value_tradeoff',
```

`off_point: 'scope_mismatch'` and `resolved_or_settled: 'resolved_or_settled'`
stay collapsed/terminal (NOT touched). After this change, only **two** internal
codes still collapse for display (`off_point`, plus the terminal
`resolved_or_settled`).

### 5.5 Why the surfaces light up automatically (no per-surface render change)

Every display surface reads the v4 projection through `v4DisplayStateFor` +
`plainLanguageForMediatorState(displayState)`:

- **Node chip:** `nodeMediatorMarkers.ts` `getNodeMediatorMarker` L91-101 projects
  the selected internal code through `v4DisplayStateFor`, then suppresses anything
  not in `NODE_MARKER_PRIORITY` (L31-42). `value_tradeoff` and
  `key_detail_unavailable` are **already members** of `NODE_MARKER_PRIORITY`
  (L38, L40), so once their display projection is identity they stop being
  suppressed and render a chip. (Today `value_tradeoff → open` was suppressed
  because `open` is not in `NODE_MARKER_PRIORITY`; that suppression now lifts.)
- **Disagreement Points rail badge:** `DisagreementPointsRail.tsx`
  `v4RowBadgeLabel` L83-87 → `plainLanguageForMediatorState(displayState)`.
- **Distribution bar/legend:** `mediatorDistribution.ts` L60-74 buckets by
  `v4DisplayStateFor` and labels with `plainLanguageForMediatorState`. Order is
  `V4_PRIMARY_STATE_PRIORITY` (now includes both).
- **Inspect "Why this state":** `ArgumentGameSurface.tsx` L765
  `helperForMediatorState(activeNodeMediatorMarker.code)` (the marker code is the
  v4 display code).
- **Next-move card:** `ArgumentGameSurface.tsx` L778-783 →
  `nextMovesForState(v4DisplayStateFor(marker.code))`.

**Label-parity consequence (must-fix):** the node chip, rail badge, and
distribution segment all render `plainLanguageForMediatorState(displayCode)`, which
returns `MEDIATOR_STATE_COPY[displayCode]`. Today `MEDIATOR_STATE_COPY.value_tradeoff
= 'Value tradeoff'` (L32). The operator chip is **"Different priorities"**. To keep
the rail label identical to the node chip (doctrine: same display label
everywhere), the implementer MUST set `MEDIATOR_STATE_COPY.value_tradeoff =
'Different priorities'`. `MEDIATOR_STATE_COPY.key_detail_unavailable` is already
`'Key detail unavailable'` (L28) — matches the operator chip; no change needed.

---

## 6. Safe-now subset — exact files + changes + proving test

Surface **exactly two** subtypes: `value_tradeoff → "Different priorities"` and
`key_detail_unavailable → "Key detail unavailable"`. Both producers verified
trustworthy (§3). No other subtype surfaces.

### File changes (production)

- **`src/features/mediator/mediatorBoardTypes.ts`** (~6 edited lines):
  - `V4MediatorStateCode`: add `'value_tradeoff'` + `'key_detail_unavailable'`.
  - `ALL_V4_MEDIATOR_STATE_CODES`: add both, in the new priority order.
  - `V4_PRIMARY_STATE_PRIORITY`: insert `key_detail_unavailable` at #3,
    `value_tradeoff` at #10 (§5.3).
  - `V4_DISPLAY_STATE_BY_CODE`: flip `key_detail_unavailable` and `value_tradeoff`
    to identity (§5.4).
  - Update the doctrine comment block L160-186 to reflect that only `off_point` (+
    terminal `resolved_or_settled`) still collapses.

- **`src/features/mediator/mediatorPlainLanguage.ts`** (~4 edited lines + comments):
  - `MEDIATOR_STATE_COPY.value_tradeoff`: `'Value tradeoff'` → **`'Different
    priorities'`** (label parity — §5.5). `key_detail_unavailable` stays `'Key
    detail unavailable'`.
  - `MEDIATOR_STATE_HELPER.value_tradeoff`: set to the operator Lead+Help
    (`'This point turns on a value tradeoff. Name the priority being weighed, then
    decide whether the factual part can be narrowed.'`).
  - `MEDIATOR_STATE_HELPER.key_detail_unavailable`: set to operator Lead+Help
    (`'A key detail is not available to test here. Branch the part that can be
    checked, or preserve this point as unresolved.'`).
  - Update `VALUE_TRADEOFF_DISPLAY_COPY` and `KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY`
    values to the operator copy and update their "dormant — not surfaced" comments
    to "surfaced by UX-IMPASSE-002 (#710)". (They were authored dormant by
    UX-IMPASSE-001 precisely for this flip.)
  - Add (or keep) `accounts_differ` / `no_current_pathway` dormant copy with a
    #710-follow-up reference (see §7). `IMPASSE_SUBTYPE_COPY.no_current_pathway`
    already exists and stays as the reserved alternate.

- **`src/features/mediator/nextMovesForState.ts`** (~2 entries added — REQUIRED, see
  Risks): `STATE_MOVE_SPECS` is `Record<V4MediatorStateCode, ...>` (L128). Adding
  two members to the union makes this Record **non-exhaustive → typecheck error**.
  The implementer MUST add a spec array for each new display state, using EXISTING
  pathway step codes + EXISTING `NEXT_MOVE_COPY` keys (no new action semantics):
  - `value_tradeoff`: `[{ key: 'name_tradeoff'? ... }]` — note `NEXT_MOVE_COPY` has
    no `name_tradeoff` key today; reuse the operator dominant "Name the tradeoff"
    by adding a `name_tradeoff` COPY entry **OR** map to the existing
    `respond_exact`/`ask_clarifying` open set. **Recommended:** add
    `NEXT_MOVE_COPY.name_tradeoff = 'Name the tradeoff'` +
    `NEXT_MOVE_RATIONALE.name_tradeoff` (structure-only rationale) and a spec
    `[{ key: 'name_tradeoff', stepCode: 'name_tradeoff', available: true }]`. The
    `name_tradeoff` pathway step ALREADY exists (`ResolutionPathwayStepCode` L363;
    `pathwayForState` L812-814; `PATHWAY_STEP_COPY.name_tradeoff` L177). This adds
    copy, not a new action.
  - `key_detail_unavailable`: reuse the `evidence_blocked` move shape (its
    pathway is `await_record` + `narrow_or_branch`, L803-805): `[{ key:
    'branch_provable', stepCode: 'narrow_or_branch', available: true }, { key:
    'name_record_kind', stepCode: 'await_record', available: false }]` — dominant
    "Branch the provable part", matching the operator next move. All keys exist in
    `NEXT_MOVE_COPY`.
  - `feedbackForMediatorProgress.ts` does NOT need a code edit (it is a
    switch-with-fallback over `V4MediatorStateCode`; both new states fall through
    to the `nextMovesForState(displayState)` "Next useful move:" branch, which is
    correct). It will compile because it is not an exhaustive Record.

### Proving tests (new file)

- **`__tests__/uxImpasse002LatentSubtypes.test.ts`** (pure-model). See §9 for the
  full test plan. Core proofs: each safe-now subtype maps to exactly one v4 display
  state; the chip/rail/distribution label parity; the next-move set; the inverted
  deferral proofs; the `evidence_blocked` byte-identical regression.

### Existing tests that MUST be updated (not new — inverted)

- **`__tests__/uxImpasse001Copy.test.ts`** — the `describe('DEFERRAL PROOF — …NOT
  surfaced…')` block (L197-227) and the dormant-constant block (L229-255) assert
  the OLD collapsed behavior. The implementer INVERTS these specific assertions
  (they were the deferral markers; this card is the surfacing). Specifically:
  L199 (`value_tradeoff → 'open'`), L204 (`key_detail_unavailable →
  'evidence_blocked'`), L208-218 (value_tradeoff shows Open), L220-226 (dormant
  chip not a display label). The `evidence_blocked` byte-identical block (L171-194)
  STAYS GREEN unchanged.
- **`__tests__/mediatorBoardState.test.ts`** L584-589 (`collapses the four superset
  codes`) — change the `value_tradeoff`/`key_detail_unavailable` lines to identity;
  retitle to "the remaining superset code(s)". L597-600 stays green if both
  priority/all arrays are edited identically.
- **`__tests__/mediatorPrecedence.test.ts`** L184-198 (`V4_PRIMARY_STATE_PRIORITY`
  exact array) — update to the eleven-entry order. Note: L322-337's hard assertions
  are on the INTERNAL `point.state` (`key_detail_unavailable`, `value_tradeoff`) and
  STAY GREEN; only the stale "(open display)"/"(evidence_blocked display)" comments
  need a refresh.

---

## 7. Deferred items (dormant constants + #710 follow-up reference, NOT wired)

- **`accounts_differ`** — no producer (`RECOLLECTION_KEYS` empty, L85). Keep its
  display state as-is (it already maps to itself but is never produced and is
  node-suppressed). Author/keep dormant copy:
  `The accounts do not line up.` / `Separate memory from records. Add a source only
  if one exists.` Mark with `// DEFERRED (#710 follow-up): needs a recollection
  classifier + persistence; do NOT wire — RECOLLECTION_KEYS is empty in v1.`
- **`no_current_pathway`** — not a state. Keep
  `IMPASSE_SUBTYPE_COPY.no_current_pathway` (already present, L128-134) as the
  reserved alternate that folds into the Structured impasse chip. If the operator
  copy differs (`No available step would test this point right now.` /
  `Reopen with a source, definition, or narrower claim.`), the implementer may
  align the `lead`/`help`/`next` VALUES but must NOT add it to the display map or
  any `NODE_MARKER_PRIORITY` / next-move spec. Mark `// DEFERRED (#710 follow-up):
  the structured_impasse frame; never a distinct chip.`

A regression test asserts both stay unproduced / never render as a distinct chip
(§9).

---

## 8. Hard-halt check

The safe-now subset requires **NONE** of the following (each confirmed absent):

| Halt condition | Present? | Why not |
|---|---|---|
| New persisted field | No | display projection + copy only |
| Migration | No | no schema touch |
| Edge Function change | No | mediator board is a client-side pure projection |
| New classifier activation | No | both producers already exist + fire today |
| MCP / Deno change | No | none touched |
| Inference from weak data | No | both producers are deterministic set-membership / axis checks (§3) |
| Route / model / table / type RENAME | No | `MediatorStateCode`, `point.state`, routes unchanged; `V4MediatorStateCode` is ADDITIVE (two new members), not a rename |
| Room / seat / chime-in semantics | No | none touched (the dormant chime-in marker is unrelated and untouched) |
| Any claim about truth / person-intent / credibility / honesty / blame | No | all copy is point-state structural; ban-lists enforced |
| Submission-gate behavior | No | board is read-only; engine remains sole gate |

No safe-now item trips a halt. Both safe-now subtypes stay in scope.

---

## 9. Test plan

New file **`__tests__/uxImpasse002LatentSubtypes.test.ts`** (pure-model — imports
the mediator barrel, no React/Supabase/fetch), plus targeted updates to the three
existing test files named in §6.

**Mapping / single-state:**
- `v4DisplayStateFor('value_tradeoff') === 'value_tradeoff'` and
  `v4DisplayStateFor('key_detail_unavailable') === 'key_detail_unavailable'`
  (identity after flip).
- Each safe-now internal code maps to **exactly one** v4 display state
  (`ALL_V4_MEDIATOR_STATE_CODES` membership; no double-mapping).
- `V4_DISPLAY_STATE_BY_CODE` is still total over all 13 `MediatorStateCode`
  (`mediatorBoardState.test.ts` L567-575 stays green).
- `V4_PRIMARY_STATE_PRIORITY` has eleven entries; `key_detail_unavailable` at index
  2, `value_tradeoff` at index 9 (just above `open`); equals
  `ALL_V4_MEDIATOR_STATE_CODES` (self-consistency).
- End-to-end: a `primaryAxis: 'value'` cluster → board point whose
  `v4DisplayStateFor(point.state) === 'value_tradeoff'`; a `flags_context_limit`
  (no debt) cluster → `key_detail_unavailable`. (Reuses fixture builders from
  `mediatorPrecedence.test.ts`.)

**Deferred subtypes do NOT surface:**
- `accounts_differ` is never produced from any observation set (empty key set) —
  re-assert (mirrors `mediatorPrecedence.test.ts` L361-368).
- `no_current_pathway` is not a `MediatorStateCode`; not in `V4MediatorStateCode`;
  not in any `NODE_MARKER_PRIORITY` / `STATE_MOVE_SPECS` key set.
- Dormant constants exist but are not wired into the render path beyond
  `MEDIATOR_STATE_COPY`/`MEDIATOR_STATE_HELPER` (their values are surfaced for the
  two safe-now states; the deferred-only copy is referenced by no display-map
  value).

**Label parity (rail label === node chip label):**
- `plainLanguageForMediatorState('value_tradeoff') === 'Different priorities'` and
  `=== MEDIATOR_STATE_COPY.value_tradeoff`.
- The Disagreement Points distribution segment `plainLabel` for a value-axis point
  equals `'Different priorities'` (build a board, run
  `buildDisagreementDistribution(selectLivePoints(board))`, find the
  `value_tradeoff` segment). Same proof for `key_detail_unavailable` →
  `'Key detail unavailable'`.

**No chip soup:**
- A single value-axis point produces exactly one node marker and one distribution
  segment (count 1), not multiple chips.
- A `key_detail_unavailable` point with NO open evidence debt produces the
  "Key detail unavailable" chip and **no** rail "Evidence blocked" blocked-path
  line (`getEvidenceDebtForPoint` returns null when `open.length === 0`,
  `evidenceDebtDisplay.ts` L49) — proving the two states don't double-render.

**Inspect copy ban-list:**
- `helperForMediatorState('value_tradeoff')` and
  `helperForMediatorState('key_detail_unavailable')` are non-empty, pass
  `_forbiddenMediatorTokens()` and the UX-IMPASSE-001 `IMPASSE_BANNED_PHRASES`, and
  contain no snake_case.
- Every new `NEXT_MOVE_COPY`/`NEXT_MOVE_RATIONALE` entry passes
  `_forbiddenNextMoveTokens()` (person-attribution + verdict).

**Evidence-blocked byte-identical (regression — MUST stay green):**
- `helperForMediatorState('evidence_blocked')` equals the exact shipped
  three-sentence string (re-assert `uxImpasse001Copy.test.ts` L172-180).
- `MEDIATOR_STATE_COPY.evidence_blocked === 'Evidence blocked'`,
  `DISAGREEMENT_POINTS_RAIL_COPY.blockedEvidencePath === 'Evidence blocked'`,
  `IMPASSE_SUBTYPE_COPY.evidence_blocked` unchanged.
- A TRUE `evidence_blocked` point (declined debt) still maps to `evidence_blocked`
  and renders the shipped copy — surfacing `key_detail_unavailable` did not steal
  it (mirrors `mediatorPrecedence.test.ts` L258-267).

**Fallback (insufficient signal never escalates):**
- A no-signal cluster → `open` (not `value_tradeoff`).
- An exhausted-with-no-pathway cluster → `structured_impasse` (not a stronger
  accusation), unchanged.
- An unknown display state still collapses to the Open move set
  (`nextMovesForState` totality).

**Next-move set:**
- `nextMovesForState('value_tradeoff')` dominant label is `'Name the tradeoff'`;
  `nextMovesForState('key_detail_unavailable')` dominant label is `'Branch the
  provable part'`. All `stepCode`s are existing `ResolutionPathwayStepCode` values.

**No route/submit/room/seat/chime-in change:**
- Re-run the no-gate-export doctrine test (`mediatorPrecedence.test.ts` L423-449)
  — still passes (no new gate-shaped export).

**Existing suites stay green:** `mediatorBoardState`, `mediatorPrecedence`,
`nodeMediatorMarkers`, `MediatorNodeMarker`, `MediatorNodeInspectDetail`,
`uxMediator002NodeMarkup`, `uxMediator003EvidenceDetail`,
`uxMediator004DefinitionScopeBridge`, `uxMediator005DisagreementSheet`,
`DisagreementPointsRail`, `disagreementPointsRailEvidence`,
`disagreementPointsRailBridge`, `uxBoardRail003SegmentNav`, `uxImpasse001Rail`,
`uxFeedback001ProgressNote`, `uxSelectedNode001CenterOfRoom`,
`uxNextMove001SuggestMyNextMove`, `uxBoardReadability001`, `roomMediatorAdapter`
(with the three named files updated per §6).

---

## 10. Doctrine self-check + invariants

**`cdiscourse-doctrine`:**
- §1 (no truth labels; score never blocks posting): both new states are POINT
  states ("turns on a value tradeoff", "a key detail is not available to test
  here") — no verdict, no truth value, no person label. The board is a pure
  read-only projection; the deterministic engine stays the sole submission gate.
  No `decidePointState` change → no new way to reach any state.
- §2/§3 (heat/popularity not evidence): nothing read from `standingBand` /
  `toneBand` / engagement; the producers read only `primaryAxis` and persisted
  family-B/D observation keys.
- §4 (AI moderator limits): no AI call; both producers are deterministic.
- §9 (plain language): all surfaced strings are plain English; the renderers
  suppress anything that trips `looksLikeInternalCode`; no raw classifier id
  (`flags_context_limit`, `disputes_value_weighting`) ever reaches the UI.
- §10a (Observations vs Allegations): these are machine-derived structural STATES,
  not Observation/Allegation chips; the §10a boundary (`NodeLabelInspectGroups`) is
  untouched.

**`timeline-grammar`:** no node-shape/strength/heat token added; the mediator chip
is a separate text badge (geometry: the impasse left-rule is unchanged; the two new
states use the ordinary chip surface). No truth/judgment word enters any label.

**`accessibility-targets`:** every surface is already a `<Pressable>`/`<Text>` with
role+label+state and 44×44 targets (rail rows, distribution segments). Both new
states reuse those surfaces unchanged — the only delta is the label text + the
distribution segment now appears. Color is never the only signal (the distribution
"▸ In view" marker + count text carry it; the chip is text). No new interactive
element is added, so no new a11y wiring is required; the new distribution segments
inherit the existing `accessibilityLabel` template
(`Jump to ${plainLabel} points: ${count} of ${total}`).

**`test-discipline`:** tests are part of done — one new pure-model suite + targeted
inversions of the three existing files; ban-list + byte-identical regressions
included; no `.skip`/`.only`.

**Invariants preserved:**
- **Single derivation** — the board is derived ONCE in `ArgumentGameSurface` and
  shared by the rail + node markup; this card adds NO second derivation (it only
  changes the display projection both consumers already call).
- **RAIL-003 segment navigation** — `mediatorDistribution.ts` +
  `DisagreementPointsRail` segment-nav logic is untouched; the two new segments
  participate automatically via `V4_PRIMARY_STATE_PRIORITY`.
- **Rail layout / topology** — unchanged (no new row type, no relocation).
- **Open Issues** — not relocated; not touched.

---

## 11. Operator steps (if any)

**None — pure code change.** No migration, no Edge Function deploy, no env var, no
secret. The implementer commits code + tests on the feat branch; the change ships
through the normal merge. (No `npx supabase` step.)

---

## Appendix — exact file:line references traced for this design

- Producers + Gate A + internal precedence: `deriveMediatorBoardState.ts`
  L73-76 (`VALUE_KEYS`/`CONTEXT_LIMIT_KEY`), L85 (`RECOLLECTION_KEYS` empty),
  L289-303 (`INTERNAL_STATE_PRIORITY`), L335-336 (impasse), L339-341
  (evidence_blocked), L344-349 (key_detail_unavailable), L394-396 (narrowed),
  L398-403 (value_tradeoff), L422-428 (Gate A), L471-475 (`v4DisplayStateFor`),
  L572 (impasse marker pathway guard), L803-814 (pathways for the two states).
- Display vocab + map: `mediatorBoardTypes.ts` L109-118 (`V4MediatorStateCode`),
  L121-131 (`ALL_V4_MEDIATOR_STATE_CODES`), L148-158 (`V4_PRIMARY_STATE_PRIORITY`),
  L170-186 (`V4_DISPLAY_STATE_BY_CODE`).
- Copy: `mediatorPlainLanguage.ts` L18-38 (`MEDIATOR_STATE_COPY`, incl.
  L28/L32), L44-81 (`MEDIATOR_STATE_HELPER`, incl. L61/L65), L100-135
  (`IMPASSE_SUBTYPE_COPY` incl. `no_current_pathway` L128-134), L146-167
  (dormant `VALUE_TRADEOFF_DISPLAY_COPY` / `KEY_DETAIL_UNAVAILABLE_DISPLAY_COPY`),
  L170-180 (`PATHWAY_STEP_COPY`, incl. `name_tradeoff` L177), L211-236
  (`_forbiddenMediatorTokens`).
- Consumers: `nodeMediatorMarkers.ts` L31-42 (`NODE_MARKER_PRIORITY` incl. both
  new states), L91-101 (projection + suppression); `nextMovesForState.ts` L128-168
  (`STATE_MOVE_SPECS` — exhaustive Record, must add two); `mediatorDistribution.ts`
  L60-74 (bucketing + labels); `DisagreementPointsRail.tsx` L83-87
  (`v4RowBadgeLabel`), L750-754 (blocked-path line); `evidenceDebtDisplay.ts`
  L43-64 (blocked only when an open debt exists); `ArgumentGameSurface.tsx`
  L750-783 (Inspect helper + next-move wiring).
- Tests to invert: `uxImpasse001Copy.test.ts` L171-255; `mediatorBoardState.test.ts`
  L253-261, L584-600; `mediatorPrecedence.test.ts` L184-198, L322-337.
