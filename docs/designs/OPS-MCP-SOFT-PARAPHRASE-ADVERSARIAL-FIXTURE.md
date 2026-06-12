# OPS-MCP-SOFT-PARAPHRASE-ADVERSARIAL-FIXTURE — characterize-and-pin the soft-paraphrase survivor boundary (A–J)

**Status:** IMPLEMENTED (test-only; default constraint-clean path) on branch `feat/soft-paraphrase-adversarial-fixture`. The 4 new test files + this doc + `docs/core/current-status.md` are the entire diff; every production file is byte-identical to main. Exact final counts (captured from gate output; the §4 estimates below are PRESERVED for design history):
> - Deno server suite: **1638 → 1674 (+36, 0 failed)** across the 3 new Deno test files — File 1 `softParaphraseSurvivorCorpus.test.ts` **24** (3 SURV-shape + 10 SURV-1 + 10 SURV-2 + 1 SURV-union), File 2 `softParaphraseMixedPacketReachability.test.ts` **6** (5 MIX-[A/D/H/I/J] + 1 MIX-banned-token-probe), File 3 `softParaphraseRegexBoundaryHonesty.test.ts` **6**.
> - jest suite: **714 → 715 suites (+1)**, **29607 → 29611 passed (+4)**, 1 pre-existing skip intact — File 4 `__tests__/softParaphrasePublicSurfaceBoundary.test.ts` **4** (2 PSB-public + 1 PSB-composer-only + 1 PSB-edge-no-ban-scan).
> - Gates: `deno task test` 0 failed; `deno lint tests/softParaphrase*.test.ts` clean; `npx jest --maxWorkers=4` exit 0; `npm run typecheck` exit 0; per-file `npx eslint` on the jest file clean.
> - The optional dispatcher full-envelope J pin (+ its JSON fixture) was OMITTED by operator choice (strict literal test-only scope); the lib-level MIX-J pin covers item (c) fully. No exemplar substitutions were needed — all 20 soft exemplars verified clean against the union of all ten stacks at implement time, all 10 hard controls verified caught.
>
> _Original status: Design draft — GATE-A (design-only; this doc implements nothing)._
**Epic:** Epic 12 — MCP / semantic-referee track (OPS hardening sub-track).
**Release:** OPS hardening (rejection-granularity follow-up; test-only honesty corpus).
**Card type:** design-only mechanism card. No production-file change. The implement card adds ONLY test files (+ at most one additive fixture), and this design doc.
**Issue:** No standalone GitHub issue URL supplied to the designer. The motivating record is the parent design `docs/designs/OPS-MCP-KEY-LEVEL-FAIL-CLOSED.md` — specifically the binding-honesty note (§"Qualification", lines ~16–24), the §10a checklist item (f) ("affirmatively assess whether any SURVIVING sibling span carries a soft (non-regex) person/intent characterization on the adversarial fixtures"), and the "Widening (A–J)" section's reviewer suggestion to build an A–I adversarial fixture corpus for soft-paraphrase survivors now that key-level fail-closed is live for all ten production-and-admin families (PR #577).
**Baseline:** main @ `cad54fd`. Deno server suite 1638 passed / 0 failed. jest 714 suites / 29607 passed + 1 skipped.

---

## 1. Goal (one paragraph) + non-goals

**Goal.** Key-level fail-closed (PR #576 J-only, PR #577 widened to A–J) replaced the packet-level death penalty with key-level omission: an unclean `evidenceSpan` key dies alone and its **clean siblings survive and persist**. The parent design's binding-honesty note records the residual this surfaced: a sibling span that is **regex-clean but soft-paraphrase** — a person/intent characterization the byte-unchanged ban-scan does not catch (e.g. "the author seems biased", "they clearly have an agenda") — used to die *with* the packet and now **survives** on a clean sibling. For Families A–I this survivor renders **publicly** (Observations on a target's node), unlike Family J whose sensitive keys are composer-only and which is admin-validation-only. No regex closes this residual, and the validator/ban-scan must never be relaxed. This card delivers **honesty-as-tests**: a deterministic, spend-free adversarial **fixture corpus** plus pinning tests that (a) re-prove hard-control agreement per family, (b) **pin a named taxonomy of soft-paraphrase survivors as a tripwire** so a future pattern change that starts catching one fails loudly and forces a deliberate boundary re-assessment, (c) pin the mixed-packet marginal-reachability property (one hard key dropped + one soft sibling survives, `isError:false`), and (d) pin the public-surface boundary (A–I render publicly; J is composer-only / admin-only). The card **characterizes and pins**; it does not claim to close anything.

**Non-goals (explicit — each is a HALT trigger if a future reader tries to fold it in here):**

- **No pattern extension.** This card does NOT add a single token or RegExp to `DOCTRINE_BAN_PATTERNS` or any `FAMILY_<X>_BAN_PATTERNS`. Catching the soft class is a deliberate doctrine decision with its own review surface; silently extending a list under cover of a "fixture" card would itself be the silent boundary shift this card exists to prevent. Pattern extension is a separate future card with its own §10a + production review.
- **No validator / ban-scan change.** `validateMcpBooleanObservationResponse`, every `scanFamily<X>BooleanResponseForBanList`, and `keyLevelFailClosed.ts` stay byte-identical.
- **No live probe.** A live adversarial A–I probe (real Anthropic generation through `admin_validation` to observe whether the *model* emits soft paraphrase in the wild) is a separate GATE-SPEND card. This card is fully offline/deterministic.
- **No closing of the residual.** The soft-paraphrase residual remains open by design. §5 states plainly what stays uncovered.

---

## 2. Validation-layer + rendering-surface map (file:line)

### 2.1 The ban-scan substrate (the patterns this card pins around, never modifies)

- **Shared doctrine patterns:** `mcp-server/lib/doctrineBanList.ts:48-54` — `DOCTRINE_BAN_PATTERNS` = 14 single tokens (`:31-46`: winner, loser, correct, incorrect, truth, untrue, dishonest, liar, manipulative, extremist, propagandist, stupid, idiot, verdict) + 2 phrases (`bad faith`, `proof of`). Boundary helper `tokenPattern` (`:27-29`) uses `(^|[^a-z0-9])TOKEN([^a-z0-9]|$)` with the `i` flag — case-insensitive, ASCII-token-boundary, breaks on `_`/`-`/space.
- **Family-array inventory (verified byte-for-byte against each module):**
  - **A–D have NO family-specific array** — they scan with `DOCTRINE_BAN_PATTERNS` **alone**: `familyABanListScan.ts:33-61`, `familyBBanListScan.ts` (same shape), `familyCBanListScan.ts` (same shape), `familyDBanListScan.ts:47-75` (the comment at `:18-27` explicitly documents the no-family-array decision).
  - **E–J each export `FAMILY_<X>_BAN_PATTERNS` and scan `[...DOCTRINE_BAN_PATTERNS, ...FAMILY_<X>_BAN_PATTERNS]`:**
    - E `familyEBanListScan.ts:65-83` (12 patterns: fallacy, fallacious, invalid, flawed, wrong, weak argument, invalid argument, bad reasoning, flawed reasoning, logical error, informal fallacy, proof of).
    - F `familyFBanListScan.ts:76-102` (12: unmet means fallacy, proves wrong, invalidates, refutes, fallacy, fallacious, flawed, wrong, weak argument, invalid argument, bad reasoning, proof of).
    - G `familyGBanListScan.ts:96-130` (15: won, lost, defeated, prevailed, capitulated, ahead, behind, settled in favor, won the argument, conceded the loss, lost the {point|argument|debate}, settled the truth, proved, invalid, wrong).
    - H `familyHBanListScan.ts:102-123` (17: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical, bad reasoning, bad argument, bad writing, argument is incomplete, argument is unsupported, argument is weak, claim fails, claim is wrong).
    - I `familyIBanListScan.ts:94-106` (8: off[-]topic, derail\w*, evasive|evad\w*, rehash\w*, repetitive, going in circles, changing the subject, beating a dead horse — the smallest list).
    - J `familyJBanListScan.ts:122-144` (18: troll, bot, astroturf\w*, toxic, hostile, abus\w*, aggressive, uncivil, incivility, gullible, unhinged, ad hominem, personal attack\w*, attack\w* the person, bad actor, name calling, fake news, losing it).
- **The collector/drop mechanism this card drives (never modifies):** `mcp-server/lib/keyLevelFailClosed.ts` — `KEY_LEVEL_FAIL_CLOSED_FAMILIES` (all ten, `:76-87`), `banPatternsForKeyLevelFamily(family)` (`:106-131`, re-composes the same stack each family's scan builds; A–D return `[...DOCTRINE_BAN_PATTERNS]`, E–J append the family array), `findUncleanEvidenceSpanKeys(spans, patterns)` (`:140-155`, span-content-based, value-agnostic, sorted/deduped names), `dropUncleanEvidenceSpanKeys(response, dropped)` (`:178-208`, removes the key from `observations`/`confidence`/`evidenceSpan`/`checkedRawKeys`, names it in `keysDroppedForUncleanSpan`).
- **Dispatcher Step-5 branch:** `mcp-server/tools/classifyArgumentBooleanObservations.ts:660-760`. The key-drop sub-branch is `:677-715`: gated on `KEY_LEVEL_FAIL_CLOSED_FAMILIES.has(resolvedFamily) && banScanResult.path.startsWith('evidenceSpan.')`; collects dirty keys, drops them, **re-validates + re-scans** `kept` (`:693-696`), and on success returns `{ structuredContent: kept, isError: false }` (`:707-711`). A `modelInfo.*` ban-path falls through to the unchanged packet-fail (`:716-759`). The `outputSchema` admits the optional field at `:278`.

### 2.2 The other layer is NOT a soft-paraphrase backstop (honest mapping)

- **Edge sanitizer has no ban scan.** `src/features/nodeLabels/mcpBooleanObservationSchema.ts` — `sanitizeMcpBooleanObservationResponse` (`:400-...`) drops only (i) unknown rawKeys (`:411-412`) and (ii) keys below the per-surface confidence floor, then truncates spans to ≤240 chars. It performs **no** ban-list scan and imports **no** `scanFamily*`/`DOCTRINE_BAN_PATTERNS`. It carries `keysDroppedForUncleanSpan` through verbatim (`:377`). **Conclusion:** a soft survivor returned by the server passes the Edge unchanged (subject only to confidence floor + truncation). The Edge is not a second backstop for the soft class — the design must say so plainly and a jest source-scan can pin it.
- **No jest twin of the scan/collector.** The ban-scan + collector live only in `mcp-server` (Deno). The jest files that touch `keysDroppedForUncleanSpan` (`__tests__/keyLevelFailClosedPersistence.test.ts`, `keyLevelFailClosedWideningDrainerThread.test.ts`, `booleanObservationBatching.test.ts`, `mcpOneTwoOneCEdgeParserParity.test.ts`) pin the **field threading / persistence**, not the scan. `keyLevelFailClosedPersistence.test.ts:1-23` confirms the Edge SUT is Deno-only and is locked by source-text scan. So the survivor-pinning tests must be Deno-side.

### 2.3 Rendering-surface boundary (the public blast-radius citation)

- **A–I render PUBLICLY.** Production families carry node-rendered dispositions. Representative: `src/features/nodeLabels/machineObservationDefinitions/familyA.ts:66-67` (`defaultSurface: 'timeline_node'`, `disposition: 'rendered_now'`), `:110-111`, `:151-152`. A surviving soft-paraphrase span on such a key renders as an Observation on the **target's** node — public blast radius.
- **J's sensitive keys are composer-only; J is admin-validation-only.** `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` — `shifts_to_person_or_intent` `disposition: 'composer_only'` (`:44`), `contains_unplayable_insult_only` `:88`, `needs_pre_send_pause` `:132`; the §10a SENSITIVE/composer-only rationale at `:15-16`, `:69-72`. (J's other two keys are `inspect_only`: `uses_popularity_as_evidence` `:174-175`, `uses_satire_as_evidence` `:217-218`.) J's `productionEnabled = false` posture is recorded at the Edge family registry (`supabase/functions/_shared/booleanObservations/familyRegistry.ts`, the admin-validation-only block analogous to G/H/I at `:100-113`, referenced from `mcp-server/lib/familyRegistryInit.ts:150-204`); **byte-unchanged, do not modify.** So J's composer-only + admin-only double-containment is exactly why the J soft survivor has effectively zero public reach, while the A–I survivors do not.

**The boundary statement (load-bearing):** the soft-survivor class has **public blast radius on A–I** (timeline_node / rendered_now), mitigated only by (1) L5 human audit discipline and (2) — and this card sharpens the honesty here — the advisory drop-rate observability (Q18 / `byUncleanSpanKeyDrop`) **does NOT surface soft survivors at all**, because a soft survivor is never dropped, so it never increments a drop count (see §5). On J the same class is contained by composer-only rendering + admin-validation-only posture.

---

## 3. The fixture corpus design

All exemplars are **synthetic**, contain **no real slurs**, and are stored as inline `const` arrays inside the new Deno test files (test-discipline §"Fixtures": inline `const` is the established pattern; the existing widening/J tests use exactly this style). Soft exemplars by definition contain **zero** banned tokens. Hard controls deliberately contain a banned token used purely as a **scan-detection input** — established precedent (`familyJKeyLevelFailClosed.test.ts` uses `troll`/`toxic`; `keyLevelFailClosedWidening.test.ts` uses `fallacy`/`won`/`sloppy`). Doctrine §1 governs app copy / persisted spans / labels, not scan-test inputs.

### 3.1 Soft-paraphrase survivor taxonomy (the tripwire corpus)

Five principled classes, ~4 exemplars each (≈20). Every exemplar was checked against the **union of all ten stacks** (DOCTRINE ∪ FAMILY_E..J) and contains no banned token; therefore each must survive **every** family's pattern stack. The rationale per class is the kind of person/intent characterization that reads as an accusation yet evades a word-boundary token scan.

1. **person-trait paraphrase** — ascribes a disposition/character to the author without a banned token:
   - "the author seems biased"  *(the parent design's canonical example)*
   - "the writer comes across as closed-minded"
   - "this person sounds defensive"
   - "they appear emotionally invested" *(note J bans `unhinged`/`losing it` but not this phrasing)*
2. **intent attribution** — ascribes a purpose:
   - "this reads like it was written to mislead"  *(`mislead` is not banned; `liar`/`dishonest`/`untrue` are)*
   - "they clearly have an agenda"  *(parent design example)*
   - "this seems designed to provoke"
   - "the aim here appears to be distraction"  *(I bans `changing the subject`/`derail*` but not `distraction`)*
3. **competence insinuation** — insinuates a lack of grasp/skill, avoiding H's quality verdicts:
   - "the author doesn't really understand the topic"  *(avoids `confused`/`incoherent`/`unsound`)*
   - "they seem out of their depth"
   - "this betrays a shallow grasp of the issue"  *(avoids `weak`/`sloppy`/`flawed`)*
   - "the writer is in over their head"
4. **motive insinuation** — insinuates an ulterior motive:
   - "they're just trying to score points"  *(bare `point(s)` is not banned; G bans only the phrase `lost the point`)*
   - "this looks like motivated reasoning"  *(E/H ban `bad reasoning`/`flawed reasoning`/`logical error`; `motivated reasoning` is clean — a strong honest example of something arguably worth catching that the scan misses)*
   - "the real aim seems to be self-promotion"
   - "they have something to gain from this framing"
5. **group-affiliation insinuation** — insinuates side/camp/shill membership, avoiding J's `astroturf*`/`bot`/`troll` and DOCTRINE's `propagandist`/`extremist`:
   - "this is exactly what someone on that side would say"
   - "sounds like a talking point from their camp"
   - "the author is clearly carrying water for one party"
   - "reads like industry messaging"

**Tripwire intent (documented in the corpus file's header comment):** these strings are pinned to **survive**. If a future pattern change starts catching one, the corresponding SURV test fails — that is the desired loud failure: it means the doctrine boundary moved and someone must deliberately re-assess (this card forbids moving it silently). The comment must say verbatim that a failure here is a *boundary-moved* signal, not a regression to "fix" by editing the exemplar.

### 3.2 Hard-control exemplars (one per family — the "caught" side of the boundary)

Each contains a banned token chosen to exercise that family's stack; for E–J the token lives **only** in `FAMILY_<X>_BAN_PATTERNS` (not DOCTRINE), proving the family extension is wired into the collector (mirrors widening WIDEN-6).

| Family | Slug | Hard-control span (banned token) | Stack exercised |
|---|---|---|---|
| A | parent_relation | "this names the loser of the debate" (`loser`) | DOCTRINE |
| B | disagreement_axis | "the parent's claim is the gospel truth" (`truth`) | DOCTRINE |
| C | misunderstanding_repair | "the author is being dishonest here" (`dishonest`) | DOCTRINE |
| D | evidence_source_chain | "they call this proof of the conclusion" (`proof of`) | DOCTRINE |
| E | argument_scheme | "this is a textbook fallacy" (`fallacy`) | FAMILY_E only |
| F | critical_question | "the question refutes the parent" (`refutes`) | FAMILY_F only |
| G | resolution_progress | "the pro side won the argument" (`won the argument`) | FAMILY_G only |
| H | claim_clarity | "the claim is sloppy and underspecified" (`sloppy`) | FAMILY_H only |
| I | thread_topology | "this is just rehashing the same point" (`rehashing`) | FAMILY_I only |
| J | sensitive_composer | "the author is acting like a troll" (`troll`) | FAMILY_J only |

### 3.3 Mixed-packet exemplars (one hard key + one soft sibling)

For the marginal-reachability pins (§4 file 2). Each packet pairs a hard-control span (gets dropped) with a soft-survivor span (survives). Built directly as validator-passing responses (synthetic keys — the validator enforces key-set coordination, not family-rawKey membership; the widening test's `responseFromSpans` proves this). Required families: A + D (doctrine-only stack), H + I (family-array stack), J — satisfying "at least one A–D, one E–I, and J", with two reps on each side for robustness.

---

## 4. Test plan (exact files + assertions + counts; tripwire-comment convention)

All counts are **estimates** for the implement card; the implementer captures the exact `Test Suites/Tests` line per test-discipline §"Gate timeout handling". Deno files auto-discovered by `deno task test` (`deno test --allow-net --allow-env --allow-read tests/`, per `mcp-server/deno.json`).

### File 1 (NEW, Deno) — `mcp-server/tests/softParaphraseSurvivorCorpus.test.ts` — THE HEART

Data-driven over a `FAMILIES` array mirroring `keyLevelFailClosedWidening.test.ts` (slug, letter, scan fn, expected stack). Header comment carries the tripwire convention (3.1).

- **SURV-shape (×~3):** corpus has exactly 5 classes; each class non-empty; total exemplar count == the asserted constant; no duplicate exemplar; every exemplar is a non-empty string.
- **SURV-1 [per family ×10]:** for the given family, **every** soft exemplar yields `findUncleanEvidenceSpanKeys(spansFromCorpus, banPatternsForKeyLevelFamily(slug)) === []` **AND** `scanFamily<X>...ForBanList(responseFromCorpus).ok === true` (collector⇔scan agreement on CLEAN spans). This is the tripwire — comment: *a failure means a pattern now catches a pinned soft survivor; re-assess the boundary, do not edit the exemplar.*
- **SURV-2 [per family ×10]:** the family's hard-control span (§3.2) yields `findUncleanEvidenceSpanKeys(...) === [theDirtyKey]` **AND** `scan(...).ok === false` with `path === 'evidenceSpan.<dirtyKey>'` (collector⇔scan agreement on the DIRTY span; for E–J also assert the token is NOT in `DOCTRINE_BAN_PATTERNS` alone, proving the family extension fired).
- **SURV-union (×1):** every soft exemplar is clean against **every** family stack in one aggregate pass (the cross-family survivor guarantee in a single assertion).

Estimated: **~24 Deno tests.**

### File 2 (NEW, Deno) — `mcp-server/tests/softParaphraseMixedPacketReachability.test.ts` — item (c)

Local `responseFromSpans` helper (copied from the widening test; small, self-contained). For each of A, D, H, I, J: build a packet with one hard span + one soft-survivor span, then assert the full marginal-reachability chain:

- **MIX-[X] (×5, one per family):**
  - `findUncleanEvidenceSpanKeys` returns **only** the hard key (the soft sibling is not collected).
  - `dropUncleanEvidenceSpanKeys` → hard key absent from all four maps; **soft sibling present in `observations`/`confidence`/`evidenceSpan`/`checkedRawKeys`**; `keysDroppedForUncleanSpan === [hardKey]`.
  - `validateMcpBooleanObservationResponse(kept).ok === true` (anti-resurrection invariant holds).
  - `scanFamily<X>...ForBanList(kept).ok === true` — the kept packet **with the soft survivor re-scans clean** (the explicit pin that the survivor is not caught).
  - the soft survivor's exact text is still present in `kept.evidenceSpan` (explicit reachability assertion) — comment: *this is the documented marginal-reachability property; the hard key dies alone, the soft sibling survives.*
- **MIX-banned-token-probe (×1 aggregate):** the serialized `kept` packet for every family contains none of the hard banned tokens (the unclean span never rides the wire) yet **does** contain the soft survivor's words (proving the survivor — not the banned content — is what reaches the wire).

Estimated: **~6 Deno tests.**

> **OPTIONAL dispatcher full-envelope J pin (see §"Hard-constraint interpretive note"):** if the implementer wants to pin the soft survivor on the actual tool **envelope** (`isError:false`, soft sibling in `structuredContent`), they may add a dispatcher-level test reusing the existing `MCP_SERVER_FAMILY_J_FIXTURE_NAME` override (`mcp-server/lib/familyJFixtureProvider.ts:33-41`) driven by **one** new fixture `mcp-server/fixtures/classify-argument-boolean-observations.family-j-soft-survivor-mixed-response.json` (hard span on `needs_pre_send_pause` + soft "the author seems biased" on `shifts_to_person_or_intent` + clean others). This is the **only** thing that would add a non-test file. The lib-level MIX-J pin already covers item (c) fully; the dispatcher pin's marginal value over (existing J dispatcher test + MIX-J) is low, so it is **optional, not required**.

### File 3 (NEW, Deno) — `mcp-server/tests/softParaphraseRegexBoundaryHonesty.test.ts` — item (5) edge cases

Pins **current** behavior; explicitly does NOT fix. Each test carries a comment: *current behavior, out of scope to change here; closing it is a pattern-engine card.*

- **EDGE-case-insensitive (×1, positive control):** a hard token in UPPER/MiXeD case is still caught (the `i` flag) — proves case is not an evasion.
- **EDGE-homoglyph (×1):** a Cyrillic-homoglyph variant of a hard token (e.g. `tr`+Cyrillic-`о`+`ll`) is **NOT** caught (survives) — the ASCII `[^a-z0-9]` boundary has no homoglyph reach. Honest unclosed gap.
- **EDGE-diacritic (×1):** a diacritic variant (e.g. `wínner`) is **NOT** caught.
- **EDGE-leet (×1):** a leetspeak variant (e.g. `tr0ll` with a zero) is **NOT** caught.
- **EDGE-strict-boundary-asymmetry (×~2):** an inflection that continues into alpha for a **non-`\w*`** token is NOT caught — e.g. J's `troll` (no `\w*`) does NOT match `trolling`; contrast J's `astroturf\w*` which DOES match `astroturfing`. Pin both sides of the asymmetry honestly.

Estimated: **~6 Deno tests.**

### File 4 (NEW, jest) — `__tests__/softParaphrasePublicSurfaceBoundary.test.ts` — item (d) mechanical pin

Source/registry scans (read-only; touches no pinned file's bytes). Header comment states this is the mechanical companion to §2.3.

- **PSB-public (×~2):** a representative A–I rawKey definition has `defaultSurface: 'timeline_node'` and `disposition: 'rendered_now'` (read `machineObservationDefinitions/familyA.ts`) — A–I survivors render publicly.
- **PSB-composer-only (×~1):** J's three sensitive keys have `disposition: 'composer_only'` (read `familyJ.ts`) — never on a target node.
- **PSB-edge-no-ban-scan (×~1):** `sanitizeMcpBooleanObservationResponse` source contains no `scanFamily`/`DOCTRINE_BAN_PATTERNS` reference (read `src/features/nodeLabels/mcpBooleanObservationSchema.ts`) — the Edge is not a second backstop, so a soft survivor that reaches the Edge is not caught there.

Estimated: **~4 jest tests.**

**Totals (estimates):** Deno **~36** new tests across 3 files (1638 → ~1674); jest **~4** new tests / **+1 suite** (714 → 715 suites, 29607 → ~29611). The implement card confirms exact counts from captured gate output and reconciles them in `current-status.md` against the review file.

---

## 5. Edge cases, risks, and what remains UNCOVERED

### Edge cases (pinned, not fixed)

- **Case sensitivity:** all patterns are `i`-flagged; hard tokens are caught in any case (EDGE-case-insensitive). Not an evasion.
- **Unicode / homoglyph / diacritic / leet evasion:** the ASCII `[^a-z0-9]` boundary cannot see a Cyrillic `о`, an accented `í`, or a `0`-for-`o` substitution; such variants of a hard token **survive**. Pinned honestly (EDGE-homoglyph/diacritic/leet). Closing this is a pattern-engine card, not this one.
- **Strict word-boundary asymmetry:** non-`\w*` single tokens (`troll`, `winner`, `loser`) do not match alpha-continuing inflections (`trolling`, `winners`); `\w*` tokens (`astroturf\w*`, `abus\w*`, `derail\w*`) do. Pinned (EDGE-strict-boundary-asymmetry).
- **Empty / null spans:** `findUncleanEvidenceSpanKeys` skips non-string spans (`keyLevelFailClosed.ts:146`); a null-span key is neither dirty nor a survivor — covered by the corpus including a `null` sibling.
- **Soft exemplar accidentally containing a banned token:** prevented structurally — SURV-1 fails for any exemplar a stack catches, which is exactly the tripwire. The SURV-union test is the backstop that an exemplar is clean across **all** ten stacks, not just the family under test.

### Risks (implementer-facing)

- **Temptation to "fix" a tripwire failure by editing the exemplar.** If a future pattern legitimately starts catching a pinned survivor, the correct response is to **move the exemplar to a hard-control list with a documented boundary-moved note**, not to silently delete it. The header comment must say this.
- **Corpus-count constant drift.** SURV-shape pins exact counts; adding/removing an exemplar requires updating the constant in the same commit (intentional friction).
- **Helper duplication.** `responseFromSpans` is copied into File 2 (and the FAMILIES table style into File 1). This is deliberate test-locality, not a shared-util extraction (extracting a shared test util would risk touching a file other tests import). Keep copies local.
- **No RO-N / count-pin collision (verified):** the RO-N byte-equal boundary test (`__tests__/mcpOneTwoOneBReadOnlyBoundary.test.ts`) enumerates **named** files via `git diff main..HEAD`; it does not enumerate or count the `mcp-server/tests/`, `__tests__/`, or `mcp-server/fixtures/` directories. New files trip nothing. The new jest file only **reads** RO-pinned files (`familyJ.ts` RO-16; `mcpBooleanObservationSchema.ts` RO-17), never edits them. The `scripts/ops/sql` exact-count safety test is untouched — this card adds **no** `.sql` and nothing under `scripts/ops/`.
- **Flaky perf-budget tests** (per the project memory note): these new tests are pure pattern/logic, not wall-clock budgets; if a full-suite run flakes on an unrelated LIFE-001/META-001 budget test, re-run isolated before attributing it here.

### What remains UNCOVERED (state plainly — the residual itself)

This card **does not close** the soft-paraphrase residual. Concretely:

1. **No regex catches the soft class**, and this card adds none.
2. **The L5 audit readback shares the same regex** as the scan, so it does not catch a soft survivor either; the only L5 backstop is the **human** reviewer reading persisted spans.
3. **The drop-rate observability is blind to soft survivors.** Q18 (`scripts/ops/sql/18-unclean-span-key-drops-by-family.sql`) and the admin-health `byUncleanSpanKeyDrop` bucket count **drops**. A soft survivor is, by definition, never dropped — so it never increments any counter and is **invisible** to the entire observability layer the parent design built. (This is a sharper statement than the parent design's general "observability covers it" framing, and the card surfaces it deliberately.)
4. **On A–I the surviving span renders publicly** (timeline_node / rendered_now); on J it is composer-only + admin-validation-only. The only automated artifact this card adds is a **boundary tripwire** (the SURV tests) — it detects the *pattern set moving*, not a *live soft survivor in production*. There is no automated detector for the latter; the human L5 audit remains the sole live backstop.

---

## 6. Rollback

Trivial and total: `git revert` the implement-card commit (or delete the 3–4 new test files and, if the optional dispatcher pin was taken, the one fixture). Zero production behavior depends on any of it; no migration, no deploy, no config. The Deno suite returns to 1638 and jest to 714 suites with no other effect.

---

## 7. Dependencies (cards / docs / files)

- **Assumes** `OPS-MCP-KEY-LEVEL-FAIL-CLOSED` (PR #576, J-only) and `OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING` (PR #577, A–J) are merged — the survivor class only exists because clean siblings now survive. `keyLevelFailClosed.ts`, the ten `family*BanListScan.ts`, and the Step-5 branch are the substrate.
- **Reads (never edits):** `mcp-server/lib/keyLevelFailClosed.ts`, `mcp-server/lib/doctrineBanList.ts`, all ten `mcp-server/lib/family*BanListScan.ts`, `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (the validator + `McpBooleanObservationValidatedResponse` type imported by the tests), `mcp-server/tools/classifyArgumentBooleanObservations.ts:660-760`, `mcp-server/lib/familyJFixtureProvider.ts` (only if the optional dispatcher pin is taken), `src/features/nodeLabels/machineObservationDefinitions/familyA.ts` + `familyJ.ts`, `src/features/nodeLabels/mcpBooleanObservationSchema.ts`.
- **Test precedents reused as style anchors:** `mcp-server/tests/keyLevelFailClosedWidening.test.ts`, `mcp-server/tests/familyJKeyLevelFailClosed.test.ts`.
- **Discharges** the parent design's §10a checklist item (f) (assess soft survivors on adversarial fixtures) and the Widening section's reviewer-suggested follow-up.
- **Does not block** any card. A future "pattern-extension to catch soft paraphrase" card, if it ever happens, would consume this corpus (its exemplars become that card's hard-control acceptance set) — but that card carries its own §10a + production review.

---

## 8. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels; no fabrication; score never blocks):** the corpus pins behavior; it asserts nothing about any real person. Hard-control banned tokens appear only as **scan-detection inputs** in test files (established precedent), never as app copy / labels / persisted spans. No exemplar is presented as a verdict; the soft exemplars are pinned precisely because the system must NOT treat them as findings. **RESPECTED.**
- **§3 (popularity/satire are not evidence):** untouched; the group-affiliation class is pinned as a *survivor* (the system does not act on it), not as a standing-granting signal. **RESPECTED.**
- **§4 (AI moderator advisory; runs server-side only):** no change to authority or runtime locus; tests are offline, no provider call. **RESPECTED.**
- **§5 (engine sacred):** `src/lib/constitution/engine.ts` untouched and unimported. **RESPECTED.**
- **§6 / §7 (secrets; no AI from the app):** no secret literal; no network; no provider call from `app/`/`src/`; exemplars are synthetic strings. **RESPECTED.**
- **§8 (RLS; append-only; migrations):** no migration, no DB change, no RLS touch. **RESPECTED.**
- **§9 (plain language):** no new user-facing string; the corpus is internal test data; the jest pin asserts dispositions, not copy. **RESPECTED.**
- **§10a (Observations vs Allegations — LOAD-BEARING):** the card's entire purpose is to honor §10a — it pins that the system does **not** fabricate a person/intent Observation from a soft sibling (the survivor is carried as the *original* span, never re-characterized) and pins the composer-only/public boundary that keeps J's sensitive class off the target node. It also surfaces, in writing and in tests, the honest limit: §10a is enforced for the *regex-detectable* class only; the soft class evades the regex and is contained on A–I solely by human L5 audit. **RESPECTED, with the residual stated plainly.**
- **§10 (v1 scope):** no voting/score/search/push/OAuth/public-API. **RESPECTED.**

---

## 9. Operator steps

- **For this design card:** None — pure design doc; no migration, no deploy, no code.
- **For the implement card:** None at the operator level — it is **test-only**. Merging it triggers a Deno Deploy build of `mcp-server` (a `mcp-server/tests/` change), but the build is **behavior-inert** (no `lib`/`tools`/`main.ts` change); note it as **build-bearing only**, not deploy-bearing. No `npx supabase` command, no env var, no Edge deploy. If the optional dispatcher fixture is taken, it is additive test data only (never loaded in production — `MCP_SERVER_USE_FIXTURE_PROVIDER` is never set on deploy).

---

## Hard-constraint interpretive note (surfaced, not designed around)

The card's hard constraint says the implement card "adds ONLY: test files, fixture data (**inside test files or a tests/fixtures module**), and the design doc." Two judgments the operator/reviewer should confirm:

1. **Default path is strictly test-file-only.** All required coverage (items a–d) lives in 3 new Deno test files (inline `const` fixtures) + 1 new jest test file. **No new non-test file is required.** This is the recommended default and is fully constraint-clean.
2. **The optional J dispatcher full-envelope pin** would add **one** JSON under `mcp-server/fixtures/` — which is neither "inside a test file" nor a "tests/fixtures module," so it sits slightly outside the literal constraint wording, even though it matches the established precedent (the J key-level card placed its `family-j-key-drop-response.json` / `family-j-all-dirty-response.json` fixtures in exactly that dir, loaded by the test-only `MCP_SERVER_FAMILY_J_FIXTURE_NAME` override). Because the lib-level MIX-J pin already satisfies item (c), this dispatcher pin is **explicitly optional** and the implementer should omit it if a reviewer wants strict literal-constraint compliance. **This is the single interpretive judgment in the design; it is NOT a HALT** (the card delivers fully without it).

No other hard-constraint conflicts were found. All production files (`mcp-server/lib/*.ts`, `supabase/functions/**`, `src/**`, migrations, `engine.ts`, the registries, `package.json`) remain byte-identical under this design.
