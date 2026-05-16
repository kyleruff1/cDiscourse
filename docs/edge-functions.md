# Edge Functions

## submit-argument

**Path:** `supabase/functions/submit-argument/index.ts`  
**Auth:** `verify_jwt = true` — every request must carry a valid Supabase JWT.

### Purpose

Authoritative argument submission. The only route through which a `posted` argument may be created. Clients may not bypass this function to post arguments directly.

### Request

```json
POST /functions/v1/submit-argument
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "debate_id": "uuid",
  "parent_id": "uuid | null",
  "argument_type": "thesis | claim | rebuttal | counter_rebuttal | evidence | clarification_request | concession | synthesis",
  "side": "affirmative | negative | neutral",
  "body": "string",
  "selected_tag_codes": ["string"],
  "attached_evidence": [
    { "url": "string", "label": "string", "source_text": "string" }
  ],
  "target": {
    "target_excerpt": "string",
    "disagreement_axis": "fact | definition | causal | value | evidence | logic | scope",
    "concession_scope": "string",
    "user_stated_uncertainty": true
  },
  "client_validation": {}
}
```

### Response: 201 Created

```json
{
  "argument": { "...inserted row..." },
  "tags": [],
  "topic_satisfaction_check": {},
  "flags": [],
  "validation": {
    "allowPost": true,
    "blockingErrors": [],
    "warnings": [],
    "normalizedTags": [],
    "serverValidationPayload": {}
  }
}
```

### Response: 422 Validation Failed

```json
{
  "error": "validation_failed",
  "blockingErrors": [{ "ruleCode": "...", "flagCode": "...", "severity": "blocking", "message": "..." }],
  "warnings": [],
  "topicSatisfactionCheck": {},
  "normalizedTags": []
}
```

### Response: 401 / 403

```json
{ "error": "unauthorized" }
{ "error": "forbidden", "reason": "string" }
```

### Authorization Logic

| Caller | Allowed sides | Allowed types |
|--------|--------------|---------------|
| Creator / admin / moderator | Any | Any |
| Affirmative participant | affirmative, neutral | Any |
| Negative participant | negative, neutral | Any |
| Observer participant | neutral | clarification_request only |
| Non-participant | — | Blocked |

### Implementation Flow

1. CORS preflight → 200
2. Non-POST → 405
3. JSON parse failure → 422
4. Zod schema validation → 422 on failure
5. Resolve user from JWT
6. Load profile
7. Load debate (must be `open` or `draft`)
8. Load participant record
9. Authorization check (matrix above)
10. Load constitution version by `debate.constitution_id`
11. Load constitution_rules, tag_definitions, flag_definitions
12. Load parent argument (if `parent_id` provided) — verify same debate, verify `posted`
13. Load siblings for duplicate detection
14. Map DB rows through `dbAdapters`
15. Run `evaluateArgumentDraft` with `evaluationContext: 'server'`
16. Run `runRailsChecks` for rail payload
17. If `blockingErrors.length > 0` → 422, no DB write
18. Insert `arguments` with `status = 'posted'` via service client
19. Insert `argument_tags` for normalized tags
20. Insert `topic_satisfaction_checks`
21. Insert `argument_flags` for `server_rules` flags only
22. Return 201

### Security Guarantees

- **JWT required** — `verify_jwt = true` in `config.toml`
- **Caller client for reads** — RLS enforced for debate/parent visibility checks
- **Service client for writes** — only after validation passes; inserts arguments as `posted`
- **No client-side flags trusted** — `argument_flags.source = 'server_rules'` for all inserted flags
- **No model-provider calls** — no AI, no Anthropic API

### Shared Helpers

| File | Purpose |
|------|---------|
| `_shared/http.ts` | CORS headers, response factories |
| `_shared/supabaseClients.ts` | Caller-scoped + service-role client factories |
| `_shared/validationSchemas.ts` | Zod schemas for request validation |
| `_shared/constitution/` | Deno-compatible mirrors of the TypeScript engine |

### Mirrored Constitution Files

The constitution engine lives in `src/domain/constitution/`. Deno requires explicit `.ts` extensions in imports, so the following files are mirrored under `supabase/functions/_shared/constitution/`:

| Mirror file | Source file |
|-------------|-------------|
| `types.ts` | `src/domain/constitution/types.ts` |
| `allowedTransitions.ts` | `src/domain/constitution/allowedTransitions.ts` |
| `topicSatisfaction.ts` | `src/domain/constitution/topicSatisfaction.ts` |
| `railsChecks.ts` | `src/domain/constitution/railsChecks.ts` |
| `dbAdapters.ts` | `src/domain/constitution/dbAdapters.ts` |
| `evaluateArgumentDraft.ts` | `src/domain/constitution/evaluateArgumentDraft.ts` |

**When updating the engine, update both the source and the mirror.** The mirror files are identified by a `// MIRROR of ...` comment at the top.

### Local Testing

Requires Docker Desktop and Supabase CLI:

```bash
# Start local Supabase
npx supabase start

# Serve function locally
npx supabase functions serve submit-argument

# Test with curl (replace <jwt> with a valid token from local auth)
curl -X POST http://localhost:54321/functions/v1/submit-argument \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"debate_id": "...", "argument_type": "thesis", "side": "affirmative", "body": "...", "selected_tag_codes": []}'
```

### Client Usage

```typescript
import { submitArgumentDraft } from '@/lib/edgeFunctions';

const result = await submitArgumentDraft({
  debate_id: debateId,
  argument_type: 'rebuttal',
  side: 'affirmative',
  body: 'The evidence does not support the claim about...',
  selected_tag_codes: ['fact_disagreement'],
  target: {
    target_excerpt: 'reduces poverty rates',
    disagreement_axis: 'fact',
  },
});

if (result.ok) {
  console.log('Posted:', result.data.argument.id);
} else {
  console.error('Blocked:', result.error.blockingErrors);
}
```
