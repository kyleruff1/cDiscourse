# Engagement Epidemiology — 2026-05-17

_Run id_: `2026-05-17T04-41-01-091Z-1a9703b5`
_Source mode_: `synthetic`
_Stories_: 0  ·  _Root posts_: 24  ·  _Reply pairs_: 24  ·  _Excluded_: 0
_X API live calls_: NO  ·  _xAI live calls_: NO  ·  _service-role used_: NO  ·  _user-review required_: ALWAYS

## Stance distribution

| primaryStance | count | % |
|---|---:|---:|
| `strong_agree` | 1 | 4% |
| `weak_agree` | 2 | 8% |
| `mixed_agree_disagree` | 9 | 38% |
| `weak_disagree` | 4 | 17% |
| `strong_disagree` | 2 | 8% |
| `unclear` | 2 | 8% |
| `tangent` | 1 | 4% |
| `joke_or_meme` | 1 | 4% |
| `receipt_request` | 1 | 4% |
| `quote_request` | 1 | 4% |

## Agreement × disagreement heatmap

- `0.0-0.2 × 0.2-0.4` — 5
- `0.0-0.2 × 0.0-0.2` — 5
- `0.4-0.6 × 0.2-0.4` — 4
- `0.4-0.6 × 0.0-0.2` — 2
- `0.0-0.2 × 0.6-0.8` — 2
- `0.6-0.8 × 0.4-0.6` — 2
- `0.6-0.8 × 0.0-0.2` — 1
- `0.4-0.6 × 0.4-0.6` — 1
- `0.4-0.6 × 0.8-1.0` — 1
- `0.4-0.6 × 0.6-0.8` — 1

## Disagreement type distribution

| disagreementType | count | % |
|---|---:|---:|
| `fact` | 1 | 4% |
| `definition` | 1 | 4% |
| `causal` | 1 | 4% |
| `value` | 1 | 4% |
| `evidence` | 2 | 8% |
| `logic` | 1 | 4% |
| `scope` | 3 | 13% |
| `framing` | 2 | 8% |
| `none` | 12 | 50% |

## Agreement type distribution

| agreementType | count | % |
|---|---:|---:|
| `premise` | 11 | 46% |
| `evidence` | 0 | 0% |
| `conclusion` | 1 | 4% |
| `value` | 1 | 4% |
| `framing` | 1 | 4% |
| `context` | 0 | 0% |
| `none` | 10 | 42% |

## Top reply functions

| replyFunction | count |
|---|---:|
| `extend` | 5 |
| `unclear` | 4 |
| `narrow_scope` | 3 |
| `caveat` | 3 |
| `rebut` | 2 |
| `support` | 1 |
| `ask_source` | 1 |
| `ask_quote` | 1 |

## Rule candidates (advisory only — none auto-wired)

- **Offer receipts prompt when reply asks for source** — target: `evidence_prompt`; predicate: `shouldPromptForReceipts`; examples: 1
- **Offer quote-anchor prompt when reply asks for the exact bit** — target: `quote_anchor`; predicate: `shouldPromptQuoteExactBit`; examples: 1
- **Suggest narrow_scope move when scope challenge detected** — target: `move_navigator`; predicate: `shouldSuggestNarrowScope`; examples: 3
- **Suggest define-term move when definition challenge detected** — target: `move_navigator`; predicate: `shouldSuggestDefineTerm`; examples: 1
- **Suggest branch when reply reads as tangent** — target: `branch_prompt`; predicate: `shouldSuggestBranchThread`; examples: 1
- **Surface mixed-agreement status when coexistence is high** — target: `resting_status`; predicate: `shouldShowMixedAgreementDisagreementStatus`; examples: 3
- **Offer concede-small-point prompt when reply both agrees on premise and disputes evidence** — target: `concession_prompt`; predicate: `shouldOfferConcedeSmallPoint`; examples: 3

## Sample interpretations (first 10)

### `syn-001-strong-agree`
- stance: `weak_agree` · function: `extend` · confidence: `high`
- agreement: 0.40 (`premise`) · disagreement: 0.00 (`none`) · coexistence: 0.00 · uncertainty: 0.00
- labels: _(none)_
- rationale: Observable: agrees on premise.

### `syn-002-weak-agree`
- stance: `strong_agree` · function: `support` · confidence: `high`
- agreement: 0.64 (`premise`) · disagreement: 0.00 (`none`) · coexistence: 0.00 · uncertainty: 0.00
- labels: _(none)_
- rationale: Observable: agrees on premise.

### `syn-003-mixed-fair-but`
- stance: `mixed_agree_disagree` · function: `extend` · confidence: `high`
- agreement: 0.55 (`premise`) · disagreement: 0.22 (`none`) · coexistence: 0.44 · uncertainty: 0.00
- labels: `concession_caveat`
- rationale: Observable: agrees on premise; mixed state.

### `syn-004-evidence-challenge`
- stance: `receipt_request` · function: `ask_source` · confidence: `high`
- agreement: 0.00 (`none`) · disagreement: 0.30 (`evidence`) · coexistence: 0.00 · uncertainty: 0.00
- labels: `receipt_request`
- rationale: Observable: disagrees on evidence; asks for receipts.

### `syn-005-quote-request`
- stance: `quote_request` · function: `ask_quote` · confidence: `medium`
- agreement: 0.00 (`none`) · disagreement: 0.00 (`none`) · coexistence: 0.00 · uncertainty: 0.50
- labels: `quote_request`
- rationale: Observable: asks for a quote anchor.

### `syn-006-definition-challenge`
- stance: `weak_disagree` · function: `ask_definition` · confidence: `high`
- agreement: 0.00 (`none`) · disagreement: 0.30 (`definition`) · coexistence: 0.00 · uncertainty: 0.00
- labels: `definition_ask`
- rationale: Observable: disagrees on definition.

### `syn-007-scope-challenge`
- stance: `mixed_agree_disagree` · function: `narrow_scope` · confidence: `high`
- agreement: 0.55 (`premise`) · disagreement: 0.52 (`scope`) · coexistence: 1.00 · uncertainty: 0.00
- labels: `scope_challenge`, `concession_caveat`
- rationale: Observable: agrees on premise; disagrees on scope; mixed state.

### `syn-008-causal-challenge`
- stance: `weak_disagree` · function: `unclear` · confidence: `high`
- agreement: 0.00 (`none`) · disagreement: 0.30 (`causal`) · coexistence: 0.00 · uncertainty: 0.00
- labels: _(none)_
- rationale: Observable: disagrees on causal.

### `syn-009-value-challenge`
- stance: `strong_disagree` · function: `rebut` · confidence: `high`
- agreement: 0.00 (`value`) · disagreement: 0.75 (`value`) · coexistence: 0.00 · uncertainty: 0.00
- labels: _(none)_
- rationale: Observable: disagrees on value.

### `syn-010-logic-challenge`
- stance: `strong_disagree` · function: `rebut` · confidence: `high`
- agreement: 0.00 (`none`) · disagreement: 0.75 (`logic`) · coexistence: 0.00 · uncertainty: 0.00
- labels: _(none)_
- rationale: Observable: disagrees on logic.

## Compliance

- [x] Official X API only (no scraping, no browser automation)
- [x] No raw post IDs / handles / URLs / emails in this report
- [x] xAI calls not made (or, if made, advisory and merged at most)
- [x] No moderation recommendations; outputs are advisory
- [x] No truth claims; no winner / loser; no bad-faith / liar / extremist labels

## Notes

Synthetic-only run. No X API call. No xAI call. Deterministic scalar only.
