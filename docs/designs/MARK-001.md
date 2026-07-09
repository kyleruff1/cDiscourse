# MARK-001 — timestamp_markers table + proof_items.marker_id (migration, text-first)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — markers backend lane (M-ASP-4, Phase P3.5)
**Release:** M-ASP-4
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/893
**Migration-bearing:** yes — merge auto-applies (Supabase GitHub integration). Docker unavailable ⇒ reviewer runs the OPS-001 heightened four-issue-class textual review. The migration SQL is written **verbatim** below (the #888 / #882 precedent) so the review is trivially auditable.

---

## Problem & scope

Design Pass principle 7 — **"Quote moments, not messages."** The P3.5 sequencing
amendment advances the **text half** of the marker system ahead of any audio:
selecting a phrase of a posted argument creates a durable marker (a span + a
verbatim `quoted_text` snapshot); a reply carries the marker chip and deep-links
back to the moment. The table must serve **text spans now** (char offsets against
`arguments.body`) and **voice timestamps later** (ms spans, P5) **without a second
reshape**. PROOF-001 (#888) explicitly deferred `proof_items.marker_id` to this
card so the FK ships with real referential integrity from day one.

This card ships **only the data layer**:

- One additive migration creating **one** new, RLS-enabled, **empty** table
  `timestamp_markers` (Design Pass Output 8 adapted text-first).
- An `ALTER public.proof_items ADD marker_id` FK → `timestamp_markers(id)` (the
  PROOF-001 deferral, honored; nullable, indexed; **no** `proof_items.kind`
  widening).
- The `#882`/`#888` house RLS scan suite (policy presence, additive-only,
  negative controls).

The design is shaped by three doctrine constraints: **markers quote the point,
never judge it** (`cdiscourse-doctrine §1` — a marker carries a span + a verbatim
quote, no verdict, no score); **`quoted_text` is a verbatim snapshot, not
editable** (Design Pass Output 13 Q5 misrepresentation mitigation — which is the
decisive reason the write is SELECT-only + Edge, see §Design decision 3); and
**RLS is on everywhere and never over-permissive** (`supabase-edge-contract §4` —
the over-permissive-INSERT failure mode is the single biggest risk on a new-table
migration, so this card ships **no** write policy at all).

**Non-goals (this card):** no Edge Function (MARK-002), no UI, no
waveform/voice columns activated (P5 widens `span_unit`), no `recording_id` (P5),
no markers-on-JSONB back-fill, no read-path change, no `proof_items.kind`
widening.

---

## Target-body durability audit (load-bearing)

A char-offset span is only as durable as the text it indexes into. This audit is
the load-bearing justification for the span shape (§Decision 1) and the
`quoted_text NOT NULL` rule. **Every claim is grounded in a file read.**

### 1. `arguments.body` is written exactly once, at INSERT

- Column: `public.arguments.body text NOT NULL DEFAULT ''`
  (`20260516000001_initial_schema.sql:191`).
- Soft-delete is a **status change**, not a row delete:
  `status text CHECK (status IN ('draft','posted','hidden','deleted'))`
  (`initial_schema.sql:193-194`); table comment: *"Soft-delete via status =
  deleted"* (`initial_schema.sql:205`). There is no `is_deleted` / `deleted_at`
  column on `arguments` — the tombstone is `status='deleted'`.
- The **only** `.update()` on `public.arguments` anywhere in `supabase/functions/`
  is `status: 'deleted'` — a soft-rollback / soft-delete used for move
  atomicity (`submit-argument/index.ts:412,433,452,456,475,500,511,524,553`).
  **No statement anywhere writes `body` after INSERT.**
- `src/features/arguments/argumentsApi.ts` contains **zero** `.update()` calls
  (four `.from('arguments')` sites, all reads/insert). No client body-edit path.
- Stage 6.1.8 removed body-editing from the UI entirely: own bubbles expose only
  `view_qualifiers` + `request_deletion`; *"updating title never mutates
  `public.arguments.body`"* (CLAUDE.md stage history). Design Pass §Preserve
  names **"Immutable bodies, soft-delete, deletion-request workflow"** as
  load-bearing to preserve.

### 2. The one hole, stated honestly

The RLS policy `"arguments: authors update own; mods update any"`
(`20260516000002_rls_policies.sql:233-237`) is a broad `FOR UPDATE` with
`WITH CHECK (author_id = auth.uid() OR is_moderator_or_admin())` and **no
column restriction** — its own comment says *"e.g. draft → posted, body edit"*
(`rls_policies.sql:209`). So an author **could** issue a raw PostgREST `PATCH`
that rewrites their own `body`, bypassing the (absent) UI. **Body immutability is
enforced by the absence of an edit path + doctrine, not by a DB guard.** Char
offsets are therefore durable **in practice** but **not DB-guaranteed**.

### 3. Why the design does not depend on offset durability — `quoted_text`

The marker's correctness **never depends on span-offset stability**. `quoted_text`
is a **verbatim server snapshot** taken at creation (by the MARK-002 Edge, reading
`arguments.body` server-side). It is the **durable artifact**:

- It survives a body edit (the hole above), an argument soft-delete
  (`status='deleted'`), and — in P5 — audio deletion. This is the **same
  self-sufficiency logic the Design Pass mandates for the voice lane**: *"quoted_text
  makes markers self-sufficient after audio deletion"* (Output 8) and *"after the
  recording is gone the chip still resolves to the transcript span"* (J6).
- The span offsets are **advisory locators** for highlight/scroll, consumed by
  MARK-002. If the body ever drifts, MARK-002 re-anchors by searching for
  `quoted_text`, or degrades to a non-highlight chip (the Design Pass §6
  `TimestampMarker` `audio-gone` / `orphaned` states). That is MARK-002's concern;
  this card's contract is only that `quoted_text` is present and verbatim.

**Conclusion:** `quoted_text` is `NOT NULL` and is the source of truth; the span is
a locator. This makes the char-span lane safe to ship **before** any body-immutability
DB guard exists, and makes the P5 ms-span lane a pure `span_unit` widening.

---

## Data model

One new table + one column added to an existing table. All identifiers and the
`kind` / `span_unit` vocabularies are **internal** (never rendered raw — MARK-002
maps them through gameCopy). `timestamp_markers` / `marker` are internal names,
exempt from the box-copy ban-list; user-facing copy is MARK-002's concern.

### `public.timestamp_markers` — the quote-a-moment record (text-first)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | pgcrypto (Supabase default; documented, not `create extension`-ed — the #859 / PROOF-001 precedent) |
| `debate_id` | `uuid` NOT NULL → `public.debates(id)` on delete cascade | room scope; every marker belongs to exactly one room (room-prefixed indexing / purge, per Design Pass Output 8) |
| `target_argument_id` | `uuid` NOT NULL → `public.arguments(id)` on delete cascade | the argument whose body this marker quotes; `on delete cascade` is a referential safety net only (arguments soft-delete, never hard-delete) |
| `created_by` | `uuid` NOT NULL → `public.profiles(id)` on delete cascade | attribution (`profiles.id = auth.uid()` in this repo; the `arguments.author_id → profiles(id)` house convention) |
| `kind` | `text` NOT NULL, CHECK ∈ `('rebuttal_anchor','note')` | text-first marker kinds; `proof_excerpt` **deferred** (§Decision 2b) |
| `span_start` | `int` NOT NULL | offset into the target; char index now, ms in P5 (`int` covers both) |
| `span_end` | `int` NOT NULL | end offset; `CHECK (span_end > span_start)` (non-empty span) |
| `span_unit` | `text` NOT NULL default `'chars'`, CHECK ∈ `('chars')` | the lane discriminator; **P5 widens this CHECK to add `'ms'`** — a one-line follow-up, never a reshape |
| `quoted_text` | `text` **NOT NULL** | verbatim server snapshot of the span; the **durable artifact** (see durability audit); self-sufficient forever |
| `created_at` | `timestamptz` NOT NULL default `now()` | |
| `deleted_at` | `timestamptz` NULL | soft-delete tombstone (never hard-deleted); consumed **now** by the SELECT policy's `deleted_at is null` filter |

**Deliberately ABSENT until P5 (§Decision 1):** `recording_id uuid →
audio_submissions(id)`. The audio FK has **no producer** this card (no voice flow
until P4/P5) and the `audio_submissions` voice columns don't exist yet — shipping
it now is an always-NULL column referencing a table with no relevant rows. The
**same "defer the column WITH the lane it serves" logic PROOF-001 applied to
`marker_id`.** P5 (`voice-004-waveform-markers`) adds `recording_id` alongside
`transcript_segments` / `WaveformTimeline`.

### `public.proof_items.marker_id` — the PROOF-001 deferred FK

| Column | Type | Notes |
|---|---|---|
| `marker_id` | `uuid` NULL → `public.timestamp_markers(id)` on delete set null | added to the **existing** `proof_items` table; the target now exists (created above); populated only by future voice-proof kinds — no producer this card |

### TypeScript surface — none new

MARK-001 adds **no** production TS. MARK-002 (the marker UI/Edge) introduces the
`TimestampMarker` view-model (Design Pass Output 6). This card writes zero
production TS — one migration + one scan suite + doc/status updates.

---

## The migration SQL (verbatim)

File: `supabase/migrations/20260711000001_mark_001_timestamp_markers.sql`
(timestamp strictly after the highest applied, `20260710000001`). **One additive
migration** — the table and the `proof_items` ALTER are FK-coupled
(`proof_items.marker_id → timestamp_markers`), so a single self-contained file
applies atomically and gives the Supabase Preview check one chokepoint.

```sql
-- ============================================================
-- Migration: 20260711000001_mark_001_timestamp_markers
-- Card: MARK-001 (#893) — timestamp_markers table + proof_items.marker_id.
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-4, Phase P3.5).
-- Canonical spec: Design Pass Output 8 (timestamp_markers) adapted TEXT-FIRST;
--   Output 6 (TimestampMarker component) + principle 7 ("Quote moments, not
--   messages"); pivot plan doc 13 P3.5. Design: docs/designs/MARK-001.md.
--
-- Write posture: MAXIMALLY-CONSERVATIVE / SELECT-only (the circles #859 +
--   PROOF-001 #888 precedent). The table ships SELECT-only RLS. ALL writes
--   (insert, soft-delete/retract) are performed by the MARK-002 Edge Function
--   (service-role), which snapshots quoted_text VERBATIM from arguments.body
--   server-side so the quote cannot be client-forged (the Output 13 Q5
--   misrepresentation mitigation). This migration therefore ships NO
--   authenticated write policy, NO write-gate helper, NO write-guard trigger.
--
-- Sequential after 20260710000001_proof_001_proof_items_and_relations.sql
--   (highest applied timestamp at build time).
--
-- -- What this migration does (strictly additive) --------------
--   1. Creates ONE new, RLS-enabled, EMPTY table: timestamp_markers -- a durable
--      quote-a-moment record. TEXT-FIRST: it carries CHAR-span markers against a
--      posted argument body now, and is shaped to carry VOICE (ms) spans in P5
--      by widening ONE check -- never a reshape.
--   2. ALTERs public.proof_items to ADD the deferred marker_id FK (PROOF-001
--      explicitly deferred this column to MARK-001 so the FK has a real referent
--      from day one). Nullable, indexed, on delete set null. NO proof_items.kind
--      widening (the voice-proof kinds stay deferred).
--   ZERO existing rows are touched; ZERO existing objects are dropped or edited.
--   No read-path change. The table is empty until MARK-002 writes it, and
--   proof_items.marker_id is all-NULL (no producer this card), so behaviour for
--   every existing room is bit-for-bit unchanged.
--
-- -- Span shape (the load-bearing delegated decision; design Decision 1) -------
--   span_start int / span_end int / span_unit text check ('chars'). One column
--   pair carries BOTH lanes with a discriminator: P5 widens the span_unit check
--   to add 'ms' (a one-line drop-constraint/add-constraint follow-up), never a
--   reshape and never a new column for the span itself. Nullable per-lane ms
--   columns now would be dead weight (a text marker has no ms) -- the same
--   dead-column logic PROOF-001 used to defer marker_id. check (span_end >
--   span_start) mirrors the Design Pass end_ms > start_ms and holds for both
--   lanes. quoted_text is NOT NULL -- the verbatim server snapshot is the DURABLE
--   artifact (see the durability audit in the design doc): self-sufficient after
--   any body edit, argument soft-delete, or (P5) audio deletion, so marker
--   correctness never depends on span-offset stability. recording_id is
--   deliberately ABSENT until P5 (the audio FK has no producer and the voice
--   columns do not exist yet -- the same "defer the column WITH the lane it
--   serves" logic PROOF-001 applied to marker_id).
--
-- -- Extension dependency (OPS-001 Class 4) --------------------
--   gen_random_uuid() requires pgcrypto. Supabase enables pgcrypto by default in
--   the public schema; every prior migration relies on the same default. Per
--   OPS-001 Class 4 the dependency is DOCUMENTED here, not asserted with a
--   create-extension statement (the #859 / PROOF-001 precedent).
--
-- -- Doctrine encoded by this migration ------------------------
--   - Quote the point, never judge it (cdiscourse-doctrine 1). A marker records a
--     span + a verbatim quoted_text snapshot; it carries NO verdict, NO score, NO
--     truth label. kind is 'rebuttal_anchor' | 'note' -- both verdict-free
--     (ban-list asserted by the scan suite).
--   - quoted_text is a verbatim snapshot, not editable (Output 13 Q5). The
--     SELECT-only posture routes the write to the MARK-002 Edge, which reads
--     arguments.body server-side and snapshots the exact span text -- a client
--     cannot forge quoted_text.
--   - Anti-amplification separation preserved: the table is INERT storage. No
--     point-standing / engagement column, no trigger that writes any score.
--   - RLS is ENABLED; nothing is disabled (cdiscourse-doctrine 8 /
--     supabase-edge-contract 4). The SELECT policy reads cross-table state ONLY
--     through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (no raw cross-table subquery) -- the COV-004 /
--     circles anti-recursion pattern.
--   - Room-visible SELECT composes through is_argument_visible_in_circle, which
--     OR-composes the canonical is_argument_visible (never re-inlined) + the #882
--     circle arm. A marker is visible iff its target argument is room-visible.
--   - Never hard-deleted (deleted_at). No hard-delete path, no DELETE policy.
--     Retract (if MARK-002 exposes it) is a service-role soft-delete.
--   - Table/column names carry no verdict or person token. 'timestamp_markers'
--     and 'marker' are internal; user-facing copy is MARK-002's concern.
--
-- -- OPS-001 four-class compliance (Docker-less heightened review) --
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery --
--     the only cross-table read is the pre-applied definer helper
--     is_argument_visible_in_circle. Every column in the USING body is
--     table-qualified (timestamp_markers.*). No bare same-name column.
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id / timestamp_markers.id).
--     span_start/span_end are int, compared int>int in the check. span_unit/kind
--     checks are text literal. marker_id uuid -> timestamp_markers.id uuid. No
--     text<->uuid, no int<->bigint.
--   Class 3 (statement order): timestamp_markers CREATE TABLE -> ENABLE RLS ->
--     indexes -> comments -> SELECT policy; THEN alter proof_items ADD marker_id
--     (its FK target timestamp_markers now exists) -> index -> comment. Every
--     object exists before it is referenced; RLS is enabled before the policy.
--   Class 4 (function/extension deps): pgcrypto documented above. Referenced
--     pre-applied helper: is_argument_visible_in_circle (20260702000001, granted
--     authenticated, wired live 20260709000001). auth.uid() from the Supabase
--     auth schema (default). This migration CREATES no function and no grant. No
--     COMMENT ON ... ON storage.* (all COMMENT targets are public.* this role owns).
-- ============================================================

-- ============================================================
-- 1. public.timestamp_markers -- the quote-a-moment record (text-first)
-- ============================================================
create table if not exists public.timestamp_markers (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)   on delete cascade,
  -- The argument whose body this marker quotes. NOT NULL; on delete cascade is a
  -- referential safety net only -- arguments soft-delete (status='deleted'),
  -- never hard-delete, so this never fires in the normal lifecycle.
  target_argument_id  uuid        not null references public.arguments(id) on delete cascade,
  created_by          uuid        not null references public.profiles(id)  on delete cascade,
  -- Text-first marker kind. 'rebuttal_anchor' = the phrase a reply is aimed at
  -- (Design Pass principle 7); 'note' = a freeform highlight. 'proof_excerpt' is
  -- DEFERRED (no proof kind consumes a marker yet -- this card does not widen
  -- proof_items.kind); a later voice-proof card widens this check with the
  -- producing lane.
  kind                text        not null
                        check (kind in ('rebuttal_anchor','note')),
  -- Span into the target. TEXT-FIRST: span_unit is 'chars' now (char offsets into
  -- arguments.body). P5 widens the check to add 'ms' (voice/waveform lane) -- a
  -- one-line follow-up, never a reshape. span_start/span_end are int (covers both
  -- char offsets and ms). end must be strictly after start (non-empty span).
  span_start          int         not null,
  span_end            int         not null,
  span_unit           text        not null default 'chars'
                        check (span_unit in ('chars')),
  -- The verbatim snapshot of the quoted span, taken server-side by the MARK-002
  -- Edge at creation. This is the DURABLE artifact: self-sufficient after any
  -- body edit, argument soft-delete, or (P5) audio deletion -- marker correctness
  -- never depends on span-offset stability. NOT NULL: a marker with no quote is
  -- useless ("Quote moments, not messages").
  quoted_text         text        not null,
  created_at          timestamptz not null default now(),
  -- Never hard-deleted. Retract (if MARK-002 exposes it) sets deleted_at via the
  -- service-role Edge; rows with deleted_at not null are hidden by the SELECT
  -- policy. Consumed NOW by the SELECT policy's deleted_at-is-null filter.
  deleted_at          timestamptz,
  check (span_end > span_start)
);

alter table public.timestamp_markers enable row level security;

create index if not exists timestamp_markers_target_argument
  on public.timestamp_markers (target_argument_id) where deleted_at is null;
create index if not exists timestamp_markers_debate_created
  on public.timestamp_markers (debate_id, created_at);

comment on table public.timestamp_markers is
  'MARK-001 (#893): the quote-a-moment record (Design Pass Output 8, adapted TEXT-FIRST; principle 7 "Quote moments, not messages"). A durable char-span marker against a posted argument body (span_unit=chars); P5 widens span_unit to add ms for the voice/waveform lane without a reshape. quoted_text is a verbatim server snapshot (the durable artifact, self-sufficient after body edit / argument soft-delete / P5 audio deletion). RLS enabled. SELECT-only posture (circles #859 + PROOF-001 precedent): SELECT room-visible via is_argument_visible_in_circle (canonical + #882 circle arm). ALL writes are performed by the MARK-002 service-role Edge, which snapshots quoted_text server-side so the quote cannot be client-forged (Output 13 Q5). Never hard-deleted (deleted_at). Inert storage: emits no point-standing delta.';
comment on column public.timestamp_markers.span_unit is
  'MARK-001: span discriminator. chars now (char offsets into arguments.body). P5 widens this check to add ms (voice lane). One column pair (span_start/span_end) carries both lanes -- no reshape.';
comment on column public.timestamp_markers.quoted_text is
  'MARK-001: verbatim snapshot of the quoted span, taken server-side by the MARK-002 Edge at creation. The durable artifact -- marker correctness never depends on span-offset stability (arguments.body is treated as immutable but is not DB-guarded; quoted_text is the source of truth). Not editable (Output 13 Q5 misrepresentation mitigation).';
comment on column public.timestamp_markers.deleted_at is
  'MARK-001: soft-delete tombstone. Set only by the MARK-002 service-role Edge (there is no authenticated write path this card). Rows with deleted_at not null are hidden by the SELECT policy. Never hard-deleted.';

-- -- timestamp_markers SELECT -- room-visible (canonical + #882 circle arm) --
drop policy if exists timestamp_markers_select_room_visible on public.timestamp_markers;
create policy timestamp_markers_select_room_visible
  on public.timestamp_markers
  for select
  to authenticated
  using (
    timestamp_markers.deleted_at is null
    and public.is_argument_visible_in_circle(timestamp_markers.target_argument_id, auth.uid())
  );

-- timestamp_markers INSERT / UPDATE / DELETE: no policy. SELECT-only posture --
-- all writes go through the MARK-002 service-role Edge (server-side quote
-- snapshot). PostgREST cannot insert, update, or delete a marker row for an
-- authenticated caller.

-- ============================================================
-- 2. public.proof_items.marker_id -- the PROOF-001 deferred FK, now with a target
-- ============================================================
-- PROOF-001 (#888) explicitly deferred this column to MARK-001 "so the FK has a
-- real referent from day one" (docs/designs/PROOF-001.md Design Decision 1;
-- migration 20260710000001 header). timestamp_markers now exists (created above),
-- so the FK ships with referential integrity. Nullable: only the deferred
-- voice-proof kinds (voice_excerpt/timestamp) would ever populate it, and this
-- card does NOT widen proof_items.kind -- a text marker is a rebuttal anchor, not
-- a proof, so no shipped proof references a marker yet. on delete set null mirrors
-- proof_items.referenced_argument_id (a proof survives losing its marker link;
-- markers are never hard-deleted anyway).
alter table public.proof_items
  add column if not exists marker_id uuid references public.timestamp_markers(id) on delete set null;

create index if not exists proof_items_marker
  on public.proof_items (marker_id) where marker_id is not null;

comment on column public.proof_items.marker_id is
  'MARK-001 (#893): optional FK to the timestamp_markers row this proof excerpts (deferred by PROOF-001 to MARK-001 so the FK ships with integrity). Nullable; populated only by future voice-proof kinds (voice_excerpt/timestamp), which stay deferred -- this card does not widen proof_items.kind. on delete set null.';
```

---

## API / interface contracts

No Edge Function, no client wrapper, no RPC exposed to `authenticated`. The
contracts other cards call:

- **MARK-002 (marker UI + Edge)** reads `timestamp_markers` via the normal
  PostgREST client, gated by the SELECT policy. It maps a row → the
  `TimestampMarker` view-model (Design Pass Output 6) — `{ id, span_start,
  span_end, span_unit, quotedText, kind, state }`. It **owns all writes** via a
  service-role Edge that: (a) verifies the caller is a room participant; (b)
  validates `debate_id` matches the target argument's debate; (c) reads
  `arguments.body` server-side and **snapshots `quoted_text` verbatim** from the
  `[span_start, span_end)` slice — the guarantee a client INSERT cannot make
  (§Decision 3); (d) inserts the row. Retraction (if exposed) is a service-role
  `deleted_at` write.
- **The `proof_items.marker_id` column** is forward-correct for a future
  voice-proof card: a `proof_items` row of a deferred `voice_excerpt`/`timestamp`
  kind may set `marker_id` to a `timestamp_markers.id`. Nothing this card
  produces such a row.
- **The `span_unit` widening contract:** P5 (`voice-004-waveform-markers`) runs a
  one-statement follow-up migration:
  `alter table public.timestamp_markers drop constraint <span_unit_check>; alter
  table public.timestamp_markers add constraint <span_unit_check> check (span_unit
  in ('chars','ms'));` (append-only new migration; never edits this file). It also
  adds `recording_id uuid → audio_submissions(id)` in the same P5 migration.

---

## Design decisions (explicit)

### 1. Span representation — `span_start` / `span_end` / `span_unit` (dual-lane, single shape) ✅

**Chosen:** `span_start int NOT NULL`, `span_end int NOT NULL`, `span_unit text
NOT NULL default 'chars' CHECK (span_unit in ('chars'))`, plus a table-level
`CHECK (span_end > span_start)`, plus `quoted_text text NOT NULL`. `recording_id`
**absent** until P5.

**Why, vs the alternatives:**

- **vs. nullable per-lane columns** (`char_start/char_end` + `start_ms/end_ms`, all
  nullable): those ms columns are **dead weight now** — a text marker has no ms, so
  they are always-NULL until P5. That is exactly the dead-column argument PROOF-001
  used to *defer* `marker_id` rather than ship it FK-less. One `int` pair +
  a discriminator carries both lanes honestly with zero dead columns.
- **vs. the Design Pass §8 raw shape** (`start_ms int` / `end_ms int`, voice-only):
  it **cannot represent a char offset honestly** (a char index is not milliseconds).
  Text-first requires the discriminator.
- **`span_unit CHECK ('chars')` is a real DB safety boundary now:** no row can
  claim to be a voice (`ms`) marker before the voice lane exists — defense-in-depth,
  the same narrowed-CHECK logic as PROOF-001 Decision 2. **P5 is a one-line CHECK
  widen, never a reshape** — the load-bearing requirement of the P3.5 amendment.
- **`CHECK (span_end > span_start)`** mirrors the Design Pass `end_ms > start_ms`
  and holds for both lanes (non-empty span).
- **`quoted_text NOT NULL`** — the verbatim snapshot is the **durable artifact**
  (see the durability audit). NOT NULL because a marker with no quote is useless.
- **`recording_id` absent until P5** — same deferral logic as `marker_id` had: the
  audio FK has no producer this card and the `audio_submissions` voice columns
  don't exist yet; `audio_submissions` exists (dormant, `initial_schema.sql:325`)
  but has no voice rows, so an FK now is an always-NULL column to an irrelevant
  table. Defer WITH the lane (P5's `voice-004`).

### 2a. Columns / FKs / on-delete

`id`, `debate_id → debates`, `target_argument_id → arguments`, `created_by →
profiles`, all `uuid`, all `on delete cascade` — mirrors PROOF-001's FK posture.
`debate_id` is kept (not derived from the argument) for room-prefixed indexing /
purge, per Design Pass Output 8 and the PROOF-001 precedent. `on delete cascade`
on `target_argument_id` is a **referential safety net only** — arguments
soft-delete (`status='deleted'`), never hard-delete, so cascade never fires in the
normal lifecycle; the `quoted_text` survives regardless.

### 2b. `kind` set = `('rebuttal_anchor','note')` — `proof_excerpt` deferred ✅

The Design Pass §8 `kind` CHECK is `('rebuttal_anchor','note','proof_excerpt')`.
**`proof_excerpt` is deferred.** Rationale: `proof_excerpt` is the kind for a
marker created **to become a proof excerpt** — but (a) the proof kinds that would
consume it (`voice_excerpt`/`timestamp`) are **deferred from `proof_items.kind`**
(PROOF-001) and this card does **not** widen `proof_items.kind` (§Decision 4), so
**no shipped proof references a marker yet**; (b) a text marker is a **rebuttal
anchor**, not a proof — markers (quote a moment) and proofs (back a claim) are
separate concepts. A `proof_excerpt` kind with no producer *and* no consumer is
dead vocabulary — the narrowed-CHECK defense again. A later voice-proof card widens
this CHECK to `proof_excerpt` **with** the producing lane.

### 2c. `deleted_at nullable` — ship it now (symmetry + never-hard-deleted) ✅

The Design Pass says markers are *"never hard-deleted."* Ship `deleted_at
timestamptz NULL`. Rationale: (a) symmetry with `proof_items` (both are
quote/receipt artifacts attached to arguments); (b) it is **not dead weight** — the
SELECT policy references it (`deleted_at is null`), so it is **consumed now** (the
exact PROOF-001 situation: SELECT-only table, `deleted_at` filtered by the policy,
written only by the Edge); (c) MARK-002 can then expose author retraction as a
service-role soft-delete **without a migration**. Whether to *expose* retraction in
the UI is MARK-002's product call; the column is ready either way. (Referencing it
in the SELECT policy is also why it must exist in this migration for the policy to
compile.)

### 3. RLS posture — SELECT-only, all writes via MARK-002's Edge ✅

The issue delegates the split. **Chosen: SELECT-only** (verbatim the PROOF-001
pattern), no write policy, no helper, no trigger. The SELECT body:

```sql
using (
  timestamp_markers.deleted_at is null
  and public.is_argument_visible_in_circle(timestamp_markers.target_argument_id, auth.uid())
)
```

**Justified against the Design Pass's "INSERT participants":**

- The conservative posture has **won twice** already — circles (#859) SELECT-only,
  and PROOF-001 SELECT-only after the orchestrator ruling. Zero write policy = zero
  over-permissive-INSERT risk (the single biggest new-table migration failure mode).
- **The decisive argument: MARK-002 needs server-side quote verification, which a
  client INSERT cannot do.** The Edge must read `arguments.body` server-side and
  snapshot `quoted_text` verbatim from the `[span_start, span_end)` slice, so the
  quote is a **trusted server snapshot, not a client-supplied string.** A client
  INSERT (the Design Pass's "INSERT participants") could supply **any**
  `quoted_text` — the exact **Output 13 Q5 misrepresentation vector** the Design
  Pass mitigates with *"quoted_text is snapshotted verbatim (not editable)."* Only a
  service-role Edge can guarantee `quoted_text == body[span_start:span_end]`. So
  SELECT-only is not merely conservative here — it is **required** to honor Q5.
- The participant / cross-room / span-validity gates a client INSERT would need are
  instead enforced in MARK-002's Edge (JWT-verified, participant check, server-side
  span + debate_id validation) — the PROOF-003 pattern.

### 4. `ALTER proof_items ADD marker_id` — honor the deferral; **no** kind widening ✅

```sql
alter table public.proof_items
  add column if not exists marker_id uuid references public.timestamp_markers(id) on delete set null;
create index if not exists proof_items_marker
  on public.proof_items (marker_id) where marker_id is not null;
```

- **Honors the PROOF-001 deferral note exactly** (`docs/designs/PROOF-001.md`
  §Decision 1 + migration header lines 116-118): *"marker_id … added by MARK-001
  together with the timestamp_markers table (P3.5), so the FK has a real referent
  from day one."* The FK target now exists (created earlier in the same file —
  Class 3 ordering).
- **Nullable** — a `proof_items` row without a marker (the common case) has
  `marker_id` NULL. **`on delete set null`** mirrors
  `proof_items.referenced_argument_id → arguments` — a proof survives losing its
  marker link (markers are never hard-deleted anyway).
- **Partial index** `where marker_id is not null` (mirrors the `proof_items_argument`
  partial-index style) — cheap; indexes only the rare marker-bearing rows.
- **NO `proof_items.kind` widening.** The proof kinds that would reference a marker
  (`voice_excerpt`/`timestamp`) are **voice-lane** proof kinds, deferred by
  PROOF-001 to the voice/marker infra cards. This card ships the `marker_id`
  *column* (so the FK integrity exists — PROOF-001's stated reason for the deferral)
  but does **not** produce a marker-bearing proof, so widening the kind CHECK now
  would permit a value no safe code path produces (a latent footgun — PROOF-001
  Decision 2). The kind widening belongs with the card that builds voice-proof
  attachment. Note: PROOF-001 (shipped) is SELECT-only with **no immutability
  trigger**, so `ADD COLUMN` touches no trigger and is transparent to the existing
  `proof_items_select_room_visible` policy.

### 5. Four-issue-class self-check + statement order — see §Four-issue-class self-check.

### 6. Zero-behavior-change + rollback honesty — see §Rollout.

---

## Four-issue-class self-check (pre-answering the Docker-less review)

- **Class 1 — ambiguous column in subquery.** The SELECT policy body contains
  **no subquery**; the only cross-table read is the pre-applied SECURITY DEFINER
  helper `is_argument_visible_in_circle`. Every column in the USING body is
  table-qualified (`timestamp_markers.deleted_at`,
  `timestamp_markers.target_argument_id`). **No 42702 risk.**
- **Class 2 — type mismatch.** Every FK is `uuid → uuid` PK (`debates.id`,
  `arguments.id`, `profiles.id`, `timestamp_markers.id`). `span_start`/`span_end`
  are `int`, compared `int > int` in the CHECK. `span_unit`/`kind` CHECKs are `text`
  literal. `marker_id uuid → timestamp_markers.id uuid`. No `text↔uuid`, no
  `int↔bigint`. **No implicit-cast surprise.**
- **Class 3 — implicit ordering.** `timestamp_markers` CREATE TABLE → ENABLE RLS →
  indexes → comments → SELECT policy; **THEN** `alter proof_items ADD marker_id`
  (FK target `timestamp_markers` now exists) → index → comment. RLS enabled before
  the policy; the FK target created before the ALTER references it; every `drop
  policy if exists` targets only a NEW name on `timestamp_markers` (no-op first
  apply). No DROP of any pre-existing object; the one `alter table` is `ADD COLUMN`,
  not a drop. **No forward reference.**
- **Class 4 — function / extension deps.** `gen_random_uuid()` → pgcrypto (Supabase
  default; documented in the header, not `create extension`-ed — #859 / PROOF-001
  precedent). `is_argument_visible_in_circle` (`20260702000001`, granted
  `authenticated`, wired live `20260709000001`) is referenced, not redefined.
  `auth.uid()` from the Supabase `auth` schema (default). This migration creates
  **no** function and **no** grant. No `COMMENT ON … ON storage.*` (all COMMENT
  targets are `public.*` this migration role owns). **No 42501, no missing dep.**

---

## Edge cases

- **Empty table.** Ships empty; the SELECT policy returns nothing; no existing room
  changes. `proof_items.marker_id` ships all-NULL (no producer this card).
- **Marker on a soft-deleted argument.** Arguments soft-delete via
  `status='deleted'` (no row delete), so the `target_argument_id` FK is unaffected;
  the marker row persists (never hard-deleted). Visibility then follows
  `is_argument_visible` — a non-author no longer sees it (status ≠ 'posted'); the
  **author** still sees it (the `author_id` arm ignores status). MARK-002 renders
  the `orphaned`/tombstone state (Design Pass Output 6). This card's row persistence
  is correct either way.
- **Body drift under the char span (the durability hole).** `quoted_text` is the
  source of truth; if the body is ever edited via the raw-PATCH hole, the offsets
  may no longer index the same text but `quoted_text` still resolves. MARK-002
  re-anchors by `quoted_text` or degrades to a non-highlight chip. Not a data-layer
  failure.
- **Empty / inverted span.** `CHECK (span_end > span_start)` rejects a zero-length
  or inverted span at the DB (23514). A client cannot even attempt it (SELECT-only);
  the MARK-002 Edge validates before insert.
- **Cross-room marker attempt.** A marker whose `debate_id` disagrees with the
  target argument's debate is a MARK-002 Edge validation concern (server-side
  check), not expressible from the client (no INSERT policy).
- **`ms` span before P5.** `CHECK (span_unit in ('chars'))` rejects any `'ms'` value
  (23514) until P5 widens it — the defense-in-depth boundary.
- **Concurrent duplicate markers.** No UNIQUE constraint — two identical spans by
  the same author are allowed (a marker is an additive quote, not a unique fact);
  MARK-002 may dedupe in the UI. (Deliberate: unlike `proof_relations`, a marker has
  no natural uniqueness key — the same phrase can be marked for different replies.)
- **`proof_items.marker_id` referential integrity.** Setting `marker_id` to a
  non-existent `timestamp_markers.id` is rejected by the FK (23503); a marker that
  is (hypothetically) hard-deleted sets dependent `proof_items.marker_id` to NULL
  (`on delete set null`), never orphaning the proof.

---

## File-by-file change list

- **new:** `supabase/migrations/20260711000001_mark_001_timestamp_markers.sql` —
  the table + SELECT policy + the `proof_items.marker_id` ALTER (verbatim above).
  ~140 SQL lines incl. header/comments.
- **new:** `__tests__/timestampMarkersRlsScan.test.ts` — the `#888`/`#882`-pattern
  `fs.readFileSync` scan over the migration text, with negative controls. ~38 tests
  (see Test plan).
- **modified:** `docs/core/current-status.md` — add the MARK-001 Phase-framing
  section (patterns MARK-002 consumes: the table shape, the `span_unit`
  discriminator + P5 widening contract, `quoted_text` as durable artifact, the
  SELECT-only + server-side-snapshot write posture, the `proof_items.marker_id` FK)
  + the confirmed test count. The current-status H2 test count MUST match this
  card's `docs/reviews/MARK-001-review.md` (the POSTRUN-UX001 lesson).
- **modified:** `CLAUDE.md` "Current stage" line — bump on completion (per
  test-discipline; the implementer confirms the count first).
- **no change:** `supabase/migrations/20260710000001_*` (never edit an applied
  migration), `src/features/evidence/*`, `submit-argument`, any render surface
  (non-goals: no Edge, no UI, no read-path flip, no `proof_items.kind` widening).

---

## Test plan

Baseline (orchestrator-provided): **960 suites / 33,761 tests** — the implementer
must capture the live `Test Suites: … / Tests: …` line + exit 0 before and after,
and cross-check `current-status.md` H2 against the review file (per test-discipline
/ POSTRUN-UX001). Expected delta: **+1 suite, ≈ +35–40 tests.**

**`__tests__/timestampMarkersRlsScan.test.ts`** — mirror `proofItemsRlsScan.test.ts`
exactly (`fs.readFileSync` over the migration; **every safety scan paired with a
negative control that plants the violation** — a scan that cannot fail is not a
test):

1. **Presence + numbering.** File exists at its locked path, non-empty; timestamp
   prefix strictly `> 20260710000001`.
2. **RLS enabled, never disabled, strictly additive.** `enable row level security`
   on `timestamp_markers`; never `disable row level security`; **no** `drop table`,
   **no** `drop column`, **no** `drop constraint`, **no** `alter table … drop`. The
   ONLY `alter table` is the `proof_items add column marker_id` (assert it is an
   `add column`, not a drop). The ONLY `drop policy if exists` targets the new
   SELECT name on `public.timestamp_markers`. + negative control (plant a
   `drop column`).
3. **SELECT-only (the load-bearing safety property).** Exactly ONE `create policy`,
   `for select`, `to authenticated`. **No** `for insert` / `for update` /
   `for delete`. **No** `create function`, `create trigger`, `grant execute`. +
   negative control (plant a `for insert` policy → the scan fires).
4. **SELECT body routes through the single composite helper.** The USING body
   filters `deleted_at is null` and calls
   `public.is_argument_visible_in_circle(timestamp_markers.target_argument_id,
   auth.uid())`; contains **no** raw `select … from public.arguments` /
   `public.debates` subquery. + negative control (plant a raw arguments subquery).
5. **Span shape.** `span_unit` CHECK set is exactly `('chars')`; assert `'ms'`
   **absent** from the `span_unit` CHECK (P5 defers the voice lane) + negative
   control (plant `'ms'`). Assert `check (span_end > span_start)` present. Assert
   `quoted_text` declared `not null`. Assert `recording_id` **absent** from the
   whole migration text (deferred) + negative control.
6. **`kind` set.** `kind` CHECK is exactly `('rebuttal_anchor','note')`; assert
   `'proof_excerpt'` **absent** + negative control.
7. **`proof_items.marker_id` ALTER.** Assert `alter table public.proof_items add
   column … marker_id uuid references public.timestamp_markers(id)` present; assert
   the partial index `proof_items_marker`; assert **no** `proof_items.kind`
   widening — `'voice_excerpt'` and `'screenshot'` absent from the whole text, and
   no second `check (kind in` re-CHECK of `proof_items` + negative control.
8. **Class-1 qualification.** No bare sensitive column
   (`deleted_at`/`target_argument_id`/`debate_id`) in the SELECT USING body
   (qualification scan) + negative control (plant a bare column).
9. **Class-4.** Does not redefine `is_argument_visible_in_circle`; creates no
   extension; **does** reference the helper.
10. **Doctrine ban-list.** No person-labeling verdict token anywhere in the
    migration text; no boolean-ambiguous token (`true`/`false`/`correct`) inside
    the SELECT policy body; `kind`/`span_unit` vocabularies are verdict-free +
    negative control.

No Docker DB reset available; this scan suite is the migration's chokepoint
contract (the `#882`/`#888` lane). No RN/UI test (no UI this card). No Edge test
(no Edge this card).

---

## Dependencies (cards / docs / files)

- **Assumes PROOF-001 (#888, merged `20260710000001`)** — `public.proof_items`
  exists (this card ALTERs it) and its migration header names the `marker_id`
  deferral this card fulfils.
- **Assumes PRIVATE-GROUPS-002 (`20260702000001`) + ASP-CIRCLES-RLS-001 #882
  (`20260709000001`)** — `is_argument_visible_in_circle` exists, is granted, and
  OR-composes canonical + circle; the SELECT policy calls it directly.
- **Assumes COV-004 (`20260630000001`)** — `is_argument_visible` is the canonical
  spine the circle helper composes.
- **Reads** the reality of `arguments.body` immutability
  (`initial_schema.sql:191,205`; `rls_policies.sql:233-237`;
  `submit-argument/index.ts`; `argumentsApi.ts`) — the durability audit.
- **Blocks MARK-002** (marker UI + write Edge reads/writes this table). MARK-003
  (waveform gestures) stays blocked on #863 / P5.
- **Forward dependency it hands off:** P5 `voice-004-waveform-markers` widens the
  `span_unit` CHECK to add `'ms'` and adds `recording_id → audio_submissions(id)`;
  a future voice-proof card widens `proof_items.kind` to `voice_excerpt`/`timestamp`
  and produces the first marker-bearing `proof_items` rows.

---

## Risks

- **RLS on a new table is THE risk; over-permissive INSERT is the failure mode.**
  Mitigation: this card ships **zero** write policy (SELECT-only), so there is no
  INSERT to over-permission; the scan suite asserts SELECT-only with a negative
  control; the migration is verbatim for the heightened review.
- **The FK ALTER on a live, non-empty table.** `ALTER TABLE public.proof_items ADD
  COLUMN marker_id uuid … NULL` is a metadata-only add (nullable, no default
  expression that rewrites rows), so it takes a brief `ACCESS EXCLUSIVE` lock and
  returns instantly even on a populated `proof_items` — no table rewrite, no row
  scan. The FK is `NOT VALID`-free (a nullable FK on an empty-of-that-column table
  validates trivially since every existing row's `marker_id` is NULL). Low risk;
  called out because it is the one statement touching a pre-existing table.
- **Span durability if the body-immutability hole is ever exercised.** Mitigated by
  design: `quoted_text NOT NULL` is the durable artifact; offsets are advisory
  locators (durability audit). No data-layer dependency on offset stability.
- **`span_unit` widening must stay a CHECK-only change in P5.** If P5 ever needed a
  *column* add for the voice span, the "no reshape" promise would break — but the
  `int` span pair + discriminator is chosen precisely so P5 is CHECK-only. Recorded
  as the contract MARK-002/P5 must honor.
- **Preview-check-only apply (Docker unavailable locally).** The reviewer's
  heightened four-class review + the scan suite are the guardrails; the four-class
  self-check above pre-answers each class. Post-merge, the operator verifies table +
  policy + column presence on the linked DB.
- **Stale test baseline.** The orchestrator-provided baseline (960/33,761) may differ
  from the CLAUDE.md line; the implementer captures the live count and the reviewer
  cross-checks `current-status.md` H2 against the review file.

---

## Out of scope

- No Edge Function (MARK-002 owns the write path + server-side quote snapshot).
- No UI / view-model (MARK-002).
- No voice columns activated — `span_unit` stays `('chars')`; `recording_id`,
  `transcript_segments`, waveform peaks are all P5.
- No `proof_items.kind` widening (`voice_excerpt`/`timestamp` stay deferred).
- No first marker-bearing `proof_items` row (no producer this card).
- No read-path change; nothing renders `timestamp_markers` yet.
- No back-fill (there is no legacy marker store to fold).
- No point-standing / anti-amplification change (inert storage).
- No v1-scope violation (no voting, search, push, OAuth, public API).

---

## Doctrine self-check

- **cdiscourse-doctrine §1–3 (no truth labels / heat / popularity):** a marker
  records a span + a verbatim quote — **no** verdict, **no** score, **no** truth
  label; `kind` (`rebuttal_anchor`/`note`) and `span_unit` (`chars`) are verdict-free
  (scan-asserted); the table emits no point-standing delta and carries no
  popularity/engagement column.
- **cdiscourse-doctrine §4 (AI limits):** no AI, no classifier write; the table is
  inert storage.
- **cdiscourse-doctrine §6–7 (secrets / no AI calls in app):** no secret in the
  migration; no Anthropic/xAI/X call; MARK-002's future service-role Edge keeps the
  key server-side.
- **cdiscourse-doctrine §8 (Supabase conventions):** RLS **enabled** on the new
  table, never disabled; new (never-edited) migration; **never hard-deleted**
  (`deleted_at` soft-delete tombstone), no DELETE policy, no hard-delete path.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** a marker is a
  **user-generated** quote-selection (an author marks a phrase) — it carries the
  quote, never a machine classification and never a claim about a person; MARK-002's
  chip rendering inherits the ban-lists.
- **evidence-doctrine:** engagement credit vs factual standing untouched (inert
  storage); `quoted_text` is a verbatim snapshot, never a proof-of-truth; the
  `proof_items.marker_id` link is optional and adds no standing.
- **supabase-edge-contract §4 / write posture:** no service-role in client; the
  no-direct-insert rule is honored maximally — this card ships **no** write policy
  at all; every cross-table policy read goes through the `is_argument_visible_in_circle`
  SECURITY DEFINER helper (no raw subquery); the privileged write (server-side
  `quoted_text` snapshot) is routed to MARK-002's Edge.
- **Score never blocks posting:** nothing here gates `submit-argument`; the table is
  read/written independently of the argument insert.

---

## Rollout / Operator steps

1. **Merge → auto-apply.** The Supabase GitHub integration applies
   `20260711000001_mark_001_timestamp_markers.sql` on merge to `main`
   (config.toml-registered migrations auto-apply). No manual `db push` unless the
   integration is unavailable — then: `npx supabase db push --linked`.
2. **Post-merge verification (linked DB):** confirm the table, its single SELECT
   policy, and the new `proof_items.marker_id` column are present:
   ```
   npx supabase db query --linked "select tablename, policyname, cmd from pg_policies where tablename = 'timestamp_markers';"
   npx supabase db query --linked "select to_regclass('public.timestamp_markers');"
   npx supabase db query --linked "select column_name from information_schema.columns where table_name = 'proof_items' and column_name = 'marker_id';"
   ```
   Expect: `timestamp_markers` = SELECT (1 policy); table non-null;
   `proof_items.marker_id` present.
3. **MARK-002 is unblocked** (marker UI + write Edge).

**Rollback honesty.** **Merge = deploy (auto-apply); revert-merge does NOT un-apply
the migration.** Once applied, the `timestamp_markers` table + the
`proof_items.marker_id` column exist on the linked DB. Reverting the PR removes the
file from the tree but leaves the DB objects (Supabase runs no down-migrations).
Because the card is **purely additive and the table ships empty / the column ships
all-NULL**, leaving the objects in place is harmless (nothing reads them yet). A
true removal is a **forward-drop migration** — and it must drop **in dependency
order** (`alter table public.proof_items drop column marker_id;` **then** `drop
table public.timestamp_markers;`), never an edit to the applied file.

---

## Orchestrator-authored brief ledger

This design was authored against an orchestrator-relayed issue (#893), not a
hand-validated operator brief. Interpretation map:

- **From the binding issue (#893):** scope (one additive migration + the
  `proof_items.marker_id` ALTER), the two delegated decisions (span representation,
  RLS write posture), the text-first mandate, the ban-list + zero-behaviour-change
  acceptance criteria, the `#882`/`#888` scan pattern, the four-issue-class
  heightened-review requirement.
- **From Design Pass Output 8 / 6 / 13 Q5 (design-only, operator-reviewed
  2026-07-04):** the `timestamp_markers` column shape (adapted text-first), the
  `TimestampMarker` component semantics, the Q5 verbatim-snapshot misrepresentation
  mitigation (the decisive RLS argument), the "never hard-deleted" posture.
- **From the shipped precedents (this session's survey):** the PROOF-001 SELECT-only
  migration (`20260710000001`) + its `marker_id` deferral note, the
  `proofItemsRlsScan.test.ts` scan pattern, the `is_argument_visible_in_circle`
  single-call composition, the `arguments.body` immutability reality (written once,
  the one RLS hole), `audio_submissions` being dormant.
- **Resolved by orchestrator/designer default (flag for operator review):**
  (a) **`span_start`/`span_end`/`span_unit`** over nullable per-lane ms columns —
  chosen for the one-line P5 widen (§Decision 1). (b) **`deleted_at` shipped now**
  (§Decision 2c) — chosen for symmetry + retraction-ready; MARK-002 decides UI
  exposure. (c) **`proof_excerpt` deferred from `kind`** (§Decision 2b). (d) **No
  `proof_items.kind` widening** (§Decision 4). (e) One migration file (issue-binding;
  atomic). (f) `target_argument_id` naming (Design Pass §8) over PROOF-001's
  `argument_id`.
- **Operator-deferred review:** the **RLS write posture** is the one place a product
  call could differ — if the operator prefers the Design Pass's "INSERT participants"
  over SELECT-only, an INSERT policy + a participant/own-move write gate would be
  added and MARK-002 would lose the server-side `quoted_text` snapshot guarantee
  (re-opening the Q5 misrepresentation vector). This design recommends SELECT-only
  precisely because the Q5 mitigation **requires** a server-side snapshot; the
  operator should confirm that trade before MARK-002 is built. Everything else
  (table shape, SELECT policy, CHECKs, the `marker_id` ALTER) is unchanged either
  way.
