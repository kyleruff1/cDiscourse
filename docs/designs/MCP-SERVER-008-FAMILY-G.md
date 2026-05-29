# MCP-SERVER-008-FAMILY-G — resolution_progress classifier (admin_validation only)

**Status:** Design draft
**Epic:** Epic 12 / MCP semantic-referee track (MCP-021A family-ship arc)
**Release:** MCP server family-ship suite — Card 1 of 3 (admin ship → Gate A → Card 2 L5 mechanization (conditional) → Gate B → Card 3 production-enable + latency re-measure)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/353
**Branch:** `feat/MCP-SERVER-008-FAMILY-G`
**Intent brief:** `docs/designs/MCP-SERVER-008-FAMILY-G-intent.md` (binding decisions D1–D13; 26 HALT triggers; Stage 2B triggers)
**Predecessor (Phase 0 verified):** `main` at `9837fdf` (OPS-MCP-LATENCY-BUDGET smoke PARTIAL). Families A–F production + auto-trigger; G/H/I/J unsupported on the MCP server.

---

## Goal (one paragraph)

Ship Family G (`resolution_progress`) on the hosted MCP server in an **admin_validation-only** Edge posture, mirroring the Family F pattern (`mcp-server/lib/familyF*.ts` + the 5-layer doctrine defense) and the Family D **ai_classifier-subset** precedent (`mcp-server/lib/familyDKeys.ts`). The doctrine peril is the most acute in the track to date: G's keys (concession, synthesis, common-ground, settlement, resolved/archived) sit one semantic step from "who won / lost / conceded-and-therefore-lost / settled-in-favor" — exactly the verdict framing `cdiscourse-doctrine §1` forbids. G's classifier must surface **descriptive convergence-state**, never a verdict. This card creates `familyGKeys.ts` (the ai_classifier subset), `familyGPrompt.ts`, `familyGAnthropic.ts`, `familyGBanListScan.ts`, `familyGFixtureProvider.ts`, one `register('resolution_progress', …)` call, the `pickFamilyProviders` provider block, fixtures, Deno tests, and the smoke +2 checks. It does NOT flip production (Card 3), does NOT register H/I/J, does NOT change A–F (byte-equal), and does NOT edit the Edge `familyRegistry.ts` (G entry is already admin-only) or the shared `doctrineBanList.ts` (G adds its own scan). The score-never-blocks-posting invariant is preserved end-to-end: the auto-trigger that would invoke a production family runs in the background after submit; G is not even production-enabled, so it never touches the submit path.

---

## A.1 — Source verification + Stage 2B + THE GATING doctrine-risk determination

### A.1.0 — Source count correction (Phase 0 finding refined)

The intent brief and the `familyG.ts` file-header comment both state **29 keys** with **ai_classifier (8)**. The **actual source code** (`src/features/nodeLabels/machineObservationDefinitions/familyG.ts`, verified by counting `buildResolution({` calls and `source:` literals) is:

| Source | Count | rawKeys |
| --- | --- | --- |
| `auto_metadata` | 5 | branch_suggested, branch_created, point_stalled, point_exhausted, synthesis_candidate |
| `lifecycle` | 7 | narrowed, conceded, confirmed, synthesis_ready, exhausted, branch_recommended, archived_or_resolved |
| `ai_classifier` | **18** | (9 existing + 9 NEW — enumerated below) |
| **Total** | **30** | |

The file-header comment is **stale** (it says "29 entries … ai_classifier (8)" but lists 9 existing ai_classifier keys, and the actual array has 30 frozen entries with 18 ai_classifier). This is a comment/code drift in the **upstream source**, not in anything this card writes. **The binding contract for `familyGKeys.ts` is the actual `source: 'ai_classifier'` literals in the code (18), not the stale header count.** The implementer MUST verify the count is 18 at build time (the parity test, below, asserts exactly 18). This discrepancy is recorded so the implementer is not surprised when the upstream header says "8".

> NOTE — this card does NOT fix the upstream `familyG.ts` header comment (that file is in `src/` and is OUT of scope per intent §6). The drift is documented here and surfaced to the operator in the final report. A future `src/`-touching card may correct the header.

### A.1.1 — The exact ai_classifier-subset rawKey list for `familyGKeys.ts` (the MCP classifier scope)

The MCP LLM boolean classifier handles the **`ai_classifier`-source subset ONLY** — these are text-derivable from the argument move + parent context. The `auto_metadata` (5) and `lifecycle` (7) keys are system/cluster-derived (tree shape, time thresholds, lifecycle-state machine) and are **NOT** LLM-classified. This is exactly the **Family D precedent** (`familyDKeys.ts` = 19 ai_classifier-subset keys "per Stage 2B operator binding decision"; the 8 deterministic D keys are excluded and return `unsupported_rawKey` at the registry boundary). E and F were uniform `ai_classifier` (no subset filter needed).

**`FAMILY_G_RAW_KEYS` = the 18 ai_classifier rawKeys, in upstream declaration order:**

| # | rawKey | New? | Verdict-adjacency |
| --- | --- | --- | --- |
| 1 | `narrows_claim` | existing | LOW — narrowing is recovery-positive; doctrineNotes already say "lifts standing", no verdict |
| 2 | `concedes_narrow_point` | existing | **MEDIUM** — concession axis; guard exists upstream ("REPAIR, never defeat") |
| 3 | `ready_for_synthesis` | existing | LOW — readiness signal, descriptive |
| 4 | `suggests_side_branch` | existing | LOW — structural action proposal |
| 5 | `suggests_diagonal_tangent` | existing | LOW — structural action proposal |
| 6 | `accepts_partial_with_caveat` | existing | LOW–MEDIUM — partial acceptance; "recovery-positive" |
| 7 | `concedes_with_new_dispute` | existing | **MEDIUM** — compound concession; concession side is verdict-adjacent |
| 8 | `proposes_settlement_terms` | existing | **MEDIUM** — "settlement" reads as winner-determination if mishandled |
| 9 | `accepts_settlement_terms` | existing | **MEDIUM** — acceptance of settlement reads as capitulation if mishandled |
| 10 | `concedes_broader_point` | **NEW** | **HIGHEST** — broad relinquishment; upstream guard: "NEVER framed as 'this side lost'" |
| 11 | `common_ground_identified` | **NEW** | LOW — descriptive cross-side agreement |
| 12 | `unresolved_point_isolated` | **NEW** | LOW — descriptive isolation |
| 13 | `synthesis_proposed` | **NEW** | **MEDIUM** — upstream guard: "synthesis is a GAMEPLAY move, not a verdict about who 'won'" |
| 14 | `move_on_requested` | **NEW** | LOW–MEDIUM — "agree to disagree" could read as forfeit if mishandled |
| 15 | `issue_closed_by_participant` | **NEW** | **MEDIUM** — "settled / done / closed" reads as resolution-in-favor if mishandled |
| 16 | `decision_criterion_proposed` | **NEW** | LOW — collaborative framing move |
| 17 | `action_item_proposed` | **NEW** | LOW — procedural proposal |
| 18 | `followup_question_proposed` | **NEW** | LOW — future-question proposal |

**`FAMILY_G_CLASSIFIER_SET_VERSION = 'family-g-v1'`.**

**Excluded from the MCP classifier (12 keys; deferred to a future Edge/app-side deterministic-computation card, mirroring the `MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS` precedent):**
- `auto_metadata` (5): branch_suggested, branch_created, point_stalled, point_exhausted, synthesis_candidate
- `lifecycle` (7): narrowed, conceded, confirmed, synthesis_ready, exhausted, branch_recommended, archived_or_resolved

Requesting any of these 12 under `requestedFamilies=['resolution_progress']` returns `unsupported_rawKey` at the registry boundary (no silent-false conversion — this is the Family D guard, enforced by the parity + registry tests).

> Disambiguation footnote for the implementer (upstream `familyG.ts` Decision 5): there are intentional name-pairs across sources. `narrows_claim` (ai_classifier, move-intrinsic) ≠ `narrowed` (lifecycle, cluster state). `concedes_narrow_point` (ai_classifier) ≠ `conceded` (lifecycle). `ready_for_synthesis` (ai_classifier, move) ≠ `synthesis_ready` (lifecycle, cluster) ≠ `synthesis_candidate` (auto_metadata). The MCP subset takes ONLY the ai_classifier member of each pair. The parity test must assert the lifecycle/auto_metadata members are EXCLUDED by name.

### A.1.2 — THE GATING DOCTRINE-RISK DETERMINATION

**DOCTRINE-RISK: YES.**

**Reasoning:** Family G is doctrine-risk because at least 5 of the 18 ai_classifier keys are verdict-adjacent at the resolution↔verdict boundary — the concession axis (`concedes_broader_point`, `concedes_narrow_point`, `concedes_with_new_dispute`), the synthesis axis (`synthesis_proposed`), and the settlement/closure axis (`proposes_settlement_terms`, `accepts_settlement_terms`, `issue_closed_by_participant`). The upstream `familyG.ts` doctrineNotes blocks repeatedly and emphatically encode the anti-verdict guard precisely BECAUSE these keys live in the verdict neighborhood:
- `conceded`/`concedes_narrow_point`: "concession is a SCORING REPAIR, not a loss. Copy never frames as 'lost'."
- `concedes_broader_point`: "broad concession is RELINQUISHMENT of broader frame here, NEVER framed as 'this side lost'."
- `synthesis_proposed`: "synthesis is a GAMEPLAY move, not a verdict about who 'won'. Both sides retain standing."

A classifier that detects "concession" or "settlement accepted" or "issue closed" is one careless prompt phrasing away from emitting "X conceded therefore X lost" / "Y prevailed" / "settled in Y's favor" in an `evidence_span`. That is the exact MCP-020 failure mode the 5-layer defense exists to prevent. The risk is **structural and acute** (intent §3 calls it "the most acute doctrine risk in the track to date"), but it is **structurally tractable** via the same 5-layer defense Family E built for `slippery_slope_reasoning_present` and Family F built for `consequence_probability_unclear` (header doctrine block + per-key guards + G-local ban-list scan + adversarial fixtures + Phase 4b live smoke).

**Consequence:** Because doctrine-risk = YES, the suite's **Card 2 (L5 mechanization) RUNS** — Card 2 will add `family_g` (+ `resolution_progress` + the axis-partner key `concedes_broader_point`) to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`, after which the verdict-blind `applyL5` requires every G smoke audit to evidence persisted `evidence_span` inspection. This is why D13 (consistent-PARTIAL discipline) is binding on THIS card's smoke audit (see §A.5).

### A.1.3 — Stage 2B determination

**Stage 2B REQUIRED because T1 + T3.**

| Trigger | Fires? | Why |
| --- | --- | --- |
| **T1 — mixed source provenance** | **TRUE** | G has auto_metadata (5) + lifecycle (7) + ai_classifier (18). The MCP classifier handles the ai_classifier subset only. This requires the **ai_classifier-subset decision** (mirror Family D's Stage 2B binding). → Stage 2B MANDATORY. The operator-decision surface: confirm the 18-key subset (§A.1.1) is the MCP scope and the 12 deterministic keys are deferred. |
| **T3 — doctrine-risk framing** | **TRUE** | resolution↔verdict adjacency (§A.1.2 = YES). This requires the **doctrine prompt-structure decision** (how G detects resolution-state WITHOUT verdict framing). → Stage 2B MANDATORY. The operator-decision surface: confirm the descriptive-convergence prompt header + the `concedes_broader_point` axis-partner per-key guard + the G ban-list token extensions (§A.3). |
| T2 — compound rawKey collision | FALSE | No rawKey in the ai_classifier subset collides across families (cross-family A∩G…F∩G all empty — parity test asserts). The lifecycle/auto_metadata name-pairs (`narrowed`/`conceded`/`synthesis_ready`) are EXCLUDED from the subset, so no intra-family collision in the MCP scope. |
| T4 — MAX_TOKENS bump | FALSE (see A.2) | 18 keys × ~85 tokens ≈ 1530 output < 1500? — close. A.2 resolves this. The standard family budget MAX_TOKENS=1500 has thin headroom at 18 keys; A.2 evaluates whether a bump is needed. **If A.2 concludes a bump is required, T4 fires and the bump becomes an additional Stage 2B operator-decision.** Designer assessment: a bump is NOT required (the realistic positive-sparse output is far under budget; see A.2), so T4 does NOT fire. |
| T5 — dependency on prior-family outputs | FALSE | G's classifier is self-contained on the argument move text + parent context + thread excerpt. It does NOT read A–F outputs (no cross-family input coupling). Identical to D/E/F. |

**Net: Stage 2B is MANDATORY (T1 + T3).** Per intent §4, the implementer MUST NOT start until the operator has approved the Stage 2 surface (the 18-key ai_classifier subset confirmation + the descriptive-convergence prompt structure). HALT trigger #14 ("Stage 2B REQUIRED but operator approval missing when implementer starts") guards this.

---

## A.2 — Token budget + latency

### A.2.1 — Token budget (T4 evaluation)

| Family | ai_classifier keys | MAX_TOKENS | Notes |
| --- | --- | --- | --- |
| A/B/C | (varies) | 1500 | family-standard |
| D | 19 | 1500 (subset) | largest subset to date; no bump |
| E | 16 | 1500 | ~60 token headroom (per F design) |
| F | 14 | 1500 | ~310 token headroom |
| **G** | **18** | **1500 (proposed)** | between D (19) and E (16); D shipped 19 keys at 1500 with no bump |

**Decision: `FAMILY_G_MAX_TOKENS = 1500` (NO bump). T4 does NOT fire.**

**Reasoning:** The naive worst case (all 18 keys true, each with a 240-char evidence_span) would approach the budget, but the **conservative-positives bias** baked into the prompt (mirrored from F: "resolution-progress signals are usually sparse — most moves have 0 to 2 positives") means the realistic output is a small object: 18 boolean observations (compact), 18 confidence bands (one word each), and evidence_span entries ONLY for the few positives (the rest are `null`). The JSON skeleton + 18 short booleans + 18 confidence words + ~2-3 evidence_span quotes is comfortably under 1500 output tokens. Family D already ships **19** ai_classifier keys at MAX_TOKENS=1500 with no reported truncation — G's 18 is strictly lighter. The implementer MUST add a `familyGPrompt.test.ts` assertion `FAMILY_G_MAX_TOKENS === 1500` and `FAMILY_G_TEMPERATURE === 0`. If, during implementation, the canonical-response fixture (all-or-most-true) demonstrably exceeds the budget, that is a T4-fires escalation → STOP and surface to the operator as a Stage 2B token-bump decision (do NOT silently bump).

### A.2.2 — Latency

G is the **7th family**. Per `docs/ops/LATENCY-BUDGET.md`:
- The budget is defined against `wall_clock_background` p95 (PASS < 30s, PARTIAL ≥30s & <45s, FAIL ≥45s OR submit blocks on classification).
- The 6-family live measurement (OPS-MCP-LATENCY-BUDGET, N=5) was wall p95 ≈ 30.4–30.82s (already past the 30s warning, under the 45s FAIL).
- The codified projection: with `addedFamilyP95 ≈ 6s` and the measured gap, **7 families ≈ 36.9s** (the intent says ≈36.3s; the authoritative LATENCY-BUDGET doc says ≈36.9s — minor variance, both in the PARTIAL band). **G UNDER the 45s FAIL budget, past the 30s warning.** 8 ≈ 43.4s; 9 ≈ 49.9s (FAIL — crosses 45s, the 9th family Family I).

**Doctrine note:** the auto-trigger that runs production families executes in the BACKGROUND after submit (the submit path does NOT block on classification — the FAIL condition is "submit blocks on classification, checked first"). This satisfies `cdiscourse-doctrine §1` "Score never blocks posting." **G is admin_validation-only in this card, so it does NOT even enter the 7-family production auto-trigger** — G's per-family latency contribution to `wall_clock_background` p95 is **measured in Card 3** (when G flips to production), NOT in this card. This card adds no latency to the production path. The smoke audit Phase 7 records the operational state but does NOT need a new latency measurement (G is not production yet).

---

## A.3 — Resolution↔verdict doctrine binding (D3)

The 5-layer defense, mirrored from `familyFPrompt.ts` + `familyFBanListScan.ts`:

### A.3.1 — Layer 1: header CRITICAL-DOCTRINE block in `FAMILY_G_SYSTEM_PROMPT`

The system prompt MUST contain (byte-equal) the **7 absolute rules** block shared verbatim across A/B/C/D/E/F (lines 81–88 of `familyFPrompt.ts`: no-right, no-winner, no-truth-value, no-popularity, no-person-labeling, no-hiding/deleting, no-blocking). Then a Family-G-specific framing:

> You classify whether an argument MOVE exhibits one or more RESOLUTION-PROGRESS structural states — a claim narrowed, a narrow point conceded, a broader point relinquished, common ground identified, a synthesis proposed, settlement terms proposed or accepted, an issue closed by a participant, a point set aside, a decision criterion / action item / follow-up question proposed.

Then the **CRITICAL DOCTRINE — resolution-progress states are DESCRIPTIVE CONVERGENCE-STATE, never verdicts** block (the G analog of F's CQ-as-productive-probe block):

> - A resolution-progress observation describes the SHAPE of the exchange's movement toward (or away from) shared understanding. It NEVER asserts who is ahead, who is behind, who won, who lost, who prevailed, who capitulated, or that a dispute was settled IN ONE SIDE'S FAVOR. Both sides retain their standing regardless of which resolution-progress state the move exhibits.
> - **Concession is a SCORING REPAIR, not a defeat.** When a move concedes a narrow point (`concedes_narrow_point`) or relinquishes the broader claim (`concedes_broader_point`), the observation records the structural RELINQUISHMENT. It NEVER frames the conceding participant as "wrong", "the loser", "defeated", or as having "lost the argument". A broad concession is the highest-cost repair move; it resets standing for future rebuilding — it is NOT a verdict.
> - **Synthesis is a GAMEPLAY move, not a verdict about who won.** When a move proposes a synthesis (`synthesis_proposed`) or signals readiness (`ready_for_synthesis`), the observation records that BOTH sides' elements are being combined. It NEVER implies one side's position prevailed.
> - **Settlement / closure is procedural, not adjudication.** `proposes_settlement_terms` / `accepts_settlement_terms` / `issue_closed_by_participant` record that participants are CLOSING engagement on a point. They NEVER imply the point was "decided", "settled in X's favor", or that one side "ahead".
> - The output MUST NOT contain the words: won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor", "X won the argument", "conceded the loss", "lost the point". If the input move text itself contains such words (e.g., "you basically lost this point"), the model MAY still detect the underlying resolution-progress state, but its own output `evidence_span` MUST NOT echo the verdict framing — anchor the structural state (the relinquished claim, the proposed synthesis, the accepted terms), never the verdict words.

Then the standard conservative-positives bias paragraph (resolution-progress signals are sparse — most moves have 0 to 2; few have more than 4).

A `familyGPrompt.test.ts` assertion confirms the 7 absolute rules are byte-equal to A–F AND the resolution↔verdict doctrine block is present verbatim AND no bare banned token appears outside the doctrine-positive negations.

### A.3.2 — Layer 2: per-key `falsePositiveGuards` on the verdict-adjacent keys

The "axis-partner" key — G's analog to E's `slippery_slope` and F's `consequence_probability_unclear` — is **`concedes_broader_point`** (the HIGHEST verdict-adjacency: a broad relinquishment is the single key most likely to be mis-framed as "this side lost"). It carries the **strongest** verbatim guard:

> DOCTRINE: a broad concession is RELINQUISHMENT of the broader frame, a SCORING REPAIR that resets standing for future rebuilding — NEVER framed as "this side lost", "defeated", "the loser", "capitulated", "conceded the loss", or any verdict. The evidence_span MUST anchor the verbatim relinquishment ("I withdraw the broad claim", "the broader argument is weaker than I thought") — NOT a judgment about who won. If the move's own text says "you win" / "I lost" / "you beat me", the model may still detect `concedes_broader_point` but its output MUST NOT echo "win"/"lost"/"beat". The output MUST NOT contain: won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor".

The other verdict-adjacent keys (`concedes_narrow_point`, `concedes_with_new_dispute`, `synthesis_proposed`, `proposes_settlement_terms`, `accepts_settlement_terms`, `issue_closed_by_participant`) each carry a proportional guard naming their specific failure mode (e.g., `accepts_settlement_terms` → "acceptance of terms is procedural closure, NEVER capitulation or 'settled in X's favor'"). The low-risk keys (`narrows_claim`, `ready_for_synthesis`, `common_ground_identified`, `suggests_side_branch`, `suggests_diagonal_tangent`, `unresolved_point_isolated`, `move_on_requested`, `decision_criterion_proposed`, `action_item_proposed`, `followup_question_proposed`) keep their upstream structural guards (already present in `familyG.ts`); the implementer mirrors the upstream `falsePositiveGuards` text into the prompt entry.

A `familyGPrompt.test.ts` / `familyGKeys.test.ts` assertion confirms each verdict-adjacent key's prompt-entry `falsePositiveGuards` contains the verbatim doctrine guard.

### A.3.3 — Layer 3: `familyGBanListScan.ts` resolution-verdict token extensions (D5)

`familyGBanListScan.ts` mirrors `familyFBanListScan.ts`: it scans every `evidence_span` string + `modelInfo.serverName` + `modelInfo.classifierSetVersion`, running the shared `DOCTRINE_BAN_PATTERNS` **first**, then a G-specific `FAMILY_G_BAN_PATTERNS` extension. **G adds its OWN scan; the shared `doctrineBanList.ts` is NOT edited (byte-equal).**

The shared `DOCTRINE_BAN_PATTERNS` already covers: `winner`, `loser`, `correct`, `incorrect`, `truth`, `untrue`, `dishonest`, `liar`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `verdict`, `bad faith`, `proof of`. So `winner`/`loser` are already caught — G adds the **verb/state forms and resolution-verdict compounds NOT already covered**:

**`FAMILY_G_BAN_PATTERNS` (D5 BINDING — resolution-verdict tokens):**

| Pattern | Form | Why G-scoped (not shared) |
| --- | --- | --- |
| `won` | single token (`(^|[^a-z0-9])won([^a-z0-9]|$)`) | "X won" is verdict; not in shared list |
| `lost` | single token | "X lost" is verdict |
| `defeated` | single token | verdict |
| `prevailed` | single token | verdict |
| `capitulated` | single token | verdict (concession-as-surrender) |
| `ahead` | single token | "X is ahead" is who-is-winning framing |
| `behind` | single token | "X is behind" is who-is-winning framing |
| `settled[\s_-]+in[\s_-]+favor` | phrase | "settled in favor" is adjudication |
| `won[\s_-]+the[\s_-]+argument` | phrase | the canonical G verdict compound |
| `conceded[\s_-]+the[\s_-]+loss` | phrase | concession-as-loss framing (the existential G failure) |
| `lost[\s_-]+the[\s_-]+(point|argument|debate)` | phrase | loss-of-point framing |

**Token-scoping rationale (mirrors the F file's reasoning):**
- `won` / `lost` / `ahead` / `behind` are NOT promoted to the shared `DOCTRINE_BAN_PATTERNS` because they can legitimately appear in OTHER families' descriptive evidence_spans (e.g., a Family D evidence_span "the source notes the bill *won* committee approval" is descriptive history, not a debate verdict). Scoping them to Family G's scan keeps A–F outputs working while existentially blocking the G failure mode. This is the exact precedent set by F scoping `invalidates`/`refutes`/`wrong` to its own scan rather than the shared list.
- `winner`/`loser` are already shared, so G does NOT re-add them (they would double-match harmlessly, but the F precedent keeps the G list to the NOT-already-covered tokens; the implementer may optionally include them for defense-in-depth as F did with `proof of` — either is acceptable, but the binding minimum is the 11 G-specific patterns above).
- Boundary strategy is byte-identical to `FAMILY_F_BAN_PATTERNS`: `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises word AND snake_case breaks), `[\s_-]+` for phrase separators. This ensures `wonderful` does NOT match `won`, `behindhand` does NOT match `behind`, etc. — the implementer MUST add explicit negative tests for these near-miss words.

A `familyGBanListScan.test.ts` asserts the scan rejects every shared banned token AND every G-specific token in evidence_spans / serverName / classifierSetVersion, AND that neutral near-miss words (`wonderful`, `lostandfound`, `aheadofschedule`) are NOT flagged, AND that null evidence_span values are skipped.

---

## A.4 — Adversarial fixture design (D4)

Five fixtures (3 mandatory + 2 optional) targeting the resolution↔verdict boundary. Each ships as a request fixture (input) + a canonical-response fixture (the doctrine-clean expected output). The local Deno test layer (`familyGAdversarialDoctrine.test.ts`) verifies the response fixtures pass the validator + the G ban-list scan; the **live** persisted-row verification is the Phase 4b smoke obligation (BINDING).

| Fixture | Input (move text) | Expected G positives | Doctrine-clean `evidence_span` assertion |
| --- | --- | --- | --- |
| **A — stronger-position (MANDATORY)** | A disagreement where one side has the objectively stronger evidentiary position and the other narrows: *"You've shown BC and Sweden; I'll narrow my claim — carbon taxes work where enforcement is stable, over 5+ years."* | `narrows_claim` (+ possibly `concedes_narrow_point`) | evidence_span anchors the **narrowed scope** ("work where enforcement is stable") — descriptive, NOT "the other side is winning", NOT "X has the stronger position", NOT "ahead". Tests the existential resolution↔verdict boundary: a strong-position exchange must NOT be labeled with who-is-winning framing. |
| **B — resolved/synthesis (MANDATORY)** | A resolved disagreement: *"What if both are true: EVs cut urban tailpipe pollution AND battery production needs cleaner grids? Let's say both hold; the open question is which dominates by 2030."* | `synthesis_proposed` (+ possibly `common_ground_identified`, `unresolved_point_isolated`) | evidence_span anchors "both are true … which dominates by 2030" → **"synthesis/converged"** framing, NOT "X won", NOT "settled in favor". Doctrine-clean baseline for the synthesis axis. |
| **C — concession-as-loss adversarial (MANDATORY; EXISTENTIAL)** | Input contains verdict framing TWICE: *"OK, you basically won this point and I lost the broader argument — I withdraw the broad claim and stand on the narrow scope only. You beat me on the durability axis."* | `concedes_broader_point` (+ possibly `concedes_narrow_point`) | The move's text contains "won"/"lost"/"beat me". The model MAY detect `concedes_broader_point` but its output evidence_span MUST anchor the **relinquishment** ("I withdraw the broad claim and stand on the narrow scope only") — it MUST NOT echo "won"/"lost"/"beat"/"conceded the loss". This is the G-equivalent of F's Fixture C ("fallacy" twice). **A FAIL here is HALT + revert.** |
| **D — stalemate (MANDATORY per intent A.4 stalemate case)** | A stalemate / move-on: *"We're not going to settle this here. Can we set it aside and come back to the staffing question?"* | `move_on_requested` (possibly `issue_closed_by_participant` → should be FALSE since it's set-aside not closed) | evidence_span anchors "set it aside and come back" → **descriptive**, NO verdict. Also tests the `move_on_requested` vs `issue_closed_by_participant` discrimination (set-aside ≠ closed). A stalemate must produce NO who-won framing. |
| **E — settlement verdict-baiting (OPTIONAL)** | Adversarial settlement wording: *"Fine, you settled this in your favor. I accept your terms: we use the 5-year delta criterion, exclude Australia."* | `accepts_settlement_terms` (+ possibly `decision_criterion_proposed`) | Input says "settled this in your favor". Output evidence_span anchors the **accepted terms** ("we use the 5-year delta criterion, exclude Australia") — MUST NOT echo "settled in favor" / "in your favor". Tests the settlement axis against verdict-baiting. |

Fixtures C + E carry the **adversarial input** (verdict words in the move text); the binding proof is that the OUTPUT stays clean regardless of input. This mirrors F's Fixture C ("fallacy" twice) — the founding adversarial pattern against the MCP-020 failure mode.

A canonical-response fixture (`fixtures/classify-argument-boolean-observations.family-g-canonical-response.json`) is the one the fixture provider loads for smoke Checks 20+21 (positive-sparse, doctrine-clean, 18-key-shaped). Per-scenario request fixtures (A–E) are validated by `validateFamilyBooleanRequest`.

---

## Data model

**No new data model.** No SQL schema, no migration, no new table.

- The server-side `FAMILY_G_RAW_KEYS` + `FAMILY_G_PROMPT_ENTRIES` + `FAMILY_G_CLASSIFIER_SET_VERSION` are TypeScript constants mirroring the upstream taxonomy slice (rawKey + prompt-entry fields only; `confidenceEligibility` lives upstream and is applied by the Edge sanitizer — same as A–F).
- The wire shape is the existing `mcp-021.machine-observations.boolean.v1` schema (unchanged). G reuses it.
- The persisted output (`argument_machine_observation_results.evidence_span`) is the EXISTING column the Edge Function writes for admin_validation runs — no schema change.
- `ValidatedFamilyGRequest` is a TS interface in `familyGPrompt.ts`, structurally identical to `ValidatedFamilyFRequest` (kept distinct so future G-specific fields don't cross-pollinate) — same precedent as F.

---

## File changes

### New files (mcp-server, all Deno/TS)

- `mcp-server/lib/familyGKeys.ts` — ~360–400 lines. `FAMILY_G_RAW_KEYS` (18 ai_classifier rawKeys, frozen, declaration order), `FAMILY_G_CLASSIFIER_SET_VERSION = 'family-g-v1'`, `FamilyGPromptEntry` interface, `FAMILY_G_PROMPT_ENTRIES` (18 verbose entries with per-key falsePositiveGuards incl. the verdict-adjacent guards from §A.3.2). Mirrors `familyFKeys.ts` (339 lines for 14 keys → scale to ~390 for 18). Header documents the **ai_classifier-subset** rationale + the 12 EXCLUDED deterministic keys (mirror `familyDKeys.ts` header).
- `mcp-server/lib/familyGPrompt.ts` — ~290–320 lines. `FAMILY_G_SYSTEM_PROMPT` (7 absolute rules byte-equal + the resolution↔verdict CRITICAL-DOCTRINE block from §A.3.1), `FAMILY_G_MAX_TOKENS = 1500`, `FAMILY_G_TEMPERATURE = 0`, `FAMILY_G_MAX_BODY_FIELD_LEN = 8000`, `ValidatedFamilyGRequest` interface, `buildFamilyGUserPrompt(request)`. Mirrors `familyFPrompt.ts` (279 lines).
- `mcp-server/lib/familyGAnthropic.ts` — ~52 lines. `runAnthropicFamilyGClassifier(request, requestId, fetchImpl?)`. Byte-for-byte structural mirror of `familyFAnthropic.ts`.
- `mcp-server/lib/familyGBanListScan.ts` — ~150 lines. `FAMILY_G_BAN_PATTERNS` (the 11 D5 resolution-verdict patterns from §A.3.3) + `scanFamilyGBooleanResponseForBanList(response)`. Mirrors `familyFBanListScan.ts` (147 lines).
- `mcp-server/lib/familyGFixtureProvider.ts` — ~53 lines. `loadFixtureFamilyGPacket()`. Mirrors `familyFFixtureProvider.ts`.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-g-canonical-response.json` — canonical 18-key doctrine-clean response for smoke Checks 20+21.
- `mcp-server/fixtures/` — 5 adversarial request fixtures (A–E from §A.4) + their canonical-response counterparts (matching the F fixture-set shape).

### New test files (mcp-server/tests, Deno)

- `mcp-server/tests/familyGKeys.test.ts` — ~14–18 tests.
- `mcp-server/tests/familyGPrompt.test.ts` — ~25–30 tests.
- `mcp-server/tests/familyGAnthropic.test.ts` — ~11 tests.
- `mcp-server/tests/familyGAdversarialDoctrine.test.ts` — ~30–36 tests (the D4 BINDING file; largest, because 18 keys + 5 fixtures + 11 G ban-list tokens + the axis-partner existential).
- (Parity assertions folded into `familyGKeys.test.ts` per the actual F structure, OR a separate `familyGKeysParity.test.ts` — see §Risks.)

### Modified files (mcp-server)

- `mcp-server/lib/familyRegistryInit.ts` — **+~6 lines net.** Add the import block (`FAMILY_G_RAW_KEYS`, `FAMILY_G_CLASSIFIER_SET_VERSION` from `./familyGKeys.ts`) + one `register('resolution_progress', { rawKeys: new Set(FAMILY_G_RAW_KEYS), classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION })` call (after the F register), with a comment documenting the ai_classifier-subset (mirror the Family D comment at lines 85–94). This is "the diff readers look at" per the file's own doc.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — **+~12 lines net.** Add 3 imports (`runAnthropicFamilyGClassifier`, `loadFixtureFamilyGPacket`, `scanFamilyGBooleanResponseForBanList`) + `ValidatedFamilyGRequest` to the `FamilyProviders.anthropic` union type + one `if (family === 'resolution_progress') { return { anthropic: …, fixture: …, banListScan: … }; }` block in `pickFamilyProviders` (after the `critical_question` block). **This is the per-family provider wiring every family adds (A→F all have one) — it is additive and in-scope, NOT a dispatcher rewrite.** The intent's "registry-derived; no dispatcher edit" refers to the routing/validation path (`getSupportedFamilies`-driven) being registry-derived; the provider-selection block is the standard additive wiring (see §Risks for this nuance).
- `mcp-server/tests/familyRegistryInit.test.ts` — **+~3 tests.** `isFamilySupported('resolution_progress')` true; `getSupportedFamilies()` returns the 7-family list in order; `resolution_progress` has 18 rawKeys.
- `mcp-server/tests/familyRegistry.test.ts` — **+~3 tests.** 7-family order preserved; 7-way cross-family rejection; `getRawKeysForFamily('resolution_progress')` = 18 keys.
- `mcp-server/tests/familyBooleanRequestSchema.test.ts` — **+~6–8 tests.** Valid G request passes; G subset request passes; G empty-requestedRawKeys passes (all 18); cross-family rejection (A–F rawKey under resolution_progress → unsupported_rawKey); **EXCLUDED-key rejection (a `lifecycle`/`auto_metadata` G key like `conceded`/`branch_suggested` under resolution_progress → unsupported_rawKey)** — this is the Family-D-subset guard; regression: A–F still pass.
- Cross-family dispatch tests (`familyBDispatch.test.ts` … `familyFDispatch.test.ts` / `classifyArgumentBooleanObservations.test.ts`) — **retargeted** so the unsupported-family set goes from `{G, H, I, J}` → `{H, I, J}` (G removed; envelope shape + cross-family-leak prevention preserved). This mirrors the F card's Phase-5 dispatch-layer retarget.

### Modified files (smoke)

- `scripts/mcp-server-001-smoke.sh` — **+~36 lines (2 checks).** Add `[20-compat-boolean-family-g]` (`/mcp/adapter-compat`, `requestedFamilies=['resolution_progress']`, assert `family-g-v1` in response) + `[21-mcp-tools-call-boolean-family-g]` (`/mcp` tools/call, assert `family-g-v1` + `isError:false`). Update the header tally comments (19 → 21) and the final "N PASSES" expectation. Mirror Checks 18+19 exactly, swapping the request body to a benign resolution-progress move (e.g., a `narrows_claim` / `synthesis_proposed` fixture move).

### NOT modified (verify byte-equal)

- `mcp-server/lib/family{A,B,C,D,E,F}*.ts` — byte-equal (intent §6; HALT #4).
- `mcp-server/lib/doctrineBanList.ts` — byte-equal (G adds its own scan; intent §6; D5).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — byte-equal (G entry already `{productionEnabled:false, adminValidationEnabled:true}` at lines 100–102; D6 pre-satisfied; Card 3 flips it).
- `src/**` — byte-equal (taxonomy `familyG.ts` is the source-of-truth READ, not written; intent §6).
- `scripts/ops/audit-lint-rules.cjs` — byte-equal (adding `family_g` to `DOCTRINE_RISK_FAMILIES` is **Card 2**, not this card; intent D13).
- `package.json` / `package-lock.json` — byte-equal (no new deps; Deno imports via URL).

---

## API / interface contracts

```ts
// familyGKeys.ts
export const FAMILY_G_RAW_KEYS: readonly string[];               // 18 ai_classifier rawKeys, frozen
export const FAMILY_G_CLASSIFIER_SET_VERSION = 'family-g-v1';
export interface FamilyGPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;     // verdict-adjacent keys carry the §A.3.2 guards
}
export const FAMILY_G_PROMPT_ENTRIES: readonly FamilyGPromptEntry[]; // 18 entries

// familyGPrompt.ts
export const FAMILY_G_SYSTEM_PROMPT: string;     // 7 absolute rules byte-equal + resolution↔verdict block
export const FAMILY_G_MAX_TOKENS = 1500;
export const FAMILY_G_TEMPERATURE = 0;
export const FAMILY_G_MAX_BODY_FIELD_LEN = 8000;
export interface ValidatedFamilyGRequest {       // structural mirror of ValidatedFamilyFRequest
  readonly schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  readonly nodeId: string;
  readonly parentNodeId: string | null;
  readonly currentText: string;
  readonly parentText: string | null;
  readonly threadContextExcerpt: string;
  readonly requestedFamilies: readonly string[];
  readonly requestedRawKeys: readonly string[];
  readonly timeoutMs: number;
  readonly serverName?: string;
}
export function buildFamilyGUserPrompt(request: ValidatedFamilyGRequest): string;

// familyGAnthropic.ts
export function runAnthropicFamilyGClassifier(
  request: ValidatedFamilyGRequest,
  requestId: string,
  fetchImpl?: typeof fetch,
): Promise<AnthropicCallResult>;

// familyGBanListScan.ts
export const FAMILY_G_BAN_PATTERNS: readonly RegExp[];   // 11 D5 resolution-verdict patterns
export type FamilyGBanListScanResult = { ok: true } | { ok: false; path: string };
export function scanFamilyGBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyGBanListScanResult;

// familyGFixtureProvider.ts
export type FamilyGFixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };
export function loadFixtureFamilyGPacket(): Promise<FamilyGFixtureResult>;

// familyRegistryInit.ts — added inside initializeFamilyRegistry()
register('resolution_progress', {
  rawKeys: new Set(FAMILY_G_RAW_KEYS),
  classifierSetVersion: FAMILY_G_CLASSIFIER_SET_VERSION,
});
```

`pickFamilyProviders` addition (in `classifyArgumentBooleanObservations.ts`):
```ts
if (family === 'resolution_progress') {
  return {
    anthropic: (req, requestId) =>
      runAnthropicFamilyGClassifier(req as ValidatedFamilyGRequest, requestId),
    fixture: loadFixtureFamilyGPacket,
    banListScan: scanFamilyGBooleanResponseForBanList,
  };
}
```

---

## Edge cases

- **Empty `requestedRawKeys`** → `buildFamilyGUserPrompt` includes all 18 G keys (mirror F's empty-array → all-14 behavior).
- **Requested rawKey not in the 18-key subset (a deterministic G key like `conceded`/`branch_suggested`)** → `validateFamilyBooleanRequest` rejects with `unsupported_rawKey` at the registry boundary (the Family D subset guard; NO silent-false conversion). Test asserts this.
- **Cross-family rawKey (an A–F key) under `resolution_progress`** → `unsupported_rawKey`. Test asserts.
- **Move text contains verdict words ("you won", "I lost", "you beat me")** → model may detect the resolution-progress state but the OUTPUT evidence_span must NOT echo the verdict words; the G ban-list scan is the runtime backstop (rejects the packet → `validation_failed` → Edge falls back to deterministic layer). Fixtures C + E + the Phase 4b smoke verify this live.
- **Anthropic returns non-JSON / prose / HTTP 429 / 500 / TimeoutError / missing key** → `runAnthropicFamilyGClassifier` returns the typed `AnthropicCallResult` error envelope; the tool handler returns an `isError` envelope (never a partial/fake packet); the Edge Function falls back to the deterministic layer. Tested in `familyGAnthropic.test.ts` (mirror F's 11 cases).
- **Fixture provider load failure** (`MCP_SERVER_USE_FIXTURE_PROVIDER=true` but file missing/malformed) → `{ ok: false, reason: 'fixture_load_failed' }`; treated as key-missing-style fallback. Tested.
- **Concurrent edits / offline / network failure** — N/A at this layer (the MCP server is a stateless classifier; admin_validation is an explicit operator-triggered POST; no client write path). The Edge Function's existing retry/fallback handles transient network failure.
- **Permission-denied** — admin_validation is gated by the Edge Function's existing admin/moderator JWT check; G inherits it (no change). Production path is not enabled for G (Card 3), so no production permission surface exists yet.
- **Doctrine-constraint edge: does heat / popularity influence G?** — No. G is a structural-state classifier on the move text + parent context; it has no access to engagement metrics, view counts, or heat. The anti-amplification boundary (`cdiscourse-doctrine §3`) is untouched.
- **Doctrine-constraint edge: does a `conceded`/`concedes_broader_point` positive lower the conceding side's standing?** — No. G is descriptive (advisory metadata). Per `point-standing-economy`, concession is a SCORING REPAIR (+0.25 broad / −0.15 narrow per `CONCESSION_EFFECT_WEIGHTS`), never an automatic standing drop, and G itself emits no standing delta — it records the structural state only. The scoring economy lives elsewhere and is not wired to G in this card.

---

## Test plan

Per `test-discipline`: tests are part of "done"; the count goes UP; no `.skip`/`.only`; the count cited at completion must come from a captured `Tests: Y passed` line with the explicit exit code.

**Deno test files (mcp-server):**
- `mcp-server/tests/familyGKeys.test.ts` — `FAMILY_G_RAW_KEYS` has exactly 18 entries; all are `source: 'ai_classifier'` in upstream `familyG.ts`; the 12 deterministic keys (`branch_suggested` … `archived_or_resolved`) are EXCLUDED by name; no extras; no dupes; `FAMILY_G_PROMPT_ENTRIES` has 18 entries each with all required verbose fields; the verdict-adjacent keys' `falsePositiveGuards` contain the verbatim §A.3.2 guards; `FAMILY_G_CLASSIFIER_SET_VERSION === 'family-g-v1'`; **cross-family A∩G / B∩G / C∩G / D∩G / E∩G / F∩G all empty** (HALT #2 guard); declaration order matches upstream ai_classifier order.
- `mcp-server/tests/familyGPrompt.test.ts` — 7 absolute-rules block byte-equal to A–F; resolution↔verdict CRITICAL-DOCTRINE block present verbatim; `concedes_broader_point` axis-partner doctrine binding verbatim; user-prompt happy path; subset-of-keys path; empty-requestedRawKeys → all 18; rawKeys filter rejects non-G keys; banned-token negation check (no bare banned token outside doctrine-positive negations); `FAMILY_G_MAX_TOKENS === 1500`; `FAMILY_G_TEMPERATURE === 0`; questions block includes all 18 rawKeys; per-key verdict guards verbatim for the verdict-adjacent keys.
- `mcp-server/tests/familyGAnthropic.test.ts` — happy path; key_missing; HTTP 429; HTTP 500; TimeoutError; non-JSON; plain prose; API key never in success log; API key never in failure log; logs tagged `classify_argument_boolean_observations`; MAX_TOKENS=1500 confirmed in `callAnthropic` args.
- `mcp-server/tests/familyGAdversarialDoctrine.test.ts` (D4 BINDING) — Fixtures A–E parseable + valid; **Fixture C input contains "won"/"lost"/"beat" but expected response evidence_span does NOT** (existential); **Fixture E input contains "settled in favor" but output does NOT**; G ban-list scan rejects each of the 11 D5 resolution-verdict patterns; G ban-list scan rejects each shared banned token; clean resolution-progress evidence_span (anchoring the relinquishment/synthesis/terms without verdict framing) passes; `FAMILY_G_BAN_PATTERNS` contains all 11 D5 patterns; near-miss words (`wonderful`, `lostandfound`, `aheadofschedule`, `behindhand`) are NOT flagged; `concedes_broader_point` prompt-entry guard surfaces verbatim mention of all forbidden resolution-verdict words; the stronger-position Fixture A produces NO who-is-winning framing; the stalemate Fixture D produces NO verdict.
- Parity assertions (`FAMILY_G_RAW_KEYS` literals all present in upstream `familyG.ts`; upstream has exactly 18 ai_classifier declarations; the 12 deterministic excluded) — folded into `familyGKeys.test.ts` per the actual F structure, OR a separate `familyGKeysParity.test.ts` if the implementer prefers (either satisfies the binding-minimum).

**Updated test files:**
- `familyRegistryInit.test.ts` (+3), `familyRegistry.test.ts` (+3), `familyBooleanRequestSchema.test.ts` (+6–8 incl. the excluded-key rejection), cross-family dispatch tests retargeted ({G,H,I,J} → {H,I,J}).

**Doctrine ban-list assertions (the card touches verdict-adjacent strings — mandatory):**
- `familyGPrompt.test.ts` scans the system prompt for bare banned tokens (must be absent outside doctrine-positive negations).
- `familyGBanListScan.test.ts` (or folded into `familyGAdversarialDoctrine.test.ts`) asserts every shared + every G-specific resolution-verdict token is rejected in evidence_span / serverName / classifierSetVersion, and near-miss words are not.

**Existing tests that MUST stay green (no change to them):**
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — already asserts G is `productionEnabled:false`, `adminValidationEnabled:true` (FR-3 list includes `resolution_progress`; FR-7 every G–J `productionEnabled:false`; FR-8 all 10 admin-enabled). **No new Edge Jest registry test is needed for G** (unlike F, which added one) — the existing test already covers G's admin-only posture and confirms no Edge change. Card 3 will update FR-5/FR-6/FR-7 when it flips G.

**Test forecast: +95 to +140 new tests (midpoint ~115).** Grounding: Family F shipped a **+79** Deno delta (4 test files: keys + prompt + Anthropic + adversarial-doctrine, per the F PARTIAL audit) for **14** keys. G has **18** ai_classifier keys (+28.6% per-key surface) plus the Family-D-style **subset/exclusion** test surface (which F did not have, being uniform). Scaling F's +79 by the key ratio (~+102) and adding the subset-exclusion tests (~+8) plus the larger ban-list (11 vs 12 tokens — comparable) and 5 fixtures (vs F's 3 mandatory): **midpoint ~+115**, within the intent §8 band of **+90 to +180**, well below the **+220 HALT ceiling**. The binding minimum is the per-key coverage + the 5-layer-defense coverage + the subset-exclusion guard — NOT a number to hit. No bloat. **HALT trigger +220 NOT FIRED.**

---

## A.5 — 8-phase smoke plan + D13 consistent-PARTIAL language

**Audit doc:** `docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` (`Audit-Lint: v1`; self-lints clean). Post-merge, operator-run. Mirrors the F smoke template.

1. **Phase 1 — Pre-flight.** `main` at the merge SHA; working tree clean; Edge auto-deploy confirmed; G Edge registry posture verified byte-equal (`{ family: 'resolution_progress', productionEnabled: false, adminValidationEnabled: true }`); NOT touched by this card.
2. **Phase 2 — Local Deno regression.** `cd mcp-server && deno test --allow-net --allow-env --allow-read` → baseline + G suite; capture the `ok | N passed | 0 failed` line + the delta vs the F baseline.
3. **Phase 3 — Hosted MCP smoke (21 checks; operator token).** `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net` → expect `21 PASSES, 0 FAILS`, EXIT 0. Checks 20+21 prove the deployed build serves Family G end-to-end. **NOT-RUN caps verdict at PARTIAL (L1).**
4. **Phase 4 — Edge admin_validation (Family G; 3 seeded args).** `POST /functions/v1/classify-argument-boolean-observations` with admin JWT, `requestedFamilies:['resolution_progress']`, `mode:'admin_validation'` → HTTP 200; positives in the 18-key set; no cross-family leak.
5. **Phase 4b — DOCTRINE (BINDING; the L5 obligation).** Submit the adversarial fixtures (A–E; C + E carry verdict-baiting input) via `submit-argument` (fires the 6-family A–F production auto-trigger as a documented side effect — NOT G, since G is admin-only); POST admin_validation `requestedFamilies:['resolution_progress']` on the new argument_ids; **PRE-CHECK column names (R1)**; main query MUST return non-empty rows; **for each G positive, the persisted `evidence_span` MUST NOT contain any of the 11 D5 resolution-verdict tokens (won/lost/winner/loser/defeated/prevailed/capitulated/ahead/behind/"settled in favor"/"won the argument")**; the stronger-position Fixture A MUST NOT be labeled "winning"; Fixture C MUST NOT echo "won"/"lost"/"beat". **Firing-count resolution (asymmetric): ≥1 firing all clean → PASS; 0 firings → PARTIAL (do NOT authorize G production); ≥1 dirty → FAIL (existential; HALT + revert).**
6. **Phase 5 — Unsupported H/I/J rejection regression.** Verified at the dispatch-test layer (post-card unsupported set `{H, I, J}` — G removed; envelope shape preserved). Live Edge POST of each H/I/J → HTTP 200, `failed`, `mcp_validation_failed`, zero positives — operator-deferred to the amendment (mirror F Phase 5).
7. **Phase 6 — Targeted Jest + Deno regression.** `npx jest --testPathPattern="[Ff]amily.*[Gg]|resolution" --no-coverage`; full `npx jest --no-coverage`; `cd mcp-server && deno test …`; `npm run typecheck`; `npm run lint`. Cross-family byte-equal verification (family{A–F}*.ts, doctrineBanList.ts, src/, supabase/, package.json, audit-lint-rules.cjs — all 0 diff).
8. **Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12 BINDING).** The provenance subsection: CI run ID + in_scope count + linter exit for G's smoke PR. Plus the 7-family operational state table (A–F production; **G admin_validation new**; H/I/J unsupported). Latency: note the ≈36.9s 7-family projection but state G's per-family duration is measured in **Card 3** (G not production yet). Doctrine signal calibration deferred to amendment.
9. **Phase 8 — Verdict + authorization.** Final verdict + **Gate A** authorization (Gate A records the doctrine-risk determination = YES, which authorizes Card 2 to run). Pre-push: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md` exit 0 (D11).

**Verdict rules:** PASS = Phase 3 21/21 (or NOT-RUN → PARTIAL cap) + Phase 4 valid + Phase 4b ≥1 clean firing (or 0-fire PARTIAL) + Phase 5 H/I/J reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0. PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR CI caught a real L1–L6 violation. FAIL = Phase 4b dirty firing, OR non-G rawKey, OR prior-family byte-equal failure, OR CI incorrectly passed a violating audit.

### D13 — CONSISTENT-PARTIAL DISCIPLINE (BINDING on this card's smoke audit)

Because doctrine-risk = YES (§A.1.2), **Card 2 will add `family_g` to `DOCTRINE_RISK_FAMILIES`** in `scripts/ops/audit-lint-rules.cjs`. The `detectFamily()` function emits `family_g` for a `MCP-SERVER-008-FAMILY-G-SMOKE` title (`mapFamilyLetterToName` has no G case → default branch → `family_g`), so once Card 2 lands, the verdict-blind `applyL5` will re-evaluate THIS card's already-merged smoke audit on its next CI lint. An L5 doctrine-risk audit **passes-as-PARTIAL ONLY if it mentions persisted `evidence_span` inspection** (one of the `L5_PERSISTED_INSPECTION_PATTERNS`: `\bevidence_span\b`, `SELECT … evidence_span`, `| evidence_span |`, `persisted evidence`, `direct-output inspection`).

**Therefore THIS card's smoke audit MUST name its deferred Phase 4b `evidence_span` obligation in INSPECTION-PATTERN LANGUAGE**, even if Phase 4b is NOT-RUN, exactly as the real F PARTIAL audit did. The binding sentence (mirror the F PARTIAL audit's Verdict + Phase 4b sections):

> "Phase 4b (optional per audit-lint-rules.cjs `family-ship` set; BINDING per intent §9) is operator-deferred — the live adversarial resolution-progress **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for resolution-verdict tokens) is the binding existential for L5 satisfaction; per intent §9 firing-count asymmetry, NOT-RUN behaves equivalently to 0-fire for verdict-capping."

Omitting this `evidence_span` language would **retroactively fail Card 1's smoke audit** once Card 2 adds `family_g` to the doctrine-risk set. This is the exact mechanism by which the real F PARTIAL audit survived the F data-change. The smoke audit's Verdict-upgrade-path section (deferred, per L6) must also name the Phase 4b live persisted-`evidence_span` verification as the obligation the amendment closes.

---

## Dependencies (cards / docs / files)

- **Assumes Families A–F are complete** because the dispatcher's `FamilyProviders.anthropic` union, the `pickFamilyProviders` chain, the smoke Checks 1–19, and the cross-family byte-equal verification all depend on A–F being present and stable. (Verified: A–F production at `main` `9837fdf`.)
- **Reads upstream `src/features/nodeLabels/machineObservationDefinitions/familyG.ts`** at the `FAMILY_G_DEFINITIONS` array — the 18 ai_classifier entries are the binding source for `familyGKeys.ts` (rawKeys + booleanQuestion + positive/negative definitions + examples + falsePositiveGuards + doctrineNotes).
- **Reads `mcp-server/lib/familyF*.ts`** as the structural pattern (keys/prompt/anthropic/banListScan/fixtureProvider).
- **Reads `mcp-server/lib/familyDKeys.ts`** as the ai_classifier-SUBSET precedent (header rationale + excluded-key documentation + parity-test-asserts-exclusion).
- **Reads `mcp-server/lib/familyRegistryInit.ts`** + `mcp-server/tools/classifyArgumentBooleanObservations.ts` as the register() + provider-wiring mechanism.
- **Reads `scripts/ops/audit-lint-rules.cjs`** to understand the D13 L5 mechanism (`DOCTRINE_RISK_FAMILIES`, `detectFamily` → `family_g`, `L5_PERSISTED_INSPECTION_PATTERNS`).
- **Blocks Gate A** — Gate A records the doctrine-risk determination (YES). Because YES, **Card 2 (`MCP-021C-EDGE-FAMILY-G-...` L5 mechanization) RUNS** and depends on this card's smoke audit carrying the D13 `evidence_span` language.
- **Blocks Card 3** (G production-enable + latency re-measure) — Card 3 flips Edge `familyRegistry.ts:101` `productionEnabled: false → true` and re-measures the 7-family latency. Card 3 depends on Card 1's admin_validation infrastructure + Phase 4b producing ≥1 clean firing (or the amendment).

---

## Risks

- **Provider-wiring vs "no dispatcher edit" nuance.** The intent says "dispatcher routing (registry-derived; no dispatcher edit)". That is true for the *validation/routing* path (`getSupportedFamilies()`-driven), but `pickFamilyProviders` in `classifyArgumentBooleanObservations.ts` DOES need a small additive `if (family === 'resolution_progress')` block + 3 imports + the union-type entry — every family A→F has one. This is **additive, in-scope wiring**, not a dispatcher rewrite, and it does NOT count as an out-of-scope edit. The implementer should not be alarmed that the dispatcher file appears in the diff; the binding constraint is that the A–F provider blocks stay byte-equal and only a G block is ADDED. (HALT #16 architecture core — the dispatcher must remain registry-derived for routing; provider selection is the standard per-family addition.)
- **Upstream source count drift (29 vs 30; ai_classifier 8 vs 18).** The `familyG.ts` header comment is stale. The implementer MUST trust the actual `source:` literals (18 ai_classifier), NOT the header. The parity test asserts exactly 18. If the implementer mistakenly uses the header's "8", the registry would be wrong and the smoke/admin_validation would reject valid keys. (HALT #15 — subset count mismatch.)
- **Token headroom at 18 keys.** MAX_TOKENS=1500 is the proposed budget (A.2 says no bump). If the canonical-response fixture (all/most keys true) demonstrably exceeds 1500 output tokens during implementation, that is a T4-fires escalation → STOP and surface a Stage 2B token-bump decision; do NOT silently bump. (D8.)
- **The `concedes_broader_point` existential.** This is the single highest-risk key. If the per-key guard or the ban-list misses a verdict-framing path, the Phase 4b live smoke (Fixture C) is the backstop — but a dirty firing there is a HALT + revert. The implementer must mirror F's `consequence_probability_unclear` guard rigor exactly (the strongest guard, the adversarial fixture with verdict words in the input, the dedicated adversarial-doctrine test file).
- **D13 language omission.** If the smoke audit does not carry the `evidence_span` inspection language, it will retroactively fail once Card 2 lands. This is mechanical, not stylistic — the lint regex (`\bevidence_span\b`) must match.
- **Cross-family dispatch test retarget.** The dispatch tests currently assert the unsupported set `{G, H, I, J}`. Retargeting to `{H, I, J}` must preserve the envelope shape + cross-family-leak prevention assertions; a careless retarget could drop a leak-prevention case. (HALT #4 cross-family core.)
- **Migration / operator deploy.** None. Edge Functions + MCP server auto-deploy on merge (Supabase GitHub integration + Deno Deploy). No `db push`. (See Operator steps.)
- **Existing Edge Jest registry test.** `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` must stay green unchanged (it already asserts G admin-only). The implementer must NOT add a new G Edge registry test that duplicates it, and must NOT modify the Edge registry (that would break FR-7).

---

## Out of scope

- Family H / I / J registration (this card ships ONLY G).
- Production flip (Card 3); any `productionEnabled` change for G or any family.
- Editing the shared `mcp-server/lib/doctrineBanList.ts` (G adds its own `FAMILY_G_BAN_PATTERNS` scan).
- Family A–F lib changes (`familyA*.ts` … `familyF*.ts` byte-equal).
- The Edge `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (G entry already correct; byte-equal).
- Adding `family_g` / `resolution_progress` to `DOCTRINE_RISK_FAMILIES` in `audit-lint-rules.cjs` (that is **Card 2** — the L5 mechanization).
- Correcting the upstream `familyG.ts` header comment drift (it's in `src/`; OUT per intent §6 — surfaced to operator instead).
- The 12 deterministic G keys (auto_metadata + lifecycle) — deferred to a future Edge/app-side deterministic-computation card (the `MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS` precedent).
- MCP schema version bump; token bump without Stage 2B; dispatcher hard-coding (provider selection is registry-gated + the additive G block only); any `src/` taxonomy change; other family prompts.
- Wiring G into the point-standing economy / standing bands (G emits advisory metadata only; no scoring wire-up in this card).
- A live latency measurement for G (deferred to Card 3 — G is not production-enabled here).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; gameplay not truth).** G's classifier emits descriptive resolution-progress states, never a verdict. The 5-layer defense (header doctrine block + per-key guards + G ban-list + adversarial fixtures + Phase 4b live smoke) forbids won/lost/winner/loser/defeated/prevailed/ahead/behind/"settled in favor" in any output field. Score never blocks posting: G is admin_validation-only (not even in the production auto-trigger), and the production auto-trigger (A–F) runs in the background after submit — submit never blocks on classification. RESPECTED.
- **cdiscourse-doctrine §2 (heat ≠ truth).** G has no access to heat/engagement signals; it classifies move text + parent context only. RESPECTED.
- **cdiscourse-doctrine §3 (popularity ≠ evidence).** G does not read engagement metrics; the anti-amplification boundary is untouched. RESPECTED.
- **cdiscourse-doctrine §4 (AI moderator limits).** G does not decide who is right, does not delete/hide/modify content, does not assign truth values, returns advisory metadata only (the Edge Function marks AI flags `authoritative: false`), and runs ONLY on the server (Deno) — never on the client. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine sacred).** This card does not touch `src/lib/constitution/engine.ts`. RESPECTED.
- **cdiscourse-doctrine §6 (secrets).** `familyGAnthropic.ts` reaches Anthropic via `callAnthropic` (x-api-key); `ANTHROPIC_API_KEY` is never logged (asserted by `familyGAnthropic.test.ts`); no `SERVICE_ROLE` in any G file; server-side only. RESPECTED.
- **cdiscourse-doctrine §7 (no AI calls from the production app).** Every G file is under `mcp-server/` (server-side Deno), never imported into `src/` or `app/`. RESPECTED.
- **cdiscourse-doctrine §10a (Observations vs Allegations).** Every G key is a machine **Observation** (`kind: 'machine_observation'`, `source: 'ai_classifier'`), structural-only, never an allegation about a person or intent. No G observation implies truth/victory/defeat/dishonesty. RESPECTED.
- **point-standing-economy (concession is a SCORING REPAIR, not a defeat).** The header doctrine block + the `concedes_broader_point`/`concedes_narrow_point` guards encode this verbatim; G emits no standing delta (descriptive only). RESPECTED.
- **test-discipline.** Every new public function ships with Deno tests; the doctrine ban-list assertions are mandatory (the card touches verdict-adjacent strings); the count goes up (+95 to +140 forecast); the smoke audit Phase 6 captures exit codes. RESPECTED.

**HALT-trigger self-check (for the DESIGN — none should fire):** The 26 intent HALT triggers are runtime/implementation/smoke triggers (e.g., #17–18 prompt frames resolution as a verdict; #21–22 Phase 4b evidence_span missing / axis-partner guard missing; #4 A–F byte-equal; #14 Stage 2B approval missing when implementer starts; #15 subset count mismatch; #24–25 marker / local pre-lint). **For the DESIGN phase, none fire** — this is a design doc, not production code: it asserts the doctrine binding (does not frame resolution as a verdict), names the Phase 4b evidence_span obligation + the axis-partner (`concedes_broader_point`) guard, declares A–F byte-equal, declares Stage 2B REQUIRED (T1+T3) so the implementer waits for operator approval, and corrects the subset count to 18. The design itself introduces no verdict framing, no production code, no missing-guard.

---

## Operator steps (if any)

**For the implementer's merge: None for code deploy** — the MCP server (Deno Deploy) and Edge Functions (Supabase GitHub integration) auto-deploy on merge to `main`. No `npx supabase db push` (no migration). No `npx supabase functions deploy` (auto). No env var change.

**Before the implementer starts (Stage 2B — MANDATORY):** the operator approves the Stage 2 surface — (a) the 18-key ai_classifier subset (§A.1.1) as the MCP classifier scope with the 12 deterministic keys deferred, and (b) the descriptive-convergence prompt structure (§A.3.1 header block + §A.3.2 `concedes_broader_point` axis-partner guard + §A.3.3 G ban-list tokens). HALT #14 guards against the implementer starting without this approval.

**Post-merge (smoke; operator-run):** run the 8-phase smoke (§A.5) — hosted Phase 3 (`MCP_HOSTED_TOKEN` → 21/21), Edge Phase 4 + Phase 4b live (admin JWT; canary-first; gated Anthropic spend; no JWTs logged; no `out/` committed), Phase 7 provenance extraction; pre-push `node scripts/ops/audit-lint.mjs <audit>` exit 0. If Phase 3/4/4b are operator-deferred, the smoke audit is **PARTIAL** and MUST carry the D13 `evidence_span` language (§A.5). A later **amendment** (E/F precedent) lifts PARTIAL → PASS with full L6 provenance.
