/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — post-storage-only +
 * purity guards (design §3 invariant 1, §11 adversarial check 1).
 *
 * The evaluator is POST-STORAGE display-only: it must never appear in the
 * acceptance gate (engine.ts) or the submit path (composerSubmit.ts), and it
 * must be a pure module (no React/Supabase/network/Date.now/Math.random).
 *
 * These are source-text guards (import-graph + forbidden-token scans), the
 * established pattern in this repo for "this module is never imported by X".
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** Read source with comments stripped, so prohibition notes in doc comments
 *  do not trip the forbidden-token scans (we want real USAGE, not mentions). */
function readCodeOnly(rel: string): string {
  const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/\/\/.*$/gm, ''); // line comments
}

const EVALUATOR = 'src/features/nodeLabels/observationMapping/observationMappingEvaluator.ts';
const REGISTRY = 'src/features/nodeLabels/observationMapping/observationMappingRegistry.ts';
const TYPES = 'src/features/nodeLabels/observationMapping/observationMappingTypes.ts';
const DEPLOYED = 'src/features/nodeLabels/observationMapping/deployedAgRawKeys.ts';

const PURE_SOURCES = [EVALUATOR, REGISTRY, TYPES, DEPLOYED];

describe('observation-mapping evaluator — post-storage-only', () => {
  it('engine.ts does NOT import the observation-mapping evaluator', () => {
    const engine = read('src/domain/constitution/engine.ts');
    expect(engine).not.toContain('observationMapping');
  });

  it('the submit path (composerSubmit.ts) does NOT import the evaluator', () => {
    const submit = read('src/features/arguments/composerSubmit.ts');
    expect(submit).not.toContain('observationMapping');
  });

  it('the evaluator does NOT import engine.ts or any constitution submission gate', () => {
    const src = read(EVALUATOR);
    expect(src).not.toContain('constitution/engine');
    expect(src).not.toContain('engine.ts');
  });
});

describe('observation-mapping evaluator — purity', () => {
  for (const rel of PURE_SOURCES) {
    it(`${rel} has no React / Supabase / network import`, () => {
      const src = readCodeOnly(rel);
      expect(src).not.toMatch(/from ['"]react['"]/);
      expect(src).not.toMatch(/from ['"]react-native['"]/);
      expect(src).not.toMatch(/@supabase/);
      expect(src).not.toMatch(/supabaseClient/);
      expect(src).not.toMatch(/\bfetch\(/);
      expect(src).not.toMatch(/XMLHttpRequest/);
    });

    it(`${rel} has no Date.now / Math.random (deterministic)`, () => {
      const src = readCodeOnly(rel);
      expect(src).not.toContain('Date.now');
      expect(src).not.toContain('Math.random');
      expect(src).not.toMatch(/new Date\(/);
    });
  }
});

describe('observation-mapping evaluator — no classifier / provider invocation', () => {
  for (const rel of PURE_SOURCES) {
    it(`${rel} does not call a classifier or AI provider`, () => {
      const src = readCodeOnly(rel);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/\bxai\b/i);
      expect(src).not.toMatch(/classifyArgument/);
      // The evaluator reads PERSISTED positives; it never imports the wire
      // schema / request builder.
      expect(src).not.toContain('buildMcpBooleanObservationRequest');
    });
  }
});

describe('observation-mapping — no migration / Edge / mcp-server / new boolean', () => {
  it('the registry references only existing deployed rawKeys (no new boolean defined here)', () => {
    const src = readCodeOnly(REGISTRY);
    // No MachineObservationDefinition is authored in this slice (new booleans
    // are Build 2). The registry only references rawKeys by string.
    expect(src).not.toContain('MachineObservationDefinition');
    expect(src).not.toContain('booleanQuestion');
  });
});
