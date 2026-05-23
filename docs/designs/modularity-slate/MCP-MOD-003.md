# MCP-MOD-003 — Prompt template inventory (`docs/architecture/semantic-referee-prompt-template.md`)

**Card:** MCP-MOD-003 (Rules UX · P2 · S · Release 6.9 · Movement A).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** A (documentation).
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-001 (subfolder convention).
**Unblocks:** MCP-MOD-005 (the prompt template refactor consumes this inventory).
**Complements:** MCP-MOD-002 (the classifier catalog inventory) — `002` covers the classifier-facing side, `003` covers
the prompt-facing side.

---

## 1. Goal

Document how the seed prompt is constructed: the system-prompt boilerplate, the per-id structural-question template,
how the redacted input block is assembled from the room state, and where each piece lives in the codebase. After this
card, a reader knows what the model sees on every classify call without reading code.

## 2. File created

`docs/architecture/semantic-referee-prompt-template.md`. A single document, structured by the prompt's actual layered
shape:

1. **System prompt** — the `SEMANTIC_REFEREE_SYSTEM_PROMPT` constant verbatim, with annotations naming which doctrine
   line each clause enforces (cdiscourse-doctrine §1 / MCP-001 §10 / etc.).
2. **User-message instruction** — the strict-JSON contract instructions from `seedPrompt.ts:139-148` verbatim, annotated.
3. **Per-id question list** — how `buildClassifierPrompt` selects only the requested classifiers and emits one line per id.
4. **Redacted input block** — how `buildInputBlock` assembles the room context, the parent body, and the move body.
5. **Source file map** — which file owns which piece (system prompt → `anthropicClassifierCore.ts`; question text →
   `seedPrompt.ts`; redaction → `redaction.ts`; etc.).
6. **Prompt version stamping** — how `SEED_PROMPT_VERSION` is bumped when the wording changes, and the test
   `__tests__/semanticAnthropicSeedPromptBanList.test.ts` that enforces ban-list compliance.

## 3. Method

The implementer transcribes the existing prompt code without semantic changes. The goal is faithful documentation, not
prompt engineering. Every quoted string in the document is a byte-faithful copy from the source.

The implementer also documents the prompt's invariants — properties a future change must preserve:

- The system prompt's "Absolute rules" list (no truth, no winner, no popularity-as-evidence, no person labels, no
  blocking, advisory only) is doctrine — a future change cannot remove a rule without a roadmap-level decision.
- The user-message instruction's "Return ONLY a single JSON object" line is the contract wall the parser depends on.
- The per-id questions are STRUCTURAL — every question asks about the move's structure (continuity, evidence, hygiene),
  never about truth, correctness, popularity, or the participant.
- The ban-list test enforces these invariants automatically.

## 4. Tests

This card is documentation-only. The acceptance check is:

- A new optional test `__tests__/semanticRefereePromptTemplateParity.test.ts` that source-scans the inventory document
  AND `anthropicClassifierCore.ts` + `seedPrompt.ts`, asserting (a) the system-prompt block in the inventory matches the
  `SEMANTIC_REFEREE_SYSTEM_PROMPT` constant byte-for-byte, (b) the user-message instruction block matches
  `seedPrompt.ts:139-148`, (c) the per-id question template documented in the inventory matches `buildClassifierPrompt`'s
  output for a fixed sample request. A drift forces the doc-author to update the inventory; it never silently rots.

## 5. Findings to surface

While writing the inventory, the implementer flags (in a closing §"Findings" section):

- Any drift between the system-prompt's "Absolute rules" list and the ban-list test's enforced tokens.
- Any per-id question that does not start with a "Does this move..." or equivalent structural phrasing.
- Any duplication between the system prompt and the user-message instruction.

These findings inform MCP-MOD-005 (the prompt refactor) but are NOT fixed here.

## 6. Acceptance criteria

- [ ] `docs/architecture/semantic-referee-prompt-template.md` exists and walks through the six sections in §2.
- [ ] Every quoted string in the document is a byte-faithful copy from `anthropicClassifierCore.ts` or `seedPrompt.ts`.
- [ ] `__tests__/semanticRefereePromptTemplateParity.test.ts` exists and passes.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] The meta-roadmap is updated to link to the new inventory document.

## 7. Risks

- **The prompt has implicit invariants that aren't in code comments.** Mitigation: the implementer surfaces them in the
  inventory's annotations and §"Invariants" subsection.

## 8. Not in scope

- Changing the seed prompt. That is MCP-MOD-005's territory.
- Adding new prompt elements (full-thread context, author identifications) — that is MCP-MOD-008's territory.
- Reorganizing the prompt files.
