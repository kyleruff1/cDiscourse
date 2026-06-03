/**
 * ADMIN-AI-001 — AdminSemanticRefereeTab component contract.
 *
 * Follows the repo's established `.test.tsx` discipline (see
 * `AdminCreateUserForm.test.tsx` / `adminMetadataEventsTab.test.tsx`): the
 * tab's behaviour is exercised through its extracted shared rule
 * (`requiresProviderConfirmation`, covered fully in
 * `semanticRefereeConfigApi.test.ts`) plus a static source scan that proves
 * the component wires the read / write / confirmation surfaces correctly.
 *
 * Runtime react-test-renderer rendering is intentionally avoided — no existing
 * `.test.tsx` in this repo uses it (the installed react-test-renderer is
 * version-pinned away from @testing-library's peer range).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const TAB_SRC = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminSemanticRefereeTab.tsx'),
  'utf8',
);

// ── 1. Read surface — fetch on mount, status card ────────────────

describe('AdminSemanticRefereeTab — reads config on mount', () => {
  it('calls adminGetSemanticRefereeConfig and stores the result', () => {
    expect(TAB_SRC).toContain('adminGetSemanticRefereeConfig');
    expect(TAB_SRC).toMatch(/useEffect\(\(\) => \{ fetchConfig\(\); \}, \[fetchConfig\]\)/);
  });

  it('renders the status card with the current mode + config source', () => {
    expect(TAB_SRC).toContain('testID="admin-semantic-referee-status"');
    expect(TAB_SRC).toContain('admin-semantic-referee-current-mode');
    expect(TAB_SRC).toMatch(/Saved setting \(database\)/);
  });

  it('renders the current mode through PROVIDER_MODE_LABELS (plain label, not a code)', () => {
    expect(TAB_SRC).toContain('PROVIDER_MODE_LABELS[config.providerMode]');
  });
});

// ── 2. Anthropic key — boolean only, never the value ─────────────

describe('AdminSemanticRefereeTab — Anthropic key status is a boolean only', () => {
  it('renders an "Anthropic key present" Yes/No boolean line', () => {
    expect(TAB_SRC).toContain('admin-semantic-referee-key-present');
    expect(TAB_SRC).toMatch(/Anthropic key present/);
    expect(TAB_SRC).toMatch(/anthropicKeyPresent \? 'Yes' : 'No'/);
  });

  it('never references the ANTHROPIC_API_KEY env var or a key value', () => {
    expect(TAB_SRC).not.toContain('ANTHROPIC_API_KEY');
    expect(TAB_SRC).not.toMatch(/sk-ant/);
    // The only key-related token is the safe boolean.
    expect(TAB_SRC).not.toMatch(/Deno\.env/);
  });
});

// ── 3. Provider selector — anthropic/mock/fixture/mcp all selectable ──

describe('AdminSemanticRefereeTab — provider mode selector', () => {
  it('renders a selectable row for each of the four modes via SELECTABLE_MODES', () => {
    // All four modes are rendered in a `.map()` over SELECTABLE_MODES, so the
    // accessibilityLabel is a template literal. mcp was added 2026-06-03 (MCP
    // server is up; the slot is no longer reserved-but-disabled).
    expect(TAB_SRC).toMatch(/SELECTABLE_MODES.*=.*\[\s*'anthropic',\s*'mock',\s*'fixture',\s*'mcp',?\s*\]/s);
    expect(TAB_SRC).toMatch(/accessibilityLabel=\{`admin-semantic-referee-mode-\$\{mode\}`\}/);
  });

  it('the mcp slot is settable (no separate disabled row, no early-return guard)', () => {
    // No standalone disabled mcp row — it is rendered via the SELECTABLE_MODES map.
    expect(TAB_SRC).not.toMatch(/{\s*\/\*\s*mcp\s*—\s*shown disabled/);
    // No early-return guard that blocks selecting mcp.
    expect(TAB_SRC).not.toMatch(/if \(mode === 'mcp'\) return;/);
    // No early-return guard that blocks the enabled toggle on mcp.
    expect(TAB_SRC).not.toMatch(/if \(config\.providerMode === 'mcp'\) return;/);
  });
});

// ── 4. Confirmation flows — Anthropic confirm; one-click Mock ────

describe('AdminSemanticRefereeTab — Anthropic confirmation flow', () => {
  it('routes a switch INTO anthropic through requiresProviderConfirmation', () => {
    expect(TAB_SRC).toContain('requiresProviderConfirmation');
    expect(TAB_SRC).toMatch(/requiresProviderConfirmation\(mode\)/);
  });

  it('opens a confirmation panel before switching to anthropic', () => {
    expect(TAB_SRC).toContain('testID="admin-semantic-referee-confirm-anthropic"');
    expect(TAB_SRC).toMatch(/Switch to Anthropic\?/);
    expect(TAB_SRC).toMatch(/Anthropic mode may use provider credits\. Continue\?/);
  });

  it('the confirm panel has Cancel and Continue actions', () => {
    expect(TAB_SRC).toContain('admin-semantic-referee-confirm-cancel');
    expect(TAB_SRC).toContain('admin-semantic-referee-confirm-accept');
  });

  it('confirming sends confirmAnthropic: true on the write', () => {
    expect(TAB_SRC).toMatch(/providerMode: 'anthropic',[\s\S]*?confirmAnthropic: true/);
  });

  it('switching to mock / fixture does NOT open the confirm panel (one-click)', () => {
    // The non-anthropic branch calls applyChange directly — no setPendingAnthropic.
    expect(TAB_SRC).toMatch(/void applyChange\(\{ providerMode: mode, enabled: config\.enabled \}\)/);
  });
});

// ── 5. Enabled toggle ────────────────────────────────────────────

describe('AdminSemanticRefereeTab — runtime enabled toggle', () => {
  it('renders an enabled toggle with the switch a11y role', () => {
    expect(TAB_SRC).toContain('admin-semantic-referee-enabled-toggle');
    expect(TAB_SRC).toMatch(/accessibilityRole="switch"/);
  });

  it('the toggle is always available when a config row exists (all four modes are settable)', () => {
    expect(TAB_SRC).toMatch(/enabledToggleAvailable\s*=\s*config != null/);
    // No mode-specific exclusion — mcp was added 2026-06-03.
    expect(TAB_SRC).not.toMatch(/config\.providerMode !== 'mcp'/);
  });
});

// ── 6. State surfaces — loading / error / saving / success ───────

describe('AdminSemanticRefereeTab — actionable state surfaces', () => {
  it('renders loading / error / saving / success states', () => {
    for (const id of [
      'admin-semantic-referee-loading',
      'admin-semantic-referee-error',
      'admin-semantic-referee-saving',
      'admin-semantic-referee-success',
      'admin-semantic-referee-save-error',
    ]) {
      expect(TAB_SRC).toContain(id);
    }
  });

  it('the error state offers a retry action', () => {
    expect(TAB_SRC).toContain('admin-semantic-referee-retry');
    expect(TAB_SRC).toMatch(/Try again/);
  });

  it('routes errors through adminErrorMessage (no raw error code rendered)', () => {
    expect(TAB_SRC).toContain('adminErrorMessage');
  });

  it('re-fetches after a successful write so the admin sees the settled state', () => {
    expect(TAB_SRC).toMatch(/await fetchConfig\(\)/);
  });
});

// ── 7. a11y — controls expose role + label + state ───────────────

describe('AdminSemanticRefereeTab — accessibility', () => {
  it('mode rows expose role + label + selected/disabled state', () => {
    expect(TAB_SRC).toMatch(/accessibilityRole="button"/);
    expect(TAB_SRC).toMatch(/accessibilityState=\{\{ selected: active, disabled: saving \}\}/);
  });

  it('interactive controls meet the 44x44 hit target via hitSlop', () => {
    expect(TAB_SRC).toMatch(/hitSlop=\{\{/);
  });
});

// ── 8. Doctrine — secrets + no console.log ───────────────────────

describe('AdminSemanticRefereeTab — doctrine: no secrets, no console', () => {
  it('does not log Authorization headers or reference service-role keys', () => {
    expect(TAB_SRC).not.toMatch(/console\.(log|error|warn)/);
    expect(TAB_SRC).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(TAB_SRC).not.toMatch(/service_role/);
    expect(TAB_SRC).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(TAB_SRC).not.toMatch(/createClient\(/);
  });
});

// ── 9. Registry wiring ───────────────────────────────────────────

describe('AdminScreen / types — semantic_referee tab registry', () => {
  it('the AdminTab union includes semantic_referee', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/types.ts'), 'utf8');
    expect(src).toContain("'semantic_referee'");
    expect(src).toMatch(/semantic_referee\s*:\s*['"]Semantic Referee['"]/);
  });

  it('AdminScreen registers the tab and renders AdminSemanticRefereeTab', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminScreen.tsx'), 'utf8');
    expect(src).toContain("'semantic_referee'");
    expect(src).toContain('AdminSemanticRefereeTab');
    expect(src).toMatch(/tab === 'semantic_referee' && <AdminSemanticRefereeTab \/>/);
  });
});
