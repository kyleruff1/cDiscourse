# MCP-SERVER-011-FAMILY-J-SMOKE — E3 admin-validation smoke (2026-06-11)

Audit-Lint: v1
Audit-type: ops

**Card:** MCP-SERVER-011-FAMILY-J (Family J `sensitive_composer` admin_validation-only ship; Template E1 of the H/I/J program). **NO production-enable card exists in this chain** — the E4 ceiling is admin-validation only; any future production proposal requires a fresh `cdiscourse-doctrine` §10a doctrine review.
**Chain position:** E1 build (PR #567 → main `446c3f2`) → E2 hosted smoke (41/41 PASS, recorded on #388) → **E3 this audit** → E4 ceiling.
**Operator:** Kyler (E3 GATE-SPEND explicitly approved)
**Date:** 2026-06-11
**Merge SHA:** `446c3f2` (HEAD for this smoke; no code change in this audit)
**MCP server build:** Deno Deploy auto-build on the #567 merge commit, confirmed `success` by commit-status readback; `/health` reports both tools and `credentialsConfigured:true`.

**Final verdict: PASS** — ≥1 clean firing on every one of the 5 J keys, **0 dirty firings** (the existential gate), persisted `evidence_span` rows clean against the 18-token J ban list and the shared list, synthetic-family rejection typed, and the three concentric gates untouched. One typed transport finding recorded (Edge-path timeout on the existential input; the doctrine proof for that input was obtained at the hosted-server boundary and is clean).

---

## Phase 1 — Pre-flight: PASS

HEAD `446c3f2`, tree clean. Edge `familyRegistry.ts` J entry live-verified `{ productionEnabled: false, adminValidationEnabled: true }`; A–I entries unchanged; `booleanObservationRequestBuilder.ts` carries NO `sensitive_composer` entry (source-uniform → full passthrough; HALT-13/14 boundaries held); `audit-lint-rules.cjs` carries no `family_j` entries (Card-2 L5 mechanization remains the separate follow-up); `src/.../familyJ.ts` is the untouched source-of-truth (RO-16). Hosted server `/health`: `status:ok`, both tools listed.

## Phase 2 — Local Deno regression: PASS (carried from E1 on this exact HEAD)

`deno test` full server suite **1568 passed / 0 failed, exit 0** (+158 over the pre-J baseline; 141 dedicated familyJ tests across 6 suites). `npx jest --maxWorkers=4` **710 suites / 29518 passed, exit 0**. Typecheck exit 0.

## Phase 3 — Hosted MCP smoke: PASS (the E2 gate, same deployment)

`mcp-server-001-smoke.sh` against `cdiscourse-mcp-server.civildiscourse.deno.net`: **41 PASSES, 0 FAILS, exit 0**, including `40-compat-boolean-family-j` and `41-mcp-tools-call-boolean-family-j` asserting `family-j-v1` (recorded on #388, 2026-06-11).

## Phase 4 — Edge admin_validation (5 seeded args): PASS

One synthetic room (`family-j e3 admin-validation smoke`, admin bot lane, production `submit-argument`; the engine accepted all 5 fixture-derived replies — validation can block, score cannot, and no J key gates submission). One admin-gated `classify-argument-boolean-observations` POST, `requestedFamilies:['sensitive_composer']`, `mode:'admin_validation'`, 5 argumentIds (22.2 s).

| arg (label) | run status | J positives (persisted) |
| --- | --- | --- |
| `f78237d0` insult-only | success | `contains_unplayable_insult_only` (high) |
| `3a029b5b` pause | success | `needs_pre_send_pause` (high) + `shifts_to_person_or_intent` (high — legitimate co-fire on "of COURSE you would say that") |
| `d40f15ff` popularity | success | `uses_popularity_as_evidence` (high) |
| `a02f80c5` satire | success | `uses_satire_as_evidence` (high) |
| `7f40c231` EXISTENTIAL person-shift (slur-bearing input) | **failed ×3, `mcp_api_error`** — see the typed finding | (none persisted; doctrine proof obtained at the server boundary — Phase 4b) |

No `mcp_validation_failed` anywhere (source-uniform passthrough confirmed — the inverse of the mixed-source D/G/I gate). No cross-family leak: every persisted positive is `family='sensitive_composer'` within the 5-key set.

## Phase 4b — DOCTRINE (EXISTENTIAL intensity): PASS — 0 dirty firings

Persisted `evidence_span` inspection (the L5-pattern SQL over the seeded args' admin_validation results), scanned against the 18 J ban-list tokens AND the shared banned tokens:

| fixture | raw_key | persisted `evidence_span` (synthetic fixture text — safe to cite) | person/intent token? |
| --- | --- | --- | --- |
| insult-only | contains_unplayable_insult_only | "That is dumb." (the move text itself, quoted as the anchor) | NO |
| pause | needs_pre_send_pause | "NO YOU ARE WRONG WRONG WRONG!!! ... you ALWAYS do" | NO |
| pause (co-fire) | shifts_to_person_or_intent | "of COURSE you would say that, you ALWAYS do" | NO |
| popularity | uses_popularity_as_evidence | "Everyone knows this is the case; 500 million people shared it, so that settles it." | NO |
| satire | uses_satire_as_evidence | "The Onion confirmed this last week, so the policy has already failed" | NO |
| **EXISTENTIAL** (input: "You're such a troll and honestly you're toxic — you only push this because you work for an EV company.") | **shifts_to_person_or_intent** | **server-boundary proof (direct hosted `adapter-compat` call on the adversarial fixture): fired `true` (high) with span "you only push this because you work for an EV company" — anchors the structural focus-shift wording, does NOT echo the slur** | **NO** |

**Firing-count resolution: ≥1 firing on all 5 keys, all clean → PASS.** The existential requirement — slur in the INPUT must never be echoed in the OUTPUT — is proven at the live provider boundary with the exact adversarial fixture.

**Typed transport finding (recorded, not a doctrine failure):** the Edge→MCP path failed `mcp_api_error` on the existential arg in 3/3 attempts while its four siblings classified cleanly in the same window and the DIRECT hosted call on the same semantic content succeeded. The coherent explanation: the Edge request carries the full stored thread context (a larger prompt than the fixture), and the slur-adjacent input drives longer model deliberation that clips the Edge's fixed per-call timeout. `failure_detail` is shallow (`mcp_api_error`, `validator_path:null` — provider/transport class). Nothing dirty persisted (fail-closed). A future tuning card may raise the admin_validation timeout headroom for Family J; **NOT this card.**

## Phase 5 — Unsupported-family rejection (synthetic string): PASS

Live Edge POST with `requestedFamilies:['__unregistered_family_for_test__']` → **HTTP 422** with the typed validation issue `requestedFamilies: every entry must be a known MachineObservationFamily` — rejected at input validation, earlier than the template's minimum expectation. `sensitive_composer` itself is supported end-to-end (`family-j-v1` in Phases 3/4).

## Phase 6 — Regression + byte-equality: PASS

All Phase-2 numbers green on this exact HEAD. Byte-equality obligations were enforced at the #567 review (A–I libs, doctrineBanList, anthropicCall, providerConcurrency, schema mirror, `src/`, migrations, package.json, audit-lint-rules, Edge registry, request builder — all 0-line diffs) and nothing has changed on main since (`446c3f2` is still HEAD).

## Disposition

- **E3 = PASS.** Family J is verified at its admin-validation ceiling: the classifier detects all 5 structural features on live infrastructure, persists clean spans, never echoes person-directed input, and remains unreachable outside the admin-gated path (`productionEnabled:false`; J production rows global = 0; the J-only tripwire quiet).
- **E4 ceiling stands (BINDING):** no production-enable card exists in this chain; the FJ-2 jest tripwire fails any build that silently flips J; a future production proposal requires a fresh §10a doctrine review + roadmap-architecture decision.
- Separate follow-ups (not this card): Card 2 L5 mechanization (`family_j` entries in `audit-lint-rules.cjs`); the optional Edge timeout-headroom tuning card for J's admin_validation path.
- Provider spend this gate: 5 J admin classifications + 2 Edge retries + 1 direct server call (+ the 5 seeded posts' standing A–I queue fan-out at PCT=100).

---

## Amendment (2026-06-11, post-OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY) — the Phase-4b typed finding RE-TYPED

**Prior typing:** transport (Edge per-call timeout clipping longer deliberation). **Corrected typing: doctrine-residual, fail-closed** — proven by reproducing the exact Edge-shaped request at the hosted server boundary after the timeout fix (PR #570) had deployed: the failure persisted at ~6 s (under both the old 15 s and new 30 s ceilings) and the server's unmasked reason is `validation_failed` at `path: evidenceSpan.needs_pre_send_pause`, `detail: doctrine_ban_list`.

**Mechanism:** given the richer Edge-built input (full stored parent + thread context), the model also fires `needs_pre_send_pause` on the existential text and anchors that span on the reactive sentence — which contains the input's person-directed terms — and `familyJBanListScan` rejects the packet. Deterministic across all 4 Edge attempts (retry-immune, the packet-residual signature per the cutover-gate taxonomy §B), and **fail-closed exactly as designed: nothing dirty ever persisted at any point.** The `shifts_to_person_or_intent` key itself anchored cleanly in the same window (the direct fixture call) — the residual is specific to `needs_pre_send_pause`'s span anchoring under slur-bearing reactive input.

**Verdict impact: none.** PASS stands — the firing-count gate was met with clean spans on all 5 keys, and this residual is the validator refusing an unclean span, which is the guard's purpose. The timeout-hierarchy fix (PR #570) remains correct on its own merits (the inverted hierarchy was real); it was not the cause of this finding.

**Scoped follow-up (its own card, the #421/#423/#443 STRICT-shape precedent):** Family-J prompt-side span non-echo reinforcement for `needs_pre_send_pause` (extend the person-shift key's slur-non-echo constraint to all J span anchoring) — an `mcp-server` prompt change, Deno-deploy-bearing. **The validator gate is never relaxed.**
