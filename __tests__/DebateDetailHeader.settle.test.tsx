/**
 * SETTLE-001 (#911) — DebateDetailHeader wires the creator-only settle row.
 *
 * Source-scan style (mirrors DebateDetailHeader.visibility.test.tsx). The
 * actor + status decision logic (canSettleRoom) is fully covered by
 * settleRoomModel.test.ts; this file proves the header JSX surface consumes it
 * correctly, gates the row to a creator on an open room, routes the write
 * through onSettle (never a direct UPDATE), and leaves make-private untouched.
 */
import fs from 'fs';
import path from 'path';
import { ROOM_SETTLE_COPY } from '../src/features/debates/settleRoomModel';

const HEADER_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'debates', 'DebateDetailHeader.tsx'),
  'utf8',
);

describe('DebateDetailHeader — settle action wiring', () => {
  it('imports canSettleRoom + buildSettleConsequences from the model', () => {
    expect(HEADER_SRC).toMatch(/from '\.\/settleRoomModel'/);
    expect(HEADER_SRC).toContain('canSettleRoom');
    expect(HEADER_SRC).toContain('buildSettleConsequences');
  });

  it('gates settle eligibility on the room CREATOR (createdBy), never a side', () => {
    // The creator gate must key on debate.createdBy (the RLS UPDATE column),
    // mirroring canTransitionToPrivate — never participantSide.
    expect(HEADER_SRC).toMatch(/createdByUserId:\s*debate\.createdBy/);
    expect(HEADER_SRC).toMatch(/roomStatus:\s*debate\.status/);
  });

  it('renders the settle row only when eligible AND App supplied onSettle', () => {
    expect(HEADER_SRC).toMatch(/showSettle = settleEligibility\.allowed && Boolean\(onSettle\)/);
  });

  it('routes the write through onSettle — never a direct debates UPDATE', () => {
    expect(HEADER_SRC).toContain('onSettle');
    // The header never issues a direct UPDATE (the write lane is the hook/api).
    expect(HEADER_SRC).not.toMatch(/supabase\s*\.\s*from\(['"]debates['"]\)/);
    // Settle does NOT reuse the make-private Edge wrapper.
    expect(HEADER_SRC).not.toMatch(/transitionRoomToPrivate\(\s*debate\.id\s*\)[\s\S]{0,40}settle/i);
  });

  it('mounts the settle confirm sheet in settle mode', () => {
    expect(HEADER_SRC).toMatch(/<RoomSettleConfirmation[\s\S]*?mode="settle"/);
  });

  it('exposes testIDs for the settle action and its error', () => {
    expect(HEADER_SRC).toContain('testID="debate-settle-action"');
    expect(HEADER_SRC).toContain('testID="debate-settle-error"');
  });

  it('the settle row carries accessibilityRole button + hint (a11y)', () => {
    expect(HEADER_SRC).toMatch(/accessibilityLabel=\{ROOM_SETTLE_COPY\.action_settle_label\}/);
    expect(HEADER_SRC).toMatch(/accessibilityHint=\{ROOM_SETTLE_COPY\.action_settle_hint\}/);
  });

  it('surfaces a neutral inline error via ROOM_SETTLE_COPY on failure', () => {
    expect(HEADER_SRC).toContain('ROOM_SETTLE_COPY.error_network');
  });

  it('does NOT put the re-open action in the header (re-open lives on the notice)', () => {
    expect(HEADER_SRC).not.toContain('debate-reopen-action');
    expect(HEADER_SRC).not.toMatch(/mode="reopen"/);
  });
});

describe('DebateDetailHeader — make-private co-existence (unchanged)', () => {
  it('keeps the make-private action + its testIDs alongside settle', () => {
    expect(HEADER_SRC).toContain('testID="debate-make-private-action"');
    expect(HEADER_SRC).toContain('testID="debate-make-private-error"');
    expect(HEADER_SRC).toMatch(/showMakePrivate = eligibility\.allowed && debate\.visibility === 'public'/);
  });

  it('still calls canTransitionToPrivate with callerIsModeratorOrAdmin = false', () => {
    expect(HEADER_SRC).toMatch(/callerIsModeratorOrAdmin:\s*false/);
  });

  it('overflow trigger opens when either make-private OR settle is available', () => {
    expect(HEADER_SRC).toMatch(/showMakePrivate \|\| showSettle/);
  });
});

describe('DebateDetailHeader — ROOM_SETTLE_COPY copy contract', () => {
  it('the settle label says "argument", not "debate" (QOL-035)', () => {
    expect(ROOM_SETTLE_COPY.action_settle_label).toMatch(/argument/i);
    expect(ROOM_SETTLE_COPY.action_settle_label).not.toMatch(/\bdebate\b/i);
  });

  it('the settle hint describes the lifecycle change without a verdict', () => {
    const hint = ROOM_SETTLE_COPY.action_settle_hint;
    expect(hint.length).toBeGreaterThan(0);
    expect(hint).not.toMatch(/winner|loser|decided|final|verdict|score/i);
  });
});
