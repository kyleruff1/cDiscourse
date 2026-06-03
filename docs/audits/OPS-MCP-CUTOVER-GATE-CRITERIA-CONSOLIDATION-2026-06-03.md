# OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION — audit (2026-06-03)

Audit-Lint: v1
Audit-type: ops
Doctrine-risk: false — this audit names family/gate terms (`critical_question`, `argument_scheme`, PASS-LOAD, etc.) only as documentation targets for a gate-criteria normalization. It inspects no classifier `evidence_span` output, assigns no truth/winner/loser/correct/false label to any person, post, or claim, and changes no classifier behavior. The L5 doctrine surface is untouched.

## Scope / boundary attestation

**Docs-only and read-only at the boundary. Authorizes nothing.**
- NO Anthropic / xAI / X API call; NO provider invocation; NO Supabase **write**; NO routing/env/secret mutation; NO smoke / canary / N=8 burst; NO Deno Deploy push; NO MCP runtime source change; NO Edge / migration change; NO validator / ban-list / familyRegistry / retry-policy / drainer-constant / prompt / package change; NO H/I/J enablement; NO 5% authorization.
- The ONLY mutations: created two named docs (this audit + `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`) and made surgical reconciliation edits to six named existing docs (below).
- **Leak-safe SQL: N/A.** This card performed **doc scans** (read-only file reads), not DB queries. Phase 0 ran read-only, metadata-only DB **state** checks (counts of non-terminal rows, H/I/J rows, cron active flags, a routing-secret digest) — no row content, no body / `evidence_span` / prompt / payload / secret value was read or recorded.

## Governance

Runs under the CDiscourse Pipeline Governance Contract v1 as restated in the authoring card. **`pipeline-governance-contract.md` is not present in the repo at HEAD `a65f4b8`** (verified by glob in Phase 0); this card follows the card's inline restatement of §3 (HALT), §4 (never-self-approve), **§4-T (no normalization may lower a gate bar)**, and **GATE C (operator read before merge — this PR does NOT auto-merge)**.

## Why consolidation was needed

A read-only Understand scan of 14 cutover docs surfaced **21 contradictions** in how the project describes its verification/ramp gates, plus **5 places where a looser reading would lower a bar**. The load-bearing ambiguities:

1. **Dead-letter bar stated three+ ways** — "PASS ≤1%", skeleton "PASS ≤1.79%", PASS-LOAD criterion "all 56 succeed (0 dead-letter)", and "isolated provider-side dead_letter tolerated". At N=56, `1/56=1.79%>1%`, so a single dead-letter both passes a "≤1.79%" reading and fails "all 56 succeed". A future drill could be admitted to PASS-LOAD on the looser reading.
2. **The 62/63 Family-F verification run** sits adjacent to PASS-LOAD "56/56" language and could be misread as a clean global PASS-LOAD (it is a target-mitigation pass with a separate within-budget provider-side Family-E transient).
3. **The lone `9ef5aab5` dead-letter** was typed "provider-side 5xx" in the Stage-1 audit verdict sections and corrected to "packet-shape residual" in §12 — and was simultaneously cited in the A-G roadmap as the *exemplar* of a tolerated provider-5xx, contradicting its own §7 disposition.
4. **Ramp framing** — an ARCH-001 "0→1→5→25→100 ladder, each step one secrets set" vs the Stage-1 closeout "launch-time decision, not a scheduled ladder".
5. **PASS-STAGE-1 vs PASS-STAGE-1-PLUMBING** used interchangeably, though PLUMBING is strictly weaker (organic=0) and cannot precede a 5% proposal.
6. **Provider-cluster FAIL** defined two ways (SQL "≥2 in one family AND >1 family" vs operator gate "any family ≥2") — the single-family `argument_scheme=3` original FAIL signature is a FAIL only under the operator gate.
7. **Synthetic-only H authorization** vs the P1 real-organic precondition for un-freezing Family H.

## The normalized taxonomy

The canonical reference is **`docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`**. Précis:

- **Gate taxonomy (§A):** targeted mitigation verification · synthetic PASS-LOAD · PASS-LOAD-CONFIRM · synthetic launch qualification (PASS/PARTIAL/FAIL) · Stage-1 plumbing pass · organic Stage-1 pass — with, for each, the pass condition and what it does **not** authorize.
- **Threshold reconciliation:** PASS-LOAD = **0 terminal dead-letters at N=56**; the "≤1%"/"≤1.79%" bands are non-operative for admission (no non-zero budget introduced).
- **Failure taxonomy (§B):** provider-side transient (`validator_path=null`) vs packet/schema residual (`validation_failed`+`packet_invalid`+`evidenceSpan.*`); cluster thresholds (isolated transient · deterministic same-path packet · repeated terminal · provider/server cluster = single family ≥2). `#432 failure_detail` is the canonical residual-classification source.
- **Authorization rule (§C):** no targeted-mitigation / PASS-LOAD / launch-qual / PLUMBING pass authorizes 5%; only an organic Stage-1 pass (or an operator-accepted synthetic soak with a stated budget) does. The `1→5→25→50→100` sequence is an allowed order, not an automatic ladder.

## Files updated

**Created (2):** `docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md` (canonical) · this audit.
**Edited (6, surgical, allowlist only):**
- `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-STAGE-1-2026-06-02.md` — §0 (line 38) + §11 (line 202) annotated by correction (provider-side → packet-shape; preserves history); §0/§11/§12/§13 now one consistent story.
- `docs/core/known-blockers.md` — moved the two RESOLVED items (residual floor + Family-F dead-letter; `failure_detail` persistence) out of ACTIVE BLOCKERS into a "Recently resolved cutover residues (2026-06-03)" subsection; renumbered ACTIVE 1–6 (routing-ramp · H/I/J · deps · API-key · Docker · Deno mirror).
- `docs/roadmap-expansions/2026-06-02-mcp-A-G-stability-roadmap.md` — corrected the tolerated-provider-5xx exemplar (was `9ef5aab5`, now a `validator_path=null` cell); added a top-of-doc canonical pointer + required wording.
- `docs/core/current-status.md` — added a top-of-doc canonical pointer + required wording.
- `docs/designs/OPS-MCP-FAMILY-F-UNSTATED-ASSUMPTION-SHAPE-TUNING.md` + `docs/reviews/...` — added the "target-mitigation pass, not a global PASS-LOAD" required wording + canonical pointer.

**Not edited (off the existing-doc allowlist):** FORTIFIED-ARCHITECTURE(.md/-STATUS), the H-I-J roadmap, and the QUEUE-LOAD-SMOKE drill audits carry contradictions too — these are captured by `file:line` in the canonical doc's §E table and **superseded there**, to be reconciled (if desired) by a future operator-authorized card.

## Bar-integrity attestation (the load-bearing §4-T check)

**No gate bar was lowered.** Every one of the 21 normalizations is **tighten / preserve / clarify**:
- *Tightened/clarified to the stricter bar:* PASS-LOAD = 0 terminal dead-letters at N=56 (not ≤1%/≤1.79%); provider-cluster = single-family ≥2 (not the SQL's cross-family condition); 62/63 = target-mitigation pass (not PASS-LOAD); `9ef5aab5` = packet-shape (not tolerated provider-5xx); H un-freeze requires P1 real-organic before the synthetic smoke.
- *Preserved:* the ≥24h nominal window (early-close admissible only as the weaker PLUMBING verdict); the two-tier PASS-STAGE-1 vs PLUMBING distinction; PARTIAL-SYNTHETIC-LAUNCH-QUALIFICATION strictly below the 56/56 bar; PERCENTAGE rests at 0 outside an authorized window.

**Surfaced for operator (NOT auto-resolved — would lower a bar if the looser reading were adopted):** the 5 items in canonical §F — (1) dead-letter budget kept at 0; (2) provider-cluster kept at single-family ≥2; (3) synthetic-only H authorization kept behind P1; (4) early-close kept as PLUMBING-only; (5) PARTIAL/PLUMBING/target-mitigation kept non-authorizing for 5%. The consolidation did **not** pick any looser reading; these are flagged for an explicit GATE-C operator decision.

## Verification run

- **Phase 0 (cannot-proceed gate): GREEN.** HEAD `a65f4b8`; clean tree; queue inert (`system_non_terminal=0`); `hij_rows_total=0`; drainer + monitor crons active; routing `ENABLED` digest = SHA256("false") (disarmed to baseline). All facts match the card's cited state.
- **Understand workflow:** 14 read-only scanners + 1 contradiction synthesizer (15 agents) → the §E table (21 contradictions, 5 operator-flags, consolidated inventory).
- **Produce:** main-thread (bar-integrity under direct control) — canonical doc + 6 surgical reconciliations + this audit.
- **Verify workflow:** adversarial critics on the produced docs (bar-integrity, target-pass-vs-PASS-LOAD, ≤1%-vs-0, §0/§11/§12/§13 one story, ACTIVE-blockers-clean, docs-only/leak-clean/authorizes-nothing).
- **Gates (captured in this card):**
  - `npm run typecheck` (`tsc --noEmit`) — **EXIT 0**.
  - `npm run lint` (`eslint . --ext .ts,.tsx --max-warnings 0`) — **EXIT 0**. (Cleared 3 stray `.claude-tmp/*.ts` scratch attestation files first — out-of-scope scratch from the prior verification turn, not in the staged set; their timestamps are recorded in the Stage-1 audit §13.)
  - `npm run test` (Jest) — **EXIT 0** (601 suites / 18925 cases passed; the docs-only diff touches no source/test file — run for completeness, count unchanged).
  - `node scripts/ops/audit-lint.mjs` (this audit) — **EXIT 0**, `audit-type: ops`, `verdict: PARTIAL`, `findings: 0 (PASS)`.
  - secret/leak scan over the **212 added diff lines** across the 8 changed docs — **clean** (no secret / API-key / JWT / Bearer / X-handle / social-URL / 15–20-digit-id leak).
  - **no runtime files changed** — asserted: the staged diff is exactly **8 `docs/**.md` files**; **0** under `mcp-server/**`, `supabase/functions/**`, `supabase/migrations/**`, `package.json`, `package-lock.json`, `familyRegistry.ts`.
- **Adversarial verify workflow:** 6 critics → **allPass = true**, 0 blocking / 0 major (only nit-level wording-hardening suggestions). Confirmed: no bar lowered; 62/63 = target-pass-only; ≤1%→0 consistent; §0/§11/§12/§13 one story; ACTIVE-blockers clean; docs-only / authorizes-nothing.

## Verdict

**PARTIAL** — 21 contradictions normalized **upward** (tighten/preserve/clarify; no bar lowered) and encoded in the canonical doc; **5 bar-lowering-risk items surfaced for an explicit operator (GATE-C) decision** rather than settled unilaterally. The consolidation changes no threshold's strictness and **authorizes nothing** (no 5% advance, no H/I/J enablement, no runtime change). PARTIAL (not PASS) because closing those 5 items — and encoding a precise minimum-organic-sample for the organic Stage-1 gate — requires an operator policy call this docs card deliberately does not make.

**Operator next step (GATE C):** read the canonical doc §F, confirm the five stricter-bar readings (default: confirm), and direct correction of the looser source wording in the un-edited docs (FORTIFIED, H-I-J roadmap, SMOKE drill audits) if desired.
