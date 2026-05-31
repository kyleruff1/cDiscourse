# OPS-FAMILY-J-SCOPING-AUDIT — Intent brief (scoping audit; output is an audit doc)

**Operator:** Kyler
**Date:** 2026-05-31
**Card type:** Scoping audit — walk the composer-only and inspect-only disposition gates end-to-end for Family J. Determine whether Family J needs ANY production-enable cards or whether the existing disposition gating suffices.
**Predecessor:** ARCH-001 chain CLOSED. Family H/I chains queued. J is the open question.
**Trail:** Umbrella issue # [OPERATOR DECISION NEEDED]. Card issue # TBD.

> **DIFFERENT SHAPE** — not a server / audit-lint / edge-enable card replica. The deliverable IS a `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-<date>.md` output. No code change; no test change; no migration. Pure investigation + write-up.

---

## 1. Goal

Answer the question: **does Family J need ANY production-enable cards, or does the composer-only + inspect-only disposition gate fully suffice?**

OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.3 already produced a preliminary answer (gate suffices; no production card needed). This audit formalizes the finding, walks the gate verification end-to-end with detailed surface-by-surface analysis, and produces the authoritative scoping document.

---

## 2. Scope

**IN**
- Read `src/features/nodeLabels/machineObservationDefinitions/familyJ.ts` (5 keys: 3 composer_only + 2 inspect_only).
- Read `src/features/nodeLabels/nodeLabelPresentationModel.ts` — the `isDispositionEligible()` + `filterMarksBySurface()` gating logic.
- Walk each of the 5 J keys through each of the 4 surface contexts (`composer`, `timeline_node`, `selected_context`, `inspect`). Confirm: composer_only keys gated OUT on every non-composer surface; inspect_only keys gated OUT on every non-inspect surface; both kept on their respective target surfaces.
- Verify the existing tests pin this gating:
  - `__tests__/nodeLabelPresentationModel.test.ts` (or equivalent)
  - `__tests__/familyJ*.test.ts` if they exist
- Walk the integration paths:
  - `NodeLabelStrip.tsx` (Timeline node) calls filterMarksBySurface with 'timeline_node'
  - `NodeLabelInspectGroups.tsx` (Inspect popout) calls filterMarksBySurface with 'inspect'
  - Selected context paths
  - Composer paths

**OUT**
- NO code change.
- NO test change.
- NO migration.
- NO source-file edit.

---

## 3. Binding decisions

**D1 — Authored by: CC main-thread.** No subagent delegation. CC reads existing tests + source + nodeLabelPresentationModel and writes the audit doc. (Alternative: roadmap-designer subagent could author; but the audit is non-binding investigation, so main-thread is sufficient.) [OPERATOR DECISION NEEDED: confirm authorship — CC vs designer subagent].

**D2 — Output is `docs/audits/OPS-FAMILY-J-SCOPING-AUDIT-<date>.md`** with sections: header, scope, methodology, per-key gate walk, integration path verification, test coverage assessment, conclusion + recommendation.

**D3 — Conclusion = N production-enable cards needed**, where N ∈ {0, 1, 2, ...}. Phase 1 Agent 1.3 predicted **N = 0** (gate suffices).

**D4 — Audit-Lint: v1 marker present + `node scripts/ops/audit-lint.mjs <doc>` self-check.**

---

## 4. HALT triggers

1. **HALT 1** — Required-reading missing.
2. **HALT 2** — Standard preflight not green.
3. **HALT 7** (chain-binding) — Audit reveals composer-only / inspect-only disposition gate is NOT sufficient (i.e., a J key leaks past its gate to a wrong surface). This changes the conclusion from "N=0" to "needs production-enable card(s)." Surface to operator.
4. **HALT 8** — Test coverage assessment reveals a gap that contradicts the gate's correctness (e.g., the test pinning composer-only filtering is .skipped or missing). Surface; the audit verdict shifts.

---

## 5. Hard guardrails

- No source / test / migration change. Audit-only.
- Audit doc lives under `docs/audits/`.
- No `package.json` change.

---

## 6. Process

1. CC main-thread (or designer subagent per D1) reads source + tests + writes the audit doc.
2. Audit-lint self-check.
3. **PR open + HARD STOP at operator merge gate.**
4. Operator reviews + merges.

NOTE: this card has NO smoke phase. The audit IS the deliverable.

---

## 7. Expected conclusion (Phase 1 Agent 1.3 preview)

Based on OPS-WORKFLOW-RESTORATION Phase 1 Agent 1.3:
- 5 keys total: 3 composer_only + 2 inspect_only (NOT all composer_only as the chain prompt expected)
- Gate logic in `nodeLabelPresentationModel.ts` lines 158-183 (`isDispositionEligible()` exhaustive switch)
- `filterMarksBySurface()` lines 140-152
- Per-key walk: all 5 J marks correctly gated at every surface
- **Verdict: J needs 0 production-enable cards.** The composer-only and inspect-only dispositions correctly route the 5 marks; existing tests pin this.

The audit formalizes this verdict with explicit surface-by-surface walk + test coverage citation.

---

## 8. Post-merge

This card has no follow-up. Family J disposition is settled by the audit doc.
