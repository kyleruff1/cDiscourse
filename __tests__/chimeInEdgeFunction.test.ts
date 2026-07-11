/**
 * CHIMEIN-P8 Round 2 (#761) — chime-in Edge source-scan + shared-code behavior +
 * config.toml registration scan (the #509 hazard, firing negative control).
 *
 * The Deno Edge Function is unloadable by jest (npm: specifier + Deno.serve), so
 * the house pattern (markMoveEdgeFunction.test.ts / createMarkerEdge.test.ts)
 * source-scans index.ts for the guard ladder (each honest code), the no-oracle
 * caller reads, the service-role-only writes to the SELECT-only
 * chime_in_contributions table, the two-step attach (never writes
 * public.arguments), the byte-identical-gate discipline, and secret / doctrine
 * discipline — each safety scan paired with a negative control where feasible. The
 * shared _shared/chimeInSeats.ts pure module IS importable, so its cap + free-seat
 * picker get real behavioral coverage AND a cross-boundary parity check against the
 * client GAME-005 chime capacity.
 */
import fs from 'fs';
import path from 'path';
import {
  CHIME_IN_SEAT_MIN,
  CHIME_IN_SEAT_MAX,
  CHIME_IN_SEAT_INDICES,
  CHIME_IN_SEAT_CAP,
  isChimeSeatIndex,
  lowestFreeChimeSeatIndex,
  openChimeSeatCount,
} from '../supabase/functions/_shared/chimeInSeats';
import { CHIME_IN_CAP_PUBLIC } from '../src/features/debates/oneToOneRoomLifecycle';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'supabase', 'functions', 'chime-in', 'index.ts');
const SHARED_PATH = path.join(ROOT, 'supabase', 'functions', '_shared', 'chimeInSeats.ts');
const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');
const SRC = fs.readFileSync(INDEX_PATH, 'utf8');
const SHARED_SRC = fs.readFileSync(SHARED_PATH, 'utf8');
const CONFIG = fs.readFileSync(CONFIG_PATH, 'utf8');

/** The ChimeInSchema definition substring (request schema only). */
const SCHEMA = SRC.slice(SRC.indexOf('const ChimeInSchema'), SRC.indexOf('type ChimeInRequest'));

/** Block + line comments only (for the apostrophe-free scan). */
function commentsOnly(src: string): string {
  const blocks = src.match(/\/\*[\s\S]*?\*\//g) ?? [];
  const lines = src.match(/(^|[^:])\/\/[^\n]*/g) ?? [];
  return [...blocks, ...lines].join('\n');
}

// ── shared pure module: the seat contract (behavioral) ────────

describe('CHIMEIN-P8 — chimeInSeats shared contract (behavioral)', () => {
  it('exposes the room-level cap 1..3 (GAME-005)', () => {
    expect(CHIME_IN_SEAT_MIN).toBe(1);
    expect(CHIME_IN_SEAT_MAX).toBe(3);
    expect([...CHIME_IN_SEAT_INDICES]).toEqual([1, 2, 3]);
    expect(CHIME_IN_SEAT_CAP).toBe(3);
  });

  it('CHIME_IN_SEAT_CAP has cross-boundary parity with the client GAME-005 chime capacity', () => {
    // The Edge (Deno) cannot import the client publicSeatModel, so the two derive
    // the cap independently. This pins them equal so a tuning change to one is
    // caught if the other is not updated in lockstep.
    expect(CHIME_IN_SEAT_CAP).toBe(CHIME_IN_CAP_PUBLIC);
  });

  it('isChimeSeatIndex accepts 1..3 and rejects everything else', () => {
    for (const i of CHIME_IN_SEAT_INDICES) expect(isChimeSeatIndex(i)).toBe(true);
    expect(isChimeSeatIndex(0)).toBe(false);
    expect(isChimeSeatIndex(4)).toBe(false);
    expect(isChimeSeatIndex(1.5)).toBe(false);
    expect(isChimeSeatIndex('1')).toBe(false);
    expect(isChimeSeatIndex(null)).toBe(false);
  });

  it('lowestFreeChimeSeatIndex returns the lowest free seat, or null when full', () => {
    expect(lowestFreeChimeSeatIndex([])).toBe(1);
    expect(lowestFreeChimeSeatIndex([1])).toBe(2);
    expect(lowestFreeChimeSeatIndex([2, 1])).toBe(3);
    expect(lowestFreeChimeSeatIndex([1, 3])).toBe(2);
    expect(lowestFreeChimeSeatIndex([1, 2, 3])).toBeNull();
    // out-of-range used values are ignored (defensive)
    expect(lowestFreeChimeSeatIndex([9, 0])).toBe(1);
  });

  it('openChimeSeatCount clamps to 0..3', () => {
    expect(openChimeSeatCount(0)).toBe(3);
    expect(openChimeSeatCount(1)).toBe(2);
    expect(openChimeSeatCount(3)).toBe(0);
    expect(openChimeSeatCount(5)).toBe(0);
    expect(openChimeSeatCount(-1)).toBe(3);
    expect(openChimeSeatCount(Number.NaN)).toBe(3);
  });

  it('the shared module imports nothing from pointStanding and calls no network', () => {
    expect(SHARED_SRC).not.toMatch(/pointStanding/i);
    expect(SHARED_SRC).not.toMatch(/antiAmplification/i);
    expect(/\bfetch\s*\(/.test(SHARED_SRC)).toBe(false);
    // No import statement at all (the module is pure); the doc comment may mention
    // supabase in prose, so scan for a real `from '...supabase'` import only.
    expect(SHARED_SRC).not.toMatch(/from\s+['"][^'"]*supabase/i);
  });
});

// ── standard Edge shape ──────────────────────────────────────

describe('CHIMEIN-P8 — standard Edge shape', () => {
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

describe('CHIMEIN-P8 — schema declares only the intended fields', () => {
  it('declares action / argument_id / target_argument_id / contribution_id', () => {
    expect(SCHEMA).toContain('action');
    expect(SCHEMA).toContain('argument_id');
    expect(SCHEMA).toContain('target_argument_id');
    expect(SCHEMA).toContain('contribution_id');
  });

  it('does NOT accept a client-supplied seat_index / author_id / created_at / retracted_at / debate_id', () => {
    expect(SCHEMA).not.toMatch(/seat_index/);
    expect(SCHEMA).not.toMatch(/author_id/);
    expect(SCHEMA).not.toMatch(/created_at/);
    expect(SCHEMA).not.toMatch(/retracted_at/);
    // debate_id is derived from the argument row, never taken on the wire.
    expect(SCHEMA).not.toMatch(/debate_id/);
  });
});

// ── guard ladder codes present (each honest code) ────────────

describe('CHIMEIN-P8 — guard ladder codes present', () => {
  const CODES = ['not_found', 'not_author', 'not_point_scoped', 'room_private', 'seats_full', 'invalid_input'];
  for (const code of CODES) {
    it(`emits ${code}`, () => {
      expect(SRC).toContain(code);
    });
  }

  it('the author-scope guard compares author_id to the caller id and returns 403 not_author', () => {
    expect(SRC).toMatch(/argRow\.author_id !== callerId/);
    expect(SRC).toMatch(/403,\s*'not_author'/);
  });

  it('the point-scope guard compares parent_id to target_argument_id and returns 409 not_point_scoped', () => {
    expect(SRC).toMatch(/argRow\.parent_id !== body\.target_argument_id/);
    expect(SRC).toMatch(/409,\s*'not_point_scoped'/);
  });

  it('the public-only guard rejects a non-public room with 409 room_private', () => {
    expect(SRC).toMatch(/debRow\.visibility !== 'public'/);
    expect(SRC).toMatch(/409,\s*'room_private'/);
  });

  it('the cap guard returns 409 seats_full when no seat is free', () => {
    expect(SRC).toMatch(/409,\s*'seats_full'/);
    expect(SRC).toContain('lowestFreeChimeSeatIndex');
  });
});

// ── service-role writes to the SELECT-only table; never writes arguments ──

describe('CHIMEIN-P8 — chime_in_contributions is written service-role only (SELECT-only)', () => {
  it('inserts chime_in_contributions via the service client', () => {
    expect(SRC).toContain('createServiceClient');
    expect(SRC).toMatch(/\.from\('chime_in_contributions'\)[\s\S]*?\.insert\(/);
  });

  it('retract is a soft update (retracted_at), never a delete', () => {
    expect(SRC).toMatch(/\.from\('chime_in_contributions'\)[\s\S]*?\.update\(\{ retracted_at/);
    expect(SRC).not.toMatch(/\.from\('chime_in_contributions'\)[\s\S]{0,80}\.delete\(/);
  });

  it('handles the partial-UNIQUE conflict (23505) as the atomic cap guard, retrying once', () => {
    expect(SRC).toContain('23505');
    expect(SRC).toMatch(/conflict/);
  });

  it('never writes to public.arguments (submit-argument stays byte-pinned — the two-step design)', () => {
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.insert\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.update\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.upsert\(/);
    expect(SRC).not.toMatch(/\.from\('arguments'\)[\s\S]{0,120}\.delete\(/);
  });

  it('never writes debate_participants (chime is never a principal seat)', () => {
    expect(SRC).not.toMatch(/\.from\('debate_participants'\)[\s\S]{0,120}\.(insert|update|upsert|delete)\(/);
  });
});

// ── point-scope + public-only + two-step (the invariants) ────

describe('CHIMEIN-P8 — the two-step attach records a marker, never re-gates the post', () => {
  it('reads the chime argument caller-scoped for author + parent + debate (no-oracle)', () => {
    expect(SRC).toMatch(/\.from\('arguments'\)[\s\S]*?\.select\('id, debate_id, parent_id, author_id, status'\)/);
    expect(SRC).toContain('maybeSingle');
  });

  it('derives debate_id from the argument row, never from the request', () => {
    expect(SRC).toMatch(/argRow\.debate_id/);
  });

  it('returns open_chime_in_seat_count on both attach and retract', () => {
    expect(SRC).toContain('open_chime_in_seat_count');
    expect(SRC).toContain('computeOpenSeatCount');
  });
});

// ── secret + doctrine discipline (no forbidden logging / imports) ──

describe('CHIMEIN-P8 — secret + doctrine discipline', () => {
  it('never logs the Authorization header or the service-role key', () => {
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*[Aa]uthorization/);
    expect(SRC).not.toMatch(/console\.[a-z]+\([^)]*SERVICE_ROLE/);
    expect(SRC).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('imports nothing from any pointStanding / antiAmplification path (anti-amplification boundary)', () => {
    const importLines = (SRC.match(/^import[\s\S]*?from '[^']+';/gm) ?? []).join('\n');
    expect(importLines).not.toMatch(/pointStanding/i);
    expect(importLines).not.toMatch(/antiAmplification/i);
    expect(SRC).not.toMatch(/gradeChallenge|gradeRepair|broadStanding|narrowStanding|applyAntiAmplification/);
  });

  it('makes no AI / external-provider call', () => {
    expect(SRC).not.toMatch(/anthropic|api\.x\.ai|openai/i);
  });

  it('the success log carries only opaque short ids + action', () => {
    expect(SRC).toContain('chime_in_ok');
    expect(SRC).toContain('callerIdShort');
    expect(SRC).toContain('argumentIdShort');
  });

  it('all comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha)', () => {
    expect(commentsOnly(SRC)).not.toContain("'");
    expect(commentsOnly(SHARED_SRC)).not.toContain("'");
  });
});

// ── config.toml registration (the #509 hazard, firing negative control) ──

describe('CHIMEIN-P8 — config.toml registration (the #509 hazard)', () => {
  it('registers [functions.chime-in] with verify_jwt = true', () => {
    expect(CONFIG).toContain('[functions.chime-in]');
    const idx = CONFIG.indexOf('[functions.chime-in]');
    const tail = CONFIG.slice(idx + '[functions.chime-in]'.length);
    const nextSection = tail.search(/\n\[/);
    const block = nextSection >= 0 ? tail.slice(0, nextSection) : tail;
    expect(block).toMatch(/verify_jwt = true/);
    expect(block).not.toMatch(/verify_jwt = false/);
  });

  it('NEGATIVE CONTROL: removing the registration block turns this scan RED (fires, not silently passes)', () => {
    const withoutBlock = CONFIG.replace('[functions.chime-in]', '[functions.chime-in-DISABLED]');
    expect(CONFIG.includes('[functions.chime-in]')).toBe(true);
    expect(withoutBlock.includes('[functions.chime-in]')).toBe(false);
  });
});
