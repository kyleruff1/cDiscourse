# META-1A — Persisted manual-tag ledger (point_tags table + Edge Function)

**Status:** Design draft
**Epic:** Rules UX / Metadata (Release 6.6 family — Timeline Tree Game Board; META card line)
**Release:** 6.8 (v2 boundary; operator-approved for implementation)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/76

---

## 0. Card-vs-reality discrepancies (read first)

Every prior card had several. META-1A is no exception. The implementer must
build against **reality**, not the card text, where the two disagree.

| # | Card says | Reality | Resolution |
|---|---|---|---|
| 0.1 | "extend the existing `loadDebateArguments` pipeline" | There is **no function named `loadDebateArguments`**. The room-shell loader is `useArgumentRoomMessages(debateId)` (`src/features/arguments/useArgumentRoomMessages.ts`), which calls `listArgumentsForDebate()` then `fetchArgumentRelations(ids)` (`src/features/arguments/argumentsApi.ts`). | Extend **`fetchArgumentRelations`** to also fetch `point_tags` rows, and thread a new `manualTagsByArgumentId` map through `useArgumentRoomMessages` → `ArgumentGameSurface.tsx`. The card's "loadDebateArguments" is conceptual, not a literal symbol. |
| 0.2 | Migration file is `supabase/migrations/NNNN_point_tags.sql` with sequential numbering `0001_`, `0002_` (CLAUDE.md §"Supabase Conventions") | Real migrations use **UTC-timestamp prefixes**, not `NNNN`. Last applied is `20260517000008_stage6_1_8_argument_deletion_requests.sql`. | Next file: **`supabase/migrations/20260517000009_meta_1a_point_tags.sql`**. The supabase-edge-contract skill confirms the timestamp convention; CLAUDE.md's `0001_` text is stale shorthand. |
| 0.3 | Card says tests cover "the 80-case eligibility matrix" | The matrix has **10 tag codes × 4 actor roles × 2 own-bubble values = 80 enumerated cases**, but only **40 are distinct decisions** — observer and admin ignore the own-bubble flag, so 20 of the 80 are duplicates. META-001's own `manualTagModel.test.ts` already iterates all 80. | Keep the **80-case** iteration for parity with META-001's existing test (it is the established convention), but the design notes that 40 are distinct. The Edge Function eligibility check reuses the *same* `isApplyAllowed` logic — see §"Doctrine self-check". |
| 0.4 | "`tag_code` (text, enum-constrained)" | Postgres "enum-constrained" in this repo means a `CHECK (tag_code IN (...))` constraint, **not** a `CREATE TYPE ... AS ENUM`. Every existing table (`arguments.argument_type`, `argument_deletion_requests.status`, etc.) uses `CHECK IN`. | Use a `CHECK (tag_code IN (<10 META-001 codes>))` constraint. A pg enum type would be harder to extend and is not the repo pattern. |
| 0.5 | "`tagged_by` (FK profiles)" | The deletion-requests table FKs `requester_id` to **`auth.users(id)`**, while `arguments.author_id` / `debates.created_by` / `argument_tags.created_by` FK to **`public.profiles(id)`**. Mixed precedent. | FK `tagged_by` to **`public.profiles(id)`** — `point_tags` is a gameplay-annotation table parallel to `argument_tags`, and `argument_tags.created_by` is the closest analog. RLS uses `auth.uid()` which equals `profiles.id` anyway. |
| 0.6 | Card scope: insert + soft-delete | The card does not name a **toggle/remove** client path, but META-001's in-memory model has both `applyManualTag` and `removeManualTag`. A persisted ledger needs a remove path or tags can never be un-applied. | The Edge Function gets a **two-action** shape (`apply` / `remove`) so the client can both insert and soft-delete (`removed_at`). This is in-scope: the card explicitly lists "soft-delete via `removed_at`" as an acceptance criterion, and there is no other write path. |
| 0.7 | RLS: "soft-delete via `removed_at`" | The card implies clients soft-delete directly. But CLAUDE.md + supabase-edge-contract say **the Edge Function is the only write path** ("no direct insert from client"). A direct-client `UPDATE removed_at` would be a second write path. | **No client `UPDATE` policy.** Soft-delete goes through the Edge Function (action `remove`), which performs the `UPDATE` via the **caller-scoped client** (RLS still applies — see §"RLS"). The `point_tags` UPDATE RLS policy is scoped so the original tagger or an admin can set `removed_at`, and the Edge Function is the enforced path. |
| 0.8 | Eligibility "checked against `MANUAL_TAG_ELIGIBILITY_TABLE`" | `MANUAL_TAG_ELIGIBILITY_TABLE` lives in `src/features/metadata/manualTagModel.ts` — a **client-side TS module** that the Deno Edge Function cannot import (different module graph, no shared path alias). The Stage 6.1.8 / admin-users functions never import from `src/`. | The eligibility table must be **mirrored** into a `supabase/functions/_shared/` module, exactly like `_shared/adminSchemas.ts` mirrors client schemas. A `__tests__/pointTagsEligibilityMirror.test.ts` asserts the mirror byte-equals the client table. This is the established `adminSchemas.test.ts` mirror pattern. |
| 0.9 | "Caller's role + own-bubble status" | The Edge Function must know (a) is the caller a debate participant / observer / admin, and (b) is the target argument the caller's own bubble. The card does not say how. | Derive role from `debate_participants.side` (`affirmative`/`negative` → participant; `observer` → observer; `moderator` → treated as participant-other unless also `profiles.role IN ('moderator','admin')`) plus `profiles.role` for admin. Own-bubble = `arguments.author_id === caller`. See §"Edge Function — eligibility derivation". |
| 0.10 | "`point_tags` table" name | There is already a `tag_definitions` / `argument_tags` pair (constitution-governed argument tags) and a `tags` concept. `point_tags` is distinct (META-001 gameplay tags). | Name confirmed: **`public.point_tags`**. The doctrine guardrail in META-001 (manual tag ≠ moderation flag ≠ constitution `argument_tags`) means `point_tags` must NOT reference `tag_definitions`. They are different vocabularies. |

None of these block the card. They are scoping corrections the implementer must apply.

---

## Goal (one paragraph)

META-001 shipped the manual-tag vocabulary, the eligibility matrix, and an
*in-memory* ledger: when a participant tags a move `needs_source`, that tag
lives only in the room shell's React state and disappears on reload — and is
invisible to every other participant. META-1A elevates the manual-tag ledger to
a **persisted, shared gameplay artifact** by adding a `point_tags` table with
RLS, an `apply-manual-tag` Edge Function as the single write path, a client
wrapper, and a loader extension so the room shell hydrates persisted tags on
every argument refresh. Doctrine constraints that shape the design:
manual tags are **gameplay signals, never verdicts** (cdiscourse-doctrine §1 —
no truth/winner/loser labels in any code, label, or RLS comment); the
**Edge Function is the only write path** (supabase-edge-contract — no direct
client insert/update); **soft-delete only** (`removed_at`, never hard-delete —
CLAUDE.md §"Supabase Conventions"); **RLS always on** and **migrations are
append-only**; and the eligibility matrix is enforced **server-side** against a
mirror of META-001's `MANUAL_TAG_ELIGIBILITY_TABLE` (evidence-doctrine — a
gameplay signal is participant-applied, observers may never apply, popularity
never feeds it). META-1A adds no truth claim, no scoring, no AI call.

---

## Data model

### New table — `public.point_tags`

```sql
create table if not exists public.point_tags (
  id          uuid        primary key default gen_random_uuid(),
  debate_id   uuid        not null references public.debates(id)   on delete cascade,
  argument_id uuid        not null references public.arguments(id) on delete cascade,
  tag_code    text        not null,
  tagged_by   uuid        not null references public.profiles(id)  on delete cascade,
  created_at  timestamptz not null default now(),
  removed_at  timestamptz,                      -- NULL = active; set = soft-deleted
  removed_by  uuid        references public.profiles(id) on delete set null,

  constraint point_tags_tag_code_check check (tag_code in (
    'needs_source', 'needs_quote', 'definition_issue', 'scope_issue',
    'causal_mechanism', 'evidence_debt', 'concession_offered',
    'narrowed_claim', 'tangent', 'ready_for_synthesis'
  ))
);
```

Notes:
- `tag_code` `CHECK IN` lists the **10 META-001 `ManualTagCode` values verbatim**
  (`src/features/metadata/moveMetadataLedger.ts` `ALL_MANUAL_TAG_CODES`). The
  migration includes a SQL comment pointing back to that source of truth.
- `removed_by` records which user (original tagger or admin) soft-deleted the
  row — useful for META-1C audit, harmless now. Nullable.
- **No `note` column.** META-001's `ManualTagEntry.note` is "reserved for v2
  audit UI" and is not rendered anywhere. Out of scope (see §"Out of scope").
  Adding it later is a separate, additive migration.
- **No `updated_at` / `set_updated_at` trigger.** The only mutation is the
  `removed_at` soft-delete; `created_at` + `removed_at` fully describe lifecycle.

### Indexes

```sql
create index if not exists point_tags_argument_idx
  on public.point_tags (argument_id) where removed_at is null;
create index if not exists point_tags_debate_idx
  on public.point_tags (debate_id)   where removed_at is null;
```

Both are **partial indexes on active rows** — the room-shell loader always
filters `removed_at is null`, so the partial index keeps it tight.

### Dedupe — one active tag per (argument, tag_code, tagger)

META-001's `makeManualTagDedupeKey(code, userId)` = `${code}:${userId}`. The
in-memory model is idempotent: the same applier cannot apply the same code
twice on the same message. Persist that as a **partial unique index**:

```sql
create unique index if not exists point_tags_one_active_per_tagger
  on public.point_tags (argument_id, tag_code, tagged_by)
  where removed_at is null;
```

A soft-deleted row does not block re-applying — the user can remove a tag and
re-apply it later (matches META-001 edge case #9, "oscillating tags").

### Client TypeScript shape (new)

In `src/features/metadata/pointTagsApi.ts` (new file):

```ts
/** A persisted manual-tag row. Mirrors public.point_tags. */
export interface PersistedPointTag {
  id: string;
  debateId: string;
  argumentId: string;
  tagCode: ManualTagCode;     // imported from moveMetadataLedger
  taggedBy: string;           // profiles.id of the applier
  createdAt: string;          // ISO-8601
  removedAt: string | null;
}
```

These rows are converted into META-001 `ManualTagEntry[]` (the in-memory shape
`buildMoveMetadataLedger` already accepts) by a pure adapter (see §"API").

---

## File changes

### New files

- `supabase/migrations/20260517000009_meta_1a_point_tags.sql` — the `point_tags`
  table, indexes, unique index, RLS enable + 3 policies (insert / select /
  update). **~95 lines.**
- `supabase/functions/apply-manual-tag/index.ts` — the Edge Function. Two
  actions (`apply` / `remove`), JWT-verified, eligibility-checked, insert /
  soft-delete + return the updated active tag list for the argument.
  **~210 lines.**
- `supabase/functions/_shared/pointTagEligibility.ts` — Deno-side mirror of
  META-001's `MANUAL_TAG_ELIGIBILITY_TABLE` + `isApplyAllowed` (the table
  cannot be imported from `src/`; see §0.8). **~110 lines.**
- `src/features/metadata/pointTagsApi.ts` — client wrapper `applyManualTag` /
  `removeManualTag` (Edge Function callers), the `PersistedPointTag` interface,
  and `persistedTagsToManualTagEntries(rows)` pure adapter. **~150 lines.**
- `__tests__/pointTagsMigration.test.ts` — migration roundtrip / shape test
  (source-file assertions; the `argumentDeletionRequest.test.ts` pattern).
  **~120 lines.**
- `__tests__/applyManualTagEdgeFunction.test.ts` — Edge Function contract +
  eligibility-matrix tests (source-file shape + the mirror's `isApplyAllowed`
  exercised directly over the 80-case matrix). **~280 lines.**
- `__tests__/pointTagsApi.test.ts` — client-wrapper call-shape tests +
  `persistedTagsToManualTagEntries` adapter tests. **~190 lines.**
- `__tests__/pointTagsEligibilityMirror.test.ts` — asserts the Deno mirror's
  eligibility table is byte-equivalent to META-001's client table (the
  `adminSchemas.test.ts` mirror-parity pattern). **~80 lines.**

### Modified files

- `src/features/arguments/argumentsApi.ts` — extend `fetchArgumentRelations` to
  also `select` from `point_tags` (filtered `removed_at is null`,
  `.in('argument_id', argumentIds)`), add `pointTags` to the returned
  `ArgumentRelations`. Add a `RawPointTag` interface + `mapPointTag` mapper.
  **~+45 lines.** Existing tag/flag/check fetching stays.
- `src/features/arguments/types.ts` — add `PersistedPointTag` to the
  `ArgumentRelations` interface (`pointTags: PersistedPointTag[]`). Re-export
  or import the type from `pointTagsApi.ts`. **~+5 lines.**
- `src/features/arguments/useArgumentRoomMessages.ts` — collect
  `rel.data.pointTags` into a `pointTagsByArgumentId: Record<string,
  PersistedPointTag[]>` map and add it to `ArgumentRoomMessagesResult`.
  **~+12 lines.** Existing tag/flag/check maps stay.
- `src/features/arguments/ArgumentGameSurface.tsx` — replace
  `manualTagsByMessageId: new Map()` (the v1 empty-map placeholder at line ~281)
  with a `Map` built from `pointTagsByArgumentId` via
  `persistedTagsToManualTagEntries`. Wire the `applyManualTag` /
  `removeManualTag` client wrappers to whatever tag-apply control SC-004 /
  TimelineNodeActionDock exposes, with an **optimistic-then-refresh** update
  (call wrapper → on success, `refresh()` the room messages). **~+35 lines.**
- `src/lib/edgeFunctions.ts` — *optionally* the client wrapper could live here
  beside `requestArgumentDeletion` for consistency. **Decision: keep the
  wrapper in `src/features/metadata/pointTagsApi.ts`** (co-located with the
  META feature) but it MUST route through `supabase.functions.invoke` exactly
  like the other wrappers. If the implementer prefers `edgeFunctions.ts`, that
  is acceptable — but then update `pointTagsApi.test.ts` paths. The design
  assumes `pointTagsApi.ts`. **No change to `edgeFunctions.ts` required.**
- `docs/current-status.md` — bump test count + add the META-1A note after the
  implementer confirms `npm run test`.
- `CLAUDE.md` — bump the "Current stage" line on stage completion (operator /
  implementer per repo convention).

### Deleted files

None.

---

## API / interface contracts

### Edge Function — `apply-manual-tag`

Request body (POST JSON):

```ts
interface ApplyManualTagRequest {
  action: 'apply' | 'remove';
  debateId: string;       // uuid
  argumentId: string;     // uuid
  tagCode: ManualTagCode; // one of the 10 codes
}
```

Success response (`200`):

```ts
interface ApplyManualTagResponse {
  argumentId: string;
  /** The full set of ACTIVE (removed_at IS NULL) tags on the argument
   *  after the mutation — lets the client refresh one bubble without a
   *  full room reload. */
  activeTags: Array<{
    id: string;
    tagCode: ManualTagCode;
    taggedBy: string;     // profiles.id — see privacy note below
    createdAt: string;
  }>;
}
```

Error responses use the existing `_shared/http.ts` envelope:
`401 unauthorized` · `400 bad_request {detail}` · `403 forbidden {reason}` ·
`405 method_not_allowed` · `500 internal_error {detail}`.

Privacy note on `taggedBy`: META-1A returns the `profiles.id` of the tagger,
**not** an email or display name. Per the card ("Never leaks tagger identity
for observers if a future privacy rule requires"), the design keeps `taggedBy`
as an **opaque profile id only** — a follow-up card may strip it for observers.
v1 keeps it because the room shell already renders other participants' ids
(authorship) and META-001's `ManualTagEntry.appliedByUserId` requires it for
the dedupe key. No PII crosses the boundary either way.

Function flow:
1. `OPTIONS` → CORS `ok`. Non-`POST` → `methodNotAllowed()`.
2. Read `Authorization` header. Missing → `unauthorized()`.
3. Parse JSON. Invalid → `badRequest('invalid_json')`.
4. Validate: `action ∈ {apply, remove}`, `debateId`/`argumentId` are UUIDs,
   `tagCode ∈` the 10 codes. Bad → `badRequest('<detail>')`.
5. `createCallerClient(auth)` → `callerClient.auth.getUser()` → `callerId`.
   Failure → `unauthorized()`.
6. Load the target argument via the **caller-scoped client**:
   `callerClient.from('arguments').select('id, author_id, debate_id, status')
   .eq('id', argumentId).maybeSingle()`. RLS gates visibility.
   - Not visible / missing → `forbidden('argument_not_visible')` (no
     existence leak).
   - `debate_id !== debateId` → `badRequest('debate_argument_mismatch')`.
   - `status === 'deleted'` → `badRequest('argument_deleted')`.
7. **Eligibility derivation** (see next subsection) → `EligibilityContext`.
8. `isApplyAllowed(tagCode, eligibilityContext)` from
   `_shared/pointTagEligibility.ts`. `false` → `forbidden('not_eligible')`.
9. `action === 'apply'`:
   - Insert via **caller-scoped client** (RLS `with check` re-verifies — defense
     in depth). On unique-index conflict (`23505`), treat as idempotent success
     (the tag already exists) — re-select and return.
10. `action === 'remove'`:
    - `UPDATE point_tags SET removed_at = now(), removed_by = callerId
      WHERE argument_id = … AND tag_code = … AND tagged_by = callerId
      AND removed_at IS NULL` via the caller-scoped client (admins may also
      remove others' tags — RLS permits, see §"RLS"). No matching active row →
      idempotent success.
11. Re-select active tags for `argumentId` (caller-scoped) → build `activeTags`.
12. Best-effort audit row in `admin_audit_events` via `createServiceClient()`
    (action `point_tag_applied` / `point_tag_removed`, `source: 'edge_function'`,
    payload carries short ids only) — wrapped in `try/catch`; audit failure
    never blocks the user. **This is the ONLY use of the service-role client.**
13. `ok({ argumentId, activeTags })`.

Why the caller-scoped client for the write (not service-role): RLS already
encodes the participant-eligibility rule. Using the caller-scoped client means
the insert/update is **doubly gated** (Edge-Function eligibility check + RLS
`with check`). The service-role client is reserved strictly for the audit row,
matching `request-argument-deletion`'s pattern. The Edge Function is still "the
only write path" because the client wrapper invokes the function, and the
direct-client RLS policy is written so a raw client insert would also have to
satisfy the eligibility predicate (see §"RLS — defense in depth").

### Edge Function — eligibility derivation

```
participantRow := callerClient.from('debate_participants')
                    .select('side').eq('debate_id', debateId)
                    .eq('user_id', callerId).maybeSingle()
profileRow     := callerClient.from('profiles')
                    .select('role').eq('id', callerId).maybeSingle()

isAdmin := profileRow?.role === 'admin'

applierActorRole :=
  isAdmin                                  -> 'admin'
  participantRow?.side === 'affirmative'   -> 'participant_affirmative'
  participantRow?.side === 'negative'      -> 'participant_negative'
  participantRow?.side === 'moderator'     -> (profileRow.role moderator/admin
                                              ? 'admin' : 'participant_affirmative')
  participantRow?.side === 'observer'      -> 'observer'
  no participant row                      -> 'observer'   (not joined = observer)

isOwnBubble := argRow.author_id === callerId

eligibilityContext := { applierUserId: callerId, applierActorRole, isOwnBubble }
```

Then `isApplyAllowed(tagCode, eligibilityContext)` — the **exact same pure
function** as META-001's client model, mirrored into `_shared/`.

Note: META-001's `ManualTagActorRole` distinguishes
`participant_affirmative` / `participant_negative`, but the eligibility table
treats both identically (only `observer` / `admin` / own-vs-other matter). The
derivation maps `side` to a participant role for completeness; the eligibility
outcome does not depend on which side.

### `_shared/pointTagEligibility.ts` (Deno mirror)

Exports, byte-mirrored from `src/features/metadata/manualTagModel.ts` +
`moveMetadataLedger.ts`:

```ts
export type ManualTagCode = /* the 10 codes */;
export const ALL_MANUAL_TAG_CODES: readonly ManualTagCode[];
export type ManualTagActorRole =
  | 'participant_affirmative' | 'participant_negative'
  | 'observer' | 'admin';
export interface ManualTagEligibilityRecord {
  allowOnOwnBubble: boolean; allowOnOtherBubble: boolean;
  allowObserver: boolean; allowAdmin: boolean;
}
export const MANUAL_TAG_ELIGIBILITY_TABLE:
  Readonly<Record<ManualTagCode, ManualTagEligibilityRecord>>;
export interface EligibilityContext {
  applierUserId: string;
  applierActorRole: ManualTagActorRole;
  isOwnBubble: boolean;
}
export function isApplyAllowed(
  code: ManualTagCode, ctx: EligibilityContext): boolean;
```

The mirror file carries a header comment:
`MIRROR of src/features/metadata/manualTagModel.ts — keep byte-identical.
Verified by __tests__/pointTagsEligibilityMirror.test.ts.`

### Client wrapper — `src/features/metadata/pointTagsApi.ts`

```ts
export interface ApplyManualTagOutcome {
  ok: true; data: ApplyManualTagResponse;
}
export interface ApplyManualTagFailure {
  ok: false; error: { error: string; reason?: string; detail?: string };
  status: number;
}
export type ApplyManualTagResult = ApplyManualTagOutcome | ApplyManualTagFailure;

/** Apply a manual tag to a move via the apply-manual-tag Edge Function. */
export async function applyManualTag(
  input: { debateId: string; argumentId: string; tagCode: ManualTagCode },
): Promise<ApplyManualTagResult>;

/** Soft-delete (remove) a manual tag the caller previously applied. */
export async function removeManualTag(
  input: { debateId: string; argumentId: string; tagCode: ManualTagCode },
): Promise<ApplyManualTagResult>;
```

Both route through `supabase.functions.invoke('apply-manual-tag', { body })`
with `action: 'apply' | 'remove'` — identical error-unwrapping shape to
`requestArgumentDeletion` (parse `error.context.json()`, status fallback
`503` for `FunctionsFetchError`).

Pure adapter (no network, fully unit-testable):

```ts
/** Convert persisted point_tags rows into META-001 ManualTagEntry[],
 *  grouped by argumentId, for buildMoveMetadataLedger's
 *  manualTagsByMessageId input. Drops removed_at != null rows. */
export function persistedTagsToManualTagEntries(
  rows: PersistedPointTag[],
): Map<string, ManualTagEntry[]>;
```

The adapter reconstructs each `ManualTagEntry` with:
`code`, `appliedByUserId = taggedBy`, `appliedByActorRole` — **see Edge case #11
below; the persisted row does not store the actor role**, so the adapter sets
`appliedByActorRole` to a stable placeholder (`'participant_affirmative'`) and
the design notes this is a known limitation (the actor role is not used by any
downstream consumer that reads persisted tags; only `dedupeKey` and `code`
matter for rendering). `appliedAt = createdAt`,
`dedupeKey = makeManualTagDedupeKey(code, taggedBy)`, `note = null`.

### Loader extension — `fetchArgumentRelations`

```ts
// new in ArgumentRelations:
pointTags: PersistedPointTag[];

// new query branch inside fetchArgumentRelations Promise.all:
supabase
  .from('point_tags')
  .select('id,debate_id,argument_id,tag_code,tagged_by,created_at,removed_at')
  .in('argument_id', argumentIds)
  .is('removed_at', null)
```

---

## Edge cases

1. **Empty argument list.** `fetchArgumentRelations([])` already returns early
   `{ tags: [], flags: [], checks: [] }`; extend to include `pointTags: []`.
2. **Caller is an observer.** `applierActorRole === 'observer'` →
   `isApplyAllowed` returns `false` for **all 10 codes** → `403 not_eligible`.
   Observers can still SELECT and see persisted tags (RLS select-by-read-access).
3. **Caller is not a participant at all (never joined).** Treated as `observer`
   → cannot apply. SELECT still works if the debate is `open`/`locked` (RLS).
4. **Own-bubble, non-own-allowed tag.** Author applies `needs_source` to their
   own move → eligibility table `allowOnOwnBubble: false` → `403`. Only
   `concession_offered` / `narrowed_claim` / `ready_for_synthesis` succeed on
   own bubble.
5. **Duplicate apply (same tagger, same code, same argument).** Unique partial
   index raises `23505`. The function catches it, re-selects, returns `200`
   with the existing tag — **idempotent**, matches META-001's in-memory dedupe.
6. **Remove a tag that does not exist / already removed.** `UPDATE … WHERE
   removed_at IS NULL` matches 0 rows → idempotent `200`.
7. **Apply on a soft-deleted argument (`status='deleted'`).** →
   `badRequest('argument_deleted')`. No tag is written.
8. **Argument in a different debate than `debateId`.** →
   `badRequest('debate_argument_mismatch')`.
9. **Argument not visible to caller via RLS** (draft in a debate they cannot
   read). → `forbidden('argument_not_visible')` — no existence leak.
10. **Concurrent applies by two participants of the same code on the same
    move.** Different `tagged_by` → different unique-index keys → both succeed
    → two active rows. Matches META-001 "concurrent manual-tag applications".
11. **Persisted row lacks `appliedByActorRole`.** `point_tags` does not store
    the actor role (it can change; the role at apply-time is not load-bearing
    for rendering). The `persistedTagsToManualTagEntries` adapter sets a stable
    placeholder. Documented limitation; no consumer of *persisted* tags reads
    that field.
12. **Network failure / function not deployed.** `supabase.functions.invoke`
    returns a `FunctionsFetchError`; wrapper maps to `status: 503`. The room
    shell shows a non-blocking error and keeps the prior tag state. Tagging
    failing **never blocks posting an argument** (it is a separate action).
13. **Offline.** Same as #12 — the wrapper fails gracefully; no optimistic
    write is persisted, so no divergence. The implementer should refresh after
    a successful response, not optimistically before.
14. **Admin removes another participant's tag.** RLS UPDATE policy allows
    `is_admin(auth.uid())`; the Edge Function's `remove` path drops the
    `tagged_by = callerId` filter when the caller is an admin. Tests assert.
15. **Migration re-applied (`if not exists` everywhere).** The migration is
    idempotent — `create table if not exists`, `create index if not exists`,
    `drop policy if exists` before each `create policy`. Matches migration 0008.
16. **`tag_code` outside the 10-code vocabulary.** Two gates: Edge Function
    `badRequest('invalid_tag_code')` + the `CHECK` constraint at the DB layer.
17. **Debate is `archived` / `locked`.** RLS `arguments` SELECT permits reading
    `open`/`locked`; an `archived` debate's arguments are not readable → tag
    apply fails at step 6 with `forbidden`. Tagging a `locked` debate's move is
    permitted by the schema; if the operator wants to forbid it, add a debate-
    status check — **out of scope for v1** (the card does not require it).
18. **Doctrine edge — does heat / popularity influence a tag?** No. `point_tags`
    has no engagement column, no count, no score. A tag is applied by an
    explicit participant action and nothing else. Popularity cannot create,
    suppress, or weight a tag.

---

## Test plan

Edge Function source files cannot be loaded by Jest (Deno imports). Tests
follow the **`argumentDeletionRequest.test.ts` source-shape pattern** plus the
**`adminSchemas.test.ts` mirror-parity pattern**. The pure logic (`isApplyAllowed`
mirror, the `persistedTagsToManualTagEntries` adapter) **is** directly executed.

- `__tests__/pointTagsMigration.test.ts` — reads
  `20260517000009_meta_1a_point_tags.sql`; asserts: table created with the 9
  columns; `tag_code` CHECK lists all 10 META-001 codes verbatim; `removed_at`
  column present (soft-delete); FKs to `debates` / `arguments` / `profiles`;
  `enable row level security`; the 3 named policies present
  (`pt_insert_eligible`, `pt_select_read_access`, `pt_update_soft_delete`); the
  partial unique index `point_tags_one_active_per_tagger` with
  `where removed_at is null`; no `for delete` policy (no hard-delete path).
- `__tests__/pointTagsEligibilityMirror.test.ts` — imports the client
  `MANUAL_TAG_ELIGIBILITY_TABLE` + `ALL_MANUAL_TAG_CODES` and reads the
  `_shared/pointTagEligibility.ts` source; asserts the mirrored table is
  structurally identical (same 10 keys, same 4 booleans per key). This is the
  guard that the Deno mirror never drifts.
- `__tests__/applyManualTagEdgeFunction.test.ts`:
  - **Eligibility matrix (80 cases):** exercise the mirror's `isApplyAllowed`
    over `10 tag codes × 4 actor roles × 2 own-bubble values`, asserting the
    expected boolean for each — observer always `false`, admin always `true`,
    own-bubble only the 3 intent tags, other-bubble all but per record.
  - **Source-shape contract:** function reads `authorization` header;
    `if (!auth) return unauthorized()`; validates `action`, UUIDs, `tagCode`;
    uses `createCallerClient` for the argument lookup and the insert/update;
    `createServiceClient` used ONLY for the audit row; never logs
    `authorization` / `SERVICE_ROLE`; returns `ok({ argumentId, activeTags })`;
    no `.delete()` against `point_tags` (soft-delete only); CORS `OPTIONS`
    branch present; non-POST → `methodNotAllowed`.
  - **Doctrine ban-list:** the function source + the migration + the mirror
    contain no verdict tokens (`winner`, `loser`, `true`, `false`, `correct`,
    `liar`, `bad faith`, etc. — reuse META-001's `_forbiddenMetadataTokens`).
- `__tests__/pointTagsApi.test.ts`:
  - `applyManualTag` / `removeManualTag` route through
    `supabase.functions.invoke('apply-manual-tag', …)` with `action: 'apply'` /
    `'remove'` (mock `supabase`); error unwrapping returns
    `{ ok: false, status }`; success returns `{ ok: true, data }`.
  - `persistedTagsToManualTagEntries`: happy path (rows → grouped
    `ManualTagEntry[]`); drops `removed_at != null` rows; `dedupeKey` equals
    `makeManualTagDedupeKey(code, taggedBy)`; empty input → empty map;
    multiple taggers of the same code → 2 entries.
  - The wrapper file imports no `SUPABASE_SERVICE_ROLE` / `ANTHROPIC_API_KEY`.
- **META-001 regression:** all existing `metadata` suites must still pass —
  `buildMoveMetadataLedger` accepts the adapter's `Map` output unchanged.

Estimated test-count delta: **+~95 tests** (≈ 80 eligibility-matrix cases +
~15 contract / migration / adapter / mirror tests). New suites: **4**. The
implementer captures the exact count from `npm run test` and updates
`docs/current-status.md` (test discipline §"Test count tracking").

**Pre-merge verification limit (read this):** META-1A's *end-to-end* behavior
(migration applies, RLS blocks an observer, the function deploys and rejects
ineligible actors) **cannot be verified before merge** — it needs a live
migrated DB and a deployed function. The pre-merge gate is therefore the **test
suite + `npm run typecheck` + `npm run lint`**, designed to carry maximum
confidence without a live DB: the eligibility logic is *executed* (not just
asserted on source text) via the mirror; the migration shape, RLS policy
presence, and Edge-Function contract are asserted by source-file inspection.
The operator performs a **post-deploy smoke** (see §"Operator steps").

---

## Dependencies (cards / docs / files)

- Assumes **META-001 is merged** — `src/features/metadata/` provides the
  `ManualTagCode` vocabulary, `MANUAL_TAG_ELIGIBILITY_TABLE`, `isApplyAllowed`,
  `makeManualTagDedupeKey`, and the in-memory `buildMoveMetadataLedger` that
  consumes `manualTagsByMessageId`. META-1A persists what META-001 modeled.
- Reads `supabase/functions/_shared/http.ts` (`ok` / `badRequest` /
  `unauthorized` / `forbidden` / `methodNotAllowed` / `internalError` /
  `corsHeaders`) and `_shared/supabaseClients.ts` (`createCallerClient` /
  `createServiceClient`) — **reused as-is, no new shared infra**.
- Reads `src/features/arguments/argumentsApi.ts#fetchArgumentRelations` and
  `useArgumentRoomMessages.ts` — the loader pipeline being extended.
- Reads `src/features/arguments/ArgumentGameSurface.tsx` line ~281 — the
  `manualTagsByMessageId: new Map()` placeholder being replaced.
- Follows the **`request-argument-deletion`** Edge Function + migration 0008 as
  the structural template, and **`adminSchemas.test.ts`** as the mirror-test
  template.
- **Blocks META-1B** (realtime broadcast of tag changes — needs a persisted
  table to broadcast from) and **META-1C** (admin tag audit surface — needs the
  `point_tags` rows + `removed_by` column to audit).

---

## Risks

- **Mirror drift.** `_shared/pointTagEligibility.ts` duplicates META-001's
  eligibility table. If META-001's table changes, the mirror silently goes
  stale. *Mitigation:* `pointTagsEligibilityMirror.test.ts` fails the build on
  any structural divergence. Same risk class the repo already accepts for
  `_shared/adminSchemas.ts`.
- **`ArgumentGameSurface.tsx` tag-apply control may not exist yet.** META-001
  shipped the model; the *UI control* that calls `applyManualTag` may be a
  SC-004 / TimelineNodeActionDock affordance not yet wired. *Mitigation:* the
  implementer must locate the existing tag-apply entry point; if none exists,
  META-1A still wires the persisted-tag **read path** (replacing the empty
  `Map`) and exposes the wrappers — the write-trigger UI can be a thin
  follow-up. The card's acceptance criterion "UI reflects persisted state" is
  satisfied by the read path. Flag to the operator if no apply control exists.
- **`updated_at` trigger absence.** `point_tags` deliberately has no
  `updated_at`. If a future card expects one, that is an additive migration —
  not a META-1A concern.
- **RLS recursion.** The `point_tags` policies reference `arguments` /
  `debate_participants`; migration 0006 fixed a `debates` RLS recursion.
  *Mitigation:* the policies use `EXISTS` subqueries against `arguments` and
  `debate_participants` (not `debates` self-reference), matching the
  `argument_tags` and `topic_satisfaction_checks` policy shapes that already
  work. No new recursion path.
- **Operator deploy ordering.** The function must be deployed **after** the
  migration — the function inserts into `point_tags`. If the function is
  deployed first, every call 500s until the migration lands. *Mitigation:*
  §"Operator steps" lists the order explicitly.
- **`debate_participants` for a never-joined caller.** A user reading an open
  debate without joining has no `debate_participants` row → derived as
  `observer` → cannot tag. This is the *intended* doctrine outcome (observers
  cannot apply), but if product wants "anyone reading can tag," that is a
  policy change — out of scope; flagged here so the operator is not surprised.

---

## Out of scope

- **Realtime broadcast** of tag changes to other open clients — that is
  **META-1B**.
- **Admin audit surface** for tag history — that is **META-1C** (META-1A only
  records the best-effort `admin_audit_events` row + the `removed_by` column).
- **The `note` free-text field** on a tag — META-001 reserved it for "v2 audit
  UI"; not persisted by META-1A. Additive later.
- **Schema changes outside `point_tags`** — explicitly excluded by the card.
- **Tagging-blocks-posting** or any scoring effect — tags are advisory gameplay
  signals; they never gate `submit-argument`.
- **Forbidding tagging on `locked` debates** — schema permits it; no product
  requirement to block it in v1.
- **Stripping `taggedBy` from observer responses** — kept as an opaque profile
  id; a future privacy card may redact it.
- **Auto-derived metadata persistence** — `point_tags` is *manual* tags only.
  Auto-metadata stays render-time-derived per META-001.

---

## Doctrine self-check

**cdiscourse-doctrine:**
- §1 *No truth labels; score never blocks posting.* `point_tags` stores only a
  `tag_code` from the 10-code gameplay vocabulary — none of which is a
  truth/winner/loser label. A doctrine ban-list test scans the migration, the
  Edge Function, and the mirror. Tagging is a separate action from posting; it
  cannot block `submit-argument`. ✓
- §3 *Popularity is not evidence.* `point_tags` has no engagement / count /
  score column. A tag is created only by an explicit participant action. ✓
- §4 *AI moderator limits.* META-1A makes **no AI call**; the Edge Function is
  pure CRUD + eligibility. ✓
- §6 *Secrets policy.* The client wrapper and `pointTagsApi.ts` import no
  service-role / Anthropic keys. The Edge Function reads `SUPABASE_SERVICE_ROLE_KEY`
  only via `_shared/supabaseClients.ts`, server-side, and never logs it. ✓
- §7 *No AI calls from the production app.* None added. ✓
- §8 *Supabase conventions.* RLS enabled on `point_tags`; the migration is a new
  append-only file (`…0009…`), never an edit of an applied one; soft-delete via
  `removed_at` — **no `for delete` policy exists**, so a hard delete is
  impossible through PostgREST. ✓
- §10 *v1 scope guards.* No voting, no winner, no search, no push, no OAuth, no
  public API. A persisted gameplay-signal table is not a scoring system — it
  records *which signal a participant raised*, never a tally or a result. ✓

**supabase-edge-contract:**
- *No service-role in client.* The client wrapper only calls
  `supabase.functions.invoke`. ✓
- *No direct insert/update into `point_tags` from the client.* The client never
  touches `point_tags` for writes — only the Edge Function does. The room-shell
  loader does a **read-only `select`**, which is the documented exception
  (reads, not writes). ✓
- *RLS always on; migrations append-only.* ✓ (see §8 above).
- *Edge Function shape.* CORS preflight → JWT verify → caller-scoped client →
  input validation → authorization check → narrowest-client mutate → audit →
  stable JSON envelope. The function follows `_shared/http.ts` + the
  `request-argument-deletion` template exactly. ✓
- *Logging rules.* Logs function name + caller id + target id + decision only;
  never the `Authorization` header or any key. ✓

**evidence-doctrine:**
- *A manual tag is a participant gameplay annotation, never a verdict.*
  `tag_code` is one of the 10 META-001 codes — `needs_source`, `tangent`,
  `concession_offered`, etc. — all of which *describe a move's gameplay state*
  ("this point lacks a source"), never accuse a person or assert truth. ✓
- *Banned person-attribution labels* (`troll`, `bot`, `liar`, `bad faith`, …)
  appear in no column, value, comment, or response field. The ban-list test
  enforces it. ✓
- *Engagement credit ≠ factual-standing credit.* `point_tags` records neither —
  it is upstream of any scoring; META-1A adds no score at all. ✓

**test-discipline:**
- Tests ship with the card: 4 new suites, ~95 tests, covering the eligibility
  matrix (executed, not just asserted), the migration shape, the Edge Function
  contract, the client wrapper, and the mirror-parity guard. No `.skip` /
  `.only`. Test count goes up. The doctrine ban-list test is included. ✓

---

## Operator steps (post-merge)

META-1A's migration and Edge Function are **written and merged by the
implementer but NOT run or deployed by any agent** — this is the established
repo pattern (Stage 6.1.8's `request-argument-deletion` migration + function;
QOL-024's admin-users action were both written-not-deployed). After the META-1A
PR merges, the **operator** runs, **in this exact order**:

1. **Apply the migration** (creates `point_tags` + RLS):
   ```
   npx supabase db push --linked
   ```
   Verify it applied:
   ```
   npx supabase db status     # 20260517000009_meta_1a_point_tags listed
   npx supabase db lint       # no new plpgsql lint errors
   ```

2. **Deploy the Edge Function** (must be AFTER step 1 — the function writes to
   `point_tags`):
   ```
   npx supabase functions deploy apply-manual-tag --linked
   ```

3. **RLS verification (post-deploy smoke):**
   - As a **debate participant**, tag another participant's move with
     `needs_source` → expect `200`, the tag appears for a second user on reload.
   - As an **observer** (joined `side='observer'`, or never joined), attempt the
     same → expect `403 not_eligible`; confirm no `point_tags` row was written.
   - As the **author** of a move, attempt `needs_source` on the own bubble →
     expect `403`; then `concession_offered` on the own bubble → expect `200`.
   - **Remove** a tag you applied → expect `200`; the row's `removed_at` is set
     (soft-delete) and it disappears from the room shell; confirm the row still
     exists in `point_tags` (not hard-deleted).
   - As an **admin**, confirm you can apply all 10 codes and remove others' tags.

If step 1 has not run, every `apply-manual-tag` call returns `500` until the
table exists — deploy order matters. No environment variables or secrets are
introduced by META-1A; `apply-manual-tag` reuses the standard
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` that every
Edge Function already has.
