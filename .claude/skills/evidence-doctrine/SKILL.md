---
name: evidence-doctrine
description: Evidence and source-chain doctrine — what counts as evidence, how anti-amplification works, how evidence debt is tracked, and the boundary between engagement credit and factual-standing credit. Invoke for Epic 6 (Evidence) cards, Epic 11 (Gallery source-trail buckets), and Epic 12 (Rules UX). This is the doctrine layer; the patterns layer is in supabase-edge-contract and expo-rn-patterns.
---

# Evidence + anti-amplification doctrine

## The core distinction

CDiscourse separates two scores that look the same in social-media products:

- **Engagement credit** — earned for activity: replies, observations, branches, prompts. Popularity-shaped.
- **Factual-standing credit** — earned only when a claim is backed by inspectable evidence. Truth-adjacent (but still gameplay, not Truth™).

Amplification (high engagement, retweets, virality) earns engagement credit. It does **not** earn factual-standing credit until evidence arrives. This is the anti-amplification rule.

## What counts as "evidence"

The `EvidenceArtifact` shape (EV-001):

```ts
interface EvidenceArtifact {
  id: string;
  argumentId: string;
  kind: 'url' | 'quote' | 'source_text' | 'dataset' | 'screenshot_redacted' | 'manual_citation';
  label: string;
  url?: string;
  sourceText?: string;
  quote?: string;
  sourceChainStatus:
    | 'unverified'        // user attached but nothing inspected
    | 'claimed'           // user claims it's a primary source
    | 'primary_source'    // chain reaches an inspectable primary record
    | 'secondary_source'  // reputable secondary, no primary record reachable
    | 'broken_chain';     // dead link, contradictory, or circular
  risk: 'low' | 'medium' | 'high' | 'unknown';
  addedByUserId: string;
  createdAt: string;
}
```

A move can have zero, one, or many artifacts. Multiple artifacts of different `kind` is the strongest evidence pattern (URL + quote + dataset).

### What does NOT count as evidence

- Popularity (likes, RTs, shares)
- Author identity (verified badge, follower count, "expert" label)
- Repetition (many people said it)
- Emotional intensity
- Confidence of the claim
- The reader's prior belief
- Other CDiscourse users agreeing

If a UI surface ever treats one of these as evidence, it's a doctrine violation.

## Evidence debt — the gameplay model

When a move makes a claim that needs evidence to earn factual-standing credit, the system opens an **evidence debt** of one of these types:

| Debt type | What resolves it |
| --- | --- |
| `source_needed` | A source attached with `claimed` or stronger status |
| `quote_needed` | A `quote` field populated and matching the cited source |
| `scope_example_needed` | A child move providing a concrete in-scope example |
| `definition_needed` | A child move defining the contested term |
| `mechanism_needed` | A child move describing the causal mechanism |
| `counterexample_needed` | A child move giving a counterexample (when the parent claim is universal) |
| `primary_record_needed` | Evidence with `sourceChainStatus = primary_source` |

Display rules (EV-003):
- Debt is **per move**, not global. A move can carry multiple debts.
- A debt is **never** rendered as "this point is false". It's "this point lacks X."
- Debt count appears as a chip on the node; details appear in the sidecar.
- Debt is resolved by *later* moves — not retroactively edited into the original.

## Source-chain status — what "anchored" means

```
unverified → claimed → primary_source        (best case — chain anchored)
                    ↘  secondary_source       (acceptable — chain ends at reputable)
                    ↘  broken_chain            (worst — chain dead-ends or circles)
```

Rules:
- Only an admin can mark a chain `primary_source` if the system can't verify automatically.
- A chain becomes `broken_chain` if: URL returns 404, the quoted text is not in the linked source, or the chain has a cycle.
- A "source trail anchored" badge on a node means at least one artifact reached `primary_source`.

## Anti-amplification — the deterministic gate

The module `src/features/pointStanding/antiAmplification.ts` post-processes a `PointStandingDelta`. Preserve these semantics:

1. **Amplification-only moves** (high engagement, no new evidence, no narrowing) earn engagement credit; factual-standing gain is suppressed.
2. **Narrowing a viral claim** with a specific scope/definition earns the conversion bonus — broad standing lifts +0.25, narrow defect shrinks -0.15.
3. **Sourcing a viral claim** with a primary record converts engagement to factual standing.
4. **Repetition without addition** earns no further credit on either axis.

Banned user labels in any annotation field: `troll`, `bot`, `astroturfer`, `liar`, `propagandist`, `extremist`, `bad faith`, `manipulative`. These describe people, not text. They never appear in annotations or UI strings.

## How challenges create debt

When a reply challenges a parent claim, the challenger's class determines what debt opens on the parent:

| Challenge class | Debt opened on parent |
| --- | --- |
| `source_chain` | `source_needed` (or upgrade `quote_needed` if source exists) |
| `scope` | `scope_example_needed` |
| `definition` | `definition_needed` |
| `causal` | `mechanism_needed` |
| `evidence` | `primary_record_needed` |
| `logic` | (none — logic critiques don't create new debt; they ask the parent to defend the inference) |
| `tangent` | (none — tangents don't open parent debt) |

A challenge that just expresses disagreement without naming an axis opens no debt and earns no credit. This blocks "I don't like it" from creating gameplay pressure.

## Repair moves — what closes a debt

Per the point-standing economy:

- **Narrow concession** ("ok, only in cities") — lifts broad standing, shrinks narrow defect.
- **Source attached** — closes `source_needed`, upgrades to `quote_needed` if no quote.
- **Quote attached** — closes `quote_needed`.
- **Mechanism explained** — closes `mechanism_needed`.
- **Synthesis** — closes ALL outstanding debts on the synthesized subtree (rare, earns the largest standing lift).
- **Evasion** ("cars are bad anyway") — pays the unresolved-debt penalty (0.25) and drops narrow standing.

## UI implications (Epic 6 cards)

- **EV-001** introduces the artifact object — no UI yet, just the model + storage.
- **EV-002** introduces the source-chain popover — never accuses, always asks ("Where did this come from?").
- **EV-003** surfaces debt chips on nodes + sidecar.
- **EV-004** ensures rule codes map to plain-language tools (Ask for source, Needs receipts, etc.) via `gameCopy.toPlainLanguage`.

## Hard refusals

Refuse to design any feature that:
- Counts likes/views/follower count toward factual standing.
- Labels a user as "bad faith" or "manipulative" or other person-attributions.
- Auto-deletes a viral but unsourced claim.
- Treats lack of evidence as proof of falsehood.
- Surfaces another user's evidence-risk score without their action having created it.
