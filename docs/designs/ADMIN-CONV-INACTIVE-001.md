# ADMIN-CONV-INACTIVE-001 — Reversible admin conversation (debate) inactivation

**Status:** Design draft — GATE A
**Epic:** Admin Operations / Visibility
**Release:** Stage 6.x admin tooling
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/502
**Branch:** `feat/admin-conv-inactive-001`
**Mirrors:** `docs/designs/ADMIN-ARGS-INACTIVE-001.md` (the per-ARGUMENT card, shipped #480 / commit `37ccd9e`) at the **debate level**.

---

## Goal (one paragraph)

Admins can mark a single **argument** inactive (ADMIN-ARGS-INACTIVE-001), but there is no way to retire an entire **conversation (debate)**. `public.debates` has only the lifecycle `status` (`draft → open → locked → archived`), and `archived` does **not** hide a debate from non-admin SELECT — the live `debates: select public-open, own, or participant` policy (qol_039) grants read access on `visibility = 'public' AND status IN ('open','locked')` and to creators/participants regardless of `archived`; the `archived`/joinable distinction only gates the INSERT (joining) path. This card adds a reversible, admin-only, per-debate `inactive_at` visibility state — the conversation-level mirror of the argument primitive. Doctrine, named verbatim by the operator: **"fresh start = filtered view, not erasure."** Inactivating a debate (1) drops the debate row from every non-admin SELECT and (2) **cascades** so its arguments also drop out of every non-admin SELECT, while admins/moderators keep full visibility via a Show-inactives toggle. The state is fully reversible (`inactive_at → NULL`), nothing is hard-deleted, the `status` CHECK is never widened, and every transition is audited. The leak-bearing constraint (doctrine §10a / `policy_no_censorship`): `inactive_reason` is an **admin-only audit field** — the admin sees WHAT is inactive (an `inactive_at`-derived badge) and may store an optional reason in the **audit log only**; the reason is **NEVER** rendered on any public / author / participant surface, and the client **view-model type is designed so the reason is structurally absent** from anything the UI renders.

### Doctrine framing

`inactive` is a *lifecycle / visibility* state — never a truth verdict, never a popularity verdict, never a winner/loser verdict. The verb pair is `inactive ↔ active`, never `delete ↔ restore`. It is administrative moderation surfaced as a visibility filter at the RLS layer + the UI layer (`cdiscourse-doctrine` §1 no truth labels, §4 AI advisory-only — **this card has no AI surface**, §8 append-only migrations + RLS always on + no hard delete, §10a sensitive-content stays off public surfaces). This card mirrors the argument card so closely that the implementer should treat the seven shipped per-argument files as the primary spec source and this doc as the debate-level delta.

### Banned vocabulary (same ban-list as the argument card)

Banned (case-insensitive, all inflections), in new code authored by this card: **delete / deletes / deleted / deleting**, **remove / removes / removed / removing**, **archive / archives / archived / archiving**, **clean slate** (hyphen + space variants). Scope: every user-facing + admin label, button, chip, tooltip, accessibility label; every column/table/policy comment in the new migration; every `expect(...).toContain(...)` string; every commit message on this branch; every line of this design doc body; every Edge handler / client wrapper / TS comment authored by this card.

Allowlist (legitimate pre-existing surfaces that may keep the banned vocabulary in place — NOT in *new* code authored by this card):
- The pre-existing `public.debates.status` CHECK values (`'draft' | 'open' | 'locked' | 'archived'`). This migration does **not** widen this CHECK. Code reading `status === 'archived'` is pre-existing and out of scope. The word `archived` appears in this doc and the migration ONLY when naming that pre-existing CHECK value (necessary to state it is untouched).
- `supabase/functions/request-argument-deletion/index.ts`, `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql` — pre-existing user-initiated deletion-request workflow.
- This design doc's banned-vocabulary section and the ban-list test file `__tests__/debateInactiveBanList.test.ts` (both must name the tokens to ban them).
- `remove_block` / `remove`-prefixed pre-existing `admin-users` action names and any pre-existing `'deleted'` literals reached by untouched lines (the ban-list test scans the **diff**, not the whole pre-existing file).

---

## Skill preamble

- `cdiscourse-doctrine` — §1 no truth labels; §3 popularity-is-not-evidence; §4 AI moderator advisory-only (**no AI in this card**); §6 secrets policy; §8 append-only migrations, RLS always on, no hard delete; §9 plain-language mapping; §10a sensitive content composer/admin-only — the `inactive_reason` leak gate.
- `test-discipline` — tests are part of the deliverable; pure-model + UI (RTL) + Edge handler + migration/RLS textual scan; the reason-never-rendered poisoned-fixture test is a required doctrine invariant; capture the exact test-count delta in `docs/core/current-status.md` post-IMPLEMENT.
- `supabase-edge-contract` — no service-role in client; standard `admin-users` Edge shape with `requireAdmin`; never log `Authorization` / service-role; append-only audit table (SELECT + INSERT for admin, no UPDATE/DELETE); migration discipline (append-only, never edit an applied file); RLS always on; no hard delete of `public.debates`.

Authoritative sources read in full before drafting (all cited inline below):
- GitHub issue `gh issue view 502`.
- `docs/designs/ADMIN-ARGS-INACTIVE-001.md` (the per-argument mirror, incl. its addendum recording the five accepted operator defaults).
- Shipped per-argument implementation @ `37ccd9e` (#480): `supabase/migrations/20260604000001_admin_args_inactive_001_argument_inactive_state.sql`; `supabase/functions/admin-users/index.ts` (`applyInactiveTransition`, `handleSetArgumentInactive`, `handleBulkSetArgumentInactive`, dispatch at L104-107); `supabase/functions/_shared/adminInactiveSchemas.ts`; `supabase/functions/_shared/adminSchemas.ts` (L13-15, L171-173); `supabase/functions/_shared/adminAudit.ts` (L27-30 WHITELISTED_ACTIONS, L84 writeAdminAudit); `src/features/admin/AdminArgumentsTab.tsx`; `src/features/admin/adminArgumentsInactiveApi.ts`; `src/features/admin/adminArgumentsApi.ts` (loader L101-155); `src/features/admin/types.ts` (`AdminArgumentRow` L136-166); `src/features/admin/AdminScreen.tsx` (tab wiring); `src/lib/edgeFunctions.ts` (L280-343 union + cap + types, L396 `adminUsers`).
- Current `public.debates` schema + RLS chain: `supabase/migrations/20260516000001_initial_schema.sql:138-157` (table + `status` CHECK + `updated_at` trigger); `20260516000002_rls_policies.sql:143-166` (original debates SELECT/INSERT/UPDATE); `20260516000006_fix_debates_rls_recursion.sql:36-168` (the SECURITY DEFINER helper pattern — `is_debate_participant`, `is_debate_open_or_locked`, `is_debate_joinable` — and the recursion fix); `20260524000015_qol_039_room_visibility.sql:85-252` (the **current** canonical debates SELECT successor `debates: select public-open, own, or participant`, the `visibility` column, and `is_debate_open_or_locked_public`).
- Argument loaders that prove the cascade must live in RLS: `src/features/arguments/argumentsApi.ts:145-269` (every loader filters the argument's OWN `inactive_at` but does **not** join `debates.inactive_at`).
- Client debate fetch posture: `src/features/debates/debatesApi.ts:87-92` (`listDebates`: "RLS boundary is authoritative; no belt-and-suspenders WHERE clause"), `debateTitleApi.ts:37-40`.

---

## Cannot-proceed check

**No conflict found.** The card is fully specified by the issue + the per-argument mirror. The one genuinely hard, must-design-explicitly part is THE CASCADE (§3 below). The doctrine-risk leak vector (`inactive_reason`) is addressed by a structurally-reason-free view-model (§4) and a poisoned-fixture invariant test (§5). Proceeding.

---

## Data model

### New columns on `public.debates` (all NULLABLE; strictly additive)

```sql
inactive_at     timestamptz NULL
inactive_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
inactive_reason text        NULL
```

Identical shape + semantics to the three columns the per-argument card added to `public.arguments` (`20260604000001:29-41`). `inactive_at IS NULL` = active (default views include the debate); `NOT NULL` = inactive (default views exclude it; admin-only via Show-inactives). Existing rows get `NULL` ⇒ all active by default; no backfill, no data rewrite. The `status` CHECK is untouched (the inactive axis is orthogonal to `draft|open|locked|archived`).

### New append-only audit table `public.debate_inactive_audit`

Mirrors `public.argument_inactive_audit` (`20260604000001:59-94`) substituting `debate_id` for `argument_id`:

```sql
CREATE TABLE public.debate_inactive_audit (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id        uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  debate_id            uuid        NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  previous_inactive_at timestamptz NULL,
  new_inactive_at      timestamptz NULL,
  reason               text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

RLS: SELECT + INSERT gated on `public.is_admin(auth.uid())`; **no UPDATE policy, no DELETE policy** (history immutable). The table stores `debate_id`, the two transition timestamps, the optional admin reason, and the actor — **never** the debate title/resolution/body and never any argument body. `is_admin(uuid)` exists since `20260516000007:18`.

### Client view-model types (the leak-vector discipline)

The loader row type **carries** `inactiveReason` (so the admin row-detail / audit surface could use it later), but the type the **rendered tab consumes** structurally **omits** it. This is a deliberate sharpening of the per-argument approach (where `AdminArgumentRow.inactiveReason` exists on the row and the UI relies on discipline-not-to-render). Here we add a separate render view-model so "reason never displayed" is enforced by the type system, not just by reviewer vigilance.

```ts
// src/features/admin/types.ts (NEW types, appended)

/** Loader row — joins public.debates with profiles(display_name) for created_by.
 *  Carries inactive_reason from the DB (admin-only); the RENDER view-model omits it. */
export interface AdminDebateRow {
  id: string;
  title: string | null;
  resolution: string;
  status: string;
  visibility: string;
  createdBy: string | null;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Lifecycle visibility. NULL = active. NOT NULL = inactive. Reversible. */
  inactiveAt: string | null;
  inactiveBy: string | null;
  /** Admin-only free text. Present on the loader row; the render view-model (below)
   *  OMITS this field so it can never reach a rendered surface (doctrine §10a). */
  inactiveReason: string | null;
}

/** What AdminDebatesTab actually renders. `inactiveReason` is STRUCTURALLY ABSENT —
 *  there is no field on this type to render. `isInactive` is derived from inactiveAt only. */
export interface AdminDebateRowView {
  id: string;
  title: string | null;
  resolution: string;
  status: string;
  visibility: string;
  createdByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  inactiveAt: string | null;
  isInactive: boolean;          // inactiveAt !== null
  // NOTE: no inactiveReason field. By construction.
}

/** Pure projector. Drops inactive_reason + inactive_by; derives isInactive. */
export function toAdminDebateRowView(row: AdminDebateRow): AdminDebateRowView;
```

`toAdminDebateRowView` lives in a small pure module `src/features/admin/adminDebateRowView.ts` (pure-TS, unit-testable, no React/Supabase). The tab maps `AdminDebateRow[] → AdminDebateRowView[]` immediately after load and renders **only** the view array. The poisoned-fixture test (§5) asserts a `'leak-canary'` reason on an `AdminDebateRow` never appears in the projected view nor in the rendered tree.

---

## File changes

### New files

- `supabase/migrations/20260605000001_admin_conv_inactive_001_debate_inactive_state.sql` — the additive migration: 3 columns + 2 partial indexes on `public.debates`; `debate_inactive_audit` table + RLS; the new `is_debate_inactive(uuid)` SECURITY DEFINER helper; the debates SELECT successor (qol_039 DROP+CREATE); the arguments SELECT successor (adds the cascade gate). **~150 lines.** Exact next-sequential filename: today (UTC) is `2026-06-05`; the last migration is `20260604000001_admin_args_inactive_001_argument_inactive_state.sql`; next is `20260605000001_...` (per the per-day `NNNNNN` suffix pattern observed across 2026-05/06).
- `supabase/functions/_shared/adminDebateInactiveSchemas.ts` — zod schemas `SetDebateInactiveSchema` / `BulkSetDebateInactiveSchema` + `BULK_DEBATE_INACTIVE_ID_CAP = 100` + `PerIdDebateInactiveResult` / `BulkDebateInactiveResponse` types. Mirror of `adminInactiveSchemas.ts`. **~80 lines.** (Kept in a NEW file rather than extending `adminInactiveSchemas.ts` to keep the two concerns co-located and the diff scoped; the argument card used the same one-file-per-concern pattern.)
- `src/features/admin/adminDebatesInactiveApi.ts` — typed client wrappers `markDebateInactive` / `markDebateActive` / `bulkMarkDebateInactive` / `bulkMarkDebateActive`. Mirror of `adminArgumentsInactiveApi.ts`. **~80 lines.**
- `src/features/admin/adminDebatesApi.ts` — the loader `loadAdminDebates({ limit, sortField, sortDirection, includeInactives })` reading `public.debates` (+ `profiles(display_name)` embed for `created_by`) with the inactive columns. Mirror of `adminArgumentsApi.ts:loadAdminArguments`. **~120 lines.**
- `src/features/admin/adminDebateRowView.ts` — pure `toAdminDebateRowView(row)` projector (the reason-omitting view-model). **~25 lines.**
- `src/features/admin/AdminDebatesTab.tsx` — the new admin tab (Show-inactives toggle, per-row Mark inactive/active, bulk action with id cap + confirm dialog + optional admin-note input, Inactive column/badge, sortable Created/Last Updated headers, full testIDs + accessibilityLabels). Mirror of `AdminArgumentsTab.tsx`, minus the artifact-grouping (debates are not deduped) and minus the timeline affordance. **~520 lines.**
- Seven test files (see §5). **~+30 to +40 tests.**

### Modified files

- `supabase/functions/admin-users/index.ts` — add `import type { PerIdDebateInactiveResult, BulkDebateInactiveResponse }` (mirror L30-33); add two dispatch arms `case 'set_debate_inactive'` / `case 'bulk_set_debate_inactive'` (mirror L104-107); add `applyDebateInactiveTransition(sc, debateId, inactive, reason, actorUserId)` + `handleSetDebateInactive` + `handleBulkSetDebateInactive` (mirror L853-992). **~+150 lines, no existing lines removed.**
- `supabase/functions/_shared/adminSchemas.ts` — import the two new schemas + append them to the `AdminUsersRequestSchema` discriminated union (mirror L13-15, L171-173). **~+6 lines.**
- `supabase/functions/_shared/adminAudit.ts` — append `'set_debate_inactive'`, `'bulk_set_debate_inactive'` to `WHITELISTED_ACTIONS` (mirror L27-30). **~+3 lines.**
- `src/lib/edgeFunctions.ts` — append the two literals to `AdminUsersAction` (mirror L299-301); add `ADMIN_BULK_DEBATE_INACTIVE_ID_CAP = 100` + `SetDebateInactiveInput` / `BulkSetDebateInactiveInput` / `PerIdDebateInactiveResult` / `SetDebateInactiveResponse` / `BulkDebateInactiveResponse` interfaces (mirror L313-343). **~+35 lines.**
- `src/features/admin/types.ts` — add `'debates'` to the `AdminTab` union + `ADMIN_TAB_LABELS` (`Debates`); add `AdminDebateRow` / `AdminDebateRowView`. **~+30 lines.**
- `src/features/admin/AdminScreen.tsx` — import `AdminDebatesTab`, add `'debates'` to `TABS`, add the render arm. **~+4 lines.**
- `src/features/arguments/gameCopy.ts` — add four plain-language codes for the debate variant if the implementer chooses code-driven copy (see §"Plain language"); OR reuse the argument card's `inactive*` codes. **~+4 lines or 0.**

### Files retired by this card

None.

---

## API / interface contracts

### Migration: `20260605000001_admin_conv_inactive_001_debate_inactive_state.sql`

**1. Additive columns** (exact mirror of `20260604000001:29-41`, table = `debates`):

```sql
ALTER TABLE public.debates
  ADD COLUMN inactive_at     timestamptz NULL,
  ADD COLUMN inactive_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN inactive_reason text        NULL;

COMMENT ON COLUMN public.debates.inactive_at IS
  'Lifecycle visibility state. NULL = active (default views include it). NOT NULL = inactive (default views exclude the debate AND its arguments for non-admins; admin-only via Show inactives). Reversible; never widens the existing status CHECK.';
COMMENT ON COLUMN public.debates.inactive_by IS
  'Admin profile id that performed the most recent inactivation transition. ON DELETE SET NULL preserves audit history when an admin profile is purged.';
COMMENT ON COLUMN public.debates.inactive_reason IS
  'Optional admin-authored free text. Admin-only surfaces (audit log only). NEVER renders on any public / author / participant surface (doctrine 10a).';
```

**2. Two partial indexes** (mirror `20260604000001:46-52`):

```sql
CREATE INDEX debates_inactive_at_null_idx ON public.debates (created_at DESC) WHERE inactive_at IS NULL;
CREATE INDEX debates_inactive_at_set_idx  ON public.debates (inactive_at DESC) WHERE inactive_at IS NOT NULL;
```

**3. Audit table + RLS** — exact mirror of `20260604000001:59-94` with `debate_id` for `argument_id` (full SQL in the Data-model section above). SELECT + INSERT `WITH CHECK (public.is_admin(auth.uid()))`; no UPDATE/DELETE policy.

**4. The cascade helper** — a new SECURITY DEFINER helper following the recursion-safe pattern of `is_debate_open_or_locked_public` (`20260524000015:156-177`) and `is_debate_open_or_locked` (`20260516000006:67-89`):

```sql
CREATE OR REPLACE FUNCTION public.is_debate_inactive(p_debate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.debates d
    WHERE d.id = p_debate_id AND d.inactive_at IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.is_debate_inactive(uuid) IS
  'Returns true if the debate is inactive (inactive_at IS NOT NULL). SECURITY DEFINER bypasses RLS on debates to avoid arguments<->debates policy recursion (same pattern as is_debate_open_or_locked_public).';

REVOKE ALL ON FUNCTION public.is_debate_inactive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_debate_inactive(uuid) TO authenticated;
```

Why SECURITY DEFINER: the `arguments` SELECT policy already calls `is_debate_open_or_locked_public(debate_id)` and `is_debate_participant(debate_id, ...)` (both SECURITY DEFINER) to read `debates`/`debate_participants` without triggering their RLS — preventing the `arguments → debates → arguments` recursion that `20260516000006` was written to fix. A raw `EXISTS (SELECT 1 FROM public.debates ...)` inside the arguments policy would re-introduce that recursion risk. The helper keeps the policy a flat boolean expression.

**5. The debates SELECT successor** — qol_039 DROP+CREATE precedent (`20260524000015:186-198`). Every non-admin arm gains `AND inactive_at IS NULL`; the admin/moderator arm stays unrestricted:

```sql
DROP POLICY IF EXISTS "debates: select public-open, own, or participant" ON public.debates;
DROP POLICY IF EXISTS "debates: select active public-open, own, or participant; admins read all" ON public.debates;

CREATE POLICY "debates: select active public-open, own, or participant; admins read all"
ON public.debates
FOR SELECT
TO authenticated
USING (
  -- Admin / moderator arm — unrestricted (the entire point of Show inactives).
  is_moderator_or_admin()
  -- Creator's own ACTIVE rooms. Conservative posture (mirrors argument card op-decision #4):
  -- a creator cannot see their own inactive room by default.
  OR (created_by = auth.uid() AND inactive_at IS NULL)
  -- Participant of an ACTIVE room (covers private rooms the participant joined).
  OR (public.is_debate_participant(id, auth.uid()) AND inactive_at IS NULL)
  -- Public open/locked ACTIVE room — any authenticated user.
  OR (visibility = 'public' AND status IN ('open', 'locked') AND inactive_at IS NULL)
);
```

> Note vs the argument policy: the live debates policy's "public" arm is an inline `visibility = 'public' AND status IN ('open','locked')` (not the `is_debate_open_or_locked_public` helper — that helper is used by the *arguments* and *debate_participants* policies, not the debates policy itself, to avoid debates-self-recursion). The successor preserves that inline form verbatim and only appends `AND inactive_at IS NULL`. The participant arm is split out with its own `AND inactive_at IS NULL` so a participant of an inactive private room also loses read access (conservative; see Risks).

**6. The arguments SELECT successor (THE CASCADE)** — see §3.

### Edge: `admin-users` new actions

`adminDebateInactiveSchemas.ts` (mirror of `adminInactiveSchemas.ts`):

```ts
import { z } from 'npm:zod@4';
export const BULK_DEBATE_INACTIVE_ID_CAP = 100;
const InactiveReason = z.string().min(1).max(2000).optional();

export const SetDebateInactiveSchema = z.object({
  action: z.literal('set_debate_inactive'),
  debateId: z.string().uuid(),
  inactive: z.boolean(),
  reason: InactiveReason,
});
export const BulkSetDebateInactiveSchema = z.object({
  action: z.literal('bulk_set_debate_inactive'),
  debateIds: z.array(z.string().uuid()).min(1).max(BULK_DEBATE_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: InactiveReason,
});

export interface PerIdDebateInactiveResult { debateId: string; ok: boolean; errorCode?: string; }
export interface BulkDebateInactiveResponse { results: PerIdDebateInactiveResult[]; appliedCount: number; failedCount: number; }
```

(Reason cap is `2000` to match the **shipped** argument schema — NOT the `500` written in the argument design doc, which the shipped code overrode. The argument UI uses `maxLength={500}` on the input; the debate UI mirrors that client cap while the schema accepts up to 2000.)

Handler (`admin-users/index.ts`, mirror of `applyInactiveTransition` L853-911):

```ts
async function applyDebateInactiveTransition(
  sc: SC, debateId: string, inactive: boolean, reason: string | null, actorUserId: string,
): Promise<PerIdDebateInactiveResult> {
  const { data: prev, error: readErr } = await sc
    .from('debates').select('id, inactive_at').eq('id', debateId).maybeSingle();
  if (readErr) return { debateId, ok: false, errorCode: 'read_failed' };
  if (!prev)   return { debateId, ok: false, errorCode: 'not_found' };

  const newInactiveAt     = inactive ? new Date().toISOString() : null;
  const newInactiveBy     = inactive ? actorUserId : null;
  const newInactiveReason = inactive ? reason : null;

  const { error: updErr } = await sc.from('debates')
    .update({ inactive_at: newInactiveAt, inactive_by: newInactiveBy, inactive_reason: newInactiveReason })
    .eq('id', debateId);
  if (updErr) return { debateId, ok: false, errorCode: 'update_failed' };

  const { error: auditErr } = await sc.from('debate_inactive_audit').insert({
    actor_user_id: actorUserId,
    debate_id: debateId,
    previous_inactive_at: (prev as { inactive_at: string | null }).inactive_at,
    new_inactive_at: newInactiveAt,
    reason,   // stored in the AUDIT row only — never returned to the client
  });
  if (auditErr) { console.error('debate_inactive_audit_write_failed', auditErr.message); return { debateId, ok: false, errorCode: 'audit_write_failed' }; }
  return { debateId, ok: true };
}
```

`handleSetDebateInactive` / `handleBulkSetDebateInactive` mirror L913-992: compute server-side `inactive_at`, iterate (bulk) with a per-id result map + `appliedCount`/`failedCount`, write one batch-level `writeAdminAudit` row carrying `{ inactive, requestedCount, appliedCount, failedCount, errorCodeSummary }` (NEVER the debate title/resolution, NEVER the reason text in the per-id payload — `writeAdminAudit` records `reason` at the batch level via its `reason` param exactly like the argument handler, and `sanitizePayload` strips known sensitive keys). The single handler returns `ok({ result })`; the bulk handler returns `ok({ results, appliedCount, failedCount })`. **Response NEVER includes another row's `inactive_reason`** (the only reason echoed is the one the caller just sent, and even that is not echoed — only `{debateId, ok, errorCode?}` per id).

Dispatch arms (mirror L104-107):
```ts
case 'set_debate_inactive':      return await handleSetDebateInactive(body, caller, serviceClient);
case 'bulk_set_debate_inactive': return await handleBulkSetDebateInactive(body, caller, serviceClient);
```

Auth: unchanged entry-point flow — zod parse → `isWhitelistedAction` → `requireAdmin(req)` (401/403 before any DB read) → service-role client used only after the admin check (`admin-users/index.ts:48-66`). Logging: never log `Authorization` / service-role / reason / title at info level; only `console.error('admin_users_error', body.action, err)` on throw + the named audit-write-failure error.

### Client wrapper (`adminDebatesInactiveApi.ts`)

```ts
export async function markDebateInactive(debateId: string, reason?: string): Promise<AdminUsersResult<SetDebateInactiveResponse>>;
export async function markDebateActive(debateId: string, reason?: string): Promise<AdminUsersResult<SetDebateInactiveResponse>>;
export async function bulkMarkDebateInactive(debateIds: string[], reason?: string): Promise<AdminUsersResult<BulkDebateInactiveResponse>>;
export async function bulkMarkDebateActive(debateIds: string[], reason?: string): Promise<AdminUsersResult<BulkDebateInactiveResponse>>;
```

Each is a thin pass-through over `adminUsers<T>({ action, debateId|debateIds, inactive, reason })` (mirror `adminArgumentsInactiveApi.ts`). The client never holds a service-role key.

### Loader (`adminDebatesApi.ts`)

```ts
export type AdminDebatesSortField = 'updated_at' | 'created_at';
export type AdminDebatesSortDirection = 'desc' | 'asc';
export interface LoadAdminDebatesOptions {
  limit?: number; sortField?: AdminDebatesSortField; sortDirection?: AdminDebatesSortDirection;
  includeInactives?: boolean;  // default false → q.is('inactive_at', null)
}
export async function loadAdminDebates(options?: LoadAdminDebatesOptions): Promise<AdminDebateRow[]>;
```

Reads `public.debates` selecting `id, title, resolution, status, visibility, created_by, created_at, updated_at, inactive_at, inactive_by, inactive_reason, profiles(display_name)`; `.order(sortField)`; `.limit(clamp(limit,1,500))`; when `!includeInactives` chains `.is('inactive_at', null)` (mirror `adminArgumentsApi.ts:129`). Admin RLS (`is_moderator_or_admin()` arm) already permits SELECTing inactive rows; the predicate is the loader-side filter that backs the Show-inactives toggle. Maps each raw row → `AdminDebateRow` (carries `inactiveReason`). **The tab immediately projects to `AdminDebateRowView[]` via `toAdminDebateRowView` and renders only that** (reason dropped at the projection boundary).

---

## THE CASCADE (the hard part)

**Problem.** When a debate is inactive, its arguments must also drop out of every non-admin view, while admins read all. The argument loaders (`argumentsApi.ts:145-269`) filter only the argument's OWN `inactive_at`; they do **not** join `debates.inactive_at`, and `listDebates`/`debatesApi.ts:87-92` explicitly treats RLS as authoritative with no client WHERE clause. Therefore a debate-level filter cannot be reliably added client-side without rewriting every loader to embed `debates(inactive_at)` and re-deriving the predicate in JS. **Decision: enforce the cascade entirely in RLS** by extending the `arguments` SELECT policy so every non-admin arm additionally requires the parent debate to be active. This is the single authoritative chokepoint; it covers list loaders, the gallery `.in()` batch, direct by-id focus, cross-room links, and any future reader — none can bypass RLS.

### Mechanism: extend the arguments SELECT successor

The current canonical arguments policy is the per-argument inactive successor `arguments: select active for own/participant/public; admins read all` (`20260604000001:114-133`). This card replaces it (qol_039 DROP+CREATE; the prior name is dropped IF EXISTS) with a successor that adds `AND NOT public.is_debate_inactive(debate_id)` to **every non-admin arm**. The argument's own `inactive_at IS NULL` gate is preserved on each non-admin arm. Both gates compose with AND — neither overrides the other.

```sql
DROP POLICY IF EXISTS "arguments: select active for own/participant/public; admins read all" ON public.arguments;
DROP POLICY IF EXISTS "arguments: select active for own/participant/public; active debate; admins read all" ON public.arguments;

CREATE POLICY "arguments: select active for own/participant/public; active debate; admins read all"
ON public.arguments
FOR SELECT
TO authenticated
USING (
  -- Admin / moderator arm — unrestricted. Admins read every argument of every
  -- debate, inactive debate or not, inactive argument or not.
  is_moderator_or_admin()
  -- Author's own active argument in an ACTIVE debate.
  OR (
    author_id = auth.uid()
    AND inactive_at IS NULL
    AND NOT public.is_debate_inactive(debate_id)
  )
  -- Posted public-room / participant arms — argument active AND parent debate active.
  OR (
    status = 'posted'
    AND inactive_at IS NULL
    AND NOT public.is_debate_inactive(debate_id)
    AND (
      public.is_debate_open_or_locked_public(debate_id)
      OR public.is_debate_participant(debate_id, auth.uid())
    )
  )
);
```

### Composition truth table (argument `inactive_at` × debate `inactive_at`)

For a **non-admin** caller who otherwise satisfies an arm (author, participant, or public reader):

| argument.inactive_at | debate.inactive_at | non-admin can SELECT argument? | why |
|---|---|---|---|
| NULL | NULL | **yes** | both gates pass |
| NOT NULL | NULL | no | argument's own `inactive_at IS NULL` fails |
| NULL | NOT NULL | no | `NOT is_debate_inactive(debate_id)` fails (THE CASCADE) |
| NOT NULL | NOT NULL | no | both gates fail |

For an **admin/moderator** caller: **yes** in all four cells (the admin arm has neither predicate). Both per-argument inactivation and per-debate inactivation thus AND together for non-admins; neither overrides the other; admins always see everything. This is the exact behaviour the issue requires ("both gates AND together; neither overrides the other").

### Why not a helper-side change instead of a policy-side change

The issue offers "extend the arguments SELECT successor **and/or** the `is_debate_open_or_locked_public` / `is_debate_participant` helper(s)." **Decision: policy-side only; do NOT modify the existing helpers.** Reasons:
- `is_debate_open_or_locked_public` is also called by the `debate_participants` SELECT policy (`20260524000015:218`) and by `argument_room_links` policies (`20260521000010:230,248`). Baking an `inactive_at IS NULL` requirement into that helper would silently change participant-list and cross-room-link visibility in ways outside this card's scope and risk over-hiding. `is_debate_participant` is called even more widely. Modifying a shared helper is a wide blast radius; adding a new narrow helper (`is_debate_inactive`) + composing it in exactly one policy is surgical and reviewable.
- A `CREATE OR REPLACE FUNCTION` on a shared helper is allowed (it is not "editing an applied migration" — it is a new migration redefining the function), but it would change behaviour at every call site at once. The narrow-new-helper approach is the qol_039 precedent (it *added* `is_debate_open_or_locked_public` as a sibling rather than mutating `is_debate_open_or_locked`, "to preserve the existing helper's semantics for any callers that need the visibility-blind check" — `20260524000015:151-155`). This card follows that precedent exactly.

### Cascade leak / over-hide analysis

- **Under-hide risk (non-admin still sees an inactive conversation's arguments): mitigated.** Because RLS is the single chokepoint and every non-admin arm now ANDs `NOT is_debate_inactive(debate_id)`, no client loader can return an argument of an inactive debate to a non-admin — including loaders that DON'T have an argument-level `inactive_at` filter (none currently lack it, but the policy is the guarantee). The gallery `.in('debate_id', ids)` batch (`argumentsApi.ts:185-211`), direct by-id focus, `listArgumentsForDebate`, `listChildArguments`, and `argumentRoomLinksApi` cross-room reads are all RLS-gated → all covered.
- **Over-hide risk (admin loses visibility): mitigated.** The admin/moderator arm has neither `inactive_at IS NULL` nor `NOT is_debate_inactive(...)`. An admin loading arguments for an inactive debate (e.g. drilling in from the AdminDebatesTab) sees every row. The AdminArgumentsTab loader uses `is_moderator_or_admin()` RLS + the `includeInactives` toggle for the argument's own `inactive_at`; it does **not** filter on the parent debate's `inactive_at`, so an admin browsing arguments still sees arguments of inactive debates (correct — admin-only).
- **Recursion risk: mitigated** by the SECURITY DEFINER `is_debate_inactive` helper (reads `debates` as definer, bypassing its RLS) — same fix the codebase already relies on for `is_debate_open_or_locked_public` / `is_debate_participant`.
- **Argument-tags inherit automatically.** `argument_tags` SELECT delegates through `EXISTS arguments` (`20260516000002:244-260`; confirmed still delegating per qol_039's `4.4` note). It auto-inherits the cascade. No `argument_tags` policy change needed (mirrors qol_039's E1.6 reasoning).
- **`topic_satisfaction_checks` / `argument_flags`** SELECT policies gate on `debate_participants` / argument authorship, not on a posted-public arm; they are admin/participant/author-scoped already and are out of scope (a future card may align them, but they do not leak an inactive debate's *argument bodies* to a random non-admin).

### Performance

`is_debate_inactive(debate_id)` is `STABLE` (cached within a query) and hits the `debates` PK. The `arguments` list loaders already filter `status='posted' AND inactive_at IS NULL` (served by `arguments_inactive_at_null_idx`), so the helper is evaluated on an already-narrow row set. The new `debates_inactive_at_*` partial indexes serve the admin Show-inactives view and the dominant `inactive_at IS NULL` debate-list predicate.

---

## Edge cases

- **Empty bulk array / >100 ids / non-uuid id** → rejected by zod (`.min(1).max(100)` / `.uuid()`) before any DB read; `admin-users` returns `validation_failed`. The tab pre-caps the selection to `ADMIN_BULK_DEBATE_INACTIVE_ID_CAP` so the UX message precedes the round-trip.
- **`set_debate_inactive` on a non-existent / already-purged debate id** → `applyDebateInactiveTransition` reads `prev`; `!prev` ⇒ `{ ok:false, errorCode:'not_found' }`; single handler returns `validationFailed`; bulk handler records it in the per-id map and continues. No partial state (audit row only inserted after a successful UPDATE).
- **Mark active on an already-active debate (idempotent re-activate)** → UPDATE sets `inactive_at = NULL` (no-op value), a symmetric audit row is written with `previous_inactive_at = NULL, new_inactive_at = NULL`. Harmless; preserves audit symmetry (mirrors argument op-decision #3).
- **Mark inactive on an already-inactive debate (re-stamp)** → `inactive_at` is re-stamped to a fresh `now()`, `inactive_by`/`inactive_reason` updated, audit row records `previous = <old ts>, new = <new ts>`. Acceptable (the latest transition wins; history preserved).
- **Concurrent edits** → last-writer-wins on the single `debates` row (the `debates_set_updated_at` trigger bumps `updated_at`). The audit log preserves the full sequence regardless of ordering. No row is lost.
- **Inactive debate whose creator is also an admin** → the admin arm wins; the admin sees their own inactive room (correct).
- **Non-admin direct-URL to an inactive debate (or an argument inside it)** → the debates SELECT returns 0 rows for the debate; the arguments SELECT returns 0 rows for its arguments (cascade). The UI shows the standard not-found experience — never "this is hidden, here's the body." (Tested in §5.)
- **Offline / network failure** → the tab surfaces the loader/`adminUsers` error in its error state; no optimistic local mutation (it re-fetches after each action, mirroring `AdminArgumentsTab.fetchRows`).
- **`inactive_reason` containing a banned/verdict token** → irrelevant to display because the reason is never rendered (it lives only in the audit row). The poisoned-fixture test asserts the reason never reaches a rendered surface regardless of content.
- **Doctrine edge — does inactivation imply a verdict?** No. The badge reads `Inactive` / `Active` (lifecycle), never `removed` / `bad` / `winner` / `loser`. Heat/popularity/standing are never inputs to inactivation — it is a manual admin action only (no AI, no auto-trigger).

---

## Test plan

Per `test-discipline`: pure-model + Edge handler (Deno-side shape) + migration/RLS textual scan + UI (RTL) + the reason-never-rendered poisoned-fixture invariant. Seven new files; expected delta **+30 to +40 tests** (implementer captures the exact number in `current-status.md`). File names mirror the per-argument suite (`__tests__/argumentInactive*`).

1. **`__tests__/debateInactiveMigrationShape.test.ts`** (~8) — textual scan of `20260605000001_admin_conv_inactive_001_debate_inactive_state.sql`:
   - No `DROP TABLE` / `ALTER TABLE public.debates DROP COLUMN` / `DROP CONSTRAINT`; no `INSERT INTO public.debates`.
   - No widening of the `status` CHECK (assert the file does not contain a new `CHECK (status IN` on `debates`).
   - Three new columns nullable (each `NULL`, no `DEFAULT` on `inactive_at`).
   - Both `debates_inactive_at_*` indexes partial (`WHERE inactive_at IS ...`).
   - `debate_inactive_audit` has `ENABLE ROW LEVEL SECURITY`, an `is_admin`-gated SELECT + INSERT policy, and **no** `FOR UPDATE` / `FOR DELETE` policy.
   - `is_debate_inactive(uuid)` is `SECURITY DEFINER` + `SET search_path = public` + `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated`.
   - The debates SELECT DROP+CREATE replaces the qol_039 successor by name and the new policy contains `inactive_at IS NULL`.

2. **`__tests__/debateInactiveCascadeRlsScan.test.ts`** (~6) — textual scan of the arguments SELECT successor in the new migration:
   - The new arguments policy `arguments: select active for own/participant/public; active debate; admins read all` exists in the new migration file.
   - Every non-admin arm contains BOTH `inactive_at IS NULL` AND `NOT public.is_debate_inactive(debate_id)` (assert the policy body contains `is_debate_inactive` and that it is negated; assert it still contains the per-argument `inactive_at IS NULL`).
   - The admin arm (`is_moderator_or_admin()`) is present and is the only arm WITHOUT `is_debate_inactive`.
   - The prior arguments policy name from `20260604000001` is dropped IF EXISTS (no orphaned policy).

3. **`__tests__/adminDebateInactiveSchemas.test.ts`** (~7) — re-declared-local zod (project convention): `BULK_DEBATE_INACTIVE_ID_CAP === 100`; empty `debateIds` rejected; 101 ids rejected; non-uuid rejected; `inactive` required boolean; `reason` accepts undefined / ≤2000 chars / rejects >2000.

4. **`__tests__/adminDebateRowView.test.ts`** (~5) — pure projector: `toAdminDebateRowView` drops `inactiveReason` (assert the projected object has no `inactiveReason` own-property via `Object.prototype.hasOwnProperty`); derives `isInactive === (inactiveAt !== null)`; preserves the other display fields; round-trips active + inactive fixtures; a reason of `'leak-canary'` on the input never appears on any value of the output object (`JSON.stringify(view)` excludes `'leak-canary'`).

5. **`__tests__/AdminDebatesTab.test.tsx`** (~8, RTL) — default view (`Show inactives = off`) excludes inactive rows; toggling on renders inactive rows with the `Inactive` badge + relative timestamp; per-row checkbox toggles selection and the toolbar shows `Selected: N of M`; bulk `Mark inactive` opens the confirm dialog and confirming calls `bulkMarkDebateInactive` with the expected payload; single-row `Mark inactive`/`Mark active` calls the right wrapper; the testIDs render (`admin-debates-show-inactives-toggle`, `admin-debates-checkbox-{id}`, `admin-debates-bulk-toolbar`, `admin-debates-bulk-action-mark-inactive`, `admin-debates-bulk-confirm-dialog`, `admin-debates-cell-inactive`, `admin-debates-header-inactive`).

6. **`__tests__/debateInactiveReasonNeverRendered.test.tsx`** (~4, the **poisoned-fixture doctrine invariant**) — load `AdminDebatesTab` with a fixture `AdminDebateRow` whose `inactiveAt` is non-null and `inactiveReason = 'leak-canary-REASON'`, in BOTH `Show inactives` states; assert the rendered tree NEVER contains `'leak-canary-REASON'`. Also assert the `adminDebatesInactiveApi` response type and the bulk handler contract never echo another row's reason (a fixture mock returns `{debateId, ok:true}` only; the tab never reads a reason field). This is the binding §10a test.

7. **`__tests__/debateInactiveBanList.test.ts`** (~4, diff scanner) — the regex `\b(delete|deletes|deleted|deleting|remove|removes|removed|removing|archive|archives|archived|archiving|clean[\s-]slate)\b` (case-insensitive) matches zero times in the new migration body, `adminDebateInactiveSchemas.ts`, `adminDebatesInactiveApi.ts`, `adminDebatesApi.ts`, `adminDebateRowView.ts`, and the added lines of `AdminDebatesTab.tsx` / `admin-users/index.ts` / `adminSchemas.ts` / `adminAudit.ts` / `edgeFunctions.ts` / `types.ts` / `AdminScreen.tsx`. The standard verdict-token ban-list (`winner / loser / liar / dishonest / bad faith / manipulative / extremist / propagandist / stupid / idiot`) matches zero in every new line. Allowlist (pre-existing surfaces): this design doc, this test file, `request-argument-deletion`, the deletion-request migration, `remove_block` pre-existing action names, and `status === 'archived'` literals on untouched lines.

> Edge handler note: the per-argument suite verifies the handler via the shared schema tests + a leakage source-scan (no integration harness for `admin-users`). This card follows the same posture: the handler's no-reason-leak property is covered by (a) the schema test, (b) the poisoned-fixture UI test, and (c) a source-scan assertion in the ban-list/leakage test that the new handler functions contain zero `console.log\([^)]*\b(reason|title|resolution|Authorization|body)\b` matches. If Docker is available at IMPLEMENT time, the implementer may add a `supabase functions serve` happy/auth-refused/invalid-input integration test; otherwise the source-scan + schema tests are the contract (consistent with the shipped argument card).

---

## Dependencies (cards / docs / files)

- **Assumes ADMIN-ARGS-INACTIVE-001 (#480) is shipped** — this card replaces the arguments SELECT policy that #480 created (`arguments: select active for own/participant/public; admins read all`), reuses `ADMIN_BULK_INACTIVE_ID_CAP`'s pattern, mirrors `adminInactiveSchemas.ts` / `adminArgumentsInactiveApi.ts` / `AdminArgumentsTab.tsx`, and depends on the established `is_admin` + `is_debate_*` SECURITY DEFINER helpers. If #480 were absent the migration's `DROP POLICY IF EXISTS` on the #480 policy name would simply no-op (harmless), but the mirror-file references would have no source.
- **Reads** the qol_039 debates SELECT successor (`20260524000015:189-198`) and the recursion-fix helpers (`20260516000006`) — replaces the former, reuses the latter pattern.
- **Reads** `admin-users` entry-point auth + dispatch (`index.ts:35-114`), `adminAudit.writeAdminAudit` (`adminAudit.ts:84`), `adminUsers` client (`edgeFunctions.ts:396`).
- **Blocks** any future "inactive debates surfaced to creator with a banner" card (the conservative creator-arm posture here is the thing such a card would relax — see Risks / op-decision).
- **Orthogonal to** ADMIN-ARGS-CANONICAL-001 (`isInactive` artifact projection) — the debate tab does not group debates into artifacts.

---

## Risks

- **Library/platform:** none new — no new deps. zod is Deno-imported in the Edge schemas file (`npm:zod@4`, matching the shipped pattern). RN primitives only in the tab.
- **Existing tests that may need updating:** RLS-shape tests that assert the EXACT current arguments / debates SELECT policy NAME will break when the names change. Grep before IMPLEMENT for the old policy names (`arguments: select active for own/participant/public; admins read all` and `debates: select public-open, own, or participant`) in `__tests__/` and update those assertions to the new successor names. The per-argument card's `argumentInactiveRlsScan.test.ts` asserts the arguments policy name from #480 — it must be updated (or its allowlist broadened) since this card renames that policy.
- **Migration requires operator deploy:** the migration + Edge changes auto-deploy via the Supabase GitHub integration on merge; if it does not fire the operator runs `npx supabase db push --linked` + `npx supabase functions deploy admin-users --linked`.
- **Cascade over-hide (participant of an inactive private room):** the conservative posture removes a participant's read access to a room they were in once an admin inactivates it. This mirrors the argument card's conservative creator default. If the operator wants participants/creators to retain a degraded read with a banner, the participant + creator arms drop their `AND inactive_at IS NULL` (the cascade arguments policy would also need to grant participants read on inactive-debate arguments) — flagged as the open question below. **Default in this design: conservative (fully hidden for non-admins).**
- **Cascade under-hide if a future loader bypasses RLS:** impossible for the `anon`/`authenticated` client (RLS always on). The only bypass is service-role (Edge Functions), which is admin-gated. A future service-role read that surfaces an inactive debate's arguments to a non-admin would be a new card's bug, not this card's — but the design note "RLS is the single cascade chokepoint" should be carried into `current-status.md` so future loaders are not given a debate-inactive belt-and-braces JS filter under the false assumption RLS doesn't cover it.
- **`status='archived'` confusion:** reviewers may assume `archived` already hides debates. It does not (it only blocks joining). The migration header + this doc state this explicitly so the new `inactive_at` axis is not mistaken for redundant with `archived`.

---

## Out of scope

- **No hard delete** of `public.debates` or `public.arguments`.
- **No change to the `status` lifecycle or its CHECK** (`draft|open|locked|archived` untouched; not widened).
- **No AI involvement** — inactivation is a manual admin action only. No classifier, no auto-trigger, no `submit-argument` / `classifierQueueRouting` / `familyRegistry` / engine touch.
- **No change to per-argument inactivation** — the #480 surface (AdminArgumentsTab, `adminArgumentsInactiveApi`, the per-argument columns/audit/handlers) is reused/composed-with, not modified, except the arguments SELECT policy is replaced to ADD the cascade gate (the per-argument `inactive_at IS NULL` gate is preserved verbatim).
- **No new raw-content display surface.** The AdminDebatesTab shows title/resolution/status/timestamps/created-by — all already admin-visible via RLS; no argument bodies are added.
- **No `inactive_reason` rendering anywhere** — audit-row-only.
- **No "creator/participant sees own inactive room with a banner"** softer posture (conservative default; flagged as the open question).
- **No `record-visibility-transition` / QOL-039 `private` interaction changes** — `visibility` and `inactive_at` are independent axes; an inactive room's `visibility` value is irrelevant to non-admins because the inactive gate fails first.
- **No voting/scoring, no real-time edit, no search, no push, no OAuth, no public API** (v1 scope guards).
- **No pagination/infinite scroll** on the AdminDebatesTab (mirrors the argument tab's limit-chip approach).
- **No `topic_satisfaction_checks` / `argument_flags` SELECT alignment** to the debate-inactive gate (those are author/participant/admin-scoped already; a future card may align them).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the only labels are `Inactive` / `Active` — lifecycle/visibility, not verdicts. No `winner/loser/true/false/...` anywhere. Ban-list test enforces.
- **cdiscourse-doctrine §1 (score never blocks posting):** inactivation is a *post-storage visibility filter*; it does not touch the submission/validation path. Posting is unaffected.
- **cdiscourse-doctrine §3 (popularity not evidence):** heat/engagement/standing are NEVER inputs to inactivation — it is a manual admin action. No amplification signal flows in.
- **cdiscourse-doctrine §4 (AI advisory-only):** **no AI surface in this card.** No classifier, no Anthropic/xAI/X/MCP call.
- **cdiscourse-doctrine §6 (secrets):** no service-role in client (`adminDebatesInactiveApi` calls the Edge Function); never log `Authorization` / service-role; `grep -r "SERVICE_ROLE\|ANTHROPIC_API_KEY" src/ app/` stays zero.
- **cdiscourse-doctrine §8 (RLS always on / append-only / no hard delete):** RLS stays enabled on `debates` and on the new audit table; the migration is additive (new columns/indexes/table/policies) and never edits an applied file; no row is hard-deleted (the verb is `inactive ↔ active`).
- **cdiscourse-doctrine §9 (plain language):** if code-driven copy is used, the four `inactive*` codes map through `gameCopy.toPlainLanguage` with no snake_case leak; otherwise the tab uses literal plain strings (`Inactive`, `Active`, `Admin note (optional, admin-only)`) that contain no internal codes. (See note below.)
- **cdiscourse-doctrine §10a (sensitive content off public surfaces) — THE LEAK GATE:** `inactive_reason` lives only in `debate_inactive_audit` (admin-RLS SELECT) and is **structurally absent** from `AdminDebateRowView` (no field exists to render). The Edge response never echoes another row's reason. The poisoned-fixture test (`debateInactiveReasonNeverRendered.test.tsx`) is the binding invariant. Per the issue: the admin sees WHAT is inactive (the `inactive_at`-derived badge), never WHY on any public/author/participant surface.
- **supabase-edge-contract:** standard `admin-users` shape; `requireAdmin` before any DB read; service-role only after the admin check; append-only audit table (SELECT+INSERT admin, no UPDATE/DELETE); server-computed `inactive_at` (client never sends a timestamp); migration discipline honored; deploy is operator-run.
- **test-discipline:** tests ship with the card (pure-model, Edge schema, migration/RLS scan, UI, poisoned-fixture); count goes up; no `.skip`/`.only`.

> Plain-language note for the implementer: the per-argument card added `inactive` / `inactive_at` / `inactive_by` / `inactive_reason` to `gameCopy` PLAIN_LANGUAGE_COPY. The debate tab can REUSE those four codes (they are not argument-specific) rather than adding debate-specific codes — confirm in `gameCopy.ts` at IMPLEMENT. If reused, no `gameCopy` change is needed and `__tests__/argumentInactivePlainLanguage.test.ts` already covers them; if the implementer prefers debate-specific copy, add the codes + extend a plain-language test. Default recommendation: **reuse**, zero `gameCopy` delta.

---

## Operator-decision queue (presented at GATE A)

1. **Creator/participant own-inactive-room visibility — conservative (fully hidden) vs degraded-banner?**
   - **Default in design: conservative.** The debates SELECT successor gates the creator arm AND the participant arm on `inactive_at IS NULL`; the arguments cascade hides the room's arguments from non-admins entirely. A creator/participant of an inactive room sees a not-found experience, exactly like the argument card's op-decision #4.
   - Operator override: drop `AND inactive_at IS NULL` from the creator and/or participant arm of the debates policy, AND add a participant/creator read arm to the arguments cascade policy for inactive debates, AND build banner UI that never leaks `inactive_reason`. Larger scope; not recommended for v1.
   - Risk if default chosen: a creator cannot see their own inactivated room. Acceptable for an admin-moderation tool; a future card can add a "your inactive rooms" admin-requested view.

2. **Symmetric Mark-active audit row?**
   - **Default: YES** (mirror argument op-decision #3). Both directions write a `debate_inactive_audit` row. Not recommended to skip — audit symmetry is the safer default.

3. **Reuse the argument card's `gameCopy` `inactive*` codes vs add debate-specific copy?**
   - **Default: reuse** (zero `gameCopy` delta; the codes are not argument-specific). Override = add debate-specific codes + a plain-language test.

4. **`is_debate_inactive` helper-side change vs policy-side composition?**
   - **Default: policy-side only** (add the narrow new helper, compose it in exactly the arguments + debates policies; do NOT modify the shared `is_debate_open_or_locked_public` / `is_debate_participant` helpers). This is the qol_039 sibling-helper precedent and the surgical, low-blast-radius choice. No override recommended.

Reasonable defaults are recorded for all four; if the operator authorizes the defaults, GATE A is **PASS** and IMPLEMENT may proceed.

---

## Operator steps (post-merge)

The PR touches `supabase/migrations/**` AND `supabase/functions/**` → **merge = deploy** (governance contract §5; CLAUDE.md memory `supabase-merge-autodeploy`). Operator-only merge. The Supabase GitHub integration auto-applies the migration and redeploys the Edge Function on merge to `main`.

If the auto-apply does not fire:

```powershell
npx supabase db push --linked
npx supabase functions deploy admin-users --linked
```

Verification (read-only):

```powershell
npx supabase db status       # confirm 20260605000001 listed
npx supabase db lint         # plpgsql linting
```

UI ships via an operator-triggered Expo release after merge. No `.env` change, no secret rotation, no `familyRegistry` flip, no routing-arm change, no MCP change. **Claude stops at PR-open** (no migration apply, no Edge deploy, no Expo deploy, no merge by Claude).

---

## GATE A verdict

**PASS pending operator authorization of the four recorded defaults** (all have reasonable defaults; none blocks if the operator accepts the defaults). The cascade mechanism, the leak-vector view-model, and the migration shape are fully specified; a fresh implementer can build from this doc + the seven shipped per-argument files.
