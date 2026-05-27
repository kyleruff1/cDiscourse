/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Security boundary tests.
 *
 * Per design §8 + §11.2 / cdiscourse-doctrine §6 + §7:
 *   - No client (`src/` + `app/`) imports the auto-trigger dispatcher
 *     or the classifier core.
 *   - No client-side `EXPO_PUBLIC_*` MCP credential surface.
 *   - No `createServiceClient` call inside the dispatcher (service
 *     client is passed in from submit-argument).
 *   - No `console.log` outside the dedicated structured-log helper.
 *   - No raw body / prompt / model response / bearer / authorization
 *     in any log emit.
 *   - No doctrine-banned tokens in dispatcher source.
 *   - No `requireAdmin` call inside the dispatcher (admin gate is on
 *     the existing HTTP endpoint only).
 *
 * Forecast: ~18 tests (SEC-1 through SEC-18).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const LOG_HELPER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerLog.ts',
);
const PERSISTENCE_QUERY_PATH = path.join(
  REPO,
  'src/features/nodeLabels/machineObservationPersistenceQuery.ts',
);
const CONFIG_TOML_PATH = path.join(REPO, 'supabase/config.toml');

let dispatcherText = '';
let coreText = '';
let logHelperText = '';
let persistenceQueryText = '';
let configTomlText = '';

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_CLIENT_FILES = [
  ...collectSourceFiles(path.join(REPO, 'src')),
  ...collectSourceFiles(path.join(REPO, 'app')),
];

beforeAll(() => {
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  logHelperText = fs.readFileSync(LOG_HELPER_PATH, 'utf8');
  persistenceQueryText = fs.readFileSync(PERSISTENCE_QUERY_PATH, 'utf8');
  configTomlText = fs.readFileSync(CONFIG_TOML_PATH, 'utf8');
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — no client boundary leak', () => {
  it('SEC-1 — no client (`src/` or `app/`) imports autoTriggerDispatcher', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('autoTriggerDispatcher'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-2 — no client imports classifyArgumentCore', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('classifyArgumentCore'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — service-role discipline', () => {
  it('SEC-3 — dispatcher does NOT call createServiceClient (service client is passed in)', () => {
    expect(dispatcherText).not.toMatch(/createServiceClient\s*\(/);
  });

  it('SEC-4 — classifyArgumentCore does not unexpectedly read SERVICE_ROLE env directly', () => {
    // The core receives the serviceClient as a parameter; the only
    // env reads in the booleanObservations tree are within the
    // adapter / supabaseClients factory. The core file must not call
    // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') directly.
    expect(coreText).not.toMatch(
      /Deno\.env\.get\(\s*['"]SUPABASE_SERVICE_ROLE_KEY['"]\s*\)/,
    );
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — no console.log noise', () => {
  it('SEC-5 — no console.log in dispatcher source (only structured-log helper)', () => {
    // The dispatcher imports `emitAutoTriggerLog` (which uses
    // console.info). The dispatcher source itself must not contain
    // any `console.log(...)` calls.
    expect(dispatcherText).not.toMatch(/console\.log\s*\(/);
    expect(dispatcherText).toContain('emitAutoTriggerLog');
  });

  it('SEC-6 — doctrine ban-list scan over dispatcher source', () => {
    const lower = dispatcherText.toLowerCase();
    const banned = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'bad faith',
      'manipulative',
      'extremist',
      'propagandist',
      'fallacy',
      'proof of',
      'truth value',
    ];
    for (const term of banned) {
      // Test that the term does not appear in the dispatcher source.
      // Comments referring to doctrine compliance may mention the term
      // in negation — but for this dispatcher, all such comments use
      // generic phrasing (per design §8.6 doctrine compliance).
      expect(lower.includes(term)).toBe(false);
    }
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — log emit is sanitized', () => {
  it('SEC-7 — log helper does NOT carry raw body / currentText / parentText', () => {
    expect(logHelperText).not.toMatch(/body\s*:/);
    expect(logHelperText).not.toMatch(/currentText\s*:/);
    expect(logHelperText).not.toMatch(/parentText\s*:/);
  });

  it('SEC-8 — log helper field set matches intent brief Decision 9', () => {
    // The interface declares: timestamp, argument_id, trigger_source,
    // outcome, optional skip_reason / run_id / failure_reason /
    // attempt_number / latency_ms.
    expect(logHelperText).toContain('timestamp:');
    expect(logHelperText).toContain('argument_id:');
    expect(logHelperText).toContain('trigger_source:');
    expect(logHelperText).toContain('outcome:');
    expect(logHelperText).toContain('skip_reason?:');
    expect(logHelperText).toContain('run_id?:');
    expect(logHelperText).toContain('failure_reason?:');
    expect(logHelperText).toContain('attempt_number?:');
    expect(logHelperText).toContain('latency_ms?:');
  });

  it('SEC-9 — log helper has no bearer / authorization / service-role / Anthropic key field', () => {
    // The log emit is a `console.info(JSON.stringify(...))` of a
    // typed AutoTriggerLogFields object. Tokens may appear in
    // doctrine-compliance comments, but no FIELD or CALL must
    // reference these names. Strip comments and re-check.
    const codeOnly = logHelperText
      // strip /* ... */ block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // strip // single-line comments
      .replace(/\/\/[^\n]*/g, '');
    expect(codeOnly).not.toMatch(/[Bb]earer/);
    expect(codeOnly).not.toMatch(/[Aa]uthorization/);
    expect(codeOnly).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(codeOnly).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(codeOnly).not.toMatch(/MCP_TOKEN/);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — no EXPO_PUBLIC / no AI SDK import', () => {
  it('SEC-10 — no EXPO_PUBLIC_ in dispatcher source', () => {
    expect(dispatcherText).not.toContain('EXPO_PUBLIC_');
  });

  it('SEC-11 — no @anthropic-ai/sdk import in dispatcher source', () => {
    expect(dispatcherText).not.toContain('@anthropic-ai/sdk');
    expect(dispatcherText).not.toMatch(/npm:@?anthropic/i);
  });

  it('SEC-12 — no direct fetch to Anthropic / xAI / X API in dispatcher source', () => {
    // The MCP adapter handles the fetch. The dispatcher must not
    // reference Anthropic / xAI / X API URLs.
    expect(dispatcherText).not.toMatch(/api\.anthropic\.com/);
    expect(dispatcherText).not.toMatch(/api\.x\.ai/);
    expect(dispatcherText).not.toMatch(/api\.twitter\.com/);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — RLS / read-only boundary preserved', () => {
  it('SEC-13 — dispatcher does NOT contain CREATE POLICY / DROP POLICY (no SQL)', () => {
    expect(dispatcherText).not.toMatch(/CREATE\s+POLICY/i);
    expect(dispatcherText).not.toMatch(/DROP\s+POLICY/i);
  });

  it('SEC-14 — machineObservationPersistenceQuery.ts:127 is byte-equal preserved', () => {
    // The Source 6 production filter is the load-bearing line for
    // admin_validation exclusion. Byte-equal against the committed
    // value.
    const lines = persistenceQueryText.split('\n');
    expect(lines[126]).toBe(
      "    .eq('argument_machine_observation_runs.run_mode', 'production');",
    );
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — submit-argument auth chain preserved', () => {
  it('SEC-15 — submit-argument still calls callerClient.auth.getUser() before the dispatch', () => {
    // The dispatcher's call site is below all auth checks in the
    // submit-argument handler.
    const submitText = fs.readFileSync(
      path.join(REPO, 'supabase/functions/submit-argument/index.ts'),
      'utf8',
    );
    const authIdx = submitText.indexOf('callerClient.auth.getUser()');
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    expect(authIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(authIdx);
  });

  it('SEC-16 — submit-argument config.toml block keeps verify_jwt = true', () => {
    // The auto-trigger inherits submit-argument's JWT-verified isolate.
    // The config.toml entry for submit-argument keeps verify_jwt = true.
    expect(configTomlText).toContain('[functions.submit-argument]');
    const block = configTomlText.split('[functions.submit-argument]')[1].split('\n[functions.')[0];
    expect(block).toContain('verify_jwt = true');
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — no admin gate widening', () => {
  it('SEC-17 — dispatcher does NOT call requireAdmin (admin gate is on the HTTP endpoint only)', () => {
    expect(dispatcherText).not.toMatch(/requireAdmin\s*\(/);
  });

  it('SEC-18 — Observation kind preserved (Machine Observations, not user Allegations)', () => {
    // Per cdiscourse-doctrine §10a, every row this dispatcher writes
    // carries Machine Observation semantics. The classifier core
    // imports the MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY registry
    // and uses it to validate rawKeys before writing — no Allegation
    // path is invoked.
    expect(coreText).toContain('MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY');
    // The dispatcher does not import the userAllegation registry.
    expect(dispatcherText).not.toContain('userAllegation');
  });
});
