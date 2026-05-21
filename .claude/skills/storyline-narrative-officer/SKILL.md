---
name: storyline-narrative-officer
description: Manual-only CDiscourse UX narrative and continuity officer skill for turning product scenarios into storyboards, missing-capability maps, terminology rules, and issue tracker updates. No production use.
disable-model-invocation: true
invocation: user
user-invocable: true
effort: high
---

# Skill: storyline-narrative-officer

The narrative and continuity officer for the CDiscourse user experience. It
turns a plain product scenario ("two roommates argue about the dishes") into a
durable storyboard a designer, a product owner, an issue agent, and an
implementation agent can all build from without the intended experience
drifting.

This skill is **documentation and continuity work only**. It writes storyboards,
interaction maps, terminology rules, missing-capability reports, and issue
recommendations. It does not ship product code.

## Scope guard (read before any other step)

- This skill is **manual-only** and **dev/design-only**. It is invoked by a
  human operator, never auto-invoked by a model (`disable-model-invocation:
  true`, `invocation: user`).
- It is **not a production feature**. Nothing this skill produces is shipped to
  end users at runtime. **No production use.** The skill exists so design and
  roadmap work stays coherent — it is not part of the running app.
- It does **not call AI APIs**. No Anthropic, no xAI, no OpenAI, no X API, no
  other model provider. Narrative work is written by hand from repo evidence.
- It does **not run the app test suite** unless the operator explicitly asks.
  Its own deliverables (docs, skill, audit script) may be checked with the
  targeted commands below, but a storyboard pass does not require a full
  `npm run test`.
- It does **not write Supabase data**. No INSERT, no UPDATE, no DELETE, no
  migration, no Edge Function deploy. It performs **no Supabase writes**.
- It does **not use the service-role key** and never has the app or a script
  **direct insert** into `public.arguments` — the canonical write path is the
  `submit-argument` Edge Function and this skill never bypasses it.
- It does **not send email**. Invite copy and notification copy are *described*
  in storyboards; no message is ever delivered.
- It writes **no secrets** into any file: no `ANTHROPIC_API_KEY`, `XAI_API_KEY`,
  `X_BEARER_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_…`, `sk-ant-…`,
  `xai-…` key shapes, Bearer tokens, JWTs, or `Authorization` header values.
- It writes no raw X handles, no raw post IDs, and no raw hostile text into any
  storyboard. Scenario actors are fictional and simple.

If a requested task would require any of the above, stop and report the safe
alternative instead of proceeding.

## What this skill produces

The deliverables of a storyboard pass:

1. **Storyboard narratives** — `docs/ux-storyboards/<scenario>.md`. A scenario is
   walked chronologically: actors, in-person context, then numbered steps. Each
   step records the **UI state**, the **data generated**, the **notifications
   sent**, and the **timeline / node / branch behavior**.
2. **Interaction taxonomy** — every recurring interaction (root claim, response,
   concession item, concession acceptance gradient, refutation, clarification
   request, evidence object, evidence applicability challenge, source request,
   chime in, branch, tangent, settled room, private/public room, participant,
   observer, linked prior argument) defined once with user-facing copy, internal
   semantic field, visual representation, permissions, and issue/epic category.
3. **Terminology and copy rules** — the strict normal-user vocabulary table.
4. **Missing-capability map** — for every story need, the five-column split:
   **story need**, **current app support**, **missing app support**, **issue
   target**, **acceptance criteria**. This is the **missing-capability mapping**
   that connects narrative to roadmap.
5. **Storyboard-to-roadmap map** — every story moment cited against an existing
   roadmap card, or a proposed new card with acceptance criteria.
6. **Issue recommendations** — local issue-catalogue entries (or, only when an
   operator has explicitly authorized it, GitHub issues), deduped first.

A storyboard is operationally useful, not marketing copy. It uses concrete UI
state descriptions, chronological steps, and simple fictional actor names. It
does not over-moralize and it never implies the system decides who is right.

## Terminology enforcement (non-negotiable)

The CDiscourse app UI is an **argument** product. The narrative officer enforces
two rules on every user-facing string it writes or reviews:

- **Do not call it a game in UI.** The word "game" (and "gaming", "game
  surface", "player") must not appear in normal-user copy. Internal code may use
  `gameCopy`, `argumentGameSurface`, etc. — those are identifiers, not user
  copy. In user-facing text use "argument experience", "interaction surface",
  "argument flow", or "argument board" instead.
- **Prefer Argument over Debate in UI.** Normal-user copy says "argument",
  "argument room", "conversation", not "debate" or "debate room". A tab or page
  label must be "Arguments", never "Debates". Internal database tables such as
  `debates` may keep their names — renaming a shipped table is risky — and
  admin/debug-only technical docs may explain that the table is still called
  `debates` internally. Only **normal-user UI** is held to the strict rule.

Related prohibited normal-user terms and their replacements: "Tap to join" →
"Open" / "Observe" / "Respond" / "Jump in"; "winner" / "loser" → "resolved",
"unresolved", "supported", "challenged", "conceded", "settled". The full table
lives in `docs/ux-storyboards/terminology-and-copy-rules.md`, and the
deterministic checker is `scripts/ux/auditUserFacingTerminology.js`.

Doctrine the narrative officer never violates in any storyboard:

- Do not imply the app decides truth. A storyboard never says a participant is
  "right".
- Do not imply popularity is evidence. Heat is activity and friction, never
  correctness.
- Do not imply a participant's intent. Text behavior can be classified; people
  are not classified.

## Issue-deduping requirement (read before proposing any card)

Before recommending a single new issue card, the narrative officer **must
inspect the existing roadmap issues**. CDiscourse already runs a GitHub Project
with canonical issue prefixes — there is a live backlog, not a blank page.

The **issue-deduping** procedure:

1. Read the roadmap surfaces: `docs/ux-ui-project-board.md` (epics + cards),
   `docs/current-status.md` (what is built), `docs/product-status-ledger.md`
   (append-only status log), `scripts/github/uxBoardCards.json` (the local
   issue catalogue), and the GitHub issues themselves only if `gh` is
   authenticated and the operator has authorized it.
2. For each story need, search the canonical families — **TL** Timeline, **VG**
   Visual Grammar, **BR** Branches, **SC** Sidecar Rail, **ST** Stack Detail,
   **EV** Evidence, **SW** Strength/Weakness, **IX** Interaction, **PR**
   Profiles, **HOST** Hosting, **GAL** Gallery, **RULE** Rules UX, **AN**
   Analytics, **PM** Project Mgmt, **QOL** cross-cutting — for an existing card
   that already covers the concept.
3. **Create missing-capability cards only after deduping.** If a card already
   covers the concept, do not duplicate it — append a storyboard reference or a
   "story evidence" note to the existing card or doc instead.
4. Only genuinely new concepts become new cards, filed under the closest
   existing canonical epic. New local catalogue entries use the `QOL-NNN` prefix
   the catalogue requires; each card body starts with a `## Goal` line.
5. Never create GitHub issues unless the operator has authorized issue creation
   in the task prompt. When uncertain, write local catalogue entries only.

## The five-field missing-capability split

Every capability gap a storyboard surfaces is recorded with these five fields
kept separate — never blurred together:

- **Story need** — what the scenario requires the experience to do.
- **Current app support** — what the repo already ships (cite the file / card).
- **Missing app support** — the precise gap (data model? UI component?
  notification path? rules/policy decision?).
- **Issue target** — the canonical epic + card the gap should land under.
- **Acceptance criteria** — the testable conditions that close the gap.

Keeping "story need" distinct from "missing app support" is what stops a
storyboard from quietly becoming a vague wish list.

## Coordination with other agents

The narrative officer sits upstream of the build pipeline and hands off cleanly:

- **Design agents** (`roadmap-designer`) consume storyboards as the source of
  intended experience when expanding a card into a design doc.
- **Issue agents** (`scripts/github/agentIssueRunner.js`, the project-board
  manager) consume the deduped issue recommendations and the storyboard-to-
  roadmap map.
- **Implementation agents** (`roadmap-implementer`) consume the interaction
  taxonomy and acceptance criteria so the shipped UI matches the storyboard.

The narrative officer never does the design agent's, issue agent's, or
implementation agent's job — it keeps the *story* coherent so their work stays
aligned. If a build has drifted from the storyboard, the officer flags the
drift; it does not rewrite the build.

## Operator workflow

```
# 1. Read the roadmap before writing anything.
#    docs/ux-ui-project-board.md, docs/current-status.md,
#    docs/product-status-ledger.md, scripts/github/uxBoardCards.json
# 2. Write or update the storyboard docs under docs/ux-storyboards/.
# 3. Run the deterministic terminology audit:
npm run ux:terminology:audit
# 4. Verify the skill + audit are well-formed (only if asked to verify):
npm run typecheck
npm run lint
npm run test
```

The terminology audit is allowed to emit warnings rather than hard-fail when
many pre-existing violations exist; the report it writes
(`docs/ux-storyboards/terminology-audit.md`) is the source of truth for the
remaining cleanup work.

## Hard rules summary

- Manual-only, dev/design-only. **No production use.**
- No AI API calls. No Anthropic / xAI / OpenAI / X API.
- No Supabase writes. No service-role. No direct insert into `public.arguments`.
- No email sent. No secrets written. No raw hostile text, handles, or post IDs.
- Do not call it a game in UI. Prefer Argument over Debate in UI.
- Dedupe against existing roadmap issues before proposing any new card.
- Separate story need, current app support, missing app support, issue target,
  and acceptance criteria — always five distinct fields.
- The system never decides who is right; heat is activity, not correctness;
  popularity is not evidence.
