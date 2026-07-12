/**
 * UX-PR-G (#920) P1-9c — projectCirclesForPicker pure-model tests.
 *
 * The circles picker rows must (1) strip any fixture tag from the label always,
 * and (2) drop fixture-named circles for non-admins (mirrors the gallery / home
 * fixture exclusion). In practice a real circle name never matches the fixture
 * predicate (it needs a bracketed run-tag), so this is a defensive guard.
 */
import { projectCirclesForPicker } from '../src/features/circles/circleHomeFilter';

const circle = (over: Partial<{ id: string; name: string; memberCount: number }> = {}) => ({
  id: over.id ?? 'c1',
  name: over.name ?? 'Weekend debaters',
  memberCount: over.memberCount ?? 3,
});

describe('projectCirclesForPicker', () => {
  it('strips a fixture tag from the label ALWAYS (admin and non-admin)', () => {
    const c = circle({ id: 'cx', name: 'Cohort [stress chime-mrgpodh6]', memberCount: 4 });
    for (const isAdminViewer of [true, false]) {
      const rows = projectCirclesForPicker([c], { isAdminViewer });
      // Admin keeps it; the label is stripped either way.
      if (isAdminViewer) {
        expect(rows).toHaveLength(1);
        expect(rows[0].label).toBe('Cohort');
      }
    }
  });

  it('drops fixture-named circles for non-admins, keeps them for admins', () => {
    const circles = [
      circle({ id: 'real', name: 'Weekend debaters' }),
      circle({ id: 'fx', name: 'Cohort [xai-adv 9018694f]' }),
    ];
    const nonAdmin = projectCirclesForPicker(circles, { isAdminViewer: false });
    expect(nonAdmin.map((r) => r.id)).toEqual(['real']);

    const admin = projectCirclesForPicker(circles, { isAdminViewer: true });
    expect(admin.map((r) => r.id)).toEqual(['real', 'fx']);
    expect(admin.find((r) => r.id === 'fx')?.label).toBe('Cohort');
  });

  it('passes real circle names through unchanged (never matches the fixture predicate)', () => {
    const rows = projectCirclesForPicker([circle({ id: 'c1', name: 'Weekend debaters' })], {
      isAdminViewer: false,
    });
    expect(rows).toEqual([{ id: 'c1', label: 'Weekend debaters', memberCount: 3 }]);
  });

  it('coerces memberCount to a non-negative integer (a size, never a rating)', () => {
    const rows = projectCirclesForPicker(
      [circle({ id: 'c1', name: 'A', memberCount: -5 }), circle({ id: 'c2', name: 'B', memberCount: 2.9 })],
      { isAdminViewer: false },
    );
    expect(rows[0].memberCount).toBe(0);
    expect(rows[1].memberCount).toBe(2);
  });

  it('returns [] for a non-array input defensively', () => {
    expect(projectCirclesForPicker(null as unknown as [], { isAdminViewer: false })).toEqual([]);
  });
});
