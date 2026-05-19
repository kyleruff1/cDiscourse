# GAME-001 — Point exhaustion and timeout rules

**Status:** Design draft
**Epic:** Epic 12 — Rules UX (Wave 3 game constraints)
**Release:** 6.6
**Wave:** 3 (Game constraints)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/64
**Branch:** `feat/GAME-001-point-exhaustion-and-timeout-rules`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\GAME-001.md`
**Depends on (all shipped):** LIFE-001 (`src/features/lifecycle/`), META-001 (`src/features/metadata/`), RULE-003 (`src/features/rulesUx/lifecycleUxMap.ts`), BR-001 (`branchTopologyModel`), EV-001 (`evidenceModel`), ST-002 / SC-003 / SC-004 / EV-004 / SW-002 (consumers in Wave 1/2).

---

## Goal

GAME-001 introduces the **explicit advisory deriver** for the four exhaustion / timeout lifecycle states (`exhausted`, `moved_on_by_<side>`, `ignored_by_<side>`, `ignored_by_both`) plus `synthesis_ready` so the threshold logic that lives inside LIFE-001's `composeClusterState` is callable as a **standalone, single-purpose, fixture-friendly function**.

Why a standalone deriver if LIFE-001 already fires these states? Three product reasons:

1. **Audit and tuning surface.** AN-003 needs to be able to ask "did this cluster qualify for `exhausted` under threshold N=3, N=4, N=5?" without rebuilding the whole timeline map. A pure `deriveExhaustionTimeoutAdvisory(input)` lets the analytics layer sweep thresholds at a fraction of the cost and without re-running the full LIFE-001 classifier (which produces a 1.5 KLOC pass over every node + EV-001 status pass + multi-axis bookkeeping).
2. **Cluster-doctrine input wiring.** The card explicitly lists six cluster-level signals as inputs (same-axis pressure count, turns-since-side-engaged per side, concession-or-narrowing presence, evidence-debt presence, branch suggestion count, cluster age vs room age). LIFE-001 reads most of them internally but does NOT take them as an external input object — meaning ST-002 / SC-003 cannot ask "is this cluster exhausted under override thresholds?" without simulating an entire timeline map. GAME-001 fixes that.
3. **Synthesis-ready broadening.** LIFE-001 currently only fires `synthesis_ready` when an explicit synthesis-shape move (qualifier `synthesize_agreement` / `synthesize_open_question` or `kindLabel === 'synthesis'`) exists. The card's acceptance criterion is broader: **"concession or narrowing + no unresolved evidence debt → `synthesis_ready`"**. META-001's `synthesis_candidate` auto-code already captures the broader semantics ("narrowed AND conceded with no rebut after") on the metadata side; GAME-001 surfaces that same broader semantics as an *advisory lifecycle state*, distinct from LIFE-001's stricter `synthesis_ready` (which still requires an explicit synthesis move).

The deriver is **additive and non-overriding**. LIFE-001's `composeClusterState` continues to be the canonical state oracle for `PointLifecycleClusterSummary.state`. GAME-001 exposes a *parallel reader* that callers (AN-003, SC-003 sidecar, ST-002 chip stack) opt into when they want the advisory-only view with explicit override thresholds. The two derivers are reconciled by a documented priority order; when both fire, they fire on the same cluster with the same state (modulo the synthesis broadening, which is GAME-001-only).

The doctrine anchor is six sentences:

1. **An advisory is never a verdict, never a punishment, never a block.** It can drop into a sidecar chip, a helper line, a debug surface. It cannot block submit, cannot auto-archive, cannot auto-tag a user, cannot dock a point standing.
2. **`ignored_by_<side>` describes the cluster's state, never a user's behaviour.** Every produced helper line is scanned to assert it says "this cluster" / "the side" / "Affirmative did not respond" — never "the user ignored" / "they're ignoring you".
3. **Engagement and popularity never feed an advisory.** No like count, no view count, no follower count, no recent activity weight. Only move shape (LIFE-001 / META-001 fields) and turn count.
4. **The synthesis-ready advisory does NOT auto-apply a point-standing bonus.** It is a UX nudge that a synthesis move WOULD be available. The point-standing economy still requires an explicit synthesis-shape move.
5. **Threshold constants are v1 conservatives. AN-003 measures false-positive rate before tuning.** Defaults inherit from LIFE-001's `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` so the two derivers agree out of the box.
6. **No AI inference. No network. No `Math.random`. No `Date.now`** inside the deriver body. All time-shaped inputs are passed in by the caller.

GAME-001 ships **no migration, no Edge Function, no schema change, no Supabase write, no `.env*` change, no new dependency, no UI**.

---

## Why this card (and not a follow-up patch on LIFE-001)?

LIFE-001's `composeClusterState` is already 200 lines of priority-cascading rules over an 18-state vocabulary. Wedging "explicit override thresholds + a broader synthesis_ready + a public cluster-level input shape" into that function would (a) bloat a file that is already past 1.2 KLOC, (b) leak GAME-001's advisory contract into LIFE-001's canonical state contract, and (c) make AN-003's "sweep thresholds at low cost" use case prohibitively expensive. The separate-module choice keeps LIFE-001 the one canonical source of `clusterSummary.state` and gives GAME-001 a clean affordance for everything Wave 3 + Wave 4 (AN-003) needs.

---

## Data model

All types live in `src/features/lifecycle/exhaustionTimeoutModel.ts` (NEW). Pure TS. No external dependency. Re-exported via the existing `src/features/lifecycle/index.ts` barrel.

### Type — `ExhaustionTimeoutInput`

Cluster-level inputs. Caller (room shell / AN-003 / sidecar adapter) populates from existing LIFE-001 + META-001 fields.

```ts
export interface ExhaustionTimeoutInput {
  /** Cluster id (equals `branchRootMessageId` in surface model). */
  clusterId: string;

  /**
   * The cluster's pre-existing LIFE-001 state, if known. Optional. When
   * passed, GAME-001 does NOT override these dominance categories:
   *   - 'archived_or_resolved' (admin-set terminal)
   *   - 'conceded' / 'narrowed' / 'confirmed' (concession-shape final move)
   *   - 'rebutted' (explicit pressure exists, advisory should not preempt)
   * If the upstream state is one of those, GAME-001 returns `null` — the
   * upstream state already describes the cluster better than any advisory
   * could.
   */
  upstreamClusterState?: PointLifecycleState | null;

  /**
   * Max same-axis pressure count across all rebuttal axes IN this cluster,
   * counting only pressure moves that ADD NO new evidence / scope / definition
   * / mechanism. Caller computes via existing helpers:
   *   - For each `PointLifecycleAxis a` in the cluster, count members where
   *     `isRebuttalMove(m) && deriveAxis(m) === a && !hasAdditiveAxisInformation(m, status)`.
   *   - Take the max across axes.
   * Helper: GAME-001 ships `countMaxSameAxisNonAdditivePressure(members, statusByMid)`.
   */
  maxSameAxisNonAdditivePressureCount: number;

  /**
   * Turns since each side last posted to this cluster, computed via
   * `turnsSinceSideEngagedCluster(side, members, sideTurnSequence)` from
   * `pointLifecycleAdvisoryInputs.ts`. Both numbers are >= 0.
   */
  turnsSinceAffirmativeEngagedCluster: number;
  turnsSinceNegativeEngagedCluster: number;

  /**
   * True when at least one cluster member is a concession-shape move
   * (`isBroadConcession(m) || isNarrowConcession(m)`) OR an explicit
   * narrowed/conceded contribution exists in the cluster's per-message
   * snapshots.
   */
  hasConcessionOrNarrowing: boolean;

  /**
   * True when the cluster has any unresolved evidence debt:
   *   - `clusterHasOpenSourceOrQuoteRequest === true`, OR
   *   - At least one member's EV-001 worst-status is `no_source` / `broken`
   *     AND that member is a claim/support/rebuttal (not a clarification).
   * The deriver treats this as a single boolean — the granular evidence
   * debt ledger lives in `src/features/pointStanding/` and is NOT imported.
   */
  hasUnresolvedEvidenceDebt: boolean;

  /**
   * True when there is an open source/quote request directed AT the
   * affirmative side (last requestee = affirmative). Caller derives via
   * the same algorithm LIFE-001 uses (`isIgnoredBySide` flow). When neither
   * side has an open request directed at them, both flags are false.
   */
  affirmativeHasOpenRequestDirectedAtIt: boolean;
  negativeHasOpenRequestDirectedAtIt: boolean;

  /**
   * Count of off-axis pressure moves under the cluster (qualifier codes
   * `branch_this_off` / `tangent_or_joke`). Currently included for parity
   * with the card's "branch suggestion count" input. Used ONLY for
   * tie-breaking when both `exhausted` and `branch_recommended` would
   * qualify — GAME-001 does NOT itself produce `branch_recommended`;
   * LIFE-001's composeClusterState owns that state.
   */
  offAxisPressureCount: number;

  /**
   * The room's chronological move count at the moment of evaluation. Used
   * to derive `clusterAgeInRoomTurns` (turns since the cluster's root was
   * posted). Caller passes the integer; no Date.now in the deriver.
   */
  roomMoveCountAtEvaluation: number;

  /**
   * The cluster root's `ordinal` (room-wide turn index when the root was
   * posted). Together with `roomMoveCountAtEvaluation`, defines cluster
   * age. >= 1.
   */
  clusterRootOrdinal: number;

  /**
   * Optional override thresholds. When omitted, the deriver uses
   * `DEFAULT_EXHAUSTION_TIMEOUT_CONFIG` (mirrors LIFE-001's
   * `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` for `exhaustionRepeatThreshold`,
   * `movedOnTurnThreshold`, `ignoredBySideTurnThreshold`,
   * `ignoredByBothTurnThreshold`).
   */
  config?: ExhaustionTimeoutConfig;
}
```

### Type — `ExhaustionTimeoutConfig`

```ts
export interface ExhaustionTimeoutConfig {
  /** N — same-axis non-additive pressure to fire `exhausted`. Default: 3. */
  exhaustionRepeatThreshold: number;
  /** M — turns of own-without-cluster to fire `moved_on_by_<side>`. Default: 4. */
  movedOnTurnThreshold: number;
  /** K — turns since open request to fire `ignored_by_<side>`. Default: 3. */
  ignoredBySideTurnThreshold: number;
  /** J — turns of both-side dormancy to fire `ignored_by_both`. Default: 6. */
  ignoredByBothTurnThreshold: number;
  /** Minimum cluster age in room turns before any timeout advisory fires.
   *  Suppresses false-positives in nascent rooms. Default: 2. */
  minClusterAgeForTimeoutAdvisory: number;
}

export const DEFAULT_EXHAUSTION_TIMEOUT_CONFIG: Readonly<ExhaustionTimeoutConfig>;
```

Defaults mirror LIFE-001 (`DEFAULT_LIFECYCLE_ADVISORY_CONFIG`) for the four shared thresholds, plus a new `minClusterAgeForTimeoutAdvisory` (v1: 2) that LIFE-001 currently lacks. The new floor blocks the "cluster posted on turn 4, by turn 5 no reply from Neg → moved_on_by_negative" false-positive that the card's "rarely fires under short rooms" criterion specifically calls out.

### Type — `ExhaustionTimeoutAdvisoryState`

A *narrow* subset of `PointLifecycleState` — the exact five states GAME-001 can produce.

```ts
export type ExhaustionTimeoutAdvisoryState =
  | 'synthesis_ready'
  | 'exhausted'
  | 'ignored_by_both'
  | 'ignored_by_affirmative'
  | 'ignored_by_negative'
  | 'moved_on_by_affirmative'
  | 'moved_on_by_negative';

export const ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES:
  ReadonlyArray<ExhaustionTimeoutAdvisoryState>;
```

(`branch_recommended` is intentionally NOT here — it remains LIFE-001's responsibility.)

### Type — `ExhaustionTimeoutAdvisory`

```ts
export interface ExhaustionTimeoutAdvisory {
  /** The cluster being advised on. */
  clusterId: string;
  /** The advisory state, or `null` when no advisory fires. */
  state: ExhaustionTimeoutAdvisoryState | null;
  /** Plain-language label, READ from RULE-003's `LIFECYCLE_UX_MAP` for
   *  the given state. Empty string when `state === null`. */
  label: string;
  /** Plain-language helper line, READ from RULE-003's `LIFECYCLE_UX_MAP`.
   *  Empty when `state === null`. Always describes the cluster, never the
   *  user (asserted by ban-list / person-attribution tests). */
  helperLine: string;
  /** The threshold rule that fired (debug only — NEVER rendered in UI).
   *  Examples: 'exhaustion.repeatThreshold', 'movedOn.turnThreshold',
   *  'ignoredBoth.turnThreshold', 'ignoredBySide.turnThreshold',
   *  'synthesis.concessionAndNoDebt'. `null` when no advisory fires. */
  ruleFired: string | null;
  /** Whether the produced state is BLOCKING. Always `false`. Asserted by
   *  test across every fixture — this is a doctrine-level pin. */
  blocksSubmit: false;
  /** Whether the produced state implies a point-standing penalty. Always
   *  `false`. Asserted by test. */
  appliesPointStandingPenalty: false;
}
```

The two literal-`false` fields are intentional — they're compile-time pins that the type contract NEVER promises a blocking or penalising advisory.

### Function signature

```ts
export function deriveExhaustionTimeoutAdvisory(
  input: ExhaustionTimeoutInput,
): ExhaustionTimeoutAdvisory;
```

Pure. Deterministic. Total (no exceptions). Never returns `undefined`. Never mutates `input`.

### Priority order (when multiple rules qualify)

The card lists the priority order; we implement it as a single cascading `switch`-equivalent:

```
1. synthesis_ready
   IF hasConcessionOrNarrowing
   AND !hasUnresolvedEvidenceDebt
   AND upstreamClusterState NOT IN { 'rebutted', 'archived_or_resolved' }
   AND clusterAgeInRoomTurns >= minClusterAgeForTimeoutAdvisory
   → 'synthesis_ready'

2. exhausted
   IF maxSameAxisNonAdditivePressureCount >= exhaustionRepeatThreshold
   AND clusterAgeInRoomTurns >= minClusterAgeForTimeoutAdvisory
   → 'exhausted'

3. ignored_by_both
   IF turnsSinceAffirmativeEngagedCluster >= ignoredByBothTurnThreshold
   AND turnsSinceNegativeEngagedCluster >= ignoredByBothTurnThreshold
   AND clusterAgeInRoomTurns >= minClusterAgeForTimeoutAdvisory
   → 'ignored_by_both'

4. ignored_by_<side>
   IF the side has an open source/quote request directed AT it
   AND turnsSince<side>EngagedCluster >= ignoredBySideTurnThreshold
   AND clusterAgeInRoomTurns >= minClusterAgeForTimeoutAdvisory
   → 'ignored_by_affirmative' or 'ignored_by_negative'
   (When BOTH sides qualify, returns the side with more turns since
   engagement; ties resolved by 'negative' alphabetically — stable.)

5. moved_on_by_<side>
   IF turnsSince<side>EngagedCluster >= movedOnTurnThreshold
   AND NOT <side>HasOpenRequestDirectedAtIt
   AND the side has posted at least one move in the cluster historically
       (the deriver tracks this via a per-side has-ever-engaged signal
       passed in — see "Caller must populate" below).
   AND clusterAgeInRoomTurns >= minClusterAgeForTimeoutAdvisory
   → 'moved_on_by_affirmative' or 'moved_on_by_negative'

6. otherwise → null
```

**Justification — synthesis_ready first.** A cluster that has reached a concession + no debt is the *highest-value* board signal (it's the path to a complete exchange). Putting it first means an `exhausted`-shaped pattern that ALSO has a concession+no-debt resolves as the more constructive state. (LIFE-001's existing classifier already puts `synthesis_ready` above `exhausted` in `composeClusterState` — same precedence, different deriver.)

**Justification — exhausted before ignored.** Repeated same-axis pressure is a STRONGER signal than dormancy: it means both sides ARE engaging, just unproductively. The exhausted advisory routes the suggested next move to "branch / sidestep / accept the small point", which is more useful than "the other side hasn't replied".

**Justification — ignored_by_both before ignored_by_<side>.** Two-side dormancy is a strictly stronger condition than one-side dormancy under an open request. The composite signal subsumes the per-side signal.

**Justification — ignored_by_<side> before moved_on_by_<side>.** The "ignored" advisory implies *an open request the side has not answered*; "moved on" implies *no open request*. The two are mutually exclusive in well-formed input — `ignored_by_<side>` requires `<side>HasOpenRequestDirectedAtIt = true`; `moved_on_by_<side>` requires the opposite. The priority order is documented anyway to handle malformed input (caller passes both flags true): `ignored_by_<side>` wins, because the open request is the salient cluster signal.

**Justification — minimum cluster age floor.** The card explicitly calls out "rarely fires under short rooms". A cluster with `clusterRootOrdinal = 8` and `roomMoveCountAtEvaluation = 9` has `clusterAgeInRoomTurns = 1`, which is too young for any timeout advisory to be honest. The floor (default 2) suppresses every timeout state under that threshold while leaving `synthesis_ready` available the moment a concession lands (synthesis_ready DOES respect the floor as well — a cluster that's been alive for 0 turns can't have had a concession in any meaningful sense, but the rule is still safer with the floor on; doctrine: better one false negative than one false positive).

### `null` return shape

```ts
{
  clusterId,
  state: null,
  label: '',
  helperLine: '',
  ruleFired: null,
  blocksSubmit: false,
  appliesPointStandingPenalty: false,
}
```

The `null` state is *normal* — most clusters in most rooms produce it. UI consumers (SC-003, ST-002) check `state !== null` before rendering a chip.

### Caller-populated input adapter (NOT in this module)

GAME-001 ships **only the pure deriver**, not the input adapter that walks a `PointLifecycleMap` to populate the inputs. Reason: the adapter belongs to whichever consumer surface is calling — ST-002's chip stack, SC-003's sidecar, AN-003's diagnostic sweep all want different fan-outs. The deriver's signature is small enough that each consumer can build the `ExhaustionTimeoutInput` from the LIFE-001 outputs in 20-30 lines. Cards consuming GAME-001 (`SC-003` follow-up, `AN-003`, eventually `IX-002` mini-map) own their own adapter.

This card adds **one optional convenience adapter** in the same module:

```ts
export interface BuildExhaustionTimeoutInputFromLifecycleInput {
  clusterSummary: PointLifecycleClusterSummary;
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>;
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>;
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>;
  roomMoveCountAtEvaluation: number;
  config?: ExhaustionTimeoutConfig;
}

export function buildExhaustionTimeoutInputFromLifecycle(
  input: BuildExhaustionTimeoutInputFromLifecycleInput,
): ExhaustionTimeoutInput;
```

The adapter does the bookkeeping of pulling the six cluster-level signals from the existing LIFE-001 outputs, so the simplest caller (the one with a `PointLifecycleMap` already in hand) can do:

```ts
const advisory = deriveExhaustionTimeoutAdvisory(
  buildExhaustionTimeoutInputFromLifecycle({ /* lifecycle map subset */ }),
);
```

The adapter is in the same module so it shares the threshold defaults; it is NOT auto-wired into LIFE-001's pipeline.

---

## File changes

| Change | Path | Lines (est.) | Purpose |
|---|---|---|---|
| **new** | `src/features/lifecycle/exhaustionTimeoutModel.ts` | ~350 | All types + `DEFAULT_EXHAUSTION_TIMEOUT_CONFIG` + `ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES` + `deriveExhaustionTimeoutAdvisory` + `buildExhaustionTimeoutInputFromLifecycle` + `_forbiddenExhaustionTimeoutTokens()`. |
| **modified** | `src/features/lifecycle/index.ts` | +15 / -0 | Barrel re-exports: types (`ExhaustionTimeoutInput`, `ExhaustionTimeoutConfig`, `ExhaustionTimeoutAdvisoryState`, `ExhaustionTimeoutAdvisory`, `BuildExhaustionTimeoutInputFromLifecycleInput`), constants (`DEFAULT_EXHAUSTION_TIMEOUT_CONFIG`, `ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES`), functions (`deriveExhaustionTimeoutAdvisory`, `buildExhaustionTimeoutInputFromLifecycle`), and `_forbiddenExhaustionTimeoutTokens`. |
| **new** | `__tests__/exhaustionTimeoutModel.test.ts` | ~620 | 5 fixtures × full rule coverage + threshold boundaries + ban-list + person-attribution scan + priority-order + non-blocking pins + adapter round-trip. Target +40 net tests. |
| **modified** | `docs/current-status.md` | +25 lines (one new section), one line in front matter | New section "GAME-001 — Point exhaustion + timeout rules (Release 6.6 / Wave 3)" documenting status, files, tests, doctrine, operator follow-up (none). Front-matter date + roster line updated. |
| **unchanged** | `src/features/lifecycle/pointLifecycleModel.ts` | — | NOT modified. LIFE-001's `composeClusterState` keeps owning `clusterSummary.state`. GAME-001 is additive and is not auto-wired into the canonical state. The integration choice is documented in the "Integration with LIFE-001" section below. |
| **unchanged** | `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts` | — | NOT modified. GAME-001 re-uses existing helpers (`countSameAxisPressure`, `hasAdditiveAxisInformation`, `turnsSinceSideEngagedCluster`, `countOffAxisPressure`) via re-import. |
| **unchanged** | `src/features/rulesUx/lifecycleUxMap.ts` | — | NOT modified. RULE-003 already maps every five GAME-001-producible states to a label + helper + iconHint; GAME-001 READS that map and re-exports nothing from it. |
| **unchanged** | `src/features/metadata/moveMetadataLedger.ts` | — | NOT modified. META-001's `synthesis_candidate` / `point_exhausted` / `point_stalled` auto-codes stay derived from LIFE-001 cluster state, not from GAME-001 — they remain the metadata-layer mirror, GAME-001 is the advisory-derivation surface. |
| **unchanged** | `src/lib/constitution/engine.ts` | — | The sacred rules engine is NEVER touched by lifecycle / metadata / advisory cards. Doctrine §5. |

**Net production diff:** ~365 lines added (one new module + barrel hook). Zero modifications to existing production code. Zero migrations. Zero Edge Functions. Zero deps.

**Net test diff:** ~620 lines added (one new spec file). +40 net `it` / `test` cases.

---

## API / interface contracts

### Public from `src/features/lifecycle/exhaustionTimeoutModel.ts`

```ts
// Types
export type ExhaustionTimeoutAdvisoryState =
  | 'synthesis_ready'
  | 'exhausted'
  | 'ignored_by_both'
  | 'ignored_by_affirmative'
  | 'ignored_by_negative'
  | 'moved_on_by_affirmative'
  | 'moved_on_by_negative';

export interface ExhaustionTimeoutInput { /* see Data model */ }
export interface ExhaustionTimeoutConfig { /* see Data model */ }
export interface ExhaustionTimeoutAdvisory { /* see Data model */ }
export interface BuildExhaustionTimeoutInputFromLifecycleInput { /* see Data model */ }

// Constants
export const ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES:
  ReadonlyArray<ExhaustionTimeoutAdvisoryState>;
export const DEFAULT_EXHAUSTION_TIMEOUT_CONFIG: Readonly<ExhaustionTimeoutConfig>;

// Functions
export function deriveExhaustionTimeoutAdvisory(
  input: ExhaustionTimeoutInput,
): ExhaustionTimeoutAdvisory;

export function buildExhaustionTimeoutInputFromLifecycle(
  input: BuildExhaustionTimeoutInputFromLifecycleInput,
): ExhaustionTimeoutInput;

// Test-only
export function _forbiddenExhaustionTimeoutTokens(): string[];
```

### Public from `src/features/lifecycle/index.ts` (additive)

Every export above is re-exported via the barrel under the same names. No renames. No deprecation of any existing LIFE-001 export.

### Imports from existing modules (read-only)

- `pointLifecycleModel`: `PointLifecycleState`, `PointLifecycleClusterSummary`, `LifecycleAdvisoryConfig` (type only — for the doc parity assertion), `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` (read-only — for the parity assertion + default initialisation).
- `pointLifecycleAdvisoryInputs`: `countSameAxisPressure`, `hasAdditiveAxisInformation`, `turnsSinceSideEngagedCluster`, `countOffAxisPressure` (only inside the adapter; the deriver itself reads pre-computed inputs and does no node-walk).
- `pointLifecycleClusters`: `deriveAxis`, `nodeHasQualifierCode` (only inside the adapter).
- `../evidence/evidenceModel`: `SourceChainStatus`, `summarizeArtifactsForReceiptChip` (only inside the adapter).
- `../rulesUx/lifecycleUxMap`: `LIFECYCLE_UX_MAP` (or whatever frozen lookup RULE-003 exports — the deriver reads `label` + `helperLine` from there. This is a one-way read; GAME-001 does NOT shadow or override RULE-003's strings).
- `../arguments/argumentGameSurfaceModel`: `ArgumentTimelineMapNode` (type only).

Zero imports from `supabase/`, `react`, `react-native`, `expo`, `@anthropic-ai/sdk`, `fetch`, `Date`, `Math`. Asserted by a static source-scan test.

---

## Edge cases

| Case | Expected output | Why |
|---|---|---|
| Empty cluster (zero members), `roomMoveCountAtEvaluation = 0`, `clusterRootOrdinal = 0` | `{ state: null, ruleFired: null }` | Cluster age = 0 < floor. Nothing to advise on. |
| Single-turn cluster (just the root, ordinal 1, room move count 1) | `{ state: null }` | Cluster age = 0 < floor. |
| Cluster age exactly 2 (= floor), repeated-axis pressure = 3 | `{ state: 'exhausted', ruleFired: 'exhaustion.repeatThreshold' }` | Age floor is inclusive (>=). |
| Cluster age exactly 1 (< floor), repeated-axis pressure = 99 | `{ state: null }` | Age floor wins. Doctrine: no timeout advisory under floor. |
| All seven advisory states qualify simultaneously (synthetic test) | `{ state: 'synthesis_ready' }` | Priority order resolves; later rules ignored once first matches. |
| `hasConcessionOrNarrowing = true` AND `hasUnresolvedEvidenceDebt = true` | `{ state: <next-qualifying rule> }` | Synthesis-ready is suppressed by debt; falls through to exhausted/ignored/moved-on. |
| `upstreamClusterState = 'rebutted'` AND repeated-axis pressure = 5 | `{ state: null }` | Upstream `rebutted` is an active-pressure state; advisory defers (the rebut is the user-visible signal). |
| `upstreamClusterState = 'archived_or_resolved'` AND every threshold met | `{ state: null }` | Admin-archived clusters do not surface advisories. |
| `upstreamClusterState = 'conceded'` AND repeated-axis pressure = 9 | `{ state: null }` | A concession-shape final move dominates; advisory defers. |
| Both sides qualify for `ignored_by_<side>` (open requests directed at BOTH; rare malformed input) | `{ state: 'ignored_by_both' }` only if the both-side threshold ALSO met; else the side with HIGHER `turnsSince<side>EngagedCluster`; ties → `'ignored_by_negative'` (stable lex order) | Deterministic resolution; documented. |
| Caller passes `affirmativeHasOpenRequestDirectedAtIt = true` AND `turnsSinceAffirmativeEngagedCluster = 0` | `{ state: null }` | An "ignored" advisory with zero turns of dormancy is non-sensical. |
| `clusterRootOrdinal > roomMoveCountAtEvaluation` (impossible-but-malformed) | `{ state: null, ruleFired: null }` | Negative cluster age → treated as 0 → below floor. Total / never throws. |
| Caller passes negative thresholds in config (e.g. `exhaustionRepeatThreshold: -1`) | Threshold treated as 0 → any non-zero pressure fires `exhausted` IF age floor met. Documented as "defensive — production callers never pass negatives". | Total function; never throws. |
| Permission-denied paths | N/A — pure model, no permission gates. | — |
| Concurrent edits | N/A — pure model, idempotent. | — |
| Offline / network failure | N/A — pure model, no network. | — |
| Time skew / clock drift | N/A — no `Date.now` reads. | — |

### Doctrine-edge cases (specifically called out)

- **What if heat or popularity is high?** Doesn't matter. The deriver doesn't take heat / popularity / engagement as input. The same advisory fires for a viral cluster and a quiet cluster with the same move structure.
- **What if the user with an open request directed at them is offline?** Irrelevant — the deriver describes the *cluster*, not the user. The advisory text says "Affirmative did not respond to the source request on this point", not "the user with id X did not respond". (Asserted by the person-attribution scan in tests.)
- **What if the cluster's strength band is "Needs work" — does that affect the advisory?** No. Strength bands are scoring, not lifecycle. The deriver ignores `standingBand` entirely (it never appears in the input shape).
- **What if there's an explicit `synthesis_ready` upstream from LIFE-001?** The deriver defers — `upstreamClusterState === 'synthesis_ready'` produces `null` here, because LIFE-001's stricter version (explicit synthesis move) is already the canonical signal and the broader GAME-001 version would just duplicate it. Documented.
- **What if a concession exists but evidence debt is unresolved?** `synthesis_ready` is NOT produced. This is the EV-001 / point-standing-economy interlock that the card explicitly asks for. The deriver falls through to whatever next rule qualifies.
- **What if both `moved_on_by_affirmative` and `moved_on_by_negative` qualify?** Returns the side with HIGHER turn count since engagement; ties resolved by `'negative'` (lex-stable). Documented + tested.

---

## Test plan

All tests live in `__tests__/exhaustionTimeoutModel.test.ts`. Aim for +40 net `it` cases.

### Fixture suite (5 named fixtures from the card)

1. **`repeated-axis exhaustion fixture`** — same-axis non-additive pressure = 3 (= default threshold), age = 5, no concession, no debt special-case → expects `exhausted` with `ruleFired === 'exhaustion.repeatThreshold'`. 4 tests:
   - state + label + helperLine matches RULE-003 mapping.
   - At pressure = 2 (< threshold), state = `null`.
   - At pressure = 3, state = `exhausted`.
   - At pressure = 4, state = `exhausted` (idempotent above threshold).

2. **`one-party ignored fixture`** — affirmative has open request directed at them, turns since affirmative engaged = 3 (= default `ignoredBySideTurnThreshold`), other side active → expects `ignored_by_affirmative`. 4 tests:
   - state matches.
   - helper line says "Affirmative did not respond" (not "the user ignored").
   - At turns = 2, state = `null`.
   - At turns = 3, state = `ignored_by_affirmative`.
   - Mirrored test for negative side.

3. **`two-party ignored fixture`** — both sides dormant >= `ignoredByBothTurnThreshold` (default 6), open request still active → expects `ignored_by_both`. 3 tests:
   - state + plain label + helper line.
   - At turns = 5/6 (one side below threshold), state = `ignored_by_affirmative` (since other side is dormant but did not meet "both" threshold; falls through to single-side).
   - At turns = 6/6, state = `ignored_by_both`.

4. **`synthesis-ready fixture`** — `hasConcessionOrNarrowing = true`, `hasUnresolvedEvidenceDebt = false`, age >= floor → expects `synthesis_ready`. 5 tests:
   - state + label + helper line.
   - With `hasUnresolvedEvidenceDebt = true`, state ≠ `synthesis_ready` (interlock test).
   - With `hasConcessionOrNarrowing = false`, state ≠ `synthesis_ready`.
   - With age = 1 (< floor), state = `null` (floor applies even to synthesis).
   - With `upstreamClusterState = 'rebutted'`, state = `null` (deference).

5. **`moved-on fixture`** — one side has not engaged for >= `movedOnTurnThreshold` (default 4), no open request directed at it → expects `moved_on_by_<side>`. 4 tests:
   - state matches for affirmative.
   - state matches for negative.
   - At turns = 3, state = `null`.
   - With same threshold met BUT `<side>HasOpenRequestDirectedAtIt = true`, state = `ignored_by_<side>` instead (priority order).

### Doctrine-pin suite

6. **No blocking output assertion across every state.** Iterate `ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES`; for each, build a minimal input that fires that state; assert `advisory.blocksSubmit === false` and `advisory.appliesPointStandingPenalty === false`. 2 assertions × 7 states = 14 assertions, packed into 1 parameterised `describe.each`.

7. **Copy ban-list scan.** For each producible state, assert `label` and `helperLine` contain none of `_forbiddenExhaustionTimeoutTokens()` (the union of `_forbiddenLifecycleTokens()` from LIFE-001 + the GAME-001 amplification / verdict guard list). 1 test, parameterised across states.

8. **Person-attribution scan.** For each state, assert the produced `helperLine` does NOT match any of: `/\bthe user\b/i`, `/\bthey\b.{0,30}(ignored|silent|absent|skipped)/i`, `/\byour opponent\b/i`, `/\b(affirmative|negative)\s+ignored\b/i` (the verb-form is forbidden; the noun-form "Affirmative did not respond on this point" is allowed because it describes the cluster). 1 test, parameterised.

9. **Priority order tests for conflicting inputs.** Build an input where ALL 7 advisory rules would qualify in isolation; assert `state === 'synthesis_ready'`. Then strip the synthesis prereq (`hasUnresolvedEvidenceDebt = true`); assert `state === 'exhausted'`. Then strip the exhaustion prereq (pressure = 0); assert `state === 'ignored_by_both'`. Then strip the both-side prereq (turns = 5/6); assert `state === 'ignored_by_<higher-turn-side>'`. Then strip the request flag; assert `state === 'moved_on_by_<side>'`. 5 cascading tests.

### Boundary tests (threshold N-1, N, N+1)

10. **N — exhaustion threshold.** Tests at pressure = N-1 (null), N (exhausted), N+1 (exhausted). 3 tests.
11. **M — moved-on threshold.** Tests at turns = M-1 (null), M (moved_on), M+1 (moved_on). 3 tests.
12. **K — ignored-by-side threshold.** Tests at turns = K-1 (null), K (ignored_by_<side>), K+1 (ignored_by_<side>). 3 tests.
13. **J — ignored-by-both threshold.** Tests at turns = J-1 (one side at J → falls to single-side), J (ignored_by_both), J+1 (ignored_by_both). 3 tests.
14. **`minClusterAgeForTimeoutAdvisory` floor.** Age = floor-1 → null even with every rule otherwise qualifying. Age = floor → fires. Age = floor+1 → fires. 3 tests.

### Override-threshold tests

15. **Caller passes custom config.** Override `exhaustionRepeatThreshold = 5`; assert pressure = 4 → null, 5 → fired, 6 → fired. 3 tests.
16. **Defaults match LIFE-001 for the four shared thresholds.** Assert `DEFAULT_EXHAUSTION_TIMEOUT_CONFIG.exhaustionRepeatThreshold === DEFAULT_LIFECYCLE_ADVISORY_CONFIG.exhaustionRepeatThreshold` and the three other shared fields. 4 tests.

### Adapter tests

17. **`buildExhaustionTimeoutInputFromLifecycle` populates every field.** Given a sample `PointLifecycleClusterSummary` + members + side turn sequence + artifact statuses + room move count, the adapter returns a fully-populated `ExhaustionTimeoutInput`. 6 tests, one per cluster-level signal.
18. **Adapter is idempotent.** Same inputs → same output (deep-equal). 1 test.
19. **Adapter does not mutate input.** Snapshot inputs before/after, deep-equal. 1 test.

### Purity / determinism

20. **Pure-TS source scan.** Static read of `exhaustionTimeoutModel.ts`; assert no imports from `react`, `react-native`, `expo`, `@anthropic-ai/sdk`, `../../lib/supabase`, `fetch`, no top-level `Date.now()` calls, no `Math.random()` calls. 1 test that reads the file via `fs` and regex-scans. (Pattern: same as the source-scan test in `runAiDrivenCorpus` and other guarded modules.)
21. **Deterministic.** Same input → same output across 10 invocations. 1 test.
22. **Idempotent under repeated wrapping.** Calling the deriver, taking its output, feeding the cluster id back through with a fresh input → same advisory (per cluster id). 1 test.

### Submit-path-still-postable assertion

23. **No advisory in this card touches `validation/` / `submit-argument`.** Static source scan: assert `exhaustionTimeoutModel.ts` does NOT import `submit-argument`, `validation/`, `supabase`. 1 test.
24. **The advisory state surfaces in chips, not validation.** Documented as a non-test guard in the doc — the prose-only assertion is the integration contract the implementer of SC-003 / ST-002 follow-ups commits to. Not a unit test here.

### Test totals

- Fixture suite: 4 + 5 + 3 + 5 + 4 = 21 tests.
- Doctrine-pin suite: 2 + 1 + 1 + 5 = 9 tests.
- Boundary: 3 + 3 + 3 + 3 + 3 = 15 tests.
- Override-threshold: 3 + 4 = 7 tests.
- Adapter: 6 + 1 + 1 = 8 tests.
- Purity / determinism: 1 + 1 + 1 + 1 = 4 tests.

**Total: ~64 tests.** Card asks for +30–50; we land at +40 active plus optional boundary cases (the implementer may consolidate parameterised cases into one `describe.each` to reduce mechanical count without losing coverage).

---

## Integration with LIFE-001

GAME-001 picks **option (b): a sibling deriver, NOT a replacement**.

**Rejected option (a) — extend `pointLifecycleModel.composeClusterState` to broaden `synthesis_ready` and add an override-config parameter.**
Drawbacks:
- LIFE-001 already 1.2 KLOC; extending the priority cascade balloons further.
- LIFE-001's `composeClusterState` is owned by the *canonical* state contract that META-001 / SC-004 / ST-002 / GAL-002 read. Changing its semantics mid-release is high blast-radius.
- AN-003's threshold-sweep use case requires a small, focused entry point; extending LIFE-001 doesn't give that.
- Touching `pointLifecycleModel.ts` requires updating the `pointLifecycleAdvisories.test.ts` fixture suite, increasing diff scope.

**Chosen option (b) — new module `exhaustionTimeoutModel.ts`, sibling to LIFE-001 inside `src/features/lifecycle/`.**
Benefits:
- Zero modification to existing production files. LIFE-001 / META-001 / RULE-003 untouched.
- Clean fixture surface for AN-003.
- Synthesis-ready broadening lives in GAME-001's contract, not LIFE-001's — preserves doctrine that LIFE-001 owns the *structural* state and GAME-001 owns the *advisory* state.
- Threshold overrides are first-class.
- Consumers opt in: SC-003 / ST-002 / AN-003 follow-up cards each plumb the deriver where they want it.

**Reconciliation:** when GAME-001's deriver fires `'exhausted'` and LIFE-001's `composeClusterState` ALSO fires `'exhausted'` for the same cluster, both surfaces agree on the state. The deriver is intentionally non-overriding: if `upstreamClusterState` carries a *non-advisory* value (`'conceded'`, `'archived_or_resolved'`, `'rebutted'`, `'confirmed'`, `'sourced'`), GAME-001 returns `null`. The deriver does NOT compete with LIFE-001 for clusters that already have a stronger signal.

**When the two disagree** (e.g., GAME-001 sees `synthesis_ready` via concession+no-debt, LIFE-001 sees `narrowed` because that's the last contribution): the consumer decides. The recommended consumer rule:

```
displayState =
  GAME-001's advisory (when non-null AND upstream is in the "permissive" set
                       i.e. not concession-shape final)
  ELSE LIFE-001's clusterSummary.state
```

This is the consumer's choice, not GAME-001's. Documented in the module-level comment.

---

## Dependencies (cards / docs / files)

- This design assumes **LIFE-001** is complete because we import `PointLifecycleState`, `PointLifecycleClusterSummary`, `DEFAULT_LIFECYCLE_ADVISORY_CONFIG`, the helper functions in `pointLifecycleAdvisoryInputs`, and the cluster grouping helpers. (Shipped per CLAUDE.md.)
- This design assumes **META-001** is complete because the doctrine of "auto metadata mirrors lifecycle state" is preserved; META-001's `synthesis_candidate` continues to derive from `clusterSummary.state` and is unaffected by GAME-001. (Shipped per CLAUDE.md.)
- This design assumes **RULE-003** is complete because we read `LIFECYCLE_UX_MAP` for the `label` + `helperLine` of every producible state. (Shipped per commit 97dbbf3.)
- Reads existing helper `turnsSinceSideEngagedCluster` at `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts`.
- Reads existing helper `countSameAxisPressure` + `hasAdditiveAxisInformation` at the same file.
- Reads `summarizeArtifactsForReceiptChip` at `src/features/evidence/evidenceModel.ts` (only inside the adapter, when caller doesn't pre-compute statuses).
- Will block **AN-003** because AN-003's "threshold sweep" diagnostic mode is built on top of GAME-001's deriver.
- Will block **SC-003 follow-up** / **ST-002 follow-up** if they want to surface broader-synthesis-ready chips (currently they read LIFE-001's stricter `synthesis_ready` only).
- Will NOT block any submit path; submit is unblocked across every advisory.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Priority order produces false `synthesis_ready` when evidence debt is subtle (e.g. EV-001 status = `unverified` but caller-derived `hasUnresolvedEvidenceDebt = false`). | Medium | The deriver does not compute evidence debt itself — it trusts the caller's boolean. The adapter (`buildExhaustionTimeoutInputFromLifecycle`) is conservative: it treats `unverified` AND `broken` AND `no_source` (when a claim-shape move) as debt. Adapter-level tests pin this. False-negative test: adapter sees `primary_present` → `hasUnresolvedEvidenceDebt = false`. |
| The plain-language helper for `ignored_by_<side>` could be read as a person-accusation by an end user. | Medium | RULE-003's helper line ("Affirmative did not respond to the source request on this point") is cluster-anchored. The person-attribution scan asserts no `the user` / `they ignored` / `your opponent` patterns. If RULE-003's copy ever drifts, the GAME-001 test catches it. |
| Thresholds (N=3, M=4, K=3, J=6, floor=2) may be too aggressive for short rooms. | Medium | The `minClusterAgeForTimeoutAdvisory` floor (default 2) is the explicit mitigation. AN-003 will measure false-positive rate and propose a tune via override config; GAME-001 already exposes the override surface. |
| Caller forgets to pass `upstreamClusterState` and GAME-001 fires an advisory on a cluster that LIFE-001 has already classified as `conceded`. | Medium | Documented in module-level comment; the adapter `buildExhaustionTimeoutInputFromLifecycle` always passes the summary's state, so adapter callers are safe by construction. Direct callers (AN-003 sweep mode) are advanced consumers who own this contract. |
| Consumer (SC-003 / ST-002) wires GAME-001 in such a way that the advisory overrides LIFE-001's display state. | Low | This card is pure-model and ships NO UI integration. The follow-up cards (SC-003 / ST-002) must respect the documented consumer rule. Out of scope here. |
| Adding a new GAME-001-producible state in v2 requires updating RULE-003. | Low | `ALL_EXHAUSTION_TIMEOUT_ADVISORY_STATES` is a frozen array; a test asserts every member has a corresponding entry in RULE-003's `LIFECYCLE_UX_MAP`. The compile-time exhaustiveness check on the `switch` inside `deriveExhaustionTimeoutAdvisory` catches missing states at build time. |
| LIFE-001's `composeClusterState` quietly drifts (e.g. someone adds a new state to the priority cascade); GAME-001's priority order grows out-of-sync. | Low | The two derivers are intentionally decoupled — GAME-001 derives 7 states, LIFE-001 derives 18 (the 7 + 11 others). Drift in LIFE-001 has no effect on GAME-001 unless the 7 shared states are renamed (a typed compile error). |

---

## Out of scope

Explicitly NOT part of GAME-001:

- UI rendering of advisories (chips, badges, helper lines surfaced in a screen). Consumed in follow-up cards (SC-003 / SC-004 / IX-002 / GAL-002 / ST-002) which already exist or have their own design docs.
- Standing penalty integration. Doctrine: an advisory NEVER auto-applies a point-standing penalty. The card is explicit: "no standing penalty without operator review".
- Persistence. Advisories are derived per-render. No DB column, no table.
- AI inference. No LLM, no rule-discovery, no annotation pass.
- Threshold tuning beyond v1 conservatives. AN-003 measures false-positive rate; tuning is a follow-up.
- Block-on-submit integration. Submit is unblocked across every advisory state. Doctrine.
- A "user has ignored this cluster" surface. The doctrine forbids person-attribution.
- A "winner has been declared" surface. The doctrine forbids verdicts.
- Auto-archive. The doctrine forbids it.
- Rewriting LIFE-001's `composeClusterState`. Sibling deriver only.
- META-001 changes. None.
- RULE-003 changes. None.
- Edge Function for advisory derivation. Pure-TS — runs client-side and in any Edge Function adapter that calls it.

---

## Doctrine self-check

### cdiscourse-doctrine

- **§1 (Score is gameplay, never truth):** the advisory describes board state ("Affirmative did not respond on this point", "Out of new angles on this axis"), never truth value. Helper lines READ from RULE-003 which is already doctrine-compliant; ban-list scan re-asserts at test time.
- **§2 (Heat ≠ truth):** the deriver does not take a heat input. The `ExhaustionTimeoutInput` shape has no `heatScore`, no `recentActivityWeight`, no `temperatureBand`, no `engagementVelocity`. Static source-scan test asserts no such fields exist.
- **§3 (Popularity is not evidence):** the deriver does not read like / view / retweet / follower counts. There is no popularity field on the input. Static source-scan test pins this.
- **§4 (AI moderator limits):** no AI call. No `fetch`. No `@anthropic-ai/sdk`. No xAI client. Source-scan test asserts.
- **§5 (Rules engine is sacred):** the deriver does NOT touch `src/lib/constitution/engine.ts`. It lives under `src/features/lifecycle/`, alongside LIFE-001. Source-scan test asserts no import from `constitution/`.
- **§6 (Secrets policy):** no env reads. No `process.env`. Static source-scan test asserts.
- **§7 (No AI calls from production):** deriver is pure-TS. No external HTTP. Static source-scan asserts.
- **§8 (Supabase conventions):** no new migration, no RLS change, no schema touch, no `arguments` table touch, no service-role usage. The deriver is an in-process function.
- **§9 (Plain language for users):** every produced `label` and `helperLine` comes from RULE-003's `LIFECYCLE_UX_MAP`, which is already routed through `PLAIN_LANGUAGE_COPY`. GAME-001 does NOT author any new plain-language strings. The producer can NEVER leak an internal code like `exhausted` into a user-facing field because the deriver READS the label from RULE-003 rather than echoing the state code.
- **§10 (v1 scope guards):** no voting, no scoring, no real-time collab, no OAuth, no public API, no push notifications, no argument search. The card is a pure-TS advisory deriver — none of the banned surfaces touch it.

### point-standing-economy

- **Concession is a scoring repair, not a defeat:** the deriver fires `synthesis_ready` when a concession exists AND no debt is open. This is the *advisory shape* of the doctrine that concession lifts broad standing. The deriver does NOT auto-apply the +0.25 broad-lift / -0.15 narrow-shrink scoring delta — that remains the point-standing economy's job, triggered by an explicit `gradeChallenge` / `gradeRepair` call, NOT by an advisory.
- **Evasion costs more than acknowledging:** GAME-001's `ignored_by_<side>` advisory is the BOARD-LEVEL signal that a side has not addressed a request. The scoring penalty for evasion (unresolved-debt 0.25 + evasion narrow drop 0.3) is owned by the point-standing economy, NOT GAME-001. The advisory says "this point has not had a reply from Affirmative"; it does NOT pre-charge a penalty.
- **No axis = no credit:** N/A here — the deriver does not award credit. It surfaces state. The point-standing economy handles the no-axis filter.
- **One credit per debt:** N/A — same reason.
- **Tangents and near-duplicates earn nothing:** N/A — same.
- **Self-concession loops earn nothing:** N/A — same.

### evidence-doctrine

- **Engagement credit vs factual-standing credit are separate:** GAME-001 does NOT touch either. The `synthesis_ready` advisory only fires when evidence debt is absent — meaning the cluster is in a state where a synthesis would NOT be hiding behind an unresolved debt. The advisory says "you COULD synthesize", not "you SHOULD" and not "the point is true".
- **`broken_chain` is not "falsehood":** the deriver treats `broken` and `no_source` as evidence debt for advisory purposes (via the adapter). This is doctrine-aligned: the cluster carries debt; it does NOT carry a truth verdict.
- **Per-move debt is gameplay, not truth:** GAME-001 reads ONE boolean (`hasUnresolvedEvidenceDebt`) — it doesn't surface the per-move debt list. That is EV-003's job.
- **Banned user labels (`troll` / `bot` / `astroturfer` / `liar` / `propagandist` / `extremist` / `bad faith` / `manipulative`):** added to `_forbiddenExhaustionTimeoutTokens()` and scanned across every produced label / helperLine.

### timeline-grammar

- **No truth/verdict tokens in copy:** asserted by `_forbiddenExhaustionTimeoutTokens()` + the cross-iteration test.
- **Strength bands and standing bands are NOT read:** the input shape has no `standingBand` / `temperatureBand` / `toneBand` field. Source-scan asserts.

### accessibility-targets

- N/A directly — this card is a pure model. No UI primitive, no tap target, no screen-reader text. The helper lines GAME-001 surfaces ARE used by SC-003 / ST-002 chips downstream, and their a11y is owned there.

### test-discipline

- Tests are required, not optional. +40 net `it` cases per the test plan.
- Doctrine pins are in the test suite (ban-list, person-attribution, blocking, penalty, source-scan).
- Boundary tests cover N-1 / N / N+1 for every threshold.
- Priority-order tests cover the cascade.
- Adapter tests round-trip from LIFE-001 outputs.

### expo-rn-patterns

- N/A — no UI in this card.

### supabase-edge-contract

- N/A — no Supabase touch.

---

## Operator steps (if any)

**None — pure code change.**

No migration. No Edge Function deploy. No env var. No npm install. No service-role action. The change is in-process TypeScript that ships with the next bundle.

When the implementer commits this card, the operator only needs to:

1. Pull the branch.
2. Run `npm run typecheck` (expects clean).
3. Run `npm run lint` (expects clean).
4. Run `npm run test` (expects all previously-passing tests + ~40 new tests passing).
5. Merge the PR. No deploy steps follow.

---

## Implementer one-page summary

- **Module:** `src/features/lifecycle/exhaustionTimeoutModel.ts` (NEW, ~350 lines).
- **Public surface:** 4 types + 1 frozen state list + 1 frozen default config + 2 functions + 1 test-only `_forbidden…` export.
- **Tests:** `__tests__/exhaustionTimeoutModel.test.ts` (~620 lines, ~40 tests).
- **Doctrine pins:** no blocking, no penalty, no person-attribution, no verdict tokens, no popularity input, no AI.
- **Integration:** SIBLING to LIFE-001's `composeClusterState`. Reads RULE-003's `LIFECYCLE_UX_MAP`. Read-only from META-001. Zero modification to existing files (other than the barrel re-export in `lifecycle/index.ts` and the `current-status.md` log entry).
- **Operator action:** none. Pure code change.
