/**
 * FEEDBACK-001 (#898) — the UI-binding pins.
 *
 * RLS exposes marked_by room-wide (the move_reactions precedent), but the UI is
 * bound to NEVER render another viewer's mark identity and NEVER render a
 * per-message mark count. The only mark surfaces are: the viewer's OWN bar state
 * (viewerMoveMarksFor) + the two AMBIENT aggregates (the state-rail grammar + one
 * static legend line). This suite pins both bindings with firing negative
 * controls. A per-message counter or a "K people marked this" surface would
 * re-introduce the leaderboard the doctrine bans.
 */
import fs from 'fs';
import path from 'path';
import { MOVE_MARKS_LEGEND_LINE } from '../src/features/feedback/moveMarksCopy';

const ROOT = process.cwd();
const BAR_SRC = fs.readFileSync(path.join(ROOT, 'src/features/feedback/BooleanFeedbackBar.tsx'), 'utf8');
const RINGSIDE_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/room/RingsideCard.tsx'), 'utf8');
const POPOVER_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/room/MapNodeActionPopover.tsx'), 'utf8');
const HOOK_SRC = fs.readFileSync(path.join(ROOT, 'src/features/feedback/useMoveMarks.ts'), 'utf8');

describe('FEEDBACK-001 — no other-viewer mark identity is rendered', () => {
  it('the bar never references a marker identity (marked_by / markedBy)', () => {
    expect(BAR_SRC).not.toMatch(/marked_by|markedBy/);
  });

  it('the bar renders ONLY the viewer own state, never a list of other markers', () => {
    // The only value that reaches the bar is viewerState (the viewer own booleans)
    // via viewerMoveMarksFor(argumentId). Neither lens passes a rows list / marker
    // identities into the bar.
    expect(RINGSIDE_SRC).toMatch(/viewerState=\{props\.viewerMoveMarksFor\(card\.messageId\)\}/);
    expect(POPOVER_SRC).toMatch(/viewerState=\{props\.viewerMoveMarksFor\(surface\.messageId\)\}/);
    expect(RINGSIDE_SRC).not.toMatch(/marked_by|markedBy/);
    expect(POPOVER_SRC).not.toMatch(/marked_by|markedBy/);
  });

  it('viewerMoveMarksFor is scoped to the viewer id (never another user marks)', () => {
    // The hook summarizes the viewer own marks (summarizeViewerMarks over viewerId)
    // — it never exposes a per-marker breakdown to the UI.
    expect(HOOK_SRC).toMatch(/summarizeViewerMarks\(rows, argumentId, viewerId\)/);
  });

  it('NEGATIVE CONTROL: an identity render would trip the scan', () => {
    const planted = 'Text>{marker.marked_by} marked this</Text';
    expect(/marked_by|markedBy/.test(planted)).toBe(true);
    expect(/marked_by|markedBy/.test(BAR_SRC)).toBe(false);
  });
});

describe('FEEDBACK-001 — no per-message mark count is rendered', () => {
  it('the bar renders no per-message mark count / tally', () => {
    // The bar maps over a fixed UI-code list, never over a count of marks.
    expect(BAR_SRC).not.toMatch(/markCount|marksCount|\.length\}/);
    expect(BAR_SRC).not.toMatch(/people marked|others marked|marked this/i);
  });

  it('the ambient legend line is a static string with no numeric count', () => {
    expect(MOVE_MARKS_LEGEND_LINE).not.toMatch(/\d/);
    expect(MOVE_MARKS_LEGEND_LINE.toLowerCase()).not.toMatch(/people|others|count/);
  });

  it('neither lens renders a marks count chip on the card / popover face', () => {
    expect(RINGSIDE_SRC).not.toMatch(/marksCount|markCount|marks-count/i);
    expect(POPOVER_SRC).not.toMatch(/marksCount|markCount|marks-count/i);
  });

  it('NEGATIVE CONTROL: a per-message counter would trip the scan', () => {
    const planted = 'Text>{`${markCount} marked this`}</Text';
    expect(/markCount|marked this/i.test(planted)).toBe(true);
    expect(/markCount/i.test(BAR_SRC)).toBe(false);
  });
});
