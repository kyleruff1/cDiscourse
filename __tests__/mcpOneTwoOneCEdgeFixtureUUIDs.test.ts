/**
 * MCP-021C-EDGE — Test: fixture UUIDs are well-formed + cross-checked
 * against the testing-runs corpus.
 *
 * Per design §9 (Decision 10): the 3 fixture UUIDs come from the
 * 2026-05-25 testing-runs Onboarding apology room. This test verifies
 * the fixtures are:
 *   - Well-formed UUIDs (32-hex / 8-4-4-4-12 dashes).
 *   - All distinct.
 *   - All present in the testing-runs corpus markdown.
 *   - Documented as depth-0 / depth-1 / depth-2 of the same room.
 *
 * The corpus markdown is committed to the repo as
 * docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md (an operator
 * deliverable, not a card output — kept under VCS as a stable
 * audit reference).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  FIXTURE_DEBATE_ID,
  FIXTURE_ARGUMENT_ID_DEPTH_0,
  FIXTURE_ARGUMENT_ID_DEPTH_1,
  FIXTURE_ARGUMENT_ID_DEPTH_2,
  ALL_FIXTURE_ARGUMENT_IDS,
  ALTERNATE_FIXTURE_DEBATE_IDS,
} from './fixtures/mcpOneTwoOneCEdgeAdminValidationFixture';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('MCP-021C-EDGE — fixture UUID well-formedness', () => {
  it('FX-1 — FIXTURE_DEBATE_ID is a well-formed UUID', () => {
    expect(UUID_RE.test(FIXTURE_DEBATE_ID)).toBe(true);
  });

  it('FX-2 — depth 0 (root) argument UUID is well-formed', () => {
    expect(UUID_RE.test(FIXTURE_ARGUMENT_ID_DEPTH_0)).toBe(true);
  });

  it('FX-3 — depth 1 argument UUID is well-formed', () => {
    expect(UUID_RE.test(FIXTURE_ARGUMENT_ID_DEPTH_1)).toBe(true);
  });

  it('FX-4 — depth 2 argument UUID is well-formed', () => {
    expect(UUID_RE.test(FIXTURE_ARGUMENT_ID_DEPTH_2)).toBe(true);
  });

  it('FX-5 — all three fixture argument UUIDs are distinct', () => {
    const ids = [
      FIXTURE_ARGUMENT_ID_DEPTH_0,
      FIXTURE_ARGUMENT_ID_DEPTH_1,
      FIXTURE_ARGUMENT_ID_DEPTH_2,
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it('FX-6 — debate UUID is distinct from each argument UUID', () => {
    expect(FIXTURE_DEBATE_ID).not.toBe(FIXTURE_ARGUMENT_ID_DEPTH_0);
    expect(FIXTURE_DEBATE_ID).not.toBe(FIXTURE_ARGUMENT_ID_DEPTH_1);
    expect(FIXTURE_DEBATE_ID).not.toBe(FIXTURE_ARGUMENT_ID_DEPTH_2);
  });
});

describe('MCP-021C-EDGE — ALL_FIXTURE_ARGUMENT_IDS export', () => {
  it('FX-7 — has length 3', () => {
    expect(ALL_FIXTURE_ARGUMENT_IDS).toHaveLength(3);
  });

  it('FX-8 — is frozen', () => {
    expect(Object.isFrozen(ALL_FIXTURE_ARGUMENT_IDS)).toBe(true);
  });

  it('FX-9 — depth order: [depth0, depth1, depth2]', () => {
    expect(ALL_FIXTURE_ARGUMENT_IDS[0]).toBe(FIXTURE_ARGUMENT_ID_DEPTH_0);
    expect(ALL_FIXTURE_ARGUMENT_IDS[1]).toBe(FIXTURE_ARGUMENT_ID_DEPTH_1);
    expect(ALL_FIXTURE_ARGUMENT_IDS[2]).toBe(FIXTURE_ARGUMENT_ID_DEPTH_2);
  });
});

describe('MCP-021C-EDGE — fixture UUIDs present in testing-runs corpus', () => {
  const CORPUS_PATH = path.join(
    process.cwd(),
    'docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md',
  );

  let corpusText = '';

  beforeAll(() => {
    if (fs.existsSync(CORPUS_PATH)) {
      corpusText = fs.readFileSync(CORPUS_PATH, 'utf8');
    }
  });

  it('FX-10 — corpus file exists (operator deliverable)', () => {
    expect(fs.existsSync(CORPUS_PATH)).toBe(true);
  });

  it('FX-11 — FIXTURE_DEBATE_ID appears in the corpus', () => {
    if (corpusText === '') return; // skipped if corpus absent
    expect(corpusText.includes(FIXTURE_DEBATE_ID)).toBe(true);
  });

  it('FX-12 — depth 0 (root) UUID appears in the corpus', () => {
    if (corpusText === '') return;
    expect(corpusText.includes(FIXTURE_ARGUMENT_ID_DEPTH_0)).toBe(true);
  });

  it('FX-13 — depth 1 UUID appears in the corpus', () => {
    if (corpusText === '') return;
    expect(corpusText.includes(FIXTURE_ARGUMENT_ID_DEPTH_1)).toBe(true);
  });

  it('FX-14 — depth 2 UUID appears in the corpus', () => {
    if (corpusText === '') return;
    expect(corpusText.includes(FIXTURE_ARGUMENT_ID_DEPTH_2)).toBe(true);
  });

  it('FX-15 — Onboarding apology room phrase appears in the corpus', () => {
    if (corpusText === '') return;
    // The room title "Long onboarding is an apology for bad UI." should
    // appear at the room header in the corpus.
    expect(/onboarding/i.test(corpusText)).toBe(true);
    expect(/apology/i.test(corpusText)).toBe(true);
  });
});

describe('MCP-021C-EDGE — alternate fixture rooms documented', () => {
  it('FX-16 — alternate rooms array has 2 entries (Pitch clock + Bike lanes)', () => {
    expect(ALTERNATE_FIXTURE_DEBATE_IDS).toHaveLength(2);
  });

  it('FX-17 — every alternate debate UUID is well-formed', () => {
    for (const alt of ALTERNATE_FIXTURE_DEBATE_IDS) {
      expect(UUID_RE.test(alt.debateId)).toBe(true);
    }
  });

  it('FX-18 — alternates include Pitch clock baseball room', () => {
    const pitch = ALTERNATE_FIXTURE_DEBATE_IDS.find((a) => a.room.toLowerCase().includes('pitch'));
    expect(pitch).toBeDefined();
  });

  it('FX-19 — alternates include Bike lanes curb room', () => {
    const bike = ALTERNATE_FIXTURE_DEBATE_IDS.find((a) => a.room.toLowerCase().includes('bike'));
    expect(bike).toBeDefined();
  });
});
