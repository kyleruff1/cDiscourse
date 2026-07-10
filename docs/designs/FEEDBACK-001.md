# FEEDBACK-001 — move_marks + mark-move Edge + BooleanFeedbackBar (ghost pair)

**Status:** Design draft
**Epic:** PRODUCT-REDIRECT-001 / Argument Surface Pivot — Phase P7 · Milestone M-ASP-7 (Map intelligence + feedback layer)
**Release:** Behind the shipped `move_marks` flag (default OFF). Migration-bearing (merge = auto-apply) + deploy-bearing (NEW config.toml-registered Edge Function `mark-move`, merge = auto-deploy).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/898
**Design Pass source:** Output 8 (move_marks data model), Output 9 (Boolean MCP feedback — collect-explicit / where-they-appear / un-game-like / do-not-collect), Output 10 Phase 7, Output 11 PR-16, journey J10.
**Base:** `feat/feedback-001-move-marks` off `a67f2cc` (main, MARK-002 HEAD — full P0–P3.5 arc). Test baseline: **972 suites / 33,926 tests**.

---

## Goal

Fill the one cheap human signal the pipeline is missing — *is this exchange connecting?* — without turning the room into a scored match. Under the **active opponent move**, render two quiet ghost buttons ("Answered my point" / "Didn't answer it"), one tap, reversible, never required, never on your own move, never for observers. Persist each tap as a durable-but-retractable row in a new `move_marks` table, written only by a new server-authoritative `mark-move` Edge Function. Give the Map view capability parity (the same codes reachable from the node popover), and surface **aggregates in exactly two places** — the `ArgumentStateRail` and the Map legend — never as per-message counters, never a leaderboard.

The doctrine constraints that shape every decision below:

- **cdiscourse-doctrine §1/§10a** — a mark is a structural observation about a **MOVE**, never a verdict on a **person**. The five codes describe what a move did ("did_not_address"), and they pass the verdict-token ban-list.
- **point-standing-economy / anti-amplification** — this is the load-bearing boundary. A mark may feed the mediator projection and the heat model, but a count of marks **NEVER** grants a claim factual standing. `move_marks` is inert storage: no score column, no standing trigger, no import of `pointStanding`. Popularity-shaped signal must not feed standing (Output 9 "Do not collect").
- **Design Pass §9 un-game-like** — nothing required to post; reversible + low-drama (neutral STATUS tones, no red/green verdict colors, no confetti/streaks/XP); machine families stay invisible by default.
- **supabase-edge-contract** — no service-role in client, RLS always on, migrations append-only, the new Edge is config.toml-registered (the #509 auto-deploy hazard).

---

## Problem & scope

**In scope (PR-16 / #898):**
1. Migration: `public.move_marks` (id, debate_id, argument_id, marked_by, mark_code CHECK of 5 codes, created_at, retracted_at, UNIQUE(argument_id, marked_by, mark_code)). RLS posture per the decision below.
2. NEW `mark-move` Edge Function (`mark` + `retract` actions; participant-only; own-move marks forbidden; paired-code mutual-exclusivity; no-oracle reads; idempotent; config.toml-registered + registration scan).
3. Client wrappers: low-level `markMove` in `src/lib/edgeFunctions.ts` + narrow seam `src/features/feedback/moveMarksApi.ts` + pure model `moveMarksModel.ts` (+ aggregate model).
4. `BooleanFeedbackBar` — ghost pair under the ACTIVE opponent move only (+ optional contextual `receipts_requested`); reversible; observers disabled; hidden on own moves; neutral tones.
5. Map popover parity — the same mark codes reachable via `MapNodeActionPopover` through the same injected handlers.
6. Two aggregate surfaces — an additive contribution into the `ArgumentStateRail` inputs + a Map-legend line, both consumed from ONE derivation.
7. Flag wiring (`isMoveMarksEnabled()`, already shipped) + flag-off byte-identity + pinned-file zero-diff.

**Out of scope** — see the dedicated section at the end (Family K, `good_receipt` UI entry point, `off_the_point` branch nudge, MCP contradiction-candidate surfacing, INTEL-001 dodge-chain derivations).

---

## Precedent audit (load-bearing for the posture call)

Two shipped precedents decide this card. I read both in full.

### A. `point_tags` (META-1A, `20260517000009_meta_1a_point_tags.sql`) — the direct analogue the spec cites

- Shape: `point_tags(id, debate_id, argument_id, tag_code, tagged_by, created_at, removed_at, removed_by)`; partial UNIQUE `(argument_id, tag_code, tagged_by) where removed_at is null`; RLS **INSERT own-participant + SELECT room-visible + UPDATE soft-delete own/admin, NO DELETE policy**.
- **The critical finding:** the migration header states plainly — *"The `apply-manual-tag` Edge Function is the ONLY write path. The room-shell loader does a read-only SELECT (the documented exception)."* The RLS owner-INSERT/UPDATE policy exists **as defense-in-depth**, not because the client writes directly. The client calls `apply-manual-tag`.
- `concession_items` / `concession_acceptances` / `move_reactions` (all in `20260522000012_qol_041`) follow the identical idiom: RLS permits the owner write, but a **submit-argument / react-to-move Edge Function is the real gate**; the RLS comment repeats "RLS is defense-in-depth."

**Conclusion:** the "point_tags precedent" for *direct-RLS client writes* is a mirage. **No human-boolean-on-a-move table in this repo has ever shipped a client that writes directly** — every one routes writes through an Edge Function. So the spec's "INSERT/UPDATE own" line describes the RLS *shape* of the older tables, not a client-writes-directly posture.

### B. `react-to-move` (QOL-041 fist-bump, `supabase/functions/react-to-move/index.ts`) — the near-exact structural twin

- The fist-bump is `move_marks` minus four codes: a per-move human boolean, toggle on/off, one-active-per-reactor, soft-delete, **NO score/standing**, audit row, never touches `public.arguments`.
- Guard ladder: CORS/method → auth header → JSON → `action ∈ {add,remove}` → uuid check → `kind` allow-list → `getUser` → caller-scoped argument load (RLS = no-oracle visibility) → debate/argument consistency → **own-move guard** → mutate (caller-client) → re-select → audit.
- **The own-move guard is the key tell (index.ts:135-139):** *"RLS does not have cheap access to the argument's author_id without a join — the function is the authoritative gate."* react-to-move writes with the **caller client** (RLS permits owner-INSERT); it uses service-role only for the audit row.
- **What react-to-move does NOT do:** a participant check. It relies on RLS visibility only, which **admits public-room observers** (an observer of a public room can see the move → can fist-bump). FEEDBACK-001 is stricter: marks are **participant-only** (observers disabled).

### C. The current house default — SELECT-only + service-role Edge (4 instances)

- `create-marker` (MARK-002, `supabase/functions/create-marker/index.ts`) — the SOLE writer for the SELECT-only `timestamp_markers`. 12-guard fail-closed ladder incl. `is_debate_participant` RPC gate (`callerClient.rpc('is_debate_participant', { p_debate_id })`, `p_user_id` defaults to `auth.uid()`); writes with **service-role**.
- `proof_items` + `proof_relations` (PROOF-001, `20260710000001`) and `timestamp_markers` (MARK-001, `20260711000001`) ship **SELECT-only**: exactly one `FOR SELECT ... to authenticated using (... is_argument_visible_in_circle(<table>.argument_id, auth.uid()))` policy, **no INSERT/UPDATE/DELETE policy, no write-gate helper, no write-guard trigger**; all writes via a service-role Edge. Four SELECT-only instances (proof_items, proof_relations, timestamp_markers, circles #859) are the P3–P3.5 default.

---

## RLS-posture decision (delegated — this card decides)

**VERDICT: SELECT-only, room-visible, active-only — NO client INSERT/UPDATE/DELETE policy. All writes performed by a new `mark-move` service-role Edge Function.** This is posture (C), the current house default; it supersedes the older point_tags/move_reactions defense-in-depth shape for this card.

Justification, weighed honestly against the spec's "INSERT/UPDATE own":

1. **The point_tags precedent does not support direct-RLS writes.** Its own header says the Edge is the only write path; the RLS owner-write is defense-in-depth. Every sibling (move_reactions, concession_items) is the same. So "matching point_tags" actually means "route writes through an Edge" — which is exactly SELECT-only + Edge in modern form.
2. **The not-own-move guard needs `arguments.author_id`.** react-to-move's own comment: RLS lacks cheap access without a join. Expressing own-move-forbid in an INSERT policy means either a cross-table subquery in the policy (Class-1 ambiguous-column territory — precisely what PROOF-001/COV-004 deliberately avoid: *"no policy body contains a subquery"*) or a **new** SECURITY DEFINER helper. Extra attack surface for no benefit.
3. **The participant-only gate cannot be inherited from react-to-move's RLS** (which admits public observers). It needs `is_debate_participant(debate_id, auth.uid())` — cheap in the Edge (create-marker's Guard 7), another subquery/helper in a policy.
4. **Paired-code mutual-exclusivity is two-row application logic.** Marking `addressed_my_point` must atomically retract an active `did_not_address` by the same viewer on the same move (so the aggregate can never count a viewer in both). RLS cannot coordinate a second-row write; the Edge must.
5. **SELECT-only makes the two aggregate surfaces honest-by-construction.** A `move_marks` row can exist **only** through the validated Edge — participant ✓, not-own ✓, code ✓, pair-consistent ✓. This is exactly what the un-game-like + anti-amplification doctrine needs from an aggregate: no client can fabricate a self-mark, a double-mark, or a mark on an invisible move.
6. **It matches the current default (4 SELECT-only instances)** so the reviewer's migration-bearing heightened review has a clean, tested template (`proofItemsRlsScan` / `timestampMarkersRlsScan`).

**Cost, acknowledged:** one Edge round-trip per tap vs a hypothetical direct-RLS INSERT. This is acceptable and the "high-frequency tiny writes" framing overstates it: a single viewer taps the ghost pair at most a few times per opponent move; it is not a like-button on a viral post (and anti-amplification doctrine forbids treating it as one). Optimistic UI hides the latency; a failed tap never blocks anything.

**Write client inside the Edge:** because `move_marks` is SELECT-only (no INSERT/UPDATE policy), the Edge writes with **service-role** (create-marker / attach-proof pattern), not the caller client (react-to-move could use the caller client only because `move_reactions` has an owner-INSERT policy). Reads (visibility no-oracle) + the participant RPC use the caller-scoped client. Audit rows use service-role.

---

## Data model — the migration SQL (verbatim)

New file: `supabase/migrations/20260712000001_feedback_001_move_marks.sql` (sequential after `20260711000002_mark_002_marker_reply_ref.sql`, the highest applied timestamp at build time). The implementer commits this file **byte-equal** to the fenced block below (the MARK-001/002 strict-diff discipline). Docker is unavailable this session, so this SQL is the textual-review artifact.

```sql
-- ============================================================
-- Migration: 20260712000001_feedback_001_move_marks
-- Card: FEEDBACK-001 (#898) — human boolean move-mark ledger (move_marks).
-- Epic: PRODUCT-REDIRECT-001 / Argument Surface Pivot (M-ASP-7, Phase P7).
-- Canonical spec: Design Pass Output 8 (move_marks) + Output 9 (Boolean MCP
--   feedback). Design: docs/designs/FEEDBACK-001.md.
--
-- Write posture: SELECT-only / Edge-only writes (the current house default —
--   PROOF-001 #888 proof_items + proof_relations, MARK-001 #893 timestamp_markers,
--   circles #859; four SELECT-only instances). ALL writes (mark, retract, and the
--   paired-code exclusivity retract) are performed by the FEEDBACK-001 mark-move
--   Edge Function (service-role). This migration ships NO authenticated write
--   policy, NO write-gate helper, NO write-guard trigger. Rationale is recorded in
--   the design "RLS-posture decision"; in brief: the not-own-move guard needs
--   arguments.author_id (react-to-move notes RLS lacks cheap access without a
--   join), the participant-only gate + the paired-code mutual-exclusivity retract
--   are application logic, and SELECT-only makes the two aggregate surfaces
--   honest-by-construction (a row exists ONLY via the validated Edge).
--
-- Sequential after 20260711000002_mark_002_marker_reply_ref.sql (highest applied
--   timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates ONE new, RLS-enabled, EMPTY table: move_marks (Output 9 "Collect —
--   explicit"). Adds ONE SELECT policy. ZERO existing rows touched; ZERO existing
--   objects dropped or edited. The table is empty until the mark-move Edge writes
--   it and the move_marks flag is ON, so behaviour for every existing room is
--   bit-for-bit unchanged.
--
-- ── Doctrine encoded by this migration ──────────────────────
--   - A mark is a structural observation about a MOVE, never a person
--     (cdiscourse-doctrine sections 1 and 10a). The five mark_code values describe
--     what a move did (did_not_address), never who posted it — the ban-list scan
--     asserts no verdict/person token in any code.
--   - Anti-amplification separation preserved (point-standing-economy skill /
--     antiAmplification.ts): move_marks is INERT storage. No point-standing /
--     engagement-credit / score column; no trigger that writes any standing. A
--     mark can feed the mediator projection and the heat model but NEVER factual
--     standing.
--   - Retract is a timestamp, never a delete (retracted_at); rows are never
--     hard-deleted. No DELETE policy.
--   - RLS ENABLED; nothing disabled. The SELECT policy reads cross-table state
--     ONLY through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (no raw cross-table subquery in the policy) —
--     the COV-004 / PROOF-001 anti-recursion pattern.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery — the
--     only cross-table read is the pre-applied helper is_argument_visible_in_circle.
--     Every column in the USING body is table-qualified (move_marks.*). No bare
--     same-name column (argument_id / debate_id) is referenced.
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id). mark_code CHECK is text-vs-text
--     literal. created_at / retracted_at are timestamptz. auth.uid() is uuid. No
--     text-vs-uuid, no int-vs-bigint.
--   Class 3 (statement order): CREATE TABLE -> ENABLE RLS -> indexes -> SELECT
--     policy. RLS is enabled before the policy is created. No DROP of any kind.
--   Class 4 (function/extension deps): gen_random_uuid() requires pgcrypto —
--     DOCUMENTED here (Supabase default; every prior migration relies on it), not
--     asserted with a create-extension statement (the #859 / PROOF-001 precedent).
--     is_argument_visible_in_circle is pre-applied (20260702000001, granted to
--     authenticated, wired live by 20260709000001) — referenced, never redefined.
--     auth.uid() from the Supabase auth schema (present by default). This migration
--     CREATES no new function and no new grant. No COMMENT ON ... ON storage.* (the
--     sole COMMENT target is public.move_marks, which the migration role owns).
-- ============================================================

create table if not exists public.move_marks (
  id           uuid        primary key default gen_random_uuid(),
  debate_id    uuid        not null references public.debates(id)   on delete cascade,
  argument_id  uuid        not null references public.arguments(id) on delete cascade,
  marked_by    uuid        not null references public.profiles(id)  on delete cascade,
  -- The five Output 9 human-boolean codes, verbatim. Each describes the MOVE,
  -- never the mover (ban-list asserted). Source of truth:
  -- src/features/feedback/moveMarksModel.ts ALL_MOVE_MARK_CODES.
  mark_code    text        not null
                 check (mark_code in (
                   'addressed_my_point',
                   'did_not_address',
                   'receipts_requested',
                   'good_receipt',
                   'off_the_point'
                 )),
  created_at   timestamptz not null default now(),
  -- NULL = active; set = retracted. Retract is a timestamp, never a delete.
  retracted_at timestamptz,

  -- One row per (argument, marker, code) forever. The mark-move Edge re-activates
  -- via upsert (ON CONFLICT DO UPDATE SET retracted_at = NULL); retract sets
  -- retracted_at. A durable two-state latch, not an event log — the FULL unique
  -- (not the point_tags partial-where-null form) is the spec choice (#898) and
  -- gives the Edge race-safe idempotency (the UNIQUE is the atomic guard, the
  -- playback_receipts idiom).
  constraint move_marks_one_per_marker_code unique (argument_id, marked_by, mark_code)
);

-- Partial indexes on ACTIVE marks — every reader filters retracted_at is null.
create index if not exists move_marks_argument_active_idx
  on public.move_marks (argument_id) where retracted_at is null;
create index if not exists move_marks_debate_active_idx
  on public.move_marks (debate_id)   where retracted_at is null;

alter table public.move_marks enable row level security;

-- ── move_marks SELECT — active + room-visible (canonical + #882 circle arm) ──
drop policy if exists move_marks_select_room_visible on public.move_marks;
create policy move_marks_select_room_visible
  on public.move_marks
  for select
  to authenticated
  using (
    move_marks.retracted_at is null
    and public.is_argument_visible_in_circle(move_marks.argument_id, auth.uid())
  );

-- move_marks INSERT / UPDATE / DELETE: no policy. SELECT-only posture — all writes
-- (mark upsert, retract, paired-code exclusivity retract) go through the
-- FEEDBACK-001 mark-move service-role Edge. PostgREST cannot insert, update, or
-- delete a move_marks row for an authenticated caller.

comment on table public.move_marks is
  'FEEDBACK-001 (#898): the human boolean move-mark ledger (Design Pass Output 9). One row per (argument, marker, code); mark_code is a structural observation about the MOVE, never the mover (ban-list clean). RLS enabled. SELECT-only posture (house default: PROOF-001 / MARK-001 / circles): SELECT active + room-visible via is_argument_visible_in_circle; ALL writes (mark / retract / paired-code exclusivity) are performed by the mark-move service-role Edge. Inert storage: NO point-standing / score / engagement column, no standing trigger — a mark feeds the mediator projection and heat, NEVER factual standing (anti-amplification). Retract = retracted_at timestamp; never hard-deleted.';
```

### Four-issue-class self-check (mandatory, migration-bearing)

Per `.claude/agents/roadmap-reviewer.md` § "Migration-bearing card verification". Docker is unavailable → heightened textual review; each class scanned, zero unresolved markers:

| # | Class | Result for this migration |
|---|---|---|
| 1 | Ambiguous column references in subqueries | **Clean.** The SELECT policy contains **no subquery**; the only cross-table read is the pre-applied SECURITY DEFINER helper `is_argument_visible_in_circle`. Every column in the USING body is `move_marks.`-qualified. No bare `argument_id`/`debate_id`. (Mirrors proof_items exactly.) |
| 2 | Column type mismatches | **Clean.** `debate_id`/`argument_id`/`marked_by` are `uuid` → `uuid` PKs (`debates.id`/`arguments.id`/`profiles.id`, house convention confirmed against PROOF-001 R2). `mark_code` CHECK is text↔text literal. `created_at`/`retracted_at` `timestamptz`. `auth.uid()` `uuid`. |
| 3 | Implicit ordering dependencies | **Clean.** Order: `CREATE TABLE` → `ENABLE RLS` → two `CREATE INDEX` → `CREATE POLICY`. RLS enabled before the policy; every referenced object exists first. **No DROP** of any column/table/policy/index. |
| 4 | Function / trigger / extension deps | **Clean.** `gen_random_uuid()` → pgcrypto documented (not asserted; #859/PROOF-001 precedent). `is_argument_visible_in_circle` pre-applied `20260702000001`, granted `authenticated`, wired live `20260709000001` — referenced, not redefined. `auth.uid()` from Supabase `auth` schema (default). No new function/grant. **No `COMMENT ON … ON storage.*`** — the only COMMENT targets `public.move_marks`. |

Reviewer's Verification cell: `heightened-review pass — Docker not available (Docker Desktop not running this session); classes 1–4 scanned with zero unresolved markers` — plus the Docker-lane option (`npx supabase db reset --linked=false`) if the reviewer's environment has it.

---

## API / interface contracts

### The `mark-move` Edge Function

New: `supabase/functions/mark-move/index.ts`. Follows the create-marker/react-to-move contract exactly. `verify_jwt = true` in config.toml + `getUser` defense-in-depth. Comments **apostrophe-free** (the `uxOneOneTwoDoctrine` quote-parity scanner gotcha). Never logs Authorization / service-role / any secret. Never touches `public.arguments`. Imports nothing from any `pointStanding` path.

**Request** (`.strict()` zod, one discriminated field `action`):

```ts
// action='mark'
{ action: 'mark',    debateId: uuid, argumentId: uuid, markCode: MoveMarkCode }
// action='retract'
{ action: 'retract', debateId: uuid, argumentId: uuid, markCode: MoveMarkCode }
```

`MoveMarkCode = 'addressed_my_point' | 'did_not_address' | 'receipts_requested' | 'good_receipt' | 'off_the_point'` (allow-list mirrors the CHECK + `ALL_MOVE_MARK_CODES`; an unknown code → `422 invalid_mark_code`).

**Guard ladder** (fail-closed, honest no-oracle codes via `fail(status, code, message)`):

1. CORS preflight / `POST`-only (`methodNotAllowed`).
2. Authorization header present (`unauthorized`).
3. JSON body parses (`badRequest('invalid_json')`).
4. `.strict()` schema (`validationFailed` / `422 invalid_mark_code`).
5. `getUser` → `callerId` (defense-in-depth; verify_jwt already true).
6. **Target visibility (caller-scoped, no-oracle):** `callerClient.from('arguments').select('id, author_id, debate_id, status').eq('id', argumentId).maybeSingle()`. Null → `404 argument_not_found`. `debate_id !== debateId` → `400 debate_argument_mismatch`. `status === 'deleted'` → `400 argument_deleted`.
7. **Own-move guard:** `argRow.author_id === callerId` → `403 cannot_mark_own_move`.
8. **Participant gate (the fist-bump lacks this):** `callerClient.rpc('is_debate_participant', { p_debate_id: debateId })` (p_user_id defaults to auth.uid()). Not `true` → `403 not_a_participant` ("Join this room to mark a move."). This is what disables observers server-side.
9. **Mutate (service-role — SELECT-only table):**
   - `action='mark'`:
     - If `markCode` is one of the mutually-exclusive pair (`addressed_my_point` / `did_not_address`), first retract the opposite active row:
       `svc.from('move_marks').update({ retracted_at: now }).eq('argument_id', argumentId).eq('marked_by', callerId).eq('mark_code', <opposite>).is('retracted_at', null)`.
     - Upsert the target code (idempotent re-activate):
       `svc.from('move_marks').upsert({ debate_id, argument_id, marked_by: callerId, mark_code: markCode, retracted_at: null }, { onConflict: 'argument_id,marked_by,mark_code' })`.
       A double-mark on an already-active row is a no-op success (**200**), satisfying J10's "one tap marks."
   - `action='retract'`:
     - `svc.from('move_marks').update({ retracted_at: now }).eq('argument_id', argumentId).eq('marked_by', callerId).eq('mark_code', markCode).is('retracted_at', null)`. No active row → no-op success (**200**), idempotent.
10. **Re-select the caller's active marks on this move (caller-scoped):** `callerClient.from('move_marks').select('mark_code').eq('argument_id', argumentId).eq('marked_by', callerId).is('retracted_at', null)`. Build the viewer state map.
11. **Audit (best-effort, service-role, never logged):** `admin_audit_events` insert `{ action: 'move_mark_set' | 'move_mark_retracted', source: 'edge_function', actor_user_id: callerId, target_user_id: argRow.author_id, payload: { debateIdShort, argumentIdShort, markCode } }`. Audit failure never blocks.

**Response** (deliberately minimal — no counts of others; the un-game-like point):

```ts
// 200
{ ok: true, argumentId,
  viewerMarks: { addressed_my_point: boolean, did_not_address: boolean,
                 receipts_requested: boolean, good_receipt: boolean, off_the_point: boolean } }
// errors: { error: '<code>', message: '<plain language>' }  (never the raw code in UI)
```

**Why no room-wide count in the per-move response** (contrast react-to-move which returns `fistBumpCount`): a per-move count returned per-tap invites a per-message counter. The two aggregate surfaces read from the room-shell bulk SELECT, not from this response. The Edge returns only the caller's own new state for optimistic reconciliation. This is a deliberate, stronger un-game-like posture than the fist-bump.

### config.toml registration (deploy-bearing, the #509 hazard)

Append to `supabase/config.toml` (after `[functions.create-marker]`):

```toml
# FEEDBACK-001 (#898) — mark-move. The SOLE server-authoritative writer for the
# SELECT-only move_marks table. verify_jwt = true; the function ALSO validates the
# JWT via createCallerClient + getUser (defense-in-depth) to resolve the caller id,
# then gates target-visibility (no-oracle) + own-move + participant BEFORE the
# service-role upsert/retract. A mark is a MOVE observation, never a verdict, never
# a score, and never feeds point standing. Registration here is what makes it
# auto-deploy on merge (the Supabase GitHub integration keys off the root
# [functions.*] blocks) — the #509 hazard.
[functions.mark-move]
verify_jwt = true
```

`__tests__/supabaseFunctionsConfigRegistration.test.ts` **auto-fails** the moment `supabase/functions/mark-move/index.ts` exists without this block (its "every function directory has a registration" assertion). The implementer adds both in the same commit and adds a dedicated `mark-move is registered with verify_jwt = true` assertion mirroring the create-marker one.

### Client wrappers

**Low-level** (`src/lib/edgeFunctions.ts`, mirroring the `reactToMove` idiom at L752 — idempotent, never throws, `{ ok, data } | { ok, error, status }`):

```ts
export type MoveMarkAction = 'mark' | 'retract';
export interface MarkMovePayload { action: MoveMarkAction; debateId: string; argumentId: string; markCode: MoveMarkCode; }
export interface MarkMoveSuccess { ok: true; argumentId: string; viewerMarks: Record<MoveMarkCode, boolean>; }
export type MarkMoveOutcome = { ok: true; data: MarkMoveSuccess } | { ok: false; error: { error: string; message?: string }; status: number };
export async function markMove(payload: MarkMovePayload): Promise<MarkMoveOutcome> // supabase.functions.invoke('mark-move', { body: payload })
```

**Narrow seam** (`src/features/feedback/moveMarksApi.ts`, mirroring `createMarkerApi.ts` — the single file that knows the wire shape; maps Edge error codes → plain language; never throws; a failed mark never blocks anything):

```ts
export async function setMoveMark(input: { debateId; argumentId; markCode }): Promise<{ ok; viewerMarks?; errorMessage? }>
export async function retractMoveMark(input: { debateId; argumentId; markCode }): Promise<{ ok; viewerMarks?; errorMessage? }>
```

### Pure model + aggregate (`src/features/feedback/`)

`moveMarksModel.ts` (pure TS, NO React/Supabase/network, mirrors `moveReactionModel.ts`; **must not import `pointStanding`** — source-scan enforced):

```ts
export type MoveMarkCode = 'addressed_my_point' | 'did_not_address' | 'receipts_requested' | 'good_receipt' | 'off_the_point';
export const ALL_MOVE_MARK_CODES: ReadonlyArray<MoveMarkCode>;            // frozen, length 5
export const MUTUALLY_EXCLUSIVE_PAIR: readonly ['addressed_my_point','did_not_address'];
export const oppositeOf = (c: MoveMarkCode): MoveMarkCode | null;         // pair only
export interface MoveMarkRow { argumentId: string; markCode: MoveMarkCode; markedBy: string; retractedAt: string | null; }
export interface ViewerMoveMarkState { [code in MoveMarkCode]: boolean }  // this viewer's active marks on ONE move
export function summarizeViewerMarks(rows: readonly MoveMarkRow[], argumentId: string, viewerId: string | null): ViewerMoveMarkState;
```

`moveMarkAggregateModel.ts` (the ONE derivation both aggregate surfaces consume — pure TS):

```ts
export interface MoveMarkAggregate {
  // did_not_address chains weight the mediator "what remains unresolved".
  unaddressedMoveIds: readonly string[];
  // 2x receipts_requested on one claim -> proof-prompt nudge (Output 9).
  receiptsRequestedByArgumentId: Readonly<Record<string, number>>;
  offThePointMoveIds: readonly string[];
}
export function deriveMoveMarkAggregate(activeRows: readonly MoveMarkRow[]): MoveMarkAggregate; // active rows only; never a score
```

---

## Design decisions

1. **RLS posture = SELECT-only + service-role Edge** (see the dedicated section). Verdict + full justification above.
2. **Full `UNIQUE(argument_id, marked_by, mark_code)` + `retracted_at` latch** (per the #898 spec), NOT the point_tags partial-`where retracted_at is null` + new-row-on-remark form. A mark is a two-state latch, not an event log; the durable single row + upsert re-activate gives the Edge race-safe idempotency (the UNIQUE is the atomic guard). Documented divergence from precedent; justified.
3. **Edge writes with service-role; reads + participant check with the caller client.** Forced by the SELECT-only table (no owner-INSERT policy to lean on). Audit via service-role.
4. **Paired-code mutual exclusivity in the Edge** (marking one of `addressed_my_point`/`did_not_address` retracts the other). The other three codes are independent toggles. Keeps the aggregate from ever counting a viewer in both arms.
5. **Per-move Edge response returns only the viewer's own state, no counts.** Stronger un-game-like posture than the fist-bump; the aggregate reads from the bulk room SELECT.
6. **This card's bar mounts only the pair + contextual `receipts_requested`.** The CHECK/allow-list carries all five codes so future surfaces reuse the same Edge, but `good_receipt` (a tap on a ProofChip, behind `proof_drawer`) and `off_the_point` (participant off-topic → branch nudge) have **no UI entry point in this card** — see Out of scope.
7. **Bar mounts by re-using the same component in both lenses** (RingsideCard + MapNodeActionPopover) wired to the same `useMoveMarks` handlers → capability parity by construction, no new `RailActionCode` (avoids `ROOM_RAIL_ACTION_CODES` typecheck churn).
8. **Aggregates consumed from ONE derivation** (`deriveMoveMarkAggregate`) in `ArgumentRoom` (the single reconciliation point): surface #1 folds an additive contribution into the state-rail inputs `ArgumentRoom` already computes; surface #2 passes a marks-derived legend line to `DisagreementPointsRail`. No new per-message counter, no leaderboard.
9. **Read path** = the room shell adds a bulk active-`move_marks` SELECT for the room (the point_tags "room-shell loader does a read-only SELECT" documented exception), behind the `move_marks` flag. Flag OFF → no fetch, no rows, byte-identical.

---

## Pin inventory (must stay zero-diff)

Verified against the ROOM-002/ROOM-004/MARK-002/PROOF pins recorded in `docs/core/current-status.md`. These files must NOT change (a source-scan / structural-equality gate pins them):

- `supabase/functions/submit-argument/index.ts` — never touched.
- `src/domain/constitution/engine.ts` — never touched.
- `src/features/pointStanding/antiAmplification.ts` and every `pointStanding/*` — never imported by any new file (source-scan asserts it).
- `src/features/arguments/ArgumentComposer*`, `ArgumentComposerDock.tsx`, `oneBox/*` — uxOneOneFive pins.
- `src/features/arguments/ArgumentTimelineMap.tsx`, `TimelineSelectedReadoutPanel.tsx` — ROOM-004 pins.
- `src/features/arguments/room/argumentStateRailModel.ts` — **kept zero-diff**; the marks contribution folds into the `openPointCount` memo in `ArgumentRoom` (decision 8), not into the rail model.
- `src/features/mediator/deriveMediatorBoardState.ts` — kept zero-diff (the marks legend line is passed additively to `DisagreementPointsRail`, not folded into the board deriver — keeps the core mediator derivation untouched; operator-review note below).
- `src/lib/featureFlags.ts` — zero-diff (`isMoveMarksEnabled` already shipped).
- `App.tsx` `handleSubmitSuccess` COMPOSER-002 pin, `ExchangeView` flag-off else-branch (byte-identical when OFF).

Flag-off byte-identity is proved by (a) a `JSON.stringify` structural-equality test on the RingsideCard view-model / rail inputs with the flag off vs the baseline, (b) a firing negative control, and (c) source-scan gates on `App.tsx` / `ArgumentRoom` (the marks memo + child mounts are all gated on `moveMarksEnabled`).

---

## File-by-file change list

**New files (~11):**
- `supabase/migrations/20260712000001_feedback_001_move_marks.sql` — the table + SELECT policy (SQL above). ~90 lines incl. header.
- `supabase/functions/mark-move/index.ts` — the Edge (guard ladder above). ~230 lines.
- `supabase/functions/_shared/moveMarkCodes.ts` — shared code allow-list + `MoveMarkCode` type (imported by the Edge and its jest test, the `markerCreate.ts` shared-contract pattern). ~30 lines.
- `src/features/feedback/moveMarksModel.ts` — pure model + viewer summary. ~90 lines.
- `src/features/feedback/moveMarkAggregateModel.ts` — the single aggregate derivation. ~70 lines.
- `src/features/feedback/moveMarksApi.ts` — narrow client seam + plain-language error map. ~90 lines.
- `src/features/feedback/moveMarksCopy.ts` — mark labels, a11y strings, error copy (gameCopy-owned; ban-list scanned). ~70 lines.
- `src/features/feedback/BooleanFeedbackBar.tsx` — the ghost pair component. ~180 lines.
- `src/features/feedback/useMoveMarks.ts` — the hook: optimistic set/retract via `moveMarksApi`, holds viewer state per move, exposes handlers to both lenses. ~120 lines.
- `src/features/feedback/index.ts` — barrel.
- Test files (see Test plan).

**Modified files (~7, all additive + flag-gated):**
- `supabase/config.toml` — add `[functions.mark-move]` block (+ ~10 lines).
- `src/lib/edgeFunctions.ts` — add `markMove` wrapper + types (~55 lines, additive after the react-to-move block).
- `App.tsx` — dedicated import line `import { isMoveMarksEnabled } from './src/lib/featureFlags';` (near L45) + `const moveMarksEnabled = isMoveMarksEnabled();` (near L599) + `moveMarksEnabled={moveMarksEnabled}` at the room mount (near L1304). (~3 lines.)
- `src/features/arguments/ArgumentTreeScreen.tsx` — relay `moveMarksEnabled` through the two mounts (prop declare/destructure/forward at L126/138/202 and L361/373/637). (~6 lines.)
- `src/features/arguments/room/ArgumentRoom.tsx` — the reconciliation point: accept the prop (L506/569); a bulk active-`move_marks` fetch hook + `deriveMoveMarkAggregate` memo (gated); thread `useMoveMarks` handlers into the Ringside feed memo (L1428-1452) and the Map surface memo (L1464-1490); fold the aggregate into the state-rail `openPointCount` memo (L932-935, flag-gated); pass the marks legend line to `DisagreementPointsRail` (L3241-3268). (~60 lines.)
- `src/features/arguments/room/RingsideCard.tsx` — render `<BooleanFeedbackBar>` in the active-card block (L250-257), gated `moveMarksEnabled && !card.isOwn && card.actionRow.kind === 'participant'`. (~10 lines.)
- `src/features/arguments/room/MapNodeActionPopover.tsx` — render `<BooleanFeedbackBar>` as a popover section after the action row (after L100), same gate + handlers. (~10 lines.)
- `src/features/mediator/DisagreementPointsRail.tsx` — optional additive `marksLegendLine?: string` prop rendered alongside the distribution legend (L846-871); absent → byte-identical. (~8 lines.)

---

## Component spec — `BooleanFeedbackBar`

Renders under the ACTIVE opponent move (RingsideCard) and inside the Map node popover. Pure presentation over `ViewerMoveMarkState` + `onMark(code)` / `onUnmark(code)` from `useMoveMarks`.

**Props:** `{ argumentId, viewerState: ViewerMoveMarkState, showReceiptsRequested?: boolean, disabled?: boolean, onMark, onUnmark, reduceMotion, testID }`.

**Behavior:**
- Two ghost buttons always: **"Answered my point"** (`addressed_my_point`), **"Didn't answer it"** (`did_not_address`). Optional third **"Receipts?"** (`receipts_requested`) when `showReceiptsRequested` (reuses the existing ask-preset semantics).
- Tap an unmarked button → `onMark(code)` (optimistic; the paired opposite visually clears — the Edge enforces it server-side too). Tap a marked button → `onUnmark(code)` (retract). One tap, no modal.
- **Never rendered on own moves** (parent gate `!card.isOwn`); **never rendered for observers** (parent gate `actionRow.kind === 'participant'`); belt-and-braces `disabled` prop renders the buttons inert with `accessibilityState.disabled` if a stale observer ever reaches it.
- Nothing here can block posting; a failed/rejected tap reverts the optimistic state and shows a quiet inline plain-language message (never the raw code).

**Accessibility (accessibility-targets skill):**
- Each button is a `Pressable`, `accessibilityRole="button"`, visual ~32px with `hitSlop={{ top:12,bottom:12,left:12,right:12 }}` → ≥44×44 effective target (the TimestampMarker 32px+hitSlop precedent).
- `accessibilityLabel` = the action name only ("Mark this move as: answered my point"); `accessibilityState={{ selected: viewerState[code], disabled }}` carries the **marked** state (so the toggle is legible to screen readers — not color).
- **Color-independent:** marked vs unmarked is carried by a filled-vs-outline glyph + a bold/weight change + a check affix, never color alone (grayscale-legible test). Tones are `STATUS.neutral` only — **no red/green verdict colors** (§9). A marked "Didn't answer it" is not red; a marked "Answered my point" is not green.
- **Reduce-motion:** the mark/unmark transition snaps (no scale/confetti) when `reduceMotion`; no animation is essential.
- **Tiny-width collapse:** below the narrow breakpoint the pair collapses to a single "···" overflow control that opens the two options in a compact inline row (per the component-spec `⌖ collapses to "···" on tiny widths`), each option still ≥44×44.
- No `announceForAccessibility` on every tap (chatty); the `accessibilityState.selected` flip is the signal.

---

## Map popover parity

The A×B capability-parity rule (Design Pass §6, ROOM-004): every capability reachable from either lens through the same handlers. Marks reach parity by mounting **the same `BooleanFeedbackBar`** inside `MapNodeActionPopover` (after the actor action row, before the "Answer this" / "Open details" affordances), wired to the **same `useMoveMarks` handlers** as the Ringside card, driven by the **same injected `viewerState`** (the ROOM-004 injected-derivation pattern). Same own-move + participant gates apply (the popover already mirrors RingsideCard's actor logic). Because the component + handlers are identical, parity is structural, not re-implemented.

A dedicated parity test (mirroring `roomCapabilityParityMatrix`'s negative-control shape) asserts: the mark capability (each of the pair + `receipts_requested`) is reachable in BOTH the Ringside active card and the Map popover for a participant on a non-own opponent move, and reachable in NEITHER for an observer or on an own move — with a firing negative control that stubs one lens to omit the bar and proves the guard fails. Marks are intentionally **not** added to `RailActionCode` / `ROOM_RAIL_ACTION_CODES` (they are a feedback channel, not a rail action), so the existing rail-action parity matrix is untouched.

---

## The two aggregate surfaces (consumed from ONE derivation)

Single derivation: `deriveMoveMarkAggregate(activeRows)` in `ArgumentRoom` (flag-gated memo). Both surfaces read its output; nothing else derives marks.

**Surface #1 — `ArgumentStateRail` (additive input, rail model zero-diff).** `ArgumentRoom` folds the aggregate into the `openPointCount` it already passes to `deriveArgumentStateRail` (the L932-935 memo, which is itself derived "from the already-derived mediator board"): `did_not_address` chains contribute to the ambient open-points reading, and `2× receipts_requested` on one claim contributes to the receipts-owed / proof-prompt reading (Output 9: "ProofButton goes gold on that move"). **No new marks-labeled chip** — that would be a per-message-counter-adjacent score. The rail expresses marks *through* the existing "3 open points · 1 owed" grammar, exactly the §9 example. Flag OFF → aggregate null → `openPointCount` unchanged → byte-identical.

**Surface #2 — Map legend (`DisagreementPointsRail`).** `ArgumentRoom` passes an additive `marksLegendLine` (e.g. "Moments marked unanswered feed what remains unresolved") derived from `aggregate.unaddressedMoveIds`, rendered alongside the distribution legend (L846-871). It is a room-level ambient line, never a per-node count and never a per-person tally. Flag OFF / prop absent → byte-identical.

Neither surface shows *who* marked, and neither shows a raw per-message mark count. (RLS exposes `marked_by` room-wide — the move_reactions precedent — but the UI is bound never to render another viewer's mark identity or a per-message counter; only the viewer's own state on the bar + the two ambient aggregates.)

---

## Copy plan (mark labels through choke points; ban-list)

All strings live in `moveMarksCopy.ts`, plain-language, routed so no raw code reaches the UI (`looksLikeInternalCode` suppression). Proposed labels:

| code | button label | a11y | notes |
|---|---|---|---|
| `addressed_my_point` | "Answered my point" | "Mark this move as: answered my point" | describes the MOVE's relation to the viewer's point |
| `did_not_address` | "Didn't answer it" | "Mark this move as: didn't answer my point" | describes the move, not the person; no red tone |
| `receipts_requested` | "Receipts?" | "Ask this move for receipts" | reuses the existing ask-preset copy |
| `good_receipt` | (no UI this card) | — | reserved; playful-safe when its ProofChip surface ships |
| `off_the_point` | (no UI this card) | — | reserved; participant off-topic → branch nudge later |

**Ban-list check** (`FORBIDDEN_TOKEN_TOKENS` = winner/loser/truth/liar/dishonest/bad faith/manipulative/extremist/propagandist, plus the doctrine §1 correct/true/false set): none of the codes or labels contain any banned token. "Answered my point" / "Didn't answer it" describe the **relationship between two moves** (did this reply address the point), never a truth verdict or a person label — the exact §9 doctrine ("codes describe the MOVE, never the mover"). A new copy-ban-list test (`__tests__/feedbackMoveMarksCopyBanList.test.ts`) scans every code + every rendered string with a firing negative control, mirroring `markerCopyBanList` / `qol041-doctrine`.

---

## Edge cases

- **Double-mark (same code, already active):** Edge upsert is a no-op → 200; UI stays marked (J10 "one tap marks").
- **Retract with no active row:** Edge update matches nothing → 200; UI stays unmarked (idempotent).
- **Paired flip:** marking `addressed_my_point` while `did_not_address` is active → Edge retracts the opposite atomically; UI clears the opposite optimistically.
- **Own move:** parent gate hides the bar; Edge Guard 7 returns `403 cannot_mark_own_move` if reached directly.
- **Observer:** parent gate hides/disables the bar; Edge Guard 8 (`is_debate_participant`) returns `403 not_a_participant` if reached directly. (The gap react-to-move leaves open is closed here.)
- **Invisible / deleted / cross-room argument:** caller-scoped read → `404 argument_not_found` (no-oracle) / `400 argument_deleted` / `400 debate_argument_mismatch`.
- **Unknown / smuggled mark_code:** `.strict()` + allow-list → `422 invalid_mark_code`; the CHECK is the DB backstop.
- **Concurrent double-tap (race):** the `UNIQUE` + upsert `onConflict` is the atomic guard; both resolve to the same single active row.
- **Network failure on tap:** `markMove` never throws; the seam returns `{ ok:false, errorMessage }`; the hook reverts the optimistic state and shows a quiet inline note. Nothing blocks posting or reading.
- **Flag OFF:** no fetch, no bar, no aggregate, no rail/legend change — byte-identical.
- **Doctrine edge — "can a pile of `did_not_address` marks lower a claim's standing?":** No. Marks never touch `pointStanding`; `deriveMoveMarkAggregate` feeds only the mediator projection + heat inputs. Pinned by `feedbackMoveMarksNoStanding.test.ts` (source-scan: no `pointStanding` import; behavioral: aggregate output carries no score/delta field).
- **Doctrine edge — "does exposing `marked_by` create a downvote-the-person surface?":** RLS exposes it room-wide (fist-bump precedent), but the UI never renders another viewer's mark identity or a per-message count; only the viewer's own bar state + the two ambient aggregates. (Operator-review flag below.)

---

## Test plan

Pure-model + Edge-contract + RNTL + scan tests. Estimated **+10 suites / ~+165 tests** → target ≈ **982 suites / ~34,091 tests** (estimate; the implementer captures the exact `Test Suites/Tests` line with exit 0). Zero existing-test edits expected except the additive `mark-move` assertion in the registration suite.

- `__tests__/moveMarksMigrationScan.test.ts` — text-scan of the migration (Docker-less lane, the `timestampMarkersRlsScan` template): presence + sequential numbering; RLS-enabled/never-disabled; strictly-additive (only a CREATE TABLE + policy + indexes, no DROP/ALTER of existing objects); **SELECT-only proof** (exactly one `FOR SELECT` policy, zero INSERT/UPDATE/DELETE policy, no write-gate helper/trigger/grant); single-composition-point (`is_argument_visible_in_circle` only, no raw arguments/debates subquery); the five-code CHECK set exactly; full `UNIQUE(argument_id, marked_by, mark_code)`; `retracted_at` present, no hard-delete; Class-1 qualification, Class-4 helper-referenced-not-redefined; doctrine ban-list on code literals — **each safety scan paired with a firing NEGATIVE CONTROL**.
- `__tests__/markMoveEdgeFunction.test.ts` — Edge contract (the `applyManualTagEdgeFunction` / `create-marker` harness): happy path (mark → 200 viewerMarks), retract, idempotent double-mark, paired-flip retracts opposite, own-move `403 cannot_mark_own_move`, observer `403 not_a_participant`, invisible `404`, deleted `400`, mismatch `400`, unknown code `422`; source-scan asserts no `Authorization`/`SERVICE_ROLE` literal logged, no `pointStanding` import, never queries/writes `public.arguments`, apostrophe-free comments.
- `__tests__/supabaseFunctionsConfigRegistration.test.ts` — extend with the `mark-move is registered with verify_jwt = true` assertion (mirrors create-marker); the existing "every dir registered" test guards the rest.
- `__tests__/moveMarksModel.test.ts` — `summarizeViewerMarks`, `oppositeOf`, `ALL_MOVE_MARK_CODES` length 5, active-only filtering, totality/purity.
- `__tests__/moveMarkAggregateModel.test.ts` — `deriveMoveMarkAggregate` (did_not_address chains, 2× receipts_requested threshold, off-the-point set), active-only, determinism, **no score field in the output shape**.
- `__tests__/BooleanFeedbackBar.test.tsx` — RNTL actor matrix: participant-on-opponent renders the pair (+ contextual third when enabled); own move renders null; observer disabled/null; tap marks → `onMark`, re-tap → `onUnmark`; `accessibilityState.selected` reflects marked; 44×44 (visual+hitSlop); grayscale-legible (no color-only); reduce-motion snap; tiny-width "···" collapse; neutral tones (no red/green token in styles).
- `__tests__/moveMarksCapabilityParity.test.ts` — the mark capability reachable in BOTH Ringside active card and Map popover for a participant/non-own; reachable in NEITHER for observer/own; firing negative control.
- `__tests__/feedbackMoveMarksNoStanding.test.ts` — **the anti-amplification boundary pin**: source-scan that no `src/features/feedback/*` file value-imports `pointStanding`/`antiAmplification`/any standing helper (the `metadataForbiddenImports` template); behavioral assert that the aggregate + Edge response carry no `broadStandingDelta`/`narrowStandingDelta`/score/weight field.
- `__tests__/feedbackMoveMarksCopyBanList.test.ts` — ban-list scan on codes + labels + a11y strings + error copy, `looksLikeInternalCode` suppression, firing negative control.
- `__tests__/moveMarksFlagOff.test.ts` — flag-off byte-identity: `JSON.stringify` structural equality on the RingsideCard view-model + rail inputs with `moveMarksEnabled=false` vs baseline; App.tsx/ArgumentRoom source-scan gate pins; firing negative control (flag-on differs).
- `__tests__/moveMarksRoomAggregateWiring.test.ts` — J9/J10 wiring: aggregate folds into rail `openPointCount` only when ON; DisagreementPointsRail receives `marksLegendLine` only when ON; both absent when OFF.

---

## Dependencies (cards / docs / files)

- Assumes **ROOM-002 (Ringside) + ROOM-004 (Map parity)** shipped (they did, #885/#886/#887) — the bar mounts in `RingsideCard.tsx` and `MapNodeActionPopover.tsx`, both live behind `room_exchange_v2`.
- Assumes **ROOM-001 `ArgumentStateRail`** shipped (#876) — aggregate surface #1.
- Assumes the **`move_marks` feature flag** shipped (`isMoveMarksEnabled`, ASP-FLAGS-001 #873) — this card only consumes it.
- Reads the pre-applied `public.is_argument_visible_in_circle` helper (`20260702000001`, wired `20260709000001`) — the SELECT policy's sole cross-table read.
- Reads the pre-applied `public.is_debate_participant(debate_id, user_id)` helper — the Edge participant gate (create-marker Guard 7 usage).
- Mirrors the **`react-to-move` / `create-marker` / `attach-proof`** Edge + client-wrapper idioms.
- Interlocks with (but does not implement) the mediator projection + heat model that will *read* marks (Output 9 "What the signals unlock") — this card only writes/stores/aggregates; INTEL-001 does the dodge-chain derivations.

---

## Risks

- **Feedback fatigue (Design Pass P7 risk).** Two new buttons under every active opponent move could feel like graded homework. Mitigation is the rollout: the operator ships the ghost pair **at 10% first** and watches tap-through / civility-flag deltas before widening (see Rollout).
- **The anti-amplification boundary is the load-bearing risk.** If any future edit lets a mark count feed standing, the app becomes a popularity machine — the exact doctrine violation. **`__tests__/feedbackMoveMarksNoStanding.test.ts`** is the pin: no `feedback/*` file may import `pointStanding`, and neither the aggregate nor the Edge response may carry a score/delta field. A reviewer must treat a failure here as a Block, not a nit.
- **`marked_by` room-wide visibility.** RLS exposes the marker identity (fist-bump precedent). The design binds the UI to never surface it; if a later card renders "K people marked this," that re-introduces the leaderboard the doctrine bans. Flagged for operator review (below).
- **The full-UNIQUE divergence** from the point_tags partial-unique precedent could surprise a reviewer expecting oscillation history. Documented in the migration header + design decision 2; the upsert re-activate is the intended path.
- **Config.toml registration is deploy-bearing** (#509). Forgetting the block = the Edge silently never deploys and the bar's writes throw `network_error`. The registration scan test auto-catches it once the dir exists.
- **Existing tests that may need touching:** only `supabaseFunctionsConfigRegistration.test.ts` (additive assertion). No other existing test should change; if the RingsideCard/MapNodeActionPopover snapshot tests are structural, the flag-off branch must keep them byte-identical.

---

## Out of scope (explicit — reduces scope creep)

- **MCP Family K** (`mcp_family_k` flag, post-store voice provenance) — a separate PR-16 lane / MCP-K cards. This card ships only `move_marks` + the human bar.
- **`good_receipt` UI entry point** — it belongs on a `ProofChip` tap (behind `proof_drawer`); the code is reserved in the CHECK, no bar button here.
- **`off_the_point` participant off-topic → branch nudge** — a later nudge surface; code reserved, no entry point here.
- **Mediator/heat consumption of marks** (dodge-chain weighting, contradiction-candidate surfacing) — INTEL-001 + the mediator board; this card only writes + provides the aggregate.
- **Folding marks into `deriveMediatorBoardState`** — kept out to preserve the core mediator derivation zero-diff; the legend line is passed additively (operator-review option below).
- **Any per-message counter, star rating, agree/disagree tally on people, observer voting, mandatory survey, voice-affect boolean** — Output 9 "Do not collect"; explicitly not built.
- **Down-migration** — additive-only; rollback = flag off + a NEW forward drop migration (`drop table public.move_marks;`), never an edit to the applied file.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels):** the five codes + labels pass `FORBIDDEN_TOKEN_TOKENS` + the §1 set; a code describes the MOVE ("did_not_address"), never the person — ban-list test enforces it. ✓
- **cdiscourse-doctrine §1 (score never blocks posting):** the bar is optional, reversible, and cannot gate a post; a failed tap never blocks. ✓
- **cdiscourse-doctrine §3 + point-standing-economy (popularity ≠ evidence; engagement ≠ standing):** `move_marks` is inert storage, no score column, no standing trigger; `feedback/*` imports no `pointStanding`; marks feed mediator/heat only. Pinned by `feedbackMoveMarksNoStanding.test.ts`. ✓
- **cdiscourse-doctrine §2 (heat = activity):** marks feed heat as activity/dodge-signal inputs, never as consensus/truth. ✓
- **cdiscourse-doctrine §4/§7 (no AI in prod, no authoritative flags):** the Edge makes no AI call; a mark is a human tap, advisory. ✓
- **cdiscourse-doctrine §6 (secrets):** no service-role/secret in client; service-role only in the Deno Edge; `grep SERVICE_ROLE|ANTHROPIC_API_KEY app/ src/` stays zero. ✓
- **cdiscourse-doctrine §8 (Supabase conventions):** RLS on, migration append-only + sequential, no existing migration edited, retract = soft (retracted_at), no hard delete, no direct client write to `move_marks`. ✓
- **cdiscourse-doctrine §9/§10a (plain language; observation vs allegation):** all codes mapped to plain language; `looksLikeInternalCode` suppression; a user-applied mark is an Allegation-class human tag surfaced only as the viewer's own state + ambient aggregate, never rendered as an accusation on the target's node. ✓
- **cdiscourse-doctrine §10 (v1 scope):** no voting/scoring winner, no push, no search, no OAuth-new, no public API. The five-code CHECK + full-UNIQUE make the table structurally incapable of becoming a vote tally (the move_reactions single-value precedent, generalized). ✓
- **supabase-edge-contract:** standard Edge shape (auth → caller-scoped reads → narrow service-role write → audit → safe response), config.toml-registered, no service-role response leak. ✓
- **accessibility-targets:** 44×44 (32px+hitSlop), role/label/state incl. marked-state, color-independent, reduce-motion parity, tiny-width collapse. ✓
- **§9 un-game-like:** neutral STATUS tones (no red/green), no confetti/streak/XP, aggregates in exactly two ambient places, no per-message counter, no leaderboard, machine families stay invisible. ✓

---

## Operator steps (deploy-bearing + migration-bearing)

Both auto-apply/auto-deploy on merge (the Supabase GitHub integration keys off the migration files + the config.toml `[functions.*]` block). The flag stays OFF, so merging changes no live surface.

1. **After merge — verify the migration applied** (linked DB):
   `select to_regclass('public.move_marks');` (non-null) and
   `select polname, cmd from pg_policies where tablename = 'move_marks';` (expect exactly ONE row, `SELECT`, roles `{authenticated}`; zero INSERT/UPDATE/DELETE).
2. **After merge — verify the Edge deployed:**
   `npx supabase functions list --linked` (expect `mark-move`) + an unauthenticated `401` probe against the deployed function.
3. **10% rollout (Design Pass P7 risk — feedback-fatigue watch):** ship the ghost pair to **10% first**. Set `EXPO_PUBLIC_MOVE_MARKS=true` for the 10% cohort (the ASP flag env mechanism), publish via the deliberate netlify-prod push (strict FF push + poll the deployed bundle hash), and watch tap-through + civility-flag deltas before widening. Do NOT flip `move_marks` to 100% in this card.
4. **Rollback:** flag off (immediate) + revert; the migration is additive (a NEW forward `drop table public.move_marks;` migration if the table must go, never an edit to the applied file).

**Nothing is applied/deployed by Claude in this card** — the implementer writes the migration + Edge + UI; the operator merges (auto-apply/deploy) and runs the 10% rollout.

---

## Slices (implementer commit plan)

1. **Migration + scan** — `20260712000001_feedback_001_move_marks.sql` + `moveMarksMigrationScan.test.ts` (Docker-less lane). Green + four-class self-check.
2. **Edge + wrappers** — `mark-move/index.ts` + `_shared/moveMarkCodes.ts` + config.toml block + registration assertion + `markMove` (edgeFunctions.ts) + `moveMarksApi.ts` + `markMoveEdgeFunction.test.ts`. Green.
3. **Model + bar + popover + aggregates + flag** — `moveMarksModel.ts` / `moveMarkAggregateModel.ts` / `moveMarksCopy.ts` / `BooleanFeedbackBar.tsx` / `useMoveMarks.ts`; mount in RingsideCard + MapNodeActionPopover; wire aggregate into rail + DisagreementPointsRail; App.tsx/ArgumentTreeScreen/ArgumentRoom flag thread; all UI/model/parity/no-standing/copy/flag-off tests. Green; `web:build` clean; flag-off byte-identity proved.
4. **Status** — update `docs/core/current-status.md` H2 with the captured test count (exit 0) and the J10 acceptance note; confirm the H2 count matches this card's review count.
