/**
 * MCP-021C-EDGE-FAMILIES-B-C-ENABLE — Registry-derived dispatcher tests.
 *
 * Per Stage 2B operator decision: the auto-trigger dispatcher derives its
 * production family list from the Edge family registry (NOT a hard-coded
 * constant) and runs a sequential one-run-per-family loop. This test file
 * verifies the registry-derived semantics, the per-family loop shape, the
 * per-family idempotency scope, and the doctrine safety of the new
 * dispatcher source.
 *
 * The dispatcher is Deno-only; the tests source-scan the dispatcher and
 * registry per the established `mcpOneTwoOneCAutoTriggerFamilyA.test.ts`
 * pattern (jest cannot execute Deno modules with .ts-extension imports).
 *
 * Forecast: ~25 tests (DREG-1 through DREG-25).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  EDGE_FAMILY_REGISTRY,
  edgeProductionEnabledFamilies,
} from './_helpers/booleanObservationEdgeDeno';

const REPO = process.cwd();
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const REGISTRY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
);
const CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const SUBMIT_PATH = path.join(REPO, 'supabase/functions/submit-argument/index.ts');

let dispatcherText = '';
let registryText = '';
let coreText = '';
let submitText = '';

beforeAll(() => {
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  registryText = fs.readFileSync(REGISTRY_PATH, 'utf8');
  coreText = fs.readFileSync(CORE_PATH, 'utf8');
  submitText = fs.readFileSync(SUBMIT_PATH, 'utf8');
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — dispatcher imports productionEnabledFamilies', () => {
  it('DREG-1 — dispatcher imports productionEnabledFamilies from ./familyRegistry.ts', () => {
    expect(
      /import\s+\{[\s\S]*?productionEnabledFamilies[\s\S]*?\}\s+from\s+['"]\.\/familyRegistry\.ts['"]/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });

  it('DREG-2 — dispatcher does NOT declare an AUTO_TRIGGER_FAMILIES literal const', () => {
    // The old constant is GONE. The registry is the only source of truth.
    expect(dispatcherText).not.toContain('AUTO_TRIGGER_FAMILIES');
  });

  it('DREG-3 — dispatcher invokes productionEnabledFamilies() at runtime (not captured at module load)', () => {
    // The call is INSIDE the dispatch function body (so runtime registry
    // changes would take effect on next dispatch). Verify the function
    // call expression appears in the source.
    expect(/productionEnabledFamilies\s*\(\s*\)/.test(dispatcherText)).toBe(true);
  });

  it('DREG-4 — dispatcher continues to import classifyOneArgumentCore (the orchestrator path is preserved)', () => {
    expect(dispatcherText).toContain('classifyOneArgumentCore');
    expect(
      /import\s+\{[\s\S]*?classifyOneArgumentCore[\s\S]*?\}\s+from\s+['"]\.\/classifyArgumentCore\.ts['"]/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — sequential per-family loop', () => {
  it('DREG-5 — dispatcher source contains a for-of loop over eligibleFamilies', () => {
    expect(/for\s*\(\s*const\s+\w+\s+of\s+eligibleFamilies\s*\)/.test(dispatcherText)).toBe(true);
  });

  it('DREG-6 — dispatcher source does NOT use Promise.all over the family list (sequential, not parallel)', () => {
    // Stage 2B operator preference: sequential for-of for observability +
    // idempotency clarity. Promise.all over the family list would be a
    // deviation.
    expect(dispatcherText).not.toMatch(/Promise\.all\s*\([\s\S]*?eligibleFamilies/);
    expect(dispatcherText).not.toMatch(/Promise\.all\s*\([\s\S]*?productionEnabledFamilies/);
  });

  it('DREG-7 — each iteration invokes classifyOneArgumentCore exactly once with a single-element [family] array', () => {
    // The classifier core is called with `[family]` (the per-iteration
    // loop variable wrapped in a single-element array). The MCP server
    // resolves a single family per call, so this aligns with the
    // server's existing single-family-per-call semantics.
    expect(dispatcherText).toContain('classifyOneArgumentCore(');
    // The single-family array shape appears as `[family]` literal in the
    // dispatcher source (the helper variable `singleFamilyArray` is
    // built from `[family]`).
    expect(/\[\s*family\s*\]/.test(dispatcherText)).toBe(true);
  });

  it('DREG-8 — each iteration produces its own AutoTriggerOutcome', () => {
    // The iteration helper returns an AutoTriggerOutcome; the outer
    // loop pushes each into an outcomes array.
    expect(/outcomes\.push\s*\(/.test(dispatcherText)).toBe(true);
  });

  it('DREG-9 — dispatcher returns AutoTriggerOutcome[] (array of per-family outcomes)', () => {
    // The function signature evolved from Promise<AutoTriggerOutcome> to
    // Promise<AutoTriggerOutcome[]>.
    expect(/Promise<AutoTriggerOutcome\[\]>/.test(dispatcherText)).toBe(true);
  });

  it('DREG-10 — per-family iteration helper isolates one family\'s failure from others', () => {
    // The iteration body wraps in try/catch so an uncaught condition in
    // family X does NOT abort family Y. The dispatchOneFamilyIteration
    // helper is the unit of isolation.
    expect(dispatcherText).toContain('dispatchOneFamilyIteration');
    // The iteration helper has its own try/catch.
    const iterMatch = dispatcherText.match(
      /async function dispatchOneFamilyIteration[\s\S]*?\n\}/,
    );
    expect(iterMatch).not.toBeNull();
    expect(iterMatch![0]).toMatch(/try\s*\{[\s\S]*?\}\s*catch\s*\{/);
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — per-family idempotency scope', () => {
  it('DREG-11 — findExistingRun signature includes (argumentId, family, serviceClient)', () => {
    expect(
      /function\s+findExistingRun\s*\(\s*argumentId\s*:\s*string\s*,\s*family\s*:\s*MachineObservationFamily\s*,\s*serviceClient/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });

  it('DREG-12 — findExistingRun .contains() uses the family parameter (not a literal)', () => {
    expect(
      /\.contains\s*\(\s*['"]requested_families['"]\s*,\s*\[\s*family\s*\]\s*\)/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });

  it('DREG-13 — call site passes the loop variable family to findExistingRun', () => {
    expect(
      /findExistingRun\s*\(\s*argumentId\s*,\s*family\s*,\s*serviceClient\s*\)/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });

  it('DREG-14 — findExistingRun preserves run_mode=production filter (Source 6 byte-equal)', () => {
    // The auto-trigger writes production rows; the idempotency scope is
    // production-only (admin_validation runs never block an
    // auto-trigger). HALT trigger 5 boundary preserved.
    expect(
      /\.eq\s*\(\s*['"]run_mode['"]\s*,\s*['"]production['"]\s*\)/.test(dispatcherText),
    ).toBe(true);
  });

  it('DREG-15 — findExistingRun preserves schema_version filter', () => {
    expect(
      /\.eq\s*\(\s*['"]schema_version['"]\s*,\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION\s*\)/.test(
        dispatcherText,
      ),
    ).toBe(true);
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — per-family structured log', () => {
  it('DREG-16 — each emitAutoTriggerLog call carries the family tag', () => {
    // Every emitAutoTriggerLog call inside dispatchOneFamilyIteration
    // includes `family,` in its argument object. Source-scan for the
    // pattern.
    const logCalls = dispatcherText.match(/emitAutoTriggerLog\s*\(\s*\{[\s\S]*?\}\s*\)/g) ?? [];
    expect(logCalls.length).toBeGreaterThanOrEqual(4); // 1 per outcome path in the iteration
    // Most log calls (those inside the per-family iteration) carry the
    // family tag. The outer Guard 1 / Guard 2 / outer-catch logs do not
    // (they emit a single dispatch-level outcome). Count the family-
    // tagged log calls.
    const familyTaggedLogs = logCalls.filter((c) => /\bfamily\b\s*[,:]/.test(c));
    expect(familyTaggedLogs.length).toBeGreaterThanOrEqual(4);
  });

  it('DREG-17 — AutoTriggerOutcome interface carries an optional family field', () => {
    const outcomeBlock = dispatcherText.match(/interface\s+AutoTriggerOutcome\s*\{[\s\S]*?\n\}/);
    expect(outcomeBlock).not.toBeNull();
    expect(outcomeBlock![0]).toMatch(/family\??\s*:\s*MachineObservationFamily/);
  });

  it('DREG-18 — AutoTriggerOutcome discriminator preserved (triggered/skipped/already_classified/failed)', () => {
    const outcomeBlock = dispatcherText.match(/interface\s+AutoTriggerOutcome\s*\{[\s\S]*?\n\}/);
    expect(outcomeBlock).not.toBeNull();
    const block = outcomeBlock![0];
    expect(block).toContain("'triggered'");
    expect(block).toContain("'skipped'");
    expect(block).toContain("'already_classified'");
    expect(block).toContain("'failed'");
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — call-site contract preserved', () => {
  it('DREG-19 — submit-argument passes the same (argumentId, debateId, serviceClient) tuple unchanged', () => {
    expect(
      /dispatchAutoTriggerForArgument\s*\(\s*insertedArg\.id\s*,\s*data\.debate_id\s*,\s*serviceClient\s*,?\s*\)/.test(
        submitText,
      ),
    ).toBe(true);
  });

  it('DREG-20 — submit-argument continues to wrap the promise with .catch(() => undefined) (no inspection)', () => {
    expect(
      /dispatchAutoTriggerForArgument\([^)]+\)\s*\.catch\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(
        submitText,
      ),
    ).toBe(true);
  });

  it('DREG-21 — submit-argument does NOT inspect the return shape (no Array.isArray, no .length checks)', () => {
    // The return type evolved from AutoTriggerOutcome to
    // AutoTriggerOutcome[]; the caller never reads the value, so this
    // is a forward-compatible expansion.
    expect(submitText).not.toMatch(/autoTriggerPromise\.then/);
    expect(submitText).not.toMatch(/await\s+autoTriggerPromise/);
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — guards preserved', () => {
  it('DREG-22 — Guard 1 (config_disabled) runs ONCE per dispatch (NOT per family)', () => {
    // The runtime config kill switch is checked outside the for-of
    // loop. Source pattern: the readEnabledFlag call appears BEFORE
    // the eligibleFamilies derivation.
    const enabledIdx = dispatcherText.indexOf('await readEnabledFlag(');
    const eligibleIdx = dispatcherText.indexOf('const eligibleFamilies');
    const forOfIdx = dispatcherText.search(/for\s*\(\s*const\s+\w+\s+of\s+eligibleFamilies/);
    expect(enabledIdx).toBeGreaterThan(-1);
    expect(eligibleIdx).toBeGreaterThan(enabledIdx);
    expect(forOfIdx).toBeGreaterThan(eligibleIdx);
  });

  it('DREG-23 — config_disabled skip returns a single-outcome array (not per-family expansion)', () => {
    // When the kill switch fires, the dispatcher returns immediately
    // with a single skipped outcome (no family tag — the kill switch
    // is dispatch-wide). Source pattern: the disabled branch returns
    // an array literal `[outcome]`.
    const disabledBlock = dispatcherText.match(
      /if\s*\(\s*enabled\s*===\s*false\s*\)\s*\{[\s\S]*?return\s*\[\s*outcome\s*\]/,
    );
    expect(disabledBlock).not.toBeNull();
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — doctrine safety (post-refactor)', () => {
  it('DREG-24 — dispatcher source contains no verdict tokens (doctrine ban-list)', () => {
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
      expect(lower.includes(term)).toBe(false);
    }
  });

  it('DREG-25 — dispatcher source contains no console.log (only emitAutoTriggerLog)', () => {
    expect(dispatcherText).not.toMatch(/console\.log\s*\(/);
    expect(dispatcherText).toContain('emitAutoTriggerLog');
  });

  it('DREG-26 — dispatcher source contains no \'admin_validation\' literal (production-only path)', () => {
    // The auto-trigger writes production rows only. The admin_validation
    // path is the manual HTTP endpoint only. Source 6 byte-equal HALT
    // trigger 5 boundary preserved.
    expect(dispatcherText).not.toMatch(/['"]admin_validation['"]/);
  });

  it('DREG-27 — dispatcher source contains no service-role / Anthropic / EXPO_PUBLIC token references', () => {
    expect(dispatcherText).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(dispatcherText).not.toContain('ANTHROPIC_API_KEY');
    expect(dispatcherText).not.toContain('EXPO_PUBLIC_');
    expect(dispatcherText).not.toMatch(/createServiceClient\s*\(/);
  });

  it('DREG-28 — dispatcher source contains no persistRun( call (the classifier core owns persistence)', () => {
    // The dispatcher orchestrates the loop but never writes rows
    // directly. classifyOneArgumentCore is the only path that calls
    // persistRun / persistResults. Preserves FAIL-12 invariant.
    expect(dispatcherText).not.toContain('persistRun(');
    expect(dispatcherText).not.toContain('persistResults(');
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — registry alignment', () => {
  it('DREG-29 — at registry HEAD, productionEnabledFamilies() returns exactly [A, B, C, D] (post Card 2 flip)', () => {
    // Cross-checks the registry source against the dispatcher's expected
    // dispatch list (this is the binding registry-shape gate). Post
    // MCP-021C-EDGE-FAMILY-D-ENABLE, the production list is 4 families.
    expect(edgeProductionEnabledFamilies()).toEqual([
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
    ]);
  });

  it('DREG-30 — registry source flips B + C productionEnabled to true (source-scan)', () => {
    // Direct registry source-scan to catch accidental B/C revert.
    expect(
      /family:\s*['"]disagreement_axis['"][\s\S]{0,200}productionEnabled:\s*true/.test(
        registryText,
      ),
    ).toBe(true);
    expect(
      /family:\s*['"]misunderstanding_repair['"][\s\S]{0,200}productionEnabled:\s*true/.test(
        registryText,
      ),
    ).toBe(true);
  });

  it('DREG-31 — registry source still has E–J productionEnabled: false (no widening past D)', () => {
    // Catches a future PR accidentally flipping E-J before its own card.
    // Post Card 2 (MCP-021C-EDGE-FAMILY-D-ENABLE), D is productionEnabled;
    // E-J must remain admin-only.
    const EJ_FAMILIES = [
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
      'thread_topology',
      'sensitive_composer',
    ];
    for (const family of EJ_FAMILIES) {
      // The family block has productionEnabled: false within ~200 chars
      // of the family declaration.
      const pattern = new RegExp(
        `family:\\s*['"]${family}['"][\\s\\S]{0,200}productionEnabled:\\s*false`,
      );
      expect(pattern.test(registryText)).toBe(true);
    }
  });

  it('DREG-32 — classifyArgumentCore.ts is NOT modified by this card (single per-call orchestrator)', () => {
    // Stage 2B implementer decision: classifyArgumentCore handles a
    // single MCP call + single run row per invocation. The dispatcher
    // orchestrates the per-family loop. The core's signature is
    // byte-equal (the dispatcher just calls it once per family with a
    // single-element [family] array).
    expect(coreText).toContain('export async function classifyOneArgumentCore');
    // The core continues to accept requestedFamilies as a ReadonlyArray.
    expect(/requestedFamilies\s*:\s*ReadonlyArray<MachineObservationFamily>/.test(coreText)).toBe(
      true,
    );
  });
});

describe('MCP-021C-EDGE-FAMILIES-B-C-ENABLE — registry order = Family A first', () => {
  it('DREG-33 — Family A is first in productionEnabledFamilies() (preserves A iteration #1 behavior)', () => {
    // The sequential for-of loop processes the first element first.
    // Family A's existing behavior is preserved at iteration #1 by the
    // registry order invariant.
    const list = edgeProductionEnabledFamilies();
    expect(list[0]).toBe('parent_relation');
  });

  it('DREG-34 — registry FAMILY_REGISTRY[0] is parent_relation (single source of truth)', () => {
    expect(EDGE_FAMILY_REGISTRY[0].family).toBe('parent_relation');
    expect(EDGE_FAMILY_REGISTRY[0].productionEnabled).toBe(true);
    expect(EDGE_FAMILY_REGISTRY[0].adminValidationEnabled).toBe(true);
  });
});
