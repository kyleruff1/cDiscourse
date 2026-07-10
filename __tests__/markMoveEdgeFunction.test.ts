/**
 * FEEDBACK-001 (#898) — mark-move Edge source-scan + shared-code behavior +
 * config.toml registration scan.
 *
 * The Deno Edge Function is unloadable by jest (npm: specifier + Deno.serve), so
 * the house pattern (createMarkerEdge.test.ts / attachProofEdge.test.ts)
 * source-scans index.ts for the guard ladder (each honest code), the no-oracle
 * caller reads, the service-role-only writes to the SELECT-only move_marks table,
 * the paired-code exclusivity retract, the deliberately-minimal no-counts
 * response, the .strict() schema, and secret / doctrine discipline (no
 * Authorization / SERVICE_ROLE logging, no pointStanding import, never writes
 * public.arguments, apostrophe-free comments) — each safety scan paired with a
 * negative control where feasible. The shared _shared/moveMarkCodes.ts pure module
 * IS importable, so its allow-list + pair helper get real behavioral coverage.
 */
import fs from 'fs';
import path from 'path';
import {
  MOVE_MARK_CODES,
  isMoveMarkCode,
  oppositeMarkCode,
  MUTUALLY_EXCLUSIVE_PAIR,
} from '../supabase/functions/_shared/moveMarkCodes';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'supabase', 'functions', 'mark-move', 'index.ts');
const SHARED_PATH = path.join(ROOT, 'supabase', 'functions', '_shared', 'moveMarkCodes.ts');
const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');
const SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const SHARED_SRC = fs.readFileSync(SHARED_PATH, 'utf8');
const CONFIG = fs.readFileSync(CONFIG_PATH, 'utf8');

/** The MarkMoveSchema definition substring (request schema only). */
const SCHEMA = SRC.slice(SRC.indexOf('const MarkMoveSchema'), SRC.indexOf('type MarkMoveRequest'));

/** Block + line comments only (for the apostrophe-free scan). */
function commentsOnly(src: string): string {
  const blocks = src.match(/\/\*[\s\S]*?\*\//g) ?? [];
  const lines = src.match(/(^|[^:])\/\/[^\n]*/g) ?? [];
  return [...blocks, ...lines].join('\n');
}

// ── shared pure module: the code contract ────────────────────

describe('FEEDBACK-001 — moveMarkCodes shared contract (behavioral)', () => {
  it('exposes exactly the five Output 9 codes, in order', () => {
    expect([...MOVE_MARK_CODES]).toEqual([
      'addressed_my_point',
      'did_not_address',
      'receipts_requested',
      'good_receipt',
      'off_the_point',
    ]);
  });

  it('isMoveMarkCode accepts every valid code and rejects unknowns', () => {
    for (const code of MOVE_MARK_CODES) expect(isMoveMarkCode(code)).toBe(true);
    expect(isMoveMarkCode('is_the_winner')).toBe(false);
    expect(isMoveMarkCode('')).toBe(false);
    expect(isMoveMarkCode('ADDRESSED_MY_POINT')).toBe(false);
  });

  it('oppositeMarkCode pairs only the two ghost-bar arms; other codes return null', () => {
    expect(oppositeMarkCode('addressed_my_point')).toBe('did_not_address');
    expect(oppositeMarkCode('did_not_address')).toBe('addressed_my_point');
    expect(oppositeMarkCode('receipts_requested')).toBeNull();
    expect(oppositeMarkCode('good_receipt')).toBeNull();
    expect(oppositeMarkCode('off_the_point')).toBeNull();
  });

  it('the mutually-exclusive pair is exactly the two arms', () => {
    expect([...MUTUALLY_EXCLUSIVE_PAIR]).toEqual(['addressed_my_point', 'did_not_address']);
  });

  it('the shared module imports nothing from pointStanding and calls no network', () => {
    expect(SHARED_SRC).not.toMatch(/pointStanding/i);
    expect(SHARED_SRC).not.toMatch(/antiAmplification/i);
    expect(/\bfetch\s*\(/.test(SHARED_SRC)).toBe(false);
  });
});

// ── standard Edge shape ──────────────────────────────────────

describe('FEEDBACK-001 — standard Edge shape', () => {
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

  it('imports only from _shared or npm: (no src import, Deno module graph)', () => {
    const imports = SRC.match(/from '[^']+'/g) ?? [];
    for (const imp of imports) {
      if (imp.includes('npm:')) continue;
      expect(imp).toMatch(/from '\.\.\/_shared\//);
    }
  });
});

// ── schema fields (no smuggled fields) ───────────────────────

describe('FEEDBACK-001 — schema declares only the intended fields', () => {
  it('declares action / debateId / argumentId / markCode', () => {
    expect(SCHEMA).toContain('action');
    expect(SCHEMA).toContain('debateId');
    expect(SCHEMA).toContain('argumentId');
    expect(SCHEMA).toContain('markCode');
  });

  it('does NOT accept client-supplied markedBy / createdAt / retractedAt / count', () => {
    expect(SCHEMA).not.toMatch(/markedBy/);
    expect(SCHEMA).not.toMatch(/createdAt/);
    expect(SCHEMA).not.toMatch(/retractedAt/);
    expect(SCHEMA).not.toMatch(/count/i);
  });
});

// ── guard ladder codes present (each honest code) ────────────

describe('FEEDBACK-001 — guard ladder codes present', () => {
  const CODES = [
    'invalid_mark_code',
    'argument_not_found',
    'debate_argument_mismatch',
    'argument_deleted',
    'cannot_mark_own_move',
    'not_a_participant',
  ];
  for (const code of CODES) {
    it(`emits ${code}`, () => {
      expect(SRC).toContain(code);
    });
  }

  it('the own-move guard compares author_id to the caller id and returns 403 cannot_mark_own_move', () => {
    expect(SRC).toMatch(/argRow\.author_id === callerId/);
    expect(SRC).toMatch(/403,\s*'cannot_mark_own_move'/);
  });

  it('the participant gate calls is_debate_participant and returns 403 not_a_participant', () => {
    expect(SRC).toContain("rpc('is_debate_participant'");
    expect(SRC).toMatch(/403,\s*'not_a_participant'/);
  });
});

// ── service-role writes to the SELECT-only table; never writes arguments ──

describe('FEEDBACK-001 — the move_marks table is written service-role only (SELECT-only)', () => {
  it('upserts move_marks via the service client with onConflict', () => {
    expect(SRC).toContain('createServiceClient');
    expect(SRC).toMatch(/\.from\('move_marks'\)[\s\S]*?\.upsert\(/);
    expect(SRC).toContain("onConflict: 'argument_id,marked_by,mark_code'");
  });

  it('retract is a soft update (retracted_at), never a delete', () => {
    expect(SRC).toMatch(/\.from\('move_marks'\)[\s\S]*?\.update\(\{ retracted_at/);
    expect(SRC).not.toMatch(/\.from\('move_marks'\)[\s\S]{0,80}\.delete\(/);
  });

  it('paired mutual-exclusivity retracts the opposite active arm before the upsert', () => {
    expect(SRC).toContain('oppositeMarkCode(markCode)');
    expect(SRC).toMatch(/\.eq\('mark_code', opposite\)/);
  });

  it('never writes to public.arguments (submit-argument stays pinned)', () => {
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.insert\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.update\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.upsert\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.delete\(/);
  });
});

// ── the deliberately-minimal no-counts response (the un-game-like pin) ──

describe('FEEDBACK-001 — response returns ONLY the viewer own state (no counts)', () => {
  it('the success response carries viewerMarks and argumentId only', () => {
    expect(SRC).toMatch(/return ok\(\{ ok: true, argumentId: body\.argumentId, viewerMarks \}\)/);
  });

  it('returns NO per-move count / tally field (no fistBumpCount, no count:)', () => {
    expect(SRC).not.toMatch(/fistBumpCount/);
    expect(SRC).not.toMatch(/\bcount:/);
    expect(SRC).not.toMatch(/markCount/i);
  });

  it('NEGATIVE CONTROL: the no-count scan fires on the forbidden pattern', () => {
    expect(/\bcount:/.test('summary: { count: 3 }')).toBe(true);
    expect(/\bcount:/.test(SRC)).toBe(false);
  });

  it('buildViewerMarks maps every code to a boolean from the active set only', () => {
    expect(SRC).toContain('buildViewerMarks');
    expect(SRC).toMatch(/for \(const code of MOVE_MARK_CODES\)/);
  });
});

// ── secret + doctrine discipline (no forbidden logging / imports) ──

describe('FEEDBACK-001 — secret + doctrine discipline', () => {
  it('never logs the Authorization header or the service-role key', () => {
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*[Aa]uthorization/);
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*SERVICE_ROLE/);
    expect(SRC).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('imports nothing from any pointStanding / antiAmplification path (anti-amplification boundary)', () => {
    // Scan the IMPORT statements (not prose): no import pulls in a standing path.
    const importLines = (SRC.match(/^import[\s\S]*?from '[^']+';/gm) ?? []).join('\n');
    expect(importLines).not.toMatch(/pointStanding/i);
    expect(importLines).not.toMatch(/antiAmplification/i);
    // These standing-engine identifiers must not appear anywhere (they are not
    // doctrine-prose words like "point standing"): a hit is a real value import.
    expect(SRC).not.toMatch(/gradeChallenge|gradeRepair|broadStanding|narrowStanding|applyAntiAmplification/);
  });

  it('makes no AI / external-provider call', () => {
    expect(SRC).not.toMatch(/anthropic|api\.x\.ai|openai/i);
  });

  it('the success log carries only opaque short ids + action + markCode', () => {
    expect(SRC).toContain('mark_move_ok');
    expect(SRC).toContain('callerIdShort');
    expect(SRC).toContain('argumentIdShort');
  });

  it('all comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha)', () => {
    expect(commentsOnly(SRC)).not.toContain("'");
    expect(commentsOnly(SHARED_SRC)).not.toContain("'");
  });
});

// ── config.toml registration (the #509 hazard) ───────────────

describe('FEEDBACK-001 — config.toml registration (the #509 hazard)', () => {
  it('registers [functions.mark-move] with verify_jwt = true', () => {
    expect(CONFIG).toContain('[functions.mark-move]');
    const idx = CONFIG.indexOf('[functions.mark-move]');
    const tail = CONFIG.slice(idx + '[functions.mark-move]'.length);
    const nextSection = tail.search(/\n\[/);
    const block = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });
});
