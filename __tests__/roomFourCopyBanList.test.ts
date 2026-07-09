/**
 * ROOM-004 (#886) — copy ban-list.
 *
 * No verdict / standing / winner / amplification token in any ROOM-004 label,
 * hint, or accessibility string, and no snake_case internal-code leak. The
 * ban-list is the SAME set the surface model exports, so copy and test share
 * ONE source of truth.
 */
import fs from 'fs';
import path from 'path';
import { _forbiddenMapSurfaceTokens } from '../src/features/arguments/room/mapNodeActionSurfaceModel';

const REPO = process.cwd();
const FILES = [
  'src/features/arguments/room/mapNodeActionSurfaceModel.ts',
  'src/features/arguments/room/MapNodeActionPopover.tsx',
  'src/features/arguments/room/MapNodeSidecarLinks.tsx',
  'src/features/arguments/room/roomCapabilityParity.ts',
];

// Match every literal string in source. The naive quote-parity form is fine
// here because all comments in the scanned files are apostrophe-free.
const STRING_RE = /(['"`])(?:(?!\1|\\)[\s\S]|\\[\s\S])*?\1/g;

function extractStrings(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = STRING_RE.exec(src))) out.push(m[0].slice(1, -1));
  return out;
}

const BANNED = _forbiddenMapSurfaceTokens();

// Internal snake_case codes that must never surface as visible copy. testIDs
// and action codes are allowed (they route through props / not shown), so we
// scan only for classifier-style codes that would leak internal vocabulary.
const INTERNAL_CODE_LEAK = [
  'source_chain_lexical',
  'topic_satisfaction_lexical',
  'anti_amplification',
  'evidence_debt',
  'platform_support_warning',
];

describe('ROOM-004 — copy ban-list', () => {
  for (const rel of FILES) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const strings = extractStrings(src);
    it(`${rel} has no banned verdict / amplification token in a string literal`, () => {
      for (const lit of strings) {
        const lower = lit.toLowerCase();
        // Skip the ban-list DEFINITION entries themselves: a literal that is
        // exactly a banned token is the FORBIDDEN_MAP_SURFACE_TOKENS array
        // member, never user-facing copy.
        if (BANNED.includes(lower)) continue;
        for (const tok of BANNED) {
          // Word-boundary check so identifiers like "onAction" or the testID
          // segment "answer-this" never trip a substring like "true"/"won".
          const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (re.test(lower)) {
            throw new Error(`Banned token "${tok}" in ${rel}: ${lit.slice(0, 80)}`);
          }
        }
      }
      expect(true).toBe(true);
    });

    it(`${rel} leaks no internal snake_case code`, () => {
      for (const lit of strings) {
        for (const code of INTERNAL_CODE_LEAK) {
          expect({ rel, code, hit: lit.includes(code) }).toEqual({ rel, code, hit: false });
        }
      }
    });
  }

  it('the forbidden-token list covers the doctrine ban set', () => {
    for (const tok of ['winner', 'proof', 'verdict', 'viral', 'engagement']) {
      expect(BANNED).toContain(tok);
    }
  });
});
