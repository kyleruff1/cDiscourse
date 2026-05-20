/**
 * BR-004 — branch grammar ban-list / doctrine safety tests.
 *
 * A branch direction describes a STRUCTURAL position — never a verdict,
 * never amplification, never the person. This suite scans every
 * user-facing string BR-004 can produce:
 *   - every BRANCH_GRAMMAR_COPY value (labels, explainers, fragments,
 *     the depth-cap prompt),
 *   - every assembled summaryLine + accessibilityLabel,
 *   - every BranchDirectionVisual.accessibilityFragment,
 * for verdict / amplification / person-attribution tokens, and asserts
 * `looksLikeInternalCode` is false for every visible string (no
 * snake_case enum value leaks into UI copy).
 */
import {
  _forbiddenBranchGrammarTokens,
  buildCollapsedBranchSummary,
  branchDirectionLabel,
  ALL_BRANCH_DIRECTIONS,
  type BranchGrammarNode,
} from '../src/features/arguments/branchGrammarModel';
import { buildBranchDirectionVisual } from '../src/features/arguments/branchGrammarRenderContract';
import { BRANCH_GRAMMAR_COPY, looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const FORBIDDEN = _forbiddenBranchGrammarTokens();

function assertClean(label: string, s: string) {
  const lower = s.toLowerCase();
  for (const token of FORBIDDEN) {
    expect(`${label}: ${lower}`.includes(token)).toBe(
      // The label prefix is only for a readable failure message — re-check
      // against the bare string.
      lower.includes(token),
    );
    expect(lower.includes(token)).toBe(false);
  }
}

describe('BRANCH_GRAMMAR_COPY — ban-list', () => {
  it('contains no verdict / amplification / person-attribution token', () => {
    for (const [key, value] of Object.entries(BRANCH_GRAMMAR_COPY)) {
      assertClean(key, String(value));
    }
  });

  it('every visible string is plain language (not an internal code)', () => {
    for (const [, value] of Object.entries(BRANCH_GRAMMAR_COPY)) {
      // `{count}` placeholder fragments and multi-word strings are not
      // codes; assert the WHOLE string is not a bare snake_case token.
      expect(looksLikeInternalCode(String(value))).toBe(false);
    }
  });

  it('no copy string contains a snake_case BranchDirection enum value', () => {
    const enumValues = [
      'chime_in_vertical',
      'tangent_diagonal',
      'evidence_passthrough',
    ];
    for (const value of Object.values(BRANCH_GRAMMAR_COPY)) {
      for (const e of enumValues) {
        expect(String(value).includes(e)).toBe(false);
      }
    }
  });
});

describe('branchDirectionLabel — plain-language labels', () => {
  it('returns a clean plain-language label for the three drawn directions', () => {
    expect(branchDirectionLabel('mainline')).toBe('Main thread');
    expect(branchDirectionLabel('chime_in_vertical')).toBe('Chime-in');
    expect(branchDirectionLabel('tangent_diagonal')).toBe('Side issue');
  });

  it('returns an empty label for evidence_passthrough (BR-004 does not relabel)', () => {
    expect(branchDirectionLabel('evidence_passthrough')).toBe('');
  });

  it('every non-empty label is ban-list clean and not an internal code', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      const label = branchDirectionLabel(d);
      if (label === '') continue;
      assertClean(`label:${d}`, label);
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });
});

describe('buildCollapsedBranchSummary — ban-list on produced strings', () => {
  function grammarNode(over: Partial<BranchGrammarNode> = {}): BranchGrammarNode {
    return {
      branchId: over.branchId ?? 'b',
      direction: over.direction ?? 'tangent_diagonal',
      originNodeId: over.originNodeId ?? 'root-1',
      participantCount: over.participantCount ?? 2,
      lastActivityAt: over.lastActivityAt ?? '2026-05-18T10:00:00.000Z',
      unresolvedAxisCount: over.unresolvedAxisCount ?? 1,
      primaryPartyEngaged: over.primaryPartyEngaged ?? false,
      offshootDepthCapReached: over.offshootDepthCapReached ?? false,
    };
  }

  it('summaryLine + accessibilityLabel are ban-list clean for every direction and count combo', () => {
    for (const direction of ALL_BRANCH_DIRECTIONS) {
      for (const count of [0, 1, 2, 7]) {
        for (const open of [0, 1, 3]) {
          for (const engaged of [true, false]) {
            const s = buildCollapsedBranchSummary({
              grammarNode: grammarNode({
                direction,
                participantCount: count,
                unresolvedAxisCount: open,
                primaryPartyEngaged: engaged,
              }),
              hiddenMessageCount: count,
            });
            assertClean('summaryLine', s.summaryLine);
            assertClean('accessibilityLabel', s.accessibilityLabel);
          }
        }
      }
    }
  });

  it('summaryLine never reads as an internal code', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode(),
      hiddenMessageCount: 3,
    });
    expect(looksLikeInternalCode(s.summaryLine)).toBe(false);
    expect(looksLikeInternalCode(s.accessibilityLabel)).toBe(false);
  });

  it('a null-recency summary is still ban-list clean', () => {
    const s = buildCollapsedBranchSummary({
      grammarNode: grammarNode({ lastActivityAt: null }),
      hiddenMessageCount: 2,
    });
    assertClean('summaryLine-null', s.summaryLine);
    assertClean('accessibilityLabel-null', s.accessibilityLabel);
  });
});

describe('BranchDirectionVisual.accessibilityFragment — ban-list', () => {
  it('every accessibilityFragment is ban-list clean and not an internal code', () => {
    for (const d of ALL_BRANCH_DIRECTIONS) {
      const fragment = buildBranchDirectionVisual(d).accessibilityFragment;
      assertClean(`fragment:${d}`, fragment);
      expect(looksLikeInternalCode(fragment)).toBe(false);
    }
  });
});
