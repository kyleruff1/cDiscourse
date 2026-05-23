# MCP-MOD-002 — Classifier catalog inventory (`docs/architecture/semantic-referee-classifier-catalog.md`)

**Card:** MCP-MOD-002 (Rules UX · P2 · S · Release 6.9 · Movement A).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** A (documentation).
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md) (after MCP-MOD-001 moves it) — or `docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md` if MCP-MOD-001 has not yet shipped.
**Depends on:** MCP-MOD-001 (the destination subfolder `docs/architecture/` is created here, but MCP-MOD-001 ships the docs reorganization that makes the convention sensible).
**Unblocks:** MCP-MOD-004 (the source-of-truth extraction reads this inventory as the ground-truth declaration).

---

## 1. Goal

Produce a single document that walks through each of the 23 classifier ids in catalog v0 and names, per id: the binary
signal it detects, the question asked of the AI to detect it, the banner copy mapped to it (if any), the ledger feedback
code it maps to (if any), and the source file that is the current authority for each of those pieces. After this card,
auditing the semantic-referee tree requires reading one document, not four.

## 2. File created

`docs/architecture/semantic-referee-classifier-catalog.md`. Single document, structured as one section per classifier
id (23 sections), preceded by a short overview.

## 3. Inventory content per classifier id

Each id's section includes the same five rows:

| Field | Content | Source today |
|---|---|---|
| **Binary signal** | One-sentence plain-language description of what the binary detects (NOT the question text — the SIGNAL). | Reconstructed from the question text + the MCP-001 §6 family description; this card is the first place this written. |
| **AI question** | The exact `CLASSIFIER_QUESTION_TEXT` value asked of the model. | `supabase/functions/_shared/semanticReferee/seedPrompt.ts:42-94`. |
| **Banner code** | The banner-library code (if any) that fires when this classifier returns `value=1` and confidence is medium/high. | `src/features/refereeBanners/` — the implementer surveys `selectBanner.ts` and the per-banner files to identify the mapping per id. |
| **Ledger feedback code** | The deterministic referee ledger's per-id feedback code (if any). | `src/features/pointStanding/` and the ledger files in the same tree — implementer surveys for the per-id mapping. |
| **Source-of-truth file (today)** | The file currently considered authoritative for this id's id-string and structural metadata. | `supabase/functions/_shared/semanticReferee/types.ts` (`ALL_SEMANTIC_CLASSIFIER_IDS`). |

The 23 ids (from `ALL_SEMANTIC_CLASSIFIER_IDS`):

§A parent continuity: `responds_to_parent`, `introduces_new_issue`, `quote_anchors_parent`, `requests_clarification`,
`answers_clarification`.

§C evidence and source chain: `asks_for_evidence`, `provides_evidence`, `evidence_supports_claim`,
`uses_popularity_as_evidence`, `uses_satire_as_evidence`, `cites_retraction`, `creates_source_chain_gap`.

§D constructive movement: `narrows_claim`, `concedes_narrow_point`, `ready_for_synthesis`, `needs_pre_send_pause`.

§E debate-mode fit: `fits_selected_debate_mode`, `contains_playable_hot_take`, `is_satire_or_parody`.

§B / §G branch routing and friction: `suggests_side_branch`, `suggests_diagonal_tangent`, `shifts_to_person_or_intent`,
`contains_unplayable_insult_only`.

## 4. Method

The implementer does NOT invent semantics — it READS the existing code and faithfully transcribes:

1. From `seedPrompt.ts`, copy each id's question text verbatim into the "AI question" cell.
2. From `src/features/refereeBanners/`, identify which banner files reference each id and copy the banner-code mapping.
3. From `src/features/pointStanding/` and the ledger files, identify per-id ledger-feedback codes.
4. From `types.ts` (`ALL_SEMANTIC_CLASSIFIER_IDS`), confirm the canonical id list. Parity with the seed prompt is already
   enforced by `__tests__/semanticAnthropicSeedPromptBanList.test.ts`.

If an id has no banner mapping or no ledger mapping, the cell reads "—" with a note. Discovering an id with no banner /
no ledger mapping is informative and goes in §6 below.

## 5. Tests

This card is documentation-only. The acceptance check is:

- A new optional test `__tests__/semanticRefereeClassifierCatalogParity.test.ts` that source-scans the new
  inventory document AND `seedPrompt.ts`'s `CLASSIFIER_QUESTION_TEXT`, asserting (a) every id in
  `ALL_SEMANTIC_CLASSIFIER_IDS` appears in the inventory, (b) the inventory's "AI question" cell matches the question
  text byte-for-byte. This is a documentation-drift guard.

## 6. Findings to surface

While writing the inventory, the implementer flags (in a closing §"Findings" section of the doc):

- Any classifier id with no banner mapping — this might mean the id is unused or the banner library has a gap.
- Any classifier id with no ledger feedback — same question.
- Any drift between the question text and the family it claims to belong to (a §A id whose question reads §C-flavored).
- Any duplication (two ids whose questions are near-paraphrases).

These findings inform MCP-MOD-004 (the source-of-truth extraction) but are NOT fixed here. This card is inventory-only.

## 7. Acceptance criteria

- [ ] `docs/architecture/semantic-referee-classifier-catalog.md` exists and contains a section per classifier id (23
      sections).
- [ ] Each section names the binary signal, the AI question, the banner code (if any), the ledger code (if any), and the
      source-of-truth file.
- [ ] `__tests__/semanticRefereeClassifierCatalogParity.test.ts` exists and passes, asserting id-coverage + question-text
      parity between the inventory and `seedPrompt.ts`.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] The meta-roadmap is updated to link to the new inventory document.

## 8. Risks

- **Banner / ledger mappings are scattered or implicit.** Mitigation: the implementer's first step is the survey;
  ambiguity is named in the inventory ("no explicit banner mapping found") rather than guessed.

## 9. Not in scope

- Fixing any gaps the inventory surfaces (those become inputs to MCP-MOD-004 or new follow-up cards).
- Changing any question text. The inventory is a transcription, not a rewrite.
- Reorganizing `src/features/refereeBanners/` or the ledger files. That is MCP-MOD-006's territory.
