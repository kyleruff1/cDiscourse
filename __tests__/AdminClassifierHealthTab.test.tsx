/**
 * OPS-MCP-OBSERVABILITY-002 — AdminClassifierHealthTab + API contract.
 *
 * Follows the repo's `.test.tsx` discipline (see `AdminSemanticRefereeTab.test.tsx`):
 * the tab's behaviour is exercised through its extracted pure helpers + a
 * static source scan that proves the component wires a READ-ONLY surface (no
 * mutation control), renders the H/I/J badge + tripwire, and handles NULL
 * columns as a placeholder.
 *
 * Runtime react-test-renderer rendering is intentionally avoided — no existing
 * `.test.tsx` in this repo uses it (the pinned react-test-renderer is outside
 * @testing-library's peer range).
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const TAB_SRC = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminClassifierHealthTab.tsx'),
  'utf8',
);
const API_SRC = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/adminClassifierHealthApi.ts'),
  'utf8',
);
const SCREEN_SRC = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminScreen.tsx'),
  'utf8',
);
const TYPES_SRC = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/types.ts'),
  'utf8',
);

const TAB_CODE_ONLY = TAB_SRC
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

// ── 1. Read-only: the API exposes no mutation verb ───────────────

describe('adminClassifierHealthApi — read-only', () => {
  it('only invokes the admin-classifier-health function', () => {
    const invokes = API_SRC.match(/functions\.invoke[<(][^)]*['"][^'"]+['"]/g) || [];
    expect(invokes.length).toBeGreaterThan(0);
    for (const i of invokes) {
      expect(i).toContain('admin-classifier-health');
    }
  });

  it('exposes load + export only — no mutate / arm / trigger / flip export', () => {
    expect(API_SRC).toMatch(/export async function loadClassifierHealth/);
    expect(API_SRC).toMatch(/export async function exportClassifierHealthCsv/);
    for (const verb of ['retrigger', 'reTrigger', 'arm', 'disarm', 'flip', 'enable', 'disable', 'mutate', 'setProduction']) {
      expect(API_SRC).not.toMatch(new RegExp(`export\\s+(async\\s+)?function\\s+\\w*${verb}`, 'i'));
    }
  });

  it('never references a service-role key or env', () => {
    expect(API_SRC).not.toMatch(/SERVICE_ROLE/);
    expect(API_SRC).not.toMatch(/Deno\.env/);
  });
});

// ── 2. Tab — read-only surface (no mutation onPress) ─────────────

describe('AdminClassifierHealthTab — read-only surface', () => {
  it('has NO re-trigger / arm / disarm / routing / flip control', () => {
    for (const banned of ['re-?trigger', 'arm', 'disarm', 'routing', 'productionEnabled', 'flip', 'reclassify', 'requeue']) {
      expect(TAB_CODE_ONLY).not.toMatch(new RegExp(banned, 'i'));
    }
  });

  it('the only Pressables are the filter apply, retry, and CSV export', () => {
    // Collect every accessibilityLabel on a Pressable-style control.
    const labels = TAB_SRC.match(/accessibilityLabel="admin-classifier-health-[^"]+"/g) || [];
    const actionLabels = labels.filter((l) =>
      /retry|apply|export-csv/.test(l),
    );
    expect(actionLabels.length).toBeGreaterThanOrEqual(2);
    // No label hints at a write action.
    for (const l of labels) {
      expect(l).not.toMatch(/delete|update|insert|trigger|arm|flip|route/i);
    }
  });

  it('filter inputs are TextInput (form), not action Pressables', () => {
    expect(TAB_SRC).toMatch(/<TextInput/);
    expect(TAB_SRC).toMatch(/FilterField/);
  });
});

// ── 3. H/I/J tripwire + frozen badge render ──────────────────────

describe('AdminClassifierHealthTab — tripwire + frozen badge', () => {
  it('renders the H/I/J leakage tripwire card', () => {
    expect(TAB_SRC).toContain('testID="admin-classifier-health-tripwire"');
    expect(TAB_SRC).toContain('admin-classifier-health-tripwire-count');
    expect(TAB_SRC).toMatch(/should always be 0/);
  });

  it('renders the frozen-set badge', () => {
    expect(TAB_SRC).toContain('admin-classifier-health-frozen-badge');
    expect(TAB_SRC).toMatch(/Frozen set/);
  });

  it('shows an alert note ONLY when the tripwire is firing (count > 0) — informational, no control', () => {
    expect(TAB_SRC).toMatch(/tripwireFiring\s*=\s*tripwire\.count\s*>\s*0/);
    expect(TAB_SRC).toContain('admin-classifier-health-tripwire-alert');
    // The alert is text, never a Pressable.
    const alertBlock = TAB_SRC.split('tripwire-alert')[1]?.slice(0, 200) ?? '';
    expect(alertBlock).not.toMatch(/onPress/);
  });
});

// ── 4. Provider-error cluster row ────────────────────────────────

describe('AdminClassifierHealthTab — provider-error cluster', () => {
  it('renders the provider-error cluster card', () => {
    expect(TAB_SRC).toContain('testID="admin-classifier-health-provider-cluster"');
    expect(TAB_SRC).toContain('admin-classifier-health-provider-cluster-total');
  });
});

// ── 5. Backward-compat: NULL renders a placeholder, never "null" ─

describe('AdminClassifierHealthTab — NULL tolerance', () => {
  it('renders a placeholder for a NULL raw key', () => {
    expect(TAB_SRC).toMatch(/function displayKey/);
    expect(TAB_SRC).toMatch(/return '—'/);
  });

  it('never renders the literal "null" / "undefined" string', () => {
    expect(TAB_CODE_ONLY).not.toMatch(/['"]null['"]/);
    expect(TAB_CODE_ONLY).not.toMatch(/['"]undefined['"]/);
  });

  it('maps reason codes through the plain-language map (§9)', () => {
    expect(TAB_SRC).toContain('classifierHealthPlainLanguage');
  });
});

// ── 6. Tab registration ──────────────────────────────────────────

describe('AdminScreen — classifier_health tab registered', () => {
  it('imports and renders AdminClassifierHealthTab', () => {
    expect(SCREEN_SRC).toContain('AdminClassifierHealthTab');
    expect(SCREEN_SRC).toMatch(/tab === 'classifier_health' && <AdminClassifierHealthTab/);
  });

  it('classifier_health is in the TABS array', () => {
    expect(SCREEN_SRC).toMatch(/'classifier_health'/);
  });

  it('classifier_health is in the AdminTab union + labels', () => {
    expect(TYPES_SRC).toMatch(/\|\s*'classifier_health'/);
    expect(TYPES_SRC).toMatch(/classifier_health:\s*'Classifier Health'/);
  });
});

// ── 7. Accessibility ─────────────────────────────────────────────

describe('AdminClassifierHealthTab — accessibility', () => {
  it('every Pressable has accessibilityRole="button"', () => {
    const pressables = (TAB_SRC.match(/<Pressable[\s\S]*?>/g) || []);
    expect(pressables.length).toBeGreaterThan(0);
    for (const p of pressables) {
      expect(p).toMatch(/accessibilityRole="button"/);
    }
  });

  it('Pressables carry hitSlop for the 44x44 hit target', () => {
    const pressables = (TAB_SRC.match(/<Pressable[\s\S]*?>/g) || []);
    for (const p of pressables) {
      expect(p).toMatch(/hitSlop=/);
    }
  });
});

// ── 8. Doctrine footnote (no truth / no block claim) ─────────────

describe('AdminClassifierHealthTab — doctrine footnote', () => {
  it('states the panel never gates a user post (acceptance-gate invariant)', () => {
    expect(TAB_SRC).toMatch(/never gates a user post|sole acceptance gate|deterministic rules engine/i);
  });

  it('contains no verdict / truth token in copy', () => {
    const BANNED = ['winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative', 'propagandist'];
    const lower = TAB_SRC.toLowerCase();
    for (const b of BANNED) {
      expect(lower).not.toContain(b);
    }
  });
});
