# UX-MEDIATOR-ASSESSMENT-001 — CDiscourse as a high-reliability pseudo-mediator

Status: Assessment / planning / research only. **No production code, no runtime mutation, no migration, no Edge Function, no provider call, no deployment.**
Author: Claude Code (senior product architect / TypeScript systems designer / UX research pass)
Date: 2026-06-14
Scope: Whole-app product-direction assessment + speculative product map. Companion testing-run doc: `docs/testing-runs/2026-06-14-puppeteer-ux-assessment.md`. Companion candidate-card catalogue: `docs/designs/UX-MEDIATOR-CANDIDATE-CARDS.md`.

> **Reading guide.** Every proposal carries a tier label:
> **[SHIP-NOW]** low-risk simplification or obvious repair · **[BRIDGE]** a plausible next-step capability that connects existing pieces into a coherent mediator workflow · **[NORTH-STAR]** ambitious, multi-card, validate assumptions before building.
> Grounded claims cite `file:line`. Speculation is labelled and carries: why it matters · user pain · surfaces touched · data/model support · how to prototype · how to test · doctrine/UX risk · tier.
>
> **Grounded vs speculative.** Sections 2, 9, 10 (left column), and 11 are **grounded** — they cite repo code/files directly and were independently re-verified by the read-only grounding workflow `wf_cd878835` (8 lanes; 79 claims grounded, 2 factual corrections applied, log in §18). Sections 5–8, 12, 16 and the right columns of 6/10 are **speculative proposals** — tier-labelled, framed as "not built," and never asserted as current implementation.

---

## 1. Executive summary — what the app should become

CDiscourse already contains, in pure TypeScript, most of a working **dispute-structure engine**. It does not yet *present* itself as one. The single most important finding of this assessment:

> **The mediator is already computed; it is not yet surfaced.** The 19-state per-cluster lifecycle classifier ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts) — its `PointLifecycleState` union lists 19 values; the file's own header comment and several older docs say "18", a known lag recorded in [AN-003.md §D5](docs/designs/AN-003.md)), the evidence-debt tracker ([evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts)), and nine deployed machine-observation families (parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress, claim_clarity, thread_topology) together already answer most of "what is the live structure of this disagreement?" — but the room UI renders these as scattered per-node chips, not as one legible board.

**The best version of CDiscourse is a form-enforcing, structure-preserving dispute board** — a pseudo-mediator that:

1. keeps every reply anchored to the specific point it addresses;
2. names the *kind* of disagreement (fact / definition / scope / causal / value / evidence / recollection);
3. tracks what is *owed* (a source, a quote, a definition, a clarification) and what is *blocked* (a record that would settle it but is unavailable);
4. distinguishes *kinds of impasse* (we narrowed it · we need evidence · the key detail can't be settled here · we followed the form and still disagree);
5. shows the next useful move — or honestly says "no pathway is available right now" — **without ever declaring truth, winner, loser, or intent.**

The deterministic Constitution engine ([src/domain/constitution/engine.ts](src/domain/constitution/engine.ts)) remains the **sole** submission gate. The mediator board is a **read-only projection** over the node graph + persisted observations. It never blocks, routes, delays, or labels a person.

The work to get there is mostly **projection and presentation**, plus a handful of genuinely-missing dispute states (difference-of-recollection, non-provable key detail, blocked-evidence-path, value-clash terminal, structured-impasse terminal). That is a far cheaper and safer path than building new mechanics — and it is the through-line of every recommendation below.

A second finding from a live browser pass (§11): the app's **first impression undersells it**. The logged-out screen shows a 296-px-tall logo, a cryptic tagline, and a sign-in form — with **no explanation of what the app is for** — and the browser tab still says **`expo-scaffold`** ([app.json:3](app.json)). The streamlined app should let a newcomer understand the product *before* they sign up.

---

## 2. Current UX / product map

### 2.1 Architecture (grounded)

- **Expo React Native, state-only navigation (no router).** Entry is [App.tsx](App.tsx); there is no `app/` Expo-Router tree. Navigation is in-memory state in `MainAppShell` ([App.tsx](App.tsx), [appPrimaryNavModel.ts](src/features/navigation/appPrimaryNavModel.ts)). The "no-route invariant" is deliberate.
- **Session-gated.** `unconfigured → signed_out → signed_in` ([App.tsx](App.tsx)). Signed-out renders `AuthScreen` only; everything else is behind auth.
- **Top-level screens:** Arguments tab (default) → `ConversationGalleryScreen` (room list) or `ArgumentTreeScreen` (open room); Account; Admin (role-gated); Debug (`__DEV__`).
- **Web target builds and deploys** (Netlify, [netlify.toml](netlify.toml)) despite the v1 "native-first" framing in [CLAUDE.md](CLAUDE.md). Web is co-equal in logic.

### 2.2 Primary user journey

Sign in → browse gallery → open a room → read Timeline (primary) or Cards (secondary) → tap a node → side-rail actions → Reply opens the composer dock → fill body + optional channels → pre-send review (advisory) → submit. Secondary journeys: Start an Argument (`StartArgumentPage`), My Arguments (gallery filter), Invite redeem (`InviteRedeemGate`), Admin.

### 2.3 Surface inventory (what a user actually sees)

| Surface | Key files | What the user does |
|---|---|---|
| Primary nav (5 items) | [AppPrimaryNav.tsx](src/features/navigation/AppPrimaryNav.tsx) | Start / Browse / My Arguments / Profile / About |
| Gallery (cards, 6 sorts, search, 11 buckets) | [ConversationGalleryScreen.tsx](src/features/debates/ConversationGalleryScreen.tsx), [conversationGalleryModel.ts](src/features/debates/conversationGalleryModel.ts) | Find a room; `Observe → / Continue → / Open →` |
| Room board | [ArgumentTreeScreen.tsx](src/features/arguments/ArgumentTreeScreen.tsx), [ArgumentGameSurface.tsx](src/features/arguments/ArgumentGameSurface.tsx), [ConversationMiniTimeline.tsx](src/features/debates/ConversationMiniTimeline.tsx) | Read Timeline / Cards; tap to activate a node |
| Composer dock (13 modes; 4 shipped) | [ArgumentComposerDock.tsx](src/features/arguments/ArgumentComposerDock.tsx), [OneBox.tsx](src/features/arguments/oneBox/OneBox.tsx), [argumentModeModel.ts](src/features/modes/argumentModeModel.ts) | Pick move type; write body; channels; pre-send review |
| Side rail (actor-aware) | [ArgumentSideActionRail.tsx](src/features/arguments/ArgumentSideActionRail.tsx), [railActionCategories.ts](src/features/arguments/railActionCategories.ts) | Observer: Watch / Join For / Join Against / Share. Participant on other node: Reply / Disagree. Own node: Act popout only |
| Node labels | [NodeLabelStrip.tsx](src/features/nodeLabels/NodeLabelStrip.tsx), [AnnotationChipStrip.tsx](src/features/nodeAnnotations/AnnotationChipStrip.tsx), [EvidenceAnnotationChip.tsx](src/features/evidence/EvidenceAnnotationChip.tsx) | Read lifecycle tags, manual tags, referee banners, evidence chips |
| Visibility / seats / invites | [JoinDebatePanel.tsx](src/features/debates/JoinDebatePanel.tsx), [InvitePanel.tsx](src/features/invites/InvitePanel.tsx), [argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts) | See seat availability; copy invite link |
| Plain-language map | [gameCopy.ts](src/features/arguments/gameCopy.ts) (`PLAIN_LANGUAGE_COPY`, `toPlainLanguage`) | Internal codes → user prose |

### 2.4 Current data / model map (grounded)

- **Argument node** ([types.ts](src/features/arguments/types.ts)): `id, debateId, parentId, authorId, argumentType` (thesis · claim · rebuttal · counter_rebuttal · evidence · clarification_request · concession · synthesis), `side, body, depth, status, targetExcerpt, disagreementAxis` (fact · definition · causal · value · evidence · logic · scope), `railPayload, clientValidation, serverValidation, inactiveAt, createdAt, updatedAt`. Related: `argument_tags`, `argument_flags`, `topic_satisfaction_checks`, `point_tags`, `argument_machine_observation_results`.
- **Room / participants** ([debates/types.ts](src/features/debates/types.ts), [20260613000001_arg_room_002_room_capacity_and_creation.sql](supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql)): `debates.visibility` (public/private), `debate_participants.side` (affirmative · negative · observer · moderator), derived capacity (public 5 / private 2), invites (one live per room).
- **Four seat states (binding doctrine — must not be collapsed)** ([ARG-ROOM-001](docs/designs/ARG-ROOM-001-CREATION-MATRIX-AND-MODEL.md), [2026-06-13 invites roadmap](docs/roadmap-expansions/2026-06-13-public-private-argument-room-invites-roadmap.md)): *active participant* (counts vs cap) · *observer/reader* (uncapped, never a seat) · *pending reserved invite seat* (held until accept/expire/revoke) · *open public seat* (`cap − active − reserved`). Public = capped active speakers + unlimited observers; private = 1v1 that requires its one invite.
- **Machine observations** ([nodeLabelTypes.ts](src/features/nodeLabels/nodeLabelTypes.ts), [machineObservationPersistenceTypes.ts](src/features/nodeLabels/machineObservationPersistenceTypes.ts), [20260526000018_mcp_021b_machine_observation_results.sql](supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql)): persisted per-positive-observation rows, `run_mode` production vs admin_validation, RLS-inherited SELECT. Schema boundary `machine_observation | user_allegation` is doctrinally load-bearing (§17).
- **Pure-TS derivation models already in the tree** (the mediator backbone): [pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts), [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts), [conversationGalleryModel.ts](src/features/debates/conversationGalleryModel.ts), [argumentGameSurfaceModel.ts](src/features/arguments/argumentGameSurfaceModel.ts), [tangentRoutingModel.ts](src/features/arguments/tangentRoutingModel.ts), [conversationMoves.ts](src/features/arguments/conversationMoves.ts), [antiAmplification.ts](src/features/pointStanding/antiAmplification.ts), [respondToConcessionModel.ts](src/features/concessions/respondToConcessionModel.ts).

---

## 3. Where the current app is too complex

The mechanics are excellent; the **conceptual surface area** is the problem. The app asks users to absorb a system before they can argue.

| # | Complexity | Evidence | Why it hurts |
|---|---|---|---|
| C1 | **Four words for one thing.** "debate" (data/state), "argument" (UX), "room" (shell), "conversation" (gallery model). | `selectedDebateId` in [App.tsx](App.tsx); `argument` in `ROOM_COPY`; `conversation*` in [conversationGalleryModel.ts](src/features/debates/conversationGalleryModel.ts) | Newcomers can't form a stable mental model. There is already a terminology auditor ([auditUserFacingTerminology.js](scripts/ux/auditUserFacingTerminology.js)) — extend it. |
| C2 | **Vocabulary sprawl in internal taxonomies.** 19 lifecycle states, 11 gallery buckets, 13 message categories, 26 message qualifiers, 103 referee-banner codes, 64 node-label registry entries, ~193 classifier keys across 10 families (188 across the deployed A–I; see §9 for the per-family, file-header-sourced counts). | [pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts), [refereeBannerLibrary.ts](src/features/refereeBanners/refereeBannerLibrary.ts) | Most never surfaces, but the *exposed* subset is large and uncoordinated. The fix is a single projection layer (§8), not more vocabulary. |
| C3 | **Chip stacking risk on a node.** A node can carry lifecycle tag + manual tags + evidence-debt chip + referee banner + up to 3 classifier chips simultaneously. | [cardClassifierStripModel.ts](src/features/arguments/cardView/cardClassifierStripModel.ts) (3-chip cap), [NodeLabelStrip.tsx](src/features/nodeLabels/NodeLabelStrip.tsx) | Visual "chip soup" competes for attention; no single answer to "what's the state of this point?" |
| C4 | **13 composer modes carried in-model; only 4 shipped.** | [argumentModeModel.ts](src/features/modes/argumentModeModel.ts) | The model file's size implies more product than is real; the 9 design-only modes are latent complexity. |
| C5 | **Two parallel "debt" models.** Evidence-debt (source obligation) vs point-standing OpenIssueDebt (axis pressure). | [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts) §4.1, [pointStanding/types.ts](src/features/pointStanding/types.ts) | Correct internally, but a unified board must present *one* "what's unresolved here" surface or users will conflate them. |
| C6 | **Actions hidden behind "Act" popout.** Own-node actions and ask-source/ask-quote/flag/qualifiers all live in a popout. | [ArgumentSideActionRail.tsx](src/features/arguments/ArgumentSideActionRail.tsx) | Good for de-cluttering the rail, but the most mediator-relevant moves (ask source, ask quote) are now two taps deep. |
| C7 | **Multiple timeline grammars.** Timeline (primary), Cards (secondary), right-side scrubber, gallery mini-timeline. | [ArgumentGameSurface.tsx](src/features/arguments/ArgumentGameSurface.tsx), [ConversationMiniTimeline.tsx](src/features/debates/ConversationMiniTimeline.tsx) | Four ways to depict the same tree; the "live structure of disagreement" is not any one of them. |
| C8 | **First-run opacity.** Logged-out screen = giant logo + tagline + sign-in, no value prop; tab title `expo-scaffold`. | §11 live finding; [app.json:3](app.json) | A newcomer can't answer "what is this and why would I use it?" in 10 seconds. |
| C9 | **`moderator` → "Observer" copy collision.** The `moderator` participant side renders as "Observer," which also names the read-only role. | [gameCopy.ts](src/features/arguments/gameCopy.ts) PLAIN_LANGUAGE_COPY | Two distinct concepts share one word. |

---

## 4. The pseudo-mediator product thesis

A **mediator, not a judge.** The app's job is to make the *shape* of a disagreement legible and to keep the exchange in good form — never to resolve the disagreement on the parties' behalf.

**The mediator MUST** (and the building blocks already exist):
- enforce response structure → Constitution engine ([engine.ts](src/domain/constitution/engine.ts), [evaluateArgumentDraft.ts](src/domain/constitution/evaluateArgumentDraft.ts));
- keep responses anchored to the point → `targetExcerpt`, rails parent-responsiveness ([railsChecks.ts](src/domain/constitution/railsChecks.ts)), Family A parent_relation;
- identify when a response doesn't address the point → `PARENT_NONRESPONSIVE` (advisory), [tangentRoutingModel.ts](src/features/arguments/tangentRoutingModel.ts), lifecycle `ignored_by_*`/`moved_on_by_*`, Family C `question_answer_mismatch`;
- track active disagreement points → lifecycle clusters ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)), `disagreementAxis`, Family B;
- track unresolved premises / evidence debt → [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts), Family D;
- highlight missing definitions / scope mismatch → Family C `proposes_shared_definition`/`scope_mismatch_identified`, Family B `disputes_definition`/`disputes_scope`;
- show pathways to resolution — or that none exists → derived from open debts + lifecycle terminal states (§6, §8);
- preserve structured impasse without shame → lifecycle `exhausted` is advisory, never blocking ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts) doctrine §5).

**The mediator MUST NOT** (doctrine §17): declare who is right/wrong, infer intent, label a person, punish hard disagreement, convert engagement/heat into evidentiary standing ([antiAmplification.ts](src/features/pointStanding/antiAmplification.ts)), or block ordinary submission through AI/MCP.

**Language discipline.** Use "pathway to resolution," "pathway to verification," "evidence path," "what would distinguish these claims" — never "truth verdict." Map every code through `gameCopy.toPlainLanguage`; unknown codes are suppressed, never echoed ([cdiscourse-doctrine §9](.claude/skills/cdiscourse-doctrine)).

---

## 5. Timeline / board future-state concepts

The board should answer one question on open: **"What is the live structure of this disagreement, and what's the next useful move?"** Today it answers "here are the messages in order."

> Design principle: **one board, three reading depths** — (a) a room-level rail that lists *disagreement points* and their state; (b) per-node markers that say what *this* move did to *its* point; (c) a single composer prompt that says what would help next. All three read from one derivation (§8).

| Concept | Where it appears | Form | Powered by | Deterministic-TS-first? | Puppeteer test | Confusion risk | Tier |
|---|---|---|---|---|---|---|---|
| **Disagreement Points rail** | Room, collapsible left/top rail | Rail of point cards | lifecycle clusters + axis + status | Yes (projection of `buildPointLifecycleMap`) | Fixture room with 3 branches → rail anchors to 3 correct nodes, shows 3 states | "Is this a score?" → copy must say "open points," not "winning points" | **[BRIDGE]** |
| **Point state chip (one per node)** | Timeline node | Single chip replacing chip-soup | lifecycle state → plain label | Yes ([getPointLifecyclePlainLabel](src/features/lifecycle/pointLifecycleModel.ts)) | Snapshot per state; assert ≤1 primary chip | Stacking back up over time | **[SHIP-NOW]** (consolidate existing chips) |
| **"What would resolve this?" card** | Selected point | Card under the active point | open evidence debts + missing-definition signals | Yes for the deterministic subset | Fixture with open source-debt → card names "a source for X" | Sounds like "do this to win" → frame as "what would distinguish the claims" | **[BRIDGE]** |
| **Evidence Debt stack** | Rail section | Grouped by debt kind | [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts) roll-ups | Yes (`getRoomEvidenceDebtSummary`) | Room with 2 open + 1 stale debt → counts match | Confused with point-standing debt (C5) | **[BRIDGE]** |
| **"This responds to…" anchor line** | Node header | One-line back-reference to parent excerpt | `targetExcerpt` + parentId | Yes | Reply with excerpt → anchor renders parent quote | None | **[SHIP-NOW]** |
| **"This doesn't address the point yet" soft note** | Composer + node (advisory) | Soft inline note, "post anyway" always available | rails `PARENT_NONRESPONSIVE` + tangent model | Yes (already advisory) | Low-overlap reply → soft note, post still enabled | Reads as accusation → person-neutral copy | **[BRIDGE]** |
| **Structured-impasse banner** | Room top, when terminal | Calm banner, no verdict | lifecycle `exhausted` + no open pathway | Yes | Exhausted fixture with no debts/pathways → banner; with open debt → no banner | "We failed" framing → "you both made the case; nothing new to test right now" | **[BRIDGE]** |
| **Active pathway checklist** | Selected point | Checklist of available next steps | resolution-pathway derivation (§8) | Partial (deterministic subset) | Fixture states map to expected checklist | Implies a "correct" path | **[BRIDGE]** |
| **Difference-of-recollection marker** | Node + rail | Marker separating memory vs verifiable claims | NEW signal (§10) | No (needs claim-identity) | Requires new classifier fixture | Implying someone lied | **[NORTH-STAR]** |
| **Private mediator notes vs public markers** | Composer-only vs node | Composer-only sensitive observations stay private | existing `composer_only` disposition | Yes (disposition already exists) | Assert sensitive obs never on target node | Leaking private to public | **[BRIDGE]** |
| **Observer digest** | Room, read mode | Read-only "what's unresolved" summary | board roll-up | Yes | Observer view shows digest, no compose affordance | Observer thinks they can act | **[BRIDGE]** |
| **1v1 focus mode** | Private room | Reduce UI to next best action | board `MediatorNextAction` | Yes | Private room → single next-action prompt | Hides needed actions | **[BRIDGE]** |
| **Public seat/voice clarity** | Public room header | "3 of 5 seats active · N watching" | seat model ([argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts)) | Yes | Public room → seat line matches cap math | "comment thread" feel | **[SHIP-NOW]** |

---

## 6. Hard-dispute / impasse taxonomy

A closed, plain-language vocabulary for the states that make disputes hard to adjudicate. **None of these is a verdict.** Each row maps to existing signals where they exist and flags what is genuinely missing (§10).

> Safe-label rule: describe the *point's structural state*, never a person. Forbidden across all states: liar, dishonest, bad faith, manipulative, wrong, false, loser, misremembers, lying (enforced by [pointLifecycleModel `_forbiddenLifecycleTokens`](src/features/lifecycle/pointLifecycleModel.ts) and the ban-list tests).

### State table

| # | State | Safe label | Unsafe labels to avoid | Required node evidence | Classifier support today | Deterministic TS condition | UI treatment | Next action | In summary? | Observer-visible? | Affects notifications? | Fixture-testable? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Difference of recollection | "Accounts differ" | "X misremembers / is lying" | two moves assert incompatible past facts; no shared record in thread | **None** (gap) | needs claim-identity (not deterministic alone) | rail marker + "separate memory from record" prompt | offer to mark which claims are memory vs verifiable | Yes | Yes | No | Needs new fixture + classifier |
| 2 | Non-provable key detail | "Key detail can't be settled here" | "unknowable / pointless" | a pivotal claim with no available source path | partial (Family D `flags_context_limit`) | partial: claim depends on an unmet debt with no supply path | marker on the dependent node | branch the provable parts; mark detail unresolved | Yes | Yes | No | Partial (deterministic skeleton) |
| 3 | Blocked evidence path | "Evidence not available" | "they're hiding it" | a named artifact would settle it but is unavailable | partial (Family D `creates_source_chain_gap`) | EvidenceDebt with `unresolved` + a "blocked" sub-reason (NEW) | evidence-debt chip variant "blocked" | name the artifact category; don't demand disclosure | Yes | Yes | No | Yes (extend EV-003 fixture) |
| 4 | Definition mismatch | "Definition not yet shared" | "they're equivocating on purpose" | same term, two usages, no shared definition move | **Strong** (Family C `proposes_shared_definition`/`flags_term_ambiguity`; Family B `disputes_definition`; lifecycle `clarified`) | both sides used term + no `confirms_shared_definition` | "Define the term" bridge card | prompt both to define | Yes | Yes | No | Yes |
| 5 | Scope mismatch | "Answering a different scope" | "dodging / strawman" | reply addresses broader/narrower claim than target | **Strong** (Family B `disputes_scope`; Family C `scope_mismatch_identified`; lifecycle `branch_recommended`) | off-axis pressure ≥ threshold ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)) | scope chip + "accept / narrow / branch" | offer narrowed claim or branch | Yes | Yes | No | Yes |
| 6 | Causal-chain gap | "Missing link in the chain" | "illogical / nonsense" | conclusion depends on unstated mechanism | partial (Family E `causal_reasoning`; Family F critical questions; axis `causal`) | causal axis + unmet critical question | "missing mechanism" marker | ask for the mechanism step | Yes | Yes | No | Yes |
| 7 | Value clash | "Different priorities" | "selfish / immoral" | disagreement is a tradeoff, not a fact | partial (axis `value`; Family B `disputes_value_weighting`) | value axis + no fact/evidence debt open | "value tradeoff" marker (not "needs evidence") | name the tradeoff; stop asking for proof | Yes | Yes | No | Yes |
| 8 | Point deviation | "Doesn't answer the point yet" | "off-topic / spam" | reply low-overlap to target; on a different point | **Strong** (rails `PARENT_NONRESPONSIVE` advisory; [tangentRoutingModel.ts](src/features/arguments/tangentRoutingModel.ts); Family A; lifecycle `ignored_by_*`) | advisory rails + tangent assessment | soft note + "branch or re-anchor" | branch the tangent or re-anchor | Optional | Yes | No | Yes |
| 9 | Partially narrowed disagreement | "Narrowed — smaller disagreement remains" | "they lost the big point" | a concession/narrowing move + a remaining open sub-point | **Strong** (lifecycle `narrowed`/`conceded`; Family G `concedes_narrow_point`; [respondToConcessionModel.ts](src/features/concessions/respondToConcessionModel.ts)) | last contribution `narrowed` + open child | concession ladder (no "defeat") | continue on the remaining point | Yes | Yes | Optional | Yes |
| 10 | Structured impasse | "Stuck here — both sides made the case" | "deadlock / they failed" | good-form exchange, no open pathway, clash remains | partial (lifecycle `exhausted`; Family G `point_stalled`/`stalemate`) | `exhausted` AND no open evidence debt AND no available pathway (NEW combiner) | calm impasse banner | mark impasse; offer branch or pause | Yes | Yes | Optional | Yes (combiner over fixtures) |

**Doctrine note on impasse:** structured impasse is a *stable, dignified board state*, not a failure. It is advisory and never blocks further posting; either party may reopen it with new evidence ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts) doctrine §5).

---

## 7. Bridging feature catalog

Features that connect existing primitives into a clearer flow. Each: user story · frustration solved · files involved · TS model changes · classifier/MCP support · tier · first validating card.

1. **Point Ledger / Disagreement Points rail** — *Story:* "As a reader I want to see the 3 live disagreements, not scroll 40 messages." *Frustration:* the structure is invisible. *Files:* new `src/features/mediator/`, binds [pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts). *Model:* `deriveOpenDisagreementPoints` (§8). *Classifier:* B + C + G (deployed). *Tier:* **[BRIDGE]**. *First card:* UX-MEDIATOR-001 (pure model) → UX-MEDIATOR-005 (rail).
2. **Resolution Path Cards ("What would distinguish this?")** — *Story:* "Tell me what would move this forward." *Frustration:* people repeat themselves. *Files:* mediator core + composer. *Model:* `deriveResolutionPathways`. *Classifier:* D (evidence), C (definition). *Tier:* **[BRIDGE]**.
3. **Evidence Debt Stack** — *Story:* "Show me every owed source in one place." *Frustration:* debts are scattered per-node. *Files:* reuse [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts) roll-ups. *Model:* none new (roll-ups exist). *Tier:* **[SHIP-NOW]** surface / **[BRIDGE]** stack UI.
4. **Recollection Split** — *Story:* "Separate 'what I remember' from 'what we can check.'" *Frustration:* memory disputes masquerade as fact disputes. *Files:* mediator core. *Model:* `RecollectionConflict` (§8) + claim-identity (§10). *Classifier:* NEW (do not enable dormant families; assess only). *Tier:* **[NORTH-STAR]**.
5. **Definition Bridge** — *Story:* "We're using the word differently — let's pin it." *Frustration:* circular definition fights. *Files:* composer + mediator core. *Model:* `DefinitionMismatch`. *Classifier:* C (deployed). *Tier:* **[BRIDGE]**.
6. **Scope Bridge** — *Story:* "Accept, narrow, or branch this claim." *Frustration:* talking past each other on scope. *Files:* composer move selector ([conversationMoves.ts](src/features/arguments/conversationMoves.ts)). *Model:* `ScopeMismatch`. *Classifier:* B + C. *Tier:* **[BRIDGE]**.
7. **Concession Ladder** — *Story:* "Show partial agreement without it feeling like defeat." *Frustration:* concession feels like losing. *Files:* reuse [respondToConcessionModel.ts](src/features/concessions/respondToConcessionModel.ts), [antiAmplification.ts](src/features/pointStanding/antiAmplification.ts). *Model:* exists; surface it. *Tier:* **[BRIDGE]**.
8. **Impasse Markup** — *Story:* "Make 'we're stuck' a real, calm state." *Frustration:* threads die ambiguously. *Model:* `StructuredImpasse` combiner. *Tier:* **[BRIDGE]**.
9. **Claim Dependency Map** — *Story:* "Show which conclusions hinge on which unresolved premises." *Frustration:* can't see what's load-bearing. *Model:* `ClaimDependency` (needs claim-identity). *Tier:* **[NORTH-STAR]**.
10. **Mediator Next-Step Prompt** — *Story:* "Tell me the single next useful move." *Files:* composer. *Model:* `MediatorNextAction`. *Tier:* **[BRIDGE]**.
11. **Observer Digest** — *Story:* "I'm watching — summarize what's unresolved." *Model:* board roll-up read-only. *Tier:* **[BRIDGE]**.
12. **1v1 Room Focus Mode** — *Story:* "Just show me my next move." *Tier:* **[BRIDGE]**.
13. **Public Room Seat/Voice Clarity** — *Story:* "Who can speak here?" *Files:* room header + [argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts). *Tier:* **[SHIP-NOW]**.
14. **Argument Health Snapshot** — *Story:* "Is my point complete in form (not correct)?" *Files:* composer + engine output. *Model:* form-completeness from engine flags. *Tier:* **[BRIDGE]**.
15. **Bridge-to-Source Prompt** — *Story:* "Ask for a source without sounding accusatory." *Files:* composer ask-source preset ([evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts) request kinds). *Tier:* **[SHIP-NOW]** copy / **[BRIDGE]** flow.

---

## 8. TypeScript mediator-state architecture proposal

**Not to be built in this card.** Type sketches + decision flow + module boundaries only.

### 8.1 Design stance

`deriveMediatorBoardState` is a **projection**, not a new engine. It re-reads the node graph through three existing pure models — `buildPointLifecycleMap` ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)), `deriveEvidenceDebts` ([evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts)), and the gallery temperament/bucket signals ([conversationGalleryModel.ts](src/features/debates/conversationGalleryModel.ts)) — plus persisted Family A–I observations, and renders them into mediator vocabulary.

Constraints (mirror [engine.ts](src/domain/constitution/engine.ts) + [pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)): **pure TS · no React · no Supabase · no fetch · no MCP call · no clock/randomness · deterministic · JSON-serializable · ban-list scanned · plain-language mapped · consumes persisted observations only · never a submission gate · preserves uncertainty (every marker carries `confidence` and may be `unknown`; the model never collapses an unknown into a verdict).**

### 8.2 Module boundary

```
src/features/mediator/
  mediatorBoardTypes.ts        // the types below
  deriveMediatorBoardState.ts  // pure orchestrator
  deriveOpenDisagreementPoints.ts
  deriveEvidenceDebtView.ts    // thin adapter over evidenceDebtModel roll-ups
  deriveImpasseMarkers.ts
  deriveResolutionPathways.ts
  mediatorPlainLanguage.ts     // plainLanguageForMediatorState + ban-list export
  __tests__/...
```

A hook (`useMediatorBoardState`, OUTSIDE the pure core) fetches the timeline map + artifacts + persisted observation rows and feeds the deriver. The room UI binds to the result. The core imports nothing from Supabase/React.

### 8.3 Type sketches (illustrative)

```ts
// Every marker is advisory, plain-language-mapped, and uncertainty-preserving.
export type MediatorConfidence = 'low' | 'medium' | 'high' | 'unknown';

export type DisagreementPointKind =
  | 'fact' | 'definition' | 'scope' | 'causal' | 'value'
  | 'evidence' | 'logic' | 'recollection' | 'unaxed';

export type MediatorStateCode =
  | 'open' | 'needs_evidence' | 'definition_not_shared' | 'scope_mismatch'
  | 'missing_mechanism' | 'value_tradeoff' | 'narrowed' | 'off_point'
  | 'accounts_differ' | 'key_detail_unavailable' | 'evidence_blocked'
  | 'structured_impasse' | 'resolved_or_settled';

export interface PointAnchor {
  nodeId: string;            // the move the point lives on (lifecycle cluster root)
  parentNodeId: string | null;
  targetExcerpt: string | null; // what it claims to address
}

export interface DisagreementPoint {
  id: string;                // === lifecycle clusterId (stable)
  anchor: PointAnchor;
  kind: DisagreementPointKind;
  state: MediatorStateCode;  // projected from lifecycle + debts + observations
  plainLabel: string;        // plainLanguageForMediatorState(state)
  confidence: MediatorConfidence;
  openEvidenceDebtIds: ReadonlyArray<string>;
  memberNodeIds: ReadonlyArray<string>;
  isAdvisory: boolean;       // true for impasse/off_point/etc.
}

export interface MediatorMarkup {        // per-node, what THIS move did to its point
  nodeId: string;
  pointId: string;
  primaryState: MediatorStateCode;       // the ONE chip a node shows
  deviation: NodeDeviation | null;
  evidenceDebtChipStatus: string | null; // reuse EvidenceDebtStatus
  confidence: MediatorConfidence;
}

export interface NodeDeviation {         // reuse rails + tangent model
  kind: 'off_point' | 'scope_mismatch' | 'tangent';
  plainLabel: string;
  postAnywayAlwaysAvailable: true;       // doctrine: advisory only
}

export interface EvidenceDebtView {      // adapter over evidenceDebtModel
  debtId: string; nodeId: string; kind: string; status: string;
  isBlocked: boolean;                    // NEW sub-reason (§10) — artifact unavailable
  plainLabel: string;
}

export interface DefinitionMismatch { pointId: string; term: string | null; bothUsed: boolean; sharedDefinitionConfirmed: false; }
export interface ScopeMismatch { pointId: string; replyNodeId: string; direction: 'broader' | 'narrower' | 'unknown'; }
export interface CausalChainGap { pointId: string; missingStepHint: string | null; }
export interface ValueClash { pointId: string; }
export interface RecollectionConflict { pointId: string; memoryNodeIds: ReadonlyArray<string>; verifiableNodeIds: ReadonlyArray<string>; confidence: MediatorConfidence; } // NORTH-STAR
export interface NonProvableKeyDetail { pointId: string; dependentNodeIds: ReadonlyArray<string>; }
export interface BlockedEvidencePath { debtId: string; artifactCategory: string | null; }

export interface ResolutionPathway {     // "what would distinguish these claims"
  pointId: string;
  steps: ReadonlyArray<{ code: string; plainLabel: string; available: boolean }>;
  anyAvailable: boolean;                 // false => candidate impasse
}

export interface StructuredImpasse { pointId: string; followedForm: boolean; openPathwayExists: false; remainingClaimNodeIds: ReadonlyArray<string>; }

export interface MediatorNextAction { pointId: string | null; code: string; plainPrompt: string; } // composer guidance

export interface MediatorBoardState {
  debateId: string;
  points: ReadonlyArray<DisagreementPoint>;
  markupByNodeId: ReadonlyMap<string, MediatorMarkup>;
  evidenceDebts: ReadonlyArray<EvidenceDebtView>;
  impasses: ReadonlyArray<StructuredImpasse>;
  pathwaysByPointId: ReadonlyMap<string, ResolutionPathway>;
  nextAction: MediatorNextAction | null;
  inputHash: string;                     // mirrors PointLifecycleMap.inputHash
}
```

### 8.4 Derivation functions (signatures + decision flow)

```ts
export function deriveMediatorBoardState(
  graph: ArgumentTimelineMapModel,        // existing surface model output
  observations: PersistedObservationView,  // Family A–I rows already in argument_machine_observation_results
  options: { nowMs: number; advisoryConfig?: LifecycleAdvisoryConfig },
): MediatorBoardState;

export function deriveOpenDisagreementPoints(graph, observations): ReadonlyArray<DisagreementPoint>;
export function deriveEvidenceDebt(graph, options): ReadonlyArray<EvidenceDebtView>;        // wraps deriveEvidenceDebts
export function deriveImpasseMarkers(point, observations): StructuredImpasse | null;        // exhausted + no pathway
export function deriveResolutionPathways(point, observations): ResolutionPathway;
export function plainLanguageForMediatorState(code: MediatorStateCode): string;             // ban-list scanned
```

**Decision flow for one point's `state`** (worst-priority-wins, reusing LIFE-001 ordering):
1. `archived_or_resolved` lifecycle → `resolved_or_settled`.
2. lifecycle `narrowed`/`conceded` (last) → `narrowed`.
3. open evidence debt on the cluster → `needs_evidence` (or `evidence_blocked` if the debt carries the new blocked sub-reason).
4. Family C says term ambiguous and no shared-definition confirm → `definition_not_shared`.
5. off-axis pressure / Family B `disputes_scope` → `scope_mismatch`.
6. value axis + no fact/evidence debt → `value_tradeoff`.
7. causal axis + unmet critical question (Family F) → `missing_mechanism`.
8. lifecycle `exhausted` AND `deriveResolutionPathways(point).anyAvailable === false` → `structured_impasse`.
9. rails non-responsive / tangent → `off_point` (advisory).
10. else → `open`.

Uncertainty is preserved: when inputs are insufficient (e.g. no observation rows for the cluster), the point's `confidence` is `unknown` and the state falls back to `open` — never to a stronger claim.

### 8.5 Why this is safe

It never calls a provider, never writes, never blocks. It only *re-reads* what the deterministic engine already accepted and what classifiers already stored post-fact. It is the same architectural shape as LIFE-001 and EV-003, both already merged and tested.

---

## 9. Existing classifier / MCP support map

Nine deployed families (A–I) + one frozen (J). Mapping to mediator concepts (sources: [nodeLabelTypes.ts](src/features/nodeLabels/nodeLabelTypes.ts), [machineObservationDefinitions/](src/features/nodeLabels/machineObservationDefinitions), [mcp-server/lib/](mcp-server/lib)):

| Family | Name | Keys | Mediator concept it powers | Status |
|---|---|---|---|---|
| A | parent_relation | 19 | "this responds to…" anchor; point deviation | Deployed |
| B | disagreement_axis | 17 | disagreement *kind*; scope mismatch; value clash | Deployed |
| C | misunderstanding_repair | 20 | definition mismatch; scope mismatch; off-point (`question_answer_mismatch`); repair pathway | Deployed |
| D | evidence_source_chain | 30 | evidence debt; blocked evidence (`flags_context_limit`, `creates_source_chain_gap`); observation-vs-inference | Deployed |
| E | argument_scheme | 19 | causal-chain gap (scheme detection) | Deployed |
| F | critical_question | 17 | missing mechanism (unmet CQ); pathway steps | Deployed |
| G | resolution_progress | 33 | narrowing/concession; synthesis-ready; impasse (`point_stalled`/`point_exhausted`/`stalemate`) | Deployed |
| H | claim_clarity | 12 | unclear claim/missing conclusion → "needs a clearer point" pathway | Deployed (production-enabled) |
| I | thread_topology | 21 | branch/merge; returns-to-prior-issue (recollection precursor) | Deployed (production-enabled) |
| J | sensitive_composer | 5 | composer-only sensitive markers (private notes) | **Frozen — do not enable** |

**Total: 193 entries across all 10 families (188 across the deployed A–I).** Counts are the "entries total" stated in each [machineObservationDefinitions/family*.ts](src/features/nodeLabels/machineObservationDefinitions) file header (the canonical descriptor registry, CLAUDE.md-consistent). Note two count caveats: (1) the **MCP-supported subset** is smaller than the descriptor set for the largest families — D and G are served to the classifier in batches (CLAUDE.md records D "30 keys / 22-key MCP subset", G "33 keys / 21-key MCP subset"), so "keys exposed to MCP" < "descriptor entries"; (2) raw-key array counts can differ from the header "entries total" for families with multi-key descriptors. When a card needs an exact number, read it from the family file, not this table.

**Boundary:** this assessment proposes *consuming already-persisted* observations. It does **not** propose enabling J or any dormant family, changing any production-enabled state, or arming any queue.

---

## 10. Missing data / model capabilities

What the mediator board cannot reliably do today, and the right layer for each.

| Capability | Why it's missing | Mediator state(s) it unblocks | Recommended layer | Tier |
|---|---|---|---|---|
| **Claim / statement identity (canonicalization)** | No "same claim asserted before" index | difference-of-recollection (1); claim-dependency map | MCP/classifier (cross-move) + persisted index | **[NORTH-STAR]** |
| **Evidence *availability* vs *owed*** | EV-003 models "owed/declined/stale" but not "exists but unavailable" | blocked-evidence-path (3) | Pure TS sub-reason on EvidenceDebt + a composer affordance to mark "blocked" | **[BRIDGE]** |
| **Recollection-conflict detector** | No detector compares incompatible memory claims | difference-of-recollection (1) | MCP/classifier (assess only; do not enable dormant) | **[NORTH-STAR]** |
| **Value-vs-fact terminal** | axis `value` exists but no "stop asking for proof, name the tradeoff" terminal | value-clash (7) | Pure TS (axis + absence of fact/evidence debt) | **[BRIDGE]** |
| **Structured-impasse combiner** | `exhausted` exists but isn't combined with "no pathway" | structured-impasse (10) | Pure TS (`deriveImpasseMarkers`) | **[BRIDGE]** |
| **"What would distinguish these claims" relation** | no derivation of available next steps per point | resolution-pathway; pathway checklist | Pure TS for deterministic subset; classifier for richer hints | **[BRIDGE]** |
| **Thread-level consensus marker** | Family I flags "references prior agreement" but not "both agreed on X" | narrowed/settled accuracy | Edge persisted state OR pure-TS derivation from G | **[BRIDGE]** |

Pure-TS-first wherever possible; classifier only where cross-move semantics are unavoidable; **no dormant-family activation** is proposed.

---

## 11. Puppeteer / browser user-test — plan and findings

**Did Puppeteer run?** Puppeteer/Playwright are **not installed** (confirmed: absent from [package.json](package.json) deps/devDeps and `package-lock.json`) and were **not installed** (no authorization). A **real browser pass did run** by a non-mutating substitute: the production web bundle was built locally and served, and the **Claude_Preview MCP** drove a headless render of the logged-out screen. Full report: `docs/testing-runs/2026-06-14-puppeteer-ux-assessment.md`.

**What ran (non-mutating, no credentials, no backend writes):**
```
npm run web:build           # expo export --platform web --output-dir dist  (exit 0; 751 modules; 2.78 MB)
npx serve dist -l 5050 --single
# Claude_Preview: preview_start → preview_eval (DOM/text/dims) on http://localhost:5050/
```
The local build has **no `.env`**, so Supabase is unconfigured and the app cannot reach the backend. That is exactly why this is safe: **only the logged-out `AuthScreen` was inspected — no login, no data, no mutation.**

**Real findings (journey #1 — first impression):**
- **F1 [P1] No value proposition.** The logged-out screen shows: brand logo, tagline "...Just get to the bottom of it", "Sign In", email/password. There is **no sentence explaining what CDiscourse is or does**, no sample, no learn-more link (`links: []`). A newcomer cannot answer "what is this?" before being asked to sign up.
- **F2 [P1] Browser tab title is `expo-scaffold`.** `document.title === "expo-scaffold"`, sourced from [app.json:3-4](app.json) (`name`/`slug` still the default). The in-app brand aria-label is "CivilDiscourse," so the title was simply never set.
- **F3 [P2 — operator-decision-aware, NOT a bug].** The masthead is **296 px tall** (logo image 288×432, `PROMINENT_LOGO_HEIGHT_PX = 288`, [AppHeader.tsx:100-116](src/components/AppHeader.tsx)) — **~41 % of a 720-px viewport** before the sign-in fields; on a phone it pushes the form below the fold. **This is a deliberate operator decision** ("render the logo at ≥3× its prior wide-band size and keep it uniform across every breakpoint," operator request 2026-05-26, recorded in the file) that **overrode** UX-001.1's own "header height does not bury the active board" band heights ([AppHeader.tsx:14-25](src/components/AppHeader.tsx)). Per this card's no-mutation/record-the-conflict rule, the recommendation is **not** "shrink it" — it is: *on the sign-in screen specifically*, decide whether brand-prominence should yield to form visibility. That is an **operator call**, surfaced here, not a unilateral change. (Logged-out-screen-only scoping keeps the in-app brand prominence intact.)
- **F4 [info] Graceful degradation works.** With no backend config the app shows a clear "Supabase is not configured…" alert rather than a white screen — good resilience (this message is build-config-only, not a product defect).
- **F5 [P3] Semantics double-up.** The masthead is exposed both as `<h1 role="heading">` and as a `<button>` with the same label; minor screen-reader redundancy.

**Capture limitation (reported honestly, not faked):** `preview_screenshot` timed out three times at 30 s — a capture-pipeline limitation with the react-native-web renderer; the DOM/text extraction succeeded. **No raster PNG was produced.** F1/F2/F3 are therefore DOM- and **source-grounded** rather than pixel-measured — F2 from [app.json:3-4](app.json), F3 from the `PROMINENT_LOGO_HEIGHT_PX` constant ([AppHeader.tsx:107](src/components/AppHeader.tsx)), F1 from [AuthScreen.tsx](src/features/auth/AuthScreen.tsx) (no value-prop node in the render tree). A true raster pass (and journeys 2–10) needs the **UX-TEST-001** harness (Puppeteer install — operator-gated). The faithful DOM-structure snapshot and extracted findings are saved under `.tmp/ux-mediator-assessment/` (`auth-screen-dom-snapshot.html`, `auth-screen-extract.json`).

**What could NOT run, and why (blockers):**
- Journeys 2–10 (create room, observer vs participant, read/respond, evidence, concede, impasse, mobile) require **auth + a live backend**, which means credentials and **runtime data mutation** — outside this card's boundary. They are specified as an operator-gated harness (UX-TEST-001) in `docs/designs/UX-MEDIATOR-CANDIDATE-CARDS.md`, with a draft script path `.tmp/ux-mediator-assessment/journeys.draft.md`.
- A raster screenshot path needs either Puppeteer (install — unauthorized) or a working capture against the deployed [dev host](https://dev-cdiscourse.netlify.app) (still logged-out only, to stay non-mutating).

---

## 12. Claude Code enhancement opportunities

How Claude Code + the repo's existing machinery can accelerate this product direction. Separated by where they may run.

### Dev-only (safe, no production surface)
1. **UX investigator swarm** — parallel read-only subagents over screens/components → a friction log (this assessment used the pattern). **[SHIP-NOW]** as a workflow.
2. **Browser journey harness** — Puppeteer (or the Claude_Preview MCP, as here) drives logged-out + fixture flows; DOM + screenshots feed Claude a friction report. Build on the web bundle (§11). **[BRIDGE]**.
3. **Synthetic hard-dispute fixtures** — reuse [corpusPoolDrivenPlanner.js](scripts/bot-fixtures/corpusPoolDrivenPlanner.js) + [generateStressScenarios.js](scripts/bot-fixtures/generateStressScenarios.js) to emit *impasse-shaped* node graphs (recollection, blocked-evidence, definition fight) for testing the mediator deriver. **[BRIDGE]**.
4. **Node-graph fixture generator for mediator states** — author fixtures whose expected `MediatorBoardState` is known, then assert the deriver. **[BRIDGE]**.
5. **Doctrine / ban-list copy auditor** — extend [auditUserFacingTerminology.js](scripts/ux/auditUserFacingTerminology.js) with the [doctrineBanList.ts](mcp-server/lib) token set; scan proposed mediator copy for verdict/person tokens. **[SHIP-NOW]**.
6. **Uncertainty-language linter** — assert every mediator label maps through `plainLanguageForMediatorState` and that "truth/verdict/winner" never appear. **[SHIP-NOW]**.
7. **Mediator-state reducer fuzzing** — randomize fixture graphs (deterministic seed, no `Math.random` per repo rule) and assert determinism + no banned output. **[BRIDGE]**.
8. **Accessibility review over component source + DOM** — apply [accessibility-targets](.claude/skills/accessibility-targets) to the board surfaces. **[SHIP-NOW]**.
9. **Corpus human-review summarizer** — reuse [aiArgumentIntelligenceReport.js](scripts/bot-fixtures/aiArgumentIntelligenceReport.js) to turn a synthetic dispute corpus into a "did the mediator label these correctly?" review. **[BRIDGE]**.
10. **Candidate-card drafter** — Claude drafts cards (this doc); the operator files them (the repo already has [github:ux-board](scripts/github) automation, operator-run). **[SHIP-NOW]**.

### Operator/admin-only
- Diagnostic packaging ([buildDiagnosticInspectPackage.js](scripts/diagnostics)) for safe, redacted board-state dumps. **[BRIDGE]**.

### Possible production (speculative, gated, non-blocking)
- A **server-side mediator-summary** that turns `MediatorBoardState` into a one-paragraph "what's unresolved" digest, **only** in an Edge Function, **gated + logged**, with a deterministic fallback, **never** an acceptance gate, **never** a verdict. Default preference remains the deterministic projection (§8); LLM phrasing is optional polish, not the source of truth. **[NORTH-STAR]**.

### Explicitly forbidden in production
- Any client-side AI call; any AI as submission gate; any truth/winner/intent verdict; any service-role/client leakage; any provider call that blocks, routes, or delays a post.

---

## 13. Simplification recommendations (ranked)

| Rank | Recommendation | Why | Files | Size | Risk | Card | Puppeteer-testable? |
|---|---|---|---|---|---|---|---|
| 1 | **Set product name + web title** (`app.json` name/display; fix `expo-scaffold`) | F2; brand integrity | [app.json](app.json) | XS | Low (note: `slug` change has EAS/deploy identity implications — change display/title, treat slug carefully) | UX-COPY-001 | Yes (assert `document.title`) |
| 2 | **Add a one-line value prop + "see an example" to the logged-out screen** | F1; first-run clarity | [AuthScreen.tsx](src/features/auth/AuthScreen.tsx) | S | Low | UX-COPY-001 | Yes |
| 3 | **Unify the noun**: pick "argument" for users; keep "debate" internal-only; retire user-facing "conversation"/"room" drift | C1 | [gameCopy.ts](src/features/arguments/gameCopy.ts), extend [auditUserFacingTerminology.js](scripts/ux/auditUserFacingTerminology.js) | S–M | Low | UX-COPY-001 | Yes (terminology audit) |
| 4 | **One primary state chip per node** (collapse chip-soup; details on tap) | C3 | [NodeLabelStrip.tsx](src/features/nodeLabels/NodeLabelStrip.tsx), [cardClassifierStripModel.ts](src/features/arguments/cardView/cardClassifierStripModel.ts) | M | Medium | UX-MEDIATOR-002 | Yes (assert ≤1 primary chip) |
| 5 | **Auth-screen masthead height — OPERATOR DECISION, not a unilateral fix.** Surface the trade (296 px logo = ~41% of the auth viewport) and ask whether the sign-in screen specifically should use a smaller logo. Do **not** change the 288 px prominence without operator sign-off (it was an explicit 2026-05-26 operator request). | F3 | [AppHeader.tsx:100-116](src/components/AppHeader.tsx) | XS (if approved) | **Operator-gated** (changing an operator decision) | UX-COPY-001 (decision item) | Yes (assert header height) |
| 6 | **Rename `moderator`→ a distinct user word** (resolve the "Observer" collision) | C9 | [gameCopy.ts](src/features/arguments/gameCopy.ts) | XS | Low | UX-COPY-001 | Partial |
| 6b | **Audit `STATUS_COPY` comparative-standing strings** — `currentlyAhead: 'Currently ahead'` / `moreSupported: 'More supported'` are verdict-adjacent ("ahead" implies relative winning), exported in `ALL_COPY`. Confirm whether any UI renders them; if so, reframe to structural copy ("Pressure on this point" / "More sources attached"). | doctrine §1/§2 (heat ≠ truth) | [gameCopy.ts:72-75](src/features/arguments/gameCopy.ts); widen [auditUserFacingTerminology.js](scripts/ux/auditUserFacingTerminology.js) scope | XS–S | Low | UX-COPY-001 | Yes (render check) |
| 7 | **Promote ask-source / ask-quote out of the Act popout** (one tap) | C6; mediator flow | [ArgumentSideActionRail.tsx](src/features/arguments/ArgumentSideActionRail.tsx) | S | Low | UX-SIMPLIFY-003 | Yes |
| 8 | **Public seat/voice line in room header** ("3 of 5 active · N watching") | C8; "comment thread" feel | room header + [argumentRoomCreationMatrix.ts](src/features/debates/argumentRoomCreationMatrix.ts) | S | Low | UX-SIMPLIFY-002 | Yes |
| 9 | **Prune or clearly gate the 9 design-only composer modes** (don't ship latent modes) | C4 | [argumentModeModel.ts](src/features/modes/argumentModeModel.ts) | S | Low | UX-SIMPLIFY-003 | N/A |
| 10 | **One disagreement-points rail replaces "read 40 messages to find the fight"** | C2/C7; the core vision | new `src/features/mediator/` + rail | L | Medium | UX-MEDIATOR-001 → 005 | Yes |

**Guiding test for every screen:** can a user move through *"What point are you responding to? → What's your claim? → What supports it? → What would distinguish the disagreement? → What's still unresolved?"* without first learning the system? Screens that fail this today: the composer (move-type vocabulary front-loaded), the node (chip-soup), the gallery (bucket names lean internal).

---

## 14. Candidate backlog cards

Full catalogue in `docs/designs/UX-MEDIATOR-CANDIDATE-CARDS.md`. Summary (card-code families per the charter):

- **UX-MEDIATOR-001** — pure-TS mediator-state model + `deriveMediatorBoardState` projection (no UI, no migration). **[BRIDGE]**
- **UX-MEDIATOR-002** — one-primary-chip node markup + timeline/board impasse markup. **[BRIDGE]**
- **UX-MEDIATOR-003** — evidence-debt + blocked-evidence-path surface (reuse EV-003 roll-ups + new "blocked" sub-reason). **[BRIDGE]**
- **UX-MEDIATOR-004** — definition / scope mismatch bridge UI. **[BRIDGE]**
- **UX-MEDIATOR-005** — Disagreement Points rail (first visible board, 3 states: Open / Needs evidence / Structured impasse). **[BRIDGE]**
- **UX-SIMPLIFY-001** — create-room / create-argument flow streamlining. **[SHIP-NOW/BRIDGE]**
- **UX-SIMPLIFY-002** — observer/participant + seat clarity. **[SHIP-NOW]**
- **UX-SIMPLIFY-003** — composer form-enforcement simplification (promote ask-source; prune latent modes). **[SHIP-NOW/BRIDGE]**
- **UX-TEST-001** — Puppeteer journey harness (operator-gated; needs creds + backend). **[BRIDGE]**
- **UX-COPY-001** — plain-language + first-run clarity (name/title, value prop, noun unification, masthead). **[SHIP-NOW]**

---

## 15. Recommended next three cards

1. **UX-MEDIATOR-001 — pure-TS `deriveMediatorBoardState` projection.** *Why first:* it is the spine of the entire vision, reuses [pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts) + [evidenceDebtModel.ts](src/features/evidence/evidenceDebtModel.ts), needs no migration/Edge/UI, and is fully unit-testable (mirrors LIFE-001/EV-003 purity). Lowest risk, highest leverage. Ships the `MediatorBoardState` other cards bind to.
2. **UX-MEDIATOR-005 — Disagreement Points rail (read-only, 3 states).** *Why second:* it makes the spine *visible* — the single most vision-advancing surface. Deterministic, observer-friendly, collapsible. First validating test: fixture room with three branches → rail anchors to the three correct nodes with the right three states.
3. **UX-COPY-001 — first-run clarity + vocabulary unification.** *Why third:* the cheapest legibility win, and the live browser pass (§11) already pinpointed the exact defects (title `expo-scaffold`, no value prop, oversized masthead, four-word noun sprawl). Validated by a screenshot/DOM assertion in the same harness.

Sequence rationale: **model → surface → clarity.** Each is independently shippable, each is right-sized to its blast radius, none requires a migration or a provider call.

---

## 16. North-star concepts worth exploring later

Each is labelled **[NORTH-STAR]**: ambitious, multi-card, validate model/UX assumptions first.

- **Claim Dependency Map** — a derived graph of which conclusions hinge on which unresolved premises. *Needs:* claim-identity (§10). *Pain:* you can't see what's load-bearing. *Risk:* implying a "weak point" reads as a verdict; must stay structural.
- **Recollection Split** — separate memory claims from verifiable claims and mark "accounts differ." *Needs:* recollection-conflict detector + claim-identity (both new, classifier-layer; assess only — do not enable dormant families). *Risk:* "someone is lying" is the failure mode; copy must be airtight.
- **"What would distinguish these claims?" generator** — richer pathway hints than the deterministic subset. *Server-side, gated, logged, deterministic fallback, never a gate.*
- **Server-side mediator digest** — one-paragraph "what's unresolved" for observers/notifications, Edge-only, gated, non-blocking, with deterministic fallback. *Default remains the pure projection.*
- **Cross-room mediator pattern library** — corpus-derived catalogue of common impasse shapes to seed fixtures + copy. Dev/research only.

---

## 17. Doctrine and safety boundaries

This assessment is bound by [cdiscourse-doctrine](.claude/skills/cdiscourse-doctrine), [evidence-doctrine](.claude/skills/evidence-doctrine), [point-standing-economy](.claude/skills/point-standing-economy), [timeline-grammar](.claude/skills/timeline-grammar), and the [pipeline-governance-contract](docs/core/pipeline-governance-contract.md).

- **The deterministic Constitution engine is the sole submission gate.** The mediator board is a read-only projection; it never blocks, rejects, routes, delays, or labels a post.
- **No truth oracle.** No state, label, or copy may declare right/wrong, true/false, winner/loser, liar, bad faith, manipulative, or any person/intent judgment. Banned tokens are enforced by existing ban-list tests ([_forbiddenLifecycleTokens](src/features/lifecycle/pointLifecycleModel.ts), [refereeBannerBanList](src/features/refereeBanners)).
- **Popularity ≠ evidence.** Engagement/heat never grants factual standing; [antiAmplification.ts](src/features/pointStanding/antiAmplification.ts) semantics are preserved. Engagement credit and factual-standing eligibility stay separate.
- **Observations vs Allegations** boundary preserved ([nodeLabelTypes.ts](src/features/nodeLabels/nodeLabelTypes.ts)): machine signals are Observations, never imputed to a person; sensitive observations stay composer-only.
- **Uncertainty is preserved, not collapsed.** Every mediator marker carries a confidence and may be `unknown`; insufficient input falls back to `open`, never to a stronger claim.
- **No dormant-family activation.** This doc assesses Families A–I (deployed) and J (frozen) without proposing any enablement, production-state change, or queue arm.
- **Plain language only.** Every code maps through a plain-language function; unknown codes are suppressed.

**Boundary attestation:** No runtime mutation, no provider call, no queue arm, no Supabase config write, no deployment, no H/I/J flip, no service-role/client leakage, no issue creation. Assessment + docs only.

---

## 18. Governance, verification & grounding log (rehab addendum)

This section runs the assessment through the [CDiscourse Pipeline Governance Contract v1](docs/core/pipeline-governance-contract.md). It is added in the governance-aligned rehab pass.

### 18.1 Governance classification

This pass is a **read-only research / audit workflow that produces docs-only artifacts.** Per the contract it inherits **§3 (HALT)** and **§4 (never-self-approve)** but does **not** run the full stage machine (§6: "Read-only research/audit workflows … inherit only §3 and §4"). It is **not** an implementation card's DESIGN stage (no code follows it in this pass), so there is no GATE-A/B obligation here; the *merge* of these docs is governed by §5.

- **§4 surfaces touched:** none. No guard/test/bar changed; no migration/Edge/Deno/secret/cron/routing; no `familyRegistry` flip; no provider spend.
- **Acceptance-gate invariant (§1):** upheld — the proposed mediator board is a read-only projection, never a submission gate.
- **HALT conditions encountered:** none requiring stop. One **recorded conflict** (§18.4) where a recommendation would have crossed an operator decision; per the spec it was reframed as a decision item, not actioned.

### 18.2 Automerge eligibility (the 10 conditions)

Evaluated against this card's automerge policy:

| # | Condition | Status |
|---|---|---|
| 1 | Docs-only, except unstaged `.tmp/` | ✅ 3 docs under `docs/`; `.tmp/` ignored (`.tmp/.gitignore`) |
| 2 | No product source code changed | ✅ verified (`git status` docs-only) |
| 3 | No Supabase runtime/config changed | ✅ none |
| 4 | No package/dependency files changed | ✅ none |
| 5 | No secrets in diffs/logs/screenshots/docs | ✅ secret scan clean (§18.5) |
| 6 | Required checks pass, or skipped checks documented | ✅ `typecheck` 0 · `lint` 0 · `test` **798/798 suites green** on a clean run (§18.5; one earlier run had 2 pre-existing full-suite-load flaky timeouts that did not reproduce and pass in isolation — documented, non-blocking, and impossible for a docs-only change to cause). The only CI (`.github/workflows/audit-lint.yml`) is path-filtered to `docs/audits/**SMOKE*.md` and does **not** fire on these paths — documented as non-blocking |
| 7 | Docs pass doctrine/ban-list review | ✅ ban-list scan clean; tokens appear only in avoid-framing (§18.5) |
| 8 | Grounded vs speculation distinguished | ✅ reading guide + per-section markers; verified by grounding workflow |
| 9 | No fake Puppeteer findings | ✅ raster-capture limitation reported honestly; findings are DOM/source-grounded |
| 10 | Governance docs permit automerge for this change type | ✅ §5 permits autonomous green merge of docs-only PRs that define **no** operative semantics; this is design-notes/audit, not semantics-defining |

**Verdict: automerge-*eligible* per the 10 conditions and §5 — but held at "eligible, not merged."** Rationale: this assessment is **direction-setting** (it proposes the next three cards and a mediator architecture). The contract names the operator as **sole approver** and instructs "when in doubt, treat it as a deploy and ask" (§5). A direction-setting doc sits at the boundary between "design-notes (autonomous)" and "semantics an operator should ratify," so the conservative, contract-faithful action is to do all autonomous work (branch + commit + push + PR + verification) and leave the **final squash-merge as the operator's GATE-C call.** Exact merge command is provided in the final hand-off.

### 18.3 Merge-vs-deploy analysis

- **Supabase auto-deploy** (functions/migrations on merge to `main`) — **N/A**; no `supabase/**` change.
- **Netlify** rebuilds the web bundle on merge to `main`, but a docs-only change produces an **identical bundle** (no `src/` change) — not a behavior deploy. Per §5 this is **not a deploy**.
- **mcp-server** — untouched.
- Net: merging these docs is **not a deploy**.

### 18.4 Recorded conflicts (per the "record the conflict" rule)

1. **Auth masthead height vs operator decision.** A first-impression finding (F3) would naturally recommend shrinking the 296 px masthead. But `PROMINENT_LOGO_HEIGHT_PX = 288` is an explicit operator request ([AppHeader.tsx:100-116](src/components/AppHeader.tsx), 2026-05-26) that overrode UX-001.1's band heights. Recommending a silent change would cross an operator decision (§4 spirit). **Resolution:** reframed F3 and §13 row 5 as an **operator decision item**, not an action.
2. **`STATUS_COPY` comparative-standing strings.** [gameCopy.ts:72-75](src/features/arguments/gameCopy.ts) exports `'Currently ahead'` / `'More supported'` — verdict-adjacent under doctrine §1/§2 — even though [gameCopy.ts:810](src/features/arguments/gameCopy.ts) comments that bookkeeping "never asserts who … is ahead." **Resolution:** logged as a copy finding (§13 row 6b) with "render usage unconfirmed"; recommend widening the terminology auditor — not a unilateral copy edit.

### 18.5 Grounding & corrections log

Independent read-only verification ran as Workflow `wf_cd878835` (8 Explore agents: 6 verify lanes + copy-safety audit + grounding-completeness critic; ~6.5 min; 264 tool uses). Outcome: **79 claims grounded, 6 refuted, 4 uncertain; critic verdict "minor-fixes."**

**Factual corrections applied to this doc:**
- **Lifecycle states 18 → 19.** The `PointLifecycleState` union lists 19 values; the file's own header comment says "18" (a known lag recorded in [AN-003.md §D5](docs/designs/AN-003.md)). Fixed in §1, §2.4.
- **Family key counts.** §9 family **E** corrected 18 → 19; a per-family-count caveat + the correct totals (193 across 10; 188 across A–I) added, sourced from each [family*.ts](src/features/nodeLabels/machineObservationDefinitions) header. (The "171 across 9" phrasing in §2.4/C2 was corrected.)

**Resolved subagent disagreement (right way to handle it).** The MCP-classifier verify lane reported higher counts (D:32, E:21, F:19, G:35, I:23) than the form/graph lane (E:19). Rather than pick one, I went to ground truth — the descriptor file headers (`* N entries total`), cross-checked against CLAUDE.md (D "30 keys / 22-key MCP subset", G "33 keys / 21-key MCP subset"). The headers (A:19 B:17 C:20 D:30 E:19 F:17 G:33 H:12 I:21 J:5) win; the higher numbers are raw-key/registry overcounts. Caveat added to §9 so the conflict can't silently re-appear.

**Uncertain claims kept (observed in this session, not re-runnable by a read-only agent):** the `npm run web:build` exit 0 / 751 modules / 2.78 MB result, and the absence of `.env` — both directly observed in this session's tool runs (the web build ran here; `ls` showed only `.env*.example`). They are reported as session-observed, not inferred.

**Verification pipeline results (this rehab pass):**
- `npm run typecheck` → **exit 0**.
- `npm run lint` (`eslint . --max-warnings 0`, whole tree) → **exit 0** — confirms no stray code/scratch contamination from the docs work.
- `npm run test` → run #1: 2 suites / 2 tests failed (`startArgumentInviteLinkBox.test.tsx` + one other, both **"Exceeded timeout of 5000 ms"**); **run #2: 798/798 suites, 31074 passed / 1 skipped, 0 failed**. `startArgumentInviteLinkBox.test.tsx` re-run **in isolation passed 13/13 in 1.8 s**. Conclusion: the run-#1 failures are the repo's known **full-suite-load flakiness** (wall-clock render timeouts under parallel load), **not** a regression — and a docs-only change touches zero code/test files, so it cannot affect test execution. **The test baseline is green** (clean run on record). The current true baseline is ~**31,075 tests / 798 suites** (CLAUDE.md's "1805 / 70" line is stale relative to HEAD).
- Secret-value scan over the three docs → **clean**. Ban-list scan → **clean** (verdict/person tokens appear only in avoid/forbidden framing). `git status` → **docs-only**; `.tmp/` + `dist/` remain git-ignored.

### 18.6 Accepted completeness refinements (from the critic)

Folded in or forward-pointed (none change doctrine):

| Item | Disposition |
|---|---|
| `MediatorMarkup.primaryState` priority when a node has multiple concepts | §8.4 decision flow is worst-priority-wins; the explicit ranking reuses LIFE-001's `LIFECYCLE_PRIORITY` ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts)) — captured as a UX-MEDIATOR-001 test requirement |
| StrengthBand (timeline-grammar) vs `MediatorConfidence` | The board uses **structural state**, never the per-node StrengthBand visual signal (stroke/glow) — they are orthogonal and must not be conflated (a strength band is not truth). Noted for UX-MEDIATOR-002 |
| `off_point` marker vs existing tangent-advisory surface | Reconcile: the mediator `off_point` should **reuse** the existing rails/tangent advisory output, not add a second signal on the same node (avoid duplicate). UX-MEDIATOR-002 scope |
| `MediatorBoardState` caching / invalidation | Re-derive on view; reuse the existing `inputHash` pattern ([pointLifecycleModel.ts](src/features/lifecycle/pointLifecycleModel.ts) `inputHash`) as the cache key. UX-MEDIATOR-001 |
| Determinism fixtures | UX-MEDIATOR-001 test plan requires same-input→deep-equal + ban-list-over-labels (per [test-discipline](.claude/skills/test-discipline)) |
| Why Family I `returns_to_prior_issue` is insufficient for recollection | It flags a *return*, not a *contradiction between two memory claims*; recollection needs claim-identity to compare the two assertions — hence [NORTH-STAR], not a Family-I bootstrap |
| Diagnostics export for mediator-state | add a redacted board-state dump to the diagnostics packager ([buildDiagnosticInspectPackage.js](scripts/diagnostics)) — §12 operator-tooling |
| Rail scope | the Disagreement Points rail (UX-MEDIATOR-005) is **in-room only**, not in the gallery |
| Raster F3 / Puppeteer | UX-TEST-001 (operator-gated) provides the raster pass |
| Widen ban-list auditor to all `COPY` objects | §13 row 6b + UX-COPY-001 |

**Boundary attestation (rehab):** No runtime mutation, no provider call, no queue arm, no Supabase config write, no deployment, no H/I/J flip, no service-role/client leakage, no issue creation unless explicitly authorized. The grounding workflow was read-only; all writes are docs under `docs/` on the main thread.
