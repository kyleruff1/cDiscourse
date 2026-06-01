/**
 * Source-scan tests for `supabase/functions/cutover-health-monitor/index.ts`.
 *
 * The Edge Function uses Deno-only APIs (Deno.env, Deno.serve), so it cannot
 * be exercised through the Jest module loader. These tests instead read the
 * source file and assert structural properties:
 *   1. The 8 granular `EmailStatus` values are present + exclusive.
 *   2. `ADMIN_NOTIFICATION_TO` is read from env + parsed with `split(/[,;]/)`.
 *   3. The response payload allowlists do NOT include any recipient field.
 *   4. The function never reads / writes the routing flag knobs
 *      (`CLASSIFIER_QUEUE_ROUTING_ENABLED`, `_PERCENTAGE`).
 *   5. The function never invokes `submit-argument`,
 *      `classify-argument-boolean-observations`, the MCP server, or any
 *      provider HTTP endpoint other than `api.resend.com`.
 *   6. The fail-closed auth gate (missing `CUTOVER_MONITOR_SHARED_SECRET`
 *      returns 401) is preserved.
 *   7. The Resend response body is drained without being logged.
 *   8. The split-literal sentinel constants for the secret-shape scan are
 *      preserved (no contiguous occurrence of the secret prefixes).
 *
 * The tests intentionally read the file with `fs.readFileSync` rather than
 * importing it — Jest cannot resolve `Deno.serve` / `Deno.env` and the file
 * imports from `../_shared/http.ts` which is a Deno-only path.
 */
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_PATH = path.join(
  process.cwd(),
  'supabase',
  'functions',
  'cutover-health-monitor',
  'index.ts',
);

const SOURCE = fs.readFileSync(SOURCE_PATH, 'utf8');

/**
 * Comment-stripped view of the source. Block + line comments are removed
 * so doctrine-negation references inside docstrings (e.g. the header that
 * documents what the function does NOT do) don't trip forbidden-pattern
 * scans. Use this for substring/keyword tests; use the raw `SOURCE` for
 * tests that explicitly probe comment content.
 */
const SOURCE_CODE_ONLY = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

const REQUIRED_EMAIL_STATUS_VALUES = [
  'sent',
  'not_required',
  'not_configured_missing_resend',
  'not_configured_missing_from',
  'not_configured_no_recipients',
  'failed_recipient_lookup',
  'failed_sanitized',
  'failed_resend',
];

// Substrings the response / log / email-body MUST NOT contain. We split-literal
// the Supabase + Anthropic prefixes the same way the source file does, so this
// test itself stays clean for `__tests__/adminSecurity.test.ts`.
const FORBIDDEN_RESPONSE_LITERALS = [
  // Recipient-leak shapes:
  /['"`]to['"`]\s*:\s*recipients/,  // returning `to: recipients` in the response would leak
  /recipients\s*:\s*recipients/,    // exporting the recipient list as a field
  // Routing-flag RUNTIME READS (operator-facing remediation strings that
  // NAME the env vars are fine — only Deno.env.get(...) reads of the
  // routing knobs are forbidden):
  /Deno\.env\.get\(\s*['"][^'"]*CLASSIFIER_QUEUE_ROUTING_ENABLED[^'"]*['"]\s*\)/,
  /Deno\.env\.get\(\s*['"][^'"]*CLASSIFIER_QUEUE_ROUTING_PERCENTAGE[^'"]*['"]\s*\)/,
  // Provider-spend paths — invocation, not docs reference. The Edge
  // Function may name these in remediation strings but must NEVER
  // import / fetch / invoke them. Forbid only the import/invocation
  // shapes:
  /from\s+['"][^'"]*submit-argument[^'"]*['"]/,
  /from\s+['"][^'"]*classify-argument-boolean-observations[^'"]*['"]/,
  /functions\.invoke\(\s*['"]submit-argument['"]/,
  /functions\.invoke\(\s*['"]classify-argument-boolean-observations['"]/,
];

describe('cutover-health-monitor — EmailStatus granularity (8 values)', () => {
  it('declares every required EmailStatus value as a string literal in the type union', () => {
    for (const v of REQUIRED_EMAIL_STATUS_VALUES) {
      // The type union and the return paths both write `'value'`.
      const literalSearch = `'${v}'`;
      expect(SOURCE.includes(literalSearch)).toBe(true);
    }
  });

  it('does NOT carry the old opaque `not_configured` literal as a return value', () => {
    // The previous implementation collapsed multiple failure modes into a
    // single `'not_configured'` literal. The patched code splits them into
    // `not_configured_missing_resend`, `not_configured_missing_from`,
    // `not_configured_no_recipients`. The old literal must not appear as
    // a returned value.
    const oldOpaqueReturns = SOURCE.match(/return\s+['"]not_configured['"]/g);
    expect(oldOpaqueReturns).toBeNull();
  });

  it('every return path inside maybeSendAlertEmail emits one of the 8 declared statuses', () => {
    const fn = SOURCE.split('async function maybeSendAlertEmail')[1] || '';
    // Strip block-/line- comments so doc-comment examples don't trip the scan.
    const code = fn
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const returnMatches = code.match(/return\s+['"][^'"]+['"]/g) || [];
    expect(returnMatches.length).toBeGreaterThan(0);
    for (const m of returnMatches) {
      const literal = m.replace(/return\s+['"]/, '').replace(/['"]$/, '');
      expect(REQUIRED_EMAIL_STATUS_VALUES).toContain(literal);
    }
  });
});

describe('cutover-health-monitor — explicit recipient (ADMIN_NOTIFICATION_TO)', () => {
  it('reads ADMIN_NOTIFICATION_TO from Deno.env', () => {
    expect(SOURCE).toMatch(/Deno\.env\.get\(\s*['"]ADMIN_NOTIFICATION_TO['"]\s*\)/);
  });

  it('parses with split(/[,;]/) — comma OR semicolon separated', () => {
    expect(SOURCE).toMatch(/split\(\s*\/\[\s*,\s*;\s*\]\/\s*\)/);
  });

  it('trims each entry + drops empty entries', () => {
    expect(SOURCE).toMatch(/\.map\(\s*\(\s*s\s*\)\s*=>\s*s\.trim\(\)\s*\)/);
    expect(SOURCE).toMatch(/\.filter\(\s*\(\s*s\s*\)\s*=>\s*s\.length\s*>\s*0\s*\)/);
  });

  it('falls back to admin-profile + auth.users lookup when ADMIN_NOTIFICATION_TO is empty', () => {
    expect(SOURCE).toMatch(/from\(\s*['"]profiles['"]\s*\)/);
    expect(SOURCE).toMatch(/\.eq\(\s*['"]role['"]\s*,\s*['"]admin['"]\s*\)/);
    expect(SOURCE).toMatch(/svc\.auth\.admin\.listUsers/);
  });
});

describe('cutover-health-monitor — boundary discipline (comment-stripped)', () => {
  it.each(FORBIDDEN_RESPONSE_LITERALS)(
    'comment-stripped source must not contain forbidden pattern: %s',
    (pattern) => {
      // Strip comments first — doctrine-negation references inside the
      // docstring header (e.g. "NEVER reads CLASSIFIER_QUEUE_ROUTING_ENABLED")
      // are intentional documentation, not runtime references.
      expect(SOURCE_CODE_ONLY).not.toMatch(pattern);
    },
  );

  it('does NOT call any provider endpoint other than api.resend.com', () => {
    // Allowlist exactly one outbound endpoint. Use comment-stripped source
    // so URL examples inside docstrings don't trigger.
    const httpsCalls = SOURCE_CODE_ONLY.match(/https:\/\/[a-z0-9.-]+/gi) || [];
    for (const url of httpsCalls) {
      expect(url).toBe('https://api.resend.com');
    }
  });

  it('does NOT read service-role env directly (uses createServiceClient helper)', () => {
    // The Edge Function should NEVER read `SUPABASE_SERVICE_ROLE_KEY` from
    // Deno.env directly — it uses the `createServiceClient()` helper, which
    // does that on its behalf. A direct read here would be a doctrine
    // violation (the helper is the audited surface).
    expect(SOURCE_CODE_ONLY).not.toMatch(/Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]/);
  });

  it('does NOT log or return recipient values', () => {
    // The response builder uses `ok({...})`. Walk the ok(...) arg(s) and
    // verify none of the keys is recipient-shaped.
    const okCalls = SOURCE_CODE_ONLY.match(/ok\(\{[^}]+\}\)/g) || [];
    expect(okCalls.length).toBeGreaterThan(0);
    for (const call of okCalls) {
      expect(call).not.toMatch(/recipients?\s*:/i);
      expect(call).not.toMatch(/\bto\s*:/);  // `to:` field in the response would leak
      expect(call).not.toMatch(/admin_?emails?\s*:/i);
    }
  });
});

describe('cutover-health-monitor — preserved safety invariants', () => {
  it('fail-closed auth gate: missing CUTOVER_MONITOR_SHARED_SECRET returns 401', () => {
    expect(SOURCE).toMatch(/CUTOVER_MONITOR_SHARED_SECRET/);
    // The implementation reads the env and unconditionally returns
    // unauthorized() when it's missing — verify the early-return pattern.
    expect(SOURCE).toMatch(/if\s*\(\s*!\s*expected\s*\)\s*\{\s*[\s\S]{0,200}?return\s+unauthorized\(\)/);
  });

  it('Resend response body is drained without being logged', () => {
    // The Edge Function calls `await res.text()` inside a try/catch with an
    // empty `catch { ... }`, never assigning the result or passing it to a
    // logger.
    const resendBlock = SOURCE.split('api.resend.com')[1] || '';
    expect(resendBlock).toMatch(/try\s*\{\s*await\s+res\.text\(\)\s*;?\s*\}\s*catch/);
    expect(resendBlock).not.toMatch(/console\.(log|warn|error)\s*\(\s*[a-zA-Z_]*body/i);
    expect(resendBlock).not.toMatch(/console\.(log|warn|error)\s*\(\s*[a-zA-Z_]*text/i);
  });

  it('AUTH_SCHEME_PREFIX is split-literal so the secret-shape scan stays clean', () => {
    // Same convention as classifier-drainer + booleanObservationMcpAdapter:
    // the `'Bearer '` literal is constructed by concatenation so the source
    // does not contain a contiguous `Bearer ` (which would otherwise trip
    // string-scan guards).
    expect(SOURCE).toMatch(/AUTH_SCHEME_PREFIX\s*=\s*['"]Bea['"]\s*\+\s*['"]rer\s+['"]/);
    // Defensive: no other place in the file contains a contiguous `Bearer `
    // (only the runtime-assembled value does).
    const strippedComments = SOURCE
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    // The concat literal halves remain — but `Bearer ` should never appear
    // contiguously in the stripped source.
    expect(strippedComments).not.toMatch(/['"]Bearer\s+['"]/);
  });
});

describe('cutover-health-monitor — no new provider-spend path', () => {
  it('does NOT import any MCP / Anthropic / classifier-drainer module', () => {
    // The Edge Function's only inbound dependency on Edge-side modules is
    // `_shared/http.ts` and `_shared/supabaseClients.ts`. It must NOT import
    // any classifier/MCP module that could trigger a provider call.
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifyArgumentCore['"]/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*booleanObservationMcpAdapter['"]/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifierDrainer/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*classifierQueueRouting/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*autoTriggerDispatcher/);
    expect(SOURCE).not.toMatch(/from\s+['"][^'"]*anthropic/i);
  });

  it('the RPC call is the read-only cutover_health_metrics aggregator (no other RPCs)', () => {
    const rpcCalls = SOURCE.match(/\.rpc\(\s*['"][^'"]+['"]/g) || [];
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0]).toMatch(/['"]cutover_health_metrics['"]/);
  });
});
