# COMP-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** main (commit `46cad00`)
**Design:** docs/designs/COMP-001.md + docs/designs/COMP-001-worked-examples.md
**Reviewer mode:** Path B (no worktree — review of a design already committed to `main` without a designer-agent doctrine pass)

---

## Summary

COMP-001 specifies a pure-TS function `composeVisualState` that maps the semantic referee's binary classifier signal vectors into typed `NodeVisualMutation` enum values targeting specific `moveId`s on the timeline. The design preserves the binary contract (no model-prose parsing), produces zero natural language (rendering is downstream via `gameCopy.toPlainLanguage`), is deterministic and snapshot-testable, and runs only after the classifier has produced a packet — no AI calls of its own, no network, no Supabase client. Both worked-example walkthroughs (band-space-rent, remote-work-productivity) describe structural states only — never assertions about who is right. The 22 composition rules + 2 exemption patterns + 35 enum values were scanned for verdict and person-label tokens; both scans came back clean. The §7 test plan (~56 new tests across 5 files) matches the project's test-discipline expectations for a pure model. **The design on main is doctrine-safe as-is; no follow-up commit is required from the operator.**

---

## Verification (design-only review, no source code changed)

- typecheck: not run (no production code changes; design-only commit)
- lint: not run (same reason)
- test: not run (same reason)
- secret scan: clean (design doc contains no keys, tokens, or env-style strings)
- doctrine scan: clean (verdict + person-label scans returned only meta-references, no enum or rule content)

---

## Per-check matrix

| # | Check | Result | Justification |
|---|---|---|---|
| 1 | No truth claims in composition rules | PASS | All 22 rules + 2 exemptions emit structural state only. "Evidence debt opened" = request was filed (no judgment on the evidence); "point conceded" = author marked a narrowing (no judgment that the original claim was wrong). §2.2 + §3.4 explicitly bind the layer to the same doctrine as the classifier. |
| 2 | No verdict / person-label tokens in any enum value | PASS | Scanned all 35 `NodeVisualMutationType` values (lines 408-450) against the ban-list (`winner`, `loser`, `truth`, `true`, `false`, `correct`, `wrong`, `right`, `proven`, `defeated`, `won`, `lost`, `liar`, `lying`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `dumb`, `smart`, `troll`). Zero matches inside enum values. §5.2 self-asserts this and the §7.4 doctrine-scan test enforces it. |
| 3 | Function signature is pure | PASS | §1 + §2.1 + §6 describe `composeVisualState` as a pure synchronous function. §6.1 places the call slot between `classifyMove → packet` and `selectBanner` inside `useSemanticReferee.onMovePosted` with no fetch / DB / Edge Function call attributed to the composition layer itself. §6.2 uses a hook-local `useRef` for accumulation, not a network or persisted store. |
| 4 | No AI calls in the composition module | PASS | §2.6 explicitly forbids it ("The function does NOT decide what the AI classifies"). §9 reinforces ("Does NOT call the AI"). The classifier is upstream; the layer reads packets. §7.5 purity test enforces "no Anthropic / xAI SDK import." |
| 5 | No client-side service-role usage | PASS | §6 wires the function into a React hook on the client; nothing in the design routes service-role-scoped operations through it. The hook reads packets (already cached) and produces mutation enums; no write path is named. §9 says "Does NOT persist `CompositionState` to the database." |
| 6 | Worked-examples doctrine compliance | PASS | Scanned all 16 "Timeline view" lines across both scenarios (band-space-rent m1-m8 in 23-id + 35-id modes, remote-work-productivity m1-m8) plus the summary blocks. Every description is structural: "opening-claim hat", "evidence-attached pill in a muted state", "scope narrowed downstream indicator", "amplification warning chip", "synthesis offered pill". No timeline-view sentence attributes truth, calls a participant a name, or declares a winner. The m7 "point conceded" + m8 "synthesis offered" descriptions in band-space-rent are correctly framed as structural state transitions on the author's own subsequent move, not as the referee declaring the prior author defeated. |
| 7 | Anti-amplification doctrine | PASS | R-EV-04 (§4.2) emits `popularity_amplification_warning` on the CURRENT move only with explicit "doctrine forbids attaching a verdict to the ancestor" in the State Update column. Worked-example m5 of remote-work-productivity correctly fires the warning chip + a separate source-chain-gap indicator, and the chain-walking concession/synthesis rules later in the scenario never retroactively grant factual standing to m5. Matches the semantics encoded in `src/features/pointStanding/antiAmplification.ts` (engagement credit separate from factual-standing eligibility). |
| 8 | §7 test plan against `test-discipline` | PASS (with one non-blocking note) | The breakdown (24 rule snapshots + 16 scenario replays + 9 edge cases + 2 doctrine + 5 purity = ~56 tests across 5 files) matches the project's pattern for pure-TS models. The 8 edge cases in §7.3 cover the right shape (empty vector, all-1s vector, root, exempt-first-move, deleted parent, no-packet, multiple debts, retraction-without-evidence). Non-blocking note: there is no explicit hook-level integration test for the new `getMutationsForMove` / `getCompositionState` surface added in §6.3. The implementer should add a brief one to `useSemanticReferee.test.ts` (or sibling) so the wiring between `composeVisualState` and the hook is covered. Counts as a Suggestion below, not a Changes Requested. |
| 9 | Dependency chain accuracy | PASS (with honesty note) | The hard-dependency framing on MCP-MOD-004 (#233) is slightly stronger than strictly required. `SemanticClassifierId` and `ALL_SEMANTIC_CLASSIFIER_IDS` already exist in `src/features/semanticReferee/semanticRefereeTypes.ts`, so COMP-001 could technically ship today by importing classifier ids from there. The design's preference to wait for MCP-MOD-004's `SEMANTIC_CLASSIFIER_CATALOG` is REASONABLE (the catalog is a richer indirection that includes metadata) and the design is honest that it could ship before / parallel / after MCP-CAT-001 (#238). Not a doctrine issue, just an architectural-rigor choice. |
| 10 | "Not in scope" honesty (§12) | PASS | §12 lists 10 items; cross-checked each against §4 / §5 / §6. The §6 enrichment to `argumentGameSurfaceModel.ts` adds an optional `crossNodeMutations` field + a `getCrossNodeMutations` helper — this is a model addition (consistent with "no UI implementation" being out of scope; the bubble-rendering code is explicitly named as the CONSUMER, not as part of COMP-001). Section §6.4 also clarifies banner enrichment is allowed but optional and lives in the banner library, not in this layer. The "no copy string", "no migration", "no Edge Function", "no scoring delta" claims all hold. |
| 11 | Forward compatibility with MCP-CAT-001 | PASS | Both worked-example walkthroughs are presented in 23-id mode first, with `[PROPOSED — MCP-CAT-001]` annotations marking 35-id additions. The 23-id timelines are coherent: e.g., remote-work-productivity ends with two unresolved source-chain gaps (m3, m5), one unresolved evidence debt (from m6), and a synthesis offered on m8 — this is a faithful partial-state representation, not a broken output. The "Honest limitation in 23-id mode" callouts at m3 / m7 / m8 of band-space-rent are not bugs, they are documented graceful degradations. |
| 12 | Open questions are honest (§13) | PASS | Reviewed all 4 open questions. Q1 (class vs plain object) is a tactical structure choice. Q2 (export `findUpstreamMove` or not) is an API-surface preference. Q3 (rule-execution order) is a determinism nuance and §13 itself recommends a specific order with a test. Q4 (deleted-parent handling) is a layering decision and correctly defers rendering policy downstream. None of the four hides a doctrine call. |

---

## Bottom line

The design as committed at `46cad00` is doctrine-safe. The composition layer is positioned correctly (pure-TS, between classifier and renderer), the enum is clean of banned tokens, the worked-examples descriptions never assert truth, and the test plan is properly sized. **No follow-up commit from the operator is needed.** The next step is the implementation card (COMP-001-BUILD or simply COMP-001's implementation phase) once MCP-MOD-004 (#233) merges, as the design states.

## Suggestions (non-blocking, for the implementer's reviewer)

1. **Add one hook-level integration test.** The §7 test plan covers the pure model thoroughly but does not explicitly cover the new `getMutationsForMove(moveId)` / `getCompositionState()` surface on `useSemanticReferee`. A short test in `__tests__/useSemanticReferee.test.ts` (or its sibling) that posts a fixture move, lets the hook accumulate state via `onMovePosted`, and asserts `getMutationsForMove(...)` returns the expected mutation set would close that gap. Not a doctrine issue — a coverage one.
2. **Reconsider the §8 "HARD dep" wording.** Today's `ALL_SEMANTIC_CLASSIFIER_IDS` in `semanticRefereeTypes.ts:131` already exports the 23 active ids. If the operator wanted to unblock COMP-001 implementation in parallel with MCP-MOD-004, the implementer could substitute that import as a stopgap and migrate to `SEMANTIC_CLASSIFIER_CATALOG` once it lands. The design's hard-dep framing is principled, not mandatory — calling this out for scheduling honesty, not asking for a doc edit.
3. **The §13 Q3 (rule execution order) recommendation is the right one** (parent-continuity → evidence → constructive-movement → debate-mode → branch-routing), but the design should require — not recommend — that the implementer add a test asserting the order. State-update ordering is the most fragile part of the layer because R-EV-02 + R-EV-06 + R-CM-02 can fire on the same packet. Strengthening §13 Q3 to "the implementer MUST add a determinism test" would prevent drift.

## Operator next steps

- This review is committed on `main` directly (no PR — design already merged, this is a doctrine-pass attestation).
- No code change required. The design may proceed to MCP-MOD-004 (#233) merge → implementation phase.
- When the implementation card is spawned, the implementer's reviewer should treat this review's 12 checks as the conformance baseline and verify the same properties on the produced code.
