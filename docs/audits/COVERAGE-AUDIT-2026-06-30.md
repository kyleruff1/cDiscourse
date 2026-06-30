# CDiscourse — Comprehensive Test-Coverage Audit (2026-06-30)

**Date:** 2026-06-30
**Repo HEAD at audit:** `main @ 0d39383`
**Methodology:** 6 parallel `Explore`-subagent reviewers, one per surface, plus a synthesizer agent. Each reviewer inspected real files (Read/Grep/Glob) and returned a structured `gaps` list with severity, location, evidence, and fix-cost estimate. Synthesizer deduped and ranked across surfaces.
**Total gaps surfaced:** 50 across 6 surface areas
**Existing test files examined:** ~240
**Existing pass counts (baseline):** 1,805 Jest tests / 70 suites + 2,080 Deno mcp-server tests

---

## Executive summary

Six auditors examined ~240 existing test files across UI, mcp-server, Edge Functions, migrations, auth, and the AI pipeline. The suite is large and pure-model coverage is the project's strongest asset. The main systemic risk is a **deployed-but-untested pattern**: `process-language-draft` and `cutover-health-monitor` are live in production with effectively zero tests; Families D–J in mcp-server have only fixture coverage; the deployed auth flow is mocked end-to-end on a lane that has already shipped two production-only bugs this stage. The single **CRITICAL** finding is that `submit-argument`'s QOL-041 soft-rollback path is source-scanned but never executed — a regression there orphans every failed concession submission. A second cross-cutting hazard is **inherited-visibility RLS**: `concession_items`, `concession_acceptances`, and `move_reactions` all delegate to `arguments` without re-asserting the predicate, making any future `arguments` RLS edit a private-room data-leak trap.

**Verdicts:** mcp-server and AI pipeline **STRONG**; UI, migrations, and auth **ADEQUATE**; Edge Functions **WEAK**.

## Per-surface verdicts

| surface | verdict | headline gap count | one-line summary |
|---|---|---|---|
| **Client / UI (React Native + Expo Web)** | 🟡 ADEQUATE | 10 | Pure-model layer is strongly tested but the largest Stage 6.x components (`ArgumentGameSurface`, `ArgumentTimelineMap`, `ArgumentBubbleStack/Card`) and the freshly-shipped `ObserverActionDockLayout` have no render or unit coverage. |
| **mcp-server (Deno Deploy)** | 🟢 STRONG | 10 | All 10 families have fixture-level + schema parity + ban-list + key-level fail-closed coverage. Anthropic prompt path for D–J and semantic-move error-log audit remain blind spots tied to the Edge-gate assumption. |
| **Supabase Edge Functions** | 🔴 WEAK | 8 | Contract scans are uniform but rollback atomicity, two deployed functions (`process-language-draft`, `cutover-health-monitor`), constraint violations, MCP timeouts, and queue-routing happy path lack execution tests. The single CRITICAL finding lives here. |
| **Supabase Migrations / RLS** | 🟡 ADEQUATE | 7 | All 28 tables have RLS and soft-delete invariants hold, but three QOL-041 tables (`concession_items`, `concession_acceptances`, `move_reactions`) inherit debate visibility via loose `EXISTS` without re-asserting the predicate. |
| **Auth flow** | 🟡 ADEQUATE | 8 | 27 dedicated test files cover OAuth callback, session boot, and validation thoroughly. `useAuthSession`, sign-out UI, rate limiting, and the full deployed end-to-end flow are not exercised — the lane that has already shipped two production-only bugs this stage. |
| **AI features end-to-end** | 🟢 STRONG | 7 | Anti-amplification doctrine, concession economy, debt ledger, message qualifiers, and provenance are well-tested with parity guards. Missing: a lifecycle E2E that chains the seams, adversarial corpora for the anti-amplification scorer, and drainer concurrency edges. |

---

## Top 10 ranked gaps (severity × deployment-impact ÷ fix-cost)

| # | sev / cost | gap | surface |
|---|---|---|---|
| 1 | **CRITICAL / M** | `submit-argument` soft-rollback atomicity has no integration test | Edge |
| 2 | HIGH / S | `process-language-draft` has zero test coverage despite being deployed | Edge |
| 3 | HIGH / M | `ArgumentGameSurface` (2990 LOC) has no RNTL render coverage | UI |
| 4 | HIGH / M | `concession_items` / `concession_acceptances` / `move_reactions` SELECT policies inherit visibility loosely | RLS |
| 5 | HIGH / M | Anthropic pathway for Families D–J untested end-to-end | mcp-server |
| 6 | HIGH / L | No deployed end-to-end auth smoke covers sign-up through session restore | Auth |
| 7 | MED / L | No end-to-end test from `submit-argument` through scored badges | AI |
| 8 | MED / S | `ObserverActionDockLayout` pure-model derivers untested | UI |
| 9 | MED / S | `classify_semantic_move` packet-failure path lacks ban-list and error-log audit | mcp-server |
| 10 | MED / L | `ArgumentTimelineMap` (1405 LOC) has no RNTL coverage | UI |

### Gap details

#### #1 — `submit-argument` soft-rollback atomicity has no integration test
- **Severity / Cost:** CRITICAL / M
- **Location:** `supabase/functions/submit-argument/index.ts` lines 386–454 (concession_items / concession_acceptances rollback path)
- **Why it matters:** The QOL-041 contract requires the parent argument to be soft-deleted when a child concession insert fails. This rollback-by-delete is only source-scanned, never executed against a real failure. A regression that silently breaks the rollback (or races with a concurrent read) leaves orphaned parents in the database with no concession lineage, breaking the standing model.
- **Recommended fix:** Add an Edge integration test (Deno or Jest with a mocked Supabase client) that forces a `concession_items` insert failure and asserts (a) the parent row's `status` is actually set to `'deleted'` via service-role update, (b) the response shape signals the rollback, (c) a second, successful insert under the same client does not see the orphaned parent.

#### #2 — `process-language-draft` has zero test coverage despite being deployed
- **Severity / Cost:** HIGH / S
- **Location:** `supabase/functions/process-language-draft/index.ts`
- **Why it matters:** Function is live in production, calls Anthropic, validates debate access, and returns advisory suggestions, yet has zero test files. No verification of debate RLS, `enabled:false` posture when `ANTHROPIC_API_KEY` is absent, provider error containment, or secret-leak guards in logs/response. A provider tier change could leak through the response envelope undetected.
- **Recommended fix:** Create `processLanguageDraftEdgeFunction.test.ts` mirroring the semantic-referee source-scan pattern: assert `verify_jwt` config, RLS check, `enabled:false` fallback when env absent, error envelope shape on provider failure, and a forbidden-token scan (Authorization, ANTHROPIC_API_KEY, raw body) against the response and logs.

#### #3 — `ArgumentGameSurface` (2990 LOC) has no RNTL render coverage
- **Severity / Cost:** HIGH / M
- **Location:** `src/features/arguments/ArgumentGameSurface.tsx`
- **Why it matters:** The highest-traffic Stage 6.x surface (timeline + bubble stack + composer dock + semantic referee banner + observer action rail) has only indirect model coverage. Any prop-wiring, layout, or sub-component integration regression reaches production undetected. The `jest-mocks-asset-requires-web-build-gate` pattern has already bit twice this stage; render tests would catch that class.
- **Recommended fix:** Add `ArgumentGameSurface.integration.test.tsx` with `render()` tests for: (a) minimal-props render, (b) all three sub-components mount, (c) node selection re-renders sidecar, (d) rail collapse/expand state, (e) composer dock visibility, (f) semantic referee banner conditional render. Mock `useAppSession` + `useSemanticReferee`.

#### #4 — `concession_items` / `concession_acceptances` / `move_reactions` SELECT policies inherit visibility loosely
- **Severity / Cost:** HIGH / M
- **Location:** `supabase/migrations/20260522000012_qol_041_concession_acceptance.sql` lines 134–143, 248–257, 322–331
- **Why it matters:** All three policies use a bare `EXISTS` on `public.arguments` without re-enforcing debate visibility. They are safe today only because the arguments SELECT policy still includes the participant/public checks. A future arguments RLS refactor (removing one arm) would silently leak concession + reaction data to non-participants in private rooms.
- **Recommended fix:** Introduce a `SECURITY DEFINER` helper `is_argument_visible(argument_id, user_id)` that mirrors the canonical arguments SELECT arms, then rewrite the three policies to call it explicitly. Pair with a Jest source-scan test (`concessionAccessibilityRlsScan.test.ts`) that flags future arguments RLS edits as requiring a coordinated update.

#### #5 — Anthropic pathway for Families D–J untested end-to-end
- **Severity / Cost:** HIGH / M
- **Location:** `mcp-server/tools/classifyArgumentBooleanObservations.ts` (provider selection branch ~line 613)
- **Why it matters:** Families D–J live in the server and have full fixture coverage, but the real Anthropic prompt-and-validate path has never been exercised in tests. Edge `productionEnabled:false` is the only thing preventing production exposure; the moment an operator flips a family on (admin_validation already routes it), drift between fixture expectations and real Anthropic output ships uncaught.
- **Recommended fix:** Add per-family Anthropic-path tests that set `MCP_SERVER_USE_FIXTURE_PROVIDER=false` and inject a deno fetch mock, asserting (a) prompt structure stability via request-body snapshot, (b) `validateMcpBooleanObservationResponse` acceptance of the canned response, (c) key-level fail-closed activates when the canned response violates the schema.

#### #6 — No deployed end-to-end auth smoke covers sign-up through session restore
- **Severity / Cost:** HIGH / L
- **Location:** Integration layer (`dev-cdiscourse.netlify.app` + Supabase Auth + Edge Functions)
- **Why it matters:** Every auth test mocks Supabase, so a redirect-URL mismatch, RLS regression, or OAuth gate misconfiguration on the deployed surface — the lane that has already failed twice in recent stages (#640/#641 and the Google SSO gate #776) — is invisible until a user reports it. The auth lane is the front door.
- **Recommended fix:** Build `scripts/smoke/auth-full-flow-smoke.ts`: fresh test mailbox, sign-up via Supabase admin API, fetch confirmation link, follow set-password callback, sign-in, persist + restart, verify snapshot restore, sign-out, verify clear. Document the run in `docs/testing-runs/auth-smoke-template.md` and gate on operator credentials.

#### #7 — No end-to-end test from `submit-argument` through scored badges
- **Severity / Cost:** MEDIUM / L
- **Location:** `__tests__/` (no `classifierE2ELifecycle.test.ts` exists)
- **Why it matters:** The lifecycle has strong unit coverage at every node (submit, queue, drainer, classifier, point-standing, qualifiers, provenance), but nothing chains them. A contract break at any seam (e.g., classifier output key renamed, point-standing input schema drifts, qualifier deriver expects a field the classifier no longer produces) survives green CI.
- **Recommended fix:** Create `__tests__/classifierE2ELifecycle.test.ts` that mocks Supabase but runs real `classifyArgumentCore`, the queue routing predicate, `classifierDrainerCore` against an in-memory run row, `pointStandingEngine`, `antiAmplificationScoring`, and `messageQualifiers` in sequence. Assert the final `PointStandingDelta` and qualifier list are coherent.

#### #8 — `ObserverActionDockLayout` pure-model derivers untested
- **Severity / Cost:** MEDIUM / S
- **Location:** `src/features/arguments/ObserverActionDockLayout.ts` (~150 LOC)
- **Why it matters:** SC-005 introduced `deriveDockContext`, `resolveObserverDockVariant`, `resolveSheetMaxHeightPx`, and `buildExpandedDockViewModel` — pure functions that govern the entire mobile vs side-rail dock and its 28% sheet cap. They look like the existing reuse-anchor contract tests (`railActionGrouping`, `ObserverActionDockLayout` cousins) but ship without a test, breaking the project's "pure-model contract test" load-bearing pattern.
- **Recommended fix:** Add `ObserverActionDockLayout.test.ts`: four-way `deriveDockContext` output (observer_no_node, observer_node, participant_own, participant_other); `resolveObserverDockVariant` breakpoint at 768; `resolveSheetMaxHeightPx` bounded at 390/844; `buildExpandedDockViewModel` category grouping + `showHeader` behavior.

#### #9 — `classify_semantic_move` packet-failure path lacks ban-list and error-log audit
- **Severity / Cost:** MEDIUM / S
- **Location:** `mcp-server/tools/classifySemanticMove.ts` lines 148–225
- **Why it matters:** Boolean observations have the comprehensive `classifyArgumentBooleanObservationsToolErrorLog` audit ensuring secrets/payloads never leak. Semantic move has no equivalent — so a regression in `errorResult` or a ban-list miss in `scoreHints`/`reasonCode` would slip a verdict token or a fragment of the request body into Deno logs.
- **Recommended fix:** Create `semanticRefereePacketToolErrorLog.test.ts` that captures Deno log output during synthetic packet-validation failures and ban-list violations (inject `'verdict'`, `'liar'`, `'winner'` into reasonCode and scoreHints). Assert no payload text, no Authorization, no key shapes, and structured `failure_detail` shape matches the audit contract.

#### #10 — `ArgumentTimelineMap` (1405 LOC) has no RNTL coverage
- **Severity / Cost:** MEDIUM / L
- **Location:** `src/features/arguments/ArgumentTimelineMap.tsx`
- **Why it matters:** The branch-lane / strength-band / shape-color visual grammar lives entirely in this component, and the `timeline-grammar` skill governs it as a non-negotiable. `branchGrammarModel` covers the layout model but never confirms a JSX or style prop typo would surface. The first-child-on-parent-lane fix (Stage 6.3) would have been undetectable without manual visual review.
- **Recommended fix:** `ArgumentTimelineMap.test.tsx`: render with a deterministic `branchGrammarModel` fixture; spot-check node testIDs at expected lane positions; assert accessibility labels per node; verify branch collapse/expand changes the rendered count; one 390px viewport variant for mobile.

---

## Cross-cutting findings

1. **Deployed-but-untested pattern.** `process-language-draft`, `cutover-health-monitor` error paths, mcp-server Anthropic path for Families D–J, and the full deployed auth flow are all live in production with mock-only or fixture-only coverage. The mock layer hides any change to the live integration shape.
2. **Mock-vs-bundle divergence is a recurring blind spot.** `jest-expo` asset/`Animated` mocks already let real Metro bundle bugs ship (memory: `jest-mocks-asset-requires-web-build-gate`; #697 AuthScreen lockup; `expo-web-static-env-inlining` and the Google SSO gate). The same risk applies to `ArgumentGameSurface` and `ArgumentTimelineMap`, which have no render coverage and pass-through complex props from real hooks.
3. **Inherited-visibility RLS hazard.** Multiple satellite tables (`concession_items`, `concession_acceptances`, `move_reactions`, `classifier_drain_audit`, possibly `argument_room_links/invites`) delegate visibility to `arguments` or `debates` via bare `EXISTS` without re-asserting the visibility predicate. The schema is safe today but each is a regression trap if `arguments` RLS is touched.
4. **Contract drift between adjacent layers has no end-to-end net.** Edge Function → queue → `classifierDrainerCore` → mcp-server → point-standing → qualifiers all have strong unit/contract coverage but no test chains them, so a renamed field at any seam survives green CI.
5. **Error-envelope hygiene is asymmetric.** `classifyArgumentBooleanObservations` has a full secret-leak + ban-list audit on its error path; `classifySemanticMove` and several Edge Functions only have source scans. The audit pattern needs to be cloned, not just admired.
6. **Accessibility (44px targets, color-independent state, reduce-motion, keyboard nav, screen-reader contract) is asserted ad-hoc** on a handful of rail/dock tests but is not a systematic property of Stage 6.x components — the `accessibility-targets` skill defines a contract the test suite does not enforce.
7. **Pure-model contract tests are CDiscourse's main load-bearing pattern;** new pure models (`ObserverActionDockLayout`) are shipping faster than tests are being authored for them, creating a slow accumulation of unlocked contracts on the highest-leverage layer.

---

## Recommended Phase 4 focus

Bank the highest deployment-impact / lowest-cost gaps first:

1. **Gap 2** — `process-language-draft` contract scan (**S**, eliminates a zero-coverage live function)
2. **Gap 8** — `ObserverActionDockLayout` unit test (**S**, locks a freshly-shipped pure model before drift)
3. **Gap 9** — semantic-referee error-log audit (**S**, clones the already-proven boolean-observation audit pattern)
4. **Gap 4** — concession / `move_reactions` RLS source-scan + helper-function migration prep (**M**, hardens a real cross-private-room data hazard)
5. **Gap 1** — `submit-argument` soft-rollback integration test (**M**, the single CRITICAL gap on the most-fired Edge Function)

The two HIGH client-UI gaps (Gap 3 `ArgumentGameSurface`, Gap 10 `ArgumentTimelineMap`) and Gap 7 (classifier E2E) are higher cost and should be Phase 5. Gap 6 (deployed auth smoke) needs operator credentials and should be scoped separately.

---

## Full per-surface gap inventory (all 50 gaps)

### Client / UI (10 gaps)

| sev / cost | gap | location |
|---|---|---|
| HIGH / M | `ArgumentGameSurface` lacks RNTL render tests | `src/features/arguments/ArgumentGameSurface.tsx` (2990 LOC) |
| HIGH / L | `ArgumentTimelineMap` has no RNTL coverage | `src/features/arguments/ArgumentTimelineMap.tsx` (1405 LOC) |
| MED / S | `ObserverActionDockLayout` model has no unit tests | `src/features/arguments/ObserverActionDockLayout.ts` (150+ LOC) |
| MED / M | `ArgumentSideActionRail` render tests only cover seat-claim disable case | `src/features/arguments/ArgumentSideActionRail.tsx` (645 LOC) |
| MED / M | `ArgumentBubbleStack` / `ArgumentBubbleCard` lack RNTL tests | `src/features/arguments/ArgumentBubbleStack.tsx`, `ArgumentBubbleCard.tsx` |
| MED / L | Mobile viewport regressions not covered for large components | `ArgumentGameSurface.tsx`, `ArgumentTimelineMap.tsx`, `ArgumentComposer.tsx`, `ArgumentComposerDock.tsx` |
| MED / S | Form validation error states lack coverage | `ComposerValidationPanel.tsx`, `ContactInfoSection.tsx` |
| MED / M | Navigation deep-link tests do not cover all Stage 6.x screens | `src/features/debates/deepLinkEntryHint.ts` + nav structure |
| MED / L | Accessibility (a11y) compliance tests sparse and ad-hoc | UI components across `src/features/` (scattered) |
| LOW / XS | Expo Web bundle asset/`require()` mocking may hide runtime errors | `jest.config.js` (jest-expo preset + transformIgnorePatterns) |

### mcp-server (10 gaps)

| sev / cost | gap | location |
|---|---|---|
| HIGH / M | Untested Anthropic pathway for Families D–J | `mcp-server/tools/classifyArgumentBooleanObservations.ts:613` |
| HIGH / M | Semantic referee packet-level failure scenarios not tested end-to-end | `mcp-server/tools/classifySemanticMove.ts:204–225` |
| MED / S | Error envelope sanitization for semantic move not verified (no log introspection test) | `mcp-server/tools/classifySemanticMove.ts:148–158` |
| MED / S | Normalizer Pass 1 (length-overflow) exclusion of Family J not explicitly tested | `mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts:317` |
| MED / S | Cross-family validator isolation not tested | `mcp-server/lib/familyBooleanRequestSchema.ts` (unsupported_rawKey path) |
| LOW / M | Provider concurrency gate edge case: exceeding cap with mixed family requests not tested | `mcp-server/lib/providerConcurrency.ts` |
| MED / S | No end-to-end route test for `/mcp/adapter-compat` error envelopes | `mcp-server/routes/adapterCompat.ts` |
| MED / M | Malformed model response shapes not covered for boolean observations | `mcp-server/tools/classifyArgumentBooleanObservations.ts:673` |
| MED / M | Key-level fail-closed family widening (A–I) post-J not verified | `mcp-server/lib/keyLevelFailClosed.ts:77` |
| LOW / XS | Schema mirror drift (upstream `mcpBooleanObservationSchema.ts`) not caught | `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:38` |

### Supabase Edge Functions (8 gaps)

| sev / cost | gap | location |
|---|---|---|
| **CRITICAL / M** | `submit-argument` soft-rollback atomicity not integration-tested | `supabase/functions/submit-argument/index.ts:386–454` |
| HIGH / S | `process-language-draft` has zero coverage (live in production) | `supabase/functions/process-language-draft/index.ts` |
| HIGH / S | `cutover-health-monitor` error handling not tested (live in production) | `supabase/functions/cutover-health-monitor/index.ts` |
| MED / M | Edge Function RLS-masked errors not tested for no-existence-leak contract | `request-argument-deletion/index.ts:81`, `create-argument-room/index.ts`, `manage-room-invite/index.ts` |
| MED / L | Classifier queue routing predicate (smoke-only) lacks happy-path activation test | `supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts` |
| MED / S | Drainer shared-secret constant-time comparison only source-scanned | `supabase/functions/classifier-drainer/index.ts:53–61` |
| MED / L | No tests for database constraint violations in Edge Functions | All functions using `.insert()` / `.update()` |
| MED / M | Boolean Observation MCP adapter timeout handling not tested end-to-end | `supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts` |

### Supabase Migrations / RLS (7 gaps)

| sev / cost | gap | location |
|---|---|---|
| HIGH / M | `concession_items` and `concession_acceptances` SELECT policies do not enforce debate visibility | `supabase/migrations/20260522000012_qol_041_concession_acceptance.sql:134–143, 248–257` |
| HIGH / M | `move_reactions` SELECT policy similarly lacks explicit visibility enforcement | `supabase/migrations/20260522000012_qol_041_concession_acceptance.sql:322–331` |
| MED / S | No direct integration test for `classifier_drain*` tables RLS isolation | `supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql:240–241` |
| MED / S | No explicit test verifying soft-delete invariant on `argument_flags.status` column | `supabase/migrations/20260516000001_initial_schema.sql:242–270` |
| MED / XS | `argument_deletion_requests` migration relies on `is_admin()` defined in a prior migration | `supabase/migrations/20260517000008_stage6_1_8_argument_deletion_requests.sql:73,81` |
| LOW / S | `argument_room_invites` and `argument_room_links` RLS not explicitly verified by tests | `supabase/migrations/20260521000010_qol042_argument_room_links.sql`, `20260524000013_qol_038_argument_room_invites.sql` |
| LOW / XS | `semantic_referee_runtime_config` + `_config_audit` admin-only RLS untested on GRANT surface | `supabase/migrations/20260522000011_admin_ai_001_semantic_referee_runtime_config.sql` |

### Auth flow (8 gaps)

| sev / cost | gap | location |
|---|---|---|
| HIGH / L | End-to-end auth on deployed surfaces: no smoke test or integration harness | Integration layer (frontend + Supabase Auth + Edge Functions) |
| MED / S | `useAuthSession` hook: no unit or integration tests | `src/features/auth/useAuthSession.ts` |
| MED / S | `AccountScreen` sign-out button: no UI interaction tests | `src/features/account/AccountScreen.tsx` |
| MED / M | Session restoration race condition: no test for token refresh mid-restore | `src/features/session/AppSessionProvider.tsx:42–87` |
| MED / XS | Email confirmation flow: no explicit test for the set-password redirect | `src/lib/auth/parseAuthCallbackUrl.ts` (email_change variant) |
| LOW / M | Rate limiting: no tests or awareness for Supabase SMTP cap | `src/features/auth/authApi.ts` (`signUpWithEmailPassword`, `sendPasswordResetEmail`) |
| LOW / XS | Sign-out error handling: no test for `supabase.auth.signOut()` failures | `src/features/auth/authApi.ts:219–231` |
| LOW / S | Session persistence: no test for `AsyncStorage` failures during restore | `src/features/session/AppSessionProvider.tsx:52` |

### AI features end-to-end (7 gaps)

| sev / cost | gap | location |
|---|---|---|
| MED / L | No production end-to-end test simulating `submit-argument` through scored observation render | `__tests__/` (no E2E test covering full lifecycle) |
| MED / L | Classifier drainer failure paths under high concurrency not tested | `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts` |
| MED / M | Anti-amplification rule coverage lacks adversarial test cases | `antiAmplificationDoctrine.test.ts`, `antiAmplificationScoring.test.ts` |
| MED / S | Point-standing debt eligibility for cross-threaded repair not tested | `pointStandingEngine.test.ts` |
| LOW / S | Engagement intelligence lexeme detection undersensitivity on negation | `src/features/engagementIntelligence/agreementScalar.ts` |
| LOW / XS | Message qualifier rendering in UI lacks snapshot test against ban-list | `src/features/arguments/messageQualifiers.ts`, `cardClassifierStripModel.ts` |
| LOW / M | MCP server provider concurrency cap (C=3) not validated under load | `mcp-server/lib/providerConcurrency.ts` |

---

## Methodology

- **Workflow ID:** `wf_838c3341-c36`
- **Agents:** 6 parallel `Explore`-subagent reviewers + 1 synthesizer (7 total)
- **Agent token spend:** ~612K
- **Duration:** ~11 minutes
- **Boundary:** Read-only. No code edits, no commits during the audit phase. All sources inspected with Read/Grep/Glob.

## Status

This audit was produced by a multi-agent workflow as part of a Phase 1–4 comprehensive testing sweep (Phase 1 = production smoke ✅, Phase 2 = this audit ✅, Phase 3 = manual E2E pending, Phase 4 = implement gap fixes in progress). Top-10 gaps each receive their own GitHub tracking issue alongside this report.

## Preservation manifest for this audit

- No code edits.
- No commits during the audit phase (audit report itself is committed in a separate `docs(audits)` commit referenced by Top-10 tracking issues).
- No provider spend beyond the workflow's agent-token usage.
- No production traffic, no submit-argument, no D3 / D4 advance.
- No env / secret / cron / routing mutation.
- No `productionEnabled` flip.
- No raw payloads, secrets, or tokens printed.
