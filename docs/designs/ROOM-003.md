# ROOM-003 — One-bar ArgumentEntryComposer (text; byte-shape contract)

**Status:** Design draft
**Epic:** ASP-000 (#826) — Argument Surface Pivot · M-ASP-2
**Release:** Phase 2 (Room re-weight, A×B) · flag `room_exchange_v2`
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/829 (rewrite of #829; absorbs #830 + #832)
**PR slice:** 07 (`feat/room-003-onebar-composer`)

---

## Goal (one paragraph)

Replying today routes through the full OneBox chassis into `ArgumentComposer.tsx`, which renders always-visible **required** `argumentType` + `side` pickers and hard-requires both in `canSubmit` — the user re-declares intent the context already carries. ROOM-003 collapses the everyday reply to **one bar** (context chip + text field + Proof slot + a reserved, disabled mic slot + send), defaults move type from the transition matrix and side from the participant's seat, and demotes the full OneBox to a never-required "More" popout. Design Pass **principle 5** binds: *send first, structure second* — no pre-send review sheet on the fast path. The deterministic engine (`evaluateArgumentDraft` + the transition matrix) remains the **sole** gate, and the single HARD acceptance criterion is a **byte-shape contract**: for equivalent input the `submit-argument` request payload from the one-bar path is byte-shape-identical to today's composer path. The design achieves that **by construction** — the bar reuses the shipped `buildSubmitArgumentPayload` on a `ComposerDraft` built by the shipped `useArgumentComposer` — with a dual-render contract test as the guard. The whole card is additive and flag-gated (`room_exchange_v2`, default OFF); flag OFF returns today's Dock-primary composer byte-identically.

---

## Cannot-proceed check

No doctrine conflict. No v1-scope violation (this is UI chrome over the existing text-submit path; no voting/search/push/OAuth/public-API, no AI). Proceeding.

---

## Data model

**No new data model.** No migration, no Edge Function, no RLS, no new payload field, no engine change.

The card touches only client chrome. The two shipped types it builds on are unchanged:

- `ComposerDraft` (`src/features/arguments/composerState.ts:11`) — the internal draft; the bar builds/edits the same object via the shipped hook.
- `SubmitArgumentInput` (`src/lib/edgeFunctions.ts`) — the wire payload; the bar produces it via the shipped `buildSubmitArgumentPayload` (`composerSubmit.ts:72`). **Its key set is the byte-shape contract** and must not change.

Two small **pure view-models** are introduced (no persistence, no React):

```ts
// src/features/arguments/composer/argumentEntryComposerModel.ts

import type { ArgumentType, ArgumentSide } from '../types';
import type { ParticipantSide } from '../../debates/types';
import type { ConstitutionRule } from '../../../domain/constitution/types';
import type { EvaluationResult } from '../../../domain/constitution/types';

/** The bar's resolved reply target (a projection of App-level state). */
export interface EntryComposerTarget {
  /** Parent argument id, or null for a root-claim context. */
  parentId: string | null;
  /** Parent argument type (drives type defaulting), or null at root. */
  parentType: ArgumentType | null;
  /** One-line label the context chip renders (plain language). */
  chipLabel: string;
  /** True when the chip's ✕ / swipe should be offered (a parent is scoped). */
  clearable: boolean;
}

export interface EntryComposerDefaultsInput {
  parentType: ArgumentType | null;
  /** The viewer's established seat; drives side defaulting. */
  participantSide: ParticipantSide | null;
  /** Whether the reply target is the viewer's OWN move (continuation vs counter). */
  replyingToOwnMove: boolean;
  /** Active constitution rules — the allowed-type source of truth. */
  rules: ReadonlyArray<ConstitutionRule>;
}

export interface EntryComposerDefaults {
  argumentType: ArgumentType; // ALWAYS a member of the engine-allowed set
  side: ArgumentSide;
}

/** Pure: choose an engine-VALID default type + a seat-derived side. */
export function deriveEntryComposerDefaults(
  input: EntryComposerDefaultsInput,
): EntryComposerDefaults;

/** Pure: map a participant seat onto an ArgumentSide. */
export function sideForParticipantSeat(side: ParticipantSide | null): ArgumentSide;

/** Bar element visibility (which slots render), derived from viewer/flag/target. */
export interface EntryComposerBarLayout {
  showContextChip: boolean;
  showProofSlot: boolean;   // always true (routes to More until PROOF-002)
  showMicSlot: boolean;     // always true; ALWAYS disabled in this card
  showMoreButton: boolean;  // always true
  canSend: boolean;         // body non-empty AND evaluation.allowPost
}
export function deriveEntryComposerBarLayout(input: {
  bodyLength: number;
  evaluation: EvaluationResult | null;
  hasParent: boolean;
}): EntryComposerBarLayout;

/** Q10 instrumentation: does this fast-path post carry a civility advisory
 *  that the pre-send review would have surfaced? Advisory-only signal —
 *  NEVER blocks, NEVER a network call, NEVER an AI call. */
export function deriveFastPathCivilitySignal(
  evaluation: EvaluationResult | null,
): { hadCivilityAdvisory: boolean; flagCodes: ReadonlyArray<string> };
```

---

## Design decisions (the 7 the card turns on)

### 1. Architecture — thin wrapper, byte-shape *by construction* (NOT a parallel composer)

The bar is a **new thin component that wraps the shipped draft model** — not a re-implementation of the post flow. Concretely:

- Draft: reuses `useArgumentComposer(debate.id, selectedParentId)` verbatim. The bar and the "More" popout (the existing dock/OneBox/ArgumentComposer) both read/write the **same** session `activeDraft` (session-scoped by `debateId`), so a body typed in the bar is present when More opens, and vice versa. No parallel draft store (AC).
- Gate: reuses `buildEvaluationInput` (`composerValidation.ts:28`) + `evaluateArgumentDraft`. Unchanged engine. `buildEvaluationInput` returns `null` until `argumentType` **and** `side` are set — so the bar applies its defaults (decision 3) **before** evaluation, then reads `evaluation.allowPost`.
- Payload: reuses `buildSubmitArgumentPayload(draft, clientSubmissionId)` (`composerSubmit.ts:72`) — the **same pure function** the dock path calls. Because the payload is a pure function of the draft, and both paths produce the same draft for equivalent input, the payload is **byte-shape-identical by construction**. The contract test (below) is the guard, not the mechanism.
- Submit orchestration: the ~40-line session-dispatch sequence in `ArgumentComposer.handleSubmit` (lines 249-291) is **extracted into a new hook `useEntryComposerSubmit.ts`** that reuses the shipped pure helpers (`createSubmissionFingerprint`, `getOrCreateClientSubmissionId`, `buildSubmitArgumentPayload`, `extractServerValidationError`) and the same dispatch order (`SUBMISSION_QUEUED` → `SUBMISSION_STARTED` → `submitArgumentDraft` → `SUBMISSION_SUCCEEDED`/`FAILED`). **`ArgumentComposer.tsx` is NOT edited** to consume this hook (that would trip its zero-diff pin — see Pin inventory); the hook is a new file the bar owns. The orchestration is *session dispatch*, not the *network payload* — the byte-shape contract governs the payload only, so this is drift-safe.

Rejected: a parallel composer that builds its own payload object literal. That would re-introduce the exact drift the byte-shape AC exists to prevent.

### 2. Fast path vs More — the review sheet decision

- **Fast path (bar Send):** posts directly via `useEntryComposerSubmit`. The engine gate (`evaluation.allowPost`) and the hard blocks still apply and surface **inline** in the bar's blocked state (decision below). **No `PreSendReviewSheet`.** This is principle 5 (send first, structure second) — the review sheet is friction that the deterministic engine already makes unnecessary for the ordinary reply.
- **More path (existing dock):** unchanged. The dock already wires `onBeforeSubmit` → `buildPreSendReview` → `PreSendReviewSheet` and the one-shot `postSignal` bypass (`ArgumentComposerDock.tsx:399-459`). Opening "More" mounts the shipped dock **as-is**, so the pre-send review **remains for the More path** exactly as today. Anyone who deliberately opens the full composer still gets the pause-before-send advisory.

This satisfies Q10 (Output 13): *"does removing the pre-send review increase civility flags? Instrument before/after."* Because the fast path skips the sheet, the bar records a lightweight **advisory-only** signal — `deriveFastPathCivilitySignal(evaluation)` — via an injected optional callback `onFastPathCivilitySignal?` (default no-op). It reports whether the just-posted move carried a `CIVILITY_HEURISTIC` `review`-severity advisory (`AD_HOMINEM` / incivility) that the pre-send sheet would have surfaced. **No network, no AI, no PII, no block** — it is a counting hook so the team can compare civility-flag rates before/after the fast path lands. The deterministic engine remains the sole gate; this signal never changes an outcome.

### 3. Type/side defaulting — from the transition matrix + seat (pure model, adjustable, never required)

`deriveEntryComposerDefaults` in the new pure model:

**Type** (always clamped to the engine-allowed set from `getAllowedArgumentTypesForParent(parentType, rules)` — `composerHelpers.ts:155`):

| Context | Preferred default | Fallback rule |
|---|---|---|
| Root (no parent) | `claim` (everyday opener; `thesis` reserved for the formal Start flow) | first of `allowedRootTypes` |
| Reply to **opponent** move (different side) | the natural counter — `parent rebuttal → counter_rebuttal`, `parent counter_rebuttal → rebuttal`, else `rebuttal` (mirrors `quickActionPresets.challenge`, `quickActionPresets.ts:86`) | first allowed reply type |
| Reply to **own** move (continuation) | the least-adversarial allowed continuation — `claim` if allowed, else `clarification_request` if allowed | first allowed reply type |

The preferred type is **intersected with the allowed set**; if the preferred type is not allowed it falls back to the first allowed type. **A disallowed inference is never posted** (AC): the bar always sends an engine-valid type. Adjustable afterward via **More** (the OneBox type chip), never required on the fast path.

**Side** — `sideForParticipantSeat(participantSide)`:

| `ParticipantSide` | → `ArgumentSide` |
|---|---|
| `affirmative` | `affirmative` |
| `negative` | `negative` |
| `observer` / `moderator` / `null` | `neutral` |

(`ParticipantSide` = `affirmative|negative|observer|moderator`; `ArgumentSide` = `affirmative|negative|neutral`.) Adjustable via More; never required. An observer who has not joined defaults `neutral` — but note observers cannot post anyway (the bar renders read-only for observers; see Component spec).

The defaults are applied to the draft (via the shipped `updateField`) **only when the field is null** (never overriding a user's explicit More choice), and re-applied when the reply target changes.

### 4. #830 absorption (More panel) + #832 absorption (phone band)

- **#830 — optional-modifier pop-out = the "More" panel.** The pop-out **is** the existing `ArgumentComposerDock` → `OneBox`, mounted **unchanged**. Every modifier (type/side/disagreement-axis/tags/evidence fields/framing) lives behind that single "More" affordance; none is visible on the bar by default; **submit works with More never opened** (the bar's fast-path send). The audience modifier stays inside More and respects QOL-039 one-way visibility (untouched). This literally satisfies "`ArgumentComposerDock` becomes the popout host for type/side/framing overrides" — the dock already hosts OneBox; ROOM-003 demotes it from *primary chrome* to *More* at the mount, without editing the dock file.
- **#832 — mobile sheet behavior = phone-band ACs.** The **bar** is a persistent bottom bar on every band, docked **above the keyboard** via `KeyboardAvoidingView` (mirroring the dock's keyboard handling), with all pressables ≥ `TOUCH_TARGET` (44). The **More popout** inherits the dock's existing 720px breakpoint: `resolveDockLayoutVariant` (`ArgumentComposerDock.tsx:102`) already renders a bottom **sheet** < 720 and a right **panel** ≥ 720 — reused verbatim. Renders correctly at **390 / 768 / 1440** (verified via the Claude_Preview harness + RNTL band tests).

### 5. Flag + flag-off (rides the ROOM-001 threaded prop; no new plumbing)

`room_exchange_v2` is **already** resolved in `App.tsx` (`isRoomExchangeV2Enabled()`, `App.tsx:572`) and threaded to the room. ROOM-003 rides the **same** boolean — **no new flag plumbing, no `featureFlags` import under `src/features`** (the bar receives the mount decision from App.tsx; it never reads env). Behavior:

- **Flag OFF:** App.tsx passes `onComposerExpand={handleComposerExpand}` (today) → the `CollapsedComposerStrip` renders in the room and the dock is the primary composer. The bar subtree is **not mounted**. Byte-identical to today; rollback = flag off + straight revert. Proof strategy (ROOM-001 precedent): the bar subtree not mounted + the pinned dock/OneBox/composer files zero-diff prove no drift.
- **Flag ON:** the **rail (#880) and the bar (this card) activate together** — stated explicitly. App.tsx suppresses the collapsed strip (passes `onComposerExpand={undefined}`, which makes `ArgumentRoom` render no strip — `ArgumentRoom.tsx:2659` gates the strip on that prop) and mounts `<ArgumentEntryComposer>` at the bottom of the room View. The bar's **More** button calls the same App-level `handleComposerExpand` (opens the shipped dock).

### 6. Slices

- **S1 — pure model + contract scaffolding.** `argumentEntryComposerModel.ts` (target derivation, type/side defaulting, bar-layout visibility, Q10 signal) + `useEntryComposerSubmit.ts` + the **byte-shape contract test** skeleton (payload key-set snapshot from `buildSubmitArgumentPayload`). No UI yet. All pure/unit-testable.
- **S2 — bar view + More wiring + RNTL.** `ArgumentEntryComposer.tsx` (context chip, text field, Proof slot, disabled mic slot, More button, Send) driving the S1 model + hook; RNTL for the bar and the "open More" round trip. Not yet mounted in App.
- **S3 — App.tsx mount behind the flag + full byte-shape contract + flag-off proof + absorbed ACs.** Additive App.tsx edit (mount bar ON, suppress strip ON), the dual-render deep-equal contract test, the flag-off parity render, and the #830/#832 acceptance tests.

### 7. Non-goals (explicit)

No audio capture / recording UI / permissions / `expo-av` / `expo-speech-recognition` code (the mic slot is reserved + disabled; VOICE-UI-001 fills it). No Proof drawer implementation (PROOF-002; the Proof slot routes to More for now). No marker/quote-scoped `RebuttalComposer` (the chip contract only; #831 lands after). No Edge Function / migration / RLS / payload-field change. No engine change. **No removal of the dock/OneBox/ArgumentComposer code** (flag OFF keeps them primary for one release). No gallery/home changes.

---

## Pin-relaxation inventory (required — the ROOM-001 lesson)

This card lives in the most-pinned area of the repo. Every source-scan / read-only-boundary / byte-shape suite that fires when composer/dock/OneBox/room files change was enumerated. **The design is deliberately engineered so the binding zero-diff pin needs ZERO relaxations.**

| Pin suite | Kind | Files it guards (relevant subset) | ROOM-003 verdict |
|---|---|---|---|
| **`uxOneOneFiveReadOnlyBoundary.test.ts`** | **Zero-diff vs `main`** (`git diff main -- <path>` must be empty) | `ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `oneBox/OneBox.tsx`, `oneBox/{ActPopout,GoPopout,Popout}.tsx`, `composer/{ComposerContextStrip,CollapsedComposerStrip,composerDraftRegistry,composerKeyboardModel,useComposerFocusContext,composerActingOnModel,composerHaptics}.ts(x)`, `rulesUx/validationActionMap.ts`, `supabase/functions/submit-argument/` | **NO RELAXATION.** The design touches **none** of these files. The bar reuses the dock **as-is** for "More"; the strip is suppressed via an App-level **prop value** (not a file edit); the submit orchestration is a **new** hook (not an edit to `ArgumentComposer`). All listed paths stay byte-identical → every assertion passes untouched. |
| `uxOneOneSixReadOnlyBoundary.test.ts` | **API-presence** (file exists + retains named exports/tokens) | `App.tsx` (`roomActive`, `testID="app-tab-bar"`), `ArgumentGameSurface.tsx`, `room/{ArgumentRoom,ExchangeView,MapView}.tsx`, `argumentGameSurfaceModel.ts`, all composer/oneBox files above | **NO RELAXATION.** Only `App.tsx` is edited, additively; the pinned tokens (`roomActive`, `testID="app-tab-bar"`) remain. `ArgumentRoom`/`ArgumentGameSurface` are **not** edited. |
| `featureFlagsStaticEnv.test.ts` | Source-scan (each of the 7 static `EXPO_PUBLIC_*` dot reads present; bans the dynamic form across `src/`) | `src/lib/featureFlags.ts` + all of `src/` | **NO RELAXATION.** The bar never reads env; it receives the mount decision as a prop from App.tsx (which already imports `isRoomExchangeV2Enabled`). No new env read, static or dynamic. |
| `oneBoxCopyBanList.test.ts` / other copy ban-lists | Source-scan of frozen copy consts for verdict/amplification tokens | OneBox / gameCopy strings | **EXTEND (additive).** New bar copy is added as a frozen const and a **new** ban-list test scans it (see Copy plan). No existing assertion changes. |

**New files** created under `src/features/arguments/composer/` (`ArgumentEntryComposer.tsx`, `argumentEntryComposerModel.ts`, `useEntryComposerSubmit.ts`) do **not** trip either boundary suite: `uxOneOneFive` enumerates explicit paths (a new path is not in the diff set), and `uxOneOneSix` asserts listed files *exist* (new files don't break that).

**Reviewer confirmation step:** run `git diff main -- <the uxOneOneFive path list>` and confirm empty. If the implementer discovers a hard reason to edit any zero-diff-pinned file (e.g., the dock genuinely cannot host More without a change), that is a **design escalation** — surface it and stop; do not silently relax `uxOneOneFive`. The correct fallback, if ever needed, is to remove the specific path from `READ_ONLY_PATHS` with an operator-authorized `NOTE:` block citing ROOM-003 (mirroring the AppHeader/TimelineMap precedents at `uxOneOneFiveReadOnlyBoundary.test.ts:44-163`) and to keep the file's contract pinned by its own component test. The design does **not** anticipate needing this.

> Note on apostrophes: `uxOneOneTwoDoctrine`'s scanner has a naive quote-parity STRING_RE — a single apostrophe in **any** comment of a scanned source file poisons file-wide parsing (see MEMORY "Doctrine scanner apostrophe gotcha"). Keep **comments in the new source files apostrophe-free** and run the doctrine suite pre-push. (Test files and this design doc are not scanned.)

---

## File changes

### New files

- `src/features/arguments/composer/argumentEntryComposerModel.ts` — pure view-model: `deriveEntryComposerDefaults`, `sideForParticipantSeat`, `deriveEntryComposerTarget`, `deriveEntryComposerBarLayout`, `deriveFastPathCivilitySignal`, plus exported label constants for the ban-list scan. **~180 lines.** No React, no Supabase, no env.
- `src/features/arguments/composer/useEntryComposerSubmit.ts` — the fast-path submit hook. Reuses `composerSubmit.ts` helpers + the shipped session-dispatch sequence; returns `{ submit(draft), isSubmitting, serverErrors }`. **~90 lines.**
- `src/features/arguments/composer/ArgumentEntryComposer.tsx` — the one-bar view (context chip · text field · Proof slot · disabled mic slot · More · Send). Consumes `useArgumentComposer`, `useConstitution`, `buildEvaluationInput`/`evaluateArgumentDraft`, the S1 model, and `useEntryComposerSubmit`. **~320 lines.**

### Modified files

- `App.tsx` — **additive only.** In the room block (`activeTab === 'arguments' && currentDebate`, around `App.tsx:1186-1270`):
  - Compute `const barEnabled = roomExchangeV2Enabled;`
  - Change the strip prop: `onComposerExpand={barEnabled ? undefined : handleComposerExpand}` (line ~1239). ON → strip suppressed; OFF → today's behavior.
  - Mount the bar as a sibling at the bottom of the room View, before/after the existing `<ArgumentComposerDock>` (line ~1257): `{barEnabled ? <ArgumentEntryComposer debate={currentDebate} selectedParentId={replyTarget?.id ?? null} parentArgument={replyTarget?.argument ?? null} activeMessageId={timelineActiveMessageId} participantSide={participantSide} reduceMotionOverride={preferences.effectiveReduceMotion} onOpenMore={handleComposerExpand} onSubmitSuccess={handleSubmitSuccess} /> : null}`
  - The existing `<ArgumentComposerDock visible={composerOpen} …>` stays **unchanged** — it is the "More" host that `handleComposerExpand` opens.
  - Retains `roomActive` + `testID="app-tab-bar"` (uxOneOneSix). **~15 lines net.**

### Deleted files

None.

### Explicitly NOT modified (pinned, load-bearing)

`ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `oneBox/OneBox.tsx`, all `composer/*` pinned files, `validationActionMap.ts`, `submit-argument/`, `ArgumentRoom.tsx`, `ArgumentGameSurface.tsx`, `composerSubmit.ts`, `composerHelpers.ts`, `evaluateArgumentDraft.ts`, `featureFlags.ts`. (Reused, never edited.)

---

## API / interface contracts

### The bar component

```ts
// src/features/arguments/composer/ArgumentEntryComposer.tsx
export interface ArgumentEntryComposerProps {
  debate: Debate;
  /** Reply target parent id (null = root-claim context). */
  selectedParentId: string | null;
  /** Reply target parent row (null = root-claim context). */
  parentArgument: ArgumentRow | null;
  /** Read-only Timeline active id, for the context chip's default target. */
  activeMessageId?: string | null;
  /** The viewer's established seat; drives side defaulting + read-only observer state. */
  participantSide?: ParticipantSide | null;
  /** Effective reduce-motion (OS composed with preference). */
  reduceMotionOverride?: boolean;
  /** Open the full OneBox (the shipped dock) — App.tsx::handleComposerExpand. */
  onOpenMore: () => void;
  /** Post succeeded — App.tsx::handleSubmitSuccess (refreshes the room). */
  onSubmitSuccess: () => void;
  /** Clear the reply target (context chip ✕) — App.tsx::handleClearParent. Optional. */
  onClearParent?: () => void;
  /** Q10 advisory-only instrumentation sink. Default no-op. */
  onFastPathCivilitySignal?: (s: { hadCivilityAdvisory: boolean; flagCodes: ReadonlyArray<string> }) => void;
}
```

### The submit hook (byte-shape carrier)

```ts
// src/features/arguments/composer/useEntryComposerSubmit.ts
export interface UseEntryComposerSubmitResult {
  submit: (draft: ComposerDraft) => Promise<void>; // builds payload via buildSubmitArgumentPayload
  isSubmitting: boolean;
  serverErrors: string[] | null;
}
export function useEntryComposerSubmit(onSubmitSuccess: () => void): UseEntryComposerSubmitResult;
```

The submit call site is byte-identical to `ArgumentComposer.handleSubmit`:
`fingerprint = createSubmissionFingerprint(draft)` → `clientSubmissionId = getOrCreateClientSubmissionId(pending, fingerprint)` → dispatch `SUBMISSION_QUEUED`/`SUBMISSION_STARTED` → `payload = buildSubmitArgumentPayload(draft, clientSubmissionId)` → `submitArgumentDraft(payload)` → dispatch `SUBMISSION_SUCCEEDED`/`FAILED` + `DRAFT_CLEARED` + `deleteDraft`.

### The byte-shape contract (frozen key set — do not change)

`buildSubmitArgumentPayload` emits, for equivalent input, exactly:
`debate_id`, `parent_id`, `argument_type`, `side`, `body`, `selected_tag_codes`, `client_submission_id`; **optional** `attached_evidence[]{ url, label, source_text }`; **optional** `target{ target_excerpt?, disagreement_axis? }`. The contract test snapshots this key set and fails on any added/removed/renamed key.

---

## Component spec

**ArgumentEntryComposer** — one bar, docked bottom, above the keyboard.

- **Props:** as above.
- **States** (Design Pass §6, text-card subset — no audio states):
  - `idle` — context chip + empty/typed text field + Proof slot + disabled mic slot + More + Send (disabled until body non-empty & `allowPost`).
  - `posting` — Send shows a busy spinner; input disabled; `accessibilityState={{ busy: true }}`.
  - `blocked (hard rule only)` — Send disabled + an inline plain-language reason from the engine's `blockingErrors` (mapped via `gameCopy`). The **evidence hard-block** (`EVIDENCE_SOURCE_REQUIRED`, `evaluateArgumentDraft.ts:228`) surfaces here if an evidence-typed draft has no source — **no bypass**. (Empty-body and over-length blocks surface here too.)
  - `offline-queued` — a failed/queued `pendingSubmission` shows a retry affordance; the retry reuses the same `clientSubmissionId` via `getOrCreateClientSubmissionId` (idempotent — `createSubmissionFingerprint` unchanged).
  - **Observer read-only** — when `participantSide` is `observer`/null, the bar renders a calm "Join to reply" prompt routing to the rail's join (no text field). (Design Pass J1/J10 — nothing is ever required to reply, but you must have a seat.)
- **Slots + testIDs:**
  - `argument-entry-composer` (root), `argument-entry-composer-chip`, `argument-entry-composer-input`, `argument-entry-composer-proof`, `argument-entry-composer-mic`, `argument-entry-composer-more`, `argument-entry-composer-send`, `argument-entry-composer-blocked`.
  - **Context chip** — names the target (`deriveEntryComposerTarget`): "Answering: {parent excerpt}" or "New point" at root. ✕ / swipe clears it (`onClearParent`), extending `ComposerTargetPanel` / `target_excerpt` semantics. `clearable` false at root.
  - **Proof slot** — labeled button `Proof`; in this card it **routes to More** (`onOpenMore`) where the shipped evidence fields live, so proof stays reachable and never blocks a reply. PROOF-002 replaces the target with the real drawer. (Honest interim — no fake drawer.)
  - **Mic slot** — the **56px hero** target per §6, but **rendered disabled** with honest plain-language copy ("Voice — coming soon"), `accessibilityState={{ disabled: true }}`, and no press handler. **Zero audio-API import** in the file (source-scan test).
  - **More** — opens the shipped dock (`onOpenMore`); ≥44px; `accessibilityRole="button"`, `accessibilityLabel="More options"`, `accessibilityHint="Open the full composer to change type, side, tags, or add a source."`
  - **Send** — ≥44px; `accessibilityRole="button"`, `accessibilityState={{ disabled: !canSend, busy: isSubmitting }}`.
- **a11y floor** (`accessibility-targets`):
  - Every pressable ≥ 44×44 (visual or `hitSlop`); mic is 56 but disabled.
  - Color never the only signal — disabled mic reads via text + `disabled` state; blocked-state reason is text, not color.
  - Reduce-motion: no send animation when `reduceMotionOverride`; snap only.
  - `TextInput` has `accessibilityLabel="Your reply"`; blocked reason renders with `accessibilityLiveRegion="polite"`.
  - Keyboard: bar controls in reading order (chip → input → proof → mic(disabled) → more → send). On web, Enter/Cmd-Enter behavior is deferred to the shipped `composerKeyboardModel` inside More; the bar's own Send is a button (no new global key listener — avoids the dock's focus-context machinery, which stays pinned).
  - **Band:** renders at 390 / 768 / 1440; docks above keyboard (`KeyboardAvoidingView`).

**No collision with ROOM-001's rail:** `ArgumentStateRail` sits in the room's **topBanner** slot (`ArgumentRoom.tsx:2447`); the bar is an **App-level bottom** bar. Top vs bottom — geometry disjoint.

---

## Copy plan

- All new bar strings live in a frozen const `ARGUMENT_ENTRY_COMPOSER_COPY` (in `argumentEntryComposerModel.ts`, exported for scanning) — additive block; internal codes mapped through `gameCopy.toPlainLanguage`/`toPlainLanguageOrSuppress` for any engine reason surfaced in the blocked state.
- **Ban-list safe:** no verdict/amplification tokens (winner/loser/true/false/liar/etc.). A **new** test `argumentEntryComposerCopyBanList.test.ts` source-scans the const with the shipped `_forbiddenBoxTokens` helper (mirrors `oneBoxCopyBanList.test.ts`). Existing ban-list scans are extended to the bar strings.
- Copy set (draft): context chip "Answering: …" / "New point"; input placeholder "Write your reply…"; Proof "Proof"; mic "Voice — coming soon"; More "More"; Send "Send"; blocked reasons via `gameCopy`; observer prompt "Join to reply".
- **Apostrophe-free comments** in the three new source files (doctrine-scanner gotcha). Copy *strings* may contain apostrophes; comments must not.

---

## Edge cases

- **Empty body** — Send disabled; engine `allowPost` false (empty-body is the only length hard-block; `evaluateArgumentDraft.ts:199`).
- **Body over 2000 chars** — engine blocks; bar shows over-length reason inline.
- **Inferred type not allowed by the matrix** — clamped to the first allowed type before evaluation; never posted invalid (`getAllowedReplies`).
- **Root context (no parent)** — default `claim`; context chip "New point"; chip not clearable. (Rare — starting new arguments is the Start flow's job.)
- **Reply target changes while typing** — `useArgumentComposer` keeps the body; defaults re-applied only to still-null fields; `shouldCreateNewClientSubmissionId` (`composerHelpers.ts:88`) governs the id, unchanged.
- **Evidence type with no source** — hard block preserved and surfaced; no fast-path bypass (HARD AC).
- **Observer / no seat** — read-only bar → "Join to reply"; no post path.
- **Concurrent edit bar ↔ More** — both operate on the single session `activeDraft`; last write wins; draft survives blur/close/reopen via `composerDraftRegistry` (recovery-notice behavior unchanged).
- **Offline / submit failure** — `SUBMISSION_FAILED` → retry reuses the same `clientSubmissionId` (idempotent); server 422 blocking errors render inline.
- **Doctrine edge:** heat/popularity never touch the bar; the bar surfaces no score and no truth label; the mic slot's disabled copy is honest (not "won't work" — "coming soon").

---

## Test plan

Baseline (pre-card): **918 suites / 33,138 tests** (per the card brief). Expected delta **+7 to +9 suites, ~+80 to +110 tests**. All new tests live under `__tests__/`.

- **Byte-shape contract (the pin) — `__tests__/roomThreeByteShapeContract.test.tsx`:**
  - Model-level: build `ComposerDraft` fixtures (with/without evidence; with/without target; every argument type) → `buildSubmitArgumentPayload(draft, 'fixed-id')` → **key-set snapshot** so any added/removed/renamed key fails loudly.
  - Dual-render (START-001 house shape, `startArgumentSheetCreationContract.test.tsx` precedent): render the **legacy** `ArgumentComposer` (pick type/side manually) and the **new** `ArgumentEntryComposer` (defaults set to the same type/side via context) for equivalent input; mock `submitArgumentDraft`; capture both payloads; `expect(barPayload).toEqual(legacyPayload)` for each fixture.
- **Bar model matrix — `__tests__/argumentEntryComposerModel.test.ts`:** `deriveEntryComposerDefaults` across parent types (opponent counter, own continuation, root); every returned type is a member of `getAllowedArgumentTypesForParent`; disallowed preference clamps to first allowed. `sideForParticipantSeat` full mapping. `deriveEntryComposerBarLayout` (canSend gating on body + `allowPost`). `deriveFastPathCivilitySignal` (fires on `AD_HOMINEM`/incivility `review` advisory; empty otherwise). `deriveEntryComposerTarget` chip label + clearable.
- **Submit hook — `__tests__/useEntryComposerSubmit.test.tsx`:** happy path (dispatch order + `buildSubmitArgumentPayload` argument), failure path (server 422 → `serverErrors`), idempotent retry (reused `clientSubmissionId`).
- **RNTL bar — `__tests__/argumentEntryComposerUi.test.tsx`:** J2 in-room reply in **≤2 taps** (open at active node → type → Send) with **zero type/side taps**; blocked-state copy renders for the evidence hard-block; mic slot disabled with honest label; More opens the dock; context-chip ✕ un-scopes.
- **Evidence hard-block — `__tests__/roomThreeEvidenceHardBlock.test.ts`:** evidence-typed draft, no source → `allowPost` false → Send disabled + reason; no bypass.
- **Flag-off parity — `__tests__/roomThreeFlagOff.test.tsx`:** with `room_exchange_v2` OFF, the room renders the `CollapsedComposerStrip` and no `argument-entry-composer`; the dock path is unchanged.
- **Absorbed #830 — `__tests__/roomThreeMorePanel.test.tsx`:** submit works with More never opened; every modifier reachable only via More; nothing modifier-related on the bar by default.
- **Absorbed #832 — `__tests__/roomThreePhoneBand.test.tsx` (+ Claude_Preview 390px):** bar + More render at 390/768/1440; all pressables ≥44 (`TOUCH_TARGET`); More popout is sheet <720 / panel ≥720 via `resolveDockLayoutVariant`.
- **Copy ban-list — `__tests__/argumentEntryComposerCopyBanList.test.ts`:** `_forbiddenBoxTokens` over `ARGUMENT_ENTRY_COMPOSER_COPY`; zero matches.
- **Source scans — `__tests__/roomThreeSourceScan.test.ts`:** no audio-API import (`expo-av`/`expo-speech-recognition`/`MediaRecorder`/`getUserMedia`) in the bar diff; no `console.log`; no dynamic `process.env[` in the new files; new source files' comments apostrophe-free.
- **Pin verification:** run the full suite green + the doctrine scans; reviewer additionally confirms `git diff main -- <uxOneOneFive path list>` is empty.

---

## Dependencies (cards / docs / files)

- **Blocked by (all shipped):** ASP-EXTRACT-001 (#864 → #869/#870, `room/` extraction), ROOM-002 (ExchangeView, PR 06), ASP-FLAGS-001 (#873, the `room_exchange_v2` registry), ROOM-001 (#880, threads `roomExchangeV2Enabled` into the room + owns the state rail this card co-activates with).
- **Reads existing:** `buildSubmitArgumentPayload` (`composerSubmit.ts:72`), `useArgumentComposer`, `buildEvaluationInput` + `evaluateArgumentDraft`, `getAllowedArgumentTypesForParent` (`composerHelpers.ts:155`), `resolveDockLayoutVariant` (`ArgumentComposerDock.tsx:102`), the App-level `handleComposerExpand`/`handleSubmitSuccess`/`replyTarget`/`participantSide`/`timelineActiveMessageId`.
- **Blocks / re-scopes onto it:** #831 (quote/callback injection), PROOF-002 (fills the Proof slot), VOICE-UI-001 (fills the mic slot), text-marker cards (tsx-1/2) — all build on the bar.
- **Closes at merge:** #829 (this rewrite); #830 + #832 close as **absorbed** (comment + close per board hygiene; `Closes` keyword only on PR 07).

---

## Risks

- **Payload drift is THE risk.** Mitigation: byte-shape is *by construction* (same `buildSubmitArgumentPayload` on a draft from the same `useArgumentComposer`), and the dual-render + key-set contract test is the loud guard. The submit orchestration is duplicated (a new hook) rather than extracted from the pinned `ArgumentComposer` — the duplication is *session dispatch*, not the wire payload, so it cannot drift the byte-shape; the reviewer should still diff the two submit sequences line-for-line.
- **PreSendReviewSheet bypass (Q10).** Removing the sheet from the fast path could let more civility-advisory content through. Mitigation: `deriveFastPathCivilitySignal` + `onFastPathCivilitySignal` instrument the before/after rate (advisory-only, no block, no network). The sheet remains for the More path.
- **Dock geometry with the rail.** The rail is topBanner, the bar is App-bottom — disjoint. But on phone, the bar height eats vertical room space; verify at 390px that the ExchangeView still scrolls and the bar + keyboard do not occlude the last message (Claude_Preview harness).
- **Pin fragility.** The zero-diff `uxOneOneFive` pin is unforgiving. The design avoids all listed files; the reviewer's `git diff main -- <list>` check is the backstop. If any implementer edit strays into a pinned file, halt and escalate — do not relax `uxOneOneFive` inline.
- **Existing tests that might need updating:** none should. If mounting the bar changes an App.tsx render snapshot, prefer adjusting the test to assert the flag-off default (the bar is not mounted OFF); do not change a pinned assertion.
- **Observer read-only path** is a real branch — ensure the bar never offers a post to a seatless viewer (mirrors seat doctrine).

---

## Out of scope

Audio/voice code of any kind; the Proof drawer (PROOF-002); the marker/quote `RebuttalComposer` and quote/callback injection (#831); any Edge/migration/RLS/payload change; the engine; removal of the dock/OneBox/ArgumentComposer; gallery/home surfaces; the ExchangeView/MapView/state-rail internals (ROOM-001/ROOM-002 own those).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the bar surfaces no score, no strength band, no verdict. Only the deterministic engine's *validation* blocks (empty/over-length/invalid-transition/evidence-no-source); score never gates. ✔
- **§4 / §7 (AI limits; no AI in the app):** zero AI calls anywhere in the card; the Q10 signal is a local counter, not an inference. ✔
- **§5 (engine sacred):** `evaluateArgumentDraft` + the transition matrix are unchanged and remain the sole client gate; the bar selects only from engine-allowed types and never widens them. ✔
- **§6 (secrets):** no keys, no service-role; posts go through the existing `submit-argument` Edge path only. ✔
- **§8 (Supabase conventions):** no migration, no RLS change, no direct insert. ✔
- **§9 (plain language):** every surfaced engine reason is mapped via `gameCopy`; no internal code leaks; ban-list test guards the new copy. ✔
- **§10 v1 scope:** no voting/search/push/OAuth/public-API. ✔
- **Byte-shape AC:** the server sees an unchanged payload (contract test) — the strongest proof the deterministic pipeline is untouched. ✔
- **accessibility-targets:** 44px floor (mic 56, disabled-honest), color-independent, reduce-motion parity, roles/labels/state on every control, 390px band. ✔
- **expo-rn-patterns:** RN primitives only (`View`/`Text`/`TextInput`/`Pressable`/`KeyboardAvoidingView`); pure model beside the view; no new dependency; no `expo-av`/`expo-speech-recognition`. ✔

---

## Operator steps (if any)

**None for code merge — pure client change, flag default OFF.** To exercise the surface after merge, set the public runtime flag `EXPO_PUBLIC_ROOM_EXCHANGE_V2=true` (turns on the ROOM-001 state rail **and** the ROOM-003 bar together). No `supabase db push`, no `functions deploy`, no secret. Rollback = flag off + straight revert.
