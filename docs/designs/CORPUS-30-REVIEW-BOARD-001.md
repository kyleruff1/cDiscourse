# CORPUS-30-REVIEW-BOARD-001 — Human review board for the 30-debate prod-synthetic run

`Audit-Lint: v1`

**Card:** `CORPUS-30-REVIEW-BOARD-001` (GitHub issue [#474](https://github.com/kyleruff1/cDiscourse/issues/474), `update_existing`)
**Type:** docs-only, one-time human review board (UX feedback workflow). DESIGN-ONLY here.
**Run under review:** `corpus-prod-synthetic-20260603-1924-d49e04cd` (runId `d49e04cd`, 30 debates / 300 args, 2026-06-03 19:24 UTC live).

---

## Verified-at-HEAD hash

All state claims in this doc are verified against **HEAD `37ccd9e`** (`37ccd9ed027c625686f3eee517d03a48df25a29d` — `feat(ADMIN-ARGS-INACTIVE-001): reversible inactive visibility state for arguments … (#480)`, `git log -1`). Every state claim below carries a `file:line` citation or a Phase-0 fact key from the authoritative fact bundle.

---

## Scope

Design the human review-board workflow that turns the `d49e04cd` corpus run into structured product feedback, and specify the exact shape of the committed scaffold doc to be CREATED at implement time:

- **Doc to create at implement:** `docs/testing-runs/2026-06-03-corpus-30-human-review.md` (Glob `docs/testing-runs/*corpus-30*human-review*.md` returned **No files found** at HEAD — the doc does not yet exist; this design specifies its structure).
- A **30-row scaffold table** (one row per debate), shortened debate ids only, with neutral category columns: `useful · repetitive · confusing · hostile-but-converted · label-helpful · label-noisy · admin-UX-problem · classifier-issue · planner-or-rendering-issue · notes`.
- A **≥10-of-30 manual review floor** (operator-run; Claude prepares the scaffold + leak-safe scan only — the human reviews are NOT performed in this card).
- A **five-bucket findings map** (UX / planner-rendering / classifier / admin-tooling / doctrine) so each flagged row becomes a candidate backlog follow-up.
- A **leak-safe scan contract** so the committed doc carries no raw hostile body content, no secrets, no X handles/URLs/post-IDs/emails, and no verdict tokens about any author — only shortened ids/hashes + neutral summaries.

The review board references the **committed upstream outputs** of the now-CLOSED upstream cards (see "Current production state").

## Non-goals

- **No implementing any follow-up** the review surfaces — each becomes its own backlog card.
- **No reviewing all 30** — 10 is the floor; the operator decides depth (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1554-1555`).
- **No raw bodies in the doc** — shortened ids + neutral category labels only (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1543,1556`).
- **No dissent-detector / ban-list / validator tightening proposal.** Per operator `policy_no_censorship`, hostile rhetoric is INPUT to the bot adversarial process, not a defect (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:215`). The `hostile-but-converted` column is a *playability* observation, never a request to harden submit-argument.
- **No code, no tests, no migration, no Edge change** in THIS design card. The IMPLEMENT phase writes one Markdown scaffold + one leak-safe-scan test (see Test-count forecast).
- **No H/I/J `productionEnabled` flip; no routing arm; no Deno-KV resurrection.** Frozen set is untouched (`familyRegistry.ts:106,111,116`; `#371/#373` superseded — recorded, do-not-re-litigate).

## Current production state

- **Run identity.** `corpus-prod-synthetic-20260603-1924-d49e04cd`, runId `d49e04cd`, 30 debates / 300 args, 2026-06-03 live (`docs/testing-runs/2026-06-04-corpus-30-analysis.md:6`; Phase-0 fact `#474 run to review + neutral labels`).
- **Upstream #465 (PHASE7-OBSERVATION) is CLOSED/merged.** Committed output: `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md` (PR #482; `analysis.md:187`). A-G coverage complete (zero gaps), Σ-success 40.5% PARTIAL, H/I/J leakage zero (`phase7-observation.md:24,26,40`).
- **Upstream #466 (CORPUS-30-RESULTS-001) is CLOSED/merged.** Committed output: `docs/testing-runs/2026-06-04-corpus-30-analysis.md` (Phase-0 dedup `#474 … upstream #465 (PHASE7) + #466 (RESULTS-001) now CLOSED`). This is the product readout the review board cites for run-level facts.
- **Source run reports committed** (PR #481): `docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md`, `…-corpus-summary.md` (Glob confirmed both present at HEAD; `analysis.md:8`).
- **Acceptance-gate invariant held across the run.** `submit-argument` accepted 300/300 args; the auto-trigger dispatched families via `EdgeRuntime.waitUntil(...)` AFTER the insert returned; no classifier blocked or routed any post (`analysis.md:43,170-173`).
- **Routing was OFF during the run** (`CLASSIFIER_QUEUE_ROUTING_ENABLED` unset = false, percentage dial 0%) (`analysis.md:55-56`; `submit-argument/index.ts:811-816`; `classifierQueueRouting.ts:89-98`).
- **Renderer telemetry available for review context:** Anthropic renderer 23/240 M3-M10 eligible = 9.6%; deterministic_fallback ~217/240 ≈ 90.4% (`analysis.md:152-153`). Diversity §9 reads: duplicate-seed GREEN, repeated-option YELLOW, spine saturation YELLOW, voice distribution YELLOW (structural), samey-move GREEN-but-known-defective (`analysis.md:28-32`).
- **Admin-surface context for the `admin-UX-problem` column.** Pre-`ADMIN-ARGS-INACTIVE-001` the 300 bot rows render flat (no grouping); `ADMIN-ARGS-INACTIVE-001` (#464 / PR #480, MERGED 2026-06-04) adds the Inactive column + bulk-inactive workflow; argument-artifact grouping remains open as `ADMIN-ARGS-CANONICAL-001` (#463) (`analysis.md:140-141,193`; Phase-0 `dedup_463`).

## RCA / problem summary

The 300/300 result is **submission-path mechanism telemetry, not quality evidence** (`analysis.md:14,37`). The automated diversity and Phase-7 readouts measure *mechanism* (coverage, fallback rate, voice/spine spread, classifier success rate) but **cannot judge whether a debate reads as a useful, non-repetitive, non-confusing exchange to a human, or whether a machine-Observation label was helpful vs. noisy on a real thread.** That judgment is the gap this card closes: a one-time, leak-safe, operator-run review that converts run artifacts into product backlog signal.

The reason it must be a *board with a fixed schema* rather than free-form notes: findings have to be **routable**. Each flagged row maps to exactly one of five owners (UX / planner-rendering / classifier / admin-tooling / doctrine) so the operator can spin follow-up cards without re-reading 300 bodies. The schema also enforces the doctrine boundary at authoring time — the column set deliberately contains no truth/verdict column, so a reviewer cannot accidentally record a correctness judgment about an author.

## Why this is or is not a ceiling/limit

**Not a ceiling.** This is a docs-only feedback-capture workflow, not a capacity, latency, or reliability limit. It neither raises nor lowers any bar:

- It does **not** touch the renderer fallback rate, the classifier success rate, or any diversity band — those are owned by `#467` (CORPUS-30-QUALITY-001) and `#468` (CORPUS-30-DIVERSITY-001) (`analysis.md:189-190`).
- It does **not** alter the acceptance gate. `engine.ts` remains the sole gate; the review board reads committed artifacts and adds neutral human annotations to a Markdown file.
- The only enforced limit is the **≥10/30 floor** (a depth floor, not a bar lowering) and the **leak-safe ceiling** on what may appear in the committed doc (a tightening, doctrine-aligned constraint).

## Architecture options considered

**Option A — Inline-in-analysis.** Append a human-review section to the existing `2026-06-04-corpus-30-analysis.md`.
*Rejected:* that doc is the #466 committed RESULTS artifact (closed). Appending human annotations would mix machine readout with hand annotations and re-open a closed card's surface. The card spec names a dedicated file (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1540`).

**Option B — Structured data file (JSON/CSV) + generated Markdown.** Store reviews as JSON, render the table.
*Rejected for v1:* over-engineered for a one-time 30-row pass. Adds a generator + parse step and a second leak surface (the JSON). The card is "docs-only workflow card; no code" (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1528`). A single committable Markdown is the deliverable.

**Option C (CHOSEN) — Single committed Markdown scaffold, operator-filled, leak-safe-scanned.** One `docs/testing-runs/2026-06-03-corpus-30-human-review.md` with a 30-row table, a five-bucket findings section, and a doctrine attestation; one leak-safe-scan test guards it.
*Chosen:* matches the card's "author the review scaffold doc … apply the leak-safe scan … operator fills ≥10 rows … Claude consolidates into five buckets" flow (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1547-1551`), and keeps exactly one committable leak surface.

## Chosen architecture

A single committed Markdown doc with a fixed section layout, plus a single guard test. The doc's shape (specified here for the IMPLEMENT phase):

**Front-matter / header**
- `Audit-Lint: v1`, card + issue link, run identity (`corpus-prod-synthetic-20260603-1924-d49e04cd`, runId `d49e04cd`, 30/300).
- **Synthetic-evidence + no-censorship disclaimer** (binding), mirroring `analysis.md:14` and `analysis.md:215`: mechanism evidence on pre-launch synthetic data, NOT factual standing of any claim, NOT a verdict on any author; hostile rhetoric is INPUT to the adversarial process, not defect — this board does NOT propose dissent-detector / ban-list / validator tightening.
- **Required-reading pointers** to the committed upstream artifacts: `2026-06-04-corpus-30-phase7-observation.md` (#465), `2026-06-04-corpus-30-analysis.md` (#466), `2026-06-03-xai-adversarial-bot-corpus.md` + `…-corpus-summary.md` (PR #481).

**§ Review table (30 rows, one per debate)** — columns, all neutral, no truth column:

| Column | Type | Meaning (neutral, doctrine-safe) |
|---|---|---|
| `debate_short_id` | shortened id (first 8 hex of debate UUID) | identifies the row; never the full UUID, never the room title |
| `useful` | ✓ / — | did the exchange read as a substantive move-and-counter? |
| `repetitive` | ✓ / — | did moves restate prior moves (samey)? |
| `confusing` | ✓ / — | was the thread hard to follow / disjoint? |
| `hostile-but-converted` | ✓ / — | hostile opening that narrowed/conceded later (playability signal, NOT a defect) |
| `label-helpful` | ✓ / — | a machine Observation chip read as useful on this thread |
| `label-noisy` | ✓ / — | a machine Observation chip read as noise/misfit |
| `admin-UX-problem` | ✓ / — | the row was hard to find / triage in Admin > Arguments |
| `classifier-issue` | ✓ / — | a classifier Observation looked wrong/missing (advisory only) |
| `planner-or-rendering-issue` | ✓ / — | planner seed / spine / voice / deterministic-fallback artifact |
| `notes` | neutral free-text | shortened-id references + neutral summary; NO raw body, NO quote of hostile text |

- All 30 rows are pre-populated with the shortened id and empty markers; the operator fills ≥10.
- **Doctrine guard baked into the schema:** there is deliberately no `winner` / `correct` / `true` / `who-was-right` column. The marks are gameplay/playability/usability Observations only (§1, §10a).

**§ Five-bucket findings map** — after the operator fills ≥10 rows, each flagged cell rolls up to exactly one owner bucket, each with a one-line neutral summary + a candidate follow-up card name (no card filed by this doc):

1. **UX** (room/gallery/timeline readability) → candidate cards.
2. **planner-rendering** (seed/spine/voice/fallback) → cross-ref `#467` / `#468`.
3. **classifier** (Observation helpful/noisy/missing) → cross-ref `#470` (classifier health panel) / Phase-7 follow-ups.
4. **admin-tooling** (find/triage/group bot rows) → cross-ref `#463` / `#464`.
5. **doctrine** (any label that drifted toward a verdict, any sensitive Observation surfaced wrongly) → §1/§10a.

**§ Candidate follow-ups** — bulleted, one line each, NO new card filed here (non-goal).

**§ Doctrine attestation** — §1/§3/§4/§7/§8/§9/§10a + `policy_no_censorship`, mirroring the upstream docs' attestation blocks.

## Data model (if relevant)

No database schema. The only "data model" is the Markdown table columns above. The shortened id is the **first 8 hex characters of the debate UUID** (and, where a hash is referenced in notes, the existing 16-hex `tokenSetHash` prefix the runner already emits — bodies never leave the runner; only the hash + count reach committable output, per Phase-0 fact `move_body_sample event shape`). No full UUIDs, no room titles (titles carry the claim summary at position 0 and could echo input text — `runXaiAdversarialBotCorpus.js:456,767`), no raw bodies.

## Worker/drainer model (if relevant)

Not applicable — docs-only. No queue, no drainer, no Edge Function, no worker. (Recorded for §8 completeness: the run under review used the direct-dispatch auto-trigger path with routing OFF — `analysis.md:55-56,170` — the review board only reads its committed artifacts.)

## Liveness and observability

Not applicable as a runtime concern. The doc's "observability" is the committed leak-safe-scan test output (green = no leak) and the five-bucket findings map (operator-readable backlog signal). No metric is emitted, no panel is changed.

## Cutover and rollback path

- **Cutover:** the IMPLEMENT PR adds one Markdown scaffold + one guard test. On merge, the scaffold is committed (no runtime effect — docs-only; no `supabase/functions/**` or `supabase/migrations/**` path, so §5 merge=deploy does NOT trigger).
- **Rollback:** `git revert` of the docs-only PR. No data, no deploy, no migration to unwind. Because the doc contains no raw bodies and no secrets by construction, a revert carries no leak residue.

## Smoke plan

Docs-only — no runtime smoke. The "smoke" equivalent is the leak-safe-scan test passing locally and in CI, plus an `audit-lint` pass:

1. `npm run test -- corpus30HumanReviewLeakage` exits 0 (the new guard test; scans the committed doc for secrets / X handles / URLs / 15-20-digit post IDs / emails / verdict tokens about a user → zero matches).
2. `npm run typecheck` exits 0 (unchanged — no TS touched).
3. `npm run lint` exits 0.
4. `node scripts/ops/audit-lint.mjs docs/testing-runs/2026-06-03-corpus-30-human-review.md` passes (the file is non-SMOKE, so CI's `docs/audits/**SMOKE*.md` path filter will NOT fire — run the local audit-lint per memory `[[audit-lint-ci-path-filter]]`).

## Open questions

1. **Which run report is the canonical "hostile-but-converted" source for the operator?** The Phase-0 bundle names `2026-06-03-xai-adversarial-bot-corpus.md` as the source report, but does not enumerate which debates contain hostile-but-converted arcs. *Resolution:* operator identifies them during the manual pass; the scaffold leaves the column empty. (Named here because the fact is not in the bundle.)
2. **Shortened-id collision risk across 30 debates.** First-8-hex is near-certainly unique for 30 UUIDs but not guaranteed. *Resolution:* the IMPLEMENT phase verifies uniqueness across the 30 shortened ids; if a collision occurs, extend to 10 hex. (Operator/implementer follow-up, not a design blocker.)
3. **Does the operator want the `classifier-issue` column to distinguish "wrong Observation" from "missing Observation"?** The current schema collapses both. *Resolution:* keep collapsed for v1 (one-time pass); split only if the ≥10 pass shows it matters.

## Stage gates before implementation

Per `pipeline-governance-contract §2` (Phase 0 → DESIGN → GATE A → IMPLEMENT → GATE B → REVIEW → GATE C):

- **Phase 0:** DONE — fact bundle consumed; all 9 §5 state items confirmed (`allStateConfirmed: true`).
- **DESIGN (this doc):** complete on write.
- **GATE A:** operator/reviewer approves this design (docs-only, no frozen-set touch).
- **IMPLEMENT:** write the scaffold doc + the one leak-safe-scan test only.
- **GATE B:** `typecheck` + `lint` + the new test green; ban-list + leak scan green.
- **REVIEW:** reviewer re-runs the leak scan and audit-lint; confirms no raw body / secret / verdict token.
- **GATE C:** **not required.** No `supabase/functions/**`, no `supabase/migrations/**`, no Edge deploy, no migration. Docs-only ⇒ autonomous green squash-merge eligible under §5 (`SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1586`).

## Commit-slice plan

Single slice (docs-only, small):

1. **Slice 1 (only):** add `docs/testing-runs/2026-06-03-corpus-30-human-review.md` (30-row scaffold + five-bucket section + attestation) and `__tests__/corpus30HumanReviewLeakage.test.ts` (the guard). One PR, one squash-merge.

No second slice — operator fills the ≥10 rows after merge (or on the same branch before merge, operator's choice); the consolidation into five buckets is a doc edit, not a separate code slice.

## Test-count forecast

- **DESIGN (this card):** test delta **0** (design-only; no code).
- **IMPLEMENT:** **+1 test file** `__tests__/corpus30HumanReviewLeakage.test.ts` with an estimated **+4 to +8 assertions** (one per leak class: secrets / `ANTHROPIC_API_KEY`+`SERVICE_ROLE` shape / X handles 1-15 chars / `x.com`·`t.co`·`twitter.com` URLs / 15-20-digit post IDs / emails / verdict tokens about a user). Baseline is **630 suites / 19263 passing / 1 skipped / 19264 total** on main (Skill `test-discipline`); IMPLEMENT projects 631 suites / ~19268-19272 passing. Test count goes UP, never down.

## HALT ceiling

HALT and surface to the operator if any of the following arises during IMPLEMENT:

- Any committed text would contain a **raw hostile body**, a quote of hostile rhetoric, a full UUID, a room title, an X handle, a URL, a post ID, an email, or a secret-shaped string — even in a notes cell. (Leak-safe ceiling.)
- Any column or note records a **truth/verdict judgment about an author** (`winner` / `correct` / `liar` / `dishonest` / etc.) — the schema forbids it (§1/§10a).
- Any finding proposes **tightening the dissent detector / ban-list / submit-argument validator** — barred by `policy_no_censorship` (`analysis.md:215`).
- Any finding proposes **flipping H/I/J `productionEnabled`, arming routing, raising the routing percentage, or resurrecting the #373 Deno-KV limiter** — frozen set is untouchable.
- The leak-safe-scan test would need to be **weakened** to make the doc pass — §4-T bar-lowering breach; fix the doc, never the guard.

## Current-status manifest stub

For the IMPLEMENT phase to append to `docs/core/current-status.md`:

- **MODIFIED:** `docs/core/current-status.md` (one-line note: "CORPUS-30-REVIEW-BOARD-001 — human review board scaffold for run `d49e04cd` committed; ≥10/30 operator-run; docs-only").
- **NEW:** `docs/testing-runs/2026-06-03-corpus-30-human-review.md` (30-row scaffold + five-bucket findings + doctrine attestation); `__tests__/corpus30HumanReviewLeakage.test.ts` (leak-safe guard).
- **BYTE-EQUAL preserved:** `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md`, `docs/testing-runs/2026-06-04-corpus-30-analysis.md`, `docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md`, `…-corpus-summary.md` (referenced, never edited); `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (frozen set untouched); `src/lib/constitution/engine.ts` (sole gate untouched).
- **Test deltas:** +1 suite, +4-8 assertions vs the 630/19263/1-skipped/19264 baseline.
- **Operator follow-up:** fill ≥10 of 30 rows; consolidate flagged cells into the five buckets; spin candidate follow-up cards (none filed by this doc).
- **Discipline line:** NO Anthropic / xAI / X API call by Claude. NO Supabase write. NO direct insert into `public.arguments`. NO raw body / evidence_span / room title / secret in the doc. NO classifier re-trigger. NO H/I/J `productionEnabled` flip. NO routing arm. NO dissent-detector / validator tightening.

## Required-reading manifest for the later build phase

The IMPLEMENT-phase agent must read, in order:

1. This design doc (`docs/designs/CORPUS-30-REVIEW-BOARD-001.md`).
2. `docs/testing-runs/2026-06-04-corpus-30-analysis.md` (#466 RESULTS — run-level facts, §1 disclaimer, §15 attestation pattern to mirror).
3. `docs/testing-runs/2026-06-04-corpus-30-phase7-observation.md` (#465 PHASE7 — classifier coverage/leakage facts; §9 attestation pattern).
4. `docs/designs/SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1523-1588` (the `CORPUS-30-REVIEW-001` card spec — scope in/out, acceptance criteria, test plan).
5. `docs/testing-runs/2026-06-03-xai-adversarial-bot-corpus.md` + `…-corpus-summary.md` (source run reports — for identifying review-worthy debates; bodies stay in the reviewer's view only, never in the committed doc).
6. Skill `cdiscourse-doctrine` §1 / §3 / §10a (truth labels, popularity-not-evidence, Observations vs Allegations).
7. Skill `test-discipline` (leak-safe / ban-list test patterns; 630/19263/1/19264 baseline).
8. Memory `[[audit-lint-ci-path-filter]]` (run local `node scripts/ops/audit-lint.mjs` — non-SMOKE doc won't trip CI).

---

### Doctrine attestation (this design doc)

- **§1 no truth labels.** The review schema has no `winner`/`correct`/`true` column; all marks are gameplay/usability/playability Observations.
- **§3 popularity not evidence.** The board records no engagement-as-evidence; the synthetic-evidence disclaimer binds the scaffold.
- **§4 AI moderator advisory-only.** `classifier-issue` marks read machine Observations as advisory; nothing gates submission.
- **§4-C never-self-approve.** No H/I/J flip; frozen set untouched.
- **§4-T no bar lowering.** The leak-safe scan is a tightening; the ≥10 floor is a depth floor.
- **§5 engine.ts sacred.** Untouched.
- **§6 secrets.** No secret value in this doc or the planned scaffold.
- **§7 no AI from production app.** No provider call; the run under review used `scripts/bot-fixtures/` only.
- **§8 soft-delete / append-only / RLS.** No row mutated; the 30 corpus rows stay (`analysis.md:179`).
- **§9 plain-language mapping.** Internal codes (`mcp_api_error`, `deterministicSkeletonFill`, `tokenSetHash`, runTag) appear with operator-facing gloss; user-facing strings unaffected (docs-only).
- **§10a Observations vs Allegations.** Machine labels stay Observations; the board never promotes one to an allegation about an author. Sensitive Observations are never surfaced in the committed doc.
- **`policy_no_censorship`.** Hostile rhetoric is INPUT, not defect; this board does NOT propose dissent-detector, ban-list, or validator tightening.
