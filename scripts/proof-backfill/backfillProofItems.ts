/**
 * PROOF-001 (#888) — back-fill CLI (operator-gated).
 *
 * Classifies arguments.client_validation->'attachedEvidence' via the REAL
 * `buildEvidenceArtifacts` (through backfillProofItemsCore) and folds each
 * artifact to a proof_items row via the SHARED fold. DRY-RUN IS THE DEFAULT and
 * fail-closed: a live write requires BOTH `--apply` on the CLI AND
 * `PROOF_BACKFILL_APPLY=true` in the environment.
 *
 * Run modes:
 *   --demo    built-in synthetic sample, NO network, NO env, NO secret. Prints
 *             the report shape to stdout. (self-demonstration + evidence lane.)
 *   (default) live dry-run: reads the linked DB (service-role), classifies,
 *             writes a report + reviewed SQL to out/proof-backfill/, writes NOTHING
 *             to the DB.
 *   --apply   (with PROOF_BACKFILL_APPLY=true) live apply: inserts the classified
 *             proof_items rows via the service-role client. Operator-gated.
 *
 * Doctrine guards:
 *   - No AI call (deterministic buildEvidenceArtifacts only). No Anthropic/xAI/X.
 *   - Service-role is referenced ONLY as the env NAME SUPABASE_SERVICE_ROLE_KEY,
 *     read at runtime for the live lane; its VALUE is never logged, never
 *     written to any output, never committed. scripts/ is outside the app/ src/
 *     secret-grep boundary.
 *   - Emitted SQL + report go to the gitignored out/proof-backfill/ tree.
 *   - The pure classification/fold/report engine lives in backfillProofItemsCore.ts
 *     (no Supabase, no console) and is the jest-proven contract.
 *
 * Build + run (operator): this .ts is compiled to the gitignored
 * artifacts/proof-backfill-build/ tree by tsconfig.proof-backfill.json (the
 * `proof:backfill:*` npm scripts) and run under bare `node` — the imported
 * closure (evidenceModel + the fold + @supabase/supabase-js) is network-free
 * except the explicit live read/write. Requires Node 22.6+.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  buildBackfillReport,
  classifyArgumentRow,
  parseArgs,
  renderAllInsertSql,
  renderReportMarkdown,
  resolveApplyGate,
  DEMO_ARGUMENT_ROWS,
  type AttachedEvidenceArgumentRow,
} from './backfillProofItemsCore';

const TAG = '[proof-backfill]';

function nowLabel(): string {
  return new Date().toISOString();
}

function ensureOutDir(): string {
  const dir = path.join(process.cwd(), 'out', 'proof-backfill');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function readArgumentRows(client: SupabaseClient): Promise<AttachedEvidenceArgumentRow[]> {
  const { data, error } = await client
    .from('arguments')
    .select('id, debate_id, author_id, created_at, client_validation')
    .not('client_validation', 'is', null);
  if (error) throw new Error(`arguments read failed: ${error.message}`);
  const raw = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const rows: AttachedEvidenceArgumentRow[] = [];
  for (const r of raw) {
    const cv = r.client_validation;
    if (cv === null || typeof cv !== 'object') continue;
    const attachedEvidence = (cv as Record<string, unknown>).attachedEvidence;
    if (attachedEvidence === undefined) continue;
    rows.push({
      id: String(r.id),
      debate_id: String(r.debate_id),
      author_id: String(r.author_id),
      created_at: String(r.created_at),
      attachedEvidence,
    });
  }
  return rows;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  // ── --demo: self-demonstration, no network, no env, no secret ──
  if (args.demo) {
    const report = buildBackfillReport(DEMO_ARGUMENT_ROWS);
    console.log(
      renderReportMarkdown(report, {
        mode: '--demo (built-in synthetic sample, no network)',
        generatedAtLabel: nowLabel(),
      }),
    );
    console.log(
      `${TAG} DEMO complete. writesPerformed=${report.writesPerformed}. No network, no DB, no secret.`,
    );
    return 0;
  }

  // ── live lane: fail-closed apply gate ──
  const gate = resolveApplyGate(args, { PROOF_BACKFILL_APPLY: process.env.PROOF_BACKFILL_APPLY });
  console.log(`${TAG} apply gate: ${gate.reason}`);

  const url = process.env.SUPABASE_URL;
  // Referenced by env NAME only; the VALUE is never logged or written anywhere.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      `${TAG} missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env. ` +
        `Set them (operator secrets) for the live lane. Aborting fail-closed.`,
    );
    return 2;
  }

  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  console.log(`${TAG} reading argument rows carrying attachedEvidence...`);
  const rows = await readArgumentRows(client);
  const report = buildBackfillReport(rows);

  const outDir = ensureOutDir();
  const stamp = nowLabel().replace(/[:.]/g, '-');
  const reportPath = path.join(outDir, `${stamp}-report.md`);
  const sqlPath = path.join(outDir, `${stamp}-proof-items.sql`);
  fs.writeFileSync(
    reportPath,
    renderReportMarkdown(report, {
      mode: gate.apply ? 'live --apply' : 'live dry-run',
      generatedAtLabel: nowLabel(),
    }),
    'utf8',
  );
  fs.writeFileSync(sqlPath, renderAllInsertSql(rows), 'utf8');
  console.log(`${TAG} report -> ${reportPath}`);
  console.log(`${TAG} reviewed SQL -> ${sqlPath}`);
  console.log(
    `${TAG} rows that would be written: ${report.proofItemRowsToWrite}; ` +
      `payment_screenshot deferred: ${report.paymentScreenshotDeferred}`,
  );

  if (!gate.apply) {
    console.log(
      `${TAG} DRY-RUN: no rows written. Review ${reportPath}, then re-run with ` +
        `--apply AND PROOF_BACKFILL_APPLY=true to write.`,
    );
    return 0;
  }

  // ── live apply (operator-gated): batched service-role inserts ──
  const allRows = rows.flatMap((row) => classifyArgumentRow(row).rows);
  console.log(`${TAG} APPLY: inserting ${allRows.length} proof_items rows...`);
  let written = 0;
  const BATCH = 200;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const { error } = await client.from('proof_items').insert(batch);
    if (error) throw new Error(`proof_items insert failed at batch ${i}: ${error.message}`);
    written += batch.length;
    console.log(`${TAG} inserted ${written}/${allRows.length}`);
  }
  console.log(`${TAG} APPLY complete. rows written: ${written}.`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(`${TAG} unhandled error: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  });
