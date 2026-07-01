# UX-FLAGS-002 — Point-level friendly feedback-flag UI

- **Status:** Implemented (this branch)
- **Epic:** PRODUCT-REDIRECT-001 (#826)
- **Release:** UX / model only — no provider, no deploy
- **Issue:** #834
- **Baseline:** main @ c22867a
- **Depends on (merged):** UX-FLAGS-001 / #850 — friendly-flag DESCRIPTOR layer
  (`src/features/feedbackFlags/friendlyFlagMap.ts`)
- **Blocks:** #835 (cap / priority policy), #836

## Goal

Surface MCP-derived friendly feedback flags on a POINT in a calm, optional,
low-noise way. This is a human-readable point-level hint layer — NOT a
classifier dashboard, NOT scoring, NOT moderation. A selected/active point may
show a small row of friendly flags; the default room stays visually calm
(the row renders nothing when a point has no positive observations).

## Relation to #833 / #850 / #835

- **#850 (dependency, merged)** owns the translation: `(family, rawKey)` →
  at most one `FriendlyFlag` descriptor, or `null`. It applies J-exclusion,
  unknown/unmapped/`*_false`/`no_*` drop, de-dupe by key, INPUT ORDER, and NO
  cap/rank. This card delegates ALL of that through `friendlyFlagsFor` and
  re-authors nothing.
- **#835 (blocked by this card) owns the cap / priority / 1–3 ranking policy.**
  This card deliberately implements NO cap, NO ranking, NO truncation. The only
  ordering is `friendlyFlagsFor`'s input order (stable). A seam comment
  (`#835 owns the cap/priority`) marks the insertion point in the adapter.
- **#833** is the parent product-redirect thread; this is the render slice.

## Data model

No new persisted model. Real per-node input is
`MachineObservationResultRow` (`src/features/nodeLabels/machineObservationPersistenceTypes.ts`):
`{ id, runId, debateId, argumentId, schemaVersion, rawKey, family, confidence,
evidenceSpan, createdAt }`. One row = one POSITIVE observation (absence = the
negative). Rows arrive per-argument as
`persistedObservationsByArgumentId: Record<string, MachineObservationResultRow[]>`
(loaded `useArgumentRoomMessages.ts:63` → `ArgumentTreeScreen.tsx` →
`ArgumentGameSurface.tsx`). **The adapter reads ONLY `{ family, rawKey }`.**

New render view model (`pointFeedbackFlagsModel.ts`):

```ts
interface PointFeedbackFlagViewModel {
  id: string;                 // = FriendlyFlagKey (snake_case). Render key ONLY, never visible.
  label: string;              // plain-language, rendered
  helper?: string;            // optional "why?" line, rendered only when the row expands
  tone: 'positive' | 'prompt' | 'descriptive'; // glyph prefix + token style, never color-only
  neverGrantsStanding: boolean; // Family D passthrough — component renders zero standing words when true
  accessibilityLabel: string; // tone-word + label (+ ", receipt or source help" for D)
  family: MachineObservationFamily; // internal (tests + future #835 grouping), NEVER rendered
}
```

`confidence`, `evidenceSpan`, `createdAt`, `composerIntent`, and `actionable`
are deliberately NOT carried — no composer wiring and no confidence render in
this card.

## File changes

- **New** `src/features/feedbackFlags/pointFeedbackFlagsModel.ts` — pure adapter.
- **New** `src/features/feedbackFlags/PointFeedbackFlagPill.tsx` — calm read-only pill.
- **New** `src/features/feedbackFlags/PointFeedbackFlagsRow.tsx` — row + optional "why?" disclosure.
- **Edit** `src/features/feedbackFlags/index.ts` — append 3 export lines.
- **Edit** `src/features/arguments/ArgumentGameSurface.tsx` — one sibling memo
  (`activePointFeedbackFlags`) + one `<PointFeedbackFlagsRow>` mount in the
  active-node detail region. Net ~25 lines; no deletes; no existing test touched.
- **New** tests: `__tests__/pointFeedbackFlagsModel.test.ts` (12),
  `__tests__/PointFeedbackFlagsRow.test.tsx` (7).

## Integration target decision + rejected alternatives

**Chosen:** `src/features/arguments/ArgumentGameSurface.tsx`, active-node detail
region (col2, Timeline mode), immediately below `TimelineSelectedReadoutPanel`,
in the same memo neighborhood as the existing `activeMappingSection`
(Combination observations). The sibling memo `activePointFeedbackFlags` reads
`persistedObservationsByArgumentId?.[activeMessageId] ?? []` +
`activeViewModel?.actor === 'self'` (isOwnPoint) and calls the adapter; the mount
is `<PointFeedbackFlagsRow flags={...} />`.

Chosen because (a) `persistedObservationsByArgumentId` (the `MachineObservationResultRow`
rows) is ALREADY threaded and already consumed for the active node here, (b) the
own-point signal (`activeViewModel.actor`) is resident, (c) an active-node detail
slot already lives here (readout / progress note / score tracker) so no new
plumbing is required. The design's named anchor was the "Combination
observations" render; that render actually lives inside `ArgumentBubbleStack`
(Stack mode only), so mounting there would require threading a new prop through
the Stack. The col2 detail region is the Timeline-mode active-node detail slot,
sits directly in `ArgumentGameSurface` with the data already resident, and yields
a smaller, lower-risk diff while honoring the same "active-node detail region,
data resident, no new plumbing" intent.

**Rejected:**
- **`ArgumentReplySidecar` "Semantic flags"** — it consumes the metadata LEDGER
  via `buildSharedSectionSemanticFlags`, NOT `(family, rawKey)` MCP rows. A shared
  model with its own tests; out-of-proportion risk; entangles #835.
- **`CardDetailPanel` HubClassifierZone** — the uncapped dense grid whose calm
  replacement needs #835's cap first.
- **Every default-stack card** — overload before VISUAL-SIMPLIFY (#844).

## API / interface contracts

Adapter:
```ts
buildPointFeedbackFlags(
  observations: ReadonlyArray<{ family; rawKey }> | null | undefined,
  viewer: { isOwnPoint: boolean },
): ReadonlyArray<PointFeedbackFlagViewModel>   // frozen array of frozen VMs
```

Components:
```ts
<PointFeedbackFlagPill flag={vm} testID? />
<PointFeedbackFlagsRow flags={vm[]} heading? testID? />   // null for empty flags
```

## Adapter behavior rules

1. Non-array/null/undefined input → frozen `[]`.
2. Map ONLY via `friendlyFlagsFor(observations)` — the sole routing source;
   never touch `RAWKEY_ROUTING`, never re-author labels.
3. `friendlyFlagsFor` already drops null, de-dupes by key, preserves INPUT
   ORDER, applies NO cap/rank — adapter preserves that 1:1.
4. `flag.clientSuppressed === true` → filtered out.
5. Own-bubble: when `viewer.isOwnPoint`, drop flags where `!isOwnBubbleEligible(flag)`
   (the #850 helper — never re-derived). `actor 'unknown'` at the callsite →
   `isOwnPoint false` (no over-suppression).
6. Build one VM per surviving flag; `neverGrantsStanding` is passed through as a
   boolean and NEVER converted into score/credit/standing text.
7. Deterministic stable order = `friendlyFlagsFor` order; NO rank, NO cap
   (`// #835 owns the cap/priority` seam).
8. `family`/`rawKey`/`key`/`confidence`/`composerIntent` never appear in
   `label`/`helper`/`accessibilityLabel`.
9. Output + each VM frozen; pure TS, no React/Supabase/network/side-effects,
   JSON-serializable.

## Tone → style mapping (existing tokens only)

Tone is carried by SHAPE + TEXT prefix AND muted color — never color alone. No
alarm red/yellow. The three distinct glyphs make a grayscale snapshot legible.

| Tone | Glyph | Fill | Foreground |
|---|---|---|---|
| positive | `+` | `STATUS.success.bg` (#14532d) | `STATUS.success.fg` (#bbf7d0) |
| prompt | `?` | `SURFACE_TOKENS.elevated` (#0b1220) + `inputBorder` hairline | `SURFACE_TOKENS.textPrimary` (NOT warning-yellow) |
| descriptive | `·` | `STATUS.neutral.bg` (#1f2937) | `STATUS.neutral.fg` (#cbd5e1) |

Pill: `RADIUS.pill` (999), padding `SPACING.s/xs`, row gap `SPACING_PRESETS.chipGap`,
font `TYPOGRAPHY.chipLabel`. Family D (`neverGrantsStanding`) pills keep their
descriptor tone and add NO strength/credit/score glyph or color — the
"receipt/source help" framing lives ONLY in the a11y label + the #850-authored
helper. All tokens from `src/lib/designTokens.ts`; no new token.

## Accessibility contract

- Pills are NON-interactive → `accessibilityRole="text"` + `accessibilityLabel`
  (tone-word + label + receipt-help suffix for D), so tone is spoken, not
  color-only. No 44px requirement triggered.
- The ONLY interactive element is the row's optional "why?" disclosure toggle:
  `Pressable`, `accessibilityRole="button"`, label "Show why"/"Hide why",
  `accessibilityState={{ expanded }}`, `hitSlop = TOUCH_TARGET.hitSlopAll`
  (clears 44×44), visible focus ring via `FOCUS_RING` on web. It only reveals
  helper text — no submit / mutate / callback.
- All text in `<Text>`. Reduce-motion satisfied by construction (snap show/hide,
  no animation). Contrast: the three tone pairs are existing WCAG-checked tokens;
  the prompt hairline is decorative. Focus order follows the active-node detail
  reading order; no tabIndex jumping.

## Observation input shape

`MachineObservationResultRow` (real, not invented). Families are NAMES not
letters: `parent_relation` / `disagreement_axis` / `misunderstanding_repair` /
`evidence_source_chain` / `argument_scheme` / `critical_question` /
`resolution_progress` / `claim_clarity` / `thread_topology` /
`sensitive_composer` (J). The adapter reads ONLY `{ family, rawKey }`.

## Edge cases

- **Empty** → row renders null (calm default).
- **All suppressed** (own-bubble, clientSuppressed) → row renders null.
- **Unknown family / rawKey / `*_false` / `no_*`** → dropped by #850 → `[]`.
- **Family J** → excluded by #850 → never rendered.
- **Duplicate keys** → de-duped by #850 → one VM.
- **clientSuppressed** → filtered by the adapter.
- **Unknown actor** → `isOwnPoint false` → no over-suppression.
- **Late-arriving rows** → memo recomputes on `persistedObservationsByArgumentId`.
- **Private room** → no new data path; reads only already-resident rows.
- **Family D language** → `neverGrantsStanding` never becomes score/credit copy.

## Test plan

- `__tests__/pointFeedbackFlagsModel.test.ts` — A-family friendly label; D
  passthrough + no standing/credit/score words; J excluded; unknown/`*_false`/`no_*`
  dropped; clientSuppressed hidden (stubbed descriptor); own-bubble drops
  challenge-adjacent keeps positive; de-dupe; stable order not sliced to 3;
  no raw snake_case in rendered fields; #850 ban-list; non-array → frozen `[]`;
  frozen output + VMs.
- `__tests__/PointFeedbackFlagsRow.test.tsx` — one pill per flag with label;
  null for empty; a11y label on each pill; "why?" toggle hidden by default,
  press reveals + `expanded` flips + 44×44 hitSlop + role button; no toggle when
  no helper; three tones render three distinct glyph prefixes.

## Dependencies

- Consumes #850 (`friendlyFlagsFor` / `isOwnBubbleEligible` / `_forbiddenVerdictTokens`).
- Blocks #835 (cap/priority) and #836.

## Risks

- **Data-source confusion** — mitigated by reading ONLY `(family, rawKey)` rows
  and delegating routing to #850; rejected the sidecar ledger source explicitly.
- **Cap temptation** — explicitly out of scope; seam comment marks #835's slot.
- **Overload creep** — the row is calm-by-default (null on empty) and mounts in
  a single active-node detail slot only.
- **Family D language drift** — asserted by test that D rendered fields contain
  no standing/credit/score words.

## Out of scope

No #835 priority/cap policy; no composer intents / feedback actions wiring; no
Evidence Echoes; no Lore Codex/Reels; no composer redesign; no provider calls;
no server / Edge / migration / config / validator / ban-list / familyRegistry /
prompt change; no new dependencies.

## Doctrine self-check

- **§1** — advisory only; no verdict/truth tokens; ban-list test over rendered
  fields (#850 `_forbiddenVerdictTokens`).
- **§3** — Family D `neverGrantsStanding` passed as metadata only; test asserts
  no standing/credit/score language.
- **§9** — internal family/rawKey/snake_case never in rendered fields; regex test.
- **§10a** — Family J never renders (excluded by #850, not resurrected).
- **Accessibility** — role/label/state on the toggle; 44×44 hitSlop; color never
  the only signal (three glyphs); reduce-motion safe.
- **test-discipline** — 2 test files, 19 tests; typecheck + lint clean.

## Rollout note

Pure client render slice. The row appears on the active node only when that node
already has positive persisted observations; otherwise the room is unchanged.

## Operator steps

None. Pure code change. NO Anthropic / xAI / X / Supabase-write / service-role
by Claude.
