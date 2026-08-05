# MCP-K-001 — Design review

**Reviewed:** 2026-08-05
**Branch:** feat/mcp-k-001-design
**Design under review:** `C:/Users/kyler/cdiscourse/wt-mcp-k-001/docs/designs/MCP-K-001.md` (469 lines)
**Card:** issue #669
**Verdict:** APPROVE-WITH-NITS — implementation-ready for MCP-K-002 **contingent on the three §12 operator rulings being answered first**. No blocking doctrine violations; several small drift/completeness nits; three genuinely load-bearing open questions the operator must rule on before scoping.

---

## §1 — Byte-verified cruxes (13 items)

| # | Crux                                                                                                           | Status                                                                                                                                                                                                                                                                                        |
| - | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Every predicate resolves against a shipped VOICE-003/004 field or the flagged capability snapshot              | ✓ Verified. `terminalState`, `wasEdited`, `editDistance`, `hadFinalEvent`, `rawTranscript` shipped in `speechTranscriptArtifact.types.ts:38-55`. `peakLevel`, `lastErrorCode`, `audioSource`, `sampleCount`, `meanLevel` shipped in `voiceWaveformArtifact.types.ts:57-74`. `SpeechCapabilitySnapshot` / `WaveformCapabilitySnapshot` correctly identified as NOT-shipped and flagged as §12.1 open. |
| 2 | Letter K is the next free letter                                                                               | ✓ Verified. `MachineObservationFamily` union ends at `'sensitive_composer'` (nodeLabelTypes.ts:189); `ALL_MACHINE_OBSERVATION_FAMILIES` has exactly 10 entries; directory `src/features/nodeLabels/machineObservationDefinitions/` contains familyA.ts … familyJ.ts with no familyK.ts. Repo-wide grep for `speech_waveform_artifact` returned zero hits outside docs. |
| 3 | `MAX_FLAGS_PER_RESPONSE = 20` at `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts:35`                       | ✓ Verified verbatim. Design's second cite (Edge mirror at `mcpBooleanObservationSchema.ts:161`) also verified.                                                                                                                                                                                |
| 4 | `FAMILY_REGISTRY` entry shape matches `{ family, productionEnabled, adminValidationEnabled }`                  | ✓ Verified. `FamilyRegistryEntry` interface at `familyRegistry.ts:44-60`. All 10 existing entries follow the same shape (lines 68-119). Design's proposed K entry is structurally correct.                                                                                                    |
| 5 | Source-uniformity precedent (J = `semantic_referee` uniform; not in `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`)     | ✓ Verified. Family J's 5 entries all carry `source: 'semantic_referee'` (spot-checked entry #1 at familyJ.ts:38). `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` at `booleanObservationRequestBuilder.ts:68-89` contains only D/G/I entries; `sensitive_composer` is absent. HOWEVER the "HALT-14 rule — unnecessary entry is itself a defect" is a design-choice claim, not a runtime-enforced invariant I could locate in tests; adding K here would be semantic misuse, not a runtime failure. Soft-precedent, not hard-precedent. |
| 6 | Fan-out line ref `submit-argument/index.ts:811-846`                                                            | ✓ Verified. `queueRoutingEnabled` const at line 811, `if (shouldRouteToQueue)` block spans lines 817-846, `dispatchAutoTriggerForArgument` invocation at line 838. Design also correctly cites the INSERT at lines 376-380.                                                                    |
| 7 | `gameCopy.ts` is in `SCAN_SET_TIER_A`                                                                          | ✓ Verified. `uxDoctrineCopyLint.test.ts:198` lists `'src/features/arguments/gameCopy.ts'`. Placing K plain-language strings there IS already covered by the shipped doctrine ban-list scan — no SCAN_SET amendment needed if K reuses that file. Design §6 is accurate. |
| 8 | Forbidden-token union is complete for a K guard                                                                | ✗ Partial. The design's §3 enumerates a REPRESENTATIVE list drawn from three sources. Cross-checked against `voice004ForbiddenInferenceGuard.test.ts:50-148`: several actual voice004 tokens are NOT enumerated in §3 (e.g. `mood`, `sentiment`, `authenticity`, `intensity`, `agitation`, `excitement`, `passion`, `whisper`, `dominance`, `assertiveness`, `energyLevel`, `emotionalIntensity`, `speakerRecognition`, `cepstral`, `fourier`, `melspec`, `f0`, plus the substring bans `energy_level`, `shouting_indicator`, `aggression_level`, `dominance_index`, `speaker_id`, `speaker_recognition`). Card AC tokens `emotional` and `accusation` are also missing from voice004 today. Design's phrase "mirrors VOICE-003/VOICE-004's guard house pattern" implies the K guard would inherit the wider lexicon — this reading is charitable and reasonable but should be pinned explicitly. See Nit N-3. |
| 9 | INV-K-UNKNOWN feasibility (ternary requires schema widening)                                                   | ✓ Verified as GENUINELY LOAD-BEARING. `mcpBooleanObservationSchemaMirror.ts:54` and `mcpBooleanObservationSchema.ts:111` both declare `observations: Record<string, boolean>` strictly; the mirror validator at line 181 hard-rejects `typeof observations[key] !== 'boolean'` — a literal `'unknown'` would return `wrong_shape`. Design's §12.2 recommendation (widen the shared schema) is a real shared-contract touch; every A–J consumer would need to handle the wider shape. Option B (K-local drift) is confining but a contract crack. Option C (defer the three capability-dependent keys) is the cleanest short-term path. Design's ordering (A > C > B) is defensible. |
| 10 | No forbidden-inference tokens appear in the design doc as endorsed observation names / copy                    | ✓ Verified. Every occurrence of a banned token in the design text sits inside a quoted ban list (§3, §0.1, §0.3, §2.2), a "MUST NOT read" rationale sentence (§2 plain-language columns), or a deferred/hypothetical framing (§0.3 recognitionConfidence/recognizerConfidence lock). No banned token appears as a live rawKey, a live label, or an endorsed plain-language mapping value. |
| 11 | §7.1 "New files" list is complete AND correct given the source-uniform ruling                                  | ✓ Verified. List correctly omits the six mcp-server sibling files (per §1.5) and the parity test. Adds the necessary five: `familyK.ts`, `familyKEdgeDeriver.ts` (or equivalent), `familyK.test.ts`, `familyKForbiddenInferenceGuard.test.ts`, `familyKEdgeDeriver.test.ts`. §7.2 correctly lists the seven edited files. §7.3 correctly enumerates the five things NOT to create. One naming nit: `familyKEdgeDeriver.ts (or equivalent)` — implementer should pin a name (N-4). |
| 12 | §9 test plan covers all mandatory bases                                                                        | ✓ Verified. Per-key predicate (§9.1 — 10 scenarios, one per rawKey), doctrine source-scan INV-C1 (§9.2), cap-compliance (§9.3), cross-family rawKey collision INV-C6/HALT-9 (§9.4), registry-order coordination (§9.5), post-store contract with byte-equal diff (§9.6), audio-object absence INV-C3 (§9.7), no-parent-context INV-B3 (§9.8), read-side RLS (§9.9). Missing observation-test coverage: none — every rawKey is exercised at least once across the 10 scenarios. |
| 13 | Ternary output vs cap-compliance interaction                                                                    | ✓ Verified nuance. `booleanObservationBatching.ts:6-8` explicitly says the cap is "counted over EVERY checked key (true and false)". Extending to `unknown` requires updating that comment + the mcp-server mirror validator + the Edge sanitizer. Design's §5 assumption ("every checked key regardless of true/false") is accurate for today's shape; a §12.2(A) ruling makes the sentence "true, false, or unknown". No cap-arithmetic changes are needed either way — 10 checked keys with any mix of the three values still counts as 10 entries, well under the 20 cap. |

---

## §2 — Open-question status (§12 operator rulings)

### §12.1 — SpeechCapabilitySnapshot / WaveformCapabilitySnapshot companion rows

- **Load-bearing.** Three observations (`text_only_fallback_used`, `recognizer_unavailable`, `waveform_metering_unavailable`) genuinely cannot distinguish "user chose typed" from "voice was never available" without a persisted composer-session capability row. VOICE-003 INV-A3 / VOICE-004 INV-A4 explicitly say the `'unavailable'` terminal yields NULL — the absence of a `SpeechTranscriptArtifact` is ambiguous.
- **Recommendation defensible.** Option A (ship the snapshot rows) IS an accessibility win — losing the "did the platform ever offer voice?" signal has real UX cost. Option B (defer the three keys) keeps K to 7 rawKeys and leaves the accessibility signal on the floor.
- **Blast radius accurate.** Adding two INSERT-only tables with author + admin RLS is a small VOICE-DB card, not a shared-contract change. Author-consent framing is correct (K rows carry drafting provenance about the author).
- **Cross-coupling with §12.2.** If §12.1 rules Option B, §12.2 becomes moot for K in v1 (Option C in §12.2 becomes the natural fit). Operator should decide §12.1 and §12.2 together, in that order.

### §12.2 — Widen shared observation schema to `boolean | 'unknown'`?

- **Load-bearing** (see crux 9). Schema is strictly `Record<string, boolean>` today; widening touches every A–J consumer and the mirror validator.
- **Recommendation ordering defensible.** (A) is architecturally cleanest but blast-radius-heavy — every family gains graceful degradation. (C) is the cleanest short-term path if §12.1 rules Option B. (B) is a contract crack for one family and should be the last resort.
- **Under-explored:** the design doesn't mention that the mcp-server mirror validator (mcpBooleanObservationSchemaMirror.ts:181) also hard-rejects non-boolean values — Option A requires updating both validators, not just one. The Edge parser at `parseMcpBooleanObservationResponse` (implied at mcpBooleanObservationSchema.ts:200+) would also need a matching change. No blocker; just a scope note for the operator.

### §12.3 — Does K stay source-uniform non-`ai_classifier` forever?

- **Defensible framing.** The design correctly treats this as a governance hedge, not a hard block. Naming `MCP-J-001-FAMILY-J-SCOPING-EXTENSION` as the analog is idiomatic for how family-scope-widening cards are structured in this repo.
- **What the operator needs to sign off on:** that ANY future `ai_classifier` addition (e.g. a ratified `recognitionConfidence`) triggers a fresh scoping card + returns to GATE-C on Deno Deploy — never a quiet increment inside a K bump.

---

## §3 — Doctrine invariants held

| Invariant                                                          | Status                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purity of the shipped predicate design                              | ✓ Every K observation is a deterministic projection over persisted artifact fields; no LLM, no fetch, no service-role in the K deriver design.                                                                                                                                    |
| No forbidden inference in the doc itself                            | ✓ All forbidden tokens appear only in quoted ban-lists, "MUST NOT read" rationale sentences, or deferred/hypothetical framing (§0.3).                                                                                                                                              |
| Cap ≤ 20                                                            | ✓ 10 rawKeys shipped in v1; cap-invariant test proposed at §9.3; batching path pre-existing for any hypothetical future expansion.                                                                                                                                                 |
| Post-store-only, never gates submit                                 | ✓ §4 pins the fan-out attachment point; INV-B2 (§8.2) makes the deriver refuse to run pre-insert; §9.6 test asserts byte-equal acceptance-path diff.                                                                                                                              |
| Advisory-never-gate                                                 | ✓ `authoritative: false`; no `PointStandingDelta`; no engagement/factual-standing credit; §10 non-goals nail this down.                                                                                                                                                             |
| VOICE-ADR-002 §12 payload-schema absence of URL / audio field       | ✓ INV-C3 (§8.3) mirrors the ADR-002 enforcement checklist item; §7.3 correctly excludes any `mcp-server` layer that could accidentally re-introduce it; §9.7 test asserts absence.                                                                                                 |
| ADR-001 § MCP Family K boundaries (verbatim carry-forward)          | ✓ §0.2 carries the MAY / MAY NOT list verbatim; §3 mirrors the Forbidden inference list.                                                                                                                                                                                          |
| No new copy file outside SCAN_SET_TIER_A                            | ✓ §6 pins the placement in `gameCopy.ts` (already in SCAN_SET_TIER_A at uxDoctrineCopyLint.test.ts:198), with the mandatory-checklist-item note if the implementer elects a new file.                                                                                              |
| Author RLS on K observation rows                                    | ✓ §7.4 limits reads to author + moderators/admins; K observations MUST NOT surface on the public argument read path in v1. This is a load-bearing consent-doctrine call and is correctly framed.                                                                                   |

---

## §4 — Nits (non-blocking, docs/design-fidelity)

**N-1 — `booleanObservationBatching.ts` line ref drift.** Design cites "true and false" comment at lines 6-9. Actual location is lines 5-7 in `booleanObservationBatching.ts`. Tiny drift.

**N-2 — `speech_capture_signal_below_threshold` waveform_metering_unavailable path (c) redundancy.** The design says path (c) fires when `audioSource === 'metering_only' AND sampleCount === 0`. Per `voiceWaveformArtifact.types.ts:87` (`FreshVoiceWaveformArtifact.audioSource = 'metering_only'`), `metering_only` is the DEFAULT audioSource. So checking `audioSource === 'metering_only'` alongside `sampleCount === 0` is functionally equivalent to just checking `sampleCount === 0` (assuming K reads only fresh artifacts, which is the shipped state). Simplifying the predicate to `sampleCount === 0` avoids implying that `metering_only` is a signal by itself. Not blocking — the belt-and-suspenders reading is defensible if K is ever fed non-fresh artifacts.

**N-3 — §3 forbidden-token list is representative, not exhaustive.** Cross-check against `voice004ForbiddenInferenceGuard.test.ts` reveals ~15 tokens present in voice004 but not enumerated in §3 (mood, sentiment, authenticity, intensity, agitation, excitement, passion, whisper, dominance, assertiveness, energyLevel, emotionalIntensity, speakerRecognition, cepstral, fourier, melspec, f0), plus the substring bans (energy_level, shouting_indicator, aggression_level, dominance_index, speaker_id, speaker_recognition). Card AC tokens `emotional` and `accusation` are also absent from voice004 today — the K guard needs to add them. The design's "mirrors VOICE-003/VOICE-004's guard house pattern" phrase implies the K guard would inherit the full lexicon; this reading is charitable and reasonable but the implementer should pin the intent explicitly ("familyKForbiddenInferenceGuard inherits voice004's WHOLE_WORD_BANS_INHERITED + WHOLE_WORD_BANS_WAVEFORM + SUBSTRING_BANS verbatim, PLUS the card AC tokens `emotional` + `accusation`") rather than manually re-enumerating.

**N-4 — `familyKEdgeDeriver.ts (or equivalent)` naming is unpinned.** §7.1 hedges with "(or equivalent)". Pin the name (`familyKEdgeDeriver.ts` reads well) so the implementer doesn't have to re-decide. Same for the test file (`familyKEdgeDeriver.test.ts` is already pinned in §7.1 — good).

**N-5 — INV-C3 `bucket` ban conflicts with waveform's `amplitudeBuckets`.** INV-C3 (§8.3) bans the field name `bucket` in the K deriver output. If the deriver reads `VoiceWaveformArtifact.amplitudeBuckets` internally (a legitimate read for computing observations), the source-scan needs a WHITELISTED_COMPOUNDS-style carve-out mirroring voice004ForbiddenInferenceGuard.ts:166-173. The design should note that the scan applies to OUTPUT PAYLOAD FIELD NAMES only, not to INTERNAL VARIABLE NAMES that reference shipped artifact fields.

**N-6 — INV-A3 disposition-list discrepancy.** §8.1 INV-A3 says "`disposition` field of every K entry is `'composer_only'` OR `'inspect_only'` (or `'hidden_sensitive'` if surfaced-later)". §2 §12 line 117 says "K is provenance about the AUTHOR'S OWN artifact, so `composer_only` and `inspect_only` are the only defensible dispositions". These are consistent BUT §2 pins `disposition: 'inspect_only'` uniformly for all 10 entries; INV-A3's mention of `composer_only` and `hidden_sensitive` is aspirational, not enforced by the design as shipped. Nit: INV-A3 could be tightened to "must be `'inspect_only'`" for the v1 K registry, with the wider set gated to a future card.

**N-7 — §5 batching-precedent numbers.** Design cites "Family D 22 → 16+6, Family G 21 → 16+5". Verified against `booleanObservationBatching.ts:53-55` — comment says "Family D (22 keys) -> 2 batches (16 + 6), Family G (21 keys) -> 2 batches (16 + 5)". Exact match — no nit, just confirmation.

**N-8 — §0.1 table 10-vs-11 rawKey count clarification.** The table row for the card AC's 10 named observations says "9 shipped + 1 renamed to a split pair + 1 explicitly DEFERRED. … K's v1 registry ships 10 rawKeys after splitting …". The arithmetic is 9 + 2 (split pair) − 1 (deferred slot) = 10 shipped, which matches §2 (10 observations). Slightly opaque phrasing; a re-read of the sentence with pen-in-hand is required. Optional clarification.

---

## §5 — Anything the orchestrator should surface to the operator BEFORE merging

**All three §12 open questions should be answered by the operator BEFORE MCP-K-002 is scoped.** In order:

1. **§12.1 (SHIP snapshots vs DEFER three keys)** — This is a VOICE-009 blast-radius call, not an MCP-K call. If VOICE-009 is already frozen without the two snapshot tables, the operator's realistic options collapse to (i) add a companion VOICE-DB card before MCP-K-002 starts, or (ii) ship K with 7 rawKeys and treat the three deferred keys as a v2 slot. This decision changes MCP-K-002's file count, migration count, and test count materially.

2. **§12.2 (schema widening vs K-local drift vs defer)** — Answer follows §12.1. If §12.1 = Option B (defer), §12.2 = Option C (also defer) and NO schema change is needed. If §12.1 = Option A (ship snapshots), operator must choose between (A) widening the shared A–J schema — high blast, architecturally right — or (B) K-local ternary — low blast, contract crack.

3. **§12.3 (does K stay source-uniform non-`ai_classifier`?)** — This is a governance sign-off, not a scoping call. A one-line yes closes the loop. A "no, we might ship an `ai_classifier` K key soon" flips MCP-K-002 back to GATE-C on Deno Deploy and reinstates the six-file mcp-server sibling set — a categorically different card.

**Additionally worth flagging up-front:**

- The design assumes VOICE-009 will produce `SpeechTranscriptArtifact` / `VoiceWaveformArtifact` rows in a persisted ledger before MCP-K-002 ships. VOICE-009 has not yet shipped (only VOICE-003 + VOICE-004 pure-TS reducers exist). MCP-K-002's Edge deriver has nothing to read from until VOICE-009 lands. The dependency chain is **VOICE-009 → MCP-K-002**, and MCP-K-002 is a no-op if run before VOICE-009. This is implicit in the design; making it explicit in the top-of-doc **Dependencies** block would help the operator sequence.

- The RLS/consent framing at §7.4 (K rows read-restricted to author + moderators/admins) has downstream UX implications — admin-validation dashboards and any operator-audit surface must respect the same RLS. This is likely correct as-is; worth explicit confirmation from the operator that the K observation surface will NOT be reachable from the public argument-node UI in v1.

---

## §6 — What NOT to change (pushback list)

If someone (implementer, operator, or a "should we just…" nit temptation) proposes any of the following during MCP-K-002 scoping, push back:

1. **Do NOT collapse `unknown` to `false` "as a temporary measure".** INV-K-UNKNOWN is load-bearing precisely because the collapse silently misclassifies accessibility/device gaps as user-choice. Either widen the schema (§12.2 A), do K-local ternary (§12.2 B), or defer the three capability-dependent keys (§12.2 C). Never (D) silently return `false` for capability gaps.

2. **Do NOT add `MCP_SERVER_SUPPORTED_FAMILY_SOURCES['speech_waveform_artifact']`** "just to be consistent with D/G/I". K makes no MCP call in v1 — the entry would be dead code AND would falsely imply the deploy chain runs through the Deno mcp-server. The HALT-14 rationale is soft-precedent but the design-correctness reason is hard: it would be a lie about the runtime path.

3. **Do NOT bundle a `ratified recognitionConfidence`, or any other `ai_classifier` K key, into MCP-K-002.** §12.3 explicitly reserves this for a fresh scoping card. Folding it into MCP-K-002 quietly is the exact pattern the design's §12.3 hedge exists to prevent — and would also silently escalate the card to GATE-C on Deno Deploy after review.

4. **Do NOT ship K with `productionEnabled: true`** in MCP-K-002. §1.3 pins `productionEnabled: false, adminValidationEnabled: true` for MCP-K-002 ship; a production flip is a separate card with a fresh `cdiscourse-doctrine` §10a review. Any argument along the lines of "K is provenance-only so it can't hurt anything" ignores the RLS/consent story at §7.4 and the read-side accessibility signal K carries.

5. **Do NOT rename the two pinned constants** (`K_TRANSCRIPT_EDIT_DISTANCE_HIGH`, `K_PEAK_LEVEL_LOW_THRESHOLD`) to config-loaded / env-driven values. The pinned-constant pattern is the shipped VOICE-004 doctrine (`SILENCE_THRESHOLD = 0.02`) and INV-C2 (§8.3) is a source-scan asserting literal numbers appear inline. A runtime-configurable threshold breaks doctrine reproducibility.

6. **Do NOT put K plain-language mappings in a new `voiceProvenanceCopy.ts`** without adding the new path to `SCAN_SET_TIER_A` in the SAME PR. Design §6 correctly notes this is a mandatory reviewer checklist item; skipping it silently bypasses the shipped doctrine scan for K's user-facing copy. If in doubt, use `gameCopy.ts` (already covered).

7. **Do NOT allow K observations to surface on the public argument-node read path in v1.** §7.4 is a consent boundary, not a nice-to-have. K rows describe DRAFTING PROVENANCE about the author (voice / typed / edited / mic level). Publishing them alongside the argument leaks the author's drafting behavior without consent.

---

## §7 — Verdict summary

APPROVE-WITH-NITS.

The design is coherent, precedent-parity-clean, and doctrine-honest. Every predicate maps to a shipped or clearly-flagged artifact field. The forbidden-inference boundary is drawn correctly, both in the observation set (§2), in the ban lists (§3), and in the plain-language rules (§6). Post-store-only, cap ≤ 20, no service-role, and no consumption of raw audio / URL / signed-URL / audio bytes are all held. The source-uniform non-`ai_classifier` ruling correctly collapses MCP-K-002's blast radius by removing the mcp-server layer entirely for v1.

The seven nits (N-1 through N-8, plus the completeness observation on N-3) are docs-fidelity or minor design-clarity issues — none blocks implementation.

The three §12 open questions are load-bearing and must be answered before MCP-K-002 is scoped. They are correctly identified, correctly ordered, and correctly framed. The design's honesty about naming them as open is itself doctrine-safe (deferring is preferable to shipping under an unresolved assumption).

Ready for operator ruling on §12; then ready for MCP-K-002 implementer.
