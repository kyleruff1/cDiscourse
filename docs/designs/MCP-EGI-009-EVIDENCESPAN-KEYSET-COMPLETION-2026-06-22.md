# MCP-EGI-009 — Server-side evidenceSpan key-set completion for missing-key residuals

**Status:** implemented, PR open, awaiting Gate B + merge + deploy.

**Date:** 2026-06-22

**Stack predecessor:** MCP-EGI-008 (length-overflow scope widened to 13 rawKeys, merged `27cff72`, production-verified on Deno Deploy build `vg1zvmq6efxa`).

**Stack successor:** none committed; depending on D3 burst outcome after deploy, either a key-set-missing widening (MCP-EGI-010) or a Family-I rollback re-evaluation.

---

## Burst evidence motivating MCP-EGI-009

Post-MCP-EGI-007 D3 pass-load against debate `bd7b732c-306a-4c11-b5c3-9d3cafd2bbbc` (root `5ba45c37-b882-4eab-82c7-ad04c42d952d`, 2026-06-22T08:15:54Z; 8 targets × 9 families = 72 cells) produced TWO classes of `validation_failed` row-level residuals:

| Class | Surface | MCP-EGI-008 | MCP-EGI-009 |
|---|---|---|---|
| Length-overflow on PRESENT rawKey | `mcp_tool_detail_category = evidence_span_length_exceeded` | 8 rawKeys widened, MERGED | n/a |
| Key-set asymmetry on MISSING rawKey | `mcp_tool_detail_category = evidence_span_key_set_missing` | OUT of scope | **THIS CARD** — 3 rawKeys |

The 3 burst rows in the key-set-missing class:

| Family | dimension | rawKey | validator_path |
|---|---|---|---|
| F | `critical_question` | `question_invites_revision` | `evidenceSpan.question_invites_revision` |
| G | `resolution_progress` | `action_item_proposed` | `evidenceSpan.action_item_proposed` |
| H | `claim_clarity` | `unclear_reference_present` | `evidenceSpan.unclear_reference_present` |

Each rawKey is verified in its named family registry:
- [`mcp-server/lib/familyFKeys.ts`](../../mcp-server/lib/familyFKeys.ts)
- [`mcp-server/lib/familyGKeys.ts`](../../mcp-server/lib/familyGKeys.ts)
- [`mcp-server/lib/familyHKeys.ts`](../../mcp-server/lib/familyHKeys.ts)

All three families are members of `KEY_LEVEL_FAIL_CLOSED_FAMILIES`, so `banPatternsForKeyLevelFamily()` already composes the family's byte-identical ban-pattern stack for the dispatcher path that invokes the normalizer.

---

## Why this is a SEPARATE class from length normalization

| Dimension | Length-overflow (EGI-006/007/008) | Key-set-missing (EGI-009) |
|---|---|---|
| RawKey state in evidenceSpan | PRESENT, string > 240 chars | ABSENT (`hasOwnProperty=false`) |
| Validator reject reason | length cap exceeded | map-coordination asymmetry across `observations`/`confidence`/`checkedRawKeys`/`evidenceSpan` |
| Doctrine-preservation gate | ban-list scan: never null a banned-content string | not applicable: no content exists to nullify |
| Repair semantics | discard overlong anchor; preserve model's observation/confidence | fill missing structural entry with `null`; preserve model's observation/confidence |
| Prompt-side preventability | partial (model still drafts >240 chars on comparison-dense input) | partial (model judged the rawKey but omitted the evidenceSpan entry) |

A single packet shape cannot simultaneously be "string longer than 240 chars on key X" AND "missing key X entirely", so the two locked sets MUST be disjoint. A dedicated regression test asserts `EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS ∩ EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS === ∅`.

---

## Exact 3 target rawKeys

```ts
export const EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS: ReadonlySet<string> = new Set([
  'question_invites_revision', // Family F — MCP-EGI-009
  'action_item_proposed',      // Family G — MCP-EGI-009
  'unclear_reference_present', // Family H — MCP-EGI-009
]);
```

Set size: 3. Any future widening MUST be a separate card with its own burst row evidence. The dedicated drift-guard test asserts both the sorted-array contents and `size === 3`.

---

## Why completion to `null` is safe

1. **`null` is already a valid value for `evidenceSpan.<rawKey>`.** The schema mirror (`mcpBooleanObservationSchemaMirror.ts`) accepts `string | null` for evidenceSpan entries; a key with value `null` already passes the validator (proven by the per-target "completed packet validates" templated test).
2. **`null` makes NO semantic claim.** It is not a "found anchor" statement; it is the explicit absence of an anchor. The model's `observations[<rawKey>] = true/false` and `confidence[<rawKey>] = <band>` decisions remain its stated finding byte-equal.
3. **The existing prompt instruction implicitly admits null.** The MCP-EGI-005 prompt-side wording instructs the model to set `evidenceSpan.<rawKey>` to `null` when it has no anchor; the model already judged the rawKey but forgot the evidenceSpan field. Filling with `null` matches what the model would have written if it had remembered the field.
4. **Never overwrites a present value.** The `Object.prototype.hasOwnProperty.call(normalizedSpans, rawKey)` guard ensures any pre-existing value (string, null, or invalid shape) is left untouched — the validator's existing power to reject malformed shapes is preserved per-target.

---

## Why the validator remains UNCHANGED

`validateMcpBooleanObservationResponse` is unchanged. The MCP-EGI-009 fix sits BEFORE the validator (same dispatcher hook as MCP-EGI-006); the validator's key-set asymmetry rejection still fires for any unnormalized packet (proven by the per-target "unnormalized packet still fails validator" templated test). No validator relaxation has occurred.

---

## Why the ban-list remains PRESERVED

The key-set completion pass does NOT consult any ban-list. The reason is structural rather than a relaxation:
- The only mutation the pass performs is `normalizedSpans[rawKey] = null`.
- `null` is structurally orthogonal to any text-pattern doctrine the ban-list expresses.
- No content moves: no string is created, copied, or trimmed.

The Pass 1 length-overflow ban-list scan (`banScanMatches(value, patterns)`) remains byte-equal and gates Pass 1 unchanged. All 10 family scanners + `DOCTRINE_BAN_PATTERNS` + the family scanner files (`familyABanListScan.ts` through `familyJBanListScan.ts`) are unchanged.

---

## Why the length-normalizer scope remains UNCHANGED

`EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS` is byte-equal at the 13 keys MCP-EGI-008 locked. The drift guard test (`MCP-EGI-008 — exports the thirteen confirmed compound rawKeys`) is unchanged and continues to pin both the sorted array and `size === 13`. The new `EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS` is a NEW symbol, not a modification of the length set.

---

## Why retry / capacity / max_tokens are NOT the current lever

The key-set-missing residual is NOT a transport, drainer-capacity, retry-budget, or token-truncation problem:
- The model successfully returned a packet (no transport failure).
- The packet's `observations` + `confidence` + `checkedRawKeys` carry the rawKey (the model judged it — not truncated mid-output).
- The `mcp_tool_reason` is `validation_failed`, not `provider_server_error` / `provider_network_error` / `provider_timeout`.
- The packet survived the drainer's full retry budget; the failure is deterministic per call.

Existing retry budget (`#782`), drainer concurrency, `max_tokens`, and `familyRegistry` settings are unchanged.

---

## Logging / no-raw-value policy

Pass 1 (length) emits:
- `event: 'boolean_observations_evidence_span_normalized'`
- `category: 'evidence_span_length_exceeded_to_null'`
- `originalLength`, `maxLength`

Pass 2 (key-set, MCP-EGI-009) emits:
- `event: 'boolean_observations_evidence_span_key_completed'`
- `category: 'evidence_span_key_set_missing_to_null'`
- (no `originalLength` / `maxLength` — no value to measure)

Both shapes share the safe structural fields:
- `family`, `rawKey`, `path` (`evidenceSpan.<rawKey>`)
- `schemaVersion`, `requestId`

Both shapes NEVER carry:
- the raw evidenceSpan string value (Pass 1 leak-audit test pins this; Pass 2 has no raw value)
- the raw packet
- the raw prompt / argument body / model response text
- any bearer / JWT / API-key / service-role / env value
- the model output's nodeId / classifierSetVersion / debateId text

A new MCP-EGI-009 leak-audit test verifies the key-set events with a sentinel `nodeId` value; the serialized events do not contain the sentinel.

---

## Code surface

### Touched files (4)

| Path | Lines added | Purpose |
|---|---|---|
| [`mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts`](../../mcp-server/lib/booleanObservationEvidenceSpanNormalizer.ts) | ~140 net | New constants + new locked set + Pass 2 logic + extended file-level doc |
| [`mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts`](../../mcp-server/tests/booleanObservationEvidenceSpanNormalizer.test.ts) | ~350 net | KEY_SET_TARGETS array + 37 new tests; relocated MCP-EGI-008 boundary marker |
| [`docs/designs/MCP-EGI-009-EVIDENCESPAN-KEYSET-COMPLETION-2026-06-22.md`](MCP-EGI-009-EVIDENCESPAN-KEYSET-COMPLETION-2026-06-22.md) | NEW | this doc |
| [`docs/core/current-status.md`](../core/current-status.md) | ~3 lines | top entry |

### Preservation manifest (byte-equal vs `27cff72`)

- `mcp-server/tools/classifyArgumentBooleanObservations.ts` UNCHANGED — dispatcher Step-3.5 invocation routes by rawKey-membership against BOTH locked sets without code change.
- `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` UNCHANGED — validator + `MAX_EVIDENCE_SPAN_CHARS = 240`.
- `mcp-server/lib/keyLevelFailClosed.ts` UNCHANGED.
- `mcp-server/lib/banScanNormalize.ts` UNCHANGED.
- `mcp-server/lib/doctrineBanList.ts` UNCHANGED.
- All `mcp-server/lib/family<X>BanListScan.ts` (A through J) UNCHANGED.
- All `mcp-server/lib/family<X>Prompt.ts` (A through J) UNCHANGED.
- All `mcp-server/lib/family<X>Keys.ts` (A through J) UNCHANGED.
- `mcp-server/lib/familyRegistry.ts` UNCHANGED — Family I `productionEnabled: true` retained.
- All retry / drainer / concurrency / max_tokens settings UNCHANGED — `#782` retained.
- `supabase/functions/**` UNCHANGED.
- `supabase/migrations/**` UNCHANGED — no migration.
- `supabase/config.toml` UNCHANGED.
- `src/lib/constitution/**` UNCHANGED.
- `src/domain/constitution/**` UNCHANGED.
- `package.json` / lockfile / `app.json` UNCHANGED.

### Dispatcher byte-equality (critical preservation)

The dispatcher's Step-3.5 invocation (`classifyArgumentBooleanObservations.ts:~620-670`) is BYTE-EQUAL versus `27cff72`. This works because:

- The dispatcher passes the FULL packet to `normalizeLongEvidenceSpansForBooleanObservations(effectivePacket, { family: resolvedFamily, ... })`.
- The normalizer's internal Pass 2 reads `packet.observations` / `packet.confidence` / `packet.checkedRawKeys` directly — no API change at the call site.
- The dispatcher's log loop iterates `normalization.events` and reads `event.event` (the now-union literal), plus optional fields `event.originalLength` / `event.maxLength`. The shared `EvidenceSpanNormalizationEvent` interface made those two fields optional; key-set events emit them as `undefined`, which the log helper handles gracefully.

The two dispatcher-source-wiring tests (`MCP-EGI-006 — tool dispatch imports and calls the normalizer before the validator` + `MCP-EGI-006 — tool dispatch emits one structured log per normalization event`) continue to pass byte-equal.

---

## Tests

**Targeted Deno (`tests/booleanObservationEvidenceSpanNormalizer.test.ts`):** **110 / 0** (~20 ms) — was 73 on `27cff72`, +37 new MCP-EGI-009 tests.

Templated per-target (3 targets × 9 tests = 27):
1. missing key completed to null
2. completed packet validates and observation preserved
3. unnormalized packet (missing key) still fails validator
4. already-null value is preserved (no event)
5. **already-string value is NEVER overwritten** (critical-safety pin)
6. already-invalid value (object) is preserved + validator still rejects
7. missing from observations → NOT completed
8. missing from confidence → NOT completed
9. missing from checkedRawKeys → NOT completed
10. extra evidenceSpan key is NOT removed

(10 templated × 3 targets = 30 tests; some of the templated tests are 30 because of how the file structure works, plus 7 file-level tests.)

File-level (7):
- exports the three burst-observed rawKeys (drift guard + size === 3)
- event/category constants stability
- **length set ∩ key-set-completion set === ∅** (disjointness invariant)
- non-target rawKey missing: NOT completed (out of scope)
- multi-key packet: 3 simultaneous completions
- mixed packet: length + key-set events both fire in one call
- key-set events carry NO raw content (leak audit)
- observations + confidence + checkedRawKeys identity-preserved on key-set completion

**Full mcp-server Deno:** exit 0.

**npm typecheck:** clean.

**npm lint --max-warnings 0:** clean.

**Full Jest:** (running at PR open time; see PR body for the exact count).

---

## Deploy note: Deno Deploy bearing

MCP-EGI-009 changes are in `mcp-server/lib/` — those are served by the Deno Deploy production target `cdiscourse-mcp-server` (project subdomain `cdiscourse-mcp-server-39aev5ek2c4e.civildiscourse.deno.net`).

- Merge to `main` triggers an automatic Deno Deploy build via the GitHub integration (no manual command in the repo).
- A separate `GATE-DEPLOY/VERIFY mcp-server` gate confirms the production alias has been promoted to the new build (see `docs/deployment/mcp-server-001-runbook.md` and the operator dashboard verification pattern used for MCP-EGI-005 through MCP-EGI-008).
- This PR does NOT itself deploy. No `npx supabase functions deploy` is needed — no Edge functions changed.

---

## Next D3 burst after deploy

D3 remains FAIL until two prerequisites land:
1. PR merged + Deno Deploy production alias verified on the new build.
2. D3 burst rerun on the post-deploy revision exercises the 13-key length normalization (MCP-EGI-008) AND the 3-key key-set completion (MCP-EGI-009).

Possible outcomes of the next burst:
- **PASS:** all 72 cells succeed. The length-residual + key-set-missing classes are both cleared by the server-side normalization stack.
- **PARTIAL PASS:** the 13-key length-residual class is cleared; the 3-key key-set-missing class is cleared; remaining residuals (if any) point to a new validation class that needs a separate card (MCP-EGI-010 or beyond).
- **FAIL (regression):** any of the 13 length-targets or 3 key-set-targets fails on the new revision → deploy or merge regression; investigate via hosted-MCP replay.
- **FAIL (new class):** new validation class on a rawKey outside both locked sets → evidence-driven next card.

D4 remains BLOCKED until D3 PASS.

---

## Doctrine anchors

- `cdiscourse-doctrine §1` — completion to `null` asserts NOTHING; the existing observation+confidence remain the model's stated finding; only the absent structural anchor field is filled.
- `cdiscourse-doctrine §10a` — observations vs allegations; filling an absent key with `null` on key-set asymmetry is a STRUCTURAL act, not a quality verdict.
- OPS-MCP-KEY-LEVEL-FAIL-CLOSED — no divergence from family scanner ban-pattern stacks; the key-set pass introduces no new ban-pattern path because no content moves.

---

## Operator-controlled gates remaining

- Gate B independent review of PR (next gate after this card's open).
- Gate merge (PR squash to main).
- Gate deploy/verify mcp-server.
- D3 burst rerun.
- D4 rerun (BLOCKED until D3 PASS).
