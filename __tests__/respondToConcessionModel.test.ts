/**
 * QOL-041 — Respond-to-concession mirrored-list pure-model tests.
 *
 * Per QOL-041 design §10 test plan:
 *   - mirrors N incoming items to N rows
 *   - isPostable false until every row has a level
 *   - isPostable false while any non-agree row has empty/whitespace clarification
 *   - isPostable true otherwise
 *   - acceptance payload matches the level + trimmed clarification
 *
 * Pure TS. No React. No Supabase.
 */
import {
  buildRespondToConcessionDraft,
  setRowLevel,
  setRowClarification,
  isPostable,
  buildConcessionAcceptancesPayload,
  MAX_CLARIFICATION_LENGTH,
  type IncomingConcessionItem,
} from '../src/features/concessions/respondToConcessionModel';

// ── Fixtures ───────────────────────────────────────────────────

const TWO_INCOMING: IncomingConcessionItem[] = [
  { id: 'ci-1', ordinal: 0, itemText: 'We did agree to alternate dishes.' },
  { id: 'ci-2', ordinal: 1, itemText: 'You did do the dishes four times.' },
];

// ── buildRespondToConcessionDraft ──────────────────────────────

describe('buildRespondToConcessionDraft', () => {
  it('builds one row per incoming item, level null, clarification ""', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    expect(draft.rows).toHaveLength(2);
    for (const r of draft.rows) {
      expect(r.level).toBeNull();
      expect(r.clarification).toBe('');
    }
    expect(draft.rows.map((r) => r.concessionItemId)).toEqual(['ci-1', 'ci-2']);
  });

  it('sorts incoming items by ordinal ascending', () => {
    const draft = buildRespondToConcessionDraft([
      { id: 'b', ordinal: 5, itemText: 'second' },
      { id: 'a', ordinal: 1, itemText: 'first' },
      { id: 'c', ordinal: 9, itemText: 'third' },
    ]);
    expect(draft.rows.map((r) => r.concessionItemId)).toEqual(['a', 'b', 'c']);
  });

  it('tie-breaks by id when ordinals are equal (deterministic)', () => {
    const draft = buildRespondToConcessionDraft([
      { id: 'b', ordinal: 0, itemText: 'b' },
      { id: 'a', ordinal: 0, itemText: 'a' },
    ]);
    expect(draft.rows.map((r) => r.concessionItemId)).toEqual(['a', 'b']);
  });

  it('builds an empty draft from an empty incoming set', () => {
    const draft = buildRespondToConcessionDraft([]);
    expect(draft.rows).toEqual([]);
  });
});

// ── setRowLevel ────────────────────────────────────────────────

describe('setRowLevel', () => {
  it('sets the level on the matching row only', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    const next = setRowLevel(draft, 'ci-1', 'agree');
    expect(next.rows[0].level).toBe('agree');
    expect(next.rows[1].level).toBeNull();
  });

  it('preserves the clarification draft across a re-pick (D3 non-destructive)', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-2', 'disagree_fact');
    draft = setRowClarification(draft, 'ci-2', 'because primary source X');
    // Re-pick to agree should preserve the typed clarification.
    draft = setRowLevel(draft, 'ci-2', 'agree');
    expect(draft.rows[1].level).toBe('agree');
    expect(draft.rows[1].clarification).toBe('because primary source X');
  });

  it('returns the input unchanged when level is unchanged', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    expect(setRowLevel(draft, 'ci-1', 'agree')).toBe(draft);
  });

  it('returns the input unchanged when the concession item id does not match', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    expect(setRowLevel(draft, 'missing', 'agree')).toBe(draft);
  });
});

// ── setRowClarification ────────────────────────────────────────

describe('setRowClarification', () => {
  it('updates the clarification on the matching row only', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    const next = setRowClarification(draft, 'ci-2', 'because X');
    expect(next.rows[1].clarification).toBe('because X');
    expect(next.rows[0].clarification).toBe('');
  });

  it('rejects clarifications longer than MAX_CLARIFICATION_LENGTH', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    const tooLong = 'x'.repeat(MAX_CLARIFICATION_LENGTH + 1);
    const after = setRowClarification(draft, 'ci-1', tooLong);
    expect(after).toBe(draft);
  });

  it('accepts a clarification at exactly the boundary', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    const atCap = 'x'.repeat(MAX_CLARIFICATION_LENGTH);
    const after = setRowClarification(draft, 'ci-1', atCap);
    expect(after.rows[0].clarification).toBe(atCap);
  });
});

// ── isPostable — the conditional clarification block ───────────

describe('isPostable — F3 conditional clarification block', () => {
  it('an empty mirrored list is NOT postable', () => {
    const draft = buildRespondToConcessionDraft([]);
    const p = isPostable(draft);
    expect(p.postable).toBe(false);
    expect(p.firstDisabledReason).toBe('Respond to every conceded point first.');
  });

  it('a fresh draft is NOT postable — every row needs a level', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    const p = isPostable(draft);
    expect(p.postable).toBe(false);
    expect(p.reasons).toContain('row_unpicked');
    expect(p.firstDisabledReason).toBe('Respond to every conceded point first.');
  });

  it('only some rows picked → still NOT postable', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    // ci-2 is still null
    const p = isPostable(draft);
    expect(p.postable).toBe(false);
    expect(p.reasons).toContain('row_unpicked');
  });

  it('non-agree row with EMPTY clarification → NOT postable (clarification_empty)', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    draft = setRowLevel(draft, 'ci-2', 'disagree_fact');
    const p = isPostable(draft);
    expect(p.postable).toBe(false);
    expect(p.reasons).toContain('clarification_empty');
    expect(p.firstDisabledReason).toBe('Explain why you disagree on each point.');
  });

  it('non-agree row with WHITESPACE-only clarification → NOT postable', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    draft = setRowLevel(draft, 'ci-2', 'disagree_framing');
    draft = setRowClarification(draft, 'ci-2', '   ');
    expect(isPostable(draft).postable).toBe(false);
  });

  it('every row picked + every non-agree row has clarification → POSTABLE', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    draft = setRowLevel(draft, 'ci-2', 'disagree_fact');
    draft = setRowClarification(draft, 'ci-2', 'because primary source X');
    const p = isPostable(draft);
    expect(p.postable).toBe(true);
    expect(p.firstDisabledReason).toBeNull();
  });

  it('agree_with_caveat REQUIRES a clarification (the rider)', () => {
    let draft = buildRespondToConcessionDraft([TWO_INCOMING[0]]);
    draft = setRowLevel(draft, 'ci-1', 'agree_with_caveat');
    // No clarification — still blocked.
    expect(isPostable(draft).postable).toBe(false);
    draft = setRowClarification(draft, 'ci-1', 'but only for weekdays');
    expect(isPostable(draft).postable).toBe(true);
  });

  it('precedence: row_unpicked beats clarification_empty in firstDisabledReason', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    // Row 1 unpicked, Row 2 picked non-agree but no clarification.
    draft = setRowLevel(draft, 'ci-2', 'disagree_fact');
    const p = isPostable(draft);
    expect(p.firstDisabledReason).toBe('Respond to every conceded point first.');
  });

  it('every non-agree level requires a clarification (full enum coverage)', () => {
    const levels = ['agree_with_caveat', 'disagree_framing', 'disagree_context', 'disagree_fact'] as const;
    for (const level of levels) {
      let draft = buildRespondToConcessionDraft([TWO_INCOMING[0]]);
      draft = setRowLevel(draft, 'ci-1', level);
      // No clarification — blocked.
      expect(isPostable(draft).postable).toBe(false);
      draft = setRowClarification(draft, 'ci-1', 'reason');
      expect(isPostable(draft).postable).toBe(true);
    }
  });
});

// ── buildConcessionAcceptancesPayload ──────────────────────────

describe('buildConcessionAcceptancesPayload', () => {
  it('throws when the draft is NOT postable (defensive)', () => {
    const draft = buildRespondToConcessionDraft(TWO_INCOMING);
    expect(() => buildConcessionAcceptancesPayload(draft)).toThrow(
      /not postable/,
    );
  });

  it('emits one row per mirrored item with level + trimmed clarification', () => {
    let draft = buildRespondToConcessionDraft(TWO_INCOMING);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    draft = setRowLevel(draft, 'ci-2', 'disagree_fact');
    draft = setRowClarification(draft, 'ci-2', '  because X  ');
    const payload = buildConcessionAcceptancesPayload(draft);
    expect(payload).toHaveLength(2);
    expect(payload[0]).toEqual({
      concession_item_id: 'ci-1',
      acceptance_level: 'agree',
      clarification_body: '', // agree → empty
    });
    expect(payload[1]).toEqual({
      concession_item_id: 'ci-2',
      acceptance_level: 'disagree_fact',
      clarification_body: 'because X', // trimmed
    });
  });

  it('always emits empty clarification for `agree` rows (CHECK constraint)', () => {
    let draft = buildRespondToConcessionDraft([TWO_INCOMING[0]]);
    draft = setRowLevel(draft, 'ci-1', 'agree');
    // Pre-fill the clarification (could happen if the user toggled).
    draft = setRowClarification(draft, 'ci-1', 'irrelevant');
    const payload = buildConcessionAcceptancesPayload(draft);
    expect(payload[0].clarification_body).toBe('');
  });
});
