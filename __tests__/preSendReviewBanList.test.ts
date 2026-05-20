/**
 * RULE-004 — pre-send review copy ban-list scan.
 *
 * Scans every produced string — every advisory `plainLanguage`, every
 * structural-block `plainLanguage`, the three frozen gameCopy blocks
 * (`PRESEND_ADVISORY_COPY` / `PRESEND_BLOCK_COPY` / `PRESEND_SHEET_COPY`)
 * — for the forbidden verdict / amplification / block / person-
 * attribution token list. Zero matches allowed.
 *
 * Also enforces the RULE-004 acceptance criteria:
 *   - no advisory copy contains dodge / dodging / evading / avoiding
 *     (copy is move-level, never person-level — non-punitive);
 *   - `permanent_record_warning` copy contains no fear token (judged /
 *     punished / damage — honest, not fear-based);
 *   - `looksLikeInternalCode` is false for every produced string.
 *
 * Mirrors `channelCopyBanList.test.ts` — the precedent safety test.
 *
 * Pure-TS — no React, no Supabase, no network.
 */
import {
  ALL_ADVISORY_KINDS,
  _forbiddenPreSendTokens,
  buildPreSendReview,
  type AdvisoryKind,
  type PreSendReviewInput,
} from '../src/features/arguments/preSendReviewModel';
import {
  PRESEND_ADVISORY_COPY,
  PRESEND_BLOCK_COPY,
  PRESEND_SHEET_COPY,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';
import { DEFAULT_PRESEND_ROOM_CONTEXT } from '../src/features/arguments/preSendReviewModel';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import { FLAG_CODES } from '../src/domain/constitution/types';
import type { EvaluationResult } from '../src/domain/constitution/types';

/**
 * Short everyday-English verdict words scanned with word boundaries to
 * avoid false hits ("true to form"). Substring tokens are unambiguous.
 */
const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'won',
  'lost',
  'right',
  'wrong',
  'bot',
  'views',
]);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

// ── Collect every produced string ──────────────────────────────

function makeDraft(): ComposerDraft {
  return {
    draftId: 'd1',
    debateId: 'db1',
    parentId: 'p1',
    argumentType: 'evidence',
    side: 'affirmative',
    body: 'x'.repeat(400),
    selectedTagCodes: ['tangent'],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-20T00:00:00.000Z',
    dirty: true,
  };
}

function makeEvaluationWithEverything(): EvaluationResult {
  return {
    allowPost: false,
    blockingErrors: [
      {
        ruleCode: 'r',
        flagCode: FLAG_CODES.UNCLEAR_CLAIM,
        severity: 'blocking',
        message: 'm',
        payload: {},
      },
      {
        ruleCode: 'r',
        flagCode: FLAG_CODES.EXCESSIVE_LENGTH,
        severity: 'blocking',
        message: 'm',
        payload: {},
      },
      {
        ruleCode: 'r',
        flagCode: FLAG_CODES.EVIDENCE_REQUIRED,
        severity: 'blocking',
        message: 'm',
        payload: {},
      },
      {
        ruleCode: 'r',
        flagCode: FLAG_CODES.INVALID_TRANSITION,
        severity: 'blocking',
        message: 'm',
        payload: {},
      },
    ],
    warnings: [
      {
        ruleCode: 'r',
        flagCode: FLAG_CODES.WEAK_TOPIC,
        severity: 'warning',
        message: 'm',
        payload: {},
      },
    ],
    flagsToPersist: [],
    normalizedTags: [],
    clientValidationPayload: {
      checkedAt: 'n',
      constitutionVersion: 'v',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
    serverValidationPayload: {
      checkedAt: 'n',
      constitutionVersion: 'v',
      ruleCodesChecked: [],
      flagCount: 0,
      blockingCount: 0,
    },
  };
}

/**
 * Builds a maximal review that exercises every advisory kind + every
 * structural-block kind, then collects every produced user-facing string.
 */
function allProducedStrings(): Array<{ where: string; value: string }> {
  const out: Array<{ where: string; value: string }> = [];

  for (const [k, v] of Object.entries(PRESEND_ADVISORY_COPY)) {
    out.push({ where: `PRESEND_ADVISORY_COPY.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(PRESEND_BLOCK_COPY)) {
    out.push({ where: `PRESEND_BLOCK_COPY.${k}`, value: v });
  }
  for (const [k, v] of Object.entries(PRESEND_SHEET_COPY)) {
    out.push({ where: `PRESEND_SHEET_COPY.${k}`, value: v });
  }

  // Strings as they emerge through the model itself.
  const input: PreSendReviewInput = {
    draft: makeDraft(),
    mode: 'strict',
    parent: {
      id: 'p1',
      debateId: 'db1',
      parentId: null,
      authorId: 'u1',
      argumentType: 'thesis',
      side: 'affirmative',
      body: 'parent',
      depth: 8,
      status: 'posted',
      targetExcerpt: null,
      disagreementAxis: null,
      railPayload: {},
      clientValidation: {},
      serverValidation: {},
      clientSubmissionId: null,
      createdAt: 'n',
      updatedAt: 'n',
    },
    room: DEFAULT_PRESEND_ROOM_CONTEXT,
    lifecycle: {
      parentSnapshot: null,
      parentClusterSummary: null,
      parentLinkage: null,
    },
    evaluation: makeEvaluationWithEverything(),
    channelSuggestion: {
      suggested: 'branch_tangent',
      reason: 'deterministic_match',
      confidence: 'high',
      rationale: 'This reads like a new issue — branching keeps the thread clear.',
      isMismatch: true,
    },
    isFirstPostInSession: true,
    // BR-003 — a tangentContext that yields a `strong` introduces_new_axis
    // assessment so the maximal review also exercises `tangent_redirect`.
    // Its own draft carries a declared axis that mismatches the parent's
    // lifecycle axis; it is not suppressed by the asks_new_question de-dup
    // because the reason is structural, not a tangent tag.
    tangentContext: {
      draft: {
        ...makeDraft(),
        selectedTagCodes: [],
        disagreementAxis: 'value',
      },
      parent: {
        id: 'p1',
        debateId: 'db1',
        parentId: null,
        authorId: 'u1',
        argumentType: 'thesis',
        side: 'affirmative',
        body: 'parent',
        depth: 8,
        status: 'posted',
        targetExcerpt: null,
        disagreementAxis: null,
        railPayload: {},
        clientValidation: {},
        serverValidation: {},
        clientSubmissionId: null,
        createdAt: 'n',
        updatedAt: 'n',
      },
      lifecycle: {
        parentSnapshot: {
          messageId: 'p1',
          clusterId: 'p1',
          clusterState: 'open',
          messageContribution: 'open',
          axis: 'fact',
          opensRequest: false,
          resolvesRequest: false,
          isConcessionShape: false,
          isSynthesisShape: false,
          plainLabel: 'Open for response',
        },
        parentClusterSummary: null,
        parentLinkage: null,
      },
      manualTags: [],
    },
  };
  const review = buildPreSendReview(input);
  for (const advisory of review.advisories) {
    out.push({
      where: `advisory.${advisory.kind}.plainLanguage`,
      value: advisory.plainLanguage,
    });
  }
  for (const block of review.structuralBlocks) {
    out.push({
      where: `structuralBlock.${block.kind}.plainLanguage`,
      value: block.plainLanguage,
    });
  }
  return out;
}

// ── Tests ──────────────────────────────────────────────────────

describe('preSendReview copy — ban-list scan', () => {
  const strings = allProducedStrings();
  const banned = _forbiddenPreSendTokens();

  it('produces a non-empty set of strings to scan', () => {
    expect(strings.length).toBeGreaterThan(0);
  });

  it('exercises every advisory kind in the model output', () => {
    // The maximal input should surface all 8 advisory kinds (BR-003 added
    // `tangent_redirect`; the maximal input carries a tangentContext).
    const advisoryStrings = strings.filter((s) =>
      s.where.startsWith('advisory.'),
    );
    const seen = new Set(
      advisoryStrings.map((s) => s.where.split('.')[1] as AdvisoryKind),
    );
    for (const kind of ALL_ADVISORY_KINDS) {
      expect(seen.has(kind)).toBe(true);
    }
  });

  it('contains zero forbidden verdict / amplification / block tokens', () => {
    for (const { where, value } of strings) {
      for (const token of banned) {
        if (hitsBanned(value, token)) {
          throw new Error(
            `Forbidden token "${token}" found in ${where}: "${value}"`,
          );
        }
      }
    }
  });

  it('no advisory copy is punitive (no dodge / evade / avoid)', () => {
    const punitive = ['dodge', 'dodging', 'evade', 'evading', 'avoiding'];
    for (const { where, value } of strings) {
      for (const token of punitive) {
        expect(value.toLowerCase()).not.toContain(token);
        // also assert `where` is referenced so a failure is locatable.
        expect(typeof where).toBe('string');
      }
    }
  });

  it('permanent_record_warning copy is honest, not fear-based', () => {
    const fearTokens = ['judged', 'judgement', 'judgment', 'punished', 'damage'];
    const copy = PRESEND_ADVISORY_COPY.permanent_record_warning.toLowerCase();
    for (const token of fearTokens) {
      expect(copy).not.toContain(token);
    }
  });

  it('no produced string looks like an internal code', () => {
    for (const { where, value } of strings) {
      if (looksLikeInternalCode(value)) {
        throw new Error(`String at ${where} looks like an internal code: "${value}"`);
      }
    }
  });

  it('every produced string is non-empty plain text', () => {
    for (const { where, value } of strings) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(typeof where).toBe('string');
    }
  });
});
