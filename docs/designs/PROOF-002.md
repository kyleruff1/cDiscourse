# PROOF-002 — Source drawer + button + chips (evidence to the edge)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — Evidence UI lane (M-ASP-3, Phase P3)
**Release:** M-ASP-3
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/889
**Flag:** `proof_drawer` (shipped in `src/lib/featureFlags.ts`, default OFF)
**Migration-bearing:** no — PROOF-001 shipped the tables; PROOF-003 owns the write Edge. This card is UI + one read-path adapter flip, all behind the flag.

---

## Goal (one paragraph)

Design Pass principle 6 — "Proof lives at the edge of the flow, not blocking the center." Today evidence fields live inside the composer form (`ArgumentComposer` evidence rows); attaching a receipt mid-exchange means scrolling a form. This card moves attach to the edge: the one-bar composer's existing **Source** slot stops routing to the full composer ("More") and instead opens a **source drawer** — a bottom sheet (<720px) / right panel (720px+) with a grid of the exact kinds PROOF-001 shipped, one focused input each. The same **ReceiptChip** contract renders the attached sources on the move (Ringside card, Map sidecar, and inside the drawer). One read-path adapter seam flips from JSONB-only to **rows-first with a JSONB fallback**, so back-filled + legacy artifacts render byte-identically. The whole surface is behind `proof_drawer` (default OFF); with the flag off, the Source slot keeps routing to More and nothing else changes. The design is shaped by three doctrine constraints: **the COPY LAW** (`cdiscourse-doctrine` §1, §9 + the ROOM-003 precedent — every user-facing string says *Source / Receipts*; `proof` is a forbidden box-copy token, component/file names are internal and exempt); **evidence is never proof-of-truth** (`evidence-doctrine` — a source carries a source-chain *status*, never a verdict; attach never earns factual standing by itself, and the owed state is an obligation marker, never "this is false"); and **score never blocks posting** (`cdiscourse-doctrine` §1 — attaching or not attaching a source never gates a reply; the only surviving hard block is the pre-existing evidence-type-without-source rule, preserved byte-identically).

---

## Problem & scope

**In scope (issue #889 Scope):**
- **ProofButton** — the ROOM-003 one-bar composer's **Source** slot stops routing to More and opens the drawer when the flag is ON; gold-owed treatment when a source is owed on the scoped move.
- **ProofDrawer** — bottom sheet under 720px / right drawer at 720px+ (mirrors the dock breakpoint `resolveDockLayoutVariant` / `DOCK_SIDE_BREAKPOINT = 720`); kind grid scoped to the **6 kinds PROOF-001 actually shipped**; one focused input per kind.
- **ProofChip** — renders via the existing **ReceiptChip** copy contract verbatim; the same chip appears in Ringside cards, the Map sidecar, and the drawer.
- **Read-path flip WITH FALLBACK** — the evidence adapter (`buildArtifactsByMessageId`) reads `proof_items` rows first, JSONB snapshot as fallback; back-filled + legacy artifacts render identically (contract-snapshot test).
- **Debt wiring (J7)** — attaching against an owed debt flips it via the existing render-time `evidenceDebtModel` path + the Edge-owned `evidence_supplied` notification.

**Out of scope / non-goals (issue #889 Non-goals):**
- No migration (PROOF-001 owns it).
- The write goes through the **PROOF-003 `attach-proof` Edge Function** — this card never inserts a `proof_items`/`proof_relations` row directly and never uses the service role.
- No storage-kind UI (`screenshot`/`file` — deferred to SEC-PROOF-001; PROOF-001 did not ship those kinds).
- No markers (`voice_excerpt`/`timestamp` — MARK-001).
- No admin source-chain status UI (`broken`/`primary_present` remain unsettable from the client).
- **No edits to any pinned composer/dock/oneBox file** — wrap, never edit (the ROOM-003 pattern). See Pin inventory.

---

## Interface contract with PROOF-003 (numbered ASSUMPTIONS)

PROOF-003 (`attach-proof` Edge Function) is being designed **concurrently in this same worktree** and **owns the Edge contract**. This card must not depend on PROOF-003's internal shape. The drawer talks to a **single narrow client-wrapper seam** — a new module `src/features/proof/attachProofApi.ts` exporting one function — so that whatever PROOF-003 finalises, only that one file changes. The wrapper's *type* surface (below) is what the drawer imports. **The implementer reconciles these numbered assumptions against the shipped `docs/designs/PROOF-003.md` before writing the wrapper body; if an assumption is wrong, only `attachProofApi.ts` changes, never the drawer.**

The narrow seam (drawer-facing, PROOF-003-agnostic):

```ts
// src/features/proof/attachProofApi.ts — the ONLY file that knows PROOF-003's wire shape.
export interface AttachProofInput {
  debateId: string;
  argumentId: string;               // the move the source attaches to (author's own move-or-draft)
  kind: ProofDrawerKind;            // one of the 6 shipped PROOF-001 kinds (see Data model)
  label: string;                    // <= 120 chars, plain language
  url?: string;                     // kind='url' | 'external_ref'
  sourceText?: string;              // kind='source_text'
  quote?: string;                   // kind='quote'
  referencedArgumentId?: string;    // kind='prior_move'
  answersDebtKind?: EvidenceDebtKind | null; // when attaching against an owed debt (J7)
  clientAttachId: string;           // idempotency carrier (UUID), mirrors client_submission_id
}
export interface AttachProofResult {
  ok: boolean;
  proofItem?: ProofItemRow;         // the created row, echoed back so the drawer renders optimistically
  errorCode?: AttachProofErrorCode; // mapped to plain language by the drawer
  errorMessage?: string;
}
export async function attachProof(input: AttachProofInput): Promise<AttachProofResult>;
```

**Numbered assumptions (reconcile before coding):**

1. **Function name + transport.** PROOF-003 is a JWT-verified Supabase Edge Function named `attach-proof`, invoked through the existing `src/lib/edgeFunctions.ts` invoke helper (the `request-argument-deletion` precedent — anon key + caller JWT, never service role in the client).
2. **Request shape.** The Edge accepts a JSON body carrying `debate_id`, `argument_id`, `kind`, `label`, and the kind-specific field (`url` | `source_text` | `quote` | `referenced_argument_id`), plus an optional relation intent. The wrapper maps `AttachProofInput` → this body. If PROOF-003 names fields differently, only the wrapper's mapping changes.
3. **Response shape.** On success the Edge returns the created `proof_items` row (so the drawer can render the ProofChip optimistically without a full re-fetch). On failure it returns a structured `{ error: { code, message } }`. The wrapper normalises both into `AttachProofResult`.
4. **Error codes.** The wrapper maps at least: `unauthorized`, `not_participant`, `not_author` (attach only to your own move), `invalid_kind`, `invalid_input`, `debate_mismatch`, `rate_limited`. Every code is rendered to the user through a local plain-language map (never the raw code — `gameCopy` discipline). Unknown codes fall back to a generic "Couldn't attach that source — try again."
5. **Caps.** `label` ≤ 120 chars (matches EV-001 `deriveLabel` truncation); `kind` restricted to the **6 shipped kinds**; the client-derivable `source_chain_status` set only (`unverified` | `source_no_quote` | `source_and_quote` — the Edge derives/enforces per PROOF-001's INSERT WITH CHECK). The drawer never sends `broken`/`primary_present`.
6. **Idempotency.** The wrapper generates a `clientAttachId` (UUID) per attach attempt and threads it so a retry after a dropped response does not double-insert (the `submit-argument` `client_submission_id` idiom). If PROOF-003 does not yet honour it, the drawer still degrades safely (a duplicate `proof_relations` row is blocked by PROOF-001's `UNIQUE(proof_item_id, claim_argument_id, relation)`; a duplicate `proof_items` row is a benign extra artifact the read path de-dupes by id — flagged as a risk).
7. **Debt flip is server-owned in persistence, client-observed in render.** When `answersDebtKind` is set, PROOF-003 records the `answers_request` relation and emits the existing `evidence_supplied` notification. The **UI** debt flip does NOT wait on a server field — `evidenceDebtModel.deriveEvidenceDebts` recomputes `requested → supplied` render-time the moment the new artifact appears in `artifactsByMessageId` (see J7 wiring). So the drawer only needs the created row back (assumption 3) to re-derive locally.
8. **`evidence_supplied` notification is Edge-owned.** The client never writes it. J7's "notification" acceptance criterion is satisfied by PROOF-003, not by this card. This card's test asserts the wrapper *requests* the answers-debt relation; the notification itself is PROOF-003's test.
9. **Read-back.** After a successful attach the drawer (a) optimistically inserts the returned `proofItem` into the in-memory `proofItemsByMessageId` map and (b) triggers the room's proof-items re-fetch hook (see File changes) so the durable state converges. If assumption 3's echo is absent, the drawer falls back to (b) alone.
10. **Detach.** Detaching an own source (soft-delete) is routed through the same Edge (a `detach`/soft-delete intent) or a sibling function. This card's drawer exposes a detach affordance on own attached sources but treats detach as **optional** for J7; if PROOF-003 does not ship detach in the same bundle, the drawer hides the detach control (a capability probe on the wrapper), never a broken button.

---

## Pin inventory (required)

Enumerated by reading `__tests__/uxOneOneFiveReadOnlyBoundary.test.ts` (the frozen `READ_ONLY_PATHS` + submit-path guard), `__tests__/roomThreeFlagOff.test.tsx`, `__tests__/roomThreeSourceScan.test.ts`, `__tests__/roomThreeByteShapeContract.test.tsx`, and the ROOM-002/004 status note. Verdict per file this card touches or mounts against:

| File | Pinned? | By | This card |
|---|---|---|---|
| `src/features/arguments/ArgumentComposer.tsx` | **PINNED zero-diff** | `uxOneOneFiveReadOnlyBoundary` | do not touch (evidence form stays; not removed) |
| `src/features/arguments/ArgumentComposerDock.tsx` | **PINNED zero-diff** | `uxOneOneFiveReadOnlyBoundary` | do not touch; stays the More host |
| `src/features/arguments/composer/ComposerContextStrip.tsx`, `CollapsedComposerStrip.tsx`, `composerDraftRegistry.ts`, `composerKeyboardModel.ts`, `useComposerFocusContext.ts`, `composerActingOnModel.ts`, `composerHaptics.ts` | **PINNED zero-diff** | `uxOneOneFiveReadOnlyBoundary` | do not touch |
| `src/features/arguments/oneBox/OneBox.tsx`, `ActPopout.tsx`, `GoPopout.tsx`, `Popout.tsx` | **PINNED zero-diff** | `uxOneOneFiveReadOnlyBoundary` | do not touch |
| `src/features/arguments/ArgumentTimelineMap.tsx` | **PINNED zero-diff** | `uxOneOneFiveReadOnlyBoundary` + `argumentTimelineMap.test.ts` | do not touch — it already renders the Map's evidence surface (`TimelineNodePopover` ReceiptChip via `evidenceDebtSummaryFor` + `artifactsByMessageId`); it reflects the read-path flip automatically |
| `src/features/arguments/room/MapView.tsx` | **PINNED API** (`requiredApi:['MapView','MapViewProps']`) | `uxOneOneSixReadOnlyBoundary` + reviewer git-diff | do not touch — it forwards `artifactsByMessageId`/`evidenceDebtSummaryFor` straight through, so the flip flows without an edit |
| `supabase/functions/submit-argument/` | **PINNED** (dispatch-tail-only diffs) | `uxOneOneFiveReadOnlyBoundary` | do not touch — evidence-type hard block preserved byte-identically |
| **`src/features/arguments/composer/ArgumentEntryComposer.tsx`** | **FREE** (ROOM-003, unpinned) | pins are source-scans (`roomThreeSourceScan`) + byte-shape (`roomThreeByteShapeContract`), NOT zero-diff | **edit** — add optional `onOpenProof` prop; Source slot `onPress={onOpenProof ?? onOpenMore}` |
| **`src/features/arguments/composer/argumentEntryComposerModel.ts`** | **FREE** (ROOM-003, unpinned) | same | **edit** — add the drawer-route a11y copy; keep model pure (no `featureFlags` import) |
| **`src/features/arguments/room/ArgumentRoom.tsx`** | **API-pinned, NOT byte-frozen** | `uxOneOneSixReadOnlyBoundary` (`requiredApi:['ArgumentRoom','Props']`, reviewer git-diff) + `roomTwoFlagOff` (specific ROOM-002 wiring lines) | **edit ADDITIVELY** — ROOM-002/004 already edited it additively; add the proof-items hook + rows into `buildArtifactsByMessageId` + a `proofDrawerEnabled` prop on `Props`, PRESERVING the pinned `ArgumentRoom`/`Props` tokens + the `roomTwoFlagOff`-asserted wiring (the ringsideFeed `useMemo` gate, the `<ExchangeView …>` prop pass, `observerActionsFor`). Confirm against the UX-001.6 reviewer boundary. |
| **`src/features/arguments/argumentGameSurfaceEvidence.ts`** | **FREE** (EV-002, unpinned) | unit-tested, not zero-diff | **edit** — the single read-path flip seam |
| **`src/features/arguments/room/RingsideCard.tsx`, `ringsideFeedModel.ts`** | **FREE** (ROOM-002 NEW files; scanned only for no-`featureFlags`, no-transform, ban-list) | not zero-diff | **edit (optional refinement)** — gated swap of the plain proof pill → ProofChip via a new `receiptChip?` view-model field + `receiptChipFor` injection |
| `src/features/arguments/room/MapNodeSidecarLinks.tsx`, `MapNodeActionPopover.tsx`, `mapNodeActionSurfaceModel.ts` | **FREE but NOT edited** | ROOM-004 NEW files; `mapNodeActionSurfaceModel` bans the token `proof`/`proven` (`FORBIDDEN_MAP_SURFACE_TOKENS`) | **no edit** — the sidecar renders NO proof chip today; the Map's evidence surface is the pinned `ArgumentTimelineMap` popover, which reflects the flip automatically |
| **`App.tsx`** | **FREE** (the sole flag consumer) | pins are targeted `toContain` string assertions, not zero-diff | **edit** — import `isProofDrawerEnabled`, thread the flag + mount `<ProofDrawer>` |

**Hard constraints the pins impose on this card:**
- The three ROOM-003 files (`ArgumentEntryComposer.tsx`, `argumentEntryComposerModel.ts`, `useEntryComposerSubmit.ts`) MUST NOT import `featureFlags` (`roomThreeFlagOff` asserts it). The flag threads as a prop from App. → the composer receives `onOpenProof?: () => void`, never reads the flag.
- All comments in the three ROOM-003 files + any new file that a source-scan may cover MUST be **apostrophe-free** (`roomThreeSourceScan` + the uxOneOneTwoDoctrine scanner gotcha). Copy *strings* may carry apostrophes.
- No `console.log`, no dynamic `process.env[...]`, no `SERVICE_ROLE`, no `.from('arguments')` in the ROOM-003 files (`roomThreeSourceScan`).
- The `roomThreeByteShapeContract` dual-render test renders `ArgumentEntryComposer` **without** `onOpenProof`; the new prop MUST be optional and its absence MUST be byte-identical to today (routes to More).
- `App.tsx` stays the **sole** `featureFlags` importer for these surfaces (`featureFlagsStaticEnv` discipline; ROOM-001/003 precedent).

---

## Data model

**No new persisted data model** (PROOF-001 shipped `proof_items` + `proof_relations`; PROOF-003 writes them). This card adds only **client-side types** in the new `src/features/proof/` folder, all derived from the shipped PROOF-001 vocabulary + the EV-001 `EvidenceArtifact`.

```ts
// src/features/proof/proofDrawerModel.ts — pure TS, no React/Supabase/network.

/** The 6 kinds PROOF-001 shipped. Storage + marker kinds are NOT here. */
export type ProofDrawerKind =
  | 'url' | 'quote' | 'source_text' | 'note' | 'prior_move' | 'external_ref';

export const PROOF_DRAWER_KINDS: ReadonlyArray<ProofDrawerKind> = Object.freeze([
  'url', 'quote', 'source_text', 'note', 'prior_move', 'external_ref',
]);

/** One kind tile in the grid: glyph + Source/Receipts-law label + which input it focuses. */
export interface ProofKindTile {
  kind: ProofDrawerKind;
  label: string;                // COPY LAW: "Link", "Quote", "Source text", "Note", "Earlier point", "Reference"
  glyph: string;                // simple <Text> glyph (expo-rn-patterns: no icon lib)
  inputMode: 'url' | 'text' | 'longtext' | 'argument_ref';
  helper: string;               // one-line plain-language hint
}

/** What the drawer is attached to. */
export type ProofDrawerScope =
  | { kind: 'draft'; debateId: string; argumentId: string | null } // composer draft (argumentId null until posted)
  | { kind: 'argument'; debateId: string; argumentId: string; owedDebtKind?: EvidenceDebtKind | null };

/** In-progress attach input the drawer builds before calling the wrapper. */
export interface ProofDraftInput {
  kind: ProofDrawerKind;
  label: string;
  url?: string;
  sourceText?: string;
  quote?: string;
  referencedArgumentId?: string;
}

/** Minimal PROOF-001 row shape the read path consumes (subset — only render-relevant columns). */
export interface ProofItemRow {
  id: string;
  debate_id: string;
  argument_id: string;
  added_by: string;
  kind: ProofDrawerKind;
  label: string;
  url: string | null;
  source_text: string | null;
  quote: string | null;
  referenced_argument_id: string | null;
  source_chain_status: SourceChainStatus; // maps 1:1 onto EvidenceArtifact.sourceChainStatus
  risk: EvidenceRisk;
  created_at: string;
  deleted_at: string | null;
}
```

**The inverse fold — `proofItemRowToEvidenceArtifact(row): EvidenceArtifact`.** PROOF-001 shipped `proofItemRowFromArtifact` (`EvidenceArtifact → row`). This card's read path needs the inverse, so a stored row renders through the **unchanged** `summarizeArtifactsForReceiptChip`. The mapping is 1:1 on `sourceChainStatus`, `risk`, `label`, `url`, `sourceText`, `quote`. The `kind` dimension needs an explicit mapping because the 6 `proof_items` kinds are a superset of the `EvidenceArtifactKind` union (which has no `note`/`prior_move`/`external_ref` members):

| `proof_items.kind` | → `EvidenceArtifactKind` | rationale |
|---|---|---|
| `url` | `url` | 1:1 |
| `quote` | `quote` | 1:1 |
| `source_text` | `source_text` | 1:1 |
| `external_ref` | `url` | an external reference IS an inspectable URL |
| `note` | `manual_citation` | a textual note is a manual citation |
| `prior_move` | `manual_citation` | a reference to an earlier move is a citation |

**This mapping is load-bearing for J7 — not just for the chip copy.** Two invariants:
1. **Chip copy (kind-invariant):** the ReceiptChip contract's copy is derived from `sourceChainStatus` + count **only** (confirmed at `evidenceModel.ts:472` — `summarizeArtifactsForReceiptChip` reads status severity + count, never `kind`), so the fold's kind choice cannot change the rendered chip. (Same invariance PROOF-001's write-side fidelity test proved; this card proves it on the read side — Test plan → adapter-flip contract snapshot.)
2. **Debt discharge (kind-sensitive):** `evidenceDebtModel.artifactDischarges(debtKind, artifact)` keys on `(artifact.kind, sourceChainStatus)` — a `source` debt is discharged by an artifact of kind `url`/`source_text`/`dataset`/`manual_citation` with status `source_no_quote`/`source_and_quote`/`primary_present`; a `quote` debt by a `quote`. The table above is chosen so every drawer kind that carries a source discharges the right debt: a drawer `url`/`external_ref`/`source_text`/`note`/`prior_move` attach (status `source_no_quote`+) discharges a `source` debt; a `quote` attach discharges a `quote` debt. **The fold must preserve this — the adapter-flip test asserts discharge parity, not only chip parity.**

---

## Component spec

A11y floor for every new pressable (accessibility-targets + expo-rn-patterns): **≥44×44** tap target (visual or `hitSlop`), `accessibilityRole`/`accessibilityLabel`/`accessibilityState`, color never the only signal, reduce-motion parity, all text inside `<Text>`.

### ProofButton (the Source slot behaviour, in the existing bar — NOT a new file)
- **Not a new component.** It is the existing `argument-entry-composer-proof` Pressable in `ArgumentEntryComposer.tsx`, rerouted. Today: `onPress={onOpenMore}`, label `COPY.proofLabel` ("Source"). Under the flag: `onPress={onOpenProof ?? onOpenMore}`.
- **States:** `idle` (routes to drawer), `owed` (a source is owed on the scoped move — gold treatment).
- **Owed / gold treatment** (`BRAND.accent.gold*`, reusing the ROOM-001 `private_gold` chip token pattern from `ArgumentStateRail`): the exact tokens are `BRAND.accent.goldSoft` (`rgba(198,161,91,0.10)` surface tint), `BRAND.accent.goldBorder` (`rgba(198,161,91,0.35)` hairline), `BRAND.accent.gold` (`#C6A15B` text) — the same triple the ROOM-001 visibility chip uses. NOTE: this *introduces* gold to an owed state — today owed uses tone `'attention'` (state rail) / dashed teal (Ringside card); the Design Pass calls for the ProofButton owed state to be gold, so this is a deliberate, token-consistent extension, not a re-color of the existing owed chips (those stay as they are). **Color-independent:** the owed state is ALSO signalled by text (the a11y label reads "Source owed" and the visible label gains an owed marker) + a paired glyph, exactly as the ROOM-001 `private_gold` chip pairs gold with `PRIVATE_VISIBILITY_GLYPH` — so it reads in monochrome. **Reduce-motion-safe:** a *static* gold ring, never a pulse/animation (matches the ROOM-001 rail where reduce-motion only gates the pressed opacity; the gold tone is always static).
- **Owed source:** the owed signal is the render-time `evidenceDebtModel` obligation for the move the composer is answering (the parent) — but the ProofButton attaches to the **author's own** move/draft, so "owed on the scoped move" applies when the composer is scoped to the author's own posted move that carries a debt (J7). The default draft scope shows the plain (non-owed) button.
- **testID:** unchanged `argument-entry-composer-proof` (keeps the ROOM-003 dual-render test stable); add `argument-entry-composer-proof-owed` only in the owed branch.

### ProofDrawer (`src/features/proof/ProofDrawer.tsx` — NEW)
- **Chrome:** reuse `resolveDockLayoutVariant(windowWidth)` + `DOCK_SIDE_BREAKPOINT (720)` + the narrow-sheet height cap from `ObserverActionDockLayout.ts` — **import the constants, do not re-derive** (the dock breakpoint is the single source of truth). `sheet` (<720px, bottom sheet, capped height, ¾-height on phones) / `side` (≥720px, anchored right panel).
- **States:** `kind-grid` (6 tiles) → `kind-focused` (one input) → `submitting` → `attached` (chip appears, drawer may stay open for a second attach) → `attach-failed` (inline retry, never a modal error).
- **Kind grid:** 6 tiles (`PROOF_DRAWER_KINDS`), each a ≥44×44 Pressable with glyph + text label + helper. **390px behaviour:** a 3×2 (or 2×3) grid that never overflows horizontally — tiles wrap in a flex container; the sheet itself scrolls vertically (`overflow` handled by the sheet), the grid never scrolls horizontally.
- **Focused input:** one `TextInput` per kind (`url` → URL keyboard; `quote`/`source_text` → multiline; `note` → single line; `prior_move` → a picker of the room's prior moves; `external_ref` → URL + label). `accessibilityLabel` on every input. `label` field defaults from the input (EV-001 `deriveLabel` semantics) and is editable, ≤120 chars.
- **Attach:** one primary "Attach source" button → calls `attachProof(...)` via the wrapper → on success renders the ProofChip for the new source in an "attached" list inside the drawer; keeps the drawer open (fast multi-attach) with a "Done" dismiss.
- **Existing sources:** the drawer lists the move's already-attached sources (from `proofItemsByMessageId[argumentId]`) as ProofChips at the top, each with an optional detach affordance on own sources (assumption 10).
- **Reduce-motion:** open/close snaps (no slide) when reduce-motion is set (mirrors the dock sheet).
- **testIDs:** `proof-drawer`, `proof-drawer-kind-<kind>`, `proof-drawer-input`, `proof-drawer-attach`, `proof-drawer-chip-<id>`, `proof-drawer-error`.

### ProofChip (`src/features/proof/ProofChip.tsx` — NEW, thin wrapper over `ReceiptChip`)
- **Maximum reuse.** The existing `ReceiptChip` (EV-002) already renders a `ReceiptChipContract` (from `summarizeArtifactsForReceiptChip`), is pressable, is color-independent (text label + `+N` suffix), meets the touch floor via `RECEIPT_CHIP_HIT_SLOP`, and opens the existing `SourceChainPopover`. **ProofChip does not reimplement the chip** — it is a thin wrapper that (a) takes the move's `EvidenceArtifact[]`, (b) computes `summarizeArtifactsForReceiptChip(artifacts)`, (c) renders `<ReceiptChip contract={...} onPress={openSourceChainPopover} />`.
- **Three placements, two of them already exist:**
  1. **Drawer:** ProofChip lists the move's attached sources at the top of the drawer (new mount).
  2. **Ringside card:** ProofChip replaces the plain `ringside-proof-chip` pill on the flag-on path (gated swap — see Design decision 5).
  3. **Map:** **no new mount.** The Map's evidence surface is the already-shipped `ArgumentTimelineMap` `TimelineNodePopover`, which renders a `ReceiptChip`/`EvidenceDebtChip` from `evidenceDebtSummaryFor` + `artifactsByMessageId`. Because `artifactsByMessageId` is flipped upstream at the ArgumentRoom seam, that popover reflects the read-path flip **automatically** — zero Map edits. (The ROOM-004 sidecar renders no proof chip today and `mapNodeActionSurfaceModel` bans the token `proof`; adding one there would fight R4 density + the ban-list.)
- **Copy law:** every string comes from the frozen `RECEIPT_CHIP_COPY` (already ban-list-asserted; says "Source attached", "Source and quote", "No source yet" — Source/Receipts vocabulary, zero `proof` tokens). ProofChip authors **no** copy of its own.
- **Density (R4 conversation-first):** on the Ringside card the chip is the compact one-line form (`+N` overflow), never a stack of per-kind chips.
- **testID:** `proof-chip` (+ suffix), reusing the `receipt-chip` inner testID for snapshot stability.

---

## File changes

**New files (all under `src/features/proof/`, the new feature folder):**
- `src/features/proof/proofDrawerModel.ts` — pure TS: `ProofDrawerKind`, `PROOF_DRAWER_KINDS`, `ProofKindTile[]` + `buildProofKindTiles()`, `ProofDrawerScope`, `ProofDraftInput`, `ProofItemRow`, and `proofItemRowToEvidenceArtifact(row)`. No React/Supabase. **~140 lines.**
- `src/features/proof/proofDrawerCopy.ts` — frozen `PROOF_DRAWER_COPY` (all Source/Receipts strings; ban-list + `proof`-token scanned). **~50 lines.**
- `src/features/proof/attachProofApi.ts` — the narrow PROOF-003 client-wrapper seam (`AttachProofInput`/`AttachProofResult`/`attachProof`), plus the error-code → plain-language map. Imports `src/lib/edgeFunctions.ts`. **~90 lines.**
- `src/features/proof/useProofItems.ts` — React hook: fetches non-deleted `proof_items` rows for a room's arguments (`.from('proof_items').select(...).in('argument_id', ids)`, RLS-scoped anon-key + JWT read) and returns `Record<argumentId, ProofItemRow[]>`. **Returns `{}` and performs no fetch when `enabled === false`** (flag OFF). Exposes `refetch()` for post-attach convergence. **~90 lines.**
- `src/features/proof/ProofDrawer.tsx` — the sheet/panel + kind grid + focused input + attach flow. Reuses `resolveDockLayoutVariant`, `ReceiptChip`, `SourceChainPopover`. **~320 lines.**
- `src/features/proof/ProofChip.tsx` — thin wrapper over `ReceiptChip`. **~70 lines.**
- `src/features/proof/index.ts` — barrel. **~25 lines.**

**Modified files:**
- `src/features/arguments/composer/ArgumentEntryComposer.tsx` (FREE) — add optional `onOpenProof?: () => void` prop; Source slot `onPress={onOpenProof ?? onOpenMore}`; conditional a11y hint (drawer vs More). **~8 line diff.** Comments apostrophe-free.
- `src/features/arguments/composer/argumentEntryComposerModel.ts` (FREE) — add `proofDrawerA11yLabel`/`proofDrawerA11yHint` to `ARGUMENT_ENTRY_COMPOSER_COPY`; update the `showProofSlot` comment. Stays pure, no `featureFlags`. **~6 line diff.**
- `src/features/arguments/argumentGameSurfaceEvidence.ts` (FREE) — **the single read-path flip seam.** `buildArtifactsByMessageId(messages, proofItemsByMessageId?)`: when a message has `proof_items` rows, map them via `proofItemRowToEvidenceArtifact`; else the existing JSONB path (`buildEvidenceArtifacts` on `attachedEvidence`). Absent/empty second arg → byte-identical to today. **~20 line diff.**
- `src/features/arguments/room/ArgumentRoom.tsx` (API-pinned, additive) — accept a new optional `proofDrawerEnabled` prop on `Props` (threaded from App via `ArgumentTreeScreen`); mount `useProofItems(debate.id, proofDrawerEnabled)`; pass its result into `buildArtifactsByMessageId(sorted, proofRows)`; inject `receiptChipFor` into the ringside feed input. All flag-gated; OFF → hook disabled → `buildArtifactsByMessageId(sorted)` unchanged. **Preserve** the pinned `ArgumentRoom`/`Props` tokens + the `roomTwoFlagOff`-asserted ROOM-002 wiring (ringsideFeed `useMemo` gate, `<ExchangeView …>` prop pass, `observerActionsFor`). **~18 line additive diff; confirm the UX-001.6 reviewer boundary.**
- `src/features/arguments/ArgumentTreeScreen.tsx` (FREE) — forward `proofDrawerEnabled` from App to `ArgumentRoom` (a pass-through prop, mirroring `roomExchangeV2Enabled`). **~4 line diff.**
- `src/features/arguments/room/ringsideFeedModel.ts` (FREE) — extend `RingsideCardViewModel` with an optional `receiptChip?: ReceiptChipContract | null` and `RingsideFeedInput` with an injected `receiptChipFor?: (messageId) => ReceiptChipContract | null` (the model stays pure — it never imports evidence; the orchestrator injects, exactly as `proofChipCountFor`/`owedReceiptFor` are injected today). Absent injection (flag OFF) → the existing plain pill renders. **~14 line diff.**
- `src/features/arguments/room/RingsideCard.tsx` (FREE) — in the proof indicator branch, render `<ProofChip>` when `card.receiptChip` is present, else the existing `ringside-proof-chip` pill (byte-identical flag-off). The owed chip stays the existing dashed-teal `Source owed` pill (gold is on the ProofButton, not here — Design decision 6). Comments apostrophe-free; no transform (ROOM-002 scan). **~10 line diff.**
- (Map: **no edit** — the flip reaches the Map's `ArgumentTimelineMap` `TimelineNodePopover` ReceiptChip automatically through the upstream `artifactsByMessageId`; the pinned `MapView` / `ArgumentTimelineMap` and the ROOM-004 sidecar are untouched.)
- `App.tsx` (FREE, sole flag consumer) — `import { isProofDrawerEnabled } from './src/lib/featureFlags'`; `const proofDrawerEnabled = isProofDrawerEnabled();`; drawer scope state (`useState<ProofDrawerScope | null>`); `onOpenProof={proofDrawerEnabled ? openProofForDraft : undefined}` on `<ArgumentEntryComposer>`; `proofDrawerEnabled={proofDrawerEnabled}` on `<ArgumentTreeScreen>`; mount `<ProofDrawer>` (behind `proofDrawerEnabled && scope !== null`), wired to `attachProof` + the room's `refetch`. **~30 line diff.**
- `docs/core/current-status.md` — add the PROOF-002 Phase-framing H2 with the confirmed test count + the patterns PROOF-003 (and later cards) consume (the read-path seam signature, the narrow wrapper interface, the flag-threading path).

**Not touched (pins / not needed):** every file in the Pin inventory "PINNED" rows; `submit-argument`; `ArgumentTimelineMap.tsx` / `MapView.tsx` / the ROOM-004 sidecar (the Map reflects the flip automatically via the upstream `artifactsByMessageId`); `evidenceModel.ts` (`buildEvidenceArtifacts`, `summarizeArtifactsForReceiptChip`, `ReceiptChip`, `RECEIPT_CHIP_COPY` all reused verbatim, zero edits).

---

## Design decisions (explicit)

### 1. Mount architecture — App is the sole flag consumer; two flag-gated seams
The `proof_drawer` flag lives only in `App.tsx` (ROOM-001/003 precedent, `featureFlagsStaticEnv` discipline). It threads to **two** places:
- **Attach seam (App level):** `onOpenProof` callback into the bar + `<ProofDrawer>` mounted as a sibling of `<ArgumentEntryComposer>` (which App already mounts directly at `App.tsx:1309`). Flag OFF → `onOpenProof` is `undefined` → the bar's Source slot uses `onOpenMore` (byte-identical) and the drawer subtree is never mounted.
- **Read seam (ArgumentRoom level):** `proofDrawerEnabled` threaded App → `ArgumentTreeScreen` → `ArgumentRoom`, which conditionally fetches proof rows and passes them into `buildArtifactsByMessageId`. Flag OFF → hook disabled → JSONB-only, byte-identical.

Two seams, one flag, both fail closed. The composer never imports `featureFlags` (roomThreeFlagOff pin honoured).

### 2. The kind grid is exactly the 6 shipped PROOF-001 kinds
`PROOF_DRAWER_KINDS = url | quote | source_text | note | prior_move | external_ref`. No `screenshot`/`file` (SEC-PROOF-001), no `voice_excerpt`/`timestamp` (MARK-001). A tile a user could tap but not persist (the Edge/DB would reject the CHECK) is a footgun; the grid is scoped to what PROOF-001's CHECK admits, so every tile round-trips. When SEC-PROOF-001 / MARK-001 widen the CHECK, they add their tiles + inputs (documented forward dependency).

### 3. Read-path flip = rows-first, JSONB fallback, at ONE seam
The flip lives only in `buildArtifactsByMessageId`. Per message: **if the move has `proof_items` rows, they are the source of truth; else the JSONB `attachedEvidence` fallback.** Because PROOF-001's back-fill mirrors existing JSONB into rows, and the inverse fold is faithful on every copy/doctrine field, a back-filled move renders byte-identically whether read from rows or JSONB — proven by the adapter-flip contract snapshot (Test plan). Legacy (un-back-filled) moves have no rows → JSONB, unchanged. This single-seam choice means every downstream consumer of `artifactsByMessageId` (timeline map, `moveMetadataLedger`, `pointLifecycleModel`, `railSegmentModel`, `evidenceDebtModel`) is transparently correct — they receive equivalent `EvidenceArtifact[]` either way.

### 4. ProofChip reuses ReceiptChip verbatim (not a new chip)
The issue says "renders via the ReceiptChip copy contract verbatim." The existing `ReceiptChip` component already IS that renderer. ProofChip is a thin wrapper that feeds it `summarizeArtifactsForReceiptChip(artifacts)`. This keeps one copy source (`RECEIPT_CHIP_COPY`, already ban-list-clean), one visual family, and satisfies "same chip in Ringside cards, Map sidecar, and the drawer" with a single component.

### 5. Ringside/Map ProofChip mount = gated swap, flag-off byte-identical
The RingsideCard/Map sidecar already render a lightweight proof indicator. The upgrade is a **swap gated by the presence of a `receiptChip` view-model field** (only populated on the flag-on path). Flag OFF → field absent → the existing plain pill renders unchanged (byte-identical). This respects R4 density (the ReceiptChip is itself compact) and needs no flag import in the presentational card.

### 6. Owed/gold on the ProofButton is derived, static, color-independent
The owed state reads the render-time `evidenceDebtModel` obligation (`getNodeEvidenceDebtSummary` on the scoped move), and renders gold via the ROOM-001 `private_gold` token triple (`goldSoft` bg / `goldBorder` border / `gold` text) + a paired glyph + text. It is **static** (reduce-motion-safe by construction — the bar has no animation), and always carries a text equivalent ("Source owed"), so it reads in grayscale. This *introduces* gold to the owed state per the Design Pass; the existing owed chips (state-rail `attention`, Ringside dashed-teal, and the `EvidenceDebtChip` whose contract has no gold tone) are untouched — only the ProofButton owed affordance is gold.

### 7. Detach is capability-probed, not assumed
The drawer shows a detach control on own sources only if the wrapper reports detach support (assumption 10). If PROOF-003 ships attach-only in this bundle, detach is hidden — never a broken button.

---

## Copy plan (Source/Receipts vocabulary; ban-list safe; apostrophe-free comments)

**COPY LAW (issue #889 + ROOM-003 precedent):** every user-facing string says *Source* / *Receipts* / *Sources*. The token `proof` is **forbidden** in any rendered string (it reads as a truth verdict — the shipped ban-list treats `proof`/`proven`/`validated` as verdicts). Component names, file names, folder names, testIDs, type names (`ProofDrawer`, `proof_items`, `ProofChip`) are **internal and exempt**.

Frozen `PROOF_DRAWER_COPY` (illustrative — implementer finalises, ban-list-scanned):
- Drawer title: "Add a source"
- Grid intro: "What are you backing this with?"
- Kind tiles: `url` → "Link"; `quote` → "Quote"; `source_text` → "Source text"; `note` → "Note"; `prior_move` → "Earlier point"; `external_ref` → "Reference"
- Attach button: "Attach source"
- Attached header: "Sources on this move"
- Owed marker (ProofButton): "Source owed"
- Error fallback: "Couldn't attach that source — try again."
- ProofChip strings come entirely from the shipped `RECEIPT_CHIP_COPY` ("Source attached", "Source and quote", "No source yet", "Receipt attached", "Source trail is weak", "Primary source") — already ban-list-clean.

**Reused, unchanged:** `ARGUMENT_ENTRY_COMPOSER_COPY.proofLabel = 'Source'` (already law-compliant); the ROOM-003 `moreA11yHint` mentioning "add a source" (unchanged).

A dedicated test (`proofDrawerCopyBanList.test.ts`) scans `PROOF_DRAWER_COPY` + the ProofChip-rendered strings for (a) the `proof`/`proven`/`validated` box-copy tokens and (b) the verdict ban-list (winner/loser/true/false/liar/…) — each with a negative control. Comments in `proofDrawerModel.ts` / `proofDrawerCopy.ts` / the three edited ROOM-003 files stay apostrophe-free (uxOneOneTwoDoctrine scanner gotcha).

---

## Edge cases

- **Empty input.** Attach button disabled until the focused kind's required field is non-empty (`url` needs a URL; `quote` needs quote text; etc.). No empty `proof_items` row is ever sent.
- **Flag ON but room_exchange_v2 OFF.** The one-bar composer (and thus the Source ProofButton) is only mounted with `room_exchange_v2` ON. If `proof_drawer` is ON but `room_exchange_v2` is OFF, the drawer has no composer entry point — the read-path flip + Ringside/Map ProofChip also do not surface (those surfaces are room_exchange_v2-gated). This is acceptable and honest: `proof_drawer` meaningfully lights up only alongside `room_exchange_v2` (the Design Pass phase order). Documented in Risks; the flag combination is an operator concern.
- **Move already has JSONB + a new drawer row (double source).** Rows-first would show only the rows. Resolved by assumption 6/7 + a design rule: PROOF-003, when it writes the first row for a move that has JSONB-but-no-rows, should also capture the pre-existing JSONB artifacts into rows (OR the operator sequences a submit-argument-writes-rows change before flipping the flag live). Until then, a move that mixes a submit-time JSONB source with a drawer-row source shows only the rows. Flagged in Risks + assumption 6. Because the flag is OFF at merge and the visual only ships on a later deliberate netlify push, this gap need not exist in production.
- **Offline / network failure on attach.** The wrapper returns `{ ok: false }`; the drawer shows an inline retry (`accessibilityLiveRegion="polite"`), never a modal, never a lost draft — the exchange is not paused (the composer stays usable; proof attaches to the past move, not the next reply).
- **Permission-denied (`not_participant` / `not_author`).** Mapped to plain language ("You can only add sources to your own moves"); the drawer never exposes attach on someone else's move (the Source slot only attaches to the author's own draft/move).
- **Concurrent duplicate attach.** `clientAttachId` idempotency (assumption 6) + PROOF-001's `UNIQUE(proof_item_id, claim_argument_id, relation)` make a double-tap benign; the read path de-dupes `proof_items` by `id`.
- **`source_chain_status` the client cannot set.** The drawer never sends `broken`/`primary_present`; the Edge enforces (PROOF-001 INSERT WITH CHECK). A back-filled/admin row that IS `broken`/`primary_present` renders correctly (the read path + ReceiptChip handle all 6 statuses).
- **Doctrine edge — "does the owed/gold state imply the claim is false?"** No. The owed state is an obligation marker ("a source was asked for and is owed"), rendered from `evidenceDebtModel`, which is doctrine-bound to never say true/false. The gold treatment is attention, not verdict.
- **Doctrine edge — "does attaching a source earn factual standing / points?"** No. This card writes no point-standing delta; `proof_items` is inert storage (PROOF-001). Attach is engagement/activity, not standing. Anti-amplification separation preserved.
- **Deleted / soft-deleted source.** `useProofItems` selects `deleted_at is null` (matches PROOF-001's SELECT policy + `proof_items_argument` partial index); a detached source disappears from the chip.
- **390px sheet.** The kind grid wraps (no horizontal scroll); the sheet is ¾-height, scrolls vertically, keyboard-safe (the focused input sits above the keyboard).

---

## Test plan

Baseline (from `current-status.md`, post-PROOF-001): **947 suites / 33,623 tests** (33,622 passed + 1 pre-existing skip; exit 0). The implementer must capture the live `Test Suites: … / Tests: …` line + exit 0 before and after, and cross-check `current-status.md` H2 against the review file (POSTRUN-UX001 lesson). **Expected delta: +6 to +8 suites, ≈ +90–120 tests.**

**Pure-model tests:**
- `__tests__/proofDrawerModel.test.ts` — `PROOF_DRAWER_KINDS` is exactly the 6 shipped kinds (assert `screenshot`/`file`/`voice_excerpt`/`timestamp` absent + negative control); `buildProofKindTiles` totality (one tile per kind, valid `inputMode`); `proofItemRowToEvidenceArtifact` maps every field 1:1 and every `source_chain_status`/`risk` round-trips.
- `__tests__/proofDrawerCopyBanList.test.ts` — `PROOF_DRAWER_COPY` + ProofChip-rendered strings carry **no** `proof`/`proven`/`validated` box token and **no** verdict token (winner/loser/true/false/liar/…), each with a firing negative control; component/type names are NOT scanned (exempt).
- `__tests__/attachProofApi.test.ts` — the wrapper maps `AttachProofInput` → the assumed Edge body; normalises success + every error code to `AttachProofResult`; generates a `clientAttachId`; **no `SERVICE_ROLE`/service-role literal**, no direct `.from('proof_items').insert`; threads `answersDebtKind` when owed.

**Adapter-flip contract snapshot (THE read-side fidelity test — models PROOF-001's write-side fidelity test):**
- `__tests__/proofReadPathParity.test.ts` — over inline fixtures exercising every kind→status path:
  - **Path A (JSONB):** `buildArtifactsByMessageId([{ attachedEvidence }])` → `summarizeArtifactsForReceiptChip` → `chipA`.
  - **Path B (rows):** the equivalent `proof_items` rows → `buildArtifactsByMessageId([msg], { [id]: rows })` → `summarizeArtifactsForReceiptChip` → `chipB`.
  - **Assert exact equality** on `label`, `helper`, `tone`, `invitesFollowup`, `showsSourceChainPressure`, `status`, `count` (the copy/doctrine fields — provably kind-invariant).
  - **Assert flag-off byte-identity:** `buildArtifactsByMessageId(messages)` (no rows arg) `===` today's output for every fixture.
  - **Rows-first precedence:** when a message has BOTH JSONB and rows, rows win; document the (kind-only) divergence that never changes the chip.

**RNTL (UI) tests:**
- `__tests__/proofDrawer.test.tsx` — renders the kind grid (6 tiles, each ≥44×44 role/label/state); tile → focused input; attach calls the (mocked) wrapper with the right `AttachProofInput`; success renders a ProofChip; failure renders inline retry (no modal); `resolveDockLayoutVariant` drives sheet vs panel at 719/720; 390px grid does not overflow horizontally.
- `__tests__/proofChip.test.tsx` — renders `ReceiptChip` copy verbatim from artifacts; color-independent (text label present); `+N` overflow; tap opens `SourceChainPopover`.
- `__tests__/proofButtonRouting.test.tsx` — `ArgumentEntryComposer` with `onOpenProof` set → Source slot calls `onOpenProof` (not `onOpenMore`); **without** `onOpenProof` → calls `onOpenMore` (flag-off byte-identical); owed scope renders the gold + text-owed state; the More button always calls `onOpenMore`.

**Flag-off + preservation proofs (source-scan, the #882/roomThree lane):**
- `__tests__/proofDrawerFlagOff.test.tsx` — App gates the drawer mount on `isProofDrawerEnabled()` (source-scan `App.tsx`); the three ROOM-003 files import **no** `featureFlags`; the `argument-entry-composer-proof` testID is unchanged; the ROOM-003 `roomThreeByteShapeContract` dual-render still passes (bar without `onOpenProof` → routes to More).
- **Evidence-type hard block preserved:** assert `roomThreeEvidenceHardBlock.test.ts` + the submit-path zero-diff (`uxOneOneFiveReadOnlyBoundary` submit guard) still pass unchanged — this card touches neither `submit-argument` nor `evaluateArgumentDraft`.
- **ReceiptChip contract snapshot unchanged:** assert `ReceiptChip.test.tsx` + any receipt-chip snapshot is untouched (ProofChip reuses `ReceiptChip`, does not edit it).

**J7 integration (the binding acceptance flow):**
- `__tests__/proofJ7Flow.test.tsx` — construct a room where the author's move carries an owed `source` debt (a `source_request` reply exists): (1) the ProofButton renders owed/gold on that scoped move; (2) opening the drawer is pre-scoped to that move + owed kind; (3) one attach calls `attachProof({ answersDebtKind: 'source', ... })`; (4) after the returned row lands in `proofItemsByMessageId` and flows through `buildArtifactsByMessageId` → `later.artifacts`, `deriveEvidenceDebts` recomputes the debt to `supplied` (client-observed re-derivation) and a ProofChip renders on the move. **This asserts the inverse fold produces an `(kind, sourceChainStatus)` that `artifactDischarges('source', …)` accepts** (Data model invariant 2 — a `url`/`external_ref`/`source_text` attach with a source discharges `source`; the test would fail loudly if the fold mapped a kind that `artifactDischarges` rejects). The `evidence_supplied` **notification** is asserted only as "the wrapper requested the answers-debt relation" (the notification itself is PROOF-003's test — assumption 8).

No Docker/DB test (no migration, no Edge in this card). No `web:build`-only assertion beyond the standard gate (the card ships client code; the implementer runs `web:build` per the asset/bundle discipline since new components render).

---

## Dependencies (cards / docs / files)

- **Assumes PROOF-001 (#888) is merged** (it is — commit `2cf98f0`): `proof_items` / `proof_relations` exist with SELECT-only RLS (`is_argument_visible_in_circle`), and `proofItemRowFromArtifact` (the write-side fold) is the mirror of this card's read-side inverse.
- **Reads** `src/features/evidence/evidenceModel.ts` at `buildEvidenceArtifacts` + `summarizeArtifactsForReceiptChip` + `ReceiptChipContract` + `RECEIPT_CHIP_COPY` (the copy contract the ProofChip renders verbatim), and `ReceiptChip`/`SourceChainPopover` (reused).
- **Reads** `src/features/evidence/evidenceDebtModel.ts` at `deriveEvidenceDebts` / `getNodeEvidenceDebtSummary` (the owed state + the client-observed debt flip).
- **Reads** `src/features/arguments/ObserverActionDockLayout.ts` at `resolveDockLayoutVariant` / `DOCK_SIDE_BREAKPOINT` / the narrow-sheet height cap (reused for the drawer chrome).
- **Reads** the ROOM-003 bar (`ArgumentEntryComposer.tsx` / `argumentEntryComposerModel.ts`) — the Source slot this card reroutes.
- **Concurrent dependency: PROOF-003 (`attach-proof` Edge)** — same bundle branch, owns the Edge contract. This card depends only on the narrow `attachProofApi.ts` seam; the implementer reconciles the numbered assumptions against `docs/designs/PROOF-003.md` and adjusts only the wrapper body.
- **Depends on** `room_exchange_v2` for the composer entry point + Ringside/Map surfaces (the drawer's primary entry only exists when the one-bar composer is mounted).
- **Forward:** SEC-PROOF-001 (adds `screenshot`/`file` tiles + storage inputs when the CHECK widens); MARK-001 (adds `voice_excerpt`/`timestamp` tiles).

---

## Risks

- **The adapter flip is THE risk — legacy render parity.** If the inverse fold or the rows-first precedence ever diverges from JSONB for a copy/doctrine field, back-filled moves render differently and the flag flip is a visible regression. Mitigation: the adapter-flip contract snapshot (`proofReadPathParity`) proves chip-field equality over every kind→status path + a flag-off byte-identity assertion; the ReceiptChip copy is `sourceChainStatus`+count-derived (kind-invariant), so the fold's only lossy dimension provably cannot move the chip.
- **Double-source (JSONB + rows on one move).** Rows-first can hide a submit-time JSONB source once a drawer row exists on the same move (Edge cases). Mitigation: assumption 6/7 routes the reconciliation to PROOF-003 (capture existing JSONB into rows on first attach) or to operator sequencing (submit-argument-writes-rows before flipping the flag live). Because the flag is OFF at merge, this cannot regress production before the deliberate push.
- **Drawer-vs-bar geometry.** The bar docks above the keyboard; the drawer sheet must not fight the bar or the keyboard on 390px. Mitigation: reuse the dock breakpoint + narrow-sheet height cap (never full-screen), ¾-height sheet, keyboard-safe focused input, cross-device QA at 390×844 / 768×1024 / 1366×768.
- **PROOF-003 contract drift.** The Edge shape may differ from the assumptions. Mitigation: the single narrow wrapper (`attachProofApi.ts`) is the only file that knows the wire shape; the drawer is contract-agnostic. Reconciliation is a one-file change.
- **ArgumentRoom is API-pinned (not byte-frozen).** The read-seam wiring lives in `ArgumentRoom.tsx`, which `uxOneOneSixReadOnlyBoundary` pins by required API tokens (`ArgumentRoom`/`Props`) + a documented reviewer git-diff, and `roomTwoFlagOff` pins specific ROOM-002 wiring lines. ROOM-002/004 already edited it additively, so an additive edit that preserves those tokens + lines is pattern-consistent. Mitigation: the implementer keeps the edit strictly additive, preserves the pinned tokens + wiring, runs `roomTwoFlagOff` + the boundary suite green, and confirms with the reviewer. If the reviewer insists on true zero-diff for `ArgumentRoom`, the fallback is to lift the `buildArtifactsByMessageId` call + the proof-items fetch into a thin FREE wrapper the room composes — but the current additive-edit path matches the ROOM-002/004 precedent.
- **Ringside view-model churn.** Adding `receiptChip`/`receiptChipFor` to the ROOM-002 view-model + input touches ringside files. Mitigation: both are optional and only populated on the flag-on path; ROOM-002/004 tests (ringside model, parity matrix) must stay green. The Ringside ProofChip is an **optional refinement** — the plain `proofChipCount` pill already reflects the read-path flip (the count flows from the flipped `artifactsByMessageId`), so J7 does not depend on the ProofChip swap; if the ringside swap is descoped, J7 still passes via the drawer + the own-move chip.
- **Flaky wall-clock / full-suite interaction.** New RNTL suites should avoid wall-clock assertions; the debt derivation takes an injected `nowMs` (deterministic).

---

## Out of scope

- No migration, no `proof_items`/`proof_relations` schema change (PROOF-001).
- No direct client write to `proof_items`/`proof_relations`; no service role (PROOF-003 owns writes).
- No storage-kind UI (`screenshot`/`file`), no EXIF/size hardening (SEC-PROOF-001).
- No markers / `voice_excerpt` / `timestamp` tiles (MARK-001).
- No admin source-chain status UI; `broken`/`primary_present` remain unsettable from the client.
- No edits to `submit-argument`, `evaluateArgumentDraft`, or any pinned composer/dock/oneBox file.
- No point-standing / anti-amplification change (attach is inert storage; earns no factual standing).
- No `evidence_supplied` notification authoring in the client (Edge-owned).
- No v1-scope violation (no voting, search, push, OAuth, public API).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** attach/owed states are activity + obligation markers, never verdicts; nothing here gates a reply; the only surviving hard block is the pre-existing evidence-type-without-source rule in `submit-argument` (untouched, byte-identical). The gold-owed state carries a text equivalent and never says true/false.
- **cdiscourse-doctrine §9 (plain language / COPY LAW):** every user-facing string says Source/Receipts; `proof` is banned from rendered copy (scanned with a negative control); component/file/type names are internal and exempt; ProofChip copy comes entirely from the ban-list-clean `RECEIPT_CHIP_COPY`.
- **cdiscourse-doctrine §4 (AI limits):** no AI, no classifier; the drawer is deterministic UI.
- **cdiscourse-doctrine §6–7 (secrets / no AI calls in app):** no secret; the write goes through PROOF-003's JWT Edge via the anon-key wrapper; no service role in the client (asserted by source-scan); no external AI/X call.
- **cdiscourse-doctrine §8 (Supabase conventions):** no RLS change; reads are RLS-scoped anon-key + JWT (SELECT policy PROOF-001 shipped); soft-deleted rows excluded.
- **evidence-doctrine (engagement vs factual standing; source-chain advisory; no popularity):** attach earns no factual standing and writes no point-standing delta; the source-chain *status* is advisory; `primary_present` is admin-only (client never sets it); the owed state is an obligation, never "false"; no popularity-shaped signal feeds any of it.
- **supabase-edge-contract (no service-role in client; write via Edge):** the only writes are through PROOF-003; the client's proof reads are SELECT-only; the narrow wrapper is the single boundary.
- **accessibility-targets / expo-rn-patterns:** 44×44 tiles + chips, roles/labels/state, color-independent owed + chip states, reduce-motion-safe (static gold, snap open), RN primitives only (no icon lib, no new dep — glyph `<Text>`), sheet/panel via the reused dock breakpoint.

---

## Operator steps

**None for the merge itself — pure client change, flag OFF.** Merging does not change the live site (`proof_drawer` defaults OFF; no migration, no Edge in this card).

Sequenced for the eventual visual ship:
1. **PROOF-003 (`attach-proof` Edge) must merge + auto-deploy** (config.toml-registered) before the flag flips — the drawer's attach is inert without it.
2. **PROOF-001 back-fill** (operator-gated, already available: `npm run proof:backfill:apply`) should run before the flag flips live, so back-filled moves have rows and rows-first == JSONB for them.
3. **(Recommended) sequence a submit-argument-writes-rows change** (or confirm PROOF-003 captures pre-existing JSONB on first attach) before flip, to close the double-source gap (Risks).
4. **Flip the flag** via `EXPO_PUBLIC_PROOF_DRAWER=true` (Netlify env; the ROOM-003 flag precedent) and **push netlify-prod** (strict FF push + poll the deployed JS bundle hash) — the drawer/button/chip + read-path flip become visible only on that deliberate push.
5. Smoke J7 on `dev-cdiscourse.netlify.app` with a test participant.

## Rollout

Flag OFF at merge → zero live change. The visual ships on the next deliberate netlify-prod push **after** the flag flips (steps above). Rollback = flag OFF (env) + revert the PR; no migration to unwind (PROOF-001 owns the tables; they stay empty-safe). The read-path flip is inert with the flag off (the fetch hook is disabled), so a flag-off build reads JSONB exactly as today.

---

## Orchestrator-authored brief ledger

This design was authored against the orchestrator-relayed issue (#889) + the Design Pass (Output 6 component spec, §4 J7), not a hand-validated operator brief. Interpretation map:

- **From the binding issue (#889):** the three surfaces (ProofButton/Drawer/Chip), the 6-kind grid scope, the read-path-flip-with-fallback mandate, the COPY LAW, the J7 + evidence-hard-block + flag-off-byte-identical acceptance criteria, the "wrap never edit" pinned-file rule.
- **From the Design Pass (Output 6, §4 J7, design-only, operator-reviewed 2026-07-04):** the drawer chrome (sheet/panel breakpoint), the gold-owed ProofButton, the "same chip in three placements", the J7 step sequence.
- **From a pre-launch codebase survey (this session):** the ROOM-003 bar Source-slot-routes-to-More reality (`argumentEntryComposerModel.showProofSlot` comment "routes to More until PROOF-002"), the unpinned status of the ROOM-003 files vs the pinned UX-001.5 composer set, the single read-path seam (`buildArtifactsByMessageId` at `ArgumentRoom.tsx:778`), the existing `ReceiptChip` already rendering the contract, the flag-threading-from-App pattern, the 947/33,623 baseline.
- **Resolved by orchestrator/designer default (flag for operator review):**
  (a) **ProofChip = reuse `ReceiptChip`** rather than a bespoke chip (maximum reuse; the issue says "verbatim").
  (b) **Rows-first-else-JSONB per message** (vs a merge) — chosen for simplicity + the back-fill guarantee; the double-source gap is routed to PROOF-003 / operator sequencing.
  (c) **Ringside/Map ProofChip as a gated view-model swap** (optional `receiptChip` field) — chosen to keep flag-off byte-identical and the presentational card flag-free.
  (d) **The narrow `attachProofApi.ts` wrapper seam** as the sole PROOF-003 boundary.
- **Operator-deferred review:**
  (i) The **double-source reconciliation** (assumption 6/7) — whether PROOF-003 captures pre-existing JSONB on first attach, or a submit-argument-writes-rows change is sequenced before flip. This is the one place a product/sequencing call could differ.
  (ii) Whether the **Ringside ProofChip swap** ships in this card or defers to a follow-up (the drawer + read-path flip + the J7 debt-flip are the critical core; the Ringside ReceiptChip-contract swap is an additive refinement — the plain count pill already reflects the flip). The **Map** needs no decision here: its evidence surface is the already-shipped `ArgumentTimelineMap` popover, which reflects the flip automatically (zero Map edits), so "same chip on the Map" is satisfied without touching the pinned Map files.
  (iii) The **`ArgumentRoom` additive-edit vs true-zero-diff** call (Risks) — the read-seam wiring is additive and pattern-consistent with ROOM-002/004, but if the reviewer requires strict zero-diff on `ArgumentRoom`, the fallback wrapper (Risks) applies.
