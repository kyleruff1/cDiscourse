# OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION — should structural families ban other families' tokens in their span scans?

**Status:** DECISION RECORD (ADR) — docs-only. Decides; does not implement. Zero production-file change, zero tests, no migration, no deploy.
**Epic:** Epic 12 — MCP / semantic-referee track (OPS hardening sub-track).
**Release:** OPS hardening (rejection-granularity follow-up; doctrine decision).
**Card type:** doctrine decision record. This card writes exactly one file (this doc).
**Issue:** No standalone GitHub issue URL was supplied to the designer. The motivating record is `docs/audits/OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md`, "Disposition" follow-up candidate (b) (`:73`): "*a cross-family list-union doctrine decision card (should structural families ban person-directed tokens from other families' lists in their span scans? — a real trade-off: it would drop verbatim quotes of public text)*".
**Baseline:** main @ `aa37b41` (HEAD `b1321ac` at write; the probe audit `aa37b41`/`5ae4b55` is in-tree).
**Doctrine anchors:** `cdiscourse-doctrine` §1 (no fabricated verdict; observation, not allegation), §3 (popularity/satire earn no standing), §10a (Observations vs Allegations — an Observation is a structural feature of the move's *own* text; sensitive person-directed signals are composer-only).

---

## The question (verbatim, from the live probe)

> *"should structural families ban person-directed tokens from other families' lists in their span scans? — a real trade-off: it would drop verbatim quotes of public text"*

The A–I live adversarial probe (`OPS-MCP-SOFT-PARAPHRASE-LIVE-PROBE-SMOKE-2026-06-11.md`) demonstrated the residual **on production data**: `astroturfed` (a Family-J-list token) persisted **verbatim in 7 of 57 spans** on `claim_clarity` / `critical_question` / `parent_relation` family keys (audit Phase 3 `:42`; Live observation 1 `:55`), and `WRONG` (bare `wrong` is a Family-E/F/G-list token — Family H bans only the compound `claim is wrong`, `familyHBanListScan.ts:102-123`; the audit's Phase-4 note cited E/F) persisted in **1** `parent_relation` (doctrine-only-stack) span (`:55`). Every instance was a **verbatim excerpt of the already-public move body**, rendered as an Observation on the **author's own node** under **person-neutral structural keys** (`claim_present`, `reason_missing`, `challenges_parent`), and was assessed **§10a-clean** by the human L5 audit (Phase 4 `:48-55`: 55/57 verbatim, 2/57 model-authored-structural, **0/57 model-authored person/intent**).

This record decides whether to change the scan layer to ban those tokens cross-family. It does **not** implement any change.

---

## What this decision does NOT cover (state it plainly, up front)

**This decision cannot touch the soft-paraphrase residual, and no option here closes it.** The soft-paraphrase class — regex-clean, model-authored person/intent characterization (e.g. "the author seems biased", "they clearly have an agenda") — is **regex-clean by definition** (`OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE.md` §3.1 `:66-95`, §5 `:196-203`). Every option below adds or re-composes **existing** banned tokens onto other families' stacks; the soft exemplars contain **zero** banned tokens from any list, so **no union catches them**. Anyone reading this record must not mistake a list-union for closing the soft class. The soft class remains an open item, contained today solely by the human L5 audit and the #578 deterministic tripwire corpus, and any closure of it is a separate pattern-engine card with its own §10a + production review.

The scope of THIS decision is narrowly: **the cross-family *verbatim-quote* residual** — already-public, regex-detectable tokens that one family's stack does not ban because they belong to another family's list.

---

## Context — how the per-family stacks are built (the mechanism this decision would change)

The ban-scan is composed **per family**:

- **Shared doctrine patterns** (`mcp-server/lib/doctrineBanList.ts` `DOCTRINE_BAN_PATTERNS` `:48-54`): 14 single tokens (`:31-46`: winner, loser, correct, incorrect, truth, untrue, dishonest, liar, manipulative, extremist, propagandist, stupid, idiot, verdict) + 2 phrases (`bad faith`, `proof of`). ASCII word/`snake_case`-boundary matching, case-insensitive (`tokenPattern` `:27-29`).
- **Families A–D** scan `DOCTRINE_BAN_PATTERNS` **alone** — they export **no** family-specific array (the decision is documented at `familyDBanListScan.ts:18-27`).
- **Families E–J** scan `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_<X>_BAN_PATTERNS]`, each exporting its own array (E `familyEBanListScan.ts:65-83`; F `:76-102`; G `:96-130`; H `:102-123`; I `:94-106`; J `:122-144`).

The key-level fail-closed mechanism (`mcp-server/lib/keyLevelFailClosed.ts`) re-composes the **exact same stack** each family's scan builds: `banPatternsForKeyLevelFamily(family)` (`:106-131`) returns `[...DOCTRINE_BAN_PATTERNS]` for A–D and appends `FAMILY_<X>_BAN_PATTERNS` for E–J, **in the same order** the scan composes. This is the **no-divergence invariant** pinned by #577/#578: the per-key drop decision and the whole-packet scan are built from identical bytes and can never disagree. The widening record proves "**All ten scan modules + `doctrineBanList.ts` are byte-identical to the pre-card tree (`git hash-object` proven)**" (`OPS-MCP-KEY-LEVEL-FAIL-CLOSED.md:390-400`).

### Why each family's tokens are scoped, not shared (the design's own load-bearing rationale)

Every E–J scan module documents — in nearly identical words — **why its tokens are NOT promoted to the shared list**: because they **legitimately appear in OTHER families' descriptive evidence-spans, usually as quotation of the move's own text or descriptive history**:

| Family | Representative scoped token | Documented legitimate cross-family use (file:line) |
|---|---|---|
| D (no array) | — | promoting `weak`/`dishonest`/`manipulative` "would risk false positives in other families" (`familyDBanListScan.ts:18-27`) |
| E | `invalid`, `wrong` | `invalid` legit in Family B `disputes_validity` ("the inference is invalid"); `wrong` legit in Family C `acknowledges_misread` ("I had you wrong on the scope") (`familyEBanListScan.ts:38-46`) |
| F | `invalidates`, `refutes` | legit in Family B `disputes_validity` ("the inference invalidates the parent's claim" — descriptive) (`familyFBanListScan.ts:44-55`) |
| G | `won`, `lost`, `ahead`, `behind` | legit in a Family D evidence-span: "the source notes the bill **won** committee approval" — descriptive history, not a debate verdict (`familyGBanListScan.ts:59-76`) |
| H | `weak`, `sloppy`, `unsupported` | legit in a Family D evidence-span quoting a source: "the bridge had a **weak** foundation" — descriptive history (`familyHBanListScan.ts:56-83`) |
| I | `off-topic`, `derail*`, `rehash*` | legit in a Family A evidence-span quoting a move's own text (`familyIBanListScan.ts:48-69`) |
| J | `troll`, `bot`, `toxic`, `astroturf*` | legit in a Family D evidence-span: "the soil was **toxic**" — descriptive; a Family I span could quote "**bot** traffic" as a topic (`familyJBanListScan.ts:68-88`) |

This table is the spine of the decision: a cross-family union does not merely "tighten the net" — it **re-introduces exactly the false positives these modules were deliberately built to avoid**.

### Token-class classification (E–J)

The prompt asks each family's tokens to be classified as person-directed vs verdict/quality vs game-outcome. The result is decisive for distinguishing Option 1 from Option 2:

- **DOCTRINE (shared, every family already scans):** mixed — person-directed (`liar`, `dishonest`, `manipulative`, `extremist`, `propagandist`, `stupid`, `idiot`), truth/verdict (`correct`, `incorrect`, `truth`, `untrue`, `verdict`, `proof of`), game-outcome (`winner`, `loser`), faith (`bad faith`).
- **E (`argument_scheme`):** 100% **reasoning-quality verdict** (`fallacy`, `flawed`, `invalid`, `bad reasoning`, …). None person-directed.
- **F (`critical_question`):** 100% **CQ-as-refutation verdict** (`refutes`, `invalidates`, `proves wrong`, …). None person-directed.
- **G (`resolution_progress`):** 100% **game-outcome / resolution verdict** (`won`, `lost`, `defeated`, `prevailed`, `ahead`, `behind`, `won the argument`, …). None person-directed.
- **H (`claim_clarity`):** ~100% **clarity/quality verdict** (`weak`, `sloppy`, `unsound`, `incoherent`, …). A few (`lazy`, `careless`, `confused`) are speaker-adjacent but framed at the argument; none are identity labels.
- **I (`thread_topology`):** **conduct/topology verdict** (`off-topic`, `derail*`, `rehash*`, `going in circles`); `evasive` edges toward motive.
- **J (`sensitive_composer`):** **the person-directed family** (`troll`, `bot`, `astroturf*`, `toxic`, `hostile`, `abus*`, `aggressive`, `uncivil`, `gullible`, `unhinged`, `ad hominem`, `personal attack*`, `bad actor`, `name calling`, …). This is the only list whose tokens "read as an accusation about the person." J already carries the explicit verbatim-quote-tension caution at `familyJBanListScan.ts:89-95`.

**So the only family list that is squarely "person-directed" is J.** E–I are verdict/quality/game-outcome vocabularies. A "person-directed token in a quoted span reads as accusation" worry applies, at most, to J's list — which is precisely the `astroturfed` residual.

---

## Investigation — where does a persisted `evidence_span` actually RENDER? (THE LOAD-BEARING NEW EVIDENCE)

The probe's §10a defense rests on a claim the audit asserts but does not fully trace: that the residual is "rendered as an Observation on the **author's own** node" and "no new exposure is created (the body renders in full regardless)" (`:55`). Whether the verbatim-quote defense holds turns on a question the audit did not answer in code: **does the span render ATTACHED to its argument body (the quote's source visible) or DETACHED (the span text standing alone, where a quoted hostile token could read as a machine statement)?** I traced every consumer of the persisted span (`evidence_span` / `evidenceSpan`) across `src/`.

### Rendering-context findings table

| Consumer (file) | Renders span TEXT to a user? | Attached / Detached / N-A | Evidence (file:line) |
|---|---|---|---|
| `arguments/cardView/CardDetailPanel.tsx` → `ClassifierLabel` | **YES — the only production UI render site** | **ATTACHED** (same panel renders the move's own body) | span rendered with a prefix `:169-171`, inline `:200-208` / stacked `:211-215`; the move's own body renders in the same panel's `CenterpieceRegion` `:726-739` |
| `arguments/cardView/cardClassifierStripModel.ts` | builds the chip's `evidenceSpan` | ATTACHED (feeds the panel above) | prefix `CARD_CLASSIFIER_EVIDENCE_PREFIX = 'Why this fired:'` `:69`; `readEvidenceSpan` `:187-191`; `markToChip` `:199-227`; surface = `selected_context` (§10a gate drops composer_only/inspect_only) `:270`; the hub family gate is **A–I** — only `sensitive_composer` (J) is excluded (`HUB_NON_PRODUCTION_FAMILIES`, `src/features/arguments/detail/argumentDetailModel.ts:670-688`; `buildHubClassifierGroups` `:787`). NOTE: comments reading "A–G" in `CardDetailPanel.tsx:227,302,849` / `cardDetailModel.ts:148,338` are **stale** (pre-#559/#562 H/I enables) — a comment-cleanup nit, not this card's job |
| `nodeAnnotations/annotationChipDescriptor.ts` (the **timeline node chip** descriptor) | **NO** — interface carries no span field | N-A (label only) | `AnnotationChipDescriptor` has `label` / `tooltip` / `kind` / `source` / `category` only `:66-119` — no `evidenceSpan` |
| `nodeLabels/nodeLabelSourceAdapters.ts` | NO | N-A | one `evidence_span` comment reference (`:325`); no render |
| `nodeLabels/machineObservationPersistenceAdapter.ts` | NO (data plumbing) | N-A | attaches `evidenceSpan` **additively** to the mark for forward consumers `:158-166`; truncates ≤240 `:99-101` |
| `arguments/argumentsApi.ts` | NO (data fetch) | N-A | selects `evidence_span`, maps to `evidenceSpan` on the row `:60,:133,:319` |
| `adminClassifierHealth/*` (types, model, csv, plainLanguage) | **NO — counts only** | N-A | "renders COUNTS ONLY — never … an `evidence_span`" (`types.ts:6,:52,:180`; `classifierHealthModel.ts:254`; `classifierHealthCsv.ts:6`) |
| `cutoverHealthAlerts/cutoverHealthAlertModel.ts` | **NO — pre-counted SUM** | N-A | "the `evidence_span` text NEVER leaves SQL" `:18-20`; Condition F is classified on a hit COUNT `:107` |
| `semanticReferee/*` | NO (validation/types only; separate dormant track) | N-A | `evidenceSpan?` is a schema field `semanticRefereeTypes.ts:104`; no `.tsx` renders it (the only `.tsx` touching `evidenceSpan` in `src/` is `CardDetailPanel.tsx`) |

**Investigation conclusion (the determinant of the recommendation):**

1. **There is exactly ONE production UI surface that renders the span text: `CardDetailPanel.tsx`.** A repo-wide scan of `.tsx` files for `evidenceSpan` returns `CardDetailPanel.tsx` and four test files — nothing else.
2. **That one surface is ATTACHED.** The same card detail panel renders the move's own body (`currentMessageBody`, `:726-739`) in its centerpiece; the span renders in the classifier column of the *same* panel. The quoted token is therefore co-present with the move text it was excerpted from, on the **author's own node** — exactly the §10a posture the audit asserted. **This includes the probe's Family-H `claim_clarity` `astroturfed` spans:** the hub family gate is A–I (only `sensitive_composer` is excluded — `HUB_NON_PRODUCTION_FAMILIES`, `argumentDetailModel.ts:670-688`), so every production family's spans, H included, render here — attached. The residual demonstrably **does** render; the defense is that it renders attached, not that it never surfaces.
3. **The public timeline node chip does NOT render the span at all.** The node-mounted `AnnotationChipDescriptor` has no span field (`:66-119`); the persistence adapter attaches the span only as an additive mark property that the node-chip path drops, and only the `selected_context` card-detail re-reader surfaces it (`cardClassifierStripModel.ts:187-191`). So the span's reach is the exploded active-card detail, **not** the at-a-glance node chrome.
4. **No detached rendering exists.** Admin health and cutover alerts are counts/names only and assert in their own headers that span text never reaches output / never leaves SQL. There is no surface where the span stands alone, away from its body, or on a third party's node.
5. **One honest weakening nuance, named:** the single render site frames the span with `"Why this fired:"` (`:69`) and does **not** wrap it in quotation marks (contrast the parent comparison bubble, which renders `"…"` — `CardDetailPanel.tsx:459-467`). For a person-neutral structural span this is fine; for a verbatim-quoted hostile token (`…astroturfed…`), the bare `"Why this fired: …astroturfed…"` reads marginally more as a machine-stated reason than as a clearly-marked quotation — even though it is attached to the visible body on the author's own node. This is a *framing* softness at the one site, not a detached rendering.

**Per the decision discipline:** because **all** renderings are attached / author-node (no detached rendering found), **the verbatim-quote §10a defense holds at every render site** — which points to no scan change. The single framing nuance (#5) is the only thing that would motivate a (rendering-layer, not scan-layer) follow-up.

---

## Options

### Option 0 — status quo: per-family stacks; residual contained by §10a verbatim-quote reasoning + L5 audit + #578 tripwire

- **Benefit (cost of NOT changing = the demonstrated cost is zero doctrine harm):** the probe found **zero doctrine violations** from the residual (Phase 4: 0/57 model-authored person/intent spans `:52`; every cross-family-token span was a verbatim excerpt assessed §10a-clean `:55`). The rendering investigation confirms the residual renders only attached, on the author's own node, with the body visible — the machine characterizes the move's text, not a person. No clean sibling, node chip, admin surface, or third-party node is affected.
- **Benefit:** preserves the deliberately-scoped per-family lists and their documented legitimate cross-family descriptive uses ("won committee approval", "weak foundation", "the soil was toxic"). Preserves the no-divergence invariant and every #577/#578 pin with **zero churn**.
- **Cost of changing measured against Option 0:** a union would have **dropped 7/57 ≈ 12% of the probe's persisted spans** (the `astroturfed` instances; +1 `WRONG` = 8/57 ≈ 14% for a full union) — **verbatim quotes of already-public text, for zero doctrine gain** (the audit found none of them violated doctrine).
- **Residual it leaves open:** the cross-family verbatim-quote residual persists (by design); the soft-paraphrase residual persists (untouched by any option). Containment: §10a verbatim-quote reasoning + the **human L5 audit** (the sole live backstop) + the **#578 deterministic tripwire corpus** (fails loudly if a pattern starts catching a pinned survivor).

### Option 1 — full union: every family scans DOCTRINE ∪ all ten family arrays

- **Benefit:** uniform stack; the `astroturfed` and `WRONG` residuals both drop; conceptually "no token survives anywhere."
- **Cost — drops verbatim quotes of public text (demonstrated):** drops all 8/57 cross-family-token spans the probe found §10a-clean.
- **Cost — re-introduces the exact false positives the design avoided:** a Family-D span quoting "the bill **won** committee approval", "the bridge had a **weak** foundation", "the soil was **toxic**", a Family-C "I had you **wrong** on the scope", a Family-B "the inference is **invalid**" would now be dropped/failed. The false-positive surface grows **multiplicatively** (every family inherits every other family's verdict/quality/game-outcome vocabulary). Worse: **E–I's verdict/quality/game-outcome tokens make no sense as bans on other families' spans** — a Family-G `resolution_progress` span legitimately quoting "we **won** the contract bid", or any family quoting "the argument is **weak**" as the move's own text, would be suppressed for no doctrine reason.
- **Cost — invariant/test churn (the prompt's specific concern):** the union does **not** break the no-divergence invariant *if both sides change together* — but it **does** break the "`banPatternsForKeyLevelFamily(family)` === the stack the family's own scan composes" property pinned by #577/#578. To keep the invariant, **both** `keyLevelFailClosed.ts` AND **all ten** `family*BanListScan.ts` modules must change in lockstep (the widening record's "all ten byte-identical" property `:395-396` would be deliberately abandoned). Tests that would fail and require re-authoring: the no-divergence per-family source+flags/agreement pins (`mcp-server/tests/keyLevelFailClosedWidening.test.ts`); every per-family doctrine-fixture suite that asserts a legitimate cross-family descriptive use *passes* (`familyDDoctrineFixtures.test.ts`, the F/G/H/I/J adversarial-doctrine suites); the SURV-2 hard-control shape in `softParaphraseSurvivorCorpus.test.ts:131` (each family would now catch every token, not just its own); plus each family's ban-list-scan unit suite. This is a large, doctrine-risky change for negative doctrine value.
- **Does nothing for the soft class.** Zero soft survivors are caught (they carry no banned token).

**Verdict: rejected.** Maximum cost, negative benefit, and semantically incoherent (E–I tokens as cross-family bans).

### Option 2 — person-directed subset union: add only J's person-directed tokens (and DOCTRINE's person tokens, already shared) to all ten stacks

- **What it targets:** exactly the class that "reads as accusation" — J's `troll`/`bot`/`astroturf*`/`toxic`/`bad actor`/… (the token-class analysis shows J is the only person-directed family list). Verdict/quality/game-outcome tokens (E–I) stay per-family.
- **Effect on the probe sample:** drops the **7** `astroturfed` spans (`:42,:55`). Does **not** drop the `WRONG` span (`WRONG` is a quality/verdict token, not person-directed) — so it is a strict subset of Option 1's drops, targeting the person-directed residual only.
- **The semantic argument it rests on — and why the rendering investigation defeats it:** the case for Option 2 is "a person-directed token in a span reads as an accusation even when quoted." But the rendering investigation found the span renders only **attached, on the author's own node, with the body visible**, framed "Why this fired:". The token `astroturfed` was the **author's own word** (the motive-bait input). So the surfaced span reads as the machine pointing at the move's *own* text, **not** as the machine accusing a third party. The accusation risk would materialize only if the span rendered **detached** from the body, or on a **third party's node** — and **neither occurs** (the node chip drops the span; J's genuinely person-directed keys are already `composer_only` and admin-only — `familyJ.ts:43-44,:69-72`). So even the person-directed-subset concern does not bite under the current rendering.
- **Cost — still drops verbatim quotes of public text:** the 7 `astroturfed` spans were §10a-clean verbatim excerpts on the author's own node; Option 2 drops them for the same zero doctrine gain as Option 1 (just fewer of them). It also re-introduces the J-comment's documented false positives ("the soil was **toxic**", "**bot** traffic" as a topic — `familyJBanListScan.ts:68-88`) on every other family.
- **Cost — same invariant/test churn class as Option 1**, narrower: both sides (`keyLevelFailClosed.ts` + the ten scan modules, or a new shared "person-directed" sub-stack) must change together; the no-divergence pins and any family suite quoting a J-token descriptively must be re-authored.
- **Does nothing for the soft class.**

**Verdict: rejected as a present change, but it is the *least-bad* union and the option to revisit FIRST if a detached rendering ever appears** (it is doctrinally targeted and avoids the incoherent E–I cross-bans).

### Option 3 — rendering-layer treatment instead of scan-layer: make the one render site visibly a QUOTATION

- **What it does:** leave all ten stacks byte-identical (no scan change, no invariant churn); change the single attached render site so the span unambiguously reads as a quote of the move's own words — e.g. wrap the span in quotation marks and/or change `CARD_CLASSIFIER_EVIDENCE_PREFIX` from "Why this fired:" to an attribution frame ("Quoting this move:" / "From this move's text:"). It lands the mitigation exactly where the residual's only (mild) risk lives — the framing nuance found in investigation #5.
- **Benefit:** removes the one honest weakening (a bare hostile token after "Why this fired:") without dropping any verbatim quote of public text and without touching the ban-scan, the no-divergence invariant, or any per-family list. Aligns with §10a's "Observation is a structural feature of the move's *own* text" by making the quotation explicit.
- **Cost:** a small display-only UI/copy change in `CardDetailPanel.tsx` + `cardClassifierStripModel.ts` (and its tests). It does not catch any token (it is not a safety gate); it sharpens framing. Because the span is *already* attached to the visible body on the author's own node, this is an honesty-sharpening, **not** a doctrine fix — hence optional, not required.

### Hybrid considered

A "DOCTRINE-only universal person tokens" hybrid (promote J's person-directed tokens into the shared `DOCTRINE_BAN_PATTERNS`) is **strictly worse than Option 2**: it has the identical drop-of-public-quotes cost, the identical false-positive cost ("the soil was toxic"), AND it would also abandon the "shared list byte-unchanged / family lists carry only NOT-already-covered tokens" architecture that every family module documents and the widening proved (`:390-400`). No hybrid is superior to the chosen path.

---

## Decision

**Adopt Option 0 — no scan-layer change. Keep the per-family stacks exactly as they are. Reject Option 1 (full union) outright. Reject Option 2 (person-directed subset union) as a present change.** Name a single, explicitly-optional, low-priority **Option-3 rendering-framing follow-up card** (below) for the one framing nuance; the decision stands complete without it.

**The core argument, grounded in doctrine (§1, §3, §10a) and the live evidence:**

1. The cross-family residual is, on the evidence, **verbatim excerpts of already-public text, on the author's own node, under person-neutral structural keys**, and was assessed **§10a-clean** (audit Phase 4 `:48-55`). §10a's rule is that an Observation is a structural feature of the move's *own* text; a verbatim quote of that text, attached to it, is precisely a structural observation — not a fabricated allegation about a person (§1).
2. **The rendering investigation found no detached rendering anywhere.** The span text reaches exactly one production UI surface (`CardDetailPanel.tsx`), and that surface is attached: the move's own body is rendered on the same panel; the public node chip drops the span entirely; admin/ops surfaces are counts-only. Per the decision discipline, attached-everywhere means the verbatim-quote defense holds at every render site — which is the condition for "no scan change."
3. A union (1 or 2) would **drop verbatim quotes of public text for zero doctrine gain** — 7/57 ≈ 12% of the probe sample (person-directed subset), 8/57 ≈ 14% (full) — and would **re-introduce the exact cross-family false positives** the F/G/H/I/J modules were deliberately designed to avoid ("won committee approval", "weak foundation", "the soil was toxic" — `familyG/H/J:59-88`). Option 1 additionally bans E–I verdict/quality/game-outcome tokens cross-family, which is semantically incoherent (a Family-G span legitimately quoting "we won the contract bid").
4. Either union forces **both** the ten scan modules **and** `keyLevelFailClosed.ts` to change in lockstep (to preserve the no-divergence invariant), abandoning the `git hash-object`-proven byte-stability (`:395-396`) and breaking the no-divergence pins + every family doctrine-fixture suite — large, doctrine-risky churn for negative value.
5. **No union touches the soft-paraphrase class**, which is the residual people actually worry about. A list-union therefore spends real cost (dropped public quotes + false positives + test churn) and buys nothing against the open class.

**Strength of the recommendation and what would flip it:** the recommendation is **strong**, and it is strong *because* the rendering investigation returned attached-everywhere. The single finding that would flip it toward a change is **a detached rendering of the span** — a future surface (or a future probe) where the span stands alone, away from its body, or on a node that is not the author's own. If that is ever found, the response is **Option 3 first** (make that surface render the span as an explicit quotation), and **Option 2 only if** Option 3 cannot be applied to that surface (person-directed subset, never the incoherent full union). The full union (Option 1) stays rejected regardless.

### Named follow-up card (this card decides; it does not implement)

**`OPS-MCP-EVIDENCE-SPAN-QUOTATION-FRAMING` (optional, low priority, Epic 2/11 — UI/copy).** Scope: change the single attached render site so the span reads unambiguously as a quotation of the move's own words — wrap `chip.evidenceSpan` in quotation marks and/or replace `CARD_CLASSIFIER_EVIDENCE_PREFIX` ("Why this fired:") with an attribution frame, in `CardDetailPanel.tsx:169-215` + `cardClassifierStripModel.ts:69`. Display-only; no scan change; no migration; no deploy. Review gates: `cdiscourse-doctrine` §1/§10a (the framing must read as a quote of the move's text, never as a machine verdict; the A–I hub family gate — `HUB_NON_PRODUCTION_FAMILIES = ['sensitive_composer']` — and the §10a composer-only suppression unchanged), `accessibility-targets` (the screen-reader label in `markToChip` `:208-211` must carry the quotation framing too), and `test-discipline` (update `__tests__/CardDetailPanel.test.ts` + the strip model tests; add a ban-list assertion that the framed string never reads as a verdict). **Not required by doctrine** — it sharpens the one framing nuance found in investigation #5; the present decision is complete without it.

---

## Consequences

- **Scan layer:** unchanged. `doctrineBanList.ts`, all ten `family*BanListScan.ts`, and `keyLevelFailClosed.ts` stay byte-identical. The no-divergence invariant and every #577/#578 pin remain green with zero churn.
- **The cross-family verbatim-quote residual remains, by decision.** Its standing containment is explicit: (1) the §10a verbatim-quote reasoning (an attached quote of the move's own text on the author's own node is a structural Observation, not an allegation); (2) the **human L5 audit** — the *sole live backstop* for both this residual and the soft class; and (3) the **#578 deterministic tripwire corpus** (`softParaphraseSurvivorCorpus.test.ts`), which fails loudly if any pattern change starts catching a pinned survivor, forcing a deliberate boundary re-assessment.
- **Observability blindness, stated plainly (inherited from the fixture card §5 `:202`):** neither this residual nor the soft class increments any drop counter (a surviving span is never *dropped*), so Q18 / `byUncleanSpanKeyDrop` / the admin health panel do **not** surface them. The human L5 audit is the only live detector. This decision does not change that, and does not pretend to.
- **The soft-paraphrase residual is explicitly NOT addressed here** and remains open for a future pattern-engine card with its own §10a + production review.
- **No operator action.** Pure decision record.

---

## Re-open triggers (any one re-opens this decision)

1. **A detached rendering is found** — a future probe or code change surfaces the span standing alone (away from its body), or on a node that is not the author's own (e.g. a digest, a notification, an export, a moderator queue, or a new surface that mounts the span on a *target's* chip). This is the named flip condition; response is Option 3 for that surface, then Option 2 only if Option 3 is impossible there.
2. **A model-authored span quotes hostile tokens NOT present in the move body** — i.e. a soft-survivor / fabrication rather than a verbatim excerpt. This is a §1/§10a violation class (the machine inventing a characterization) and is the L5 audit's job to catch; it is a *different* card (pattern-engine / soft-paraphrase closure), not a list union.
3. **The disposition boundary changes** — if any A–I rawKey's `defaultSurface`/`disposition` changes such that a span-bearing key moves to a more public or detached surface, or if a future card adds a span render site beyond `CardDetailPanel.tsx`, re-run the rendering investigation before relying on this decision.
4. **A new render site for `evidence_span` is added in `src/`** — the `.tsx` scan that returned only `CardDetailPanel.tsx` is the standing assumption; a second render site invalidates the "one attached surface" finding.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no fabricated verdict; score never blocks; Observation not allegation):** Option 0 fabricates nothing — it leaves the verbatim quote of the move's own text as the structural Observation it is, and rejects the coerce/over-block alternatives. The rejected unions would not have fabricated verdicts either, but would have *suppressed* clean structural observations of public text. The named Option-3 follow-up's review explicitly forbids the framed string reading as a verdict. **RESPECTED.**
- **cdiscourse-doctrine §3 (popularity/satire earn no standing):** untouched by every option; `uses_popularity_as_evidence` / `uses_satire_as_evidence` semantics and the anti-amplification gate are not in scope and not altered. **RESPECTED.**
- **cdiscourse-doctrine §10a (Observations vs Allegations — LOAD-BEARING):** the decision is grounded directly in §10a. The residual spans are structural features of the move's *own* text, rendered attached on the author's own node (investigation findings table + `:55`); they are Observations, not Allegations about a person. The genuinely person-directed family (J) is already contained by `composer_only` + admin-validation-only (`familyJ.ts:43-44,:69-72`) and its sensitive keys never mount on a target node. The decision keeps the public node chip span-free (`AnnotationChipDescriptor:66-119`), so no person-directed quote rides the at-a-glance chrome. The one framing nuance (a non-quotation prefix) is named and assigned to an optional §10a-reviewed follow-up rather than papered over. **RESPECTED — with the residual and its containment stated plainly.**
- **§4 (AI advisory; server-side only):** no change to authority or runtime locus; the classifier output stays advisory machine Observations. **RESPECTED.**
- **§5 (engine sacred):** `src/lib/constitution/engine.ts` untouched and unimported. **RESPECTED.**
- **§6 / §7 (secrets; no AI from the app):** no secret literal; no provider call; this is a docs-only decision. **RESPECTED.**
- **§8 (RLS; migrations):** no DB change, no migration, no RLS touch. **RESPECTED.**
- **§9 (plain language):** no new user-facing string is shipped by this card; the named follow-up routes its framing through the existing plain-language path and a ban-list test. **RESPECTED.**
- **§10 (v1 scope):** no voting/score/search/push/OAuth/public-API. **RESPECTED.**

---

## Operator steps

**None — pure decision record.** No migration, no deploy, no env var, no code. The named follow-up card (`OPS-MCP-EVIDENCE-SPAN-QUOTATION-FRAMING`), if ever taken, is a display-only UI change with no operator step of its own.
