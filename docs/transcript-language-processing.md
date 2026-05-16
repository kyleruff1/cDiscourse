# CDiscourse — Transcript Language Processing

_Last updated: 2026-05-16_

## What This Is

The language-processing scaffold is a **server-side, disabled-by-default** feature that helps users turn rough spoken or typed draft text into structured debate arguments.

This is NOT:
- An AI judge
- An AI moderator
- A content removal system
- An audio transcription system
- A speech-to-text implementation

This IS:
- A **draft-language assistant** that processes existing text
- An **advisory suggestion layer** that the user must review
- A **server-only** feature that never runs on the client

---

## What It Does

Given a raw text (typed draft or transcript from a future STT stage), the language-processing function:

1. **Cleans the text** — removes filler words, normalizes whitespace
2. **Segments it** — classifies sentences as claim, evidence, question, rebuttal, concession, filler, or unclear
3. **Suggests an argument type** — based on detected segment patterns
4. **Notes topic relation** — does the text respond to the debate resolution? to the parent argument?
5. **Notes possible flags** — civility risk, off-topic, scope challenge, etc. (advisory only)
6. **Notes transcript issues** — filler words, incomplete sentences, multiple arguments detected
7. **Returns structured suggestions** — the user reviews everything before submitting

All suggestions are advisory. `userReviewRequired` is always `true` in the response.

---

## What It Does Not Do

- Does not transcribe audio (speech-to-text is a separate, later stage)
- Does not call Anthropic from the Expo client
- Does not auto-submit arguments
- Does not auto-post anything
- Does not decide truth or correctness
- Does not decide debate winners
- Does not recommend banning users
- Does not hide or delete content
- Does not override deterministic Constitution rules
- Does not replace lexical topic checks
- Does not run on every keystroke

---

## Architecture

```
[User taps "Process draft" button]
        ↓
[Client: supabase.functions.invoke('process-language-draft')]
        ↓
[Edge Function: process-language-draft/index.ts]
  ├─ Validates JWT (verify_jwt = true)
  ├─ Validates input (LanguageProcessingInputSchema)
  ├─ Checks debate access (callerClient RLS)
  └─ Calls processWithConfiguredProvider(input)
        ↓
[Provider registry: providers.ts]
  ├─ Checks AI_LANGUAGE_PROCESSING_ENABLED
  ├─ Routes to anthropic/mock/openai
  └─ Returns LanguageProcessingOutcome
        ↓
[Client receives { enabled: false } or { enabled: true, ...result }]
        ↓
[User reviews suggestions in UI — nothing submitted yet]
```

---

## File Map

### Edge Function (Deno-only)

| File | Purpose |
|---|---|
| `supabase/functions/process-language-draft/index.ts` | Edge Function entry point |
| `supabase/functions/_shared/languageProcessing/types.ts` | Shared provider-neutral types |
| `supabase/functions/_shared/languageProcessing/schema.ts` | Zod validation (npm:zod@4) |
| `supabase/functions/_shared/languageProcessing/mockProvider.ts` | Deterministic mock |
| `supabase/functions/_shared/languageProcessing/anthropicProvider.ts` | Anthropic API integration |
| `supabase/functions/_shared/languageProcessing/providers.ts` | Provider registry (Deno.env) |

### Node.js mirrors (client + tests)

| File | Purpose |
|---|---|
| `src/features/languageProcessing/types.ts` | Same types, no .ts extensions |
| `src/features/languageProcessing/schema.ts` | Same schema, regular zod import |
| `src/features/languageProcessing/mockProvider.ts` | Same mock, no .ts extensions |
| `src/features/languageProcessing/buildAnthropicRequest.ts` | Request builder (testable, no Deno) |
| `src/features/languageProcessing/providers.ts` | Injectable-env registry for tests |
| `src/lib/edgeFunctions.ts` | `processLanguageDraft()` client wrapper |

---

## Configuration

### To enable (server-only, Supabase secrets)

```bash
npx supabase secrets set \
  AI_LANGUAGE_PROCESSING_ENABLED=true \
  AI_LANGUAGE_PROCESSING_PROVIDER=anthropic \
  AI_LANGUAGE_PROCESSING_MODEL=claude-haiku-4-5-20251001 \
  ANTHROPIC_API_KEY=<your-key>
```

### To disable (revert to default)

```bash
npx supabase secrets set AI_LANGUAGE_PROCESSING_ENABLED=false
```

### To use mock provider (no Anthropic calls)

```bash
npx supabase secrets set \
  AI_LANGUAGE_PROCESSING_ENABLED=true \
  AI_LANGUAGE_PROCESSING_PROVIDER=mock
```

---

## Provider Behavior When Disabled

When `AI_LANGUAGE_PROCESSING_ENABLED` is not `true`, the Edge Function returns:

```json
{ "enabled": false, "reason": "disabled" }
```

The client (`processLanguageDraft`) returns `{ ok: true, data: { enabled: false, reason: 'disabled' } }`. No Anthropic call is made. No error is thrown.

---

## Security

- `ANTHROPIC_API_KEY` is read only via `Deno.env.get()` inside the Edge Function
- The key is never returned to the caller
- The key is never logged
- The key is never in `.env`, `app/`, `src/`, or any committed file
- `rawPayloadSanitized` strips headers and keys from the raw Anthropic response before any storage
- The client uses `supabase.functions.invoke()` — Supabase handles the JWT, not the app

---

## Next Steps

- **Stage 6.1 (future):** Wire a "Process draft" button into `ArgumentComposer` that calls `processLanguageDraft` and displays suggestions in a review panel
- **Stage 6.2 (future):** Speech-to-text integration (raw audio → text → `process-language-draft`)
- **Stage 6.3 (future):** OpenAI provider implementation

---

## What Was Not Implemented

Per the Stage 6.0 scope:

- ❌ No speech-to-text or audio recording
- ❌ No automatic call from `ArgumentComposer` or `submit-argument`
- ❌ No realtime processing
- ❌ No moderation queue
- ❌ No UI changes
- ❌ No `argument_flags` auto-insert from AI (that is a later stage with explicit scope)
- ❌ No `topic_satisfaction_checks` insert from language processing
