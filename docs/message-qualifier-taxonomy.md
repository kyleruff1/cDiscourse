# Message Qualifier Taxonomy

_Stage 6.1.5.1 — 2026-05-17_

## Purpose

Every argument-room message gets two labels:

- A **category** — the broad shape of the move (claim / challenge / evidence / clarification / concession / synthesis / receipt request / quote request / mixed agreement / branch candidate / tangent / repair / unresolved pressure).
- A **primary qualifier** — the specific tactic the move uses (ask_receipts / quote_exact_bit / narrow_scope / define_term / concede_small_point / broad_accept_narrow_decline / etc.).

The two-axis label lets the UI offer the right nudge ("Quote the exact bit", "Receipts, please", "This tangent wants its own room") and lets Admin auditors see at a glance what kind of move each row is — without the app ever declaring truth, winner, loser, or a verdict on the speaker.

Pure TypeScript. No network. No AI. The deriver consumes fields the app already stores (`argument_type`, `side`, `disagreement_axis`, `selected_tag_codes`, `target_excerpt`, `body`, `client_validation`, `server_validation`) plus the optional `MixedAgreementFlags` from Stage 6.1.3.3 and the optional point-standing signals from Stage 6.1.4.

## Categories

| Category | When it fires |
| --- | --- |
| `claim` | argument_type ∈ {thesis, claim} |
| `challenge` | argument_type ∈ {rebuttal, counter_rebuttal} |
| `evidence` | argument_type = evidence |
| `clarification` | argument_type = clarification_request, body doesn't fit a more specific bucket |
| `concession` | argument_type = concession |
| `synthesis` | argument_type = synthesis |
| `receipt_request` | clarification_request with "source / receipts / where is this from" lexemes |
| `quote_request` | clarification_request with "quote the exact / which part / point to the sentence" lexemes |
| `mixed_agreement` | MixedAgreementFlags class ∈ {broad_accept_narrow_decline, narrow_accept_broad_decline, broad_accept_broad_decline, narrow_accept_narrow_decline} |
| `branch_candidate` | reserved — set when a slot is flagged as a tangent anchor |
| `tangent` | body contains tangent lexemes, or MixedAgreementFlags class = tangent_or_joke |
| `repair` | pointStanding.isRepairAttempt |
| `unresolved_pressure` | pointStanding.hasUnresolvedDebt with no repair |

## Qualifiers

Grouped by source:

### Axis-driven (from `disagreement_axis`)

- `fact_challenge` · `definition_challenge` · `causal_challenge` · `value_challenge` · `evidence_challenge` · `logic_challenge` · `scope_challenge`

### Tactic-driven (from `body` lexemes + `target_excerpt`)

- `ask_receipts` ("source", "receipts", "where is this from")
- `quote_exact_bit` ("quote the exact", "which part", or `targetExcerpt` set)
- `define_term` ("define ", "what counts as", "what do you mean", or axis = definition)
- `narrow_scope` ("too broad", "narrow the claim", "scope creep", or axis = scope)
- `counterexample` ("counterexample", "what about", "edge case")
- `branch_this_off` ("speaking of", "unrelated", "tangent", "off topic")

### Class-driven (from `MixedAgreementFlags`)

- `broad_accept_narrow_decline` · `narrow_accept_broad_decline` · `pure_accept` · `pure_decline` · `tangent_or_joke` · `mixed_agree_disagree`

### Concession-shape

- `concede_small_point` (concession + broad acceptor + narrow decliner — preserves broad point)
- `concede_broad_point` (concession + broad decliner — abandons the point honestly)
- `synthesize_agreement` (synthesis body without "open question")
- `synthesize_open_question` (synthesis body that flags an open question)

### Point-standing (from Stage 6.1.4 deltas)

- `unresolved_debt` · `repair_attempt` · `evasion_possible`

## Primary qualifier selection

When a message hits multiple qualifiers, `derivePrimaryQualifier` picks the most informative single one. Class-level signals (`broad_accept_narrow_decline`, `mixed_agree_disagree`, `repair_attempt`, `unresolved_debt`, `evasion_possible`) take precedence over tactic-level signals; tactic-level over axis-level. The ordering is fixed in `src/features/arguments/messageQualifiers.ts → derivePrimaryQualifier`.

## UI nudges

Each qualifier has a one-line `getQualifierUiNudge()` string the composer can show non-blockingly. Examples:

| Qualifier | Nudge |
| --- | --- |
| `broad_accept_narrow_decline` | "Surface the broad agreement and the narrow defect." |
| `ask_receipts` | "Drop the receipts in the next move." |
| `quote_exact_bit` | "Quote the parent verbatim and respond to that phrase." |
| `narrow_scope` | "Narrow the claim — clarify the case it covers." |
| `define_term` | "Pin the definition in the next move." |
| `concede_small_point` | "A tiny concession preserves the broader point." |
| `unresolved_debt` | "Address the open debt — repair, concede, or escalate." |
| `evasion_possible` | "Re-anchor on the open debt — do not let it drift." |

## Forbidden verdict tokens

The qualifier vocabulary intentionally contains zero verdict words. Tests assert that **none** of the labels or nudges contains: `winner`, `loser`, `truth`, `verdict`, `liar`, `dishonest`, `bad faith`, `manipulative`, `manipulation`, `extremist`, `propagandist`. The taxonomy describes the move, not the speaker.

## How the Admin tab uses this

`AdminArgumentsTab` renders each row with two badge categories:

- A **category badge** (e.g. `Challenge`, `Concession`, `Synthesis`).
- A **primary qualifier badge** (e.g. `Scope got wobbly`, `Tiny concession, big save`, `This tangent wants its own room`).

It also shows `created_at` and `updated_at` (timezone-aware `formatDateTime`) plus a `formatRelativeShort` supplement. Admin can search across body / room title / author / argument-type / axis text.

## What this taxonomy is NOT

- Not a moderation tool — it never recommends suspension or deletion.
- Not a truth engine — it never assigns a truth value to a message or to its author.
- Not a scoring engine — that lives in `src/features/pointStanding/` (Stage 6.1.4) and is not auto-wired.
- Not produced by AI — every label is derived deterministically from local fields.

See `__tests__/messageQualifiers.test.ts` for the assertions that lock the taxonomy.
