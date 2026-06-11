/**
 * OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — admin_validation caller
 * patience corrected from 15s -> 30s.
 *
 * The admin-gated `classify-argument-boolean-observations` Edge HTTP handler
 * defaulted its MCP-server fetch abort to the 15s submit-path constant
 * (`MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS`), which is TIGHTER than the
 * MCP server's own 25s model budget — an inverted hierarchy that killed valid
 * 16-25s slow calls (the Family-J E3 finding,
 * `docs/audits/MCP-SERVER-011-FAMILY-J-SMOKE-2026-06-11.md` Phase 4b). This
 * mirrors the ARCH-001 Card 2 drainer correction (the DRAINER already passes
 * `DRAINER_MCP_REQUEST_TIMEOUT_MS = 30s`).
 *
 * Coverage:
 *   (a) the admin_validation path passes 30000 to the adapter options;
 *   (b) the constant >= the 25s server budget (the hierarchy assertion);
 *   (c) the direct/auto-trigger path still omits options (15s default
 *       preserved — byte-unchanged behavior).
 *
 * The constants are bridged behaviourally through the Jest bridge
 * (`_helpers/booleanObservationEdgeDeno`); the Deno-only adapter, the admin
 * Edge handler, and the auto-trigger dispatcher read `Deno.env`/`fetch` so
 * their wiring is locked by source-scan (the repo's established convention —
 * see `archOneCardTwoDrainerCore.test.ts` DC-26 and
 * `mcpOneTwoOneCAutoTriggerFamilyA.test.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  EDGE_ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS,
  EDGE_DRAINER_MCP_REQUEST_TIMEOUT_MS,
  EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS,
} from './_helpers/booleanObservationEdgeDeno';

/**
 * The MCP server's own per-model-call budget. Source of truth:
 * `mcp-server/lib/anthropicCall.ts:32` (`DEFAULT_MODEL_TIMEOUT_MS = 25_000`),
 * read at runtime via `MCP_SERVER_MODEL_TIMEOUT_MS` (`readEnvTimeoutMs()`,
 * `:97-103`, default 25_000). The `mcp-server/` tree is Deno-only and excluded
 * from the Jest project, so the value is pinned here as a named reference for
 * the hierarchy assertion (the design doc records the same file:line).
 */
const SERVER_MODEL_TIMEOUT_MS = 25_000;

const REPO = process.cwd();
const ADMIN_HANDLER_PATH = path.join(
  REPO,
  'supabase/functions/classify-argument-boolean-observations/index.ts',
);
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const DRAINER_CLASSIFY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerClassify.ts',
);
const ADAPTER_CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts',
);

let adminHandlerText = '';
let dispatcherText = '';
let drainerClassifyText = '';
let adapterCoreText = '';

beforeAll(() => {
  adminHandlerText = fs.readFileSync(ADMIN_HANDLER_PATH, 'utf8');
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  drainerClassifyText = fs.readFileSync(DRAINER_CLASSIFY_PATH, 'utf8');
  adapterCoreText = fs.readFileSync(ADAPTER_CORE_PATH, 'utf8');
});

describe('OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — constant + hierarchy', () => {
  it('AVTH-1 — ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS is 30_000', () => {
    expect(EDGE_ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it('AVTH-2 — caller patience EXCEEDS the 25s server model budget (hierarchy rule)', () => {
    // The whole point of the fix: caller patience must be > callee work budget.
    expect(EDGE_ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS).toBeGreaterThan(
      SERVER_MODEL_TIMEOUT_MS,
    );
    // >= 25s budget + 5s headroom (the drainer precedent's margin).
    expect(EDGE_ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(
      SERVER_MODEL_TIMEOUT_MS + 5_000,
    );
  });

  it('AVTH-3 — admin patience matches the ARCH-001 drainer precedent (both 30s)', () => {
    expect(EDGE_ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS).toBe(
      EDGE_DRAINER_MCP_REQUEST_TIMEOUT_MS,
    );
    expect(EDGE_DRAINER_MCP_REQUEST_TIMEOUT_MS).toBeGreaterThan(
      SERVER_MODEL_TIMEOUT_MS,
    );
  });

  it('AVTH-4 — the 15s submit/auto-trigger default is UNCHANGED (still tighter than the server budget)', () => {
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS).toBe(15_000);
    // The default stays TIGHTER than the server budget BY DESIGN — the submit
    // hot path stays fast-fail; only the operator-driven paths are patient.
    expect(EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS).toBeLessThan(
      SERVER_MODEL_TIMEOUT_MS,
    );
  });

  it('AVTH-5 — adapter-core declares the new constant as 30_000', () => {
    expect(adapterCoreText).toMatch(
      /export const ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS\s*=\s*30_000/,
    );
  });
});

describe('OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — admin path passes 30s', () => {
  it('AVTH-6 — admin handler imports the constant from the adapter core', () => {
    expect(
      /import\s+\{[\s\S]*?ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS[\s\S]*?\}\s+from\s+['"]\.\.\/_shared\/booleanObservations\/booleanObservationMcpAdapterCore\.ts['"]/.test(
        adminHandlerText,
      ),
    ).toBe(true);
  });

  it('AVTH-7 — admin_validation calls pass { timeoutMs: ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS } to the adapter', () => {
    expect(
      /runBooleanObservationMcpAdapter\(\s*request,\s*\{\s*timeoutMs:\s*ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS/.test(
        adminHandlerText,
      ),
    ).toBe(true);
  });

  it('AVTH-8 — the 30s wrap is GATED on body.mode === admin_validation', () => {
    expect(/body\.mode\s*===\s*['"]admin_validation['"]/.test(adminHandlerText)).toBe(
      true,
    );
  });

  it('AVTH-9 — the handler still injects classifyOneArgumentCore (wrapped as classifyOneArgument)', () => {
    expect(/const\s+classifyOneArgument\s*=\s*classifyOneArgumentCore/.test(adminHandlerText)).toBe(
      true,
    );
  });
});

describe('OPS-MCP-ADMIN-VALIDATION-TIMEOUT-HIERARCHY — invariants preserved', () => {
  it('AVTH-10 — auto-trigger dispatcher passes the BARE 1-arg adapter (no timeoutMs / no 30s constant)', () => {
    // The submit-path direct-dispatch caller injects
    // runBooleanObservationMcpAdapter by reference and NEVER passes an
    // options/timeoutMs arg -> it keeps the 15s default. Byte-unchanged.
    expect(dispatcherText).toContain('runBooleanObservationMcpAdapter');
    expect(dispatcherText).not.toContain('timeoutMs');
    expect(dispatcherText).not.toContain('ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS');
  });

  it('AVTH-11 — the drainer path is untouched (still passes DRAINER_MCP_REQUEST_TIMEOUT_MS, not the admin constant)', () => {
    expect(drainerClassifyText).toMatch(/timeoutMs:\s*DRAINER_MCP_REQUEST_TIMEOUT_MS/);
    expect(drainerClassifyText).not.toContain('ADMIN_VALIDATION_MCP_REQUEST_TIMEOUT_MS');
  });

  it('AVTH-12 — the 15s default + drainer 30s constant declarations are unchanged in adapter-core', () => {
    expect(adapterCoreText).toMatch(
      /export const MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS\s*=\s*15_000/,
    );
    expect(adapterCoreText).toMatch(
      /export const DRAINER_MCP_REQUEST_TIMEOUT_MS\s*=\s*30_000/,
    );
  });
});
