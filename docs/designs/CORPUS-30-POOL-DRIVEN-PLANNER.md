# CORPUS-30-POOL-DRIVEN-PLANNER — design (2026-06-03)

> **Status:** DESIGN ONLY. No production code, no runtime change, no test runs, no provider calls, no Supabase mutation, no posting. Stops at **GATE A** for operator design review.
> **Card:** `CORPUS-30-POOL-DRIVEN-PLANNER-DESIGN` (this card) → after GATE A: `CORPUS-30-POOL-DRIVEN-PLANNER-IMPLEMENTATION`.
> **Origin:** halt verdict from `CORPUS-30-PROD-SYNTHETIC-POOL-DRIVEN` Phase 1+2 — `POOL_DRIVEN_MISSING`. The runner today renders moves via free-form Anthropic continuation seeded by M1/M2; there is no option-bank planner and no deterministic selection function keyed on `(runId + threadIndex + role + moveIndex + bankName)`. This design closes that gap.

> **Governance:** runs under `docs/core/pipeline-governance-contract.md` v1. §3 HALT conditions + §4 never-self-approve apply. The eventual target is **pre-launch prod synthetic only** — not dev, not organic, not ramp evidence, never claimed as Stage-1 evidence.

> **Acceptance-gate invariant (unchanged):** AI/MCP classifiers are never the submission acceptance gate. The pure rules engine remains the sole gate. Classifiers run after a post is stored. This card changes no code in `src/lib/constitution/engine.ts` and no submission gating.

---

## 1. Why this card exists

The pool-driven planner architecture the operator named is comprehensively absent from the codebase. From the Phase 1+2 verdict (every claim cited `file:line`):

- Zero tree-wide matches for the six option-bank names (`opening_claim_options`, `objection_options`, `evidence_pressure_options`, `alternative_explanation_options`, `concession_or_narrowing_options`, `resolution_pressure_options`) — in `scripts/`, `src/`, anywhere wired to this pipeline.
- The harvester (`xaiAdversarialSourceHarvest.js`) emits **one** `selectedDissent.playableSkeleton` per source — single dissent card, not six role-keyed banks.
- The runner (`runXaiAdversarialBotCorpus.js`) pre-seeds M1/M2 from raw source/reply text, then makes a **fresh Anthropic call per subsequent move** with the full skill `.md` as system prompt and `axis: 'auto'` (model picks). No `hash(runId + threadIndex + role + moveIndex)` selector exists.
- The only deterministic layer is the scene builder's (bot→role) shuffle, which keys on `(seed, sourceHash, replyHash)` — not on `(runId, threadIndex, role, moveIndex)`.
- No `voiceId`, `voiceIndex`, `spine`, `bankName`, `optionIndex` field appears on any JSONL event or reporter row.
- `runId.slice(0,8)` (used in `debate.title` prefix at `runXaiAdversarialBotCorpus.js:393`) returns the ISO **date prefix** (`2026-06-`), not the UUID suffix — same-month runs collide on the room-title tag and per-run UI filtering is unreliable.

The operator instruction was explicit: *"If this behavior does not exist, HALT and implement a separate pool-driven planner card before any corpus run. Do not fake uniqueness by prompt text alone."* This is that card's design.

---

## 2. Required reading (the inputs this design honors)

- `scripts/engagement-intelligence/xaiAdversarialSourceHarvest.js` — write-only JSONL pool emitter; today produces one `playableSkeleton` per source.
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — live runner; signs in bots, inserts debate row + participants directly under RLS, posts moves via `submit-argument`.
- `scripts/bot-fixtures/xaiAdversarialSceneBuilder.js` — LCG-seeded bot↔role shuffle (`(seed, sourceHash, replyHash)`) + M1/M2 raw seeding.
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` — Anthropic move renderer with full skill `.md` as system prompt; 10-element `ALLOWED_AXES` vocab; one retry + deterministic fallback.
- `../.claude/skills/xai-adversarial-corpus-operator/SKILL.md` — operator doctrine: §49 "Fresh start = filtered view (binding)", §59 voice/diversity engine binding, §79 AI-label observation purpose, §90 M2 leniency.
- `../.claude/skills/bot-provocateur/SKILL.md` — Bot voice/diversity engine (§40), Minimum Specificity Contract, Move Taxonomy, Output Shape (`body`, `adoptedPosition`, `targetExcerpt`, …), banned phrases, forbidden labels.
- `../.claude/skills/bot-revocateur/SKILL.md` — same engine + Move Taxonomy + Hostile Source Conversion + Concession-And-Resolution rules.
- `package.json` `engagement:intel:xai:adversarial:{dry,tiny,30}` + `bot:fixture:xai-adversarial:{dry,tiny,30}` aliases (line 46–56).

---

## 3. Architecture overview (current vs proposed)

**Current (per Phase 1+2):**

```
[xAI] → harvester ──▶ JSONL pool of {sourcePost, candidateReplies, selectedDissent.playableSkeleton}
                                            │
                              (operator passes --harvest-file)
                                            ▼
                runner ──▶ scene builder (bot↔role LCG shuffle on (seed, sourceHash, replyHash))
                                            │
                                            ▼
                       M1 = raw source body, M2 = raw reply body
                                            │
                                            ▼
                       moveRenderer(axis:'auto', parent=prev) ──▶ Anthropic ──▶ free-form prose
                                            │
                                            ▼
                       submit-argument Edge Function ──▶ public.arguments
```

**Proposed:**

```
[xAI] → harvester (UNCHANGED) ──▶ JSONL pool (UNCHANGED shape)
                                            │
                                            ▼
                   NEW post-processor: xaiAdversarialOptionBankBuilder.js
                                            │
                                            ▼
              JSONL POOL+ : seeds[] with {seedId, sourceHash, claimSummary,
                                          banks: { opening_claim_options[], objection_options[],
                                                   evidence_pressure_options[], alternative_explanation_options[],
                                                   concession_or_narrowing_options[], resolution_pressure_options[] }}
                                            │
                                            ▼
                NEW planner: corpusPoolDrivenPlanner.js
                  - seededShuffle(runId) → unique seed per threadIndex
                  - per-move (threadIndex, role, moveIndex) → (bankName, optionIndex) deterministic
                  - per-thread usedOptions set; linear-probe on exhaustion; reset on full exhaustion
                                            │
                                            ▼
              scene builder gains selectedOption + voiceId + spineId + attribution
                                            │
                                            ▼
              moveRenderer(selectedOption: BINDING) ──▶ Anthropic ──▶ prose that renders THE OPTION
                                            │
                                            ▼
              submit-argument (UNCHANGED) ──▶ public.arguments
                                            │
                                            ▼
              reporter (extended): per-move attribution table + diversity/repetition warnings
```

Three new modules. Two existing modules (scene builder + move renderer) get **strict additive props**. Harvester is **unchanged**. The Edge Function path is **unchanged**.

---

## 4. Pool schema — the 6 option banks

### 4.1 Seed shape (after post-processing)

```ts
type Seed = {
  seedId: string                // sha256(sourceHash + claimSummary).slice(0,16) — deterministic, redaction-safe
  sourceHash: string            // from harvester (unchanged)
  claimSummary: string          // ≤200 chars, redacted, derived from sourcePost
  issueFrame: string            // from harvester (politicalIssueFrame)
  banks: {
    opening_claim_options:          Option[]   // ≥4 distinct openings of the seed claim
    objection_options:              Option[]   // ≥4 distinct objections / rebuttals
    evidence_pressure_options:      Option[]   // ≥4 distinct evidence/source demands
    alternative_explanation_options:Option[]   // ≥3 distinct alt readings of the claim or evidence
    concession_or_narrowing_options:Option[]   // ≥3 distinct narrow-the-claim or concede-a-piece moves
    resolution_pressure_options:    Option[]   // ≥3 distinct synthesize/branch/burden-shift closers
  }
  // floors: ≥4/4/4/3/3/3 = 21 options minimum per seed; target ≥6/6/6/4/4/4 = 30+ per seed
}

type Option = {
  optionId: string              // sha256(seedId + bankName + skeleton).slice(0,12)
  bankName: 'opening_claim_options' | … (one of six)
  skeleton: {
    targetExcerpt: string|null  // ≤240 chars; quote-anchored when possible; null for pure rhetorical moves
    spineHint: SpineId          // one of the 9 spines below; the PLANNER decides which spine each option foregrounds
    axisHint: AxisId            // one of: fact|definition|causal|value|evidence|logic|scope|framing|source_chain|anti_amplification (10-axis vocab in moveRenderer)
    summary: string             // ≤180 chars, redacted — what this move says, in plain language
    evidenceDebt: string[]      // 0..3 entries, ≤120 chars each (matches existing playableSkeleton field)
    antiAmplificationNote: string|null
  }
  provenance: 'harvester_post_processed' | 'paraphrase_rule' | 'synthetic_default'
}
```

### 4.2 Bank-creation strategy (recommendation: hybrid post-processor)

**Recommendation:** the harvester stays unchanged; a new **deterministic post-processor** (`scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js`) reads the harvester's JSONL and emits the bank-enriched pool. **No additional xAI spend** for v1.

Derivation rules (deterministic; no provider calls):

| Bank | Sources (in priority order) | Min count gate |
|---|---|---|
| `opening_claim_options` | (1) sourcePost.claim restated 4 ways via fixed paraphrase rule templates (assertion, conditional, comparative, scope-bounded); (2) selectedDissent.targetExcerpt as a defensive opener; (3) classified candidateReplies where `replyFunction == 'restatement'` | 4 |
| `objection_options` | (1) selectedDissent.playableSkeleton (the original); (2) candidateReplies where `replyFunction ∈ {rebuttal, source_chain_attack, evidence_challenge}`; (3) synthetic objection templates anchored on `mechanism` + `disagreementAxis` | 4 |
| `evidence_pressure_options` | (1) playableSkeleton.evidenceDebt[] (each item becomes one option); (2) candidateReplies where `replyFunction == 'evidence_challenge'`; (3) deterministic "name the primary source / quote the sentence / show the data" templates with the seed's targetExcerpt injected | 4 |
| `alternative_explanation_options` | (1) candidateReplies where `replyFunction ∈ {causal_challenge, alternative_explanation, scope_challenge}`; (2) deterministic "could also be X / equally consistent with Y / what about Z mechanism" templates | 3 |
| `concession_or_narrowing_options` | (1) deterministic "narrow to X subset / concede point P while preserving claim Q" templates derived from `disagreementAxis`; (2) candidateReplies where `replyFunction == 'concession'` if present | 3 |
| `resolution_pressure_options` | (1) deterministic synthesis/branch/burden-shift templates anchored on `disagreementAxis`; (2) candidateReplies where `replyFunction ∈ {synthesis, branch_request}`; (3) the antiAmplificationNote as a "settle the source-chain first" closer | 3 |

If a bank falls below its minimum after all rules fire, the seed is marked `bankShortfall: true` and the planner **rejects** that seed during selection (skips to the next via probing — §6). Operator can re-run the harvester with higher `--stories` / `--replies` if the rejection rate is high.

Why no xAI bank-generation in v1: every variation we need is derivable from already-classified candidate replies + the playable skeleton + fixed paraphrase rules; adding xAI here doubles cost and inserts a non-deterministic source where determinism is the load-bearing property. See **§14 open question 1**.

### 4.3 Banks-per-role assignment (which banks each role may draw from)

```
PROVOCATEUR_BANKS = ['opening_claim_options', 'evidence_pressure_options',
                     'alternative_explanation_options', 'concession_or_narrowing_options']
REVOCATEUR_BANKS  = ['objection_options', 'evidence_pressure_options',
                     'alternative_explanation_options', 'resolution_pressure_options']
```

The user's role-spec named "defense" for the provocateur — there is no `defense_options` bank; defense maps to `evidence_pressure_options` (used to assert one's own evidence) and `alternative_explanation_options` (offer alt reading of the objection). The provocateur **never** draws `objection_options` or `resolution_pressure_options`; the revocateur **never** draws `opening_claim_options` or `concession_or_narrowing_options` (a revocateur concession is rare and out of scope for v1 — see §14).

### 4.4 Per-move bank plan (the move sequence)

Each thread runs ≤10 moves. The planner picks a bank per `(threadIndex, role, moveIndex)` using a fixed sequence + deterministic rotation for the middle moves:

```
M1 prov  → opening_claim_options
M2 rev   → objection_options
M3 prov  → rotateProv(threadIndex, 3) ∈ {evidence_pressure, alternative_explanation, concession_or_narrowing}
M4 rev   → rotateRev(threadIndex, 4) ∈ {evidence_pressure, alternative_explanation}
M5 prov  → rotateProv(threadIndex, 5) ∈ {concession_or_narrowing, evidence_pressure, alternative_explanation}
M6 rev   → rotateRev(threadIndex, 6) ∈ {resolution_pressure, evidence_pressure, alternative_explanation}
M7 prov  → rotateProv(threadIndex, 7) ∈ {alternative_explanation, concession_or_narrowing, evidence_pressure}
M8 rev   → rotateRev(threadIndex, 8) ∈ {resolution_pressure, alternative_explanation}
M9 prov  → concession_or_narrowing_options
M10 rev  → resolution_pressure_options

rotateProv(threadIndex, m) = PROVOCATEUR_BANKS[ hash(runId+':rot:p:'+threadIndex+':'+m) % len(rotationSetForMove(m)) ]
rotateRev (threadIndex, m) = REVOCATEUR_BANKS [ hash(runId+':rot:r:'+threadIndex+':'+m) % len(rotationSetForMove(m)) ]
```

Stop-early conditions (existing today, preserved): explicit narrow concession, accepted source-chain debt, accepted evidence debt, branch recommendation, synthesis, stalemate, repeated submit failure, validation failure after retry.

---

## 5. Deterministic seed selection (Fisher-Yates over `runId`)

```ts
function seedAssignment(runId: string, threadCount: number, seedPool: Seed[]): Seed[]
```

Algorithm:

1. Filter `seedPool` to seeds where every bank meets its floor (§4.2). Let `eligible` be the result; `n = eligible.length`.
2. If `n < threadCount` (typically `threadCount = 30`) → **HALT** with reason `seed_pool_undersized` and the exact counts per bank. Operator re-harvests with higher `--stories` / `--replies` until `n ≥ threadCount`. **No replacement / no reuse** — uniqueness is binding.
3. Fisher-Yates shuffle `eligible` indices using a hash-seeded PRNG keyed on `runId`:
   ```
   for i from n-1 down to 1:
     j = uintHash(runId + ':seed:' + i) % (i+1)
     swap eligible[i] ↔ eligible[j]
   ```
4. Take the first `threadCount` items → each `threadIndex ∈ [0, threadCount)` gets a unique seed deterministically.
5. Same `runId` + same `seedPool` content → identical assignment (test §10).

`uintHash` = `xxhash32` (already in deps via existing harvester) or `crypto.createHash('sha256').update(s).digest().readUInt32BE(0)`; either is deterministic and fast.

---

## 6. Deterministic per-move option selection (with no-reuse-until-exhaustion)

```ts
function selectOption(
  runId: string, threadIndex: number, role: 'provocateur' | 'revocateur',
  moveIndex: number, bankName: BankName, bank: Option[],
  usedOptionsForThread: Map<BankName, Set<number>>
): { option: Option, optionIndex: number }
```

Algorithm:

1. `baseIndex = uintHash(runId + ':opt:' + threadIndex + ':' + role + ':' + moveIndex + ':' + bankName) % bank.length`.
2. Let `used = usedOptionsForThread.get(bankName) ?? new Set()`.
3. If `used.size >= bank.length`, **reset** `used = new Set()` and emit `bank_exhausted_reset` JSONL event (the reset itself is deterministic; the next selection will start fresh).
4. Linear-probe from `baseIndex`: for `k = 0..bank.length-1`, try `(baseIndex + k) % bank.length`; pick the first index not in `used`.
5. Add picked index to `used`.
6. Return `{ option: bank[pickedIndex], optionIndex: pickedIndex }`.

This satisfies: deterministic by `(runId + threadIndex + role + moveIndex + bankName)`; no reuse within a thread until the bank exhausts; bounded by `O(bank.length)` per call.

**Cross-bank uniqueness is not enforced** — the same `optionId` could theoretically appear in two different banks (e.g. an evidence-challenge candidate reply also tagged as `objection_options` source). In practice the deterministic templates produce disjoint options across banks; the reporter detects any leakage (§9).

---

## 7. Voice / diversity engine — separated from selection

The voice engine is **rendering-time**, not selection-time. Selection picks **what** the bot says; voice picks **how**. This separation is the load-bearing change vs the current architecture where voice is monolithically baked into the system prompt.

### 7.1 voiceId — per-bot, per-run

```
voiceId = VOICES[ uintHash(runId + ':voice:' + botUserId) % 8 ]
VOICES = ['empiricist','mechanism_hunter','definitions_lawyer','analogist',
          'steelman_cutter','scope_narrower','systems_thinker','plain_skeptic']
```

A bot keeps its voice for the whole run. Two bots in the same room get different voices (the assignment can collide deterministically — that's acceptable; report it as `voice_pair_collision` in the reporter when the same voice appears twice in a room).

### 7.2 spineId — per-move

```
spineId = SPINES[ uintHash(runId + ':spine:' + threadIndex + ':' + moveIndex) % 9 ]
SPINES = ['quote-led','counterexample-led','definition-led','mechanism-led','scope-led',
          'concession-then-pivot','question-led','analogy-led','second-order-effect-led']
```

With a hard constraint: **`spineId(t, m) ≠ spineId(t, m-1)`** — if the deterministic pick equals the previous move's spine, advance by `+1 mod 9` (one-step rotation). This keeps the spine-rotation rule (skill §2) honored without losing determinism.

### 7.3 Move renderer becomes selection-aware

`xaiAdversarialMoveRenderer.js` gains a **binding** input:

```ts
renderAdversarialMove({
  // …existing props…
  selectedOption: Option,        // NEW — BINDING
  voiceId: VoiceId,              // NEW
  spineId: SpineId,              // NEW
  attribution: { runId, runTag, threadIndex, role, moveIndex, bankName, optionIndex }, // NEW
})
```

The prompt is restructured (no skill-content edit needed — the skill `.md` stays as system prompt as today):

```
SYSTEM:  <skill .md body as today>
ASSISTANT directives (NEW user-message block):
  - Render this exact option in your assigned voice. Do NOT substitute your own option.
    SELECTED_OPTION (binding):
      bank:      {bankName}
      summary:   {option.skeleton.summary}
      axis:      {option.skeleton.axisHint}
      targetExcerpt: {option.skeleton.targetExcerpt || "(none)"}
      evidenceDebt: {option.skeleton.evidenceDebt joined}
  - Assigned voice: {voiceId} (per the voice catalog in your skill)
  - Spine this move foregrounds: {spineId}
  - Parent move: {parent.body redacted}
  - Hard constraints (existing): banned phrases, forbidden person-labels, length, Minimum Specificity Contract.
```

Renderer adds two new validators on top of the existing set:

1. **Option-alignment validator** — the rendered `body` must contain a non-trivial overlap with `option.skeleton.summary` keywords (case-insensitive token match: ≥40% of non-stopword tokens from `summary` appear in `body`, OR the targetExcerpt is quoted verbatim when non-null). One regenerate retry on failure, then deterministic-fallback fills the body from `option.skeleton.summary` directly. (Threshold is tunable; v1 default 40% — see §14.)
2. **Spine-alignment validator** — the rendered `body` matches the spine's opening pattern (lightweight regex set per spine; e.g. `quote-led` requires an early `"…"` quotation in the first 80 chars). Fail → retry → fallback per existing renderer policy.

The existing validators (banned phrases, forbidden labels, length, target-excerpt presence, concession-marker rule) **stay**. No skill-file edit. No new banned tokens.

---

## 8. Per-move attribution + runTag fix

### 8.1 Attribution fields on every JSONL `move_validated` event

```ts
{
  event: 'move_validated',
  runId: '2026-06-03T14-22-31-123Z-a1b2c3d4',
  runTag: 'corpus-prod-synthetic-20260603-1422',   // §8.3
  seedId: 'sha256-prefix-16',
  threadIndex: 0,
  role: 'provocateur',
  moveIndex: 1,
  bankName: 'opening_claim_options',
  optionIndex: 3,
  optionId: 'sha256-prefix-12',
  voiceId: 'mechanism_hunter',
  spineId: 'mechanism-led',
  attempts: 1,
  source: 'anthropic',                              // or 'deterministic_fallback'
  validationFailureReason: null,
  // existing safe fields: chosenAxis, skillHash, jsonParsed, etc.
}
```

`option.skeleton.summary` and `option.skeleton.targetExcerpt` may be included in JSONL (gitignored). **They MUST NOT** appear in the committed Markdown summary except as a hash digest or category count (§9.3).

### 8.2 runTag — fix the slice bug

Replace `runId.slice(0, 8)` (which returns the date prefix) with a **stable suffix + structured run-tag**:

```ts
function buildRunTag(runId: string, kind: 'corpus-prod-synthetic' | 'corpus-dev-synthetic'): string {
  // runId looks like: 2026-06-03T14-22-31-123Z-a1b2c3d4
  // Use the UUID suffix (last 8 chars after the final '-') + a compact YYYYMMDD-HHMM stamp.
  const uuidSuffix = runId.split('-').pop()!         // 'a1b2c3d4' (8 hex chars from randomUUID().slice(0,8))
  const m = runId.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/) // ISO prefix
  const stamp = m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : 'undated'
  return `${kind}-${stamp}-${uuidSuffix}`
  // example: corpus-prod-synthetic-20260603-1422-a1b2c3d4
}
```

Properties:
- Human-readable: contains the date and time so the operator can scan recent runs.
- Globally unique: the random 8-hex UUID suffix prevents collision even within the same minute.
- Bounded length: ≤48 chars — fits inside `debate.title` prefix without crowding the claim summary.
- Substring-filterable: `LIKE '%corpus-prod-synthetic-20260603%'` lists all runs that day; `LIKE '%-a1b2c3d4]%'` lists exactly one run.

### 8.3 Room title format

```
{claimSummary.slice(0,80)}  [corpus-prod-synthetic-20260603-1422-a1b2c3d4 t{threadIndex:02d}]
```

`t{threadIndex:02d}` (e.g. `t07`) embeds the thread index, so the operator can also filter to a specific thread within a run. **Total tag width: 53 chars** — well under the 100-char title cap the runner already enforces.

### 8.4 Per-thread output

A per-thread JSON file at `logs/engagement-intelligence/{runTag}/thread-{NN}.json` (gitignored) carries the full attribution table for the thread (one row per move). The Markdown summary at `docs/testing-runs/{date}-xai-adversarial-corpus-summary.md` carries only **counts and distributions** — never raw skeletons, targetExcerpt, or body text.

---

## 9. Reporter checks (diversity + repetition signals)

The existing reporters (`xaiAdversarialReport.js`, `xaiAdversarialCorpusReport.js`) gain four new check sections. All operate on JSONL attribution; none read body text.

### 9.1 Duplicate-seed detection

A pre-run check (also emitted as `seed_assignment` summary): the 30 selected `seedId`s must be a unique set. If a duplicate is detected, **HALT** before any post. (Seeded shuffle guarantees this when `eligible.length ≥ threadCount`; this is a belt-and-suspenders check.)

### 9.2 Repeated-option detection

Per thread: count `(bankName, optionIndex)` occurrences. **Warning** if any pair appears ≥2 times **before** the bank exhaustion event fires (which would be a planner bug). Reporter table column: `repeated_option_count_per_thread`.

Across the run: count `optionId` occurrences across all threads. Expected: the same optionId may legitimately appear in multiple threads (different seeds may share an option only if their hash collides — extremely unlikely). **Warning threshold**: `optionId` appears in ≥3 threads of 30 → flag as `cross_thread_option_collision`.

### 9.3 Repeated-structure (spine) detection

Per thread: emit `spineSequence` (e.g. `quote-led → counterexample-led → mechanism-led → …`). **Warning** if:
- the same `spineId` appears ≥3 times in a single thread, OR
- any window of 4 consecutive moves has ≤2 distinct spines.

Per run: spine distribution. **Warning** if any single spine accounts for >35% of all moves (saturated rotation).

### 9.4 Voice-pair / voice-exhaustion detection

Per room: `voice_pair_collision` flag when the two bots share `voiceId` (acceptable but worth noting).
Per run: voice distribution across 60 bot-slots (30 rooms × 2 bots). **Warning** if any single voice covers <5 slots or >12 slots (target band: 5–10 per voice, given 8 voices × ~7.5 slots = 60).

### 9.5 Samey-move threshold (text-distance signal)

Per thread: pairwise normalized token-overlap on `body` text (Jaccard over non-stopword tokens). **Warning** if any pair within a thread has ≥0.60 overlap (severe template clone), or if the mean intra-thread pairwise overlap exceeds 0.35. The reporter cites the move indices, not the body text.

**All four warning categories** become `severityBand` chips in the Markdown summary (`green`, `yellow`, `red`) — red triggers a HALT recommendation before proceeding to the next stage (tiny → 30).

---

## 10. Test plan (added under `__tests__/`)

| Test | Asserts |
|---|---|
| `corpusPoolDrivenPlanner.deterministic-seed.test.ts` | `seedAssignment(runId, 30, pool)` is byte-stable for same runId+pool; produces 30 unique seedIds; throws `seed_pool_undersized` when eligible <30 |
| `corpusPoolDrivenPlanner.option-selection.test.ts` | `selectOption` is deterministic given same inputs; no reuse within a thread until bank exhausts; linear probe finds an unused index in O(bank.length); bank-exhaustion reset works |
| `corpusPoolDrivenPlanner.role-banks.test.ts` | provocateur draws only from `PROVOCATEUR_BANKS`; revocateur draws only from `REVOCATEUR_BANKS`; M1 always = opening_claim_options; M2 always = objection_options |
| `corpusPoolDrivenPlanner.voice-spine.test.ts` | voiceId deterministic on `(runId, botUserId)`; spineId deterministic on `(runId, threadIndex, moveIndex)`; spineId(t, m) ≠ spineId(t, m-1) |
| `corpusPoolDrivenPlanner.runTag.test.ts` | runTag fix: `runId.slice(0,8)` is NOT used; new runTag contains both YYYYMMDD-HHMM and the 8-hex suffix; tag ≤48 chars; same-minute runs do not collide |
| `xaiAdversarialOptionBankBuilder.bank-floors.test.ts` | Builder rejects seeds with any bank below its floor; bank counts match the §4.2 minima on the canonical dry fixture |
| `xaiAdversarialOptionBankBuilder.derivation.test.ts` | Each bank derivation rule produces options matching its expected shape; provenance is recorded; no raw X text leaks into committed JSON fixtures |
| `xaiAdversarialMoveRenderer.option-alignment.test.ts` | Renderer's option-alignment validator catches a response that ignores the selectedOption; retries once; falls back to skeleton-rendered prose; preserves all existing validators (banned phrases, forbidden labels, length) |
| `xaiAdversarialReport.diversity-checks.test.ts` | Reporter detects repeated optionIndex within thread; flags cross-thread optionId collision (≥3 threads); flags spine saturation (>35%); flags samey-move threshold (≥0.60 pairwise) |
| `corpusPoolDrivenPlanner.dry-mode.test.ts` | dry mode emits all attribution fields; does not post; reports zero Supabase writes; honors `--harvest-file` requirement matrix |
| `corpusPoolDrivenPlanner.live-mode.gate.test.ts` | Live mode still requires `--pilot` + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `ANTHROPIC_API_KEY` + `.env.bot-tests` to exist; refuses live otherwise |

Test forecast: **+50 to +90 tests**. Test count baseline (post-#454): 603 suites / 18985 cases.

---

## 11. File changes (paths + nature of change — **no code yet**)

### 11.1 New files

- `scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js` — deterministic post-processor; reads harvester JSONL, emits bank-enriched JSONL. ~400 lines.
- `scripts/bot-fixtures/corpusPoolDrivenPlanner.js` — pure-JS planner: `seedAssignment` + `selectOption` + voice/spine helpers + per-thread usedOptions accounting. ~300 lines.
- `scripts/bot-fixtures/corpusPoolDrivenPlannerConstants.js` — `VOICES`, `SPINES`, `PROVOCATEUR_BANKS`, `REVOCATEUR_BANKS`, `BANK_FLOORS`, move-plan table. ~100 lines.
- `__tests__/corpusPoolDrivenPlanner*.test.ts` (5 files per §10).
- `__tests__/xaiAdversarialOptionBankBuilder*.test.ts` (2 files).
- `__tests__/xaiAdversarialMoveRenderer.option-alignment.test.ts`.
- `__tests__/xaiAdversarialReport.diversity-checks.test.ts`.
- `fixtures/bot-fixtures/option-bank-builder-canonical.json` — tiny deterministic input to drive bank-derivation tests (≤3KB, redacted, committable).

### 11.2 Modified files (additive — no behavior regression on existing paths)

- `scripts/bot-fixtures/xaiAdversarialSceneBuilder.js` — accepts pre-built seeds (already-banked); carries `selectedOption + voiceId + spineId + attribution` per move into the scene. Keeps the existing (bot↔role) LCG shuffle as-is. ~+50 lines.
- `scripts/bot-fixtures/xaiAdversarialMoveRenderer.js` — accepts the new BINDING props (§7.3); adds two new validators (option-alignment, spine-alignment) on top of existing ones; gracefully falls back to skeleton-rendered prose on failure. ~+120 lines.
- `scripts/bot-fixtures/runXaiAdversarialBotCorpus.js` — wires the post-processor → planner → scene → renderer chain; replaces the `runId.slice(0,8)` room-title bug with the new runTag (§8.2/§8.3); emits the new attribution events; preserves the existing `--pilot` / env gate path verbatim. ~+150 lines.
- `scripts/bot-fixtures/xaiAdversarialReport.js` + `scripts/engagement-intelligence/xaiAdversarialCorpusReport.js` — extended with the four §9 check sections; counts/distributions only; never body text. ~+120 lines.
- `.gitignore` — add `logs/engagement-intelligence/{runTag}/**` (per-thread JSONs); confirm `docs/testing-runs/*-dry.md` allow-listed.

### 11.3 NOT modified

- `../.claude/skills/{bot-provocateur,bot-revocateur,xai-adversarial-corpus-operator}/SKILL.md` — voice/spine vocabularies already match. **Zero edit.**
- `supabase/functions/**`, `supabase/migrations/**` — no schema change, no Edge change. The runner still posts via `submit-argument` exactly as today.
- `src/lib/constitution/engine.ts` — untouched (acceptance-gate invariant).
- `src/features/**` — no UI change. (The room title prefix carries the runTag; existing search/filter is sufficient.)
- `package.json` — alias values unchanged; `--max-depth 10` and `--scenarios 30 / --stories 30 --replies 10` already correct. **No new npm aliases.**
- `mcp-server/**` and `familyRegistry.ts` — out of scope.

---

## 12. Verification stages (CLAUDE never executes; operator runs each stage)

| Stage | Command | What Claude does (read-only) | What Claude does NOT do |
|---|---|---|---|
| **Dry** | `npm run engagement:intel:xai:adversarial:dry` + `npm run bot:fixture:xai-adversarial:dry` | Inspect the dry-mode output paths; confirm zero posts; confirm `selectedOption` + attribution fields appear in JSONL; confirm `severityBand` is `green` on the reporter | Run the commands; call xAI/Anthropic; post anything |
| **Tiny (live)** | Operator runs `:tiny` after dry passes | Read-only DB analysis filtered by `runTag` (post-hoc); confirm thread/move counts; confirm voice + spine distribution; confirm option attribution chains correctly; confirm no repeated-option/spine-saturation/samey-move red warnings | Run the commands; trigger any classify; mutate Supabase |
| **30 (live)** | Operator runs `:30` after tiny is visually approved | Same read-only DB analysis filtered by `runTag`; confirm 30 unique threads, ~6–10 moves each, both roles, attribution complete, no severe repetition cluster | Run the commands; classify; clean prod data |
| **Classifier observation** | Operator triggers the existing admin-validation classify command for *only this runTag's arguments* (Claude must discover the command — not invent one) | Read-only post-classify analysis: A–G counts, error rows from `failure_detail`, UI render observations | Trigger the classifier; arm queue routing; touch H/I/J |

The runTag is the filter for **all** read-only DB queries: every SQL the design proposes is `WHERE debates.title LIKE '%<runTag>%'`.

---

## 13. Hard boundaries (binding on this card and all sequels)

- **No direct DB insert/update/delete by Claude.** The runner's existing path (`debates.insert` + `submit-argument`) stays untouched; Claude does not execute the runner.
- **No clean/delete/reset on prod.** No `DELETE FROM public.arguments`, no `UPDATE … SET deleted_at`, no soft-delete batch. "Fresh start = filtered view" (operator skill §49).
- **No service-role from app code.** Bot sign-in via publishable/anon key + `signInBot`; admin-only paths gated by `is_moderator_or_admin()`.
- **No classifier queue routing arm.** `CLASSIFIER_QUEUE_ROUTING_ENABLED` stays `false`. No `secrets set`.
- **No 5% authorization, no H/I/J flip, no familyRegistry change.**
- **Pre-launch prod synthetic only.** This corpus is bot-authored synthetic content. It is **not organic traffic** and **not ramp evidence** for the production cutover. The summary doc must say so explicitly.
- **No raw X / xAI content in committed docs.** Committed Markdown carries only counts, distributions, and category labels. JSONL with redacted bodies stays in `logs/engagement-intelligence/` (gitignored).
- **No secrets, JWT, bearer, auth header, email, password, post ID, evidence_span text, or argument body dump in any committed file.**

---

## 14. Open questions for the operator (GATE A)

1. **Bank generation — xAI direct vs deterministic post-processor?** Recommendation: **deterministic post-processor in v1** (no extra xAI spend, fully deterministic, reproducible). xAI-direct bank generation is an optional v2 enhancement if the deterministic banks read too samey in tiny/30 review.
2. **Attribution location — local-only JSONL/summary vs DB metadata?** Recommendation: **local-only in v1.** Adding a `run_tag` column on `public.debates` or `public.arguments` is a schema change with RLS implications and is **out of scope** for this card. The room-title-prefix runTag (§8.3) is sufficient for UI filtering and `LIKE`-based DB queries. If DB metadata is wanted, file a separate migration card after v1 ships.
3. **Exactly 30 seeds vs allow replacement when fewer harvested?** Recommendation: **require exactly 30** — uniqueness is binding per Phase 2; replacement breaks the uniqueness gate. If the harvest yields <30 eligible seeds, the planner HALTs with `seed_pool_undersized` and the operator re-runs the harvester with higher `--stories`/`--replies`. (The post-processor's eligibility filter — every bank ≥ its floor — is what gates inclusion; a seed that fails the floor isn't replaced, it's skipped, and the count must reach 30.)
4. **(Bonus — surfaced for ratification, not a blocker)** Option-alignment validator threshold (§7.3). Recommendation: **40% non-stopword token overlap with `option.skeleton.summary`** as the v1 threshold. Tunable. Too high → frequent fallback; too low → renderer can drift back to free-form. Tiny run will inform.
5. **(Bonus)** Spine saturation warning threshold (§9.3). Recommendation: **>35% of moves on a single spine across the run**. Tunable.

---

## 15. Risks

- **R1: Bank derivation produces samey options.** Mitigation: bank floors (§4.2) + reporter samey-move check (§9.5) + tiny-stage HALT-on-red rule. If tiny reveals samey banks, the v2 xAI-direct path becomes the natural follow-up.
- **R2: Option-alignment validator over-fires (too many fallbacks).** Mitigation: threshold is configurable; tiny stage tunes; deterministic fallback is still safe (skeleton-as-body is the floor of correctness).
- **R3: runTag collision in `debate.title` if multiple operators run concurrently with the same minute + same 8-hex UUID slice.** Mitigation: the 8-hex suffix is from `randomUUID()` so collision probability for the same minute is ~1 in 4 billion; acceptable.
- **R4: Per-thread JSONL files grow large.** Mitigation: gitignored; rotation is per-runTag directory; operator cleans `logs/engagement-intelligence/{old runTag}/` at will.
- **R5: Renderer's existing 10-axis `ALLOWED_AXES` clashes with the option's `axisHint`.** Mitigation: the planner picks `axisHint` from the same 10-element vocab; renderer's axis validator passes.
- **R6: The runner's existing `--harvest-file` requirement now needs a *banked* file.** Mitigation: the operator runs the post-processor explicitly (`node scripts/bot-fixtures/xaiAdversarialOptionBankBuilder.js --in <harvest.jsonl> --out <pool.jsonl>`); the runner detects banked-vs-unbanked input and errors if the pool isn't post-processed.
- **R7: Operator runs `:30` against prod and the visual diversity is fine but the labels (A–G) don't render usefully.** Mitigation: this is the primary purpose of the run per the operator skill §79; if labels don't render, that's a separate observability/UI fix, not a planner regression.

---

## 16. Acceptance criteria (implementation card)

The implementation card (`CORPUS-30-POOL-DRIVEN-PLANNER-IMPLEMENTATION`) is done when:

1. All new files (§11.1) exist with the schemas above.
2. All modified files (§11.2) carry the additive changes without breaking existing test behavior.
3. Test count strictly increases (target +50 to +90); zero new `.skip`/`.only`.
4. `npm run typecheck` / `lint` / `test` all EXIT 0.
5. Tree-wide grep for the six option-bank names returns non-zero matches in `scripts/`.
6. The `runId.slice(0,8)` bug is removed and a test asserts the new runTag format.
7. Dry-run (`:dry`) emits all new attribution fields and reports `severityBand: green`.
8. Secret/leak scan on the diff: clean.
9. `mcp-server/**`, `supabase/functions/**`, `supabase/migrations/**`, `familyRegistry.ts`, the 3 skill `.md` files, and `src/lib/constitution/engine.ts` are byte-equal pre/post diff.
10. PR opens at **GATE B** for operator review; merge decision (GATE C) follows the contract — this implementation does not auto-deploy on merge (it lives entirely in `scripts/` + `__tests__/`), so per §5 it is a non-deploy PR and **could** auto-merge on green if the card explicitly allows it. The implementation card should explicitly state the auto-merge policy at PR-open time.

---

## 17. Sequencing (after GATE A approval)

```
GATE A (this card) → operator confirms §14 questions
       ↓
IMPLEMENTATION card → builds §11 file changes, +50–90 tests, PR
       ↓
GATE B (operator reviews diff + gates)
       ↓
GATE C (operator merge decision; per §5 this is non-deploy, dev-tooling-only,
         no §4 surface, no new operative semantics → auto-merge-eligible if card allows)
       ↓
Dry stage (operator runs :dry; Claude verifies attribution + green severity)
       ↓
Tiny stage (operator runs :tiny; Claude reads DB filtered by runTag; visual approval)
       ↓
30 stage (operator runs :30; Claude reads DB filtered by runTag; HALT-on-red)
       ↓
Classifier observation (operator triggers existing admin-validation classify
   command on this runTag's arguments only; Claude does post-hoc analysis)
       ↓
Summary doc: docs/testing-runs/<date>-xai-adversarial-corpus-summary.md
   (counts, distributions, A–G observations, limitations; NO raw text)
```

**This design ratifies no commands and authorizes no runs.** It is a structural plan for the operator to review at GATE A; the implementation card builds the code; the dry/tiny/30/classify stages are each separately operator-gated.
