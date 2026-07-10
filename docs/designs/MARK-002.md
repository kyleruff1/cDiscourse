# MARK-002 — create-marker Edge + TimestampMarker chip + scoped reply (text-first)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — markers lane (M-ASP-4, Phase P3.5)
**Release:** M-ASP-4
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/894
**DEPLOY-BEARING:** yes — a NEW Edge Function (`create-marker`) that MUST carry a root
`[functions.create-marker]` block in `supabase/config.toml` in the SAME PR (the #509
hazard). Merge auto-deploys it (the Supabase GitHub integration keys off the root
`[functions.*]` blocks).
**MIGRATION-BEARING:** yes — this card became migration-bearing (see the Linkage
reality audit). One small additive migration ALTERs `public.timestamp_markers` to add
`reply_argument_id`. The delegated linkage decision could not be resolved by any
no-migration path without semantic dishonesty; the issue pre-authorises the trade.
**Flag:** rides `timestamp_rebuttals` (ASP-FLAGS-001, shipped, default OFF). Flag-off =
today byte-identical.

---

## Problem & scope

Design Pass principle 7 — **"Quote moments, not messages."** MARK-001 shipped the data
layer (the `timestamp_markers` table, SELECT-only, `quoted_text` as the durable
verbatim artifact, all writes deferred to "the MARK-002 Edge"). This card ships the
**text half of J6 end-to-end**:

> Select a phrase of an opponent's posted argument → a marker is minted with a
> **server-snapshotted `quoted_text`** → the reply carries the marker chip → the chip
> deep-links back to the source span **with context** (the Output 13 Q5 mitigation).

Three doctrine constraints shape every decision below:

1. **`quoted_text` is a server snapshot, never client-supplied** (Q5 misrepresentation
   mitigation + the fabricated-quote acceptance criterion). The Edge reads
   `arguments.body` server-side and snapshots `body[span_start:span_end)` verbatim; the
   client's quote is used **only to reject a mismatch**, never stored. This is the
   decisive reason MARK-001 shipped SELECT-only: a client INSERT could forge any
   `quoted_text`. (`cdiscourse-doctrine §1`; MARK-001 §Decision 3.)
2. **A marker quotes the point, never judges it** — a span + a verbatim quote, no
   verdict, no score, no truth label; `kind ∈ ('rebuttal_anchor','note')` is verdict-free
   (`cdiscourse-doctrine §1`). Markers describe the *moment*, never the person
   (`§10a`).
3. **Score never blocks posting; the marker path is orthogonal to `submit-argument`**
   (`cdiscourse-doctrine §1`). Minting a marker never gates a reply; a marker mint
   failure degrades gracefully (the reply is already posted, just without a chip).

**In scope:** the `create-marker` Edge (guard ladder + server-side quote verification +
config.toml registration + scan suite), the marker-side reply-linkage migration, the
`TimestampMarker` chip (one component, three placements), the honest v1 phrase-selection
gesture (a phrase-picker sheet — see the Gesture reality audit), the `RebuttalComposer`
scope chip via the ROOM-003 context-chip seam, the read hook + client wrappers + pure
model, and the flag wiring (default OFF, flag-off byte-identical).

**Non-goals:** no waveform / voice anything (MARK-003, blocked on #863/P5); no `ms`
span (`span_unit` stays `('chars')`); no `recording_id`; no `proof_items.kind` widening;
no `submit-argument` edit; no arguments-table ALTER (linkage is marker-side); no marker
retraction UI (the column exists via MARK-001 `deleted_at`, exposing it is a follow-up);
no standalone-note authoring flow (v1 mints markers only in the rebuttal path).

---

## Linkage reality audit (LOAD-BEARING — the delegated decision)

The issue delegates the reply→marker linkage and warns that the Design Pass's canonical
`arguments.target_marker_id` column does **not** exist and `submit-argument` is **pinned
(zero-diff)**. I audited every no-migration path; each is either impossible or
semantically dishonest. The honest verdict is a **small additive migration**, and the
issue's own guidance (`prefer marker-side linkage`, `no arguments-table migration`)
pre-selects its shape.

### What the link must store

A marker's `target_argument_id` (MARK-001, immutable semantics) is **the quoted
(opponent's) argument** — "the argument whose body this marker quotes." The **reply** is
a *different* argument (the caller's own new move). To render the marker chip on the
reply card and deep-link it to the source span, the reply must resolve *which marker it
references*. Nothing shipped stores a (reply_argument, marker) association. `target_argument_id`
cannot serve — it points the other way (at the quoted arg).

### Option A — `arguments.target_marker_id` (the Design Pass column) — REJECTED

- **Cannot be written at insert:** the Design Pass assumed `target_marker_id` rides
  through `submit-argument`. `submit-argument` is **pinned (zero-diff)** — it cannot
  thread it. So the column would have to be written **post-insert** by a service-role
  Edge UPDATE on `public.arguments`.
- **New write path to the sacred table:** that introduces a service-role UPDATE to
  `public.arguments` outside `submit-argument` — a materially bigger doctrinal step than
  a sibling column (the arguments table is the load-bearing one; every write is meant to
  flow through the engine gate). `supabase-edge-contract §2` guards direct client writes
  to arguments; a new Edge UPDATE path is close enough to warrant avoiding.
- **The "mirrors text quoting" rationale collapses:** the Design Pass justified "column,
  not a table" because `target_excerpt` is a column set at insert. `target_marker_id`
  *cannot* be set at insert here, so the symmetry that motivated the column is gone.
- **The issue explicitly disprefers it:** "no arguments-table migration in this card
  unless the designer proves it unavoidable (prefer marker-side linkage)."

### Option B — `proof_items.marker_id` via the deployed `attach-proof` Edge — REJECTED (dishonest)

- `proof_items.marker_id` exists (MARK-001 shipped the FK), but the proof kinds that
  consume a marker (`voice_excerpt` / `timestamp`) are **deferred from
  `proof_items.kind`** (PROOF-001) and this card does **not** widen the kind CHECK.
- `attach-proof`'s request schema is `.strict()` and has **no `markerId` field**
  (verified: `supabase/functions/attach-proof/index.ts` `AttachSchema` /
  `_shared/proofAttach.ts` — a smuggled key 422s). So `attach-proof` **does not accept a
  marker_id today**; using it would require widening a shipped Edge's schema + the kind
  vocabulary — re-opening the deferred-kind footgun PROOF-001 deliberately closed.
- The only shipped kind that *could* carry `marker_id` without a schema change is
  `note`, and `note`-with-`marker_id` is semantically weak: a marker is a **rebuttal
  anchor**, not a source/receipt. Doctrine (`§10a` — do not collapse distinct concepts)
  disfavors it. **Rejected as semantically dishonest.**

### Option C (CHOSEN) — `timestamp_markers.reply_argument_id` (marker-side, one column)

Add **one nullable FK column to the markers table itself**: the marker optionally
records which reply consumed it.

```
alter table public.timestamp_markers
  add column reply_argument_id uuid null references public.arguments(id) on delete set null;
```

- **This is literally "marker-side linkage"** (the issue's stated preference) and touches
  **zero** existing tables' data — `arguments` is not ALTERed, `submit-argument` is not
  edited.
- **One marker row serves both placements:** `target_argument_id` → the source-span
  highlight; `reply_argument_id` → the reply reference chip. "One component, three
  placements" (Design Pass Output 6) is backed by **one row**.
- **1:1 is the right shape.** Each rebuttal mints its OWN marker (MARK-001: "the same
  phrase can be marked for different replies … no UNIQUE constraint"), so a marker maps
  to **exactly one** reply (or none — a standalone note). A single nullable column models
  this exactly; a join table (`reply_marker_refs`) would model an unneeded many-to-many
  and add a whole table + RLS + scan surface. Column wins.
- **No RLS change.** A marker's visibility already flows through `target_argument_id` via
  the shipped `timestamp_markers_select_room_visible` policy. `create-marker` enforces
  that the reply is same-room and caller-owned, so a viewer who can see the marker (target
  visible) can also see the reply (same room). No new leak surface → **no policy edit**,
  just the additive column + a partial index + a comment.
- **Append-only discipline honored.** MARK-001's migration (`20260711000001`) is applied;
  this is a NEW migration (`20260711000002`), never an edit. The table ships empty, so
  the ALTER is a metadata-only nullable add (no rewrite, instant).

### Verdict

**This card is migration-bearing.** The single honest linkage is
`timestamp_markers.reply_argument_id` — a marker-side, one-column additive migration,
written only by the `create-marker` service-role Edge (the table stays SELECT-only). The
trade is stated openly per the issue; **the orchestrator ratifies.** Option A
(`arguments.target_marker_id`) remains the operator's alternative if they insist on the
verbatim Design Pass column — flagged in the ledger — but it costs a new service-role
UPDATE path to the sacred arguments table for no functional gain and against the issue's
"prefer marker-side" instruction.

---

## Gesture reality audit (the second delegated decision)

The Design Pass ideal is "tap-and-hold any sentence of text → Respond to this" (free
selection). I audited RN-Web feasibility; free selection with reliable char offsets is
**not robust cross-platform**, so the honest v1 is a **phrase-picker sheet**.

### Why free text selection is not the v1

- **Web:** an RN `<Text>` renders to DOM; `window.getSelection()` yields a DOM Range, but
  mapping a Range back to **character offsets in the original `body` string** is fragile —
  the card body may be split across text nodes (the RingsideCard already nests a quote
  chip + header Text siblings), and any future `numberOfLines` truncation breaks the
  mapping. Offsets that don't index the true body would fail server verification.
- **Native (ios/android):** RN `<Text selectable>` exposes **no** first-class
  selection-offset callback (only `<TextInput>` has `selection`). There is no reliable
  "user selected chars [i,j)" event.
- Conclusion: a free-selection gesture would be a web-only, brittle path — exactly the
  kind of platform divergence `expo-rn-patterns` warns against.

### The honest v1 — a deterministic phrase-picker (works identically web + native)

- A pure model function `segmentPhrases(body)` splits the target argument body into
  **sentence-ish phrases** with exact `{start, end}` char offsets (offset-tracking
  segmenter — no lib, pure TS). Each phrase is a tappable ≥44px row in a
  `MarkerPhrasePickerSheet`.
- Tapping a phrase yields `{ spanStart, spanEnd, quote: body.slice(spanStart, spanEnd) }`
  computed from the **same body string the client loaded** (immutable — MARK-001
  durability audit). The quote is the **raw, untrimmed** substring so it matches the
  server slice byte-for-byte.
- The picker opens from a **flag-gated "Respond to this" affordance** on a non-own
  RingsideCard (see Component spec). The existing `ask_for_quote` control is a *different*
  action (asking the opponent for a source) and is not reused.
- **Limits stated openly:** v1 selects **one phrase (single sentence-ish span)** per
  marker — "one gesture, one chip" (Design Pass Output 6). Multi-sentence / paragraph /
  sub-phrase (word-level) selection is deferred to a follow-up; the waveform region-select
  twin is MARK-003 (P5). The picker granularity is sentence-level; the *server* is the
  authority on the stored `quoted_text` regardless.

### Server is the verifier, not the client

`create-marker` recomputes `quoted_text = body[span_start:span_end)` from the target
argument's actual body and **rejects a mismatched client `quote`** (422 `quote_mismatch`).
This catches both a fabricated quote (the AC) and stale offsets (body drift). The picker's
determinism means the happy path always matches.

---

## The Edge contract (verbatim)

New function `supabase/functions/create-marker/index.ts`, mirroring the `attach-proof`
house shape (guard ladder, no-oracle caller-scoped reads, `.strict()` schema, service-role
writer for a SELECT-only table, `_shared/http.ts` responses, apostrophe-free comments, no
Authorization / service-role logging).

### config.toml registration (the #509 hazard — same PR)

```toml
# MARK-002 (#894) — create-marker. The SOLE server-authoritative writer for
# public.timestamp_markers (MARK-001 shipped it SELECT-only). verify_jwt = true; the
# function ALSO validates the JWT via createCallerClient + getUser (defense-in-depth) to
# resolve the caller id, then gates target-visibility + participant + span-bounds +
# SERVER-SIDE quote verification + caps BEFORE the service-role insert. quoted_text is
# snapshotted VERBATIM from arguments.body server-side so the quote cannot be
# client-forged (the Output 13 Q5 misrepresentation mitigation + the fabricated-quote
# acceptance criterion). Registration here is what makes it auto-deploy on merge (the
# Supabase GitHub integration keys off the root [functions.*] blocks) — the #509 hazard.
[functions.create-marker]
verify_jwt = true
```

### Request schema (`.strict()` — one action `mint`)

```ts
const MintMarkerSchema = z.object({
  action: z.literal('mint'),
  debateId: z.string().uuid(),
  targetArgumentId: z.string().uuid(),          // the quoted (opponent's) argument
  spanStart: z.number().int().nonnegative(),
  spanEnd: z.number().int().positive(),
  quote: z.string().min(1).max(MARKER_QUOTE_MAX), // client's claimed span text — for VERIFICATION only, never stored
  kind: z.enum(['rebuttal_anchor', 'note']),     // matches the MARK-001 CHECK; no proof_excerpt
  replyArgumentId: z.string().uuid().optional(),  // the caller's OWN reply that consumes this marker (J6 text-half)
}).strict();
// .strict() rejects any smuggled quotedText / spanUnit / createdBy / recordingId as 422.
```

There is deliberately **no** `quotedText`, **no** `spanUnit`, **no** `recordingId`,
**no** `createdBy` field: `quoted_text` is derived server-side; `span_unit` is always
`'chars'`; `created_by` is `callerId`.

### Guard ladder (fail-closed, in order)

| # | Guard | Failure (code / status) |
|---|---|---|
| 1 | CORS preflight + method POST | `method_not_allowed` / 405 |
| 2 | `Authorization` header present | `unauthorized` / 401 |
| 3 | JSON body parses | `bad_request` (invalid_json) / 400 |
| 4 | `.strict()` schema | `validation_failed` / 422 |
| 5 | Identity — `callerClient.auth.getUser()` | `unauthorized` / 401 |
| 6 | **Target visibility + debate consistency** — caller-scoped read of `arguments (id, debate_id, body, status)` for `targetArgumentId`; `maybeSingle` (no-oracle) | null → `target_not_found` / 404; `debate_id !== debateId` → `debate_argument_mismatch` / 400 |
| 7 | Participant — `callerClient.rpc('is_debate_participant', { p_debate_id: debateId })` | `!== true` → `not_a_participant` / 403 |
| 8 | **Span bounds** — `0 <= spanStart < spanEnd <= body.length`; `spanEnd - spanStart <= MARKER_QUOTE_MAX` | out of range → `span_out_of_bounds` / 400; too long → `span_too_long` / 400 |
| 9 | **Quote verification (Q5 + fabricated-quote AC)** — service-role read of `arguments.body`; `serverQuote = body.slice(spanStart, spanEnd)`; require `serverQuote === quote` **exactly** | mismatch → `quote_mismatch` / 422 |
| 10 | **Reply linkage** (only if `replyArgumentId` set) — caller-scoped read of the reply `(id, author_id, debate_id)`; must exist, `author_id === callerId`, `debate_id === debateId`; service-role check that no non-deleted marker already has this `reply_argument_id` | null → `reply_not_found` / 404; not owner → `not_your_reply` / 403; wrong room → `debate_reply_mismatch` / 400; already linked → return the existing marker `{ idempotent: true }` |
| 11 | **Cap** — service-role count of non-deleted markers where `target_argument_id = targetArgumentId AND created_by = callerId` | `>= MARKERS_PER_TARGET_PER_USER` → `marker_cap_reached` / 409 |
| 12 | **Mint** — service-role INSERT (below) | insert failure → `internal_error` / 500 |

### The write (service-role only — SELECT-only table)

```ts
const insertPayload = {
  debate_id: body.debateId,
  target_argument_id: body.targetArgumentId,
  created_by: callerId,
  kind: body.kind,
  span_start: body.spanStart,
  span_end: body.spanEnd,
  span_unit: 'chars',
  quoted_text: serverQuote,                 // the SERVER slice, never body.quote from the client
  reply_argument_id: body.replyArgumentId ?? null,
};
```

### Response (camelCase — the `TimestampMarker` view-model seam)

```ts
{ ok: true, idempotent: boolean, marker: {
    id, debateId, targetArgumentId, replyArgumentId, kind,
    spanStart, spanEnd, spanUnit, quotedText, createdAt } }
```

Errors return the house `{ error, message }` shape (`_shared/http.ts` + a local `fail`
helper, the `attach-proof` idiom); no stack trace, no service-role detail, no row the
caller cannot already see. Logging: `console.error('create_marker_ok', { callerIdShort,
targetArgumentIdShort, kind, hasReply })` — never the Authorization header, the
service-role key, or `quoted_text` / body content.

### Shared contract module

`supabase/functions/_shared/markerCreate.ts` (pure TS, no Deno/Supabase/network,
apostrophe-free) — imported by **both** the Edge and the jest contract test (the
`_shared/proofAttach.ts` precedent). Exports: `MARKER_KINDS`, `MARKER_QUOTE_MAX` (e.g.
2000), `MARKERS_PER_TARGET_PER_USER` (e.g. 20), `verifyMarkerSpan(bodyLength, start, end)
→ {ok}|{ok:false,issue}`, `verifyQuoteMatch(body, start, end, clientQuote) →
{ok}|{ok:false,issue}`, `sliceQuote(body, start, end)`.

---

## Design decisions (explicit)

1. **Linkage = `timestamp_markers.reply_argument_id` (marker-side, one column).** See the
   Linkage reality audit. This card is migration-bearing; option A (`arguments.target_marker_id`)
   is the operator's ratifiable alternative but costs a new arguments write path against
   the issue's stated preference.
2. **Edge = SELECT-only-table service-role writer, `attach-proof` guard-ladder shape**
   (§The Edge contract). The load-bearing guarantee is server-side `quoted_text` snapshot
   + exact quote verification (Q5). Caps: `MARKERS_PER_TARGET_PER_USER = 20` (Q9 spirit),
   `MARKER_QUOTE_MAX = 2000` span chars. Idempotency: a reply already linked to a marker
   returns the existing marker (`idempotent: true`) — a dropped response is safe to retry.
3. **Gesture = deterministic phrase-picker sheet** (§Gesture reality audit). v1 selects one
   sentence-ish phrase; free selection + multi-span deferred; server verifies the span.
4. **Chip = ONE `TimestampMarker` component, three `placement` values:**
   `'source_span'` (highlighted run inside the target card body), `'reply_reference'`
   (chip on the reply card; tap → deep-link), `'composer_scope'` (chip in the ROOM-003
   bar; ✕ un-scopes). Deep-link resolves to the **source span in full body context** —
   the RingsideCard already renders the full body, so highlighting the span *within it*
   satisfies Q5 ("the chip always resolves to the full transcript/body context").
5. **RebuttalComposer scoping via the ROOM-003 context-chip seam.** The scoped marker is
   client-only state held by `ArgumentRoom`; it feeds `argumentEntryComposerModel`
   (`deriveEntryComposerTarget` gains an optional `scopedMarker` input that renders the
   `composer_scope` chip) — **no pinned-file edit**. The reply's `parentId` is set to
   `targetArgumentId` (you rebut the phrase of the thing you reply to), extending
   `target_excerpt` semantics.
6. **Mint timing = post-submit (atomic mint + link, no orphans).** The pending marker
   lives as client state during composition. On `submit-argument` success, the composer
   surfaces the new reply id; `ArgumentRoom` calls `create-marker` with `replyArgumentId`,
   minting + linking in one call. If mint fails, the reply is already posted (graceful —
   no chip). No marker row is ever created for an abandoned draft.
7. **Flag wiring + flag-off byte-identity.** `App.tsx` (sole flag importer) reads
   `isTimestampRebuttalsEnabled()` once and threads `timestampRebuttalsEnabled` into
   `ArgumentRoom`. Flag OFF ⇒ no marker props passed ⇒ `useMarkers` fetches nothing ⇒
   every seam renders its existing branch byte-identically (the `proofDrawerEnabled` /
   `roomExchangeV2Enabled` precedent).
8. **Slices (commit order):** (1) migration + scan test; (2) Edge + shared contract +
   config.toml + Edge/contract tests; (3) client wrapper (`edgeFunctions.ts`
   `createMarker`) + `createMarkerApi` + `useMarkers` + pure `timestampMarkerModel`; (4)
   `TimestampMarker` + `MarkerPhrasePickerSheet` + copy; (5) wiring (App.tsx →
   ArgumentRoom → RingsideCard/Feed + ArgumentEntryComposer) + flag-off proofs + J6
   acceptance.

---

## Pin inventory (zero-diff — assert in tests)

| File / area | Status | Why |
|---|---|---|
| `supabase/functions/submit-argument/index.ts` | **PINNED** | The reply posts through it unchanged; the marker link is written by `create-marker`, never here. |
| `supabase/functions/attach-proof/*` + `_shared/proofAttach.ts` | **PINNED** | Not the marker write path (Linkage audit option B rejected); no `markerId` widening. |
| `src/features/arguments/ArgumentComposer.tsx`, `ArgumentComposerDock.tsx`, `oneBox/*` | **PINNED** | The OLD dock composer; not touched. Marker scoping rides the ROOM-003 bar seam only. |
| `src/features/arguments/ComposerTargetPanel.tsx` | **PINNED** (treat as) | Composer sub-component; the marker scope chip is additive in the ROOM-003 bar, not here. |
| `src/features/arguments/ArgumentTimelineMap.tsx` | **PINNED** | Map lens unchanged this card (marker pins on the map are a follow-up / MARK-003). |
| `src/features/arguments/railActionCategories.ts` | **PINNED** (treat as) | No new rail action code; the "Respond to this" affordance is an additive flag-gated element, not a rail action. |

**Additive-precedent seams (edited, but flag-off byte-identical):** the ROOM-003 bar
(`composer/ArgumentEntryComposer.tsx` + `composer/argumentEntryComposerModel.ts` +
`composer/useEntryComposerSubmit.ts`), `room/RingsideCard.tsx`, `room/RingsideFeed.tsx`,
`room/ArgumentRoom.tsx`, and `App.tsx`. Each addition is an optional prop that, when
absent (flag OFF), yields the current render/behavior exactly.

---

## Data model

### Migration `supabase/migrations/20260711000002_mark_002_marker_reply_ref.sql`

Timestamp strictly after the highest applied (`20260711000001`, MARK-001 — confirmed on
disk). **One additive `ALTER` + one partial index + one comment. No RLS change.** Written
verbatim (the migration-bearing OPS-001 heightened-review precedent).

```sql
-- ============================================================
-- Migration: 20260711000002_mark_002_marker_reply_ref
-- Card: MARK-002 (#894) — timestamp_markers.reply_argument_id (MARKER-SIDE reply link).
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-4, Phase P3.5).
-- Canonical spec: Design Pass Output 8 (rebuttal reference) adapted MARKER-SIDE because
--   submit-argument is pinned (cannot thread arguments.target_marker_id at insert) and
--   the issue prefers marker-side linkage / no arguments-table migration. Design:
--   docs/designs/MARK-002.md (Linkage reality audit).
--
-- Write posture: timestamp_markers stays SELECT-only (MARK-001). reply_argument_id is
--   written ONLY by the create-marker service-role Edge (#894), which mints the marker
--   and links it to the callers OWN reply atomically. This migration adds NO write
--   policy, NO trigger, NO function.
--
-- Sequential after 20260711000001_mark_001_timestamp_markers.sql (highest applied).
--
-- -- What this migration does (strictly additive) --------------
--   1. ALTERs public.timestamp_markers to ADD reply_argument_id uuid NULL references
--      public.arguments(id) on delete set null. Marker-side linkage: the marker row
--      optionally records WHICH reply consumed it. One marker row then serves BOTH
--      TimestampMarker placements -- target_argument_id drives the source-span
--      highlight, reply_argument_id drives the reply reference chip.
--   2. Adds a partial index on reply_argument_id (only the rare marker-bearing replies).
--   ZERO existing rows touched (timestamp_markers ships EMPTY from MARK-001); ZERO
--   objects dropped or edited; NO read-path change; NO RLS policy change.
--
-- -- Why no RLS change is safe --------------------------------
--   A marker is visible iff its target_argument_id is room-visible (the shipped
--   timestamp_markers_select_room_visible policy, via is_argument_visible_in_circle).
--   create-marker enforces that reply_argument_id is the callers OWN reply in the SAME
--   debate, so any viewer who can see the marker (target visible) can also see the reply
--   (same room). reply_argument_id introduces NO new leak surface -> the SELECT policy is
--   unchanged.
--
-- -- OPS-001 four-class compliance (Docker-less heightened review) --
--   Class 1 (ambiguous column): no policy body added/changed; no subquery. N/A.
--   Class 2 (type mismatch): reply_argument_id uuid -> arguments.id uuid. No text<->uuid.
--   Class 3 (statement order): single ALTER ADD COLUMN whose FK target (arguments)
--     pre-exists; index + comment reference the just-added column. No forward ref, no
--     drop, no RLS toggle.
--   Class 4 (function/extension deps): creates no function, no extension, no grant. The
--     FK target public.arguments pre-exists (initial_schema). No COMMENT on storage.*.
--
-- -- Doctrine encoded ----------------------------------------
--   - Quote the point, never judge it (cdiscourse-doctrine 1): reply_argument_id is a
--     pure structural reference; no verdict, no score, no popularity/engagement column.
--   - Never hard-deleted (MARK-001 deleted_at): on delete set null is a safety net only
--     (arguments soft-delete via status='deleted', never hard-delete), so it never fires
--     in the normal lifecycle; the marker + quoted_text survive regardless.
--   - RLS stays ENABLED; nothing disabled (cdiscourse-doctrine 8).
-- ============================================================

alter table public.timestamp_markers
  add column if not exists reply_argument_id uuid references public.arguments(id) on delete set null;

create index if not exists timestamp_markers_reply_argument
  on public.timestamp_markers (reply_argument_id)
  where reply_argument_id is not null and deleted_at is null;

comment on column public.timestamp_markers.reply_argument_id is
  'MARK-002 (#894): optional FK to the reply argument that consumed this marker (the callers OWN reply in the J6 text-half). Marker-side linkage: the reply carries the marker chip (grouped by reply_argument_id) while target_argument_id carries the source-span highlight -- one marker row, both placements. Written ONLY by the create-marker service-role Edge (timestamp_markers is SELECT-only). Nullable (a standalone note marker has no reply). on delete set null (arguments soft-delete, never hard-delete; safety net only). NO RLS change: visibility flows through target_argument_id via the shipped timestamp_markers_select_room_visible policy.';
```

### TypeScript surfaces (new)

```ts
// src/features/arguments/markers/timestampMarkerModel.ts  (PURE TS — no React/Supabase)
export interface MarkerRow {            // the SELECT-shaped row from useMarkers
  id: string; debate_id: string; target_argument_id: string;
  reply_argument_id: string | null; created_by: string; kind: 'rebuttal_anchor' | 'note';
  span_start: number; span_end: number; span_unit: 'chars';
  quoted_text: string; created_at: string; deleted_at: string | null;
}
export type MarkerPlacement = 'source_span' | 'reply_reference' | 'composer_scope';
export type MarkerState = 'live' | 'orphaned';  // orphaned = target soft-deleted (tombstone)
export interface TimestampMarkerViewModel {
  id: string; targetArgumentId: string; replyArgumentId: string | null;
  kind: 'rebuttal_anchor' | 'note'; spanStart: number; spanEnd: number;
  quotedText: string; state: MarkerState;
}
export interface PendingMarkerScope {   // client-only during composition (no row yet)
  targetArgumentId: string; spanStart: number; spanEnd: number; quote: string;
}
export interface PhraseSpan { text: string; start: number; end: number; }

export function segmentPhrases(body: string): PhraseSpan[];
export function buildTimestampMarker(row: MarkerRow, opts: { targetExists: boolean }): TimestampMarkerViewModel;
export function groupMarkersByTarget(rows: readonly MarkerRow[]): Record<string, MarkerRow[]>;
export function groupMarkersByReply(rows: readonly MarkerRow[]): Record<string, MarkerRow[]>;
export function buildSourceSpanSegments(body: string, m: { spanStart: number; spanEnd: number }):
  { before: string; marked: string; after: string } | null;  // null if offsets no longer index body (drift)
export function formatMarkerChipLabel(quotedText: string): string;  // truncate + quote-wrap
```

---

## API / interface contracts

- **`src/lib/edgeFunctions.ts`** — add (mirroring `attachProof`):
  ```ts
  export interface CreateMarkerPayload { action: 'mint'; debateId: string; targetArgumentId: string;
    spanStart: number; spanEnd: number; quote: string; kind: 'rebuttal_anchor' | 'note'; replyArgumentId?: string; }
  export interface CreatedMarker { id: string; debateId: string; targetArgumentId: string;
    replyArgumentId: string | null; kind: 'rebuttal_anchor' | 'note'; spanStart: number; spanEnd: number;
    spanUnit: 'chars'; quotedText: string; createdAt: string; }
  export interface CreateMarkerSuccess { ok: true; idempotent: boolean; marker: CreatedMarker; }
  export type CreateMarkerOutcome =
    | { ok: true; data: CreateMarkerSuccess }
    | { ok: false; error: { error: string; message?: string }; status: number };
  export async function createMarker(payload: CreateMarkerPayload): Promise<CreateMarkerOutcome>;
  ```
- **`src/features/arguments/markers/createMarkerApi.ts`** — the narrow wrapper (the
  `attachProofApi` seam): `createMarkerScoped(input): Promise<{ ok; marker?; errorCode?; errorMessage? }>`
  mapping the reconciled error codes (`target_not_found` / `not_a_participant` /
  `debate_argument_mismatch` / `span_out_of_bounds` / `span_too_long` / `quote_mismatch`
  / `reply_not_found` / `not_your_reply` / `marker_cap_reached` / `network_error` /
  `unknown`) to plain-language strings (never the raw code).
- **`src/features/arguments/markers/useMarkers.ts`** — the read hook (the `useProofItems`
  precedent): `useMarkers(debateId, argumentIds, enabled) → { markersByTargetId,
  markersByReplyId, refetch }`. RLS-scoped anon+JWT read of `timestamp_markers` (the
  shipped SELECT policy); `enabled === false` ⇒ no fetch ⇒ `{}` ⇒ byte-identical.
- **`ArgumentRoom` prop (additive optional):** `timestampRebuttalsEnabled?: boolean` (the
  `proofDrawerEnabled` precedent). Plus internal `scopedMarker` state + handlers.
- **`ArgumentEntryComposer` props (additive optional):** `scopedMarker?: PendingMarkerScope
  | null`, `onClearScopedMarker?: () => void`; `onSubmitSuccess` signature widened to
  `(newArgumentId?: string) => void` (additive — existing callers ignore it;
  `useEntryComposerSubmit` surfaces `(result.data.argument as {id?: string}).id`).
- **`RingsideCard` props (additive optional):** `markersForCard?: MarkerRow[]`
  (source-span highlight + reply chips), `onRespondToThis?: (messageId: string) => void`,
  `onOpenMarkerSource?: (targetArgumentId: string, markerId: string) => void`.

---

## Component spec

A11y floors (`accessibility-targets` + Design Pass Output 6): chips **min height 32px +
`hitSlop`** to reach the 44×44 target; action affordances 44×44; `accessibilityRole` +
`accessibilityLabel` + `accessibilityState` on every Pressable; **color never the only
signal** (every chip pairs an icon/glyph + text; the source-span highlight pairs a tint
with an underline/left-marker so it reads in grayscale); reduce-motion parity (the
Ringside feed is transform-free by construction — no motion to gate; the picker sheet uses
no non-essential animation).

- **`TimestampMarker.tsx`** — one component, `placement` prop.
  - `source_span`: renders inside the target card body as `before` + `<Text
    style=marked>` + `after` (from `buildSourceSpanSegments`). The `marked` run carries a
    tint **and** a non-color cue (underline or a leading `“` glyph). Not itself pressable;
    the card's deep-link activates + scrolls to it.
  - `reply_reference`: a Pressable chip `“…quoted words…” ›` (`formatMarkerChipLabel`,
    single line, wraps to the chip). `accessibilityRole="button"`,
    `accessibilityLabel="Go to the quoted phrase in <actor>'s move"`, `hitSlop` to 44px.
    Tap → `onOpenMarkerSource(targetArgumentId, id)`.
  - `composer_scope`: the chip in the ROOM-003 bar context slot — `“…quoted words…”` + a
    ✕ clear (`onClearScopedMarker`, 44px hitSlop, `accessibilityLabel="Clear the quoted
    phrase"`).
  - `orphaned` state (target soft-deleted): renders a calm tombstone chip ("Quoted move
    was removed") — still shows `quotedText` (the durable artifact), deep-link disabled.
- **`MarkerPhrasePickerSheet.tsx`** — a bottom sheet (`<720px`) / side sheet (`≥720px`)
  listing `segmentPhrases(targetBody)` as ≥44px rows. `accessibilityRole="button"` per
  row, `accessibilityLabel="Quote: <phrase>"`; a header "Pick a phrase to respond to";
  cancel affordance. On select → `onPick({ spanStart, spanEnd, quote })`. Empty body ⇒
  single "Whole move" row (span = full body).
- **"Respond to this" affordance** — a flag-gated Pressable on **non-own** RingsideCards
  (own bubbles never expose it — you cannot rebut yourself; consistent with the actor-aware
  control contract). `accessibilityLabel="Respond to a phrase of this move"`. Opens the
  picker.

---

## Copy plan

All strings in `src/features/arguments/markers/markerCopy.ts`, ban-list asserted. Markers
describe the **moment**, never the person; comments in scanned files are apostrophe-free
(the `uxOneOneTwoDoctrine` quote-parity gotcha).

- Affordance: `Respond to this` · picker header: `Pick a phrase to respond to` · picker
  cancel: `Cancel`.
- Composer scope chip prefix: none — the chip is just the quoted phrase + ✕. Composer bar
  context label when scoped: `Quoting: “…”`.
- Reply chip: `“<phrase>” ›` (quoted phrase + a forward chevron for "go to source").
- Orphaned: `Quoted move was removed` (no verdict; states the fact of removal).
- Error copy (plain-language, per reconciled code): e.g. `quote_mismatch` →
  "That phrase does not match the move any more — pick it again."; `marker_cap_reached` →
  "You have marked the most phrases you can on this move."; `not_a_participant` →
  "Join this room to quote a phrase."; `not_your_reply` → "You can only add a quote to
  your own reply."
- **Choke points:** every internal code stays out of UI (map through `markerCopy`; unknown
  → fallback, never echoed — `gameCopy` discipline). No verdict/person tokens anywhere
  (`winner/loser/liar/true/false/correct/dishonest/bad faith/...`).

---

## Edge cases

- **Fabricated quote** (client `quote` ≠ `body[span_start:span_end]`) → 422
  `quote_mismatch`; nothing minted (the AC + Q5).
- **Body drift** (offsets no longer index the same text) → also `quote_mismatch` (safe
  fail; MARK-001 durability hole). On the read side, `buildSourceSpanSegments` returns
  `null` if a stored marker's offsets no longer fit the body → the chip renders without
  the highlight but still resolves via `quotedText` (Q5 self-sufficiency).
- **Empty / inverted / zero-length span** → schema (`spanEnd` positive) + guard 8 +
  the DB `CHECK (span_end > span_start)` — three layers.
- **Span out of bounds** (`spanEnd > body.length`) → 400 `span_out_of_bounds`.
- **Span too long** (`> MARKER_QUOTE_MAX`) → 400 `span_too_long` (prevents whole-essay
  "quotes").
- **Target soft-deleted** (`status='deleted'`) between pick and mint → guard 6's
  caller-scoped read: a non-author no longer sees it → 404 `target_not_found`; the author
  still sees it (author arm ignores status) and may mint — the read side then renders the
  `orphaned` chip for non-authors. No data-layer failure.
- **Reply not owned by caller** → 403 `not_your_reply` (you cannot chip someone else's
  move).
- **Reply already linked** (retry / double-tap) → returns the existing marker
  `{ idempotent: true }`; no duplicate.
- **Cross-room** (`targetArgumentId` or `replyArgumentId` in another debate) → 400
  `debate_argument_mismatch` / `debate_reply_mismatch`.
- **Cap reached** → 409 `marker_cap_reached`.
- **Mint fails after a successful post** (network) → the reply is already posted; the UI
  surfaces the plain error and the reply simply shows no chip (score/post never blocked).
  Retry re-mints (idempotent on `reply_argument_id`).
- **Offline** → `createMarker` never throws (the `attachProof` idiom); returns
  `network_error`; graceful.
- **Flag OFF** → no affordance, no picker, no fetch, no chip; the marker-bearing rows (if
  any exist from an earlier ON window) are simply not read — the surface is unchanged.
- **Doctrine edge:** *what if a marker tries to imply the person is wrong?* — it cannot; a
  marker carries only a span + verbatim quote + `kind ∈ (rebuttal_anchor, note)`; no
  verdict field exists. *What if heat/popularity influenced anything?* — the table is
  inert storage; no score/engagement column; `create-marker` emits no point-standing
  delta.

---

## Test plan

Baseline (issue-provided): **961 suites / 33,797 tests** — the implementer captures the
live `Test Suites: … / Tests: …` line + exit 0 before and after, and cross-checks
`current-status.md` H2 against `docs/reviews/MARK-002-review.md` (POSTRUN-UX001 lesson).
**Expected delta: ≈ +9–11 suites, ≈ +120–160 tests.** Every safety scan is paired with a
**negative control** that plants the violation (a scan that cannot fail is not a test).

- **`__tests__/markerReplyRefMigrationScan.test.ts`** — `fs.readFileSync` over the
  migration (mirror `timestampMarkersRlsScan.test.ts`): presence + numbering (`>
  20260711000001`); strictly additive (the ONLY `alter table` is `add column
  reply_argument_id`; no `drop table/column/constraint`, no `disable row level security`)
  + negative control; **no new policy / trigger / function** (SELECT-only posture
  preserved) + negative control; `reply_argument_id` declared `uuid references
  public.arguments(id) on delete set null`, nullable; partial index present; **still
  deferred** — `'ms'` absent from any `span_unit` CHANGE, `recording_id` absent, no
  `proof_items.kind` widening + negative controls; Class 1–4 assertions; doctrine ban-list
  over the migration text.
- **`__tests__/createMarkerContract.test.ts`** — imports `_shared/markerCreate.ts`:
  `verifyMarkerSpan` (in-bounds / out-of-bounds / inverted / too-long), `verifyQuoteMatch`
  (exact match, mismatch, whitespace-sensitivity), `sliceQuote`, kind vocabulary
  (`rebuttal_anchor`/`note`; `proof_excerpt` absent), cap constant, no verdict token in any
  exported string.
- **`__tests__/createMarkerEdge.test.ts`** — source-scan of `create-marker/index.ts`: no
  `Authorization` / `SERVICE_ROLE` / `quoted_text` logging; `.strict()` schema present; the
  12-guard ladder present (each honest code); **`quoted_text` is set to the server slice,
  never `body.quote`** (assert the insert payload reads the server variable, not the
  request field); no client-supplied `quotedText`/`spanUnit`/`createdBy`/`recordingId`
  accepted; `_shared` imports only.
- **Config registration** — the shipped `supabaseFunctionsConfigRegistration.test.ts`
  **auto-fails** unless `[functions.create-marker]` is added (the forcing function for the
  #509 hazard). Add a focused assertion `create-marker` is registered `verify_jwt = true`.
- **`__tests__/timestampMarkerModel.test.ts`** — `segmentPhrases` (offsets exact, empty
  body, trailing punctuation), `buildSourceSpanSegments` (match, drift → null),
  `groupMarkersByTarget`/`ByReply`, `formatMarkerChipLabel` truncation, `buildTimestampMarker`
  state (live / orphaned). 100% public-function coverage (pure-model bar).
- **`__tests__/timestampMarker.test.tsx`** (RNTL) — three placements render; chip ≥32px +
  hitSlop; role/label/state; grayscale legibility (highlight has a non-color cue); orphaned
  tombstone; reduce-motion no-op.
- **`__tests__/markerPhrasePickerSheet.test.tsx`** — rows ≥44px, select emits
  `{spanStart, spanEnd, quote}` from the exact body slice, a11y labels, cancel, empty-body
  "Whole move" row.
- **`__tests__/createMarkerApi.test.ts`** — plain-language mapping for every reconciled
  code; `network_error` path; never echoes a raw code.
- **`__tests__/useMarkers.test.ts`** — `enabled=false` ⇒ no fetch ⇒ `{}`; grouped output.
- **`__tests__/markJ6TextFlow.test.tsx` (ACCEPTANCE)** — the full J6 text half with a
  mocked Edge: open non-own card → "Respond to this" → pick a phrase → composer scoped
  (composer_scope chip) → Send → `create-marker` called with the new reply id + verified
  quote → reply card shows the `reply_reference` chip → tap → source card highlights the
  span. Plus the **fabricated-quote rejection** path (mock Edge returns `quote_mismatch`;
  no chip).
- **`__tests__/markerFlagOff.test.tsx` (BYTE-IDENTITY)** — with `timestamp_rebuttals` OFF:
  `RingsideCard`, `ArgumentEntryComposer`, and `ArgumentRoom` render identically to the
  pre-card snapshot (no affordance, no chip, no fetch); assert the pinned files appear in no
  diff (a `git`-free structural assertion: the flag-off render tree matches the shipped
  baseline).
- **`__tests__/markerCopyBanList.test.ts`** — every `markerCopy` string is verdict/person
  token-free.

No Docker DB reset available — the migration's chokepoint contract is the scan suite +
the OPS-001 heightened four-class review (the SQL is verbatim above). Edge behavior is
covered by the contract (pure) + source-scan tests; a live `supabase functions serve`
integration pass is an operator follow-up (documented, not silently skipped).

---

## Dependencies (cards / docs / files)

- **Assumes MARK-001 (#893, merged `20260711000001`)** — `timestamp_markers` exists,
  SELECT-only, with `quoted_text NOT NULL` as the durable artifact and the write posture
  ("all writes via the MARK-002 Edge") this card fulfils. This card ALTERs that table.
- **Assumes ROOM-002 (#885)** — `RingsideCard` / `RingsideFeed` (the additive seam for
  the affordance + chips) and **ROOM-003 (#829)** — `ArgumentEntryComposer` +
  `argumentEntryComposerModel` + `useEntryComposerSubmit` (the context-chip seam + the
  submit-success id surfacing).
- **Assumes PROOF-002/003 (#889/#890)** — the `useProofItems` / `attachProofApi` /
  `attach-proof` house shapes this card mirrors (read hook, client wrapper, Edge guard
  ladder, config registration parity test).
- **Assumes ASP-FLAGS-001 (#873)** — `isTimestampRebuttalsEnabled()` (shipped, OFF).
- **Assumes the circles/COV-004 helper chain** — unchanged; the SELECT policy this card
  leaves intact composes through `is_argument_visible_in_circle`.
- **Reads** `supabase/functions/_shared/{http,supabaseClients,proofAttach}.ts`,
  `attach-proof/index.ts`, `supabaseFunctionsConfigRegistration.test.ts`,
  `src/lib/edgeFunctions.ts` (attachProof section), `useProofItems.ts` — the mirrored
  precedents.
- **Blocks MARK-003** (waveform region-select twin; adds `ms` `span_unit` + `recording_id`
  in P5, and marker pins on the Map). This card's chip + model + Edge are the surface
  MARK-003 extends.

---

## Risks

- **The linkage call is the top risk.** If the operator prefers the verbatim Design Pass
  `arguments.target_marker_id`, the reply-linkage moves to an arguments-table ALTER + a
  service-role UPDATE path to the sacred table. This design recommends the marker-side
  column precisely to avoid that; the trade is in the ledger for operator ratification.
- **Migration on a one-commit-old table.** MARK-001 shipped `timestamp_markers` yesterday;
  ALTERing it now is correct append-only discipline (new file, never edit) but the reviewer
  should confirm `20260711000002 > 20260711000001` at build time and that the ALTER is
  metadata-only (nullable, empty table → instant).
- **#509 hazard.** Forgetting `[functions.create-marker]` in `config.toml` means the Edge
  silently never deploys. Mitigation: the shipped registration-parity test auto-fails; the
  design makes the block verbatim.
- **Gesture feasibility.** The phrase-picker is the honest, cross-platform v1; free
  selection is deferred. Risk = users expect free selection. Mitigation: server verifies
  any span, so a later free-selection gesture is a pure client add with no Edge change.
- **Q5 misrepresentation residual.** A single sentence can still strip context. Mitigated
  in-design: `quoted_text` is verbatim (not editable), the reply chip always deep-links to
  the **full body** with the span highlighted (not the span in isolation), and the picker
  operates at sentence granularity (not sub-phrase). Residual risk accepted + documented
  (Design Pass Output 13 Q5).
- **Post-submit mint ordering.** The reply exists before the marker links to it; a mint
  failure leaves a chip-less reply. Acceptable (post never blocked); retry is idempotent.
- **Flag-off byte-identity across five seams.** Each seam's addition must be strictly
  optional-prop-gated. The `markerFlagOff` test + the pin-inventory zero-diff assertions
  are the guardrails.
- **Stale test baseline.** The issue baseline (961/33,797) may differ from the live
  count; the implementer captures live and the reviewer cross-checks the H2 vs the review
  file.

---

## Out of scope

- No waveform / voice / audio (MARK-003, P5). No `ms` `span_unit`, no `recording_id`.
- No `proof_items.kind` widening; no marker-bearing proof rows (Linkage option B rejected).
- No `arguments` ALTER; no `arguments.target_marker_id`; no `submit-argument` edit.
- No marker retraction UI (the `deleted_at` column exists; exposing retract is a follow-up).
- No standalone-note authoring flow (v1 mints markers only in the rebuttal path;
  `kind='note'` is schema-supported but not UI-surfaced this card).
- No Map-lens marker pins (follow-up / MARK-003).
- No multi-span / paragraph / word-level selection (v1 = one sentence-ish phrase).
- No point-standing / anti-amplification change (inert storage; no score delta).
- No v1-scope violation (no voting, search, push, OAuth, public API).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** a marker is a
  span + verbatim quote + verdict-free `kind`; no score, no verdict, no truth label;
  minting never gates `submit-argument`; a mint failure never blocks the reply.
- **§1–3 (heat / popularity):** the table is inert storage — no engagement/popularity
  column, no point-standing delta, no heat write.
- **§4 (AI limits):** no AI, no classifier, no network AI call anywhere in this card.
- **§6–7 (secrets / no AI calls in app):** the Edge keeps the service-role key
  server-side; never logs Authorization / service-role / `quoted_text`; the production app
  makes no AI provider call; `grep SERVICE_ROLE app/ src/` stays zero.
- **§8 (Supabase conventions):** RLS stays ENABLED (unchanged); new (never-edited)
  migration; markers never hard-deleted (`deleted_at`); no direct client write to
  `timestamp_markers` (SELECT-only; the Edge is the sole writer); no direct client insert
  to `arguments` (submit-argument untouched).
- **§10a (Observations vs Allegations):** a marker is a **user-generated quote-selection**
  (the author marks a phrase) — it carries the quote, never a machine classification and
  never a claim about a person; the chip copy describes the moment, never the person.
- **supabase-edge-contract:** the standard Edge shape (CORS → JWT → caller-scoped
  no-oracle reads → narrowest service-role write → stable `{error,message}` responses);
  server-side quote verification is the privileged operation a client INSERT cannot do
  (the reason MARK-001 is SELECT-only); config.toml registration in the same PR (the #509
  guard).
- **evidence-doctrine:** engagement credit vs factual standing untouched; a marker grants
  no standing; `quoted_text` is a verbatim snapshot, never proof-of-truth.
- **expo-rn-patterns / accessibility-targets:** RN primitives only (no new dep); chips
  32px + hitSlop → 44px; color never the only signal (highlight + non-color cue); roles /
  labels / states on every Pressable; reduce-motion parity (transform-free).

---

## Rollout / Operator steps

1. **Merge → auto-deploy + auto-apply.** The Supabase GitHub integration (a) applies
   `20260711000002_mark_002_marker_reply_ref.sql` and (b) deploys `create-marker`
   (config.toml-registered) on merge to `main`. **Merge = deploy** for both — the migration
   and the Edge go live together, before any UI (the flag stays OFF).
2. **Post-merge verification (linked DB):**
   ```
   npx supabase db query --linked "select column_name from information_schema.columns where table_name='timestamp_markers' and column_name='reply_argument_id';"
   npx supabase functions list --linked   # expect create-marker present
   ```
3. **The visual ships later.** `timestamp_rebuttals` stays **OFF**; the chip + gesture ship
   dark. A later `netlify-prod` push + a strict flag flip (with the bundle-hash poll)
   surfaces the UI. Do **not** flip the flag in this card.
4. **Rollback honesty.** Merge = deploy; revert-merge does **not** un-apply the migration
   or un-deploy the Edge. The column is nullable + all-NULL and the Edge writes only when
   invoked (flag OFF ⇒ never invoked), so leaving both in place after a revert is harmless.
   A true removal is a forward-drop migration (`alter table public.timestamp_markers drop
   column reply_argument_id;`) + `npx supabase functions delete create-marker --linked` —
   never an edit to the applied file.

---

## Orchestrator-authored brief ledger

Authored against orchestrator-relayed issue #894, not a hand-validated operator brief.

- **From the binding issue (#894):** scope (create-marker Edge + TimestampMarker chip +
  scoped reply, text-first), the two delegated decisions (reply linkage + v1 gesture), the
  deploy-bearing #509 registration requirement, the server-snapshotted quote + fabricated-
  quote acceptance criteria, the flag-off byte-identity + pin inventory, the "prefer
  marker-side linkage / no arguments-table migration" guidance.
- **From Design Pass Output 4 J6 / Output 6 (TimestampMarker + RebuttalComposer) / Output
  8 / Output 13 Q5 (operator-reviewed 2026-07-04):** the three-placement chip semantics,
  the "one gesture one chip" scope, the Q5 verbatim-snapshot + full-context deep-link
  mitigation, the marker view-model shape.
- **From the shipped-precedent survey (this session):** MARK-001's SELECT-only posture +
  `quoted_text`-durable doctrine + the `timestampMarkersRlsScan` pattern; the `attach-proof`
  Edge guard ladder + `_shared/proofAttach.ts` contract module + `attachProofApi` /
  `useProofItems` seams; the `supabaseFunctionsConfigRegistration` parity guard; the
  `ArgumentEntryComposer` context-chip + `useEntryComposerSubmit` success payload; the
  `App.tsx`-sole-importer flag-threading pattern (`proofDrawerEnabled` / `roomExchangeV2Enabled`).
- **Resolved by orchestrator/designer default (flag for operator review):**
  (a) **Linkage = `timestamp_markers.reply_argument_id`** (marker-side column) over
  `arguments.target_marker_id` and over a `reply_marker_refs` join table — chosen for
  1:1 fidelity, zero arguments-table impact, and the issue's stated preference (§Linkage
  audit). (b) **Gesture = deterministic phrase-picker (sentence granularity, single span)**
  over free text selection — chosen for cross-platform robustness (§Gesture audit). (c)
  **Post-submit mint (atomic mint+link, no orphans)** over mint-at-select. (d) Caps
  `MARKERS_PER_TARGET_PER_USER = 20`, `MARKER_QUOTE_MAX = 2000` (Q9 spirit; operator may
  tune). (e) `kind` v1 = `rebuttal_anchor` only surfaced in UI (`note` schema-supported,
  not authored).
- **Operator-deferred review:** the **linkage shape** is the one place a product call
  could differ — if the operator insists on the verbatim Design Pass `arguments.target_marker_id`,
  swap the migration for an `arguments` ALTER and add a service-role UPDATE-arguments path
  to `create-marker` (against the issue's "prefer marker-side" instruction and adding a
  write path to the sacred table). This design recommends marker-side; the operator should
  confirm before implementation. Everything else (Edge contract, gesture, chip, flag
  wiring) is unchanged either way.
