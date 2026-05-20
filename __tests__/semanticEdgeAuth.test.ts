/**
 * MCP-016 — semantic-referee Edge Function auth + input-path tests.
 *
 * The Edge Function entry point is Deno code (`Deno.serve`) and cannot be
 * loaded by Jest. Following the `argumentDeletionRequest.test.ts` convention,
 * this suite asserts the function's SOURCE shape: it declares the CORS, method,
 * auth, JSON-parse, schema-validation, and RLS room-access guards in the order
 * the `supabase-edge-contract` standard requires.
 *
 * Local `supabase functions serve` happy-path / auth-refused integration runs
 * are a separate operator step (no deploy in this card).
 */
import * as fs from 'fs';
import * as path from 'path';

const fnSrc = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/semantic-referee/index.ts'),
  'utf8',
);

/** Strip comments + string literals so a scan only sees executable code. */
function stripCommentsAndStrings(src: string): string {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/[^\n]*/g, '');
  out = out.replace(/'(?:\\.|[^'\\])*'/g, "''");
  out = out.replace(/"(?:\\.|[^"\\])*"/g, '""');
  out = out.replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '``');
  return out;
}

/** The function's executable code only — comments + strings removed. */
const fnCode = stripCommentsAndStrings(fnSrc);

describe('semantic-referee Edge Function — request guards', () => {
  it('handles the CORS preflight (OPTIONS) before anything else', () => {
    expect(fnSrc).toMatch(/req\.method === 'OPTIONS'/);
    expect(fnSrc).toMatch(/new Response\('ok', \{ headers: corsHeaders \}\)/);
  });

  it('rejects a non-POST method with methodNotAllowed (405)', () => {
    expect(fnSrc).toMatch(/req\.method !== 'POST'/);
    expect(fnSrc).toMatch(/return methodNotAllowed\(\)/);
  });

  it('rejects a missing Authorization header with unauthorized (401), before any body parse', () => {
    const authIdx = fnSrc.indexOf("req.headers.get('Authorization')");
    const parseIdx = fnSrc.indexOf('await req.json()');
    expect(authIdx).toBeGreaterThan(-1);
    expect(parseIdx).toBeGreaterThan(-1);
    // The auth check appears before the body parse.
    expect(authIdx).toBeLessThan(parseIdx);
    expect(fnSrc).toMatch(/if \(!authHeader\) return unauthorized\(\)/);
  });

  it('rejects an invalid JWT (getUser error) with unauthorized (401)', () => {
    expect(fnSrc).toMatch(/callerClient\.auth\.getUser\(\)/);
    expect(fnSrc).toMatch(/if \(userError \|\| !user\) return unauthorized\(\)/);
  });

  it('rejects invalid JSON with badRequest (400)', () => {
    expect(fnSrc).toMatch(/badRequest\('Invalid JSON body\.'\)/);
  });

  it('validates the body with ClassifyMoveRequestSchema and returns validation_failed (422)', () => {
    expect(fnSrc).toMatch(/ClassifyMoveRequestSchema\.safeParse/);
    expect(fnSrc).toMatch(/validationFailed\(\{ error: 'validation_failed', issues \}\)/);
  });

  it('checks room access via the caller-scoped client (RLS) on the debates table', () => {
    expect(fnSrc).toMatch(/callerClient[\s\S]*?\.from\('debates'\)/);
    expect(fnSrc).toMatch(/\.eq\('id', input\.roomId\)/);
    expect(fnSrc).toMatch(/\.maybeSingle\(\)/);
  });

  it('returns room_not_found_or_not_accessible when the room lookup yields no row', () => {
    expect(fnSrc).toMatch(/validationFailed\(\{ error: 'room_not_found_or_not_accessible' \}\)/);
  });
});

describe('semantic-referee Edge Function — no privileged write', () => {
  it('never builds a service-role client', () => {
    expect(fnSrc).not.toMatch(/createServiceClient/);
    expect(fnSrc).not.toMatch(/SERVICE_ROLE/);
  });

  it('only imports the caller-scoped client factory', () => {
    expect(fnSrc).toMatch(/import \{ createCallerClient \} from '\.\.\/_shared\/supabaseClients\.ts'/);
  });

  it('never inserts / updates / deletes any table (executable code)', () => {
    expect(fnCode).not.toMatch(/\.insert\(/);
    expect(fnCode).not.toMatch(/\.update\(/);
    expect(fnCode).not.toMatch(/\.delete\(/);
    expect(fnCode).not.toMatch(/\.upsert\(/);
  });

  it('never inserts into public.arguments and never calls submit-argument (executable code)', () => {
    // The function's docblock legitimately documents "never calls
    // submit-argument" — the scan strips comments and asserts executable code.
    expect(fnCode).not.toMatch(/from\('arguments'\)/);
    expect(fnCode).not.toMatch(/submit-argument/);
  });
});

describe('semantic-referee Edge Function — defensive redaction + classify', () => {
  it('runs the defensive redaction pass before delegating to the registry', () => {
    expect(fnSrc).toMatch(/redactClassifyMoveRequest\(input\)/);
    const redactIdx = fnSrc.indexOf('redactClassifyMoveRequest(input)');
    const classifyIdx = fnSrc.indexOf('classifyWithConfiguredProvider(redactedInput)');
    expect(redactIdx).toBeGreaterThan(-1);
    expect(classifyIdx).toBeGreaterThan(-1);
    expect(redactIdx).toBeLessThan(classifyIdx);
  });

  it('returns the outcome via ok() — HTTP 200 for both enabled and disabled', () => {
    expect(fnSrc).toMatch(/return ok\(outcome\)/);
  });

  it('declares verify_jwt = true in config.toml for the function', () => {
    const config = fs.readFileSync(path.join(process.cwd(), 'supabase/config.toml'), 'utf8');
    expect(config).toMatch(/\[functions\.semantic-referee\]\s*\nverify_jwt = true/);
  });
});
