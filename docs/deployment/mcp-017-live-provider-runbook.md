# MCP-017 — Anthropic live-provider operator runbook

This runbook is for the **human operator** of the CDiscourse Supabase project. It walks through deploying the MCP-017 live-provider code for the `semantic-referee` Edge Function and — separately — enabling the live Anthropic provider.

**The implementer agent does NOT run any `npx supabase` command in this runbook.** MCP-017 produced the live-provider CODE only. It made **no live Anthropic call**. Deploying the updated function, setting any secret, and flipping the provider flag are operator actions, explicitly outside the implementation card (MCP-017 design §14). Every numbered step below is operator-runnable; the agent has no execution path here.

The first real Anthropic call is made by the operator, after Step 2 + Step 3 below.

---

## 0. What MCP-017 shipped

MCP-017 un-stubs MCP-016's `anthropic` provider slot with a real, working live provider:

- `supabase/functions/_shared/semanticReferee/anthropicProvider.ts` — the Deno-only orchestrator. The **only** file that reads `ANTHROPIC_API_KEY` (via `Deno.env.get()`) and calls `https://api.anthropic.com/v1/messages`.
- `anthropicClassifierCore.ts` / `seedPrompt.ts` / `contentSafetyScan.ts` — the zod-free core (prompt assembly, response parsing, content-safety scan).
- `providerRoutingCore.ts` — the extracted zod-free routing switch; `providerRouting.ts` / `providers.ts` are now async and wire the live provider.

The live provider is **opt-in**. With `SEMANTIC_REFEREE_PROVIDER` unset (or any value other than `anthropic`), the function still runs the deterministic `mock` provider exactly as MCP-016 shipped it. Deploying the MCP-017 code does **not** change runtime behaviour until Step 3 flips the flag.

Every Anthropic response is re-validated through the outbound `SemanticRefereePacketSchema` **and** the Deno content-safety scanner before it leaves the boundary. A key-missing / API error / rate limit / network failure / parse failure / validation failure all return a typed `{ enabled: false, reason }` outcome with **HTTP 200** — the user never sees an error, the caller falls back to the deterministic layer-1 result.

---

## 1. Prerequisites

Before deploying:

1. **MCP-016 is merged and deployed in mock mode.** MCP-017 builds on the deployed boundary. If `semantic-referee` is not yet deployed at all, deploy it first (Step 2 does that).
2. **An Anthropic API key.** MCP-017 reuses `ANTHROPIC_API_KEY` — the **same** Supabase secret the `process-language-draft` Edge Function already uses (MCP-009 §"Secret policy" recommends the reuse — see §7 below). If `process-language-draft` is already live, the key is already set; no new secret is needed. If you prefer a separate credential, see §7.
3. **A cost budget alert configured in the Anthropic dashboard** — set this **before** flipping the provider flag in Step 3. See §6.
4. **The branch is merged to `main`** (the operator merges the reviewed PR; the implementer does not push).

---

## 2. Deploy the updated function

Ship the MCP-017 live-provider code. This is safe to run at any time — the function keeps mock-behaving until Step 3.

```bash
npx supabase functions deploy semantic-referee --linked
```

The function now contains the live-provider code path but still routes to `mock` because `SEMANTIC_REFEREE_PROVIDER` is unset (the `?? 'mock'` default). Verify the deploy succeeded:

```bash
npx supabase functions list
```

> `supabase/config.toml` already declares `[functions.semantic-referee]` `verify_jwt = true` (from MCP-016). MCP-017 needs no `config.toml` change.

---

## 3. Enable the live provider

Three secrets govern the layer. Set them in order:

```bash
# 3a. Confirm the layer is enabled at all (MCP-016 established this flag).
#     The semantic-referee layer is OFF unless this equals the exact string 'true'.
npx supabase secrets set SEMANTIC_REFEREE_ENABLED=true

# 3b. Confirm the Anthropic key is present. If you reuse the process-language-draft
#     key it is already set — just verify it appears:
npx supabase secrets list | findstr ANTHROPIC_API_KEY
#     (If it is NOT set, set it now — the value is your Anthropic API key:)
#     npx supabase secrets set ANTHROPIC_API_KEY=<your-anthropic-api-key>

# 3c. (Optional) Pin the model id. The code default is the Haiku-class alias
#     `claude-haiku-4-5`; pin the dated snapshot if you want a frozen model:
npx supabase secrets set SEMANTIC_REFEREE_MODEL=claude-haiku-4-5
#     or, for a frozen snapshot:
#     npx supabase secrets set SEMANTIC_REFEREE_MODEL=claude-haiku-4-5-20251001

# 3d. Flip the provider to live. THIS is the doctrine-critical line — it is the
#     only action that makes the function call Anthropic.
npx supabase secrets set SEMANTIC_REFEREE_PROVIDER=anthropic

# 3e. Verify.
npx supabase secrets list
```

After 3d, the next `classifyMove` invocation routes to the live Anthropic provider.

> **Doctrine note.** `SEMANTIC_REFEREE_PROVIDER` defaults to `'mock'`. Any value other than the exact string `'anthropic'` (including unset) keeps the deterministic mock provider. There is no way to make `anthropic` the default — it is always an explicit operator opt-in.

---

## 4. Smoke test

From a single test room, invoke `classifyMove` (the `src/lib/edgeFunctions.ts` wrapper) and inspect the returned `SemanticRefereePacket`:

- `packet.provider` is `'anthropic'` (not `'mock'`).
- `packet.authoritative` is `false` (always — the boundary hard-pins it).
- `packet.binaries` carries one entry per requested classifier.

If the packet comes back `provider: 'mock'`, the flag did not take — re-check Step 3d and that the function was redeployed (Step 2). If the outcome is `{ enabled: false, reason: 'key_missing' }`, `ANTHROPIC_API_KEY` is not set (Step 3b). If `{ enabled: false, reason: 'api_error' }` / `'rate_limited'`, the key may be invalid or rate-limited — check the Anthropic dashboard.

A function cold start picks up new secret values; if a stale value seems to persist, wait for the next cold start or redeploy.

---

## 5. Rollback

Rollback is a **single command, instant, no redeploy**:

```bash
npx supabase secrets set SEMANTIC_REFEREE_PROVIDER=mock
```

The next invocation resumes the deterministic mock provider. Because the mock path was never removed, rollback cannot fail. To leave the deployed code in place but be certain no Anthropic call can happen, this flag flip is sufficient — the key is never read when the provider is `mock`.

---

## 6. Cost monitoring

The per-room call rate is bounded **upstream** by MCP-012's gating, which MCP-017 does not change:

- **Trigger gates** — only specific move events trigger a classify.
- **Batching** — at most 5 classifiers per Anthropic call.
- **In-memory LRU cache** — capacity 256; a repeated `(roomId, contentHash, promptVersion)` is served from cache, no call.
- **Token budget** — the move body is capped at 8000 chars by the inbound schema.
- **Retry policy** — at most 2 attempts.

What to watch in the Anthropic dashboard after the flag flip:

- **Daily spend** against the budget alert you set in §1 step 3.
- **Request rate** — a sustained spike beyond the expected per-active-room rate suggests a misconfigured trigger; roll back (§5) and investigate.
- **Error rate** — a rising 429 rate means the workspace rate limit is being hit; the provider degrades to `rate_limited` → deterministic fallback, so users are unaffected, but the live layer is effectively off until the rate recovers.

Recommended: start the cost alert at a low threshold — observed `process-language-draft` daily spend plus headroom — and tune it up after a week of real traffic.

---

## 7. Secret reuse and rotation

`ANTHROPIC_API_KEY` is **shared** with `process-language-draft` (MCP-009 §"Secret policy" — one fewer key to rotate, one billing surface).

**Rotation** — when the key is rotated, both functions pick up the new value on their next cold start:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=<new-anthropic-api-key>
```

A single `secrets set` updates the secret for **both** `semantic-referee` and `process-language-draft`. There is no per-function key.

**If you prefer separate keys** for the two features (cleaner isolation, at the cost of two rotations): name the second one `SEMANTIC_REFEREE_ANTHROPIC_API_KEY`. This requires a one-line code change in `anthropicProvider.ts` (read `SEMANTIC_REFEREE_ANTHROPIC_API_KEY` with `ANTHROPIC_API_KEY` as the fallback) — it is **not** part of MCP-017 as shipped; file a follow-up if you want it. With the shipped code, the semantic referee reads `ANTHROPIC_API_KEY` only.

---

## 8. Disable the layer entirely

To turn the whole semantic-referee layer off — mock and live alike — clear the master flag:

```bash
npx supabase secrets set SEMANTIC_REFEREE_ENABLED=false
```

With `SEMANTIC_REFEREE_ENABLED` not equal to `'true'`, the function returns `{ enabled: false, reason: 'disabled' }` (HTTP 200) and **no provider — mock or anthropic — is selected, and no key is read**. The disabled check runs before any provider selection.

---

## 9. Model-id confirmation

Before the first live deploy, confirm the Haiku-class model id is current in the Anthropic console:

- The code default is `DEFAULT_SEMANTIC_REFEREE_MODEL = 'claude-haiku-4-5'` (the Haiku 4.5 **alias** — it tracks the latest Haiku 4.5 snapshot).
- The dated snapshot form is `claude-haiku-4-5-20251001`.
- If you want a **frozen** model, pin the dated id via `SEMANTIC_REFEREE_MODEL` (Step 3c). If you do not pin, an operator who leaves `SEMANTIC_REFEREE_MODEL` unset gets the latest Haiku 4.5 snapshot via the alias.

The sibling `process-language-draft` provider pins the dated form; MCP-017 defaults to the alias deliberately and exposes `SEMANTIC_REFEREE_MODEL` so the operator owns the upgrade cadence.

---

## Operator decision summary

| Decision | Recommendation |
|---|---|
| Single shared key vs separate `SEMANTIC_REFEREE_ANTHROPIC_API_KEY` | **Reuse `ANTHROPIC_API_KEY`** — one fewer secret to rotate. Separate key requires a one-line follow-up code change. |
| Pin the model id vs let the alias float | **Pin the dated id** via `SEMANTIC_REFEREE_MODEL` so you own the upgrade; the code default alias is a safe fallback. |
| Cost-alert threshold | **Start low** (observed `process-language-draft` spend + headroom), tune up after a week. |
| Ship live before or after the in-room wiring card | **Land MCP-017 first**, deploy in mock mode; flip to live once the room-wiring card is proven. |

---

## What the operator never does in this runbook

- Run any command the implementer should have run — the implementer ran none; every step here is the operator's.
- Commit a key value to git — `.env` / `.env.example` carry no server secret; the runbook is the canonical name list.
- Deploy to the wrong project — `secrets set` / `functions deploy` operate on the `--linked` project; confirm the link before Step 2.
