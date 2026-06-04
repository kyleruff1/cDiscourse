# SPRINT 2026-06-04 — Backlog Card-Drafting Index

**Status:** Design-only backlog drafting. 9 design docs written; 3 new issues filed; 6 existing issues refined by comment; all 9 added to Project #1.
**Author role:** Claude Code (ultracode / dynamic-workflow), human-orchestrated under the credential contract in the driver prompt.
**Created:** 2026-06-04.
**Verified-at-HEAD:** `37ccd9e` (squash-merge of PR #480 `feat(ADMIN-ARGS-INACTIVE-001) … (#480)`).
**Preflight test baseline:** **630 suites / 19263 passing / 1 skipped / 19264 total** — matches the operator anchor exactly; typecheck + lint clean.
**Governance:** binds to `docs/core/pipeline-governance-contract.md` (§2 stage machine, §4 never-self-approve, §5 merge=deploy). Every card is DESIGN-ONLY; no implementation, no migration, no Edge deploy, no routing arm, no `productionEnabled` flip was performed.

---

## 0. What this run did (and did not do)

- **DRAFTED 9 cards.** 3 new design docs + issues; 6 design docs refining existing open issues by comment.
- **No code, no tests, no migrations, no Edge source** were written. Every artifact is a `docs/designs/*.md` design doc.
- **No runtime mutation.** No provider call, no Supabase write, no service-role, no `CLASSIFIER_QUEUE_ROUTING_*` change, no H/I/J flip, no bot posting.
- **DEVEX-PIPELINE-HYGIENE-001 was assessed and SKIPPED** — both its justifications evaporated: `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md` is already tracked (FX-10 green on main), and no PR template exists to carry a stale `supabase db push` fallback. Per "optional only if clearly card-worthy", not filed.

---

## 1. Card index (code → issue → doc → lane)

| # | Card | Issue | Action | Design doc | Ship lane | GATE-C? | Auto-merge eligible? |
|---|---|---|---|---|---|---|---|
| 1 | `CORPUS-QUEUE-SMOKE-TAG-001` | [#484](https://github.com/kyleruff1/cDiscourse/issues/484) | **FILE** | `docs/designs/CORPUS-QUEUE-SMOKE-TAG-001.md` | dev-tooling | no | yes |
| 2 | `OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001` | [#485](https://github.com/kyleruff1/cDiscourse/issues/485) | **FILE** | `docs/designs/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001.md` | edge | **yes** | no |
| 3 | `DOCS-ARCH-001-DEPRECATE-SYNC-001` | [#486](https://github.com/kyleruff1/cDiscourse/issues/486) | **FILE** | `docs/designs/DOCS-ARCH-001-DEPRECATE-SYNC-001.md` | docs-only | no | yes |
| 4 | `CORPUS-30-QUALITY-001` | [#467](https://github.com/kyleruff1/cDiscourse/issues/467) | **UPDATE** | `docs/designs/CORPUS-30-QUALITY-001.md` | dev-tooling | no | yes |
| 5 | `CORPUS-30-DIVERSITY-001` | [#468](https://github.com/kyleruff1/cDiscourse/issues/468) | **UPDATE** | `docs/designs/CORPUS-30-DIVERSITY-001.md` | dev-tooling | no | yes |
| 6 | `OPS-MCP-OBSERVABILITY-002` | [#470](https://github.com/kyleruff1/cDiscourse/issues/470) | **UPDATE** | `docs/designs/OPS-MCP-OBSERVABILITY-002.md` | edge | **yes** | no |
| 7 | `ADMIN-ARGS-CANONICAL-001` | [#463](https://github.com/kyleruff1/cDiscourse/issues/463) | **UPDATE** | `docs/designs/ADMIN-ARGS-CANONICAL-001.md` | dev-tooling (option a) / migration (option b) | option-b only | option-a only |
| 8 | `MCP-HIJ-000` | [#471](https://github.com/kyleruff1/cDiscourse/issues/471) | **UPDATE** | `docs/designs/MCP-HIJ-000-READINESS-LEDGER.md` | docs-only | no | yes |
| 9 | `CORPUS-30-REVIEW-BOARD-001` | [#474](https://github.com/kyleruff1/cDiscourse/issues/474) | **UPDATE** | `docs/designs/CORPUS-30-REVIEW-BOARD-001.md` | docs-only | no | yes |

**FILE / UPDATE split:** 3 FILE (#484, #485, #486) · 6 UPDATE (#467, #468, #470, #463, #471, #474).

---

## 2. Dependency DAG (validated acyclic by the adversarial pass)

```
CORPUS-QUEUE-SMOKE-TAG-001 (#484) ──prerequisite-of──► #479 MCP-LIT-CORPUS-RUN (existing; out of scope)
                                                        (#479 also gated on operator arming routing)

OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 (#485)
        ▲ soft (panel reads direct-dispatch failure_detail it populates)
        │
OPS-MCP-OBSERVABILITY-002 (#470) ──overlap (interchange behind one runTag param)──► #476 CORPUS-30-RUNTAG-PERSIST (existing)

CORPUS-30-DIVERSITY-001 (#468) ──hard, lands-after──► CORPUS-30-QUALITY-001 (#467)
        (both edit the §9 reporter twin files: runXaiAdversarialBotCorpus.js + xaiAdversarialReport.js)

DOCS-ARCH-001-DEPRECATE-SYNC-001 (#486) ──redirects-to──► ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
        (keeps #371 the OPEN umbrella; does NOT reopen/redesign #371/#373)

ADMIN-ARGS-CANONICAL-001 (#463) ──consumes──► #464 ADMIN-ARGS-INACTIVE-001 (CLOSED/merged PR #480; inactive_at column)

MCP-HIJ-000 (#471) ──cross-links (documentation only)──► #472 MCP-H-001 · #478 MCP-I-SCOPE-001 · #473 MCP-J-001
        (advancement-neutral ledger; chains I-behind-H only as a documented operator-gate fact, not a build dep)

CORPUS-30-REVIEW-BOARD-001 (#474) ──references-outputs-of──► #465 PHASE7 (closed) · #466 RESULTS-001 (closed)
```

No cycles. No card depends on frozen (H/I/J) or superseded (#371/#373/Deno-KV) work as a build precondition.

---

## 3. Supersession recommendations for #371 / #373 (RECOMMEND-ONLY — not posted)

`CDISCOURSE_ALLOW_SUPERSEDED_ISSUE_CLOSE` is **unset**, so per the driver prompt §0 / §10.4 these notes were **NOT posted and the issues were NOT closed**. They are recommendations for operator action.

**#371 (OPS-MCP-SERVER-CAPACITY-INVESTIGATION)** — recommended 3-line note (operator to post if desired):
> 1. Superseded for the **active-fix axis** by the ARCH-001 Postgres async classifier queue (`docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md`) — global topology-aware control off the synchronous submit path, not further per-isolate tuning.
> 2. Reason: per-isolate caps are exhausted (cap=5 PARTIAL, cap=2 FAIL); a per-isolate in-memory semaphore cannot bound GLOBAL Anthropic concurrency under Deno Deploy dynamic multi-isolate fan-in.
> 3. **STAYS OPEN** as the umbrella capacity-investigation tracker + Family-H-frozen gate until the ARCH-001 substrate passes production-path verification. Do not close, reopen-with-new-design, or rewrite the body.

**#373 (OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL)** — recommended frozen-state ack (operator to post if desired):
> The chosen capacity path is ARCH-001 (Postgres async queue). #373's own design doc already carries a SUPERSEDED/REJECTED-ALTERNATIVE banner ("Do NOT implement this doc", DESIGN ONLY — never implemented) deferring to ARCH-001. #373 remains the GitHub-issue trail subsuming #371/#365/#368, but its Deno-KV mechanism is recorded-rejected. Do not redesign or reopen.

Neither issue was mutated by this run beyond the (separate) backlog cards above; no #371/#373 comment was posted.

---

## 4. Frozen set — left untouched (attested)

| Frozen surface | State at HEAD `37ccd9e` | Cite |
|---|---|---|
| H `claim_clarity` productionEnabled | `false` | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106` |
| I `thread_topology` productionEnabled | `false` | `familyRegistry.ts:111` |
| J `sensitive_composer` productionEnabled | `false` | `familyRegistry.ts:116` |
| `CLASSIFIER_QUEUE_ROUTING_ENABLED` | baseline off (unset → `=== 'true'` false) | `submit-argument/index.ts:811-816` |
| `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` | baseline 0 | `classifierQueueRouting.ts:89-98` |
| #472 / #394 / #473 (H/I/J scoping) | OPEN, design-only, untouched | — |
| #371 / #373 (capacity) | OPEN, recommend-note-only, untouched | — |

No card in this sprint flips a `productionEnabled` flag, arms routing, raises the routing percentage, or reopens #371/#373.

---

## 5. §5 state verification (all 9 confirmed at HEAD)

1. ✅ Capacity solved by ARCH-001 Postgres async queue; #371/#373 superseded — `known-blockers.md:552,556`.
2. ✅ #373 Deno-KV global limiter rejected/superseded (DESIGN ONLY, never implemented) — `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL.md:3-7,26-31`.
3. ✅ Routing baseline off — `submit-argument/index.ts:811-816` + `classifierQueueRouting.ts:89-98`.
4. ✅ Smoke tag literal `[arch-001-queue-smoke]` — `classifierQueueRouting.ts:51`.
5. ✅ Routing predicate (enabled + smoke-tag-prefix OR percentage hash) — `classifierQueueRouting.ts:160-184`.
6. ✅ Runner does NOT prefix the smoke tag today — `runXaiAdversarialBotCorpus.js:456,767`.
7. ✅ Direct-dispatch terminal failures leave `failure_detail` + `failure_sub_reason` NULL — `persistenceWriter.ts:35-50,83-96` + Phase 7 doc.
8. ✅ H/I/J `productionEnabled:false` (A-G true) — `familyRegistry.ts:69-103,106,111,116`.
9. ✅ Issue states as expected (#463 OPEN/DESIGN, #464 CLOSED+#480 MERGED, #371/#373 OPEN, #467/#468/#470/#471/#474 OPEN, siblings #476-#479 OPEN).

---

## 6. Adversarial validation verdict: **PASS**

Zero block-severity findings across all 9 docs. The 9 §9 checks (supersession leak / frozen breach / scope overlap / broken DAG / design-only discipline / stale citation / historical rewrite / secret hygiene / acceptance-gate invariant) all cleared. Three NOTE-severity items; two doc-level fixes applied in this run (CANONICAL-001 issue-URL slug `kyleruff` → `kyleruff1`; DIVERSITY-001 status-stub registry path corrected to `supabase/functions/_shared/booleanObservations/familyRegistry.ts:106/111/116`). One NOTE deferred to GATE A (FILL-001's `failure_sub_reason` column-origin cite to be line-anchored at build time — `analysis.md:57` cites `20260528000021_…:148-169`).

---

## 7. Credential boundary attestation

| Lane | Used? | Notes |
|---|---|---|
| GitHub auth (cached `gh`) | ✅ | issue create/comment/edit + project item-add as `kyleruff1` (scopes incl. `project`) |
| Supabase linked read path | ✅ | `npx supabase db query --linked --file` preflight only (`select now()`); no write |
| Bot-user JWT | ❌ | not obtained; not required for this design-only run |

> No provider call, no Supabase write, no service-role, no migration, no Edge deploy, no production implementation, no routing arm, no percentage ramp, no H/I/J flip, no bot posting, no secret printed, no secret committed.

---

## 8. Doctrine attestation

- §1 / §3 — no truth labels, popularity-not-evidence; grouped-row + ledger labels stay structural.
- §4 / §5 — acceptance-gate invariant stated verbatim in every classifier/queue/routing/observations/MCP card; `engine.ts` is the sole gate; classifiers run post-storage.
- §4-C / §4-T — no family-registry flip; no bar lowered (the #467 samey-move metric carries an explicit green-on-empty HALT: n/a when N<50, never green).
- §6 — no secret value in any doc/issue/body; only deny-list pattern descriptions in leak-safety prose.
- §7 — corpus quality/diversity cards confined to `scripts/bot-fixtures/**`; no AI from production app.
- §8 — `DOCS-ARCH-001` preserves all historical audit/RCA/testing-run records byte-equal (pointer-only on 2 normative docs).
- §10a — `inactive_reason` never surfaced (CANONICAL-001); classifier rows render as Observations not Allegations (OBSERVABILITY-002); J composer-only (MCP-HIJ-000); no raw hostile body content in the review board (REVIEW-BOARD-001).
