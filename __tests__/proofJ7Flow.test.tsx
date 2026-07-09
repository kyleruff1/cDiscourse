/**
 * PROOF-002 (#889) — J7 client-side acceptance flow.
 *
 * "Proof attached to the past move, not to your next reply." The binding flow:
 *   A. the ProofButton renders owed/gold when scoped to a move that carries a debt;
 *   B. opening the drawer is pre-scoped to that move + owed kind, and one attach
 *      REQUESTS the answers-debt relation (answersDebtKind threads through);
 *   C. after the returned row lands in proofItemsByMessageId and flows through
 *      buildArtifactsByMessageId -> the answering move's artifacts,
 *      deriveEvidenceDebts recomputes the debt requested -> supplied. This proves
 *      the inverse fold produces a (kind, sourceChainStatus) that
 *      artifactDischarges('source', ...) accepts (a wrong fold would leave the
 *      debt requested and fail loudly).
 *
 * The evidence_supplied NOTIFICATION itself is PROOF-003's test (assumption 8);
 * here we assert only that the drawer requested the answers-debt relation.
 */
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    },
  };
});
jest.mock('../src/features/arguments/useConstitution', () => {
  const c = jest.requireActual('../src/domain/constitution');
  return {
    useConstitution: () => ({
      loading: false,
      error: null,
      source: 'local_fallback',
      activeConstitution: c.constitutionVersion,
      activeRules: c.constitutionRules,
      tagDefinitions: c.tagDefinitions,
      flagDefinitions: c.flagDefinitions,
    }),
  };
});

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import { ProofDrawer } from '../src/features/proof/ProofDrawer';
import { buildArtifactsByMessageId } from '../src/features/arguments/argumentGameSurfaceEvidence';
import {
  deriveEvidenceDebts,
  getNodeEvidenceDebtSummary,
  type EvidenceDebtArgumentInput,
} from '../src/features/evidence/evidenceDebtModel';
import type { ProofDrawerScope, ProofItemRow } from '../src/features/proof/proofDrawerModel';
import type { ArgumentMessageInput } from '../src/features/arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import type { Debate } from '../src/features/debates/types';

// ── The room: M1 (author claim) <- M2 (opponent source_request) + M3 (author reply) ──
const AUTHOR = 'author-1';
const T0 = '2026-07-09T00:00:00.000Z';
const T1 = '2026-07-09T00:01:00.000Z';
const T2 = '2026-07-09T00:02:00.000Z';

const MOVE_META = [
  { id: 'M1', parentId: null, authorId: AUTHOR, argumentType: 'claim', side: 'affirmative', createdAt: T0, tagCodes: [] as string[] },
  { id: 'M2', parentId: 'M1', authorId: 'opponent-1', argumentType: 'clarification_request', side: 'negative', createdAt: T1, tagCodes: ['source_request'] },
  { id: 'M3', parentId: 'M1', authorId: AUTHOR, argumentType: 'rebuttal', side: 'affirmative', createdAt: T2, tagCodes: [] as string[] },
];

function messages(): ArgumentMessageInput[] {
  return MOVE_META.map(
    (m) => ({ id: m.id, authorId: m.authorId, createdAt: m.createdAt, attachedEvidence: [] }) as unknown as ArgumentMessageInput,
  );
}

function debtArgs(artifactsById: Record<string, ReadonlyArray<EvidenceArtifact>>): EvidenceDebtArgumentInput[] {
  return MOVE_META.map((m) => ({
    id: m.id,
    debateId: 'd1',
    parentId: m.parentId,
    authorId: m.authorId,
    argumentType: m.argumentType as EvidenceDebtArgumentInput['argumentType'],
    side: m.side as EvidenceDebtArgumentInput['side'],
    createdAt: m.createdAt,
    tagCodes: m.tagCodes,
    artifacts: artifactsById[m.id] ?? [],
  }));
}

const NOW = Date.parse('2026-07-09T00:03:00.000Z');

const SOURCE_ROW: ProofItemRow = {
  id: 'proof-1',
  debate_id: 'd1',
  argument_id: 'M3',
  added_by: AUTHOR,
  kind: 'url',
  label: 'A report',
  url: 'https://a.test/x',
  source_text: null,
  quote: null,
  referenced_argument_id: null,
  source_chain_status: 'source_no_quote',
  risk: 'unknown',
  created_at: T2,
  deleted_at: null,
};

const DEBATE: Debate = {
  id: 'd1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: T0,
  updatedAt: T0,
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

describe('J7 Part A — the owed ProofButton', () => {
  it('renders the owed/gold marker when the scoped move carries a debt', () => {
    const r = render(
      <AppSessionProvider>
        <ArgumentEntryComposer
          debate={DEBATE}
          selectedParentId="M1"
          parentArgument={null}
          participantSide="affirmative"
          onOpenMore={jest.fn()}
          onOpenProof={jest.fn()}
          proofOwed
          onSubmitSuccess={jest.fn()}
          onClearParent={jest.fn()}
        />
      </AppSessionProvider>,
    );
    expect(r.getByTestId('argument-entry-composer-proof-owed')).toBeTruthy();
    expect(r.getByText(/Source owed/)).toBeTruthy();
  });
});

describe('J7 Part B — the drawer is pre-scoped and requests the answers-debt relation', () => {
  it('attach threads answersDebtKind from the owed scope', async () => {
    const onAttach = jest.fn().mockResolvedValue({ ok: true, proofItem: SOURCE_ROW });
    const scope: ProofDrawerScope = { kind: 'argument', debateId: 'd1', argumentId: 'M3', owedDebtKind: 'source' };
    const r = render(
      <ProofDrawer
        scope={scope}
        windowWidth={400}
        windowHeight={800}
        currentUserId={AUTHOR}
        onAttach={onAttach}
        onClose={jest.fn()}
        generateClientAttachId={() => 'fixed-attach-id'}
      />,
    );
    fireEvent.press(r.getByTestId('proof-drawer-kind-url'));
    fireEvent.changeText(r.getByTestId('proof-drawer-input'), 'https://a.test/x');
    fireEvent.press(r.getByTestId('proof-drawer-attach'));
    await waitFor(() => expect(onAttach).toHaveBeenCalledTimes(1));
    expect(onAttach).toHaveBeenCalledWith(
      expect.objectContaining({ argumentId: 'M3', kind: 'url', answersDebtKind: 'source' }),
    );
  });
});

describe('J7 Part C — the debt flips requested -> supplied via the inverse fold', () => {
  it('is requested before the attach and supplied after the source lands on the answering move', () => {
    // Before: the answering move M3 carries no source.
    const artifactsBefore = buildArtifactsByMessageId(messages());
    const debtsBefore = deriveEvidenceDebts({ debateId: 'd1', arguments: debtArgs(artifactsBefore), nowMs: NOW });
    const beforeSummary = getNodeEvidenceDebtSummary('M1', debtsBefore);
    expect(beforeSummary.hasOpenDebt).toBe(true);
    expect(beforeSummary.debts.map((d) => d.status)).toContain('requested');

    // After: the attached source row lands on M3 via the rows-first adapter.
    const artifactsAfter = buildArtifactsByMessageId(messages(), { M3: [SOURCE_ROW] });
    // The inverse fold must produce an artifact that discharges a source debt.
    expect(artifactsAfter.M3).toHaveLength(1);
    const debtsAfter = deriveEvidenceDebts({ debateId: 'd1', arguments: debtArgs(artifactsAfter), nowMs: NOW });
    const afterSummary = getNodeEvidenceDebtSummary('M1', debtsAfter);
    expect(afterSummary.debts.map((d) => d.status)).toContain('supplied');
    expect(afterSummary.hasOpenDebt).toBe(false);
  });

  it('a quote-only attach does NOT discharge the source debt (fold correctness, negative)', () => {
    const quoteRow: ProofItemRow = { ...SOURCE_ROW, kind: 'quote', url: null, quote: 'a passage', source_chain_status: 'unverified' };
    const artifactsAfter = buildArtifactsByMessageId(messages(), { M3: [quoteRow] });
    const debtsAfter = deriveEvidenceDebts({ debateId: 'd1', arguments: debtArgs(artifactsAfter), nowMs: NOW });
    const afterSummary = getNodeEvidenceDebtSummary('M1', debtsAfter);
    // A bare quote is unverified and does not discharge a source debt.
    expect(afterSummary.debts.map((d) => d.status)).toContain('requested');
  });
});
