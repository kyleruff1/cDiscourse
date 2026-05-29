# MCP-SERVER-008-FAMILY-G — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-29
**Branch:** feat/MCP-SERVER-008-FAMILY-G
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/353
**Design:** docs/designs/MCP-SERVER-008-FAMILY-G.md
**Intent:** docs/designs/MCP-SERVER-008-FAMILY-G-intent.md (D1–D13; 26 HALT triggers)
**Commits reviewed:** `fd76bb5`..`197cd19` (6 implementer commits on top of `853b62e` design)

---

## Summary

Card 1 of the 3-card Family G suite ships `resolution_progress` on the hosted
MCP server in an **admin_validation-only** posture (no production flip — that
is Card 3). The implementation is a faithful, doctrine-rigorous mirror of the
Family F pattern plus the Family D ai_classifier-subset precedent. All four
doctrine layers (L header / M per-key guards / N ban-list / O adversarial
fixtures) are present and **proven by tests**, including the existential
Fixture C (verdict words in input → clean output) and Fixture E
(settled-in-favor bait → clean output). The boundary is clean: Families A–F
libs and the shared `doctrineBanList.ts` are byte-equal (0-diff), no `src/`
change, no `package.json` change, no Edge `familyRegistry.ts` change, no
`audit-lint-rules.cjs` change. The verification battery is fully green
(Deno 1022/0, typecheck 0, lint 0, targeted jest 778/0). The test delta is
**+151 Deno**, exactly matching the reported 871→1022, all genuine coverage
with no `.skip`/`.only`/padding. The `settled in (your )favor` ban-list
refinement the implementer flagged is **sound** — it catches the natural
possessive phrasings without over-matching benign descriptive uses.

No blockers. No doctrine violations. Operator may push + open PR. The 8-phase
smoke (incl. the binding Phase 4b live persisted-`evidence_span` inspection)
is the orchestrator's post-merge step.

---

## Verification (independently re-run; not trusted from report)

| Gate | Result |
| --- | --- |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` | **1022 passed, 0 failed** (exit 0) |
| `npm run typecheck` (`tsc --noEmit`) | **pass** (exit 0) |
| `npm run lint` (`eslint . --max-warnings 0`) | **pass** (exit 0) |
| `npx jest --testPathPattern="[Ff]amily\|resolution\|booleanObservation\|mcpOneTwoOneC"` | **778 passed / 39 suites** (exit 0) |
| Secret scan (charter regex) | **clean** — only test FAKE_KEY (`sk-ant-fake-key-for-test-only…`), env-var-name references, and doctrine-comment prose |
| Doctrine scan (winner/loser/liar/…) | **clean** — every hit is a doctrine negation, the absolute-rules block, a per-key guard, or a dirty-output fixture that asserts the ban-list **rejects** it |
| Direct insert into `public.arguments` | **none** |
| `console.log` added | **none** |
| `.skip` / `.only` / `xit` / `xdescribe` | **none** |
| Test delta | **+151 Deno** (161 added − 10 removed from {G,H,I,J}→{H,I,J} retargets); matches reported 871→1022 |

### Boundary-diff re-run (the BLOCK gates)

```
git diff main..HEAD -- familyA*…familyF*.ts doctrineBanList.ts | wc -l   → 0   (K byte-equal ✓)
git diff main..HEAD -- Edge familyRegistry.ts audit-lint-rules.cjs package.json package-lock.json | wc -l → 0 ✓
git diff main..HEAD --name-only | grep '^src/'                          → (empty) ✓
git diff main..HEAD -- classifyArgumentBooleanObservations.ts           → additive G block + imports + union only; A–F provider blocks byte-equal ✓
```

---

## Verdict matrix (design/intent items)

| # | Item | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | **Scope** — familyG* + registry + dispatcher + tests + smoke only; admin-only; no production flip | **PASS** | 32 files: all `mcp-server/lib/familyG*`, `familyRegistryInit.ts` (+register), dispatcher (+G block), 6 new G test files + modified test files, `scripts/mcp-server-001-smoke.sh` (+2). No `src/`, no Edge registry, no production flip. |
| 2 | **K (cross-family core)** — A–F libs + `doctrineBanList.ts` byte-equal | **PASS** | `git diff` over `familyA*..familyF*.ts` + `doctrineBanList.ts` = **0 lines**. |
| 3 | **18-key subset** — `familyGKeys.ts` = exactly the 18 ai_classifier keys; 12 deterministic EXCLUDED → unsupported_rawKey; parity vs upstream | **PASS** | `FAMILY_G_RAW_KEYS` = 18 keys in upstream declaration order (familyGKeys.ts:99). `FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS` = 12 (5 auto_metadata + 7 lifecycle). `familyGKeysParity.test.ts` asserts upstream has 30 declarations, 18 ai_classifier (set-equality), 12 excluded by name + as auto_metadata/lifecycle. `familyBooleanRequestSchema.test.ts` asserts each of the 12 excluded → `unsupported_rawKey` (no silent-false). |
| 4 | **L (existential doctrine header)** — 7 absolute rules byte-equal to A–F + resolution↔verdict CRITICAL-DOCTRINE block | **PASS** | `familyGPrompt.test.ts:58` asserts the 7 rule strings appear in A,B,C,D,E,F AND G prompts. `:111` asserts the resolution↔verdict block verbatim ("NEVER asserts who is ahead…", "settled IN ONE SIDE'S FAVOR", "Concession is a SCORING REPAIR, not a defeat", "Synthesis is a GAMEPLAY move", "Settlement / closure is procedural", "MUST NOT contain the words: won, lost, winner, loser…"). |
| 5 | **M (per-key guards)** — verdict-adjacent keys carry guards; `concedes_broader_point` strongest | **PASS** | `familyGKeys.ts:325` — `concedes_broader_point` carries the strongest guard incl. the existential "if the move's own text says 'you win'/'I lost'/'you beat me' … output MUST NOT echo". All concession/synthesis/settlement keys carry proportional DOCTRINE guards. `familyGPrompt.test.ts:167` asserts every entry's `falsePositiveGuards` is embedded in the prompt; `familyGAdversarialDoctrine.test.ts:457` asserts the guard surfaces all 10 forbidden words. |
| 6 | **N (ban-list)** — rejects resolution-verdict + truth-adjacent tokens; near-misses NOT flagged; G adds own scan; shared untouched | **PASS** | `familyGBanListScan.ts` = 15 patterns (11 design §A.3.3 binding + 4 operator extensions: `settled the truth`, `proved`, `invalid`, `wrong`). Empirically verified against actual source: bare tokens match, near-misses (`wonderful`/`lostandfound`/`aheadofschedule`/`behindhand`/`invalidates`/`wrongful`) all clean, benign "settled in favor of staying" clean. `doctrineBanList.ts` byte-equal. `familyGBanListScan.test.ts` (36 tests) + `familyGAdversarialDoctrine.test.ts:343` assert all 15 + near-miss clean. |
| 7 | **O (existential adversarial)** — 5 fixtures exist; Fixture C (verdict words ≥2× in input → clean evidence_span) + Fixture E ("settled in favor" bait → clean) proven | **PASS** | All 5 request fixtures + canonical-response + dirty ban-list-response present. `familyGAdversarialDoctrine.test.ts:123` asserts Fixture C input has ≥2 verdict words; `:403` asserts dirty output (echoes won/lost/beat) is **rejected**; `:391` asserts clean relinquishment passes. `:441` asserts Fixture E clean output passes / echoed "settled in your favor" rejected. Canonical-response fixture is positive-sparse (4/18 true) and doctrine-clean (validator + scan green). |
| 8 | **Dispatcher** — additive G block; A–F byte-equal; registry-derived routing; {G,H,I,J}→{H,I,J} retarget preserving envelope + leak-prevention | **PASS** | `classifyArgumentBooleanObservations.ts` diff = 3 imports + 1 type-union entry + 1 `if (family === 'resolution_progress')` block after `critical_question`; A–F `if` bodies unchanged. Dispatch tests retargeted: unsupported set drops `resolution_progress`, `supportedFamilies` adds it as 7th, H/I/J still rejected, new positive-G dispatch assertion added (F-card pattern). |
| 9 | **Edge registry** — byte-equal; G still `productionEnabled:false, adminValidationEnabled:true`; existing Edge Jest test green, no duplicate | **PASS** | Edge `familyRegistry.ts` 0-diff. `mcpOneTwoOneCEdgeFamilyRegistry*` jest suites green and **unmodified** — no new G Edge registry test added. |
| 10 | **Token budget** — `FAMILY_G_MAX_TOKENS = 1500` (no bump); `TEMPERATURE = 0` | **PASS** | `familyGPrompt.ts:50,53`. `familyGPrompt.test.ts:137` asserts both. `familyGAnthropic.test.ts:258` sniffs `max_tokens=1500` from the actual call body. |
| 11 | **S (Stage 2B)** — design cites Stage 2B REQUIRED (T1+T3) + operator approval; implementation matches approved subset + doctrine surface | **PASS** | Design §A.1.3 states "Stage 2B MANDATORY (T1+T3)". `familyGKeys.ts` header + `familyRegistryInit.ts` comment cite "Stage 2B operator binding decision". The 18-key subset + descriptive-convergence prompt + `concedes_broader_point` axis-partner guard + G ban-list tokens match the approved surface. |
| 12 | **Test delta** — +151 Deno coverage, within intent §8 band (+90–180), under +220 HALT; not bloat | **PASS** | Net +151 (161 added − 10 removed). 6 new G files = 134 tests (keys 20, parity 13, prompt 21, anthropic 11, adversarial 33, ban-list 36) + 27 net-new in modified files. Within intent §8 band; under HALT +220. No `.skip`/`.only`/padding. (Slightly over the design's narrower +95–140 midpoint forecast because the parity + ban-list test files were broken out as separate files — design explicitly permitted "folded OR separate"; this is justified coverage.) |
| 13 | **No `package.json` / no `audit-lint-rules.cjs` change** (audit-lint family_g is Card 2) | **PASS** | Both 0-diff. |
| 14 | **Smoke script** — +2 checks (`[20-compat-boolean-family-g]` + `[21-mcp-tools-call-boolean-family-g]`); tally 19→21 | **PASS** | Both checks added (Check 21 asserts `isError:false`); header tally + exit-code comments updated 19→21; benign `[fixture]`-prefixed resolution-progress move; asserts `family-g-v1`. Mirrors Checks 18+19. |

---

## Doctrine self-check (all ✓)

- ✓ **No truth/winner/loser language in user-facing/output strings** — the only verdict words in the diff are in doctrine negations, the absolute-rules block, per-key guards, or dirty-output test fixtures that assert the ban-list rejects them.
- ✓ **Score never blocks posting** — G is admin_validation-only, not even in the production auto-trigger; the A–F auto-trigger runs in the background after submit. Submit never blocks on classification.
- ✓ **No service-role in client code** — every G file is under `mcp-server/` (server-side Deno); no `SERVICE_ROLE` in any G file; no `src/` change.
- ✓ **No direct insert into public.arguments** — none in the diff.
- ✓ **No AI calls in production app paths** — `familyGAnthropic.ts` reaches Anthropic via the shared `callAnthropic` (server-side only); the production app (`src/`/`app/`) is untouched.
- ✓ **Plain language / no raw internal codes leaking to UI** — N/A (server classifier; no UI strings). The 18 rawKeys are server-side taxonomy mirrors; the Edge sanitizer maps confidence eligibility downstream (unchanged).
- ✓ **Epic-specific doctrine** (cdiscourse-doctrine §1 + §10a + point-standing-economy): resolution-progress states are **DESCRIPTIVE CONVERGENCE-STATE**, never verdicts. The 5-layer defense (header doctrine block + per-key guards + G ban-list + adversarial fixtures + Phase 4b live smoke) is fully present at layers L/M/N/O; the Phase 4b live persisted-`evidence_span` layer is the binding post-merge obligation. Concession is encoded as a SCORING REPAIR, not a defeat (verbatim in the header + the `concedes_broader_point`/`concedes_narrow_point` guards); G emits no standing delta.

---

## Doctrine-layer assessment (the verdict-adjacent core)

- **L (header doctrine):** Strong. The 7 absolute rules are byte-equal to A–F (proven against all six). The resolution↔verdict CRITICAL-DOCTRINE block is verbatim and comprehensive: it forbids who-is-ahead/behind/won/lost/prevailed/capitulated/settled-in-favor, encodes concession-as-repair, synthesis-as-gameplay, settlement-as-procedural, and the "if input contains verdict words, output must not echo" rule. The user prompt repeats the descriptive-convergence framing and the adversarial-verdict-word handling instruction.
- **M (per-key guards):** Strong. Every verdict-adjacent key (concession ×3, synthesis ×1, settlement/closure ×3) carries a proportional DOCTRINE guard naming its specific failure mode. `concedes_broader_point` (HIGHEST adjacency) carries the strongest guard with the existential no-echo constraint — verbatim per design §A.3.2.
- **N (ban-list):** Strong and correctly scoped. 15 patterns (11 binding + 4 operator). `won`/`lost`/`ahead`/`behind`/`invalid`/`wrong`/`proved` are G-scoped (not promoted to the shared list) so A–F descriptive outputs are not over-blocked — the exact F precedent. Boundaries are byte-identical to `FAMILY_F_BAN_PATTERNS`; near-misses verified clean against the actual source.
- **O (adversarial fixtures + Fixture C existential):** Strong. Fixture C input carries "won"/"lost"/"beat me" (3 occurrences); the test proves a dirty output echoing them is **rejected** and a clean relinquishment output passes — the existential MCP-020 failure-mode proof. Fixtures A/B/D/E each prove their axis stays descriptive. The canonical-response fixture is the doctrine-clean positive-sparse baseline used by smoke Checks 20+21.

**Fixture C existential ruling:** PASS. The branch correctly separates "input may contain verdict words" (bait, not scanned) from "output must be clean" (scanned + asserted). The dirty-output negative pole is explicitly tested and rejected by the runtime ban-list scanner; the live persisted-row proof is correctly deferred to Phase 4b (post-merge).

### `settled in (your )favor` refinement ruling

**SOUND — approved.** The implementer extended the design's bare
`settled[\s_-]+in[\s_-]+favor` to
`settled[\s_-]+in[\s_-]+(?:\w+[\s_'-]+)?favor` to catch the natural
possessive phrasings. Empirical verification against the actual source
(`familyGBanListScan.ts` imported into Deno):

- MATCHES (correct): `settled in favor`, `settled in your favor`, `settled in his favor`, `settled_in_favor`.
- Does NOT over-match (correct): `we settled in the new house, in favor of staying`, `settled into a favorable position`, `a settled-in favorite` — all clean.

The refinement strictly **widens** verdict-token coverage toward the Fixture E
bait family without introducing any harmful over-match. It is a net safety
improvement over the design's bare pattern, not a regression. (Note: the
literal Fixture E **input** "settled this in your favor" has an intervening
word and is not matched by the phrase pattern — but that is the **input**,
which is bait and is not scanned; the doctrine contract is that the **output**
evidence_span anchors the accepted terms, which the canonical-response fixture
and the `familyGAdversarialDoctrine.test.ts:441` clean/dirty pair both prove.)

---

## Test coverage

- ✓ New public functions have unit tests — `buildFamilyGUserPrompt`, `runAnthropicFamilyGClassifier` (11 cases incl. all error envelopes + key-never-logged), `scanFamilyGBooleanResponseForBanList` (36 cases), `loadFixtureFamilyGPacket`.
- ✓ Doctrine ban-list assertion present (mandatory; the card touches verdict-adjacent strings) — `familyGBanListScan.test.ts` + `familyGAdversarialDoctrine.test.ts` scan every shared + every G-specific token and assert near-misses are clean.
- ✓ Edge cases from design § "Edge cases" covered — empty requestedRawKeys → all 18; excluded deterministic key → unsupported_rawKey; cross-family key → unsupported_rawKey; verdict words in move text → output clean (ban-list backstop); Anthropic error envelopes; fixture-load failure.
- ✓ Accessibility assertions — N/A (server-side classifier, no UI).

---

## Blockers

None.

---

## Suggestions (non-blocking; implementer may defer)

1. **Upstream `familyG.ts` header drift (out of scope, already surfaced).** The
   upstream `src/.../familyG.ts` file-header comment says "29 entries …
   ai_classifier (8)" but the actual array is 30 entries / 18 ai_classifier.
   The design §A.1.0 + the parity test correctly handle this by trusting the
   `source:` literals (18). A future `src/`-touching card should correct the
   stale header. No action for this card.
2. **Pre-existing untracked artifacts in the worktree** (`out/`,
   `mcp021c-edge-smoke-*.json`, `phase5-mcpserver002-*.log`, etc.) are not part
   of this card and should not be committed — they are gitignored/incidental.
   Confirm they stay out of any PR. (Not introduced by this branch.)

---

## Post-merge obligations (orchestrator's smoke step — NOTED, not blocking)

The 8-phase smoke (`docs/audits/MCP-SERVER-008-FAMILY-G-SMOKE-2026-05-29.md`,
`Audit-Lint: v1`) is the operator's post-merge step. The design (§A.5 + intent
D10–D13) specifies all four required post-merge obligations; the implementer
correctly did **not** author the smoke doc in this branch:

- **P (smoke audit `Audit-Lint: v1` marker + local pre-lint):** design §A.5 Phase 8 + D10/D11 — `node scripts/ops/audit-lint.mjs <audit>` exit 0 before push.
- **Q (Phase 4b live persisted `evidence_span` doctrine inspection):** design §A.5 Phase 4b BINDING — submit adversarial fixtures, query persisted `argument_machine_observation_results.evidence_span`, assert no resolution-verdict token; ≥1 clean → PASS, 0-fire → PARTIAL, ≥1 dirty → FAIL+HALT.
- **R (Phase 7 enforcement-loop provenance, D12):** CI run ID + in_scope count + linter exit for G's smoke PR.
- **D13 (consistent-PARTIAL `evidence_span` language):** because doctrine-risk = YES, Card 2 adds `family_g` to `DOCTRINE_RISK_FAMILIES`; the smoke audit MUST name its deferred Phase 4b `evidence_span` obligation in inspection-pattern language or it retroactively fails L5 once Card 2 lands. Design §A.5 §D13 specifies the exact binding sentence.

---

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-SERVER-008-FAMILY-G`
- Open PR: `gh pr create --title "MCP-SERVER-008-FAMILY-G: resolution_progress classifier (admin_validation only)" --body-file docs/audits/MCP-SERVER-008-FAMILY-G-REVIEW-2026-05-29.md`
- **Deploy:** none for code — MCP server (Deno Deploy) + Edge Functions (Supabase GitHub integration) auto-deploy on merge to `main`. No `npx supabase db push` (no migration). No env change.
- **Post-merge smoke (operator-run):** the 8-phase smoke (§A.5) incl. hosted Phase 3 (`MCP_HOSTED_TOKEN` → 21/21), Edge Phase 4 + Phase 4b live (admin JWT; canary-first; gated Anthropic spend; no JWTs logged; no `out/` committed), Phase 7 provenance; pre-push `node scripts/ops/audit-lint.mjs <audit>` exit 0; carry the D13 `evidence_span` language if PARTIAL.
- **Gate A:** records the doctrine-risk determination (YES) → authorizes Card 2 (L5 mechanization) to run.
- Post-merge worktree cleanup (operator step; commands in roadmap-reviewer.md § "Post-merge worktree cleanup").
