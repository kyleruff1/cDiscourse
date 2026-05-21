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

## annotate-evidence (EV-005)

**Path:** `supabase/functions/annotate-evidence/index.ts`
**Auth:** `verify_jwt = true` — every request must carry a valid Supabase JWT.

### Purpose

The single write path for **evidence annotations** — a small, source/record-descriptive note attached to an EV-001 `EvidenceArtifact` (`primary_source`, `retraction_attached`, `paywalled_source`, …). An annotation describes the source or the record, **never a person, never a truth verdict**. V1 persists the annotation array inside the **existing** `arguments.client_validation` jsonb under a new `evidenceAnnotations` key — **no DB migration**.

A client-only RLS write cannot satisfy EV-005: the normal case is a participant annotating *someone else's* evidence-bearing argument (a non-author write), and the `arguments` UPDATE RLS policy is author-only. The Edge Function does a caller-scoped visibility + eligibility check, then a narrow service-role read-modify-write.

### Request

```json
POST /functions/v1/annotate-evidence
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "debateId": "uuid",
  "argumentId": "uuid",
  "evidenceArtifactId": "<argumentId>:evidence:<n>",
  "kind": "primary_source | retraction_attached | paywalled_source | ... (one of the 18)",
  "note": "string | null   (server trims to 140 chars)",
  "depth": 0,
  "parentAnnotationId": "string | null   (required when depth === 1)"
}
```

### Response: 200

```json
{
  "argumentId": "uuid",
  "evidenceArtifactId": "<argumentId>:evidence:<n>",
  "annotations": [ { "id": "...", "kind": "...", "depth": 0, "...": "..." } ]
}
```

### Error shapes

```
400  invalid_json | invalid_kind | invalid_depth | depthId_required
     | debate_argument_mismatch | argument_deleted | evidence_artifact_not_found
     | depth_cap_exceeded | debateId_and_argumentId_required
     | evidence_artifact_id_required
401  unauthorized
403  argument_not_visible | not_eligible
405  method_not_allowed
500  argument_lookup_failed | persist_failed
```

### Implementation Flow

1. CORS preflight → 200; non-POST → 405.
2. Require the `Authorization` header → else 401.
3. Validate the body — `kind` ∈ the 18, `depth` ∈ {0,1}, `parentAnnotationId` present when `depth === 1`, UUIDs.
4. Build the caller-scoped client; `getUser()` → `callerId` (else 401).
5. Caller-scoped `SELECT` of the target argument (`id, author_id, debate_id, status, client_validation`). Missing/invisible → `403 argument_not_visible` (no existence leak). Debate mismatch → `400`. `status = 'deleted'` → `400`.
6. Derive the caller's `EvidenceAnnotationActorRole` from `debate_participants.side` + `profiles.role` + own-bubble.
7. Enforce `isAnnotationAllowed` (the shared `_shared/evidenceAnnotationEligibility.ts` mirror). Ineligible → `403 not_eligible`.
8. Verify the `evidenceArtifactId` resolves to an artifact on this argument (re-derives the EV-001 ids from the stored `attachedEvidence`). Else `400 evidence_artifact_not_found`.
9. Run `enforceAnnotationDepthCap` on `[...existing, candidate]`. A candidate that would be suppressed → `400 depth_cap_exceeded`.
10. Mint the annotation (deterministic id `<evidenceArtifactId>:annotation:<n>`), append it.
11. **Service-role** read-modify-write — spread-merge the new `evidenceAnnotations` array into the existing `client_validation` jsonb. Writes only an existing column; the `attachedEvidence` / `flags` / `valid` keys are untouched.
12. Best-effort audit row in `admin_audit_events` (`action: 'evidence_annotation_added'`; the payload carries shortened ids + kind only — never the note text, never an email).
13. Return `{ argumentId, evidenceArtifactId, annotations }`.

### Security Guarantees

- **JWT required** — `verify_jwt = true` in `config.toml`.
- **Caller client for the visibility + eligibility reads** — RLS enforced.
- **Service client only for the privileged `client_validation` write + the best-effort audit row** — never logged.
- **No schema change** — the function writes only `arguments.client_validation`, an existing column. No migration.
- **No AI call.** Never logs the `Authorization` header, any key, or the user's note text.

### Concurrency (V1)

The function does a read-modify-write of the whole `client_validation` blob. Two simultaneous annotations on the same argument race; one append can be dropped. The deterministic-index id-mint means a dropped write is safe (a missing annotation the user can re-add, never corruption). The race-free fix is the V2 `evidence_annotations` table.

### Client Usage

```typescript
import { addEvidenceAnnotation } from '@/features/evidence/evidenceAnnotationApi';

const result = await addEvidenceAnnotation({
  debateId,
  argumentId,
  evidenceArtifactId: `${argumentId}:evidence:0`,
  kind: 'retraction_attached',
  note: 'A correction notice was issued.',
  depth: 0,
});

if (!result.ok) {
  // The annotation was not saved — surface inline; posting is unaffected.
}
```

### Deploy step (operator)

```bash
npx supabase functions deploy annotate-evidence --linked
```

No DB migration, no new env var — `annotate-evidence` reuses the same `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` Edge-Function secrets `apply-manual-tag` already relies on.
