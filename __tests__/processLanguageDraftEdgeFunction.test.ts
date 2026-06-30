/**
 * COV-002 — process-language-draft Edge Function contract scan.
 *
 * This test exists because the 2026-06-30 coverage audit
 * (`docs/audits/COVERAGE-AUDIT-2026-06-30.md`, gap #2, HIGH/S) flagged
 * `supabase/functions/process-language-draft/index.ts` as deployed-live
 * with ZERO test files. The function calls Anthropic, validates debate
 * access, and returns advisory draft suggestions, but no test verified
 * its JWT/RLS posture, its `enabled:false` fallback when
 * `ANTHROPIC_API_KEY` is absent, its provider error containment, or its
 * doctrine boundary (the AI moderator must not assign truth values to
 * claims — see `cdiscourse-doctrine` §4).
 *
 * The Edge Function uses Deno-style imports (`Deno.serve`,
 * `Deno.env.get`, `npm:zod@4` via shared modules) and cannot be loaded
 * by Jest, so we follow the established project pattern
 * (`applyManualTagEdgeFunction.test.ts`,
 * `submitArgumentSoftRollback.contract.test.ts` — COV-001 reference) of
 * asserting the function's contract by source-file inspection.
 *
 * Invariants checked
 *   1. `verify_jwt = true` is set for `[functions.process-language-draft]`
 *      in `supabase/config.toml` (no function-local override exists).
 *   2. The handler rejects non-POST verbs via `methodNotAllowed()` and
 *      handles the CORS preflight.
 *   3. The handler requires a present `Authorization` header AND a
 *      successful `auth.getUser()` resolution; either failure returns
 *      `unauthorized()`.
 *   4. The handler validates input via a Zod `safeParse` and returns
 *      `validationFailed({ error: 'validation_failed', issues })`.
 *   5. When `debateId` is present, the handler performs an RLS-safe
 *      SELECT against `debates` using the CALLER client (NOT a
 *      service-role client) before any provider call. A missing /
 *      inaccessible row returns
 *      `validationFailed({ error: 'debate_not_found_or_not_accessible' })`.
 *   6. The handler delegates processing to
 *      `processWithConfiguredProvider`, which in turn:
 *        a. Returns `{ enabled: false, reason: 'disabled' }` when
 *           `AI_LANGUAGE_PROCESSING_ENABLED` is not exactly `'true'`.
 *        b. Returns `{ enabled: false, reason: 'key_missing' }` when
 *           the Anthropic provider is selected and `ANTHROPIC_API_KEY`
 *           is absent. This is the "disabled posture when env absent"
 *           the audit calls out.
 *   7. Provider errors are caught and surfaced via `internalError(...)`
 *      — never as a raw provider response or stack trace.
 *   8. The handler never writes to `public.arguments` and never calls
 *      `submit-argument`. The AI moderator is advisory-only per
 *      doctrine §4.
 *   9. Doctrine boundary — the system prompt forbids the AI from
 *      assigning truth values, recommending bans, or modifying user
 *      content. The forbidden-label list is asserted present.
 *  10. Forbidden-token scan — no `console.*` call inside the function
 *      or the Anthropic provider logs the `Authorization` header,
 *      `x-api-key`, `ANTHROPIC_API_KEY`, the raw API key value, or the
 *      raw request body. The Anthropic provider sanitizes the raw
 *      provider payload before any response interpolation.
 *  11. Result-envelope shape — the success response is always wrapped
 *      in `ok(outcome)`; both enabled-true and enabled-false paths flow
 *      through the same `ok(...)` envelope (the doctrine that disabled
 *      is a 200 with `enabled:false`, not a 4xx).
 *  12. No client-only AI providers — the function does not import the
 *      xAI / OpenAI clients directly; provider selection is gated
 *      through the shared `processWithConfiguredProvider` registry.
 *
 * If a regression breaks any of these invariants, this test surfaces
 * the exact contract that was lost.
 *
 * References
 *   - Audit: docs/audits/COVERAGE-AUDIT-2026-06-30.md (Gap #2)
 *   - Tracking issue: COV-002 / #806
 *   - Edge source: supabase/functions/process-language-draft/index.ts
 *   - Anthropic provider: supabase/functions/_shared/languageProcessing/anthropicProvider.ts
 *   - Provider registry: supabase/functions/_shared/languageProcessing/providers.ts
 *
 * Pure TS. No React. No Deno runtime. Loaded by jest like every other
 * `__tests__/*EdgeFunction*.test.ts`.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const fnPath = path.join(
  repoRoot,
  'supabase/functions/process-language-draft/index.ts',
);
const providerPath = path.join(
  repoRoot,
  'supabase/functions/_shared/languageProcessing/providers.ts',
);
const anthropicPath = path.join(
  repoRoot,
  'supabase/functions/_shared/languageProcessing/anthropicProvider.ts',
);
const configPath = path.join(repoRoot, 'supabase/config.toml');

const fnSrc = fs.readFileSync(fnPath, 'utf8');
const providerSrc = fs.readFileSync(providerPath, 'utf8');
const anthropicSrc = fs.readFileSync(anthropicPath, 'utf8');
const configSrc = fs.readFileSync(configPath, 'utf8');

// ── 1. verify_jwt posture ─────────────────────────────────────

describe('COV-002 — process-language-draft verify_jwt posture', () => {
  it('is registered in supabase/config.toml with verify_jwt = true', () => {
    // Match the EXACT block. A regression that flips verify_jwt to
    // false, removes the block entirely, or splits the block across
    // lines must fail this test.
    const blockRe =
      /\[functions\.process-language-draft\][^\[]*verify_jwt\s*=\s*true/m;
    expect(configSrc).toMatch(blockRe);
  });

  it('does NOT have a function-local config.toml that could override the root posture', () => {
    // Supabase's bulk deploy keys off the ROOT [functions.*] blocks; a
    // function-local file can silently change verify_jwt without
    // touching the root. Today there is no function-local config; if
    // a future PR adds one, this assertion forces a deliberate review.
    const localConfig = path.join(
      repoRoot,
      'supabase/functions/process-language-draft/config.toml',
    );
    expect(fs.existsSync(localConfig)).toBe(false);
  });
});

// ── 2. Method + CORS posture ──────────────────────────────────

describe('COV-002 — process-language-draft method / CORS posture', () => {
  it('handles the CORS preflight', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
    expect(fnSrc).toMatch(/corsHeaders/);
  });

  it('rejects non-POST verbs via methodNotAllowed()', () => {
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/methodNotAllowed\(\)/);
  });
});

// ── 3. Auth posture ───────────────────────────────────────────

describe('COV-002 — process-language-draft auth posture', () => {
  it('rejects a missing Authorization header with unauthorized()', () => {
    expect(fnSrc).toMatch(/req\.headers\.get\(['"]Authorization['"]\)/);
    expect(fnSrc).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('rejects an invalid JWT (userError or null user) with unauthorized()', () => {
    // Both the Supabase error case AND the no-user case must be
    // covered — a Supabase response shape where `error` is null but
    // `user` is null must still be refused.
    expect(fnSrc).toMatch(/auth\.getUser\(\)/);
    expect(fnSrc).toMatch(/if \(userError \|\| !user\) return unauthorized\(\)/);
  });

  it('uses the caller-scoped client (createCallerClient) — never service-role for the auth check', () => {
    expect(fnSrc).toMatch(/createCallerClient\(authHeader\)/);
    expect(fnSrc).not.toMatch(/createServiceClient\(\)/);
  });
});

// ── 4. Input validation posture ───────────────────────────────

describe('COV-002 — process-language-draft input validation posture', () => {
  it('parses the request body as JSON and returns badRequest on malformed JSON', () => {
    expect(fnSrc).toMatch(/await req\.json\(\)/);
    expect(fnSrc).toMatch(/badRequest\(['"]Invalid JSON body\.['"]\)/);
  });

  it('validates input via LanguageProcessingInputSchema.safeParse', () => {
    expect(fnSrc).toMatch(/LanguageProcessingInputSchema\.safeParse\(/);
  });

  it('returns validationFailed with a structured issues array on schema failure', () => {
    // The envelope shape is { error: 'validation_failed', issues } —
    // a regression that returned the raw zod error (which can include
    // user-supplied path values) must fail this test.
    expect(fnSrc).toMatch(/validationFailed\(\{\s*error:\s*['"]validation_failed['"]\s*,\s*issues\s*\}\)/);
    expect(fnSrc).toMatch(/parsed\.error\.issues\.map\(/);
  });
});

// ── 5. RLS-safe debate access check (BEFORE provider call) ────

describe('COV-002 — process-language-draft RLS / debate access posture', () => {
  it('performs a debate SELECT via the CALLER client (RLS-checked) before any provider call', () => {
    // The doctrinal invariant: a draft-processing call can NEVER reach
    // Anthropic for a debate the caller cannot see. A regression that
    // dropped this check, or swapped to a service-role client, would
    // leak the existence of arbitrary debate IDs via topic explanations.
    expect(fnSrc).toMatch(
      /callerClient\s*\n?\s*\.from\(['"]debates['"]\)\s*\n?\s*\.select\(/,
    );
    // The check sits BEFORE the call to processWithConfiguredProvider.
    const debateSelectIdx = fnSrc.search(/callerClient[\s\n.]*\.from\(['"]debates['"]\)/);
    const providerCallIdx = fnSrc.search(/processWithConfiguredProvider\(input\)/);
    expect(debateSelectIdx).toBeGreaterThan(0);
    expect(providerCallIdx).toBeGreaterThan(debateSelectIdx);
  });

  it('returns validationFailed({ error: "debate_not_found_or_not_accessible" }) on RLS denial or missing row', () => {
    // Single envelope for both "debate truly does not exist" and "RLS
    // refused to surface it" — this is the existence-leak-safe shape.
    expect(fnSrc).toMatch(
      /validationFailed\(\{\s*error:\s*['"]debate_not_found_or_not_accessible['"]\s*\}\)/,
    );
  });

  it('uses .maybeSingle() so an empty result is data:null + error:null (not an unhandled throw)', () => {
    expect(fnSrc).toMatch(/\.maybeSingle\(\)/);
  });
});

// ── 6. enabled:false fallback when env absent ─────────────────

describe('COV-002 — process-language-draft enabled:false posture', () => {
  it('the registry refuses to call ANY provider unless AI_LANGUAGE_PROCESSING_ENABLED is exactly "true"', () => {
    // Two distinct failure modes:
    //   - flag unset (undefined)
    //   - flag set to a non-"true" string ("false", "yes", "1", "TRUE")
    // Both must fall through to { enabled: false }.
    expect(providerSrc).toMatch(
      /Deno\.env\.get\(['"]AI_LANGUAGE_PROCESSING_ENABLED['"]\)/,
    );
    expect(providerSrc).toMatch(
      /if \(enabled !== ['"]true['"]\) \{[\s\S]*?return \{ enabled: false, reason: ['"]disabled['"] \};/,
    );
  });

  it('the Anthropic provider returns key_missing when ANTHROPIC_API_KEY is absent — no fetch is attempted', () => {
    // The key check happens BEFORE the fetch call. A regression that
    // moved the fetch above the key check would attempt a no-auth
    // call to api.anthropic.com (immediate 401, but still a leak of
    // intent + a billable round-trip on some plans).
    const keyCheckIdx = anthropicSrc.search(/Deno\.env\.get\(['"]ANTHROPIC_API_KEY['"]\)/);
    const fetchIdx = anthropicSrc.search(/fetch\(['"]https:\/\/api\.anthropic\.com/);
    expect(keyCheckIdx).toBeGreaterThan(0);
    expect(fetchIdx).toBeGreaterThan(keyCheckIdx);
    expect(anthropicSrc).toMatch(
      /if \(!apiKey\) \{[\s\S]*?return \{ type: ['"]unavailable['"], reason: ['"]key_missing['"] \};/,
    );
  });

  it('the registry maps Anthropic key_missing to { enabled: false, reason: "key_missing" }', () => {
    // This is the audit's "enabled:false posture when ANTHROPIC_API_KEY
    // is absent" — the caller gets a clean 200 + disabled envelope
    // (NOT a 500). The client-side composer treats enabled:false as
    // "render no suggestions" without alarming the user.
    expect(providerSrc).toMatch(
      /if \(result\.reason === ['"]key_missing['"]\) \{[\s\S]*?return \{ enabled: false, reason: ['"]key_missing['"] \};/,
    );
  });

  it('the function returns the disabled envelope through the SAME ok(...) path as success', () => {
    // Doctrine: disabled is a 200, not a 4xx. The client checks
    // outcome.enabled before rendering. There is exactly ONE happy-path
    // return at the end of the handler, and it is `return ok(outcome);`.
    const okReturnRe = /return\s+ok\(outcome\)\s*;/;
    expect(fnSrc).toMatch(okReturnRe);
    const okCount = (fnSrc.match(/return\s+ok\(outcome\)/g) || []).length;
    expect(okCount).toBe(1);
  });
});

// ── 7. Provider error containment ─────────────────────────────

describe('COV-002 — process-language-draft provider error containment', () => {
  it('wraps the provider call in try / catch and returns internalError(...) on throw', () => {
    // Without this wrapper, a Deno-level network throw (DNS failure,
    // socket reset) would bubble up as an unhandled rejection — which
    // Deno surfaces as a 500 with a stack trace in the body. The
    // explicit internalError envelope keeps the response shape stable.
    expect(fnSrc).toMatch(
      /try \{\s*\n\s*outcome = await processWithConfiguredProvider\(input\);\s*\n\s*\} catch \(err\) \{/,
    );
    expect(fnSrc).toMatch(/return internalError\(/);
  });

  it('the Anthropic provider never returns the raw fetch response or stack to the caller', () => {
    // Only the sanitized payload subset (model, stop_reason, usage) is
    // surfaced via rawPayloadSanitized. The fallback path includes the
    // sanitized subset; the unavailable error path includes only a
    // short `detail` string ("HTTP 429" / "key_missing" / etc).
    expect(anthropicSrc).toMatch(/function sanitizeRawPayload\(/);
    expect(anthropicSrc).toMatch(
      /return \{ model: r\[['"]model['"]\], stop_reason: r\[['"]stop_reason['"]\], usage: r\[['"]usage['"]\] \};/,
    );
    // The raw response is never returned as-is.
    expect(anthropicSrc).not.toMatch(/return responseJson\s*[;,)]/);
    expect(anthropicSrc).not.toMatch(/return rawResponse\s*[;,)]/);
  });

  it('on HTTP non-2xx, the Anthropic provider returns a short detail ("HTTP N"), not the response body', () => {
    expect(anthropicSrc).toMatch(
      /if \(!rawResponse\.ok\) \{\s*\n\s*return \{ type: ['"]unavailable['"], reason: ['"]api_error['"], detail: `HTTP \$\{rawResponse\.status\}` \};/,
    );
  });
});

// ── 8. No advisory-violation writes ───────────────────────────

describe('COV-002 — process-language-draft is advisory-only (no writes, no submit)', () => {
  it('never writes to public.arguments from inside this Edge Function', () => {
    expect(fnSrc).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]*?\.insert\(/);
    expect(fnSrc).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]*?\.update\(/);
    expect(fnSrc).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]*?\.upsert\(/);
    expect(fnSrc).not.toMatch(/\.from\(['"]arguments['"]\)[\s\S]*?\.delete\(/);
  });

  it('never cross-invokes submit-argument', () => {
    // The doc-comment header explicitly states "Does not call
    // submit-argument" — we permit the LITERAL string inside the
    // top-of-file comment block, but refuse any invocation pattern:
    // a `functions.invoke(...)` call OR a `fetch(...submit-argument...)`
    // would cross the advisory boundary.
    expect(fnSrc).not.toMatch(/functions\.invoke\(/);
    expect(fnSrc).not.toMatch(/fetch\([^)]*submit-argument/);
    // Also: no import path that resolves to the submit-argument
    // function's source files.
    expect(fnSrc).not.toMatch(/from\s+['"][^'"]*submit-argument[^'"]*['"]/);
  });

  it('does not import a service-role client (advisory-only path has no need for RLS bypass)', () => {
    expect(fnSrc).not.toMatch(/createServiceClient/);
    expect(fnSrc).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

// ── 9. Doctrine boundary in the Anthropic system prompt ───────

describe('COV-002 — process-language-draft doctrine boundary (AI cannot assign truth)', () => {
  it('the system prompt forbids deciding right/wrong, winner, banning, or content removal', () => {
    // Mirrors cdiscourse-doctrine §4: AI moderator must NOT decide who
    // is right or wrong, must NOT assign truth values, must NOT
    // recommend banning users, must NOT modify content. The prompt
    // string itself encodes these constraints.
    expect(anthropicSrc).toMatch(/You do NOT decide who is right or wrong/);
    expect(anthropicSrc).toMatch(/You do NOT decide the winner of any debate/);
    expect(anthropicSrc).toMatch(/You do NOT infer user intent as fact/);
    expect(anthropicSrc).toMatch(/You do NOT recommend banning users/);
    expect(anthropicSrc).toMatch(
      /You do NOT recommend hiding, deleting, or modifying user content/,
    );
    expect(anthropicSrc).toMatch(/You do NOT submit content on behalf of users/);
    expect(anthropicSrc).toMatch(
      /You do NOT override deterministic Constitution rules/,
    );
  });

  it('the system prompt enumerates the closed forbidden-label set', () => {
    // The forbidden-labels block names the exact verdict-shaped
    // categories the AI must never emit. A regression that drops or
    // weakens this list must fail this test.
    const forbiddenLabels = [
      'user_is_manipulating',
      'argument_is_true',
      'argument_is_false',
      'user_should_be_banned',
      'content_should_be_hidden',
      'debate_winner',
      'bad_faith_detected',
    ];
    for (const label of forbiddenLabels) {
      expect(anthropicSrc).toContain(label);
    }
  });

  it('the result schema enforces userReviewRequired: true (a literal, not a boolean)', () => {
    // userReviewRequired is the doctrinal pin that all suggestions are
    // advisory. The schema MUST reject any payload where this is false.
    // A z.boolean() field would silently accept false; a z.literal(true)
    // does not.
    const schemaSrc = fs.readFileSync(
      path.join(
        repoRoot,
        'supabase/functions/_shared/languageProcessing/schema.ts',
      ),
      'utf8',
    );
    expect(schemaSrc).toMatch(/userReviewRequired:\s*z\.literal\(true\)/);
  });
});

// ── 10. Forbidden-token / secret-leak scan ────────────────────

describe('COV-002 — process-language-draft secret-leak guards', () => {
  it('the Edge Function makes NO console.* call at all (no log surface = no leak surface)', () => {
    // The handler is intentionally silent — every observable behavior
    // is a return Response. A regression that added a debug
    // console.log around the auth or body parse path would be caught
    // here. (apply-manual-tag's test is narrower; this function has
    // no logs at all, so we lock that in.)
    expect(fnSrc).not.toMatch(/console\.\w+\(/);
  });

  it('the Anthropic provider never logs the Authorization header, x-api-key, or the key value', () => {
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*Authorization/i);
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*x-api-key/i);
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*apiKey/);
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*ANTHROPIC_API_KEY/);
  });

  it('the Anthropic provider never logs the raw request body or rawText', () => {
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*requestBody/);
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*rawText/);
    expect(anthropicSrc).not.toMatch(/console\.\w+\([^)]*responseJson/);
  });

  it('the registry never logs env values', () => {
    expect(providerSrc).not.toMatch(/console\.\w+\([^)]*ANTHROPIC_API_KEY/);
    expect(providerSrc).not.toMatch(/console\.\w+\([^)]*AI_LANGUAGE_PROCESSING/);
  });

  it('no plaintext API key ever appears in any of the three sources', () => {
    // Defense-in-depth — a future engineer pasting a key for a quick
    // test should be caught. The Anthropic key format is
    // `sk-ant-*` (or older `sk-ant-api03-*`). We refuse any literal.
    const allSrc = [fnSrc, providerSrc, anthropicSrc].join('\n');
    expect(allSrc).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
    expect(allSrc).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{30,}/);
  });
});

// ── 11. Provider registry surface (no xAI / OpenAI direct calls) ─

describe('COV-002 — process-language-draft provider gating', () => {
  it('the registry recognizes exactly three provider names: anthropic, mock, openai', () => {
    // openai is reserved-not-implemented; any other provider falls
    // through to { enabled: false, reason: 'not_configured' }. A
    // regression that wired up xAI or a brand-new provider without
    // updating this test must update the assertion deliberately.
    expect(providerSrc).toMatch(/providerName === ['"]mock['"]/);
    expect(providerSrc).toMatch(/providerName === ['"]anthropic['"]/);
    expect(providerSrc).toMatch(/providerName === ['"]openai['"]/);
    expect(providerSrc).toMatch(
      /return \{ enabled: false, reason: ['"]not_configured['"] \};/,
    );
  });

  it('the Edge Function does NOT import or reference xAI / OpenAI directly', () => {
    // Production app + Edge Functions never call xAI from the
    // language-processing path. The only AI call is Anthropic, routed
    // through the registry. (cdiscourse-doctrine §7.)
    expect(fnSrc).not.toMatch(/api\.x\.ai/i);
    expect(fnSrc).not.toMatch(/openai\.com/i);
    expect(fnSrc).not.toMatch(/XAI_API_KEY/);
  });

  it('the registry delegates to the named provider — no direct fetch from the registry itself', () => {
    // The registry's job is provider selection; if it called fetch()
    // directly, the Anthropic key check / sanitizer / error mapping
    // would be bypassed.
    expect(providerSrc).not.toMatch(/\bfetch\s*\(/);
  });
});

// ── 12. Result envelope shape ─────────────────────────────────

describe('COV-002 — process-language-draft result envelope shape', () => {
  it('there is exactly ONE happy-path return at the end of the handler', () => {
    // The handler's final statement is `return ok(outcome);`. Every
    // other return inside the handler is an error / validation /
    // refusal path. A regression that introduced a second
    // success-shape return must trip this.
    const okReturns = fnSrc.match(/return\s+ok\(/g) || [];
    expect(okReturns).toHaveLength(1);
  });

  it('the function never returns a 200 with a raw provider response', () => {
    // Every ok(...) must wrap the validated outcome — never the raw
    // Anthropic response, never the fetch Response object.
    expect(fnSrc).not.toMatch(/return ok\(rawResponse/);
    expect(fnSrc).not.toMatch(/return ok\(responseJson/);
    expect(fnSrc).not.toMatch(/return ok\(parsed\)/);
  });

  it('returns the disabled envelope WITHOUT calling the provider when env flag is off', () => {
    // Verified by the registry's early-exit: the disabled check sits
    // BEFORE the provider switch. A regression that hit the Anthropic
    // branch first would mean we paid for the round-trip every time
    // a user composed a draft.
    const earlyExitIdx = providerSrc.search(/if \(enabled !== ['"]true['"]\)/);
    const anthropicBranchIdx = providerSrc.search(
      /providerName === ['"]anthropic['"]/,
    );
    expect(earlyExitIdx).toBeGreaterThan(0);
    expect(anthropicBranchIdx).toBeGreaterThan(earlyExitIdx);
  });
});
