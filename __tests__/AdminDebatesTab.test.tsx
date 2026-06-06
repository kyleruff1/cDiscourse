/**
 * ADMIN-CONV-INACTIVE-001 — AdminDebatesTab UI shape + wiring tests.
 *
 * Following the AdminArgumentsTab.inactive.test.tsx precedent, we test the
 * source-file shape (required testIDs, the Inactive column, the Show-inactives
 * toggle, the bulk toolbar, the per-row affordances, the bulk cap) plus the
 * AdminScreen tab registration and the loader/view-model wiring.
 *
 * The poisoned-fixture §10a invariant lives in
 * debateInactiveReasonNeverRendered.test.tsx (it mounts the component).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminDebatesTab.tsx'),
  'utf8',
);

describe('AdminDebatesTab — Show-inactives toggle', () => {
  it('renders the toggle Pressable with switch role + testID', () => {
    expect(src).toContain('testID="admin-debates-show-inactives-toggle"');
    expect(src).toContain('accessibilityRole="switch"');
  });

  it('default toggle state is OFF (includeInactives initial value false)', () => {
    expect(src).toMatch(/includeInactives,\s*setIncludeInactives/);
    expect(src).toMatch(/setIncludeInactives\] = useState\(false\)|useState\(false\)/);
  });

  it('passes includeInactives through to loadAdminDebates', () => {
    expect(src).toMatch(/loadAdminDebates\(\{[\s\S]*?includeInactives,?[\s\S]*?\}\)/);
  });
});

describe('AdminDebatesTab — projects to the reason-free view-model at load', () => {
  it('imports and uses toAdminDebateRowView', () => {
    expect(src).toContain("import { toAdminDebateRowView } from './adminDebateRowView'");
    expect(src).toMatch(/fresh\.map\(toAdminDebateRowView\)/);
  });

  it('the render state holds AdminDebateRowView[] (never the raw loader row)', () => {
    expect(src).toMatch(/useState<AdminDebateRowView\[\]>\(\[\]\)/);
  });

  it('never references the admin-only inactiveReason field', () => {
    // The reason is structurally absent from AdminDebateRowView; the tab must
    // not read inactiveReason / inactive_reason from anywhere.
    expect(src).not.toContain('inactiveReason');
    expect(src).not.toContain('inactive_reason');
  });
});

describe('AdminDebatesTab — Inactive column', () => {
  it('renders the inactive header + cell testIDs', () => {
    expect(src).toContain('testID="admin-debates-header-inactive"');
    expect(src).toContain('testID="admin-debates-cell-inactive"');
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

  it('derives isInactive from the view-model (inactiveAt only), never a reason', () => {
    expect(src).toMatch(/const isInactive = r\.isInactive/);
  });
});

describe('AdminDebatesTab — per-row checkbox + selection state', () => {
  it('renders the per-row checkbox testID pattern', () => {
    expect(src).toContain('testID={`admin-debates-checkbox-${r.id}`}');
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

describe('AdminDebatesTab — bulk toolbar', () => {
  it('renders only when selectedIds is non-empty', () => {
    expect(src).toMatch(/selectedIds\.size\s*>\s*0\s*&&/);
    expect(src).toContain('testID="admin-debates-bulk-toolbar"');
  });

  it('renders Mark inactive + Mark active bulk buttons', () => {
    expect(src).toContain('testID="admin-debates-bulk-action-mark-inactive"');
    expect(src).toContain('testID="admin-debates-bulk-action-mark-active"');
  });

  it('shows a Selected: N of M counter', () => {
    expect(src).toMatch(/Selected:\s*\{selectedIds\.size\}\s*of\s*\{rows\.length\}/);
  });
});

describe('AdminDebatesTab — bulk confirm dialog', () => {
  it('renders only when bulkDialog state is non-null', () => {
    expect(src).toContain('testID="admin-debates-bulk-confirm-dialog"');
    expect(src).toMatch(/bulkDialog\s*&&/);
  });

  it('renders a reason input bounded to 500 chars (client cap mirrors the argument UI)', () => {
    expect(src).toContain('testID="admin-debates-bulk-reason-input"');
    expect(src).toMatch(/maxLength=\{500\}/);
  });

  it('renders confirm + cancel actions with testIDs', () => {
    expect(src).toContain('testID="admin-debates-bulk-confirm"');
    expect(src).toContain('testID="admin-debates-bulk-cancel"');
  });

  it('confirm calls submitBulkDialog which routes to the bulk wrapper', () => {
    expect(src).toMatch(/bulkMarkDebateInactive\(bulkDialog\.ids,\s*reason\)/);
    expect(src).toMatch(/bulkMarkDebateActive\(bulkDialog\.ids,\s*reason\)/);
  });
});

describe('AdminDebatesTab — per-row Mark inactive / Mark active', () => {
  it('renders the per-row mark-inactive testID for active rows', () => {
    expect(src).toContain('admin-debates-row-mark-inactive-${r.id}');
  });

  it('renders the per-row mark-active testID for inactive rows', () => {
    expect(src).toContain('admin-debates-row-mark-active-${r.id}');
  });

  it('calls the typed wrappers, not the raw edge invoke', () => {
    expect(src).toContain('markDebateInactive');
    expect(src).toContain('markDebateActive');
  });
});

describe('AdminDebatesTab — bulk cap discipline', () => {
  it('imports ADMIN_BULK_DEBATE_INACTIVE_ID_CAP and caps the dialog id list at 100', () => {
    expect(src).toContain('ADMIN_BULK_DEBATE_INACTIVE_ID_CAP');
    expect(src).toMatch(/slice\(0,\s*ADMIN_BULK_DEBATE_INACTIVE_ID_CAP\)/);
  });
});

describe('AdminScreen wiring', () => {
  it('registers the "debates" tab id and the AdminDebatesTab component', () => {
    const screen = fs.readFileSync(
      path.join(repoRoot, 'src/features/admin/AdminScreen.tsx'),
      'utf8',
    );
    expect(screen).toContain("'debates'");
    expect(screen).toContain('AdminDebatesTab');
    expect(screen).toMatch(/tab === 'debates' && <AdminDebatesTab \/>/);
  });

  it('ADMIN_TAB_LABELS contains a "debates" label', () => {
    const types = fs.readFileSync(
      path.join(repoRoot, 'src/features/admin/types.ts'),
      'utf8',
    );
    expect(types).toMatch(/debates\s*:\s*['"]Debates['"]/);
  });
});

describe('adminDebatesApi — safety + shape', () => {
  const api = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/adminDebatesApi.ts'),
    'utf8',
  );

  it('uses the shared supabase client (no service-role construction)', () => {
    expect(api).toContain("from '../../lib/supabase'");
    expect(api).not.toMatch(/createClient\(/);
  });

  it('does not reference any service-role / secret-shape strings', () => {
    expect(api).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(api).not.toMatch(/serviceRoleKey/);
    expect(api).not.toMatch(/sb_secret_[A-Za-z0-9]/);
  });

  it('uses RLS-friendly select (no .rpc() bypass)', () => {
    expect(api).toContain(".from('debates')");
    expect(api).not.toMatch(/\.rpc\(/);
  });

  it('backs the Show-inactives toggle with .is("inactive_at", null) when default', () => {
    expect(api).toMatch(/\.is\('inactive_at',\s*null\)/);
  });
});

describe('adminDebatesInactiveApi — wrapper safety', () => {
  const wrap = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/adminDebatesInactiveApi.ts'),
    'utf8',
  );

  it('exports the four wrappers', () => {
    expect(wrap).toContain('export async function markDebateInactive');
    expect(wrap).toContain('export async function markDebateActive');
    expect(wrap).toContain('export async function bulkMarkDebateInactive');
    expect(wrap).toContain('export async function bulkMarkDebateActive');
  });

  it('routes through adminUsers (no direct service-role / createClient)', () => {
    expect(wrap).toContain("from '../../lib/edgeFunctions'");
    expect(wrap).not.toMatch(/createClient\(/);
    expect(wrap).not.toMatch(/SERVICE_ROLE/);
  });

  it('never picks an inactive_at timestamp on the wire', () => {
    expect(wrap).not.toMatch(/inactive_at:/);
  });
});
