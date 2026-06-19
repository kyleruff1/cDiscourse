# UX-MEDIATOR-004 — Definition / scope bridge UI + v4 label alignment ("Definition not shared")

**Status:** Design draft
**Epic:** 16 — CivilDiscourse v4 UX overhaul (`epic:civildiscourse-v4`)
**Release:** v4 UX overhaul slate
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/685
**Base:** `6f2c362` (UX-MEDIATOR-005 #703) · branch `feat/UX-MEDIATOR-004-definition-scope-bridge`
**Lane:** UI-model over the shipped display helper · GATE-C: **No** (no deploy / migration / provider / backend mutation) · effort: M

---

## Goal (one paragraph)

The mediator stack is **already shipped on main** and the definition/scope bridge already renders: UX-MEDIATOR-001 (#701) shipped the precedence + `v4DisplayStateFor`; UX-MEDIATOR-002 (#702) shipped the one-chip node markup + the `MediatorNodeInspectDetail` block; UX-MEDIATOR-005 (#703) shipped the Disagreement Points rail with a definition/scope bridge section (`getDefinitionScopeBridgeForPoint` + the `definitionBridge` / `scopeBridge` rail copy). This card does **NOT** rebuild any of that. It does two narrow things: (1) it **lands the deferred visible label rename** — `'Definition needed' → 'Definition not shared'` — which UX-MEDIATOR-001 §6/O-1 and UX-MEDIATOR-002 §9 explicitly deferred to **this** card, updating the central plain-language map and the two bridge-copy slots in lockstep with the tests that pin the old wording; and (2) it **reframes the definition and scope bridge copy as a BRIDGE, not an accusation** — short, person-neutral, advisory prompts ("The key term is not yet shared." / "This appears to answer a different scope.") with concrete next moves ("Define the key term." / "Narrow the claim" · "Branch the provable part" · "Respond to the exact point" · "Accept the narrower scope"). The **model and state codes are unchanged and deterministic** (`definition_not_shared` / `scope_mismatch` stay the internal codes; `definitionScopeBridgeDisplay.ts` is untouched). Doctrine (`cdiscourse-doctrine`): every string is person-neutral and advisory — no "evasion", "fallacy", "wrong", "bad faith", no verdict/winner/loser/score; the deterministic Constitution engine remains the sole posting gate; insufficient signal stays Open, never a stronger accusation; Definition-wins-over-scope precedence is **owned by UX-MEDIATOR-001** and only consumed here.

---

## §0 Scope-reality audit (POSTRUN-UX001 rule — orchestrator-authored card, audit BEFORE build)

A pre-build reality audit was run against the shipped board, the rail, the node chip, and the Inspect detail. Five findings shape the (small) delta:

### Finding A — the bridge UI ALREADY SHIPS; this is a copy + label-alignment card, not a build-the-bridge card

The issue Goal ("no v4 UI for these two adjacent states") is **partially stale against the current repo**. UX-MEDIATOR-005 (#703) already shipped the bridge section in `DisagreementPointsRail.tsx`:

- the row composes `getDefinitionScopeBridgeForPoint(board, point.id)` (`DisagreementPointsRail.tsx:357`);
- it renders a `disagreement-points-rail-bridge-<id>` block with a bold "Clarify the point" lead-in (`clarifyPoint`), one primary prompt (`definitionBridge` / `scopeBridge`), and a one-line secondary note (`Also: …`) when both apply (`DisagreementPointsRail.tsx:463-491`);
- the node chip + the Inspect detail already render the state **label** for `definition_not_shared` and `scope_mismatch` via `MEDIATOR_STATE_COPY` → `plainLanguageForMediatorState`.

**Conclusion:** the implementer EXTENDS the shipped copy, not authors a new bridge component. The v4 GAP vs the shipped surface is **narrow**: (1) the deferred label rename, and (2) the bridge-prompt copy reframe to the issue's exact strings. No new component, no new render slot, no model change.

### Finding B — the label rename flows from ONE central map; the node chip, Inspect detail, and `v4DisplayStateFor`-projected rail badge all consume it transitively

`mediatorPlainLanguage.ts:23` is `definition_not_shared: 'Definition needed'`. Every visible state **label** for that state resolves through it:

- node chip → `nodeMediatorMarkers.ts:100` `plainLanguageForMediatorState(displayCode)` → `MEDIATOR_STATE_COPY` → the marker `label` → `MediatorNodeMarker.tsx:46`;
- Inspect detail → `MediatorNodeInspectDetail.tsx:58` renders `marker.label` (same source);
- rail row badge → `DisagreementPointsRail.tsx:78-82` `v4RowBadgeLabel` → `plainLanguageForMediatorState(v4DisplayStateFor(point.state))` (same source).

So renaming the single map line **automatically** updates the node chip, the Inspect detail, and the rail badge — one edit, three surfaces. The bridge-prompt copy in `mediatorRailCopy.ts` (`definitionBridge`, `definitionShort`) is a **separate** copy slot that must be edited independently (it duplicates the wording in a prompt sentence, by design — the rail composes its own bridge prose).

### Finding C — the issue's bridge copy is RICHER than the shipped copy; some strings map to existing slots, some need a small render add or are DEFERRED

The issue §2/§3 specify a fuller move set for scope ("Narrow the claim" · "Branch the provable part" · "Respond to the exact point" · "Accept the narrower scope") and distinct lead/help lines. The shipped rail renders **one** primary bridge prompt per point (plus the optional secondary), not a four-move list. Mapping (see §3 table):

- **Definition** — chip + the prompt sentence map cleanly to `MEDIATOR_STATE_COPY.definition_not_shared` (rename) and `mediatorRailCopy.definitionBridge` (reword). Safe now.
- **Scope** — chip + the lead prompt map cleanly to `scope_mismatch` (already "Scope mismatch") and `mediatorRailCopy.scopeBridge` (reword). The **four-move list** is a richer interaction than the shipped one-prompt slot; the safe-now delivery is the reworded single prompt that names the bridge intent ("narrow, branch, or respond to the exact point"), with the explicit per-move chooser **DEFERRED to UX-NEXT-MOVE-001** (which owns the Act/next-move surface). See O-3.
- **Help sentences** ("A shared definition would make this point easier to test." / "A scope bridge keeps the reply anchored without calling either person wrong.") — these are the bridge *rationale*. The shipped rail has no rationale line; the MEDIATOR_STATE_HELPER map carries a per-state helper that renders in the Inspect detail. Safe-now options: (a) reword the `definition_not_shared` / `scope_mismatch` entries in `MEDIATOR_STATE_HELPER` to the issue's bridge rationale (renders in Inspect, ban-list clean), or (b) defer the rail rationale line. See O-2.

### Finding D — the MODEL and PRECEDENCE are out of scope and must not move

- `definitionScopeBridgeDisplay.ts` returns booleans + a `primary`/`secondary` choice and **no copy** — it is the data source and is **untouched** (`definitionScopeBridgeDisplay.test.ts` asserts only the structure, never strings, so it is unaffected by the copy reframe).
- Definition-wins-over-scope is **UX-MEDIATOR-001's** precedence (`V4_PRIMARY_STATE_PRIORITY`: `definition_not_shared` rank 4 outranks `scope_mismatch` rank 5; `mediatorPrecedence.test.ts:236` pins it). This card **consumes** that ordering through the already-shipped `getDefinitionScopeBridgeForPoint` primary choice; it adds **no** precedence logic.

### Finding E — every test that pins "Definition needed" is enumerated; two are load-bearing inversions

A repo grep for `Definition needed` returns six test occurrences (§ "Tests that pin old wording"). Two are **deliberate deferral markers** that this card must invert (`nodeMediatorMarkers.test.ts:114-119`, `uxMediator002NodeMarkup.test.tsx:193-199`); two are bridge-copy literals in this card's own test file (`disagreementPointsRailBridge.test.tsx:80,129`); two are ban-list-clean label literals in loops (`MediatorNodeMarker.test.tsx:48`, `MediatorNodeInspectDetail.test.tsx:94`) that pass either way but should be aligned. No model/precedence test references the *label*.

**Effort:** the issue labels this **M**. The *code* delta is **S** (one map line + ~3 copy strings + lockstep test updates). The **M** is justified by the test-reconciliation care (inverting two deferral-marker tests without flipping any model assertion) and the doctrine copy scan. Keep **M**.

---

## Data model

**No new data model. No model change at all.** This card edits user-facing copy + the plain-language map only.

- `MediatorStateCode` union (`mediatorBoardTypes.ts`) — unchanged. The internal code stays `definition_not_shared` (deterministic; never renamed).
- `definitionScopeBridgeDisplay.ts` (`PointBridgeDisplay`, `BridgeKind`) — unchanged. Still returns `{ pointId, hasDefinition, hasScope, primary, secondary }`, no strings.
- `V4_PRIMARY_STATE_PRIORITY`, `v4DisplayStateFor`, `V4_DISPLAY_STATE_BY_CODE` — unchanged (UX-MEDIATOR-001 owns them).
- No SQL, no migration, no type rename, no field add.

---

## §3 THE COMPACT MAPPING TABLE (core deliverable)

Legend: **B-T** = behavior-touched, **D-A** = data/API-touched, **Safe** = safe-now / deferred.

| # | Surface | Current implementation | Desired v4 behavior | Source / model hook | Copy-to-use | Copy-to-avoid | B-T | D-A | Safe | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Central state label** (the one map every surface reads) | `mediatorPlainLanguage.ts:23` `definition_not_shared: 'Definition needed'` | rename label to **"Definition not shared"** (deterministic code unchanged) | `MEDIATOR_STATE_COPY` → `plainLanguageForMediatorState` | "Definition not shared" | "Definition needed", "definition error", "missing definition" | n | n | **safe now** | `mediatorBoardState.test.ts:487-497` (coverage), `:513-517` (ban-list) — both stay green; new explicit-rename assertion added |
| 2 | **Primary node chip label** (`MediatorNodeMarker`) | renders `marker.label` = `plainLanguageForMediatorState('definition_not_shared')` = "Definition needed" | shows **"Definition not shared"** automatically once #1 lands | `nodeMediatorMarkers.ts:100` (no edit) | (inherits #1) | (inherits #1) | n | n | **safe now** | `nodeMediatorMarkers.test.ts:114-119` (INVERT to expect "Definition not shared"); `uxMediator002NodeMarkup.test.tsx:193-199` (INVERT) |
| 3 | **Inspect detail block** (`MediatorNodeInspectDetail`) | renders `marker.label` ("Definition needed") + `MEDIATOR_STATE_HELPER.definition_not_shared` helper | label shows **"Definition not shared"** (auto via #1); optionally reword the helper to the bridge rationale (O-2) | `MediatorNodeInspectDetail.tsx:58` (no edit); `MEDIATOR_STATE_HELPER:43` (optional reword) | label inherits #1; helper (O-2a) "A shared definition would make this point easier to test." | "evasion", "wrong term", "you are equivocating" | n (label) / **y** (helper, O-2a) | n | **safe now** (label); helper **O-2** | `MediatorNodeInspectDetail.test.tsx:94` (align literal); helper ban-list scan |
| 4 | **Rail definition bridge prompt** | `mediatorRailCopy.ts:58` `definitionBridge: 'Definition needed — pin down the term together.'` | reword to BRIDGE prose leading with **"The key term is not yet shared."** + move "Define the key term." | `DisagreementPointsRail.tsx:474` (no edit; reads the copy slot) | "The key term is not yet shared. Define the key term together." | "Definition needed", "pin it down or else", "you're equivocating" | n | n | **safe now** | `disagreementPointsRailBridge.test.tsx:80` (UPDATE literal) |
| 5 | **Rail scope bridge prompt** | `mediatorRailCopy.ts:60` `scopeBridge: 'Scope mismatch — narrow the point or branch a separate claim.'` | reword to BRIDGE prose: **"This appears to answer a different scope."** + the bridge moves (narrow · branch the provable part · respond to the exact point · accept the narrower scope) | `DisagreementPointsRail.tsx:475` (no edit) | "This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point." | "off-topic", "non-responsive", "evasion", "dodging" | n | n | **safe now** | `disagreementPointsRailBridge.test.tsx:89` (UPDATE literal) |
| 6 | **Rail secondary short label (definition)** | `mediatorRailCopy.ts:64` `definitionShort: 'Definition needed'` | rename to **"Definition not shared"** | `DisagreementPointsRail.tsx:485` (no edit) | "Definition not shared" | "Definition needed" | n | n | **safe now** | `disagreementPointsRailBridge.test.tsx:129` (`'Also: Definition not shared'`) |
| 7 | **Rail secondary short label (scope)** | `mediatorRailCopy.ts:65` `scopeShort: 'Scope mismatch'` | unchanged ("Scope mismatch" is already v4) | (no edit) | "Scope mismatch" | "off-topic" | n | n | **safe now** | covered by existing bridge tests |
| 8 | **Rail bridge lead-in** | `mediatorRailCopy.ts:52` `clarifyPoint: 'Clarify the point'` | unchanged (neutral, on-doctrine) | (no edit) | "Clarify the point" | "Fix your reply" | n | n | **safe now** | `disagreementPointsRailBridge.test.tsx:79` (stays "Clarify the point") |
| 9 | **Rail row state badge** (`v4RowBadgeLabel`) | shows "Definition needed" via `v4DisplayStateFor` projection | shows **"Definition not shared"** automatically once #1 lands | `DisagreementPointsRail.tsx:78-82` (no edit) | (inherits #1) | (inherits #1) | n | n | **safe now** | `DisagreementPointsRail.test.tsx:180` fixture uses the state; assert rendered badge text if present |
| 10 | **Disagreement-points sheet row** (same component, sheet variant <720px) | renders the same `DisagreementPointRow` | identical bridge copy in the sheet (one component → parity automatic) | (no edit) | (inherits #4/#5) | (inherits) | n | n | **safe now** | `uxMediator005DisagreementSheet.test.tsx` re-run; bridge text asserted in sheet variant |
| 11 | **Impasse "Agreed along the way" definition summary** | **ABSENT** — no impasse card chrome ships yet (UX-IMPASSE-001 not shipped) | the agreed-definition summary ("'Knowledge work' = …") renders in the impasse path | (no hook exists today) | — | — | n | n | **DEFERRED to UX-IMPASSE-001** | n/a (acceptance item carried by IMPASSE card; see §"Deferrals") |
| 12 | **`definitionScopeBridgeDisplay.ts` model** | booleans + primary/secondary, no copy | **untouched** (data source; precedence consumed, not authored) | — | — | — | n | n | **safe now (no change)** | `definitionScopeBridgeDisplay.test.ts` — structure only, unaffected |
| 13 | **Precedence (Definition wins over Scope)** | `V4_PRIMARY_STATE_PRIORITY` rank 4 > 5 (UX-MEDIATOR-001) | **consumed, not changed** | `getDefinitionScopeBridgeForPoint` primary choice | — | — | n | n | **safe now (no change)** | `mediatorPrecedence.test.ts:236` stays green (model untouched) |

**Net editable surfaces:** rows 1, 4, 5, 6 (always) + row 3 helper (O-2a) — **2 files** (`mediatorPlainLanguage.ts`, `mediatorRailCopy.ts`). Rows 2, 9, 10 inherit row 1 for free. Rows 11 deferred; 7, 8, 12, 13 unchanged.

---

## §2 The exact copy strings (advisory bridge, person-neutral)

### Definition — "Definition not shared"

- **State label / chip:** `Definition not shared`
- **Bridge detail lead (rail prompt):** `The key term is not yet shared.`
- **Next move:** `Define the key term.`
- **Rationale / help:** `A shared definition would make this point easier to test.`
- **Composed rail prompt (single `definitionBridge` slot):** `The key term is not yet shared. Define the key term together.`
- **Secondary short label:** `Definition not shared`

### Scope — "Scope mismatch"

- **State label / chip:** `Scope mismatch` (already v4 — no rename)
- **Bridge detail lead (rail prompt):** `This appears to answer a different scope.`
- **Next moves (bridge intents):** `Narrow the claim` · `Branch the provable part` · `Respond to the exact point` · `Accept the narrower scope`
- **Rationale / help:** `A scope bridge keeps the reply anchored without calling either person wrong.`
- **Composed rail prompt (single `scopeBridge` slot, safe-now):** `This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.`
- **Secondary short label:** `Scope mismatch` (unchanged)

### Why these are bridges, not accusations (doctrine)

- Definition prompts treat a divergent term as a **shared task** ("not yet shared", "together"), never an error or equivocation.
- Scope prompts describe **structure** ("answers a different scope") and offer the responder a dignified path including **accepting the narrower scope** — never "off-topic", "non-responsive", "evasion", or "bad faith".
- No string asserts a person did anything; the rationale lines explicitly anchor the no-blame framing ("without calling either person wrong").

---

## Where "Definition not shared" and "Scope mismatch" will appear (after this card)

| State label / chip vocabulary | Surface | Mechanism |
|---|---|---|
| **Definition not shared** | node chip (`MediatorNodeMarker`) | inherits `MEDIATOR_STATE_COPY` rename (#1) |
| **Definition not shared** | Inspect detail (`MediatorNodeInspectDetail`) | inherits `MEDIATOR_STATE_COPY` rename (#1) |
| **Definition not shared** | rail row badge (`v4RowBadgeLabel`) | inherits `MEDIATOR_STATE_COPY` rename via `v4DisplayStateFor` (#9) |
| **Definition not shared** | rail bridge secondary short (`Also: …`) | `definitionShort` rename (#6) |
| **The key term is not yet shared. Define the key term together.** | rail bridge primary prompt (sheet + side) | `definitionBridge` reword (#4) |
| **Scope mismatch** | node chip / Inspect / rail badge | already shipped (no rename needed) |
| **This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.** | rail bridge primary prompt (sheet + side) | `scopeBridge` reword (#5) |

---

## §3 / Which tests pin old wording + how they reconcile

| Test | Line | Pins | Reconciliation in implement |
|---|---|---|---|
| `__tests__/nodeMediatorMarkers.test.ts` | 114-119 | model PRODUCES "Definition needed" for `definition_not_shared`; comment says rename "deferred to UX-MEDIATOR-004" | **INVERT** — expect `defMarker?.label === 'Definition not shared'`; update the comment to "renamed by UX-MEDIATOR-004" (this is the deferral this card lands). `code` stays `definition_not_shared`. |
| `__tests__/uxMediator002NodeMarkup.test.tsx` | 193-199 (+ header L10) | `marker?.label === 'Definition needed'` AND `not.toBe('Definition not shared')` | **INVERT** — flip both assertions: `toBe('Definition not shared')`, drop/flip the `not.toBe`; rename the `it(...)` title and the L10 doc comment. The 002 card explicitly authored this as a deferral marker for 004. |
| `__tests__/disagreementPointsRailBridge.test.tsx` | 80 | rail renders `'Definition needed — pin down the term together.'` | **UPDATE** literal to the new `definitionBridge`: `'The key term is not yet shared. Define the key term together.'` (this is 004's own test file). |
| `__tests__/disagreementPointsRailBridge.test.tsx` | 89 | rail renders the old `scopeBridge` | **UPDATE** literal to the new `scopeBridge`: `'This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.'` |
| `__tests__/disagreementPointsRailBridge.test.tsx` | 129 | `'Also: Definition needed'` | **UPDATE** to `'Also: Definition not shared'` (`definitionShort` rename). |
| `__tests__/MediatorNodeMarker.test.tsx` | 48 | ban-list-clean label *literals* array includes "Definition needed" (NOT a model assertion) | **ALIGN** — change the array literal `'Definition needed'` → `'Definition not shared'` for v4 consistency. Passes either way (both ban-list clean); align to avoid a stale literal. |
| `__tests__/MediatorNodeInspectDetail.test.tsx` | 94 | ban-list-clean label *literals* array includes "Definition needed" | **ALIGN** — same as above; change the literal to "Definition not shared". |

**Stays green untouched (no edit needed):**

- `mediatorBoardState.test.ts:487-497` (plain-language coverage — "Definition not shared" is non-empty, no `_`, ≠ code) and `:513-517` (ban-list — no banned token). Add ONE new explicit-rename assertion here (mirrors the `missing_mechanism` rename test at `:592-595`).
- `mediatorPrecedence.test.ts` (model/precedence — references the *code* `definition_not_shared`, never the *label*).
- `definitionScopeBridgeDisplay.test.ts` (structure only, no strings).
- `DisagreementPointsRail.test.tsx` (uses the state in a fixture; if it asserts the rendered badge text, update in lockstep — grep before editing).

**Reconciliation principle:** the rename is encoded in test fixtures as "the deferred state still shows the OLD label." The implement step greps `__tests__` for `Definition needed` and flips every occurrence per the table, distinguishing the two **model-assertion inversions** (load-bearing) from the four **literal alignments** (cosmetic, pass either way).

---

## §6 The smallest-safe delta (files + helpers to change)

### CHANGE — `src/features/mediator/mediatorPlainLanguage.ts` (1 line, optional 2nd)

- **L23:** `definition_not_shared: 'Definition needed',` → `definition_not_shared: 'Definition not shared',` (the deferred rename; the central source for the node chip, Inspect detail, and rail badge).
- **(O-2a, optional) L43:** reword `MEDIATOR_STATE_HELPER.definition_not_shared` from `'The two sides are using a term differently — pin it down together.'` to the issue's bridge rationale `'A shared definition would make this point easier to test.'`; optionally L44 `scope_mismatch` helper to `'A scope bridge keeps the reply anchored without calling either person wrong.'`. Ban-list clean. Renders in the Inspect detail.

### CHANGE — `src/features/mediator/mediatorRailCopy.ts` (~3 lines)

- **L58** `definitionBridge`: `'Definition needed — pin down the term together.'` → `'The key term is not yet shared. Define the key term together.'`
- **L60** `scopeBridge`: `'Scope mismatch — narrow the point or branch a separate claim.'` → `'This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.'`
- **L64** `definitionShort`: `'Definition needed'` → `'Definition not shared'`
- L65 `scopeShort` stays `'Scope mismatch'`; L52 `clarifyPoint` stays `'Clarify the point'`.

### UNTOUCHED (preserve byte-for-byte / behavior)

- `definitionScopeBridgeDisplay.ts` — the data source (booleans + primary/secondary; no copy).
- `deriveMediatorBoardState.ts`, `mediatorBoardTypes.ts`, `nodeMediatorMarkers.ts`, `MediatorNodeMarker.tsx`, `MediatorNodeInspectDetail.tsx`, `DisagreementPointsRail.tsx`, `mediatorDistribution.ts` — all consume the renamed copy transitively; **no component edit**.
- `ArgumentGameSurface.tsx` (mount site + single derivation) — no change.
- `V4_PRIMARY_STATE_PRIORITY` / `v4DisplayStateFor` (precedence) — no change.

### Net file count

- **Modified:** **2** (`mediatorPlainLanguage.ts`, `mediatorRailCopy.ts`) — copy/label only.
- **New:** **0** production files (1 new test file optional; mostly lockstep updates to existing tests).
- **Deleted:** 0.
- **No** new component, helper, type, field, or render slot.

### Node-chip default does NOT regress to chip soup

The rename touches **strings only** — `nodeMediatorMarkers.ts`'s one-chip selection + suppression (`isShowableNodeMarker`, `NODE_MARKER_PRIORITY`) and `MediatorNodeMarker.tsx`'s single-chip render are **untouched**. An ordinary open node still carries zero chips; a `definition_not_shared` node still carries exactly one chip — now reading "Definition not shared". No second chip, no soup.

### Insufficient-signal → Open fallback preserved

This card adds no candidate, no detection, no precedence. A point with no definition/scope signal still resolves to `open` (and the bridge section returns `null` → renders nothing). Insufficient signal never yields a definition/scope accusation — the bridge only renders when `getDefinitionScopeBridgeForPoint` returns non-null, which is driven by the point's own state or a persisted mismatch row (UX-MEDIATOR-001 §4, doctrine §4 — observation-driven, never invented).

---

## §5 / Edge cases the implementer must handle

- **No definition/scope marker on a point** → `getDefinitionScopeBridgeForPoint` returns `null` → no bridge block (unchanged).
- **Both definition AND scope present** → precedence (UX-MEDIATOR-001) picks the primary; the other renders as `Also: <short>` — assert `Also: Definition not shared` / `Also: Scope mismatch` after the rename.
- **`confirms_shared_definition` present** → state is NOT `definition_not_shared` (falls back to open per `mediatorBoardState.test.ts:297`) → no definition bridge. The rename must not make the bridge fire more often (it doesn't — copy only).
- **Empty / null board** → rail shows the unavailable/empty state (unchanged).
- **Sheet vs side variant** → same `DisagreementPointRow` component → identical bridge copy (assert in the sheet variant test).
- **Snake_case / internal-code defense** → `displaySafe` / `looksLikeInternalCode` still wraps every rendered label; "Definition not shared" has no underscore and passes.
- **Ban-list** → "Definition not shared", "The key term is not yet shared.", "This appears to answer a different scope.", "Narrow the claim", "Branch the provable part", "Respond to the exact point", "Accept the narrower scope", "A shared definition would make this point easier to test.", "A scope bridge keeps the reply anchored without calling either person wrong." — scanned against `_forbiddenMediatorTokens()`. **Watch: "wrong"** is on the ban-list — the rationale "without calling either person wrong" CONTAINS the substring "wrong". **Resolution: O-1** below — either (a) reword to avoid the substring ("…without faulting either person." / "…without blaming either person.") so the existing `.includes('wrong')` ban-list scan stays strict, or (b) carve out the phrase. **Designer recommendation: (a) reword to "without faulting either person."** — keeps the ban-list strict and the meaning intact.

---

## §6 / Test plan (`__tests__/`)

Updates + a focused new file `__tests__/uxMediator004DefinitionScopeBridge.test.tsx`:

- **v4 label rename (load-bearing inversions):**
  - `nodeMediatorMarkers.test.ts:114-119` — `definition_not_shared` marker `label === 'Definition not shared'`, `code === 'definition_not_shared'` (code unchanged).
  - `uxMediator002NodeMarkup.test.tsx:193-199` — invert: `marker?.label === 'Definition not shared'`; rendered chip shows "Definition not shared"; never "Definition needed".
  - New assertion in `mediatorBoardState.test.ts` (beside the `missing_mechanism` rename test): `plainLanguageForMediatorState('definition_not_shared') === 'Definition not shared'`, ban-list clean.
- **Bridge copy reframe (rail + sheet):**
  - definition bridge renders `'The key term is not yet shared. Define the key term together.'` (rail side + sheet variant).
  - scope bridge renders `'This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.'`.
  - secondary `'Also: Definition not shared'` when both apply.
  - lead-in stays "Clarify the point".
- **Rail row badge** shows "Definition not shared" for a `definition_not_shared` point (via `v4RowBadgeLabel`).
- **Bridge person-neutral + advisory (doctrine):** extend the existing `disagreementPointsRailBridge.test.tsx` gate-language test (L132-144) to include `'evasion'`, `'bad faith'`, `'fallacy'`, `'wrong'`, `'dishonest'`, `'non-responsive'`, `'off-topic'` in the forbidden phrase list; scan every new bridge/help string.
- **Ban-list clean** over the full rendered rail (rows + bridge + new copy) via `_forbiddenMediatorTokens()` + no snake_case (extend the shipped scan).
- **Insufficient-signal → Open:** a point with no definition/scope signal renders no bridge block (regression).
- **Ordinary submit untouched:** assert no module in scope imports the engine or returns a gate-shaped function (structural — these are copy files; trivially true, re-asserted).
- **One chip not soup:** a `definition_not_shared` node renders exactly one `mediator-node-marker-*` reading "Definition not shared" (regression of UX-MEDIATOR-002).
- **All existing mediator/rail tests stay green:** full re-run of `__tests__/{mediatorBoardState,mediatorPrecedence,nodeMediatorMarkers,MediatorNodeMarker,MediatorNodeInspectDetail,uxMediator002NodeMarkup,uxMediator005DisagreementSheet,DisagreementPointsRail,disagreementPointsRailBridge,disagreementPointsRailEvidence,definitionScopeBridgeDisplay,evidenceDebtDisplay,mediatorDistribution,roomMediatorAdapter}.test.*`.
- **Gates:** `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (full suite, captured exit code per test-discipline gate-timeout rule); test count goes UP (or stays equal if only literals flip — prefer adding the explicit-rename test so it goes up).

No pure-model new logic ships, so the 100%-branch bar applies to nothing new; the bar here is the copy/ban-list + the two inversions.

---

## Dependencies (cards / docs / files)

- **Depends on UX-MEDIATOR-001 (#701, merged)** — the rename was explicitly deferred to this card (UX-MEDIATOR-001 §6/O-1, §10, §"Open questions" O-1). Consumes `v4DisplayStateFor` + precedence; changes neither.
- **Depends on UX-MEDIATOR-002 (#702, merged)** — the node chip + Inspect detail + the deferral-marker tests (`uxMediator002NodeMarkup.test.tsx:193`, `nodeMediatorMarkers.test.ts:114`) this card inverts. UX-MEDIATOR-002 §9 lists "NO 'Definition needed' → 'Definition not shared' visible rename — UX-MEDIATOR-004."
- **Depends on / extends UX-MEDIATOR-005 (#703, merged)** — shipped the rail bridge section + `definitionBridge`/`scopeBridge`/`definitionShort` copy slots this card rewords. UX-MEDIATOR-005 §6 "NO label rename of 'Definition needed' — UX-MEDIATOR-004 owns it."
- **Extends #587 (REF-004)** — the definition/scope bridge helper (`definitionScopeBridgeDisplay.ts`); this card renders v4 vocabulary on top, never re-implements.
- **Reads existing (no change):** `getDefinitionScopeBridgeForPoint`, `MEDIATOR_STATE_COPY`, `MEDIATOR_STATE_HELPER`, `DISAGREEMENT_POINTS_RAIL_COPY`.
- **Single-derivation invariant** (`memory: mediator-board-single-derivation`): board derived ONCE in `ArgumentGameSurface`, shared by rail + node markup. This card touches no derivation — copy only.
- **Design source of truth:** `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-CARDS.md` L919-965 (the UX-MEDIATOR-004 card), L246 (rename attribution); `docs/designs/CIVILDISCOURSE-V4-UX-OVERHAUL-INDEX.md`; the issue's design export refs (precedence L719/721, conflict L865, sheet L304, next-move L328-329, impasse L387, handoff L881/921).

---

## §6 / Deferrals (to sibling cards) — explicit

- **Impasse "Agreed along the way" definition summary (issue acceptance item 3 / export L387)** → **DEFERRED to UX-IMPASSE-001.** No impasse card chrome ships today (Finding C, row 11); there is no mount point or data hook for "'Knowledge work' = …". This card supplies the **vocabulary** ("Definition not shared", the bridge prose) that the impasse card will reuse; the impasse card owns the summary surface. Flag this in the completion report so the acceptance criterion is tracked there.
- **The four-move scope chooser as discrete actions** (Narrow / Branch / Respond / Accept as tappable next-moves) → **DEFERRED to UX-NEXT-MOVE-001** (owns the Act/next-move surface). This card delivers the bridge intents as **prose** in the single rail prompt; the per-move chooser is a richer interaction for the next-move card. See O-3.
- **Evidence-blocked detail copy** → owned by **UX-MEDIATOR-003** (not this card); untouched.
- **Selected-node deeper anatomy** → **UX-SELECTED-NODE-001**; untouched.

---

## §4 / Doctrine self-check (cdiscourse-doctrine)

- **§1 (no truth labels; score never blocks posting):** "Definition not shared" / "Scope mismatch" are structural states; the bridge prompts are advisory ("appears to answer a different scope", "the key term is not yet shared") — no verdict/winner/loser/score/truth. The copy files import nothing from the engine and gate nothing. PASS.
- **§2 (heat ≠ truth) / §3 (popularity is not evidence):** no heat/engagement/amplification token enters any new string (ban-list scan). PASS.
- **§4 (AI moderator limits):** no new inference; the bridge renders only from already-persisted observation-driven board state; insufficient signal stays Open, never a stronger accusation; nothing runs on a network. PASS.
- **§9 (plain language):** every string flows through `MEDIATOR_STATE_COPY` / `DISAGREEMENT_POINTS_RAIL_COPY` and is `looksLikeInternalCode`-guarded + ban-list scanned; no internal code reaches the UI. PASS.
- **§10a (Observations vs Allegations):** the definition/scope states are machine **Observations** surfaced as structural states + bridge prompts, never a user Allegation and never an accusation of intent; the no-blame framing ("without faulting either person", per O-1) is explicit. PASS.
- **Ban-list (this card's own guard):** AVOID list — fallacy · wrong · dishonest · bad faith · manipulative · "AI thinks" · truth · verdict · winner · loser · score · "decide for me" · evasion · off-topic · non-responsive — none appear in the chosen copy (subject to the O-1 "wrong" substring reword). PASS (with O-1 applied).
- **accessibility-targets:** no interactive element added; the chip stays read-only `text`; the rail's existing 44×44 targets + reduce-motion + grayscale-legible bridge text are untouched. PASS.
- **test-discipline:** two load-bearing inversions + four literal alignments + a new explicit-rename assertion + extended ban-list/gate-language scans; full mediator/rail suite re-run; test count up; full-suite exit-0 gate. PASS (plan).

---

## §6 / Non-goals (explicit)

- **NO model / precedence change** — `definitionScopeBridgeDisplay.ts` and `V4_PRIMARY_STATE_PRIORITY` are untouched; the internal code `definition_not_shared` is NOT renamed.
- **NO new component, render slot, helper, type, field, or migration.**
- **NO classifier / MCP / Family K / J / provider call / persistence / Supabase / deploy / netlify-prod.**
- **NO room / seat / chime-in / submission-path change.**
- **NO four-move scope chooser as discrete actions** (UX-NEXT-MOVE-001).
- **NO impasse "agreed along the way" summary surface** (UX-IMPASSE-001) — vocabulary only.
- **NO evidence-blocked detail copy** (UX-MEDIATOR-003).
- **NO route / table / type rename.**

---

## Risks

- **R1 — "wrong" substring in the scope rationale.** The issue's exact help string "without calling either person wrong" trips the `_forbiddenMediatorTokens()` `.includes('wrong')` scan. **Mitigation:** O-1 — reword to "without faulting either person." (designer rec) so the ban-list stays strict; surface as an operator copy question.
- **R2 — Inverting the two deferral-marker tests without flipping a model assertion.** The `code` must stay `definition_not_shared` while the `label` flips. **Mitigation:** the table separates `code` (unchanged) from `label` (flipped); the implementer asserts both.
- **R3 — A `DisagreementPointsRail.test.tsx` fixture may assert the old badge text.** **Mitigation:** grep `__tests__` for `Definition needed` AND `'Definition'` before editing; update any rendered-badge assertion in lockstep (the §3 table is the checklist).
- **R4 — Scope-prompt length on 390px.** The reworded `scopeBridge` is longer; the rail renders it with `numberOfLines={2}`. **Mitigation:** the shipped `bridgePrompt` style already wraps to 2 lines; verify at 390px in the sheet variant test (no overflow). If too long, the safe-now prompt can drop "branch the provable part" to the secondary line — O-3.
- **R5 — `ArgumentGameSurface` is heavily pinned.** Even though no surface edit is needed, the rail renders through it in integration tests. **Mitigation:** copy-only change; run the full suite (not a tailed run) per the gate-timeout rule.

---

## Operator steps (if any)

**None — pure code change.** No `db push`, no `functions deploy`, no env var, no migration, no deploy. The implement step ships a copy/label delta merged via the normal green-PR path; the single-derivation site picks it up with no operator action.

---

## Open questions for the operator (each with a designer recommendation)

- **O-1 (the "wrong" substring — REQUIRED decision):** The issue's scope rationale "A scope bridge keeps the reply anchored **without calling either person wrong**" contains "wrong", which the ban-list scan forbids. (a) **Reword** to "…without faulting either person." (keeps the ban-list strict, meaning intact); (b) keep "wrong" and carve it out of the scan for this phrase. **Recommendation: (a) reword to "without faulting either person."** — the doctrine guard should stay strict; the rationale meaning is unchanged.
- **O-2 (bridge rationale / help line placement):** The issue's help sentences ("A shared definition would make this point easier to test." / "A scope bridge keeps the reply anchored…") have no shipped render slot. (a) Reword the `MEDIATOR_STATE_HELPER` entries for `definition_not_shared` / `scope_mismatch` so they render in the **Inspect detail** (ban-list clean, low-risk); (b) defer the rail rationale line entirely. **Recommendation: (a)** — it surfaces the rationale where the "why" already lives (Inspect detail), with no new slot and no rail-length risk.
- **O-3 (scope four-move set):** The issue lists four scope moves. (a) Deliver them as **prose** in the single rail prompt now ("Narrow the claim, branch the provable part, or respond to the exact point"), with "Accept the narrower scope" carried by the state's pathway label, and the **discrete-action chooser deferred to UX-NEXT-MOVE-001**; (b) build a four-button chooser in this card. **Recommendation: (a)** — the rail's bridge slot is a prompt, not an action surface; UX-NEXT-MOVE-001 owns next-move actions. If the prompt overflows 390px, drop "branch the provable part" to the secondary line.
- **O-4 (definition prompt exact wording):** Compose the single `definitionBridge` slot as "The key term is not yet shared. Define the key term together." (lead + move in one sentence) vs. lead-only "The key term is not yet shared." with the move elsewhere. **Recommendation: the composed single-sentence form** — the rail renders one prompt per bridge; combining lead + move keeps the move visible without a new slot.
- **O-5 (impasse summary tracking):** The "agreed along the way" definition summary (acceptance item 3) is deferred to UX-IMPASSE-001 (no impasse chrome ships today). Confirm the acceptance criterion is satisfied by **supplying the vocabulary** here and **tracking the surface** in UX-IMPASSE-001. **Recommendation: yes** — note it in the PR/completion report so the reviewer doesn't read it as a gap in this card.

---

## Recommended implement-step scope

Touch **2 files** (copy/label only) + test reconciliation:

1. `src/features/mediator/mediatorPlainLanguage.ts` — L23 rename to "Definition not shared"; (O-2a) reword the `definition_not_shared` / `scope_mismatch` helper sentences.
2. `src/features/mediator/mediatorRailCopy.ts` — reword `definitionBridge` (#4), `scopeBridge` (#5, with O-1 "faulting"), rename `definitionShort` (#6).

Plus tests: invert `nodeMediatorMarkers.test.ts:114-119` and `uxMediator002NodeMarkup.test.tsx:193-199`; update the three literals in `disagreementPointsRailBridge.test.tsx`; align the two ban-list label literals; add the explicit-rename assertion in `mediatorBoardState.test.ts`; extend the gate-language/ban-list scans; add `__tests__/uxMediator004DefinitionScopeBridge.test.tsx` for the v4 copy + sheet parity + person-neutral guard.

Run `npm run typecheck && npm run lint && npm run test` (full suite, exit-0); confirm the mediator + rail suites are green and the test count goes up. No model change, no component edit, no `ArgumentGameSurface` change, no backend, no migration, no deploy.
