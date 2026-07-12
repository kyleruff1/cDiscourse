/**
 * UX-001.4 — Duplicate rail removal disposition lock.
 *
 * For every entry in `ArgumentSideActionRail` and
 * `TimelineNodeActionDock` design §1 Table B audited, this suite
 * asserts the resulting rail / dock state matches the disposition:
 *
 *   - migrate-to-Act: the entry is REMOVED from the rail / dock
 *     surface.
 *   - preserve-as-shortcut: the entry STAYS in the rail / dock.
 *   - retain-with-rationale: the entry STAYS with an explicit reason
 *     (mark_moved_on, mark_ignored, expand_branch survive in the dock).
 *
 * UX-PR-G (#920) P1-12 update: `share` was the last retain-with-rationale rail
 * entry, but it was a guaranteed no-op (zero suppliers, no room URLs), so it was
 * REMOVED from the observer rail. The B.1 disposition below now asserts absence.
 */
import {
  getRailActions,
  type RailActionCode,
} from '../src/features/arguments/ArgumentSideActionRail';
import {
  DOCK_SURVIVING_ACTION_CODES,
  substituteMigratedPrimary,
  type TimelineNodeActionDockActionCode,
} from '../src/features/arguments/timelineNodeActionDockModel';

// ── Table B.1 — Observer rail dispositions ─────────────────────

describe('UX-001.4 Table B.1 — observer rail dispositions', () => {
  const codes = new Set<RailActionCode>(
    getRailActions('observer', 'other').map((a) => a.code),
  );

  it('watch — preserve-as-shortcut (still in rail)', () => {
    expect(codes.has('watch')).toBe(true);
  });

  it('join_aff — preserve-as-shortcut (still in rail)', () => {
    expect(codes.has('join_aff')).toBe(true);
  });

  it('join_neg — preserve-as-shortcut (still in rail)', () => {
    expect(codes.has('join_neg')).toBe(true);
  });

  it('ask_source — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('ask_source')).toBe(false);
  });

  it('open_timeline — migrate-to-Go (REMOVED from rail)', () => {
    expect(codes.has('open_timeline')).toBe(false);
  });

  it('share — REMOVED from rail (UX-PR-G #920 P1-12: guaranteed no-op, no room URLs)', () => {
    expect(codes.has('share')).toBe(false);
  });
});

// ── Table B.2 — Participant on other-bubble ────────────────────

describe('UX-001.4 Table B.2 — participant on other-bubble dispositions', () => {
  const codes = new Set<RailActionCode>(
    getRailActions('participant', 'other').map((a) => a.code),
  );

  it('reply — preserve-as-shortcut (high-frequency; still in rail)', () => {
    expect(codes.has('reply')).toBe(true);
  });

  it('disagree — preserve-as-shortcut (high-frequency; still in rail)', () => {
    expect(codes.has('disagree')).toBe(true);
  });

  it('ask_source — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('ask_source')).toBe(false);
  });

  it('ask_quote — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('ask_quote')).toBe(false);
  });

  it('split_branch — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('split_branch')).toBe(false);
  });

  it('flag — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('flag')).toBe(false);
  });

  it('qualifiers — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('qualifiers')).toBe(false);
  });
});

// ── Table B.3 — Self (own bubble) ──────────────────────────────

describe('UX-001.4 Table B.3 — self (own bubble) dispositions', () => {
  const codes = new Set<RailActionCode>(
    getRailActions('participant', 'self').map((a) => a.code),
  );

  it('rail action set is empty (collapsed to "Open Act ▾" affordance)', () => {
    expect(codes.size).toBe(0);
  });

  it('qualifiers — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('qualifiers')).toBe(false);
  });

  it('request_deletion — migrate-to-Act (REMOVED from rail)', () => {
    expect(codes.has('request_deletion')).toBe(false);
  });
});

// ── Table B.4 — Timeline node action dock dispositions ─────────

describe('UX-001.4 Table B.4 — timeline node action dock dispositions', () => {
  const surviving = DOCK_SURVIVING_ACTION_CODES;

  // Surviving: 6 codes (5 from design + expand_branch).
  it('exposes exactly 6 surviving codes (UX-001.4 design §1 Table B.4)', () => {
    expect(surviving.size).toBe(6);
  });

  it('reply — preserve-as-shortcut (still surfaced)', () => {
    expect(surviving.has('reply')).toBe(true);
  });

  it('challenge — preserve-as-shortcut (still surfaced)', () => {
    expect(surviving.has('challenge')).toBe(true);
  });

  it('mark_moved_on — retain (META-001 manual tag application; not a Constitution move)', () => {
    expect(surviving.has('mark_moved_on')).toBe(true);
  });

  it('mark_ignored — retain (META-001 manual tag application; not a Constitution move)', () => {
    expect(surviving.has('mark_ignored')).toBe(true);
  });

  it('open_cards_detail — preserve (board view toggle; not a move)', () => {
    expect(surviving.has('open_cards_detail')).toBe(true);
  });

  it('expand_branch — retain (BR-001 collapse toggle; not a move)', () => {
    expect(surviving.has('expand_branch')).toBe(true);
  });

  // Migrate-to-Act dispositions: every migrated code is no longer
  // surfaced.
  const migratedToAct: TimelineNodeActionDockActionCode[] = [
    'ask_source',
    'ask_quote',
    'clarify',
    'add_evidence',
    'narrow',
    'concede',
    'confirm',
    'branch',
    'synthesize',
    'flag',
  ];

  for (const migrated of migratedToAct) {
    it(`${migrated} — migrate-to-Act (NOT in surviving set)`, () => {
      expect(surviving.has(migrated)).toBe(false);
    });
  }
});

// ── Substitution policy ─────────────────────────────────────────

describe('UX-001.4 — substituteMigratedPrimary mapping', () => {
  it('surviving codes pass through unchanged', () => {
    for (const code of DOCK_SURVIVING_ACTION_CODES) {
      expect(substituteMigratedPrimary(code)).toBe(code);
    }
  });

  it('adversarial migrated codes (ask_source / ask_quote / clarify) substitute to challenge', () => {
    expect(substituteMigratedPrimary('ask_source')).toBe('challenge');
    expect(substituteMigratedPrimary('ask_quote')).toBe('challenge');
    expect(substituteMigratedPrimary('clarify')).toBe('challenge');
  });

  it('resolve / structure migrated codes substitute to reply', () => {
    expect(substituteMigratedPrimary('narrow')).toBe('reply');
    expect(substituteMigratedPrimary('concede')).toBe('reply');
    expect(substituteMigratedPrimary('confirm')).toBe('reply');
    expect(substituteMigratedPrimary('synthesize')).toBe('reply');
    expect(substituteMigratedPrimary('branch')).toBe('reply');
    expect(substituteMigratedPrimary('add_evidence')).toBe('reply');
  });

  it('flag substitutes to open_cards_detail (review context first)', () => {
    expect(substituteMigratedPrimary('flag')).toBe('open_cards_detail');
  });
});
