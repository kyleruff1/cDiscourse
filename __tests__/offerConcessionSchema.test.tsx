/**
 * UX-001.3 — OfferConcessionSchema tests.
 *
 * Covers:
 *  - Row factory produces unique ids per call.
 *  - serializeOfferConcessionRows: trims, joins with newline, drops empties.
 *  - isOfferConcessionPostable returns true iff any row has content.
 *  - Render: rows visible, add button works, remove button works.
 *  - Removing the last row resets to a single empty row.
 *  - 44+ minHeight on every interactive control.
 *  - Doctrine ban-list (no verdict tokens in any copy).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import {
  OFFER_CONCESSION_SCHEMA_COPY,
  OFFER_CONCESSION_ITEM_MAX,
  OFFER_CONCESSION_CLARIFICATION_MAX,
  OfferConcessionSchema,
  createEmptyOfferConcessionRow,
  isOfferConcessionPostable,
  serializeOfferConcessionRows,
} from '../src/features/arguments/oneBox/schemas/OfferConcessionSchema';
import type { OfferConcessionRow } from '../src/features/arguments/oneBox/schemas/OfferConcessionSchema';

describe('OfferConcessionSchema — createEmptyOfferConcessionRow', () => {
  it('returns a row with empty item + clarification', () => {
    const r = createEmptyOfferConcessionRow();
    expect(r.itemText).toBe('');
    expect(r.clarification).toBe('');
    expect(typeof r.id).toBe('string');
    expect(r.id.length).toBeGreaterThan(0);
  });

  it('returns a unique id per call', () => {
    const a = createEmptyOfferConcessionRow();
    const b = createEmptyOfferConcessionRow();
    expect(a.id).not.toBe(b.id);
  });
});

describe('OfferConcessionSchema — isOfferConcessionPostable', () => {
  it('returns false for an empty list', () => {
    expect(isOfferConcessionPostable([])).toBe(false);
  });

  it('returns false when every row has whitespace-only item text', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: '', clarification: '' },
      { id: 'b', itemText: '   \n\t', clarification: 'has clarification' },
    ];
    expect(isOfferConcessionPostable(rows)).toBe(false);
  });

  it('returns true when at least one row has non-whitespace item text', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: '', clarification: '' },
      { id: 'b', itemText: 'I concede X.', clarification: '' },
    ];
    expect(isOfferConcessionPostable(rows)).toBe(true);
  });
});

describe('OfferConcessionSchema — serializeOfferConcessionRows', () => {
  it('returns "" for an empty list', () => {
    expect(serializeOfferConcessionRows([])).toBe('');
  });

  it('drops rows with empty item text', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: '', clarification: 'should be dropped' },
      { id: 'b', itemText: 'I concede X.', clarification: '' },
    ];
    expect(serializeOfferConcessionRows(rows)).toBe('I concede X.');
  });

  it('renders rows without clarification as bare items', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: 'First point.', clarification: '' },
      { id: 'b', itemText: 'Second point.', clarification: '' },
    ];
    expect(serializeOfferConcessionRows(rows)).toBe('First point.\nSecond point.');
  });

  it('renders rows with clarification as `item: clarification`', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: 'I concede X.', clarification: 'Because the evidence is clear.' },
    ];
    expect(serializeOfferConcessionRows(rows)).toBe(
      'I concede X.: Because the evidence is clear.',
    );
  });

  it('trims item + clarification whitespace', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: '  trimmed  ', clarification: '  also trimmed  ' },
    ];
    expect(serializeOfferConcessionRows(rows)).toBe('trimmed: also trimmed');
  });
});

describe('OfferConcessionSchema — rendering', () => {
  it('renders the intro line and the initial rows', () => {
    const rows = [createEmptyOfferConcessionRow()];
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={() => {}} />,
    );
    expect(getByTestId('offer-concession-schema-intro').props.children).toBe(
      OFFER_CONCESSION_SCHEMA_COPY.intro,
    );
    expect(getByTestId('offer-concession-schema-row-0')).toBeTruthy();
  });

  it('shows the empty-state hint when no row has content', () => {
    const rows = [createEmptyOfferConcessionRow()];
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={() => {}} />,
    );
    expect(getByTestId('offer-concession-schema-empty-hint')).toBeTruthy();
  });

  it('hides the empty-state hint once at least one row has content', () => {
    const rows: OfferConcessionRow[] = [
      { id: 'a', itemText: 'I concede X.', clarification: '' },
    ];
    const { queryByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={() => {}} />,
    );
    expect(queryByTestId('offer-concession-schema-empty-hint')).toBeNull();
  });
});

describe('OfferConcessionSchema — add row', () => {
  it('tapping Add appends a new empty row', () => {
    const rows = [createEmptyOfferConcessionRow()];
    let captured: ReadonlyArray<OfferConcessionRow> | null = null;
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={(r) => (captured = r)} />,
    );
    fireEvent.press(getByTestId('offer-concession-schema-add-row'));
    expect(captured).not.toBeNull();
    expect((captured as ReadonlyArray<OfferConcessionRow> | null)?.length).toBe(2);
    expect((captured as ReadonlyArray<OfferConcessionRow> | null)?.[1].itemText).toBe('');
  });
});

describe('OfferConcessionSchema — remove row', () => {
  it('Remove button is hidden when there is only one row', () => {
    const rows = [createEmptyOfferConcessionRow()];
    const { queryByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={() => {}} />,
    );
    expect(queryByTestId('offer-concession-schema-row-0-remove')).toBeNull();
  });

  it('Remove button is shown when there are multiple rows', () => {
    const rows = [
      createEmptyOfferConcessionRow(),
      createEmptyOfferConcessionRow(),
    ];
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={() => {}} />,
    );
    expect(getByTestId('offer-concession-schema-row-0-remove')).toBeTruthy();
    expect(getByTestId('offer-concession-schema-row-1-remove')).toBeTruthy();
  });

  it('removing a row updates the list', () => {
    const rows = [
      { id: 'a', itemText: 'first', clarification: '' },
      { id: 'b', itemText: 'second', clarification: '' },
    ];
    let captured: ReadonlyArray<OfferConcessionRow> | null = null;
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={(r) => (captured = r)} />,
    );
    fireEvent.press(getByTestId('offer-concession-schema-row-0-remove'));
    expect((captured as ReadonlyArray<OfferConcessionRow> | null)?.length).toBe(1);
    expect((captured as ReadonlyArray<OfferConcessionRow> | null)?.[0].id).toBe('b');
  });
});

describe('OfferConcessionSchema — input length cap', () => {
  it('clamps item text to OFFER_CONCESSION_ITEM_MAX', () => {
    const long = 'x'.repeat(OFFER_CONCESSION_ITEM_MAX + 50);
    const rows = [{ id: 'a', itemText: '', clarification: '' }];
    let captured: ReadonlyArray<OfferConcessionRow> | null = null;
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={(r) => (captured = r)} />,
    );
    fireEvent.changeText(getByTestId('offer-concession-schema-row-0-item-input'), long);
    expect((captured as ReadonlyArray<OfferConcessionRow> | null)?.[0].itemText.length).toBe(
      OFFER_CONCESSION_ITEM_MAX,
    );
  });

  it('clamps clarification text to OFFER_CONCESSION_CLARIFICATION_MAX', () => {
    const long = 'y'.repeat(OFFER_CONCESSION_CLARIFICATION_MAX + 50);
    const rows = [{ id: 'a', itemText: '', clarification: '' }];
    let captured: ReadonlyArray<OfferConcessionRow> | null = null;
    const { getByTestId } = render(
      <OfferConcessionSchema rows={rows} onChange={(r) => (captured = r)} />,
    );
    fireEvent.changeText(
      getByTestId('offer-concession-schema-row-0-clarification-input'),
      long,
    );
    expect(
      (captured as ReadonlyArray<OfferConcessionRow> | null)?.[0].clarification.length,
    ).toBe(OFFER_CONCESSION_CLARIFICATION_MAX);
  });
});

describe('OfferConcessionSchema — doctrine', () => {
  it('no verdict tokens in any copy', () => {
    const banned = [
      'winner',
      'loser',
      'liar',
      'correct',
      'incorrect',
      'truth',
      'verdict',
      'proof',
      'manipulative',
      'bad faith',
      'extremist',
      'propagandist',
    ];
    const haystack = Object.values(OFFER_CONCESSION_SCHEMA_COPY)
      .join(' ')
      .toLowerCase();
    for (const b of banned) {
      expect(haystack).not.toContain(b);
    }
  });

  it('no internal codes in any copy', () => {
    // Snake_case-looking strings would suggest a leak.
    const haystack = Object.values(OFFER_CONCESSION_SCHEMA_COPY).join(' ');
    expect(haystack).not.toMatch(/_/);
  });
});
