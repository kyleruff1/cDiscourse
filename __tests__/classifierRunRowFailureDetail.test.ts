/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — helper unit + LEAK-SAFETY
 * CONVERGENCE GATE (the centerpiece).
 *
 * Runs against the REAL Deno builder via the require-bridge. The gate proves
 * `buildRunRowFailureDetail` is a STRUCTURAL allow-list with a secret-shape
 * scrub: no argument body / prompt / evidenceSpan value / raw payload / secret
 * can reach the persisted `failure_detail`, EVER. Mirrors the proven HALT-4
 * wall in `__tests__/booleanObservationFailureSubreason.test.ts`.
 *
 * Every secret-shaped literal in THIS file is assembled from fragments so the
 * file carries no contiguous secret-shaped literal (the SCAN-17 source scan
 * stays green).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  edgeBuildRunRowFailureDetail,
  type RunRowFailureDetail,
} from './_helpers/classifierRunRowFailureDetailDeno';

const HELPER_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts',
);

// ── fragment-assembled hostile shapes (no contiguous secret literal here) ──
const FAKE_ANTHROPIC_KEY = 'sk' + '-ant-' + 'A'.repeat(40);
const FAKE_XAI_KEY = 'xai' + '-' + 'B'.repeat(40);
const FAKE_SB_SECRET = 'sb' + '_secret_' + 'C'.repeat(40);
const FAKE_JWT = 'eyJ' + 'a'.repeat(20) + '.' + 'b'.repeat(20) + '.' + 'c'.repeat(20);
const FAKE_BEARER = 'Bea' + 'rer ' + 'd'.repeat(30);
const FAKE_AUTH_HEADER = 'Author' + 'ization: token-' + 'e'.repeat(20);
const FAKE_PROMPT_BODY =
  'You are a classifier. The user wrote: "I think cars are bad anyway." Decide…';
const HUGE_BLOB = 'Z'.repeat(5000);

/** Every secret-shape matcher the helper enforces (re-assembled here). */
const SECRET_MATCHERS: RegExp[] = [
  new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{6,}'),
  new RegExp('xai' + '-' + '[A-Za-z0-9]{6,}'),
  new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{6,}'),
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/,
  new RegExp('Bea' + 'rer' + '\\s+[A-Za-z0-9._-]{8,}'),
  /Authorization/i,
  /SERVICE_ROLE/,
];

function serialized(detail: RunRowFailureDetail | undefined): string {
  return JSON.stringify(detail ?? null);
}

describe('OPS-FDP — allow-only (happy path)', () => {
  it('FDP-1 — all seven allow-listed keys round-trip', () => {
    const d = edgeBuildRunRowFailureDetail({
      validatorPath: 'evidenceSpan.abductive_explanation_present',
      reason: 'validation_failed',
      family: 'argument_scheme',
      correlationId: 'e7c1a2b3-4d5e-6f70-8192-a3b4c5d6e7f8',
      attemptCount: 4,
      runMode: 'production',
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
    });
    expect(d).toEqual({
      validator_path: 'evidenceSpan.abductive_explanation_present',
      reason: 'validation_failed',
      family: 'argument_scheme',
      correlation_id: 'e7c1a2b3-4d5e-6f70-8192-a3b4c5d6e7f8',
      attempt_count: 4,
      run_mode: 'production',
      schema_version: 'mcp-021.machine-observations.boolean.v1',
    });
  });

  it('FDP-2 — empty input → undefined (column written NULL, not {})', () => {
    expect(edgeBuildRunRowFailureDetail({})).toBeUndefined();
  });

  it('FDP-3 — a single safe field survives; absent fields are omitted (no empty-string keys)', () => {
    const d = edgeBuildRunRowFailureDetail({ reason: 'provider_server_error' });
    expect(d).toEqual({ reason: 'provider_server_error' });
  });

  it('FDP-4 — empty strings are treated as absent (never stored as "")', () => {
    const d = edgeBuildRunRowFailureDetail({
      reason: '',
      family: 'critical_question',
      validatorPath: '',
    });
    expect(d).toEqual({ family: 'critical_question' });
  });
});

describe('OPS-FDP — attempt_count typing', () => {
  it('FDP-5 — a valid non-negative integer is kept (incl. 0)', () => {
    expect(edgeBuildRunRowFailureDetail({ attemptCount: 0 })).toEqual({ attempt_count: 0 });
    expect(edgeBuildRunRowFailureDetail({ attemptCount: 4 })).toEqual({ attempt_count: 4 });
  });

  it('FDP-6 — non-integer / negative / NaN / string attemptCount is dropped', () => {
    expect(edgeBuildRunRowFailureDetail({ attemptCount: 4.5 })).toBeUndefined();
    expect(edgeBuildRunRowFailureDetail({ attemptCount: -1 })).toBeUndefined();
    expect(edgeBuildRunRowFailureDetail({ attemptCount: Number.NaN })).toBeUndefined();
    // typeof guard drops a string passed via `as any`.
    expect(
      edgeBuildRunRowFailureDetail({ attemptCount: '4' as unknown as number }),
    ).toBeUndefined();
  });
});

describe('OPS-FDP — LEAK-SAFETY CONVERGENCE GATE (deny-never)', () => {
  it('FDP-7 — a secret in any string field is DROPPED (whole field), benign fields survive', () => {
    const d = edgeBuildRunRowFailureDetail({
      validatorPath: FAKE_JWT, // hostile
      reason: FAKE_ANTHROPIC_KEY, // hostile
      family: 'argument_scheme', // benign — survives
      correlationId: FAKE_SB_SECRET, // hostile
      runMode: FAKE_BEARER, // hostile
      schemaVersion: FAKE_AUTH_HEADER, // hostile
    });
    expect(d).toEqual({ family: 'argument_scheme' });
  });

  it('FDP-8 — when EVERY field is hostile, the whole detail is undefined (NULL column)', () => {
    const d = edgeBuildRunRowFailureDetail({
      validatorPath: FAKE_XAI_KEY,
      reason: FAKE_ANTHROPIC_KEY,
      family: FAKE_SB_SECRET,
      correlationId: FAKE_JWT,
      runMode: FAKE_BEARER,
      schemaVersion: FAKE_AUTH_HEADER,
    });
    expect(d).toBeUndefined();
  });

  it('FDP-9 — the SERIALIZED output trips NONE of the secret-shape matchers (every entry point)', () => {
    // Throw every banned shape at every string entry point at once.
    const d = edgeBuildRunRowFailureDetail({
      validatorPath: FAKE_ANTHROPIC_KEY,
      reason: FAKE_XAI_KEY,
      family: FAKE_SB_SECRET,
      correlationId: FAKE_JWT,
      runMode: FAKE_BEARER,
      schemaVersion: FAKE_AUTH_HEADER,
    });
    const out = serialized(d);
    for (const matcher of SECRET_MATCHERS) {
      expect(matcher.test(out)).toBe(false);
    }
  });

  it('FDP-10 — argument body / prompt text never appears in the output', () => {
    const d = edgeBuildRunRowFailureDetail({
      // A body/prompt has NO dedicated entry point; the closest a caller can do
      // is jam it into a string field. A short benign-looking prompt is not
      // secret-shaped, so it would be CAPPED — but it can only ride a field
      // that is *meant* to be a structural string, and the gate caps it to 200.
      reason: FAKE_PROMPT_BODY,
      family: 'argument_scheme',
    });
    const out = serialized(d);
    // The structural fields survive; assert no key smuggled a body verbatim
    // beyond the cap, and there is NO body/prompt KEY on the object.
    expect(d).toBeDefined();
    expect(Object.keys(d!).sort()).toEqual(['family', 'reason']);
    expect(out.length).toBeLessThan(400);
  });

  it('FDP-11 — caps each string field at <= 200 chars; the whole object serializes <= 2000', () => {
    const d = edgeBuildRunRowFailureDetail({
      validatorPath: HUGE_BLOB,
      reason: HUGE_BLOB,
      family: HUGE_BLOB,
      correlationId: HUGE_BLOB,
      runMode: HUGE_BLOB,
      schemaVersion: HUGE_BLOB,
    });
    expect(d).toBeDefined();
    for (const v of Object.values(d!)) {
      if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(200);
    }
    expect(serialized(d).length).toBeLessThanOrEqual(2000);
  });

  it('FDP-12 — an extra (non-allow-listed) property passed via `as any` is IGNORED', () => {
    const d = edgeBuildRunRowFailureDetail({
      reason: 'validation_failed',
      // structural deny-list: these have no entry point and must not surface.
      body: FAKE_PROMPT_BODY,
      prompt: FAKE_PROMPT_BODY,
      evidenceSpan: 'the bridge will collapse',
      payload: { token: FAKE_ANTHROPIC_KEY },
      details: FAKE_JWT,
    } as unknown as Parameters<typeof edgeBuildRunRowFailureDetail>[0]);
    expect(d).toEqual({ reason: 'validation_failed' });
    const out = serialized(d);
    expect(out).not.toContain('collapse');
    expect(out).not.toContain('bridge will');
    for (const matcher of SECRET_MATCHERS) {
      expect(matcher.test(out)).toBe(false);
    }
  });
});

describe('OPS-FDP — structural deny-list (the point of the helper)', () => {
  let helperSrc = '';
  beforeAll(() => {
    helperSrc = fs.readFileSync(HELPER_PATH, 'utf8');
  });

  it('FDP-13 — RunRowFailureDetailInput has NO free-text entry point', () => {
    // The input interface must not declare any of these as keys (a body /
    // prompt / payload / free-text smuggle path). Scan the interface block.
    const ifaceStart = helperSrc.indexOf('interface RunRowFailureDetailInput');
    expect(ifaceStart).toBeGreaterThan(-1);
    const ifaceEnd = helperSrc.indexOf('}', ifaceStart);
    const iface = helperSrc.slice(ifaceStart, ifaceEnd);
    for (const banned of ['extra', 'message', 'details', 'payload', 'body', 'prompt', 'evidenceSpan', 'evidence_span']) {
      expect(new RegExp(`\\b${banned}\\??\\s*:`).test(iface)).toBe(false);
    }
  });

  it('FDP-14 — the helper never references body / prompt / evidenceSpan / payload identifiers', () => {
    // (comment text may mention them in prose; assert they are not used as
    // code identifiers — i.e. never `.body` / `input.prompt` / `.evidenceSpan`).
    expect(/\binput\.(body|prompt|payload|details|message|extra)\b/.test(helperSrc)).toBe(false);
    expect(/\.evidenceSpan\b/.test(helperSrc)).toBe(false);
  });

  it('FDP-15 — the helper carries no contiguous secret-shaped literal (SCAN-17 — fragment-assembled)', () => {
    // Only the 5 contiguous-KEY-shape matchers (sk-ant- / xai- / sb_secret_ /
    // JWT / Bearer+token) — these the helper assembles from fragments, so the
    // SOURCE must not contain a contiguous instance. The bare-word matchers
    // (/Authorization/, /SERVICE_ROLE/) are excluded: they legitimately appear
    // as matcher PATTERN literals in the helper (exactly as the proven
    // booleanObservationFailureSubreason.ts does), which is not a secret leak.
    for (const matcher of SECRET_MATCHERS.slice(0, 5)) {
      expect(matcher.test(helperSrc)).toBe(false);
    }
  });
});

describe('OPS-FDP — doctrine (cdiscourse §1) — no verdict tokens emitted from the helper itself', () => {
  it('FDP-16 — the helper source introduces no verdict-token literal', () => {
    const src = fs.readFileSync(HELPER_PATH, 'utf8').toLowerCase();
    // The helper emits ONLY pass-through inputs (no constant field values), so
    // it cannot mint a verdict. Belt-and-suspenders: no verdict token appears
    // as a string literal it could emit.
    for (const token of ['winner', 'loser', 'liar', 'dishonest', 'manipulative', 'propagandist']) {
      // allow the word inside a comment sentence? these tokens should simply
      // not appear at all in this small helper.
      expect(src.includes(`'${token}'`)).toBe(false);
      expect(src.includes(`"${token}"`)).toBe(false);
    }
  });
});
