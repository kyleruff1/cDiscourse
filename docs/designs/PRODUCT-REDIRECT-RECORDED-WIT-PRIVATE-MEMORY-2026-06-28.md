# PRODUCT-REDIRECT-001 — Recorded Wit, Private Memory, and Single-Composer UX

**Design / roadmap redirect · authored 2026-06-28 · design-only (no code, no provider spend, no data mutation)**

Tracking epic: `PRODUCT-REDIRECT-001` (GitHub). This document is the canonical design substrate; the epic and its child issues cite it.

> **Status of this document.** This is a *direction-setting* design doc produced under an explicit operator gate. It changes no code and mutates no data. It re-orders the near-term roadmap around one product superpower and defines the issue tree to execute it. Individual features still require their own design docs before implementation.

---

## 1. Executive summary

### The pivot

CDiscourse has spent its build so far proving a hard thing works: a versioned Constitution, a recursive argument tree, a nine-family machine-observation layer (A–I in production), an anti-amplification point-standing economy, and a private-room + invite substrate — all with strong test coverage and a reliable MCP/classifier backend. That backend is now dependable enough to *serve product*, not just to be verified.

The pivot is to stop treating CDiscourse as a generic public debate arena and start treating it as **the place where private, evidence-backed conversations with people you actually know become a durable, remixable, cumulatively more valuable record.**

### Vision language (north star)

> **CDiscourse turns arguments with friends into something better than conversation. Your sharpest lines, cleanest concessions, best receipts, and funniest callbacks become a shared, remixable record you can actually build on. Wit lasts. Memory improves. Banter gets better over time.**

### Why this beats generic debate

A public debate arena competes with every comment section on the internet and inherits their pathologies: strangers, dunking, popularity-as-signal, and no reason to be careful. Its best moments evaporate.

CDiscourse's real, defensible superpower is the *opposite*: structured, **persistent, cross-referenceable, evidence-backed** conversation among a **known, private** group. When the group is small and trusted, people are willing to be careful — to concede cleanly, to bring receipts, to build a callback three rooms later. And because the Constitution + tree + evidence model already preserve exact structure, those careful moments don't disappear. They become artifacts: linkable, remixable, and funnier/sharper on the second and third pass.

The best parts of in-person argument — the perfect callback, the graceful concession, the receipt that lands, the recurring inside joke — normally evaporate. Here they compound.

### Why private/group memory is the soul

Three findings from the current-state audit make this the right bet:

1. **The substrate for it already exists and is mostly *dark* (built but unwired).** Cross-room linking (QOL-042) is a complete, tested, deployable table + trigger + RLS + API + model + chip that has **never been threaded into a live room**. `targetExcerpt` (quote-the-parent) is already captured and persisted per-argument. Private-first is already the *default* at room creation (QOL-039 one-way visibility + ARG-ROOM-002 seats + QOL-038 invite lifecycle). We are closer to "recorded wit" than the roadmap has ever acknowledged.
2. **The genuinely missing pieces are exactly two, and they are the soul:** a persistent **friend-group / social graph** (today invites are ephemeral, email-keyed, single-seat, per-room — there is no re-invitable group), and a **shared-memory / recorded-wit layer** (callbacks, lore, highlight reels — zero implementation footprint today). Nothing to redirect there; these are net-new epics.
3. **The apparatus is over-served and the conversation is under-served.** The machine layer is safe (raw family/rawKey codes never reach visible text; everything routes through a plain-language, advisory, verdict-free funnel) but it is *always-on and dense* — the active-card hub renders ~13 sections and the full A–I classifier grid with no tap, standing appears 4× on one screen, and the room start is a multi-section survey. The delight is buried under machinery.

The strategy writes itself: **make private groups the home, make starting a room feel like one composer, turn the machine layer into a few friendly optional flags, light up the dark cross-room substrate as "callback weaving," and let the record accumulate into shared lore.**

---

## 2. Current-state diagnosis

Grounded in a five-surface read-only audit of `src/**`, `supabase/**`, `mcp-server/**`, and the open issue set. File anchors are real.

### 2.1 Start-room friction

- **Live create surface:** `src/features/arguments/startArgument/StartArgumentPage.tsx` (declaration-first — the typed declaration *becomes* the root argument; title is derived via `pickDisplayTitle`, never a separate field). This part is already aligned with the north star.
- **But it is a survey.** Below the declaration it renders an "Optional framing" block of **three single-select taxonomy groups** (argument scheme; disagreement strategy, itself split into labelled clusters; disagreement cause) — `StartArgumentPage.tsx:457–520`, options in `startArgumentTaxonomy.ts`. All optional, all disclaimed as non-authoritative, and collectively the largest visual mass on the screen.
- **Default-Private is a hidden gate.** `visibility` defaults to `'private'` (`:127`), and Private is invalid until an invite email is added — so the submit button is *dead* until the user transacts with the invite/visibility system (`:186–187`). A user who just wants to post a point must first make an invite decision.
- **An extra screen tap.** Private/invite creation shows a one-time invite-link "Continue" screen (`:270–322`) between "Start argument" and landing in the room.
- **Practical floor:** 2 required decisions (point + visibility resolution) + submit, plus up to +1 "Continue" tap. The legacy multi-field `CreateDebateForm` is already off the live path (dead-gated behind `{false && …}` in `App.tsx:985`).

### 2.2 Reply composer is half-migrated

- The **OneBox** chassis (`src/features/arguments/oneBox/OneBox.tsx`, state machine `boxModel.ts`) is the right north-star structure: one switchable box, an `ActPopout` flash menu that re-types it, non-destructive per-mode drafts, and **parent inferred from the node the user acted on** (`handleReply` → `replyTarget` → `selectedParentId`/`parentArgument`; no parent-picker exists).
- **But the inner `ArgumentComposer.tsx` still forces explicit `argumentType` + `side` pickers** as always-visible required selects (`canSubmit` gate at `:188–195`; fresh draft nulls both at `composerHelpers.ts:30–31`). The OneBox already opens typed as "Respond" from the flash menu, so the user is asked to re-declare the same intent. This is the biggest "still a form" surface in the reply path.

### 2.3 Public/admin/apparatus leaking into the core loop

- **Home is a public marketplace.** `ConversationGalleryScreen.tsx` is the app home: a searchable/paginated grid of *many rooms to join*, heat/temperament pills, 9 discovery lanes ("Jump into a live dispute", "Hot but unresolved"…), subtitle "find a room to join." Primary nav defaults to `browse_arguments` (`appPrimaryNavModel.ts`). This is a stranger-marketplace IA, not a friend-group home.
- **The active card is larger than the message.** `cardView/CardDetailPanel.tsx` renders ~13 always-visible sections including the **entire A–I classifier grid, uncapped** (`HubClassifierZone:252–304`). Standing appears **4×** on one screen (timeline band, score tracker, Standing/Tone/Heat strip, Standing zone); evidence 3×; "next move" guidance 3×.
- **A permanent parallel panel.** `mediator/DisagreementPointsRail.tsx` (1255 lines) is a full second information architecture, docked as a persistent 380px pane on tablet/wide.
- **Dead/legacy surfaces still present:** `DebateListScreen.tsx` (admin-style sortable table, dead-gated), `CreateDebateForm.tsx` (multi-field, public-default, only consumed by the dead table), `JoinDebatePanel.tsx` (full-screen "choose your side" modal).

### 2.4 The underused superpower

- **Cross-room linking is built and dark.** QOL-042 (`crossRoom/linkedPriorArgumentModel.ts`, `argumentRoomLinksApi.ts`, `LinkedPriorArgumentChipRow.tsx`, migration `20260521000010`) ships a complete one-directional immutable room→room reference with soft-delete, idempotent create, three-state RLS-derived access (`authorized`/`title_only`/`unavailable`), and a rendered chip — but `ArgumentGameSurface.tsx:2305–2349` never passes the props `ArgumentTimelineMap` already accepts (`linkedPriorChips`, `onOpenLinkedPrior`, `onViewLinkedPriorContext`). No create-link picker exists.
- **`targetExcerpt`** (quote-the-parent) is captured in the composer and persisted as `arguments.target_excerpt` — the exact substrate a callback feature needs.
- **No memory index and no argument search** (the latter is an explicit v1 non-goal to reconcile — see §11).

### 2.5 What is NOT broken (preserve, don't "fix")

- **Machine-layer copy safety is a strength.** Raw family letters / rawKeys / snake_case never reach visible text — `familyCode` is used only as a React `testID`; everything routes through `gameCopy.toPlainLanguage` (600+ codes → prose, unknown → suppressed) plus `refereeBannerLibrary`/`selectBanner`, `standingBandCopy`, `mediatorPlainLanguage`, `messageQualifiers`, all ban-list-tested for verdict tokens. The redesign **builds on** these, it does not replace them.
- **Admin surfaces are correctly role-gated** (`isAdmin={false}` hardcoded in the default room view; admin tabs gated on `role==='admin'`).
- **One doctrine-adjacency flag to decide on:** `inferStandingBand` (`argumentGameSurfaceModel.ts:976–1011`) maps AI flag codes to nine bands whose *internal enum keys* are truth-shaped (`pretty_wrong`, `completely_right`), softened at render by `standingBandCopy`. The rendered copy is safe, but **every default-timeline node gets an AI-flag-driven strength color/glyph** — the closest thing to a per-message verdict in the default UX. §8 proposes retiring per-node strength coloring by default.

---

## 3. Product principles

1. **One composer first.** A new room starts with one box; no setup survey, no required visible options. Type and go.
2. **Progressive modifiers.** Modifiers exist but are hidden by default (pop-out / drawer / "More context"). Modifiers never gate replying.
3. **Private memory is the delight.** Friend groups, private-invite collections, and persistent group lore are first-class; the record improves with time.
4. **MCP as friendly feedback.** Machine results become contextual, point-level, human-readable, optional flags — never raw family/rawKey jargon, never a grading dashboard, never verdict/moral language.
5. **Low-noise UI.** The default room view is calmer and lower-density; deep analysis lives behind progressive disclosure. Conversation first, apparatus second.
6. **Let old mistakes stay behind.** Retire or demote survey-style setup, public-first-as-home assumptions, and always-on apparatus rather than keeping unworkable paths alive because they exist.

Doctrine that constrains every principle above (unchanged, non-negotiable): the AI moderator never decides who is right, never assigns truth, never deletes/hides user content, and every AI-sourced flag is `authoritative: false`. Concession is a scoring *repair*, not a defeat. Popularity / virality / engagement is **not** evidence.

---

## 4. Core experience narrative — a day in the life

*Maya and Dev are in a private friend group called "The Standing Committee." Third member Priya mostly lurks.*

1. Maya opens CDiscourse. The home is **her group**, not a marketplace: a calm list of the group's recent rooms and one composer that says *"Start something."* No sort chips, no heat pills, no strangers.
2. She types one line — a claim about whether their city's new bike-lane data actually shows what the council says — and taps send. **That's the whole room-start.** No side, no type, no taxonomy, no visibility dialog (the group *is* the audience). The room opens.
3. Dev gets a nudge, opens the room, taps Maya's point, and the one composer opens pre-aimed at it as a reply. He disagrees on *scope*. He doesn't pick "rebuttal" or "Negative" from a menu — he just types; the box already knows he's responding.
4. A single friendly flag appears under Dev's point: **"Needs a receipt."** It's optional and dismissible. Dev taps it; the composer pre-fills an "ask for the source" move aimed back at Maya. (Under the hood this is Family D `asks_for_evidence` — Dev never sees "Family D.")
5. Maya remembers she made almost this exact argument two rooms ago with a good primary source. From her point she taps **Weave a callback**, searches the group's prior rooms, and pulls the exact excerpt + a link to that old room into her reply. The callback renders as a distinct linked echo. A tiny private celebration fires: **"Echo landed."**
6. Dev, cornered, concedes the narrow point cleanly ("fair — the 2019 baseline is the wrong comparison") while keeping his broader worry. The system marks it as a **clean concession** (Family G — a *repair*, not a loss). Maya taps **Remix this concession** to branch a lighter side-thread: *"okay but what if we went harder on the council's press office."* The main thread stays clean; the banter fork holds the absurdity.
7. Later, the group's **Private Lore Codex** has quietly gained three entries from this room: Maya's callback ("Callback material"), Dev's concession ("Savage but fair"), and one line Priya reacted to ("Accidental poetry"). Each links back to the exact tree context. Next month, "the bike-lane baseline thing" is an inside reference the whole group gets.

Every step above maps to existing substrate (parent inference, `targetExcerpt`, QOL-042 links, Family D/G observations, private rooms) plus the two net-new pillars (the group, the lore). Nothing in the narrative requires the machine layer to render a single raw code, a grading dashboard, or a verdict.

---

## 5. Feature concepts

Each concept lists: **user value · minimal UI · existing system hooks · MVP · later · risks · privacy · issue candidates.** The ordering below is conceptual, not priority (see §13).

### A. Quote Forge / Call-Back Weaver
- **User value:** the perfect callback — the exact old line, pulled into a new moment — is the single most "better than conversation" affordance. Wit that references shared history compounds.
- **Minimal UI:** from any point, a "Weave a callback" action opens a picker over the group's prior rooms; selecting a move pulls its exact excerpt + a link into the composer; it renders as a visually distinct linked echo. Optional micro-celebration ("Echo landed").
- **Existing hooks:** `targetExcerpt` capture path (`composerState.ts:19` → `composerSubmit.ts:94–98` → `submit-argument/index.ts:282,370`); **QOL-042 cross-room link substrate** (`argumentRoomLinksApi.createArgumentRoomLink`, `loadPriorRoomContext`, `buildLinkedPriorArgumentChip`; render seam `ArgumentTimelineMap.tsx:216–223` fed from `ArgumentGameSurface.tsx:2305–2349`, currently dark). The `ask_quote`/`ask_source` rail presets (`sourceChainPresetCopy.ts`) are the interaction precedent.
- **MVP:** light up the dark QOL-042 wire — thread `linkedPriorChips` into `ArgumentGameSurface`, add an in-composer "insert callback" that reuses `targetExcerpt` + creates an `argument_room_links` row; distinct echo rendering. Same-group prior rooms only.
- **Later:** cross-room callback *search*; reverse back-reference display ("this line was called back 3×"); "Echo landed" celebration; callback anniversaries (feeds Memory Lane).
- **Risks:** callback search collides with the "no argument search" v1 non-goal (§11) — scope search to *within the group's own rooms*, not global. Link privacy: a prior private room must leak only `title_only` per QOL-042's existing access model.
- **Privacy:** reuse QOL-042's three-state RLS-derived access (`authorized`/`title_only`/`unavailable`); never surface a prior room the viewer can't access beyond its title snapshot.
- **Issue candidates:** `QUOTE-FORGE-001..005`, depends on `PRIVATE-GROUPS-001`.

### B. Private Lore Codex
- **User value:** the group's accumulating "greatest hits" — best concessions, sharp challenges, recurring source chains, inside references, legendary lines — becomes a living shared memory that makes the group funnier and more bonded over time.
- **Minimal UI:** a group-level view that gathers flagged artifacts across the group's rooms; each entry links back to exact tree context; lightweight flavor tags (Inside joke · Savage but fair · Peak pedantry · Accidental poetry · Receipts · Lore). No scoring obligation.
- **Existing hooks:** evidence/receipt object model (`evidenceModel.EvidenceArtifact`); message qualifiers (`messageQualifiers.ts`) for candidate detection; the (net-new) friend-group entity as the scoping boundary.
- **MVP:** manual "add to lore" from any point → a group-scoped lore entry with one flavor tag + back-link. Read view grouped by tag.
- **Later:** suggested lore candidates (from concession/callback/receipt signals); lore reactions; per-member lore contributions view.
- **Risks:** consent (one member's line becoming "lore" the group sees forever) — require the lore to be group-scoped and deletable by the author of the underlying move. Avoid any scoring/leaderboard framing.
- **Privacy:** lore is scoped to the group; an entry's back-link respects the underlying room's RLS; author of the source move can remove the lore entry.
- **Issue candidates:** `LORE-001..005`, depends on `PRIVATE-GROUPS-001`.

### C. Highlight Reel / Greatest Hits Export
- **User value:** a clean, shareable replay of a room (or a themed cut across rooms) — story mode, concessions, callbacks, receipts — that's fun to revisit and (with consent) share.
- **Minimal UI:** select moves across one or more rooms → generate a clean replay; share inside the app or as formatted text/static artifact; cross-references stay clickable for participants.
- **Existing hooks:** timeline/branch model (`branchGrammarModel`, `ArgumentTimelineMap`); evidence + callback artifacts; group scoping.
- **MVP:** in-app "reel" = an ordered, de-chromed selection of moves rendered read-only with back-links (participants only).
- **Later:** thematic modes (concessions-only, callbacks-only, receipts-only); static text/image export; story-mode narration.
- **Risks:** export = leaving the privacy boundary → gate hard on explicit per-reel consent; strip machine internals from any export.
- **Privacy:** export is opt-in per reel; non-participants get only what the sharer is authorized to share; no raw MCP internals in exports.
- **Issue candidates:** `HIGHLIGHT-001..005`, depends on `PRIVATE-GROUPS-001` + `QUOTE-FORGE-001`.

### D. Evidence Echoes / Banter Detective
- **User value:** turns the evidence-chain precision the system already tracks into lightweight play — "find the matching claim from three rooms ago," "complete the source chain," "close the receipt loop."
- **Minimal UI:** a gentle prompt surfaced from an open source-chain obligation ("This receipt is still open — want to close it?") that pre-fills a receipt move.
- **Existing hooks:** `deriveSourceChainStatus`, `EvidenceDebtChip`, source-chain popover (`SourceChainPopover`), Family D observations (`asks_for_evidence`, `evidence_gap_present`, `opens_evidence_debt_marker`).
- **MVP:** surface *open evidence obligations* within the group as an optional "receipt challenge" composer intent (reuses the existing debt model).
- **Later:** cross-room "matching claim" detection; banter-detective private-group mode; streaks for closed loops (private, low-stakes).
- **Risks:** must stay descriptive, never grant/deny factual standing (Family D anti-amplification doctrine). Cross-room matching again brushes the search non-goal — keep it group-scoped and obligation-driven, not free-text search.
- **Privacy:** group-scoped; never expose an obligation from a room the viewer can't access.
- **Issue candidates:** `EVIDENCE-ECHO-001..004`, depends on `UX-FLAGS-001`.

### E. Concession Remix Studio
- **User value:** rewards the hardest, most valuable social move — giving ground gracefully — by treating a clean concession as a *launch point*, not a loss.
- **Minimal UI:** a clean concession gets a subtle highlight; "Remix this concession" starts a new branch/private thread from it.
- **Existing hooks:** Family G `resolution_progress` (`concedes_narrow_point`, `narrows_claim`, `synthesis_proposed`); the point-standing economy's concession-as-repair doctrine (`pointStanding` + `antiAmplification`); banter-fork branch mechanics (concept F).
- **MVP:** detect + softly highlight clean concessions (Family G), add "remix into a side branch" reusing the existing branch/split affordance.
- **Later:** concession highlight treatment in lore; "remixed N times" history (activity fact, never standing).
- **Risks:** never frame a concession as losing; never score it. Highlight must read as celebration of good form, not a scoreboard.
- **Privacy:** group-scoped; remix branch inherits room visibility.
- **Issue candidates:** `CONCESSION-REMIX-001..004`, depends on `UX-FLAGS-001`.

### F. Private Banter Forks
- **User value:** lets a group go absurd/harder *without* wrecking the serious thread — contained wit, clearly labelled, optionally summarized back.
- **Minimal UI:** from any point, "fork into a private playful branch" ("What if we went harder?"); the fork is visually distinct and clearly non-serious; can be left as side lore or summarized back to main.
- **Existing hooks:** branch/split mechanics (`Split branch` rail action); argument mode model (`argumentModeModel` casual tone); room visibility.
- **MVP:** a labelled playful branch type off any point, contained and visually distinct, that never affects the main thread's standing.
- **Later:** summarize-fork-back-to-main; fork → lore promotion.
- **Risks:** the playful layer trivializing serious debate → keep forks clearly labelled, contained, and standing-neutral; copy boundaries in a doctrine review.
- **Privacy:** fork inherits and cannot widen the parent room's visibility.
- **Issue candidates:** `BANTER-FORK-001..004`.

### G. Style Points / Micro-Combos
- **User value:** a *private, friend-visible, low-stakes* style layer that celebrates elegant play (clean callback, elegant concession, clever evidence use, challenge→concession→callback combo) — separate from serious standing, never public.
- **Minimal UI:** subtle, private celebration moments visible only within the group; no leaderboard.
- **Existing hooks:** the observation families already detect the constituent moves (A/D/G + callback events); point-standing stays entirely separate.
- **MVP:** detect a small set of combos from existing signals; celebrate privately and ephemerally.
- **Later:** more combos; per-member private style history.
- **Risks:** gamification overtaking substance; any public leaderboard would violate the doctrine — **explicitly forbidden** (§11). Keep playful, private, low-stakes.
- **Privacy:** friend-group-visible only; never public; never a ranking.
- **Issue candidates:** `STYLE-001..004`.

### H. Memory Lane / Remember This?
- **User value:** gentle, opt-in nudges that make the accumulated record feel alive — "this source-chain fight is still open," "you two had a great callback exchange on this topic."
- **Minimal UI:** occasional, dismissible, privacy-controlled prompts based on the group's own history.
- **Existing hooks:** open evidence obligations (Family D debt), callback events (QOL-042), lore entries.
- **MVP:** one nudge type — an open source-chain obligation resurfaced within the group, fully opt-in.
- **Later:** callback anniversaries; recurring-topic nudges; "remember this?" recaps.
- **Risks:** **creepiness** is the headline risk — require explicit opt-in, group-scoping, easy disable, and never nudge across groups or from inaccessible rooms.
- **Privacy:** opt-in by default-off; group-scoped; user agency to disable per-nudge-type; no cross-group memory.
- **Issue candidates:** `MEMORY-LANE-001..004`, depends on `PRIVACY-001`.

---

## 6. Single-composer redesign

**Goal:** starting a room and replying are the *same one box*; the box infers everything it safely can and hides everything optional.

### New-room state
- One composer, one placeholder ("Start something."). The typed declaration becomes the root argument (already true via `pickDisplayTitle`).
- **No visible options by default.** In a friend group, the group *is* the audience — visibility is inferred (group-private), so the default-Private *gate* (`StartArgumentPage.tsx:126–127,186–187`) disappears for the group path. Public creation becomes an explicit, secondary choice.
- The three optional taxonomy groups (`:457–520`) move behind a single optional "Add framing" affordance (or drop from creation entirely — decision in `UX-COMPOSER-002`).
- Remove the one-time invite "Continue" screen from the group path (the group already has members); keep a lightweight invite affordance for the public/1:1 path.

### Reply state
- Parent stays inferred from the acted-on node (already correct — `handleReply` → `replyTarget`).
- **Collapse the inner type/side pickers into the OneBox header.** Derive `argumentType` from the chosen box type (the `ActPopout` flash menu already carries intent) and `side` from the participant's established side; drop the always-visible chip rows from `ArgumentComposer.tsx:438–483` and relax the `canSubmit` hard-requirement on manual type/side (`:188–195`, `composerHelpers.ts:30–31`). This is the single highest-leverage simplification.

### Optional modifier pop-out
- A pop-out / drawer ("More context" / "Guide my point") hosts: add context, add source, quote/callback, ask for critique, invite synthesis, mark uncertainty, set audience (only when relevant). **Never gates submission.**

### Mobile behavior
- Bottom sheet < 720px, side panel ≥ 720px (already the `ArgumentComposerDock` model). The pop-out is a sheet on mobile.

### Inferred title / draft / failure states
- Title inferred from root body (keep `pickDisplayTitle`; never mutate `arguments.body`).
- **Add draft persistence to the create flow** (the reply composer already persists via `useArgumentComposer` + AsyncStorage; the create page currently does not — `StartArgumentPage` holds ephemeral `useState`).
- Preserve existing loading/validation/pre-send-review states (`ComposerValidationPanel`, RULE-004 `PreSendReviewSheet` — advisory, never blocking) and server-rejection rendering.

### How quote/callback injection works
- A callback action pulls an exact excerpt (reusing `targetExcerpt` capture) + a QOL-042 link into the current draft; the composer shows the woven echo inline before send.

### How flags prefill composer intents
- A friendly flag (e.g. "Needs a receipt") offers a one-tap action that opens the box pre-typed to the matching intent (e.g. ask-for-source) — reusing the `sourceChainPresetCopy` preset mechanism.

---

## 7. Feedback flags driven by MCP family groups

**Principle:** the machine layer becomes a *few* friendly, optional, dismissible, point-level flags — never a dashboard, never raw codes, never a verdict. The plumbing already exists; the redesign changes *how much* is shown and *when*, not the label-safety layer.

### 7.1 Family → friendly-flag mapping

Source of truth for families: `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68–119` (9 production families A–I `productionEnabled:true`; J `sensitive_composer` non-production **by design**). Friendly copy builds on `gameCopy.toPlainLanguage` + `refereeBannerLibrary`/`selectBanner`.

| Family | Internal name | Prod? | Friendly flag family (examples) | Best feature homes | Granularity | Suppression / doctrine |
|---|---|---|---|---|---|---|
| **A** | `parent_relation` | ✅ | "Nice bridge" · "Direct challenge" · "Builds on the point" · "Callback material" (quote-anchors parent) | Quote Forge, Style | point | never label a relation good/bad; descriptive only |
| **B** | `disagreement_axis` | ✅ | "Disagrees on scope" · "Disagrees on the facts" · "Clean disagreement" (preserves-face) | Style, Lore | point | axis is descriptive; never "you're wrong" |
| **C** | `misunderstanding_repair` | ✅ | "Asks for clarification" · "Nice bridge" (shared definition) · "Cleared that up" | Concession Remix, Lore | point (+`clarified` thread) | repair is positive framing; never "confused" |
| **D** | `evidence_source_chain` | ✅ | "Needs a receipt" · "Brought receipts" · "Open receipt" (debt) · "Complete the source chain" | **Evidence Echoes**, Memory Lane | point (debt spans thread) | **anti-amplification**: surfaces evidence dynamics, never grants/denies factual standing; popularity ≠ evidence |
| **E** | `argument_scheme` | ✅ | "Strong comparison" (analogy) · "Cause-and-effect claim" · "Appeals to authority" | Lore (optional), Style | point | detects the *pattern* only; **never** a fallacy call-out in default UX |
| **F** | `critical_question` | ✅ | "Unanswered question" · "Worth asking: what's the mechanism?" · "Names the uncertainty" | Evidence Echoes | point | opens inquiry, never closes with a verdict; no "gotcha" framing |
| **G** | `resolution_progress` | ✅ | "Clean concession" · "Found common ground" · "Narrowed the claim" · "Synthesis on the table" | **Concession Remix**, Lore, Highlight | point (+cluster lifecycle) | concession is a **repair, not a defeat**; never "conceded = lost" |
| **H** | `claim_clarity` | ✅ | "Clear claim" · "Could be more specific" · "Reads as hedged" | (mostly composer-time nudge) | point | descriptive formulation-state; never a quality verdict on move or speaker |
| **I** | `thread_topology` | ✅* | "New issue" · "Back to an earlier point" · "Brings in outside context" | Memory Lane, Highlight | point (thread-derived excluded) | *produced but **client-render-suppressed** pending deferred re-scope (`argumentDetailModel.ts:670`) — treat as "available server-side, not yet user-visible." "New issue" ≠ derailment. |
| **J** | `sensitive_composer` | ❌ | (composer-time only, if ever) "Maybe pause before sending?" | composer pre-send only | point (pre-send) | **non-production by design**; no enable card exists; any use requires a fresh cdiscourse-doctrine §10a review. Do **not** build product UI on J. |

### 7.2 Friendly flag copy rules
- Use the existing plain-language vocabulary: "Good callback setup," "Needs a receipt," "Clean concession," "Unanswered question," "Nice bridge," "Still unresolved," "Strong comparison," "Callback material," "Lore candidate."
- **Banned:** winner/loser, liar/dishonest, fallacy call-outs in default UX, any moral grading, any truth value.

### 7.3 Suppression + priority
- **Max visible flags: 1–3** per point by default (today the active-card hub shows the *entire* A–I grid uncapped — `CardDetailPanel HubClassifierZone`). The rest live behind an optional "why?" expansion.
- **Priority algorithm (proposed):** actionable-and-positive first (Clean concession, Brought receipts, Nice bridge) → actionable-prompt (Needs a receipt, Unanswered question) → descriptive (scope/scheme) → suppress the remainder. Reuse `selectBanner`'s single-signal selection discipline as the model.
- **Suppression rules:** unmapped codes suppressed (already true — `toPlainLanguage → null`); J never surfaced in-product; I suppressed on client until its re-scope lands; own-bubble never shows challenge/verdict-adjacent flags (mirrors the existing own-bubble rail restriction).

### 7.4 States
- Collapsed (default): 0–3 friendly chips + an optional "why?" affordance.
- Expanded: the fuller observation set (still plain-language) for the curious — opt-in, not default.
- **Pending / retry / dead-letter:** the classifier is async (queue → drainer). Surface these as calm, non-alarming states ("still reading this…" / silent on failure) — never a raw error or a `provider_*` code. Reuse `gameCopy` lifecycle copy.
- **Privacy:** flags are advisory and local to the room's participants; no flag content leaves the room boundary.

### 7.5 Admin/debug exception
- The raw family/rawKey/observation detail stays available **only** behind the existing admin/Inspect surfaces (role-gated; `isAdmin={false}` in default view). The redesign does not remove diagnostic depth — it removes it from the *default* path.

---

## 8. Visual simplification plan

The problem is **density and always-on-ness**, not unsafe copy. Target: conversation first, apparatus second.

### Remove / hide from the default room view
- **Collapse the active-card hub by default** (`CardDetailPanel.tsx` ~13 sections + uncapped A–I grid). Default: the message + at most 1–3 friendly flags + one advisory line. Everything else → "why?" / Inspect.
- **De-dupe standing (currently 4×) to 1×** and evidence (3×) to 1×; "next move" guidance (3×) to 1×.
- **Make the Disagreement Points rail on-demand**, not a permanent 380px pane (`DisagreementPointsRail.tsx` + `RoomBoardLayout.tsx:139–141`).
- **Retire per-node strength coloring on the default timeline** (`inferStandingBand` → per-node band). Keep a plain move spine; strength/analysis moves behind Inspect. This resolves the one doctrine-adjacency flag from §2.5.
- **Collapse the reply sidecar (6 sections) + score tracker** into one optional line.

### Retain always-visible
- The conversation itself (bubbles/spine), the one composer, the acted-on context strip, and 0–3 friendly flags.

### Move to drawers/sheets
- Full classifier detail, Disagreement Points, Open Issues, Inspect groups, metadata diff, score history.

### Density + mobile rules
- Mobile-first: on phone, one column, one message in focus, flags collapsed. Reuse the existing breakpoint model (`useHeaderBreakpoint`/`resolveBand`, 44px touch targets).
- Keep the tree readable: the spine and branch grammar stay (the `timeline-grammar` skill remains non-negotiable); it's the *decoration* (bands, glows, rings, micro-labels) that thins out by default.

### Empty / loading states
- Calm empty states ("No receipts yet — add one?"), non-alarming loading ("still reading this…").

---

## 9. Private groups & lore architecture

This is the largest net-new area. **No friend-group / social-graph entity exists today** (invites are ephemeral, email-keyed, single-seat, per-room).

### Friend-group concept
- A persistent, named group of members with a membership model (new table + RLS), re-invitable, that *scopes* rooms, lore, callbacks, and nudges. This is net-new and needs its own design doc (`PRIVATE-GROUPS-001`).
- Reuse where possible: the invite lifecycle (QOL-038 token mint/hash/deep-link/redeem), private-room visibility (QOL-039 one-way + participant RLS), and seats (ARG-ROOM-002). A group is essentially "a reusable audience + a durable memory boundary" layered over these.

### Private-invite collection concept
- A group's rooms form a collection (the group's "home"). The default home surface becomes *this*, not the public gallery.

### Group-level memory / lore
- Lore entries + callbacks + highlight reels are all **group-scoped**. Back-links respect the underlying room RLS.

### Privacy / permissions
- Membership-gated reads; author-of-source-move can remove derived lore; exports opt-in per artifact; no cross-group leakage; nudges opt-in.

### Exports & sharing
- Opt-in, per-reel/per-artifact; strip machine internals; non-participants get only what the sharer is authorized to share.

### "Public sparring hall" as secondary mode
- The existing `ConversationGallery` + public-room seat/heat machinery becomes an explicitly **secondary** "Browse public / spar with strangers" mode — demoted from home, not deleted. Heat/temperament ranking is removed from the default (group) home (implies popularity-as-signal, which the doctrine rejects).

---

## 10. Technical hooks (reuse map)

| New capability | Existing substrate to reuse | Status |
|---|---|---|
| Callback weaving | `targetExcerpt` capture (`composerState.ts:19`→`composerSubmit.ts:94`→`submit-argument:282,370`); QOL-042 links (`argumentRoomLinksApi.ts`, `linkedPriorArgumentModel.ts`, migration `20260521000010`); render seam `ArgumentTimelineMap.tsx:216–223` ← `ArgumentGameSurface.tsx:2305–2349` | substrate built, **dark** |
| Private groups | QOL-038 invites (`create-argument-room`, `manage-room-invite`, `inviteDeepLink.ts`); QOL-039 visibility (`roomVisibilityModel.ts`, migration `20260524000015`); ARG-ROOM-002 seats (`20260613000001`) | reuse; group entity net-new |
| Friendly flags | `gameCopy.toPlainLanguage` (600+ codes); `refereeBannerLibrary`/`selectBanner`; `standingBandCopy`; `mediatorPlainLanguage`; `messageQualifiers`; families `familyRegistry.ts:68–119` | fully built; needs cap + priority |
| Evidence echoes | `evidenceModel.deriveSourceChainStatus`, `EvidenceDebtChip`, `SourceChainPopover`; Family D | built |
| Concession remix | Family G; `pointStanding` + `antiAmplification`; `Split branch` rail action | built |
| Single composer | OneBox (`oneBox/OneBox.tsx`, `boxModel.ts`); `ArgumentComposerDock`; parent inference (`handleReply`) | built; needs inner-picker collapse |
| Lore / reels / style / memory-lane | (net-new, scoped by the net-new group entity) | greenfield |

**Constraint reminders:** the Constitution engine (`src/domain/constitution/engine.ts`) stays pure/side-effect-free; AI calls only in Edge Functions; all new tables RLS-enabled; soft-delete only; migrations sequential and never edited after apply.

---

## 11. Non-goals

- **No public leaderboard for style** (style is private, friend-visible, low-stakes — a public ranking would violate anti-amplification doctrine).
- **No serious-scoring replacement** — the point-standing economy stays as-is; style points are a *separate*, playful, non-authoritative layer.
- **No raw classifier UI** in the default path — no family/rawKey, no dashboard.
- **No mandatory modifiers**; **no survey start.**
- **No heavy new moderation model** in this pass.
- **No provider-spend-dependent MVP** — every Wave-1/2 item works on already-produced observations + existing substrate.
- **Reconcile "no argument search" (v1 non-goal):** callback/echo discovery is **group-scoped and structure-driven** (pick from the group's own prior rooms / open obligations), **not** a global free-text search. Any full search remains out of scope.
- **Do not build product UI on Family J** (`sensitive_composer`, non-production by design).

---

## 12. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| **Memory-nudge creepiness** (Memory Lane) | High | opt-in default-off; group-scoped; per-nudge-type disable; never cross-group; never from inaccessible rooms |
| **Private lore consent** | High | group-scoped; author-of-source-move can remove; no scoring framing |
| **Feedback overload** persists if cap not enforced | Med | hard 1–3 visible cap; priority algorithm; "why?" opt-in expansion |
| **Playful layer trivializes serious debate** | Med | banter forks clearly labelled + standing-neutral; style layer separate from standing; doctrine review on copy |
| **Over-gamification** | Med | no public leaderboard; celebrations ephemeral/private; keep substance primary |
| **Model/classifier overtrust** | Med | every flag `authoritative:false`, hedged, dismissible; no verdicts; retire per-node strength band from default |
| **Mobile complexity** | Med | mobile-first density rules; one message in focus; flags collapsed; reuse breakpoint model |
| **Privacy/export leakage** | High | opt-in per artifact; RLS-respecting back-links; strip internals; no cross-group leakage |
| **Scope explosion** | High | wave sequencing (§13/§14); each feature gets its own design doc; Wave 1 is simplification only |
| **Search non-goal collision** | Med | scope all discovery to group + structure, never global free-text |
| **Cross-room link privacy** | Med | reuse QOL-042 `title_only`/`unavailable` access states verbatim |

---

## 13. Prioritization

Ranked by **(delight × leverage-of-existing-architecture) ÷ (cost + privacy-risk)**, with UX-simplification impact as a tiebreaker.

**Quick wins (high delight, high reuse, low cost/risk):**
1. **Single-composer reply** — collapse inner type/side pickers into OneBox (biggest friction removed; pure UI). `UX-COMPOSER-003/004`.
2. **Feedback-flag cap + friendly mapping** — 1–3 flags, reuse `toPlainLanguage`. `UX-FLAGS-001/002/003`.
3. **Visual density reduction** — collapse the card hub, de-dupe standing/evidence. `VISUAL-SIMPLIFY-001/002/005`.
4. **Single-composer room start** — drop the taxonomy survey + default-Private gate for the group path. `UX-COMPOSER-001/002`.
5. **Quote Forge MVP** — light up the dark QOL-042 wire. `QUOTE-FORGE-001/002` (needs group scoping, so pairs with `PRIVATE-GROUPS-001`).

**High delight, higher cost (net-new):**
6. Private groups + group home (`PRIVATE-GROUPS-001..003`).
7. Private Lore Codex MVP (`LORE-001`).
8. Concession Remix + Evidence Echoes (`CONCESSION-REMIX-001`, `EVIDENCE-ECHO-001`).

**Later / experiments:**
9. Highlight Reel, Style Points, Banter Forks, Memory Lane.

**Sunset (parallel, low cost):** retire dead `DebateListScreen`/`CreateDebateForm`; demote gallery to secondary; move MCP detail fully behind Inspect.

### Priority labels
- **P0:** `UX-COMPOSER-001/002/003`, `UX-FLAGS-001/002/003`, `VISUAL-SIMPLIFY-001/002`, `PRIVATE-GROUPS-001`.
- **P1:** `UX-COMPOSER-004/005/006`, `UX-FLAGS-004/005`, `PRIVATE-GROUPS-002/003`, `QUOTE-FORGE-001/002`, `LORE-001`, `VISUAL-SIMPLIFY-003/004/005`, `SUNSET-001/002/003`.
- **P2:** everything else (highlight/style/banter/memory-lane/echo depth, admin, obs, a11y carry-over).

### Dependency map (high-level)
- `PRIVATE-GROUPS-001` (group model) blocks `QUOTE-FORGE-*`, `LORE-*`, `HIGHLIGHT-*`, `MEMORY-LANE-*`, `STYLE-*` (all group-scoped).
- `UX-FLAGS-001` (family→flag mapping) blocks `UX-FLAGS-002/003/004`, `EVIDENCE-ECHO-*`, `CONCESSION-REMIX-*`.
- `UX-COMPOSER-001` (composer redesign) blocks `UX-COMPOSER-003/004/005`.
- `QUOTE-FORGE-001` (light up QOL-042) blocks `HIGHLIGHT-*`, feeds `MEMORY-LANE-*`.
- `PRIVACY-001` (consent model) blocks `LORE-*` export/share + `MEMORY-LANE-*`.

---

## 14. Roadmap (waves)

**Wave 1 — Foundation / UX simplification (P0, no net-new data model):**
single-composer room start · unified reply composer (collapse inner pickers) · progressive modifier pop-out · feedback-flag mapping + cap · visual density reduction. *All reuse existing substrate; no provider spend; no migration.*

**Wave 2 — Private memory primitives:**
private group model + group home (net-new table/RLS) · Quote Forge MVP (light up QOL-042) · point-level friendly flags shipped · Lore Codex MVP.

**Wave 3 — Playful artifacts:**
Highlight Reel · Concession Remix · Evidence Echoes · Memory Lane (opt-in).

**Wave 4 — Style & experiments:**
Style Points · Micro-combos · Banter Forks · advanced exports.

**Wave 5 — Sunset cleanup:**
retire dead `DebateListScreen`/`CreateDebateForm`/standalone `JoinDebatePanel` · demote gallery + heat ranking to secondary "public sparring hall" · move raw MCP/debug fully behind Inspect · re-target v4 layout/token/a11y cards onto the new surfaces.

**Explicitly deferred/sunset old directions:** the "data-rich card as centerpiece" thesis (#504, inverted by lower-density) · public-cap-5 room framing as the default (superseded by private-group-first + the 1:1 work in #680/#681, which need reframing) · setup-survey room creation.

---

## 15. Acceptance criteria (for the redirect as a whole)

- [ ] A new user can start a private (group) room from **one composer with no visible options** — no side, no type, no taxonomy, no visibility dialog.
- [ ] A reply can be sent **without touching any modifier** (type/side inferred).
- [ ] Feedback flags are **optional, friendly, dismissible, ≤3 by default**, with no raw MCP labels in the default UI.
- [ ] The **quote/callback flow uses exact preserved context** (`targetExcerpt` + a QOL-042 link) and renders a distinct echo.
- [ ] A **private group** exists as a first-class entity, and its rooms + lore accumulate group-scoped artifacts.
- [ ] **Visual density is materially reduced** — the default room view leads with the conversation; standing/evidence/next-move each appear once, not 3–4×.
- [ ] **No raw MCP internals** (family/rawKey/verdict) appear in the default UI; diagnostic depth remains behind Inspect/admin only.
- [ ] The work is **split into small, independently shippable issues** (see epic), with Wave 1 requiring **no migration and no provider spend**.

---

## Appendix — source-audit anchors (for implementers)

- Composer/room-start: `startArgument/StartArgumentPage.tsx` (:127,:186–187,:270–322,:457–520), `oneBox/OneBox.tsx`, `oneBox/boxModel.ts`, `ArgumentComposer.tsx` (:188–195,:438–483), `composerHelpers.ts:30–31`, `ArgumentComposerDock.tsx`.
- Quote/callback + cross-room: `crossRoom/linkedPriorArgumentModel.ts`, `crossRoom/argumentRoomLinksApi.ts`, `crossRoom/LinkedPriorArgumentChipRow.tsx`, migration `20260521000010_qol042_argument_room_links.sql`, render seam `ArgumentTimelineMap.tsx:216–223` ← `ArgumentGameSurface.tsx:2305–2349`; `targetExcerpt` path `composerState.ts:19`→`composerSubmit.ts:94–98`→`submit-argument/index.ts:282,370`.
- Private/invite: `create-argument-room/index.ts`, `manage-room-invite/index.ts`, `invites/inviteDeepLink.ts`, `roomVisibilityModel.ts`, migrations `20260524000013` (invites) / `20260524000015` (visibility) / `20260613000001` (seats).
- Families + friendly copy: `_shared/booleanObservations/familyRegistry.ts:68–119`, `_shared/booleanObservations/nodeLabelTypes.ts:110–120`, `gameCopy.ts` (`toPlainLanguage` :875–931), `refereeBanners/*`, `standingBandCopy.ts`, `mediator/mediatorPlainLanguage.ts`, `messageQualifiers.ts`.
- Visual overload: `cardView/CardDetailPanel.tsx` (:252–304 hub), `mediator/DisagreementPointsRail.tsx`, `ArgumentTimelineMap.tsx`, `argumentGameSurfaceModel.ts:976–1011` (`inferStandingBand`), `RoomBoardLayout.tsx:139–141`, `ArgumentGameSurface.tsx:2195–2876`.
- Legacy/sunset: `ConversationGalleryScreen.tsx`, `appPrimaryNavModel.ts`, `DebateListScreen.tsx`, `CreateDebateForm.tsx`, `JoinDebatePanel.tsx`.

*End of PRODUCT-REDIRECT-001 design doc.*
