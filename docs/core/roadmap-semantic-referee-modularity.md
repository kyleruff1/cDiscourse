# CDiscourse — Semantic-referee modularity roadmap (2026-05-22)

**Type:** Roadmap expansion. No production code in this document. Each card is a separate piece of work with its own
design summary at `docs/designs/modularity-slate/MCP-MOD-NNN.md` and its own GitHub issue.

**Status:** Planning artifact only. None of the 8 cards has started its pipeline.

**Future location:** This document lives at `docs/roadmap-expansions/` because card MCP-MOD-001 (documentation
reorganization) has not landed yet. After MCP-MOD-001 lands, this document moves (via `git mv`) to
`docs/core/roadmap-semantic-referee-modularity.md`, alongside the other foundational repo docs. The move is part of
MCP-MOD-001's checklist.

**Companion docs:**
- [`docs/designs/MCP-001.md`](../designs/MCP-001.md) — semantic-referee architecture, binary classifier contract, 23-id catalog v0.
- [`docs/roadmap-expansions/2026-05-20-mcp-semantic-referee-roadmap.md`](2026-05-20-mcp-semantic-referee-roadmap.md) — the parent MCP-* roadmap; this slate is the modularity follow-up.
- [`docs/semantic-prompts/mcp-semantic-referee-prompt-bank.md`](../semantic-prompts/mcp-semantic-referee-prompt-bank.md) — the 90-seed prompt-library seed bank.
- [`docs/testing-runs/2026-05-22-smoke-test-failure-investigation.md`](../testing-runs/2026-05-22-smoke-test-failure-investigation.md) — the investigation that surfaced the diagnostic gaps this slate also addresses.
- [`docs/designs/SMOKE-FIX-001.md`](../designs/SMOKE-FIX-001.md) — the focused fix that restores live classification quickly. This slate is independent of SMOKE-FIX-001 / SMOKE-FIX-002; both can ship in parallel.

**Board:** GitHub Project #1.

---

## 1. Why this slate exists

The MCP-001 through MCP-019 / ADMIN-AI-001 / MCP-018 family shipped a working semantic-referee tree: 23 classifier ids in
a catalog, a seed prompt with one structural question per id, a content-safety scanner that mirrors the schema, a banner
library that maps classifier outputs to user-facing copy, a deterministic referee ledger that records feedback per
classifier id, and a live Anthropic provider behind an admin-controlled runtime config switch.

That tree works. It is also **not yet modular**. Today, changing the wording of a single classifier question requires
touching at least four files: the catalog declaration (id), the seed prompt template (question text), the banner library
(banner copy for that classifier), and the ledger feedback codes (per-id feedback). Reviewing or auditing the tree
requires reading those four files in lockstep — and no single document tells a new reader "here is what each classifier
id is, what binary it detects, what is asked of the AI to detect it, what banner shows when, and what ledger feedback
fires." The MCP-001 design spec describes the contract but does not catalogue per-id semantics in one place.

The slate ships in three movements:

**Movement A — documentation (cards 1, 2, 3).** Restructure foundational docs and produce two architectural inventories
(classifier catalog + prompt template). These are documentation-only cards; no code moves. They serve as the
ground truth for the refactor cards that follow.

**Movement B — modularity refactor (cards 4, 5, 6).** Consolidate the classifier definitions into a single TypeScript
source-of-truth, then refactor the seed prompt, the banner library, and the ledger to consume it. After Movement B,
changing a classifier's question text or banner copy is a single-file change.

**Movement C — triggering rule (cards 7, 8).** Introduce move-position tracking (1st / 2nd / later move per author per
debate) and use it to skip classification on each participant's first move. From each participant's second move onward,
classification fires with the full thread context including author identifications. This is a behavior change, not a
refactor, and it depends on Movement B's source-of-truth landing first.

## 2. Doctrine constraints (inherited; non-negotiable)

Every card in this slate is bound by `cdiscourse-doctrine` and the MCP semantic-referee roadmap's §3 list. Briefly:

1. AI never decides who is right. No classifier returns a truth value, a verdict, or a winner.
2. AI never blocks an ordinary post. The semantic packet is advisory metadata only.
3. `authoritative` is always `false`.
4. Popularity / heat / virality is never evidence.
5. AI never runs on the client.
6. No verdict / person labels in user-facing copy.
7. All semantic calls are mocked by default in tests.
8. No `snake_case` internal codes in user-facing strings.

Slate-specific constraints:

- **Movement B preserves behavior.** The source-of-truth extraction is a refactor: every existing test must still pass.
  Adding behavior tests for the consolidated constant is allowed; changing observed behavior is not.
- **Movement C is gated by Movement B.** The triggering rule reads the source-of-truth's `messagePositionTrigger` field
  (added by card MCP-MOD-007) or equivalent; it cannot ship before the source-of-truth exists.
- **The smoke-test framework is the regression check.** After each Movement B card lands, the operator re-runs
  `scripts/bot-fixtures/runMcpSmokeTest.js` and confirms it still passes. The framework was committed in commit `daf3dad`
  and is gitignored as a fixture; it does not need a CI hook to serve as a regression baseline.

## 3. Card list — 8 cards in dependency order

| Code | Title | Movement | Depends on | Deliverable | Risk | Effort |
|---|---|---|---|---|---|---|
| MCP-MOD-001 | Documentation reorganization (`docs/core/`) | A | — | `docs/core/` exists; foundational docs moved with preserved history; cross-references updated | Low | S |
| MCP-MOD-002 | Classifier catalog inventory | A | MCP-MOD-001 | `docs/architecture/semantic-referee-classifier-catalog.md` — one row per classifier id with binary signal, AI question, banner code, ledger feedback code, source-file path | Low | S |
| MCP-MOD-003 | Prompt template inventory | A | MCP-MOD-001 | `docs/architecture/semantic-referee-prompt-template.md` — seed prompt structure, per-id question mapping, context assembly | Low | S |
| MCP-MOD-004 | Source-of-truth extraction | B | MCP-MOD-002, MCP-MOD-003 | A single TypeScript constant `SEMANTIC_CLASSIFIER_CATALOG` (per classifier: id, structural question, banner code, ledger code, optional metadata); existing files import from it | Medium | M |
| MCP-MOD-005 | Prompt template refactor | B | MCP-MOD-004 | `seedPrompt.ts` builds the question list by iterating the source-of-truth; deleting/renaming a per-id hand-written line becomes impossible | Low | S |
| MCP-MOD-006 | Banner + ledger refactor | B | MCP-MOD-004 | Banner library and ledger feedback consume the source-of-truth's banner-code and ledger-code mappings; no per-id duplicate code | Low | S |
| MCP-MOD-007 | Move-position tracking helper | C | MCP-MOD-004 | `getMovePositionForAuthor(debateId, authorId, moveId)` derives 1st / 2nd / later; tests but no behavioral change yet | Low | S |
| MCP-MOD-008 | Move-position-aware triggering rule | C | MCP-MOD-007 | `evaluateTrigger` consults move position; first move per participant skips classification; from second move on, classification fires with full-thread context including author identifications | Medium | M |

**Risk values** reflect the project board's Risk field (Low/Medium/High). Effort uses the project board's S/M/L/XL scale.

## 4. Recommended sequencing

The cards have a strict dependency DAG; the recommended sequence is:

1. **MCP-MOD-001 (docs reorg)** — clears the way for the meta-roadmap to move into `docs/core/`. Pure infrastructure;
   no semantic-referee code touched.
2. **MCP-MOD-002 + MCP-MOD-003 (inventories)** — can ship in parallel; both depend on `001` (for the destination
   subfolder `docs/architecture/`).
3. **MCP-MOD-004 (source-of-truth extraction)** — the keystone refactor. Reviewers must verify that every existing
   reference to a classifier id, question text, banner code, or ledger code now flows through the new constant.
4. **MCP-MOD-005 (prompt) + MCP-MOD-006 (banner/ledger)** — can ship in parallel; both depend on `004`.
5. **MCP-MOD-007 (move-position helper)** — depends on `004` (the helper's interface is defined alongside the
   source-of-truth metadata). No behavior change yet.
6. **MCP-MOD-008 (triggering rule)** — depends on `007` (it consumes the helper) and on `005` (the prompt template must
   already support full-thread context). This is the only card that changes user-observable behavior.

After each Movement B / C card, re-run the smoke test as the regression baseline.

## 5. Relationship to SMOKE-FIX-001 / SMOKE-FIX-002

This slate is **independent** of the SMOKE-FIX cards. The fix cards restore live classification quickly; the modularity
slate is the longer-term refactor that makes future changes cheaper. Specifically:

- **Order of operations**: SMOKE-FIX-001 ships first (restores the live provider). Then MCP-MOD-001 can start. The slate
  proceeds in dependency order from there.
- **Smoke-test regression check**: once SMOKE-FIX-001 lands and the smoke test passes, the same test framework is the
  regression check after every Movement B and C card. A breaking refactor surfaces immediately.
- **No shared code**: SMOKE-FIX-001 touches `schema.ts` (one line) and `anthropicProvider.ts` (two log lines).
  MCP-MOD-004 touches `seedPrompt.ts`, `mockProvider.ts`, banner files, and ledger files — none of which the fix card
  modifies. The fix card and `004` can co-exist on the same branch trivially.
- **Diagnostic logging from SMOKE-FIX-001 stays.** The `console.warn` lines added by SMOKE-FIX-001 / B1 remain useful
  after Movement B completes — they continue to surface category-level failures regardless of how the catalog is
  structured.

If the operator wants to run SMOKE-FIX-002 (the remediation card driven by SMOKE-FIX-001's logs) before starting the
modularity slate, that's the recommended sequence — restore the system first, then refactor a working system.

## 6. Risks and open questions

### Risks

- **MCP-MOD-004 silently changes behavior.** The keystone refactor is the highest-risk card. Mitigation: the smoke-test
  framework + the existing test suite + the source-of-truth's unit tests + a parity test asserting every classifier id
  in the new constant matches the previously-shipped catalog.
- **MCP-MOD-008 changes what users see.** Skipping classification on each participant's first move is a behavior change;
  users on their first move will not see a referee banner. Mitigation: design summary §"User impact" documents this
  explicitly; a release note accompanies the card.
- **The triggering rule's "full thread context" payload could blow the token budget.** Mitigation: MCP-MOD-008's design
  summary names the token budget check explicitly and points at `isWithinBudget` (already in the codebase) as the
  enforcement point.
- **Documentation reorganization breaks tools.** Some agents and scripts may have hardcoded paths to `docs/current-status.md`
  or `docs/project.md`. Mitigation: MCP-MOD-001's checklist includes scanning `.claude/`, `scripts/`, and the
  GitHub-projects tooling for hardcoded paths; the move uses `git mv` so blame history survives.

### Open questions

- **Should "messagePositionTrigger" live in the source-of-truth or in the trigger gate?** Recommendation:
  in the trigger gate (`triggerGates.ts` already owns moment-level decisions). The source-of-truth carries
  per-classifier metadata; "when this classifier may run for a given move position" is a moment-level decision and
  belongs alongside `isNonParticipantRole`, not in the catalog.
- **Should MCP-MOD-008 also apply to chime-in branches?** Recommendation: the design summary leaves this open for the
  card's design phase. Stage 6.4's observer-first posture suggests "yes" but the analysis belongs in MCP-MOD-008's
  design, not this roadmap.

## 7. What this slate does NOT do (out of scope, name them so they don't accrete)

- **Live multi-classifier batching beyond the existing ≤ 5 per call.** The current 2-batch limit is preserved.
- **New classifier ids.** The 23-id catalog v0 is frozen until a future MCP- card explicitly proposes additions.
- **New providers.** The `anthropic` / `mcp` / `mock` / `fixture` slots are the only providers.
- **Synthesis summaries, persisted packet caches, or expensive-tier model routing.** Already out of scope per MCP-001.
- **Voting, winner-producing scoring, real-time collab, OAuth, push notifications, public API.** v1 scope.

## 8. Operator launch checklist

After all 8 issues are filed and added to Project #1 (this document is the planning artifact for that), launching the
slate involves:

1. Confirm SMOKE-FIX-001 (and optionally SMOKE-FIX-002) has shipped and the smoke test passes.
2. Launch MCP-MOD-001 via the standard autonomous pipeline (spawn `roadmap-designer` → `roadmap-implementer` →
   `roadmap-reviewer` → PR → squash-merge → close issue).
3. After MCP-MOD-001 lands, `git mv` this document to `docs/core/roadmap-semantic-referee-modularity.md` as part of
   the card's deliverable.
4. Launch MCP-MOD-002 and MCP-MOD-003 in parallel.
5. After both inventories land, launch MCP-MOD-004.
6. After `004` lands and the smoke test re-runs clean, launch MCP-MOD-005 and MCP-MOD-006 in parallel.
7. After `005` and `006` land, launch MCP-MOD-007.
8. After `007` lands, launch MCP-MOD-008.

The operator decides each launch — no automation in this document.
