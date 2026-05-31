# MCP-SERVER-009-FAMILY-H — claim_clarity classifier (admin_validation only)

**Status:** Design draft
**Date:** 2026-05-31
**Epic:** Epic 12 / MCP semantic-referee track (MCP-021A family-ship arc)
**Release:** MCP server family-ship suite — Card 1 of 3 (admin ship → Gate A → Card 2 L5 mechanization (conditional) → Gate B → Card 3 production-enable + latency re-measure)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/389 (umbrella #388)
**Branch:** `feat/MCP-SERVER-009-FAMILY-H`
**Intent brief:** `docs/designs/MCP-SERVER-009-FAMILY-H-intent.md` (binding decisions D1–D13; 24 HALT triggers; Stage 2B triggers)
**Predecessor (Phase 0 verified):** `main` at `7a30576` (post-OPS-WORKFLOW-RESTORATION Phase 4+5 completion merge; #387 + #399 landed). Families A–G production + auto-trigger live; H/I/J unsupported on the MCP server.
**Prerequisites:** #387 + #399 merged (verified by branch state). H/I/J `productionEnabled: false` at `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108` (H entry). A–G operational on the hosted MCP server. Ship-readiness HALT 3 (uniform `ai_classifier`) PASS confirmed by the pre-design workflow `wf_e8ff14ab-811`.

---

## Goal (one paragraph)

Ship Family H (`claim_clarity`) on the hosted MCP server in an **admin_validation-only** Edge posture, mirroring the Family G pattern (`mcp-server/lib/familyG*.ts` + the 5-layer doctrine defense) byte-for-byte structurally. H is the first family with **UNIFORM `ai_classifier` source** since Family F — the 12 H keys all carry `source: 'ai_classifier'` in upstream `familyH.ts`, so HALT 3 PASS and no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` Edge entry is required (HALT 12 inapplicable). The doctrine peril, however, is acute and distinct: H's keys (`conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`) sit one semantic step from the verdict-shaped reading — "missing" reads as "the speaker failed", "low specificity" reads as "weak/vague/lazy", "unclear" reads as "wrong" — exactly the verdict framing `cdiscourse-doctrine §1` forbids. H's classifier must surface **descriptive formulation-state** (is a conclusion stated? is a reason attached? is the claim broadly or narrowly scoped? is a referent unclear?), never a verdict on truth or the speaker. This card creates `familyHKeys.ts`, `familyHPrompt.ts`, `familyHAnthropic.ts`, `familyHBanListScan.ts`, `familyHFixtureProvider.ts`, one `register('claim_clarity', …)` call, the `pickFamilyProviders` provider block, fixtures, Deno tests, the smoke +2 checks, and a new Edge Jest registry test (`mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts`) mirroring `…FamilyE.test.ts`. It does NOT flip production (Card 3), does NOT register I/J, does NOT change A–G (byte-equal), does NOT edit the Edge `familyRegistry.ts` (H entry is already admin-only), does NOT edit the shared `doctrineBanList.ts` (H adds its own scan), and does NOT add a `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry (H is uniform). The score-never-blocks-posting invariant is preserved end-to-end: the auto-trigger that invokes production families runs in the background after submit; H is not even production-enabled, so it never touches the submit path.

---

## A.1 — Source verification + Stage 2B + THE GATING doctrine-risk determination

### A.1.0 — Source verification (Phase 0 finding refined)

The intent brief and the pre-design workflow `wf_e8ff14ab-811` both state **12 keys with uniform `ai_classifier` source**. Direct inspection of `src/features/nodeLabels/machineObservationDefinitions/familyH.ts` confirms:

| Source | Count | rawKeys |
| --- | --- | --- |
| `ai_classifier` | **12** | (1 existing + 11 NEW — enumerated below) |
| **Total** | **12** | (all uniform `ai_classifier`) |

**No `auto_metadata` or `lifecycle` entries.** This contrasts with Family D (mixed: 19 ai_classifier + 8 deterministic) and Family G (mixed: 18 ai_classifier + 12 deterministic). H matches **Family E (uniform 16 ai_classifier)** and **Family F (uniform 14 ai_classifier)** structurally. **No subset/exclusion is required**, and no `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry in the Edge `booleanObservationRequestBuilder.ts` is needed (HALT 12 inapplicable for H; the existing entries for D + G remain byte-equal).

> NOTE — the upstream `familyH.ts` file header (lines 1–24) is **already accurate** (it correctly states "12 entries total; 1 existing + 11 NEW; all `source: 'ai_classifier'`"). There is no header/code drift like the G one — this card has no `src/`-touching obligation surfaced to the operator.

### A.1.1 — The exact ai_classifier rawKey list for `familyHKeys.ts` (the MCP classifier scope)

**`FAMILY_H_RAW_KEYS` = the 12 ai_classifier rawKeys, in upstream declaration order:**

| # | rawKey | New? | Verdict-adjacency | Upstream priority |
| --- | --- | --- | --- | --- |
| 1 | `provides_temporal_constraint` | existing #51 (RETROACTIVE_VERBOSE_DEFINITIONS) | **LOW** — temporal scope is structurally descriptive; doctrineNotes already say "not a verdict on whether the claim's time-scope is correct" | 46 |
| 2 | `claim_present` | **NEW** | **MEDIUM** — "no claim present" reads as "empty/missing" but is descriptive | 230 |
| 3 | `reason_present` | **NEW** | **MEDIUM** — "no reason present" reads as "unsupported" if mishandled | 231 |
| 4 | `conclusion_missing` | **NEW** | **HIGHEST** — "no conclusion" → "argument is incomplete" drift; upstream guard explicit | 232 |
| 5 | `reason_missing` | **NEW** | **HIGHEST** — "no reason" → "argument is unsupported" drift; upstream guard explicit | 233 |
| 6 | `multiple_claims_present` | **NEW** | **MEDIUM** — "multi-claim" reads as "scattered/disorganized" if mishandled | 234 |
| 7 | `claim_specificity_high` | **NEW** | **LOW** — narrow + concrete is structurally descriptive; no verdict adjacency | 235 |
| 8 | `claim_specificity_low` | **NEW** | **HIGHEST** — "broad" → "weak/vague/lazy" drift; upstream guard explicit | 236 |
| 9 | `quantifier_present` | **NEW** | **LOW** — quantifier use is descriptive; no verdict adjacency | 237 |
| 10 | `modal_language_present` | **NEW** | **LOW** — modal status is grammatical; no verdict adjacency | 238 |
| 11 | `hedging_present` | **NEW** | **MEDIUM** — "hedged" could read as "uncertain/weak" if mishandled | 239 |
| 12 | `unclear_reference_present` | **NEW** | **HIGHEST** — "unclear pronoun" → speaker-judgment drift ("you were unclear/sloppy"); upstream guard explicit | 240 |

**`FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1'`.**

**No exclusion list.** Family H has zero `auto_metadata` and zero `lifecycle` keys. The `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant present in Family D + G keys files is **omitted** for H (E + F also omit it — uniform-source precedent). The parity test asserts exactly 12 ai_classifier declarations in upstream `familyH.ts` and zero excluded; it asserts NO entries with `source: 'auto_metadata'` or `source: 'lifecycle'`.

### A.1.2 — THE GATING DOCTRINE-RISK DETERMINATION

**DOCTRINE-RISK: YES.**

**Reasoning:** Family H is doctrine-risk because at least 4 of the 12 ai_classifier keys are verdict-adjacent at the clarity↔verdict boundary — `conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`. The upstream `familyH.ts` `doctrineNotes` + `falsePositiveGuards` blocks already encode the anti-verdict guard precisely BECAUSE these keys live in the verdict neighborhood:

- `conclusion_missing` (familyH.ts:200-209): "**Do NOT frame as 'argument is incomplete'** — many moves intentionally leave conclusions for the reader." doctrineNotes: "**this is NOT a verdict on argument quality; some of the strongest moves leave the conclusion implicit.**"
- `reason_missing` (familyH.ts:243-253): "**Do NOT frame as 'argument is unsupported'** — many short moves are stage-setting." doctrineNotes: "**NOT a verdict on quality. A claim without reason invites the responder to ask 'why?'.**"
- `claim_specificity_low` (familyH.ts:368-377): "**Do NOT frame as a quality verdict — broad claims are not 'weak'.**" doctrineNotes: "**low specificity is NOT a verdict on quality.**"
- `unclear_reference_present` (familyH.ts:540-548): "**Do NOT mark TRUE when the referent is clearly recoverable from the parent.**" doctrineNotes: "**NEVER a verdict on the author's clarity skill; pronouns are often clear in context that the classifier cannot see.**"

A classifier that detects "no conclusion stated" or "broad claim" or "unclear pronoun" is one careless prompt phrasing away from emitting "the speaker wrote a weak/sloppy/bad argument" / "the claim is unsupported" / "the argument fails" in an `evidence_span`. That is the exact MCP-020 failure mode the 5-layer defense exists to prevent. The risk is **structural and acute** (intent §3 calls clarity↔verdict adjacency "the existential concern"), but it is **structurally tractable** via the same 5-layer defense Family E built for `slippery_slope_reasoning_present`, Family F built for `consequence_probability_unclear`, and Family G built for `concedes_broader_point` (header doctrine block + per-key guards + H-local ban-list scan + adversarial fixtures + Phase 4b live smoke).

**The axis-partner key — H's analog to E's `slippery_slope`, F's `consequence_probability_unclear`, G's `concedes_broader_point`** — is **`claim_specificity_low`** (the broad-claim key). It is the single H key most likely to be mis-framed as "weak/vague/lazy/sloppy argument" because the natural English reading of "low specificity" slides immediately to the quality verdict. It carries the strongest verbatim guard (§A.3.2). A secondary axis-partner is `unclear_reference_present` (speaker-clarity-skill verdict drift).

**Consequence:** Because doctrine-risk = YES, the suite's **Card 2 (L5 mechanization) RUNS** — Card 2 will add `family_h` (+ `claim_clarity` + the axis-partner key `claim_specificity_low`) to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`, after which the verdict-blind `applyL5` requires every H smoke audit to evidence persisted `evidence_span` inspection. This is why D9/D13 (consistent-PARTIAL discipline) is binding on THIS card's smoke audit (see §A.5).

### A.1.3 — Stage 2B determination

**Stage 2B REQUIRED because T3 (T3 only — T1 NOT FIRED).**

| Trigger | Fires? | Why |
| --- | --- | --- |
| **T1 — mixed source provenance** | **FALSE** | H is uniform `ai_classifier` (§A.1.1; 12/12). No subset/exclusion decision. Family D/G subset precedent does **NOT** apply. T1 does NOT fire. Stage 2B not required on this axis. |
| T2 — compound rawKey collision | FALSE | No rawKey in the H set collides across families (cross-family A∩H…G∩H all empty — parity test asserts). The 11 NEW H rawKeys are all H-specific structural-formulation keys; the 1 existing key (`provides_temporal_constraint`) belongs to H per upstream definition. |
| **T3 — doctrine-risk framing** | **TRUE** | clarity↔verdict adjacency (§A.1.2 = YES). This requires the **doctrine prompt-structure decision** (how H detects formulation-state WITHOUT verdict framing). → Stage 2B MANDATORY. The operator-decision surface: confirm the descriptive-formulation prompt header + the `claim_specificity_low` axis-partner per-key guard + the H ban-list token extensions (§A.3). |
| T4 — MAX_TOKENS bump | FALSE (see A.2) | 12 keys × ~85 tokens ≈ 1020 output, well under 1500 with ~480 token headroom. F shipped 14 keys at 1500 with ~310 headroom; H is strictly lighter. Designer assessment: a bump is NOT required. T4 does NOT fire. |
| T5 — dependency on prior-family outputs | FALSE | H's classifier is self-contained on the argument move text + parent context + thread excerpt. It does NOT read A–G outputs (no cross-family input coupling). Identical to D/E/F/G. |

**Net: Stage 2B is MANDATORY (T3 only).** Per intent §4, the implementer MUST NOT start until the operator has approved the Stage 2 surface (the descriptive-formulation prompt structure for the 4 HIGHEST-risk keys + the H-local ban-list). HALT trigger #14 ("Stage 2B REQUIRED but operator approval missing when implementer starts") guards this.

> Contrast with G: G's Stage 2B was **T1 + T3** (mixed-source subset decision + doctrine-risk). H's is **T3 ONLY** — the source-split decision surface that G needed (and Card 1 of the G chain agonized over) is INAPPLICABLE here because H is uniform. This narrows the operator-decision surface to the doctrine prompt structure + ban-list axis.

---

## A.2 — Token budget + latency

### A.2.1 — Token budget (T4 evaluation)

| Family | ai_classifier keys | MAX_TOKENS | Headroom notes |
| --- | --- | --- | --- |
| A/B/C | (varies) | 1500 | family-standard |
| D | 19 | 1500 (subset) | largest subset; no truncation observed |
| E | 16 | 1500 | ~60 token headroom (per F design) |
| F | 14 | 1500 | ~310 token headroom |
| G | 18 | 1500 (subset) | thin headroom; D shipped 19 at 1500 OK |
| **H** | **12** | **1500 (proposed)** | **~480 token headroom — the loosest of A–H** |

**Decision: `FAMILY_H_MAX_TOKENS = 1500` (NO bump). T4 does NOT fire.**

**Token math:** Naive estimate is **12 keys × ~85 tokens/key ≈ 1020 output tokens** for an all-positive response (every key true with a full 240-char evidence_span). That leaves **~480 tokens of headroom** against the 1500 budget — the largest absolute headroom of any family A–H to date. The conservative-positives bias baked into the prompt ("claim-clarity signals are sparse — most moves have 1 to 3 positives") keeps realistic output well below the all-positive ceiling. F shipped 14 keys at 1500 with no reported truncation; H's 12 keys is strictly lighter on every dimension. The implementer MUST add a `familyHPrompt.test.ts` assertion `FAMILY_H_MAX_TOKENS === 1500` and `FAMILY_H_TEMPERATURE === 0`. If, during implementation, the canonical-response fixture (all-or-most-true) demonstrably exceeds the budget, that is a T4-fires escalation → STOP and surface to the operator as a Stage 2B token-bump decision (do NOT silently bump). HALT 10 guards a bump above 2000 without explicit operator approval.

### A.2.2 — Latency

H is the **8th family**. Per `docs/ops/LATENCY-BUDGET.md` and the G design §A.2.2:
- The budget is defined against `wall_clock_background` p95 (PASS < 30s, PARTIAL ≥30s & <45s, FAIL ≥45s OR submit blocks on classification).
- 7-family projection (post G enable) ≈ 36.9s. 8 families ≈ **43.4s** (under the 45s FAIL budget, deep in PARTIAL band). 9 ≈ 49.9s (FAIL — crosses 45s; the 9th family Family I will require operator action).

**Doctrine note:** the auto-trigger that runs production families executes in the BACKGROUND after submit (the submit path does NOT block on classification — the FAIL condition is "submit blocks on classification, checked first"). This satisfies `cdiscourse-doctrine §1` "Score never blocks posting." **H is admin_validation-only in this card, so it does NOT even enter the 7-family production auto-trigger** — H's per-family latency contribution to `wall_clock_background` p95 is **measured in Card 3** (when H flips to production), NOT in this card. This card adds zero latency to the production path. The smoke audit Phase 7 records the operational state but does NOT need a new latency measurement (H is not production yet).

---

## A.3 — Clarity↔verdict doctrine binding (D3)

The 5-layer defense, mirrored from `familyGPrompt.ts` + `familyGBanListScan.ts`:

### A.3.1 — Layer 1: header CRITICAL-DOCTRINE block in `FAMILY_H_SYSTEM_PROMPT`

The system prompt MUST contain (byte-equal) the **7 absolute rules** block shared verbatim across A/B/C/D/E/F/G (lines 76–83 of `familyGPrompt.ts`: no-right, no-winner, no-truth-value, no-popularity, no-person-labeling, no-hiding/deleting, no-blocking). Then a Family-H-specific framing:

> You classify whether an argument MOVE exhibits one or more CLAIM-CLARITY structural formulation states — a claim explicitly stated or absent, a reason attached or absent, a conclusion stated or left implicit, multiple claims bundled, a claim broadly or narrowly scoped, a quantifier or modal verb present, hedging present, a referent left unclear, a temporal scope attached.

Then the **CRITICAL DOCTRINE — claim-clarity states are DESCRIPTIVE FORMULATION-STATE, never verdicts** block (the H analog of G's CQ-as-descriptive-convergence block):

> - A claim-clarity observation describes the SURFACE FORMULATION of a move — whether a claim is stated, whether a reason is attached, whether the claim is scoped narrowly or broadly, whether a referent is unambiguous. It NEVER asserts whether the move is "weak", "strong", "bad", "good", "sloppy", "sound", "valid", "invalid", "complete", "incomplete", "supported", "unsupported", or whether the speaker was unclear/lazy/careless.
> - **Absence is not failure.** When a move is detected as `conclusion_missing` (the reasoning is shown without an explicit conclusion statement), the observation records the structural ABSENCE OF A STATED CONCLUSION. It NEVER frames the move as "incomplete", "broken", "failed", or as the speaker having "left the argument hanging". Many of the strongest moves intentionally leave the conclusion implicit — leaving it for the reader is a rhetorical choice, not a defect.
> - **No reason attached is not unsupported.** When a move is detected as `reason_missing` (a claim asserted without a because/since/ground clause), the observation records the structural ABSENCE OF AN ATTACHED REASON. It NEVER frames the move as "unsupported", "weak", "ungrounded", or as the speaker having "failed to justify". Many short moves are stage-setting; reasons may live in the parent or future replies.
> - **Broad is not weak.** When a move is detected as `claim_specificity_low` (the claim is broadly scoped without concrete particulars), the observation records the structural BREADTH OF THE CLAIM. It NEVER frames broadness as "weak", "vague", "lazy", "sloppy", "careless", "unclear", or as a quality defect. Broadness is a different SHAPE, not a lower QUALITY.
> - **Unclear reference is not speaker error.** When a move is detected as `unclear_reference_present` (a pronoun or demonstrative without a single clear antecedent in the visible context), the observation records the structural REFERENCE AMBIGUITY VISIBLE TO THE CLASSIFIER. It NEVER frames the speaker as "unclear", "sloppy", "careless", or "confused" — pronouns are often clear in context the classifier cannot see (parent threads, prior moves, shared topic conventions).
> - The output MUST NOT contain the words: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical, "bad reasoning", "bad argument", "bad writing", "argument is incomplete", "argument is unsupported", "argument is weak", "claim fails", "claim is wrong", "claim is weak", "claim is bad". If the input move text itself contains such words (e.g., "you wrote a weak/sloppy/bad argument"), the model MAY still detect the underlying claim-clarity state, but its own output `evidence_span` MUST NOT echo the verdict framing — anchor the structural state (the absent conclusion, the absent reason, the broad scope, the ambiguous pronoun), never the verdict words.

Then the standard conservative-positives bias paragraph (claim-clarity signals are usually sparse — most moves have 1 to 3 positives; few have more than 5).

A `familyHPrompt.test.ts` assertion confirms the 7 absolute rules are byte-equal to A–G AND the clarity↔verdict doctrine block is present verbatim AND no bare banned token appears outside the doctrine-positive negations.

### A.3.2 — Layer 2: per-key `falsePositiveGuards` on the verdict-adjacent keys

The "axis-partner" key — H's analog to E's `slippery_slope` and F's `consequence_probability_unclear` and G's `concedes_broader_point` — is **`claim_specificity_low`** (the HIGHEST verdict-adjacency: a broad claim is the single key most likely to be mis-framed as "weak/vague/lazy/sloppy"). It carries the **strongest** verbatim guard:

> DOCTRINE: a broad claim is a structural SHAPE (general scope, no concrete particulars), a different formulation choice — NEVER framed as "weak", "vague", "lazy", "sloppy", "careless", "unclear", "unsound", or any quality verdict. The evidence_span MUST anchor the verbatim broad-scoped wording (e.g., "carbon taxes work", "libraries matter", "this always happens") — NOT a judgment about whether the claim is well-formed. If the move's own text says "I wrote a weak argument" or "my claim was vague", the model may still detect `claim_specificity_low` but its output MUST NOT echo "weak"/"vague"/"sloppy"/"lazy". The output MUST NOT contain: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical, "bad reasoning", "bad argument", "argument is weak", "claim is weak", "claim fails".

The other 3 HIGHEST-risk keys each carry a proportional guard naming their specific failure mode:

**`conclusion_missing`** (the no-conclusion-stated key):
> DOCTRINE: absence of a stated conclusion is a structural FORMULATION CHOICE (the reasoning is shown, the conclusion is left implicit). It is NEVER framed as "argument is incomplete", "failed to conclude", "broken argument", "missing the point", or any incompleteness verdict. Many strong moves intentionally leave conclusions for the reader. The evidence_span MUST anchor the verbatim reasoning that builds toward the unstated conclusion — NOT a judgment that the move is unfinished. The output MUST NOT contain: incomplete, unfinished, "argument is incomplete", "failed to", "broken".

**`reason_missing`** (the no-reason-attached key):
> DOCTRINE: absence of an attached reason is a structural FORMULATION CHOICE (the claim is asserted; the reason may live in the parent, prior moves, future replies, or simply be reserved). It is NEVER framed as "argument is unsupported", "claim is unsupported", "unjustified", "ungrounded", or any quality verdict. Short stage-setting moves are common. The evidence_span MUST anchor the verbatim bare claim — NOT a judgment that the move is unjustified. The output MUST NOT contain: unsupported, ungrounded, unjustified, "argument is unsupported", "claim is unsupported".

**`unclear_reference_present`** (the ambiguous-pronoun key):
> DOCTRINE: presence of an ambiguous referring expression is a structural feature VISIBLE TO THE CLASSIFIER. It is NEVER framed as the speaker being "unclear", "sloppy", "careless", "confused", or "imprecise". Pronouns are often clear in context the classifier cannot see (prior thread, shared topic). The evidence_span MUST anchor the verbatim ambiguous pronoun ("this", "they", "it") and the alternative referents the classifier identifies — NOT a judgment about the speaker's writing skill. The output MUST NOT contain: unclear (as speaker label), sloppy, careless, confused, "the speaker was unclear", "the author was unclear", "imprecise writing".

The 4 MEDIUM-risk keys (`claim_present`, `reason_present`, `multiple_claims_present`, `hedging_present`) each carry a proportional guard. Example for `hedging_present`:

> DOCTRINE: presence of hedging language is a structural FORMULATION CHOICE (the speaker explicitly weakens the claim from a universal assertion). It is NEVER framed as the speaker being "uncertain", "weak", "wishy-washy", "non-committal", or as the claim being "weakly supported". Appropriately hedged claims carry LESS evidence debt than the same claim asserted with certainty. The evidence_span MUST anchor the hedge word ("probably", "often", "tends to") — NOT a judgment about confidence-appropriateness.

The 3 LOW-risk keys (`claim_specificity_high`, `quantifier_present`, `modal_language_present`) keep their upstream structural guards (already present in `familyH.ts`); the implementer mirrors the upstream `falsePositiveGuards` text into the prompt entry. The existing #51 retroactive key (`provides_temporal_constraint`) keeps its upstream guards verbatim.

A `familyHPrompt.test.ts` / `familyHKeys.test.ts` assertion confirms each verdict-adjacent key's prompt-entry `falsePositiveGuards` contains the verbatim doctrine guard.

### A.3.3 — Layer 3: `familyHBanListScan.ts` clarity-verdict token extensions (D5)

`familyHBanListScan.ts` mirrors `familyGBanListScan.ts`: it scans every `evidence_span` string + `modelInfo.serverName` + `modelInfo.classifierSetVersion`, running the shared `DOCTRINE_BAN_PATTERNS` **first**, then an H-specific `FAMILY_H_BAN_PATTERNS` extension. **H adds its OWN scan; the shared `doctrineBanList.ts` is NOT edited (byte-equal).** HALT 5 guards.

The shared `DOCTRINE_BAN_PATTERNS` already covers: `winner`, `loser`, `correct`, `incorrect`, `truth`, `untrue`, `dishonest`, `liar`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `verdict`, `bad faith`, `proof of`. So `winner`/`loser`/`correct`/`incorrect` are already caught — H adds the **clarity-quality verdict tokens NOT already covered**:

**`FAMILY_H_BAN_PATTERNS` (D5 BINDING — clarity-verdict tokens; 17 patterns total):**

**Single-word tokens (9):**

| Pattern | Boundary form | Why H-scoped (not shared) |
| --- | --- | --- |
| `weak` | `(?:^|[^a-z0-9])weak(?:[^a-z0-9]|$)` | "claim is weak" / "weak argument" is the canonical H verdict; not in shared |
| `sloppy` | single token | "sloppy reasoning" / "sloppy writing" — clarity verdict; not in shared |
| `lazy` | single token | "lazy argument" / "lazy claim" — speaker label disguised as text label |
| `careless` | single token | "careless writing" — speaker label |
| `confused` | single token | "confused argument" / "confused speaker" — speaker-mental-state label |
| `unsound` | single token | "unsound argument" — argument-quality verdict |
| `unsupported` | single token | "unsupported claim" — the `reason_missing` verdict drift; canonical |
| `incoherent` | single token | "incoherent argument" — argument-quality verdict |
| `illogical` | single token | "illogical argument" — argument-quality verdict |

**Compound phrases (8):**

| Pattern | Form | Why H-scoped |
| --- | --- | --- |
| `bad reasoning` | `(?:^|[^a-z0-9])bad[\s_-]+reasoning(?:[^a-z0-9]|$)` | quality verdict on reasoning |
| `bad argument` | phrase | the canonical clarity verdict compound |
| `bad writing` | phrase | speaker-skill verdict |
| `argument is incomplete` | phrase | the `conclusion_missing` verdict drift; canonical |
| `argument is unsupported` | phrase | the `reason_missing` verdict drift; canonical |
| `argument is weak` | phrase | quality verdict; canonical |
| `claim fails` | phrase | claim-as-failed verdict |
| `claim is wrong` | phrase | truth-verdict compound (`wrong` is the load-bearing token; shared catches `incorrect` not `wrong`) |

**Token-scoping rationale (mirrors the F + G file reasoning):**

- `weak` / `sloppy` / `lazy` / `unsupported` / `unsound` are NOT promoted to the shared `DOCTRINE_BAN_PATTERNS` because they can legitimately appear in OTHER families' descriptive evidence_spans (e.g., a Family D evidence_span quoting a source like "the bridge had a weak foundation" is descriptive history, not a debate verdict; a Family B `weak` could quote a stance label). Scoping them to Family H's scan keeps A–G outputs working while existentially blocking the H failure mode. This is the exact precedent set by F scoping `invalidates`/`refutes`/`wrong` to its own scan, and G scoping `won`/`lost`/`ahead`/`behind` to its own scan, rather than the shared list.
- `wrong` is added to H's scan (matching G's operator extension) — operator binding records that bare `wrong` is the canonical clarity-truth verdict and H needs it explicitly. Note F also has its own `wrong` scan; H adds it again because H's scan is independent of F's.
- `winner`/`loser`/`correct`/`incorrect`/`truth` are already shared, so H does NOT re-add them (they would double-match harmlessly, but the F/G precedent keeps the H list to the NOT-already-covered tokens).
- Boundary strategy is byte-identical to `FAMILY_F_BAN_PATTERNS` and `FAMILY_G_BAN_PATTERNS`: `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens (recognises word AND snake_case breaks), `[\s_-]+` for phrase separators. This ensures `weakness` does NOT match `weak` (NOT TRUE — `weakness` would match because `n` is alpha; but the doctrine binding here is that "weakness" in evidence_span is itself a doctrine-violating word, so the match is doctrine-positive), `unsupportedly` and `unsupportedness` would match (both are doctrine-positive verdict drifts), `careless` would not match `carelessly` if the boundary ends at the `s` — wait: `carelessly` has `careless` + `ly`; `l` is alpha → no boundary break, so `careless` pattern would NOT fire on `carelessly`. The implementer MUST add explicit assertions for near-miss words and (where the doctrine binding requires it) ensure the boundary form is correct. Specifically:
  - `careless` matches "careless" but NOT "carelessly" (suffix continues into alpha) — this is doctrine-positive because "carelessly" is itself a verdict (the test fixture asserts BOTH are detected via the `careless` substring being verdict-loaded; alternatively, the implementer may make the pattern catch `careless\w*`).
  - `weak` matches "weak" but NOT "weakly" / "weakened" (suffix continues into alpha). The implementer's choice: keep the strict boundary (matches doctrine binding precisely) OR widen to a `weak\w*` form. The BINDING choice for this card is the strict boundary (matches G's strict boundary precedent); if a future smoke audit surfaces a "weakly"-shaped doctrine leak, the operator can amend.
  - `bad argument` / `bad reasoning` / `bad writing` use phrase form with `[\s_-]+` separator (matches across `_`/`-`/space; same as G's `won the argument` / `lost the point`).

A `familyHBanListScan.test.ts` asserts the scan rejects every shared banned token AND every H-specific token in evidence_spans / serverName / classifierSetVersion, AND that the explicit near-miss words (`weakness` matches the `weak` substring — doctrine-positive per the analysis above; `wonderful` does NOT match any H token; `lazyness` is doctrine-positive via `lazy`) are correctly classified, AND that null evidence_span values are skipped.

---

## A.4 — Adversarial fixture design (D4)

Eleven fixtures (3 mandatory baseline + 4 HIGHEST-risk per-key adversarial + 4 supplementary) targeting the clarity↔verdict boundary. Each ships as a request fixture (input) + a canonical-response fixture (the doctrine-clean expected output). The local Deno test layer (`familyHAdversarialDoctrine.test.ts`) verifies the response fixtures pass the validator + the H ban-list scan; the **live** persisted-row verification is the Phase 4b smoke obligation (BINDING).

| Fixture | Input (move text) | Expected H positives | Doctrine-clean `evidence_span` assertion |
| --- | --- | --- | --- |
| **A — canonical met (MANDATORY)** | A well-formulated claim with reason + specific scope: *"Carbon taxes reduce emissions in BC and Sweden because the 2015-2020 data show a 12% sustained delta in jurisdictions with stable enforcement."* | `claim_present`, `reason_present`, `claim_specificity_high`, `quantifier_present`, `provides_temporal_constraint` | evidence_span anchors the explicit claim + reason + scoping. NO verdict framing. Doctrine-clean baseline for the all-good case. |
| **B — canonical unmet / broad (MANDATORY)** | A broad claim with no reason: *"Carbon taxes work."* | `claim_present`, `claim_specificity_low`, `reason_missing` | evidence_span anchors the bare claim ("Carbon taxes work"). NO "weak"/"unsupported"/"lazy" framing. The two HIGHEST-risk keys (`claim_specificity_low`, `reason_missing`) are positive — this fixture is the existential verdict-leak test. |
| **C — conclusion-missing adversarial (MANDATORY; EXISTENTIAL for `conclusion_missing`)** | Input contains verdict framing: *"Library funding has dropped 20% since 2019. Literacy rates have fallen. New library branches keep closing. I wrote a weak argument with no clear point — call me sloppy."* | `conclusion_missing` (+ possibly `claim_specificity_high`, `provides_temporal_constraint`, `quantifier_present`) | The move's text contains "weak"/"sloppy"/"no clear point". The model MAY detect `conclusion_missing` but its output evidence_span MUST anchor the **reasoning chain** ("Library funding has dropped 20% … new library branches keep closing") — it MUST NOT echo "weak"/"sloppy"/"no clear point"/"argument is incomplete". **A FAIL here is HALT + revert.** |
| **D — reason-missing adversarial (MANDATORY; EXISTENTIAL for `reason_missing`)** | Input contains verdict framing: *"This policy will work. I haven't supported the claim at all — call my argument unsupported."* | `claim_present`, `reason_missing` | The move's text contains "unsupported". The model MAY detect `reason_missing` but its output evidence_span MUST anchor the **bare claim** ("This policy will work") — it MUST NOT echo "unsupported"/"argument is unsupported"/"unjustified". |
| **E — broad-claim adversarial (MANDATORY; EXISTENTIAL for `claim_specificity_low` — the axis-partner)** | Input contains verdict framing: *"Carbon taxes work. My claim is broad and weak and probably lazy."* | `claim_present`, `claim_specificity_low`, `reason_missing` | The move's text contains "weak"/"lazy". The model MAY detect `claim_specificity_low` but its output evidence_span MUST anchor the **broad-scoped wording** ("Carbon taxes work") — it MUST NOT echo "weak"/"lazy"/"broad and weak". **THIS IS THE H-EQUIVALENT OF F's Fixture C ("fallacy" twice) AND G's Fixture C ("won"/"lost" twice). A FAIL here is HALT + revert.** |
| **F — unclear-reference adversarial (MANDATORY; EXISTENTIAL for `unclear_reference_present`)** | Input contains verdict framing about the speaker: *"This is the wrong approach. They will fix it. I know I was unclear and sloppy."* (Parent text: a moves that mentions both "library funding" and "museum funding".) | `unclear_reference_present` (referent of "this"/"they"/"it" ambiguous between library and museum funding) | The move's text contains "unclear"/"sloppy" applied to the speaker. The model MAY detect `unclear_reference_present` but its output evidence_span MUST anchor the **ambiguous pronoun** ("this", "they", "it") — it MUST NOT echo "unclear writing"/"sloppy"/"the speaker was unclear". |
| **G — multi-claim canonical (SUPPLEMENTARY)** | *"EVs reduce pollution AND lower fuel costs."* | `multiple_claims_present`, `claim_present`, `reason_missing` | evidence_span anchors the AND-conjoined claims. Tests `multiple_claims_present` discrimination from "claim + restatement" / "claim + examples". |
| **H — hedging canonical (SUPPLEMENTARY)** | *"Increasing library budgets probably correlates with literacy gains in mid-size cities."* | `claim_present`, `hedging_present`, `quantifier_present` (implicit "mid-size"), `claim_specificity_high` | evidence_span anchors the hedge "probably" + specific scope. Tests `hedging_present` doctrine-clean (no "uncertain"/"wishy-washy" framing). |
| **I — modal canonical (SUPPLEMENTARY)** | *"Cities should expand bike infrastructure."* | `claim_present`, `modal_language_present`, `claim_specificity_low` | evidence_span anchors the modal "should" + the broad scope. Tests `modal_language_present` doctrine-clean. |
| **J — temporal canonical (SUPPLEMENTARY for existing #51)** | *"Since 2015, urban EV adoption grew faster than projections."* | `claim_present`, `provides_temporal_constraint`, `quantifier_present` (implicit no — adjust if needed) | evidence_span anchors "Since 2015". Tests the existing `provides_temporal_constraint` key still works post-H-ship. |
| **K — ban-list intentional violation (MANDATORY; the runtime-scanner stress test)** | A canonical response with an intentionally banned token in evidence_span: `"evidenceSpan": { "claim_specificity_low": "the claim is weak" }` | (response fixture, not request) — `claim_specificity_low: true` | This fixture is a **response fixture** that intentionally violates the ban-list. The `familyHBanListScan.test.ts` MUST detect the ban and emit `{ok: false, path: 'evidenceSpan.claim_specificity_low'}`. Stress-tests the runtime scanner; matches G's `ban-list-response.json` precedent. |
| **L — canonical-response (MANDATORY for fixture provider)** | (response fixture) | `claim_present: true, reason_present: true, claim_specificity_high: true, provides_temporal_constraint: true, quantifier_present: true` (all 12 keys with consistent observations + null evidence_span for the unmet keys) | The fixture provider loads this for smoke Checks 22+23. Positive-sparse, doctrine-clean, 12-key-shaped. |
| **M — malformed-response (MANDATORY; rejection path)** | (response fixture with a schema violation: missing `confidence` field) | (n/a; expected to fail validation) | `validateMcpBooleanObservationResponse` must reject; test asserts the rejection path. Mirrors G's malformed-response fixture pattern. |

Fixtures C + D + E + F carry the **adversarial input** (verdict words in the move text); the binding proof is that the OUTPUT stays clean regardless of input. This mirrors F's Fixture C ("fallacy" twice) and G's Fixtures C + E ("won"/"lost"/"settled in favor") — the founding adversarial pattern against the MCP-020 failure mode. The 4 HIGHEST-risk H keys each get their own dedicated adversarial fixture so the per-key existential is testable.

A canonical-response fixture (`fixtures/classify-argument-boolean-observations.family-h-canonical-response.json`) is the one the fixture provider loads for smoke Checks 22+23 (positive-sparse, doctrine-clean, 12-key-shaped). Per-scenario request fixtures (A–J) are validated by `validateFamilyBooleanRequest`.

**Fixture count: ~11 distinct JSON files** (4 request fixtures for HIGHEST-risk + 4 supplementary canonical request fixtures + 1 canonical-response for fixture provider + 1 ban-list-violation response + 1 malformed response = 11). The intent §6 forecast band of "~11 expected" is honored.

---

## Data model

**No new data model.** No SQL schema, no migration, no new table.

- The server-side `FAMILY_H_RAW_KEYS` + `FAMILY_H_PROMPT_ENTRIES` + `FAMILY_H_CLASSIFIER_SET_VERSION` are TypeScript constants mirroring the upstream taxonomy slice (rawKey + prompt-entry fields only; `confidenceEligibility` lives upstream and is applied by the Edge sanitizer — same as A–G).
- The wire shape is the existing `mcp-021.machine-observations.boolean.v1` schema (unchanged). H reuses it.
- The persisted output (`argument_machine_observation_results.evidence_span`) is the EXISTING column the Edge Function writes for admin_validation runs — no schema change.
- `ValidatedFamilyHRequest` is a TS interface in `familyHPrompt.ts`, structurally identical to `ValidatedFamilyGRequest` (kept distinct so future H-specific fields don't cross-pollinate) — same precedent as G.
- **No `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant** (no exclusions; uniform `ai_classifier`).
- **No `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `claim_clarity` in the Edge `booleanObservationRequestBuilder.ts`** (uniform source; HALT 12 inapplicable; the existing D + G entries remain byte-equal).

---

## File changes

### New files (mcp-server, all Deno/TS)

- `mcp-server/lib/familyHKeys.ts` — ~290–330 lines. `FAMILY_H_RAW_KEYS` (12 ai_classifier rawKeys, frozen, declaration order matching upstream), `FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1'`, `FamilyHPromptEntry` interface, `FAMILY_H_PROMPT_ENTRIES` (12 verbose entries with per-key falsePositiveGuards incl. the 4 HIGHEST-risk guards from §A.3.2). Mirrors `familyFKeys.ts` (339 lines for 14 keys → scale down ~80 lines for 12 keys). Header documents the **uniform `ai_classifier`** rationale (contrast with D + G mixed-source headers) + no exclusion list.
- `mcp-server/lib/familyHPrompt.ts` — ~280–310 lines. `FAMILY_H_SYSTEM_PROMPT` (7 absolute rules byte-equal + the clarity↔verdict CRITICAL-DOCTRINE block from §A.3.1), `FAMILY_H_MAX_TOKENS = 1500`, `FAMILY_H_TEMPERATURE = 0`, `FAMILY_H_MAX_BODY_FIELD_LEN = 8000`, `ValidatedFamilyHRequest` interface, `buildFamilyHUserPrompt(request)`. Mirrors `familyGPrompt.ts` (270 lines).
- `mcp-server/lib/familyHAnthropic.ts` — ~52 lines. `runAnthropicFamilyHClassifier(request, requestId, fetchImpl?)`. Byte-for-byte structural mirror of `familyGAnthropic.ts` (53 lines).
- `mcp-server/lib/familyHBanListScan.ts` — ~165 lines. `FAMILY_H_BAN_PATTERNS` (the 17 D5 clarity-verdict patterns from §A.3.3) + `scanFamilyHBooleanResponseForBanList(response)`. Mirrors `familyGBanListScan.ts` (176 lines).
- `mcp-server/lib/familyHFixtureProvider.ts` — ~53 lines. `loadFixtureFamilyHPacket()`. Mirrors `familyGFixtureProvider.ts` (54 lines).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-canonical-response.json` — canonical 12-key doctrine-clean response for smoke Checks 22+23.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-canonical-met-request.json` — Fixture A.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-canonical-unmet-request.json` — Fixture B.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-conclusion-missing-adversarial-request.json` — Fixture C.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-reason-missing-adversarial-request.json` — Fixture D.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-broad-claim-adversarial-request.json` — Fixture E (the existential).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-unclear-reference-adversarial-request.json` — Fixture F.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-multi-claim-request.json` — Fixture G.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-hedging-request.json` — Fixture H.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-ban-list-response.json` — Fixture K (intentional ban-list violation).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-h-malformed-response.json` — Fixture M.

### New test files (mcp-server/tests, Deno)

The implementer creates 6 dedicated Deno test files mirroring G's pattern (G has exactly 6: keys, keys-parity, prompt, ban-list, anthropic, adversarial-doctrine):

- `mcp-server/tests/familyHKeys.test.ts` — **~18 tests.** `FAMILY_H_RAW_KEYS` has exactly 12 entries; all 12 are present verbatim in upstream `familyH.ts` as `source: 'ai_classifier'` literals; no extras; no dupes; cross-family A∩H / B∩H / C∩H / D∩H / E∩H / F∩H / G∩H all empty; declaration order matches upstream; `FAMILY_H_CLASSIFIER_SET_VERSION === 'family-h-v1'`; `FAMILY_H_PROMPT_ENTRIES` has 12 entries each with all required verbose fields; the 4 HIGHEST-risk keys' `falsePositiveGuards` contain the verbatim §A.3.2 guards.
- `mcp-server/tests/familyHKeysParity.test.ts` — **~12 tests.** Upstream `familyH.ts` has exactly 12 `source: 'ai_classifier'` declarations (the parity-source-of-truth); upstream has zero `source: 'auto_metadata'` and zero `source: 'lifecycle'` (proves H is uniform); the 12 rawKey literals match `FAMILY_H_RAW_KEYS` verbatim by string equality; the file header comment correctly claims "12 entries total" (no drift like G's); no `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant exists (intentional).
- `mcp-server/tests/familyHPrompt.test.ts` — **~28 tests.** 7 absolute-rules block byte-equal to A–G; clarity↔verdict CRITICAL-DOCTRINE block present verbatim; `claim_specificity_low` axis-partner doctrine binding verbatim; `conclusion_missing` / `reason_missing` / `unclear_reference_present` per-key guards verbatim; user-prompt happy path; subset-of-keys path; empty-requestedRawKeys → all 12; rawKeys filter rejects non-H keys; banned-token negation check (no bare banned token outside doctrine-positive negations); `FAMILY_H_MAX_TOKENS === 1500`; `FAMILY_H_TEMPERATURE === 0`; `FAMILY_H_MAX_BODY_FIELD_LEN === 8000`; questions block includes all 12 rawKeys; per-key verdict guards verbatim for the 4 HIGHEST-risk keys.
- `mcp-server/tests/familyHBanListScan.test.ts` — **~30 tests.** Each of the 9 single-word patterns is detected in an evidence_span; each of the 8 phrase patterns is detected; each of the shared `DOCTRINE_BAN_PATTERNS` is detected; near-miss words assertions (`wonderful` does NOT match any H token; `weakly` / `weakened` behavior recorded); null evidence_span values are skipped; `modelInfo.serverName` is scanned; `modelInfo.classifierSetVersion` is scanned; `checkedRawKeys` entries are NOT scanned (per the comment in G's file); banned token in `serverName` is detected; clean response passes; the intentional-violation Fixture K is detected with the correct path; `FAMILY_H_BAN_PATTERNS` exports as `readonly RegExp[]` and is frozen.
- `mcp-server/tests/familyHAnthropic.test.ts` — **~11 tests.** Happy path; key_missing; HTTP 429; HTTP 500; TimeoutError; non-JSON; plain prose; API key never in success log; API key never in failure log; logs tagged `classify_argument_boolean_observations`; MAX_TOKENS=1500 confirmed in `callAnthropic` args.
- `mcp-server/tests/familyHAdversarialDoctrine.test.ts` — **~36 tests** (the D4 BINDING file; largest, because 12 keys + 11 fixtures + 17 H ban-list tokens + 4 HIGHEST-risk per-key existentials). Each fixture A–J is parseable; each request fixture passes `validateFamilyBooleanRequest`; Fixture B's expected positives (`claim_specificity_low`, `reason_missing`) produce a doctrine-clean evidence_span; **Fixture C input contains "weak"/"sloppy"/"no clear point" but expected response evidence_span does NOT** (existential for `conclusion_missing`); **Fixture D input contains "unsupported" but output does NOT** (existential for `reason_missing`); **Fixture E input contains "weak"/"lazy"/"broad and weak" but output does NOT** (THE AXIS-PARTNER EXISTENTIAL for `claim_specificity_low`); **Fixture F input contains "unclear"/"sloppy" applied to the speaker but output does NOT** (existential for `unclear_reference_present`); H ban-list scan rejects each of the 17 D5 clarity-verdict patterns; H ban-list scan rejects each shared banned token; clean claim-clarity evidence_span (anchoring the bare claim / broad scope / ambiguous pronoun / reasoning chain without verdict framing) passes; `FAMILY_H_BAN_PATTERNS` contains all 17 D5 patterns; near-miss words (`wonderful`) are NOT flagged; the 4 HIGHEST-risk per-key prompt-entry guards surface verbatim mention of all forbidden clarity-verdict words; the canonical-met Fixture A produces NO verdict framing.

### New Edge Jest test file

- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` — **~8 tests.** Mirrors `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts` structurally with `FH-1` through `FH-8`:
  - FH-1: Family H entry exists in `EDGE_FAMILY_REGISTRY` (looks up by `'claim_clarity'`).
  - FH-2: Family H entry has `productionEnabled: false` (admin_validation-only ship).
  - FH-3: Family H entry has `adminValidationEnabled: true`.
  - FH-4: `edgeProductionEnabledFamilies()` does NOT include `'claim_clarity'` (production excluded).
  - FH-5: `edgeAdminValidationEnabledFamilies()` includes `'claim_clarity'`.
  - FH-6: `edgeFilterFamiliesForMode(['claim_clarity'], 'production')` returns `[]` (filtered out of production).
  - FH-7: `edgeFilterFamiliesForMode(['claim_clarity'], 'admin_validation')` returns `['claim_clarity']`.
  - FH-8: Family H is the 8th entry in `EDGE_FAMILY_REGISTRY` (A→J order preserved; index 7).

  **Rationale for adding this file** (vs G which did NOT add a parallel file): the existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` (FR-1 through FR-32) already covers H's posture indirectly (FR-7 every H–J `productionEnabled: false`; FR-8 all 10 admin-enabled; FR-28 every H–J absent from production list). But the explicit `…FamilyH.test.ts` is required because Card 3 (production-enable) will FLIP H's `productionEnabled` to `true` AND a parallel test file documents the per-family ENTRY-EXISTS, ENTRY-INDEX, ENTRY-SHAPE invariants that gate the flip safely. The implementer creates this file as the "post Card 1 ship + pre Card 3 flip" baseline; Card 3 will mutate the assertions exactly as E + G did (`FE-2: productionEnabled: true (post Card 2 flip)` analog).

  > Operator note: this file is a **new requirement vs G**. G did NOT add a parallel file because G's coverage was assumed sufficient via the shared registry file. The intent brief §6 forecasts ~+6–10 Jest tests, implying the parallel file IS expected for H. I have included it. If the operator prefers the G precedent (no parallel file, rely on shared `mcpOneTwoOneCEdgeFamilyRegistry.test.ts`), strike this file from the design and reduce the Jest test forecast accordingly. Recommended posture: **add the parallel file** for symmetry with E's already-present `…FamilyE.test.ts` and to provide the Card-3-flip baseline.

### Modified files (mcp-server)

- `mcp-server/lib/familyRegistryInit.ts` — **+~6 lines net.** Add the import block (`FAMILY_H_RAW_KEYS`, `FAMILY_H_CLASSIFIER_SET_VERSION` from `./familyHKeys.ts`) + one `register('claim_clarity', { rawKeys: new Set(FAMILY_H_RAW_KEYS), classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION })` call AFTER the G `register('resolution_progress', …)` block, with a comment documenting the uniform `ai_classifier` posture + the 4 HIGHEST-risk keys (mirror the G comment block at lines 125–137). Exact insertion site: immediately after line 141 (closing `});` of the G register block), before line 142 (closing `}` of `initializeFamilyRegistry`).
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — **+~14 lines net.** Add 3 imports (`runAnthropicFamilyHClassifier`, `loadFixtureFamilyHPacket`, `scanFamilyHBooleanResponseForBanList`) + `ValidatedFamilyHRequest` to the `FamilyProviders.anthropic` union type + one `if (family === 'claim_clarity') { return { anthropic: …, fixture: …, banListScan: … }; }` block in `pickFamilyProviders` (after the `resolution_progress` block at line 334). Also update the tool `description` string (current line 148) to include H's coverage (the H family description is "Family H ships with the 12-key ai_classifier set covering claim-clarity formulation states (claim present, reason present, conclusion missing, reason missing, multiple claims, claim specificity high/low, quantifier present, modal language present, hedging present, unclear reference, temporal constraint) — these are DESCRIPTIVE FORMULATION-STATE, never quality verdicts on the move or speaker.") and update the unsupported note to "Family I through J return an unsupported_family error envelope in this server build" (drop H from the unsupported set).
- `mcp-server/tests/familyRegistryInit.test.ts` — **+~3 tests.** `isFamilySupported('claim_clarity')` true; `getSupportedFamilies()` returns the 8-family list in order; `claim_clarity` has 12 rawKeys.
- `mcp-server/tests/familyRegistry.test.ts` — **+~3 tests.** 8-family order preserved; 8-way cross-family rejection; `getRawKeysForFamily('claim_clarity')` = 12 keys.
- `mcp-server/tests/familyBooleanRequestSchema.test.ts` — **+~6 tests.** Valid H request passes; H subset request passes; H empty-requestedRawKeys passes (all 12); cross-family rejection (A–G rawKey under claim_clarity → unsupported_rawKey); cross-family rejection (an H rawKey under any A–G family → unsupported_rawKey); regression: A–G still pass.
- Cross-family dispatch tests (`familyBDispatch.test.ts` … `familyGDispatch.test.ts` if any, `classifyArgumentBooleanObservations.test.ts`) — **retargeted** so the unsupported-family set goes from `{H, I, J}` → `{I, J}` (H removed; envelope shape + cross-family-leak prevention preserved). This mirrors the G card's Phase-5 dispatch-layer retarget. **CAUTION**: the implementer MUST grep for the exact string set `'claim_clarity', 'thread_topology', 'sensitive_composer'` and `['claim_clarity', 'thread_topology', 'sensitive_composer']` (and their JS object analogs) to find ALL retarget sites. A careless retarget that drops a leak-prevention assertion is a HALT #4 violation.

### Modified files (smoke)

- `scripts/mcp-server-001-smoke.sh` — **+~36 lines (2 checks).** Add `[22-compat-boolean-family-h]` (`/mcp/adapter-compat`, `requestedFamilies=['claim_clarity']`, assert `family-h-v1` in response) + `[23-mcp-tools-call-boolean-family-h]` (`/mcp` tools/call, assert `family-h-v1` + `isError:false`). Update the header tally comments (21 → 23) and the final "N PASSES" expectation. Mirror Checks 20+21 exactly, swapping the request body to a benign claim-clarity move (e.g., a `claim_present` + `reason_present` + `claim_specificity_high` fixture move — the Fixture A canonical-met body, or a custom benign body asserting common-ground formulation). The H check's `requestedRawKeys` should explicitly include the axis-partner `claim_specificity_low` + the 4 HIGHEST-risk keys so the smoke exercises the doctrine-risky path. Exact final-line update: `"MCP-SERVER-001 smoke: $PASSES PASSES, $FAILS FAILS"` stays; the bound at the top of the script (if any) increments 21 → 23.

### NOT modified (verify byte-equal — HALT 4 + HALT 5)

- `mcp-server/lib/family{A,B,C,D,E,F,G}*.ts` — **byte-equal** (HALT 4). Every single A–G family file (keys, prompt, anthropic, banListScan, fixtureProvider) MUST remain unchanged. The Phase 6 verification runs `git diff --stat origin/main -- mcp-server/lib/familyA*.ts mcp-server/lib/familyB*.ts … mcp-server/lib/familyG*.ts` and expects 0 changes.
- `mcp-server/lib/doctrineBanList.ts` — **byte-equal** (HALT 5). H adds its own scan; the shared list does NOT receive `weak`/`sloppy`/`lazy`/etc. (H-LOCAL).
- `mcp-server/lib/seedPrompt.ts` — **byte-equal** (HALT 5).
- `mcp-server/lib/anthropicCall.ts` — **byte-equal** (HALT 5).
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — **byte-equal** (HALT 5; H reuses the existing wire shape).
- `mcp-server/lib/providerConcurrency.ts` — **byte-equal** (HALT 5; MCP cap=5 semaphore invariant preserved).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — **byte-equal** (H entry already `{productionEnabled:false, adminValidationEnabled:true}` at lines 104–108; D6 pre-satisfied; Card 3 flips it). HALT 13.
- `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` — **byte-equal**. **No `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `claim_clarity`** (HALT 12 inapplicable; H is uniform `ai_classifier`).
- `src/**` — **byte-equal** (taxonomy `familyH.ts` is the source-of-truth READ, not written; the upstream header is already correct so no surfacing to the operator is needed).
- `scripts/ops/audit-lint-rules.cjs` — **byte-equal** (adding `family_h` to `DOCTRINE_RISK_FAMILIES` is **Card 2**, not this card; intent D10 + D13).
- `package.json` / `package-lock.json` — **byte-equal** (no new deps; Deno imports via URL). HALT 5.
- `supabase/migrations/**` — **byte-equal** (no migration). HALT 4.
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — **byte-equal**. Already asserts H is `productionEnabled:false`, `adminValidationEnabled:true` (FR-7 covers; FR-28 explicitly excludes H/I/J). Do NOT modify; the new `…FamilyH.test.ts` is the additive parallel file. HALT 5 (existing test stay green unchanged).

---

## API / interface contracts

```ts
// familyHKeys.ts
export const FAMILY_H_RAW_KEYS: readonly string[];               // 12 ai_classifier rawKeys, frozen, declaration order
export const FAMILY_H_CLASSIFIER_SET_VERSION = 'family-h-v1';
// NO FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS (uniform source — see §A.1.1)
export interface FamilyHPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;     // 4 HIGHEST-risk keys carry the §A.3.2 verbatim guards
}
export const FAMILY_H_PROMPT_ENTRIES: readonly FamilyHPromptEntry[]; // 12 entries

// familyHPrompt.ts
export const FAMILY_H_SYSTEM_PROMPT: string;     // 7 absolute rules byte-equal + clarity↔verdict block
export const FAMILY_H_MAX_TOKENS = 1500;
export const FAMILY_H_TEMPERATURE = 0;
export const FAMILY_H_MAX_BODY_FIELD_LEN = 8000;
export interface ValidatedFamilyHRequest {       // structural mirror of ValidatedFamilyGRequest
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
export function buildFamilyHUserPrompt(request: ValidatedFamilyHRequest): string;

// familyHAnthropic.ts
export function runAnthropicFamilyHClassifier(
  request: ValidatedFamilyHRequest,
  requestId: string,
  fetchImpl?: typeof fetch,
): Promise<AnthropicCallResult>;

// familyHBanListScan.ts
export const FAMILY_H_BAN_PATTERNS: readonly RegExp[];   // 17 D5 clarity-verdict patterns (9 single + 8 phrase)
export type FamilyHBanListScanResult = { ok: true } | { ok: false; path: string };
export function scanFamilyHBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyHBanListScanResult;

// familyHFixtureProvider.ts
export type FamilyHFixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };
export function loadFixtureFamilyHPacket(): Promise<FamilyHFixtureResult>;

// familyRegistryInit.ts — added inside initializeFamilyRegistry() AFTER the G register block
register('claim_clarity', {
  rawKeys: new Set(FAMILY_H_RAW_KEYS),
  classifierSetVersion: FAMILY_H_CLASSIFIER_SET_VERSION,
});
```

`pickFamilyProviders` addition (in `classifyArgumentBooleanObservations.ts`, after the `'resolution_progress'` block at line 327–334):

```ts
if (family === 'claim_clarity') {
  return {
    anthropic: (req, requestId) =>
      runAnthropicFamilyHClassifier(req as ValidatedFamilyHRequest, requestId),
    fixture: loadFixtureFamilyHPacket,
    banListScan: scanFamilyHBooleanResponseForBanList,
  };
}
```

`FamilyProviders.anthropic` union extension (line 257–268):

```ts
interface FamilyProviders {
  anthropic: (
    req:
      | ValidatedFamilyARequest
      | ValidatedFamilyBRequest
      | ValidatedFamilyCRequest
      | ValidatedFamilyDRequest
      | ValidatedFamilyERequest
      | ValidatedFamilyFRequest
      | ValidatedFamilyGRequest
      | ValidatedFamilyHRequest,  // ← new
    requestId: string,
  ) => Promise<AnthropicCallResult>;
  // … rest unchanged
}
```

---

## Edge cases

- **Empty `requestedRawKeys`** → `buildFamilyHUserPrompt` includes all 12 H keys (mirror G's empty-array → all-18 behavior).
- **Requested rawKey not in the 12-key set (a cross-family A–G key)** → `validateFamilyBooleanRequest` rejects with `unsupported_rawKey` at the registry boundary. Test asserts this for representative A–G keys.
- **Requested rawKey not in any registered family** → `unsupported_rawKey` (existing behavior). Test asserts.
- **Move text contains verdict words ("you wrote a weak argument", "my claim was sloppy", "unsupported")** → model may detect the claim-clarity state but the OUTPUT evidence_span must NOT echo the verdict words; the H ban-list scan is the runtime backstop (rejects the packet → `validation_failed` → Edge falls back to deterministic layer). Fixtures C + D + E + F + the Phase 4b smoke verify this live.
- **Anthropic returns non-JSON / prose / HTTP 429 / 500 / TimeoutError / missing key** → `runAnthropicFamilyHClassifier` returns the typed `AnthropicCallResult` error envelope; the tool handler returns an `isError` envelope (never a partial/fake packet); the Edge Function falls back to the deterministic layer. Tested in `familyHAnthropic.test.ts` (mirror G's 11 cases).
- **Fixture provider load failure** (`MCP_SERVER_USE_FIXTURE_PROVIDER=true` but file missing/malformed) → `{ ok: false, reason: 'fixture_load_failed' }`; treated as key-missing-style fallback. Tested.
- **Concurrent edits / offline / network failure** — N/A at this layer (the MCP server is a stateless classifier; admin_validation is an explicit operator-triggered POST; no client write path). The Edge Function's existing retry/fallback handles transient network failure.
- **Permission-denied** — admin_validation is gated by the Edge Function's existing admin/moderator JWT check; H inherits it (no change). Production path is not enabled for H (Card 3), so no production permission surface exists yet.
- **Doctrine-constraint edge: does heat / popularity influence H?** — No. H is a structural-formulation classifier on the move text + parent context; it has no access to engagement metrics, view counts, or heat. The anti-amplification boundary (`cdiscourse-doctrine §3`) is untouched.
- **Doctrine-constraint edge: does a `claim_specificity_low` or `reason_missing` positive lower the move author's standing?** — No. H is descriptive (advisory metadata). Per `point-standing-economy`, broad scope and reason absence are SHAPES, not standing penalties. H emits no standing delta — it records the structural state only. The scoring economy lives elsewhere and is not wired to H in this card.
- **Doctrine-constraint edge: what if the input move actively asks for clarity feedback ("am I being clear?")?** — H still classifies structural formulation-state on the visible text; the user's request for feedback does NOT change the H classification axis. The output is the same descriptive observation; how the UI surfaces it (e.g., as a hint vs as a metadata badge) is a separate UI concern, NOT in scope for this card.
- **Doctrine-constraint edge: what if multiple HIGHEST-risk keys fire at once (broad claim with no reason and missing conclusion and unclear pronoun)?** — All four positives can coexist (Fixture B + C + D + E + F all cumulatively share this — though no single fixture tests all four simultaneously by design; the realistic case is rare). The ban-list scan inspects every evidence_span independently; the model's conservative-positives bias makes 4+ HIGHEST-risk positives unlikely. The Phase 4b smoke explicitly probes this multi-positive case.

---

## Test plan

Per `test-discipline`: tests are part of "done"; the count goes UP; no `.skip`/`.only`; the count cited at completion must come from a captured `Tests: Y passed` line with the explicit exit code.

**Deno test files (mcp-server):**

The 6 test files above (`familyHKeys.test.ts`, `familyHKeysParity.test.ts`, `familyHPrompt.test.ts`, `familyHBanListScan.test.ts`, `familyHAnthropic.test.ts`, `familyHAdversarialDoctrine.test.ts`) carry ~135 new Deno tests total (binding number; see §Test forecast below).

**Updated Deno test files:**

- `familyRegistryInit.test.ts` (+3 tests), `familyRegistry.test.ts` (+3 tests), `familyBooleanRequestSchema.test.ts` (+6 tests), cross-family dispatch tests retargeted ({H,I,J} → {I,J}). **No new tests added by retargets** (assertion count stays equal; only the unsupported set string changes).

**New Edge Jest test file:**

- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` — **+8 Jest tests** (FH-1 through FH-8 per §File changes).

**Doctrine ban-list assertions (the card touches verdict-adjacent strings — mandatory):**

- `familyHPrompt.test.ts` scans the system prompt for bare banned tokens (must be absent outside doctrine-positive negations).
- `familyHBanListScan.test.ts` asserts every shared + every H-specific clarity-verdict token is rejected in evidence_span / serverName / classifierSetVersion, and near-miss words behavior is recorded.
- `familyHAdversarialDoctrine.test.ts` is the binding-fixture verifier (Fixtures C/D/E/F existential assertions).

**Existing tests that MUST stay green (no change to them):**

- `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — already asserts H is `productionEnabled:false`, `adminValidationEnabled:true` (FR-7 + FR-28). The new `…FamilyH.test.ts` is additive, NOT a replacement. HALT 5 (file byte-equal).
- All A–G family tests must stay green. The cross-family retarget tests `({H,I,J} → {I,J})` change the unsupported-set string but the assertion count and shape stay identical.

**Test forecast: +135 Deno + +8 Jest = +143 net (binding).**

Grounding: Family G shipped ~134 Deno declarations across 6 test files (verified by `grep -c "^Deno.test" mcp-server/tests/familyG*.test.ts`: 20 + 13 + 21 + 36 + 11 + 33 = 134). H has 12 ai_classifier keys vs G's 18 (~67% the per-key surface) but adds:

- The 4 HIGHEST-risk per-key adversarial fixtures (vs G's 1 axis-partner) → larger adversarial-doctrine file (~36 tests; G was 33).
- The new Edge Jest registry file (+8 Jest) — net new vs G which did not add one.
- The parity file is lighter than G's (no exclusion list to assert).

Net Deno breakdown:
- familyHKeys.test.ts: ~18 (G: 20; lighter — no exclusion list)
- familyHKeysParity.test.ts: ~12 (G: 13; lighter)
- familyHPrompt.test.ts: ~28 (G: 21; heavier — 4 HIGHEST-risk per-key prompt assertions vs G's 1 axis-partner)
- familyHBanListScan.test.ts: ~30 (G: 36; lighter — 17 H patterns vs G's 11 + similar coverage)
- familyHAnthropic.test.ts: ~11 (G: 11; same)
- familyHAdversarialDoctrine.test.ts: ~36 (G: 33; heavier — 4 per-key existential fixtures vs G's 1)

**Deno total: ~135.** Within the intent §6 band of **+110 to +160 Deno**, well below the **+250 HALT 8 ceiling**.

Jest total: +8 (the new `…FamilyH.test.ts`; +6 to +10 per intent §6).

**Total: ~135 Deno + ~8 Jest = ~143 net** (binding number). The actual delta the implementer reports may drift ±5 tests on each side; the binding ceiling is HALT 8 (+250 Deno OR +12 Jest). HALT 8 NOT FIRED at this forecast.

---

## A.5 — 8-phase smoke plan + D9/D13 consistent-PARTIAL language

**Audit doc:** `docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` (`Audit-Lint: v1`; self-lints clean). Post-merge, operator-run. Mirrors the G smoke template.

1. **Phase 1 — Pre-flight.** `main` at the merge SHA; working tree clean; Edge auto-deploy confirmed; H Edge registry posture verified byte-equal (`{ family: 'claim_clarity', productionEnabled: false, adminValidationEnabled: true }` at familyRegistry.ts:104-108); NOT touched by this card.
2. **Phase 2 — Local Deno regression.** `cd mcp-server && deno test --allow-net --allow-env --allow-read` → baseline + H suite; capture the `ok | N passed | 0 failed` line + the delta vs the G baseline (expected delta: +~135 Deno tests).
3. **Phase 3 — Hosted MCP smoke (23 checks; operator token).** `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net` → expect `23 PASSES, 0 FAILS`, EXIT 0. Checks 22+23 prove the deployed build serves Family H end-to-end. **NOT-RUN caps verdict at PARTIAL (L1).**
4. **Phase 4 — Edge admin_validation (Family H; 3 seeded args).** `POST /functions/v1/classify-argument-boolean-observations` with admin JWT, `requestedFamilies:['claim_clarity']`, `mode:'admin_validation'` → HTTP 200; positives in the 12-key set; no cross-family leak. Probe specifically the 4 HIGHEST-risk keys (`conclusion_missing`, `reason_missing`, `claim_specificity_low`, `unclear_reference_present`).
5. **Phase 4b — DOCTRINE (BINDING; the L5 obligation).** Submit the adversarial fixtures (C, D, E, F; each carries verdict-baiting input) via `submit-argument` (fires the 7-family A–G production auto-trigger as a documented side effect — NOT H, since H is admin-only); POST admin_validation `requestedFamilies:['claim_clarity']` on the new argument_ids; **PRE-CHECK column names (R1)**; main query MUST return non-empty rows; **for each H positive, the persisted `evidence_span` MUST NOT contain any of the 17 D5 clarity-verdict tokens (weak/sloppy/lazy/careless/confused/unsound/unsupported/incoherent/illogical/wrong/"bad reasoning"/"bad argument"/"bad writing"/"argument is incomplete"/"argument is unsupported"/"argument is weak"/"claim fails"/"claim is wrong")**; the canonical-met Fixture A MUST produce zero verdict framing; Fixture E (the axis-partner existential) MUST NOT echo "weak"/"lazy"/"broad and weak"; Fixture C MUST NOT echo "weak"/"sloppy"/"no clear point". **Firing-count resolution (asymmetric): ≥1 firing all clean → PASS; 0 firings → PARTIAL (do NOT authorize H production); ≥1 dirty → FAIL (existential; HALT + revert).**
6. **Phase 5 — Unsupported I/J rejection regression.** Verified at the dispatch-test layer (post-card unsupported set `{I, J}` — H removed; envelope shape preserved). Live Edge POST of each I/J → HTTP 200, `failed`, `mcp_validation_failed`, zero positives — operator-deferred to the amendment (mirror G Phase 5).
7. **Phase 6 — Targeted Jest + Deno regression.** `npx jest --testPathPattern="[Ff]amily.*[Hh]|claim.clarity" --no-coverage`; full `npx jest --no-coverage`; `cd mcp-server && deno test …`; `npm run typecheck`; `npm run lint`. Cross-family byte-equal verification (`family{A-G}*.ts`, `doctrineBanList.ts`, `seedPrompt.ts`, `anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts`, `src/`, `supabase/`, `package.json`, `audit-lint-rules.cjs`, `booleanObservationRequestBuilder.ts` — all 0 diff). HALT 4 + HALT 5 guards.
8. **Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE (D12 BINDING).** The provenance subsection: CI run ID + in_scope count + linter exit for H's smoke PR. Plus the 8-family operational state table (A–G production; **H admin_validation new**; I/J unsupported). Latency: note the ≈43.4s 8-family projection but state H's per-family duration is measured in **Card 3** (H not production yet). Doctrine signal calibration deferred to amendment.
9. **Phase 8 — Verdict + authorization.** Final verdict + **Gate A** authorization (Gate A records the doctrine-risk determination = YES, which authorizes Card 2 to run for H). Pre-push: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-2026-05-31.md` exit 0 (D9 BINDING).

**Verdict rules:** PASS = Phase 3 23/23 (or NOT-RUN → PARTIAL cap) + Phase 4 valid + Phase 4b ≥1 clean firing (or 0-fire PARTIAL) + Phase 5 I/J reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0. PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR CI caught a real L1–L6 violation. FAIL = Phase 4b dirty firing, OR non-H rawKey, OR prior-family byte-equal failure, OR CI incorrectly passed a violating audit.

### D9 / D13 — CONSISTENT-PARTIAL DISCIPLINE (BINDING on this card's smoke audit)

Because doctrine-risk = YES (§A.1.2), **Card 2 will add `family_h` to `DOCTRINE_RISK_FAMILIES`** in `scripts/ops/audit-lint-rules.cjs` (following the G + F + E precedent at lines 55–79). The `detectFamily()` function emits `family_h` for a `MCP-SERVER-009-FAMILY-H-SMOKE` title (`mapFamilyLetterToName` has no H case → default branch → `family_h`), so once Card 2 lands, the verdict-blind `applyL5` will re-evaluate THIS card's already-merged smoke audit on its next CI lint. An L5 doctrine-risk audit **passes-as-PARTIAL ONLY if it mentions persisted `evidence_span` inspection** (one of the `L5_PERSISTED_INSPECTION_PATTERNS`: `\bevidence_span\b`, `SELECT … evidence_span`, `| evidence_span |`, `persisted evidence`, `direct-output inspection`).

**Therefore THIS card's smoke audit MUST name its deferred Phase 4b `evidence_span` obligation in INSPECTION-PATTERN LANGUAGE**, even if Phase 4b is NOT-RUN, exactly as the real F PARTIAL audit and the G PARTIAL audit did. The binding sentence (mirror the G PARTIAL audit's Verdict + Phase 4b sections):

> "Phase 4b (optional per audit-lint-rules.cjs `family-ship` set; BINDING per intent §9) is operator-deferred — the live adversarial claim-clarity **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for clarity-verdict tokens) is the binding existential for L5 satisfaction; per intent §9 firing-count asymmetry, NOT-RUN behaves equivalently to 0-fire for verdict-capping."

Omitting this `evidence_span` language would **retroactively fail Card 1's smoke audit** once Card 2 adds `family_h` to the doctrine-risk set. This is the exact mechanism by which the real F and G PARTIAL audits survived their data-change. The smoke audit's Verdict-upgrade-path section (deferred, per L6) must also name the Phase 4b live persisted-`evidence_span` verification as the obligation the amendment closes. HALT 11 + HALT 12 guard this.

---

## A.6 — Smoke template (the audit skeleton operator authors)

`docs/audits/MCP-SERVER-009-FAMILY-H-SMOKE-template.md` carries the `Audit-Lint: v1` marker at the top, the 8-phase skeleton (Phase 1 → Phase 8), the verdict-rules paragraph, the D9 `evidence_span` BINDING language for Phase 4b, the required-final-step instruction `Run \`node scripts/ops/audit-lint.mjs <doc>\` and assert exit 0 before publishing`. Doctrine evidence_span inspection language is MANDATORY in Phase 4b because doctrine-risk = YES; Card 2 will retroactively re-lint with L5 once `family_h` lands in `DOCTRINE_RISK_FAMILIES`. The implementer writes the template skeleton (not the live audit — that's the operator post-merge).

---

## Dependencies (cards / docs / files)

- **Assumes Families A–G are complete** because the dispatcher's `FamilyProviders.anthropic` union, the `pickFamilyProviders` chain, the smoke Checks 1–21, the cross-family byte-equal verification, and the existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` all depend on A–G being present and stable. (Verified: A–G production at `main` `7a30576`; #387 + #399 merged.)
- **Reads upstream `src/features/nodeLabels/machineObservationDefinitions/familyH.ts`** at the `FAMILY_H_DEFINITIONS` array — the 12 ai_classifier entries are the binding source for `familyHKeys.ts` (rawKeys + booleanQuestion + positive/negative definitions + examples + falsePositiveGuards + doctrineNotes).
- **Reads `mcp-server/lib/familyG*.ts`** as the structural pattern (keys/prompt/anthropic/banListScan/fixtureProvider). G is the closest precedent because G is doctrine-risk + axis-partner pattern; F is also referenced for the uniform-source case (E + F are uniform, no subset).
- **Reads `mcp-server/lib/familyRegistryInit.ts`** + `mcp-server/tools/classifyArgumentBooleanObservations.ts` as the register() + provider-wiring mechanism.
- **Reads `scripts/ops/audit-lint-rules.cjs`** to understand the D9 / D13 L5 mechanism (`DOCTRINE_RISK_FAMILIES`, `detectFamily` → `family_h`, `L5_PERSISTED_INSPECTION_PATTERNS`).
- **Reads `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyE.test.ts`** as the structural template for the new `…FamilyH.test.ts` (FH-1 through FH-8 mirror FE-1 through FE-8, swapping `argument_scheme` → `claim_clarity` and `productionEnabled: true` → `productionEnabled: false` because Card 1 is admin-only).
- **Blocks Gate A** — Gate A records the doctrine-risk determination (YES). Because YES, **Card 2 (`MCP-SERVER-009-FAMILY-H-AUDIT-LINT-L5` L5 mechanization) RUNS** and depends on this card's smoke audit carrying the D9 `evidence_span` language.
- **Blocks Card 3** (H production-enable + latency re-measure) — Card 3 flips Edge `familyRegistry.ts:106` `productionEnabled: false → true` and re-measures the 8-family latency (projected 43.4s). Card 3 depends on Card 1's admin_validation infrastructure + Phase 4b producing ≥1 clean firing (or the amendment).

---

## Risks

- **Provider-wiring vs "no dispatcher edit" nuance.** The intent §2 says "dispatcher routing (registry-derived per the post–B/C-enable pattern; no dispatcher edit)". That is true for the *validation/routing* path (`getSupportedFamilies()`-driven), but `pickFamilyProviders` in `classifyArgumentBooleanObservations.ts` DOES need a small additive `if (family === 'claim_clarity')` block + 3 imports + the union-type entry — every family A→G has one. This is **additive, in-scope wiring**, not a dispatcher rewrite, and it does NOT count as an out-of-scope edit. The implementer should not be alarmed that the dispatcher file appears in the diff; the binding constraint is that the A–G provider blocks stay byte-equal and only an H block is ADDED. The tool description string also receives a small additive H paragraph. (HALT #16 architecture core — the dispatcher must remain registry-derived for routing; provider selection is the standard per-family addition.)
- **Token headroom at 12 keys (the loosest of A–H so far).** MAX_TOKENS=1500 is the proposed budget (A.2 says no bump). 12 × 85 ≈ 1020 with ~480 token headroom — the largest absolute headroom of any family A–H. If the canonical-response fixture (all-or-most-true) demonstrably exceeds 1500 output tokens during implementation, that is a T4-fires escalation → STOP and surface a Stage 2B token-bump decision; do NOT silently bump. (D3 + HALT 10.)
- **The `claim_specificity_low` axis-partner existential.** This is the single highest-risk key. If the per-key guard or the ban-list misses a verdict-framing path, the Phase 4b live smoke (Fixture E) is the backstop — but a dirty firing there is a HALT + revert. The implementer must mirror G's `concedes_broader_point` guard rigor exactly (the strongest guard, the adversarial fixture with verdict words in the input, the dedicated adversarial-doctrine test file). The 3 other HIGHEST-risk keys (`conclusion_missing`, `reason_missing`, `unclear_reference_present`) each get their own per-key adversarial fixture (C, D, F), giving H more per-key existential coverage than G had.
- **The 4-HIGHEST-risk concentration.** H has 4 HIGHEST-risk keys (vs E's 1 `slippery_slope`, F's 1 `consequence_probability_unclear`, G's 1 `concedes_broader_point`). This is a per-family concentration spike — H is the most verdict-adjacent family the suite has shipped. The 4 per-key prompt guards + 4 per-key fixtures + the 17-pattern ban-list scan together cover the surface, but the implementer must NOT under-emphasize any one of the 4. Specific guidance: the prompt header doctrine block carries the 5 absences-and-broadness paragraphs (§A.3.1); each per-key entry carries the verbatim DOCTRINE paragraph (§A.3.2); the adversarial-doctrine test file dedicates a fixture per HIGHEST-risk key. None of the 4 may be silently downgraded to MEDIUM.
- **D9/D13 language omission.** If the smoke audit does not carry the `evidence_span` inspection language, it will retroactively fail once Card 2 lands. This is mechanical, not stylistic — the lint regex (`\bevidence_span\b`) must match. (HALT 11 + HALT 12.)
- **Cross-family dispatch test retarget.** The dispatch tests currently assert the unsupported set `{H, I, J}`. Retargeting to `{I, J}` must preserve the envelope shape + cross-family-leak prevention assertions; a careless retarget could drop a leak-prevention case. The implementer must grep for `'claim_clarity', 'thread_topology', 'sensitive_composer'` (and the array form) across `__tests__/` AND `mcp-server/tests/` to find ALL sites. (HALT #4 cross-family core.)
- **Boundary regex near-miss assertions.** The H ban-list patterns use the same boundary form as F + G (`(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)`). The implementer must explicitly test near-miss behavior for the H tokens: `wonderful` (no H pattern matches), `weakly` (the `weak` pattern does NOT match because `l` is alpha → no boundary), `weakened` (same), `lazyness` (the `lazy` pattern does match because `n` follows `lazy` directly — wait: `lazy` + `n`; `n` is alpha → no boundary, so `lazy` does NOT match `lazyness`; "lazyness" is NOT a flagged form. The implementer records this honestly in the test fixture: the strict-boundary form is the binding choice, accepting that `lazyness` slips through. If a future smoke surfaces a `lazyness`-shaped doctrine leak, the operator can amend with a `\bweak\w*\b`-style pattern.).
- **Migration / operator deploy.** None. Edge Functions + MCP server auto-deploy on merge (Supabase GitHub integration + Deno Deploy). No `db push`. (See Operator steps.)
- **Existing Edge Jest registry test.** `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` must stay green unchanged (it already asserts H admin-only via FR-7 + FR-28). The implementer must NOT modify it; the new `…FamilyH.test.ts` is additive parallel coverage, NOT a replacement.
- **The fixture count (~11) is higher than G's (~9).** H has 4 per-key adversarial fixtures vs G's 1 axis-partner; the supplementary fixtures (G, H, I, J) are smaller. The implementer may choose to fold supplementary fixtures into the canonical-met/unmet request bodies (reducing fixture count to ~7) IF the test coverage stays equivalent. Either posture (~7 or ~11 fixtures) is acceptable; the binding minimum is the 6 mandatory fixtures (A, B, C, D, E, F) + the 1 canonical-response (L) + the 1 ban-list-violation (K) + the 1 malformed (M) = **9 minimum**.

---

## Out of scope

- Family I / J registration (this card ships ONLY H).
- Production flip (Card 3); any `productionEnabled` change for H or any family.
- Editing the shared `mcp-server/lib/doctrineBanList.ts` (H adds its own `FAMILY_H_BAN_PATTERNS` scan; HALT 5).
- Family A–G lib changes (`familyA*.ts` … `familyG*.ts` byte-equal; HALT 4).
- The Edge `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (H entry already correct; byte-equal; HALT 13).
- The Edge `booleanObservationRequestBuilder.ts` `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` (H is uniform `ai_classifier`; no entry needed; HALT 12 inapplicable).
- Adding `family_h` / `claim_clarity` to `DOCTRINE_RISK_FAMILIES` in `audit-lint-rules.cjs` (that is **Card 2** — the L5 mechanization).
- Correcting any upstream `familyH.ts` taxonomy text (the upstream header is already accurate; no `src/`-touching obligation).
- The 0 deterministic H keys (none exist; not applicable).
- MCP schema version bump; token bump without Stage 2B; dispatcher hard-coding (provider selection is registry-gated + the additive H block only); any `src/` taxonomy change; other family prompts.
- Wiring H into the point-standing economy / standing bands (H emits advisory metadata only; no scoring wire-up in this card).
- A live latency measurement for H (deferred to Card 3 — H is not production-enabled here).
- A live Anthropic call by Claude during design or implementation (operator-gated only; the dry/fixture path covers test coverage; HALT triggers + cdiscourse-doctrine §7 guard).

---

## HALT trigger table (24 triggers, binding)

Per intent §7, mirroring G's table with H-specifics:

| # | Trigger | Why |
| --- | --- | --- |
| 1 | Required reading missing | Skill / doctrine docs / Family G design / intent brief / familyH.ts source not consumed before design starts. |
| 2 | Standard preflight not green | `npm run typecheck` / `npm run lint` / `npm run test` / `cd mcp-server && deno test` not all 0-exit on origin/main. |
| 3 | A.1 finds H source-split is NOT uniform `ai_classifier` | Reality audit confirmed 12/12 uniform. If implementation discovers a hidden auto_metadata/lifecycle entry, HALT and revisit. |
| 4 | A–G family files modified (byte-equal violation) | `mcp-server/lib/familyA*.ts` through `familyG*.ts` MUST be byte-equal. `git diff` on these returns non-empty = HALT. |
| 5 | Protected surface modified | `seedPrompt.ts`, `anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts`, shared `doctrineBanList.ts`, `supabase/functions/_shared/booleanObservations/familyRegistry.ts`, `supabase/migrations/`, `package.json`, `src/features/nodeLabels/**`, `mcpOneTwoOneCEdgeFamilyRegistry.test.ts`. |
| 6 | roadmap-reviewer returns BLOCK | Any reviewer issue not resolved before PR open. |
| 7 | Any adversarial Explore finds blocking refutation | Verdict-leak hunt / cross-family key collision / ban-list completeness Explore returns FAIL. |
| 8 | Test delta out of bounds | Deno > +250 net OR Jest > +12 net. Current forecast ~135 Deno + ~8 Jest is well within bounds. |
| 9 | Cross-family rawKey collision found | A∩H / B∩H / … / G∩H any non-empty intersection. |
| 10 | `FAMILY_H_MAX_TOKENS` bump above 2000 without explicit operator approval | Stage 2B T4 axis. Designer forecast: no bump needed (12 keys, ~480 headroom). |
| 11 | Smoke template lacks `Audit-Lint: v1` marker or required-final-step | D9 BINDING. The template MUST carry both. |
| 12 | Smoke template Phase 4b doctrine `evidence_span` inspection language absent | D9 + D13 BINDING because doctrine-risk = YES; retroactive L5 lint will fail if absent. |
| 13 | Edge `familyRegistry.ts` H entry changed | This card is admin-only; the H entry already exists at line 104-108 byte-equal. Card 3 owns the flip. |
| 14 | Stage 2B REQUIRED but operator approval missing when implementer starts | T3 fires → Stage 2 surface (prompt structure + ban-list axis) MUST be operator-approved before implementer's first slice commit. |
| 15 | Upstream count drift discovered late | If `familyH.ts` actually has !=12 ai_classifier entries when the implementer reads it, HALT. (Designer verified 12 at this point; the parity test enforces.) |
| 16 | Dispatcher architecture-core violation | The dispatcher must stay registry-derived for routing; provider selection is the standard per-family additive `if (family === 'claim_clarity')` block. A rewrite that abandons the additive pattern = HALT. |
| 17 | Prompt header frames claim-clarity as a verdict | A.3.1 header block must contain "DESCRIPTIVE FORMULATION-STATE" not "weak/strong/bad/good" framing. Test asserts. |
| 18 | Per-key axis-partner guard missing for any HIGHEST-risk key | The 4 HIGHEST-risk keys MUST each carry a verbatim DOCTRINE paragraph in their `falsePositiveGuards`. The `claim_specificity_low` guard is the strongest. Test asserts presence of forbidden-word enumeration. |
| 19 | H ban-list missing any of the 17 D5 patterns | `FAMILY_H_BAN_PATTERNS` must have all 17 from §A.3.3. Test asserts count + each pattern's presence. |
| 20 | Phase 4b smoke shows ≥1 dirty firing (a persisted H `evidence_span` contains a forbidden verdict token) | Existential FAIL → HALT + revert. The 4 HIGHEST-risk adversarial fixtures + the ban-list runtime scanner exist to prevent this; if it happens live, the doctrine guards failed and the ship is unsafe. |
| 21 | Phase 4b smoke shows 0 firings on ALL H keys | PARTIAL (not FAIL); 0-fire is operator-deferrable; the smoke audit carries the D9 `evidence_span` language and Card 2 + amendment handle the satisfaction. |
| 22 | Adversarial fixture C, D, E, or F is missing or has the wrong shape | The 4 per-key existential fixtures are mandatory; each MUST contain the verdict word(s) in the INPUT and the doctrine-clean evidence_span in the EXPECTED response. |
| 23 | Smoke script Check 22 or 23 ID is wrong / classifierSetVersion assertion missing | D12: check IDs `22-compat-boolean-family-h` + `23-mcp-tools-call-boolean-family-h`; both MUST assert `"family-h-v1"` substring in response. |
| 24 | Local pre-lint `node scripts/ops/audit-lint.mjs <audit>` returns non-zero before push | The smoke audit MUST self-lint clean before publishing. D9 mechanical. |

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; gameplay not truth).** H's classifier emits descriptive claim-clarity formulation states, never a verdict. The 5-layer defense (header doctrine block + 4 HIGHEST-risk per-key guards + H ban-list + 4 per-key adversarial fixtures + Phase 4b live smoke) forbids weak/sloppy/lazy/careless/confused/unsound/unsupported/incoherent/illogical/wrong/"bad reasoning"/"bad argument"/"bad writing"/"argument is incomplete"/"argument is unsupported"/"argument is weak"/"claim fails"/"claim is wrong" in any output field. Score never blocks posting: H is admin_validation-only (not even in the production auto-trigger), and the production auto-trigger (A–G) runs in the background after submit — submit never blocks on classification. RESPECTED.
- **cdiscourse-doctrine §2 (heat ≠ truth).** H has no access to heat/engagement signals; it classifies move text + parent context only. RESPECTED.
- **cdiscourse-doctrine §3 (popularity ≠ evidence).** H does not read engagement metrics; the anti-amplification boundary is untouched. RESPECTED.
- **cdiscourse-doctrine §4 (AI moderator limits).** H does not decide who is right, does not delete/hide/modify content, does not assign truth values, returns advisory metadata only (the Edge Function marks AI flags `authoritative: false`), and runs ONLY on the server (Deno) — never on the client. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine sacred).** This card does not touch `src/lib/constitution/engine.ts`. RESPECTED.
- **cdiscourse-doctrine §6 (secrets).** `familyHAnthropic.ts` reaches Anthropic via `callAnthropic` (x-api-key); `ANTHROPIC_API_KEY` is never logged (asserted by `familyHAnthropic.test.ts`); no `SERVICE_ROLE` in any H file; server-side only. RESPECTED.
- **cdiscourse-doctrine §7 (no AI calls from the production app).** Every H file is under `mcp-server/` (server-side Deno), never imported into `src/` or `app/`. RESPECTED.
- **cdiscourse-doctrine §10a (Observations vs Allegations).** Every H key is a machine **Observation** (`kind: 'machine_observation'`, `source: 'ai_classifier'`), structural-only, never an allegation about a person or intent. No H observation implies truth/quality/victory/defeat/dishonesty. The `unclear_reference_present` key explicitly carries the upstream guard against speaker-skill verdicts. RESPECTED.
- **point-standing-economy (absence/breadth are SHAPES, not standing penalties).** The header doctrine block + the `claim_specificity_low` / `conclusion_missing` / `reason_missing` per-key guards encode this verbatim; H emits no standing delta (descriptive only). RESPECTED.
- **evidence-doctrine (evidence debt is gameplay, not verdict).** H's `reason_missing` positive on a move means the responder MAY open an evidence debt; H itself does NOT open the debt — that wiring is downstream and out of scope. The doctrine boundary stays clean: H records the structural absence; the debt-opening is a separate concern. RESPECTED.
- **test-discipline.** Every new public function ships with Deno tests; the doctrine ban-list assertions are mandatory (the card touches verdict-adjacent strings); the count goes up (+135 Deno + 8 Jest forecast); the smoke audit Phase 6 captures exit codes. RESPECTED.

**HALT-trigger self-check (for the DESIGN — none should fire):** The 24 intent HALT triggers are runtime/implementation/smoke triggers (e.g., #17–18 prompt frames clarity as a verdict / per-key guard missing; #20–21 Phase 4b dirty-firing / 0-firing; #4 A–G byte-equal; #14 Stage 2B approval missing when implementer starts; #15 source count mismatch; #23–24 marker / local pre-lint). **For the DESIGN phase, none fire** — this is a design doc, not production code: it asserts the doctrine binding (does not frame clarity as a verdict), names the Phase 4b evidence_span obligation + the axis-partner (`claim_specificity_low`) guard, declares A–G byte-equal, declares Stage 2B REQUIRED (T3) so the implementer waits for operator approval, and confirms the source count is 12 uniform `ai_classifier`. The design itself introduces no verdict framing, no production code, no missing-guard.

---

## Operator steps (if any)

**For the implementer's merge: None for code deploy** — the MCP server (Deno Deploy) and Edge Functions (Supabase GitHub integration) auto-deploy on merge to `main`. No `npx supabase db push` (no migration). No `npx supabase functions deploy` (auto). No env var change.

**Before the implementer starts (Stage 2B — MANDATORY):** the operator approves the Stage 2 surface — (a) the descriptive-formulation prompt structure (§A.3.1 header block + §A.3.2 per-key guards for the 4 HIGHEST-risk keys + §A.3.3 H ban-list 17 tokens). Note that Stage 2B for H is T3-only (doctrine-risk); T1 source-split decision surface is INAPPLICABLE (uniform `ai_classifier`). HALT #14 guards against the implementer starting without this approval.

**Post-merge (smoke; operator-run):** run the 8-phase smoke (§A.5) — hosted Phase 3 (`MCP_HOSTED_TOKEN` → 23/23), Edge Phase 4 + Phase 4b live (admin JWT; canary-first; gated Anthropic spend; no JWTs logged; no `out/` committed), Phase 7 provenance extraction; pre-push `node scripts/ops/audit-lint.mjs <audit>` exit 0. If Phase 3/4/4b are operator-deferred, the smoke audit is **PARTIAL** and MUST carry the D9 `evidence_span` language (§A.5). A later **amendment** (E/F/G precedent) lifts PARTIAL → PASS with full L6 provenance.
