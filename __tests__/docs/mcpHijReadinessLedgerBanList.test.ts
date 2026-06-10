/**
 * DEVEX-DOC-GUARD-TESTS-001 (#496) — Test 1
 *
 * Guards `docs/core/MCP-HIJ-READINESS-LEDGER.md` (the #471 readiness ledger).
 * This is a CI guard over a committed doc: the ledger is reviewer-verified clean,
 * so all assertions PASS on the committed state. They exist so the constraints
 * cannot regress as the doc is edited.
 *
 * Doctrine: cdiscourse-doctrine §1 (no truth/verdict labels), §4 (AI moderator
 * advisory-only — no advancement recommendation), §4-C (never-self-approve — the
 * frozen family set is never flipped by a doc; post MCP-H-002 + MCP-I-D2 the
 * frozen set is J only, H and I having been re-enabled by the operator-approved
 * E#7(b) and MCP-021C-EDGE-FAMILY-I-ENABLE registry flips respectively).
 *
 * Acceptance-gate invariant (verbatim, restated for this guard):
 *   "AI/MCP classifiers MUST NEVER be the submission acceptance gate. The
 *    deterministic rules engine, src/lib/constitution/engine.ts, is the sole
 *    gate. Classifiers run after an argument is stored. No path may block,
 *    reject, route, or delay an ordinary user post."
 * These are CI guards over documentation — no submission path, no family state,
 * no planner.
 *
 * §4-A failure semantics: if any assertion below fails on the committed doc, do
 * NOT loosen the test and do NOT edit the guarded doc. Report the failing
 * assertion + the doc line that tripped it and HALT — the operator decides
 * whether the test is too strict or the doc has a defect (separate card).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LEDGER_REL = 'docs/core/MCP-HIJ-READINESS-LEDGER.md';
const LEDGER_ABS = path.join(REPO_ROOT, LEDGER_REL);

/**
 * Doctrine ban-list (§1). Case-insensitive, word-boundary on both sides so the
 * stems do not false-positive on benign substrings (e.g. "ban" inside "band").
 * "bad faith" is matched as a two-word phrase.
 */
const BANNED_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
];

function bannedRegex(token: string): RegExp {
  // Tokens are plain words / a two-word phrase; collapse the inner space so
  // "bad faith" tolerates one-or-more whitespace between the two words.
  const body = token.replace(/ /g, '\\s+');
  return new RegExp(`\\b${body}\\b`, 'gi');
}

describe('MCP-HIJ readiness ledger — ban-list + advancement-neutral guards', () => {
  let text: string;

  beforeAll(() => {
    expect(fs.existsSync(LEDGER_ABS)).toBe(true);
    text = fs.readFileSync(LEDGER_ABS, 'utf8');
  });

  describe('1. doctrine ban-list scan (§1 — no truth/verdict labels)', () => {
    for (const token of BANNED_TOKENS) {
      it(`does not contain the verdict token "${token}"`, () => {
        const re = bannedRegex(token);
        const m = re.exec(text);
        if (m) {
          const lineNum = text.slice(0, m.index).split('\n').length;
          throw new Error(
            `${LEDGER_REL}:${lineNum} contains banned verdict token ` +
              `"${token}": ${JSON.stringify(m[0])}`,
          );
        }
        expect(m).toBeNull();
      });
    }
  });

  describe('2. verbatim HARD RULE is present', () => {
    it('contains the line-18 HARD RULE substring', () => {
      const HARD_RULE =
        'No file in this card enables any family. No doc, audit, or roadmap ' +
        'auto-advances a family to production. The percentage dial and the ' +
        'family dial are separate. One family at a time. Failure rolls back.';
      expect(text).toContain(HARD_RULE);
    });
  });

  describe('3. "NOT a gate-pass" disclaimer is present', () => {
    it('contains the inline disclaimer (line 20)', () => {
      expect(text).toContain('This ledger is NOT a gate-pass.');
    });

    it('contains the closing "green ledger row is NOT a gate-pass" disclaimer', () => {
      expect(text).toContain('green ledger row is NOT a gate-pass');
    });
  });

  describe('4. advancement-neutral (§4 / §4-C — no recommendation to flip)', () => {
    // MCP-H-002 (2026-06-10, operator-approved E#7(b) after the #472
    // reproduction PASS): Family H (`claim_clarity`) was re-enabled to
    // production — the realization of the ledger's own named flip precondition
    // (Row H, col 10). The frozen set narrowed from {H, I, J} to {I, J}.
    // MCP-I-D2 (2026-06-10, operator-authorized MCP-021C-EDGE-FAMILY-I-ENABLE):
    // Family I (`thread_topology`) was re-enabled to production — the
    // realization of Row I's named precondition. The STILL-frozen set narrowed
    // from {I, J} to {J}. The adjacency guard below therefore scopes to J
    // only. This is NOT a doctrine loosening: the §1 verdict ban-list and the
    // advancement-recommendation guard are unchanged; only the frozen-family
    // set tracks the registry reality.
    const FROZEN_J_FAMILY_NAMES = ['sensitive_composer'];

    it('does not place `productionEnabled: true` adjacent to a still-frozen J family name', () => {
      // The doc legitimately states A–I are `productionEnabled: true` (line 40
      // + Row H post MCP-H-002 + Row I post MCP-I-D2), so a bare scan would
      // over-match. Scope to ADJACENCY: a `productionEnabled: true` within ~80
      // chars of the J registry name would assert the still-frozen family is
      // enabled. That must never appear.
      const PROD_TRUE = /productionEnabled:\s*true/gi;
      let m: RegExpExecArray | null;
      while ((m = PROD_TRUE.exec(text)) !== null) {
        const windowStart = Math.max(0, m.index - 80);
        const windowEnd = m.index + m[0].length + 80;
        const ctx = text.slice(windowStart, windowEnd);
        for (const fam of FROZEN_J_FAMILY_NAMES) {
          if (ctx.includes(fam)) {
            const lineNum = text.slice(0, m.index).split('\n').length;
            throw new Error(
              `${LEDGER_REL}:${lineNum} places \`productionEnabled: true\` ` +
                `within ~80 chars of frozen family "${fam}" — the J family ` +
                `must stay productionEnabled: false.`,
            );
          }
        }
      }
      expect(true).toBe(true);
    });

    it('contains no NEW advancement-recommendation phrasing', () => {
      // The doc's own negations ("makes no recommendation to advance", "NOT a
      // recommendation to flip") are fine — they are prohibitions, not
      // recommendations. We scan only for PRESCRIPTIVE advancement phrases.
      const RECOMMEND_PHRASES = [
        /ready to flip/i,
        /should advance/i,
        /criterion met,?\s*recommend production/i,
        /recommend production/i,
        /ready for production/i,
        /green-light production/i,
      ];
      for (const re of RECOMMEND_PHRASES) {
        const m = re.exec(text);
        if (m) {
          const lineNum = text.slice(0, m.index).split('\n').length;
          throw new Error(
            `${LEDGER_REL}:${lineNum} contains advancement-recommendation ` +
              `phrasing ${re} → ${JSON.stringify(m[0])}. The ledger must make ` +
              `no recommendation to advance any family.`,
          );
        }
      }
      expect(true).toBe(true);
    });
  });
});
