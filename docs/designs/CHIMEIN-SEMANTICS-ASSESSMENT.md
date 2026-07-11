# CHIMEIN-SEMANTICS-ASSESSMENT — point-scoped public-only chime-in contribution

**Status:** Operator-review gate (#761 leading slice). This doc must be **operator-reviewed BEFORE any mutation.**
**Epic:** civildiscourse-v4 / Argument Surface Pivot (M-ASP-8)
**Issue:** [#761](https://github.com/kyleruff1/cDiscourse/issues/761) — Chime-in contribution activation (GATE-C backend)
**Companion:** `docs/designs/P8-CHIMEIN-ARC.md` (the two-round design). This assessment is self-contained: an operator can make the Round-2 go/no-go decision from this doc alone.

---

## 1. What this decides, and why it is gated

#761 activates the chime-in **contribution** path: a bounded, point-scoped, **public-only** third-voice contribution that attaches to a point **without becoming a third principal voice and without setting a node's structural state.** The display model + dormant state already shipped (#737/#738); this turns on the contribution semantics, which require **persisted storage + RLS + an Edge/data path** — GATE-C. Per #761's own framing, the order is mandatory:

> **semantics-assessment authored + operator-reviewed → migration written-not-applied → operator green-lights → apply.**

Because merging to `main` auto-applies migrations and auto-deploys registered Edge Functions, **"written-not-applied" means the implementation branch stays UNMERGED until you (the operator) merge it.** Merging IS applying. This doc is the thing you review first.

---

## 2. The semantics in one page (what a "chime-in" actually is)

- A chime-in is a **role + attached treatment**, never itself the state (CIVILDISCOURSE-V4 L849/L855). Today, `chime_in` is a **derived read-time role** (`publicSeatModel.SeatRole='chime_in'`) — any non-principal who posts a qualifying argument in a public room is *derived* into a chime seat (seats 3-5, capacity 3). There is **no way to deliberately chime in on a specific point** as a bounded contribution distinct from "just reply." That deliberate, point-scoped contribution is the new thing.
- The chime **content** is an ordinary argument that goes through the **byte-identical `submit-argument` deterministic gate** — chime-ins never bypass it, never get a weaker gate, and the classifiers stay advisory + post-storage.
- What is genuinely new data (that the current derivation cannot infer): **"this reply is a bounded chime-in attached to point X"** vs "this is an ordinary reply." That single fact is what Round 2 persists.
- **Public-only.** Private rooms have no chime-ins — a hard guard at the Edge (and the already-shipped client `chimeInAllowed` predicate hides the affordance).
- **Never a third principal voice; never node structural state.** Enforced as properties (see §6).

---

## 3. Data model options (weighed honestly)

Three candidate shapes. The task named all three; each is assessed against the #761 non-negotiables (public-only + cap + author-scope + point-scope, all **server-enforceable**; principal-count + node-state invariants; `submit-argument` byte-preserved).

### Option A — a `chime_in_contributions` marker table keyed to the argument row  ✅ RECOMMENDED
The chime content is an ordinary argument via `submit-argument`; a separate SELECT-only table marks it: `(id, debate_id, argument_id, target_argument_id, author_id, seat_index, created_at, retracted_at)`. Writes via a small new service-role Edge.

- **Pro:** `submit-argument` stays byte-identical (content through the sole gate). The marker is **inert post-storage metadata** — exactly the shipped house precedent (`move_marks` #898, `proof_items` #888, `timestamp_markers` #893: one RLS-enabled table, SELECT-only, service-role Edge writes). Point-scoping is explicit (`target_argument_id`). Cap + public-only + author-scope enforced server-side in the Edge; the partial UNIQUE is the atomic race guard. **Preserves GAME-005's "the seat map is DERIVED, not persisted" philosophy** — the seat *map* stays derived; only the new "this is a deliberate chime on point X" fact is stored.
- **Con:** two writes (argument insert, then marker). If the client dies between them the reply degrades to an ordinary reply (no marker) — **not corrupt, just un-marked.** Acceptable; the attach step is idempotent and retryable.

### Option B — a persisted `chime_in_seats` table + argument linkage
A seat-claim table (`seat_index`, `holder_id`, `claimed_at`, `released_at`); a chime-in claims a seat, then posts under it.

- **Pro:** models "seats" literally (matches R3 "3 seats open").
- **Con:** **contradicts the shipped derivation philosophy** — GAME-005 deliberately keeps `chime_in` a derived role ("never written to `debate_participants.side`"; "the seat map is DERIVED, not persisted"). A persisted seat table creates a **second source of truth** (persisted seats vs the derived seat map) that can drift. It adds a **two-phase claim→hold→release lifecycle** the submission flow does not have, more race surface (claim vs post), and a "seat" concept that collides with the respondent principal seat. Heavier for no semantic gain over A.

### Option C — chime metadata rides `client_validation` (the quote/callback precedent)
No new table; the chime flag + target ride the existing advisory `client_validation` JSON on the argument row.

- **Pro:** zero migration, zero Edge, zero new table.
- **Con — disqualifying:** `client_validation` is **advisory, client-supplied, and untrusted** (`submit-argument/index.ts:344` "It is advisory metadata only"). The #761 non-negotiables — **cap, public-only, author-scope** — are security-bearing and must be **server-enforced**; a client could set/omit the flag to bypass the cap. A JSON blob is also not cleanly queryable for "count active chime-ins on this point." Option C **cannot satisfy** "capped, author-scoped, public-only … never increment principal count." Rejected for the load-bearing semantics. (It could at most carry a display *hint*, but the enforcement still needs a real table + Edge — so it collapses into A anyway.)

**Recommendation: Option A.** It is the only option that (1) enforces the cap/public-only/author/point-scope server-side, (2) keeps `submit-argument` byte-identical, and (3) matches the reigning house precedent while preserving the "derived, not persisted" seat philosophy.

---

## 4. The cap — value and scope

- **Value: 3.** GAME-005 ships `PUBLIC_ROOM_SEAT_CAP (5) − PRIMARY_SEAT_COUNT (2) = 3` chime seats, reconciled from an earlier 6→5 and pinned by a parity test. Round 2 **imports** those constants (one source of truth) rather than re-literal'ing 3. **(OD-2: confirm 3 is the v4 number.)**
- **Scope: room-level (recommended), with the point as the *scoping* dimension.** R3 says "3 seats open" (a room reading); R7 says "attaches to this point" (a point reading). These are reconcilable: keep **3 room-level active chime seats** as the capacity primitive (one source of truth with GAME-005), and let `target_argument_id` record *which point* each chime attaches to. A chime-in thus occupies one of 3 room seats **and** is scoped to a point. The alternative — 3 chime-ins **per point** — multiplies capacity by the number of points and diverges from GAME-005's room-level seat map. **This is a genuine product call → surfaced as OD-6 below.** The recommendation drives the UNIQUE key: room-scope `(debate_id, seat_index)` vs point-scope `(target_argument_id, seat_index)`.
- **Enforcement mechanic (race-safe):** a **partial UNIQUE on active `(debate_id, seat_index)`** — the `move_marks` UNIQUE-as-atomic-guard idiom. The Edge computes the lowest free `seat_index` in 1..3 and inserts; two concurrent inserts that pick the same index → the second fails the UNIQUE, the Edge retries once against the recomputed free index, else returns `seats_full`. No advisory lock. Client-side cap displays are **advisory only**; the DB UNIQUE + the Edge are the authority.

---

## 5. Enforcement layers — public-only, private-guard, RLS posture

Two enforcement planes, both required (defense in depth):

- **Edge (write authority):** the `chime-in` Edge rejects a private-room attach (`debate.visibility !== 'public'` → 409 `room_private`), rejects a non-author (403), rejects a non-point-scoped attach (parent mismatch → 409), and enforces the cap (409 `seats_full`). Public-only lives here because the DB CHECK cannot read `debates.visibility` cheaply without a join — the same reason `move_marks` keeps its participant gate in application logic.
- **RLS (read authority) — SELECT-only, house default:** the table has **one SELECT policy** (`to authenticated`, active + room-visible via the pre-applied `is_argument_visible_in_circle` SECURITY DEFINER STABLE helper — the COV-004 / PROOF-001 / move_marks anti-recursion pattern) and **NO INSERT/UPDATE/DELETE policy.** PostgREST therefore cannot write a chime row for an authenticated caller; every row exists **only** via the validated Edge (honest-by-construction). Retract is `retracted_at` (a timestamp), never a delete — no DELETE policy at all.
- **Client (advisory only):** the shipped `chimeInAllowed(roomType)` predicate hides the affordance in private rooms; the `chime_in` flag gates the composer. Neither is a security boundary — the Edge + RLS are.

---

## 6. The invariants as enforced properties

| Invariant | How it is enforced (not merely asserted in a test) |
|---|---|
| **Never increments the principal count / never a third principal voice** | The marker table has **no** principal-seat column and the Edge **never** writes `debate_participants.side` (its CHECK stays affirmative/negative/observer/moderator) nor `roomContract.primaryOpponentUserId`. `buildRoomContract` never reads the chime table, so a chime row cannot move the 2-principal count. A test asserts `buildRoomContract` output is identical with/without chime rows present. |
| **Never sets a node's structural state** | The table is **inert storage** — no state/standing/score/lifecycle column (the `move_marks` precedent). The argument's structural state (`argument_type`, `status`) is set **only** by `submit-argument`/the engine. The mediator `contributionKind='chime_in'` is a **display-subordination marker**, not a structural state. A test asserts no chime write path touches `arguments.argument_type`/`status`. |
| **Public-only** | Edge 409 on `visibility !== 'public'`; RLS SELECT room-visible; client `chimeInAllowed` guard. No chime row can exist for a private debate. |
| **Author-scoped** | Edge verifies `caller === arguments.author_id(argument_id)` before insert (caller-scoped read). |
| **Point-scoped** | Edge verifies `arguments.parent_id(argument_id) === target_argument_id`; the marker stores `target_argument_id`. |
| **Deterministic engine remains the sole gate** | Chime content flows through byte-identical `submit-argument`; the marker is post-storage and advisory to display only — it never blocks/re-gates/delays a post. A test asserts `submit-argument/index.ts` is byte-unchanged by this arc. |
| **Anti-amplification separation** | The table has no engagement/score/standing column and no standing trigger — a chime marker feeds display subordination + the seat count, **never** factual standing. |

---

## 7. The Edge path — new function, not an extension

**Recommendation: a NEW small service-role Edge Function `chime-in`** (two-step attach), NOT an extension of `submit-argument`.

- Rationale: `submit-argument` is byte-preserved (#761 non-negotiable "no change to the deterministic submission gate"). Extending it entangles the sole gate with chime semantics. A new function isolates the chime enforcement and mirrors the exact shipped precedent (`attach-proof` #890, `mark-move` #898, `create-marker` #894 — post the argument, then attach a marker via a small service-role Edge).
- **Registration is mandatory and load-bearing** (the #509 hazard): `supabase/config.toml` must gain `[functions.chime-in]`, or the Supabase GitHub integration silently never deploys the dir. Round 2 ships a jest **firing negative control** — a scan that turns RED if the block is removed.
- Contract, error shape, and internal order: see `P8-CHIMEIN-ARC.md §5.2`. The Edge never logs Authorization/service-role/JWT, never touches `debate_participants`, never inserts into `arguments`, never returns PII.

---

## 8. Rollout / kill-switch — the flag

**Recommendation: a new 11th feature flag `chime_in`, default OFF.**

- Merging Round 2 auto-applies the migration + auto-deploys the `chime-in` Edge, but the **UI stays dormant** until the operator flips `chime_in` — the same operator-controlled cohort-ramp posture as the shipped argument-surface flags (`proof_drawer` OFF pending back-fill; `move_marks` 10% cohort). The flag gates BOTH the composer (write trigger) and the rail/marker rendering (read).
- The flag is a **UI rollout control, not a security boundary.** With the flag OFF, the Edge + RLS still enforce public-only/cap/author-scope for any direct caller — correct separation (client flags/caps advisory; server enforces).
- Rejected alternative — **"dormant-model-activates-on-data"** (no flag; UI lights up the instant the migration lands + Edge deploys): elegant but removes the operator gate between "schema+Edge live" and "UI active," which the house pattern deliberately keeps. **(Confirm the flag name + OFF-by-default posture.)**

---

## 9. Migration SQL — VERBATIM (heightened-review requirement)

This is the exact file Round 2 ships as `supabase/migrations/20260713000001_chimein_001_chime_in_contributions.sql` (timestamp sequential after the highest applied `20260712000001_feedback_001_move_marks.sql`; adjust the date only if a later migration lands first). Review it against the OPS-001 four classes documented in its own header.

```sql
-- ============================================================
-- Migration: 20260713000001_chimein_001_chime_in_contributions
-- Card: CHIMEIN-P8 Round 2 (#761) — point-scoped public-only chime-in
--   contribution marker (chime_in_contributions).
-- Epic: civildiscourse-v4 / Argument Surface Pivot (M-ASP-8).
-- Design: docs/designs/P8-CHIMEIN-ARC.md + docs/designs/CHIMEIN-SEMANTICS-ASSESSMENT.md.
--
-- Write posture: SELECT-only / Edge-only writes (the house default — PROOF-001
--   #888 proof_items, MARK-001 #893 timestamp_markers, FEEDBACK-001 #898
--   move_marks). ALL writes (attach, retract) are performed by the chime-in
--   service-role Edge Function. This migration ships NO authenticated write
--   policy and NO write-gate trigger. Rationale (design "RLS-posture decision"):
--   public-only + cap + author-scope + point-scope are enforced in the Edge as
--   application logic (the DB CHECK cannot read debates.visibility cheaply — the
--   move_marks participant-gate-is-app-logic precedent); SELECT-only makes the
--   count surface honest-by-construction (a row exists ONLY via the validated Edge).
--
-- Sequential after 20260712000001_feedback_001_move_marks.sql (highest applied
--   timestamp at build time).
--
-- ── What this migration does (strictly additive) ────────────
--   Creates ONE new, RLS-enabled, EMPTY table: chime_in_contributions. Adds ONE
--   SELECT policy + partial UNIQUE guards. ZERO existing rows touched; ZERO
--   existing objects dropped or edited. The table is empty until the chime-in
--   Edge writes it and the chime_in flag is ON, so behaviour for every existing
--   room is bit-for-bit unchanged.
--
-- ── Doctrine encoded ────────────────────────────────────────
--   - A chime-in is a bounded point-scoped contribution ROLE + attached treatment,
--     NEVER a third principal voice and NEVER a node's structural state
--     (CIVILDISCOURSE-V4 L849/L855; cdiscourse-doctrine sections 1 and 10a). This
--     table stores ONLY the marker (which argument is a chime-in on which point);
--     it has NO principal-seat column, NO score/standing column, NO node-state
--     column. It never writes debate_participants.side (chime_in stays a derived
--     role there).
--   - Public-only: the Edge rejects a private-room insert; there is no chime row
--     for a private debate.
--   - Anti-amplification preserved (point-standing-economy / antiAmplification.ts):
--     inert storage. No engagement/score column, no standing trigger. A chime
--     marker feeds display subordination + the seat count, NEVER factual standing.
--   - Retract is a timestamp (retracted_at), never a delete. No DELETE policy.
--   - RLS ENABLED; nothing disabled. The SELECT policy reads cross-table
--     visibility ONLY through the pre-applied SECURITY DEFINER STABLE helper
--     is_argument_visible_in_circle (the COV-004 / PROOF-001 / move_marks
--     anti-recursion pattern) — no raw cross-table subquery in the policy.
--
-- ── OPS-001 four-class compliance (Docker-less heightened review) ──
--   Class 1 (ambiguous column): the SELECT policy body contains NO subquery — the
--     only cross-table read is the pre-applied helper is_argument_visible_in_circle.
--     Every column in the USING body is table-qualified (chime_in_contributions.*).
--   Class 2 (type mismatch): every FK column is uuid referencing a uuid PK
--     (debates.id / arguments.id / profiles.id). seat_index is smallint with a
--     CHECK 1..3. created_at / retracted_at are timestamptz. auth.uid() is uuid.
--   Class 3 (statement order): CREATE TABLE -> ENABLE RLS -> indexes/UNIQUE ->
--     SELECT policy. RLS enabled before the policy. No DROP of any kind.
--   Class 4 (function/extension deps): gen_random_uuid() requires pgcrypto
--     (Supabase default; every prior migration relies on it) — DOCUMENTED, not
--     asserted with a create-extension statement (the #859 / PROOF-001 precedent).
--     is_argument_visible_in_circle is pre-applied (20260702000001, granted to
--     authenticated, wired live by 20260709000001) — referenced, never redefined.
--     auth.uid() from the Supabase auth schema (present by default). CREATES no
--     new function and no new grant.
-- ============================================================

create table if not exists public.chime_in_contributions (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)   on delete cascade,
  -- The chime-in CONTENT: an ordinary argument posted through the byte-identical
  -- submit-argument deterministic gate. This table only MARKS it as a chime-in.
  argument_id         uuid        not null references public.arguments(id) on delete cascade,
  -- The POINT the chime-in attaches to (point-scoping). The Edge asserts it equals
  -- arguments.parent_id(argument_id).
  target_argument_id  uuid        not null references public.arguments(id) on delete cascade,
  author_id           uuid        not null references public.profiles(id)  on delete cascade,
  -- 1-based bounded chime seat index. CHECK 1..3 is the cap ceiling; the partial
  -- UNIQUE below is the atomic race guard. One source of truth with GAME-005 chime
  -- capacity (PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT = 3). OD-2 confirms the
  -- number; OD-6 confirms the scope (room-level UNIQUE key shown; a per-point cap
  -- would key the UNIQUE on target_argument_id instead).
  seat_index          smallint    not null check (seat_index between 1 and 3),
  created_at          timestamptz not null default now(),
  -- NULL = active; set = retracted. Retract is a timestamp, never a delete.
  retracted_at        timestamptz
);

-- Partial indexes on ACTIVE chime-ins — every reader filters retracted_at is null.
create index if not exists chime_in_contributions_debate_active_idx
  on public.chime_in_contributions (debate_id)          where retracted_at is null;
create index if not exists chime_in_contributions_target_active_idx
  on public.chime_in_contributions (target_argument_id) where retracted_at is null;
create index if not exists chime_in_contributions_argument_idx
  on public.chime_in_contributions (argument_id);

-- ATOMIC CAP GUARD (the move_marks UNIQUE idiom): at most one ACTIVE chime-in per
-- (debate, seat_index). The Edge computes the lowest free seat_index (1..3) and
-- inserts; two concurrent inserts that pick the same index -> the second fails the
-- UNIQUE and is retried/rejected as seats_full. Race-safe without an advisory lock.
-- (Room-scope per the OD-6 recommendation. A per-point cap keys on target_argument_id.)
create unique index if not exists chime_in_contributions_one_active_seat
  on public.chime_in_contributions (debate_id, seat_index)
  where retracted_at is null;

-- One active chime-in per argument — an argument is marked a chime-in at most once.
create unique index if not exists chime_in_contributions_one_active_per_argument
  on public.chime_in_contributions (argument_id)
  where retracted_at is null;

alter table public.chime_in_contributions enable row level security;

-- ── SELECT — active + room-visible (canonical + circle arm) ──
drop policy if exists chime_in_contributions_select_room_visible on public.chime_in_contributions;
create policy chime_in_contributions_select_room_visible
  on public.chime_in_contributions
  for select
  to authenticated
  using (
    chime_in_contributions.retracted_at is null
    and public.is_argument_visible_in_circle(chime_in_contributions.argument_id, auth.uid())
  );

-- chime_in_contributions INSERT / UPDATE / DELETE: no policy. SELECT-only posture —
-- all writes (attach, retract) go through the chime-in service-role Edge, which
-- enforces public-only + author-scope + point-scope + cap. PostgREST cannot
-- insert, update, or delete a chime_in_contributions row for an authenticated caller.

comment on table public.chime_in_contributions is
  'CHIMEIN-P8 Round 2 (#761): point-scoped public-only chime-in contribution marker. The chime CONTENT is an ordinary argument through the byte-identical submit-argument deterministic gate; this table only MARKS which argument is a bounded chime-in on which point (target_argument_id). RLS enabled. SELECT-only posture (house default: PROOF-001 / MARK-001 / move_marks): SELECT active + room-visible via is_argument_visible_in_circle; ALL writes via the chime-in service-role Edge (public-only + author-scope + point-scope + cap enforced there). seat_index CHECK 1..3 + partial UNIQUE (debate_id, seat_index) is the atomic cap guard. Inert storage: NO principal-seat / score / standing / node-state column, no trigger — a chime marker feeds display subordination + the seat count, NEVER a third principal voice, NEVER node structural state, NEVER factual standing (anti-amplification). Retract = retracted_at timestamp; never hard-deleted. Never writes debate_participants.side (chime_in stays a derived role there).';
```

---

## 10. Operator checklist

### 10.1 What to review before authorizing Round 2
- [ ] **Data model (OD-4):** approve **Option A** (marker table keyed to argument) — §3.
- [ ] **Cap value (OD-2):** confirm **3**.
- [ ] **Cap scope (OD-6, new):** confirm **room-level** (UNIQUE `(debate_id, seat_index)`) vs per-point (UNIQUE `(target_argument_id, seat_index)`) — §4.
- [ ] **Flag:** confirm **`chime_in`, default OFF**, operator-flipped cohort ramp — §8.
- [ ] **OD-1 (private observers):** confirm "keep shipped behavior for now" so the public-only chime path does not wait on it — §11.
- [ ] **Migration SQL:** review §9 verbatim against the OPS-001 four classes in its header.
- [ ] **Edge:** confirm a NEW `chime-in` function (not a `submit-argument` extension) + `config.toml` registration + firing negative control — §7.

### 10.2 What merging Round 2 will do automatically
Merging the held PR to `main` **auto-applies** `20260713000001_chimein_001_chime_in_contributions.sql` and **auto-deploys** the `config.toml`-registered `chime-in` Edge Function (Supabase GitHub integration). There is no separate "apply" step — **the merge is the apply.** Claude does not run `db push` / `functions deploy`.

### 10.3 Post-merge verification (operator)
- [ ] `npx supabase db status` (or the CLI query lane) shows `20260713000001_chimein_001_chime_in_contributions` applied.
- [ ] 401-probe the deployed `chime-in` (unauthenticated → 401; no key/JWT in logs).
- [ ] `chime_in` flag OFF smoke: no chime composer / no chime rail marker renders anywhere; existing rooms bit-for-bit unchanged.
- [ ] Flip `chime_in` ON for a cohort: attach on a public point → marker row appears → `open_chime_in_seat_count` decrements; a 4th attach → `seats_full`; a private room → no affordance and a direct Edge call → 409 `room_private`.

### 10.4 Rollback posture
- **Kill the UI instantly:** flip `chime_in` OFF (no deploy needed).
- **Neutralize data:** a forward `retracted_at` sweep on `chime_in_contributions` (via the Edge/service-role, never a client) — retract is the reversal, consistent with the never-hard-delete rule.
- **Do NOT rely on revert-merge:** a revert-merge does **not** un-apply an applied migration (memory: QOL-041 / known-blockers). The table stays; the flag + the retract sweep are the real rollback. A table drop, if ever truly needed, is a **new forward migration** the operator authorizes separately.

---

## 11. OD-1 — surfaced, not decided (operator question)

**OD-1: Do private rooms have observers?** The v4 design package (index L196) says **private rooms have no observers.** The shipped backend says observers are **uncapped and first-class in all rooms** including private (migration `20260613000001`; `roomAccessModel.private_member`). These conflict.

- **This is your decision — this assessment does not make it.**
- **Interaction with the chime path:** none directly. Chime-ins are **public-only**, so a private room has no chime regardless of the OD-1 ruling. The chime path is orthogonal.
- **Options:**
  - **(a) Keep shipped behavior** (private observers allowed). Recommended for now — the chime path proceeds unblocked.
  - **(b) Adopt the v4 rule** (no private observers). This is a **separate GATE-C backend change** (the trigger + RLS currently allow private observers) — file it as its own card; it is **not** part of Round 2 and Round 2 does not depend on it.

---

## 12. Open operator decisions (consolidated)

| OD | Question | Assessment recommendation | Blocks |
|---|---|---|---|
| OD-1 | Do private rooms have observers? | Keep shipped behavior for now (orthogonal to chime) | nothing in this arc |
| OD-2 | Chime-in capacity number | 3 (GAME-005, imported) | Round 2 CHECK / UNIQUE |
| OD-4 | Contribution persistence shape | Option A (marker table keyed to argument) | Round 2 migration |
| OD-6 (new) | Cap scope: room-level vs per-point | Room-level `(debate_id, seat_index)` | Round 2 UNIQUE key |
| flag | Rollout kill-switch | New `chime_in`, default OFF | Round 2 UI activation |

Ratify OD-2, OD-4, OD-6, and the flag before Round 2 is merged. OD-1 needs only a "keep shipped behavior" acknowledgement for this arc to proceed.
