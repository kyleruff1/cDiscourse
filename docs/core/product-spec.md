# Product Specification — CDiscourse

## Overview

CDiscourse is a mobile-first structured debate app. Users create debate rooms around a resolution (a clear, falsifiable proposition) and build arguments in a recursive tree. Every argument has a declared type; the type determines which reply types are valid. A versioned software Constitution defines all rules. A lightweight AI layer produces optional, non-authoritative flags that humans review.

The guiding philosophy: **structure over censorship**. The app enforces form, not conclusions.

---

## Core Concepts

### Resolution
A debate room is anchored to a single resolution — a declarative claim that can be affirmed or negated. Example: *"Universal basic income reduces long-term poverty."*

Rooms have:
- A side: **Affirmative** or **Negative** (participants self-assign)
- A status: `open | voting | closed | archived`
- An optional deadline
- A constitution version (pinned at room creation)

### Argument Tree
Arguments form a recursive tree rooted at the resolution. Each node has:
- A **type** (see below)
- A **side** (affirmative | negative | neutral)
- A **body** (rich text, max 2000 chars)
- Optional **evidence links** (URLs + citation label)
- A **parent_id** (null for root claims)
- A **depth** counter (enforced max by constitution)
- A set of **tags** chosen from the constitution's tag registry
- A list of **flags** (deterministic + AI)

### Argument Types

| Type | Abbrev | Purpose |
|---|---|---|
| Claim | CLM | A substantive assertion supporting or opposing the resolution |
| Rebuttal | RBT | Direct response challenging a parent claim or rebuttal |
| Counter-Rebuttal | CRB | Response to a rebuttal defending the original claim |
| Evidence | EVD | Factual support attached to a claim or rebuttal |
| Clarification Request | CLR | Asks the parent author to define terms or scope |
| Concession | CON | Acknowledges a point in the parent argument |
| Synthesis Note | SYN | Summarizes a subtree; available after a sub-debate reaches `closed` |

### Reply Transition Matrix (Constitutional Default)

```
Parent type     → Allowed child types
─────────────────────────────────────
CLM             → RBT, EVD, CLR, CON
RBT             → CRB, EVD, CLR, CON
CRB             → RBT, EVD, CLR
EVD             → CLR, RBT
CLR             → CLM (clarification answer)
CON             → SYN (optional)
SYN             → (terminal — no replies)
```

The transition matrix is defined in the Constitution and can be changed across versions. Rooms are pinned to the version active at creation.

---

## Screens

### Auth
- **Login / Signup** — email+password via Supabase Auth; OAuth (Google) in a later stage.

### Home
- **Room Feed** — list of open rooms the user participates in or follows; create-room CTA.
- **Explore** — browse public rooms by tag.

### Room Detail
- **Resolution header** — shows the proposition, status badge, participant counts.
- **Argument Tree** — recursive collapsible tree. Long trees virtualized.
- **Compose Drawer** — slides up when replying; shows allowed reply types for the selected parent; validates in real time against the rules engine before submission.
- **Flags Panel** — collapsible; shows deterministic and AI flags for review.

### Argument Detail
- Full body, evidence links, metadata.
- Flag list with explanations.
- Reply button (opens Compose Drawer pre-scoped to this argument).

### Constitution Viewer
- Renders the active constitution version for the current room.
- Diff view when comparing versions.

### Profile
- Username, display name, debate stats (arguments submitted, concessions made, synthesis notes authored).

---

## AI Moderation — Intentional Constraints

The AI layer **must not**:
- Declare a winner or loser.
- Delete or hide content automatically.
- Assign truth or falsity to claims.
- Act as the primary enforcement mechanism.

The AI layer **may**:
- Produce a **topic-relevance flag** (is this argument on-topic to the resolution?).
- Produce a **type-fit flag** (does the body text match the declared argument type?).
- Suggest **tags** from the constitution registry (user confirms).
- Summarize a subtree when the user requests a synthesis note (user edits and submits).

All AI outputs are stored as `flags` with `source = 'ai'` and `authoritative = false`. The deterministic rules engine is always authoritative.

---

## Constitution System

The Constitution is a versioned JSON/TypeScript document stored in the database and in source control. It defines:

- `argumentTypes` — registry of valid types with display labels
- `transitionMatrix` — allowed child types per parent type
- `tags` — taxonomy of debate tags (e.g., `empirical`, `philosophical`, `definitional`)
- `autoFlagConditions` — deterministic rules that produce flags without AI
- `severityLevels` — `info | warning | violation`
- `maxDepth` — maximum tree depth (default 10)
- `maxBodyLength` — character limit per argument body (default 2000)
- `aiChecks` — which AI checks are enabled and their confidence thresholds

---

## Non-Goals (v1)

- Real-time collaborative editing of argument bodies.
- Video or audio arguments.
- Voting/scoring system (reserved for v2).
- Public API.
- Web version (mobile-first; Expo Web is low-priority).
