# P8-CHIMEIN-ARC — 1:1-first chime-in arc (Round 1 pure model + Round 2 contribution activation)

**Status:** Design draft (two-round program). Design only — no production code in this card.
**Epic:** civildiscourse-v4 (Epic 16) / Argument Surface Pivot (M-ASP-8, Phase P8)
**Release:** Backlog — P0 (#680) / P1 (#761)
**Issues:** [#680](https://github.com/kyleruff1/cDiscourse/issues/680) (1:1-first room model + chime-in, M-ASP-8) · [#761](https://github.com/kyleruff1/cDiscourse/issues/761) (chime-in contribution activation, GATE-C backend)
**Companion doc (operator-facing):** `docs/designs/CHIMEIN-SEMANTICS-ASSESSMENT.md` — the semantics assessment #761 mandates. Read it before authorizing Round 2.

---

## 0. The deploy-model reality (encoded up front — it defines the split)

Merging to `main` **auto-applies migrations and auto-deploys `config.toml`-registered Edge Functions** via the Supabase GitHub integration (memory: "Supabase merge auto-deploy"). Therefore the #761 mandate "migration **written-not-applied** until green-light" translates precisely to:

> **The Round-2 branch stays UNMERGED until the operator green-lights it.** There is no other "written-not-applied" state — the moment Round 2 merges, the DB mutates and the Edge deploys. Nothing backend-mutating may live in Round 1.

Consequences that shape this whole design:
- **Round 1 is everything mergeable now with zero backend mutation** — the pure-model residue of #680, both design docs, and dormant-safe barrel wiring. Round 1 closes #680 on merge and is automerge-eligible once green.
- **Round 2 is everything that mutates the database, deploys an Edge Function, or flips UI from dormant to active** — the migration + RLS + the Edge/data path + the UI activation + the flag. Its PR is **opened then HELD** for the operator; the operator (not Claude) merges it after reviewing the semantics assessment, and merging is the apply/deploy.
- **Revert posture:** a revert-merge does NOT un-apply an applied migration (memory: known-blockers / QOL-041). Round 2's rollback is the flag (`chime_in` OFF) + a forward `retracted_at` sweep, never a table drop. This is spelled out in the assessment's operator checklist.

---

## 1. Goal (one paragraph)

CivilDiscourse is 1:1-first: every room is a structured 1:1 between two **principal voices**, with bounded, **point-scoped, public-only chime-ins** and uncapped observers. The display-state half of #680 already shipped (UX-ROOM-1V1-CHIMEIN-001A, #737/#738): a pure snapshot classifier (`oneToOneRoomModel.ts`), the `chimeInAllowed` public-only guard, the dormant chime states, and all the copy. This arc finishes the job in two rounds. **Round 1** builds the genuine #680 residue — the R1–R7 **transition** model (the shipped model classifies a *snapshot*; it does not model *transitions*, has no per-transition tests, and asserts neither the chime-never-increments-principal-count nor the chime-never-sets-node-state invariants that #680's acceptance requires). **Round 2** activates the chime-in **contribution** path (#761): a point-scoped, public-only, cap-3, author-scoped bounded contribution that rides the byte-identical `submit-argument` deterministic gate for its content and a new inert marker table for its "this is a chime-in on point X" semantics — never a third principal voice, never a node's structural state, never factual standing. Doctrine that shapes every decision: the deterministic engine stays the sole submission gate (chime classifiers advisory + post-storage); chime-ins are a role + attached treatment, never structural state (CIVILDISCOURSE-V4 L849/L855); private rooms have no chime-ins; no service-role in client; secrets never in repo/client; mark the point, not the person.

---

## 2. The #680-residue determination (what Round 1 actually builds — no re-implementation)

Precise audit of #680's acceptance against the shipped substrate, so Round 1 builds **only** the residue.

### 2.1 SHIPPED (#737/#738) — do NOT re-implement

| Shipped artifact | What it is | Evidence |
|---|---|---|
| `deriveRoomOneToOneDisplayState` | Pure **snapshot classifier**: derive one of 6 display states (+`unknown`) from a snapshot of already-derived inputs | `oneToOneRoomModel.ts:167-212` |
| 6 display states | `private_invited_access` / `public_respondent_seat_open` / `public_principal_voices_established` / `public_chime_in_available_dormant` / `public_chime_in_full_dormant` / `observer_reading` | `oneToOneRoomModel.ts:72-91` |
| `chimeInAllowed(roomType)` | Public-only guard (`=== 'public'`) — the private-no-chime **predicate** | `oneToOneRoomModel.ts:143-145` |
| `buildRoomOneToOneViewModel` / `buildOneToOneSeatLineViewModel` | Render-ready labels/subcopy; `chimeAffordanceVisible` **hardcoded false** ("GATE-C card flips ONE boolean") | `oneToOneRoomModel.ts:243-315` |
| Copy blocks | `ROOM_ONE_TO_ONE_COPY`, `POINT_SCOPED_CHIME_IN_COPY` (dormant) | `gameCopy.ts:1848-1935` |
| STATE tests (38) | first-open-public-seat classifies as `public_respondent_seat_open`, `.not.toContain('chime')`; private→invited-access; NaN→established; observer_reading; OD-1-safe copy | `__tests__/oneToOneRoomModel.test.ts` |

The shipped test **partially satisfies** #680 test-plan bullet 2 ("first open public seat resolves to respondent-principal, not chime-in") at the *state-classification* layer (`oneToOneRoomModel.test.ts:189-211`).

### 2.2 RESIDUE — NOT shipped; Round 1 builds exactly this

The shipped model is a **snapshot classifier** — it answers "given this snapshot, what state is the room in?" It is **not** a transition machine. It has no events, no R→R edges, no `principalVoiceCount`, and no per-transition tests. But #680's acceptance is explicit:

> Acceptance: "A pure model expresses the R1-R7 states **and transitions** with tests for each."
> Test plan: "Pure-model unit tests for **every R1-R7 transition** and the two guards"; "A test asserts chime-in **never sets node structural state and never increments principal count**."

None of the transition layer nor those two invariants is shipped. So Round 1 builds:

1. **The R1–R7 transition machine** — a new pure-TS file `oneToOneRoomLifecycle.ts` with an event-driven `applyRoomLifecycleEvent(state, event) → state`, projecting to the shipped `RoomOneToOneDisplayState` union (reuse, never re-derive).
2. **The two guards as transition guards:** private-no-chime (a chime event in a private lifecycle is a no-op — capacity 0), and seats-full-observe-only (a chime event when the bounded chime counter is full transitions to observe-only with the ledger readable).
3. **The three invariant tests in the transition frame:** (a) first-open-public-seat = respondent-principal; (b) **chime-never-increments-principal-count**; (c) **chime-never-sets-node-structural-state**.

The R1–R7 reference states (from #680 body, `CivilDiscourse v4.dc.html` L511-696) map to the machine as:

| Ref | Meaning | Lifecycle phase | Projects to display state |
|---|---|---|---|
| R1 | create / visibility chosen | `r1_created` | `public_respondent_seat_open` or `private_invited_access` |
| R2 | open respondent seat | `r2_respondent_seat_open` | `public_respondent_seat_open` |
| R3 | two principals; chime affordance opens ("3 seats open") | `r3_two_principals` | `public_principal_voices_established` / `public_chime_in_available_dormant` |
| R4 | a chime-in attaches (principals stay primary) | `r4_chime_in_attached` | `public_chime_in_available_dormant` |
| R5 | chime seats full → observe-only, ledger readable | `r5_chime_seats_full` | `public_chime_in_full_dormant` |
| R6 | private no-chime guard | `r6_private_invited` | `private_invited_access` |
| R7 | chime-in composer (point-scoped, "does not open a seat") | *affordance flag* on `r3`/`r4` (`chimeComposerAvailable`) | (composer copy dormant until Round 2) |

**Round 1 is a purely additive transition LAYER over the shipped snapshot LAYER.** It imports the display union + `chimeInAllowed` from `oneToOneRoomModel.ts` and projects back to it. It does not touch, rewrite, or duplicate the shipped classifier.

### 2.3 Explicitly NOT residue (stays out of Round 1)

- **The "Take the respondent seat" active CTA** — a seat-claim binding owned by **UX-ROOM-SEATLINE-001 (#681)**, not this arc. Confirmed: no such CTA copy exists in the tree today (only the passive `Respondent seat open` label), and 001A deferred it. Round 1 names the `r2` phase but wires no claim action.
- **`seatOpponent` "Opponent" relabel (OD-5)** — deferred by 001A; not reopened here.
- **Any chime contribution write path** — Round 2 (#761), operator-gated.

---

## 3. Data model

### 3.1 Round 1 — no new persisted data model (pure in-memory types only)

New pure TypeScript in `src/features/debates/oneToOneRoomLifecycle.ts`. No React, no Supabase, no clock, no randomness — mirrors `src/domain/constitution/engine.ts` discipline; JSON-serializable in/out; frozen outputs.

```ts
import type { RoomOneToOneDisplayState } from './oneToOneRoomModel';
import { chimeInAllowed } from './oneToOneRoomModel';

/** GAME-005 one source of truth — imported, never re-literal'd. */
// import { PUBLIC_ROOM_SEAT_CAP, PRIMARY_SEAT_COUNT } from './publicSeatModel';
// CHIME_IN_CAP_PUBLIC = PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT = 3

export type RoomLifecyclePhase =
  | 'r1_created'
  | 'r2_respondent_seat_open'
  | 'r3_two_principals'
  | 'r4_chime_in_attached'
  | 'r5_chime_seats_full'
  | 'r6_private_invited'
  | 'unknown';

export type RoomLifecycleEvent =
  | { kind: 'create'; visibility: 'public' | 'private' }
  | { kind: 'respondent_seat_taken' }
  | { kind: 'chime_in_attached' }   // bounded, capacity-aware
  | { kind: 'chime_in_retracted' }; // frees one chime seat

export interface RoomLifecycleState {
  phase: RoomLifecyclePhase;
  visibility: 'public' | 'private' | null;
  /** NEVER exceeds 2. A chime event NEVER changes this (enforced invariant). */
  principalVoiceCount: 0 | 1 | 2;
  /** 0..chimeInCap. */
  chimeInSeatsFilled: number;
  /** 3 for public, 0 for private (chimeInAllowed gate). */
  chimeInCap: number;
  /** true in r5 (seats full) and r6 (private) — the "observe-only, ledger readable" fact. */
  observeOnly: boolean;
  /** Whether the point-scoped chime composer MAY appear. Reuses chimeInAllowed + capacity;
   *  ALWAYS backed by a real seat; the actual control stays dormant until Round 2. */
  chimeComposerAvailable: boolean;
  /** Projection to the shipped snapshot union — reuse, never re-derive. */
  displayState: RoomOneToOneDisplayState;
}
```

**No node-state field exists anywhere in `RoomLifecycleState`.** That absence is the structural proof of the "chime never sets node structural state" invariant — the machine cannot mutate a node state it does not model.

### 3.2 Round 2 — one new inert marker table (full detail in the assessment)

`public.chime_in_contributions` — a SELECT-only, RLS-enabled sidecar keyed to the argument row. The chime **content** is an ordinary argument through byte-identical `submit-argument`; this table only **marks** which argument is a bounded chime-in on which point. It has **no** principal-seat column, **no** score/standing column, **no** node-state column (inert storage — the `move_marks` / `proof_items` / `timestamp_markers` precedent). **Verbatim migration SQL is in `CHIMEIN-SEMANTICS-ASSESSMENT.md §9.**

```sql
create table if not exists public.chime_in_contributions (
  id                  uuid        primary key default gen_random_uuid(),
  debate_id           uuid        not null references public.debates(id)   on delete cascade,
  argument_id         uuid        not null references public.arguments(id) on delete cascade, -- the chime content (via submit-argument)
  target_argument_id  uuid        not null references public.arguments(id) on delete cascade, -- the POINT it attaches to (point-scoping)
  author_id           uuid        not null references public.profiles(id)  on delete cascade,
  seat_index          smallint    not null check (seat_index between 1 and 3),               -- bounded chime seat; UNIQUE below is the atomic cap guard
  created_at          timestamptz not null default now(),
  retracted_at        timestamptz                                                            -- retract is a timestamp, never a delete
);
```

---

## 4. File changes

### 4.1 Round 1 (mergeable now — closes #680)

- **new** `src/features/debates/oneToOneRoomLifecycle.ts` — the pure R1–R7 transition machine (~180-230 lines incl. doc header + ban-list support). Imports the display union + `chimeInAllowed` from `oneToOneRoomModel`; imports `PUBLIC_ROOM_SEAT_CAP`/`PRIMARY_SEAT_COUNT` from `publicSeatModel` (one source of truth for cap 3). Exports `initialRoomLifecycleState`, `applyRoomLifecycleEvent`, `projectToDisplayState`, `ALL_ROOM_LIFECYCLE_PHASES`, `_forbiddenRoomLifecycleTokens`.
- **new** `__tests__/oneToOneRoomLifecycle.test.ts` — per-transition + guard + invariant tests (~55-70 tests; see §6.1).
- **modified** `src/features/debates/index.ts` — barrel re-export of the new model (~4 lines added). Dormant-safe: exported, no live consumer (mirrors the 001A "author now, wire later" shape the reviewer endorsed).
- **new** `docs/designs/P8-CHIMEIN-ARC.md` (this doc) + `docs/designs/CHIMEIN-SEMANTICS-ASSESSMENT.md`.
- **modified (only if the machine references a genuinely new dormant string)** `src/features/arguments/gameCopy.ts` — likely **none**: the machine reuses `ROOM_ONE_TO_ONE_COPY` + `POINT_SCOPED_CHIME_IN_COPY`. If a lifecycle needs a new label, it is authored dormant + ban-list scanned; default is zero new copy.

No `App.tsx`, no `src/` UI component, no `supabase/`, no migration, no Edge, no flag. **Pure model + tests + docs + one barrel line.**

### 4.2 Round 2 (built only after operator green-light; PR held unmerged)

- **new** `supabase/migrations/20260713000001_chimein_001_chime_in_contributions.sql` — the table + SELECT policy + atomic-cap UNIQUE + OPS-001 four-class header (~120 lines; verbatim in the assessment).
- **new** `supabase/functions/chime-in/index.ts` — the service-role Edge that attaches/retracts the marker with public-only + author-scope + point-scope + cap enforcement (~180-230 lines; contract in §5.2).
- **modified** `supabase/config.toml` — add `[functions.chime-in]` registration (the #509 hazard: an unregistered dir silently never deploys).
- **new** `src/features/debates/chimeInApi.ts` (or extend an existing api) — typed `attachChimeIn` / `retractChimeIn` client wrappers (caller-scoped `functions.invoke`; flag-gated).
- **new** `src/features/debates/chimeInContributionModel.ts` — a pure model deriving `openChimeInSeatCount` / `watchingCount` / per-point chime lists from the loaded `chime_in_contributions` rows, feeding the reserved `ArgumentStateRail` inputs and the mediator `contributionKind` adapter (~120 lines).
- **modified** `src/features/debates/oneToOneRoomModel.ts` — flip `chimeAffordanceVisible` from hardcoded `false` to a computed value gated on `chime_in` flag + `chimeInAllowed` + open capacity (the "flip ONE boolean" the shipped comment reserved at `:234`).
- **modified** room shell (`ArgumentRoom.tsx` / the composer surface) — the flag-gated "Chime in on this point" affordance that calls `attachChimeIn`; feed real `openChimeInSeatCount` / `watchingCount` into `ArgumentStateRail`; the mediator `DisagreementPointsRail` adapter fills `contributionKind='chime_in'` from the seat map.
- **modified** the feature-flag registry — add the 11th flag `chime_in` (default OFF).
- **new** `__tests__/chimeInContributionModel.test.ts`, `__tests__/chimeInEdge*.test.ts` (RLS-intent + registration scan), plus additions to the lifecycle/display tests for the activated path.

---

## 5. API / interface contracts

### 5.1 Round 1 — the transition machine (pure)

```ts
export function initialRoomLifecycleState(): RoomLifecycleState;              // phase 'unknown', counts 0
export function applyRoomLifecycleEvent(
  state: RoomLifecycleState,
  event: RoomLifecycleEvent,
): RoomLifecycleState;                                                        // pure, deterministic, frozen
export function projectToDisplayState(state: RoomLifecycleState): RoomOneToOneDisplayState;
```

Transition semantics (fixed decision order; frozen result):
- `create{public}` → `r2_respondent_seat_open`, `principalVoiceCount 1`, `chimeInCap 3`, `observeOnly false`, `chimeComposerAvailable false` (needs two principals first).
- `create{private}` → `r6_private_invited`, `chimeInCap 0`, `observeOnly true`, `chimeComposerAvailable false`. **All chime events are no-ops from here (private-no-chime guard).**
- `respondent_seat_taken` on `r2` → `r3_two_principals`, `principalVoiceCount 2`, `chimeComposerAvailable true` (public, capacity>0). On any other phase → no-op (idempotent).
- `chime_in_attached` on `r3`/`r4` when `chimeInSeatsFilled < chimeInCap` → `r4_chime_in_attached`, `chimeInSeatsFilled += 1`; when `chimeInSeatsFilled === chimeInCap` → `r5_chime_seats_full`, `observeOnly true`, **`chimeInSeatsFilled` and `principalVoiceCount` unchanged** (seats-full-observe-only guard). In a private lifecycle → no-op.
- `chime_in_retracted` → frees one seat (`chimeInSeatsFilled = max(0, −1)`); `r5`→`r4` when a seat frees.
- **Invariant, structurally enforced:** no branch of `applyRoomLifecycleEvent` ever writes `principalVoiceCount` on a chime event, and `RoomLifecycleState` has no node-state field to write.

### 5.2 Round 2 — the `chime-in` Edge Function (service-role; standard `supabase-edge-contract` shape)

```
POST /functions/v1/chime-in            Auth: Bearer <caller JWT>  (401 without)
Request:  { action: 'attach' | 'retract', argument_id: string, target_argument_id?: string, contribution_id?: string }
Response 200 (attach):  { ok: true, chime_in: { id, seat_index, target_argument_id }, open_chime_in_seat_count: number }
Response 200 (retract): { ok: true, open_chime_in_seat_count: number }
Errors (stable shape { error, message }):
  401 unauthorized        — no JWT
  400 invalid_input       — missing / malformed ids or action
  403 not_author          — caller did not author argument_id
  409 not_point_scoped    — arguments.parent_id(argument_id) !== target_argument_id
  409 room_private        — debate.visibility !== 'public'  (public-only guard)
  409 seats_full          — no free seat_index in 1..3 (atomic UNIQUE guard)
  404 not_found           — argument / debate absent or not room-visible to caller
```

Internal order (service-role writes only; caller-scoped reads for authz):
1. CORS preflight → 2. verify JWT (caller-scoped client), 401 if absent → 3. validate input → 4. caller-scoped read of `argument_id` (id, debate_id, parent_id, author_id) — RLS confirms visibility → 5. `caller === author_id` else 403 → 6. `parent_id === target_argument_id` else 409 → 7. `debate.visibility === 'public'` else 409 → 8. compute lowest free `seat_index` in 1..3; none → 409 → 9. **service-role insert** the marker (the partial UNIQUE is the atomic race guard; on UNIQUE violation, re-read + retry once, else 409 `seats_full`) → 10. return `open_chime_in_seat_count`.

**Never:** logs Authorization / service-role / JWT; touches `debate_participants`; inserts into `public.arguments`; returns another user's PII; blocks or re-gates the original post (the marker is post-storage, advisory to display only).

---

## 6. Test plan

Baseline at design time: **1025 suites / 34,890 tests** (HEAD `d47b73af`). Test count goes UP each round. No `.skip`/`.only`. **No new wall-clock `toBeLessThan(ms)` perf tests** (LIFE-001/META-001 flake under full-suite load; the pure machine is fast — assert behavior, not latency).

### 6.1 Round 1 — `__tests__/oneToOneRoomLifecycle.test.ts` (~55-70 tests)

- **Per-transition (one describe per R-edge):** `create{public}`→r2; `create{private}`→r6; r2 `respondent_seat_taken`→r3; r3 `chime_in_attached`→r4; r4 repeated attach up to cap; cap+1 attach→r5 (observe-only); r5 `chime_in_retracted`→r4; idempotent/no-op edges (attach on r2, seat-taken on r3).
- **Guard 1 — private-no-chime:** every chime event on an `r6_private_invited` state is a no-op; `chimeInCap === 0`; `chimeComposerAvailable === false`; reuses `chimeInAllowed('private') === false`.
- **Guard 2 — seats-full-observe-only:** at `chimeInSeatsFilled === chimeInCap`, `chime_in_attached` sets `observeOnly true`, does NOT increment the counter, keeps the ledger phase readable (`r5`).
- **Invariant A — first-open-public-seat = respondent-principal:** `projectToDisplayState(create{public})` is `public_respondent_seat_open`, `.not.toContain('chime')`; the open second seat is a principal seat, never a chime.
- **Invariant B — chime-never-increments-principal-count:** for every sequence of `chime_in_attached`/`chime_in_retracted`, `principalVoiceCount` is invariant (only `respondent_seat_taken` moves 1→2, and never above 2).
- **Invariant C — chime-never-sets-node-structural-state:** structural — a source-scan asserts `RoomLifecycleState` declares no node-state field and `applyRoomLifecycleEvent` contains no argument/node mutation token (`argument_type`, `status`, `node`); plus a property test that a chime event changes only `phase`/`chimeInSeatsFilled`/`observeOnly`/`displayState`.
- **Projection parity:** every `RoomLifecycleState.displayState` is a member of the shipped `RoomOneToOneDisplayState` union (reuse proof).
- **Purity/frozen:** no React/Supabase import (source-scan), frozen output, deterministic on repeat, `unknown` on nonsense input.
- **Ban-list:** `_forbiddenRoomLifecycleTokens` scan over any lifecycle-authored string (verdict/amplification/person/social-feed tokens); reuse the display-model avoid-list.

### 6.2 Round 2

- **Pure model** (`chimeInContributionModel.test.ts`): chime never increments principal count (buildRoomContract ignores chime rows), never sets node state, public-only classification, cap-enforced seat count, point-scoped grouping; `openChimeInSeatCount` degrades to full when 3 active.
- **RLS-intent** (documented; runnable against local Supabase when Docker is available, else heightened textual review per OPS-001): SELECT active + room-visible only; no INSERT/UPDATE/DELETE policy (PostgREST write refused for authenticated); retract sets `retracted_at` (no hard delete).
- **Edge** (`chimeInEdge*.test.ts`): happy attach, 401 no-JWT, 403 not-author, 409 room_private, 409 not_point_scoped, 409 seats_full (cap), retract frees a seat; asserts no `Authorization`/service-role literal is logged; asserts the Edge never writes `debate_participants` / never inserts `arguments`.
- **Registration firing negative control** (the #509 hazard): a jest scan asserts `config.toml` contains `[functions.chime-in]` — and the assertion is written so that REMOVING the block turns the test RED (fires, not silently passes).
- **Deterministic-gate invariant:** a test asserts `submit-argument/index.ts` is byte-unchanged by this arc (the chime path is a separate function; the engine remains the sole submission gate).
- **Post-merge verification (operator, not a jest test):** 401-probe on the deployed `chime-in`; `supabase db status` shows the migration applied; a flag-OFF smoke confirms no chime UI renders; a flag-ON cohort smoke confirms attach→marker→seat-count.

---

## 7. Dependencies (cards / docs / files)

- **Round 1 depends on nothing new** — it extends `oneToOneRoomModel.ts` (#737/#738, merged) and reuses `publicSeatModel.ts` (GAME-005) cap constants. Closes #680.
- **Round 2 depends on Round 1** (consumes the lifecycle machine's phases + the display model's `chimeAffordanceVisible` boolean) **and on the operator-reviewed `CHIMEIN-SEMANTICS-ASSESSMENT.md`** (#761's leading-slice gate: "semantics-assessment authored + operator-reviewed BEFORE any mutation").
- **Reads existing:** `submit-argument/index.ts` (byte-preserved deterministic gate); `publicSeatModel.buildPublicRoomSeatMap` (derived seat map — the chime marker feeds it, does not replace it); `is_argument_visible_in_circle` SQL helper (pre-applied `20260702000001`, wired `20260709000001` — the RLS anti-recursion helper); `mediator/DisagreementPointsRail.tsx:102` (dormant `contributionKind` slot — Round 2's Layer-C render target); `argumentStateRailModel.ts:89-91` (reserved `openChimeInSeatCount`/`watchingCount` inputs — Round 2 is their data source).
- **Blocks/feeds:** Round 2 is the "data source lands M-ASP-8" that #681's `ArgumentStateRail` reserved. It does NOT own the "Take the respondent seat" CTA (that is #681).

---

## 8. Risks

- **R2/seat-taking collision with the existing respondent flow.** The public respondent seat is already claimed today by the *first qualifying response* (`resolvePrimaryOpponent`, `roomContractModel.ts`), not by any chime mechanism. Round 2 must NOT introduce a competing seat-claim path — the chime marker attaches to an *already-posted* reply and never writes `primaryOpponentUserId`. A test asserts `buildRoomContract` is unaffected by chime rows. The "Take the respondent seat" active CTA stays with #681 (out of scope) to avoid two code paths claiming the same seat.
- **Cap races (concurrent chime-ins).** Two users attaching the 3rd/4th chime simultaneously must not both succeed. Mechanic: a **partial UNIQUE on active `(debate_id, seat_index)`** (the `move_marks` UNIQUE-as-atomic-guard idiom) — the DB rejects the second insert on the same index; the Edge retries once against the recomputed free index, else returns `seats_full`. No advisory lock needed.
- **The #681-reserved rail-slot contract.** `ArgumentStateRail` reserves `openChimeInSeatCount?` / `watchingCount?` as **inputs that currently render nothing** (there is no chip kind consuming them yet). Round 2 must supply real values into those exact input names (do not rename/reshape the contract) and add the chip-kind rendering as part of activation — a change to the input shape would silently break the reserved contract.
- **Deploy-model foot-gun.** If Round 2 is merged before the operator is ready, the migration applies and the Edge deploys immediately. Mitigation: the PR is HELD unmerged (operator merges), AND the `chime_in` flag ships OFF so even an accidental merge leaves the UI dormant (the Edge + RLS remain the security boundary regardless of the flag).
- **OD-1 interaction.** OD-1 (do private rooms have observers?) is unresolved. Chime-ins are public-only, so the chime path is orthogonal — but the assessment must surface OD-1 without deciding it, because a future "no private observers" ruling is a separate backend change the chime path does not depend on.
- **Migration is heightened-review (Docker-less).** No local `supabase db reset` in-session; the migration gets the OPS-001 four-class textual review (ambiguous column / type mismatch / statement order / function-extension deps) — the four-class block is written into the migration header verbatim.

---

## 9. Out of scope (reduces scope creep)

- The "Take the respondent seat" active claim CTA (owned by **#681 / UX-ROOM-SEATLINE-001**).
- `seatOpponent` "Opponent" relabel (OD-5, deferred by 001A).
- OD-1 backend change (private-observer policy) — surfaced, never built here.
- Any voting/scoring-winner, real-time body editing, OAuth, public API, push notifications, argument search (v1 scope guard). A chime-in is a bounded structured contribution, **not** a comment thread / social feed.
- Chime-in notification producer beyond reusing the existing `chime_in_posted` ENUM type if the operator authorizes it (assessment §7 lists it as a follow-up, not a Round-2 requirement).
- Persisting the GAME-005 governance reactions (`useChimeInGovernance` stays in-session) — a separate future card.

---

## 10. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the lifecycle machine and the marker emit only structural seat/participation facts; no verdict token; the chime path never gates a post — the deterministic engine stays the sole submission gate, chime classifiers advisory + post-storage. ✔
- **§2/§3 (heat/popularity not evidence):** chime seat order + count carry no heat/popularity input; the marker table has no engagement/score column; anti-amplification separation preserved (inert storage — a chime feeds display subordination + seat count, never factual standing). ✔
- **§4 (AI moderator limits):** nothing here gives AI authority over who may chime in; no client AI call. ✔
- **§5 (engine sacred):** no change to `src/domain/constitution/engine.ts`; `submit-argument` byte-preserved. ✔
- **§6/§7 (secrets / no client AI):** no service-role in client (Round 2 writes via the Edge); the Edge never logs Authorization/service-role/JWT; no secret in repo. ✔
- **§8 (Supabase conventions):** Round 2 migration is append-only, RLS-on, SELECT-only + service-role Edge writes, soft-retract via `retracted_at` (never hard delete). ✔
- **§9 (plain language):** every string routes through the ban-list-scanned copy blocks; no internal code leaks. ✔
- **§10a (Observations vs Allegations):** the chime marker is a machine-derived structural Observation (seat role), rendered subordinate, never an accusation; `contributionKind='chime_in'` is a display marker, not a person allegation. ✔
- **§10 (v1 scope):** no banned v1 feature; chime-in is bounded structured contribution, not a comment thread. ✔
- **point-standing-economy:** the marker never writes standing; anti-amplification interlock untouched (a chime earns no factual-standing delta by existing). ✔
- **supabase-edge-contract:** standard Edge shape, caller-scoped reads + narrowest-client writes, stable error shape, no PII echo. ✔

---

## 11. The Round-1 / Round-2 split line

> **Round 1 = every artifact that is pure-model, copy, or docs and mutates no backend** (the R1–R7 transition machine + both design docs + dormant-safe barrel export). It closes #680 and is automerge-eligible once green. **Round 2 = every artifact that mutates the database, deploys an Edge Function, or flips UI from dormant to active** (the `chime_in_contributions` migration + RLS + the `chime-in` Edge + the client wrapper + the UI activation + the `chime_in` flag). Because merging `main` auto-applies migrations and auto-deploys registered Edge Functions, Round 2's "written-not-applied" IS "the branch stays unmerged" — its PR is opened then HELD for the operator, who merges only after reviewing `CHIMEIN-SEMANTICS-ASSESSMENT.md`.

Anything that touches `supabase/`, a flag flip, or a live write path is Round 2 by definition. Anything else that #680 needs is Round 1.

---

## 12. Operator steps

- **Round 1:** None — pure code change. No migration, no Edge deploy, no env var, no dependency. Merges (or automerges) once green; closes #680.
- **Round 2 (only after reviewing the assessment):** the operator merges the held PR — that merge auto-applies `20260713000001_chimein_001_chime_in_contributions.sql` and auto-deploys the `chime-in` Edge Function. Then: verify `supabase db status` shows the migration applied; run a 401-probe on the deployed `chime-in`; keep `chime_in` flag OFF and smoke that no chime UI renders; flip `chime_in` ON for a cohort and smoke attach→marker→seat-count. **Rollback is the flag (OFF) + a forward `retracted_at` sweep — never a table drop (a revert-merge does not un-apply the migration).** Full checklist in `CHIMEIN-SEMANTICS-ASSESSMENT.md §10`.

---

## 13. Reconciliation points needing an orchestrator ruling

1. **Cap scope — per-room vs per-point** (the R3 "3 seats open" room reading vs the R7 "attaches to this point" point reading). Recommendation: keep GAME-005's **3 room-level active chime seats** as the capacity primitive (one source of truth), with `target_argument_id` providing point-scoping. Surface as **OD-6** (new). Ruling needed before Round 2's UNIQUE key is chosen (`(debate_id, seat_index)` room-scope vs `(target_argument_id, seat_index)` point-scope).
2. **Does Round 1 "close" #680?** A #680 split-comment said the 1:1-first half is "achieved". This design reads the genuine residue (the transition machine + the two invariants) as unshipped and closes #680 on Round 1 merge. If the orchestrator considers #680 already substantively satisfied, Round 1 is a hardening/completeness pass and "closes #680" is a bookkeeping call — confirm.
3. **OD-4 persistence shape sign-off** — the assessment recommends **Option A** (contribution marker table keyed to argument_id). Operator sign-off required before Round 2.
4. **OD-2 capacity = 3** — confirm 3 is the v4 number.
5. **Flag name/posture** — recommend `chime_in`, default OFF, operator-flipped cohort ramp. Confirm the name and the OFF-by-default posture.
6. **OD-1 (private observers)** — surfaced, not decided; orthogonal to the public-only chime path. Confirm "keep shipped behavior for now" so Round 2 does not wait on it.
