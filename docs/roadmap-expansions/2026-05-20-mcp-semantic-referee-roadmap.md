# CDiscourse — MCP semantic-referee roadmap expansion (2026-05-20)

**Type:** Design-only roadmap expansion. No production code, no implementation, no live services, no provider keys read.
**Companion docs:**
- [`docs/designs/MCP-001.md`](../designs/MCP-001.md) — semantic-referee architecture + binary classifier contract (the anchor design doc).
- [`docs/semantic-prompts/mcp-semantic-referee-prompt-bank.md`](../semantic-prompts/mcp-semantic-referee-prompt-bank.md) — the 90-seed classifier prompt-library seed bank (MCP-002 deliverable).
- [`docs/roadmap-expansions/2026-05-20-pvp-argument-game-roadmap.md`](2026-05-20-pvp-argument-game-roadmap.md) — the PvP argument-game roadmap this expansion plugs into (filed on a sibling branch).
- [`docs/transcript-language-processing.md`](../transcript-language-processing.md) — the existing disabled-by-default `process-language-draft` Edge Function seam this layer reuses.

**Board:** GitHub Project #1. **Issues filed (new):** MCP-001, MCP-002, MCP-003, MCP-004, MCP-008, MCP-009, MCP-010.
**Issues NOT filed (deduped into existing cards):** MCP-005 → GAME-003 (#119), MCP-006 → BR-004 (#143) / BR-003 (#117) / GAME-005 (#142) / GAME-006 (#144), MCP-007 → RULE-004 (#114).
**Existing issues threaded / commented:** RULE-006 (#116), RULE-004 (#114), RULE-005 (#115), GAME-003 (#119), BR-003 (#117), BR-004 (#143), GAME-005 (#142), GAME-006 (#144).

---

## 1. Executive summary

CDiscourse's argument game already has a deterministic spine — the Constitution engine, the LIFE-001 lifecycle model, the META-001 tag/metadata ledger, the point-standing economy, the anti-amplification gate. What it does not have is a way to make the board feel like it has an **objective referee keeping points** when a move's *structure* is genuinely ambiguous to deterministic code — when the question is "did this reply actually answer the parent?" rather than "does this row have an evidence artifact attached?".

This expansion designs a **provider-agnostic semantic-referee layer**: a set of low-cost, tightly bounded classifier prompts that run only at strategic moments and return a compact packet of `0/1` booleans, bounded enums, short reason codes, confidence, and prompt/model versions. That packet is **advisory metadata only** — `authoritative: false`, always. It feeds downstream game feedback (route suggestions, branch chips, evidence-pressure prompts, "you are here" map context, playful referee banners) and the deterministic point-standing ledger as *one input among many*. It never decides who is right, never declares a winner, never blocks an ordinary post.

The layer is the concrete, MCP-framed answer to the open research question filed as **RULE-006** ("Semantic AI metadata strategy"). RULE-006 asked *whether and how*; this expansion answers *how*, with a three-layer architecture, a binary-classifier packet contract, a 90-seed prompt bank, a trigger/cost plan, and a referee ledger. It files **7 new MCP-** cards and explicitly **dedupes 3 proposed cards** into existing roadmap work rather than duplicating it.

The semantic referee is **objective about the rules of play, never about the truth.**

## 2. The problem this solves

The first-generation argument room used deterministic keyword matching to gate posts (`OFF_TOPIC`, `PARENT_NONRESPONSIVE`). Stage 6.2 had to convert those to advisory because keyword-only classification produced false positives that made the room feel like a cage — users "had to write using magic keywords" or be rejected. The doctrine response was correct (advisory, never blocking) but it left a gap: the deterministic layer can reliably answer *button-and-artifact* questions ("did the user tap Ask source?", "is there an evidence row?") and cannot reliably answer *structural-meaning* questions ("did this paragraph actually engage the parent's mechanism, or just restate a slogan?").

Without a way to answer the structural questions, the game cannot:
- tell continuity (answered the parent) from drift (changed the subject) without keyword brittleness;
- route a move to the mainline vs a chime-in branch vs a tangent without the user manually declaring it;
- tell "evidence is attached" from "evidence actually supports *this* claim";
- recognise a spicy-but-playable hot take and keep it in play instead of suppressing it;
- reward narrowing / conceding / clarifying / synthesising as constructive movement.

The semantic referee fills exactly that gap, and only that gap. It is the smallest layer that gives the deterministic game engine leverage over move *structure*.

## 3. Doctrine constraints (non-negotiable)

Every card in this expansion is bound by `cdiscourse-doctrine` and the following layer-specific rules. A violation is a blocker, not a comment.

1. **AI never decides who is right.** No classifier returns a truth value, a verdict, or a winner.
2. **AI never declares a winner / loser.** The referee scores *rules of play*, never *truth*.
3. **AI never blocks an ordinary post by itself.** Only deterministic structural validation (empty body, invalid transition, explicit-evidence-without-source, over-length, auth, opted-into cooldown) can block. The semantic packet can at most surface advisory friction.
4. **AI never runs on the client.** Calls live only in an Edge Function / server-side MCP adapter.
5. **`authoritative` is always `false`** for every semantic packet and every binary sample.
6. **Popularity, heat, virality, crowd reaction are never evidence** and never feed a classifier as a truth signal. `uses_popularity_as_evidence` classifies the *text move*, never ranks the crowd.
7. **Evidence and source-chain state affect gameplay pressure, never truth verdicts.** Engagement credit and factual-standing credit stay separate scores (per `evidence-doctrine` and `antiAmplification.ts`).
8. **No verdict / person labels in user-facing copy** — never *liar, dishonest, bad faith, manipulative, troll, propagandist, wrong, right, true, false, winner, loser, proven, defeated, extremist, stupid, idiot*. Classify the **move and the text behavior, never the person.**
9. **All semantic calls are mocked by default in tests and fixture-driven in development.** Live calls require a separate, explicit, operator-approved implementation card.
10. **No `snake_case` internal codes in user-facing strings.** Every `classifierId` and `reasonCode` maps through a plain-language catalog before it can reach a user surface (extends `gameCopy.toPlainLanguage`).

## 4. Product thesis

> The semantic referee makes CDiscourse feel like an enjoyable, structured, on-the-record disagreement with a referee who keeps points for *quality of play* — continuity, evidence hygiene, branch hygiene, constructive movement — and who never, ever tells you that you are right or wrong. It makes argument *structure* harder to manipulate (volume, drift, insult, crowd appeal naturally route to lower-priority lanes) without making the user feel caged, punished, or forced to write with magic keywords.

Three layers, kept strictly separate:
1. **Deterministic hardcoded metadata** — runs first, costs nothing, answers button/artifact/lifecycle questions. Authoritative for what it covers.
2. **Semantic MCP classifier** — runs only at gated moments, answers structural-meaning questions, returns advisory `0/1` packets. Never authoritative.
3. **Deterministic score / referee ledger** — converts layers 1 + 2 into play-quality feedback. The ledger is deterministic; the AI packet is one of its inputs, never its master.

## 5. Architecture overview

```
                ┌─────────────────────────────────────────────┐
  move drafted  │ Layer 1 — Deterministic metadata (free)     │
  / submitted   │ button, reply type, side, role, parent id,  │
 ─────────────► │ tags, source-chain status, evidence state,  │
                │ lifecycle, branch state, room mode, pacing  │
                └───────────────┬─────────────────────────────┘
                                │ obvious flags resolved here
                                ▼
                ┌─────────────────────────────────────────────┐
  gated moment  │ Layer 2 — Semantic MCP classifier           │
  only (§7)     │ Edge Function / server MCP adapter          │
                │ → strict JSON: binaries[], routeSuggestion, │
                │   frictionSuggestion, scoreHints            │
                │   authoritative: false                      │
                └───────────────┬─────────────────────────────┘
                                │ cached by {roomId,parentId,
                                │ contentHash,promptVersion,set}
                                ▼
                ┌─────────────────────────────────────────────┐
                │ Layer 3 — Deterministic referee ledger      │
                │ reconciles L1 + L2; on conflict downgrades  │
                │ confidence + surfaces a reversible choice   │
                │ → play-quality points, route chips,         │
                │   evidence-pressure prompts, banners        │
                └─────────────────────────────────────────────┘
```

Full detail in [`docs/designs/MCP-001.md`](../designs/MCP-001.md). The `SemanticRefereePacket` / `SemanticBinarySample` contract is the interface boundary between layers 2 and 3.

## 6. "Enough" metadata strategy

The layer deliberately does **not** collect everything. The minimal strategic set ("enough" at v0) is five families:

1. **Parent continuity** — `responds_to_parent`, `quote_anchors_parent`, `answers_clarification`, `introduces_new_issue`.
2. **Branch routing** — `suggests_side_branch`, `suggests_diagonal_tangent`, `fits_selected_debate_mode`, `contains_unplayable_insult_only`.
3. **Evidence pressure** — `asks_for_evidence`, `provides_evidence`, `evidence_supports_claim`, `creates_source_chain_gap`, `uses_popularity_as_evidence`, `cites_retraction`, `uses_satire_as_evidence`.
4. **Constructive movement** — `narrows_claim`, `concedes_narrow_point`, `requests_clarification`, `ready_for_synthesis`.
5. **Friction & pacing** — `needs_pre_send_pause`, `shifts_to_person_or_intent`, `contains_playable_hot_take`, `fits_selected_debate_mode`.

The layer explicitly **never** infers: personality, political identity, mental state, moral character, truthfulness, who is right, who won, or raw toxicity as a *person* label. Those are out of scope by doctrine, not by deferral.

## 7. Trigger gates (when the classifier may run)

**Allowed trigger moments** — post-submit classification for every move (feature-flagged); pre-send review only in strict room modes the room creator opted into; evidence-inspection classification on attach/challenge; branch-routing classification when reply-to-parent is ambiguous; synthesis-readiness classification once enough lifecycle events exist; referee-feedback generation **from already-classified metadata only**, never from raw conversation scraping.

**Forbidden trigger moments** — never on keystroke, never on hover, never on timeline selection, never on observer-only browsing, never twice for the same `{roomId, parentId, contentHash, promptVersion, classifierSet}` (cache the result).

This is owned by **MCP-004**.

## 8. The binary classifier contract

The semantic call returns a tiny strict JSON object — never a naked `1`/`0`. The packet shape (`SemanticRefereePacket`) carries `binaries: SemanticBinarySample[]`, a `routeSuggestion` enum, a `frictionSuggestion` enum, a `scoreHints` block, and provenance (`promptVersion`, `modelVersion`, `inputHash`, `authoritative: false`). Each `SemanticBinarySample` is `{ classifierId, value: 0|1, confidence, reasonCode, evidenceSpan?, parentSpan? }`.

Yes — a low-cost model *can* be asked to return just `1` or `0`, and for this use case that is the right pattern: the `0/1` lets the deterministic ledger score cheaply. But the call must wrap it in the object above. The `reasonCode` + `confidence` are what let layer 3 handle ambiguity, conflict, and false positives **without making the user feel trapped**. Confidence is **not a verdict** — it is the model's own uncertainty, and low confidence routes to a reversible user choice, never a penalty.

This is owned by **MCP-001**; the per-classifier seed definitions are owned by **MCP-002**.

## 9. The referee ledger

Layer 3 converts metadata into play-quality points. It **may** award/subtract for: continuity, direct response, evidence provided, evidence relevance, quote anchoring, narrowing, concession, clarification, synthesis, branch hygiene, avoiding person/intent drift, resolving evidence debt, staying in the selected mode, respecting pacing. It **must not** award for: popularity, heat, volume, being funny alone, rhetorical force alone, perceived truth, perceived political alignment, crowd vote, user identity, user reputation.

The scoreboard copy is playful but non-verdict — "Clean parent tie", "Strong source pressure", "This needs a quote anchor", "Nice narrowing move", "Evidence debt still open" — never "You are wrong / You lost / This is false / Bad faith".

This is owned by **MCP-003**, which consumes the existing `src/features/pointStanding/` economy and `antiAmplification.ts` as the deterministic substrate.

## 10. MCP card slate

### Filed as new issues (7)

| Card | Title | Priority | Effort | Release |
|---|---|---|---|---|
| **MCP-001** | Semantic referee architecture and binary classifier contract | P1 | M | 6.8 |
| **MCP-002** | Prompt-library seed bank for classifier prompts | P1 | M | 6.8 |
| **MCP-003** | Strategic semantic metadata ledger and scoring model | P1 | M | 6.8 |
| **MCP-004** | Trigger gates, caching, batching, and cost-control plan | P1 | M | 6.8 |
| **MCP-008** | Referee feedback banner library | P2 | M | 6.8 |
| **MCP-009** | MCP server / Edge Function boundary design | P1 | M | 6.8 |
| **MCP-010** | Semantic override and appeal UX | P2 | M | 6.8 |

### Deduped into existing cards — NOT filed (3)

| Proposed | Folds into | Rationale |
|---|---|---|
| **MCP-005** (debate-mode taxonomy + mode-fit classifiers) | **GAME-003 #119** | GAME-003 already owns the full 13-mode taxonomy and the room mode-setup flow, including the per-mode `semanticClassification: 'off' \| 'metadata_only' \| 'metadata_and_chip'` field. Creating MCP-005 would duplicate it. The genuinely-new part — the *mode-fit classifiers* (`fits_court_record_mode`, `violates_domestic_bickering_mode`, …) — is folded into the prompt seed bank §E and the MCP-001 catalog. A comment on GAME-003 links them. |
| **MCP-006** (public-room PvP routing + branch referee) | **BR-004 #143, BR-003 #117, GAME-005 #142, GAME-006 #144** | The structural routing layer is already fully owned: BR-004 owns the mainline / vertical-chime-in / diagonal-tangent **branch grammar**; BR-003 owns the **tangent routing logic**; GAME-005 owns **public seats + chime-in governance + downvote→observer**; GAME-006 owns the **Jump Branch** once-per-room rule. MCP-006 would duplicate four cards. The genuinely-new part — the *routing classifiers* (`vertical_chime_branch_recommended`, `diagonal_tangent_recommended`, `outer_realm_recommended`, …) — is folded into seed bank §B and surfaces through MCP-001's `routeSuggestion` enum as an **advisory input** to those four cards. Comments on all four link the routing seeds. |
| **MCP-007** (pre-send pause + friction UX) | **RULE-004 #114** | RULE-004 already *is* "Pause-before-send move review (advisory friction with payoff)" — it owns `preSendReviewModel.ts`, `<PreSendReviewSheet>`, the transformation actions, the casual/strict mode behaviour, and the "Post anyway / Save draft" guarantees. MCP-007 would duplicate it. The genuinely-new part — the *friction classifiers* (`pre_send_pause_recommended`, `needs_choose_lane_prompt`, …) — is folded into seed bank §F and surfaces as an optional advisory input to RULE-004's sheet, gated by room mode. A comment on RULE-004 links them. |

This keeps the MCP-** numbering stable against the operator's spec while obeying the no-duplication rule. The gaps (005/006/007) are intentional and documented.

## 11. Dependencies

```
RULE-006 (#116, semantic strategy research) ──► MCP-001 (concrete architecture)
LIFE-001 ──┐
META-001 ──┤
SC-004   ──┼──► MCP-001  (deterministic metadata layer 1 reads these)
EV-001   ──┘
MCP-001 ──► MCP-002 (seeds bind to the packet contract)
MCP-001 ──► MCP-003 (ledger consumes the packet)  ──► point-standing-economy
MCP-001 ──► MCP-004 (triggers gate the packet call)
MCP-001 ──► MCP-009 (boundary hosts the packet call)
MCP-001 ──► MCP-010 (override consumes confidence/conflict)
MCP-002 + MCP-003 ──► MCP-008 (banners map classifier ids → playful copy)
GAME-003 (#119) ──► mode-fit classifiers (seed bank §E) gate the layer per mode
RULE-004 (#114) ──► friction classifiers (seed bank §F) feed PreSendReviewSheet
BR-003/BR-004/GAME-005/GAME-006 ──► routing classifiers (seed bank §B) feed routeSuggestion
```

**Critical path:** MCP-001 → (MCP-002 ∥ MCP-004 ∥ MCP-009) → MCP-003 → MCP-008 / MCP-010. Nothing downstream is buildable until the packet contract in MCP-001 is locked.

## 12. Priority recommendations

- **P1, in order:** MCP-001 (the contract), then MCP-002 / MCP-004 / MCP-009 in parallel (seeds, triggers, boundary), then MCP-003 (the ledger).
- **P2, after the P1 spine:** MCP-008 (banners), MCP-010 (override UX).
- **Release:** all MCP-** cards target Release 6.8 — they sit downstream of the 6.6/6.7 PvP-core cards (IX-004 → COMPOSER-002 → GAME-004 → BR-004) and of RULE-006's research direction being confirmed.
- **Recommended next card through Design → Build → Review:** **MCP-001** — every other MCP card depends on its packet contract, and it is design-only with no live calls.

## 13. Risks and anti-patterns

- **Magic-keyword cage redux.** The whole point is to *escape* keyword brittleness; if the classifier becomes a new hard gate the layer has failed. Mitigation: doctrine rule 3 + MCP-010 reversible override + advisory-only packet.
- **Cost blowout.** Per-keystroke or per-hover calls would be ruinous. Mitigation: MCP-004 trigger gates, content-hash caching, 5-classifier batching, token budget per packet.
- **Verdict drift.** A `reasonCode` or banner sliding into "wrong / lost / bad faith". Mitigation: ban-list tests across every produced string (MCP-002, MCP-008), `toPlainLanguage` mapping required.
- **Popularity → truth.** A classifier letting engagement do evidentiary work. Mitigation: `uses_popularity_as_evidence` classifies the *text*; the ledger (MCP-003) keeps engagement credit and factual-standing credit separate per `antiAmplification.ts`.
- **False positives feel punitive.** Mitigation: `friction_would_feel_punitive` is itself a classifier; on L1/L2 conflict, downgrade confidence and offer a reversible choice (MCP-010), never a penalty.
- **AI-as-judge.** Mitigation: doctrine rules 1–5; `authoritative: false` enforced in the schema; no classifier in the catalog asks a truth question.
- **Brittle provider lock-in.** Mitigation: provider-agnostic packet; mock provider is the test default; live provider is operator-gated (MCP-009).
- **Classifying people.** Mitigation: every seed classifies a *move/text property*; ban-list tests scan for person nouns; `shifts_to_person_or_intent` flags the *move*, it does not label the *speaker*.

## 14. Operator decisions (flagged, not resolved)

1. **Provider strategy.** (a) MCP-hosted classifier service; (b) Anthropic low-cost model (Haiku-class) through the existing `process-language-draft` Edge Function pattern; (c) provider-agnostic abstraction with **no default** until a live pilot. Recommendation: (c) for the design phase, with the mock provider as the test default. RULE-006 already flagged this; MCP-009 carries it forward.
2. **Live-call phase.** Design-only now (this expansion) → mock + fixture implementation later → live pilot only after explicit operator approval. Confirm the staging.
3. **Debate-mode launch sequence.** Strict modes later vs default 1v1 first vs public-room branch behaviour first — affects which mode-fit classifiers (seed bank §E) are needed first. Defers to GAME-003's MVP-template decision.
4. **Scoreboard framing word.** "referee", "moderator", "scorekeeper", or "coach" for the layer-3 feedback voice. This expansion uses **referee** throughout as a placeholder; the final user-facing word is an operator pick (MCP-008 carries the copy).
5. **Epic label.** Whether MCP-** becomes a **new Project epic** (e.g. `epic:mcp-semantic`) or stays under `epic:rules-ux`. This expansion files all 7 cards under `epic:rules-ux` / Epic = "Rules UX" as the safe default; creating a new epic option is a one-line Project field edit if the operator prefers it.
6. **RULE-006 disposition.** RULE-006 (#116) is the originating research card. Now that the MCP direction is chosen, the operator decides: close RULE-006 as *superseded by the MCP-** family*, or keep it open as the umbrella tracking issue. This expansion does **not** close it; it comments the relationship.

## 15. What not to build yet

- No live Anthropic / xAI / OpenAI / MCP provider calls from anything — blocked on a future operator-approved card.
- No client-side AI call, ever.
- No MCP server started, hosted, or scaffolded in this pass — MCP-009 is boundary *design* only.
- No production code, no tests, no migrations, no Edge Function deploys in this design pass.
- No classifier that asks a truth / verdict / who-won question — not now, not later.
- No semantic call on keystroke / hover / selection / observer browsing.
- No new dependency, no `.env*` edit, no service-role introduction, no direct `public.arguments` insert.

## 16. Doctrine self-check

- **AI never decides who is right** — no classifier in the 90-seed bank asks a truth question; the catalog is structural only. ✓
- **AI never declares a winner** — the ledger scores rules of play; `concedes_broad_point` renders as "broad concession offered", never "lost". ✓
- **AI never blocks an ordinary post** — packet is advisory; only deterministic structural validation blocks (doctrine rule 3). ✓
- **AI never runs on the client** — layer 2 is Edge-Function / server-MCP only (MCP-009). ✓
- **`authoritative: false`** — enforced in the `SemanticRefereePacket` type and asserted by schema tests. ✓
- **Popularity is not evidence** — `uses_popularity_as_evidence` classifies text; MCP-003 keeps engagement and factual-standing credit separate. ✓
- **No verdict / person labels** — ban-list tests across all `reasonCode` strings and all banner copy (MCP-002, MCP-008). ✓
- **Mock-first** — mock provider is the test default; live calls operator-gated (MCP-009). ✓
- **No new v1-scope violation** — no voting, no search, no push, no OAuth, no public API introduced. ✓

## 17. Next recommended card

**MCP-001 — Semantic referee architecture and binary classifier contract.**

It is design-only, makes no live call, and locks the `SemanticRefereePacket` / `SemanticBinarySample` contract that every other MCP card depends on. Its detailed design doc already exists at [`docs/designs/MCP-001.md`](../designs/MCP-001.md) (produced in this pass). Recommend it enters the standard Design → Build → Review pipeline first, then MCP-002 / MCP-004 / MCP-009 in parallel, then MCP-003.

**Ready for operator review — no implementation performed, no live API call made, no `.env*` read.**
