/**
 * PROOF-001 (#888) — back-fill runner core: dry-run report shape (no network),
 * fail-closed apply gate, real-classifier proof, and a no-secret source scan.
 *
 * The runner's I/O (Supabase read/write, fs) lives in the thin CLI
 * (backfillProofItems.ts). This suite exercises the PURE engine
 * (backfillProofItemsCore.ts) — the contract that never writes — plus a
 * fs.readFileSync scan over both source files for secret leaks / write paths.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  buildBackfillReport,
  classifyArgumentRow,
  parseArgs,
  renderAllInsertSql,
  resolveApplyGate,
  DEMO_ARGUMENT_ROWS,
  type AttachedEvidenceArgumentRow,
} from '../scripts/proof-backfill/backfillProofItemsCore';
import {
  proofItemRowFromArtifact,
} from '../scripts/proof-backfill/proofItemRowFromArtifact';
import { buildEvidenceArtifacts } from '../src/features/evidence/evidenceModel';
import { renderInsertSql } from '../scripts/proof-backfill/backfillProofItemsCore';

const SCRIPTS_DIR = join(__dirname, '..', 'scripts', 'proof-backfill');
const CLI_PATH = join(SCRIPTS_DIR, 'backfillProofItems.ts');
const CORE_PATH = join(SCRIPTS_DIR, 'backfillProofItemsCore.ts');
const FOLD_PATH = join(SCRIPTS_DIR, 'proofItemRowFromArtifact.ts');

// ── dry-run report shape on fixture input (no network) ────────

describe('PROOF-001 runner — dry-run report shape (built-in fixture, no network)', () => {
  const report = buildBackfillReport(DEMO_ARGUMENT_ROWS);

  it('scans every row, counts artifacts, and skips the malformed row', () => {
    expect(report.argumentsScanned).toBe(3);
    expect(report.argumentsWithArtifacts).toBe(2);
    expect(report.argumentsSkippedMalformed).toBe(1);
  });

  it('reports rows-to-write and the payment_screenshot deferral separately', () => {
    expect(report.proofItemRowsToWrite).toBe(5);
    expect(report.paymentScreenshotDeferred).toBe(1);
  });

  it('performs ZERO writes in the report path', () => {
    expect(report.writesPerformed).toBe(0);
  });

  it('has the required breakdown sections + a redacted sample INSERT', () => {
    expect(Object.keys(report.bySourceKind).length).toBeGreaterThan(0);
    expect(Object.keys(report.byFoldedKind).length).toBeGreaterThan(0);
    expect(Object.keys(report.bySourceChainStatus).length).toBeGreaterThan(0);
    expect(report.sampleInserts.length).toBeGreaterThan(0);
    expect(report.sampleInserts.length).toBeLessThanOrEqual(5);
    expect(report.sampleInserts[0]).toContain('insert into public.proof_items');
  });

  it('the folded-kind breakdown never contains a deferred or unshipped kind', () => {
    expect(report.byFoldedKind).not.toHaveProperty('payment_screenshot');
    expect(report.byFoldedKind).not.toHaveProperty('screenshot');
    expect(report.byFoldedKind).not.toHaveProperty('dataset');
  });

  it('an empty input yields an all-zero report with zero writes', () => {
    const empty = buildBackfillReport([]);
    expect(empty.argumentsScanned).toBe(0);
    expect(empty.proofItemRowsToWrite).toBe(0);
    expect(empty.writesPerformed).toBe(0);
    expect(empty.sampleInserts).toEqual([]);
  });
});

// ── fail-closed apply gate ────────────────────────────────────

describe('PROOF-001 runner — fail-closed apply gate', () => {
  it('defaults to dry-run when --apply is absent', () => {
    expect(resolveApplyGate({ apply: false }, {}).apply).toBe(false);
    expect(resolveApplyGate({ apply: false }, { PROOF_BACKFILL_APPLY: 'true' }).apply).toBe(false);
  });

  it('stays dry-run when --apply is present but the env flag is missing/wrong', () => {
    expect(resolveApplyGate({ apply: true }, {}).apply).toBe(false);
    expect(resolveApplyGate({ apply: true }, { PROOF_BACKFILL_APPLY: 'false' }).apply).toBe(false);
    expect(resolveApplyGate({ apply: true }, { PROOF_BACKFILL_APPLY: '1' }).apply).toBe(false);
    expect(resolveApplyGate({ apply: true }, { PROOF_BACKFILL_APPLY: 'TRUE' }).apply).toBe(false);
  });

  it('opens ONLY when BOTH --apply AND PROOF_BACKFILL_APPLY=true are present', () => {
    const decision = resolveApplyGate({ apply: true }, { PROOF_BACKFILL_APPLY: 'true' });
    expect(decision.apply).toBe(true);
    expect(decision.reason).toContain('live apply');
  });

  it('parseArgs recognises --apply and --demo', () => {
    expect(parseArgs([])).toEqual({ apply: false, demo: false });
    expect(parseArgs(['--apply'])).toEqual({ apply: true, demo: false });
    expect(parseArgs(['--demo'])).toEqual({ apply: false, demo: true });
    expect(parseArgs(['--apply', '--demo'])).toEqual({ apply: true, demo: true });
  });
});

// ── uses the REAL buildEvidenceArtifacts (behavioural proof) ──

describe('PROOF-001 runner — classifies via the real buildEvidenceArtifacts', () => {
  it('a url attachment classifies as kind url / status source_no_quote', () => {
    const row: AttachedEvidenceArgumentRow = {
      id: 'a1',
      debate_id: 'd1',
      author_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      attachedEvidence: [{ url: 'https://example.org/x' }],
    };
    const c = classifyArgumentRow(row);
    expect(c.malformed).toBe(false);
    expect(c.artifacts).toHaveLength(1);
    expect(c.artifacts[0].kind).toBe('url');
    expect(c.artifacts[0].sourceChainStatus).toBe('source_no_quote');
    expect(c.rows).toHaveLength(1);
    expect(c.rows[0].kind).toBe('url');
    // Parity with the classifier's own semantics on the same input.
    const direct = buildEvidenceArtifacts({
      argumentId: 'a1',
      addedByUserId: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      attachments: [{ url: 'https://example.org/x' }],
    });
    expect(c.artifacts).toEqual(direct);
  });

  it('a malformed (non-array) attachedEvidence is skipped, never thrown on', () => {
    const row: AttachedEvidenceArgumentRow = {
      id: 'a2',
      debate_id: 'd1',
      author_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      attachedEvidence: { not: 'an array' },
    };
    expect(() => classifyArgumentRow(row)).not.toThrow();
    const c = classifyArgumentRow(row);
    expect(c.malformed).toBe(true);
    expect(c.rows).toEqual([]);
  });
});

// ── emitted SQL escaping ──────────────────────────────────────

describe('PROOF-001 runner — emitted INSERT SQL', () => {
  it('escapes a single quote in user content by doubling it', () => {
    const [artifact] = buildEvidenceArtifacts({
      argumentId: 'a3',
      addedByUserId: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      attachments: [{ url: 'https://example.org/x', label: "O'Brien's source" }],
    });
    const row = proofItemRowFromArtifact(artifact, { debateId: 'd1' });
    expect(row).not.toBeNull();
    const sql = renderInsertSql(row!);
    expect(sql).toContain("O''Brien''s source");
    expect(sql).not.toContain("'O'Brien'"); // no unescaped apostrophe run
  });

  it('renderAllInsertSql over the fixture emits exactly the rows-to-write count', () => {
    const sql = renderAllInsertSql(DEMO_ARGUMENT_ROWS);
    const inserts = sql.split('\n').filter((l) => l.startsWith('insert into public.proof_items'));
    expect(inserts).toHaveLength(5);
  });
});

// ── no-secret / no-write source scan ──────────────────────────

describe('PROOF-001 runner — source safety scan', () => {
  const cli = readFileSync(CLI_PATH, 'utf8');
  const core = readFileSync(CORE_PATH, 'utf8');
  const fold = readFileSync(FOLD_PATH, 'utf8');

  it('the pure core + fold contain no Supabase client, no write, no console', () => {
    for (const src of [core, fold]) {
      expect(src).not.toMatch(/@supabase\/supabase-js/);
      expect(src).not.toMatch(/createClient/);
      expect(src).not.toMatch(/\.insert\(/);
      // Actual console METHOD calls (a doc-comment mention of the word is fine).
      expect(src).not.toMatch(/console\.(log|error|warn|info|debug|trace)/);
    }
  });

  it('the core imports the REAL buildEvidenceArtifacts (not a re-implementation)', () => {
    expect(core).toMatch(/from '\.\.\/\.\.\/src\/features\/evidence\/evidenceModel'/);
    expect(core).toMatch(/buildEvidenceArtifacts/);
  });

  it('no source file embeds a secret-shaped literal', () => {
    const SECRET_SHAPES = [/sk-ant-/, /sb_secret_/, /xai-[A-Za-z0-9]/, /eyJ[A-Za-z0-9_-]{10}/, /Bearer\s+[A-Za-z0-9]/];
    for (const src of [cli, core, fold]) {
      for (const re of SECRET_SHAPES) {
        expect(src).not.toMatch(re);
      }
    }
  });

  it('the CLI references service-role ONLY as the env NAME, never logging its value', () => {
    // The only occurrences are the env-var NAME read.
    expect(cli).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    // No console line interpolates the key variable or the env name.
    for (const line of cli.split('\n')) {
      if (/console\./.test(line)) {
        expect(line).not.toMatch(/serviceRoleKey/);
        expect(line).not.toMatch(/SERVICE_ROLE/);
      }
    }
  });

  it('the CLI is fail-closed: --demo path is guarded and dry-run is the default', () => {
    expect(cli).toMatch(/args\.demo/);
    expect(cli).toMatch(/resolveApplyGate/);
  });
});
