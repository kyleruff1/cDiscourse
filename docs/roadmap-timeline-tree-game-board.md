# Roadmap — Timeline Tree Game Board

**Status:** Roadmap expansion. **Nothing on this expansion is implemented yet.**
**Scope:** Release 6.6 (foundation + interaction) and Release 6.7 (game rules + diagnostics).
**Owner:** Kyler.
**Last updated:** 2026-05-18.

This document expands `docs/core/ux-ui-project-board.md` for the next major product direction: the argument room as a **playable argument tree** rather than a linear message list. It does **not** replace the board doc — it deepens it with the data primitives, lifecycle, board action dock, and game constraints that the Wave 1–4 cards below assume.

Existing baseline that survives every card here:

- Score / standing is gameplay analysis, never truth.
- Heat is activity / friction, never correctness.
- Popularity is not evidence.
- AI never decides who is right; client never calls AI.
- No `winner / loser / liar / true / false / verdict / proof / proven / validated / correct` copy in user surfaces.
- No `service-role` in client; no direct insert into `public.arguments`; `submit-argument` is the only write path.
- Plain-language UI only — no raw `snake_case` codes.
- `arguments` soft-delete; `flags` soft-dismiss.

---

## 1. Product thesis

The argument room is not a chat thread. It is a **playable argument tree**. A user should be able to:

1. Land in the room and read the fight in seconds.
2. Click an area of the tree, see what is unresolved there, and understand what kind of point it is.
3. Pick the next playable move from a small contextual action set without leaving the board.
4. See — without being told — when a point is live, answered, conceded, narrowed, moved on from, ignored by one party, ignored by both parties, exhausted, or ready for synthesis.
5. Open Cards / Stack only when they want richer card-level semantic detail.

The Timeline / Tree is the primary game board. Cards / Stack is the semantic detail surface.

This is **not** a verdict system. Every lifecycle state, every metadata tag, every suggested move is a **gameplay signal**, not a truth claim.

---

## 2. Current shipped foundation

Do not re-implement these.

- **Stage 6.4** — Seamless conversation entry; observer-first side action rail; gallery dedupe; section grouping.
- **Stage 6.3** — Conversation Gallery cards, dedupe, 11 buckets, mini-timeline. Lane-continuity fix (first child continues on parent lane).
- **Stage 6.2** — Score / trend non-blocking; heat = activity; advisory validation for OFF_TOPIC / PARENT_NONRESPONSIVE.
- **Stage 6.1.8** — Argument Stack + horizontal DAW-style Timeline scaffold; own-bubble safety; deletion-request flow.
- **Stage 6.5** — BRAND-001 dark shell; AppHeader; surface tokens.
- **Release 6.6 partial** — EV-001 evidence object model (build complete); EV-002 source-chain popover (build complete); VG-002 gradient wave rail (merged).

Foundation that BR-001 and friends consume directly:

- `argumentGameSurfaceModel.ts` — `computeLane` + node / edge contracts.
- `evidenceModel.ts` — `EvidenceArtifact`, `SourceChainStatus`, `TimelineEvidenceContract`.
- `railSegmentModel.ts` — `RailBranchKind`, `derivePlaceholderBranchKind` (BR-001 swap-point).
- `gameCopy.toPlainLanguage` — internal-code → user-prose map.

---

## 3. Problem statement

The current Timeline is a 1-D scroll. It reads "this happened, then this happened, then this happened." It does not communicate:

- **Branch structure** — tangents, source-chain demands, definition fights, scope challenges, evidence sub-trees, and synthesis paths all render on the same horizontal rail, with no semantic distinction beyond color.
- **Point lifecycle** — a point that was conceded looks the same as a point that was ignored, and both look the same as a point still under active pressure.
- **Move-to-point linkage** — a reply lives in a thread, but the gameplay-relevant question ("what point is this attacking, and on what axis?") is not visible at the rail.
- **Next-move guidance** — the user has to read the message to decide whether to ask for a source, narrow the claim, or branch. The board doesn't tell them.
- **Game state** — there is no visible way to recognize that a point has been **moved on from** by one or both sides, or that a sub-thread has reached **exhaustion** without anyone conceding.

The Timeline Tree Game Board roadmap encodes the primitives, lifecycle, and surfaces that make those four things visible at the rail.

---

## 4. Core interaction model

```
                       ┌────────────────────────────────────────────┐
                       │ Timeline / Tree (primary game board)       │
                       │                                            │
   mainline ─────●─────●─────●─────●─────●─────●─────●─────  …      │
                  │     │                       │                   │
                  ▼     ▼                       ▼                   │
              source  tangent                synthesis              │
              branch  branch                  branch                │
                                                                    │
   [select node/cluster] → [board action dock] → [composer preset]  │
                       │                                            │
                       └──→ Open Cards detail (semantic inspector)  │
                                                                    │
                       └──→ Sidecar (Why it matters / Unresolved)   │
                       └────────────────────────────────────────────┘
```

Interaction loop:

1. **Click an area or node.** The selection updates the active cluster. The board action dock contextualizes to that cluster.
2. **Pick a quick action.** The dock seeds a composer preset (non-accusatory body, target excerpt, axis, expected move-type).
3. **Submit through `submit-argument`.** Same path as today. No service-role, no direct insert.
4. **The rail updates.** Lifecycle states recompute deterministically. Suggested moves re-derive.

Cards / Stack is reached via "Open detail" from the dock or the popover. It is the *deeper* surface — not a competing main board.

Exhaustion / moved-on / ignored advisories are **never blocking**. An ordinary reply remains postable at all times.

---

## 5. Data model primitives

Pure-TS, no Supabase mutation, no migration in this wave. Each primitive is computed deterministically from the existing rows in `public.arguments` + `attached_evidence` + the existing semantic-flag / qualifier fields.

```ts
// LIFE-001 produces this from a message cluster.
type PointLifecycleState =
  | 'open'
  | 'answered'
  | 'rebutted'
  | 'clarified'
  | 'sourced'
  | 'quote_requested'
  | 'source_requested'
  | 'narrowed'
  | 'conceded'
  | 'confirmed'
  | 'synthesis_ready'
  | 'moved_on_by_affirmative'
  | 'moved_on_by_negative'
  | 'ignored_by_affirmative'
  | 'ignored_by_negative'
  | 'ignored_by_both'
  | 'exhausted'
  | 'branch_recommended'
  | 'archived_or_resolved';

// BR-001 produces this. Branch grammar from VG-002's RailBranchKind plus tree primitives.
type BranchKind =
  | 'mainline'
  | 'tangent'
  | 'source_chain_branch'
  | 'evidence_branch'
  | 'definition_branch'
  | 'scope_branch'
  | 'synthesis_branch';

interface TimelineNode {
  messageId: string;
  parentMessageId: string | null;
  rootPointId: string;          // cluster root, derived
  pointClusterId: string;       // see PointCluster
  branchId: string;             // see TimelineBranch
  lane: number;                 // deterministic from BR-001
  argumentType: string;
  targetExcerpt: string | null;
  disagreementAxis: string | null;
  side: 'affirmative' | 'negative' | 'observer_only' | null;
  authorId: string;
  createdAt: string;
}

interface TimelineBranch {
  branchId: string;
  parentMessageId: string | null;
  firstMessageId: string;
  branchKind: BranchKind;
  lane: number;
  isCollapsed: boolean;
  unresolvedAxis: string | null;
  messageCount: number;
  lifecycleSummary: PointLifecycleState; // worst-priority of nodes in branch
}

interface PointCluster {
  pointClusterId: string;
  rootMessageId: string;
  axis: string | null;
  messageIds: string[];
  lifecycleState: PointLifecycleState;   // see LIFE-001
  manualTags: ManualTag[];                // see META-001
  autoMetadata: AutoMetadata[];           // see META-001
  evidenceContract: TimelineEvidenceContract | null; // from EV-001
}

interface ManualTag {
  tagId: string;                  // e.g. 'needs_source' (internal); plain-language label produced separately
  appliedByUserId: string;
  appliedAt: string;
  dedupeKey: string;
}

interface AutoMetadata {
  kind: AutoMetadataKind;
  detectedAt: string;
  inputSignals: string[];         // for explainability, not for UI
}

type AutoMetadataKind =
  | 'has_reply'
  | 'has_rebuttal'
  | 'has_counter_rebuttal'
  | 'has_evidence'
  | 'source_requested'
  | 'quote_requested'
  | 'source_attached'
  | 'quote_attached'
  | 'participant_skipped_node'
  | 'no_response_after_n_turns'
  | 'repeated_axis_pressure'
  | 'branch_suggested'
  | 'branch_created'
  | 'point_stalled'
  | 'point_exhausted'
  | 'synthesis_candidate';
```

All identifiers above are **internal**. None of these strings appears in user UI; RULE-003 maps them to plain-language labels.

---

## 6. Point lifecycle states

LIFE-001 implements `derivePointLifecycleState(cluster, options)`. Each state has a deterministic derivation rule, a worst-case priority for branch summaries, and a default plain-language label (mapped by RULE-003).

| State | Derivation (simplified) | Priority | Plain-language label (default) |
| --- | --- | --- | --- |
| `open` | Reply exists, no rebuttal yet | low | "Open for response" |
| `answered` | Direct reply on same axis | low | "Has a reply" |
| `rebutted` | Counter-claim on same axis | medium | "Under pressure" |
| `clarified` | Author edited or added clarification reply | low | "Clarified by author" |
| `sourced` | Evidence attached with `source_and_quote` or `primary_present` | low | "Source attached" |
| `quote_requested` | Other side asked for quote | medium | "Quote requested" |
| `source_requested` | Other side asked for source | medium | "Source requested" |
| `narrowed` | Author posted explicit narrow concession | low | "Narrowed" |
| `conceded` | Author posted explicit concession | low | "Conceded by author" |
| `confirmed` | Other side confirmed without rebuttal | low | "Confirmed by other side" |
| `synthesis_ready` | Concession + narrowing + no unresolved debt on axis | low | "Ready for synthesis" |
| `moved_on_by_affirmative` | Affirmative side stopped engaging this cluster | medium | "Affirmative moved on" |
| `moved_on_by_negative` | Negative side stopped engaging this cluster | medium | "Negative moved on" |
| `ignored_by_affirmative` | Affirmative never responded to a request on this cluster | high | "Affirmative did not respond" |
| `ignored_by_negative` | Negative never responded to a request on this cluster | high | "Negative did not respond" |
| `ignored_by_both` | Both sides dormant past threshold | high | "Nobody followed up" |
| `exhausted` | Repeated same-axis pressure with no new info | high | "Out of new angles" |
| `branch_recommended` | Off-axis pressure repeated under root | medium | "Branch suggested" |
| `archived_or_resolved` | Cluster closed by synthesis or admin resolution | low | "Resolved" |

Doctrine:

- These are **board signals**, not verdicts.
- `conceded` does **not** mean the conceding side lost the room. Concession is a scoring repair (see `docs/point-standing-economy.md`).
- `ignored_by_*` says nothing about the ignoring user as a person. It is a cluster property, not a user label.
- `exhausted` recommends moving on. It does not block posting.

---

## 7. Manual tags vs auto metadata

META-001 distinguishes three things that are often conflated today:

1. **Manual user tags** — applied by a participant or observer to mark a node's gameplay status.
2. **Auto-derived metadata** — computed by deterministic rules from the message stream and existing semantic flags.
3. **Moderation flags** — `flags` rows, never deleted, only soft-dismissed. Out of scope for META-001 except by hard separation.

### Manual tags (user-applied)

| Tag (internal) | Plain-language label |
| --- | --- |
| `needs_source` | "Needs source" |
| `needs_quote` | "Needs quote" |
| `definition_issue` | "Definition fight" |
| `scope_issue` | "Scope challenge" |
| `causal_mechanism` | "Mechanism challenge" |
| `evidence_debt` | "Evidence debt" |
| `concession_offered` | "Concession offered" |
| `narrowed_claim` | "Narrowed claim" |
| `tangent` | "Tangent / side issue" |
| `ready_for_synthesis` | "Ready for synthesis" |

### Auto-derived metadata

See `AutoMetadataKind` in §5. RULE-003 produces plain-language labels for any auto metadata that surfaces in UI.

### Hard separation

- Manual tags **never** trigger moderation review.
- Moderation flags **never** appear as gameplay tags.
- A `flags` row exists in `public.flags` (existing table). A manual tag exists in pure model output and is computed per render — META-001 does **not** persist tags in v1.
- Auto metadata is computed at render time. No persistence layer.

This v1 stays read-only at the data layer. The model is wired into the UI without a migration.

---

## 8. Board action dock (SC-004)

A compact contextual action palette on the Timeline / Tree surface. Anchored near the selected node, or as a stable bottom rail on narrow screens.

### Required quick actions

| Action | Maps to | Composer preset |
| --- | --- | --- |
| Reply | `argument_type='claim'` or `'support'` | Empty body |
| Challenge | `argument_type='challenge'` | Axis hint |
| Ask source | `argument_type='source_chain'` | EV-002 `ASK_SOURCE_PRESET_BODY` |
| Ask quote | `argument_type='source_chain'` | EV-002 `ASK_QUOTE_PRESET_BODY` |
| Clarify | `argument_type='clarification'` | "Could you clarify…" preset |
| Add evidence | `argument_type='evidence'` | Empty body + evidence form |
| Narrow | `argument_type='narrow_concession'` | "I'd narrow this to…" preset |
| Concede | `argument_type='concession'` | "I concede that…" preset |
| Confirm | `argument_type='confirmation'` | "I accept this point" preset |
| Mark moved on | Manual tag `moved_on_by_<side>` | (No composer; tag only) |
| Mark ignored | Manual tag `ignored_by_<side>` | (No composer; tag only) |
| Branch | `argument_type='branch'` | Branch kind dropdown |
| Synthesize | `argument_type='synthesis'` | "Synthesis: …" preset |
| Flag | `flags` row insert (existing path) | Reason picker |
| Open Cards detail | Surface toggle, not route | (No composer) |

### Actor rules (locked)

| Actor | Allowed actions |
| --- | --- |
| Observer | Watch · Join For · Join Against · Ask source · Open timeline · Share · Open Cards detail |
| Participant (other's bubble) | Reply · Challenge · Ask source · Ask quote · Clarify · Add evidence · Narrow · Concede · Confirm · Mark moved on · Mark ignored · Branch · Synthesize · Flag · Open Cards detail |
| Participant (own bubble) | Open Cards detail · Mark synthesis-ready (own) · Mark narrowed (own) · Request deletion |
| Admin | All above + admin review (out of scope for SC-004) |

Own-bubble safety unchanged: no edit, no disagree, no flag, no score.

### Dock placement

- Wide viewport: docked near the selected node (popover-style).
- Narrow viewport: fixed bottom rail, contextualised to the selected cluster.
- Dock is dismissed by selecting another cluster, by tapping outside, or by opening Cards detail.

### Non-route guarantee

Open Cards detail is a **surface toggle**, not a route change. Browser back does not strand the dock. This honors TL-003.

---

## 9. Cards / Stack detail inspector (ST-002 expansion)

When Open Cards detail fires from the dock or popover, the Stack view renders:

1. **Lifecycle banner** — plain-language label for the current point lifecycle state, plus the relevant auto-metadata that derived it.
2. **Suggested next moves** — derived from lifecycle + tags + axis + evidence status. Maps to dock actions.
3. **Semantic flags** — internal flags converted to plain language via RULE-001 + RULE-003.
4. **Evidence / source-chain status** — EV-001 contract.
5. **Parent / child path** — node breadcrumb back to root and down through replies.
6. **Unresolved axes** — derived from META-001 auto metadata.
7. **Branch reason** — what kind of branch this is (BR-001 BranchKind) and why it forked.
8. **Last responder** — which side most recently engaged.
9. **Ignored / exhausted indicators** — lifecycle advisory copy.
10. **Lifecycle event history** — chronological list of state transitions for this cluster.

No body editing in Stack. No internal codes leak.

---

## 10. Exhaustion / timeout / moved-on rules (GAME-001)

Pure-model advisories. Non-blocking. Never produce a verdict.

### Inputs

- Same-axis pressure count (META-001 `repeated_axis_pressure`).
- Turns since each side last engaged this cluster.
- Concession / narrowing / synthesis presence under cluster.
- Branch suggestions count.
- Cluster age vs room age.

### Rules

1. **Exhaustion advisory** — Same axis pressed ≥ N times without new evidence, source, scope, definition, or mechanism information → `exhausted`.
2. **Moved-on advisory** — Side has not posted to this cluster in ≥ M of its own subsequent turns → `moved_on_by_<side>`.
3. **Ignored-by-side advisory** — Other side requested source / quote / evidence; this side has had K turns since and did not respond on this cluster → `ignored_by_<side>`.
4. **Ignored-by-both advisory** — Both sides dormant on cluster for J turns → `ignored_by_both`.
5. **Synthesis-ready** — At least one explicit concession or narrowing on this axis, no unresolved evidence debt → `synthesis_ready`.

Thresholds (N, M, K, J) are constants in the model. They are tunable, but the v1 values are chosen so the model rarely fires under short rooms and reliably fires under genuinely stale clusters.

### What GAME-001 does **not** do

- Does not block posting.
- Does not auto-archive.
- Does not delete content.
- Does not call AI.
- Does not produce a winner / loser / truth label.
- Does not penalise the ignoring side's standing without operator review.
- Does not message a user.

---

## 11. Manual tags vs auto metadata (interaction map)

| Surface | Source | Plain-language? |
| --- | --- | --- |
| Rail / Timeline | Auto metadata + lifecycle state | Yes (RULE-003) |
| Board action dock (SC-004) | Lifecycle state → allowed actions | Yes |
| Cards detail (ST-002) | Manual tags + auto metadata + lifecycle | Yes |
| Sidecar (SC-003) | Lifecycle banner + unresolved axes + suggested move | Yes |
| Gallery card (GAL-002) | Cluster-summary lifecycle of room root cluster | Yes |
| Diagnostics (AN-003) | Aggregate counts | Dev-only |

---

## 12. Accessibility requirements

(Anchored to the `accessibility-targets` skill — re-stated here for visibility.)

- Tap targets ≥ 44×44 px for any dock action, lifecycle chip, or branch stub the user can tap.
- Every lifecycle state, branch kind, and dock action exposes an `accessibilityLabel` that is plain-language.
- Color independence: shape + stroke + label communicate state without color. (See VG-001 grammar.)
- Screen-reader contract: every node announces type, ordinal, lifecycle state, branch kind, and active state.
- Keyboard navigation: arrow L/R moves active node; arrow U/D moves between branch lanes; Home/End jumps to root / latest; Enter opens dock; Escape closes dock.
- Reduce-motion: any pulse / sweep / glow respects `AccessibilityInfo.isReduceMotionEnabled()`.
- No internal `snake_case` codes in any accessibility string.

---

## 13. Visual grammar requirements

(Anchored to the `timeline-grammar` skill.)

- Branch grammar (BR-001):
  - `mainline` — solid horizontal rail.
  - `tangent` — bent connector, dashed edge, slate / amber.
  - `source_chain_branch` — dotted teal ring + hex; matches EV-002.
  - `evidence_branch` — solid hex + receipt mark.
  - `definition_branch` — bracket icon stub.
  - `scope_branch` — angle / bracket icon stub.
  - `synthesis_branch` — joined-capsule stub.
- Collapsed branch stub: shows `branchKind` icon + `messageCount` + `lifecycleSummary` chip.
- Active path: glow / saturated stroke.
- Lifecycle chips: shape + label + color (color secondary).
- No verdict tokens in any visual label.
- No popularity-shaped affordances (no "trending", no like counts).

---

## 14. Release 6.6 priority sequence

### Wave 1 — Foundation
1. **BR-001** — Tangent kink model / argument tree layout foundation.
2. **LIFE-001** — Point lifecycle metadata model.
3. **META-001** — Move tag / flag / metadata event ledger.

### Wave 2 — Board interaction
4. **SC-004** — Timeline node action dock.
5. **IX-001** — Timeline zoom and density modes (with focus lens).
6. **ST-002** — Suggested reply flags per bubble card (lifecycle-driven).

### Wave 3 — Game constraints
7. **GAME-001** — Point exhaustion and timeout advisories.
8. **RULE-003** — Lifecycle-to-UX doctrine map.
9. **IX-002** — Timeline mini-map overview.

### Wave 4 — Diagnostics / polish
10. **AN-003** — Tree playability diagnostics.
11. **GAL-002** expansion — first suggested move from lifecycle metadata.
12. **EV-003 / EV-004** tie-ins — evidence debt + lifecycle symmetry.

---

## 15. Release 6.7 follow-ups

- **IX-003** — Keyboard and accessibility navigation (locks Wave 2 keyboard contract).
- **BR-002** — Split-screen branch inspector.
- **PR-001 / PR-002 / PR-003 / PR-004** — Profile / preferences.
- **AN-001 / AN-003** — Board diagnostics expansion.

---

## 16. Open design risks

1. **Lifecycle state derivation** can fight existing semantic-flag derivation. LIFE-001 must build *on top* of existing flags and qualifiers, not in parallel. Designer responsibility.
2. **Action dock vs popover overlap** — SC-002 popover already exists. SC-004 must reuse / extend, not replace. If SC-002 already does ≥ 80% of the dock job, designer recommends folding SC-004 into a SC-002 expansion.
3. **Tree layout determinism** — first-child-continues + additional-children-branch must produce stable lanes across 250+ messages. Non-deterministic lane assignment would break tests + visual QA snapshots (AN-002).
4. **Manual tag vs moderation flag confusion** — META-001 must make the separation obvious in code names and UI labels.
5. **Exhaustion thresholds** — wrong values create false advisories that nag users. v1 values are conservative; tune after AN-003 lands.
6. **`ignored_by_<side>` framing** — must describe a *cluster*, never a user. Doctrine review at design time.
7. **Gallery hint freshness** — GAL-002 first-suggested-move is derived from lifecycle metadata; stale derivation lies to the user.

---

## 17. GitHub issues — create / update list

### To update (scope additions only, preserve existing acceptance)
- **BR-001 (#7)** — add tree-layout-foundation scope (branch kinds, cluster focus, collapsed stub, active path, 250+ stress).
- **IX-001 (#20)** — add focus lens (active path / branch cluster / unresolved only / evidence-only) and area-click cluster selection.
- **IX-002 (#21)** — add branch cluster summary + click-to-focus + collapsed branch support.
- **SC-003 (#11)** — clarify boundary with SC-004; SC-003 stays the detail inspector.
- **ST-002 (#13)** — add lifecycle-derived suggestion source.
- **RULE-002 (#33)** — cross-ref to RULE-003.
- **GAL-002 (#31)** — add lifecycle-driven first-suggested-move hint sourcing.

### To create
- **LIFE-001** — Point lifecycle metadata model (P0/L/6.6/Rules UX).
- **META-001** — Move tag / flag / metadata event ledger (P0/L/6.6/Rules UX).
- **SC-004** — Timeline node action dock (P0/M/6.6/Sidecar Rail).
- **GAME-001** — Point exhaustion and timeout rules (P1/M/6.6/Rules UX).
- **RULE-003** — Lifecycle-to-UX doctrine map (P1/M/6.6/Rules UX).
- **AN-003** — Tree playability diagnostics (P2/M/6.7/Analytics).

### Not changing in this pass
- **SW-002, EV-003, EV-004** — already aligned with this roadmap. No body edit needed.

---

## 18. Discovery backlog (P2 unless flagged otherwise)

These appeared while walking the roadmap. Each one passes the three-criterion test (removes timeline friction, deterministically testable, no new dependency / live AI / service-role). They are **not** part of Wave 1–4 acceptance.

- **NAV-001** — Keyboard branch traversal shortcuts (depends on IX-003).
- **NAV-002** — Selected cluster breadcrumb at top of dock.
- **NAV-003** — "Collapse all resolved branches" gesture.
- **NAV-004** — Unresolved point queue (sidebar).
- **NAV-005** — Suggested next move queue.
- **LEG-001** — Board legend simplification.
- **A11Y-001** — Touch target audit for dense trees.
- **COPY-001** — State transition copy map (PR review for every lifecycle label).
- **HIST-001** — Lifecycle event history in Cards detail.

Each will be filed as a P2 issue *after* the corresponding wave card lands.

---

## 19. Do not implement in this roadmap pass

- Do not run Anthropic / xAI / X / OpenAI calls.
- Do not import a graph visualization library.
- Do not deploy Supabase migrations or Edge Functions.
- Do not change `public.arguments` schema.
- Do not run corpus harvests or live bot pilots.
- Do not auto-archive points.
- Do not block posting based on lifecycle state.
- Do not introduce a "truth" or "winner" label anywhere.
- Do not implement voting, search, push, OAuth, or public API — v1 scope, unchanged.
- Do not persist manual tags to Supabase yet (v1 is render-time only; later wave may add a `point_tags` table with operator approval).
- Do not bake "engagement" or "popularity" into any lifecycle state.

---

## 20. First implementation path

```
BR-001 → LIFE-001 → META-001 → SC-004 → IX-001 → ST-002 → GAME-001
        (Wave 1)                (Wave 2)                  (Wave 3)
```

This is the dependency order:

1. **BR-001** locks the tree / branch / cluster contract.
2. **LIFE-001** computes point lifecycle from that tree.
3. **META-001** adds manual + auto metadata layered on top.
4. **SC-004** consumes lifecycle + metadata to drive the dock.
5. **IX-001** adds density / focus modes so the tree stays navigable.
6. **ST-002** drives Cards-detail suggestions from lifecycle + metadata.
7. **GAME-001** adds exhaustion / moved-on / synthesis-ready advisories.

Each card runs through the standard Design → Build → Review agent loop (see `docs/core/agent-workflow.md`).
