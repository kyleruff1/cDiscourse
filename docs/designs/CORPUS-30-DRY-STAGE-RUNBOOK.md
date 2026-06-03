# CORPUS-30-DRY-STAGE-RUNBOOK — operator runbook (2026-06-03)

> **What this is.** A paste-ready, operator-driven runbook for the **dry stage** of the CORPUS-30 pool-driven pipeline: post-processor → planner → renderer → reporter end-to-end with **zero provider spend and zero Supabase write**. The dry stage is the first verification gate before any live xAI / Anthropic / posting spend.
>
> **What it is not.** This is not the tiny stage (first live spend), not the 30-thread run, not the classifier-observation step. Each of those gets its own runbook when its time comes — see design §12 / §17 sequencing.
>
> **Governance:** runs under `docs/core/pipeline-governance-contract.md` v1. §3 HALT conditions + §4 never-self-approve apply. The eventual target is **pre-launch prod synthetic only** — not dev, not organic, not ramp evidence, never claimed as Stage-1 evidence.
>
> **Companion artifacts (already on `main`):**
> - Planner design: `docs/designs/CORPUS-30-POOL-DRIVEN-PLANNER.md`
> - Planner review: `docs/reviews/CORPUS-30-POOL-DRIVEN-PLANNER.md`
> - Planner code (merged in PR #456 / `424abdc`): `scripts/bot-fixtures/corpusPoolDrivenPlanner*.js`, `scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js`, plus the additive edits to runner / scene builder / move renderer / reporters.

---

## 1. Why dry first (the case for spending nothing yet)

The pool-driven planner is large (4269 LOC across new + modified files, +71 tests). The unit tests prove **every component in isolation** is deterministic and aligned with the design. They do **not** prove the modules are wired together correctly end-to-end in the runner, nor that the attribution flow produces a `severityBand: green` reporter result on a real harvest-shaped input.

The dry stage proves exactly those two things, at zero cost:

- **Zero network call.** The harvester's `--dry` path reads a canonical fixture and emits the same JSONL shape it would emit from a live xAI call. The bot runner's `--dry` path uses `submit_attempt.reason='dry_mode'` and `submit_result.status='skipped'` — no `submit-argument` invocation. The bank builder is fully deterministic, no provider call at any flag combination.
- **Zero Supabase write.** Dry mode does not call `debates.insert`, `debate_participants.insert`, or `submit-argument`. The DB state is unchanged before / after the dry run.
- **Full attribution path exercised.** The runner emits every JSONL event a live run would emit, with every new field the design requires (`bankName`, `optionIndex`, `optionId`, `voiceId`, `spineId`, `attribution`, `bank_exhausted_reset`). The reporter consumes the JSONL and emits the four §9 check categories.

A **red severity band** on the dry reporter is a HALT — it tells us the planner, scene builder, or reporter is wired wrong and tiny would burn provider budget proving the same wiring bug. A **green severity band** on the dry reporter is the green light to spend.

---

## 2. Prerequisites (Phase 0 re-verification — run before Step 1)

Even though we passed Phase 0 last session, re-verify these. They're cheap and the state can move between sessions.

```bash
cd ~/cdiscourse/debate-constitution-app

# (a) Supabase target — per operator override, prod is the target; confirm nothing accidentally re-linked
cat supabase/.temp/project-ref          # expect: qsciikhztvzzohssddrq

# (b) Baseline gates still green
npm run typecheck                       # expect: EXIT 0
npm run lint                            # expect: EXIT 0
npm run test                            # expect: EXIT 0, 614 suites / 19056 tests

# (c) Required env files exist, gitignored, carry the required keys (BOOLEANS ONLY — Claude verifies)
test -f .env.engagement-intelligence && git check-ignore .env.engagement-intelligence; echo $?  # expect: 0
test -f .env.bot-tests              && git check-ignore .env.bot-tests              ; echo $?  # expect: 0

# (d) Skills clean (the four CORPUS-30 verification commands)
grep -n "voice / diversity engine" ../.claude/skills/bot-provocateur/SKILL.md
grep -n "voice / diversity engine" ../.claude/skills/bot-revocateur/SKILL.md
grep -n "Fresh start = filtered view" ../.claude/skills/xai-adversarial-corpus-operator/SKILL.md
find ../.claude/skills -maxdepth 2 -name "*-SKILL.md" -print   # expect: empty

# (e) The new planner is on main
ls scripts/bot-fixtures/corpusPoolDrivenPlanner*.js scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js
git log --oneline -1                    # expect a commit at or after 424abdc
```

**HALT if any check fails.** Surface the exact failure and stop — don't proceed to Step 1 against an unverified baseline.

---

## 3. Step 1 — harvester dry run (zero network)

**You run:**

```bash
npm run engagement:intel:xai:adversarial:dry
```

**What this does (no network):**
- Reads the canonical dry fixture under `fixtures/engagement-intelligence/` (or equivalent).
- Emits a JSONL pool at `logs/engagement-intelligence/<runId>-xai-adversarial-harvest.jsonl` (gitignored).
- Emits a committable Markdown summary at `docs/testing-runs/<YYYY-MM-DD>-xai-adversarial-corpus-summary-dry.md`.
- Stamps a deterministic `runId` of the form `<ISO-with-separators-replaced>-<8hex>`.

**Paste the captured output here**, then I verify (read-only):
1. The JSONL path exists; its size is reasonable (~kilobytes, not bytes; not megabytes).
2. The JSONL event sequence is well-formed: `run_start` → `skill_validation` (gate first) → `source_harvest` → `reply_harvest` → `dissent_detection` → `scenario_build` → `run_summary`.
3. The Markdown summary exists at `docs/testing-runs/<date>-xai-adversarial-corpus-summary-dry.md`.
4. **No network call signature** in the output (no `xai_provider_call_*`, no `anthropic_call_*` events).
5. **Redaction is clean** — no raw X handles, URLs, post IDs, JWT, bearer, keys in the JSONL or the Markdown.
6. The harvester reports the exact `runId` for downstream steps.

**HALT triggers** for Step 1:
- Any event with `error` or non-zero exit code.
- Any raw X content (handle, URL, 15-20 digit ID) in either output file.
- Missing skill_validation event (skill gate didn't fire).

---

## 4. Step 2 — build the banked pool from the dry harvest

**You run** (this is the NEW step the planner added; no npm alias yet, so it's a direct node invocation):

```bash
# Take the harvest JSONL from Step 1 and run the deterministic post-processor.
# Replace <runId> with the value Step 1 reported.

node scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js \
  --in  logs/engagement-intelligence/<runId>-xai-adversarial-harvest.jsonl \
  --out logs/engagement-intelligence/<runId>-xai-adversarial-banked-pool.jsonl \
  --target-count 30
```

**What this does (deterministic, no network):**
- Reads the harvester JSONL.
- For each seed, derives the 6 option banks per design §4.2:
  - `opening_claim_options` — paraphrase templates over `sourcePost.claim`
  - `objection_options` — `selectedDissent.playableSkeleton` + `candidateReplies[replyFunction routed via REPLY_FUNCTION_TO_BANKS]`
  - `evidence_pressure_options` — `playableSkeleton.evidenceDebt[]` + classified replies + deterministic templates
  - `alternative_explanation_options` — classified replies + deterministic alt-reading templates
  - `concession_or_narrowing_options` — deterministic narrow/concede templates anchored on `disagreementAxis`
  - `resolution_pressure_options` — deterministic synthesis/branch/burden-shift templates + `antiAmplificationNote`
- Stamps `provenance` on every option (`harvester_post_processed | paraphrase_rule | synthetic_default`).
- Validates each bank against `BANK_FLOORS` (4/4/4/3/3/3 minimum). Seeds below floor get `bankShortfall: true` and the planner will skip them.
- Emits `seed_pool_summary` with eligible / shortfall counts.

**Paste the captured output here**, then I verify (read-only):
1. The banked pool JSONL exists; the file is well-formed JSONL with one seed per line.
2. **Eligibility count** — number of seeds passing all bank floors. For a dry fixture this is small (likely <30 — that's expected; the canonical fixture is tiny). The dry pass-criterion isn't 30 eligible seeds; it's "the builder produces the right shape and the floors check fires correctly."
3. Every option carries `optionId`, `bankName`, `skeleton.{targetExcerpt, spineHint, axisHint, summary, evidenceDebt[], antiAmplificationNote}`, and `provenance`.
4. No raw X content in any field (`targetExcerpt`, `summary`, `evidenceDebt` items, `antiAmplificationNote`).
5. The `REPLY_FUNCTION_TO_BANKS` bridge routed every `replyFunction` reasonably; `insult_only` / `tangent` / `unclear` routed to **no bank** (reviewer-confirmed clean).
6. The Markdown / JSONL summary reports `severityBand: green` on the bank-floor pre-check; any seed below floor is named with which bank fell short.

**HALT triggers** for Step 2:
- `xaiAdversarialOptionBankBuilder.js` exits non-zero.
- Any seed has `bankShortfall: true` AND the operator wanted that seed used (synthetic-default templates should fill most gaps; a shortfall on a viable seed is a doctrine/derivation bug worth surfacing).
- Any option's `targetExcerpt` or `summary` contains a raw X handle, URL, post ID, or unredacted slur.

---

## 5. Step 3 — bot fixture dry run against the banked pool

**You run:**

```bash
npm run bot:fixture:xai-adversarial:dry -- \
  --banked-pool logs/engagement-intelligence/<runId>-xai-adversarial-banked-pool.jsonl
```

**What this does (no network, no posts):**
- Reads the banked pool JSONL.
- Generates a `runTag` of the new format `corpus-prod-synthetic-YYYYMMDD-HHMM-<8hex>` (the bug-fixed runId-aware tag).
- For each thread (up to `--scenarios 10` default for `:dry`):
  - Picks a deterministic seed via Fisher-Yates over `runId` (no reuse).
  - For each move M1–M(≤10), picks `(bankName, optionIndex)` via the design §6 algorithm with per-thread no-reuse-until-exhaustion accounting.
  - Stamps `voiceId` (hash-derived) on each bot at `bot_assignment`.
  - Stamps `spineId` per move with the no-repeat-prior constraint.
  - Calls `renderAlignedAdversarialMove(selectedOption, voiceId, spineId, attribution)` — in dry mode this returns a deterministic skeleton-fill body (no Anthropic call).
  - Validates the rendered body (option-alignment, spine-alignment, plus all existing validators).
  - Emits `move_validated` JSONL events carrying the full §8.1 attribution.
  - Skips posting: `submit_attempt.reason='dry_mode'`, `submit_result.status='skipped'`.
- Runs the §9 diversity checks across all generated moves.
- Emits a Markdown summary at `docs/testing-runs/<runTag>-dry.md`.

**Paste the captured output here**, then I verify (read-only):

### 5.1 Attribution flow (every move_validated event carries these)

| Field | Expected |
|---|---|
| `runId` | the same runId across all events |
| `runTag` | `corpus-prod-synthetic-YYYYMMDD-HHMM-<8hex>` — does **not** contain `runId.slice(0,8)` (date prefix) |
| `seedId` | unique per thread; no two threads share a seedId |
| `threadIndex` | sequential 0, 1, 2, … |
| `role` | alternates: provocateur (M1, M3, M5, …) ↔ revocateur (M2, M4, M6, …) |
| `moveIndex` | sequential within thread |
| `bankName` | M1 always `opening_claim_options`; M2 always `objection_options`; M3+ from per-role rotation set |
| `optionIndex` | within `[0, bank.length)`; no reuse within a thread until `bank_exhausted_reset` fires |
| `optionId` | sha-prefixed; unique within the bank |
| `voiceId` | one of the 8 named voices; same for the same bot across the run |
| `spineId` | one of the 9 named spines; `spineId(t, m) !== spineId(t, m-1)` |

### 5.2 Reporter §9 checks — all four

| Check | Expected on a clean dry run |
|---|---|
| Duplicate-seed | `severityBand: green` — every thread uses a unique seedId |
| Repeated-option (per thread) | `severityBand: green` — no `(bankName, optionIndex)` pair appears twice in a single thread before a reset fires |
| Repeated-structure (spine) | `severityBand: green` — no single spine accounts for >35% of moves run-wide; no thread has the same spine ≥3 times |
| Samey-move (text-distance) | `severityBand: green` — no intra-thread pair has ≥0.60 Jaccard overlap on body tokens; mean overlap <0.35 |

Plus the **voice distribution**: voiceId histogram across all bots, expected band 1–4 hits per voice on a `:dry` of 10 scenarios × 2 bots = 20 bot slots.

### 5.3 Boundary checks (read-only)

```bash
# No submit-argument was called
grep -c '"submit_result"' <runTag>-dry-jsonl-path
grep -c '"status":"skipped"' <runTag>-dry-jsonl-path
# Expected: both counts roughly match (every submit_result is skipped)

# No Supabase mutation signature
grep -cE 'submit_argument_called|debate_inserted|participant_inserted' <runTag>-dry-jsonl-path
# Expected: 0
```

I confirm by reading the JSONL summary (you paste it; not by querying DB — dry doesn't touch DB).

**HALT triggers** for Step 3:
- Any `severityBand: red` on §9 checks → planner / scene-builder / reporter wired wrong; HALT and surface.
- Any `submit_result.status !== 'skipped'` → dry-mode boundary leaked.
- Any `move_validated` event missing one or more §8.1 attribution fields → planner state didn't flow into the JSONL.
- `runTag` field contains the literal substring `<runId.slice(0,8)>` (the date-prefix bug regressed) → blocker.
- Any raw X handle / URL / post ID in any committable file (`docs/testing-runs/<runTag>-dry.md`) → redaction failed.

---

## 6. Success criteria — green light for the tiny stage

The dry stage is **PASS** when **all** of the following hold:

1. **Phase 0 re-verification green** (§2).
2. **Step 1** emits a well-formed harvest JSONL + redacted Markdown; no network call signature; no raw X.
3. **Step 2** emits a well-formed banked pool JSONL; every option has `provenance`; bank-floor severity green; `REPLY_FUNCTION_TO_BANKS` routes look correct on read.
4. **Step 3** emits attribution-complete `move_validated` events; **all four §9 checks `severityBand: green`**; zero submit calls; zero Supabase mutation signatures; `runTag` uses the new format and does not regress the slice-bug.

When 1–4 all hold, the tiny stage (next runbook, separately authored when you call for it) is the next operator step — first live spend, smallest possible scale, visual approval before 30.

---

## 7. HALT discipline — what I do if any step fails

Per the governance contract §3 + the user's binding prompt for this card:

- I do **not** "fix it and re-run." A bug in the planner is a code-fix card, not a hands-on tweak inside the runbook.
- I do **not** loosen any check to make it pass.
- I do **not** call any provider to compensate for a deterministic failure.
- I surface the exact failure with `file:line` evidence + the JSONL event that fired + a concrete recommended next card (e.g. "OPS-CORPUS-30-RUNTAG-REGRESSION-FIX" if the slice-bug regressed).

---

## 8. Boundaries (binding on this runbook)

- **No provider call** — neither the operator nor I should invoke any path that calls xAI or Anthropic during this stage. The `:dry` aliases are designed to refuse, but the boundary holds even on edge cases.
- **No Supabase write** — no `debates.insert`, no `debate_participants.insert`, no `submit-argument`, no service-role usage. Dry mode emits `submit_result.status='skipped'` exclusively.
- **No classifier trigger** — no `classify-argument-boolean-observations` call. Classifier observation is the last stage; dry doesn't touch it.
- **No queue routing arm / no 5% / no H/I/J** — same governance posture as before; routing remains baseline/off (`CLASSIFIER_QUEUE_ROUTING_ENABLED=false`).
- **No raw X content in committed docs** — JSONL with redacted bodies stays in `logs/engagement-intelligence/` (gitignored); the Markdown summary at `docs/testing-runs/<runTag>-dry.md` carries only counts, distributions, and provenance categories.
- **No new npm aliases, no `package.json` edit, no schema change.** The runbook only describes the existing dry path with the planner additions from PR #456.
- **Pre-launch prod synthetic only.** The summary doc must say so explicitly. Not organic. Not ramp evidence.

---

## 9. What this runbook is not

- **Not the tiny runbook.** Tiny is the first live xAI + Anthropic + posting spend at the smallest possible scale; it gets its own runbook with its own success criteria.
- **Not the 30 runbook.** 30 is the main event, separately authored.
- **Not the classifier-observation runbook.** That's the last stage, gated on tiny + 30 having passed.
- **Not an authorization to merge or deploy anything.** It is a read-only describe-and-verify procedure for a dev-tooling code path that is already merged on main.
