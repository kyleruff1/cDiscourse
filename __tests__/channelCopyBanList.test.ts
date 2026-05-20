/**
 * RULE-005 — channel copy ban-list scan.
 *
 * Scans every produced string — every channel label, every channel
 * purpose, every rationale line, and the three frozen gameCopy blocks —
 * for the forbidden verdict / amplification / block / person-attribution
 * token list. Zero matches allowed.
 *
 * Also asserts the branch_tangent rationale is non-punitive (no dodge /
 * evade / avoid) per the RULE-005 acceptance criterion, and that no
 * channel label looks like an internal code.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ACTIVE_MOVE_CHANNELS,
  CHANNEL_DEFINITIONS,
  getChannelLabel,
  suggestChannelFromDraft,
  _forbiddenChannelTokens,
  type SuggestChannelDraftInput,
  type SuggestChannelParentInput,
  type ChannelSuggestionReason,
} from '../src/features/arguments/channelModel';
import {
  CHANNEL_LABEL_COPY,
  CHANNEL_PURPOSE_COPY,
  CHANNEL_RATIONALE_COPY,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

/**
 * Short everyday-English verdict words scanned with word boundaries to
 * avoid false hits ("true to form"). Substring tokens are unambiguous.
 */
const WORD_BOUNDARY_TOKENS = new Set(['true', 'false', 'won', 'lost', 'right', 'wrong']);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

/** Collects every user-facing string RULE-005 can produce. */
function allProducedStrings(): Array<{ where: string; value: string }> {
  const out: Array<{ where: string; value: string }> = [];
  for (const [k, v] of Object.entries(CHANNEL_LABEL_COPY)) {
    out.push({ where: `CHANNEL_LABEL_COPY.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(CHANNEL_PURPOSE_COPY)) {
    out.push({ where: `CHANNEL_PURPOSE_COPY.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(CHANNEL_RATIONALE_COPY)) {
    out.push({ where: `CHANNEL_RATIONALE_COPY.${k}`, value: v });
  }
  for (const c of ACTIVE_MOVE_CHANNELS) {
    out.push({ where: `getChannelLabel(${c})`, value: getChannelLabel(c) });
    out.push({ where: `CHANNEL_DEFINITIONS.${c}.purpose`, value: CHANNEL_DEFINITIONS[c].purpose });
  }
  return out;
}

describe('RULE-005 channel copy — ban-list scan', () => {
  const tokens = _forbiddenChannelTokens();
  const produced = allProducedStrings();

  it('the forbidden token list is non-empty and all lowercase', () => {
    expect(tokens.length).toBeGreaterThan(0);
    for (const t of tokens) expect(t).toBe(t.toLowerCase());
  });

  it('no produced string contains a forbidden token', () => {
    for (const { where, value } of produced) {
      for (const token of tokens) {
        expect({ where, value, hit: hitsBanned(value, token) ? token : null }).toEqual({
          where,
          value,
          hit: null,
        });
      }
    }
  });

  it('every produced rationale string from suggestChannelFromDraft is clean', () => {
    // Drive each ChannelSuggestionReason path and scan the rationale.
    const draft: SuggestChannelDraftInput = {
      argumentType: null,
      disagreementAxis: null,
      draftTagCodes: [],
      currentChannel: null,
    };
    const cases: Array<{ reason: ChannelSuggestionReason; parent: SuggestChannelParentInput }> = [
      {
        reason: 'deterministic_match',
        parent: { parentSnapshot: null, parentClusterSummary: null, parentLinkage: null },
      },
      { reason: 'no_signal', parent: { parentSnapshot: null, parentClusterSummary: null, parentLinkage: null } },
    ];
    for (const c of cases) {
      const s = suggestChannelFromDraft(
        c.reason === 'deterministic_match' ? { ...draft, argumentType: 'evidence' } : draft,
        c.parent,
        'casual',
      );
      for (const token of tokens) {
        expect(hitsBanned(s.rationale, token)).toBe(false);
      }
    }
  });
});

describe('RULE-005 channel copy — branch_tangent non-punitive', () => {
  it('the branch_tangent rationale does not blame the person', () => {
    const punitive = ['dodge', 'dodging', 'evade', 'evading', 'evasion', 'avoiding', 'avoid'];
    const line = CHANNEL_RATIONALE_COPY.branch_tangent.toLowerCase();
    for (const p of punitive) {
      expect(line.includes(p)).toBe(false);
    }
  });

  it('a branch_tangent suggestion renders a non-punitive rationale at call time', () => {
    const draft: SuggestChannelDraftInput = {
      argumentType: null,
      disagreementAxis: null,
      draftTagCodes: ['tangent'],
      currentChannel: null,
    };
    const s = suggestChannelFromDraft(
      draft,
      { parentSnapshot: null, parentClusterSummary: null, parentLinkage: null },
      'casual',
    );
    expect(s.suggested).toBe('branch_tangent');
    const line = s.rationale.toLowerCase();
    expect(line.includes('dodge')).toBe(false);
    expect(line.includes('evad')).toBe(false);
  });

  it('the branch_tangent label is non-punitive ("side issue", not "dodge")', () => {
    expect(getChannelLabel('branch_tangent')).toBe('Branch a side issue');
  });
});

describe('RULE-005 channel copy — concede never reads as a defeat', () => {
  it('the concede purpose describes the move shape, not a loss', () => {
    const purpose = CHANNEL_DEFINITIONS.concede.purpose.toLowerCase();
    expect(purpose.includes('lost')).toBe(false);
    expect(purpose.includes('defeat')).toBe(false);
    expect(purpose.includes('loser')).toBe(false);
    expect(/\bwrong\b/.test(purpose)).toBe(false);
  });

  it('the concede channel followup is synthesize, not a punitive terminal', () => {
    expect(CHANNEL_DEFINITIONS.concede.suggestedFollowups).toContain('synthesize');
  });
});

describe('RULE-005 channel copy — plain-language guard', () => {
  it('no channel label looks like an internal code', () => {
    for (const c of ACTIVE_MOVE_CHANNELS) {
      expect(looksLikeInternalCode(getChannelLabel(c))).toBe(false);
    }
  });

  it('no produced label contains a snake_case identifier', () => {
    const snake = /[a-z]_[a-z]/i;
    for (const v of Object.values(CHANNEL_LABEL_COPY)) {
      expect(snake.test(v)).toBe(false);
    }
  });

  it('label length budget — every channel label is ≤ 48 chars', () => {
    for (const v of Object.values(CHANNEL_LABEL_COPY)) {
      expect(v.length).toBeLessThanOrEqual(48);
    }
  });

  it('purpose / rationale length budget — every line is ≤ 90 chars', () => {
    for (const v of Object.values(CHANNEL_PURPOSE_COPY)) {
      expect(v.length).toBeLessThanOrEqual(90);
    }
    for (const v of Object.values(CHANNEL_RATIONALE_COPY)) {
      expect(v.length).toBeLessThanOrEqual(90);
    }
  });
});

describe('RULE-005 channel copy — frozen structure', () => {
  it('the three copy blocks are frozen', () => {
    expect(Object.isFrozen(CHANNEL_LABEL_COPY)).toBe(true);
    expect(Object.isFrozen(CHANNEL_PURPOSE_COPY)).toBe(true);
    expect(Object.isFrozen(CHANNEL_RATIONALE_COPY)).toBe(true);
  });

  it('the channel-label block has exactly the 12 active channel keys', () => {
    expect(Object.keys(CHANNEL_LABEL_COPY).sort()).toEqual([...ACTIVE_MOVE_CHANNELS].sort());
  });
});
