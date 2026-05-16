# CDiscourse — AI Provider Decision

_Last updated: 2026-05-16_

## Decision Summary

**Stage 6.0: Anthropic Claude Haiku 4.5 is the first concrete language-processing provider.**

The scaffold is disabled by default (`AI_LANGUAGE_PROCESSING_ENABLED=false`). No Anthropic calls happen until that flag is explicitly set to `true` in Supabase Edge Function secrets.

---

## Provider Architecture

The scaffold is provider-neutral. The concrete provider is selected at runtime by the `AI_LANGUAGE_PROCESSING_PROVIDER` environment variable. Adding a new provider requires:

1. Implementing the provider in `supabase/functions/_shared/languageProcessing/`
2. Registering it in `providers.ts`
3. Adding the provider's API key as a Supabase secret

The TypeScript types and Zod schemas are shared across all providers.

---

## Current Providers

| Provider | Status | Notes |
|---|---|---|
| `mock` | Implemented | Deterministic lexical heuristics. No network calls. Used for tests. |
| `anthropic` | Implemented | Claude Haiku 4.5 via Messages API. Server-only. |
| `openai` | Placeholder | Returns `not_implemented`. Future stage. |

---

## Model

| Variable | Default | Notes |
|---|---|---|
| `AI_LANGUAGE_PROCESSING_MODEL` | `claude-haiku-4-5-20251001` | Set in Supabase Edge Function secrets. |

Claude Haiku 4.5 was chosen for Stage 6.0:
- Low cost and fast latency for a draft-assist feature
- Sufficient capability for transcript cleanup and argument type classification
- No tool use or extended thinking required for this task

If the model needs to be changed, update `AI_LANGUAGE_PROCESSING_MODEL` in Supabase secrets. No code change needed.

---

## Why Anthropic First

- Existing `ANTHROPIC_API_KEY` infrastructure
- Claude models perform well on structured JSON output tasks
- Native Messages API (no SDK dependency needed in Deno)
- Provider abstraction keeps the door open to GPT/OpenAI in a later stage

---

## Future Provider: OpenAI

To add OpenAI:

1. Implement `supabase/functions/_shared/languageProcessing/openaiProvider.ts`
2. Register it in `providers.ts` (`if (providerName === 'openai') { ... }`)
3. Add `OPENAI_API_KEY` and `AI_OPENAI_MODEL` as Supabase secrets
4. Mirror any shared logic to `src/features/languageProcessing/` for tests
5. Do not change the type contract — `LanguageProcessingResult` is provider-neutral

---

## Environment Variables (Server-Only)

These belong only in Supabase Edge Function secrets. Never in `.env` or any client-side config.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Required for Anthropic | — | Supabase secret only |
| `AI_LANGUAGE_PROCESSING_ENABLED` | Yes | `false` | Must be `true` to enable |
| `AI_LANGUAGE_PROCESSING_PROVIDER` | No | `anthropic` | `anthropic`, `openai`, `mock` |
| `AI_LANGUAGE_PROCESSING_MODEL` | No | `claude-haiku-4-5-20251001` | Any Claude model ID |
| `OPENAI_API_KEY` | Future | — | Not implemented in Stage 6.0 |
| `AI_OPENAI_MODEL` | Future | — | Not implemented in Stage 6.0 |

**Command to set secrets (run manually — never paste key into chat):**

```bash
npx supabase secrets set \
  AI_LANGUAGE_PROCESSING_ENABLED=false \
  AI_LANGUAGE_PROCESSING_PROVIDER=anthropic \
  AI_LANGUAGE_PROCESSING_MODEL=claude-haiku-4-5-20251001 \
  ANTHROPIC_API_KEY=<paste-key-manually>
```

Via Supabase Dashboard:
- Dashboard → Edge Functions → Secrets
- Add `ANTHROPIC_API_KEY`
- Add `AI_LANGUAGE_PROCESSING_ENABLED=false`
- Add `AI_LANGUAGE_PROCESSING_PROVIDER=anthropic`
- Add `AI_LANGUAGE_PROCESSING_MODEL=claude-haiku-4-5-20251001`

---

## What the AI May and May Not Do

**May:**
- Clean up filler words from transcript text
- Classify sentence segments by type (claim, evidence, question, etc.)
- Suggest an argument type for the draft
- Suggest a disagreement axis
- Suggest target excerpts from the parent argument
- Note possible civility concerns (advisory only)
- Note possible topic overlap weaknesses (advisory only)
- Note transcript issues (filler, incomplete sentence, etc.)

**May not:**
- Decide who is right or wrong in the debate
- Decide the winner of the debate
- Infer user intent as fact
- Recommend banning a user
- Recommend hiding, deleting, or modifying existing content
- Submit arguments on behalf of users
- Override deterministic Constitution validation
- Replace lexical topic checks

---

## Key Rotation Reminder

The `ANTHROPIC_API_KEY` that was set during session 2026-05-16 was exposed in conversation. It should be rotated:

1. Go to console.anthropic.com → API Keys → revoke the exposed key
2. Create a new key
3. `npx supabase secrets set ANTHROPIC_API_KEY=<new-key>`
