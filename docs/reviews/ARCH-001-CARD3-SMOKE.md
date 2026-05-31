# ARCH-001-CARD3-SMOKE — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Branch:** audit/ARCH-001-card3-smoke
**HEAD:** 23976105f50c27e380960b1d3b876bf04733f88f
**Audit doc:** docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md (+239 lines, single file)
**Implementation reference:** PR #383 (`d42d6da`) — already merged to main
**Comparator audit:** docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md (commit `d43b3b1` on open PR #381 branch, not yet on main)

## Summary

Audit-only PR documenting the live smoke verification of Card 3's tuning under sustained burst. The narrative is internally consistent, the cited deltas vs Card 2 reconcile exactly with the published numbers, the doctrine + secret posture is clean, and the cited deterministic-coverage tests (Card 2A finalizer + queue-functions-shape) exist on main and pass. No code change; no migration; no Edge-Function change; no test change. Approve and merge.

## Verification

| Check | Result |
|---|---|
| `git rev-parse --show-toplevel` | C:/Users/kyler/cdiscourse/debate-constitution-app ✅ correct worktree |
| `git status -sb` | branch=audit/ARCH-001-card3-smoke, 0/0 vs origin, only pre-existing operator-untracked files |
| `git diff --stat main..HEAD` | 1 file changed, 239 insertions(+); only `docs/audits/ARCH-001-CARD3-SMOKE-2026-05-31.md` |
| `npm run typecheck` | exit 0 ✅ |
| `npm run lint` | exit 0 ✅ |
| `npm test -- --testPathPattern=archOne` | 12 suites / 300 tests passed, exit 0 ✅ (spot-check; doc-only PR has no test impact) |
| `node scripts/ops/audit-lint.mjs` on the doc | exit 0, **0 findings, PASS** ✅ |
| Secret scan over the diff | clean — no Authorization-header value, no JWT shape, no sk-ant / sb_secret / xai- prefixed value, no email address (other than the commit footer which `git diff` does not emit), no service-role key value. `ANTHROPIC_API_KEY` and `SERVICE_ROLE_KEY` appear ONLY inside a clean-scan self-attestation row and a "no service-role usage" assertion |
| Doctrine token scan over the diff | clean — every grep hit (`true`/`false`/`Bearer`) resolves to config-state (`active=true`, `productionEnabled=false`, `ok=true status=200`, `failure_reason=…`) or a verification description (`wrong-Bearer POST = 401`). Zero person-judgment language. Zero verdict tokens. |
| Migration apply | N/A — audit doc only; explicit "no new Card 3 migration" assertion present in A1 row of Phase A and in "Card 3 invariants honored" §; verified empty against `git diff --stat`. |

## Metric consistency — recomputed independently

| Audit claim | Recomputed | Verdict |
|---|---|---|
| Dead-letter rate 1/112 = 0.893 % | 1/112 = 0.8929 % | ✅ exact |
| Card 2 baseline 3/105 = 2.86 % | 3/105 = 2.8571 % | ✅ rounds correctly to 2.86 % |
| Reduction 1.97 points | 2.8571 − 0.8929 = 1.9642 | ✅ rounds correctly to 1.97 |
| Kick coalescing 84.82 % reduction | 1 − 17/112 = 84.8214 % | ✅ exact |
| Card 2 baseline kick rate 7/submit | 112/16 = 7.0000 | ✅ exact |
| Card 3 kick rate 1.06/submit | 17/16 = 1.0625 | ✅ rounds correctly to 1.06 |
| Dead-letter lifetime 795 s vs [60,180,360] s + MAX=4 schedule | Schedule sum: 60+180+360 = 600 s base + classify-time + cron-tick alignment → 795 s observed is internally consistent (~195 s residual matches classify + tick window) | ✅ consistent |
| Card 2 dead-letter band 303–418 s vs [30,120] s + MAX=3 | Schedule sum: 30+120 = 150 s base + classify + tick → 303–418 s observed cross-reference from Card 2 audit on `pr-381-card2-audit` branch | ✅ consistent |
| Attempt-2 recovery cohort lifetime 141–199 s vs [60] s + classify | 60 s + classify-window 80–140 s → 141–199 s observed | ✅ consistent |
| Attempt-3 recovery cohort lifetime 396–430 s vs [60,180] s + classify | 60+180=240 s + cron-tick + classify → 396–430 s observed | ✅ consistent |
| Provider RPM 1.44 sustained / 44 peak vs Tier-1 Haiku 50 RPM ceiling | 1.44 sustained well below 50; 44 peak instantaneous below 50 | ✅ ceiling unapproached |
| Submit p95 warm 1800 ms | Within Card 2's published 1.4–2.4 s warm band | ✅ consistent with prior baseline |

All cross-references verified against the comparator Card 2 audit text in commit `d43b3b1` (on `audit/ARCH-001-card2-smoke`).

## Design conformance — audit-doc shape

- [x] Matches Card 2 audit doc shape (Phase A preflight, Phase B routing enable, Phase C canary, Phase D burst, Phase E reclaim-vs-finalize, Phase F doctrine scan, Phase Z adversarial refutation, Final verdict, Closeout, Artifacts).
- [x] Phase Z (8 agents, all returned NO_REFUTATION) covers the same refutation classes the Card 2 audit asserted as G1/G2/G3 plus extras (H/I/J presence, direct-dispatch, overlap, taxonomy, warm-submit threshold, banned-token spans, leak-column footprint).
- [x] Cited PRs and SHAs resolve correctly: Card 3 merge `d42d6da` (verified via `git log main`), review-inline `6685817`, doc-drift `68a146b`. Card 1/2A/2 substrate PRs (#375/#377/#379) and cron-template fix (#380) all on main.
- [x] Cited source-line anchors map to real declarations: `DRAINER_MAX_ATTEMPTS = 4` (audit cites L48, actual L53 in `classifierDrainerRetryPolicy.ts` — minor drift from the doc-fix commit `68a146b`; not load-bearing), `DRAINER_PROVIDER_SERVER_ERROR_BACKOFF_SECONDS = [60, 180, 360]` (audit L79 — exact), `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV` (audit L72 — exact in `classifierQueueRouting.ts`), submit-argument env read at L815 (audit L811-816 — exact).

## Doctrine self-check

- [x] **No verdict tokens in user-facing or narrative spans.** Every `true`/`false`/`Bearer` grep hit is config-state or a verification description; zero person-judgment language across 239 added lines.
- [x] **Score-vs-truth distinction respected.** The audit describes structural outcomes (dead-letter rate, kick coalescing, retry recovery counts, lifetimes); it never assigns truth or correctness to any argument body or to any author.
- [x] **No service-role usage in client code.** Phase Z6 / Card 3 invariants explicitly assert "No service-role usage in any client code." Diff confirms only Edge-side and DB-side constants were exercised.
- [x] **No direct insert into public.arguments.** All cited submits go through `submit-argument`. The 16 burst args + canary used the throwaway harness at `.claude-tmp/queue-smoke-submit.cjs` (gitignored), which the audit explicitly names; this harness calls the production Edge Function, not a direct insert.
- [x] **No AI calls in production app paths.** Card 3 changes are queue tuning + routing knob; classifier calls remain MCP-mediated via the existing classifier-drainer Edge Function, not the production app surface.
- [x] **Plain language only.** Internal codes (`provider_server_error`, `mcp_api_error`, `retry_attempts_exhausted`, `skipped_single_flight`, `productionEnabled`) appear in the audit narrative as factual operational labels, not user-facing strings.
- [x] **Doctrine `evidence_span` scan claim is itself doctrine-clean.** "185 spans across argument_scheme(52) / critical_question(97) / evidence_source_chain(35) / resolution_progress(1); 0 banned tokens" is a structural count, not a verdict.
- [x] **Epic-specific (supabase-edge-contract).** Card 3 implementation respects the no-service-role-in-client rule (verified at PR #383 review time); the audit doc echoes this in Card 3 invariants honored and Z6. RLS not touched; no migration in Card 3 or this audit.
- [x] **Test discipline.** The audit cites Card 2A Jest suites for deterministic coverage of the finalizer/single-flight race. Cited files exist on main and pass:
  - `__tests__/archOneCardTwoAFinalizerMigration.test.ts` ✅
  - `__tests__/archOneCardTwoAFinalizerVerifyScript.test.ts` ✅
  - `__tests__/archOneClassifierQueueFunctionsShape.test.ts` ✅
  All 12 archOne-pattern suites pass cleanly (300 tests, 2.62 s).

## Test coverage — audit-doc PR

- [x] Doc-only PR; no test change required.
- [x] The audit explicitly cross-references deterministic test coverage (Card 2A suites) for the race it could not exercise as a two-session psql check. This is the right pattern — live-evidence + cited tests, rather than claiming a check that wasn't run.

## Blockers

None.

## Suggestions (non-blocking)

1. **Card 2 comparator-audit availability.** The audit doc cites `docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md` as already on main, but the comparator audit (commit `d43b3b1`) is on the open PR #381 branch and has not landed on main. Verification was possible because the commit is reachable from `audit/ARCH-001-card2-smoke`, but a reader following the audit's narrative on main today won't be able to open the cited Card 2 file. Two clean options:
   - Merge PR #381 (Card 2 audit) first so the cross-reference resolves on main when this Card 3 audit lands.
   - Add a one-line footnote to this Card 3 audit noting the Card 2 audit lands separately as PR #381.
   - Either works; not a blocker because the citation is exact and the Card 2 numbers are the public truth.
2. **Audit-lint verdict-line extraction.** `node scripts/ops/audit-lint.mjs` reports `verdict: <none>` despite the doc containing "**Verdict: PASS.**" on lines 12 and 197. The lint passes regardless (0 findings), and prior Card 2 audit had the same shape. If the operator wants a tighter verdict-tag contract, the audit-lint extractor (`scripts/ops/audit-lint-lib.cjs`) could be extended in a separate OPS card; out of scope here.
3. **Minor line-number drift on `DRAINER_MAX_ATTEMPTS`.** Audit cites L48, actual L53 in `classifierDrainerRetryPolicy.ts`. Drift is caused by the doc-drift fix commit `68a146b` cited in the audit's own front matter, which expanded the file-level JSDoc summary. The constant value (`4`) is what the audit's claims rest on, and it's correct; the line number is presentational. No action required; just noting for future-audit hygiene.
4. **Phase A4 / Phase A1 migration-naming sanity.** Phase A1 cites the latest migration as `20260528000023`; Card 3 added no migration. Both claims verified against the substrate Card 1/2A/2 migrations on main. If Card 3's `npx supabase db push --linked` had silently appended a migration, this audit would have caught it. No migration footprint observed — good.

## Operator next steps

1. **Push branch (if not already on origin):**
   ```
   git push -u origin audit/ARCH-001-card3-smoke
   ```
2. **Open PR.** Title: `audit(ARCH-001 Card 3 smoke): PASS — re-burst under new tuning closes the architecture chain`. Body can reference this review doc.
3. **Merge order.** If PR #381 (Card 2 audit) is still open, the cleanest merge order is #381 first, then this PR — so the in-doc citation `docs/audits/ARCH-001-CARD2-SMOKE-2026-05-31.md` resolves on main.
4. **Operational follow-ups (already correctly identified as non-Card work in the audit):**
   - Staged-percentage rollout of `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` from 0 → 1 → 5 → 25 → 100 (one operator action + observation window per step; no roadmap card).
   - Family H planning is its own decision; ARCH-001 closes here.
5. **Routing flag.** Per audit Closeout §1, the operator already ran `npx supabase secrets set CLASSIFIER_QUEUE_ROUTING_ENABLED=false` at end of smoke. Confirm in Supabase Edge Functions → Secrets that the flag is back to `false` for ordinary submits.
