# Bot Engagement Corpus — 2026-05-17

_Run id_: `2026-05-17T05-49-14-588Z-fa172432`
_Mode_: dry
_Scenarios_: 2  ·  _Rooms_: 2  ·  _Moves_: 23
_Categories_: ai_seeded
_Bot personas_: provocateur (Alex/affirmative) · revocateur (Jordan/negative) · synthesizer (Sam/neutral)
_Posted_: 0 / 23 (dry mode — moves planned, not submitted)
_Secrets exposed_: no  ·  _Anthropic called_: no  ·  _service-role used_: no

## Corpus engagement summary

### Strongest rooms (by avg score)
- 4.3 — `ai-ai-seed-bike-lanes-curb-11-567090` · Bike lanes are better curb space than parking.
- 4.1 — `ai-ai-seed-pitch-clock-baseball-12-824789` · Pitch clock changed baseball pacing.

### Weakest rooms (by avg score)
- 4.1 — `ai-ai-seed-pitch-clock-baseball-12-824789` · Pitch clock changed baseball pacing.
- 4.3 — `ai-ai-seed-bike-lanes-curb-11-567090` · Bike lanes are better curb space than parking.

### Decision-intent distribution
- `plant_claim` — 5
- `drop_receipts` — 4
- `quote_exact_bit` — 3
- `branch_tangent` — 2
- `challenge_evidence` — 2
- `concede_small_point` — 2
- `synthesize_thread` — 2
- `challenge_fact` — 1
- `challenge_causal` — 1
- `challenge_scope` — 1

### Notable moments
- Tangent / branch candidates: 2
- Hot-spice moves: 0
- Concessions: 2
- Evidence drops: 4

### Tuning recommendations
- < 1 hot-spice move per room — increase use of phrases like "vibes-only", "dodge", "bold claim wearing a tiny hat".

---

# Room 01 of 2

## Room — Pitch clock changed baseball pacing.

- scenarioId: `ai-ai-seed-pitch-clock-baseball-12-824789`
- roomId: `(none)`
- category: `ai_seeded`
- resolution: The pitch clock made baseball faster and more watchable.
- template: `balanced-challenge-12` · topic: `ai-seed-pitch-clock-baseball`
- engagement (avg): **4.1 / 5**
- topic hook: Alex (affirmative) vs Jordan (negative) vs Sam (neutral)

### Move 1 — provocateur (Alex / affirmative)

- moveId: `m1`
- moveKind: `start_thesis` · argumentType: `thesis`
- parent: (none — root)
- status: `planned`
- decisionIntent: `plant_claim`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Opens with a deliberately provocative root claim that invites scope and definition challenges.
- whyThisParent: Starts the conversation. No parent.
- expectedCounter: Expect a scope or fact rebuttal.

Body:

> [DRY] provocateur/thesis on "Pitch clock changed baseball pacing." — slot m1.

### Move 2 — revocateur (Jordan / negative)

- moveId: `m2`
- moveKind: `challenge_parent` · argumentType: `rebuttal`
- disagreementAxis: `fact`
- parent: `m1` (thesis)
- parent excerpt: ""Pitch clock changed baseball pacing." — slot m1."
- target excerpt: ""Pitch clock changed baseball pacing." — slot m1."
- status: `planned`
- decisionIntent: `challenge_fact`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Disputes the factual premise behind the parent's framing.
- whyThisParent: Direct rebuttal of the root thesis.
- expectedCounter: Expect either evidence backing the original side, or a counter_rebuttal on a different axis.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2.

### Move 3 — synthesizer (Sam / neutral)

- moveId: `m3`
- moveKind: `ask_clarification` · argumentType: `clarification_request`
- parent: `m2` (rebuttal)
- parent excerpt: "[DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2."
- status: `planned`
- decisionIntent: `quote_exact_bit`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Demands a verbatim quote — exercises the quote-anchor rail.
- whyThisParent: Probes what the rebuttal is actually claiming.
- expectedCounter: Expect a narrower claim from the original author.

Body:

> [DRY] synthesizer/clarification_request on "Pitch clock changed baseball pacing." — slot m3.

### Move 4 — revocateur (Jordan / negative)

- moveId: `m4`
- moveKind: `make_claim` · argumentType: `claim`
- parent: `m3` (clarification_request)
- parent excerpt: "[DRY] synthesizer/clarification_request on "Pitch clock changed baseball pacing."
- status: `planned`
- decisionIntent: `plant_claim`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Opens with a deliberately provocative root claim that invites scope and definition challenges.
- whyThisParent: Answers the clarification with a narrower claim.
- expectedCounter: Expect a rebuttal, evidence, clarification, or concession.

Body:

> [DRY] revocateur/claim on "Pitch clock changed baseball pacing." — slot m4.

### Move 5 — provocateur (Alex / affirmative)

- moveId: `m5`
- moveKind: `add_evidence` · argumentType: `evidence`
- parent: `m2` (rebuttal)
- parent excerpt: "[DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m2."
- receipts: MLB average game length change — Average MLB game length dropped by roughly 24 minutes in the first season of the pitch clock.
- status: `planned`
- decisionIntent: `drop_receipts`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Drops a concrete receipt that the rebuttal must address.
- whyThisParent: Backs the original side against the rebuttal.
- expectedCounter: Expect a scope challenge or an evidence challenge.

Body:

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5.

### Move 6 — provocateur (Alex / affirmative)

- moveId: `m6`
- moveKind: `challenge_parent` · argumentType: `counter_rebuttal`
- disagreementAxis: `scope`
- parent: `m2` (rebuttal)
- parent excerpt: ""Pitch clock changed baseball pacing." — slot m2."
- target excerpt: ""Pitch clock changed baseball pacing." — slot m2."
- status: `planned`
- decisionIntent: `branch_tangent`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Plants a tangent that wants its own room — exercises branch recommendation.
- whyThisParent: Re-engages the rebuttal on a different axis.
- expectedCounter: Expect a rebuttal back on the original axis or new evidence.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — slot m6.

### Move 7 — provocateur (Alex / affirmative)

- moveId: `m7`
- moveKind: `add_evidence` · argumentType: `evidence`
- parent: `m6` (counter_rebuttal)
- parent excerpt: "[DRY] provocateur/counter_rebuttal on "Pitch clock changed baseball pacing." — s"
- receipts: MLB average game length change — Average MLB game length dropped by roughly 24 minutes in the first season of the pitch clock.
- status: `planned`
- decisionIntent: `drop_receipts`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Drops a concrete receipt that the rebuttal must address.
- whyThisParent: Backs the counter-rebuttal with a concrete receipt.
- expectedCounter: Expect a scope challenge or an evidence challenge.

Body:

> [DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m7.

### Move 8 — revocateur (Jordan / negative)

- moveId: `m8`
- moveKind: `challenge_parent` · argumentType: `rebuttal`
- disagreementAxis: `evidence`
- parent: `m5` (evidence)
- parent excerpt: ""Pitch clock changed baseball pacing." — slot m5."
- target excerpt: ""Pitch clock changed baseball pacing." — slot m5."
- status: `planned`
- decisionIntent: `challenge_evidence`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Disputes the strength of the parent's evidence.
- whyThisParent: Challenges the evidence the other side just dropped.
- expectedCounter: Expect either evidence backing the original side, or a counter_rebuttal on a different axis.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] revocateur/rebuttal on "Pitch clock changed baseball pacing." — slot m8.

### Move 9 — revocateur (Jordan / negative)

- moveId: `m9`
- moveKind: `ask_clarification` · argumentType: `clarification_request`
- parent: `m5` (evidence)
- parent excerpt: "[DRY] provocateur/evidence on "Pitch clock changed baseball pacing." — slot m5."
- status: `planned`
- decisionIntent: `quote_exact_bit`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Demands a verbatim quote — exercises the quote-anchor rail.
- whyThisParent: Probes the evidence's scope.
- expectedCounter: Expect a narrower claim from the original author.

Body:

> [DRY] revocateur/clarification_request on "Pitch clock changed baseball pacing." — slot m9.

### Move 10 — provocateur (Alex / affirmative)

- moveId: `m10`
- moveKind: `make_claim` · argumentType: `claim`
- parent: `m9` (clarification_request)
- parent excerpt: "[DRY] revocateur/clarification_request on "Pitch clock changed baseball pacing.""
- status: `planned`
- decisionIntent: `plant_claim`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Opens with a deliberately provocative root claim that invites scope and definition challenges.
- whyThisParent: Answers the clarification with a narrower claim.
- expectedCounter: Expect a rebuttal, evidence, clarification, or concession.

Body:

> [DRY] provocateur/claim on "Pitch clock changed baseball pacing." — slot m10.

### Move 11 — revocateur (Jordan / negative)

- moveId: `m11`
- moveKind: `concede_or_narrow` · argumentType: `concession`
- parent: `m10` (claim)
- parent excerpt: "[DRY] provocateur/claim on "Pitch clock changed baseball pacing." — slot m10."
- status: `planned`
- decisionIntent: `concede_small_point`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Concedes a narrow point to invite synthesis without giving up the larger position.
- whyThisParent: Concedes the narrowed sub-claim.
- expectedCounter: Expect a synthesis.
- tuningConcern: Concession may be too short to feel earned.

Body:

> [DRY] revocateur/concession on "Pitch clock changed baseball pacing." — slot m11.

### Move 12 — synthesizer (Sam / neutral)

- moveId: `m12`
- moveKind: `synthesize_thread` · argumentType: `synthesis`
- parent: `m11` (concession)
- parent excerpt: "[DRY] revocateur/concession on "Pitch clock changed baseball pacing." — slot m11"
- status: `planned`
- decisionIntent: `synthesize_thread`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Wraps the thread by acknowledging shared ground; flags the open question.
- whyThisParent: Closes the thread after the concession.
- expectedCounter: Thread closes; no counter expected.
- tuningConcern: Synthesis may be too brief to convey closure.

Body:

> [DRY] synthesizer/synthesis on "Pitch clock changed baseball pacing." — slot m12.

### Room engagement scores

| Metric | Score |
|---|---:|
| backAndForthScore | 4 |
| specificityScore | 4 |
| personaDistinctnessScore | 5 |
| evidenceUseScore | 4 |
| concessionQualityScore | 5 |
| tangentControlScore | 5 |
| funScore | 1 |
| traceabilityScore | 5 |
| **average** | **4.1** |

**Recommended tune:** Low spots: funScore=1, backAndForthScore=4. To tune: add more sharp phrases (vibes-only, dodge, bold claim wearing a tiny hat) without becoming personal; increase author alternation between turns.

---

# Room 02 of 2

## Room — Bike lanes are better curb space than parking.

- scenarioId: `ai-ai-seed-bike-lanes-curb-11-567090`
- roomId: `(none)`
- category: `ai_seeded`
- resolution: Protected bike lanes are a better use of curb space than parking in dense corridors.
- template: `concession-path-11` · topic: `ai-seed-bike-lanes-curb`
- engagement (avg): **4.3 / 5**
- topic hook: Alex (affirmative) vs Jordan (negative) vs Sam (neutral)

### Move 1 — provocateur (Alex / affirmative)

- moveId: `m1`
- moveKind: `start_thesis` · argumentType: `thesis`
- parent: (none — root)
- status: `planned`
- decisionIntent: `plant_claim`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Opens with a deliberately provocative root claim that invites scope and definition challenges.
- whyThisParent: Starts the conversation. No parent.
- expectedCounter: Expect a scope or fact rebuttal.

Body:

> [DRY] provocateur/thesis on "Bike lanes are better curb space than parking." — slot m1.

### Move 2 — revocateur (Jordan / negative)

- moveId: `m2`
- moveKind: `challenge_parent` · argumentType: `rebuttal`
- disagreementAxis: `causal`
- parent: `m1` (thesis)
- parent excerpt: ""Bike lanes are better curb space than parking." — slot"
- target excerpt: ""Bike lanes are better curb space than parking." — slot"
- status: `planned`
- decisionIntent: `challenge_causal`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Disputes the cause-and-effect step the parent assumed.
- whyThisParent: Direct rebuttal of the root thesis.
- expectedCounter: Expect either evidence backing the original side, or a counter_rebuttal on a different axis.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m2.

### Move 3 — provocateur (Alex / affirmative)

- moveId: `m3`
- moveKind: `add_evidence` · argumentType: `evidence`
- parent: `m2` (rebuttal)
- parent excerpt: "[DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — "
- receipts: Curb productivity studies — Curb productivity research consistently finds protected bike lanes carry more daily users per foot than parking in dense corridors.
- status: `planned`
- decisionIntent: `drop_receipts`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Drops a concrete receipt that the rebuttal must address.
- whyThisParent: Backs the original side against the rebuttal.
- expectedCounter: Expect a scope challenge or an evidence challenge.

Body:

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m3.

### Move 4 — revocateur (Jordan / negative)

- moveId: `m4`
- moveKind: `challenge_parent` · argumentType: `rebuttal`
- disagreementAxis: `evidence`
- parent: `m3` (evidence)
- parent excerpt: ""Bike lanes are better curb space than parking." — slot"
- target excerpt: ""Bike lanes are better curb space than parking." — slot"
- status: `planned`
- decisionIntent: `challenge_evidence`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Disputes the strength of the parent's evidence.
- whyThisParent: Challenges the evidence the other side just dropped.
- expectedCounter: Expect either evidence backing the original side, or a counter_rebuttal on a different axis.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — slot m4.

### Move 5 — synthesizer (Sam / neutral)

- moveId: `m5`
- moveKind: `ask_clarification` · argumentType: `clarification_request`
- parent: `m4` (rebuttal)
- parent excerpt: "[DRY] revocateur/rebuttal on "Bike lanes are better curb space than parking." — "
- status: `planned`
- decisionIntent: `quote_exact_bit`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Demands a verbatim quote — exercises the quote-anchor rail.
- whyThisParent: Probes what the rebuttal is actually claiming.
- expectedCounter: Expect a narrower claim from the original author.

Body:

> [DRY] synthesizer/clarification_request on "Bike lanes are better curb space than parking." — slot m5.

### Move 6 — revocateur (Jordan / negative)

- moveId: `m6`
- moveKind: `make_claim` · argumentType: `claim`
- parent: `m5` (clarification_request)
- parent excerpt: "[DRY] synthesizer/clarification_request on "Bike lanes are better curb space tha"
- status: `planned`
- decisionIntent: `plant_claim`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Opens with a deliberately provocative root claim that invites scope and definition challenges.
- whyThisParent: Answers the clarification with a narrower claim.
- expectedCounter: Expect a rebuttal, evidence, clarification, or concession.

Body:

> [DRY] revocateur/claim on "Bike lanes are better curb space than parking." — slot m6.

### Move 7 — provocateur (Alex / affirmative)

- moveId: `m7`
- moveKind: `challenge_parent` · argumentType: `counter_rebuttal`
- disagreementAxis: `scope`
- parent: `m4` (rebuttal)
- parent excerpt: ""Bike lanes are better curb space than parking." — slot"
- target excerpt: ""Bike lanes are better curb space than parking." — slot"
- status: `planned`
- decisionIntent: `challenge_scope`
- spice: `mild` · specificity: `specific` · pressure: `high`
- whyThisMove: Pushes back on the parent's scope to narrow the dispute.
- whyThisParent: Re-engages the rebuttal on a different axis.
- expectedCounter: Expect a rebuttal back on the original axis or new evidence.
- tuningConcern: Specific but flat — could use more bite.

Body:

> [DRY] provocateur/counter_rebuttal on "Bike lanes are better curb space than parking." — slot m7.

### Move 8 — provocateur (Alex / affirmative)

- moveId: `m8`
- moveKind: `add_evidence` · argumentType: `evidence`
- parent: `m7` (counter_rebuttal)
- parent excerpt: "[DRY] provocateur/counter_rebuttal on "Bike lanes are better curb space than par"
- receipts: Business-impact case studies — Multiple corridor studies show retail revenue stable or up after replacing curb parking with protected bike lanes.
- status: `planned`
- decisionIntent: `drop_receipts`
- spice: `mild` · specificity: `medium` · pressure: `medium`
- whyThisMove: Drops a concrete receipt that the rebuttal must address.
- whyThisParent: Backs the counter-rebuttal with a concrete receipt.
- expectedCounter: Expect a scope challenge or an evidence challenge.

Body:

> [DRY] provocateur/evidence on "Bike lanes are better curb space than parking." — slot m8.

### Move 9 — revocateur (Jordan / negative)

- moveId: `m9`
- moveKind: `concede_or_narrow` · argumentType: `concession`
- parent: `m6` (claim)
- parent excerpt: "[DRY] revocateur/claim on "Bike lanes are better curb space than parking." — slo"
- status: `planned`
- decisionIntent: `concede_small_point`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Concedes a narrow point to invite synthesis without giving up the larger position.
- whyThisParent: Concedes the narrowed sub-claim.
- expectedCounter: Expect a synthesis.
- tuningConcern: Concession may be too short to feel earned.

Body:

> [DRY] revocateur/concession on "Bike lanes are better curb space than parking." — slot m9.

### Move 10 — synthesizer (Sam / neutral)

- moveId: `m10`
- moveKind: `synthesize_thread` · argumentType: `synthesis`
- parent: `m9` (concession)
- parent excerpt: "[DRY] revocateur/concession on "Bike lanes are better curb space than parking." "
- status: `planned`
- decisionIntent: `synthesize_thread`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Wraps the thread by acknowledging shared ground; flags the open question.
- whyThisParent: Closes the thread after the concession.
- expectedCounter: Thread closes; no counter expected.
- tuningConcern: Synthesis may be too brief to convey closure.

Body:

> [DRY] synthesizer/synthesis on "Bike lanes are better curb space than parking." — slot m10.

### Move 11 — provocateur (Alex / affirmative)

- moveId: `m11`
- moveKind: `make_claim` · argumentType: `claim`
- parent: `m5` (clarification_request)
- parent excerpt: "[DRY] synthesizer/clarification_request on "Bike lanes are better curb space tha"
- status: `planned`
- decisionIntent: `branch_tangent`
- spice: `mild` · specificity: `medium` · pressure: `low`
- whyThisMove: Plants a tangent that wants its own room — exercises branch recommendation.
- whyThisParent: Answers the clarification with a narrower claim.
- expectedCounter: Expect a rebuttal, evidence, clarification, or concession.

Body:

> [DRY] provocateur/claim on "Bike lanes are better curb space than parking." — slot m11.

### Room engagement scores

| Metric | Score |
|---|---:|
| backAndForthScore | 5 |
| specificityScore | 4 |
| personaDistinctnessScore | 5 |
| evidenceUseScore | 4 |
| concessionQualityScore | 5 |
| tangentControlScore | 5 |
| funScore | 1 |
| traceabilityScore | 5 |
| **average** | **4.3** |

**Recommended tune:** Low spots: funScore=1, specificityScore=4. To tune: add more sharp phrases (vibes-only, dodge, bold claim wearing a tiny hat) without becoming personal; have more moves carry a targetExcerpt or quote a parent phrase verbatim.

---


## Secrets check

- [x] No emails in plaintext (redactor strips them)
- [x] No passwords or `password=...` lines
- [x] No JWT-shape tokens
- [x] No Supabase secret keys
- [x] No `.env.bot-tests` values
- [x] No service-role key used by runner
