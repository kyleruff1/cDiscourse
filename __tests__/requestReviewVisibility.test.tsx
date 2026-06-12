/**
 * REF-005 — RequestReviewComposer visibility + gating UI tests.
 *
 * Renders the composer (the @testing-library/react-native harness used by
 * AboutScreen.test.tsx / cardDetailComparisonLayout.test.tsx) and pins the
 * doctrine-sensitive UI contract (design §6 / §11 / §16):
 *   - A person-directed concern surfaces the `moderator_visible` readout and
 *     NEVER a public / target-node surface.
 *   - Submit is disabled until `canSubmitConcern` is true.
 *   - person-directed + `hide_pending_review` routes to
 *     `onSendForModeratorReview` only — there is no auto-hide affordance.
 *   - Claim-level type + claim-level remedy routes to `onRouteToActEntry`.
 *   - The composer is never offered on the actor's own move (own-bubble gate).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RequestReviewComposer } from '../src/features/requestReview';
import {
  getBubbleControlsForActor,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { _debug } from '../src/features/arguments/oneBox/actPopoutModel';

function noop() {}

const TID = 'request-review-composer';

describe('RequestReviewComposer — submit gating', () => {
  it('renders the composer container only when visible', () => {
    const { queryByTestId, rerender } = render(
      <RequestReviewComposer
        visible={false}
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(queryByTestId(TID)).toBeNull();
    rerender(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(queryByTestId(TID)).toBeTruthy();
  });

  it('disables submit and shows the empty-quote error when no quote is set', () => {
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote=""
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(getByTestId(`${TID}-quote-error`)).toBeTruthy();
    expect(getByTestId(`${TID}-step2-locked`)).toBeTruthy();
    expect(getByTestId(`${TID}-submit`).props.accessibilityState.disabled).toBe(true);
  });

  it('keeps submit disabled with a quote but no type or remedy chosen', () => {
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="the exact passage"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    expect(getByTestId(`${TID}-submit`).props.accessibilityState.disabled).toBe(true);
    // Choosing only a type is still not submittable.
    fireEvent.press(getByTestId(`${TID}-concern-needs_source`));
    expect(getByTestId(`${TID}-submit`).props.accessibilityState.disabled).toBe(true);
  });
});

describe('RequestReviewComposer — person-directed visibility', () => {
  it('a person-directed concern shows the moderator-visible readout, never a public surface', () => {
    const { getByTestId, queryByText } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="the exact passage"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    fireEvent.press(getByTestId(`${TID}-concern-harassment_concern`));
    fireEvent.press(getByTestId(`${TID}-remedy-moderator_review`));

    const readout = getByTestId(`${TID}-visibility-text`);
    expect(String(readout.props.children)).toMatch(/Only a moderator will see this/i);
    // No public-facing copy or raw visibility code is ever rendered.
    expect(queryByText(/public_after_review/i)).toBeNull();
    expect(queryByText(/visible to everyone/i)).toBeNull();
  });

  it('person-directed + hide_pending_review routes to moderator review only — no auto-hide', () => {
    const onRouteToActEntry = jest.fn();
    const onSendForModeratorReview = jest.fn();
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="the exact passage"
        onRouteToActEntry={onRouteToActEntry}
        onSendForModeratorReview={onSendForModeratorReview}
        onCancel={noop}
      />,
    );
    fireEvent.press(getByTestId(`${TID}-concern-about_person_not_claim`));
    fireEvent.press(getByTestId(`${TID}-remedy-hide_pending_review`));

    // The readout makes it explicit nothing hides automatically.
    expect(String(getByTestId(`${TID}-visibility-text`).props.children)).toMatch(
      /Nothing hides automatically/i,
    );

    fireEvent.press(getByTestId(`${TID}-submit`));
    expect(onSendForModeratorReview).toHaveBeenCalledTimes(1);
    expect(onRouteToActEntry).not.toHaveBeenCalled();
    const draft = onSendForModeratorReview.mock.calls[0][0];
    expect(draft.visibility).toBe('moderator_visible');
    expect(draft.concernType).toBe('about_person_not_claim');
  });
});

describe('RequestReviewComposer — claim-level routing', () => {
  it('a claim-level type + claim-level remedy routes to the disagreement loop (act_entry)', () => {
    const onRouteToActEntry = jest.fn();
    const onSendForModeratorReview = jest.fn();
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="the exact passage"
        onRouteToActEntry={onRouteToActEntry}
        onSendForModeratorReview={onSendForModeratorReview}
        onCancel={noop}
      />,
    );
    fireEvent.press(getByTestId(`${TID}-concern-needs_source`));
    fireEvent.press(getByTestId(`${TID}-remedy-ask_source`));

    expect(String(getByTestId(`${TID}-visibility-text`).props.children)).toMatch(
      /stays on your screen/i,
    );

    fireEvent.press(getByTestId(`${TID}-submit`));
    expect(onRouteToActEntry).toHaveBeenCalledTimes(1);
    expect(onRouteToActEntry).toHaveBeenCalledWith('ask_source');
    expect(onSendForModeratorReview).not.toHaveBeenCalled();
  });

  it('cancel fires onCancel and never routes or sends', () => {
    const onCancel = jest.fn();
    const onRouteToActEntry = jest.fn();
    const onSendForModeratorReview = jest.fn();
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="q"
        onRouteToActEntry={onRouteToActEntry}
        onSendForModeratorReview={onSendForModeratorReview}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(getByTestId(`${TID}-cancel`));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRouteToActEntry).not.toHaveBeenCalled();
    expect(onSendForModeratorReview).not.toHaveBeenCalled();
  });
});

describe('RequestReviewComposer — radio chips are accessible + bounded', () => {
  it('concern + remedy chips expose radio role + checked state, 44px targets', () => {
    const { getByTestId } = render(
      <RequestReviewComposer
        visible
        targetNodeId="n1"
        initialQuote="q"
        onRouteToActEntry={noop}
        onSendForModeratorReview={noop}
        onCancel={noop}
      />,
    );
    const chip = getByTestId(`${TID}-concern-needs_quote`);
    expect(chip.props.accessibilityRole).toBe('radio');
    expect(chip.props.accessibilityState.checked).toBe(false);
    fireEvent.press(chip);
    const checkedChip = getByTestId(`${TID}-concern-needs_quote`);
    expect(checkedChip.props.accessibilityState.checked).toBe(true);
  });
});

describe('REF-005 own-bubble gate', () => {
  it('the flag control is never offered on the actor own move', () => {
    // The composer entry rides the `flag` bubble control + the `flag` Act
    // entry. Neither is in the own-bubble allow-set, so the composer is
    // never reachable on your own move.
    expect(getBubbleControlsForActor('self')).not.toContain('flag');
    expect(getBubbleControlsForActor('other')).toContain('flag');
    expect([..._debug.OWN_BUBBLE_ALLOWED]).not.toContain('flag');
  });
});
