import {
  ROOM_COPY,
  MOVE_COPY,
  RECEIPT_COPY,
  CONCESSION_COPY,
  STATUS_COPY,
  TIMELINE_COPY,
  INVITE_COPY,
  COMPOSER_COPY,
  VALIDATION_COPY,
  ALL_COPY,
} from '../src/features/arguments/gameCopy';

// "hide" and "ban" as UI control labels (e.g. "Hide advanced") are fine.
// These forbidden terms apply to claims about users, intent, or objective truth.
const FORBIDDEN = [
  'liar', 'dishonest', 'bad faith', 'manipulation', 'winner', 'loser',
  'truth verdict', 'objectively true',
];

function allCopyValues(obj: Record<string, unknown>): string[] {
  return Object.values(obj).flatMap((v) =>
    typeof v === 'string' ? [v] : [],
  );
}

describe('gameCopy', () => {
  describe('content safety', () => {
    const allCopyGroups = [
      ROOM_COPY, MOVE_COPY, RECEIPT_COPY, CONCESSION_COPY,
      STATUS_COPY, TIMELINE_COPY, INVITE_COPY, COMPOSER_COPY, VALIDATION_COPY,
    ] as Record<string, unknown>[];

    it('no copy group contains forbidden terms', () => {
      for (const group of allCopyGroups) {
        const values = allCopyValues(group);
        for (const value of values) {
          for (const forbidden of FORBIDDEN) {
            // Allow "winner" only as user-self-description: not present in any string
            expect(value.toLowerCase()).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'));
          }
        }
      }
    });
  });

  describe('room copy', () => {
    it('uses "Argument Room" not "Debate"', () => {
      expect(ROOM_COPY.title).toBe('Argument Room');
      expect(ROOM_COPY.title.toLowerCase()).not.toContain('debate');
    });

    it('uses "Start an argument" for primary CTA', () => {
      expect(ROOM_COPY.startArgument).toBe('Start an argument');
    });
  });

  describe('move copy', () => {
    it('uses "Your Move" for composer header', () => {
      expect(COMPOSER_COPY.yourMove).toBe('Your Move');
    });

    it('has drop receipts copy', () => {
      expect(MOVE_COPY.dropReceipts).toBeTruthy();
      expect(RECEIPT_COPY.receipts).toBeTruthy();
    });
  });

  describe('concession copy', () => {
    it('concession is self-directed (first person)', () => {
      // UX-COPY-001 softened "I'm only MOSTLY wrong" -> "I overstated part of
      // this" (no "wrong" verdict token). The doctrine intent — first person,
      // self-directed — is preserved: both labels begin with "I ".
      expect(CONCESSION_COPY.onlyMostlyWrong).toMatch(/^I /);
      expect(CONCESSION_COPY.onlyMostlyWrong.toLowerCase()).not.toContain('wrong');
      expect(CONCESSION_COPY.misunderstoodContext).toMatch(/I /);
    });

    it('concession labels do not mock the opponent', () => {
      const values = allCopyValues(CONCESSION_COPY as Record<string, unknown>);
      for (const v of values) {
        expect(v.toLowerCase()).not.toContain('you are wrong');
        expect(v.toLowerCase()).not.toContain('you lied');
      }
    });
  });

  describe('status copy', () => {
    it('uses de-scored structural "support" framing, not "ahead"/"winner"', () => {
      // UX-COPY-001 de-scored the comparative-standing copy: "Currently ahead"
      // -> "More support so far", "More supported" -> "Better supported point".
      // No scoreboard / ahead / winner framing.
      expect(STATUS_COPY.currentlyAhead.toLowerCase()).toContain('support');
      expect(STATUS_COPY.currentlyAhead.toLowerCase()).not.toContain('ahead');
      expect(STATUS_COPY.currentlyAhead.toLowerCase()).not.toContain('winner');
      expect(STATUS_COPY.moreSupported.toLowerCase()).toContain('support');
    });

    it('has peace treaty-ish copy', () => {
      expect(STATUS_COPY.peaceTreatyIsh).toBeTruthy();
    });
  });

  describe('ALL_COPY', () => {
    it('has all copy groups', () => {
      expect(ALL_COPY.room).toBe(ROOM_COPY);
      expect(ALL_COPY.move).toBe(MOVE_COPY);
      expect(ALL_COPY.concession).toBe(CONCESSION_COPY);
      expect(ALL_COPY.timeline).toBe(TIMELINE_COPY);
      expect(ALL_COPY.invite).toBe(INVITE_COPY);
    });
  });
});
