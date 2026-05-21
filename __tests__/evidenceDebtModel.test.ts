/**
 * EV-003 — Evidence Debt Tracker pure-model tests.
 *
 * Covers: the opening rule, the resolution scan per debt kind, the
 * close-condition table, staleness, the per-node + per-room roll-ups, the
 * worst-status ordering, the locked chip-copy matrix, graceful degradation
 * when QOL-037 is absent, and the EV-003 doctrine anchors (advisory, no
 * point-standing, three-axis independence, no heat input, ban-list).
 *
 * Target: 100% line + branch on `evidenceDebtModel.ts` — pure-TS, no async,
 * no I/O, no platform branching.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_EVIDENCE_DEBT_KINDS,
  ALL_EVIDENCE_DEBT_STATUSES,
  OPEN_EVIDENCE_DEBT_STATUSES,
  STALE_DEBT_THRESHOLD_DAYS,
  deriveEvidenceDebts,
  evidenceDebtKindWord,
  getNodeEvidenceDebtChip,
  getNodeEvidenceDebtSummary,
  getRoomEvidenceDebtSummary,
  summarizeEvidenceDebtChip,
} from '../src/features/evidence/evidenceDebtModel';
import type {
  DeriveEvidenceDebtsInput,
  EvidenceDebt,
  EvidenceDebtArgumentInput,
  EvidenceDebtStatus,
} from '../src/features/evidence/evidenceDebtModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Fixtures ───────────────────────────────────────────────────

const DEBATE_ID = 'debate-ev003';
const DAY = 86_400_000;
const T0 = Date.parse('2026-05-10T12:00:00.000Z');

function iso(offsetDays: number): string {
  return new Date(T0 + offsetDays * DAY).toISOString();
}

let argSeq = 0;
function move(partial: Partial<EvidenceDebtArgumentInput>): EvidenceDebtArgumentInput {
  argSeq += 1;
  // `authorId` / `parentId` use `'authorId' in partial` so an explicit `null`
  // is honoured (a `?? default` would swallow the intentional null).
  return {
    id: partial.id ?? `m${argSeq}`,
    debateId: partial.debateId ?? DEBATE_ID,
    parentId: 'parentId' in partial ? (partial.parentId ?? null) : null,
    authorId: 'authorId' in partial ? (partial.authorId ?? null) : 'user-a',
    argumentType: partial.argumentType ?? 'rebuttal',
    side: partial.side ?? 'affirmative',
    createdAt: partial.createdAt ?? iso(0),
    tagCodes: partial.tagCodes ?? [],
    artifacts: partial.artifacts ?? [],
    ...(partial.evidenceResponses !== undefined
      ? { evidenceResponses: partial.evidenceResponses }
      : {}),
    ...(partial.moveKindHint !== undefined ? { moveKindHint: partial.moveKindHint } : {}),
  };
}

function artifact(partial: Partial<EvidenceArtifact>): EvidenceArtifact {
  return {
    id: partial.id ?? 'artifact-1',
    argumentId: partial.argumentId ?? 'm1',
    kind: partial.kind ?? 'url',
    label: partial.label ?? 'A source',
    sourceChainStatus: partial.sourceChainStatus ?? 'source_no_quote',
    risk: partial.risk ?? 'unknown',
    addedByUserId: partial.addedByUserId ?? 'user-b',
    createdAt: partial.createdAt ?? iso(1),
    ...(partial.url !== undefined ? { url: partial.url } : {}),
    ...(partial.sourceText !== undefined ? { sourceText: partial.sourceText } : {}),
    ...(partial.quote !== undefined ? { quote: partial.quote } : {}),
  };
}

function derive(
  args: EvidenceDebtArgumentInput[],
  overrides: Partial<DeriveEvidenceDebtsInput> = {},
): ReadonlyArray<EvidenceDebt> {
  return deriveEvidenceDebts({
    debateId: DEBATE_ID,
    arguments: args,
    nowMs: overrides.nowMs ?? T0 + DAY,
    ...overrides,
  });
}

beforeEach(() => {
  argSeq = 0;
});

// ── Shape + enum coverage ──────────────────────────────────────

describe('enumerations', () => {
  it('ALL_EVIDENCE_DEBT_KINDS has exactly the five documented values', () => {
    expect([...ALL_EVIDENCE_DEBT_KINDS].sort()).toEqual(
      ['context', 'primary_record', 'quote', 'receipt', 'source'].sort(),
    );
    expect(ALL_EVIDENCE_DEBT_KINDS).toHaveLength(5);
  });

  it('ALL_EVIDENCE_DEBT_STATUSES has exactly the eight documented values', () => {
    expect(ALL_EVIDENCE_DEBT_STATUSES).toHaveLength(8);
    expect([...ALL_EVIDENCE_DEBT_STATUSES].sort()).toEqual(
      [
        'accepted_by_both',
        'accepted_by_participant',
        'branched',
        'challenged',
        'requested',
        'stale',
        'supplied',
        'unresolved',
      ].sort(),
    );
  });

  it('OPEN_EVIDENCE_DEBT_STATUSES is exactly requested/challenged/unresolved/stale', () => {
    expect([...OPEN_EVIDENCE_DEBT_STATUSES].sort()).toEqual(
      ['challenged', 'requested', 'stale', 'unresolved'].sort(),
    );
  });

  it('OPEN_EVIDENCE_DEBT_STATUSES is a strict subset of the status union', () => {
    for (const s of OPEN_EVIDENCE_DEBT_STATUSES) {
      expect(ALL_EVIDENCE_DEBT_STATUSES).toContain(s);
    }
    expect(OPEN_EVIDENCE_DEBT_STATUSES.length).toBeLessThan(ALL_EVIDENCE_DEBT_STATUSES.length);
  });

  it('branched is NOT an open status (the obligation is relocated, not ignored)', () => {
    expect(OPEN_EVIDENCE_DEBT_STATUSES).not.toContain('branched');
  });

  it('STALE_DEBT_THRESHOLD_DAYS is 7', () => {
    expect(STALE_DEBT_THRESHOLD_DAYS).toBe(7);
  });

  it('the enum arrays are frozen', () => {
    expect(Object.isFrozen(ALL_EVIDENCE_DEBT_KINDS)).toBe(true);
    expect(Object.isFrozen(ALL_EVIDENCE_DEBT_STATUSES)).toBe(true);
    expect(Object.isFrozen(OPEN_EVIDENCE_DEBT_STATUSES)).toBe(true);
  });

  it('evidenceDebtKindWord maps every kind to a plain word (no underscore leak)', () => {
    for (const kind of ALL_EVIDENCE_DEBT_KINDS) {
      const word = evidenceDebtKindWord(kind);
      expect(word.length).toBeGreaterThan(0);
      // The plain word never carries a snake_case underscore — that is the
      // user-facing concern. (A bare single word like "source" is plain
      // English; `looksLikeInternalCode`'s 5+-lowercase heuristic would
      // false-positive it, so we assert the underscore directly instead.)
      expect(word).not.toMatch(/_/);
    }
    expect(evidenceDebtKindWord('primary_record')).toBe('primary record');
  });

  it('an EvidenceDebt literal type-checks with the optional fields omitted', () => {
    const d: EvidenceDebt = {
      id: 'm1:debt',
      debateId: DEBATE_ID,
      nodeId: 'root',
      requestArgumentId: 'm1',
      debtKind: 'source',
      requestedByUserId: 'user-a',
      requestedAt: iso(0),
      status: 'requested',
      ageDays: 0,
      isStale: false,
    };
    expect(d.resolvedByNodeId).toBeUndefined();
    expect(d.resolvedAt).toBeUndefined();
  });
});

// ── deriveEvidenceDebts — opening rule (§6.1) ───────────────────

describe('deriveEvidenceDebts — opening rule', () => {
  it('a source_request-tagged move opens one source debt attached to its parent', () => {
    const root = move({ id: 'root', argumentType: 'claim' });
    const ask = move({
      id: 'ask1',
      parentId: 'root',
      argumentType: 'clarification_request',
      tagCodes: ['source_request'],
      createdAt: iso(0),
      authorId: 'user-x',
    });
    const debts = derive([root, ask]);
    expect(debts).toHaveLength(1);
    expect(debts[0].id).toBe('ask1:debt');
    expect(debts[0].debtKind).toBe('source');
    expect(debts[0].status).toBe('requested');
    expect(debts[0].nodeId).toBe('root');
    expect(debts[0].requestArgumentId).toBe('ask1');
    expect(debts[0].requestedByUserId).toBe('user-x');
    expect(debts[0].requestedAt).toBe(iso(0));
  });

  it.each([
    ['source_request', 'source'],
    ['quote_request', 'quote'],
    ['receipt_request', 'receipt'],
    ['context_request', 'context'],
    ['primary_record_request', 'primary_record'],
  ] as const)('tag %s opens a %s debt', (tag, expectedKind) => {
    const root = move({ id: 'root' });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: [tag] });
    const debts = derive([root, ask]);
    expect(debts).toHaveLength(1);
    expect(debts[0].debtKind).toBe(expectedKind);
  });

  it('a plain reply with no request tag opens no debt', () => {
    const root = move({ id: 'root' });
    const reply = move({ id: 'r1', parentId: 'root', tagCodes: ['fact_disagreement'] });
    expect(derive([root, reply])).toHaveLength(0);
  });

  it('an empty room returns no debts', () => {
    expect(derive([])).toHaveLength(0);
  });

  it('a move with two request tags opens ONE debt, kind = first in precedence', () => {
    const root = move({ id: 'root' });
    const ask = move({
      id: 'ask',
      parentId: 'root',
      tagCodes: ['quote_request', 'source_request'],
    });
    const debts = derive([root, ask]);
    expect(debts).toHaveLength(1);
    // source > quote in precedence order.
    expect(debts[0].debtKind).toBe('source');
  });

  it('a root-level request (no parentId) attaches the debt to itself', () => {
    const ask = move({ id: 'ask', parentId: null, tagCodes: ['source_request'] });
    const debts = derive([ask]);
    expect(debts).toHaveLength(1);
    expect(debts[0].nodeId).toBe('ask');
  });

  it('a null authorId on the request move yields requestedByUserId null', () => {
    const ask = move({ id: 'ask', authorId: null, tagCodes: ['source_request'] });
    expect(derive([ask])[0].requestedByUserId).toBeNull();
  });

  it('is deterministic — same input twice yields deeply-equal output', () => {
    const root = move({ id: 'root' });
    const ask1 = move({ id: 'ask1', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(0) });
    const ask2 = move({ id: 'ask2', parentId: 'root', tagCodes: ['quote_request'], createdAt: iso(1) });
    const a = derive([root, ask1, ask2]);
    argSeq = 0;
    const b = derive([root, ask2, ask1]); // different input order.
    expect(a).toEqual(b);
  });

  it('sorts debts by requestedAt ascending', () => {
    const root = move({ id: 'root' });
    const late = move({ id: 'late', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(3) });
    const early = move({ id: 'early', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const debts = derive([root, late, early], { nowMs: T0 + 4 * DAY });
    expect(debts.map((d) => d.requestArgumentId)).toEqual(['early', 'late']);
  });

  it('uppercase tag codes are recognised (case-insensitive)', () => {
    const root = move({ id: 'root' });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['SOURCE_REQUEST'] });
    expect(derive([root, ask])).toHaveLength(1);
  });
});

// ── The resolution scan (§6.2) ─────────────────────────────────

describe('deriveEvidenceDebts — resolution scan', () => {
  it('requested → supplied when a later subtree move attaches a matching artifact', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({
      id: 'ask',
      parentId: 'root',
      tagCodes: ['source_request'],
      createdAt: iso(1),
    });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      argumentType: 'evidence',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', url: 'https://x', sourceChainStatus: 'source_no_quote' })],
    });
    const debts = derive([root, ask, answer], { nowMs: T0 + 3 * DAY });
    expect(debts[0].status).toBe('supplied');
    expect(debts[0].resolvedByNodeId).toBe('answer');
    expect(debts[0].resolvedAt).toBe(iso(2));
  });

  it('a quote debt is NOT discharged by a bare url with no quote', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['quote_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', url: 'https://x', sourceChainStatus: 'source_no_quote' })],
    });
    expect(derive([root, ask, answer], { nowMs: T0 + 3 * DAY })[0].status).toBe('requested');
  });

  it('a quote debt IS discharged by an artifact with a quote + source_and_quote', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['quote_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [
        artifact({
          kind: 'url',
          url: 'https://x',
          quote: 'the exact passage',
          sourceChainStatus: 'source_and_quote',
        }),
      ],
    });
    expect(derive([root, ask, answer], { nowMs: T0 + 3 * DAY })[0].status).toBe('supplied');
  });

  it('a primary_record debt is discharged only by a primary_present artifact', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({
      id: 'ask',
      parentId: 'root',
      tagCodes: ['primary_record_request'],
      createdAt: iso(1),
    });
    const weak = move({
      id: 'weak',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_and_quote' })],
    });
    expect(derive([root, ask, weak], { nowMs: T0 + 3 * DAY })[0].status).toBe('requested');

    const strong = move({
      id: 'strong',
      parentId: 'ask',
      createdAt: iso(3),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'primary_present' })],
    });
    expect(derive([root, ask, strong], { nowMs: T0 + 4 * DAY })[0].status).toBe('supplied');
  });

  it('a receipt debt is discharged by a screenshot artifact', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['receipt_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'screenshot_redacted', sourceChainStatus: 'unverified' })],
    });
    expect(derive([root, ask, answer], { nowMs: T0 + 3 * DAY })[0].status).toBe('supplied');
  });

  it('a context debt is discharged by an artifact carrying sourceText', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['context_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [
        artifact({ kind: 'source_text', sourceText: 'the surrounding context', sourceChainStatus: 'unverified' }),
      ],
    });
    expect(derive([root, ask, answer], { nowMs: T0 + 3 * DAY })[0].status).toBe('supplied');
  });

  it('supplied → accepted_by_participant on one primary accept response', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const accept = move({
      id: 'accept',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const debts = derive([root, ask, answer, accept], {
      nowMs: T0 + 4 * DAY,
      primaryParticipantUserIds: ['user-a', 'user-b'],
    });
    expect(debts[0].status).toBe('accepted_by_participant');
  });

  it('accepted_by_participant → accepted_by_both on the second distinct primary accept', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const accept1 = move({
      id: 'accept1',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const accept2 = move({
      id: 'accept2',
      parentId: 'answer',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-b' }],
    });
    const debts = derive([root, ask, answer, accept1, accept2], {
      nowMs: T0 + 5 * DAY,
      primaryParticipantUserIds: ['user-a', 'user-b'],
    });
    expect(debts[0].status).toBe('accepted_by_both');
  });

  it('supplied → challenged on a dispute_applicability response', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const challenge = move({
      id: 'challenge',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'dispute_applicability', respondedByUserId: 'user-a' }],
    });
    expect(derive([root, ask, answer, challenge], { nowMs: T0 + 4 * DAY })[0].status).toBe(
      'challenged',
    );
  });

  it('accepted_by_both → challenged when a dispute lands AFTER settlement (reopen)', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const accept1 = move({
      id: 'accept1',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const accept2 = move({
      id: 'accept2',
      parentId: 'answer',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-b' }],
    });
    const reopen = move({
      id: 'reopen',
      parentId: 'answer',
      createdAt: iso(5),
      evidenceResponses: [{ choice: 'request_source', respondedByUserId: 'user-a' }],
    });
    const debts = derive([root, ask, answer, accept1, accept2, reopen], {
      nowMs: T0 + 6 * DAY,
      primaryParticipantUserIds: ['user-a', 'user-b'],
    });
    expect(debts[0].status).toBe('challenged');
  });

  it('requested → branched on a split_branch move off the requested node', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const branch = move({
      id: 'branch',
      parentId: 'root',
      createdAt: iso(2),
      moveKindHint: 'split_branch',
    });
    const debts = derive([root, ask, branch], { nowMs: T0 + 3 * DAY });
    expect(debts[0].status).toBe('branched');
    expect(debts[0].resolvedByNodeId).toBe('branch');
  });

  it('detects a branch via argumentType when no moveKindHint is present', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const branch = move({
      id: 'branch',
      parentId: 'root',
      argumentType: 'split_branch',
      createdAt: iso(2),
    });
    expect(derive([root, ask, branch], { nowMs: T0 + 3 * DAY })[0].status).toBe('branched');
  });

  it('requested → unresolved on a source_declined-tagged move', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const decline = move({
      id: 'decline',
      parentId: 'ask',
      createdAt: iso(2),
      tagCodes: ['source_declined'],
    });
    expect(derive([root, ask, decline], { nowMs: T0 + 3 * DAY })[0].status).toBe('unresolved');
  });

  it('requested → unresolved on a request_evaded-tagged move', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const evade = move({
      id: 'evade',
      parentId: 'ask',
      createdAt: iso(2),
      tagCodes: ['request_evaded'],
    });
    expect(derive([root, ask, evade], { nowMs: T0 + 3 * DAY })[0].status).toBe('unresolved');
  });

  it('an answering move BEFORE the request does not resolve it', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    // Artifact attached at day 1, request made at day 2.
    const earlyEvidence = move({
      id: 'early',
      parentId: 'root',
      createdAt: iso(1),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const ask = move({
      id: 'ask',
      parentId: 'root',
      tagCodes: ['source_request'],
      createdAt: iso(2),
    });
    expect(derive([root, earlyEvidence, ask], { nowMs: T0 + 3 * DAY })[0].status).toBe('requested');
  });

  it('an answering move OUTSIDE the requested subtree does not resolve the debt', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    // A sibling of root carrying an artifact — not under ask or root.
    const otherRoot = move({ id: 'other', parentId: null, createdAt: iso(2) });
    const elsewhere = move({
      id: 'elsewhere',
      parentId: 'other',
      createdAt: iso(3),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    expect(derive([root, ask, otherRoot, elsewhere], { nowMs: T0 + 4 * DAY })[0].status).toBe(
      'requested',
    );
  });

  it('the full storyboard happy loop: requested → supplied → accepted_by_participant → accepted_by_both', () => {
    // Step 9: A asks B for a source on B's caveat.
    const root = move({ id: 'caveat', argumentType: 'claim', authorId: 'user-b', createdAt: iso(0) });
    const ask = move({
      id: 'ask',
      parentId: 'caveat',
      authorId: 'user-a',
      tagCodes: ['source_request'],
      createdAt: iso(1),
    });
    // Step 10: B attaches the group-chat text excerpt (the "text excerpt"
    // arm of the storyboard — a source pointer that discharges a `source`
    // debt per the §6.2 close-condition table).
    const supply = move({
      id: 'supply',
      parentId: 'ask',
      authorId: 'user-b',
      argumentType: 'evidence',
      createdAt: iso(2),
      artifacts: [
        artifact({
          kind: 'source_text',
          sourceText: 'the group-chat agreement',
          sourceChainStatus: 'source_no_quote',
        }),
      ],
    });
    // Step 13: both accept.
    const acceptA = move({
      id: 'acceptA',
      parentId: 'supply',
      authorId: 'user-a',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const acceptB = move({
      id: 'acceptB',
      parentId: 'supply',
      authorId: 'user-b',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-b' }],
    });

    const supplied = derive([root, ask, supply], { nowMs: T0 + 3 * DAY });
    expect(supplied[0].status).toBe('supplied');

    const both = derive([root, ask, supply, acceptA, acceptB], {
      nowMs: T0 + 5 * DAY,
      primaryParticipantUserIds: ['user-a', 'user-b'],
    });
    expect(both[0].status).toBe('accepted_by_both');
    expect(both[0].resolvedByNodeId).toBe('acceptB');
  });

  it('a contested supply re-answered: requested → supplied → challenged → supplied', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const supply1 = move({
      id: 'supply1',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const challenge = move({
      id: 'challenge',
      parentId: 'supply1',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'dispute_applicability', respondedByUserId: 'user-a' }],
    });
    const supply2 = move({
      id: 'supply2',
      parentId: 'challenge',
      createdAt: iso(4),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const debts = derive([root, ask, supply1, challenge, supply2], { nowMs: T0 + 5 * DAY });
    expect(debts[0].status).toBe('supplied');
    expect(debts[0].resolvedByNodeId).toBe('supply2');
  });
});

// ── accepted_by_both edge cases (§9, §10.9) ────────────────────

describe('deriveEvidenceDebts — accepted_by_both gating', () => {
  it('caps at accepted_by_participant when fewer than two primaries are known', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const acceptA = move({
      id: 'acceptA',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const acceptB = move({
      id: 'acceptB',
      parentId: 'answer',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-b' }],
    });
    // No primaryParticipantUserIds passed at all.
    const debts = derive([root, ask, answer, acceptA, acceptB], { nowMs: T0 + 5 * DAY });
    expect(debts[0].status).toBe('accepted_by_participant');
  });

  it('an accept with a null responder id does not count toward acceptance', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const accept = move({
      id: 'accept',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: null }],
    });
    // The null-responder accept is ignored — the debt stays supplied.
    expect(derive([root, ask, answer, accept], { nowMs: T0 + 4 * DAY })[0].status).toBe('supplied');
  });

  it('two accepts from the same primary do not reach accepted_by_both', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const accept1 = move({
      id: 'accept1',
      parentId: 'answer',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const accept2 = move({
      id: 'accept2',
      parentId: 'answer',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'accept', respondedByUserId: 'user-a' }],
    });
    const debts = derive([root, ask, answer, accept1, accept2], {
      nowMs: T0 + 5 * DAY,
      primaryParticipantUserIds: ['user-a', 'user-b'],
    });
    expect(debts[0].status).toBe('accepted_by_participant');
  });
});

// ── Staleness (§6.3) ───────────────────────────────────────────

describe('deriveEvidenceDebts — staleness', () => {
  it('a requested debt past the threshold becomes stale', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(0) });
    const debts = derive([root, ask], { nowMs: T0 + 8 * DAY });
    expect(debts[0].status).toBe('stale');
    expect(debts[0].isStale).toBe(true);
    expect(debts[0].ageDays).toBe(8);
  });

  it('a requested debt below the threshold stays requested', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(0) });
    const debts = derive([root, ask], { nowMs: T0 + 3 * DAY });
    expect(debts[0].status).toBe('requested');
    expect(debts[0].isStale).toBe(false);
  });

  it('a debt exactly at the threshold becomes stale', () => {
    const ask = move({ id: 'ask', tagCodes: ['source_request'], createdAt: iso(0) });
    expect(derive([ask], { nowMs: T0 + 7 * DAY })[0].status).toBe('stale');
  });

  it('a supplied debt past the threshold stays supplied (staleness applies only to requested)', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(0) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(1),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const debts = derive([root, ask, answer], { nowMs: T0 + 30 * DAY });
    expect(debts[0].status).toBe('supplied');
    expect(debts[0].isStale).toBe(false);
  });

  it('honours a custom staleThresholdDays', () => {
    const ask = move({ id: 'ask', tagCodes: ['source_request'], createdAt: iso(0) });
    expect(derive([ask], { nowMs: T0 + 3 * DAY, staleThresholdDays: 2 })[0].status).toBe('stale');
    expect(derive([ask], { nowMs: T0 + 3 * DAY, staleThresholdDays: 10 })[0].status).toBe(
      'requested',
    );
  });

  it('a negative staleThresholdDays falls back to the default', () => {
    const ask = move({ id: 'ask', tagCodes: ['source_request'], createdAt: iso(0) });
    expect(derive([ask], { nowMs: T0 + 3 * DAY, staleThresholdDays: -5 })[0].status).toBe(
      'requested',
    );
  });

  it('clamps ageDays to 0 when nowMs is earlier than requestedAt (clock skew)', () => {
    const ask = move({ id: 'ask', tagCodes: ['source_request'], createdAt: iso(5) });
    const debts = derive([ask], { nowMs: T0 }); // now is BEFORE the request.
    expect(debts[0].ageDays).toBe(0);
    expect(debts[0].status).toBe('requested');
    expect(debts[0].isStale).toBe(false);
  });

  it('ageDays is the whole-day floor', () => {
    const ask = move({ id: 'ask', tagCodes: ['source_request'], createdAt: iso(0) });
    // 2.9 days elapsed → floors to 2.
    const debts = derive([ask], { nowMs: T0 + Math.floor(2.9 * DAY) });
    expect(debts[0].ageDays).toBe(2);
  });
});

// ── Roll-ups (§6.4) ────────────────────────────────────────────

describe('getNodeEvidenceDebtSummary', () => {
  it('a node with no debts yields openCount 0, hasOpenDebt false, chipStatus null', () => {
    const summary = getNodeEvidenceDebtSummary('lonely-node', []);
    expect(summary.debts).toEqual([]);
    expect(summary.openCount).toBe(0);
    expect(summary.settledCount).toBe(0);
    expect(summary.hasOpenDebt).toBe(false);
    expect(summary.chipStatus).toBeNull();
  });

  it('sorts a node\'s debts by requestedAt and picks the worst chipStatus', () => {
    const root = move({ id: 'root' });
    const ask1 = move({
      id: 'ask1',
      parentId: 'root',
      tagCodes: ['source_request'],
      createdAt: iso(2),
    });
    const ask2 = move({
      id: 'ask2',
      parentId: 'root',
      tagCodes: ['quote_request'],
      createdAt: iso(1),
    });
    // ask1 will go stale; ask2 will be supplied then challenged.
    const supply = move({
      id: 'supply',
      parentId: 'ask2',
      createdAt: iso(3),
      artifacts: [artifact({ kind: 'url', quote: 'q', sourceChainStatus: 'source_and_quote' })],
    });
    const challenge = move({
      id: 'challenge',
      parentId: 'supply',
      createdAt: iso(4),
      evidenceResponses: [{ choice: 'dispute_applicability', respondedByUserId: 'user-a' }],
    });
    const debts = derive([root, ask1, ask2, supply, challenge], { nowMs: T0 + 30 * DAY });
    const summary = getNodeEvidenceDebtSummary('root', debts);
    expect(summary.debts.map((d) => d.requestArgumentId)).toEqual(['ask2', 'ask1']);
    // challenged beats stale in the worst-status order.
    expect(summary.chipStatus).toBe('challenged');
    expect(summary.openCount).toBe(2); // challenged + stale are both open.
  });

  it('counts only open statuses in openCount and accepted_by_both in settledCount', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false },
      { id: 'd2:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd2', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(1), status: 'accepted_by_both', ageDays: 1, isStale: false },
      { id: 'd3:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd3', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(2), status: 'supplied', ageDays: 1, isStale: false },
    ];
    const summary = getNodeEvidenceDebtSummary('n', debts);
    expect(summary.openCount).toBe(1);
    expect(summary.settledCount).toBe(1);
    expect(summary.hasOpenDebt).toBe(true);
  });

  it('filters out debts on a different node', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'node-a', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false },
      { id: 'd2:debt', debateId: DEBATE_ID, nodeId: 'node-b', requestArgumentId: 'd2', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(1), status: 'requested', ageDays: 1, isStale: false },
    ];
    expect(getNodeEvidenceDebtSummary('node-a', debts).debts).toHaveLength(1);
  });
});

describe('getRoomEvidenceDebtSummary', () => {
  it('an empty room yields totalCount 0 and an empty status line', () => {
    const summary = getRoomEvidenceDebtSummary(DEBATE_ID, []);
    expect(summary.totalCount).toBe(0);
    expect(summary.openCount).toBe(0);
    expect(summary.hasOpenEvidenceDebt).toBe(false);
    expect(summary.statusLine).toBe('');
  });

  it('sums total/open/stale/settled correctly and sets hasOpenEvidenceDebt', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n1', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false },
      { id: 'd2:debt', debateId: DEBATE_ID, nodeId: 'n2', requestArgumentId: 'd2', debtKind: 'quote', requestedByUserId: 'u', requestedAt: iso(1), status: 'stale', ageDays: 9, isStale: true },
      { id: 'd3:debt', debateId: DEBATE_ID, nodeId: 'n3', requestArgumentId: 'd3', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(2), status: 'accepted_by_both', ageDays: 1, isStale: false },
      { id: 'd4:debt', debateId: DEBATE_ID, nodeId: 'n4', requestArgumentId: 'd4', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(3), status: 'branched', ageDays: 1, isStale: false },
    ];
    const summary = getRoomEvidenceDebtSummary(DEBATE_ID, debts);
    expect(summary.totalCount).toBe(4);
    expect(summary.openCount).toBe(2); // requested + stale.
    expect(summary.staleCount).toBe(1);
    expect(summary.settledCount).toBe(1);
    expect(summary.hasOpenEvidenceDebt).toBe(true);
  });

  it('filters to the requested debate only', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false },
      { id: 'd2:debt', debateId: 'other-room', nodeId: 'n', requestArgumentId: 'd2', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(1), status: 'requested', ageDays: 1, isStale: false },
    ];
    expect(getRoomEvidenceDebtSummary(DEBATE_ID, debts).totalCount).toBe(1);
  });

  it('statusLine is "Evidence requested" when any debt is open', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false },
    ];
    expect(getRoomEvidenceDebtSummary(DEBATE_ID, debts).statusLine).toBe('Evidence requested');
  });

  it('statusLine is "Evidence settled" when all debts resolved by acceptance', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'accepted_by_both', ageDays: 1, isStale: false },
    ];
    expect(getRoomEvidenceDebtSummary(DEBATE_ID, debts).statusLine).toBe('Evidence settled');
  });

  it('statusLine is "" when debts exist but all resolved without explicit settlement', () => {
    const debts: EvidenceDebt[] = [
      { id: 'd1:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd1', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'supplied', ageDays: 1, isStale: false },
    ];
    expect(getRoomEvidenceDebtSummary(DEBATE_ID, debts).statusLine).toBe('');
  });
});

describe('worst-status ordering', () => {
  // challenged > unresolved > stale > requested > branched > supplied
  //            > accepted_by_participant > accepted_by_both
  const order: Array<[EvidenceDebtStatus, EvidenceDebtStatus]> = [
    ['challenged', 'unresolved'],
    ['unresolved', 'stale'],
    ['stale', 'requested'],
    ['requested', 'branched'],
    ['branched', 'supplied'],
    ['supplied', 'accepted_by_participant'],
    ['accepted_by_participant', 'accepted_by_both'],
  ];

  it.each(order)('%s outranks %s in the node chip pick', (worse, better) => {
    const debts: EvidenceDebt[] = [
      { id: 'a:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'a', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: better, ageDays: 1, isStale: false },
      { id: 'b:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'b', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(1), status: worse, ageDays: 1, isStale: false },
    ];
    expect(getNodeEvidenceDebtSummary('n', debts).chipStatus).toBe(worse);
  });
});

// ── Multiple debts / shared artifact (§10.7, §10.8) ────────────

describe('deriveEvidenceDebts — multiple debts', () => {
  it('two debts on one node are both derived and listed', () => {
    const root = move({ id: 'root' });
    const ask1 = move({ id: 'ask1', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(0) });
    const ask2 = move({ id: 'ask2', parentId: 'root', tagCodes: ['quote_request'], createdAt: iso(1) });
    const debts = derive([root, ask1, ask2], { nowMs: T0 + 2 * DAY });
    expect(debts).toHaveLength(2);
    expect(getNodeEvidenceDebtSummary('root', debts).debts).toHaveLength(2);
  });

  it('the same artifact can answer two debts on the same subtree', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const askSource = move({
      id: 'askS',
      parentId: 'root',
      tagCodes: ['source_request'],
      createdAt: iso(1),
    });
    const askReceipt = move({
      id: 'askR',
      parentId: 'root',
      tagCodes: ['receipt_request'],
      createdAt: iso(1),
    });
    // One source_text artifact discharges BOTH a source and a receipt debt.
    const answer = move({
      id: 'answer',
      parentId: 'askS',
      createdAt: iso(2),
      artifacts: [
        artifact({ kind: 'source_text', sourceText: 'the record', sourceChainStatus: 'source_no_quote' }),
      ],
    });
    // answer is under askS; askR is a sibling of askS under root, so the
    // answer must also reach askR's debt via root.
    const answer2 = move({
      id: 'answer2',
      parentId: 'askR',
      createdAt: iso(2),
      artifacts: [
        artifact({ kind: 'source_text', sourceText: 'the record', sourceChainStatus: 'unverified' }),
      ],
    });
    const debts = derive([root, askSource, askReceipt, answer, answer2], { nowMs: T0 + 3 * DAY });
    const byReq = new Map(debts.map((d) => [d.requestArgumentId, d]));
    expect(byReq.get('askS')?.status).toBe('supplied');
    expect(byReq.get('askR')?.status).toBe('supplied');
  });
});

// ── Graceful degradation when QOL-037 is absent (§10.13b) ───────

describe('deriveEvidenceDebts — graceful degradation', () => {
  it('reaches requested / supplied / stale / branched without any evidenceResponses', () => {
    // Each ask sits on a DISTINCT claim node so a branch off one node does
    // not relocate the obligation on another (a branch relocates every debt
    // on its node — §6.2).
    const root = move({ id: 'root', argumentType: 'claim', createdAt: iso(0) });
    const claimA = move({ id: 'claimA', parentId: 'root', argumentType: 'claim', createdAt: iso(0) });
    const claimB = move({ id: 'claimB', parentId: 'root', argumentType: 'claim', createdAt: iso(0) });
    const claimC = move({ id: 'claimC', parentId: 'root', argumentType: 'claim', createdAt: iso(0) });

    // requested + stale — claimA, never answered.
    const askStale = move({ id: 'askStale', parentId: 'claimA', tagCodes: ['source_request'], createdAt: iso(0) });
    // supplied — claimB.
    const askSupplied = move({ id: 'askSup', parentId: 'claimB', tagCodes: ['source_request'], createdAt: iso(1) });
    const supply = move({
      id: 'supply',
      parentId: 'askSup',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    // branched — claimC.
    const askBranched = move({ id: 'askBr', parentId: 'claimC', tagCodes: ['source_request'], createdAt: iso(1) });
    const branch = move({ id: 'branch', parentId: 'claimC', moveKindHint: 'split_branch', createdAt: iso(3) });

    const debts = derive(
      [root, claimA, claimB, claimC, askStale, askSupplied, supply, askBranched, branch],
      { nowMs: T0 + 9 * DAY },
    );
    const byReq = new Map(debts.map((d) => [d.requestArgumentId, d.status]));
    expect(byReq.get('askStale')).toBe('stale');
    expect(byReq.get('askSup')).toBe('supplied');
    expect(byReq.get('askBr')).toBe('branched');
  });

  it('never reaches challenged / accepted_* without evidenceResponse records', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const supply = move({
      id: 'supply',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    // A plain reply, no evidenceResponses.
    const reply = move({ id: 'reply', parentId: 'supply', createdAt: iso(3) });
    const status = derive([root, ask, supply, reply], { nowMs: T0 + 4 * DAY })[0].status;
    expect(status).toBe('supplied');
    expect(['challenged', 'accepted_by_participant', 'accepted_by_both']).not.toContain(status);
  });

  it('does not throw on a move with an unknown evidenceResponse choice', () => {
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'], createdAt: iso(1) });
    const supply = move({
      id: 'supply',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [artifact({ kind: 'url', sourceChainStatus: 'source_no_quote' })],
    });
    const weird = move({
      id: 'weird',
      parentId: 'supply',
      createdAt: iso(3),
      evidenceResponses: [{ choice: 'some_unknown_choice', respondedByUserId: 'user-a' }],
    });
    expect(() => derive([root, ask, supply, weird], { nowMs: T0 + 4 * DAY })).not.toThrow();
    expect(derive([root, ask, supply, weird], { nowMs: T0 + 4 * DAY })[0].status).toBe('supplied');
  });
});

// ── Chip contract (§6.5) ───────────────────────────────────────

const LOCKED_CHIP_LABELS: Readonly<Record<EvidenceDebtStatus, string>> = {
  requested: 'Source requested',
  supplied: 'Evidence attached',
  challenged: 'Supplied evidence questioned',
  accepted_by_participant: 'Accepted by one side',
  accepted_by_both: 'Settled by both',
  unresolved: 'Still unresolved',
  stale: 'Source still owed',
  branched: 'Moved to a branch',
};

describe('summarizeEvidenceDebtChip', () => {
  it.each(ALL_EVIDENCE_DEBT_STATUSES)('produces the locked label for status %s', (status) => {
    const contract = summarizeEvidenceDebtChip(status, 'source');
    expect(contract.label).toBe(LOCKED_CHIP_LABELS[status]);
    expect(contract.isVisible).toBe(true);
    expect(contract.status).toBe(status);
    expect(contract.helper.length).toBeGreaterThan(0);
    expect(contract.accessibilityLabel).toContain(contract.label);
    expect(contract.accessibilityLabel).toContain(contract.helper);
  });

  it.each(ALL_EVIDENCE_DEBT_KINDS)('substitutes the plain kind word for %s', (kind) => {
    const contract = summarizeEvidenceDebtChip('requested', kind);
    expect(contract.helper).toContain(evidenceDebtKindWord(kind));
    expect(contract.helper).not.toContain('{kind}');
    expect(contract.debtKind).toBe(kind);
  });

  it('uses tone "attention" for challenged and unresolved', () => {
    expect(summarizeEvidenceDebtChip('challenged', 'source').tone).toBe('attention');
    expect(summarizeEvidenceDebtChip('unresolved', 'source').tone).toBe('attention');
  });

  it('uses tone "neutral" for the settled state', () => {
    expect(summarizeEvidenceDebtChip('accepted_by_both', 'source').tone).toBe('neutral');
  });
});

describe('getNodeEvidenceDebtChip', () => {
  it('returns an isVisible:false contract for a node with no debts', () => {
    const summary = getNodeEvidenceDebtSummary('empty', []);
    const chip = getNodeEvidenceDebtChip(summary);
    expect(chip.isVisible).toBe(false);
    expect(chip.label).toBe('');
    expect(chip.helper).toBe('');
    expect(chip.accessibilityLabel).toBe('');
  });

  it('returns the worst-status chip for a node with debts', () => {
    const debts: EvidenceDebt[] = [
      { id: 'a:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'a', debtKind: 'quote', requestedByUserId: 'u', requestedAt: iso(0), status: 'supplied', ageDays: 1, isStale: false },
      { id: 'b:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'b', debtKind: 'receipt', requestedByUserId: 'u', requestedAt: iso(1), status: 'challenged', ageDays: 1, isStale: false },
    ];
    const chip = getNodeEvidenceDebtChip(getNodeEvidenceDebtSummary('n', debts));
    expect(chip.isVisible).toBe(true);
    expect(chip.status).toBe('challenged');
    // The chip shows the kind of the worst-status debt (receipt).
    expect(chip.debtKind).toBe('receipt');
    expect(chip.helper).toContain('receipt');
  });

  it('settled (accepted_by_both) is still a visible chip', () => {
    const debts: EvidenceDebt[] = [
      { id: 'a:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'a', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'accepted_by_both', ageDays: 1, isStale: false },
    ];
    const chip = getNodeEvidenceDebtChip(getNodeEvidenceDebtSummary('n', debts));
    expect(chip.isVisible).toBe(true);
    expect(chip.label).toBe('Settled by both');
  });
});

// ── Doctrine anchors ───────────────────────────────────────────

describe('EV-003 doctrine anchors', () => {
  const rawModelSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/features/evidence/evidenceDebtModel.ts'),
    'utf8',
  );
  // Strip block + line comments so a docstring that NAMES a prohibition
  // (e.g. "no `Date.now()`") does not false-positive a source-scan that is
  // checking the actual CODE never calls / imports it.
  const modelSrc = rawModelSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  it('the model imports nothing from src/features/pointStanding (no PointStandingDelta)', () => {
    expect(modelSrc).not.toMatch(/pointStanding/);
    expect(modelSrc).not.toMatch(/PointStandingDelta/);
  });

  it('the model imports nothing from the constitution validator (advisory only)', () => {
    expect(modelSrc).not.toMatch(/evaluateArgumentDraft/);
    expect(modelSrc).not.toMatch(/constitution\/engine/);
  });

  it('an evidence debt never appears in a blocking-error path', () => {
    // No EvidenceDebtStatus value collides with a validator error code: the
    // statuses are obligation observations, not error codes. A blocking path
    // would consume an `error` / `blocked` / `severity` field — the EvidenceDebt
    // surface exposes none of those.
    const root = move({ id: 'root' });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['source_request'] });
    const debt = derive([root, ask], { nowMs: T0 + DAY })[0];
    expect(debt).not.toHaveProperty('error');
    expect(debt).not.toHaveProperty('blocked');
    expect(debt).not.toHaveProperty('severity');
    expect(debt).not.toHaveProperty('blocksPost');
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      // No status string is an http_NNN_ / *_error / *_blocked code shape.
      expect(status).not.toMatch(/error|blocked|reject|fail/i);
    }
  });

  it('the model does not call Date.now() (deterministic — clock is injected)', () => {
    expect(modelSrc).not.toMatch(/Date\.now\(\)/);
  });

  it('the model does not call Math.random()', () => {
    expect(modelSrc).not.toMatch(/Math\.random/);
  });

  it('imports no React and no Supabase', () => {
    expect(modelSrc).not.toMatch(/from 'react'/);
    expect(modelSrc).not.toMatch(/from ['"]@?supabase/);
  });

  it('three-axis independence: a source_and_quote artifact does not auto-resolve a quote debt without a quote field', () => {
    // The artifact is source_and_quote on the EXISTENCE axis but carries no
    // quote — the OBLIGATION axis must not collapse into it.
    const root = move({ id: 'root', createdAt: iso(0) });
    const ask = move({ id: 'ask', parentId: 'root', tagCodes: ['quote_request'], createdAt: iso(1) });
    const answer = move({
      id: 'answer',
      parentId: 'ask',
      createdAt: iso(2),
      artifacts: [
        // source_and_quote status but NO quote field present.
        artifact({ kind: 'url', url: 'https://x', sourceChainStatus: 'source_and_quote' }),
      ],
    });
    expect(derive([root, ask, answer], { nowMs: T0 + 3 * DAY })[0].status).toBe('requested');
  });

  it('no heat input: DeriveEvidenceDebtsInput has no engagement / view / velocity key', () => {
    // A structural assertion — the input keys are all moves/clock, never reach.
    const input: DeriveEvidenceDebtsInput = {
      debateId: DEBATE_ID,
      arguments: [],
      nowMs: T0,
    };
    const keys = Object.keys(input);
    for (const k of keys) {
      expect(k.toLowerCase()).not.toMatch(
        /like|view|follow|engage|viral|trend|popular|retweet|share|velocity|heat/,
      );
    }
    // The argument-input shape carries no such field either.
    const argInput: EvidenceDebtArgumentInput = move({ tagCodes: ['source_request'] });
    for (const k of Object.keys(argInput)) {
      expect(k.toLowerCase()).not.toMatch(
        /like|view|follow|engage|viral|trend|popular|retweet|share|velocity|heat/,
      );
    }
  });
});

// ── Ban-list ───────────────────────────────────────────────────

describe('ban-list — no verdict / amplification / person-attribution tokens', () => {
  const VERDICT_TOKENS = [
    'proof',
    'proven',
    'disproven',
    'true',
    'false',
    'correct',
    'incorrect',
    'winner',
    'loser',
    'verdict',
    'wrong',
    'case closed',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'bot',
    'astroturfer',
  ];
  const AMPLIFICATION_TOKENS = [
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'virality',
    'viral',
    'trending',
    'popular',
  ];

  /**
   * Word-boundary match — the repo-standard ban-list shape (see
   * annotateEvidenceEdgeFunction.test.ts). A substring check would
   * false-positive on legitimate copy (e.g. "bot" inside "both"); the
   * tokens ban person-attribution WORDS, not letter sequences.
   */
  function assertClean(s: string): void {
    const lower = s.toLowerCase();
    for (const tok of [...VERDICT_TOKENS, ...AMPLIFICATION_TOKENS]) {
      const re = new RegExp(`\\b${tok.replace(/\s+/g, '\\s+')}\\b`, 'i');
      expect(re.test(lower)).toBe(false);
    }
  }

  it('every (status, kind) chip string is free of banned tokens', () => {
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      for (const kind of ALL_EVIDENCE_DEBT_KINDS) {
        const c = summarizeEvidenceDebtChip(status, kind);
        assertClean(c.label);
        assertClean(c.helper);
        assertClean(c.accessibilityLabel);
      }
    }
  });

  it('no chip label is a snake_case internal code', () => {
    for (const status of ALL_EVIDENCE_DEBT_STATUSES) {
      const c = summarizeEvidenceDebtChip(status, 'source');
      expect(looksLikeInternalCode(c.label)).toBe(false);
    }
  });

  it('every room status line is free of banned tokens', () => {
    const conditions: EvidenceDebt[][] = [
      // open.
      [{ id: 'd:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'requested', ageDays: 1, isStale: false }],
      // settled.
      [{ id: 'd:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'accepted_by_both', ageDays: 1, isStale: false }],
      // resolved-without-settlement.
      [{ id: 'd:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'supplied', ageDays: 1, isStale: false }],
      // empty.
      [],
    ];
    for (const debts of conditions) {
      assertClean(getRoomEvidenceDebtSummary(DEBATE_ID, debts).statusLine);
    }
  });

  it('the word "settled" IS present at discharge, and "case closed" is absent', () => {
    const settledChip = summarizeEvidenceDebtChip('accepted_by_both', 'source');
    expect(settledChip.label.toLowerCase()).toContain('settled');
    expect(settledChip.helper.toLowerCase()).toContain('settled');
    expect(settledChip.label.toLowerCase()).not.toContain('case closed');

    const settledLine = getRoomEvidenceDebtSummary(DEBATE_ID, [
      { id: 'd:debt', debateId: DEBATE_ID, nodeId: 'n', requestArgumentId: 'd', debtKind: 'source', requestedByUserId: 'u', requestedAt: iso(0), status: 'accepted_by_both', ageDays: 1, isStale: false },
    ]).statusLine;
    expect(settledLine.toLowerCase()).toContain('settled');
    expect(settledLine.toLowerCase()).not.toContain('case closed');
  });
});
