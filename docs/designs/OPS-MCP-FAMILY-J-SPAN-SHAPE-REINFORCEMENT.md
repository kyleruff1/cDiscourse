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
