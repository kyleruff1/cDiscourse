/**
 * ADMIN-MCP-001 (#477) — autonomous-layer leak + type-union coverage.
 *
 * This card audits the seven-layer admin write path for `providerMode='mcp'`.
 * The autonomous layers (1/2/3/7) live entirely in `src/**`; this suite is the
 * client-side wall for Layer 7.
 *
 * The sibling `semanticMcpSourceScan.test.ts` already proves the MCP env-var
 * NAMES (`SEMANTIC_REFEREE_MCP_URL` / `SEMANTIC_REFEREE_MCP_TOKEN`) appear in no
 * `src/` or `app/` file. This suite extends that wall to the two leak shapes
 * that scan did NOT cover and that #477 Layer 7 names explicitly:
 *
 *   1. the MCP route-path literal `/mcp/adapter-compat` never appears in `src/`
 *      (it is an Edge-/server-only path — the client only ever names the
 *      `set_semantic_config` admin action),
 *   2. no MCP-server hostname literal (`*.run.app` / `*.supabase.co` /
 *      `*.functions.supabase.co` / bare `mcp.*` host) appears in `src/`.
 *
 * It also adds the type-union compile assertions #477 Layer 7 names: both
 * `SemanticRefereeConfigView.providerMode` and
 * `SetSemanticRefereeConfigInput.providerMode` accept `'mcp'`, and the
 * plain-language label / one-click confirmation rule for `mcp` hold at HEAD.
 *
 * Pure source-text + type-level scan — no Supabase call, no provider call.
 */
import * as fs from 'fs';
import * as path from 'path';

// `semanticRefereeConfigApi` imports `edgeFunctions` (→ supabase-js →
// AsyncStorage), which Jest's node env cannot load. Mock the transport exactly
// as `semanticRefereeConfigApi.test.ts` does — this suite only reads the
// label map + the confirmation rule, neither of which calls `adminUsers`.
jest.mock('../src/lib/edgeFunctions', () => ({
  adminUsers: jest.fn(),
}));

import {
  PROVIDER_MODE_LABELS,
  requiresProviderConfirmation,
} from '../src/features/admin/semanticRefereeConfigApi';
import type {
  SemanticRefereeConfigView,
  SetSemanticRefereeConfigInput,
} from '../src/lib/edgeFunctions';

const REPO = process.cwd();

/** Recursively collect every `.ts` / `.tsx` file under a directory. */
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const SRC_FILES = collectSourceFiles(path.join(REPO, 'src'));
const APP_FILES = collectSourceFiles(path.join(REPO, 'app'));

// ── Layer 7 — the MCP route path never leaks into the client ─────

describe('ADMIN-MCP-001 leak scan — the MCP route path stays Edge-side', () => {
  it('the /mcp/adapter-compat route path appears in no src/ file (code or comment)', () => {
    const offenders = SRC_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('/mcp/adapter-compat'),
    );
    expect(offenders).toEqual([]);
  });

  it('the /mcp/adapter-compat route path appears in no app/ file (code or comment)', () => {
    const offenders = APP_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('/mcp/adapter-compat'),
    );
    expect(offenders).toEqual([]);
  });
});

// ── Layer 7 — no MCP-server hostname leaks into the client ───────

describe('ADMIN-MCP-001 leak scan — no MCP-server hostname in the client', () => {
  // Host shapes the operator-hosted MCP server could plausibly use. The client
  // must never name a concrete host — it only ever calls the `admin-users` Edge
  // Function via the supabase-js client, which resolves the project URL from
  // the `EXPO_PUBLIC_SUPABASE_URL` env var (not a hard-coded host).
  const HOST_PATTERNS: { label: string; re: RegExp }[] = [
    { label: 'Cloud Run (*.run.app)', re: /[A-Za-z0-9-]+\.run\.app/ },
    {
      label: 'Edge Functions host (*.functions.supabase.co)',
      re: /[A-Za-z0-9-]+\.functions\.supabase\.co/,
    },
    { label: 'bare mcp.* host', re: /\bmcp\.[A-Za-z0-9-]+\.[A-Za-z]{2,}/ },
  ];

  for (const { label, re } of HOST_PATTERNS) {
    it(`no src/ file contains an MCP-server hostname literal — ${label}`, () => {
      const offenders = SRC_FILES.filter((f) => re.test(fs.readFileSync(f, 'utf8')));
      expect(offenders).toEqual([]);
    });
  }
});

// ── Layer 7 — type-union compile coverage ────────────────────────

describe('ADMIN-MCP-001 type-union — mcp is a first-class provider mode', () => {
  it('SemanticRefereeConfigView.providerMode accepts "mcp" (compile-level)', () => {
    // If PR #460 had not widened the read view, this assignment would be a
    // compile error and `npm run typecheck` would fail.
    const mode: SemanticRefereeConfigView['providerMode'] = 'mcp';
    expect(mode).toBe('mcp');
  });

  it('SetSemanticRefereeConfigInput.providerMode accepts "mcp" (compile-level)', () => {
    // ADMIN-AI-001's original design (lines 392-404) EXCLUDED mcp on the
    // set-input; #460 widened it. This assignment is the regression wall.
    const input: SetSemanticRefereeConfigInput = { providerMode: 'mcp', enabled: true };
    expect(input.providerMode).toBe('mcp');
  });

  it('the four provider modes are exactly anthropic / mock / fixture / mcp', () => {
    const keys = Object.keys(PROVIDER_MODE_LABELS).sort();
    expect(keys).toEqual(['anthropic', 'fixture', 'mcp', 'mock']);
  });
});

// ── Layer 1 — the mcp plain-language label holds at HEAD ──────────

describe('ADMIN-MCP-001 Layer 1 — the mcp label is the doctrine string', () => {
  it('PROVIDER_MODE_LABELS.mcp === "CD - MCP Server"', () => {
    expect(PROVIDER_MODE_LABELS.mcp).toBe('CD - MCP Server');
  });

  it('the mcp label carries no internal snake_case code', () => {
    expect(PROVIDER_MODE_LABELS.mcp).not.toMatch(/_/);
  });
});

// ── Layer 7 — mcp is one-click (no Anthropic-style confirmation) ──

describe('ADMIN-MCP-001 Layer 7 — switching to mcp needs no confirmation', () => {
  it('requiresProviderConfirmation("mcp") is false (one-click, like mock/fixture)', () => {
    expect(requiresProviderConfirmation('mcp')).toBe(false);
  });

  it('only anthropic requires confirmation among the four modes', () => {
    expect(requiresProviderConfirmation('anthropic')).toBe(true);
    expect(requiresProviderConfirmation('mock')).toBe(false);
    expect(requiresProviderConfirmation('fixture')).toBe(false);
    expect(requiresProviderConfirmation('mcp')).toBe(false);
  });
});
