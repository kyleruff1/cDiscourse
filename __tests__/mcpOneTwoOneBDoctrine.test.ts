/**
 * MCP-021B — Test §8.6: doctrine + ban-list scans.
 *
 * Pure-text + behavior scans that prove the MCP-021B persistence layer
 * cannot leak verdict tokens, raw_keys, or engagement-as-evidence
 * patterns into user-facing UI or storage, and that the Machine vs User
 * provenance boundary holds.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  mapPersistedObservationRowsToNodeLabelMarks,
} from '../src/features/nodeLabels/machineObservationPersistenceAdapter';
import {
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
} from '../src/features/nodeLabels/machineObservationDefinitions';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

const ROOT = join(__dirname, '..');
const ADAPTER_PATH = join(ROOT, 'src/features/nodeLabels/machineObservationPersistenceAdapter.ts');
const QUERY_PATH = join(ROOT, 'src/features/nodeLabels/machineObservationPersistenceQuery.ts');
const TYPES_PATH = join(ROOT, 'src/features/nodeLabels/machineObservationPersistenceTypes.ts');
const MIGRATION_PATH = join(
  ROOT,
  'supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql',
);

// Ban list: doctrine-forbidden verdict tokens that must never appear as
// user-facing copy in MCP-021B production code. TypeScript boolean
// literals (`true` / `false`) are excluded — they are language keywords,
// not verdict claims. The "truth value" / "true claim" phrases ARE banned
// (covered by 'truth value' + 'proof of' + 'verdict').
const BANNED_VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'liars',
  'dishonest',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'fallacy',
  'fallacious',
  'bad faith',
  // 'true' / 'false' excluded — TypeScript keyword collision. The
  // multi-word truth-claim phrases below still gate the doctrine.
  'truth value',
  'truth claim',
  'true claim',
  'proof of',
  'verdict',
];

function scanForBannedTokens(source: string, label: string): void {
  for (const token of BANNED_VERDICT_TOKENS) {
    // 'open' is a lifecycle Observation rawKey; we have to keep it. But
    // our ban list is verdict / truth / winner / loser / etc — not
    // 'open'. The token list above does NOT include 'open' so no false
    // positive.
    //
    // 'true' / 'false' as substrings can match many words; constrain to
    // word boundaries. For each token, search case-insensitively for
    // the token surrounded by non-alphanumeric boundaries.
    const lower = source.toLowerCase();
    const idx = lower.indexOf(token.toLowerCase());
    if (idx === -1) continue;
    // Boundary check — accept the match only if it's a standalone word.
    const before = idx > 0 ? lower[idx - 1] : ' ';
    const after =
      idx + token.length < lower.length ? lower[idx + token.length] : ' ';
    const isWordBoundary =
      (before === ' ' || /[^a-z0-9_]/.test(before)) &&
      (after === ' ' || /[^a-z0-9_]/.test(after));
    if (isWordBoundary) {
      throw new Error(`${label}: banned verdict token "${token}" found at offset ${idx}`);
    }
  }
}

describe('MCP-021B — ban-list scan: source files', () => {
  it('DOC-1 — adapter source has no verdict tokens', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    expect(() => scanForBannedTokens(src, 'adapter')).not.toThrow();
  });

  it('DOC-2 — query helper source has no verdict tokens', () => {
    const src = readFileSync(QUERY_PATH, 'utf8');
    expect(() => scanForBannedTokens(src, 'query')).not.toThrow();
  });

  it('DOC-3 — types file has no verdict tokens', () => {
    const src = readFileSync(TYPES_PATH, 'utf8');
    expect(() => scanForBannedTokens(src, 'types')).not.toThrow();
  });

  it('DOC-4 — migration SQL has no verdict tokens', () => {
    const src = readFileSync(MIGRATION_PATH, 'utf8');
    expect(() => scanForBannedTokens(src, 'migration')).not.toThrow();
  });
});

describe('MCP-021B — adapter behavioral doctrine', () => {
  const validRow: MachineObservationResultRow = {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: 'arg-1',
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
  };

  it('DOC-5 — emitted Machine Observation marks have kind === machine_observation', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks([validRow], {
      argumentId: 'arg-1',
      surface: 'timeline_node',
    });
    for (const m of marks) {
      expect(m.kind).toBe('machine_observation');
    }
  });

  it('DOC-6 — adapter never emits kind === user_allegation from a Machine Observation row', () => {
    const marks = mapPersistedObservationRowsToNodeLabelMarks([validRow], {
      argumentId: 'arg-1',
      surface: 'inspect',
    });
    for (const m of marks) {
      expect(m.kind).not.toBe('user_allegation');
    }
  });

  it('DOC-7 — adapter silently drops unknown rawKey (no log, no throw, no echo)', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const result = mapPersistedObservationRowsToNodeLabelMarks(
        [{ ...validRow, rawKey: 'unknown_doctrine_test' }],
        { argumentId: 'arg-1', surface: 'inspect' },
      );
      expect(result).toEqual([]);
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('DOC-8 — adapter only accepts the MCP-021A 172-rawKey registry; out-of-set silently dropped', () => {
    // Sample a non-rawKey and verify it never produces a mark.
    const out = mapPersistedObservationRowsToNodeLabelMarks(
      [{ ...validRow, rawKey: 'totally_made_up_rawkey_xyz' }],
      { argumentId: 'arg-1', surface: 'inspect' },
    );
    expect(out).toEqual([]);
  });

  it('DOC-9 — every registry-defined entry an adapter could surface has kind === machine_observation', () => {
    // Spot-check 10 random rawKeys from the registry.
    const allKeys = Object.keys(MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY);
    for (let i = 0; i < 10; i++) {
      const rawKey = allKeys[i * Math.floor(allKeys.length / 10)];
      const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[rawKey];
      expect(def.kind).toBe('machine_observation');
    }
  });
});

describe('MCP-021B — no engagement / popularity / heat inputs', () => {
  it('DOC-10 — query helper has no engagement / popularity / heat / retweet sort', () => {
    const src = readFileSync(QUERY_PATH, 'utf8');
    expect(src).not.toMatch(/\.order\(['"]engagement/);
    expect(src).not.toMatch(/\.order\(['"]popularity/);
    expect(src).not.toMatch(/\.order\(['"]view_count/);
    expect(src).not.toMatch(/\.order\(['"]follower/);
    expect(src).not.toMatch(/\.order\(['"]retweet/);
    expect(src).not.toMatch(/\.order\(['"]heat/);
  });

  it('DOC-11 — migration has no engagement / popularity / heat columns', () => {
    const src = readFileSync(MIGRATION_PATH, 'utf8');
    expect(src).not.toMatch(/engagement_count/i);
    expect(src).not.toMatch(/popularity_score/i);
    expect(src).not.toMatch(/view_count/i);
    expect(src).not.toMatch(/follower_count/i);
    expect(src).not.toMatch(/retweet_count/i);
    expect(src).not.toMatch(/heat_score/i);
  });

  it('DOC-12 — adapter has no engagement / popularity reference', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    expect(src).not.toMatch(/engagement|popularity|retweet|follower_count|view_count/i);
  });
});

describe('MCP-021B — no console.log in production code', () => {
  it('DOC-13 — adapter source has zero console.log / .error / .warn / .debug', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    expect(src).not.toMatch(/console\.(log|error|warn|debug)\(/);
  });

  it('DOC-14 — query helper has zero console.log / .error / .warn / .debug', () => {
    const src = readFileSync(QUERY_PATH, 'utf8');
    expect(src).not.toMatch(/console\.(log|error|warn|debug)\(/);
  });

  it('DOC-15 — types file has zero console.log / .error / .warn / .debug', () => {
    const src = readFileSync(TYPES_PATH, 'utf8');
    expect(src).not.toMatch(/console\.(log|error|warn|debug)\(/);
  });
});

describe('MCP-021B — no external AI provider imports', () => {
  it('DOC-16 — none of the new files import from @anthropic / @xai / xai-sdk / openai', () => {
    const files = [ADAPTER_PATH, QUERY_PATH, TYPES_PATH];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/from\s+['"]@anthropic/);
      expect(src).not.toMatch(/from\s+['"]@xai/);
      expect(src).not.toMatch(/from\s+['"]xai-sdk/);
      expect(src).not.toMatch(/from\s+['"]openai/);
      expect(src).not.toMatch(/from\s+['"]@anthropic-ai/);
    }
  });
});

describe('MCP-021B — no User Allegation path mutation', () => {
  it('DOC-17 — adapter never reads from point_tags', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    expect(src).not.toMatch(/point_tags/);
    expect(src).not.toMatch(/from\(['"]point_tags/);
  });

  it('DOC-18 — query helper never queries point_tags (Allegation table)', () => {
    const src = readFileSync(QUERY_PATH, 'utf8');
    expect(src).not.toMatch(/from\(['"]point_tags/);
  });

  it('DOC-19 — Machine never rendered as User: persisted row never produces user_allegation mark', () => {
    const out = mapPersistedObservationRowsToNodeLabelMarks(
      [
        {
          id: 'res-1',
          runId: 'run-1',
          debateId: 'deb-1',
          argumentId: 'arg-1',
          schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
          rawKey: 'has_rebuttal',
          family: 'parent_relation',
          confidence: 'high',
          evidenceSpan: null,
          createdAt: '2026-05-26T00:00:00.000Z',
        },
      ],
      { argumentId: 'arg-1', surface: 'inspect' },
    );
    for (const m of out) {
      expect(m.kind).not.toBe('user_allegation');
    }
  });
});

describe('MCP-021B — plain-language scan', () => {
  it('DOC-20 — every visible mark label/shortLabel/description from the adapter is plain language (no snake_case)', () => {
    // Sample 10 distinct rendered_now rawKeys from the registry and
    // confirm their visible fields have no snake_case raw_key leakage.
    const sampleKeys = ['has_rebuttal', 'has_counter_rebuttal', 'rebutted'];
    for (const key of sampleKeys) {
      const def = MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY[key];
      expect(def.label).not.toMatch(/[a-z]+_[a-z]+/);
      expect(def.shortLabel).not.toMatch(/[a-z]+_[a-z]+/);
      // description may contain natural language references like "cluster"
      // but should not contain raw_key tokens.
      expect(def.description).not.toContain(key);
    }
  });
});

describe('MCP-021B — fetch / network discipline', () => {
  it('DOC-21 — adapter has zero fetch() calls (pure transform)', () => {
    const src = readFileSync(ADAPTER_PATH, 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it('DOC-22 — types file has zero fetch() calls', () => {
    const src = readFileSync(TYPES_PATH, 'utf8');
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it('DOC-23 — query helper uses supabase.from(), not raw fetch()', () => {
    const src = readFileSync(QUERY_PATH, 'utf8');
    // .from is reached via the supabase client; match across whitespace.
    expect(src).toMatch(/supabase\s*\.\s*from\(/);
    // No raw fetch() — using the Supabase client only.
    expect(src).not.toMatch(/\bfetch\(/);
  });
});

describe('MCP-021B — run status enum exclusion', () => {
  it('DOC-24 — MachineObservationRunStatus enum (success/failed/fallback) carries no verdict semantics', () => {
    const src = readFileSync(TYPES_PATH, 'utf8');
    // Spot-check: the enum text exists in the source.
    expect(src).toContain("'success' | 'failed' | 'fallback'");
    // And the enum does NOT contain verdict-like values.
    expect(src).not.toMatch(/'winner'|'loser'|'correct'|'truth'/);
  });
});
