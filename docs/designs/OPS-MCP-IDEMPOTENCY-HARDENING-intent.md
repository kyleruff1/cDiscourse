# OPS-MCP-IDEMPOTENCY-HARDENING — operator-authored intent brief

**Status:** Intent (binding source for the designer subagent)
**Epic:** OPS — operational integrity
**Predecessor chain on main:**
- `OPS-MCP-TEST-DATA-CLEANUP-SMOKE PASS` at `b8ce07b` (synthetic test rows removed)
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE PASS` at `19b8d8a` (Q12 is clean signal)
- `OPS-MCP-OBSERVABILITY-SMOKE PARTIAL` at `0e98c27` (originally surfaced the Q9 finding)
- Family A auto-trigger production-live at `e281753`

---

## 1. The Q9 finding (verbatim from live DB at brief authoring)

The OBSERVABILITY smoke at `0e98c27` surfaced 3 duplicate-run pairs. Phase 0 of this card re-verified them post-cleanup against the live DB at `b8ce07b`. The 3 pairs are **unchanged** (the test-data cleanup did not affect them):

### Binding row inventory (timestamps + payloads)

**Pair 1 — argument_id `781f8057-9e2a-4fa9-92a8-469676950ff7`, admin_validation, parent_relation**

| run_id | started_at | duration | input_hash |
| --- | --- | --- | --- |
| `67431fe3-5e29-4c38-8fc3-96c6f59467fa` | 2026-05-27 02:03:37 | 5s | `mcp-6b8c1717` |
| `c8f09f4d-8cb5-44df-b925-1d428f73d24f` | 2026-05-27 10:29:26 | 5s | `mcp-6b8c1717` |

Gap: **8 hours 26 minutes**. input_hash identical (same payload). Pattern: deliberate re-smoke across two operator sessions.

**Pair 2 — argument_id `db0de3e0-24c6-40af-ba5f-2844acfa5bac`, admin_validation, parent_relation**

| run_id | started_at | duration | input_hash |
| --- | --- | --- | --- |
| `f370e813-1f80-4b40-8bc1-7a4d71c59489` | 2026-05-27 02:03:43 | 5s | `mcp-74f33f46` |
| `0263205e-cc71-4116-bbf0-7d19b86d75c5` | 2026-05-27 10:29:31 | 5s | `mcp-74f33f46` |

Gap: **8 hours 26 minutes**. input_hash identical. Same re-smoke pattern as Pair 1.

**Pair 3 — argument_id `ea82a836-f5d2-4ece-bd34-ed5a57409dde`, production, parent_relation**

| run_id | started_at | duration | input_hash |
| --- | --- | --- | --- |
| `a416c21a-bc06-4446-9902-7112ff59ff37` | 2026-05-27 05:17:04 | 5s | `mcp-ee68e3c3` |
| `7ea35268-4caf-4621-b8a5-65e99f8aaa9a` | 2026-05-27 05:19:15 | 5s | `mcp-ee68e3c3` |

Gap: **2 minutes 11 seconds**. input_hash identical. **This is the BINDING production-mode finding.**

All 6 runs use `provider_key='mcp:classify_argument_boolean_observations'` + `model_name='operator-mcp-server'` (real production provider).

---

## 2. Pre-RCA observations (designer Phase A.1 verifies and may amend)

The Phase 0 inventory above is the operator's pre-RCA reading. The designer subagent's Phase A.1 RCA is the BINDING analysis; the operator's pre-reading is offered as a starting point only.

### Operator's pre-reading (designer may override with deeper RCA)

**Pairs 1 + 2 (admin_validation):** likely Cause C — Test-driven duplicates.
- Reasoning: 8+ hour gap is too long for any retry / race / idempotency-key collision; identical input_hash means same payload was deliberately re-submitted.
- These pairs correspond to deliberate operator re-runs of the same admin_validation smoke against the same 3 seeded args across multiple Family-N smoke sessions (Family A prod, AUTO-TRIGGER A, Family B, Family C).
- Likely operationally fine but contaminate the Q9 signal.

**Pair 3 (production):** likely Cause A or D — User-driven or race-condition duplicate.
- Reasoning: 2-min-11-sec gap is too short for "user retried after seeing failure" (both succeeded in 5s).
- Identical input_hash means the same exact payload was submitted twice.
- 2-min gap is too long for a single client's retry burst but consistent with: (a) user submitted same content twice (Cause A), or (b) two browser tabs / two clients submitted simultaneously (Cause D-light).
- The auto-trigger fires on argument submission; if the argument was submitted twice with same content, the trigger fires twice → 2 production-mode runs.
- However: the `arguments` table likely has UNIQUE constraints preventing duplicate argument INSERTs (designer verifies). If the argument row is single, but the auto-trigger fires twice (e.g., from a retry inside the Edge Function), that's Cause B.

### Cause hierarchy (designer Phase A.1 ranks by evidence strength)

The 5 cause categories from the launch text:
- **Cause A** — user-driven duplicate submission
- **Cause B** — retry after transient Anthropic API failure
- **Cause C** — test-driven duplicates (admin re-smoke; not a system bug)
- **Cause D** — race condition (concurrent submission)
- **Cause E** — idempotency-key collision

Phase A.1 designer must pick at least one primary cause for the production pair (the binding finding) with explicit evidence from:
- Source code reading (`supabase/functions/submit-argument/index.ts` for auto-trigger; `supabase/functions/classify-argument-boolean-observations/index.ts` for the classifier Edge Function)
- Database state (any retry/error context on the runs; `arguments` table UNIQUE constraints; auto-trigger invocation logs if any)
- Reasoning from timestamps + payload identity

---

## 3. RCA-first methodology (Decision 1 from launch)

The designer's Phase A.1 MUST:
- Re-verify the 3 pairs from §1 against live DB (designer subagent has DB access via `npx supabase db query --linked`)
- Read each pair's surrounding context (start/complete timestamps; payload identity; any user attribution if available)
- Read the auto-trigger source code at `supabase/functions/submit-argument/index.ts`
- Read the classify-argument-boolean-observations Edge Function at `supabase/functions/classify-argument-boolean-observations/index.ts`
- Read the `arguments` table schema for INSERT idempotency constraints
- Hypothesize cause(s) per pair; rank by evidence strength
- Document RCA findings in design doc

Phase A.1 RCA is the BINDING analysis. HALT trigger 1 catches RCA-skip.

---

## 4. Fix-approach selection (Decision 2)

After RCA, designer proposes ONE primary fix appropriate to the identified cause:

| If cause | Fix surface | Code surface | Risk |
| --- | --- | --- | --- |
| **A — User-driven** | UI debounce + Edge idempotency check | src/ + supabase/functions/ | UI-only fix doesn't help non-UI clients |
| **B — Retry-driven** | Edge Function idempotency key (request-hash based) | supabase/functions/ | retry-key generation must be correct |
| **C — Test-driven** | Observability filter (label test runs differently) OR no system change | scripts/ops/sql/ filter | low risk; just hygiene |
| **D — Race condition** | DB UNIQUE constraint OR distributed lock | supabase/migrations/ + supabase/functions/ | UNIQUE constraint causes second concurrent insert to fail loudly; must handle gracefully |
| **E — Key collision** | Better key generation (UUID/ULID/request hash) | supabase/functions/ | must verify no downstream consumer depends on old key shape |

The designer's recommendation is the operator's Stage 2B decision input.

---

## 5. Stage 2B operator-decision wrapper (Decision 3)

After Phase A delivers RCA + fix proposal, the pipeline HALTs at Stage 2B and surfaces an explicit "Operator: approve / override / request deeper RCA / split" message. Implementer does NOT start until the operator chooses.

The Stage 2B message must include:
- **RCA findings** (verbatim per-pair analysis)
- **Primary cause identified** (Cause A/B/C/D/E with evidence)
- **Designer recommended fix** (with code surface + test forecast + risk profile)
- **Alternative fix considered + rejected** (with reasoning)
- **Operator options:**
  - `"approve"` — proceed with designer's recommendation
  - `"override <X>"` — proceed with alternative X
  - `"request deeper RCA <reason>"` — designer redoes Phase A.1
  - `"split into smaller cards"` — defer to next session

---

## 6. Preserve auto-trigger production behavior (Decision 4)

The fix MUST preserve Family A auto-trigger production behavior:
- Auto-trigger fires on new argument submissions
- Edge Function still posts to hosted MCP
- Results still land in persistence
- Source 6 still reads production rows

The fix is about deduplication or prevention, **not disablement**.

HALT trigger 18 catches accidental auto-trigger disablement.

---

## 7. Idempotency check granularity (Decision 5)

The fix's idempotency boundary is:

**`(argument_id, family, run_mode)` tuple**

Reasoning:
- `argument_id`: natural argument identifier.
- `family`: same argument may be classified across multiple families; each is independent.
- `run_mode`: production runs and admin_validation runs are semantically distinct; they should NOT collide.

This three-tuple is the dedup key regardless of approach (UI debounce, Edge check, DB constraint, distributed lock).

A `schema_version` and `provider_key` and `model_name` are NOT part of the dedup key because:
- `schema_version` changes only with major schema migrations (when it changes, all prior runs are obsolete by definition).
- `provider_key` distinguishes production providers from test providers (post-cleanup, only one real provider exists per family).
- `model_name` is a sub-detail of provider; not a semantic boundary.

---

## 8. Backward compatibility (Decision 6)

The fix must work with:
- **The 3 existing duplicate-run pairs** — treated as historical; not retroactively fixed by this card.
- **Future single submissions** — must succeed.
- **Future legitimate duplicates** — admin re-runs, retries on failure must have a documented bypass.

Future legitimate duplicates need a bypass. Designer Phase A.3 documents how:
- Admin override flag (e.g., `force_rerun=true`)
- Specific run-mode that bypasses (e.g., `admin_revalidate` — distinct from current `admin_validation`)
- Time-window expiry (e.g., dedup only within last 60s; legitimate re-runs after 60s are allowed)
- OR explicit "force" parameter at the Edge Function call site

Designer picks one and justifies.

---

## 9. HALT triggers (24)

Any ONE fires a HALT.

### RCA + decision (1-6):
1. Phase A.1 RCA does not identify a primary cause for the production pair (designer must pick at least one; "could be multiple" acceptable but each investigated).
2. Phase A.2 fix approach does not address the identified cause.
3. Designer Phase A skips RCA and proposes a generic fix.
4. Stage 2B operator approval missing when implementer starts.
5. Multiple fixes proposed without operator picking one.
6. Fix proposes addressing causes not surfaced by RCA (scope creep).

### Data safety (7-10):
7. Migration deletes existing run rows (future-prevention only; existing duplicates stay).
8. Database constraint changes break ON DELETE behavior.
9. Auto-trigger logic change affects Family B/C admin_validation path (out of scope; only Family A auto-trigger has duplicates).
10. Source 6 filter changes (out of scope).

### Protocol + security (11-14):
11. Idempotency key includes sensitive data (argument body, user PII).
12. Lock implementation introduces deadlock potential.
13. Retry-logic change introduces silent-failure modes.
14. Edge Function timeout-budget changes that affect other features.

### Architecture (15-19):
15. Fix introduces a new external dependency (Redis, etc.) without prior approval.
16. Schema migration introduces a non-backward-compatible breaking change.
17. Existing test data invalidated by fix.
18. Family A auto-trigger logic disabled to prevent duplicates (would break production).
19. Test forecast > +150 (this is M-L; +30 to +80 expected; +120-150 only if fix involves significant architectural change).

### Doctrine (20-22):
20. Verdict tokens in user-facing strings.
21. Idempotency error messages expose internal state in user-visible surface.
22. Source 6 affected by idempotency check (Source 6 reads finished rows; should not be touched).

### Working tree (23-24):
23. Unclassified untracked files at PR creation.
24. Migration script committed to repo `scripts/` (must be `supabase/migrations/` if schema-related).

---

## 10. Required Phase A audits (4)

### A.1 — RCA on 3 duplicate pairs (BINDING)
- Re-verify all 3 pairs against live DB.
- Read each pair's timestamps + payloads + provenance.
- Read `supabase/functions/submit-argument/index.ts` to understand auto-trigger pattern.
- Read `supabase/functions/classify-argument-boolean-observations/index.ts`.
- Read the `arguments` table schema for INSERT idempotency.
- Determine cause hierarchy (which cause has strongest evidence for the production pair).
- Document each pair's individual root cause.

### A.2 — Fix approach selection (BINDING)
- Based on RCA, propose ONE primary fix appropriate to the identified cause.
- Document alternative considered + rejected.
- Map fix to code surface (which files change, how many).
- Document test forecast.
- Document risk profile.

### A.3 — Backward compatibility plan
- How does the fix handle legitimate duplicates (admin re-runs, retries)?
- How does the fix handle the 3 existing duplicates (do nothing; they're historical)?
- Pick a bypass mechanism (override flag, separate run_mode, time-window, etc.) and justify.

### A.4 — Test plan + smoke plan
- Test cases per chosen approach.
- Smoke phases (8-phase if fix surface is substantial; smaller if minimal).
- Risk-of-FAIL scenarios.

---

## 11. Test forecast

- Cause C-only fix (observability filter): +10 to +20.
- Cause A fix (UI debounce + Edge check): +30 to +50.
- Cause B fix (retry-key idempotency): +40 to +70.
- Cause D fix (DB UNIQUE + Edge graceful handling): +50 to +80.
- Cause E fix (key generation rework): +30 to +60.

HALT at +150 (well above any expected cause-specific forecast).

Run gates:
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability|opsMcpTestDataCleanup|opsMcpIdempotencyHardening)" --no-coverage`
- `cd mcp-server && deno test --allow-net --allow-env --allow-read` (regression sanity; mcp-server should remain byte-equal)

---

## 12. Smoke plan

8-phase post-merge smoke audit at `docs/audits/OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE-<date>.md`:

### Phase 1 — Pre-flight (HEAD + functions + DB)

### Phase 2 — Observability report
- Q9 still shows the 3 historical duplicates (this card doesn't retroactively fix them).
- Q9 must NOT show NEW duplicates created after the merge SHA timestamp.

### Phase 3 — Idempotency positive test
- Submit same argument via 2 concurrent calls.
- One succeeds; one rejects gracefully (no duplicate run).

### Phase 4 — Single-submit happy path
- Submit new argument.
- Auto-trigger fires.
- ONE run created.

### Phase 5 — Legitimate duplicate bypass
- Admin runs forced re-classify with appropriate flag.
- System allows the second run.

### Phase 6 — Family B/C admin_validation regression
- Family B + C admin_validation paths still work.

### Phase 7 — OPS observations

### Phase 8 — Verdict + authorization

### Verdict rules

**PASS:**
- Q9 shows no NEW duplicates since merge.
- Idempotency holds on concurrent same-arg submissions.
- Auto-trigger still works.
- Legitimate duplicates can be re-run via documented bypass.
- B/C admin_validation works.

**FAIL:**
- New duplicates surface.
- Auto-trigger broken.
- Race condition still reproducible.

---

## 13. Authorizations granted on PASS

If smoke PASS:
- `OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE: PASS`.
- Auto-trigger system hardened.
- `MCP-SERVER-005-FAMILY-D` is NEXT (with Stage-2B operator decision on subset filter; observability + Q9-clean baselines available as reference).
- `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` authorized (can ship before D if operator prefers).

If smoke FAIL:
- File `OPS-MCP-IDEMPOTENCY-HARDENING-FIX`.
- Family D delayed until idempotency confirmed.

---

## 14. Brief ledger

| Artifact | Why it matters |
| --- | --- |
| `docs/designs/OPS-MCP-IDEMPOTENCY-HARDENING.md` | Designer's RCA + binding plan + Stage 2B recommendation |
| `supabase/functions/submit-argument/index.ts` | Auto-trigger source code (READ ONLY for designer; possibly modified by implementer per chosen fix) |
| `supabase/functions/classify-argument-boolean-observations/index.ts` | Classifier Edge Function (READ ONLY for designer; possibly modified by implementer) |
| `supabase/migrations/<timestamp>_ops_mcp_idempotency_hardening.sql` | NEW (only if fix is Cause D or includes DB constraint) |
| `__tests__/opsMcpIdempotencyHardening*.test.ts` | Coverage |
| `docs/audits/OPS-MCP-IDEMPOTENCY-HARDENING-SMOKE-<date>.md` | Post-merge audit |

---

## 15. Execution order

1. Phase 0 pre-flight (DONE; 3 duplicate pairs + timestamps captured above).
2. Stage 0 — commit + push this intent brief to `main`.
3. Phase B — create `feat/OPS-MCP-IDEMPOTENCY-HARDENING` branch + GitHub issue.
4. Stage 1 — spawn roadmap-designer subagent (Phase A.1 RCA + A.2 fix proposal + A.3 backward compat + A.4 test plan).
5. Stage 2A — conditional HALT evaluation against the 24 triggers.
6. **STAGE 2B — MANDATORY operator-decision checkpoint** (RCA-driven fix proposal). Pipeline HALTs here.
7. Stage 3 — implementer (per operator Stage 2B approval).
8. Stage 4 — reviewer.
9. Stage 5 — PR + squash-merge + post-merge gates.
10. Post-merge smoke (8-phase).
