/**
 * UX-FLAGS-001 — friendlyFlagMap: doctrine ban-list (acceptance criterion).
 *
 * Structurally cloned from `__tests__/refereeBannerBanList.test.ts`. Scans EVERY
 * `label` and EVERY `helper` across `FRIENDLY_FLAG_DESCRIPTORS`, plus every
 * `FriendlyFlagKey`, against the doctrine ban-list. Also enforces:
 *   - no user-facing field looks like an internal code,
 *   - no family/rawKey/snake_case leaks into any label/helper,
 *   - no popularity-as-praise,
 *   - no fallacy call-out in Family E,
 *   - Family D never grants standing (anti-amplification, §3),
 *   - the FriendlyFlag schema carries no verdict-shaped key (descriptor-only),
 *   - the module source does not import antiAmplification.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FRIENDLY_FLAG_DESCRIPTORS,
  ALL_FRIENDLY_FLAG_KEYS,
  type FriendlyFlag,
} from '../src/features/feedbackFlags';
import { ALL_MACHINE_OBSERVATION_FAMILIES } from '../src/features/nodeLabels/nodeLabelTypes';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── The doctrine ban-list (design §10 test plan; superset of _forbidden…) ──

const BANNED_TOKENS = [
  'winner',
  'loser',
  'won',
  'lost',
  'win',
  'lose',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'proven',
  'disproven',
  'fallacy',
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'propagandist',
  'extremist',
  'troll',
  'bot',
  'stupid',
  'idiot',
  'truth',
  'verdict',
];

/** Whole-word, case-insensitive scan. "lost" must not match "almost". */
function containsBannedToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (token.includes(' ')) {
      if (lower.includes(token)) return token;
    } else {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      if (re.test(lower)) return token;
    }
  }
  return null;
}

/** Every user-facing string across the descriptor table, flattened with a label. */
function userFacingStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const key of ALL_FRIENDLY_FLAG_KEYS) {
    const flag = FRIENDLY_FLAG_DESCRIPTORS[key];
    out.push({ where: `${key}.label`, text: flag.label });
    if (flag.helper !== undefined) {
      out.push({ where: `${key}.helper`, text: flag.helper });
    }
  }
  return out;
}

describe('UX-FLAGS-001 ban-list — no verdict token in any flag string', () => {
  it('no label / helper carries a banned token', () => {
    for (const { where, text } of userFacingStrings()) {
      const hit = containsBannedToken(text);
      expect(hit ? `${where}: "${hit}"` : null).toBeNull();
    }
  });

  it('no FriendlyFlagKey carries a banned token', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const hit = containsBannedToken(key);
      expect(hit ? `${key}: "${hit}"` : null).toBeNull();
    }
  });
});

describe('UX-FLAGS-001 ban-list — no raw code reaches a flag surface', () => {
  it('no user-facing field looks like an internal code', () => {
    for (const { where, text } of userFacingStrings()) {
      expect(looksLikeInternalCode(text) ? where : null).toBeNull();
    }
  });

  it('no label/helper contains an underscore or a family value verbatim', () => {
    for (const { where, text } of userFacingStrings()) {
      expect(text.includes('_') ? `${where} has underscore` : null).toBeNull();
      for (const family of ALL_MACHINE_OBSERVATION_FAMILIES) {
        expect(text.includes(family) ? `${where} leaks family ${family}` : null).toBeNull();
      }
    }
  });

  it('no label contains a period (snake/code-shape guard)', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      expect(FRIENDLY_FLAG_DESCRIPTORS[key].label).not.toContain('.');
    }
  });
});

describe('UX-FLAGS-001 ban-list — popularity is never praised as evidence', () => {
  const POPULARITY_TOKENS = [
    'popular',
    'popularity',
    'trending',
    'viral',
    'everyone agrees',
    'most people',
  ];
  const NOT_PROOF_PHRASES = [
    "isn't proof",
    'not proof',
    'not evidence',
    "what's the source",
    'a source',
  ];

  it('a flag string naming popularity also names that it is not proof', () => {
    for (const { where, text } of userFacingStrings()) {
      const lower = text.toLowerCase();
      const namesPopularity = POPULARITY_TOKENS.some((t) => lower.includes(t));
      if (!namesPopularity) continue;
      const namesNotProof = NOT_PROOF_PHRASES.some((p) => lower.includes(p));
      expect(namesNotProof ? null : `${where} praises popularity`).toBeNull();
    }
  });
});

describe('UX-FLAGS-001 ban-list — no fallacy / argumentation-theory jargon in Family E', () => {
  const FALLACY_JARGON = ['fallacy', 'linked', 'convergent', 'enthymeme'];

  it('no Family E label/helper carries a fallacy / raw scheme term', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const flag = FRIENDLY_FLAG_DESCRIPTORS[key];
      if (flag.family !== 'argument_scheme') continue;
      const blob = `${flag.label} ${flag.helper ?? ''}`.toLowerCase();
      for (const term of FALLACY_JARGON) {
        expect(blob.includes(term) ? `${key} uses "${term}"` : null).toBeNull();
      }
    }
  });
});

describe('UX-FLAGS-001 ban-list — Family D grants no standing', () => {
  const STANDING_TOKENS = ['proven', 'proof', 'true', 'false', 'confirmed', 'wins', 'settles it', 'is a fact'];

  it('every Family D descriptor has neverGrantsStanding === true', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const flag = FRIENDLY_FLAG_DESCRIPTORS[key];
      if (flag.family !== 'evidence_source_chain') continue;
      expect(flag.neverGrantsStanding).toBe(true);
    }
  });

  it('no Family D label/helper contains a standing-granting token', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const flag = FRIENDLY_FLAG_DESCRIPTORS[key];
      if (flag.family !== 'evidence_source_chain') continue;
      const blob = `${flag.label} ${flag.helper ?? ''}`.toLowerCase();
      for (const token of STANDING_TOKENS) {
        expect(blob.includes(token) ? `${key} grants standing via "${token}"` : null).toBeNull();
      }
    }
  });
});

describe('UX-FLAGS-001 ban-list — FriendlyFlag schema has no verdict / ranking surface', () => {
  it('a sampled FriendlyFlag has no score/block/winner/verdict/rank/priority key', () => {
    const sample: FriendlyFlag = FRIENDLY_FLAG_DESCRIPTORS.nice_bridge;
    const keys = Object.keys(sample);
    for (const forbidden of [
      'score',
      'block',
      'winner',
      'loser',
      'truthValue',
      'authoritative',
      'verdict',
      'rank',
      'priority',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('UX-FLAGS-001 ban-list — module does not import antiAmplification', () => {
  it('friendlyFlagMap source has no antiAmplification import', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'features', 'feedbackFlags', 'friendlyFlagMap.ts'),
      'utf8',
    );
    expect(source.includes('antiAmplification')).toBe(false);
  });
});
