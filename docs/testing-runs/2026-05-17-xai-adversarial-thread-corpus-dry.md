# xAI Adversarial Thread Corpus — 2026-05-17

_Run id_: `2026-05-17T08-06-51-093Z-66557e37`
_Mode_: dry
_Provider path_: `xai_responses` — chosen because the Responses API + x_search tool returns explicit citation refs so the report can keep metric-vs-inferred ranking honest. The legacy chat/completions search_parameters path remains as a fallback.
_Args_: rooms=3 candidatePosts=30 topReplies=12 maxDepth=5 sourceMode=synthetic allowSyntheticRebuttal=false syntheticThreshold=3 seed=cdiscourse-xai-adv
_Env booleans_: hasXaiKey=true enableXai=true hasAnthropicKey=true enableAnthropic=true hasBotTests=true

## Doctrine reminder

- Popularity / repetition / engagement velocity / political identity are NOT evidence.
- politicalValence describes the rhetorical frame of the TEXT, never the user.
- No truth verdict, no moderation recommendation, no winner / loser language.
- Bots are test bots — they never claim to be real X users.
- Engagement credit and factual-standing eligibility are SEPARATE: amplification can earn engagement credit while factual-standing gain is suppressed until evidence arrives.

## Run counts

- Source candidates seen: **3**
- Source posts selected: **3**
- Real rebuttals selected: **3**
- Synthetic rebuttals generated: **0** (excluded from real epidemiology)
- Rooms created: **3**
- Moves posted: **0**  ·  Failed: 0  ·  Skipped: 15
- Rooms resolved: 0  ·  Stalemates: 3  ·  Max-depth reached: 3
- xAI calls: 0  ·  Anthropic calls: 0
- Anthropic input tokens: 0  ·  output tokens: 0
- Source citation refs surfaced: 0  ·  Reply citation refs: 0
- platformSupportWarning=true moves: **0** / 21

### Primary stance distribution

| Value | Count |
|---|---:|
| `unclear` | 21 |

### Agreement type

| Value | Count |
|---|---:|
| `none` | 21 |

### Disagreement axis

| Value | Count |
|---|---:|
| `none` | 21 |

### Mixed-agreement class
_(no entries)_

### Rhetorical archetype

| Value | Count |
|---|---:|
| `evidence_challenger` | 12 |
| `logic_challenger` | 6 |
| `unclear` | 3 |

### Political issue frame

| Value | Count |
|---|---:|
| `non_political` | 21 |

### Political valence (text frame, not user)

| Value | Count |
|---|---:|
| `unclear` | 21 |

### Evidentiary risk

| Value | Count |
|---|---:|
| `low` | 18 |
| `medium` | 3 |

### Amplification risk

| Value | Count |
|---|---:|
| `none_observed` | 21 |

### Recommended game treatment

| Value | Count |
|---|---:|
| `allow_as_opinion_no_factual_credit` | 18 |
| `ask_for_receipt` | 3 |

### Amplification signals fired
_(no entries)_

### Deterministic rule flags fired
_(no entries)_

### Submit errors
_(no entries)_

### Deterministic fallback reasons (top)

| Value | Count |
|---|---:|
| `no_anthropic_client` | 21 |

## Top 10 strongest rooms (highest avg playable tension)

_(no samples)_

## Top 10 weakest rooms (lowest avg playable tension)

_(no samples)_

## 5 broad agreement + narrow disagreement examples

_(no samples)_

## 5 high-amplification low-evidence claims

_(no samples)_

## Claims that should NOT receive factual standing without evidence

_(no samples)_

## Claims that could receive standing after sourcing / narrowing

_(no samples)_

## 5 bot-provocateur engagement wins

_(no samples)_

## 5 bot-revocateur specificity wins

_(no samples)_

## Per-room one-liners

| Room | Provider | TopicBucket | Synthetic | Moves Posted | Resolution |
|---|---|---|---|---:|---|
| `xai-adv-c95a7eb3-57fe2ebd` | `synthetic` | `ai-seed-pitch-clock-baseball` | no | 7 | `max_depth_reached` |
| `xai-adv-e650c58b-545cc030` | `synthetic` | `ai-seed-bike-lanes-curb` | no | 7 | `max_depth_reached` |
| `xai-adv-c959340f-6050cd8e` | `synthetic` | `ai-seed-onboarding-apology` | no | 7 | `max_depth_reached` |

## Anti-amplification recommendations

- Engagement-vs-factual-standing remain separate scores: viral text can earn engagement credit while factual-standing gain stays suppressed until receipts / quote anchor / scope narrowing arrive.

## Compliance

- [x] No @handles, URLs, raw post IDs, JWTs, or secret-shape tokens in this report.
- [x] No truth verdict, no moderation recommendation, no winner / loser language.
- [x] No demographic / party / religion / race / ethnicity / sexuality / health / protected-class inference.
- [x] Bots are test bots — never claim to be real X users.
- [x] Synthetic rebuttals (if any) are excluded from real epidemiology.
- [x] Engagement credit and factual-standing eligibility are tracked separately.
- [x] Production app does not call Anthropic or xAI; this runner is dev/test only.
