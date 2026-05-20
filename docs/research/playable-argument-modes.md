# Playable Argument Modes — Friction, Channels, and Semantic Metadata

**Status:** Research / spike. Master planning artifact, not an implementation card.
**Card:** PM-003 (issue [#121](https://github.com/kyleruff1/cDiscourse/issues/121)).
**Epic:** Project Mgmt · **Release target:** 6.6 · **Phase:** Backlog (research / spike).
**Filed by:** 2026-05-19 product audit. **Authored:** 2026-05-20.
**Last updated:** 2026-05-20.

> This document is the navigation map for the wave of cards filed alongside it:
> RULE-004, RULE-005, RULE-006, BR-003, GAME-002, GAME-003, EV-005, COMPOSER-002, SC-005, VG-004,
> plus the PvP-roadmap companion PM-004. It exists so the operator can validate the *direction*
> before any implementation card lands, and so a future contributor can read the *why* behind the
> friction model in one place.
>
> Nothing in this document is shippable user-facing copy. Where it discusses "winner / right /
> wrong", that language appears **only** inside clearly-marked research / operator-decision
> sections, never as product copy. See §1 and §19.

---

## 1. Product thesis

**CDiscourse is a playable argument map, not a truth oracle.**

The app does not tell users who is right. It renders an argument as a navigable structure —
a timeline / tree of moves — and gives players tools to make the *next* move well. The product
value is not a verdict at the end; it is a clearer fight in the middle: each claim visible, each
unresolved axis legible, each side-issue parked where it can be picked up later instead of
derailing the mainline.

The product board (`docs/ux-ui-project-board.md`) already encodes the surface pivot:

- **Timeline = primary gameplay surface.** Users land in the argument timeline, understand the
  fight in seconds, and inspect the strongest and weakest talking points visually.
- **Stack / Cards = semantic detail / inspection surface.** Richer per-card metadata lives here.

This wave of cards (RULE-004 … VG-004) extends that pivot from *rendering* the argument to
*shaping the next move*: a composer that lives inside the room, a pause-before-send review with a
payoff, structured channels for move types, structural routing for tangents, mode-driven pacing,
and a minimal — mocked-by-default — semantic metadata layer. None of it produces a verdict.

### The 10 doctrine rules this wave must not violate

Reiterated verbatim from the `cdiscourse-doctrine` skill. Every card in this wave is gated on all
ten. A card that conflicts with any rule must stop and surface the conflict, not paper over it.

1. **Score is gameplay analysis, never truth.** The app never labels a person, post, or claim as
   "winner", "loser", "correct", "true", "false", "liar", "dishonest", "bad faith",
   "manipulative", "extremist", "propagandist", "stupid", "idiot". Strength bands describe a
   point's standing *in the game*, not objective truth. Score never blocks posting — validation
   can block, score cannot. Topic-fit, source-chain, scope risk, anti-amplification are all
   advisory.
2. **Heat means activity / friction.** "Hot" = recent move count, unresolved axes, branch depth,
   no-rebuttal pressure. "Hot" does NOT mean correct, popular, important, or trending. Copy must
   distinguish heat ≠ truth, heat ≠ consensus.
3. **Popularity is not evidence.** High engagement, retweet count, view count, follower count,
   virality grant no factual standing. `src/features/pointStanding/antiAmplification.ts` is the
   authoritative deterministic gate. Engagement credit and factual-standing eligibility are
   SEPARATE scores.
4. **AI moderator hard limits.** The AI moderator must not decide who is right, must not delete /
   hide / modify user content automatically, must not assign a truth value, must not return
   authoritative flags (`authoritative` is always `false`), and must not run on the client. It
   may assess topic relevance, assess type fit, suggest tags (user confirms), and summarize
   subtrees on request (user edits and submits).
5. **The rules engine is sacred.** `src/lib/constitution/engine.ts` stays pure TypeScript,
   side-effect free, JSON-serializable in and out — no network calls, no React hooks.
6. **Secrets policy.** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`,
   `X_BEARER_TOKEN` never appear in client code or git. `.env.example` carries only key names.
7. **No AI calls from the production app.** Everything under `app/` and `src/` (outside
   `scripts/bot-fixtures/`) must not call Anthropic, xAI, X API, or any external AI provider.
8. **Supabase conventions.** RLS on every table — never disabled. Migrations numbered
   sequentially, never edited after applying. `flags` rows never deleted, only dismissed.
   `arguments` rows never hard-deleted — soft-delete via `is_deleted = true`; deletion is a
   *request* processed by an admin.
9. **Plain language for users.** Internal validation codes never appear in user-facing strings;
   everything maps through `gameCopy.toPlainLanguage`. Unknown codes are suppressed, not echoed.
10. **v1 scope guards — do not build.** No voting / scoring system that produces a winner; no
    real-time collaborative editing of argument bodies; no OAuth / social login; no public API;
    no push notifications; no argument search.

### Where this wave brushes against the scope guards — and why it stays inside

- **GAME-002 turn pacing / "your turn"** — push notifications are explicitly v2 (rule 10).
  GAME-002 keeps `responseWindowSec` as an in-room visible countdown, not a notification.
- **GAME-003 modes / "court mode is strict"** — modes change *friction*, never produce a
  winner (rule 1, rule 10). Strict modes raise evidence and tone friction; they do not adjudicate.
- **RULE-006 semantic AI** — ships zero production AI calls in v1 (rule 7). The card is a design
  doc; the future implementation is Edge-Function-only, feature-flagged, mocked-by-default.
- **The operator's stated long-term ambition** to eventually surface a resolution / who-made-the-
  stronger-case readout (captured in §19) is *not a v1 feature*. It is an open product question,
  and any future answer must still route through rule 1.

---

## 2. Screenshots reviewed and current UX pain points

This wave was filed by the 2026-05-19 product audit, which reviewed the live Timeline / Cards
board and the composer flow. The audit is reconstructed here from the evidence the sibling cards
cite directly in their issue bodies (COMPOSER-002 and SC-005 quote specific file lines).

### Pain point A — the "Your Move" page redirect (COMPOSER-002 / issue #111)

Opening **Start argument / Reply / Challenge / Ask source** today unmounts the entire room.
`App.tsx:336` gates `<ArgumentComposer>` on `composerOpen` and *replaces* `<ArgumentTreeScreen>`.
`ArgumentComposer.tsx:279` literally renders a header that says **"Your Move"** — i.e. the
composer presents as its own screen. The user lands on a light, detached form that shows the
resolution but loses the timeline context, the active node, the scroll position, and the gallery
position. Browser back strands the user.

This contradicts the TL-003 no-route invariant ("Timeline stays inside the room surface; quick
tools open popovers / drawers / sidecars in-place; no route transition"). It is the single
largest UX regression on the Timeline-first pivot. **COMPOSER-002 fixes it.**

### Pain point B — the oversized "Observer Actions" grid (SC-005 / issue #112)

The bottom **"Observer Actions"** area is a dense flex-wrap of 6+ wide buttons.
`ArgumentSideActionRail.tsx` styles `actionButton` with `minWidth: 120`, `flexBasis: '30%'`,
`maxWidth: '49%'` — so the expanded rail wraps into a 2×3+ grid of full-width buttons, each with
a helper subtitle. `App.tsx:313-331` *also* renders a separate bottom `actionBar` for "Start
argument", which is redundant with the rail. On narrow viewports the rail + actionBar together
consume roughly 30% of vertical space and push the active node off-screen. **SC-005 collapses
this into a contextual dock.**

### Pain point C — the board reads "promising but flat" (VG-004 / issue #113)

The VG-001 visual grammar is correct — shape encodes meaning, color is never load-bearing alone —
but the rendering lacks the texture and depth that signal interactivity. The board reads like a
form, not a playable map. **VG-004 lands render-only polish** (active-path glow, selected-node
halo, evidence receipt marks, branch-stub refinement, density spacing). VG-004 is already Build
complete; see §15.

### Cross-cutting pain point — friction is structurally invisible

Today the composer ships a move the instant the user taps Post. There is no review step, no
channel hint, no tangent routing, no pacing. The app has a *permanent record* (rule 8: arguments
are never hard-deleted) but offers no moment to reconsider a high-stakes or off-path move before
it becomes part of that record. This wave adds that moment — without turning the app into a
moralising filter (see §3, §5).

---

## 3. Why false positives kill the product

A **false positive** is the app flagging, pausing, re-routing, or warning on a move that was
actually fine. In a civil-discourse product, false positives are not a minor annoyance — they are
an existential risk, for three reasons:

1. **They train users to ignore every signal.** If the pre-send review (RULE-004) pauses a normal
   reply because it contains the word "always", the user learns that the pause is noise and
   reflexively taps "Post anyway" on *every* pause — including the one time the advisory was
   genuinely useful. A noisy filter is a disabled filter.
2. **They feel like an accusation.** A false "this may be off-topic" or "this introduces a new
   issue" on a move that *was* on-topic reads as the app calling the user wrong. That collides
   directly with doctrine rule 1 (no verdicts) and rule 4 (AI never decides who is right). The
   damage is the same whether the false positive came from a keyword rule or a future AI call.
3. **They push people back to SMS.** The entire premise of the product (see §14) is that a
   structured argument surface beats an unstructured text thread. A user who hits three false
   pauses in a casual disagreement will close the app and text the other person. The friction
   has to *earn its place* every single time it appears.

The sibling cards encode this directly:

- GAME-003: *"False positives are catastrophic in casual modes. Strict modes tolerate more
  friction."*
- RULE-004: *"Ordinary replies are not blocked on missing keywords … Tests prove keyword-only
  false positives do not block."*
- RULE-005: channel mismatch produces *"a re-route suggestion, never a punitive label"*.

**Design consequence.** Every friction surface in this wave is (a) advisory by default,
(b) always escapable via "Post anyway" / "Continue", (c) graded by mode — casual modes show the
least, strict modes the most — and (d) measured against a false-positive budget (see §20). The
*only* things that hard-block are structural (see §4).

---

## 4. Why keyword-only blocking is unacceptable

Keyword matching is shallow. It cannot tell the difference between:

- *"Your claim that crime always rises is too broad"* (a legitimate scope challenge) and
  *"You always do this"* (a person-directed jab) — both contain "always".
- *"That study was retracted"* (a real source-chain signal) and *"that's a retracted argument
  style"* (casual speech) — both contain "retract".
- A genuine off-topic drift and a perfectly on-topic reply that happens to reuse a flagged term.

Because keyword matching produces unacceptable false positives (§3) and false negatives in equal
measure, the wave adopts a hard rule, stated identically across RULE-004, RULE-005, and BR-003:

> **Keyword-only detection NEVER hard-gates a post. It is not sufficient on its own, and it is
> never the sole gate.**

### What this means in practice

- Keyword / lexical signals may *contribute* to an **advisory** (severity `info` or `soft`), and
  only when corroborated by a structural signal. They never produce a `structuralBlock`.
- The structural signals that *do* drive gating and routing are deterministic and contextual:
  the parent node's topic, the declared move channel (RULE-005), the lifecycle state (LIFE-001),
  the META-001 auto-metadata (`participant_skipped_node`, `repeated_axis_pressure`, etc.), the
  constitution transition table, and the room mode.
- The future semantic layer (RULE-006) is the *deeper* signal — but RULE-006's own doctrine says
  it is *also* never the sole gate, every AI field is reconciled against a deterministic
  derivation, and conflicts surface as `confidence: 'low'`.

The escalation ladder for any non-structural concern is therefore: **deterministic structural
signal → advisory chip with a payoff action → (optionally, strict modes only) a stronger "are you
sure?" → never a block.** Keyword matching lives only at the very bottom of that ladder, as a
weak contributor.

The dedicated test files enforce this: `channelNoKeywordBlock.test.ts`,
`preSendReviewNoBlockOnKeywords.test.ts`, `tangentRoutingNoBlock.test.ts`. See §20.

---

## 5. Friction-with-payoff principle

Friction in CDiscourse is a feature — but only when it is *paid for*. The principle, stated in
RULE-004's issue body and adopted wave-wide:

> **Friction always offers a useful alternative. Every pause feels valuable.**

A pause that only says "are you sure?" is a tax. A pause that says "this looks like a broad claim
— want to narrow it, or branch the side point?" and hands the user a one-tap transformation is a
gift: it makes the *next move* better.

### The payoff catalogue

Every friction surface in this wave must offer at least one of these payoffs:

| Payoff | Delivered by | Card |
| --- | --- | --- |
| **Clarity** — narrow a broad claim, define a term | `narrow`, `add_quote` transforms | RULE-004, RULE-005 |
| **Better routing** — send a side-issue to a branch | `branch_tangent` / "Send to side branch" | BR-003 |
| **Better evidence** — attach a source / quote | `ask_source`, `add_evidence`, `add_quote` | RULE-004, EV-005 |
| **Stakes framing** — "this is a permanent move" | `permanent_record_warning` advisory | RULE-004, GAME-002 |
| **A safe exit** — save the draft, post anyway | `save_draft`, `post_anyway` always present | RULE-004 |
| **Point weight / reduced heat** — cooldown earns framing | `weightedByCooldown` pacing | GAME-002 |

### The hard guarantees

1. **"Post anyway" is always present** unless a *structural* block is hit (empty body, invalid
   transition, explicit Evidence post with no source, over-length, auth failure, opted-in
   cooldown). RULE-004 acceptance criterion.
2. **"Save draft" is always present**, even mid-cooldown (GAME-002 acceptance criterion).
3. **Every advisory has at least one valid transformation action.** RULE-004 acceptance
   criterion and test (`preSendReviewModel.test.ts` covers every advisory kind).
4. **Friction is mode-graded.** Casual modes surface only `info`-severity advisories, which
   auto-dismiss; strict modes require explicit dismiss of `soft` advisories. GAME-003 supplies
   the `toneStrictness` / `evidenceStrictness` / `allowedInformality` fields that grade it.

Friction is never punishment, never a hidden tax, and never an accusation. It is the moment the
app helps you make a sharper move.

---

## 6. Structured channels overview (cross-link RULE-005)

**Cross-link: RULE-005 — Structured argument channels (move-type field model), issue [#115](https://github.com/kyleruff1/cDiscourse/issues/115).**

The composer today is a single free-text box. A move can be a reply, a challenge, an evidence
drop, a concession — but the structure of the move is invisible until you read the body.
RULE-005 makes the *shape* of a move a first-class, lightweight field, while preserving natural
human expression.

### The channels

Built on the existing constitution argument types plus META-001 tags:

> Reply · Challenge · Clarify · Ask source · Ask quote · Add evidence · Narrow · Concede ·
> Confirm · Synthesize · Branch / tangent · Meta / process note · Evidence interaction (EV-005) ·
> Mode-specific procedural move.

### How channels work

- Each channel has a **plain-language purpose** and a set of **optional structured field
  helpers** (`source_url`, `quote_text`, `scope_example`, `definition`, `mechanism`,
  `counterexample`, `primary_source`). The helpers are *optional* in casual modes; GAME-003's
  `evidenceStrictness` can make some required in strict modes.
- `suggestChannelFromDraft(draft, parent, mode)` proposes a channel deterministically, with an
  honest `reason` (`deterministic_match` / `lifecycle_state` / `parent_demands_evidence` /
  `no_signal`) and a `confidence`. The user always sees *why* a channel is suggested, and can
  always override.
- A channel mismatch is never a verdict. It surfaces as a single-line advisory inside the
  RULE-004 review sheet with a "Switch channel" action — friction with a payoff (§5).
- The chosen channel is recorded as a META-001 manual tag (`manual:channel/challenge`) and
  surfaces in Timeline / Cards via the RULE-001 / RULE-003 plain-language map.

### Why channels matter to the wave

Channels are the *vocabulary* the rest of the wave routes on. RULE-004 (pre-send review),
BR-003 (tangent routing), GAME-002 (pacing — some modes weight certain channels), and EV-005
(evidence interaction is itself a channel) all read the declared channel as a structural signal.
A move with a declared channel is far cheaper and far safer to route than one that needs lexical
guessing — which is exactly why §4's keyword-only ban is survivable: the channel field replaces
the keyword guess.

---

## 7. Tangent / side-branch / outer-orbit routing (cross-link BR-003)

**Cross-link: BR-003 — Tangent / outer-orbit routing, issue [#117](https://github.com/kyleruff1/cDiscourse/issues/117).**

When a move does not respond to the selected point, introduces a new issue, or shifts scope, the
app should *structurally route* it into a side branch — instead of poisoning the mainline or
forcing the user to leave the app for SMS. **The redirect describes the move, not the person.**

### How routing works

- `assessTangentRisk({ draft, parent, lifecycle, manualTags })` returns a `RedirectRisk`
  (`none` / `possible` / `strong`) with a structural `reason` (`introduces_new_axis` /
  `no_signal_about_parent` / `mode_demands_response` / `repeated_off_path` /
  `user_marked_tangent`) and a `suggestedAction` (`continue` / `send_to_side_branch` /
  `ask_clarifying_question` / `branch_this`).
- The assessment is **deterministic and keyword-light**: it reads parent topic, declared channel,
  lifecycle state, and META-001 auto-metadata (`participant_skipped_node`, `branch_suggested`).
- When risk is `possible` or `strong`, the RULE-004 review sheet surfaces "This may introduce a
  new issue" with a **"Send to side branch"** action. That action creates the post as a branch
  root via the existing `submit-argument` path — it never hard-removes content (doctrine rule 8).
- Side branches stay visible from the mainline via a "Side issues (N)" chip on the parent node
  (BR-001 branch grammar). Off-path content is *collapsed*, never deleted.

### Mainline demotion — the careful part

BR-003 allows repeated off-path behaviour to *demote mainline prominence* — but only under
deterministic, visible-to-the-user rules. When `repeated_off_path` is hit ≥ 3 times in a thread,
a soft advisory appears on the offending participant's **next move only**, and **never names the
participant**. Demotion is reversible by a confirm / narrow / synthesize. This is the one place
in the wave where structural behaviour escalates against a pattern of moves; the safeguards are:
deterministic threshold, visible expectation, reversibility, and no person-label.

### Internal vs user-facing naming

"Outer Realm" is **internal-only** terminology and must never reach a user surface. The
user-facing label is an open operator decision (§19): the candidates are **Side issue**
(recommended), Off-path branch, Parking lot, Side orbit, Separate thread.

---

## 8. Turn pacing and non-deletable record stakes (cross-link GAME-002)

**Cross-link: GAME-002 — Turn pacing, daily messages, cooldown (mode-driven), issue [#118](https://github.com/kyleruff1/cDiscourse/issues/118).**

CDiscourse keeps a **permanent record**: arguments are never hard-deleted (doctrine rule 8;
deletion is a *request* processed by an admin). That permanence is what makes a move
*consequential* — and consequence is what separates a structured argument from a disposable text
thread. GAME-002 lets argument *modes* set turn pacing so that consequence is felt without the
app becoming punitive.

### The pacing model

`PacingRule` carries `maxMovesPerDay` (null = unlimited), `cooldownAfterSendSec` (0 = none),
`responseWindowSec` (null = none), `weightedByCooldown`, and `permanentRecordWarning`
(`on` / `off`). `evaluatePacing({ rule, recentMoves, now })` returns whether the user `canSendNow`,
the `nextAvailable` time, the `remainingToday` count, and an honest `reason`.

### The doctrine that keeps pacing fair

- **Pacing is mode-level, not user-level.** A mode sets the rule; an individual user is never
  singled out.
- **Both users see the rule set before entering the room.** No surprise constraints.
- **Pacing is always visible.** Remaining moves, remaining time, and next-available time are
  shown at all times via a `PacingChip` in the composer dock. There is no invisible block.
- **Cooldown has a payoff.** It buys framing, point weight, or reduced heat — never an invisible
  punishment. `weightedByCooldown` is the explicit payoff lever.
- **Casual mode default = no pacing.** False-positive risk (§3) is highest in casual modes, so
  casual rooms ship with `maxMovesPerDay: null`, `cooldownAfterSendSec: 0`.
- **Save-draft is always available, even mid-cooldown.** A cooldown delays the *send*, never the
  *thinking*.

### Permanent-record copy

In modes with `permanentRecordWarning: 'on'` (strict modes), the RULE-004 review sheet adds a
plain-language line: roughly "You are about to post a permanent move." The copy is plain-language
and never threatening — it frames stakes, it does not menace. It must pass the wave-wide ban-list
(§20). Push notifications for "your turn" are explicitly **v2** (doctrine rule 10); GAME-002's
`responseWindowSec` is an in-room countdown only.

---

## 9. Argument mode taxonomy (cross-link GAME-003)

**Cross-link: GAME-003 — Argument mode setup for 1v1 PvP (design + 4 templates), issue [#119](https://github.com/kyleruff1/cDiscourse/issues/119).**

Before a 1v1 argument starts, both users choose the **type** of argument and a strictness
profile. The mode determines evidence strictness, turn pacing, allowed informality, side-branch
encouragement, and whether a synthesis is expected. Modes set *friction*, never a verdict.

### The mode taxonomy (design space — not implementation order)

`casual_disagreement` · `domestic_bickering` · `co_parenting_custody` · `court_record_strict` ·
`political_debate` · `historical_debate` · `recollection_disconnect` ("you had to be there") ·
`workplace_decision` · `research_evidence_review` · `relationship_repair` ·
`negotiation_tradeoff` · `internet_fact_check` · `debate_club`.

### Per-mode design fields

Each mode is an `ArgumentModeDefinition` with: `toneStrictness`, `evidenceStrictness`, `pacing`
(a `PacingRule` from GAME-002), `allowedInformality`, `branchesEncouraged`,
`sourceRequestsCentral`, `finalSynthesisExpected`, `permanentRecordWarning`,
`semanticClassification` (`off` / `metadata_only` / `metadata_and_chip` — this gates RULE-006),
`cooldownEnabled`, `observerModeAllowed`, `inviteOnly`, and an optional `disclaimer`.

### What GAME-003 actually ships in v1

GAME-003 is a research/design card **plus** a small first slice: **four** mode templates ship as
data; the other ~9 ship as design-only stubs (`status: 'design_only'`) so the runner does not
paper over missing fields. The recommended first four (operator decision, §19):
`casual_disagreement`, `court_record_strict`, `internet_fact_check`, `debate_club`.

### The doctrine guardrails on modes

- **Modes are consented at room setup.** Both parties see the rules in a two-column compare
  ("your view" / "the rules") and must accept before the room becomes interactive.
- **No mode declares a winner.** A strict mode raises friction; it does not adjudicate.
- **Sensitive modes carry plain-language disclaimers.** `co_parenting_custody`,
  `relationship_repair`, and similar carry a non-legal / non-therapy disclaimer. The app provides
  no legal, medical, or therapy advice. `argumentModeNoLegalAdvice.test.ts` enforces this.
- **Casual modes must allow natural speech** — slang, "you had to be there" context. Court mode
  can be strict. False positives are catastrophic in casual modes (§3); strict modes tolerate
  more friction.

Modes are the *strictness dial* that the whole wave reads. RULE-004 grades its review sheet by
`allowedInformality`; GAME-002 reads `pacing`; RULE-006 is gated by `semanticClassification`;
BR-003 reads mode demands for `mode_demands_response`.

---

## 10. Semantic AI minimal-call strategy (cross-link RULE-006)

**Cross-link: RULE-006 — Semantic AI metadata strategy (research / design only), issue [#116](https://github.com/kyleruff1/cDiscourse/issues/116).**

RULE-006 is itself a **design-only** card. It designs a minimal, feature-flagged,
mocked-by-default semantic AI layer that produces classification *metadata* — and ships **zero
production AI calls in v1**. This section summarizes the strategy; the master design doc is
`docs/designs/RULE-006.md` (produced by that card).

### The doctrine floor for any AI in CDiscourse

- AI never decides who is right (doctrine rule 4).
- AI never blocks an ordinary post.
- AI never runs on the client — calls live **only** in Supabase Edge Functions (doctrine rule 7).
- `authoritative` is **always `false`** for any AI-sourced flag.
- All calls are feature-flagged, mocked by default in tests, fixture-driven in development. Live
  calls are operator-gated.
- Keyword-only detection is not enough — but the AI is never the *sole* gate either.

### The minimal-call strategy

- **Classify at post-submit only.** No keystroke calls, no draft-edit calls. A cost-bound test
  asserts no call fires on draft-edit events.
- **Pre-send classification is limited to strict modes**, and opt-in by the room creator
  (gated by GAME-003's `semanticClassification` field).
- **Batch and cache** by `{ argumentId, parentId, contentHash }` so the same content is never
  re-classified.
- The output is a `SemanticMetadata` enum object (`responseToParent`, `introducesNewIssue`,
  `asksForEvidence`, `narrowsClaim`, `shiftsToPersonOrIntent`, `quoteSourceMismatchRisk`,
  `satireParodyAsEvidence`, `citesRetraction`, `suggestedSideBranch`, `confidence`, …,
  `authoritative: false`).

### False-positive mitigation (the §3 / §4 link)

Every AI metadata field is **paired with a deterministic derivation** when one is available. The
AI result is reconciled against the deterministic one; conflicts surface as `confidence: 'low'`.
The user gets a manual override surface — they can edit the channel / tangent classification on
their *own* move. This is what makes a future AI layer survivable: it is advisory, reconciled,
overridable, and never the gate.

### Provider direction — an open operator decision (§19)

RULE-006 flags one operator decision: provider strategy. Candidates: (a) Anthropic Haiku 4.5
default with a provider-agnostic abstraction (RULE-006's recommendation), (b) an MCP-hosted
classifier, (c) provider-agnostic abstraction with no default until a live pilot. The repo
already carries a related note at `docs/ai-provider-decision.md`; the operator should reconcile
the two before any RULE-006 *implementation* card is filed.

---

## 11. Evidence interaction strategy (cross-link EV-005)

**Cross-link: EV-005 — Evidence-to-evidence interaction (annotations on evidence), issue [#120](https://github.com/kyleruff1/cDiscourse/issues/120).**

EV-005 treats **evidence as a first-class object** that can be responded to with more evidence or
context. It builds directly on the shipped EV-001 evidence object model and EV-002 source-chain
popover.

### Evidence annotations

EV-005 adds an `EvidenceAnnotation` — an annotation attached to an `EvidenceArtifact` — drawn
from an 18-tag closed vocabulary: `primary_source`, `secondary_analysis`, `quote_attached`,
`source_missing_quote`, `quote_disputed`, `context_requested`, `retraction_attached`,
`source_later_updated`, `satire_parody_context`, `screenshot_only_chain_weak`,
`misreporting_alleged`, `translation_context_issue`, `outdated_source`, `methodology_dispute`,
`broken_link`, `paywalled_source`, `conflicting_source`, `source_chain_anchored`.
`summariseAnnotations(annotations)` rolls these into a `statusChip` (`anchored` / `conflict_open`
/ `context_open` / `paywalled` / `broken` / `unknown`).

### The non-accusation rule

This is where evidence work most easily drifts into a verdict, so EV-005's doctrine is explicit:

- **No "dishonesty" / "liar" / "fake" / "fraud" labels on users.**
- "Evidence of dishonesty" copy is replaced with **"contradictory record"**, **"retraction
  attached"**, **"source conflict"**, **"context requested"**.
- The `misreporting_alleged` tag's user-facing copy is the neutral **"alternate account exists"**
  — it describes a *record state*, never accuses the author.
- Source-chain status stays a gameplay / inspection signal, not a truth verdict.
- Popularity / view count is **never** evidence (doctrine rule 3).

### Anti-infinite-regress

Evidence annotation depth is capped at one level (the issue body says "2 or 3, then force a
synthesis"; the EV-005 scope locks the v1 cap at **one level**). Beyond the cap, the UI surfaces
a "Summarise this evidence thread" prompt that feeds a synthesis move — friction with a payoff
(§5). `evidenceAnnotationDepthCap.test.ts` proves it.

### Schema posture

EV-005 ships **no DB migration in v1**. Annotations live as `meta.attached_evidence` payload
extensions on existing arguments — the same pure-TS adapter pattern EV-001 established. A
dedicated `evidence_annotations` table is a v2 candidate and does not ship in this card.

---

## 12. How these features preserve natural argument

A recurring failure mode for "structured discourse" products is that the structure *replaces* the
argument — users end up filling in a form instead of actually disagreeing. This wave is
deliberately designed so structure *carries* natural argument rather than caging it:

- **Free text is always the body.** Channels (RULE-005), structured field helpers, and modes
  never replace the message body. The helper fields are *optional* in casual modes. A user can
  always just type what they mean.
- **"You had to be there" is a first-class mode.** GAME-003 includes `recollection_disconnect`
  precisely so informal, context-dependent, memory-based disagreement is a *supported* shape, not
  an error.
- **Casual mode allows slang and natural speech.** GAME-003's `allowedInformality: 'permissive'`
  and the casual-mode default of *no pacing* and *info-only advisories* mean a friendly argument
  feels like a friendly argument.
- **Suggestions explain themselves.** Channel suggestions (RULE-005) and tangent assessments
  (BR-003) always expose a `reason`. The app never silently reshapes a move; it proposes, with a
  rationale, and the user decides.
- **The user is always the author.** AI may *suggest* a channel or a tangent classification;
  per doctrine rule 4 it never modifies content, and RULE-006 gives the user a manual override on
  their own move's classification.
- **Concession and synthesis are moves, not losses.** The point-standing economy
  (`docs/point-standing-economy.md`) treats a concession as a *scoring repair, not a scoring
  defeat*. Narrowing a claim lifts the broad point. Natural argument includes giving ground;
  CDiscourse rewards it.

The test of "natural argument preserved" is simple: a two-person casual disagreement should feel
*lighter* than a court-mode exchange, and a court-mode exchange should feel *deliberate* — both
should feel like the people are actually arguing, not operating software.

---

## 13. How these features avoid feeling like a cage

A "cage" is what the product becomes if friction is mandatory, opaque, or punitive. The wave's
anti-cage guarantees, restated as a checklist a reviewer can hold each card against:

1. **Nothing soft ever blocks.** Only the small, fixed set of *structural* blocks gates a post
   (§4). Every advisory — topic drift, broad claim, tangent risk, channel mismatch, semantic
   metadata — is escapable. "Post anyway" and "Save draft" are always present (§5).
2. **Friction is consented and visible.** Modes are accepted by both parties at room setup
   (§9). Pacing rules are shown before entry and remain on screen (§8). There is no hidden
   constraint.
3. **The redirect describes the move, not the person.** BR-003 never accuses a user of dodging;
   it routes a *move* to a side branch (§7). No card in this wave produces a person-label — the
   ban-list (§20) enforces it.
4. **Casual is genuinely casual.** The casual-mode defaults — no pacing, info-only advisories,
   permissive informality — mean the lightest mode has almost no friction at all (§3, §12).
5. **Every constraint has a payoff.** Friction-with-payoff (§5) is not a slogan; it is an
   acceptance criterion — every advisory must ship at least one transformation action.
6. **The AI is not a warden.** RULE-006's AI never blocks, never decides, never runs on the
   client, and is always overridable (§10). There is no silent authority.
7. **Off-path content is parked, not deleted.** Doctrine rule 8: arguments are never
   hard-deleted. A tangent goes to a collapsed-but-visible side branch (§7).

A cage feels mandatory, silent, and accusatory. This wave is opt-in, visible, and move-focused.

---

## 14. How these features keep people from reverting to SMS

The competitive baseline for a 1v1 disagreement is not another debate app — it is the **text
thread the two people would otherwise use**. (PM-004 maintains the full competitive research; see
§15. The PM-004 companion research files it references do not exist in the repo yet — PM-004
creates them.) If CDiscourse is more annoying than SMS, users revert. The wave is designed so the
structured surface is *worth* the extra structure:

| What SMS does badly | What this wave does instead |
| --- | --- |
| The thread is linear; a side topic derails the main one permanently. | BR-003 routes side issues to a visible, collapsible side branch — the mainline stays clean and the tangent is still pick-up-able. |
| No record of what was actually conceded or resolved. | LIFE-001 lifecycle states + the point-standing economy make concession, narrowing, and synthesis legible moves. |
| Messages are disposable; nothing feels consequential. | GAME-002 pacing + the permanent record make a move *count* — without becoming punitive (§8). |
| Evidence is a pasted link no one re-reads. | EV-001 / EV-002 / EV-005 make evidence a first-class, annotatable object with a visible source-chain status. |
| It is easy to talk past each other. | RULE-005 channels make the *shape* of each move explicit; RULE-004 catches a move that does not respond to its parent before it lands. |
| Re-entering an old argument means scrolling a wall of text. | The Timeline / Cards board (the board pivot) lets a user see the whole fight in seconds and jump to the unresolved point. |

The crucial constraint, also from PM-004's doctrine: the wave must **beat SMS, not out-friction
it**. Every feature in this wave has to make the structured surface feel *better* — clearer,
fairer, more resumable — than the unstructured one. If a card makes the app feel heavier than a
text thread for a *casual* disagreement, that card has failed its acceptance bar, regardless of
how correct the structure is.

---

## 15. Child issue map

Built from the live GitHub issue list (`gh issue list --repo kyleruff1/cDiscourse`, retrieved
2026-05-20). Each row maps a card code → its issue number → primary file boundaries → its
dependencies. "State" reflects the GitHub issue state at retrieval time.

| Card | Issue | State | Epic / Release | Primary file boundaries | Depends on |
| --- | --- | --- | --- | --- | --- |
| **PM-003** (this doc) | [#121](https://github.com/kyleruff1/cDiscourse/issues/121) | open | Project Mgmt / 6.6 | `docs/research/playable-argument-modes.md` (new), `docs/designs/PM-003.md` (new) | None — lands first as the map |
| **COMPOSER-002** | [#111](https://github.com/kyleruff1/cDiscourse/issues/111) | open | Sidecar Rail / 6.5 | New `ArgumentComposerDock.tsx`; modify `App.tsx`, `ArgumentComposer.tsx`, `ArgumentTreeScreen.tsx` | TL-003 (shipped), SC-004 + COMPOSER-001 (shipped, #63/#84) |
| **SC-005** | [#112](https://github.com/kyleruff1/cDiscourse/issues/112) | open | Sidecar Rail / 6.5 | `ArgumentSideActionRail.tsx`; modify `App.tsx` (remove redundant `actionBar`) | SC-002 popover (shipped), IX-001 area-click model |
| **VG-004** | [#113](https://github.com/kyleruff1/cDiscourse/issues/113) | **closed (Build complete)** | Visual Grammar / 6.6 | `ArgumentTimelineMap.tsx`, `BranchCollapseStub.tsx`, `designTokens.ts`, new `timelineNodeVisualModel.ts` | VG-001 (shipped), VG-002 (surface lock), BR-001 (closed, #7) |
| **RULE-004** | [#114](https://github.com/kyleruff1/cDiscourse/issues/114) | open | Rules UX / 6.6 | New `preSendReviewModel.ts`, `PreSendReviewSheet.tsx`; modify `ArgumentComposerDock` | COMPOSER-002; LIFE-001/META-001 (closed #61/#62); RULE-001/003 (#32/#65) |
| **RULE-005** | [#115](https://github.com/kyleruff1/cDiscourse/issues/115) | open | Rules UX / 6.6 | New `channelModel.ts`; composer dock channel chip row | COMPOSER-002; LIFE-001/META-001; RULE-001/003 |
| **RULE-006** | [#116](https://github.com/kyleruff1/cDiscourse/issues/116) | open | Rules UX / 6.7 | **Design-only:** new `docs/designs/RULE-006.md`; designs `semanticMetadataModel.ts` (not built here) | LIFE-001/META-001; RULE-004; RULE-005; BR-003 |
| **BR-003** | [#117](https://github.com/kyleruff1/cDiscourse/issues/117) | open | Branches / 6.6 | New `tangentRoutingModel.ts`; UI inside `PreSendReviewSheet` | BR-001 (closed, #7); LIFE-001/META-001; RULE-004 |
| **GAME-002** | [#118](https://github.com/kyleruff1/cDiscourse/issues/118) | open | Rules UX / 6.7 | New `pacingModel.ts`, `PacingChip.tsx`; modify `ArgumentComposerDock`, `PreSendReviewSheet` | COMPOSER-002; GAME-003 mode templates |
| **GAME-003** | [#119](https://github.com/kyleruff1/cDiscourse/issues/119) | open | Rules UX / 6.7 | New `argumentModeModel.ts`; mode setup screen; design doc `docs/designs/GAME-003.md` | GAME-002; RULE-004; RULE-005; BR-003; RULE-006 design |
| **EV-005** | [#120](https://github.com/kyleruff1/cDiscourse/issues/120) | open | Evidence / 6.7 | Modify `evidenceModel.ts`, `SourceChainPopover.tsx`; new `EvidenceAnnotationChip.tsx` | EV-001/EV-002 (shipped, #14/#15); META-001 (closed, #62) |
| **PM-004** | [#140](https://github.com/kyleruff1/cDiscourse/issues/140) | open | Project Mgmt / 6.6 | Docs-only: PvP market-research artifact (companion files not yet in repo — PM-004 creates them) | None blocking; informs every PvP card |

### Sibling cards already closed / merged

- **VG-004 (#113)** is **closed** — Build complete (`docs/designs/VG-004.md` exists; the
  `ux-ui-project-board.md` VG-004 entry records the landed scope). It is in this wave's
  cross-links because PM-003's issue body enumerates it, but it needs no further design work.
- The wave's *upstream foundations* are also already done and must not be redone:
  **BR-001 (#7)**, **LIFE-001 (#61)**, **META-001 (#62)**, **SC-004 (#63)**,
  **COMPOSER-001 (#84)**, **EV-001 (#14)**, **EV-002 (#15)**, **RULE-001 (#32)**,
  **RULE-002 (#33)**, **RULE-003 (#65)** — all show as closed on GitHub.

### Note on the PvP-roadmap sibling wave

PM-004 (#140) belongs to a parallel **PvP argument-game roadmap expansion** (GAME-004…GAME-008,
BR-004, RULE-007 — issues #141–#147, all open). That wave overlaps the composer / room / rules
surface this document covers and shares doctrine, but its cards are out of PM-003's enumerated
scope. PM-004 is included in this map because PM-003's issue body lists it; the GAME-004+ cards
are noted here only so a future contributor sees the seam.

---

## 16. Dependency graph

All edges are "must be in Build or Done before". Closed/shipped foundations are marked `[done]`.

```
[done] TL-003 ────────────────┐
[done] SC-004 ── COMPOSER-001 ─┤
                               ▼
                        COMPOSER-002 (#111)  ── the dock host ──┐
                               │                                │
        ┌──────────────────────┼───────────────┐                │
        ▼                      ▼               ▼                │
   RULE-004 (#114)        RULE-005 (#115)   GAME-002 (#118)      │
   pre-send review        channels          pacing              │
        │                      │               ▲                │
        │                      │               │                │
        ▼                      │          GAME-003 (#119) ◄──────┘
   BR-003 (#117)  ◄─────────────┘          mode templates
   tangent routing                             │
        │                                      │
        └──────────────┬───────────────────────┘
                        ▼
                  RULE-006 (#116)  — design-only; depends on
                  RULE-004 + RULE-005 + BR-003 being designed

[done] BR-001 ──► BR-003            (branch model is BR-003's foundation)
[done] LIFE-001 + META-001 ──► RULE-004, RULE-005, BR-003   (lifecycle + tags = the signals)
[done] RULE-001 + RULE-003 ──► RULE-004, RULE-005           (plain-language maps)
[done] EV-001 + EV-002 ──► EV-005                            (evidence object + popover)
[done] META-001 ──► EV-005                                   (annotation tags align to tag taxonomy)

SC-005 (#112)  — depends on SC-002 popover [done] + IX-001 area-click model; independent of the
                 RULE-004/005/006 chain. Pairs visually with COMPOSER-002.
VG-004 (#113)  — [closed / Build complete]. No remaining dependency for this wave.
PM-003 (#121)  — this doc. No dependency; lands first as the navigation map.
PM-004 (#140)  — docs-only; no blocking dependency; informs every PvP card.
```

### Reading the graph — critical observations

1. **COMPOSER-002 is the keystone.** RULE-004, RULE-005, and GAME-002 all mount UI into the
   composer dock. None of them can ship until COMPOSER-002 lands the dock. COMPOSER-002 itself is
   *unblocked* (its dependencies TL-003 / SC-004 / COMPOSER-001 are all shipped).
2. **RULE-004 is the second keystone.** BR-003 and GAME-002 both render UI *inside* the
   `PreSendReviewSheet`. RULE-004 must be designed (and ideally in Build) before they execute.
3. **GAME-003 is mutually entangled.** GAME-003 depends on GAME-002 / RULE-004 / RULE-005 /
   BR-003 / RULE-006 design — but GAME-002 and RULE-004 also read GAME-003's mode fields. The
   resolution (already baked into the card bodies): GAME-002 and RULE-004 ship with a hardcoded
   `casual` default; GAME-003's mode templates wire in afterward. The mode *field shapes* must be
   frozen early so the others can code against them.
4. **RULE-006 is a leaf.** It is design-only and depends on the *designs* of RULE-004 / RULE-005
   / BR-003, not their builds. It can be designed in parallel with their implementation.
5. **SC-005 and VG-004 are off the critical path.** They improve the same board surface but do
   not gate the rules chain. SC-005 can run any time after SC-002/IX-001; VG-004 is done.

---

## 17. First three implementation slices

The wave is large. The recommended execution order, slicing for "unblocks the most / lowest
risk first":

### Slice 1 — Unblock the composer (foundation)

- **COMPOSER-002** (#111) — in-room composer dock; remove the "Your Move" page redirect.
- **SC-005** (#112) — collapse the observer action grid into a contextual dock.
- *Why first:* COMPOSER-002 is the keystone for the entire RULE-004/005 + GAME-002 chain and is
  fully unblocked today. SC-005 pairs with it visually and is independent of the rules chain, so
  it parallelizes cleanly. VG-004 is already done and needs no slice.
- *Exit criteria:* no normal-user action routes to a full-page screen; the dock mounts in
  Timeline and Cards; the observer dock is collapsed-by-default; all existing composer tests plus
  the new dock tests pass.

### Slice 2 — The friction core

- **RULE-004** (#114) — `preSendReviewModel` + `PreSendReviewSheet`, mounted on the dock from
  Slice 1. Ships with a hardcoded `casual` default mode.
- **RULE-005** (#115) — `channelModel` + the composer channel chip row.
- *Why second:* both depend only on COMPOSER-002 (Slice 1) plus already-closed foundations
  (LIFE-001, META-001, RULE-001, RULE-003). RULE-004 establishes the `PreSendReviewSheet` host
  that Slice 3 renders into.
- *Exit criteria:* the review sheet shows for advisories and structural blocks; "Post anyway" and
  "Save draft" always present unless a structural block; channel suggestion derivation is
  deterministic and explained; the keyword-no-block tests and copy ban-list tests pass.

### Slice 3 — Routing, pacing, and modes

- **BR-003** (#117) — `tangentRoutingModel`, rendered inside the RULE-004 sheet from Slice 2.
- **GAME-002** (#118) — `pacingModel` + `PacingChip`, mounted on the Slice 1 dock; permanent-
  record copy into the Slice 2 sheet.
- **GAME-003** (#119) — `argumentModeModel` + the four MVP mode templates + mode setup screen
  design; this is where GAME-002's `casual` default and RULE-004's grading get wired to real
  modes.
- *Why third:* all three render into surfaces built by Slices 1–2. GAME-003's four-template slice
  closes the loop (modes drive pacing and review-sheet strictness).
- *Exit criteria:* tangent risk surfaces as a "Send to side branch" action and never blocks;
  pacing is visible and casual mode has none; the four mode templates ship as data with all
  required fields; sensitive-mode disclaimers present; all ban-list tests pass.

### After the slices

- **EV-005** (#120) is independent of the composer chain (it builds on shipped EV-001/EV-002) and
  can land in parallel with any slice, or after Slice 3.
- **RULE-006** (#116) is design-only and can be designed in parallel with Slice 2/3; its
  *implementation* is a separate, later, operator-gated card — see §18.

---

## 18. Items explicitly NOT for the agent runner right now

These are real, related, and roadmap-tracked — but they must not be picked up as agent build work
in this wave. Listing them here prevents scope creep when an implementer reads a card and sees an
adjacent opportunity.

1. **RULE-006 *implementation*.** RULE-006 (#116) is a *design-only* card — its deliverable is
   `docs/designs/RULE-006.md`. The actual semantic AI Edge Function, the live provider call, and
   the production wiring are a **separate, later, operator-gated card** that does not exist yet.
   No agent should write a production AI call (doctrine rule 7).
2. **HOST / operator-only cards.** The entire Epic 10 hosting slate
   (HOST-001 … HOST-008, HOST-SIMPLE-001) involves `gcloud` / `docker` / DNS / Secret Manager
   steps that are *operator-run by design* — the agent never executes deploy commands. Most are
   already closed or Build-complete-awaiting-operator. They are out of this wave entirely.
3. **META-1D — Six-month vocabulary review** (#79). A scheduled manual + auto code review. It is
   a *calendar-driven operator task*, not agent build work, and is on Release 6.8.
4. **The full GAME-003 mode set.** Only the **four** MVP templates ship in v1. The other ~9 modes
   ship as `design_only` stubs. An implementer must not flesh out all 13.
5. **Any DB migration in this wave.** GAME-002 pacing state is in-memory; EV-005 annotations live
   in the existing `attached_evidence` payload; RULE-005 channel tags are render-time META-001
   tags. No card in this wave ships a migration. (Persistent pacing and an
   `evidence_annotations` table are explicitly named as later cards.)
6. **PM-004's external publication / marketing.** PM-004 (#140) maintains an internal research
   doc. Marketing copy, positioning statements, and external publication are explicitly
   non-scope.
7. **The PvP slate (GAME-004…GAME-008, BR-004, RULE-007 — #141–#147).** A parallel wave with its
   own design cards. Not part of PM-003's enumerated scope.
8. **Anything on the v1 do-not-build list (doctrine rule 10):** voting / winner scoring,
   real-time collaborative body editing, OAuth, public API, push notifications, argument search.
   GAME-002's "your turn" must stay an in-room countdown, never a push notification.

---

## 19. Open product questions for the operator

These are decisions the wave **cannot proceed cleanly without**, but which are the operator's to
make — not the design pipeline's. **This section captures and documents them; it does not answer
them.** Each card that needs a given answer is noted. Recommendations carried from the sibling
issue bodies are repeated here as *input to the decision*, not as the decision.

1. **Canonical origin of an argument mode.** Where is an argument's mode decided and stored — at
   room creation only, or can it change mid-room? GAME-003's non-scope explicitly excludes
   "cross-mode migration of an in-progress room" and "persisting mode choice in the database",
   which implies mode is fixed at setup and in-memory in v1 — but the operator should confirm
   that this is the intended canonical model before GAME-003 ships its templates.
   *Needed by:* GAME-003, GAME-002.
2. **Admin / invite default for 1v1 rooms.** GAME-003's `ArgumentModeDefinition` carries
   `inviteOnly` and `observerModeAllowed`. Should a new 1v1 PvP room default to invite-only
   (private), or observable? This intersects the existing seamless-entry / observer-first
   doctrine (Stage 6.4 opens rooms in Observer mode). The operator should set the default per
   mode. *Needed by:* GAME-003, SC-005 (observer dock behaviour).
3. **User-facing copy for off-mainline routing.** BR-003 needs a user-facing label for a side
   branch. Candidates from the issue body: **"Side issue"** (BR-003's recommendation),
   "Off-path branch", "Parking lot", "Side orbit", "Separate thread". "Outer Realm" stays
   internal-only regardless. The operator must pick one. *Needed by:* BR-003.
4. **The four MVP argument modes.** GAME-003 recommends `casual_disagreement`,
   `court_record_strict`, `internet_fact_check`, `debate_club`. The operator may swap one for
   `political_debate` or `relationship_repair` — but the sensitive modes (`relationship_repair`,
   `co_parenting_custody`) require **disclaimer copy approval** (non-legal / non-therapy). The
   operator must confirm the four and approve any sensitive-mode disclaimer text.
   *Needed by:* GAME-003.
5. **Semantic AI provider direction.** RULE-006 flags one decision: provider strategy —
   (a) Anthropic Haiku 4.5 default with a provider-agnostic abstraction (RULE-006's
   recommendation), (b) an MCP-hosted classifier, (c) provider-agnostic abstraction with no
   default until a live pilot. The repo also carries `docs/ai-provider-decision.md`; the operator
   should reconcile that note with RULE-006's recommendation before any RULE-006 *implementation*
   card is filed. *Needed by:* RULE-006 (design), and the later RULE-006 implementation card.
6. **(Forward-looking, research-only.) Does the product ever surface a resolution / "who made
   the stronger case" readout?** This is the operator's stated long-term ambition area and is
   *not a v1 feature*. v1 doctrine (rule 1, rule 10) forbids any winner / verdict output. If the
   operator ever wants a resolution-style readout, it must (a) be a deliberate doctrine decision,
   (b) route through the point-standing economy as *gameplay standing*, never objective truth,
   and (c) get its own design card. Captured here only so the question is on the record. The
   parallel card RULE-007 ("Doctrine decision — resolution and who-is-right language", #145)
   exists precisely to host this decision; PM-003 does not pre-empt it.

---

## 20. Test strategy and false-positive measurement plan

PM-003 itself ships no automated tests — it is a research doc, gated by review (see
`docs/designs/PM-003.md`). This section is the *test doctrine for the wave* the document maps, so
that each child card's implementer inherits a consistent bar.

### 20.1 Test layout (per `docs/` test discipline)

- **Pure models** (`preSendReviewModel`, `channelModel`, `tangentRoutingModel`, `pacingModel`,
  `argumentModeModel`, the `evidenceModel` EV-005 extension, the RULE-006 fixture provider) get
  exhaustive unit suites under `__tests__/`. Pure-TS, deterministic, no network, no Supabase, no
  React.
- **UI surfaces** (`PreSendReviewSheet`, `PacingChip`, `EvidenceAnnotationChip`,
  `ArgumentComposerDock`, the SC-005 dock) get behaviour tests — render, escape-closes, tap
  targets, reduce-motion.
- **Tests are part of "done", not a follow-up.** A card is not complete until its named test
  files pass.

### 20.2 The wave-wide copy ban-list

Every card in this wave produces user-facing strings, and every card must ship a ban-list test.
The banned token set, drawn from doctrine rule 1 and the sibling card bodies:

> winner · loser · correct · true · false · liar · lying · dishonest · dishonesty ·
> bad faith · manipulative · manipulation · extremist · propagandist · stupid · idiot ·
> troll · bot · fake · fraud · dodging

The ban-list test scans **every produced string** — labels, helper lines, advisory
`plainLanguage`, channel purposes, mode names, mode disclaimers, tangent reasons, evidence
annotation copy. Named test files already specified by the cards: `preSendReviewBanList.test.ts`,
`channelCopyBanList.test.ts`, `tangentRoutingNoPersonLabel.test.ts`, `pacingCopyBanList.test.ts`,
`argumentModeBanList.test.ts`, `evidenceAnnotationBanList.test.ts`. EV-005's ban-list test
carries a *special focus*: "misreporting" / "dispute" copy must not drift toward "liar".

This ban-list must **not contradict `cdiscourse-doctrine`** — it is a strict superset of the
doctrine rule-1 list, which is the intended relationship.

### 20.3 The false-positive measurement plan

False positives are the product's existential risk (§3). The wave does not just *avoid* them by
intent — it *measures* them. The plan:

1. **A keyword-no-block invariant, per card.** Each gating card ships a test proving that
   matching a curated keyword list never produces a `structuralBlock`:
   `preSendReviewNoBlockOnKeywords.test.ts`, `channelNoKeywordBlock.test.ts`,
   `tangentRoutingNoBlock.test.ts`, `pacingNoHiddenBlock.test.ts`. This is the §4 contract,
   enforced.
2. **A "benign corpus" false-positive rate.** Build a fixture corpus of *known-fine* moves —
   ordinary on-topic replies, casual slang, "you had to be there" recollection, legitimate
   scope challenges that happen to use flagged words. Run it through `preSendReviewModel`,
   `channelModel.suggestChannelFromDraft`, and `tangentRoutingModel.assessTangentRisk`. Measure:
   - **Hard-block false-positive rate on the benign corpus must be 0%** — a benign move must
     *never* hit a structural block.
   - **Soft-advisory false-positive rate** (a benign move triggering a `soft`-severity advisory)
     should be tracked and kept low; `info`-severity advisories on benign moves are acceptable
     because they auto-dismiss in casual mode. The corpus is the regression guard: a code change
     that raises the soft-advisory rate on the benign corpus is a regression.
3. **A "should-advise" corpus for the inverse.** A second fixture corpus of moves that *should*
   draw an advisory (a genuinely broad claim, a genuine off-topic drift, an explicit Evidence
   post with no source). Measure the **false-negative rate** — the wave must not buy a 0% false
   positive by silencing every signal.
4. **Mode-graded expectations.** The same benign corpus run under `casual_disagreement` vs
   `court_record_strict` must show *strictly fewer* surfaced advisories in casual mode. This is
   the §3 / §9 grading, made testable.
5. **Cost-bound test for RULE-006.** A test asserts the future semantic layer makes **no call on
   draft-edit events** — false-positive risk and cost are both controlled by classifying at
   post-submit only.
6. **Doctrine reconciliation review gate.** As a non-automated gate (mirroring PM-004's review
   gate), a reviewer confirms that the wave's "do not copy" list and false-positive avoidance
   rules do not contradict `cdiscourse-doctrine`. This document's §1, §3, §4, and this section
   are the artifact that gate reviews against.

The single measurable headline for the wave: **on the benign corpus, the structural-block
false-positive rate is 0%, and the soft-advisory false-positive rate has a tracked budget that a
regression cannot silently exceed.** That is how "false positives kill the product" stops being a
slogan and becomes a CI check.

---

_End of research doc. This is the navigation map for the RULE-004 / RULE-005 / RULE-006 /
BR-003 / GAME-002 / GAME-003 / EV-005 / COMPOSER-002 / SC-005 / VG-004 wave. Keep §15 and §19
current as the sibling cards land and as the operator answers the open questions._
