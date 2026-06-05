# CORPUS-30 — Human Review Board (quality / diversity assessment)

`Audit-Lint: v1`

**Card:** `CORPUS-30-REVIEW-BOARD-001` (GitHub issue [#474](https://github.com/kyleruff1/cDiscourse/issues/474))
**Run under review:** `corpus-prod-synthetic-20260603-1924-d49e04cd` (runId `d49e04cd`, 30 debates / 300 args, 2026-06-03 19:24 UTC live).
**Type:** docs-only, one-time human review board for a SYNTHETIC corpus run. This board reviews committed run artifacts only. It never touches a user submission.

---

## 0. Acceptance-gate invariant (binding — restate before reading any row)

> **AI/MCP classifiers MUST NEVER be the submission acceptance gate. The deterministic rules engine, `src/lib/constitution/engine.ts`, is the sole gate. Classifiers run after an argument is stored. No path may block, reject, route, or delay an ordinary user post.**

This review board is documentation only. It is a human review workflow for SYNTHETIC corpus runs. Its verdicts assess whether a pre-launch synthetic run reads as a useful, diverse exchange. **Nothing in this board can block, reject, route, or delay any user submission.** The board's only outputs are (a) "this run is usable / needs another pass", and (b) "the deferred planner-rotation card should / should-not be filed." Both are backlog signals about synthetic tooling, never a gate on a person's post.

---

## 1. Synthetic-evidence + no-censorship disclaimer (binding for every observation below)

Per `cdiscourse-doctrine §1` (no truth labels), `§3` (popularity / engagement is not evidence), `§4` (AI moderator advisory-only), `§10a` (Observations vs Allegations), and the operator's settled policy **`policy_no_censorship`** (truth self-heals through argument; hostile rhetoric is INPUT to the bot adversarial process, not a defect — mirrored from `2026-06-04-corpus-30-analysis.md:14,215`):

- This board is **product-mechanism / playability feedback on pre-launch prod-synthetic data.** It is NOT organic-traffic evidence, NOT ramp evidence, NOT factual standing of any claim, and NOT a verdict on any author.
- A reviewer mark describes a **point's standing in the synthetic game or a tooling artifact**, never the objective truth of a claim and never a judgment about a person.
- **This is NOT a suppression workflow.** Hostile rhetoric is the adversarial corpus's INPUT, not a defect. This board does NOT propose, recommend, or contain any step that would ban, redact, hide, filter, suppress, or block content. We do NOT remove hostile rhetoric; we do NOT tighten a dissent detector, ban-list, or `submit-argument` validator. The `hostile-but-converted` column below is a *playability* observation (did a hostile opening narrow or concede later), never a request to harden the submission path. See `policy_no_censorship` and §6 of this doc.
- Reviewers **REPORT observations**; they do not act on content. The board's verdict is "usable / needs another pass" and "file / do-not-file the planner-rotation follow-on" — nothing more.

---

## 2. Required reading (committed upstream artifacts — do not edit them)

The review board reads, never modifies, these committed outputs:

1. [`2026-06-04-corpus-30-analysis.md`](./2026-06-04-corpus-30-analysis.md) — `CORPUS-30-RESULTS-001` (#466). Run-level facts, §1 disclaimer, §6 diversity read, §15 attestation pattern.
2. [`2026-06-04-corpus-30-phase7-observation.md`](./2026-06-04-corpus-30-phase7-observation.md) — `PHASE7-OBSERVATION-001` (#465). A–G classifier coverage (zero gaps), Σ-success 40.5% PARTIAL, H/I/J leakage ZERO.
3. [`2026-06-03-xai-adversarial-bot-corpus.md`](./2026-06-03-xai-adversarial-bot-corpus.md) + [`2026-06-03-xai-adversarial-corpus-summary.md`](./2026-06-03-xai-adversarial-corpus-summary.md) — source run reports (PR #481). Used by the reviewer to identify review-worthy debates. **Bodies stay in the reviewer's own view; they never enter this committed doc.**

The reporter metrics referenced in §4 below are the now-landed twin metrics in `scripts/bot-fixtures/xaiAdversarialReport.js` (CORPUS-30-QUALITY-001 #467 and CORPUS-30-DIVERSITY-001 #468). The metric names used here match the source verbatim.

---

## 3. Why a fixed-schema board (not free-form notes)

Findings have to be **routable**. Each flagged row maps to exactly one of five owners (UX / planner-rendering / classifier / admin-tooling / doctrine) so the operator can spin follow-up cards without re-reading 300 bodies. The schema also enforces the doctrine boundary at authoring time — the column set deliberately contains **no truth / verdict column**, so a reviewer cannot accidentally record a correctness judgment about an author (§1 / §10a).

The automated diversity and Phase-7 readouts measure *mechanism* (coverage, fallback rate, voice / spine spread, classifier success rate). They cannot judge whether a debate reads as a useful, non-repetitive, non-confusing exchange to a human, or whether a machine Observation label was helpful vs. noisy on a real thread. That human judgment is the gap this board closes.

---

## 4. How to READ the landed reporter metrics as data

Before filling rows, the reviewer reads the four landed reporter metrics from the run's report. These are computed by `scripts/bot-fixtures/xaiAdversarialReport.js` (twins of the runner's, locked in step). The names below are verbatim from that source. The point of this section is to teach the reviewer **what the bands mean and what patterns to look for** — the metric is the structural signal; the reviewer's read is the human signal that confirms or contradicts it.

### 4.1 `fallbackReasonHistogram` (CORPUS-30-QUALITY-001 #467)

- **What it is.** A per-reason histogram of which deterministic-fallback cause fired, bucketed on each issue token's **prefix** (the text before the first `:`), so no user-label value or option-spine id payload reaches committable Markdown. It reports `totalFallback` deterministic-fallback moves out of `nonSeedMoveCount` non-seed moves and names the `dominantReason`.
- **Run context.** For `d49e04cd` the renderer fell back ~90.4% of M3–M10 moves (`analysis.md:152-153`); the histogram is how the operator sees *which* validation step dominates the fallback.
- **What to look for as a reviewer.** When the histogram's `dominantReason` is one cause (e.g. a spine-alignment prefix), read several debates whose moves came from that fallback path and ask: do those moves still read as a coherent move-and-counter, or do they read templated / samey? A high fallback rate with conversations that still read fine is a tooling note (mark `planner-or-rendering-issue`); a high fallback rate with conversations that read flat is the same mark plus a note that the deterministic skeleton is visible to a human.

### 4.2 `sameyMoveFromEvents` (CORPUS-30-QUALITY-001 #467)

- **What it is.** A token-set **Jaccard** overlap metric across moves within each thread. It replaces the old exact-hash-only check that structurally could not fire on real similarity (`analysis.md:91`). Constants: high-pair threshold `0.60` (any pair at/above → RED), yellow mean threshold `0.35`.
- **The N<50 `n/a` guard.** Below `SAMEY_MOVE_SAMPLE_FLOOR = 50` non-empty body samples, the metric emits **`n/a (insufficient_samples)`** and **never reads green** (§4-T hard guard). This means: a small or attribution-thin run does not get a false "samey: GREEN." When the reviewer sees `severityBand=n/a · reason=insufficient_samples`, the structural signal is simply *absent* — it neither clears nor convicts the run, and the human read carries the full weight.
- **What to look for as a reviewer.** If the band reads GREEN (mean below 0.35, no high pairs) but the reviewer's own reading of the threads feels repetitive, mark `repetitive` and write a neutral note. That divergence — green metric, samey-to-a-human reading — is exactly the evidence the planner-rotation trigger in §7 watches for. If the band reads `n/a`, do not treat it as a pass; read the threads directly.

### 4.3 `recalibrateVoiceBand` (CORPUS-30-DIVERSITY-001 #468)

- **What it is.** The voice-distribution band, **recalibrated to planner reality**. The old hardcoded `count < 5 || count > 12` band was tuned for a per-slot distribution the per-bot-account planner never emits: with B fixed bot accounts over N rooms, `assignVoiceId(runId, botUserId)` deterministically yields B distinct voices each at count = N, so all B landed out-of-band → a **false YELLOW on a healthy planner** (`analysis.md:90`). The recalibrated band derives expectation FROM the stream (`expectedPerVoice = totalVoiceAssignments / distinctVoiceCount`; `expectedDistinctVoices = max per-room voice cardinality`).
- **The teeth (§4-T band recalibration, not removal).** Two independent teeth remain: **Tooth A** — per-voice material deviation (below `expectedPerVoice × 0.5` or above `× 2.0`) catches a wildly imbalanced split; **Tooth B** — distinct-voice collapse (a run-wide collapse to a single voice across ≥2 rooms → RED; partial collapse / per-voice deviation / same-room collision → YELLOW). Empty voice stream → `n/a`, never green.
- **What to look for as a reviewer.** The recalibrated band should now read GREEN for the 3-bots-per-run planner. The reviewer's job is to confirm the *human* read matches: do the three voices (`analogist`, `scope_narrower`, `plain_skeptic` for `d49e04cd` — `analysis.md:99-104`) actually read as three distinct voices across a thread, or do they blur into one tone? This is the structural Voice-YELLOW question (§6 of `analysis.md`) made human. See §7 for what a divergence here triggers.

### 4.4 `qualityThresholds` (CORPUS-30-QUALITY-001 #467)

- **What it is.** Reporter thresholds with **attribution gates**. Three bands: `deterministicFallbackPct` (yellow 20% / red 40%), `topOpeningPhrasePct` (yellow 8% / red 15%), and `sameyMoveMean` (delegates to §4.2). Each band carries an attribution gate: when the underlying signal is absent (no non-seed `move_validated` events, no opening-phrase signal, samey below the sample floor), the band is **`n/a` with `attributionPresent: false`** and **`n/a` is never folded into green** (§4-T hard guard).
- **What to look for as a reviewer.** Read the three bands first; they set expectations. A YELLOW `deterministicFallbackPct` says the renderer leaned on the skeleton a lot — go read those threads. A YELLOW `topOpeningPhrasePct` says many moves opened with the same phrasing — look for whether openings feel copy-pasted to a human. An `n/a` band means the data to judge was absent; the reviewer reads the threads directly rather than assuming a pass.

---

## 5. Review table (30 rows, one per debate)

**How to fill.** The operator reviews a floor of **≥10 of the 30** debates (depth above the floor is the operator's choice — `SPRINT-CORPUS-30-FOLLOWUP-BACKLOG.md:1554-1555`). For each reviewed debate, paste the **shortened debate id** (first 8 hex of the debate UUID — never the full UUID, never the room title) into `debate_short_id`, then mark `✓` / `—` per column and add a neutral note. Leave unreviewed rows blank.

**Leak-safe ceiling (binding).** No full UUID, no room title (titles can echo input text — `runXaiAdversarialBotCorpus.js:456,767`), no raw body, no quote of hostile text, no X handle, no URL, no post id, no email, no secret-shaped string — **not even in a notes cell.** Notes reference shortened ids / 16-hex `tokenSetHash` prefixes and neutral summaries only.

**Column meanings (all neutral, no truth column):**

| Column | Type | Meaning (neutral, doctrine-safe) |
|---|---|---|
| `debate_short_id` | shortened id (first 8 hex of debate UUID) | identifies the row; never the full UUID, never the room title |
| `useful` | ✓ / — | did the exchange read as a substantive move-and-counter? |
| `repetitive` | ✓ / — | did moves restate prior moves (samey)? cross-check `sameyMoveFromEvents` (§4.2) |
| `confusing` | ✓ / — | was the thread hard to follow / disjoint? |
| `hostile-but-converted` | ✓ / — | a hostile opening that narrowed / conceded later — a *playability* signal, NOT a defect, NOT a censorship trigger |
| `label-helpful` | ✓ / — | a machine Observation chip read as useful on this thread |
| `label-noisy` | ✓ / — | a machine Observation chip read as noise / misfit (advisory only) |
| `admin-UX-problem` | ✓ / — | the row was hard to find / triage in Admin > Arguments |
| `classifier-issue` | ✓ / — | a classifier Observation looked wrong / missing (advisory only — never a gate) |
| `planner-or-rendering-issue` | ✓ / — | planner seed / spine / voice / deterministic-fallback artifact; cross-ref §4.1–§4.4 |
| `notes` | neutral free-text | shortened-id references + neutral summary; NO raw body, NO quote of hostile text |

**Doctrine guard baked into the schema.** There is deliberately no `winner` / `correct` / `true` / `who-was-right` column. The marks are gameplay / playability / usability Observations only (§1, §10a). A reviewer cannot record a correctness judgment about an author because the schema has nowhere to put one.

| # | debate_short_id | useful | repetitive | confusing | hostile-but-converted | label-helpful | label-noisy | admin-UX-problem | classifier-issue | planner-or-rendering-issue | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 |  |  |  |  |  |  |  |  |  |  |  |
| 02 |  |  |  |  |  |  |  |  |  |  |  |
| 03 |  |  |  |  |  |  |  |  |  |  |  |
| 04 |  |  |  |  |  |  |  |  |  |  |  |
| 05 |  |  |  |  |  |  |  |  |  |  |  |
| 06 |  |  |  |  |  |  |  |  |  |  |  |
| 07 |  |  |  |  |  |  |  |  |  |  |  |
| 08 |  |  |  |  |  |  |  |  |  |  |  |
| 09 |  |  |  |  |  |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |  |  |  |  |  |
| 11 |  |  |  |  |  |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |  |  |  |  |  |
| 14 |  |  |  |  |  |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |  |  |  |  |  |
| 16 |  |  |  |  |  |  |  |  |  |  |  |
| 17 |  |  |  |  |  |  |  |  |  |  |  |
| 18 |  |  |  |  |  |  |  |  |  |  |  |
| 19 |  |  |  |  |  |  |  |  |  |  |  |
| 20 |  |  |  |  |  |  |  |  |  |  |  |
| 21 |  |  |  |  |  |  |  |  |  |  |  |
| 22 |  |  |  |  |  |  |  |  |  |  |  |
| 23 |  |  |  |  |  |  |  |  |  |  |  |
| 24 |  |  |  |  |  |  |  |  |  |  |  |
| 25 |  |  |  |  |  |  |  |  |  |  |  |
| 26 |  |  |  |  |  |  |  |  |  |  |  |
| 27 |  |  |  |  |  |  |  |  |  |  |  |
| 28 |  |  |  |  |  |  |  |  |  |  |  |
| 29 |  |  |  |  |  |  |  |  |  |  |  |
| 30 |  |  |  |  |  |  |  |  |  |  |  |

_All 30 rows are pre-populated as empty slots. The operator fills the `debate_short_id` + marks for ≥10. Shortened-id uniqueness across the filled rows is verified during the pass; if two first-8-hex ids collide, extend to 10 hex (design open-question #2)._

---

## 6. `policy_no_censorship` — this is NOT a suppression workflow

This section is binding and restated for emphasis. Per the operator's settled `policy_no_censorship` (`analysis.md:215`):

- Hostile rhetoric is **INPUT** to the bot adversarial process, **not a defect**. The adversarial corpus deliberately seeds hostile openings so the planner / renderer / classifier substrate can be exercised against friction.
- This board does **NOT** contain a suppression rule, recipe, or action step. There is no step in this workflow that would ban, redact, hide, filter, suppress, or block any content. We do **NOT** remove hostile rhetoric; we do **NOT** propose a dissent detector, a ban-list expansion, semantic redaction, or a `submit-argument` validator tightening.
- The `hostile-but-converted` column records *playability* — whether a hostile opening narrowed or conceded as the thread progressed — because conversion-under-pressure is the interesting game signal. A `✓` there is praise for the exchange's playability, never a flag to harden the submission path.
- A reviewer's only permitted outputs are observations and the two verdicts in §0 / §8. A reviewer REPORTS; a reviewer does not act on content.

If any proposed finding reads as "if reviewers find X, remove / redact / hide / filter / ban / suppress / block X," that finding is **out of scope** and must not be written — it is barred by `policy_no_censorship`. The board defers entirely to that policy.

---

## 7. Evidence trigger for the deferred planner-rotation card (conditional follow-on)

The structural Voice-distribution question (§4.3, and `analysis.md:90,99-105`) is this: the planner assigns one voice per bot account per run (`assignVoiceId(runId, botUserId)`), so a 3-bot run yields exactly 3 voices. CORPUS-30-DIVERSITY-001 (#468) recalibrated the reporter band so this healthy 3-bot planner now reads **GREEN** instead of a false YELLOW. A **planner-rotation** change (rotating voices per-thread rather than per-account) was **deferred** — it is NOT scheduled and NOT recommended by this doc.

This board defines the **evidence trigger** that would justify *filing* (not building) the deferred planner-rotation card:

- **Trigger met → file the follow-on.** If reviewers, across multiple reviewed runs, find conversations that GENUINELY read voice-samey to a human (the three voices blur into one tone) **despite the recalibrated band reading GREEN**, that human-vs-metric divergence is the evidence to file the planner-rotation follow-on card for the operator's consideration. Record the divergence in the affected rows' `planner-or-rendering-issue` column + a neutral note, and summarize it in the §8 planner-rendering bucket.
- **Trigger NOT met → planner-rotation stays deferred.** If reviewed conversations read fine (the voices read distinct) and the band reads GREEN, the structural Voice-YELLOW question is **settled**: the recalibrated band matched reality, and planner-rotation stays deferred. Record "voice read distinct; band GREEN; planner-rotation stays deferred" in the §8 bucket.

This is a **conditional, evidence-triggered** follow-on. This doc does **NOT** declare that planner-rotation should be built. The trigger is reviewer evidence across multiple runs; absent that evidence, nothing is filed.

---

## 8. Five-bucket findings map

After the operator fills ≥10 rows, each flagged cell rolls up to exactly one owner bucket. Each bucket gets a one-line neutral summary + a candidate follow-up card name. **No card is filed by this doc** (non-goal — each becomes its own backlog card at the operator's discretion).

1. **UX** (room / gallery / timeline readability) → candidate cards. _Summary: _
2. **planner-rendering** (seed / spine / voice / deterministic-fallback) → cross-ref `#467` / `#468`; the §7 planner-rotation trigger reports here. _Summary: _
3. **classifier** (Observation helpful / noisy / missing — advisory only) → cross-ref `#470` (classifier health panel) / Phase-7 follow-ups. _Summary: _
4. **admin-tooling** (find / triage / group bot rows) → cross-ref `#463` (`ADMIN-ARGS-CANONICAL-001`) / `#464` (`ADMIN-ARGS-INACTIVE-001`). _Summary: _
5. **doctrine** (any label that drifted toward a verdict, any sensitive Observation surfaced wrongly) → §1 / §10a. _Summary: _

**Run-level verdict (operator fills after the pass):** `[ usable | needs another pass ]` — neutral one-line rationale. This verdict is about the SYNTHETIC run's quality / diversity only; it cannot block, reject, route, or delay any user submission (§0).

---

## 9. Candidate follow-ups

Bulleted, one line each. **No new card filed here** (non-goal). Operator decides which to spin.

- _(operator fills after the ≥10 pass)_

---

## 10. Doctrine attestation

- **§1 no truth labels.** The review schema has no `winner` / `correct` / `true` column; all marks are gameplay / usability / playability Observations.
- **§3 popularity not evidence.** The board records no engagement-as-evidence; the synthetic-evidence disclaimer (§1) binds every observation.
- **§4 AI moderator advisory-only.** `classifier-issue` marks read machine Observations as advisory; nothing here gates submission. The acceptance-gate invariant (§0) is restated verbatim.
- **§4-C never-self-approve.** No H/I/J `productionEnabled` flip; no routing arm; the frozen set is untouched.
- **§4-T no bar lowering.** The reporter metrics (§4) are read as-landed (Jaccard samey-move with the N<50 `n/a` guard; the recalibrated voice band with both teeth; the attribution-gated quality thresholds). The ≥10/30 floor is a depth floor; the leak-safe ceiling is a tightening.
- **§5 engine.ts sacred.** Untouched; it remains the sole acceptance gate (§0).
- **§6 secrets.** No secret value in this doc.
- **§7 no AI from production app.** The run under review used `scripts/bot-fixtures/` only; this board makes no provider call.
- **§8 soft-delete / append-only / RLS.** No row mutated; the 30 corpus rows stay (`analysis.md:179`).
- **§9 plain-language mapping.** Internal codes (`fallbackReasonHistogram`, `sameyMoveFromEvents`, `recalibrateVoiceBand`, `qualityThresholds`, `tokenSetHash`, `deterministicSkeletonFill`) appear with operator-facing gloss; user-facing strings are unaffected (docs-only).
- **§10a Observations vs Allegations.** Machine labels stay Observations; the board never promotes one to an Allegation about an author. Sensitive Observations are never surfaced in this committed doc.
- **`policy_no_censorship`.** Hostile rhetoric is INPUT, not defect (§6). This board does NOT propose a dissent detector, ban-list, semantic redaction, or `submit-argument` validator tightening, and contains no suppression action step. It defers entirely to `policy_no_censorship`.
