# CDiscourse — Disagreement-Loop / Referee-Surface roadmap (REF slate, 2026-06-12)

**Type:** Roadmap expansion. No production code in this document. Each card is a separate piece of work with its own
GATE-A design doc at `docs/designs/REF-NNN-*.md` (produced later by the standard
`roadmap-designer → roadmap-implementer → roadmap-reviewer` pipeline) and its own GitHub issue.

**Status:** Planning artifact only. None of the 7 cards has started its pipeline.

**Verified-at-HEAD:** `c46c8e0` (`feat(OPS-MCP-BAN-SCAN-NORMALIZATION) … (#583)`). Every `file:line` anchor in this
document was re-resolved at that SHA by the REF-SLATE-2026-06-12 grounding pass — with one named exception: the two
`docs/testing-runs/2026-06-12-*` dry-run reports cited in §8.7 are worktree artifacts of the operator's corpus-run
lane, untracked at `c46c8e0` and verified in the worktree (they are committed by that lane, not by this PR). Where the
drafting brief's anchors had drifted, the re-resolved anchors appear here and the divergence is recorded in
`docs/designs/SPRINT-2026-06-12-REF-SLATE-INDEX.md` § divergence ledger (the index lands in the same PR as this
document).

**Companion docs:**
- [`docs/designs/SPRINT-2026-06-12-REF-SLATE-INDEX.md`](../designs/SPRINT-2026-06-12-REF-SLATE-INDEX.md) — the sprint index for the run that filed this slate (reconciliation table, DAG validation, attestations).
- [`docs/core/roadmap-semantic-referee-modularity.md`](../core/roadmap-semantic-referee-modularity.md) — the structural model this document follows.
- [`docs/designs/QOL-030.md`](../designs/QOL-030.md) / [`QOL-031.md`](../designs/QOL-031.md) / [`QOL-032.md`](../designs/QOL-032.md) / [`QOL-033.md`](../designs/QOL-033.md) — the one-box + Act/Inspect/Go chassis this slate turns into one loop (all four are build-complete; code in `src/features/arguments/oneBox/`).
- [`docs/designs/RULE-005.md`](../designs/RULE-005.md) — the move-channel vocabulary this slate canonizes as the user-facing layer.
- [`docs/designs/UX-001.5A.md`](../designs/UX-001.5A.md) — the Observations / Allegations node-label schema REF-005 builds on.

**Board:** GitHub Project #1 (`CDiscourse UX/UI Roadmap`, owner `kyleruff1`). All 7 cards filed with Phase=Backlog.

---

## 1. Why this slate exists

The app asks users to reason in too many simultaneous vocabularies:

- **Constitution types** — CLM / RBT / CRB / EVD / CLR / CON / SYN, with a hard transition matrix
  (`docs/core/constitution-v1.md:18` "exactly one type from this registry"; matrix at `:34-46`).
- **Move channels** — RULE-005's 12 active `MoveChannel`s + 2 reserved (`docs/designs/RULE-005.md:128-156`).
- **One-box lifecycle** — QOL-030's stage model and box types (`docs/designs/QOL-030.md:85-98`, `:227-243`).
- **MCP classifier families** — ten boolean-observation families with per-family rawKeys.
- **Doctrine layer** — machine Observations vs user Allegations (`docs/designs/UX-001.5A.md`; descriptor at
  `src/features/nodeAnnotations/annotationChipDescriptor.ts:59,:66,:111`).

Each vocabulary exists for a reason. The user needs **one mental model at a time**. The "exactly one type"
requirement and the transition matrix are right as persistence and validation machinery but over-exposed as a
drafting experience (the compose surface validates against the rules engine in real time —
`docs/core/product-spec.md:75`; the type registry requirement lives at `docs/core/constitution-v1.md:18`).

Referee feedback is fragmented across flags, families, chips, spans, allegations, advisory sheets, channel chips,
lifecycle stages, and observability. There is no single coherent referee voice at the turn level. The missing piece is
a first-class object **above the raw node and below the room**: the **Disagreement Contract / Open Issue**, with a
**Referee Card** as the user-facing translation of MCP output.

QOL-030/031/032/033 already point here — and all four are **built** (`src/features/arguments/oneBox/`:
`boxModel.ts`, `actPopoutModel.ts`, `inspectPopoutModel.ts`, `goPopoutModel.ts`, `OneBox.tsx`, `ActPopout.tsx`,
`InspectPopout.tsx`, `GoPopout.tsx`). The slate's job is to stop treating them as parallel surfaces and make them the
implementation of one loop:

> **Act changes the issue · Inspect explains the issue · Go moves around the issue map · the box drafts the next
> move · the Referee Card summarizes what the MCP observed and what keeps the issue focused.**

## 2. Doctrine constraints (inherited; non-negotiable)

Every card in this slate is bound by `cdiscourse-doctrine`. The frozen invariants; each REF issue body's doctrine
block restates the ones its card touches, and the acceptance-gate invariant appears verbatim on every
classifier-adjacent card:

1. **Acceptance-gate invariant (verbatim on every classifier-adjacent card):**
   *AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine
   (`src/domain/constitution/engine.ts`, mirrored for the server at
   `supabase/functions/_shared/constitution/`) is the sole gate. Classifiers run after an argument is stored. No path
   may block, reject, route, or delay an ordinary user post.*
   Verified at HEAD: `supabase/functions/submit-argument/index.ts:13` imports
   `evaluateArgumentDraft` from the deterministic mirror; the engine's `allowPost` (`:296-337`) is the sole
   content-validation gate, and every other blocking path in the function (schema, auth/role, concession-structure
   checks) is likewise deterministic — no classifier path blocks, routes, or delays a post. (The drafting brief's
   `src/lib/constitution/engine.ts` path does not exist; the live engine is
   `src/domain/constitution/engine.ts` — see the index's divergence ledger.)
2. No AI truth adjudication, no winner/loser labels, no authoritative AI moderation
   (`docs/core/product-spec.md:92-106`; doctrine skill §1/§4 — these verdict-token prohibitions are quoted here only
   as prohibitions).
3. No machine-made person/intent public accusation; sensitive Observations (`shifts_to_person_or_intent`,
   `contains_unplayable_insult_only`, `needs_pre_send_pause`) stay **composer-only** (doctrine §10a). Family J
   (`sensitive_composer`) stays `productionEnabled: false` —
   `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-117`, the sole `false` in the registry; the
   client-side mirror is `HUB_NON_PRODUCTION_FAMILIES = ['sensitive_composer']`
   (`src/features/arguments/detail/argumentDetailModel.ts:670-671`).
4. No direct insert into `public.arguments`, no service-role in client, no secret leakage, no app-side provider calls
   (`docs/core/ux-ui-project-board.md:750-759` hard-constraints block; doctrine §6/§7).
5. Score is gameplay, never truth; heat is activity/friction; popularity is not evidence
   (`docs/core/ux-ui-project-board.md:51-57`).
6. Plain language: no raw `snake_case` internal codes in user-facing strings; map through
   `gameCopy.toPlainLanguage` (`src/features/arguments/gameCopy.ts:855`); unknown codes are suppressed, not echoed
   (doctrine §9, §10a).
7. Engine + role gates **filter**; the stage gate only **orders/promotes** and never removes a valid move
   (`docs/designs/QOL-030.md:85-98`).

## 3. What loosens at the user-facing layer (the slate's design thesis)

Nothing in §2 loosens. What loosens is **exposure**, not validation:

- Users should not consciously select CLM/RBT/CRB/EVD/CLR/CON/SYN for ordinary drafting. They pick plain moves —
  Reply, Challenge, Ask source, Ask quote, Add evidence, Narrow, Concede, Confirm, Synthesize, Branch — i.e. the
  RULE-005 channel vocabulary (`docs/designs/RULE-005.md:55-66`, `:128-156`). The stored type is inferred or selected
  behind the scenes; the matrix becomes a hidden affordance + recovery system. (REF-ADR-001 records this disposition.)
- Composite drafting is allowed even if persistence stays single-type or multi-node underneath. QOL-030 already makes
  `respond` a composite box with Reply / Challenge / Concede as entry points, not separate types
  (`docs/designs/QOL-030.md:227-243`).
- Stage is ordering, not permission (`docs/designs/QOL-030.md:85-98`).
- Rejections convert into recovery routes: a structurally-invalid-here move offers "Branch this side issue" instead of
  a bare reject. RULE-004/RULE-005 already treat branch / narrow / source / quote suggestions as advisory
  (`docs/designs/RULE-004.md:423-440` — the advisory sheet's transformation actions; `docs/designs/RULE-005.md:70-74`
  channel-suggestion doctrine, `:333-355` surfacing, `:469-506` deterministic derivation rules and the
  no-keyword-block guarantee).
- Claim-level critique in plain English is permitted — "this source does not support that claim", "this does not
  answer the parent", "the inference is invalid", "this shifts scope" — while person/motive/team characterization
  stays barred. The cross-family ADR already recognizes that certain tokens legitimately appear descriptively or as
  quotation in non-J families (`docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md:43-55`). This is a
  copy/doctrine refinement, not a weakening of the anti-manipulation aim.

## 4. The `DisagreementContract` / `OpenIssue` object (REF-001's model target)

Reference shape — the role matters more than the exact TS:

```ts
interface DisagreementContract {
  id: string;
  roomId: string;
  targetNodeId: string;
  targetQuote: string | null;
  contestedProposition: string;
  axis: 'evidence' | 'definition' | 'scope' | 'causal' | 'logic' | 'value' | 'framing' | 'process';
  relationToParent: 'supports' | 'challenges' | 'asks_source' | 'asks_quote' | 'narrows' | 'branches' | 'concedes' | 'synthesizes';
  burden: 'source_owed' | 'quote_owed' | 'reply_owed' | 'clarification_owed' | 'none';
  state: 'open' | 'answered' | 'source_requested' | 'quote_requested' | 'narrowed' | 'conceded' | 'synthesis_ready' | 'moved_on';
  refereeObservations: RefereeObservation[];
  userAllegations: UserAllegation[];
  nextBestMoves: MoveSuggestion[];
}
```

It must answer: what exact point is under dispute · which axis · what evidence/quote/clarification is owed · what the
MCP referee observed · what move keeps the conversation focused · whether the issue was answered, narrowed, conceded,
branched, or ignored. Every participant pays the same procedural cost (target → quote when needed → axis in plain
language → provide evidence / request evidence / narrow / concede / branch), which is what keeps the playing surface
level against social pressure.

**Derivation inputs already shipped:** Constitution types + transitions (`src/domain/constitution/`), RULE-005
`MoveChannel`s, LIFE-001 lifecycle (`src/features/lifecycle/pointLifecycleModel.ts`), META-001 ledger
(`src/features/metadata/`), persisted MCP boolean Observations for the production families (A–I; J never — §2.3), and
UX-001.5A user Allegations (`src/features/nodeAnnotations/`). REF-001 decides derived-only vs persisted; the slate's
recommendation is **derived-only first** (persistence is a named future card, not part of this slate).

## 4A. Convergence seams — required source inventory (live-verified at `c46c8e0`)

The Disagreement Contract / Open Issue is a **convergence seam, not a new taxonomy**. The product problem is
fragmentation; it is not solved by adding another independent surface. The Referee Card does not replace the existing
semantic-referee banner, node-label registry, referee ledger, evidence-debt model, lifecycle model, Act/Inspect/Go
popouts, or suggested-move model — it **composes** them into one turn-level reading:

> `selected target → contested point → issue axis → burden/debt → referee observation → next valid Act move`

Every REF design doc must state which existing source owns each concept, which adapter reads it, and what the new
user-facing object does with it. The required inventory (every path verified to exist at HEAD; the two path
corrections vs the drafting addendum are noted):

- `src/features/arguments/oneBox/actPopoutModel.ts` — `ActEntryId`, `BuildActPopoutInput`, `buildActPopout`,
  `actEntryToQuickAction`, engine/role/stage gates, the stage-promoted entry table.
- `src/features/arguments/oneBox/boxModel.ts`, `OneBox.tsx`, `Popout.tsx`, `PopoutEntry.tsx`, `PopoutGroup.tsx` — the
  one-box/chassis boundary. REF cards consume this; they must not design a second compose system.
- `src/features/arguments/oneBox/inspectContentBuilder.ts`, `inspectPopoutModel.ts`, `InspectPopout.tsx` — Inspect is
  the full-detail explanation surface. Raw keys belong here, not on the compact Referee Card.
- `src/features/arguments/oneBox/goPopoutModel.ts`, `GoPopout.tsx`, plus `src/features/arguments/timelineMiniMapModel.ts`
  and `src/features/arguments/timelineDensityLensModel.ts` (live paths — these two sit beside, not inside, `oneBox/`) —
  Go owns navigation, lenses, and viewport. The Open Issues rail may ask Go to jump/filter, but Go still dims rather
  than hides.
- `src/features/arguments/channelModel.ts`, `quickActionPresets.ts`, `conversationMoves.ts`,
  `timelineNodeActionDockModel.ts`, `suggestedMovesModel.ts` (`deriveSuggestedMoves` at `:336`) — move-intent
  vocabulary, preset mapping, next-move suggestions. REF-002/REF-003 reuse these mappings; no new action labels.
- `src/features/lifecycle/pointLifecycleModel.ts` (`PointLifecycleState` at `:80`), `src/features/rulesUx/lifecycleUxMap.ts`
  — lifecycle states and their plain-language labels.
- `src/features/metadata/moveMetadataLedger.ts` — 10 manual tags + 16 auto metadata observations. Manual tags are
  participant annotations; auto metadata is deterministic machine observation.
- `src/features/nodeLabels/nodeLabelTypes.ts` (`NodeLabelMark` at `:89`), `machineObservationRegistry.ts`,
  `machineObservationDefinitions/**`, `userAllegationRegistry.ts` (`USER_ALLEGATION_REGISTRY` at `:139`),
  `nodeLabelPresentationModel.ts` — Observations vs Allegations, sensitive-surface gating, display caps, raw-key
  suppression, provenance.
- `src/features/evidence/evidenceModel.ts`, `evidenceDebtModel.ts`, `sourceChainPopoverModel.ts`,
  `EvidenceDebtChip.tsx` — evidence artifacts, source/quote status, debt lifecycle. Evidence debt is an obligation
  marker, never a truth verdict (prohibition restated, not new doctrine).
- `src/features/refereeLedger/types.ts` (`CategoryReading` at `:166`), `reconcileMove.ts`, `reconciliation.ts`,
  `refereeLedgerCopy.ts` — the existing play-quality categories, feedback codes, conflict routing, copy. REF must not
  create a second scoring ledger.
- `src/features/refereeBanners/types.ts` (`BannerSelectionResult` at `:151`), `selectBanner.ts`,
  `classifierBannerMap.ts`, `refereeBannerLibrary.ts`, `bannerSelectionInputFromPacket.ts`, `RefereeBannerView.tsx` —
  the existing "one short non-verdict banner per move" machinery. The Referee Card may wrap/extend it; it must not
  duplicate banner-selection logic.
- `src/features/semanticReferee/**` and `src/lib/constitution/semanticClassifierCatalog.ts` — semantic packet shape,
  catalog, trigger gates, token budget, no-live-call source scans. REF consumes persisted outputs only; no new
  provider path.
- `src/features/concessions/activeDisagreement.ts` and `src/features/pointStanding/**` — active-disagreement
  classification, issue debt, concession/narrowing repair economy. REF may surface open issue/debt state; it must not
  convert standings into truth or winner labels (prohibition restated).
- `src/features/arguments/tangentRoutingModel.ts`, `branchTopologyModel.ts`, `branchGrammarModel.ts` — recovery-route
  and branch/tangent distinctions. REF-004's recovery copy routes through these concepts; the engine is never
  bypassed.
- `src/features/arguments/cardView/CardDetailPanel.tsx`, `cardDetailModel.ts`, `cardClassifierStripModel.ts`,
  `cardMappingSectionModel.ts` — the current detail/card hub. REF-003 decides whether the compact card mounts here
  first (it should), not in a new arbitrary surface.

Anchor test inventory (all verified to exist; REF issue bodies cite the relevant subset): `actPopoutModel` /
`actPopoutComponent` · `inspectContentBuilder` / `inspectPopoutModel` / `inspectPopoutComponent` · `goPopoutModel` ·
`suggestedMovesModel` · `messageQualifiers` · `moveMetadataLedger` / `metadataPlainLabels` /
`metadataForbiddenImports` · `NodeLabelStrip` / `NodeLabelInspectGroups` / `nodeLabelPresentationModel` /
`nodeLabelSourceAdapters` / `userAllegationRegistry` / `machineObservationRegistry` · `EvidenceDebtChip` /
`evidenceDebtModel` / `sourceChainPopoverModel` · the `refereeBanner*` suites + `RefereeBannerView` /
`semanticBannerFuzzParity` / `semanticLedgerFuzzParity` · `activeDisagreement` / `pointStandingEngine` /
`antiAmplification*` · `tangentRoutingModel` (all under `__tests__/`).

## 4B. Required derivation table (REF-001 freezes it; REF-002 implements it)

REF-001's design doc must fill every row of this table with live source functions/types, user-facing copy, and tests;
REF-002 implements it as the pure model. The rules below are the binding v1 defaults:

| Contract field | Derived from | Rule | User-facing rendering |
|---|---|---|---|
| `id` | `roomId`, `targetNodeId`, `relationToParent`, `axis`, first active debt kind | Deterministic string, e.g. `issue:<targetNodeId>:<relation>:<axis-or-debt>`; v1 derived-only, no DB row | Never shown raw |
| `roomId` | active room/debate id | Required; null means no issue object | Not shown |
| `targetNodeId` | selected / active node id | Required; the issue is always anchored to a node, evidence object, concession set, branch, or room-level target | Used for jump/focus |
| `targetQuote` | `target_excerpt`, quote anchor, selected evidence quote, or null | Prefer exact quote/excerpt; never AI-summarized; null acceptable | Short quoted chip when present |
| `contestedProposition` | parent/target body excerpt, exact selected quote, or node summary | v1 deterministic truncation/excerpt only; no AI synthesis; user-editable issue title is a later card | "Point under dispute: …" |
| `axis` | `disagreementAxis`, lifecycle state, manual tags, auto metadata, evidence debt, semantic observation family, active-disagreement kind | One primary axis by precedence: evidence/quote debt > explicit `disagreementAxis` > manual tag > lifecycle debt > semantic observation > branch/process fallback | Plain labels only: Evidence, Definition, Scope, Cause, Logic, Value, Framing, Process |
| `relationToParent` | selected `ActEntryId`, `MoveChannel`, argument type, manual tag, lifecycle transition | Map to `supports` / `challenges` / `asks_source` / `asks_quote` / `narrows` / `branches` / `concedes` / `synthesizes`; `reply` is neutral unless same-side/support evidence proves `supports` — never infer agreement from side alone | "Challenges evidence", "Asks for source", "Narrows scope", … |
| `burden` | evidence debt, lifecycle state, manual tag, referee feedback code, unanswered target | `source_owed` / `quote_owed` / `reply_owed` / `clarification_owed` / `none`; evidence/quote debts outrank generic reply owed | "Open task: source owed." |
| `state` | LIFE-001 state, evidence-debt status, branch/tangent state, concession/narrowing/confirmed/synthesis state | Map to `open` / `answered` / `source_requested` / `quote_requested` / `narrowed` / `conceded` / `synthesis_ready` / `moved_on`; no hidden v1 states | Open Issues rail labels |
| `refereeObservations` | `NodeLabelMark[]` machine observations + the selected `RefereeBanner` + `CategoryReading[]` | Public card uses at most one summarized observation; Inspect shows grouped provenance + raw codes; composer-only Family J never appears on a public target node/card | "Referee note: this move asks for a quote." |
| `userAllegations` | `USER_ALLEGATION_REGISTRY` / manual tags; later REF-005 structured concern object | User-applied, quote-targeted, procedural; never merged into Observations | "Participant concern: needs quote." only where visibility allows |
| `nextBestMoves` | `deriveSuggestedMoves()` **intersected with** `buildActPopout()` surviving entries | Advisory only; render only buttons that survive engine + role gates; an invalid-here suggestion surfaces its recovery route, never the invalid action | 2–3 buttons: Ask source, Add evidence, Narrow, Branch, Concede, Confirm, Synthesize |

**Axis normalization** (REF docs and issues use these groupings):

- `evidence` — evidence challenge, source-chain gap, source/quote requested, source/no-quote status, the
  evidence/source-chain observation family.
- `definition` — definition disagreement, `definition_issue`, clarify/define-term qualifiers.
- `scope` — scope challenge, `scope_issue`, narrow-scope qualifiers, narrowing/concession repair.
- `causal` — causal disagreement, `causal_mechanism`, mechanism-needed banner/feedback.
- `logic` — logic challenge, argument-scheme and critical-question observations; descriptive claim-level critique
  stays allowed.
- `value` — value disagreement and value-frame disputes.
- `framing` — active-disagreement framing/context/fact only as issue-focus language; person/intent shifts remain
  sensitive composer-only unless an Inspect/moderator scope explicitly allows.
- `process` — pacing, mode mismatch, branch hygiene, tangent/side issue, moved-on/ignored/exhausted.

**Frozen compact copy set** (REF-001 freezes; ban-list-scanned; raw internal codes suppressed):

- Relation labels: `Challenges evidence` · `Asks for source` · `Asks for quote` · `Narrows scope` ·
  `Branches a side issue` · `Concedes a point` · `Ready to synthesize` · `Replies to the point`.
- Burden labels: `Source owed` · `Quote owed` · `Reply owed` · `Clarification owed` · `No open task`.
- State labels: `Open` · `Source requested` · `Quote requested` · `Answered` · `Narrowed` · `Conceded` ·
  `Ready to synthesize` · `Moved on`.
- Referee Card template: `Referee note: {relation}. The open task is {burden}. Best next moves: {move1} · {move2} · {move3}.`

Direct claim-level critique copy is allowed (e.g. "source does not connect to the selected claim"); person-directed
characterization is not (e.g. copy about the author rather than the claim) — the §2 prohibitions govern.

## 5. The Referee Card (REF-001's surface target, REF-003's build target)

One compact card attached to the active issue — never a stack of raw families or flags. Three zones:

1. **What this move is doing** — one plain-language relation ("Challenges evidence", "Asks for a quote",
   "Narrows scope", "Branches a side issue").
2. **What remains open** — one debt or unresolved axis (source owed, quote owed, definition unclear, scope
   unresolved, causal link unshown).
3. **Next moves** — two or three buttons drawn from the Act popout (Ask source · Add evidence · Reply · Narrow ·
   Branch · Concede · Confirm · Synthesize).

Frozen example surface copy:

> *"Referee note: This reply challenges the evidence for the parent claim. The open task is a source or exact quote.
> Best next moves: Ask source · Add evidence · Narrow the claim."*

Backed internally by many booleans; presents one coherent state; no truth/winner language (those tokens named here
only as prohibitions); never says the user is wrong; never accuses motive; always gives a move. Raw family IDs and
rawKeys appear only in Inspect (QOL-032).

**Open Issues rail/ledger** (REF-001 defines; REF-003/REF-004 render): plain-language states — "Source requested",
"Definition unclear", "Scope narrowed", "Evidence challenged", "Ready to synthesize" — mapped through `gameCopy`;
raw classifier IDs only in Inspect.

## 6. Accusations become procedural (REF-005's target)

Replace loose "accuse/flag" affordances with **Request review / Mark concern**, requiring:

- (a) a target quote,
- (b) a concern type — "about the person rather than the claim", "needs source", "quote missing", "side issue",
  "unclear term", "harassment concern", and
- (c) a requested remedy — "ask for source", "branch", "hide from public pending review", "moderator review".

A user may never publicly attach person-verdict labels to a participant (the §2.2 prohibition list); the procedural
allegation ("this seems to attack the person rather than the claim") stays composer-only or moderator-visible until
reviewed. This builds directly on the shipped UX-001.5A Observations/Allegations schema (doctrine §10a; descriptor
`source` field at `annotationChipDescriptor.ts:111` — note it is optional, `source?:`, an adapter bridges the
roadmap-level form). The `flags` soft-dismiss conventions are preserved (rows never deleted — doctrine §8).

## 7. Card list — 7 cards in dependency order

| Code | Title | Priority | Effort | Lane | Depends on | Release | Risk |
|---|---|---|---|---|---|---|---|
| REF-ADR-001 | Move-intent doctrine: channels as the user-facing layer (Constitution v1.1 disposition) | P2 | S | docs-only ADR (operator-ratified) | — (feeds REF-001, soft) | — | Medium |
| REF-001 | Disagreement Contract + Referee Card (design-only) | P0 | L | design (GATE A only) | — (consumes REF-ADR-001 if ratified; does not block on it) | 6.6 | Medium |
| REF-002 | Open Issue model, pure TS | P0 | M | src (pure model + tests) | REF-001 GATE A | 6.6 | Low |
| REF-003 | Referee Card surface in active node detail | P1 | M | src UI | REF-002; coordinates with open #504 | 6.6 | Medium |
| REF-004 | Act / Inspect / Go integration (one loop) | P1 | L | src UI | REF-003 (+ shipped QOL-030/031/032/033 chassis) | 6.7 | Medium |
| REF-005 | Request review / Mark concern (structured allegations) | P1 | M | src (persistence split to a named follow-up) | REF-001 (+ shipped UX-001.5A) | 6.7 | High |
| REF-006 | Human usability smoke (5-task first-user pass) | P1 | S | docs/testing (human-run; zero provider spend) | REF-003 (ideally REF-004) | 6.7 | Low |

**Priority-inversion note:** REF-ADR-001 (P2) is a **soft** input to REF-001 (P0). REF-001's GATE-A design may
proceed and record the recommended disposition; the ADR ratifies it in parallel. No P0 card hard-depends on a P2 card.

## 7A. Automerge posture (green-gate automation preference)

Operator preference: **green-pass automerge wherever the governance contract permits it** — never weakening GATE-C,
deploy, secret, migration, provider, or production-surface gates. "Eligible" means *the agent may merge only when the
relevant flag/policy is armed and all green gates pass*; it never means skip review, skip test evidence, skip the
secret scan, or that Tier-3 work is authorized. Postures per card (each issue body carries the same block):

| Card | Posture | Why | Green gates | Operator gate |
|---|---|---|---|---|
| REF-001 | Eligible (docs-only design PR) | docs-only | path-verified docs-only diff · secret scan · doc ban-scan | GATE-A ratification of the design itself (separate from the merge) |
| REF-002 | Prefer eligible after reviewer PASS | pure model — no React/Supabase/network/provider/migration | typecheck · lint · targeted tests · full Jest nondecreasing · forbidden-imports test · ban-list tests | none beyond reviewer PASS, if governance permits source automerge |
| REF-003 | Prefer eligible only if reviewer classifies low-risk UI-only | UI-only, no write path | typecheck · lint · targeted UI tests · full Jest · a11y checks · ban-list + raw-code scan | reviewer risk classification; any sensitive-observation visibility ambiguity → not eligible until resolved |
| REF-004 | Case-by-case | UI integration touching gate-adjacent routing copy | same as REF-003 + recovery-route no-bypass tests | prefer eligible only if no engine/role-gate change and no write path |
| REF-005 | Not eligible while persistence/visibility surfaces are in play | moderation visibility + possible `supabase/**` fork | full gates + visibility-gating tests | GATE-C if any `supabase/**` lands in-card; reconsider only if v1 proves pure copy/model |
| REF-006 | Eligible (docs-only) | docs/testing protocol | path-verified docs-only diff · secret scan | none |
| REF-ADR-001 | **Not eligible — operator-ratified merge** | docs-only **but defines operative semantics** — governance §5 operator-gates such docs PRs (the consolidation-card precedent). This is the one place the drafting addendum's default ("docs-only → eligible") yields to the contract; contract wins | secret scan · ban-scan | operator GATE-C read + ratification |

## 8. Dependency DAG and sequencing rationale

```
REF-ADR-001 (docs ADR) ··soft··► REF-001 (design)
REF-001 ──► REF-002 (pure model) ──► REF-003 (card surface) ──► REF-004 (loop integration)
REF-001 ──► REF-005 (structured allegations)     [substrate: UX-001.5A, shipped]
REF-003 ──► REF-006 (human usability smoke)      [ideally after REF-004]
REF-003 ··coordinates with··► #504 CARD-VIEW-DATA-001 (OPEN; classifier-strip + card-detail chassis)
```

Acyclic. No card depends on Family-J advancement (J stays composer-only/frozen), on routing changes, or on any
superseded work.

The sequencing encodes this priority order:

1. **One-box drafting surface as primary, type inferred** — the QOL-030 base, already built.
2. **Timeline primary / Cards inspection** — already the board thesis; cited, not re-decided.
3. **Open Issues rail/ledger in plain language** — no raw classifier IDs (doctrine §9/§10a).
4. **Referee feedback asynchronous + advisory** — never blocking outside hard structural/safety gates
   (`docs/core/product-spec.md:92-106`; matches the fail-closed server design).
5. **Claim-level critique vs person-level accusation split** in copy + tests (REF-005; cross-family ADR `:43-55`).
6. **Collapse the boolean explosion into one state per issue** (relation · axis · debt · next move); raw families
   only in Inspect (REF-002/REF-003).
7. **Bot/synthetic corpus runs are instrument validation, not UX validation.** The 2026-06-12 dry runs prove skill
   gates, determinism, and zero spend (`docs/testing-runs/2026-06-12-xai-adversarial-bot-corpus-dry.md:7-14` skill-gate
   hashes, `:25-26` zero xAI/Anthropic calls; `docs/testing-runs/2026-06-12-ai-driven-bot-corpus-dry.md:9` no secrets /
   no Anthropic / no service-role — both are operator worktree reports, untracked at `c46c8e0`, committed by the
   corpus-run lane; the gitignored JSONL event logs under `logs/engagement-intelligence/` are the raw
   instrument records) — not that a first-time human understands the surface. The next usability evidence is
   REF-006's human path audit.

## 9. Relationship to shipped surfaces and open issues

- **QOL-030/031/032/033 (#199–#202, CLOSED; build complete)** — the implementation chassis of the Disagreement
  Contract. REF-001 designs the loop these four render: Act = changes the issue / Inspect = explains it /
  Go = navigates it / the box drafts the next move. REF-004 is the card that closes the loop.
- **#504 CARD-VIEW-DATA-001 (OPEN)** — the data-rich active card (classifier strip, standings strip, evidence strip,
  pop-actions, "sidecar + referee banner move into card detail"). REF-002's derived issue state is a **new input** to
  that surface; REF-003's Referee Card is the **synthesized one-state layer** that sits above #504's raw classifier
  strip. REF-003 must not duplicate #504's zones — it renders into the same card-detail chassis
  (`src/features/arguments/cardView/CardDetailPanel.tsx`) and is sequenced to coordinate with #504's slices.
  An amendment comment on #504 records this (see the sprint index).
- **RULE-004 (#114) / RULE-005 (#115) / RULE-006 (#116), CLOSED** — the channel vocabulary is canonized as the
  user-facing move-intent layer by REF-ADR-001; the matrix becomes hidden affordance + recovery. The recovery-route
  conversion lands via REF-004, citing RULE-004's advisory-sheet precedent.
- **UX-001.5A (#298, CLOSED)** — the Allegation schema is REF-005's substrate; procedural Request review replaces
  loose flag copy.
- **COPY-001 (#71, CLOSED)** — the claim-level-critique vs person-level-accusation copy split (priority 5) is carried
  by REF-005 (no open copy card exists to absorb it). META-1D (#79, OPEN, P2) is the standing vocabulary-review card
  for the 26 META-001 codes; REF-006's "their words vs our labels" table will be offered as input to it, and extending
  its scope to the REF rail-state vocabulary should be proposed via a comment on #79 when it runs.
- **SC-003 (#11) / ST-002 (#13) / GAL-002 (#31), CLOSED** — their "suggested next move" surfaces become consumers of
  REF-002 state; no duplicate model is built.
- **MCP-CAT-001 (#238) / MCP-MOD-001…008 (#230–#237), CLOSED** — the Referee Card consumes the classifier catalog
  (the canonical registry that track consolidated); no scope change to that track.
- **OPS-MCP-BAN-SCAN-NORMALIZATION** — already shipped at HEAD (`c46c8e0`, PR #583;
  `docs/designs/OPS-MCP-BAN-SCAN-NORMALIZATION.md` Status: Implemented). The drafting brief carried it as a card to
  file; it is **not** part of this slate. Recorded in the sprint index's divergence ledger.

## 10. Risks and open questions

### Risks

- **REF-002 silently becomes a second engine.** The Open Issue model must *derive* from what the engine and channels
  already decided — never re-validate or contradict them. Mitigation: derivation-table tests per input source; the
  acceptance-gate invariant restated in the card; the model is consultative, not gating.
- **REF-003 duplicates #504.** Two cards rendering classifier-derived state into the same card detail panel can race.
  Mitigation: REF-003's design names #504's five zones and claims only the synthesized Referee Card zone; the #504
  amendment comment makes the boundary visible to both pipelines.
- **Referee Card copy drifts toward the banned verdict-token vocabulary.** One synthesized sentence is more tempting to editorialize than
  twenty booleans. Mitigation: the frozen §5 copy pattern; ban-list tests over every emitted label (the same scan
  discipline the MCP stack uses); copy review at GATE A.
- **REF-005 touches moderation power dynamics.** A "Request review" that hides content pending review is a remedy
  with teeth; mis-design reads as machine-backed accusation. Mitigation: Risk=High, `doctrine-risk` label, remedy
  routing tests, allegation visibility gating tests, and the §10a composer-only rule for person-directed concerns.
- **REF-006 produces anecdotes, not evidence.** A 5-task pass with n=1 is directional only. Mitigation: the protocol
  template captures stuck-points verbatim and is explicitly framed as the first human baseline, not a quantitative
  gate.

### Open questions

- **Derived-only vs persisted Open Issues** — REF-001 decides; recommendation is derived-only first. If persistence
  is later wanted (cross-session issue history), that is a new card with migration + RLS review.
- **Where does the Referee Card live on small screens** — inside the card detail (REF-003's default) vs pinned above
  the composer. REF-001 resolves with mockups.
- **Does REF-ADR-001 produce a Constitution v1.1 section or a beside-the-constitution doctrine doc?** Constitution
  versions are immutable once inserted (doctrine §8); the ADR governs docs/UI doctrine, not a stored-version mutation.
  Operator ratifies.

## 11. What this slate does NOT do (out of scope, named so they don't accrete)

- **No new MCP family, no rawKey addition, no ban-list edit, no familyRegistry change.** Family J stays
  `productionEnabled: false`; sensitive Observations stay composer-only.
- **No change to the stored type system or the transition matrix.** CLM/RBT/CRB/EVD/CLR/CON/SYN and the matrix stay
  the validation layer (`docs/core/constitution-v1.md:18,:34-46`).
- **No persistence for the Open Issue object in this slate** (derived-only; persistence is a named future card).
- **No queue/routing arm, no percentage change, no Edge deploy, no migration** inside the slate's REF-001…REF-004,
  REF-006 cards. REF-005's persistence (if any) is split into its own follow-up card and flagged GATE-C there.
- **No voting, no winner-producing scoring, no OAuth, no push notifications, no public API, no argument search**
  (v1 scope guards).
- **No AI calls from the production app** — the Referee Card consumes already-persisted Observations; it never
  triggers classification from the client.

## 12. Operator launch checklist

1. `OPS-MCP-BAN-SCAN-NORMALIZATION` needs no launch — it shipped at HEAD (`c46c8e0`, PR #583). Its pending operator
   follow-up (post-merge Deno Deploy build readback + `/health`) is tracked in `docs/core/current-status.md`, not here.
2. Optionally ratify REF-ADR-001 first (it is a small docs-only ADR and sharpens REF-001's GATE A), or let REF-001's
   designer carry the recommended disposition and ratify both at REF-001's GATE A.
3. Launch REF-001 via the standard pipeline: `spawn-card.ps1 REF-001` (designer, GATE A). Design-only; stops at the
   design doc.
4. After REF-001 GATE A passes, launch REF-002 (pure model). Full Jest suite is the regression gate.
5. After REF-002 lands, launch REF-003 — first reconciling slice order with #504's pipeline state at that time.
6. After REF-003 lands, launch REF-004; then REF-006's human pass (no provider spend; human-run protocol).
7. REF-005 may start any time after REF-001 GATE A; its design must split persistence into a named follow-up card.
8. One card at a time, strictly down the DAG; smoke/regression conventions per the standard pipeline.

The operator decides each launch — no automation in this document.
