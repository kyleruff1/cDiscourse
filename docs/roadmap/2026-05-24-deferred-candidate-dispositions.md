# Deferred Candidate Dispositions — RECON-001 (2026-05-24)

> **Companion to:** [`2026-05-24-post-interaction-epic-reconciliation.md`](./2026-05-24-post-interaction-epic-reconciliation.md) §5 Category D.
>
> **Why this exists.** The RECON-001 design (`docs/designs/RECON-001.md`) identified five deferred-candidate names that had surfaced in chain prompts, design enrichments, review docs, or smoke-verification reports during the Interaction-epic shipping work but had never been resolved. This document records the explicit disposition for each — file with full working scope, defer indefinitely with rationale, or BLOCK pending operator decision. Two candidates were filed as new GitHub issues. Three were deferred indefinitely with documented rationale and re-evaluation triggers. Zero are blocked.
>
> **Doctrine note.** Every working scope drafted here was checked against the `cdiscourse-doctrine` skill ban-list (no `winner`, `loser`, `correct`, `true`, `false`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot` tokens) and against CLAUDE.md §"What Not to Build (v1 Scope)" guards (no voting, no push, no public API, no OAuth, no web, no realtime collab editing, no argument search). All five candidates pass both checks; none degraded to BLOCK on doctrine grounds.

---

## §1 — Summary table

| # | Candidate | Working name | Disposition | New issue # |
|---|---|---|---|---|
| §2 | Notification preferences surface | QOL-040.1 | (b) Defer indefinitely | n/a |
| §3 | Moderator-initiated visibility transitions | QOL-040.2 | (b) Defer indefinitely | n/a |
| §4 | Payment-evidence pill state from composition signals | **QOL-036.1** | **(a) File** | #270 |
| §5 | COMP-001.1 three smoke-surfaced refinement candidates | COMP-001.1 | (b) Defer indefinitely | n/a |
| §6 | Deep-link node pre-activation via Stage 6.4 entry-hint extension | **QOL-040.3** (re-labelled) | **(a) File** | #271 |

Two filings landed (QOL-036.1 + QOL-040.3); three indefinite deferrals (QOL-040.1, QOL-040.2, COMP-001.1). Zero BLOCKs.

---

## §2 — QOL-040.1 (notification preferences surface)

**Origin:** `docs/designs/QOL-040.md` §E7.2 (lines 1351–1369). The QOL-040 design names QOL-040.1 as the working name for a future per-trigger notification preferences UI and explicitly authorises indefinite deferral pending real product pressure.

**Pressure signal:** absent. Operator decision E7.2 explicitly states "the operator may file it later if real product pressure for preferences emerges; otherwise the deferral may stand indefinitely." No storyboard moment requires per-kind preferences. No user comment cited.

**Integration leverage:** low. Preferences are a quality-of-life enhancement to the existing notification list; they do not unblock any downstream card. The notification list itself works without preferences.

**Effort estimate:** L. Adds: preferences table + RLS, preferences UI (toggle list), Edge Function read of preferences before insert, per-trigger opt-out check, copy for the preferences screen. Multi-file change touching `src/features/notifications/`, `src/features/preferences/`, and `supabase/functions/room-notifications/`.

**Working-scope precision:** yes. QOL-040 design §E7.2 and §E3 name the integration points (`notificationsOptInStub`, `useNotifications`) and the JSDoc comments already mark the deferral locations.

**Doctrine compliance:** yes. Preferences carry no verdict, no truth claim, no popularity signal. "Mute a room" is a personal access preference, not a judgment. Push notifications stay out of scope (preserved). Email unsubscribe stays deferred with preferences (preserved per QOL-040 §E1).

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure absent — operator decision E7.2 explicitly authorised indefinite deferral.
- Leverage low — no card depends on it; the notification list works without preferences.
- Filing now creates a "ready" issue that has no demand and may sit unaddressed for releases. Better to file when real pressure emerges (e.g. user reports excessive notifications, operator wants quiet-hours).

**Recommended re-evaluation trigger:** if the operator observes (a) user churn from notification volume, (b) feature requests for mute/quiet hours, or (c) an opt-out is required for compliance reasons (e.g. email unsubscribe regulation), re-promote QOL-040.1 to disposition (a) and file.

**New issue #:** n/a — deferred indefinitely.

---

## §3 — QOL-040.2 (moderator-initiated visibility transitions)

**Origin:** `docs/reviews/QOL-039.md` lines 98 (cross-references QOL-040.2 as the natural follow-up for mod-initiated visibility transitions). The QOL-039 implementation reserved `callerIsModeratorOrAdmin` in the model surface and kept the DB+RLS layer creator-or-mod as defense-in-depth, so a future QOL-040.2 can widen the gate to mods without a model break or schema work.

**Pressure signal:** absent. No storyboard moment requires moderator-initiated visibility transition. No user comment cited. The QOL-039 design notes that the DB+RLS layer already permits creator-or-mod as defense-in-depth, so a future mod-initiated transition would not require schema work — only UI surface + Edge Function gate widening.

**Integration leverage:** low. Affects only `record-visibility-transition` Edge Function + `MakePrivateConfirmation.tsx` UI gate + `roomVisibilityModel.ts` allowance check. No downstream card depends on it.

**Effort estimate:** S. The reserved fields are already in place; the card flips the UI gate and adds a mod-actor branch in the Edge Function.

**Working-scope precision:** yes. QOL-039 design §E1 (OD-1 creator-only UI gate) and the QOL-039 review's check 64–66 name the exact integration points.

**Doctrine compliance:** yes. Moderator action is structural (room access), never a verdict. The notification copy already drafted for `room_made_private` is actor-agnostic.

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure absent — the QOL-039 implementation explicitly reserved the mod path as defense-in-depth so a future widening is non-breaking.
- Leverage low — no card depends on it.
- The reserved fields in the model surface mean a future mod-initiated visibility transition can be added in a single S-effort card without breaking changes — there is no architectural cost to deferring.

**Recommended re-evaluation trigger:** if the operator observes moderator intervention is needed (e.g. a public room with abusive behaviour the creator won't address), promote QOL-040.2 to disposition (a) and file.

**New issue #:** n/a — deferred indefinitely.

---

## §4 — QOL-036.1 (payment-evidence pill state from composition signals)

**Origin:** `docs/roadmap/2026-05-23-post-slate-reconciliation.md` §6.1 ("Highest-leverage integration follow-ups", row 1). The prior reconciliation report identified QOL-036.1 as "the strongest candidate for a near-term integration follow-up" since the QOL-036 chain prompt explicitly anticipated it ("mutations driving evidence-pill state").

**Pressure signal:** medium. The integration was anticipated by the QOL-036 chain prompt but never carried into QOL-036's shipped scope (which was additive metadata only). It is consumable now that MCP-CAT-001 has shipped the `evidence_applicability_disputed`, `corroborating_document_attached`, and `evidence_debt_opened/resolved` mutations.

**Integration leverage:** high. Wires QOL-036's payment-metadata evidence pill to the composition layer's lifecycle signals — the pill's applicability-status changes would then fire on classifier signals rather than only on explicit user-action. The same wiring pattern is reusable by EV-001..EV-005 (per the prior report's §6.1 table).

**Effort estimate:** M. The card adds a composition-layer consumer in `src/features/evidence/` that maps the four named mutation types to pill state transitions. Adds tests covering each mutation-to-state mapping. Does not require schema or Edge Function changes.

**Working-scope precision:** yes. The prior report's §6.1 names the exact four mutation types, the shipped QOL-036 surface lists the pill fields they would drive, and the MCP-CAT-001 catalog ids are now stable.

**Doctrine compliance:** yes. The pill state changes never produce verdicts. "Applicability disputed" is a status, not a truth claim (established by QOL-037's design). The composition layer is deterministic; no AI call required.

**Disposition: (a) File.**

**Rationale:**
- Pressure medium and explicitly anticipated by an earlier chain prompt (the QOL-036 chain prompt's integration hint).
- Leverage high — sets the pattern for the broader composition-layer integration sweep that the prior report's §6.1 enumerated.
- Effort M — single feature, no schema work.
- Filing now means the next session can sequence it without re-extrapolating its scope.

### §4.1 — Filed-issue body (the text passed to `gh issue create`)

```markdown
# QOL-036.1 — Composition-layer integration for payment-evidence pill state

Follow-up to QOL-036 (issue #205, shipped 2026-05-21). Anticipated by the QOL-036 chain prompt and the prior reconciliation report's §6.1 ("strongest candidate for a near-term integration follow-up").

## Goal

Wire the payment-evidence pill's applicability-status to composition-layer signals so the pill state changes fire on classifier mutations rather than only on user-action.

## Acceptance criteria

- The pill consumes the following composition-layer mutations (introduced by MCP-CAT-001):
  - `evidence_applicability_disputed` → pill state becomes "applicability disputed"
  - `corroborating_document_attached` → pill state becomes "corroborated"
  - `evidence_debt_opened` → pill state becomes "source requested"
  - `evidence_debt_resolved` → pill state becomes "source supplied"
- Each transition fires deterministically from the classifier output; no AI call from the production app.
- The pill's applicability-status field never produces a verdict / truth value (per QOL-037 doctrine).
- No schema or Edge Function changes.
- Tests cover each mutation-to-state mapping plus a doctrine ban-list check.

## Out of scope

- The other 10 cards listed in the prior reconciliation's §6.1 (EV-001..EV-005, GAME-004..006, BR-001/003/004, etc.) — those are separate follow-up candidates. This card establishes the pattern; the sweep is a future operator decision.
- Schema changes — purely a UI / model consumer of existing data.
- AI moderator hookup — deterministic classifier output only.

## Doctrine

- v1 scope: no voting, no push, no OAuth, no public API, no real-time editing, no search.
- AI hard limits: no AI call from the production app.
- Plain language: pill copy uses `gameCopy.toPlainLanguage` for any classifier code surfaced to the user.

## Dependencies

- QOL-036 (#205) — shipped, payment-evidence metadata baseline.
- MCP-CAT-001 (effective via PR #252) — shipped, mutation catalog v1.
- COMP-001 (#244, PR #251) — shipped, composition layer.

## Filed by RECON-001 (2026-05-24) per operator pre-decision authorising filing of recommended candidates.
```

**Labels applied:** `priority:p2`, `effort:m`, `epic:evidence`, `release:6.7`, `area:roadmap`, `area:ux-storyboards`.

**New issue #:** **#270** — https://github.com/kyleruff1/cDiscourse/issues/270.

---

## §5 — COMP-001.1 (three smoke-surfaced refinement candidates)

**Origin:** `docs/testing-runs/2026-05-23-band-space-rent-smoke-verification.md` §"Follow-up candidates" (lines 81–86). Three candidates surfaced by the smoke verification against the doc-side 35-id catalog.

The three candidates:

1. **`evidence_applicability_supported` mutation type** — symmetric companion to `evidence_applicability_disputed`. Would fire on the original evidence-attaching move when a corroborating document later supports the same applicability claim.
2. **`prior_dispute_resolved` mutation type** — fires when a concession resolves a prior applicability dispute. Doc-flagged as "implementer decision."
3. **`sub_axis_resolved` state transition** — when a move on the sub-axis carries `ready_for_synthesis=1` with corroborating evidence, the active sub-axis should flip from `status: 'open'` to `status: 'resolved'`. Currently stays open even after a settling move.

**Pressure signal:** low. The smoke verification's disposition for all three is "follow-up candidate; none blocking; none required for QOL-035 or QOL-036." No user-facing breakage. The doc explicitly frames them as implementer-decision items rather than hard requirements.

**Integration leverage:** medium for the `sub_axis_resolved` candidate (it is a state-machine refinement that the MCP-CAT-001 addendum explicitly scoped out — adding it now would close the loop on the open-vs-resolved sub-axis distinction). Low for the other two (asymmetric companions that no UI currently consumes).

**Effort estimate:** S for any single candidate; M for the three-candidate bundle.

**Working-scope precision:** yes for `sub_axis_resolved` (the smoke verification names the exact state transition and the missing `CompositionState` field). Partial for the other two — the smoke verification labels them "implementer decision" and "scope follow-up."

**Doctrine compliance:** yes. State transitions are structural, not verdicts.

**Disposition: (b) Defer indefinitely.**

**Rationale:**
- Pressure low — no user-facing breakage, all three are doc-vs-implementation gaps the doc itself sanctioned as future work.
- Two of three candidates have only partial working-scope precision.
- The MCP-CAT-001 addendum explicitly stated "rules that would require new `CompositionState` fields are out of scope for this card and should be filed as follow-up" — but "should be filed" assumed a user-pressure signal that has not materialised.
- The broader composition-layer integration sweep (post-QOL-036.1 — §4 above) is the natural moment to re-evaluate: if QOL-036.1 ships and the pattern proves useful, the three COMP-001.1 candidates can be folded into that sweep as a bundle.

**Recommended re-evaluation trigger:** when the composition-layer integration sweep (post-QOL-036.1) begins, re-check whether `sub_axis_resolved` is needed to close the loop on the synthesis-readiness UI. If yes, promote at that point.

**New issue #:** n/a — deferred indefinitely.

---

## §6 — QOL-040.3 (deep-link node pre-activation via Stage 6.4 entry-hint extension)

**Origin:** `docs/designs/QOL-040.md` §17 (lines around 859) and `docs/reviews/QOL-040.md` Suggestion #1 (lines 112–113). The QOL-040 implementer disclosed the gap honestly: the notification deep-link routes to the intended room, but cannot pre-activate the specific `activeArgumentId` because Stage 6.4's entry-hint mechanism does not accept one. The room's existing logic selects the latest move on entry — adequate for v1, less precise than the storyboards imply.

**Pressure signal:** low. Reviewer disposition (QOL-040 review Suggestion #1) was "Not a Block — the notification still routes correctly to the room, and the room screen's existing logic selects the latest move on entry." The gap is "less precise than the storyboards imply," not "broken."

**Integration leverage:** medium. The fix touches Stage 6.4's entry-hint mechanism (`seamlessConversationEntry.ts` or equivalent) to accept an optional `entryHintForArgumentId` field. Once added, every notification type benefits, and any future deep-link consumer (e.g. a "jump to this move" share link in the gallery) also benefits.

**Effort estimate:** M. The Stage 6.4 model is well-tested; the addition is additive (new optional field, new branch in the hint resolver). The notification handler in `App.tsx` lines 111–113 already has the comment-marked spot.

**Working-scope precision:** yes. QOL-040 design §17 and QOL-040 review Suggestion #1 name the exact integration points and the proposed field name (`entryHintForArgumentId`).

**Doctrine compliance:** yes. Deep-link pre-activation is a routing refinement, not a verdict. No AI call required.

**Disposition: (a) File.**

**Rationale:**
- Pressure low but clearly identified by both the implementer (in source code comment at `App.tsx` lines 111–113) and the reviewer (Suggestion #1).
- Leverage medium — the Stage 6.4 extension benefits every future deep-link consumer, not just notifications.
- Effort M, precise working scope.
- Filing now means the next time a notification user-experience issue arises, the operator has a ready card to promote rather than re-extrapolating from the QOL-040 source-code comment.

**Note on the working name.** The RECON-001 launch prompt and the QOL-040 review use the working name "QOL-040.2" for this candidate, but **QOL-040.2 was already claimed** by the moderator-initiated-visibility candidate (per §3 above, cross-referenced from `docs/reviews/QOL-039.md` line 98). To prevent a name collision, this candidate is re-labelled **QOL-040.3**. The reconciliation report's §5 records the re-labelling explicitly so the operator is not confused.

### §6.1 — Filed-issue body (the text passed to `gh issue create`)

```markdown
# QOL-040.3 — Deep-link node pre-activation via Stage 6.4 entry-hint extension

Follow-up to QOL-040 (issue #209, shipped 2026-05-24). Identified as a v1 gap in QOL-040 design §17 and QOL-040 review Suggestion #1.

## Goal

Extend Stage 6.4's entry-hint mechanism to accept an optional `entryHintForArgumentId` field so that a notification deep-link can pre-activate the specific argument node the notification references, not just route to the room.

## Acceptance criteria

- Stage 6.4's seamless-entry hint model accepts an optional `entryHintForArgumentId: string` field (additive; existing entry-hint behaviour preserved when the field is absent).
- `App.tsx`'s notification handler passes the notification's `activeArgumentId` (already in the `room_notifications` row) to the hint when navigating.
- The argument-room screen consumes the hint and selects the specified argument as active on mount; falls back to the existing "select latest move" logic when the hint is absent or the argument is no longer accessible (e.g. soft-deleted).
- No schema change; no Edge Function change; no migration.
- The TODO comment in `App.tsx` lines 111–113 is replaced by the wired call.
- Tests cover: hint present + valid → that argument is active on mount; hint absent → fallback to latest-move; hint references soft-deleted argument → fallback to latest-move with neutral log line.

## Out of scope

- Realtime notification delivery (separately deferred per QOL-040 §17 follow-up).
- Notification preferences (separately deferred per QOL-040.1).
- QOL-038 native deep-link path (separately deferred per QOL-038 review Suggestion #2; the web path is unaffected by this card).

## Doctrine

- v1 scope: no push, no realtime, no OAuth, no public API, no search.
- AI hard limits: no AI call.
- Plain language: no user-facing copy changes — pure routing improvement.

## Dependencies

- QOL-040 (#209) — shipped, notification model.
- Stage 6.4 (`docs/seamless-conversation-entry.md`) — shipped, entry-hint baseline.
- QOL-038 (#207) — shipped, web deep-link path is the consumer this hint serves.

## Filed by RECON-001 (2026-05-24) per operator pre-decision authorising filing of recommended candidates.
```

**Labels applied:** `priority:p2`, `effort:m`, `epic:interaction`, `release:6.7`, `area:roadmap`, `area:ux-storyboards`.

**New issue #:** **#271** — https://github.com/kyleruff1/cDiscourse/issues/271.

---

*End of deferred-candidate-dispositions doc. Two issues filed (#270, #271); three indefinite deferrals (QOL-040.1, QOL-040.2, COMP-001.1) documented with re-evaluation triggers. No BLOCKs surfaced for operator decision.*
