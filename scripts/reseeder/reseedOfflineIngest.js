/**
 * RESEED-001 — offline dump ingester.
 *
 * The bank-first fallback for when args.me is unreachable. Reads a downloaded
 * Webis/DebateSum/args.me dump file and runs it through the SAME
 * `reseedNormalizer` the live fetcher uses, so both paths produce
 * byte-identical bank shapes.
 *
 * Supported dump shapes:
 *   - JSON: either the args.me envelope `{ arguments: [...] }` or a bare array.
 *   - JSONL: one args.me argument object per line.
 *
 * Like the live fetcher, the resulting records' `sourceUrl` / `sourceId`
 * attribution is written ONLY to the gitignored bank — never a committed file.
 *
 * CommonJS / no network / no Supabase / no Anthropic.
 */

const fs = require('node:fs');
const path = require('node:path');
const { normalizeArgsMeBatch } = require('./reseedNormalizer');

function parseDumpText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  // Try whole-file JSON first.
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.arguments)) return parsed.arguments;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    // fall through to JSONL
  }

  // JSONL: one object per non-empty line.
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === 'object') out.push(obj);
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

/**
 * Ingest an offline dump file into normalized ReseedSourceRecords, and
 * optionally append them to the gitignored source bank.
 *
 * @param {object} opts { dumpPath, bankPath?, runId? }
 * @returns {{ records: object[], written: number, bankPath: string|null }}
 */
function ingestOfflineDump(opts) {
  const { dumpPath, bankPath, runId } = opts || {};
  if (!dumpPath || typeof dumpPath !== 'string') {
    throw new Error('reseedOfflineIngest: opts.dumpPath (string) required.');
  }
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`reseedOfflineIngest: dump not found at ${dumpPath}`);
  }
  const text = fs.readFileSync(dumpPath, 'utf8');
  const rawArguments = parseDumpText(text);
  const fetchedAt = new Date().toISOString();
  const records = normalizeArgsMeBatch(rawArguments, { fetchedAt, ingestMode: 'offline_dump' });

  let written = 0;
  if (bankPath && typeof bankPath === 'string' && records.length > 0) {
    fs.mkdirSync(path.dirname(bankPath), { recursive: true });
    const lines = records.map((r) => JSON.stringify({ ...r, runId: runId || null }));
    fs.appendFileSync(bankPath, lines.join('\n') + '\n', 'utf8');
    written = records.length;
  }

  return { records, written, bankPath: bankPath || null };
}

module.exports = {
  ingestOfflineDump,
  parseDumpText,
};
