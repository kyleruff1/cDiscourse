/**
 * MCP-021C-EDGE — Test: no client code makes a fetch to the MCP server.
 *
 * Per cdiscourse-doctrine §7: production app (src/ + app/) MUST NOT
 * call Anthropic / xAI / X API / any AI provider, including the
 * operator-hosted MCP server.
 *
 * The MCP server is reached ONLY from the Edge Function at
 * supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts
 * (verified by mcpOneTwoOneCEdgeAdapterSourceScan.test.ts).
 *
 * This test extends the boundary scan by checking that no client file
 * imports any module from the Deno-only boolean observations tree.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();

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

const ALL_CLIENT_FILES = [
  ...collectSourceFiles(path.join(REPO, 'src')),
  ...collectSourceFiles(path.join(REPO, 'app')),
];

describe('MCP-021C-EDGE — boundary: no client import from booleanObservations tree', () => {
  it('SEC-7 — no client file imports booleanObservationMcpAdapter', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('booleanObservationMcpAdapter'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-8 — no client file imports booleanObservationMcpAdapterCore', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('booleanObservationMcpAdapterCore'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-9 — no client file imports persistenceWriter from the boolean observations tree', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*supabase\/functions\/_shared\/booleanObservations\/persistenceWriter/.test(
        content,
      );
    });
    expect(offenders).toEqual([]);
  });

  it('SEC-10 — no client file imports ANY module under supabase/functions/_shared/booleanObservations/', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*supabase\/functions\/_shared\/booleanObservations/.test(content);
    });
    expect(offenders).toEqual([]);
  });

  it('SEC-11 — no client file imports the Edge Function index directly', () => {
    const offenders = ALL_CLIENT_FILES.filter((f) => {
      const content = fs.readFileSync(f, 'utf8');
      return /from\s+['"][^'"]*supabase\/functions\/classify-argument-boolean-observations/.test(
        content,
      );
    });
    expect(offenders).toEqual([]);
  });
});

describe('MCP-021C-EDGE — boundary: no client fetch to classify-argument-boolean-observations', () => {
  it('SEC-12 — no client file references the MCP tool name `classify_argument_boolean_observations`', () => {
    // The tool name should only appear in the Deno-only adapter and
    // the Edge Function handler. Client code must not know it.
    const offenders = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('classify_argument_boolean_observations'),
    );
    expect(offenders).toEqual([]);
  });

  it('SEC-13 — client may reference the Edge Function name (functions.invoke is allowed; no current usage)', () => {
    // The Edge Function NAME (`classify-argument-boolean-observations`)
    // is allowed in client code via supabase.functions.invoke(). At
    // MCP-021C-EDGE ship, no client wrapper invokes the function yet
    // (admin-trigger-only); we record the current state.
    const refs = ALL_CLIENT_FILES.filter((f) =>
      fs.readFileSync(f, 'utf8').includes('classify-argument-boolean-observations'),
    );
    // At ship time, zero. A future ADMIN-ARGUMENTS card may add a
    // wrapper — at which point this test re-baselines.
    expect(refs).toEqual([]);
  });
});
