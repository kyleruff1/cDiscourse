# ADMIN-MCP-001 — semantic-referee `mcp` write-path audit (7 layers)

**Issue:** #477 — full semantic-referee `mcp` provider write-path audit.
**Card scope (this run):** autonomous portion — Layers 1/2/3/7 (all `src/**`)
plus the read-only verdict of Edge Layers 4/5/6, the three leak / labelling /
type tests, and the operator-smoke skeleton.

Audit-Lint: v1

This is the semantic-referee **`mcp` provider door** (advisory referee
packets). It is NOT the A–G boolean-observation auto-trigger path (#465 / #470 /
the MCP-lit-corpus card).

---

## Verdict

**PASS**

Merge class: **autonomous (`src/**`-only) green squash-merge.**

All seven layers PASS at HEAD (`8278390` → `feat/admin-mcp-001`). No layer was
broken or stubbed. No `supabase/functions/**` tightening was required to make
the card ship green, so the merge class is the **autonomous green
squash-merge** branch of the governance contract (not the operator-only GATE C
Edge-redeploy branch). The `deploy-gated` label was applied defensively at
filing time; because no Edge file changed, the reviewer may remove it.

One **optional, operator-gated** Edge nicety is noted at Layer 5 (a doctrine
comment in the handler). It is not required for correctness — the behaviour is
already PASS — and it lives in `supabase/functions/**`, so it is intentionally
NOT made in this autonomous run. See Layer 5.

---

## Layer-by-layer findings

| Layer | Surface | Tier | Verdict |
|---|---|---|---|
| 1 | Plain-language label | `src/**` (autonomous) | **PASS** |
| 2 | Selectable-mode list | `src/**` (autonomous) | **PASS** |
| 3 | Selectable-row UI + TS API types | `src/**` (autonomous) | **PASS** |
| 4 | Edge schema enum + refine | `supabase/functions/**` (read-only) | **PASS** |
| 5 | admin-users handler | `supabase/functions/**` (read-only) | **PASS** (doctrine-comment nicety: PARTIAL, operator-gated) |
| 6 | Provider resolver | `supabase/functions/**` (read-only) | **PASS** (not the `not_implemented` stub) |
| 7 | Tests (leak / labelling / type-union) | `src/**` + `__tests__/**` (autonomous) | **PASS** |

---

### Layer 1 — plain-language label — PASS

- `src/features/admin/semanticRefereeConfigApi.ts:31`
  `PROVIDER_MODE_LABELS.mcp === 'CD - MCP Server'`.
- The map is keyed by `SemanticRefereeConfigView['providerMode']`, so the `mcp`
  key is type-required (a missing key would be a compile error).
- No internal snake_case code in the label.

Coverage (pre-existing + new):
- `__tests__/semanticRefereeConfigApi.test.ts:141` asserts the exact string.
- `__tests__/adminMcpClientLeakScan.test.ts` (new) re-asserts the string and the
  no-snake_case rule.

---

### Layer 2 — selectable-mode list — PASS

- `src/features/admin/AdminSemanticRefereeTab.tsx:41-46`
  `SELECTABLE_MODES = ['anthropic', 'mock', 'fixture', 'mcp']`.
- `mcp` is rendered through the same `.map()` row as the other three — there is
  no disabled row, no early-return guard, and no "Coming later" / "MCP-018"
  stub copy. The removed-disabled-row comment is at line 273
  (`// mcp is now in SELECTABLE_MODES — no separate disabled row.`).
- `MODE_DESCRIPTIONS.mcp` (`:53`) describes the mechanism in the abstract
  ("Routes through the configured MCP URL + bearer") — it names no concrete
  URL, host, or token. Confirmed leak-clean by the Layer 7 scan.

Coverage:
- `__tests__/AdminSemanticRefereeTab.test.tsx:62-79` (rows for all four modes;
  mcp settable; no disabled row; no early-return guard).

---

### Layer 3 — selectable-row UI + TS API types — PASS

- UI row: `AdminSemanticRefereeTab.tsx:250-272` renders a `Pressable` per mode
  with `accessibilityRole="button"`, `accessibilityState={{ selected, disabled }}`,
  and a 44×44 hit target via `hitSlop`. Selecting `mcp` calls `onSelectMode`,
  which (because `requiresProviderConfirmation('mcp') === false`) applies the
  change one-click — no Anthropic-style confirmation panel.
- TS API types (the type half of Layer 3, also a Layer 7 deliverable):
  - `src/lib/edgeFunctions.ts:355` `SemanticRefereeConfigView.providerMode`
    includes `'mcp'` (read view).
  - `src/lib/edgeFunctions.ts:374` `SetSemanticRefereeConfigInput.providerMode`
    includes `'mcp'` (set input). PR #460 widened this; the ADMIN-AI-001 design
    (lines 392–404) originally EXCLUDED `mcp` on the set-input.

Coverage:
- `__tests__/AdminSemanticRefereeTab.test.tsx:154-165` (a11y role/label/state +
  hit target).
- `__tests__/adminMcpClientLeakScan.test.ts` (new) — compile-level type-union
  assertions that both `providerMode` unions accept `'mcp'`.

---

### Layer 4 — Edge schema enum + refine — PASS (read-only)

- `supabase/functions/_shared/adminSemanticConfigSchemas.ts:37`
  `SEMANTIC_PROVIDER_WRITE_MODES = ['anthropic', 'mock', 'fixture', 'mcp']`.
- `:54` `providerMode: z.enum(SEMANTIC_PROVIDER_WRITE_MODES)`.
- `:59-65` `.refine()` requires `confirmAnthropic === true` ONLY when
  `providerMode === 'anthropic'`. `mcp` is one-click (no confirmation flag).

No change made — this file is `supabase/functions/**` (operator-gated). Recorded
PASS by read.

---

### Layer 5 — admin-users handler — PASS (read-only); doctrine-comment nicety operator-gated

- `supabase/functions/admin-users/index.ts:746-796` `handleSetSemanticConfig`:
  - persists `body.providerMode` (now including `mcp`) to
    `semantic_referee_runtime_config` (`:761-769`),
  - writes the dedicated config-audit row (`writeConfigAudit`, `:774-781`),
  - writes the generic admin-traffic audit row (`writeAdminAudit`, `:784-789`),
  - returns the settled `{ providerMode, enabled, updatedAt }` (`:791-795`).
- The function never returns or logs the MCP URL / token (those are read only
  inside the Edge `mcpAdapter.ts`, proven by `semanticMcpSourceScan.test.ts`).

**Optional nicety (NOT made in this run):** the issue's Layer 5 asks the handler
to carry an explicit doctrine comment — why `mcp` is one-click vs `anthropic`;
that the MCP URL+token never leave the Edge side; that provider mode never
grants the packet truth authority (`authoritative: false` regardless). That
rationale is already documented at the schema layer
(`adminSemanticConfigSchemas.ts:9-19`) and the adapter pins `authoritative`
false (`mcpAdapter.ts`, proven by `semanticMcpSourceScan.test.ts:242-248`).
Adding the comment to the handler body is a `supabase/functions/**` edit →
**operator-gated**; it is a documentation nicety, not a correctness gap, so it
is deferred rather than made here. If the operator wants it, it can ride the
next Edge-touching card or be applied at GATE C.

---

### Layer 6 — provider resolver — PASS (read-only); NOT the `not_implemented` stub

- `supabase/functions/_shared/semanticReferee/providerRoutingCore.ts:141-150`:
  `providerName === 'mcp'` → `await deps.runMcp(request)`, with the typed
  `unavailable` outcome translated via `mcpReasonToOutcomeReason`. This is the
  live MCP-018 adapter path, NOT the MCP-016 `not_implemented` stub.
- The issue's HALT condition ("if Layer 6 routes `mcp` to the `not_implemented`
  stub → HALT, file `ADMIN-MCP-IMPL-002`") is **NOT triggered**. The audit can
  ship green.

No change made — read-only verdict.

---

### Layer 7 — tests (leak / labelling / type-union) — PASS

The issue names three Layer 7 tests. Status at HEAD:

1. **Client leak scan** — extended. The pre-existing
   `__tests__/semanticMcpSourceScan.test.ts` proves the MCP env-var NAMES
   (`SEMANTIC_REFEREE_MCP_URL` / `SEMANTIC_REFEREE_MCP_TOKEN`) appear in no
   `src/` or `app/` file. The two shapes that scan did NOT cover — the
   `/mcp/adapter-compat` route path and an MCP-server hostname literal — are
   now covered by `__tests__/adminMcpClientLeakScan.test.ts` (new), scoped to
   `src/**` (+ `app/**` for the route path).
2. **Tab-labelling test** — present:
   `__tests__/AdminSemanticRefereeTab.test.tsx` proves all four modes render
   through `PROVIDER_MODE_LABELS`, mcp is settable, and no stub copy remains.
3. **Type-union compile test** — added:
   `__tests__/adminMcpClientLeakScan.test.ts` asserts both `providerMode`
   unions accept `'mcp'` at compile level (a regression in either union would
   fail `npm run typecheck` AND this test).

---

## What was thin / what was tightened

- Layers 1/2/3 (the `src/**` production source) were **complete and correct at
  HEAD** — nothing was thin; no production-source edit was needed.
- The only thin spot was **Layer 7 leak-scan coverage**: no test scoped to
  `src/**` asserted that the `/mcp/adapter-compat` route path and the MCP
  hostname never leak into the client. That gap is filled by the new
  `__tests__/adminMcpClientLeakScan.test.ts` (12 tests). The new file plus the
  type-union assertions are the entire delta of this run; both are `__tests__/`
  / `src/`-adjacent — no Edge change.

---

## Boundary honored

- NO provider call by Claude. NO MCP token / URL displayed. NO `mcp-server/`
  change. NO migration. NO `supabase/functions/**` change.
- Edge Layers 4/5/6 are recorded by READ only (the audit verdict requires their
  state; no byte changed).
- The end-to-end provider smoke (Layer 5/6 live path) is operator-run — see
  `docs/audits/ADMIN-MCP-001-SMOKE.md`.
