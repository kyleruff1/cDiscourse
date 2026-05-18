---
name: timeline-grammar
description: Visual grammar and token system for the argument timeline. Invoke for cards in Epic 2 (Visual Grammar), Epic 3 (Branches), Epic 7 (Strength/Weakness), and any work that touches argument node rendering, branch lanes, or strength bands. Defines the shape/color/stroke/strength mapping and the rules that keep visuals from drifting into truth claims.
---

# Timeline visual grammar — CDiscourse

## What a node visually encodes

Every timeline node carries four orthogonal signals:

| Signal | Encoded by | Independent of color? |
| --- | --- | --- |
| **Argument type** (root / claim / challenge / evidence / source-chain / clarify / concede / synthesis / branch / flag) | Shape | Yes — shape is primary |
| **Strength band** (Needs work → Strongly supported) | Stroke weight + texture | Yes — stroke is primary |
| **Heat / unresolved pressure** | Fill saturation | Partially — saturation only, never the only signal |
| **Active selection** | Outer glow + scale + z-index | Yes — geometry is primary |

The rule that follows: a colorblind user must still distinguish all 10 types and 7 strength bands. Test this with grayscale snapshots.

## The token table

```ts
type ArgumentNodeKind =
  | 'root' | 'claim' | 'challenge' | 'evidence' | 'source_chain'
  | 'clarify' | 'concede' | 'synthesis' | 'branch' | 'flag';

type StrengthBand =
  | 'needs_work'        // pretty wrong
  | 'thin'              // slightly wrong
  | 'neutral'           // neutral
  | 'some_support'      // slightly right
  | 'has_a_point_risky' // maybe right but misguided
  | 'well_supported'    // pretty right
  | 'strongly_supported';// completely right
```

Mapping table:

| Kind | Shape | Stroke style | Color family | Inner mark | Plain label |
| --- | --- | --- | --- | --- | --- |
| `root` | Rounded square / flag tab | Solid 2px | Indigo | — | Root |
| `claim` | Circle | Normal 1.5px | Indigo/blue | — | Claim |
| `challenge` | Diamond | Bold left edge (3px on one side) | Orange/red | — | Challenge |
| `evidence` | Hexagon | Normal | Cyan/green | Receipt tick | Evidence |
| `source_chain` | Hexagon | Dotted ring | Cyan/teal | Question mark | Source? |
| `clarify` | Circle with question notch | Light pulse | Amber | — | Clarify |
| `concede` | Pill | Soft gradient | Purple | — | Narrowed |
| `synthesis` | Large pill / joined capsule | Double border | Purple/green | Merge glyph | Synthesis |
| `branch` | Bent connector node | Dashed edge | Slate/amber | — | Side issue |
| `flag` | Warning marker | Crosshatch | Red/slate | — | Review |

Strength band overrides:
- `needs_work` / `thin` → muted fill, dashed border, smaller size
- `neutral` → standard
- `some_support` / `has_a_point_risky` → saturated fill, normal border
- `well_supported` / `strongly_supported` → glow border, slight size boost

## What the labels MUST NOT say

The plain label NEVER includes: "winner", "loser", "correct", "incorrect", "true", "false", "right", "wrong" (as standalone judgment), "liar", "dishonest". A node is "Strongly supported" or "Has a point, but risky" — never "Correct" or "True".

## Branch lane assignment (Epic 3)

```
Lane 0 = mainline
Lane +1 = first tangent branch up from mainline
Lane -1 = first tangent branch down from mainline
Lane +2, -2, +3, -3 = subsequent branches, alternating
```

The pure-TS lane assigner already exists in `argumentGameSurfaceModel.ts`. Rules:
- The **first child** of a parent continues on the parent's lane (no diagonal scatter — fix from Stage 6.3).
- Subsequent children branch up/down alternately.
- A branch with unresolved evidence/source-chain pressure inherits the parent's lane but gets a kink marker at its first node.
- Collapsed branches render as a single stub node with a child count badge.

## The gradient wave rail (VG-002)

The main rail is segmented `<View>` strips between consecutive nodes. Each segment blends:

```ts
segmentColor = mixHex(
  nodeColor(prev),
  nodeColor(next),
  0.5
);

// Then overlay tone (warmth from heat) and evidence-risk:
finalColor = applyOverlay(segmentColor, {
  heat: heatLevel(prev, next),         // 0..1, warmth multiplier
  evidenceRisk: maxEvidenceRisk(prev, next), // adds a dotted texture if 'high' | 'unknown'
});
```

Active path glows with a single extra `<View>` overlay at higher z-index. Tangent branches break the rail with a visible kink (small angled stub).

## "Heat" is not truth

Per `cdiscourse-doctrine`: heat means **activity / friction**, never **correctness**. Visuals must reflect this:
- A heavily-replied wrong claim looks "hot" but its strength band stays "Needs work" — the band, not the heat, signals support.
- Quiet rooms are framed as "easy entry", not "boring" or "unimportant".

## Accessibility on every node

Every node `<Pressable>` exposes:

```ts
{
  accessibilityRole: 'button',
  accessibilityLabel: `${plainLabel} on side ${side}, position ${ordinal}, ${strengthBandLabel}${isActive ? ', active' : ''}`,
  accessibilityState: { selected: isActive },
}
```

Minimum hit area 44×44 (use `hitSlop` if visual is smaller).

## When designing new visual states

If a card wants to add a new node visual:
1. Decide which signal it carries (type / strength / heat / selection).
2. Pick an encoding that doesn't depend on color alone.
3. Verify no truth/judgment language enters the label.
4. Add a snapshot test and a grayscale snapshot test.
5. Update the token table in this skill if the addition is permanent.
