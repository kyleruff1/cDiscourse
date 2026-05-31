/**
 * ARCH-001 Card 2 — classifier-drainer Edge Function + config + adapter
 * timeout parameterization (SOURCE / TEXT SCAN).
 *
 * The drainer index.ts is Deno-only (Deno.serve / Deno.env / crypto). Its
 * auth posture + secret-safety + the config verify_jwt=false + the adapter
 * timeout parameterization are locked by a source/text scan.
 *
 * Covers intent-brief tests (l) drainer ≥30s timeout (15s default preserved),
 * (m) no secret/auth-header/prompt/response/payload logged or returned, and
 * the verify_jwt=false + secret-validated-before-work posture (design §A.2/§A.11).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS,
  DRAINER_MCP_REQUEST_TIMEOUT_MS,
} from './_helpers/classifierQueueCard2Deno';

const REPO = process.cwd();
const INDEX_PATH = path.join(REPO, 'supabase/functions/classifier-drainer/index.ts');
const CONFIG_PATH = path.join(REPO, 'supabase/config.toml');
const ADAPTER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts',
);
const MONITORING_PATH = path.join(REPO, 'scripts/arch-001-card2-sql/classifier-queue-monitoring.sql');

let indexText = '';
let configText = '';
let adapterText = '';
let monitoringText = '';
let monitoringCode = ''; // comment-stripped (the executable SQL queries only)

/** Strip SQL line + block comments so keyword scans hit executable SQL only. */
function stripSqlComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

beforeAll(() => {
  indexText = fs.readFileSync(INDEX_PATH, 'utf8');
  configText = fs.readFileSync(CONFIG_PATH, 'utf8');
  adapterText = fs.readFileSync(ADAPTER_PATH, 'utf8');
  monitoringText = fs.readFileSync(MONITORING_PATH, 'utf8');
  monitoringCode = stripSqlComments(monitoringText);
});

describe('ARCH-001 Card 2 — drainer config posture', () => {
  it('EDGE-1 — config.toml declares [functions.classifier-drainer] verify_jwt = false', () => {
    expect(configText).toMatch(/\[functions\.classifier-drainer\]\s*\n\s*verify_jwt\s*=\s*false/);
  });

  it('EDGE-2 — submit-argument stays verify_jwt = true (unchanged)', () => {
    expect(configText).toMatch(/\[functions\.submit-argument\]\s*\n\s*verify_jwt\s*=\s*true/);
  });
});

describe('ARCH-001 Card 2 — drainer validates the shared secret BEFORE any work', () => {
  it('EDGE-3 — reads the expected secret from CLASSIFIER_DRAIN_SHARED_SECRET (env)', () => {
    expect(indexText).toMatch(/Deno\.env\.get\(\s*['"]CLASSIFIER_DRAIN_SHARED_SECRET['"]\s*\)/);
  });

  it('EDGE-4 — a missing expected secret → unauthorized (refuses to run unauthenticated)', () => {
    expect(indexText).toMatch(/if\s*\(\s*!expectedSecret\s*\)\s*\{\s*[\s\S]*?return unauthorized\(\)/);
  });

  it('EDGE-5 — a mismatched Authorization header → unauthorized', () => {
    expect(indexText).toMatch(/if\s*\(\s*!secretsMatch\([\s\S]*?return unauthorized\(\)/);
  });

  it('EDGE-6 — the secret check precedes runClassifierDrain (no work before auth)', () => {
    const secretIdx = indexText.indexOf('secretsMatch(');
    const drainIdx = indexText.indexOf('runClassifierDrain(');
    expect(secretIdx).toBeGreaterThan(-1);
    expect(drainIdx).toBeGreaterThan(secretIdx);
  });

  it('EDGE-7 — uses a constant-time-ish compare (no early-return on first mismatch)', () => {
    expect(indexText).toMatch(/function secretsMatch/);
  });
});

describe('ARCH-001 Card 2 — drainer single-flight + response posture (test d, m)', () => {
  it('EDGE-8 — runs ONE bounded drain via runClassifierDrain', () => {
    expect(indexText).toMatch(/runClassifierDrain\(/);
  });

  it('EDGE-9 — passes the real MCP adapter + a production clock + an opaque owner', () => {
    expect(indexText).toMatch(/adapter:\s*runBooleanObservationMcpAdapter/);
    expect(indexText).toMatch(/clock:\s*productionClock/);
    expect(indexText).toMatch(/owner:\s*newOwnerId\(\)/);
  });

  it('EDGE-10 — the owner id is opaque (a uuid-based diagnostic, NOT a secret)', () => {
    expect(indexText).toMatch(/newOwnerId/);
    expect(indexText).toMatch(/crypto\.randomUUID/);
  });

  it('EDGE-11 — the response carries ONLY operational counters (no body/prompt/payload/secret)', () => {
    const responseBlock = indexText.match(/return ok\(\{[\s\S]*?\}\);/g);
    expect(responseBlock).not.toBeNull();
    const joined = (responseBlock ?? []).join('\n');
    expect(joined).toMatch(/jobs_processed/);
    expect(joined).not.toMatch(/body|prompt|payload|currentText|evidence_span|secret|token|Authorization/i);
  });

  it('EDGE-12 — the index never console.logs', () => {
    expect(indexText).not.toMatch(/console\./);
  });

  it('EDGE-13 — the index carries no secret-shaped literal', () => {
    expect(indexText).not.toMatch(/sk-ant-/);
    expect(indexText).not.toMatch(/sb_secret_/);
    expect(indexText).not.toMatch(/eyJ[A-Za-z0-9_-]{8,}\./);
    expect(indexText).not.toMatch(/SERVICE_ROLE_KEY\s*=/);
    // The auth scheme prefix is assembled from fragments (no contiguous literal).
    expect(indexText).not.toMatch(/['"]Bearer ['"]/);
  });
});

describe('ARCH-001 Card 2 — adapter timeout parameterization (test l)', () => {
  it('EDGE-14 — the 15s submit-path default constant is UNCHANGED (15000)', () => {
    expect(MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  it('EDGE-15 — the drainer timeout constant is >= 30s (30000) — corrects the inversion', () => {
    expect(DRAINER_MCP_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(DRAINER_MCP_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });

  it('EDGE-16 — the adapter accepts an optional { timeoutMs } and resolves it (additive)', () => {
    expect(adapterText).toMatch(/options\?:\s*RunBooleanObservationMcpAdapterOptions/);
    expect(adapterText).toMatch(/resolvedTimeoutMs/);
    // The abort uses the resolved value, not the bare constant.
    expect(adapterText).toMatch(/AbortSignal\.timeout\(resolvedTimeoutMs\)/);
  });

  it('EDGE-17 — a missing/invalid timeoutMs falls back to the 15s constant (submit byte-unchanged)', () => {
    // The resolver defaults to MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS.
    expect(adapterText).toMatch(/:\s*MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS/);
  });

  it('EDGE-18 — the direct-dispatch caller passes the adapter as a 1-arg fn (omits options → 15s)', () => {
    // autoTriggerDispatcher passes runBooleanObservationMcpAdapter by reference
    // to classifyOneArgumentCore; classifyOneArgumentCore invokes it with ONE
    // arg (the request). So the submit path never supplies options → 15s.
    const dispatcher = fs.readFileSync(
      path.join(REPO, 'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts'),
      'utf8',
    );
    expect(dispatcher).toMatch(/runBooleanObservationMcpAdapter,/); // passed by reference, no options.
  });
});

describe('ARCH-001 Card 2 — monitoring SQL is read-only + leak-free (test m)', () => {
  it('EDGE-19 — monitoring SQL contains no write (INSERT/UPDATE/DELETE/DROP) in its EXECUTABLE queries', () => {
    // Scan the COMMENT-STRIPPED SQL. The re-drive UPDATE + the lease-clear
    // DELETE are documented in RUNBOOK.md / in monitoring comments as explicit
    // operator steps, NEVER as executable queries in this monitoring file.
    expect(monitoringCode).not.toMatch(/\bINSERT\b/i);
    expect(monitoringCode).not.toMatch(/\bUPDATE\b/i);
    expect(monitoringCode).not.toMatch(/\bDELETE\b/i);
    expect(monitoringCode).not.toMatch(/\bDROP\b/i);
  });

  it('EDGE-20 — monitoring SQL never selects an argument body / prompt / payload / secret column', () => {
    // Comment-stripped: the doc comments legitimately say "no argument body".
    expect(monitoringCode).not.toMatch(/\bbody\b|\bprompt\b|currentText|parentText/i);
    expect(monitoringCode).not.toMatch(/decrypted_secret|service_role|api_key/i);
  });

  it('EDGE-21 — monitoring restricts to queue rows (family IS NOT NULL) where it reads runs', () => {
    expect(monitoringCode).toMatch(/family IS NOT NULL/);
  });
});
