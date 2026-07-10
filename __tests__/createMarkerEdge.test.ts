/**
 * MARK-002 (#894) §2 + §3 — Edge source-scan + config.toml registration scan.
 *
 * The Deno Edge Function is unloadable by jest (npm: specifier + Deno.serve), so
 * the house pattern (attachProofEdge.test.ts) source-scans index.ts for the
 * guard ladder (each honest code), the no-oracle caller reads, the load-bearing
 * server-side quote snapshot (quoted_text = the SERVER slice, never body.quote),
 * the .strict() schema, and secret discipline (no Authorization / SERVICE_ROLE /
 * quoted_text logging) — each safety scan paired with a negative control where
 * feasible. §3 scans config.toml for the #509 registration hazard.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'supabase', 'functions', 'create-marker', 'index.ts');
const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');
const SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const CONFIG = fs.readFileSync(CONFIG_PATH, 'utf8');

/** The MintMarkerSchema definition substring (request schema only). */
const SCHEMA = SRC.slice(SRC.indexOf('const MintMarkerSchema'), SRC.indexOf('type MintRequest'));

describe('MARK-002 §2 — standard Edge shape', () => {
  it('uses Deno.serve, CORS on OPTIONS, methodNotAllowed, unauthorized', () => {
    expect(SRC).toContain('Deno.serve');
    expect(SRC).toContain("req.method === 'OPTIONS'");
    expect(SRC).toContain('corsHeaders');
    expect(SRC).toContain('methodNotAllowed()');
    expect(SRC).toContain('unauthorized()');
  });

  it('parses a strict schema with safeParse before reading the body shape', () => {
    expect(SRC).toContain('.strict()');
    expect(SRC).toContain('safeParse');
  });

  it('resolves the caller via createCallerClient + auth.getUser (defense-in-depth)', () => {
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toContain('auth.getUser()');
  });

  it('imports only from _shared (no src import, Deno module graph)', () => {
    const imports = SRC.match(/from '[^']+'/g) ?? [];
    for (const imp of imports) {
      if (imp.includes('npm:')) continue;
      expect(imp).toMatch(/from '\.\.\/_shared\//);
    }
  });
});

describe('MARK-002 §2 — schema is fully server-derived (no smuggled fields)', () => {
  it('the schema declares only the intended request fields', () => {
    expect(SCHEMA).toContain('action');
    expect(SCHEMA).toContain('debateId');
    expect(SCHEMA).toContain('targetArgumentId');
    expect(SCHEMA).toContain('spanStart');
    expect(SCHEMA).toContain('spanEnd');
    expect(SCHEMA).toContain('quote');
    expect(SCHEMA).toContain('kind');
    expect(SCHEMA).toContain('replyArgumentId');
  });

  it('does NOT accept client-supplied quotedText / spanUnit / createdBy / recordingId', () => {
    expect(SCHEMA).not.toMatch(/quotedText/);
    expect(SCHEMA).not.toMatch(/spanUnit/);
    expect(SCHEMA).not.toMatch(/createdBy/);
    expect(SCHEMA).not.toMatch(/recordingId/);
  });
});

describe('MARK-002 §2 — guard ladder codes present (each honest code)', () => {
  const CODES = [
    'target_not_found',
    'debate_argument_mismatch',
    'not_a_participant',
    'span_out_of_bounds',
    'span_too_long',
    'quote_mismatch',
    'reply_not_found',
    'not_your_reply',
    'debate_reply_mismatch',
    'marker_cap_reached',
  ];
  for (const code of CODES) {
    it(`emits ${code}`, () => {
      expect(SRC).toContain(code);
    });
  }
});

describe('MARK-002 §2 — server-side quote snapshot (the load-bearing Q5 guarantee)', () => {
  it('verifies the client quote against the server slice via verifyQuoteMatch', () => {
    expect(SRC).toContain('verifyQuoteMatch');
    expect(SRC).toContain('verifyMarkerSpan');
  });

  it('stores the SERVER slice (serverQuote), never the client quote field', () => {
    // The insert payload assigns quoted_text from the server-computed serverQuote,
    // not from body.quote (the client string is verification-only).
    expect(SRC).toMatch(/quoted_text:\s*serverQuote/);
    expect(SRC).not.toMatch(/quoted_text:\s*body\.quote/);
  });

  it('derives serverQuote from sliceQuote over the service-read body', () => {
    expect(SRC).toContain('sliceQuote(');
    expect(SRC).toMatch(/serverQuote\s*=\s*sliceQuote\(/);
  });

  it('NEGATIVE CONTROL: the client-quote-stored scan would fire on the forbidden pattern', () => {
    expect(/quoted_text:\s*body\.quote/.test('quoted_text: body.quote,')).toBe(true);
    expect(/quoted_text:\s*body\.quote/.test(SRC)).toBe(false);
  });
});

describe('MARK-002 §2 — the marker table is written service-role only (SELECT-only)', () => {
  it('inserts into timestamp_markers via the service client, sets span_unit chars', () => {
    expect(SRC).toContain('createServiceClient');
    expect(SRC).toContain("span_unit: 'chars'");
    expect(SRC).toMatch(/\.from\('timestamp_markers'\)[\s\S]*?\.insert\(/);
  });

  it('never writes to public.arguments (submit-argument stays pinned)', () => {
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.insert\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.update\(/);
  });
});

describe('MARK-002 §2 — secret + content discipline (no forbidden logging)', () => {
  it('never logs the Authorization header or the service-role key', () => {
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*[Aa]uthorization/);
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*SERVICE_ROLE/);
    expect(SRC).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('never logs quoted_text or the body content', () => {
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*quoted_text/);
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*serverQuote/);
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*\.body/);
  });

  it('the success log carries only opaque short ids + kind + hasReply', () => {
    expect(SRC).toContain('create_marker_ok');
    expect(SRC).toContain('callerIdShort');
    expect(SRC).toContain('targetArgumentIdShort');
  });
});

describe('MARK-002 §3 — config.toml registration (the #509 hazard)', () => {
  it('registers [functions.create-marker] with verify_jwt = true', () => {
    expect(CONFIG).toContain('[functions.create-marker]');
    const idx = CONFIG.indexOf('[functions.create-marker]');
    const tail = CONFIG.slice(idx + '[functions.create-marker]'.length);
    const nextSection = tail.search(/\n\[/);
    const block = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });
});
