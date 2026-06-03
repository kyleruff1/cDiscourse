# CORPUS-30-TINY-STAGE-RUNBOOK — operator runbook (2026-06-03)

> **What this is.** The paste-ready, operator-driven runbook for the **tiny stage** of the CORPUS-30 pool-driven pipeline: the **first live spend** — small N — exercising the full path (live xAI harvest → live bank builder → live Anthropic move rendering → live posting via `submit-argument` to the pre-launch-prod-synthetic Supabase target) before the 30-thread run.
>
> **What it is not.** This is not the dry stage (zero spend — already passed, see `CORPUS-30-DRY-STAGE-RUNBOOK.md`), not the 30-thread run, not the classifier-observation step. Each later stage gets its own runbook.
>
> **Governance:** runs under `docs/core/pipeline-governance-contract.md` v1. §3 HALT conditions + §4 never-self-approve apply. The target is **pre-launch prod synthetic only** — not dev, not organic, not ramp evidence, never claimed as Stage-1 evidence.

> **What the dry stage proved (the predicate for this card):**
> Latest dry run (`053de198`, 2026-06-03T15:20Z) — attribution chain complete on every `move_validated` (11 fields), runTag `corpus-dev-synthetic-20260603-1520-053de198` (new format, no `runId.slice(0,8)` regression), 12/12 `submit_attempt.reason='dry_mode'` and `submit_result.status='skipped'`, zero `submit_ok`/`debate_inserted`/`argument_inserted`/service-role signatures, per-thread no-reuse holds, no consecutive spine repeats, no bank-exhaustion resets, leak-clean. Reporter §9 = 4/5 GREEN + 1 YELLOW on voice distribution (a known small-sample artifact at 6 bot slots; will resolve at tiny+ scale).

---

## 1. Why tiny before 30 (the case for spending a little before spending a lot)

The dry stage proved every component is deterministic, the planner emits attribution, and the runner does not post in dry mode. **It did not prove** anything end-to-end against the live providers or the live Supabase: that xAI returns a non-empty harvest under `--pilot`, that the bank builder digests *that* harvest without bank-shortfall, that Anthropic renders option-aligned moves through the new prompt, that the live runner inserts debates + participants correctly under bot RLS, that `submit-argument` accepts the new moves, and that the room title `[<runTag> t##]` actually lets the UI filter to this run only.

The tiny stage proves all of that at the smallest defensible scale (5 sources × 5 replies harvest + 3–5 scenarios bot fixture, each 6 moves deep), with full operator visual review before scaling to 30. **Cost:** small. xAI Live Search calls + Anthropic Haiku calls for ~15–30 generated moves. **What's at risk:** ~3–5 synthetic debate rooms in pre-launch prod, all explicitly tagged so they're trivially filterable out of any later view.

---

## 2. Prerequisites (Phase 0 re-verification — REQUIRED before Step 1; do not skip)

Tiny spends real money against a real provider and posts to a real (pre-launch) Supabase project. Re-verify even though we did it for dry.

```bash
cd ~/cdiscourse/debate-constitution-app

# (a) Supabase target — explicit operator override active, target is pre-launch prod
cat supabase/.temp/project-ref   # expect: qsciikhztvzzohssddrq
# Say out loud to yourself: "this run will write debates + arguments to qsciikhztvzzohssddrq, tagged corpus-prod-synthetic-<YYYYMMDD-HHMM>-<8hex>, no deletion of anything."

# (b) Baseline gates still green
npm run typecheck                # expect EXIT 0
npm run lint                     # expect EXIT 0
# (test suite optional — we ran it after the planner merge; no source touched since)

# (c) Required env files exist + gitignored
test -f .env.engagement-intelligence && git check-ignore .env.engagement-intelligence ; echo $?  # expect 0
test -f .env.bot-tests              && git check-ignore .env.bot-tests              ; echo $?  # expect 0

# (d) Required env booleans (booleans only — never paste values)
bash -c 'set +x; set -a; . .env.engagement-intelligence 2>/dev/null; set +a;
  echo hasXaiKey=$([ -n "${XAI_API_KEY:-}" ] && echo true || echo false);
  echo enableXai=$([ "${ENGAGEMENT_INTEL_ENABLE_XAI:-}" = true ] && echo true || echo false);
  echo hasAnthropicKey=$([ -n "${ANTHROPIC_API_KEY:-}" ] && echo true || echo false);
  echo enableAnthropic=$([ "${ENGAGEMENT_INTEL_ENABLE_ANTHROPIC:-}" = true ] && echo true || echo false)'
bash -c 'set +x; set -a; . .env.bot-tests 2>/dev/null; set +a;
  echo hasBotA=$([ -n "${CDISCOURSE_BOT_A_EMAIL:-}${CDISCOURSE_BOT_A_PASSWORD:-}" ] && echo true || echo false);
  echo hasBotB=$([ -n "${CDISCOURSE_BOT_B_EMAIL:-}${CDISCOURSE_BOT_B_PASSWORD:-}" ] && echo true || echo false);
  echo hasBotC=$([ -n "${CDISCOURSE_BOT_C_EMAIL:-}${CDISCOURSE_BOT_C_PASSWORD:-}" ] && echo true || echo false);
  echo hasSupabaseUrlProd=$([ "${EXPO_PUBLIC_SUPABASE_URL:-}" = "https://qsciikhztvzzohssddrq.supabase.co" ] && echo true || echo false)'
# All booleans must be true.

# (e) Skills clean (the four CORPUS-30 verification commands)
grep -n "voice / diversity engine" ../.claude/skills/bot-provocateur/SKILL.md
grep -n "voice / diversity engine" ../.claude/skills/bot-revocateur/SKILL.md
grep -n "Fresh start = filtered view" ../.claude/skills/xai-adversarial-corpus-operator/SKILL.md
find ../.claude/skills -maxdepth 2 -name "*-SKILL.md" -print     # expect empty

# (f) Routing is still disarmed (the tiny run must not depend on or affect classifier queue routing)
# NOTE: actual digest verification is operator-only. Boolean expectation:
#   CLASSIFIER_QUEUE_ROUTING_ENABLED  → false (digest = SHA256("false") = fcbcf165...)
#   CLASSIFIER_QUEUE_ROUTING_PERCENTAGE → 0     (digest = SHA256("0")     = 5feceb66...)
# I (Claude) can verify these read-only via `npx supabase secrets list` if you say go.

# (g) The dry stage produced a clean banked pool we can re-use OR we re-harvest live (Step 1)
ls -lt logs/engagement-intelligence/*xai-adversarial-banked-pool*.jsonl 2>/dev/null | head -1
# If a recent banked pool exists, you can skip Step 1+2 and go straight to Step 3 with --banked-pool <that path>.
# If you want a fresh xAI-live harvest, run Step 1+2 below.
```

**HALT if any check fails.** Specifically: a false on `enableXai` / `enableAnthropic` / `hasBotA` is a hard HALT — tiny will silently degrade or fail at the wrong layer.

---

## 3. Step 1 — live xAI harvest (small — `--pilot --stories 5 --replies 5`)

**You run:**

```bash
npm run engagement:intel:xai:adversarial:tiny
```

Which is exactly:
```bash
node scripts/engagement-intelligence/xaiAdversarialSourceHarvest.js --pilot --stories 5 --replies 5
```

**What this does (LIVE xAI call):**
- Gates on `ENGAGEMENT_INTEL_ENABLE_XAI=true` + `XAI_API_KEY` non-empty + `--pilot` flag — refuses to spend without all three.
- Calls xAI **X Search** (Responses API + `x_search` tool) for replies to argument-worthy news posts. 5 source posts × up to 5 candidate replies + classifier — small bounded spend.
- Per-source redaction runs through `xaiSourceRedactor.redactRaw` on every body before write — X handles, URLs, post IDs, JWTs, bearer tokens stripped.
- Per-source classifier (deterministic `xaiDissentDetector`) picks `selectedDissent.playableSkeleton`.
- Emits JSONL at `logs/engagement-intelligence/<runId>-xai-adversarial-harvest.jsonl` (gitignored) + Markdown at `docs/testing-runs/<YYYY-MM-DD>-xai-adversarial-corpus-summary.md` (committable, redacted).

**Capture and paste:**
- The runId printed by the script (form `<ISO>-<8hex>`).
- The harvest JSONL path (full path).
- The first ~30 lines of stdout (the run_start / skill_validation / first source_harvest events).
- If the script exited non-zero: the stderr.

**I verify (read-only — no further provider call):**

1. Skill gate fired before the network — first event must be `skill_validation` with `validated:true`.
2. xAI returned non-empty results — at least 3 of 5 sources have ≥1 usable reply (`usableForBotDebate:true`). Tiny aliases use `--stories 5`; an empty xAI response (geo-block, throttle, API change) is a HALT.
3. Stage sequence well-formed: `run_start → skill_validation → source_harvest × N → reply_harvest × M → dissent_detection × N → scenario_build × eligible → run_summary`.
4. Redaction holds: no X handle (1–15 chars after `@`), no `x.com` / `t.co` / `twitter.com` URL, no 15–20-digit post ID, no JWT-shape, no `sk-ant-*`/`ddp_*`/`sb_secret_*` in either the JSONL or the Markdown.
5. Markdown summary at the expected path; H1/section structure matches the harvester's template (Doctrine reminder · Skill gate · Counts · Distributions).
6. Capture the exact `runId` and JSONL path for Step 2.

**HALT triggers for Step 1:**
- Script exit code ≠ 0.
- `skill_validation.validated:false` or any banned-token hit on a SKILL.md.
- xAI returned zero usable replies (geo-block / throttle / API-shape change).
- Any raw X identifier in the JSONL or Markdown — surface the offending field path; do NOT proceed.
- `dry:true` accidentally set on the run_start event — that means the alias regressed; halt and fix `package.json`.

---

## 4. Step 2 — build banked pool from the live tiny harvest (deterministic, no spend)

**You run:**

```bash
# Replace <runId> with the value Step 1 reported.
node scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js \
  --in  logs/engagement-intelligence/<runId>-xai-adversarial-harvest.jsonl \
  --out logs/engagement-intelligence/<runId>-xai-adversarial-banked-pool.jsonl \
  --target-count 5     # tiny target — match the 3–5 scenarios we'll run in Step 3
```

(Note: `--target-count 5` for tiny, not 30. With only 5 sources harvested, 5 eligible seeds is the cap.)

**What this does (deterministic, no network):**
- Reads the live tiny harvest JSONL.
- Derives the 6 option banks per seed via design §4.2 derivation rules (paraphrase templates + `replyFunction`-routed classified replies + skeleton-derived templates + provenance stamping).
- Validates each bank against `BANK_FLOORS` (4/4/4/3/3/3). Seeds below floor get `bankShortfall:true`.
- Emits `seed_pool_summary` with eligible / shortfall counts.

**Capture and paste:**
- Stdout from the builder (the summary line + per-seed eligibility).
- The banked pool JSONL path.

**I verify (read-only):**
1. Output file exists; well-formed JSONL (one seed per line); ≥3 eligible seeds for a 3–5-scenario tiny run.
2. Every option carries `optionId`, `bankName`, `skeleton.{targetExcerpt, spineHint, axisHint, summary, evidenceDebt[], antiAmplificationNote}`, and `provenance` ∈ `{harvester_post_processed, paraphrase_rule, synthetic_default}`.
3. No raw X content in any field (re-check; redaction runs at harvest, but a regression at the builder would leak too).
4. The `REPLY_FUNCTION_TO_BANKS` bridge map reads sensibly on this seed set — `insult_only`/`tangent`/`unclear` route to no bank; provocateur banks (opening/evidence_pressure/alt_explanation/concession_or_narrowing) and revocateur banks (objection/evidence_pressure/alt_explanation/resolution_pressure) all have ≥ floor counts on eligible seeds.

**HALT triggers for Step 2:**
- Builder exit ≠ 0.
- Fewer than 3 eligible seeds (would force `bank_exhausted_reset` early in Step 3).
- Any banked option contains raw X content.

---

## 5. Step 3 — bot fixture LIVE (Anthropic + posting to pre-launch prod)

This is the load-bearing step. Real Anthropic calls. Real Supabase posts.

**You run** (small scenario count — start with 3, can repeat with 5 if 3 is clean):

```bash
node scripts/bot-fixtures/runXaiAdversarialBotCorpus.js \
  --pilot \
  --scenarios 3 \
  --max-depth 6 \
  --banked-pool logs/engagement-intelligence/<runId>-xai-adversarial-banked-pool.jsonl \
  --run-kind corpus-prod-synthetic
```

(The `--run-kind corpus-prod-synthetic` makes the runTag prefix `corpus-prod-synthetic-…` instead of `corpus-dev-synthetic-…` — important for downstream filtering and for honest summary attribution.)

**What this does (LIVE):**
- Re-runs Phase-0-style env gate: refuses without `--pilot` + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `ANTHROPIC_API_KEY` + `.env.bot-tests`.
- Generates a `runTag` of the form `corpus-prod-synthetic-YYYYMMDD-HHMM-<8hex>` (the bug-fixed slice).
- Signs in bots A/B/C via Supabase Auth (normal email/password — no service-role).
- For each scenario (3 scenarios this run):
  - Planner: deterministic seed pick (Fisher-Yates over runId) → unique seed per scenario, no repeat.
  - Scene builder: bot↔role shuffle (LCG keyed on seed+sourceHash+replyHash).
  - **Direct `.insert` into `public.debates`** — debate row created under the signed-in bot's RLS, title prefix `[<runTag> t<NN>]`.
  - **`.insert` into `public.debate_participants`** — bot users added as participants.
  - Per move M1–M6:
    - Planner: deterministic `(bankName, optionIndex)` pick + per-thread no-reuse.
    - Voice/spine assignment (deterministic per `(runId, botUserId)` and `(runId, threadIndex, moveIndex)`).
    - **Anthropic call** through `renderAlignedAdversarialMove` — option-aligned prompt; one retry on validator failure; deterministic skeleton-fill fallback.
    - **`submit-argument` Edge Function** posts the rendered body. Per-attempt retry budget is the runner's existing policy (no change).
  - Stop-early conditions preserved (concession, synthesis, etc.).
- Emits JSONL at `logs/engagement-intelligence/<runTag>.jsonl` (gitignored) + Markdown at `docs/testing-runs/<date>-xai-adversarial-bot-corpus.md` (committable — no `-dry` suffix this time).

**Capture and paste:**
- Stdout from the run (especially the `run_start` line — confirms `dry:false` + correct runKind).
- The final `run_summary` event.
- The runTag (in the room title or in JSONL).
- Markdown summary path.

**Approximate spend:** 3 scenarios × ~6 moves × 1 Anthropic call/move = ~18 Anthropic Haiku calls. xAI is not called in this step (the harvest was Step 1). Supabase writes: 3 debate inserts + ~6 participant inserts + 18 `submit-argument` invocations (which each do 1 RLS-mediated `public.arguments` insert) = ~27 RLS writes.

---

## 6. Post-run read-only DB analysis — filtered by runTag

After Step 3, I can run **read-only, metadata-only** SQL to verify the run hit prod-synthetic as expected. **Every query is `LIKE`-filtered to the runTag** — no broad scans.

**You authorize each query** (Claude will paste the exact SQL before running it; you say "go" or "skip"). Candidate queries:

```sql
-- (Q1) Debate count + arg count + bot-author distribution for this run only
WITH this_run AS (
  SELECT id FROM public.debates WHERE title LIKE '%<runTag>%'
)
SELECT
  (SELECT count(*) FROM public.debates  WHERE id IN (SELECT id FROM this_run))                       AS debates,
  (SELECT count(*) FROM public.arguments WHERE debate_id IN (SELECT id FROM this_run))               AS arguments,
  (SELECT count(DISTINCT user_id) FROM public.arguments WHERE debate_id IN (SELECT id FROM this_run)) AS distinct_authors;

-- (Q2) Per-thread move count (expect 3 threads × ~6 moves ≈ 18 arguments)
SELECT d.title, count(a.id) AS moves
FROM public.debates d
LEFT JOIN public.arguments a ON a.debate_id = d.id
WHERE d.title LIKE '%<runTag>%'
GROUP BY d.title
ORDER BY d.title;

-- (Q3) Did the title-prefix tag survive intact on every debate? (regression check on the runTag fix)
SELECT title FROM public.debates WHERE title LIKE '%<runTag>%' ORDER BY created_at;

-- (Q4) Did anything OUTSIDE this run get inserted in the window? (boundary check)
SELECT count(*)
FROM public.debates
WHERE created_at BETWEEN '<run_start_ts>' AND '<run_end_ts>'
  AND title NOT LIKE '%<runTag>%';
-- Expected: 0
```

**I do not run any of these without your explicit "go".** No JSONL body / `evidence_span` text / argument body is included in any committable summary — counts and titles only.

---

## 7. UI filter — visual review (the human eyeball gate)

**You open the app** (whatever cdiscourse-mcp-server URL you use for synthetic testing) and:

1. Filter the debate list to the runTag prefix (e.g. search `corpus-prod-synthetic-20260603-1630-`).
2. Spot-check at least 2 of the 3 debates manually:
   - **Conversation reads like a real exchange.** M1 is a real claim. M2 is a real rebuttal. M3+ alternate provocateur ↔ revocateur — and the bots **sound different** (different voice). Moves are responsive (M3 addresses M2; not parallel monologues).
   - **No banned phrases** ("counter to the previous point", "the evidence disagreement is the heart of it", etc.).
   - **No raw X content** — no `@handle`, no `x.com/…` URL, no obvious slurs or hostile bare-text.
   - **No verdict / person-label language** — bots argue claims, never call the other side a liar/troll/bad-faith/etc.
   - **Diversity holds** — moves don't read as the same template with a noun swap; spines visibly rotate.

If any of these fails on inspection → HALT and surface the specific failure (which thread, which move, what wording).

---

## 8. Success criteria — green light for 30

The tiny stage is **PASS** when **all** of the following hold:

1. **Phase 0 re-verification green** (§2 — all booleans true, target = qsciikhztvzzohssddrq).
2. **Step 1** emits a well-formed live harvest JSONL + redacted Markdown; ≥3 sources with usable replies; zero raw X content.
3. **Step 2** emits a well-formed banked pool with ≥3 eligible seeds; every option carries provenance; no raw X.
4. **Step 3** completes without runner exit ≠ 0. `dry:false` + `runKind:corpus-prod-synthetic` confirmed on `run_start`. Every `submit_attempt` either succeeds (`submit_result.status='ok'`) or fails with a typed retry reason (no silent drops). Per-thread no-reuse holds. Spine no-consecutive-repeat holds. No `bank_exhausted_reset` events fire (or if they do, they're documented and the next selection is still valid).
5. **§9 reporter checks all GREEN** — or the YELLOW is mechanically explainable as a small-sample artifact (e.g. voice distribution YELLOW on 6 bot slots) AND the load-bearing signal (`collisions=0`) is green.
6. **Post-run DB analysis (operator-authorized queries)** confirms: expected debate count (3), expected arg count (~18), title-prefix tag intact on every row, no out-of-tag debate inserted in the run window.
7. **Visual review (§7)** confirms readable conversation, two visibly distinct voices per room, no banned phrases, no raw X, no verdict/person-label language, observable diversity.

If 1–7 all hold → green light for the 30 stage (separate runbook authored next session).

If any RED severity, or any visual quality issue, or any boundary leakage → HALT, surface the specifics, and file a fix card.

---

## 9. HALT discipline — what I do if any step fails

Per the governance contract §3 + the binding CORPUS-30 prompt:

- I do **not** "fix it and re-run." A bug surfaced at tiny is a code-fix card, not a hands-on tweak inside the runbook.
- I do **not** loosen any check to make it pass.
- I do **not** classify, arm queue routing, advance to 30, or call the production classifier.
- I do **not** mass-delete the tiny rooms. Per operator skill §49 (Fresh start = filtered view) — the tiny rooms stay in the DB, filterable out by their runTag prefix, until you decide otherwise (operator-only action, separate card).
- I surface the exact failure with `file:line` + the JSONL event that fired + a concrete recommended next card.

---

## 10. Boundaries (binding on this runbook)

- **xAI / Anthropic calls only at the budgeted rate** — Step 1 = ~5 source posts + ≤25 reply classifications; Step 3 = ~18 Anthropic Haiku calls. No path in this runbook does more.
- **Supabase writes only via the runner's existing path** — direct `.insert` on `debates` + `debate_participants` under bot RLS, then `submit-argument` for each move. **No service-role.** **No direct insert on `public.arguments`.**
- **No classifier call.** Classifier observation is the next stage's job; this runbook does not trigger `classify-argument-boolean-observations` or any admin-validation classify path.
- **No queue routing arm / no 5% / no H/I/J.** Routing remains baseline/off (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`).
- **No raw X content in committed docs.** JSONL with redacted bodies stays in `logs/engagement-intelligence/` (gitignored); committable Markdown carries only counts, distributions, and provenance categories. The runner's existing redaction at harvest is the only redaction — if a regression slips raw content into the committable doc, that's a HALT.
- **No mass-delete / clean / reset of any rooms or arguments.** Tiny rooms stay in the DB tagged; you filter the UI to ignore them.
- **Pre-launch prod synthetic only.** The Markdown summary doc must say so explicitly. Not organic. Not ramp evidence.
- **No new npm aliases / no `package.json` edit / no schema change.** This runbook describes the existing tiny path with the planner additions from PR #456 and the `--run-kind corpus-prod-synthetic` flag that PR #456 already added.

---

## 11. What this runbook is not

- **Not the 30 runbook.** 30 is the main event — its own runbook, gated on tiny passing 1–7 above.
- **Not the classifier-observation runbook.** Classifier observation is the last stage, gated on tiny + 30 having passed.
- **Not an authorization to deploy or arm anything.** It is a paste-and-verify procedure for an already-merged dev-tooling code path.
- **Not a Stage-1 evidence run.** Synthetic bot-authored corpus. Real human organic traffic is what unlocks Stage-1 evidence — this is not that.
