# UX-ROOM-1V1-CHIMEIN-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/UX-ROOM-1V1-CHIMEIN-001-design
**Design:** docs/designs/UX-ROOM-1V1-CHIMEIN-001.md
**Issue:** kyleruff1/cDiscourse#680
**Type:** DESIGN / MODEL ASSESSMENT (docs-only)

## Summary
This is a docs-only design/model-assessment card. The single committed file is
`docs/designs/UX-ROOM-1V1-CHIMEIN-001.md` (504 insertions, commit `4839949`). The
doc maps the "1:1-first room + public chime-in" product rule against the live tree
and splits it into a safe-now UI/copy + pure-model subset and a GATE-C
backend/semantics subset. I spot-checked every load-bearing code claim against the
real worktree source; all are materially accurate (file:line citations below). The
central honest claim — that **no chime-in CONTRIBUTION path exists** and therefore
the contribution semantics are correctly GATE-C and must not be faked — is verified
against the source. Proposed product copy is ban-list clean. The doc surfaces the
genuine operator conflict (OD-1: v4 "no private observers" vs shipped "private
observers uncapped") rather than silently resolving it. Safe to docs-merge with no
deploy.

## Verification
- typecheck: n/a (docs-only diff — no code/test touched)
- lint: n/a (docs-only)
- test: n/a (docs-only; doc itself ships no tests, correct for a model-assessment card)
- secret scan: clean (no keys; doc references key NAMES only in doctrine self-check)
- doctrine scan: clean (banned tokens appear only in the ban-list declaration and
  in prose saying "this is NOT a X" — never in proposed product copy)
- Migration apply: n/a — no files under `supabase/migrations/` in the diff (diff is
  exactly one `docs/designs/*.md` file). Migration-bearing verification not triggered.

## Diff footprint (docs-only confirmed)
```
git diff main..HEAD --name-only
docs/designs/UX-ROOM-1V1-CHIMEIN-001.md
```
Grep for `src/ | App.tsx | supabase/ | mcp-server/ | package.json | app.json |
assets/ | .test. | __tests__` over the diff name-list returned **zero** matches.
No code, test, or config file is touched. (Checklist item 1: PASS.)

## Spot-checked code claims (model accuracy — file:line found)
Every claim the brief flagged as load-bearing was verified against the worktree:

1. **`debates.visibility` is a persisted public/private column** — CONFIRMED.
   `src/features/debates/types.ts:10` (`RoomVisibility = 'public' | 'private'`),
   `:29` (`visibility: RoomVisibility` on the persisted row). Backed by
   `room_active_seat_cap` = `CASE WHEN d.visibility = 'private' THEN 2 ELSE 5 END`
   (migration `20260613000001`, ~line 101). Accurate.

2. **Live header seat strip defaults `roomType='public'` because App.tsx omits
   `visibility`** — CONFIRMED. `App.tsx:739` calls `useRoomContract({ roomId,
   initiatorUserId, openedAt, viewerUserId })` with **no `roomType`/`options`**; the
   in-file comment states "`roomType` ... defaults to 'public' inside the model."
   Separately, the seat-availability path a few lines below DOES read
   `currentDebate.visibility` — proving `visibility` is already loaded in App.tsx, so
   the doc's "pure prop threading, no backend" framing for the safe-now fix is correct.

3. **`isActiveParticipantSide` exists and excludes `observer`** — CONFIRMED.
   `src/features/debates/seatClaimModel.ts:66-70` returns true only for
   `affirmative | negative | moderator`; `observer` and null are excluded. Accurate.

4. **`ChimeInGovernanceControl.tsx` is governance-only (no composer / no contribution
   write path / no capacity claim)** — CONFIRMED. Header literal "Keep this chime-in
   on track"; file doc-comment "no state, no network, no write path"; reactions are
   apply/retract callbacks into an in-session hook. Grep for
   `composer|textinput|submit|insert|onChangeText|contribut` found only the
   "no ... write path" comment. The doc's central claim (no chime-in contribution
   path exists) holds. Accurate.

5. **`publicSeatModel.ts` derives a `chime_in` role + capacity 3, read-time only,
   NOT persisted to `debate_participants.side`** — CONFIRMED.
   `SeatRole = 'initiator' | 'primary_opponent' | 'chime_in'` (`:55`); capacity
   `PUBLIC_ROOM_SEAT_CAP(5) - PRIMARY_SEAT_COUNT(2) = 3` (`:67,:73,:538`); source
   comments at `:31-32` and `:50-53` state `chime_in` "is NEVER written to
   `debate_participants.side`." Accurate.

6. **`mediator/DisagreementPointsRail.tsx` dormant chime-in slot
   (`contributionKind?: 'principal' | 'chime_in'`) renders nothing when absent** —
   CONFIRMED. `:101` declares the optional field; `:93` comments "owned by
   UX-ROOM-1V1-CHIMEIN-001 (not yet shipped)"; `:96` "We NEVER synthesize the marker
   from absent data (doctrine §4)"; marker renders only when present (`:766-770`).
   `DISAGREEMENT_POINTS_RAIL_COPY.chimeInMarker = '↳ chime-in'` exists
   (`mediatorRailCopy.ts:42`). Accurate.

7. **Chime-in components are NOT mounted live** — CONFIRMED (extra check).
   `ChimeInGovernanceControl`, `PublicRoomMetricsStrip`, `buildPublicRoomSeatMap` are
   referenced only by their own files, the barrel `index.ts`, the governance hook,
   and `publicSeatModel`/tests — not by `ArgumentGameSurface.tsx` or `App.tsx`.
   `ArgumentGameSurface.tsx:2775` mounts only `SeatAvailabilityStrip`. Accurate.

8. **OD-1 conflict is real** — CONFIRMED (extra check). Migration `20260613000001`
   (~line 38) states "Observers are NEVER active participants and are NEVER capped"
   — i.e. the shipped backend allows uncapped observers in **all** rooms including
   private. This genuinely conflicts with the v4 "private rooms have no observers"
   rule. The doc flags it as OD-1 and does NOT silently change it. Accurate.

9. **`ROOM_CONTRACT_COPY.seatOpponent = 'Opponent'` (OD-5 relabel target)** —
   CONFIRMED. `roomContractModel.ts:106` (`seatOpponent: 'Opponent'`) and `:107`
   (`seatOpen: 'Open seat — first reply takes it'`). The doc's relabel recommendation
   and the lockstep-test risk it raises are grounded in real code.

10. **`direction_chime_in_vertical: 'Chime-in'`** — CONFIRMED at
    `src/features/arguments/gameCopy.ts:1299` (doc grouped it under "gameCopy.ts"; it
    is the arguments-domain copy file — citation accurate).

## Design conformance
- [x] All design "file-changes" are present — n/a; this is a design doc that proposes
      changes for FUTURE cards (A/B/C). The doc itself is the only deliverable and is present.
- [x] No undocumented file-changes — diff is exactly the one doc.
- [x] Data model matches design — the doc accurately describes the existing model
      (RoomContract, publicSeatModel, visibility) and proposes no new persisted field
      in the safe-now subset.
- [x] API contracts match design — no API change proposed in safe-now; GATE-C Edge/RLS
      work is correctly deferred and operator-gated.

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — proposed copy scanned;
      banned tokens appear only in the ban-list declaration and "this is NOT a X" prose.
- [x] Score never blocks posting — doc restates chime-ins (if B-layer ships) go through
      the deterministic `submit-argument` gate; score/standing never gates them (§10 §1).
- [x] No service-role in client code — none introduced; GATE-C Edge work uses
      caller-scoped clients per supabase-edge-contract; this card writes none of it.
- [x] No direct insert into public.arguments — none; B-layer contribution path is
      explicitly routed through `submit-argument`, never a direct client insert.
- [x] No AI calls in production app paths — none; doc restates the AI-moderator limit.
- [x] Plain language only — every proposed string maps through copy blocks; doc requires
      `looksLikeInternalCode`-false coverage for new chime-in copy in the A-layer card.
- [x] Epic-specific doctrine:
      - **supabase-edge-contract** — no service-role in client; GATE-C migration is
        append-only / RLS-on / soft-delete only; deploy is operator-run. The doc
        correctly classifies capacity enforcement, persisted role, and contribution
        path as GATE-C requiring a migration + Edge work, and does NOT smuggle any of
        them into the safe-now subset.
      - **accessibility-targets** — safe-now is copy + prop threading + a pure model
        (no new interactive UI); the doc defers role+label+state, 44×44 hit target,
        color-independent shape, and reduce-motion requirements to the C-layer control
        card. Correct: no a11y gap is introduced by the docs-only deliverable.

## Test coverage
- [x] New public functions have unit tests — n/a for the doc; the doc correctly
      assigns the R1-R7 pure-model tests + copy ban-list + private-no-chime guard test
      + relabel-lockstep updates to the A-layer implementation card as part of "done".
- [x] User-facing strings have ban-list assertion — the doc's §9 runs the ban-list over
      its own proposed strings (clean) and mandates ban-list coverage in the A-layer card.
- [x] Edge cases have tests — the 6 required design states are each specified with exact
      labels + copy and a safe-now/GATE-C tag; per-transition R1-R7 tests assigned to A-layer.
- [x] Accessibility assertions — n/a (docs-only; deferred to C-layer control card with
      explicit a11y requirements noted in §10).

## Checklist results (brief items 1-7)
1. **Docs-only** — PASS. Exactly one file (`docs/designs/UX-ROOM-1V1-CHIMEIN-001.md`);
   zero src/test/config touched.
2. **Current-code evidence accurate** — PASS. All 6 brief-flagged claims + 4 extra
   citations verified against the worktree (file:line above). No materially wrong claim.
3. **No faked semantics** — PASS. The principal-respondent-vs-chime-in CONTRIBUTION
   distinction is correctly marked GATE-C (halt-question (d) partial, §2/§6/§10). The
   safe-now subset uses only distinctions the code already makes (public/private,
   active/observer, open-seat). No chime-in contribution is surfaced as if it exists.
4. **Safe-now vs GATE-C split is sound** — PASS. Safe-now items (visibility threading,
   copy relabels, private-no-chime = render nothing, observer/principal seat-line
   wording, gallery copy, create-form framing, chime-in COPY block authoring, pure
   R1-R7 model) are genuinely UI/copy/pure-model. I confirmed each safe-now item maps
   to already-loaded data (`visibility` in App.tsx) or pure copy/model — none secretly
   requires a migration/Edge/RLS change. The GATE-C items (contribution path, capacity
   enforcement, persisted role, RLS/migration/Edge, notifications, active node controls)
   genuinely need backend.
5. **Copy compliance** — PASS. §9 ban-list run over proposed product copy returned
   zero banned tokens; the only matches in the doc are the ban-list declaration (line
   455) and avoidance prose (459) plus "verdict-free" as a meta-description (199) and
   the doctrine self-check (467/476). Doctrine self-check (§10) is sound.
6. **Operator decisions surfaced** — PASS. OD-1 (private observers — real v4-vs-shipped
   conflict), OD-2 (capacity 3), OD-3 (respondent auto-lock), OD-4 (persistence shape),
   OD-5 (Opponent relabel word) are all flagged for operator decision, not silently
   resolved. OD-1's conflict is verified against migration `20260613000001`.
7. **DAG correctness** — PASS. Layer A (UI/copy + pure model) is independent and
   shippable first; Layer B (semantics/GATE-C) is operator-gated; Layer C depends on B.
   The recommended next card is the safe-now subset (`UX-ROOM-1V1-CHIMEIN-001A`), NOT
   "build chime-ins."

## Blockers
None.

## Suggestions (non-blocking)
1. §3 Row 9 / §5.7 cite copy constants by file but a couple live in
   `src/features/arguments/gameCopy.ts` (e.g. `BRANCH_GRAMMAR_COPY` /
   `direction_chime_in_vertical:1299`) while most room copy lives in the debates
   domain. The citations are accurate but the A-layer implementer should confirm which
   `gameCopy.ts` each new block lands in (the doc's Appendix already flags path drift
   from the brief — this is consistent with that). Defer to the A-layer card.
2. OD-5: the doc recommends relabeling `seatOpponent='Opponent'` now (pure copy) but
   leaves the exact word open ("Other voice" / "Second voice" / "Respondent"). The
   A-layer card should land the operator-confirmed word in lockstep with the
   `roomContractModel` string tests (the doc correctly flags this lockstep break in
   §3 Row 11 / Risks). Non-blocking for this design doc.

## Operator next steps
- Push the branch: `git push -u origin feat/UX-ROOM-1V1-CHIMEIN-001-design`
- Open PR: `gh pr create --title "UX-ROOM-1V1-CHIMEIN-001: 1:1-first room model + public chime-in rules (design/model assessment)" --body-file docs/reviews/UX-ROOM-1V1-CHIMEIN-001.md`
- Deploy steps (from design): **None for this card.** Docs-only — no migration, no
  Edge deploy, no env var. Safe to docs-merge. (GATE-C Layer B/C, when authorized,
  will require `npx supabase db push --linked` + `functions deploy` — NOT part of
  this card.)
- **Key operator decision to surface before any Layer-B work: OD-1** — keep the
  shipped behavior (private observers allowed, uncapped) vs adopt the v4 "no private
  observers" rule (a GATE-C backend/RLS change). The doc recommends keeping shipped
  behavior for now.
- The recommended next implementation card is the safe-now subset
  (`UX-ROOM-1V1-CHIMEIN-001A` — UI/copy + pure R1-R7 model, no backend), NOT a
  chime-in build.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree
  cleanup (operator step)").
