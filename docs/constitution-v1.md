# Constitution v1.0.0 — CDiscourse

> This document is the human-readable source for the machine-readable constitution stored in `src/lib/constitution/v1.ts` and seeded into `constitution_versions` as version `"1.0.0"`.
> Changes to this document must be accompanied by a new version entry and a migration.

---

## Preamble

The purpose of a debate Constitution is to ensure that discourse remains structured, navigable, and fair without requiring a central authority to adjudicate truth. The Constitution governs **form**, not **content**. It defines what kinds of moves are valid in response to what, not which arguments are correct.

The Constitution is pinned to a room at creation. Rooms are never retroactively affected by later constitution versions.

---

## 1. Argument Types

Each argument submitted to a room must declare exactly one type from this registry.

| Code | Name | Description |
|---|---|---|
| `CLM` | Claim | A substantive, falsifiable assertion that supports (affirmative) or opposes (negative) the resolution. Must be declarative. |
| `RBT` | Rebuttal | A direct challenge to a parent Claim or Rebuttal. Must explain why the parent is wrong, misleading, or insufficient. |
| `CRB` | Counter-Rebuttal | A defense of the original claim against a Rebuttal. Must address the specific objection raised. |
| `EVD` | Evidence | Factual support for a parent Claim, Rebuttal, or Counter-Rebuttal. Must include at least one cited source (URL or bibliographic reference). |
| `CLR` | Clarification Request | A question asking the parent author to clarify scope, definitions, or assumptions. Must be phrased as a question. |
| `CON` | Concession | An acknowledgment that the parent argument's point is valid (partially or fully). Must explicitly state what is being conceded. |
| `SYN` | Synthesis Note | A summary of a completed subtree. Available only when the parent thread is closed. Authored by a participant or neutral party. |

---

## 2. Transition Matrix

The transition matrix defines which argument types may appear as children of which parent types. Any transition not listed here is a **violation** and will be rejected.

```
CLM  → [ RBT, EVD, CLR, CON ]
RBT  → [ CRB, EVD, CLR, CON ]
CRB  → [ RBT, EVD, CLR ]
EVD  → [ CLR, RBT ]
CLR  → [ CLM ]          // Answering a clarification with a new claim
CON  → [ SYN ]          // Optional; concession may close a subtree
SYN  → []               // Terminal — no further replies
```

**Root-level arguments** (depth = 0, parent_id = null) may only be of type `CLM`.

---

## 3. Side Rules

- `CLM`, `RBT`, `CRB` must have a side of `affirmative` or `negative`.
- `EVD`, `CLR`, `CON`, `SYN` may be `neutral` or match the author's room side.
- A participant may not switch their room side after submitting their first argument.

---

## 4. Tags

Tags are optional labels drawn from the following registry. Users may apply up to 3 tags per argument.

### Epistemic tags
- `empirical` — claim is based on empirical evidence
- `theoretical` — claim is based on theoretical reasoning
- `definitional` — claim turns on the definition of a term
- `statistical` — claim relies on statistical data
- `anecdotal` — claim is based on anecdotal evidence (informational; may trigger AI flag)

### Rhetorical / quality tags
- `speculative` — explicitly speculative claim
- `expert-opinion` — cites an expert source
- `peer-reviewed` — cites peer-reviewed literature

### Procedural tags
- `scope-dispute` — argument challenges whether the topic is within scope
- `burden-of-proof` — argument raises a burden-of-proof issue

---

## 5. Deterministic Auto-Flag Conditions

These flags are produced by the rules engine without AI involvement. They are **authoritative**.

| Rule ID | Condition | Severity |
|---|---|---|
| `INVALID_TRANSITION` | `child.type` not in `transitionMatrix[parent.type]` | `violation` |
| `INVALID_ROOT_TYPE` | Root argument type is not `CLM` | `violation` |
| `DEPTH_EXCEEDED` | `depth > maxDepth` (default 10) | `violation` |
| `BODY_TOO_LONG` | `body.length > maxBodyLength` (default 2000) | `violation` |
| `BODY_TOO_SHORT` | `body.trim().length < 20` | `warning` |
| `EVIDENCE_MISSING_SOURCE` | `EVD` argument has no cited URL or reference | `violation` |
| `CLR_NOT_QUESTION` | `CLR` body does not end with `?` | `warning` |
| `CON_MISSING_ACKNOWLEDGMENT` | `CON` body does not contain language acknowledging the parent (heuristic keyword check) | `warning` |
| `SYN_THREAD_OPEN` | `SYN` submitted while parent thread is still `open` | `violation` |
| `DUPLICATE_TAG` | Same tag applied more than once to one argument | `warning` |
| `EXCESS_TAGS` | More than 3 tags on one argument | `warning` |
| `ANON_EVIDENCE` | `EVD` body or source appears to be anonymous/unreachable | `info` |

**Violation-severity flags block submission**. Warning-severity flags surface to the author with a confirmation step. Info flags are stored silently.

---

## 6. AI Check Configuration

AI checks are optional and server-side only. They run after the argument is successfully stored. AI flags have `authoritative = false` and must be reviewed by a human moderator or the room owner before action is taken.

```json
{
  "enabled": true,
  "checks": {
    "topicRelevance": {
      "enabled": true,
      "ruleId": "AI_OFF_TOPIC",
      "severity": "warning",
      "confidenceThreshold": 0.85
    },
    "typeFit": {
      "enabled": true,
      "ruleId": "AI_TYPE_MISMATCH",
      "severity": "info",
      "confidenceThreshold": 0.80
    },
    "tagSuggestion": {
      "enabled": true,
      "ruleId": "AI_TAG_SUGGESTION",
      "severity": "info"
    }
  }
}
```

**AI checks must never**:
- Delete or hide arguments.
- Override deterministic rules.
- Assign a truth value to a claim.
- Be surfaced to end users as authoritative verdicts.

---

## 7. Structural Limits

| Parameter | Default | Range |
|---|---|---|
| `maxDepth` | 10 | 3–20 |
| `maxBodyLength` | 2000 | 100–5000 |
| `maxTagsPerArgument` | 3 | 1–5 |
| `maxEvidenceLinksPerArgument` | 5 | 1–10 |

---

## 8. Review Behavior

When a flag is generated:
1. **Violation (deterministic)**: submission is rejected synchronously. Client displays the flag message inline.
2. **Warning (deterministic)**: client presents a confirmation dialog showing the flag message. User must explicitly confirm to proceed.
3. **Info (deterministic or AI)**: stored silently; visible in the Flags Panel but no user action required.
4. **AI warning**: stored after insert; visible in Flags Panel; room owner or moderator may dismiss or escalate.

Flag dismissal requires a reviewer (`reviewed_by`) and is logged. Dismissed flags remain in the database with `dismissed = true`; they are not deleted.

---

## 9. Versioning

- Constitution versions follow semantic versioning (`MAJOR.MINOR.PATCH`).
- Breaking changes to the transition matrix or argument type registry require a MAJOR bump.
- Additive changes (new tags, new AI checks) are MINOR.
- Threshold or limit adjustments are PATCH.
- A new version must be published before it can be assigned to a room.
- Rooms cannot be migrated between constitution versions after creation.
