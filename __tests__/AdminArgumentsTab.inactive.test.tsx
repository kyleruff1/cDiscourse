/**
 * ADMIN-ARGS-INACTIVE-001 — AdminArgumentsTab UI shape tests.
 *
 * Following the existing adminArguments.test.ts precedent, we don't mount
 * the React Native component (no native renderer in CI); we test the
 * source-file shape: required testIDs, the new column header, the
 * Show-inactives toggle, the bulk toolbar, and the per-row affordances.
 *
 * The leakage scan in argumentInactiveLeakageScan.test.ts asserts the
 * `inactive_reason` field is NEVER rendered on user-facing surfaces.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'),
  'utf8',
);

describe('AdminArgumentsTab — Show-inactives toggle', () => {
  it('renders the toggle Pressable as a clearly-visible BUTTON + testID', () => {
    // ADMIN-CONV-INACTIVE-VISIBILITY-001 — the operator reported the prior
    // control read as inert text. It is now a real button with a visible
    // checkbox-style indicator + plain "Show / Showing inactives" copy. The
    // role moved from "switch" to "button" with an explicit `selected` state.
    expect(src).toContain('testID="admin-arguments-show-inactives-toggle"');
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toMatch(/accessibilityState=\{\{ selected: includeInactives \}\}/);
    expect(src).toContain('admin-arguments-show-inactives-toggle');
  });

  it('default toggle state is OFF (includeInactives initial value false)', () => {
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/includeInactives,\s*setIncludeInactives/);
  });

  it('passes includeInactives through to loadAdminArguments', () => {
    expect(src).toMatch(/loadAdminArguments\(\{[\s\S]*?includeInactives,?[\s\S]*?\}\)/);
  });
});

describe('AdminArgumentsTab — Inactive column', () => {
  it('renders the inactive header testID', () => {
    expect(src).toContain('testID="admin-arguments-header-inactive"');
  });

  it('renders the inactive cell testID', () => {
    expect(src).toContain('testID="admin-arguments-cell-inactive"');
  });

  it('renders the Inactive header label literal', () => {
    expect(src).toMatch(/>Inactive</);
  });

  it('renders both Active and Inactive chips depending on row state', () => {
    expect(src).toMatch(/label="Active"/);
    expect(src).toMatch(/label="Inactive"/);
  });

  it('renders relative timestamp for inactive rows', () => {
    expect(src).toMatch(/formatRelativeShort\(r\.inactiveAt!\)/);
  });
});

describe('AdminArgumentsTab — per-row checkbox + selection state', () => {
  it('renders the per-row checkbox testID pattern', () => {
    expect(src).toContain('testID={`admin-arguments-checkbox-${r.id}`}');
  });

  it('checkbox has accessibilityRole="checkbox" and accessibilityState.checked', () => {
    expect(src).toContain('accessibilityRole="checkbox"');
    expect(src).toMatch(/accessibilityState=\{\{\s*checked:\s*isSelected\s*\}\}/);
  });

  it('toggles selectedIds via the toggleSelect callback', () => {
    expect(src).toMatch(/const toggleSelect = useCallback/);
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*toggleSelect\(r\.id\)\}/);
  });
});

describe('AdminArgumentsTab — bulk toolbar', () => {
  it('renders only when selectedIds is non-empty', () => {
    expect(src).toMatch(/selectedIds\.size\s*>\s*0\s*&&/);
    expect(src).toContain('testID="admin-arguments-bulk-toolbar"');
  });

  it('renders Mark inactive + Mark active bulk buttons', () => {
    expect(src).toContain('testID="admin-arguments-bulk-action-mark-inactive"');
    expect(src).toContain('testID="admin-arguments-bulk-action-mark-active"');
  });

  it('shows a Selected: N of M counter', () => {
    expect(src).toMatch(/Selected:\s*\{selectedIds\.size\}\s*of\s*\{rows\.length\}/);
  });
});

describe('AdminArgumentsTab — bulk confirm dialog', () => {
  it('renders only when bulkDialog state is non-null', () => {
    expect(src).toContain('testID="admin-arguments-bulk-confirm-dialog"');
    expect(src).toMatch(/bulkDialog\s*&&/);
  });

  it('renders a reason input bounded to 500 chars', () => {
    expect(src).toContain('testID="admin-arguments-bulk-reason-input"');
    expect(src).toMatch(/maxLength=\{500\}/);
  });

  it('renders confirm + cancel actions with testIDs', () => {
    expect(src).toContain('testID="admin-arguments-bulk-confirm"');
    expect(src).toContain('testID="admin-arguments-bulk-cancel"');
  });

  it('confirm calls submitBulkDialog which routes to bulk wrapper', () => {
    expect(src).toMatch(/bulkMarkArgumentInactive\(bulkDialog\.ids,\s*reason\)/);
    expect(src).toMatch(/bulkMarkArgumentActive\(bulkDialog\.ids,\s*reason\)/);
  });
});

describe('AdminArgumentsTab — per-row Mark inactive / Mark active', () => {
  it('renders the per-row mark-inactive testID for active rows', () => {
    expect(src).toContain('admin-arguments-row-mark-inactive-${r.id}');
  });

  it('renders the per-row mark-active testID for inactive rows', () => {
    expect(src).toContain('admin-arguments-row-mark-active-${r.id}');
  });

  it('calls the typed wrappers, not the raw edge invoke', () => {
    expect(src).toContain('markArgumentInactive');
    expect(src).toContain('markArgumentActive');
  });
});

describe('AdminArgumentsTab — bulk cap discipline', () => {
  it('imports ADMIN_BULK_INACTIVE_ID_CAP and caps the dialog id list at 100', () => {
    expect(src).toContain('ADMIN_BULK_INACTIVE_ID_CAP');
    expect(src).toMatch(/slice\(0,\s*ADMIN_BULK_INACTIVE_ID_CAP\)/);
  });
});
