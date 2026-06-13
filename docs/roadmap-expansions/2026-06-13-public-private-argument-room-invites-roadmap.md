# Public / Private Argument-Room Invites — roadmap expansion (2026-06-13)

**Run code:** `ARG-ROOM-VISIBILITY-INVITE-SLATE-2026-06-13`
**Baseline:** `main @ f85ced2`
**Release:** 6.7
**Lane:** docs-only this run (roadmap + 5 design docs + 5 reviews + slate index + 8 issues). **No production code, migration, or deploy in this run.** Implementation happens in the per-card branches that follow.
**Slate index:** `docs/designs/ARG-ROOM-VISIBILITY-INVITE-SLATE-2026-06-13-INDEX.md`
**Doctrine anchors:** `cdiscourse-doctrine` §1 (no winner/loser/truth/verdict copy — structure, never judgment), §2-3 (heat / popularity are activity, never an input to access or seating), §8 (RLS on every table, never disabled; never edit an applied migration), §9 (plain language via `gameCopy`), §10 (v1 scope — no voting/scoring/search/OAuth/public API), §10a (Observations vs Allegations). `src/lib/constitution/engine.ts` immutability is **not engaged** — nothing in this slate touches the rules engine, the transition matrix, or any constitution version.

---

## 1. What this slate builds

Argument-room **creation with public/private visibility, one direct email invite, and a capacity cap** — turning five separately-shipped primitives into one enforced, exposed, reconciled product.

### Binding product contract (restated in every card and design)

> One direct invite at creation. Private rooms are 1v1 (max 2 active participants). Public rooms are capped at five active participants. A public direct invite reserves one of the five seats. Public with no invite is valid. Private with no invite is invalid. Observers are not active participants. Max one direct invite per room.

### The binding creation matrix

| Visibility | Direct invites | Reserved seat | Open slots after create | Total capacity | Valid? |
|---|---|---|---|---|---|
| Private | 0 | 0 | 0 | 2 | **No** — private requires one invite |
| Private | 1 | 1 | 0 | 2 | **Yes** (default) |
| Public | 0 | 0 | 4 | 5 | **Yes** |
| Public | 1 | 1 | 3 | 5 | **Yes** |
| any | 2+ | — | — | — | **No** — max one direct invite |

"Active participant" = a `debate_participants` row whose `side` is `affirmative | negative | moderator` (i.e. NOT `observer`). A live, unaccepted `argument_room_invites` row **reserves** one seat against the cap so the invitee can always accept; accepting consumes-not-double-counts; expire/revoke reopens the seat. Observers are unlimited and never occupy a seat.

---

## 2. The 8-card slate

| Card | Issue | Title | Epic | Pri | Effort | Risk | Lane | Design doc | Depends |
|---|---|---|---|---|---|---|---|---|---|
| ARG-ROOM-ADR-001 | [#611](https://github.com/kyleruff1/cDiscourse/issues/611) | Visibility / capacity / direct-invite doctrine (reconciliation ADR) | Rules UX | P0 | S | Med | docs-only ADR (operator-ratified merge) | ✅ ADR-001 | — |
| ARG-ROOM-001 | [#612](https://github.com/kyleruff1/cDiscourse/issues/612) | Argument-room creation matrix (pure shared validator) | Rules UX | P0 | M | Low | pure TS | ✅ 001 | ADR-001 |
| ARG-ROOM-002 | [#613](https://github.com/kyleruff1/cDiscourse/issues/613) | Server-authoritative capacity + private-requires-invite + one-invite enforcement | Rules UX | P0 | XL | High | Supabase migration + RLS + Edge · **GATE-C** | ✅ 002 | 001, ADR-001 |
| ARG-ROOM-003 | [#614](https://github.com/kyleruff1/cDiscourse/issues/614) | Expose visibility + one direct invite in the live create surface | Rules UX | P0 | L | Med | UI | ✅ 003 | 001, 002 |
| ARG-ROOM-004 | [#615](https://github.com/kyleruff1/cDiscourse/issues/615) | Create-time one-invite orchestration + email-link → seat bridge | Interaction | P0 | L | High | Supabase orchestration + client return-path · **GATE-C** | ✅ 004 | 002, 003, #607/#608 |
| ARG-ROOM-005 | [#616](https://github.com/kyleruff1/cDiscourse/issues/616) | Seat-state + capacity surfacing (gallery + room) | Rules UX | P1 | L | High | pure model + read-only UI | (later) | 001, 002 |
| ARG-ROOM-006 | [#617](https://github.com/kyleruff1/cDiscourse/issues/617) | One-invite lifecycle management (view / revoke / resend) | Rules UX | P1 | M | Med | UI + existing `manage-room-invite` | (later) | 002, 005 |
| ARG-ROOM-007 | [#618](https://github.com/kyleruff1/cDiscourse/issues/618) | Visibility / invite / capacity plain-language copy + doctrine pass | Rules UX | P1 | S | Low | pure copy + ban-list tests | (later) | 001, 003 |

Cards 005–007 are filed as issues now; their design docs come later (they are secondary surfacing / lifecycle / copy work that builds on the P0 core). The five P0 cards (ADR-001, 001, 002, 003, 004) each have a full design doc + review in this run.

### Dependency DAG

```
ARG-ROOM-ADR-001 (keystone — decides the operative semantics)
  └─ ARG-ROOM-001  (pure matrix validator — single shared truth)
       ├─ ARG-ROOM-002  (server/RLS/Edge enforcement)            [GATE-C]
       │    ├─ ARG-ROOM-003  (live create-surface UI)
       │    │    └─ ARG-ROOM-004  (create-time orchestration + email→seat)  [GATE-C]
       │    ├─ ARG-ROOM-005  (seat/capacity surfacing)
       │    │    └─ ARG-ROOM-006  (one-invite lifecycle mgmt)
       │    └─ ARG-ROOM-007  (plain-language copy pass)
       └─ (005, 007 also consume the validator directly)
```

Build order: ADR-001 → 001 → 002 → {003, 005, 007} → {004, 006}. **002 and 004 are GATE-C** (Supabase merge auto-applies migrations + redeploys registered Edge Functions — merge *is* deploy). Nothing merges to `main` for those two without an explicit operator gate.

---

## 3. Build ON shipped — do NOT rebuild (the inventory)

A Phase-0 read-only inventory (HEAD `f85ced2`) found the feature is **~70–100% scaffolded across five shipped primitives**. Every card must cite and reuse these; none may re-implement them.

| Shipped primitive | Owner | Where (file:line @ f85ced2) | What it already gives us |
|---|---|---|---|
| `debates.visibility` (`public`/`private`, default public) + one-way `enforce_room_visibility_one_way` trigger + read-side RLS hiding private rooms from non-members | QOL-039 #208 | `supabase/migrations/20260524000015_qol_039_room_visibility.sql:85-94` (col), `:103-123` (trigger), `:189-198` (debates SELECT RLS) | Visibility column + privacy guarantee. **No** capacity, **no** invite coupling. |
| `argument_room_invites` table + `manage-room-invite` Edge (create / revoke / accept) | QOL-038 #207 | `argument_room_invites` (`token_hash`, partial-unique `argument_room_invites_one_live`); `supabase/functions/manage-room-invite/index.ts` (accept inserts participant via service-role) | One-live-invite-per-(debate,email) plumbing + accept→participant insert. The create surface never calls it; no rule says private *requires* an invite. |
| Invite email send (gated, default OFF) | QOL-040 #209 | `room-notifications` Resend block (`INVITE_EMAIL_ENABLED` / `RESEND_API_KEY` / `INVITE_EMAIL_FROM`); `inviteLink` null at `:416` (raw token unrecoverable from hash) | Branded email transport, off by default. QOL-040 owns the flip. |
| 1v1 room contract (2 primary seats, `resolvePrimaryOpponent`) — DERIVED, read-time only | GAME-004 #141 | `src/features/debates/roomContractModel.ts` (`RoomType`, `RoomContract`, `:338-365`, `MIN_QUALIFYING_BODY_CHARS=40`) | Private 1v1 derivation. No write path, no enforcement. |
| Public seat map, cap **6** — DERIVED, display-only | GAME-005 #142 | `src/features/debates/publicSeatModel.ts:28-33` ("NO write path and NO new DB column"), `PUBLIC_ROOM_SEAT_CAP=6` (`:62`), `PRIMARY_SEAT_COUNT=2` (`:68`) | Public seat display. **Cap is 6, this slate reconciles to 5.** No enforcement. |
| New-user Auth invite callback + set-password + auto-accept | AUTH-CALLBACK-CONSUMER-001 #607 / #608 | `src/features/auth/consumeAuthCallback.ts`, `pendingInviteIntent` slice + storage, `InviteRedeemGate`, `App.tsx` restore + auto-accept | Email-link → `/auth/callback` → set password → auto-accept reserved seat. The return path already exists. |
| Participant table — the uncapped boundary | (initial schema) | `public.debate_participants(debate_id,user_id,side,joined_at)`, PK `(debate_id,user_id)`, no role/status col (`20260516000001:164-170`); `is_debate_joinable` checks `status IN ('draft','open')` ONLY — **no count cap** (`20260516000006:96-111`); `submit-argument` checks membership existence only (`:160-194`) | Join is a direct client INSERT, RLS-gated only by `user_id=auth.uid()` + joinable-status. **Capacity is enforced nowhere.** |
| Room creation — client insert | NAV-START-ARGUMENT-001 | `createDebate` client INSERT (`src/features/debates/debatesApi.ts:107-151`, visibility `:125`, auto-join creator as moderator `:146-148`); live surface `StartArgumentPage.tsx` (no visibility/invite control); orphaned `CreateDebateForm.tsx:20-54` Public/Private `VisibilityOption` radiogroup (default public `:61`) to lift | Create path + a ready-made (orphaned) visibility radiogroup. |
| Visibility copy + gallery routing | (gameCopy) | `gameCopy.ts` `ROOM_VISIBILITY_COPY:1604-1672`; `classifyCardToSection:1543` routes private → `my_rooms` | Plain-language visibility vocabulary + gallery section routing. |

---

## 4. Divergence ledger — overlap, decisions, and the genuine net-new work

This slate was filed **after** a Phase-0 inventory showed heavy scaffolding. Recording the divergence honestly so implementers reuse rather than rebuild, and so review can hold each card to "build-on, not re-implement."

### 4.1 Operator decisions (binding)

1. **Proceed with the full 8-card slate** (not a collapsed 2–3 card residual), documenting the overlap here so each card cites its shipped seam.
2. **Public capacity cap = 5** — reconcile GAME-005's shipped `PUBLIC_ROOM_SEAT_CAP = 6` (`publicSeatModel.ts:62`) **down to 5**. ADR-001 records this as a consequence; ARG-ROOM-002 enforces 5 server-side; ARG-ROOM-005 surfaces 5; the `publicSeatModel.ts` constant change rides with whichever card first needs the derived map to read 5 (recommended: ARG-ROOM-005, the surfacing card, with a test pinning 5 and a comment citing this ledger).

### 4.2 What is genuinely net-new (the gap the slate closes)

Despite the scaffolding, **none of the product contract is actually enforced or exposed today**:

- **(a) The binding matrix as a pure validator** — does not exist. ARG-ROOM-001 adds `argumentRoomCreationMatrix.ts` as the single client+server-shared truth.
- **(b) Server/RLS capacity enforcement** (private ≤ 2, public ≤ 5) + **private-requires-invite** + **one-invite-per-room** — enforced *nowhere* today (`is_debate_joinable` checks status only; any authed user self-inserts unbounded; "one invite" is per-(debate,email) not per-room; private+no-invite is creatable). ARG-ROOM-002 adds the migration + RLS + `create-argument-room` Edge. **GATE-C.**
- **(c) Live-surface exposure** — `StartArgumentPage.tsx` exposes neither visibility nor invite and always creates public. ARG-ROOM-003 lifts the orphaned `VisibilityOption` radiogroup + a single-email field, defaulting to **Private**.
- **(d) Create-time one-invite orchestration + email→seat bridge** — the pieces (#207 invite, #209 email, #607/#608 callback) are never wired into one create-time flow. ARG-ROOM-004 is the glue. **GATE-C.**

### 4.3 Two doctrines that silently disagree with the server (the thing ADR-001 fixes)

The product *says* public rooms are bounded and private rooms are 1v1-invited; the server enforces neither. `public ≠ unrestricted thread` (today public participation is unbounded server-side) and `private ≠ hidden solo draft` (today private is just a read-hidden room with no invite requirement). ADR-001 is the one binding statement of operative truth the four enforcement/exposure cards consume and must not re-litigate.

---

## 5. Doctrine & security posture

- **No verdict copy.** Visibility is an *access* property; capacity/seat/heat are *activity*; none is a verdict. The tokens winner/loser/correct/true/false/liar/etc. appear in this slate only as **prohibitions**. Plain language routes through `gameCopy.toPlainLanguage` (ban-list scanned) — ARG-ROOM-007 owns the vocabulary.
- **RLS on every table, never disabled.** New enforcement (ARG-ROOM-002) uses `SECURITY DEFINER STABLE` helpers for cross-table count checks, honoring the RLS-recursion landmine (`20260516000006`). Migrations are append-only — never edit `20260524000015` or any applied file; write a new one.
- **No service-role in client.** Capacity/create enforcement moves behind a `create-argument-room` Edge; accept stays in `manage-room-invite` (service-role, Edge-only).
- **No account enumeration.** Post-create / post-accept copy never reveals whether an email is registered or whether the invitee is a new vs existing user.
- **Raw invite token/link never** in any API response, log, or MCP surface — only in the gated send path; masked email (`maskInviteeEmail`) only in UI.
- **Email send stays gated + default OFF** (QOL-040 #209 owns the flip).
- **GATE-C** on ARG-ROOM-002 and ARG-ROOM-004 (merge = deploy via the Supabase GitHub integration). Operator-gated merge; never self-approved.

---

## 6. This run's outputs

- This roadmap doc.
- Slate index: `docs/designs/ARG-ROOM-VISIBILITY-INVITE-SLATE-2026-06-13-INDEX.md`.
- 5 design docs: `docs/designs/ARG-ROOM-{ADR-001,001,002,003,004}-*.md`.
- 5 review docs: `docs/reviews/ARG-ROOM-{ADR-001,001,002,003,004}-design-review.md`.
- 8 GitHub issues (#611–#618), all on Project #1 (Phase=Backlog, Release=6.7, fields per §2).

No production code, migration, Edge, or deploy in this run. Implementation follows per-card on `feat/<code>-<slug>` branches, GATE-C honored.
