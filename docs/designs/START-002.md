# START-002 — Circle-audience room creation (Edge additive `circle_id`)

**Status:** Design draft
**Epic:** Argument Surface Pivot (ASP-000 / #826), Milestone M-ASP-1
**Release:** Phase P1 (behind `home_v2`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/839
**Deploy-bearing:** YES — `create-argument-room` is registered in `supabase/config.toml:485` (`verify_jwt = true`); merge-to-main AUTO-DEPLOYS the Edge Function. Rollback = revert the merge (auto-redeploys the prior function). Nothing schema-side to unwind.

---

## 0. Scope-reality audit — the load-bearing section (READ FIRST)

The issue assumes the #860 circles foundation makes a circle member's **read access** to a circle-scoped room work "via the shipped `is_argument_visible_in_circle` arm" (AC2). **That assumption is false against the shipped schema.** Two independent facts, both verified in the worktree at base `a1f23aa`:

### Verdict A — the write path is achievable without a migration, but NOT the way the issue describes

The atomic room creator `public.create_argument_room(...)` **hard-rejects `private` + no invite** at the DB level for every caller, service-role included:

```sql
-- supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql:325-328
IF p_visibility = 'private'
   AND (p_invitee_email_lower IS NULL OR p_token_hash IS NULL) THEN
  RAISE EXCEPTION 'private_requires_invite' USING ERRCODE = 'check_violation';
END IF;
```

A circle room is `private` + **zero** invites. So the issue's stated write lane — "call `create_argument_room`, then `UPDATE ... SET circle_id`" — **cannot run**: the RPC throws before returning a row.

**Achievable mechanism (no migration):** create the room via the RPC as `visibility='public'` + no invite (a *valid* matrix state — public/no-invite is accepted; RPC also atomically joins the creator as `moderator`), then a single service-role `UPDATE public.debates SET visibility='private', circle_id=<id> WHERE id=<new>`. The QOL-039 one-way visibility trigger permits `public -> private` (it only rejects `private -> public`; `BEFORE UPDATE OF visibility`, verified `20260524000015_qol_039_room_visibility.sql:108`), and the `debates_circle_requires_private` CHECK is satisfied (`circle_id NOT NULL AND visibility='private'`). The issue's "`SET circle_id`" must therefore become "`SET visibility='private', circle_id`". This is corrected below and is fully within the no-migration constraint. (A direct `svc.from('debates').insert(...)` is **forbidden** by the existing pinned test `createArgumentRoomEdge.test.ts` — "does NOT insert into debates directly" — so the RPC path is the only backward-compatible option.)

### Verdict B — BLOCKING: circle members cannot READ a circle room without a migration

`is_argument_visible_in_circle` is defined and `grant execute ... to authenticated` (`20260702000001_private_groups_002_circles.sql:338-369`) **but it is called by ZERO policies.** The current, live SELECT policies (latest DROP+CREATE is `20260606000001`, *before* the circles migration; the circles migration did not touch them) contain **no circle-member arm**:

```sql
-- debates SELECT (20260606000001:167-181) — live
USING ( is_moderator_or_admin()
  OR (created_by = auth.uid() AND inactive_at IS NULL)
  OR (public.is_debate_participant(id, auth.uid()) AND inactive_at IS NULL)
  OR (visibility = 'public' AND status IN ('open','locked') AND inactive_at IS NULL) );

-- arguments SELECT (20260606000001) — live: author OR admin OR (posted AND active AND (public OR participant))
```

Neither references `is_circle_member` nor `is_argument_visible_in_circle`. Because **no card before START-002 ever wrote `debates.circle_id`**, no circle-scoped room has ever existed, so this gap was latent and the #860 "production 18/18" smoke exercised circle *management* (create/rename/invite/accept) — never a circle-scoped *room read*.

**Consequence:** a room created by START-002 will be readable **only by its creator** (via the `created_by` / participant arm) — exactly like an ordinary private no-invite room. Every other circle member gets nothing: they are not participants (zero invite fan-out, no seat mechanics — both are explicit non-goals), and the read arm that would grant them access is dormant. **AC2's "a second circle member reads the room via `is_argument_visible_in_circle`" is unreachable within the no-migration constraint.**

Wiring the dormant helper into the `debates` + `arguments` SELECT policies is a **DROP+CREATE policy migration** — forbidden by START-002's "no migration / RLS untouched / zero policy or helper edits" AC. **AC2 and the no-migration AC are therefore mutually inconsistent against the shipped schema.**

This gap **also blocks the sibling HOME-003** (circle-home lane): listing circle *rooms* for a non-creator member reads `debates` rows the debates SELECT policy will not return. Same dormant-arm root cause. (See the reconciliation section.)

### Operator decision required (do not paper over)

| Option | START-002 shape | AC2 read | Blast radius |
|---|---|---|---|
| **1 — RECOMMENDED: split** | Ships exactly as scoped: Edge additive + write-lane + guards + shared circles module + picker/sheet. **No migration.** AC2's read sub-clause is **deferred** to a companion migration card (spec'd in §5). | Deferred to companion card | Edge only; safe (behind `home_v2`, off in prod) |
| **2 — fold** | START-002 becomes **migration-bearing**: also DROP+CREATEs the `debates` + `arguments` SELECT policies to add the circle-member read arm. | Closed in-card | Migration + Edge; heightened review (OPS-001), operator `db push` |

**Recommendation: Option 1.** Rationale: (a) honors the issue's foregrounded no-migration scope and keeps the *first deploy-bearing card* to a single moving part (the Edge auto-deploy); (b) the read-arm migration deserves its own OPS-001 heightened-review, migration-bearing card (it touches two of the most security-sensitive policies in the schema); (c) `home_v2` is OFF in production, so shipping "creation without member-read" harms no live user and unblocks #840. Under Option 1, AC2 is **reframed** to what START-002 can prove: *the debates row carries `circle_id`, the creator can read it, and zero invites are minted*. The "second member reads" clause moves to the companion card. This deferral is recorded in the Orchestrator brief ledger (§16) and must be surfaced to the operator at merge.

The rest of this doc specs the **Option-1 achievable design in full** and specs the **companion migration** (§5) so either option can be executed without further design.

---

## 1. Goal

Let a user pick one of *their circles* as the audience when starting an argument (the reserved circle slot in the START-001 person picker), producing a **private** room scoped to that circle. The Edge Function `create-argument-room` gains one **optional, additive** `circle_id` parameter; requests without it behave byte-identically (the reseeder, `StartArgumentPage`, and `StartArgumentSheet` all call this function in production). Doctrine shaping the design: a circle is an **access + memory boundary, never a ranking or label** (cdiscourse-doctrine §1-§3); **private-by-default** is *strengthened* (circle rooms are private by an Edge guard AND the `debates_circle_requires_private` CHECK); the deterministic creation matrix + Edge guards remain the sole gate (no AI in this path); **no service-role in the client**; **no enumeration oracle** (non-member and nonexistent circle are indistinguishable).

---

## 2. Data model

**No new data model. No migration.** Every table, helper, RPC, index, and CHECK this card relies on shipped in `20260702000001_private_groups_002_circles.sql` (#860) and `20260613000001_arg_room_002_room_capacity_and_creation.sql` (#613):

- `public.debates.circle_id uuid null references public.circles(id) on delete set null` — the room↔circle link (single nullable FK; at most one circle per room).
- `debates_circle_requires_private` CHECK — `circle_id IS NULL OR visibility='private'` (the DB backstop; the Edge guard mirrors it).
- `public.is_circle_member(p_circle_id uuid, p_user_id uuid default auth.uid())` — SECURITY DEFINER STABLE, `grant execute ... to authenticated`. The membership read spine.
- `public.create_argument_room(...)` — the atomic creator (debate + creator participant + optional invite), `grant execute ... to service_role`.
- Circles/`circle_members` SELECT policies (`circles_select_member_owner_admin`, `circle_members_select_member_admin`) — the RLS basis for the shared read module (§3).

Client type additions are interface-level only (no persisted shape changes): `CreateArgumentRoomInput.circleId?`, `CreateDebateInput.circleId?`, `PersonTarget` gains a `circle` variant, `CircleOption.memberCount?`. All additive/optional.

---

## 3. Shared circles-read client module contract (HOME-003 reconciliation surface)

START-002 **owns** this contract. HOME-003 must consume it verbatim; the HOME-003 designer's assumptions reconcile against this section.

**Module (new):** `src/features/circles/circlesApi.ts` (client network glue; imports `{ supabase, SUPABASE_CONFIGURED }` from `../../lib/supabase`, mirroring `debatesApi.ts:1`). A thin hook `src/features/circles/useMyCircles.ts` mirrors `useRecentOpponents` (returns `{ circles, loading, error, refresh }`). Pure derivations reuse the existing `src/features/circles/circleModel.ts` (`liveMemberCount`, `memberCountBand`) — **no change to `circleModel.ts`.**

**Return shape (frozen contract):**

```ts
import type { CircleRole } from './circleModel'; // 'owner' | 'member'

/** A circle the CALLER is a live member of, projected for the picker + home lane.
 *  Member IDENTITIES are never included (START-001 privacy precedent): name +
 *  count + the caller's own role only. `name` is user content — the rendered-UI
 *  ban-list test scans it (like a room title / recent-opponent label). */
export interface MyCircleSummary {
  id: string;
  name: string;
  memberCount: number; // live members (is_removed = false); a STRUCTURAL fact, never a ranking
  role: CircleRole;    // the caller's role in THIS circle
}

export interface CirclesApiResult<T> { ok: boolean; data?: T; error?: string; }

/** List the circles the caller is a live member of, newest-membership-first.
 *  Pure anon-key + caller JWT client — NO service role, NO oracle. */
export async function listMyCircles(): Promise<CirclesApiResult<MyCircleSummary[]>>;
```

**RLS basis (cited, not assumed):**
- `circles` SELECT is scoped by `circles_select_member_owner_admin` (`20260702000001:436-444`, `to authenticated`, `using is_circle_member(circles.id, auth.uid()) OR is_circle_owner(...) OR is_moderator_or_admin()`). A plain `supabase.from('circles').select('id,name').eq('is_deleted', false)` therefore returns **exactly the caller's circles** — RLS does the filtering; there is no global circle search (no oracle, doctrine §10 scope).
- Member count + caller role come from `circle_members` under `circle_members_select_member_admin` (`20260702000001:454-462`) — a member may read co-members. Recommended shape: `supabase.from('circle_members').select('circle_id,user_id,role').eq('is_removed', false).in('circle_id', ids)`, then group client-side (`memberCount` = rows per `circle_id` via `circleModel.liveMemberCount`; `role` = the row whose `user_id === callerId`, from `supabase.auth.getUser()`). The implementer MAY instead use a single PostgREST embed (`circles` with an embedded `circle_members(count)` + `role`) — the **return shape above is the contract**, the query strategy is not.

**Reconciliation notes for HOME-003:**
1. Consume `listMyCircles()` unchanged; do not fork a second "list my circles" reader.
2. HOME-003's *list circle ROOMS for a member* step reads `public.debates WHERE circle_id = ...`. Under the live debates SELECT policy (Verdict B), a **non-creator member gets zero rows** until the companion migration (§5) lands. Design HOME-003's empty state accordingly, and do not present a non-creator member's circle-room lane as populated pre-migration.
3. `MyCircleSummary` carries no member emails/ids/names — if HOME-003 needs a roster it must add its own (privacy-reviewed) reader; the picker/home summary contract is name + count + own-role only.

---

## 4. Edge contract delta (`supabase/functions/create-argument-room/index.ts`)

Additive only. The **non-circle path is structurally untouched**: a single early branch on `body.circle_id !== undefined` routes to a new `handleCircleRoomCreate`; the existing `handleCreateArgumentRoom` body is not edited, so AC1 (byte-identical no-circle behavior) is provable by diff.

### 4.1 Request schema (additive, stays `.strict()`)

```ts
const CreateArgumentRoomSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    resolution: z.string().trim().min(1).max(5000),
    description: z.string().trim().max(10000).optional(),
    visibility: z.enum(['public', 'private']),
    invite: InviteObject.optional(),
    circle_id: z.string().uuid().optional(), // ← ADDED
  })
  .strict();
```

`.strict()` is preserved → unknown keys still 422; a non-uuid `circle_id` → 422 `validation_failed` (schema-level). Requests without `circle_id` parse and behave identically.

### 4.2 Branch + guard order (all rejections BEFORE any DB write)

In `handleCreateArgumentRoom`, immediately after caller identification (`getUser`), add:

```ts
if (body.circle_id !== undefined) {
  return await handleCircleRoomCreate(body, callerId, callerClient, constitutionLookup, requestOrigin);
}
// ── existing non-circle path continues unchanged below ──
```

`handleCircleRoomCreate` runs guards in this fixed order:

1. **Forced-private (reject, not coerce).** `if (body.visibility === 'public')` → `400 circle_requires_private`. *Reject is honest* — we never silently override an explicit `public` choice. (Client never sends this; the picker disables the public toggle for circles. Defense-in-depth.)
2. **One audience per room.** `if (body.invite !== undefined)` → `422 validation_failed` (`validationFailed({ error:'validation_failed', issues:[{ path:['invite'], message:'A circle argument is its own audience — do not add an invite.' }] })`). (Client never sends both.)
3. **Membership (no oracle).** Caller-scoped `const { data: isMember, error } = await callerClient.rpc('is_circle_member', { p_circle_id: body.circle_id })` (`p_user_id` defaults to `auth.uid()` under the caller JWT = caller). On `error` → `500 circle_lookup_failed`. On `isMember !== true` → `404 circle_not_found`. **Non-member, nonexistent, and soft-deleted circle all return the identical `404 circle_not_found`** (the helper returns `false` for all three) — no circle-existence oracle.
4. **Active constitution** — reuse the existing caller-scoped `constitution_versions` read (`no_active_constitution` / `constitution_lookup_failed` unchanged).

### 4.3 Write lane (no migration; RPC then flip)

```ts
// 1) Atomic room + creator participant, created PUBLIC + no invite so the RPC's
//    private_requires_invite rule does not fire (see §0 Verdict A).
const svc = createServiceClient();
const { data: rpcData, error: rpcErr } = await svc.rpc('create_argument_room', {
  p_created_by: callerId,
  p_title: body.title,
  p_resolution: body.resolution,
  p_description: body.description ?? null,
  p_constitution_id: constitutionId,
  p_visibility: 'public',            // ← internal mechanism only; corrected below
  p_invitee_email_lower: null,
  p_intended_seat: null,
  p_token_hash: null,
  p_expires_at: null,
});
if (rpcErr) return internalError('room_create_failed');
const debateId = /* row.debate_id */;
if (!debateId) return internalError('room_create_failed');

// 2) Flip to private + stamp the circle in ONE statement. The QOL-039 one-way
//    trigger permits public->private; the debates_circle_requires_private CHECK
//    is the DB backstop (circle_id NOT NULL => private).
const { data: updRows, error: updErr } = await svc
  .from('debates')
  .update({ visibility: 'private', circle_id: body.circle_id })
  .eq('id', debateId)
  .select('id'); // to verify exactly one row changed
if (updErr || !updRows || updRows.length !== 1) {
  // Log the orphan short id for operator cleanup; return a clean failure.
  console.error('create_argument_room_circle_flip_failed', { debateIdShort: shortId(debateId) });
  return internalError('room_create_failed');
}
```

**No direct `debates` insert** (preserves the existing pinned assertion). Uses `.update`, which the existing test does not forbid.

### 4.4 Response shape

- **Non-circle path: byte-identical** — `{ debateId, visibility, inviteId, inviteLink }`. No new key. (Pinned.)
- **Circle path 200:** `{ debateId, visibility: 'private', inviteId: null, inviteLink: null, circleId: <body.circle_id> }`. The `circleId` key is **present only on circle-path 200s** (a testable round-trip signal). `CreateArgumentRoomResult` gains `circleId?: string | null` (optional; non-circle omits the key). This is a low-cost additive signal; if the reviewer prefers zero response-shape change on the first deploy-bearing card, omitting `circleId` is acceptable and changes nothing else.

### 4.5 Error codes (new)

| Code | Status | When | Plain-language (via `gameCopy.toPlainLanguage`) |
|---|---|---|---|
| `circle_requires_private` | 400 | `circle_id` + `visibility:'public'` | "A circle argument is always private." |
| `validation_failed` | 422 | `circle_id` + `invite` | generic (existing) |
| `circle_not_found` | 404 | non-member / nonexistent / deleted | "We could not find that circle." |
| `circle_lookup_failed` | 500 | membership RPC error | generic |
| `room_create_failed` | 500 | RPC error or flip UPDATE failed/≠1 row | existing |

All messages are person-neutral and verdict-free (ban-list scanned). Internal codes are never echoed to users — they route through `gameCopy.toPlainLanguage` (doctrine §9).

### 4.6 Logging

Short circle id only (`shortId`), reusing the existing `shortId` posture; email-domain-only rule unchanged (circle path has no email). No `circle_id` full value, no `Authorization`, no service-role key in any log line.

---

## 5. Companion migration design (closes AC2 read — Option 1's follow-up / Option 2's in-card work)

A new migration `supabase/migrations/<UTC>_cov_005_circle_room_read_arm.sql` (name illustrative) wires the dormant helper into the two SELECT policies, **strictly additively** (append a circle-member arm; loosen nothing):

- **`debates` SELECT** — DROP+CREATE the current successor policy, appending one arm:
  `OR (visibility='private' AND circle_id IS NOT NULL AND inactive_at IS NULL AND public.is_circle_member(circle_id, auth.uid()))`.
- **`arguments` SELECT** — DROP+CREATE, appending an arm that calls the shipped composite helper:
  `OR (status='posted' AND inactive_at IS NULL AND NOT public.is_debate_inactive(debate_id) AND public.is_argument_visible_in_circle(id, auth.uid()))` — reusing `is_argument_visible_in_circle` per its lockstep contract (`circleVisibilityCompositionRlsScan` is the alarm bell).

Discipline: append-only migration; every non-admin arm keeps its `inactive_at`/cascade gates verbatim; fully-qualified columns (OPS-001 Class 1); no helper edits (the helpers already exist). Migration-bearing → heightened reviewer template + operator `npx supabase db push --linked`. Under Option 1 this is a **separate card** (recommend filing as PRIVATE-GROUPS-003 / COV-005, "Blocks #840 read + HOME-003 member lane"). Under Option 2 it lands inside START-002 and this card becomes migration-bearing.

**This design does NOT implement §5 as part of START-002 unless the operator chooses Option 2.** It is specified here only so the follow-up needs no further design.

---

## 6. File-by-file change list

### Slice S1 — shared circles-read module (no Edge, no deploy)
- **new** `src/features/circles/circlesApi.ts` (~70 lines) — `listMyCircles()` + `MyCircleSummary` / `CirclesApiResult`. RLS-scoped reads; no service role; no member identities.
- **new** `src/features/circles/useMyCircles.ts` (~40 lines) — hook mirroring `useRecentOpponents` (`{ circles, loading, error, refresh }`).
- *(no change to `circleModel.ts` — reused.)*

### Slice S2 — Edge Function additive + tests (DEPLOY-BEARING)
- **modified** `supabase/functions/create-argument-room/index.ts` (~+65 lines) — schema `circle_id`; early `handleCircleRoomCreate` branch; guards (§4.2); RPC-public-then-flip write lane (§4.3); circle response key; new error codes + logging. Non-circle code path untouched.
- **modified** `__tests__/createArgumentRoomEdge.test.ts` (~+45 lines) — ADD circle-path source-scans (see §9). Keep every existing assertion green (AC1).
- *(no `config.toml` change — `[functions.create-argument-room]` block already present.)*

### Slice S3 — picker + sheet + client + copy + tests
- **modified** `src/features/arguments/startArgument/personArgumentPickerModel.ts` (~+18 lines) — `PersonTarget` gains `{ kind:'circle'; circleId: string; label: string }`; `CircleOption` gains `memberCount?: number`; `personTargetToInviteEmail` returns `''` for circle; add `isCircleTarget(t)` + `circleTargetId(t)`. `orderPickerRows` already reserves the slot — no ordering change. `personTargetToCreationIntent` is NOT called for circles (guard with `isCircleTarget` at the call site). **`argumentRoomCreationMatrix.ts` is NOT touched** (AC5).
- **modified** `src/features/arguments/startArgument/PersonArgumentPicker.tsx` — render circle rows from the `circles` prop; on select emit `PersonTarget{kind:'circle'}`; a11y per §7.
- **modified** `src/features/arguments/startArgument/StartArgumentSheet.tsx` (~+25 lines) — `const isCircle = target?.kind === 'circle'`; `canSubmit` uses `isCircle ? draftSubmittable : (draftSubmittable && creation.valid)`; `handleSubmit` builds a circle `CreateDebateInput` (`{ title, resolution, description:'', visibility:'private', circleId }`, **no invite**) when `isCircle`, else the existing matrix path; pass `disabled: submitting || isCircle` into `renderPublicToggle` (public locked off for circles); render a circle summary line. Non-circle rendering/payload unchanged (contract test stays green).
- **modified** `src/features/debates/types.ts` — `CreateDebateInput.circleId?: string`.
- **modified** `src/features/debates/debatesApi.ts` — `CreateArgumentRoomInput.circleId?: string`; `createArgumentRoom` adds `if (input.circleId) body.circle_id = input.circleId` (key omitted otherwise); `CreateArgumentRoomResult.circleId?: string | null`; `createDebate` threads `...(input.circleId ? { circleId: input.circleId } : {})`.
- **modified** `src/features/arguments/gameCopy.ts` — add `circle_requires_private` + `circle_not_found` to the `toPlainLanguage` map AND to the internal-codes coverage list (the plain-language coverage test iterates it); add circle strings to `START_SHEET_COPY` (see §8).
- **modified** `App.tsx` — mount `useMyCircles()` near `useRecentOpponents`; map results to `CircleOption[]` and pass `circles={...}` to `StartArgumentSheet`. Already inside the `home_v2`-gated `startSheetActive` block — no new flag.

**New tests:** `__tests__/circlesApi.test.ts`, `__tests__/startArgumentSheetCircleAudience.test.tsx`, `__tests__/debatesApiCirclePayload.test.ts`; **extended:** `__tests__/personArgumentPickerModel.test.ts`, `__tests__/createArgumentRoomEdge.test.ts`.

---

## 7. Component spec (a11y floors)

- **Circle picker row** (`PersonArgumentPicker`): `<Pressable accessibilityRole="button">`, `accessibilityState={{ selected: value?.kind==='circle' && value.circleId===circle.id }}`, hit target ≥ 44×44 (`hitSlop` if visual smaller). `accessibilityLabel` reads the *action + structure*, e.g. `"Argue inside the circle {name}, {memberCount} people. Stays private."` — no verdict/ranking language; count is structural. Visual: name (primary `<Text>`) + "{N} people" subtitle (secondary `<Text>`); a lock/circle glyph (`<Text>` glyph, not an icon dep) so meaning survives grayscale (color-independence). All strings inside `<Text>`.
- **Public toggle when a circle is selected:** rendered `disabled` with a one-line reason ("Circle arguments are always private."); `accessibilityState={{ disabled: true }}`. The keyboard shortcut/badge conventions do not apply (no new key badge introduced).
- **Circle summary line** (analogous to the private summary): `<Text>` "Inside {circle} — {N} people can read it." Neutral, structural.
- Reduce-motion: no new animations introduced. Focus order unchanged (circle rows sit in the reserved slot between recents and email entry, per `orderPickerRows`).

---

## 8. Copy plan (all ban-list clean; codes route through `toPlainLanguage`)

`START_SHEET_COPY` additions:
- `circleRowA11yHint: 'Starts a private argument inside this circle.'`
- `circlePrivateSummary: 'Inside {circle} — only its members can read it.'`
- `circleForcesPrivate: 'Circle arguments are always private.'`
- (optional) `circlesLabel: 'Your circles'` (picker section header).

`toPlainLanguage` map additions (doctrine §9 — never echo the raw code):
- `circle_requires_private -> 'A circle argument is always private.'`
- `circle_not_found -> 'We could not find that circle.'`

None contain verdict/amplification/person-attribution tokens. Circle **names** are user content — surfaced only in the picker/summary and scanned in rendered UI by the existing ban-list test (like room titles / recent-opponent labels), never rejected at input.

---

## 9. Test plan (expected delta vs baseline 928 suites / 33,220 tests)

**Edge (source-scan, extend `createArgumentRoomEdge.test.ts` — Deno-only imports can't load in Jest, same pattern as today):**
- Schema additivity: `circle_id: z.string().uuid().optional()` present; `.strict()` retained.
- Guard order: `circle_requires_private` (400), `validation_failed` for circle+invite (422), `circle_not_found` (404) all appear *before* any `.rpc(` / `.update(` in the circle branch (regex-order scan).
- Non-member vs nonexistent EQUALITY: exactly one `circle_not_found` literal used for the membership-false path (no separate "not member"/"no circle" code).
- Zero invite mint on the circle path: circle branch passes `p_invitee_email_lower: null` + `p_token_hash: null`; no `generateInviteToken` call reachable in the circle branch.
- Service-role touches ONLY the RPC + the one `debates` `.update` (scan: circle branch has `.rpc('create_argument_room'` and `.from('debates')...update`, and still **no** `.from('debates')...insert`).
- Log-shape scan: circle branch logs short ids only; no `circle_id` full value / `authorization` / `service_role` in any `console.*` line.
- **AC1 regression:** every existing assertion in the suite stays green (unchanged).

**Shared module (`circlesApi.test.ts`):** `listMyCircles` return shape; source-scan that it uses the anon-key `supabase` client (no `createServiceClient` / `SERVICE_ROLE`); no member email/id field in `MyCircleSummary`; `SUPABASE_CONFIGURED` guard.

**Client (`debatesApiCirclePayload.test.ts`):** `createArgumentRoom({..., circleId})` → invoke body contains `circle_id`; `createArgumentRoom({...})` (no circleId) → body has **no** `circle_id` key (byte-shape preserved); mixed with invite absent.

**Picker model (extend `personArgumentPickerModel.test.ts`):** circle `PersonTarget` variant; `personTargetToInviteEmail` returns `''` for circle; `isCircleTarget` guard; ban-list still passes with the new variant; `orderPickerRows` slot unchanged.

**Sheet RNTL (`startArgumentSheetCircleAudience.test.tsx`):** selecting a circle row → visibility forced `private` + public toggle `disabled`; submit payload `= { title, resolution, description:'', visibility:'private', circleId }` with **no `invite` key**; the START-001 `startArgumentSheetCreationContract` scenarios stay deep-equal (non-circle path untouched).

**Doctrine ban-list:** new copy strings + circle picker labels scanned for verdict/amplification/person tokens.

**Unchanged-green (AC6):** `circleRlsScan`, `circleVisibilityCompositionRlsScan`, `circleMigration` (no RLS/helper edits under Option 1).

**Expected delta:** roughly **+30 to +45 tests / +3 suites** (S1 module suite, S3 sheet suite, S3 payload suite; plus extensions to two existing suites). Net suites 928 → ~931. No suite removed; count only goes up. (If Option 2 is chosen, add the migration suite `circleRoomReadArm` and the `circleRlsScan`/`circleVisibilityCompositionRlsScan` deltas.)

---

## 10. Edge cases

- **circle_id + public** → 400 `circle_requires_private` (reject; no coerce).
- **circle_id + invite** → 422 `validation_failed` (one audience).
- **Non-member / nonexistent / soft-deleted circle** → identical 404 `circle_not_found` (no oracle).
- **Membership RPC transport error** → 500 `circle_lookup_failed` (distinct from a clean not-member).
- **Flip UPDATE fails / affects ≠ 1 row** → 500 `room_create_failed`; orphan (a valid public empty room, creator joined) is logged by short id for operator cleanup. On client retry a fresh attempt runs; empty public rooms carry no arguments and no circle data — low harm. (See Risk R2.)
- **Momentary-public window** — between the RPC commit and the flip commit (one round-trip), the row is `public/open` and thus listable via the public arm. It contains **zero arguments** and no circle-member data; only the creator-authored title/resolution could be briefly public. Bounded, sub-second, documented (Risk R2). Unavoidable without a single-tx RPC (= migration).
- **Empty circles list** — picker shows no circle rows (slot collapses); the section header is suppressed when `circles.length === 0`.
- **Malformed circle_id** (non-uuid) → 422 at the schema (`.strict()` + `.uuid()`).
- **Creator reads own circle room** — succeeds via the `created_by` debates-SELECT arm even pre-companion-migration (this is why the room is usable for #840's creator flows; other members still cannot read pre-migration — Verdict B).
- **Doctrine edge:** a circle never influences strength bands, heat, or standing — it is only an audience/memory boundary. Nothing in this path reads or writes score.

---

## 11. Dependencies

- **Depends on:** START-001 (`StartArgumentSheet` + `PersonArgumentPicker` + `personArgumentPickerModel`; supplies the reserved circle slot & `CircleOption`); #860 circles foundation (`is_circle_member`, `debates.circle_id`, `debates_circle_requires_private`, circles SELECT policies); ARG-ROOM-002 (`create_argument_room` RPC + Edge); QOL-039 one-way visibility trigger; `home_v2` flag plumbing (already gates `startSheetActive`).
- **Reads existing:** `create_argument_room` RPC; `is_circle_member` RPC; `debates` `.update`; circles/`circle_members` SELECT policies; `gameCopy.toPlainLanguage`; `deriveArgumentRoomCreation` (non-circle path only, untouched).
- **Blocks:** #840 (Circle-home lane needs circle rooms to exist) and, for non-creator member *reads*, the companion migration (§5).
- **Concurrency:** HOME-003 is authored in the same worktree; it owns `docs/designs/HOME-003.md` and must reconcile its "list my circles + membership" against §3 and its "list circle rooms" empty-state against Verdict B.

---

## 12. Risks

- **R1 — merge = deploy (THE risk).** `create-argument-room` auto-deploys on merge (`config.toml:485`). Mitigation: the non-circle path is a structurally separate, unedited code path (AC1 provable by diff + the full existing test suite unchanged-green); the circle change is inert without a `circle_id` request; `home_v2` is off in prod so no client sends `circle_id` yet. **Rollback = revert the merge → the prior function auto-redeploys.** Nothing schema-side to unwind. The no-circle path must be *provably untouched* — this is the reviewer's primary gate.
- **R2 — non-atomic write / momentary-public window.** Two DB round-trips (RPC then flip) are not one transaction; the room is briefly public and, if the flip fails, an empty public room persists. Mitigations: flip is the immediate next statement; orphan is a valid (if unintended) public empty room, logged by short id; no arguments/circle data can leak in the window. A fully-atomic never-public creator would require a new/modified RPC (= migration), out of scope. Documented as accepted for Option 1.
- **R3 — AC2 unreachable pre-migration (Verdict B).** Circle members cannot read the room until §5 lands. This is an operator-decision item, not a code defect; the reviewer must confirm the chosen option (split vs fold) and that AC2 is reframed accordingly.
- **R4 — existing pinned test.** `createArgumentRoomEdge.test.ts` forbids a direct `debates` insert; the design uses `.update` (compatible). Any implementer tempted to direct-insert breaks AC1 — flagged.
- **R5 — shared-module double-write.** START-002 and HOME-003 both may touch `debatesApi.ts`/`types.ts`. START-002 owns the *write/create* threading + `circlesApi.ts`; HOME-003 owns the *read/list-rooms* side. Keep edits non-overlapping per §3/§11.

---

## 13. Out of scope

- No migration (Option 1); no RLS/helper/policy edits; no CHECK edit.
- No circle management UI (`manage-circle` / `manage-circle-invite` / roster surfaces untouched).
- No new visibility value; no change to the non-circle creation path or the creation matrix.
- No join/seat mechanics; `PRIVATE_ACTIVE_PARTICIPANT_CAP=2` unchanged — how a circle member takes a seat is #840.
- No notification/email fan-out to circle members.
- No HOME-003 circle-home lane (sibling card).
- No AI anywhere in this path; no service-role in the client.
- The companion read-arm migration (§5) unless the operator selects Option 2.

---

## 14. Doctrine self-check

- **cdiscourse-doctrine §1-§3 (no truth/heat/popularity):** a circle is an access boundary; `memberCount` is a structural fact, never a ranking; no score/heat is read or written; no copy contains verdict/amplification tokens (ban-list scanned).
- **Score never blocks posting:** unaffected — this is room creation, not posting; validity is the deterministic matrix + Edge guards.
- **§4 AI limits:** no AI in this path.
- **§6/§7 secrets + no client AI/service-role:** service-role stays inside the Edge Function; client speaks only `functions.invoke` and RLS-scoped reads; `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE" app/ src/` returns zero (AC7).
- **§8 Supabase conventions:** RLS never disabled; no migration edits (Option 1); no direct `debates` insert; soft-delete semantics untouched.
- **§9 plain language:** every new internal code maps through `toPlainLanguage`; raw codes never echoed.
- **No enumeration oracle:** non-member and nonexistent circle are indistinguishable (`circle_not_found`); the picker only surfaces circles the caller is already a member of (RLS-scoped), so no directory/search is introduced (§10 scope).
- **supabase-edge-contract:** standard Edge shape preserved (CORS/JWT/validate/authorize/mutate-narrowest/log-safe); additive `.strict()` contract; the service-role client touches only the RPC + one `.update`.

---

## 15. Operator steps

**Option 1 (recommended):**
- After merge (auto-deploy) — verify Edge deploy, then the live smoke (member create → 200 + `debates.circle_id` set; non-member → `circle_not_found`; no-circle create → byte-identical). Command if a manual redeploy is ever needed: `npx supabase functions deploy create-argument-room --linked`.
- **File the companion migration card (§5)** so non-creator circle members (and HOME-003) can read circle rooms. That card runs `npx supabase db push --linked` (migration-bearing, heightened review).

**Option 2 (fold):** additionally `npx supabase db push --linked` for the read-arm migration *before/with* the Edge deploy, and START-002 receives migration-bearing review.

Rollback (either option): revert the merge → `create-argument-room` auto-redeploys the prior version. (Option 2 also requires the migration be reverted only via a new forward migration — never edit the applied file.)

---

## 16. Orchestrator brief interpretive ledger

The issue (#839) was rewritten in place (orchestrator-authored). Where orchestrator judgment substituted for explicit operator direction:

- **Derived from prior Phase framing / shipped source-of-truth chain:** the additive-`circle_id`, forced-private-by-reject, no-oracle, zero-invite-fan-out, and no-service-role-in-client requirements (verified against #860/#613/QOL-039 migrations + the START-001 surfaces).
- **Derived from pre-launch codebase survey (this design):** *Verdict A* — the RPC rejects private+no-invite, so the write lane must create public then flip (the issue's "SET circle_id" is corrected to "SET visibility='private', circle_id"); the direct-insert alternative is barred by an existing pinned test.
- **BLOCKING finding requiring operator review (Operator-deferred):** *Verdict B* — `is_argument_visible_in_circle` is dormant; AC2's "second member reads the room" is unreachable without a policy migration, which the no-migration AC forbids. AC2 and the no-migration AC are mutually inconsistent against the shipped schema. **Resolved by orchestrator default to Option 1 (split + companion card) pending operator ruling.** The operator must confirm Option 1 vs Option 2 and accept the AC2 reframing before/at merge.
- **Resolved by orchestrator default (minor):** circle-path response adds an optional `circleId` key (removable if the reviewer prefers zero response-shape change); `circle_lookup_failed` vs `circle_not_found` split; `MyCircleSummary` field set (name + count + own-role, no identities).
- **Requires operator review post-ship:** whether an empty (readable-only-by-creator) circle room is acceptable interim UX under Option 1 while §5 is pending (mitigated by `home_v2` OFF).
