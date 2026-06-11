# OPS-MCP-KEY-LEVEL-FAIL-CLOSED — rejection-granularity: key-level fail-closed with span-omission semantics

**Status:** Design draft — GATE-A (design-only; ends at GATE-A + an explicit `cdiscourse-doctrine` §10a doctrine-review requirement for the implement card)
**Epic:** Epic 12 — MCP / semantic-referee track (OPS hardening sub-track)
**Release:** OPS hardening (rejection-granularity; mcp-server response-validation + Edge plumbing + observability)
**Card type:** design-only mechanism card. This doc implements **nothing**.
**Issue:** OPS-MCP-KEY-LEVEL-FAIL-CLOSED (J-chain umbrella #388). No standalone GitHub issue URL was supplied to the designer; the motivating record is the merged smoke audit `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` (the Amendment block) and its #388 comment trail (2026-06-11).
**Branch:** `docs/key-level-fail-closed-design`

---

## Goal (one paragraph)

The mcp-server boolean-observation response validator currently fails an **entire** response packet — `validation_failed` / `doctrine_ban_list` — the moment **one** `evidenceSpan` string trips the doctrine ban-scan. Because generation is deterministic per byte of input, one un-narrowable span (the canonical case: Family J `needs_pre_send_pause` anchoring its span on a reactive sentence that interleaves the input's own person-directed terms) kills the whole packet, discarding the **clean** sibling keys' Observations that were independently verified clean in the same generation. The Amendment to `MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` characterizes this as a deterministic, retry-immune **packet-residual** (4/4 Edge attempts), proves it is **fail-closed** (nothing dirty ever persisted), and notes that **prompt iteration has reached its structural limit** (17+ boundary probes; the #574 prompt-order-robustness follow-up). This card designs **key-level fail-closed**: the unclean key is **omitted** (never returns, never persists its span); the clean siblings survive. The change relaxes **nothing** about what is banned — every span is still scanned against the byte-unchanged ban-list, and no unclean span ever reaches the wire, the Edge, the database, or the client. It replaces the **packet-level death penalty** with **key-level death**, and turns the model-side "narrow-the-span-or-set-false" instruction into a deterministic **server-side backstop** that applies the same rule. The design is shaped by `cdiscourse-doctrine` §1 (the system never fabricates a finding or a verdict), §10a (Observations are structural features of the move's own text; sensitive-composer keys are composer-only and must never read as a person-characterization), §3 (popularity/satire never earn standing), and `test-discipline` §1 (tests are part of the deliverable). It ends at GATE-A; the implement card carries an explicit §10a doctrine-review merge gate.

---

## Validation-layer map (read the real code; every claim is file:line)

There are **two** validation layers. The card's locus is the **server** layer; the Edge layer is **unchanged in its drop logic** (defense-in-depth) and gains only additive field-plumbing.

### Layer 1 — mcp-server response path (THE LOCUS)

- **Per-span ban-scan:** `mcp-server/lib/familyJBanListScan.ts:155-189` — `scanFamilyJBooleanResponseForBanList(response)` iterates `response.evidenceSpan` entries (`:165-172`), then `modelInfo.serverName` (`:175-179`) and `modelInfo.classifierSetVersion` (`:182-186`); returns `{ ok: false, path }` on the **first** match (`:169`). The pattern set is `DOCTRINE_BAN_PATTERNS` (shared) stacked with `FAMILY_J_BAN_PATTERNS` (18 patterns, `:122-144`).
- **A–I families wire in identically:** each family has its own `family<X>BanListScan.ts` exporting `scan...ForBanList`; the dispatcher selects per-family via `FamilyProviders.banListScan` (`mcp-server/tools/classifyArgumentBooleanObservations.ts:385-388`, table at `:390-472`).
- **The whole-packet rejection (what this card replaces):** `mcp-server/tools/classifyArgumentBooleanObservations.ts:649-696` (Step 5). On `!banScanResult.ok` it logs `boolean_observations_doctrine_ban_list` (`:652-659`) and returns `errorResult('validation_failed', …, { path, detail: 'doctrine_ban_list' })` (`:680-695`) → `{ isError: true, … }`. This discards the entire validated packet, including clean siblings.
- **The isError envelope contents:** `errorResult` (`:337-350`) returns `{ content:[{type:'text',text}], structuredContent:{ reason:'validation_failed', path, detail:'doctrine_ban_list' }, isError:true }`. The tool `outputSchema` is `additionalProperties:false` (`:269`).
- **Server schema mirror / validator:** `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — `McpBooleanObservationValidatedResponse` type (`:50-62`), `validateMcpBooleanObservationResponse` (`:100-313`). The validator enforces key-set coordination: every `observations` key must be in `confidence`, `evidenceSpan`, and `checkedRawKeys` (`:218-265`); the 20-flag cap counts `observations` keys (`:162-169`).

### Layer 2 — Edge `sanitizeMcpBooleanObservationResponse` (UNCHANGED drop logic)

- **Call site:** `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts:405-409` — `sanitizeMcpBooleanObservationResponse(merged, { surface:'inspect' })` on the success/partial path.
- **What it does with spans at the inspect floor:** `src/features/nodeLabels/mcpBooleanObservationSchema.ts:360-406` — it **already drops per-key**, but on two criteria only: unknown rawKeys (`:371-372`) and keys below the surface confidence floor (`:382-384`). It then truncates surviving spans to ≤240 chars (`:389-394`). **It performs NO ban-list scan.** It never sees an unclean span because the server drops it before the envelope.
- **Conclusion:** the per-key DROP shape is **already an established Edge pattern** (confidence-floor + unknown-key). The new server-side key-level fail-closed is the **same shape** applied server-side to a **different criterion** (unclean span vs. confidence floor). The Edge sanitizer's drop logic stays byte-equal; it gains only additive **field preservation** for the new audit field (see §"Schema / version impact").

### The full chain (server → Edge → run row), for orientation

`classifyArgumentBooleanObservations` (server) → isError/clean envelope → `booleanObservationMcpAdapter.ts:264-322` (server-error-envelope detector `:111-120` + `parseMcpBooleanObservationResponse`) → `classifyArgumentCore.ts` (`mergeBatchResponses` `:390`, `sanitize` `:406`, `persistRun` `:411`) → `persistenceWriter.ts:93-142` (run row) and/or the queue drainer's `finalize_classifier_job` (migration `20260602000001`).

---

## Data model

No new domain type in `src/lib/types.ts`. Two additive, optional, **v1-compatible** shapes (full enumeration of mirror files in §"Schema / version impact"):

### (1) Wire-response field — `keysDroppedForUncleanSpan?: string[]`

Added to the response packet shape in all three schema definitions. **Optional**; absent ⇔ "no keys dropped" (a fully clean packet is byte-identical to today). Carries **rawKey NAMES only** — never span content, never a verdict, never any person/intent text.

```ts
// added to McpBooleanObservationValidatedResponse (server mirror)
//   AND McpBooleanObservationResponse (both Edge copies)
readonly keysDroppedForUncleanSpan?: readonly string[];
```

Validator rule (when present): must be a `string[]`; each entry MUST be a rawKey that is NOT present in `observations` / `confidence` / `evidenceSpan` / `checkedRawKeys` (a dropped key is, by construction, removed from those maps — see §"API / interface contracts"). This is the structural anti-resurrection invariant.

### (2) Run-row audit column — `dropped_unclean_span_keys text[]`

A **new** additive nullable column on `public.argument_machine_observation_runs`. NOT `failure_reason` / `failure_detail` — those are documented WRITE-ONLY failure diagnostics that stay NULL on success (`20260602000001_ops_mcp_classifier_failure_detail.sql:107-114, 238-247`); reusing them on a **success** row would violate their contract and confuse `admin-classifier-health` (which reads `failure_detail` only for failure reasons — `adminClassifierHealth/types.ts:44-52`). The run carrying dropped keys is a **SUCCESS**; the signal needs its own column.

```sql
ALTER TABLE public.argument_machine_observation_runs
  ADD COLUMN IF NOT EXISTS dropped_unclean_span_keys text[];
-- nullable, DEFAULT NULL, NO backfill. NULL on historical rows + on every
-- run with zero drops. text[] (not jsonb) so ops SQL can unnest() to count
-- per-key drop rates. Stores rawKey NAMES only — never a span, never a body.
```

---

## File changes (for the implement card; this card writes only this doc)

**New files**

- `scripts/ops/sql/18-unclean-span-key-drops-by-family.sql` — observability Q-file: count of SUCCESS runs with non-empty `dropped_unclean_span_keys`, grouped by family + `unnest`-ed rawKey + `run_mode`, over a window. ~40 lines. (Sibling-dir alternative per the `ops/sql dir is observability-owned` memory note — but this is a **peer** of the existing 18 numbered observability Q-files, so the numbered home is correct; the `.sql`-count safety test bumps 18 → 19, see §"Risks".)
- A migration `supabase/migrations/<ts>_ops_mcp_key_level_fail_closed_dropped_keys.sql` — the additive nullable column above + a `COMMENT ON COLUMN` (no `storage.*` target — PR-003 SQLSTATE 42501 boundary). ~25 lines. **No finalizer re-create on first ship** (see §"Scope decision").
- Server response fixture(s) for the canonical key-drop case (under `mcp-server/fixtures/`): a Family J response packet where `needs_pre_send_pause` carries an unclean span and the other 4 keys are clean. ~30 lines JSON.

**Modified files**

- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — Step 5 (`:649-696`) gains the key-level branch (split the modelInfo scan from the per-span scan; collect unclean evidenceSpan keys; drop them; populate the field; emit a NEW non-failure log event; return `isError:false`). The tool `outputSchema.properties` (`:240-268`) gains the optional `keysDroppedForUncleanSpan` array (so `additionalProperties:false` still admits it). ~60–80 lines.
- `mcp-server/lib/familyJBanListScan.ts` (and the shared dispatcher helper) — ADD a per-key collector (e.g. `findUncleanEvidenceSpanKeys(response): string[]`) that returns ALL unclean evidenceSpan rawKeys; **keep `scanFamilyJBooleanResponseForBanList` byte-stable** (still used for the modelInfo scan + as the boolean "is anything dirty"). ~25 lines added. The A–I scanners are touched only if/when scope widens (see §"Scope decision").
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` — add the optional field to the type (`:50-62`) and pass-through + validate in `validateMcpBooleanObservationResponse` (`:297-312`). ~20 lines.
- `src/features/nodeLabels/mcpBooleanObservationSchema.ts` — `McpBooleanObservationResponse` type (`:121`), `parseMcpBooleanObservationResponse` (carry the field, ~`:332`), `sanitizeMcpBooleanObservationResponse` (preserve it, `:397-405`). ~20 lines.
- `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` — the Deno twin of the above; the two are near-byte-identical (6-byte header diff today) and the parity test `__tests__/mcpOneTwoOneCEdgeParserParity.test.ts` enforces lockstep. ~20 lines.
- `supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts` — `mergeBatchResponses` (`:220-279`) **unions** each batch's `keysDroppedForUncleanSpan` into the merged response. ~10 lines.
- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` — read `sanitized.keysDroppedForUncleanSpan` (or `merged.…` pre-sanitize) and pass it to `persistRun` as the new audit field, on the SUCCESS path only (`:411-428`). ~8 lines.
- `supabase/functions/_shared/booleanObservations/persistenceWriter.ts` — `PersistRunInput` gains optional `droppedUncleanSpanKeys?: string[] | null` (`:35-63`) → conditional spread into the INSERT payload (`:96-119`), byte-equal when omitted. ~6 lines.
- `supabase/functions/_shared/adminClassifierHealth/types.ts` + `src/features/adminClassifierHealth/types.ts` (twin) + the model + the Edge column-select list — add a `byUncleanSpanKeyDrop` `ClassifierHealthCountBucket[]` to `ClassifierHealthVerdict` and read the new column (names + counts only). ~30 lines across the twins; the `adminClassifierHealthSharedParity.test.ts` enforces lockstep.

**Deleted files:** none.

---

## API / interface contracts

### Server Step-5 contract (the heart of the implement card)

Pseudocode for `classifyArgumentBooleanObservations.ts` Step 5, replacing the whole-packet rejection:

```
const resp = responseCheck.value;            // validated packet (step 4 passed)

// (a) modelInfo ban-hit is STILL a packet-level failure — you cannot drop a
//     key to fix serverName / classifierSetVersion. UNCHANGED posture.
if (modelInfo span hits ban-list)  -> return errorResult('validation_failed', …, {path, detail:'doctrine_ban_list'})  // as today

// (b) per-key evidenceSpan ban-hits become KEY-LEVEL drops (gated to the
//     key-level-fail-closed family set; see Scope decision).
const dropped = findUncleanEvidenceSpanKeys(resp);   // string[] of rawKeys
if (dropped.length === 0) -> return success(resp)    // byte-identical to today

const kept = resp with `dropped` removed from checkedRawKeys, observations,
             confidence, evidenceSpan; keysDroppedForUncleanSpan = dropped (sorted)
revalidate(kept)                                      // defensive; must pass
log('info','boolean_observation_key_dropped_unclean_span',
    { family, requestId, droppedKeyNames: dropped, status:'success' })  // NAMES only
return { content:[{type:'text', text: JSON.stringify(kept)}],
         structuredContent: kept, isError:false }
```

**Drop predicate:** drop on ANY unclean evidenceSpan, regardless of the key's boolean observation value. (The ban-scan is span-content-based; a `false` observation that nonetheless carries an unclean span is still dropped — defensive. A dropped `false` produces no persisted row anyway since persistence is positives-only.)

**Internal-consistency invariant after a drop:** `checkedRawKeys` == the surviving (cleanly-assessed) keys; `keysDroppedForUncleanSpan` == the omitted keys; the two sets are disjoint and their union is the model's originally-checked set. The validator's existing key-set coordination (`schemaMirror.ts:218-265`) holds on `kept` by construction.

### Batching merge contract

`mergeBatchResponses(outcomes, fallbackNodeId)` (`booleanObservationBatching.ts:220-279`) adds, alongside the existing union of `observations`/`confidence`/`evidenceSpan`: `merged.keysDroppedForUncleanSpan = union of each successful batch's keysDroppedForUncleanSpan` (chunks are disjoint, so the union is a concatenation; first-wins is moot). Absent in every batch ⇒ absent in `merged`.

### Persistence contract

`persistRun({ …, droppedUncleanSpanKeys })` writes `dropped_unclean_span_keys` **only** on `status:'success'` runs that actually dropped ≥1 key; omitted otherwise (NULL). No change to `persistResults` (positives-only; a dropped key is simply not in `checkedRawKeys` so it is never iterated at `classifyArgumentCore.ts:475`).

### Admin classifier-health contract

`ClassifierHealthVerdict.byUncleanSpanKeyDrop: ClassifierHealthCountBucket[]` — counts of runs (and per-rawKey breakdown) whose `dropped_unclean_span_keys` is non-empty, in the filter window. Reads NAMES only; renders **counts** only; never echoes a span. Admin surface only.

---

## Edge cases

- **All keys dirty (decided — see §"All-dirty edge decision"):** return an **empty-success** packet — `checkedRawKeys=[]`, `observations/confidence/evidenceSpan={}`, `keysDroppedForUncleanSpan=[all attempted keys]`, `isError:false`. NOT a packet failure.
- **`modelInfo.serverName` / `classifierSetVersion` ban-hit:** still a packet-level `validation_failed` (you cannot drop a key for a packet-level field). Posture UNCHANGED.
- **A dropped key was a POSITIVE:** dropping it means the positive is not persisted — this is the entire point (its unclean span is the violation). The audit field records that a positive was dropped; the drop-rate signal (below) is how it surfaces.
- **Confidence-floor drop vs. unclean-span drop are SEPARATE:** the Edge sanitizer's confidence-floor / unknown-key drops (`mcpBooleanObservationSchema.ts:371-384`) must NOT be conflated with the server's unclean-span drop. The audit field carries **server-sourced unclean-span drops only**; a key the Edge drops for low confidence is not an unclean-span drop and is not recorded in the field.
- **Empty packet (no observations) from the start:** nothing to drop; field absent; byte-identical to today.
- **Idempotent re-run:** deterministic input → deterministic ban-scan → deterministic drop set (sorted) → identical audit field. Preserves the auto-trigger/drainer idempotent-chunk-assignment contract.
- **Batch resurrection:** a key dropped in batch 1 cannot reappear in batch 2 (disjoint chunks); the existing first-wins collision guard (`booleanObservationBatching.ts:243-249`) already covers the impossible case.
- **Doctrine-constraint edge — does keeping clean siblings taint them?** No (full argument in §"Doctrine analysis"). Each span is scanned independently; a surviving span has been verified clean against the full ban-list; L5 readback re-verifies persisted spans.

---

## All-dirty edge decision

**Decision: empty-success packet, NOT packet-fail.**

Reasons:
1. **Consistency with omission semantics.** Key-level fail-closed omits each unclean key independently. "All keys unclean" is just "every key omitted" — there is no separate rule to introduce.
2. **No clean sibling to protect, but also no reason to retry.** The condition is deterministic and retry-immune (the Amendment proves 4/4 identical Edge attempts). A packet-fail would mark the run `failed` and feed the bounded-retry / dead-letter machinery for a condition retry can never heal — a pointless storm. An empty-success terminates cleanly.
3. **Stronger observability than a generic failure.** A 100%-drop run (`checkedRawKeys=[]`, `dropped_unclean_span_keys=[all]`) is a loud, specific, per-key signal in the ops Q-file and the health panel — far more actionable than a `validation_failed` lost among transport errors.
4. **Relaxes nothing.** No unclean span persists or returns; the empty packet asserts zero Observations. `checkedRawKeys=[]` + `dropped=[all]` is fully honest: "N keys attempted, 0 cleanly assessable."

The implement card MUST have a dedicated test for this branch (below).

---

## Observability (the silent-suppression guard)

Dropping a key must **never** be silent. The implement card MUST wire, at minimum, the first three; the last two are the surfacing layer:

1. **Response field** `keysDroppedForUncleanSpan` — names the dropped keys on the wire (server → Edge).
2. **Server log event** `boolean_observation_key_dropped_unclean_span` — leak-safe: `{ family, requestId, droppedKeyNames }`, `status:'success'`. NEVER the span content (the existing `emitToolErrorLog` allow-list discipline at `classifyArgumentBooleanObservations.ts:318-335` is the template; this is the **non-failure** analog).
3. **Run-row audit column** `dropped_unclean_span_keys text[]` — names only, on a SUCCESS row.
4. **Ops Q-file** `scripts/ops/sql/18-unclean-span-key-drops-by-family.sql` — per-family, per-rawKey, per-run_mode drop counts over a window (`unnest(dropped_unclean_span_keys)`).
5. **Admin classifier health** `byUncleanSpanKeyDrop` count bucket — counts only, admin surface only.

**Thresholds-thinking (alert, never gate):** a **sustained** drop-rate on a specific key (e.g. `needs_pre_send_pause` dropping on > a chosen fraction of runs over a window) is the operator's signal that **prompt iteration is warranted** for that key's span-anchoring. This is **advisory observability** — it triggers a human prompt-iteration decision; it NEVER auto-gates, auto-disarms, or changes a family posture. (Distinguish two things: the per-key drop itself IS a fail-closed validation action at the key scope; the drop-**rate** alert is advisory and must never become an automated gate — consistent with §1: validation can act, advisory signals cannot block or flip posture.)

---

## Schema / version impact

**Decision: v1-additive (no `schemaVersion` bump).** Reasons:

- The schema is `mcp-021.machine-observations.boolean.v1`. The new wire field is **optional**; a packet without it parses fine, and the Edge parser has **no top-level `additionalProperties:false`** rejection (verified: the only "unknown key" handling in `mcpBooleanObservationSchema.ts` is rawKey-membership, not top-level field rejection). So an old reader ignores the field and a new reader requires it only when a drop occurred.
- **Caveat — the parser reconstructs a known-fields object.** Both Edge parsers build a NEW response from a fixed field list, so to actually *surface* the field they must be updated in **lockstep** (the parity test enforces this). v1-additive on the wire; lockstep on the readers.
- **20-flag cap test:** unaffected. The cap counts `observations` keys (`schemaMirror.ts:162-169`); dropping keys only **reduces** that count; the dropped-keys field is a separate array not counted toward the cap.
- **Build-2 batching merge:** `mergeBatchResponses` must **union** the per-batch dropped-key arrays (specified above). Additive.

**Every mirror file the implement card must change (exhaustive):**

1. `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` (type + validator pass-through).
2. `mcp-server/tools/classifyArgumentBooleanObservations.ts` (drop logic + `outputSchema` property).
3. `mcp-server/lib/familyJBanListScan.ts` (+ shared dispatcher helper) — additive per-key collector; existing scan byte-stable.
4. `src/features/nodeLabels/mcpBooleanObservationSchema.ts` (type + parser + sanitizer).
5. `supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts` (Deno twin; parity-enforced).
6. `supabase/functions/_shared/booleanObservations/booleanObservationBatching.ts` (merge union).
7. `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` (thread to persistRun).
8. `supabase/functions/_shared/booleanObservations/persistenceWriter.ts` (`PersistRunInput` + INSERT).
9. The migration (new column).
10. `supabase/functions/_shared/adminClassifierHealth/types.ts` + `src/features/adminClassifierHealth/types.ts` (+ model + Edge select list).

---

## The two candidate semantics — evaluated; recommendation

### (a) coerce-to-false — REJECTED

The unclean key's observation flips to `false`. **Rejected.** Coercing to `false` **fabricates an assertion the model did not make**: the model reported the feature **present** (but anchored its span on un-narrowable text); flipping to `false` asserts the feature is **absent**. That is a §1-adjacent **truth distortion** (the system inventing a negative finding) and a §10a violation (an Observation that misrepresents the move's structure). It also misleads observability — a fabricated `false` is indistinguishable from a genuine "feature not present," hiding the drop. **Future readers must not resurrect coerce-to-false**: it manufactures a finding the model never asserted, for no benefit — the persisted-results layer is positives-only, so a `false` and an omission have the **identical** persistence outcome (no row), but omission alone avoids the fabricated negative on the response/audit surface.

### (b) omit-the-key — RECOMMENDED

The unclean key is **removed** from `checkedRawKeys` / `observations` / `confidence` / `evidenceSpan` and named in `keysDroppedForUncleanSpan`. Honest: "this key could not be cleanly assessed; no value is asserted." No fabricated value. The persisted-results layer (positives-only) is naturally unaffected (the key is not in `checkedRawKeys`, so it is never iterated). **Omission strictly dominates coerce-to-false on honesty with zero downside.**

---

## Scope decision — J-only enablement on a shared mechanism (RECOMMENDED)

**Recommendation: build the mechanism family-agnostic in the shared dispatcher tail, but ENABLE key-level drop initially for Family J only**, via a named set (e.g. `KEY_LEVEL_FAIL_CLOSED_FAMILIES = new Set(['sensitive_composer'])`). Widening to A–I is a separate, production-touching follow-up gated by its own review.

Weighing:

- **For all-families now:** the mechanism is shared; the basin argument (deterministic per-byte generation producing one un-narrowable span) is general; a family-special-case is itself a smell.
- **For J-only now (decisive):** **J is admin-validation-only (`productionEnabled:false`).** Enabling key-level drop for J has **ZERO production blast radius.** A–I are **production-enabled**; applying key-level drop to them changes **production** rejection behavior for 9 families that, per every shipped smoke, have **never** hit this basin (the sensitive-vocabulary basin is specific to J's inputs). Solving an admin-validation-only problem by changing production behavior for 9 families is a larger risk than the consistency benefit buys.
- **Migration simplification that reinforces J-only:** admin_validation runs use the **direct** dispatch path (`classifyArgumentCore → persistRun`), not the queue drainer. The drainer's `finalize_classifier_job` SUCCESS branch does NOT write the new column. Under J-only, only the direct path writes `dropped_unclean_span_keys`; **no finalizer re-create is needed on first ship.** Widening to A–I (production → drainer) would require re-creating the finalizer to write the column on its SUCCESS branch — that work is correctly deferred to the widening follow-up.
- **Test-surface containment:** the existing per-family `scan...ForBanList` functions stay byte-stable (still used for the modelInfo scan), so the 9 families' existing ban-list-scan tests stay green regardless. The new key-drop behavior is tested at the dispatcher level for J.

The shared-mechanism-with-named-enablement gives consistency of code, zero production blast radius on first ship, and a one-line widening path — each widening step taking its own §10a review.

---

## Doctrine analysis (the heart)

**The proposal relaxes NOTHING.**

1. **No unclean span ever persists or returns.** The drop happens **server-side, before the envelope is built** (`classifyArgumentBooleanObservations.ts` Step 5). The Edge, the database, and the client only ever receive `kept` — a packet from which every unclean span has been removed.
2. **The ban-scan still runs on every span.** `DOCTRINE_BAN_PATTERNS` + `FAMILY_J_BAN_PATTERNS` (18) are byte-unchanged, applied to every `evidenceSpan` string exactly as today. Detection is identical; only the **consequence** of a hit changes (key omitted vs. packet failed).
3. **Packet-level death → key-level death.** The change is strictly more permissive about **what survives** (clean siblings) and strictly equal about **what is banned** (no unclean content reaches persistence/client under either regime). It is a fail-**closed** change: the default for an unclean key is non-emission.
4. **Server-side backstop for the model-side rule.** The Family J prompt already instructs the model to narrow the span or set the observation false (the #574 prompt-order work; `familyJAdversarialDoctrine.test.ts` SPAN-SHAPE block). When the model fails to narrow, the server now applies the **same** rule deterministically by omitting the key — the backstop, not a relaxation.
5. **Do clean siblings get tainted by sharing a generation with an unclean span?** **No.**
   - The validator scans each span **independently** (`familyJBanListScan.ts:165-172`); a surviving span has been verified clean against the **full** ban-list on its own bytes.
   - The L5 audit discipline (`audit-lint` L5; persisted `evidence_span` readback) **re-verifies** every persisted span independently — a tainted sibling would be caught at readback, not relied upon to be clean.
   - The motivating record already demonstrates independence: in `MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` Phase 4b, `shifts_to_person_or_intent` anchored a **clean** span **in the same window** that `needs_pre_send_pause` produced the unclean one. The sibling's cleanliness is not contingent on its neighbor.
   - §10a: an Observation is a structural feature of the **move's own text**; a clean sibling Observation remains a true structural observation regardless of a sibling key's span-anchoring failure.
6. **§1 / no fabrication:** omission asserts nothing; coerce-to-false (rejected) would have fabricated a finding.
7. **§3:** `uses_popularity_as_evidence` / `uses_satire_as_evidence` semantics are untouched — popularity/satire still earn no standing; a drop never grants standing.

**Explicit §10a doctrine-review gate for the implement card (BINDING):** because this changes the runtime backstop of **the most sensitive prompt in the system**, the implement card MUST carry an explicit `cdiscourse-doctrine` §10a doctrine review as a merge gate (same posture as a J production-enable). The review must confirm, with evidence: (a) the ban-scan patterns are byte-unchanged; (b) no path returns or persists an unclean span; (c) the drop is server-side, pre-envelope; (d) the audit field carries rawKey **names** only, never span content; (e) no family posture changes (every `productionEnabled` / `adminValidationEnabled` flag byte-unchanged; J stays admin-validation-only).

---

## Test plan for the implement card (tests are part of "done")

**Server (mcp-server `deno test`)** — new dispatcher tests (`mcp-server/tests/classifyArgumentBooleanObservations.test.ts` and/or a new `familyJKeyLevelFailClosed.test.ts`):

- One dirty key (`needs_pre_send_pause`) + clean siblings → dropped key removed from `checkedRawKeys`/`observations`/`confidence`/`evidenceSpan`; siblings intact; `isError:false`; `keysDroppedForUncleanSpan === ['needs_pre_send_pause']`.
- Multiple dirty keys → all dropped, all named (sorted).
- `modelInfo` dirty → packet still **FAILS** (`isError:true`, `validation_failed`/`doctrine_ban_list`) — NOT a key drop.
- **ALL keys dirty → empty-success** (`checkedRawKeys=[]`, maps empty, `keysDroppedForUncleanSpan=[all]`, `isError:false`).
- Clean packet → byte-identical to today; field absent; `isError:false` (no-op proof).
- Drop on an unclean span attached to a `false` observation (defensive).
- A non-J family request with a dirty span (under J-only scope) still **packet-fails** (proves enablement gating).

**Adversarial fixture (the existential becomes canonical):** the `classify-argument-boolean-observations.family-j-pause-adversarial-request.json` input (interleaves reactive markers with the input's person-directed terms — `familyJAdversarialDoctrine.test.ts:473-515`) is the canonical key-drop fixture. With the implement-card behavior it must yield `needs_pre_send_pause` **dropped** and `shifts_to_person_or_intent` (+ other clean keys) **preserved**. The existing scan-level test (`familyJAdversarialDoctrine.test.ts:502-515`) stays green (the scan still returns `{ok:false, path:'evidenceSpan.needs_pre_send_pause'}`); ADD a dispatcher-level test asserting the same response is handled by key-drop, not packet-fail.

**Edge persistence + audit field (`__tests__/`):**

- `classifyArgumentCore` threads `keysDroppedForUncleanSpan` → `persistRun` on a SUCCESS run; the run row's `dropped_unclean_span_keys` is populated and `status='success'` (NOT `failed`; `failure_reason` NULL).
- `persistRun` INSERT is byte-equal to today when the field is omitted.

**Batching union (`__tests__/booleanObservationBatching.test.ts`):** two batches each dropping one key → merged `keysDroppedForUncleanSpan` is the union; absent in both → absent in merged.

**Schema parity / cap:** `mcpOneTwoOneCEdgeParserParity.test.ts` green after both Edge copies add the field; the 20-flag cap test (`mcpBooleanObservationSchema.test.ts`) green (field not counted).

**Doctrine ban-list assertions:** (i) scan the FULL post-drop response for the 18 J tokens + shared tokens → zero hits; (ii) every entry in `keysDroppedForUncleanSpan` is a member of the family's rawKey set and is NOT present in any of `observations`/`confidence`/`evidenceSpan`/`checkedRawKeys` (the anti-resurrection invariant); (iii) the dropped-keys field never appears on a non-admin (normal-user) surface.

**Observability tests:** ops Q-file safety test recognizes the new file; `adminClassifierHealth` model counts `byUncleanSpanKeyDrop` from seeded rows (names + counts only; no span echo); `adminClassifierHealthSharedParity.test.ts` green.

**L5 audit-lint implications:** a future J smoke exercising key-drop still inspects persisted `evidence_span` (the surviving siblings) — L5 unchanged; the dropped key simply has no persisted row. The smoke must ALSO read the run row's `dropped_unclean_span_keys` to prove the drop happened **and** the sibling persisted (the live success criterion below).

**Live success criterion (the implement card's smoke, operator-gated):** the real-UUID existential admin_validation request — the exact one that failed in `MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` Phase 4b — returns run `status='success'` with `needs_pre_send_pause` named in `dropped_unclean_span_keys` AND `shifts_to_person_or_intent` (+ any other clean key) persisted with a clean span. The prior Phase-4b failure becomes a Phase-4b success.

---

## Dependencies (cards / docs / files)

- Assumes **MCP-SERVER-011-FAMILY-J** (PR #567, merge `446c3f2`) is complete — Family J is the subject; its scanner, fixtures, and admin_validation posture are the substrate.
- Assumes the **#574 prompt-order-robustness** follow-up is merged (HEAD `ae19de2`) — this card begins where prompt iteration ended.
- Reads existing: `classifyArgumentBooleanObservations.ts:649-696` (Step 5), `familyJBanListScan.ts:155-189`, `mcpBooleanObservationSchemaMirror.ts:100-313`, `mcpBooleanObservationSchema.ts:360-406` (sanitizer), `booleanObservationBatching.ts:220-279` (merge), `persistenceWriter.ts:93-142`, `20260602000001_ops_mcp_classifier_failure_detail.sql` (run-row column precedent + finalizer), `adminClassifierHealth/types.ts`.
- Motivating record: `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` (Amendment).
- **Blocks / enables** a future A–I widening follow-up (key-level drop for production families) — which would additionally re-create `finalize_classifier_job` to write the audit column on the drainer SUCCESS branch, and take its own §10a + production review.

---

## Risks

- **`.sql`-count safety test:** `__tests__/opsMcpObservabilitySqlSafety.test.ts:59` asserts `FILES.length).toBe(18)`. Adding `18-unclean-span-key-drops-by-family.sql` bumps it to 19 — the implement card MUST update that assertion (and any per-file header-ownership assertions). The `ops/sql dir is observability-owned` memory note flags this dir as having an exact recursive count + header ownership; the new Q-file must carry the observability header.
- **Two near-identical Edge schema copies** (`src/…` and `supabase/functions/…`) drift easily; the parity test catches it but only on a full jest run — change both together and run the parity test.
- **`additionalProperties:false` on the tool `outputSchema`** (`classifyArgumentBooleanObservations.ts:269`) — the new optional field must be added to `properties` or a strict MCP SDK validation of the server's own output could reject it.
- **Migration deploy chain (operator-deploy-bearing):** the additive column must exist before the Edge code that writes it is live (the Supabase GitHub integration auto-applies migrations + redeploys registered Edge functions on merge to main — see the `Supabase merge auto-deploy` memory note). Apply the migration first (or land a migration-only PR), verify the column, then merge the code. Heightened reviewer verification applies (migration-bearing).
- **Existing dispatcher tests asserting "dirty span → isError:true":** if any current test in `classifyArgumentBooleanObservations.test.ts` asserts a J dirty-span packet returns `isError:true`, its meaning changes under key-drop — enumerate and re-point it to assert key-drop + `isError:false` (the scan-LEVEL tests are unaffected).
- **Flaky perf-budget tests** (per the `Flaky perf-budget tests` memory note) — re-run any wall-clock budget failure isolated before blaming this branch.

---

## Out of scope (explicit)

- **A–I key-level drop** (production families) — a separate, production-touching follow-up requiring its own §10a + production review and the `finalize_classifier_job` re-create.
- **Any change to the ban-scan patterns** (`DOCTRINE_BAN_PATTERNS`, `FAMILY_J_BAN_PATTERNS`) — byte-unchanged, never weakened.
- **Any family posture flip** — `productionEnabled` / `adminValidationEnabled` flags byte-unchanged; J stays admin-validation-only; this card does NOT flip J to production.
- **Prompt-side span-anchoring changes** — that line of work ended at #574; this card is the runtime-granularity complement, not more prompt iteration.
- **Edge ban-scanning** — the Edge does not gain a ban scan; the server remains the sole ban authority (defense-in-depth: the Edge only ever sees already-clean spans).
- **`finalize_classifier_job` re-create** — deferred with the A–I widening (admin_validation uses the direct persistRun path, not the drainer).
- **Coerce-to-false semantics** — rejected above; documented so it is not casually resurrected.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels; score never blocks posting; no fabrication):** omission asserts nothing; coerce-to-false (which would fabricate a negative finding) is rejected. No verdict token is emitted. The drop is fail-closed validation at the key scope; the drop-RATE signal is advisory and never gates. **RESPECTED.**
- **§3 (popularity/satire are not evidence):** `uses_popularity_as_evidence` / `uses_satire_as_evidence` semantics untouched; a drop never grants standing. **RESPECTED.**
- **§4 (AI moderator advisory; no truth value; runs only in Edge/server):** the classifier output stays advisory machine Observations; the change is to *rejection granularity*, not to authority. AI runs server-side (Deno) only. **RESPECTED.**
- **§5 (engine sacred):** no `src/lib/constitution/engine.ts` change; the engine is not touched. **RESPECTED.**
- **§6 / §7 (secrets; no AI from the app):** no secret literal; the audit field/log carry rawKey names + structural ids only; no provider call from `app/`/`src/`. **RESPECTED.**
- **§8 (RLS; append-only; sequential additive migration):** one additive nullable column, no RLS change, no edit of an applied migration, no hard delete. **RESPECTED.**
- **§9 (plain language):** the dropped-keys signal is an admin-only surface (rawKey names); if any user-facing string is ever derived it must map via `gameCopy.toPlainLanguage`. **RESPECTED** (no normal-user surface added).
- **§10a (Observations vs Allegations — LOAD-BEARING):** a clean sibling Observation remains a true structural observation of the move's own text and is not tainted by a sibling key's unclean span; the unclean key is omitted (no Observation made) rather than coerced into a fabricated one; sensitive-composer keys stay composer-only. The implement card carries an explicit §10a doctrine-review merge gate. **RESPECTED.**
- **§10 (v1 scope):** no voting or win-declaring score, no search, no push, no OAuth, no public API. **RESPECTED.**

---

## Operator steps (if any)

For the **implement** card (NOT this design card — this card commits only this doc):

1. `npx supabase db push --linked` — apply the additive `dropped_unclean_span_keys` column migration **before** merging the code that writes it.
2. Verify the column exists (`npx supabase db status` / a column check) before merge.
3. On merge to main, the Supabase GitHub integration auto-redeploys registered Edge functions; the mcp-server (Deno Deploy) auto-builds on the merge commit — confirm the hosted `/health` and re-run the J admin_validation smoke (the live success criterion above).

For **this** card: **None — pure design doc; no migration, no deploy, no code.**
