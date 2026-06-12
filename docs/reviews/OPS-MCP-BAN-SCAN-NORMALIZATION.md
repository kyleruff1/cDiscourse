# OPS-MCP-BAN-SCAN-NORMALIZATION — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-12
**Branch:** feat/ops-mcp-ban-scan-normalization (HEAD `dcdba3e`, base main `8e509eb`)
**Design:** docs/designs/OPS-MCP-BAN-SCAN-NORMALIZATION.md
**ADR consulted:** docs/designs/OPS-MCP-CROSS-FAMILY-LIST-UNION-DECISION.md (Option 0; re-open triggers)

## Summary

This card closes the four regex-evasion gaps the #578 honesty corpus pinned (Cyrillic/Greek
homoglyph, diacritic, leetspeak, plus zero-width insertion added here) by introducing one new pure
module — `mcp-server/lib/banScanNormalize.ts` — and routing all eleven ban-scan call sites (ten
`scanFamily<X>BooleanResponseForBanList` × three field sites + `findUncleanEvidenceSpanKeys`) through
a single shared matcher `banScanMatches(text, patterns)`. The matcher tests the **raw text OR the
normalized text**, so it is structurally tighten-only: the raw scan always runs first, so no prior
catch is ever lost; the normalized scan is purely additive. Every `FAMILY_<X>_BAN_PATTERNS` array and
`DOCTRINE_BAN_PATTERNS` is byte-unchanged (git diff: zero pattern-array hunks). This is own-list
evasion-closure, not the cross-family widening the ADR rejected. All gates pass on re-run. The
doctrine argument (§10a verbatim-quote trade-off) and the leet false-positive surface both hold up to
independent scrutiny. Nothing concerns me; this is a clean, well-tested, doctrinally-positive change.

## Verification (reviewer re-run, exit codes captured)

| Gate | Command | Result |
|---|---|---|
| Deno suite (deploy-correctness gate) | `deno test --config mcp-server/deno.json --allow-net --allow-env --allow-read mcp-server/tests/` | **1741 passed / 0 failed, exit 0** (matches design; +41 vs 1700 baseline) |
| Deno check (new + touched) | `deno check lib/banScanNormalize.ts lib/keyLevelFailClosed.ts familyA/J + the 2 tests` | exit 0 |
| Deno lint (12 lib + 2 test) | `deno lint <14 files>` | Checked 14 files, exit 0 |
| typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| jest (full) | `npx jest --maxWorkers=4` | **715 suites / 29620 passed, 1 skipped (29621 total), exit 0** — unchanged (jest does not cover the Deno scan) |
| secret scan | `git diff main..HEAD \| grep -iE '<secret patterns>'` | clean |
| doctrine scan | truth/verdict tokens in non-test added lines | only boolean `false`/`true` literals + the internal status-doc's technical description of the card — no user-facing verdict label |
| console.log / .only / .skip / new deps | added-line greps | none / none / none / none (import map `std/` unchanged) |

The "exports field" deno.json warning is pre-existing config noise, not from this card.

## Design conformance

- [x] All design file-changes are present — exactly 16 files (2 new lib/test, `keyLevelFailClosed`,
  ten family scans, the EDGE test, current-status, design doc).
- [x] No undocumented file-changes — ZERO diff in `doctrineBanList.ts`,
  `mcpBooleanObservationSchemaMirror.ts`, the dispatcher
  (`classifyArgumentBooleanObservations.ts`), prompts, `supabase/**`, `src/**`, migrations,
  `package.json`.
- [x] Data model matches design — none (no schema/migration/wire-shape change; pure in-memory
  detection transform).
- [x] API contracts match design — `normalizeForBanScan(string): string` and
  `banScanMatches(text, patterns): boolean` exactly as specified; the D2 raw-OR-normalized union is
  the implemented form.

## Per-checklist findings

1. **Boundary — PASS.** `git diff --name-only main..HEAD` = exactly the 16 expected files; none in the
   forbidden set.
2. **Pattern arrays byte-unchanged — PASS.** A `+/-` grep of the entire `mcp-server/lib` diff for any
   regex-literal / `BAN_PATTERNS` / `tokenPattern` / `BANNED_TOKENS` line returns empty. All ten
   family diffs are import + loop→matcher routing only; the returned `path` strings
   (`evidenceSpan.${rawKey}`, `modelInfo.serverName`, `modelInfo.classifierSetVersion`) and the
   field-scan order are preserved exactly. Each family diff has exactly 4 `banScanMatches` mentions
   (1 import + 3 sites).
3. **Tighten-only proof — PASS.** `banScanMatches` (banScanNormalize.ts:178-189) tests RAW first
   (`patterns.some(p => p.test(text))` → return true), then the additive normalized scan; the
   `normalized === text` short-circuit is a correct no-op optimization. The property tests are real:
   identity-on-pure-ASCII (test:219-230), monotonicity incl. the boundary-faking `ro`+ZWSP+`bot` raw
   catch (test:232-247), and a raw-OR-normalized equivalence assertion (test:256-273). The patterns
   are all `/i`-only (no `g`/`y` flag in `doctrineBanList.ts` or any `FAMILY_<X>_BAN_PATTERNS`), so the
   double-`.test()` is not stateful — no lastIndex hazard.
4. **Normalizer correctness — PASS.** Zero-width set is the explicit 5-char class (U+200B/C/D, U+2060,
   U+FEFF); NFKD + `\p{M}` combining-mark strip; homoglyph table explicit and commented. Spot-checked
   3 mappings against Unicode: `а`→a = U+0430 ✓, `о`→o = U+043E ✓, `е`→e = U+0435 ✓ (Greek `ο`→o =
   U+03BF ✓). Leet adjacency-gating (banScanNormalize.ts:112-128) is computed against the **input**
   (pre-substitution) string, so a just-mapped char can't cascade; digits with no letter neighbor are
   left untouched — proven by the `Model 3` / `2019` / `Section 230` / `$5` / `co2` tests. Pure (no
   I/O, no Date), idempotent (test:279-295). No catastrophic-backtracking risk — the regexes are
   simple character classes and the homoglyph/leet maps are linear char-by-char loops.
5. **No-divergence preserved — PASS.** The collector, the ten scans, and the unmodified dispatcher's
   post-drop re-scan all route through the single `banScanMatches`: the dispatcher calls
   `providers.banListScan` (the family scans) at line 661 and `findUncleanEvidenceSpanKeys` at line
   683, both now matcher-backed. The `keyLevelFailClosedWidening` / `softParaphraseMixedPacketReachability`
   / `familyJKeyLevelFailClosed` suites are green within the 1741. The A/H/J disguised-token agreement
   tests (test:352-401) assert the collector and the family scan flag the **same key** identically.
6. **SURV tripwire intact — PASS.** `softParaphraseSurvivorCorpus.test.ts` is NOT edited; on re-run all
   20 soft exemplars stay clean (SURV-1 × 10 families) and all 10 hard controls are still caught
   (SURV-2 × 10 families), SURV-union green. No exemplar edited; the normalizer is a generic transform
   with no string-specific carve-out (read in full).
7. **EDGE flips correct — PASS.** The 3 pins (homoglyph / diacritic / leet) flip `false → true` with
   boundary-moved comments naming this card; 2 new pins added (zero-width U+200B, NFKD fullwidth). The
   case-insensitive positive control and the strict-boundary-asymmetry pins (`troll`≠`trolling` stays
   false; `astroturf\w*` matches `astroturfing` stays true) are unchanged. `isCaught` routes through
   the real `findUncleanEvidenceSpanKeys` + real `banPatternsForKeyLevelFamily` stacks — not a mock.
8. **§10a / ADR consistency — PASS (independent assessment below).**
9. **False-positive guards — PASS (independent assessment below).**
10. **Gates rerun — PASS.** See Verification table; every number matches the design's claims.
11. **Secrets / safety — PASS.** Secret scan clean; no console.log; no `.only`/`.skip`/`Deno.test.ignore`;
    no new deps (import map `std@0.224.0` unchanged; the normalizer has zero imports).

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — hard tokens appear only as scan-detection
  inputs in tests (established #578 precedent); no app copy, no persisted span, no UI string.
- [x] Score never blocks posting — N/A; this is the MCP server's advisory observation packet, not a
  posting gate; no scoring path touched.
- [x] No service-role in client code — N/A; mcp-server only; no `src/`/`app/` change.
- [x] No direct insert into public.arguments — none; detection-only, no DB path.
- [x] No AI calls in production app paths — none; pure deterministic string transform, zero providers.
- [x] Plain language only — no internal code added to any user-facing string.
- [x] Epic-specific doctrine (cdiscourse-doctrine §1 / §10a) — the change makes the server **better** at
  refusing to emit a disguised verdict/person token; omission asserts nothing (key-level fail-closed
  unchanged). RESPECTED — strengthened.

### Independent assessment — item 8 (the §10a / ADR argument)

The argument is **sound**. The ADR (Option 0) decided *which tokens* each family bans and rejected
adding other families' tokens to a family's stack, because a union would (a) drop verbatim quotes of
**doctrine-clean** public text the family was deliberately built to permit ("won committee approval"
in a Family-D span, "the soil was toxic"), and (b) break the byte-stability / no-divergence invariant.
This card operates on an **orthogonal axis**: it changes nothing about which tokens a family bans
(byte-confirmed), so the ADR's central cost — dropping clean cross-family quotes — does **not** recur
(Family D still scans DOCTRINE-only; normalizing "won committee approval" introduces no DOCTRINE
token). It only raises detection fidelity for each family's **own** existing set.

The named trade-off is real and correctly characterized: a span verbatim-quoting the author's **own
disguised** token (`tr0ll`) now drops where it previously survived. This is doctrine-**positive**: the
ADR itself repeatedly flagged that its verbatim-quote defense is *thinnest* exactly on J's
person-directed tokens (ADR :67,:126,:188). A disguised slur is not person-neutral — a human reads
`tr0ll` as `troll`, so the machine echoing it as an Observation span is precisely the §1/§10a-forbidden
emission. The drop suppresses only the **machine's** echo; the author's move body renders separately
and in full, and the unclean key dies alone (clean siblings survive). The two trade-offs point in
opposite directions — the ADR's union dropped clean content for zero gain (reject); this card drops the
violation itself, merely disguised (adopt). None of the ADR's four re-open triggers fire (no detached
rendering, no model-authored-non-verbatim change, no disposition change, no new render site), and the
ADR's scoped question ("ban *other* families' tokens") is not what this card does. The persisted-span
verbatim property is enforced in code (normalize output is used only for the boolean decision, never
written back) and proven by the VERBATIM test (test:410-418). The L5 ops-SQL honesty statement is
present (design "Out of scope": SQL can't normalize; the server scan is the pre-persist gate, so the
SQL gap narrows to historical rows only).

### Independent assessment — item 9 (leet false-positive surface)

**Effectively negligible.** For a *new* false positive a legit ASCII span must contain a letter-adjacent
leet char that, after mapping, spells a **complete bounded** banned token (the patterns require
non-alphanumeric boundaries both sides). I traced realistic identifiers: `Model 3`/`Section 230`/
`2019`/`$5`/`co2` are clean (verified by tests); `3D`→"ed", `GPT4`→"gpta", `iPhone7`→"iphonet",
`5G`→"sg", `G7`→"gt", `A4`→"aa", `Windows 11`→unchanged, `robot`/`rob0t`→"robot" (the `bot` boundary
fails before `o`). Critically, the adjacency-gate-against-**input** blocks cascades: `B07`→"bo7" (the
`7`'s input-neighbors are `0` and a boundary, so it does not map; it never becomes `bot`). The shortest
tokens (`won`/`bot`/`liar`/`idiot`) require a digit run that exactly spells the token bounded by
non-alphanumerics — which is the evasion signature, not a legit-prose pattern. Even if a rare false
positive existed, the raw-OR-union means it can only *add* a catch on a previously-clean span, so it
would surface loudly as a new red in SURV / full suite (all green here). The design's characterization
("vanishingly unlikely, but not provably zero") is accurate and its mitigation (treat any newly-red
previously-clean assertion as a finding, not a blanket edit) is correct. I could not construct a
realistic legit input that newly forms a complete bounded banned token.

## Test coverage

- [x] New public functions have unit tests — `normalizeForBanScan` and `banScanMatches` both covered
  across mapping classes, properties, idempotence, null/empty, false-positive guards, and
  collector⇔scan agreement (39 Deno cases).
- [x] User-facing strings have ban-list assertion — N/A (no user-facing string); the SURV/EDGE
  doctrine tripwires and the §1 convention (hard tokens only as scan inputs) are the analog and pass.
- [x] Edge cases from design § "Edge cases" have tests — empty/null, pure-ASCII identity, in-token
  zero-width, boundary-faking zero-width (`ro`+ZWSP+`bot` raw catch), `trolling` inflection,
  `astroturfing`, legit non-ASCII words, standalone numbers/prices/model numbers — all present.
- [x] Accessibility assertions present (if UI card) — N/A (server module, no UI).

## Blockers

None.

## Suggestions (non-blocking)

1. Bidi controls (U+202A–U+202E, U+2066–U+2069) are a named deferral; if a future live probe surfaces a
   bidi-insertion evasion, adding them to `ZERO_WIDTH_RE` is a one-line, raw-OR-union-safe follow-up.
   No action now — the deferral is documented and the union keeps detection safe.
2. The leet map omits `2`/`6`/`8`/`9` deliberately (no clean look-alike). If a future probe shows a
   `2`-for-`z`/`6`-for-`b` evasion in practice, that is a documented expansion path with the same
   adjacency gate — again, no action now.

## Operator next steps

- Push the branch: `git push -u origin feat/ops-mcp-ban-scan-normalization`
- Open PR: `gh pr create --title "OPS-MCP-BAN-SCAN-NORMALIZATION: evasion-resistant ban scans (raw-OR-normalized union)" --body-file docs/reviews/OPS-MCP-BAN-SCAN-NORMALIZATION.md`
- Deploy (Deno-deploy-bearing, **no provider spend, no DB push, no Edge deploy, no new MCP booleans**):
  on merge to main the GitHub integration auto-redeploys `cdiscourse-mcp-server` to Deno Deploy
  (`deploy/civildiscourse/cdiscourse-mcp-server`). After merge:
  1. Confirm the Deno Deploy build for `cdiscourse-mcp-server` succeeded (hosted `*.deno.net` readback).
  2. Hit `/health` on the hosted endpoint → expect 200.
- Post-merge worktree cleanup (operator step; from roadmap-reviewer.md § "Post-merge worktree cleanup"):
  remove the implementer worktree with `git worktree remove -f -f` and `git branch -D
  feat/ops-mcp-ban-scan-normalization`, run from the main repo root (not inside a worktree).
