---
name: point-standing-economy
description: The scoring economy that sits above the Constitution — how concessions, narrowing, and synthesis affect point standing. Invoke for Epic 7 (Strength/Weakness) cards, Epic 6 (Evidence) when scoring is involved, and any card that touches argumentScoreModel or the standing bands. Doctrine layer mirrors src/features/pointStanding/.
---

# Point-standing economy — the doctrine

## Doctrine you must encode

1. **Concession is a scoring REPAIR, not a scoring DEFEAT.** A user who narrows their broad point to a specific defensible scope LIFTS their broad standing (+0.25) and reduces the narrow defect (-0.15). The challenger ALSO gets credit (engagement + pressure-applied).
2. **Evasion costs more than acknowledging.** A move that ignores the challenge and pivots ("cars are bad anyway") pays the unresolved-debt penalty (0.25) and drops narrow standing (-0.30).
3. **No axis = no credit.** A challenge that just expresses disagreement without naming an axis (source, scope, definition, mechanism, evidence, logic) opens no debt and earns no pressure credit.
4. **One credit per debt.** Components — broad lift, narrow shrink, responder recovery, challenger pressure — are awarded at most once per debt. Re-stating the same concession doesn't re-pay.
5. **Tangents and near-duplicates earn nothing.** Anti-exploit gates prevent the score from being farmed.
6. **Self-concession loops earn nothing.** A user can't challenge themselves to farm credit.

## The shapes

```ts
type ChallengeClass =
  | 'source_chain' | 'evidence' | 'scope' | 'definition'
  | 'causal' | 'logic' | 'tangent' | 'no_axis';

type ConcessionEffect =
  | 'broad_lift'       // explicit narrow concession lifts broad standing
  | 'narrow_shrink'    // the narrow defect itself shrinks
  | 'responder_recovery' // the responder earns credit for repairing
  | 'challenger_pressure' // the challenger earns credit for applying pressure
  | 'unresolved_debt_penalty' // evasion pays this
  | 'evasion_narrow_drop'; // evasion also drops narrow standing

interface PointStandingDelta {
  argumentId: string;
  broadStandingDelta: number;   // signed; positive = better
  narrowStandingDelta: number;  // signed
  effectsApplied: ConcessionEffect[];
  appliedAt: string;
}

interface OpenIssueDebt {
  id: string;
  argumentId: string;
  debtType:
    | 'source_needed' | 'quote_needed' | 'scope_example_needed'
    | 'definition_needed' | 'mechanism_needed' | 'counterexample_needed'
    | 'primary_record_needed';
  openedByMoveId: string;
  openedAt: string;
  resolvedByMoveId?: string;
  resolvedAt?: string;
}

interface ScoringEligibility {
  isTangent: boolean;
  isNearDuplicate: boolean;
  isSelfConcessionLoop: boolean;
  hasAxis: boolean;
  alreadyCreditedForThisDebt: boolean;
}
```

If `isTangent || isNearDuplicate || isSelfConcessionLoop || !hasAxis || alreadyCreditedForThisDebt`, no credit awarded.

## The standing bands (mapping internal → user-facing)

```ts
const BAND_TO_PLAIN_LABEL: Record<StrengthBand, string> = {
  needs_work: 'Needs work',
  thin: 'Thin',
  neutral: 'Neutral',
  some_support: 'Some support',
  has_a_point_risky: 'Has a point, but risky',
  well_supported: 'Well supported',
  strongly_supported: 'Strongly supported',
};
```

These are the user-facing strings (SW-001). Internal code may use the seven-band enum; UI MUST use the plain labels. Stack/Cards view may show the deeper enum for transparency, but Timeline shows only the plain label.

## The worked example (from docs/point-standing-economy.md)

**Parent claim**: "Bike lanes are bad for cities."

**Challenger move (scope class)**: "Even in dense cities with strong transit? Tokyo's bike-lane network has cut bus-route accidents."

This opens a `scope_example_needed` debt on the parent.

### Responder paths

**A — Narrow concession** ("Ok, in dense transit-heavy cities they work; I meant car-dependent suburbs."):
- broad_lift (+0.25) — the broad point is preserved
- narrow_shrink (-0.15) — the narrow defect is acknowledged and shrunk
- responder_recovery (+credit) — the move earned recovery
- challenger_pressure (+credit on the challenger) — pressure was effective
- The `scope_example_needed` debt is resolved by `narrowed_scope`.

**B — Evidence delivered** ("Here's a 2024 traffic study showing protected lanes reduce dense-city accidents by 31%."):
- broad_lift (no change — broad claim wasn't conceded)
- narrow standing rises with primary_source attached
- responder_recovery (+credit)
- The debt is resolved by `primary_source_attached`.

**C — Evasion** ("Cars are bad anyway."):
- unresolved_debt_penalty (-0.25 on broad)
- evasion_narrow_drop (-0.30 on narrow)
- Debt remains open
- No credit to anyone (challenger doesn't get evasion-bonus — that would be perverse incentive)

**D — Tangent or duplicate** ("Tokyo also has good ramen."):
- ScoringEligibility.isTangent = true
- No credit awarded, no debt resolved, no penalty applied.

## How this surfaces in the UI

- The debt count is a chip on the node (EV-003).
- The "Suggested next move" in the sidecar (SC-003) reads the open debts and suggests the matching repair.
- Strength bands are rendered via stroke / weight / texture (timeline-grammar) + the plain label.
- The Stack/Cards view (ST-002) shows the deeper breakdown: which effects applied, which debts are open, suggested next moves.

## Anti-amplification interlock

The anti-amplification module (`src/features/pointStanding/antiAmplification.ts`) sits between the raw delta and the persisted standing. Rules:
- An amplification-only move (no new axis, no evidence, no narrowing) earns engagement credit but factual-standing delta is zeroed out.
- A move that narrows OR sources a previously viral claim earns BOTH engagement and factual-standing credit.

When designing a card that touches standing, route through anti-amplification — don't write to standing directly.

## Anti-patterns to refuse

- "Let's give a point a `winner` flag" → NO. Bands are gameplay analysis, not verdicts.
- "Let's auto-concede the user if they don't reply for N days" → NO. Concession is an active move, never inferred from silence.
- "Let's penalize the challenger if they were wrong" → NO. Pressure credit is earned for asking, not for being right.
- "Let's combine all open debts into one score" → NO. Debts are per-debt; aggregation collapses too much.
- "Let's show the standing band ordinal (3/7) as a percentage" → Probably NO — the band IS the unit. A percentage suggests a continuous truth-value, which we don't claim.
