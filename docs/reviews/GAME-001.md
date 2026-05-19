# GAME-001 — Review

**Verdict:** Approve
**Card:** GAME-001 — Point exhaustion and timeout rules
**Branch:** `feat/GAME-001-point-exhaustion-and-timeout-rules`
**Design SHA:** d26e9bc (`docs/designs/GAME-001.md`)
**Implementation SHAs:**
- 213e064 feat(GAME-001): sibling exhaustion/timeout advisory deriver
- 3dbfa5a test(GAME-001): coverage for exhaustion + timeout deriver
- 29c7f76 docs(GAME-001): current-status entry for exhaustion + timeout deriver

**Reviewer agent run:** 2026-05-19
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/64

---

## Summary

A pure-TS sibling deriver landed in `src/features/lifecycle/exhaustionTimeoutModel.ts` (651 lines) exposing `deriveExhaustionTimeoutAdvisory(input): ExhaustionTimeoutAdvisory` and an optional `buildExhaustionTimeoutInputFromLifecycle` adapter. LIFE-001's canonical `composeClusterState` is untouched; the constitution engine is untouched; META-001 and RULE-003 are untouched. The deriver's contract has two compile-time-pinned literal-`false` fields (`blocksSubmit`, `appliesPointStandingPenalty`) that the type system itself enforces. 103 new tests / 1 new suite — 3980 → 4083 passing — with parameterized doctrine pins iterated over every producible state. Two documented extensions ('sourced' in the defer set; `> 0` guard on ignored-by-side) are both anchored in the design's Reconciliation and Edge-Cases sections.

No concerns. Approve.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | pass (clean) |
| `npm run lint` | pass (clean, --max-warnings 0) |
| `npm run test` | 4083 pass / 19 fail / 4102 total; +103 vs main. The 19 failures are all pre-existing operator-gated xAI/Anthropic suites (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialPipeline`, `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`) blocked by missing `.env.engagement-intelligence` — unchanged by this card. |
| Targeted `exhaustionTimeoutModel.test.ts` | **103 / 103 pass** in <1 s |
| Secret-shape scan on production diff | clean (no key/token/JWT/Bearer hits) |
| Verdict-token scan on production diff | clean (only matches are in doctrine comments explaining the ban list — not in user-facing strings) |
| Service-role / direct-insert scan | clean (no SERVICE_ROLE, no `public.arguments` insert, no AI SDK import) |
| `console.*` in added code | clean |
| `package.json` diff | zero bytes (no new dep) |
| Migration / Edge Function / `.env*` / `supabase/` diff | zero bytes |

## Design conformance

| Item | Status |
|---|---|
| All design file-changes are present | yes — exactly the 5 expected paths |
| No undocumented file-changes | yes — `src/lib/constitution/`, `pointLifecycleModel.ts`, `pointLifecycleAdvisoryInputs.ts`, `pointLifecycleClusters.ts`, `metadata/`, `rulesUx/lifecycleUxMap.ts`, `conversationGalleryModel.ts`, `package.json`, `supabase/` all 0-byte |
| `ExhaustionTimeoutInput` shape matches design | yes — 14 flat fields, no DAG walk in the deriver body |
| `ExhaustionTimeoutAdvisoryState` 7-value union | yes — matches design exactly (no `branch_recommended`) |
| `DEFAULT_EXHAUSTION_TIMEOUT_CONFIG` mirrors LIFE-001 for shared thresholds | yes — pinned by 4 parity tests |
| Priority cascade order | matches design (synthesis_ready > exhausted > ignored_by_both > ignored_by_<side> > moved_on_by_<side> > null) — verified by 5 cascading strip tests |
| `buildExhaustionTimeoutInputFromLifecycle` adapter ships in same module | yes |
| `_forbiddenExhaustionTimeoutTokens()` test-only export | yes — extends LIFE-001's ban-list with `punish/penalty/penalise/penalize/condemn/accuse/accusation/ignored you/they ignored/the user` |

## Doctrine self-check

### cdiscourse-doctrine

| Check | Result |
|---|---|
| §1 No truth / winner / loser language in user-facing strings | clean — deriver authors **zero** copy; every label/helperLine is read from RULE-003's `LIFECYCLE_UX_MAP` |
| §1 Score never blocks posting | enforced at the type level — `blocksSubmit: false` is a compile-time literal-type field |
| §3 No heat / popularity / engagement input | enforced — no `heatScore` / `recentActivityWeight` / `engagementVelocity` field exists on `ExhaustionTimeoutInput`; source-scan asserts |
| §4 No AI moderator calls | enforced — source-scan test asserts no `@anthropic-ai/sdk`, no `api.x.ai`, no `fetch(`, no `XMLHttpRequest` |
| §5 Rules engine sacred | enforced — `git diff main..HEAD -- src/lib/constitution/` is empty; source-scan asserts no `from .*constitution/engine` import |
| §6 No secrets in source | enforced — source-scan asserts no `process.env` read |
| §7 No AI in production paths | clean — deriver is pure-TS; no external HTTP |
| §8 No service-role, no direct `public.arguments` insert | n/a — pure model, no Supabase touch |
| §9 Plain language only | enforced — every label/helperLine routed through RULE-003; deriver never authors a string |
| §10 v1 scope (no voting, no scoring, no push, no public API) | clean |

### point-standing-economy (primary doctrine layer)

| Check | Result |
|---|---|
| Concession is a scoring repair, not a defeat | encoded — `synthesis_ready` fires on concession + no-debt, but **never** auto-applies the +0.25/-0.15 standing delta; that remains `gradeChallenge`/`gradeRepair`'s job |
| Advisory NEVER auto-applies a point-standing penalty | enforced by **compile-time literal `appliesPointStandingPenalty: false`** field — type system blocks any future drift, plus runtime test iterates all 7 states + null advisory (= 8 assertions, parametrized in `it.each`) |
| Engagement credit and factual-standing credit remain SEPARATE | the deriver does not touch either economy; `hasUnresolvedEvidenceDebt` is consumed as a single boolean read-only input |
| No axis = no credit; one-credit-per-debt; tangent earns nothing | n/a — deriver does not award credit, only surfaces board state |

### evidence-doctrine

| Check | Result |
|---|---|
| `broken_chain` ≠ falsehood | encoded — adapter treats `broken` / `no_source` on claim/support/rebuttal as debt for the **advisory** boolean, not as a truth verdict |
| Per-move debt is gameplay, not truth | yes — adapter aggregates per-message statuses into the one `hasUnresolvedEvidenceDebt` boolean and never surfaces per-move debt to the advisory output |
| `synthesis_ready` interlocked with evidence debt | yes — fires only when `hasConcessionOrNarrowing && !hasUnresolvedEvidenceDebt` (test §358-369 confirms; cascade test also confirms strip-debt routes elsewhere) |
| Banned user labels (`troll/bot/astroturfer/liar/...`) | inherited from LIFE-001's `_forbiddenLifecycleTokens()` and re-asserted by the parameterized ban-list scan across all 7 producible states |

### timeline-grammar

| Check | Result |
|---|---|
| No truth/verdict tokens in copy | enforced by parameterized ban-list scan; `winner` / `loser` / `liar` / `verdict` etc. all appear only in doctrine comments, never in code paths that produce a string |
| Strength bands / standing bands NOT read | enforced — input shape has no `standingBand` / `temperatureBand` / `toneBand` field |

### accessibility-targets

Not directly applicable — this is a pure model with no UI primitive. Source-scan asserts no React / RN / Expo import. Downstream consumers (SC-003, ST-002 follow-ups) own the a11y contract when they render advisory chips.

### test-discipline

| Check | Result |
|---|---|
| Tests required, +103 net (target: +30-50) | exceeded — 103 active tests, 1 new suite |
| Doctrine pins in suite (ban-list, person-attribution, blocking, penalty, source-scan) | all present |
| Boundary coverage N-1 / N / N+1 | present for N (exhaustion), M (moved-on), K (ignored-by-side), J (ignored-by-both), and the `minClusterAgeForTimeoutAdvisory` floor |
| Priority-order cascade test | 5 cascading strip tests confirm the order |
| Adapter tests round-trip from LIFE-001 outputs | 9 adapter tests including idempotency + non-mutation + round-trip-through-deriver |

## Test coverage spot-check

- **Fixture suites (5):** repeated-axis exhaustion (4), one-party ignored (5), two-party ignored (3), synthesis-ready (5), moved-on (5) — covers every fixture named in the card.
- **Doctrine pins (4 × parameterized `it.each` over 7 states + null advisory):** no-blocking, ban-list scan, person-attribution scan, RULE-003 coverage = 28 + 1 expanded assertions.
- **Threshold boundaries:** N (3), M (3), K (3), J (3), floor (4) = 16.
- **Override + parity:** custom config (3), defaults parity with LIFE-001 (4) = 7.
- **Adapter:** 9 cases including cluster-id passthrough, upstream state passthrough, non-additive pressure counting, additive subtraction, concession detection, evidence-debt detection (both summary and per-message paths), has-ever-engaged per side, idempotency, no-mutation, round-trip.
- **Purity/determinism/source-scan:** 4 tests pin no React/RN/Expo/Supabase/Anthropic/xAI/fetch/Date.now/Math.random/process.env/console/constitution engine/submit-argument/validation imports.
- **Edge cases (8):** empty cluster, upstream `archived_or_resolved` / `conceded` / `synthesis_ready` deferral, zero-turn-with-open-request guard, malformed root-ordinal-past-room-count, negative threshold clamp, moved-on tie-break, null-shape completeness.

The two documented small extensions are both **design-anchored**:

1. **`defer-set` includes `'sourced'`** — design § "Reconciliation" line 553 explicitly names `'sourced'` in the non-advisory-upstream list. Test §868 confirms `synthesis_ready` upstream also defers (per §147 doc comment).
2. **`ignored_by_<side>` requires `turnsSinceSideEngaged > 0`** — design § "Edge cases" line 425 ("Caller passes `affirmativeHasOpenRequestDirectedAtIt = true` AND `turnsSinceAffirmativeEngagedCluster = 0` → `{ state: null }` | An 'ignored' advisory with zero turns of dormancy is non-sensical."). Test §878 confirms.

A third minor strengthening: `ignored_by_both` also requires at least one of `(affirmativeHasOpenRequestDirectedAtIt || negativeHasOpenRequestDirectedAtIt)`. This isn't a literal one-line restatement of the design's Priority §3, but it's a faithful reading of design §281 ("Two-side dormancy is a strictly stronger condition than one-side dormancy **under an open request**") and the test plan §463 ("**open request still active** → expects `ignored_by_both`"). All `ignored_by_both` tests in the suite pass an open-request flag — this is consistent with the design's framing. Not a blocker.

## Blockers

None.

## Suggestions (non-blocking)

1. **Implementer's choice to also require an open request on `ignored_by_both`** — The design's Priority §3 reads strictly as "both sides dormant + age >= floor", whereas the implementation adds "(aff has open req OR neg has open req)". This is consistent with design §281's verbal framing and the §463 test fixture, and is the safer interpretation (an "ignored" advisory with nothing pending is doctrinally weaker). If a future card wants to surface the dormancy-without-request case, it should be a *new* advisory state ("stalled_no_request" or similar), not a loosening of `ignored_by_both`. Recommend either (a) a one-line module comment near the `ignored_by_both` block making the open-request requirement explicit and citing design §281, or (b) leaving as-is and documenting the strengthening in a future iteration. Either is fine.
2. **`offAxisPressureCount` is read but never used in the deriver body** — only the adapter populates it via `countOffAxisPressure`. The design (§124) acknowledges it's tracked "only for tie-breaking when both `exhausted` and `branch_recommended` would qualify — GAME-001 does NOT itself produce `branch_recommended`". Consider a one-line `// reserved for AN-003 / future tie-break` comment near the field declaration to discourage future readers from assuming it's load-bearing.
3. **`buildAdvisory` could pin `ruleFired` as a literal-string union** rather than `string` — minor type-safety nicety. Not required.

## Operator next steps

Per design § "Operator steps (if any)": **none** — pure code change.

Push and open PR:

```
git push -u origin feat/GAME-001-point-exhaustion-and-timeout-rules
gh pr create --title "GAME-001: Point exhaustion and timeout rules" --body-file docs/reviews/GAME-001.md
```

No deploy. No migration. No env. No service-role action. The deriver is not auto-wired into any rendered surface; SC-003 / ST-002 / AN-003 follow-up cards consume it where they want.
