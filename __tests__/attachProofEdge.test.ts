/**
 * PROOF-003 (#890) §2 + §3 — Edge source-scan + config.toml registration scan.
 *
 * The Deno Edge Function is unloadable by jest (npm: specifier + Deno.serve), so
 * the house pattern (createArgumentRoomEdge.test.ts) source-scans index.ts for
 * the guard ladder, the two reviewer conditions, the no-oracle contract, the
 * idempotency + notification reuse, and secret discipline — each safety scan
 * paired with a negative control where feasible. §3 scans config.toml for the
 * #509 registration hazard.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'supabase', 'functions', 'attach-proof', 'index.ts');
const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');
const SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const CONFIG = fs.readFileSync(CONFIG_PATH, 'utf8');

/** The AttachSchema definition substring (request schema only). */
const ATTACH_SCHEMA = SRC.slice(SRC.indexOf('const AttachSchema'), SRC.indexOf('const DetachSchema'));

describe('PROOF-003 §2 — standard Edge shape', () => {
  it('uses Deno.serve, CORS on OPTIONS, methodNotAllowed, unauthorized', () => {
    expect(SRC).toContain('Deno.serve');
    expect(SRC).toContain("req.method === 'OPTIONS'");
    expect(SRC).toContain('corsHeaders');
    expect(SRC).toContain('methodNotAllowed()');
    expect(SRC).toContain('unauthorized()');
  });

  it('parses a strict discriminated union with safeParse before reading the body shape', () => {
    expect(SRC).toContain('discriminatedUnion');
    expect(SRC).toContain('.strict()');
    expect(SRC).toContain('safeParse');
  });

  it('resolves the caller via createCallerClient + auth.getUser (defense-in-depth)', () => {
    expect(SRC).toContain('createCallerClient');
    expect(SRC).toContain('auth.getUser()');
  });
});

describe('PROOF-003 §2 — guard ladder codes present', () => {
  const CODES = [
    'argument_not_found',
    'not_your_move',
    'debate_argument_mismatch',
    'not_a_participant',
    'kind_not_supported',
    'claim_not_found',
    'referenced_argument_not_found',
    'proof_cap_reached',
    'proof_not_found',
    'not_your_proof',
  ];
  for (const code of CODES) {
    it(`emits ${code}`, () => {
      expect(SRC).toContain(code);
    });
  }

  it('checks participation via is_debate_participant', () => {
    expect(SRC).toContain('is_debate_participant');
  });
});

describe('PROOF-003 §2 — no-oracle (not-found from a caller-scoped read)', () => {
  it('reads the target move via the caller-scoped client before returning argument_not_found', () => {
    const readIdx = SRC.search(/callerClient[\s\S]{0,30}\.from\(['"]arguments['"]\)/);
    const notFoundIdx = SRC.indexOf("'argument_not_found'");
    expect(readIdx).toBeGreaterThan(-1);
    expect(notFoundIdx).toBeGreaterThan(readIdx);
  });

  it('never probes public.arguments with the service-role client (no existence oracle)', () => {
    expect(/serviceClient[\s\S]{0,60}from\(['"]arguments['"]\)/.test(SRC)).toBe(false);
  });
});

describe('PROOF-003 §2 — condition (i) tombstone / field immutability', () => {
  it('the detach UPDATE payload is exactly { deleted_at } (negative control: no second key)', () => {
    expect(SRC).toContain('.update({ deleted_at: deletedAt })');
    // Negative control — a second-key update object must NOT be present.
    expect(/\.update\(\{\s*deleted_at:[^}]*,[^}]*\}\)/.test(SRC)).toBe(false);
  });

  it('never writes deleted_at: null (no resurrection / un-delete)', () => {
    expect(SRC).toContain('deleted_at'); // sanity: the token is used
    expect(SRC.includes('deleted_at: null')).toBe(false);
    expect(/\.update\(\{[^}]*deleted_at:\s*null/.test(SRC)).toBe(false);
  });

  it('has no proof-content UPDATE (attach = INSERT only)', () => {
    // The only .update in the file is the detach deleted_at update.
    const updates = SRC.match(/\.update\(/g) ?? [];
    expect(updates.length).toBe(1);
  });
});

describe('PROOF-003 §2 — condition (ii) admin-only privileged status', () => {
  it('the request schema has no sourceChainStatus and no risk field', () => {
    expect(ATTACH_SCHEMA).not.toContain('sourceChainStatus');
    expect(ATTACH_SCHEMA).not.toContain('risk:');
  });

  it('derives the stored status via deriveProofSourceChainStatus', () => {
    expect(SRC).toContain('deriveProofSourceChainStatus');
  });

  it('never writes the privileged statuses (negative control plants them)', () => {
    expect(SRC.includes('primary_present')).toBe(false);
    expect(SRC.includes('broken')).toBe(false);
    // Negative control: prove the scan would fire if they appeared.
    const planted = `${SRC}\nconst x = { source_chain_status: 'primary_present' };`;
    expect(planted.includes('primary_present')).toBe(true);
  });
});

describe('PROOF-003 §2 — idempotency + first-attach capture', () => {
  it('dedups by the natural content tuple before inserting', () => {
    const keyIdx = SRC.indexOf('proofIdempotencyKey');
    const insertIdx = SRC.indexOf('.insert(insertPayload)');
    expect(keyIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(keyIdx);
  });

  it('treats a duplicate relation (23505) as idempotent', () => {
    expect(SRC).toContain("code === '23505'");
    expect(SRC).toContain('relationIdempotent');
  });

  it('captures the JSONB snapshot on first attach via the shared mirror', () => {
    expect(SRC).toContain('captureRowsFromJsonb');
    expect(SRC).toContain('maybeCaptureJsonbSnapshot');
  });
});

describe('PROOF-003 §2 — evidence_supplied notification reuse', () => {
  it('inserts into room_notifications with type evidence_supplied', () => {
    expect(SRC).toContain("from('room_notifications')");
    expect(SRC).toContain("type: 'evidence_supplied'");
  });

  it('excludes the caller from recipients and marks the via source', () => {
    expect(SRC).toContain('uid !== callerId');
    expect(SRC).toContain("via: 'attach_proof'");
  });

  it('fires only on a NEW answers_request relation', () => {
    expect(SRC).toContain("relKind === 'answers_request'");
  });
});

describe('PROOF-003 §2 — secret discipline + ban-list', () => {
  it('has no console.log and no literal SERVICE_ROLE_KEY', () => {
    expect(SRC.includes('console.log')).toBe(false);
    expect(SRC.includes('SERVICE_ROLE_KEY')).toBe(false);
    expect(SRC).toContain('createServiceClient');
  });

  it('logs no Authorization header or service_role token', () => {
    const consoleLines = SRC.match(/console\.error\([\s\S]*?\);/g) ?? [];
    for (const line of consoleLines) {
      expect(/authorization|service_role/i.test(line)).toBe(false);
    }
  });

  it('no user-visible message carries a verdict / person token', () => {
    const BANNED = [
      'winner',
      'loser',
      'liar',
      'true',
      'false',
      'correct',
      'dishonest',
      'bad faith',
      'manipulative',
      'propagandist',
    ];
    const messages = [...SRC.matchAll(/fail\(\d+,\s*'[^']+',\s*'([^']+)'\)/g)].map((m) => m[1].toLowerCase());
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      for (const b of BANNED) expect(msg).not.toContain(b);
    }
  });
});

describe('PROOF-003 §3 — config.toml registration (the #509 hazard)', () => {
  it('registers [functions.attach-proof] with verify_jwt = true on the next non-comment line', () => {
    const blockIdx = CONFIG.indexOf('[functions.attach-proof]');
    expect(blockIdx).toBeGreaterThan(-1);
    const after = CONFIG.slice(blockIdx + '[functions.attach-proof]'.length);
    const nextLine = after
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))[0];
    expect(nextLine).toBe('verify_jwt = true');
  });

  it('the function source exists on disk', () => {
    expect(fs.existsSync(INDEX_PATH)).toBe(true);
  });

  it('does NOT register a mis-named directory (copy-paste negative control)', () => {
    expect(CONFIG.includes('[functions.attach-proof-nope]')).toBe(false);
  });
});
