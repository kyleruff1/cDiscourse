# META-1C — Admin metadata-event audit log surface

**Status:** Design draft
**Epic:** Rules UX / Metadata (META card line — Timeline Tree Game Board family)
**Release:** 6.8 (v2 boundary; admin-only; operator-approved for implementation)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/78

---

## 0. Card-vs-reality discrepancies (read first)

Every prior META card had several. META-1C is no exception. The implementer must
build against **reality**, not the card text, where the two disagree. The single
most important correction is §0.1 — it removes an entire Edge Function and an
entire migration from the card's stated scope.

| # | Card says | Reality | Resolution |
|---|---|---|---|
| 0.1 | "Edge Function `list-metadata-events` (admin-only, JWT-verified, returns chronological events with `appliedBy` display name)." | The **established admin-read pattern in this repo is a direct caller-scoped Supabase SELECT gated by admin RLS** — `AdminArgumentsTab` reads `public.arguments` joined with `debates(title)` + `profiles(display_name)` via `adminArgumentsApi.loadAdminArguments` with **no Edge Function**. The doc comment on `adminArgumentsApi.ts` says so verbatim: *"Admin RLS already permits the SELECT via `is_moderator_or_admin()`; no Edge Function or service-role path is needed."* The META-1C card text describing an Edge Function predates the META-1A migration that actually shipped. | **No `list-metadata-events` Edge Function.** META-1C is a **direct admin-RLS read**, exactly like `AdminArgumentsTab`. New data layer `adminMetadataEventsApi.ts` does a caller-scoped `supabase.from('point_tags').select(...)`. See §"Footprint decision" for the full justification and the rejected alternative. This is the **lighter, doctrine-correct** option. |
| 0.2 | "Admin-only RLS on the underlying event log (added in META-1A if not already there)." | META-1A's migration `20260517000009_meta_1a_point_tags.sql` shipped a `point_tags` SELECT policy `pt_select_read_access`: `using (exists (select 1 from public.arguments a where a.id = argument_id))`. RLS on the **subquery's `arguments` table also applies**. The `arguments` SELECT policy (`20260516000002_rls_policies.sql` line 213) includes `OR is_moderator_or_admin()`. Therefore an admin satisfies the `EXISTS` for **every** `point_tags` row — admins can **already SELECT all `point_tags`** with no new policy. | **No new migration.** META-1C needs zero schema change. The "added in META-1A if not already there" clause resolves to "already there, transitively, via `arguments` RLS." See §"Data model" for the full RLS trace and the deliberate decision not to add a redundant admin-only policy. |
| 0.3 | "Each row shows … **actor role at the time**." | `point_tags` has **no `actor_role` column** — META-1A §0 / Edge case #11 explicitly decided not to store it (the role at apply-time is not load-bearing and can change). The role *cannot* be reconstructed "at the time" from persisted data. | The audit row shows the actor's **current** role, derived from `profiles.role` (admin/moderator/user) + their `debate_participants.side` for the audited debate (`affirmative`/`negative`/`observer`), labeled **"current role"** — never "role at the time." The implementer must NOT invent an apply-time role. Honest labeling is a doctrine requirement (fact-only, no fabrication). See §"Data model — the actor-role column gap". |
| 0.4 | "lifecycle transition" filter chip / "which lifecycle transitions a given move caused." | `point_tags` is the **manual-tag** ledger only. Auto-derived metadata and lifecycle-causation events (`MetadataEvent.codeFamily = 'auto_metadata' \| 'lifecycle_causation'`) are **render-time-derived in memory by `buildMoveMetadataLedger`** and were **never persisted** — META-1A explicitly scoped them out ("Auto-metadata stays render-time-derived per META-001"). There is no persisted lifecycle-transition row to audit. | META-1C audits **manual-tag events only** (`apply` / `remove` of one of the 10 `ManualTagCode` values). The "lifecycle transition" filter chip is **dropped**; the applied-vs-removed chip replaces it. The card's "which lifecycle transitions a move caused" is **out of scope** — flagged to the operator as a possible future card once auto-metadata is persisted. See §"Out of scope". |
| 0.5 | "`AdminMetadataEventsTab.tsx` (mirroring `AdminArgumentsTab` style …)." | `AdminArgumentsTab` is real and is the correct template. The `AdminScreen` tab registry is a hard-coded `AdminTab` union + `TABS` array + `ADMIN_TAB_LABELS` map in `src/features/admin/types.ts` + `AdminScreen.tsx`. | Confirmed: mirror `AdminArgumentsTab`. The new tab requires **3 small edits** to the registry (`AdminTab` union, `TABS` array, `ADMIN_TAB_LABELS` map) + one render branch in `AdminScreen.tsx`. See §"File changes". |
| 0.6 | "RLS prevents non-admin from invoking the Edge Function." | There is no Edge Function (§0.1). | The acceptance criterion is satisfied by **RLS on the read**: a non-admin calling `adminMetadataEventsApi` gets only the `point_tags` rows for debates they can see (their own / open / participated) — never the global audit. The `AdminScreen` itself is already gated behind `profiles.role`-based navigation (the admin tab is not rendered for non-admins). Defense-in-depth: RLS, not a function gate. See §"Doctrine self-check". |
| 0.7 | One event = one row. | `point_tags` stores **one row per active tag**, with `created_at` (the "applied" moment) and `removed_at` (the "removed" moment, nullable). A single `point_tags` row therefore represents **up to two audit events**: an `applied` event always, and a `removed` event when `removed_at` is set. | The data layer **expands** each `point_tags` row into 1 or 2 `MetadataAuditEvent` objects — an `applied` event keyed on `created_at`/`tagged_by`, and (if `removed_at` is set) a `removed` event keyed on `removed_at`/`removed_by`. The chronological sort happens **after** expansion. See §"API / interface contracts — the row-to-events expansion". |

None of these block the card. 0.1, 0.2, and 0.4 collectively **shrink** the card: no Edge Function, no migration, no lifecycle-causation surface. META-1C becomes a pure-client read surface + one pure adapter + one tab component.

---

## Goal (one paragraph)

META-001 modeled the manual-tag vocabulary; META-1A persisted it as the
`public.point_tags` table (a participant marking a move `needs_source`,
`tangent`, `concession_offered`, etc. now writes a durable, shared row with a
`created_at` apply moment and a nullable `removed_at` soft-delete moment).
META-1C adds the **admin investigation surface** that consumes that table: a new
`AdminMetadataEventsTab` that lists manual-tag *events* (each tag applied, each
tag removed) chronologically, scoped to a selectable debate, with filter chips
for tag code, actor role, and applied-vs-removed. An admin investigating a
tag-misuse report ("who keeps spam-tagging room X") finally has an evidence
trail. Doctrine constraints that shape the design: the surface is **fact-only**
— it states "user X applied tag Y on argument Z at time T" as a neutral fact and
**never** characterizes the person (cdiscourse-doctrine §1 — no verdict tokens,
no person-attribution drift); it is **append-only** (no edit, no delete — it is
an audit *view* of an already-soft-delete-only table — supabase-edge-contract
audit-table pattern); **all access is enforced by admin RLS** that already
exists, with **no service-role key in client code** (cdiscourse-doctrine §6,
supabase-edge-contract hard rule #1); plain-language tag labels reuse the
existing `gameCopy` `PLAIN_LANGUAGE_COPY` map — **no new copy tokens, no verdict
language** (cdiscourse-doctrine §9). META-1C adds **no migration, no Edge
Function, no AI call, no scoring, and no schema change** — it is a read-only
admin lens over META-1A's existing table.

---

## Footprint decision — direct admin-RLS read vs new Edge Function

The card text asks for an Edge Function `list-metadata-events`. The agent brief
asks for both options to be documented with a recommendation. Here they are.

### Option A — direct caller-scoped admin-RLS read (RECOMMENDED)

A new pure data layer `src/features/admin/adminMetadataEventsApi.ts` does a
caller-scoped `supabase.from('point_tags').select(...)` with embedded joins to
`arguments`, `debates`, and `profiles`. Admin RLS on `point_tags`/`arguments`/
`debates` already permits an admin to read every row (§0.2). This is the
**exact pattern `AdminArgumentsTab` + `adminArgumentsApi.loadAdminArguments`
already use** and the pattern the `adminArgumentsApi.ts` file comment endorses
in writing.

- **No new Edge Function** → no `supabase functions deploy` step.
- **No new migration** → no `supabase db push` step.
- **Zero operator deploy steps.** Pure code change; ships on merge.
- Doctrine-correct: no service-role anywhere; RLS is the access boundary; the
  client never holds a privileged key.
- Trade-off: the data layer constructs a moderately involved PostgREST embedded
  `select` string (`point_tags` → `arguments` → `debates`, plus two `profiles`
  embeds for tagger + remover). PostgREST supports this; `adminArgumentsApi`
  already embeds `debates(title)` + `profiles(display_name)` + the
  `argument_tags(tag_code)` join, so the pattern is proven in this repo.
- Trade-off: row-to-events expansion (§0.7) happens **client-side** in a pure
  adapter. This is fine — it is pure, fast (≤ a few hundred rows per debate),
  and fully unit-testable.

### Option B — new `list-metadata-events` Edge Function (REJECTED)

A Deno Edge Function that JWT-verifies, checks `is_admin`, and returns the
expanded event list.

- **Cost:** a new function directory, the standard `_shared/http.ts` +
  `_shared/supabaseClients.ts` wiring, ~150–200 lines, a new test suite, **and a
  mandatory `supabase functions deploy list-metadata-events --linked` operator
  step** before the feature works in any environment.
- **No security benefit.** The function would itself use the **caller-scoped
  client** to read `point_tags` (reading other users' rows needs no
  service-role; admin RLS already grants it). An Edge Function that only does a
  caller-scoped SELECT is a redundant network hop around RLS that already works.
  The *only* time an admin-read Edge Function earns its keep is when it must
  return data the caller-scoped client **cannot** see (e.g. `auth.users` emails,
  which need service-role) — META-1C returns none of that. It returns
  `point_tags` columns + `profiles.display_name` + `debates.title`, all
  caller-scoped-readable by an admin.
- **It contradicts the established repo pattern.** `AdminArgumentsTab` proved
  the direct-read pattern; adding an Edge Function here would be inconsistent and
  heavier for no doctrine gain.

### Recommendation

**Option A.** It is lighter (no function, no migration, no deploy), it is
doctrine-correct (no service-role in client; RLS is the boundary), and it is the
**established pattern** the very component META-1C is told to mirror already
uses. Option B is rejected because an Edge Function that only does a
caller-scoped SELECT adds a deploy dependency and a maintenance surface with no
security or correctness benefit.

The rest of this design specifies **Option A**.

---

## Data model

### No new table. No new migration. No schema change.

META-1C reads `public.point_tags` (created by META-1A migration
`20260517000009_meta_1a_point_tags.sql`) joined to `public.arguments`,
`public.debates`, and `public.profiles`. Every column it needs already exists.

### Columns read from `public.point_tags`

| Column | Type | Use in the audit surface |
|---|---|---|
| `id` | uuid | Stable React key; `${id}:applied` / `${id}:removed` event ids |
| `debate_id` | uuid | Debate-selector filter (`.eq('debate_id', …)`) |
| `argument_id` | uuid | Join to `arguments` for the move excerpt |
| `tag_code` | text | The tag code; mapped to a plain label via `gameCopy` |
| `tagged_by` | uuid → `profiles.id` | The actor of the **applied** event |
| `created_at` | timestamptz | Timestamp of the **applied** event |
| `removed_at` | timestamptz \| null | When set, timestamp of the **removed** event |
| `removed_by` | uuid \| null → `profiles.id` | The actor of the **removed** event |

`point_tags` has **no `actor_role` column** — see the gap note below.

### Joins (PostgREST embedded select)

- `arguments!inner ( id, body, side, status, debate_id )` — for the move
  excerpt + side + a sanity check that `argument.debate_id === point_tags.debate_id`.
- `debates!inner ( id, title )` — for the debate title shown in each row and the
  debate-selector list.
- `profiles!point_tags_tagged_by_fkey ( id, display_name, role )` — the
  **tagger** (applied-event actor).
- `profiles!point_tags_removed_by_fkey ( id, display_name, role )` — the
  **remover** (removed-event actor). Nullable embed (LEFT join — `removed_by`
  may be null).

PostgREST disambiguates the two `profiles` embeds by the FK constraint name.
META-1A's migration declares both FKs inline (`tagged_by … references
public.profiles(id)` and `removed_by … references public.profiles(id)`); the
implementer must confirm the **generated FK constraint names** (Postgres auto-
names them `point_tags_tagged_by_fkey` and `point_tags_removed_by_fkey` for
inline column references — this is the standard naming and matches the names
used above). If the names differ in the live DB, the embed hints adjust; the
`adminMetadataEventsApi.test.ts` asserts the select string the implementer
commits.

### The actor-role column gap (card §0.3)

The card asks each row to show "actor role **at the time**." `point_tags` does
not store the actor's role at apply-time, and META-1A deliberately did not add it
(the role can change; it is not load-bearing for gameplay rendering). META-1C
**must not fabricate** an apply-time role.

Resolution — show the actor's **current role**, honestly labeled:

- `profiles.role` (`'admin' \| 'moderator' \| 'user'`) is embedded on the
  tagger/remover `profiles` join → gives the current app-level role.
- The actor's **side in the audited debate** (`affirmative` / `negative` /
  `observer`) requires a `debate_participants` lookup. META-1C does **one extra
  caller-scoped query** per loaded page: `supabase.from('debate_participants')
  .select('user_id, side').eq('debate_id', selectedDebateId).in('user_id',
  actorIds)` and joins it client-side. (Admin RLS on `debate_participants` —
  `20260516000002_rls_policies.sql` line 175, `OR is_moderator_or_admin()` —
  permits this.)
- The combined label is rendered as e.g. `Participant · Affirmative side`
  (current) or `Admin` (current). The UI labels this column header
  **"Actor — current role"** with a one-line legend: *"Role and side are the
  actor's current values, not necessarily their role when the tag was
  applied."* This is the honest, fact-only presentation; inventing an
  apply-time role would be a doctrine violation (fabricated fact).

### Client TypeScript shapes (new — in `adminMetadataEventsApi.ts`)

```ts
/** The kind of audit event a point_tags row expands into. */
export type MetadataAuditEventKind = 'applied' | 'removed';

/** The actor's CURRENT role context — not their role at apply-time.
 *  See §"the actor-role column gap". */
export interface AuditActorRole {
  /** profiles.role — 'admin' | 'moderator' | 'user'. */
  appRole: 'admin' | 'moderator' | 'user';
  /** debate_participants.side for the audited debate, or null when the
   *  actor has no participant row (e.g. an admin who never joined). */
  debateSide: 'affirmative' | 'negative' | 'observer' | null;
}

/** One row in the AdminMetadataEventsTab. A point_tags row produces one
 *  'applied' event and (when removed_at is set) one 'removed' event. */
export interface MetadataAuditEvent {
  /** Stable id: `${pointTagId}:applied` or `${pointTagId}:removed`. */
  eventId: string;
  /** The source point_tags row id. */
  pointTagId: string;
  kind: MetadataAuditEventKind;
  /** ISO-8601 — created_at for 'applied', removed_at for 'removed'. */
  occurredAt: string;
  debateId: string;
  debateTitle: string | null;
  argumentId: string;
  /** Short excerpt of the tagged move's body (≤ ~160 chars, whitespace
   *  collapsed). Null when the argument row is not embedded. */
  argumentExcerpt: string | null;
  argumentSide: string | null;
  tagCode: ManualTagCode;            // imported from moveMetadataLedger
  /** Plain-language label from gameCopy PLAIN_LANGUAGE_COPY. */
  tagPlainLabel: string;
  /** The actor of THIS event — tagger for 'applied', remover for 'removed'. */
  actorId: string | null;
  actorDisplayName: string | null;
  actorRole: AuditActorRole | null;
}

export interface LoadMetadataAuditOptions {
  /** Required — the surface is always debate-scoped (card: "scoped to a
   *  single debate"). When null the loader returns []. */
  debateId: string | null;
  /** Cap rows fetched from point_tags. Defaults to 200, max 500. */
  limit?: number;
  /** Sort direction on occurredAt. Defaults to 'desc' (newest first). */
  sortDirection?: 'desc' | 'asc';
}

/** A debate the admin can pick in the debate selector. */
export interface AuditDebateOption {
  debateId: string;
  title: string | null;
}
```

`ManualTagCode` is imported from
`src/features/metadata/moveMetadataLedger.ts` — META-1C does **not** redefine
the vocabulary.

---

## File changes

### New files

- `src/features/admin/adminMetadataEventsApi.ts` — the data layer. Exports
  `loadMetadataAuditEvents(options)` (caller-scoped `point_tags` select +
  `debate_participants` side lookup + the pure row-to-events expansion),
  `loadAuditDebateOptions()` (distinct debates that have `point_tags` rows, for
  the debate selector), the `expandPointTagRowToEvents(row)` **pure adapter**,
  and all the interfaces above. **~210 lines.** Mirrors `adminArgumentsApi.ts`
  structure (raw row interface + `as*` join-flatteners + a mapper).
- `src/features/admin/AdminMetadataEventsTab.tsx` — the tab component. Debate
  selector, filter chips (tag code / actor role / applied-vs-removed), sortable
  `Created` column, horizontally scrollable table, loading / empty / error /
  filtered-empty states. Mirrors `AdminArgumentsTab.tsx`. **~360 lines.**
- `__tests__/adminMetadataEventsApi.test.ts` — pure-adapter tests
  (`expandPointTagRowToEvents`: applied-only row → 1 event; applied+removed row
  → 2 events; field mapping; empty/malformed input), the select-string shape
  assertion, the `debate_participants` side-join logic, and the doctrine
  ban-list scan over `tagPlainLabel` output. **~230 lines.**
- `__tests__/adminMetadataEventsTab.test.tsx` — component tests: renders rows,
  the three filter chips narrow the list, the `Created` header toggles sort
  direction, the debate selector switches debate, empty-state copy, the
  fact-only ban-list scan over all rendered strings, accessibility-attribute
  presence (`accessibilityRole`, `accessibilityLabel`, `accessibilityState`).
  **~280 lines.**

### Modified files

- `src/features/admin/types.ts` — extend the `AdminTab` union with
  `'metadata_events'`; add `metadata_events: 'Metadata Events'` to
  `ADMIN_TAB_LABELS`. **~+2 lines.** The `AdminArgumentRow` interface and the
  rest of the file stay.
- `src/features/admin/AdminScreen.tsx` — add `'metadata_events'` to the `TABS`
  array; add `import { AdminMetadataEventsTab }`; add the
  `{tab === 'metadata_events' && <AdminMetadataEventsTab />}` render branch.
  **~+3 lines.** Everything else stays.
- `docs/current-status.md` — bump the test count + add the META-1C note
  **after** the implementer confirms `npm run test` (per test-discipline).
- `CLAUDE.md` — the operator/implementer bumps the "Current stage" line on stage
  completion per repo convention. Not a META-1C code change.

### Explicitly NOT created / NOT modified

- **No `supabase/migrations/*.sql` file.** §0.2 — admins can already SELECT all
  `point_tags` rows transitively via `arguments` RLS. Adding a redundant
  admin-only SELECT policy would be migration churn with no behavior change.
- **No `supabase/functions/list-metadata-events/`.** §0.1 / §"Footprint
  decision" — the direct admin-RLS read is the established, lighter pattern.
- **No `supabase/functions/_shared/` change.** Nothing server-side is touched.
- **No `point_tags` write path.** META-1C is read-only. The `apply-manual-tag`
  Edge Function (META-1A) remains the sole write path; META-1C never inserts,
  updates, or deletes.
- **No `gameCopy.ts` change.** All 10 `ManualTagCode` labels already exist in
  `PLAIN_LANGUAGE_COPY` (`needs_source` → "Needs source", `tangent` →
  "Tangent / side issue", etc. — verified, lines 226–234). No new token.

### Deleted files

None.

---

## API / interface contracts

### `loadMetadataAuditEvents(options): Promise<MetadataAuditEvent[]>`

```ts
export async function loadMetadataAuditEvents(
  options: LoadMetadataAuditOptions,
): Promise<MetadataAuditEvent[]>;
```

Flow:

1. If `!SUPABASE_CONFIGURED` or `options.debateId == null` → return `[]`
   (the surface is always debate-scoped; no debate picked = nothing to show).
2. `limit = clamp(options.limit ?? 200, 1, 500)`.
3. Caller-scoped select on `point_tags`:
   ```ts
   supabase
     .from('point_tags')
     .select(
       'id, debate_id, argument_id, tag_code, tagged_by, created_at, ' +
       'removed_at, removed_by, ' +
       'arguments!inner ( id, body, side, status, debate_id ), ' +
       'debates!inner ( id, title ), ' +
       'tagger:profiles!point_tags_tagged_by_fkey ( id, display_name, role ), ' +
       'remover:profiles!point_tags_removed_by_fkey ( id, display_name, role )'
     )
     .eq('debate_id', options.debateId)
     .order('created_at', { ascending: false })
     .limit(limit)
   ```
   RLS gates the result; for an admin it returns every `point_tags` row in that
   debate. For a non-admin (defense-in-depth) it returns only rows on arguments
   they can already see.
4. On `error` → `throw new Error('loadMetadataAuditEvents failed: ' + msg)`.
5. **Row-to-events expansion** — for each raw row call
   `expandPointTagRowToEvents(row)` → flatten to a single `MetadataAuditEvent[]`.
6. **Actor-side enrichment** — collect every distinct `actorId` across the
   events; one caller-scoped query `supabase.from('debate_participants')
   .select('user_id, side').eq('debate_id', options.debateId)
   .in('user_id', actorIds)`; build a `Map<userId, side>`; set each event's
   `actorRole.debateSide` from it (`null` when the actor has no participant row).
7. Sort the **expanded** event list by `occurredAt` (`sortDirection`,
   default `desc`). Note: sorting by `created_at` in the query (step 3) only
   orders the *rows*; a `removed` event's `occurredAt` is `removed_at`, so the
   final chronological sort must happen post-expansion.
8. Return the `MetadataAuditEvent[]`.

### `expandPointTagRowToEvents(row): MetadataAuditEvent[]` — pure adapter

No network. Fully unit-testable. The core of the design.

```ts
/** Expand one persisted point_tags row into its audit events:
 *  - always one 'applied' event (created_at / tagged_by);
 *  - one 'removed' event when removed_at is set (removed_at / removed_by).
 *  actorRole.debateSide is left null here — loadMetadataAuditEvents fills it
 *  via the debate_participants lookup. */
export function expandPointTagRowToEvents(
  row: RawPointTagAuditRow,
): MetadataAuditEvent[];
```

- `applied` event: `eventId = '${row.id}:applied'`, `kind = 'applied'`,
  `occurredAt = row.created_at`, `actorId = row.tagged_by`,
  `actorDisplayName` + `actorRole.appRole` from the `tagger` embed.
- `removed` event (only when `row.removed_at != null`):
  `eventId = '${row.id}:removed'`, `kind = 'removed'`,
  `occurredAt = row.removed_at`, `actorId = row.removed_by`,
  `actorDisplayName` + `actorRole.appRole` from the `remover` embed.
- `tagCode` is validated against `ALL_MANUAL_TAG_CODES`; an unrecognized code is
  dropped defensively (the `CHECK` constraint makes this near-impossible, but
  the adapter never trusts raw input — matches `asTagCodes` in
  `adminArgumentsApi.ts`).
- `tagPlainLabel = getManualTagPlainLabel(tagCode)` (from `moveMetadataLedger`,
  which reads `gameCopy.PLAIN_LANGUAGE_COPY`).
- `argumentExcerpt` = whitespace-collapsed `arguments.body` truncated to ~160
  chars (reuse the `shortenBody` helper pattern from `AdminArgumentsTab`).

### `loadAuditDebateOptions(): Promise<AuditDebateOption[]>`

For the debate selector. Returns the debates that actually have `point_tags`
rows (so the admin does not pick an empty debate):

```ts
supabase
  .from('point_tags')
  .select('debate_id, debates!inner ( id, title )')
  .limit(1000)
```

then de-dupe by `debate_id` client-side and sort by `title`. RLS scopes this to
the admin's visible set (all debates for an admin). A simple, bounded query;
1000 is a generous cap for v1's debate count.

### `AdminMetadataEventsTab` component contract

No props — self-contained, mirrors `AdminArgumentsTab` (which also takes no
props). Internal state: `selectedDebateId`, `events`, `loadState`,
`error`, `tagCodeFilter`, `actorRoleFilter`, `kindFilter`, `search`,
`sortDirection`. `useEffect` reloads when `selectedDebateId` / `limit` /
`sortDirection` change.

---

## UI / UX behavior

`AdminMetadataEventsTab` mirrors `AdminArgumentsTab`'s look: a toolbar, a
horizontally scrollable column table, plain-language status copy, and a footnote
disclaimer.

### Layout (top to bottom)

1. **Toolbar row.**
   - **Debate selector.** A horizontally scrollable strip of `Pressable` chips,
     one per `AuditDebateOption`, showing the debate title (truncated). The
     active chip uses the `chipActive` style. Until a debate is selected, the
     table shows a "Pick a debate to load its tag history" prompt. (A chip strip
     mirrors the existing `AdminArgumentsTab` limit chips; a full dropdown is
     unnecessary for v1's debate count and would add a dependency.)
   - **Search `TextInput`** — filters loaded events by argument excerpt, actor
     display name, debate title, or tag plain label (client-side, like
     `AdminArgumentsTab`'s search).
   - **Refresh `Pressable`.**
2. **Filter chip rows** (three groups, each a wrapping row of `Pressable`
   chips):
   - **Tag code** — an "All" chip + one chip per `ManualTagCode`, each labeled
     with its plain label from `gameCopy` (never the raw code). Single-select.
   - **Actor role** — `All` / `Admin` / `Moderator` / `Affirmative` /
     `Negative` / `Observer`. Single-select. Filters on the actor's current
     `appRole` + `debateSide` (§"actor-role column gap").
   - **Event kind** — `All` / `Applied` / `Removed`. Single-select. This is the
     "applied-vs-removed" chip the card asks for; it replaces the dropped
     "lifecycle transition" chip (§0.4).
3. **Sort status line** — `Sorted by: Created ↓ (Newest first)` /
   `↑ (Oldest first)`, plain-language, mirroring `AdminArgumentsTab`.
4. **Actor-role legend line** — *"Role and side shown are the actor's current
   values, not necessarily their role when the tag was applied."* (Honest
   labeling per §0.3.)
5. **The table** — wrapped in a horizontal `ScrollView` so columns never
   collapse, exactly like `AdminArgumentsTab`. Columns:

   | Column | Content |
   |---|---|
   | **Event** | A badge: `Applied` (neutral blue) or `Removed` (neutral slate). Shape + text carry meaning, not color alone (a11y §"color is never the only signal"). |
   | **Created** | Sortable header (`Pressable`, `accessibilityRole="button"`, `accessibilityState={{ selected }}`). Absolute (`formatDateTime`) + relative (`formatRelativeShort`) as two stacked `<Text>` — the established `AdminArgumentsTab` pattern. |
   | **Debate** | Debate title (or `Room <shortId>` fallback). |
   | **Move** | The tagged argument's side badge + excerpt (`numberOfLines` clamped). |
   | **Tag** | The tag's plain-language label badge (`gameCopy`), e.g. "Needs source", "Tangent / side issue". Never the raw `tag_code`. |
   | **Actor** | Actor display name (or `shortId` fallback) + a small "current role" sub-line: e.g. `Admin` or `Participant · Affirmative`. |

6. **Footnote** — `Showing N of M. This is an audit view of tag activity;
   the app records who applied or removed a tag and when — it makes no judgment
   about any person.` (Fact-only framing, mirrors `AdminArgumentsTab`'s
   advisory footnote.)

### Sort

- Default `Created ↓` (newest event first). Tapping the `Created` header toggles
  `desc`/`asc`. Sort is on `MetadataAuditEvent.occurredAt` using real
  `Date.getTime()` comparison (the `adminArgumentsSort` pattern). Because an
  `applied` and a `removed` event from the same row have different timestamps,
  the chronological order interleaves rows correctly only after expansion —
  the sort runs on the expanded list (§"loadMetadataAuditEvents" step 7).

### Filtering

All three chip filters + the search box compose with `useMemo` over the loaded
`events` array (client-side, no refetch — same as `AdminArgumentsTab`'s search).
An "All" chip in each group means "no constraint from this group."

### Accessibility (per accessibility-targets)

- Every `Pressable` (debate chip, filter chip, sortable header, refresh) gets
  `accessibilityRole="button"` (or `"tab"` where appropriate),
  `accessibilityLabel`, and `accessibilityState={{ selected }}` for the
  active chip / sort column. Sortable header also gets an `accessibilityHint`
  describing the current sort direction (the `SortableHeader` component in
  `AdminArgumentsTab` is the exact template).
- All chips meet the **44×44** hit target via padding or `hitSlop`.
- Every string is inside a `<Text>` — no raw strings in `<View>`.
- The `Applied`/`Removed` event badge distinguishes by **text + shape**, not
  color alone (grayscale-legible).
- Loading / error / empty / filtered-empty states each have an
  `accessibilityLabel`ed status `<Text>` (mirrors `AdminArgumentsTab`'s
  `admin-arguments-loading` / `-error` / `-empty` / `-empty-filtered`).
- Color contrast on badges and body text follows WCAG AA — reuse
  `AdminArgumentsTab`'s `Badge` palette (already in-repo and passing).
- testIDs follow the `admin-arguments-*` convention:
  `admin-metadata-events-table`, `admin-metadata-events-header-created`,
  `admin-metadata-events-cell-created`, `admin-metadata-events-debate-selector`,
  `admin-metadata-events-filter-tag`, `admin-metadata-events-filter-role`,
  `admin-metadata-events-filter-kind`, plus loading/error/empty labels.

---

## Edge cases

The implementer must handle each of these:

1. **No debate selected.** `loadMetadataAuditEvents` returns `[]`; the tab shows
   "Pick a debate above to load its tag history." No query is issued.
2. **Selected debate has zero `point_tags` rows.** Query returns `[]`; tab shows
   "No tag activity in this debate yet. When a participant applies or removes a
   tag here it will appear, newest first."
3. **`point_tags` row with `removed_at` null** → expands to exactly **one**
   `applied` event. The most common case.
4. **`point_tags` row with `removed_at` set** → expands to **two** events
   (`applied` + `removed`), which may sort apart (a tag applied Monday and
   removed Friday produces two rows far apart in the chronological list). Tests
   assert both events appear with correct `occurredAt` and `actorId`.
5. **`removed_by` is null but `removed_at` is set.** META-1A's
   `removed_by` is `references … on delete set null` — the remover's profile
   could be deleted. The `removed` event still renders, with `actorId = null`,
   `actorDisplayName = null` → the Actor column shows `—` (em dash), exactly
   like `AdminArgumentsTab`'s `shortenId(null)` fallback. No crash.
6. **`tagged_by` profile deleted.** `tagged_by` is `on delete cascade` in
   META-1A — if the tagger's profile is deleted the whole `point_tags` row is
   gone, so this case cannot produce an orphan `applied` event. (Noted so the
   implementer does not write defensive code for an impossible state, but the
   `tagger` embed should still be null-guarded since PostgREST embeds can be
   null for other reasons.)
7. **Argument soft-deleted (`arguments.status = 'deleted'` /
   `is_deleted = true`).** The `arguments!inner` embed still returns the row
   (admin RLS reads deleted arguments). The audit event still renders; the Move
   column shows the excerpt plus a small "deleted move" sub-label so the admin
   knows the move no longer appears in the room. The tag history is preserved —
   that is the point of an audit log.
8. **Argument in a different debate than `point_tags.debate_id`.** Should be
   impossible (META-1A's `pt_insert_eligible` RLS requires `a.debate_id =
   debate_id`), but the adapter cross-checks `arguments.debate_id ===
   row.debate_id` and, on mismatch, still renders the event with a console-free
   internal marker (no `console.log` — per TS conventions) — the test asserts
   the mismatch does not crash the adapter.
9. **Empty / malformed raw row** (null `id`, missing embed). The adapter
   returns `[]` for a row it cannot key, rather than throwing — a single bad row
   never blanks the whole page.
10. **Very large debate (hundreds of tags).** `limit` caps the `point_tags`
    fetch at 500 rows → up to 1000 expanded events. The body `ScrollView` and
    `useMemo` filters handle this; no pagination control in v1 (the card does
    not require it — admins refine with filters + the debate scope). If a debate
    exceeds 500 tags, the footnote `Showing N of M` makes the cap visible.
11. **Non-admin somehow reaches the tab.** `AdminScreen` is already gated by
    role-based navigation; additionally RLS returns only the caller's visible
    `point_tags` rows. A non-admin would see at most their own debates' tags,
    never the global log. No global audit leaks. (Acceptance criterion "RLS
    prevents non-admin" — satisfied by RLS, §0.6.)
12. **Network failure / offline.** The caller-scoped `select` rejects; the
    loader throws; the tab catches into the `error` state with actionable copy
    ("Could not load tag history. Check admin access and try again."). No
    partial render. Manual `Refresh` retries (the card explicitly says "admins
    refresh manually" — no realtime).
13. **Two events with the identical `occurredAt`** (e.g. a tag applied and an
    unrelated tag applied in the same millisecond). The sort is stable; the
    secondary key is `eventId` (deterministic) so the order is reproducible and
    tests are not flaky.
14. **`debate_participants` lookup returns no row for an actor** (an admin who
    tagged a move in a debate they never formally joined). `actorRole.debateSide
    = null`; the Actor column shows just the `appRole` (e.g. `Admin`) with no
    side — honest, no fabricated side.
15. **Doctrine edge — does tag volume imply the tagger is abusive?** No. The
    surface counts and lists events as neutral facts. It must **never** render a
    derived judgment like "frequent tagger" / "spam tagger" / any label about
    the person. `Showing N of M` is a count of *events*, presented without
    characterization. The ban-list test enforces this. An admin draws their own
    conclusion; the app states only what happened.
16. **Doctrine edge — does heat / popularity affect the audit?** No. `point_tags`
    has no engagement column; the audit surface has no count-weighting, no
    ranking by reach, no "trending tag." Events are listed chronologically,
    full stop.

---

## Test plan

Build-phase responsibility. Tests ship **with** the card (test-discipline — not
a follow-up). Pure logic is **executed**; the component is rendered with the
React Testing Library patterns already used by `adminArguments.test.ts` /
`adminArgumentsSort.test.ts`.

- `__tests__/adminMetadataEventsApi.test.ts`:
  - **`expandPointTagRowToEvents` (pure adapter, the core):**
    - `removed_at` null → exactly 1 `applied` event; correct `eventId`,
      `occurredAt = created_at`, `actorId = tagged_by`,
      `actorRole.appRole` from the tagger embed.
    - `removed_at` set → 2 events; the `removed` event has
      `occurredAt = removed_at`, `actorId = removed_by`,
      `actorRole.appRole` from the remover embed.
    - `removed_at` set but `removed_by` null → `removed` event with
      `actorId = null`, `actorDisplayName = null` (edge case #5).
    - `tag_code` outside `ALL_MANUAL_TAG_CODES` → event dropped (defensive).
    - Malformed row (null `id`) → returns `[]`, no throw (edge case #9).
    - `tagPlainLabel` equals `getManualTagPlainLabel(tagCode)` for all 10 codes.
  - **`loadMetadataAuditEvents` (mock `supabase`):** asserts the committed
    `select` string contains `point_tags`, the four embeds, `.eq('debate_id',
    …)`, `.limit(...)`; `debateId: null` → `[]` with no query; the post-
    expansion sort is by `occurredAt` (an `applied` Monday + a `removed` Friday
    from one row interleave correctly with other rows); `error` → throws.
  - **Actor-side enrichment:** given a `debate_participants` mock, each event's
    `actorRole.debateSide` is filled; an actor with no participant row →
    `debateSide: null` (edge case #14).
  - **`loadAuditDebateOptions`:** de-dupes by `debate_id`, sorts by title.
  - **Doctrine ban-list:** `tagPlainLabel` for every code, and every static
    string the data layer can emit, contain no token from
    `_forbiddenMetadataTokens()` (imported from `moveMetadataLedger.ts`).
  - The file imports no `SUPABASE_SERVICE_ROLE` / `ANTHROPIC_API_KEY`.
- `__tests__/adminMetadataEventsTab.test.tsx`:
  - Renders a row per event from a mocked loader; an applied+removed row
    produces two visible rows.
  - **Tag-code chip** filters to one code; **actor-role chip** filters to one
    role; **event-kind chip** filters Applied vs Removed; search narrows by
    excerpt / actor / title.
  - The `Created` header `Pressable` toggles sort direction; the sort-status
    `<Text>` updates.
  - The debate selector switches `selectedDebateId` and triggers a reload.
  - Loading / error / empty / filtered-empty states each render their
    `accessibilityLabel`ed status text.
  - **Accessibility:** every interactive element has `accessibilityRole` +
    `accessibilityLabel` + `accessibilityState`; the sortable header exposes a
    direction `accessibilityHint`.
  - **Fact-only ban-list scan:** collect every rendered string in the tab and
    assert none contains a verdict / person-attribution token (`winner`,
    `loser`, `liar`, `bad faith`, `abusive`, `spam tagger`, `troll`, `bot`,
    `manipulative`, `true`, `false`, `correct`, etc. — reuse
    `_forbiddenMetadataTokens()`).
  - The actor-role legend ("current values, not … when the tag was applied")
    is present — guards the honest-labeling decision (§0.3).
- **Admin-RLS regression note (cannot run pre-merge):** the *behavioral* claim
  "a non-admin sees only their own debates' tags, an admin sees all" depends on
  live RLS and cannot be unit-tested without a migrated DB. The pre-merge gate
  is the test suite above + `npm run typecheck` + `npm run lint`. The operator
  performs a **post-merge RLS smoke** (see §"Operator steps"). The unit tests
  cover everything that does *not* need a live DB: the adapter, the loader call
  shape, the filters, the sort, the a11y attributes, the ban-list.

Estimated test-count delta: **~55 tests**, **2 new suites**. The implementer
captures the exact count from `npm run test` and updates `docs/current-status.md`
(test-discipline §"Test count tracking").

---

## Dependencies (cards / docs / files)

- **Assumes META-1A is merged** — META-1C reads the `public.point_tags` table,
  its `created_at` / `removed_at` / `tagged_by` / `removed_by` columns, and its
  `arguments` / `debates` / `profiles` FKs. META-1A's design doc
  (`docs/designs/META-1A.md` §0) and migration
  (`supabase/migrations/20260517000009_meta_1a_point_tags.sql`) are the source
  of truth for the table shape. **META-1A is merged** — confirmed.
- **Assumes META-001 is merged** — `src/features/metadata/moveMetadataLedger.ts`
  provides `ManualTagCode`, `ALL_MANUAL_TAG_CODES`, `getManualTagPlainLabel`,
  and `_forbiddenMetadataTokens()` (the ban-list source). META-1C imports these;
  it does not redefine the vocabulary.
- **Reads `src/features/admin/adminArgumentsApi.ts`** at `loadAdminArguments` —
  the established direct-admin-RLS-read pattern META-1C copies (raw-row
  interface + `as*` join-flatteners + caller-scoped `select` + embedded joins).
- **Reads `src/features/admin/AdminArgumentsTab.tsx`** — the component template
  (toolbar, horizontally-scrollable column table, `SortableHeader`, `Badge`,
  status states, footnote). META-1C reuses the visual grammar.
- **Reads `src/features/admin/AdminScreen.tsx` + `types.ts`** — the tab registry
  being extended with `'metadata_events'`.
- **Reads `src/lib/formatDateTime.ts`** (`formatDateTime`, `formatRelativeShort`)
  and `src/features/arguments/gameCopy.ts` (`PLAIN_LANGUAGE_COPY`, via
  `getManualTagPlainLabel`).
- **Does NOT block any known card.** META-1C is a leaf admin surface.
- Future card (not blocked, just enabled): if auto-metadata / lifecycle-causation
  events are ever persisted, a follow-up could extend this tab to audit them
  (§"Out of scope").

---

## Risks

- **PostgREST dual-`profiles`-embed disambiguation.** `point_tags` FKs
  `profiles` twice (`tagged_by`, `removed_by`). The `select` string must
  disambiguate each embed by its FK constraint name
  (`point_tags_tagged_by_fkey` / `point_tags_removed_by_fkey`). *Mitigation:*
  the names follow Postgres's standard inline-FK auto-naming; the implementer
  confirms them with `npx supabase db status` / a quick SQL inspection against
  the migrated DB, and `adminMetadataEventsApi.test.ts` asserts the exact
  committed `select` string. If a name differs, only the embed alias hint
  changes — a one-line fix. The `tagger:` / `remover:` aliases keep the mapper
  readable.
- **`removed` events sort apart from their `applied` events.** Because a row
  expands to two events with different timestamps, the chronological list
  interleaves a tag's apply and remove with unrelated events. This is
  *intended* (it is a true chronological audit), but a reviewer might mistake it
  for a bug. *Mitigation:* documented here and in §"loadMetadataAuditEvents";
  the test suite asserts the interleaving explicitly so the behavior is locked.
- **The actor-role "at the time" gap.** The card asks for apply-time role;
  `point_tags` cannot supply it (§0.3). Showing the *current* role is the honest
  resolution but a reviewer expecting the literal card text may flag it.
  *Mitigation:* the column header and a legend line state plainly that the role
  is current, not historical; the test asserts the legend is present. If product
  later wants a true apply-time role, that needs a `point_tags` schema change
  (additive migration) and a write-path change in `apply-manual-tag` — out of
  scope, flagged to the operator.
- **No realtime — stale view between refreshes.** The card explicitly says
  "admins refresh manually." An admin investigating an active incident sees a
  snapshot. *Mitigation:* this is the card's stated design; the manual
  `Refresh` button is prominent. Realtime is META-1B's territory, not META-1C.
- **`loadAuditDebateOptions` 1000-row cap.** If the app ever has thousands of
  debates with tags, the debate selector could miss some. *Mitigation:* v1's
  debate count is far below this; the cap is generous. A future card can swap
  the chip strip for a searchable selector if needed. Noted, not blocking.
- **Component-test environment.** `AdminMetadataEventsTab` renders RN primitives
  under JSDOM. `adminArguments.test.ts` already does this for `AdminArgumentsTab`
  — the pattern works. *Mitigation:* copy that suite's setup exactly.
- **No live-RLS pre-merge verification.** As with META-1A, the RLS *behavior*
  cannot be proven before a migrated DB exists. *Mitigation:* the unit suite
  carries maximum confidence on everything DB-independent; the operator runs a
  post-merge RLS smoke (§"Operator steps").

---

## Out of scope

- **Any new Edge Function.** §0.1 / §"Footprint decision" — the direct
  admin-RLS read is the recommended, lighter, doctrine-correct approach.
- **Any new migration / schema change.** §0.2 — admins can already SELECT all
  `point_tags` rows transitively via `arguments` RLS.
- **Auditing auto-derived metadata or lifecycle-causation events.** §0.4 —
  those `MetadataEvent` families are render-time-derived in memory and were
  never persisted. The "lifecycle transition" filter chip is dropped. Auditing
  them would first require a card to *persist* them; META-1C audits the
  persisted `point_tags` (manual tags) only.
- **A true apply-time actor role.** §0.3 — `point_tags` stores no apply-time
  role; META-1C shows the current role, honestly labeled. A historical role
  would need an additive `point_tags` column + an `apply-manual-tag` write
  change — a separate card.
- **Realtime updates of the audit log.** The card says admins refresh manually.
  Realtime is META-1B's scope.
- **Bulk delete / edit of audit entries.** The card forbids it; the underlying
  `point_tags` table is soft-delete-only and META-1C is a read-only *view*.
- **Cross-debate / global audit view.** The card scopes the surface to a single
  debate; META-1C always requires a `debateId`. A global view is a possible
  future card.
- **Pagination controls.** v1 caps at 500 rows / 1000 events per debate and
  relies on the debate scope + filters; the card does not require paging.
- **Exporting the audit log** (CSV, etc.) — not in the card.
- **Acting on the audit** (warning a user, removing a tag from this surface) —
  META-1C is read-only; tag removal stays in the room via `apply-manual-tag`.

---

## Doctrine self-check

**cdiscourse-doctrine:**
- §1 *No truth labels; score never blocks posting.* The surface renders tag
  *codes* (10 META-001 gameplay codes) via their plain-language labels and
  states neutral facts: who applied/removed a tag, when, on which move. It
  renders **no** verdict about any person or claim. The footnote says so
  explicitly ("makes no judgment about any person"). A ban-list test scans every
  rendered string against `_forbiddenMetadataTokens()`. META-1C touches no
  posting path. ✓
- §2 *Heat means activity.* No heat concept appears; events are listed
  chronologically with no count-weighting or reach-ranking. ✓
- §3 *Popularity is not evidence.* `point_tags` has no engagement column; the
  audit surface has no popularity input, no "trending tag", no ranking. ✓
- §4 *AI moderator limits.* META-1C makes **no AI call** — it is a pure
  client-side read + a pure adapter. ✓
- §6 *Secrets policy.* `adminMetadataEventsApi.ts` and
  `AdminMetadataEventsTab.tsx` import **no** `SUPABASE_SERVICE_ROLE_KEY` /
  `ANTHROPIC_API_KEY` — they use the standard caller-scoped `supabase` client
  from `src/lib/supabase.ts`. A test asserts the absence. ✓
- §7 *No AI calls from the production app.* None added. ✓
- §8 *Supabase conventions.* No migration is written, so no RLS is disabled and
  no applied migration is edited. The surface is **read-only**; it never
  inserts, updates, or deletes `point_tags` (which is itself soft-delete-only).
  The audit view is append-only by construction — it reflects an append-only
  table. ✓
- §9 *Plain language for users.* Every tag is shown via
  `getManualTagPlainLabel` → `gameCopy.PLAIN_LANGUAGE_COPY`. No raw `tag_code`
  (`needs_source`, `scope_issue`, …) reaches a user-facing string. No new copy
  token is added. A ban-list test enforces no internal code leaks. ✓
- §10 *v1 scope guards.* No voting, no winner, no real-time editing, no OAuth,
  no public API, no push, no argument search. An admin audit *view* of an
  existing table is none of these — it is a read lens, not a new system. ✓

**supabase-edge-contract:**
- *No service-role in client.* META-1C adds no Edge Function and no service-role
  usage anywhere. The data layer uses the caller-scoped `supabase` client only.
  ✓
- *No direct writes to protected tables.* META-1C performs **zero writes**. It
  reads `point_tags` / `arguments` / `debates` / `profiles` /
  `debate_participants` via caller-scoped `select` — the documented read
  exception. ✓
- *RLS always on; migrations append-only.* No migration written; no RLS
  touched. Existing RLS (`pt_select_read_access` + `arguments` admin clause) is
  the enforced access boundary. ✓
- *Audit-table pattern.* The surface is a read-only audit *view*: SELECT only,
  no UPDATE/DELETE path exposed — consistent with the audit-table doctrine
  (`admin_audit_events` is also SELECT-for-admins, no update/delete). ✓
- *Admin-read pattern.* META-1C follows the `AdminArgumentsTab` /
  `adminArgumentsApi` precedent: a direct caller-scoped admin-RLS read, not an
  Edge Function — the established repo pattern, endorsed verbatim in the
  `adminArgumentsApi.ts` file comment. ✓

**accessibility-targets:**
- Every `Pressable` (debate chip, three chip groups, sortable header, refresh)
  gets `accessibilityRole` + `accessibilityLabel` + `accessibilityState`;
  the sortable header adds a direction `accessibilityHint`. ✓
- All chips meet the 44×44 hit target (padding / `hitSlop`). ✓
- The `Applied`/`Removed` badge carries meaning by **text + shape**, not color
  alone — grayscale-legible. ✓
- All text is inside `<Text>`; loading/error/empty/filtered-empty states each
  have an `accessibilityLabel`ed status `<Text>`. ✓
- Badge + body-text contrast follows WCAG AA (reuses `AdminArgumentsTab`'s
  passing `Badge` palette). ✓
- The component test asserts the a11y attributes are present. ✓

**test-discipline:**
- Tests ship with the card: 2 new suites, ~55 tests — the pure adapter
  (`expandPointTagRowToEvents`) is **executed** across applied-only,
  applied+removed, null-remover, bad-code, and malformed-row cases; the loader
  call shape, the three filters, the sort toggle, the a11y attributes, and the
  doctrine ban-list are all covered. No `.skip` / `.only`. Test count goes up.
  The fact-only ban-list test is included. ✓

---

## Operator steps

**None — pure code change.**

META-1C adds **no migration** (§0.2 — admins can already SELECT all `point_tags`
rows via the transitive `arguments` RLS clause) and **no Edge Function** (§0.1 /
§"Footprint decision" — the direct admin-RLS read is the recommended pattern).
There is nothing to `db push` and nothing to `functions deploy`. The feature
ships entirely in client code and is live the moment the PR merges, provided
META-1A's migration has already been applied to the target environment (which
it must be, since META-1A is merged and the table must exist for the tab to
return anything).

**Recommended post-merge RLS smoke (operator, optional but advised** — confirms
the RLS *behavior* the unit tests cannot exercise without a live DB):

1. As an **admin**, open the new **Metadata Events** admin tab, pick a debate
   that has tags → expect the chronological event list, including both an
   `Applied` and a `Removed` event for any tag that was soft-deleted.
2. As a **non-admin** participant of one debate, confirm the admin tab is not
   reachable via navigation; if reached directly, confirm the loader returns
   only that user's own visible debates' tags — never the global log.
3. Confirm a tag applied then removed shows as **two** rows with the correct
   actors (`tagged_by` for `Applied`, `removed_by` for `Removed`) and correct
   timestamps.

If META-1A's migration has **not** been applied in an environment, the tab's
query errors against a missing `point_tags` table and the tab shows its error
state — the operator should ensure META-1A's `db push` ran first (it must have,
for META-1A itself to function).
