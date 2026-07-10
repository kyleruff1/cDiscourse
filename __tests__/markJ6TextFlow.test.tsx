/**
 * MARK-002 (#894) — J6 text-half acceptance (RNTL integration).
 *
 * The full text gesture through the REAL components (RingsideFeed / RingsideCard,
 * MarkerPhrasePickerSheet, TimestampMarker composer_scope + reply_reference,
 * segmentPhrases, createMarkerScoped over a mocked Edge):
 *   open a non-own card -> Respond to this -> pick a phrase -> composer scoped
 *   (composer_scope chip) -> Send -> create-marker called with the new reply id
 *   + the verified quote -> the reply card shows the reply_reference chip -> tap
 *   -> the source card is deep-linked (its span highlighted in full body).
 * Plus the fabricated-quote rejection against the REAL Edge validation logic
 * (verifyQuoteMatch) and the mocked-Edge quote_mismatch path (no chip).
 */
const mockInvoke = jest.fn();
jest.mock('../src/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
  SUPABASE_CONFIGURED: true,
}));

import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RingsideFeed } from '../src/features/arguments/room/RingsideFeed';
import { MarkerPhrasePickerSheet } from '../src/features/arguments/markers/MarkerPhrasePickerSheet';
import { TimestampMarker } from '../src/features/arguments/markers/TimestampMarker';
import {
  buildRingsideFeed,
  type RingsideFeedInput,
} from '../src/features/arguments/room/ringsideFeedModel';
import {
  getBubbleControlsForActor,
  type ArgumentBubbleActor,
  type ArgumentBubbleViewModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { getRailActions } from '../src/features/arguments/ArgumentSideActionRail';
import { createMarkerScoped } from '../src/features/arguments/markers/createMarkerApi';
import type {
  MarkerRow,
  PendingMarkerScope,
  TimestampMarkerViewModel,
} from '../src/features/arguments/markers/timestampMarkerModel';
import {
  verifyQuoteMatch,
  sliceQuote,
} from '../supabase/functions/_shared/markerCreate';

const TARGET_ID = 'target-1';
const REPLY_ID = 'reply-1';
const TARGET_BODY = 'Cars are bad. Bikes are good.';

function makeVm(over: Partial<ArgumentBubbleViewModel>): ArgumentBubbleViewModel {
  const actor: ArgumentBubbleActor = over.actor ?? 'other';
  return {
    messageId: over.messageId ?? 'm',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: '2026-07-11 10:00',
    relativeLabel: '1m ago',
    body: over.body ?? 'body',
    kindLabel: 'claim',
    actor,
    sideLabel: 'Aff',
    isLatest: over.isLatest ?? false,
    isActive: over.isActive ?? false,
    parentHint: null,
    qualifierBadges: [],
    pointStandingHint: null,
    allowedControls: getBubbleControlsForActor(actor),
    deletionRequested: false,
  };
}

function makeInput(vms: ArgumentBubbleViewModel[]): RingsideFeedInput {
  return {
    viewModels: vms,
    viewerRole: 'participant',
    activeMessageId: null,
    kindColorFamilyFor: () => 'claim',
    descendantCountFor: () => 0,
    parentMessageIdFor: () => null,
    proofChipCountFor: () => 0,
    owedReceiptFor: () => false,
    observerActionsFor: (actor) => getRailActions('observer', actor),
  };
}

function markerRowFrom(scope: PendingMarkerScope): MarkerRow {
  return {
    id: 'marker-1',
    debate_id: 'd1',
    target_argument_id: scope.targetArgumentId,
    reply_argument_id: REPLY_ID,
    created_by: 'u1',
    kind: 'rebuttal_anchor',
    span_start: scope.spanStart,
    span_end: scope.spanEnd,
    span_unit: 'chars',
    quoted_text: scope.quote,
    created_at: '2026-07-11T00:00:00.000Z',
    deleted_at: null,
  };
}

function scopeToVm(scope: PendingMarkerScope): TimestampMarkerViewModel {
  return {
    id: 'pending-scope',
    targetArgumentId: scope.targetArgumentId,
    replyArgumentId: null,
    kind: 'rebuttal_anchor',
    spanStart: scope.spanStart,
    spanEnd: scope.spanEnd,
    quotedText: scope.quote,
    state: 'live',
  };
}

/** A minimal room shell reproducing the App-level marker state machine. */
function J6Harness() {
  const [respondTarget, setRespondTarget] = useState<string | null>(null);
  const [scope, setScope] = useState<PendingMarkerScope | null>(null);
  const [markersByReplyId, setMarkersByReplyId] = useState<Record<string, ReadonlyArray<MarkerRow>>>({});
  const [markersByTargetId, setMarkersByTargetId] = useState<Record<string, ReadonlyArray<MarkerRow>>>({});
  const [deepLinked, setDeepLinked] = useState<string | null>(null);
  const [mintErrored, setMintErrored] = useState(false);

  const feed = buildRingsideFeed(
    makeInput([
      makeVm({ messageId: TARGET_ID, ordinal: 1, actor: 'other', body: TARGET_BODY }),
      makeVm({ messageId: REPLY_ID, ordinal: 2, actor: 'self', body: 'I disagree.', isLatest: true }),
    ]),
  );

  const handleSend = async () => {
    if (!scope) return;
    const result = await createMarkerScoped({ debateId: 'd1', scope, replyArgumentId: REPLY_ID });
    if (result.ok) {
      const row = markerRowFrom(scope);
      setMarkersByReplyId({ [REPLY_ID]: [row] });
      setMarkersByTargetId({ [TARGET_ID]: [row] });
      setScope(null);
    } else {
      setMintErrored(true);
      setScope(null);
    }
  };

  return (
    <>
      <RingsideFeed
        feed={feed}
        viewerRole="participant"
        onActivate={() => undefined}
        onActivateAncestor={() => undefined}
        onCardAction={() => undefined}
        onRailAction={() => undefined}
        onOpenMap={() => undefined}
        pointFeedbackFlags={null}
        markersByTargetId={markersByTargetId}
        markersByReplyId={markersByReplyId}
        isMarkerTargetLoaded={(id) => id === TARGET_ID}
        onRespondToThis={setRespondTarget}
        onOpenMarkerSource={(targetId) => setDeepLinked(targetId)}
      />
      {respondTarget ? (
        <MarkerPhrasePickerSheet
          targetArgumentId={respondTarget}
          targetBody={TARGET_BODY}
          windowWidth={390}
          onPick={(s) => {
            setScope(s);
            setRespondTarget(null);
          }}
          onCancel={() => setRespondTarget(null)}
        />
      ) : null}
      {scope ? (
        <TimestampMarker placement="composer_scope" marker={scopeToVm(scope)} onClear={() => setScope(null)} />
      ) : null}
      <Pressable testID="j6-send" onPress={handleSend}>
        <Text>Send</Text>
      </Pressable>
      {deepLinked ? <Text testID="j6-deeplinked">{deepLinked}</Text> : null}
      {mintErrored ? <Text testID="j6-mint-errored">errored</Text> : null}
    </>
  );
}

function mintOk(scope: PendingMarkerScope) {
  return {
    data: {
      ok: true,
      idempotent: false,
      marker: {
        id: 'marker-1',
        debateId: 'd1',
        targetArgumentId: scope.targetArgumentId,
        replyArgumentId: REPLY_ID,
        kind: 'rebuttal_anchor',
        spanStart: scope.spanStart,
        spanEnd: scope.spanEnd,
        spanUnit: 'chars',
        quotedText: scope.quote,
        createdAt: '2026-07-11T00:00:00.000Z',
      },
    },
    error: null,
  };
}

beforeEach(() => mockInvoke.mockReset());

describe('MARK-002 J6 — the text half end-to-end', () => {
  it('select -> mint -> reply chip -> deep-link with context', async () => {
    // The Edge mints with the SERVER-verified quote (mocked to echo the scope).
    mockInvoke.mockImplementation((_fn, opts) => {
      const body = (opts as { body: PendingMarkerScope & { spanStart: number } }).body;
      return Promise.resolve(mintOk(body as unknown as PendingMarkerScope));
    });

    const { getByTestId, queryByTestId } = render(<J6Harness />);

    // 1. Open a non-own card -> Respond to this.
    fireEvent.press(getByTestId(`ringside-respond-to-this-${TARGET_ID}`));
    // Own card never exposes the affordance.
    expect(queryByTestId(`ringside-respond-to-this-${REPLY_ID}`)).toBeNull();

    // 2. Pick the first phrase.
    fireEvent.press(getByTestId('marker-phrase-row-0'));

    // 3. The composer is scoped (the composer_scope chip renders the phrase).
    expect(getByTestId('timestamp-marker-composer-scope')).toBeTruthy();

    // 4. Send -> create-marker called with the reply id + the verified quote.
    fireEvent.press(getByTestId('j6-send'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));
    const sentBody = mockInvoke.mock.calls[0][1].body;
    expect(sentBody.action).toBe('mint');
    expect(sentBody.replyArgumentId).toBe(REPLY_ID);
    expect(sentBody.targetArgumentId).toBe(TARGET_ID);
    expect(sentBody.quote).toBe('Cars are bad.');

    // 5. The reply card shows the reply_reference chip.
    await waitFor(() => expect(getByTestId('timestamp-marker-reply-marker-1')).toBeTruthy());
    // The target card shows the source-span highlight (full body context, Q5).
    expect(getByTestId('timestamp-marker-source-span-marker-1')).toBeTruthy();

    // 6. Tap the reply chip -> deep-link to the source.
    fireEvent.press(getByTestId('timestamp-marker-reply-marker-1'));
    await waitFor(() => expect(getByTestId('j6-deeplinked').props.children).toBe(TARGET_ID));
  });

  it('a mocked-Edge quote_mismatch mints no chip (the reply is still posted)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { status: 422, context: { json: async () => ({ error: 'quote_mismatch' }) } },
    });
    const { getByTestId, queryByTestId } = render(<J6Harness />);
    fireEvent.press(getByTestId(`ringside-respond-to-this-${TARGET_ID}`));
    fireEvent.press(getByTestId('marker-phrase-row-0'));
    fireEvent.press(getByTestId('j6-send'));
    await waitFor(() => expect(getByTestId('j6-mint-errored')).toBeTruthy());
    // No reply chip minted.
    expect(queryByTestId('timestamp-marker-reply-marker-1')).toBeNull();
  });
});

describe('MARK-002 J6 — fabricated-quote rejection (the REAL Edge validation logic)', () => {
  it('the picked phrase matches the server slice (mint would succeed)', () => {
    // The picker computes { start, end, quote } from the same body the client
    // loaded, so the server slice equals the client quote byte-for-byte.
    const start = 0;
    const end = 'Cars are bad.'.length;
    const clientQuote = TARGET_BODY.slice(start, end);
    expect(sliceQuote(TARGET_BODY, start, end)).toBe(clientQuote);
    expect(verifyQuoteMatch(TARGET_BODY, start, end, clientQuote)).toEqual({ ok: true });
  });

  it('a fabricated quote is rejected by verifyQuoteMatch (quote_mismatch)', () => {
    const start = 0;
    const end = 'Cars are bad.'.length;
    // The client forges a quote the span does not actually say.
    expect(verifyQuoteMatch(TARGET_BODY, start, end, 'Cars are illegal.')).toEqual({
      ok: false,
      issue: 'quote_mismatch',
    });
  });
});
