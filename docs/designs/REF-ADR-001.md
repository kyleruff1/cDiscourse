# REF-ADR-001 — Move-intent doctrine: channels as the user-facing layer (pointer)

**Status:** PROPOSED — operator-ratified merge (GATE-C read; the merge is the ratification act)
**Epic:** Rules UX · **Priority:** P2 · **Effort:** S · **Lane:** docs-only ADR
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/590

This is a thin pointer. The full decision record lives at:

→ [`docs/designs/REF-ADR-001-MOVE-INTENT-DOCTRINE.md`](./REF-ADR-001-MOVE-INTENT-DOCTRINE.md)

**Decision in one line:** Adopt Option 0 — canonize the move-intent doctrine in the ADR *beside* the Constitution,
with **no change to `docs/core/constitution-v1.md`**. The stored type registry (`CLM`/`RBT`/`CRB`/`EVD`/`CLR`/`CON`/`SYN`)
and the transition matrix stay the validation layer (unchanged); RULE-005's channels are the user-facing move-intent
vocabulary; the matrix becomes a hidden affordance + recovery system; `replies` is the internal fallback relation
(never preferred, never debt-clearing, never raw copy, per issue #584 GATE-A decision 2).

Structural model: `docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md`. Soft-fed by / ratifies in parallel with
REF-001 (`docs/designs/REF-001-DISAGREEMENT-CONTRACT-REFEREE-CARD.md`).
