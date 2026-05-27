/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Family A auto-trigger dispatcher
 * source-scan + structure tests.
 *
 * The auto-trigger dispatcher fires on a new argument insert in
 * `submit-argument` (post-insert, pre-return). These tests source-scan
 * the wiring + dispatcher source to verify the design contract from
 * `docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A.md` §2 / §3 / §11.
 *
 * The dispatcher and the classifier core are Deno-only modules; Jest
 * cannot load them. Coverage is via source-text assertions against the
 * binding patterns, mirroring the established
 * `mcpOneTwoOneCEdgeFunctionHandler.test.ts` pattern.
 *
 * Forecast: ~25 tests (TRG-1 through TRG-25).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const CLASSIFIER_PATH = path.join(
  REPO,
  'supabase/functions/classify-argument-boolean-observations/index.ts',
);

let submitText = '';
let dispatcherText = '';
let coreText = '';
let classifierText = '';

beforeAll(() => {
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  classifierText = fs.readFileSync(CLASSIFIER_PATH, 'utf8');
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — wiring in submit-argument', () => {
  it('TRG-1 — submit-argument imports dispatchAutoTriggerForArgument from the shared dispatcher', () => {
    expect(
      /import\s+\{[\s\S]*?dispatchAutoTriggerForArgument[\s\S]*?\}\s+from\s+['"]\.\.\/_shared\/booleanObservations\/autoTriggerDispatcher\.ts['"]/.test(
        submitText,
      ),
    ).toBe(true);
  });

  it('TRG-2 — the import statement is at the top-of-file import block (eager)', () => {
    // The first 200 lines must contain the import. (The file has a
    // ~770-line handler body; the import block lives in the first 80
    // lines.)
    const head = submitText.split('\n').slice(0, 200).join('\n');
    expect(head).toContain('dispatchAutoTriggerForArgument');
  });

  it('TRG-3 — exactly one call to dispatchAutoTriggerForArgument(...) in submit-argument', () => {
    const matches = submitText.match(/dispatchAutoTriggerForArgument\s*\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('TRG-4 — dispatcher call site is AFTER the QOL-040 notification block', () => {
    const notifyIdx = submitText.indexOf('submit_argument_notification_failed');
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    expect(notifyIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(notifyIdx);
  });

  it('TRG-5 — dispatcher call site is BEFORE the final return created(...) call', () => {
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    const returnIdx = submitText.lastIndexOf('return created(');
    expect(dispatchIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(dispatchIdx);
  });

  it('TRG-6 — dispatcher call is NOT inside the client_submission_id replay branch', () => {
    // The replay branch ends with `return ok({ ... idempotent: true });`.
    // The dispatcher call must appear AFTER that branch's closing.
    const replayReturnIdx = submitText.indexOf('idempotent: true');
    const dispatchIdx = submitText.indexOf('dispatchAutoTriggerForArgument(');
    expect(replayReturnIdx).toBeGreaterThan(-1);
    expect(dispatchIdx).toBeGreaterThan(replayReturnIdx);
  });

  it('TRG-7 — dispatcher promise is NOT awaited at the call site (fire-and-forget)', () => {
    expect(/await\s+dispatchAutoTriggerForArgument\s*\(/.test(submitText)).toBe(false);
  });

  it('TRG-8 — call site uses EdgeRuntime.waitUntil for background-task lifetime', () => {
    expect(submitText).toContain('EdgeRuntime');
    expect(submitText).toContain('waitUntil');
  });

  it('TRG-9 — dispatcher receives (insertedArg.id, data.debate_id, serviceClient) — no extras', () => {
    // Whitespace + newline-tolerant: the call site may use multiline
    // formatting for readability.
    const match = submitText.match(
      /dispatchAutoTriggerForArgument\s*\(\s*insertedArg\.id\s*,\s*data\.debate_id\s*,\s*serviceClient\s*,?\s*\)/,
    );
    expect(match).not.toBeNull();
  });

  it('TRG-10 — dispatcher promise has a .catch(...) so unhandled rejection cannot escape', () => {
    expect(/dispatchAutoTriggerForArgument\([^)]+\)\s*\.catch\s*\(/.test(submitText)).toBe(true);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — dispatcher source contract', () => {
  it('TRG-11 — dispatcher hard-codes requestedFamilies = [\'parent_relation\'] (no external input)', () => {
    expect(dispatcherText).toContain("'parent_relation'");
  });

  it('TRG-12 — dispatcher hard-codes mode = \'production\' (literal, not computed)', () => {
    expect(dispatcherText).toMatch(/AUTO_TRIGGER_MODE\s*=\s*['"]production['"]/);
  });

  it('TRG-13 — dispatcher imports MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION (not re-declared)', () => {
    expect(
      /import\s+\{[\s\S]*?MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION[\s\S]*?\}\s+from\s+['"]\.\/mcpBooleanObservationSchema\.ts['"]/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });

  it('TRG-14 — classifyArgumentCore exports classifyOneArgumentCore with the same signature shape', () => {
    expect(coreText).toContain('export async function classifyOneArgumentCore');
    // Same arity (argumentId, requestedFamilies, mode, serviceClient, adapter).
    expect(/classifyOneArgumentCore\s*\(\s*\n?\s*argumentId/.test(coreText)).toBe(true);
  });

  it('TRG-15 — classifyArgumentCore imports from the established shared modules (no new deps)', () => {
    expect(coreText).toContain("from './booleanObservationMcpAdapterCore.ts'");
    expect(coreText).toContain("from './mcpBooleanObservationSchema.ts'");
    expect(coreText).toContain("from './familyRegistry.ts'");
    expect(coreText).toContain("from './booleanObservationRequestBuilder.ts'");
    expect(coreText).toContain("from './persistenceWriter.ts'");
    expect(coreText).toContain("from './machineObservationDefinitions.ts'");
  });

  it('TRG-16 — classify-argument-boolean-observations handler continues to call classifyOneArgumentCore', () => {
    expect(classifierText).toContain('classifyOneArgumentCore');
    // The handler wraps it under the existing classifyOneArgument name.
    expect(/const\s+classifyOneArgument\s*=\s*classifyOneArgumentCore/.test(classifierText)).toBe(true);
  });

  it('TRG-17 — classifier Edge Function handler retains the requireAdmin gate', () => {
    expect(/await\s+requireAdmin\s*\(\s*req\s*\)/.test(classifierText)).toBe(true);
  });

  it('TRG-18 — dispatcher source mentions \'parent_relation\' as a literal (the only family string)', () => {
    // The literal appears in AUTO_TRIGGER_FAMILIES + in the idempotency
    // pre-check's .contains(...) array argument.
    const matches = dispatcherText.match(/'parent_relation'/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // No OTHER family literal should appear.
    expect(dispatcherText).not.toContain("'disagreement_axis'");
    expect(dispatcherText).not.toContain("'misunderstanding_repair'");
    expect(dispatcherText).not.toContain("'evidence_source_chain'");
    expect(dispatcherText).not.toContain("'argument_scheme'");
    expect(dispatcherText).not.toContain("'critical_question'");
    expect(dispatcherText).not.toContain("'resolution_progress'");
    expect(dispatcherText).not.toContain("'claim_clarity'");
    expect(dispatcherText).not.toContain("'thread_topology'");
    expect(dispatcherText).not.toContain("'sensitive_composer'");
  });

  it('TRG-19 — dispatcher calls classifyOneArgumentCore with the binding payload', () => {
    // (argumentId, AUTO_TRIGGER_FAMILIES, AUTO_TRIGGER_MODE, serviceClient, adapter)
    expect(dispatcherText).toContain('classifyOneArgumentCore(');
    expect(dispatcherText).toContain('AUTO_TRIGGER_FAMILIES');
    expect(dispatcherText).toContain('AUTO_TRIGGER_MODE');
    expect(dispatcherText).toContain('runBooleanObservationMcpAdapter');
  });

  it('TRG-20 — doctrine ban-list scan: no verdict / winner / loser language in the dispatcher source', () => {
    const lower = dispatcherText.toLowerCase();
    const banned = [
      'winner', 'loser', 'liar', 'dishonest',
      'bad faith', 'manipulative', 'extremist', 'propagandist',
      'fallacy', 'proof of', 'truth value',
    ];
    for (const term of banned) {
      expect(lower.includes(term)).toBe(false);
    }
  });

  it('TRG-21 — no raw classifier raw_key surfaced in dispatcher log emissions', () => {
    // The log emit must not include raw_key as a user-readable field.
    // Source pattern: no `raw_key:` appears in the log call.
    expect(/console\.\w+\([^)]*raw_key/.test(dispatcherText)).toBe(false);
  });

  it('TRG-22 — no EXPO_PUBLIC_ in dispatcher source', () => {
    expect(dispatcherText).not.toContain('EXPO_PUBLIC_');
  });

  it('TRG-23 — dispatcher does NOT import any AI-provider SDK directly', () => {
    expect(dispatcherText).not.toContain('@anthropic-ai/sdk');
    expect(dispatcherText).not.toMatch(/npm:[^'"]*anthropic/);
    expect(dispatcherText).not.toMatch(/npm:[^'"]*openai/);
  });

  it('TRG-24 — AutoTriggerOutcome type discriminator covers triggered/skipped/already_classified/failed', () => {
    const outcomeBlock = dispatcherText.match(/interface\s+AutoTriggerOutcome\s*\{[\s\S]*?\n\}/);
    expect(outcomeBlock).not.toBeNull();
    const block = outcomeBlock![0];
    expect(block).toContain("'triggered'");
    expect(block).toContain("'skipped'");
    expect(block).toContain("'already_classified'");
    expect(block).toContain("'failed'");
  });

  it('TRG-25 — no console.log calls in dispatcher source (only the structured-log helper)', () => {
    // The dispatcher imports emitAutoTriggerLog; the helper is the only
    // place a console call is allowed.
    expect(dispatcherText).not.toMatch(/console\.log\s*\(/);
    // The structured-log helper uses console.info specifically (visible
    // in Edge logs; never bare console.log).
    expect(dispatcherText).toContain('emitAutoTriggerLog');
  });
});
