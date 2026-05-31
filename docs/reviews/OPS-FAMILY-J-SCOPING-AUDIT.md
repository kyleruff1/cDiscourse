# OPS-FAMILY-J-SCOPING-AUDIT — Review

Audit-Lint: v1

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-31
**Card:** OPS-FAMILY-J-SCOPING-AUDIT (#398)
**Branch:** `docs/OPS-FAMILY-J-SCOPING-AUDIT`
**Intent brief:** `docs/designs/OPS-FAMILY-J-SCOPING-AUDIT-intent.md`
**Audit doc:** `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-2026-05-31.md`
**HEAD at review:** `488d105`

---

## Summary

The audit doc walks Family J's 5 keys (3 composer_only + 2 inspect_only,
all `sensitive_composer`) through the three concentric gates — Edge
`productionEnabled: false`, persistence-adapter surface acceptlist,
and the presentation-layer disposition gate — and concludes **N = 0**
production-enable cards needed. Source citations are accurate at
`488d105`; gate-walk semantics match the actual `isDispositionEligible`
exhaustive switch; test citations land on real pinning tests; doctrine
boundaries (§10a sensitive-composer surface routing) are preserved.
Audit-lint exits 0. No verdict tokens; no secret leaks. The doc is
ready as the authoritative Family J scoping document; #398 may close
on merge.

---

## Verification

| Check | Result |
|---|---|
| Audit-lint self-check (`node scripts/ops/audit-lint.mjs <doc>`) | exit 0 — audit-type=ops, findings=0 (PASS) |
| `Audit-Lint: v1` marker on line 3 | present (line 3 verbatim) |
| Secret scan (ANTHROPIC_API_KEY / SERVICE_ROLE / sk-ant / xai- / sb_secret_ / Bearer) | clean |
| Verdict-token scan (winner / loser / liar / stupid / idiot / extremist / propagandist) | clean |
| Source-citation accuracy at HEAD `488d105` | all 5 cited files verified verbatim (table below) |
| Gate-walk semantics vs `isDispositionEligible` switch | 4-of-4 sampled cells correct (table below) |
| Test-line citations | 4-of-4 cited lines verified exact |
| Doctrine compliance (`cdiscourse-doctrine` §10a / §1 / §3 / §4) | preserved; the audit reinforces the composer-only / inspect-only boundary |

---

## Source-citation verification

| # | File | Audit citation | Actual at `488d105` | Result |
|---|---|---|---|---|
| 1 | `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` | 5 J keys: 3 composer_only + 2 inspect_only, all `semantic_referee` / `sensitive_composer`; priorities 5, 6, 7, 53, 54 | Identical — keys at file lines 33–248, dispositions and priorities match table at audit §2 verbatim | PASS |
| 2 | `src/features/nodeLabels/nodeLabelPresentationModel.ts:140-183` | `filterMarksBySurface` (140-152) + `isDispositionEligible` (158-183) | Identical; exhaustive switch with `_exhaustive: never` enforcement at lines 158-183 | PASS |
| 3 | `src/features/nodeLabels/machineObservationPersistenceAdapter.ts:126-133` | Surface acceptlist rejecting non-(timeline\_node \| selected\_context \| inspect) | Verbatim block at lines 127-134 (audit cites 126-133; one-line skew on the opening blank-line boundary, exact match on the rejection statement) | PASS (no material discrepancy) |
| 4 | `supabase/functions/_shared/booleanObservations/familyRegistry.ts:114-118` | `sensitive_composer` `productionEnabled: false`, `adminValidationEnabled: true` | Identical at file lines 114-118 verbatim | PASS |
| 5 | `__tests__/nodeLabelPresentationModel.test.ts` lines 175, 182, 189, 210 | Per-disposition gate pins | All four line numbers land on the cited `it(...)` statements verbatim | PASS |
| 6 | `src/features/nodeLabels/NodeLabelStrip.tsx:111` | `filterMarksBySurface(combined, 'timeline_node')` | Exact at file line 111 | PASS |
| 7 | `src/features/nodeLabels/NodeLabelInspectGroups.tsx:110` | `filterMarksBySurface(combined, 'inspect')` | Exact at file line 110 | PASS |

The 1-line skew on cite #3 (audit says 126-133; the assignment + rejection
block actually spans 127-134) is cosmetic — the cited code text reproduced
in audit §5 matches the source verbatim and the semantic claim
(persistence-adapter rejects `composer` / `hidden` surfaces) is correct.
No correction required.

---

## Gate-walk verification (sample 5 of 20 cells)

The audit §7 table claims 20 / 20 cells correctly routed. Sampling 5
cells against the `isDispositionEligible` switch:

| # | rawKey | Disposition | Target surface | Audit | Switch returns | Result |
|---|---|---|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `composer_only` | `composer` | rendered | `'composer_only' && targetSurface === 'composer'` → TRUE | PASS |
| 2 | `shifts_to_person_or_intent` | `composer_only` | `timeline_node` | BLOCKED | FALSE | PASS |
| 3 | `needs_pre_send_pause` | `composer_only` | `inspect` | BLOCKED | FALSE | PASS |
| 4 | `uses_popularity_as_evidence` | `inspect_only` | `inspect` | rendered | `'inspect_only' && targetSurface === 'inspect'` → TRUE | PASS |
| 5 | `uses_satire_as_evidence` | `inspect_only` | `composer` | BLOCKED | FALSE | PASS |

All 5 sampled cells correct. The remaining 15 cells follow the same
mechanical rule (composer_only routes only to `composer`; inspect_only
routes only to `inspect`); the switch is exhaustive and `_exhaustive: never`
enforces compile-time completeness, so any drift would fail typecheck or
the per-disposition tests at lines 175/182.

**Conclusion: the audit's "20 / 20 cells correctly routed" claim is
sound.**

---

## Test coverage verification

The audit §9 cites four tests as the gate-pinning regression coverage.
All four verified at `488d105`:

| Test line | Citation accurate? | Pins what? |
|---|---|---|
| L175 — `it('inspect_only is ONLY eligible for inspect', ...)` | YES | iterates `ALL_NODE_LABEL_SURFACES`, expects `true` only for `'inspect'` |
| L182 — `it('composer_only is ONLY eligible for composer', ...)` | YES | iterates `ALL_NODE_LABEL_SURFACES`, expects `true` only for `'composer'` |
| L189 — `it('hidden_sensitive, future_source, intentionally_silent are NEVER eligible', ...)` | YES | defense in depth — never-render dispositions |
| L210 — `it('filterMarksBySurface excludes composer_only marks from timeline_node', ...)` | YES — uses `rawKey: 'shifts_to_person_or_intent'` (Family J key 1) | direct integration test on a real Family J key, exact surface (`timeline_node`) the audit names |

The L210 test in particular is load-bearing: it exercises a real
Family J `rawKey` against the most-dangerous surface (the public
Timeline) and asserts an empty result. A regression that loosens the
gate for composer_only marks would fail this test at CI.

**Test discipline (`test-discipline` skill) verdict:** PASS. Citations
are exact, the integration test exercises a real J key, no `.skip` /
`.only` / pending markers, no test files modified by this card.

---

## Doctrine compliance

The audit reinforces (not violates) `cdiscourse-doctrine`:

- **§10a (Observations vs Allegations + sensitive composer-only routing).**
  The audit's central thesis IS the §10a boundary: composer_only keys
  ("would read as accusation" if surfaced on a target node) route
  exclusively to the composer; the disposition gate enforces that.
  Audit §10 explicitly cites §10a + §1 + §3 + §4 anchors per-key.

- **§1 (no truth labels).** Audit §2 quotes each key's `doctrineNotes`
  block, which explicitly says the chip "never implies the author is
  a 'troll' or acting in bad faith." The audit body never invokes
  truth language.

- **§3 (popularity is not evidence).** Audit §2 + §10 surface
  `uses_popularity_as_evidence` and `uses_satire_as_evidence` as
  anchors for the §3 boundary; the inspect-only routing is the
  enforcement.

- **§4 (AI doesn't moderate).** Audit §10 cites §4 for `needs_pre_send_pause`
  — "AI does not delete or hide the move; it advises the author privately."

Verdict-token / banned-language scan (`winner|loser|liar|stupid|idiot|extremist|propagandist`):
clean.

Secret-scan (`ANTHROPIC_API_KEY|SERVICE_ROLE|sk-ant-|xai-|sb_secret_|Bearer `): clean.

---

## Audit doc structural integrity

- `Audit-Lint: v1` marker on line 3 (intent §D4 satisfied).
- Audit-lint self-check exits 0 with `audit-type: ops` and `findings: 0`.
- Single "PASS" verdict statement at audit §15 line 281: "**PASS.**
  Family J needs ZERO production-enable cards." This is the §D3
  binding decision satisfied: N = 0 production-enable cards.
- HALT triggers §14: all four (1, 2, 7, 8) correctly classified as
  NOT FIRED with justifications.

---

## Recommendation conformance

The audit's §13 recommendations are internally consistent and follow
from the gate-walk:

1. Close #398 on merge — supported by the N=0 verdict.
2. Do not file a Family J production-enable card unless future
   doctrine requires it — consistent with §10a boundary preservation.
3. Re-run audit if `isDispositionEligible` changes — backstopped by
   the four cited tests as the regression line.
4. Audit-lint marker is structural-only — accurate (audit-lint exits
   0; ops audits do not require a smoke-style verdict header).

---

## Blockers

None.

---

## Suggestions (non-blocking, future)

1. The cite at §5 ("lines 126-133") is one line off the actual
   `targetSurface` opening (the block starts at 127). The reproduced
   code text is exact; only the line range is slightly off. No fix
   required for this audit; a tiny correction could be folded into
   a future audit-doc convention pass if one happens.

2. The audit's §8 paragraph noting "the composer pipeline never
   queries timeline / selected / inspect marks (different source
   paths)" is structurally true but not cited to a specific file.
   For maximum reviewer-friendliness, a future revision could name
   the composer chip pipeline module (e.g., `composerObservationChips.ts`
   or wherever the composer-side mark loader lives) so a future
   reviewer can verify the claim without scanning. Not a blocker —
   the §10a doctrine and the disposition gate's reciprocal guard
   already make the claim sound.

These are quality-of-life improvements only. The card stands as
written.

---

## Operator next steps

- Confirm the review commit on `docs/OPS-FAMILY-J-SCOPING-AUDIT`.
- Push the branch: `git push -u origin docs/OPS-FAMILY-J-SCOPING-AUDIT`.
- Open PR titled `OPS-FAMILY-J-SCOPING-AUDIT: N=0 production-enable cards needed (#398)`
  with body referencing this review doc.
- On merge, close #398.
- No code change ships with this card — no Edge deploy, no migration,
  no smoke phase. The audit IS the deliverable.

---

**Final verdict: APPROVE.** The audit's verdict (N = 0 production-enable
cards needed) is supported by accurate source citations, correct
gate-walk semantics, real pinning tests, and `cdiscourse-doctrine`
§10a preservation. Ready for operator push + PR.
