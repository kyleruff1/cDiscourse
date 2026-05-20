# MCP semantic-referee — prompt-library seed bank

**Status:** Design draft (MCP-002 deliverable)
**Owner card:** [MCP-002](https://github.com/kyleruff1/cDiscourse/issues/155)
**Contract:** [`docs/designs/MCP-001.md`](../designs/MCP-001.md) — every seed binds to `SemanticBinarySample`.
**Roadmap:** [`docs/roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md`](../roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md)
**Prompt version:** `mcp-semantic-referee-prompt-v0`

> **Design-only.** This is the durable seed bank. No live model call is made by creating or maintaining it. A future implementation card may move these seeds into `src/features/semantic/semanticPromptCatalog.ts` and/or `infra/mcp/prompts/semantic-referee/*.md`; until then they live here.

---

## What a seed is

A **seed** is one tightly bounded yes/no structural question that a low-cost model answers with a single `0/1`, wrapped in a `SemanticBinarySample` object. Every seed:

- asks about the **move and the text**, never about the **person**;
- asks a **structural / play-quality** question, never a **truth** question;
- has a deterministic fallback so the layer degrades gracefully;
- maps to plain-language user-facing copy — the raw `classifierId` and `reasonCode` never reach a user.

90 seeds across seven families (A–G). Catalog v0 (MCP-001 §8) ships a curated 23; the bank holds 90 so the catalog can grow without a contract change.

## Doctrine ban-list (excluded from every seed field, reason code, and copy string)

`liar · lying · dishonest · bad faith · manipulative · troll · propagandist · extremist · wrong · right · true · false · winner · loser · won · lost · proven · defeated · stupid · idiot · dumb · smart` — and any other verdict-on-a-person or truth-verdict token. Seeds classify the move; the ban-list is enforced by `__tests__/semanticPromptBanList.test.ts` (MCP-002).

## Shared inputs

Unless a seed says otherwise, every seed receives: redacted parent body + parent `argumentType` + parent `sourceChainStatus` + parent `lifecycle`; redacted move body + move `argumentType` + move `selectedTags` + optional `targetExcerpt`; `roomContext` (`mode`, `isPublicRoom`, `participantRole`, `turnCount`); `allowedValues: [0, 1]`. Bodies are redacted (MCP-001 §20) before they enter a prompt.

---

## §A — Parent continuity classifiers (12)

Can the system tell whether the move answered the selected parent? Reason-code family: `parent_continuity_*`. Deterministic fallback for all: parent-id presence + META-001 same-axis auto tag.

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| A1 | `responds_to_parent_directly` | the move directly engages the parent's claim, mechanism, question, evidence, or requested clarification | high — a topical move that subtly shifts axis | "Clean parent tie." |
| A2 | `responds_to_parent_partially` | the move engages one part of the parent but leaves the central pressure unanswered | medium | "Answers part of it — the main point is still open." |
| A3 | `quotes_parent_relevantly` | the move quotes/paraphrases a parent span and the body addresses that span | low | "Nicely anchored to their words." |
| A4 | `quote_is_decorative_only` | the move includes a quote but the body does not respond to it | medium | "The quote is here, but the reply hasn't used it yet." |
| A5 | `answers_question_asked` | the parent asked a question and the move gives a usable answer | medium | "That answers the question on the table." |
| A6 | `dodges_question_asked` | the parent asked a question and the move keeps arguing without answering | high — terse answers read as dodges | "The question asked is still waiting for an answer." |
| A7 | `keeps_same_disagreement_axis` | the move stays on the same axis (fact / definition / causal / value / evidence / logic / scope / framing / source_chain) | medium | "Same thread of disagreement — good to follow." |
| A8 | `changes_axis_without_declaring` | the move silently changes the axis of disagreement | high | "This shifts what's being argued — say so, or branch it." |
| A9 | `introduces_new_issue` | the move raises a new issue that could be debated separately | medium | "This opens a new issue — branch it to keep both alive." |
| A10 | `reframes_parent_fairly` | the move restates the parent in a way its author would recognise | low | "Fair restatement of their point." |
| A11 | `straw_reframe_risk` | the move restates the parent more strongly/differently than it says | high — paraphrase is lossy | "Check the restatement — it may be stronger than what they said." |
| A12 | `mechanism_continuity` | the move identifies or challenges a causal/logical mechanism already in the parent | medium | "Good — this engages the actual mechanism." |

---

## §B — Branch / tangent routing classifiers (12)

Mainline vs vertical chime-in branch vs diagonal tangent vs outer-realm lane. Reason-code family: `branch_routing_*`. Deterministic fallback: BR-001 branch kind + BR-003 `assessTangentRisk` + GAME-004 actor role + GAME-006 jump ledger. Feeds MCP-001's `routeSuggestion`; advisory input to BR-003 / BR-004 / GAME-005 / GAME-006.

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| B1 | `mainline_eligible` | the move belongs on the active 1v1 mainline | medium | "This belongs on the main line." |
| B2 | `vertical_chime_branch_recommended` | a third-party participant adds a same-topic perspective without becoming the main opponent | medium | "Looks like a chime-in — it'll sit on a side branch." |
| B3 | `diagonal_tangent_recommended` | two active participants move to a related but distinct issue | medium | "Related but different — a tangent branch keeps both clean." |
| B4 | `outer_realm_recommended` | the move is mostly noise / repetition / off-topic pressure / non-playable engagement | high — spicy ≠ noise | "This reads as low-signal here — a side lane fits it better." |
| B5 | `jump_branch_consumes_one_chance` | an already-engaged participant is making their one-time branch jump | low (deterministic-dominant) | "Heads up — this uses your one branch jump." |
| B6 | `branch_jump_not_allowed` | the participant has already used their jump-branch chance | low (deterministic-dominant) | "Your branch jump for this room is already used." |
| B7 | `tangent_is_productive` | the tangent is coherent enough to preserve in a diagonal lane | medium | "Good tangent — worth its own branch." |
| B8 | `tangent_is_escape_hatch` | the tangent appears to step around unresolved parent pressure | high | "The parent point is still open — finish it or branch on purpose." |
| B9 | `public_chime_constructive` | a third-party comment adds an answer / source / clarifying question / useful counter | medium | "Useful chime-in." |
| B10 | `public_chime_crowds_mainline` | the third-party comment would make the 1v1 unreadable on the mainline | medium | "Great point — it reads better on a branch so the 1v1 stays clear." |
| B11 | `branch_has_distinct_root_question` | a branch can be named with a clean root question | low | "This branch has its own clear question." |
| B12 | `branch_should_merge_back` | a branch has resolved enough to return to the parent thread | medium | "This branch looks done — bring it back to the main line." |

---

## §C — Evidence and source-chain classifiers (18)

Does a claim now carry evidence debt? Reason-code family: `evidence_*` / `source_chain_*`. Deterministic fallback: EV-001 `evidenceModel.ts` `sourceChainStatus` + META-001 evidence tags + anti-amplification lexicon. **Evidence state affects gameplay pressure, never a truth verdict.**

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| C1 | `asks_for_source` | the move requests origin / citation / primary source / receipt | low | "Source requested." |
| C2 | `asks_for_quote` | the move asks for the exact quote / excerpt | low | "Exact quote requested." |
| C3 | `provides_source` | the move includes or references an attached source artifact | low | "Source attached." |
| C4 | `provides_quote` | the move provides an excerpt / quotation / transcript / record | low | "Quote provided." |
| C5 | `evidence_attached_but_not_connected` | evidence exists but does not clearly support the claim made | high | "Evidence is here — connect it to the exact claim." |
| C6 | `evidence_directly_supports_claim` | the evidence appears to support the exact claim in the move | high | "The evidence lines up with the claim." |
| C7 | `evidence_supports_weaker_claim` | the evidence supports a narrower version, not the broad claim | high | "The evidence supports a narrower version — narrow the claim or add more." |
| C8 | `source_chain_gap_origin` | there is no origin / primary-source path | medium | "No origin yet — where did this come from?" |
| C9 | `source_chain_gap_quote` | a source exists but no quote / relevant excerpt is attached | medium | "Source is here — the exact quote is still needed." |
| C10 | `source_chain_gap_context` | the quote exists but likely needs surrounding context | high | "The quote may need its surrounding context." |
| C11 | `source_chain_broken_link` | the move claims a source trail but the trail is broken / missing | medium | "The source trail has a missing link." |
| C12 | `satire_or_parody_detected` | the cited item appears to be satire / parody / meme / fiction | high | "The cited item looks like satire — worth checking." |
| C13 | `satire_used_as_evidence` | satire / parody is being used as factual support | high | "Satire can't carry the claim — a real source can." |
| C14 | `retraction_or_correction_cited` | the move cites a retraction / correction / update / changed record | medium | "A correction/retraction is on the record here." |
| C15 | `evidence_of_misreporting_claimed` | the move claims a report was misleading / corrected / misreported | high | "This claims a report was off — anchor that to the record." |
| C16 | `evidence_inception_needed` | the evidence itself needs evidence (authenticity / chain-of-custody / validity) | high | "The evidence itself needs backing — who/what stands behind it?" |
| C17 | `popularity_used_as_evidence` | likes / shares / virality / "everyone says" is doing evidentiary work | high | "Popularity isn't proof — what's the source?" |
| C18 | `expertise_claim_without_source` | the move rests on authority / expertise but gives no source | medium | "Expertise noted — a source makes it land." |

---

## §D — Constructive movement classifiers (14)

Has the argument moved forward? Reason-code family: `movement_*`. Deterministic fallback: LIFE-001 lifecycle state + META-001 manual tags (`narrowed_claim`, `concession_offered`, `ready_for_synthesis`).

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| D1 | `narrows_claim` | the move limits a broader claim to a more defensible scope | medium | "Nice narrowing move." |
| D2 | `concedes_narrow_point` | the move accepts a specific limited point | medium | "Narrow concession noted." |
| D3 | `concedes_broad_point` | the move accepts the central dispute / sets down the broad claim | medium | "Broad concession offered." _(never "lost")_ |
| D4 | `clarification_request` | the move asks what the other person means | low | "Clarification asked." |
| D5 | `clarification_answered` | the move answers a previous clarification request | medium | "Clarification answered." |
| D6 | `definition_issue` | the disagreement rests on what a term means | medium | "This turns on a definition — pin the term." |
| D7 | `scope_issue` | the disagreement rests on over-breadth / boundary conditions | medium | "This is a scope question — where are the edges?" |
| D8 | `causal_mechanism_issue` | the disagreement rests on how one thing causes another | medium | "This is about the mechanism — name how it works." |
| D9 | `value_priority_issue` | the disagreement is value ordering, not fact | medium | "This is a values question, not a facts one." |
| D10 | `synthesis_candidate` | clear shared ground plus limited unresolved debt | medium | "Almost a synthesis — name the shared point." |
| D11 | `synthesis_premature` | synthesis is suggested before evidence / core parent pressure is answered | high | "Synthesis is early — the open point still needs an answer." |
| D12 | `point_exhausted_candidate` | the thread has repeated itself enough that moving on is reasonable | high | "This point has gone in a circle — moving on is fair." |
| D13 | `ignored_by_side_candidate` | one side repeatedly bypasses a direct source/quote/clarification request | high | "A direct request keeps going unanswered." |
| D14 | `ready_to_mark_moved_on` | continuing here is lower-value than branching or synthesizing | high | "This may be a good spot to branch or synthesize." |

---

## §E — Debate-mode fit classifiers (12)

Does the move fit the room's selected mode? Reason-code family: `mode_fit_*`. Deterministic fallback: GAME-003 mode profile + `allowedInformality`. **Mode fit is a gameplay-register question, never tone-policing the person.** This family folds in the work originally sketched as MCP-005; the mode taxonomy itself is owned by GAME-003 (#119).

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| E1 | `fits_domestic_bickering_mode` | the move fits an interpersonal dispute where feelings, recollection, intent, repair are expected | medium | "Fits the room — this is a repair conversation." |
| E2 | `violates_domestic_bickering_mode` | the move over-legalizes / over-evidences a relationship-repair mode | high | "This room is for repair — receipts may not be the move here." |
| E3 | `fits_parental_custody_mode` | the move uses child-centered, factual, careful framing | medium | "Fits the room — child-centered and careful." |
| E4 | `violates_parental_custody_mode` | the move escalates person attacks / unsupported accusations in a high-stakes mode | high | "High-stakes room — keep it on facts, not the other person." |
| E5 | `fits_court_record_mode` | the move uses evidence, specific claims, source-chain discipline, minimal rhetoric | medium | "Fits the record mode — specific and sourced." |
| E6 | `violates_court_record_mode` | the move is mostly rhetoric / jokes / popularity / vibes in a strict record mode | high | "Record mode wants specifics — anchor this." |
| E7 | `fits_political_debate_mode` | the move is argumentative, sourced when factual, not person-classifying | medium | "Fits the room — argued and sourced." |
| E8 | `fits_historical_debate_mode` | the move distinguishes memory, primary sources, interpretation, uncertainty | medium | "Fits the room — sources and interpretation kept separate." |
| E9 | `fits_recollection_disconnect_mode` | the move recognises a memory mismatch and asks for anchoring details | medium | "Fits the room — anchoring the memories." |
| E10 | `fits_devil_advocate_mode` | the move tests a claim without pretending certainty | medium | "Fits the room — testing the claim, not asserting it." |
| E11 | `hot_take_but_playable` | the move is spicy / funny / contrarian / inflammatory but still a coherent claim | high — playable ≠ suppressible | "Spicy, but playable." |
| E12 | `hot_take_without_mechanism` | the move is provocative but gives no mechanism / evidence path / answerable claim | high | "Hot take — give it a mechanism and it lands." |

---

## §F — Friction / pause / UX feedback classifiers (12)

Should the UI show a pause or a cleaner-lane prompt? Reason-code family: `friction_*`. Deterministic fallback: GAME-002 pacing state + GAME-003 mode strictness + structural validation. **Friction only ever advises; it never hard-gates an ordinary post.** Feeds RULE-004's `PreSendReviewSheet` (this family folds in the work originally sketched as MCP-007).

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| F1 | `pre_send_pause_recommended` | the move could be repaired by the author before sending | high | "A quick look before you send — want to tighten it?" |
| F2 | `post_submit_soft_feedback_only` | the move should post freely and be classified only after submission | low | _(no copy — silent route)_ |
| F3 | `needs_choose_lane_prompt` | the move should ask "reply here, branch, or tangent?" | medium | "Reply here, branch, or tangent?" |
| F4 | `needs_source_prompt` | the next useful prompt is "ask for a source" | medium | "Ask for a source." |
| F5 | `needs_quote_prompt` | the next useful prompt is "ask for the exact quote" | medium | "Ask for the exact quote." |
| F6 | `needs_define_terms_prompt` | the next useful prompt is "define the term" | medium | "Define the term." |
| F7 | `needs_scope_prompt` | the next useful prompt is "narrow the claim" | medium | "Narrow the claim." |
| F8 | `needs_mechanism_prompt` | the next useful prompt is "name the mechanism" | medium | "Name the mechanism." |
| F9 | `cooldown_notice_recommended` | the user is posting rapidly in a mode with pacing rules | low (deterministic-dominant) | "Pacing is on in this room — a short beat helps." |
| F10 | `daily_turn_limit_notice_recommended` | room settings impose a daily-message / turn-pacing cap | low (deterministic-dominant) | "This room has a daily move limit." |
| F11 | `friction_would_feel_punitive` | a proposed pause/block would feel arbitrary given the metadata | high — this is the guard | _(suppresses the friction — no user copy)_ |
| F12 | `manual_override_should_be_offered` | the system is uncertain and should let the user choose the lane | medium | "You decide — pick where this goes." |

---

## §G — Fun referee banner classifiers (10)

Playful, non-verdict banner triggers. Reason-code family: `banner_*`. These feed MCP-008's banner library. **They must not insult the user** — they describe the move and stay encouraging.

| # | Classifier ID | `value: 1` when | False-positive risk | User-facing copy |
|---|---|---|---|---|
| G1 | `clever_rebuttal_detected` | the move is sharp and logically relevant | medium | "Sharp — and it stays on point." |
| G2 | `funny_but_relevant_detected` | humor is used while still answering the parent | medium | "Funny, and it still answers the parent." |
| G3 | `pop_culture_reference_detected` | the move uses a recognisable cultural reference and is not only that | low | "Nice reference — and there's a real point under it." |
| G4 | `unpopular_opinion_detected` | the move is likely a minority/contrarian position but coherent | high | "Unpopular take — coherent, though." |
| G5 | `probably_immediate_pushback_detected` | most readers would challenge the move quickly | high | "Expect quick pushback on this one." |
| G6 | `hard_hitting_but_needs_receipt` | the rebuttal is forceful but needs source support | medium | "Hard hit. Now anchor it." |
| G7 | `logic_gap_opened` | the move exposes a clear missing link in the parent's reasoning | medium | "You found a gap — now pin it to the exact step." |
| G8 | `story_inconsistency_opened` | the move identifies an inconsistency in timeline / memory / sequence | high | "There's a mismatch in the account — worth nailing down." |
| G9 | `evidence_hole_opened` | the move shows the other side's evidence does not cover the claim | high | "Good pressure — the evidence doesn't cover the whole claim yet." |
| G10 | `moderator_needs_less_heat_more_anchor` | the move is more rhetoric than anchor | high | "The move is fun, but the thread needs a mechanism." |

**More banner copy (non-verdict, playable):** "The map wants a mechanism." · "This probably belongs on a branch." · "Good pressure. Evidence debt opened." · "This is a hot take lane unless you attach receipts." · "This is almost a synthesis. Name the shared point." · "The referee likes the shape, but not the source-chain yet." · "This lands as a hot take unless you anchor it." Full ≥ 100-banner library is MCP-008.

---

## Prompt shapes

### System-prompt boilerplate (every call)

> You are a CDiscourse semantic classifier. Return strict JSON only. You do not decide who is right. You do not assign truth. You classify whether an argument *move* has one structural property of *game play*. The output is advisory metadata. Ordinary posts are not blocked by this result. Never describe or label the person. Values must be `0` or `1`.

### Single binary classifier prompt

User payload:

```json
{
  "classifierId": "responds_to_parent_directly",
  "debateMode": "political_debate",
  "selectedAction": "challenge",
  "parent": {
    "body": "<redacted parent body>",
    "argumentType": "claim",
    "sourceChainStatus": "no_source",
    "lifecycle": "source_requested"
  },
  "move": {
    "body": "<redacted move body>",
    "argumentType": "rebuttal",
    "selectedTags": ["scope_issue"],
    "targetExcerpt": "<optional excerpt>"
  },
  "allowedValues": [0, 1]
}
```

Expected output:

```json
{
  "classifierId": "responds_to_parent_directly",
  "value": 1,
  "confidence": "medium",
  "reasonCode": "parent_continuity_answers_scope_claim",
  "evidenceSpan": "<optional short span from move>",
  "parentSpan": "<optional short span from parent>"
}
```

### Five-classifier packet prompt

User payload:

```json
{
  "requestedClassifiers": [
    "responds_to_parent_directly",
    "introduces_new_issue",
    "evidence_attached_but_not_connected",
    "needs_choose_lane_prompt",
    "hot_take_but_playable"
  ],
  "roomContext": { "mode": "political_debate", "isPublicRoom": true, "participantRole": "primary_opponent", "turnCount": 8 },
  "parentContext": { "lifecycle": "source_requested", "sourceChainStatus": "no_source", "manualTags": ["needs_source"], "autoMetadata": ["has_rebuttal"] },
  "moveContext": { "selectedAction": "reply", "selectedMoveType": "rebuttal", "selectedTags": [], "body": "<redacted body>" }
}
```

Expected output (a partial `SemanticRefereePacket`):

```json
{
  "packetVersion": "mcp-semantic-referee-v0",
  "authoritative": false,
  "binaries": [
    { "classifierId": "responds_to_parent_directly", "value": 1, "confidence": "high", "reasonCode": "parent_continuity_direct_claim_response" },
    { "classifierId": "introduces_new_issue", "value": 0, "confidence": "medium", "reasonCode": "parent_continuity_same_axis" },
    { "classifierId": "evidence_attached_but_not_connected", "value": 0, "confidence": "low", "reasonCode": "evidence_none_attached" },
    { "classifierId": "needs_choose_lane_prompt", "value": 0, "confidence": "medium", "reasonCode": "friction_mainline_reply_ok" },
    { "classifierId": "hot_take_but_playable", "value": 1, "confidence": "medium", "reasonCode": "mode_fit_provocative_but_claim_shaped" }
  ],
  "routeSuggestion": "mainline",
  "frictionSuggestion": "soft_chip",
  "scoreHints": {
    "continuityCredit": 1, "evidencePressure": 1, "branchHygiene": 0,
    "synthesisReadiness": 0, "sourceChainDebt": 1, "unresolvedRedirectRisk": 0
  }
}
```

---

## Playable-content examples (spicy ≠ suppressed)

The seed bank deliberately keeps **spicy, funny, contrarian, devil's-advocate, and inflammatory-but-on-topic** content in play. Worked examples:

- **Hot take** — "Cars ruined cities, full stop." → `hot_take_but_playable: 1`, `hot_take_without_mechanism: 1`, `responds_to_parent_directly` depends on the parent. Banner: "Hot take — give it a mechanism and it lands." Routed to mainline, not outer-realm.
- **Funny + relevant** — a joke that still answers the parent → `funny_but_relevant_detected: 1`, `responds_to_parent_directly: 1`. Banner: "Funny, and it still answers the parent." Full continuity credit.
- **Devil's advocate** — "Steel-manning the other side: …" in `devil_advocate` mode → `fits_devil_advocate_mode: 1`. No friction.
- **Satire cited as fact** — `satire_or_parody_detected: 1` + `satire_used_as_evidence: 1`. Banner: "Satire can't carry the claim — a real source can." Evidence pressure rises; no truth verdict, no person label.
- **Insult-only** — a move that is only an insult with no claim → `contains_unplayable_insult_only: 1`, `outer_realm_recommended: 1`. Routed to a low-priority lane. The user still posts; the move is never deleted and the person is never labelled.

---

## Maintenance

- Each seed records the `promptVersion` it was last revised in; a wording change bumps `mcp-semantic-referee-prompt-v0` → `-v1` and invalidates the cache (MCP-001 §12, §18).
- New seeds append; ids never reused.
- Catalog v0 (MCP-001 §8) is the curated 23 that ship first; promoting a seed into the catalog is a contract review, not a wording change.
