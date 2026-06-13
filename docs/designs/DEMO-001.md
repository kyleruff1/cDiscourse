# DEMO-001 — Recruitable Debate Demo Corridor (First Disagreement Walkthrough)

**Status:** Design draft
**Epic:** Gallery (entry surface)
**Release:** 6.7
**Priority:** P1 · **Effort:** L · **Lane:** src UI + fixtures (deterministic; zero provider spend) · **Risk:** Medium
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/602

## Goal (one paragraph)

Build a deterministic, no-provider, no-spend **first-run corridor** that lets a cold viewer (operator, investor, friend, prospective user) experience the Disagreement Contract loop in under three minutes, using the **real shipped components** — not screenshots, not a video, not a parallel demo UI. The corridor walks exactly **one disagreement**: here is a claim → here is the disputed point → the Referee Card says what remains open (`Source owed`) → pick one of four plain moves (Ask source / Add evidence / Narrow / Branch) → the issue state changes → the Open Issues rail shows progress → a recruit-friendly closing screen. It is a **product proof corridor**, not generic onboarding. The design is shaped by four doctrine constraints that are load-bearing here: (1) the deterministic Constitution engine is the SOLE submission gate — the corridor never blocks, fakes, or alters a post (cdiscourse-doctrine §1/§4/§5; acceptance-gate invariant restated verbatim in the Doctrine self-check); (2) no truth/verdict/person token ever reaches the viewer (§1); (3) plain moves only — no internal type codes, per ratified REF-ADR-001 (§9); (4) no production credentials, no network, no provider call anywhere in the corridor path. The corridor mounts the same `ArgumentGameSurface` and `OneBox` an ordinary room uses, fed from a **bundled fixture** rather than the network, and intercepts the move at two existing additive seams so the production submit path is byte-untouched.

---

## Central decision: fixture room (chosen) vs seeded demo room (rejected)

**Decision: a bundled local fixture hydrating the real surface props in-memory (Option a). No `supabase/**`, no seed, no migration, no credentials.**

The investigation below proves this is feasible and honest. The deciding fact: **`ArgumentGameSurface` is a pure-prop component — it performs zero network I/O itself.** Every datum it renders arrives as a prop. The network lives one level up in `FullRoomGameSurfaceMount` (`ArgumentTreeScreen.tsx:308-435`), which calls `useArgumentRoomMessages(debate.id)` and maps rows → `ArgumentMessageInput[]`. A demo mount can supply the identical prop shape from a bundled fixture and never touch the network.

A **seeded demo room (Option b)** was rejected: it requires `supabase/seed.sql` or a migration (GATE-C, deploy-bearing), needs production credentials to read back, and directly contradicts the card's "no production credentials" + "deterministic, no network dependency for the corridor's content" constraints. The Automerge posture says a seeded room flips this card to an operator gate — we avoid the fork entirely. **Per the boundary, if implementation discovers a seeded room is genuinely required, STOP and surface — do not design `supabase/**` in.** This design concludes it is NOT required (see the data-dependency table — every input has an in-memory fixture source).

### Data-dependency table — every surface input and its fixture source

`ArgumentGameSurface` (`ArgumentGameSurface.tsx:211-353`) reads the following. Each row is satisfiable from the bundled fixture with **no network, no credentials, no service-role**:

| Surface input (prop) | Source in production | file:line | Fixture strategy |
|---|---|---|---|
| `debate {id,title,rootBody}` | `debate` row + root body | `ArgumentTreeScreen.tsx:496` | Literal object in `demoFixtureRoom.ts`. `id = 'demo-corridor-room'`. |
| `messages: ArgumentMessageInput[]` | `useArgumentRoomMessages` rows mapped | `ArgumentTreeScreen.tsx:409-435` | Hand-authored array per fixture state. Shape pinned at `argumentGameSurfaceModel.ts:62-95`. |
| `currentUserId` | `useAppSession` snapshot | `ArgumentTreeScreen.tsx:310` | Literal `'demo-viewer'` (stand-in). Drives own-bubble classification only. |
| `flagsByArgumentId` | `argument_flags` via hook | `ArgumentTreeScreen.tsx:501` | `{}` (empty) — corridor uses no flags. |
| `tagsByArgumentId` | `argument_tags` via hook | `ArgumentTreeScreen.tsx:502` | Per-message tag codes incl. `source_request` (the `source_owed` lever — see below). |
| `pointTagsByArgumentId` | `point_tags` via hook | `ArgumentTreeScreen.tsx:503` | `{}` (empty). |
| `persistedObservationsByArgumentId` | `argument_machine_observation_results` | `ArgumentTreeScreen.tsx:504` | `{}` (empty) — corridor needs no classifier rows. |
| `latestMessageId` | hook `latestId` | `ArgumentTreeScreen.tsx:505` | Literal per fixture state. |
| evidence artifacts | derived from `messages[].attachedEvidence` | `ArgumentGameSurface.tsx:589-592` | `attachedEvidence` on the `add_evidence` next-state message resolves the debt. |
| evidence debts | derived in-component from tags+artifacts | `ArgumentGameSurface.tsx:607-624` → `deriveEvidenceDebts` | **Derived, not fetched.** A `source_request` tag opens a source debt (`evidenceDebtModel.ts:322-328`). |
| lifecycle / metadata maps | derived in-component | `ArgumentGameSurface.tsx:643-679` | Derived from the fixture messages — no fetch. |
| Open Issue (Referee Card) | derived in-component via `buildOpenIssue` | `ArgumentGameSurface.tsx:1066-1169` → `refereeLoop/openIssueModel.ts` | **Pure derivation** over the fixture — produces `burden: 'source_owed'` from the open source debt (`openIssueModel.ts:740-749`). |
| Open Issues rail | pure projection over derived issues | `ArgumentGameSurface.tsx:200-209` | Projection over the same fixture-derived issues; count drops as states advance. |
| constitution rules | `useConstitution()` | `ArgumentGameSurface.tsx:397` | Real provider, **bundled/seeded-in-memory constitution, no network** (already used app-wide offline). |

**Conclusion: every dependency has a fixture-shaped, in-memory, no-network source.** Option (a) is feasible and is chosen.

### The `source_owed` lever (verified)

The Referee Card burden `source_owed` requires an OPEN source-class evidence debt on the active node (`openIssueModel.ts:740-749`, tier 1). The surface derives debts internally from message `tagCodes` (`ArgumentGameSurface.tsx:607-624` → `deriveEvidenceDebts`). A move tagged `source_request` opens a `source` debt (`evidenceDebtModel.ts:322-328` `REQUEST_TAG_TO_KIND`). So the disputed-point fixture state carries a `source_request`-tagged ask targeting the disputed sub-claim, with no `attachedEvidence` → `buildOpenIssue` yields `axis: 'evidence'`, `relationToParent: 'asks_source'`, `burden: 'source_owed'`, `state: 'source_requested'`. **The implementer MUST pin this with a `buildOpenIssue`-over-fixture unit test (assert `burden === 'source_owed'`)** rather than trust the derivation by inspection.

---

## Move-interception seam (binding)

Posting through `submit-argument` needs credentials and is the real network path. The corridor's step 4-5 ("pick a move → the issue state changes") is therefore **scripted local progression**: the chosen move opens the **real one-box up to (but not through) the network submit**, the viewer confirms, and the corridor swaps the fixture to its pre-authored post-move state. The interception happens at **two existing additive seams — zero production files in the submit chain are edited**:

1. **`ArgumentGameSurface.onAction`** (existing required prop, `ArgumentGameSurface.tsx:261-265`). In production `FullRoomGameSurfaceMount` passes a `handleAction` that opens the App-level composer dock (`ArgumentTreeScreen.tsx:439-479`). The corridor passes its OWN `onAction` that records the chosen move (`ActEntryId`/control + preset) and opens the demo composer. **This is the same prop, a different value — no production code changes.**
2. **`OneBox.onBeforeSubmit` returning `false`** (existing optional prop, `OneBox.tsx:148`, threaded to `ArgumentComposer.tsx:245`). The real post path is `handlePostIntent` (`ArgumentComposer.tsx:244-247`):
   ```ts
   const handlePostIntent = () => {
     if (onBeforeSubmit && onBeforeSubmit() === false) return;  // ← corridor returns false here
     void handleSubmit();                                       //   never reached → no submitArgumentDraft, no network
   };
   ```
   The corridor passes `onBeforeSubmit={() => { recordConfirmAndAdvance(); return false; }}`. The viewer drafts in the real OneBox, presses the real **Post move** button, the existing RULE-004 pre-network gate fires, the corridor advances the fixture, and `handleSubmit()` (which calls `submitArgumentDraft` at `ArgumentComposer.tsx:272`) is **never reached**. No fake success toast over a real submit — there is no real submit. The production submit gating (engine validation + the Edge function) is byte-untouched; the corridor supplies a different value for an existing advisory hook, exactly as RULE-004 already does.

**Why mount `OneBox` directly (chosen) instead of the dock.** `ArgumentComposerDock` hardcodes its own `handleBeforeSubmit` (`ArgumentComposerDock.tsx:399-452`) and does not expose an `onBeforeSubmit` prop. Mounting the dock would require adding an additive `onBeforeSubmit?` override to the dock (a production-file edit, additive, byte-identical when absent). To keep the submit chain **byte-untouched in the strongest sense**, the corridor mounts the real `OneBox` (the actual one-box component — `OneBox.tsx`) inside a thin demo sheet (`DemoComposerPanel`) and passes the existing `onBeforeSubmit`. This edits **zero** production files in the composer/submit chain. (Rejected alternative: dock + additive prop — more chrome fidelity, but one production edit; not worth it.)

**Draft-validity requirement (edge case, must test):** `handlePostIntent` calls `onBeforeSubmit` before the validity check, but the Post button may render disabled when the prefilled draft is engine-invalid (`ArgumentComposer.tsx:251` `evaluationResult?.allowPost`). Each of the four move presets (`quickActionToPreset`) must yield an `allowPost: true` draft against the corridor fixture so the real Post button is pressable. The implementer pins this with an `evaluateArgumentDraft`-over-each-preset test; if any preset is invalid, adjust the fixture parent/types until valid (do NOT relax any gate).

---

## Entry / exit (binding)

**Entry — "See how it works".** Honoring the observer-first Stage 6.4 posture, the corridor is reached by a **non-modal affordance in the gallery toolbar** (the same toolbar that hosts "Notifications", `App.tsx:728-743`). A `Pressable` labeled **"See how it works"** (testID `open-demo-corridor-trigger`) sets a new `demoCorridorOpen` state flag and renders `<DemoCorridorScreen>` as a routed sub-screen, mirroring exactly how `aboutOpen` renders `<AboutScreen>` (`App.tsx:432, 701-703`). No router, no deep link, no new navigation library — pure conditional render, consistent with the app's state-flag navigation.

**Exit.** The corridor's final beat is a **recruit-friendly closing screen** whose single primary action is **"Jump into a real room →"**, which calls `onExit` → `setDemoCorridorOpen(false)` → returns to the live Conversation Gallery. A subordinate secondary action **"Replay the walkthrough"** resets the corridor reducer to step 1. Hardware-back / Escape also exits (subordinate path), mirroring AboutScreen's `onBack`.

---

## Data model

No persistence-layer data model. **No SQL, no migration, no new table.** New **in-memory pure-TS types** (in `corridorModel.ts` and `demoFixtureRoom.ts`):

```ts
// corridorModel.ts — pure TS, no React/Supabase/network imports.

/** The six teaching beats of the corridor (card section Scope steps 1-6) + a closing beat. */
export type CorridorStepKind =
  | 'claim'              // 1. Here is a claim.
  | 'disputed_point'     // 2. Here is the disputed point.
  | 'referee_open_task'  // 3. The Referee Card says what remains open (Source owed).
  | 'choose_move'        // 4. Pick Ask source / Add evidence / Narrow / Branch.
  | 'issue_state_change' // 5. The issue state changes.
  | 'progress'           // 6. The rail shows progress.
  | 'closing';           // recruit-friendly exit.

/** The four canonical plain moves (REF-ADR-001 — no type codes). */
export type DemoMoveCode = 'ask_source' | 'add_evidence' | 'narrow' | 'branch';

export interface CorridorPrimaryAction {
  /** advance to the next step, choose a move, or exit. Exactly one per step. */
  kind: 'advance' | 'choose_move' | 'exit' | 'replay';
  label: string;            // plain-language, ban-list clean, frozen copy atom.
  accessibilityLabel: string;
}

export interface CorridorSecondaryAction {
  kind: 'back' | 'exit' | 'replay' | 'whats_this';
  label: string;
  accessibilityLabel: string;
  /** Always 'subordinate' — drives the lower-visual-weight render contract. */
  emphasis: 'subordinate';
}

export interface CorridorStep {
  id: string;                       // stable step id.
  kind: CorridorStepKind;
  fixtureStateId: DemoFixtureStateId; // which fixture room state renders beneath the guidance.
  teachingLines: ReadonlyArray<string>; // 1-2 plain lines shown in the guidance panel.
  primaryAction: CorridorPrimaryAction;             // EXACTLY ONE.
  secondaryActions: ReadonlyArray<CorridorSecondaryAction>; // 0..n, all subordinate.
  /** Only on the 'choose_move' step: the bounded four-move teaching menu. */
  moveMenu?: ReadonlyArray<{ code: DemoMoveCode; label: string; accessibilityLabel: string }>;
}

export interface CorridorState {
  stepIndex: number;
  fixtureStateId: DemoFixtureStateId;
  chosenMove: DemoMoveCode | null;  // set when a move is picked; drives steps 5-6 copy.
  complete: boolean;
}

export type CorridorEvent =
  | { type: 'ADVANCE' }
  | { type: 'MOVE_PICKED'; move: DemoMoveCode }     // opens the demo composer.
  | { type: 'MOVE_CONFIRMED' }                       // OneBox.onBeforeSubmit fired → advance fixture+step.
  | { type: 'BACK' }
  | { type: 'REPLAY' };
```

```ts
// demoFixtureRoom.ts — bundled fixture; pure data, no imports beyond the surface prop types.
export type DemoFixtureStateId =
  | 'disputed'              // root claim + disputed sub-point + source_request ask → Source owed.
  | 'after_ask_source'     // someone formally asked → state source_requested; rail tags it.
  | 'after_add_evidence'   // source supplied → debt resolved → answered; rail count drops.
  | 'after_narrow'         // claim narrowed → state narrowed.
  | 'after_branch';        // side issue opened on its own lane; mainline preserved.

export interface DemoFixtureRoomState {
  debate: { id: string; title: string | null; rootBody: string | null };
  messages: ReadonlyArray<ArgumentMessageInput>;            // shape: argumentGameSurfaceModel.ts:62
  tagsByArgumentId: Record<string, { tagCode: string }[]>;
  flagsByArgumentId: Record<string, never[]>;              // empty
  pointTagsByArgumentId: Record<string, never[]>;          // empty
  persistedObservationsByArgumentId: Record<string, never[]>; // empty
  latestMessageId: string;
  activeMessageId: string;                                  // the node whose Referee Card teaches.
}

export const DEMO_FIXTURE_ROOM: Readonly<Record<DemoFixtureStateId, DemoFixtureRoomState>>;

/** move → next fixture state (the scripted state table). */
export const DEMO_MOVE_TRANSITIONS: Readonly<Record<DemoMoveCode, DemoFixtureStateId>> = {
  ask_source:   'after_ask_source',
  add_evidence: 'after_add_evidence',
  narrow:       'after_narrow',
  branch:       'after_branch',
};
```

### Scripted state table (move → next fixture state → what the viewer sees)

| Picked move (plain) | `DemoMoveCode` | Next fixture state | Derived Open Issue change | Rail "progress" signal |
|---|---|---|---|---|
| Ask for a source | `ask_source` | `after_ask_source` | `source_requested` (someone formally asked) | issue now reads "Source requested" |
| Add evidence | `add_evidence` | `after_add_evidence` | source debt resolved → `answered` | open-issue **count drops by one** |
| Narrow the scope | `narrow` | `after_narrow` | `narrowed` | issue reads "Narrowed" |
| Open a side issue | `branch` | `after_branch` | branch on its own lane; mainline anchored | mainline issue still listed; new branch lane appears |

Every next-state is a **fully-formed fixture room** so the REAL surface re-derives a NEW Open Issue + rail from real data — never a hand-set label. The Open Issue state for each must be pinned by a `buildOpenIssue`-over-fixture test.

---

## File changes

### New files (all under `src/features/demoCorridor/`)

- `src/features/demoCorridor/corridorModel.ts` — **~220 lines.** Pure-TS state machine: `CORRIDOR_STEPS` (frozen 7-step array), `DEMO_MOVE_TRANSITIONS` re-export, `advanceCorridor(state, event): CorridorState` reducer, `isCorridorComplete(state)`, the frozen copy set (`CORRIDOR_COPY`), and the one-primary-action helpers. No React, no Supabase, no network.
- `src/features/demoCorridor/demoFixtureRoom.ts` — **~280 lines.** The bundled fixture: `DEMO_FIXTURE_ROOM` (the 5 states), the neutral library-hours content, all `ArgumentMessageInput[]` + tag maps. Pure data; imports only the surface prop **types**.
- `src/features/demoCorridor/DemoCorridorScreen.tsx` — **~340 lines.** Route container: owns `useReducer(advanceCorridor)`, derives the fixture state, mounts the real `ArgumentGameSurface` (demo `onAction`), the `DemoCorridorGuidancePanel`, the `DemoMoveMenu` (step 4 only), and `DemoComposerPanel` (when a move is picked). Renders the closing screen at completion. Wires `onExit`.
- `src/features/demoCorridor/DemoCorridorGuidancePanel.tsx` — **~130 lines.** Presentational guidance chrome: teaching lines + the single primary action (filled, prominent) + subordinate secondary row (text-link weight). Fully a11y-labeled; reduce-motion safe (static).
- `src/features/demoCorridor/DemoMoveMenu.tsx` — **~90 lines.** The bounded four-move teaching menu (step 4). Each option is a `Pressable` (44×44, role=button) whose label is sourced from the real Act-entry definitions to avoid copy drift; on press dispatches `MOVE_PICKED`.
- `src/features/demoCorridor/DemoComposerPanel.tsx` — **~90 lines.** Thin demo sheet mounting the real `OneBox` with `onBeforeSubmit={() => { dispatch(MOVE_CONFIRMED); return false; }}`, `onClose` → cancel, fixture `debate`/`parentArgument`/preset, and `rules` from `useConstitution()`. The "real one-box, up to but not through the network" surface.
- `src/features/demoCorridor/index.ts` — **~12 lines.** Barrel exporting `DemoCorridorScreen` + the pure model symbols for tests.

### Modified files

- `App.tsx` — **~25 lines.** (1) `const [demoCorridorOpen, setDemoCorridorOpen] = useState(false);` next to `aboutOpen` (`App.tsx:432`). (2) The "See how it works" `Pressable` in the gallery toolbar (`App.tsx:728-743`), gated to `activeTab === 'arguments' && !hasDebate`. (3) A routed mount: `{demoCorridorOpen && <DemoCorridorScreen onExit={() => setDemoCorridorOpen(false)} />}` mirroring the `aboutOpen` render (`App.tsx:701-703`); add `!demoCorridorOpen` to the gallery/room render guards so the corridor occludes them like `aboutOpen` does. **No other production file changes.**

### Deleted files

- None.

---

## API / interface contracts

Pure model (consumed by `DemoCorridorScreen` + tests):

```ts
export const CORRIDOR_STEPS: ReadonlyArray<CorridorStep>;          // frozen, length 7.
export function advanceCorridor(state: CorridorState, event: CorridorEvent): CorridorState; // pure reducer.
export function initialCorridorState(): CorridorState;             // { stepIndex:0, fixtureStateId:'disputed', chosenMove:null, complete:false }.
export function isCorridorComplete(state: CorridorState): boolean;
export function countPrimaryActions(step: CorridorStep): number;   // invariant helper — must be 1 for every step.
export const CORRIDOR_COPY: Readonly<{ /* frozen ban-list-clean atoms */ }>;
```

Demo screen props:

```ts
interface DemoCorridorScreenProps {
  onExit: () => void;            // App.tsx → setDemoCorridorOpen(false).
}
```

Demo seams passed to REAL components (existing props, demo values — no production component edit):

```ts
// to ArgumentGameSurface (ArgumentGameSurface.tsx:261):
onAction={(control, messageId, preset) => corridorDispatch({ type: 'MOVE_PICKED', move: mapControlToDemoMove(control) })}
viewerRole={'participant'}            // stand-in participant so the four real moves are reachable (see Risks/Open Q).
participantSide={'affirmative'}       // scripted; honors observer-first ENTRY (no choose-side modal).

// to OneBox (OneBox.tsx:148):
onBeforeSubmit={() => { corridorDispatch({ type: 'MOVE_CONFIRMED' }); return false; }}  // pre-network suppressor.
```

`mapControlToDemoMove` maps the surface's `ArgumentBubbleControl` / `ActEntryId` (`ask_for_source`/`add_evidence`/`narrow`/`branch`/`disagree`) onto the four `DemoMoveCode`s; unmapped controls fall back to the active step's default move (deterministic, never undefined).

---

## Edge cases

- **Empty / first render:** `initialCorridorState()` always returns step 0 (`'claim'`, `'disputed'` fixture). No empty-room path — the fixture is always populated.
- **Prefilled draft is engine-invalid → Post button disabled:** the four presets must each yield `allowPost: true` against the fixture (test with `evaluateArgumentDraft`). If invalid, adjust fixture parent/types — never relax a gate.
- **Viewer cancels the composer:** `DemoComposerPanel.onClose` returns to the `choose_move` step unchanged (no advance, no fixture mutation).
- **Viewer taps a real Referee Card zone-3 button instead of the corridor menu:** both route through the same demo `onAction` → identical advance. The zone-3 set (capped at 3, `openIssueModel.ts:800`) is a subset of the four; any of them maps via `mapControlToDemoMove`.
- **Viewer picks a move outside the four (e.g. an extra Act-popout entry):** `mapControlToDemoMove` falls back to the step default → still deterministic.
- **Replay:** `REPLAY` resets to `initialCorridorState()`; the fixture is immutable (frozen), so replay is idempotent.
- **Reduce-motion ON:** guidance panel + composer are static (no Animated). The real surface already honors `reduceMotionOverride` — the corridor passes the user's effective value.
- **Screen-reader entry:** every step's primary/secondary action + teaching lines carry `accessibilityLabel`; the corridor is completable via the action buttons alone (see A11y).
- **Concurrent edits / offline / permission-denied:** **N/A by construction** — no network, no credentials, no write path. (This is itself the no-credential proof; pinned by the source-scan test.)
- **Doctrine edge — "what if the Referee Card looks like a verdict?":** it cannot — `buildOpenIssue` emits only relation/burden/state atoms (`openIssueModel.ts:283-338`), all ban-list-scanned; the corridor adds no new strings to the card, it only frames it ("here's what the referee notes").
- **Doctrine edge — "does the demo create a real moderation/concern record?":** no — the corridor never reaches `request-review` / `submit-argument`; `onBeforeSubmit:false` halts before any write.

---

## Test plan

All under `__tests__/` (pure-model tests import directly; component tests use the repo's RTL/JSDOM pattern):

- `__tests__/demoCorridorModel.test.ts` (**~16 tests**): step progression (`ADVANCE` walks 0→6→complete); determinism (same events → same state); **one-primary-action invariant** (`CORRIDOR_STEPS.every(s => countPrimaryActions(s) === 1)`); `MOVE_PICKED`/`MOVE_CONFIRMED` advances fixture + step per `DEMO_MOVE_TRANSITIONS`; `REPLAY` idempotence; `isCorridorComplete` only at the closing step.
- `__tests__/demoCorridorFixture.test.ts` (**~14 tests**): every `DemoFixtureRoomState` is shape-valid (`ArgumentMessageInput` fields present); **`buildOpenIssue` over `'disputed'` asserts `burden === 'source_owed'`, `axis === 'evidence'`, `relationToParent === 'asks_source'`**; each post-move state asserts its expected Open Issue `state` (`source_requested` / `answered` / `narrowed` / branch lane); `after_add_evidence` resolves the debt (open-issue count drops); ban-list + no-raw-code scan over **all** fixture strings (titles, bodies, tag-derived labels).
- `__tests__/demoCorridorCopy.test.ts` (**~10 tests**): ban-list scan over `CORRIDOR_COPY` + every step's `teachingLines`/action labels (no winner/loser/correct/true/false/liar/dishonest/"bad faith"/manipulative/extremist/propagandist/stupid/idiot/verdict/"proof of"); **no raw `snake_case` / type code** outside backticks (REF-ADR-001 plain-move proof — assert labels match the plain set, not `ask_source`-style codes).
- `__tests__/DemoCorridorScreen.test.tsx` (**~14 tests**): mounts and asserts the **REAL components are present** by their shipped testIDs (`RefereeCardView` zone testIDs, `OpenIssuesRail` testID, `OneBox`/`argument-composer` testID); exactly one primary action rendered per step; step copy matches `CORRIDOR_COPY`; picking a move opens `DemoComposerPanel`; **`onBeforeSubmit` returns `false`** (spy asserts no submit path invoked); completion renders the closing screen; `onExit` fires from "Jump into a real room".
- `__tests__/demoCorridorNoProvider.test.ts` (**~8 tests, source-scan**): reads every file under `src/features/demoCorridor/` and asserts NONE imports/contains `supabase`, `submitArgumentDraft`, `edgeFunctions`, `useArgumentRoomMessages`, `fetch(`, `Anthropic`, `xai`, `x_search`, `SERVICE_ROLE`; asserts the corridor never imports the room data hook. Cross-checks the submit-chain files (`ArgumentComposer.tsx`, `OneBox.tsx`, `composerSubmit.ts`, `submit-argument`) are NOT in the card's diff (reviewer-verified; the test pins the import-absence half).
- `__tests__/demoCorridorA11y.test.tsx` (**~10 tests**): every interactive element has `accessibilityRole` + `accessibilityLabel` + (where applicable) `accessibilityState`; every `Pressable` meets 44×44 (visual or `hitSlop`); reduce-motion path renders static; the corridor is **completable via the labeled action buttons alone** (screen-reader completable); the four-move menu options are each independently focusable + labeled.

Targeted full-suite expectation: **+~72 tests**, all green; `npm run typecheck` + `npm run lint` clean; test count nondecreasing.

---

## Dependencies (cards / docs / files)

- **Assumes the full disagreement loop is shipped** (it is, merged to `main`): REF-002 model (`refereeLoop/openIssueModel.ts` `buildOpenIssue`), REF-003 Referee Card (`cardView/RefereeCardView.tsx`), REF-004 Act/Inspect/Go (`ArgumentGameSurface.tsx:1568-1590` `enterBoxForActEntry`), REF-006-RAIL Open Issues rail (`openIssuesRail/OpenIssuesRail.tsx`), REF-005 Request review, and ratified REF-ADR-001 (plain moves).
- **Reads existing surface contract:** `ArgumentGameSurface` props (`ArgumentGameSurface.tsx:211-353`), `ArgumentMessageInput` (`argumentGameSurfaceModel.ts:62-95`), `OneBox.onBeforeSubmit` (`OneBox.tsx:148`), `ArgumentComposer.handlePostIntent` (`ArgumentComposer.tsx:244-247`), `deriveEvidenceDebts` (`evidenceDebtModel.ts:322-328`, `459+`).
- **Measurement handoff → REF-006 (#589):** the under-3-minutes check is **timed via the REF-006 dogfood protocol** (`docs/testing-runs/REF-006-usability-smoke-protocol.md`). The corridor IS a productized, deterministic instance of REF-006's 5 tasks; REF-006's "Operator dry walk-through" (8-checkbox, protocol section 175-194) and stopwatch fields (`timeToFindDisputedPointSec`, the per-task stopwatch notes) are the measurement harness. DEMO-001 ships the corridor; REF-006 runs the timed pass against it. **No new measurement code in this card** — name the handoff, don't rebuild it.
- **Operator sequencing:** REF-006-RAIL (#599, shipped) → **this card** → REF-006 (#589) dogfood → external users → REF-005B.

---

## Under-3-minutes budget

Step count × interaction cost on the **happy path (one move)**. The REF-006 stopwatch protocol is the measurement instrument (not rebuilt here).

| Step | Beat | Viewer cost | ~seconds |
|---|---|---|---|
| 1 | Read the claim, advance | read + 1 tap | 20 |
| 2 | See the disputed point, advance | read + 1 tap | 20 |
| 3 | Read the Referee Card (`Source owed`), advance | read + 1 tap | 25 |
| 4 | Pick one of four moves | read + 1 tap | 25 |
| (4b) | Real OneBox opens prefilled; press Post move | scan + 1 tap | 25 |
| 5 | See the issue state change, advance | read + 1 tap | 20 |
| 6 | See the rail show progress, advance | read + 1 tap | 20 |
| 7 | Closing screen | read | 15 |
| **Total** | | **8 taps, deliberate reading** | **~170s (< 180s)** |

The budget holds for a deliberate first-time reader picking ONE move. "Replay" and "try another move" are subordinate, off the timed path. If REF-006's timed dry run exceeds 3 minutes, the corrective levers are (in order): trim step teaching lines, drop step 5/6 to a single combined beat, or pre-expand the composer preset further — all copy/layout tweaks, no model change.

---

## Copy set (frozen, ban-list-clean; plain moves only — REF-ADR-001)

`CORRIDOR_COPY` is a frozen object; every atom is scanned by `demoCorridorCopy.test.ts`. No type codes, no `snake_case`, no verdict/person token. Indicative copy (final wording is the implementer's, within these constraints):

- Step 1 (claim): "Every room starts with one claim. Here's this room's."
- Step 2 (disputed point): "One specific point is in dispute — not the whole topic."
- Step 3 (referee open task): "The referee notes what's still open here: a source is owed for this point."
- Step 4 (choose move): "Your turn. Pick one move." — move menu labels (plain, from the real Act entries): "Ask for a source" · "Add evidence" · "Narrow the scope" · "Open a side issue".
- Step 4b (composer): "This is the real composer. Edit if you like, then post your move." (the Post button is the real one-box's.)
- Step 5 (issue state change): "Your move changed what's open on this point."
- Step 6 (progress): "And the open-issues list updated to match. That's the whole loop."
- Step 7 (closing): primary "Jump into a real room →"; one recruit line: "That's CDiscourse: every disagreement becomes one clear, movable point." subordinate "Replay the walkthrough".
- Entry framing (gallery toolbar): "See how it works".
- Stand-in framing line (entry of step 1): "Step into one side of a live dispute."

Forbidden tokens (listed here only as the prohibition the scan enforces): winner, loser, correct, incorrect, true, false, truth, untrue, dishonest, liar, manipulative, extremist, propagandist, stupid, idiot, verdict, "bad faith", "proof of".

---

## A11y

- **Screen-reader completable:** every corridor beat is advanceable via a labeled `Pressable` (primary action). No beat depends on a gesture, hover, or the real surface's deep interactions — the guidance panel's primary button always advances. The four-move menu options are each an independently focusable, role=button, labeled `Pressable`.
- **Targets ≥ 44×44:** every `Pressable` meets `TOUCH_TARGET.minSizePx` (`designTokens.ts:458-459`) via visual size or `hitSlop`. Pinned by `demoCorridorA11y.test.tsx`.
- **Roles + labels + state:** primary action `accessibilityRole="button"` + descriptive `accessibilityLabel` (not just the visible text) + `accessibilityState={{ disabled }}` where relevant; the move menu uses `accessibilityRole="button"` per option (a bounded set, not a radio group — the choice opens the composer, it doesn't toggle).
- **Color never the only signal:** the single primary action is distinguished by position + label weight + a leading glyph, not color alone; subordinate actions read as text links. Grayscale-legible.
- **Reduce-motion safe:** the guidance panel and composer sheet are static (no `Animated`); the corridor passes the user's effective reduce-motion to `ArgumentGameSurface` (`reduceMotionOverride`), which already snaps its animations.
- **Step-change announcement:** on advance, `AccessibilityInfo.announceForAccessibility` reads the new step's first teaching line (sparingly — one per advance, per the accessibility-targets skill's "yes: Active move changed" pattern).
- **Focus order:** guidance panel (teaching → primary → subordinate) precedes the real surface in reading order; the composer sheet traps focus while open and returns it to the move menu on cancel.

---

## Risks

- **Engine-valid prefilled drafts (highest):** the four move presets must each produce an `allowPost: true` draft so the real Post button is pressable. Mitigation: the `evaluateArgumentDraft`-per-preset test; tune the fixture parent/types (never the gate).
- **`viewerRole` framing (observer vs stand-in participant) — open question for operator (below).** Mounting as a stand-in `participant`/`affirmative` is what makes the four real moves reachable; a strict observer would need a scripted "Join" beat first. Risk: an investor might read "you're already a participant" as a posture mismatch with observer-first. Mitigation: the entry framing copy says "Step into one side of a live dispute" so the stand-in is explicit and honest.
- **Session draft pollution:** the real OneBox uses `useArgumentComposer` → `useAppSession` draft storage (local AsyncStorage, no network). The demo namespaces drafts to `debateId = 'demo-corridor-room'` and discards the demo draft on exit (`discardDraft`) so a viewer's real drafts are untouched. Pin the namespacing + cleanup with a test.
- **Copy drift:** the four-move labels must match the ratified plain-move set; source them from the real Act-entry definitions where possible so a future rename flows through. The `demoCorridorCopy.test.ts` no-raw-code scan guards against type-code leakage.
- **Real-component testID coverage:** the component test depends on the shipped components exposing stable testIDs (`RefereeCardView`, `OpenIssuesRail`, `OneBox`). If any lacks a testID, assert by `accessibilityLabel`/role instead — do not add testIDs to production components in this card.
- **No migration, no deploy:** zero operator deploy risk (pure code + fixtures).

---

## Out of scope

- Any `supabase/**` change (seed, migration, RLS) — **explicitly forbidden by the boundary; if genuinely required, STOP and surface.**
- Any `mcp-server/**` change; any provider call (Anthropic / xAI / X / MCP).
- Any change to the production submit path / submit gating (`ArgumentComposer`, `OneBox`, `composerSubmit`, `submit-argument`) or to `refereeLoop/**` / `refereeBanners/**` semantics.
- Multi-disagreement walkthroughs, branching tutorials, or a second fixture topic — exactly **one** disagreement.
- Analytics, timing instrumentation, or A/B measurement inside the corridor — measurement is REF-006's job (handoff, not rebuild).
- Localization, theming variants, voiceover scripting beyond the a11y labels, video/screenshot fallback.
- Persisting demo progress, "resume where you left off", or any write.
- Voting/scoring, search, push, OAuth, public API (v1 scope guards).

---

## Doctrine self-check

**Acceptance-gate invariant (verbatim):** "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine (`src/domain/constitution/engine.ts`, mirrored for the server at `supabase/functions/_shared/constitution/`) is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post." — **Respected:** the corridor adds no path to the submit pipeline at all. It intercepts BEFORE the network at the existing `onBeforeSubmit` advisory hook (`ArgumentComposer.tsx:245`); it never blocks, reject-routes, or delays an ordinary post because it never reaches the post. The engine (`src/domain/constitution/engine.ts`) and `submit-argument` are byte-untouched.

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the corridor renders only the real Referee Card's relation/burden/state atoms (all ban-list-scanned) and adds zero verdict/person tokens; the `demoCorridorCopy` + `demoCorridorFixture` ban-list tests enforce it. The corridor blocks no post (it has none).
- **§4 (AI moderator limits) / §7 (no AI from the app):** no provider call anywhere in the corridor path; pinned by `demoCorridorNoProvider.test.ts`.
- **§5 (rules engine sacred):** untouched; `buildOpenIssue` is pure and consulted read-only.
- **§9 / REF-ADR-001 (plain language, no type codes):** all corridor copy is plain moves; the no-raw-code scan forbids `snake_case`/type codes in user-facing strings.
- **§10a (Observations vs Allegations):** the fixture carries machine Observations only (no user Allegations); Family J stays composer-only — the demo content includes no sensitive-observation exposure (card section "Family J stays composer-only").
- **§6 (secrets) / no-credential:** no `.env`, no service-role, no anon key in the corridor path; the source-scan test pins it.
- **Fixture discipline:** synthetic, neutral, unheated topic (municipal **library weekday-hours** debate per corpus conventions); no real persons, X handles, URLs, or PII. The stand-in author is `'demo-viewer'`.

---

## Operator steps (if any)

**None — pure code + fixture change.** No `supabase db push`, no `functions deploy`, no env var, no manual migration. After merge, the operator's only follow-on action is the **REF-006 (#589) timed dogfood pass** against the shipped corridor (a usability session, not a deploy).

---

## Open question for the operator

**Viewer framing at the "now you try" step:** the design mounts the surface as a **stand-in participant** (`affirmative`) so the four real moves are reachable without a separate scripted "Join" beat, while keeping observer-first ENTRY (no choose-side modal, framing copy "Step into one side of a live dispute"). The alternative — strict observer with an inline scripted "Join For" beat before step 4 — is more posture-faithful but adds one step (~15s) to the budget. **Recommended: stand-in participant.** Confirm before implementation, since it shapes the entry copy and the budget.
