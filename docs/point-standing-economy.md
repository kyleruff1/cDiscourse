# Point-Standing Economy

_Stage 6.1.4 — 2026-05-17_

## Doctrine

> **A point earns standing by surviving pressure. A player earns strategic value by either creating unresolved pressure or by conceding/narrowing in a way that preserves the broader opinion.**

> **Concession is a scoring repair, not a scoring defeat.**

The engine never declares a winner or a loser. It records how a point's standing changes after pressure is applied and how that pressure is enveloped, conceded, narrowed, or evaded. Every output carries `userReviewRequired: true`. The production app retains final say.

## Why this exists

Stage 6.1.3.3 gave us a mixed-agreement taxonomy: every reply is classified by what it broadly accepts, what it narrowly accepts, what it broadly declines, what it narrowly declines, and an overall `MixedAgreementClass`. Stage 6.1.4 turns those stance flags into a **point-standing ledger** the grading system can read.

The scoring engine does NOT ask "did this reply agree or disagree?" It asks the `GradingQuestionSet`:

```ts
type GradingQuestionSet = {
  whatBroadPointWasAccepted: string | null;
  whatBroadPointWasDeclined: string | null;
  whatNarrowPointWasAccepted: string | null;
  whatNarrowPointWasDeclined: string | null;
  whatIssueDebtWasCreated: IssueAxis | null;
  whatConcessionWouldRepairIt: ConcessionEffect | null;
  canTheOriginalOpinionRecoverWeight: boolean;
  shouldThisBecomeAPlayablePrompt: boolean;
};
```

That orientation lets the UI nudge the user toward better play instead of toward performative contradiction.

## What's in this module

```
src/features/pointStanding/
  types.ts                — PointStandingDelta, ScoringEligibility,
                            OpenIssueDebt, ConcessionEffect,
                            ConcessionEffectWeights, MixedClassWeights,
                            GradingQuestionSet, IssueAxis,
                            ChallengeGradingInput/Result,
                            RepairGradingInput/Result, GradingFlags re-export.
  mixedClassWeights.ts    — MIXED_CLASS_WEIGHTS table (per-class
                            playable-tension floor + preferred UI nudge).
  concessionEffects.ts    — CONCESSION_EFFECT_WEIGHTS table +
                            classifyConcessionEffect() detector.
  eligibility.ts          — isScoreEligible gate, buildChallengeEligibility,
                            buildRepairEligibility, IssueDebtLedger.
  scoringEngine.ts        — gradeChallenge() + gradeRepair() — pure functions
                            returning PointStandingDelta + GradingQuestionSet.
  index.ts                — public surface.
```

Pure TypeScript. No persistence. No network. No xAI. No Anthropic. The engine is **not** auto-wired into the existing argument room — the operator opts it in via a later stage.

## The point-standing delta

```ts
type PointStandingDelta = {
  pointId: string;
  causedByArgumentId: string;
  broadStandingDelta: number;       // broad opinion weight change
  narrowStandingDelta: number;      // narrow subclaim weight change
  challengerPressureGain: number;   // credit for valid pressure
  responderRecoveryGain: number;    // credit for enveloping / conceding
  concessionIntegrityGain: number;  // credit for explicit concession
  impliedConcessionPenalty: number; // penalty for unflagged shift
  unresolvedDebtPenalty: number;    // penalty for ignoring open debt
  exploitRiskScore: number;         // 0..1 audit signal
};
```

Each call to `gradeChallenge` or `gradeRepair` returns one delta. The caller appends it to its own ledger. The engine never persists anything.

## Mixed-class weight table

| `mixedAgreementClass`             | playableTensionScore (floor) | creates issue debt? |
| --- | ---: | --- |
| `broad_accept_narrow_decline`     | **0.9**  | yes — the most playable state |
| `narrow_accept_broad_decline`     | 0.75 | yes |
| `narrow_accept_narrow_decline`    | 0.7  | yes |
| `broad_accept_broad_decline`      | 0.55 | yes |
| `pure_decline`                    | 0.45 | yes |
| `pure_accept`                     | 0.25 | no |
| `unclear_mixed`                   | 0.2  | no |
| `tangent_or_joke`                 | 0.1  | no |

`broad_accept_narrow_decline` is the most playable class because it keeps the conversation cooperative while still creating real issue debt: "I agree with the main point, but your scope/evidence/definition/causal claim is off."

## Concession effect weights

| Effect                                                       | responderRecovery | integrity | challengerPressure | unresolvedDebtPenalty |
| ---                                                          | ---:              | ---:      | ---:               | ---:                  |
| `explicit_narrow_concession_preserves_broad_point`           | **0.35**          | 0.25      | 0.20               | 0                     |
| `explicit_broad_concession_abandons_point`                   | 0.05              | **0.30**  | **0.40**           | 0                     |
| `implied_narrow_concession_preserves_broad_point`            | 0.20              | 0.05      | 0.25               | 0                     |
| `implied_broad_concession_abandons_point`                    | 0                 | 0.05      | **0.45**           | 0                     |
| `performative_concession_no_repair`                          | 0                 | 0         | 0.10               | 0.20                  |
| `no_concession`                                              | 0                 | 0         | 0                  | **0.25**              |

The doctrine encoded here:

- A **narrow explicit concession** that preserves the broad point is the most valuable repair move — it gives the responder real recovery credit AND lifts broad standing.
- A **broad explicit concession** that abandons the point is rewarded for honesty but does NOT lift broad standing.
- **Performative** "Fair point." with no actual narrowing earns nothing AND raises the audit (exploit-risk) signal.
- **Evasion** ("Cars are bad anyway.") pays the unresolved-debt penalty in full. It does not gain access to recovery credit by avoiding the issue.

## Anti-exploit rails

Gamification can be drilled, but not farmed. The `ScoringEligibility` gate blocks credit (but not penalties) for:

- `isTangent` — joke or off-topic moves never earn pressure credit.
- `isNearDuplicate` — a second hit on the same axis + same intensity is suppressed.
- `isSelfConcessionLoop` — same author concedes twice in a row without external pressure.
- `isLowEffortAgreement` — pure-accept moves with low-effort body length.
- `isAxisIdentified` false — pressure without a named axis doesn't count.

Per-debt bookkeeping (`ConcessionCreditState`) enforces that **recovery credit, explicit-integrity credit, implied-integrity credit, and challenger-pressure credit are awarded at most once per debt**. Repeated "Fair point" replies on the same closed debt yield zero credit.

## Worked example — cooperative repair

```
A: "Bike lanes should replace curb parking downtown."

B: "I agree bike lanes improve safety overall and the value frame is
   right. But narrow the claim — replacing every downtown curb lane is
   too broad without corridor demand data."

A: "Fair point. I mean high-demand corridors with crash data, not every
   downtown block."
```

`gradeChallenge(B)` →
- Class: `broad_accept_narrow_decline`
- Eligibility: passes (axis = scope/evidence, specific, not a tangent).
- Opens a new `OpenIssueDebt { axis: 'scope', intensity ≈ 0.9 }`.
- `challengerPressureGain` ≈ 0.28 (scaled with tension).
- `narrowStandingDelta` ≈ -0.10.
- `shouldThisBecomeAPlayablePrompt: true`.

`gradeRepair(A)` →
- Effect: `explicit_narrow_concession_preserves_broad_point`.
- `responderRecoveryGain = 0.35`
- `concessionIntegrityGain = 0.25`
- `challengerPressureGain = 0.20`
- `broadStandingDelta = +0.25`
- `narrowStandingDelta = -0.15`
- `unresolvedDebtPenalty = 0`
- Debt is closed; `canTheOriginalOpinionRecoverWeight: true`.

Both sides gain. The broad opinion is not punished for being refined.

## Worked example — evasion

```
A: "Bike lanes should replace curb parking downtown."

B: (same challenge as above)

A: "Cars are bad anyway."
```

`gradeRepair(A)` →
- Effect: `no_concession`.
- `responderRecoveryGain = 0`
- `concessionIntegrityGain = 0`
- `unresolvedDebtPenalty = 0.25`
- `broadStandingDelta = -0.05`, `narrowStandingDelta = -0.30`
- Debt remains open — evasion does not close it.

A is penalized for ignoring the live debt; B's pressure credit holds; the next challenger can build on the still-open debt.

## What we do NOT do

- We do not declare a winner. We do not declare a loser.
- We do not score "truth." We score *what happened to the point after pressure*.
- We do not assess speaker character. We do not label any user a liar / dishonest / bad-faith / manipulative / extremist / propagandist.
- We do not punish the broad opinion for being narrowed. A clean narrowing strengthens the remaining point.
- We do not require concession. We make it strategically valuable so users prefer it to evasion.
- We do not auto-wire into production. The argument room continues to use the existing Constitution. The engine becomes live in a future stage with explicit migration + UI work.

## How a future stage would wire this in

A later stage would:
1. Compute `MixedAgreementFlags` and `GradingFlags` on each posted argument (already implemented in 6.1.3.3).
2. Call `gradeChallenge` when a reply is posted; persist the delta + open debt in a new `argument_point_standing` Supabase table.
3. Call `gradeRepair` when the original speaker posts a follow-up; persist the resulting delta + close the debt as appropriate.
4. Surface the `preferredUiNudge` from `MIXED_CLASS_WEIGHTS` in the composer as a non-blocking suggestion.
5. Display `broadStandingDelta` / `narrowStandingDelta` / `playableTensionScore` summaries in the argument room's resting-status UI.

None of those steps are taken in this commit.

## Compliance

- Pure TypeScript, no network, no Supabase, no xAI, no Anthropic.
- No moderation recommendations.
- No truth claims.
- No verdict tokens (`winner`, `loser`, `truth`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`) in any output. Tests assert their absence.
- Every result carries `userReviewRequired: true`.

See `__tests__/pointStandingEngine.test.ts` for the worked-example assertions.
