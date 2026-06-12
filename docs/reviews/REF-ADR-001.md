# REF-ADR-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-12
**Branch:** feat/REF-ADR-001-move-intent-doctrine-channels
**Diff reviewed:** `4882ebf..88422d7` (one commit)
**Design / artifact:** `docs/designs/REF-ADR-001-MOVE-INTENT-DOCTRINE.md` (+ pointer `docs/designs/REF-ADR-001.md`)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/590

## Summary

This is a docs-only ADR that canonizes the **move-intent doctrine** beside the Constitution and adopts Option 0 — the stored 7-code type registry + transition matrix stay the validation layer (byte-unchanged `constitution-v1.md`), RULE-005 channels are the user-facing move-intent vocabulary, the matrix becomes a hidden affordance + recovery system, and `replies` is the internal fallback relation. The ADR is exceptionally disciplined: every load-bearing quotation re-resolves **verbatim** at HEAD (the front-matter line the Option-1 rejection rests on, the acceptance-gate invariant, the #590 decision space, and the #584 GATE-A `replies` characterization), the diff touches **only the two new files**, §8 immutability is restated and protected rather than eroded, and all gates are green (tsc 0; jest 733/30042+1skip unchanged; secret scan clean). One non-blocking nit: a single supporting citation locator is off by two lines (`:478` → should be `:476` for `BuildOpenIssueInput.selectedChannel`); the named symbol genuinely exists in the cited interface and the claim is fully supported, so this does not gate ratification. The operator may correct it with a one-character edit at merge.

## Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | pass (exit 0) |
| `npx jest --silent` | pass — **733 suites / 30042 passed + 1 skipped**, exit 0 (UNCHANGED baseline; docs-only adds no tests) |
| Secret scan (diff) | clean |
| Verdict/person-token scan (diff) | clean — tokens appear only in §1 prohibition list and §10 "no winner-producing scoring" scope guard |
| Naked snake_case scan | clean — every snake_case identifier is backtick-wrapped (zero bare-prose codes) |
| Diff boundary | exactly 2 files, both **Added**: `REF-ADR-001-MOVE-INTENT-DOCTRINE.md`, `REF-ADR-001.md` |
| Migration apply | n/a — no `supabase/migrations/**` in diff |

## Checklist findings

### a. Factual accuracy (every citation re-resolved at HEAD)

| Citation | Claim | Result |
|---|---|---|
| `constitution-v1.md:18` | "exactly one type" persistence rule | ✓ exact ("must declare exactly one type from this registry") |
| `constitution-v1.md:20-28` | 7-code registry | ✓ table block (header `:20-21`, codes `:22-28`) — points at the right table |
| `constitution-v1.md:34-46` | transition matrix is the hard validation table; unlisted → rejected | ✓ exact (`:34` "Any transition not listed here is a violation and will be rejected") |
| `constitution-v1.md:3` | human-readable source for stored version `"1.0.0"` | ✓ exact |
| `constitution-v1.md:4` | **front-matter the Option-1 rejection rests on** | ✓ **verbatim** ("Changes to this document must be accompanied by a new version entry and a migration.") |
| `RULE-005.md:55-66` | channels = structural purpose, never a verdict | ✓ exact |
| `RULE-005.md:70-74` | advisory; only `evaluateArgumentDraft` + matrix block; mismatch → re-route suggestion, never `structuralBlock` | ✓ exact |
| `RULE-005.md:75-78` | `suggestChannelFromDraft` deterministic, no AI | ✓ exact |
| `RULE-005.md:128-156` | 12-active / 2-reserved vocabulary table | ✓ table at `:134-149` within the cited range |
| `RULE-005.md:148-149` | reserved `evidence_interaction` (EV-005), `mode_specific` (GAME-003) | ✓ exact |
| `boxModel.ts:37-39` | Reply/Challenge/Concede are flash-menu entry points into `respond`, not separate types | ✓ exact |
| `actPopoutModel.ts:140` | **`branch_tangent` carries no `argumentType`, NEVER engine-filtered** | ✓ exact (`:139-140` "structural entries like `branch_tangent` … therefore NEVER engine-filtered") |
| `actPopoutModel.ts:102-143` | `ActEntryId` union | ✓ union at `:102-133`; range slightly over-inclusive but contains it |
| `RULE-004.md:423-440` | pre-send review: structural blocks as plain lines, advisories as transformation Pressables | ✓ exact |
| `REF-001:706-713` | **acceptance-gate invariant** quoted verbatim | ✓ **verbatim** (engine path + "sole gate" + "Classifiers run after an argument is stored" + "No path may block…") |
| `REF-001:10` | REF-ADR-001 recorded as soft input, ratified in parallel | ✓ exact |
| `REF-001:614-617` | REF-001 records recommended disposition in prose and proceeds | ✓ exact |
| `REF-001:236-245` | frozen plain-language relation/burden/state/axis label set | ✓ exact |
| `REF-001:252-295` | `nextBestMoves` = `deriveSuggestedMoves` ∩ `buildActPopout` survivors; engine-invalid → recovery route | ✓ exact |
| `REF-001:193,:234` | `reply`-neutrality (never infer agreement from side) | ✓ supports the `replies` constraints |
| `REF-001:652` | REF-001 names REF-ADR-001 as owner of the v1.1 disposition | ✓ ("No Constitution v1.1 text change — that disposition is REF-ADR-001's") |
| `REF-001:478` | `BuildOpenIssueInput.selectedChannel` | ⚠ **off by 2** — `selectedChannel: MoveChannel \| null` is at line **476** (line 478 is `sameSideAsParent`). Symbol exists in the cited `BuildOpenIssueInput` interface (declared `:471`), inside the "Relation sources (highest precedence first)" block `:474-477`; the substantive claim (channel read above stored type as an authoritative relation source) is fully supported. Non-blocking locator drift — see Suggestions §1. |
| #590 decision space | options (0)/(1)/(2) + option-1 additive-only constraint | ✓ **verbatim** against the issue body |
| #584 GATE-A decision 2 | `replies` = 9th `relationToParent` value, internal fallback; never preferred; never clears evidence/source/quote/clarification debt by itself; never raw user-facing copy | ✓ **faithful, near-verbatim** to the operator's ratification comment |

**Engine path is live.** The ADR cites `src/domain/constitution/engine.ts` + `supabase/functions/_shared/constitution/evaluateArgumentDraft.ts`; both **exist at HEAD**. (CLAUDE.md / the doctrine skill still reference the stale `src/lib/constitution/engine.ts`, which is MISSING — the ADR correctly uses the live path.)

### b. Decision quality
- Decision space matches issue #590 verbatim, including option 1's additive-only constraint. ✓
- Recommendation does **not** fence-sit: "Adopt Option 0", strength "strong", with one named condition (demonstrated discoverability failure) that would shift it toward Option 1 — and even then the first response is a one-line pointer card, not a v1.1 section. ✓
- Trade-offs honest: Option 1's discoverability advantage is stated plainly as "the single honest advantage Option 1 has over Option 0, and it is real" (line 67) — not strawmanned; it is outweighed, not denied. Option 0's own cost (one hop removed from `constitution-v1.md`) is admitted as "the real cost." ✓
- The four re-open triggers (v2 type registry; channel-vocabulary change; OpenIssue persistence; demonstrated discoverability failure) are real and checkable. ✓

### c. §8 integrity
- Diff touches **only the two new files**; `constitution-v1.md` is not in the diff (byte-unchanged). ✓
- Constitution immutability restated (§8 self-check, line 153) and the ADR governs docs/UI doctrine only — **no** stored-version mutation, migration, or spec edit. ✓
- Nothing instructs a future edit of `constitution-v1.md`; re-open trigger 1 routes a v2 through a versioned migration, and trigger 4 explicitly refuses "a full v1.1 section in the frozen spec." ✓

### d. Canonized-list consistency
- Five canonized points are consistent with #584 GATE-A (`replies`), the shipped REF-001..004 reality, and REF-001's own "Out of scope" (`:648-649` "the matrix stay the validation layer"). ✓
- The "what REF-001..004 may rely on" list is concrete (5 bullets, each file:line-anchored). ✓
- Matrix / exactly-one-type UNCHANGED statement is verbatim-present (line 101). ✓

### e. Doctrine + copy
- Acceptance-gate invariant verbatim with the **live** engine path. ✓
- Verdict/person tokens appear only in §1 prohibition framing + §10 scope guard. ✓
- Zero naked snake_case; channels stated as advisory throughout (post-time-derived, never a `structuralBlock`). ✓

### f. Ratification mechanics
- **Status: PROPOSED** present (line 3). ✓
- Operator ratification block exists with fill-in line (`Ratified by ___ · Date ___ · Merge SHA ___ · Notes ___`, lines 172-174). ✓
- ADR states plainly that **merging the PR is the ratification act** (lines 3, 99, 165, 180) and enumerates exactly what it ratifies (lines 165-170). ✓

### g. Gates
All green; see Verification table. Boundary = exactly the 2 new files.

## Blockers
None.

## Suggestions (non-blocking)
1. **Citation locator drift — `REF-001:478` → `:476`.** In the ADR's "What REF-001 … may rely on" section (line 113), `BuildOpenIssueInput.selectedChannel` is cited at `:478`, but the field declaration is at line **476** at HEAD (line 478 is `sameSideAsParent`). The symbol exists in the cited interface and the claim is correct; this is a two-line locator imprecision, not a misquote. The operator can fix it with a one-character edit before or at merge, or accept it as de minimis. The doc is docs-only, so no re-review of code is required for the fix.

## Operator next steps
- This ADR's **merge is the ratification act** (governance §5; not auto-merge eligible). Review input is provided here; the ratification decision is the operator's.
- Push the branch: `git push -u origin feat/REF-ADR-001-move-intent-doctrine-channels`
- Open PR: `gh pr create --title "REF-ADR-001: Move-intent doctrine — channels as the user-facing layer" --body-file docs/reviews/REF-ADR-001.md`
- (Optional) before merge, correct the `:478` → `:476` locator noted in Suggestions §1.
- At the GATE-C merge, fill the Operator ratification block (Ratified by / Date / Merge SHA / Notes).
- Deploy steps: **none** — pure decision record (no migration, no Edge Function, no env var, no code).
- Post-merge worktree cleanup (operator step; see roadmap-reviewer.md § "Post-merge worktree cleanup").

## What the operator is being asked to ratify (one paragraph, for the PR body)

Merging this PR ratifies the **move-intent doctrine** as CDiscourse product doctrine via **Option 0**: the doctrine is written down in this ADR *beside* the Constitution, and `docs/core/constitution-v1.md` stays byte-unchanged (no v1.1 section, no stored-version mutation, no migration). Concretely, it canonizes that the stored 7-code type registry (`CLM`/`RBT`/`CRB`/`EVD`/`CLR`/`CON`/`SYN`) and the transition matrix remain the validation layer the user never names; RULE-005's channels are the plain-language move-intent vocabulary the user actually drafts with; the matrix becomes a hidden affordance plus recovery system (an engine-invalid move surfaces a recovery route, never a raw rejection); `replies` is the internal fallback relation (never preferred over a specific procedural relation, never debt-clearing by itself, never raw user-facing copy, per #584 GATE-A decision 2); and type codes stay out of drafting-flow copy. It also ratifies the explicit list of assumptions REF-001..004 may treat as binding inputs, and four named conditions that would re-open the decision. The deterministic rules engine remains the sole acceptance gate; channels are advisory and never block a post. No code, copy, migration, or deploy ships with this merge — the merge itself is the operative act.
