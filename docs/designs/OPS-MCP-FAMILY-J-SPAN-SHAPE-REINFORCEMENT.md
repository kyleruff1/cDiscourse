# OPS-MCP-FAMILY-J-SPAN-SHAPE-REINFORCEMENT

**Card:** MCP-SERVER-011-FAMILY-J Card 3 — Family-J span non-echo reinforcement.
**Type:** `mcp-server` prompt-side change (Deno-deploy-bearing on merge).
**Precedent:** the #421/#423 RAWKEY-SHAPE REINFORCEMENT pattern (`git show 9ae3c7a`,
`feat(OPS-MCP-FAMILIES-E-F-RESPONSE-SHAPE-TUNING)`).
**BINDING:** the validator gate is **never relaxed**. `familyJBanListScan.ts` is byte-equal
(`git hash-object` unchanged: `d9913ca4c99c3f7b0085e6ca7c3a4d9f927ac9b4`). This is a
prompt-side mitigation only.

---

## 1. Incident

Source: `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` — the Amendment section
(post-OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY re-typing of the Phase-4b finding).

With the **Edge-shaped input** (full stored parent + thread context, larger than the bare
fixture), the model fires `needs_pre_send_pause` on the existential person-shift text AND anchors
that span on the **reactive sentence** — which contains the input's slurs
("You're such a troll and honestly you're toxic — …"). `familyJBanListScan` then rejects the
packet closed: `validation_failed` at `evidenceSpan.needs_pre_send_pause` / `doctrine_ban_list`,
deterministic across all 4 Edge attempts (the packet-residual signature, retry-immune).

This is **fail-closed exactly as designed** — nothing dirty ever persisted, and the verdict on
the E3 gate stands at PASS (the firing-count gate was met with clean spans on all 5 keys). The
residual is the validator correctly refusing an unclean span. But it is a recoverable
false-negative-on-a-real-feature: the structural feature (reactive markers) IS present; only the
span anchoring was unclean.

## 2. Gap analysis

`mcp-server/lib/familyJPrompt.ts` gave `shifts_to_person_or_intent` a concrete clean-anchor
example ("because you work for…"). But `needs_pre_send_pause`'s instruction (the per-key
paragraph + the general slur-in-input rule) named **WHAT** to anchor (all-caps bursts, repeated
punctuation) **without a sub-span selection rule** for the case where those markers are
**interleaved** with person labels. The model had no instruction telling it to anchor only the
typographic fragment and drop the surrounding slur sentence — so it quoted the whole reactive
sentence, slur included.

## 3. The fix (prompt-side only)

A **BINDING SPAN-SELECTION RULE** applying to ALL J keys, added to the user prompt, plus a
concrete escape baked into the `needs_pre_send_pause` per-key paragraph (system prompt) and its
prompt-entry `falsePositiveGuards`:

- **(a) SHORTEST SUB-SPAN** — choose the shortest sub-span that exhibits the structural feature.
- **(b) SELF-SCAN** — before emitting, self-scan the candidate span for any banned person-directed
  term or second-person label.
- **(c) NARROW TO EXCLUDE** — if present, narrow the span to exclude it. For reactive markers,
  anchor ONLY the typographic fragment (concrete example: `"WRONG WRONG WRONG!!!"`); for a
  focus-shift, anchor the structural wording ("because you work for…"), never the slur.
- **(d) NARROW-OR-FALSE** — a clean narrow span ALWAYS exists for a true structural feature; if one
  cannot be produced, answer **false** for that key rather than emit an unclean span (an unclean
  span is rejected at `evidenceSpan.<rawKey>`, so it is worse than a false).

This mirrors the person-shift key's slur-non-echo constraint and extends it to all J span
anchoring — the scoped follow-up the amendment named.

## 4. Files changed (mcp-server only)

- `mcp-server/lib/familyJPrompt.ts` — new SPAN-SELECTION RULE block in the user prompt (numbered
  section 7, input → 8); strengthened `needs_pre_send_pause` per-key paragraph in
  `FAMILY_J_SYSTEM_PROMPT` with the interleaved-slur concrete escape; doc-comment numbered-section
  list updated to name the block.
- `mcp-server/lib/familyJKeys.ts` — `needs_pre_send_pause` `falsePositiveGuards` extended with the
  sub-span / non-echo constraint sentence (mirrors the axis-partner key's constraint). The prior
  verdict-adjacent "MUST NOT contain: unhinged, hostile, aggressive, losing it" enumeration is
  preserved verbatim.
- `mcp-server/fixtures/classify-argument-boolean-observations.family-j-pause-adversarial-request.json`
  — NEW adversarial pause fixture: reactive markers (`WRONG WRONG WRONG!!!`, all-caps) interleaved
  inside a slur sentence (`troll`/`toxic`), requesting `needs_pre_send_pause`. The interleaved case
  the existing clean pause fixture did not cover.
- `mcp-server/tests/familyJPrompt.test.ts` — +5 tests (SPAN-SELECTION RULE block + four sub-rules;
  WRONG-burst example + validator-path consequence anchor; system-prompt pause escape; prompt-entry
  guard delta; block does not disturb the 5-line questions block).
- `mcp-server/tests/familyJAdversarialDoctrine.test.ts` — +3 tests (new interleaved fixture shape;
  clean narrowed span `WRONG WRONG WRONG!!!` PASSES the ban scan; slur-bearing full-sentence span
  FAILS at `evidenceSpan.needs_pre_send_pause` — proving validator posture UNCHANGED).

**NOT changed:** `familyJBanListScan.ts` (byte-equal — the gate is never relaxed); no Edge /
`supabase/**`; no `src/**` (the parity test only compares rawKey/source/disposition metadata, not
guard text); families A–I untouched; `mcp-server-001-smoke.sh` J checks unchanged (fixture-mode).

## 5. Doctrine self-check (cdiscourse-doctrine)

- §1 / §10a — the new prompt text instructs the model to detect a STRUCTURAL feature and anchor a
  clean structural span; it never characterizes the author. Banned tokens (`troll`, `toxic`,
  `bad actor`) appear only in negation/instruction context ("self-scan … to exclude", "MUST NOT
  echo"), mirroring the existing prompt's safe handling. The system-prompt shared-ban-pattern
  negation test still passes.
- The validator backstop is unchanged — the prompt change reduces the rate of unclean spans
  reaching the gate; the gate still rejects any that do.

## 6. Verification

- `cd mcp-server && deno test --allow-env --allow-read tests/` → **1576 passed / 0 failed, exit 0**
  (+8 vs the 1568 baseline).
- `npx jest --maxWorkers=4` → **711 suites / 29541 passed (1 pre-existing skip), exit 0**
  (unchanged — the change is Deno-only).
- `npm run typecheck` → exit 0. `npm run lint` → green on the project tree (the unfiltered exit 1
  is pre-existing `.claude/worktrees/` sibling-worktree noise; `mcp-server/**` is eslint-ignored).
- Validator byte-equality: `git hash-object mcp-server/lib/familyJBanListScan.ts` =
  `d9913ca4c99c3f7b0085e6ca7c3a4d9f927ac9b4` (unchanged). Secret scan of the diff: clean.

### Post-merge live-replay plan (operator)

Merge is **Deno-deploy-bearing** (GitHub integration redeploys `cdiscourse-mcp-server` to Deno
Deploy automatically — Supabase merge auto-deploy does NOT propagate `mcp-server/`). No
`supabase db push`, no `functions deploy`, no env var, no routing arm. After the redeploy:

1. Re-run the E3 admin_validation smoke on the **existential person-shift input** (the exact
   Edge-shaped request with full parent + thread context).
2. Confirm `needs_pre_send_pause` now anchors a clean typographic-fragment span (or answers false)
   — no `validation_failed` at `evidenceSpan.needs_pre_send_pause`.
3. Confirm `shifts_to_person_or_intent` still anchors cleanly (regression check).
4. **NO production-enable implied** — Family J stays admin-validation-only (the E4 ceiling stands;
   a future production proposal requires a fresh cdiscourse-doctrine §10a review).

**Probabilistic-outcome ladder (reviewer addition):** prompt behavior is probabilistic, so the post-merge replay may still return an unclean span. The honest outcome ladder is: clean narrowed span (PASS) / the model answers false under narrow-or-false (acceptable — a missed private nudge is near-zero harm) / still failing validation (PARTIAL — iterate the prompt in a further card). The ban-list gate is **never** relaxed under any outcome.

---

## Part 2 — order-robustness (OPS-MCP-FAMILY-J-PROMPT-ORDER-ROBUSTNESS; J prompt iteration 2)

**Card:** `OPS-MCP-FAMILY-J-PROMPT-ORDER-ROBUSTNESS` — follow-up to Part 1's PARTIAL outcome.
**Source:** the diagnosis matrix recorded on #388 (2026-06-11).
**Type:** `mcp-server` prompt-side change (Deno-deploy-bearing on merge). Validator UNCHANGED.

### 2.1 The PARTIAL outcome that triggered this card

Part 1 shipped the global SPAN-SELECTION RULE block (PR #572). The post-merge E3 replay still
returned an unclean `needs_pre_send_pause` span. Investigation found the residual was
**order-sensitive**, not a failure of the rule's content.

### 2.2 The order-sensitivity matrix (#388, 2026-06-11)

The SPAN-SELECTION RULE lives at the END of the user prompt (after the questions, definitions,
response-shape, conservative-positives, and slur-in-input blocks). The Edge calls the classifier
with the rawKeys in the **registry order** — `shifts_to_person_or_intent` FIRST. By the time the
model reaches `needs_pre_send_pause` (asked later), the global end-of-prompt rule has lost
salience and the `needs_pre_send_pause` evidenceSpan contaminates with the input's slur sentence.

| Question order asked | `needs_pre_send_pause` span outcome | Determinism (30s in-body budget) |
| --- | --- | --- |
| `shifts_to_person_or_intent` FIRST (Edge registry order) | contaminates with the input's slur sentence | 3/3 unclean (deterministic) |
| pause question EARLIER (alphabetical) | narrows cleanly to the typographic burst | 2/2 clean |

The variable is **position**, not content: the same rule, asked while the question is fresh,
produces a clean span; asked after several intervening questions, it does not.

### 2.3 Chosen candidates (a) + (c)

Prompt-side only; no server-side key reordering.

- **(a) Per-key span reminders** — a SHORT bracketed span reminder is appended to EACH key's
  question line (`FAMILY_J_SPAN_REMINDERS` in `familyJPrompt.ts`), so the shortest-clean-fragment
  discipline travels WITH every key regardless of position. Strongest on `needs_pre_send_pause`
  (`[span: SHORTEST clean fragment only — for reactive markers anchor ONLY the typographic burst,
  e.g. "WRONG WRONG WRONG!!!", never any fragment containing a person label; if no clean fragment
  exists, answer false]`); analogous one-liners for the other four keys (person-shift anchors the
  focus-shift wording; insult-only span may be null / the move text only if clean; popularity
  anchors the popularity-leaning wording; satire anchors the satire-citation wording). Each
  reminder carries the shared `SHORTEST clean fragment only` + `if no clean fragment exists, answer
  false` spine.

- **(c) Pre-emit FINAL CHECK** — a binding re-scan instruction is inserted as the lead-in to the
  response-shape instruction (after the questions/definitions/cross-key-note blocks, immediately
  before `The object MUST conform to this shape:`), so it is among the LAST instructions the model
  reads before emitting JSON: `FINAL CHECK (BINDING): before emitting, re-scan EVERY evidenceSpan
  value you are about to output against the banned person-directed terms; if ANY span contains one,
  NARROW that span or flip that key to false. An output with even one unclean span is rejected
  whole.` The Part 1 global SPAN-SELECTION RULE block remains verbatim at the end of the prompt;
  the FINAL CHECK precedes it — the two legs coexist.

### 2.4 Rejected candidate (b): server-side key reordering

The matrix shows asking the pause question alphabetically-early fixes the span. The naive fix is to
reorder the rawKeys the Edge sends J (or the order J emits them). **Rejected** because the rawKey
registry order is a cross-family contract: the Edge `booleanObservationRequestBuilder.ts` derives
request order from the shared registry, and reordering would either (i) touch ALL families' request
construction, or (ii) diverge J's order from the registry and risk a parity / contract drift that
no test pins. The order-sensitivity is a prompt-salience problem; the prompt-salience fix (a + c)
solves it without disturbing the cross-family request contract. The validator gate is unchanged
under either path; reordering would add cross-family blast radius for no validator benefit.

### 2.5 Files changed (mcp-server only)

- `mcp-server/lib/familyJPrompt.ts` — new exported `FAMILY_J_SPAN_REMINDERS` map (one reminder per
  rawKey); `buildFamilyJUserPrompt` appends the reminder to each question line (same line, never a
  new line — the questions block must stay exactly one line per rawKey); the FINAL CHECK block is
  inserted as the response-shape lead-in; the function's structure doc-comment list is renumbered
  to name both additions (items 1 & 4).
- `mcp-server/tests/familyJPrompt.test.ts` — +7 tests: reminder map shape (one per key + shared
  spine); each reminder lands on its question line; the `needs_pre_send_pause` reminder carries the
  WRONG-burst example and is strongest; subset request only emits requested-key reminders; the
  questions block stays exactly 5 lines (no spilled newlines); FINAL CHECK present + positioned
  after the questions and before the response shape, with the Part 1 SPAN-SELECTION RULE still
  following it; per-key reminders + FINAL CHECK carry zero banned person-directed tokens.

**NOT changed:** `familyJBanListScan.ts` (byte-equal — `git hash-object` =
`d9913ca4c99c3f7b0085e6ca7c3a4d9f927ac9b4`, the gate is never relaxed); `familyJKeys.ts` (the
reminders are prompt-only — no guard sentence needed mirroring); no other family's files; no Edge /
`supabase/**`; no `src/**`.

### 2.6 Verification

- `cd mcp-server && deno test --allow-env --allow-read tests/` → **1583 passed / 0 failed, exit 0**
  (+7 vs the 1576 Part-1 baseline).
- `npx jest --maxWorkers=4` → unchanged (the change is Deno-only; jest does not execute
  `mcp-server/`). The repo-wide `dockerfileShape.test.ts` *.json walk can flake under
  `--maxWorkers=4` parallel load (it races other suites writing transient JSON); it passes
  isolated and is not in this branch's diff.
- `npm run typecheck` → exit 0.
- Validator byte-equality: `git hash-object mcp-server/lib/familyJBanListScan.ts` =
  `d9913ca4c99c3f7b0085e6ca7c3a4d9f927ac9b4` (unchanged). Secret/ban scan of the diff: clean.

Post-merge live-replay plan is unchanged from §6 above (Deno-deploy-bearing; re-run the E3 admin
validation smoke on the existential person-shift input; the probabilistic-outcome ladder still
applies).
