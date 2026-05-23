/**
 * QOL-041 — Concession forced-list pure-model tests.
 *
 * Per QOL-041 design §10 test plan:
 *   - add/remove/reorder; ordinal stays contiguous
 *   - empty item rejected
 *   - >8 items rejected (the cap)
 *   - ≤600-char limit
 *   - empty list is VALID (concession section is optional)
 *
 * Pure TS. No React. No Supabase.
 */
import {
  MAX_CONCESSION_ITEMS,
  MAX_CONCESSION_ITEM_LENGTH,
  EMPTY_CONCESSION_LIST_DRAFT,
  addConcessionItem,
  removeConcessionItem,
  updateConcessionItemText,
  reorderConcessionItem,
  validateConcessionListDraft,
  buildConcessionItemsPayload,
} from '../src/features/concessions/concessionListModel';

// ── Helpers ────────────────────────────────────────────────────

function seed(textsByClientId: Array<[string, string]> = []) {
  let draft = EMPTY_CONCESSION_LIST_DRAFT;
  for (const [id, text] of textsByClientId) {
    draft = addConcessionItem(draft, id);
    draft = updateConcessionItemText(draft, id, text);
  }
  return draft;
}

// ── Limits — design constants ──────────────────────────────────

describe('QOL-041 concession-list — limit constants', () => {
  it('caps the list at 8 items (design §15 Q1 default)', () => {
    expect(MAX_CONCESSION_ITEMS).toBe(8);
  });

  it('caps one item text at 600 chars (mirrors migration CHECK)', () => {
    expect(MAX_CONCESSION_ITEM_LENGTH).toBe(600);
  });
});

// ── addConcessionItem ──────────────────────────────────────────

describe('addConcessionItem', () => {
  it('appends an empty item with the supplied clientId', () => {
    const next = addConcessionItem(EMPTY_CONCESSION_LIST_DRAFT, 'item-0');
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toEqual({ clientId: 'item-0', text: '' });
  });

  it('preserves the existing items in order', () => {
    const next = seed([['a', 'a-text'], ['b', 'b-text']]);
    const after = addConcessionItem(next, 'c');
    expect(after.items.map((i) => i.clientId)).toEqual(['a', 'b', 'c']);
  });

  it('returns the input unchanged when the cap (8) is already reached', () => {
    const eight = seed(
      Array.from({ length: 8 }, (_, i) => [`id-${i}`, `text ${i}`] as [string, string]),
    );
    expect(eight.items).toHaveLength(8);
    const after = addConcessionItem(eight, 'overflow');
    expect(after).toBe(eight); // referential identity preserved
  });

  it('returns the input unchanged for an empty or non-string clientId', () => {
    expect(addConcessionItem(EMPTY_CONCESSION_LIST_DRAFT, '')).toBe(
      EMPTY_CONCESSION_LIST_DRAFT,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(addConcessionItem(EMPTY_CONCESSION_LIST_DRAFT, null as any)).toBe(
      EMPTY_CONCESSION_LIST_DRAFT,
    );
  });
});

// ── removeConcessionItem ───────────────────────────────────────

describe('removeConcessionItem', () => {
  it('removes the matching item and keeps the others in order', () => {
    const draft = seed([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
    ]);
    const after = removeConcessionItem(draft, 'b');
    expect(after.items.map((i) => i.clientId)).toEqual(['a', 'c']);
  });

  it('returns the input unchanged when no row matches (idempotent)', () => {
    const draft = seed([['a', 'a']]);
    const after = removeConcessionItem(draft, 'missing');
    expect(after).toBe(draft);
  });
});

// ── updateConcessionItemText ───────────────────────────────────

describe('updateConcessionItemText', () => {
  it('updates the matching item only', () => {
    const draft = seed([
      ['a', 'a-old'],
      ['b', 'b-old'],
    ]);
    const after = updateConcessionItemText(draft, 'a', 'a-new');
    expect(after.items[0].text).toBe('a-new');
    expect(after.items[1].text).toBe('b-old');
  });

  it('returns the input unchanged when no row matches', () => {
    const draft = seed([['a', 'a']]);
    expect(updateConcessionItemText(draft, 'missing', 'x')).toBe(draft);
  });

  it('returns the input unchanged when the text is identical (referential identity)', () => {
    const draft = seed([['a', 'same']]);
    expect(updateConcessionItemText(draft, 'a', 'same')).toBe(draft);
  });

  it('rejects text longer than 600 chars (defends the migration CHECK)', () => {
    const draft = seed([['a', '']]);
    const tooLong = 'x'.repeat(MAX_CONCESSION_ITEM_LENGTH + 1);
    const after = updateConcessionItemText(draft, 'a', tooLong);
    expect(after).toBe(draft);
  });

  it('accepts text at exactly the 600-char cap (boundary)', () => {
    const draft = seed([['a', '']]);
    const atCap = 'x'.repeat(MAX_CONCESSION_ITEM_LENGTH);
    const after = updateConcessionItemText(draft, 'a', atCap);
    expect(after.items[0].text).toBe(atCap);
  });
});

// ── reorderConcessionItem ──────────────────────────────────────

describe('reorderConcessionItem', () => {
  it('moves the item at fromIndex to toIndex', () => {
    const draft = seed([
      ['a', 'a'],
      ['b', 'b'],
      ['c', 'c'],
    ]);
    const after = reorderConcessionItem(draft, 0, 2);
    expect(after.items.map((i) => i.clientId)).toEqual(['b', 'c', 'a']);
  });

  it('returns the input unchanged when from === to (no-op)', () => {
    const draft = seed([['a', 'a'], ['b', 'b']]);
    expect(reorderConcessionItem(draft, 1, 1)).toBe(draft);
  });

  it('returns the input unchanged for an out-of-range index', () => {
    const draft = seed([['a', 'a']]);
    expect(reorderConcessionItem(draft, 0, 99)).toBe(draft);
    expect(reorderConcessionItem(draft, -1, 0)).toBe(draft);
  });
});

// ── validateConcessionListDraft ────────────────────────────────

describe('validateConcessionListDraft', () => {
  it('EMPTY list is valid (concession section is optional)', () => {
    const v = validateConcessionListDraft(EMPTY_CONCESSION_LIST_DRAFT);
    expect(v.valid).toBe(true);
    expect(v.issues).toEqual([]);
    expect(v.firstReason).toBeNull();
  });

  it('rejects an item with whitespace-only text (empty_item)', () => {
    const draft = seed([
      ['a', 'real point'],
      ['b', '   '],
    ]);
    const v = validateConcessionListDraft(draft);
    expect(v.valid).toBe(false);
    expect(v.issues).toContain('empty_item');
    expect(v.firstReason).toBe('This point is empty — fill it in or remove it.');
  });

  it('rejects > 8 items (over_cap; defensive — addConcessionItem prevents this)', () => {
    // Directly build an over-cap draft by skipping the helper.
    const nine: Array<[string, string]> = Array.from(
      { length: 9 },
      (_, i) => [`id-${i}`, `t-${i}`] as [string, string],
    );
    // Use the helpers — addConcessionItem refuses the 9th, so build with
    // an explicit object to exercise the validator's defensive path.
    const draft = {
      items: nine.map(([clientId, text]) => ({ clientId, text })),
    };
    const v = validateConcessionListDraft(draft);
    expect(v.valid).toBe(false);
    expect(v.issues).toContain('over_cap');
  });

  it('accepts the boundary — exactly 8 items, all non-empty', () => {
    const draft = seed(
      Array.from(
        { length: 8 },
        (_, i) => [`id-${i}`, `point ${i}`] as [string, string],
      ),
    );
    const v = validateConcessionListDraft(draft);
    expect(v.valid).toBe(true);
  });

  it('flags over-length items (over_length; defensive)', () => {
    const longText = 'x'.repeat(MAX_CONCESSION_ITEM_LENGTH + 1);
    const draft = { items: [{ clientId: 'a', text: longText }] };
    const v = validateConcessionListDraft(draft);
    expect(v.valid).toBe(false);
    expect(v.issues).toContain('over_length');
  });

  it('returns issues in priority order: over_cap, empty_item, over_length', () => {
    const longText = 'x'.repeat(MAX_CONCESSION_ITEM_LENGTH + 1);
    const draft = {
      items: [
        { clientId: 'a', text: '' }, // empty
        { clientId: 'b', text: longText }, // over-length
        ...Array.from({ length: 7 }, (_, i) => ({
          clientId: `c-${i}`,
          text: 't',
        })),
        { clientId: 'overflow', text: 't' }, // pushes to 9 items
      ],
    };
    const v = validateConcessionListDraft(draft);
    expect(v.issues[0]).toBe('over_cap'); // surfaced first
  });
});

// ── buildConcessionItemsPayload ────────────────────────────────

describe('buildConcessionItemsPayload', () => {
  it('emits ordinals contiguously starting from 0 (in array order)', () => {
    const draft = seed([
      ['a', 'first'],
      ['b', 'second'],
      ['c', 'third'],
    ]);
    const payload = buildConcessionItemsPayload(draft);
    expect(payload.map((p) => p.ordinal)).toEqual([0, 1, 2]);
    expect(payload.map((p) => p.item_text)).toEqual(['first', 'second', 'third']);
  });

  it('skips items whose trimmed text is empty (defensive)', () => {
    const draft = {
      items: [
        { clientId: 'a', text: 'first' },
        { clientId: 'b', text: '   ' }, // whitespace-only — skipped
        { clientId: 'c', text: 'second' },
      ],
    };
    const payload = buildConcessionItemsPayload(draft);
    expect(payload).toHaveLength(2);
    expect(payload.map((p) => p.item_text)).toEqual(['first', 'second']);
    expect(payload.map((p) => p.ordinal)).toEqual([0, 1]);
  });

  it('trims item_text (matches the migration CHECK trim)', () => {
    const draft = seed([['a', '  trimmed  ']]);
    const payload = buildConcessionItemsPayload(draft);
    expect(payload[0].item_text).toBe('trimmed');
  });

  it('emits [] for an empty draft', () => {
    expect(buildConcessionItemsPayload(EMPTY_CONCESSION_LIST_DRAFT)).toEqual([]);
  });
});
