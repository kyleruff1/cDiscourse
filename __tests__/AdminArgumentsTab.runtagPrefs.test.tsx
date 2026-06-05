/**
 * ADMIN-ARGUMENTS-003 — AdminArgumentsTab UI shape tests (runTag filter +
 * persistable prefs slices).
 *
 * Following the existing AdminArgumentsTab.inactive.test.tsx precedent, we
 * don't mount the React Native component (no native renderer in CI for this
 * heavyweight tab); we test the source-file shape: required testIDs, a11y
 * attributes (role / state / hint / hitSlop), the prefs-hook wiring, the
 * runTag-filter call into the model, the density override, the deferred
 * participant-kind copy, and a verdict-token ban-list scan of the rendered
 * copy literals.
 *
 * The behavioural guarantees (classification, persistence, restore) are
 * covered by the pure-model + hook tests:
 *   - adminArgumentsRunTagModel.test.ts
 *   - adminArgumentsPrefsModel.test.ts
 *   - useAdminArgumentsPrefs.test.tsx
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'),
  'utf8',
);

describe('AdminArgumentsTab — persistable prefs wiring', () => {
  it('uses the persisted prefs hook instead of local sort / limit state', () => {
    expect(src).toContain('useAdminArgumentsPrefs');
    expect(src).toMatch(/const\s*\{\s*prefs,\s*updatePref\s*\}\s*=\s*useAdminArgumentsPrefs\(\)/);
    // The old local sort / limit useState declarations must be gone.
    expect(src).not.toMatch(/useState<AdminArgumentsSortField>/);
    expect(src).not.toMatch(/const \[limit, setLimit\] = useState/);
  });

  it('derives limit / sort / runTag / density from prefs', () => {
    expect(src).toMatch(/const limit = prefs\.limit/);
    expect(src).toMatch(/const sortField = prefs\.sortField/);
    expect(src).toMatch(/const sortDirection = prefs\.sortDirection/);
    expect(src).toMatch(/const runTagFilter = prefs\.runTagFilter/);
    expect(src).toMatch(/const density = prefs\.density/);
  });

  it('routes limit + sort changes through updatePref (so they persist)', () => {
    expect(src).toMatch(/updatePref\('limit',/);
    expect(src).toMatch(/updatePref\('sortField', field\)/);
    expect(src).toMatch(/updatePref\('sortDirection',/);
  });
});

describe('AdminArgumentsTab — runTag filter row', () => {
  it('renders the runTag toolbar with its accessibility label', () => {
    expect(src).toContain('admin-arguments-runtag-toolbar');
    expect(src).toContain('admin-arguments-runtag-hint');
  });

  it('renders a chip per filter value via RUN_TAG_FILTER_VALUES', () => {
    expect(src).toContain('RUN_TAG_FILTER_VALUES.map');
    expect(src).toContain('testID={`admin-arguments-runtag-${value}`}');
  });

  it('runTag chips have button role, selected state, hint, and a tap target', () => {
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/accessibilityState=\{\{ selected: active \}\}/);
    expect(src).toMatch(/accessibilityHint=\{RUN_TAG_FILTER_HINTS\[value\]\}/);
    expect(src).toMatch(/hitSlop=\{\{ top: 10, bottom: 10, left: 6, right: 6 \}\}/);
  });

  it('routes the runTag selection through updatePref so it persists', () => {
    expect(src).toMatch(/updatePref\('runTagFilter', value\)/);
  });

  it('applies the runTag filter through the pure model in the filtered memo', () => {
    expect(src).toContain('classifyRunFamily({ debateTitle: r.debateTitle })');
    expect(src).toContain('runFamilyMatchesFilter(family, runTagFilter)');
  });
});

describe('AdminArgumentsTab — density control', () => {
  it('renders comfortable + compact density chips with testIDs', () => {
    expect(src).toContain('testID="admin-arguments-density-comfortable"');
    expect(src).toContain('testID="admin-arguments-density-compact"');
  });

  it('density chips route through updatePref', () => {
    expect(src).toMatch(/updatePref\('density', 'comfortable'\)/);
    expect(src).toMatch(/updatePref\('density', 'compact'\)/);
  });

  it('applies the density cell padding via the pure model helper', () => {
    expect(src).toContain('densityToCellPaddingY(density)');
    expect(src).toContain('densityCellStyle');
  });
});

describe('AdminArgumentsTab — deferred participant-kind control', () => {
  it('shows honest coming-later copy for the bot/human filter (Blocker B1)', () => {
    expect(src).toContain('admin-arguments-participant-kind-deferred');
    expect(src).toMatch(/Bot \/ human filter coming later\./);
  });
});

describe('AdminArgumentsTab — doctrine (navigation framing, no verdicts)', () => {
  it('frames the runTag filter as a navigation aid, not a verdict', () => {
    expect(src.toLowerCase()).toContain('navigation aid, not a verdict');
  });

  it('the new ADMIN-ARGUMENTS-003 copy literals carry no verdict token', () => {
    // Scan the user-visible string literals the tab renders for the card's
    // new controls. We restrict to the obvious copy lines to avoid matching
    // the word "false" inside boolean expressions / props.
    const VERDICT_TOKENS = [
      'winner', 'loser', 'liar', 'dishonest', 'bad faith',
      'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
    ];
    const copyLines = [
      'Room source:',
      'Density:',
      'Comfortable',
      'Compact',
      'Bot / human filter coming later.',
      'The room-source filter is a navigation aid, not a verdict on any room.',
    ];
    for (const line of copyLines) {
      expect(src).toContain(line);
      for (const banned of VERDICT_TOKENS) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });
});
