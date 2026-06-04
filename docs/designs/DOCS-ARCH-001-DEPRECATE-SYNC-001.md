# DOCS-ARCH-001-DEPRECATE-SYNC-001 — Redirect normative synchronous-capacity docs to the canonical ARCH-001 async queue

**Type:** docs-only · design-only (this run). The actual pointer edits are the IMPLEMENT phase.
**Epic:** Epic 12 / MCP semantic-referee track (documentation hygiene)
**Status:** Design draft (DESIGN-ONLY run — no pointer edits applied here)
**Ship lane:** docs-only · autoMergeEligible: true · requiresMigration/EdgeDeploy/GateC: false

---

## Constitutional acceptance-gate invariant (stated verbatim, binding)

> AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.

This card touches only Markdown prose. It changes zero code paths, zero queue routing, zero acceptance behavior. The invariant is reproduced here because the docs being redirected describe the classifier/capacity substrate, and every such card restates it. The canonical redirect target itself encodes this invariant at `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md:9-14` ("submit only ENQUEUES … then returns 201. All provider work moves off the submit path entirely.").

---

## Title

Redirect the two NORMATIVE-actionable synchronous-capacity design docs to the canonical ARCH-001 Postgres async classifier-queue architecture by adding a top-of-file supersession **pointer** (a 2-3 line blockquote), preserving every historical record byte-equal.

## Verified-at-HEAD hash

`37ccd9e` (`37ccd9ed027c625686f3eee517d03a48df25a29d`) — `git rev-parse --short HEAD` / `git rev-parse HEAD` at design time.

## Scope

- IN: Specify (do not apply) a top-of-file supersession **pointer** for exactly **2** NORMATIVE-actionable docs:
  1. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md`
  2. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`
- IN: A full 23-file classification table (normative / historical / false-positive / source) with the per-file action (redirect-pointer / preserve-untouched).
- IN: The EXACT pointer text (a 2-3 line blockquote) for each of the 2 normative docs.
- IN: An explicit "historical records are evidence — never rewritten" doctrine statement.
- OUT (this run): Applying the pointer edits. That is the IMPLEMENT phase (docs-only, autoMergeEligible).
- OUT: Any body rewrite of any file. The 2 normative docs get a pointer **prepended**; their existing bodies stay byte-equal.
- OUT: Any change to the 21 non-actionable files (historical / canonical / already-redirected / false-positive / source / test).

## Non-goals

- NOT a rewrite of any doc body. The 2 normative docs are durable #371 card-intent records; their bodies are preserved byte-equal — only a top-of-file pointer is added.
- NOT re-opening, redesigning, or re-litigating #371 or #373. Both are superseded; the Deno-KV limiter (#373 / Option A) is recorded-rejected, and the ARCH-001 Postgres async queue is the chosen path. This card does not resurrect Deno-KV or re-argue Option A vs. ARCH-001.
- NOT flipping any frozen flag. H/I/J `productionEnabled` stays `false` (`familyRegistry.ts:106/111/116` per Phase-0 §5.8). This card flips nothing, arms no routing, raises no percentage.
- NOT editing source or test code. The per-isolate cap that `anthropicCall.ts` / `providerConcurrency.ts` describe is a live backstop ARCH-001 deliberately retains; their comments are accurate, not stale. Editing a passing test for a doc sweep is forbidden by test-discipline.
- NOT touching the already-redirected `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` (it already carries a SUPERSEDED/REJECTED banner pointing to ARCH-001).

## Current production state

- The canonical chosen-path design exists and is approved as the implementation basis: `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md:3` ("Status: APPROVED as implementation basis"). Its load-bearing one-paragraph statement of the Postgres-backed asynchronous classification queue is §"Goal (one paragraph)" at **lines 54-70**; line 5 declares it "supersedes Option A (`OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md`)".
- Capacity/concurrency is resolved off the synchronous submit path by that async queue: `docs/core/known-blockers.md:556` ("Capacity/concurrency → the ARCH-001 Postgres async classifier queue (chosen over the rejected Deno-KV limiter #373). Classification moved OFF the synchronous 15s submit path; linearizable; bounded drainer concurrency C=3, MAX_ATTEMPTS=4, backoff [30,120]s."); root cause names #371/#373 at `known-blockers.md:552`.
- The per-isolate cap is still live at HEAD as a vestigial backstop and is honestly self-documented as NOT global: `mcp-server/lib/anthropicCall.ts:192` acquires `providerConcurrencyGate` before the fetch and releases in `finally` (`:296`); `mcp-server/lib/providerConcurrency.ts:9-11` ("TOPOLOGY: this is a PER-ISOLATE cap … Do not describe it as global."). ARCH-001 touches this provider path ZERO times (`ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md:17-20`).
- The two NORMATIVE-actionable docs prescribe the per-isolate cap as the fix with NO supersession pointer:
  - `OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md:3` ("**Status:** Design draft"); prescribes the bounded semaphore throughout; no pointer.
  - `OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md:4` ("**Stage 2B APPROVED**"); intent brief for the per-isolate cap; no pointer.
- The Deno-KV alternative is already redirected: `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md:3-7` (SUPERSEDED/REJECTED-ALTERNATIVE banner; "Do NOT implement this doc"; "DESIGN ONLY — never implemented"; Issue #373; Supersedes #371). No action.

## RCA / problem summary

A Phase-0 stale-vocab sweep over 23 files containing per-isolate / synchronous-capacity / Deno-KV / "direct dispatch" hits found that the documentation set still presents the **per-isolate synchronous-capacity cap** as a current prescriptive fix in two places, even though that approach was superseded by the ARCH-001 Postgres async queue. A reader landing on `OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md` (Status "Design draft") or its intent brief ("Stage 2B APPROVED") would have no top-of-file signal that the chosen path moved. The defect is purely navigational: there is no canonical pointer at the top of the two normative docs. Every other hit is either historical evidence (preserve), already-redirected, a false positive on the unrelated UI "direct dispatch" phrase, or accurate live-backstop source/test comments.

The fix is the minimum doc change that resolves navigation without destroying evidence: prepend a 2-3 line supersession pointer to the 2 normative docs, change nothing else.

## Why this is or is not a ceiling/limit

This is **not** a ceiling or capacity limit. It is a documentation-navigation defect. There is no runtime behavior, latency budget, concurrency bound, or queue throughput involved. The underlying capacity ceiling (per-isolate caps cannot bound GLOBAL Anthropic concurrency under Deno Deploy multi-isolate fan-in) was already analyzed and resolved by ARCH-001 (Phase-0 §5.1, `known-blockers.md:552,556`); this card does not revisit it. The only "limit" relevant here is the doctrine limit that historical records must not be rewritten — which this design honors.

## Architecture options considered

1. **Pointer-only on the 2 normative docs (CHOSEN).** Prepend a 2-3 line supersession blockquote to each of the two NORMATIVE-actionable docs; preserve every body byte-equal; touch nothing else. Minimal, evidence-preserving, autoMergeEligible.
2. **Body rewrite of the 2 normative docs.** Rewrite the prescriptive sections to describe the async queue. REJECTED: both docs are durable #371 card-intent records (the authoritative #371 intent brief is one of them, cited by the design doc at `OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md:7`). Rewriting destroys the historical intent record and violates the "records are evidence" doctrine below.
3. **Banner on all 23 files.** Add a supersession banner everywhere a hit appears. REJECTED: 12 historical files are audit/RCA/review/dated/changelog evidence (some already carry their own banners), 5 hits are false positives on the unrelated UI "direct dispatch" phrase, 4 are accurate live-backstop source/test comments, 1 normative doc (Deno-KV) is already redirected. Banners on those would either falsify evidence, mislabel correct comments, or duplicate an existing banner.
4. **Close/redirect via #371 issue body.** REJECTED: out of scope (docs-only file edits; no `gh` mutation in this card) and #371 must stay the OPEN umbrella tracker (Phase-0 supersession boundary; #371 stays open until ARCH-001 passes).

## Chosen architecture

Add a top-of-file supersession **pointer** (a 2-3 line blockquote) to exactly two files, preserving their bodies byte-equal:

1. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md`
2. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`

The pointer is placed immediately after the H1 title line and before the existing `**Status:**` metadata block, so the existing body (Status line onward) stays byte-for-byte identical and continues to read as the original #371 card-intent record. The pointer redirects readers to `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` §"Goal (one paragraph)" (lines 54-70).

### Historical records are evidence — never rewritten (doctrine statement)

**Historical records are evidence. They are never rewritten.** Audit smoke records, reviewer-verdict records, RCA / incident records, dated-filename testing-run records, commented-out changelog ledgers, and already-banner-superseded design rationale capture what was known, decided, or observed at a specific point in time. Rewriting their bodies would falsify the project's own decision trail and break the ability to trace why a path (e.g., the per-isolate cap, the Deno-KV limiter) was tried and superseded. The only permitted edit to a normative-actionable record is a top-of-file supersession **pointer** that adds forward-navigation without altering a single byte of the preserved body. Source-code and test comments that accurately describe live behavior are not stale and are not edited by a docs sweep. This doctrine is consistent with cdiscourse-doctrine §8 (append-only / soft-delete; never mutate after insert) applied to the documentation layer.

### EXACT pointer text (specified, NOT applied this run)

Two near-identical blockquotes — one per file. The IMPLEMENT phase prepends the matching block immediately under the existing H1 and before the `**Status:**` line. Body below stays byte-equal.

**For `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md`** (insert after line 1 `# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — …`, before the blank line preceding `**Status:**`):

```markdown
> **SUPERSEDED for the active fix axis (pointer, body preserved).** The per-isolate
> synchronous-capacity cap this doc prescribes was superseded by the canonical Postgres
> async classifier queue in [`ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md`](./ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md)
> §"Goal (one paragraph)". This record is preserved byte-equal as the durable #371 card-intent; it is not a current prescription.
```

**For `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`** (insert after line 1 `# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — Intent brief …`, before the blank line preceding `**Operator:**`):

```markdown
> **SUPERSEDED for the active fix axis (pointer, body preserved).** The per-isolate
> synchronous-capacity cap approved in this intent brief was superseded by the canonical Postgres
> async classifier queue in [`ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md`](./ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md)
> §"Goal (one paragraph)". This brief is preserved byte-equal as the durable #371 card-intent; it is not a current prescription.
```

Notes for the implementer:
- The relative link `./ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` is correct because all three files live in `docs/designs/`.
- Do NOT alter the existing `**Status:**` / `**Stage 2B APPROVED**` lines — the pointer sits ABOVE them; the original status is preserved precisely because it is the historical record.
- Add exactly one blank line after the blockquote so the existing body spacing is unchanged.

## Full 23-file classification table

Redirect target for all NORMATIVE-actionable hits: `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` §"Goal (one paragraph)" (lines 54-70).

| # | File | Class | Action | Cite (Phase-0) |
|---|------|-------|--------|----------------|
| 1 | `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md` | NORMATIVE | **redirect — preserve body + add top-of-file pointer** | `:3,18,564` (Status "Design draft"; prescribes per-isolate cap; no pointer) |
| 2 | `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md` | NORMATIVE | **redirect — preserve body + add top-of-file pointer** | `:4,10,20` ("Stage 2B APPROVED"; intent brief; no pointer) |
| 3 | `docs/designs/OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md` | NORMATIVE (Option A) — ALREADY REDIRECTED | preserve-untouched (banner already points to ARCH-001) | `:3,26,56` (SUPERSEDED/REJECTED banner; "Do NOT implement") |
| 4 | `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` | CANONICAL (the target itself) | preserve-untouched | `:3,61` (APPROVED implementation basis) |
| 5 | `docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md` | CANONICAL (ARCH-001 family) | preserve-untouched | `:13` ("direct dispatch" = default-DISABLED fallback the queue replaces) |
| 6 | `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-CAP2-SMOKE-2026-05-30.md` | HISTORICAL (dated audit, cap=2 FAIL record) | preserve-untouched (byte-equal) | `:11,81,120` (already self-supersedes at :120) |
| 7 | `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-PHASE4-SMOKE-2026-05-30.md` | HISTORICAL (dated audit, cap=5 PARTIAL record) | preserve-untouched (byte-equal) | `:11,16,109` |
| 8 | `docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-REVIEW-2026-05-30.md` | HISTORICAL (dated reviewer-verdict record) | preserve-untouched (byte-equal) | `:10,78,134` |
| 9 | `docs/core/current-status.md` | HISTORICAL (`:27` commented changelog) + FALSE-POSITIVE (`:726` UI "direct dispatch") | preserve-untouched | `:27,726` |
| 10 | `docs/core/known-blockers.md` | HISTORICAL (RESOLVED incident; already points to ARCH-001) | preserve-untouched (pointer already present) | `:552,556` |
| 11 | `docs/designs/MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md` | HISTORICAL (superseded H-enable intent) | preserve-untouched (optional pointer; out of this card's 2-file scope — body byte-equal either way) | `:95,112` |
| 12 | `docs/designs/OPS-MCP-FORTIFIED-ARCHITECTURE.md` | HISTORICAL (already banner-superseded) | preserve-untouched (pointer already present) | `:3,300` |
| 13 | `docs/designs/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` | HISTORICAL / RCA (chooses ARCH-001) | preserve-untouched (byte-equal) | `:91,98,138` |
| 14 | `docs/designs/UX-001.4.md` | FALSE-POSITIVE (`:852` ArgumentSideActionRail onPress UI dispatch) | preserve-untouched | `:846,852` |
| 15 | `docs/reviews/ARCH-001-CARD2-DRAINER-ENQUEUE.md` | HISTORICAL + FALSE-POSITIVE (`:19` queue-vs-direct routing predicate) | preserve-untouched (byte-equal) | `:3,19` |
| 16 | `docs/reviews/ARCH-001-CARD3-TUNING-AND-ROLLOUT.md` | HISTORICAL + FALSE-POSITIVE (`:38` default-disabled routing fallback) | preserve-untouched (byte-equal) | `:38` |
| 17 | `docs/reviews/OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-POST-H-FAIL.md` | HISTORICAL + FALSE-POSITIVE (`:36` routing predicate) | preserve-untouched (byte-equal) | `:36` |
| 18 | `docs/roadmap-expansions/2026-06-02-mcp-H-I-J-integration-roadmap.md` | HISTORICAL (already banner-superseded) | preserve-untouched (pointer already present) | `:3,137,139` |
| 19 | `mcp-server/lib/anthropicCall.ts` | SOURCE (accurate live-backstop comment) | preserve-untouched | `:186,191` |
| 20 | `mcp-server/lib/providerConcurrency.ts` | SOURCE (accurate live-backstop module header) | preserve-untouched | `:2` |
| 21 | `mcp-server/tests/anthropicCallProviderCap.test.ts` | TEST (live backstop under test) | preserve-untouched | `:3` |
| 22 | `mcp-server/tests/providerConcurrency.test.ts` | TEST (topology-honesty source-scan guard) | preserve-untouched | `:238,272,277,278` |
| 23 | `docs/designs/UX-001.4.md` "direct dispatch" co-located false positive | FALSE-POSITIVE (counted within row 14) | preserve-untouched | `:852` |

Tally (by classification): **NORMATIVE-actionable = 2** (rows 1-2, both redirect-pointer). NORMATIVE already-redirected = 1 (row 3). CANONICAL = 2 (rows 4-5). HISTORICAL = 12 doc files (rows 6-18; some already banner-superseded). FALSE-POSITIVE "direct dispatch" = UX-001.4.md + the 4 review/status lines (counted within their files). SOURCE/TEST = 4 (rows 19-22). The only edits this card specifies are the 2 pointer prepends (rows 1-2). All others: preserve-untouched / byte-equal.

> Note: the table lists 23 file-rows; UX-001.4.md appears as row 14 (its primary classification) and the line-level false-positive is noted as row 23 for completeness of the 23-hit inventory. No file is edited twice; UX-001.4.md is preserve-untouched.

## Data model (if relevant)

Not relevant. No schema, table, column, RLS policy, or migration. Docs-only.

## Worker/drainer model (if relevant)

Not relevant to this card. For context only (no action): the canonical async queue's drainer model — kick + 60s cron tick, single-flight lease, C=3 / MAX_ATTEMPTS=4 / backoff [30,120]s — lives in `ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md:14-18,32-34` and `known-blockers.md:556`. This card neither changes nor re-documents it; it only points readers to the canonical doc.

## Liveness and observability

No runtime liveness surface. Observability for this card is review-time only: a reviewer confirms (a) exactly two files changed in the IMPLEMENT phase, (b) each change is a pure prepend (the original first body line — the `**Status:**` / `**Operator:**` block — is unchanged and follows the new blockquote), and (c) `git diff --stat` shows only added lines in those two files and no deletions/modifications below the inserted block.

## Cutover and rollback path

- Cutover: IMPLEMENT prepends the two blockquotes; docs-only; autoMergeEligible.
- Rollback: revert the single docs commit. Because each edit is an additive prepend with the body byte-equal, `git revert` restores the exact prior bytes; no data, flag, or deploy state is involved.
- No merge=deploy effect: the change touches only `docs/**`, not `supabase/functions/**` or `supabase/migrations/**`, so the Supabase auto-apply path (pipeline-governance §5) is not triggered.

## Smoke plan

This is a docs-only card; "smoke" is a textual/structural verification, not a runtime smoke.

1. After IMPLEMENT, run `git diff --stat` and confirm exactly two files changed: `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md` and `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md`.
2. Confirm each diff is insertion-only above the original `**Status:**` / `**Operator:**` line (no deletions, no body modification). A byte-equal check: `git diff` shows only `+` lines for the blockquote and one `+` blank line.
3. Confirm the relative link resolves: `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` exists (it does, per `:3`).
4. Ban-list scan the two pointer blocks for forbidden tokens (none present by construction).
5. Confirm no other of the 23 files changed (`git status` clean except the two).
6. Gate commands `npm run typecheck` / `npm run lint` / `npm run test` are unaffected by a docs-only change; run them to confirm the baseline (630 suites / 19263 passing / 1 skipped / 19264 total) is unchanged (test delta 0).

## Open questions

1. **Optional pointer on `MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md` (row 11).** Phase-0 marks a top-of-file pointer as "acceptable but body must stay byte-equal." This card scopes to the 2 strictly-NORMATIVE docs and leaves row 11 preserve-untouched. Operator decision: include row 11's optional pointer in the same IMPLEMENT PR, or leave it. Default recommendation: leave it (it is historical/superseded intent, not a current prescription, and adding it widens scope beyond the 2-file contract). Cite: Phase-0 key `MCP-021C-EDGE-FAMILY-H-ENABLE-intent.md` (`:95,112`).
2. **Exact insertion anchor confirmation.** The pointer is specified to sit between the H1 and the metadata block. If repo convention prefers the pointer directly under an existing `---` rule, the implementer should still keep the body byte-equal and only adjust the blank-line placement. No fact is missing; this is a placement-style choice.

## Stage gates before implementation

- GATE A (design approval): this doc + the issue. No code. No mutation. (pipeline-governance §2)
- IMPLEMENT: prepend the two specified blockquotes only. Docs-only. (autoMergeEligible)
- GATE B (post-implement self-check): byte-equal verification per Smoke plan steps 1-5; gate commands green (test delta 0).
- REVIEW + GATE C: not required for merge eligibility (docs-only, no migration, no Edge deploy, no frozen-flag flip). Standard docs review applies. never-self-approve (§4/§4-C) is not triggered — this card flips no guard, no bar, no family-registry flag, arms no routing.

## Commit-slice plan

- Slice 1 (DESIGN — this run): write `docs/designs/DOCS-ARCH-001-DEPRECATE-SYNC-001.md` and file the issue. One commit, docs-only.
- Slice 2 (IMPLEMENT — later phase): prepend the two specified blockquotes to the two normative docs. One commit, docs-only, autoMergeEligible. No other file touched.

## Test-count forecast

- DESIGN run: **test delta 0** (no code, no tests). Baseline per test-discipline: **630 suites / 19263 passing / 1 skipped / 19264 total** on main.
- IMPLEMENT run: **test delta 0** (docs-only; no new model, no new code path, nothing to unit-test). The repo has no Markdown-link-integrity test suite that would require a new test for a pointer; if one is later added it is out of this card's scope. The baseline must remain unchanged after IMPLEMENT.

## HALT ceiling

HALT and surface to the operator if any of the following would be required to complete the card:
- Any body byte of a historical / canonical / already-redirected / false-positive / source / test file would change (violates the "records are evidence" doctrine).
- Any change outside the 2 specified normative docs in the IMPLEMENT phase (scope breach).
- Any need to flip a `productionEnabled` flag, arm routing, raise the routing percentage, or touch `familyRegistry.ts` (frozen-set breach).
- Any need to reopen, close, redesign, or re-litigate #371 or #373, or to resurrect the Deno-KV limiter (supersession-boundary breach).
- Any code/migration/Edge change (this card is docs-only; a code need means the card was mis-scoped).
- The redirect target `ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md` not existing or its §"Goal (one paragraph)" having moved out of lines 54-70 without an updated cite.

## Current-status manifest stub

- **MODIFIED:** (IMPLEMENT phase only — not this run) `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md` (+pointer blockquote, body byte-equal), `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md` (+pointer blockquote, body byte-equal).
- **NEW:** `docs/designs/DOCS-ARCH-001-DEPRECATE-SYNC-001.md` (this design doc).
- **BYTE-EQUAL preserved:** all 21 non-actionable files (rows 3-23 of the classification table), including the bodies of the 2 normative docs below the inserted pointer.
- **Test deltas:** DESIGN 0; IMPLEMENT 0. Baseline 630 suites / 19263 passing / 1 skipped / 19264 total unchanged.
- **Operator follow-up:** decide Open Question 1 (optional row-11 pointer); IMPLEMENT phase is autoMergeEligible once GATE A approves the design.
- **Discipline line:** docs-only · design-only this run · no truth labels · no secret · frozen-set untouched · historical records preserved byte-equal · every state claim cited file:line or Phase-0 key.

## Required-reading manifest for the later build phase

1. This design doc (`docs/designs/DOCS-ARCH-001-DEPRECATE-SYNC-001.md`) — the pointer text and the 23-file table are authoritative.
2. `docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md:3,9-14,54-70` — the redirect target; confirm §"Goal (one paragraph)" is still lines 54-70 and the acceptance-gate blockquote is intact before linking.
3. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md:1-13` — confirm H1 + `**Status:**` anchor for the prepend; verify body unchanged after edit.
4. `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-intent.md:1-4` — confirm H1 + `**Operator:**` anchor for the prepend; verify body unchanged after edit.
5. `docs/core/known-blockers.md:552,556` — context: why the per-isolate/Deno-KV approaches are superseded (do NOT edit; already points to ARCH-001).
6. Skill(cdiscourse-doctrine) §1/§8 and Skill(test-discipline) — the doctrine (records are evidence; append-only) and the test baseline.
7. `docs/core/pipeline-governance-contract.md` §2/§4/§5 — stage machine, never-self-approve, merge=deploy (not triggered by docs-only).
