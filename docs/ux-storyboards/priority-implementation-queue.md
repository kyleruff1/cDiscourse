# CDiscourse — Priority Implementation Queue

The ordered, staged work list for the implementer. Implementation proceeds
**sequentially down this queue** — not as a broad "improve the UX" sweep. Each
item carries the fields an implementer needs to start cold.

> Companion: [`designer-cycle-brief.md`](designer-cycle-brief.md),
> [`design-cycle-handoff.md`](design-cycle-handoff.md),
> [`../ux-ui-project-board.md`](../ux-ui-project-board.md) → "Supersession map".

Issue keys: `QOL-030…033` = one-box interface; `QOL-034…042` = storyboard-pass
cards; `EV-003 / IX-001 / GAME-003B` = the new design stubs.

---

## P0 — Foundation / terminology / unblockers

### P0-1 — Scrub normal-user "game" / "debate" / "Tap to join"
- **Story source:** terminology-and-copy-rules.md · all storyboards.
- **Roadmap source:** QOL-035.
- **User problem:** the entry surfaces still expose legacy / discouraged wording.
- **Desired behavior:** no "game" / "Debates" tab label / "Tap to join" /
  "winner" / "loser" in normal-user UI; "debate" reworded opportunistically.
- **Current support:** live tab already says "Arguments"; audit at 0 live
  prohibited, 29 discouraged.
- **Missing app support:** reword the 29 discouraged "debate"/"moderator"
  strings in mounted normal-user screens.
- **Issue key:** QOL-035 · **Existing match:** QOL-035 (catalogue) · **New issue needed:** no.
- **Priority:** P0 · **Effort:** M · **Sequence:** before/with QOL-030.
- **Acceptance:** `ux:terminology:audit --strict` exits 0; copy tests added.
- **Design dep:** none · **Eng dep:** none · **Test target:** `uxTerminologyAudit.test.ts` + per-screen copy tests.

### P0-2 — One gallery card per conversation (dedupe corpus floods)
- **Story source:** designer-cycle-brief.md · current-product problems.
- **Roadmap source:** IX-001 · Epic 11 Gallery.
- **User problem:** repeated corpus posts flood the entry list.
- **Desired behavior:** N corpus duplicates collapse into one conversation card.
- **Current support:** the gallery model has a dedupe model (Stage 6.3).
- **Missing app support:** a confirmed dedupe key + IX-001 density model.
- **Issue key:** IX-001 · **Existing match:** IX-001 stub · **New issue needed:** no.
- **Priority:** P0 · **Effort:** M · **Sequence:** with the gallery work.
- **Acceptance:** N duplicates → 1 card; documented dedupe key.
- **Design dep:** IX-001 stub · **Eng dep:** gallery model · **Test target:** gallery dedupe test.

### P0-3 — Confirm the QOL-030 one-box foundation
- **Story source:** one-box-interface-model.md.
- **Roadmap source:** QOL-030.
- **User problem:** composing is spread across bespoke surfaces.
- **Desired behavior:** one switchable box + popout chassis.
- **Current support:** design docs QOL-030…033 on `main`.
- **Missing app support:** the implementation.
- **Issue key:** QOL-030 · **Existing match:** QOL-030 · **New issue needed:** no.
- **Priority:** P0 · **Effort:** XL · **Sequence:** first implementation card.
- **Acceptance:** see `docs/designs/QOL-030.md` §9.
- **Design dep:** QOL-030.md (done) · **Eng dep:** `engine.ts`, RULE-005 model · **Test target:** `boxModel` / `actPopoutModel` suites.

### P0-4 — Argument setup naming + root-claim flow
- **Story source:** roommates-dishes · band-space-rent storyboards (Step 1).
- **Roadmap source:** GAME-003B.
- **User problem:** room creation uses bespoke `CreateDebateForm` with "debate" copy.
- **Desired behavior:** "Argument setup" feeding the QOL-030 `root_claim` box.
- **Current support:** GAME-003 modes shipped; `CreateDebateForm` bespoke.
- **Missing app support:** the setup panel inside the one-box.
- **Issue key:** GAME-003B · **Existing match:** GAME-003B stub · **New issue needed:** no.
- **Priority:** P0 · **Effort:** M · **Sequence:** with/after QOL-030.
- **Acceptance:** see `docs/designs/GAME-003B.md`.
- **Design dep:** GAME-003B stub · **Eng dep:** QOL-030 · **Test target:** setup-field model + terminology test.

### P0-5 — Preserve the no-service-role / submit-argument-only guardrail
- This is a **standing guardrail**, not a build item. Every queue item below
  posts only through `submit-argument`; no service-role in client; no direct
  insert into `public.arguments`. Tests for each card assert it.

---

## P1 — Entry gallery and argument discovery

### P1-G1 — Conversation gallery card: full triage set
- **Story source:** designer-cycle-brief.md · current-product problems.
- **Roadmap source:** GAL-002 · IX-001 · Epic 11.
- **User problem:** a card does not compactly show what a user needs to triage.
- **Desired behavior:** each card shows root post · latest move · status · heat /
  momentum / temperament · needs-response · no-rebuttal · evidence/source-chain
  debt · private/invited/public · quiet / heating / hot / plain / evidence-heavy
  / unresolved.
- **Current support:** Stage 6.3/6.4 gallery cards + mini-timeline.
- **Missing app support:** the evidence-debt indicator (EV-003); the full
  temperament set.
- **Issue key:** GAL-002 · **Existing match:** GAL-002 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** after P0.
- **Acceptance:** every triage field renders; one card per conversation.
- **Design dep:** IX-001, EV-003 · **Eng dep:** gallery model, EV-003 · **Test target:** gallery card view-model test.

### P1-G2 — Gallery focus lenses + search / pagination / sort
- **Story source:** designer-cycle-brief.md.
- **Roadmap source:** IX-001.
- **User problem:** no way to scan one concern at a time in a busy list.
- **Desired behavior:** lenses (needs-response · no-rebuttal · heating · hot ·
  quiet · evidence-requested · source-chain · private invites · my rooms ·
  recently-updated · settled); search; pagination; sort by created / activity /
  engagement state.
- **Current support:** Stage 6.3 buckets/sort/pagination partial.
- **Missing app support:** the IX-001 lens model.
- **Issue key:** IX-001 · **Existing match:** IX-001 stub · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** with P1-G1.
- **Acceptance:** see `docs/designs/IX-001.md`.
- **Design dep:** IX-001 · **Eng dep:** gallery model, LIFE-001, EV-003 · **Test target:** lens predicate tests.

### P1-G3 — Observer-first entry, collapsed side option bar
- **Story source:** roommates-dishes (Step 12).
- **Roadmap source:** Stage 6.4 · SC-001 (re-housed by QOL-031).
- **User problem:** entering a public room should not force a side choice.
- **Desired behavior:** observer default; collapsed side bar that opens the Act popout.
- **Current support:** Stage 6.4 shipped this.
- **Missing app support:** the rail folds into the QOL-031 Act popout.
- **Issue key:** QOL-031 · **Existing match:** QOL-031 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** — (folded into QOL-031) · **Sequence:** QOL-031.
- **Acceptance:** observer entry, no modal; rail = Act popout trigger.
- **Design dep:** QOL-031.md · **Eng dep:** QOL-030 · **Test target:** QOL-031 suite.

---

## P1 — One-box composer and flash-popout chassis

### P1-C1 — QOL-030 one-box composer + popout chassis
- **Roadmap source:** QOL-030 · **Story source:** one-box-interface-model.md.
- **User problem / desired / current / missing:** see P0-3.
- **Issue key:** QOL-030 · **Existing match:** QOL-030 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** XL · **Sequence:** #1.
- **Acceptance / tests:** `docs/designs/QOL-030.md` §9.
- **Design dep:** QOL-030.md · **Eng dep:** `engine.ts`, RULE-005, VG-001.

### P1-C2 — QOL-031 Act popout
- **Roadmap source:** QOL-031. **Issue key:** QOL-031 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** L · **Sequence:** #2, only after QOL-030 green.
- **Acceptance / tests:** `docs/designs/QOL-031.md`.
- **Design dep:** QOL-031.md · **Eng dep:** QOL-030 chassis.

### P1-C3 — QOL-032 Inspect popout
- **Roadmap source:** QOL-032. **Issue key:** QOL-032 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** L · **Sequence:** #3, only after QOL-031 green.
- **Acceptance / tests:** `docs/designs/QOL-032.md` + EV-003.
- **Design dep:** QOL-032.md, EV-003 · **Eng dep:** QOL-030 chassis.

### P1-C4 — QOL-033 Go popout
- **Roadmap source:** QOL-033. **Issue key:** QOL-033 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** #4, only after QOL-032 green.
- **Acceptance / tests:** `docs/designs/QOL-033.md` + IX-001.
- **Design dep:** QOL-033.md, IX-001 · **Eng dep:** QOL-030 chassis, IX-002 model.

---

## P1 — Argument room timeline / node interaction

### P1-T1 — Horizontal timeline line / scrubber
- **Story source:** all storyboards (Step 10 dishes). **Roadmap source:** TL · IX-002.
- **User problem:** the timeline should read as a horizontal line, not a thread.
- **Desired behavior:** mainline nodes left→right; beginning/middle/end stamps.
- **Current support:** Stage 6.1.8 timeline + IX-002 mini-map.
- **Missing app support:** scrubber polish; shared grammar with the gallery.
- **Issue key:** TL-follow-up · **Existing match:** TL-001/002/003 · **New issue needed:** no (track as TL follow-up).
- **Priority:** P1 · **Effort:** M · **Sequence:** alongside QOL-033.
- **Acceptance:** legible at 250+ nodes; latest active by default.
- **Design dep:** IX-001 grammar · **Eng dep:** timeline model · **Test target:** timeline render tests.

### P1-T2 — Chime-in vertical branch · tangent diagonal branch
- **Story source:** roommates-dishes (Steps 12, 18). **Roadmap source:** BR-003/BR-004.
- **User problem:** branches must be visually attached to their parent node.
- **Desired behavior:** chime-in = vertical branch; tangent = diagonal branch.
- **Current support:** BR-003 / BR-004 shipped (branch grammar).
- **Missing app support:** render polish under the scrubber.
- **Issue key:** BR-follow-up · **Existing match:** BR-003/004 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** with P1-T1.
- **Acceptance:** branches render attached; distinguishable without color.
- **Design dep:** BR-004 · **Eng dep:** branch grammar model · **Test target:** branch render tests.

### P1-T3 — Active-node detail → Inspect popout
- Re-housed by QOL-032 (see P1-C3). No separate item — tracked there.

---

## P1 — Evidence and source-chain UX

### P1-E1 — Evidence debt tracker
- **Roadmap source:** EV-003. **Story source:** band-space-rent (Steps 9–10).
- **Issue key:** EV-003 · **Existing match:** EV-003 stub · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** with QOL-032.
- **Acceptance / tests:** `docs/designs/EV-003.md`.
- **Design dep:** EV-003 stub · **Eng dep:** EV-001 model.

### P1-E2 — Payment / screenshot evidence metadata
- **Roadmap source:** QOL-036. **Issue key:** QOL-036 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** with P1-E1.
- **Acceptance:** payment fields additive to EV-001; redacted; `user_asserted`.
- **Design dep:** needs a full design (stub-only today) · **Eng dep:** EV-001.

### P1-E3 — Evidence applicability dispute flow
- **Roadmap source:** QOL-037. **Issue key:** QOL-037 · **New issue needed:** no.
- **Priority:** P1 · **Effort:** M · **Sequence:** after P1-E2.
- **Acceptance:** structured evidence responses; applicability status axis.
- **Design dep:** needs a full design · **Eng dep:** EV-001/003.

---

## P2 — Notifications / invite lifecycle

### P2-N1 — Invite → signup/auth → room return path
- **Roadmap source:** QOL-038. **Issue key:** QOL-038 · **New issue needed:** no.
- **Priority:** P2 · **Effort:** L · **Sequence:** after the P1 block.
- **Acceptance:** invited user lands directly in the room; no broad user search;
  no service-role; no live email in the build pass.
- **Design dep:** needs a full design · **Eng dep:** Supabase auth, RLS.

### P2-N2 — Invite & response notification lifecycle
- **Roadmap source:** QOL-040. **Issue key:** QOL-040 · **New issue needed:** no.
- **Priority:** P2 · **Effort:** L · **Sequence:** after P2-N1.
- **Acceptance:** in-app notifications for the storyboard triggers; no push.
- **Design dep:** needs a full design · **Eng dep:** notification model.

---

## P2 — Settlement / archival / future reference

### P2-S1 — Settlement / lock
- **Story source:** both storyboards (settlement). **Roadmap source:** room status.
- **Desired behavior:** both parties settle → room locks, grey, read-only,
  referenceable. "Settled", never "case closed".
- **Current support:** room status / immutable bodies partly shipped.
- **Issue key:** RULE-follow-up · **New issue needed:** no.
- **Priority:** P2 · **Effort:** M · **Sequence:** after the P1 block.

### P2-S2 — Linked prior argument reference
- **Roadmap source:** QOL-042. **Issue key:** QOL-042 · **New issue needed:** no.
- **Priority:** P2 · **Effort:** M · **Sequence:** after P2-S1.
- **Acceptance:** a new room references a prior settled room; private prior
  rooms enforce the access check.
- **Design dep:** needs a full design · **Eng dep:** room-to-room link + RLS.

---

## Later — Voting / public promotion

### L-1 — Voting / public promotion
- **Out of scope** for this cycle and explicitly out of the v1 build set. The
  gallery model reserves placeholder fields (`voteScorePreview`,
  `winnerPreview`, `promotedArgumentCount`) — do **not** implement them. A later
  cycle, with explicit operator authorization, picks this up.
- **New issue needed:** no — deferred.
