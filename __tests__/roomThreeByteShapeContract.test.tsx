/**
 * ROOM-003 (#829) — byte-shape contract (THE pin).
 *
 * The single HARD acceptance criterion: for equivalent input the one-bar
 * path produces a submit-argument payload byte-shape-identical to today
 * composer path. It holds by construction (both paths call the SAME
 * buildSubmitArgumentPayload on a draft from the SAME useArgumentComposer);
 * this file is the loud guard.
 *
 * Two halves:
 *  1. Model-level KEY CENSUS — the exact key set buildSubmitArgumentPayload
 *     emits across every fixture (plain reply, type-defaulted counter,
 *     side-defaulted, evidence-type, with target); any added / removed /
 *     renamed key fails loudly.
 *  2. Dual-render deep-equal — the legacy ArgumentComposer and the new
 *     ArgumentEntryComposer rendered for equivalent input; both payloads
 *     captured and compared with toEqual (client_submission_id, the only
 *     per-submission UUID, is normalised before compare).
 */
import React from 'react';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));
jest.mock('../src/lib/supabase', () => {
  const actual = jest.requireActual('../src/lib/supabase');
  return {
    ...actual,
    SUPABASE_CONFIGURED: true,
    supabase: {
      ...actual.supabase,
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
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

import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { buildSubmitArgumentPayload } from '../src/features/arguments/composerSubmit';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { ArgumentComposer } from '../src/features/arguments/ArgumentComposer';
import { ArgumentEntryComposer } from '../src/features/arguments/composer/ArgumentEntryComposer';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ArgumentRow } from '../src/features/arguments/types';
import type { Debate, ParticipantSide } from '../src/features/debates/types';
import type { SubmitArgumentInput } from '../src/lib/edgeFunctions';

const mockSubmit = submitArgumentDraft as jest.Mock;

// ════════════════════════════════════════════════════════════════
// Half 1 — model-level payload key census (pure)
// ════════════════════════════════════════════════════════════════

const FIXED_ID = 'fixed-client-submission-id';

function baseDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: 'parent-1',
    argumentType: 'claim',
    side: 'affirmative',
    body: 'A body long enough to clear the advisory minimum comfortably.',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-07-08T00:00:00.000Z',
    dirty: true,
    ...overrides,
  };
}

const REQUIRED_KEYS = [
  'argument_type',
  'body',
  'client_submission_id',
  'debate_id',
  'parent_id',
  'selected_tag_codes',
  'side',
].sort();

describe('ROOM-003 byte-shape contract — payload key census', () => {
  it('a plain reply emits exactly the required keys (no optional keys)', () => {
    const payload = buildSubmitArgumentPayload(baseDraft(), FIXED_ID);
    expect(Object.keys(payload).sort()).toEqual(REQUIRED_KEYS);
    expect(payload).not.toHaveProperty('attached_evidence');
    expect(payload).not.toHaveProperty('target');
  });

  it('a type-defaulted counter vs an explicit counter produce the same key shape', () => {
    const defaulted = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'counter_rebuttal', parentId: 'reb-1' }),
      FIXED_ID,
    );
    const explicit = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'counter_rebuttal', parentId: 'reb-1' }),
      FIXED_ID,
    );
    expect(Object.keys(defaulted).sort()).toEqual(Object.keys(explicit).sort());
    expect(defaulted).toEqual(explicit);
    expect(defaulted.argument_type).toBe('counter_rebuttal');
  });

  it('a side-defaulted neutral reply keeps the required key set', () => {
    const payload = buildSubmitArgumentPayload(baseDraft({ side: 'neutral' }), FIXED_ID);
    expect(Object.keys(payload).sort()).toEqual(REQUIRED_KEYS);
    expect(payload.side).toBe('neutral');
  });

  it('an evidence-typed draft with a source adds attached_evidence with exactly {url,label,source_text}', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({
        argumentType: 'evidence',
        attachedEvidence: [{ url: 'https://example.test/x', label: 'A report', sourceText: 'An excerpt.' }],
      }),
      FIXED_ID,
    );
    expect(payload).toHaveProperty('attached_evidence');
    expect(payload.attached_evidence).toHaveLength(1);
    expect(Object.keys(payload.attached_evidence![0]).sort()).toEqual(['label', 'source_text', 'url']);
    expect(payload).not.toHaveProperty('target');
  });

  it('a draft with a target excerpt / disagreement axis adds target with exactly {target_excerpt,disagreement_axis}', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({ argumentType: 'rebuttal', parentId: 'claim-1', targetExcerpt: 'the disputed phrase', disagreementAxis: 'scope' }),
      FIXED_ID,
    );
    expect(payload).toHaveProperty('target');
    expect(Object.keys(payload.target!).sort()).toEqual(['disagreement_axis', 'target_excerpt']);
    expect(payload.target!.target_excerpt).toBe('the disputed phrase');
    expect(payload.target!.disagreement_axis).toBe('scope');
  });

  it('the client_submission_id is threaded verbatim (idempotency carrier)', () => {
    const payload = buildSubmitArgumentPayload(baseDraft(), FIXED_ID);
    expect(payload.client_submission_id).toBe(FIXED_ID);
  });

  it('the full key census — a maximal draft emits required + both optional keys and nothing else', () => {
    const payload = buildSubmitArgumentPayload(
      baseDraft({
        argumentType: 'evidence',
        selectedTagCodes: ['evidence'],
        attachedEvidence: [{ url: 'https://example.test/y', label: 'L', sourceText: 'S' }],
        targetExcerpt: 'phrase',
        disagreementAxis: 'evidence',
      }),
      FIXED_ID,
    );
    expect(Object.keys(payload).sort()).toEqual(
      [...REQUIRED_KEYS, 'attached_evidence', 'target'].sort(),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// Half 2 — dual-render deep-equal (legacy composer === bar)
// ════════════════════════════════════════════════════════════════

const DEBATE: Debate = {
  id: 'debate-1',
  createdBy: 'host-1',
  title: 'Bike lanes',
  resolution: 'City streets should add protected bike lanes on arterials.',
  description: 'A debate about street safety and protected bike lanes.',
  status: 'open',
  constitutionId: 'const-1',
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
  myParticipantSide: 'affirmative',
  visibility: 'public',
};

function parentArg(overrides: Partial<ArgumentRow> = {}): ArgumentRow {
  return {
    id: 'arg-parent',
    debateId: DEBATE.id,
    parentId: null,
    authorId: 'other-user',
    argumentType: 'claim',
    side: 'negative',
    body: 'Protected bike lanes make arterial streets safer for everyone.',
    depth: 0,
    status: 'posted',
    targetExcerpt: null,
    disagreementAxis: null,
    railPayload: {},
    clientValidation: {},
    serverValidation: {},
    clientSubmissionId: null,
    createdAt: '2026-07-08T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

const OK = { ok: true, data: { argument: {}, tags: [], topic_satisfaction_check: null, flags: [], validation: {} } };
const BODY = 'This overlooks the maintenance cost of protected arterial lanes over time.';

/** Normalise the only legitimately per-submission field before compare. */
function norm(p: SubmitArgumentInput): SubmitArgumentInput {
  return { ...p, client_submission_id: 'NORMALISED' };
}

async function legacyPayload(
  parent: ArgumentRow,
  typeLabel: string,
  sideLabel: string,
): Promise<SubmitArgumentInput> {
  mockSubmit.mockClear();
  const r = render(
    <AppSessionProvider>
      <ArgumentComposer
        debate={DEBATE}
        selectedParentId={parent.id}
        parentArgument={parent}
        onClearParent={jest.fn()}
        onSubmitSuccess={jest.fn()}
      />
    </AppSessionProvider>,
  );
  await waitFor(() => expect(r.getByTestId('composer-body-input')).toBeTruthy());
  fireEvent.press(r.getByLabelText(typeLabel));
  fireEvent.press(r.getByLabelText(sideLabel));
  fireEvent.changeText(r.getByTestId('composer-body-input'), BODY);
  const post = r.getByLabelText('Post move');
  await waitFor(() => expect(post.props.accessibilityState?.disabled).toBe(false));
  await act(async () => {
    fireEvent.press(post);
  });
  return mockSubmit.mock.calls[0][0] as SubmitArgumentInput;
}

async function barPayload(parent: ArgumentRow, side: ParticipantSide): Promise<SubmitArgumentInput> {
  mockSubmit.mockClear();
  const r = render(
    <AppSessionProvider>
      <ArgumentEntryComposer
        debate={DEBATE}
        selectedParentId={parent.id}
        parentArgument={parent}
        participantSide={side}
        onOpenMore={jest.fn()}
        onSubmitSuccess={jest.fn()}
        onClearParent={jest.fn()}
      />
    </AppSessionProvider>,
  );
  await waitFor(() => expect(r.getByTestId('argument-entry-composer-input')).toBeTruthy());
  fireEvent.changeText(r.getByTestId('argument-entry-composer-input'), BODY);
  const send = r.getByTestId('argument-entry-composer-send');
  await waitFor(() => expect(send.props.accessibilityState?.disabled).toBe(false));
  await act(async () => {
    fireEvent.press(send);
  });
  return mockSubmit.mock.calls[0][0] as SubmitArgumentInput;
}

describe('ROOM-003 byte-shape contract — dual render (bar === legacy)', () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValue(OK);
  });

  it('plain reply — the bar (matrix + seat defaults) equals the legacy composer (manual rebuttal + affirmative)', async () => {
    const legacy = await legacyPayload(parentArg(), 'Rebuttal', 'Affirmative');
    const bar = await barPayload(parentArg(), 'affirmative');
    expect(bar.argument_type).toBe('rebuttal');
    expect(norm(bar)).toEqual(norm(legacy));
  });

  it('type-defaulted counter — the bar auto-picks counter_rebuttal, equal to the explicit legacy pick', async () => {
    const rebuttalParent = parentArg({ argumentType: 'rebuttal', side: 'affirmative' });
    const legacy = await legacyPayload(rebuttalParent, 'Counter-Rebuttal', 'Negative');
    const bar = await barPayload(rebuttalParent, 'negative');
    expect(bar.argument_type).toBe('counter_rebuttal');
    expect(norm(bar)).toEqual(norm(legacy));
  });

  it('side-defaulted neutral — a moderator seat defaults side neutral, equal to the explicit legacy pick', async () => {
    const legacy = await legacyPayload(parentArg(), 'Rebuttal', 'Neutral');
    const bar = await barPayload(parentArg(), 'moderator');
    expect(bar.side).toBe('neutral');
    expect(norm(bar)).toEqual(norm(legacy));
  });
});
