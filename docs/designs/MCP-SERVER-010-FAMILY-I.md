# MCP-SERVER-010-FAMILY-I — thread_topology classifier (admin_validation only)

**Status:** Design draft — GATE-A
**Date:** 2026-06-07
**Epic:** Epic 12 / MCP semantic-referee track (MCP-021A family-ship arc)
**Release:** MCP server family-ship suite — Card 1 of 3 (admin ship → Gate A → Card 2 L5 mechanization **(CONDITIONAL — see §3 doctrine-risk verdict)** → Gate B → Card 3 production-enable + latency re-measure)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/392 (umbrella #388)
**Branch:** `feat/mcp-server-010-family-i`
**Intent brief:** `docs/designs/MCP-SERVER-010-FAMILY-I-intent.md` (binding decisions D1–D14; ~12 `[OPERATOR DECISION NEEDED]` markers; HALT triggers §7; Stage 2B triggers §4)
**Predecessor (Phase 0 verified):** `main` at `f1b55a3` (post Family-H chain merge + production-enable; #404 the latest H-chain audit). Families A–G production + auto-trigger live; **Family H admin_validation shipped + registered (8th family); Family H production-enable in flight via the H Card-3 chain** (`MCP-021C-EDGE-FAMILY-H-ENABLE`). Families I/J unsupported on the MCP server.
**Prerequisites:** Family H chain (`MCP-SERVER-009-FAMILY-H` #400/#403/#404) merged. The mcp-server registers 8 families (`familyRegistryInit.ts:74-169`). The Edge `familyRegistry.ts` `thread_topology` entry is `{ productionEnabled: false, adminValidationEnabled: true }` at **lines 109-113** (D7 baseline confirmed). A–H operational on the hosted MCP server.

---

## Goal (one paragraph)

Ship Family I (`thread_topology`) on the hosted MCP server in an **admin_validation-only** Edge posture, mirroring the Family G + H structural pattern (`mcp-server/lib/familyG*.ts` / `familyH*.ts` + the 5-layer doctrine defense) byte-for-byte structurally, but with a **6-key MIXED-SOURCE subset** scope rather than H's 12-key uniform scope. Family I's upstream taxonomy (`src/features/nodeLabels/machineObservationDefinitions/familyI.ts`) is **21 keys MIXED source** — 8 `auto_metadata` + 7 `lifecycle` + **6 `ai_classifier`**. The MCP-server classifier handles the **6 `ai_classifier` keys ONLY** (text-derivable thread-graph relations); the 8 `auto_metadata` keys are deterministically derivable from argument-tree structure and the 7 `lifecycle` keys are cluster/temporal-derived — **both are NOT LLM-classified and are out of scope for this card** (Family D + G mixed-source subset precedent governs). The doctrine peril here is **LOW** (§3): the 6 ai_classifier keys are structural-topology relations ("does this message introduce a new issue / reference a prior agreement / open a sub-axis / return to a prior issue / reference external context / compare options") — they describe how a move relates to the conversation graph, never truth or speaker-judgment. The upstream file explicitly **DROPPED** the verdict-adjacent candidate `repeats_prior_point` ("repeats reads as verdict on contribution", familyI.ts:28-30), leaving a clean descriptive set. This card creates `familyIKeys.ts` (6-key ai_classifier subset + the excluded-deterministic list), `familyIPrompt.ts`, `familyIAnthropic.ts`, `familyIBanListScan.ts`, `familyIFixtureProvider.ts`, one `register('thread_topology', …)` call in `familyRegistryInit.ts`, the `pickFamilyProviders` provider block + dispatcher description update, fixtures, Deno tests, the smoke +2 checks (`24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i`), and a new Edge Jest registry test (`mcpOneTwoOneCEdgeFamilyRegistryFamilyI.test.ts`). It does **NOT** flip production (Card 3 #394), does **NOT** register J, does **NOT** change A–H (byte-equal), does **NOT** edit the Edge `familyRegistry.ts` (I entry already admin-only at lines 109-113; D7), does **NOT** edit the shared `doctrineBanList.ts`, and — per the Family D + G precedent (§"D2 resolution") — does **NOT** add the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry to `booleanObservationRequestBuilder.ts` (that is a **separate Edge-subset follow-up card / Card 3**, exactly as `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` #355 was distinct from the G server card #354). The score-never-blocks-posting invariant is preserved end-to-end: I is admin_validation-only and never enters the production auto-trigger; the production auto-trigger runs in the background after submit.

---

## A.1 — Source verification + Stage 2B + the GATING doctrine-risk determination

### A.1.0 — Source verification (Phase 0 finding CONFIRMED from code)

Direct inspection of `src/features/nodeLabels/machineObservationDefinitions/familyI.ts` (`FAMILY_I_DEFINITIONS`, lines 104-678) confirms the Phase 0 split byte-for-byte:

| Source | Count | rawKeys (verbatim, declaration order) |
| --- | --- | --- |
| `auto_metadata` | **8** | `has_reply`, `participant_skipped_node`, `no_response_after_n_turns`, `repeated_axis_pressure`, `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node` |
| `lifecycle` | **7** | `open`, `answered`, `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`, `ignored_by_negative`, `ignored_by_both` |
| **`ai_classifier`** | **6** | `introduces_new_issue`, `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`, `compares_options` |
| **Total** | **21** | |

Verification commands (run at design time): `grep -c "source: 'ai_classifier'"` → 6; `grep -c "source: 'auto_metadata'"` → 8; `grep -c "source: 'lifecycle'"` → 7. **MIXED source confirmed — T1 FIRES.** This matches Family D (mixed: 19 ai_classifier + 8 deterministic) and Family G (mixed: 18 ai_classifier + 12 deterministic) structurally. **A subset/exclusion IS required** in the server keys file (`FAMILY_I_RAW_KEYS` = 6 ai_classifier; `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` = 15 deterministic) — exactly the Family D + G keys-file shape, NOT the H uniform shape (H omitted the excluded list).

> NOTE — the upstream `familyI.ts` header (lines 1-37) is **already accurate**: it correctly enumerates "21 entries total", the 14 retroactive + 7 new split, and the Decision-7 source assignments. There is no header/code drift; this card has **no `src/`-touching obligation** surfaced to the operator. The upstream file is a READ source-of-truth, never written. (HALT 5 protects `src/features/nodeLabels/**`.)

### A.1.1 — The exact ai_classifier rawKey list for `familyIKeys.ts` (the MCP classifier scope) — **D1 RESOLVED**

**`FAMILY_I_RAW_KEYS` = the 6 ai_classifier rawKeys, in upstream declaration order** (resolved verbatim from `familyI.ts`; **D1 CONFIRMED — this is a resolved-from-code decision, not an operator-decision**):

| # | rawKey | New? | upstream priority | Verdict-adjacency |
| --- | --- | --- | --- | --- |
| 1 | `introduces_new_issue` | existing #36 (RETROACTIVE) | 40 | **LOW** — "introduces a new topic distinct from the parent" is structural topology; upstream guard already says "never a verdict on the move's quality" (familyI.ts:396-399) |
| 2 | `references_prior_agreement` | existing #50 (RETROACTIVE) | 45 | **LOW** — "cites a previously-agreed point" is structural recovery-positive; no verdict adjacency (familyI.ts:426-429) |
| 3 | `introduces_sub_axis` | existing #57 (RETROACTIVE) | 49 | **LOW** — "opens a more specific dimension of the parent's topic" is structural narrowing; no verdict adjacency (familyI.ts:456-459) |
| 4 | `returns_to_prior_issue` | **NEW** (Decision 7) | 254 | **LOW** — "re-engages a parked topic" is structural; upstream calls it "productive when it brings new evidence" (familyI.ts:614-615) |
| 5 | `references_external_context` | **NEW** (Decision 7) | 255 | **LOW** — "brings in a URL/document/event from outside the room" is structural reference; can be evidence-positive (familyI.ts:643-644) |
| 6 | `compares_options` | **NEW** (Decision 7) | 256 | **LOW** — "weighs two+ options on stated criteria" is structural recovery-positive; "comparison moves often unstick polarized disputes" (familyI.ts:672-674) |

**`FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1'`** (D9 RESOLVED — per chain convention `family-{letter}-v1`).

**`FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` (15 keys — the 8 auto_metadata + 7 lifecycle, intentionally excluded; mirrors `FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS` / `FAMILY_G_EXCLUDED…`):**

```
// auto_metadata (8):
has_reply, participant_skipped_node, no_response_after_n_turns,
repeated_axis_pressure, splits_thread, merges_thread,
references_sibling_node, references_ancestor_node
// lifecycle (7):
open, answered, moved_on_by_affirmative, moved_on_by_negative,
ignored_by_affirmative, ignored_by_negative, ignored_by_both
```

> No rawKey-string collision between the excluded set and the included set (all 21 strings are unique within Family I — unlike Family D where `source_requested`/`quote_requested` appeared under two sources). The parity test asserts all 6 included literals are present in upstream `familyI.ts` as `source: 'ai_classifier'` AND all 15 excluded literals are present as `source: 'auto_metadata'` or `source: 'lifecycle'` AND the two sets are disjoint.

### A.1.2 — THE GATING DOCTRINE-RISK DETERMINATION — **§3 / D11 RESOLVED**

**DOCTRINE-RISK: LOW.**

**Reasoning (resolved from code + the upstream Decision-7 drop precedent):** All 6 ai_classifier keys are **thread-graph topology relations** — they describe *how a move relates to the conversation structure*, not the move's merit. None sit at the verdict boundary the way H's `claim_specificity_low` ("weak/vague/lazy") or G's `concedes_broader_point` ("lost the point") did:

- `introduces_new_issue` — descriptive: a new topic is opened. Upstream guard: "new-issue introduction is structural; **never a verdict on the move's quality**" (familyI.ts:396-399). The natural-English reading is "changed the subject", not "bad/wrong".
- `references_prior_agreement` / `introduces_sub_axis` / `returns_to_prior_issue` / `compares_options` — these are explicitly **recovery-positive / narrowing-positive / convergence** topology moves. They read as *constructive* structure, not as verdicts. There is no "weak/strong/right/wrong" drift in their natural reading.
- `references_external_context` — descriptive: external content is referenced. Can be evidence-positive (cited source) or scope-broadening; either way it is a structural fact, not a judgment.

**The upstream taxonomy already removed the one verdict-adjacent candidate.** familyI.ts:28-30 records that the brief candidate `repeats_prior_point` was **DROPPED per Trigger-10 doctrine-risk** ("repeats reads as verdict on contribution") and `changes_subject` was dropped as a duplicate of `introduces_new_issue`. The surviving 6 are the post-doctrine-filter descriptive set. This is the structural reason I's doctrine-risk is genuinely LOW where H's was YES — the verdict-adjacent key was pruned upstream before this card.

**Contrast with H/G:** H had 4 HIGHEST-risk keys at the clarity↔verdict boundary (`conclusion_missing`/`reason_missing`/`claim_specificity_low`/`unclear_reference_present`) → doctrine-risk YES. G had `concedes_broader_point` at the resolution↔verdict boundary → doctrine-risk YES. I has **zero** keys at a verdict boundary — the closest is `introduces_new_issue`, which is "topic-shift" descriptive, not a quality or correctness verdict. **There is no axis-partner key for I** (no analog to H's `claim_specificity_low`).

**Consequence (D11 — Card 2 CONDITIONAL resolves to SKIPPABLE):** Because doctrine-risk = LOW, **Card 2 (L5 mechanization — adding `family_i` to `DOCTRINE_RISK_FAMILIES` in `scripts/ops/audit-lint-rules.cjs`) is OPTIONAL / SKIPPABLE.** The suite collapses to a **2-card chain** (Card 1 admin ship → Gate A → Card 3 production-enable). This is the **Family E precedent** (uniform, LOW-risk → no L5 mechanization card) rather than the F/G/H precedent (doctrine-risk YES → L5 card ran). **This SKIP recommendation is the single most consequential GATE-A operator decision in this card** (§GATE-A verdict). The 5-layer doctrine defense (§A.3) still ships on this card as a belt-and-suspenders measure regardless — the SKIP only concerns the *mechanized retroactive lint* (Card 2), not the per-card guards.

> Because doctrine-risk = LOW, the smoke audit's Phase 4b is **descriptive-clean verification at NORMAL intensity** (not the existential-FAIL intensity H's was). The D9/D13 consistent-PARTIAL `evidence_span` language is **still included** in the smoke template as a forward-safety measure (so that IF the operator later decides to run Card 2 and add `family_i` to the doctrine-risk set, this card's already-merged smoke audit does not retroactively fail L5). See §A.5 + §D10 resolution.

### A.1.3 — Stage 2B determination — **§4 RESOLVED: REQUIRED because T1**

**Stage 2B REQUIRED because T1 (mixed-source provenance). This is the explicit declaration the brief §4 mandates: "Stage 2B REQUIRED because T1".**

| Trigger | Fires? | Why |
| --- | --- | --- |
| **T1 — mixed source provenance** | **TRUE** | I is MIXED (8 auto_metadata + 7 lifecycle + 6 ai_classifier; §A.1.0). The ai_classifier-subset decision (which 6 keys flow to the MCP classifier; which 15 are excluded) is the Family D/G subset precedent. **→ Stage 2B MANDATORY.** The operator-decision surface is the **subset confirmation** (the 6-key list = D1, already resolved verbatim from code) + the excluded-15 boundary. |
| T2 — compound rawKey collision | **FALSE** (A.2 verifies) | No rawKey in the I set collides across families A–H. The 6 ai_classifier I keys are all I-specific thread-topology keys. Parity test asserts A∩I … H∩I all empty. |
| **T3 — doctrine-risk framing** | **FALSE** | doctrine-risk = LOW (§A.1.2). No verdict-adjacent key; the one candidate was pruned upstream. T3 does NOT fire. (Contrast: H + G fired T3.) |
| T4 — MAX_TOKENS bump | **FALSE** (A.2) | 6 keys × ~85 tokens ≈ 510 output, vastly under the 1500 default with ~990 headroom — the **loosest of any family A–I** (H at 12 keys was the prior loosest). A bump is NOT required. T4 does NOT fire. |
| T5 — dependency on prior-family outputs | **FALSE** | I's classifier reads the move text + parent context + thread-context excerpt (sibling-graph topology is conveyed in the excerpt); it does NOT read A–H classifier outputs. Identical to D/E/F/G/H. |

**Net: Stage 2B is MANDATORY (T1 only).** Per intent §4 + §9, the implementer MUST NOT start until the operator has ratified the Stage 2 surface — here the surface is **the 6-key ai_classifier subset + the 15-key exclusion boundary** (T1 axis). Because T3 does NOT fire, the doctrine-prompt-structure operator surface that H/G needed is **NOT a gating operator decision** for I — the 5-layer defense still ships, but it is a designer-specified mirror of the G/H structure, not an operator-ratified novel doctrine binding. HALT trigger #15 guards the T1 subset approval.

> Contrast with H: H's Stage 2B was **T3 ONLY** (doctrine-risk; uniform source so no subset). I's is **T1 ONLY** (mixed-source subset; LOW doctrine-risk so no prompt-structure ratification). The two cards are near-mirror-images on the Stage 2B axis: H needed the doctrine-prompt ratification but not the subset decision; I needs the subset decision but not the doctrine-prompt ratification. The G card needed BOTH (T1 + T3).

---

## A.2 — Token budget + latency

### A.2.1 — Token budget (T4 evaluation) — **D5 RESOLVED: `FAMILY_I_MAX_TOKENS = 1500`**

| Family | ai_classifier keys | MAX_TOKENS | Headroom |
| --- | --- | --- | --- |
| D | 19 | 1500 (subset) | largest subset; no truncation observed |
| E | 16 | 1500 | ~60 token headroom |
| F | 14 | 1500 | ~310 token headroom |
| G | 18 | 1500 (subset) | thin headroom; D shipped 19 at 1500 OK |
| H | 12 | 1500 | ~480 token headroom (prior loosest) |
| **I** | **6** | **1500 (proposed)** | **~990 token headroom — the LOOSEST of any family A–I** |

**Decision: `FAMILY_I_MAX_TOKENS = 1500` (NO bump). T4 does NOT fire.** (**D5 RESOLVED — designer recommendation; the brief noted 1000 was possible.**)

**Token math:** Naive estimate is **6 keys × ~85 tokens/key ≈ 510 output tokens** for an all-positive response (every key true with a full ~240-char evidence_span). That leaves **~990 tokens of headroom** against 1500 — by far the largest absolute headroom of any family A–I. **Recommendation: keep 1500** (NOT 1000) for chain uniformity — every family A–H ships at 1500, and the 1500 constant is asserted by a per-family prompt test across the suite; setting I to 1000 introduces a per-family special-case for zero benefit (the headroom is already enormous). If the operator prefers the tighter 1000 to signal the small key-count, that is a **soft GATE-A preference** (not a blocker) — but the designer's binding recommendation is **1500 for uniformity**. The implementer MUST add `familyIPrompt.test.ts` assertions `FAMILY_I_MAX_TOKENS === 1500` and `FAMILY_I_TEMPERATURE === 0`. If the canonical-response fixture demonstrably exceeds the budget (it will not, at 6 keys), that is a T4-fires escalation → STOP + surface; do NOT silently bump. HALT 10 guards a bump above 2000 without operator approval.

### A.2.2 — Latency

I is the **9th family**. Per `docs/ops/LATENCY-BUDGET.md` + the H design §A.2.2:
- Budget is against `wall_clock_background` p95 (PASS < 30s; PARTIAL ≥30s & <45s; FAIL ≥45s OR submit blocks on classification).
- The 7-family production projection measured ~34.6s (G enable, #362); the 8-family (post H-production) and 9-family (post I-production) projections were flagged as crossing into/through the FAIL band, which is **why the auto-trigger was parallelized (bounded-concurrency limit 2; p95 34.6s→19.3s)** before Family H/I production. The relevant follow-up is #365 (mcp_validation_failed under burst concurrency) — see Risks.
- **I is admin_validation-only in this card, so it does NOT enter the production auto-trigger** — I's per-family latency contribution to `wall_clock_background` p95 is **measured in Card 3** (when I flips to production), NOT here. This card adds **zero latency to the production path**.

**Doctrine note:** the production auto-trigger runs in the BACKGROUND after submit; the submit path does NOT block on classification (satisfies `cdiscourse-doctrine §1` "Score never blocks posting"). The smoke audit Phase 7 records the 9-family operational state but needs NO new latency measurement (I is not production yet).

---

## A.3 — Topology doctrine binding (D4) — 5-layer defense (LOW-risk profile)

The 5-layer defense mirrors `familyGPrompt.ts` + `familyGBanListScan.ts` / the H files structurally, but tuned for the LOW-risk profile (**D4 RESOLVED — mirrors G/H structurally; lower doctrine-risk profile so the per-key axis-partner guards are LIGHTER**; there is no HIGHEST-risk key to carry the strongest verbatim guard).

### A.3.1 — Layer 1: header CRITICAL-DOCTRINE block in `FAMILY_I_SYSTEM_PROMPT`

The system prompt MUST contain (byte-equal) the **7 absolute rules** block shared verbatim across A–H (no-right, no-winner, no-truth-value, no-popularity, no-person-labeling, no-hiding/deleting, no-blocking). Then a Family-I-specific framing:

> You classify whether an argument MOVE exhibits one or more THREAD-TOPOLOGY structural relations to the conversation graph — whether the move introduces a new issue distinct from the parent's topic, references a prior agreement established earlier, opens a sub-axis within the parent's topic, returns to a previously-parked issue, references external context (a URL / document / event from outside the room), or compares two or more options against stated criteria.

Then the **CRITICAL DOCTRINE — thread-topology relations are DESCRIPTIVE STRUCTURE, never verdicts** block (the I analog of G's CQ-as-descriptive-convergence block; LIGHTER because no key is verdict-adjacent):

> - A thread-topology observation describes HOW A MOVE RELATES TO THE CONVERSATION GRAPH — whether it opens a new issue, cites common ground, narrows into a sub-axis, returns to a parked topic, reaches outside the room, or weighs options. It NEVER asserts whether the move is "on-topic" or "off-topic" as a quality verdict, whether the speaker is "derailing", "evasive", "scattered", or "dodging", or whether returning to / introducing an issue is good or bad.
> - **A new issue is not a derailment.** When a move is detected as `introduces_new_issue`, the observation records that the move opens a topic distinct from the parent's subject. It NEVER frames this as "off-topic", "derailing", "evasive", "changing the subject to avoid", or any judgment of the speaker's motive. Introducing a new issue is a structural branching event, not a fault.
> - **Returning to a prior issue is not repetition.** When a move is detected as `returns_to_prior_issue`, the observation records that the move re-engages an earlier-parked topic. It NEVER frames this as "rehashing", "going in circles", "beating a dead horse", or "repetitive" — returning to a parked issue is often productive when it brings new evidence.
> - **Referencing external context is not authority by popularity.** When a move is detected as `references_external_context`, the observation records that the move reaches outside the room (a URL, document, event). It NEVER treats the external reference as automatically granting the claim factual standing — popularity / virality / engagement of an external source is NOT evidence (cdiscourse-doctrine §3). The observation is the structural fact of the reference, not an endorsement of its weight.
> - **Comparing options is not picking a winner.** When a move is detected as `compares_options`, the observation records that the move weighs two or more options. It NEVER asserts which option is "correct", "better", or "wins" as a verdict — even when the move's own text concludes one option wins, the observation records the STRUCTURE of the comparison, not an adjudication.
> - The output MUST NOT contain the words: off-topic, derailing, derail, evasive, evading, dodging, dodge, scattered, rambling, rehashing, repetitive, "going in circles", "changing the subject", "beating a dead horse", "off the rails", "winner", "loser", "the right option", "the correct choice". If the input move text itself contains such words, the model MAY still detect the underlying topology relation, but its own output `evidence_span` MUST anchor the structural relation (the new topic opened, the prior agreement cited, the sub-axis, the parked issue returned to, the external reference, the compared options), never echo the verdict framing.

Then the standard conservative-positives bias paragraph (thread-topology signals are usually sparse — most moves have 0 to 2 positives; many moves stay on the parent's topic and exhibit none).

A `familyIPrompt.test.ts` assertion confirms the 7 absolute rules are byte-equal to A–H AND the topology-doctrine block is present verbatim AND no bare banned token appears outside the doctrine-positive negations.

### A.3.2 — Layer 2: per-key `falsePositiveGuards`

Because doctrine-risk = LOW and **no key is HIGHEST-risk**, there is **no axis-partner key carrying a maximal verbatim guard** (the H/G strongest-guard pattern does not apply). Each of the 6 keys carries its **upstream `falsePositiveGuards` text** (already present in `familyI.ts`) mirrored into the prompt entry, PLUS a short proportional doctrine line. The two keys closest to a *misreadable* boundary get a slightly stronger line:

**`introduces_new_issue`** (the one key a careless reader could mis-frame as "off-topic"):
> DOCTRINE: introducing a new issue is a structural BRANCHING event (the move opens a topic distinct from the parent's). It is NEVER framed as "off-topic", "derailing", "evasive", or "changing the subject to dodge". The evidence_span MUST anchor the verbatim new-topic wording — NOT a judgment about whether opening it was appropriate. Do NOT mark TRUE for moves that extend the same topic (extends_parent) or return to a prior issue (returns_to_prior_issue). The output MUST NOT contain: off-topic, derailing, evasive, dodging.

**`returns_to_prior_issue`** (the one key a careless reader could mis-frame as "repetitive"):
> DOCTRINE: returning to a prior issue is a structural RE-ENGAGEMENT (the move re-opens an earlier-parked topic). It is NEVER framed as "rehashing", "repetitive", "going in circles", or "beating a dead horse" — re-engagement is often productive when it brings new evidence. The evidence_span MUST anchor the verbatim wording re-opening the prior topic. Do NOT confuse with references_prior_agreement (cited agreed-on points). The output MUST NOT contain: rehashing, repetitive, "going in circles".

The other 4 keys (`references_prior_agreement`, `introduces_sub_axis`, `references_external_context`, `compares_options`) each carry their upstream structural guard mirrored verbatim + a one-line proportional doctrine note (e.g., `compares_options`: "comparing options is structural; NEVER asserts which option wins as a verdict — anchor the compared options, not the adjudication"). A `familyIKeys.test.ts` / `familyIPrompt.test.ts` assertion confirms each key's prompt-entry `falsePositiveGuards` is non-empty and the 2 misreadable keys carry their verbatim doctrine line.

### A.3.3 — Layer 3: `familyIBanListScan.ts` topology-verdict token extensions — **D6 RESOLVED**

`familyIBanListScan.ts` mirrors `familyGBanListScan.ts` / `familyHBanListScan.ts`: it scans every `evidence_span` string + `modelInfo.serverName` + `modelInfo.classifierSetVersion`, running the shared `DOCTRINE_BAN_PATTERNS` **first**, then an I-specific `FAMILY_I_BAN_PATTERNS` extension. **I adds its OWN scan; the shared `doctrineBanList.ts` is NOT edited (byte-equal).** HALT 5 guards.

The shared `DOCTRINE_BAN_PATTERNS` already covers: `winner`, `loser`, `correct`, `incorrect`, `truth`, `untrue`, `dishonest`, `liar`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`, `verdict`, `bad faith`, `proof of`. So the truth/winner/person tokens are already caught.

**D6 RESOLVED — `FAMILY_I_BAN_PATTERNS` (topology-verdict tokens NOT already covered; 8 patterns — the SMALLEST family-local list of any family because the doctrine surface is the smallest):**

**Single-word tokens (5):**

| Pattern | Boundary form | Why I-scoped (not shared) |
| --- | --- | --- |
| `off-topic` / `offtopic` | `(?:^|[^a-z0-9])off[\s_-]?topic(?:[^a-z0-9]|$)` | the canonical `introduces_new_issue` verdict drift; not in shared |
| `derailing` (+ `derail`) | `(?:^|[^a-z0-9])derail(?:[^a-z0-9]|$)` matches `derail`; a second pattern catches `derailing` | "derailing the thread" — motive/quality verdict on a topology move |
| `evasive` (+ `evading`) | single token + a second for `evading`/`evade` | "evasive" / "dodging" — speaker-motive verdict |
| `rehashing` (+ `rehash`) | single token | the `returns_to_prior_issue` verdict drift |
| `repetitive` | single token | the `returns_to_prior_issue` verdict drift ("going in circles") |

**Compound phrases (3):**

| Pattern | Form | Why I-scoped |
| --- | --- | --- |
| `going in circles` | `(?:^|[^a-z0-9])going[\s_-]+in[\s_-]+circles(?:[^a-z0-9]|$)` | the canonical `returns_to_prior_issue` verdict compound |
| `changing the subject` | phrase | the `introduces_new_issue` motive-verdict compound |
| `beating a dead horse` | phrase | the `returns_to_prior_issue` motive-verdict compound |

**Token-scoping rationale (mirrors the F + G + H file reasoning):** `off-topic` / `derailing` / `evasive` / `rehashing` / `repetitive` are NOT promoted to shared `DOCTRINE_BAN_PATTERNS` because they can legitimately appear in OTHER families' descriptive evidence_spans (e.g., a Family A evidence_span quoting a move's own text). Scoping them to I's scan keeps A–H outputs working while blocking the I failure mode. Boundary strategy is byte-identical to `FAMILY_F/G/H_BAN_PATTERNS`: `(?:^|[^a-z0-9])TOKEN(?:[^a-z0-9]|$)` for single tokens, `[\s_-]+` for phrase separators. The implementer adds the standard near-miss assertions (`derail` matches "derail"/"derailing"-via-second-pattern; a benign word like `topical` does NOT match `off-topic`; `circle` alone does NOT match the phrase).

A `familyIBanListScan.test.ts` asserts the scan rejects every shared banned token AND every I-specific token in evidence_spans / serverName / classifierSetVersion, AND null evidence_span values are skipped, AND `checkedRawKeys` entries are NOT scanned.

> **D6 note (LOW-risk → small list):** because the doctrine surface is the smallest of any family, `FAMILY_I_BAN_PATTERNS` is the smallest family-local extension (8 patterns vs H's 17, G's 11). The brief D6 noted "reuse of shared `doctrineBanList.ts` likely sufficient" — the designer's resolution is a **minimal 8-pattern I-local extension** rather than relying on the shared list alone, because the topology-specific drift words (`off-topic`, `derailing`, `rehashing`) are NOT in the shared list and ARE the I-specific failure mode. The 8-pattern list is the binding minimum; the implementer may NOT drop below it without operator sign-off.

---

## A.4 — Adversarial fixture design (D4)

Nine/ten fixtures (2 mandatory baseline + 2 boundary-adversarial + 3 supplementary canonical + 1 ban-list-violation + 1 malformed) targeting the topology↔motive-verdict boundary. Each ships as a request fixture (input) + a canonical-response fixture (the doctrine-clean expected output). The local Deno test layer (`familyIAdversarialDoctrine.test.ts`) verifies the response fixtures pass the validator + the I ban-list scan; the **live** persisted-row verification is the Phase 4b smoke obligation.

| Fixture | Input (move text) | Expected I positives | Doctrine-clean `evidence_span` assertion |
| --- | --- | --- | --- |
| **A — canonical new-issue (MANDATORY)** | Parent on library funding. Move: *"Worth thinking about museum funding too — that's a different question, but the same budget pressures apply."* | `introduces_new_issue` | evidence_span anchors the new-topic wording ("museum funding too — that's a different question"). NO "off-topic"/"derailing" framing. Baseline. |
| **B — canonical comparison + sub-axis (MANDATORY)** | *"On STAFFING specifically — carbon tax vs cap-and-trade for the library energy budget: the tax is simpler and more predictable; cap-and-trade has better political durability."* | `introduces_sub_axis`, `compares_options` | evidence_span anchors the sub-axis opening + the compared options. NO "the right option"/"winner" framing even if the move concludes. |
| **C — new-issue adversarial (MANDATORY; boundary for `introduces_new_issue`)** | Input contains motive-verdict framing: *"You keep dodging. Fine — let's talk about museum funding instead. I know I'm changing the subject and being evasive and off-topic, but it matters."* | `introduces_new_issue` (possibly `returns_to_prior_issue` if museum funding was parked) | The move's text contains "dodging"/"changing the subject"/"evasive"/"off-topic". The model MAY detect `introduces_new_issue` but its output evidence_span MUST anchor the **new-topic wording** ("let's talk about museum funding") — it MUST NOT echo "dodging"/"changing the subject"/"evasive"/"off-topic". **A FAIL here is HALT + revert.** |
| **D — return-to-issue adversarial (MANDATORY; boundary for `returns_to_prior_issue`)** | Earlier cluster: library staffing (parked). Currently: museum funding. Input contains verdict framing: *"Coming back to the library staffing question — I know I'm rehashing and going in circles, but the new union-contract data does support X."* | `returns_to_prior_issue` (possibly `references_external_context` for the union-contract data) | The move's text contains "rehashing"/"going in circles". The model MAY detect `returns_to_prior_issue` but its output evidence_span MUST anchor the **re-engagement wording + the new evidence** ("Coming back to the library staffing question … new union-contract data") — it MUST NOT echo "rehashing"/"going in circles". **A FAIL here is HALT + revert.** |
| **E — prior-agreement canonical (SUPPLEMENTARY)** | *"Given we agreed earlier that infrastructure means publicly-funded shared assets, libraries clearly qualify."* | `references_prior_agreement` | evidence_span anchors the cited agreement ("we agreed earlier that infrastructure means…"). Tests `references_prior_agreement` discrimination from paraphrase-without-agreement. |
| **F — external-context canonical (SUPPLEMENTARY)** | *"Per yesterday's NYT article on library funding, the new program details are X and Y."* | `references_external_context` | evidence_span anchors the external reference ("yesterday's NYT article"). Tests `references_external_context` doctrine-clean — NO treating the reference as automatic factual standing (cdiscourse-doctrine §3). |
| **G — no-topology canonical (SUPPLEMENTARY; the all-negative case)** | A move that stays on the parent's topic with no topology relation: *"I disagree — the funding figure you cited is for capital, not operating budget."* | (none — all 6 keys FALSE) | The conservative-positives bias case: most moves exhibit no topology relation. Tests that the classifier does NOT over-fire. evidence_span null for all 6. |
| **H — ban-list intentional violation (MANDATORY; runtime-scanner stress test)** | A canonical response with an intentionally banned token in evidence_span: `"evidenceSpan": { "introduces_new_issue": "the speaker is just being evasive and off-topic" }` | (response fixture) — `introduces_new_issue: true` | `familyIBanListScan.test.ts` MUST detect the ban and emit `{ok: false, path: 'evidenceSpan.introduces_new_issue'}`. Mirrors G/H's `ban-list-response.json`. |
| **I — canonical-response (MANDATORY for fixture provider)** | (response fixture) | `introduces_new_issue: true, compares_options: true` (+ the rest consistent + null evidence_span for unmet keys) | The fixture provider loads this for smoke Checks 24+25. Positive-sparse, doctrine-clean, 6-key-shaped. |
| **J — malformed-response (MANDATORY; rejection path)** | (response fixture with a schema violation: missing `confidence` field) | (n/a; expected to fail validation) | `validateMcpBooleanObservationResponse` must reject; test asserts the rejection path. Mirrors G/H's malformed-response fixture. |

Fixtures C + D carry the **adversarial input** (motive-verdict words in the move text); the binding proof is that the OUTPUT stays clean regardless of input. This mirrors H's Fixtures C/D/E/F and G's Fixtures C/E — the founding adversarial pattern against the MCP-020 failure mode, scaled to I's 2 misreadable keys (vs H's 4 HIGHEST-risk keys). **Because doctrine-risk = LOW, I needs only 2 per-key boundary fixtures** (`introduces_new_issue` + `returns_to_prior_issue`), not H's 4.

**Fixture count: ~10 distinct JSON files** (2 canonical request A+B + 2 boundary-adversarial request C+D + 3 supplementary canonical request E+F+G + 1 canonical-response I for fixture provider + 1 ban-list-violation response H + 1 malformed response J = 10). The implementer may fold supplementary fixtures E/F/G into fewer files IF coverage stays equivalent; the **binding minimum** is A, B, C, D (the 2 canonical + 2 boundary) + I (canonical-response) + H (ban-list) + J (malformed) = **7 minimum**.

---

## Data model

**No new data model.** No SQL schema, no migration, no new table.

- The server-side `FAMILY_I_RAW_KEYS` (6 ai_classifier rawKeys) + `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` (15) + `FAMILY_I_PROMPT_ENTRIES` (6) + `FAMILY_I_CLASSIFIER_SET_VERSION` are TypeScript constants mirroring the upstream `familyI.ts` taxonomy slice (rawKey + prompt-entry fields only; `confidenceEligibility` lives upstream and is applied by the Edge sanitizer — same as A–H).
- **Provenance:** the 6 included keys come from upstream `familyI.ts` entries with `source: 'ai_classifier'`; the 15 excluded keys come from `source: 'auto_metadata'` (8) + `source: 'lifecycle'` (7). The 8 auto_metadata keys are deterministically derivable from argument-tree structure (`threadTopologyAutoMetadata.ts`, no-op stubs in MCP-021A; real derivers are future MCP-021C territory); the 7 lifecycle keys are cluster/temporal-derived. **Neither is LLM-classified; both are out of scope for this card** (D3).
- The wire shape is the existing `mcp-021.machine-observations.boolean.v1` schema (unchanged). I reuses it.
- The persisted output (`argument_machine_observation_results.evidence_span`) is the EXISTING column the Edge Function writes for admin_validation runs — no schema change.
- `ValidatedFamilyIRequest` is a TS interface in `familyIPrompt.ts`, structurally identical to `ValidatedFamilyHRequest` / `ValidatedFamilyGRequest` (kept distinct so future I-specific fields don't cross-pollinate) — same precedent as G/H.
- **`FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant PRESENT** (15 keys; mirrors Family D + G keys files — the mixed-source pattern). This is the structural difference from H (which omitted it).
- **NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `thread_topology` in this card** (see §D2 resolution — deferred to a separate Edge-subset card / Card 3 per the G #354 → #355 precedent).

---

## File changes

### New files (mcp-server, all Deno/TS)

- `mcp-server/lib/familyIKeys.ts` — **~190–220 lines.** `FAMILY_I_RAW_KEYS` (6 ai_classifier rawKeys, frozen, declaration order matching upstream), `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` (15 keys, frozen — the mixed-source exclusion list mirroring `familyDKeys.ts`), `FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1'`, `FamilyIPromptEntry` interface, `FAMILY_I_PROMPT_ENTRIES` (6 verbose entries with per-key falsePositiveGuards incl. the 2 misreadable-key doctrine lines from §A.3.2). Mirrors `familyDKeys.ts` (the mixed-source shape, scaled down to 6 keys). Header documents the **MIXED `ai_classifier` subset** rationale (mirror Family D + G headers) + the 15-key exclusion + Decision 7.
- `mcp-server/lib/familyIPrompt.ts` — **~230–260 lines.** `FAMILY_I_SYSTEM_PROMPT` (7 absolute rules byte-equal + the topology-doctrine block from §A.3.1), `FAMILY_I_MAX_TOKENS = 1500`, `FAMILY_I_TEMPERATURE = 0`, `FAMILY_I_MAX_BODY_FIELD_LEN = 8000`, `ValidatedFamilyIRequest` interface, `buildFamilyIUserPrompt(request)`. Mirrors `familyGPrompt.ts` / `familyHPrompt.ts`.
- `mcp-server/lib/familyIAnthropic.ts` — **~52 lines.** `runAnthropicFamilyIClassifier(request, requestId, fetchImpl?)`. Byte-for-byte structural mirror of `familyHAnthropic.ts` / `familyGAnthropic.ts` (53 lines).
- `mcp-server/lib/familyIBanListScan.ts` — **~130 lines.** `FAMILY_I_BAN_PATTERNS` (the 8 D6 topology-verdict patterns from §A.3.3) + `scanFamilyIBooleanResponseForBanList(response)`. Mirrors `familyHBanListScan.ts` (scaled to 8 patterns).
- `mcp-server/lib/familyIFixtureProvider.ts` — **~53 lines.** `loadFixtureFamilyIPacket()`. Mirrors `familyHFixtureProvider.ts` (53 lines).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-canonical-response.json` — canonical 6-key doctrine-clean response for smoke Checks 24+25 (Fixture I).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-new-issue-request.json` — Fixture A.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-comparison-subaxis-request.json` — Fixture B.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-new-issue-adversarial-request.json` — Fixture C (boundary).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-return-issue-adversarial-request.json` — Fixture D (boundary).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-prior-agreement-request.json` — Fixture E.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-external-context-request.json` — Fixture F.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-no-topology-request.json` — Fixture G (all-negative).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-ban-list-response.json` — Fixture H (intentional ban-list violation).
- `mcp-server/fixtures/classify-argument-boolean-observations.family-i-malformed-response.json` — Fixture J.

### New test files (mcp-server/tests, Deno)

Six dedicated Deno test files mirroring the G/H pattern (keys, keys-parity, prompt, ban-list, anthropic, adversarial-doctrine):

- `mcp-server/tests/familyIKeys.test.ts` — **~16 tests.** `FAMILY_I_RAW_KEYS` has exactly 6 entries; all 6 present verbatim in upstream `familyI.ts` as `source: 'ai_classifier'`; no extras / dupes; cross-family A∩I … H∩I all empty; declaration order matches upstream; `FAMILY_I_CLASSIFIER_SET_VERSION === 'family-i-v1'`; `FAMILY_I_PROMPT_ENTRIES` has 6 entries each with all required verbose fields; the 2 misreadable keys' `falsePositiveGuards` contain the verbatim §A.3.2 lines; `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` has exactly 15 entries.
- `mcp-server/tests/familyIKeysParity.test.ts` — **~14 tests.** Upstream `familyI.ts` has exactly 6 `source: 'ai_classifier'` declarations; exactly 8 `source: 'auto_metadata'`; exactly 7 `source: 'lifecycle'` (proves the 21-key mixed split); the 6 rawKey literals match `FAMILY_I_RAW_KEYS` verbatim; the 15 excluded literals match `FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS` verbatim and are all present upstream as auto_metadata/lifecycle; the included + excluded sets are disjoint and union to 21; the file header correctly claims "21 entries total".
- `mcp-server/tests/familyIPrompt.test.ts` — **~22 tests.** 7 absolute-rules block byte-equal to A–H; topology CRITICAL-DOCTRINE block present verbatim; `introduces_new_issue` + `returns_to_prior_issue` misreadable-key doctrine lines verbatim; user-prompt happy path; subset-of-keys path; empty-requestedRawKeys → all 6; rawKeys filter rejects non-I keys (incl. the 15 excluded deterministic keys → unsupported); banned-token negation check; `FAMILY_I_MAX_TOKENS === 1500`; `FAMILY_I_TEMPERATURE === 0`; `FAMILY_I_MAX_BODY_FIELD_LEN === 8000`; questions block includes all 6 rawKeys.
- `mcp-server/tests/familyIBanListScan.test.ts` — **~22 tests.** Each of the 5 single-word patterns detected; each of the 3 phrase patterns detected; each shared `DOCTRINE_BAN_PATTERNS` detected; near-miss assertions (`topical` does NOT match `off-topic`; `circle` alone does NOT match the phrase; `derailing` IS caught); null evidence_span skipped; `modelInfo.serverName` + `classifierSetVersion` scanned; `checkedRawKeys` NOT scanned; clean response passes; intentional-violation Fixture H detected with the correct path; `FAMILY_I_BAN_PATTERNS` exports `readonly RegExp[]` and is frozen.
- `mcp-server/tests/familyIAnthropic.test.ts` — **~11 tests.** Happy path; key_missing; HTTP 429; HTTP 500; TimeoutError; non-JSON; plain prose; API key never in success log; API key never in failure log; logs tagged `classify_argument_boolean_observations`; MAX_TOKENS=1500 confirmed in `callAnthropic` args. (Mirror H's 11 cases.)
- `mcp-server/tests/familyIAdversarialDoctrine.test.ts` — **~26 tests** (the D4 BINDING file). Each fixture A–G parseable; each request fixture passes `validateFamilyBooleanRequest`; **Fixture C input contains "dodging"/"changing the subject"/"evasive"/"off-topic" but expected response evidence_span does NOT** (boundary existential for `introduces_new_issue`); **Fixture D input contains "rehashing"/"going in circles" but output does NOT** (boundary existential for `returns_to_prior_issue`); Fixture G (no-topology) produces zero positives (no over-fire); I ban-list scan rejects each of the 8 D6 patterns; I ban-list scan rejects each shared banned token; clean topology evidence_span (anchoring the new topic / compared options / external reference without verdict framing) passes; `FAMILY_I_BAN_PATTERNS` contains all 8 D6 patterns; near-miss words NOT flagged; the 2 misreadable-key prompt-entry guards surface verbatim mention of the forbidden topology-verdict words; canonical Fixtures A + B produce NO verdict framing.

### New Edge Jest test file

- `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyI.test.ts` — **~8 tests.** Mirrors `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts` structurally with `FI-1` through `FI-8`:
  - FI-1: Family I entry exists in `EDGE_FAMILY_REGISTRY` (looks up by `'thread_topology'`).
  - FI-2: Family I entry has `productionEnabled: false` (admin_validation-only ship; Card 3 flips).
  - FI-3: Family I entry has `adminValidationEnabled: true`.
  - FI-4: `edgeProductionEnabledFamilies()` does NOT include `'thread_topology'`.
  - FI-5: `edgeAdminValidationEnabledFamilies()` includes `'thread_topology'`.
  - FI-6: `edgeFilterFamiliesForMode(['thread_topology'], 'production')` returns `[]`.
  - FI-7: `edgeFilterFamiliesForMode(['thread_topology'], 'admin_validation')` returns `['thread_topology']`.
  - FI-8: Family I is the 9th entry in `EDGE_FAMILY_REGISTRY` (A→J order preserved; index 8).

  Rationale: the existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` already covers I's posture indirectly (FR-7 every I/J `productionEnabled: false`; FR-28 absent from production list), but the explicit `…FamilyI.test.ts` provides the Card-3-flip baseline that Card 3 will mutate (`FI-2: productionEnabled: true (post Card 3 flip)` analog), and gives per-family ENTRY-EXISTS/INDEX/SHAPE invariants — symmetric with the present `…FamilyE.test.ts` + `…FamilyH.test.ts`.

### Modified files (mcp-server)

- `mcp-server/lib/familyRegistryInit.ts` — **+~10 lines net.** Add the import block (`FAMILY_I_RAW_KEYS`, `FAMILY_I_CLASSIFIER_SET_VERSION` from `./familyIKeys.ts`) + one `register('thread_topology', { rawKeys: new Set(FAMILY_I_RAW_KEYS), classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION })` call AFTER the H `register('claim_clarity', …)` block, with a comment documenting the MIXED-source subset posture + the 15-key exclusion + LOW doctrine-risk (mirror the G/H comment blocks at lines 129-168). **Exact insertion site: immediately after line 168 (closing `});` of the H register block), before line 169 (closing `}` of `initializeFamilyRegistry`).**
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — **+~14 lines net.** Add 3 imports (`runAnthropicFamilyIClassifier`, `loadFixtureFamilyIPacket`, `scanFamilyIBooleanResponseForBanList`) + `ValidatedFamilyIRequest` to the `FamilyProviders.anthropic` union type (after `ValidatedFamilyHRequest` at line 343) + one `if (family === 'thread_topology') { return { anthropic: …, fixture: …, banListScan: … }; }` block in `pickFamilyProviders` (after the `claim_clarity` block at lines 412-419). Also update the tool `description` string (line 166) to include I's coverage (the I family description: "Family I ships with the 6-key ai_classifier Subset (the 15 deterministic auto_metadata + lifecycle keys are excluded; requesting any of them returns unsupported_rawKey) covering thread-topology relations (introduces new issue, references prior agreement, introduces sub-axis, returns to prior issue, references external context, compares options) — these are DESCRIPTIVE STRUCTURE about how a move relates to the conversation graph, never adjudications; a new issue is not a derailment, returning to a prior issue is not repetition, comparing options is not picking a winner.") and update the unsupported note to "Family J returns an unsupported_family error envelope in this server build" (drop I from the unsupported set).
- `mcp-server/tests/familyRegistryInit.test.ts` — **+~3 tests.** `isFamilySupported('thread_topology')` true; `getSupportedFamilies()` returns the 9-family list in order; `thread_topology` has 6 rawKeys.
- `mcp-server/tests/familyRegistry.test.ts` — **+~3 tests.** 9-family order preserved; 9-way cross-family rejection; `getRawKeysForFamily('thread_topology')` = 6 keys.
- `mcp-server/tests/familyBooleanRequestSchema.test.ts` — **+~7 tests.** Valid I request passes; I subset request passes; I empty-requestedRawKeys passes (all 6); cross-family rejection (A–H rawKey under thread_topology → unsupported_rawKey); **cross-family rejection (a Family I EXCLUDED deterministic key, e.g. `has_reply` / `splits_thread` / `open`, under thread_topology → unsupported_rawKey** — the mixed-source exclusion boundary, mirror Family D's excluded-key test); cross-family rejection (an I ai_classifier rawKey under any A–H family → unsupported_rawKey); regression: A–H still pass.
- **Cross-family dispatch tests** (`familyBDispatch.test.ts` … and any sibling dispatch tests, `classifyArgumentBooleanObservations.test.ts`) — **retargeted** so the "unsupported family I (thread_topology)" test (currently at `familyBDispatch.test.ts:179-214`) is replaced by a "supported family I (thread_topology) returns isError=false (now registered)" test (mirror the existing "supported family G" test at `familyBDispatch.test.ts:216+` and the analogous H promotion), AND the remaining unsupported-family example switches to **Family J (`sensitive_composer`)**, AND the `supportedFamilies` envelope list grows from 8 → 9 (adding `thread_topology` after `claim_clarity`). **CAUTION:** the implementer MUST grep for the exact strings `'thread_topology'` and `'sensitive_composer'` (and the `supportedFamilies` 8-element array literal) across `mcp-server/tests/` to find ALL retarget sites; a careless retarget that drops a cross-family-leak-prevention assertion is a HALT #4 violation. This mirrors exactly the G→H retarget (H's #354/#400 work converted the "unsupported family H" test to "unsupported family I").

### Modified files (smoke)

- `scripts/mcp-server-001-smoke.sh` — **+~36 lines (2 checks).** Add `[24-compat-boolean-family-i]` (`/mcp/adapter-compat`, `requestedFamilies=['thread_topology']`, assert `family-i-v1` in response) + `[25-mcp-tools-call-boolean-family-i]` (`/mcp` tools/call, assert `family-i-v1` + `isError:false`). **Update the header tally comments (23 → 25)** at lines 4 + 31 (the "23 checks" / "all 23 checks passed" comments) and increment any check-count bound. Mirror Checks 22+23 exactly, swapping the request body to a benign thread-topology move (the Fixture A canonical-met body, or a custom benign body exhibiting `introduces_new_issue` + `compares_options`). The I check's `requestedRawKeys` should explicitly include the 2 misreadable keys (`introduces_new_issue`, `returns_to_prior_issue`) so the smoke exercises the boundary path. **D13 RESOLVED — check IDs: `24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i`.** (The brief D13 suggested generic `compat-boolean-family-i` / `mcp-tools-call-boolean-family-i` IDs; the numbered form follows the smoke script's existing `N-compat-boolean-family-X` convention — 24/25 are the next free numbers after H's 22/23.)

### NOT modified (verify byte-equal — HALT 4 + HALT 5)

- `mcp-server/lib/family{A,B,C,D,E,F,G,H}*.ts` — **byte-equal** (HALT 4). Every A–H family file (keys, prompt, anthropic, banListScan, fixtureProvider) MUST remain unchanged. Phase 6 runs `git diff --stat origin/main -- mcp-server/lib/familyA*.ts … familyH*.ts` and expects 0 changes.
- `mcp-server/lib/doctrineBanList.ts` — **byte-equal** (HALT 5). I adds its own scan; the shared list does NOT receive `off-topic`/`derailing`/`rehashing`/etc.
- `mcp-server/lib/seedPrompt.ts`, `mcp-server/lib/anthropicCall.ts`, `mcp-server/lib/providerConcurrency.ts` (MCP cap=5 semaphore), `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — **byte-equal** (HALT 5).
- `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — **byte-equal** (I entry already `{productionEnabled:false, adminValidationEnabled:true}` at **lines 109-113**; D7 pre-satisfied; Card 3 flips it). HALT 13.
- `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts` — **byte-equal in THIS card** (NO `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `thread_topology`; see §D2 resolution — deferred to a separate Edge-subset card / Card 3). HALT 14.
- `src/**` — **byte-equal** (upstream `familyI.ts` is the source-of-truth READ; header already correct; no surfacing to operator).
- `scripts/ops/audit-lint-rules.cjs` — **byte-equal** (adding `family_i` to `DOCTRINE_RISK_FAMILIES` is **Card 2**, which is SKIPPABLE given LOW doctrine-risk; D11).
- `package.json` / `package-lock.json` — **byte-equal** (no new deps; Deno imports via URL). HALT 5.
- `supabase/migrations/**` — **byte-equal** (no migration). HALT 4.
- `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` — **byte-equal** (already asserts I `productionEnabled:false`, `adminValidationEnabled:true` via FR-7 + FR-28). The new `…FamilyI.test.ts` is the additive parallel file. HALT 5.

---

## API / interface contracts

```ts
// familyIKeys.ts
export const FAMILY_I_RAW_KEYS: readonly string[];                       // 6 ai_classifier rawKeys, frozen, declaration order
export const FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS: readonly string[]; // 15 (8 auto_metadata + 7 lifecycle), frozen
export const FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1';

export interface FamilyIPromptEntry {
  readonly rawKey: string;
  readonly label: string;
  readonly booleanQuestion: string;
  readonly positiveDefinition: string;
  readonly negativeDefinition: string;
  readonly positiveExample: string;
  readonly negativeExample: string;
  readonly falsePositiveGuards: string;  // 2 misreadable keys carry the §A.3.2 verbatim doctrine lines
}
export const FAMILY_I_PROMPT_ENTRIES: readonly FamilyIPromptEntry[];     // 6 entries

// familyIPrompt.ts
export const FAMILY_I_SYSTEM_PROMPT: string;     // 7 absolute rules byte-equal + topology-doctrine block
export const FAMILY_I_MAX_TOKENS = 1500;
export const FAMILY_I_TEMPERATURE = 0;
export const FAMILY_I_MAX_BODY_FIELD_LEN = 8000;
export interface ValidatedFamilyIRequest {       // structural mirror of ValidatedFamilyHRequest
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
export function buildFamilyIUserPrompt(request: ValidatedFamilyIRequest): string;

// familyIAnthropic.ts
export function runAnthropicFamilyIClassifier(
  request: ValidatedFamilyIRequest,
  requestId: string,
  fetchImpl?: typeof fetch,
): Promise<AnthropicCallResult>;

// familyIBanListScan.ts
export const FAMILY_I_BAN_PATTERNS: readonly RegExp[];   // 8 D6 topology-verdict patterns (5 single + 3 phrase)
export type FamilyIBanListScanResult = { ok: true } | { ok: false; path: string };
export function scanFamilyIBooleanResponseForBanList(
  response: McpBooleanObservationValidatedResponse,
): FamilyIBanListScanResult;

// familyIFixtureProvider.ts
export type FamilyIFixtureResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'fixture_load_failed' };
export function loadFixtureFamilyIPacket(): Promise<FamilyIFixtureResult>;

// familyRegistryInit.ts — added inside initializeFamilyRegistry() AFTER the H register block (after line 168)
register('thread_topology', {
  rawKeys: new Set(FAMILY_I_RAW_KEYS),
  classifierSetVersion: FAMILY_I_CLASSIFIER_SET_VERSION,
});
```

`pickFamilyProviders` addition (in `classifyArgumentBooleanObservations.ts`, after the `'claim_clarity'` block at lines 412-419):

```ts
if (family === 'thread_topology') {
  return {
    anthropic: (req, requestId) =>
      runAnthropicFamilyIClassifier(req as ValidatedFamilyIRequest, requestId),
    fixture: loadFixtureFamilyIPacket,
    banListScan: scanFamilyIBooleanResponseForBanList,
  };
}
```

`FamilyProviders.anthropic` union extension (line 343):

```ts
      | ValidatedFamilyHRequest
      | ValidatedFamilyIRequest,  // ← new
```

---

## Edge cases

- **Empty `requestedRawKeys`** → `buildFamilyIUserPrompt` includes all 6 I keys (mirror H's empty-array → all-12 behavior).
- **Requested rawKey is one of the 15 EXCLUDED deterministic keys** (`has_reply`, `splits_thread`, `open`, `ignored_by_both`, etc.) under `requestedFamilies=['thread_topology']` → `validateFamilyBooleanRequest` rejects with `unsupported_rawKey` at the registry boundary (the keys are NOT in `FAMILY_I_RAW_KEYS`, so the registry never knows them as I keys). **No silent-false conversion.** This is the mixed-source exclusion boundary; the dedicated `familyBooleanRequestSchema.test.ts` case asserts it (mirror Family D's excluded-key test). HALT 14.
- **Requested rawKey is a cross-family A–H key** → `unsupported_rawKey` at the registry boundary. Test asserts for representative A–H keys.
- **Move text contains motive-verdict words** ("you keep dodging", "off-topic", "rehashing", "going in circles") → the model may detect the topology relation but the OUTPUT evidence_span must NOT echo the verdict words; the I ban-list scan is the runtime backstop (rejects the packet → `validation_failed` → Edge falls back to deterministic layer). Fixtures C + D + the Phase 4b smoke verify this live.
- **Anthropic returns non-JSON / prose / HTTP 429 / 500 / TimeoutError / missing key** → `runAnthropicFamilyIClassifier` returns the typed `AnthropicCallResult` error envelope; the tool handler returns an `isError` envelope (never a partial/fake packet); the Edge Function falls back to the deterministic layer. Tested in `familyIAnthropic.test.ts`.
- **Fixture provider load failure** (`MCP_SERVER_USE_FIXTURE_PROVIDER=true` but file missing/malformed) → `{ ok: false, reason: 'fixture_load_failed' }`; treated as key-missing-style fallback. Tested.
- **All-negative move (no topology relation)** → all 6 keys FALSE; the conservative-positives bias is the design intent (Fixture G). The classifier must NOT over-fire on every move; most moves stay on the parent's topic and exhibit zero topology positives.
- **Concurrent edits / offline / network failure** — N/A at this layer (the MCP server is a stateless classifier; admin_validation is an explicit operator-triggered POST). The Edge Function's existing retry/fallback handles transient network failure.
- **Permission-denied** — admin_validation is gated by the Edge Function's existing admin/moderator JWT check; I inherits it (no change). Production is not enabled for I (Card 3), so no production permission surface exists yet.
- **Doctrine-constraint edge: does heat / popularity influence I?** — No. I classifies move text + parent context + thread-context excerpt; it has no access to engagement metrics, view counts, or heat. The `references_external_context` key explicitly does NOT treat an external reference as granting factual standing (cdiscourse-doctrine §3 boundary preserved).
- **Doctrine-constraint edge: does an `introduces_new_issue` positive lower the move author's standing?** — No. I is descriptive (advisory metadata). A new issue / sub-axis / return is a SHAPE in the conversation graph, not a standing penalty. I emits no standing delta. The `point-standing-economy` note in `familyI.ts` says moved-on / ignored states (which are the EXCLUDED lifecycle keys, not the ai_classifier keys) affect scoring eligibility — and even those are out of scope for this card.
- **Doctrine-constraint edge: what if the strength band tries to read a topology positive as a verdict?** — It does not. I emits only the boolean observation + a structural evidence_span; the strength band / standing layer is wired elsewhere and is NOT touched by this card.

---

## Test plan

Per `test-discipline`: tests are part of "done"; the count goes UP; no `.skip`/`.only`; the count cited at completion must come from a captured `ok | N passed | 0 failed` (Deno) / `Tests: Y passed` (Jest) line with the explicit exit code.

**Deno test files (mcp-server):** the 6 new files carry **~111 new Deno tests** (binding forecast; see below). **Updated Deno test files:** `familyRegistryInit.test.ts` (+3), `familyRegistry.test.ts` (+3), `familyBooleanRequestSchema.test.ts` (+7), cross-family dispatch tests **retargeted** (the "unsupported family I" test becomes "supported family I" + a new unsupported example for Family J; assertion count roughly net-neutral or +1).

**New Edge Jest test file:** `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyI.test.ts` — **+8 Jest tests** (FI-1 … FI-8).

**Doctrine ban-list assertions (mandatory — the card touches verdict-adjacent strings):**
- `familyIPrompt.test.ts` scans the system prompt for bare banned tokens (absent outside doctrine-positive negations).
- `familyIBanListScan.test.ts` asserts every shared + every I-specific topology-verdict token is rejected in evidence_span / serverName / classifierSetVersion; near-miss behavior recorded.
- `familyIAdversarialDoctrine.test.ts` is the binding-fixture verifier (Fixtures C + D boundary existentials).

**Existing tests that MUST stay green (no change):** `__tests__/mcpOneTwoOneCEdgeFamilyRegistry.test.ts` (already asserts I admin-only via FR-7 + FR-28); all A–H family tests. The cross-family retarget changes the unsupported-set string but preserves envelope shape + leak-prevention assertions.

### Test forecast — **D12 / §6 RESOLVED: +111 Deno + +8 Jest = +119 net (binding)**

Grounding: Family H shipped **139 Deno** declarations across its 6 test files (verified: familyHKeys 17 + familyHKeysParity 13 + familyHPrompt 25 + familyHBanListScan 35 + familyHAnthropic 11 + familyHAdversarialDoctrine 38 = 139). I has **6 ai_classifier keys vs H's 12** (~50% the per-key surface) and **LOW doctrine-risk vs H's YES** (2 boundary fixtures vs H's 4 HIGHEST-risk), so every file scales down. The mixed-source exclusion list ADDS a few parity tests (vs H which had none), partially offsetting.

Per-file Deno breakdown (binding forecast):
- `familyIKeys.test.ts`: ~16 (H: 17; lighter — 6 keys, but + the excluded-list assertions)
- `familyIKeysParity.test.ts`: ~14 (H: 13; slightly heavier — must assert the 6/8/7 split + the 15-key exclusion disjointness)
- `familyIPrompt.test.ts`: ~22 (H: 25; lighter — 6 keys, 2 misreadable-key guards vs H's 4 HIGHEST-risk)
- `familyIBanListScan.test.ts`: ~22 (H: 35; lighter — 8 patterns vs H's 17)
- `familyIAnthropic.test.ts`: ~11 (H: 11; same — structural mirror)
- `familyIAdversarialDoctrine.test.ts`: ~26 (H: 38; lighter — 2 boundary fixtures + 1 all-negative vs H's 4 HIGHEST-risk + supplementary)

**Deno total: ~111.** At the top edge of the brief's §6 band of **+60 to +110 Deno** (the +1 over 110 is acceptable drift; the implementer's actual delta may land 105–115). Well below the **+250 HALT 8 ceiling.**

Jest total: **+8** (the new `…FamilyI.test.ts`; within the brief's §6 band of +6 to +10).

**Total: ~111 Deno + ~8 Jest = ~119 net (binding number).** The actual reported delta may drift ±5 each side; the binding ceiling is HALT 8 (+250 Deno OR +12 Jest). **HALT 8 NOT FIRED at this forecast.**

---

## A.5 — 8-phase smoke plan + D10/D13 forward-safety language

**Audit doc:** `docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-<date>.md` (`Audit-Lint: v1`; self-lints clean). Post-merge, operator-run. Mirrors the H smoke template, **with Phase 4b at NORMAL intensity** (doctrine-risk LOW; not the existential-FAIL intensity H's was).

1. **Phase 1 — Pre-flight.** `main` at the merge SHA; working tree clean; Edge auto-deploy confirmed; I Edge registry posture verified byte-equal (`{ family: 'thread_topology', productionEnabled: false, adminValidationEnabled: true }` at familyRegistry.ts:109-113); NOT touched by this card.
2. **Phase 2 — Local Deno regression.** `cd mcp-server && deno test --allow-net --allow-env --allow-read` → baseline + I suite; capture the `ok | N passed | 0 failed` line + the delta vs the H baseline (expected delta: +~111 Deno).
3. **Phase 3 — Hosted MCP smoke (25 checks; operator token).** `MCP_HOSTED_TOKEN=<redacted> bash scripts/mcp-server-001-smoke.sh https://cdiscourse-mcp-server.civildiscourse.deno.net` → expect `25 PASSES, 0 FAILS`, EXIT 0. Checks 24+25 prove the **deployed Deno build** serves Family I end-to-end (the GATE-C deploy-bearing verification — see §Deploy). **NOT-RUN caps verdict at PARTIAL.**
4. **Phase 4 — Edge admin_validation (Family I; ≥3 seeded args).** `POST /functions/v1/classify-argument-boolean-observations` with admin JWT, `requestedFamilies:['thread_topology']`, `mode:'admin_validation'` → HTTP 200; positives in the 6-key set; no cross-family leak; the 15 excluded deterministic keys never appear. **PRE-CHECK the Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` gap (R1):** if Family I is requested through the MCP path WITHOUT the Edge subset entry, the Edge will send all 21 registry rawKeys → the MCP server rejects the 15 deterministic keys with `unsupported_rawKey` → `mcp_validation_failed`. **This Phase 4 step is the live confirmation of the §D2 decision** — if the operator chose to defer the Edge entry (recommended), Phase 4 documents that admin_validation Family I through the MCP path is GATED on the follow-up Edge-subset card (exactly as Family G's #355 was). See §Risks (mixed-source Edge gap).
5. **Phase 4b — DOCTRINE (NORMAL intensity; LOW doctrine-risk).** Submit the boundary fixtures (C, D; each carries motive-verdict-baiting input) via `submit-argument` (fires the production A–H auto-trigger as a documented side effect — NOT I, admin-only); POST admin_validation `requestedFamilies:['thread_topology']` on the new argument_ids; **PRE-CHECK column names (R1)**; for each I positive, the persisted **`evidence_span`** MUST NOT contain any of the 8 D6 topology-verdict tokens (off-topic / derailing / evasive / rehashing / repetitive / "going in circles" / "changing the subject" / "beating a dead horse") NOR any shared banned token. **Firing-count resolution: ≥1 firing all clean → PASS; 0 firings → PARTIAL; ≥1 dirty → FAIL (HALT + revert).** Because doctrine-risk is LOW, a 0-fire is expected to be common (topology positives are sparse) and is an unremarkable PARTIAL.
6. **Phase 5 — Unsupported J rejection regression.** Verified at the dispatch-test layer (post-card unsupported set `{J}` only — I removed; envelope shape preserved). Live Edge POST of J (`sensitive_composer`) → HTTP 200, `failed`, `mcp_validation_failed`, zero positives — operator-deferred to the amendment (mirror G/H Phase 5).
7. **Phase 6 — Targeted Jest + Deno regression.** `npx jest --testPathPattern="[Ff]amily.*[Ii]|thread.topology" --no-coverage`; full `npx jest --no-coverage`; `cd mcp-server && deno test …`; `npm run typecheck`; `npm run lint`. Cross-family byte-equal verification (`family{A-H}*.ts`, `doctrineBanList.ts`, `seedPrompt.ts`, `anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts`, `src/`, `supabase/` (incl. `familyRegistry.ts` + `booleanObservationRequestBuilder.ts`), `package.json`, `audit-lint-rules.cjs` — all 0 diff). HALT 4 + HALT 5 + HALT 14 guards.
8. **Phase 7 — OPS observations + ENFORCEMENT-LOOP PROVENANCE.** CI run ID + in_scope count + linter exit for I's smoke PR. Plus the 9-family operational state table (A–H production [or A–G + H-in-flight]; **I admin_validation new**; J unsupported). Latency: note the 9-family projection but state I's per-family duration is measured in **Card 3** (I not production yet); reference the bounded-concurrency parallelization (limit 2) + #365 burst hazard.
9. **Phase 8 — Verdict + authorization.** Final verdict + **Gate A** authorization. **Gate A records the doctrine-risk determination = LOW, which AUTHORIZES the Card-2 SKIP (2-card chain).** Pre-push: `node scripts/ops/audit-lint.mjs docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-<date>.md` exit 0.

**Verdict rules:** PASS = Phase 3 25/25 (or NOT-RUN → PARTIAL cap) + Phase 4 valid + Phase 4b ≥1 clean firing (or 0-fire PARTIAL) + Phase 5 J reject + Phase 6 clean + Phase 7 provenance present + pre-lint/CI exit 0. PARTIAL = Phase 3 NOT-RUN, OR Phase 4b 0-fire, OR the Edge subset gap blocks Phase 4 live (D2-deferred). FAIL = Phase 4b dirty firing, OR non-I rawKey leak, OR prior-family byte-equal failure.

### D10 — FORWARD-SAFETY `evidence_span` LANGUAGE (included as a precaution, NOT mandatory because LOW)

**D10 RESOLVED.** Because doctrine-risk = LOW, the audit-lint L5 consistent-PARTIAL discipline is **NOT mechanically binding** on this card (Card 2, which would add `family_i` to `DOCTRINE_RISK_FAMILIES`, is SKIPPABLE). **However**, the smoke template **DOES include the Phase 4b `evidence_span` inspection language as a forward-safety precaution** — if the operator later reverses the Card-2 SKIP and adds `family_i` to the doctrine-risk set, this card's already-merged smoke audit will NOT retroactively fail L5. The cost of including the language is zero; the cost of omitting it (if the SKIP is reversed) is a retroactive lint failure. **Recommendation: include the `evidence_span` language.** The binding sentence (mirror the H template):

> "Phase 4b (NORMAL intensity per LOW doctrine-risk verdict; optional per audit-lint-rules.cjs `family-ship` set) is operator-run — the live thread-topology **`evidence_span`** inspection (persisted `argument_machine_observation_results.evidence_span` rows queried for topology-verdict tokens) is the descriptive-clean verification; per firing-count asymmetry, NOT-RUN / 0-fire behaves as PARTIAL for verdict-capping. This language is retained as forward-safety should `family_i` later be added to `DOCTRINE_RISK_FAMILIES`."

---

## A.6 — Smoke template (the audit skeleton the operator authors)

`docs/audits/MCP-SERVER-010-FAMILY-I-SMOKE-template.md` carries the `Audit-Lint: v1` marker at the top, the 8-phase skeleton (Phase 1 → Phase 8), the verdict-rules paragraph, the D10 forward-safety `evidence_span` language for Phase 4b, and the required-final-step instruction `Run \`node scripts/ops/audit-lint.mjs <doc>\` and assert exit 0 before publishing`. The implementer writes the template skeleton (not the live audit — that's the operator post-merge).

---

## Deploy steps — **GATE-C deploy-bearing context (BINDING)**

**The mcp-server deploys to Deno Deploy (GitHub integration `deploy/civildiscourse/cdiscourse-mcp-server`), NOT a Supabase Edge function.** This card's mcp-server boolean/prompt changes (the new Family-I classifier + the `register('thread_topology', …)` call + the dispatcher provider block + the tool description) are **deploy-bearing GATE-C**: the new Family-I booleans are NOT served by the hosted server until the **Deno redeploy** completes. The merge-to-`main` triggers the Deno Deploy integration automatically; the smoke Phase 3 (hosted `*.deno.net` Checks 24+25) is the verification that the redeploy landed and serves `family-i-v1` end-to-end. **Until Phase 3 passes 25/25 on the hosted URL, Family I is not live on the server** — Phase 2 (local Deno) and Jest pass without the redeploy, so they are necessary but NOT sufficient.

**Edge merge=deploy status of THIS card:** **NOT Edge-bearing.** Per the §D2 resolution, this card does NOT touch `booleanObservationRequestBuilder.ts` (the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry is deferred). The Edge `familyRegistry.ts` I entry is byte-equal (Card 3 flips it). Therefore this card is **mcp-server-deploy-bearing (Deno) only, NOT Edge-deploy-bearing.** The Supabase GitHub integration will auto-redeploy the Edge Functions on merge, but no Edge behavior changes (I is already admin-enabled in the registry; the subset filter is absent, so admin_validation Family I through the MCP path is GATED on the follow-up Edge-subset card — see §Risks).

**Operator deploy commands:** **None for code deploy** — both the mcp-server (Deno Deploy) and the Edge Functions (Supabase GitHub integration) auto-deploy on merge to `main`. **No `npx supabase db push`** (no migration). **No `npx supabase functions deploy`** (auto). **No env var change.**

---

## Dependencies (cards / docs / files)

- **Assumes Families A–H are complete** because the dispatcher's `FamilyProviders.anthropic` union, the `pickFamilyProviders` chain, the smoke Checks 1–23, the cross-family byte-equal verification, and the existing `mcpOneTwoOneCEdgeFamilyRegistry.test.ts` all depend on A–H being present + stable. (Verified: A–H registered at `main` `f1b55a3`; H chain #400/#403/#404 merged.)
- **Reads upstream `src/features/nodeLabels/machineObservationDefinitions/familyI.ts`** at `FAMILY_I_DEFINITIONS` — the 6 ai_classifier entries (booleanQuestion + positive/negative definitions + examples + falsePositiveGuards + doctrineNotes) are the binding source for `familyIKeys.ts`; the 15 deterministic entries are the binding source for the exclusion list.
- **Reads `mcp-server/lib/familyD*.ts` + `familyG*.ts`** as the MIXED-SOURCE structural pattern (the `_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant + the subset rationale); **reads `familyH*.ts`** as the most-recent structural mirror (keys/prompt/anthropic/banListScan/fixtureProvider).
- **Reads `mcp-server/lib/familyRegistryInit.ts`** (lines 165-168 H register block — insertion site after) + `mcp-server/tools/classifyArgumentBooleanObservations.ts` (lines 333-421 provider wiring) as the register() + provider-wiring mechanism.
- **Reads `supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts`** (lines 68-78 `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`) to resolve the §D2 boundary.
- **Reads `__tests__/mcpOneTwoOneCEdgeFamilyRegistryFamilyH.test.ts`** as the structural template for the new `…FamilyI.test.ts` (FI-1 … FI-8 mirror FH-1 … FH-8, swapping `claim_clarity` → `thread_topology`).
- **Reads `scripts/ops/audit-lint-rules.cjs`** (lines 55-90 `DOCTRINE_RISK_FAMILIES`; line 253 `L5_PERSISTED_INSPECTION_PATTERNS`) to confirm `family_i` is NOT currently in the doctrine-risk set (Card 2 would add it; SKIPPABLE).
- **Blocks Gate A** — Gate A records the doctrine-risk determination (LOW), which authorizes the **Card-2 SKIP** (2-card chain).
- **Blocks Card 3** (`MCP-021C-EDGE-FAMILY-I-ENABLE`, #394) — Card 3 flips Edge `familyRegistry.ts:111` `productionEnabled: false → true`, adds the `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry (if not done in a separate Edge-subset card first), and re-measures the 9-family latency. Card 3 depends on this card's admin_validation infrastructure + the Edge-subset entry being in place.
- **The Edge-subset entry** (`MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = {ai_classifier}`) is a **separate dependency** — recommended as a small Edge-subset follow-up card (mirror `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` #355) OR folded into Card 3. It is NOT in this card (§D2).

---

## Risks

- **Mixed-source Edge gap (the live-only hazard; §D2 + R1).** If Family I flows through the MCP path during admin_validation WITHOUT the Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` entry, the Edge `booleanObservationRequestBuilder` sends ALL 21 registry rawKeys (8 auto_metadata + 7 lifecycle + 6 ai_classifier) to the MCP server, which rejects the 15 deterministic keys with `unsupported_rawKey` → **`mcp_validation_failed`**. **This is a live-only gap — Deno tests + Jest pass without the Edge entry** (they exercise the MCP server in isolation with only the 6 keys). The §D2 resolution (defer the Edge entry to a separate card / Card 3) means admin_validation Family I through the MCP path is **GATED on that follow-up** — exactly as Family G's admin_validation was gated on #355 (the "Card 1A Edge subset fix verified live" in the G smoke #356). The smoke Phase 4 documents this gate. **The implementer must NOT silently add the Edge entry to this card to "fix" Phase 4** — that would make the card Edge-bearing (merge=deploy) and contradict the D2 scoping; if the operator wants Phase 4 live in this card, that is a GATE-A decision to broaden scope (see §GATE-A verdict).
- **`provider_server_error` bucketing (Family H/I live hazard).** The classifier-queue Edge adapter buckets all MCP `{isError}` responses under `provider_server_error`; the real reason (e.g., a masked packet-shape residual, or the `mcp_validation_failed` above) lives in `failure_detail` / the R3 Deno log. If the I smoke shows `provider_server_error`, the implementer/operator must read `failure_detail` to disambiguate — do NOT assume it's a server crash. (Recorded twice on the H/G chain: #418, 9ef5aab5.)
- **`mcp_validation_failed` under burst concurrency (#365 — the SECOND cause).** Distinct from the input-subset gap above: a downstream result-validation failure that is intermittent (~4–8s, load-correlated) under concurrency >2. The auto-trigger is now bounded-parallel (limit 2; p95 34.6s→19.3s). I is admin-only in this card (not in the production auto-trigger), so this burst hazard is **Card-3 territory** (when I joins the 9-family production auto-trigger) — but the smoke risk section must note it because Card 3's latency re-measure will hit it.
- **The 2 misreadable keys (`introduces_new_issue` + `returns_to_prior_issue`).** These are the only keys with any verdict-misreading surface (off-topic / rehashing). If the per-key guard or the 8-pattern ban-list misses a path, the Phase 4b live smoke (Fixtures C + D) is the backstop. Because doctrine-risk is LOW, a dirty firing here is still a HALT + revert, but the prior is much lower than H's `claim_specificity_low` existential.
- **Mixed-source exclusion-boundary test (the must-not-drop case).** The `familyBooleanRequestSchema.test.ts` MUST include a case asserting that an EXCLUDED deterministic key (e.g., `has_reply`, `splits_thread`, `open`) under `requestedFamilies=['thread_topology']` returns `unsupported_rawKey` (no silent-false). This is the Family-D-precedent guard against the 15 deterministic keys leaking into the MCP classifier scope. Dropping it is a HALT 14 violation.
- **Cross-family dispatch test retarget.** The dispatch tests currently assert the unsupported set includes `thread_topology` (`familyBDispatch.test.ts:179-214`). Retargeting (I → supported; J as the new unsupported example; supportedFamilies 8 → 9) must preserve the envelope shape + cross-family-leak prevention assertions. The implementer must grep for `'thread_topology'` + `'sensitive_composer'` + the 8-element `supportedFamilies` array literal across `mcp-server/tests/` to find ALL sites. (HALT #4.)
- **Boundary regex near-miss assertions.** The I ban-list patterns use the same boundary form as F/G/H. The implementer must explicitly test: `topical` does NOT match `off-topic`; `circle` alone does NOT match "going in circles"; `derailing` IS caught (via the second `derail` pattern or a `derail\w*` form — the implementer picks the binding form and records it). A benign descriptive evidence_span ("the move opens a new topic about museum funding") must pass clean.
- **Test-count drift past the §6 band.** The ~111 Deno forecast lands at the top edge of the brief's +60..+110 band. If the implementer's adversarial-doctrine file grows (more fixtures), the delta could exceed 110 — that is acceptable drift (the HALT-8 ceiling is +250); but if it approaches +150 the implementer should re-confirm scope.
- **Deno redeploy lag (GATE-C).** Local Deno + Jest pass without the hosted redeploy. The card is NOT "done on the server" until Phase 3 (hosted 25/25) confirms the Deno Deploy integration served `family-i-v1`. A green local run + green CI is necessary but NOT sufficient for the ship verdict.
- **Migration / operator deploy.** None. Edge Functions + MCP server auto-deploy on merge. No `db push`.

---

## Out of scope

- Family J (`sensitive_composer`) registration (this card ships ONLY I).
- Production flip (Card 3); any `productionEnabled` change for I or any family.
- The Edge `booleanObservationRequestBuilder.ts` `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` entry (deferred to a separate Edge-subset card / Card 3 per the G #354 → #355 precedent; §D2).
- The 8 `auto_metadata` keys + 7 `lifecycle` keys (the 15 deterministic Family-I keys) — system/cluster-derived elsewhere (`threadTopologyAutoMetadata.ts` stubs; future MCP-021C); NOT LLM-classified; NOT in the MCP classifier path (D3).
- Editing the shared `mcp-server/lib/doctrineBanList.ts` (I adds its own `FAMILY_I_BAN_PATTERNS` scan; HALT 5).
- Family A–H lib changes (`familyA*.ts` … `familyH*.ts` byte-equal; HALT 4).
- The Edge `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (I entry already correct at lines 109-113; byte-equal; HALT 13).
- Adding `family_i` / `thread_topology` to `DOCTRINE_RISK_FAMILIES` in `audit-lint-rules.cjs` (that is **Card 2** — SKIPPABLE given LOW doctrine-risk; D11).
- Correcting any upstream `familyI.ts` taxonomy text (the upstream header is already accurate; no `src/`-touching obligation).
- MCP schema version bump; token bump without Stage 2B; dispatcher hard-coding (provider selection is registry-gated + the additive I block only); other family prompts.
- Wiring I into the point-standing economy / strength bands (I emits advisory metadata only; no scoring wire-up in this card).
- A live latency measurement for I (deferred to Card 3 — I is not production-enabled here).
- A live Anthropic call by Claude during design or implementation (operator-gated only; the dry/fixture path covers test coverage; cdiscourse-doctrine §7).

---

## HALT trigger table (binding) — **§7 RESOLVED**

Per intent §7, mirroring H's 24-trigger table (1-13 same shape) + the brief's **HALT 14** (the mixed-source Edge-subset guard, re-scoped at #14 for the D2 deferral):

| # | Trigger | Why |
| --- | --- | --- |
| 1 | Required reading missing | Skill / doctrine docs / Family H + D design / intent brief / familyI.ts source not consumed before design starts. |
| 2 | Standard preflight not green | `npm run typecheck` / `npm run lint` / `npm run test` / `cd mcp-server && deno test` not all 0-exit on origin/main. |
| 3 | A.1 finds I source-split is NOT the 6/8/7 mix | Reality audit confirmed 6 ai_classifier + 8 auto_metadata + 7 lifecycle. If implementation discovers a different split, HALT and revisit. |
| 4 | A–H family files modified (byte-equal violation) | `mcp-server/lib/familyA*.ts` through `familyH*.ts` MUST be byte-equal. `git diff` non-empty = HALT. Includes the cross-family dispatch-test retarget dropping a leak-prevention assertion. |
| 5 | Protected surface modified | `seedPrompt.ts`, `anthropicCall.ts`, `providerConcurrency.ts`, `mcpBooleanObservationSchemaMirror.ts`, shared `doctrineBanList.ts`, `supabase/functions/_shared/booleanObservations/familyRegistry.ts`, `supabase/migrations/`, `package.json`, `src/features/nodeLabels/**`, `mcpOneTwoOneCEdgeFamilyRegistry.test.ts`. |
| 6 | roadmap-reviewer returns BLOCK | Any reviewer issue not resolved before PR open. |
| 7 | Any adversarial Explore finds blocking refutation | Verdict-leak hunt / cross-family key collision / ban-list completeness / mixed-source exclusion-boundary Explore returns FAIL. |
| 8 | Test delta out of bounds | Deno > +250 net OR Jest > +12 net. Current forecast ~111 Deno + ~8 Jest is well within bounds. |
| 9 | Cross-family rawKey collision found | A∩I / B∩I / … / H∩I any non-empty intersection. |
| 10 | `FAMILY_I_MAX_TOKENS` bump above 2000 without explicit operator approval | Stage 2B T4 axis. Designer forecast: no bump needed (6 keys, ~990 headroom). |
| 11 | Smoke template lacks `Audit-Lint: v1` marker or required-final-step | The template MUST carry both. |
| 12 | Smoke template Phase 4b doctrine `evidence_span` forward-safety language absent | D10: LOW doctrine-risk means NOT mechanically binding, BUT the language is retained as forward-safety; omitting it risks a retroactive L5 failure IF the Card-2 SKIP is later reversed. Include it. |
| 13 | Edge `familyRegistry.ts` I entry changed | This card is admin-only; the I entry already exists at lines 109-113 byte-equal. Card 3 owns the flip. |
| 14 | **HALT 14 (the brief's mixed-source guard, re-scoped).** `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry for `thread_topology` ADDED in this card (when D2 deferred it), OR — if the operator broadens scope to include it — the entry includes non-ai_classifier source keys (must be the 6-key ai_classifier subset only: `Set(['ai_classifier'])`). | The DEFAULT (D2-deferred) means the entry MUST be ABSENT from this card; the byte-equal check on `booleanObservationRequestBuilder.ts` guards it. IF the operator broadens scope (makes the card Edge-bearing), the entry MUST be exactly `Object.freeze(new Set(['ai_classifier']))` keyed on `thread_topology` — never the full registry, never a deterministic source. |
| 15 | Stage 2B REQUIRED but operator approval missing when implementer starts | T1 fires → the 6-key subset + 15-key exclusion boundary MUST be operator-ratified before the implementer's first slice commit. |
| 16 | Upstream count drift discovered late | If `familyI.ts` actually has ≠6 ai_classifier (or ≠15 deterministic) entries when the implementer reads it, HALT. (Designer verified 6/8/7 at this point; the parity test enforces.) |
| 17 | Dispatcher architecture-core violation | The dispatcher must stay registry-derived for routing; provider selection is the standard per-family additive `if (family === 'thread_topology')` block. A rewrite abandoning the additive pattern = HALT. |
| 18 | Prompt header frames topology as a motive/quality verdict | A.3.1 header block must contain "DESCRIPTIVE STRUCTURE" not "off-topic/derailing/evasive" framing. Test asserts. |
| 19 | I ban-list missing any of the 8 D6 patterns | `FAMILY_I_BAN_PATTERNS` must have all 8 from §A.3.3. Test asserts count + each pattern's presence. |
| 20 | Phase 4b smoke shows ≥1 dirty firing (a persisted I `evidence_span` contains a forbidden topology-verdict token) | Existential FAIL → HALT + revert. The 2 boundary fixtures + the ban-list scanner exist to prevent this. |
| 21 | Phase 4b smoke shows 0 firings on ALL I keys | PARTIAL (not FAIL); 0-fire is operator-deferrable and EXPECTED to be common (topology positives sparse). |
| 22 | Boundary fixture C or D missing or wrong shape | The 2 boundary existential fixtures are mandatory; each MUST contain the motive-verdict word(s) in the INPUT and the doctrine-clean evidence_span in the EXPECTED response. |
| 23 | Smoke script Check 24 or 25 ID wrong / classifierSetVersion assertion missing | D13: check IDs `24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i`; both MUST assert `"family-i-v1"` substring. |
| 24 | Local pre-lint `node scripts/ops/audit-lint.mjs <audit>` returns non-zero before push | The smoke audit MUST self-lint clean before publishing. |

> The brief §7 said "1-13 same shape as H + HALT 14". This table preserves H's 24-trigger structure and lands the brief's **HALT 14** (mixed-source Edge-subset) at trigger #14, re-scoped for the D2 deferral. #3/#16 are adjusted for the 6/8/7 split; #18-#19-#22 are scaled to I's 2 misreadable keys + 8-pattern ban-list.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting; gameplay not truth).** I's classifier emits descriptive thread-topology relations, never a verdict. The 5-layer defense (header doctrine block + 2 misreadable-key guards + 8-pattern I ban-list + 2 boundary adversarial fixtures + Phase 4b live smoke) forbids off-topic / derailing / evasive / rehashing / repetitive / "going in circles" / "changing the subject" / "beating a dead horse" in any output field. Score never blocks posting: I is admin_validation-only (not even in the production auto-trigger); the production auto-trigger (A–H) runs in the background after submit. RESPECTED.
- **cdiscourse-doctrine §2 (heat ≠ truth).** I has no access to heat/engagement signals; it classifies move text + parent context + thread-context excerpt only. RESPECTED.
- **cdiscourse-doctrine §3 (popularity ≠ evidence).** I does not read engagement metrics; the `references_external_context` key explicitly does NOT treat an external reference as granting factual standing — the doctrine line in §A.3.1 encodes this verbatim. The anti-amplification boundary is untouched. RESPECTED.
- **cdiscourse-doctrine §4 (AI moderator limits).** I does not decide who is right, does not delete/hide/modify content, does not assign truth values, returns advisory metadata only (the Edge Function marks AI flags `authoritative: false`), and runs ONLY on the server (Deno) — never on the client. RESPECTED.
- **cdiscourse-doctrine §5 (rules engine sacred).** This card does not touch `src/lib/constitution/engine.ts`. RESPECTED.
- **cdiscourse-doctrine §6 (secrets).** `familyIAnthropic.ts` reaches Anthropic via `callAnthropic` (x-api-key); `ANTHROPIC_API_KEY` is never logged (asserted by `familyIAnthropic.test.ts`); no `SERVICE_ROLE` in any I file; server-side only. RESPECTED.
- **cdiscourse-doctrine §7 (no AI calls from the production app).** Every I file is under `mcp-server/` (server-side Deno), never imported into `src/` or `app/`. RESPECTED.
- **cdiscourse-doctrine §10a (Observations vs Allegations).** Every I key is a machine **Observation** (`kind: 'machine_observation'`, `source: 'ai_classifier'`), structural-only, never an allegation about a person or intent. No I observation implies truth/quality/victory/defeat/dishonesty/motive. The upstream taxonomy already DROPPED `repeats_prior_point` precisely because it read as a verdict on contribution — the surviving 6 are the post-doctrine-filter descriptive set. RESPECTED.
- **point-standing-economy (topology relations are SHAPES, not standing penalties).** The header doctrine block encodes this; I emits no standing delta (descriptive only). The lifecycle keys that DO affect scoring eligibility (`moved_on_by_*`, `ignored_by_*`) are the EXCLUDED deterministic keys, out of scope for this card. RESPECTED.
- **evidence-doctrine (external reference ≠ automatic standing).** I's `references_external_context` positive records the structural fact of an external reference; it does NOT grant the claim factual standing (that requires the evidence-quality + source-chain path in Family D, downstream + out of scope). RESPECTED.
- **test-discipline.** Every new public function ships with Deno tests; the doctrine ban-list assertions are mandatory (the card touches verdict-adjacent strings); the count goes up (+111 Deno + 8 Jest forecast); the smoke audit Phase 6 captures exit codes. RESPECTED.

**HALT-trigger self-check (for the DESIGN — none should fire):** The 24 HALT triggers are runtime/implementation/smoke triggers. For the DESIGN phase, none fire — this is a design doc, not production code: it asserts the doctrine binding (does not frame topology as a verdict), names the Phase 4b evidence_span forward-safety obligation, declares A–H byte-equal, declares Stage 2B REQUIRED (T1) so the implementer waits for operator subset-ratification, confirms the source count is 6/8/7, and scopes the Edge-subset entry OUT (D2) so #14's default (entry absent) holds. The design itself introduces no verdict framing, no production code, no missing-guard.

---

## Operator steps (if any)

**For the implementer's merge: None for code deploy** — the MCP server (Deno Deploy) and Edge Functions (Supabase GitHub integration) auto-deploy on merge to `main`. No `npx supabase db push` (no migration). No `npx supabase functions deploy` (auto). No env var change.

**Before the implementer starts (Stage 2B — MANDATORY, T1):** the operator ratifies the Stage 2 surface — **the 6-key ai_classifier subset** (`introduces_new_issue`, `references_prior_agreement`, `introduces_sub_axis`, `returns_to_prior_issue`, `references_external_context`, `compares_options`) **+ the 15-key deterministic exclusion boundary**. Note that Stage 2B for I is **T1-only** (mixed-source subset); the T3 doctrine-prompt-structure surface that H/G needed is INAPPLICABLE (doctrine-risk LOW). HALT #15 guards against the implementer starting without this ratification.

**Post-merge (smoke; operator-run):** run the 8-phase smoke (§A.5) — hosted Phase 3 (`MCP_HOSTED_TOKEN` → 25/25, the GATE-C Deno-redeploy verification), Edge Phase 4 + Phase 4b live (admin JWT; note the Edge-subset gap gates Phase 4 live until the follow-up Edge card lands), Phase 7 provenance; pre-push `node scripts/ops/audit-lint.mjs <audit>` exit 0. If Phase 3/4/4b are operator-deferred, the smoke audit is PARTIAL and carries the D10 `evidence_span` forward-safety language. A later amendment (E/F/G/H precedent) lifts PARTIAL → PASS.

**Recommended follow-up cards (NOT this card):**
1. `MCP-SERVER-010A-FAMILY-I-EDGE-SUBSET` (or fold into Card 3) — add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology'] = Object.freeze(new Set(['ai_classifier']))` to `booleanObservationRequestBuilder.ts` + a dedicated `__tests__/mcpFamilyIEdgeMcpSubsetFilter.test.ts` (mirror #355). This unblocks admin_validation Family I through the MCP path. **Edge-bearing → merge=deploy.**
2. Card 3 (`MCP-021C-EDGE-FAMILY-I-ENABLE`, #394) — flip `productionEnabled: false → true` + 9-family latency re-measure.
3. Card 2 (`OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK`) — **SKIPPABLE** given LOW doctrine-risk; only runs if the operator reverses the SKIP.

---

## GATE-A verdict

**VERDICT: GATE-A PASS — design complete and implementable, PENDING the operator decisions below.**

All ~12 `[OPERATOR DECISION NEEDED]` markers + D1–D14 are resolved. The vast majority were resolved **from code + precedent** (not operator judgment):

**Resolved from code / precedent (no operator action needed):**
- **D1** — the 6 ai_classifier keys (verbatim from `familyI.ts`).
- **D2** — the Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` entry is **DEFERRED to a separate Edge-subset card / Card 3** (NOT this card). Resolved from the G precedent: the G server card #354 did NOT touch `booleanObservationRequestBuilder.ts`; the entry landed in the separate `MCP-SERVER-008A-FAMILY-G-EDGE-SUBSET` #355 (Family D was the same — separate fix #332). **→ this card is NOT Edge-bearing.**
- **D3** — auto_metadata + lifecycle (15 keys) excluded; non-MCP paths; not modified.
- **D5** — `FAMILY_I_MAX_TOKENS = 1500` (uniformity; ~990 headroom).
- **D7** — Edge `familyRegistry.ts` I entry unchanged (baseline `{productionEnabled:false, adminValidationEnabled:true}` at lines 109-113).
- **D8** — cross-family rawKey collision empty (parity test asserts).
- **D9** — `FAMILY_I_CLASSIFIER_SET_VERSION = 'family-i-v1'`.
- **D12 / §6** — **+111 Deno + +8 Jest = +119 net** (binding).
- **D13** — smoke check IDs `24-compat-boolean-family-i` + `25-mcp-tools-call-boolean-family-i`.
- **D14** — A–H libs + shared `doctrineBanList.ts` + protected surfaces byte-equal.
- **§3 / D11 — doctrine-risk = LOW → Card 2 SKIPPABLE (2-card chain).**
- **§4 — Stage 2B REQUIRED because T1.**
- **HALT triggers (§7)** — full 24-trigger table, #14 carrying the re-scoped mixed-source Edge-subset guard.

**Genuine GATE-A operator decisions requiring ratification before implementation (with recommended defaults):**

1. **Stage 2B subset ratification (T1) — REQUIRED.** Ratify the 6-key ai_classifier subset + the 15-key deterministic exclusion. **Recommended default: APPROVE as listed** (it is the verbatim `source: 'ai_classifier'` slice of `familyI.ts`; no judgment call).
2. **Card-2 SKIP (D11) — the consequential one.** Confirm doctrine-risk = LOW → Card 2 (L5 mechanization for `family_i`) is SKIPPED, collapsing the suite to a 2-card chain. **Recommended default: SKIP Card 2** (the 6 keys are post-doctrine-filter descriptive topology; the upstream taxonomy already pruned the one verdict-adjacent candidate `repeats_prior_point`; mirrors the Family E precedent). The 5-layer defense still ships on this card regardless; only the mechanized retroactive lint is skipped.
3. **`FAMILY_I_MAX_TOKENS` value (D5) — soft.** 1500 (designer default, uniformity) vs 1000 (brief-noted, signals small key-count). **Recommended default: 1500.** Either is safe; 1000 introduces a per-family special-case for zero benefit.
4. **Edge-subset boundary (D2) — confirm the deferral.** Confirm the Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['thread_topology']` entry is OUT of this card (→ separate Edge-subset follow-up / Card 3, keeping this card NOT-Edge-bearing). **Recommended default: DEFER** (mirror G #355). The only reason to broaden into this card is if the operator wants admin_validation Family I live through the MCP path immediately — which would make this card Edge-bearing (merge=deploy) and is NOT recommended for a Card-1 admin ship.

**No unresolvable contradiction surfaced.** The intent brief is internally consistent; the only tension (the D2 boundary) is resolved cleanly by the G #354 → #355 precedent. The card is ready for implementation upon operator ratification of decisions 1 + 2 (and the soft preferences 3 + 4).
