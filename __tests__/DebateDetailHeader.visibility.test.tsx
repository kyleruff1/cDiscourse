/**
 * QOL-039 — DebateDetailHeader wires the make-private action + private
 * badge per design §6.2 / §6.4 / §9 fallback.
 *
 * Source-scan style (mirrors AdminCreateUserForm.test.tsx /
 * CreateDebateForm.visibility.test.tsx). The decision logic
 * (`canTransitionToPrivate`, `buildTransitionConsequences`) is fully
 * covered by `roomVisibilityModel.test.ts`; this file proves the JSX
 * surface uses them.
 */
import fs from 'fs';
import path from 'path';
import { ROOM_VISIBILITY_COPY } from '../src/features/debates/roomVisibilityModel';

const HEADER_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'debates', 'DebateDetailHeader.tsx'),
  'utf8',
);

describe('DebateDetailHeader — make-private action wiring', () => {
  it('imports canTransitionToPrivate + buildTransitionConsequences from the model', () => {
    expect(HEADER_SRC).toMatch(
      /from '\.\/roomVisibilityModel'/,
    );
    expect(HEADER_SRC).toContain('canTransitionToPrivate');
    expect(HEADER_SRC).toContain('buildTransitionConsequences');
  });

  it('calls canTransitionToPrivate with callerIsModeratorOrAdmin = false (OD-1)', () => {
    // OD-1: the model ignores the mod flag. The UI passes false defensively.
    expect(HEADER_SRC).toMatch(/callerIsModeratorOrAdmin:\s*false/);
  });

  it('renders the action only when eligible AND visibility=public', () => {
    expect(HEADER_SRC).toMatch(/showMakePrivate = eligibility\.allowed && debate\.visibility === 'public'/);
  });

  it('uses transitionRoomToPrivate (the Edge Function wrapper) per OD-3', () => {
    expect(HEADER_SRC).toContain('transitionRoomToPrivate');
    // The header never issues a direct UPDATE on debates.
    expect(HEADER_SRC).not.toMatch(/supabase\s*\.\s*from\(['"]debates['"]\)/);
  });

  it('exposes a testID for the action and the error display', () => {
    expect(HEADER_SRC).toContain('testID="debate-make-private-action"');
    expect(HEADER_SRC).toContain('testID="debate-make-private-error"');
  });

  it('surfaces a neutral inline error via ROOM_VISIBILITY_COPY on failure', () => {
    expect(HEADER_SRC).toContain('ROOM_VISIBILITY_COPY.error_network');
  });
});

describe('DebateDetailHeader — accessibility-targets compliance', () => {
  it('the action uses accessibilityRole="button" + accessibilityHint', () => {
    expect(HEADER_SRC).toContain('accessibilityRole="button"');
    expect(HEADER_SRC).toContain('accessibilityHint');
  });

  it('the action and the leave button meet the 44px tap target', () => {
    // Two Pressables; both have minHeight: 44.
    const minHeights = HEADER_SRC.match(/minHeight:\s*44/g) || [];
    expect(minHeights.length).toBeGreaterThanOrEqual(2);
  });
});

describe('DebateDetailHeader — private badge wiring', () => {
  it('renders the private badge when visibility=private', () => {
    expect(HEADER_SRC).toMatch(/showPrivateBadge = debate\.visibility === 'private'/);
  });

  it('uses an accessibilityLabel for the badge that explains the state non-judgmentally', () => {
    expect(HEADER_SRC).toContain('badge_private_a11y');
  });

  it('the badge uses a testID anchor', () => {
    expect(HEADER_SRC).toContain('testID="debate-private-badge"');
  });

  it('badge style uses a border + bold weight (shape carries meaning beyond color)', () => {
    expect(HEADER_SRC).toMatch(/privateBadge:\s*\{[\s\S]*borderWidth:\s*1[\s\S]*\}/);
    expect(HEADER_SRC).toMatch(/privateBadgeText:\s*\{[\s\S]*fontWeight:\s*'700'/);
  });
});

describe('DebateDetailHeader — ROOM_VISIBILITY_COPY copy', () => {
  it('ROOM_VISIBILITY_COPY.badge_private is the visible badge label', () => {
    expect(ROOM_VISIBILITY_COPY.badge_private).toBe('Private');
  });

  it('ROOM_VISIBILITY_COPY.badge_private_a11y explains the state without verdict language', () => {
    const a11y = ROOM_VISIBILITY_COPY.badge_private_a11y;
    expect(a11y).toMatch(/private/i);
    expect(a11y).not.toMatch(/locked|secret|hidden/i);
  });

  it('ROOM_VISIBILITY_COPY.action_make_private_label says "argument", not "debate" (QOL-035)', () => {
    expect(ROOM_VISIBILITY_COPY.action_make_private_label).toMatch(/argument/i);
    expect(ROOM_VISIBILITY_COPY.action_make_private_label).not.toMatch(/\bdebate\b/i);
  });
});
