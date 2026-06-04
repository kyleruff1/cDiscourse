# ADMIN-ARGS-INACTIVE-001 — Reversible inactive visibility state for whole arguments (admin-initiated; audited)

**Status:** Design draft — GATE A
**Epic:** Admin Operations / Visibility
**Release:** Stage 6.x admin tooling
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/464
**Branch:** `feat/ADMIN-ARGS-INACTIVE-001-argument-inactive-state`
**Slug:** `argument-inactive-state`

---

## 1. Card context

### Problem statement

Admin moderation needs a reversible mechanism that pulls a whole argument out of every default view for every viewer (admin and non-admin alike), without touching the row's primary key, author, body, `created_at`, or any of the four canonical `status` values (`draft|posted|hidden|deleted`). The row stays in `public.arguments` exactly where it was; what changes is whether non-admin SELECT policies return it by default. Reversibility means flipping a single column back to `NULL` returns the row to default views. Every transition is audited; nothing is hard-deleted; the existing `request-argument-deletion` user-initiated workflow remains untouched and is not a substitute for an admin moderation control (deep design source: `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:460-464`).

### Doctrine framing

The operating doctrine, named verbatim by the operator: **"fresh start = filtered view, not erasure."** The product primitive is **`inactive`** — a reversible visibility state with audit. The verb pair is `inactive ↔ active`, never `delete ↔ restore` (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:444-446`). `inactive` is a *lifecycle / visibility* state, never a truth verdict, never a popularity verdict, never a winner/loser verdict. It is administrative moderation, surfaced as a visibility filter at the RLS layer + UI layer — Skill `cdiscourse-doctrine` §1 (no truth labels) and §4 (AI advisory-only — this card has no AI surface).

### Banned vocabulary

Banned words in this card (case-insensitive, including all inflections): **delete**, **deletes**, **deleted**, **deleting**, **remove**, **removes**, **removed**, **removing**, **archive**, **archives**, **archived**, **archiving**, **clean slate** (hyphen + space variants).

Scope of the ban:
- Every user-facing UI label, button, chip, tooltip, accessibility label.
- Every admin label.
- Every column/table comment in the new migration.
- Every test assertion's `expect(...).toContain(...)` string.
- Every commit message in this card's branch.
- Every line of the design doc body, the IMPLEMENT PR body, and the audit doc.
- Every Edge handler / client wrapper / TS-side code comment authored by this card.

Allowlist (legitimate prior surfaces that may continue to use the banned vocabulary in-place — not in *new* code authored by this card):
- The four existing canonical `status` values (`'draft' | 'posted' | 'hidden' | 'deleted'`) — these are pre-existing CHECK-constraint values; the migration does NOT widen this CHECK (§4 below). Code that reads `status === 'deleted'` is pre-existing and out-of-scope.
- `supabase/functions/request-argument-deletion/index.ts` — pre-existing user-initiated deletion-*request* workflow.
- The migration file `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql` — pre-existing.
- This design doc's allowlist section above (necessary to *name* the banned tokens to ban them).
- The ban-list test file `__tests__/argumentInactiveBanList.test.ts` (necessary to *enumerate* the banned tokens).

---

## 2. Skill preamble

Skills invoked in this design:

- `cdiscourse-doctrine` — §1 no truth labels; §3 popularity-is-not-evidence; §4 AI moderator advisory-only; §6 secrets policy; §8 soft-delete + append-only migrations + RLS always on; §9 plain-language mapping; §10a sensitive composer-only.
- `test-discipline` — tests are part of the deliverable; current baseline 621 suites / 19097 tests on main HEAD `11f09bf`; this card's test count delta forecast +28 to +36; implementer captures exact delta in `current-status.md` post-IMPLEMENT.
- `supabase-edge-contract` — no service-role in client; standard Edge Function shape with `requireAdmin`; never log Authorization; admin audit pattern; migration discipline (append-only, never edit applied files); RLS always on; no hard delete of `public.arguments`.

Authoritative sources read in full before drafting:

- Phase 0 fact bundle: `C:/Users/kyler/AppData/Local/Temp/claude/C--Users-kyler-cdiscourse-debate-constitution-app/e2561b91-eda9-4561-a45b-5a3cf01ce38b/tasks/wep09nu7d.output` (7 dimensions × ~25 findings; cited as `[fact-bundle:<dimension>:<key>]` below).
- Deep design source: `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:433-591` (the ADMIN-ARGS-INACTIVE-001 card body, treated as verbatim authority for acceptance criteria, RLS shape, columns, audit table, bulk cap, ban-list, test plan).
- Issue index: `docs/designs/SPRINT-CORPUS30-ADMIN-HIJ-BACKLOG.md:29-47` (#464 row).
- GitHub issue body: `gh issue view 464` (mirrors the deep design source).
- Governance contract: `docs/core/pipeline-governance-contract.md` (§2 stages, §3 HALT, §4 never-self-approve, §5 merge=deploy on `supabase/functions/**` + `supabase/migrations/**`).
- Schema reality: `supabase/migrations/20260516000001_initial_schema.sql:181-217` (`public.arguments` columns + `status` CHECK + `updated_at` trigger + status partial index).
- Existing RLS: `supabase/migrations/20260516000002_rls_policies.sql:213-237` + `supabase/migrations/20260524000015_qol_039_room_visibility.sql:233-252` (QOL-039 DROP+CREATE precedent and current canonical SELECT policy).

---

## 3. Constitutional acceptance-gate invariant

**Verbatim (Phase 0 fact bundle confirms `src/lib/constitution/engine.ts` is untouched):** AI/MCP classifiers MUST NEVER be the submission acceptance gate. `src/lib/constitution/engine.ts` is sole gate. Classifiers run AFTER storage.

Confirmation that this card does not touch the gate:

- The card adds no new validation rule, no new transition, no new argument type.
- The card does not edit `src/lib/constitution/engine.ts`, the submission path (`supabase/functions/submit-argument/index.ts`), the classifier queue routing (`supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts`), the auto-trigger dispatcher (`autoTriggerDispatcher.ts`), or any `familyRegistry.ts` entry (Phase 0 fact-bundle `routing-predicate:FAMILY_REGISTRY productionEnabled flags` confirms H/I/J productionEnabled stays `false`).
- `inactive_at` is a *post-storage visibility filter* — it operates on already-accepted rows. A submission that passes the engine and lands as `status='posted'` may later be marked inactive by an admin; the engine has no opinion about that transition.
- The card touches no classifier, no MCP family, no validator, no ban-list, no retry/backoff threshold (`cdiscourse-doctrine` §4 + governance contract §4-T preserved).

---

## 4. Migration design (additive only)

### Filename

`supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql`

Verified next-in-sequence per `ls supabase/migrations/ | tail -8` (last applied: `20260602000001_ops_mcp_classifier_failure_detail.sql`) and Phase 0 fact bundle `read-only state inventory for Track A migration authorship:next migration filename`. Today (UTC) `date -u +%Y%m%d` = `20260604`; suffix `000001` follows the per-day pattern observed across 2026-05/2026-06.

### Three additive columns on `public.arguments`

```sql
ALTER TABLE public.arguments
  ADD COLUMN inactive_at     timestamptz NULL,
  ADD COLUMN inactive_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN inactive_reason text        NULL;

COMMENT ON COLUMN public.arguments.inactive_at     IS
  'Lifecycle visibility state. NULL = active (default views include it). NOT NULL = inactive (default views exclude it; admin-only with Show inactives toggle). Reversible; never a hard delete; never widens the existing status CHECK.';
COMMENT ON COLUMN public.arguments.inactive_by     IS
  'Admin profile id that performed the most recent inactivation transition. ON DELETE SET NULL preserves history when an admin profile is purged.';
COMMENT ON COLUMN public.arguments.inactive_reason IS
  'Optional admin-authored free text. Admin-only surfaces (audit log, row detail). NEVER renders on the target argument''s public-facing node (doctrine §10a sensitive composer-only).';
```

Rationale (Phase 0 fact bundle `soft-delete doctrine for arguments`): the four canonical `status` values are CHECK-constrained; widening the CHECK would touch an applied check constraint. Adding a new orthogonal axis (`inactive_at IS NULL/NOT NULL`) preserves the CHECK exactly and is purely additive per `cdiscourse-doctrine` §8 append-only.

All three columns are nullable with no default; the migration backfills nothing. Existing rows have `inactive_at = NULL` ⇒ all are active by default. No data rewrite.

### Two partial indexes

```sql
CREATE INDEX arguments_inactive_at_null_idx
  ON public.arguments (created_at DESC)
  WHERE inactive_at IS NULL;

CREATE INDEX arguments_inactive_at_set_idx
  ON public.arguments (inactive_at DESC)
  WHERE inactive_at IS NOT NULL;
```

The first serves the common-case feed/admin-list filter (`inactive_at IS NULL` is the dominant predicate); the second serves the admin `Show inactives` view ordered by transition time.

### New table `public.argument_inactive_audit`

Mirrors the canonical `admin_audit_events` shape (`supabase/migrations/20260516000007_stage6_admin_operations.sql:40-80`), substituting `argument_id` FK in place of `target_user_id`:

```sql
CREATE TABLE public.argument_inactive_audit (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id          uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  argument_id            uuid        NOT NULL REFERENCES public.arguments(id) ON DELETE CASCADE,
  previous_inactive_at   timestamptz NULL,
  new_inactive_at        timestamptz NULL,
  reason                 text        NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.argument_inactive_audit IS
  'Append-only audit log of argument inactive/active transitions performed by admins. Read-only for non-admins; no UPDATE / no DELETE policy; admins cannot modify history.';

CREATE INDEX argument_inactive_audit_actor_created_idx
  ON public.argument_inactive_audit (actor_user_id, created_at DESC);
CREATE INDEX argument_inactive_audit_argument_created_idx
  ON public.argument_inactive_audit (argument_id, created_at DESC);

ALTER TABLE public.argument_inactive_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "argument_inactive_audit: admins can select"
  ON public.argument_inactive_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "argument_inactive_audit: admins can insert"
  ON public.argument_inactive_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- NO UPDATE policy. NO DELETE policy. History is immutable.
```

The audit row **never** stores the argument body — only `argument_id`, the transition timestamps, the optional admin reason, and the actor. The body remains in `public.arguments`.

### Additive RLS for `public.arguments` — BEFORE state

Three applied policies exist on `public.arguments` (Phase 0 fact bundle `existing RLS policies on public.arguments (DO NOT EDIT)`):

| Name | Type | Source migration | USING / WITH CHECK |
| --- | --- | --- | --- |
| `arguments: select own, participant-private, or posted-public` | SELECT | `20260524000015_qol_039_room_visibility.sql:233-252` (DROP+CREATE replacement of the original `20260516000002:213-226`) | `author_id = auth.uid() OR is_moderator_or_admin() OR (status = 'posted' AND (public.is_debate_open_or_locked_public(debate_id) OR public.is_debate_participant(debate_id, auth.uid())))` |
| `arguments: insert as self` | INSERT | `20260516000002_rls_policies.sql:228-231` | `WITH CHECK (author_id = auth.uid())` |
| `arguments: authors update own; mods update any` | UPDATE | `20260516000002_rls_policies.sql:233-237` | `USING/WITH CHECK (author_id = auth.uid() OR is_moderator_or_admin())` |

### Additive RLS — AFTER state (the migration writes this)

The card uses the **DROP-IF-EXISTS + CREATE** pattern (QOL-039 precedent at `20260524000015_qol_039_room_visibility.sql:233-252`) because the existing SELECT policy's `author_id = auth.uid()` arm explicitly grants the author access to their own draft and posted rows — which is desirable behaviour we want to preserve, but the same arm must NOT bypass the inactive filter for the author of an inactive argument. The cleanest additive shape (designer choice, surfaced for operator confirmation at GATE A — see §14) is to **replace** the existing SELECT policy with a renamed successor that wraps the existing three arms with an `inactive_at IS NULL` qualifier on each non-admin arm, and a separate admin arm that has no inactive_at predicate. The DROP+CREATE is in a NEW migration file; the original migration files are not edited.

```sql
-- Drop the qol_039 successor (DROP IF EXISTS pattern is safe across partially-applied prior runs)
DROP POLICY IF EXISTS "arguments: select own, participant-private, or posted-public" ON public.arguments;

-- NEW: non-admin SELECT policy. Same three arms, every non-admin arm gated on inactive_at IS NULL.
-- Admin/moderator arm intentionally bypasses the inactive_at predicate (admins always read all rows).
CREATE POLICY "arguments: select active for own/participant/public; admins read all"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  -- Admin/moderator arm: unrestricted (this is the existing arm preserved).
  is_moderator_or_admin()
  -- Author's own active rows (drafts + posted) — author cannot see their own inactive row by default.
  OR (author_id = auth.uid() AND inactive_at IS NULL)
  -- Posted-public / posted-participant arms — both gated on inactive_at IS NULL.
  OR (
    status = 'posted'
    AND inactive_at IS NULL
    AND (
      public.is_debate_open_or_locked_public(debate_id)
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);
```

**No INSERT / UPDATE policy change.** The INSERT and UPDATE policies are left untouched — they do not reference `inactive_at`; admin transitions go through the Edge Function with `service_role` (which bypasses RLS), so no client UPDATE policy is needed for inactive transitions. The author's existing UPDATE on their own row is unchanged: if an admin marks an argument inactive, the author still cannot SELECT it back (no default surface returns it), and the row's body update path is not the inactivity-transition path.

**Designer note (recorded for GATE A):** The original SELECT policy granted the author access to their own row regardless of status. Preserving this for active rows (`inactive_at IS NULL`) preserves draft-author access; gating it on `inactive_at IS NULL` for the author arm is the conservative interpretation of "non-admin surfaces exclude inactive rows." If the operator prefers authors see their own inactive rows with a banner (a softer policy), the SELECT policy's author arm drops the `inactive_at IS NULL` qualifier — surfaced as **Operator-decision #4** below (added to §14). The default in this design is the conservative (author-excluded) shape.

### Migration scan invariants (ban-list)

The migration file must contain zero matches for:
- `INSERT INTO public.arguments` (this is a column-add migration, not a data-rewrite).
- `DROP TABLE` / `ALTER TABLE ... DROP COLUMN` / `DROP CONSTRAINT` on `public.arguments`.
- Any widening of the existing `status` CHECK constraint.

The `DROP POLICY IF EXISTS ... CREATE POLICY` pattern on the SELECT policy is *not* a "DROP" in the destructive sense — it is the qol_039 precedent for safe policy replacement. The migration-shape test (`argumentInactiveMigrationShape.test.ts`) explicitly allowlists the `DROP POLICY IF EXISTS "arguments: select ...` line.

---

## 5. Edge Function design (`supabase/functions/admin-users/`)

### Two new actions in the discriminated union

`set_argument_inactive` (single id) and `bulk_set_argument_inactive` (≤100 ids per call; cap stated three times in the deep design source — scope-in `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:494`, acceptance `:566`, HALT trigger `:584`).

### New file `supabase/functions/_shared/adminInactiveSchemas.ts`

Mirrors the small-file pattern used for `adminSemanticConfigSchemas.ts` (`supabase/functions/_shared/adminSemanticConfigSchemas.ts:1-69`). Contains:

```ts
import { z } from 'npm:zod@4';

export const BULK_INACTIVE_ID_CAP = 100;

// Single-argument inactive transition.
export const SetArgumentInactiveSchema = z.object({
  action: z.literal('set_argument_inactive'),
  argumentId: z.string().uuid(),
  inactive: z.boolean(),                       // true = mark inactive; false = mark active
  reason: z.string().min(1).max(500).optional(),
});

// Bulk inactive transition.
export const BulkSetArgumentInactiveSchema = z.object({
  action: z.literal('bulk_set_argument_inactive'),
  argumentIds: z.array(z.string().uuid()).min(1).max(BULK_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: z.string().min(1).max(500).optional(),  // shared optional reason for the whole batch
});

export type SetArgumentInactiveRequest = z.infer<typeof SetArgumentInactiveSchema>;
export type BulkSetArgumentInactiveRequest = z.infer<typeof BulkSetArgumentInactiveSchema>;
```

The zod cap `.min(1).max(BULK_INACTIVE_ID_CAP)` rejects empty arrays and arrays > 100 ids. Non-uuid ids fail `.uuid()`. There is no `inactive_at` numeric/timestamp field on the wire — the Edge handler computes `inactive_at = (inactive ? now() : NULL)` server-side; this prevents the client from picking arbitrary historical timestamps.

### Discriminated union extension (`adminSchemas.ts`)

Append the two schemas to the discriminated union — cite the line:line where the union is declared and the existing semantic-config schemas were appended:

```ts
// supabase/functions/_shared/adminSchemas.ts:148-167 — current shape ends with:
//   GetSemanticConfigSchema,
//   SetSemanticConfigSchema,
// ]);
//
// Extension by this card:
import {
  SetArgumentInactiveSchema,
  BulkSetArgumentInactiveSchema,
} from './adminInactiveSchemas.ts';

export const AdminUsersRequestSchema = z.discriminatedUnion('action', [
  // ... existing 17 schemas ...
  GetSemanticConfigSchema,
  SetSemanticConfigSchema,
  // ADMIN-ARGS-INACTIVE-001:
  SetArgumentInactiveSchema,
  BulkSetArgumentInactiveSchema,
]);
```

`WHITELISTED_ACTIONS` in `supabase/functions/_shared/adminAudit.ts:8-27` gains the two action names:

```ts
export const WHITELISTED_ACTIONS = [
  // ... existing 17 ...
  'get_semantic_config',
  'set_semantic_config',
  // ADMIN-ARGS-INACTIVE-001:
  'set_argument_inactive',
  'bulk_set_argument_inactive',
] as const;
```

### Handler shape

Both handlers follow the standard `supabase-edge-contract` shape: CORS preflight → JWT auth header → `requireAdmin(req)` (the boundary; non-admins refused before any DB read) → zod parse → `serviceClient` for the privileged write → audit log → JSON response.

Per-id atomicity (single handler):

1. Single SELECT `arguments` by id to read `previous_inactive_at`. If not found, return `{argumentId, ok: false, error: 'not_found'}`.
2. UPDATE `arguments` SET `inactive_at = $1, inactive_by = $2, inactive_reason = $3` WHERE `id = $4`.
3. INSERT `argument_inactive_audit` row with `previous_inactive_at`, `new_inactive_at = $1`, `reason`, `actor_user_id`.
4. INSERT one row into `admin_audit_events` via the existing `writeAdminAudit` helper with action = `set_argument_inactive` or `bulk_set_argument_inactive` (defense-in-depth — the canonical admin audit also records the transition).

Both UPDATE + INSERT into `argument_inactive_audit` happen in a single `WITH ... INSERT ...` CTE statement to guarantee that the audit row exists iff the column mutation lands:

```sql
WITH updated AS (
  UPDATE public.arguments
     SET inactive_at = $1, inactive_by = $2, inactive_reason = $3
   WHERE id = $4
   RETURNING id, (CASE WHEN inactive_at IS NULL THEN NULL ELSE inactive_at END) AS new_inactive_at
)
INSERT INTO public.argument_inactive_audit
  (actor_user_id, argument_id, previous_inactive_at, new_inactive_at, reason)
SELECT $5, id, $6, new_inactive_at, $7
FROM updated;
```

If the UPDATE matches zero rows (CTE empty), the INSERT inserts zero rows; the handler returns `error: 'not_found'`. There is no partial state.

### Bulk handler

The bulk handler iterates the (≤100) ids and performs one CTE per id (the same statement as above). Each id returns a per-id result `{argumentId, ok, error_code?}`. The handler **never partial-fails silently**: the response is `{ results: PerIdResult[], appliedCount, failedCount }`. The admin_audit_events row records the *batch* (action = `bulk_set_argument_inactive`, payload includes the per-id result map summary — never argument bodies). Each successful id also writes its own `argument_inactive_audit` row.

### Logging rules

Per `supabase-edge-contract`: never log `Authorization`, never log `argumentId` or `reason` at info level (debug-level fields are stripped pre-write through the existing `sanitizePayload` from `adminAudit.ts:52-65`). The leakage test (`adminInactiveLeakageScan.test.ts`) textually scans the handler source for any `console.log\(.*body|console.log\(.*reason|console.log\(.*Authorization` pattern.

### What the handler will NOT do

- It will NOT delete a row in `public.arguments` (CLAUDE.md doctrine).
- It will NOT update the canonical `status` column (the orthogonal `inactive_at` axis is the entire surface).
- It will NOT return the argument body in the response (only `{argumentId, ok}` per id).
- It will NOT take an `inactive_at` timestamp from the client (server-computed only).
- It will NOT touch `submit-argument`, the classifier queue, the routing predicate, or any `familyRegistry` entry.

---

## 6. Client wrapper + types

### `src/features/admin/adminArgumentsInactiveApi.ts` (NEW)

Mirrors `semanticRefereeConfigApi.ts`:

```ts
import { invokeEdgeFunction } from '../../lib/edgeFunctions';

export interface SetArgumentInactiveInput {
  argumentId: string;
  inactive: boolean;
  reason?: string;
}

export interface BulkSetArgumentInactiveInput {
  argumentIds: string[];
  inactive: boolean;
  reason?: string;
}

export interface PerIdInactiveResult {
  argumentId: string;
  ok: boolean;
  errorCode?: string;
}

export interface BulkInactiveResponse {
  results: PerIdInactiveResult[];
  appliedCount: number;
  failedCount: number;
}

export async function setArgumentInactive(
  input: SetArgumentInactiveInput
): Promise<PerIdInactiveResult> { /* … */ }

export async function bulkSetArgumentInactive(
  input: BulkSetArgumentInactiveInput
): Promise<BulkInactiveResponse> { /* … */ }
```

### `src/lib/edgeFunctions.ts` — extend `AdminUsersAction` union

Append two literals to the union currently declared at `src/lib/edgeFunctions.ts:280-298`:

```ts
export type AdminUsersAction =
  | 'list_users'
  | /* … 17 existing … */
  | 'get_semantic_config'
  | 'set_semantic_config'
  // ADMIN-ARGS-INACTIVE-001:
  | 'set_argument_inactive'
  | 'bulk_set_argument_inactive';
```

Add new exported result interfaces (`PerIdInactiveResult`, `BulkInactiveResponse`) co-located with `SemanticRefereeConfigView` (`src/lib/edgeFunctions.ts:308-317` precedent).

### Plain-language mapping (§9)

Per `cdiscourse-doctrine` §9, the four new internal codes need plain-language strings (no internal snake_case echoed at the UI). The four codes and their mappings — added to `PLAIN_LANGUAGE_COPY` in `src/features/arguments/gameCopy.ts:152-186`:

| Internal code | Plain-language string |
| --- | --- |
| `inactive` | `Inactive (hidden from default views)` |
| `inactive_at` | `Marked inactive at` |
| `inactive_by` | `Marked inactive by` |
| `inactive_reason` | `Admin note (admin-only)` |

None of these strings contains a banned token. The plain-language coverage test (`argumentInactivePlainLanguage.test.ts`) asserts the four codes are present in the map and each value is non-empty and free of banned vocabulary.

---

## 7. UI changes (`AdminArgumentsTab.tsx`)

The admin-only table currently renders 9 columns (per Phase 0 fact bundle `track_a_surface_inventory:surface_1_admin_arguments_tab_ui`). The card adds:

### New column: `Inactive`

- Renders a boolean chip (active visual / inactive visual). When `inactive_at IS NOT NULL`, the chip reads `Inactive` and includes the timestamp via `formatRelativeShort(inactive_at)` stacked under the chip.
- Header label: `Inactive`. Sortable: yes (toggle between `Inactive first` and `Active first`); default keeps the existing `updated_at desc` sort.
- testID: `admin-arguments-cell-inactive`, `admin-arguments-header-inactive`.

### New per-row checkbox column

- A `Pressable` with `accessibilityRole="checkbox"` and `accessibilityState={{ checked }}`.
- Selection state is held in component state. The toolbar shows `Selected: N of M`.
- testID: `admin-arguments-checkbox-{argumentId}`.

### New bulk toolbar

Visible only when at least one row is selected. Two actions: `Mark inactive` and `Mark active`. Both trigger a confirmation dialog (`Mark N argument(s) as inactive? They will be hidden from default views; reversible.`). The shared optional reason input appears in the dialog (single text field, max 500 chars). On confirm: calls `bulkSetArgumentInactive`.

testID: `admin-arguments-bulk-toolbar`, `admin-arguments-bulk-action-mark-inactive`, `admin-arguments-bulk-action-mark-active`, `admin-arguments-bulk-confirm-dialog`.

### New top-level toggle: `Show inactives`

- Default `off`. When off, the loader excludes `inactive_at IS NOT NULL` rows from the query (`adminArgumentsApi.loadAdminArguments` gains a new parameter `includeInactives: boolean`, default `false`).
- When `on`, inactive rows appear with the `Inactive` chip; default sort remains `updated_at desc`.
- Persisted in component state (no global preference write in this card — out of scope; future card may persist).
- testID: `admin-arguments-show-inactives-toggle`.

### Single-row action

A per-row icon/menu exposes `Mark inactive` (or `Mark active` if already inactive) with a single-row reason input. Calls `setArgumentInactive`.

### `inactive_reason` rendering rule (§10a binding)

`inactive_reason` is an admin-authored free-text field. Per `cdiscourse-doctrine` §10a (sensitive composer-only), it **MUST NEVER** render on the target argument's public-facing node (would read as accusation about the author).

Allowed surfaces (admin-only):
- `AdminArgumentsTab` row detail modal (admin-only).
- The audit log row in `argument_inactive_audit` SELECT (admin-only via RLS).
- The dialog confirmation text (admin-only at the moment of action).

Forbidden surfaces (every user-facing argument display):
- `ArgumentTreeScreen.tsx` (the user-facing room view).
- `ArgumentBubbleStack.tsx` (user-facing bubble surface).
- `ArgumentTimelineScreen.tsx` (user-facing timeline).
- `ConversationGalleryScreen.tsx` + `ConversationMiniTimeline.tsx` (gallery cards).
- `ArgumentReplySidecar.tsx`, `TimelineNodePopover.tsx`, `TimelineSelectedReadoutPanel.tsx`, `NodeLabelStrip.tsx`, `AnnotationChipStrip.tsx`, `MetadataDiffInspector.tsx`, `EvidenceDebtChip.tsx`, `ArgumentScoreTracker.tsx`.
- The user-facing `DebateListScreen` row cards.

The leakage scan test (`argumentInactiveLeakageScan.test.ts`) asserts `inactive_reason` is not present in any of the user-facing files' rendered output snapshots.

---

## 8. Surface inventory tick-off

The Phase 0 fact bundle (`track_a_surface_inventory` dimension) enumerated 12 surface clusters. For each: does this surface filter `inactive_at IS NULL` for non-admins, and how is the filter enforced (RLS / SQL predicate / pure-TS belt-and-braces).

| # | Surface | File:line | Non-admin filter required? | Enforcement mechanism |
| --- | --- | --- | --- | --- |
| 1 | Admin Arguments tab loader | `src/features/admin/adminArgumentsApi.ts:88-133` (filter at `:110`) | **NO** (admin-only by `requireAdmin`); add `includeInactives` parameter for `Show inactives` toggle. | Server-side: admin-only loader; `Show inactives = off` filters via `.is('inactive_at', null)`. |
| 2a | AdminViewAsTab `recentArguments` | `src/features/admin/AdminViewAsTab.tsx:69-75` ← `admin-users/index.ts:637-640` (service-role) | Admin-only; **operator decision (see §14 #1)** whether to filter. Default in design: do NOT filter (parity with the existing `deleted` posture in this surface). | Service-role read — no RLS gate. Filter posture is a design choice. |
| 2b | AdminUserDetailPanel `recentArguments` | `src/features/admin/AdminUserDetailPanel.tsx:265-275` ← `admin-users/index.ts:193-200, 222` (service-role) | Admin-only; same operator decision. Default: do NOT filter. | Service-role read; same as 2a. |
| 3a | ArgumentTreeScreen (user-facing room view) | `src/features/arguments/ArgumentTreeScreen.tsx:108, 322, 410` | **YES** | Three layers: (i) RLS at policy layer (new policy excludes inactive for non-admins); (ii) SQL predicate in `useArgumentViewport`/`useArgumentRoomMessages`; (iii) pure-TS belt-and-braces (extend `:410` to also exclude `inactive_at != null`). |
| 3b | ArgumentBubbleStack | `src/features/arguments/ArgumentBubbleStack.tsx` (pure presentational; no fetch) | N/A — consumes already-filtered rows from 3a. | Inherits 3a. |
| 3c | ArgumentTimelineScreen | `src/features/arguments/ArgumentTimelineScreen.tsx:25-41` (no fetch) | N/A — consumes `cache: ArgumentCache` from parent (3a/3d). | Inherits upstream. |
| 3d | `useArgumentRoomMessages` loader | `src/features/arguments/useArgumentRoomMessages.ts:174` ← `argumentsApi.ts:217-222` (filter `.eq('status','posted')` at `:220`) | **YES** | SQL predicate: add `.is('inactive_at', null)` chained after the existing status filter. |
| 3e | `useArgumentViewport` loader | `src/features/arguments/useArgumentViewport.ts:10-13, 71, 99, 124` ← `argumentsApi.ts:152, 189, 220, 244` (four `.eq('status','posted')` callsites) | **YES** | SQL predicate: add `.is('inactive_at', null)` at each of the four `argumentsApi.ts` list functions. |
| 3f | `argumentsApi.ts` (canonical list functions) | `src/features/arguments/argumentsApi.ts:140-252` (four functions) | **YES** | All four functions add `.is('inactive_at', null)` — this is the SQL anchor for surfaces 3a/3c/3d/3e/4b/4d. |
| 4a | DebateListScreen | `src/features/debates/DebateListScreen.tsx` (no `arguments` fetch) | N/A — lists rooms, not arguments. | Inherits inactive-aware list functions when called. |
| 4b | ConversationGalleryScreen + `useGalleryArguments` | `src/features/debates/ConversationGalleryScreen.tsx` ← `useGalleryArguments.ts:14,50` ← `argumentsApi.ts:189` + `conversationGalleryModel.ts:861` belt-and-braces | **YES** | SQL predicate at `argumentsApi.ts:189` (covered by 3f) + extend belt-and-braces filter at `conversationGalleryModel.ts:861` to exclude inactive. |
| 4c | `conversationGalleryModel.buildGallery` | `src/features/debates/conversationGalleryModel.ts:861` (`m.status !== 'deleted'`) | **YES** | Extend the predicate: `m.status !== 'deleted' && m.inactiveAt === null` (or via a new `isVisibleArgument(row, viewerRole)` helper if the implementer prefers). |
| 4d | `useRoomContract` ← `listArgumentsForDebate` | `src/features/debates/useRoomContract.ts:19, 106` ← `argumentsApi.ts:217-222` | **YES** | Inherits 3f. |
| 4e | `roomContractModel` (pure-TS) | `src/features/debates/roomContractModel.ts:307, 461` (`a.status === 'posted'`) | **YES** | Extend two callsites: `a.status === 'posted' && a.inactiveAt === null`. |
| 4f | `botRoomPolicyModel` (pure-TS) | `src/features/debates/botRoomPolicyModel.ts:238` (`a.parentId === null && a.status === 'posted'`) | **YES** | Extend: add `&& a.inactiveAt === null`. |
| 5 | Search screens | (no surface; v1 has no argument search per CLAUDE.md scope guards) | N/A | None. |
| 5b | `loadPriorRoomContext` (cross-room link) | `src/features/arguments/crossRoom/argumentRoomLinksApi.ts:303-308` (filter `.eq('status','posted')`) | **YES** | SQL predicate: add `.is('inactive_at', null)`. |
| 6 | Sidecar / TimelinePopover / NodeLabelStrip / AnnotationChipStrip / MetadataDiffInspector / EvidenceDebtChip / ArgumentScoreTracker / pointLifecycleModel | (pure-TS view models, no `from('arguments')`) | N/A | Inherit upstream filter. |
| 7a | AdminMetadataEventsTab | `src/features/admin/AdminMetadataEventsTab.tsx` ← `adminMetadataEventsApi.ts:339, 409` (reads `point_tags`, not `arguments`) | N/A — append-only audit table; out of scope. Future card may badge rows whose parent argument is inactive. | None. |
| 7b | MCP-021B persisted observation query | `src/features/nodeLabels/machineObservationPersistenceQuery.ts:73-74, 121` (reads `argument_machine_observation_results`) | N/A — admin/server-rendered observation rows; not a direct user-facing render of the argument body. Out of scope. | None. |

### Direct-URL fetch by-id leak risk

Phase 0 fact bundle `direct_url_by_id_fetch_audit`: **NIL.** A repo-wide search for `.eq('id', argumentId)` against `public.arguments` in `src/` returns ZERO hits. There is no public `getArgumentById`/`fetchArgument` in the client. All access flows through the four list loaders + the admin loader + `argumentRoomLinksApi.loadPriorRoomContext` + the admin-users service-role Edge Function. By extending those seven entry points + the new RLS policy, every non-admin surface is covered.

If a non-admin opens a direct URL like `/debate/<id>?focus=<argument_id>` for an inactive argument, the expected behaviour is:

1. The non-admin SELECT policy returns 0 rows for that argument (the `inactive_at IS NULL` qualifier excludes it across all three non-admin arms).
2. The list loader (e.g., `listChildArguments`) does not include the row.
3. The UI shows the standard "argument not found" experience — **not** "this is hidden, but here's the body" (acceptance criterion `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:565`).

The `argumentInactiveLeakageScan.test.ts` includes a synthetic render test that loads a focus target with an inactive `argumentId` and asserts the UI shows the not-found path, never the body.

---

## 9. Test plan (file names + count delta)

Seven new test files; expected delta **+28 to +36 tests** (implementer captures the exact number in `current-status.md` post-IMPLEMENT). Current baseline: 621 suites / 19097 tests on main HEAD `11f09bf`.

1. **`__tests__/argumentInactiveMigrationShape.test.ts`** — textual scan of `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql`. Assertions:
   - File contains no `INSERT INTO public.arguments` line.
   - File contains no `DROP TABLE` / `ALTER TABLE public.arguments DROP COLUMN` / `DROP CONSTRAINT`.
   - File contains no widening of the existing `status` CHECK.
   - Three new columns are nullable (each has `NULL` not `NOT NULL`, no `DEFAULT` for `inactive_at`).
   - Both `arguments_inactive_*` indexes are partial (each has `WHERE inactive_at IS ...`).
   - The audit table has `ENABLE ROW LEVEL SECURITY`, a SELECT policy gating on `is_admin`, an INSERT policy gating on `is_admin`, and NO occurrence of `CREATE POLICY .* FOR UPDATE` / `CREATE POLICY .* FOR DELETE` on `argument_inactive_audit`.
   - The DROP+CREATE on the SELECT policy is allowlisted by name and the new policy USING contains `inactive_at IS NULL`.

2. **`__tests__/adminInactiveSchemas.test.ts`** — zod unit tests for `SetArgumentInactiveSchema` + `BulkSetArgumentInactiveSchema`. Re-declared-local zod per the project's `adminSchemas.test.ts` convention. Assertions:
   - `BULK_INACTIVE_ID_CAP === 100`.
   - Empty `argumentIds` array rejected.
   - Array with 101 ids rejected.
   - Array with non-uuid string rejected.
   - `inactive` is required boolean; missing field rejected.
   - `reason` accepts undefined, accepts string up to 500 chars, rejects >500.

3. **`__tests__/AdminArgumentsTab.inactive.test.tsx`** — React Testing Library suite. Assertions:
   - Default view (`Show inactives = off`) excludes rows with `inactive_at !== null` from the table.
   - Toggling `Show inactives = on` renders inactive rows with the `Inactive` chip + relative timestamp.
   - Per-row checkbox toggles selection state; toolbar shows `Selected: N of M`.
   - Bulk `Mark inactive` action shows confirmation dialog; confirming triggers `bulkSetArgumentInactive` with the expected payload.
   - Single-row `Mark inactive` action shows a per-row reason input; confirming triggers `setArgumentInactive`.
   - testIDs render: `admin-arguments-show-inactives-toggle`, `admin-arguments-checkbox-{id}`, `admin-arguments-bulk-toolbar`, `admin-arguments-cell-inactive`, `admin-arguments-bulk-confirm-dialog`.

4. **`__tests__/argumentInactiveRlsScan.test.ts`** — textual scan of every applied SELECT policy on `public.arguments` after the migration. Assertions:
   - Every non-admin SELECT policy includes the substring `inactive_at IS NULL` in its USING clause OR is allowlisted by name as an admin/moderator policy (the `is_moderator_or_admin()` arm).
   - The replacement SELECT policy `arguments: select active for own/participant/public; admins read all` exists in the new migration file.

5. **`__tests__/argumentInactiveBanList.test.ts`** — diff scanner. Assertions:
   - The regex `\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b` (case-insensitive) matches zero times in:
     - `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql` body
     - `supabase/functions/_shared/adminInactiveSchemas.ts`
     - `src/features/admin/adminArgumentsInactiveApi.ts`
     - `src/features/admin/AdminArgumentsTab.tsx` (added lines only — pre-existing references to `status === 'deleted'` are part of the file's prior content and allowlisted by a file-level diff scope)
   - File-tree allowlist (where the banned vocabulary may continue to appear because the surface is pre-existing or this design doc/test file requires the tokens to ban them):
     - `docs/designs/ADMIN-ARGS-INACTIVE-001.md` (this design doc — necessary to *name* the banned tokens)
     - `__tests__/argumentInactiveBanList.test.ts` (necessary to enumerate the banned tokens)
     - `supabase/functions/request-argument-deletion/index.ts` (pre-existing user-initiated deletion-request workflow — out of scope)
     - `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql` (pre-existing migration)
   - Verdict-token scan: the standard `cdiscourse-doctrine` ban list (`winner`, `loser`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`) matches zero times in every new line of code authored by this card.

6. **`__tests__/argumentInactiveLeakageScan.test.ts`** — two sub-tests:
   - **Handler source scan:** the Edge handler source file (`supabase/functions/admin-users/index.ts` newly-added handler functions) contains zero matches for `console.log\([^)]*\b(body|reason|Authorization|payload)\b`.
   - **UI render snapshots:** render the user-facing surfaces (`ArgumentTreeScreen`, `ArgumentBubbleStack`, `ConversationGalleryScreen`, `ArgumentReplySidecar`, `TimelineSelectedReadoutPanel`) with a fixture argument whose `inactive_at` is non-null and `inactive_reason` is `'leak-canary'`. Assert the rendered tree never contains the substring `'leak-canary'`.
   - **Direct-URL focus test:** render `ArgumentTreeScreen` with a `focus=<inactive-id>` route param and a non-admin viewer; assert the not-found path renders, not the body.

7. **`__tests__/argumentInactivePlainLanguage.test.ts`** — assertions:
   - `toPlainLanguage('inactive')` returns `'Inactive (hidden from default views)'` (or whatever string the implementer chooses, validated as non-empty + free of banned vocabulary).
   - `toPlainLanguage('inactive_at')`, `toPlainLanguage('inactive_by')`, `toPlainLanguage('inactive_reason')` each return non-null, non-empty strings free of banned vocabulary and free of `_` (no snake_case leak).
   - Each mapped string also passes the verdict-token ban-list scan.

---

## 10. Ban-list test specification

Concrete regex (case-insensitive):

```
\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b
```

Scanned files (in-scope diff):

- `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql`
- `supabase/functions/_shared/adminInactiveSchemas.ts`
- `supabase/functions/admin-users/index.ts` (newly-added lines only — diff scope filter)
- `supabase/functions/_shared/adminSchemas.ts` (added discriminated-union entries only)
- `supabase/functions/_shared/adminAudit.ts` (added `WHITELISTED_ACTIONS` entries only)
- `src/features/admin/adminArgumentsInactiveApi.ts`
- `src/features/admin/AdminArgumentsTab.tsx` (added lines only)
- `src/features/admin/adminArgumentsApi.ts` (added `includeInactives` parameter + predicate only)
- `src/features/arguments/argumentsApi.ts` (added `.is('inactive_at', null)` clauses only)
- `src/features/arguments/useArgumentViewport.ts`, `useArgumentRoomMessages.ts` (added lines)
- `src/features/debates/conversationGalleryModel.ts`, `roomContractModel.ts`, `botRoomPolicyModel.ts` (added predicates)
- `src/features/arguments/crossRoom/argumentRoomLinksApi.ts` (added `.is('inactive_at', null)` clause)
- `src/lib/edgeFunctions.ts` (added union members + result interfaces)
- `src/features/arguments/gameCopy.ts` (added PLAIN_LANGUAGE_COPY entries)
- All seven new test files

File-level allowlist (banned tokens may appear because the surface is pre-existing prior to this card):

- This design doc (`docs/designs/ADMIN-ARGS-INACTIVE-001.md`)
- The ban-list test file itself (`__tests__/argumentInactiveBanList.test.ts`)
- `supabase/functions/request-argument-deletion/index.ts` (pre-existing)
- `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql` (pre-existing)
- Pre-existing tokens that match `status === 'deleted'` / `'deleted'` literal: these continue to live in untouched code paths and are allowlisted at the *line* level (the test scans the diff, not the entire pre-existing file).

Verdict-token scan (standard `cdiscourse-doctrine` ban list): `winner`, `loser`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot` — applied to every line of new code authored by this card.

---

## 11. Governance gates

### GATE A — this design doc

**PASS** if every spec section is fully specified, every cite is verified, no open question is undecided. Open questions for the operator are surfaced in §14 below. The design assumes the operator answers §14 #1 (admin-users get_user_detail / view_as_snapshot filter posture) and §14 #4 (author's own-inactive-row visibility) before IMPLEMENT begins; reasonable defaults are recorded so IMPLEMENT can proceed if the operator authorizes the defaults.

### GATE B — implementer

Implementer ends at: committed diff + green `npm run typecheck` + green `npm run lint` + green `npm run test` (with full exit code captured) + leak scan green + PR body. **Implementer NEVER merges.** Migration not applied; Edge Function not deployed.

### GATE C — reviewer + operator

Migration-bearing heightened review per `.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification (mandatory)". Reviewer either runs `npx supabase db reset --linked=false` (Docker required) or performs the four-issue-class textual review (column-add reversibility, RLS additive shape, index validity, audit-table policy completeness).

Per governance contract §5: PR touches `supabase/migrations/**` AND `supabase/functions/**` → **merge = deploy**. Operator-only merge. After merge, the Supabase GitHub integration auto-applies the migration and redeploys the Edge Function; the operator runs `npx supabase db push --linked` and `npx supabase functions deploy admin-users --linked` only if the GitHub-integration auto-apply does not fire.

---

## 12. HALT triggers (card-specific)

1. **(a) Any non-admin surface in inventory still returns an inactive argument body.** Block merge until every entry in §8 is verified.
2. **(b) Bulk handler exceeds 100 rows/call OR fails partial without per-id result map.** HALT.
3. **(c) Migration edits an applied policy file OR widens an applied CHECK constraint.** HALT.
4. **(d) Audit row stores the argument body.** HALT.
5. **(e) Direct-URL fetch of an inactive argument leaks the body to a non-admin.** HALT.
6. **(f) §10a binding violated: `inactive_reason` ever rendered on a public node.** HALT.
7. **(g) Banned-word ban-list scan finds an unallowlisted hit.** HALT.
8. **(h) Designer/implementer touches `familyRegistry.ts` productionEnabled OR `submit-argument/index.ts` OR `classifierQueueRouting.ts` OR the constitutional engine.** HALT (governance contract §4-C never-self-approve + §3 constitutional acceptance-gate invariant).
9. **(i) Designer/implementer hard-deletes any `public.arguments` row.** HALT (CLAUDE.md doctrine).
10. **(j) Designer/implementer edits an existing migration file's SQL.** HALT (`cdiscourse-doctrine` §8 append-only).

---

## 13. Out-of-scope

- **ADMIN-ARGS-CANONICAL-001 (#463).** This card mentions in passing the `ArgumentArtifact.isInactive` reserved field from CANONICAL-001 but does not implement that view-model. The two cards are deliberately orthogonal per `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:450-458`.
- **Any classifier path.** The card never touches `submit-argument`, `classifierQueueRouting`, `autoTriggerDispatcher`, `familyRegistry`, or any MCP family.
- **H/I/J productionEnabled flip.** Forbidden by `cdiscourse-doctrine` + governance contract §4-C.
- **Hard delete.** Forbidden by CLAUDE.md doctrine + `supabase-edge-contract`.
- **Conflating with `request-argument-deletion`.** The user-initiated deletion-request workflow is unchanged.
- **Per-user block/mute.** Out of scope; this is per-argument visibility.
- **Per-room "freeze" semantics.** Out of scope.
- **Inactive-rooms (debates) workflow.** This card is *arguments* only.
- **Pagination / infinite scroll on the admin table.** Out of scope.
- **Restoring an inactive argument's evidence credit.** `argumentScoreModel`, `antiAmplification`, and standing bands are out of scope.
- **Author's own-inactive-row visibility** (the conservative default in §4 excludes the author from seeing their own inactive row). Operator may relax to an "author sees own inactive row with banner" posture; surfaced as §14 #4.

---

## 14. Operator-decision queue (presented at GATE A)

1. **Should `admin-users.get_user_detail` (`admin-users/index.ts:193-200, 222`) and `admin-users.view_as_snapshot` (`admin-users/index.ts:637-640`) learn the `inactive_at` filter, or stay unfiltered for admin posture parity with the existing `deleted` state?**
   - Default in design: **stay unfiltered** (parity with the existing `deleted` posture — admin surfaces seeing all states is intentional).
   - Operator override: filter them, in which case the implementer adds `.eq('status', ...).is('inactive_at', null)` to both queries.
   - Risk if default chosen: an admin viewing a user's recentArguments sees inactive rows (correct — admin-only). No non-admin leak risk.

2. **Should `arguments.is_inactive boolean` be introduced as a generated/derived column?**
   - Default in design: **NO.** Use `inactive_at IS NULL/NOT NULL` predicate everywhere; the predicate is unambiguous and the partial indexes match it directly.
   - Operator override: introduce a generated `is_inactive boolean GENERATED ALWAYS AS (inactive_at IS NOT NULL) STORED` column for ergonomics. The implementer then updates the test plan to assert the generated column matches the predicate.
   - Risk if default chosen: none — the predicate-only approach matches the deep design source verbatim.

3. **Does the design include a `Mark active` workflow that records the un-inactivate transition with its own audit row?**
   - Default in design: **YES.** `set_argument_inactive(inactive: false)` and `bulk_set_argument_inactive(inactive: false)` both write an `argument_inactive_audit` row with `previous_inactive_at = <old non-null timestamp>` and `new_inactive_at = NULL`. The same handler path is used; only the input boolean differs. This preserves audit symmetry — both transitions are recorded.
   - Operator override: if undesired (e.g., only one direction needs an audit row), the implementer skips the audit write on the reverse transition. Not recommended — audit symmetry is the safer default.

4. **Should the SELECT policy's author arm also exclude the author's own inactive rows (conservative default in §4), or grant the author SELECT on their own inactive row with a UI banner?**
   - Default in design: **conservative — author cannot SELECT their own inactive row.** The SELECT policy's author arm carries the `AND inactive_at IS NULL` qualifier.
   - Operator override: drop the `inactive_at IS NULL` from the author arm so the author sees their own inactive row in a degraded UI state with a banner like "This argument is currently inactive — admin moderation note (no body of the inactive_reason)."
   - Risk if default chosen: an author can't see their own inactive row; UX may need a separate "your inactive contributions" admin-only request flow (out of scope for this card; future).
   - Risk if operator overrides: the author surface needs additional rendering logic to display the banner without leaking `inactive_reason` (still §10a-bound). The banner copy must pass the ban-list.

5. **Should `__tests__/argumentArtifactInactiveResilience.test.ts` (already pre-created in CANONICAL-001) be re-validated / extended in this card's IMPLEMENT phase?**
   - Default in design: **the implementer extends this test file** with the actual `isInactive` values produced by the new `inactive_at` column (CANONICAL-001 created the test with synthetic placeholders).
   - If CANONICAL-001 has not yet landed, the implementer creates a minimal version of this test (covering the inactive_at → isInactive plumbing only) and notes the soft dependency in the PR body. The two cards may ship in either order per `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:545`.

---

## Operator steps (post-merge)

The PR touches `supabase/migrations/**` and `supabase/functions/**`. The Supabase GitHub integration auto-applies migrations and redeploys Edge Functions on merge to `main` (governance contract §5; CLAUDE.md memory `supabase-merge-autodeploy`).

If the auto-apply does not fire (manual operator step):

```powershell
npx supabase db push --linked
npx supabase functions deploy admin-users --linked
```

Verification post-deploy (read-only):

```powershell
npx supabase db status       # confirm new migration listed
npx supabase db lint         # plpgsql linting
```

No `.env` changes. No secret rotations. No `familyRegistry` flips. No routing arm changes. No MCP server changes.

---

## GATE A verdict

**BLOCKED — awaiting operator answers on §14 questions #1 and #4** (reasonable defaults are recorded; if the operator authorizes the defaults, GATE A becomes **PASS** and IMPLEMENT may proceed). Questions #2, #3, #5 have reasonable defaults that do not block.

---

## Addendum (IMPLEMENT — operator decision defaults accepted)

The operator (executing GATE A autonomously per the governance contract §3) accepted the designer's recorded defaults verbatim. GATE A becomes **PASS** with the following five locked-in choices:

1. **#1 — admin-users get_user_detail + view_as_snapshot stay UNFILTERED.** Admin posture parity with the existing `deleted` state. No change to those handlers in this card.
2. **#2 — NO `arguments.is_inactive` generated column.** Predicate-only (`inactive_at IS NULL/NOT NULL`) at every site. The partial indexes match the predicate directly.
3. **#3 — YES symmetric Mark-active audit row.** Both directions write an `argument_inactive_audit` row (`set_argument_inactive(false)` and `bulk_set_argument_inactive(inactive: false)` each call `applyInactiveTransition` which always inserts an audit row with `previous_inactive_at` + `new_inactive_at`).
4. **#4 — Conservative: author's own inactive rows are EXCLUDED from author SELECT.** The successor SELECT policy's author arm carries `AND inactive_at IS NULL`. An author cannot SELECT their own inactive row by default.
5. **#5 — Extended `argumentArtifactInactiveResilience.test.ts` scaffold.** CANONICAL-001 has not shipped; this card creates a minimal version covering the `inactive_at → inactiveAt` plumbing and the belt-and-braces predicate semantics. When CANONICAL-001 lands, its reviewer extends the file with the full `ArgumentArtifact` projection.

IMPLEMENT completed in 6 focused commits (migration, Edge handlers, client wrapper + types + plain-language, UI + loader + belt-and-braces, tests + surface patches, this addendum).

**Test count:** 621 suites / 19097 tests (baseline) → 629 suites / 19244 tests (post-card). **Delta: +8 suites / +147 tests.** Typecheck and lint exit 0. The single pre-existing failure (`mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` FX-10 — corpus file missing) is unrelated to this card and was already failing on main HEAD `11f09bf`.

GATE B status: **PASS** (implementer-side). Committed diff + green typecheck + green lint + green test suite (modulo the unrelated pre-existing failure). No push, no PR, no deploy, no `db push`, no `familyRegistry.ts` touched, no service-role in client.
