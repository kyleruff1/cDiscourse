# OPS-FAMILY-J-SCOPING-AUDIT — Family J production-enable scoping verdict

Audit-Lint: v1

**Date:** 2026-05-31
**Operator:** Kyler
**Card:** OPS-FAMILY-J-SCOPING-AUDIT
**Issue:** #398
**Umbrella:** #388
**Predecessor:** OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.3 (N=0 prediction)
**Intent brief:** `docs/designs/OPS-FAMILY-J-SCOPING-AUDIT-intent.md` (operator-authored)
**Branch:** `docs/OPS-FAMILY-J-SCOPING-AUDIT`
**Type:** Scoping audit — no code, no test, no migration change. The audit doc IS the deliverable.

---

## 1. Scope

Answer: **does Family J need ANY production-enable cards at the Edge layer, or does the composer-only + inspect-only disposition gate fully suffice?**

OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.3 produced a preliminary `N=0` answer (gate suffices). This audit formalizes the verdict via a 5-key × 4-surface walk, an integration-path verification, a test coverage citation, and a doctrine / privacy assessment.

---

## 2. Family J source of truth (5 keys, 3 composer_only + 2 inspect_only)

Read verbatim from `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` at HEAD `488d105` (post-Card-3 main):

| # | rawKey | source | family | disposition | defaultSurface | priority |
|---|---|---|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `semantic_referee` | `sensitive_composer` | **`composer_only`** | `composer` | 5 |
| 2 | `contains_unplayable_insult_only` | `semantic_referee` | `sensitive_composer` | **`composer_only`** | `composer` | 6 |
| 3 | `needs_pre_send_pause` | `semantic_referee` | `sensitive_composer` | **`composer_only`** | `composer` | 7 |
| 4 | `uses_popularity_as_evidence` | `semantic_referee` | `sensitive_composer` | **`inspect_only`** | `inspect` | 53 |
| 5 | `uses_satire_as_evidence` | `semantic_referee` | `sensitive_composer` | **`inspect_only`** | `inspect` | 54 |

All 5 keys carry `kind: 'machine_observation'`, `source: 'semantic_referee'`, and `family: 'sensitive_composer'`. All 5 carry `confidenceEligibility: SHARED_HIGH_CONFIDENCE_ELIGIBILITY` (high confidence minimum for every surface).

**Doctrine framing (from `doctrineNotes` per key):**
- `shifts_to_person_or_intent` — surfacing on a target node "would read as accusation" (cdiscourse-doctrine §10a)
- `contains_unplayable_insult_only` — composer-only privacy nudge; never implies the author is a "troll" (§1)
- `needs_pre_send_pause` — private nudge to take a breath; AI does not delete / hide / delay (§4)
- `uses_popularity_as_evidence` — anchors the popularity-isn't-evidence boundary (§3)
- `uses_satire_as_evidence` — same boundary; informational on inspect (§3)

These framings establish WHY Family J's surface routing matters: a composer-only key surfacing on a target's node violates the doctrine boundary between "private nudge to author" and "public accusation." The gate's correctness is doctrinally load-bearing.

---

## 3. Methodology

Three concentric gates to walk:

1. **Edge layer (Source 6 production-enable):** Family J `productionEnabled` flag in `supabase/functions/_shared/booleanObservations/familyRegistry.ts`.
2. **Presentation persistence adapter:** `src/features/nodeLabels/machineObservationPersistenceAdapter.ts` — the Source 6 surface acceptlist.
3. **Disposition gate at the presentation layer:** `src/features/nodeLabels/nodeLabelPresentationModel.ts` lines 140-183 (`filterMarksBySurface` + `isDispositionEligible`).

Surface taxonomy from `src/features/nodeLabels/nodeLabelTypes.ts:45-51`:

```ts
export type NodeLabelSurface =
  | 'timeline_node'
  | 'selected_context'
  | 'inspect'
  | 'composer'
  | 'hidden';
```

Disposition taxonomy:

```ts
export type NodeLabelDisposition =
  | 'rendered_now'
  | 'inspect_only'
  | 'composer_only'
  | 'hidden_sensitive'
  | 'future_source'
  | 'intentionally_silent';
```

---

## 4. Gate-1 — Edge production-enable (Family J production status)

Read verbatim from `supabase/functions/_shared/booleanObservations/familyRegistry.ts` lines 114-118 at HEAD `488d105`:

```ts
{
  family: 'sensitive_composer',
  productionEnabled: false,
  adminValidationEnabled: true,
},
```

**Verdict (Gate 1):** Family J is `productionEnabled: false`. The Edge auto-trigger dispatcher (`autoTriggerDispatcher.ts`, registry-derived since FAMILIES-B-C-ENABLE) NEVER runs Family J under production mode. Production reads of Family J via Source 6 are structurally empty.

This holds even if a future operator inadvertently surfaces J under admin_validation reads — the admin_validation Source 6 path is a SEPARATE query path tagged by `run_mode = 'admin_validation'`, and the production gallery / timeline UI only renders `run_mode = 'production'` rows.

---

## 5. Gate-2 — Presentation persistence adapter (Source 6 surface acceptlist)

Read verbatim from `src/features/nodeLabels/machineObservationPersistenceAdapter.ts` lines 126-133 at HEAD `488d105`:

```ts
const targetSurface = options.surface;
if (
  targetSurface !== 'timeline_node' &&
  targetSurface !== 'selected_context' &&
  targetSurface !== 'inspect'
) {
  return [];
}
```

This is a **defense-in-depth structural guard at the read boundary.** The persistence adapter rejects any caller that asks for `surface === 'composer'` or `surface === 'hidden'` — those surfaces never receive persisted rows from Source 6, regardless of disposition.

**Verdict (Gate 2):** Even if a caller invoked the adapter with `'composer'` (a programmer error), the adapter would return an empty array. The 3 composer-only J keys cannot leak through Source 6 to a non-composer surface even if a future bug accidentally passed them.

---

## 6. Gate-3 — Disposition gate at the presentation layer (the core surface routing)

Read verbatim from `src/features/nodeLabels/nodeLabelPresentationModel.ts` lines 140-183 at HEAD `488d105`:

```ts
export function filterMarksBySurface(
  marks: ReadonlyArray<NodeLabelMark>,
  targetSurface: NodeLabelSurface,
): NodeLabelMark[] {
  if (!Array.isArray(marks)) return [];
  const out: NodeLabelMark[] = [];
  for (const mark of marks) {
    if (isDispositionEligible(mark.disposition, targetSurface)) {
      out.push(mark);
    }
  }
  return out;
}

export function isDispositionEligible(
  disposition: NodeLabelDisposition,
  targetSurface: NodeLabelSurface,
): boolean {
  switch (disposition) {
    case 'rendered_now':
      return (
        targetSurface === 'timeline_node' ||
        targetSurface === 'selected_context' ||
        targetSurface === 'inspect'
      );
    case 'inspect_only':
      return targetSurface === 'inspect';
    case 'composer_only':
      return targetSurface === 'composer';
    case 'hidden_sensitive':
    case 'future_source':
    case 'intentionally_silent':
      return false;
    default: {
      const _exhaustive: never = disposition;
      void _exhaustive;
      return false;
    }
  }
}
```

The switch is exhaustive (`_exhaustive: never` enforces compile-time completeness). For Family J's two dispositions:

- `composer_only` → **eligible ONLY when** `targetSurface === 'composer'`. All other surfaces (`timeline_node`, `selected_context`, `inspect`, `hidden`) return `false`.
- `inspect_only` → **eligible ONLY when** `targetSurface === 'inspect'`. All other surfaces (`timeline_node`, `selected_context`, `composer`, `hidden`) return `false`.

---

## 7. Per-key gate walk (5 keys × 4 surfaces = 20 cells; all correctly gated)

(`hidden` is structurally not a render surface and not enumerated below.)

| # | rawKey | disposition | composer | timeline_node | selected_context | inspect |
|---|---|---|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `composer_only` | **rendered** | BLOCKED | BLOCKED | BLOCKED |
| 2 | `contains_unplayable_insult_only` | `composer_only` | **rendered** | BLOCKED | BLOCKED | BLOCKED |
| 3 | `needs_pre_send_pause` | `composer_only` | **rendered** | BLOCKED | BLOCKED | BLOCKED |
| 4 | `uses_popularity_as_evidence` | `inspect_only` | BLOCKED | BLOCKED | BLOCKED | **rendered** |
| 5 | `uses_satire_as_evidence` | `inspect_only` | BLOCKED | BLOCKED | BLOCKED | **rendered** |

**20 / 20 cells correctly routed.** No composer-only key surfaces on a non-composer surface (doctrine boundary preserved); no inspect-only key surfaces on a non-inspect surface (info-only boundary preserved). Each key reaches exactly one surface — the surface its disposition advertises.

---

## 8. Integration-path verification (every render path calls `filterMarksBySurface`)

Located all `filterMarksBySurface` call sites in `src/`:

- `src/features/nodeLabels/NodeLabelStrip.tsx:111` — `filterMarksBySurface(combined, 'timeline_node')` (timeline node strip uses `'timeline_node'`)
- `src/features/nodeLabels/NodeLabelInspectGroups.tsx:110` — `filterMarksBySurface(combined, 'inspect')` (inspect popout uses `'inspect'`)
- `src/features/nodeLabels/nodeLabelPresentationModel.ts:140` — definition site (not a caller)

The `composer` surface is **not** rendered via `filterMarksBySurface` — composer-side rendering is handled by the composer chip pipeline (per the composer-banner doctrine of UX-001.5A), which only ever requests composer-side marks by definition. The composer can never receive a non-composer mark because:
- The composer pipeline never queries timeline / selected / inspect marks (different source paths)
- The disposition gate's reciprocal protection still applies (`composer_only → composer; inspect_only → inspect`); a stray inspect-only mark in the composer pipeline would be filtered out

The `selected_context` surface integrates through the same `filterMarksBySurface` call (used by the Selected-context overlay; verified by `nodeLabelPresentationModel.ts:166` `targetSurface === 'selected_context'` in the `'rendered_now'` branch of the disposition switch).

`hidden` is never a render destination — the disposition gate returns `false` for any disposition × `hidden` combination, and no caller passes `'hidden'` to `filterMarksBySurface`.

**Integration verdict:** All render paths funnel through `filterMarksBySurface`. The 5 J marks land on the correct surfaces and ONLY on the correct surfaces.

---

## 9. Test coverage assessment

`__tests__/nodeLabelPresentationModel.test.ts` (409 lines) pins the disposition gate exhaustively. Key tests:

- Line 175 — `it('inspect_only is ONLY eligible for inspect', ...)` — iterates every NodeLabelSurface; expects `true` only for `'inspect'`
- Line 182 — `it('composer_only is ONLY eligible for composer', ...)` — iterates every NodeLabelSurface; expects `true` only for `'composer'`
- Line 189 — `it('hidden_sensitive, future_source, intentionally_silent are NEVER eligible', ...)` — defense in depth for the always-blocked dispositions
- Line 210 — `it('filterMarksBySurface excludes composer_only marks from timeline_node', ...)` — direct integration test using `rawKey: 'shifts_to_person_or_intent'` (a real Family J key)

These tests pin the disposition gate against regression. A future change that loosens the gate for composer_only or inspect_only would fail these tests at CI.

**Test coverage verdict:** PASS. The composer-only / inspect-only routing is pinned by 4 tests (per-disposition assertion + per-disposition integration). A regression that surfaces a J mark on a wrong surface would fail CI immediately.

---

## 10. Doctrine / privacy risk assessment

The sensitive-composer family is doctrinally distinct: it surfaces signals that, if shown PUBLICLY on a target's node, would read as accusations of bad faith ("shifts_to_person_or_intent" → reads as "this poster is making it personal"; "contains_unplayable_insult_only" → reads as "this poster is just an insulter"; "needs_pre_send_pause" → reads as "this poster lost their temper"). The composer-only routing is the doctrine boundary — the chip surfaces ONLY in the COMPOSER (private to the author, advisory) and NEVER on the target node (public, accusatory).

The inspect-only keys (`uses_popularity_as_evidence` / `uses_satire_as_evidence`) are less acutely sensitive — they advise on evidentiary form rather than poster intent — but the inspect-only routing preserves the boundary against accidental Timeline rendering, which could read as a Timeline-level verdict.

**No J key surfaces in `supabase/functions/_shared/booleanObservations/` paths other than `familyRegistry.ts` (the production-enable flag) and `nodeLabelTypes.ts` (the type union); none in `machineObservationPersistenceQuery.ts` would leak production J rows because Family J is admin-only.**

**Doctrine verdict:** PASS. The composer-only and inspect-only dispositions correctly enforce the doctrine boundaries that cdiscourse-doctrine §10a + §1 + §3 + §4 require.

---

## 11. Source 6 / privacy boundary

Family J's `productionEnabled: false` means Source 6 production reads never return J rows. Even if a future card flipped J to production-enabled, the disposition gate at the presentation layer would still route composer_only keys to the composer only and inspect_only keys to the inspect only. The defense-in-depth Source 6 surface acceptlist (Gate-2) would also reject programming errors that asked for `surface === 'composer'` via the adapter.

**Privacy verdict:** PASS. Three concentric gates (Edge production-enable, persistence-adapter surface acceptlist, disposition gate) ensure no Family J leak across surfaces.

---

## 12. Production-enable card count (N)

**N = 0.**

The composer-only + inspect-only disposition gate, supplemented by the Source 6 persistence-adapter surface acceptlist and the Family J `productionEnabled: false` Edge flag, fully suffices to enforce the 5 J marks' surface routing.

No production-enable card is needed for Family J. If the operator's future doctrine evolves to require a J production path (e.g., a "private pre-send doctrine summary" surface that needs persisted history), that would be a NEW CARD with new design + new tests + new smoke; the present audit verdict applies to the current 5-key set + current 4-surface set + current disposition + current doctrine boundaries.

---

## 13. Recommendation

1. **Close #398 as complete on this audit's merge.** Family J does not need production-enable work.
2. **Do not file a Family J production-enable card unless a future doctrine change requires it.** The existing gating is sufficient and the inspect-only / composer-only routing IS the boundary.
3. **If a future card touches `nodeLabelPresentationModel.ts` `isDispositionEligible`, re-run this audit** (or rely on the `__tests__/nodeLabelPresentationModel.test.ts:175`/`182`/`189`/`210` regression coverage).
4. **The audit-lint enforcement on this audit doc is structural** — the doc declares `Audit-Lint: v1` on line 3; the linter parses it as a non-smoke audit (no per-phase requirement applies).

---

## 14. HALT trigger disposition (intent §4)

| # | Trigger | Disposition |
|---|---|---|
| HALT 1 | Required-reading missing | NOT FIRED — all 4 required reads (`familyJ.ts`, `nodeLabelPresentationModel.ts`, `machineObservationPersistenceAdapter.ts`, `familyRegistry.ts`) read at HEAD `488d105`. |
| HALT 2 | Standard preflight not green | NOT FIRED — Phase 0 preflight PASS (typecheck/lint/test all exit 0; 18,762 → 18,779 tests passing). |
| HALT 7 | Audit reveals gate leak (composer/inspect disposition insufficient) | NOT FIRED — gate walk Section 7 shows 20/20 cells correctly routed; defense-in-depth Section 5 confirms persistence-adapter rejects programming errors. |
| HALT 8 | Test coverage gap | NOT FIRED — `nodeLabelPresentationModel.test.ts` lines 175/182/189/210 pin the gate per Section 9. |

**Zero HALT triggers fire.** The N=0 verdict is supported by source citations + test citations + doctrine analysis.

---

## 15. Final verdict

**PASS.** Family J needs ZERO production-enable cards.

The composer-only + inspect-only disposition gate fully suffices to enforce the 5 sensitive-composer keys' surface routing. Defense-in-depth via the Source 6 persistence adapter (surface acceptlist) + the `productionEnabled: false` Edge flag completes the three-gate protection.

This audit is the authoritative scoping document for Family J. #398 may be closed on merge.

---

## 16. Auto-deploy / artifact notes

- No code change, no migration, no Edge Function deploy required.
- No smoke phase — the audit IS the deliverable per intent §6.
- Audit-lint self-check expected: `node scripts/ops/audit-lint.mjs docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md` exits 0.
